#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.0
// node headless.js --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                  --ticks <int> --out f.jsonl [--snapshot-every <int>]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, step, snapshot } from './src/sim.js';

const ROOT = dirname(fileURLToPath(import.meta.url));

class InputError extends Error {}

function fail(msg, code) {
  process.stderr.write(`headless: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail(`tham số lạ: ${k}`, 1);
    const v = argv[i + 1];
    if (v === undefined) fail(`thiếu giá trị cho ${k}`, 1);
    a[k.slice(2)] = v;
    i++;
  }
  return a;
}

function toInt(v, name, min) {
  if (!/^-?\d+$/.test(String(v))) fail(`${name} phải là số nguyên`, 1);
  const n = parseInt(v, 10);
  if (n < min) fail(`${name} phải >= ${min}`, 1);
  return n;
}

function readJson(path, what) {
  let txt;
  try { txt = readFileSync(path, 'utf8'); } catch (e) { fail(`không đọc được ${what}: ${path}`, 1); }
  try { return JSON.parse(txt); } catch (e) { throw new InputError(`${what} không phải JSON hợp lệ: ${e.message}`); }
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isVec3 = (p) => Array.isArray(p) && p.length === 3 && p.every(isNum);

export function validateInputs(inp) {
  if (!inp || typeof inp !== 'object' || !Array.isArray(inp.frames)) throw new InputError('inputs: thiếu mảng "frames"');
  let last = -1;
  for (const [i, f] of inp.frames.entries()) {
    if (!f || typeof f !== 'object') throw new InputError(`inputs.frames[${i}] không phải object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new InputError(`inputs.frames[${i}].tick phải là số nguyên >= 0`);
    if (f.tick <= last) throw new InputError(`inputs.frames[${i}].tick phải tăng nghiêm ngặt`);
    last = f.tick;
    if ('move' in f) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every((x) => isNum(x) && x >= -1 && x <= 1))
        throw new InputError(`inputs.frames[${i}].move phải là [x, z] trong [-1, 1]`);
    }
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) throw new InputError(`inputs.frames[${i}].cam_yaw_deg phải là số`);
    for (const b of ['jump', 'interact', 'pulse', 'dash']) {
      if (b in f && typeof f[b] !== 'boolean') throw new InputError(`inputs.frames[${i}].${b} phải là boolean`);
    }
  }
}

export function validateScenario(sc) {
  if (!sc || typeof sc !== 'object' || Array.isArray(sc)) throw new InputError('scenario phải là object');
  if (sc.player !== undefined) {
    if (typeof sc.player !== 'object') throw new InputError('scenario.player phải là object');
    if (sc.player.pos !== undefined && !isVec3(sc.player.pos)) throw new InputError('scenario.player.pos phải là [x,y,z]');
    for (const k of ['carried', 'flames']) if (sc.player[k] !== undefined && !(Number.isInteger(sc.player[k]) && sc.player[k] >= 0)) throw new InputError(`scenario.player.${k} phải là số nguyên >= 0`);
  }
  for (const k of ['random_motes', 'random_shades']) if (sc[k] !== undefined && typeof sc[k] !== 'boolean') throw new InputError(`scenario.${k} phải là boolean`);
  if (sc.time_left_s !== undefined && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) throw new InputError('scenario.time_left_s phải là số >= 0');
  for (const k of ['motes', 'shades', 'lanterns']) if (sc[k] !== undefined && !Array.isArray(sc[k])) throw new InputError(`scenario.${k} phải là mảng`);
  (sc.motes || []).forEach((m, i) => { if (!isVec3(m)) throw new InputError(`scenario.motes[${i}] phải là [x,y,z]`); });
  (sc.shades || []).forEach((s, i) => {
    if (!s || !isVec3(s.pos)) throw new InputError(`scenario.shades[${i}].pos phải là [x,y,z]`);
    if (s.id !== undefined && typeof s.id !== 'string') throw new InputError(`scenario.shades[${i}].id phải là chuỗi`);
  });
  (sc.lanterns || []).forEach((l, i) => {
    if (!l || typeof l.id !== 'string') throw new InputError(`scenario.lanterns[${i}].id phải là chuỗi`);
    if (l.pos !== undefined && !isVec3(l.pos)) throw new InputError(`scenario.lanterns[${i}].pos phải là [x,y,z]`);
    if (l.lit !== undefined && typeof l.lit !== 'boolean') throw new InputError(`scenario.lanterns[${i}].lit phải là boolean`);
    if (l.deposited !== undefined && !(Number.isInteger(l.deposited) && l.deposited >= 0)) throw new InputError(`scenario.lanterns[${i}].deposited phải là số nguyên >= 0`);
  });
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  for (const req of ['seed', 'ticks', 'out']) if (a[req] === undefined) fail(`thiếu --${req}`, 1);
  const seed = toInt(a.seed, '--seed', -2147483648);
  const ticks = toInt(a.ticks, '--ticks', 0);
  const every = a['snapshot-every'] !== undefined ? toInt(a['snapshot-every'], '--snapshot-every', 1) : 10;
  const night = a.night !== undefined ? toInt(a.night, '--night', 1) : 1;
  if (night !== 1) fail(`--night ${night} chưa được hỗ trợ (Phase 1 chỉ có Đêm 1)`, 1);

  const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
  let scenario = null, inputs = { frames: [] };
  try {
    if (a.scenario) { scenario = readJson(a.scenario, 'scenario'); validateScenario(scenario); }
    if (a.inputs) { inputs = readJson(a.inputs, 'inputs'); validateInputs(inputs); }
  } catch (e) {
    if (e instanceof InputError) fail(e.message, 2);
    throw e;
  }

  const g = createGame({ tuning: contract.tuning, seed, scenario });
  const lines = [];
  const push = (o) => lines.push(JSON.stringify(o));
  push(snapshot(g));

  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  let fi = 0;
  const frames = inputs.frames;
  let steps = 0;
  for (let k = 0; k < ticks && g.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      if (frames[fi].tick === k) Object.assign(cur, frames[fi], { tick: undefined });
      fi++;
    }
    for (const e of step(g, cur)) push(e);
    steps++;
    if (g.tick % every === 0) push(snapshot(g));
  }
  push({ type: 'end', ticks: steps, state: g.state, score: g.score });
  writeFileSync(a.out, lines.join('\n') + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(); } catch (e) { fail(e.stack || String(e), 1); }
}
