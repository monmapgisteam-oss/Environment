/*
  ХӨРСНИЙ ЗҮСЭЛТ ДЭЭРХ ЖОРЛОНГИЙН БОХИРДОЛ

  Хэрэглэгч 2026-09-30: "Нэвчилтийн симуляци"-ийн логикийг "Хөрсний
  зүсэлт"-д: "end buh jorlon haragdana tgeed zuselt hiigeed bohirdliig
  harna ter timeslide ni bn … newchiltiin simulation bol 1 jorlongiin
  bohirdliig haruulna harin hursni zuselt bol hursiig zuseed bugdiin
  harna".

  ЯАЖ:
  1. Зүсэлтийн шугамаас `RMAX` (4.5 м — загварын хажуугийн хил 3.5 м +
     нүхний радиус) дотор байгаа жорлонгууд "зүсэлт дээр" гэж тооцогдоно.
     Загвар тэнхлэг тэгш хэмт тул тэр жорлонгийн бохирдол хавтгайг
     r = √(x² + d²) зайгаар огтолно (d — шугамаас зай, x — шугамын дагуу).
  2. Жорлон бүрийг ТУС ТУСАД НЬ бодохгүй: загварын үр дүн (бохирдлын
     хэлбэр) нь геологи, нүхний гүн, гүний усны гүн, ам бүлээс л хамаарна
     (нягтшил нь зөвхөн 1 га-гийн гүний усны холилдолд). Тиймээс тэдгээрийг
     бөөрөнхийлсөн түлхүүрээр (`keyOf`: гүний ус, ам бүл 0.5-аар)
     бүлэглэж, түлхүүр бүрийг НЭГ удаа бодож кэшлэнэ. Нэг симуляци ~60–130
     мс (Node дээр хэмжсэн, 10 жил), шугам дээр хэдэн арван түлхүүр.
  3. Хугацаа 10 жил (`YEARS`), агшин 60 хоног тутам (загварын 15 хоногийн
     агшны 4 дэх нь — санах ойг 4 дахин хэмнэнэ).
  4. Зураг: бүх жорлонгийн зүсмэлийг НЭГ атлас зурагт (24 × 40 px нүд)
     будаж, зүсэлтийн хавтгайн дээр НЭГ меш болгоно (жорлон бүрд дөрвөлжин).
     Хавтгайгаас камер (хасагдсан) тал руу 0.8 м урагшилна — таглаатай
     давхцаж анивчихгүй. Гүн нь хөрсний блокийнх: 0–200 см (×өсгөлт).

  5. ⚠⚠ ТОГТМОЛ ӨРГӨНТЭЙ ЗУРААС ЗААВАЛ. Нүүр нь ×800 өсгөлттэй тул
     1,600 м өндөр, харин бохирдол ±4 м өргөн (харьцаа 200:1) — меш
     ямар ч ойртолтод НЭГ ПИКСЕЛЭЭС нарийн зураас болж, хөтөч дээр
     харагдахгүй байв. Тиймээс жорлон бүрийн ТӨВ баганыг (хөндлөн
     огтлолын диаграмтай ижил утга) 3 цэгийн зузаантай `line-3d`
     зураасаар давхар зурна: өргөн нь ДЭЛГЭЦИЙН хэмжээ, газрын хэмжээ
     заахгүй. Өнгө нь найман ангилал, нүх бараан; ангилал тутамд НЭГ
     олон шугамтай график — мянган жорлонд ч есөөс илүүгүй график.
  6. Атласын өндөр нь хэрэгцээтэй мөрөөр (2-ын зэрэгт).

  ⚠⚠ ГҮНИЙ УС ХҮРТЭЛ (хэрэглэгч 2026-10-01: "ene 2iig ajluulahad bohirdol
  dooshoo newchij buig harna shuu … zuselt zurah 2-iig hiihed bohirdol
  simulation haragdmaar bn"). Хөрсний блок 2 м гүн, нүхний ёроол 1.5–2.5 м
  тул доош нэвчих хэсэг (гүний ус хүртэл, хэдэн метрээс 40 м) блокт
  ОГТ харагддаггүй байв. Одоо:
    · 3D-д хана бүрийн ДООР түр "гүний хэсэг" (`curtain`) — блокийн
      ёроолоос гүний ус хүртэл; жорлон бүрийн зураас тэнд үргэлжилж,
      гүний усны түвшин цэнхэр шугамаар. ⚠ ӨӨР ӨСГӨЛТ: 2 м хүртэл ×800
      (блокийнх), 2 м-ээс доош ×`DEEP_X` (100) — нэг ×800-аар бол 20 м
      гүн 16 км болно. Дэлгэц дээр хоёулаа ИЛ бичигдэнэ.
    · 2D: зам дагуух 0 м → гүний ус хүртэлх тор (`deep`) — `PlumeSection`.
  ⚠⚠ ЗАМ ОЛОН ХЭРЧИМТЭЙ: шулуун зүсэлт (нэг хэрчим) эсвэл зурсан талбайн
  ХҮРЭЭ (`setRing` — хана бүр нэг хэрчим, хасагдах тал нь ГАДАГШ).
  Хүрээний хэрчимд жорлонг зөвхөн [0, L]-д авна — булангийн давхардал.
*/
import { defaultParams, fetchLatrineSim, simulate, type SimData, type SimParams } from "@/lib/latrine-sim";
import { RE3, RN3, rampC, type Species } from "@/lib/latrine-sim-3d";

export const YEARS = 10;
/** Загварын агшин 15 хоног; хадгалах нь 4 дэх бүр — 60 хоног */
const KEEP = 4;
export const STEP_DAYS = 15 * KEEP;
const RMAX = 4.5;
const DEPTH_CM = 200;
const MAX_LAT = 1000;
const CW = 24;
const CH = 40;
const ATLAS = 1024;
const PER_ROW = Math.floor(ATLAS / CW);
/** Хөндлөн огтлолын диаграмд: мөр 10 см */
export const ROWS = 20;
/** Тогтмол өргөнтэй зураасны өнгөний ангилал ба зузаан (цэг) */
const BINS = 8;
const STROKE_PT = 3;
/** 2 м-ээс доош босоо өсгөлт — 1 м гүн = 100 м (блокийнх ×800) */
export const DEEP_X = 100;
/** Гүний хэсгийн дээд хязгаар, м */
const DEEP_MAX = 40;
/** 2D тор: зам дагуу сэмпл, гүнээр мөр */
const DS = 300;
const DR = 160;

type Pt = [number, number];
type Field = {
  nr: number;
  nz: number;
  h: number;
  a: number;
  R: number;
  pit: number;
  gw: number;
  typ: Uint8Array | null;
  qN: Uint8Array[];
  qE: Uint8Array[];
};
type Seg = { a: Pt; b: Pt; rem: number; L: number; s0: number };
type OnCut = { i: number; seg: number; s: number; d: number; key: string };

/** 2D хөндлөн огтлол — 0 м-ээс гүний ус хүртэл */
export type DeepSection = {
  /** (сэмпл × мөр): 0 — хоосон, 1 — нүх, 2…255 — бохирдол */
  grid: Uint8Array;
  samples: number;
  rows: number;
  /** Торын доод гүн, м */
  depth: number;
  /** Сэмпл бүрийн гүний усны гүн, м (жорлонгүй бол NaN) */
  gw: Float32Array;
  /** Замын урт, м */
  length: number;
  /** Хүрээний булангууд (замын зай, м) — шулуун зүсэлтэд хоосон */
  corners: number[];
};

export type PlumeState = {
  /** Зүсэлт дээрх жорлон */
  count: number;
  /** Бодогдсон түлхүүр / нийт */
  done: number;
  total: number;
  /** Цагийн агшны тоо */
  steps: number;
  /** Хөндлөн огтлолын диаграмд: (сэмпл × `ROWS`) — 0 бол бохирдолгүй, 1…255 ангилал. Зөвхөн шулуун зүсэлтэд. */
  grid: Uint8Array | null;
  samples: number;
  /** Гүний ус хүртэлх 2D тор */
  deep: DeepSection | null;
};

type Deps = {
  Mesh: new (p?: object) => unknown;
  MeshComponent: new (p?: object) => unknown;
  MeshMaterial: new (p?: object) => unknown;
  MeshTexture: new (p?: object) => unknown;
  Graphic: new (p?: object) => unknown;
  layer: { removeAll: () => void; add: (g: unknown) => void };
  zAt: (lon: number, lat: number) => number;
  valid: (lon: number, lat: number) => boolean;
  exs: () => number;
  mLon: number;
  mLat: number;
  SR: object;
  onState: (s: PlumeState) => void;
};

export function createPlumes(dep: Deps) {
  let data: SimData | null = null;
  const cache = new Map<string, Field | null>();
  let path: { segs: Seg[]; P: number; ring: boolean; lat: OnCut[] } | null = null;
  let t = 0;
  let species: Species = "N";
  let gen = 0;
  const steps = Math.floor((YEARS * 365) / STEP_DAYS) + 1;
  void fetchLatrineSim().then(
    (d) => {
      data = d;
      if (path) void compute();
    },
    () => {},
  );

  const keyOf = (p: SimParams) => {
    const gw = Math.round(p.gw * 2) / 2;
    const hh = Math.round(p.hh * 2) / 2;
    return `${p.mat}|${Math.min(p.pit, gw).toFixed(1)}|${gw}|${hh}`;
  };
  function paramsOf(i: number): SimParams {
    const p = defaultParams(data!, i);
    const gw = Math.round(p.gw * 2) / 2;
    return { ...p, years: YEARS, gw, hh: Math.round(p.hh * 2) / 2, pit: Math.min(p.pit, gw) };
  }

  const segOf = (a: Pt, b: Pt, rem: number, s0: number): Seg => ({
    a, b, rem, s0, L: Math.hypot((b[0] - a[0]) * dep.mLon, (b[1] - a[1]) * dep.mLat),
  });

  /** Зам дээрх жорлонгууд — хэрчмийн дагуух байрлал `s`, шугамаас зай `d` (м) */
  function pick(): OnCut[] {
    const d = data!;
    const out: OnCut[] = [];
    path!.segs.forEach((g, k) => {
      if (g.L < 1) return;
      const ux = (g.b[0] - g.a[0]) * dep.mLon;
      const uy = (g.b[1] - g.a[1]) * dep.mLat;
      const lo = path!.ring ? 0 : -RMAX;
      const hi = path!.ring ? g.L : g.L + RMAX;
      for (let i = 0; i < d.n; i++) {
        /* ⚠ Порталтай холбогдоогүй жорлон NaN — харьцуулалт бүгд худал
           тул шүүлтийг ДАВЖ гарах байсан */
        if (!Number.isFinite(d.lon[i])) continue;
        const x = (d.lon[i] - g.a[0]) * dep.mLon;
        const y = (d.lat[i] - g.a[1]) * dep.mLat;
        const s = (x * ux + y * uy) / g.L;
        if (s < lo || s > hi) continue;
        const off = (x * uy - y * ux) / g.L;
        if (Math.abs(off) > RMAX) continue;
        out.push({ i, seg: k, s, d: Math.abs(off), key: "" });
      }
    });
    out.sort((p, q) => p.d - q.d);
    out.length = Math.min(out.length, MAX_LAT);
    for (const o of out) o.key = keyOf(paramsOf(o.i));
    return out;
  }

  function fieldOf(p: SimParams): Field | null {
    const r = simulate(p);
    const F = r.F;
    const keep = r.snaps.filter((_, k) => k % KEEP === 0);
    if (!F) {
      /* Нүх гүний усанд шууд — хөрсөөр шүүгдэх зам байхгүй; нүхийг л зурна */
      return { nr: 1, nz: 1, h: p.gw, a: p.wid / Math.sqrt(Math.PI), R: RMAX, pit: p.pit, gw: p.gw, typ: null, qN: [], qE: [] };
    }
    return {
      nr: F.nr, nz: F.nz, h: F.h, a: F.a, R: F.R, pit: p.pit, gw: p.gw, typ: F.typ,
      qN: keep.map((s) => s.qN!), qE: keep.map((s) => s.qE!),
    };
  }

  function emit(grid: Uint8Array | null, deep: DeepSection | null) {
    const keys = path ? new Set(path.lat.map((o) => o.key)) : new Set<string>();
    let done = 0;
    for (const k of keys) if (cache.has(k)) done++;
    dep.onState({ count: path?.lat.length ?? 0, done, total: keys.size, steps, grid, samples: 201, deep });
  }

  async function compute() {
    if (!path || !data) return;
    const my = ++gen;
    path.lat = pick();
    paint();
    const todo = [...new Set(path.lat.map((o) => o.key))].filter((k) => !cache.has(k));
    for (const k of todo) {
      /* ⚠ Үндсэн урсгалыг түгжихгүйн тулд түлхүүр бүрийн өмнө нэг хүрээ өгнө */
      await new Promise((r) => setTimeout(r, 0));
      if (my !== gen || !path) return;
      const o = path.lat.find((x) => x.key === k)!;
      cache.set(k, fieldOf(paramsOf(o.i)));
      /* ⚠ Бүрд нь зурвал мянган жорлонгийн атлас × зуу гаруй түлхүүр —
         400 мс тутамд нэг л удаа */
      if (performance.now() - last > 400) paint();
    }
    paint();
  }
  let last = 0;

  /** Жорлонгийн зүсмэлийн пикселийн утга: 0 — хоосон, -1 — нүх, 1…255 — бохирдол */
  function sample(f: Field, x: number, dd: number, z: number, snap: number): number {
    const r = Math.hypot(x, dd);
    if (r < f.a && z < f.pit) return -1;
    if (!f.typ || r >= f.R || z >= f.gw) return 0;
    const i = Math.min(f.nr - 1, Math.floor(r / f.h));
    const j = Math.min(f.nz - 1, Math.floor(z / f.h));
    const k = j * f.nr + i;
    if (f.typ[k]) return -1;
    const q = (species === "N" ? f.qN : f.qE)[Math.min(snap, f.qN.length - 1)];
    return q ? q[k] : 0;
  }

  function paint() {
    last = performance.now();
    dep.layer.removeAll();
    if (!path || !data) return emit(null, null);
    const ramp = species === "N" ? RN3 : RE3;
    const e = dep.exs();
    /* Гүн (м) → зурагт өндөр: 2 м хүртэл блокийн өсгөлт, доош нь `DEEP_X` */
    const zOf = (top: number, zm: number) => (zm <= 2 ? top - zm * 100 * e : top - 200 * e - (zm - 2) * DEEP_X);
    /* хэрчим бүрийн нэгж вектор (метр) ба хасагдсан тал руу шилжилт */
    const geo = path.segs.map((g) => {
      const ux = g.L ? ((g.b[0] - g.a[0]) * dep.mLon) / g.L : 0;
      const uy = g.L ? ((g.b[1] - g.a[1]) * dep.mLat) / g.L : 0;
      const rr = (g.rem * Math.PI) / 180;
      const ox = Math.sin(rr);
      const oy = Math.cos(rr);
      const at = (s: number, k: number): Pt => [g.a[0] + (ux * s + ox * k) / dep.mLon, g.a[1] + (uy * s + oy * k) / dep.mLat];
      return { at };
    });

    /* ⚠ Зураг бүрд ШИНЭ canvas: SDK текстурыг эх обьектоор нь кэшлэдэг тул
       нэгийг нь дахин будахад цаг солигдсон ч хуучин зураг үлдэнэ */
    /* ⚠ Өндөр нь ХЭРЭГЦЭЭТЭЙ мөрөөр (2-ын зэрэгт) — зуу орчим жорлонд
       1024 × 128. Бүтэн 1024² нь тоглуулах алхам бүрд дахин ачаалагдаж
       нэг алхам ~300 мс болгож байв. */
    const cells = path.lat.filter((o) => cache.get(o.key)).length;
    const AH = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, Math.ceil(cells / PER_ROW)) * CH)));
    const atlas = document.createElement("canvas");
    atlas.width = ATLAS;
    atlas.height = AH;
    const actx = atlas.getContext("2d")!;
    const img = actx.createImageData(ATLAS, AH);
    /* Хуучин 0–2 м-ийн тор — зөвхөн шулуун зүсэлтийн хөндлөн огтлолд */
    const grid = path.ring ? null : new Uint8Array(201 * ROWS);
    const L0 = path.segs[0].L;
    const P = path.P;
    const pos: number[] = [];
    const uv: number[] = [];
    const faces: number[] = [];
    /* ангилал тутмын олон шугам: 0 — нүх, 1…BINS — бохирдлын түвшин */
    const strokes: number[][][][] = Array.from({ length: BINS + 1 }, () => []);
    const binOf = (q: number) => (q < 0 ? 0 : q > 0 ? 1 + Math.min(BINS - 1, Math.floor(((q - 1) / 255) * BINS)) : -1);

    /* Гүний хэсгийн доод хязгаар — зам дээрх хамгийн гүн гүний ус */
    let depth = 2.5;
    for (const o of path.lat) {
      const f = cache.get(o.key);
      if (f) depth = Math.max(depth, Math.min(DEEP_MAX, f.gw));
    }
    /* ⚠ Бага зай: хамгийн гүн гүний усны тэмдэг доод ирмэгт тасарч байв */
    depth = Math.min(DEEP_MAX * 1.06, depth * 1.06 + 0.3);
    const deep: DeepSection = {
      grid: new Uint8Array(DS * DR),
      samples: DS,
      rows: DR,
      depth,
      gw: new Float32Array(DS).fill(NaN),
      length: P,
      corners: path.ring ? path.segs.slice(1).map((g) => g.s0) : [],
    };
    /* гүний усны шугам: (замын зай, цэг) — дараалуулан, тасалдалтай */
    const gwPts: { s: number; seg: number; p: number[] }[] = [];

    let n = 0;
    path.lat.forEach((o) => {
      const f = cache.get(o.key);
      if (!f) return;
      const g = geo[o.seg];
      const sg = path!.segs[o.seg];
      const cell = n++;
      const cx = (cell % PER_ROW) * CW;
      const cy = Math.floor(cell / PER_ROW) * CH;
      /* пиксел бүр: x ∈ [−R, R] шугамын дагуу, z ∈ [0, 2 м] */
      let any = false;
      for (let v = 0; v < CH; v++) {
        const z = ((v + 0.5) / CH) * (DEPTH_CM / 100);
        for (let u = 0; u < CW; u++) {
          const x = ((u + 0.5) / CW) * 2 * f.R - f.R;
          const q = sample(f, x, o.d, z, t);
          if (!q) continue;
          any = true;
          const p = ((cy + v) * ATLAS + cx + u) * 4;
          if (q < 0) img.data.set([29, 20, 12, 235], p);
          else {
            const tt = (q - 1) / 254;
            const c = rampC(ramp, tt);
            img.data.set([c[0], c[1], c[2], Math.round(255 * (0.4 + 0.55 * tt))], p);
          }
        }
      }
      /* хуучин хөндлөн огтлолын диаграмд: төвийн баганын утга, сэмпл бүрд их нь */
      if (grid) {
        const si = Math.max(0, Math.min(200, Math.round((o.s / L0) * 200)));
        for (let rI = 0; rI < ROWS; rI++) {
          const q = sample(f, 0, o.d, ((rI + 0.5) / ROWS) * (DEPTH_CM / 100), t);
          const gq = q < 0 ? 0 : q;
          if (gq > grid[si * ROWS + rI]) grid[si * ROWS + rI] = gq;
        }
      }
      /* 2D гүний тор — замын зай дахь сэмплд */
      const ps = sg.s0 + Math.max(0, Math.min(sg.L, o.s));
      const di = Math.max(0, Math.min(DS - 1, Math.round((ps / Math.max(1, P)) * (DS - 1))));
      for (let r = 0; r < DR; r++) {
        const q = sample(f, 0, o.d, ((r + 0.5) / DR) * depth, t);
        const code = q < 0 ? 1 : q > 0 ? 2 + Math.min(253, Math.floor(((q - 1) / 254) * 253)) : 0;
        if (code > deep.grid[di * DR + r]) deep.grid[di * DR + r] = code;
      }
      if (!(f.gw >= deep.gw[di])) deep.gw[di] = f.gw;

      /* тогтмол өргөнтэй зураас: 0–2 м-д 10 см, доош нь 25 см алхмаар,
         гүний ус хүртэл — ижил ангиллын дараалсан мөрүүд нэг хэрчим */
      if (o.s >= 0 && o.s <= sg.L) {
        const [lon, lat] = g.at(o.s, 1.1);
        const top = dep.zAt(lon, lat);
        const zs: number[] = [];
        for (let z = 0; z < 2 - 1e-6; z += 0.1) zs.push(z);
        for (let z = 2; z < f.gw - 1e-6; z += 0.25) zs.push(z);
        zs.push(Math.max(f.gw, 2));
        const cls = zs.slice(0, -1).map((z, k) => binOf(sample(f, 0, o.d, (z + zs[k + 1]) / 2, t)));
        for (let r0 = 0; r0 < cls.length; ) {
          let r1 = r0 + 1;
          while (r1 < cls.length && cls[r1] === cls[r0]) r1++;
          if (cls[r0] >= 0)
            strokes[cls[r0]].push([
              [lon, lat, zOf(top, zs[r0])],
              [lon, lat, zOf(top, zs[r1])],
            ]);
          r0 = r1;
        }
        gwPts.push({ s: ps, seg: o.seg, p: [lon, lat, zOf(top, f.gw)] });
      }
      if (!any) return;
      /* дөрвөлжин: шугамын дагуу s ± R (хэрчмийн хүрээнд тайрна), дээд нь гадарга */
      const s0 = Math.max(0, o.s - f.R);
      const s1 = Math.min(sg.L, o.s + f.R);
      if (s1 <= s0) return;
      const u0 = (cx + ((s0 - (o.s - f.R)) / (2 * f.R)) * CW) / ATLAS;
      const u1 = (cx + ((s1 - (o.s - f.R)) / (2 * f.R)) * CW) / ATLAS;
      const v0 = cy / AH;
      const v1 = (cy + CH) / AH;
      const base = pos.length / 3;
      for (const [s, uu] of [
        [s0, u0],
        [s1, u1],
      ]) {
        const [lon, lat] = g.at(s, 0.8);
        const top = dep.zAt(lon, lat);
        pos.push(lon, lat, top, lon, lat, top - DEPTH_CM * e);
        uv.push(uu, v0, uu, v1);
      }
      faces.push(base, base + 1, base + 3, base, base + 3, base + 2);
    });
    actx.putImageData(img, 0, 0);
    emit(grid, n ? deep : null);
    if (!n) return;

    /*
      ГҮНИЙ ХЭСЭГ — хана бүрийн доор, блокийн ёроолоос `depth` хүртэл.
      ⚠ Зөвхөн хөрсний блок байгаа газарт (`valid`): блокоос гадуур ханан
      дор өлгөөтэй хэсэг нь агаарт хөвнө.
      ⚠ Хасагдсан тал руу 0.8 м — зураас (1.1 м) түүний ӨМНӨ, камер талд.
    */
    if (depth > 2) {
      const cp: number[] = [];
      const cf: number[] = [];
      path.segs.forEach((sg, k) => {
        if (sg.L < 1) return;
        const step = Math.max(20, sg.L / 120);
        const m = Math.ceil(sg.L / step);
        let prev = -1;
        for (let j = 0; j <= m; j++) {
          const s = (sg.L * j) / m;
          const [lon, lat] = geo[k].at(s, 0.8);
          if (!dep.valid(lon, lat)) {
            prev = -1;
            continue;
          }
          const top = dep.zAt(lon, lat);
          const idx = cp.length / 3;
          cp.push(lon, lat, zOf(top, 2), lon, lat, zOf(top, depth));
          if (prev >= 0) cf.push(prev, prev + 1, idx + 1, prev, idx + 1, idx);
          prev = idx;
        }
      });
      if (cf.length)
        dep.layer.add(
          new dep.Graphic({
            geometry: new dep.Mesh({
              spatialReference: dep.SR,
              vertexAttributes: { position: new Float64Array(cp) },
              components: [new dep.MeshComponent({ faces: new Uint32Array(cf), material: new dep.MeshMaterial({ color: [74, 62, 50, 1], doubleSided: true }) })],
            }),
            symbol: { type: "mesh-3d", symbolLayers: [{ type: "fill", material: { color: [255, 255, 255, 1] } }] },
          }),
        );
    }

    strokes.forEach((paths, bin) => {
      if (!paths.length) return;
      const c = bin === 0 ? [29, 20, 12] : rampC(ramp, (bin - 0.5) / BINS);
      dep.layer.add(
        new dep.Graphic({
          geometry: { type: "polyline", paths, hasZ: true, spatialReference: dep.SR },
          symbol: {
            type: "line-3d",
            symbolLayers: [{ type: "line", size: STROKE_PT, cap: "butt", material: { color: [c[0], c[1], c[2], bin === 0 ? 0.9 : 0.55 + (0.4 * bin) / BINS] } }],
          },
        }),
      );
    });

    /* Гүний усны түвшин — хөрш жорлонгуудыг холбоно, ⚠ 60 м-ээс их
       завсар ба хэрчмийн заагаар ТАСАЛНА: байхгүй түвшинг байгаа мэт
       зурахгүй (voxel-ийн гүний усны шугамтай нэг сургамж) */
    gwPts.sort((p, q) => p.s - q.s);
    const gwPaths: number[][][] = [];
    let cur: number[][] = [];
    gwPts.forEach((g, k) => {
      const p = gwPts[k - 1];
      if (p && (g.s - p.s > 60 || g.seg !== p.seg)) {
        if (cur.length > 1) gwPaths.push(cur);
        cur = [];
      }
      cur.push(g.p);
    });
    if (cur.length > 1) gwPaths.push(cur);
    if (gwPaths.length)
      dep.layer.add(
        new dep.Graphic({
          geometry: { type: "polyline", paths: gwPaths, hasZ: true, spatialReference: dep.SR },
          symbol: { type: "line-3d", symbolLayers: [{ type: "line", size: 2, material: { color: [95, 168, 255, 0.95] } }] },
        }),
      );

    if (!faces.length) return;
    const mesh = new dep.Mesh({
      spatialReference: dep.SR,
      vertexAttributes: { position: new Float64Array(pos), uv: new Float32Array(uv) },
      components: [
        new dep.MeshComponent({
          faces: new Uint32Array(faces),
          material: new dep.MeshMaterial({
            colorTexture: new dep.MeshTexture({ data: atlas }),
            alphaMode: "blend",
            doubleSided: true,
          }),
        }),
      ],
    });
    dep.layer.add(
      new dep.Graphic({ geometry: mesh, symbol: { type: "mesh-3d", symbolLayers: [{ type: "fill", material: { color: [255, 255, 255, 1] } }] } }),
    );
  }

  return {
    /** Шинэ шулуун зүсэлт; `rem` — хасагдсан талын азимут */
    setCut(a: Pt, b: Pt, rem: number) {
      const g = segOf(a, b, rem, 0);
      path = { segs: [g], P: g.L, ring: false, lat: [] };
      void compute();
    },
    /**
     * Зурсан талбайн хүрээ — хана бүр нэг хэрчим. Хасагдах (харагч) тал нь
     * ГАДАГШ: олон өнцөгтийн эргэлтийн чиглэлээс гаднах нормалийг авна.
     */
    setRing(P: Pt[]) {
      let area = 0;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) area += (P[j][0] - P[i][0]) * (P[j][1] + P[i][1]);
      /* area > 0 — цагийн зүүний ЭСРЭГ (энэ томьёонд: Σ (xⱼ − xᵢ)(yⱼ + yᵢ),
         j нь өмнөх орой); уртраг, өргөрөгийн эерэг масштаб тэмдгийг хадгална */
      const ccw = area > 0;
      const segs: Seg[] = [];
      let s0 = 0;
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        const b = P[(i + 1) % P.length];
        const ux = (b[0] - a[0]) * dep.mLon;
        const uy = (b[1] - a[1]) * dep.mLat;
        /* цагийн зүүний эсрэг үед дотор нь ЗҮҮН талд → гаднах нь баруун нормаль (uy, −ux) */
        const [nx, ny] = ccw ? [uy, -ux] : [-uy, ux];
        const rem = (Math.atan2(nx, ny) * 180) / Math.PI;
        const g = segOf(a, b, (rem + 360) % 360, s0);
        segs.push(g);
        s0 += g.L;
      }
      path = { segs, P: s0, ring: true, lat: [] };
      void compute();
    },
    /** Хасагдсан тал солигдсон — дахин бодохгүй, зөвхөн дахин зурна */
    setSide(rem: number) {
      if (!path || path.ring) return;
      path.segs[0].rem = rem;
      paint();
    },
    setTime(i: number) {
      t = i;
      paint();
    },
    setSpecies(s: Species) {
      species = s;
      paint();
    },
    clear() {
      gen++;
      path = null;
      dep.layer.removeAll();
      emit(null, null);
    },
    steps,
  };
}
