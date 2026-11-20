#!/usr/bin/env node
// Bot tự chơi Đêm 1 để sinh file inputs (bằng chứng "chơi được từ đầu tới thắng").
// Bot chỉ ĐỌC trạng thái sim để quyết định nút bấm; kết quả được kiểm lại bằng headless.js thật.
// Dùng: node scripts/autoplay.js --seed 42 --out scenarios/autoplay-seed42.inputs.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createGame, step } from '../src/sim.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const seed = parseInt(arg('seed', '42'), 10);
const out = arg('out', `scenarios/autoplay-seed${seed}.inputs.json`);
const T = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;

const g = createGame({ tuning: T, seed });
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const frames = [];
let prev = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
let k = 0;
while (g.state === 'playing' && k < T.night1_duration_s * 60) {
  const P = g.player;
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
  const unlit = g.lanterns.filter((l) => !l.lit).sort((a, b) => d2(a.pos, P.pos) - d2(b.pos, P.pos));
  const target = unlit[0];
  const need = T.lantern_cost - target.deposited;
  let goal;
  if (P.carried >= Math.min(need, T.carry_capacity) || (P.carried > 0 && g.motes.length === 0)) {
    goal = target.pos;
    if (d2(goal, P.pos) <= T.interact_radius - 0.3) cur.interact = !prev.interact;
  } else if (g.motes.length) {
    goal = [...g.motes].sort((a, b) => d2(a.pos, P.pos) - d2(b.pos, P.pos))[0].pos;
  }
  const threat = g.shades.some((s) => s.state !== 'stunned' && d2(s.pos, P.pos) < 3);
  if (threat && P.carried >= T.pulse_cost && P.pulseCdTicks <= 0) cur.pulse = !prev.pulse;
  if (goal) {
    const dx = goal[0] - P.pos[0], dz = goal[2] - P.pos[2], L = Math.hypot(dx, dz);
    if (L > 0.05) cur.move = [Math.round((dx / L) * 1000) / 1000, Math.round((dz / L) * 1000) / 1000];
  }
  const f = { tick: k };
  for (const key of Object.keys(cur)) if (JSON.stringify(cur[key]) !== JSON.stringify(prev[key])) f[key] = cur[key];
  if (Object.keys(f).length > 1) frames.push(f);
  step(g, cur);
  prev = cur;
  k++;
}
writeFileSync(out, JSON.stringify({ frames }) + '\n');
console.log(`seed=${seed} bot kết thúc: state=${g.state} ticks=${k} score=${g.score} → ${out}`);
