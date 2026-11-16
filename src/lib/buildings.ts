/*
  БАРИЛГЫН ДАВХАРГА — цэг барилгын дотор буусан эсэх.

  Эх сурвалж: ArcGIS Online-ийн НЭЭЛТТЭЙ `merged_buildings_arkhai` (Улаанбаатарын
  барилгын олон өнцөгт, токенгүй) — үерийн симуляцийн барилгатай ижил
  ({@link src/lib/flood/arcgis.js}-ийн `BUILDINGS_URL`). Хэрэглэгч 2026-11-16:
  химийн бодисын бүртгэлийн хардлагатай байршлыг барилгатай давхцуулж будах.

  Цэгүүдийг НЭГ multipoint асуулгаар илгээж (сервер зөвхөн тэдгээрт хүрсэн
  барилгыг буцаана), барилга бүрийн цагиргийг хөтөч дээр цацрагаар шалгана.
*/

const BUILDINGS_QUERY =
  "https://services.arcgis.com/HJzgwvlNIXssnQar/arcgis/rest/services/merged_buildings_arkhai/FeatureServer/0/query";

type Ring = [number, number][];

/** Цэг олон өнцөгтийн дотор уу — тэгш-сондгой дүрэм (нүх ч тооцогдоно) */
function inside(x: number, y: number, rings: Ring[]) {
  let c = false;
  for (const r of rings)
    for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
      const [xi, yi] = r[i];
      const [xk, yk] = r[k];
      if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) c = !c;
    }
  return c;
}

/** Цэгийн доорх барилга — эх сурвалжийн зориулалт ба нэр */
export type Building = { use: string; name: string };

/**
 * Цэг бүр (WGS84 `[lon, lat]`) аль барилгын дотор буусан — барилгагүй бол `null`,
 * индекс нь оролттой ижил. Асуулга унавал алдаа шиднэ (дуудагч тал өмнөх төлвөө хадгална).
 */
export async function pointsOnBuildings(points: [number, number][], signal?: AbortSignal): Promise<(Building | null)[]> {
  if (!points.length) return [];
  const out = new Array<Building | null>(points.length).fill(null);
  /* Нэг асуулгад 400 цэг хүртэл — POST биеийн хэмжээ бага байхын тулд */
  for (let at = 0; at < points.length; at += 400) {
    const part = points.slice(at, at + 400);
    const body = new URLSearchParams({
      f: "json",
      geometry: JSON.stringify({ points: part, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryMultipoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "OBJECTID,Барилгын_зориулалт,Барилга_байгууламжийн_нэр",
      returnGeometry: "true",
      outSR: "4326",
    });
    // eslint-disable-next-line no-restricted-globals -- ArcGIS Online-ийн нээлттэй үйлчилгээ — порталын токен тэнд хүчингүй
    const res = await fetch(BUILDINGS_QUERY, { method: "POST", body, signal });
    const json = (await res.json()) as {
      features?: { attributes?: Record<string, unknown>; geometry?: { rings?: Ring[] } }[];
      error?: { message?: string };
    };
    if (!res.ok || json.error || !json.features) throw new Error(json.error?.message || `Барилгын давхарга: ${res.status}`);
    const shapes = json.features;
    part.forEach(([x, y], i) => {
      const hit = shapes.find((f) => inside(x, y, f.geometry?.rings ?? []));
      if (hit)
        out[at + i] = {
          use: String(hit.attributes?.["Барилгын_зориулалт"] ?? ""),
          name: String(hit.attributes?.["Барилга_байгууламжийн_нэр"] ?? ""),
        };
    });
  }
  return out;
}
