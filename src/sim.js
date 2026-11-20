// Đảo Đèn Lồng — logic game thuần (không phụ thuộc đồ họa).
// Dùng chung cho game 3D (trình duyệt) và chế độ headless (Node).
// Mọi con số gameplay lấy từ game.contract.json → tuning (một nguồn sự thật).

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 30; // đảo tròn bán kính 30 m, tâm (0,0,0)
const GRAVITY = 20;
const JUMP_SPEED = 7;
const SHADE_Y = 1.0;
const MOTE_START = 35;      // số đom đóm ban đầu khi random_motes
const MOTE_MIN_ACTIVE = 20; // dưới mức này thì sinh thêm
const MOTE_RESPAWN_TICKS = 180;
const SHADE_START = 2;
const SHADE_MAX = 5;
const SHADE_SPAWN_TICKS = 2400; // 40 s

export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}
const r3 = (p) => p.map(round3);

// PRNG tất định (mulberry32)
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function randomPointInDisk(rng, rMax) {
  const ang = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * rMax;
  return [Math.sin(ang) * r, 0, Math.cos(ang) * r];
}

export function defaultLanterns(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push({ id: `L${i + 1}`, pos: [round3(Math.sin(a) * 20), 0, round3(Math.cos(a) * 20)], lit: false, deposited: 0 });
  }
  return out;
}

export function createGame({ tuning, seed = 0, scenario = null }) {
  const T = tuning;
  const rng = makeRng(seed);
  const g = {
    T, rng,
    tick: 0, simTick: 0,
    state: 'playing',
    score: 0,
    timeStart: T.night1_duration_s,
    player: { pos: [0, 0, 0], vy: 0, carried: 0, flames: T.flames, invulnTicks: 0, pulseCdTicks: 0 },
    lanterns: defaultLanterns(T.lantern_count_night1),
    shades: [],
    motes: [],
    nextMoteId: 1,
    nextShadeId: 1,
    randomMotes: true,
    randomShades: true,
    prevButtons: { jump: false, interact: false, pulse: false },
  };

  // Trạng thái mặc định (sinh ngẫu nhiên theo seed)
  for (let i = 0; i < MOTE_START; i++) spawnMote(g);
  for (let i = 0; i < SHADE_START; i++) spawnShade(g);

  if (scenario) applyScenario(g, scenario);
  return g;
}

function spawnMote(g, pos) {
  const p = pos || randomPointInDisk(g.rng, ISLAND_RADIUS - 2);
  const m = { id: `M${g.nextMoteId++}`, pos: [p[0], p[1] || 0, p[2]] };
  g.motes.push(m);
  return m;
}

function spawnShade(g, pos, id) {
  let p = pos;
  if (!p) {
    // sinh ở rìa đảo, tránh vùng an toàn của đèn đã thắp
    for (let tries = 0; tries < 20; tries++) {
      const a = g.rng() * Math.PI * 2;
      p = [Math.sin(a) * (ISLAND_RADIUS - 3), SHADE_Y, Math.cos(a) * (ISLAND_RADIUS - 3)];
      if (!g.lanterns.some((l) => l.lit && distXZ(l.pos, p) <= g.T.safe_radius)) break;
    }
  }
  const s = { id: id || `S${g.nextShadeId++}`, pos: [p[0], p[1] ?? SHADE_Y, p[2]], state: 'chase', stunTicks: 0 };
  g.shades.push(s);
  return s;
}

function applyScenario(g, sc) {
  if (sc.random_motes !== undefined) g.randomMotes = !!sc.random_motes;
  if (sc.random_shades !== undefined) g.randomShades = !!sc.random_shades;
  if (sc.player) {
    if (sc.player.pos) g.player.pos = [...sc.player.pos];
    if (sc.player.carried !== undefined) g.player.carried = sc.player.carried;
    if (sc.player.flames !== undefined) g.player.flames = sc.player.flames;
  }
  if (sc.time_left_s !== undefined) g.timeStart = sc.time_left_s;
  if (sc.motes) {
    g.motes = [];
    g.nextMoteId = 1;
    for (const m of sc.motes) spawnMote(g, m);
  }
  if (sc.shades) {
    g.shades = [];
    g.nextShadeId = 1;
    sc.shades.forEach((s) => spawnShade(g, s.pos, s.id));
    // id tự sinh tiếp theo không trùng id có sẵn
    let maxN = 0;
    for (const s of g.shades) { const n = /^S(\d+)$/.exec(s.id); if (n) maxN = Math.max(maxN, +n[1]); }
    g.nextShadeId = Math.max(g.shades.length, maxN) + 1;
  }
  if (sc.lanterns) {
    for (const ls of sc.lanterns) {
      const l = g.lanterns.find((x) => x.id === ls.id);
      if (!l) continue;
      if (ls.pos) l.pos = [...ls.pos];
      if (ls.lit !== undefined) l.lit = !!ls.lit;
      if (ls.deposited !== undefined) l.deposited = ls.deposited;
    }
  }
  // Nếu scenario đặt đèn thắp sẵn, đẩy Bóng Mực ra khỏi vùng an toàn
  for (const s of g.shades) keepOutOfSafe(g, s);
}

export function timeLeft(g) {
  return Math.max(0, g.timeStart - g.simTick / TICK_RATE);
}

function keepOutOfSafe(g, s) {
  const R = g.T.safe_radius;
  for (const l of g.lanterns) {
    if (!l.lit) continue;
    const dx = s.pos[0] - l.pos[0], dz = s.pos[2] - l.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < R) {
      const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
      s.pos[0] = l.pos[0] + ux * R;
      s.pos[2] = l.pos[2] + uz * R;
    }
  }
}

function clampIsland(p) {
  const d = Math.hypot(p[0], p[2]);
  if (d > ISLAND_RADIUS) { p[0] *= ISLAND_RADIUS / d; p[2] *= ISLAND_RADIUS / d; }
}

/**
 * Tiến một bước (tick k → k+1). input: {move:[x,z], cam_yaw_deg, jump, interact, pulse}
 * Trả về danh sách sự kiện (tick = k+1).
 */
export function step(g, input) {
  if (g.state !== 'playing') return [];
  const T = g.T, P = g.player, events = [];
  const tickOut = g.tick + 1;
  const ev = (name, data) => events.push({ type: 'event', tick: tickOut, name, data });

  const edge = (k) => { const v = !!input[k]; const e = v && !g.prevButtons[k]; g.prevButtons[k] = v; return e; };
  const jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse');

  if (P.invulnTicks > 0) P.invulnTicks--;
  if (P.pulseCdTicks > 0) P.pulseCdTicks--;
  for (const s of g.shades) {
    if (s.state === 'stunned' && --s.stunTicks <= 0) s.state = 'chase';
  }

  // 1. Di chuyển theo hướng camera
  let [mx, mz] = input.move || [0, 0];
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  let wx = mx * Math.cos(th) + mz * Math.sin(th);
  let wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const len = Math.hypot(wx, wz);
  if (len > 1) { wx /= len; wz /= len; }
  P.pos[0] += wx * T.player_speed * DT;
  P.pos[2] += wz * T.player_speed * DT;
  clampIsland(P.pos);

  // 2. Nhảy (chỉ ảnh hưởng trục Y; khoảng cách gameplay đo trên XZ)
  if (jumpE && P.pos[1] <= 0) P.vy = JUMP_SPEED;
  if (P.pos[1] > 0 || P.vy > 0) {
    P.vy -= GRAVITY * DT;
    P.pos[1] += P.vy * DT;
    if (P.pos[1] <= 0) { P.pos[1] = 0; P.vy = 0; }
  }

  // 3. Nhặt đom đóm
  for (let i = 0; i < g.motes.length && P.carried < T.carry_capacity; ) {
    if (distXZ(g.motes[i].pos, P.pos) <= T.pickup_radius) {
      g.motes.splice(i, 1);
      P.carried++;
      g.score += T.score.per_mote;
      ev('mote_picked', { carried: P.carried });
    } else i++;
  }

  // 4. Nạp ánh sáng vào đèn gần nhất chưa thắp
  if (interactE && P.carried > 0) {
    let best = null, bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = distXZ(l.pos, P.pos);
      if (d <= T.interact_radius && d < bd) { best = l; bd = d; }
    }
    if (best) {
      const amount = Math.min(P.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        P.carried -= amount;
        best.deposited += amount;
        ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          g.score += T.score.per_lantern;
          ev('lantern_lit', { lantern_id: best.id });
          for (const s of g.shades) keepOutOfSafe(g, s);
        }
      }
    }
  }

  // 5. Tỏa sáng
  if (pulseE && P.pulseCdTicks <= 0 && P.carried >= T.pulse_cost) {
    P.carried -= T.pulse_cost;
    P.pulseCdTicks = Math.round(T.pulse_cooldown_s * TICK_RATE);
    const ids = [];
    for (const s of g.shades) {
      const d = distXZ(s.pos, P.pos);
      if (d <= T.pulse_radius) {
        s.state = 'stunned';
        s.stunTicks = Math.round(T.pulse_stun_s * TICK_RATE);
        const ux = d > 1e-9 ? (s.pos[0] - P.pos[0]) / d : 1;
        const uz = d > 1e-9 ? (s.pos[2] - P.pos[2]) / d : 0;
        s.pos[0] += ux * T.pulse_push_m;
        s.pos[2] += uz * T.pulse_push_m;
        clampIsland(s.pos);
        keepOutOfSafe(g, s);
        ids.push(s.id);
        g.score += T.score.per_stun;
      }
    }
    ev('pulse', { stunned_ids: ids });
  }

  // 6. Bóng Mực
  for (const s of g.shades) {
    if (s.state === 'stunned') continue;
    const dx = P.pos[0] - s.pos[0], dz = P.pos[2] - s.pos[2];
    const d = Math.hypot(dx, dz);
    const stepLen = Math.min(d, T.shade_speed * DT);
    if (d > 1e-9) { s.pos[0] += (dx / d) * stepLen; s.pos[2] += (dz / d) * stepLen; }
    keepOutOfSafe(g, s);
  }

  // 7. Va chạm
  if (P.invulnTicks <= 0) {
    for (const s of g.shades) {
      if (s.state === 'stunned') continue;
      if (distXZ(s.pos, P.pos) <= T.shade_hit_radius) {
        P.flames = Math.max(0, P.flames - 1);
        const dropped = Math.floor(P.carried * T.hit_drop_ratio);
        P.carried -= dropped;
        P.invulnTicks = Math.round(T.invuln_s * TICK_RATE);
        ev('player_hit', { by: 'shade', flames: P.flames, dropped });
        break;
      }
    }
  }

  // 8. Sinh thêm
  g.simTick++;
  g.tick++;
  if (g.randomMotes && g.simTick % MOTE_RESPAWN_TICKS === 0 && g.motes.length < MOTE_MIN_ACTIVE) spawnMote(g);
  if (g.randomShades && g.simTick % SHADE_SPAWN_TICKS === 0 && g.shades.length < SHADE_MAX) {
    const s = spawnShade(g);
    ev('shade_spawned', { id: s.id });
  }

  // 9. Kết thúc
  let result = null;
  if (g.lanterns.every((l) => l.lit)) result = ['won', 'all_lit'];
  else if (P.flames <= 0) result = ['lost', 'no_flames'];
  else if (timeLeft(g) <= 1e-9) result = ['lost', 'dawn'];
  if (result) {
    g.state = result[0];
    if (result[0] === 'won') {
      g.score += T.score.per_second_left * Math.floor(timeLeft(g) + 1e-9) + T.score.per_flame_left * P.flames;
    }
    ev('game_over', { result: result[0], reason: result[1] });
  }
  return events;
}

export function snapshot(g) {
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    state: g.state,
    time_left_s: round3(timeLeft(g)),
    score: g.score,
    player: { pos: r3(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: r3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: r3(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: r3(m.pos) })),
  };
}
