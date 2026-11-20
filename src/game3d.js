// Phần hiển thị 3D + menu/HUD/âm thanh. Chỉ ĐỌC trạng thái sim.js, không chứa luật chơi.
import * as THREE from 'three';
import { createGame, step, timeLeft, TICK_RATE } from './sim.js';
import { NIGHTS } from './maps.js';
import { sfx, startMusic, stopMusic, setVolume, unlock } from './audio.js';

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
const settings = { volume: 0.6, sens: 0.3 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };
setVolume(settings.volume);

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let scene, ambient, world;
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

function buildScene(night) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.fog, 25, 110);
  ambient = new THREE.HemisphereLight(0xbfc8ff, 0x1B2350, 0.15);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0xc8ccff, 0.25); moon.position.set(-30, 60, 20); scene.add(moon);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), mat(C.sea));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -8; scene.add(sea);
  const grass = mat(C.grass), sand = mat(C.sand), wood = mat(C.wood);
  const disk = (r, x, z, y = 0, h = 6, m = grass) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 64), m); d.position.set(x, y - h / 2, z); scene.add(d); return d; };
  const beach = (r, x, z) => { const b = new THREE.Mesh(new THREE.RingGeometry(r - 1.5, r, 64), sand); b.rotation.x = -Math.PI / 2; b.position.set(x, 0.02, z); scene.add(b); };
  if (night === 1) { disk(40, 0, 0); beach(40, 0, 0); }
  if (night === 2) {
    disk(28, 0, 0); disk(28, 70, 0); beach(28, 0, 0); beach(28, 70, 0);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), wood); bridge.position.set(35, -0.15, 0); scene.add(bridge);
    for (let x = 27; x <= 43; x += 2) { const plank = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 4.1), mat(0x4a321f)); plank.position.set(x, -0.1, 0); scene.add(plank); }
  }
  if (night === 3) {
    disk(45, 0, 0); beach(45, 0, 0);
    const shape = new THREE.Shape(); shape.absarc(0, 0, 24, 0, Math.PI, false); shape.absarc(0, 0, 12, Math.PI, 0, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 40 }), mat(0x3a6a5c));
    t1.rotation.x = Math.PI / 2; t1.position.y = 3; scene.add(t1); // shape y>0 → nửa z>0, khối Y 0..3
    disk(8, 0, 0, 6, 6, mat(0x467a6a));
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), mat(C.wood)); tower.position.set(0, 10, 0); scene.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.5, 24), mat(0x7a2b1f)); roof.position.set(0, 15.2, 0); scene.add(roof);
    for (const a of [30, 150]) {
      const rad = (a * Math.PI) / 180, len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), mat(C.sand));
      ramp.position.set(Math.cos(rad) * 27, 1.5, Math.sin(rad) * 27);
      ramp.rotation.order = 'YZX'; ramp.rotation.y = -rad; ramp.rotation.z = -Math.atan2(3, 6); // đầu ngoài (r=30) thấp, đầu trong (r=24) cao 3 m
      scene.add(ramp);
    }
  }
  for (const pad of NIGHTS[night].pads) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 24), mat(C.gold, { emissive: C.gold, emissiveIntensity: 0.6 }));
    p.position.set(pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]); scene.add(p);
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
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), mat(C.wood)); post.position.y = 1.5; g.add(post);
  const lampMat = new THREE.MeshStandardMaterial({ color: C.offLamp, emissive: C.litLamp, emissiveIntensity: 0 });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), lampMat); lamp.position.y = 3.4; g.add(lamp);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: C.litCore, transparent: true, opacity: 0 })); core.position.y = 3.4; g.add(core);
  const light = new THREE.PointLight(C.litLamp, 0, 20, 1.2); light.position.y = 3.4; g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(tuning.safe_radius - 0.12, tuning.safe_radius, 64), new THREE.MeshBasicMaterial({ color: C.litLamp, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  g.position.set(...l.pos); scene.add(g);
  return { g, lampMat, core, light, ring };
}
const moteGeo = new THREE.SphereGeometry(0.12, 8, 6), haloGeo = new THREE.SphereGeometry(0.28, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: C.moteCore });
const haloMat = new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.35 });
function makeMote() { const g = new THREE.Group(); g.add(new THREE.Mesh(moteGeo, moteMat)); g.add(new THREE.Mesh(haloGeo, haloMat)); scene.add(g); return g; }
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12), edgeGeo = new THREE.SphereGeometry(0.86, 16, 12);
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: C.shadeBody, roughness: 1 }));
  const edge = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color: C.shadeEdge, side: THREE.BackSide, transparent: true, opacity: 0.9 }));
  g.add(body, edge);
  for (const x of [-0.25, 0.25]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: C.shadeEdge })); e.position.set(x, 0.2, 0.72); g.add(e); }
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
  night = n; buildScene(n);
  game = createGame({ tuning, seed: (Date.now() & 0x7fffffff), night: n });
  for (const l of game.lanterns) world.lanterns.set(l.id, makeLantern(l));
  camYaw = 0;
  $('introTitle').textContent = `Đêm ${n} — ${NIGHTS[n].name}`;
  $('introText').textContent = INTRO[n];
  mode = 'intro'; show('scrIntro'); setHud(false);
  sync(0); renderer.render(scene, camera);
}

function act(a) {
  unlock(); sfx.ui();
  if (a === 'start') { totalScore = 0; startNight(1); }
  else if (a === 'play') { mode = 'play'; show(null); setHud(true); startMusic(); lastT = performance.now(); acc = 0; }
  else if (a === 'next') startNight(night + 1);
  else if (a === 'retry') startNight(night);
  else if (a === 'menu') { mode = 'menu'; stopMusic(); show('scrMenu'); setHud(false); }
  else if (a === 'resume') { pauseQueued = true; }
  else if (a === 'settings') { settingsReturn = mode === 'pause' ? 'scrPause' : 'scrMenu'; $('setVol').value = settings.volume; $('setSens').value = settings.sens; show('scrSettings'); }
  else if (a === 'settingsBack') { show(settingsReturn); }
}
for (const b of document.querySelectorAll('[data-act]')) b.addEventListener('click', () => act(b.dataset.act));
$('setVol').addEventListener('input', (e) => { settings.volume = +e.target.value; setVolume(settings.volume); saveSettings(); });
$('setSens').addEventListener('input', (e) => { settings.sens = +e.target.value; saveSettings(); });

function onEvents(evs) {
  for (const e of evs) {
    const d = e.data;
    if (e.name === 'mote_picked') sfx.pick();
    else if (e.name === 'lantern_lit') sfx.lit();
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
        if (night === 3) { $('dawnScore').textContent = `Tổng điểm: ${totalScore}`; show('scrDawn'); stopMusic(); continue; }
        $('resTitle').textContent = `Đêm ${night} — Thắng!`;
        $('resText').textContent = `Điểm đêm này: ${game.score} · Tổng: ${totalScore}`;
        $('resNext').style.display = '';
      } else {
        sfx.lose();
        $('resTitle').textContent = 'Ánh sáng đã tắt…';
        $('resText').textContent = d.reason === 'dawn' ? 'Trời đã sáng trước khi thắp hết đèn.' : 'Mây đã hết Ngọn Lửa.';
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
  if (!game) return;
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
requestAnimationFrame(frame);

const v3 = new THREE.Vector3();
function sync(t) {
  const P = game.player;
  world.may.position.set(...P.pos);
  world.may.rotation.y = Math.atan2(P.facing[0], P.facing[1]);
  world.may.visible = !(P.invulnTicks > 0 && Math.floor(t * 10) % 2 === 0) && P.fallWait <= 0;
  world.may.userData.light.intensity = 1 + P.carried * 0.25;

  let lit = 0;
  for (const l of game.lanterns) {
    const v = world.lanterns.get(l.id), frac = l.deposited / tuning.lantern_cost;
    v.lampMat.color.setHex(l.lit ? C.litLamp : C.offLamp);
    v.lampMat.emissiveIntensity = l.lit ? 1.6 : frac * 0.6;
    v.core.material.opacity = l.lit ? 1 : 0;
    v.light.intensity = l.lit ? 60 : frac * 6;
    v.ring.material.opacity = l.lit ? 0.4 : 0;
    if (l.lit) lit++;
  }
  ambient.intensity = 0.15 + 0.55 * (lit / game.lanterns.length);

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

  if (mode !== 'play') return;
  // ---------- HUD ----------
  $('hudFlames').innerHTML = '🔥'.repeat(P.flames) + '<span style="opacity:.25">' + '🔥'.repeat(Math.max(0, tuning.flames - P.flames)) + '</span>';
  const tl = Math.ceil(timeLeft(game));
  const clock = $('hudClock'); clock.textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`;
  clock.classList.toggle('warn', tl <= 30);
  if (tl <= 10 && tl !== lastCountdown) { lastCountdown = tl; sfx.tick(); }
  $('hudRight').innerHTML = `🏮 ${lit}/${game.lanterns.length}<br><span class="score">⭐ ${game.score}</span>`;
  $('hudInfo').textContent = [P.charmTicks > 0 ? `Bùa Gió ${Math.ceil(P.charmTicks / 60)}s` : '', game.wind.active ? 'Gió mạnh!' : warn ? 'Gió sắp tới…' : ''].filter(Boolean).join(' · ');
  $('hudBar').innerHTML = Array.from({ length: tuning.carry_capacity }, (_, i) => `<i class="${i < P.carried ? 'on' : ''}"></i>`).join('');
  const dashFrac = P.charmTicks > 0 ? 0 : P.dashCdTicks / (tuning.dash_cooldown_s * 60);
  $('cdDash').querySelector('.fill').style.height = `${dashFrac * 100}%`;
  $('cdPulse').querySelector('.fill').style.height = `${(P.pulseCdTicks / (tuning.pulse_cooldown_s * 60)) * 100}%`;
  // nhắc nạp đèn
  let near = null;
  for (const l of game.lanterns) if (!l.lit && Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) <= tuning.interact_radius) near = l;
  const pr = $('hudPrompt');
  pr.style.display = near ? 'block' : 'none';
  if (near) pr.textContent = `E — Nạp ánh sáng (${near.deposited}/${tuning.lantern_cost})`;
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
