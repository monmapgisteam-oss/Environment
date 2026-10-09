/*
  ҮЕР БА НЭВЧИЛТ — хөрсний блок дээр үерийн ус, зүсэлтийн нүүрэнд бохирдлын шингээлт

  Хэрэглэгч 2026-10-09: "buur shine button neene … Хөрсний 3D блок дээр үерийн
  ус урсаж, зүссэн нүүрэнд бохирдол хөрс рүү шингэж буйг харуулна". Хоёр
  харагдацын хөдөлгүүрийг ХОЛБОНО, аль алиныг нь хөндөхгүй:
    · "Үерийн симуляци"-ийн GPU шийдэгч ({@link src/lib/flood/solver.js}) —
      ХОТ ДАЯАР (44 × 56 км) `CITY_F` коэффициентийн бүдүүн торонд
      ТОЛГОЙГҮЙ ажиллана;
    · "Хөрсний зүсэлт"-ийн SceneView ({@link src/lib/soil-scene.ts}) — блок,
      зүсэлтийн хэрэгсэл, таглаа, геометр (`geom`) хэвээр; энэ модуль ХОЁР
      нэмэлт давхарга өгнө (ус блокийн дээр, бохирдлын хөшиг нүүрэнд).

  ⚠⚠ УРСГАЛ "ЭХЛҮҮЛЭХ" ТОВЧООР (хэрэглэгч 2026-10-09: "zugeer oilgomjtoi
  ehluuleh geed towch baiy tgeed us ursaj bgaad bi duriin gazriig zusej
  harna"). Урьд нь зүсэлт хийхэд тэр ОРЧМЫН 3–6 км талбайд л тооцдог байв —
  бороо хаанаас эхлэхийг хэрэглэгч олсонгүй. Одоо `start()` хот даяар
  тооцож `NF` агшныг БҮХЭЛД нь хадгална (гүн, шингэсэн ус, усан дахь ба
  хөрсөн дэх масс); зүсэлт нь тооцоо ХИЙХГҮЙ — хадгалсан агшнуудаас тэр
  шугамын чийгийн фронтыг гаргаж хөшгийг зурна (`sectionFronts`). Тиймээс
  тооцоо явж байхад ч, тоглож байхад ч дурын газар зүсэж болно.
  ⚠ Хувилбар солиход ӨӨРӨӨ дахин тооцохгүй — товч дарна.

  ЮУ ТООЦДОГ ВЭ (CPU, шийдэгчийн гүн, урсацыг 4 алхам тутамд уншиж):
  1. ЭХ ҮҮСВЭР — нүхэн жорлон (порталын байршил, {@link fetchLatrineSim}).
     Ус нүхийг автахад (гүн > `WASH_H`) нүхний агуулга угаагдана: жорлон
     бүрийн нөөц азот = ам бүл × `N_PP` × `STOCK_YR` (хагас жилийн хуримтлал),
     угаалт нь `TAU` цагийн тогтмолтой нэгдүгээр эрэмбийн задрал.
     ⚠ Хоёулаа ТААМАГ (нүхний бодит дүүргэлт хэмжигдээгүй) — доод мөрөнд
     ил бичигдэнэ; эх сурвалж хэлбэл тогтмол хоёрыг л солино.
  2. ЗӨӨВӨРЛӨЛТ — усан дахь масс M нүүрний урсацаар (шийдэгчийн q, нээлттэй
     өргөн, сүвэрхэг хувь — FS_DEPTH-тэй ЯГ ижил эзэлхүүний тооцоо) салхин
     өөдөөс нүднээс нүдэнд шилжинэ; нэг интервалд гарах хувь 1-ээс
     хэтэрвэл масштаблана (масс хадгалагдана, диффуз нэмэгдэнэ).
  3. ШИНГЭЭЛТ — Хортоны шингээлт f (шийдэгчийн томьёо: f0, fc, k, хөрсний
     хадгалалт) усны гүний хэдэн хувь бол массын тэр хувь ХӨРС рүү (S);
     борооны шугам сүлжээний ус зайлуулалт (`DRAIN`) мөн тэр хувиар массыг
     АВЧ ЯВНА (тусдаа тоологдоно); хатаж буй нүдний масс хөрсөнд үлдэнэ.
     Шингэсэн усны ХУРИМТЛАЛ I агшин бүрд нүд тутамд хадгалагдана
     (`inf`, 0.1 мм) — фронт түүнээс.
  4. ЧИЙГИЙН ФРОНТ — зүсэлтийн шугамын 201 цэг тутамд, АГШИН хооронд:
     dz = min(ΔI / Δθ, Ks(z)·Δt / Δθ), Ks нь хөндлөн огтлолын (`Section`)
     тэр гүний үе давхаргын анги → Carsel–Parrish ({@link TEX}) — "Газрын
     доорх багана"-тай нэг хүснэгт. Бохирдол фронтын дотор гүнээр буурч
     будагдана.

  ⚠⚠ ЭНЭ БОЛ ОЙРОЛЦОО ЗАГВАР, хэмжилт биш: азот задрахгүй (дээд хязгаар),
  зөөвөрлөлт нь шийдэгчийн алхмаас сийрэг, фронт нь нэг хэмжээст.
  ⚠⚠ ТОР БҮДҮҮН (`CITY_F` × 10 м): хот даяар 2 сая нүдийг хөтчийн CPU-ээр
  4 алхам тутамд уншиж чадахгүй, агшин бүрийн хадгалалт ч хэдэн зуун МБ
  болно. 60 м тор нь блокийн масштабад (1:364 000) уншигдана, харин
  нарийн гудамж, суваг ЭНД ХАРАГДАХГҮЙ — тэр нь "Үерийн симуляци"-ийнх.
  ⚠ Масс хоёр (усан дахь, хөрсөн дэх) агшин бүрд СИЙРЭГ хадгалагдана
  (индекс + утга) — бохирдолтой нүд хотын торын багахан хэсэг.
  ⚠ Хугацаа = бороо + 1 цаг, доод тал нь 3 цаг; `NF` агшин.
  ⚠ Усны гүн БОДИТ масштабаар (өсгөлтгүй) блокийн дээр 2.5 м-т — өнгө нь
  гүн ("Усны гүн" шатлал, `depthCol`-той ижил), бохирдолтой ус улбар шар
  руу (азотын шатлал `RN3`) хазайна.
*/
import { FloodSolver } from "@/lib/flood/solver.js";
import { createSolverGL, loadFloodData } from "@/lib/flood/data.js";
import { N_PP, TEX, fetchLatrineSim, type SimData } from "@/lib/latrine-sim";
import { RN3, rampC } from "@/lib/latrine-sim-3d";
import type { Section } from "@/lib/soil-scene";

type Pt = [number, number];

export type FloodPreset = { id: string; name: string; i: number; d: number; shape: "uniform" | "tri" | "front"; note: string };
/** Борооны хувилбар — "Үерийн симуляци"-ийн `PRESETS`-ийн утгууд (шингээлттэй, хуурай хөрс) */
export const FLOOD_PRESETS: FloodPreset[] = [
  { id: "ref", name: "Жишиг", i: 40, d: 60, shape: "uniform", note: "40 мм/ц · 1 цаг · тэгш" },
  { id: "strong", name: "Хүчтэй", i: 50, d: 45, shape: "tri", note: "50 мм/ц · 45 мин · оргилтой" },
  { id: "extreme", name: "Онц хүчтэй", i: 80, d: 60, shape: "front", note: "80 мм/ц · 1 цаг · эхэндээ хүчтэй" },
  { id: "slow", name: "Удаан", i: 6, d: 720, shape: "uniform", note: "6 мм/ц · 12 цаг · тэгш" },
];

/** Хадгалах агшны тоо */
export const NF = 48;
/** Хотын торын коэффициент: нүд = 15 м Mercator × F × 0.668 ≈ 10·F м газар (solver.js F ≤ 8) */
const CITY_F = 6;
/** Шингэсэн усны хуримтлалын нэгж, м (0.1 мм — Uint16 нь 6.5 м хүртэл) */
const INF_UNIT = 1e-4;
/** Нүх автах гүн, м */
const WASH_H = 0.1;
/** Нүхний нөөц — хэдэн жилийн азот хуримтлагдсан гэж үзэх */
export const STOCK_YR = 0.5;
/** Угаалтын цагийн тогтмол, с */
const TAU = 1200;
/** Хортоны задралын тогтмол (аппын анхдагч), 1/с */
const HORTON_K = 2 / 3600;
/** Борооны шугам сүлжээ, мм/ц (аппын анхдагч) */
const DRAIN = 10;
/** Чийгийн фронтын дүүрэх сүв (θs − θ0) */
const DTHETA = 0.3;
/** Усны давхаргын өндөр блокийн дээд гадаргаас, м */
const WATER_LIFT = 2.5;
/** Бохирдлын хөшиг таглаанаас хасагдсан тал руу, м (жорлонгийн тархалт 0.9) */
const SEEP_OFF = 1.2;
const DEPTH_CM = 200;
/** Усны меш — ≤ MESH_MAX × MESH_MAX орой (бүтэц нь торын нарийвчлалтай); хот даяар ~240 м-ийн орой */
const MESH_MAX = 320;
const R_EARTH = 6378137;

/**
 * Үе давхаргын анги → Carsel–Parrish бүтцийн анги ({@link TEX}): чийгийн
 * фронтын хурдыг хязгаарлах Ks. ⚠ Ойролцоолол — профайлын бичиглэлд
 * механик бүрэлдэхүүн байхгүй тул генетик үеэс ангийг таана
 * ("Газрын доорх багана"-ын `PROFILE_HZ` хэмжилттэй гурван профайлд л).
 * Карбонат (Bk), глей (Bg, Cg) нь нягт тул удаан; цэвдэг (⊥C), хад (R)
 * бараг нэвчихгүй; элсэрхэг сайр (C, C/R) хурдан.
 */
const KS_CLASS: Record<string, keyof typeof TEX> = {
  O: "lsand", T: "sloam", A: "sloam", A2: "loam", Ag: "cloam", Bw: "loam", Bk: "sil", Bg: "sicl", Bgk: "sicl", Bf: "loam",
  C: "sand", CR: "lsand", Cg: "sc", Cgk: "sc",
};
/** м/өдөр — хүснэгтэд байхгүй хоёр нь бараг нэвчихгүй */
const KS_FIXED: Record<string, number> = { Cf: 0.001, R: 0.005 };
const ksOf = (cls: string) => {
  const k = cls.split(/[_>]/)[0];
  return KS_FIXED[k] ?? TEX[KS_CLASS[k] ?? "loam"].Ks;
};

export type FrameStats = {
  /** Усанд автсан талбай (гүн > 2 см), га */
  wetHa: number;
  /** Энэ агшинд автсан нүхэн жорлон */
  flooded: number;
  /** Угаагдсан азот, кг (хуримтлал) */
  washed: number;
  inWater: number;
  inSoil: number;
  drained: number;
  /** Тооцооны талбайн ирмэгээр урсаж гарсан, кг */
  left: number;
  hmax: number;
  /** Чийгийн фронтын хамгийн их гүн зүсэлт дээр, м */
  frontMax: number;
};

/** Нэг агшин: гүн (см), шингэсэн ус (0.1 мм), масс СИЙРЭГ (`idx` → `mw`, `ms`), зүсэлтийн фронт (зүсэлт бүрд дахин бодогдоно) */
type Frame = { t: number; h: Uint16Array; inf: Uint16Array; idx: Int32Array; mw: Float32Array; ms: Float32Array; front: Float32Array; stats: FrameStats };

export type SoilFloodState = {
  phase: "idle" | "loading" | "running" | "ready" | "error";
  message: string;
  /** Тооцооны явц 0…1 */
  progress: number;
  area: { kmW: number; kmH: number; w: number; h: number; dx: number; latrines: number; people: number } | null;
  frames: number;
  /** Симуляцийн хугацаа, с */
  tEnd: number;
  preset: string;
  /** Одоогийн агшин */
  frame: number;
  stats: FrameStats | null;
  /** Жорлонгийн багц ирсэнгүй — ус л тооцогдоно */
  noLatrines: boolean;
  /** Зүсэлт байгаа ба хадгалсан агшнуудад тэр шугам дээр нүд олдсон */
  cutOn: boolean;
};

type GLayer = { removeAll: () => void; add: (g: unknown) => void };
type Deps = {
  Mesh: new (p?: object) => unknown;
  MeshComponent: new (p?: object) => unknown;
  MeshMaterial: new (p?: object) => unknown;
  MeshTexture: new (p?: object) => unknown;
  Graphic: new (p?: object) => unknown;
  waterL: GLayer;
  seepL: GLayer;
  geom: {
    zAt: (lon: number, lat: number) => number;
    validAt: (lon: number, lat: number) => boolean;
    exs: () => number;
    mLon: number;
    mLat: number;
    SR: object;
  };
  onState: (s: SoilFloodState) => void;
};

type FloodData = Awaited<ReturnType<typeof loadFloodData>>;
type Meta = { x0: number; y1: number; res: number; W: number; H: number; groundScale: number };
type Solver = {
  W: number;
  H: number;
  dx: number;
  cellMerc: number;
  x0: number;
  y1: number;
  t: number;
  steps: number;
  stats: { hmax: number; vol: number; wet: number; vmax: number };
  suggestDt: () => number;
  step: (dt: number, f: object) => void;
  reduce: () => void;
  readTex: (w: string, out?: Float32Array | null) => Float32Array;
  dispose: () => void;
};

const merc = (p: Pt): Pt => [(p[0] * Math.PI * R_EARTH) / 180, Math.log(Math.tan(Math.PI / 4 + (p[1] * Math.PI) / 360)) * R_EARTH];
const unmerc = (x: number, y: number): Pt => [(x / R_EARTH) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / R_EARTH)) - Math.PI / 2) * (180 / Math.PI)];

/** Усны гүний өнгө — renderer.js-ийн `depthCol`-той ижил шат, тэнхлэг */
function depthCol(d: number): [number, number, number] {
  const S = [
    [0, 0.62, 0.92, 1.0],
    [0.3, 0.25, 0.68, 1.0],
    [1, 0.08, 0.4, 0.9],
    [2, 0.05, 0.18, 0.65],
    [4, 0.22, 0.05, 0.45],
  ];
  let k = 0;
  while (k < S.length - 2 && d > S[k + 1][0]) k++;
  const a = S[k];
  const b = S[k + 1];
  const f = Math.max(0, Math.min(1, (d - a[0]) / (b[0] - a[0])));
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}

export function createSoilFlood(dep: Deps) {
  const { geom } = dep;
  let dataP: Promise<FloodData> | null = null;
  let lat: SimData | null = null;
  let latFailed = false;
  /* ⚠ Тооцоо багцыг ХҮЛЭЭНЭ: эхний зүсэлт порталын 73 хуудас ирэхээс өмнө
     хийгдвэл жорлонгүй тооцогдож "бохирдол 0" гэж худал гарч байв */
  const latP = fetchLatrineSim().then(
    (d) => {
      lat = d;
      return d;
    },
    (e: unknown) => {
      latFailed = true;
      console.warn("soil-flood: нүхэн жорлонгийн багц ирсэнгүй —", e instanceof Error ? e.message : e);
      emit({ noLatrines: true });
      return null;
    },
  );
  let gl: WebGL2RenderingContext | null = null;
  let gen = 0;
  let cut: { a: Pt; b: Pt; rem: number } | null = null;
  let section: Section | null = null;
  let preset = FLOOD_PRESETS[0];
  let frames: Frame[] = [];
  let cur = 0;
  let msMax = 1;
  /* Сүүлийн тооцооны тор — зурахад */
  let grid: { W: number; H: number; x0: number; y1: number; cellMerc: number; dx: number; pc: Float32Array; valid: Uint8Array } | null = null;
  let sampleCell: Int32Array | null = null;
  let waterMesh: { pos: Float64Array; uv: Float32Array; faces: Uint32Array } | null = null;
  const st: SoilFloodState = {
    phase: "idle", message: "", progress: 0, area: null, frames: 0, tEnd: 0, preset: preset.id, frame: 0, stats: null, noLatrines: false, cutOn: false,
  };
  const emit = (p: Partial<SoilFloodState>) => {
    Object.assign(st, p);
    dep.onState({ ...st });
  };

  function preload() {
    dataP ??= loadFloodData();
    return dataP;
  }

  /** Хот даяар тооцно — "Эхлүүлэх" товч */
  async function start() {
    const my = ++gen;
    /* Хувилбарыг ЭХЛЭХ мөчид нь тогтооно — тооцоо явж байхад солиход борооны хэлбэр дундуураа өөрчлөгдөхгүй */
    const pr = preset;
    emit({ phase: "loading", message: "Үерийн өгөгдөл ачаалж байна", progress: 0, frames: 0, stats: null, frame: 0 });
    let d: FloodData;
    try {
      d = await preload();
      if (!lat) {
        emit({ message: "Нүхэн жорлонгийн мэдээлэл ачаалж байна" });
        await latP;
        /* ⚠ Нэг удаа ДАХИН оролдоно: порталын 73 хуудасны нэг нь түр унавал
           бүх багц унадаг (`fetchLatrineSim` амлалтаа цэвэрлэдэг тул шинэ
           дуудлага шинээр татна) */
        if (!lat) lat = await fetchLatrineSim().catch(() => null);
        if (lat) latFailed = false;
      }
    } catch (e) {
      if (my === gen) emit({ phase: "error", message: (e as Error).message });
      return;
    }
    if (my !== gen) return;
    const m = d.meta as Meta;
    try {
      gl ??= createSolverGL();
    } catch (e) {
      emit({ phase: "error", message: (e as Error).message });
      return;
    }
    const s = new FloodSolver(gl, d, { factor: CITY_F, buildings: true }) as unknown as Solver;
    const { W, H, dx } = s;
    const N = W * H;
    /* ── тогтмол талбарууд ── */
    const P = s.readTex("p");
    const GR = s.readTex("gr");
    const WF = s.readTex("wf");
    const pc = new Float32Array(N);
    const solid = new Uint8Array(N);
    const f0 = new Float32Array(N);
    const fc = new Float32Array(N);
    const stor = new Float32Array(N);
    const urban = new Float32Array(N);
    const we = new Float32Array(N);
    const ws = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const frac = P[k * 4 + 3];
      pc[k] = frac >= 0.8 ? 1 : Math.max(1 - frac, 0.2);
      solid[k] = frac >= 0.8 ? 1 : 0;
      f0[k] = P[k * 4 + 1];
      fc[k] = P[k * 4 + 2];
      stor[k] = GR[k * 4 + 3];
      urban[k] = GR[k * 4 + 1];
      const x = k % W;
      const y = (k - x) / W;
      we[k] = x < W - 1 ? Math.min(WF[k * 4], pc[k]) : pc[k];
      ws[k] = y < H - 1 ? Math.min(WF[k * 4 + 1], pc[k]) : pc[k];
    }
    /* нүд блок дотор эсэх (хотын тор блокоос гадуур гарч болно) */
    const valid = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      const x = k % W;
      const y = (k - x) / W;
      const [lo, la] = unmerc(s.x0 + (x + 0.5) * s.cellMerc, s.y1 - (y + 0.5) * s.cellMerc);
      valid[k] = geom.validAt(lo, la) ? 1 : 0;
    }
    /* ── жорлон: нүд тутмын тоо ба азотын нөөц ── */
    const latN = new Uint16Array(N);
    const stock = new Float32Array(N);
    let latCount = 0;
    let people = 0;
    if (lat) {
      for (let i = 0; i < lat.n; i++) {
        const lo = lat.lon[i];
        if (!Number.isFinite(lo)) continue;
        const [X, Y] = merc([lo, lat.lat[i]]);
        const cx = Math.floor((X - s.x0) / s.cellMerc);
        const cy = Math.floor((s.y1 - Y) / s.cellMerc);
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
        const k = cy * W + cx;
        latN[k]++;
        const hh = lat.hh[i] / 10;
        stock[k] += hh * N_PP * STOCK_YR;
        latCount++;
        people += hh;
      }
    }
    grid = { W, H, x0: s.x0, y1: s.y1, cellMerc: s.cellMerc, dx, pc, valid };
    waterMesh = null;
    frames = [];
    cur = 0;
    sampleCell = null;
    const tEnd = Math.max(3, pr.d / 60 + 1) * 3600;
    emit({
      phase: "running",
      message: "",
      progress: 0,
      tEnd,
      frames: 0,
      preset: pr.id,
      noLatrines: !lat,
      cutOn: false,
      area: { kmW: (m.W * m.res * m.groundScale) / 1000, kmH: (m.H * m.res * m.groundScale) / 1000, w: W, h: H, dx, latrines: latCount, people: Math.round(people) },
    });
    clearLayers();

    /* ── төлөв ── */
    const Mw = new Float32Array(N);
    const Ms = new Float32Array(N);
    const rem = Float32Array.from(stock);
    const I = new Float32Array(N); // шингэсэн усны хуримтлал, м
    const Mn = new Float32Array(N);
    const fE = new Float32Array(N);
    const fS = new Float32Array(N);
    let Hh: Float32Array = new Float32Array(N * 4);
    let Q: Float32Array = new Float32Array(N * 4);
    let washed = 0;
    let drained = 0;
    let left = 0;
    let wetMM = 0; // хуримтлагдсан бороо, мм (хөрсний ханалт)
    let tRead = 0;
    const rate = (t: number) => {
      const D = pr.d * 60;
      if (t >= D) return 0;
      let mmh = pr.i;
      if (pr.shape === "tri") {
        const tp = 0.35 * D;
        mmh = t < tp ? (2 * pr.i * t) / tp : (2 * pr.i * (D - t)) / (D - tp);
      } else if (pr.shape === "front") mmh = 2 * pr.i * (1 - t / D);
      return mmh / 3.6e6;
    };
    const forcing = (t: number) => ({
      rain: rate(t), rainArea: N * dx * dx, circle: [0, 0, 0, 0], inflows: [] as number[][], infMul: 1, hortonK: HORTON_K, tr: t,
      wet: wetMM, manning: 1, theta: 0.8, drain: DRAIN, wallE: [1, 0],
    });

    /** Шийдэгчийн төлөвийг уншиж бохирдлыг `dt` секундээр урагшлуулна */
    const transport = (dt: number, t: number): FrameStats => {
      Hh = s.readTex("h", Hh);
      Q = s.readTex("q", Q);
      fE.fill(0);
      fS.fill(0);
      /* 1. эх үүсвэр — автсан нүх угаагдана */
      const g1 = 1 - Math.exp(-dt / TAU);
      let flooded = 0;
      for (let k = 0; k < N; k++) {
        if (!latN[k]) continue;
        if (Hh[k * 4] > WASH_H) {
          flooded += latN[k];
          const r = rem[k] * g1;
          rem[k] -= r;
          Mw[k] += r;
          washed += r;
        }
      }
      /* 2. зөөвөрлөлт — нүүр бүрийн эзэлхүүний хувь, дараа нь масштаблаж шилжүүлнэ */
      for (let k = 0; k < N; k++) {
        const x = k % W;
        const y = (k - x) / W;
        const qx = Q[k * 4];
        const qy = Q[k * 4 + 1];
        if (qx !== 0) {
          const vol = we[k] * qx * dx * dt;
          if (vol > 0) {
            const h = Hh[k * 4];
            if (h > 1e-4 && Mw[k] > 0) fE[k] = Math.min(1, vol / (h * dx * dx * pc[k]));
          } else if (x < W - 1) {
            const j = k + 1;
            const h = Hh[j * 4];
            if (h > 1e-4 && Mw[j] > 0) fE[k] = -Math.min(1, -vol / (h * dx * dx * pc[j]));
          }
        }
        if (qy !== 0) {
          const vol = ws[k] * qy * dx * dt;
          if (vol > 0) {
            const h = Hh[k * 4];
            if (h > 1e-4 && Mw[k] > 0) fS[k] = Math.min(1, vol / (h * dx * dx * pc[k]));
          } else if (y < H - 1) {
            const j = k + W;
            const h = Hh[j * 4];
            if (h > 1e-4 && Mw[j] > 0) fS[k] = -Math.min(1, -vol / (h * dx * dx * pc[j]));
          }
        }
      }
      /* нүд тутмын гарах нийт хувь → масштаб */
      Mn.set(Mw);
      for (let k = 0; k < N; k++) {
        if (Mw[k] <= 0) continue;
        const x = k % W;
        const y = (k - x) / W;
        let out = 0;
        if (fE[k] > 0) out += fE[k];
        if (fS[k] > 0) out += fS[k];
        if (x > 0 && fE[k - 1] < 0) out -= fE[k - 1];
        if (y > 0 && fS[k - W] < 0) out -= fS[k - W];
        if (out <= 0) continue;
        const sc = Math.min(1, 1 / out);
        const give = (frac: number, to: number) => {
          const mm = Mw[k] * frac * sc;
          Mn[k] -= mm;
          if (to >= 0) Mn[to] += mm;
          else left += mm;
        };
        if (fE[k] > 0) give(fE[k], x < W - 1 ? k + 1 : -1);
        if (fS[k] > 0) give(fS[k], y < H - 1 ? k + W : -1);
        if (x > 0 && fE[k - 1] < 0) give(-fE[k - 1], k - 1);
        if (y > 0 && fS[k - W] < 0) give(-fS[k - W], k - W);
      }
      /* 3. шингээлт, ус зайлуулалт, хатах */
      const eK = Math.exp(-HORTON_K * t);
      const capMul = (fc0: number, f00: number) => (fc0 * t + ((f00 - fc0) * (1 - eK)) / HORTON_K) / 3600;
      let hmax = 0;
      let wet = 0;
      let inWater = 0;
      let inSoil = 0;
      for (let k = 0; k < N; k++) {
        const h = Hh[k * 4];
        if (h > hmax) hmax = h;
        if (h > 0.02) wet++;
        let mm = Mn[k];
        if (h <= 1e-4) {
          if (mm > 0) {
            Ms[k] += mm;
            mm = 0;
          }
          Mw[k] = mm;
        } else if (solid[k]) {
          Mw[k] = mm;
        } else {
          let f = (fc[k] + (f0[k] - fc[k]) * eK) / 3.6e6;
          if (stor[k] > 0) {
            const u = Math.max(0, Math.min(1, (Math.min(wetMM, capMul(fc[k], f0[k])) / stor[k] - 0.7) / 0.3));
            f *= 1 - 0.9 * u * u * (3 - 2 * u);
          }
          const dI = Math.min(f * dt, h);
          I[k] += dI;
          const fd = Math.min(((DRAIN / 3.6e6) * urban[k] * dt) / h, 1 - dI / h);
          const toSoil = mm * (dI / h);
          const toDrain = mm * fd;
          Ms[k] += toSoil;
          drained += toDrain;
          Mw[k] = mm - toSoil - toDrain;
        }
        inWater += Mw[k];
        inSoil += Ms[k];
      }
      return { wetHa: (wet * dx * dx) / 1e4, flooded, washed, inWater, inSoil, drained, left, hmax, frontMax: 0 };
    };

    const snap = (t: number, stats: FrameStats) => {
      const h = new Uint16Array(N);
      const inf = new Uint16Array(N);
      let n = 0;
      for (let k = 0; k < N; k++) {
        h[k] = Math.min(65535, Math.round(Hh[k * 4] * 100));
        inf[k] = Math.min(65535, Math.round(I[k] / INF_UNIT));
        if (Mw[k] > 0 || Ms[k] > 0) n++;
      }
      const idx = new Int32Array(n);
      const mw = new Float32Array(n);
      const ms = new Float32Array(n);
      let j = 0;
      for (let k = 0; k < N; k++) {
        if (Mw[k] > 0 || Ms[k] > 0) {
          idx[j] = k;
          mw[j] = Mw[k];
          ms[j] = Ms[k];
          j++;
        }
      }
      frames.push({ t, h, inf, idx, mw, ms, front: new Float32Array(0), stats });
    };

    /* ── давталт: 30 мс-ийн багцаар, дунд нь хүрээ өгнө ── */
    const frameDt = tEnd / NF;
    let nextFrame = frameDt;
    const tStart = performance.now();
    let last: FrameStats | null = null;
    try {
      while (s.t < tEnd) {
        const t0 = performance.now();
        while (performance.now() - t0 < 30 && s.t < tEnd) {
          if (s.steps % 10 === 0) s.reduce();
          const dt = Math.min(s.suggestDt(), tEnd - s.t + 1e-3, nextFrame - s.t + 1e-3);
          const f = forcing(s.t);
          s.step(dt, f);
          wetMM += f.rain * dt * 1000;
          if (s.steps % 4 === 0 || s.t >= nextFrame - 1e-3) {
            last = transport(s.t - tRead, s.t);
            tRead = s.t;
          }
          if (s.t >= nextFrame - 1e-3) {
            if (!last) last = transport(0, s.t);
            snap(s.t, last);
            nextFrame += frameDt;
          }
        }
        emit({ progress: Math.min(1, s.t / tEnd), frames: frames.length });
        await new Promise((r) => setTimeout(r, 0));
        if (my !== gen) {
          s.dispose();
          return;
        }
      }
    } catch (e) {
      s.dispose();
      if (my === gen) emit({ phase: "error", message: (e as Error).message });
      return;
    }
    s.dispose();
    const bytes = frames.reduce((a, f) => a + f.h.byteLength + f.inf.byteLength + f.idx.byteLength + f.mw.byteLength + f.ms.byteLength, 0);
    console.warn(`soil-flood: ${W}×${H} тор (${dx.toFixed(0)} м), ${s.steps} алхам, ${frames.length} агшин, ${Math.round(performance.now() - tStart)} мс, агшнууд ${(bytes / 1e6).toFixed(0)} МБ`);
    msMax = 0;
    for (let k = 0; k < N; k++) if (Ms[k] > msMax) msMax = Ms[k];
    msMax = Math.max(msMax, 1e-3);
    cur = 0;
    sectionFronts();
    emit({ phase: "ready", progress: 1, frames: frames.length, frame: 0, stats: frames[0]?.stats ?? null });
    paint();
  }

  /**
   * Зүсэлтийн шугамын цэг бүрийн чийгийн фронт агшин бүрд — хадгалсан
   * шингээлтийн хуримтлалаас (`inf`), тэр цэгийн үе давхаргын Ks(z)-ээр.
   * Зүсэлт солигдох бүрд дахин бодогдоно; тооцоо явж байхад зүсвэл дуусмагц.
   */
  function sectionFronts() {
    const sec = section;
    if (!cut || !sec || !grid || !frames.length) {
      sampleCell = null;
      if (frames.length) for (const fr of frames) fr.stats.frontMax = 0;
      emit({ cutOn: false, stats: frames[cur]?.stats ?? st.stats });
      return;
    }
    const { W, H, x0, y1, cellMerc } = grid;
    const nS = sec.samples.length;
    const sCell = new Int32Array(nS).fill(-1);
    const sKs: ((z: number) => number)[] = [];
    let hit = 0;
    sec.samples.forEach((p, i) => {
      if (p.elev == null) return;
      const [X, Y] = merc([p.lon, p.lat]);
      const cx = Math.floor((X - x0) / cellMerc);
      const cy = Math.floor((y1 - Y) / cellMerc);
      if (cx >= 0 && cy >= 0 && cx < W && cy < H) {
        sCell[i] = cy * W + cx;
        hit++;
      }
    });
    /* Ks(z) — тэр цэгийн үе давхаргуудаар (см зузаан, дээрээс доош) */
    for (let i = 0; i < nS; i++) {
      const T = sec.samples[i].T;
      if (!T) {
        sKs.push(() => TEX.loam.Ks);
        continue;
      }
      const bounds: [number, number][] = [];
      let top = 0;
      T.forEach((th, k) => {
        if (th > 0.01) bounds.push([top + th, ksOf(sec.keys[k])]);
        top += th;
      });
      sKs.push((z) => {
        const cm = z * 100;
        for (const [b, ks] of bounds) if (cm < b) return ks;
        return bounds.length ? bounds[bounds.length - 1][1] : TEX.loam.Ks;
      });
    }
    sampleCell = sCell;
    const front = new Float32Array(nS);
    let tPrev = 0;
    let prev: Uint16Array | null = null;
    for (const fr of frames) {
      const dt = fr.t - tPrev;
      let frontMax = 0;
      for (let i = 0; i < nS; i++) {
        const k = sCell[i];
        if (k < 0) continue;
        const dI = (fr.inf[k] - (prev ? prev[k] : 0)) * INF_UNIT;
        if (dI > 0) {
          const ks = sKs[i](front[i]);
          front[i] = Math.min(DEPTH_CM / 100, front[i] + Math.min(dI / DTHETA, (ks * dt) / 86400 / DTHETA));
        }
        if (front[i] > frontMax) frontMax = front[i];
      }
      fr.front = Float32Array.from(front);
      fr.stats.frontMax = frontMax;
      prev = fr.inf;
      tPrev = fr.t;
    }
    emit({ cutOn: hit > 0, stats: frames[cur]?.stats ?? null });
  }

  function clearLayers() {
    dep.waterL.removeAll();
    dep.seepL.removeAll();
  }

  /** Усны меш — блокийн дээд гадарга дээр, нэг л удаа */
  function buildWaterMesh() {
    if (!grid) return null;
    const { W, H } = grid;
    const k = Math.max(1, Math.ceil(Math.max(W, H) / MESH_MAX));
    const cols: number[] = [];
    for (let x = 0; x < W; x += k) cols.push(x);
    cols.push(W);
    const rows: number[] = [];
    for (let y = 0; y < H; y += k) rows.push(y);
    rows.push(H);
    const pos: number[] = [];
    const uv: number[] = [];
    for (const y of rows)
      for (const x of cols) {
        const [lo, la] = unmerc(grid.x0 + x * grid.cellMerc, grid.y1 - y * grid.cellMerc);
        pos.push(lo, la, geom.zAt(lo, la) + WATER_LIFT);
        uv.push(x / W, y / H);
      }
    const faces: number[] = [];
    const nc = cols.length;
    for (let r = 0; r < rows.length - 1; r++)
      for (let c = 0; c < nc - 1; c++) {
        const a = r * nc + c;
        faces.push(a, a + 1, a + nc + 1, a, a + nc + 1, a + nc);
      }
    return { pos: new Float64Array(pos), uv: new Float32Array(uv), faces: new Uint32Array(faces) };
  }

  const addMesh = (layer: GLayer, pos: Float64Array, uv: Float32Array, faces: Uint32Array, canvas: HTMLCanvasElement) => {
    const mesh = new dep.Mesh({
      spatialReference: geom.SR,
      vertexAttributes: { position: pos, uv },
      components: [
        new dep.MeshComponent({
          faces,
          material: new dep.MeshMaterial({ colorTexture: new dep.MeshTexture({ data: canvas }), alphaMode: "blend", doubleSided: true }),
        }),
      ],
    });
    layer.add(new dep.Graphic({ geometry: mesh, symbol: { type: "mesh-3d", symbolLayers: [{ type: "fill", material: { color: [255, 255, 255, 1] } }] } }));
  };

  /* Сийрэг массыг нүд тутмын буфер болгох — зурахад л, дахин ашиглана */
  let mwBuf: Float32Array | null = null;
  let msBuf: Float32Array | null = null;
  const dense = (fr: Frame, N: number) => {
    if (!mwBuf || mwBuf.length !== N) {
      mwBuf = new Float32Array(N);
      msBuf = new Float32Array(N);
    } else {
      mwBuf.fill(0);
      msBuf!.fill(0);
    }
    for (let j = 0; j < fr.idx.length; j++) {
      mwBuf[fr.idx[j]] = fr.mw[j];
      msBuf![fr.idx[j]] = fr.ms[j];
    }
    return { mw: mwBuf, ms: msBuf! };
  };

  function paint() {
    clearLayers();
    const fr = frames[cur];
    if (!fr || !grid) return;
    const { W, H, dx, pc, valid } = grid;
    const { mw, ms } = dense(fr, W * H);
    /* ── ус блокийн дээр ── */
    waterMesh ??= buildWaterMesh();
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const px = img.data;
    for (let k = 0; k < W * H; k++) {
      const h = fr.h[k] / 100;
      if (h < 0.02 || !valid[k]) continue;
      let [r, g, b] = depthCol(h);
      /* бохирдолтой ус — азотын шатлал руу хазайна (агууламж мг/л, лог) */
      const mg = (mw[k] * 1e3) / (h * dx * dx * pc[k]);
      if (mg > 0.5) {
        const w = Math.min(0.85, Math.log10(1 + mg) / 2.5);
        const c = rampC(RN3, Math.min(1, Math.log10(1 + mg) / 3));
        r = r * (1 - w) + (c[0] / 255) * w;
        g = g * (1 - w) + (c[1] / 255) * w;
        b = b * (1 - w) + (c[2] / 255) * w;
      }
      const p = k * 4;
      px[p] = Math.round(r * 255);
      px[p + 1] = Math.round(g * 255);
      px[p + 2] = Math.round(b * 255);
      px[p + 3] = Math.round(255 * (0.62 + 0.33 * Math.min(1, h / 1.5)));
    }
    ctx.putImageData(img, 0, 0);
    if (waterMesh) addMesh(dep.waterL, waterMesh.pos, waterMesh.uv, waterMesh.faces, cv);

    /* ── бохирдлын хөшиг зүсэлтийн нүүрэнд ── */
    const sec = section;
    if (!cut || !sec || !sampleCell || fr.front.length !== sec.samples.length) return;
    const n = sec.samples.length;
    const TW = 512;
    const TH = 128;
    const tc = document.createElement("canvas");
    tc.width = TW;
    tc.height = TH;
    const tctx = tc.getContext("2d")!;
    const timg = tctx.createImageData(TW, TH);
    const tp = timg.data;
    let any = false;
    for (let u = 0; u < TW; u++) {
      const i = Math.min(n - 1, Math.round((u / (TW - 1)) * (n - 1)));
      const k = sampleCell[i];
      const z = fr.front[i];
      if (k < 0 || z <= 0) continue;
      const m = ms[k];
      const a = m > 0 ? Math.log10(1 + m / 0.05) / Math.log10(1 + msMax / 0.05) : 0;
      const c = rampC(RN3, Math.min(1, a));
      const vF = Math.min(TH - 1, Math.floor((z / (DEPTH_CM / 100)) * TH));
      for (let v = 0; v < TH; v++) {
        const zz = ((v + 0.5) / TH) * (DEPTH_CM / 100);
        if (zz >= z && v !== vF) break;
        any = true;
        const fall = Math.exp(-zz / Math.max(0.05, 0.5 * z));
        const p = (v * TW + u) * 4;
        if (v === vF) {
          /* фронтын шугам — бараан ирмэг */
          tp[p] = 40;
          tp[p + 1] = 60;
          tp[p + 2] = 90;
          tp[p + 3] = 200;
        } else if (a > 0.02) {
          tp[p] = c[0];
          tp[p + 1] = c[1];
          tp[p + 2] = c[2];
          tp[p + 3] = Math.round(255 * (0.35 + 0.6 * a * fall));
        } else {
          /* цэвэр ус шингэсэн — чийгийн фронт, цэнхэр туяа */
          tp[p] = 110;
          tp[p + 1] = 165;
          tp[p + 2] = 230;
          tp[p + 3] = Math.round(255 * 0.4 * (0.5 + 0.5 * fall));
        }
      }
    }
    if (!any) return;
    tctx.putImageData(timg, 0, 0);
    const rr = (cut.rem * Math.PI) / 180;
    const ox = (Math.sin(rr) * SEEP_OFF) / geom.mLon;
    const oy = (Math.cos(rr) * SEEP_OFF) / geom.mLat;
    const e = geom.exs();
    const pos: number[] = [];
    const uv: number[] = [];
    const faces: number[] = [];
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const p = sec.samples[i];
      if (p.elev == null) {
        prev = -1;
        continue;
      }
      const lo = p.lon + ox;
      const la = p.lat + oy;
      const top = geom.zAt(p.lon, p.lat);
      const base = pos.length / 3;
      pos.push(lo, la, top, lo, la, top - DEPTH_CM * e);
      const u = i / (n - 1);
      uv.push(u, 0, u, 1);
      if (prev >= 0) faces.push(prev, prev + 1, base + 1, prev, base + 1, base);
      prev = base;
    }
    if (faces.length) addMesh(dep.seepL, new Float64Array(pos), new Float32Array(uv), new Uint32Array(faces), tc);
  }

  return {
    /** "Эхлүүлэх" — хот даяар, сонгосон хувилбараар; явж байсан тооцоог орлоно */
    start() {
      void start();
    },
    /** Зүсэлт солигдсон (шулуун) эсвэл арилсан — хөндлөн огтлол хамт ирнэ. Тооцоо ХИЙХГҮЙ, хадгалсан агшнуудаас хөшгийг зурна */
    setCut(c: { a: Pt; b: Pt; rem: number } | null, sec: Section | null) {
      section = sec;
      /* Зөвхөн тал солигдсон — фронт хэвээр, хөшгийг эргүүлнэ */
      const same = !!c && !!cut && cut.a[0] === c.a[0] && cut.a[1] === c.a[1] && cut.b[0] === c.b[0] && cut.b[1] === c.b[1];
      cut = c;
      if (!same) sectionFronts();
      if (frames.length) paint();
    },
    setPreset(id: string) {
      const p = FLOOD_PRESETS.find((x) => x.id === id);
      if (!p || p === preset) return;
      preset = p;
      emit({ preset: id });
    },
    setTime(i: number) {
      if (!frames.length) return;
      cur = Math.max(0, Math.min(frames.length - 1, i));
      emit({ frame: cur, stats: frames[cur].stats });
      paint();
    },
    preload,
    latrinesFailed: () => latFailed,
    destroy() {
      gen++;
      clearLayers();
      frames = [];
      (gl?.getExtension("WEBGL_lose_context") as { loseContext: () => void } | null)?.loseContext();
      gl = null;
    },
  };
}

export type SoilFlood = ReturnType<typeof createSoilFlood>;
