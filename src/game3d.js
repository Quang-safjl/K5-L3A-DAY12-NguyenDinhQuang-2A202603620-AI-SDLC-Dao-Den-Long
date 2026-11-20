// Phần hiển thị 3D (Three.js). Chỉ ĐỌC trạng thái từ sim.js, không chứa luật chơi.
import * as THREE from 'three';
import { createGame, step, timeLeft, ISLAND_RADIUS, TICK_RATE } from './sim.js';

let tuning;
try {
  tuning = (await (await fetch('./game.contract.json')).json()).tuning;
} catch (e) {
  document.getElementById('err').style.display = 'flex';
  throw e;
}

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const fogDark = new THREE.Color(0x1a1035), fogLit = new THREE.Color(0x4a2f5c);
scene.background = fogDark.clone();
scene.fog = new THREE.Fog(fogDark.clone(), 15, 70);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const ambient = new THREE.HemisphereLight(0x8a7bd1, 0x1a1030, 0.35);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb9b0ff, 0.25);
moon.position.set(-20, 40, 10);
scene.add(moon);

// Đảo + biển mây
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 4, 4, 64),
  new THREE.MeshStandardMaterial({ color: 0x3d5a3a, roughness: 1 })
);
island.position.y = -2;
scene.add(island);
const sea = new THREE.Mesh(new THREE.CircleGeometry(250, 48), new THREE.MeshStandardMaterial({ color: 0x2b2250, roughness: 1 }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -5;
scene.add(sea);
// vài khối mây
const cloudMat = new THREE.MeshStandardMaterial({ color: 0x5b4d8a, roughness: 1, transparent: true, opacity: 0.8 });
for (let i = 0; i < 40; i++) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(3 + (i % 5), 12, 8), cloudMat);
  const a = (i / 40) * Math.PI * 2, r = 45 + (i * 7) % 40;
  c.position.set(Math.sin(a) * r, -5 + (i % 3), Math.cos(a) * r);
  c.scale.y = 0.4;
  scene.add(c);
}

// ---------- Nhân vật Mây ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 12), new THREE.MeshStandardMaterial({ color: 0x4f7cc9 }));
  body.position.y = 0.75; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf1c9a5 }));
  head.position.y = 1.45; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 24), new THREE.MeshStandardMaterial({ color: 0xe8d18a }));
  hat.position.y = 1.78; g.add(hat); // nón lá
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff8a20, emissiveIntensity: 2 }));
  lamp.position.set(0.55, 1.45, 0); g.add(lamp); // đèn lồng nhỏ treo vành nón
  const light = new THREE.PointLight(0xffa040, 1.2, 8, 1.5);
  light.position.copy(lamp.position); g.add(light);
  g.userData.light = light;
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- Đèn lồng, đom đóm, Bóng Mực ----------
const lanternViews = new Map();
function makeLantern(l) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), new THREE.MeshStandardMaterial({ color: 0x5a3b22 }));
  post.position.y = 1.5; g.add(post);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x553322, emissive: 0x000000 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), lampMat);
  lamp.position.y = 3.4; g.add(lamp);
  const light = new THREE.PointLight(0xffa040, 0, 18, 1.2);
  light.position.y = 3.4; g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(tuning.safe_radius - 0.1, tuning.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);
  scene.add(g);
  return { g, lampMat, light, ring };
}
const moteGeo = new THREE.SphereGeometry(0.15, 8, 6);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xfff09a, emissive: 0xffe066, emissiveIntensity: 2 });
const moteViews = new Map();
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeViews = new Map();
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a0b2e, emissive: 0x3a1460, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 });
  g.add(new THREE.Mesh(shadeGeo, mat));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc77dff });
  for (const x of [-0.25, 0.25]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat); e.position.set(x, 0.2, 0.7); g.add(e); }
  g.userData.mat = mat;
  scene.add(g);
  return g;
}
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; pulseRing.position.y = 0.1;
scene.add(pulseRing);
let pulseT = 1;

// ---------- Input ----------
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR') restart(); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.code));
let camYaw = 0, dragging = false, lastX = 0;
addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => { if (dragging) { camYaw -= (e.clientX - lastX) * 0.3; lastX = e.clientX; } });

function readInput() {
  if (keys.has('ArrowLeft')) camYaw += 2;
  if (keys.has('ArrowRight')) camYaw -= 2;
  let f = 0, r = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD')) r += 1;
  if (keys.has('KeyA')) r -= 1;
  // Camera yaw θ nhìn theo hướng (sinθ, cosθ); bên phải màn hình là -X cục bộ.
  return { move: [-r, f], cam_yaw_deg: camYaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyF') };
}

// ---------- Game loop ----------
let game;
function restart() {
  for (const v of lanternViews.values()) scene.remove(v.g);
  for (const v of moteViews.values()) scene.remove(v);
  for (const v of shadeViews.values()) scene.remove(v);
  lanternViews.clear(); moteViews.clear(); shadeViews.clear();
  game = createGame({ tuning, seed: (Date.now() & 0x7fffffff) });
  for (const l of game.lanterns) lanternViews.set(l.id, makeLantern(l));
  document.getElementById('over').style.display = 'none';
}
restart();

const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg) { toastEl.textContent = msg; toastEl.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.style.opacity = 0), 1200); }

function handleEvents(evs) {
  for (const e of evs) {
    if (e.name === 'lantern_lit') toast(`✨ Đèn ${e.data.lantern_id} đã sáng!`);
    else if (e.name === 'player_hit') toast(`💥 Bị Bóng Mực chạm! Còn ${e.data.flames} ngọn lửa`);
    else if (e.name === 'pulse') { pulseT = 0; pulseRing.position.set(game.player.pos[0], 0.1, game.player.pos[2]); }
    else if (e.name === 'shade_spawned') toast('🌑 Một Bóng Mực mới xuất hiện');
    else if (e.name === 'game_over') {
      document.getElementById('overTitle').textContent = e.data.result === 'won' ? 'Đảo đã sáng trở lại!' : 'Ánh sáng đã tắt…';
      const why = { all_lit: 'Bạn đã thắp cả 5 Đèn Lồng Lớn.', dawn: 'Trời đã sáng trước khi thắp xong đèn.', no_flames: 'Mây đã hết lửa.' }[e.data.reason];
      document.getElementById('overText').textContent = `${why} Điểm: ${game.score}`;
      document.getElementById('over').style.display = 'flex';
    }
  }
}

let acc = 0, last = performance.now();
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  const input = readInput();
  while (acc >= 1 / TICK_RATE) {
    handleEvents(step(game, input));
    acc -= 1 / TICK_RATE;
  }
  sync(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function sync(t) {
  const P = game.player;
  may.position.set(P.pos[0], P.pos[1], P.pos[2]);
  const mv = readInput().move;
  if (mv[0] || mv[1]) {
    const th = (camYaw * Math.PI) / 180;
    const wx = mv[0] * Math.cos(th) + mv[1] * Math.sin(th), wz = -mv[0] * Math.sin(th) + mv[1] * Math.cos(th);
    may.rotation.y = Math.atan2(wx, wz);
  }
  may.userData.light.intensity = 0.6 + P.carried * 0.15;
  may.visible = !(P.invulnTicks > 0 && Math.floor(t * 10) % 2 === 0);

  let lit = 0;
  for (const l of game.lanterns) {
    const v = lanternViews.get(l.id);
    const frac = l.deposited / tuning.lantern_cost;
    v.lampMat.emissive.setHex(0xff8a20); v.lampMat.emissiveIntensity = l.lit ? 2.5 : frac * 0.8;
    v.light.intensity = l.lit ? 40 : frac * 5;
    v.ring.material.opacity = l.lit ? 0.35 : 0;
    if (l.lit) lit++;
  }
  // Đảo sáng dần khi thắp đèn
  const k = lit / game.lanterns.length;
  ambient.intensity = 0.35 + k * 0.6;
  scene.fog.color.copy(fogDark).lerp(fogLit, k); scene.background.copy(scene.fog.color);

  const alive = new Set();
  for (const m of game.motes) {
    alive.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) { v = new THREE.Mesh(moteGeo, moteMat); scene.add(v); moteViews.set(m.id, v); }
    const h = 0.6 + Math.sin(t * 3 + m.pos[0]) * 0.2; // độ cao lơ lửng chỉ để hiển thị
    v.position.set(m.pos[0], h, m.pos[2]);
  }
  for (const [id, v] of moteViews) if (!alive.has(id)) { scene.remove(v); moteViews.delete(id); }

  for (const s of game.shades) {
    let v = shadeViews.get(s.id);
    if (!v) { v = makeShade(); shadeViews.set(s.id, v); }
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 2 + s.pos[2]) * 0.15, s.pos[2]);
    v.lookAt(P.pos[0], s.pos[1], P.pos[2]);
    v.userData.mat.opacity = s.state === 'stunned' ? 0.35 : 0.9;
  }

  if (pulseT < 1) {
    pulseT += 1 / 30;
    const r = tuning.pulse_radius * pulseT;
    pulseRing.scale.set(r, r, r);
    pulseRing.material.opacity = 1 - pulseT;
  }

  // Camera góc nhìn thứ ba
  const th = (camYaw * Math.PI) / 180;
  camera.position.set(P.pos[0] - Math.sin(th) * 8, P.pos[1] + 5, P.pos[2] - Math.cos(th) * 8);
  camera.lookAt(P.pos[0], P.pos[1] + 1.2, P.pos[2]);

  const tl = Math.ceil(timeLeft(game));
  document.getElementById('hud').innerHTML =
    `🔥 Lửa: <b>${P.flames}</b><br>✨ Đom đóm mang theo: <b>${P.carried}/${tuning.carry_capacity}</b><br>` +
    `🏮 Đèn đã thắp: <b>${lit}/${game.lanterns.length}</b><br>⏳ Còn: <b>${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}</b><br>⭐ Điểm: <b>${game.score}</b>` +
    (P.pulseCdTicks > 0 ? '<br>⌛ Tỏa sáng đang hồi' : '');
}
requestAnimationFrame(frame);
