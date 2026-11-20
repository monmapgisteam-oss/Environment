/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ачаалагддаг тул төрлийн тодорхойлолтгүй; SDK обьект `any` */

import type * as GeoJSON from "geojson";


/** "#rrggbb" / "rgba(r,g,b,a)" → [r, g, b, a(0…1)] */
export function parseColor(c: string): [number, number, number, number] {
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h.replace(/./g, (x) => x + x);
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length >= 8 ? n(6) / 255 : 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map((x) => Number(x.trim()));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  return [255, 255, 255, 1];
}

/** Энгийн тэмдгийн өнгө — тунгалаг нь 0…1 */
export function col(c: string, a?: number) {
  const [r, g, b, al] = parseColor(c);
  return [r, g, b, a ?? al];
}

/** CIM-ийн өнгө — тунгалаг нь 0…255 */
export function cim(c: string, a?: number) {
  const [r, g, b, al] = parseColor(c);
  return [r, g, b, Math.round(255 * (a ?? al))];
}

export function hexOf([r, g, b]: number[]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Шатлалын өнгийг шугаман холино (MapLibre-ийн `interpolate linear`-тэй ижил) */
export function lerpStops(stops: [number, string][], v: number) {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i];
    if (v <= b) {
      const [a, ca] = stops[i - 1];
      const t = (v - a) / (b - a || 1);
      const x = parseColor(ca);
      const y = parseColor(cb);
      return hexOf([0, 1, 2].map((k) => x[k] + (y[k] - x[k]) * t));
    }
  }
  return stops[stops.length - 1][1];
}

export const R_EARTH = 6378137;

export const toMerc = (lon: number, lat: number): [number, number] => [
  (R_EARTH * lon * Math.PI) / 180,
  R_EARTH * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

export const toLonLat = (x: number, y: number): [number, number] => [
  ((x / R_EARTH) * 180) / Math.PI,
  ((2 * Math.atan(Math.exp(y / R_EARTH)) - Math.PI / 2) * 180) / Math.PI,
];

export type Family = "point" | "polyline" | "polygon";

export function familyOf(g: GeoJSON.Geometry | null | undefined): Family | null {
  if (!g) return null;
  switch (g.type) {
    case "Point":
    case "MultiPoint":
      return "point";
    case "LineString":
    case "MultiLineString":
      return "polyline";
    case "Polygon":
    case "MultiPolygon":
      return "polygon";
    default:
      return null;
  }
}

/*
  ⚠ ЭВДЭРСЭН ГЕОМЕТРИЙГ ЦЭВЭРЛЭНЭ. Esri-ийн GeoJSON задлагч (worker) нэг
  хоосон цагирагт БҮХ давхаргаа унагадаг — ойн ялгаралын 6,264 дүрсийн
  нэг нь мужаас гадуурх оройгоо хасуулаад хоосон цагирагтай үлдсэнээс
  зураг бүхэлдээ гараагүй (2026-10-12). Дутуу цагираг, хоосон хэсгийг
  хасаж, юу ч үлдээгүй бол дүрсийг алгасна.
*/
export function cleanGeom(g: GeoJSON.Geometry | null | undefined): GeoJSON.Geometry | null {
  if (!g) return null;
  const okPos = (p: GeoJSON.Position | undefined) => !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const ring = (r: GeoJSON.Position[] | undefined) => (r ?? []).filter(okPos);
  const poly = (rs: GeoJSON.Position[][] | undefined) => {
    const out = (rs ?? []).map(ring).filter((r) => r.length >= 4);
    return out.length ? out : null;
  };
  switch (g.type) {
    case "Polygon": {
      const c = poly(g.coordinates);
      return c ? { type: "Polygon", coordinates: c } : null;
    }
    case "MultiPolygon": {
      const c = (g.coordinates ?? []).map(poly).filter((x): x is GeoJSON.Position[][] => !!x);
      return c.length ? { type: "MultiPolygon", coordinates: c } : null;
    }
    case "LineString": {
      const c = ring(g.coordinates);
      return c.length >= 2 ? { type: "LineString", coordinates: c } : null;
    }
    case "MultiLineString": {
      const c = (g.coordinates ?? []).map(ring).filter((l) => l.length >= 2);
      return c.length ? { type: "MultiLineString", coordinates: c } : null;
    }
    case "Point":
      return okPos(g.coordinates) ? g : null;
    default:
      return null;
  }
}

/** Цагираг тойргийн тэмдэгт талбай — эерэг бол цагийн зүүний эсрэг */
export function signedArea(r: GeoJSON.Position[]) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s / 2;
}

/*
  ⚠ ЦАГИРГИЙН ЧИГЛЭЛ. GeoJSON-д гадна цагираг цагийн зүүний ЭСРЭГ, Esri-д
  цагийн зүүний ДАГУУ бөгөөд Esri нүхийг чиглэлээр нь таньдаг. Тиймээс
  гадна цагиргийг цагийн зүүний дагуу, нүхийг эсрэг болгоно.
*/
export function orient(poly: GeoJSON.Position[][]) {
  return poly.map((ring, i) => {
    const xy = ring.map((p) => [p[0], p[1]]);
    const ccw = signedArea(xy) > 0;
    return i === 0 === ccw ? xy.reverse() : xy;
  });
}

/*
  ⚠ БҮХ ДАВХАРГА WEB MERCATOR-Т. Харагдац нь Web Mercator тул 4326-ийн
  геометрийг SDK обьект бүрд проекцлох байсан — 145 мянган жорлонгийн
  цэг дээр хөтөч хэдэн арван секунд түгжигдэж байв (2026-10-12-нд
  хэмжсэн). Хөрвүүлэлт нь энгийн томьёо тул энд нэг удаа.
*/
export const MERC = { wkid: 102100 };

export const LAT_MAX = 85.05112878;

export const merc = (p: GeoJSON.Position) => toMerc(p[0], Math.max(-LAT_MAX, Math.min(LAT_MAX, p[1])));

/** Газарзүйн цэг → Esri цэг (Web Mercator) */
export function mercPoint(lon: number, lat: number) {
  const [x, y] = merc([lon, lat]);
  return { type: "point", x, y, spatialReference: MERC };
}

/** GeoJSON геометр → Esri геометрийн JSON (autocast), Web Mercator-т */
export function esriGeom(g: GeoJSON.Geometry | null | undefined): any | null {
  if (!g) return null;
  const ring = (r: GeoJSON.Position[]) => r.map(merc);
  switch (g.type) {
    case "Point":
      return mercPoint(g.coordinates[0], g.coordinates[1]);
    case "MultiPoint":
      return g.coordinates.length ? mercPoint(g.coordinates[0][0], g.coordinates[0][1]) : null;
    case "LineString":
      return { type: "polyline", paths: [ring(g.coordinates)], spatialReference: MERC };
    case "MultiLineString":
      return { type: "polyline", paths: g.coordinates.map(ring), spatialReference: MERC };
    case "Polygon":
      return { type: "polygon", rings: orient(g.coordinates).map(ring), spatialReference: MERC };
    case "MultiPolygon":
      return { type: "polygon", rings: g.coordinates.flatMap(orient).map(ring), spatialReference: MERC };
    default:
      return null;
  }
}

/* --------------------------------------------------------------------------
   CIM тэмдэг — гэрэлтэх цэг (firefly)

   MapLibre-ийн `circle-blur` (сарнисан гэрэл) Esri-д байхгүй. Сарнилтыг
   ТӨВ НЭГТЭЙ гурван тунгалаг дискээр дуурайна: давхцсан хэсэг нь
   нэмэгдэж төв рүүгээ тодорч, захдаа сулрах налуу гарна.

   Хэмжээ нь ЦЭГИЙН ПИКСЕЛИЙН РАДИУС × 1.5 (пункт: px · 0.75 · 2).
   Давхаргуудын харьцаа нь MapLibre-ийн z12 дээрх радиусаас; бүх тэмдгийн
   үнэмлэхүй хэмжээг масштабын визуал хувьсагч тохируулна.
   -------------------------------------------------------------------------- */
