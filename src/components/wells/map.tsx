"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ачаалагддаг тул төрлийн тодорхойлолтгүй; энэ файлын бүх SDK обьект `any` */

import type * as GeoJSON from "geojson";
import { Minus, Plus } from "lucide-react";
import * as React from "react";
import { SceneOverlay } from "@/components/map/scene-overlay";
import { FIREFLY } from "@/components/wells/colors";
import { esriModules } from "@/lib/arcgis-sdk";
import { FIREFLY_CORE, FIREFLY_GLOW } from "@/lib/firefly";
import { asset } from "@/lib/base-path";
import type { BoundarySet } from "@/lib/boundaries";
import { labelPoints } from "@/lib/extent";
import { ratioText } from "@/lib/utils";

/* ==========================================================================
   НЭГДСЭН 2D ГАЗРЫН ЗУРАГ — ArcGIS Maps SDK `MapView` (2026-10-12)

   ⚠⚠ Урьд нь MapLibre GL байсан (git түүхэнд бий). 3D нь аль хэдийн Esri `SceneView` тул 2D, 3D НЭГ хөдөлгүүр
   болов. Пропын API ӨӨРЧЛӨГДӨӨГҮЙ — 26 самбар хөндөгдөхгүй.

   ⚠ ZOOM-ЫН ХОЁР ХУВААРЬ. Дуудагч тал (шошгын хязгаар, бөөгнөрлийн
   хязгаар, `onZoom`, `onView`) MapLibre-ийн zoom-оор ярьдаг: 512px
   хавтан. Esri-ийн LOD нь 256px хавтан тул НЭГЭЭР их (`ML + 1`).
   Хоорондын хөрвүүлэлт ЗӨВХӨН энэ файлд — гаднаас Esri-ийн түвшин
   хэзээ ч харагдахгүй.

   ⚠ Давхаргын харагдах муж нь МАСШТАБААР (`minScale`/`maxScale`) —
   Esri-ийн жишиг. `scaleAt(ml)` нь MapLibre zoom-ыг Web Mercator-ын
   НОМИНАЛ масштаб болгоно (Esri-ийн `view.scale`-тэй ижил хуваарь).

   ⚠ ГАЗРЫН ЗУРАГ ГОРИМООС ҮЛ ХАМААРНА: бүх өнгө тогтмол hex,
   платформын токен зураг дотор орохгүй.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Масштабын ХАРЬЦАА (1:10 000)
   -------------------------------------------------------------------------- */

/** CSS пикселийн бодит хэмжээ — 1/96 инч */
const M_PER_CSS_PX = 0.0254 / 96;

/**
 * Масштабын харьцааг zoom болгоно (1:60 000 → z 11.69), MapLibre-ийн
 * хуваарьт (512px хавтан).
 *
 * Хамаарал: D = 295 829 384 · cos(φ) / 2^z. Өргөрөг ордог тул анхдагч нь
 * УБ (47.9°) — энэ платформын бүх нягтралын дата тэнд байна.
 */
export function zoomForScale(denominator: number, lat = 47.9) {
  const d0 = 295_829_384 * Math.cos((lat * Math.PI) / 180);
  return Math.log2(d0 / denominator);
}

/** Web Mercator-ын 0-р түвшний номинал масштаб (256px, 96 dpi) */
const S0 = 591_657_527.591555;
/** MapLibre zoom → Esri-ийн номинал масштаб (`view.scale`-тэй ижил хуваарь) */
const scaleAt = (ml: number) => S0 / 2 ** (ml + 1);
/** Esri-ийн түвшин → MapLibre zoom */
const mlOf = (esriZoom: number) => esriZoom - 1;
/** Зургийн дээд ойртолт, MapLibre-ийн хуваарьт */
const MAX_ML = 18;

export type MapPoints = {
  oid: number[];
  lon: number[];
  lat: number[];
};

/** Харагдац: [баруун, өмнөд, зүүн, хойд] */
export type Extent = [number, number, number, number];

/**
 * Нэмэлт давхарга. Загварыг нь дуудагч тал (домэйны мэдлэгтэй нь) өгнө —
 * зураг нь зөвхөн зурна.
 */
export type MapOverlay = {
  id: string;
  data: GeoJSON.FeatureCollection;
  fill?: {
    color: string;
    opacity?: number;
    /** `gridcode` 1..N-ийн дагуух тунгалагийн шатлал */
    byGrid?: number[];
  };
  /** `style` — зураасны хэв (анхдагч бүтэн) */
  line: { color: string; opacity: number; width: number; style?: "solid" | "dash" | "short-dash" | "dot" };
  /**
   * Давхарга бүхэлдээ энэ түвшнөөс ОЙРТСОН үед л харагдана (`zoomForScale`).
   * Өгөөгүй бол бүх масштабад. ЗӨВХӨН давхарга үүсэх мөчид уншигдана.
   */
  minzoom?: number;
  /**
   * Дүрс бүрийн НЭР шошго (`properties[field]`) — сонголттой. Өгөөгүй
   * бол шошгогүй (бусад бүх дуудагч хуучнаараа). ЗӨВХӨН давхарга
   * үүсэх мөчид уншигдана.
   */
  label?: { field: string; size?: number; color?: string; minzoom?: number };
  /**
   * ДАТА ДАВХАРГЫН ДЭЭР зурагдах эсэх.
   *
   * ⚠ Нэмэлт давхарга нь ерөнхийдөө СУУРЬ тул доор нь суудаг (хил,
   * бүсийн тор). Гэвч заримдаа тэр нь өөрөө ДАТА байна: бүстэй
   * давхцсан нэгж талбар нь бүсийн дүүргэлтийн ДООР орвол огт
   * харагдахгүй (хэрэглэгч, 2026-09-29).
   * ⚠ ШОШГЫН ДООР үлдэнэ: бичвэр нь үргэлж хамгийн дээр.
   */
  above?: boolean;
};

/* --------------------------------------------------------------------------
   Esri-ийн суурь зургийн цуглуулга
   -------------------------------------------------------------------------- */

const ESRI = (s: string) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;

export type Basemap = {
  id: string;
  name: string;
  service: string;
  /** Энэ суурь дээр гэрэлтэй бичээс тохирох эсэх (бараан суурь) */
  dark: boolean;
  maxzoom: number;
  /** `services.arcgisonline.com`-оос ӨӨР хост дээрх хавтангийн хаяг */
  url?: string;
  /**
   * Растерын засвар — Esri-ийн Firefly хавтан нь өнгө сулруулсан ч
   * БАРААН биш тул гэрэлтэх цэг ялгарахгүй байв (зургаар шалгасан).
   * Нэрс нь MapLibre-ийнх хэвээр; Esri дээр CSS шүүлтүүр (`effect`) болно.
   */
  paint?: { "raster-brightness-max"?: number; "raster-saturation"?: number; "raster-contrast"?: number };
};

/**
 * Хиймэл дагуул нь үндсэн суурь — цуглуулгын эхэнд байрлана.
 *
 * ⚠ НЭР нь Esri-ийн АЛБАН АНГЛИ нэр (хэрэглэгчийн шийдвэр, 2026-10-12:
 * "нэршил нь бас англиар — хиймэл дагуул биш Imagery") — сонголт нь
 * Esri-ийн `BasemapGallery` виджетэд гардаг.
 */
export const BASEMAPS: Basemap[] = [
  /*
    ⚠⚠ **`maxzoom` нь ЗАРЛАСАН биш БОДИТ хамрах хүрээ** (Esri-ийн хавтангийн
    түвшин, 256px). Esri үйлчилгээндээ 19–20 хүртэл түвшин зарладаг ч
    Монголын нутагт бодит зураг нь эрт дуусдаг (2026-09-16-нд шалгасан):
      · Улаанбаатарын төв — хиймэл дагуул z19, гудамж z19, байр зүй z18
      · Хот ГАДУУР (Гачуурт, Горхи-Тэрэлж, Зуунмод) — ГУРВУУЛАА z17
    Түүнээс цааш сервер "Map data not yet available" гэсэн орлуулагч
    зургийг буцаана. Иймээс энэ түвшнээс цааш СҮҮЛЧИЙН БОДИТ хавтанг
    томруулж харуулна ({@link tileLayer}).
  */
  { id: "imagery", name: "Imagery", service: "World_Imagery", dark: true, maxzoom: 17 },
  /*
    ⚠ FIREFLY СУУРЬ (хэрэглэгч, 2026-10-07). Esri-ийн бараан, өнгө
    сулруулсан хиймэл дагуул — гэрэлтэх цэгт зориулагдсан. Хост нь
    `fly.maptiles.arcgis.com`, түлхүүргүй.
  */
  {
    id: "firefly",
    name: "Imagery (Firefly)",
    service: "World_Imagery_Firefly",
    dark: true,
    maxzoom: 17,
    paint: { "raster-brightness-max": 0.45, "raster-saturation": -0.55, "raster-contrast": 0.1 },
    url: "https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer/tile/{z}/{y}/{x}",
  },
  { id: "dark", name: "Dark Gray Canvas", service: "Canvas/World_Dark_Gray_Base", dark: true, maxzoom: 16 },
  { id: "light", name: "Light Gray Canvas", service: "Canvas/World_Light_Gray_Base", dark: false, maxzoom: 16 },
  { id: "street", name: "Streets", service: "World_Street_Map", dark: false, maxzoom: 17 },
  { id: "topo", name: "Topographic", service: "World_Topo_Map", dark: false, maxzoom: 17 },
  { id: "hillshade", name: "Hillshade", service: "Elevation/World_Hillshade", dark: false, maxzoom: 16 },
  { id: "natgeo", name: "National Geographic", service: "NatGeo_World_Map", dark: false, maxzoom: 16 },
];

export function basemapTiles(b: Basemap) {
  return b.url ?? ESRI(b.service);
}

/** Цуглуулгын жижиг урьдчилсан харагдац — Монголыг харуулсан нэг хавтан */
export function basemapThumb(b: Basemap) {
  return (b.url ?? ESRI(b.service)).replace("{z}/{y}/{x}", "5/11/24");
}

/** Анхны суурь зураг — хиймэл дагуул */
export function defaultBasemap() {
  return BASEMAPS.find((b) => b.id === "imagery") ?? BASEMAPS[0];
}

/** MapLibre-ийн растерын засварыг CSS шүүлтүүр болгоно */
function basemapEffect(b: Basemap) {
  const p = b.paint;
  if (!p) return null;
  const parts: string[] = [];
  if (p["raster-brightness-max"] != null) parts.push(`brightness(${p["raster-brightness-max"]})`);
  if (p["raster-saturation"] != null) parts.push(`saturate(${1 + p["raster-saturation"]})`);
  if (p["raster-contrast"] != null) parts.push(`contrast(${1 + p["raster-contrast"]})`);
  return parts.join(" ") || null;
}

/* --------------------------------------------------------------------------
   Өнгө, геометр
   -------------------------------------------------------------------------- */

/** "#rrggbb" / "rgba(r,g,b,a)" → [r, g, b, a(0…1)] */
function parseColor(c: string): [number, number, number, number] {
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
function col(c: string, a?: number) {
  const [r, g, b, al] = parseColor(c);
  return [r, g, b, a ?? al];
}

/** CIM-ийн өнгө — тунгалаг нь 0…255 */
function cim(c: string, a?: number) {
  const [r, g, b, al] = parseColor(c);
  return [r, g, b, Math.round(255 * (a ?? al))];
}

function hexOf([r, g, b]: number[]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Шатлалын өнгийг шугаман холино (MapLibre-ийн `interpolate linear`-тэй ижил) */
function lerpStops(stops: [number, string][], v: number) {
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

const R_EARTH = 6378137;
const toMerc = (lon: number, lat: number): [number, number] => [
  (R_EARTH * lon * Math.PI) / 180,
  R_EARTH * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];
const toLonLat = (x: number, y: number): [number, number] => [
  ((x / R_EARTH) * 180) / Math.PI,
  ((2 * Math.atan(Math.exp(y / R_EARTH)) - Math.PI / 2) * 180) / Math.PI,
];

type Family = "point" | "polyline" | "polygon";

function familyOf(g: GeoJSON.Geometry | null | undefined): Family | null {
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
function cleanGeom(g: GeoJSON.Geometry | null | undefined): GeoJSON.Geometry | null {
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
function signedArea(r: GeoJSON.Position[]) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s / 2;
}

/*
  ⚠ ЦАГИРГИЙН ЧИГЛЭЛ. GeoJSON-д гадна цагираг цагийн зүүний ЭСРЭГ, Esri-д
  цагийн зүүний ДАГУУ бөгөөд Esri нүхийг чиглэлээр нь таньдаг. Тиймээс
  гадна цагиргийг цагийн зүүний дагуу, нүхийг эсрэг болгоно.
*/
function orient(poly: GeoJSON.Position[][]) {
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
const MERC = { wkid: 102100 };
const LAT_MAX = 85.05112878;
const merc = (p: GeoJSON.Position) => toMerc(p[0], Math.max(-LAT_MAX, Math.min(LAT_MAX, p[1])));

/** Газарзүйн цэг → Esri цэг (Web Mercator) */
function mercPoint(lon: number, lat: number) {
  const [x, y] = merc([lon, lat]);
  return { type: "point", x, y, spatialReference: MERC };
}

/** GeoJSON геометр → Esri геометрийн JSON (autocast), Web Mercator-т */
function esriGeom(g: GeoJSON.Geometry | null | undefined): any | null {
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

/** Цагиргийн 32 өнцөгт, цагийн зүүний дагуу — CIM-ийн хүрээ ±5 */
const RING = Array.from({ length: 33 }, (_, i) => {
  const a = (-(i % 32) / 32) * Math.PI * 2;
  return [5 * Math.cos(a), 5 * Math.sin(a)];
});

const pt = (rPx: number) => rPx * 1.5;

function disc(rPx: number, fill: number[] | null, stroke?: [number[], number]) {
  const layers: any[] = [];
  if (stroke)
    layers.push({ type: "CIMSolidStroke", enable: true, width: stroke[1] * 0.75, color: stroke[0], capStyle: "Round", joinStyle: "Round" });
  if (fill) layers.push({ type: "CIMSolidFill", enable: true, color: fill });
  return {
    type: "CIMVectorMarker",
    enable: true,
    anchorPointUnits: "Relative",
    size: pt(rPx),
    frame: { xmin: -5, ymin: -5, xmax: 5, ymax: 5 },
    markerGraphics: [
      {
        type: "CIMMarkerGraphic",
        geometry: { rings: [RING] },
        symbol: { type: "CIMPolygonSymbol", symbolLayers: layers },
      },
    ],
    scaleSymbolsProportionally: false,
    respectFrame: true,
  };
}

/** Сарнисан гэрэл — гурван дискийн давхарга (`op` нь MapLibre-ийн тунгалаг) */
function glow(rPx: number, color: string, op: number) {
  return [
    disc(rPx * 0.48, cim(color, op * 0.48)),
    disc(rPx * 0.72, cim(color, op * 0.36)),
    disc(rPx, cim(color, op * 0.28)),
  ];
}

/** Давхаргуудыг ДЭЭРЭЭС ДООШ дарааллаар өгнө */
function cimPoint(layers: any[]) {
  return {
    type: "cim",
    data: { type: "CIMSymbolReference", symbol: { type: "CIMPointSymbol", symbolLayers: layers } },
  };
}

type Fire = { glow: string; mid: string; core: string };

/** Анхдагч firefly: сарнисан гэрэл → (цагираг) → бие → цөм */
function fireSymbol(f: Fire, tint: string | null, ring: boolean) {
  return cimPoint([
    disc(2.3, cim(tint ?? f.core, 0.95)),
    disc(5.6, cim(tint ?? f.mid, 0.6)),
    ...(ring ? [disc(6.6, null, [cim("rgba(8,14,20,.7)"), 1.1])] : []),
    ...glow(11, tint ?? f.glow, 0.38),
  ]);
}

/** ЖИЖИГ firefly ({@link WellsMap} `dots`) */
function dotSymbol(f: Fire, tint: string | null) {
  return cimPoint([
    disc(0.9, cim("#ffffff", 0.75)),
    disc(2.5, cim(tint ?? f.mid, 0.95)),
    ...glow(5.6, tint ?? f.glow, 0.42),
  ]);
}

/** Зэрэглэсэн энгийн цэг — бараан нимгэн ирмэгтэй, сул гэрэлтэй */
function gradedSymbol(color: string) {
  return cimPoint([
    disc(1, cim(color, 0.92), [cim("rgba(10,18,26,.55)"), 0.7]),
    ...glow(2.4, color, 0.32),
  ]);
}

/** Зэрэглэсэн гэрэлтэх цэг — нэг өнгөт */
function gradedFireSymbol(f: Fire) {
  return cimPoint([disc(0.95, cim(f.core, 0.95)), disc(2.2, cim(f.mid, 0.6)), ...glow(4.2, f.glow, 0.38)]);
}

/** Esri Firefly-ийн `CIMPictureMarker` давхарга (style-ийн тохиргоо хэвээр) */
function picture(url: string, size: number, tint: number[], locked: boolean) {
  return {
    type: "CIMPictureMarker",
    enable: true,
    anchorPoint: { x: 0, y: 0 },
    anchorPointUnits: "Relative",
    size,
    scaleX: 1,
    textureFilter: "Picture",
    tintColor: tint,
    colorLocked: locked,
    url,
  };
}

/**
 * Зэрэглэсэн гэрэлтэх цэг — ESRI-ИЙН FIREFLY тэмдэг (хэрэглэгч 2026-10-15,
 * хөрсний мониторинг: "esri firefly"). Style-ийн `Firefly_N`-тэй ЯГ ижил:
 * цагаан цөм (10pt, түгжээтэй) + шатлалын өнгөөр будсан гэрэл (20pt).
 * Гараар зурсан дугуйн хувилбар БУЦААГДСАН. Хэмжээг `sizeByValue` масштаблана.
 */
function gradedMultiSymbol(color: string) {
  return cimPoint([
    picture(FIREFLY_CORE, 10, [255, 255, 255, 255], true),
    picture(FIREFLY_GLOW, 20, cim(color, 1), false),
  ]);
}

/**
 * Масштабаас хамаарах хэмжээ — MapLibre-ийн `interpolate zoom` -ын
 * орлогч. `stops` нь [MapLibre zoom, ТЭМДГИЙН ХАМГИЙН ТОМ давхаргын
 * радиус px].
 */
function sizeByZoom(stops: [number, number][]) {
  return {
    type: "size",
    valueExpression: "$view.scale",
    stops: [...stops].reverse().map(([z, r]) => ({ value: scaleAt(z), size: pt(r) })),
  };
}

/**
 * Утга ба масштаб хоёулаа хэмжээнд орно (зэрэглэсэн тэмдэг).
 * Суурь радиус нь z8 1.7 · z12 2.4 · z16 3.6 px, утгаараа 1.9 дахин томорно.
 * ⚠ Esri-ийн визуал хувьсагч нэг л илэрхийлэл авдаг тул хоёр сувгийг
 * Arcade дотор нийлүүлнэ; `stops` нь ижилсэлтийн хувиргалт.
 */
function sizeByValue(lo: number, hi: number, unit: number) {
  const span = hi - lo || 1;
  return {
    type: "size",
    valueExpression: `
var z = Log(${S0} / $view.scale) / Log(2) - 1;
var b = When(z <= 8, 1.7, z <= 12, 1.7 + (z - 8) / 4 * 0.7, z <= 16, 2.4 + (z - 12) / 4 * 1.2, 3.6);
var g = $feature.g;
var t = IIf(IsEmpty(g), 0, Max(0, Min(1, (g - ${lo}) / ${span})));
return b * ${unit} * (1 + 0.9 * t) * 1.5;`,
    stops: [
      { value: 0, size: 0 },
      { value: 400, size: 400 },
    ],
  };
}

/** Шатлалыг 24 ангилалд хувааж өнгө тус бүрд тэмдэг үүсгэнэ */
function gradeRenderer(stops: [number, string][], symbol: (hex: string) => any, size: any) {
  const lo = stops[0][0];
  const hi = stops[stops.length - 1][0];
  const N = 24;
  const infos = Array.from({ length: N }, (_, i) => {
    const a = lo + ((hi - lo) * i) / N;
    const b = lo + ((hi - lo) * (i + 1)) / N;
    return {
      minValue: i === 0 ? -1e15 : a,
      maxValue: i === N - 1 ? 1e15 : b,
      symbol: symbol(lerpStops(stops, (a + b) / 2)),
    };
  });
  return {
    type: "class-breaks",
    field: "g",
    defaultSymbol: symbol(stops[0][1]),
    classBreakInfos: infos,
    visualVariables: [size],
  };
}

/** Үл үзэгдэх тэмдэг — зөвхөн шошго үүрэх давхаргад */
const INVISIBLE = {
  type: "simple",
  symbol: { type: "simple-marker", size: 0, color: [0, 0, 0, 0], outline: null },
};

/** Шошгын фонт — Esri-ийн фонтын үйлчилгээнд кирилл үсэгтэй гэр бүл */
const FONT = { family: "Noto Sans", weight: "bold" } as const;
const HALO = [8, 14, 20, 0.85];

/** Харилцдаг давхаргын хамгийн их тэмдэглэгээ — DOM элемент бүр зураг татна */
const MARKER_CAP = 250;

/* --------------------------------------------------------------------------
   SDK модулиуд
   -------------------------------------------------------------------------- */

type Esri = {
  Map: any;
  MapView: any;
  Basemap: any;
  BaseTileLayer: any;
  FeatureLayer: any;
  GeoJSONLayer: any;
  GraphicsLayer: any;
  GroupLayer: any;
  Graphic: any;
  TileInfo: any;
  request: any;
  reactive: any;
};

let esriP: Promise<Esri> | null = null;
function loadEsri() {
  esriP ??= esriModules<any[]>([
    "esri/Map",
    "esri/views/MapView",
    "esri/Basemap",
    "esri/layers/BaseTileLayer",
    "esri/layers/FeatureLayer",
    "esri/layers/GeoJSONLayer",
    "esri/layers/GraphicsLayer",
    "esri/layers/GroupLayer",
    "esri/Graphic",
    "esri/layers/support/TileInfo",
    "esri/request",
    "esri/core/reactiveUtils",
  ]).then(([Map, MapView, Basemap, BaseTileLayer, FeatureLayer, GeoJSONLayer, GraphicsLayer, GroupLayer, Graphic, TileInfo, request, reactive]) => ({
    Map,
    MapView,
    Basemap,
    BaseTileLayer,
    FeatureLayer,
    GeoJSONLayer,
    GraphicsLayer,
    GroupLayer,
    Graphic,
    TileInfo,
    request,
    reactive,
  }));
  esriP.catch(() => {
    esriP = null;
  });
  return esriP;
}

/** Хавтангийн дүрслэл — 20 түвшин (Esri 0…19 = MapLibre ≤ 18) */
function tileInfoOf(E: Esri) {
  return E.TileInfo.create({ size: 256, numLODs: 20, spatialReference: { wkid: 102100 } });
}

/*
  СУУРЬ ЗУРГИЙН ХАВТАН. `WebTileLayer` нь зарласан түвшнээс цааш хавтан
  гуйж "Map data not yet available" орлуулагч зургийг харуулна. Тиймээс
  бодит хамрах хүрээнээс (`maxzoom`) цааш эцэг хавтангаа ТАЙРЧ томруулна —
  MapLibre-ийн `maxzoom`-той ижил зан төлөв.
*/
let TileClass: any = null;
function tileLayer(E: Esri, b: Basemap) {
  TileClass ??= E.BaseTileLayer.createSubclass({
    properties: { tpl: null, maxLevel: 17 },
    fetchTile(this: any, level: number, row: number, col: number, options?: { signal?: AbortSignal }) {
      const d = Math.max(0, level - this.maxLevel);
      const url = String(this.tpl)
        .replace("{z}", String(level - d))
        .replace("{y}", String(row >> d))
        .replace("{x}", String(col >> d));
      const blank = () => {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        return c;
      };
      return E.request(url, { responseType: "image", signal: options?.signal })
        .then((res: any) => {
          const img = res.data as HTMLImageElement;
          if (!d) return img;
          const n = 1 << d;
          const s = 256 / n;
          const c = blank();
          const g = c.getContext("2d")!;
          g.imageSmoothingEnabled = true;
          g.drawImage(img, (col % n) * s, (row % n) * s, s, s, 0, 0, 256, 256);
          return c;
        })
        .catch((e: any) => {
          if (e?.name === "AbortError") throw e;
          return blank();
        });
    },
  });
  return new TileClass({
    tpl: basemapTiles(b),
    maxLevel: b.maxzoom,
    tileInfo: tileInfoOf(E),
    ...(basemapEffect(b) ? { effect: basemapEffect(b) } : {}),
  });
}

/**
 * Зураг тус бүрийн Esri `Basemap` обьектууд — `id` нь манай `Basemap.id`.
 * Галерей ба `map.basemap` НЭГ обьектыг заах ёстой: эс тэгвээс галерей
 * сонгосон суурийг таньж тодруулахгүй.
 */
export function esriBasemaps(E: { Basemap: any; BaseTileLayer: any; TileInfo: any; request: any }, map: any): Map<string, any> {
  if (!map.__basemaps) {
    map.__basemaps = new Map(
      BASEMAPS.map((b) => [
        b.id,
        new E.Basemap({ id: b.id, title: b.name, thumbnailUrl: basemapThumb(b), baseLayers: [tileLayer(E as Esri, b)] }),
      ]),
    );
  }
  return map.__basemaps;
}

/* --------------------------------------------------------------------------
   Давхаргын туслахууд
   -------------------------------------------------------------------------- */

type Field = { name: string; type: "double" | "string" | "integer" };

/*
  ⚠⚠ ДАТАНЫ ДАВХАРГА нь `GeoJSONLayer` (blob хаягаас). Эхлээд клиент
  `FeatureLayer` + `applyEdits` байсан: 145 мянган жорлонгийн цэг дээр
  засвар 25 секундээс илүү үргэлжилж, хөтөч бүхэлдээ түгжигдэв
  (2026-10-12-нд хэмжсэн). `GeoJSONLayer` нь өгөгдлөө WORKER дээр
  задлах, проекцлох тул үндсэн урсгал чөлөөтэй.
*/
function geoLayer(E: Esri, geometryType: Family, fields: Field[], extra: Record<string, unknown>, features: GeoJSON.Feature[] = []) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ type: "FeatureCollection", features })], { type: "application/json" }),
  );
  const layer = new E.GeoJSONLayer({
    url,
    geometryType,
    objectIdField: "fid",
    fields: [{ name: "fid", type: "oid" }, ...fields],
    outFields: ["*"],
    ...extra,
  });
  layer.__spec = { geometryType, fields, extra };
  layer.when(
    () => URL.revokeObjectURL(url),
    () => URL.revokeObjectURL(url),
  );
  return layer;
}

const clientLayer = (E: Esri, geometryType: Family, fields: Field[], extra: Record<string, unknown> = {}) =>
  geoLayer(E, geometryType, fields, extra);

/** Давхаргын байрлал — `get` нь одоогийн давхаргыг, `set` нь шинийг бүртгэнэ */
type Slot = { key: string; get: () => any; set: (l: any) => void };

/*
  ДАТА СОЛИХ — шинэ давхарга ХУУЧНЫХАА ДЭЭР нэмэгдэж, зурагдаж дуусмагц
  хуучин нь авагдана: зураг хоосрох агшин гарахгүй. Сүүлд тавигдсан
  рендерер, шошго, бөөгнөрөл хуучнаасаа хуулагдана. Нэг байрлалын
  солилтууд ДАРААЛНА; дараалалд хүлээж байх хооронд шинэ дата ирвэл
  дундах нь алгасагдана.
*/
const queues = new Map<string, Promise<void>>();
const latest = new Map<string, number>();
function refill(E: Esri, view: any, slot: Slot, make: () => GeoJSON.Feature[]) {
  const turn = (latest.get(slot.key) ?? 0) + 1;
  latest.set(slot.key, turn);
  const prev = queues.get(slot.key) ?? Promise.resolve();
  const next = prev
    .then(async () => {
      if (latest.get(slot.key) !== turn) return;
      const old = slot.get();
      if (!old || old.destroyed || view.destroyed) return;
      const features = make().map((f, i) => ({ ...f, properties: { ...f.properties, fid: i + 1 } }));
      const spec = old.__spec;
      const nu = geoLayer(
        E,
        spec.geometryType,
        spec.fields,
        {
          ...spec.extra,
          renderer: old.renderer?.clone(),
          labelingInfo: old.labelingInfo?.map((c: any) => c.clone()) ?? null,
          ...(old.featureReduction ? { featureReduction: old.featureReduction.clone() } : {}),
          minScale: old.minScale,
          maxScale: old.maxScale,
        },
        features,
      );
      for (const k of Object.keys(old)) if (k.startsWith("__") && k !== "__spec") nu[k] = old[k];
      const coll = old.parent?.layers;
      if (!coll) return;
      coll.add(nu, coll.indexOf(old) + 1);
      slot.set(nu);
      try {
        const lv = await view.whenLayerView(nu);
        await E.reactive.whenOnce(() => !lv.updating);
      } catch {
        /* зурагдаагүй ч хуучныг авна — давхар дата үлдэхгүй */
      }
      /* ⚠ Ачаалж дуусаагүй давхаргыг устгавал SDK-ийн worker-ийн ажил
         дундаа тасарч "reading 'reject'" алдаа шиднэ */
      await old.when().catch(() => {});
      await view.whenLayerView(old).catch(() => {});
      coll.remove(old);
      old.destroy();
    })
    .catch((e) => console.error("[map]", e));
  queues.set(slot.key, next);
  return next;
}

let slotSeq = 0;
/** `layers` обьектын нэг талбарын байрлал */
function slotOf(layers: any, key: string): Slot {
  layers.__id ??= ++slotSeq;
  return { key: `${layers.__id}:${key}`, get: () => layers[key], set: (l) => (layers[key] = l) };
}

const pointFeature = (lon: number, lat: number, properties: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties,
});

/** Бөөгнөрлийн тоо — MapLibre-ийн `point_count_abbreviated` */
const CLUSTER_TEXT = `var n = $feature.cluster_count;
When(n >= 10000, Text(Round(n / 1000)) + "k", n >= 1000, Text(Round(n / 1000, 1)) + "k", Text(n))`;

/* ==========================================================================
   Бүрэлдэхүүн
   ========================================================================== */

type Mode = {
  cluster: boolean;
  clusterMaxZoom: number;
  clusterLabel: "inside" | "badge";
  weighted: boolean;
  graded: [number, string][] | undefined;
  gradedFire: boolean;
  gradedFireColor: boolean;
  shaped: boolean;
  shapeGlow: boolean;
  shapeCrisp: boolean;
  shapeColor: string | undefined;
  fire: Fire;
  tinted: boolean;
  dots: { rank?: Record<string, number> } | null;
  /** Цэгийн хэмжээний үржүүлэгч (зэрэглэлгүй цэгт), анхдагч 1 */
  pointScale: number;
  shapeLabelZoom: number;
  shapeFlow: boolean;
  shapeLabelOnLine: boolean;
  shapeThin: boolean;
  shapeHair: boolean;
  shapeOutline: boolean;
  shapeLabelUnique: boolean;
  labeled: boolean;
  labelZoom: number;
  labelOffset: number;
  labelSize: number;
  labelColors: Record<string, string> | null;
  labelHalo: number;
  valued: boolean;
  valueZoom: number;
  scale: number | undefined;
};

/** Зургийн бүх давхарга — нэг газар */
type Layers = {
  under: any;
  bnd: Record<"country" | "aimag" | "soum", any | null>;
  shapePoly: any | null;
  shapeLine: any | null;
  lit: any | null;
  above: any;
  shapeLabels: any | null;
  heat: any | null;
  points: any;
  values: any | null;
  hl: any;
  /** ШАР тодруулга (`hotMark`) — цэг, олон өнцөгт, шугам */
  hot: any;
};

type Live = { E: Esri; view: any; map: any; layers: Layers; mode: Mode };

/* Олон өнцөгтийн зураасны өргөн (px) — MapLibre-ийн z8…z14 мужийн дунд */
function strokes(m: Mode, lit: boolean) {
  if (m.shapeCrisp) return { line: lit ? 2.5 : 1.35, cas: 0, fill: lit ? 0.26 : 0.12 };
  const fill = lit ? 0.68 : 0.42;
  if (m.shapeThin) return { line: lit ? 1.5 : 0.5, cas: lit ? 2.9 : 1.6, fill };
  /* 0.5px хүрээ, касинггүй (хэрэглэгч 2026-10-15, эвдэрсэн газар: "outline 0.5px bolgo") */
  if (m.shapeHair) return { line: lit ? 1.5 : 0.5, cas: 0, fill };
  return { line: lit ? 2.2 : 0.85, cas: lit ? 5.5 : 3.5, fill };
}

function polySymbol(m: Mode, color: string, lit: boolean) {
  const s = strokes(m, lit);
  /* ХҮРЭЭГҮЙ горимд зөвхөн СОНГОСОН дүрс нимгэн хүрээтэй */
  const outlined = m.shapeOutline || lit;
  const line = !m.shapeOutline && lit ? 1.2 : s.line;
  const cas = !m.shapeOutline && lit ? 2.6 : s.cas;
  const layers: any[] = [];
  if (outlined) {
    layers.push({ type: "CIMSolidStroke", enable: true, width: line * 0.75, color: cim(color, m.shapeCrisp ? 1 : 0.9), joinStyle: "Round", capStyle: "Round" });
    if (cas) layers.push({ type: "CIMSolidStroke", enable: true, width: cas * 0.75, color: cim("rgba(8,14,20,.55)"), joinStyle: "Round", capStyle: "Round" });
  }
  layers.push({ type: "CIMSolidFill", enable: true, color: cim(color, s.fill) });
  return { type: "cim", data: { type: "CIMSymbolReference", symbol: { type: "CIMPolygonSymbol", symbolLayers: layers } } };
}

/** Чиглэлийн сум — шугамын дундад, чиглэлийн дагуу эргэнэ */
const ARROW = {
  type: "CIMVectorMarker",
  enable: true,
  size: 9,
  anchorPointUnits: "Relative",
  frame: { xmin: -5, ymin: -5, xmax: 5, ymax: 5 },
  markerPlacement: { type: "CIMMarkerPlacementAtRatioPositions", positionArray: [0.5], angleToLine: true },
  markerGraphics: [
    {
      type: "CIMMarkerGraphic",
      geometry: { rings: [[[-4, -4], [-4, 4], [5, 0], [-4, -4]]] },
      symbol: {
        type: "CIMPolygonSymbol",
        symbolLayers: [
          { type: "CIMSolidStroke", enable: true, width: 1, color: cim("rgba(8,14,20,.85)") },
          { type: "CIMSolidFill", enable: true, color: cim("#ffffff") },
        ],
      },
    },
  ],
  scaleSymbolsProportionally: true,
  respectFrame: true,
};

function lineSymbol(m: Mode, color: string, lit: boolean) {
  const s = strokes(m, lit);
  const layers: any[] = [];
  if (m.shapeFlow) layers.push(ARROW);
  layers.push({ type: "CIMSolidStroke", enable: true, width: Math.max(s.line, 1) * 0.75, color: cim(color, m.shapeCrisp ? 1 : 0.9), joinStyle: "Round", capStyle: "Round" });
  if (s.cas) layers.push({ type: "CIMSolidStroke", enable: true, width: s.cas * 0.75, color: cim("rgba(8,14,20,.55)"), joinStyle: "Round", capStyle: "Round" });
  return { type: "cim", data: { type: "CIMSymbolReference", symbol: { type: "CIMLineSymbol", symbolLayers: layers } } };
}

function shapeRenderer(m: Mode, colors: string[], sym: (m: Mode, c: string, lit: boolean) => any) {
  const base = m.shapeColor ?? FIREFLY.glow;
  return {
    type: "unique-value",
    field: "c",
    defaultSymbol: sym(m, base, false),
    uniqueValueInfos: colors.map((c) => ({ value: c, symbol: sym(m, c, false) })),
  };
}

function pointSymbolFor(m: Mode): (tint: string | null) => any {
  if (m.dots) return (t) => dotSymbol(m.fire, t);
  return (t) => fireSymbol(m.fire, t, m.tinted);
}

function pointRenderer(m: Mode, colors: string[]) {
  if (m.graded) {
    const stops = m.graded;
    const lo = stops[0][0];
    const hi = stops[stops.length - 1][0];
    if (m.gradedFire && !m.gradedFireColor)
      return { type: "simple", symbol: gradedFireSymbol(m.fire), visualVariables: [sizeByValue(lo, hi, 4.2)] };
    if (m.gradedFireColor) return gradeRenderer(stops, gradedMultiSymbol, sizeByValue(lo, hi, 3.6));
    return gradeRenderer(stops, gradedSymbol, sizeByValue(lo, hi, 2.4));
  }
  const sym = pointSymbolFor(m);
  const base: [number, number][] = m.dots
    ? [
        [9, 3.4],
        [12, 5.6],
        [14, 7.5],
        [17, 12],
      ]
    : [
        [8, 7],
        [12, 11],
        [16, 18],
      ];
  const size = sizeByZoom(base.map(([z, s]) => [z, s * m.pointScale]));
  return {
    type: "unique-value",
    field: "c",
    defaultSymbol: sym(null),
    uniqueValueInfos: colors.map((c) => ({ value: c, symbol: sym(c) })),
    visualVariables: [size],
  };
}

/** Тодруулгын цагираг — тогтмол хэмжээ (z12) */
function highlightSymbol(f: Fire) {
  return cimPoint([disc(10, null, [cim(f.core, 0.9), 1.3]), ...glow(15, f.glow, 0.4)]);
}

export function WellsMap({
  points,
  visible,
  basemap,
  onSelect,
  extent = false,
  onExtent,
  onZoom,
  onView,
  onMapClick,
  onBlankClick,
  focus = null,
  cluster = true,
  clusterMaxZoom = 15,
  clusterLabel = "inside",
  marks,
  pulse = false,
  pickedMark = null,
  hotMark = null,
  pulseColor,
  onHover,
  firefly,
  colors,
  dots,
  pointScale,
  highlight = null,
  overlays,
  adminLines = true,
  shapes,
  grades,
  weights,
  labels,
  values,
  scale,
}: {
  points: MapPoints;
  /** Шүүлтүүр давсан цэгүүдийн индекс */
  visible: Uint32Array;
  basemap: Basemap;
  onSelect: (oid: number) => void;
  /** Харагдацыг шүүлтүүр болгон дамжуулах эсэх (map action) */
  extent?: boolean;
  onExtent?: (e: Extent | null) => void;
  /**
   * Ойртолт өөрчлөгдөх бүрд одоогийн түвшинг (MapLibre-ийн хуваарьт)
   * дамжуулна — зураг зогссоны дараа.
   */
  onZoom?: (zoom: number) => void;
  /**
   * ХАРАГДАХ ХҮРЭЭ — зураг зогссоны дараа л дуудагдана.
   * ⚠ Чирэх ЯВЦАД дуугарахгүй: дуудагч тал сервер рүү асуулга явуулдаг
   * (нэгж талбар) тул хулгана хөдлөх бүрд дуугарвал хүсэлтийн үер болно.
   */
  onView?: (box: Extent, zoom: number) => void;
  /**
   * БАЙРШИЛ СОНГОХ горим — өгвөл ЗУРАГ ДЭЭРХ ДУРЫН товшилт энэ рүү
   * `lon, lat`-аа дамжуулна (цэгийг сонгохгүй), заагч загалмай болно.
   * Өгөөгүй үед зан төлөв хөндөгдөхгүй.
   */
  onMapClick?: (lon: number, lat: number) => void;
  /**
   * Цэг, дүрс ТААРААГҮЙ товшилт — суурь давхаргын (`overlays`) цонх
   * гаргахад (баавгайн самбарын ойн төрөл). Нэмэлт давхарга нь
   * харилцдаггүй тул аль дүрсэнд орсныг дуудагч тал өөрөө тогтооно.
   */
  onBlankClick?: (lon: number, lat: number) => void;
  /** Сонголтын хүрээ — өөрчлөгдөх бүрд зураг тийш нь ойртоно (zoom action) */
  focus?: Extent | null;
  /** Бөөгнөрүүлэх эсэх. ЗӨВХӨН анхны зурагдалтад уншигдана */
  cluster?: boolean;
  /** Бөөгнөрөл ЭНЭ түвшнээс цааш задарна (MapLibre-ийн zoom, анхдагч 15) */
  clusterMaxZoom?: number;
  /** Тоог дугуйн дотор бичих үү, баруун дээд буланд тэмдэг болгох уу */
  clusterLabel?: "inside" | "badge";
  /**
   * `oid` → SVG тэмдэг эсвэл зургийн хаяг. Өгвөл тухайн цэг дугуй
   * ТЭМДГЭЭР тэмдэглэгдэнэ — бөөгнөрөл задарсан үед л харагдана.
   */
  marks?: Record<number, string>;
  /** Цэг бүрийг ДОХИОЛОЛ маягийн тэмдэглэгээгээр харуулах эсэх */
  pulse?: boolean;
  /**
   * СОНГОГДСОН тэмдэглэгээ — `marks`, `pulse` горимд. Тэмдэглэгээ нь
   * DOM элемент тул зургийн тодруулгын цагирагийг ДАРНА; сонголтыг
   * тэмдэг өөрөө (`is-picked`) үүрнэ.
   */
  pickedMark?: number | null;
  /**
   * ШАРААР ТОДРОХ бүртгэл (засварын цонхны хүснэгтийн мөр дээр хулгана
   * очиход, хэрэглэгч 2026-10-21). `marks`, `pulse` горимд тэмдэглэгээний
   * ангийг сэлгэнэ; бусад цэг ба олон өнцөгт, шугамыг `hot` давхаргад шараар
   * давхарлана (ArcGIS Online-ийн вэб зургийн тодруулга шиг).
   */
  hotMark?: number | null;
  /** Дохиоллын тэмдэглэгээний өнгө — `oid` бүрд */
  pulseColor?: (oid: number) => string | undefined;
  /**
   * Хулгана тэмдэглэгээ дээр очиход — гарахад `null`. `at` нь зургийн
   * талбар доторх пикселийн байрлал (хөвөгч тайлбарт).
   */
  onHover?: (oid: number | null, at?: { x: number; y: number }) => void;
  /** Цэгийн давхаргын өнгөний гурвал. ЗӨВХӨН анхны зурагдалтад */
  firefly?: Fire;
  /**
   * Цэг бүрийн АНГИЛЛЫН өнгө (hex), индекс нь `points`-тэй ижил. Ангилал
   * ЦӨӨН үед л — биеийн доор бараан цагираг нэмэгдэнэ.
   */
  colors?: ArrayLike<string | undefined>;
  /**
   * ЖИЖИГ FIREFLY ЦЭГ (хэрэглэгч, 2026-10-07). `rank` — өнгө (hex) →
   * зурах дараалал; их нь ДЭЭР.
   */
  dots?: { rank?: Record<string, number> };
  /** Цэгийн хэмжээний үржүүлэгч (зэрэглэлгүй цэгт), анхдагч 1 */
  pointScale?: number;
  /** Тодруулах цэгийн байрлал `[lon, lat]` — гэрэлтэх цагираг */
  highlight?: [number, number] | null;
  /** Нэмэлт хил, бүсийн давхаргууд — дата давхаргын ДООР */
  overlays?: MapOverlay[];
  /**
   * Засаг захиргааны (улс · аймаг · сум) суурь хил — анхдагч асаалттай.
   * Дуудагч тал өөрийн хилийг `overlays`-ээр зурдаг бол унтраана: хоёр
   * хил давхцаж зураг замбараагүй болно.
   */
  adminLines?: boolean;
  /**
   * ДАТА олон өнцөгт — харилцдаг: `properties.oid`-оор товшилт, hover,
   * `properties.c`-д өнгө, `properties.t`-д шошго.
   */
  shapes?: {
    data: GeoJSON.FeatureCollection;
    selected?: number | null;
    /** Хүрээг гэрлээр тойруулах (bloom) — цөөн талбайд. Анхны зурагдалтад */
    glow?: boolean;
    /** ТОД НАРИЙН ХҮРЭЭ, БҮДЭГ ДҮҮРГЭЛТ (үнэлгээний хэлтэс) */
    crisp?: boolean;
    /** Давхаргын өнгө (hex) */
    color?: string;
    /** Шошго энэ zoom-оос (MapLibre-ийн хуваарь) ойртсон үед л */
    labelZoom?: number;
    /** `LineString` дүрс дээр ЧИГЛЭЛИЙН сум */
    flow?: boolean;
    /** `point` — дүрс бүрд нэг шошго; `line-center` — шугамын дундад */
    labelPlacement?: "point" | "line-center";
    /** НИМГЭН ХҮРЭЭ (голын татам); `hair` — 0.5px, бараан касинггүй (эвдэрсэн газар) */
    edge?: "thin" | "hair";
    /** ОЛОН ӨНЦӨГТИЙН ХҮРЭЭ (анхдагчаар гарна); сонгосон дүрс үргэлж хүрээтэй */
    outline?: boolean;
    /** НЭГ БИЧВЭРТ ЯГ НЭГ ШОШГО — хамгийн том дүрс дээр */
    labelUnique?: boolean;
  };
  /** АНХНЫ ХАРАГДАЦЫН МАСШТАБ (900_000 → 1:900 000) */
  scale?: number;
  /**
   * ЦЭГИЙН ОРОНД ХЭМЖИЛТИЙН УТГА (WMO-гийн station model). `maxzoom`-оос
   * ХОЛ байх үед цэг нуугдаж тоо гарна; ойртоход эсрэгээр.
   */
  values?: {
    text: string[];
    color?: string[];
    maxzoom?: number;
  };
  /** Цэгийн бичвэр шошго — `minzoom`-оос ойртсон үед */
  labels?: {
    text: string[];
    minzoom?: number;
    /** Цэгээс доош шилжих зай (em, анхдагч 0.7) */
    offset?: number;
    /** Бичвэрийн хэмжээ (pt, анхдагч 8). ЗӨВХӨН анхны зурагдалтад */
    size?: number;
    /**
     * Шошгын БИЧВЭР → өнгө (hex). Жагсаалтад байхгүй бичвэр анхдагч
     * цагаанаар. ЗӨВХӨН анхны зурагдалтад.
     */
    colors?: Record<string, string>;
    /** Хүрээний зузаан (pt, анхдагч 0.9). ЗӨВХӨН анхны зурагдалтад */
    halo?: number;
  };
  /**
   * Цэг бүрийн ХЭМЖИГДЭХҮҮН — ЗЭРЭГЛЭСЭН тэмдэг: өнгө ба хэмжээ хоёулаа
   * утгаас. `firefly: true` — нэг өнгөт гэрэлтэлт; `"graded"` — олон
   * өнгөт гэрэлтэлт.
   */
  grades?: {
    values: ArrayLike<number>;
    stops: [number, string][];
    firefly?: boolean | "graded";
  };
  /**
   * Цэг бүрийн ЖИН. Өгвөл НЯГТРАЛЫН горим: 1:20 000 хүртэл дулааны
   * зураг, түүнээс ойр бодит цэг.
   */
  weights?: number[];
}) {
  const holder = React.useRef<HTMLDivElement>(null);
  const markLayer = React.useRef<HTMLDivElement>(null);
  const ratio = React.useRef<HTMLDivElement>(null);
  /*
    SDK-ийн обьектууд REF-д — тэдгээр нь өөрчлөгддөг (давхаргын рендерер,
    график) тул React-ийн төлөвт барьж болохгүй. `ready` нь зөвхөн
    эффектүүдийг сэрээх туг.
  */
  const engine = React.useRef<Live | null>(null);
  const [ready, setReady] = React.useState(false);
  const [lost, setLost] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  const fitted = React.useRef(false);
  /** Сүүлд зурагт илгээсэн цэгийн датаны оролтууд */
  const applied = React.useRef<unknown[]>([]);
  /** oid → Esri геометр — сонгосон, хулганы доорх дүрсийг тод зурахад */
  const shapeGeoms = React.useRef(new Map<number, { geojson: GeoJSON.Geometry; c: string | null; esri?: any }>());
  /** Анхны (сонголтгүй) хүрээ — сонголт цуцлагдахад буцаж очно */
  const home = React.useRef<Extent | null>(null);
  /** Сонголтоор ойртсон эсэх */
  const zoomed = React.useRef(false);

  const selectCb = React.useRef(onSelect);
  const hoverCb = React.useRef(onHover);
  const extentCb = React.useRef(onExtent);
  const zoomCb = React.useRef(onZoom);
  const viewCb = React.useRef(onView);
  const pickCb = React.useRef(onMapClick);
  const blankCb = React.useRef(onBlankClick);
  const pulseColorRef = React.useRef(pulseColor);
  const hotRef = React.useRef(hotMark);
  const markEls = React.useRef<Map<number, HTMLElement> | null>(null);
  React.useEffect(() => {
    selectCb.current = onSelect;
    hoverCb.current = onHover;
    extentCb.current = onExtent;
    zoomCb.current = onZoom;
    viewCb.current = onView;
    pickCb.current = onMapClick;
    blankCb.current = onBlankClick;
    pulseColorRef.current = pulseColor;
  });
  const basemapRef = React.useRef(basemap);

  /** Эх сурвалж үүсгэх үед л уншигдах тохиргоо */
  const modeRef = React.useRef<Mode>({
    cluster,
    clusterMaxZoom,
    clusterLabel,
    weighted: Boolean(weights),
    graded: grades?.stops,
    gradedFire: Boolean(grades?.firefly),
    gradedFireColor: grades?.firefly === "graded",
    shaped: Boolean(shapes),
    shapeGlow: Boolean(shapes?.glow) && !shapes?.crisp,
    shapeCrisp: Boolean(shapes?.crisp),
    shapeColor: shapes?.color,
    fire: firefly ?? FIREFLY,
    tinted: Boolean(colors),
    dots: dots ?? null,
    pointScale: pointScale ?? 1,
    shapeLabelZoom: shapes?.labelZoom ?? 0,
    shapeFlow: Boolean(shapes?.flow),
    shapeLabelOnLine: shapes?.labelPlacement === "line-center",
    shapeThin: shapes?.edge === "thin",
    shapeHair: shapes?.edge === "hair",
    shapeOutline: shapes?.outline !== false,
    shapeLabelUnique: Boolean(shapes?.labelUnique),
    labeled: Boolean(labels),
    labelZoom: labels?.minzoom ?? 12,
    labelOffset: labels?.offset ?? 0.7,
    labelSize: labels?.size ?? 8,
    labelColors: labels?.colors ?? null,
    labelHalo: labels?.halo ?? 0.9,
    valued: Boolean(values),
    valueZoom: values?.maxzoom ?? 13,
    scale,
  });

  /* ---------------- Газрын зураг үүсгэх ---------------- */
  React.useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let alive = true;
    let view: any = null;
    const handles: { remove: () => void }[] = [];

    loadEsri()
      .then((E) => {
        if (!alive || !holder.current) return;
        const mode = modeRef.current;

        /* ---- Давхаргууд, ДООРООС ДЭЭШ ---- */
        const under = new E.GroupLayer({ title: "under" });

        const bndLayer = (level: string) =>
          new E.GraphicsLayer({
            title: `bnd-${level}`,
            ...(level === "aimag" ? { minScale: scaleAt(5) } : level === "soum" ? { minScale: scaleAt(8) } : {}),
          });
        const bnd = { country: bndLayer("country"), aimag: bndLayer("aimag"), soum: bndLayer("soum") };

        const shapeFields: Field[] = [
          { name: "oid", type: "double" },
          { name: "c", type: "string" },
          { name: "t", type: "string" },
        ];
        const shapePoly = mode.shaped
          ? clientLayer(E, "polygon", shapeFields, {
              renderer: shapeRenderer(mode, [], polySymbol),
              ...(mode.shapeGlow ? { effect: "bloom(1.4, 2px, 0)" } : {}),
            })
          : null;
        const lineLabels = mode.shaped && mode.shapeLabelOnLine;
        const shapeLine = mode.shaped
          ? clientLayer(E, "polyline", shapeFields, {
              renderer: shapeRenderer(mode, [], lineSymbol),
              ...(mode.shapeGlow ? { effect: "bloom(1.4, 2px, 0)" } : {}),
            })
          : null;
        /* Сонгосон, хулганы доорх дүрс — тод хувилбараар давхарлана */
        const lit = mode.shaped ? new E.GraphicsLayer({ title: "lit" }) : null;
        const above = new E.GroupLayer({ title: "above" });
        /*
          ⚠ ХЭРЧМИЙН ШОШГО ч мөн ЦЭГЭН давхаргад (шугамын жинхэнэ дунд цэг):
          Esri-ийн `center-along` нь бичвэр хэрчимдээ багтахгүй бол огт
          тавьдаггүй — 60 м-ийн шонгийн хэрчим дээр нэг ч шошго гарахгүй байв.
        */
        const shapeLabels =
          mode.shaped
            ? clientLayer(E, "point", [{ name: "t", type: "string" }, { name: "s", type: "double" }], {
                renderer: INVISIBLE,
                labelingInfo: [
                  {
                    /*
                      ⚠⚠ ШОШГО ДҮРСЭЭСЭЭ ТОМ БАЙХГҮЙ (хэрэглэгч 2026-10-23, ТХГН-ийн
                      зургаар: "label zasay"). Хол байхад хотын төвийн жижиг
                      дүрсүүдийн урт нэр бие биен дээгүүр давхцаж уншигдахгүй
                      байв. Одоо дүрсийн хэмжээ (`s`, метр) дэлгэц дээр 48px-ээс
                      бага бол шошго гарахгүй — ойртоход өөрөө гарна; урт нэр
                      хоёр мөрөнд залгагдаж, 46 тэмдэгтээс хэтэрвэл тасарна
                      (бүтэн нэр нь цонх, диаграмд). Шугамд `s` хоосон тул
                      хязгааргүй.
                    */
                    labelExpressionInfo: {
                      expression: `var t = $feature.t;
                        var s = $feature.s;
                        if (!IsEmpty(s) && s * 3779.5 / $view.scale < 48) return "";
                        return IIF(Count(t) > 46, Left(t, 45) + "…", t);`,
                    },
                    labelPlacement: "center-center",
                    deconflictionStrategy: lineLabels ? "none" : "static",
                    minScale: mode.shapeLabelZoom ? scaleAt(mode.shapeLabelZoom) * 1.01 : 0,
                    symbol: {
                      type: "text",
                      color: "#ffffff",
                      haloColor: HALO,
                      haloSize: 0.9,
                      lineWidth: 130,
                      font: { ...FONT, size: 8 },
                    },
                  },
                ],
              })
            : null;

        const pointFields: Field[] = [
          { name: "oid", type: "double" },
          { name: "w", type: "double" },
          { name: "g", type: "double" },
          { name: "c", type: "string" },
          { name: "t", type: "string" },
          { name: "r", type: "integer" },
        ];

        /*
          НЯГТРАЛЫН горим: 1:20 000 хүртэл дулааны зураг, түүнээс ойр бодит
          цэг. Заагт 0.6 түвшний давхцал — нэг нь алга болоод нөгөө нь
          гарах хооронд зураг хоосрохгүй.
        */
        const zDot = zoomForScale(20_000);
        /*
          ⚠ НЭГ ДАВХАРГА, ХОЁР РЕНДЕРЕР: дулааны зураг ба бодит цэг ижил
          145 мянган цэгийг хоёр давхаргад хуулбарлавал хөтөч хоёр дахин
          ачаална. Масштаб заагийг давах бүрд рендерер солигдоно.
        */
        const heatRenderer = {
          type: "heatmap",
          radius: 9,
          maxDensity: 3,
          minDensity: 0,
          /* Өнгө нь цэгийн палитраас (`firefly`) — самбар өөрийн
             диаграмтай нэг өнгөний гэр бүл өгч болно. Анхдагч нь cyan. */
          colorStops: [
            { ratio: 0, color: col(mode.fire.glow, 0) },
            { ratio: 0.25, color: col(mode.fire.glow, 0.32) },
            { ratio: 0.6, color: col(mode.fire.mid, 0.62) },
            { ratio: 1, color: col(mode.fire.core, 0.92) },
          ],
        };
        const dotRenderer = {
          type: "simple",
          symbol: {
            type: "simple-marker",
            color: col(mode.fire.glow, 0.9),
            outline: { color: [0, 0, 0, 0.5], width: 0.3 },
          },
          visualVariables: [
            sizeByZoom([
              [zDot - 0.6, 1.2],
              [15, 1.8],
              [18, 2.6],
            ]),
          ],
        };
        const heat = null;

        const valueScale = mode.valued ? scaleAt(mode.valueZoom) : 0;

        const pointRendererNow = mode.weighted ? heatRenderer : pointRenderer(mode, []);

        const badge = mode.clusterLabel === "badge";
        const points = clientLayer(E, "point", pointFields, {
          renderer: pointRendererNow,
          ...(mode.valued ? { minScale: valueScale } : {}),
          ...(mode.dots ? { orderBy: [{ field: "r", order: "ascending" }] } : {}),
          ...(mode.cluster && !mode.weighted
            ? {
                featureReduction: {
                  type: "cluster",
                  clusterRadius: "48px",
                  clusterMinSize: `${pt(10)}pt`,
                  clusterMaxSize: `${pt(38)}pt`,
                  maxScale: scaleAt(mode.clusterMaxZoom),
                  /* ⚠ `renderer` БИШ `symbol`: өөрийн рендерер өгвөл НЭГ гишүүнтэй
                     бөөгнөрөл ч цагираг болж зурагддаг байв */
                  symbol: {
                    type: "simple-marker",
                    color: col(mode.fire.glow, badge ? 0.14 : 0.22),
                    outline: { color: col(mode.fire.glow, 0.95), width: (badge ? 2 : 1.4) * 0.75 },
                  },
                  labelingInfo: [
                    badge
                      ? {
                          deconflictionStrategy: "none",
                          labelExpressionInfo: { expression: CLUSTER_TEXT },
                          labelPlacement: "above-right",
                          symbol: {
                            type: "text",
                            color: "#ffffff",
                            backgroundColor: [15, 23, 32, 0.92],
                            borderLineColor: col(mode.fire.glow),
                            borderLineSize: 0.75,
                            font: { ...FONT, size: 7.5 },
                          },
                        }
                      : {
                          deconflictionStrategy: "none",
                          labelExpressionInfo: { expression: CLUSTER_TEXT },
                          labelPlacement: "center-center",
                          symbol: {
                            type: "text",
                            color: "#ffffff",
                            haloColor: [0, 0, 0, 0.7],
                            haloSize: 0.9,
                            font: { ...FONT, size: 8 },
                          },
                        },
                  ],
                },
              }
            : {}),
          ...(mode.labeled
            ? {
                labelingInfo: (() => {
                  /* Бичвэр тус бүрийн өнгө — анги тутамд НЭГ шошгын класс */
                  const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
                  const cls = (where: string, color: string) => ({
                    labelExpressionInfo: { expression: "$feature.t" },
                    where,
                    labelPlacement: "below-center",
                    deconflictionStrategy: "static",
                    minScale: scaleAt(mode.labelZoom) * 1.01,
                    symbol: {
                      type: "text",
                      color,
                      haloColor: HALO,
                      haloSize: mode.labelHalo,
                      lineWidth: 80,
                      yoffset: -mode.labelOffset * 6,
                      font: { ...FONT, size: mode.labelSize },
                    },
                  });
                  const pairs = Object.entries(mode.labelColors ?? {});
                  if (!pairs.length) return [cls("t IS NOT NULL", "#eef4f8")];
                  return [
                    ...pairs.map(([t, c]) => cls(`t = ${q(t)}`, c)),
                    cls(`t IS NOT NULL AND t NOT IN (${pairs.map(([t]) => q(t)).join(", ")})`, "#eef4f8"),
                  ];
                })(),
              }
            : {}),
        });

        /* ХЭМЖИЛТИЙН УТГА — цэгийн ОРОНД, зөвхөн шошго үүрэх давхарга */
        const valuesLayer = mode.valued
          ? clientLayer(
              E,
              "point",
              [
                { name: "v", type: "string" },
                { name: "vc", type: "string" },
              ],
              { renderer: INVISIBLE, maxScale: valueScale },
            )
          : null;

        const hl = new E.GraphicsLayer({ title: "hl" });
        const hot = new E.GraphicsLayer({ title: "hot" });

        const layers: Layers = {
          under,
          bnd,
          shapePoly,
          shapeLine,
          lit,
          above,
          shapeLabels,
          heat,
          points,
          values: valuesLayer,
          hl,
          hot,
        };

        const map = new E.Map({
          layers: [
            under,
            bnd.soum,
            bnd.aimag,
            bnd.country,
            ...[shapePoly, shapeLine, lit].filter(Boolean),
            above,
            ...[shapeLabels, heat].filter(Boolean),
            points,
            ...[valuesLayer].filter(Boolean),
            hl,
            hot,
          ],
        });

        map.basemap = esriBasemaps(E, map).get(basemapRef.current.id);
        const lods = tileInfoOf(E).lods;
        view = new E.MapView({
          container: holder.current,
          map,
          center: [106.9, 47.9],
          zoom: (mode.scale ? zoomForScale(mode.scale) : 9) + 1,
          constraints: { lods, minZoom: 1, maxZoom: MAX_ML + 1, snapToZoom: false, rotationEnabled: false },
          ui: { components: [] },
          popupEnabled: false,
          /* Хулганы доорх тодруулгыг өөрсдөө зурна — SDK-ийн цэнхэр хүрээ хэрэггүй */
          highlightOptions: { color: [0, 0, 0, 0], haloOpacity: 0, fillOpacity: 0 },
        });

        return view.when().then(() => {
          if (!alive) return;

          /* ---- Масштабын заалт, тэмдэглэгээний байрлал ---- */
          handles.push(
            E.reactive.watch(
              () => view.extent,
              () => {
                const r = ratio.current;
                if (r) {
                  const y = view.height / 2;
                  const a = view.toMap({ x: 0, y });
                  const b = view.toMap({ x: 100, y });
                  if (a && b) {
                    const [lon1, lat1] = toLonLat(a.x, a.y);
                    const [lon2, lat2] = toLonLat(b.x, b.y);
                    const meters = haversine(lon1, lat1, lon2, lat2);
                    if (meters > 0) r.textContent = ratioText(meters / 100 / M_PER_CSS_PX);
                  }
                }
                placeMarks(view, markLayer.current);
              },
              { initial: true },
            ),
          );

          /* ---- Зогсох бүрд: ойртолт, хүрээ ---- */
          let lastZoom = NaN;
          const stationary = () => {
            const z = mlOf(view.zoom);
            if (z !== lastZoom) {
              lastZoom = z;
              zoomCb.current?.(z);
            }
            const box = extentOf(view);
            if (box) viewCb.current?.(box, z);
          };
          stationary();
          handles.push(E.reactive.when(() => view.stationary, stationary));

          if (mode.weighted) {
            const zone = scaleAt(zDot - 0.3);
            handles.push(
              E.reactive.watch(
                () => view.scale > zone,
                (far: boolean) => {
                  layers.points.renderer = far ? heatRenderer : dotRenderer;
                },
                { initial: true },
              ),
            );
          }

          /* ---- WebGL тасалдал — SDK өөрөө сэргээх оролдлого хийнэ ---- */
          let revive: number | null = null;
          handles.push(
            E.reactive.watch(
              () => view.fatalError,
              (err: unknown) => {
                if (!alive) return;
                setLost(Boolean(err));
                if (err) {
                  if (revive != null) window.clearTimeout(revive);
                  revive = window.setTimeout(() => view.tryFatalErrorRecovery(), 1500);
                }
              },
            ),
          );

          const self: Live = { E, view, map, layers, mode };
          bindPointer(view, layers, selectCb, hoverCb, pickCb, blankCb, (id) => {
            if (!layers.lit) return;
            layers.lit.__hot = id;
            redrawLit(self, shapeGeoms.current);
          });

          engine.current = self;
          /*
            Суурь зургийн галерейд ({@link src/components/map/basemap-gallery.tsx})
            зургийг олгоно: тэр нь самбар бүрд зурагтайгаа ХӨРШ бүрэлдэхүүн
            тул React-аар дамжих зам байхгүй — DOM үйл явдлаар.
          */
          const root = holder.current?.parentElement as any;
          if (root) {
            root.__engine = self;
            root.dispatchEvent(new CustomEvent("wells-ready", { bubbles: true, detail: self }));
          }
          setLost(false);
          setReady(true);
        });
      })
      .catch((e: unknown) => {
        if (alive) setFailed(e instanceof Error ? e.message : "Газрын зураг ачаалагдсангүй");
      });

    return () => {
      alive = false;
      for (const h of handles) h.remove();
      view?.destroy();
      fitted.current = false;
      engine.current = null;
      setReady(false);
    };
  }, []);

  /* ---------------- Засаг захиргааны хил ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    let alive = true;
    const { E, layers } = live;
    if (!adminLines) {
      for (const level of ["country", "aimag", "soum"] as const) layers.bnd[level]?.removeAll();
      return;
    }
    // eslint-disable-next-line no-restricted-globals -- өөрийн статик /api/boundaries — портал биш, токен хэрэггүй
    fetch(asset("/api/boundaries"))
      .then((r) => (r.ok ? r.json() : null))
      .then((b: BoundarySet | null) => {
        if (!alive || !b) return;
        const style = {
          country: { color: [255, 255, 255, 0.75], width: 1.35, style: "solid" },
          aimag: { color: [255, 255, 255, 0.45], width: 0.65, style: "dash" },
          soum: { color: [255, 255, 255, 0.3], width: 0.45, style: "short-dash" },
        } as const;
        for (const level of ["country", "aimag", "soum"] as const) {
          const line = { type: "simple-line", ...style[level], cap: "round", join: "round" };
          const graphics = b[level].features
            .map((f) => {
              const geometry = esriGeom(f.geometry);
              if (!geometry) return null;
              const symbol =
                geometry.type === "polygon"
                  ? { type: "simple-fill", color: [0, 0, 0, 0], outline: line }
                  : line;
              return new E.Graphic({ geometry, symbol });
            })
            .filter(Boolean);
          layers.bnd[level]?.removeAll();
          layers.bnd[level]?.addMany(graphics);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, adminLines]);

  /* ---------------- Суурь зураг солих ---------------- */
  React.useEffect(() => {
    basemapRef.current = basemap;
    const live = engine.current;
    if (!ready || !live) return;
    /* ⚠ ИЖИЛ суурийг дахин тавихгүй: зураг бэлэн болмогц энэ эффект
       ажилладаг бөгөөд үүсэж буй хавтангийн давхаргыг солиход SDK
       "reading 'reject'" алдаа шиддэг байв */
    if (live.map.basemap?.id === basemap.id) return;
    live.map.basemap = esriBasemaps(live.E, live.map).get(basemap.id);
  }, [ready, basemap]);

  /* ---------------- Харагдацын үйлдэл (map action) ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    if (!extent) {
      extentCb.current?.(null);
      return;
    }
    const emit = () => {
      const box = extentOf(live.view);
      if (box) extentCb.current?.(box);
    };
    emit();
    const h = live.E.reactive.when(() => live.view.stationary, emit);
    return () => h.remove();
  }, [ready, extent]);

  /* ---------------- Сонголт руу ойртох (zoom action) ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { view, mode } = live;
    const back = home.current ?? (mode.scale ? ([106.9, 47.9, 106.9, 47.9] as Extent) : null);
    const target = focus ?? (zoomed.current ? back : null);
    if (!target) return;
    zoomed.current = focus != null;
    const [w, s, e, n] = target;
    if (!focus && mode.scale) {
      view
        .goTo({ center: [(w + e) / 2, (s + n) / 2], zoom: zoomForScale(mode.scale, (s + n) / 2) + 1 }, { duration: 700 })
        .catch(() => {});
      return;
    }
    fitTo(view, target, 44, focus ? 14 : 13, 700);
  }, [ready, focus]);

  /* ---------------- Цэгийн өгөгдөл ---------------- */
  const dotRank = dots?.rank ? JSON.stringify(dots.rank) : "";
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { E, layers, mode, view } = live;
    /* ИЖИЛ датаг дахин ачаалахгүй — StrictMode болон хамааралгүй
       шинэчлэл 145 мянган цэгийг дахин илгээх байв */
    const sig = [live, points, visible, weights, grades, labels, values, colors, dotRank];
    if (applied.current.length === sig.length && sig.every((v, i) => v === applied.current[i])) return;
    applied.current = sig;
    const { lon, lat, oid } = points;
    const text = labels?.text;
    const rank = dotRank ? (JSON.parse(dotRank) as Record<string, number>) : null;

    const tints = new Set<string>();
    const features: GeoJSON.Feature[] = new Array(visible.length);
    for (let k = 0; k < visible.length; k++) {
      const i = visible[k];
      const c = colors?.[i];
      if (c) tints.add(c);
      features[k] = pointFeature(lon[i], lat[i], {
        oid: oid[i],
        w: weights ? weights[i] : null,
        g: grades ? grades.values[i] : null,
        c: c ?? null,
        /* Хоосон шошгыг ОГТ бичихгүй — `t IS NOT NULL` шүүлт */
        t: text?.[i] || null,
        r: c && rank ? (rank[c] ?? 0) : 0,
      });
    }
    if (!mode.weighted && !mode.graded) {
      const list = [...tints].sort();
      const key = list.join("|");
      if (layers.points.__tints !== key) {
        layers.points.__tints = key;
        layers.points.renderer = pointRenderer(mode, list);
      }
    }
    refill(E, view, slotOf(layers, "points"), () => features);

    if (layers.values && values) {
      const groups = new Set<string>();
      const vals: GeoJSON.Feature[] = [];
      for (let k = 0; k < visible.length; k++) {
        const i = visible[k];
        const v = values.text[i];
        if (!v) continue;
        const vc = values.color?.[i] ?? "#eef4f8";
        groups.add(vc);
        vals.push(pointFeature(lon[i], lat[i], { v, vc }));
      }
      /* Шошгын өнгө нь УТГЫНХ — Esri-ийн шошго атрибутаас өнгө авдаггүй
         тул өнгө тус бүрд нэг анги */
      layers.values.labelingInfo = [...groups].map((vc) => ({
        labelExpressionInfo: { expression: "$feature.v" },
        where: `vc = '${vc}'`,
        labelPlacement: "center-center",
        deconflictionStrategy: "static",
        symbol: {
          type: "text",
          color: vc,
          haloColor: [8, 14, 20, 0.9],
          haloSize: 1.2,
          font: { ...FONT, size: 10 },
        },
      }));
      refill(E, view, slotOf(layers, "values"), () => vals);
    }

    /*
      Эхний удаа өгөгдлийн гол бөөгнөрөл рүү тааруулна — 1–99 хувийн муж:
      улс даяар тархсан ~2% нь харагдацыг сунгаж, өтгөн хэсэг цэг болж
      хумигдахаас сэргийлнэ. Энэ хүрээ нь `home` — сонголт цуцлагдахад
      буцах байрлал.
    */
    if (!fitted.current && visible.length > 0) {
      fitted.current = true;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k < visible.length; k++) {
        xs.push(lon[visible[k]]);
        ys.push(lat[visible[k]]);
      }
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      const lo = Math.floor(xs.length * 0.01);
      const hi = Math.ceil(xs.length * 0.99) - 1;
      home.current = [xs[lo], ys[lo], xs[hi], ys[hi]];
      if (mode.scale) {
        view
          .goTo(
            { center: [(xs[lo] + xs[hi]) / 2, (ys[lo] + ys[hi]) / 2], zoom: zoomForScale(mode.scale, (ys[lo] + ys[hi]) / 2) + 1 },
            { animate: false },
          )
          .catch(() => {});
      } else {
        fitTo(view, home.current, 30, 13, 0);
      }
    }
  }, [ready, points, visible, weights, grades, labels, values, colors, dotRank]);

  /* ---------------- Шошгын хязгаар — АМЬД ---------------- */
  const shapeLabelZoom = shapes?.labelZoom;
  const pointLabelZoom = labels?.minzoom;
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { layers } = live;
    const set = (layer: any, z: number | undefined) => {
      if (!layer?.labelingInfo?.length || z == null) return;
      layer.labelingInfo = layer.labelingInfo.map((c: any) => {
        const n = c.clone();
        n.minScale = scaleAt(z) * 1.01;
        return n;
      });
    };
    set(layers.shapeLabels ?? layers.shapeLine, shapeLabelZoom);
    if (!live.mode.cluster || live.mode.weighted) set(layers.points, pointLabelZoom);
    else if (pointLabelZoom != null && layers.points.labelingInfo?.length) set(layers.points, pointLabelZoom);
  }, [ready, shapeLabelZoom, pointLabelZoom]);

  /* ---------------- Дата олон өнцөгт ---------------- */
  const shapeData = shapes?.data;
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live || !shapeData) return;
    const { E, layers, mode } = live;
    const geoms = shapeGeoms.current;
    geoms.clear();
    const polys: GeoJSON.Feature[] = [];
    const lines: GeoJSON.Feature[] = [];
    const colorSet = new Set<string>();
    for (const f of shapeData.features) {
      const geometry = cleanGeom(f.geometry);
      const fam = familyOf(geometry);
      if (!geometry || (fam !== "polygon" && fam !== "polyline")) continue;
      const p = f.properties ?? {};
      const o = Number(p.oid ?? f.id);
      const c = typeof p.c === "string" ? p.c : null;
      if (c) colorSet.add(c);
      /* Esri геометр нь ЗӨВХӨН тодруулах үед хөрвүүлэгдэнэ (`redrawLit`) */
      geoms.set(o, { geojson: geometry, c });
      (fam === "polygon" ? polys : lines).push({
        type: "Feature",
        geometry,
        properties: { oid: o, c, t: typeof p.t === "string" && p.t ? p.t : null },
      });
    }
    const list = [...colorSet].sort();
    const key = list.join("|");
    if (layers.shapePoly && layers.shapePoly.__tints !== key) {
      layers.shapePoly.__tints = key;
      layers.shapePoly.renderer = shapeRenderer(mode, list, polySymbol);
      layers.shapeLine.renderer = shapeRenderer(mode, list, lineSymbol);
    }
    if (layers.shapePoly) refill(E, live.view, slotOf(layers, "shapePoly"), () => polys);
    if (layers.shapeLine) refill(E, live.view, slotOf(layers, "shapeLine"), () => lines);
    /* Шошгын цэгүүд дүрстэйгээ ХАМТ шинэчлэгдэнэ */
    if (layers.shapeLabels) {
      const lp = mode.shapeLabelOnLine ? lineMidpoints(shapeData) : labelPoints(shapeData, mode.shapeLabelUnique);
      refill(E, live.view, slotOf(layers, "shapeLabels"), () =>
        lp.features.flatMap((f) => {
          const geometry = cleanGeom(f.geometry);
          return geometry
            ? [{ type: "Feature" as const, geometry, properties: { t: f.properties?.t ?? null, s: f.properties?.s ?? null } }]
            : [];
        }),
      );
    }
    redrawLit(live, geoms);
  }, [ready, shapeData]);

  /* Сонгогдсон талбай */
  const shapePick = shapes?.selected ?? null;
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live?.layers.lit) return;
    live.layers.lit.__picked = shapePick;
    redrawLit(live, shapeGeoms.current);
  }, [ready, shapePick, shapeData]);

  /* ---------------- Нэмэлт давхарга (хил, бүс) ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { E, layers } = live;
    const list = overlays ?? [];
    const kept = new Set(list.map((o) => o.id));
    for (const group of [layers.under, layers.above]) {
      for (const l of group.layers.toArray()) {
        if (!kept.has(l.__ovId) || l.__above !== (group === layers.above)) {
          group.remove(l);
          l.destroy();
        }
      }
    }
    for (const o of list) {
      const group = o.above ? layers.above : layers.under;
      const fam = familyOf(o.data.features.find((f) => f.geometry)?.geometry) ?? "polygon";
      let layer = group.layers.find((l: any) => l.__ovId === o.id);
      const line = { type: "simple-line", color: col(o.line.color, o.line.opacity), width: o.line.width * 0.75, join: "round", style: o.line.style ?? "solid" };
      const fillOpacity = o.fill?.opacity ?? 0.08;
      const renderer =
        fam === "polygon"
          ? o.fill?.byGrid
            ? {
                type: "unique-value",
                field: "gridcode",
                defaultSymbol: { type: "simple-fill", color: col(o.fill.color, o.fill.byGrid[0]), outline: line },
                uniqueValueInfos: o.fill.byGrid.map((v, i) => ({
                  value: i + 1,
                  symbol: { type: "simple-fill", color: col(o.fill!.color, v), outline: line },
                })),
              }
            : {
                type: "simple",
                symbol: { type: "simple-fill", color: o.fill ? col(o.fill.color, fillOpacity) : [0, 0, 0, 0], outline: line },
              }
          : fam === "polyline"
            ? { type: "simple", symbol: line }
            : { type: "simple", symbol: { type: "simple-marker", size: 4, color: col(o.line.color, o.line.opacity), outline: null } };
      const feats = () =>
        o.data.features.flatMap((f) => {
          const geometry = cleanGeom(f.geometry);
          if (!geometry || familyOf(geometry) !== fam) return [];
          const gc = Number(f.properties?.gridcode);
          const t = o.label ? f.properties?.[o.label.field] : null;
          return [
            {
              type: "Feature" as const,
              geometry,
              properties: {
                gridcode: Number.isFinite(gc) ? gc : null,
                t: typeof t === "string" && t.trim() ? t.trim() : null,
              },
            },
          ];
        });
      if (!layer || layer.geometryType !== fam) {
        if (layer) {
          group.remove(layer);
          layer.destroy();
        }
        const labelingInfo = o.label
          ? [
              {
                labelExpressionInfo: { expression: "$feature.t" },
                where: "t IS NOT NULL",
                labelPlacement: fam === "polygon" ? "always-horizontal" : "center-along",
                deconflictionStrategy: "static",
                minScale: o.label.minzoom != null ? scaleAt(o.label.minzoom) * 1.01 : 0,
                symbol: {
                  type: "text",
                  color: o.label.color ?? "#eef4f8",
                  haloColor: HALO,
                  haloSize: 0.8,
                  font: { ...FONT, size: o.label.size ?? 8 },
                },
              },
            ]
          : null;
        layer = geoLayer(
          E,
          fam,
          [
            { name: "gridcode", type: "integer" },
            { name: "t", type: "string" },
          ],
          {
            renderer,
            ...(labelingInfo ? { labelingInfo, labelsVisible: true } : {}),
            ...(o.minzoom != null ? { minScale: scaleAt(o.minzoom) * 1.01 } : {}),
          },
          feats(),
        );
        layer.__ovId = o.id;
        layer.__above = Boolean(o.above);
        layer.__data = o.data;
        group.add(layer);
      } else if (layer.__style !== JSON.stringify(renderer)) {
        layer.renderer = renderer;
      }
      layer.__style = JSON.stringify(renderer);
      if (layer.__data !== o.data) {
        layer.__data = o.data;
        const id = o.id;
        refill(
          E,
          live.view,
          {
            key: `ov:${(layers as any).__id ?? 0}:${id}`,
            /* Солилтын агшинд хуучин, шинэ хоёр зэрэг байж болно — сүүлийнх нь шинэ */
            get: () => group.layers.filter((l: any) => l.__ovId === id).at(-1),
            set: () => {},
          },
          feats,
        );
      }
    }
    /* Давхарын дараалал = жагсаалтын дараалал. `group.add` нь шинийг ДЭЭР
       нэмдэг тул хожуу ирсэн (эсвэл унтрааж асаасан) суурь давхарга хил
       дээгүүр гарч байв (баавгайн самбарын ойн төрөл, 2026-10-20) */
    for (const group of [layers.under, layers.above]) {
      let at = 0;
      for (const o of list) {
        if (Boolean(o.above) !== (group === layers.above)) continue;
        for (const l of group.layers.filter((x: any) => x.__ovId === o.id).toArray())
          group.reorder(l, at++);
      }
    }
  }, [ready, overlays]);

  /* ---------------- Тодруулгын цагираг ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { E, layers, mode } = live;
    layers.hl.removeAll();
    if (highlight)
      layers.hl.add(
        new E.Graphic({
          geometry: mercPoint(highlight[0], highlight[1]),
          symbol: highlightSymbol(mode.fire),
        }),
      );
  }, [ready, highlight]);

  /* ---------------- Тэмдэглэгээ (DOM) ----------------
     Бөөгнөрөлтэй ЗЭРЭГЦЭЖ ажиллана: бөөгнөрөл задарч дан цэг болсон
     бичлэг л тэмдгээ харуулна. DOM элемент бүр зураг татдаг тул
     харагдах хүрээ ба `MARKER_CAP` хоёроор хязгаарлана. */
  React.useEffect(() => {
    const host = markLayer.current;
    const live = engine.current;
    if (!ready || !live || !host) return;
    const { E, view, layers, mode } = live;
    const els = new Map<number, HTMLElement>();
    markEls.current = els;
    if (!marks && !pulse) {
      host.replaceChildren();
      return;
    }
    let turn = 0;

    const draw = (want: Map<number, { mark: string; pos: [number, number]; tint?: string }>) => {
      for (const [id, el] of els)
        if (!want.has(id)) {
          el.remove();
          els.delete(id);
        }
      for (const [id, { mark, pos, tint }] of want) {
        if (els.has(id)) continue;
        const el = markerEl(
          mark,
          () => selectCb.current(id),
          hoverCb.current
            ? (over) => {
                const at = screenOf(view, pos);
                hoverCb.current?.(over ? id : null, over && at ? { x: at[0], y: at[1] } : undefined);
              }
            : undefined,
          tint,
        );
        const wrap = document.createElement("div");
        wrap.className = "wells-mark";
        wrap.dataset.lon = String(pos[0]);
        wrap.dataset.lat = String(pos[1]);
        wrap.appendChild(el);
        host.appendChild(wrap);
        els.set(id, wrap);
      }
      for (const [id, wrap] of els) {
        wrap.firstElementChild?.classList.toggle("is-picked", id === pickedMark);
        wrap.firstElementChild?.classList.toggle("is-hot", id === hotRef.current);
      }
      placeMarks(view, host);
    };

    const sync = async () => {
      const mine = ++turn;
      const want = new Map<number, { mark: string; pos: [number, number]; tint?: string }>();
      const { lon, lat, oid } = points;
      if (pulse) {
        for (let k = 0; k < visible.length && want.size < MARKER_CAP; k++) {
          const i = visible[k];
          want.set(oid[i], { mark: "pulse", pos: [lon[i], lat[i]], tint: pulseColorRef.current?.(oid[i]) });
        }
        return draw(want);
      }
      const box = extentOf(view);
      if (!box || !marks) return;
      const inView = (x: number, y: number) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
      /*
        Бөөгнөрсөн цэгийг АЛГАСНА: бөөгнөрлүүдийг SDK-ээс асууж, хоёроос
        олон гишүүнтэйн бүрэлдэхүүнийг хасна. SDK хариулахгүй бол
        бөөгнөрлийн хязгаараас ойр үед л тэмдэглэнэ.
      */
      let clustered: Set<number> | null = null;
      const z = mlOf(view.zoom);
      if (mode.cluster && z < mode.clusterMaxZoom) {
        clustered = new Set();
        try {
          const lv = await view.whenLayerView(layers.points);
          const agg = await lv.queryAggregates();
          const ids = agg.features.filter((f: any) => (f.attributes?.cluster_count ?? 1) > 1).map((f: any) => f.attributes.aggregateId);
          if (ids.length) {
            const res = await lv.queryFeatures({ aggregateIds: ids, outFields: ["oid"], returnGeometry: false });
            for (const f of res.features) clustered.add(Number(f.attributes.oid));
          }
        } catch {
          clustered = null;
          if (mine === turn) draw(new Map());
          return;
        }
      }
      if (mine !== turn) return;
      for (let k = 0; k < visible.length && want.size < MARKER_CAP; k++) {
        const i = visible[k];
        const id = oid[i];
        const mark = marks[id];
        if (!mark || !inView(lon[i], lat[i]) || clustered?.has(id)) continue;
        want.set(id, { mark, pos: [lon[i], lat[i]] });
      }
      draw(want);
    };

    sync();
    /* Зураг тогтож, давхарга (бөөгнөрөл) зурагдаж дуусах бүрд — дата
       солигдож шинэ давхарга орж ирэхэд ч мөн */
    let last = "";
    const h = pulse
      ? null
      : E.reactive.when(
          () => !live.view.updating && live.view.stationary,
          () => {
            /* Асуулга өөрөө `updating`-ийг сэлгэж болно — байрлал, давхарга
               өөрчлөгдөөгүй бол дахин асуухгүй (төгсгөлгүй давталт) */
            const c = view.center;
            const key = `${view.zoom.toFixed(3)}|${Math.round(c.x)}|${Math.round(c.y)}|${layers.points.uid}`;
            if (key === last) return;
            last = key;
            void sync();
          },
        );
    return () => {
      turn++;
      h?.remove();
      host.replaceChildren();
    };
  }, [ready, marks, pulse, points, visible, pickedMark]);

  React.useEffect(() => {
    hotRef.current = hotMark;
    for (const [id, wrap] of markEls.current ?? []) wrap.firstElementChild?.classList.toggle("is-hot", id === hotMark);
  }, [hotMark]);

  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { E, layers } = live;
    layers.hot.removeAll();
    if (hotMark == null) return;
    const g = shapeGeoms.current.get(hotMark);
    if (g) {
      g.esri ??= esriGeom(g.geojson);
      if (!g.esri) return;
      const symbol =
        g.esri.type === "polygon"
          ? { type: "simple-fill", color: [255, 230, 0, 0.22], outline: { color: [255, 230, 0, 1], width: 2.6 } }
          : { type: "simple-line", color: [255, 230, 0, 1], width: 4, cap: "round", join: "round" };
      layers.hot.add(new E.Graphic({ geometry: g.esri, symbol }));
      return;
    }
    if (marks || pulse) return;
    const i = points.oid.indexOf(hotMark);
    if (i < 0) return;
    layers.hot.add(
      new E.Graphic({
        geometry: mercPoint(points.lon[i], points.lat[i]),
        symbol: { type: "simple-marker", size: 15, color: [255, 230, 0, 0.95], outline: { color: [8, 14, 20, 0.85], width: 1.6 } },
      }),
    );
  }, [ready, hotMark, points, shapeData, marks, pulse]);

  /*
    2D / 3D (хэрэглэгчийн хүсэлт, 2026-09-17). 3D нь 2D-ийн ДЭЭГҮҮР
    Esri-ийн `SceneView` — 2D зураг доор нь амьд үлдэнэ.
  */
  const [dim, setDim] = React.useState<"2d" | "3d">("2d");
  const root = React.useRef<HTMLDivElement>(null);
  /*
    3D-д самбарын 2D зурагт зориулсан ХӨВӨГЧ удирдлагууд (нэмэлт давхаргын
    товч, шатлалын тайлбар, бичлэгийн цонх …) НУУГДАНА — тэд 3D-ийн
    баруун дээд буланд суух хэрэгслүүдтэй давхцаж, 3D-д хамааралгүй
    зүйлийг зааж байв (хэрэглэгч 2026-10-15). Самбар бүр өөрөөр
    байрлуулдаг тул ЗӨВХӨН зургийн эх элементийн `absolute` хүүхдүүд.
  */
  React.useLayoutEffect(() => {
    const host = root.current?.parentElement;
    if (!host || dim !== "3d") return;
    const hidden: HTMLElement[] = [];
    for (const el of Array.from(host.children) as HTMLElement[]) {
      if (el === root.current || el.style.visibility === "hidden") continue;
      const pos = getComputedStyle(el).position;
      if (pos !== "absolute" && pos !== "fixed") continue;
      el.style.visibility = "hidden";
      hidden.push(el);
    }
    return () => hidden.forEach((el) => (el.style.visibility = ""));
  }, [dim]);

  return (
    <div ref={root} className="wells-esri relative h-full w-full">
      <div ref={holder} className="h-full w-full" />
      <div ref={markLayer} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />
      {/* Хайрцаггүй, шууд зураг дээр суух тул уншигдац нь сүүдрээс хамаарна */}
      <div
        ref={ratio}
        className="num pointer-events-none absolute bottom-2.5 left-2.5 z-[2] text-[10px] leading-none text-ink-2"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
      />
      {/*
        ТАСАЛДЛЫГ ИЛ ХЭЛНЭ — туван цагаан болоход хэрэглэгч зураг эвдэрсэн
        гэж үзнэ. ⚠ `--ochre`: дүрслэл сэргэх боломжтой.
      */}
      {lost || failed ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p
            className={`elevated max-w-[320px] rounded-xs border border-line bg-paper/92 px-4 py-3 text-center text-[12.5px] leading-relaxed backdrop-blur-md ${failed ? "text-clay" : "text-ochre"}`}
          >
            {failed ?? "Газрын зургийн дүрслэл тасалдав. Сэргээж байна."}
          </p>
        </div>
      ) : null}
      {dim === "3d" && <SceneOverlay />}
      {dim === "2d" && <ZoomButtons engine={engine} />}
      <DimensionToggle value={dim} onChange={setDim} />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Тусламжийн функцууд
   -------------------------------------------------------------------------- */

function haversine(lon1: number, lat1: number, lon2: number, lat2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

/** Шугамын УРТЫН дунд цэг — хэрчмийн шошгонд */
function lineMidpoints(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const f of fc.features) {
    const t = f.properties?.t;
    const g = f.geometry;
    if (typeof t !== "string" || !t || !g) continue;
    const line =
      g.type === "LineString" ? g.coordinates : g.type === "MultiLineString" ? g.coordinates.reduce((a, b) => (b.length > a.length ? b : a), [] as GeoJSON.Position[]) : null;
    if (!line || line.length < 2) continue;
    const seg = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
    let half = seg.reduce((a, b) => a + b, 0) / 2;
    let at: GeoJSON.Position = line[0];
    for (let i = 0; i < seg.length; i++) {
      if (half <= seg[i]) {
        const k = seg[i] ? half / seg[i] : 0;
        at = [line[i][0] + (line[i + 1][0] - line[i][0]) * k, line[i][1] + (line[i + 1][1] - line[i][1]) * k];
        break;
      }
      half -= seg[i];
    }
    features.push({ type: "Feature", properties: { t }, geometry: { type: "Point", coordinates: at } });
  }
  return { type: "FeatureCollection", features };
}

/** Харагдах хүрээ — газарзүйн солбицолд */
function extentOf(view: any): Extent | null {
  const e = view?.extent;
  if (!e) return null;
  const [w, s] = toLonLat(e.xmin, e.ymin);
  const [ea, n] = toLonLat(e.xmax, e.ymax);
  return [w, s, ea, n];
}

/** Газарзүйн цэгийн дэлгэцийн байрлал (эргүүлэлтгүй зураг) */
function screenOf(view: any, [lon, lat]: [number, number]): [number, number] | null {
  const e = view?.extent;
  if (!e) return null;
  const [x, y] = toMerc(lon, lat);
  return [((x - e.xmin) / (e.xmax - e.xmin)) * view.width, ((e.ymax - y) / (e.ymax - e.ymin)) * view.height];
}

/** Тэмдэглэгээнүүдийг зургийн одоогийн байрлалд тааруулна */
function placeMarks(view: any, host: HTMLElement | null) {
  if (!host) return;
  for (const el of host.children as unknown as Iterable<HTMLElement>) {
    const at = screenOf(view, [Number(el.dataset.lon), Number(el.dataset.lat)]);
    if (at) el.style.transform = `translate(${at[0]}px, ${at[1]}px)`;
  }
}

/**
 * Хүрээнд тааруулна — MapLibre-ийн `fitBounds`-тай ижил (`padding` px,
 * `maxMl` нь MapLibre-ийн zoom).
 */
function fitTo(view: any, [w, s, e, n]: Extent, padding: number, maxMl: number, duration: number) {
  const [x0, y0] = toMerc(w, s);
  const [x1, y1] = toMerc(e, n);
  const W = Math.max(1, view.width - padding * 2);
  const H = Math.max(1, view.height - padding * 2);
  const res = Math.max((x1 - x0) / W, (y1 - y0) / H, 1e-6);
  const zoom = Math.min(Math.log2(156543.03392804097 / res), maxMl + 1);
  const center = toLonLat((x0 + x1) / 2, (y0 + y1) / 2);
  view.goTo({ center, zoom }, duration ? { duration } : { animate: false }).catch(() => {});
}

/** Сонгосон ба хулганы доорх дүрсийг тод хувилбараар зурна */
function redrawLit(live: Live, geoms: Map<number, { geojson: GeoJSON.Geometry; c: string | null; esri?: any }>) {
  const lit = live.layers.lit;
  if (!lit) return;
  const { E, mode } = live;
  lit.removeAll();
  const ids = new Set<number>([lit.__picked, lit.__hot].filter((x) => x != null));
  for (const id of ids) {
    const g = geoms.get(id);
    if (!g) continue;
    g.esri ??= esriGeom(g.geojson);
    if (!g.esri) continue;
    const c = g.c ?? mode.shapeColor ?? FIREFLY.glow;
    const symbol = g.esri.type === "polygon" ? polySymbol(mode, c, true) : lineSymbol(mode, c, true);
    lit.add(new E.Graphic({ geometry: g.esri, symbol }));
  }
}

/*
  ТОВШИЛТ, HOVER — SDK-ийн `hitTest`-ээр.

  ⚠⚠ ЦЭГ нь ОЛОН ӨНЦӨГТӨӨС ДАВУУ ЭРХТЭЙ (2026-09-30): булаг нь өөрийн
  хамгаалалтын бүсийн ДОТОР сууна тул товшилт ЦЭГИЙГ сонгох ёстой.
  ⚠ Hover-ийн `hitTest` нэг удаад НЭГ — явж байхад ирсэн хөдөлгөөний
  СҮҮЛИЙНХ нь л дараа нь асуугдана.
*/
function bindPointer(
  view: any,
  layers: Layers,
  selectCb: React.RefObject<(oid: number) => void>,
  hoverCb: React.RefObject<((oid: number | null, at?: { x: number; y: number }) => void) | undefined>,
  pickCb: React.RefObject<((lon: number, lat: number) => void) | undefined>,
  blankCb: React.RefObject<((lon: number, lat: number) => void) | undefined>,
  /** Хулганы доорх дүрс (олон өнцөгт) — тод хувилбараар зурагдана */
  onHot: (id: number | null) => void,
) {
  const test = async (p: { x: number; y: number }) => {
    /* Давхарга дата солигдох бүрд шинэчлэгддэг тул ҮРГЭЛЖ одоогийнхыг авна */
    const include = [layers.points, layers.shapePoly, layers.shapeLine].filter(Boolean);
    const res = await view.hitTest(p, { include });
    let point: any = null;
    let shape: any = null;
    for (const r of res.results ?? []) {
      if (r.type !== "graphic") continue;
      if (r.layer === layers.points && !point) point = r.graphic;
      else if (r.layer !== layers.points && !shape) shape = r.graphic;
    }
    return { point, shape };
  };

  const isCluster = (g: any) => g?.isAggregate || g?.attributes?.cluster_count > 1;

  view.on("click", async (e: any) => {
    /* Байршил сонгох горимд цэг, дүрс сонгохгүй — товшсон газар л */
    const pick = pickCb.current;
    if (pick) {
      const m = e.mapPoint;
      if (m && Number.isFinite(m.longitude) && Number.isFinite(m.latitude))
        pick(m.longitude, m.latitude);
      return;
    }
    const { point, shape } = await test({ x: e.x, y: e.y });
    if (point && isCluster(point)) {
      view.goTo({ target: point.geometry, zoom: Math.min(view.zoom + 2, 18) }, { duration: 500 }).catch(() => {});
      return;
    }
    const g = point ?? shape;
    const oid = Number(g?.attributes?.oid);
    if (g && Number.isFinite(oid)) selectCb.current?.(oid);
    else if (!g) {
      const m = e.mapPoint;
      if (m && Number.isFinite(m.longitude) && Number.isFinite(m.latitude))
        blankCb.current?.(m.longitude, m.latitude);
    }
  });

  let busy = false;
  let next: { x: number; y: number } | null = null;
  let over = false;
  let hot: number | null = null;
  const setHot = (id: number | null) => {
    if (hot === id) return;
    hot = id;
    onHot(id);
  };

  const run = async () => {
    busy = true;
    while (next) {
      const p = next;
      next = null;
      let hit: { point: any; shape: any };
      try {
        hit = await test(p);
      } catch {
        continue;
      }
      const g = hit.point ?? hit.shape;
      view.container.style.cursor = pickCb.current ? "crosshair" : g ? "pointer" : "";
      const oid = Number(g?.attributes?.oid);
      if (g && !isCluster(g) && Number.isFinite(oid)) {
        over = true;
        hoverCb.current?.(oid, p);
      } else if (over) {
        over = false;
        hoverCb.current?.(null);
      }
      const shapeId = !hit.point && hit.shape ? Number(hit.shape.attributes?.oid) : null;
      setHot(Number.isFinite(shapeId) ? shapeId : null);
    }
    busy = false;
  };

  view.on("pointer-move", (e: any) => {
    next = { x: e.x, y: e.y };
    if (!busy) void run();
  });
  view.on("pointer-leave", () => {
    next = null;
    view.container.style.cursor = "";
    setHot(null);
    if (over) {
      over = false;
      hoverCb.current?.(null);
    }
  });
}

/**
 * Дугуй тэмдэглэгээ — зургийн хаяг, SVG тэмдэг эсвэл дохиоллын цохилт.
 * Хоёулаа өөрийн кодоос гаралтай тул `innerHTML` аюулгүй.
 */
function markerEl(mark: string, onClick: () => void, onHover?: (over: boolean) => void, tint?: string) {
  const el = document.createElement("button");
  el.type = "button";
  if (tint) el.style.setProperty("--pin", tint);
  if (mark === "pulse") {
    el.className = "pulse-pin";
    el.innerHTML = '<span class="ring"></span><span class="ring d"></span>';
  } else if (mark.startsWith("<svg")) {
    el.className = "species-pin";
    el.innerHTML = mark;
  } else {
    el.className = "species-pin photo";
    el.style.backgroundImage = `url("${mark}")`;
  }
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  if (onHover) {
    el.addEventListener("mouseenter", () => onHover(true));
    el.addEventListener("mouseleave", () => onHover(false));
  }
  return el;
}

/** 2D / 3D сэлгэгч — ойртуулах товчны доор, баруун ирмэгт */
function DimensionToggle({ value, onChange }: { value: "2d" | "3d"; onChange: (v: "2d" | "3d") => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Харагдацын хэмжээс"
      className="elevated absolute top-[calc(50%+48px)] right-2.5 z-10 flex flex-col divide-y divide-line overflow-hidden rounded-xs border border-line-2 bg-paper/90 backdrop-blur"
    >
      {(["2d", "3d"] as const).map((d) => {
        const on = value === d;
        return (
          <button
            key={d}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(d)}
            className={
              on
                ? "flex size-7 items-center justify-center bg-data/15 text-[11px] font-semibold text-data"
                : "flex size-7 items-center justify-center text-[11px] font-medium text-ink-2 transition-colors hover:bg-paper-hi hover:text-ink"
            }
          >
            {d.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

/**
 * ОЙРТУУЛАХ, ХОЛДУУЛАХ товч — БАРУУН ИРМЭГИЙН ДУНДАД (бусад дөрвөн
 * булан эзэлгдсэн). Хөвөгч гадаргуу тул `.elevated` сүүдэр зөвшөөрөгдөнө.
 */
function ZoomButtons({ engine }: { engine: React.RefObject<Live | null> }) {
  const step = (d: number) => {
    const view = engine.current?.view;
    view?.goTo({ zoom: view.zoom + d }, { duration: 250 }).catch(() => {});
  };
  return (
    <div className="elevated absolute top-1/2 right-2.5 z-10 flex -translate-y-1/2 flex-col divide-y divide-line overflow-hidden rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
      <button
        onClick={() => step(1)}
        aria-label="Ойртуулах"
        className="flex size-7 items-center justify-center text-ink-2 transition-colors hover:bg-paper-hi hover:text-ink"
      >
        <Plus size={13} />
      </button>
      <button
        onClick={() => step(-1)}
        aria-label="Холдуулах"
        className="flex size-7 items-center justify-center text-ink-2 transition-colors hover:bg-paper-hi hover:text-ink"
      >
        <Minus size={13} />
      </button>
    </div>
  );
}
