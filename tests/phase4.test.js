// Test Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0", Test Contract v1.3) — mã P4-xx trong docs/proof/phase-4/README.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHeadless, TUNING as T, ROOT } from './helpers.js';
import { step, fuelOf } from '../src/sim.js';
import { createBenchGame, benchCamera, frameStats, BENCH } from '../src/bench.js';
import { makeSoakInput } from '../soak.js';
import { isValidName, makeEntry, insertEntry, sortEntries, parseEntries, isIsoWithTz, isoLocal, MAX_ENTRIES } from '../src/leaderboard.js';
import { ACTION_IDS, defaultBinds, assignKey, parseBinds, actionOf, findDuplicates } from '../src/keybinds.js';
import { createApp } from '../serve.js';

const contract = () => JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
const NO_INPUT = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };

test('P4-01 contract v1.3: bench_cmd, soak_cmd; run_cmd nhận thêm tham số được; tuning giữ nguyên như v1.2', () => {
  const c = contract();
  assert.equal(c.contract_version, '1.3');
  assert.equal(c.bench_cmd, 'node bench.js');
  assert.equal(c.soak_cmd, 'node soak.js');
  assert.ok(!c.run_cmd.includes('#'), 'run_cmd không được có comment (sẽ nuốt --export-leaderboard)');
  let old = null;
  try { old = JSON.parse(execFileSync('git', ['show', 'phase-3:game.contract.json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch {}
  if (old) assert.deepEqual(c.tuning, old.tuning, 'số liệu tuning không được đổi');
});

test('P4-02 đầu ra headless không đổi so với Phase 3 (seed 42, 4000 tick, 3 Đêm)', () => {
  for (const n of [1, 2, 3]) {
    const ref = join(ROOT, `docs/proof/phase-3/runs/det-n${n}-a.jsonl`);
    if (!existsSync(ref)) continue;
    const r = runHeadless({ seed: 42, night: n, ticks: 4000 });
    assert.equal(r.code, 0);
    assert.equal(r.raw, readFileSync(ref, 'utf8').replace(/\r\n/g, '\n'), `Đêm ${n} khác bản Phase 3`);
  }
});

test('P4-03 cảnh bench: Đêm 1, đúng 200 Bóng wander + 100 đom đóm rải trên đảo, L1–L3 sáng fuel 100, Mây ở (0,0,0)', () => {
  const g = createBenchGame({ tuning: T, seed: 42 });
  assert.equal(g.night, 1);
  assert.equal(g.shades.length, 200);
  assert.ok(g.shades.every((s) => s.state === 'wander'));
  assert.equal(g.motes.length, 100);
  for (const e of [...g.shades, ...g.motes]) assert.ok(g.map.ground(e.pos[0], e.pos[2]) !== null, 'nằm trên đảo');
  assert.deepEqual(g.lanterns.map((l) => [l.id, l.lit, l.lit ? fuelOf(l) : 0]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.deepEqual(g.player.pos, [0, 0, 0]);
  // rải đều: mỗi góc phần tư đều có Bóng và đom đóm
  const quad = (p) => (p[0] >= 0 ? 1 : 0) + (p[2] >= 0 ? 2 : 0);
  for (const list of [g.shades, g.motes]) {
    const q = [0, 0, 0, 0]; for (const e of list) q[quad(e.pos)]++;
    assert.ok(q.every((k) => k >= list.length * 0.15), `phân bố lệch: ${q}`);
  }
  // tất định theo seed
  const g2 = createBenchGame({ tuning: T, seed: 42 }), g3 = createBenchGame({ tuning: T, seed: 43 });
  assert.deepEqual(g2.shades.map((s) => s.pos), g.shades.map((s) => s.pos));
  assert.notDeepEqual(g3.shades.map((s) => s.pos), g.shades.map((s) => s.pos));
});

test('P4-04 bench tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm; Bóng vẫn di chuyển theo wander', () => {
  const g = createBenchGame({ tuning: T, seed: 42 });
  const before = g.shades.map((s) => [...s.pos]);
  const evs = [];
  const ticks = Math.round(T.night1_duration_s * 60) + 600; // quá cả thời lượng Đêm
  for (let i = 0; i < ticks; i++) evs.push(...step(g, NO_INPUT));
  assert.deepEqual(evs.map((e) => e.name).filter((n) => n !== 'fuel_drain'), [], 'không có sự kiện gameplay nào');
  assert.equal(g.state, 'playing');
  assert.equal(g.shades.length, 200);
  assert.equal(g.motes.length, 100);
  assert.equal(g.player.flames, T.flames);
  assert.equal(g.player.carried, 0);
  assert.deepEqual(g.lanterns.filter((l) => l.lit).map((l) => fuelOf(l)), [100, 100, 100]);
  assert.ok(g.shades.every((s) => s.state === 'wander'), 'chỉ wander (không chase/drain)');
  const moved = g.shades.filter((s, i) => Math.hypot(s.pos[0] - before[i][0], s.pos[2] - before[i][2]) > 1).length;
  assert.ok(moved >= 150, `Bóng phải di chuyển (${moved}/200)`);
  assert.deepEqual(g.player.pos, [0, 0, 0]);
});

test('P4-05 camera bench: R 30, Y 15, nhìn tâm, bắt đầu (30,15,0), ngược chiều kim đồng hồ nhìn từ trên, 15 s/vòng', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(benchCamera(0), [30, 15, 0]));
  assert.ok(near(benchCamera(15), [30, 15, 0]));
  assert.ok(near(benchCamera(7.5), [-30, 15, 0]));
  // 1/4 vòng: nhìn từ +Y xuống (x phải, −z lên trên) thì ngược chiều kim đồng hồ đi từ +x sang −z
  assert.ok(near(benchCamera(3.75), [0, 15, -30]));
  // cross(r0, r1).y > 0 ⇔ quay dương quanh +Y ⇔ ngược chiều kim đồng hồ khi nhìn từ trên
  const a = benchCamera(0), b = benchCamera(0.1);
  assert.ok(a[2] * b[0] - a[0] * b[2] > 0);
  for (const t of [0, 1, 2.2, 9]) { const p = benchCamera(t); assert.ok(Math.abs(Math.hypot(p[0], p[2]) - 30) < 1e-9 && p[1] === 15); }
  assert.equal(BENCH.warmupS, 3);
});

test('P4-06 công thức số đo bench: avg_fps, p1_low_fps (k = max(1, ceil(1%·N))), frame_ms_p95, frames', () => {
  const dts = [...Array(98).fill(10), 40, 50]; // N = 100 → k = 1
  const s = frameStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, Math.round((1000 * 100) / (980 + 90) * 10) / 10);
  assert.equal(s.p1_low_fps, 20); // 1000 / 50
  assert.equal(s.frame_ms_p95, 10);
  const s2 = frameStats([...Array(150).fill(5), 20, 30]); // N = 152 → k = 2 → (30 + 20)/2 = 25 ms → 40 fps
  assert.equal(s2.p1_low_fps, 40);
  const s3 = frameStats(Array.from({ length: 20 }, (_, i) => i + 1)); // p95 nearest-rank của 1..20 = 19
  assert.equal(s3.frame_ms_p95, 19);
  assert.equal(frameStats([]).frames, 0);
});

test('P4-07 soak: N Đêm xoay vòng trong một tiến trình, đúng định dạng, 0 crash, RAM cuối ≤ 1.2 × đầu, tất định', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-soak-'));
  const run = (out) => {
    const r = spawnSync('node', [join(ROOT, 'soak.js'), '--seed', '7', '--nights', '4', '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(readFileSync(out, 'utf8'));
  };
  const a = run(join(dir, 'a.json')), b = run(join(dir, 'b.json'));
  assert.deepEqual(Object.keys(a), ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']);
  assert.equal(a.nights, 4);
  assert.equal(a.crashes, 0);
  assert.equal(a.results.length, 4);
  assert.ok(a.results.every((x) => x === 'won' || x === 'lost'));
  assert.deepEqual(a.results, b.results, 'tất định theo seed');
  assert.ok(a.mem_start_mb > 0 && a.mem_end_mb <= 1.2 * a.mem_start_mb, `${a.mem_start_mb} → ${a.mem_end_mb}`);
});

test('P4-08 input soak: đổi hướng mỗi 30 tick; xác suất nhảy 5%, lướt 3%, tỏa sáng 2%, tương tác 10%', () => {
  const next = makeSoakInput(7), N = 60000, c = { jump: 0, dash: 0, pulse: 0, interact: 0 };
  let prev = null, changes = 0;
  for (let i = 0; i < N; i++) {
    const f = next();
    for (const k of Object.keys(c)) if (f[k]) c[k]++;
    assert.ok(Math.abs(Math.hypot(...f.move) - 1) < 1e-9);
    if (prev && (f.move[0] !== prev[0] || f.move[1] !== prev[1])) { changes++; assert.equal(i % 30, 0, `đổi hướng ở tick ${i}`); }
    prev = f.move;
  }
  assert.ok(changes > N / 30 - 5);
  for (const [k, p] of [['jump', 0.05], ['dash', 0.03], ['pulse', 0.02], ['interact', 0.10]]) {
    const r = c[k] / N; assert.ok(Math.abs(r - p) < 0.006, `${k}: ${r}`);
  }
  assert.deepEqual(Array.from({ length: 50 }, makeSoakInput(9)), Array.from({ length: 50 }, makeSoakInput(9)));
});

test('P4-09 bảng xếp hạng: tên 3–12 [A-Za-z0-9_] (+ tiếng Việt có dấu), top 10, điểm giảm dần, bằng điểm ai trước đứng trên', () => {
  for (const ok of ['May', 'abc', 'Mây_đẹp', 'NGUYEN_123', 'ĐăngQuang12', 'a'.repeat(12)]) assert.ok(isValidName(ok), ok);
  for (const bad of ['ab', 'a'.repeat(13), 'có cách', 'tên!', '', '日本語名前', 'x-y-z']) assert.ok(!isValidName(bad), bad);
  assert.ok(isIsoWithTz(isoLocal(new Date(2026, 10, 20, 9, 5, 7))));
  assert.ok(isIsoWithTz('2026-11-20T16:40:05+07:00') && isIsoWithTz('2026-11-20T09:40:05.120Z'));
  assert.ok(!isIsoWithTz('2026-11-20T16:40:05') && !isIsoWithTz('20/11/2026'));
  const e = (name, score, at, seed = 1) => makeEntry({ name, score, nights_won: 1, achieved_at: at, seed }).entry;
  assert.equal(makeEntry({ name: 'May', score: -1, nights_won: 0, achieved_at: '2026-11-20T10:00:00+07:00', seed: 1 }).ok, false);
  assert.equal(makeEntry({ name: 'May', score: 5, nights_won: 4, achieved_at: '2026-11-20T10:00:00+07:00', seed: 1 }).ok, false);
  let list = [];
  for (let i = 0; i < 12; i++) list = insertEntry(list, e(`P${String(i).padStart(2, '0')}`, i * 10, `2026-11-20T10:${String(10 + i).padStart(2, '0')}:00+07:00`)).entries;
  assert.equal(list.length, MAX_ENTRIES);
  assert.deepEqual(list.map((x) => x.score), [110, 100, 90, 80, 70, 60, 50, 40, 30, 20]);
  // bằng điểm: ai đạt trước đứng trên (kể cả khác múi giờ)
  const tie = sortEntries([e('Late', 50, '2026-11-20T11:00:00+07:00'), e('Early', 50, '2026-11-20T03:30:00Z')]);
  assert.deepEqual(tie.map((x) => x.name), ['Early', 'Late']);
  const r = insertEntry(list, e('Zero', 0, '2026-11-20T12:00:00+07:00'));
  assert.equal(r.rank, null, 'điểm thấp hơn top 10 thì không vào bảng');
  assert.deepEqual(Object.keys(list[0]), ['name', 'score', 'nights_won', 'achieved_at', 'seed']);
  assert.deepEqual(parseEntries('hỏng'), []);
});

test('P4-10 bảng xếp hạng lưu đĩa qua serve.js, còn sau khi khởi động lại; --export-leaderboard ra {"entries":[...]} đúng thứ tự', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
  const start = () => new Promise((ok) => { const s = createApp({ dataDir }); s.listen(0, '127.0.0.1', () => ok(s)); });
  const post = (port, body) => fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let srv = await start();
  const port = srv.address().port;
  const base = { nights_won: 2, seed: 77 };
  assert.equal((await post(port, { ...base, name: 'Ab', score: 10, achieved_at: '2026-11-20T10:00:00+07:00' })).status, 400);
  assert.equal((await post(port, { ...base, name: 'May', score: 10.5, achieved_at: '2026-11-20T10:00:00+07:00' })).status, 400);
  for (const [name, score, at] of [['Alpha', 300, '2026-11-20T10:00:00+07:00'], ['Bravo', 500, '2026-11-20T10:01:00+07:00'], ['Charlie', 300, '2026-11-20T09:59:00+07:00']]) {
    const r = await post(port, { ...base, name, score, achieved_at: at });
    assert.equal(r.status, 200);
  }
  await new Promise((r) => srv.close(r));
  // "tắt và mở lại game"
  srv = await start();
  const j = await (await fetch(`http://127.0.0.1:${srv.address().port}/api/leaderboard`)).json();
  await new Promise((r) => srv.close(r));
  assert.deepEqual(j.entries.map((e) => e.name), ['Bravo', 'Charlie', 'Alpha']);
  const out = join(dataDir, 'out.json');
  const r = spawnSync('node', [join(ROOT, 'serve.js'), '--export-leaderboard', out, '--data', dataDir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const exp = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(exp), ['entries']);
  assert.deepEqual(exp.entries, j.entries);
  assert.deepEqual(exp.entries[0], { name: 'Bravo', score: 500, nights_won: 2, achieved_at: '2026-11-20T10:01:00+07:00', seed: 77 });
  // thư mục dữ liệu không bị phục vụ ra web
  srv = await start();
  const forbidden = await fetch(`http://127.0.0.1:${srv.address().port}/data/leaderboard.json`);
  await new Promise((r) => srv.close(r));
  assert.notEqual(forbidden.status, 200);
});

test('P4-11 đổi phím: đủ mọi hành động, báo trùng phím (không gán), khôi phục mặc định, lưu/đọc lại', () => {
  for (const a of ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']) assert.ok(ACTION_IDS.includes(a), a);
  const d = defaultBinds();
  assert.deepEqual(findDuplicates(d), []);
  assert.equal(actionOf(d, 'KeyW'), 'up');
  assert.equal(actionOf(d, 'Escape'), 'pause');
  const dup = assignKey(d, 'jump', 0, 'KeyE');
  assert.equal(dup.ok, false);
  assert.deepEqual(dup.conflict, { action: 'interact', slot: 0 });
  assert.match(dup.error, /Tương tác/);
  assert.deepEqual(dup.binds, d, 'trùng thì không đổi');
  const ok = assignKey(d, 'jump', 0, 'KeyJ');
  assert.ok(ok.ok);
  assert.equal(actionOf(ok.binds, 'KeyJ'), 'jump');
  assert.equal(actionOf(ok.binds, 'Space'), null);
  assert.equal(d.jump[0], 'Space', 'không sửa bản cũ');
  assert.equal(assignKey(d, 'jump', 0, 'Space').ok, true, 'gán lại đúng phím của chính ô đó không tính là trùng');
  assert.equal(assignKey(d, 'pulse', 0, null).ok, false, 'ô chính không được trống');
  assert.equal(assignKey(d, 'pulse', 1, 'Enter').ok, false, 'Enter dành cho menu');
  assert.deepEqual(parseBinds(JSON.stringify(ok.binds)), ok.binds);
  assert.deepEqual(parseBinds('{"jump":["KeyE",null]}'), defaultBinds(), 'dữ liệu lưu bị trùng → mặc định');
  assert.deepEqual(parseBinds('hỏng'), defaultBinds());
});
