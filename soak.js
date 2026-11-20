#!/usr/bin/env node
// TICKET-04 §2 Soak test: node soak.js --seed 7 --nights 10 --out soak.json
// Chạy headless N Đêm liên tiếp trong CÙNG tiến trình (Đêm 1 → 2 → 3 xoay vòng), Đêm thứ i (i = 0..N−1) dùng seed + i.
// Input ngẫu nhiên theo seed: mỗi 30 tick chọn lại hướng; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createGame, step, makeRng, TICK_RATE } from './src/sim.js';
import { NIGHTS } from './src/maps.js';

const ROOT = dirname(fileURLToPath(import.meta.url));

/** Bộ sinh input ngẫu nhiên theo seed (tách riêng để test). */
export function makeSoakInput(seed) {
  const rng = makeRng((seed ^ 0x5eed) >>> 0);
  let move = [0, 0], tick = 0;
  return function next() {
    if (tick % 30 === 0) { const a = rng() * Math.PI * 2; move = [Math.cos(a), Math.sin(a)]; }
    tick++;
    // mỗi tick: 4 lần rút độc lập cho 4 hành động (nhấn trong tick đó)
    const jump = rng() < 0.05, dash = rng() < 0.03, pulse = rng() < 0.02, interact = rng() < 0.10;
    return { move, cam_yaw_deg: 0, jump, dash, pulse, interact, pause: false };
  };
}

/** Chạy 1 Đêm tới khi kết thúc hoặc hết thời lượng chuẩn. Trả 'won' | 'lost' | 'timeout'. */
export function runNight({ tuning, night, seed }) {
  const g = createGame({ tuning, seed, night });
  const input = makeSoakInput(seed);
  const maxTicks = Math.round(tuning[NIGHTS[night].durationKey] * TICK_RATE) + 1;
  for (let k = 0; k < maxTicks && (g.state === 'playing' || g.state === 'paused'); k++) step(g, input());
  return { result: g.state === 'won' || g.state === 'lost' ? g.state : 'timeout', ticks: g.tick, score: g.score };
}

// Cờ V8 cho chạy dài (xem docs/adr/0002-soak-memory-flags.md): chỉ JIT nền (Sparkplug) + ưu tiên bộ nhớ.
// Không có rò rỉ (heapUsed phẳng); các cờ này loại bỏ phần RSS dao động do bộ biên dịch tối ưu (Maglev/Turbofan).
export const SOAK_FLAGS = ['--max-opt=1', '--optimize-for-size', '--expose-gc'];
const rssMb = () => { if (globalThis.gc) { globalThis.gc(); globalThis.gc(); } return Math.round((process.memoryUsage().rss / 1048576) * 10) / 10; };

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) { process.stderr.write(`soak: tham số sai: ${argv[i]}\n`); process.exit(1); }
    a[argv[i].slice(2)] = argv[i + 1];
  }
  return a;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const seed = Number.parseInt(a.seed ?? '7', 10), nights = Number.parseInt(a.nights ?? '10', 10), out = a.out ?? 'soak.json';
  if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) { process.stderr.write('soak: --seed và --nights phải là số nguyên (nights ≥ 1)\n'); process.exit(1); }
  const tuning = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8')).tuning;
  const t0 = process.hrtime.bigint();
  const results = [], log = [];
  let crashes = 0, memStart = null;
  for (let i = 0; i < nights; i++) {
    const night = (i % 3) + 1, s = seed + i;
    try {
      // "sau khi tải xong Đêm đầu tiên": đo RSS ngay sau khi tạo Đêm 1 (Đêm này được chạy lại từ đầu bên dưới)
      if (i === 0) { createGame({ tuning, seed: s, night }); memStart = rssMb(); }
      const r = runNight({ tuning, night, seed: s });
      results.push(r.result);
      log.push(`Đêm #${i + 1} (đảo ${night}, seed ${s}): ${r.result} sau ${r.ticks} tick, điểm ${r.score}`);
    } catch (e) {
      crashes++; results.push('crash');
      log.push(`Đêm #${i + 1} (đảo ${night}, seed ${s}): CRASH ${e && e.stack ? e.stack.split('\n')[0] : e}`);
    }
  }
  // "sau khi reset xong Đêm cuối cùng": bỏ trạng thái Đêm cuối, tạo Đêm mới như khi bấm chơi lại, rồi đo
  createGame({ tuning, seed: seed + nights, night: (nights % 3) + 1 });
  const memEnd = rssMb();
  const duration = Number(process.hrtime.bigint() - t0) / 1e9;
  const res = { nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: Math.round(duration * 10) / 10 };
  writeFileSync(out, JSON.stringify(res, null, 2) + '\n');
  for (const l of log) process.stdout.write(l + '\n');
  process.stdout.write(`soak: crashes=${crashes} mem ${memStart} → ${memEnd} MB (giới hạn ${Math.round(memStart * 1.2 * 10) / 10}) · ${res.duration_s} s → ${out}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (SOAK_FLAGS.every((f) => process.execArgv.includes(f))) main();
  else {
    // Gọi trần `node soak.js …`: chạy lại đúng 1 tiến trình con có cờ; mọi Đêm chạy trong tiến trình con đó.
    const r = spawnSync(process.execPath, [...SOAK_FLAGS, fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
}
