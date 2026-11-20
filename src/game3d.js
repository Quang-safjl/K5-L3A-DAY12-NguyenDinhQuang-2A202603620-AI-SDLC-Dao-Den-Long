// Phần hiển thị 3D + menu/HUD/âm thanh. Chỉ ĐỌC trạng thái sim.js, không chứa luật chơi.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { createGame, step, timeLeft, TICK_RATE, capacity, fuelOf } from './sim.js';
import { NIGHTS } from './maps.js';
import { sfx, startMusic, stopMusic, setVolume, unlock } from './audio.js';
import { PROGRESS_KEY, parseProgress, isUnlocked, recordWin } from './progress.js';

// ---------- Bảng màu chuẩn (Ticket-02) ----------
const C = {
  sky: 0x0E1430, fog: 0x1B2350, grass: 0x2F5D50, sand: 0xC9B48A, wood: 0x6B4A2F, sea: 0x12384A,
  litLamp: 0xFFB347, litCore: 0xFFE9B0, offLamp: 0x5B5F6E, moteCore: 0xFFF6C2, moteHalo: 0xFFE58A,
  shadeBody: 0x120A1A, shadeEdge: 0x7A3CFF, shadeStun: 0x3A3450, shirt: 0xE8E2D0, scarf: 0xC8102E,
  gold: 0xF2C14E, drifter: 0x8FA3B8,
};
const INTRO = {
  1: 'Ông Đăng: "Đảo Bến là nơi ta neo thuyền. Thắp năm ngọn đèn để thuyền tìm được đường về, Mây nhé."',
  2: 'Ông Đăng: "Đảo Cau có hai mỏm nối bằng cầu tre. Cẩn thận Gió Lạc, chúng thích đom đóm lắm."',
  3: 'Ông Đăng: "Đảo Chuông cao ba tầng. Gió mạnh lắm, nghe lá xào xạc thì đứng vững chân!"',
};

let tuning;
try { tuning = (await (await fetch('./game.contract.json')).json()).tuning; }
catch (e) { document.getElementById('err').classList.add('show'); throw e; }

// ---------- Cài đặt (lưu localStorage) ----------
const settings = { volume: 0.6, sens: 0.3, colorblind: false, hq: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };
setVolume(settings.volume);
const EDGE = () => (settings.colorblind ? 0x00B3FF : C.shadeEdge); // TICKET-03: chế độ mù màu
document.body.classList.toggle('cb', !!settings.colorblind);

// ---------- Tiến trình chọn màn (localStorage, chỉ giao diện) ----------
let progress = parseProgress((() => { try { return localStorage.getItem(PROGRESS_KEY); } catch { return null; } })());
const saveProgress = () => { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch {} };

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let scene, ambient, world, water = null, sky = null;
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

// ---------- Asset (CC0 ambientCG + three.js, xem CREDITS.md) ----------
const TEX_FILES = {
  grass: ['./assets/textures/grass_color.jpg', './assets/textures/grass_normal.jpg'],
  sand: ['./assets/textures/sand_color.jpg', './assets/textures/sand_normal.jpg'],
  rock: ['./assets/textures/rock_color.jpg', './assets/textures/rock_normal.jpg'],
  planks: ['./assets/textures/planks_color.jpg', './assets/textures/planks_normal.jpg'],
  bark: ['./assets/textures/bark_color.jpg', './assets/textures/bark_normal.jpg'],
  roof: ['./assets/textures/roof_color.jpg', './assets/textures/roof_normal.jpg'],
  paper: ['./assets/textures/paper_color.jpg', './assets/textures/paper_normal.jpg'],
  water: './assets/textures/waternormals.jpg',
};
const texLoader = new THREE.TextureLoader(), texCache = new Map();
function tex(url, rx = 1, ry = rx, srgb = false) {
  const key = `${url}|${rx}|${ry}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t); return t;
}
// Vật liệu có ảnh màu + normal map; `color` nhuộm nhẹ theo bảng màu chuẩn.
function pbr(name, color, rx = 1, ry = rx, extra = {}) {
  const [c, n] = TEX_FILES[name];
  return new THREE.MeshStandardMaterial({ map: tex(c, rx, ry, true), normalMap: tex(n, rx, ry), color, roughness: 0.92, ...extra });
}
// Ánh sáng mềm (dùng cho quầng đom đóm, đèn lồng, mặt trăng)
const glowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const glow = (color, size, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.set(size, size, 1); return s;
};
// Số giả ngẫu nhiên cho trang trí (chỉ hiển thị; không đụng sim)
const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const MOON_DIR = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();

function makeSky() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(330, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x060a22) }, mid: { value: new THREE.Color(C.sky) }, bottom: { value: new THREE.Color(C.fog) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : bottom; c = mix(bottom, c, smoothstep(-0.02, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  }));
  g.add(dome);
  const rnd = lcg(7), n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rnd() * Math.PI * 2, v = 0.06 + rnd() * 0.94, r = 300, cy = v, sr = Math.sqrt(1 - cy * cy);
    pos.set([Math.cos(u) * sr * r, cy * r, Math.sin(u) * sr * r], i * 3);
    const b = 0.55 + rnd() * 0.45, warm = rnd() < 0.2;
    col.set([b, b * (warm ? 0.9 : 0.97), b * (warm ? 0.75 : 1)], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: true, vertexColors: true, fog: false, transparent: true, opacity: 0.9, depthWrite: false })));
  const mp = MOON_DIR.clone().multiplyScalar(280);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf7f1d0, fog: false }));
  moon.position.copy(mp); g.add(moon);
  const halo = glow(0xc8ccff, 90, 0.45); halo.position.copy(mp); g.add(halo);
  return g;
}

function makeWater() {
  const geo = new THREE.CircleGeometry(320, 64);
  let w;
  if (settings.hq) {
    w = new Water(geo, {
      textureWidth: 512, textureHeight: 512, waterNormals: tex(TEX_FILES.water, 1),
      sunDirection: MOON_DIR.clone(), sunColor: 0xc8ccff, waterColor: 0x082233, distortionScale: 2.2, fog: true,
    });
    w.material.uniforms.size.value = 4;
  } else {
    w = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: C.sea, roughness: 0.25, metalness: 0.3, normalMap: tex(TEX_FILES.water, 24) }));
  }
  w.rotation.x = -Math.PI / 2; w.position.y = -8;
  return w;
}

function makePalm(rnd) {
  const g = new THREE.Group(), bark = pbr('bark', 0xb89a7a, 1, 3);
  const segs = 6, h = 5 + rnd() * 2.5, lean = 0.25 + rnd() * 0.25;
  let top = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const y0 = (i / segs) * h, y1 = ((i + 1) / segs) * h;
    const x0 = lean * (y0 / h) ** 2 * h * 0.35, x1 = lean * (y1 / h) ** 2 * h * 0.35;
    const len = Math.hypot(x1 - x0, y1 - y0), r = 0.26 - i * 0.025;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.02, r, len + 0.05, 8), bark);
    s.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); s.rotation.z = -Math.atan2(x1 - x0, y1 - y0);
    g.add(s); top.set(x1, y1, 0);
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.8, side: THREE.DoubleSide });
  const leafGeo = new THREE.ConeGeometry(0.55, 3.2, 4, 1, true); leafGeo.translate(0, 1.6, 0); leafGeo.scale(1, 1, 0.18);
  const nl = 7;
  for (let i = 0; i < nl; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.copy(top);
    leaf.rotation.order = 'YZX'; leaf.rotation.y = (i / nl) * Math.PI * 2 + rnd() * 0.4; leaf.rotation.z = 1.15 + rnd() * 0.35;
    g.add(leaf);
  }
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), mat(0x5a3d22)); c.position.set(top.x + Math.cos(i * 2.1) * 0.25, top.y - 0.25, Math.sin(i * 2.1) * 0.25); g.add(c); }
  return g;
}
function makeRock(rnd) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + rnd() * 0.9, 0), pbr('rock', 0xc8c8d4, 0.5));
  m.scale.set(1, 0.55 + rnd() * 0.4, 0.8 + rnd() * 0.4); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  return m;
}

// Trang trí quanh mép đảo, tránh đèn, bục nhảy, cầu và dốc. Không ảnh hưởng va chạm (sim không biết tới chúng).
function decorate(night, islands) {
  const N = NIGHTS[night], rnd = lcg(100 + night);
  const avoid = [...N.lanterns, ...N.pads.map((p) => p.pos), ...N.charms];
  const free = (x, z) => avoid.every((p) => Math.hypot(p[0] - x, p[2] - z) > 6)
    && !(night === 2 && x > 18 && x < 52 && Math.abs(z) < 7)
    && !(night === 3 && [30, 150].some((a) => Math.hypot(x - Math.cos(a * Math.PI / 180) * 27, z - Math.sin(a * Math.PI / 180) * 27) < 7));
  for (const [cx, cz, r] of islands) {
    const n = Math.round(r / 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.3, rr = r - 2 - rnd() * 1.5, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (!free(x, z)) continue;
      const p = makePalm(rnd); p.position.set(x, 0, z); p.rotation.y = -a + Math.PI; scene.add(p);
    }
    for (let i = 0; i < n * 1.5; i++) {
      const a = rnd() * Math.PI * 2, rr = r - 0.4 - rnd() * 1.2, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (!free(x, z)) continue;
      const k = makeRock(rnd); k.position.set(x, 0.05, z); scene.add(k);
    }
  }
}

function buildScene(night) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.fog, 30, 150);
  ambient = new THREE.HemisphereLight(0xbfc8ff, 0x1B2350, 0.35);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0xc8ccff, 0.55); moon.position.copy(MOON_DIR).multiplyScalar(100); scene.add(moon);
  sky = makeSky(); scene.add(sky);
  water = makeWater(); scene.add(water);
  const grassTop = (r) => pbr('grass', 0xa8c8a0, r / 5);
  const rockSide = (r, h) => pbr('rock', 0xd8d8e4, Math.round((2 * Math.PI * r) / 8), h / 8);
  const sand = (r) => pbr('sand', 0xe8dcc0, r / 3), wood = pbr('planks', 0xc9a27a, 1, 3);
  const disk = (r, x, z, y = 0, h = 10, top = grassTop(r)) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.86, h, 72), [rockSide(r, h), top, top]);
    d.position.set(x, y - h / 2, z); scene.add(d); return d;
  };
  const beach = (r, x, z) => { const b = new THREE.Mesh(new THREE.RingGeometry(r - 2, r, 72), sand(r)); b.rotation.x = -Math.PI / 2; b.position.set(x, 0.02, z); scene.add(b); };
  if (night === 1) { disk(40, 0, 0); beach(40, 0, 0); decorate(1, [[0, 0, 40]]); }
  if (night === 2) {
    disk(28, 0, 0); disk(28, 70, 0); beach(28, 0, 0); beach(28, 70, 0);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), wood); bridge.position.set(35, -0.15, 0); scene.add(bridge);
    for (let x = 27; x <= 43; x += 2) { const plank = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 4.1), mat(0x4a321f)); plank.position.set(x, -0.1, 0); scene.add(plank); }
    const rope = mat(0x8a6a44), bamboo = pbr('bark', 0xd8c48a, 1, 2);
    for (const z of [-2, 2]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 18, 6), rope); r.rotation.z = Math.PI / 2; r.position.set(35, 1, z); scene.add(r);
      for (let x = 26; x <= 44; x += 3) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 8), bamboo); post.position.set(x, 0.55, z); scene.add(post); }
    }
    decorate(2, [[0, 0, 28], [70, 0, 28]]);
  }
  if (night === 3) {
    disk(45, 0, 0); beach(45, 0, 0);
    const shape = new THREE.Shape(); shape.absarc(0, 0, 24, 0, Math.PI, false); shape.absarc(0, 0, 12, Math.PI, 0, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 40 }),
      [pbr('grass', 0xb0d0a8, 0.2), pbr('rock', 0xd8d8e4, 0.25)]);
    t1.rotation.x = Math.PI / 2; t1.position.y = 3; scene.add(t1); // shape y>0 → nửa z>0, khối Y 0..3
    disk(8, 0, 0, 6, 6, pbr('grass', 0xb8d8b0, 2));
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), pbr('planks', 0xb08060, 2, 2)); tower.position.set(0, 10, 0); scene.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.5, 24), pbr('roof', 0xc06048, 2, 1)); roof.position.set(0, 15.2, 0); scene.add(roof);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), mat(C.gold, { metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }));
    bell.position.set(0, 13.4, 2.1); scene.add(bell);
    for (const a of [30, 150]) {
      const rad = (a * Math.PI) / 180, len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), pbr('planks', 0xc9a27a, 1, 2));
      ramp.position.set(Math.cos(rad) * 27, 1.5, Math.sin(rad) * 27);
      ramp.rotation.order = 'YZX'; ramp.rotation.y = -rad; ramp.rotation.z = -Math.atan2(3, 6); // đầu ngoài (r=30) thấp, đầu trong (r=24) cao 3 m
      scene.add(ramp);
    }
    decorate(3, [[0, 0, 45]]);
  }
  for (const pad of NIGHTS[night].pads) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 24), mat(C.gold, { emissive: C.gold, emissiveIntensity: 0.6 }));
    p.position.set(pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]); scene.add(p);
    const pg = glow(C.gold, 4, 0.5); pg.position.set(pad.pos[0], pad.pos[1] + 0.4, pad.pos[2]); scene.add(pg);
  }
  world = { lanterns: new Map(), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
  world.may = makeMay(); scene.add(world.may);
  world.pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 48), new THREE.MeshBasicMaterial({ color: C.litCore, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  world.pulseRing.rotation.x = -Math.PI / 2; scene.add(world.pulseRing); world.pulseT = 1;
  world.leaves = makeLeaves(); scene.add(world.leaves);
}

function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.7, 4, 12), mat(C.shirt)); body.position.y = 0.75; g.add(body);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), mat(C.scarf)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.2; g.add(scarf);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat(0xf1c9a5)); head.position.y = 1.45; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 24), mat(C.sand)); hat.position.y = 1.78; g.add(hat);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: C.litCore })); lamp.position.set(0.55, 1.45, 0); g.add(lamp);
  const light = new THREE.PointLight(C.litLamp, 2, 9, 1.5); light.position.copy(lamp.position); g.add(light);
  g.userData.light = light;
  return g;
}

function makeLantern(l) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), pbr('bark', 0xb08a68, 1, 2)); post.position.y = 1.5; g.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat(C.wood)); arm.position.y = 3.0; g.add(arm);
  const [pc, pn] = TEX_FILES.paper;
  const lampMat = new THREE.MeshStandardMaterial({ color: C.offLamp, map: tex(pc, 1, 1, true), normalMap: tex(pn), emissive: C.litLamp, emissiveIntensity: 0, roughness: 0.8 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 12), lampMat); lamp.position.y = 3.4; g.add(lamp);
  // nắp gỗ, đáy và tua đỏ
  for (const y of [0.6, -0.6]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.56, 0.16, 12), mat(0x3a2414)); cap.position.y = 3.4 + y; cap.scale.y = y > 0 ? 1 : -1; g.add(cap); }
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), mat(C.scarf)); tassel.position.y = 2.55; tassel.rotation.x = Math.PI; g.add(tassel);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: C.litCore, transparent: true, opacity: 0 })); core.position.y = 3.4; g.add(core);
  const halo = glow(C.litLamp, 5, 0); halo.position.y = 3.4; g.add(halo);
  const light = new THREE.PointLight(C.litLamp, 0, 20, 1.2); light.position.y = 3.4; g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(tuning.safe_radius - 0.12, tuning.safe_radius, 64), new THREE.MeshBasicMaterial({ color: C.litLamp, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  // thanh dầu (nền + phần còn lại) và vết rách trên giấy đèn tắt
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16), new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide }));
  barBg.position.y = 4.4; g.add(barBg);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16), new THREE.MeshBasicMaterial({ color: C.litLamp, side: THREE.DoubleSide }));
  bar.position.set(0, 4.4, 0.01); g.add(bar);
  const tear = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.5), new THREE.MeshBasicMaterial({ color: 0x0b0b10, side: THREE.DoubleSide }));
  tear.position.set(0.12, 3.35, 0.51); tear.rotation.z = 0.5; g.add(tear);
  g.position.set(...l.pos); scene.add(g);
  return { g, lamp, lampMat, core, halo, light, ring, bar, barBg, tear };
}
const moteGeo = new THREE.SphereGeometry(0.1, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: C.moteCore });
function makeMote() { const g = new THREE.Group(); g.add(new THREE.Mesh(moteGeo, moteMat)); g.add(glow(C.moteHalo, 1.3, 0.85)); scene.add(g); return g; }
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12), edgeGeo = new THREE.SphereGeometry(0.86, 16, 12);
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: C.shadeBody, roughness: 1 }));
  const edge = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color: EDGE(), side: THREE.BackSide, transparent: true, opacity: 0.9 }));
  g.add(body, edge);
  for (const x of [-0.25, 0.25]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: EDGE() })); e.position.set(x, 0.2, 0.72); g.add(e); }
  g.userData = { body, edge }; scene.add(g); return g;
}
function makeDrifter() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: C.drifter, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.25), m); s.position.y = i * 0.3; s.rotation.y = i; g.add(s); }
  scene.add(g); return g;
}
function makeCharm() {
  const g = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), mat(C.scarf, { emissive: C.scarf, emissiveIntensity: 0.4 }));
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.03), new THREE.MeshBasicMaterial({ color: C.gold }));
  g.add(rim, leaf); scene.add(g); return g;
}
function makeLeaves() {
  const geo = new THREE.BufferGeometry(); const n = 200, pos = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8fbf6a, size: 0.25 })); p.visible = false; return p;
}

// ---------- Input ----------
const keys = new Set(), tapped = new Set(); // tapped: phím đã nhấn kể từ lần đọc trước (không mất cú nhấn nhanh)
let camYaw = 0, dragging = false, lastX = 0, pauseQueued = false;
addEventListener('keydown', (e) => {
  unlock();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if ((e.code === 'Escape' || e.code === 'KeyP') && mode === 'play') { pauseQueued = true; return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && mode === 'pause') { act('resume'); return; }
  if (e.code === 'Enter' && mode === 'intro') { act('play'); return; }
  keys.add(e.code); tapped.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => { if (dragging) { camYaw -= (e.clientX - lastX) * settings.sens; lastX = e.clientX; } });

function readInput() {
  if (keys.has('ArrowLeft')) camYaw += 2;
  if (keys.has('ArrowRight')) camYaw -= 2;
  let f = 0, r = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD')) r += 1;
  if (keys.has('KeyA')) r -= 1;
  const pause = pauseQueued; pauseQueued = false;
  const k = (c) => keys.has(c) || tapped.has(c);
  const inp = { move: [-r, f], cam_yaw_deg: camYaw, jump: k('Space'), interact: k('KeyE'), pulse: k('KeyF'),
    dash: k('ShiftLeft') || k('ShiftRight'), pause };
  // phím đã nhả: lần đọc sau trả false để sim thấy cạnh false→true ở lần nhấn kế tiếp
  for (const c of tapped) if (!keys.has(c)) tapped.delete(c); else tapped.delete(c);
  return inp;
}

// ---------- Màn hình & luồng game ----------
let mode = 'menu', game = null, night = 1, totalScore = 0, settingsReturn = 'menu';
const $ = (id) => document.getElementById(id);
function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id); }
function setHud(v) { for (const h of document.querySelectorAll('.hud')) if (h.id !== 'fps') h.style.visibility = v ? 'visible' : 'hidden'; }
setHud(false);

function startNight(n) {
  lastCountdown = -1;
  night = n; buildScene(n);
  game = createGame({ tuning, seed: (Date.now() & 0x7fffffff), night: n });
  for (const l of game.lanterns) world.lanterns.set(l.id, makeLantern(l));
  camYaw = 0;
  $('introTitle').textContent = `Đêm ${n} — ${NIGHTS[n].name}`;
  $('introText').textContent = INTRO[n];
  mode = 'intro'; show('scrIntro'); setHud(false);
  sync(0); renderer.render(scene, camera);
}

// Nền menu: Đảo Bến với đèn sáng, camera bay vòng (không có game/sim nào chạy)
function showBackdrop() {
  game = null; buildScene(1);
  for (const pos of NIGHTS[1].lanterns) {
    const v = makeLantern({ pos });
    v.lampMat.color.setHex(C.litLamp); v.lampMat.emissiveIntensity = 1.6; v.core.material.opacity = 1;
    v.halo.material.opacity = 0.8; v.light.intensity = 45; v.bar.visible = v.barBg.visible = v.tear.visible = false;
  }
  world.may.position.set(0, 0, 0);
}

// ---------- Chọn màn ----------
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function renderLevels() {
  const box = $('levels'); box.innerHTML = '';
  for (const n of [1, 2, 3]) {
    const N = NIGHTS[n], open = isUnlocked(progress, n), done = progress.cleared.includes(n); // mọi Đêm đều mở
    const count = N.lanterns.length, need = Math.ceil(tuning.win_ratio * count - 1e-9);
    const feats = [N.drifters && 'Gió Lạc', N.pads.length && 'bục nhảy', n === 2 && 'cầu tre', N.wind && 'gió mạnh', n === 3 && 'ba tầng'].filter(Boolean);
    const b = document.createElement('button');
    b.className = `level${open ? '' : ' locked'}${done ? ' cleared' : ''}`; b.dataset.night = n; b.disabled = !open;
    b.innerHTML = `<div class="art"><span class="num">Đêm ${n}</span>${'🏮'.repeat(count)}${open ? '' : '<div class="lock">🔒</div>'}</div>
      <div class="body"><div class="name">${N.name}</div>
      <div class="meta">${count} đèn · cần ${need} lúc bình minh · ${fmtTime(tuning[N.durationKey])}</div>
      <div class="meta">${feats.length ? feats.join(' · ') : 'Đảo yên bình, hợp để tập'}</div>
      <div class="best">${done ? `⭐ Cao nhất: ${progress.best[n] ?? 0}${progress.cleared.length === 3 && n === 3 ? ' · 🌅' : ''}` : 'Chưa giữ được tới bình minh'}</div></div>`;
    b.addEventListener('click', () => { if (!open) return; unlock(); sfx.ui(); totalScore = 0; startNight(n); });
    box.appendChild(b);
  }
}

function act(a) {
  unlock(); sfx.ui();
  if (a === 'start') { totalScore = 0; startNight(1); }
  else if (a === 'levels') { renderLevels(); show('scrLevels'); }
  else if (a === 'play') { mode = 'play'; show(null); setHud(true); startMusic(); lastT = performance.now(); acc = 0; }
  else if (a === 'next') startNight(night + 1);
  else if (a === 'retry') startNight(night);
  else if (a === 'menu') { mode = 'menu'; stopMusic(); show('scrMenu'); setHud(false); if (game) showBackdrop(); }
  else if (a === 'resume') { pauseQueued = true; }
  else if (a === 'settings') {
    settingsReturn = mode === 'pause' ? 'scrPause' : 'scrMenu';
    $('setVol').value = settings.volume; $('setSens').value = settings.sens; $('setCb').checked = !!settings.colorblind; $('setHq').checked = !!settings.hq;
    show('scrSettings');
  }
  else if (a === 'settingsBack') { show(settingsReturn); }
}
for (const b of document.querySelectorAll('[data-act]')) b.addEventListener('click', () => act(b.dataset.act));
$('setVol').addEventListener('input', (e) => { settings.volume = +e.target.value; setVolume(settings.volume); saveSettings(); });
$('setSens').addEventListener('input', (e) => { settings.sens = +e.target.value; saveSettings(); });
$('setHq').addEventListener('change', (e) => {
  settings.hq = e.target.checked; saveSettings();
  if (scene && water) { scene.remove(water); water = makeWater(); scene.add(water); }
});
$('setCb').addEventListener('change', (e) => {
  settings.colorblind = e.target.checked; saveSettings(); document.body.classList.toggle('cb', settings.colorblind);
  if (world) for (const v of world.shades.values()) v.traverse((o) => { if (o.material && o.material.color && o !== v.userData.body) o.material.color.setHex(EDGE()); });
});

function onEvents(evs) {
  for (const e of evs) {
    const d = e.data;
    if (e.name === 'mote_picked') sfx.pick();
    else if (e.name === 'lantern_lit' || e.name === 'refuel') sfx.lit();
    else if (e.name === 'lantern_out') sfx.lose();
    else if (e.name === 'pulse') { sfx.pulse(); world.pulseT = 0; world.pulseRing.position.set(game.player.pos[0], game.player.pos[1] + 0.1, game.player.pos[2]); }
    else if (e.name === 'player_hit') sfx.hit();
    else if (e.name === 'shade_spawned') sfx.shade();
    else if (e.name === 'dash') sfx.dash();
    else if (e.name === 'charm_picked') sfx.charm();
    else if (e.name === 'drifter_steal') sfx.steal();
    else if (e.name === 'paused') { mode = 'pause'; show('scrPause'); }
    else if (e.name === 'resumed') { mode = 'play'; show(null); }
    else if (e.name === 'game_over') {
      mode = 'result';
      if (d.result === 'won') {
        sfx.win(); totalScore += game.score;
        progress = recordWin(progress, night, game.score); saveProgress(); // mở khóa Đêm kế trong Chọn màn
        if (night === 3) { $('dawnScore').textContent = `Tổng điểm: ${totalScore}`; show('scrDawn'); stopMusic(); continue; }
        $('resTitle').textContent = `Đêm ${night} — Giữ được đảo tới bình minh!`;
        $('resText').textContent = `Điểm đêm này: ${game.score} · Tổng: ${totalScore}`;
        $('resNext').style.display = '';
      } else {
        sfx.lose();
        $('resTitle').textContent = 'Ánh sáng đã tắt…';
        const need = Math.ceil(tuning.win_ratio * game.lanterns.length), litN = game.lanterns.filter((l) => l.lit).length;
        $('resText').textContent = d.reason === 'dawn' ? `Bình minh tới nhưng chỉ còn ${litN} đèn sáng (cần ${need}).` : 'Mây đã hết Ngọn Lửa.';
        $('resNext').style.display = 'none';
      }
      show('scrResult'); setHud(false);
    }
  }
}

// ---------- Vòng lặp ----------
let acc = 0, lastT = performance.now(), prevJump = false, lastCountdown = -1, windWarned = -1;
let fpsFrames = 0, fpsT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  fpsFrames++;
  if (now - fpsT > 1000) { $('fps').textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT))} FPS`; fpsFrames = 0; fpsT = now; }
  const t = now / 1000;
  if (water && water.material.uniforms) water.material.uniforms.time.value = t * 0.5;
  else if (water && water.material.normalMap) water.material.normalMap.offset.set(t * 0.01, t * 0.006);
  if (!game) {
    camera.position.set(Math.sin(t * 0.06) * 62, 20, Math.cos(t * 0.06) * 62);
    camera.lookAt(0, 3, 0); sky.position.copy(camera.position);
    renderer.render(scene, camera); lastT = now; return;
  }
  if (mode === 'pause') {
    // logic dừng hoàn toàn; chỉ chạy 1 bước khi người chơi chọn Tiếp tục (gửi input pause)
    // cần 1 bước pause=false trước để có cạnh false→true (sim vẫn đang dừng nên bước này chỉ tăng tick)
    if (pauseQueued) { const inp = readInput(); step(game, { ...inp, pause: false }); onEvents(step(game, inp)); acc = 0; }
  } else if (mode === 'play') {
    acc += Math.min(0.25, (now - lastT) / 1000);
    while (acc >= 1 / TICK_RATE && mode === 'play') {
      const inp = readInput();
      if (inp.jump && !prevJump && game.player.grounded) sfx.jump();
      prevJump = inp.jump;
      onEvents(step(game, inp));
      acc -= 1 / TICK_RATE;
    }
  }
  lastT = now;
  sync(now / 1000);
  renderer.render(scene, camera);
}
showBackdrop();
requestAnimationFrame(frame);

const v3 = new THREE.Vector3();
function sync(t) {
  const P = game.player;
  world.may.position.set(...P.pos);
  world.may.rotation.y = Math.atan2(P.facing[0], P.facing[1]);
  world.may.visible = !(P.invulnTicks > 0 && Math.floor(t * 10) % 2 === 0) && P.fallWait <= 0;
  world.may.userData.light.intensity = 1 + P.carried * 0.25;

  let lit = 0;
  const blink = Math.floor(t * 2) % 2 === 0; // 1 Hz
  for (const l of game.lanterns) {
    const v = world.lanterns.get(l.id), cost = l.everLit ? tuning.relight_cost : tuning.lantern_cost, frac = l.deposited / cost;
    const fuel = fuelOf(l), low = l.lit && fuel < tuning.low_fuel_threshold, on = l.lit && !(low && !blink);
    v.lampMat.color.setHex(l.lit ? C.litLamp : C.offLamp);
    v.lampMat.emissiveIntensity = on ? 1.6 : l.lit ? 0.4 : frac * 0.6;
    v.core.material.opacity = on ? 1 : 0;
    v.halo.material.opacity = on ? 0.45 + 0.4 * fuel / tuning.fuel_max : 0;
    v.light.intensity = on ? 60 * (0.4 + 0.6 * fuel / tuning.fuel_max) : l.lit ? 8 : frac * 6;
    v.ring.material.opacity = l.lit && !low ? 0.4 : 0; // fuel < 30: mất vùng an toàn
    v.lamp.scale.y = l.lit ? 1 : 0.8; // đèn tắt bị xẹp 20%
    v.tear.visible = !l.lit;
    v.bar.visible = v.barBg.visible = l.lit;
    v.bar.scale.x = Math.max(0.001, fuel / tuning.fuel_max); v.bar.position.x = -0.7 * (1 - fuel / tuning.fuel_max);
    v.bar.material.color.setHex(low ? (settings.colorblind ? 0xFFFFFF : 0xFF5A5F) : C.litLamp);
    v.bar.visible = l.lit && !(low && !blink);
    v.bar.quaternion.copy(camera.quaternion); v.barBg.quaternion.copy(camera.quaternion);
    if (l.lit) lit++;
  }
  ambient.intensity = 0.3 + 0.6 * (lit / game.lanterns.length); // càng nhiều đèn sáng, đảo càng sáng

  const seen = new Set();
  for (const m of game.motes) {
    seen.add(m.id);
    let v = world.motes.get(m.id); if (!v) { v = makeMote(); world.motes.set(m.id, v); }
    v.position.set(m.pos[0], m.pos[1] + 0.6 + Math.sin(t * 3 + m.pos[0]) * 0.15, m.pos[2]);
    v.visible = m.ttl === null || m.ttl > 120 || Math.floor(t * 8) % 2 === 0;
  }
  for (const [id, v] of world.motes) if (!seen.has(id)) { scene.remove(v); world.motes.delete(id); }

  seen.clear();
  for (const s of game.shades) {
    seen.add(s.id);
    let v = world.shades.get(s.id); if (!v) { v = makeShade(); world.shades.set(s.id, v); }
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 2 + s.pos[2]) * 0.15, s.pos[2]);
    v.lookAt(P.pos[0], s.pos[1], P.pos[2]);
    const stun = s.state === 'stunned';
    v.userData.body.material.color.setHex(stun ? C.shadeStun : C.shadeBody);
    v.scale.y = s.state === 'drain' ? 0.8 + 0.1 * Math.sin(t * 8) : 1; // đang hút dầu: co bóp
    v.userData.edge.material.opacity = s.state === 'spawning' ? 0.3 + 0.3 * Math.sin(t * 10) : stun ? 0.3 : 0.9;
    v.scale.setScalar(s.state === 'spawning' ? 0.6 : 1);
  }
  for (const [id, v] of world.shades) if (!seen.has(id)) { scene.remove(v); world.shades.delete(id); }

  seen.clear();
  for (const d of game.drifters) {
    seen.add(d.id);
    let v = world.drifters.get(d.id); if (!v) { v = makeDrifter(); world.drifters.set(d.id, v); }
    v.position.set(...d.pos); v.rotation.y = t * 4;
  }
  for (const [id, v] of world.drifters) if (!seen.has(id)) { scene.remove(v); world.drifters.delete(id); }

  for (const c of game.charms) {
    let v = world.charms.get(c.id); if (!v) { v = makeCharm(); world.charms.set(c.id, v); }
    v.visible = c.available; v.position.set(c.pos[0], c.pos[1] + 0.9 + Math.sin(t * 2) * 0.15, c.pos[2]); v.rotation.y = t * 1.5;
  }

  if (world.pulseT < 1) { world.pulseT += 1 / 30; const r = tuning.pulse_radius * world.pulseT; world.pulseRing.scale.set(r, r, r); world.pulseRing.material.opacity = 1 - world.pulseT; }

  // gió: lá bay báo trước 2 s và trong lúc gió thổi
  const warn = game.windEnabled && game.simTick >= 1800 - 120 && (game.simTick + 120) % 1800 < 120 && !game.wind.active;
  world.leaves.visible = warn || game.wind.active;
  if (world.leaves.visible) {
    const a = world.leaves.geometry.attributes.position, dir = (game.wind.dirDeg * Math.PI) / 180;
    for (let i = 0; i < a.count; i++) {
      const k = (t * 0.3 + i * 0.37) % 1;
      a.setXYZ(i, P.pos[0] + Math.cos(dir) * (k * 30 - 15) + Math.sin(i) * 8, P.pos[1] + 0.5 + (i % 7) * 0.5, P.pos[2] + Math.sin(dir) * (k * 30 - 15) + Math.cos(i) * 8);
    }
    a.needsUpdate = true;
    if (warn && windWarned !== Math.floor(game.simTick / 1800)) { windWarned = Math.floor(game.simTick / 1800); sfx.wind(); }
  }

  // camera
  const th = (camYaw * Math.PI) / 180;
  camera.position.set(P.pos[0] - Math.sin(th) * 8, P.pos[1] + 5, P.pos[2] - Math.cos(th) * 8);
  camera.lookAt(P.pos[0], P.pos[1] + 1.2, P.pos[2]);
  sky.position.copy(camera.position); // bầu trời đi theo camera

  if (mode !== 'play') return;
  // ---------- HUD ----------
  $('hudFlames').innerHTML = '🔥'.repeat(P.flames) + '<span style="opacity:.25">' + '🔥'.repeat(Math.max(0, tuning.flames - P.flames)) + '</span>';
  const tl = Math.ceil(timeLeft(game));
  const clock = $('hudClock'); clock.textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`;
  clock.classList.toggle('warn', tl <= 30);
  if (tl <= 10 && tl !== lastCountdown) { lastCountdown = tl; sfx.tick(); }
  const need = Math.ceil(tuning.win_ratio * game.lanterns.length);
  $('hudRight').innerHTML = `🏮 ${lit}/${game.lanterns.length} <small>(cần ${need} lúc bình minh)</small><br><span class="score">⭐ ${game.score}</span>`;
  $('hudInfo').textContent = [P.charmTicks > 0 ? `Bùa Gió ${Math.ceil(P.charmTicks / 60)}s` : '', game.wind.active ? 'Gió mạnh!' : warn ? 'Gió sắp tới…' : ''].filter(Boolean).join(' · ');
  const cap = capacity(game);
  $('hudBar').innerHTML = Array.from({ length: cap }, (_, i) => `<i class="${i < P.carried ? 'on' : ''}"></i>`).join('') + `<b style="margin-left:8px">${P.carried}/${cap}</b>`;
  const dashFrac = P.charmTicks > 0 ? 0 : P.dashCdTicks / (tuning.dash_cooldown_s * 60);
  $('cdDash').querySelector('.fill').style.height = `${dashFrac * 100}%`;
  $('cdPulse').querySelector('.fill').style.height = `${(P.pulseCdTicks / (tuning.pulse_cooldown_s * 60)) * 100}%`;
  // nhắc nạp / châm dầu
  let near = null;
  for (const l of game.lanterns) if ((!l.lit || fuelOf(l) < tuning.fuel_max) && Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) <= tuning.interact_radius) near = l;
  const pr = $('hudPrompt');
  pr.style.display = near ? 'block' : 'none';
  if (near) pr.textContent = near.lit ? `E — Châm dầu (${Math.floor(fuelOf(near))}/${tuning.fuel_max})` : `E — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${near.everLit ? tuning.relight_cost : tuning.lantern_cost})`;
  // mũi tên chỉ đèn chưa sáng gần nhất khi nó ngoài màn hình
  let target = null, bd = Infinity;
  for (const l of game.lanterns) if (!l.lit) { const d = Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]); if (d < bd) { bd = d; target = l; } }
  const arrow = $('hudArrow');
  if (target) {
    v3.set(target.pos[0], target.pos[1] + 3.4, target.pos[2]).project(camera);
    const off = v3.z > 1 || Math.abs(v3.x) > 1 || Math.abs(v3.y) > 1;
    arrow.style.display = off ? 'block' : 'none';
    if (off) {
      let x = v3.x, y = v3.y; if (v3.z > 1) { x = -x; y = -y; }
      const ang = Math.atan2(y, x), cx = innerWidth / 2 + Math.cos(ang) * innerWidth * 0.4, cy = innerHeight / 2 - Math.sin(ang) * innerHeight * 0.38;
      arrow.style.left = `${cx}px`; arrow.style.top = `${cy}px`;
      arrow.style.transform = `translate(-50%,-50%) rotate(${Math.PI / 2 - ang}rad)`;
    }
  } else arrow.style.display = 'none';
}

// Phục vụ kiểm thử giao diện tự động (scripts/ui-smoke.py)
window.__ddl = { get game() { return game; }, get mode() { return mode; } };
