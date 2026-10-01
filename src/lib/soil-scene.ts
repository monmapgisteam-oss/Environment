/*
  ХӨРСНИЙ 3D БЛОК — ЗУРАХ ХӨДӨЛГҮҮР (ArcGIS Maps SDK)

  Рельеф дээр хөрсний профайлын блок босгож, түүнийг зүсэж дотоод
  бүтцийг харуулна. React-аас ТУСДАА: энэ бол бүхэлдээ императив
  геометр, canvas-ийн код бөгөөд зурагдалт бүрд дахин бодогдох ёсгүй.
  Бүрэлдэхүүн нь зөвхөн `createSoilScene()`-ийг дуудаж, буцаж ирсэн
  бариулаар удирдана.

  ⚠⚠ ХОЁР ӨӨР ЗҮСЭЛТ ХАМТРАН АЖИЛЛАНА:
    · `SliceAnalysis` нь блокийг ОГТОЛЖ хаяна — гэхдээ огтолсон нүүр нь
      ХООСОН үлддэг (SDK нүүрийг таглахгүй).
    · Тиймээс огтолсон хавтгайд ТАГЛАА (`cap`) мешийг өөрсдөө барина —
      яг тэр хавтгай дээрх давхаргууд. Хоёулаа байж байж л зүсэлт
      "хөрс зүссэн" мэт харагдана.
  ⚠ Таглаа нь `excludedLayers`-т орно, эс тэгвээс өөрөө огтлогдоно.

  ⚠⚠ КАТЕНА: хөрс хоорондын хил ХУРЦ БИШ. Хилийн ойролцоо хөрш
  профайлуудын зузааны векторыг зайн жингээр холино — нэг талын
  давхарга шаантаг шиг нимгэрч, нөгөөгийнх ургаж орж ирнэ. Хурц
  шугам нь зураглалын нэгжийн хил болохоос хөрсний бодит хил биш.

  ⚠ Босоо өсгөлт (×800) — блок ердөө 2 метр гүн, талбай нь 100 км.
  Өсгөлтгүй бол хөрс нь цаасны зузаан болно. Коэффициент нь дэлгэц
  дээр ИЛ бичигдэнэ.
*/
import {
  type Blend,
  type Profile,
  type SoilData,
  HCLS,
  LIFT,
  R_BOTTOM,
  SAT_TINT,
  SOILCOL,
  TILE_CM,
  TILE_H,
  TILE_W,
  bandAt,
  bandsOf,
  hcls,
  mulberry32,
} from "@/lib/soil-profile";
import { SEP_CLASSES, fetchLatrineSim, sepClass } from "@/lib/latrine-sim";
import type { Species } from "@/lib/latrine-sim-3d";
import { createPlumes, type PlumeState } from "@/lib/soil-plumes";
import { fetchLayerFeatures, fetchLayerInfo } from "@/lib/portal-layers";
import { NOGOON_TABS } from "@/lib/nogoon-layers";

const TILE_ASPECT = TILE_W / TILE_H;
const RAD = Math.PI / 180;
const A_ = 6378137;
const F_ = 1 / 298.257223563;
const E2 = F_ * (2 - F_);

export type PickInfo = {
  profile: Profile;
  /** Холимог бүсийн задаргаа — цэвэр бол нэг гишүүн */
  mix: { key: string; share: number }[];
  pure: boolean;
  svg: string;
  lon: number;
  lat: number;
  /** Газрын гадаргын өндөр, м.д.т.д. */
  elevation: number;
  /** Товшсон цэгийн гүн, см — гадаргууг товшвол `null` */
  depthCm: number | null;
};

/** Зүсэлтийн шугамын дагуух хөндлөн огтлол */
export type Section = {
  /** Шугамын урт, м */
  length: number;
  /** Эхлэлээс төгсгөл рүү чиглэсэн азимут, градус */
  azimuth: number;
  /** Ангиллын дараалал — `T` энэ дарааллаар */
  keys: string[];
  samples: {
    /** Эхлэлээс, м */
    d: number;
    lon: number;
    lat: number;
    /** Гадаргын өндөр, м — блокоос гадуур бол `null` */
    elev: number | null;
    /** Ангилал тутмын зузаан, см */
    T: number[] | null;
    /** Гүний усны гүн, см */
    gw: number;
  }[];
};

export type SoilScene = {
  destroy: () => void;
  /** Тухайн цэгийн профайлыг гаргана (хөндлөн огтлолын товшилт) */
  pickAt: (lon: number, lat: number) => void;
  /** Зүсэлт дээрх бохирдлын агшин (0 … `PlumeState.steps − 1`) */
  setPlumeTime: (i: number) => void;
  setPlumeSpecies: (s: Species) => void;
  /** Үе давхаргын хуулга — хавтанцрын зураг data URL-ээр */
  legend: () => { key: string; label: string; swatch: string }[];
  /** Хөрсний хэв шинжийн хуулга */
  soils: () => { key: string; name: string; wrb: string; color: string }[];
};

/* SDK нь энд төрөлгүй (CDN-ээс AMD-ээр ачаалагддаг) тул зөвхөн
   хэрэглэдэг гишүүдийг нь бүтцээрээ тодорхойлно */
type Obj = Record<string, unknown>;
type C<T = Obj> = new (p?: object) => T;
type GLayer = { removeAll: () => void; add: (g: unknown) => void; addMany: (g: unknown[]) => void };
type Reactive = { watch: (get: () => unknown, cb: () => void) => { remove: () => void } };
type Analysis = { shape: Obj | null; excludedLayers: unknown[]; excludeGroundSurface: boolean };
type Widget = { destroy: () => void };
type FLayer = { visible: boolean; load: () => Promise<unknown>; elevationInfo?: unknown };

/** Блокийн босоо өсгөлт (см → метр × өсгөлт/100). Тогтмол, дэлгэцэд ил бичигдэнэ. */
export const SOIL_EXAGGERATION = 800;

export const SOIL_MODULES = [
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/geometry/Mesh",
  "esri/geometry/support/MeshComponent",
  "esri/geometry/support/MeshMaterial",
  "esri/geometry/support/MeshTexture",
  "esri/analysis/SliceAnalysis",
  "esri/analysis/SlicePlane",
  "esri/widgets/Expand",
  "esri/geometry/Point",
  "esri/geometry/Extent",
  "esri/core/reactiveUtils",
  "esri/layers/FeatureLayer",
];

export async function createSoilScene(opts: {
  container: HTMLDivElement;
  data: SoilData;
  mods: unknown[];
  onPick: (info: PickInfo | null) => void;
  onNote: (text: string) => void;
  /** Зүсэлтийн хөндлөн огтлол; зүсэлт байхгүй бол `null` */
  onSection: (s: Section | null) => void;
  /** Зүсэлт дээрх жорлонгийн бохирдлын төлөв */
  onPlumes: (s: PlumeState) => void;
  /**
   * Нүхэн жорлон (цэг эсвэл хайрцаг) товшигдсон — симуляцийн багцын
   * ИНДЕКС (`latrine-sim.bin`-ийн дараалал; давхаргын `oid` = индекс + 1)
   */
  onLatrine: (i: number) => void;
}): Promise<SoilScene> {
  const { container, data, onPick, onNote, onSection, onPlumes, onLatrine } = opts;
  const [EsriMap, SceneView, GraphicsLayer, Graphic, Mesh, MeshComponent, MeshMaterial, MeshTexture,
    SliceAnalysis, SlicePlane, Expand, Point, Extent, reactiveUtils, FeatureLayer] = opts.mods as [
    C, C, C<GLayer>, C, C, C, C, C, C, C, C<Widget>, C, C, Reactive, C<FLayer>,
  ];

  const { header, cells, z, keys, thick, gwcm, mLon, mLat } = data;
  const { nx, ny, dx, dy, x0, y0, fine, profiles } = header;
  const NXF = nx * fine;
  const NYF = ny * fine;
  /* ⚠ Хиймэл дагуулын зургийг ЗЭРЭГЦЭЭ эхлүүлнэ — доорх бүтэц, профайлын
     бэлтгэл хэдэн секунд авдаг тул хавтангийн татац түүний ард нуугдана */
  const imageryP = imageryCanvas(x0, y0, x0 + nx * dx, y0 + ny * dy, mLon, mLat).catch(() => null);

  /* ── Нарийн (≈75 м) хөрсний индекс ба дээд гадаргын өнгө ───────── */
  const fineImg = await blobImage(data.finePng);
  const fc = document.createElement("canvas");
  fc.width = NXF;
  fc.height = NYF;
  const fg = fc.getContext("2d", { willReadFrequently: true })!;
  fg.drawImage(fineImg, 0, 0);
  const px = fg.getImageData(0, 0, NXF, NYF);
  const FINEIDX = new Uint8Array(NXF * NYF);
  for (let i = 0; i < FINEIDX.length; i++) FINEIDX[i] = px.data[i * 4];

  /* Дээд гадаргын зураглал: хөрсний хэв шинжийн өнгө + хилийн шугам.
     ⚠ Индексийн PNG-г ДАРЖ бичнэ — тэр canvas нь дараа нь бүтэц болж
     ашиглагдана, индекс нь `FINEIDX`-д аль хэдийн хуулагдсан. */
  const topImg = fg.createImageData(NXF, NYF);
  const noise = mulberry32(11);
  const rgb = profiles.map((p) => {
    const n = parseInt((SOILCOL[p.key] || "#999999").slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  });
  for (let r = 0; r < NYF; r++) {
    for (let c = 0; c < NXF; c++) {
      const i = r * NXF + c;
      const v = FINEIDX[i];
      const col = rgb[v] || [150, 150, 150];
      const edge = (c + 1 < NXF && FINEIDX[i + 1] !== v) || (r + 1 < NYF && FINEIDX[i + NXF] !== v);
      const k = edge ? 0.55 : 0.9 + noise() * 0.2;
      topImg.data.set([col[0] * k, col[1] * k, col[2] * k, 255], i * 4);
    }
  }
  fg.putImageData(topImg, 0, 0);

  /* ── Бүтэц: жишиг зургийн хавтанцрыг ангилал тус бүрд тохируулна ── */
  const tileImgs: Record<string, HTMLImageElement> = {};
  await Promise.all(
    Object.entries(data.tiles).map(async ([k, b]) => {
      tileImgs[k] = await blobImage(b);
    }),
  );
  const TEXCV: Record<string, HTMLCanvasElement> = {};
  for (const cls of Object.keys(HCLS)) {
    const [src, o] = HCLS[cls].photo;
    const cv = document.createElement("canvas");
    cv.width = TILE_W;
    cv.height = TILE_H;
    const g = cv.getContext("2d")!;
    g.drawImage(tileImgs[src], 0, 0, TILE_W, TILE_H);
    if (o.f || o.gray || o.tint) {
      const im = g.getImageData(0, 0, TILE_W, TILE_H);
      const d = im.data;
      const f = o.f || 1;
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] * f;
        let gg = d[i + 1] * f;
        let b = d[i + 2] * f;
        if (o.gray) {
          const l = 0.3 * r + 0.59 * gg + 0.11 * b;
          r += (l - r) * o.gray;
          gg += (l - gg) * o.gray;
          b += (l - b) * o.gray;
        }
        if (o.tint) {
          r += (o.tint[0] - r) * o.k!;
          gg += (o.tint[1] - gg) * o.k!;
          b += (o.tint[2] - b) * o.k!;
        }
        d[i] = r;
        d[i + 1] = gg;
        d[i + 2] = b;
      }
      g.putImageData(im, 0, 0);
    }
    decorate(cls, g);
    TEXCV[cls] = cv;
  }

  const TEX = Object.fromEntries(
    Object.entries(TEXCV).map(([k, cv]) => [k, new MeshTexture({ data: cv, wrap: "repeat" })]),
  );
  const MAT: Record<string, unknown> = {};
  /** `_w` дагавар = гүний усаар ханасан хэсэг (цэнхэр туяа) */
  const mat = (key: string) =>
    (MAT[key] ??= new MeshMaterial({
      colorTexture: TEX[key.split("_")[0]],
      color: key.endsWith("_w") ? SAT_TINT : [255, 255, 255, 1],
      doubleSided: true,
    }));
  const SR = { wkid: 4326 };
  const sym = { type: "mesh-3d", symbolLayers: [{ type: "fill", material: { color: [255, 255, 255, 1] } }] };

  /* ── Торны хандалт ─────────────────────────────────────────────── */
  const cellAt = (lon: number, lat: number) => {
    const c = Math.floor((lon - x0) / dx);
    const r = Math.floor((lat - y0) / dy);
    return c < 0 || r < 0 || c >= nx || r >= ny ? -1 : r * nx + c;
  };
  const validAt = (lon: number, lat: number) => {
    const i = cellAt(lon, lat);
    return i >= 0 && cells[i] !== 255;
  };
  const soilAt = (lon: number, lat: number) => {
    const i = cellAt(lon, lat);
    if (i < 0) return 255;
    const fcx = Math.floor(((lon - x0) / dx) * fine);
    const fry = Math.floor(((lat - y0) / dy) * fine);
    const v = FINEIDX[(NYF - 1 - fry) * NXF + fcx];
    return v < profiles.length ? v : cells[i];
  };
  /** Хоёр шугамт интерполяци — булангийн өндрөөс */
  const zAt = (lon: number, lat: number) => {
    let c = (lon - x0) / dx;
    let r = (lat - y0) / dy;
    c = Math.max(0, Math.min(nx - 1e-6, c));
    r = Math.max(0, Math.min(ny - 1e-6, r));
    const c0 = c | 0;
    const r0 = r | 0;
    const fcf = c - c0;
    const frf = r - r0;
    const W = nx + 1;
    const i = r0 * W + c0;
    return (z[i] * (1 - fcf) + z[i + 1] * fcf) * (1 - frf) + (z[i + W] * (1 - fcf) + z[i + W + 1] * fcf) * frf;
  };

  /*
    ⚠⚠ ТОГТМОЛ УТГУУД (хэрэглэгчийн шийдвэр, 2026-09-30: "chi uuruu
    medeed togtmol bolgood header hesgees del"). Урьд нь толгойд таван
    гулсуур байсан (азимут, хуулсан гүн, босоо өсгөлт, хөрсний
    шилжилт, газрын гадарга) — одоо бүгд тогтмол:
      · шилжилтийн өргөн 150 м — хил хурц биш ч катена нь хэт
        сарниж хөрсний хэв шинж уусахгүй;
      · босоо өсгөлт ×800 — 2 метрийн хөрс 1.6 км болж 100 км
        блокийн ирмэгт уншигдана (дэлгэц дээр ИЛ бичигдэнэ);
      · хуулсан гүн анхдагч 0 — зүсэлтийн хэрэгслийн "Хэвтээ зүсэлт"
        гулсуураар өөрчлөгдөнө (толгойн мөрөнд БИШ);
      · газрын гадарга унтраалттай — рельеф блокийг бүрхэнэ.
    Азимутыг зүсэлтийн хэрэгслээр (шугам татна) өгнө.
  */
  const TRANS: number = 150;
  /** Катенагийн холилдол — тухайн цэг дэх зузааны вектор ба гүний ус */
  function profAt(lon: number, lat: number): Blend {
    const w = new Float32Array(profiles.length);
    let W = 0;
    if (TRANS > 0) {
      const rx = TRANS / mLon;
      const ry = TRANS / mLat;
      for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
          const d2 = (i * i + j * j) / 16;
          if (d2 > 1) continue;
          const lo = lon + (i / 4) * rx;
          const la = lat + (j / 4) * ry;
          if (!validAt(lo, la)) continue;
          const k = 1 - d2;
          w[soilAt(lo, la)] += k;
          W += k;
        }
      }
    }
    if (!W) {
      w[soilAt(lon, lat)] = 1;
      W = 1;
    }
    const T = new Float32Array(keys.length);
    let gw = 0;
    w.forEach((v, p) => {
      if (!v) return;
      const f = v / W;
      w[p] = f;
      gw += f * gwcm[p];
      for (let k = 0; k < T.length; k++) T[k] += f * thick[p][k];
    });
    return { T, gw, w };
  }

  /* ── Mesh бүтээгч ──────────────────────────────────────────────── */
  class MB {
    pos: number[] = [];
    uv: number[] = [];
    f: Record<string, number[]> = {};
    v(lon: number, lat: number, zz: number, u: number, w: number) {
      this.pos.push(lon, lat, zz);
      this.uv.push(u, w);
      return this.pos.length / 3 - 1;
    }
    quad(k: string, a: number, b: number, c: number, d: number) {
      (this.f[k] ??= []).push(a, b, c, a, c, d);
    }
    tri(k: string, a: number, b: number, c: number) {
      (this.f[k] ??= []).push(a, b, c);
    }
    mesh() {
      const ks = Object.keys(this.f);
      if (!ks.length) return null;
      return new Mesh({
        spatialReference: SR,
        vertexAttributes: { position: new Float64Array(this.pos), uv: new Float32Array(this.uv) },
        components: ks.map((k) => new MeshComponent({ faces: new Uint32Array(this.f[k]), material: mat(k) })),
      });
    }
  }

  /** Босоо өсгөлт — шелл нь дэлгэц дээр ИЛ бичихийн тулд экспортлогдоно */
  const EX = SOIL_EXAGGERATION;
  /** Хуулсан гүн — хэвтээ зүсэлт хасагдсан тул ТОГТМОЛ 0 (механизм нь хэвээр) */
  const PEEL: number = 0;
  const exs = () => EX / 100;
  const tileM = () => (TILE_CM / 100) * EX;

  /* ⚠ ДАВХАРГЫН ХИЛИЙГ БАГА ЗЭРЭГ ДОЛГИОЛОГ болгоно — шулуун хил нь
     хиймэл харагдана. Гүн `t`-ийн ТАСРАЛТГҮЙ функц тул тэг зузаантай
     давхарга тэг хэвээр үлдэж, уламжлал нь 1-ээс бага тул дараалал
     алдагдахгүй. Байршлаас хамаарах тул хөрш зурвасын оройнууд таарна. */
  const phase = (lon: number, lat: number) => {
    const x = lon * mLon;
    const y = lat * mLat;
    return 2 * Math.sin(x / 173 + Math.sin(y / 211)) + Math.sin((x + y) / 97) + 0.6 * Math.sin(y / 61 - x / 137);
  };
  const wav = (t: number, ph: number) =>
    t <= 0 || t >= R_BOTTOM ? t : t + 2.5 * Math.sin((Math.PI * t) / R_BOTTOM) * Math.sin(0.07 * t + ph);

  /** A→B шугамын доорх босоо зурвас; хоёр үзүүрт өөр профайлтай тул хил налж шилжинэ */
  /**
   * A→B шугамын доорх босоо зурвас.
   *
   * ⚠ `topA`/`topB` нь ДЭЭД ХЯЗГААР, см. Анхдагчаар хуулсан гүн
   * (`PEEL`) боловч ХЭВТЭЭ зүсэлтийн периметрийн хананд цэг тутамд
   * өөр байна: тэнд хана нь гадаргаас биш ОГТОЛСОН ГҮНЭЭС эхэлнэ.
   */
  function strip(mb: MB, A: number[], B: number[], zA: number, zB: number, uA: number, uB: number, prA: Blend, prB: Blend, topA = PEEL, topB = PEEL) {
    const e = exs();
    const bA = bandsOf(prA, keys);
    const bB = bandsOf(prB, keys);
    const pA = phase(A[0], A[1]);
    const pB = phase(B[0], B[1]);
    for (let i = 0; i < bA.length; i++) {
      const tA = Math.max(wav(bA[i].t, pA), topA);
      const tB = Math.max(wav(bB[i].t, pB), topB);
      const dA = Math.max(wav(bA[i].b, pA), tA);
      const dB = Math.max(wav(bB[i].b, pB), tB);
      if (dA - tA < 0.01 && dB - tB < 0.01) continue; // энэ хэсэгт байхгүй / хуулагдсан давхарга
      const k = bA[i].c + (bA[i].sat ? "_w" : "");
      const a = mb.v(A[0], A[1], zA - tA * e, uA, tA / TILE_CM);
      const b = mb.v(B[0], B[1], zB - tB * e, uB, tB / TILE_CM);
      const c = mb.v(B[0], B[1], zB - dB * e, uB, dB / TILE_CM);
      const d = mb.v(A[0], A[1], zA - dA * e, uA, dA / TILE_CM);
      mb.quad(k, a, b, c, d);
    }
  }

  /* ── Давхаргууд, харагдац ──────────────────────────────────────── */
  const blockL = new GraphicsLayer({ title: "Хөрсний блок", elevationInfo: { mode: "absolute-height" } });
  const capL = new GraphicsLayer({ title: "Зүсэлтийн таглаа", elevationInfo: { mode: "absolute-height" } });
  const markL = new GraphicsLayer({ title: "Сонгосон цэг", elevationInfo: { mode: "absolute-height" } });
  /** Зурж буй зүсэлтийн шугам — огтлолтоос чөлөөлөгдөнө */
  const lineL = new GraphicsLayer({ title: "Зүсэлтийн шугам", elevationInfo: { mode: "absolute-height" } });
  /** Бодит орчны шуудууны ЁРООЛ — огтлолтоос чөлөөлөгдөнө, газар нь
      бусад газарт түүнийг бүрхэнэ (`rebuild`-ийн тэмдэглэлийг үз) */
  const floorL = new GraphicsLayer({ title: "Шуудууны ёроол", elevationInfo: { mode: "absolute-height" } });
  /** Зүсэлт дээрх жорлонгийн бохирдол — огтлолтоос чөлөөлөгдөнө ({@link createPlumes}) */
  const plumeL = new GraphicsLayer({ title: "Бохирдол", elevationInfo: { mode: "absolute-height" } });
  const map = new EsriMap({ basemap: "satellite", ground: "world-elevation", layers: [blockL, floorL, capL, plumeL, markL, lineL] }) as {
    ground: { opacity: number; navigationConstraint: { type: string } };
    add: (l: unknown) => void;
    remove: (l: unknown) => void;
  };
  /* ⚠ Газрын гадаргыг АНХНААСАА НУУНА: рельеф нь блокийг бүрхэнэ.
     Хэрэглэгч гулсуураар нь буцааж асаана. */
  map.ground.opacity = 0;
  map.ground.navigationConstraint = { type: "none" };

  /* ⚠ ЗҮСЭЛТИЙН ХАВТГАЙН ХЭМЖЭЭ ДАТАНААС. Тогтмол 300 км өргөн,
     20 км өндөр авахад SDK-ийн хүрээний шугам блокоос хальж, хоосон
     тэнгэрийг хөндлөн огтолсон улбар шар зураас болж харагдана.
     Одоо хэвтээ тэнхлэгт хавтгай нь зурсан шугамын БЛОК ДОТОРХ
     уртаар (`trim`), босоо тэнхлэгт блокийн бүтэн өндрөөр (`vSpan`). */
  let zLo = Infinity;
  let zHi = -Infinity;
  for (const v of z) {
    if (v < zLo) zLo = v;
    if (v > zHi) zHi = v;
  }
  /*
    ⚠⚠ БОСОО ХАВТГАЙ БЛОКИЙН БҮТЭН ӨНДРИЙГ ХАМАРНА — ӨСГӨЛТТЭЙ ГҮНИЙГ
    ОРУУЛЖ. `exs()` нь СМ-ийг шууд МЕТР болгож үржүүлдэг (200 см × 8 =
    1,600 м) тул блок нь анхдагчаар 1.6 км, дээд өсгөлтөд 4 км гүн.
    Урьд нь өндрийг зөвхөн рельефийн далайцаар (3.2 км) тооцож, гадаргын
    цэг дээр ТӨВЛӨРҮҮЛДЭГ байсан тул доод хагас нь ердөө 1.6 км хүрч,
    ёроол ×800-д ирмэг дээрээ ТОЛБО ТОЛБО, ×2000-д БҮРЭН огтлогдохгүй
    үлдэж — суваг дотор "шал" болж харагдаж байв (хэрэглэгч 2026-09-30:
    "чамд алдаа харагдаж байна уу"; хөтөч дээр гүн тус бүрээр хэмжиж
    тогтоосон: 8 м дээш бүрэн, 16 м толбо, 20 м-ээс доош огт).
    Одоо хавтгай блокийн ДООД ирмэгээс (хамгийн нам гадаргаас хөрсний
    бүтэн гүнээр доош) ДЭЭД ирмэг хүртэл яг таарна — төв нь тэр
    хоёрын дунд. Өсгөлт солигдоход дагаж шинэчлэгдэнэ.
  */
  /*
    ⚠⚠ ХАВТГАЙН ӨРГӨН нь MERCATOR НЭГЖЭЭР. Локал харагдац нь суурь
    зургийнхаа Web Mercator (3857) орон зайд ажилладаг тул Esri
    `width`, `height`(хэвтээ хавтгайд)-ийг тэр нэгжээр уншина — бодит
    газарт энэ нь cos(өргөрөг) дахин БАГА (Улаанбаатарт 0.67). Таглааг
    бодит метрээр (ECEF) зурдаг тул хөрвүүлэхгүй бол хажуу хана
    огтлолтоос 1.5 дахин өргөн зурагдаж, хоёрын хоорондох огтлогдоогүй
    ёроол ханын дагуу цайвар ЗУРВАС болж харагдаж байв (хөтөч дээр
    хэмжсэн: огтлолт ханын зайн яг 0.67 байв).
    ⚠ Өндөр (`z`) нь МЕТР хэвээр — Mercator зөвхөн хэвтээ тэнхлэгийг
    сунгадаг. Чиглэл ч хэвээр (конформ проекц).
  */
  const mercK = (lat: number) => Math.cos(lat * RAD);
  const vSpan = () => {
    const bottom = zLo - R_BOTTOM * exs() - 100;
    const top = zHi + 100;
    return { h: top - bottom, z: (top + bottom) / 2 };
  };
  /*
    ⚠⚠ ДЭВСГЭР ГЭРЭЛ/ХАРАНХУЙ ГОРИМЫГ ДАГАНА (хэрэглэгч 2026-10-01:
    "light gorim deer map light gorimru shiljihgui bn"). "Газрын зураг
    горимоос үл хамаарна" дүрэм (2026-09-17) нь зургийн АГУУЛГАД —
    хөрсний блок, гадарга, жорлон, өнгө ХЭВЭЭР; зөвхөн блокийн АРД
    харагдах хоосон орон зай нь хуудастайгаа нийцнэ. Гэрэл горимд хар
    тэгш өнцөгт хуудасны дунд цоорхой мэт харагдаж байв.
    ⚠ Өнгө нь `--paper-3` токеноос ШУУД уншигдана (контейнерийн дэвсгэртэй
    ижил) — палитр өөрчлөгдвөл дагана, кодод hex бичихгүй.
    ⚠ Горим солигдоход `data-theme`-ийг ажиглаж шууд солино (`themeObs`).
  */
  const themeBg = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--paper-3").trim() ||
    (document.documentElement.dataset.theme === "dark" ? "#102023" : "#eef0e7");
  const view = new SceneView({
    container,
    map,
    qualityProfile: "high",
    /* ⚠ ЗААВАЛ local — блок нь 100 км-ийн талбайд 2 метр гүн; дэлхийн
       горимд босоо өсгөлт, зүсэлтийн хавтгай хоёулаа гажина */
    viewingMode: "local",
    ui: { components: [] },
    environment: {
      lighting: { type: "virtual" },
      atmosphereEnabled: false,
      starsEnabled: false,
      /* ⚠ Дэвсгэр нь ГОРИМЫГ ДАГАНА — доорх `themeBg`-ийг үз */
      background: { type: "color", color: themeBg() },
    },
  }) as unknown as {
    destroy: () => void;
    when: () => Promise<void>;
    goTo: (t: unknown, o?: object) => Promise<void>;
    ui: { add: (w: unknown, p?: string) => void };
    analyses: { add: (a: unknown) => void };
    on: (ev: string, cb: (e: never) => void) => { remove: () => void };
    hitTest: (
      e: unknown,
      o: unknown,
    ) => Promise<{
      results: { mapPoint?: { longitude: number; latitude: number; z: number }; graphic?: { attributes: Record<string, unknown> | null; layer?: unknown } }[];
    }>;
    environment: Record<string, unknown>;
    toMap: (e: unknown) => { longitude: number; latitude: number } | null;
    toScreen: (p: unknown) => { x: number; y: number } | null;
    scale: number;
    stationary: boolean;
    whenLayerView: (l: unknown) => Promise<{ filter: unknown }>;
    camera: { position: { longitude: number; latitude: number } };
  };

  const themeObs = new MutationObserver(() => {
    view.environment.background = { type: "color", color: themeBg() };
  });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* ── Блокийн гурван хэсэг ──────────────────────────────────────── */
  function buildTop(tex: HTMLCanvasElement) {
    const W = nx + 1;
    const pos = new Float64Array(W * (ny + 1) * 3);
    const uv = new Float32Array(W * (ny + 1) * 2);
    const faces: number[] = [];
    for (let r = 0; r <= ny; r++) {
      for (let c = 0; c <= nx; c++) {
        const i = r * W + c;
        pos.set([x0 + c * dx, y0 + r * dy, z[i]], i * 3);
        uv.set([c / nx, 1 - r / ny], i * 2);
      }
    }
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        if (cells[r * nx + c] === 255) continue;
        const a = r * W + c;
        faces.push(a, a + 1, a + W + 1, a, a + W + 1, a + W);
      }
    }
    return new Graphic({
      geometry: new Mesh({
        spatialReference: SR,
        vertexAttributes: { position: pos, uv },
        components: [
          new MeshComponent({
            faces: new Uint32Array(faces),
            material: new MeshMaterial({ colorTexture: new MeshTexture({ data: tex }), doubleSided: true }),
          }),
        ],
      }),
      symbol: sym,
    });
  }

  /** Гадна хана — хөрстэй нүдний хоосон хөрштэй ирмэг дээр */
  function buildWalls() {
    const mb = new MB();
    const W = nx + 1;
    const t = tileM();
    const ok = (r: number, c: number) => r >= 0 && c >= 0 && r < ny && c < nx && cells[r * nx + c] !== 255;
    const P = (r: number, c: number) => [x0 + c * dx, y0 + r * dy, z[r * W + c]];
    const edge = (A: number[], B: number[], alongLon: boolean) => {
      const tu = t * TILE_ASPECT;
      const uA = (alongLon ? A[0] * mLon : A[1] * mLat) / tu;
      const uB = (alongLon ? B[0] * mLon : B[1] * mLat) / tu;
      strip(mb, A, B, A[2], B[2], uA, uB, profAt(A[0], A[1]), profAt(B[0], B[1]));
    };
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        if (cells[r * nx + c] === 255) continue;
        if (!ok(r - 1, c)) edge(P(r, c), P(r, c + 1), true);
        if (!ok(r + 1, c)) edge(P(r + 1, c + 1), P(r + 1, c), true);
        if (!ok(r, c - 1)) edge(P(r + 1, c), P(r, c), false);
        if (!ok(r, c + 1)) edge(P(r, c + 1), P(r + 1, c + 1), false);
      }
    }
    return new Graphic({ geometry: mb.mesh(), symbol: sym });
  }

  /**
   * Рельефийг дагасан, `depthCm` гүн дэх гадарга — тэр гүнд байгаа
   * давхаргын бүтэцтэй. Хоёр газар хэрэглэгдэнэ:
   *   · гүний зүсмэл (`PEEL`) — дээд гадаргын оронд;
   *   · ЁРООЛ (`R_BOTTOM`) — блокийг доороос нь хаана.
   */
  function buildSheet(depthCm: number) {
    const mb = new MB();
    const W = nx + 1;
    const e = exs();
    const t = tileM();
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        if (cells[r * nx + c] === 255) continue;
        const bd = bandAt(profAt(x0 + (c + 0.5) * dx, y0 + (r + 0.5) * dy), keys, depthCm);
        if (!bd) continue;
        const i = r * W + c;
        const L0 = x0 + c * dx;
        const L1 = L0 + dx;
        const B0 = y0 + r * dy;
        const B1 = B0 + dy;
        const u0 = (L0 * mLon) / (t * TILE_ASPECT);
        const u1 = (L1 * mLon) / (t * TILE_ASPECT);
        const v0 = (B0 * mLat) / t;
        const v1 = (B1 * mLat) / t;
        const zz = (j: number) => z[j] - depthCm * e;
        mb.quad(
          bd.c + (bd.sat ? "_w" : ""),
          mb.v(L0, B0, zz(i), u0, v0),
          mb.v(L1, B0, zz(i + 1), u1, v0),
          mb.v(L1, B1, zz(i + W + 1), u1, v1),
          mb.v(L0, B1, zz(i + W), u0, v1),
        );
      }
    }
    return new Graphic({ geometry: mb.mesh(), symbol: sym });
  }

  /*
    ⚠ ДЭЭД ГАДАРГА — анхдагчаар хөрсний хэв шинж бодит газрын бүтэцтэй
    (доорх `geologyCanvas`), "Харагдац" цонхны "Дээд гадарга"-аар хиймэл
    дагуулын зураг руу сэлгэнэ. Зураг татагдаагүй бол (сүлжээ) хавтгай
    зураглал (`fc`), зургийн сонголт идэвхгүй. Гадарга тус бүр НЭГ удаа
    баригдаж кэшлэгдэнэ (`tops`).
  */
  const imgCv = await imageryP;
  /*
    ⚠⚠ ГЕОЛОГИ нь БОДИТ ГАДАРГА ШИГ (хэрэглэгчийн залруулга 2026-09-30:
    "bishee geology goy real gadargu bolgo gj helj bn"). Эхний хариу нь
    хөрсний зураглалыг хиймэл дагуулын зургаар СОЛЬСОН — буруу ойлголт:
    хүссэн нь хөрсний хэв шинжийн мэдээлэл ХЭВЭЭР, харин газар шиг
    харагдах. Гурван давхаргаар угсарна (`geologyCanvas`):
      1. хөрсний хэв шинжийн өнгө — нарийн тороос томруулж, хагас нүдээр
         БҮДГЭРҮҮЛНЭ: хил зөөлөрнө (катенатай нэг санаа);
      2. хиймэл дагуулын зургийн ГЭРЭЛТЭЛТ (`luminosity`) — өнгө нь
         хөрсний хэв шинжийнх, гэрэл сүүдэр, бүтэц нь бодит газрынх:
         нуруу, гуу, гол, зам, хороолол харагдана;
      3. хилийн шугам — нимгэн, 28% тунгалаг (урьд нь 45% бараан, хурц).
    ⚠ Өнгө нь hue, ханалтаараа хадгалагдах тул баруун талын "Хөрсний хэв
    шинж" хуулга хүчинтэй хэвээр. Зураг татагдаагүй бол хуучин хавтгай
    зураглал (`fc`).
    ⚠ `ctx.filter` (бүдгэрүүлэлт, гэрэлтүүлэлт) Safari-д байхгүй — тэнд
    хил хурц, зураг арай бараан гарна; эвдрэлгүй.
  */
  const geoCv = imgCv ? geologyCanvas(imgCv) : null;
  type Surface = "geology" | "imagery";
  let SURF: Surface = "geology";
  const tops: Partial<Record<Surface, unknown>> = {};
  const texOf = () => (SURF === "imagery" && imgCv ? imgCv : (geoCv ?? fc));
  const topOf = () => (tops[SURF] ??= buildTop(texOf()));
  function geologyCanvas(img: HTMLCanvasElement) {
    const W = img.width;
    const H = img.height;
    const soil = document.createElement("canvas");
    soil.width = NXF;
    soil.height = NYF;
    const edges = document.createElement("canvas");
    edges.width = NXF;
    edges.height = NYF;
    const sd = new ImageData(NXF, NYF);
    const ed = new ImageData(NXF, NYF);
    for (let r = 0; r < NYF; r++) {
      for (let c = 0; c < NXF; c++) {
        const i = r * NXF + c;
        const v = FINEIDX[i];
        const col = rgb[v] || [150, 150, 150];
        sd.data.set([col[0], col[1], col[2], 255], i * 4);
        const edge = (c + 1 < NXF && FINEIDX[i + 1] !== v) || (r + 1 < NYF && FINEIDX[i + NXF] !== v);
        if (edge) ed.data.set([24, 16, 10, 255], i * 4);
      }
    }
    soil.getContext("2d")!.putImageData(sd, 0, 0);
    edges.getContext("2d")!.putImageData(ed, 0, 0);
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const g = out.getContext("2d")!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    /* 1 — хөрсний өнгө, хил нь хагас нүдээр зөөлөрсөн */
    g.filter = `blur(${Math.max(1, (W / NXF) * 0.5).toFixed(1)}px)`;
    g.drawImage(soil, 0, 0, W, H);
    /* 2 — бодит газрын гэрэлтэлт; зураг бараан тул тодруулна */
    g.filter = "brightness(1.35) contrast(1.15)";
    g.globalCompositeOperation = "luminosity";
    g.globalAlpha = 0.9;
    g.drawImage(img, 0, 0);
    g.filter = "none";
    /* 3 — зураглалын нэгжийн хил, нимгэн */
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 0.28;
    g.drawImage(edges, 0, 0, W, H);
    g.globalAlpha = 1;
    return out;
  }
  /* ⚠⚠ ЁРООЛ ЗААВАЛ (хэрэглэгч 2026-09-30: "map-ийг дооронос нь
     харахад soil profile R харагдах ёстой шүү"). Урьд нь блок нь дээд
     гадарга + хана гэсэн НЭЭЛТТЭЙ бүрхүүл байсан тул доороос харахад
     хөрсний зургийн АР тал (толин, бараан) харагддаг байв. Ёроол нь
     хамгийн доод давхаргын (`R`, суурь чулуулаг) бүтэцтэй, зүсэлтийн
     хана яг тэнд дуусдаг тул блок бүрэн хаалттай бие болно. Өсгөлт,
     шилжилтээс хамаардаг тул `rebuild`-д дахин баригдана. */
  const bottom = () => buildSheet(R_BOTTOM - 0.01);
  /* ⚠⚠ БОДИТ ОРЧИНД БЛОК ӨӨРӨӨ ЗУРАГДАХГҮЙ (`REAL`, хэрэглэгч
     2026-09-30: "bodit orchin deer ter zurag deerh soil type
     haragdahgui … yg undsen scene yaj haragddag yg ter"). Тэнд гадарга
     нь хиймэл дагуулын зурагтай газар өөрөө; хөрс нь зөвхөн ЗҮСЭЛТИЙН
     нүүрэнд (таглаа, `capL`) харагдана — жинхэнэ шуудуу ухсан мэт. */
  let REAL = false;
  /** Зурсан талбай — байвал блокоос ЗӨВХӨН түүний дотор үлдэнэ ({@link buildClip}) */
  let clip: [number, number][] | null = null;
  /** Хана, ёроол нь гадаргаас хамаарахгүй тул нэг удаа; дээд гадарга нь гадарга бүрд */
  let clipBody: unknown[] | null = null;
  let clipTops: Partial<Record<Surface, unknown>> = {};
  const rebuild = () => {
    blockL.removeAll();
    floorL.removeAll();
    /* ⚠ Бодит орчинд зүсэлт ГАЗРЫГ огтлоод доор нь юу ч үлдэхгүй тул
       шуудуу ёроолгүй хар нүх болж харагдаж байв (хөтөч дээр). Ёроол
       нь суурь чулуулгийн (R) давхарга, ОГТЛОЛТООС ЧӨЛӨӨЛӨГДСӨН тул
       газар бүтэн газарт түүнийг бүрхэж, зөвхөн ухсан хэсэгт ил гарна. */
    if (REAL) {
      floorL.add(bottom());
      return;
    }
    if (clip) {
      const P = clip;
      clipBody ??= buildClipBody(P);
      const top = (clipTops[SURF] ??= buildClipTop(P));
      blockL.addMany([top, ...clipBody].filter(Boolean));
      return;
    }
    blockL.addMany([PEEL > 0 ? buildSheet(PEEL) : topOf(), buildWalls(), bottom()]);
  };

  /*
    ⚠⚠ ЗУРСАН ТАЛБАЙГААР ТАСЛАХ (хэрэглэгч 2026-10-01: "bi duriin gazriig
    zuraad duushad minii zursan uldeed busad ni alga bolno … slice deer
    darhad 2 songolt bn zurah bolon zuseh"). SliceAnalysis нь зөвхөн
    ХАВТГАЙГААР огтолдог тул дурын олон өнцөгт түүгээр боломжгүй —
    блокийг ӨӨРӨӨ дахин барина: дээд гадарга, хана, ёроол гурвуулаа
    олон өнцөгтөөр хязгаарлагдана.
    ⚠ Торыг БҮДҮҮН НҮДЭНД ЭГНҮҮЛЭН `k` хуваана (талбайн урт тал ~160 дэд
    нүд): хөрстэй/хөрсгүй нүдний хил бүдүүн тороор тодорхойлогддог тул
    дэд нүд түүнийг хэзээ ч хөндлөн гарахгүй.
    ⚠ Олон өнцөгтийн ирмэг дээрх нүдийг ЯГ ТАСАЛНА (Sutherland–Hodgman,
    хайчлагч нь нүдний тэгш өнцөгт) — шатлан тасалбал дээд гадарга
    шүдлэг, хана нь шулуун болж зөрнө. Хэсгийг чихээр гурвалжилна.
    ⚠ ХАНА ХОЁР ТӨРЛИЙН: (1) олон өнцөгтийн ирмэгийн дагуу — зурсан
    шугам өөрөө; (2) олон өнцөгт хөрсний зураглалаас хальсан бол тэр
    зураглалын хил (бүдүүн нүдний ирмэг) — дотор нь байх хэсэг л.
    ⚠ Өнцөг шалгалтыг уртраг, өргөрөгөөр хийнэ: эерэг масштаблалт нь
    эргэлтийн тэмдгийг хадгална.
  */
  const CLIP_N = 160;
  const inPoly = (P: [number, number][], x: number, y: number) => {
    let o = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i];
      const [xj, yj] = P[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) o = !o;
    }
    return o;
  };
  /** Олон өнцөгтийг тэгш өнцөгтөөр хайчлана */
  function clipRect(P: [number, number][], L0: number, L1: number, B0: number, B1: number) {
    const atX = (X: number) => (a: [number, number], b: [number, number]): [number, number] =>
      [X, a[1] + ((b[1] - a[1]) * (X - a[0])) / (b[0] - a[0])];
    const atY = (Y: number) => (a: [number, number], b: [number, number]): [number, number] =>
      [a[0] + ((b[0] - a[0]) * (Y - a[1])) / (b[1] - a[1]), Y];
    const planes: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
      [(p) => p[0] >= L0, atX(L0)],
      [(p) => p[0] <= L1, atX(L1)],
      [(p) => p[1] >= B0, atY(B0)],
      [(p) => p[1] <= B1, atY(B1)],
    ];
    let out = P;
    for (const [ins, cross] of planes) {
      const inp = out;
      out = [];
      for (let i = 0; i < inp.length; i++) {
        const cur = inp[i];
        const prev = inp[(i + inp.length - 1) % inp.length];
        if (ins(cur)) {
          if (!ins(prev)) out.push(cross(prev, cur));
          out.push(cur);
        } else if (ins(prev)) out.push(cross(prev, cur));
      }
      if (!out.length) break;
    }
    return out;
  }
  const area2 = (P: [number, number][]) => {
    let s = 0;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += (P[j][0] - P[i][0]) * (P[j][1] + P[i][1]);
    return s;
  };
  /** Чихээр гурвалжилна; гацвал (давхцсан ирмэг) сэнс болгоно */
  function triangulate(P: [number, number][]) {
    const idx = P.map((_, i) => i);
    if (area2(P) < 0) idx.reverse();
    const cr = (a: number, b: number, c: number) =>
      (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]);
    const out: number[] = [];
    while (idx.length > 3) {
      let cut = false;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[(i + idx.length - 1) % idx.length];
        const b = idx[i];
        const c = idx[(i + 1) % idx.length];
        if (cr(a, b, c) <= 0) continue;
        if (idx.some((q) => q !== a && q !== b && q !== c && cr(a, b, q) > 0 && cr(b, c, q) > 0 && cr(c, a, q) > 0)) continue;
        out.push(a, b, c);
        idx.splice(i, 1);
        cut = true;
        break;
      }
      if (!cut) break;
    }
    for (let i = 1; i + 1 < idx.length; i++) out.push(idx[0], idx[i], idx[i + 1]);
    return out;
  }
  /** Талбайн дэд тор ба нүд бүрийн хэсэг */
  function clipPieces(P: [number, number][]) {
    let L = Infinity, R = -Infinity, B = Infinity, T = -Infinity;
    for (const [x, y] of P) {
      L = Math.min(L, x); R = Math.max(R, x);
      B = Math.min(B, y); T = Math.max(T, y);
    }
    const k = Math.max(1, Math.min(16, Math.floor(CLIP_N / Math.max((R - L) / dx, (T - B) / dy, 1e-9))));
    const sx = dx / k;
    const sy = dy / k;
    const c0 = Math.max(0, Math.floor((L - x0) / sx));
    const c1 = Math.min(nx * k - 1, Math.floor((R - x0) / sx));
    const r0 = Math.max(0, Math.floor((B - y0) / sy));
    const r1 = Math.min(ny * k - 1, Math.floor((T - y0) / sy));
    const pieces: { piece: [number, number][]; tris: number[]; cx: number; cy: number }[] = [];
    if (c1 < c0 || r1 < r0) return { pieces, k, sx, sy };
    const CW = c1 - c0 + 1;
    const CH = r1 - r0 + 1;
    const W = CW + 1;
    const inside = new Uint8Array(W * (CH + 1));
    for (let r = 0; r <= CH; r++)
      for (let c = 0; c <= CW; c++) inside[r * W + c] = inPoly(P, x0 + (c0 + c) * sx, y0 + (r0 + r) * sy) ? 1 : 0;
    /* Ирмэг дайрсан нүд — ирмэгийг хагас нүдний алхмаар гүйж тэмдэглэнэ */
    const touched = new Uint8Array(CW * CH);
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]) / sx, Math.abs(b[1] - a[1]) / sy) * 2) + 1;
      for (let j = 0; j <= n; j++) {
        const c = Math.floor((a[0] + ((b[0] - a[0]) * j) / n - x0) / sx) - c0;
        const r = Math.floor((a[1] + ((b[1] - a[1]) * j) / n - y0) / sy) - r0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const cc = c + dc;
            const rr = r + dr;
            if (cc >= 0 && rr >= 0 && cc < CW && rr < CH) touched[rr * CW + cc] = 1;
          }
      }
    }
    for (let r = 0; r < CH; r++) {
      for (let c = 0; c < CW; c++) {
        const gc = c0 + c;
        const gr = r0 + r;
        if (cells[Math.floor(gr / k) * nx + Math.floor(gc / k)] === 255) continue;
        const xa = x0 + gc * sx;
        const ya = y0 + gr * sy;
        const i = r * W + c;
        let piece: [number, number][];
        let tris: number[];
        if (!touched[r * CW + c]) {
          if (!inside[i]) continue;
          piece = [[xa, ya], [xa + sx, ya], [xa + sx, ya + sy], [xa, ya + sy]];
          tris = [0, 1, 2, 0, 2, 3];
        } else {
          piece = clipRect(P, xa, xa + sx, ya, ya + sy);
          if (piece.length < 3 || Math.abs(area2(piece)) < sx * sy * 1e-4) continue;
          tris = triangulate(piece);
        }
        pieces.push({ piece, tris, cx: xa + sx / 2, cy: ya + sy / 2 });
      }
    }
    return { pieces, k, sx, sy };
  }
  function buildClipTop(P: [number, number][]) {
    const { pieces } = clipPieces(P);
    const pos: number[] = [];
    const uv: number[] = [];
    const f: number[] = [];
    for (const { piece, tris } of pieces) {
      const base = pos.length / 3;
      for (const [x, y] of piece) {
        pos.push(x, y, zAt(x, y));
        uv.push((x - x0) / (nx * dx), 1 - (y - y0) / (ny * dy));
      }
      for (const t of tris) f.push(base + t);
    }
    if (!f.length) return null;
    return new Graphic({
      geometry: new Mesh({
        spatialReference: SR,
        vertexAttributes: { position: new Float64Array(pos), uv: new Float32Array(uv) },
        components: [
          new MeshComponent({
            faces: new Uint32Array(f),
            material: new MeshMaterial({ colorTexture: new MeshTexture({ data: texOf() }), doubleSided: true }),
          }),
        ],
      }),
      symbol: sym,
    });
  }
  function buildClipBody(P: [number, number][]) {
    const { pieces, k, sx, sy } = clipPieces(P);
    const e = exs();
    const t = tileM();
    const tu = t * TILE_ASPECT;
    const depth = R_BOTTOM - 0.01;
    /* Ёроол */
    const bot = new MB();
    for (const { piece, tris, cx, cy } of pieces) {
      const bd = bandAt(profAt(cx, cy), keys, depth);
      if (!bd) continue;
      const key = bd.c + (bd.sat ? "_w" : "");
      const ids = piece.map(([x, y]) => bot.v(x, y, zAt(x, y) - depth * e, (x * mLon) / tu, (y * mLat) / t));
      for (let j = 0; j < tris.length; j += 3) bot.tri(key, ids[tris[j]], ids[tris[j + 1]], ids[tris[j + 2]]);
    }
    /* Хана — зурсан ирмэгийн дагуу; бүтэц нь периметрийн дагуу тасралтгүй */
    const wall = new MB();
    const step = Math.min(sx * mLon, sy * mLat);
    let s = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      const L = Math.hypot((b[0] - a[0]) * mLon, (b[1] - a[1]) * mLat);
      const n = Math.max(1, Math.ceil(L / step));
      let A: [number, number] = a;
      let pA = validAt(A[0], A[1]) ? profAt(A[0], A[1]) : null;
      for (let j = 1; j <= n; j++) {
        const Bp: [number, number] = [a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n];
        const pB = validAt(Bp[0], Bp[1]) ? profAt(Bp[0], Bp[1]) : null;
        const s1 = s + (L * j) / n;
        const s0 = s + (L * (j - 1)) / n;
        if (validAt((A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2)) {
          const prA = pA ?? profAt((A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2);
          const prB = pB ?? prA;
          strip(wall, A, Bp, zAt(A[0], A[1]), zAt(Bp[0], Bp[1]), s0 / tu, s1 / tu, prA, prB);
        }
        A = Bp;
        pA = pB;
      }
      s += L;
    }
    /* Хана — хөрсний зураглалын хил талбайн дотор */
    const ok = (r: number, c: number) => r >= 0 && c >= 0 && r < ny && c < nx && cells[r * nx + c] !== 255;
    const C0 = Math.max(0, Math.floor((Math.min(...P.map((p) => p[0])) - x0) / dx));
    const C1 = Math.min(nx - 1, Math.floor((Math.max(...P.map((p) => p[0])) - x0) / dx));
    const R0 = Math.max(0, Math.floor((Math.min(...P.map((p) => p[1])) - y0) / dy));
    const R1 = Math.min(ny - 1, Math.floor((Math.max(...P.map((p) => p[1])) - y0) / dy));
    const border = (A: [number, number], B: [number, number], alongLon: boolean) => {
      for (let j = 0; j < k; j++) {
        const a: [number, number] = [A[0] + ((B[0] - A[0]) * j) / k, A[1] + ((B[1] - A[1]) * j) / k];
        const b: [number, number] = [A[0] + ((B[0] - A[0]) * (j + 1)) / k, A[1] + ((B[1] - A[1]) * (j + 1)) / k];
        if (!inPoly(P, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) continue;
        const uA = (alongLon ? a[0] * mLon : a[1] * mLat) / tu;
        const uB = (alongLon ? b[0] * mLon : b[1] * mLat) / tu;
        strip(wall, a, b, zAt(a[0], a[1]), zAt(b[0], b[1]), uA, uB, profAt(a[0], a[1]), profAt(b[0], b[1]));
      }
    };
    for (let r = R0; r <= R1; r++) {
      for (let c = C0; c <= C1; c++) {
        if (!ok(r, c)) continue;
        const X0 = x0 + c * dx;
        const Y0 = y0 + r * dy;
        if (!ok(r - 1, c)) border([X0, Y0], [X0 + dx, Y0], true);
        if (!ok(r + 1, c)) border([X0, Y0 + dy], [X0 + dx, Y0 + dy], true);
        if (!ok(r, c - 1)) border([X0, Y0], [X0, Y0 + dy], false);
        if (!ok(r, c + 1)) border([X0 + dx, Y0], [X0 + dx, Y0 + dy], false);
      }
    }
    return [wall.mesh(), bot.mesh()].map((m) => (m ? new Graphic({ geometry: m, symbol: sym }) : null));
  }
  rebuild();

  /* ── Зүсэлт ба таглаа ──────────────────────────────────────────── */
  /*
    ⚠⚠ ӨӨРИЙН ЗҮСЭЛТИЙН ХЭРЭГСЭЛ — Esri-ийн `Slice` виджет ХАСАГДСАН
    (хэрэглэгч 2026-09-30: "zaawal esrigiin slice baih shaardlagagui
    chi iluu sain ajillagaatai zuil hiij bolno"). Виджетийн дутагдал:
      · гадарга дээр чирэхэд ХЭВТЭЭ зүсэлт гардаг, босоо нь Shift
        шаарддаг — заавар нь хасагдсан тул хэрэглэгч мэдэх аргагүй;
      · хавтгайн өргөн, хасагдах тал, хөмрөлт бариулаар тааварлагддаг;
      · орчуулга, хасагдсан давхаргын жагсаалт, 300px цонх гэх мэт
        засвар дээр засвар.
    Одоо `SliceAnalysis`-ыг ШУУД эзэмшинэ, дээр нь:
      · БОСОО — хоёр цэг товшиж шугам татна; хавтгай нь тэр шугамын
        ЯГ уртаар (блокоос гадуурх хэсгийг тайрна), КАМЕР талын хагас
        хасагдах тул нүүр нь үргэлж харагч руу харна;
      · ХЭВТЭЭ зүсэлт ХАСАГДСАН (хэрэглэгч 2026-09-30: "hewtee zuselt
        hereggui") — `PEEL` тогтмол 0;
      · ТАЛ СОЛИХ, ЦУЦЛАХ;
      · ХӨНДЛӨН ОГТЛОЛ (`onSection`) — шугамын дагуух хөрсний хэрчээс
        хажуугийн баганад диаграм болж гарна.
    ⚠ Хавтгайг чирж зөөх бариул БАЙХГҮЙ — шинэ шугам татахад хангалттай.
  */
  const slice = new SliceAnalysis() as unknown as Analysis;
  view.analyses.add(slice);
  /*
    ⚠⚠ ГАЗРЫН ГАДАРГА ОГТЛОЛТООС ЧӨЛӨӨЛӨГДӨНӨ — бодит орчинд л огтлогдоно,
    тэнд ч ЧИРЭХ ҮЕД түр чөлөөлөгдөнө (`groundCut`). Хулганы байрлалыг
    газарт буулгадаг `toMap` нь огтлогдсон газрыг ХАРДАГГҮЙ тул голын
    бариулыг камер (хасагдсан) тал руу чирэхэд байрлал олдохгүй, зүсэлт
    хөдлөхгүй байв (хөтөч дээр бодит хулганаар шалгасан — өргөний бариул
    блок дээр чирэгдсэн тул ажиллаж байсан). Цэвэр дэвсгэрт газар
    харагддаггүй тул огтлох шаардлага огт байхгүй.
  */
  /* Анхны төлөв — цэвэр дэвсгэр (`grab` энд хараахан зарлагдаагүй тул шууд) */
  slice.excludeGroundSurface = true;
  const groundCut = () => {
    slice.excludeGroundSurface = !REAL || !!grab;
  };

  type Pt = [number, number];
  let drawing = false;
  let first: Pt | null = null;
  let cutLine: { a: Pt; b: Pt } | null = null;
  const DRAW_NOTE = {
    idle: "Хоёр цэг товшиж шугам татна",
    first: "Эхлэх цэгийг товшино уу",
    second: "Төгсгөлийн цэгийг товшино уу",
  };
  /* Талбай зурах — оройнууд; эхний цэг дээр товших, давхар товших,
     Enter нь дуусгана; Backspace сүүлийн оройг хасна */
  let drawingPoly = false;
  let verts: Pt[] = [];
  const POLY_NOTE = {
    idle: "Талбай зурж, зөвхөн түүнийг үлдээнэ",
    start: "Талбайн оройг товшино уу",
    more: "Эхний цэг дээр товшиж дуусгана",
  };

  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
    const n = document.createElement(tag);
    n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const tool = mk("div", "soil-env soil-cut");
  tool.append(mk("div", "soil-env-head", "Зүсэлт"));
  const vBtn = mk("button", "soil-env-opt");
  vBtn.type = "button";
  const vNote = mk("span", "soil-env-note", DRAW_NOTE.idle);
  vBtn.append(mk("span", "soil-env-label", "Зүсэх"), vNote);
  const pBtn = mk("button", "soil-env-opt");
  pBtn.type = "button";
  const pNote = mk("span", "soil-env-note", POLY_NOTE.idle);
  pBtn.append(mk("span", "soil-env-label", "Зурах"), pNote);
  const acts = mk("div", "soil-cut-actions");
  const flipBtn = mk("button", "soil-cut-btn", "Тал солих");
  const clearBtn = mk("button", "soil-cut-btn", "Цуцлах");
  flipBtn.type = "button";
  clearBtn.type = "button";
  acts.append(flipBtn, clearBtn);
  tool.append(vBtn, pBtn, acts);

  function sync() {
    const cutOn = drawing || !!cutLine;
    const polyOn = drawingPoly || !!clip;
    vBtn.classList.toggle("is-on", cutOn);
    vBtn.setAttribute("aria-pressed", String(cutOn));
    vNote.textContent = drawing ? (first ? DRAW_NOTE.second : DRAW_NOTE.first) : DRAW_NOTE.idle;
    pBtn.classList.toggle("is-on", polyOn);
    pBtn.setAttribute("aria-pressed", String(polyOn));
    pNote.textContent = drawingPoly ? (verts.length < 3 ? POLY_NOTE.start : POLY_NOTE.more) : POLY_NOTE.idle;
    flipBtn.disabled = !cutLine;
    clearBtn.disabled = !cutLine && !drawing && !clip && !drawingPoly;
    container.classList.toggle("is-drawing", drawing || drawingPoly);
  }
  function stopDraw() {
    drawing = false;
    first = null;
    lineL.removeAll();
    drawHandles();
    sync();
  }
  function stopPoly() {
    drawingPoly = false;
    verts = [];
    lineL.removeAll();
    drawHandles();
    sync();
  }
  /*
    ⚠⚠ ЗҮСЭХ, ЗУРАХ ХОЁР ХАРИЛЦАН ҮГҮЙСГЭНЭ: нэгийг эхлүүлэхэд нөгөө нь
    цуцлагдана. Зурах эхлэхэд өмнөх талбай мөн цуцлагдаж блок бүтэн
    болно — хэрэглэгч шинэ талбайгаа бүтэн газар дээр зурна.
  */
  function clearCut() {
    slice.shape = null;
    cutLine = null;
    onSection(null);
    plumes.clear();
    updateCap();
  }
  function setClip(P: Pt[] | null) {
    clip = P;
    clipBody = null;
    clipTops = {};
    /* Блок зөвхөн цэвэр дэвсгэрт зурагдана — бодит орчинд талбай харагдахгүй */
    if (P && REAL) setEnv("clean");
    else rebuild();
    applyClip();
    sync();
  }
  vBtn.addEventListener("click", () => {
    if (drawing) return stopDraw();
    if (drawingPoly) stopPoly();
    if (clip) setClip(null);
    drawing = true;
    first = null;
    lineL.removeAll();
    sync();
  });
  pBtn.addEventListener("click", () => {
    if (drawingPoly) return stopPoly();
    if (drawing) stopDraw();
    if (cutLine) clearCut();
    if (clip) setClip(null);
    drawingPoly = true;
    verts = [];
    lineL.removeAll();
    sync();
  });
  flipBtn.addEventListener("click", () => {
    const sh = slice.shape as { heading: number; clone: () => Obj } | null;
    if (!sh) return;
    const n = sh.clone() as { heading: number };
    n.heading = (sh.heading + 180) % 360;
    slice.shape = n as unknown as Obj;
    plumes.setSide((n.heading + 180) % 360);
  });
  clearBtn.addEventListener("click", () => {
    clearCut();
    stopDraw();
    stopPoly();
    if (clip) setClip(null);
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && drawing) stopDraw();
    if (!drawingPoly) return;
    if (e.key === "Escape") stopPoly();
    else if (e.key === "Enter") finishPoly();
    else if (e.key === "Backspace" && verts.length) {
      verts.pop();
      drawPoly(null);
      sync();
    }
  };
  window.addEventListener("keydown", onKey);
  sync();

  const expand = new Expand({
    view,
    content: tool,
    expandIcon: "slice",
    expandTooltip: "Зүсэлт",
    collapseTooltip: "Зүсэлтийг хаах",
    mode: "floating",
    /* ⚠ Нэг бүлэгт — нэгийг нээхэд нөгөө нь хумигдана */
    group: "soil-tools",
  }) as unknown as Widget;

  /* ⚠⚠ ОРЧНЫ СОНГОЛТ — зүсэлтийн ДЭЭР (хэрэглэгчийн хүсэлт,
     2026-09-30: "slice iconi deer neg icon hii aguulga ni odoogiin
     tsewerlesen scene harna eswel yg bodit scene gsen songolttoi").
     · ЦЭВЭР ДЭВСГЭР (анхдагч) — газар нуугдаж, тогтмол бараан дэвсгэр,
       тэгш гэрэлтүүлэг: хөрсний блок ганцаараа, дотоод бүтэц нь л
       харагдана.
     · БОДИТ ОРЧИН — энгийн дүр зураг: хиймэл дагуулын зурагтай
       рельеф, нарны гэрэл, сүүдэр. Хөрсний блок ЗУРАГДАХГҮЙ (`REAL`),
       камер газар доош ОРОХГҮЙ (`stay-above`); хөрс нь зөвхөн
       зүсэлтийн нүүр, шуудууны ёроолд харагдана (хэрэглэгч 2026-09-30:
       "bodit orchin deer ter zurag deerh soil type haragdahgui, mun
       mapiig dooroos ni harahgui buyu yg undsen scene").
     ⚠⚠ Блок зурагдахаа больсон тул урьдын 40 метрийн ӨРГӨЛТ (`OFFSET`,
       блокийн дээд гадарга рельефтэй анивчихаас сэргийлсэн) ХАСАГДСАН.
     ⚠ Хасагдсан тал нь блокийн хилээс цааш ХАР хоосон зай хэвээр —
       SliceAnalysis-ийн хасалт хавтгайнаас хязгааргүй сунадаг бөгөөд
       тэнд хөрсний мэдээлэл БАЙХГҮЙ тул нөхөж зурахгүй.
     ⚠⚠ АГААР МАНДАЛ УНТРААЛТТАЙ ХЭВЭЭР, дэвсгэр ТОГТМОЛ. Асаахад
       (хөтөч дээр туршсан) зүсэлтээр хасагдсан тал бүхэлдээ ЦАЙВАР
       МАНАН болж, дэлгэцийн хагасыг эзэлж, сувгийн нүүрийг дарж байв.
       Унтраахад тэр тал нь газрын доод тал болж бараан харагдана.
     ⚠ Нарны огноо ТОГТМОЛ (зуны туйл, орон нутгийн үд дунд): одоогийн
       цагаар авбал шөнө нээсэн хэрэглэгч хар дэлгэц харна.
     ⚠ Орчин солигдоход блок дахин баригдана (`rebuild`). */
  type Env = "clean" | "real";
  const envOpts: { id: Env; label: string; note: string }[] = [
    { id: "clean", label: "Цэвэр дэвсгэр", note: "Зөвхөн хөрсний блок" },
    { id: "real", label: "Бодит орчин", note: "Хиймэл дагуулын зураг, рельеф, нарны гэрэл" },
  ];
  const envBox = document.createElement("div");
  envBox.className = "soil-env";
  const envHead = document.createElement("div");
  envHead.className = "soil-env-head";
  envHead.textContent = "Харагдац";
  envBox.append(envHead);
  const envBtns = envOpts.map((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "soil-env-opt";
    const t = document.createElement("span");
    t.className = "soil-env-label";
    t.textContent = o.label;
    const n = document.createElement("span");
    n.className = "soil-env-note";
    n.textContent = o.note;
    b.append(t, n);
    b.addEventListener("click", () => setEnv(o.id));
    envBox.append(b);
    return { id: o.id, b };
  });
  /* ── Дээд гадарга — хиймэл дагуул эсвэл хөрсний хэв шинж ── */
  const surfHead = document.createElement("div");
  surfHead.className = "soil-env-head";
  surfHead.textContent = "Дээд гадарга";
  envBox.append(surfHead);
  const surfOpts: { id: Surface; label: string; note: string }[] = [
    { id: "geology", label: "Хөрсний хэв шинж", note: "Бодит гадаргын бүтэцтэй" },
    { id: "imagery", label: "Хиймэл дагуулын зураг", note: imgCv ? "Зөвхөн зураг" : "Уншигдсангүй" },
  ];
  const surfBtns = surfOpts.map((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "soil-env-opt";
    const t = document.createElement("span");
    t.className = "soil-env-label";
    t.textContent = o.label;
    const n = document.createElement("span");
    n.className = "soil-env-note";
    n.textContent = o.note;
    b.append(t, n);
    b.addEventListener("click", () => setSurface(o.id));
    envBox.append(b);
    return { id: o.id, b };
  });
  function paintSurface() {
    surfBtns.forEach(({ id, b }) => {
      b.classList.toggle("is-on", id === SURF);
      b.setAttribute("aria-pressed", String(id === SURF));
      /* Бодит орчинд блок зурагдахгүй тул гадаргын сонголт утгагүй */
      b.disabled = REAL || (id === "imagery" && !imgCv);
    });
  }
  function setSurface(s: Surface) {
    if (s === SURF || REAL) return;
    SURF = s;
    paintSurface();
    rebuild();
  }
  paintSurface();
  function setEnv(mode: Env) {
    const real = mode === "real";
    envBtns.forEach(({ id, b }) => {
      b.classList.toggle("is-on", id === mode);
      b.setAttribute("aria-pressed", String(id === mode));
    });
    map.ground.opacity = real ? 1 : 0;
    const env = view.environment;
    env.lighting = real
      ? { type: "sun", directShadowsEnabled: true, date: new Date("2026-06-21T04:00:00Z") }
      : { type: "virtual" };
    env.atmosphereEnabled = false;
    REAL = real;
    boxLayers.forEach((l) => (l.elevationInfo = boxElev()));
    groundCut();
    /* Бодит орчинд газар доош орохгүй — жинхэнэ дүр зургийн зан төлөв */
    map.ground.navigationConstraint = { type: real ? "stay-above" : "none" };
    rebuild();
    updateCap();
    paintSurface();
  }
  const envExpand = new Expand({
    view,
    content: envBox,
    expandIcon: "globe",
    expandTooltip: "Харагдац",
    collapseTooltip: "Харагдацыг хаах",
    mode: "floating",
    group: "soil-tools",
  }) as unknown as Widget;
  /* Анхны төлөв — setEnv-ийг энд ДУУДАХГҮЙ: зүсэлтийн хэрэгсэл хараахан бэлэн биш */
  envBtns[0].b.classList.add("is-on");
  envBtns.forEach(({ b }, i) => b.setAttribute("aria-pressed", String(i === 0)));
  view.ui.add(envExpand, "top-right");
  view.ui.add(expand, "top-right");

  /*
    ⚠⚠ ДАВХАРГЫН ИКОН — зүсэлтийн ДООР. Агуулга нь (хэрэглэгч 2026-09-30:
    "layer hesegt 1. nuhen jorlon 3d haragdana 2. niisleliin hudag gj bga
    teriig bas 3d harmaar bn") порталын ХОЁР давхарга, асаалт/унтраалттай:
      · Нүхэн жорлон — `X10_UB_pit_toilet` (хүрээлэн буй орчны хэлтэс);
      · Нийслэлийн худаг — `N02_Niislel_hudag` (ногоон бүсийн хэлтэс).
    Хөрсний блок ба зүсэлттэй НЭГ дүр зурагт — бохирдлын эх үүсвэр ба
    усны эх үүсвэр хөрсний аль хэв шинж дээр байгаа нь харагдана.
    ⚠ Жорлон нь ЗАГВАРЫН багцаас (`pitCoords`-ийн тэмдэглэлийг үз),
    АНХНААСАА АСААЛТТАЙ; худаг нь порталаас.
    ⚠⚠ ӨГӨГДӨЛ ПЛАТФОРМЫН ТАТАГЧААР, SDK-ИЙН НЭВТРЭЛТЭЭР БИШ. Эхлээд
    `FeatureLayer`-т порталын хаягийг өгч токенийг IdentityManager-т
    бүртгэсэн — хуурамч токентой шалгахад SDK дотроо "null.trim" гэж
    унав; `customParameters`-ээр дамжуулахад 498 авмагц Esri-ийн НЭВТРЭХ
    ЦОНХ хүлээж ГАЦАВ. Дээрээс нь CLAUDE.md-ийн дүрмээр токен хавсрах
    ЦОРЫН ГАНЦ цэг нь `arcgisJson()`. Тиймээс хүрээлэн буй орчны
    самбарын `fetchToilets`, ногоон бүсийн самбарын `fetchLayerFeatures`
    (хоёулаа кэштэй, `arcgisJson`-оор) татаад КЛИЕНТ ТАЛЫН `FeatureLayer`
    болгоно (`source`). Алдаа нь серверийн хариугаар ил бичигдэнэ.
    ⚠ Асаах ҮЕДЭЭ л татна; унтраахад давхарга устахгүй, нуугдана.
    ⚠ Өнгө = утга: жорлон нь бохирдлын эх үүсвэр тул `--clay`, худаг нь
    ус тул `--water` (зурагт тогтмол hex — горимоос үл хамаарна).
    ⚠ Огтлолтоос ЧӨЛӨӨЛӨГДӨХГҮЙ: хасагдсан талын цэгүүд блоктойгоо хамт
    алга болно — эс тэгвээс шуудууны дээр агаарт хөвнө.
    ⚠ Худаг нь БАГАНА-тэмдэгтэй (өргөсөн тэмдэг + газар хүртэлх шугам),
    жорлон нь жижиг цэг: 145 мянган цэгт шугам зурвал зураг бөглөрнө.
    ⚠ Худгийн ГҮНИЙГ зурагт гаргаагүй: талбарын жагсаалтыг токеноор
    шалгаагүй тул гүнийн талбарыг таамаглахгүй.
  */
  type Overlay = {
    id: string;
    label: string;
    load: () => Promise<{ pts: number[][]; cls?: Uint8Array }>;
    color: string;
    pin: boolean;
    /** Ангиллаар будах бол (`cls`-ийн индексээр) — эс бөгөөс ганц `color` */
    classes?: readonly { label: string; color: string }[];
    layers: FLayer[];
    /** Ойроос босоо хайрцаг (жорлонгийн бүхээг) болж зурагдана */
    box?: boolean;
    on: boolean;
    busy: boolean;
    err: string;
    btn: HTMLButtonElement;
    note: HTMLSpanElement;
  };
  const layersBox = mk("div", "soil-env soil-layers");
  layersBox.append(mk("div", "soil-env-head", "Давхарга"));
  const overlays: Overlay[] = [
    /* ⚠⚠ ЖОРЛОН "Нэвчилтийн симуляци"-ийн ЗУРАГ ШИГ (хэрэглэгч 2026-09-30:
       "ed nariig newchiltiin simulation jorlon shig haragdah heregtei") —
       нүхний ёроолоос гүний ус хүртэлх зайгаар дөрвөн өнгө, НЭГ эх
       сурвалжаас (`SEP_CLASSES`). Урьд нь ганц ягаан цэг байсан нь
       аль жорлон эрсдэлтэйг хэлдэггүй байв. */
    { id: "pit", label: "Нүхэн жорлон", load: pitCoords, color: "#e47b7b", pin: false, classes: SEP_CLASSES, box: true },
    { id: "well", label: "Нийслэлийн худаг", load: wellCoords, color: "#5fa8ff", pin: true },
  ].map((o: Omit<Overlay, "layers" | "on" | "busy" | "err" | "btn" | "note">) => {
    const btn = mk("button", "soil-env-opt soil-layer-opt");
    btn.type = "button";
    const row = mk("span", "soil-layer-row");
    const dot = mk("span", o.box ? "soil-layer-dot soil-layer-box" : "soil-layer-dot");
    /* ангилалтай бол товчны цэг нь дөрвөн өнгийн цагираг */
    dot.style.background = o.classes
      ? `conic-gradient(${o.classes.map((c, k, a) => `${c.color} ${(k / a.length) * 360}deg ${((k + 1) / a.length) * 360}deg`).join(", ")})`
      : o.color;
    row.append(dot, mk("span", "soil-env-label", o.label));
    const note = mk("span", "soil-env-note");
    btn.append(row, note);
    layersBox.append(btn);
    /* ⚠ Хуулга нь товчны ГАДНА (товч дотор бол мөр бүр товшигдох мэт уншигдана) */
    if (o.classes) {
      const legend = mk("div", "soil-layer-legend");
      legend.append(mk("span", "soil-layer-legend-head", "Нүхний ёроолоос гүний ус хүртэл"));
      for (const c of o.classes) {
        const li = mk("span", "soil-layer-legend-row");
        const sw = mk("span", "soil-layer-dot soil-layer-box");
        sw.style.background = c.color;
        li.append(sw, mk("span", "", c.label));
        legend.append(li);
      }
      layersBox.append(legend);
    }
    const ov: Overlay = { ...o, layers: [], on: false, busy: false, err: "", btn, note };
    btn.addEventListener("click", () => void toggleOverlay(ov));
    return ov;
  });
  function paintOverlay(o: Overlay) {
    o.btn.classList.toggle("is-on", o.on);
    o.btn.setAttribute("aria-pressed", String(o.on));
    o.note.textContent = o.busy ? "Ачаалж байна" : o.err;
    o.note.hidden = !o.busy && !o.err;
  }
  overlays.forEach(paintOverlay);
  /* ⚠ Жорлонг ЗАГВАРЫН багцаас (`latrine-sim.bin`): порталын
     `X10_UB_pit_toilet`-тэй ижил 145,462 цэг (тоо нь таарсан), нэвтрэлт
     шаардахгүй, зүсэлтийн бохирдол ЯГ эдгээр цэгээс бодогдоно — хоёр өөр
     эх сурвалжаас авбал зурагт байгаа жорлон бохирдолгүй үлдэж болно. */
  async function pitCoords() {
    const d = await fetchLatrineSim();
    const pts: number[][] = [];
    const cls = new Uint8Array(d.n);
    for (let i = 0; i < d.n; i++) {
      pts.push([d.lon[i], d.lat[i]]);
      cls[i] = sepClass(d, i);
    }
    return { pts, cls };
  }
  async function wellCoords() {
    const set = NOGOON_TABS.hudag;
    const info = await fetchLayerInfo(set, "N02_Niislel_hudag");
    const f = await fetchLayerFeatures(info);
    const out: number[][] = [];
    for (const ft of f.shapes.features) {
      const g = ft.geometry;
      if (g?.type === "Point") out.push(g.coordinates as number[]);
      else if (g?.type === "MultiPoint") out.push(...(g.coordinates as number[][]));
    }
    return { pts: out };
  }
  /* ⚠ Ангилалтай цэг нь БАРААН ЦАГИРАГТАЙ, том — симуляцийн зургийн
     (`WellsMap` `grades`) цэгтэй нэг төрх: хиймэл дагуул, хөрсний
     зурган дээр шар, цэнхэр нь цагирагаараа ялгарна */
  const overlaySym = (o: Overlay, color = o.color) => ({
    type: "point-3d",
    symbolLayers: [
      {
        type: "icon",
        size: o.pin ? 9 : o.classes ? 6 : 4,
        resource: { primitive: "circle" },
        material: { color },
        outline: o.pin
          ? { color: "white", size: 1.2 }
          : o.classes
            ? { color: [18, 24, 30, 0.75], size: 0.9 }
            : { color: [0, 0, 0, 0.35], size: 0.4 },
      },
    ],
    ...(o.pin
      ? {
          verticalOffset: { screenLength: 22, maxWorldLength: 3000, minWorldLength: 20 },
          callout: { type: "line", size: 1, color: o.color },
        }
      : {}),
  });
  /*
    ⚠⚠ ЖОРЛОН ОЙРООС БОСОО ХАЙРЦАГ (хэрэглэгч 2026-10-01: "ydaj jorlon
    shig box bosgo"). Өнгөт их бие (ангиллын өнгө) + бараан дээвэр —
    модон бүхээгийн дүрс.
    ⚠ ХЭМЖЭЭ ӨСГӨСӨН: бодит бүхээг ~1.2 м тул хотын масштабад нэг
    пикселээс жижиг. 10 м × 10 м × 14 м нь гэр хорооллын нягтралд
    (жорлон хооронд ~20–30 м) бие биедээ наалдахгүй, 1:12 000-д 5 пиксел.
    Блок өөрөө ×800 өсгөлттэй тул энэ нь ХЭМЖИЛТ биш ТЭМДЭГ.
    ⚠⚠ ҮРГЭЛЖ ХАЙРЦАГ, ЦЭГ БИШ (хэрэглэгч 2026-10-01: "scale hamaaraltai
    point bolood box bolood bgaag boliulaad box heweer baiy"). Урьд нь
    1:12 000-аас цааш дэлгэцийн цэг байв. Одоо ХОЁР ХАЙРЦГИЙН давхарга
    `BOX_SCALE`-аар солигдоно:
      · ойроос — дээвэртэй бүхээг, бодит хэмжээ (10 × 10 × 14 м);
      · алсаас — дээвэргүй шоо, хэмжээ нь масштабаар өснө (`farSize`),
        эс тэгвээс 10 м нь 1:500 000-д пикселээс жижиг болж алга болно.
    ⚠ Хайрцаг нь ЦЭВЭР ДЭВСГЭРТ блокийн дээд гадарга дээр (`zAt`,
    `absolute-height`) — газар нуугдсан тул газраас хэмжвэл блок дотор
    далдарна; БОДИТ ОРЧИНД газар дээр (`relative-to-ground`, z-г
    тооцохгүй — эс тэгвээс z нь нэмэлт өндөр болж агаарт хөвнө).
    ⚠ Огтлолтоос чөлөөлөгдөхгүй: хасагдсан талынх нь алга болно.
  */
  const BOX_SCALE = 12000;
  const BOX_W = 10;
  const BOX_H = 14;
  const ROOF_H = 1.6;
  /*
    Алсын шооны тал, м — дэлгэцэд ~2.5 пиксел (96 dpi-д 1 пиксел ≈ масштаб ×
    0.000265 м), √2 алхмаар бөөрөнхийлж, 8 м-ээс багагүй. 1.5 пиксел (16 м
    1:36 000-д) нь хөтөч дээр бараг үл үзэгдэх байв.
    ⚠⚠ `$view.scale` ИЛЭРХИЙЛЛИЙГ ХЭРЭГЛЭХГҮЙ: энэ (local) SceneView-д
    шинэчлэгдэхгүй, шатлалын хамгийн их утга дээр гацаж — 1:36 000-д
    хэдэн зуун метрийн шоо болж хорооллыг бүхэлд нь хучиж байв (хөтөч
    дээр хоёр өөр шатлалаар ижил үр дүн гарсан). Оронд нь камер ЗОГСОХ
    бүрд хэмжээг тооцож renderer-ийг солино (`farSize`); алхамтай тул
    бага зэрэг ойртож холдоход дахин зурахгүй.
    ⚠ ~2.5 пикселээс том авахгүй: гэр хорооллын нягтралд (жорлон хооронд
    ~20 м) шоонууд нийлж ХАНА болно.
  */
  const farSize = (scale: number) => Math.max(8, 2 ** (Math.round(2 * Math.log2(scale * 0.0007)) / 2));
  /* Алсын тэмдэг — ДЭЭВЭРГҮЙ шоо: алсаас дээвэр ялгагдахгүй, нэг шоо хурдан */
  const cubeSym = (size: number) => (color: string) => ({
    type: "point-3d",
    symbolLayers: [{ type: "object", resource: { primitive: "cube" }, width: size, depth: size, height: size, anchor: "bottom", material: { color } }],
  });
  const boxSym = (color: string) => ({
    type: "point-3d",
    symbolLayers: [
      {
        type: "object",
        resource: { primitive: "cube" },
        width: BOX_W,
        depth: BOX_W,
        height: BOX_H,
        anchor: "bottom",
        material: { color },
      },
      {
        type: "object",
        resource: { primitive: "cube" },
        width: BOX_W * 1.15,
        depth: BOX_W * 1.15,
        height: ROOF_H,
        /* дээврийн ёроол их биеийн оройд: −0.5 нь өөрийн ёроол, түүнээс
           их биеийн өндрийг өөрийн өндрийн нэгжээр */
        anchor: "relative",
        anchorPosition: { x: 0, y: 0, z: -0.5 - BOX_H / ROOF_H },
        material: { color: [62, 46, 34] },
      },
    ],
  });
  const boxLayers: FLayer[] = [];
  const stopWatchers: { remove: () => void }[] = [];
  const boxElev = () =>
    REAL ? { mode: "relative-to-ground", featureExpressionInfo: { expression: "0" } } : { mode: "absolute-height" };
  async function toggleOverlay(o: Overlay) {
    if (o.busy) return;
    if (o.on) {
      o.on = false;
      o.layers.forEach((l) => (l.visible = false));
      return paintOverlay(o);
    }
    o.on = true;
    o.err = "";
    if (!o.layers.length) {
      o.busy = true;
      paintOverlay(o);
      try {
        const { pts, cls } = await o.load();
        const fields = [
          { name: "oid", type: "oid" },
          { name: "c", type: "small-integer" },
        ];
        const classed = (sym: (c: string) => unknown) =>
          o.classes && cls
            ? {
                type: "unique-value",
                field: "c",
                uniqueValueInfos: o.classes.map((c, k) => ({ value: k, label: c.label, symbol: sym(c.color) })),
              }
            : { type: "simple", symbol: sym(o.color) };
        /* ⚠ Хайрцагтай давхаргад цэгийн давхарга ҮҮСГЭХГҮЙ (доорхыг үз) */
        const l = o.box ? null : new FeatureLayer({
          title: o.label,
          source: pts.flatMap(([x, y], i) =>
            /* ⚠ Порталтай холбогдоогүй жорлон (NaN) ХАСАГДАНА — `oid` нь индекс + 1 хэвээр */
            Number.isFinite(x) ? [new Graphic({ geometry: new Point({ longitude: x, latitude: y }), attributes: { oid: i + 1, c: cls ? cls[i] : 0 } })] : [],
          ),
          objectIdField: "oid",
          fields,
          geometryType: "point",
          spatialReference: { wkid: 4326 },
          popupEnabled: false,
          /* ⚠ Газраас 30 м дээш: блокийн дээд гадарга Esri-ийн рельефээс
             хэдэн метрээр өндөр газарт цэг блок дотор далдрахгүй */
          elevationInfo: { mode: "relative-to-ground", offset: 30 },
          renderer: classed((c) => overlaySym(o, c)),
          /* ⚠ 145 мянган цэг давхцахад SDK өөрөө сийрэгжүүлнэ (ойртоход бүгд) */
          featureReduction: { type: "selection" },
        });
        if (l) {
          await l.load();
          map.add(l);
          o.layers.push(l);
          applyClip(l);
        }
        if (o.box) {
          /* Алсын шоо — `BOX_SCALE`-аас цааш */
          const far = new FeatureLayer({
            title: o.label,
            source: pts.flatMap(([x, y], i) =>
              Number.isFinite(x) ? [new Graphic({ geometry: new Point({ longitude: x, latitude: y, z: zAt(x, y) }), attributes: { oid: i + 1, c: cls ? cls[i] : 0 } })] : [],
            ),
            objectIdField: "oid",
            fields,
            geometryType: "point",
            hasZ: true,
            spatialReference: { wkid: 4326 },
            popupEnabled: false,
            elevationInfo: boxElev(),
            renderer: classed(cubeSym(farSize(view.scale))),
            maxScale: BOX_SCALE,
          });
          await far.load();
          map.add(far);
          o.layers.push(far);
          applyClip(far);
          boxLayers.push(far);
          let size = farSize(view.scale);
          const sizer = reactiveUtils.watch(
            () => view.stationary && view.scale,
            () => {
              if (!view.stationary || view.scale < BOX_SCALE) return;
              const next = farSize(view.scale);
              if (next === size) return;
              size = next;
              (far as unknown as { renderer: unknown }).renderer = classed(cubeSym(size));
            },
          );
          stopWatchers.push(sizer);
          const b = new FeatureLayer({
            title: o.label,
            source: pts.flatMap(([x, y], i) =>
              Number.isFinite(x) ? [new Graphic({ geometry: new Point({ longitude: x, latitude: y, z: zAt(x, y) }), attributes: { oid: i + 1, c: cls ? cls[i] : 0 } })] : [],
            ),
            objectIdField: "oid",
            fields,
            geometryType: "point",
            hasZ: true,
            spatialReference: { wkid: 4326 },
            popupEnabled: false,
            elevationInfo: boxElev(),
            renderer: classed(boxSym),
            minScale: BOX_SCALE,
          });
          await b.load();
          map.add(b);
          o.layers.push(b);
          applyClip(b);
          boxLayers.push(b);
        }
      } catch (e) {
        o.on = false;
        o.err = `Уншигдсангүй: ${(e as Error).message}`;
      }
      o.busy = false;
    }
    o.layers.forEach((l) => (l.visible = true));
    paintOverlay(o);
  }
  const layersExpand = new Expand({
    view,
    content: layersBox,
    expandIcon: "layers",
    expandTooltip: "Давхарга",
    collapseTooltip: "Давхаргыг хаах",
    mode: "floating",
    group: "soil-tools",
  }) as unknown as Widget;
  view.ui.add(layersExpand, "top-right");
  const analysisOf = (): Analysis | null => slice;
  const shapeOf = <T,>(): T | null => (analysisOf()?.shape ?? null) as T | null;
  let excluded: Analysis | null = null;
  /** ⚠ Таглаа, тэмдэглэгээ огтлолтоос ЧӨЛӨӨЛӨГДӨНӨ — эс тэгвээс
      зүсэлтийн нүүр өөрөө огтлогдож, хоосон нүх үлдэнэ.
      Обьект солигдох бүрд ДАХИН тавина. */
  const keepCap = () => {
    const a = analysisOf();
    if (!a || a === excluded) return a;
    excluded = a;
    a.excludedLayers = [capL, markL, lineL, floorL, plumeL];
    return a;
  };
  keepCap();

  let AZ = 90;
  /** `SlicePlane.heading` нь хавтгайн НОРМАЛЫН чиглэл — шугамын азимут нь түүнээс 90° зөрнө */
  const planeLineAz = (s: { heading: number }) => (s.heading + 90) % 180;

  /* ── Шугамаар зүсэх ── */
  const bearing = (a: Pt, b: Pt) => (Math.atan2((b[0] - a[0]) * mLon, (b[1] - a[1]) * mLat) / RAD + 360) % 360;
  const distM = (a: Pt, b: Pt) => Math.hypot((b[0] - a[0]) * mLon, (b[1] - a[1]) * mLat);
  const angDiff = (x: number, y: number) => Math.abs(((((x - y) % 360) + 540) % 360) - 180);
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  /** ⚠ Блокоос гадуурх хоёр үзүүрийг тайрна — эс тэгвээс хавтгайн
      хүрээний шугам хоосон дэвсгэрийг хөндлөн огтолно */
  function trim(a: Pt, b: Pt): [Pt, Pt] | null {
    const N = 400;
    let i0 = -1;
    let i1 = -1;
    for (let i = 0; i <= N; i++) {
      const p = lerp(a, b, i / N);
      if (!validAt(p[0], p[1])) continue;
      if (i0 < 0) i0 = i;
      i1 = i;
    }
    return i0 < 0 || i1 <= i0 ? null : [lerp(a, b, i0 / N), lerp(a, b, i1 / N)];
  }

  function cutAlong(a0: Pt, b0: Pt, frame = false) {
    const t = trim(a0, b0);
    if (!t) return;
    const [a, b] = t;
    const L = distM(a, b);
    if (L < 100) return;
    const mid = lerp(a, b, 0.5);
    const az = bearing(a, b);
    /* ⚠⚠ КАМЕР ТАЛЫН ХАГАС ХАСАГДАНА — нүүр нь харагч руу харна.
       tilt 90 үед хасагдах тал = heading + 180 (`updateCap`-ийн
       тэмдэглэлийг үз) тул heading = камер тал + 180. */
    const cam = view.camera.position;
    const toCam = bearing(mid, [cam.longitude, cam.latitude]);
    const pA = (az + 90) % 360;
    const pB = (az + 270) % 360;
    const side = angDiff(pA, toCam) <= angDiff(pB, toCam) ? pA : pB;
    applyLine(a, b, (side + 180) % 360);
    emitSection();
    plumeCut();
    sync();
    /* ⚠ ЗУРСАН зүсэлтэд камер НҮҮР рүү нь эргэнэ: блок 100 км өргөн тул
       анхны харагдацаас 1.6 км өндөр нүүр хэдхэн пиксел болж үлддэг.
       Камер хасагдсан (харагч) талд үлдэж НҮҮР рүү харна (`heading` нь
       камерын ХАРАХ зүг = `side` + 180), шугамыг бүтнээр нь багтаана.
       Alt + товшилтод ХИЙХГҮЙ — тэр нь одоогийн харагдлаас хурдан зүсэх зам. */
    if (frame) {
      /* ⚠ Зорилт нь `Point`-ийн ЖАГСААЛТ: энгийн обьект (`{ type: "polyline" … }`)
         өгөхөд SDK түүнийг геометр болгодоггүй — `goTo` "амжилттай" буцаавч
         зөвхөн чиглэл, налуу солигдож, камер байрнаасаа хөдөлдөггүй байв
         (хөтөч дээр шалгасан). Доод талыг ч оруулна: нүүр бүтнээрээ багтана. */
      const target = [a, lerp(a, b, 0.5), b].flatMap((p) => {
        const top = zAt(p[0], p[1]);
        return [top, top - R_BOTTOM * exs()].map((z) => new Point({ longitude: p[0], latitude: p[1], z }));
      });
      view.goTo({ target, heading: (side + 180) % 360, tilt: 72 }, { duration: 900 }).catch(() => {});
    }
  }

  /**
   * Шугамаас хавтгай — `heading` нь ХАСАГДАХ талыг тогтооно тул чирэх,
   * өргөн тохируулах үед ХЭВЭЭР үлдэнэ (тал нь санамсаргүй солигдохгүй).
   */
  function applyLine(a: Pt, b: Pt, heading: number) {
    const mid = lerp(a, b, 0.5);
    const span = vSpan();
    slice.shape = new SlicePlane({
      position: new Point({ longitude: mid[0], latitude: mid[1], z: span.z }),
      heading,
      tilt: 90,
      /* бодит метрийг Mercator нэгж рүү */
      width: distM(a, b) / mercK(mid[1]),
      height: span.h,
    }) as unknown as Obj;
    cutLine = { a, b };
    drawHandles();
  }

  /*
    ⚠⚠ БАРИУЛУУД — Esri-ийн хэрэгсэл шиг (хэрэглэгч 2026-09-30: "naash
    tsaash hudulgunu yg slice shig, urguniig bas tohiruulna"):
      · ГОЛЫН бариул (дугуй) — зүсэлтийг шугамд ПЕРПЕНДИКУЛЯР зөөнө
        (нааш цааш); чиглэл, өргөн хэвээр;
      · ҮЗҮҮРИЙН хоёр бариул (дөрвөлжин) — тэр үзүүрийг шугамын дагуу
        сунгаж, богиносгоно; нөгөө үзүүр хөдлөхгүй.
    ⚠ Бариул НЭГ ДОР олдоно (`hovered`): hover бүрд `hitTest` хийж
    тогтоодог — дарах агшинд асуувал хариу нь `drag` эхэлсний ДАРАА
    ирж, эхний хэдэн хүрээ зураг гүйчихнэ.
    ⚠ Хөндлөн огтлол ЧИРЭЛТ ДУУСАХАД л шинэчлэгдэнэ — хүрээ бүрд 201
    цэгийн катена бодох нь чирэлтийг гацаана.
  */
  type Handle = "move" | "a" | "b";
  let hovered: Handle | null = null;
  let grab: { h: Handle; a0: Pt; b0: Pt; m0: Pt | null } | null = null;
  let hoverBusy = false;
  const HANDLE_UP = 30;
  const handleSym = (shape: "circle" | "square", size: number) => ({
    type: "point-3d",
    symbolLayers: [
      { type: "icon", size, resource: { primitive: shape }, material: { color: "#67d7e4" }, outline: { color: "white", size: 1.5 } },
    ],
  });
  function drawHandles() {
    if (drawing || drawingPoly) return;
    lineL.removeAll();
    if (!cutLine) return;
    const { a, b } = cutLine;
    const up = (p: Pt) => zAt(p[0], p[1]) + HANDLE_UP;
    const path: number[][] = [];
    for (let i = 0; i <= 64; i++) {
      const p = lerp(a, b, i / 64);
      path.push([p[0], p[1], up(p)]);
    }
    lineL.add(new Graphic({ geometry: { type: "polyline", paths: [path], hasZ: true, spatialReference: SR }, symbol: lineSym }));
    const mid = lerp(a, b, 0.5);
    const at3 = (p: Pt) => new Point({ longitude: p[0], latitude: p[1], z: up(p) });
    lineL.add(new Graphic({ geometry: at3(mid), symbol: handleSym("circle", 16), attributes: { h: "move" } }));
    lineL.add(new Graphic({ geometry: at3(a), symbol: handleSym("square", 12), attributes: { h: "a" } }));
    lineL.add(new Graphic({ geometry: at3(b), symbol: handleSym("square", 12), attributes: { h: "b" } }));
  }
  function setHover(h: Handle | null) {
    hovered = h;
    container.classList.toggle("is-grab", h === "move");
    container.classList.toggle("is-size", h === "a" || h === "b");
  }
  function hoverHandle(e: unknown) {
    if (grab || !cutLine || hoverBusy) return;
    hoverBusy = true;
    view
      .hitTest(e, { include: [lineL] })
      .then((r) => {
        const h = r.results.map((x) => x.graphic?.attributes?.h).find((v) => v) as Handle | undefined;
        if (!grab) setHover(h ?? null);
      })
      .catch(() => {})
      .finally(() => {
        hoverBusy = false;
      });
  }
  function dragTo(m: Pt) {
    if (!grab || !cutLine) return;
    const g = grab;
    g.m0 ??= m;
    const heading = (slice.shape as { heading: number } | null)?.heading ?? 0;
    /* метрийн хавтгай — эхлэл нь хөдлөхгүй үзүүр/голын анхны байрлал */
    const toM = (p: Pt, o: Pt) => [(p[0] - o[0]) * mLon, (p[1] - o[1]) * mLat];
    const fromM = (o: Pt, v: number[]): Pt => [o[0] + v[0] / mLon, o[1] + v[1] / mLat];
    const L0 = distM(g.a0, g.b0);
    const u = toM(g.b0, g.a0).map((v) => v / L0); // a → b нэгж вектор
    if (g.h === "move") {
      const n = [u[1], -u[0]]; // шугамд перпендикуляр
      const d = toM(m, g.m0);
      const k = d[0] * n[0] + d[1] * n[1];
      applyLine(fromM(g.a0, [n[0] * k, n[1] * k]), fromM(g.b0, [n[0] * k, n[1] * k]), heading);
    } else {
      const fixed = g.h === "a" ? g.b0 : g.a0;
      const dir = g.h === "a" ? [-u[0], -u[1]] : u; // тогтмол үзүүрээс хөдлөх үзүүр рүү
      const d = toM(m, fixed);
      const len = Math.max(200, d[0] * dir[0] + d[1] * dir[1]);
      const moved = fromM(fixed, [dir[0] * len, dir[1] * len]);
      applyLine(g.h === "a" ? moved : fixed, g.h === "a" ? fixed : moved, heading);
    }
  }
  function endGrab() {
    grab = null;
    groundCut();
    setHover(null);
    emitSection();
    plumeCut();
  }

  /*
    ⚠⚠ ЗҮСЭЛТ ДЭЭРХ БОХИРДОЛ (хэрэглэгч 2026-09-30: "end buh jorlon
    haragdana tgeed zuselt hiigeed bohirdliig harna ter timeslide ni bn").
    "Нэвчилтийн симуляци" нь НЭГ жорлонг, энэ нь зүсэлт огтолсон БҮХ
    жорлонг харуулна — загвар нь нэг ({@link createPlumes}).
    ⚠ Чирэлтийн ҮЕД бодохгүй, ДУУСАХАД л (хөндлөн огтлолтой нэг зарчим).
    ⚠ Хасагдсан тал = heading + 180 (tilt 90) — таглаа нь тэр тал руу
    харна, бохирдол мөн тийшээ 0.8 м урагшилна.
  */
  const plumes = createPlumes({
    Mesh, MeshComponent, MeshMaterial, MeshTexture, Graphic,
    layer: plumeL,
    zAt,
    exs,
    mLon,
    mLat,
    SR,
    onState: onPlumes,
  });
  function plumeCut() {
    const heading = (slice.shape as { heading: number } | null)?.heading;
    if (!cutLine || heading == null) return plumes.clear();
    plumes.setCut(cutLine.a, cutLine.b, (heading + 180) % 360);
  }

  /** Alt + товшилт — тэр цэгээр, сүүлийн азимутаар блокийг бүтэн зүснэ */
  function cutThrough(lon: number, lat: number) {
    const S = SPAN();
    const a = at(lon, lat, AZ, -S);
    const b = at(lon, lat, AZ, S);
    cutAlong([a[0], a[1]], [b[0], b[1]]);
  }

  function emitSection() {
    if (!cutLine) return onSection(null);
    const { a, b } = cutLine;
    const L = distM(a, b);
    const N = 200;
    const samples: Section["samples"] = [];
    for (let i = 0; i <= N; i++) {
      const [lon, lat] = lerp(a, b, i / N);
      const d = (L * i) / N;
      if (!validAt(lon, lat)) {
        samples.push({ d, lon, lat, elev: null, T: null, gw: 0 });
        continue;
      }
      const pr = profAt(lon, lat);
      samples.push({ d, lon, lat, elev: zAt(lon, lat) - LIFT, T: Array.from(pr.T), gw: pr.gw });
    }
    onSection({ length: L, azimuth: bearing(a, b), keys: [...keys], samples });
  }

  /* ── Зурж буй шугам ── */
  const lineSym = { type: "line-3d", symbolLayers: [{ type: "line", size: 2.5, material: { color: "#67d7e4" } }] };
  const dotSym = {
    type: "point-3d",
    symbolLayers: [
      { type: "icon", size: 10, resource: { primitive: "circle" }, material: { color: "#67d7e4" }, outline: { color: "white", size: 1.5 } },
    ],
  };
  function drawRubber(to: Pt | null) {
    lineL.removeAll();
    if (!first) return;
    const f = first;
    lineL.add(new Graphic({ geometry: new Point({ longitude: f[0], latitude: f[1], z: zAt(f[0], f[1]) + 30 }), symbol: dotSym }));
    if (!to) return;
    const path: number[][] = [];
    for (let i = 0; i <= 64; i++) {
      const p = lerp(f, to, i / 64);
      path.push([p[0], p[1], zAt(p[0], p[1]) + 30]);
    }
    lineL.add(new Graphic({ geometry: { type: "polyline", paths: [path], hasZ: true, spatialReference: SR }, symbol: lineSym }));
  }
  /** Зурж буй талбай — оройнууд, хүрээ, заагч хүртэлх ба эхний цэг рүү буцах шугам */
  function drawPoly(to: Pt | null) {
    lineL.removeAll();
    if (!verts.length) return;
    const up = (p: Pt) => zAt(p[0], p[1]) + 30;
    const path: number[][] = [];
    const chain = to ? [...verts, to] : [...verts];
    if (chain.length > 2) chain.push(verts[0]);
    for (let i = 0; i + 1 < chain.length; i++) {
      for (let j = 0; j < 32; j++) {
        const p = lerp(chain[i], chain[i + 1], j / 32);
        path.push([p[0], p[1], up(p)]);
      }
    }
    const last = chain[chain.length - 1];
    path.push([last[0], last[1], up(last)]);
    if (path.length > 1)
      lineL.add(new Graphic({ geometry: { type: "polyline", paths: [path], hasZ: true, spatialReference: SR }, symbol: lineSym }));
    verts.forEach((p, i) =>
      lineL.add(
        new Graphic({
          geometry: new Point({ longitude: p[0], latitude: p[1], z: up(p) }),
          /* Эхний цэг ТОМ — түүн дээр товшиж дуусгана */
          symbol: i === 0 && verts.length >= 3 ? firstSym : dotSym,
        }),
      ),
    );
  }
  const firstSym = {
    type: "point-3d",
    symbolLayers: [
      { type: "icon", size: 15, resource: { primitive: "circle" }, material: { color: "white" }, outline: { color: "#67d7e4", size: 3 } },
    ],
  };
  const screenOf = (p: Pt) => view.toScreen(new Point({ longitude: p[0], latitude: p[1], z: zAt(p[0], p[1]) + 30 }));
  /** Давхар товшилтын хоёр товшилт бараг ижил хоёр орой үлдээнэ — хасна */
  function dedupe(P: Pt[]) {
    const out: Pt[] = [];
    for (const p of P) {
      const q = out[out.length - 1];
      if (q) {
        const a = screenOf(p);
        const b = screenOf(q);
        if (a && b ? Math.hypot(a.x - b.x, a.y - b.y) < 6 : distM(p, q) < 5) continue;
      }
      out.push(p);
    }
    while (out.length > 3 && distM(out[0], out[out.length - 1]) < 5) out.pop();
    return out;
  }
  function addVertex(p: Pt, sx: number, sy: number) {
    if (verts.length >= 3) {
      const s0 = screenOf(verts[0]);
      if (s0 && Math.hypot(s0.x - sx, s0.y - sy) < 12) return finishPoly();
    }
    verts.push(p);
    drawPoly(null);
    sync();
  }
  function finishPoly() {
    const P = dedupe(verts);
    stopPoly();
    if (P.length < 3) return;
    setClip(P);
    /* Камер зурсан талбайг бүтнээр нь (гадарга ба ёроол) багтаана */
    const e = exs();
    void view
      .goTo({
        target: P.flatMap((p) => [
          new Point({ longitude: p[0], latitude: p[1], z: zAt(p[0], p[1]) }),
          new Point({ longitude: p[0], latitude: p[1], z: zAt(p[0], p[1]) - R_BOTTOM * e }),
        ]),
        tilt: 62,
      })
      .catch(() => {});
  }
  /*
    ⚠ ЖОРЛОН, ХУДАГ МӨН ТАЛБАЙГААР ШҮҮГДЭНЭ — эс тэгвээс блок алга болсон
    газарт хоосон агаарт хөвсөн хайрцаг үлдэнэ. Давхарга дараа асаавал
    `toggleOverlay` мөн дуудна.
  */
  function applyClip(l?: unknown) {
    const filter = clip
      ? {
          geometry: { type: "polygon", rings: [[...clip, clip[0]]], spatialReference: SR },
          spatialRelationship: "intersects",
        }
      : null;
    const ls = l ? [l] : overlays.flatMap((o) => o.layers);
    ls.forEach((x) =>
      view
        .whenLayerView(x)
        .then((lv) => (lv.filter = filter))
        .catch(() => {}),
    );
  }
  const dblH = view.on("double-click", ((e: { stopPropagation: () => void; mapPoint?: { longitude: number; latitude: number } }) => {
    if (!drawingPoly) return;
    /* ⚠ Давхар товшилт зургийг ОЙРТУУЛДАГ — зурах үед зогсооно */
    e.stopPropagation();
    /* ⚠ SDK давхар товшилтын үед `click`-ийг ЦУЦАЛДАГ тул сүүлийн орой
       энд нэмэгдэнэ; давхардвал `dedupe` хасна */
    const q = e.mapPoint ?? view.toMap(e);
    if (q) verts.push([q.longitude, q.latitude]);
    finishPoly();
  }) as never);
  const moveH = view.on("pointer-move", ((e: unknown) => {
    if (drawingPoly) {
      if (!verts.length) return;
      const mp = view.toMap(e);
      if (mp) drawPoly([mp.longitude, mp.latitude]);
      return;
    }
    if (drawing) {
      if (!first) return;
      const mp = view.toMap(e);
      if (mp) drawRubber([mp.longitude, mp.latitude]);
      return;
    }
    hoverHandle(e);
  }) as never);
  const downH = view.on("pointer-down", (() => {
    if (hovered && cutLine) {
      grab = { h: hovered, a0: cutLine.a, b0: cutLine.b, m0: null };
      groundCut();
    }
  }) as never);
  const upH = view.on("pointer-up", (() => {
    if (grab) endGrab();
  }) as never);
  const dragH = view.on("drag", ((e: { action: string; stopPropagation: () => void }) => {
    if (!grab) return;
    /* ⚠ Бариулыг чирэх үед зургийн навигаци (гүйлгэх, эргүүлэх) ЗОГСОНО */
    e.stopPropagation();
    if (e.action === "end") return endGrab();
    const mp = view.toMap(e);
    if (mp) dragTo([mp.longitude, mp.latitude]);
  }) as never);

  /** ECEF — зүсэлтийн шугамыг хавтгайтай ЯГ давхцуулахын тулд */
  const ecef = (lon: number, lat: number, h: number) => {
    const lo = lon * RAD;
    const la = lat * RAD;
    const N = A_ / Math.sqrt(1 - E2 * Math.sin(la) ** 2);
    return [(N + h) * Math.cos(la) * Math.cos(lo), (N + h) * Math.cos(la) * Math.sin(lo), (N * (1 - E2) + h) * Math.sin(la)];
  };
  const geod = ([x, y, zz]: number[]) => {
    const b = A_ * (1 - F_);
    const ep2 = E2 / (1 - E2);
    const p = Math.hypot(x, y);
    const th = Math.atan2(zz * A_, p * b);
    const lat = Math.atan2(zz + ep2 * b * Math.sin(th) ** 3, p - E2 * A_ * Math.cos(th) ** 3);
    return [Math.atan2(y, x) / RAD, lat / RAD];
  };
  const enu = (lon: number, lat: number) => {
    const lo = lon * RAD;
    const la = lat * RAD;
    return {
      E: [-Math.sin(lo), Math.cos(lo), 0],
      N: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
    };
  };

  const STEP = () => Math.min(dx * mLon, dy * mLat) / fine;
  const SPAN = () => Math.hypot(nx * dx * mLon, ny * dy * mLat);

  /** `az` зүгт `from`-оос `to` метрийн хооронд авсан цэгүүд: [lon, lat, s] */
  function ray(lon0: number, lat0: number, az: number, from: number, to: number) {
    const P = ecef(lon0, lat0, 0);
    const { E, N } = enu(lon0, lat0);
    const sn = Math.sin(az * RAD);
    const cs = Math.cos(az * RAD);
    const d = [0, 1, 2].map((i) => cs * N[i] + sn * E[i]);
    const step = STEP();
    const pts: number[][] = [];
    const push = (s: number) => {
      const q = geod([P[0] + s * d[0], P[1] + s * d[1], P[2] + s * d[2]]);
      pts.push([q[0], q[1], s]);
    };
    for (let s = from; s < to - 1e-6; s += step) push(s);
    /* ⚠ ТӨГСГӨЛИЙН ЦЭГ ЗААВАЛ — алхам `to` дээр яг буухгүй бол нүүр
       хавтгайн ирмэгт хүрэхгүй тасарч, хажуу ханатай хоорондоо нэг
       алхам хүртэл (~75 м) цоорхой үлдэж, цаадах хэсэг босоо цайвар
       зурвас болж харагдаж байв */
    push(to);
    return pts;
  }

  /** Нэг цэг: (lon, lat)-аас `az` зүгт `s` метр */
  const at = (lon: number, lat: number, az: number, s: number) => ray(lon, lat, az, s, s)[0] ?? [lon, lat, s];

  /** Цэгүүдийн дагуух хана. `topOf` нь цэг тутмын дээд хязгаар (см). */
  function wall(mb: MB, pts: number[][], topOf?: (lon: number, lat: number) => number) {
    const t = tileM();
    const pr: Blend[] = [];
    const prof = (i: number) => (pr[i] ??= profAt(pts[i][0], pts[i][1]));
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i];
      const B = pts[i + 1];
      if (!validAt((A[0] + B[0]) / 2, (A[1] + B[1]) / 2)) continue;
      const tA = topOf ? topOf(A[0], A[1]) : PEEL;
      const tB = topOf ? topOf(B[0], B[1]) : PEEL;
      if (tA >= R_BOTTOM && tB >= R_BOTTOM) continue;
      strip(mb, A, B, zAt(A[0], A[1]), zAt(B[0], B[1]), A[2] / (t * TILE_ASPECT), B[2] / (t * TILE_ASPECT), prof(i), prof(i + 1), tA, tB);
    }
  }

  /*
    ⚠⚠ ЗҮСЭЛТ НЬ ХАВТГАЙН ХҮРЭЭГЭЭР ХЯЗГААРЛАГДДАГ — энэ нь хязгааргүй
    хагас огтлол БИШ (хөтөч дээр хэмжсэн: 3 км өргөн хавтгай блокийг
    хоёр хуваахын оронд НАРИЙН СУВАГ гаргана). Тиймээс огтлолт нь
    ГУРВАН нүүр ил гаргана:
      · хавтгай ӨӨРӨӨ — сувгийн УРД тал,
      · хавтгайн хоёр ирмэгээс хасагдсан тал руу сунасан ХОЁР ХАЖУУ ХАНА.
    Зөвхөн эхнийхийг нь таглаж байсан тул хажуу тал нь хоосон хар
    зай болж харагддаг байв (хэрэглэгч 2026-09-30: "2 хажуу тал нь
    байхгүй хоосон байгааг больёод … ямар ч зүсэлт хийсэн 2 хажуу тал
    бүтээр soil profile ажиллана").

    ⚠ Нүүр нь хавтгайн ӨРГӨНӨӨР хязгаарлагдана. Урьд нь блок даяар
    татагддаг байсан нь суваг үүсэх үед огтлогдоогүй хэсэг рүү үргэлж
    сунаж, бүтэн блокийн дотор хана зурж байв.
  */
  function capVertical(lon0: number, lat0: number, az: number, halfW: number, remAz: number) {
    const mb = new MB();
    const S = SPAN();
    const hw = Math.min(halfW, S);
    /* УРД нүүр */
    wall(mb, ray(lon0, lat0, az, -hw, hw));
    /* ХОЁР ХАЖУУ ХАНА — ирмэг бүрээс хасагдсан тал руу */
    for (const sign of [-1, 1]) {
      const edge = at(lon0, lat0, az, sign * hw);
      wall(mb, ray(edge[0], edge[1], remAz, 0, S));
    }
    return mb.mesh();
  }

  /*
    ⚠ Хэвтээ зүсэлт мөн адил хавтгайн хүрээгээр хязгаарлагдана: нүүр нь
    тэгш өнцөгтийн ДОТОР л гарч, хүрээний дөрвөн ирмэг дээр босоо хана
    үүснэ. Хана нь гадаргаас биш ОГТОЛСОН ГҮНЭЭС эхэлнэ.
    ⚠ Тэгш өнцөгтийн тэнхлэгүүд: өргөн нь `heading + 90`, өндөр нь
    `heading` зүгт (босоо хавтгайн зүсэлтийн шугамтай нэг дүрэм).
  */
  function capHorizontal(pos: { longitude: number; latitude: number; z: number }, hdg: number, halfW: number, halfH: number) {
    const h0 = pos.z;
    const mb = new MB();
    const W = nx + 1;
    const e = exs();
    const t = tileM();
    const azW = (hdg + 90) % 360;
    const azH = hdg;
    const ew = Math.sin(azW * RAD);
    const nw = Math.cos(azW * RAD);
    const eh = Math.sin(azH * RAD);
    const nh = Math.cos(azH * RAD);
    /** Хавтгайн орон зай дахь байрлал, метр */
    const local = (lon: number, lat: number) => {
      const de = (lon - pos.longitude) * mLon;
      const dn = (lat - pos.latitude) * mLat;
      return [de * ew + dn * nw, de * eh + dn * nh];
    };
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        if (cells[r * nx + c] === 255) continue;
        const i = r * W + c;
        const zc = (z[i] + z[i + 1] + z[i + W] + z[i + W + 1]) / 4;
        const dcm = (zc - h0) / e;
        if (dcm <= 0 || dcm >= R_BOTTOM) continue;
        const [lx, ly] = local(x0 + (c + 0.5) * dx, y0 + (r + 0.5) * dy);
        if (Math.abs(lx) > halfW || Math.abs(ly) > halfH) continue;
        const bd = bandAt(profAt(x0 + (c + 0.5) * dx, y0 + (r + 0.5) * dy), keys, dcm);
        if (!bd) continue;
        const L0 = x0 + c * dx;
        const L1 = L0 + dx;
        const B0 = y0 + r * dy;
        const B1 = B0 + dy;
        const u0 = (L0 * mLon) / (t * TILE_ASPECT);
        const u1 = (L1 * mLon) / (t * TILE_ASPECT);
        const v0 = (B0 * mLat) / t;
        const v1 = (B1 * mLat) / t;
        mb.quad(bd.c + (bd.sat ? "_w" : ""), mb.v(L0, B0, h0, u0, v0), mb.v(L1, B0, h0, u1, v0), mb.v(L1, B1, h0, u1, v1), mb.v(L0, B1, h0, u0, v1));
      }
    }
    /* Хүрээний дөрвөн ирмэг дэх босоо хана */
    const topOf = (lon: number, lat: number) => Math.max(PEEL, (zAt(lon, lat) - h0) / e);
    for (const sy of [-1, 1]) {
      const e0 = at(pos.longitude, pos.latitude, azH, sy * halfH);
      const c0 = at(e0[0], e0[1], azW, -halfW);
      wall(mb, ray(c0[0], c0[1], azW, 0, 2 * halfW), topOf);
    }
    for (const sx of [-1, 1]) {
      const e0 = at(pos.longitude, pos.latitude, azW, sx * halfW);
      const c0 = at(e0[0], e0[1], azH, -halfH);
      wall(mb, ray(c0[0], c0[1], azH, 0, 2 * halfH), topOf);
    }
    return mb.mesh();
  }

  let pend = false;
  function updateCap() {
    if (pend) return;
    pend = true;
    requestAnimationFrame(() => {
      pend = false;
      capL.removeAll();
      keepCap();
      const s = shapeOf<{
        position: { longitude: number; latitude: number; z: number };
        heading: number;
        tilt: number;
        width: number;
        height: number;
        clone: () => { width: number; height: number };
      }>();
      if (!s) {
        onNote("");
        return;
      }
      const tilt = ((s.tilt % 180) + 180) % 180;
      let m: unknown = null;
      if (Math.abs(tilt - 90) < 1) {
        /*
          ⚠⚠ БОСОО ХАВТГАЙН ӨНДӨР БЛОКИЙГ ЗААВАЛ ХАМАРНА (өргөн нь
          хэрэглэгчийнх хэвээр). Хэрэгслээр чирж үүсгэсэн хавтгай нь
          гадаргын цэг дээр төвлөрч дээш, доош тэнцүү тархах богино
          хавтгай (хэдэн арван метр) тул рельеф өндөрсөх, намсах газарт
          блокийг огтолж чадахгүй: хасалт нь рельефийн дагуу ТАСАРХАЙ
          ЗУРВАС болж (хөтөч дээр 30 м өндөр хавтгайгаар хэмжсэн), ёроол
          огтлогдолгүй суваг дотор "шал" болж үлдэж, бүтэн гүнээр
          татагдсан тагла тэдгээрээр нэвт гардаг байв (хэрэглэгч
          2026-09-30: "чамд алдаа харагдаж байна уу").
          Хөрсний блок 2 метр зузаан тул түүнийг нэвт огтлоогүй босоо
          зүсэлт утгагүй. Хэлбэр дахин бичигдэж энэ эргэлт ДАХИН
          дуудагдана; тэр удаад нөхцөл хангагдахгүй тул давталт үүсэхгүй.
        */
        const span = vSpan();
        if (Math.abs(s.height - span.h) > 1 || Math.abs(s.position.z - span.z) > 1) {
          const n = s.clone() as unknown as { height: number; position: unknown };
          n.height = span.h;
          n.position = new Point({ longitude: s.position.longitude, latitude: s.position.latitude, z: span.z });
          const a = analysisOf();
          if (a) a.shape = n as unknown as Obj;
          return;
        }
        AZ = planeLineAz(s);
        /*
          ⚠⚠ ХАСАГДАХ ТАЛ нь `heading` + `tilt`-ийн ТЭМДЭГ хоёроос.
          Хавтгайн нормаль = cos(tilt)·дээш + sin(tilt)·(heading + 180)
          зүг, хасагдах нь НОРМАЛИЙН тал. Хөтөч дээр хэмжсэн:
            heading 270, tilt  90 → зүүн тал хасагдана;
            heading 270, tilt 270 → БАРУУН тал хасагдана;
            tilt 0 (хэвтээ)        → ДЭЭД тал хасагдана.
          Урьд нь tilt-ийг 180-аар хумиад (`tilt` хувьсагч) тэр тэмдгийг
          гээж, чиглэлийг `heading`-ээс л гаргадаг байв. Хэрэгслийн
          ХӨМРӨХ бариул, мөн чирэх чиглэл нь tilt 270 өгдөг тул хажуу
          хана огтлогдоогүй блокийн ДОТОР сунаж, суваг хоосон үлдэж
          байлаа (хэрэглэгч 2026-09-30-нд доод талаас нь харуулж
          баталсан).
        */
        const remAz = Math.sin(((s.tilt % 360) + 360) % 360 * RAD) > 0 ? (s.heading + 180) % 360 : s.heading % 360;
        /* Mercator өргөнийг бодит метр рүү — огтлолттой ЯГ давхцана */
        const k = mercK(s.position.latitude);
        m = capVertical(s.position.longitude, s.position.latitude, AZ, (s.width / 2) * k, remAz);
        onNote("");
      } else if (tilt < 1 || tilt > 179) {
        const k = mercK(s.position.latitude);
        m = capHorizontal(s.position, s.heading, (s.width / 2) * k, (s.height / 2) * k);
        onNote("");
      } else {
        onNote("Налуу зүсэлтэд таглаа зурахгүй — босоо эсвэл хэвтээ болгоно уу");
      }
      if (m) capL.add(new Graphic({ geometry: m, symbol: sym }));
    });
  }
  const watcher = reactiveUtils.watch(() => {
    /* ⚠ Обьектын ӨӨРИЙН солигдлыг ч мөрдөнө — зөвхөн хэлбэрийг нь
       харвал шинэ зүсэлт эхлэхэд өөрчлөлт мэдэгдэхгүй */
    const a = analysisOf();
    const s = (a?.shape ?? null) as {
      position?: { x: number; y: number; z: number };
      heading: number;
      tilt: number;
      width: number;
      height: number;
    } | null;
    /* ⚠⚠ ӨРГӨН, ӨНДРИЙГ ЗААВАЛ АЖИГЛАНА. Урьд нь зөвхөн байрлал, чиглэл,
       хазайлт байсан тул хэрэгслийн бариулаар хавтгайг ЖИЖИГРҮҮЛЭХЭД
       таглаа дахин баригдахгүй, эхний том хэмжээгээрээ үлдэж — нүүр
       ч, хажуу хана ч зүсэлтийн хүрээнээс гадуур, огтлогдоогүй блокийн
       дунд зурагдаж байв (хэрэглэгч 2026-09-30: "зүсэлтийн ирмэгтэй
       чацуу харагдмаар байна … slice өргөнөөс дахиад зайтай
       харагдахгүй"). */
    return s ? [s.position?.x, s.position?.y, s.position?.z, s.heading, s.tilt, s.width, s.height].join() : a ? "хоосон" : "";
  }, updateCap);

  /* ── Товшилт → цэгийн профайл ──────────────────────────────────── */
  const PAT = Object.fromEntries(
    Object.keys(HCLS).map((k) => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 128;
      c.getContext("2d")!.drawImage(TEXCV[k], 0, 0, 256, 128);
      return [k, c.toDataURL()];
    }),
  );

  function showProfile(lon: number, lat: number, zHit: number | null) {
    const pi = soilAt(lon, lat);
    if (pi === 255 || !validAt(lon, lat)) return;
    const p = profiles[pi];
    const zt = zAt(lon, lat);
    const dcm = zHit != null && zt - zHit > 1 ? (zt - zHit) / exs() : null;
    const pr = profAt(lon, lat);
    const mixMap: Record<string, number> = {};
    pr.w.forEach((f, i) => {
      if (f > 0.005) mixMap[profiles[i].key] = (mixMap[profiles[i].key] || 0) + f;
    });
    const mix = Object.entries(mixMap)
      .sort((a, b) => b[1] - a[1])
      .map(([key, share]) => ({ key, share }));
    const pure = mix.length === 1;
    /* ⚠ ЦЭВЭР бол эх сурвалжийн ӨӨРИЙН үеийн нэр (Bk1, Bk2 …);
       холилдсон бол зөвхөн АНГИЛАЛ — тэр үед "Bk1" гэж нэрлэх нь
       аль профайлынх болох нь тодорхойгүй тул худал болно */
    let t = 0;
    const hz = pure
      ? p.hz.map((h) => ({ n: h.n, t: h.t, b: h.b, c: hcls(h.n) }))
      : keys
          .map((c, k) => ({ n: HCLS[c].label.split(" — ")[0], t: Math.round(t), b: Math.round((t += pr.T[k])), c }))
          .filter((h) => h.b > h.t);
    onPick({
      profile: p,
      mix,
      pure,
      svg: profileSVG(hz, pr.gw, dcm != null && dcm < R_BOTTOM ? dcm : null),
      lon,
      lat,
      elevation: zt - LIFT,
      depthCm: dcm,
    });
    markL.removeAll();
    markL.add(
      new Graphic({
        geometry: new Point({ longitude: lon, latitude: lat, z: zt + 10 }),
        symbol: {
          type: "point-3d",
          symbolLayers: [
            { type: "icon", size: 12, resource: { primitive: "circle" }, material: { color: "#e47b7b" }, outline: { color: "white", size: 1.5 } },
          ],
          verticalOffset: { screenLength: 40 },
          callout: { type: "line", size: 1.5, color: "#e47b7b" },
        },
      }),
    );
  }

  /** Монолит: урд тал (долгиолог хил), баруун хажуу (сүүдэртэй), дээд тал (навч, өвс) */
  function profileSVG(hz: { n: string; t: number; b: number; c: string }[], gwCm: number, depthCm: number | null) {
    const W = 282, X = 70, CW = 150, SX = 42, SY = -24, T = 58, H = 330;
    const sc = H / R_BOTTOM, HH = T + H + 12, R = mulberry32(99);
    const wv = (y: number, x: number, k: number) =>
      y <= T + 0.5 || y >= T + H - 0.5 ? y : y + 2.4 * Math.sin(x * 0.085 + k * 1.9) + 1.1 * Math.sin(x * 0.21 + k * 3.3);
    const poly = (pts: number[][], fill: string) =>
      `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${fill}"/>`;
    let s = `<svg width="${W}" height="${HH}" viewBox="0 0 ${W} ${HH}"><defs>`;
    for (const k of new Set(hz.map((h) => h.c)))
      s += `<pattern id="pt${k}" patternUnits="userSpaceOnUse" width="256" height="128"><image href="${PAT[k]}" width="256" height="128"/></pattern>`;
    s += `<linearGradient id="sideSh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient></defs>`;
    hz.forEach((h) => {
      const y1 = T + h.t * sc, y2 = T + h.b * sc;
      const pts = [[X + CW, y1], [X + CW + SX, y1 + SY], [X + CW + SX, y2 + SY], [X + CW, y2]];
      s += poly(pts, `url(#pt${h.c})`) + poly(pts, "url(#sideSh)");
    });
    hz.forEach((h, i) => {
      const y1 = T + h.t * sc, y2 = T + h.b * sc;
      const top: number[][] = [], bot: number[][] = [];
      for (let x = X; x <= X + CW + 0.1; x += 5) {
        top.push([x, wv(y1, x, i)]);
        bot.unshift([x, wv(y2, x, i + 1)]);
      }
      s += poly([...top, ...bot], `url(#pt${h.c})`);
    });
    s += `<rect x="${X}" y="${T}" width="${CW}" height="${H}" fill="none" stroke="rgba(0,0,0,.25)"/>`;
    s += poly([[X, T], [X + CW, T], [X + CW + SX, T + SY], [X + SX, T + SY]], "#3a291b");
    const onTop = () => {
      const u = R(), v = R();
      return [X + u * CW + v * SX, T + v * SY];
    };
    for (let i = 0; i < 46; i++) {
      const [x, y] = onTop();
      const c = ["#7a4a22", "#94602e", "#5b3a1e", "#a57438", "#6b5a2a"][(R() * 5) | 0];
      s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(3 + R() * 4).toFixed(1)}" ry="${(1.3 + R() * 1.5).toFixed(1)}" transform="rotate(${(R() * 180) | 0} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width=".5"/>`;
    }
    for (let i = 0; i < 20; i++) {
      const [x, y] = onTop();
      for (let b = 0; b < 5; b++) {
        const hgt = 9 + R() * 16, lean = (R() - 0.5) * 12;
        const c = ["#5f8f35", "#77a843", "#4d7a2a", "#8bb851"][(R() * 4) | 0];
        s += `<path d="M${(x + b * 1.2 - 2).toFixed(1)} ${y.toFixed(1)} q${(lean * 0.3).toFixed(1)} ${(-hgt * 0.6).toFixed(1)} ${lean.toFixed(1)} ${(-hgt).toFixed(1)}" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
      }
    }
    const bnd = [...new Set(hz.map((h) => h.t).concat(hz.map((h) => h.b)))];
    bnd.forEach((d) => {
      const y = T + d * sc;
      s += `<line x1="4" x2="${X - 6}" y1="${y}" y2="${y}" stroke="#6b5a48" stroke-dasharray="3 3"/>`;
    });
    hz.forEach((h) => {
      const y1 = T + h.t * sc, y2 = T + h.b * sc, hh = y2 - y1, m = (y1 + y2) / 2;
      const col = h.c === "Bw" || h.c === "Bf" ? "#a4502a" : "#2c2620";
      /* ⚠ ХОЁР МӨРТ ШОШГО 38px-ЭЭС НИМГЭН ҮЕД БАГТАХГҮЙ: нэр нь үеийн
         дунд, гүний муж түүнээс 15px доош суудаг тул 20 см (33px) үе
         дээр муж нь дараагийн үеийн нэр рүү халж байв. Нимгэн үе
         нэг мөрт хэлбэрээ авна ("A 0–20"). */
      if (hh >= 38) {
        const fs = h.n.length > 3 ? 13 : 20;
        s += `<text x="${(X - 6) / 2}" y="${m + 2}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${col}">${h.n}</text>`;
        s += `<text x="${(X - 6) / 2}" y="${m + 15}" text-anchor="middle" font-size="10" fill="#5f6a6e">(${h.t}–${h.b} см)</text>`;
      } else if (hh >= 11) {
        s += `<text x="${(X - 6) / 2}" y="${m + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${col}">${h.n} <tspan font-weight="400" fill="#5f6a6e" font-size="9">${h.t}–${h.b}</tspan></text>`;
      }
    });
    s += `<text x="${(X - 6) / 2}" y="${T - 10}" text-anchor="middle" font-size="10" fill="#5f6a6e">гадарга</text>`;
    if (gwCm < R_BOTTOM) {
      const y = T + gwCm * sc;
      s += `<path d="M${X} ${y} H${X + CW} l${SX} ${SY}" stroke="#2f7fc0" stroke-width="2" stroke-dasharray="6 3" fill="none"/>`;
      s += `<text x="${X + CW + SX + 2}" y="${y + SY - 4}" text-anchor="end" font-size="10" fill="#2f7fc0">гүний ус ~${(gwCm / 100).toFixed(1)} м</text>`;
    }
    if (depthCm != null) {
      const y = T + depthCm * sc;
      s += `<path d="M${X - 9} ${y - 5} l8 5 l-8 5z" fill="#c0392b"/><text x="${W - 2}" y="${y + SY + 14}" text-anchor="end" font-size="10" fill="#c0392b">${Math.round(depthCm)} см</text>`;
    }
    return s + `</svg>`;
  }

  const clickH = view.on("click", (async (e: {
    x: number;
    y: number;
    native: { altKey: boolean };
    mapPoint?: { longitude: number; latitude: number; z: number };
  }) => {
    /* Талбай зурах — hitTest хүлээхгүй: давхар товшилтын хоёр дахь
       товшилт `double-click`-ээс ӨМНӨ орой болж бүртгэгдэх ёстой */
    if (drawingPoly) {
      const q = e.mapPoint ?? view.toMap(e);
      if (q) addVertex([q.longitude, q.latitude], e.x, e.y);
      return;
    }
    /* Бариул дээрх товшилт нь профайл гаргахгүй — чирэх үйлдлийн нэг хэсэг */
    if (hovered && !drawing) return;
    /* ⚠⚠ ЖОРЛОН ТОВШИХОД НЭВЧИЛТИЙН СИМУЛЯЦИ (хэрэглэгч 2026-10-01:
       "ЖОРЛОН СОНГОХ ene heseg hereggui hursnii zuseltees jorlon
       songodog bolgochihod bolno"). Тусдаа сонгох газрын зураг
       хасагдсан — жорлонгийн цэг, хайрцаг хоёул энд товшигдоно.
       Зүсэлт зурж байх үед товшилт нь цэг тавина, жорлон сонгохгүй. */
    const pitLayers = drawing ? [] : (overlays.find((o) => o.id === "pit")?.layers ?? []).filter((l) => l.visible);
    const h = await view.hitTest(e, { include: [blockL, capL, ...pitLayers] });
    const pit = h.results.find((r) => r.graphic?.layer && pitLayers.includes(r.graphic.layer as FLayer));
    const oid = Number(pit?.graphic?.attributes?.oid);
    if (pit && oid > 0) {
      onLatrine(oid - 1);
      return;
    }
    const hit = h.results.find((r) => r.mapPoint);
    const mp = hit?.mapPoint || e.mapPoint;
    if (!mp) return;
    /* Зүсэлтийн шугам зурж байх үед товшилт нь цэг тавина */
    if (drawing) {
      const p: Pt = [mp.longitude, mp.latitude];
      if (!first) {
        first = p;
        drawRubber(null);
        sync();
        return;
      }
      const a = first;
      stopDraw();
      cutAlong(a, p, true);
      return;
    }
    /* Alt + товшилт = тэр цэгээр зүсэх (зүсэлт бүрд удирдлага руу очихгүй) */
    if (e.native.altKey) {
      cutThrough(mp.longitude, mp.latitude);
      return;
    }
    showProfile(mp.longitude, mp.latitude, hit ? mp.z : null);
  }) as never);

  await view.when();
  /* ⚠ КАМЕРЫГ ДАТАНЫ ХҮРЭЭНД ТААРУУЛНА, тогтмол байрлалаар БИШ:
     цонхны харьцаа өөр бүрд блок дэлгэцийн дээд зурваст шахагдаж,
     доор нь хоосон талбай үлдэж байв */
  await view
    .goTo(
      {
        target: new Extent({
          xmin: x0, ymin: y0, xmax: x0 + nx * dx, ymax: y0 + ny * dy,
          spatialReference: SR,
        }),
        tilt: 58,
        heading: 0,
      },
      { animate: false },
    )
    .catch(() => {});
  /* ⚠⚠ ЭХЛЭЭД ЗҮСЭЛТГҮЙ (хэрэглэгчийн шийдвэр, 2026-09-30: "refresh
     hiihed ingej slice ajilsan baidaltai haragdahgui"). Урьд нь
     ачаалмагц хот дундуур зүүн–баруун зүсэлт тавьдаг байсан тул
     хуудас сэргээх бүрд блок аль хэдийн огтлогдсон, хагас нь
     алга болсон байдалтай нээгддэг байв — хэрэглэгч өөрөө юу ч
     хийгээгүй атлаа. Зүсэлт нь ЗӨВХӨН хэрэгслийн товчоор (эсвэл
     Alt + товшилтоор) эхэлнэ. */
  /* ⚠ ЖОРЛОН АНХНААСАА АСААЛТТАЙ (хэрэглэгч 2026-09-30: "end buh jorlon
     haragdana") — бохирдлын эх үүсвэр нь юу болох нь зүсэхээс өмнө харагдана */
  void toggleOverlay(overlays[0]);

  return {
    destroy() {
      clickH.remove();
      dblH.remove();
      moveH.remove();
      downH.remove();
      upH.remove();
      dragH.remove();
      window.removeEventListener("keydown", onKey);
      watcher.remove();
      themeObs.disconnect();
      stopWatchers.forEach((w) => w.remove());
      layersExpand.destroy();
      envExpand.destroy();
      expand.destroy();
      view.destroy();
    },
    pickAt: (lon, lat) => showProfile(lon, lat, null),
    setPlumeTime: (i) => plumes.setTime(i),
    setPlumeSpecies: (s) => plumes.setSpecies(s),
    legend: () => keys.map((k) => ({ key: k, label: HCLS[k].label, swatch: TEXCV[k].toDataURL() })),
    soils() {
      const seen = new Set<string>();
      return profiles
        .filter((p) => !seen.has(p.key) && seen.add(p.key))
        .map((p) => ({ key: p.key, name: p.name, wrb: p.wrb, color: SOILCOL[p.key] || "#999999" }));
    },
  };
}

/**
 * Блокийн хүрээний хиймэл дагуулын зураг — Esri World Imagery-ийн хавтанг
 * нийлүүлж, ТЭГШ ӨНЦӨГТ (өргөрөг, уртраг шугаман) canvas болгоно: блокийн
 * `uv` нь градусаар шугаман, хавтан нь Mercator тул мөр бүрийг өөрийн
 * өргөрөгөөр нь дахин түүвэрлэнэ (0.6° өргөрөгт зөрүү ~180 м болох байв).
 * ⚠ z12 (~26 м/пиксел): блокийн нарийн тор 75 м тул түүнээс бүдэг
 *   болгохгүй; өргөн 4096-аас хэтрэхгүй (WebGL текстурын хязгаар).
 * ⚠ Хавтан нь CORS `*` буцаадаг (шалгасан) — `crossOrigin`-гүй бол
 *   canvas бохирдож WebGL текстур болохгүй.
 * ⚠ Esri-ийн НЭЭЛТТЭЙ суурь зураг тул токен хавсрахгүй; `fetch` биш
 *   `Image` тул ESLint-ийн хориг хамаарахгүй.
 * ⚠ Унасан хавтан хоосон үлдэнэ; бүгд унавал алдаа шиднэ.
 */
async function imageryCanvas(
  lon0: number, lat0: number, lon1: number, lat1: number, mLon: number, mLat: number,
): Promise<HTMLCanvasElement> {
  const Z = 12;
  const T = 256;
  const N = 2 ** Z;
  const tx = (lon: number) => ((lon + 180) / 360) * N;
  const ty = (lat: number) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * N;
  };
  const X0 = Math.floor(tx(lon0));
  const X1 = Math.floor(tx(lon1));
  const Y0 = Math.floor(ty(lat1));
  const Y1 = Math.floor(ty(lat0));
  const mosaic = document.createElement("canvas");
  mosaic.width = (X1 - X0 + 1) * T;
  mosaic.height = (Y1 - Y0 + 1) * T;
  const mg = mosaic.getContext("2d")!;
  let ok = 0;
  const jobs: Promise<void>[] = [];
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++)
      jobs.push(
        new Promise((done) => {
          const im = new Image();
          im.crossOrigin = "anonymous";
          im.onload = () => {
            mg.drawImage(im, (x - X0) * T, (y - Y0) * T);
            ok++;
            done();
          };
          im.onerror = () => done();
          im.src = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z}/${y}/${x}`;
        }),
      );
  await Promise.all(jobs);
  if (!ok) throw new Error("imagery");
  const sx = (tx(lon0) - X0) * T;
  const sw = (tx(lon1) - tx(lon0)) * T;
  const W = Math.min(4096, Math.round(sw));
  const H = Math.min(4096, Math.round((W * ((lat1 - lat0) * mLat)) / ((lon1 - lon0) * mLon)));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const og = out.getContext("2d")!;
  /* мөр 0 = хойд зах (блокийн `uv` v=0) */
  for (let j = 0; j < H; j++) {
    const lat = lat1 - ((j + 0.5) / H) * (lat1 - lat0);
    const sy = (ty(lat) - Y0) * T;
    og.drawImage(mosaic, sx, sy, sw, 1, 0, j, W, 1);
  }
  return out;
}

function blobImage(b: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(b);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      resolve(im);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("зураг уншигдсангүй"));
    };
    im.src = url;
  });
}

/* ⚠ ЗУРГААС АВАХ БОЛОМЖГҮЙ ОНЦЛОГ: глейн зэв толбо, мөсөн линз,
   навчны үлдэгдэл. Хавтанцар ЗАЛГААСТАЙ байх ёстой тул дүрс бүрийг
   есөн хуулбараар (өөрийн байрлал + найман хөрш) зурна. */
function decorate(cls: string, g: CanvasRenderingContext2D) {
  const R = mulberry32([...cls].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7));
  const rr = (a: number, b: number) => a + R() * (b - a);
  const wrap = (fn: () => void) => {
    for (const ox of [-TILE_W, 0, TILE_W])
      for (const oy of [-TILE_H, 0, TILE_H]) {
        g.save();
        g.translate(ox, oy);
        fn();
        g.restore();
      }
  };
  if (cls === "Ag" || cls === "Bg")
    for (let i = 0; i < (cls === "Bg" ? 70 : 40); i++) {
      const x = R() * TILE_W, y = R() * TILE_H, r = rr(3, 12), a = rr(0, 3);
      wrap(() => {
        g.fillStyle = `rgba(${rr(170, 205) | 0},${rr(95, 125) | 0},40,${rr(0.3, 0.6)})`;
        g.beginPath();
        g.ellipse(x, y, r, r * rr(0.5, 0.9), a, 0, 7);
        g.fill();
      });
    }
  if (cls === "Cf")
    for (let i = 0; i < 26; i++) {
      const x = R() * TILE_W, y = R() * TILE_H, l = rr(60, 200), w = rr(1.5, 4.5);
      wrap(() => {
        g.strokeStyle = `rgba(235,245,255,${rr(0.55, 0.9)})`;
        g.lineWidth = w;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + l / 3, y + rr(-5, 5), x + (2 * l) / 3, y + rr(-5, 5), x + l, y + rr(-4, 4));
        g.stroke();
      });
    }
  if (cls === "O")
    for (let i = 0; i < 120; i++) {
      const x = R() * TILE_W, y = R() * TILE_H, r = rr(4, 11), a = rr(0, 3);
      const c = ["#6d4424", "#86552a", "#5a381c", "#9a6a36", "#4a3018"][(R() * 5) | 0];
      wrap(() => {
        g.fillStyle = "rgba(0,0,0,.35)";
        g.beginPath();
        g.ellipse(x + 1.5, y + 1.5, r, r * 0.35, a, 0, 7);
        g.fill();
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.35, a, 0, 7);
        g.fill();
      });
    }
}

