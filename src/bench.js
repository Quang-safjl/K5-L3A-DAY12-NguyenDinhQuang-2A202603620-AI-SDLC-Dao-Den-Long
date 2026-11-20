// TICKET-04 §1: cảnh benchmark chuẩn + công thức số đo. Thuần, tất định, không DOM → test được bằng Node.
import { createGame, makeRng } from './sim.js';

export const BENCH = {
  night: 1, shades: 200, motes: 100, litLanterns: ['L1', 'L2', 'L3'],
  warmupS: 3, camRadius: 30, camY: 15, camPeriodS: 15,
  spreadRadius: 38, // rải trong đĩa bán kính 38 m (đảo Đêm 1 bán kính 40 m, chừa mép bãi cát)
};

// Điểm phân bố đều theo diện tích trên đĩa bán kính R (tâm 0,0).
function diskPoint(rng, R) {
  const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * R;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/** Cảnh bench: Đêm 1, 200 Bóng wander + 100 đom đóm rải đều (seed), L1–L3 sáng fuel 100, Mây ở (0,0,0). */
export function createBenchGame({ tuning, seed = 42 }) {
  const g = createGame({ tuning, seed, night: BENCH.night, scenario: { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false } });
  g.bench = true;
  g.player.pos = [0, 0, 0]; g.player.vel = [0, 0, 0]; g.player.grounded = true;
  for (const l of g.lanterns) {
    const on = BENCH.litLanterns.includes(l.id);
    l.lit = on; l.everLit = on; l.deposited = on ? tuning.lantern_cost : 0; l.fuelU = on ? Math.round(tuning.fuel_max * 60) : 0;
  }
  const rng = makeRng(seed);
  const lit = g.lanterns.filter((l) => l.lit);
  const inZone = (x, z) => lit.some((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) < tuning.safe_radius);
  g.shades = [];
  for (let i = 1; i <= BENCH.shades; i++) {
    let x, z;
    do { [x, z] = diskPoint(rng, BENCH.spreadRadius); } while (inZone(x, z)); // không đặt trong vùng an toàn
    g.shades.push({ id: `S${i}`, pos: [x, 1, z], state: 'wander', ticks: 0, push: 0, pushDir: [1, 0], expel: 0, waypoint: null, target: null, drainTicks: 0 });
  }
  g.nextShade = BENCH.shades + 1;
  g.motes = [];
  for (let i = 1; i <= BENCH.motes; i++) {
    const [x, z] = diskPoint(rng, BENCH.spreadRadius);
    g.motes.push({ id: `M${i}`, pos: [x, 0, z], kind: 'random', ttl: null, point: null, bornTick: 0 });
  }
  g.nextMote = BENCH.motes + 1;
  return g;
}

/** Camera bay vòng: tâm (0,0,0), R 30, Y 15, góc 0° ở (30,15,0), ngược chiều kim đồng hồ nhìn từ trên (+Y) xuống, 15 s/vòng. */
export function benchCamera(tSec) {
  const th = (2 * Math.PI * tSec) / BENCH.camPeriodS;
  // Nhìn từ +Y xuống (x sang phải, −z lên trên), ngược chiều kim đồng hồ: +x → −z
  return [BENCH.camRadius * Math.cos(th), BENCH.camY, -BENCH.camRadius * Math.sin(th)];
}

/** Số đo theo định nghĩa Ticket-04 từ danh sách dt (ms) của từng khung trong khoảng đo. */
export function frameStats(dts) {
  const N = dts.length;
  if (!N) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)]; // phân vị 95 kiểu nearest-rank
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    frames: N,
    avg_fps: r1((1000 * N) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: r1(p95),
  };
}
