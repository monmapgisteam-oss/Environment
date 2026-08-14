/**
 * Нөхөн сэргээлт — хоёр санхүүжилтийн эх үүсвэр.
 *
 * · `aan` — аж ахуйн нэгжийн хөрөнгөөр (гүйцэтгэгч ААН, төсөвт өртөгтэй)
 * · `tusuw` — нийслэлийн төсвөөр (2018–2025)
 *
 * **Нэг талбай = ОЛОН цэг.** Эх сурвалж нь талбайн буланг цэгээр
 * тэмдэглэсэн байдаг: 181 цэг нь ердөө 8 талбай, 12 цэг нь 3 талбай.
 * Тиймээс мөрөөр нь тоолох, талбайн хэмжээг нэмэх нь БУРУУ (181 мөрийн
 * "га"-г нэмбэл 4,433 га гарах ба бодит нь 166 га).
 *
 * Бүлэглэх түлхүүр: дугаар + он + байршил + талбайн хэмжээ. Эдгээр нь
 * давхцвал нэг талбайн булангууд гэж үзнэ.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";

export type FundingId = "aan" | "tusuw";

/** Эх сурвалжийн хуудсанд бүртгэхэд */
export const RECLAMATION_SERVICES = [
  `${HOST}/Nuhun_sergeelt_aan_hurungu/FeatureServer/0`,
  `${HOST}/Nuhun_sergeelt_niisleliin_tusuw/FeatureServer/0`,
];

export const FUNDING = [
  { id: "aan" as const, label: "ААН-ийн хөрөнгөөр", layer: "Nuhun_sergeelt_aan_hurungu" },
  { id: "tusuw" as const, label: "Нийслэлийн төсвөөр", layer: "Nuhun_sergeelt_niisleliin_tusuw" },
];

/** Нэг нөхөн сэргээлтийн талбай */
export type ReclamationSite = {
  /** Бүлэглэлтээс үүссэн дугаар — газрын зураг, сонголтод хэрэглэнэ */
  oid: number;
  funding: FundingId;
  no: string;
  year: number;
  /** "Багануур 1-р хороо" гэх бүтэн бичвэр */
  place: string;
  district: string;
  khoroo: string | null;
  ha: number;
  /** Гүйцэтгэгч — зөвхөн ААН-ийн хөрөнгөөр хийсэн ажилд бий */
  contractor: string | null;
  /** Төсөвт өртөг, мянган төгрөг — зөвхөн ААН-ийн эх сурвалжид бий */
  cost: number | null;
  /** Талбайн төлөөлөх цэг (булангуудын дундаж) */
  lon: number;
  lat: number;
  /** Булангийн цэгүүд — газрын зурагт талбайг зурахад */
  ring: [number, number][];
};

type Row = {
  F_?: string;
  Он?: number;
  Дүүрэг_хороо?: string;
  Талбайн_хэмжээ_га?: number;
  Төсөвт_өртөг_мян_төг?: number;
  Гүйцэтгэсэн_ААН?: string;
};

/**
 * "Багануур 1-р хороо" → дүүрэг ба хороо.
 *
 * Багахангай гэх мэт хороо дурдаагүй бичлэг байдаг тул хороо нь
 * заавал байх шаардлагагүй.
 */
function splitPlace(raw: string) {
  const m = raw.match(/^(.*?)\s+(\d+)-р хороо$/);
  if (!m) return { district: raw.trim(), khoroo: null };
  return { district: m[1].trim(), khoroo: `${Number(m[2])}-р хороо` };
}

async function fetchOne(f: (typeof FUNDING)[number], base: number): Promise<ReclamationSite[]> {
  const url =
    `${HOST}/${f.layer}/FeatureServer/0/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "*",
      /* Геометр нь UTM 48N-д проекцлогдсон */
      outSR: "4326",
      resultRecordCount: "2000",
      f: "json",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${f.label}: татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    error?: { message: string };
    features?: { attributes: Row; geometry?: { x: number; y: number } }[];
  };
  if (json.error) throw new Error(json.error.message);

  const groups = new Map<string, { row: Row; pts: [number, number][] }>();
  for (const feat of json.features ?? []) {
    const g = feat.geometry;
    if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
    const a = feat.attributes;
    const key = [a.F_, a.Он, a.Дүүрэг_хороо, a.Талбайн_хэмжээ_га].join("|");
    const hit = groups.get(key) ?? { row: a, pts: [] };
    hit.pts.push([g.x, g.y]);
    groups.set(key, hit);
  }

  const out: ReclamationSite[] = [];
  let i = 0;
  for (const { row, pts } of groups.values()) {
    const place = row.Дүүрэг_хороо ?? "Тодорхойгүй";
    const { district, khoroo } = splitPlace(place);
    out.push({
      oid: base + i++,
      funding: f.id,
      no: String(row.F_ ?? ""),
      year: Number(row.Он) || 0,
      place,
      district,
      khoroo,
      ha: Number(row.Талбайн_хэмжээ_га) || 0,
      contractor: row.Гүйцэтгэсэн_ААН?.replace(/["“”]/g, "").trim() || null,
      cost: typeof row.Төсөвт_өртөг_мян_төг === "number" ? row.Төсөвт_өртөг_мян_төг : null,
      lon: pts.reduce((s, p) => s + p[0], 0) / pts.length,
      lat: pts.reduce((s, p) => s + p[1], 0) / pts.length,
      ring: orderRing(pts),
    });
  }
  return out;
}

/**
 * Булангуудыг олон өнцөгт болгон эрэмбэлнэ.
 *
 * Эх сурвалжид цэгүүд дараалалгүй байдаг тул шууд холбовол өөрөө
 * огтолсон "од" үүснэ. Төвөөс нь харсан ӨНЦГӨӨР эрэмбэлбэл гүдгэр
 * ойролцоолол гарна — талбайн бодит хэлбэр биш ч байршил, хэмжээг
 * зөв илэрхийлнэ.
 */
function orderRing(pts: [number, number][]): [number, number][] {
  if (pts.length < 3) return pts;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const sorted = [...pts].sort(
    (a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  );
  return [...sorted, sorted[0]];
}

export async function fetchReclamation(): Promise<ReclamationSite[]> {
  const [aan, tusuw] = await Promise.all([
    fetchOne(FUNDING[0], 0),
    fetchOne(FUNDING[1], 1000),
  ]);
  return [...aan, ...tusuw].sort((a, b) => b.year - a.year || b.ha - a.ha);
}
