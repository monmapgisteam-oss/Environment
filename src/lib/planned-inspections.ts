/**
 * Хяналтын хэлтэс — хяналт шалгалтын ТӨЛӨВЛӨГӨӨТ мэдээлэл.
 *
 * Эх сурвалж: `Hosted/Төлөвлөгөөт_мэдээлэл/FeatureServer/6`
 * (`Tuluvlugut_XX_parcel`, хэрэглэгч 2026-11-19 нэмүүлсэн). НЭГЖ ТАЛБАРЫН
 * олон өнцөгт, UTM 48N (SR 32648) тул `outSR=4326` ЗААВАЛ; 2026-11-19-нд
 * 143 объект, 2023–2026 он (2026 — 86).
 *
 * Объект бүр: нэр, нэгж талбар, хаяг, дүүрэг (товчлол — СХД, ХУД …),
 * үйл ажиллагааны чиглэл, газрын зориулалт, усны эх үүсвэр, химийн бодис
 * ашиглагддаг эсэх, хууль сахин мөрдөлтийн хувь, эрсдэл үүсэх магадлал
 * (хувь ба зэрэг — Бага · Дунд · Их).
 *
 * ⚠ `-9999` нь БӨГЛӨӨГҮЙН тэмдэг (хувь, координат) → `null`.
 * ⚠ Эрсдэлийн ЗЭРЭГ нь эх сурвалжийнх — хувиас нь ДАХИН ТООЦОХГҮЙ: хоёр
 *   талбар зөрдөг ("Бага" зэрэгтэй мөрийн хувь 2–100), аль нь зөв нь
 *   тодорхойгүй. Хоёуланг нь байгаагаар нь харуулна.
 * ⚠ `reg_no` (регистрийн дугаар) ТАТАГДАХГҮЙ — иргэн байж болох тул
 *   хувь хүний мэдээлэл хөтөч рүү буухгүй. `lon`, `lat` мөн татахгүй:
 *   байрлал нь геометрээс (олон өнцөгтийн төв).
 * ⚠ Бичиглэлийн хувилбарыг (том/жижиг үсэг — "Төвийн шугам" / "төвийн
 *   шугам") НЭГТГЭНЭ, хамгийн олон тохиолдсон бичиглэлээр (`foldCase`).
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";

export const PLANNED_SERVICE = `${HOSTING}/Hosted/${encodeURIComponent(
  "Төлөвлөгөөт_мэдээлэл",
)}/FeatureServer/6`;

/* Хэрэглэгч 2026-11-19: "ih - ulaan dund - shar baga - nogoon, burtgegdeegui bol tsagaan" */
export const RISK_LEVELS = [
  { id: "Их", label: "Их", hex: "#e47b7b", tone: "var(--clay)" },
  { id: "Дунд", label: "Дунд", hex: "#e5b75a", tone: "var(--ochre)" },
  /* Ногоон бичвэрт `--value-l`-ээр (гэрэл горимд цайвар ногоон уусдаг) */
  { id: "Бага", label: "Бага", hex: "#7fd994", tone: "oklch(from #7fd994 var(--value-l) calc(c * var(--value-c)) h)" },
  { id: "", label: "Бүртгэгдээгүй", hex: "#ffffff", tone: "var(--ink-3)" },
] as const;

export type RiskId = (typeof RISK_LEVELS)[number]["id"];

export const riskOf = (id: string) =>
  RISK_LEVELS.find((r) => r.id === id) ?? RISK_LEVELS[RISK_LEVELS.length - 1];

/*
  ҮЙЛ АЖИЛЛАГААНЫ ЧИГЛЭЛИЙН БҮЛЭГ (хэрэглэгч 2026-11-19: "Үйл ажиллагааны чиглэлээр eniig bulegle
  Бодисын товьёог shig"). Чөлөөт бичвэр, 71 өөр утга — түлхүүр үгээр бүлэглэнэ; эх нэр нь
  `activity`-д хэвээр (бүлгийг задлахад гарна). Эх сурвалжийн ангилал БИШ, уншихад туслах давхарга.
  ДАРААЛАЛ чухал: хог хаягдал эхэнд ("Хаягдал төмөр", "Аюултай хог хаягдал"), барилгын материал
  металлаас өмнө ("Төмөр, бетон хийц эдлэл"), хими худалдаанаас өмнө ("Химийн бодис … худалдаалах"),
  авто үйлчилгээнээс өмнө ("Автомашин худалдаа, засвар"). "Түгээмэл" нь түгээмэл тархацтай ашигт
  малтмалын товчлол.
*/
export const ACTIVITY_GROUPS = [
  { id: "waste", label: "Хог хаягдал, дахин боловсруулалт", match: /хог|хаягдал|хягдл|цэвэрлэх байгууламж/ },
  { id: "meat", label: "Мах, махан бүтээгдэхүүн", match: /мах|өлөн|гэдэс/ },
  { id: "food", label: "Хүнс, ундаа", match: /хүнс|зайрмаг|шар айраг|цэвэр ус|ундаа/ },
  { id: "textile", label: "Арьс шир, ноос ноолуур, нэхмэл", match: /арьс|ноос|ноолуур|нэхмэл|ээрмэл|сүлж/ },
  { id: "build", label: "Барилгын материал", match: /бетон|тоосг|цемент|асфальт|барилгын материал/ },
  { id: "metal", label: "Металл боловсруулалт", match: /төмөр|төмр|(^|\s)ган(\s|$)|хайлш|хөнгөн цагаан|хайлуул|зэс/ },
  { id: "plastic", label: "Хуванцар, резин", match: /гялгар|резин|хөөсөнцөр|хуванцар/ },
  { id: "chem", label: "Хими, эм, хий", match: /хими|эм ханг|эмнэлгийн хий|гагнуур|шатах хий|гоо сайхан|дусл|тэсрэх|ур,?\s*хам|ариутгал|лаборатори/ },
  { id: "mineral", label: "Ашигт малтмал", match: /ашигт малтмал|түгээмэл/ },
  { id: "auto", label: "Авто үйлчилгээ, шатахуун", match: /авто|шатахуун/ },
  { id: "service", label: "Үйлчилгээ, аялал жуулчлал", match: /аялал|жуулчлал|зочид буудал|бассейн|бялдаржуулах|худалдаа|үйлчилгээ|эмнэлэг/ },
  { id: "energy", label: "Эрчим хүч", match: /дулаан|цахилгаан/ },
  { id: "other", label: "Бусад үйлдвэрлэл", match: /.^/ },
  { id: "", label: "Бүртгэгдээгүй", match: /.^/ },
] as const;

export const ACTIVITY_GROUP_LABEL = new Map<string, string>(ACTIVITY_GROUPS.map((g) => [g.id, g.label]));

export function classifyActivity(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  for (const g of ACTIVITY_GROUPS) if (g.match.test(t)) return g.id;
  return "other";
}

export type PlannedObject = {
  oid: number;
  year: number | null;
  name: string;
  parcel: string;
  address: string;
  /** Дүүргийн товчлол, хоосон бол `""` */
  district: string;
  activity: string;
  /** Чиглэлийн бүлэг ({@link classifyActivity}) */
  activityGroup: string;
  landUse: string;
  water: string;
  /** "Тийм" · "Үгүй" · "" */
  chemical: string;
  /** Хууль сахин мөрдөлт, хувь */
  law: number | null;
  /** Эрсдэл үүсэх магадлал, хувь */
  riskPct: number | null;
  risk: RiskId;
  /** Талбай, га (UTM тул SHAPE__Area нь бодит м²) */
  ha: number | null;
  /** Олон өнцөгтийн төв — ойртолтод (зурагт цэг БАЙХГҮЙ) */
  lon: number;
  lat: number;
};

export type PlannedData = {
  rows: PlannedObject[];
  shapes: GeoJSON.FeatureCollection;
};

type Props = {
  fid?: number;
  year?: number | null;
  name?: string | null;
  parcel_no?: string | null;
  address?: string | null;
  district?: string | null;
  activity?: string | null;
  land_use?: string | null;
  water_src?: string | null;
  chemical?: string | null;
  law_pct?: number | null;
  risk_pct?: number | null;
  risk_lvl?: string | null;
  SHAPE__Area?: number | null;
};

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const measured = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) || v <= -9999 ? null : v;

/** Том/жижиг үсгээр л ялгаатай утгуудыг хамгийн олон тохиолдсон бичиглэлд буулгана */
function foldCase(values: string[]): (v: string) => string {
  const by = new Map<string, Map<string, number>>();
  for (const v of values) {
    if (!v) continue;
    const k = v.toLowerCase();
    const m = by.get(k) ?? new Map<string, number>();
    m.set(v, (m.get(v) ?? 0) + 1);
    by.set(k, m);
  }
  const canon = new Map<string, string>();
  for (const [k, m] of by) canon.set(k, [...m].sort((a, b) => b[1] - a[1])[0][0]);
  return (v) => (v ? (canon.get(v.toLowerCase()) ?? v) : "");
}

/** Хамгийн том цагирагийн оройн дундаж — жижиг нэгж талбарт хангалттай */
function centerOf(g: GeoJSON.Geometry): [number, number] {
  const rings =
    g.type === "Polygon"
      ? [g.coordinates[0]]
      : g.type === "MultiPolygon"
        ? g.coordinates.map((p) => p[0])
        : [];
  const ring = rings.sort((a, b) => b.length - a.length)[0];
  if (!ring?.length) return [NaN, NaN];
  let x = 0;
  let y = 0;
  for (const [lon, lat] of ring) {
    x += lon;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}

export async function fetchPlanned(signal?: AbortSignal): Promise<PlannedData> {
  const url =
    `${PLANNED_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: [
        "fid",
        "year",
        "name",
        "parcel_no",
        "address",
        "district",
        "activity",
        "land_use",
        "water_src",
        "chemical",
        "law_pct",
        "risk_pct",
        "risk_lvl",
        "SHAPE__Area",
      ].join(","),
      outSR: "4326",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const json = await arcgisJson<{
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  }>(url, "Төлөвлөгөөт мэдээлэл", { signal });

  const feats = json.features ?? [];
  const activity = foldCase(feats.map((f) => clean(f.properties.activity)));
  const landUse = foldCase(feats.map((f) => clean(f.properties.land_use)));
  const water = foldCase(feats.map((f) => clean(f.properties.water_src)));

  const rows: PlannedObject[] = [];
  const shapes: GeoJSON.Feature[] = [];
  for (const f of feats) {
    const p = f.properties;
    const oid = Number(p.fid);
    const [lon, lat] = f.geometry ? centerOf(f.geometry) : [NaN, NaN];
    const lvl = clean(p.risk_lvl);
    const area = measured(p.SHAPE__Area);
    rows.push({
      oid,
      year: measured(p.year ?? null),
      name: clean(p.name) || "—",
      parcel: clean(p.parcel_no),
      address: clean(p.address),
      district: clean(p.district).toUpperCase(),
      activity: activity(clean(p.activity)),
      activityGroup: classifyActivity(clean(p.activity)),
      landUse: landUse(clean(p.land_use)),
      water: water(clean(p.water_src)),
      chemical: clean(p.chemical),
      law: measured(p.law_pct),
      riskPct: measured(p.risk_pct),
      risk: riskOf(lvl).id,
      ha: area == null ? null : area / 10000,
      lon,
      lat,
    });
    if (f.geometry) shapes.push({ type: "Feature", id: oid, properties: { oid }, geometry: f.geometry });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "mn"));
  return { rows, shapes: { type: "FeatureCollection", features: shapes } };
}
