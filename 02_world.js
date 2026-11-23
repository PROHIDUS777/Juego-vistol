/* ==========================================================================
   CIUDAD ESTRECHO · MÓDULO 02 · MUNDO (lógica pura, sin THREE)
   Geografía, regiones, ciudades con distritos, red viaria con puentes y
   túneles, grafo de navegación (tráfico, policía, GPS), POIs.
   Convención: x = este, z = sur (el norte es -z), y = arriba. Unidades: metros.
   ========================================================================== */
const WORLD = { minX: -6500, maxX: 6500, minZ: -9600, maxZ: 7800 };
const CH = 256; // tamaño de sector (chunk)
const tick = () => new Promise(r => setTimeout(r, 0));

/* ---------------- costas y relieve ---------------- */
const coastN = x => 150 + 300 * (fbm(x * 0.0007 + 10, 3.3, 4, 5) * 2 - 1) + 140 * Math.sin(x * 0.0011 + 0.5);   // costa española (norte del Estrecho)
const coastS = x => 3550 + 260 * (fbm(x * 0.0006 + 40, 7.7, 4, 6) * 2 - 1) + 130 * Math.sin(x * 0.0013 + 1.0);  // costa africana
const shoreProfile = d => -62 + 64 * Math.pow(sstep(-420, 10, d), 1.5);
const MT = { x: -1900, z: -3600, rx: 3000, rz: 1800 };            // macizo de Catetos de Monte
const ISL = { x: 2650, z: 1850, rx: 1350, rz: 780 };              // isla de Gililondon

const CITIES = [];
function defCity(o) {
  const c = Object.assign({ flat: 1, warp: 8, avenue: 4, seed: 1, angle: 0, parkChance: 0.04, plazaChance: 0.03, districts: [], inner: 'Barrio residencial', innerT: 'residential', outer: 'Afueras', outerT: 'periphery', valley: false, big: false }, o);
  CITIES.push(c); return c;
}
const cityById = id => CITIES.find(c => c.id === id);
function valleyK(x, z) {
  let k = 1;
  for (const c of CITIES) if (c.valley) { const d = Math.hypot(x - c.cx, z - c.cz); if (d < c.R * 1.7) k = Math.min(k, 1 - 0.88 * sstep(c.R * 1.7, c.R * 0.45, d)); }
  return k;
}
function mtnMask(x, z) {
  const e = Math.hypot((x - MT.x) / MT.rx, (z - MT.z) / MT.rz) + 0.28 * (fbm(x * 0.0009, z * 0.0009, 3, 23) * 2 - 1);
  return sstep(1.0, 0.3, e);
}
function spainH(x, z) {
  const d = coastN(x) - z;
  let h = shoreProfile(d);
  const plat = sstep(-1400, -5600, z);
  h += sstep(0, 1200, d) * (20 + plat * 125);
  h += (fbm(x * 0.0017, z * 0.0017, 5, 11) * 2 - 1) * (10 + 34 * (1 - plat) * sstep(80, 1000, d) + 18 * plat) * sstep(-10, 160, d);
  const cl = sstep(0.6, 0.75, vnoise(x * 0.0011, 1.7, 3));
  h += cl * 26 * sstep(5, 75, d) * (1 - sstep(300, 700, d));        // acantilados costeros
  const M = mtnMask(x, z);
  if (M > 0.001) {
    const wx = x + 380 * (fbm(x * 0.0008, z * 0.0008, 3, 21) - 0.5), wz = z + 380 * (fbm(x * 0.0008 + 9, z * 0.0008 + 9, 3, 22) - 0.5);
    const rg = ridge(wx * 0.0011, wz * 0.0011, 6, 31), body = fbm(x * 0.0007, z * 0.0007, 4, 41);
    const mv = M * valleyK(x, z);
    h += mv * (70 + 540 * rg * (0.5 + 0.8 * body)) + mv * 26 * (fbm(x * 0.012, z * 0.012, 3, 51) * 2 - 1);
  }
  return h;
}
function africaH(x, z) {
  const d = z - coastS(x);
  let h = shoreProfile(d);
  h += sstep(0, 1300, d) * 18;
  h += (fbm(x * 0.0018, z * 0.0018, 5, 61) * 2 - 1) * (8 + 40 * sstep(200, 1600, d)) * sstep(-10, 160, d);
  const cl = sstep(0.6, 0.74, vnoise(x * 0.0012, 9.1, 4));
  h += cl * 30 * sstep(5, 70, d) * (1 - sstep(300, 700, d));
  const R = Math.max(sstep(5200, 6600, z), 0.85 * sstep(3000, 4600, x) * sstep(4300, 5300, z));
  if (R > 0.001) {
    const wx = x + 320 * (fbm(x * 0.001, z * 0.001, 3, 71) - 0.5), wz = z + 320 * (fbm(x * 0.001 + 5, z * 0.001 + 5, 3, 72) - 0.5);
    const rg = ridge(wx * 0.0012, wz * 0.0012, 6, 73);
    h += R * valleyK(x, z) * (60 + 560 * rg * (0.5 + 0.8 * fbm(x * 0.0008, z * 0.0008, 3, 74))) + R * 20 * (fbm(x * 0.01, z * 0.01, 3, 75) * 2 - 1);
  }
  return h;
}
function islandR(x, z) {
  const r = Math.hypot((x - ISL.x) / ISL.rx, (z - ISL.z) / ISL.rz);
  return r * (1 + 0.20 * (fbm(x * 0.0014, z * 0.0014, 4, 77) * 2 - 1));
}
function islandH(x, z, r) {
  const s = 1 - r;
  let h = -48 + 54 * Math.pow(sstep(0, 0.10, s), 1.2);
  const nw = clamp(-(((x - ISL.x) / ISL.rx) * 0.55 + ((z - ISL.z) / ISL.rz) * 0.85), 0, 1);
  h += nw * 38 * sstep(0.02, 0.09, s);                                  // acantilados NO
  const inl = sstep(0.1, 0.75, s), rg = ridge(x * 0.0016, z * 0.0016, 5, 91);
  h += inl * valleyK(x, z) * (40 + 250 * rg * (0.5 + 0.6 * fbm(x * 0.001, z * 0.001, 3, 92)));
  h += (fbm(x * 0.006, z * 0.006, 4, 93) - 0.5) * 10 * sstep(0.1, 0.3, s);
  return h;
}
function baseH(x, z) {
  const mid = (coastN(x) + coastS(x)) / 2;
  let h = z < mid ? spainH(x, z) : africaH(x, z);
  if (h < -30) h += (fbm(x * 0.003, z * 0.003, 3, 81) - 0.5) * 14;
  const ir = islandR(x, z);
  if (ir < 1.0) h = Math.max(h, islandH(x, z, ir));
  const ed = Math.min(x - WORLD.minX, WORLD.maxX - x, z - WORLD.minZ, WORLD.maxZ - z);
  if (ed < 500) h = lerp(-70, h, sstep(0, 500, ed));
  return h;
}
const _lat = new Map();
function latH(ix, iz) { const k = ix * 100003 + iz; let v = _lat.get(k); if (v === undefined) { v = baseH(ix * 64, iz * 64); _lat.set(k, v); if (_lat.size > 300000) _lat.clear(); } return v; }
function smoothH(x, z) {
  const fx = x / 64, fz = z / 64, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  return lerp(lerp(latH(ix, iz), latH(ix + 1, iz), tx), lerp(latH(ix, iz + 1), latH(ix + 1, iz + 1), tx), tz);
}
const FLATS = []; // zonas aplanadas (aeropuertos, puertos, etc.) {x,z,r,y?}
function flatten(x, z, h) {
  for (const c of CITIES) {
    const dx = x - c.cx, dz = z - c.cz, lim = c.R * 1.3 + 120;
    if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
    const d = Math.hypot(dx, dz), m = sstep(c.R * 1.12 + 100, c.R * 0.85, d) * c.flat;
    if (m > 0) h = lerp(h, smoothH(x, z), m * sstep(0.6, 4.5, h));
  }
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z); if (d > f.r * 1.8) continue;
    const m = sstep(f.r * 1.7, f.r, d); if (m > 0) h = lerp(h, f.y !== undefined ? f.y : smoothH(f.x, f.z), m);
  }
  return h;
}
const hLand = (x, z) => flatten(x, z, baseH(x, z));

/* ---------------- estructura espacial para carreteras y ríos ---------------- */
class SegHash {
  constructor(cell) { this.cell = cell; this.map = new Map(); this.segs = []; }
  add(s, infl) {
    const i = this.segs.length; this.segs.push(s);
    const x0 = Math.min(s.ax, s.bx) - infl, x1 = Math.max(s.ax, s.bx) + infl, z0 = Math.min(s.az, s.bz) - infl, z1 = Math.max(s.az, s.bz) + infl;
    for (let cx = Math.floor(x0 / this.cell); cx <= Math.floor(x1 / this.cell); cx++)
      for (let cz = Math.floor(z0 / this.cell); cz <= Math.floor(z1 / this.cell); cz++) {
        const k = cx * 65536 + cz; let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(i);
      }
  }
  nearest(x, z) {
    const a = this.map.get(Math.floor(x / this.cell) * 65536 + Math.floor(z / this.cell)); if (!a) return null;
    let best = null, bd = 1e12;
    for (let j = 0; j < a.length; j++) {
      const s = this.segs[a[j]], dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz || 1;
      let t = ((x - s.ax) * dx + (z - s.az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.ax + dx * t - x, pz = s.az + dz * t - z, d2 = px * px + pz * pz;
      const lim = s.hw + s.sh; if (d2 < lim * lim && d2 < bd) { bd = d2; best = { seg: s, t, d: Math.sqrt(d2) }; }
    }
    if (best) best.y = lerp(best.seg.ay, best.seg.by, best.t);
    return best;
  }
}
const ROAD_HASH = new SegHash(48), RIVER_HASH = new SegHash(48);
const ROADS = [], RIVERS = [], PLATFORMS = [], PORTS = [], AIRPORTS = [], LANDMARKS = [];

function hRiver(x, z) {
  let h = hLand(x, z);
  const r = RIVER_HASH.nearest(x, z);
  if (r) {
    const s = r.seg, target = r.y + 0.35 * Math.max(0, r.d - s.hw * 0.6), w = sstep(s.hw + s.sh, s.hw * 0.4, r.d);
    h = lerp(h, Math.min(h, target), w);
  }
  return h;
}
function H(x, z) {
  let h = hRiver(x, z);
  const r = ROAD_HASH.nearest(x, z);
  if (r && r.seg.kind === 0) h = lerp(h, r.y, sstep(r.seg.hw + r.seg.sh, r.seg.hw + 0.8, r.d));
  return h;
}
/* superficie de la carretera bajo (x,z): y del firme, o null si no hay carretera */
function roadSurface(x, z, yRef) {
  const r = ROAD_HASH.nearest(x, z);
  if (r && r.d <= r.seg.hw + 0.5) { if (r.seg.kind === 0 || yRef === undefined || Math.abs(yRef - r.y) < 6) return { y: r.y, kind: r.seg.kind, road: r.seg.road, d: r.d }; }
  return null;
}

/* ---------------- ciudades (datos) ---------------- */
function initCityDefs() {
  if (CITIES.length) return;
  defCity({
    id: 'caleta', name: 'Caleta del Marfil', region: 'caleta', style: 'caleta', cx: 1000, cz: coastN(1000) - 470, R: 1050, angle: -0.2, B: 72, hw: 5.5, warp: 12, seed: 11, big: true,
    inner: 'Barrio residencial', innerT: 'residential', outer: 'Afueras', outerT: 'periphery',
    districts: [
      { n: 'Centro histórico', t: 'historic', dx: -30, dz: -80, r: 240 }, { n: 'Paseo marítimo', t: 'tourist', dx: 0, dz: 400, r: 300 },
      { n: 'Centro comercial Marfil', t: 'commercial', dx: 520, dz: -60, r: 170 }, { n: 'Barrios populares', t: 'popular', dx: -560, dz: -40, r: 290 },
      { n: 'Urbanización Las Colinas', t: 'villa', dx: -200, dz: -640, r: 360 }, { n: 'Polígono industrial', t: 'industrial', dx: 640, dz: -560, r: 300 },
      { n: 'Parque del Marfil', t: 'park', dx: 100, dz: 130, r: 95 }, { n: 'Puerto', t: 'port', dx: 460, dz: 420, r: 190 }, { n: 'Plaza Mayor del Marfil', t: 'plaza', dx: -30, dz: -30, r: 50 }]
  });
  defCity({
    id: 'catetos', name: 'Catetos de Monte', region: 'catetos', style: 'catetos', cx: -1900, cz: -3550, R: 520, angle: 0.5, B: 60, hw: 4.2, warp: 16, seed: 22, valley: true, avenue: 5,
    inner: 'Barrio del Monte', innerT: 'residential', outer: 'Fincas y cortijos', outerT: 'rural',
    districts: [{ n: 'Casco antiguo', t: 'historic', dx: 0, dz: 0, r: 170 }, { n: 'Plaza del Pueblo', t: 'plaza', dx: 20, dz: 10, r: 45 }, { n: 'Barrio Alto', t: 'residential', dx: 190, dz: -170, r: 150 }, { n: 'Almacenes y establos', t: 'industrial', dx: -230, dz: 200, r: 90 }, { n: 'Prado comunal', t: 'park', dx: -110, dz: -150, r: 50 }]
  });
  defCity({
    id: 'madrid', name: 'Madrid', region: 'madrid', style: 'madrid', cx: -450, cz: -6900, R: 1500, angle: 0.12, B: 84, hw: 7, warp: 10, seed: 33, big: true, avenue: 3,
    inner: 'Barrio residencial', innerT: 'residential', outer: 'Barrios periféricos', outerT: 'periphery',
    districts: [
      { n: 'Puerta del Sol', t: 'center', dx: 0, dz: 0, r: 150 }, { n: 'Plaza Mayor', t: 'plaza', dx: -130, dz: 70, r: 55 }, { n: 'Centro histórico', t: 'historic', dx: -30, dz: 20, r: 380 },
      { n: 'Gran Vía', t: 'commercial', dx: 190, dz: -170, r: 170 }, { n: 'Distrito financiero', t: 'financial', dx: 520, dz: -650, r: 270 }, { n: 'Parque del Retiro', t: 'park', dx: 420, dz: 300, r: 200 },
      { n: 'Estación de Atocha', t: 'station', dx: -190, dz: 540, r: 110 }, { n: 'Zona comercial Castellana', t: 'commercial', dx: -520, dz: -300, r: 210 },
      { n: 'Parque de la ribera', t: 'park', dx: -950, dz: 920, r: 150 }, { n: 'Parque de la ribera', t: 'park', dx: 360, dz: 1000, r: 140 }, { n: 'Polígono del norte', t: 'industrial', dx: -200, dz: -1000, r: 220 }]
  });
  defCity({
    id: 'gili', name: 'Gililondon', region: 'gili', style: 'gili', cx: 2450, cz: 1500, R: 480, angle: 0.35, B: 52, hw: 4.5, warp: 8, seed: 44, big: true, avenue: 4,
    inner: 'Barrio residencial', innerT: 'residential', outer: 'Urbanizaciones', outerT: 'villa',
    districts: [{ n: 'Centro histórico', t: 'historic', dx: -20, dz: 20, r: 150 }, { n: 'Centro financiero', t: 'financial', dx: 150, dz: -100, r: 110 }, { n: 'Puerto internacional', t: 'port', dx: -90, dz: -330, r: 140 },
    { n: 'Distrito comercial', t: 'commercial', dx: -210, dz: 70, r: 100 }, { n: 'Zona turística', t: 'tourist', dx: -40, dz: -200, r: 110 }, { n: 'Zona industrial', t: 'industrial', dx: 330, dz: 160, r: 110 }, { n: 'Hyde Green', t: 'park', dx: 80, dz: 140, r: 55 }]
  });
  defCity({
    id: 'babelmar', name: 'Bab el Mar', region: 'marruecos', style: 'marruecos', cx: 500, cz: coastS(500) + 560, R: 900, angle: 0.3, B: 66, hw: 5.5, warp: 12, seed: 55, big: true, avenue: 4,
    inner: 'Ciudad moderna', innerT: 'modern', outer: 'Barrios del extrarradio', outerT: 'periphery',
    districts: [{ n: 'Antigua medina', t: 'medina', dx: -60, dz: -120, r: 190 }, { n: 'Mercado central', t: 'plaza', dx: -20, dz: -60, r: 50 }, { n: 'Puerto pesquero', t: 'port', dx: 120, dz: -470, r: 170 }, { n: 'Corniche', t: 'tourist', dx: 150, dz: -380, r: 200 },
    { n: 'Zona comercial', t: 'commercial', dx: 360, dz: 120, r: 190 }, { n: 'Barrios populares', t: 'popular', dx: -400, dz: 180, r: 250 }, { n: 'Zona industrial', t: 'industrial', dx: 450, dz: 520, r: 200 }, { n: 'Jardines de la ciudad', t: 'park', dx: 180, dz: 40, r: 70 }]
  });
  defCity({
    id: 'medina', name: 'Medina Sidi Ráhal', region: 'marruecos', style: 'marruecos', cx: 2300, cz: 5300, R: 420, angle: 0.15, B: 40, hw: 3.2, warp: 14, seed: 66, avenue: 6, flat: 0.8,
    inner: 'Medina', innerT: 'medina', outer: 'Ensanche', outerT: 'popular',
    districts: [{ n: 'Medina vieja', t: 'medina', dx: 0, dz: 0, r: 250 }, { n: 'Gran zoco', t: 'plaza', dx: 20, dz: -20, r: 45 }, { n: 'Barrio nuevo', t: 'modern', dx: 300, dz: 150, r: 120 }]
  });
  defCity({
    id: 'ainzitun', name: 'Ain Zitún', region: 'marruecos', style: 'marruecos', cx: -1500, cz: coastS(-1500) + 420, R: 330, angle: -0.1, B: 46, hw: 3.8, warp: 10, seed: 77, avenue: 5,
    inner: 'Barrio de Ain Zitún', innerT: 'popular', outer: 'Huertas', outerT: 'rural',
    districts: [{ n: 'Zoco de Ain Zitún', t: 'medina', dx: 20, dz: 20, r: 110 }, { n: 'Plaza del mercado', t: 'plaza', dx: 30, dz: 30, r: 40 }, { n: 'Barrio del puerto', t: 'port', dx: 0, dz: -250, r: 90 }]
  });
  const S = (id, name, region, style, cx, cz, R, o) => defCity(Object.assign({ id, name, region, style, cx, cz, R, angle: rnd(0, 1) * 0 + hash2(cx, cz, 5) * 1.2, B: 44, hw: 3.4, warp: 10, seed: 100 + CITIES.length, avenue: 6, inner: 'Casco del pueblo', innerT: 'residential', outer: 'Fincas', outerT: 'rural', flat: 0.9 }, o || {}));
  S('villanueva', 'Villanueva del Olivar', 'caleta', 'catetos', 2200, -3100, 240, { districts: [{ n: 'Plaza de la Iglesia', t: 'plaza', dx: 0, dz: 0, r: 40 }] });
  S('venta', 'Venta Ciega', 'caleta', 'catetos', -1100, -1300, 190);
  S('aldea', 'Aldea de Arriba', 'catetos', 'catetos', -3100, -3000, 160, { valley: true });
  S('cortijos', 'Los Cortijos', 'catetos', 'catetos', -1200, -4800, 150, { valley: true });
  S('calahonda', 'Cala Honda', 'caleta', 'caleta', -2400, coastN(-2400) - 330, 220, { districts: [{ n: 'Puerto de Cala Honda', t: 'port', dx: 0, dz: 150, r: 70 }] });
  S('santamarina', 'Santa Marina', 'gili', 'gili', 3250, 2350, 200);
  S('puntafaro', 'Punta Faro', 'gili', 'gili', 1900, 2000, 170);
  S('tazra', 'Tazra', 'marruecos', 'marruecos', -800, 6800, 170, { valley: true });
  S('beniyusef', 'Beni Yusef', 'marruecos', 'marruecos', 1800, 7000, 160, { valley: true });
  S('douar', 'Douar Zeitoun', 'marruecos', 'marruecos', 3500, 4300, 150);
  for (const c of CITIES) {
    c.cos = Math.cos(c.angle); c.sin = Math.sin(c.angle);
    const K = Math.ceil(c.R / c.B) + 1; c.K = K; c.lineU = []; c.lineV = [];
    for (let i = -K; i <= K; i++) { c.lineU[i + K] = i * c.B + (hash2(i, 1, c.seed) - 0.5) * c.warp; c.lineV[i + K] = i * c.B + (hash2(i, 2, c.seed) - 0.5) * c.warp; }
    c.blocks = new Map(); c.nodeMap = new Map(); c.nodes = [];
  }
}
const cityToWorld = (c, u, v) => ({ x: c.cx + u * c.cos - v * c.sin, z: c.cz + u * c.sin + v * c.cos });
const cityToLocal = (c, x, z) => { const dx = x - c.cx, dz = z - c.cz; return { u: dx * c.cos + dz * c.sin, v: -dx * c.sin + dz * c.cos }; };
const isAve = (c, i) => (((i % c.avenue) + c.avenue) % c.avenue) === 0;
const lineHW = (c, i) => isAve(c, i) ? c.hw * 1.7 : c.hw;
function zoneAt(c, x, z) {
  let best = null, bs = 1e9;
  for (const d of c.districts) { const s = Math.hypot(x - (c.cx + d.dx), z - (c.cz + d.dz)) / d.r; if (s < 1 && s < bs) { bs = s; best = d; } }
  if (best) return best;
  const dist = Math.hypot(x - c.cx, z - c.cz) / c.R;
  return dist > 0.68 ? { n: c.outer, t: c.outerT } : { n: c.inner, t: c.innerT };
}
function cityAt(x, z, pad = 0) {
  for (const c of CITIES) { const d = Math.hypot(x - c.cx, z - c.cz); if (d < c.R + pad) return c; }
  return null;
}
function regionAt(x, z) {
  if (islandR(x, z) < 1.12) return 'gili';
  const n = coastN(x), s = coastS(x);
  if (z < n + 60) {
    const dc = Math.hypot(x - 1000, z + 350) / 1.4, dk = Math.hypot(x + 1900, z + 3550) / 1.1, dm = Math.hypot(x + 450, z + 6900) / 1.7;
    return dm < dc && dm < dk ? 'madrid' : dk < dc ? 'catetos' : 'caleta';
  }
  if (z > s - 60) return 'marruecos';
  return 'estrecho';
}
const REGION_NAMES = { caleta: 'Caleta del Marfil', catetos: 'Catetos de Monte', madrid: 'Madrid', gili: 'Gililondon', marruecos: 'Marruecos', estrecho: 'Estrecho de Gibraltar' };

/* ---------------- bloques y parcelas de ciudad ---------------- */
function blockInfo(c, k, l) {
  const key = k * 4096 + l; let b = c.blocks.get(key); if (b !== undefined) return b;
  b = null;
  if (k >= -c.K && k < c.K && l >= -c.K && l < c.K) {
    const U0 = c.lineU[k + c.K] + lineHW(c, k), U1 = c.lineU[k + 1 + c.K] - lineHW(c, k + 1), V0 = c.lineV[l + c.K] + lineHW(c, l), V1 = c.lineV[l + 1 + c.K] - lineHW(c, l + 1);
    if (U1 - U0 > 14 && V1 - V0 > 14) {
      const cu = (U0 + U1) / 2, cv = (V0 + V1) / 2, w = cityToWorld(c, cu, cv), dist = Math.hypot(w.x - c.cx, w.z - c.cz);
      if (dist < c.R * 0.97) {
        const hc = hLand(w.x, w.z);
        const cs = [cityToWorld(c, U0, V0), cityToWorld(c, U1, V0), cityToWorld(c, U0, V1), cityToWorld(c, U1, V1)];
        let ok = hc > 1.8; for (const p of cs) if (hLand(p.x, p.z) < 0.9) ok = false;
        if (ok && RIVER_HASH.nearest(w.x, w.z)) ok = false;
        if (ok) {
          const zone = zoneAt(c, w.x, w.z), r = hash2(k, l, c.seed + 9);
          let kind = 'build';
          if (zone.t === 'park') kind = 'park'; else if (zone.t === 'plaza') kind = 'plaza';
          else if (r < c.parkChance) kind = 'park'; else if (r < c.parkChance + c.plazaChance) kind = 'plaza';
          b = { c, k, l, u0: U0, u1: U1, v0: V0, v1: V1, cu, cv, cx: w.x, cz: w.z, zone, kind, y: hc, lots: null };
        }
      }
    }
  }
  c.blocks.set(key, b); return b;
}
function blockAt(x, z) {
  const c = cityAt(x, z, 20); if (!c) return null;
  const { u, v } = cityToLocal(c, x, z); let k = -1, l = -1;
  for (let i = 0; i < c.lineU.length - 1; i++) if (u >= c.lineU[i] && u < c.lineU[i + 1]) { k = i - c.K; break; }
  for (let i = 0; i < c.lineV.length - 1; i++) if (v >= c.lineV[i] && v < c.lineV[i + 1]) { l = i - c.K; break; }
  if (k < -c.K || l < -c.K || k >= c.K || l >= c.K) return null;
  const b = blockInfo(c, k, l); if (!b) return null;
  return (u >= b.u0 && u <= b.u1 && v >= b.v0 && v <= b.v1) ? b : null;
}
const STYLE_ROOF = { caleta: 'flat', madrid: 'hip', catetos: 'gable', gili: 'gable', marruecos: 'flat' };
const PAL = {
  caleta: { wall: [0xf4f1ea, 0xefe9dc, 0xf7f4ee, 0xe9e3d6, 0xdfe9ee, 0xf3e7d3, 0xeedfc7, 0xf6ede0], roof: [0xb5573a, 0xa64b32, 0xc4673f], acc: [0x2d6a9f, 0x1d8fa8, 0xd9a441, 0xc2462f] },
  catetos: { wall: [0xf1eee6, 0xe6dfd0, 0xb9ab94, 0xa89d88, 0xd8cdb5, 0xf4f0e6], roof: [0xa0462f, 0x8f3f2b, 0xb4573a], acc: [0x6b4a2f, 0x3f5a3a] },
  madrid: { wall: [0xd9c3a0, 0xcfae86, 0xb86e56, 0xc98b6b, 0xe3d6bc, 0xa88e74, 0xd0c7b8, 0xc4a27c], roof: [0x4c5560, 0x3d444d, 0x5a6470], acc: [0x2f3a46, 0x7d2f2a], glass: [0x6f8fa8, 0x5a7a94, 0x7ea0b8, 0x4f6f86] },
  gili: { wall: [0xb5543f, 0x9c4a38, 0xc9bfa5, 0xd8d0bb, 0x8b5a46, 0xa88a70, 0xcdbb98], roof: [0x434a52, 0x555c63, 0x6b3b2e], acc: [0x1f3b5c, 0x6a1e1e], glass: [0x6a8aa0, 0x56778f, 0x7d9db3] },
  marruecos: { wall: [0xe7d2b2, 0xd6b88f, 0xf2e9d8, 0xc9a074, 0xb98a5a, 0xdcc7a3, 0xe9ddc6], roof: [0xd6b88f, 0xc9a074], acc: [0x1f7a8c, 0x2a6f4a, 0xd9a441, 0x2b4f9b], glass: [0x7a95a8, 0x65839a] }
};
const ZSPEC = {
  center: { fl: [3, 5], occ: 1, w: [10, 17], d: [16, 24], shop: 0.35 }, historic: { fl: [3, 6], occ: 1, w: [9, 16], d: [16, 24], shop: 0.3 },
  residential: { fl: [2, 5], occ: 0.95, w: [11, 20], d: [16, 24], shop: 0.05 }, popular: { fl: [2, 4], occ: 1, w: [8, 14], d: [14, 20], shop: 0.12 },
  periphery: { fl: [1, 3], occ: 0.7, w: [12, 22], d: [14, 22], shop: 0.03 }, villa: { fl: [1, 2], occ: 0.55, w: [18, 28], d: [20, 30], foot: [0.55, 0.5], kind: 'villa', shop: 0 },
  tourist: { fl: [4, 10], occ: 1, w: [15, 28], d: [18, 26], shop: 0.28, kind: 'tourist' }, commercial: { fl: [2, 5], occ: 1, w: [16, 34], d: [20, 30], shop: 0.45 },
  industrial: { fl: [1, 2], fh: 6.5, occ: 0.85, w: [28, 50], d: [26, 36], foot: [0.92, 0.88], kind: 'warehouse', shop: 0.12 }, financial: { fl: [14, 40], fh: 3.8, occ: 0.9, w: [24, 36], d: [24, 34], kind: 'tower', shop: 0.1 },
  port: { fl: [1, 2], fh: 7, occ: 0.8, w: [26, 44], d: [24, 32], kind: 'warehouse', shop: 0.2 }, station: { fl: [1, 2], fh: 9, occ: 0.9, w: [40, 60], d: [28, 34], kind: 'warehouse', shop: 0.2 },
  medina: { fl: [2, 3], occ: 1, w: [7, 12], d: [10, 16], shop: 0.38 }, modern: { fl: [4, 8], occ: 0.95, w: [14, 24], d: [18, 26], shop: 0.2 },
  rural: { fl: [1, 2], occ: 0.3, w: [16, 26], d: [18, 28], foot: [0.65, 0.6], kind: 'farm', shop: 0 }
};
const POI_BY_ZONE = {
  center: ['bar', 'restaurant', 'shop', 'bar', 'restaurant', 'peluqueria', 'joyeria', 'hotel', 'discoteca'], historic: ['bar', 'restaurant', 'shop', 'bar', 'restaurant', 'peluqueria', 'hotel', 'mercado'],
  tourist: ['hotel', 'restaurant', 'bar', 'bar', 'shop', 'discoteca', 'restaurant', 'restaurant'], commercial: ['supermercado', 'shop', 'shop', 'joyeria', 'armeria', 'restaurant', 'peluqueria', 'bar'],
  popular: ['bar', 'bar', 'shop', 'taller', 'peluqueria', 'supermercado', 'restaurant'], residential: ['vivienda', 'vivienda', 'bar', 'shop', 'vivienda'], periphery: ['vivienda', 'taller', 'vivienda', 'gasolinera'],
  industrial: ['almacen', 'taller', 'gasolinera', 'almacen'], financial: ['oficina', 'oficina', 'restaurant', 'hotel'], port: ['almacen', 'bar', 'restaurant', 'oficina', 'almacen'],
  medina: ['shop', 'mercado', 'shop', 'restaurant', 'bar', 'peluqueria', 'taller', 'vivienda'], modern: ['supermercado', 'shop', 'oficina', 'restaurant', 'bar', 'hotel'], villa: ['vivienda'], rural: ['vivienda', 'taller']
};
const SPECIAL_POI = ['armeria', 'joyeria', 'gasolinera', 'hotel', 'supermercado', 'peluqueria', 'taller'];
const POI_NAMES = {
  caleta: { bar: ['Bar El Espeto', 'Bar La Caleta', 'Taberna Marfil', 'Bar Los Boquerones', 'Chiringuito Playa Blanca'], restaurant: ['Restaurante El Pescaíto', 'Marisquería Marfil', 'Casa Paella', 'Mesón del Puerto', 'Asador Las Tapas'], shop: ['Tienda La Sombrilla', 'Moda Costa', 'Souvenirs Marfil', 'Boutique Mediterráneo'], hotel: ['Hotel Marfil Beach', 'Hotel Costa Blanca', 'Hostal La Caleta'] },
  catetos: { bar: ['Bar El Cateto', 'Taberna del Monte', 'Bar La Venta', 'Bodega Los Cortijos'], restaurant: ['Mesón de las Migas', 'Restaurante El Chivo', 'Casa Rural La Sierra', 'Asador del Monte'], shop: ['Ultramarinos Pepe', 'Quesería del Valle', 'Embutidos Ibéricos', 'Tienda de la Plaza'], hotel: ['Casa Rural El Olivar', 'Posada del Monte'] },
  madrid: { bar: ['Cervecería Gran Vía', 'Bar Los Calamares', 'Taberna La Latina', 'Bar Sol y Sombra'], restaurant: ['Casa del Cocido', 'Restaurante Callos y Más', 'Chocolatería San Ginés', 'Mesón Plaza Mayor'], shop: ['Galerías Castellana', 'Moda Gran Vía', 'Librería Cibeles', 'Tienda Retiro'], hotel: ['Hotel Plaza Mayor', 'Hotel Gran Vía', 'Hotel Castellana'] },
  gili: { bar: ['The Anchor Pub', 'The Gili Arms', 'Bar Union', 'The Salty Dog'], restaurant: ['Gili Fish & Chips', 'The Harbour Grill', 'Bakery & Tea Rooms', 'International Kitchen'], shop: ['Gili Gifts', 'The Corner Shop', 'Tweed & Co.', 'Bookshop on the Quay'], hotel: ['Gili Grand Hotel', 'The Harbour Inn'] },
  marruecos: { bar: ['Café Medina', 'Café de la Plaza', 'Salón de Té Andalus', 'Café del Mar'], restaurant: ['Tajín Dar Zitún', 'Restaurante Al Andalus', 'Casa del Cuscús', 'Pastela y Harira'], shop: ['Alfombras Rif', 'Cerámica Fez', 'Especias del Zoco', 'Artesanía Tazra'], hotel: ['Riad Zitún', 'Hotel Corniche', 'Riad Sidi Ráhal'] }
};
const POI_GENERIC = {
  supermercado: n => ({ caleta: 'Supermercado Marfil', catetos: 'Ultramarinos El Monte', madrid: 'Supermercado Centro', gili: 'Gili Supermarket', marruecos: 'Hanout Al Baraka' }[n]),
  taller: n => ({ caleta: 'Taller Mecánico Marfil', catetos: 'Taller El Cateto', madrid: 'Taller Castellana', gili: 'Gili Auto Repairs', marruecos: 'Taller Ben Ali' }[n]),
  armeria: n => ({ caleta: 'Armería La Caleta', catetos: 'Armería Cinegética', madrid: 'Armería Real', gili: 'Gili Sporting Arms', marruecos: 'Armería Atlas' }[n]),
  joyeria: n => ({ caleta: 'Joyería Marfil', catetos: 'Joyería El Oro', madrid: 'Joyería Cibeles', gili: 'Gili Jewellers', marruecos: 'Joyería Zahra' }[n]),
  peluqueria: n => ({ caleta: 'Peluquería Costa', catetos: 'Peluquería Pili', madrid: 'Barbería Sol', gili: 'The Barber Shop', marruecos: 'Salón Al Jamal' }[n]),
  gasolinera: n => ({ caleta: 'Gasolinera Marfil', catetos: 'Gasolinera El Monte', madrid: 'Gasolinera M-30', gili: 'Gili Fuel', marruecos: 'Station Atlas' }[n]),
  discoteca: n => ({ caleta: 'Discoteca Ola Blanca', catetos: 'Sala El Granero', madrid: 'Sala Gran Vía 33', gili: 'Club Union Jack', marruecos: 'Club Casbah' }[n]),
  oficina: n => 'Oficinas ' + (n === 'madrid' ? 'Castellana' : n === 'gili' ? 'Gili Finance' : 'Centro'), almacen: n => 'Almacén ' + (REGION_NAMES[n] || ''),
  vivienda: n => 'Vivienda', mercado: n => ({ caleta: 'Mercado del Puerto', catetos: 'Mercado de abastos', madrid: 'Mercado de San Miguel', gili: 'Covered Market', marruecos: 'Zoco cubierto' }[n])
};
const POIS = []; const POI_GRID = new Map();
function poiName(type, region, rng) {
  const t = POI_NAMES[region] && POI_NAMES[region][type];
  if (t) return t[(rng() * t.length) | 0];
  return POI_GENERIC[type] ? POI_GENERIC[type](region) : type;
}
function genLots(b) {
  if (b.lots) return b.lots;
  const c = b.c, lots = []; b.lots = lots;
  if (b.kind !== 'build') return lots;
  const rng = mulberry32((hash2(b.k, b.l, c.seed) * 4294967296) | 0), zt = b.zone.t, S = ZSPEC[zt] || ZSPEC.residential, pal = PAL[c.style] || PAL.caleta;
  const bw = b.u1 - b.u0, bd = b.v1 - b.v0;
  const dpt = Math.min(S.d[0] + rng() * (S.d[1] - S.d[0]), bd / 2);
  for (let row = 0; row < 2; row++) {
    const v = row === 0 ? b.v0 + dpt / 2 : b.v1 - dpt / 2, face = row === 0 ? -1 : 1;
    let u = b.u0, idx = 0;
    while (u < b.u1 - 6) {
      let w = S.w[0] + rng() * (S.w[1] - S.w[0]); if (b.u1 - u - w < S.w[0] * 0.8) w = b.u1 - u;
      const lu = u + w / 2; u += w; idx++;
      if (rng() > S.occ) continue;
      const fw = w * (S.foot ? S.foot[0] : 0.96), fd = dpt * (S.foot ? S.foot[1] : 0.94);
      let fl = S.fl[0] + Math.floor(rng() * (S.fl[1] - S.fl[0] + 1));
      let kind = S.kind || (fl >= 5 ? 'block' : 'house');
      if (c.style === 'madrid' && (zt === 'residential' || zt === 'periphery') && rng() < 0.3) { fl += 3; kind = 'block'; }
      if (c.style === 'gili' && zt === 'financial') fl = Math.floor(fl * 0.55) + 4;
      const fh = S.fh || (c.style === 'madrid' ? 3.4 : 3.1);
      const roofPref = STYLE_ROOF[c.style] || 'flat';
      let roof = kind === 'tower' || kind === 'block' || kind === 'tourist' || kind === 'warehouse' && rng() < 0.4 ? 'flat' : (rng() < 0.72 ? roofPref : pick3(rng, ['flat', 'gable', 'hip']));
      if (kind === 'villa') roof = rng() < 0.7 ? 'hip' : 'gable';
      if (kind === 'warehouse') roof = rng() < 0.5 ? 'gable' : 'flat';
      if (c.style === 'marruecos' && kind !== 'warehouse') roof = 'flat';
      if (c.style === 'catetos' && kind !== 'warehouse') roof = 'gable';
      const glass = kind === 'tower' || (c.style === 'madrid' && zt === 'commercial' && rng() < 0.2) || (c.style === 'marruecos' && zt === 'modern' && rng() < 0.2);
      const wallPal = glass && pal.glass ? pal.glass : pal.wall;
      const lot = { u: lu, v, w, d: dpt, fw, fd, fl, h: fl * fh + (kind === 'warehouse' ? 0 : 0), fh, col: wallPal[(rng() * wallPal.length) | 0], rcol: pal.roof[(rng() * pal.roof.length) | 0], acol: pal.acc[(rng() * pal.acc.length) | 0], roof, kind, glass, face, ridgeU: fw > fd, shop: false, id: b.k * 100000 + b.l * 1000 + row * 100 + idx, poi: null };
      lot.shop = rng() < S.shop;
      const wp = cityToWorld(c, lu, v); lot.x = wp.x; lot.z = wp.z;
      /* POI: comercios y servicios con interior accesible */
      let ptype = null;
      const pz = POI_BY_ZONE[zt] || POI_BY_ZONE.residential;
      if (lot.shop || (zt === 'villa' || zt === 'rural') && rng() < 0.12 || (kind === 'house' || kind === 'block') && rng() < 0.015) ptype = pz[(rng() * pz.length) | 0];
      if (kind === 'tourist' && rng() < 0.4) ptype = 'hotel';
      if (kind === 'warehouse' && rng() < 0.4) ptype = zt === 'port' ? 'almacen' : pick3(rng, ['almacen', 'taller', 'gasolinera']);
      if (kind === 'tower' && rng() < 0.5) ptype = 'oficina';
      if (((b.k + 50) * 7 + (b.l + 50) * 13 + row) % 29 === 0 && ZSPEC[zt] && zt !== 'villa' && zt !== 'park') ptype = SPECIAL_POI[(Math.abs(b.k * 3 + b.l * 5)) % SPECIAL_POI.length];
      if (ptype) {
        const dir = { x: -c.sin * face, z: c.cos * face };
        const door = cityToWorld(c, lu, v - face * (fd / 2 + 1.2));
        // la puerta mira hacia la calle (lado de la fachada)
        const nm = poiName(ptype, c.region, rng);
        lot.poi = { id: 'p' + c.id + lot.id, type: ptype, name: nm, city: c.id, region: c.region, x: door.x, z: door.z, nx: dir.x * -1 * -1, nz: dir.z, lot, zone: zt, y: b.y };
        // normal hacia fuera: el lado v - face*... es hacia la calle
        lot.poi.nx = c.sin * face; lot.poi.nz = -c.cos * face;
        lot.poi.nx = -(-c.sin) * face * -1; // se normaliza abajo
        const sx = -face * (-c.sin), sz = -face * c.cos;
        lot.poi.nx = sx; lot.poi.nz = sz;
        POIS.push(lot.poi);
      }
      lots.push(lot);
    }
  }
  return lots;
}
function pick3(rng, a) { return a[(rng() * a.length) | 0]; }

/* ---------------- grafo de navegación ---------------- */
const GRAPH = { nodes: [], edges: [], cell: new Map() };
function addNode(x, z, extra) {
  const n = Object.assign({ id: GRAPH.nodes.length, x, z, y: 0, adj: [], city: null }, extra);
  GRAPH.nodes.push(n);
  const k = Math.floor(x / 160) * 65536 + Math.floor(z / 160); let a = GRAPH.cell.get(k); if (!a) { a = []; GRAPH.cell.set(k, a); } a.push(n.id);
  return n;
}
function polyLen(p) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return l; }
function addEdgePair(a, b, type, speed, pts, extra) {
  const fwd = pts || [{ x: a.x, z: a.z }, { x: b.x, z: b.z }], back = fwd.slice().reverse(), len = polyLen(fwd) || 1;
  const e1 = Object.assign({ id: GRAPH.edges.length, a: a.id, b: b.id, len, type, speed, pts: fwd }, extra);
  GRAPH.edges.push(e1);
  const e2 = Object.assign({ id: GRAPH.edges.length, a: b.id, b: a.id, len, type, speed, pts: back }, extra);
  GRAPH.edges.push(e2); e1.rev = e2.id; e2.rev = e1.id;
  a.adj.push(e1.id); b.adj.push(e2.id);
  for (const e of [e1, e2]) { const p0 = e.pts[0], p1 = e.pts[Math.min(e.pts.length - 1, 1)]; const l = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1; e.dx = (p1.x - p0.x) / l; e.dz = (p1.z - p0.z) / l; }
  return e1;
}
function nearestNode(x, z, maxd = 400, filter) {
  let best = null, bd = maxd * maxd; const r = Math.ceil(maxd / 160);
  const cx = Math.floor(x / 160), cz = Math.floor(z / 160);
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
    const a = GRAPH.cell.get((cx + i) * 65536 + (cz + j)); if (!a) continue;
    for (const id of a) { const n = GRAPH.nodes[id]; if (filter && !filter(n)) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
  }
  return best;
}
/* A* sobre el grafo: devuelve lista de aristas */
function astar(aId, bId, opts) {
  if (aId === bId) return [];
  const N = GRAPH.nodes, g = new Map(), from = new Map(), open = [[0, aId]], closed = new Set(), tgt = N[bId];
  g.set(aId, 0);
  const push = it => { open.push(it); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const t = open[0], l = open.pop(); if (open.length) { open[0] = l; let i = 0; for (; ;) { let m = i, a = 2 * i + 1, b = a + 1; if (a < open.length && open[a][0] < open[m][0]) m = a; if (b < open.length && open[b][0] < open[m][0]) m = b; if (m === i) break;[open[m], open[i]] = [open[i], open[m]]; i = m; } } return t; };
  let guard = 0;
  while (open.length && guard++ < 60000) {
    const [, id] = pop(); if (id === bId) break; if (closed.has(id)) continue; closed.add(id);
    for (const eid of N[id].adj) {
      const e = GRAPH.edges[eid]; if (opts && opts.avoid && opts.avoid(e)) continue;
      const ng = g.get(id) + e.len / (opts && opts.speed ? Math.max(6, e.speed) : 1) * (opts && opts.speed ? 20 : 1);
      if (ng < (g.get(e.b) === undefined ? 1e12 : g.get(e.b))) { g.set(e.b, ng); from.set(e.b, eid); push([ng + Math.hypot(N[e.b].x - tgt.x, N[e.b].z - tgt.z) / (opts && opts.speed ? 1 : 1), e.b]); }
    }
  }
  if (!from.has(bId)) return null;
  const path = []; let cur = bId; while (cur !== aId) { const eid = from.get(cur); path.push(eid); cur = GRAPH.edges[eid].a; }
  return path.reverse();
}
const lightPhase = (node, t) => ((t + node.loff) % 24 + 24) % 24;
function lightState(node, axis, t) {
  if (!node.light) return 'g'; const ph = lightPhase(node, t);
  if (axis === 0) return ph < 10 ? 'g' : ph < 12 ? 'y' : 'r';
  return ph < 12 ? 'r' : ph < 22 ? 'g' : 'y';
}
function edgeAxis(e, c) { return Math.abs(e.dx * c.cos + e.dz * c.sin) > 0.7 ? 0 : 1; }

function buildCityGraph(c) {
  const key = (k, l) => k * 4096 + l;
  for (let k = -c.K; k <= c.K; k++) for (let l = -c.K; l <= c.K; l++) {
    const w = cityToWorld(c, c.lineU[k + c.K], c.lineV[l + c.K]); const d = Math.hypot(w.x - c.cx, w.z - c.cz);
    if (d > c.R * 0.93) continue; const h = hLand(w.x, w.z); if (h < 2.2) continue;
    if (RIVER_HASH.nearest(w.x, w.z)) continue;
    const n = addNode(w.x, w.z, { city: c.id, k, l, y: h, loff: hash2(k, l, c.seed) * 24 });
    c.nodeMap.set(key(k, l), n); c.nodes.push(n);
  }
  for (const n of c.nodes) {
    const pairs = [[n.k + 1, n.l, isAve(c, n.l)], [n.k, n.l + 1, isAve(c, n.k)]];
    for (const [k2, l2, ave] of pairs) {
      const m = c.nodeMap.get(key(k2, l2)); if (!m) continue;
      addEdgePair(n, m, ave ? 'avenue' : 'street', ave ? 15 : 11, null, { city: c.id, lanes: 2, hw: ave ? c.hw * 1.7 : c.hw });
    }
  }
  for (const n of c.nodes) { n.degree = n.adj.length; if (n.degree >= 3) { n.light = true; } n.round = n.degree === 4 && isAve(c, n.k) && isAve(c, n.l) && hash2(n.k, n.l, c.seed + 5) < 0.6; }
}
function cityGate(c, fx, fz) {
  let best = null, bd = 1e12;
  for (const n of c.nodes) { const d = (n.x - fx) ** 2 + (n.z - fz) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}

/* ---------------- carreteras ---------------- */
const ROAD_TYPES = {
  highway: { hw: 11, sh: 16, lanes: 4, speed: 38, maxSlope: 0.06, smooth: [14, 4] }, national: { hw: 6.5, sh: 11, lanes: 2, speed: 28, maxSlope: 0.09, smooth: [8, 3] },
  secondary: { hw: 5, sh: 9, lanes: 2, speed: 22, maxSlope: 0.11, smooth: [6, 3] }, mountain: { hw: 4.6, sh: 7, lanes: 2, speed: 16, maxSlope: 0.12, smooth: [4, 3] },
  rural: { hw: 3, sh: 5, lanes: 1, speed: 11, maxSlope: 0.16, smooth: [3, 2] }
};
const STEP = 8;
function catmullResample(pts, step) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 1 / 20) {
      const t2 = t * t, t3 = t2 * t;
      dense.push({ x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3), z: 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3) });
    }
  }
  dense.push(pts[pts.length - 1]);
  const out = [{ x: dense[0].x, z: dense[0].z }]; let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    let seg = Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z), from = dense[i - 1];
    while (acc + seg >= step) {
      const t = (step - acc) / seg, nx = from.x + (dense[i].x - from.x) * t, nz = from.z + (dense[i].z - from.z) * t;
      out.push({ x: nx, z: nz }); seg -= (step - acc); from = { x: nx, z: nz }; acc = 0;
    }
    acc += seg;
  }
  const last = dense[dense.length - 1], lo = out[out.length - 1];
  if (Math.hypot(last.x - lo.x, last.z - lo.z) > 1) out.push({ x: last.x, z: last.z });
  return out;
}
function smoothProfile(ys, radius, passes) {
  let a = ys.slice(); const n = a.length;
  for (let p = 0; p < passes; p++) {
    const b = a.slice();
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let j = -radius; j <= radius; j++) { const k = i + j; if (k < 0 || k > n - 1) continue; s += a[k]; c++; } b[i] = s / c; }
    b[0] = ys[0]; b[n - 1] = ys[n - 1]; a = b;
  }
  return a;
}
function limitSlope(ys, ms) {
  for (let i = 1; i < ys.length; i++) ys[i] = clamp(ys[i], ys[i - 1] - ms, ys[i - 1] + ms);
  for (let i = ys.length - 2; i >= 0; i--) ys[i] = clamp(ys[i], ys[i + 1] - ms, ys[i + 1] + ms);
}
const arcPts = (cx, cz, r, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = rad(a0 + (a1 - a0) * i / n); o.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o; };

function roadDefs() {
  const P = (x, z) => [x, z], cN = (x, d) => [x, coastN(x) + d], cS = (x, d) => [x, coastS(x) + d], C = id => 'city:' + id;
  const M = cityById('madrid'), CA = cityById('caleta');
  return [
    { id: 'A-1', name: 'Autopista del Sur A-1', type: 'highway', pts: [C('caleta'), P(1300, -2000), P(1550, -3300), P(1200, -4700), P(700, -5400), C('madrid')] },
    { id: 'N-340', name: 'Nacional N-340', type: 'national', pts: [C('caleta'), P(300, -1000), P(-500, -1700), P(-1000, -2100)] },
    { id: 'MT-1', name: 'Carretera de montaña MT-1', type: 'mountain', pts: [P(-1000, -2100), P(-1300, -2350), P(-1050, -2600), P(-1450, -2800), P(-1750, -3050), P(-1500, -3250), C('catetos')] },
    { id: 'MT-2', name: 'Carretera de montaña MT-2', type: 'mountain', pts: [C('catetos'), P(-2150, -3900), P(-1800, -4300), P(-2250, -4700), P(-2400, -5300), P(-2200, -6000), P(-2100, -6600), C('madrid')] },
    { id: 'SV-1', name: 'Carretera de Villanueva', type: 'secondary', pts: [P(1480, -3050), P(1800, -3100), C('villanueva')] },
    { id: 'SV-2', name: 'Carretera a Venta Ciega', type: 'secondary', pts: [P(-500, -1700), P(-800, -1500), C('venta')] },
    { id: 'MT-3', name: 'Carretera a Aldea de Arriba', type: 'mountain', pts: [C('catetos'), P(-2400, -3350), P(-2750, -3150), C('aldea')] },
    { id: 'MT-4', name: 'Carretera a Los Cortijos', type: 'mountain', pts: [P(-2150, -3900), P(-1700, -4350), C('cortijos')] },
    { id: 'CO-1', name: 'Carretera de la Costa Oeste', type: 'secondary', pts: [C('caleta'), cN(300, -260), cN(-900, -300), cN(-1800, -330), C('calahonda')] },
    { id: 'CO-2', name: 'Carretera de la Costa Este', type: 'secondary', pts: [C('caleta'), cN(1900, -330), cN(2500, -690)] },
    { id: 'CIR-C', name: 'Circunvalación de Caleta', type: 'national', pts: arcPts(CA.cx, CA.cz, CA.R + 90, -168, -12, 12) },
    { id: 'CIR-M', name: 'M-30 Circunvalación de Madrid', type: 'national', pts: arcPts(M.cx, M.cz, 1760, 0, 360, 36) },
    { id: 'AP-M', name: 'Acceso al aeropuerto de Madrid', type: 'secondary', pts: [C('madrid'), P(750, -8000), P(1500, -8100)] },
    { id: 'R-1', name: 'Camino rural del Olivar', type: 'rural', pts: [P(1300, -2000), P(1900, -2150), P(2300, -2300)] },
    { id: 'R-2', name: 'Camino del mirador', type: 'rural', pts: [P(-1450, -2800), P(-900, -3100), P(-700, -3500)] },
    { id: 'R-3', name: 'Camino de las fincas', type: 'rural', pts: [C('villanueva'), P(2700, -3500), P(3300, -3800)] },
    { id: 'GI-1', name: 'Carretera de circunvalación de Gililondon', type: 'secondary', pts: [C('gili'), P(2900, 1550), C('santamarina')] },
    { id: 'GI-2', name: 'Carretera costera oeste', type: 'secondary', pts: [C('gili'), P(2200, 1750), C('puntafaro')] },
    { id: 'GI-3', name: 'Acceso al aeropuerto de Gililondon', type: 'secondary', pts: [C('santamarina'), P(3500, 2000), P(3700, 1900)] },
    { id: 'MA-1', name: 'Autopista de Bab el Mar', type: 'highway', pts: [C('babelmar'), P(1700, 4500), P(2100, 4800), C('medina')] },
    { id: 'MA-2', name: 'Nacional de la costa', type: 'national', pts: [C('babelmar'), cS(-300, 330), cS(-900, 360), C('ainzitun')] },
    { id: 'MA-3', name: 'Carretera del Rif', type: 'mountain', pts: [C('medina'), P(1900, 5900), P(1600, 6350), C('beniyusef')] },
    { id: 'MA-4', name: 'Carretera de Tazra', type: 'mountain', pts: [C('ainzitun'), P(-1300, 5200), P(-1000, 5950), C('tazra')] },
    { id: 'MA-5', name: 'Carretera a Douar Zeitoun', type: 'secondary', pts: [C('medina'), P(3000, 4800), C('douar')] },
    { id: 'MA-6', name: 'Acceso al aeródromo de Bab el Mar', type: 'secondary', pts: [C('babelmar'), P(-150, 4850), P(-500, 4900)] }
  ];
}
function riverDefs() {
  const M = cityById('madrid'), pts = arcPts(M.cx, M.cz, 1580, 250, 10, 12);
  return [{ id: 'menzaro', name: 'Río Menzaro', pts, hw: 11, bank: 18, depth: 5 },
  { id: 'arroyo', name: 'Arroyo del Valle', pts: [[-1700, -2500], [-1900, -2900], [-2050, -3150], [-2050, -3400]], hw: 2.5, bank: 5, depth: 1.4 }];
}
function resolveRoadPts(def) {
  const raw = def.pts.map(p => typeof p === 'string' ? null : { x: p[0], z: p[1] });
  for (let i = 0; i < raw.length; i++) if (!raw[i]) {
    const c = cityById(def.pts[i].slice(5)), ref = raw[i + 1] || raw[i - 1] || { x: c.cx, z: c.cz };
    let ref2 = ref; if (!ref2) { const o = def.pts[i === 0 ? def.pts.length - 1 : 0]; const cc = typeof o === 'string' ? cityById(o.slice(5)) : null; ref2 = cc ? { x: cc.cx, z: cc.cz } : { x: c.cx, z: c.cz }; }
    const n = cityGate(c, ref2.x, ref2.z); raw[i] = { x: n.x, z: n.z, node: n.id };
  }
  return raw;
}
function buildRoad(def) {
  const T = ROAD_TYPES[def.type], raw = resolveRoadPts(def);
  const pts = catmullResample(raw, STEP), n = pts.length;
  const ys = pts.map(p => hLand(p.x, p.z));
  let sm = smoothProfile(ys, T.smooth[0], T.smooth[1]);
  limitSlope(sm, T.maxSlope * STEP);
  const road = { id: def.id, name: def.name || def.id, type: def.type, T, pts: [], gateStart: raw[0].node, gateEnd: raw[raw.length - 1].node, idx: ROADS.length, wear: def.type === 'highway' ? 0 : (hash2(def.id.length, def.id.charCodeAt(0), 3) * 4) | 0 };
  for (let i = 0; i < n; i++) {
    const p = pts[i], prev = pts[Math.max(0, i - 1)], next = pts[Math.min(n - 1, i + 1)];
    const l = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
    const hr = hRiver(p.x, p.z), gap = sm[i] - hr, deepRiver = hr < hLand(p.x, p.z) - 2;
    let kind = 0; if (gap > (deepRiver ? 3.2 : 7)) kind = 1; else if (gap < -13) kind = 2;
    road.pts.push({ x: p.x, z: p.z, y: sm[i], dx: (next.x - prev.x) / l, dz: (next.z - prev.z) / l, kind, gap, ground: hr });
  }
  ROADS.push(road);
  // etiqueta kind en segmentos (puente si cualquiera de los extremos es puente)
  for (let i = 0; i < n - 1; i++) {
    const a = road.pts[i], b = road.pts[i + 1], kind = Math.max(a.kind, b.kind);
    ROAD_HASH.add({ ax: a.x, az: a.z, ay: a.y, bx: b.x, bz: b.z, by: b.y, hw: T.hw, sh: T.sh, kind, road: road.idx }, T.hw + T.sh);
  }
  return road;
}
function buildRiver(def) {
  const raw = def.pts.map(p => ({ x: p[0], z: p[1] })), pts = catmullResample(raw, 10), ys = pts.map(p => hLand(p.x, p.z));
  let sm = smoothProfile(ys, 10, 4); for (let i = 1; i < sm.length; i++) sm[i] = Math.min(sm[i], sm[i - 1] - 0.01);
  const river = { id: def.id, name: def.name, hw: def.hw, depth: def.depth, pts: pts.map((p, i) => ({ x: p.x, z: p.z, bed: sm[i] - def.depth, water: sm[i] - def.depth + def.depth * 0.38 })) };
  for (let i = 0; i < river.pts.length - 1; i++) {
    const a = river.pts[i], b = river.pts[i + 1];
    RIVER_HASH.add({ ax: a.x, az: a.z, ay: a.bed, bx: b.x, bz: b.z, by: b.bed, hw: def.hw, sh: def.bank, depth: def.depth }, def.hw + def.bank);
  }
  RIVERS.push(river);
}
function buildRoadGraph() {
  // 1) cruces y enlaces entre carreteras
  const cell = new Map(), forced = new Map(), links = [];
  ROADS.forEach(r => r.pts.forEach((p, i) => { const k = Math.floor(p.x / 32) * 65536 + Math.floor(p.z / 32); let a = cell.get(k); if (!a) { a = []; cell.set(k, a); } a.push([r.idx, i]); }));
  const mark = (ri, i) => { forced.set(ri * 100000 + i, true); };
  const seen = new Set();
  ROADS.forEach(r => {
    const check = (i, rad) => {
      const p = r.pts[i], cx = Math.floor(p.x / 32), cz = Math.floor(p.z / 32); let best = null, bd = rad * rad;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = cell.get((cx + a) * 65536 + cz + b); if (!L) continue; for (const [rj, j] of L) { if (rj === r.idx) continue; const q = ROADS[rj].pts[j], d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = [rj, j]; } } }
      if (best) { const key = Math.min(r.idx, best[0]) + '-' + Math.max(r.idx, best[0]) + '-' + Math.floor(p.x / 120) + '-' + Math.floor(p.z / 120); if (seen.has(key)) return; seen.add(key); mark(r.idx, i); mark(best[0], best[1]); links.push([r.idx, i, best[0], best[1]]); }
    };
    if (!r.gateStart) check(0, 60); if (!r.gateEnd) check(r.pts.length - 1, 60);
    for (let i = 3; i < r.pts.length - 3; i += 2) check(i, 6);
  });
  // 2) nodos y aristas
  const nodeOf = new Map();
  for (const r of ROADS) {
    const T = r.T, every = r.type === 'mountain' ? 3 : 6, ids = [];
    for (let i = 0; i < r.pts.length; i++) {
      const isEnd = i === 0 || i === r.pts.length - 1;
      if (i === 0 && r.gateStart !== undefined) { ids.push([i, r.gateStart]); continue; }
      if (i === r.pts.length - 1 && r.gateEnd !== undefined) { ids.push([i, r.gateEnd]); continue; }
      if (isEnd || forced.has(r.idx * 100000 + i) || i % every === 0) {
        const nn = addNode(r.pts[i].x, r.pts[i].z, { y: r.pts[i].y, road: r.idx }); nodeOf.set(r.idx * 100000 + i, nn.id); ids.push([i, nn.id]);
      }
    }
    for (let q = 0; q < ids.length - 1; q++) {
      const [i0, n0] = ids[q], [i1, n1] = ids[q + 1], pts = []; for (let i = i0; i <= i1; i++) pts.push({ x: r.pts[i].x, z: r.pts[i].z });
      if (n0 === n1 || pts.length < 2) continue;
      const a = GRAPH.nodes[n0], b = GRAPH.nodes[n1];
      pts[0] = { x: a.x, z: a.z }; pts[pts.length - 1] = { x: b.x, z: b.z };
      addEdgePair(a, b, r.type, T.speed, pts, { road: r.idx, lanes: T.lanes, hw: T.hw });
    }
    for (const [i, id] of ids) nodeOf.set(r.idx * 100000 + i, id);
  }
  for (const [r1, i1, r2, i2] of links) {
    const a = GRAPH.nodes[nodeOf.get(r1 * 100000 + i1)], b = GRAPH.nodes[nodeOf.get(r2 * 100000 + i2)];
    if (a && b && a !== b) addEdgePair(a, b, 'link', 14, null, { lanes: 1, hw: 4, link: true });
  }
}

/* ---------------- puertos, aeropuertos, rutas ---------------- */
function findShore(x, zFrom, dir) { // desde tierra hacia el mar en dirección dir(+1 sur, -1 norte)
  let z = zFrom; for (let i = 0; i < 400; i++) { if (hLand(x, z) < 0.3) return z; z += dir * 5; } return z;
}
function setupPlaces() {
  const caleta = cityById('caleta'), gili = cityById('gili'), bab = cityById('babelmar');
  const mk = (id, name, x, z0, dir, len, region, kind, w = 26) => {
    const sz = findShore(x, z0, dir), zs = sz - dir * 12, ze = sz + dir * len;
    const p = { id, name, region, kind, x, zs, ze, dir, w, y: 1.4, deck: { x0: x - w / 2, x1: x + w / 2, z0: Math.min(zs, ze), z1: Math.max(zs, ze) }, dock: { x, z: ze + dir * 28 }, land: { x, z: zs - dir * 14 } };
    PORTS.push(p); PLATFORMS.push({ x0: p.deck.x0, x1: p.deck.x1, z0: p.deck.z0, z1: p.deck.z1, y: p.y, type: 'pier', port: id });
    FLATS.push({ x, z: zs - dir * 40, r: 90, y: 2.2 }); return p;
  };
  mk('caleta_puerto', 'Puerto de Caleta del Marfil', 1500, caleta.cz + 200, 1, 150, 'caleta', 'commercial', 34);
  mk('caleta_marina', 'Puerto deportivo de Caleta', 600, caleta.cz + 200, 1, 100, 'caleta', 'marina', 22);
  mk('calahonda_puerto', 'Puerto de Cala Honda', -2400, cityById('calahonda').cz + 100, 1, 70, 'caleta', 'fishing', 16);
  mk('gili_puerto', 'Puerto internacional de Gililondon', 2380, gili.cz - 100, -1, 150, 'gili', 'commercial', 34);
  mk('gili_marina', 'Muelle de Punta Faro', 1900, cityById('puntafaro').cz - 20, -1, 70, 'gili', 'marina', 18);
  mk('bab_puerto', 'Puerto de Bab el Mar', 520, bab.cz - 450, -1, 150, 'marruecos', 'commercial', 34);
  mk('bab_pesquero', 'Puerto pesquero de Bab el Mar', 90, bab.cz - 450, -1, 80, 'marruecos', 'fishing', 20);
  mk('ain_puerto', 'Muelle de Ain Zitún', -1500, cityById('ainzitun').cz - 250, -1, 70, 'marruecos', 'fishing', 16);
  const fy = (id) => PORTS.find(p => p.id === id);
  const AP = (id, name, x, z, ang, len, region) => { const a = { id, name, x, z, ang, len, w: 46, region, y: smoothH(x, z) }; AIRPORTS.push(a); FLATS.push({ x, z, r: len * 0.55, y: a.y }); return a; };
  AP('ap_caleta', 'Aeródromo de Caleta', 2500, coastN(2500) - 700, 0, 700, 'caleta');
  AP('ap_madrid', 'Aeropuerto de Madrid-Barajas Norte', 1600, -8150, 0.3, 1100, 'madrid');
  AP('ap_gili', 'Aeropuerto Internacional de Gililondon', 3600, 1950, 0.25, 800, 'gili');
  AP('ap_bab', 'Aeródromo de Bab el Mar', -500, coastS(-500) + 1100, 0, 800, 'marruecos');
  // rutas marítimas de ferris (por puertos): se unen con puntos de mar abierto
  window.FERRY_ROUTES = [
    { id: 'f1', name: 'Caleta ⇄ Gililondon', a: 'caleta_puerto', b: 'gili_puerto' },
    { id: 'f2', name: 'Gililondon ⇄ Bab el Mar', a: 'gili_puerto', b: 'bab_puerto' },
    { id: 'f3', name: 'Caleta ⇄ Bab el Mar', a: 'caleta_puerto', b: 'bab_puerto' }
  ];
  window.SEA_LANES = [[-6000, 1350], [-3500, 1100], [-1000, 900], [1500, 800], [4500, 900], [6000, 1200]];
}
function platformAt(x, z) {
  for (const p of PLATFORMS) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return p;
  return null;
}

/* ---------------- mapa del mundo de baja resolución (minimapa, mapa, agua) ---------------- */
const WMAP = { w: 400, h: 500, x0: WORLD.minX, z0: WORLD.minZ, sx: (WORLD.maxX - WORLD.minX) / 400, sz: (WORLD.maxZ - WORLD.minZ) / 500, h8: null, ready: false };
function mapColor(x, z, h) {
  if (h < -0.2) { const d = clamp(-h / 40, 0, 1); return [lerp(0.18, 0.05, d), lerp(0.48, 0.18, d), lerp(0.56, 0.34, d)]; }
  if (h < 3.0) return [0.84, 0.78, 0.6];
  const reg = regionAt(x, z), n = fbm(x * 0.004, z * 0.004, 3, 5);
  let r = 0.42, g = 0.5, b = 0.28;
  if (reg === 'marruecos') { r = 0.66; g = 0.5; b = 0.34; if (z < coastS(x) + 1500 && x < 1500) { r = 0.5; g = 0.55; b = 0.32; } }
  else if (reg === 'madrid') { r = 0.68; g = 0.6; b = 0.38; }
  else if (reg === 'catetos') { r = 0.34; g = 0.42; b = 0.26; }
  else if (reg === 'gili') { r = 0.4; g = 0.5; b = 0.3; }
  r *= 0.85 + 0.3 * n; g *= 0.85 + 0.3 * n; b *= 0.85 + 0.3 * n;
  const k = clamp((h - 120) / 500, 0, 1); r = lerp(r, 0.55, k); g = lerp(g, 0.52, k); b = lerp(b, 0.48, k);
  return [r, g, b];
}
async function buildWorldMap(progress) {
  const m = WMAP, hm = new Float32Array(m.w * m.h);
  for (let j = 0; j < m.h; j++) {
    for (let i = 0; i < m.w; i++) hm[j * m.w + i] = hLand(m.x0 + (i + 0.5) * m.sx, m.z0 + (j + 0.5) * m.sz);
    if (j % 25 === 0) { if (progress) progress(j / m.h); await tick(); }
  }
  m.hm = hm; m.ready = true;
}
const WorldMapH = (x, z) => { const m = WMAP; if (!m.hm) return 0; const i = clamp(Math.floor((x - m.x0) / m.sx), 0, m.w - 1), j = clamp(Math.floor((z - m.z0) / m.sz), 0, m.h - 1); return m.hm[j * m.w + i]; };

/* ---------------- inicialización asíncrona (carga progresiva) ---------------- */
async function initWorld(progress) {
  const P = (f, t) => { if (progress) progress(f, t); };
  P(0.02, 'Definiendo ciudades y distritos'); initCityDefs(); await tick();
  P(0.08, 'Trazando ríos'); riverDefs().forEach(buildRiver); await tick();
  P(0.12, 'Preparando puertos y aeropuertos'); setupPlaces(); await tick();
  P(0.2, 'Trazando calles de las ciudades');
  for (const c of CITIES) { buildCityGraph(c); await tick(); }
  P(0.35, 'Construyendo autopistas y carreteras de montaña');
  for (const d of roadDefs()) { buildRoad(d); await tick(); }
  P(0.5, 'Conectando la red de navegación'); buildRoadGraph(); await tick();
  P(0.55, 'Parcelando ciudades y registrando comercios');
  for (const c of CITIES) { for (let k = -c.K; k < c.K; k++) { for (let l = -c.K; l < c.K; l++) { const b = blockInfo(c, k, l); if (b) genLots(b); } } await tick(); }
  P(0.7, 'Cartografiando el territorio');
  await buildWorldMap(f => P(0.7 + f * 0.28, 'Cartografiando el territorio'));
  for (const p of POIS) { const k = Math.floor(p.x / 128) * 65536 + Math.floor(p.z / 128); let a = POI_GRID.get(k); if (!a) { a = []; POI_GRID.set(k, a); } a.push(p); }
  P(1, 'Mundo listo');
}
function poisNear(x, z, r) {
  const out = [], cx = Math.floor(x / 128), cz = Math.floor(z / 128), n = Math.ceil(r / 128);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const a = POI_GRID.get((cx + i) * 65536 + cz + j); if (a) for (const p of a) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) out.push(p); }
  return out;
}