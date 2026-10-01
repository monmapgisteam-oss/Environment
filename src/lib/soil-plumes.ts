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

  ⚠⚠ Блок 2 м гүн тул нүхний ёроол (1.5–2.5 м) ба түүнээс доошхи
  бохирдол (гүний ус хүртэл) 3D-д ХАРАГДАХГҮЙ — хөндлөн огтлолын
  диаграм нь 0–200 см-ийг л харуулна. Энэ нь хөрсний дээд давхарга дахь
  бохирдлын ТАРХАЛТ; гүний усны асуудлыг "Нэвчилтийн симуляци" харуулна.
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
type OnCut = { i: number; s: number; d: number; key: string };

export type PlumeState = {
  /** Зүсэлт дээрх жорлон */
  count: number;
  /** Бодогдсон түлхүүр / нийт */
  done: number;
  total: number;
  /** Цагийн агшны тоо */
  steps: number;
  /** Хөндлөн огтлолын диаграмд: (сэмпл × `ROWS`) — 0 бол бохирдолгүй, 1…255 ангилал */
  grid: Uint8Array | null;
  samples: number;
};

type Deps = {
  Mesh: new (p?: object) => unknown;
  MeshComponent: new (p?: object) => unknown;
  MeshMaterial: new (p?: object) => unknown;
  MeshTexture: new (p?: object) => unknown;
  Graphic: new (p?: object) => unknown;
  layer: { removeAll: () => void; add: (g: unknown) => void };
  zAt: (lon: number, lat: number) => number;
  exs: () => number;
  mLon: number;
  mLat: number;
  SR: object;
  onState: (s: PlumeState) => void;
};

export function createPlumes(dep: Deps) {
  let data: SimData | null = null;
  const cache = new Map<string, Field | null>();
  let cut: { a: [number, number]; b: [number, number]; rem: number; L: number; lat: OnCut[] } | null = null;
  let t = 0;
  let species: Species = "N";
  let gen = 0;
  const steps = Math.floor((YEARS * 365) / STEP_DAYS) + 1;
  void fetchLatrineSim().then((d) => {
    data = d;
    if (cut) void compute();
  });

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

  /** Зүсэлт дээрх жорлонгууд — шугамын дагуух байрлал `s`, шугамаас зай `d` (м) */
  function pick(a: [number, number], b: [number, number]): OnCut[] {
    const d = data!;
    const ux = (b[0] - a[0]) * dep.mLon;
    const uy = (b[1] - a[1]) * dep.mLat;
    const L = Math.hypot(ux, uy);
    const out: OnCut[] = [];
    for (let i = 0; i < d.n; i++) {
      const x = (d.lon[i] - a[0]) * dep.mLon;
      const y = (d.lat[i] - a[1]) * dep.mLat;
      const s = (x * ux + y * uy) / L;
      if (s < -RMAX || s > L + RMAX) continue;
      const off = (x * uy - y * ux) / L;
      if (Math.abs(off) > RMAX) continue;
      out.push({ i, s, d: Math.abs(off), key: "" });
    }
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

  function emit(grid: Uint8Array | null) {
    const keys = cut ? new Set(cut.lat.map((o) => o.key)) : new Set<string>();
    let done = 0;
    for (const k of keys) if (cache.has(k)) done++;
    dep.onState({ count: cut?.lat.length ?? 0, done, total: keys.size, steps, grid, samples: 201 });
  }

  async function compute() {
    if (!cut || !data) return;
    const my = ++gen;
    cut.lat = pick(cut.a, cut.b);
    paint();
    const todo = [...new Set(cut.lat.map((o) => o.key))].filter((k) => !cache.has(k));
    for (const k of todo) {
      /* ⚠ Үндсэн урсгалыг түгжихгүйн тулд түлхүүр бүрийн өмнө нэг хүрээ өгнө */
      await new Promise((r) => setTimeout(r, 0));
      if (my !== gen || !cut) return;
      const o = cut.lat.find((x) => x.key === k)!;
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
    if (!cut || !data) return emit(null);
    const ramp = species === "N" ? RN3 : RE3;
    /* ⚠ Зураг бүрд ШИНЭ canvas: SDK текстурыг эх обьектоор нь кэшлэдэг тул
       нэгийг нь дахин будахад цаг солигдсон ч хуучин зураг үлдэнэ */
    /* ⚠ Өндөр нь ХЭРЭГЦЭЭТЭЙ мөрөөр (2-ын зэрэгт) — зуу орчим жорлонд
       1024 × 128. Бүтэн 1024² нь тоглуулах алхам бүрд дахин ачаалагдаж
       нэг алхам ~300 мс болгож байв. */
    const cells = cut.lat.filter((o) => cache.get(o.key)).length;
    const AH = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, Math.ceil(cells / PER_ROW)) * CH)));
    const atlas = document.createElement("canvas");
    atlas.width = ATLAS;
    atlas.height = AH;
    const actx = atlas.getContext("2d")!;
    const img = actx.createImageData(ATLAS, AH);
    const grid = new Uint8Array(201 * ROWS);
    const { a, b, rem, L } = cut;
    const pos: number[] = [];
    const uv: number[] = [];
    const faces: number[] = [];
    /* шугамын нэгж вектор (метр) ба хасагдсан тал руу 0.8 м */
    const ux = ((b[0] - a[0]) * dep.mLon) / L;
    const uy = ((b[1] - a[1]) * dep.mLat) / L;
    const remR = (rem * Math.PI) / 180;
    const ox = Math.sin(remR) * 0.8;
    const oy = Math.cos(remR) * 0.8;
    const at = (s: number, k = 1): [number, number] => [a[0] + (ux * s + ox * k) / dep.mLon, a[1] + (uy * s + oy * k) / dep.mLat];
    const e = dep.exs();
    /* ангилал тутмын олон шугам: 0 — нүх, 1…BINS — бохирдлын түвшин */
    const strokes: number[][][][] = Array.from({ length: BINS + 1 }, () => []);
    const rowM = DEPTH_CM / 100 / ROWS;
    let n = 0;
    cut.lat.forEach((o) => {
      const f = cache.get(o.key);
      if (!f) return;
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
      /* хөндлөн огтлолын диаграмд: төвийн баганын утга, сэмпл бүрд их нь */
      const si = Math.max(0, Math.min(200, Math.round((o.s / L) * 200)));
      const col: number[] = [];
      for (let rI = 0; rI < ROWS; rI++) {
        const q = sample(f, 0, o.d, ((rI + 0.5) / ROWS) * (DEPTH_CM / 100), t);
        const g = q < 0 ? 0 : q;
        if (g > grid[si * ROWS + rI]) grid[si * ROWS + rI] = g;
        col.push(q < 0 ? 0 : q > 0 ? 1 + Math.min(BINS - 1, Math.floor(((q - 1) / 255) * BINS)) : -1);
      }
      /* тогтмол өргөнтэй зураас — ижил ангиллын дараалсан мөрүүд нэг хэрчим */
      if (o.s >= 0 && o.s <= L) {
        const [lon, lat] = at(o.s, 1.1);
        const top = dep.zAt(lon, lat);
        for (let r0 = 0; r0 < ROWS; ) {
          let r1 = r0 + 1;
          while (r1 < ROWS && col[r1] === col[r0]) r1++;
          if (col[r0] >= 0)
            strokes[col[r0]].push([
              [lon, lat, top - r0 * rowM * 100 * e],
              [lon, lat, top - r1 * rowM * 100 * e],
            ]);
          r0 = r1;
        }
      }
      if (!any) return;
      /* дөрвөлжин: шугамын дагуу s ± R (блокийн хүрээнд тайрна), дээд нь гадарга */
      const s0 = Math.max(0, o.s - f.R);
      const s1 = Math.min(L, o.s + f.R);
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
        const [lon, lat] = at(s);
        const top = dep.zAt(lon, lat);
        pos.push(lon, lat, top, lon, lat, top - DEPTH_CM * e);
        uv.push(uu, v0, uu, v1);
      }
      faces.push(base, base + 1, base + 3, base, base + 3, base + 2);
    });
    actx.putImageData(img, 0, 0);
    emit(grid);
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
    /** Шинэ зүсэлт; `rem` — хасагдсан талын азимут */
    setCut(a: [number, number], b: [number, number], rem: number) {
      const L = Math.hypot((b[0] - a[0]) * dep.mLon, (b[1] - a[1]) * dep.mLat);
      cut = { a, b, rem, L, lat: [] };
      void compute();
    },
    /** Хасагдсан тал солигдсон — дахин бодохгүй, зөвхөн дахин зурна */
    setSide(rem: number) {
      if (!cut) return;
      cut.rem = rem;
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
      cut = null;
      dep.layer.removeAll();
      emit(null);
    },
    steps,
  };
}
