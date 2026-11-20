#!/usr/bin/env node
// Bot tự chơi một Đêm để sinh file inputs (bằng chứng "chơi được từ đầu tới thắng").
// Bot chỉ ĐỌC trạng thái sim để chọn nút bấm; kết quả được kiểm lại bằng headless.js thật.
// Dùng: node scripts/autoplay.js --seed 42 --night 1 --out scenarios/autoplay-n1-seed42.inputs.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createGame, step } from '../src/sim.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const seed = parseInt(arg('seed', '42'), 10);
const night = parseInt(arg('night', '1'), 10);
const out = arg('out', `scenarios/autoplay-n${night}-seed${seed}.inputs.json`);
const T = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const scPath = arg('scenario', null);
const scenario = scPath ? JSON.parse(readFileSync(scPath, 'utf8')) : null;

const g = createGame({ tuning: T, seed, night, scenario });
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const level = (y) => (y < 1.5 ? 0 : y < 4.5 ? 1 : 2);
const D = Math.PI / 180;

// Đường đi qua địa hình: trả về điểm cần đi tới tiếp theo trên đường tới `t`.
function route(P, t) {
  if (night === 2) {
    // đang trên cầu thì đi hết cầu theo trục x rồi mới rẽ
    if (P[0] > 25.5 && P[0] < 44.5 && Math.abs(P[2]) < 2.2) return t[0] > 35 ? [45.5, 0, 0] : [24.5, 0, 0];
    const side = (x) => (x < 35 ? 'A' : 'B');
    if (side(P[0]) !== side(t[0])) {
      const fromA = side(P[0]) === 'A';
      const enter = fromA ? [25, 0, 0] : [45, 0, 0], exit = fromA ? [45.5, 0, 0] : [24.5, 0, 0];
      // đã tới đầu cầu (lệch tâm cầu < 0.5 m) thì đi thẳng sang đầu kia; tránh dao động quanh điểm vào cầu
      const atBridge = Math.abs(P[2]) < 0.5 && (fromA ? P[0] > 24.6 : P[0] < 45.4);
      return atBridge ? exit : enter;
    }
    return t;
  }
  if (night === 3) {
    const lp = level(P[1]), lt = level(t[1]);
    if (lt > lp && lp === 0) { // lên tầng 1 qua dốc gần nhất
      const a = [30, 150].sort((x, y) => d2(P, [31 * Math.cos(x * D), 0, 31 * Math.sin(x * D)]) - d2(P, [31 * Math.cos(y * D), 0, 31 * Math.sin(y * D)]))[0];
      const foot = [32 * Math.cos(a * D), 0, 32 * Math.sin(a * D)], top = [22 * Math.cos(a * D), 3, 22 * Math.sin(a * D)];
      const along = P[0] * Math.cos(a * D) + P[2] * Math.sin(a * D), lat = Math.abs(-P[0] * Math.sin(a * D) + P[2] * Math.cos(a * D));
      if (lat < 1.0 && along < 32.5) return top;
      if (Math.hypot(P[0], P[2]) < 33.5) { // vòng ra ngoài trước khi tới chân dốc
        const ang = Math.atan2(P[2], P[0]);
        if (d2(P, foot) > 1) return [34 * Math.cos(ang + Math.sign(Math.sin(a * D - ang)) * 0.3), 0, 34 * Math.sin(ang + Math.sign(Math.sin(a * D - ang)) * 0.3)];
      }
      return foot;
    }
    if (lt === 2 && lp === 1) return [0, 3, 13]; // bục nhảy lên tầng 2
    if (lp === 0 && lt === 0) {
      // tránh vách tầng 1 (nửa z>0, r 12–24) và tầng 2: đi vòng ở r = 34
      const blocked = [0.25, 0.5, 0.75].some((k) => { const x = P[0] + (t[0] - P[0]) * k, z = P[2] + (t[2] - P[2]) * k, r = Math.hypot(x, z); return r < 9 || (z > -0.5 && r > 11 && r < 25); });
      if (blocked) { const ang = Math.atan2(P[2], P[0]), ta = Math.atan2(t[2], t[0]); let da = ta - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; const r = Math.max(30.5, Math.hypot(P[0], P[2])); return [r * Math.cos(ang + Math.sign(da) * 0.35), 0, r * Math.sin(ang + Math.sign(da) * 0.35)]; }
    }
    return t;
  }
  return t;
}

const frames = [];
let prev = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
let k = 0;
const limit = T[`night${night}_duration_s`] * 60;
while (g.state === 'playing' && k < limit) {
  const P = g.player;
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  const unlit = g.lanterns.filter((l) => !l.lit).sort((a, b) => d2(a.pos, P.pos) + 15 * Math.abs(level(a.pos[1]) - level(P.pos[1])) - d2(b.pos, P.pos) - 15 * Math.abs(level(b.pos[1]) - level(P.pos[1])));
  const target = unlit[0];
  const need = T.lantern_cost - target.deposited;
  const reachable = g.motes.filter((m) => night !== 3 || level(m.pos[1]) <= Math.max(level(P.pos[1]), level(target.pos[1])));
  let goal;
  if (P.carried >= Math.min(need, T.carry_capacity) || (P.carried > 0 && reachable.length === 0)) {
    goal = target.pos;
    if (d2(goal, P.pos) <= T.interact_radius - 0.3 && Math.abs(goal[1] - P.pos[1]) < 1) cur.interact = !prev.interact;
  } else if (reachable.length) {
    goal = [...reachable].sort((a, b) => d2(a.pos, P.pos) + 20 * Math.abs(a.pos[1] - P.pos[1]) - d2(b.pos, P.pos) - 20 * Math.abs(b.pos[1] - P.pos[1]))[0].pos;
  }
  const danger = g.shades.filter((s) => (s.state === 'chase' || s.state === 'wander') && d2(s.pos, P.pos) < 4.2);
  if (danger.length && P.carried >= T.pulse_cost && P.pulseCdTicks <= 0) cur.pulse = !prev.pulse;
  let flee = null;
  if (danger.length && !cur.pulse) {
    // né: chạy ngược hướng Bóng Mực gần nhất, lướt nếu được
    const s = danger.sort((a, b) => d2(a.pos, P.pos) - d2(b.pos, P.pos))[0];
    const dx = P.pos[0] - s.pos[0], dz = P.pos[2] - s.pos[2], L = Math.hypot(dx, dz) || 1;
    flee = [P.pos[0] + (dx / L) * 5, P.pos[1], P.pos[2] + (dz / L) * 5];
    if (g.map.ground(flee[0], flee[2]) === null) flee = null;
    if (flee && d2(s.pos, P.pos) < 2.5 && P.dashCdTicks <= 0) cur.dash = !prev.dash;
  }
  if ((goal || flee) && P.fallWait <= 0) {
    const w = flee || route(P.pos, goal);
    const dx = w[0] - P.pos[0], dz = w[2] - P.pos[2], L = Math.hypot(dx, dz);
    if (L > 0.05) { const s = Math.min(1, L / 0.1); cur.move = [Math.round((dx / L) * s * 1000) / 1000, Math.round((dz / L) * s * 1000) / 1000]; }
  }
  const f = { tick: k };
  for (const key of Object.keys(cur)) if (JSON.stringify(cur[key]) !== JSON.stringify(prev[key])) f[key] = cur[key];
  if (Object.keys(f).length > 1) frames.push(f);
  step(g, cur);
  prev = cur;
  k++;
}
writeFileSync(out, JSON.stringify({ frames }) + '\n');
console.log(`night=${night} seed=${seed} bot kết thúc: state=${g.state} ticks=${k} score=${g.score} lit=${g.lanterns.filter((l) => l.lit).length}/${g.lanterns.length} flames=${g.player.flames} → ${out}`);
