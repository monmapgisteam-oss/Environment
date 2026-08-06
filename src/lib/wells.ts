/**
 * Ногоон бүсийн хэлтсийн эх сурвалж — өрөмдмөл худгийн бүртгэл 2015–2025.
 * ArcGIS FeatureServer (12,672 цэг).
 *
 * `_SJ` хувилбар нь орон зайн нэгтгэлээр аймаг/сумын албан ёсны нэрийг
 * агуулдаг тул "Байршил" чөлөөт бичвэрийг задлах шаардлагагүй.
 *
 * Сервер тал дээр бүх хуудсыг татаж, толь бичгээр шахаж клиент рүү нэг удаа
 * явуулна. Ингэснээр 12 мянган цэгийг хөтөч дээр шүүх, тоолох боломжтой.
 */

export const WELLS_SERVICE =
  "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services/hudag_2015_2024_SJ/FeatureServer/0";

const PAGE = 2000;

/**
 * Эх сурвалжийн зарласан хамрах хугацаа (үйлчилгээний нэр: `hudag_2015_2024`).
 *
 * Бодит датад үүнээс гадуур 4 бичлэг байдаг: 3 нь огноогүй, 1 нь 2025 онтой.
 * Эдгээрийг ЧИМЭЭГҮЙ нуухгүй — payload дотор `excluded` гэж тоологдож,
 * дэлгэц дээр тэмдэглэгдэнэ. Тэднийг үлдээвэл оны диаграм 2025 дээр тэг рүү
 * унаж, хамрах хүрээг буруу ойлгуулна.
 */
const COVERAGE: [number, number] = [2015, 2024];

/** Тоон массиваар шахсан бүртгэл — сүлжээгээр дамжуулахад хөнгөн */
export type WellsPayload = {
  n: number;
  /** Толь бичиг: хариуцан гүйцэтгэгч, тоо буурахаар эрэмбэлсэн */
  contractors: string[];
  /** Толь бичиг: сум/дүүрэг, тоо буурахаар эрэмбэлсэн (индекс → өнгө) */
  soums: string[];
  /** Толь бичиг: аймаг/нийслэл, тоо буурахаар эрэмбэлсэн */
  aimags: string[];
  minYear: number;
  maxYear: number;
  /** Хамрах хугацаанаас гадуур байсан тул хассан бичлэгийн тоо */
  excluded: number;
  /** Цэг бүрийн утга — бүгд ижил урттай */
  oid: number[];
  lon: number[];
  lat: number[];
  year: number[];
  month: number[];
  ci: number[];
  si: number[];
  ai: number[];
  fetchedAt: string;
};

type EsriFeature = {
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: Record<string, unknown>;
};

async function fetchPage(offset: number): Promise<EsriFeature[]> {
  const url = `${WELLS_SERVICE}/query?${new URLSearchParams({
    f: "geojson",
    where: "1=1",
    outFields: "OBJECTID,Хариуцан_гүйцэтгэгч,Он,Сар,soum_name,aimag_name",
    outSR: "4326",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    orderByFields: "OBJECTID ASC",
  })}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`ArcGIS ${res.status} (offset ${offset})`);
  const json = (await res.json()) as { features?: EsriFeature[] };
  return json.features ?? [];
}

/** Түр толь бичиг — эцэст нь тоогоор эрэмбэлж дахин индексжүүлнэ */
function dict() {
  const list: string[] = [];
  const index = new Map<string, number>();
  const count: number[] = [];

  return {
    list,
    count,
    add(value: string) {
      let i = index.get(value);
      if (i === undefined) {
        i = list.push(value) - 1;
        index.set(value, i);
        count.push(0);
      }
      count[i]++;
      return i;
    },
    /**
     * Тоо буурах дарааллаар эрэмбэлж, хуучин индексээс шинэ рүү буулгах
     * хүснэгт буцаана. Дараалал тогтмол байснаар өнгө нь утгатай болно —
     * хамгийн түгээмэл ангилал үргэлж эхний өнгийг авна.
     */
    sorted() {
      const order = list.map((_, i) => i).sort((a, b) => count[b] - count[a]);
      const remap = new Int32Array(list.length);
      order.forEach((oldIdx, newIdx) => (remap[oldIdx] = newIdx));
      return { names: order.map((i) => list[i]), remap };
    },
  };
}

export async function getWells(): Promise<WellsPayload> {
  const contractors = dict();
  const soums = dict();
  const aimags = dict();

  const oid: number[] = [];
  const lon: number[] = [];
  const lat: number[] = [];
  const year: number[] = [];
  const month: number[] = [];
  const ci: number[] = [];
  const si: number[] = [];
  const ai: number[] = [];

  let excluded = 0;

  for (let offset = 0; ; offset += PAGE) {
    const feats = await fetchPage(offset);
    if (feats.length === 0) break;

    for (const f of feats) {
      const g = f.geometry;
      if (!g || !Array.isArray(g.coordinates)) continue;
      const [x, y] = g.coordinates;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      const p = f.properties;
      const yr = Number(p["Он"]) || 0;
      if (yr < COVERAGE[0] || yr > COVERAGE[1]) {
        excluded++;
        continue;
      }

      oid.push(Number(p["OBJECTID"]));
      lon.push(Math.round(x * 1e6) / 1e6);
      lat.push(Math.round(y * 1e6) / 1e6);
      year.push(yr);
      month.push(Number(p["Сар"]) || 0);
      ci.push(contractors.add(str(p["Хариуцан_гүйцэтгэгч"])));
      si.push(soums.add(str(p["soum_name"])));
      ai.push(aimags.add(str(p["aimag_name"])));
    }

    if (feats.length < PAGE) break;
  }

  const c = contractors.sorted();
  const s = soums.sorted();
  const a = aimags.sorted();

  return {
    n: oid.length,
    contractors: c.names,
    soums: s.names,
    aimags: a.names,
    minYear: COVERAGE[0],
    maxYear: COVERAGE[1],
    excluded,
    oid,
    lon,
    lat,
    year,
    month,
    ci: ci.map((i) => c.remap[i]),
    si: si.map((i) => s.remap[i]),
    ai: ai.map((i) => a.remap[i]),
    fetchedAt: new Date().toISOString(),
  };
}

function str(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";
  return s || "Тодорхойгүй";
}

/** Нэг худгийн бүрэн бичилт — газрын зураг дээр товшиход татна */
export type WellDetail = {
  OBJECTID: number;
  requester: string;
  contractor: string;
  location: string;
  passport: string;
  soum: string;
  aimag: string;
  date: number | null;
};

export async function getWell(oid: number): Promise<WellDetail | null> {
  const url = `${WELLS_SERVICE}/query?${new URLSearchParams({
    f: "json",
    where: `OBJECTID=${Number(oid)}`,
    outFields: "*",
    returnGeometry: "false",
  })}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    features?: { attributes: Record<string, unknown> }[];
  };
  const a = json.features?.[0]?.attributes;
  if (!a) return null;

  return {
    OBJECTID: Number(a["OBJECTID"]),
    requester: str(a["Хүсэлт_гаргагч"]),
    contractor: str(a["Хариуцан_гүйцэтгэгч"]),
    location: str(a["Байршил"]),
    passport: str(a["Паспорт__бүсчлэлийн_код"]),
    soum: str(a["soum_name"]),
    aimag: str(a["aimag_name"]),
    date: typeof a["Хугацаа"] === "number" ? a["Хугацаа"] : null,
  };
}
