/**
 * Голын татам — 37 талбай, дөрвөн сав газарт хамаарна.
 *
 * Татам гэдэг нь голын үерийн ус халиадаг нам дор газар. Энэ давхарга
 * нь тэдгээрийн ХҮРЭЭГ (олон өнцөгт) агуулна.
 *
 * **Хэмжээ эрс хазайсан.** Туулын нэг татам 44,186 га, харин 15 талбай
 * нь нэг га ч хүрэхгүй (хамгийн жижиг нь 0.0004 га). Тиймээс "хэдэн
 * татам" гэсэн ТООЛОЛ төөрөгдүүлнэ — бүх үзүүлэлт ГА-гаар илэрхийлэгдэнэ.
 *
 * **Сав газрын нэр нь `PopupInfo` дотор нуугдсан.** `Name` талбар нь
 * латинаар бичигдсэн ("Kherlen", "Umard goviin guveet-Khalhiin d" —
 * 30 тэмдэгтээр тасарсан) бол монгол нэр нь `PopupInfo` доторх HTML
 * хүснэгтийн `MONNAME_1` мөрөнд бий. Тиймээс тэр хүснэгтийг задалж
 * уншина — латин нэрийг гараар орчуулах нь таамаглал болно.
 *
 * Геометрийг серверт ~5м-ээр ерөнхийлүүлнэ (`maxAllowableOffset`):
 * бүтэн нарийвчлалтай нь 862KB, ерөнхийлсөн нь 334KB. Татам нь нарийн
 * урт зурвас хэлбэртэй тул үүнээс их ерөнхийлбөл нарийн хэсэг нь
 * тасарч эхэлнэ.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "Tatam";
/** ~5 метрийн ерөнхийлөлт (градусаар) */
const OFFSET = 0.00005;

export const FLOODPLAIN_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

export type Floodplain = {
  oid: number;
  /** Сав газрын монгол нэр — "Туул", "Хэрлэн" */
  basin: string;
  /** Татмын талбай, га */
  ha: number;
  /** Сав газрын нийт талбай, км² — эх сурвалжийн лавлах утга */
  basinKm2: number | null;
};

export type FloodplainData = {
  rows: Floodplain[];
  /** Газрын зурагт — `id` нь `oid`-тай тэнцүү */
  shapes: GeoJSON.FeatureCollection;
  /** Сав газрууд, талбай буурахаар */
  basins: string[];
};

type Props = {
  OBJECTID: number;
  Name?: string;
  PopupInfo?: string;
  area?: number;
};

/**
 * `PopupInfo` доторх HTML хүснэгтээс нэрлэсэн утгыг салгана.
 *
 * Хүснэгт нь "нэр / утга" гэсэн нүднүүдийн эгнээ тул шошгыг олоод
 * ДАРААХ нүдийг авна. Шошго олдохгүй бол `null` — эх сурвалж талбарыг
 * бөглөөгүй байж болно.
 */
function popupField(html: string | undefined, label: string): string | null {
  if (!html) return null;
  /* Шошгуудын ХООРОНДОХ бичвэрийг шууд түүнэ. Шошгыг зүгээр устгавал
     зэргэлдээ нүднүүд нийлж нэг урт мөр болох тул нэрийг нь салгах
     боломжгүй болно. */
  const cells = (html.match(/>[^<>]+</g) ?? [])
    .map((s) => s.slice(1, -1).trim())
    .filter(Boolean);
  const i = cells.indexOf(label);
  return i >= 0 && i + 1 < cells.length ? cells[i + 1] : null;
}

export async function fetchFloodplains(): Promise<FloodplainData> {
  const url =
    `${FLOODPLAIN_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,Name,PopupInfo,area",
      outSR: "4326",
      maxAllowableOffset: String(OFFSET),
      orderByFields: "OBJECTID",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Голын татам татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };

  const rows: Floodplain[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    const mon = popupField(p.PopupInfo, "MONNAME_1")?.trim();
    const km2 = Number(popupField(p.PopupInfo, "AREA_KM2"));

    rows.push({
      oid,
      /* Монгол нэр байхгүй бол латинаараа үлдээнэ — орчуулж таахгүй */
      basin: mon || p.Name?.trim() || "Тодорхойгүй",
      ha: Number(p.area) || 0,
      basinKm2: Number.isFinite(km2) ? km2 : null,
    });

    if (!f.geometry) continue;
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` шаардлагатай */
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  /* Талбайгаар — том нь эхэндээ */
  rows.sort((a, b) => b.ha - a.ha);

  const byBasin = new Map<string, number>();
  for (const r of rows) byBasin.set(r.basin, (byBasin.get(r.basin) ?? 0) + r.ha);
  const basins = [...byBasin].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  return { rows, shapes: { type: "FeatureCollection", features: shapes }, basins };
}
