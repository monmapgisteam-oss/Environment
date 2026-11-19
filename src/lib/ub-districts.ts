/**
 * НИЙСЛЭЛИЙН ДҮҮРГИЙН ХИЛ — порталын `soumbnd` давхаргаас (хэрэглэгч
 * 2026-10-14: "энэ дүүргийн хил цаана нь бүдэг өнгөөр харуулъя").
 *
 * Давхарга нь улсын 339 сум, дүүргийг агуулна; `aimag_code = 11`
 * (Улаанбаатар) нь есөн дүүрэг. Бүтэн нарийвчлалаар 400 КБ тул ~20 м-ээр
 * (`maxAllowableOffset` 0.0002°) ерөнхийлж 33 КБ болгоно — суурь хил
 * тул энэ нарийвчлал хангалттай.
 *
 * ⚠ {@link src/lib/boundaries.ts} нь ArcGIS Online дээрх НЭЭЛТТЭЙ
 * хуулбарыг уншдаг (засаг захиргааны бүх шат); энэ нь ПОРТАЛЫН
 * давхарга, токентой, зөвхөн нийслэл.
 * ⚠ Нэг удаа татаж санах ойд үлдээнэ.
 */

import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";

const LAYER = `${layerService("soumbnd")}/0`;

let cache: Promise<GeoJSON.FeatureCollection> | null = null;

export function fetchUbDistricts(): Promise<GeoJSON.FeatureCollection> {
  if (!cache) {
    const url =
      `${LAYER}/query?` +
      new URLSearchParams({
        where: "aimag_code = 11",
        outFields: "soum_name",
        outSR: "4326",
        returnGeometry: "true",
        maxAllowableOffset: "0.0002",
        geometryPrecision: "5",
        f: "geojson",
      });
    cache = arcgisJson<GeoJSON.FeatureCollection>(url, "Дүүргийн хил")
      .then((fc) => {
        /* Эх сурвалж "Хан Уул" гэж зураасгүй бичсэн — албан нэр нь
           "Хан-Уул" (бүртгэлийн дүүргийн утгатай нэг бичиглэл) */
        for (const f of fc.features) {
          const n = f.properties?.soum_name;
          if (typeof n === "string") f.properties!.soum_name = n.trim().replace(/^Хан Уул$/, "Хан-Уул");
        }
        return fc;
      })
      .catch((e) => {
        /* Унасан амлалт кэшид үлдвэл алдаа мөнхөрнө */
        cache = null;
        throw e;
      });
  }
  return cache;
}

/**
 * НИЙСЛЭЛИЙН ХОРООНЫ ХИЛ — порталын `Bag_khil` давхаргаас (хэрэглэгч
 * 2026-10-14: "хорооны хил map дээр харуулъя … 150 000-аас харагдана").
 * Хязгаар дараа нь 1:100 000 болсон (харагдах муж дуудагч талд).
 *
 * Давхарга нь улсын 1,846 баг, хороог агуулна; `au3_code` нь "011"-ээр
 * эхэлсэн 204 нь нийслэлийн хороо. ~10 м-ээр (`maxAllowableOffset`
 * 0.0001°) ерөнхийлж 190 КБ — хорооны хил нь 1:100 000-аас ойртсон үед
 * л харагддаг тул энэ нарийвчлал хангалттай.
 * ⚠ Нэр нь зөвхөн "6-р хороо" — дүүрэггүй (дүүргийн хил, нэр тусдаа).
 */
const KHOROO_LAYER = `${layerService("Bag_khil")}/0`;

let khorooCache: Promise<GeoJSON.FeatureCollection> | null = null;

export function fetchUbKhoroos(): Promise<GeoJSON.FeatureCollection> {
  if (!khorooCache) {
    const url =
      `${KHOROO_LAYER}/query?` +
      new URLSearchParams({
        where: "au3_code LIKE '011%'",
        outFields: "name",
        outSR: "4326",
        returnGeometry: "true",
        maxAllowableOffset: "0.0001",
        geometryPrecision: "5",
        f: "geojson",
      });
    khorooCache = arcgisJson<GeoJSON.FeatureCollection>(url, "Хорооны хил").catch((e) => {
      khorooCache = null;
      throw e;
    });
  }
  return khorooCache;
}

/*
  ЦЭГ АЛЬ ДҮҮРЭГТ БАЙНА ВЭ — `fetchUbDistricts`-ийн хилээр (цацраг татах арга).
  Хотын хилээс гадна бол `null`. Хил нь ~20 м ерөнхийлсөн тул яг хил дээрх цэг
  хөрш дүүрэгт унаж болно (хяналтын химийн агуулахын бүртгэлийн дүүрэгтэй тулгахад
  хэрэглэнэ, 2026-11-19).
*/
type Ring = number[][];

function inRing(x: number, y: number, r: Ring): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function districtAt(fc: GeoJSON.FeatureCollection, lon: number, lat: number): string | null {
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [];
    if (polys.some((p) => inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h)))) {
      const n = f.properties?.soum_name;
      return typeof n === "string" ? n : null;
    }
  }
  return null;
}
