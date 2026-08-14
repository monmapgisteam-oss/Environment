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

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "Urgudliin_talbai";

export const PETITIONS_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

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
  /** Дараагийн алхам ("Засварлах" талбар) */
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
  OBJECTID: number;
  Бүртгэлийн_дугаар?: string;
  Аж_ахуйн_нэгжийн_нэр?: string;
  Дүүрэг?: string;
  Хороо?: string;
  s?: number;
  Анхан_шатны_шүүлт?: string;
  Засварлах?: string;
  Өргөдлийн_байршил?: string;
};

export async function fetchPetitions(): Promise<PetitionData> {
  const url =
    `${HOST}/${LAYER}/FeatureServer/0/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: [
        "OBJECTID",
        "Бүртгэлийн_дугаар",
        "Аж_ахуйн_нэгжийн_нэр",
        "Дүүрэг",
        "Хороо",
        "s",
        "Анхан_шатны_шүүлт",
        "Засварлах",
        "Өргөдлийн_байршил",
      ].join(","),
      outSR: "4326",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Өргөдлийн талбай татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };

  const rows: Petition[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    const raw = (p.Анхан_шатны_шүүлт ?? "").replace(/\s+/g, " ").trim();
    rows.push({
      oid,
      reg: p.Бүртгэлийн_дугаар?.trim() || "—",
      company: p.Аж_ахуйн_нэгжийн_нэр?.trim() || "—",
      district: p.Дүүрэг?.trim() || "Тодорхойгүй",
      khoroo: p.Хороо?.trim() || "Тодорхойгүй",
      ha: Number(p.s) || 0,
      screening: classifyScreening(raw),
      screeningRaw: raw,
      stage: p.Засварлах?.replace(/\s+/g, " ").trim() || "Тодорхойгүй",
      place: p.Өргөдлийн_байршил?.replace(/\s+/g, " ").trim() || "",
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
