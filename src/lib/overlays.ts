/**
 * Газрын зурагт нэмж болох ХИЛ, БҮСИЙН давхаргууд (`Basemap` FeatureServer).
 *
 * Хэрэглэгч асаах хүртэл ТАТАХГҮЙ: гурвуулаа нийлбэл эх хэмжээгээрээ 7MB.
 * Асаамагц татаад санах ойд хадгална — дахин асаахад дахин татахгүй.
 *
 * Геометрийг серверт ЕРӨНХИЙЛҮҮЛНЭ (`maxAllowableOffset`). Эдгээр нь
 * хэмжилтийн давхарга биш, байрлал тодруулах суурь тул хэдэн арван метрийн
 * нарийвчлал хангалттай — харин жин нь 7 дахин хөнгөрнө.
 */

const SERVICE =
  "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services/Basemap/FeatureServer";

export type OverlayId = "khoroo" | "district" | "zone";

export type OverlayDef = {
  id: OverlayId;
  label: string;
  note: string;
  layer: number;
  fields: string;
  /** Ерөнхийлөх алдаа (градус). 0.0002° ≈ 22м */
  offset: number;
  /** Дүүргэлтийн өнгө. Хоосон бол зөвхөн хүрээ зурна. */
  fill?: {
    color: string;
    /** Тогтмол тунгалаг, эсвэл `gridcode` талбараар шатлах */
    opacity?: number;
    byGrid?: number[];
  };
  line: { color: string; opacity: number; width: number };
};

/*
  Өнгө нь ГАНЦ гэр бүлээс: хил нь саарал-цагаан (газарзүйн лавлагаа), бүс нь
  дата дүрслэлийн цэнхэр. Бүсийн 1–4 нь ЭРЭМБЭТЭЙ утга тул өөр өнгө биш,
  нэг өнгөний өтгөрөлтөөр ялгана.
*/
export const OVERLAYS: OverlayDef[] = [
  {
    id: "district",
    label: "Дүүргийн хил",
    note: "зөвхөн зураас",
    layer: 2,
    fields: "DUUREG",
    offset: 0.0002,
    // Дүүргэлтгүй — доорх дата бүрэн харагдана
    line: { color: "#ffffff", opacity: 0.75, width: 1.6 },
  },
  {
    id: "khoroo",
    label: "Хорооны хил",
    note: "162 хороо",
    layer: 1,
    fields: "KH_MON,DUUREG",
    offset: 0.0002,
    fill: { color: "#ffffff", opacity: 0.04 },
    line: { color: "#ffffff", opacity: 0.3, width: 0.6 },
  },
  {
    id: "zone",
    label: "Нүхэн жорлонгийн бүс",
    note: "1–4, ерөнхийлсөн",
    layer: 8,
    fields: "gridcode",
    // Растераас гаралтай, олон жижиг тойрогтой тул илүү ширүүн ерөнхийлнэ
    offset: 0.001,
    fill: { color: "#00c8ff", byGrid: [0.08, 0.14, 0.22, 0.32] },
    line: { color: "#5ce1ff", opacity: 0.35, width: 0.8 },
  },
];

/** Асаасан давхаргын GeoJSON. Нэг удаа татаад санах ойд үлдэнэ. */
const cache = new Map<OverlayId, GeoJSON.FeatureCollection>();

export async function fetchOverlay(
  def: OverlayDef,
  signal?: AbortSignal,
): Promise<GeoJSON.FeatureCollection> {
  const hit = cache.get(def.id);
  if (hit) return hit;

  const url = `${SERVICE}/${def.layer}/query?${new URLSearchParams({
    f: "geojson",
    where: "1=1",
    outFields: def.fields,
    outSR: "4326",
    maxAllowableOffset: String(def.offset),
  })}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
  const data = (await res.json()) as GeoJSON.FeatureCollection;
  cache.set(def.id, data);
  return data;
}
