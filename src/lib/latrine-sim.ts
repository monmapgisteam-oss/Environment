/*
  НҮХЭН ЖОРЛОНГИЙН НЭВЧИЛТИЙН СИМУЛЯЦИ — өгөгдөл ба загвар

  Эх сурвалж: `I:/Environment/us_hurs/leaching/UB_latrine_leaching_sim.html`
  (хэрэглэгч 2026-09-30: "ene html hurwuuleed oruul 3d hesgiig"). Тэр
  хуудас нь газрын зураг, 2D зүсэлт, график, 3D гэсэн дөрвөн хэсэгтэй;
  платформд ЗӨВХӨН 3D хэсэг ба түүнийг ажиллуулахад зайлшгүй зүйлс
  (жорлон сонгох, тохиргоо, цагийн тэнхлэг, үр дүн) орсон.

  Энэ файл нь эх хуудасны тооцооны хэсгийн ҮГ ҮСЭГЧЛЭН хөрвүүлэг —
  томьёо, коэффициент, дүрмийн дараалал ХӨНДӨГДӨӨГҮЙ:

  1. Нүхнээс гарах шингэн: Q = ам бүл × л/хүн/өдөр × 365/214 — хөрс 4–10
     дугаар сард л гэсэн (ACT0…ACT1), өвөл нэвчилт зогсоно.
  2. Хөрсөн дэх урсгал: нүхийг тэнхлэгтээ авсан тэгш хэмт r–z зүсэлтэд
     ханаагүй тогтвортой урсгал, Gardner-ийн квази-шугаман хувиргалт
     (K = Ks·e^(αh), Φ = K/α; Philip 1968): ∇²Φ − α·∂Φ/∂z = 0. Туузан
     матриц, Гауссын арилгалт, хоёр баруун талтай зэрэг.
  3. Чийг θ — van Genuchten–Mualem муруйгаар K/Ks-ээс (Carsel & Parrish
     1988, HYDRUS-ийн стандарт утга).
  4. Зөөвөрлөлт: ∂(θC)/∂t = −∇·(qC) + ∇·(θD∇C) − λθC; нитрат устахгүй,
     E.coli устана/шүүгдэнэ. D = 0.1 м·|v| (дагуу) + 0.01 м·|v| (хөндлөн).
  5. Гүний усанд холилдох: 1 га-гийн бүх жорлонгийн азот урсгалд
     холилдоно; ундны усны норм 50 мг/л NO₃ ≈ 11.3 мг/л NO₃-N.

  ⚠⚠ Энэ бол ОЙРОЛЦОО загвар, хэмжилт биш; анхдагчаар азот задрахгүй
  тул нитрат нь ДЭЭД ХЯЗГААРЫН үнэлгээ. Эдгээр тайлбар дэлгэцэд ГАРАХГҮЙ
  (арга зүйн тайлбарын дүрэм) — энд ба CLAUDE.md-д л.
*/
import { asset } from "@/lib/base-path";
import { arcgisJson } from "@/lib/arcgis";
import { PIT_SERVICE } from "@/lib/toilets";
import { fetchGeology } from "@/lib/geology";
import { BOREHOLES, BORE_REACH, PROFILE_HZ, USCS_CLS, WOSIS, type Borehole } from "@/lib/subsurface";

/* ── Хөрсний ангилал: van Genuchten–Mualem, Carsel & Parrish (1988) ──
   thr, ths, α (1/м), n, Ks (м/өдөр); lamE — E.coli устах+шүүгдэх хурд (1/өдөр) */
export type Texture = { n: string; thr: number; ths: number; a: number; vn: number; Ks: number; lamE: number };
/*
  ⚠ Эхний тав нь эх хуудасных (хөндөгдөөгүй). Үлдсэн долоо нь Carsel &
  Parrish (1988)-ийн 12 ангиллын бусад нь — хөрсний үе бүрийн механик
  бүрэлдэхүүнээр анги тогтоох болсон тул нэмэгдэв (2026-10-07,
  {@link src/lib/subsurface.ts}). Тэдний `lamE` нь эх сурвалжид БАЙХГҮЙ:
  эх хуудасны шатлалыг (элс 0.4 … шаварлаг шавранцар 2.0) шаврын хувиар
  үргэлжлүүлсэн утга.
*/
export const TEX: Record<string, Texture> = {
  sand: { n: "элс", thr: 0.045, ths: 0.43, a: 14.5, vn: 2.68, Ks: 7.128, lamE: 0.4 },
  lsand: { n: "шавранцар элс", thr: 0.057, ths: 0.41, a: 12.4, vn: 2.28, Ks: 3.502, lamE: 0.6 },
  sloam: { n: "элсэнцэр", thr: 0.065, ths: 0.41, a: 7.5, vn: 1.89, Ks: 1.061, lamE: 1.0 },
  loam: { n: "шавранцар", thr: 0.078, ths: 0.43, a: 3.6, vn: 1.56, Ks: 0.2496, lamE: 1.5 },
  cloam: { n: "шаварлаг шавранцар", thr: 0.095, ths: 0.41, a: 1.9, vn: 1.31, Ks: 0.0624, lamE: 2.0 },
  silt: { n: "тоосонцор", thr: 0.034, ths: 0.46, a: 1.6, vn: 1.37, Ks: 0.06, lamE: 1.5 },
  sil: { n: "тоосонцорлог шавранцар", thr: 0.067, ths: 0.45, a: 2.0, vn: 1.41, Ks: 0.108, lamE: 1.5 },
  scl: { n: "элсэрхэг шавранцар", thr: 0.1, ths: 0.39, a: 5.9, vn: 1.48, Ks: 0.3144, lamE: 1.5 },
  sicl: { n: "тоосонцорлог шаварлаг шавранцар", thr: 0.089, ths: 0.43, a: 1.0, vn: 1.23, Ks: 0.0168, lamE: 2.0 },
  sc: { n: "элсэрхэг шавар", thr: 0.1, ths: 0.38, a: 2.7, vn: 1.23, Ks: 0.0288, lamE: 2.0 },
  sic: { n: "тоосонцорлог шавар", thr: 0.07, ths: 0.36, a: 0.5, vn: 1.09, Ks: 0.0048, lamE: 2.5 },
  clay: { n: "шавар", thr: 0.068, ths: 0.38, a: 0.8, vn: 1.09, Ks: 0.048, lamE: 2.5 },
};

/**
 * Геологи (UB_ground_classi.shp, JICA 2013) → хөрсний ангилал, уст давхаргын K (м/өдөр).
 *
 * ⚠⚠ НЕОГЕН ЗАССАН (2026-10-06, хэрэглэгч: "sudalgaani ur dung hudlaa baij
 * bolohgui"). Урьд нь "Неогений шавар" — шаварлаг шавранцар, K 0.05 м/өдөр.
 * Гурван бие даасан эх сурвалж түүнийг ЦЭВЭР ШАВАР БИШ гэж хэлнэ:
 *  · ШУА ГГХ, нүхэн жорлонгийн тайлан (2021), 4.4: плиоцены хурдсыг "улаан
 *    шар өнгийн шавар, хайрга, элс сул барьцалдсан конглемерат хайрганцар
 *    элсэнцэр" гэж бичээд нэвчилтийг ДУНД (3/5 — элсэнцэртэй ижил) үнэлсэн;
 *  · JICA (2013) уг ангийг "Neogene gravel" гэж нэрлэсэн, түүн дээрх өрөмдлөг
 *    UB_BO_02: 0.2–4 м шавар, элс, чулуутай хайрга, 4–30 м шавартай элсэн
 *    хайрга, гүний ус 4.7 м (Vol-4 Databook, 1.3.1);
 *  · Туулын сав газрын гидрогеологи: хайрга, чулууны завсрыг нарийн элс,
 *    шавар дүүргэж, зарим газар 5–8 м шаварлаг үе үүсгэж хагас даралтат
 *    нөхцөл бий болгодог (Water 2018, 10(6) 750).
 * Тиймээс ханаагүй бүсэд элсэнцэр (`sloam`), уст давхаргын K нь шавартай
 * хайрганы (GC) ердийн 10⁻⁶–10⁻⁵ м/с = 0.09–0.9 м/өдөр мужийн геометр
 * дундаж ≈ 0.3 м/өдөр.
 * ⚠ СУУРЬ ЧУЛУУЛАГ ХЭВЭЭР (шавранцар, 0.5): ГГХ-ийн тайлан тунамал
 * чулуулгийг (C, D, K) "хөнгөн шавранцар"-тай ижил 2/5 гэж үнэлсэн нь одоогийн
 * сонголттой таарна. Налуу дээрх гэр хорооллын ЧУЛУУЛГИЙН худгуудад нитрат
 * 64–305 мг/л илэрсэн (Sci. Total Environ. 2021) нь бага K → бага шингэрэл →
 * өндөр агууламжтай НИЙЦНЭ; хагархайн дагуух хурдан урсгалыг энэ загвар
 * тусгаагүй (ARGOSS 2001-ийн "bypass flow").
 * ⚠ 7 = интрузив (боржин, пегматит) — жорлон ДЭЭР нь байхгүй, зөвхөн
 * зүсэлтийн гүний хэсгийг будахад; ГГХ 1/5 (хамгийн бага).
 */
export type Material = { n: string; t: keyof typeof TEX; Kaq: number; col: string; tex: string };
export const MATS: Material[] = (
  [
    { n: "Голоцены голын хурдас (хайрга, элс)", t: "sand", Kaq: 40, col: "#d9c9a3" },
    { n: "Хөндийн хурдас (элс, хайрга, шавранцар)", t: "sloam", Kaq: 10, col: "#c9b287" },
    { n: "Дэнжийн хурдас (хайрга)", t: "sand", Kaq: 20, col: "#d3c095" },
    { n: "Нуранги хурдас (сайр, чулуу)", t: "lsand", Kaq: 5, col: "#b9a27c" },
    { n: "Эолын элс", t: "lsand", Kaq: 5, col: "#e3d3a8" },
    { n: "Неогений хурдас (шавартай хайрга, элс)", t: "sloam", Kaq: 0.3, col: "#b98a62" },
    { n: "Суурь чулуулаг (өгөршсөн, хагархай)", t: "loam", Kaq: 0.5, col: "#8f877c" },
    { n: "Интрузив чулуулаг (боржин)", t: "cloam", Kaq: 0.05, col: "#a0918a" },
  ] as const
).map((m) => ({ ...m, tex: TEX[m.t].n }));

/** Нүхний шингэн дэх E.coli, log10 CFU/100 мл */
export const C0E_LOG = 7;
/** кг N / хүн / жил */
export const N_PP = 4.5;
/** мг/л NO₃-N (= 50 мг/л NO₃) */
export const NORM_N = 11.3;
/** 4-р сарын 1 – 10-р сарын 31 (хөрс гэссэн үе), жилийн өдөр */
export const ACT0 = 90;
export const ACT1 = 304;
export const isWinter = (d: number) => {
  const y = d % 365;
  return y < ACT0 || y >= ACT1;
};

/* ── Өгөгдөл ─────────────────────────────────────────────────────── */

export type SimProfile = { name: string; key: string; hz: string; gw: string; perma: string };
type Header = {
  n: number;
  profiles: SimProfile[];
  khList: string[];
  gcodes: string[];
  blocks: { name: string; type: "uint8" | "uint16" | "int32"; offset: number; count: number }[];
};
export type SimData = {
  n: number;
  lon: Float32Array;
  lat: Float32Array;
  id: Int32Array;
  /** Анхдагч утгууд — эх сурвалжийн нэгжээр ×10 (gw, hh, pit) */
  gw: Uint16Array;
  hh: Uint8Array;
  pit: Uint8Array;
  /** Гүний усны гүний эх үүсвэр: 1 гар худаг, 2 хөрсний хүснэгт */
  src: Uint8Array;
  nwell: Uint8Array;
  mat: Uint8Array;
  dens: Uint8Array;
  soil: Uint8Array;
  valley: Uint8Array;
  kh: Uint8Array;
  gcode: Uint8Array;
  profiles: SimProfile[];
  khList: string[];
  gcodes: string[];
  tiles: Record<string, Blob>;
};

let pending: Promise<SimData> | null = null;
export function fetchLatrineSim(): Promise<SimData> {
  pending ??= loadSim().catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}

async function loadSim(): Promise<SimData> {
  // eslint-disable-next-line no-restricted-globals -- статик файл, портал биш
  const res = await fetch(asset("/data/latrine-sim.bin"));
  if (!res.ok) throw new Error(`Симуляцийн өгөгдөл уншигдсангүй (${res.status})`);
  const buf = await res.arrayBuffer();
  const headLen = new DataView(buf).getUint32(0, true);
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen))) as Header;
  const blk = (name: string) => h.blocks.find((b) => b.name === name)!;
  const u8 = (name: string) => {
    const b = blk(name);
    return new Uint8Array(buf, b.offset, b.count);
  };
  const u16 = (name: string) => {
    const b = blk(name);
    return new Uint16Array(buf, b.offset, b.count);
  };
  const idb = blk("id");
  const id = new Int32Array(buf, idb.offset, idb.count);
  const [{ lon, lat }, geo] = await Promise.all([fillCoords(id), fetchGeology().catch(() => null)]);
  /* ⚠ КОДГҮЙ олон өнцөгт дээрх жорлонг геологийн ангиллаар (`NEWID`) нь —
     бэлтгэгч нь тэднийг оноогоор таамагласан байв (~6% нь зөрсөн) */
  const mat = u8("mat");
  const gcode = u8("gcode");
  if (geo && h.gcodes[0] === "")
    for (let i = 0; i < h.n; i++) {
      if (gcode[i] !== 0 || Number.isNaN(lon[i])) continue;
      const m = geo.at(lon[i], lat[i]);
      if (m != null && m < 7) mat[i] = m;
    }
  const tiles: Record<string, Blob> = {};
  for (const b of h.blocks) if (b.name.startsWith("tile")) tiles[b.name.slice(4)] = new Blob([u8(b.name)], { type: "image/jpeg" });
  return {
    n: h.n,
    lon,
    lat,
    id,
    gw: u16("gw"),
    hh: u8("hh"),
    pit: u8("pit"),
    src: u8("src"),
    nwell: u8("nwell"),
    mat,
    dens: u8("dens"),
    soil: u8("soil"),
    valley: u8("valley"),
    kh: u8("kh"),
    gcode,
    profiles: h.profiles,
    khList: h.khList,
    gcodes: h.gcodes,
    tiles,
  };
}

/**
 * Жорлон бүрийн байршил — ПОРТАЛААС, багцын `id`-аар холбож.
 *
 * ⚠⚠ Багцад координат БАЙХГҮЙ (`scripts/build-latrine-sim.mjs`-ийн
 * тэмдэглэлийг үз): `public/` нэвтрэлтгүй татагддаг, харин порталын
 * давхарга байгууллагын хүрээнд хаалттай. Тиймээс байршил зөвхөн
 * нэвтэрсэн хэрэглэгчид `arcgisJson`-оор (токентой) ирнэ.
 * ⚠ Дараалалд НАЙДАХГҮЙ — `id`-аар холбоно (дараалал одоо ижил ч порталд
 * засвар орвол өөрчлөгдөж болно). Холбогдоогүй жорлон `NaN` үлдэж,
 * зураг, сонголтоос чимээгүй хасагдана.
 * Хуудсууд 8-аар зэрэг; ~73 хуудас, `geometryPrecision 6` (~0.1 м).
 */
async function fillCoords(id: Int32Array) {
  const n = id.length;
  const at = new Map<number, number>();
  for (let i = 0; i < n; i++) at.set(id[i], i);
  const lon = new Float32Array(n).fill(NaN);
  const lat = new Float32Array(n).fill(NaN);
  const PAGE = 2000;
  const page = async (offset: number) => {
    const url = `${PIT_SERVICE}/query?${new URLSearchParams({
      f: "json",
      where: "1=1",
      outFields: "id",
      outSR: "4326",
      returnGeometry: "true",
      geometryPrecision: "6",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "objectid ASC",
    })}`;
    const j = await arcgisJson<{ features?: { attributes: { id: number }; geometry?: { x: number; y: number } | null }[] }>(
      url,
      "Нүхэн жорлонгийн байршил",
    );
    for (const f of j.features ?? []) {
      const i = at.get(f.attributes.id);
      if (i == null || !f.geometry) continue;
      lon[i] = f.geometry.x;
      lat[i] = f.geometry.y;
    }
    return j.features?.length ?? 0;
  };
  const offs: number[] = [];
  for (let o = 0; o < n; o += PAGE) offs.push(o);
  for (let k = 0; k < offs.length; k += 8) await Promise.all(offs.slice(k, k + 8).map(page));
  return { lon, lat };
}

/** Нүхний ёроолоос гүний ус хүртэлх зайн анги: 0 хүрсэн · 1 <1.5 м · 2 1.5–5 м · 3 >5 м */
export function sepClass(d: SimData, i: number): number {
  const s = (d.gw[i] - d.pit[i]) / 10;
  return s <= 0.01 ? 0 : s < 1.5 ? 1 : s < 5 ? 2 : 3;
}

/**
 * `sepClass`-ийн дөрвөн ангиллын нэр, өнгө — эх хуудасны ангилал
 * платформын дохиогоор (`--clay` · улбар · `--ochre` · `--moss`).
 * ⚠ НЭГ эх сурвалж: "Нэвчилтийн симуляци"-ийн газрын зураг ба "Хөрсний
 * зүсэлт"-ийн жорлонгийн давхарга хоёулаа эндээс уншина — нэг жорлон
 * хоёр харагдацад өөр өнгөтэй байх ёсгүй. Зурагт орох тул тогтмол hex.
 */
export const SEP_CLASSES = [
  { label: "Нүх гүний усанд хүрсэн", color: "#e47b7b" },
  { label: "1.5 м-ээс бага", color: "#f59145" },
  { label: "1.5–5 м", color: "#e5b75a" },
  { label: "5 м-ээс их", color: "#67d7e4" },
] as const;

/* ── Хөрсний үе ──────────────────────────────────────────────────── */
export type Horizon = { n: string; t: number; b: number };
export function horizons(txt: string): Horizon[] {
  const out: { n: string; t: number; b: number | null }[] = [];
  let prev = 0;
  for (const tok of txt
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const nm = tok.split(" ")[0];
    const m = tok.match(/(\d+)\s*[–-]\s*(\d+)/);
    const p = tok.match(/(\d+)\s*\+/);
    let t = prev;
    let b: number | null = null;
    if (m) {
      t = +m[1];
      b = +m[2];
    } else if (p) t = +p[1];
    t = Math.max(t, prev);
    out.push({ n: nm, t, b });
    prev = b ?? t;
  }
  /* ⚠ Эх сурвалж сүүлийн үеийг НЭЭЛТТЭЙ бичдэг ("C 69+", "Cg (аллюви)") —
     хөрсний зүсэлттэй ИЖИЛ дүрмээр 200 см хүртэл сунгана (`dropSchematic`,
     `R_BOTTOM`). Урьд нь 150 см-т тасалж доор нь геологи зурдаг тул нэг
     жорлон хоёр харагдацад 150–200 см-т өөр үе харуулж байв (2026-10-07). */
  return out.map((o, i) => ({ n: o.n, t: o.t, b: o.b ?? (i + 1 < out.length ? out[i + 1].t : 200) }));
}
export function hzCol(n: string): string {
  const c = n.replace(/[^A-Za-zА-Яа-я]/g, "")[0] || "C";
  return ({ O: "#3a2a1c", T: "#3a2a1c", A: "#5b4330", B: "#8a6a48", C: "#b89e76", R: "#8d8a86" } as Record<string, string>)[c.toUpperCase()] || "#9c8566";
}

/* ── Газрын доорх багана ────────────────────────────────────────────
   Жорлон бүрийн доорх давхаргууд, гүнээр (м): 0–2 м нь хөрсний профайлын
   үе (механик бүрэлдэхүүн нь {@link src/lib/subsurface.ts}), 2 м-ээс доош
   нь ойрын цооногийн давхаргажилт (BORE_REACH дотор, ИЖИЛ геологийн ангид),
   эс бөгөөс геологийн зургийн материал.
   ⚠ Хөрсний үеийн Ks нь хайргаар багасна: Kb = Kf·(1 − хайрга) (Brakensiek
   ба бусад, 1986) — хайрга нь зөвхөн нарийн ширхэгийн эзлэх хэсгийг
   багасгадаг. Цооногийн давхаргад ХЭРЭГЛЭХГҮЙ: тэнд хайрга нь өөрөө үндсэн
   бүрдэл (GP) бөгөөд анги нь түүнийг аль хэдийн тусгасан. */
export type ColLayer = {
  /** Гүн, м */
  top: number;
  bot: number;
  /** `TEX`-ийн түлхүүр */
  cls: string;
  /** Ханасан шүүлтийн коэффициент, м/өдөр (хайрганы засвартай) */
  Ks: number;
  /** Үеийн нэр эсвэл давхаргын бичиглэл */
  name: string;
  /** Эх сурвалж: WoSIS-ийн цэг · SoilGrids · цооног · геологийн зураг */
  src: string;
  gravel: number | null;
  /** 0 хөрсний үе · 1 цооног · 2 геологийн зураг */
  kind: 0 | 1 | 2;
};

/** Хөрсний профайлын доод хил, м — түүнээс доош геологи */
export const SOIL_BOTTOM = 2;

/** Жорлонд хамаарах цооног: BORE_REACH дотор, ижил геологийн ангид, хамгийн ойр */
export function boreholeFor(lon: number, lat: number, mat: number): Borehole | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  let best: Borehole | null = null;
  let bd = BORE_REACH;
  for (const b of BOREHOLES) {
    if (b.mat !== mat) continue;
    const d = Math.hypot((b.lon - lon) * kx, (b.lat - lat) * 110950);
    if (d <= bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

export function columnOf(d: SimData, i: number): ColLayer[] {
  const soil = d.soil[i];
  const mat = d.mat[i];
  const rows = PROFILE_HZ[soil] ?? [];
  const out: ColLayer[] = [];
  horizons(d.profiles[soil]?.hz ?? "").forEach((h, k) => {
    /* ⚠ Нэрээр нь, олдохгүй бол дарааллаар — хоёр багц нэг эх бичвэрээс */
    const r = rows.find((x) => x[0] === h.n) ?? rows[k];
    const cls = r && TEX[r[5]] ? r[5] : MATS[mat].t;
    const gravel = r ? r[4] : null;
    const top = h.t / 100;
    const bot = Math.min(SOIL_BOTTOM, h.b / 100);
    if (bot <= top) return;
    out.push({
      top, bot, cls, Ks: TEX[cls].Ks * (1 - (gravel ?? 0) / 100), name: h.n,
      src: r ? (WOSIS[r[6]] ?? "SoilGrids 250 м") : "Геологийн зураг", gravel, kind: 0,
    });
  });
  const start = out.length ? out[out.length - 1].bot : 0;
  const bh = boreholeFor(d.lon[i], d.lat[i], mat);
  if (bh) {
    for (const l of bh.layers) {
      if (!l.uscs || l.bot <= start) continue;
      const cls = USCS_CLS[l.uscs] ?? MATS[mat].t;
      out.push({ top: Math.max(start, l.top), bot: l.bot, cls, Ks: TEX[cls].Ks, name: l.name, src: `JICA цооног ${bh.id}`, gravel: l.gravel, kind: 1 });
    }
  }
  const last = out.length ? out[out.length - 1].bot : 0;
  const M = MATS[mat];
  /* ⚠ Цооног 30 м-т дуусна — түүнээс доош (эсвэл цооноггүй бол 2 м-ээс)
     геологийн зургийн материал */
  out.push({ top: last, bot: 1e3, cls: M.t, Ks: TEX[M.t].Ks, name: M.n, src: "Геологийн зураг (JICA 2013)", gravel: null, kind: 2 });
  return out;
}

/** Баганын тэмдэг — ижил баганатай жорлонгууд нэг тооцоог хуваалцана */
export const colSig = (c: ColLayer[] | undefined) =>
  c ? c.map((l) => `${l.top.toFixed(2)}:${l.cls}:${l.Ks.toPrecision(3)}`).join(",") : "";

/* ── van Genuchten: K/Ks → θ ─────────────────────────────────────── */
export function thetaFromK(T: Texture) {
  const m = 1 - 1 / T.vn;
  const NS = 400;
  const se = new Float64Array(NS);
  const kr = new Float64Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = Math.pow(10, -6 + (6 * i) / (NS - 1));
    se[i] = s;
    kr[i] = Math.sqrt(s) * Math.pow(1 - Math.pow(1 - Math.pow(s, 1 / m), m), 2);
  }
  return (k: number) => {
    const r = Math.min(1, Math.max(0, k / T.Ks));
    if (r <= kr[0]) return T.thr + se[0] * (T.ths - T.thr);
    if (r >= 1) return T.ths;
    let lo = 0;
    let hi = NS - 1;
    while (hi - lo > 1) {
      const md = (lo + hi) >> 1;
      if (kr[md] < r) lo = md;
      else hi = md;
    }
    const f = (r - kr[lo]) / (kr[hi] - kr[lo]);
    return T.thr + (se[lo] + f * (se[hi] - se[lo])) * (T.ths - T.thr);
  };
}

/* ── Параметр ────────────────────────────────────────────────────── */
export type SimParams = {
  pit: number;
  gw: number;
  hh: number;
  years: number;
  wid: number;
  hw: number;
  lpp: number;
  fn: number;
  kaq: number;
  rch: number;
  dn: number;
  grad: number;
  mix: number;
  lamx: number;
  mat: number;
  dens: number;
  soil: number;
  /** Газрын доорх багана — байхгүй бол геологийн материал ганцаараа */
  col?: ColLayer[];
};

/** Жорлонгийн анхдагч тохиргоо (эх хуудасны `defaults`) */
export function defaultParams(d: SimData, i: number): SimParams {
  const m = MATS[d.mat[i]];
  return {
    pit: d.pit[i] / 10,
    gw: d.gw[i] / 10,
    hh: d.hh[i] / 10,
    years: 30,
    wid: 1.2,
    hw: 0.3,
    lpp: 1.5,
    fn: 0.5,
    kaq: m.Kaq,
    rch: 15,
    dn: 0,
    grad: d.valley[i] ? 0.005 : 0.01,
    mix: 5,
    lamx: 1,
    mat: d.mat[i],
    dens: d.dens[i],
    soil: d.soil[i],
    col: columnOf(d, i),
  };
}

/* ── 2D урсгал: квази-шугаман (Gardner) тогтвортой урсгал, тэгш хэмт r–z ──

   ⚠⚠ ДАВХАРГАТАЙ БОЛСОН (2026-10-07). Үе бүр ӨӨРИЙН Ks-тэй, α нь багана
   даяар НЭГ (Srivastava & Yeh 1991-ийн давхаргат Gardner-ийн шийдлийн
   таамаглал): тэгэхэд u = K/Ks = e^{αψ} нь үеийн заагаар тасралтгүй,
   тэгшитгэл ∇·(Ks/α ∇u) − ∂(Ks u)/∂z = 0 нь ШУГАМАН хэвээр тул нүхний
   урсгалыг тааруулах суперпозиц (U1, U2), туузан Гаусс өөрчлөгдөөгүй —
   хурд нь хуучинтайгаа ижил.
   · Нийтлэг α — нүхний ёроолоос гүний ус хүртэлх үеийн α-ийн зузаанаар
     жигнэсэн геометр дундаж (бохирдол тэр замаар явна).
   · Босоо нүүр хоёр хагас эсийн цуваа: q = A₁u₁ − B₁uₘ = A₂uₘ − B₂u₂,
     A = Ks·e/(e−1), B = Ks/(e−1), e = e^{αh/2} — ижил Ks үед хуучин
     aa/b томьёотой ЯГ таарна (нэг давхаргатай баганаар тулгаж шалгасан).
   · Хэвтээ нүүр нэг мөрөнд — нэг үе, нэг Ks.
   · Чийг θ — ҮЕ БҮРИЙН өөрийн ус барих муруйгаар (K/Ks-ээс), тиймээс
     шаварт ижил урсгалд θ их → хурд бага; хайрганд эсрэгээрээ.
   ⚠ Таамаглалын үнэ: хялгасан хүчний ялгаа (элс/шаврын хил дээрх
   "хялгасан саад") тусгагдахгүй. */
export type Flow = ReturnType<typeof flowField>;
/** Баганаас мөр бүрийн давхарга (эсийн төвийн гүнээр) ба нийтлэг α */
function rowsOf(col: ColLayer[], nz: number, h: number, from: number, to: number) {
  const lay = new Array<ColLayer>(nz);
  let k = 0;
  for (let j = 0; j < nz; j++) {
    const z = (j + 0.5) * h;
    while (k < col.length - 1 && col[k].bot <= z) k++;
    lay[j] = col[k];
  }
  let w = 0;
  let s = 0;
  for (const l of col) {
    const t = Math.min(l.bot, to) - Math.max(l.top, from);
    if (t <= 0) continue;
    w += t;
    s += t * Math.log(TEX[l.cls].a);
  }
  return { lay, al: w > 0 ? Math.exp(s / w) : TEX[col[col.length - 1].cls].a };
}
export function flowField(p: SimParams, T: Texture) {
  const col: ColLayer[] = p.col?.length
    ? p.col
    : [{ top: 0, bot: 1e3, cls: MATS[p.mat].t, Ks: T.Ks, name: MATS[p.mat].n, src: "", gravel: null, kind: 2 }];
  const gw = p.gw;
  const d = p.pit;
  const L = gw - d;
  const a = p.wid / Math.sqrt(Math.PI);
  const RW = 3.5; // нүхний хананаас хажуу тийш загварын өргөн, м (хил дээр урсгалгүй)
  let h = Math.min(0.4, Math.max(0.06, Math.sqrt((gw * (a + RW)) / 1500)));
  if (L > 0) h = Math.min(h, Math.max(0.03, L / 4));
  const nz = Math.max(4, Math.round(gw / h));
  h = gw / nz;
  const nr = Math.ceil((a + RW) / h);
  const R = nr * h;
  const ia = Math.max(1, Math.round(a / h));
  const jd = Math.min(nz - 1, Math.max(1, Math.round(d / h)));
  const jw = Math.max(0, jd - Math.max(1, Math.round(p.hw / h)));
  const nc = nr * nz;
  const typ = new Uint8Array(nc); // 0 хөрс, 1 норсон нүх, 2 хуурай нүх
  for (let j = 0; j < jd; j++) for (let i = 0; i < ia; i++) typ[j * nr + i] = j >= jw ? 1 : 2;
  /* мөр бүрийн давхарга, нийтлэг α (нүхний ёроолоос гүний ус хүртэл) */
  const { lay, al } = rowsOf(col, nz, h, L > h ? d : 0, gw);
  const Ksr = new Float64Array(nz);
  for (let j = 0; j < nz; j++) Ksr[j] = lay[j].Ks;
  const kap = (j: number) => Ksr[j] / al; // Ks/α — u-ийн урсгалын коэффициент
  /* босоо нүүр: хагас эс бүрийн A, B (e = e^{αh/2}) */
  const eh = Math.exp((al * h) / 2);
  const Ah = (j: number) => (Ksr[j] * eh) / (eh - 1);
  const Bh = (j: number) => Ksr[j] / (eh - 1);
  const cD = new Float64Array(nz); // доош: u_дээд-ийн коэффициент
  const cU = new Float64Array(nz); // доош: u_доод-ийн коэффициент
  for (let j = 0; j < nz - 1; j++) {
    const den = Bh(j) + Ah(j + 1);
    cD[j] = (Ah(j) * Ah(j + 1)) / den;
    cU[j] = (Bh(j) * Bh(j + 1)) / den;
  }
  /* нүхнээс доош (нүхний эсэд Ks байхгүй — доорх эсийнхээр, бүтэн h) */
  const E = Math.exp(al * h);
  const pD = (j: number) => (Ksr[j] * E) / (E - 1);
  const pU = (j: number) => Ksr[j] / (E - 1);
  /* ёроол: хагас эс, гүний ус u = 1 */
  const b2 = al / Math.expm1((al * h) / 2);
  const a2 = b2 + al;
  const qb = p.rch / 1000 / (ACT1 - ACT0); // гадаргаас нэвчих хур борооны ус, м/өдөр
  const diag = new Float64Array(nc);
  const kPit = new Float64Array(nc);
  const bOth = new Float64Array(nc);
  const cE = new Float64Array(nc);
  const cW = new Float64Array(nc);
  const cS = new Float64Array(nc);
  const cN = new Float64Array(nc);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nr; i++) {
      const k = j * nr + i;
      if (typ[k]) continue;
      const ri = (i + 0.5) * h;
      const Ae = (i + 1) * h;
      const Aw = i * h;
      const Av = ri;
      const kj = kap(j);
      if (i < nr - 1) {
        diag[k] += (Ae / h) * kj;
        cE[k] = (Ae / h) * kj;
      }
      if (i > 0) {
        const t = typ[k - 1];
        if (t === 0) {
          diag[k] += (Aw / h) * kj;
          cW[k] = (Aw / h) * kj;
        } else if (t === 1) {
          diag[k] += (Aw / h) * kj;
          kPit[k] += (Aw / h) * kj;
        }
      }
      if (j === nz - 1) {
        diag[k] += Av * kj * a2;
        bOth[k] += Av * kj * b2;
      } else {
        diag[k] += Av * cD[j];
        cS[k] = Av * cU[j];
      }
      if (j > 0) {
        const t = typ[k - nr];
        if (t === 0) {
          diag[k] += Av * cU[j - 1];
          cN[k] = Av * cD[j - 1];
        } else if (t === 1) {
          diag[k] += Av * pU(j);
          kPit[k] += Av * pD(j);
        }
      } else bOth[k] += Av * qb;
    }
  const soil: number[] = [];
  for (let k = 0; k < nc; k++) if (!typ[k]) soil.push(k);
  /* туузан матриц (өргөн = nr), Гауссын арилгалт — хоёр баруун талтай зэрэг */
  const bw = nr;
  const Wd = 2 * bw + 1;
  const A = new Float64Array(nc * Wd);
  const at = (r: number, c: number) => r * Wd + (c - r + bw);
  for (let k = 0; k < nc; k++) {
    if (typ[k]) {
      A[at(k, k)] = 1;
      continue;
    }
    A[at(k, k)] = diag[k];
    if (cE[k]) A[at(k, k + 1)] = -cE[k];
    if (cW[k]) A[at(k, k - 1)] = -cW[k];
    if (cS[k]) A[at(k, k + nr)] = -cS[k];
    if (cN[k]) A[at(k, k - nr)] = -cN[k];
  }
  const U1 = Float64Array.from(kPit);
  const U2 = Float64Array.from(bOth);
  for (let k = 0; k < nc; k++) {
    const pv = A[at(k, k)];
    const cmax = Math.min(nc - 1, k + bw);
    for (let r = k + 1; r <= cmax; r++) {
      const f = A[at(r, k)] / pv;
      if (f === 0) continue;
      for (let c = k; c <= cmax; c++) A[at(r, c)] -= f * A[at(k, c)];
      U1[r] -= f * U1[k];
      U2[r] -= f * U2[k];
    }
  }
  for (let k = nc - 1; k >= 0; k--) {
    const cmax = Math.min(nc - 1, k + bw);
    let s1 = U1[k];
    let s2 = U2[k];
    for (let c = k + 1; c <= cmax; c++) {
      const v = A[at(k, c)];
      if (v) {
        s1 -= v * U1[c];
        s2 -= v * U2[c];
      }
    }
    const pv = A[at(k, k)];
    U1[k] = s1 / pv;
    U2[k] = s2 / pv;
  }
  for (let k = 0; k < nc; k++)
    if (typ[k]) {
      U1[k] = 0;
      U2[k] = 0;
    }
  /* нүхнээс хөрсөнд орох урсгал (нормчилсон) */
  const pitIn = (U: Float64Array, Pv: number) => {
    let q = 0;
    for (const k of soil) {
      const i = k % nr;
      const j = (k - i) / nr;
      if (i > 0 && typ[k - 1] === 1) q += ((i * h) / h) * kap(j) * (Pv - U[k]);
      if (j > 0 && typ[k - nr] === 1) q += (i + 0.5) * h * (pD(j) * Pv - pU(j) * U[k]);
    }
    return q;
  };
  const Q1 = pitIn(U1, 1) * 2 * Math.PI * h;
  const Q2 = pitIn(U2, 0) * 2 * Math.PI * h;
  const Qt = ((p.hh * p.lpp) / 1000) * (365 / (ACT1 - ACT0));
  /* нүхний ханан дээрх u (= K/Ks); 1 нь ханасан — түүнээс их бол нүх дүүрнэ */
  let u0 = (Qt - Q2) / Q1;
  let pond = false;
  if (u0 > 1) {
    u0 = 1;
    pond = true;
  }
  const u = new Float64Array(nc);
  for (let k = 0; k < nc; k++) u[k] = typ[k] === 1 ? u0 : u0 * U1[k] + U2[k];
  /* эс бүрийн шүүлтийн коэффициент K = Ks·u, м/өдөр */
  const K = new Float64Array(nc);
  for (const k of soil) K[k] = Ksr[Math.floor(k / nr)] * u[k];
  const Qin = u0 * Q1 + Q2;
  /* нүүрний урсгал, м³/өдөр (эерэг = гадагш, доош) */
  const tw = 2 * Math.PI * h;
  const Fe = new Float64Array(nc);
  const Fs = new Float64Array(nc);
  const Fp = new Float64Array(nc);
  const FpR = new Float64Array(nc);
  const FpZ = new Float64Array(nc);
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    const ri = (i + 0.5) * h;
    const Ae = (i + 1) * h;
    const kj = kap(j);
    Fe[k] = (i === nr - 1 || typ[k + 1] ? 0 : (Ae / h) * kj * (u[k] - u[k + 1])) * tw;
    Fs[k] = (j === nz - 1 ? ri * kj * (a2 * u[k] - b2) : ri * (cD[j] * u[k] - cU[j] * u[k + nr])) * tw;
    if (i > 0 && typ[k - 1] === 1) FpR[k] = ((i * h) / h) * kj * (u0 - u[k]) * tw;
    if (j > 0 && typ[k - nr] === 1) FpZ[k] = ri * (pD(j) * u0 - pU(j) * u[k]) * tw;
    Fp[k] = FpR[k] + FpZ[k];
  }
  /* хуучин нэршил: Φ = K/α (гадагш ашиглагддаггүй, тулгалтад) */
  const Phi = new Float64Array(nc);
  for (const k of soil) Phi[k] = K[k] / al;
  return { h, nr, nz, R, a, ia, jd, jw, typ, soil, u, K, Phi, Fe, Fs, Fp, FpR, FpZ, Qin, Qt, pond, al, qb, lay, Ksr };
}

/* ── СИМУЛЯЦИ ────────────────────────────────────────────────────── */
export type Snap = {
  d: number;
  qN?: Uint8Array;
  qE?: Uint8Array;
  botN: number;
  elog: number;
  Cgw: number;
  latN: number;
  latE: number;
};
export type SimResult = {
  L: number;
  C0N: number;
  snaps: Snap[];
  tN: number | null;
  tE: number | null;
  tNorm: number | null;
  maxElog: number;
  latN: number;
  latE: number;
  Qth: number;
  V: number;
  direct: boolean;
  T: Texture;
  M: Material;
  Qin: number;
  pond?: boolean;
  F?: Flow;
  TH?: Float64Array;
  vR?: Float32Array;
  vZ?: Float32Array;
  lamE?: number;
  /** E.coli устах хурд мөр бүрээр, 1/өдөр */
  lamRow?: Float64Array;
  /** Төвийн баганаар нүхнээс гүний ус хүртэл явах хугацаа, дулаан улирлын хоног */
  tTravel?: number;
  Cgw: number;
};

export function simulate(p: SimParams): SimResult {
  const M = MATS[p.mat];
  const T = TEX[M.t];
  const L = p.gw - p.pit;
  const Qd = (p.hh * p.lpp) / 1000; // м³/өдөр (жилийн дундаж)
  const C0N = (p.fn * N_PP * p.hh * 1e6) / (Qd * 1000 * 365); // мг/л NO₃-N нүхний шингэнд
  const lamE = T.lamE * p.lamx;
  const days = p.years * 365;
  const SNAP = 15;
  const V = 1e4 * p.mix * 0.25;
  const Qth = p.kaq * p.grad * p.mix * 100 + (p.rch / 1000) * (1e4 / 365) + p.dens * Qd;
  const kDn = p.dn > 0 ? Math.LN2 / (p.dn * 365) : 0;
  const out: SimResult = {
    L, C0N, snaps: [], tN: null, tE: null, tNorm: null, maxElog: -9, latN: 0, latE: 0,
    Qth, V, direct: L <= 0.05, T, M, Qin: 0, Cgw: 0,
  };
  let Cgw = 0;
  if (out.direct) {
    /* нүх гүний усанд шууд */
    const Qa = (Qd * 365) / (ACT1 - ACT0);
    out.Qin = Qa;
    for (let d = 0; d < days; d++) {
      const doy = d % 365;
      const act = doy >= ACT0 && doy < ACT1;
      const J = act ? Qa * 1000 * C0N : 0;
      Cgw += (p.dens * J) / (V * 1000) - (Cgw * Qth) / V - Cgw * kDn;
      if (out.tN == null && act) out.tN = d;
      if (out.tE == null && act) out.tE = d;
      if (out.tNorm == null && Cgw >= NORM_N) out.tNorm = d;
      if (d % SNAP === 0) out.snaps.push({ d, botN: act ? C0N : 0, elog: act ? C0E_LOG : 0, Cgw, latN: 0, latE: 0 });
    }
    out.maxElog = C0E_LOG;
    out.Cgw = Cgw;
    return out;
  }
  const F = flowField(p, T);
  Object.assign(out, { F, pond: F.pond, Qin: F.Qin });
  const { h, nr, nz, soil, typ, Fe, Fs, Fp } = F;
  const nc = nr * nz;
  /* ⚠ Чийг ҮЕ БҮРИЙН өөрийн муруйгаар; Ks нь хайргын засвартай тул
     муруйг тэр Ks-тэй хуулбараар бодно (K/Ks харьцаа зөв байх ёстой) */
  const thOf = new Map<ColLayer, (k: number) => number>();
  for (const l of F.lay) if (!thOf.has(l)) thOf.set(l, thetaFromK({ ...TEX[l.cls], Ks: l.Ks }));
  const TH = new Float64Array(nc);
  const VOL = new Float64Array(nc);
  for (const k of soil) {
    const i = k % nr;
    TH[k] = thOf.get(F.lay[(k - i) / nr])!(F.K[k]);
    VOL[k] = 2 * Math.PI * (i + 0.5) * h * h * h;
  }
  /* эсийн хурд (дисперсэд) */
  const vr = new Float64Array(nc);
  const vz = new Float64Array(nc);
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    const ri = (i + 0.5) * h;
    const finR = i > 0 && !typ[k - 1] ? Fe[k - 1] : 0;
    const finZ = j > 0 && !typ[k - nr] ? Fs[k - nr] : 0;
    vr[k] = (Math.abs(Fe[k]) + Math.abs(finR)) / 2 / (2 * Math.PI * Math.max(ri, h / 2) * h * TH[k]);
    vz[k] = (Math.abs(Fs[k]) + Math.abs(finZ) + Fp[k]) / 2 / (2 * Math.PI * ri * h * TH[k]);
  }
  /* харагдацад: эсийн төв дэх нүх сүвний хурд (м/өдөр), r — гадагш, z — доош эерэг */
  const vR = new Float32Array(nc);
  const vZ = new Float32Array(nc);
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    const ri = (i + 0.5) * h;
    const inR = i > 0 && !typ[k - 1] ? Fe[k - 1] : F.FpR[k];
    const inZ = j > 0 && !typ[k - nr] ? Fs[k - nr] : j === 0 ? F.qb * 2 * Math.PI * ri * h : F.FpZ[k];
    vR[k] = (inR + Fe[k]) / 2 / (2 * Math.PI * ri * h * TH[k]);
    vZ[k] = (inZ + Fs[k]) / 2 / (2 * Math.PI * ri * h * TH[k]);
  }
  /* E.coli устах хурд — ҮЕ БҮРИЙН ангиар; `lamE` нь нүхнээс доош дундаж (дуслын харагдацад) */
  const lamRow = new Float64Array(nz);
  let lw = 0;
  for (let j = 0; j < nz; j++) {
    lamRow[j] = TEX[F.lay[j].cls].lamE * p.lamx;
    if (j >= F.jd) lw += lamRow[j];
  }
  /* төвийн баганаар нүхний ёроолоос гүний ус хүртэл явах хугацаа, хоног (дулаан улирлын) */
  let tTravel = 0;
  for (let j = F.jd; j < nz; j++) tTravel += h / Math.max(1e-9, vZ[j * nr]);
  Object.assign(out, { TH, vR, vZ, lamE: nz > F.jd ? lw / (nz - F.jd) : lamE, lamRow, tTravel });
  const aL = 0.1;
  const aT = 0.01;
  const Dm = 1e-5;
  const Te = new Float64Array(nc);
  const Ts = new Float64Array(nc); // дисперсийн дамжуулалт, м³/өдөр
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    const ri = (i + 0.5) * h;
    if (i < nr - 1 && !typ[k + 1]) {
      const t = (TH[k] + TH[k + 1]) / 2;
      const A = 2 * Math.PI * (i + 1) * h * h;
      const v = Math.abs(Fe[k]) / (A * t);
      Te[k] = (t * (aL * v + (aT * (vz[k] + vz[k + 1])) / 2 + Dm) * A) / h;
    }
    if (j < nz - 1) {
      const t = (TH[k] + TH[k + nr]) / 2;
      const A = 2 * Math.PI * ri * h;
      const v = Math.abs(Fs[k]) / (A * t);
      Ts[k] = (t * (aL * v + (aT * (vr[k] + vr[k + nr])) / 2 + Dm) * A) / h;
    }
  }
  /* тогтвортой хугацааны алхам */
  let rate = 0;
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    let o = Math.max(0, Fe[k]) + Math.max(0, Fs[k]) + Te[k] + Ts[k];
    if (i > 0 && !typ[k - 1]) o += Math.max(0, -Fe[k - 1]) + Te[k - 1];
    if (j > 0 && !typ[k - nr]) o += Math.max(0, -Fs[k - nr]) + Ts[k - nr];
    rate = Math.max(rate, o / (TH[k] * VOL[k]));
  }
  const sub = Math.max(1, Math.ceil(rate / 0.9));
  const dt = 1 / sub;
  const cN = new Float64Array(nc);
  const cE = new Float64Array(nc);
  const dN = new Float64Array(nc);
  const dE = new Float64Array(nc);
  const decR = lamRow.map((l) => Math.exp(-l * dt));
  for (let d = 0; d < days; d++) {
    const doy = d % 365;
    const act = doy >= ACT0 && doy < ACT1;
    let Jrel = 0;
    for (let s = 0; s < sub; s++) {
      if (act) {
        dN.fill(0);
        dE.fill(0);
        for (const k of soil) {
          const fp = Fp[k];
          if (fp > 0) {
            dN[k] += fp;
            dE[k] += fp;
          } else if (fp < 0) {
            dN[k] += fp * cN[k];
            dE[k] += fp * cE[k];
          } // нүхнээс C = 1
          const i = k % nr;
          const j = (k - i) / nr;
          /* хажуу нүүр */
          const fe = Fe[k];
          if (i === nr - 1) {
            if (fe > 0) {
              dN[k] -= fe * cN[k];
              dE[k] -= fe * cE[k];
            }
          } else if (!typ[k + 1]) {
            const e = k + 1;
            const fn = fe > 0 ? fe * cN[k] : fe * cN[e];
            const fE = fe > 0 ? fe * cE[k] : fe * cE[e];
            const t = Te[k];
            const xN = fn + t * (cN[k] - cN[e]);
            const xE = fE + t * (cE[k] - cE[e]);
            dN[k] -= xN;
            dN[e] += xN;
            dE[k] -= xE;
            dE[e] += xE;
          }
          /* доод нүүр */
          const fs = Fs[k];
          if (j === nz - 1) {
            if (fs > 0) {
              dN[k] -= fs * cN[k];
              dE[k] -= fs * cE[k];
              Jrel += fs * cN[k] * dt;
            }
          } else {
            const sI = k + nr;
            const fn = fs > 0 ? fs * cN[k] : fs * cN[sI];
            const fE = fs > 0 ? fs * cE[k] : fs * cE[sI];
            const t = Ts[k];
            const xN = fn + t * (cN[k] - cN[sI]);
            const xE = fE + t * (cE[k] - cE[sI]);
            dN[k] -= xN;
            dN[sI] += xN;
            dE[k] -= xE;
            dE[sI] += xE;
          }
        }
        for (const k of soil) {
          const w = dt / (TH[k] * VOL[k]);
          cN[k] += dN[k] * w;
          cE[k] = (cE[k] + dE[k] * w) * decR[(k - (k % nr)) / nr];
        }
      } else for (const k of soil) cE[k] *= decR[(k - (k % nr)) / nr];
    }
    const J = Jrel * 1000 * C0N; // мг/өдөр гүний усанд
    Cgw += (p.dens * J) / (V * 1000) - (Cgw * Qth) / V - Cgw * kDn;
    /* гүний усны гадарга дээрх концентраци (урсгалаар жигнэсэн), E.coli-ийн их утга */
    let fw = 0;
    let cw = 0;
    let emax = 0;
    for (let i = 0; i < nr; i++) {
      const k = (nz - 1) * nr + i;
      if (typ[k]) continue;
      const f = Math.max(0, Fs[k]);
      fw += f * cN[k];
      cw += f;
      if (cE[k] > emax) emax = cE[k];
    }
    const botRel = cw > 0 ? fw / cw : 0;
    const elog = C0E_LOG + Math.log10(Math.max(emax, 1e-30));
    if (out.tN == null && botRel >= 0.01) out.tN = d;
    if (elog > out.maxElog) out.maxElog = elog;
    if (out.tE == null && elog >= 0) out.tE = d;
    if (out.tNorm == null && Cgw >= NORM_N) out.tNorm = d;
    if (d % SNAP === 0) {
      const qN = new Uint8Array(nc);
      const qE = new Uint8Array(nc);
      let lN = 0;
      let lE = 0;
      for (const k of soil) {
        const i = k % nr;
        const n = cN[k];
        if (n > 1e-3) qN[k] = Math.min(255, 1 + Math.round((254 * Math.log10(n * 1000)) / 3));
        const e = C0E_LOG + Math.log10(Math.max(cE[k], 1e-30));
        if (e > 0) qE[k] = Math.min(255, 1 + Math.round((254 * e) / C0E_LOG));
        if (n >= 0.01) lN = Math.max(lN, (i + 1) * h);
        if (e >= 0) lE = Math.max(lE, (i + 1) * h);
      }
      out.latN = Math.max(out.latN, lN);
      out.latE = Math.max(out.latE, lE);
      out.snaps.push({ d, qN, qE, botN: botRel * C0N, elog, Cgw, latN: lN, latE: lE });
    }
  }
  out.Cgw = Cgw;
  return out;
}

/** Хугацааг ашиглаж эхэлснээс (4-р сарын 1) — эх хуудасны `fmtY` */
export function fmtSince(d: number | null): string {
  if (d == null) return "–";
  const e = Math.max(0, d - ACT0);
  const y = e / 365;
  return y < 1 ? `${Math.max(1, Math.round(e / 30.4))} сар` : `${y.toFixed(y < 10 ? 1 : 0)} жил`;
}
