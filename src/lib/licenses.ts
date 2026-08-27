/**
 * Нийслэлийн нутаг дэвсгэрт байрлах түгээмэл тархацтай ашигт малтмалын
 * тусгай зөвшөөрөл эзэмшигчид.
 *
 * 146 зөвшөөрөл, 1997–2025 онд олгогдож 2023–2047 онд дуусна. Энэ нь
 * ХУГАЦААТАЙ бүртгэл тул гол хэмжигдэхүүн нь талбай биш ХУГАЦАА:
 * аль нь удахгүй дуусах вэ, аль нь аль хэдийн дууссан вэ.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "TTAMTZ_ashiglalt";

export const LICENSES_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

export type License = {
  oid: number;
  /** "MV-11000216" */
  code: string;
  holder: string;
  district: string;
  khoroo: string;
  /** Ашигт малтмалын төрөл — нэгтгэсэн хэлбэр ("Элс, хайрга") */
  mineral: string;
  ha: number;
  granted: number | null;
  expires: number | null;
};

export type LicenseData = {
  rows: License[];
  shapes: GeoJSON.FeatureCollection;
};

/**
 * Ашигт малтмалын төрлийг нэг хэлбэрт оруулна.
 *
 * "Элс, хайрга" ба "Хайрга, элс" нь нэг зүйл — цагаан толгойн дарааллаар
 * эрэмбэлж нэгтгэнэ. "???" гэх мэт бөглөгдөөгүй утгыг тодорхойгүй гэж
 * үзнэ; ТААМАГЛАЖ нөхөхгүй.
 */
export function normalMineral(raw: string | null | undefined): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t || t === "???" || t === "-") return "Тодорхойгүй";
  const parts = t
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort();
  if (!parts.length) return "Тодорхойгүй";
  return parts.map((p, i) => (i ? p : p[0].toUpperCase() + p.slice(1))).join(", ");
}

/** "2036.12.27" гэх бичвэрээс оныг салгана */
function year(raw: string | null | undefined): number | null {
  const m = String(raw ?? "").match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

/**
 * Хугацааны төлөв.
 *
 * `now` -г ГАДНААС өгнө: модулийн ачаалах үеийн огноог барих нь
 * серверийн болон хөтчийн зурагдалт зөрөх шалтгаан болно.
 */
export const TERMS = [
  { id: "expired", label: "Хугацаа дууссан" },
  { id: "soon", label: "5 жилийн дотор дуусах" },
  { id: "active", label: "Хүчинтэй" },
  { id: "unknown", label: "Огноогүй" },
] as const;

export type TermId = (typeof TERMS)[number]["id"];

export function termOf(expires: number | null, now: number): TermId {
  if (expires == null) return "unknown";
  if (expires < now) return "expired";
  if (expires <= now + 5) return "soon";
  return "active";
}

type Props = {
  OBJECTID: number;
  Тусгай_дугаар?: string;
  Эзэмшигчийн_нэр?: string;
  Дүүрэг?: string;
  NAME_1?: string;
  PopupInfo?: string;
  Талбай?: number;
  Олгосон_он?: string;
  Дуусах_он?: string;
};

export async function fetchLicenses(): Promise<LicenseData> {
  const url =
    `${HOST}/${LAYER}/FeatureServer/0/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: [
        "OBJECTID",
        "Тусгай_дугаар",
        "Эзэмшигчийн_нэр",
        "Дүүрэг",
        "NAME_1",
        "PopupInfo",
        "Талбай",
        "Олгосон_он",
        "Дуусах_он",
      ].join(","),
      outSR: "4326",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Тусгай зөвшөөрөл татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };

  const rows: License[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    rows.push({
      oid,
      code: p.Тусгай_дугаар?.trim() || "—",
      holder: p.Эзэмшигчийн_нэр?.trim() || "—",
      district: p.Дүүрэг?.trim() || "Тодорхойгүй",
      khoroo: p.NAME_1?.trim() || "",
      mineral: normalMineral(p.PopupInfo),
      ha: Number(p.Талбай) || 0,
      granted: year(p.Олгосон_он),
      expires: year(p.Дуусах_он),
    });
    if (!f.geometry) continue;
    shapes.push({
      type: "Feature",
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  rows.sort((a, b) => (a.expires ?? 9999) - (b.expires ?? 9999));
  return { rows, shapes: { type: "FeatureCollection", features: shapes } };
}
