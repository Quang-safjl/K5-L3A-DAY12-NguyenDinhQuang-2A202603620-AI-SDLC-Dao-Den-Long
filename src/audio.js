// Âm thanh tổng hợp bằng WebAudio (không dùng file ngoài → không lo bản quyền).
let ctx = null, master = null, musicNodes = null, volume = 0.6;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

function tone(freq, dur, { type = 'sine', gain = 0.25, slide = 0, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, gain = 0.2, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 900;
  s.buffer = buf; g.gain.value = gain; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

export const sfx = {
  pick: () => tone(1200, 0.12, { type: 'triangle', gain: 0.15, slide: 1.5 }),
  lit: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.18, delay: i * 0.09 })); },
  pulse: () => { tone(300, 0.6, { type: 'sine', gain: 0.3, slide: 3 }); noise(0.3, 0.08); },
  hit: () => { tone(160, 0.4, { type: 'sawtooth', gain: 0.25, slide: 0.4 }); noise(0.2, 0.15); },
  jump: () => tone(400, 0.15, { type: 'square', gain: 0.08, slide: 1.8 }),
  dash: () => noise(0.18, 0.18),
  win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.7, { type: 'triangle', gain: 0.2, delay: i * 0.13 })); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, { type: 'sine', gain: 0.22, delay: i * 0.18 })); },
  shade: () => tone(90, 0.8, { type: 'sawtooth', gain: 0.12, slide: 0.7 }),
  tick: () => tone(1500, 0.06, { type: 'square', gain: 0.07 }),
  wind: () => noise(1.5, 0.12),
  charm: () => { tone(880, 0.3, { type: 'triangle', gain: 0.15, slide: 2 }); },
  steal: () => tone(700, 0.3, { type: 'sawtooth', gain: 0.1, slide: 0.5 }),
  ui: () => tone(660, 0.08, { type: 'triangle', gain: 0.1 }),
};

export function unlock() { ensure(); }

export function startMusic() {
  ensure();
  if (musicNodes) return;
  // nhạc nền đêm: hợp âm trầm + LFO chậm
  const g = ctx.createGain(); g.gain.value = 0.05; g.connect(master);
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  lfo.frequency.value = 0.08; lfoG.gain.value = 0.025; lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
  const oscs = [110, 164.8, 220, 277.2].map((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(); return o; });
  musicNodes = { g, lfo, oscs };
}

export function stopMusic() {
  if (!musicNodes) return;
  musicNodes.oscs.forEach((o) => o.stop()); musicNodes.lfo.stop(); musicNodes.g.disconnect();
  musicNodes = null;
}
