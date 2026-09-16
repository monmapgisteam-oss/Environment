/**
 * Өргөдлийн талбай — бүртгэл, шийдвэрлэлт.
 *
 * 134 өргөдөл, бүгд 2025-05-28-нд бүртгэгдсэн (нэг багц). Энэ нь
 * хэмжилтийн БИШ ажлын урсгалын дата: өргөдөл ирж, анхан шатны шүүлтэд
 * орж, засварлах шаардлагатай бол буцаж, эцэст нь АМГТГ руу илгээгддэг.
 *
 * "Анхан шатны шүүлт" нь ЧӨЛӨӨТ БИЧВЭР (65 өөр утга): дийлэнх нь
 * "Дараагийн шатны шүүлтэд илгээх" боловч үлдсэн нь давхцал, талбайн
 * хэлбэр, бичиг баримтын тухай тэмдэглэл. Түлхүүр үгээр бүлэглэнэ,
 * эх бичвэрийг `screeningRaw`-д бүтнээр нь үлдээнэ.
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";

const SERVICE = `${HOSTING}/Hosted/X01_Urgudliin_talbai/FeatureServer/9`;

export const PETITIONS_SERVICE = SERVICE;

export type Petition = {
  oid: number;
  /** "B77-2505-001821" */
  reg: string;
  company: string;
  district: string;
  khoroo: string;
  /** Өргөдөлд заасан талбай, га */
  ha: number;
  /** Анхан шатны шүүлтийн бүлэг */
  screening: ScreeningId;
  screeningRaw: string;
  /** Дараагийн алхам ("засварлах" талбар) */
  stage: string;
  /** Чөлөөт бичвэрээр заасан байршил */
  place: string;
};

export type PetitionData = {
  rows: Petition[];
  shapes: GeoJSON.FeatureCollection;
};

/**
 * Анхан шатны шүүлтийн бүлэг.
 *
 * Дарааллаар нь шалгана: нэг тэмдэглэлд хэд хэдэн шалтгаан зэрэг
 * дурдагдсан байдаг тул эхэлж таарсан нь ялна. "Илгээх" -ийг ХАМГИЙН
 * ТҮРҮҮНД шалгана — бусад үг агуулсан ч эцсийн шийдвэр нь тэр.
 */
export const SCREENINGS = [
  { id: "pass", label: "Дараагийн шатанд илгээх" },
  { id: "overlap", label: "Давхцалтай" },
  { id: "shape", label: "Талбайн хэлбэр зөрчилтэй" },
  { id: "docs", label: "Бичиг баримт дутуу" },
  { id: "other", label: "Бусад тэмдэглэл" },
  { id: "none", label: "Тэмдэглэлгүй" },
] as const;

export type ScreeningId = (typeof SCREENINGS)[number]["id"];

export function classifyScreening(raw: string): ScreeningId {
  const t = raw.trim().toLowerCase();
  if (!t) return "none";
  if (t.startsWith("дараагийн шатны шүүлтэд илгээх")) return "pass";
  if (t.includes("давхцал") || t.includes("давхцлыг") || t.includes("давхлыг")) return "overlap";
  if (t.includes("тэгш бус") || t.includes("хэлбэртэй") || t.includes("өнцөгт")) return "shape";
  if (t.includes("ирүүлээгүй") || t.includes("зураг") || t.includes("солбицол")) return "docs";
  return "other";
}

type Props = {
  objectid: number;
  бүртгэлийн_дугаар?: string;
  аж_ахуйн_нэгжийн_нэр?: string;
  дүүрэг?: string;
  хороо?: string;
  s?: number;
  анхан_шатны_шүүлт?: string;
  засварлах?: string;
  өргөдлийн_байршил?: string;
};

export async function fetchPetitions(): Promise<PetitionData> {
  const url =
    `${SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: [
        "objectid",
        "бүртгэлийн_дугаар",
        "аж_ахуйн_нэгжийн_нэр",
        "дүүрэг",
        "хороо",
        "s",
        "анхан_шатны_шүүлт",
        "засварлах",
        "өргөдлийн_байршил",
      ].join(","),
      outSR: "4326",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const json = await arcgisJson<{
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  }>(url, "Өргөдлийн талбай");

  const rows: Petition[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.objectid);
    const raw = (p.анхан_шатны_шүүлт ?? "").replace(/\s+/g, " ").trim();
    rows.push({
      oid,
      reg: p.бүртгэлийн_дугаар?.trim() || "—",
      company: p.аж_ахуйн_нэгжийн_нэр?.trim() || "—",
      district: p.дүүрэг?.trim() || "Тодорхойгүй",
      khoroo: p.хороо?.trim() || "Тодорхойгүй",
      ha: Number(p.s) || 0,
      screening: classifyScreening(raw),
      screeningRaw: raw,
      stage: p.засварлах?.replace(/\s+/g, " ").trim() || "Тодорхойгүй",
      place: p.өргөдлийн_байршил?.replace(/\s+/g, " ").trim() || "",
    });
    if (!f.geometry) continue;
    shapes.push({
      type: "Feature",
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  rows.sort((a, b) => a.reg.localeCompare(b.reg));
  return { rows, shapes: { type: "FeatureCollection", features: shapes } };
}
