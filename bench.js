#!/usr/bin/env node
// TICKET-04 §1 Benchmark: node bench.js --seed 42 --duration 30 --out bench.json [--browser <đường dẫn>] [--port 0]
// Mở cửa sổ trình duyệt (Chrome/Edge/Chromium) 1280×720 KHÔNG toàn màn hình, tắt vsync bằng cờ Chromium,
// tải cảnh benchmark chuẩn (src/bench.js), khởi động 3 s, đo đúng --duration giây, ghi JSON rồi thoát mã 0.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir, cpus, totalmem, type, release, arch, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './serve.js';

const T_START = Date.now() - Math.round(process.uptime() * 1000); // lúc tiến trình bắt đầu
const ROOT = dirname(fileURLToPath(import.meta.url));
const VSYNC_FLAGS = ['--disable-gpu-vsync', '--disable-frame-rate-limit'];

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) { process.stderr.write(`bench: tham số sai: ${argv[i]}\n`); process.exit(1); }
    a[argv[i].slice(2)] = argv[i + 1];
  }
  return a;
}

export function findBrowser(explicit) {
  const c = [explicit, process.env.CHROME, process.env.BROWSER].filter(Boolean);
  if (platform() === 'win32') {
    const pf = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const b of pf) c.push(join(b, 'Google/Chrome/Application/chrome.exe'), join(b, 'Microsoft/Edge/Application/msedge.exe'), join(b, 'Chromium/Application/chrome.exe'));
  } else if (platform() === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      try { c.push(execFileSync('which', [n], { encoding: 'utf8' }).trim()); } catch {}
    }
  }
  return c.find((p) => p && existsSync(p)) || null;
}

// Theo dõi RSS (MB) của mọi tiến trình trình duyệt dùng hồ sơ tạm của lần chạy này (Chromium có nhiều tiến trình).
// Windows: MỘT tiến trình PowerShell chạy suốt (lấy PID 1 lần rồi đọc WorkingSet64 mỗi giây) — tránh khởi động
// PowerShell liên tục làm nhiễu số đo. Linux/macOS: `ps` mỗi giây.
function startMemWatch(profile, onSample) {
  if (platform() === 'win32') {
    const esc = profile.replace(/'/g, "''");
    const ps = `$ids = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${esc}*' } | ForEach-Object { $_.ProcessId });`
      + ` $n = 0; while ($true) { if ($n % 10 -eq 0) { $ids = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${esc}*' } | ForEach-Object { $_.ProcessId }) };`
      + ` $s = (Get-Process -Id $ids -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum; [Console]::Out.WriteLine($s); [Console]::Out.Flush(); $n++; Start-Sleep -Milliseconds 1000 }`;
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const v = Number(buf.slice(0, i).trim()); buf = buf.slice(i + 1); if (v > 0) onSample(v / 1048576); } });
    return () => killTree(p);
  }
  const iv = setInterval(() => {
    try {
      let kb = 0;
      for (const line of execFileSync('ps', ['-eo', 'rss=,args='], { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n')) if (line.includes(profile)) kb += Number(line.trim().split(/\s+/)[0]) || 0;
      if (kb > 0) onSample(kb / 1024);
    } catch {}
  }, 1000);
  return () => clearInterval(iv);
}

function killTree(child) {
  try {
    if (platform() === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGKILL');
  } catch { try { child.kill('SIGKILL'); } catch {} }
}

function osInfo() {
  let name = `${type()} ${release()} ${arch()}`;
  try { if (platform() === 'linux') { const m = /PRETTY_NAME="([^"]+)"/.exec(readFileSync('/etc/os-release', 'utf8')); if (m) name = `${m[1]} (${release()}) ${arch()}`; } } catch {}
  return `${name} · CPU: ${cpus()[0]?.model?.trim()} ×${cpus().length} · RAM ${Math.round(totalmem() / 1073741824)} GB`;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const seed = Number.parseInt(a.seed ?? '42', 10), duration = Number(a.duration ?? '30'), out = a.out ?? 'bench.json';
  if (!Number.isInteger(seed) || !(duration > 0)) { process.stderr.write('bench: --seed phải là số nguyên, --duration > 0\n'); process.exit(1); }
  const browser = findBrowser(a.browser);
  if (!browser) { process.stderr.write('bench: không tìm thấy Chrome/Edge/Chromium. Chỉ định bằng --browser <đường dẫn> hoặc biến CHROME.\n'); process.exit(1); }
  const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));

  let firstFrameAt = null, measuring = false, peak = 0, result = null, resolveDone, stopWatch = () => {};
  const done = new Promise((r) => { resolveDone = r; });
  const app = createApp({
    hooks: {
      onBench(path, body) {
        if (path === 'first-frame' && firstFrameAt === null) {
          firstFrameAt = Date.now();
          // bắt đầu theo dõi RAM ngay trong 3 s khởi động; chỉ ghi nhận mẫu khi đang đo
          stopWatch = startMemWatch(profile, (mb) => { if (measuring && mb > peak) peak = mb; });
        }
        else if (path === 'measure-start') measuring = true;
        else if (path === 'result') { measuring = false; result = body; resolveDone(); }
      },
    },
  });
  await new Promise((r) => app.listen(Number(a.port ?? 0), '127.0.0.1', r));
  const port = app.address().port;
  const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
  const url = `http://127.0.0.1:${port}/index.html?bench=1&seed=${seed}&duration=${duration}`;
  const args = [
    `--user-data-dir=${profile}`, `--app=${url}`, '--window-size=1280,720', '--window-position=40,40', '--force-device-scale-factor=1',
    ...VSYNC_FLAGS, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required',
  ];
  process.stdout.write(`bench: ${browser}\nbench: mở ${url} (khởi động ${3} s + đo ${duration} s)\n`);
  const child = spawn(browser, args, { stdio: 'ignore', detached: platform() !== 'win32' });

  const timeout = setTimeout(() => resolveDone('timeout'), (duration + 60) * 1000);
  const why = await done;
  stopWatch(); clearTimeout(timeout);
  killTree(child); app.close();
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} }, 1500);

  if (why === 'timeout' || !result) { process.stderr.write('bench: quá thời gian, trang không gửi kết quả (trình duyệt có hỗ trợ WebGL không?)\n'); process.exit(1); }
  const res = {
    contract_version: contract.contract_version,
    avg_fps: result.avg_fps,
    p1_low_fps: result.p1_low_fps,
    frame_ms_p95: result.frame_ms_p95,
    frames: result.frames,
    load_ms: firstFrameAt - T_START,
    peak_mem_mb: peak > 0 ? Math.round(peak) : null,
    vsync_off: true,
    renderer: result.renderer,
    os: osInfo(),
    notes: `Bản web chạy trong ${browser.split(/[\\/]/).pop()} (cửa sổ --app ${result.viewport.join('×')}, pixel ratio ${result.pixel_ratio}); vsync tắt bằng cờ ${VSYNC_FLAGS.join(' ')}. `
      + 'peak_mem_mb = tổng RSS (working set) của mọi tiến trình trình duyệt thuộc hồ sơ tạm của lần chạy, lấy mẫu mỗi 1 s trong khoảng đo. '
      + 'load_ms tính từ lúc tiến trình bench.js bắt đầu (gồm khởi động trình duyệt) tới khung hình đầu tiên của cảnh bench.',
  };
  writeFileSync(out, JSON.stringify(res, null, 2) + '\n');
  process.stdout.write(`bench: avg ${res.avg_fps} FPS · 1% low ${res.p1_low_fps} · p95 ${res.frame_ms_p95} ms · ${res.frames} khung · load ${res.load_ms} ms · RAM ${res.peak_mem_mb} MB → ${out}\n`);
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
