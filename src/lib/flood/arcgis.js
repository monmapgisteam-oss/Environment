// ArcGIS Maps SDK for JavaScript views: 2D MapView + 3D local SceneView (EPSG:3857).
// ⚠ SDK-г платформын ачаалагч (`lib/arcgis-sdk.ts`, CDN 4.33) өгнө — эх апп 4.34-ийг өөрөө
// ачаалдаг байсан; нэг баримтад хоёр хувилбар байж болохгүй.
// Water is drawn by WaterRenderer: in 2D through a custom BaseLayerViewGL2D, in 3D through a RenderNode.
// The 3D ground is our own DEM (same surface the solver uses), so water never floats or sinks.
import { WaterRenderer } from './renderer.js';
import { CLASSES } from './impact.js';
import { esriModules } from '@/lib/arcgis-sdk';

const MODULES = [
  'esri/Map', 'esri/views/MapView', 'esri/views/SceneView', 'esri/layers/Layer',
  'esri/views/2d/layers/BaseLayerViewGL2D', 'esri/views/3d/webgl/RenderNode', 'esri/views/3d/webgl',
  'esri/layers/BaseElevationLayer', 'esri/layers/support/TileInfo', 'esri/Ground',
  'esri/layers/GraphicsLayer', 'esri/Graphic', 'esri/geometry/Extent', 'esri/geometry/Polyline',
  'esri/geometry/Point', 'esri/geometry/Circle', 'esri/layers/FeatureLayer', 'esri/geometry/SpatialReference',
  'esri/Basemap', 'esri/geometry/Polygon',
  // Esri-ийн суурь зургийн цуглуулга (хэрэглэгч 2026-10-08)
  'esri/widgets/BasemapGallery', 'esri/widgets/Expand', 'esri/widgets/BasemapGallery/support/LocalBasemapsSource',
  'esri/core/reactiveUtils',
];

export const BASEMAPS = [
  ['satellite', 'Дагуул'], ['hybrid', 'Хосолсон'], ['topo-vector', 'Топо'],
  ['streets-vector', 'Гудамж'], ['gray-vector', 'Саарал'], ['dark-gray-vector', 'Харанхуй'],
];

const BUILDINGS_URL = 'https://services.arcgis.com/HJzgwvlNIXssnQar/arcgis/rest/services/merged_buildings_arkhai/FeatureServer/0';

// building height = total floors × 3 m (missing / implausible values -> one storey)
const FLOORS = 'Нийт_давхарын_тоо';
const HEIGHT_ARCADE = `var v = Number($feature["${FLOORS}"]);
return IIf(IsNan(v) || v <= 0 || v >= 80, 3, v * 3);`;

function inv4(m) {         // column-major 4x4 inverse (cofactors)
  const a = m, o = new Float64Array(16);
  o[0] = a[5]*a[10]*a[15] - a[5]*a[11]*a[14] - a[9]*a[6]*a[15] + a[9]*a[7]*a[14] + a[13]*a[6]*a[11] - a[13]*a[7]*a[10];
  o[4] = -a[4]*a[10]*a[15] + a[4]*a[11]*a[14] + a[8]*a[6]*a[15] - a[8]*a[7]*a[14] - a[12]*a[6]*a[11] + a[12]*a[7]*a[10];
  o[8] = a[4]*a[9]*a[15] - a[4]*a[11]*a[13] - a[8]*a[5]*a[15] + a[8]*a[7]*a[13] + a[12]*a[5]*a[11] - a[12]*a[7]*a[9];
  o[12] = -a[4]*a[9]*a[14] + a[4]*a[10]*a[13] + a[8]*a[5]*a[14] - a[8]*a[6]*a[13] - a[12]*a[5]*a[10] + a[12]*a[6]*a[9];
  o[1] = -a[1]*a[10]*a[15] + a[1]*a[11]*a[14] + a[9]*a[2]*a[15] - a[9]*a[3]*a[14] - a[13]*a[2]*a[11] + a[13]*a[3]*a[10];
  o[5] = a[0]*a[10]*a[15] - a[0]*a[11]*a[14] - a[8]*a[2]*a[15] + a[8]*a[3]*a[14] + a[12]*a[2]*a[11] - a[12]*a[3]*a[10];
  o[9] = -a[0]*a[9]*a[15] + a[0]*a[11]*a[13] + a[8]*a[1]*a[15] - a[8]*a[3]*a[13] - a[12]*a[1]*a[11] + a[12]*a[3]*a[9];
  o[13] = a[0]*a[9]*a[14] - a[0]*a[10]*a[13] - a[8]*a[1]*a[14] + a[8]*a[2]*a[13] + a[12]*a[1]*a[10] - a[12]*a[2]*a[9];
  o[2] = a[1]*a[6]*a[15] - a[1]*a[7]*a[14] - a[5]*a[2]*a[15] + a[5]*a[3]*a[14] + a[13]*a[2]*a[7] - a[13]*a[3]*a[6];
  o[6] = -a[0]*a[6]*a[15] + a[0]*a[7]*a[14] + a[4]*a[2]*a[15] - a[4]*a[3]*a[14] - a[12]*a[2]*a[7] + a[12]*a[3]*a[6];
  o[10] = a[0]*a[5]*a[15] - a[0]*a[7]*a[13] - a[4]*a[1]*a[15] + a[4]*a[3]*a[13] + a[12]*a[1]*a[7] - a[12]*a[3]*a[5];
  o[14] = -a[0]*a[5]*a[14] + a[0]*a[6]*a[13] + a[4]*a[1]*a[14] - a[4]*a[2]*a[13] - a[12]*a[1]*a[6] + a[12]*a[2]*a[5];
  o[3] = -a[1]*a[6]*a[11] + a[1]*a[7]*a[10] + a[5]*a[2]*a[11] - a[5]*a[3]*a[10] - a[9]*a[2]*a[7] + a[9]*a[3]*a[6];
  o[7] = a[0]*a[6]*a[11] - a[0]*a[7]*a[10] - a[4]*a[2]*a[11] + a[4]*a[3]*a[10] + a[8]*a[2]*a[7] - a[8]*a[3]*a[6];
  o[11] = -a[0]*a[5]*a[11] + a[0]*a[7]*a[9] + a[4]*a[1]*a[11] - a[4]*a[3]*a[9] - a[8]*a[1]*a[7] + a[8]*a[3]*a[5];
  o[15] = a[0]*a[5]*a[10] - a[0]*a[6]*a[9] - a[4]*a[1]*a[10] + a[4]*a[2]*a[9] + a[8]*a[1]*a[6] - a[8]*a[2]*a[5];
  const det = a[0] * o[0] + a[1] * o[4] + a[2] * o[8] + a[3] * o[12];
  for (let i = 0; i < 16; i++) o[i] /= det;
  return o;
}

function mul4(a, b) {       // column-major 4x4: a * b
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

export async function loadArcGIS() {
  const mods = await esriModules(MODULES);
  return Object.fromEntries(MODULES.map((m, i) => [m.split('/').pop(), mods[i]]));
}

export class MapController {
  constructor(app, E) {
    this.app = app;
    this.E = E;
    this.mode = '2d';
    this.basemap = 'satellite';
    this.sr = E.SpatialReference.WebMercator;
  }

  init(meta, el2d) {
    const E = this.E, app = this.app;
    this.meta = meta;
    const ext = this.domainExtent = new E.Extent({
      xmin: meta.x0, xmax: meta.x0 + meta.W * meta.res, ymin: meta.y1 - meta.H * meta.res, ymax: meta.y1, spatialReference: this.sr,
    });

    // ---- 2D
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- createSubclass-ийн аргуудад `this` нь давхаргын харагдац
    const ctl = this;
    const FloodLayerView2D = E.BaseLayerViewGL2D.createSubclass({
      attach() { this.r = new WaterRenderer(this.context); ctl.lv2d = this; },
      detach() { ctl.lv2d = null; },
      render(p) {
        const st = p.state, dpr = window.devicePixelRatio || 1;
        const f = app.frameFor(st.extent, st.size[0] * dpr, st.size[1] * dpr, '2d');
        if (!f) return;
        const r = this.r;
        r.setGrid(f.grid);
        r.upload(f.frame, f.reuse);
        const g = f.grid;
        const sx = 2 / (st.resolution * st.size[0]), sy = 2 / (st.resolution * st.size[1]);
        const xf = [sx, sy, (g.x0 - st.center[0]) * sx, (g.y1 - st.center[1]) * sy];
        const disp = { ...app.displayState(), visDt: 1.6 * g.dx * st.resolution / g.cellMerc };
        if (disp.particles && disp.mode <= 2 && !disp.history) r.updateParticles(disp, disp.visDt, () => this.bindRenderTarget());
        r.draw2D(disp, xf);
        if (app.wantsAnimation()) this.requestRender();
      },
    });
    const FloodLayer = E.Layer.createSubclass({
      createLayerView(view) { if (view.type === '2d') return new FloodLayerView2D({ view, layer: this }); },
    });
    this.flood2d = new FloodLayer({ title: 'Үер', fullExtent: ext });
    this.overlay2d = new E.GraphicsLayer();
    // building footprints drawn above the water: flood water is seen running around them (zoomed in only)
    this.buildings2d = new E.FeatureLayer({
      url: BUILDINGS_URL, outFields: ['OBJECTID'], minScale: 25000, title: 'Барилга', popupEnabled: false,
      renderer: { type: 'simple', symbol: { type: 'simple-fill', color: [236, 233, 228, 0.92], outline: { color: [110, 106, 100, 0.8], width: 0.5 } } },
    });
    this.map2d = new E.Map({ basemap: this.basemap, layers: [this.flood2d, this.buildings2d, this.overlay2d] });
    this.view2d = new E.MapView({
      container: el2d, map: this.map2d, extent: ext.clone().expand(0.45), constraints: { rotationEnabled: false, snapToZoom: false },
      ui: { components: ['attribution'] }, popupEnabled: false,
    });
    this._placeUI(this.view2d, ['zoom']);
    this._basemapGallery(this.view2d);
    this._wire(this.view2d);
    // goTo rejects with "goto-interrupted" when the user moves the map first: that's fine
    this.view2d.when(() => this.view2d.goTo({ center: [106.92, 47.93], zoom: 12 }, { animate: false }).catch(() => {}));
  }

  _init3d(el3d) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- createSubclass-ийн аргуудад `this` нь өндрийн давхарга
    const E = this.E, app = this.app, ctl = this;
    const DemElevation = E.BaseElevationLayer.createSubclass({
      properties: { grid: null },
      load() {
        this.tileInfo = E.TileInfo.create({ size: 256, spatialReference: E.SpatialReference.WebMercator, numLODs: 22 });
        this.spatialReference = E.SpatialReference.WebMercator;
        this.fullExtent = ctl.domainExtent;
      },
      fetchTile(level, row, col, options) {
        if (options?.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
        const g = this.grid, ti = this.tileInfo, res = ti.lods[level].resolution;
        const N = 257, values = new Float32Array(N * N);
        const ox = ti.origin.x + col * 256 * res, oy = ti.origin.y - row * 256 * res;
        // inside the simulation area: the solver's ground (burned channels, so water sits right on it); outside: the DEM
        const m = ctl.meta, dem = ctl.app.data.dem, dc = m.res * m.demF;
        const bil = (arr, w, h, fx, fy) => {
          const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
          const A = (x, y) => arr[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
          return (A(x0, y0) * (1 - tx) + A(x0 + 1, y0) * tx) * (1 - ty) + (A(x0, y0 + 1) * (1 - tx) + A(x0 + 1, y0 + 1) * tx) * ty;
        };
        for (let j = 0; j < N; j++) {
          const my = oy - j * res;
          for (let i = 0; i < N; i++) {
            const mx = ox + i * res;
            const gx = (mx - g.x0) / g.cellMerc, gy = (g.y1 - my) / g.cellMerc;
            values[j * N + i] = gx >= 0 && gy >= 0 && gx <= g.W && gy <= g.H
              ? bil(g.groundNat, g.W, g.H, gx - 0.5, gy - 0.5)
              : bil(dem, m.demW, m.demH, (mx - m.x0) / dc - 0.5, (m.y1 - my) / dc - 0.5);
          }
        }
        return Promise.resolve({ values, width: N, height: N, noDataValue: -9999 });
      },
    });
    this.DemElevation = DemElevation;

    const WaterNode = E.RenderNode.createSubclass({
      constructor() { this.consumes = { required: ['composite-color'] }; this.produces = 'composite-color'; },
      render() {
        const out = this.bindRenderTarget();
        try { this._draw(); } catch (e) { console.error('water3d', e); }
        if (app.running) this.requestRender();
        else if (app.wantsAnimation() && !this.pending) {
          this.pending = true;
          setTimeout(() => { this.pending = false; this.requestRender(); }, 50);
        }
        return out;
      },
      _draw() {
        const view = this.view, cam = this.camera;
        const vp = cam.viewport;
        ctl.cam3d = { M: mul4(cam.projectionMatrix, cam.viewMatrix), vp: Array.from(vp) };   // for screenToGround
        const f = app.frameFor(ctl._visibleExtent(view), vp[2] / 2, vp[3] / 2, '3d');
        if (f) {
          if (!this.r) this.r = new WaterRenderer(this.gl);
          const r = this.r, g = f.grid;
          r.setGrid(g);
          r.upload(f.frame, f.reuse, 'main');
          // fine window around the camera target, sized by how far the camera is
          const c = view.center, p = view.camera.position;
          const R = c && p ? Math.max(250, Math.min(6000, 0.9 * Math.hypot(p.x - c.x, p.y - c.y, p.z - (c.z || 0)))) : 0;
          const nf = R && app.frameFor({ xmin: c.x - R, xmax: c.x + R, ymin: c.y - R, ymax: c.y + R }, 1536, 1536, '3dnear');
          // always draw the near pass when it exists (switching it on/off with the camera made the water pop)
          if (nf) r.upload(nf.frame, nf.reuse, 'near');
          else if (r.slots.near) r.slots.near.frame = null;
          const T = E.webgl.renderCoordinateTransformAt(view, [g.x0, g.y1, 0], E.SpatialReference.WebMercator, new Float64Array(16));
          const mvp = Float32Array.from(mul4(mul4(cam.projectionMatrix, cam.viewMatrix), T));
          const res = view.extent ? view.extent.width / Math.max(vp[2], 1) : g.cellMerc;
          const disp = { ...app.displayState(), visDt: 1.6 * g.dx * res / g.cellMerc, sun: this.sunLight?.direction,
            pxAng: (cam.fovY || 0.8) / Math.max(vp[3], 1) };
          if (disp.particles && disp.mode <= 2 && !disp.history) r.updateParticles(disp, disp.visDt, () => this.bindRenderTarget(), r.slots.near?.frame ? 'near' : 'main');
          const eye = [cam.eye[0] - T[12], cam.eye[1] - T[13], cam.eye[2] - T[14]];   // local scene: T is a pure translation
          r.draw3D(disp, mvp, eye);
          this.resetWebGLState();
        }
      },
    });

    this.overlay3d = new E.GraphicsLayer({ elevationInfo: { mode: 'relative-to-ground', offset: 2 } });
    this.buildings3d = new E.FeatureLayer({
      url: BUILDINGS_URL, outFields: [FLOORS], visible: app.display.buildings3d, title: 'Барилга',
      elevationInfo: { mode: 'on-the-ground' }, popupEnabled: false,
      renderer: {
        type: 'simple',
        symbol: { type: 'polygon-3d', symbolLayers: [{ type: 'extrude', material: { color: [238, 235, 230, 1] }, edges: { type: 'solid', color: [120, 116, 110, 0.35], size: 0.4 } }] },
        visualVariables: [{ type: 'size', valueExpression: HEIGHT_ARCADE, valueUnit: 'meters' }],
      },
    });
    this.map3d = new E.Map({
      basemap: this.basemap,
      ground: new E.Ground({ layers: [new DemElevation({ grid: app.grid })] }),
      layers: [this.buildings3d, this.overlay3d],
    });
    this.view3d = new E.SceneView({
      container: el3d, map: this.map3d, viewingMode: 'local', clippingArea: this.domainExtent,
      spatialReference: E.SpatialReference.WebMercator,
      environment: { atmosphereEnabled: false, starsEnabled: false,
        lighting: { type: 'virtual', directShadowsEnabled: false } },
      qualityProfile: 'medium', ui: { components: ['attribution'] }, popupEnabled: false,
    });
    this._placeUI(this.view3d, ['zoom', 'navigation-toggle', 'compass']);
    this._basemapGallery(this.view3d);
    this._wire(this.view3d);
    this.waterNode = new WaterNode({ view: this.view3d });
    this._syncOverlays(this.overlay3d);
    this._applyTheme3d();
    if (this.affectedList) this.syncAffected(this.affectedList);
  }

  /** Ground area actually visible in a (tilted) SceneView. view.extent there can be far smaller than what is
   *  on screen, so sample a 5×5 grid of screen points; rays that miss the ground (sky) widen the box. */
  _visibleExtent(view) {
    const cam = view.camera, p = cam && cam.position;
    if (!p) return view.extent;
    const key = [p.x, p.y, p.z, cam.heading, cam.tilt, view.width, view.height].map(v => Math.round(v)).join();
    if (this.visKey === key) return this.visExt;
    let x0 = p.x, x1 = p.x, y0 = p.y, y1 = p.y, miss = 0;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
      const q = view.toMap({ x: view.width * i / 4, y: view.height * j / 4 });
      if (!q) { miss++; continue; }
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const pad = miss ? Math.max(3000, 4 * (p.z - 1300)) : 200;
    this.visKey = key;
    this.visExt = { xmin: x0 - pad, xmax: x1 + pad, ymin: y0 - pad, ymax: y1 + pad };
    return this.visExt;
  }

  /** 3D: map point under screen point (CSS px) on the horizontal plane at elevation z. SceneView.toMap()
   *  returns null during drags in this local scene, so the camera ray is intersected with the plane directly
   *  (render coordinates are map coordinates here). */
  screenToGround(sx, sy, z) {
    const c = this.cam3d, v = this.view3d;
    if (!c || !v) return null;
    const inv = inv4(c.M), k = c.vp[2] / Math.max(v.width, 1);
    const nx = 2 * (sx * k) / c.vp[2] - 1, ny = 1 - 2 * (sy * k) / c.vp[3];
    const un = zc => { const r = [0, 1, 2, 3].map(i => inv[i] * nx + inv[4 + i] * ny + inv[8 + i] * zc + inv[12 + i]); return [r[0] / r[3], r[1] / r[3], r[2] / r[3]]; };
    const a = un(-1), b = un(1);
    if (Math.abs(b[2] - a[2]) < 1e-9) return null;
    const t = (z - a[2]) / (b[2] - a[2]);
    if (t < 0) return null;
    return { x: a[0] + t * (b[0] - a[0]), y: a[1] + t * (b[1] - a[1]) };
  }

  _placeUI(view, widgets) {
    view.ui.padding = { top: 12, left: 12, right: 12, bottom: 12 };   // цагийн шугам зүүн самбарт шилжсэн (2026-10-08)
    view.when(() => {
      view.ui.components = ['attribution', ...widgets];
      for (const w of widgets) view.ui.move(w, 'bottom-right');
    });
  }

  _wire(view) {
    const app = this.app;
    view.watch('stationary', still => { if (still && view === this.activeView) app.onViewStill(); });
    view.on('pointer-down', e => app.onPointerDown(e, view));
    view.on('drag', e => app.onMapDrag(e, view));          // drawing / resizing the simulation area
    view.on('click', e => { if (e.mapPoint) app.onMapClick(e.mapPoint.x, e.mapPoint.y); });
    view.on('pointer-move', e => {
      const p = view.toMap({ x: e.x, y: e.y });
      app.onHover(p ? [p.x, p.y] : null, { x: e.x, y: e.y });
    });
    view.on('pointer-leave', () => app.onHover(null));
  }

  get activeView() { return this.mode === '3d' ? this.view3d : this.view2d; }

  async setMode(mode, el3d) {
    if (mode === this.mode) return;
    const from = this.activeView;
    if (mode === '3d' && !this.view3d) this._init3d(el3d);
    this.mode = mode;
    const to = this.activeView;
    await to.when();
    const target = mode === '3d' ? { target: from.center, scale: from.scale, tilt: 60, heading: 0 } : { center: from.center, scale: from.scale };
    await to.goTo(target, { animate: false }).catch(() => {});
    if (this.affectedList) this.syncAffected(this.affectedList);     // bring this view's flooded buildings up to date
    this.requestRender();
  }

  /** Esri-ийн суурь зургийн цуглуулга (Expand + BasemapGallery), баруун дээд буланд.
      2D, 3D тус бүр өөрийн цуглуулгатай; сонголт нөгөө зурагт setBasemap-аар дамжина. */
  _basemapGallery(view) {
    const E = this.E;
    const source = new E.LocalBasemapsSource({
      // ⚠ портал зүйл ачаалагдмагц гарчгаа англиар дарж бичдэг тул монгол нэрийг ДАРАА нь тавина
      basemaps: BASEMAPS.map(([id, title]) => {
        const b = E.Basemap.fromId(id);
        b.title = title;
        b.when(() => { b.title = title; }).catch(() => {});
        return b;
      }),
    });
    const gallery = new E.BasemapGallery({ view, source });
    const expand = new E.Expand({ view, content: gallery, expandTooltip: 'Суурь зураг', collapseTooltip: 'Хаах' });
    // ойртуулах товчны ДООР (хэрэглэгч 2026-10-08) — _placeUI-ийн when-ээс хойш бүртгэгддэг тул дараалал нь араас
    view.when(() => view.ui.add({ component: expand, position: 'top-left', index: 99 }));
    E.reactiveUtils.watch(() => gallery.activeBasemap, b => {
      const id = b && BASEMAPS.find(([k]) => k === b.id)?.[0];
      if (id && id !== this.basemap) this.setBasemap(id);
      if (b) expand.collapse();
    });
  }

  /** Хуудаснаас гарахад хоёр харагдацыг устгана (WebGL контекст чөлөөлөгдөнө) */
  destroy() {
    this.view3d?.destroy();
    this.view2d?.destroy();
    this.view3d = this.view2d = null;
    this.lv2d = this.waterNode = null;
  }

  setBasemap(id) {
    if (id === this.basemap) return;
    this.basemap = id;
    this.map2d.basemap = id;
    if (this.map3d) this.map3d.basemap = id;
  }

  /** New solver grid: refresh 3D ground. */
  setGrid(grid) {
    if (this.map3d) this.map3d.ground.layers = [new this.DemElevation({ grid })];
    this.requestRender();
  }

  setBuildings3d(on) { if (this.buildings3d) this.buildings3d.visible = on; }

  _applyTheme3d() {
    if (!this.view3d) return;
    const dark = document.documentElement.dataset.theme !== 'light';
    this.view3d.environment.background = { type: 'color', color: dark ? [10, 15, 21, 1] : [233, 238, 243, 1] };
  }
  applyTheme() { this._applyTheme3d(); }

  requestRender() {
    if (this.mode === '2d') this.lv2d?.requestRender();
    else this.waterNode?.requestRender();
  }

  goToExtent(ext) { this.activeView.goTo(ext).catch(() => {}); }

  // ---------------------------------------------------------------- flooded buildings (coloured by depth)
  // Shown automatically. Footprints are fetched once per building and cached; each refresh only applies
  // the difference (new / re-classed / gone buildings) to one client-side layer per view, so nothing flickers
  // and the org's request quota isn't spent twice on the same building.
  _affLayer(is3d) {
    const E = this.E, sr = this.sr;
    const key = is3d ? 'aff3d' : 'aff2d';
    if (this[key]) return this[key];
    if (is3d && !this.map3d) return null;
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const breaks = sym => CLASSES.map(c => ({ minValue: c.min, maxValue: c.max, symbol: sym(rgb(c.color)) }));
    const renderer = is3d
      ? { type: 'class-breaks', field: 'depth',
          classBreakInfos: breaks(c => ({ type: 'polygon-3d', symbolLayers: [{ type: 'extrude', material: { color: [...c, 1] },
            edges: { type: 'solid', color: c.map(v => Math.round(v * 0.55)).concat(0.7), size: 0.5 } }] })),
          visualVariables: [{ type: 'size', field: 'height', valueUnit: 'meters' }] }
      : { type: 'class-breaks', field: 'depth',
          classBreakInfos: breaks(c => ({ type: 'simple-fill', color: [...c, 0.9], outline: { color: c.map(v => Math.round(v * 0.55)).concat(0.8), width: 0.5 } })) };
    const layer = new E.FeatureLayer({
      source: [], objectIdField: 'OBJECTID', geometryType: 'polygon', spatialReference: sr, popupEnabled: false,
      title: 'Үерт өртсөн барилга', renderer,
      // 2D: only once single buildings can be told apart (at city scale thousands of outlines make a dark blot)
      ...(is3d ? {} : { minScale: 40000 }),
      fields: [{ name: 'OBJECTID', type: 'oid' }, { name: 'bid', type: 'integer' }, { name: 'depth', type: 'double' }, { name: 'height', type: 'double' }],
      ...(is3d ? { elevationInfo: { mode: 'on-the-ground' } } : {}),
    });
    (is3d ? this.map3d : this.map2d).add(layer);
    this[key] = layer;
    this[key + 'State'] = new Map();       // building id -> { fid (layer objectId), cls }
    return layer;
  }

  async _fetchFootprints(ids) {
    this.geomCache = this.geomCache || new Map();
    const missing = ids.filter(id => !this.geomCache.has(id));
    for (let i = 0; i < missing.length; i += 1000) {
      const body = new URLSearchParams({ objectIds: missing.slice(i, i + 1000).join(','), outFields: `OBJECTID,${FLOORS}`,
        returnGeometry: 'true', outSR: '3857', geometryPrecision: '1', f: 'json' });
      const j = await (await fetch(BUILDINGS_URL + '/query', { method: 'POST', body })).json();
      if (j.error) throw new Error(j.error.message || 'building query failed');
      for (const f of j.features || []) {
        const v = parseFloat(f.attributes[FLOORS]);
        this.geomCache.set(f.attributes.OBJECTID, { rings: f.geometry.rings, height: (v > 0 && v < 80 ? v : 1) * 3 });
      }
    }
  }

  /** list = [{oid, depth}]: make the flooded-building layers show exactly these buildings. */
  syncAffected(list) {
    this.affectedList = list;
    this.affQueue = (this.affQueue || Promise.resolve()).then(() => this._sync(list)).catch(e => console.error('flooded buildings', e));
    return this.affQueue;
  }

  async _sync(list) {
    if (list !== this.affectedList) return;                 // a newer request is already queued
    const E = this.E, sr = this.sr;
    await this._fetchFootprints(list.map(a => a.oid));
    const clsOf = d => CLASSES.findIndex(c => d >= c.min && d < c.max);
    const want = new Map();
    for (const a of list) if (this.geomCache.has(a.oid)) want.set(a.oid, a.depth);
    const frame = () => new Promise(r => requestAnimationFrame(() => r()));
    // only the visible view's layer is kept current; the other one catches up when the view is switched
    for (const is3d of [this.mode === '3d']) {
      const layer = this._affLayer(is3d);
      if (!layer) continue;
      await layer.load();
      const state = this[(is3d ? 'aff3d' : 'aff2d') + 'State'];
      const graphic = (bid, depth, fid) => {
        const g = this.geomCache.get(bid);
        const attributes = { bid, depth, height: g.height };
        if (fid != null) attributes.OBJECTID = fid;
        return new E.Graphic({ geometry: new E.Polygon({ rings: g.rings, spatialReference: sr }), attributes });
      };
      const adds = [], addIds = [], updates = [], deletes = [];
      for (const [bid, depth] of want) {
        const cur = state.get(bid), cls = clsOf(depth);
        if (!cur) { adds.push([bid, depth]); addIds.push(bid); }
        else if (cur.cls !== cls) { updates.push([bid, depth, cur.fid]); cur.cls = cls; }
      }
      for (const [bid, cur] of state) if (!want.has(bid)) { deletes.push({ objectId: cur.fid }); state.delete(bid); }
      // apply in slices with a frame in between, so thousands of footprints never freeze the map
      const B = 250;
      for (let k = 0; k < Math.max(adds.length, updates.length, deletes.length); k += B) {
        if (list !== this.affectedList) return;             // superseded while we were working
        const r = await layer.applyEdits({ addFeatures: adds.slice(k, k + B).map(a => graphic(...a)),
          updateFeatures: updates.slice(k, k + B).map(a => graphic(...a)), deleteFeatures: deletes.slice(k, k + B) });
        r.addFeatureResults.forEach((res, i) => {
          const bid = addIds[k + i];
          if (!res.error) state.set(bid, { fid: res.objectId, cls: clsOf(want.get(bid)) });
        });
        await frame();
      }
    }
    // hide the grey 3D extrusion of buildings that are drawn coloured
    if (this.view3d && this.buildings3d) {
      const ids = [...want.keys()];
      this.view3d.whenLayerView(this.buildings3d).then(lv => {
        lv.filter = ids.length ? { where: `OBJECTID NOT IN (${ids.join(',')})` } : null;
      }).catch(() => {});
    }
  }

  clearAffected() { return this.syncAffected([]); }

  // ---------------------------------------------------------------- overlays (domain, rain cell, probe, inflows)
  updateOverlays() {
    if (!this.overlay2d) return;                  // views not built yet
    this._syncOverlays(this.overlay2d);
    if (this.overlay3d) this._syncOverlays(this.overlay3d);
  }

  _syncOverlays(layer) {
    const E = this.E, app = this.app, m = this.meta, sr = this.sr, gs = [];
    const rect = (x0, y0, x1, y1) => new E.Polyline({ paths: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]], spatialReference: sr });
    const e = this.domainExtent, g = app.grid;
    const area = g ? [g.x0, g.y1 - g.H * g.cellMerc, g.x0 + g.W * g.cellMerc, g.y1] : [e.xmin, e.ymin, e.xmax, e.ymax];
    if (app.area) gs.push(new E.Graphic({ geometry: rect(e.xmin, e.ymin, e.xmax, e.ymax),
      symbol: { type: 'simple-line', color: [180, 190, 200, 0.45], width: 1, style: 'dash' } }));
    gs.push(new E.Graphic({ geometry: rect(...area), symbol: { type: 'simple-line', color: [242, 216, 76, 0.9], width: app.area ? 2.5 : 1.5 } }));
    if (app.area && !app.areaDraft) {
      const big = layer === this.overlay3d ? 1.6 : 1;     // 3D: bigger handles, easier to grab among buildings
      const [x0, y0, x1, y1] = area, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [mx, y0], [mx, y1], [x0, my], [x1, my]]) {
        gs.push(new E.Graphic({ geometry: new E.Point({ x, y, spatialReference: sr }),
          symbol: { type: 'simple-marker', style: 'square', size: 9 * big, color: [255, 255, 255, 0.95], outline: { color: [242, 216, 76, 1], width: 2 } } }));
      }
      // centre handle: drag to move the whole area
      const c = new E.Point({ x: mx, y: my, spatialReference: sr });
      gs.push(new E.Graphic({ geometry: c, symbol: { type: 'simple-marker', style: 'circle', size: 22 * big, color: [255, 255, 255, 0.95], outline: { color: [242, 216, 76, 1], width: 2 } } }));
      gs.push(new E.Graphic({ geometry: c, symbol: { type: 'text', text: '✥', color: [40, 40, 40, 1], yoffset: -5, font: { size: 13 * big, weight: 'bold' } } }));
    }
    if (app.areaDraft) {
      const [x0, y0, x1, y1] = app.areaDraft;
      gs.push(new E.Graphic({ geometry: new E.Polygon({ rings: [[[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]], spatialReference: sr }),
        symbol: { type: 'simple-fill', color: [79, 209, 230, 0.12], outline: { color: [79, 209, 230, 1], width: 2, style: 'dash' } } }));
    }
    const sc = app.scn;
    if (sc.area === 'circle' && sc.center) {
      gs.push(new E.Graphic({
        geometry: new E.Circle({ center: new E.Point({ x: sc.center[0], y: sc.center[1], spatialReference: sr }),
          radius: sc.radiusKm * 1000 / m.groundScale, radiusUnit: 'meters', geodesic: false, numberOfPoints: 90 }),
        symbol: { type: 'simple-fill', color: [140, 170, 255, 0.10], outline: { color: [190, 215, 255, 0.95], width: 1.5, style: 'dash' } },
      }));
    }
    for (const p of sc.inflows) {
      gs.push(new E.Graphic({
        geometry: new E.Point({ x: p.xy[0], y: p.xy[1], spatialReference: sr }),
        symbol: { type: 'simple-marker', style: 'triangle', color: [255, 181, 71], size: 14, angle: 180, outline: { color: [30, 20, 0], width: 1 } },
      }));
    }
    if (app.probeXY) {
      gs.push(new E.Graphic({
        geometry: new E.Point({ x: app.probeXY[0], y: app.probeXY[1], spatialReference: sr }),
        symbol: { type: 'simple-marker', color: [79, 209, 230], size: 12, outline: { color: [255, 255, 255], width: 2 } },
      }));
    }
    layer.removeAll();
    layer.addMany(gs);
  }
}
