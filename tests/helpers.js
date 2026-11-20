import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TUNING = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8')).tuning;

/** Chạy headless thật (qua CLI) và trả về {code, lines, raw, stderr}. */
export function runHeadless({ seed = 1, ticks, scenario, inputs, every, extra = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
  const args = [join(ROOT, 'headless.js'), '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', join(dir, 'out.jsonl')];
  if (scenario !== undefined) {
    const p = join(dir, 'sc.json');
    writeFileSync(p, typeof scenario === 'string' ? scenario : JSON.stringify(scenario));
    args.push('--scenario', p);
  }
  if (inputs !== undefined) {
    const p = join(dir, 'in.json');
    writeFileSync(p, typeof inputs === 'string' ? inputs : JSON.stringify(inputs));
    args.push('--inputs', p);
  }
  if (every !== undefined) args.push('--snapshot-every', String(every));
  args.push(...extra);
  const r = spawnSync('node', args, { encoding: 'utf8' });
  let raw = '', lines = [];
  try { raw = readFileSync(join(dir, 'out.jsonl'), 'utf8'); lines = raw.trim().split('\n').map((l) => JSON.parse(l)); } catch {}
  return { code: r.status, lines, raw, stderr: r.stderr };
}

export const events = (lines, name) => lines.filter((l) => l.type === 'event' && (!name || l.name === name));
export const snaps = (lines) => lines.filter((l) => l.type === 'snapshot');
export const end = (lines) => lines[lines.length - 1];

/** Scenario sạch: không ngẫu nhiên, không Bóng Mực, không đom đóm. */
export function cleanScenario(extra = {}) {
  return { random_motes: false, random_shades: false, motes: [], shades: [], ...extra };
}
