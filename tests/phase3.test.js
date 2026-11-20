// Test Phase 3 (Ticket-03 "Đèn cạn dầu", Test Contract v1.2) — mã P3-xx trong docs/proof/phase-3/README.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHeadless, events, snaps, end, cleanScenario, TUNING as T, ROOT } from './helpers.js';

const far = { pos: [0, 0, -30] }; // người chơi ở xa để Bóng Mực không đuổi

test('P3-01 contract v1.2: khóa mới và thời lượng đêm 240/270/300', () => {
  const c = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
  // TICKET-04: contract nâng lên v1.3 (thêm bench_cmd, soak_cmd); khóa tuning v1.2 giữ nguyên nên phần còn lại không đổi
  assert.equal(c.contract_version, '1.3');
  const want = { fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300 };
  for (const [k, v] of Object.entries(want)) assert.equal(c.tuning[k], v, k);
});

test('P3-02 Dầu hao 1/giây; snapshot fuel 1 chữ số, ever_lit, relit_count; đèn tắt fuel 0; lit không fuel → 100', () => {
  const r = runHeadless({ ticks: 90, every: 90, scenario: cleanScenario({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true, fuel: 50 }] }) });
  const [s0, s1] = snaps(r.lines);
  assert.deepEqual([s0.lanterns[0].fuel, s0.lanterns[0].ever_lit, s0.lanterns[0].relit_count], [100, true, 0]);
  assert.equal(s1.lanterns[0].fuel, 98.5);
  assert.equal(s1.lanterns[1].fuel, 48.5);
  assert.equal(s1.lanterns[2].fuel, 0);
  assert.equal(s1.lanterns[2].ever_lit, false);
});

test('P3-03 Hết dầu: lantern_out, tắt, deposited = 0, ever_lit vẫn true', () => {
  const r = runHeadless({ ticks: 40, every: 40, scenario: cleanScenario({ lanterns: [{ id: 'L1', lit: true, fuel: 0.5, deposited: 10 }] }) });
  const out = events(r.lines, 'lantern_out');
  assert.deepEqual(out.map((e) => [e.tick, e.data]), [[30, { lantern_id: 'L1' }]]);
  const l = snaps(r.lines)[1].lanterns[0];
  assert.deepEqual([l.lit, l.deposited, l.fuel, l.ever_lit], [false, 0, 0, true]);
});

test('P3-04 Châm dầu: used = min(mang, ceil((100−fuel)/10)), fuel tối đa 100, +5/đom đóm', () => {
  const r = runHeadless({ ticks: 2, every: 1, scenario: cleanScenario({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(events(r.lines, 'refuel')[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 });
  assert.equal(snaps(r.lines)[1].player.carried, 5);
  assert.equal(end(r.lines).score, 25);
  const few = runHeadless({ ticks: 1, scenario: cleanScenario({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 20 }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(events(few.lines, 'refuel')[0].data, { lantern_id: 'L1', amount: 2, fuel: 40 });
});

test('P3-05 Đèn đầy dầu không được chọn; chọn đèn nhận được gần nhất (chưa sáng hoặc chưa đầy)', () => {
  // L1 vừa được đặt fuel 100 nhưng đã hao 1/60 trước bước tương tác → ceil(0.017/10) = 1 > 0 nên vẫn nhận; dùng carried 0? Không: kiểm bằng hai đèn
  const r = runHeadless({ ticks: 1, scenario: cleanScenario({ player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 0.5], lit: true, fuel: 100 }, { id: 'L2', pos: [0, 0, 1.5] }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  // fuel 100 → sau hao 99.983 → used = ceil(0.0167/10) = 1 → vẫn là đèn nhận được (chưa đầy) nên gần nhất L1 được châm
  assert.equal(events(r.lines, 'refuel')[0].data.lantern_id, 'L1');
  assert.equal(events(r.lines, 'refuel')[0].data.fuel, 100);
});

test('P3-06 Thắp lại: đèn ever_lit chỉ cần 5, lantern_lit relight:true, +40, relit_count, sức chứa +2', () => {
  const r = runHeadless({ ticks: 1, every: 1, scenario: cleanScenario({ player: { carried: 6 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], ever_lit: true }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(events(r.lines, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.deepEqual(events(r.lines, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  const s = snaps(r.lines)[1];
  assert.deepEqual([s.lanterns[0].lit, s.lanterns[0].fuel, s.lanterns[0].relit_count], [true, 100, 1]);
  assert.equal(s.player.capacity, 12);
  assert.equal(end(r.lines).score, 5 * 5 + 40);
  const first = runHeadless({ ticks: 1, scenario: cleanScenario({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(events(first.lines, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: false });
  assert.equal(end(first.lines).score, 10 * 5 + 100);
});

test('P3-07 Sức chứa = 10 + 2 × successful_lights, tối đa 20; đèn đặt sẵn không tính', () => {
  for (const [n, cap] of [[0, 10], [3, 16], [5, 20], [9, 20]]) {
    const r = runHeadless({ ticks: 1, every: 1, scenario: cleanScenario({ player: { successful_lights: n }, lanterns: [{ id: 'L1', lit: true }] }) });
    assert.equal(snaps(r.lines)[0].player.capacity, cap);
  }
  const motes = Array.from({ length: 14 }, () => [0, 0, 0]);
  const r = runHeadless({ ticks: 2, every: 2, scenario: cleanScenario({ player: { successful_lights: 1 }, motes }) });
  assert.equal(snaps(r.lines)[1].player.carried, 12);
});

test('P3-08 fuel < 30 mất vùng an toàn: Bóng Mực vào được và đánh trúng', () => {
  const mk = (fuel) => runHeadless({ ticks: 150, scenario: cleanScenario({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel }], shades: [{ id: 'S1', pos: [8, 1, 0], state: 'chase' }] }) });
  assert.equal(events(mk(20).lines, 'player_hit').length, 1);
  assert.equal(events(mk(80).lines, 'player_hit').length, 0);
});

test('P3-09 Bóng wander đi tới đèn yếu gần nhất, ≤ 2 m thì drain: đứng yên, hút 5/s (+ hao 1/s), fuel_drain mỗi 60 tick, đèn tắt → wander', () => {
  const r = runHeadless({
    ticks: 400, every: 1,
    scenario: cleanScenario({ player: far, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'wander' }] }),
  });
  const ss = snaps(r.lines);
  assert.equal(ss[1].shades[0].state, 'drain');
  assert.deepEqual(ss[1].shades[0].pos, ss[50].shades[0].pos, 'đứng yên');
  const fd = events(r.lines, 'fuel_drain');
  assert.equal(fd[0].tick, 61, 'bắt đầu drain ở tick 1 → sự kiện sau 60 tick hút');
  assert.deepEqual(fd[0].data.lantern_id, 'L1');
  assert.equal(fd[0].data.shade_id, 'S1');
  assert.ok(Math.abs(fd[0].data.fuel - (20 - 6)) <= 0.1, `fuel ${fd[0].data.fuel}`);
  const out = events(r.lines, 'lantern_out')[0];
  assert.ok(out.tick >= 199 && out.tick <= 201, `tắt ở tick ${out.tick} (20 / 6 per s)`);
  assert.equal(ss[out.tick + 1].shades[0].state, 'wander');
});

test('P3-10 Hai Bóng hút cùng đèn thì cộng dồn', () => {
  const r = runHeadless({ ticks: 60, every: 60, scenario: cleanScenario({ player: far, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 29 }], shades: [{ id: 'S1', pos: [1, 1, 0], state: 'drain', target_lantern_id: 'L1' }, { id: 'S2', pos: [-1, 1, 0], state: 'drain', target_lantern_id: 'L1' }] }) });
  assert.equal(snaps(r.lines)[1].lanterns[0].fuel, 29 - 11);
});

test('P3-11 drain → chase khi Mây trong 6 m; Tỏa Sáng trúng Bóng đang drain: +15, stunned; hết choáng → wander', () => {
  const r = runHeadless({
    ticks: 125, every: 1,
    scenario: cleanScenario({ player: { pos: [0, 0, -4], carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 0], state: 'drain', target_lantern_id: 'L1' }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(events(r.lines, 'pulse')[0].data, { stunned_ids: ['S1'] });
  assert.equal(snaps(r.lines)[1].shades[0].state, 'stunned');
  assert.equal(snaps(r.lines)[121].shades[0].state, 'wander');
  assert.equal(snaps(r.lines)[1].score, 15);
  const c = runHeadless({ ticks: 1, every: 1, scenario: cleanScenario({ player: { pos: [0, 0, -5] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 0], state: 'drain', target_lantern_id: 'L1' }] }) });
  assert.equal(snaps(c.lines)[1].shades[0].state, 'chase');
});

test('P3-12 Châm dầu lên ≥ 30 khi Bóng đang trong vùng: bị đẩy ra mép 6 m trong ≤ 30 tick, không sát thương', () => {
  const r = runHeadless({
    ticks: 31, every: 1,
    scenario: cleanScenario({ player: { pos: [0, 0, -1.5], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'drain', target_lantern_id: 'L1' }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(r.lines, 'refuel').length, 1);
  assert.equal(events(r.lines, 'player_hit').length, 0);
  const sh = snaps(r.lines)[31].shades[0];
  assert.ok(Math.hypot(sh.pos[0], sh.pos[2]) >= 6 - 1e-3);
});

test('P3-13 Bình minh: còn sống + ≥ ceil(0.6×tổng) đèn sáng → won dawn_survived; điểm 50+floor(fuel)/đèn + 50/lửa; thiếu → lost dawn', () => {
  const lit3 = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true }));
  const w = runHeadless({ ticks: 100, scenario: cleanScenario({ time_left_s: 1, player: { flames: 2 }, lanterns: lit3 }) });
  assert.deepEqual(events(w.lines, 'game_over')[0].data, { result: 'won', reason: 'dawn_survived' });
  assert.deepEqual(end(w.lines), { type: 'end', ticks: 60, state: 'won', score: 3 * (50 + 99) + 2 * 50 });
  const l = runHeadless({ ticks: 100, scenario: cleanScenario({ time_left_s: 1, lanterns: lit3.slice(0, 2) }) });
  assert.deepEqual(events(l.lines, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(end(l.lines).score, 0);
  for (const [n, need] of [[2, 4], [3, 5]]) {
    const lit = Array.from({ length: need }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
    const ok = runHeadless({ night: n, ticks: 100, scenario: cleanScenario({ time_left_s: 1, lanterns: lit }) });
    assert.equal(end(ok.lines).state, 'won', `night ${n}`);
    const bad = runHeadless({ night: n, ticks: 100, scenario: cleanScenario({ time_left_s: 1, lanterns: lit.slice(1) }) });
    assert.equal(end(bad.lines).state, 'lost', `night ${n}`);
  }
});

test('P3-14 Hết Ngọn Lửa ở đúng tick bình minh vẫn thua no_flames', () => {
  const lit = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = runHeadless({ ticks: 100, scenario: cleanScenario({ time_left_s: 1 / 60, player: { flames: 1 }, lanterns: lit, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] }) });
  assert.deepEqual(events(r.lines, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
});

test('P3-15 Đèn tắt đúng tick bình minh không được tính (tắt ngay sau bước 2)', () => {
  const lit = [{ id: 'L1', lit: true, fuel: 1 / 60 }, { id: 'L2', lit: true }, { id: 'L3', lit: true }];
  const r = runHeadless({ ticks: 10, scenario: cleanScenario({ time_left_s: 1 / 60, lanterns: lit }) });
  assert.deepEqual(events(r.lines, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(events(r.lines, 'lantern_out').length, 1);
});
