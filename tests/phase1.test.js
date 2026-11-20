// Test Phase 1 — mỗi test gắn mã yêu cầu (R-xx) trong docs/proof/phase-1/README.md
// Phase 2 (Ticket-02) thay số liệu & một số luật; các chỗ sửa ghi "TICKET-02:" kèm lý do.
// Mọi con số đọc từ tuning nên test tự theo số chuẩn mới.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, events, snaps, end, cleanScenario, TUNING as T } from './helpers.js';

const L1 = { id: 'L1', pos: [0, 0, 0] };

test('R-01 contract: snapshot tick 0 đầu tiên, end cuối, đúng số tick, snapshot mỗi 10 tick', () => {
  const r = runHeadless({ ticks: 100, scenario: cleanScenario() });
  assert.equal(r.code, 0);
  assert.equal(r.lines[0].type, 'snapshot');
  assert.equal(r.lines[0].tick, 0);
  assert.deepEqual(end(r.lines), { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.deepEqual(snaps(r.lines).map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const s = r.lines[0];
  for (const k of ['sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) assert.ok(k in s, k);
  assert.equal(s.lanterns.length, T.lantern_count_night1);
});

test('R-01 --snapshot-every tùy chỉnh và time_left_s = thời lượng - bước/60', () => {
  const r = runHeadless({ ticks: 120, every: 60, scenario: cleanScenario() });
  const ss = snaps(r.lines);
  assert.deepEqual(ss.map((s) => s.tick), [0, 60, 120]);
  assert.equal(ss[2].time_left_s, T.night1_duration_s - 2);
  assert.equal(ss[2].sim_tick, 120);
});

test('R-02 di chuyển: player_speed m/s theo hướng camera, vector dài được chuẩn hóa', () => {
  const fwd = runHeadless({ ticks: 60, every: 60, scenario: cleanScenario(), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.deepEqual(snaps(fwd.lines)[1].player.pos, [0, 0, T.player_speed]);
  const yaw = runHeadless({ ticks: 60, every: 60, scenario: cleanScenario(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  assert.deepEqual(snaps(yaw.lines)[1].player.pos, [T.player_speed, 0, 0]);
  const diag = runHeadless({ ticks: 60, every: 60, scenario: cleanScenario(), inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const p = snaps(diag.lines)[1].player.pos;
  assert.ok(Math.abs(Math.hypot(p[0], p[2]) - T.player_speed) < 0.01);
});

test('R-02 frame chỉ đổi trường có mặt; trường vắng giữ giá trị cũ', () => {
  const r = runHeadless({ ticks: 60, every: 60, scenario: cleanScenario(), inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 30, jump: true }] } });
  assert.equal(snaps(r.lines)[1].player.pos[2], T.player_speed);
});

test('R-03 nhặt đom đóm trong pickup_radius, không nhặt ngoài bán kính', () => {
  const r = runHeadless({ ticks: 5, scenario: cleanScenario({ motes: [[0, 0, T.pickup_radius], [0, 0, T.pickup_radius + 0.05]] }) });
  const ev = events(r.lines, 'mote_picked');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { carried: 1 });
  // TICKET-02: điểm +10 tính khi NẠP đom đóm, không còn khi nhặt
  assert.equal(end(r.lines).score, 0);
});

test('R-03 không mang quá carry_capacity', () => {
  const motes = Array.from({ length: T.carry_capacity + 2 }, () => [0, 0, 0]);
  const r = runHeadless({ ticks: 10, every: 10, scenario: cleanScenario({ motes }) });
  const s = snaps(r.lines)[1];
  assert.equal(s.player.carried, T.carry_capacity);
  assert.equal(s.motes_active, 2);
});

test('R-04 nạp đèn: deposit từng phần rồi lantern_lit khi đủ lantern_cost', () => {
  const r = runHeadless({
    ticks: 10,
    scenario: cleanScenario({ player: { pos: [0, 0, 0], carried: T.lantern_cost + 3 }, lanterns: [{ ...L1, deposited: T.lantern_cost - 2 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(events(r.lines, 'deposit')[0].data, { lantern_id: 'L1', amount: 2, deposited: T.lantern_cost });
  assert.equal(events(r.lines, 'lantern_lit')[0].data.lantern_id, 'L1');
  // TICKET-02: +per_mote cho mỗi đom đóm nạp
  assert.equal(end(r.lines).score, 2 * T.score.per_mote + T.score.per_lantern);
});

test('R-04 interact chỉ kích hoạt khi false→true; ngoài interact_radius thì không nạp', () => {
  const held = runHeadless({
    ticks: 30,
    scenario: cleanScenario({ player: { pos: [0, 0, 0], carried: 2 }, lanterns: [L1] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(held.lines, 'deposit').length, 1);
  const far = runHeadless({
    ticks: 5,
    scenario: cleanScenario({ player: { pos: [T.interact_radius + 0.1, 0, 0], carried: 2 }, lanterns: [L1] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(far.lines, 'deposit').length, 0);
});

test('R-05 tỏa sáng: tốn pulse_cost, làm choáng + đẩy Bóng Mực trong pulse_radius', () => {
  // TICKET-02: đẩy lùi chia đều trong 15 tick đầu (trước đây đẩy tức thời)
  const r = runHeadless({
    ticks: 15, every: 15,
    scenario: cleanScenario({ player: { pos: [0, 0, 0], carried: T.pulse_cost }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [T.pulse_radius + 3, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(events(r.lines, 'pulse')[0].data, { stunned_ids: ['S1'] });
  const s = snaps(r.lines)[1];
  assert.equal(s.player.carried, 0);
  assert.equal(s.shades[0].state, 'stunned');
  assert.equal(s.shades[0].pos[0], 3 + T.pulse_push_m);
  assert.equal(s.shades[1].state, 'chase');
  assert.equal(end(r.lines).score, T.score.per_stun);
});

test('R-05 không đủ ánh sáng thì không tỏa sáng; có cooldown', () => {
  const poor = runHeadless({ ticks: 3, scenario: cleanScenario({ player: { carried: T.pulse_cost - 1 } }), inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(events(poor.lines, 'pulse').length, 0);
  const CD = Math.round(T.pulse_cooldown_s * 60);
  const cd = runHeadless({
    ticks: CD + 10,
    scenario: cleanScenario({ player: { carried: 10 } }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 10, pulse: true }, { tick: 11, pulse: false }, { tick: CD, pulse: true }] },
  });
  assert.deepEqual(events(cd.lines, 'pulse').map((e) => e.tick), [1, CD + 1]);
});

test('R-05 hết choáng sau pulse_stun_s thì đuổi tiếp', () => {
  const n = Math.round(T.pulse_stun_s * 60);
  const r = runHeadless({
    ticks: n + 1, every: 1,
    scenario: cleanScenario({ player: { carried: T.pulse_cost }, shades: [{ id: 'S1', pos: [3, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  const ss = snaps(r.lines);
  assert.equal(ss[n].shades[0].state, 'stunned');
  assert.equal(ss[n + 1].shades[0].state, 'chase');
});

test('R-06 Bóng Mực chạm → mất lửa, rơi đom đóm theo hit_drop_ratio, bất tử invuln_s', () => {
  const r = runHeadless({
    ticks: 200,
    scenario: cleanScenario({ player: { carried: 5, flames: 3 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }),
  });
  const hits = events(r.lines, 'player_hit');
  assert.equal(hits[0].tick, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: Math.floor(5 * T.hit_drop_ratio) });
  assert.equal(hits[1].tick - hits[0].tick, Math.round(T.invuln_s * 60));
});

test('R-07 thua khi hết lửa (no_flames), mô phỏng dừng sớm', () => {
  const r = runHeadless({ ticks: 500, scenario: cleanScenario({ player: { flames: 1 }, shades: [{ pos: [0, 1, 0] }] }) });
  assert.deepEqual(events(r.lines, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.deepEqual(end(r.lines), { type: 'end', ticks: 1, state: 'lost', score: 0 });
});

test('R-07 thua khi trời sáng (dawn)', () => {
  const r = runHeadless({ ticks: 500, scenario: cleanScenario({ time_left_s: 1 }) });
  const go = events(r.lines, 'game_over')[0];
  assert.equal(go.tick, 60);
  assert.deepEqual(go.data, { result: 'lost', reason: 'dawn' });
  assert.equal(end(r.lines).ticks, 60);
});

test('R-07 thắng khi thắp đủ 5 đèn (all_lit) + điểm thưởng thời gian/lửa', () => {
  const lit = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true, deposited: T.lantern_cost }));
  const r = runHeadless({
    ticks: 10,
    scenario: cleanScenario({ player: { pos: [0, 0, 0], carried: 1, flames: 3 }, time_left_s: 100, lanterns: [...lit, { id: 'L5', pos: [0, 0, 1], deposited: T.lantern_cost - 1 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(events(r.lines, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  const timeLeft = Math.floor(100 - 1 / 60);
  assert.deepEqual(end(r.lines), {
    type: 'end', ticks: 1, state: 'won',
    score: T.score.per_mote + T.score.per_lantern + T.score.per_second_left * timeLeft + T.score.per_flame_left * 3,
  });
});

test('R-08 Bóng Mực không vào safe_radius của đèn đã thắp', () => {
  const r = runHeadless({
    ticks: 600, every: 10,
    scenario: cleanScenario({ player: { pos: [0, 0, 0] }, lanterns: [{ ...L1, lit: true, deposited: T.lantern_cost }], shades: [{ id: 'S1', pos: [10, 1, 0] }] }),
  });
  assert.equal(events(r.lines, 'player_hit').length, 0);
  for (const s of snaps(r.lines)) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= T.safe_radius - 1e-3);
});

test('R-09 dựng scenario không phát sự kiện, không cộng điểm', () => {
  const r = runHeadless({ ticks: 0, scenario: cleanScenario({ lanterns: [{ ...L1, lit: true }] }) });
  assert.equal(events(r.lines).length, 0);
  assert.deepEqual(end(r.lines), { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('R-10 tính tất định: cùng seed → output giống hệt; khác seed → khác', () => {
  const a = runHeadless({ seed: 42, ticks: 3000 });
  const b = runHeadless({ seed: 42, ticks: 3000 });
  const c = runHeadless({ seed: 43, ticks: 3000 });
  assert.equal(a.code, 0);
  assert.equal(a.raw, b.raw);
  assert.notEqual(a.raw, c.raw);
  // TICKET-02: lịch sinh chuẩn — 2 con ở tick 300, rồi mỗi 480 tick (Đêm 1)
  const sp = runHeadless({ seed: 7, ticks: 780, scenario: { shades: [] } });
  assert.deepEqual(events(sp.lines, 'shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3']]);
});

test('R-11 inputs/scenario sai định dạng → mã thoát 2, lỗi ra stderr', () => {
  const bad = [
    { inputs: '{not json' },
    { inputs: { frames: [{ tick: 5 }, { tick: 5 }] } },
    { inputs: { frames: [{ tick: 0, move: [2, 0] }] } },
    { inputs: { frames: [{ tick: 0, jump: 'yes' }] } },
    { scenario: { player: { pos: [0, 0] } } },
    { scenario: '[]' },
  ];
  for (const b of bad) {
    const r = runHeadless({ ticks: 10, ...b });
    assert.equal(r.code, 2, JSON.stringify(b));
    assert.ok(r.stderr.length > 0);
  }
  assert.notEqual(runHeadless({ ticks: 10, extra: ['--night', '9'] }).code, 0);
});

test('R-12 tọa độ làm tròn 3 chữ số thập phân', () => {
  const r = runHeadless({ ticks: 7, every: 7, scenario: cleanScenario(), inputs: { frames: [{ tick: 0, move: [0.333, 0.777] }] } });
  for (const v of snaps(r.lines)[1].player.pos) assert.equal(v, Math.round(v * 1000) / 1000);
});
