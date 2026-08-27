/**
 * Ойн хэлтэс — ойн сангийн талбай.
 *
 * Эх сурвалж: `Oi_san` FeatureServer, `Oin_San_Talbai` давхарга,
 * 7,707 олон өнцөгт.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ ГУРВАН ХҮРЭЭНИЙ ОЛОН ӨНЦӨГТ                                      │
 * └──────────────────────────────────────────────────────────────────┘
 * Геометрийн нийт талбай 267,253 га боловч бүртгэсэн талбайн нийлбэр
 * ердөө 122,712 га — хоёр дахин зөрөө. Шалтгаан нь: ГУРВАН бичлэг
 * (oid 7706, 7707, 1441) нь ойн сангийн ГАДНА ХҮРЭЭ бөгөөд 99,456 ба
 * 22,781 га (сүүлийнх нь хоёр удаа давхардсан) эзэлдэг. Тэдгээрийн
 * `Hectares`, `Talbai`, `Hes_Num`, `Yal_Num` бүгд ТЭГ.
 *
 * Тиймээс тэдгээрийг тооллого, талбайн нийлбэрээс ХАСНА — эс тэгвээс
 * ойн сангийн хэмжээ хоёр дахин үрсгэгдэнэ. Ялгах шалгуур нь
 * `Hes_Num = 0` (жинхэнэ талбай бүр хэсгийн дугаартай).
 *
 * Үлдсэн 55 бичлэгийн `Talbai` мөн тэг боловч тэдгээр нь жинхэнэ
 * талбай — 0.5 га-аас жижиг тул бүхэл тоо руу бөөрөнхийлөгдсөн.
 * `Hectares` (бутархайтай) нь тэднийг зөв хадгална.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const PAGE = 2000;
/** ~10 метрийн ерөнхийлөлт (градусаар) */
const OFFSET = 0.0001;

export const FOREST_FUND_SERVICE = `${HOST}/Oi_san/FeatureServer/1`;

export type FundParcel = {
  oid: number;
  /** Талбай, га — бутархайтай `Hectares`, бөөрөнхийлсөн `Talbai` биш */
  ha: number;
  /** Ойн ангийн хэсгийн дугаар (1–219) */
  section: number;
  /** Ялгаралын дугаар (0–31) */
  unit: number;
  /**
   * Тусгай хамгаалалтын статус. Эх сурвалжид зөвхөн 1,440 талбайд
   * бөглөгдсөн ("Дархан цаазат газар" / "Богдхан уул"), үлдсэнд нь
   * хоосон. Хоосон нь "хамгаалалтгүй" гэсэн үг БИШ — энэ давхаргад
   * тэмдэглэгдээгүй гэсэн үг.
   */
  protectedArea: string;
  status: "spa" | "none";
};

export type FundData = {
  parcels: FundParcel[];
  shapes: GeoJSON.FeatureCollection;
  /** Ойн сангийн гадна хүрээ — тооллогод ОРОХГҮЙ, зөвхөн зурагт */
  outline: GeoJSON.FeatureCollection;
};

export const STATUS = [
  { id: "spa", label: "Дархан цаазат газарт" },
  { id: "none", label: "Тэмдэглэгээгүй" },
] as const;

export const STATUS_LABEL = new Map<string, string>(
  STATUS.map((s) => [s.id, s.label] as [string, string]),
);

/**
 * Хэмжээний ангилал — эх сурвалжийнх БИШ, тоон мужаар нэрлэв.
 * Талбай 0-оос 146 га хүртэл тул алхам нь ойн төрлийнхөөс нарийн.
 */
export const SIZE_CLASSES = [
  { id: "0", label: "1 га-аас бага", max: 1 },
  { id: "1", label: "1 – 5 га", max: 5 },
  { id: "2", label: "5 – 20 га", max: 20 },
  { id: "3", label: "20 – 50 га", max: 50 },
  { id: "4", label: "50 га-аас их", max: Infinity },
] as const;

export function sizeClass(ha: number): number {
  for (let i = 0; i < SIZE_CLASSES.length; i++) {
    if (ha < SIZE_CLASSES[i].max) return i;
  }
  return SIZE_CLASSES.length - 1;
}

type Feature = {
  type: "Feature";
  properties: {
    OBJECTID: number;
    Hectares?: number | null;
    Hes_Num?: number | null;
    Yal_Num?: number | null;
    spa_name?: string | null;
    type_name_?: string | null;
  };
  geometry: GeoJSON.Geometry | null;
};

async function page(offset: number, signal?: AbortSignal): Promise<Feature[]> {
  const url =
    `${FOREST_FUND_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,Hectares,Hes_Num,Yal_Num,spa_name,type_name_",
      outSR: "4326",
      geometryPrecision: "5",
      maxAllowableOffset: String(OFFSET),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "OBJECTID",
      f: "geojson",
    });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Ойн сан татагдсангүй (${res.status})`);
  const json = (await res.json()) as { features?: Feature[] };
  return json.features ?? [];
}

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function fetchForestFund(signal?: AbortSignal): Promise<FundData> {
  const pages = await Promise.all(
    [0, PAGE, PAGE * 2, PAGE * 3].map((o) => page(o, signal)),
  );
  const feats = pages.flat();

  const parcels: FundParcel[] = [];
  const shapes: GeoJSON.Feature[] = [];
  const outline: GeoJSON.Feature[] = [];

  for (const f of feats) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    const section = p.Hes_Num ?? 0;

    /* Хэсгийн дугааргүй бичлэг нь талбай биш, ГАДНА ХҮРЭЭ */
    if (!section) {
      if (f.geometry) {
        outline.push({ type: "Feature", id: oid, properties: { oid }, geometry: f.geometry });
      }
      continue;
    }

    const spa = str(p.spa_name);
    parcels.push({
      oid,
      ha: Number(p.Hectares) || 0,
      section,
      unit: p.Yal_Num ?? 0,
      protectedArea: spa ? `${str(p.type_name_)} · ${spa}`.replace(/^ · /, "") : "",
      status: spa ? "spa" : "none",
    });

    if (!f.geometry) continue;
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` ЗААВАЛ */
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  parcels.sort((a, b) => b.ha - a.ha);
  return {
    parcels,
    shapes: { type: "FeatureCollection", features: shapes },
    outline: { type: "FeatureCollection", features: outline },
  };
}
