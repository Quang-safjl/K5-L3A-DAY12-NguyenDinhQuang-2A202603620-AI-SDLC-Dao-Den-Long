#!/usr/bin/env node
// Server tĩnh + bảng xếp hạng cục bộ.
//   node serve.js [port]                          chơi: mở http://localhost:8000
//   node serve.js --export-leaderboard out.json   xuất {"entries":[...]} đúng thứ tự rồi thoát
// Bảng xếp hạng lưu ở data/leaderboard.json (đổi thư mục: biến môi trường DDL_DATA_DIR hoặc --data <dir>).
// (Không dùng python http.server vì trên Windows nó có thể trả .js là text/plain → trình duyệt không chạy module.)
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEntry, insertEntry, parseEntries } from './src/leaderboard.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4',
};

export const leaderboardFile = (dataDir) => join(dataDir || process.env.DDL_DATA_DIR || join(ROOT, 'data'), 'leaderboard.json');
export function readLeaderboard(file) { try { return parseEntries(readFileSync(file, 'utf8')); } catch { return []; } }

async function saveLeaderboard(file, entries) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify({ entries }, null, 2) + '\n'); // ghi file tạm rồi đổi tên: không hỏng file khi tắt giữa chừng
  await rename(tmp, file);
}

function readBody(req, limit = 4096) {
  return new Promise((ok, bad) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { bad(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', bad);
  });
}

/**
 * Tạo HTTP server. `hooks` (tùy chọn) cho bench.js: { onBench(path, body) } nhận POST /__bench/*.
 */
export function createApp({ dataDir, hooks } = {}) {
  const lbFile = leaderboardFile(dataDir);
  let queue = Promise.resolve(); // ghi tuần tự, tránh 2 POST cùng lúc đè nhau
  const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (path === '/api/leaderboard') {
      if (req.method === 'GET') return json(res, 200, { entries: readLeaderboard(lbFile) });
      if (req.method === 'POST') {
        let body;
        try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'JSON không hợp lệ' }); }
        const r = makeEntry(body);
        if (!r.ok) return json(res, 400, { error: r.error });
        const job = queue.then(async () => {
          const out = insertEntry(readLeaderboard(lbFile), r.entry);
          await saveLeaderboard(lbFile, out.entries);
          return out;
        });
        queue = job.catch(() => {});
        try { const out = await job; return json(res, 200, out); } catch (e) { return json(res, 500, { error: String(e.message || e) }); }
      }
      return json(res, 405, { error: 'method' });
    }
    if (path.startsWith('/__bench/') && req.method === 'POST') { // tín hiệu từ cảnh benchmark (chỉ bench.js lắng nghe)
      let body = null; try { body = JSON.parse((await readBody(req, 1 << 20)) || 'null'); } catch {}
      hooks?.onBench?.(path.slice('/__bench/'.length), body);
      return json(res, 200, { ok: true });
    }
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + sep) || file.startsWith(resolve(dirname(lbFile)) + sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
}

function main() {
  const argv = process.argv.slice(2);
  let port = Number(process.env.PORT || 8000), exportOut = null, dataDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--export-leaderboard') exportOut = argv[++i];
    else if (argv[i] === '--data') dataDir = argv[++i];
    else if (/^\d+$/.test(argv[i])) port = Number(argv[i]);
    else { process.stderr.write(`serve: tham số lạ: ${argv[i]}\n`); process.exit(1); }
  }
  if (exportOut !== null) {
    if (!exportOut) { process.stderr.write('serve: thiếu tên file cho --export-leaderboard\n'); process.exit(1); }
    const entries = readLeaderboard(leaderboardFile(dataDir));
    writeFileSync(exportOut, JSON.stringify({ entries }, null, 2) + '\n');
    process.stdout.write(`Đã xuất ${entries.length} mục bảng xếp hạng → ${exportOut}\n`);
    return;
  }
  createApp({ dataDir }).listen(port, () => console.log(`Đảo Đèn Lồng: mở http://localhost:${port}  (Ctrl+C để tắt)`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
