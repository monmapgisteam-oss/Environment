/*
  ХӨРСНИЙ ПРОФАЙЛЫН 3D БЛОК — ӨГӨГДЛИЙН ЗАГВАР

  Эх сурвалж: `UB_soil.shp` (хөрсний зураглал) + `UB_soil_profiles_lookup.csv`
  (профайл бүрийн үе давхаргын бүтэц) + `dem30_float_m.tif`, бүгдийг
  {@link scripts/build-soil-profile.mjs} нэг хоёртын багц болгоно.

  ⚠⚠ ЭНЭ НЬ ЗАГВАРЧЛАЛ БИШ, ХЭМЖИГДСЭН БҮРТГЭЛ: хөрсний зураглалын нэгж
  бүрд тухайн хөрсний ЖИШИГ профайл (генетик үе давхаргын нэр, гүн,
  гүний усны түвшин) оноогдсон. Блок нь тэр бүртгэлийг рельеф дээр
  байрлуулж харуулна.

  ⚠ `R` үе (суурь чулуулаг) нь эх сурвалжид БАЙХГҮЙ — 150 см-ээс доош
  200 см хүртэлх хэсгийг СХЕМЧИЛЖ нэмсэн (бэлтгэгч скрипт дээр).
  Дэлгэц дээр "(схем)" гэж ил бичигдэнэ.
*/
import { asset } from "@/lib/base-path";

/** Хөрсний блокийн доод хил, см — профайлууд үүнээс гүнзгий бичигдээгүй */
export const R_BOTTOM = 200;
/** Бүтцийн хавтанцрын газрын хэмжээ, см (512 × 256 пиксел = 160 × 80 см) */
export const TILE_CM = 80;
export const TILE_W = 512;
export const TILE_H = 256;
/** Рельефээс дээш өргөх, м — блок газрын гадарга дотор шигдэхээс сэргийлнэ */
export const LIFT = 2;
/** Гүний усаар ханасан хэсгийн цэнхэр туяа */
export const SAT_TINT: [number, number, number, number] = [150, 190, 235, 1];

/* ── Үе давхаргын ангилал ──────────────────────────────────────────────
   Эх сурвалж үеээ генетик тэмдэглэгээгээр (A, Bk1, ⊥C …) бичдэг.
   Тэдгээрийг дүрслэлийн ангилалд буулгана — нэр нь эх сурвалжийнх,
   тайлбар нь хөрс судлалын нийтлэг нэршил. */
export type HClass = {
  label: string;
  color: string;
  /** Жишиг зургийн аль хавтанцраас гаргах, ямар хувиргалттай */
  photo: [string, { f?: number; gray?: number; tint?: [number, number, number]; k?: number }];
};

export const HCLS: Record<string, HClass> = {
  O: { label: "O / T — ялзмаг, хүлэр", color: "#2b1f16", photo: ["A", { f: 0.6 }] },
  A: { label: "A — өнгөн ялзмагт давхарга", color: "#3f2b1d", photo: ["A", {}] },
  A2: { label: "A2 / AB — шилжилтийн ялзмагт", color: "#56402c", photo: ["A", { f: 1.15 }] },
  Ag: { label: "Ag / ABg — глейжсэн ялзмагт", color: "#4b4843", photo: ["A", { gray: 0.55, tint: [118, 126, 128], k: 0.3 }] },
  Bw: { label: "Bw — бүтэц өөрчлөгдсөн", color: "#9a5a33", photo: ["B", {}] },
  Bk: { label: "Bk — шохойн хуримтлал", color: "#c9b38d", photo: ["E", {}] },
  Bg: { label: "Bg — глей (ус тогтсон)", color: "#7e8b87", photo: ["B", { gray: 0.8, tint: [118, 138, 144], k: 0.5 }] },
  Bf: { label: "Bf — төмрийн исэлжсэн", color: "#a4502a", photo: ["B", { tint: [185, 70, 30], k: 0.2 }] },
  C: { label: "C — эх чулуулаг, сайр хайрга", color: "#a39070", photo: ["C", {}] },
  CR: { label: "C/R — нимгэн, чулуурхаг", color: "#8d877a", photo: ["C", { f: 0.85 }] },
  Cg: { label: "Cg — глейжсэн аллюви", color: "#8f9891", photo: ["C", { gray: 0.7, tint: [125, 140, 140], k: 0.4 }] },
  Cf: { label: "⊥C — мөнх цэвдэг", color: "#9db2c1", photo: ["C", { gray: 0.5, tint: [150, 180, 205], k: 0.45 }] },
  R: { label: "R — ан цавтай суурь чулуулаг (схем)", color: "#7d7a75", photo: ["R", {}] },
};

/** Үеийн генетик тэмдэглэгээг ангилалд буулгана */
export function hcls(n: string): string {
  if (/^(O|T)/.test(n)) return "O";
  if (n === "A" || n === "A1" || n === "AO") return "A";
  if (/^A.*g/.test(n)) return "Ag";
  if (/^A/.test(n)) return "A2";
  if (/^Bw/.test(n)) return "Bw";
  if (/^Bk/.test(n)) return "Bk";
  if (/^Bg/.test(n)) return "Bg";
  if (/^Bf/.test(n)) return "Bf";
  if (n.includes("⊥")) return "Cf";
  if (n === "C/R") return "CR";
  if (/^Cg/.test(n)) return "Cg";
  if (n === "R") return "R";
  return "C";
}

/** Хөрсний хэв шинжийн өнгө — дээд гадаргын зураглалд */
export const SOILCOL: Record<string, string> = {
  DK: "#b3905a", DKst: "#a27b4b", DKsh: "#c6ac7c", CH: "#5c4737", CHnc: "#705842",
  CHsh: "#866b4f", MFD: "#4f5e3a", ST: "#6f7e4b", CT: "#7a8f86", CTfe: "#8f7a5e",
  MC: "#8fae6a", MSC: "#5f8f7a", MSCca: "#80a39a",
};

/* ⚠ КАТЕНА: хөрс хоорондын ШИЛЖИЛТ.
   Профайл бүрийг НИЙТЛЭГ дараалалтай (SLOT) ангиллын зузааны вектор
   болгоно. Хилийн ойролцоо хөрш хөрснүүдийн векторыг зайн жингээр
   холиход нэг талд л байгаа давхарга (жишээ нь Bk) шаантаг шиг
   нимгэрч алга болж, нөгөө талынх (Bg) ургаж орж ирнэ — хурц шугам
   биш, байгалийн катена. */
const SLOT: Record<string, number> = { O: 0, A: 1, A2: 1, Ag: 2, Bw: 3, Bg: 3, Bf: 3, Bk: 4, C: 5, CR: 5, Cg: 5, Cf: 5, R: 6 };
const HORD = Object.keys(HCLS);

export type Horizon = { n: string; t: number; b: number; note: string };
export type Profile = {
  code: number;
  name: string;
  key: string;
  wrb: string;
  hz: Horizon[];
  raw: string;
  gravel: string;
  gw: string;
  gwm: number | null;
  perma: string;
  src: string;
};

export type SoilHeader = {
  x0: number; y0: number; dx: number; dy: number;
  nx: number; ny: number; fine: number;
  profiles: Profile[];
  blocks: { name: string; type: string; offset: number; count: number }[];
};

export type SoilData = {
  header: SoilHeader;
  /** Нүд бүрийн профайлын индекс; 255 = хөрсгүй */
  cells: Uint8Array;
  /** Булангийн өндөр, м.д.т.д. — (ny+1) × (nx+1), мөр 0 = ӨМНӨД зах */
  z: Float32Array;
  /** Нарийн (≈75 м) хөрсний индексийн PNG */
  finePng: Blob;
  /** Жишиг зургийн хавтанцар (JPEG) */
  tiles: Record<string, Blob>;
  /** Ангиллын нийтлэг дараалал */
  keys: string[];
  /** Профайл × ангилал — зузаан, см */
  thick: Float32Array[];
  /** Профайл тутмын гүний усны гүн, см (байхгүй бол 300 = зурагт гарахгүй) */
  gwcm: number[];
  /** Хэвтээ масштаб — 1° уртраг / өргөрөг хэдэн метр */
  mLon: number;
  mLat: number;
};

let pending: Promise<SoilData> | null = null;

export function fetchSoilProfile(): Promise<SoilData> {
  pending ??= load().catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}

async function load(): Promise<SoilData> {
  // eslint-disable-next-line no-restricted-globals -- статик файл, портал биш
  const res = await fetch(asset("/data/soil-profile-3d.bin"));
  if (!res.ok) throw new Error(`Хөрсний блокийн өгөгдөл уншигдсангүй (${res.status})`);
  const buf = await res.arrayBuffer();
  const headLen = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen))) as SoilHeader;
  const block = (name: string) => header.blocks.find((b) => b.name === name)!;
  const bytes = (name: string) => {
    const b = block(name);
    return new Uint8Array(buf, b.offset, b.count);
  };

  const cells = bytes("cells");
  const zb = block("z");
  /* ⚠ Багцлах үед 4 байтад эгнүүлсэн тул `Int16Array`-ийг ШУУД харж болно */
  const raw = new Int16Array(buf, zb.offset, zb.count);
  const z = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) z[i] = raw[i] + LIFT;

  const tiles: Record<string, Blob> = {};
  for (const b of header.blocks) {
    if (b.name.startsWith("tile")) tiles[b.name.slice(4)] = new Blob([bytes(b.name)], { type: "image/jpeg" });
  }

  const { profiles } = header;
  const keys = [...new Set(profiles.flatMap((p) => p.hz.map((h) => hcls(h.n))))].sort(
    (a, b) => SLOT[a] - SLOT[b] || HORD.indexOf(a) - HORD.indexOf(b),
  );
  const thick = profiles.map((p) => {
    const T = new Float32Array(keys.length);
    for (const h of p.hz) T[keys.indexOf(hcls(h.n))] += h.b - h.t;
    return T;
  });
  /* ⚠ Гүний ус бүртгэгдээгүй бол 3 метр гэж үзнэ — блокийн 2 метрийн
     доод хилээс гүн тул ханасан хэсэг зурагдахгүй, "ус байхгүй" гэж
     ХУДЛАА мэдэгдэхгүй */
  const gwcm = profiles.map((p) => (p.gwm != null ? p.gwm * 100 : 300));

  const lat0 = header.y0 + (header.ny * header.dy) / 2;
  return {
    header,
    cells,
    z,
    finePng: new Blob([bytes("finePng")], { type: "image/png" }),
    tiles,
    keys,
    thick,
    gwcm,
    mLon: 111320 * Math.cos((lat0 * Math.PI) / 180),
    mLat: 110574,
  };
}

/* ── Профайлын холимог ────────────────────────────────────────────── */

export type Blend = {
  /** Ангилал тутмын зузаан, см */
  T: Float32Array;
  /** Гүний усны гүн, см */
  gw: number;
  /** Профайл тутмын жин (нийлбэр 1) */
  w: Float32Array;
};

export type Band = { c: string; t: number; b: number; sat: boolean };

/** Профайлыг давхаргын жагсаалт болгоно; ангилал бүр гүний усны түвшнээр 2 хуваагдана */
export function bandsOf(pr: Blend, keys: string[]): Band[] {
  const out: Band[] = [];
  let t = 0;
  for (let k = 0; k < keys.length; k++) {
    const b = t + pr.T[k];
    const g = Math.min(b, Math.max(t, pr.gw));
    out.push({ c: keys[k], t, b: g, sat: false }, { c: keys[k], t: g, b, sat: true });
    t = b;
  }
  return out;
}

export const bandAt = (pr: Blend, keys: string[], cm: number): Band | undefined =>
  bandsOf(pr, keys).find((b) => cm >= b.t && cm < b.b);

/** Тогтмол үртэй санамсаргүй тоо — хэв маяг зурагдалт бүрд ИЖИЛ гарна */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
