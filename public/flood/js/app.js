import { FloodSolver } from './solver.js';
import { loadArcGIS, MapController } from './arcgis.js';
import { drawChart } from './chart.js';
import { writeGeoTIFF } from './geotiff.js';
import { installHelp } from './help.js';
import { ImpactAnalyzer, CLASSES, riskLevel } from './impact.js';

const $ = id => document.getElementById(id);
const R = 6378137;
const themeColors = () => {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  return { rain: v('--rain'), rainFill: v('--rain'), accent: v('--accent'), warn: v('--warn'), danger: v('--danger'), speed: v('--speed') };
};
const toLonLat = (x, y) => [x / R * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI];

const PRESETS = [
  { name: 'Шиврээ', i: 3, d: 360, shape: 'uniform', lvl: 1 },
  { name: 'Бага', i: 8, d: 60, shape: 'uniform', lvl: 1 },
  { name: 'Аадар', i: 30, d: 60, shape: 'tri', lvl: 2 },
  { name: 'Хүчтэй', i: 50, d: 45, shape: 'tri', lvl: 3 },
  { name: 'Онц хүчтэй', i: 80, d: 60, shape: 'front', lvl: 4 },
  { name: 'Удаан', i: 6, d: 720, shape: 'uniform', lvl: 1 },
];
const fmtDur = m => m < 60 ? `${m} мин` : m % 60 ? `${(m / 60).toFixed(1)} цаг` : `${m / 60} цаг`;
const SOIL = { 1: 'хуурай хөрс', 0.6: 'дунд хөрс', 0.25: 'нойтон хөрс', 0: 'хөлдүү хөрс' };
const LEGENDS = {
  0: { title: 'Усны гүн, м', grad: 'linear-gradient(90deg,#9eebff,#40adff 7.5%,#1466e6 25%,#0d2ea6 50%,#380d73)', ticks: ['0', '0.3', '1', '2', '4+'] },
  1: { title: 'Урсгалын хурд, м/с', grad: 'linear-gradient(90deg,#4099ff,#33d98c 10%,#ffdb33 30%,#ff5926 60%,#b30059)', ticks: ['0', '0.5', '1.5', '3', '5+'] },
  2: { title: 'Үерийн аюулын зэрэг (DEFRA FD2320: гүн × (хурд + 0.5) + хог хаягдлын коэф.)', cls: [['#ffeb59', 'Бага < 0.75'], ['#ff9926', 'Дунд 0.75–1.25'], ['#ed3326', 'Их 1.25–2'], ['#8c0a47', 'Онц их > 2']] },
  3: { title: 'Симуляцийн хамгийн их гүн, м', grad: 'linear-gradient(90deg,#9eebff,#40adff 7.5%,#1466e6 25%,#0d2ea6 50%,#380d73)', ticks: ['0', '0.3', '1', '2', '4+'] },
  4: { title: 'Ус хүрэх хугацаа — бороо эхэлснээс хойш (гүн > 10 см)', grad: 'linear-gradient(90deg,#d90d40,#ff731a 15%,#ffe64d 35%,#4dccE6 60%,#334de6)', ticks: [] },
};

class App {
  constructor() {
    this.solver = null;
    this.data = null;
    this.grid = null;
    this.running = false;
    this.factor = 2;
    this.scn = { i: 30, d: 60, shape: 'tri', area: 'all', center: null, radiusKm: 6, soil: 0.6, manning: 1,
      tuulOn: false, tuulQ: 40, inflows: [], durH: 3, speed: 120, hortonK: 2 / 3600, drain: 10 };
    this.display = { mode: 0, thr: 0.05, opacity: 0.85, hill: 0, particles: true, buildings: false, buildings3d: true, waterStyle: 2, arrows: true };
    this.viewSnapshot = null;
    this.area = null;           // simulation area [xmin, ymin, xmax, ymax] EPSG:3857, null = whole data extent
    this.areaDraft = null;
    this.clickMode = 'probe';
    this.probeCell = null;
    this.probeXY = null;
    this.hoverCell = null;
    this.maxStepsPerFrame = 20;
    this.resetHistory();
  }

  // ------------------------------------------------------------------ setup
  async start() {
    this.bindUI();
    // solver gets its own WebGL2 context; the views only receive the packed visible window
    // OffscreenCanvas + transferToImageBitmap keeps the hand-over to the map's context on the GPU
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1024, 1024) : Object.assign(document.createElement('canvas'), { width: 1024, height: 1024 });
    this.gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: !cv.transferToImageBitmap, premultipliedAlpha: false, powerPreference: 'high-performance' });
    this.frameCache = {};
    try {
      if (!this.gl) throw new Error('Энэ хөтөч WebGL2 дэмжихгүй байна. Chrome / Edge-ийн сүүлийн хувилбарыг ашиглана уу.');
      const [data, E, impact] = await Promise.all([this.loadData(), loadArcGIS(), new ImpactAnalyzer().load()]);
      this.impact = impact;
      this.data = data;
      this.mapc = new MapController(this, E);
      this.createSolver();
      this.mapc.init(data.meta, $('view2d'), $('view3d'));
      this.mapc.updateOverlays();
      this.loop();
    } catch (e) { this.fail(e); }
  }

  loop() {
    const frame = () => {
      try { this.tick(); } catch (e) { console.error(e); }
      // 2D redraws are cheap; the SceneView paces its own water animation (see arcgis.js)
      if (this.running || this.hoverCell || (this.wantsAnimation() && this.mapc.mode === '2d')) this.mapc.requestRender();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  wantsAnimation() {
    const d = this.display;
    const wet = this.solver && this.solver.stats.wet > 0 && !this.viewSnapshot;
    return this.running || !!(wet && ((d.particles && d.mode <= 2) || (d.arrows && d.mode <= 2) || (d.waterStyle > 0 && d.mode === 0)));
  }

  displayState() {
    // the animated look carries its own flow streaks: no tracer lines on top of it in depth mode
    // arrows (or the animated look's own streaks) replace the white tracer lines
    const particles = this.display.particles && !this.display.arrows && !(this.display.waterStyle === 2 && this.display.mode === 0);
    return { ...this.display, particles, history: !!this.viewSnapshot, tmax: Math.max(this.solver ? this.solver.t : 60, 60) / 60 };
  }

  /** Called by the views: pack the visible part of the grid for extent (EPSG:3857) at ~pxW×pxH.
   *  Re-encodes only when the water state, the visible window or the display source changed. */
  frameFor(ext, pxW, pxH, viewId = '2d') {
    const s = this.solver, g = this.grid;
    if (!s || !g || !ext) return null;
    const c = g.cellMerc, pad = 2;
    let x0 = Math.max(0, Math.floor((ext.xmin - g.x0) / c) - pad), x1 = Math.min(g.W, Math.ceil((ext.xmax - g.x0) / c) + pad);
    let y0 = Math.max(0, Math.floor((g.y1 - ext.ymax) / c) - pad), y1 = Math.min(g.H, Math.ceil((g.y1 - ext.ymin) / c) + pad);
    if (x1 <= x0 || y1 <= y0) return null;
    const cv = this.gl.canvas;
    // canvas grows to the largest request (≤ 2048) and never shrinks: resizing reallocates the drawing buffer
    const cw = Math.min(2048, Math.ceil(pxW / 64) * 64), ch = Math.min(2048, Math.ceil(pxH / 64) * 64);
    if (cw > cv.width || ch > cv.height) { cv.width = Math.max(cv.width, cw); cv.height = Math.max(cv.height, ch); }
    // Each output pixel covers a fixed power-of-two block of cells aligned to the grid, so the grouping of cells
    // into pixels doesn't change while the camera moves (otherwise water outlines shimmer when panning / orbiting).
    let blk = 1;
    while ((x1 - x0) / blk > Math.max(pxW, 1) * 1.001 || (y1 - y0) / blk > Math.max(pxH, 1) * 1.001
           || Math.ceil((x1 - x0) / blk) + 1 > cv.width || Math.ceil((y1 - y0) / blk) + 1 > cv.height) blk *= 2;
    x0 = Math.floor(x0 / blk) * blk; y0 = Math.floor(y0 / blk) * blk;
    x1 = Math.ceil(x1 / blk) * blk; y1 = Math.ceil(y1 / blk) * blk;
    const ow = (x1 - x0) / blk, oh = (y1 - y0) / blk;
    const src = this.viewSnapshot && this.display.mode <= 2 ? 1 : this.display.mode >= 3 ? 2 : 0;
    const key = [this.resetCount, s.steps, g.key, x0, y0, x1, y1, ow, oh, src, this.viewSnapshot?.time].join('|');
    const cached = this.frameCache[viewId];
    if (cached && cached.key === key) return { frame: cached.frame, grid: g, reuse: true };
    const frame = s.encode(src, [x0, y0, x1, y1], ow, oh, src === 1 ? this.viewSnapshot : null);
    if (cv.transferToImageBitmap) frame.image = cv.transferToImageBitmap();
    this.frameCache[viewId] = { key, frame: { ...frame, image: null } };
    return { frame, grid: g };
  }

  async loadData() {
    const msg = t => ($('loadMsg').textContent = t);
    msg('meta.json…');
    const meta = await (await fetch('data/meta.json')).json();
    const bin = async (name, label) => {
      msg(`${label} ачаалж байна…`);
      const r = await fetch('data/' + name);
      if (!r.ok) throw new Error(name + ' олдсонгүй (' + r.status + ')');
      let buf = new Uint8Array(await r.arrayBuffer());
      if (buf[0] === 0x1f && buf[1] === 0x8b) {
        const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
        buf = new Uint8Array(await new Response(s).arrayBuffer());
      }
      return buf;
    };
    const demB = await bin('dem.f32', 'Өндрийн загвар (Copernicus GLO-30)');
    const dem = new Float32Array(demB.buffer, demB.byteOffset, meta.demW * meta.demH);
    const lc = await bin('lc.u8.gz', 'Газрын бүрхэвч (WorldCover)');
    const bld = await bin('bld.u8.gz', 'Барилга');
    const riv = await bin('riv.u8.gz', 'Гол горхи');
    msg('GPU бэлтгэж байна…');
    return { meta, dem, lc, bld, riv };
  }

  createSolver() {
    if (this.solver) this.solver.dispose();
    this.solver = null;
    this.solver = new FloodSolver(this.gl, this.data, { factor: this.factor, buildings: $('bldObs').checked, window: this.areaWindow() });
    const s = this.solver;
    $('gridInfo').textContent = `${s.W.toLocaleString()} × ${s.H.toLocaleString()} = ${(s.W * s.H / 1e6).toFixed(1)} сая нүд · нүд ≈ ${s.dx.toFixed(1)} м · ${(s.W * s.H * s.dx * s.dx / 1e6).toFixed(0)} км²`;
    this.refreshGrid();
    this.resetSim();
    this.updateAreaInfo();
    this.mapc?.updateOverlays();
    $('loading').classList.add('hide');
  }

  // ------------------------------------------------------------------ simulation area
  /** this.area (EPSG:3857) -> window on the fine data grid, clamped, at least ~1 km wide. */
  areaWindow() {
    if (!this.area) return null;
    const m = this.data.meta, [x0, y0, x1, y1] = this.area, minC = Math.ceil(1000 / m.groundScale / m.res);
    const cl = (v, hi) => Math.max(0, Math.min(hi, v));
    let fx0 = cl(Math.floor((x0 - m.x0) / m.res), m.W), fx1 = cl(Math.ceil((x1 - m.x0) / m.res), m.W);
    let fy0 = cl(Math.floor((m.y1 - y1) / m.res), m.H), fy1 = cl(Math.ceil((m.y1 - y0) / m.res), m.H);
    if (fx1 - fx0 < minC) { fx1 = Math.min(m.W, fx0 + minC); fx0 = Math.max(0, fx1 - minC); }
    if (fy1 - fy0 < minC) { fy1 = Math.min(m.H, fy0 + minC); fy0 = Math.max(0, fy1 - minC); }
    return [fx0, fy0, fx1, fy1];
  }

  setArea(area, fit = true) {
    const m = this.data.meta;
    // snap to the data grid and keep inside it
    this.area = area && [Math.max(area[0], m.x0), Math.max(area[1], m.y1 - m.H * m.res), Math.min(area[2], m.x0 + m.W * m.res), Math.min(area[3], m.y1)];
    if (this.area && (this.area[2] <= this.area[0] || this.area[3] <= this.area[1])) this.area = null;
    this.areaDraft = null;
    $('loading').classList.remove('hide'); $('loadMsg').textContent = 'Тооцох талбайг шинэчилж байна…';
    setTimeout(() => {
      try {
        this.createSolver();
        const g = this.grid, v = this.mapc.activeView;
        if (this.area && fit) v.goTo({ target: new this.mapc.E.Extent({ xmin: g.x0, ymin: g.y1 - g.H * g.cellMerc, xmax: g.x0 + g.W * g.cellMerc, ymax: g.y1,
          spatialReference: this.mapc.sr }).expand(1.15) }).catch(() => {});
      } catch (e) { this.fail(e); }
    }, 30);
  }

  /** The selected area as it is actually simulated (snapped to the grid), EPSG:3857 [xmin, ymin, xmax, ymax]. */
  areaRect() {
    const g = this.grid;
    return [g.x0, g.y1 - g.H * g.cellMerc, g.x0 + g.W * g.cellMerc, g.y1];
  }

  /** Which edge / corner of the selected area is under screen point (sx, sy): 'l', 'tr', … or null. */
  areaEdgeAt(view, sx, sy) {
    if (!this.area || !this.grid) return null;
    if (view.type === '3d') return this.areaHandle3d(view, sx, sy);
    const [x0, y0, x1, y1] = this.areaRect(), P = this.mapc.E.Point, sr = this.mapc.sr;
    const a = view.toScreen(new P({ x: x0, y: y1, spatialReference: sr })), b = view.toScreen(new P({ x: x1, y: y0, spatialReference: sr }));
    if (!a || !b) return null;
    const T = 9, inX = sx > a.x - T && sx < b.x + T, inY = sy > a.y - T && sy < b.y + T;
    if (Math.hypot(sx - (a.x + b.x) / 2, sy - (a.y + b.y) / 2) < 14) return 'move';   // centre handle
    let ed = '';
    if (inX && Math.abs(sy - a.y) < T) ed += 't';
    else if (inX && Math.abs(sy - b.y) < T) ed += 'b';
    if (inY && Math.abs(sx - a.x) < T) ed += 'l';
    else if (inY && Math.abs(sx - b.x) < T) ed += 'r';
    return ed || null;
  }

  /** Map point under a screen point; in 3D falls back to a ray / plane intersection at the area's ground level. */
  groundAt(view, sx, sy) {
    const p = view.toMap({ x: sx, y: sy });
    if (p || view.type !== '3d' || !this.grid) return p;
    const g = this.grid;
    return this.mapc.screenToGround(sx, sy, g.groundNat[(g.H >> 1) * g.W + (g.W >> 1)]);
  }

  /** 3D: the rectangle is a perspective quad on screen, so hit-test the 9 handles (corners, edge middles,
   *  centre) projected at ground height instead of the edges. */
  areaHandle3d(view, sx, sy) {
    const [x0, y0, x1, y1] = this.areaRect(), g = this.grid, P = this.mapc.E.Point, sr = this.mapc.sr;
    const zAt = (x, y) => {
      const cx = Math.min(g.W - 1, Math.max(0, Math.floor((x - g.x0) / g.cellMerc)));
      const cy = Math.min(g.H - 1, Math.max(0, Math.floor((g.y1 - y) / g.cellMerc)));
      return g.groundNat[cy * g.W + cx];
    };
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const hs = [['tl', x0, y1], ['tr', x1, y1], ['bl', x0, y0], ['br', x1, y0], ['t', mx, y1], ['b', mx, y0], ['l', x0, my], ['r', x1, my], ['move', mx, my]];
    let best = null, bd = 16;
    for (const [id, x, y] of hs) {
      const p = view.toScreen(new P({ x, y, z: zAt(x, y), spatialReference: sr }));
      if (!p) continue;
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  updateAreaInfo() {
    const s = this.solver, el = $('areaInfo');
    if (!s || !el) return;
    const w = s.W * s.dx / 1000, h = s.H * s.dx / 1000;
    let t = `${this.area ? 'Сонгосон' : 'Бүх хот'}: ${w.toFixed(1)} × ${h.toFixed(1)} км (${Math.round(w * h).toLocaleString()} км²)`;
    if (this.area) {
      t += `<span class="tip2">Хүрээний бариулаас чирж хэмжээг, голын ✥-ээс чирж байрлалыг өөрчилнө (2D, 3D).</span>`;
      t += `<span class="note">Гаднаас орох ус тооцогдохгүй — дээд талын жалгыг багтаагаарай.</span>`;
    }
    el.innerHTML = t;
  }

  /** Drag on the map in 'area' mode draws the simulation rectangle. */
  // the drag 'start' event fires only after the pointer has moved a few pixels, so the handle under the
  // cursor is decided at pointer-down
  onPointerDown(e, view) {
    this.pressEdge = this.clickMode === 'probe' ? this.areaEdgeAt(view, e.x, e.y) : null;
    const p = this.pressEdge && this.groundAt(view, e.x, e.y);
    this.pressMap = p ? [p.x, p.y] : null;
  }

  onMapDrag(e, view) {
    if (this.clickMode === 'probe' && this.area) {
      if (e.action === 'start' && this.pressEdge) this.resizing = { edge: this.pressEdge, rect: this.areaRect() };
      if (!this.resizing) return;
      e.stopPropagation();                       // the map must not pan while a handle is dragged
      const p = this.groundAt(view, e.x, e.y);
      if (p) {
        const r = [...this.resizing.rect], ed = this.resizing.edge;
        if (ed === 'move' && this.pressMap) {
          // shift the whole rectangle, kept inside the data extent
          const m = this.data.meta, X0 = m.x0, X1 = m.x0 + m.W * m.res, Y0 = m.y1 - m.H * m.res, Y1 = m.y1;
          const dx = Math.max(X0 - r[0], Math.min(X1 - r[2], p.x - this.pressMap[0]));
          const dy = Math.max(Y0 - r[1], Math.min(Y1 - r[3], p.y - this.pressMap[1]));
          r[0] += dx; r[2] += dx; r[1] += dy; r[3] += dy;
        }
        if (ed === 'move') { /* done above */ } else if (ed.includes('l')) r[0] = p.x;
        if (ed.includes('r')) r[2] = p.x;
        if (ed.includes('b')) r[1] = p.y;
        if (ed.includes('t')) r[3] = p.y;
        this.areaDraft = [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])];
        this.mapc.updateOverlays();
      }
      if (e.action === 'end') {
        const d = this.areaDraft, gs = this.data.meta.groundScale;
        this.resizing = null;
        if (d && (d[2] - d[0]) * gs >= 300 && (d[3] - d[1]) * gs >= 300) this.setArea(d, false);   // keep the view where it is
        else { this.areaDraft = null; this.mapc.updateOverlays(); }
      }
      return;
    }
    if (this.clickMode !== 'area') return;
    e.stopPropagation();                         // no panning while drawing
    const p = view.toMap({ x: e.x, y: e.y });
    if (!p) return;
    if (e.action === 'start') this.dragStart = [p.x, p.y];
    if (!this.dragStart) return;
    const [ax, ay] = this.dragStart;
    this.areaDraft = [Math.min(ax, p.x), Math.min(ay, p.y), Math.max(ax, p.x), Math.max(ay, p.y)];
    this.mapc.updateOverlays();
    if (e.action === 'end') {
      const d = this.areaDraft;
      this.dragStart = null;
      this.setClickMode('probe');
      if ((d[2] - d[0]) * this.data.meta.groundScale < 300 || (d[3] - d[1]) * this.data.meta.groundScale < 300) {
        this.areaDraft = null; this.mapc.updateOverlays(); return;       // a click, not a rectangle
      }
      this.setArea(d);
    }
  }

  refreshGrid() {
    this.frameCache = {};
    this.grid = this.solver.readGrid();
    this.mapc?.setGrid(this.grid);
  }

  fail(e) {
    console.error(e);
    const l = $('loading');
    l.classList.remove('hide'); l.classList.add('error');
    l.querySelector('.spin').style.display = 'none';
    $('loadMsg').textContent = 'Алдаа: ' + e.message + (location.protocol === 'file:' ? ' — хуудсыг run.bat-аар (локал сервер) нээнэ үү.' : '');
  }

  // ------------------------------------------------------------------ scenario
  rainRate(t) {           // m/s at sim time t
    const { i, d, shape } = this.scn, D = d * 60;
    if (t >= D) return 0;
    let mmh = i;
    if (shape === 'tri') { const tp = 0.35 * D; mmh = t < tp ? 2 * i * t / tp : 2 * i * (D - t) / (D - tp); }
    else if (shape === 'front') mmh = 2 * i * (1 - t / D);
    return mmh / 3.6e6;
  }

  rainCircleCells() {
    const s = this.solver;
    if (!s || this.scn.area !== 'circle' || !this.scn.center) return [0, 0, 0, 0];
    const c = this.cellOfMerc(...this.scn.center);
    return [c[0], c[1], this.scn.radiusKm * 1000 / s.dx, 1];
  }

  forcing(t) {
    const s = this.solver, sc = this.scn;
    const circle = this.rainCircleCells();
    const rainArea = circle[3] ? Math.PI * (circle[2] * s.dx) ** 2 : s.W * s.H * s.dx * s.dx;
    const inflows = [];
    const hw = Math.max(1, Math.round(25 / s.dx));
    let wallE = [1, 0];
    if (sc.tuulOn && this.tuulInside()) {
      const [fx, fy] = s.meta.tuulInflow;
      const cx = Math.floor((fx - s.off[0]) / s.F), cy = Math.floor((fy - s.off[1]) / s.F), half = Math.round(1600 / s.dx);
      inflows.push([cx + 0.5, cy + 0.5, sc.tuulQ, hw]);
      if (s.window[2] >= s.meta.W) wallE = [cy - half, cy + half];   // ±1.6 km of the valley at the east edge
    }
    for (const p of sc.inflows) {
      const c = this.cellOfMerc(...p.xy);
      inflows.push([Math.floor(c[0]) + 0.5, Math.floor(c[1]) + 0.5, p.q, hw]);
    }
    return { rain: this.rainRate(t), rainArea, circle, inflows, infMul: sc.soil, hortonK: sc.hortonK, tr: t,
      manning: sc.manning, theta: 0.8, drain: sc.drain, wallE };
  }

  tuulInside() {
    const s = this.solver, t = s?.meta.tuulInflow;
    return !!t && t[0] >= s.window[0] && t[0] < s.window[2] && t[1] >= s.window[1] && t[1] < s.window[3];
  }

  // ------------------------------------------------------------------ sim loop (called from the layer's prerender)
  tick() {
    const s = this.solver;
    if (!s) return;
    const now = performance.now();
    const realDt = Math.min((now - (this.lastTick || now)) / 1000, 0.1);
    this.lastTick = now;
    const tEnd = this.scn.durH * 3600;

    if (this.running) {
      const target = this.scn.speed * Math.max(realDt, 1 / 120);
      const t0 = performance.now();
      // GPU back-pressure: the fence issued after last frame's steps tells whether the GPU has caught up.
      // GL calls return immediately, so CPU time alone says nothing about GPU load; without this the GPU
      // queue grows until every frame takes half a second.
      s.reducePoll();
      const gpuReady = s.reduceInFlight < 4;
      const cap = gpuReady ? this.maxStepsPerFrame : 0;
      let adv = 0, n = 0;
      while (adv < target && n < cap && s.t < tEnd) {
        const dt = Math.min(s.suggestDt(), tEnd - s.t + 1e-3);
        s.step(dt, this.forcing(s.t));
        adv += dt; n++;
        if (s.t >= this.nextSnap) { s.snapshot(); this.nextSnap += this.snapInterval; }
        // dt comes from depth / speed statistics read back asynchronously; never run long on stale ones
        if (!s.reducePoll() && s.steps - s.stepsAtStats > 200) s.reduce();
        this.recordHistory();
      }
      s.reducePoll();
      s.reduceStart();
      const el = performance.now() - t0;
      // per-frame step budget: shrink when the GPU lags or the frame is slow, grow while it keeps up
      const slowFrame = realDt > (this.mapc?.mode === '3d' ? 1 / 28 : 1 / 40);
      this.gpuWait = gpuReady ? 0 : (this.gpuWait || 0) + 1;
      // Grow slowly and only while the GPU is clearly idle (≤ 1 fence pending, smooth frame); back off hard on a
      // slow frame. A fast sawtooth here shows up as a regular stutter.
      if (el > 20 || slowFrame || this.gpuWait > 1) this.maxStepsPerFrame = Math.max(1, Math.floor(this.maxStepsPerFrame * 0.7));
      else if (s.reduceInFlight <= 1 && realDt < 1 / 50 && adv < target) this.maxStepsPerFrame = Math.min(1500, Math.ceil(this.maxStepsPerFrame * 1.04) + 1);
      this.achieved = this.achieved * 0.9 + (adv / Math.max(realDt, 1e-3)) * 0.1;
      this.stepsPerFrame = n;
      if (!this.impact.pend && s.t - this.lastImpactT >= 300 && now - this.lastImpactReal > 2500) {
        this.impact.start(s); this.lastImpactT = s.t; this.lastImpactReal = now;
      }
      if (s.t >= tEnd - 1e-3) {
        s.reduce();
        this.recordHistory(true); this.setRunning(false); this.impact.cancel(); this.onImpact(this.impact.compute(s));
        this.alert('end', 'info', `Симуляци дууслаа: ${this.impact.result.total.toLocaleString()} барилга үерт өртсөн, хамгийн их гүн ${s.stats.hmax.toFixed(1)} м.`);
      }
      this.updateStatsUI();
    }

    // flooded buildings follow the impact results and the view: at most one refresh every 3 s
    if (this.affectedDirty && !this.affectedBusy && now - (this.lastAffected || 0) > 3000) this.refreshAffected();
    if (this.impact?.pend) { const r = this.impact.poll(); if (r) this.onImpact(r); }
    if (this.probeCell && (this.running || this.probeDirty)) { this.probeDirty = false; this.updateProbeUI(); }
    // hover read-out needs a GPU read-back: throttle it and skip it while the map is moving
    const v = this.mapc?.activeView;
    if (this.hoverCell && !/resize|move/.test($('mapStack').style.cursor) && now - (this.lastHover || 0) > 120 && !(v && (v.interacting || v.animation))) {
      this.lastHover = now;
      this.updateTooltip();
    }
  }

  recordHistory(force = false) {
    const s = this.solver, m = Math.floor(s.t / 60);
    if (!force && m <= this.lastHistMin) return;
    this.lastHistMin = m;
    const tm = s.t / 60;
    const rain = this.rainRate(Math.max(0, s.t - 1)) * 3.6e6, wet = s.stats.wetArea / 1e6 || 0;
    const prev = this.hist[this.hist.length - 1];
    this.hist.push([tm, rain, wet]);
    if (this.probeCell) {
      const p = s.probe(...this.probeCell);
      this.probeHist.push([tm, p.h, p.v]);
      if (p.h > 0.3) this.alert('probe03', 'warn', `Сонгосон цэгт усны гүн 0.3 м давлаа — машинд аюултай.`);
      if (p.h > 0.5) this.alert('probe05', 'danger', `Сонгосон цэгт усны гүн 0.5 м давлаа — явган хүнд аюултай.`);
    }
    // events
    if (this.scn.shape === 'tri' && prev && rain > 0 && rain < prev[1] - 1e-6) this.alert('rainpeak', 'info', `Бороо оргил эрчимдээ хүрлээ: ${prev[1].toFixed(0)} мм/ц.`);
    if (prev && prev[1] > 0 && rain === 0) this.alert('rainend', 'info', `Бороо зогслоо. Нийт ${this.cumRain(s.t).toFixed(0)} мм хур орсон.`);
    for (const [a, lvl] of [[5, 'info'], [25, 'warn'], [50, 'warn'], [100, 'danger']])
      if (wet >= a) this.alert('wet' + a, lvl, `Усанд автсан талбай ${a} км²-ээс давлаа.`);
    if (s.stats.vmax > 3) this.alert('v3', 'warn', `Урсгалын хурд ${s.stats.vmax.toFixed(1)} м/с хүрлээ — хүн, машин урсгах аюултай.`);
    this.chartsDirty = true;
  }

  // ------------------------------------------------------------------ impact, risk, alerts
  onImpact(r) {
    const deep = r.counts[2] + r.counts[3];
    if (r.total) this.alert('b1', 'warn', `Анхны барилга үерт өртлөө.`);
    if (deep) this.alert('b05', 'danger', `Барилгын дэргэд 0.5 м-ээс гүн ус — 1-р давхарт ус орох эрсдэл.`);
    for (const n of [100, 1000, 10000]) if (r.total >= n) this.alert('bn' + n, n >= 1000 ? 'danger' : 'warn', `${n.toLocaleString()}-аас олон барилга үерт өртлөө.`);
    this.renderRisk();
    this.affectedDirty = true;
  }

  onViewStill() { if (this.impact?.result) this.affectedDirty = true; }

  /** Colour the flooded buildings in the current view (nearest first, up to 8,000 in 2D / 15,000 in 3D). */
  async refreshAffected() {
    this.affectedDirty = false;
    this.affectedBusy = true;
    this.lastAffected = performance.now();
    try {
      const v = this.mapc.activeView, e = v.extent, m = this.solver.meta;
      // 3D: favour the foreground — a point 45 % of the way from under the camera to the look-at point; 2D: the centre
      const cam = v.type === '3d' && v.camera?.position;
      const c = cam && v.center ? { x: cam.x + 0.45 * (v.center.x - cam.x), y: cam.y + 0.45 * (v.center.y - cam.y) } : v.center;
      // a tilted SceneView's extent covers only part of what is visible: in 3D select by distance alone
      const box = e && v.type !== '3d' ? [e.xmin - m.x0, m.y1 - e.ymax, e.xmax - m.x0, m.y1 - e.ymin] : null;
      const center = c ? [c.x - m.x0, m.y1 - c.y] : null;       // over the limit, the closest buildings are kept
      const limit = v.type === '3d' ? 4000 : 8000;      // 3D extrusions (and the base-layer filter) are costly               // footprints are cached, only new ones are fetched
      await this.mapc.syncAffected(this.impact.result ? this.impact.affected(limit, box, center) : []);
    } finally { this.affectedBusy = false; }
  }

  renderRisk() {
    const r = this.impact?.result, k = riskLevel(r);
    const b = $('riskBadge');
    b.dataset.level = k.level; b.textContent = k.name;
    $('riskText').textContent = k.text;
    $('bldTotal').textContent = (r ? r.total : 0).toLocaleString();
    const tot = Math.max(1, r ? r.total : 0);
    $('bldBar').innerHTML = CLASSES.map((c, i) => `<div style="width:${r ? 100 * r.counts[i] / tot : 0}%;background:${c.color}" title="${c.name}"></div>`).join('');
    $('bldLegend').innerHTML = CLASSES.map((c, i) => `<li style="--c:${c.color}" title="${c.note}">${c.name}<b>${r ? r.counts[i].toLocaleString() : 0}</b></li>`).join('');
  }

  alert(key, level, text) {
    if (this.fired.has(key)) return;
    this.fired.add(key);
    this.alerts.unshift({ t: this.solver.t, level, text });
    this.renderAlerts();
  }

  renderAlerts() {
    const ul = $('alerts');
    if (!ul) return;
    ul.innerHTML = this.alerts.length
      ? this.alerts.slice(0, 40).map(a => `<li class="lv-${a.level}"><span class="dot"></span><span>${a.text}</span><time>${this.fmtClock(a.t).slice(0, 5)}</time></li>`).join('')
      : '<li class="empty">Симуляци явахад чухал үйл явдлууд энд бүртгэгдэнэ.</li>';
  }

  resetHistory() {
    this.alerts = [];
    this.fired = new Set();
    this.lastImpactT = 0;
    this.lastImpactReal = 0;
    this.hist = [];
    this.probeHist = [];
    this.lastHistMin = -1;
    this.achieved = 0;
  }

  resetSim() {
    const s = this.solver;
    this.resetCount = (this.resetCount || 0) + 1;
    this.setRunning(false);
    s.reset();
    this.resetHistory();
    const tEnd = this.scn.durH * 3600;
    this.snapInterval = Math.max(120, Math.ceil(tEnd / s.maxSnaps / 60) * 60);
    this.nextSnap = this.snapInterval;
    this.viewSnapshot = null;
    if (this.impact) { this.impact.cancel(); this.impact.result = null; }
    this.affectedDirty = false;
    this.mapc?.clearAffected();
    this.runSig = null;
    this.updateSummary();
    this.renderRisk();
    this.renderAlerts();
    this.updateStatsUI();
    this.updateTimeUI();
    this.mapc?.requestRender();
  }

  setRunning(on) {
    if (on && this.solver && this.solver.t >= this.scn.durH * 3600 - 1e-3) return;
    this.running = on;
    if (on) {
      this.viewSnapshot = null; this.lastTick = performance.now(); this.mapc?.requestRender();
      const sc = this.scn;
      if (this.solver.t === 0) this.runSig = [sc.i, sc.d, sc.shape, sc.area, sc.center, sc.radiusKm].join('|');
    }
    const b = $('play');
    b.textContent = on ? '⏸ Түр зогсоох' : (this.solver && this.solver.t > 0 ? '▶ Үргэлжлүүлэх' : '▶ Эхлүүлэх');
    b.classList.toggle('running', on);
  }

  // ------------------------------------------------------------------ geometry (EPSG:3857 metres)
  cellOfMerc(x, y) {
    const s = this.solver;
    return [(x - s.x0) / s.cellMerc, (s.y1 - y) / s.cellMerc];
  }
  cellOf(x, y) {
    if (!this.solver) return null;
    const [cx, cy] = this.cellOfMerc(x, y).map(Math.floor);
    return cx >= 0 && cy >= 0 && cx < this.solver.W && cy < this.solver.H ? [cx, cy] : null;
  }

  onMapClick(x, y) {
    if (!this.solver) return;
    if (this.clickMode === 'rain') {
      this.scn.center = [x, y];
      this.setClickMode('probe');
      this.updateSummary();
    } else if (this.clickMode === 'inflow') {
      if (!this.cellOf(x, y)) return;
      this.scn.inflows.push({ xy: [x, y], q: 20 });
      this.renderInflows();
      this.setClickMode('probe');
    } else {
      if (!$('probeBox')) return;           // point-analysis card removed: hovering shows depth / speed instead
      const c = this.cellOf(x, y);
      if (!c) return;
      this.probeCell = c;
      this.probeXY = [x, y];
      this.probeHist = [];
      this.probeDirty = true;
      $('probeBox').hidden = false;
      const [lon, lat] = toLonLat(x, y);
      $('probeHint').textContent = `Цэг: ${lat.toFixed(5)}°N, ${lon.toFixed(5)}°E`;
    }
    this.mapc.updateOverlays();
    this.mapc.requestRender();
  }

  onHover(xy, px) {
    this.hoverCell = xy ? this.cellOf(...xy) : null;
    this.hoverPx = px;
    if (this.clickMode === 'probe' && !this.resizing && px) {
      const ed = this.areaEdgeAt(this.mapc.activeView, px.x, px.y);
      const cur = !ed ? '' : ed === 'move' ? 'move' : ed.length === 2 ? (ed === 'tl' || ed === 'br' ? 'nwse-resize' : 'nesw-resize') : (ed === 'l' || ed === 'r' ? 'ew-resize' : 'ns-resize');
      $('mapStack').style.cursor = cur;
      if (ed) $('tip').hidden = true;
    }
    if (!this.hoverCell) $('tip').hidden = true;
  }

  setClickMode(m) {
    this.clickMode = m;
    const el = $('clickMode');
    el.hidden = m === 'probe';
    el.textContent = { rain: 'Аадрын төвийг зураг дээр дарж сонгоно уу (Esc — болих)', inflow: 'Урсац орох цэгийг дарж сонгоно уу (Esc — болих)',
      area: 'Тооцох талбайг газрын зураг дээр чирж тэгш өнцөгтөөр зурна уу (Esc — болих)' }[m] || '';
    $('mapStack').style.cursor = m === 'probe' ? '' : 'crosshair';
    if (m !== 'area' && this.areaDraft && !this.dragStart) { this.areaDraft = null; this.mapc?.updateOverlays(); }
  }

  renderInflows() {
    const ul = $('inflowList');
    ul.innerHTML = '';
    this.scn.inflows.forEach((p, i) => {
      const [lon, lat] = toLonLat(...p.xy);
      const li = document.createElement('li');
      li.innerHTML = `<span>Цэг ${i + 1} · ${lat.toFixed(3)}, ${lon.toFixed(3)}</span>
        <input type="number" min="0" step="1" value="${p.q}" title="м³/с"><button title="Устгах">✕</button>`;
      li.querySelector('input').oninput = ev => { p.q = Math.max(0, +ev.target.value || 0); };
      li.querySelector('button').onclick = () => { this.scn.inflows.splice(i, 1); this.renderInflows(); this.mapc.updateOverlays(); };
      ul.appendChild(li);
    });
  }

  // ------------------------------------------------------------------ UI
  bindUI() {
    installHelp();
    const seg = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        fn(b.dataset.v);
      });
    };
    const setSeg = (id, v) => $(id)?.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === String(v)));
    const range = (id, fn, fmt = v => v) => {
      const el = $(id);
      if (!el) return null;
      const upd = () => {
        const v = +el.value; const t = $(id + 'v'); if (t) t.textContent = fmt(v);
        el.style.setProperty('--p', `${(v - el.min) / (el.max - el.min) * 100}%`);
        fn(v);
      };
      el.addEventListener('input', upd);
      upd();
      return el;
    };

    seg('res', v => { this.factor = +v; if (this.solver) { $('loading').classList.remove('hide'); $('loadMsg').textContent = 'Тор шинэчилж байна…'; setTimeout(() => { try { this.createSolver(); } catch (e) { this.fail(e); } }, 30); } });
    $('bldObs').onchange = () => { if (this.solver) { this.solver.buildGrid($('bldObs').checked); this.refreshGrid(); this.resetSim(); } };

    seg('domain', v => {
      $('customArea').hidden = v !== 'custom';
      if (v === 'all') { this.setClickMode('probe'); if (this.area) this.setArea(null); }
      else if (!this.area) this.startAreaDraw();
    });
    const markCustom = () => { setSeg('domain', 'custom'); $('customArea').hidden = false; };
    $('areaDraw').onclick = () => { markCustom(); this.startAreaDraw(); };
    $('areaView').onclick = () => {
      markCustom();
      const e = this.mapc.view2d.extent;                 // the 2D view: a tilted 3D extent isn't the visible area
      if (this.mapc.mode === '3d') { const c = this.mapc.view3d.center, r = this.mapc.view3d.scale / 3000; this.setArea([c.x - r, c.y - r, c.x + r, c.y + r]); }
      else this.setArea([e.xmin, e.ymin, e.xmax, e.ymax]);
    };
    $('moreBox').addEventListener('toggle', () => this.updateRainUI());
    const presets = $('presets');
    for (const p of PRESETS) {
      const b = document.createElement('button');
      b.innerHTML = `<b>${p.name}</b><span>${p.i} мм/ц · ${fmtDur(p.d)}</span>`;
      b.title = `${p.name}: ${p.i} мм/ц, ${fmtDur(p.d)}`;
      b.onclick = () => {
        $('rainI').value = p.i; $('rainD').value = p.d;
        $('rainI').dispatchEvent(new Event('input')); $('rainD').dispatchEvent(new Event('input'));
        this.scn.shape = p.shape; setSeg('rainShape', p.shape); this.updateRainUI();
        presets.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      };
      presets.appendChild(b);
    }
    range('rainI', v => { this.scn.i = v; this.updateRainUI(); });
    range('rainD', v => { this.scn.d = v; this.updateRainUI(); }, v => v >= 120 ? `${v} (${(v / 60).toFixed(1)} ц)` : v);
    seg('rainShape', v => { this.scn.shape = v; this.updateRainUI(); });
    seg('rainArea', v => {
      this.scn.area = v;
      $('radiusField').hidden = v !== 'circle';
      if (v === 'circle') {
        if (!this.scn.center) { const c = this.mapc.activeView.center; this.scn.center = [c.x, c.y]; }
        this.setClickMode('rain');
      } else this.setClickMode('probe');
      this.mapc?.updateOverlays();
      this.updateSummary();
    });
    range('rainR', v => { this.scn.radiusKm = v; this.mapc?.updateOverlays(); this.updateSummary(); });
    seg('soil', v => { this.scn.soil = +v; this.updateSummary(); });
    range('man', v => { this.scn.manning = v; }, v => v.toFixed(1));
    range('drain', v => { this.scn.drain = v; this.updateSummary(); });
    $('tuulOn').onchange = e => { this.scn.tuulOn = e.target.checked; $('tuulField').hidden = !e.target.checked; this.updateSummary(); };
    range('tuulQ', v => { this.scn.tuulQ = v; this.updateSummary(); });
    $('addInflow').onclick = () => this.setClickMode('inflow');
    range('dur', v => {
      this.scn.durH = v;
      this.updateSummary?.();
      if (this.solver) this.updateTimeUI();
      if (this.hist) this.chartsDirty = true;
    }, v => v);
    // playback speed: 4 simple choices, fine-tuning slider under "advanced" (log scale 1×–3600×)
    const speedLabel = sp => sp < 60 ? `${sp} сек` : sp < 3600 ? `${+(sp / 60).toFixed(sp < 600 ? 1 : 0)} мин` : `${+(sp / 3600).toFixed(1)} цаг`;
    $('speed').value = 58;
    range('speed', v => {
      const sp = Math.round(Math.pow(3600, v / 100));
      this.scn.speed = sp;
      $('speedTxt').textContent = speedLabel(sp);
      setSeg('speedSeg', ['30', '120', '600', '3600'].find(x => Math.abs(Math.log(+x / sp)) < 0.08) ?? '');
    }, v => Math.round(Math.pow(3600, v / 100)));
    seg('speedSeg', v => {
      const el = $('speed');
      el.value = Math.round(100 * Math.log(+v) / Math.log(3600));
      el.dispatchEvent(new Event('input'));
      this.scn.speed = +v;                      // exact value (the slider is integer-stepped)
      $('speedTxt').textContent = speedLabel(+v); $('speedv').textContent = v;
      setSeg('speedSeg', v);
    });
    $('speedSeg').querySelector('[data-v="120"]').click();   // default: 1 s = 2 min
    $('play').onclick = () => this.setRunning(!this.running);
    $('reset').onclick = () => this.solver && this.resetSim();

    $('timeline').addEventListener('input', e => {
      const s = this.solver;
      if (!s) return;
      this.setRunning(false);
      const T = +e.target.value / 1000 * this.scn.durH * 3600;
      if (T >= s.t - 1 || !s.snaps.length) this.viewSnapshot = null;
      else {
        let best = s.snaps[0];
        for (const sn of s.snaps) if (sn.time <= T + 1) best = sn;
        this.viewSnapshot = best.time >= s.t - 1 ? null : best;
      }
      this.updateTimeUI(T);
      this.mapc?.requestRender();
    });

    const rr = () => this.mapc?.requestRender();
    seg('mode', v => { this.display.mode = +v; this.updateLegend(); rr(); });
    range('thr', v => { this.display.thr = v / 100; rr(); });
    range('op', v => { this.display.opacity = v / 100; rr(); });
    range('hill', v => { this.display.hill = v / 100; rr(); });
    const onChange = (id, fn) => { const el = $(id); if (el) el.onchange = fn; };
    onChange('parts', e => { this.display.particles = e.target.checked; rr(); });
    onChange('showBld', e => { this.display.buildings = e.target.checked; rr(); });
    $('arrowsBtn').onclick = () => {
      this.display.arrows = !this.display.arrows;
      $('arrowsBtn').classList.toggle('on', this.display.arrows);
      rr();
    };
    seg('waterStyle', v => { this.display.waterStyle = +v; this.updateLegend(); rr(); });
    onChange('bld3d', e => { this.display.buildings3d = e.target.checked; this.mapc?.setBuildings3d(e.target.checked); });
    // суурь зургийн цуглуулга нь Esri-ийн виджет (arcgis.js _basemapGallery), 2026-10-08
    seg('viewMode', async v => {
      $('view3d').hidden = v !== '3d';
      $('view2d').hidden = v === '3d';
      document.body.classList.toggle('is3d', v === '3d');
      await this.mapc?.setMode(v, $('view3d'));
    });
    this.exportWhich = 'hmax';
    onChange('exportSel', e => { this.exportWhich = e.target.value; });
    $('themeToggle').onclick = () => {
      const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem('flood-theme', t); } catch (e) { /* storage blocked */ }
      this.chartsDirty = true; this.drawCharts(); this.updateRainUI();
      $('esriTheme').href = `https://js.arcgis.com/4.34/esri/themes/${t}/main.css`;
      this.mapc?.applyTheme();
    };
    if ($('export')) $('export').onclick = () => this.exportTiff();
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.setClickMode('probe');
      if (e.key === ' ' && e.target.tagName !== 'INPUT') { e.preventDefault(); this.setRunning(!this.running); }
    });
    window.addEventListener('resize', () => { this.chartsDirty = true; this.drawCharts(); });
    this.updateLegend();
    this.updateRainUI();
    setInterval(() => this.drawCharts(), 250);
  }

  startAreaDraw() {
    if (this.mapc?.mode === '3d') $('viewMode').querySelector('[data-v="2d"]').click();   // drawing works on the 2D map
    this.setClickMode('area');
  }

  /** One-line plain-language description of the scenario, above the Start button. */
  updateSummary() {
    const sc = this.scn, el = $('scnSummary');
    if (!el) return;
    const p = PRESETS.find(p => p.i === sc.i && p.d === sc.d && p.shape === sc.shape);
    const rain = `<b>${p ? p.name + ' · ' : ''}${sc.i} мм/ц · ${fmtDur(sc.d)}</b>`;
    const tuul = sc.tuulOn ? (this.solver && !this.tuulInside() ? 'Туул: орох цэг талбайгаас гадуур' : `Туул ${sc.tuulQ} м³/с`) : null;
    const where = this.area && this.solver ? `${Math.round(this.solver.W * this.solver.H * this.solver.dx ** 2 / 1e6).toLocaleString()} км²` : 'бүх хот';
    const extra = [where, SOIL[sc.soil], tuul].filter(Boolean).join(' · ');
    // rain settings are baked into what has already been simulated: say so if they change mid-run
    const sig = [sc.i, sc.d, sc.shape, sc.area, sc.center, sc.radiusKm].join('|');
    const stale = this.solver && this.solver.t > 0 && this.runSig && sig !== this.runSig;
    el.innerHTML = `${rain} · ${extra} · ${sc.durH} цаг` +
      (stale ? `<span class="stale">⚠ Бороо өөрчлөгдсөн — ↺ дарж шинээр эхлүүлнэ үү.</span>` : '');
    $('reset').classList.toggle('attn', !!stale);
  }

  updateRainUI() {
    const { i, d, shape } = this.scn;
    this.updateSummary();
    const match = PRESETS.findIndex(p => p.i === i && p.d === d && p.shape === shape);
    $('presets').querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === match));
    $('rainTotal').textContent = (i * d / 60).toFixed(0);
    $('rainPeak').textContent = (shape === 'uniform' ? i : 2 * i).toFixed(0);
    const c = $('hyeto');
    const data = [];
    for (let k = 0; k <= 60; k++) { const t = k / 60 * d * 60; data.push([t / 60, this.rainRate(t) * 3.6e6]); }
    const col = themeColors();
    drawChart(c, { xmax: d, left: 'мм/ц', series: [{ data, fill: col.rain, color: col.rain }, { data, color: col.rain, label: 'Бороо', unit: 'мм/ц', digits: 0 }] });
  }

  updateLegend() {
    const L = { ...LEGENDS[this.display.mode] };
    $('waterStyle').style.display = this.display.mode === 0 ? '' : 'none';     // the look only applies to depth
    $('arrowsBtn').style.display = this.display.mode <= 2 ? '' : 'none';
    if (this.display.mode === 0 && this.display.waterStyle !== 0) {
      L.title = this.display.waterStyle === 2 ? 'Ус — цагаан зураас урсгалын чиглэл, хурдыг харуулна' : 'Ус — бодит дүрслэл';
      L.grad = this.display.waterStyle === 2 ? 'linear-gradient(90deg,#4db8db,#1c7ac7 45%,#0d408f)' : 'linear-gradient(90deg,#335c70,#0d1f3a)';
      L.ticks = ['гүехэн', '', '', '', 'гүн'];
    }
    if (this.display.mode === 4) {           // arrival colours are stretched over the time simulated so far
      const T = Math.max(this.solver ? this.solver.t : 0, 60) / 60;
      L.ticks = [0, 0.25, 0.5, 0.75, 1].map(f => (f * T >= 120 ? `${(f * T / 60).toFixed(1)}ц` : `${Math.round(f * T)}м`));
    }
    this.legendT = this.solver?.t;
    let h = `<div>${L.title}</div>`;
    if (L.grad) h += `<div class="bar" style="background:${L.grad}"></div><div class="ticks">${L.ticks.map(t => `<span>${t}</span>`).join('')}</div>`;
    else h += `<div class="cls" style="margin-top:5px">${L.cls.map(([c, t]) => `<span style="--c:${c}">${t}</span>`).join('')}</div>`;
    $('legend').innerHTML = h;
  }

  fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  updateTimeUI(viewT = null) {
    const s = this.solver, tEnd = this.scn.durH * 3600;
    const t = viewT ?? s.t;
    $('clock').textContent = this.fmtClock(this.viewSnapshot ? this.viewSnapshot.time : t);
    $('clockOf').textContent = '/ ' + this.fmtClock(tEnd);
    if (viewT == null) $('timeline').value = Math.round(Math.min(1, s.t / tEnd) * 1000);
    $('prog').style.width = `${Math.min(100, s.t / tEnd * 100)}%`;
    const tl = $('timeline');
    tl.style.setProperty('--p', `${tl.value / 10}%`);
    const tag = $('viewTag');
    tag.textContent = this.viewSnapshot ? 'Түүх' : (this.running ? 'Шууд' : s.t > 0 ? 'Зогссон' : 'Бэлэн');
    tag.classList.toggle('hist', !!this.viewSnapshot);
  }

  updateStatsUI() {
    const s = this.solver, st = s.stats;
    const cum = this.cumRain(s.t);
    $('sRain').textContent = (this.rainRate(s.t) * 3.6e6).toFixed(1);
    $('sRainCum').textContent = cum.toFixed(1);
    $('sWet').textContent = ((st.wetArea || 0) / 1e6).toFixed(2);
    $('sVol').textContent = (st.vol / 1e6).toFixed(2);
    $('sHmax').textContent = st.hmax.toFixed(2);
    $('sVmax').textContent = st.vmax.toFixed(2);
    if (this.display.mode === 4 && Math.abs((this.legendT || 0) - s.t) > 30) this.updateLegend();
    const bal = s.rainVol + s.inflowVol;
    $('perf').textContent = `dt ${s.lastDt.toFixed(2)} с · ${this.stepsPerFrame || 0} алхам/кадр · бодит хурд ${Math.round(this.achieved)}× · нийт ${s.steps.toLocaleString()} алхам` +
      (bal > 0 ? ` · орсон ус ${(bal / 1e6).toFixed(2)} сая м³, гадаргад ${(100 * st.vol / bal).toFixed(0)}%` : '');
    this.updateTimeUI();
  }

  cumRain(t) {           // mm fallen up to t (analytic integral of the hyetograph)
    let sum = 0;
    const n = 200, D = Math.min(t, this.scn.d * 60);
    for (let k = 0; k < n; k++) sum += this.rainRate((k + 0.5) / n * D) * D / n;
    return sum * 1000;
  }

  updateProbeUI() {
    const s = this.solver, p = s.probe(...this.probeCell);
    $('pH').textContent = p.h.toFixed(2);
    $('pV').textContent = p.v.toFixed(2);
    $('pW').textContent = (p.z + p.h).toFixed(1);
    $('pHm').textContent = p.hmax.toFixed(2);
    $('pArr').textContent = p.arrival >= 0 ? p.arrival.toFixed(0) : '—';
    const hr = p.hazard;
    $('pHz').textContent = hr <= 0 ? '—' : hr < 0.75 ? 'Бага' : hr < 1.25 ? 'Дунд' : hr < 2 ? 'Их' : 'Онц их';
    this.chartsDirty = true;
  }

  updateTooltip() {
    const s = this.solver, c = this.hoverCell, tip = $('tip');
    const p = s.probe(...c);
    tip.hidden = false;
    tip.style.left = this.hoverPx.x + 'px';
    tip.style.top = this.hoverPx.y + 'px';
    tip.innerHTML = p.building
      ? `Барилга (усыг нэвтрүүлэхгүй) · газрын өндөр ${p.z.toFixed(1)} м`
      : p.h > 0.005
        ? `<b>${p.h.toFixed(2)} м</b> гүн · ${p.v.toFixed(2)} м/с · газрын өндөр ${p.z.toFixed(1)} м`
        : `Хуурай · газрын өндөр ${p.z.toFixed(1)} м`;
  }

  drawCharts() {
    if (!this.chartsDirty || !this.solver) return;
    this.chartsDirty = false;
    const xmax = this.scn.durH * 60, c = themeColors(), now = this.solver.t / 60;
    drawChart($('chartDomain'), { xmax, cursor: now, left: 'Бороо, мм/ц', right: 'Усанд автсан, км²',
      empty: '▶ Эхлүүлэхэд энд бороо ба үерийн явц гарна', series: [
        { data: this.hist.map(h => [h[0], h[1]]), color: c.rain, fill: c.rain, axis: 'left', label: 'Бороо', unit: 'мм/ц', digits: 1 },
        { data: this.hist.map(h => [h[0], h[2]]), color: c.accent, axis: 'right', label: 'Автсан талбай', unit: 'км²', digits: 2, min: 1 },
      ] });
    if (this.probeCell) drawChart($('chartProbe'), { xmax, cursor: now, left: 'Гүн, м', right: 'Хурд, м/с',
      refs: [{ y: 0.5, label: '0.5 м — явган хүнд аюултай', color: c.danger }, { y: 0.3, label: '0.3 м — машинд аюултай', color: c.warn }],
      empty: 'Симуляци явахад энэ цэгийн гүн, хурд энд гарна', series: [
        { data: this.probeHist.map(h => [h[0], h[1]]), color: c.accent, axis: 'left', label: 'Гүн', unit: 'м', digits: 2, min: 0.6 },
        { data: this.probeHist.map(h => [h[0], h[2]]), color: c.speed, axis: 'right', label: 'Хурд', unit: 'м/с', digits: 2, min: 1 },
      ] });
  }

  exportTiff() {
    const s = this.solver;
    if (!s) return;
    const which = this.exportWhich;
    const [layer, ch] = { hmax: ['max', 0], vmax: ['max', 1], arr: ['max', 2], hz: ['max', 3], h: ['h', 0] }[which];
    const rows = [];
    s.readLayer(layer, ch, (y, n, arr) => {
      if (which === 'arr') for (let i = 0; i < arr.length; i++) if (arr[i] < 0) arr[i] = -9999;
      rows.push(arr);
    });
    const blob = writeGeoTIFF({ width: s.W, height: s.H, rows, x0: s.x0, y1: s.y1, res: s.cellMerc });
    const names = { hmax: 'max_gun_m', vmax: 'max_hurd_ms', arr: 'us_hurekh_min', hz: 'aiul_HR', h: 'gun_m' };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `UB_uer_${names[which]}_${Math.round(s.dx)}m_t${Math.round(s.t / 60)}min.tif`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
}

const app = new App();
window.floodApp = app;   // for debugging from the console
app.start();
