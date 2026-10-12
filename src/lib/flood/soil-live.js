// ҮЕР БА НЭВЧИЛТ — "Үерийн симуляци"-ийн ЯГ ТЭР урсгал хөрсний блокийн гадарга дээр.
//
// Хэрэглэгч 2026-10-12: "odoo gazriin gadarga deer uyer hewiin shuud ursana buyu uyriin simulation
// button deer daraad hardag ni gsn ug yg ijilhen ursana okey odoogiin simulation del hii".
// ⚠⚠ Урьдын хувилбар (`lib/soil-flood.ts`, 2026-10-09) хот даяар 60 м торонд толгойгүй тооцоод 48 агшин
// хадгалж, тоглуулдаг байв (CPU-ийн бохирдлын зөөвөрлөлт, зүсэлтийн нүүрний чийгийн фронттой) — УСТСАН
// (git түүхэнд бий). Одоо "Үерийн симуляци"-тай НЭГ хөдөлгүүр:
//   · шийдэгч — {@link FloodSolver} (local-inertial, тусдаа WebGL2 контекст), хот даяар, тор нь аппын
//     анхдагч `FACTOR` = 2 (≈20 м), борооны шингээлт, барилга саад — аппын `forcing()`-той ижил;
//   · ус — {@link WaterRenderer}-ийн 3D меш, хөрсний SceneView-ийн RenderNode-оор, аппын `WaterNode`-той
//     ижил (`frameFor` — харагдах цонхыг шийдэгчийн canvas-д багцалж ImageBitmap-аар дамжуулна, камерын
//     орчимд нарийн `near` дамжлага);
//   · давталт — аппын `tick()` (GPU-ийн дарамтаар алхмын төсөв өсгөж, бууруулна), 1 с = 2 мин.
// ⚠ Газрын өндрийг блокийн дээд гадаргаас (`geom.zAt`) авна: шийдэгч Copernicus-ийн DEM дээр урсдаг ч
// дүрслэлийн мешийн суурь нь блокийн оройн өндөр + `LIFT` — блокийн рельеф (≈75 м) DEM-ээс хэдэн метр
// зөрдөг тул DEM-ээр зурвал ус блокийн дотор живж, эсвэл хөвнө.
// ⚠ Блокийн гадна (Улаанбаатарын хилээс гадуур, хөрсгүй) нүдийг барилгын масктай (`bld`) нийлүүлнэ —
// рендерерийн `depthAtW` тэр нүдэнд гүнийг 0 гэж үздэг тул ус блокийн хилээр тасарна.
// ⚠ Усны давхарга зүсэлтэд (SliceAnalysis) ОРОХГҮЙ — хасагдсан талд ч харагдана (урьдын хувилбартай нэг).
import { FloodSolver } from './solver.js';
import { WaterRenderer } from './renderer.js';
import { createSolverGL, loadFloodData } from './data.js';
import { esriModules } from '@/lib/arcgis-sdk';

/** Борооны хувилбар — "Үерийн симуляци"-ийн утгууд; хөрсний чийг аппын анхдагч "Ханасан" (0.25) */
export const FLOOD_PRESETS = [
  { id: 'ref', name: 'Жишиг', i: 40, d: 60, shape: 'uniform', note: '40 мм/ц · 1 цаг · тэгш' },
  { id: 'strong', name: 'Хүчтэй', i: 50, d: 45, shape: 'tri', note: '50 мм/ц · 45 мин · оргилтой' },
  { id: 'extreme', name: 'Онц хүчтэй', i: 80, d: 60, shape: 'front', note: '80 мм/ц · 1 цаг · эхэндээ хүчтэй' },
  { id: 'slow', name: 'Удаан', i: 6, d: 720, shape: 'uniform', note: '6 мм/ц · 12 цаг · тэгш' },
];

const FACTOR = 2;            // аппын анхдагч тор (this.factor)
const SOIL = 0.25;           // хөрсний чийгийн төлөв "Ханасан"
const HORTON_K = 2 / 3600;
const DRAIN = 10;            // мм/ц
const SPEED = 120;           // 1 с = 2 мин
const LIFT = 0.5;            // усны мешийн суурь блокийн оройгоос, м
const R = 6378137;
const DISPLAY = { mode: 0, thr: 0.02, opacity: 0.85, hill: 0, particles: false, buildings: false, waterStyle: 0, arrows: false, history: false };

function mul4(a, b) {       // column-major 4x4: a * b
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

/**
 * @param {{ view: any, geom: { zAt: (lon: number, lat: number) => number, validAt: (lon: number, lat: number) => boolean },
 *   onState: (s: object) => void }} dep
 */
export function createSoilFlood(dep) {
  const { view, geom, onState } = dep;
  let alive = true;
  let gl = null, data = null, solver = null, grid = null, node = null, raf = 0;
  let loading = null;
  let running = false, presetId = FLOOD_PRESETS[0].id, resetCount = 0;
  let phase = 'idle', message = '';
  let lastTick = 0, maxSteps = 20, gpuWait = 0, lastEmit = 0;
  const frameCache = {};

  const preset = () => FLOOD_PRESETS.find(p => p.id === presetId) ?? FLOOD_PRESETS[0];
  const tEnd = () => Math.max(3, Math.ceil(preset().d / 60 + 1)) * 3600;

  // ---------------------------------------------------------------- бороо (аппын rainRate, cumRain)
  const rainRate = t => {
    const { i, d, shape } = preset(), D = d * 60;
    if (t >= D) return 0;
    let mmh = i;
    if (shape === 'tri') { const tp = 0.35 * D; mmh = t < tp ? 2 * i * t / tp : 2 * i * (D - t) / (D - tp); }
    else if (shape === 'front') mmh = 2 * i * (1 - t / D);
    return mmh / 3.6e6;
  };
  const cumRain = t => {
    let sum = 0;
    const n = 200, D = Math.min(t, preset().d * 60);
    for (let k = 0; k < n; k++) sum += rainRate((k + 0.5) / n * D) * D / n;
    return sum * 1000;
  };
  const forcing = t => ({
    rain: rainRate(t), rainArea: solver.W * solver.H * solver.dx * solver.dx, circle: [0, 0, 0, 0], inflows: [],
    infMul: SOIL, hortonK: HORTON_K, tr: t, wet: cumRain(t), manning: 1, theta: 0.8, drain: DRAIN, wallE: [1, 0],
  });

  // ---------------------------------------------------------------- төлөв React руу
  const emit = (force = false) => {
    const now = performance.now();
    if (!force && now - lastEmit < 250) return;
    lastEmit = now;
    const s = solver;
    onState({
      phase, message, running, preset: presetId, tEnd: tEnd(),
      t: s ? s.t : 0,
      grid: s ? { w: s.W, h: s.H, dx: s.dx } : null,
      stats: s && s.t > 0 ? { wetHa: (s.stats.wetArea || 0) / 1e4, hmax: s.stats.hmax, vol: s.stats.vol, rainMm: cumRain(s.t) } : null,
    });
  };

  // ---------------------------------------------------------------- бэлтгэл
  /** Дүрслэлийн тор: шийдэгчийн тор + блокийн оройн өндөр + блокийн гаднах маск */
  function displayGrid() {
    const g = solver.readGrid();
    const { W, H } = g, c = g.cellMerc;
    const lon = new Float64Array(W), lat = new Float64Array(H);
    for (let i = 0; i < W; i++) lon[i] = ((g.x0 + (i + 0.5) * c) / R) * 180 / Math.PI;
    for (let j = 0; j < H; j++) lat[j] = (2 * Math.atan(Math.exp((g.y1 - (j + 0.5) * c) / R)) - Math.PI / 2) * 180 / Math.PI;
    const z = new Float32Array(W * H), bld = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const ok = geom.validAt(lon[i], lat[j]);
      z[k] = geom.zAt(lon[i], lat[j]) + LIFT;
      bld[k] = ok ? g.bld[k] : 1;
    }
    return { ...g, key: `soil-${g.key}`, ground: z, groundNat: z, bld, fineBld: null };
  }

  async function prepare() {
    if (loading) return loading;
    loading = (async () => {
      phase = 'loading'; message = 'Өндрийн загвар ачаалж байна'; emit(true);
      const [mods, d] = await Promise.all([
        esriModules(['esri/views/3d/webgl/RenderNode', 'esri/views/3d/webgl', 'esri/geometry/SpatialReference']),
        loadFloodData(m => { message = m; emit(true); }),
      ]);
      if (!alive) return;
      data = d;
      message = 'Тооцооны торыг бэлтгэж байна'; emit(true);
      await new Promise(r => setTimeout(r, 30));
      gl = createSolverGL();
      solver = new FloodSolver(gl, data, { factor: FACTOR, buildings: true, window: null });
      grid = displayGrid();
      attach(mods);
      phase = 'ready'; message = ''; emit(true);
      loop();
    })().catch(e => {
      if (!alive) return;
      console.error(e);
      phase = 'error'; message = e?.message || String(e); emit(true);
      loading = null;
    });
    return loading;
  }

  // ---------------------------------------------------------------- харагдах цонхыг багцлах (аппын frameFor)
  function frameFor(ext, pxW, pxH, viewId) {
    const s = solver, g = grid;
    if (!s || !g || !ext) return null;
    const c = g.cellMerc, pad = 2;
    let x0 = Math.max(0, Math.floor((ext.xmin - g.x0) / c) - pad), x1 = Math.min(g.W, Math.ceil((ext.xmax - g.x0) / c) + pad);
    let y0 = Math.max(0, Math.floor((g.y1 - ext.ymax) / c) - pad), y1 = Math.min(g.H, Math.ceil((g.y1 - ext.ymin) / c) + pad);
    if (x1 <= x0 || y1 <= y0) return null;
    const cv = gl.canvas;
    const cw = Math.min(2048, Math.ceil(pxW / 64) * 64), ch = Math.min(2048, Math.ceil(pxH / 64) * 64);
    if (cw > cv.width || ch > cv.height) { cv.width = Math.max(cv.width, cw); cv.height = Math.max(cv.height, ch); }
    let blk = 1;
    while ((x1 - x0) / blk > Math.max(pxW, 1) * 1.001 || (y1 - y0) / blk > Math.max(pxH, 1) * 1.001
           || Math.ceil((x1 - x0) / blk) + 1 > cv.width || Math.ceil((y1 - y0) / blk) + 1 > cv.height) blk *= 2;
    x0 = Math.floor(x0 / blk) * blk; y0 = Math.floor(y0 / blk) * blk;
    x1 = Math.ceil(x1 / blk) * blk; y1 = Math.ceil(y1 / blk) * blk;
    const ow = (x1 - x0) / blk, oh = (y1 - y0) / blk;
    const key = [resetCount, s.steps, g.key, x0, y0, x1, y1, ow, oh].join('|');
    const cached = frameCache[viewId];
    if (cached && cached.key === key) return { frame: cached.frame, grid: g, reuse: true };
    const frame = s.encode(0, [x0, y0, x1, y1], ow, oh, null);
    if (cv.transferToImageBitmap) frame.image = cv.transferToImageBitmap();
    frameCache[viewId] = { key, frame: { ...frame, image: null } };
    return { frame, grid: g };
  }

  /** Хазайсан харагдацын газарт буух хүрээ (аппын _visibleExtent) */
  let visKey = '', visExt = null;
  function visibleExtent() {
    const cam = view.camera, p = cam && cam.position;
    if (!p) return view.extent;
    const key = [p.x, p.y, p.z, cam.heading, cam.tilt, view.width, view.height].map(v => Math.round(v)).join();
    if (visKey === key) return visExt;
    let x0 = p.x, x1 = p.x, y0 = p.y, y1 = p.y, miss = 0;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
      const q = view.toMap({ x: view.width * i / 4, y: view.height * j / 4 });
      if (!q) { miss++; continue; }
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const pad = miss ? Math.max(3000, 4 * (p.z - 1300)) : 200;
    visKey = key;
    visExt = { xmin: x0 - pad, xmax: x1 + pad, ymin: y0 - pad, ymax: y1 + pad };
    return visExt;
  }

  // ---------------------------------------------------------------- 3D ус (аппын WaterNode)
  function attach([RenderNode, webgl, SpatialReference]) {
    const WaterNode = RenderNode.createSubclass({
      constructor() { this.consumes = { required: ['composite-color'] }; this.produces = 'composite-color'; },
      render() {
        const out = this.bindRenderTarget();
        try { this._draw(); } catch (e) { console.error('water3d', e); }
        if (running) this.requestRender();
        return out;
      },
      _draw() {
        if (!solver || solver.t <= 0) return;
        const cam = this.camera, vp = cam.viewport;
        const f = frameFor(visibleExtent(), vp[2] / 2, vp[3] / 2, '3d');
        if (!f) return;
        if (!this.r) this.r = new WaterRenderer(this.gl);
        const r = this.r, g = f.grid;
        r.setGrid(g);
        r.upload(f.frame, f.reuse, 'main');
        const c = view.center, p = view.camera.position;
        const Rn = c && p ? Math.max(250, Math.min(6000, 0.9 * Math.hypot(p.x - c.x, p.y - c.y, p.z - (c.z || 0)))) : 0;
        const nf = Rn && frameFor({ xmin: c.x - Rn, xmax: c.x + Rn, ymin: c.y - Rn, ymax: c.y + Rn }, 1536, 1536, '3dnear');
        if (nf) r.upload(nf.frame, nf.reuse, 'near');
        else if (r.slots.near) r.slots.near.frame = null;
        const T = webgl.renderCoordinateTransformAt(view, [g.x0, g.y1, 0], SpatialReference.WebMercator, new Float64Array(16));
        const mvp = Float32Array.from(mul4(mul4(cam.projectionMatrix, cam.viewMatrix), T));
        const disp = { ...DISPLAY, tmax: Math.max(solver.t, 60) / 60, sun: this.sunLight?.direction, pxAng: (cam.fovY || 0.8) / Math.max(vp[3], 1) };
        const eye = [cam.eye[0] - T[12], cam.eye[1] - T[13], cam.eye[2] - T[14]];
        r.draw3D(disp, mvp, eye);
        this.resetWebGLState();
      },
    });
    node = new WaterNode({ view });
  }

  // ---------------------------------------------------------------- давталт (аппын tick)
  function loop() {
    const frame = () => {
      if (!alive) return;
      try { tick(); } catch (e) { console.error(e); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function tick() {
    const s = solver;
    if (!s || !running) return;
    const now = performance.now();
    const realDt = Math.min((now - (lastTick || now)) / 1000, 0.1);
    lastTick = now;
    const end = tEnd();
    const target = SPEED * Math.max(realDt, 1 / 120);
    const t0 = performance.now();
    s.reducePoll();
    const gpuReady = s.reduceInFlight < 4;
    const cap = gpuReady ? maxSteps : 0;
    let adv = 0, n = 0;
    while (adv < target && n < cap && s.t < end) {
      const dt = Math.min(s.suggestDt(), end - s.t + 1e-3);
      s.step(dt, forcing(s.t));
      adv += dt; n++;
      if (!s.reducePoll() && s.steps - s.stepsAtStats > 200) s.reduce();
    }
    s.reducePoll();
    s.reduceStart();
    const el = performance.now() - t0;
    gpuWait = gpuReady ? 0 : gpuWait + 1;
    if (el > 20 || realDt > 1 / 28 || gpuWait > 1) maxSteps = Math.max(1, Math.floor(maxSteps * 0.7));
    else if (s.reduceInFlight <= 1 && realDt < 1 / 50 && adv < target) maxSteps = Math.min(1500, Math.ceil(maxSteps * 1.04) + 1);
    if (s.t >= end - 1e-3) {
      s.reduce();
      running = false;
      node?.requestRender();
      emit(true);
      return;
    }
    node?.requestRender();
    emit();
  }

  // ---------------------------------------------------------------- удирдлага
  return {
    preload: () => prepare(),
    async start() {
      await prepare();
      if (!alive || !solver) return;
      if (solver.t >= tEnd() - 1e-3) { solver.reset(); resetCount++; }
      running = true;
      lastTick = performance.now();
      node?.requestRender();
      emit(true);
    },
    pause() {
      running = false;
      emit(true);
    },
    reset() {
      running = false;
      if (solver) { solver.reset(); resetCount++; }
      node?.requestRender();
      emit(true);
    },
    setPreset(id) {
      if (id === presetId) return;
      presetId = id;
      running = false;
      if (solver) { solver.reset(); resetCount++; }
      node?.requestRender();
      emit(true);
    },
    destroy() {
      alive = false;
      running = false;
      cancelAnimationFrame(raf);
      try { node?.destroy?.(); } catch (e) { console.error(e); }
      node = null;
      try { solver?.dispose(); } catch (e) { console.error(e); }
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      solver = gl = null;
    },
  };
}
