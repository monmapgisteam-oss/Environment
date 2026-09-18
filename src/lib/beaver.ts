/**
 * Минжний судалгаа — ГУРВАН давхарга, НЭГ судалгаа.
 *
 * Эх сурвалж судалгааг гурав хувааж хадгалсан:
 *
 *  · `A08_minj_talbai` — судалгааны ТАЛБАЙ, 2 олон өнцөгт
 *    (Хагтуул 10,235 га, Горхи-Тэрэлж ДЦГ 291,995 га);
 *  · `A08_minj_marshrut` — явсан МАРШРУТ, 12 шугам, нийт 424 км;
 *  · `A08_minj_ba_busad` — АЖИГЛАЛТ, 120 цэг, найман ангилал.
 *
 * Эдгээр нь гурван сэдэв БИШ: "хаана явж, юу олсон" гэдгийг зөвхөн
 * гуравт нь зэрэг харж ойлгоно. Тиймээс гурвуулаа НЭГ ДУУДЛАГААР
 * татагдана.
 *
 * ⚠⚠ **ДИЙЛЭНХ НЬ НИЙСЛЭЛЭЭС ГАДУУР**: 120 ажиглалтын **116 нь Төв
 * аймгийн Эрдэнэ сум**, ердөө 4 нь Баянзүрх дүүрэгт. "Нийслэлийн
 * судалгаа" гэж үзвэл буруу — самбарын байршлын задаргаа сум,
 * дүүргийг НЭГ тэнхлэгт тавьдаг нь энэ учраас.
 *
 * ⚠ Маршрутын `name`, `descript`, `type` талбарууд бараг хоосон
 * (11/12 мөрд ганц зай), `id` бүгд тэг — GPS-ийн түүхий гаралт тул
 * уншаагүй. Утга агуулсан нь `urt_km` ба `on_` хоёр.
 */

import { arcgisJson } from "@/lib/arcgis";
import { pointOf } from "@/lib/extent";
import { layerService } from "@/lib/portal-layers";

/** Ажиглалтын нэг цэг */
export type BeaverSpot = {
  oid: number;
  lon: number;
  lat: number;
  no: number;
  /** Ангилал — эх сурвалжийн найман утга */
  kind: string;
  /** Дэд төрөл ("Шинэ" / "Хуучин"). 120-аас 10 мөрд л бөглөгдсөн */
  sub: string;
  /** Судалгааны үе — "2024.12.11-13" гэх мэт */
  round: string;
  /** Аймаг, хот ба сум, дүүргийг НЭГ мөрөнд: судалгаа хоёуланд нь явсан */
  place: string;
  /** GPS-ийн цэгийн дугаар. 120-аас 42 мөрд л бий */
  mark: string;
};

/** Судалгааны талбай */
export type BeaverArea = {
  oid: number;
  name: string;
  /** Талбай, га — эх сурвалжийн бичсэнээр */
  ha: number;
};

export type BeaverData = {
  spots: BeaverSpot[];
  points: { oid: number[]; lon: number[]; lat: number[] };
  areas: BeaverArea[];
  /** Талбайн хүрээ — `id` нь `BeaverArea.oid` */
  areaShapes: GeoJSON.FeatureCollection;
  /** Маршрутын шугамууд */
  routes: GeoJSON.FeatureCollection;
  /** Маршрутын нийт урт, км */
  routeKm: number;
};

const tidy = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

type Props = Record<string, unknown>;

async function layer<T>(
  id: string,
  params: Record<string, string>,
  label: string,
  signal?: AbortSignal,
) {
  const url =
    `${layerService(id)}/0/query?` +
    new URLSearchParams({
      where: "1=1",
      outSR: "4326",
      resultRecordCount: "2000",
      ...params,
    });
  return arcgisJson<T>(url, label, { signal });
}

export async function fetchBeaver(signal?: AbortSignal): Promise<BeaverData> {
  /* Гурвуулаа ЗЭРЭГ — нэг судалгааны гурван тал, дараалуулах шалтгаан алга */
  const [obs, areas, routes] = await Promise.all([
    layer<{
      features?: {
        attributes: Props;
        geometry?: { x: number; y: number } | null;
      }[];
    }>(
      "A08_minj_ba_busad",
      {
        outFields: "*",
        returnGeometry: "true",
        f: "json",
        orderByFields: "д_д",
      },
      "Минжний ажиглалт",
      signal,
    ),
    layer<{
      features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
    }>(
      "A08_minj_talbai",
      { outFields: "objectid,ner,talbai_ga", f: "geojson" },
      "Минжний судалгааны талбай",
      signal,
    ),
    layer<{
      features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
    }>(
      "A08_minj_marshrut",
      { outFields: "objectid,urt_km,on_", f: "geojson" },
      "Минжний маршрут",
      signal,
    ),
  ]);

  const spots: BeaverSpot[] = [];
  for (const f of obs.features ?? []) {
    const a = f.attributes;
    const g = f.geometry;
    const at = pointOf(g, a["уртраг__x_"], a["өргөрөг__y_"]);
    if (!at) continue;
    const { lon, lat } = at;

    /* Аймаг/хот ба сум/дүүргийг НЭГТГЭНЭ: судалгаа Төв аймаг, нийслэл
       хоёуланд нь явсан тул тусад нь харуулбал хоёр бараг ижил
       задаргаа гарна */
    const region = tidy(a["аймаг__хот"]);
    const soum = tidy(a["сум__дүүрэг"]);

    spots.push({
      oid: Number(a.objectid),
      lon,
      lat,
      no: Number(a["д_д"]) || spots.length + 1,
      kind: tidy(a["ангилал"]) || "Тодорхойгүй",
      sub: tidy(a["дэд_төрөл"]),
      round: tidy(a["судалгааны_үе"]) || "Тодорхойгүй",
      place: [region, soum].filter(Boolean).join(", ") || "Тодорхойгүй",
      mark: tidy(a["тэмдэглэгээ"]),
    });
  }
  spots.sort((x, y) => x.no - y.no);

  const areaRows: BeaverArea[] = [];
  const areaShapes: GeoJSON.Feature[] = [];
  for (const f of areas.features ?? []) {
    const p = f.properties;
    const oid = Number(p.objectid);
    areaRows.push({
      oid,
      name: tidy(p.ner) || "Тодорхойгүй",
      ha: Number(p.talbai_ga) || 0,
    });
    if (!f.geometry) continue;
    /* `feature-state`-д тоон `id` шаардлагатай */
    areaShapes.push({
      type: "Feature",
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }
  areaRows.sort((a, b) => b.ha - a.ha);

  const routeFeatures: GeoJSON.Feature[] = [];
  let routeKm = 0;
  for (const f of routes.features ?? []) {
    routeKm += Number(f.properties.urt_km) || 0;
    if (!f.geometry) continue;
    routeFeatures.push({
      type: "Feature",
      properties: {},
      geometry: f.geometry,
    });
  }

  return {
    spots,
    points: {
      oid: spots.map((s) => s.oid),
      lon: spots.map((s) => s.lon),
      lat: spots.map((s) => s.lat),
    },
    areas: areaRows,
    areaShapes: { type: "FeatureCollection", features: areaShapes },
    routes: { type: "FeatureCollection", features: routeFeatures },
    routeKm,
  };
}
