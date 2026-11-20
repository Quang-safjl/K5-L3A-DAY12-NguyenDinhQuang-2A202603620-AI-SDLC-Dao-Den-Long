// Bản đồ chuẩn (Ticket-02, Phần 2). Góc đo từ +X: điểm = (r·cosθ, y, r·sinθ).
const D2R = Math.PI / 180;
const polar = (r, deg, y = 0, cx = 0, cz = 0) => [cx + r * Math.cos(deg * D2R), y, cz + r * Math.sin(deg * D2R)];
const ring = (n, r, start, step, y = 0, cx = 0, cz = 0) => Array.from({ length: n }, (_, i) => polar(r, start + i * step, y, cx, cz));

// ---- Đêm 1: Đảo Bến ----
const N1 = {
  night: 1, name: 'Đảo Bến', durationKey: 'night1_duration_s',
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadePoints: ring(12, 37, 15, 30),
  shadeInterval: 480, shadeMax: 6, shadeSpeed: 4.0,
  drifters: false, charms: [], wind: false,
  pads: [],
  wanderArea: () => [[0, 0, 34]],
  ground(x, z) { return Math.hypot(x, z) <= 40 ? 0 : null; },
};

// ---- Đêm 2: Đảo Cau ----
const N2 = {
  night: 2, name: 'Đảo Cau', durationKey: 'night2_duration_s',
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  motePoints: [...ring(4, 10, 0, 90), ...ring(8, 22, 0, 45), ...ring(4, 10, 0, 90, 0, 70, 0), ...ring(8, 22, 0, 45, 0, 70, 0)],
  shadePoints: [...ring(8, 26, 22.5, 45), ...ring(8, 26, 22.5, 45, 0, 70, 0)],
  shadeInterval: 420, shadeMax: 8, shadeSpeed: 4.0,
  drifters: true, charms: [[35, 0, 0]], wind: false,
  // bục nhảy: bắn về tâm đảo kia
  pads: [
    { pos: [20, 0, 18], r: 1, vy: 14, h: 24, target: [70, 0, 0] },
    { pos: [50, 0, -18], r: 1, vy: 14, h: 24, target: [0, 0, 0] },
  ],
  wanderArea: () => [[0, 0, 24], [70, 0, 24]],
  ground(x, z) {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0; // cầu tre
    return null;
  },
};

// ---- Đêm 3: Đảo Chuông ----
const RAMPS = [30, 150]; // góc của 2 dốc
function rampHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r < 24 || r > 30) return null;
  for (const a of RAMPS) {
    const ux = Math.cos(a * D2R), uz = Math.sin(a * D2R);
    const along = x * ux + z * uz, lat = -x * uz + z * ux;
    if (along >= 24 && along <= 30 && Math.abs(lat) <= 1.5) return (3 * (30 - along)) / 6;
  }
  return null;
}
const N3 = {
  night: 3, name: 'Đảo Chuông', durationKey: 'night3_duration_s',
  start: [0, 0, -30], // giả định: (0,0,0) nằm trong khối tầng 2/tháp chuông
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  motePoints: [...ring(18, 34, 0, 20, 0), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
  shadePoints: ring(16, 43, 0, 22.5),
  shadeInterval: 360, shadeMax: 10, shadeSpeed: 4.5,
  drifters: true, charms: [[30, 0, 25], [-30, 0, 25]], wind: true,
  pads: [{ pos: [0, 3, 13], r: 1, vy: 12, h: 8, dir: [0, -1] }],
  wanderArea: () => [[0, 0, 40]],
  ground(x, z) {
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    if (r < 2) return 14;              // tháp chuông cao 8 m trên tầng 2: không leo được
    if (r <= 8) return 6;              // tầng 2
    if (r >= 12 && r <= 24 && z > 0) return 3; // tầng 1
    const ramp = rampHeight(x, z);
    if (ramp !== null) return ramp;
    return 0;
  },
};

export const NIGHTS = { 1: N1, 2: N2, 3: N3 };
export { polar };
