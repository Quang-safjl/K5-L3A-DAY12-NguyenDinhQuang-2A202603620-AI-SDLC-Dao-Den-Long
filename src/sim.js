// Đảo Đèn Lồng — logic game thuần, tất định (Test Contract v1.3; luật Ticket-03 "Đèn cạn dầu").
// TICKET-04: cờ g.bench (chỉ cảnh benchmark, mặc định false) tắt sinh thực thể, sát thương, nhặt, hao dầu,
// điều kiện kết thúc và việc Bóng phát hiện Mây. Khi bench=false mọi nhánh giữ nguyên → headless không đổi.
// Dầu đèn lưu bằng đơn vị nguyên 1/60 (fuelU) để không sai số; 100 dầu = 6000 fuelU.
// Dùng chung cho game 3D (trình duyệt) và headless (Node). Không dùng Math.random/Date/DOM.
import { NIGHTS } from './maps.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
const GRAVITY = 20;
const JUMP_SPEED = 7;
const AIR_ACCEL = 30;           // m/s² — điều khiển trên không không đầy đủ
const STEP_UP = 0.35;           // bậc cao nhất đi lên được (dốc), cao hơn là vách
const SNAP_DOWN = 0.35;
const PICK_DY = 1.5;            // chênh cao tối đa khi nhặt / chạm
const SHADE_Y = 1.0;            // tâm Bóng Mực cao hơn mặt đất 1 m
const PULSE_Y = 0.8;
const PULSE_STUN_TICKS = 120, PULSE_PUSH_TICKS = 15;
const SHADE_DETECT = 12, SHADE_LOSE = 18, SHADE_WANDER_SPEED = 1.5;
const SHADE_SPAWNING_TICKS = 60, SHADE_SPAWN_MIN_DIST = 15, SHADE_FIRST_TICK = 300;
const RECOIL_TICKS = 60, RECOIL_DIST = 2;
const SAFE_EXPEL_TICKS = 30;
const HIT_INVULN_TICKS = 90, DROP_TTL = 480, DROP_R_MIN = 1.5, DROP_R_MAX = 2.5;
const FALL_Y = -10, FALL_WAIT = 60;
const MOTE_START = 20, MOTE_CAP = 30, MOTE_EVERY = 240;
const DRIFTER_SPEED = 7, DRIFTER_IDLE_SPEED = 2, DRIFTER_MAX = 2, DRIFTER_EVERY = 1200;
const DRIFTER_CHASE_CARRY = 5, DRIFTER_CHASE_DIST = 15, DRIFTER_TOUCH = 1.2, DRIFTER_STEAL = 3;
const DRIFTER_FLEE_TICKS = 240, DRIFTER_DROP_REMOVE = 120;
const CHARM_TICKS = 600, CHARM_RESPAWN = 2700, CHARM_SPEED = 7.2;
const WIND_EVERY = 1800, WIND_LEN = 300, WIND_SPEED = 2;
const DRAIN_REACH = 2, DRAIN_BREAK_DIST = 6, DRAIN_EVENT_EVERY = 60;
const round1 = (v) => { const r = Math.round(v * 10) / 10; return Object.is(r, -0) ? 0 : r; };

export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}
const r3 = (p) => p.map(round3);
const sec = (ticks) => round3(Math.max(0, ticks) / TICK_RATE);

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

const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idNum = (id) => { const m = /(\d+)$/.exec(id); return m ? +m[1] : 0; };
const byId = (a, b) => idNum(a.id) - idNum(b.id);

export function defaultLanterns(night) {
  return NIGHTS[night].lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], lit: false, deposited: 0, fuelU: 0, everLit: false, relit: 0 }));
}

export function createGame({ tuning, seed = 0, night = 1, scenario = null }) {
  const map = NIGHTS[night];
  if (!map) throw new Error(`night ${night} không tồn tại`);
  const T = tuning;
  const g = {
    T, map, night, rng: makeRng(seed),
    tick: 0, simTick: 0, state: 'playing', paused: false, score: 0, successfulLights: 0, bench: false,
    timeStart: T[map.durationKey],
    player: {
      pos: [...map.start], vel: [0, 0, 0], grounded: true, facing: [0, 1],
      carried: 0, flames: T.flames,
      invulnTicks: 0, dashCdTicks: 0, pulseCdTicks: 0, charmTicks: 0,
      dashTicks: 0, dashDir: [0, 1], padVel: null, fallWait: 0,
    },
    lanterns: defaultLanterns(night),
    shades: [], motes: [], drifters: [],
    charms: map.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p], available: true, respawnTicks: 0 })),
    nextMote: 1, nextShade: 1, nextDrifter: 1,
    randomMotes: true, randomShades: true, randomDrifters: map.drifters, windEnabled: map.wind,
    wind: { active: false, dirDeg: 0 },
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
  };
  if (scenario) {
    if (scenario.random_motes !== undefined) g.randomMotes = !!scenario.random_motes;
  }
  if (g.randomMotes) for (let i = 0; i < MOTE_START; i++) spawnRandomMote(g);
  if (scenario) applyScenario(g, scenario);
  return g;
}

// ---------- Dầu đèn ----------
const FU = (T, v) => Math.round(v * TICK_RATE);           // dầu → đơn vị 1/60
export const fuelOf = (l) => l.fuelU / TICK_RATE;
export function capacity(g) { return Math.min(g.T.capacity_max, g.T.carry_capacity + 2 * g.successfulLights); }
function hasZone(g, l) { return l.lit && l.fuelU >= FU(g.T, g.T.low_fuel_threshold); }
function isWeak(g, l) { return l.lit && l.fuelU < FU(g.T, g.T.low_fuel_threshold); }
function nearestLantern(g, pos, pred) {
  let best = null, bd = Infinity;
  for (const l of g.lanterns) {
    if (!pred(l)) continue;
    const d = dXZ(l.pos, pos);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && idNum(l.id) < idNum(best.id))) { best = l; bd = d; }
  }
  return best;
}

// ---------- Đom đóm ----------
function groundAt(g, x, z) { return g.map.ground(x, z); }

function spawnRandomMote(g) {
  const used = new Set(g.motes.filter((m) => m.point !== null).map((m) => m.point));
  const free = g.map.motePoints.map((_, i) => i).filter((i) => !used.has(i));
  if (!free.length) return null;
  const i = free[Math.floor(g.rng() * free.length)];
  const m = { id: `M${g.nextMote++}`, pos: [...g.map.motePoints[i]], kind: 'random', ttl: null, point: i, bornTick: g.simTick };
  g.motes.push(m);
  return m;
}

function addMote(g, pos, kind = 'random', ttl = null) {
  const m = { id: `M${g.nextMote++}`, pos: [...pos], kind, ttl, point: null, bornTick: g.simTick };
  g.motes.push(m);
  return m;
}

function dropMotes(g, center, n) {
  for (let i = 0; i < n; i++) {
    const a = g.rng() * Math.PI * 2, r = DROP_R_MIN + g.rng() * (DROP_R_MAX - DROP_R_MIN);
    const x = center[0] + Math.cos(a) * r, z = center[2] + Math.sin(a) * r;
    const gy = groundAt(g, x, z);
    addMote(g, [x, gy ?? center[1], z], 'dropped', DROP_TTL);
  }
}

// ---------- Bóng Mực ----------
function makeShade(g, pos, id, state = null, ticks = 0) {
  const s = { id: id || `S${g.nextShade++}`, pos: [...pos], state: state || 'wander', ticks, push: 0, pushDir: [1, 0], expel: 0, waypoint: null, target: null, drainTicks: 0 };
  g.shades.push(s);
  return s;
}

function shadeSpeed(g) { return g.night === 3 ? g.map.shadeSpeed : g.T.shade_speed; }

function trySpawnShade(g) {
  if (g.shades.length >= g.map.shadeMax) return null;
  const P = g.player.pos;
  const ok = g.map.shadePoints.filter((p) => dXZ(p, P) >= SHADE_SPAWN_MIN_DIST && !inLitZone(g, p));
  if (!ok.length) return null;
  const p = ok[Math.floor(g.rng() * ok.length)];
  const y = (groundAt(g, p[0], p[2]) ?? 0) + SHADE_Y;
  return makeShade(g, [p[0], y, p[2]], null, 'spawning', SHADE_SPAWNING_TICKS);
}

function inLitZone(g, p) {
  return g.lanterns.some((l) => hasZone(g, l) && dXZ(l.pos, p) < g.T.safe_radius);
}

function blockBySafe(g, s) {
  const R = g.T.safe_radius;
  for (const l of g.lanterns) {
    if (!hasZone(g, l)) continue;
    const dx = s.pos[0] - l.pos[0], dz = s.pos[2] - l.pos[2], d = Math.hypot(dx, dz);
    if (d < R) {
      const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
      s.pos[0] = l.pos[0] + ux * R; s.pos[2] = l.pos[2] + uz * R;
    }
  }
}

function blockedForShade(g, x, z) {
  if (g.night === 3 && Math.hypot(x, z) < 2) return true; // tháp chuông
  return g.lanterns.some((l) => hasZone(g, l) && Math.hypot(x - l.pos[0], z - l.pos[2]) < g.T.safe_radius - 1e-9);
}

function moveShadeToward(g, s, tx, tz, speed) {
  const dx = tx - s.pos[0], dz = tz - s.pos[2], d = Math.hypot(dx, dz);
  if (d < 1e-9) return;
  const st = Math.min(d, speed * DT);
  s.pos[0] += (dx / d) * st; s.pos[2] += (dz / d) * st;
}

function settleShadeY(g, s) { s.pos[1] = (groundAt(g, s.pos[0], s.pos[2]) ?? 0) + SHADE_Y; }

function pickWaypoint(g) {
  const areas = g.map.wanderArea();
  const [cx, cz, r] = areas[Math.floor(g.rng() * areas.length)];
  const a = g.rng() * Math.PI * 2, rr = Math.sqrt(g.rng()) * r;
  return [cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr];
}

function playerTargetable(g) { return !g.bench && g.player.fallWait <= 0; } // bench: Bóng chỉ wander

// ---------- Scenario ----------
function applyScenario(g, sc) {
  const P = g.player;
  if (sc.random_shades !== undefined) g.randomShades = !!sc.random_shades;
  if (sc.random_drifters !== undefined) g.randomDrifters = !!sc.random_drifters;
  if (sc.wind_enabled !== undefined) g.windEnabled = !!sc.wind_enabled;
  if (sc.player) {
    const sp = sc.player;
    if (sp.pos) { P.pos = [...sp.pos]; const gy = groundAt(g, P.pos[0], P.pos[2]); P.grounded = gy !== null && Math.abs(P.pos[1] - gy) < 1e-6; }
    if (sp.carried !== undefined) P.carried = sp.carried;
    if (sp.flames !== undefined) P.flames = sp.flames;
    if (sp.invuln_ticks !== undefined) P.invulnTicks = sp.invuln_ticks;
    if (sp.dash_cd_ticks !== undefined) P.dashCdTicks = sp.dash_cd_ticks;
    if (sp.pulse_cd_ticks !== undefined) P.pulseCdTicks = sp.pulse_cd_ticks;
    if (sp.charm_ticks !== undefined) P.charmTicks = sp.charm_ticks;
    if (sp.successful_lights !== undefined) g.successfulLights = sp.successful_lights;
  }
  if (sc.time_left_s !== undefined) g.timeStart = sc.time_left_s;
  if (sc.motes) {
    g.motes = []; g.nextMote = 1;
    for (const m of sc.motes) {
      if (Array.isArray(m)) addMote(g, m);
      else addMote(g, m.pos, m.kind || 'random', m.kind === 'dropped' ? Math.round((m.ttl_s ?? DROP_TTL / 60) * 60) : null);
    }
  }
  if (sc.shades) {
    g.shades = []; g.nextShade = 1;
    for (const s of sc.shades) {
      const st = s.state || (dXZ(s.pos, P.pos) <= SHADE_DETECT ? 'chase' : 'wander');
      let ticks = s.state_ticks_left ?? 0;
      if (!s.state_ticks_left && st === 'stunned') ticks = PULSE_STUN_TICKS;
      if (!s.state_ticks_left && st === 'recoil') ticks = RECOIL_TICKS;
      if (!s.state_ticks_left && st === 'spawning') ticks = SHADE_SPAWNING_TICKS;
      const sh = makeShade(g, s.pos, s.id, st, ticks);
      if (s.target_lantern_id) sh.target = s.target_lantern_id;
    }
    g.nextShade = Math.max(g.shades.length, ...g.shades.map((s) => idNum(s.id)), 0) + 1;
  }
  if (sc.drifters) {
    g.drifters = []; g.nextDrifter = 1;
    for (const d of sc.drifters) {
      const st = d.state || 'idle';
      g.drifters.push({ id: d.id || `D${g.nextDrifter++}`, pos: [...d.pos], state: st, stolen: d.stolen || 0, stoleOnce: st === 'flee', ticks: st === 'flee' ? DRIFTER_FLEE_TICKS : 0, waypoint: null });
    }
    g.nextDrifter = Math.max(g.drifters.length, ...g.drifters.map((d) => idNum(d.id)), 0) + 1;
  }
  if (sc.charms) {
    g.charms = sc.charms.map((c, i) => ({ id: c.id || `C${i + 1}`, pos: [...(c.pos || g.map.charms[i] || [0, 0, 0])], available: c.available !== false, respawnTicks: c.available === false ? Math.round((c.respawn_s ?? CHARM_RESPAWN / 60) * 60) : 0 }));
  }
  if (sc.lanterns) {
    for (const ls of sc.lanterns) {
      const l = g.lanterns.find((x) => x.id === ls.id);
      if (!l) continue;
      if (ls.pos) l.pos = [...ls.pos];
      if (ls.lit !== undefined) l.lit = !!ls.lit;
      if (ls.deposited !== undefined) l.deposited = ls.deposited;
      if (l.lit) { l.fuelU = FU(g.T, ls.fuel ?? g.T.fuel_max); l.everLit = ls.ever_lit ?? true; }
      else { l.fuelU = 0; if (ls.ever_lit !== undefined) l.everLit = !!ls.ever_lit; }
    }
  }
}

export function timeLeft(g) { return Math.max(0, g.timeStart - g.simTick / TICK_RATE); }

// ---------- Di chuyển người chơi ----------
function moveHorizontal(g, nx, nz) {
  const P = g.player;
  const can = (x, z) => { const gy = groundAt(g, x, z); return gy === null || gy <= P.pos[1] + STEP_UP; };
  if (can(nx, nz)) { P.pos[0] = nx; P.pos[2] = nz; return; }
  if (can(nx, P.pos[2])) { P.pos[0] = nx; return; }
  if (can(P.pos[0], nz)) { P.pos[2] = nz; }
}

function movePlayer(g, input, dashEdge, jumpEdge, events) {
  const P = g.player, T = g.T;
  // hướng muốn đi theo camera
  let [mx, mz] = input.move || [0, 0];
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  let wx = mx * Math.cos(th) + mz * Math.sin(th);
  let wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const len = Math.hypot(wx, wz);
  if (len > 1) { wx /= len; wz /= len; }
  if (len > 1e-9) { const fl = Math.hypot(wx, wz); P.facing = [wx / fl, wz / fl]; }

  // Lướt
  const charm = P.charmTicks > 0;
  if (dashEdge && P.dashTicks <= 0 && (charm || P.dashCdTicks <= 0)) {
    const fl = Math.hypot(wx, wz);
    P.dashDir = fl > 1e-9 ? [wx / fl, wz / fl] : [...P.facing];
    P.dashTicks = Math.round(T.dash_duration_s * TICK_RATE);
    if (!charm) P.dashCdTicks = Math.round(T.dash_cooldown_s * TICK_RATE);
    events.push(['dash', {}]);
  }

  // Nhảy
  if (jumpEdge && P.grounded) { P.vel[1] = JUMP_SPEED; P.grounded = false; }

  const speed = charm ? CHARM_SPEED : T.player_speed;
  if (P.dashTicks > 0) {
    P.vel[0] = P.dashDir[0] * T.dash_speed; P.vel[2] = P.dashDir[1] * T.dash_speed;
    P.dashTicks--;
    if (P.dashTicks === 0 && P.padVel) { P.vel[0] = P.padVel[0]; P.vel[2] = P.padVel[1]; }
  } else if (P.padVel) {
    P.vel[0] = P.padVel[0]; P.vel[2] = P.padVel[1];
  } else if (P.grounded) {
    P.vel[0] = wx * speed; P.vel[2] = wz * speed; // tăng tốc/dừng tức thời (≤ 0.1 s)
  } else {
    const tx = wx * speed, tz = wz * speed, dvx = tx - P.vel[0], dvz = tz - P.vel[2], dv = Math.hypot(dvx, dvz);
    const maxDv = AIR_ACCEL * DT;
    if (dv > maxDv) { P.vel[0] += (dvx / dv) * maxDv; P.vel[2] += (dvz / dv) * maxDv; } else { P.vel[0] = tx; P.vel[2] = tz; }
  }

  let nx = P.pos[0] + P.vel[0] * DT, nz = P.pos[2] + P.vel[2] * DT;
  if (g.wind.active) {
    nx += Math.cos(g.wind.dirDeg * Math.PI / 180) * WIND_SPEED * DT;
    nz += Math.sin(g.wind.dirDeg * Math.PI / 180) * WIND_SPEED * DT;
  }
  moveHorizontal(g, nx, nz);

  // Trục đứng
  const floor = groundAt(g, P.pos[0], P.pos[2]);
  if (P.grounded) {
    if (floor !== null && P.pos[1] - floor <= SNAP_DOWN && P.pos[1] - floor >= -STEP_UP) { P.pos[1] = floor; P.vel[1] = 0; }
    else P.grounded = false;
  }
  if (!P.grounded) {
    P.vel[1] -= GRAVITY * DT;
    P.pos[1] += P.vel[1] * DT;
    if (floor !== null && P.pos[1] <= floor && P.vel[1] <= 0 && P.pos[1] > floor - 1.0) {
      P.pos[1] = floor; P.vel[1] = 0; P.grounded = true; P.padVel = null;
    }
  }
  if (P.grounded && !P.padVel) P.vel[1] = 0;

  // Bục nhảy
  if (P.grounded) {
    for (const pad of g.map.pads) {
      if (dXZ(pad.pos, P.pos) <= pad.r && Math.abs(P.pos[1] - pad.pos[1]) <= 0.1) {
        let dir = pad.dir;
        if (!dir) { const dx = pad.target[0] - P.pos[0], dz = pad.target[2] - P.pos[2], d = Math.hypot(dx, dz); dir = [dx / d, dz / d]; }
        P.padVel = [dir[0] * pad.h, dir[1] * pad.h];
        P.vel = [P.padVel[0], pad.vy, P.padVel[1]];
        P.grounded = false;
        break;
      }
    }
  }
}

// ---------- Một bước ----------
export function step(g, input) {
  if (g.state === 'won' || g.state === 'lost') return [];
  const T = g.T, P = g.player, out = [];
  const tickOut = g.tick + 1;
  const evs = [];
  const flush = () => { for (const [name, data] of evs) out.push({ type: 'event', tick: tickOut, name, data }); evs.length = 0; };
  const edge = (k) => { const v = !!input[k]; const e = v && !g.prev[k]; g.prev[k] = v; return e; };
  const pauseE = edge('pause'), jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse'), dashE = edge('dash');

  // 1. Tạm dừng
  if (pauseE) {
    g.paused = !g.paused;
    evs.push([g.paused ? 'paused' : 'resumed', {}]);
  }
  if (g.paused) { g.state = 'paused'; g.tick++; flush(); return out; }
  g.state = 'playing';

  // 2. Bộ đếm
  g.simTick++;
  if (P.invulnTicks > 0) P.invulnTicks--;
  if (P.dashCdTicks > 0) P.dashCdTicks--;
  if (P.pulseCdTicks > 0) P.pulseCdTicks--;
  if (P.charmTicks > 0) P.charmTicks--;
  for (const s of g.shades) if (s.ticks > 0) s.ticks--;
  g.motes = g.motes.filter((m) => { if (m.ttl === null) return true; m.ttl--; return m.ttl > 0; });
  for (const c of g.charms) if (!c.available && --c.respawnTicks <= 0) { c.available = true; c.respawnTicks = 0; }
  for (const d of g.drifters) if (d.ticks > 0) d.ticks--;
  g.drifters = g.drifters.filter((d) => !(d.state === 'flee' && d.ticks <= 0));
  if (g.windEnabled && g.simTick >= WIND_EVERY) {
    const ph = g.simTick % WIND_EVERY;
    if (ph === 0) { g.wind.dirDeg = Math.floor(g.rng() * 360); }
    g.wind.active = ph < WIND_LEN;
  } else g.wind.active = false;

  // 2b. Dầu: hao 1/s + bị hút 5/s mỗi Bóng đang drain; hết dầu thì tắt ngay
  for (const l of g.lanterns) {
    if (!l.lit || g.bench) continue; // bench: không hao dầu
    l.fuelU -= Math.round(T.fuel_decay_per_s);
    for (const s of [...g.shades].sort(byId)) {
      if (s.state !== 'drain' || s.target !== l.id) continue;
      l.fuelU -= Math.round(T.drain_per_s);
      s.drainTicks++;
      if (s.drainTicks % DRAIN_EVENT_EVERY === 0) evs.push(['fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: round1(Math.max(0, fuelOf(l))) }]);
    }
  }
  for (const l of g.lanterns) {
    if (l.lit && l.fuelU <= 0) { l.lit = false; l.fuelU = 0; l.deposited = 0; evs.push(['lantern_out', { lantern_id: l.id }]); }
  }

  const respawning = P.fallWait > 0;
  if (respawning) {
    P.fallWait--;
    if (P.fallWait === 0) {
      P.pos = [...g.map.start]; P.vel = [0, 0, 0]; P.grounded = true; P.padVel = null; P.dashTicks = 0;
      P.invulnTicks = HIT_INVULN_TICKS;
    }
  } else {
    // 3. Di chuyển + rơi khỏi đảo
    movePlayer(g, input, dashE, jumpE, evs);
    if (P.pos[1] < FALL_Y) {
      const lost = P.carried;
      P.flames = Math.max(0, P.flames - 1);
      P.carried = 0;
      P.fallWait = FALL_WAIT; P.vel = [0, 0, 0]; P.padVel = null; P.dashTicks = 0;
      evs.push(['player_hit', { by: 'fall', flames: P.flames, dropped: 0, lost }]);
    }
  }
  const active = P.fallWait <= 0;

  // 4. Nhặt đom đóm và bùa (bench: tắt)
  if (active && !g.bench) {
    for (let i = 0; i < g.motes.length && P.carried < capacity(g);) {
      const m = g.motes[i];
      if (m.bornTick < g.simTick && dXZ(m.pos, P.pos) <= T.pickup_radius && Math.abs(P.pos[1] - m.pos[1]) <= PICK_DY) {
        g.motes.splice(i, 1); P.carried++;
        evs.push(['mote_picked', { carried: P.carried }]);
      } else i++;
    }
    for (const c of g.charms) {
      if (c.available && dXZ(c.pos, P.pos) <= T.pickup_radius && Math.abs(P.pos[1] - c.pos[1]) <= PICK_DY) {
        c.available = false; c.respawnTicks = CHARM_RESPAWN; P.charmTicks = CHARM_TICKS;
        evs.push(['charm_picked', { charm_id: c.id, charm_ticks: CHARM_TICKS }]);
      }
    }
  }

  // 5. Tương tác với đèn: thắp (mới / lại) hoặc châm dầu
  if (active && interactE && P.carried > 0) {
    const refuelUse = (l) => Math.min(P.carried, Math.ceil((FU(T, T.fuel_max) - l.fuelU) / FU(T, T.fuel_per_mote)));
    const best = nearestLantern(g, P.pos, (l) => dXZ(l.pos, P.pos) <= T.interact_radius && (!l.lit || refuelUse(l) > 0));
    if (best && best.lit) {
      const used = refuelUse(best);
      P.carried -= used;
      best.fuelU = Math.min(FU(T, T.fuel_max), best.fuelU + used * FU(T, T.fuel_per_mote));
      g.score += used * T.score.per_mote;
      evs.push(['refuel', { lantern_id: best.id, amount: used, fuel: round1(fuelOf(best)) }]);
    } else if (best) {
      const cost = best.everLit ? T.relight_cost : T.lantern_cost;
      const amount = Math.min(P.carried, cost - best.deposited);
      if (amount > 0) {
        P.carried -= amount; best.deposited += amount;
        g.score += amount * T.score.per_mote;
        evs.push(['deposit', { lantern_id: best.id, amount, deposited: best.deposited }]);
        if (best.deposited >= cost) {
          const relight = best.everLit;
          best.lit = true; best.everLit = true; best.fuelU = FU(T, T.fuel_max);
          g.successfulLights++;
          if (relight) { best.relit++; g.score += T.score.per_relight; } else g.score += T.score.per_lantern;
          evs.push(['lantern_lit', { lantern_id: best.id, relight }]);
        }
      }
    }
  }

  // 6. Vùng an toàn: Bóng đang ở trong bị đẩy ra mép trong ≤ 30 tick
  for (const s of g.shades) {
    let inside = null;
    for (const l of g.lanterns) if (hasZone(g, l) && dXZ(l.pos, s.pos) < T.safe_radius - 1e-9) { inside = l; break; }
    if (!inside) { s.expel = 0; continue; }
    if (s.state === 'drain') { s.state = 'wander'; s.target = null; }
    if (s.expel <= 0) s.expel = SAFE_EXPEL_TICKS;
    const dx = s.pos[0] - inside.pos[0], dz = s.pos[2] - inside.pos[2], d = Math.hypot(dx, dz);
    const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
    const nd = d + (T.safe_radius - d) / s.expel;
    s.pos[0] = inside.pos[0] + ux * nd; s.pos[2] = inside.pos[2] + uz * nd;
    s.expel--;
    if (s.expel <= 0) { s.pos[0] = inside.pos[0] + ux * T.safe_radius; s.pos[2] = inside.pos[2] + uz * T.safe_radius; }
  }

  // 7. Tỏa Sáng
  if (active && pulseE && P.pulseCdTicks <= 0 && P.carried >= T.pulse_cost) {
    P.carried -= T.pulse_cost;
    P.pulseCdTicks = Math.round(T.pulse_cooldown_s * TICK_RATE);
    const c = [P.pos[0], P.pos[1] + PULSE_Y, P.pos[2]];
    const ids = [];
    for (const s of [...g.shades].sort(byId)) {
      if (d3(c, s.pos) <= T.pulse_radius) {
        const wasDrain = s.state === 'drain';
        s.state = 'stunned'; s.ticks = Math.round(T.pulse_stun_s * TICK_RATE); s.push = PULSE_PUSH_TICKS; s.target = null;
        const dx = s.pos[0] - c[0], dz = s.pos[2] - c[2], d = Math.hypot(dx, dz);
        s.pushDir = d > 1e-9 ? [dx / d, dz / d] : [1, 0];
        g.score += wasDrain ? T.score.per_stun_drain : T.score.per_stun;
        ids.push(s.id);
      }
    }
    for (const d of [...g.drifters].sort(byId)) {
      if (d3(c, d.pos) > T.pulse_radius) continue;
      if (d.state === 'chase' || d.state === 'idle') {
        if (d.state === 'chase') { d.state = 'flee'; d.ticks = DRIFTER_FLEE_TICKS; d.stoleOnce = true; }
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) addMote(g, [d.pos[0], groundAt(g, d.pos[0], d.pos[2]) ?? 0, d.pos[2]], 'dropped', DROP_TTL);
        d.stolen = 0; d.ticks = DRIFTER_DROP_REMOVE;
        evs.push(['drifter_drop', { drifter_id: d.id, amount }]);
      }
    }
    evs.push(['pulse', { stunned_ids: ids }]);
  }

  // 8. Di chuyển Bóng Mực và Gió Lạc
  const sp = shadeSpeed(g);
  for (const s of g.shades) {
    const dist = dXZ(s.pos, P.pos);
    if (s.expel > 0) { settleShadeY(g, s); continue; }
    if (s.state === 'spawning') { if (s.ticks <= 0) s.state = 'wander'; else continue; }
    if (s.state === 'stunned') {
      if (s.push > 0) {
        const st = g.T.pulse_push_m / PULSE_PUSH_TICKS;
        const nx = s.pos[0] + s.pushDir[0] * st, nz = s.pos[2] + s.pushDir[1] * st;
        if (blockedForShade(g, nx, nz)) s.push = 0; else { s.pos[0] = nx; s.pos[2] = nz; s.push--; }
      }
      if (s.ticks <= 0) s.state = 'wander'; // TICKET-03: hết choáng thì về wander (tick này chưa đổi tiếp)
      settleShadeY(g, s); continue;
    }
    if (s.state === 'recoil') {
      const dx = s.pos[0] - P.pos[0], dz = s.pos[2] - P.pos[2], d = Math.hypot(dx, dz) || 1;
      const nx = s.pos[0] + (dx / d) * (RECOIL_DIST / RECOIL_TICKS), nz = s.pos[2] + (dz / d) * (RECOIL_DIST / RECOIL_TICKS);
      if (!blockedForShade(g, nx, nz)) { s.pos[0] = nx; s.pos[2] = nz; }
      if (s.ticks <= 0) s.state = playerTargetable(g) && dist <= SHADE_LOSE ? 'chase' : 'wander';
      settleShadeY(g, s); continue;
    }
    if (s.state === 'drain') {
      const t = g.lanterns.find((l) => l.id === s.target);
      if (playerTargetable(g) && dist <= DRAIN_BREAK_DIST) { s.state = 'chase'; s.target = null; }
      else if (!t || !t.lit || !isWeak(g, t) || dXZ(t.pos, s.pos) > DRAIN_REACH) { s.state = 'wander'; s.target = null; }
      else { settleShadeY(g, s); continue; } // đứng yên hút dầu
    }
    if (s.state === 'wander' && playerTargetable(g) && dist <= SHADE_DETECT) s.state = 'chase';
    else if (s.state === 'chase' && (!playerTargetable(g) || dist > SHADE_LOSE)) s.state = 'wander';
    if (s.state === 'chase') moveShadeToward(g, s, P.pos[0], P.pos[2], sp);
    else {
      // TICKET-03: wander ưu tiên đèn yếu (fuel < 30) gần nhất, không có thì về đèn tắt gần nhất
      const weak = nearestLantern(g, s.pos, (l) => isWeak(g, l));
      const goal = weak || nearestLantern(g, s.pos, (l) => !l.lit);
      if (weak && dXZ(weak.pos, s.pos) <= DRAIN_REACH) { s.state = 'drain'; s.target = weak.id; s.drainTicks = 0; settleShadeY(g, s); continue; }
      if (goal) { if (dXZ(goal.pos, s.pos) > DRAIN_REACH - 0.5) moveShadeToward(g, s, goal.pos[0], goal.pos[2], weak ? sp : SHADE_WANDER_SPEED); }
      else {
        if (!s.waypoint || dXZ(s.waypoint, s.pos) < 0.5) s.waypoint = pickWaypoint(g);
        moveShadeToward(g, s, s.waypoint[0], s.waypoint[2], SHADE_WANDER_SPEED);
      }
    }
    if (g.night === 3) { const r = Math.hypot(s.pos[0], s.pos[2]); if (r < 2) { const k = 2 / (r || 1); s.pos[0] *= k; s.pos[2] *= k; } }
    blockBySafe(g, s);
    settleShadeY(g, s);
  }
  for (const d of g.drifters) {
    const dist = dXZ(d.pos, P.pos);
    if (d.state === 'idle' || d.state === 'chase') {
      const want = !d.stoleOnce && playerTargetable(g) && P.carried >= DRIFTER_CHASE_CARRY && dist <= DRIFTER_CHASE_DIST;
      d.state = want ? 'chase' : 'idle';
    }
    if (d.state === 'chase') moveShadeToward(g, d, P.pos[0], P.pos[2], DRIFTER_SPEED);
    else if (d.state === 'flee') {
      const dx = d.pos[0] - P.pos[0], dz = d.pos[2] - P.pos[2], dd = Math.hypot(dx, dz) || 1;
      d.pos[0] += (dx / dd) * DRIFTER_SPEED * DT; d.pos[2] += (dz / dd) * DRIFTER_SPEED * DT;
    } else {
      if (!d.waypoint || dXZ(d.waypoint, d.pos) < 0.5) d.waypoint = pickWaypoint(g);
      moveShadeToward(g, d, d.waypoint[0], d.waypoint[2], DRIFTER_IDLE_SPEED);
    }
    d.pos[1] = (groundAt(g, d.pos[0], d.pos[2]) ?? 0) + 1.5;
  }

  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực (id tăng dần) (bench: không sát thương)
  if (active && !g.bench) {
    for (const d of [...g.drifters].sort(byId)) {
      if (d.state === 'chase' && dXZ(d.pos, P.pos) <= DRIFTER_TOUCH && P.carried > 0) {
        const amount = Math.min(DRIFTER_STEAL, P.carried);
        P.carried -= amount; d.stolen = amount; d.state = 'flee'; d.ticks = DRIFTER_FLEE_TICKS; d.stoleOnce = true;
        evs.push(['drifter_steal', { drifter_id: d.id, amount, carried: P.carried }]);
      }
    }
    if (P.invulnTicks <= 0) {
      for (const s of [...g.shades].sort(byId)) {
        if ((s.state !== 'chase' && s.state !== 'wander') || s.expel > 0) continue;
        if (dXZ(s.pos, P.pos) <= T.shade_hit_radius && Math.abs(s.pos[1] - SHADE_Y - P.pos[1]) <= PICK_DY) {
          P.flames = Math.max(0, P.flames - 1);
          const dropped = Math.floor(P.carried * T.hit_drop_ratio);
          P.carried -= dropped;
          dropMotes(g, P.pos, dropped);
          P.invulnTicks = Math.round(T.invuln_s * TICK_RATE);
          s.state = 'recoil'; s.ticks = RECOIL_TICKS;
          evs.push(['player_hit', { by: 'shade', flames: P.flames, dropped }]);
          break;
        }
      }
    }
  }

  // 10. Sinh theo lịch (bench: không sinh thêm)
  if (!g.bench) {
  if (g.randomMotes && g.simTick % MOTE_EVERY === 0 && g.motes.length < MOTE_CAP) spawnRandomMote(g);
  if (g.randomShades) {
    let n = 0;
    if (g.simTick === SHADE_FIRST_TICK) n = 2;
    else if (g.simTick > SHADE_FIRST_TICK && (g.simTick - SHADE_FIRST_TICK) % g.map.shadeInterval === 0) n = 1;
    for (let i = 0; i < n; i++) { const s = trySpawnShade(g); if (s) evs.push(['shade_spawned', { id: s.id }]); }
  }
  if (g.randomDrifters && g.map.drifters && g.simTick % DRIFTER_EVERY === 0 && g.drifters.length < DRIFTER_MAX) {
    const pts = g.map.shadePoints;
    const p = pts[Math.floor(g.rng() * pts.length)];
    g.drifters.push({ id: `D${g.nextDrifter++}`, pos: [p[0], (groundAt(g, p[0], p[2]) ?? 0) + 1.5, p[2]], state: 'idle', stolen: 0, stoleOnce: false, ticks: 0, waypoint: null });
  }
  }

  g.tick++;
  // 11. Thắng / thua
  let result = null;
  // TICKET-03: không thắng sớm; bình minh còn sống và đủ ceil(win_ratio × tổng) đèn sáng thì thắng
  const litNow = g.lanterns.filter((l) => l.lit);
  if (g.bench) result = null; // bench: không kết thúc Đêm
  else if (P.flames <= 0) result = ['lost', 'no_flames'];
  else if (timeLeft(g) <= 1e-9) result = litNow.length >= Math.ceil(T.win_ratio * g.lanterns.length - 1e-9) ? ['won', 'dawn_survived'] : ['lost', 'dawn'];
  if (result) {
    g.state = result[0];
    if (result[0] === 'won') {
      for (const l of litNow) g.score += T.score.per_lit_at_dawn + Math.floor(fuelOf(l) + 1e-9);
      g.score += T.score.per_flame_left * P.flames;
    }
    evs.push(['game_over', { result: result[0], reason: result[1] }]);
  }
  flush();
  return out;
}

export function nightStartEvent(g) {
  return { type: 'event', tick: g.tick, name: 'night_start', data: { night: g.night } };
}

export function snapshot(g) {
  const P = g.player;
  return {
    type: 'snapshot',
    tick: g.tick, sim_tick: g.simTick, night: g.night,
    state: g.state,
    time_left_s: round3(timeLeft(g)),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.dirDeg },
    player: {
      pos: r3(P.pos), vel: r3(P.vel), grounded: P.grounded,
      flames: P.flames, carried: P.carried, capacity: capacity(g),
      invuln: sec(P.invulnTicks), dash_cd_s: sec(P.dashCdTicks), pulse_cd_s: sec(P.pulseCdTicks), charm_s: sec(P.charmTicks),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: r3(l.pos), lit: l.lit, deposited: l.deposited, fuel: l.lit ? round1(fuelOf(l)) : 0, ever_lit: l.everLit, relit_count: l.relit })),
    shades: g.shades.map((s) => ({ id: s.id, pos: r3(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: r3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : sec(m.ttl) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: r3(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: sec(c.respawnTicks) })),
  };
}
