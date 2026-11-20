// Test Phase 2 (Ticket-02, Test Contract v1.1) — mã P2-xx trong docs/proof/phase-2/README.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHeadless, events, snaps, end, cleanScenario, TUNING as T, ROOT } from './helpers.js';

const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

test('P2-01 contract v1.1: tuning khớp số chuẩn Ticket-02', () => {
  const c = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
  // TICKET-03: contract nâng lên 1.2 (tương thích ngược các khóa v1.1)
  assert.ok(['1.1', '1.2'].includes(c.contract_version));
  const want = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, pickup_radius: 1, interact_radius: 2, pulse_cost: 3, pulse_radius: 5,
    pulse_cooldown_s: 3, pulse_push_m: 4, pulse_stun_s: 2, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, flames: 3,
    invuln_s: 1.5, hit_drop_ratio: 0.5, // TICKET-03 [THAY THẾ]: thời lượng đêm & điểm đổi → kiểm ở P3-01
    dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, fall_enabled: true, lantern_count_night1: 5,
  };
  for (const [k, v] of Object.entries(want)) assert.equal(c.tuning[k], v, k);

});

test('P2-02 --night 1|2|3: snapshot có night, wind, player mở rộng, mảng motes/drifters/charms; night_start', () => {
  // TICKET-03: thời lượng đêm đọc từ tuning (240/270/300)
  for (const [n, lanterns, dur] of [[1, 5, T.night1_duration_s], [2, 6, T.night2_duration_s], [3, 7, T.night3_duration_s]]) {
    const r = runHeadless({ night: n, ticks: 10 });
    assert.equal(r.code, 0);
    const s = r.lines[0];
    assert.equal(s.night, n);
    assert.equal(s.time_left_s, dur);
    assert.equal(s.lanterns.length, lanterns);
    assert.deepEqual(Object.keys(s.wind).sort(), ['active', 'dir_deg']);
    for (const k of ['pos', 'vel', 'grounded', 'flames', 'carried', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, k);
    assert.ok(Array.isArray(s.drifters) && Array.isArray(s.charms));
    assert.equal(s.motes.length, 20, '20 đom đóm lúc bắt đầu');
    assert.equal(new Set(s.motes.map((m) => m.pos.join())).size, 20, 'tại 20 điểm khác nhau');
    assert.ok(s.motes.every((m) => m.kind === 'random' && m.ttl_s === null));
    assert.deepEqual(events(r.lines, 'night_start')[0].data, { night: n });
  }
  const n2 = runHeadless({ night: 2, ticks: 1 }).lines[0];
  assert.deepEqual(n2.lanterns.map((l) => l.pos), [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]);
  assert.deepEqual(n2.charms, [{ id: 'C1', available: true, respawn_s: 0 }]);
  assert.equal(runHeadless({ night: 3, ticks: 1 }).lines[0].charms.length, 2);
});

test('P2-03 Lướt: 14 m/s trong 0.2 s, hồi chiêu 1.5 s tính từ lúc bắt đầu, event dash', () => {
  const r = runHeadless({ ticks: 40, every: 1, scenario: cleanScenario(), inputs: { frames: [{ tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }, { tick: 20, dash: true }] } });
  const ss = snaps(r.lines);
  assert.equal(events(r.lines, 'dash').length, 1, 'nhấn lại khi đang hồi chiêu bị bỏ qua');
  assert.ok(near(ss[12].player.pos[2], 14 * 0.2));
  assert.ok(near(ss[24].player.pos[2], 2.8 + 12 * 0.1));
  assert.ok(near(ss[12].player.dash_cd_s, 1.5 - 12 / 60));
  // đứng yên thì lướt theo hướng đang quay mặt (+Z lúc xuất phát)
  const still = runHeadless({ ticks: 12, every: 12, scenario: cleanScenario(), inputs: { frames: [{ tick: 0, dash: true }] } });
  assert.ok(near(snaps(still.lines)[1].player.pos[2], 2.8));
});

test('P2-04 Nhảy 7 m/s, trọng lực 20: đỉnh ≈ 1.225 m, chỉ nhảy khi chạm đất', () => {
  const r = runHeadless({ ticks: 60, every: 1, scenario: cleanScenario(), inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, jump: true }] } });
  const ys = snaps(r.lines).map((s) => s.player.pos[1]);
  assert.ok(near(Math.max(...ys), 49 / 40, 0.07));
  assert.equal(snaps(r.lines)[5].player.grounded, false);
  assert.equal(snaps(r.lines)[60].player.grounded, true);
  assert.ok(ys.filter((y, i) => i > 0 && y === 0 && ys[i - 1] > 0).length === 1, 'chỉ một lần nhảy');
});

test('P2-05 Nhặt: XZ ≤ 1.0 và chênh cao ≤ 1.5', () => {
  const r = runHeadless({ ticks: 3, scenario: cleanScenario({ motes: [[0, 1.4, 0.5], [0.3, 1.6, 0]] }) });
  assert.equal(events(r.lines, 'mote_picked').length, 1);
});

test('P2-06 Rơi khỏi đảo: -1 lửa, mất hết đom đóm (lost), chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90 tick', () => {
  const r = runHeadless({ ticks: 200, every: 1, scenario: cleanScenario({ player: { pos: [39.5, 0, 0], carried: 4 } }), inputs: { frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 0 }] } });
  const hit = events(r.lines, 'player_hit');
  assert.equal(hit.length, 1, 'đúng 1 lần');
  assert.equal(hit[0].data.by, 'fall');
  assert.equal(hit[0].data.lost, 4);
  assert.equal(hit[0].data.flames, 2);
  const t = hit[0].tick;
  const back = snaps(r.lines)[t + 60];
  assert.deepEqual(back.player.pos, [0, 0, 0]);
  assert.deepEqual(back.player.vel, [0, 0, 0]);
  assert.equal(back.player.carried, 0);
  assert.equal(back.player.invuln, 1.5);
});

test('P2-07 Rơi khi còn 1 lửa → thua no_flames ngay', () => {
  const r = runHeadless({ ticks: 300, scenario: cleanScenario({ player: { pos: [39.9, 0, 0], flames: 1 } }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.deepEqual(events(r.lines, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
});

test('P2-08 Lịch sinh Bóng Mực Đêm 1: 2 con ở tick 300 (trạng thái spawning), mỗi 480 tick, tối đa 6, cách người chơi ≥ 15 m', () => {
  const r = runHeadless({ ticks: 300 + 480 * 6, every: 300 + 480 * 6, scenario: { random_drifters: false } });
  const sp = events(r.lines, 'shade_spawned');
  assert.deepEqual(sp.slice(0, 3).map((e) => e.tick), [300, 300, 780]);
  assert.deepEqual(sp.map((e) => e.data.id).slice(0, 6), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  assert.ok(sp.length <= 6);
  const at300 = runHeadless({ ticks: 300, every: 300, scenario: { random_drifters: false } });
  const s = snaps(at300.lines)[1];
  assert.ok(s.shades.every((x) => x.state === 'spawning'));
  assert.ok(s.shades.every((x) => Math.hypot(x.pos[0], x.pos[2]) > 36.9));
});

test('P2-09 Bóng Mực: wander khi xa, chase trong 12 m, recoil 2 m sau khi đánh trúng', () => {
  const r = runHeadless({ ticks: 61, every: 1, scenario: cleanScenario({ shades: [{ id: 'S1', pos: [20, 1, 0] }, { id: 'S2', pos: [0.5, 1, 0] }] }) });
  const ss = snaps(r.lines);
  assert.equal(ss[1].shades[0].state, 'wander');
  assert.equal(ss[1].shades[1].state, 'recoil');
  assert.deepEqual(events(r.lines, 'player_hit')[0].data, { by: 'shade', flames: 2, dropped: 0 });
  // recoil: lùi tổng 2 m trong 60 tick kế tiếp
  assert.ok(near(ss[61].shades[1].pos[0] - ss[1].shades[1].pos[0], 2, 0.02));
  const c = runHeadless({ ticks: 1, every: 1, scenario: cleanScenario({ shades: [{ id: 'S1', pos: [11, 1, 0] }] }) });
  assert.equal(snaps(c.lines)[1].shades[0].state, 'chase');
});

test('P2-10 Bị đánh: rơi floor(mang/2) đom đóm (kind dropped, ttl 8 s) quanh vành 1.5–2.5 m, nhặt lại được', () => {
  const r = runHeadless({ ticks: 1, every: 1, scenario: cleanScenario({ player: { carried: 7 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }) });
  const s = snaps(r.lines)[1];
  assert.equal(s.player.carried, 4);
  const d = s.motes.filter((m) => m.kind === 'dropped');
  assert.equal(d.length, 3);
  for (const m of d) { const rr = Math.hypot(m.pos[0], m.pos[2]); assert.ok(rr >= 1.499 && rr <= 2.501); assert.equal(m.ttl_s, 8); }
});

test('P2-11 Vùng an toàn 6 m: Bóng đang ở trong bị đẩy ra mép trong ≤ 30 tick, không gây sát thương', () => {
  const r = runHeadless({
    ticks: 31, every: 1,
    scenario: cleanScenario({ player: { pos: [0, 0, 0], carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: T.lantern_cost - 1 }], shades: [{ id: 'S1', pos: [0, 1, -3], state: 'stunned', state_ticks_left: 3 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(r.lines, 'lantern_lit').length, 1);
  assert.equal(events(r.lines, 'player_hit').length, 0);
  const last = snaps(r.lines)[31].shades[0];
  assert.ok(Math.hypot(last.pos[0], last.pos[2] - 1) >= 6 - 1e-3);
});

test('P2-12 Tỏa Sáng chuẩn: tốn 3, 3D ≤ 5 m từ chân+0.8, choáng 120 tick, +5 điểm/con (kể cả đang choáng)', () => {
  const r = runHeadless({
    ticks: 150, every: 1,
    scenario: cleanScenario({ player: { carried: 9 }, shades: [{ id: 'S1', pos: [4, 1, 0], state: 'stunned', state_ticks_left: 50 }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 100, pulse: true }] },
  });
  assert.deepEqual(events(r.lines, 'pulse').map((e) => [e.tick, e.data.stunned_ids]), [[1, ['S1']]], 'lần 2 ở tick 100 bị chặn bởi hồi chiêu 3 s');
  assert.ok(near(snaps(r.lines)[15].shades[0].pos[0], 8), 'đẩy lùi 4 m trong 15 tick');
  assert.equal(snaps(r.lines)[1].player.carried, 6);
  assert.equal(snaps(r.lines)[120].shades[0].state, 'stunned');
  assert.equal(end(r.lines).score, 5);
});

test('P2-13 Gió Lạc: chase khi mang ≥5 và ≤15 m, cướp min(3, mang), flee 240 tick rồi biến mất', () => {
  const r = runHeadless({
    night: 2, ticks: 320, every: 1,
    scenario: cleanScenario({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [5, 1.5, 0] }] }),
  });
  const ss = snaps(r.lines);
  assert.equal(ss[1].drifters[0].state, 'chase');
  const st = events(r.lines, 'drifter_steal');
  assert.equal(st.length, 1);
  assert.deepEqual(st[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
  const t = st[0].tick;
  assert.equal(ss[t].drifters[0].state, 'flee');
  assert.equal(ss[t].drifters[0].stolen, 3);
  assert.equal(ss[t + 240].drifters.length, 0);
  assert.equal(events(r.lines, 'player_hit').length, 0, 'không làm mất lửa');
  const idle = runHeadless({ night: 2, ticks: 5, every: 5, scenario: cleanScenario({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [5, 1.5, 0] }] }) });
  assert.equal(snaps(idle.lines)[1].drifters[0].state, 'idle');
});

test('P2-14 Tỏa Sáng trúng Gió Lạc: chase → flee không cướp; flee có đồ → thả lại thành đom đóm rơi', () => {
  const a = runHeadless({ night: 2, ticks: 2, every: 1, scenario: cleanScenario({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }] }), inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(snaps(a.lines)[1].drifters[0].state, 'flee');
  assert.equal(events(a.lines, 'drifter_steal').length, 0);
  const b = runHeadless({ night: 2, ticks: 2, every: 1, scenario: cleanScenario({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] }), inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.deepEqual(events(b.lines, 'drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(snaps(b.lines)[1].motes.filter((m) => m.kind === 'dropped').length, 3);
});

test('P2-15 Bùa Gió: nhặt như đom đóm, 600 tick tốc độ 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick', () => {
  const r = runHeadless({
    night: 2, ticks: 61, every: 1,
    scenario: cleanScenario({ player: { pos: [34.5, 0, 0] } }),
    inputs: { frames: [{ tick: 1, move: [0, 1] }] },
  });
  assert.deepEqual(events(r.lines, 'charm_picked')[0].data, { charm_id: 'C1', charm_ticks: 600 });
  const ss = snaps(r.lines);
  assert.ok(near(ss[61].player.pos[2] - ss[1].player.pos[2], 7.2));
  assert.deepEqual(ss[1].charms[0], { id: 'C1', available: false, respawn_s: 45 });
  const d = runHeadless({
    ticks: 30, scenario: cleanScenario({ player: { charm_ticks: 600 } }),
    inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 14, dash: true }] },
  });
  assert.deepEqual(events(d.lines, 'dash').map((e) => e.tick), [1, 15], 'nhấn khi đang lướt bị bỏ qua, sau đó lướt ngay không chờ hồi chiêu');
});

test('P2-16 Tạm dừng: tick tăng, sim_tick/thời gian/hồi chiêu đứng yên, state paused, paused/resumed', () => {
  const r = runHeadless({
    ticks: 40, every: 1, scenario: cleanScenario({ player: { pulse_cd_ticks: 100 } }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 30, pause: true }] },
  });
  const ss = snaps(r.lines);
  assert.deepEqual(events(r.lines).filter((e) => e.name === 'paused' || e.name === 'resumed').map((e) => [e.tick, e.name]), [[11, 'paused'], [31, 'resumed']]);
  assert.equal(ss[20].state, 'paused');
  assert.equal(ss[20].sim_tick, 10);
  assert.equal(ss[20].tick, 20);
  assert.deepEqual(ss[20].player.pos, ss[11].player.pos);
  assert.equal(ss[20].player.pulse_cd_s, ss[11].player.pulse_cd_s);
  assert.equal(ss[40].state, 'playing');
  assert.equal(ss[40].sim_tick, 20);
});

test('P2-17 Đêm 2 bục nhảy: bắn 24 m/s về đảo kia, đáp trong đảo đích sau ≈1.4 s, không rơi', () => {
  const r = runHeadless({ night: 2, ticks: 120, every: 1, scenario: cleanScenario({ player: { pos: [20, 0, 18] } }) });
  const ss = snaps(r.lines);
  assert.ok(ss[1].player.vel[1] > 13);
  const land = ss.findIndex((s, i) => i > 2 && s.player.grounded);
  assert.ok(land >= 80 && land <= 90, `đáp ở tick ${land}`);
  assert.ok(Math.hypot(ss[land].player.pos[0] - 70, ss[land].player.pos[2]) < 28);
  assert.equal(events(r.lines, 'player_hit').length, 0);
});

test('P2-18 Đêm 2: đi qua cầu tre an toàn, bước ra khỏi cầu thì rơi', () => {
  const ok = runHeadless({ night: 2, ticks: 240, every: 240, scenario: cleanScenario({ player: { pos: [24, 0, 0] } }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.equal(events(ok.lines, 'player_hit').length, 0);
  assert.ok(snaps(ok.lines)[1].player.pos[0] > 44);
  const off = runHeadless({ night: 2, ticks: 120, scenario: cleanScenario({ player: { pos: [35, 0, 0] } }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(events(off.lines, 'player_hit')[0].data.by, 'fall');
});

test('P2-19 Đêm 3: vách tầng không đi lên được; dốc 30° đưa lên tầng 1 (Y=3); bục (0,3,13) đáp tầng 2', () => {
  const wall = runHeadless({ night: 3, ticks: 120, every: 120, scenario: cleanScenario({ player: { pos: [0, 0, 9] } }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const pw = snaps(wall.lines)[1].player.pos;
  assert.ok(pw[2] <= 12 && pw[1] === 0, `bị vách chặn: ${pw}`);
  const a = Math.PI / 6;
  const ramp = runHeadless({ night: 3, ticks: 150, every: 150, scenario: cleanScenario({ player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: -120 }] } });
  const pr = snaps(ramp.lines)[1].player;
  assert.equal(pr.pos[1], 3, `lên tầng 1: ${JSON.stringify(pr.pos)}`);
  const pad = runHeadless({ night: 3, ticks: 120, every: 1, scenario: cleanScenario({ player: { pos: [0, 3, 13] } }) });
  const landed = snaps(pad.lines).find((s, i) => i > 5 && s.player.grounded);
  assert.equal(landed.player.pos[1], 6);
});

test('P2-20 Đêm 3 gió mạnh: mỗi 30 s một cơn 5 s, đẩy người chơi 2 m/s', () => {
  const r = runHeadless({ night: 3, ticks: 2100, every: 1, scenario: { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [] } });
  const ss = snaps(r.lines);
  assert.equal(ss[1799].wind.active, false);
  assert.equal(ss[1800].wind.active, true);
  assert.equal(ss[2099].wind.active, true);
  assert.equal(ss[2100].wind.active, false);
  const p0 = ss[1799].player.pos, p1 = ss[2099].player.pos;
  assert.ok(near(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), 2 * 300 / 60, 0.1));
});

test('P2-21 Nạp đèn: chọn đèn chưa sáng gần nhất, bằng nhau thì id nhỏ hơn; điểm theo per_mote mỗi đom đóm nạp', () => {
  const r = runHeadless({
    ticks: 2,
    scenario: cleanScenario({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [{ id: 'L1', pos: [1, 0, 0] }, { id: 'L2', pos: [-1, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(events(r.lines, 'deposit')[0].data, { lantern_id: 'L1', amount: 4, deposited: 4 });
  assert.equal(end(r.lines).score, 4 * T.score.per_mote); // TICKET-03: +5/đom đóm nạp (trước +10)
});

test('P2-22 Hiệu năng: một Đêm đầy đủ 21600 tick < 30 s', () => {
  const t0 = Date.now();
  const r = runHeadless({ night: 3, ticks: 21600, every: 600, scenario: { random_shades: false, shades: [] } });
  const ms = Date.now() - t0;
  assert.equal(r.code, 0);
  assert.ok(ms < 30000, `${ms} ms`);
});

test('P2-23 Tính tất định cả 3 đêm', () => {
  for (const n of [1, 2, 3]) {
    const a = runHeadless({ seed: 9, night: n, ticks: 4000 });
    const b = runHeadless({ seed: 9, night: n, ticks: 4000 });
    assert.equal(a.raw, b.raw, `night ${n}`);
  }
});
