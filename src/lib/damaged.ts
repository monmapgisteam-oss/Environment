/**
 * Эвдэрсэн газар — 2,742 талбай, нийт 29,297 га.
 *
 * Хэмжээний тархалт нь ЭРС ХАЗАЙСАН: дунджаар 0.14 га боловч хамгийн
 * том нь 2,028 га. 1,185 талбай нь 0.1 га-аас бага. Тиймээс "хэдэн
 * талбай" гэсэн тоолол өөрөө төөрөгдүүлнэ — Багануурын 2,412 жижиг
 * зураас нэг том уурхайн талбайтай тэнцэхгүй. Гол хэмжигдэхүүн нь ГА.
 *
 * Геометрийг СЕРВЕРТ ерөнхийлүүлнэ (`maxAllowableOffset`): бүтэн
 * нарийвчлалтай нь 12.6MB, ~10м-ийн ерөнхийлөлтөөр ~1MB. Талбайн
 * ДУНДАЖ хэмжээ 37м орчим тул үүнээс их ерөнхийлбөл жижиг талбайнууд
 * задарч эхэлнэ.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "Ewdersen_gazar";
const PAGE = 2000;
/** ~10 метрийн ерөнхийлөлт (градусаар) */
const OFFSET = 0.0001;

export const DAMAGED_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

export type DamagedSite = {
  oid: number;
  /** Сум эсвэл дүүргийн нэр */
  place: string;
  aimag: string;
  ha: number;
};

export type DamagedData = {
  sites: DamagedSite[];
  /** Газрын зурагт зориулсан олон өнцөгтүүд — `id` нь `oid`-тай тэнцүү */
  shapes: GeoJSON.FeatureCollection;
};

/**
 * Хэмжээний ангилал.
 *
 * Эдгээр нь эх сурвалжаас ирсэн ангилал БИШ, бидний зурсан хуваарь —
 * тиймээс "жижиг / дунд / том" гэж нэрлэхгүй, зөвхөн тоон мужаар нь
 * бичнэ. Логарифм алхамтай: тархалт хэдэн зэргийн хэмжээгээр сунасан.
 */
export const SIZE_CLASSES = [
  { id: "0", label: "0.1 га-аас бага", min: 0, max: 0.1 },
  { id: "1", label: "0.1 – 1 га", min: 0.1, max: 1 },
  { id: "2", label: "1 – 10 га", min: 1, max: 10 },
  { id: "3", label: "10 – 100 га", min: 10, max: 100 },
  { id: "4", label: "100 га-аас их", min: 100, max: Infinity },
] as const;

export function sizeClass(ha: number): number {
  for (let i = 0; i < SIZE_CLASSES.length; i++) {
    if (ha < SIZE_CLASSES[i].max) return i;
  }
  return SIZE_CLASSES.length - 1;
}

type Feature = {
  type: "Feature";
  properties: { OBJECTID: number; soum_name?: string; aimag_name?: string; Area_hec?: number };
  geometry: GeoJSON.Geometry | null;
};

async function page(offset: number): Promise<Feature[]> {
  const url =
    `${HOST}/${LAYER}/FeatureServer/0/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,soum_name,aimag_name,Area_hec",
      outSR: "4326",
      maxAllowableOffset: String(OFFSET),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "OBJECTID",
      f: "geojson",
    });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Эвдэрсэн газар татагдсангүй (${res.status})`);
  const json = (await res.json()) as { features?: Feature[] };
  return json.features ?? [];
}

export async function fetchDamaged(): Promise<DamagedData> {
  /* Хоёр хуудсыг ЗЭРЭГ татна — дараалуулах шалтгаан алга */
  const pages = await Promise.all([page(0), page(PAGE)]);
  const feats = pages.flat();

  const sites: DamagedSite[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of feats) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    const ha = Number(p.Area_hec) || 0;
    sites.push({
      oid,
      place: p.soum_name?.trim() || "Тодорхойгүй",
      aimag: p.aimag_name?.trim() || "Тодорхойгүй",
      ha,
    });
    if (!f.geometry) continue;
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` шаардлагатай — сонгосон талбайг
         тодруулахад хэрэглэнэ */
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  sites.sort((a, b) => b.ha - a.ha);
  return { sites, shapes: { type: "FeatureCollection", features: shapes } };
}
