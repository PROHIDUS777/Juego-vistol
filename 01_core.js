'use strict';
/* ==========================================================================
   CIUDAD ESTRECHO · MÓDULO 01 · NÚCLEO
   Utilidades, ruido determinista, ajustes, entrada (teclado/ratón/mando) y audio
   ========================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapPI = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const angDiff = (a, b) => wrapPI(b - a);
const rad = d => d * Math.PI / 180;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fmt = n => Math.round(n).toLocaleString('es-ES');

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 5, s = 0) {
  let a = 0.5, f = 1, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2; }
  return t / n;
}
function ridge(x, y, oct = 5, s = 0) {
  let a = 0.5, f = 1, t = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    const v = 1 - Math.abs(vnoise(x * f, y * f, s + i * 31) * 2 - 1);
    t += a * v * v; n += a; a *= 0.5; f *= 2.07;
  }
  return t / n;
}

/* ---------- gestión de errores: nada falla en silencio ---------- */
const Err = {
  log: [],
  report(m) {
    this.log.push(m); console.error(m);
    const el = document.getElementById('errbox');
    if (el) { el.style.display = 'block'; el.textContent = this.log.slice(-5).join('\n'); }
  }
};
window.addEventListener('error', e => Err.report((e.message || 'error') + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', e => Err.report('Promesa: ' + (e.reason && e.reason.stack ? e.reason.stack.split('\n').slice(0, 2).join(' ') : e.reason)));
/* Cada sistema corre aislado: si uno falla 6 veces se desactiva y se informa, el resto del juego sigue */
const SafeRun = {
  fails: {},
  run(name, fn, a, b, c) {
    if ((this.fails[name] || 0) >= 6) return;
    try { fn(a, b, c); } catch (e) {
      this.fails[name] = (this.fails[name] || 0) + 1;
      Err.report('[' + name + '] ' + e.message + ' ' + String(e.stack || '').split('\n')[1]);
    }
  }
};

/* ---------- eventos ---------- */
const Bus = {
  h: {},
  on(n, f) { (this.h[n] = this.h[n] || []).push(f); },
  emit(n, d) { (this.h[n] || []).forEach(f => { try { f(d); } catch (e) { Err.report('evento ' + n + ': ' + e.message); } }); }
};

/* ---------- ajustes ---------- */
const DEFAULT_SETTINGS = {
  quality: 'high', renderScale: 1, shadows: 2, viewChunks: 6, traffic: 1, peds: 1, fov: 68, sens: 1, invertY: false,
  minimapRotate: true, subs: true, subSize: 1, vMaster: 0.8, vMusic: 0.45, vSfx: 0.8, showFps: false, autoScale: true
};
const Settings = {
  d: { ...DEFAULT_SETTINGS },
  load() { try { this.d = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem('ce_settings') || '{}')); } catch (e) { this.d = { ...DEFAULT_SETTINGS }; } },
  save() { try { localStorage.setItem('ce_settings', JSON.stringify(this.d)); } catch (e) { } },
  preset(q) {
    const P = {
      low: { shadows: 0, viewChunks: 4, renderScale: 0.7, traffic: 0.4, peds: 0.4 },
      medium: { shadows: 1, viewChunks: 5, renderScale: 0.85, traffic: 0.7, peds: 0.7 },
      high: { shadows: 2, viewChunks: 6, renderScale: 1, traffic: 1, peds: 1 },
      ultra: { shadows: 3, viewChunks: 8, renderScale: 1.25, traffic: 1.3, peds: 1.3 }
    };
    Object.assign(this.d, P[q] || P.high, { quality: q }); this.save();
  }
};
Settings.load();

/* ---------- entrada ---------- */
const ACTIONS = {
  fwd: 'Avanzar', back: 'Retroceder', left: 'Izquierda', right: 'Derecha', run: 'Correr', jump: 'Saltar / freno de mano',
  crouch: 'Agacharse', wheel: 'Ruleta de armas', interact: 'Interactuar / entrar en vehículo', second: 'Acción secundaria (claxon / agarrar)',
  map: 'Mapa', pause: 'Pausa', reload: 'Recargar', lights: 'Luces del vehículo', phone: 'Móvil (llamar a taxi)', inv: 'Inventario',
  mission: 'Misiones', debug: 'Depuración', camera: 'Cambiar cámara', skip: 'Saltar escena', wardrobe: 'Cambiar de gorra/máscara'
};
const DEFAULT_BINDS = {
  fwd: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], crouch: ['ControlLeft', 'KeyC'], wheel: ['KeyQ', 'Tab'],
  interact: ['KeyE', 'KeyF'], second: ['KeyG'], map: ['KeyM'], pause: ['Escape', 'KeyP'], reload: ['KeyR'], lights: ['KeyL'],
  phone: ['KeyT'], inv: ['KeyI'], mission: ['KeyJ'], debug: ['F3', 'Backquote'], camera: ['KeyV'], skip: ['KeyX'], wardrobe: ['KeyB']
};
const Input = {
  keys: new Set(), pressed: new Set(), released: new Set(), btn: [false, false, false], btnHit: [false, false, false],
  mdx: 0, mdy: 0, wheelD: 0, locked: false, binds: null, pad: { mx: 0, my: 0, lx: 0, ly: 0, fire: 0, aim: 0, on: false, btn: {}, hit: {} },
  loadBinds() {
    let b = {}; try { b = JSON.parse(localStorage.getItem('ce_binds') || '{}'); } catch (e) { }
    this.binds = {}; for (const k in DEFAULT_BINDS) this.binds[k] = (b[k] && b[k].length) ? b[k] : DEFAULT_BINDS[k].slice();
  },
  saveBinds() { try { localStorage.setItem('ce_binds', JSON.stringify(this.binds)); } catch (e) { } },
  resetBinds() { this.binds = {}; for (const k in DEFAULT_BINDS) this.binds[k] = DEFAULT_BINDS[k].slice(); this.saveBinds(); },
  down(a) { const b = this.binds[a] || []; for (const k of b) if (this.keys.has(k)) return true; return !!this.pad.btn[a]; },
  hit(a) { const b = this.binds[a] || []; for (const k of b) if (this.pressed.has(k)) return true; return !!this.pad.hit[a]; },
  fire() { return this.btn[0] || this.pad.fire > 0.4; },
  fireHit() { return this.btnHit[0]; },
  aim() { return this.btn[2] || this.pad.aim > 0.4; },
  moveAxis() {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0), y = (this.down('fwd') ? 1 : 0) - (this.down('back') ? 1 : 0);
    x += this.pad.mx; y += -this.pad.my;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  },
  lookDelta() {
    const s = 0.0022 * Settings.d.sens;
    let dx = this.mdx * s + this.pad.lx * 0.045 * Settings.d.sens, dy = this.mdy * s + this.pad.ly * 0.035 * Settings.d.sens;
    this.mdx = 0; this.mdy = 0; return { dx, dy: Settings.d.invertY ? -dy : dy };
  },
  endFrame() { this.pressed.clear(); this.released.clear(); this.btnHit = [false, false, false]; this.wheelD = 0; this.pad.hit = {}; },
  poll() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (const g of gps) if (g && g.connected) { gp = g; break; }
    const P = this.pad;
    if (!gp) { P.on = false; P.mx = P.my = P.lx = P.ly = P.fire = P.aim = 0; P.btn = {}; return; }
    P.on = true;
    const dz = v => Math.abs(v) < 0.16 ? 0 : v;
    P.mx = dz(gp.axes[0] || 0); P.my = dz(gp.axes[1] || 0); P.lx = dz(gp.axes[2] || 0); P.ly = dz(gp.axes[3] || 0);
    P.aim = gp.buttons[6] ? gp.buttons[6].value : 0; P.fire = gp.buttons[7] ? gp.buttons[7].value : 0;
    const map = { 0: 'jump', 1: 'crouch', 2: 'reload', 3: 'interact', 4: 'wheel', 8: 'map', 9: 'pause', 10: 'run', 12: 'fwd', 13: 'back' };
    const nb = {};
    for (const i in map) { const on = gp.buttons[i] && gp.buttons[i].pressed; nb[map[i]] = on; if (on && !P.btn[map[i]]) P.hit[map[i]] = true; }
    P.btn = nb;
  },
  init(el) {
    this.loadBinds();
    addEventListener('keydown', e => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F3'].includes(e.code) || (e.ctrlKey && e.code === 'KeyW') === false && ['Backquote'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => { this.keys.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.btn = [false, false, false]; });
    el.addEventListener('mousedown', e => { this.btn[e.button] = true; this.btnHit[e.button] = true; if (!this.locked && G.playing && !G.uiOpen) el.requestPointerLock && el.requestPointerLock(); });
    addEventListener('mouseup', e => { this.btn[e.button] = false; });
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => { if (this.locked) { this.mdx += e.movementX; this.mdy += e.movementY; } });
    addEventListener('wheel', e => { this.wheelD += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; });
  }
};

/* ---------- audio procedural (WebAudio): no depende de ficheros ---------- */
const Aud = {
  ctx: null, ok: false, layers: {}, mood: { scale: 'spain', tension: 0 }, _beat: 0, _eng: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.connect(this.master);
    this.amb = c.createGain(); this.amb.connect(this.master);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.55 + last * 3; }
    this.noise = b;
    const mk = (name, type, f, q) => {
      const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.loopStart = Math.random();
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1;
      const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.amb); s.start();
      this.layers[name] = { g, f: fl, t: 0 };
    };
    mk('wind', 'bandpass', 520, 0.5); mk('sea', 'lowpass', 650, 0.7); mk('traffic', 'lowpass', 240, 0.6);
    mk('crowd', 'bandpass', 950, 0.8); mk('rain', 'highpass', 2600, 0.4); mk('market', 'bandpass', 1500, 1.1); mk('night', 'highpass', 5000, 3);
    // motor
    const o1 = c.createOscillator(), o2 = c.createOscillator(), ef = c.createBiquadFilter(), eg = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; ef.type = 'lowpass'; ef.frequency.value = 500; eg.gain.value = 0;
    o1.connect(ef); o2.connect(ef); ef.connect(eg); eg.connect(this.sfx); o1.start(); o2.start();
    this._eng = { o1, o2, ef, eg };
    // sirena
    const so = c.createOscillator(), sl = c.createOscillator(), slg = c.createGain(), sg = c.createGain();
    so.type = 'square'; so.frequency.value = 760; sl.frequency.value = 0.9; slg.gain.value = 220; sg.gain.value = 0;
    sl.connect(slg); slg.connect(so.frequency); const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800;
    so.connect(sf); sf.connect(sg); sg.connect(this.sfx); so.start(); sl.start(); this._siren = { g: sg };
    this.setVolumes(); this.ok = true;
    this._mt = setInterval(() => SafeRun.run('musica', () => this.musicTick()), 480);
  },
  setVolumes() {
    if (!this.ctx) return; const s = Settings.d;
    this.master.gain.value = s.vMaster; this.sfx.gain.value = s.vSfx; this.mus.gain.value = s.vMusic * 0.5; this.amb.gain.value = s.vSfx * 0.9;
  },
  ambient(o) { // {wind,sea,traffic,crowd,rain,market,night} 0..1
    if (!this.ok) return;
    for (const k in this.layers) this.layers[k].t = o[k] || 0;
  },
  update(dt) {
    if (!this.ok) return;
    const now = this.ctx.currentTime;
    for (const k in this.layers) {
      const L = this.layers[k]; L.cur = (L.cur === undefined ? 0 : L.cur) + (L.t - (L.cur || 0)) * Math.min(1, dt * 1.5);
      L.g.gain.setTargetAtTime(L.cur * (k === 'rain' ? 0.5 : k === 'night' ? 0.03 : 0.35), now, 0.1);
    }
  },
  engine(on, rpm, load) {
    if (!this._eng) return; const e = this._eng, t = this.ctx.currentTime;
    const f = 38 + rpm * 120;
    e.o1.frequency.setTargetAtTime(f, t, 0.05); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    e.ef.frequency.setTargetAtTime(280 + rpm * 900 + load * 500, t, 0.08);
    e.eg.gain.setTargetAtTime(on ? 0.05 + load * 0.05 + rpm * 0.03 : 0, t, 0.1);
  },
  siren(v) { if (this._siren) this._siren.g.gain.setTargetAtTime(v * 0.045, this.ctx.currentTime, 0.2); },
  burst(dur, f, q, vol, type = 'lowpass', sweep = 0) {
    if (!this.ok) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start(c.currentTime, Math.random() * 1.5); s.stop(c.currentTime + dur + 0.05);
  },
  tone(f, dur, vol, type = 'sine', dest, when = 0, glide = 0) {
    if (!this.ok) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type;
    const t0 = c.currentTime + when; o.frequency.setValueAtTime(f, t0); if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.08, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  shot(kind, vol = 1) {
    const K = { pistol: [0.18, 2200, 1, 0.5], smg: [0.12, 2600, 1, 0.4], shotgun: [0.35, 1400, 1, 0.9], rifle: [0.25, 1800, 1, 0.7], melee: [0.1, 400, 1, 0.3] }[kind] || [0.15, 2000, 1, 0.5];
    this.burst(K[0], K[1], K[2], K[3] * vol, 'lowpass', 0.25);
  },
  step(surf = 0, vol = 0.3) { this.burst(0.06, surf === 1 ? 900 : 500, 1, vol * 0.4, 'lowpass'); },
  crash(v) { this.burst(0.4, 900, 1, clamp(v / 20, 0.1, 1) * 0.8, 'lowpass', 0.3); },
  ui(k = 0) { this.tone(k === 1 ? 520 : k === 2 ? 300 : 720, 0.08, 0.12, 'triangle'); },
  horn() { this.tone(420, 0.4, 0.15, 'sawtooth'); this.tone(530, 0.4, 0.12, 'sawtooth'); },
  splash(v = 0.5) { this.burst(0.5, 1500, 0.8, v * 0.6, 'bandpass', 0.4); },
  explosion() { this.burst(1.3, 500, 1, 1.2, 'lowpass', 0.1); },
  thunder() { this.burst(2.5, 260, 1, 1, 'lowpass', 0.3); },
  coin() { this.tone(988, 0.12, 0.15, 'square'); this.tone(1318, 0.25, 0.15, 'square', null, 0.1); },
  musicTick() {
    if (!this.ok || Settings.d.vMusic <= 0.01) return;
    const S = { spain: [0, 1, 4, 5, 7, 8, 10], mor: [0, 1, 4, 5, 7, 8, 11], gili: [0, 2, 3, 5, 7, 8, 10], tension: [0, 1, 3, 6, 7, 10], calm: [0, 2, 4, 7, 9] }[this.mood.tension > 0.5 ? 'tension' : this.mood.scale] || [0, 2, 4, 7, 9];
    const root = this.mood.root || 220; this._beat++;
    const note = d => root * Math.pow(2, S[d % S.length] / 12) * (d >= S.length ? 2 : 1);
    if (this._beat % 8 === 1) { for (let i = 0; i < 3; i++) this.tone(note(i * 2) * 0.5, 4.5, 0.05, 'triangle', this.mus); }
    if (Math.random() < 0.55 - this.mood.tension * 0.2) this.tone(note((Math.random() * 9) | 0), 1.6, 0.045, 'sine', this.mus, 0, 1);
    if (this.mood.tension > 0.5 && this._beat % 2 === 0) this.tone(root * 0.25, 0.3, 0.1, 'sawtooth', this.mus);
  }
};