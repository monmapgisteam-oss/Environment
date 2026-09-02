"use client";

import * as React from "react";
import {
  Map as MapLibreMap,
  Marker,
  prewarm,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type IControl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FIREFLY } from "@/components/wells/colors";
import type { BoundarySet } from "@/lib/boundaries";
import { asset } from "@/lib/base-path";
import { num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Масштабын ХАРЬЦАА (1:10 000)
   -------------------------------------------------------------------------- */

/**
 * CSS пикселийн бодит хэмжээ. Вэбийн жишгээр 1 CSS пиксель = 1/96 инч.
 *
 * Дэлгэц бүрийн БОДИТ нягтрал үүнээс өөр (телефон 400+ ppi) тул дэлгэц
 * дээрх харьцаа нь цаасан зураг шиг үнэн зөв БАЙЖ ЧАДАХГҮЙ — ойролцоо
 * утга гэдгийг санах хэрэгтэй.
 */
const M_PER_CSS_PX = 0.0254 / 96;

/** Гурван нэрлэх орноор бөөрөнхийлнө: 1:9 543 биш 1:9 540 */
function roundScale(d: number) {
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(d)) - 2));
  return Math.round(d / step) * step;
}

/**
 * Масштабын харьцааг zoom болгоно (1:60 000 → z 11.69).
 *
 * MapLibre-ийн давхаргууд ЗӨВХӨН zoom мэддэг тул масштабаар илэрхийлсэн
 * дүрмийг (жишээ нь "1:20 000-аас ойр бол бодит цэг") энд хөрвүүлнэ.
 *
 * Хамаарал: D = 295 829 384 · cos(φ) / 2^z. Тогтмол нь дэлхийн бүслүүр
 * (40 075 016.686 м) ба MapLibre-ийн 512px хавтангаас гарна. Өргөрөг
 * ордог тул анхдагч нь УБ (47.9°) — энэ платформын бүх нягтралын дата
 * тэнд байна. Өөр өргөрөгт хэрэглэвэл `lat`-аа өгнө.
 */
export function zoomForScale(denominator: number, lat = 47.9) {
  const d0 = 295_829_384 * Math.cos((lat * Math.PI) / 180);
  return Math.log2(d0 / denominator);
}

/**
 * Зургийн буланд суух харьцааны заалт.
 *
 * Метр/пикселийг ТОМЪЁОГООР бус зургаас нь асууж тооцно: дэлгэцийн хоёр
 * цэгийг газарзүйн координат руу буулгаад хоорондын зайг хэмжинэ.
 * Ингэснээр проекц, өргөрөг, дэлгэцийн налуу зэрэг нь өөрөө тооцогдоно.
 */
class RatioScaleControl implements IControl {
  private el: HTMLElement | null = null;
  private map: MapLibreMap | null = null;
  private readonly update = () => {
    const m = this.map;
    const el = this.el;
    if (!m || !el) return;
    const y = m.getContainer().clientHeight / 2;
    const span = 100;
    const meters = m.unproject([0, y]).distanceTo(m.unproject([span, y]));
    if (!Number.isFinite(meters) || meters <= 0) return;
    el.textContent = `1:${num(roundScale(meters / span / M_PER_CSS_PX))}`;
  };

  onAdd(map: MapLibreMap) {
    this.map = map;
    const el = document.createElement("div");
    /* Хайрцаггүй, шууд зураг дээр суух тул уншигдац нь зөвхөн сүүдрээс
       хамаарна — суурь зургийн товчтой ижил `drop-shadow` (хиймэл
       дагуулын цайвар талбай дээр бичвэр дангаараа алга болно) */
    el.className = "maplibregl-ctrl num text-[10px] leading-none text-ink-2";
    el.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,.75))";
    this.el = el;
    map.on("move", this.update);
    map.on("resize", this.update);
    this.update();
    return el;
  }

  onRemove() {
    this.map?.off("move", this.update);
    this.map?.off("resize", this.update);
    this.el?.remove();
    this.el = null;
    this.map = null;
  }
}

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
  line: { color: string; opacity: number; width: number };
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
};

/** Хиймэл дагуул нь үндсэн суурь — цуглуулгын эхэнд байрлана */
export const BASEMAPS: Basemap[] = [
  { id: "imagery", name: "Хиймэл дагуул", service: "World_Imagery", dark: true, maxzoom: 19 },
  { id: "dark", name: "Бараан", service: "Canvas/World_Dark_Gray_Base", dark: true, maxzoom: 16 },
  { id: "light", name: "Цайвар", service: "Canvas/World_Light_Gray_Base", dark: false, maxzoom: 16 },
  { id: "street", name: "Гудамж", service: "World_Street_Map", dark: false, maxzoom: 19 },
  { id: "topo", name: "Байр зүй", service: "World_Topo_Map", dark: false, maxzoom: 19 },
  { id: "hillshade", name: "Газрын гадарга", service: "Elevation/World_Hillshade", dark: false, maxzoom: 16 },
  { id: "natgeo", name: "NatGeo", service: "NatGeo_World_Map", dark: false, maxzoom: 16 },
];

export function basemapTiles(b: Basemap) {
  return ESRI(b.service);
}

/** Цуглуулгын жижиг урьдчилсан харагдац — Монголыг харуулсан нэг хавтан */
export function basemapThumb(b: Basemap) {
  return ESRI(b.service).replace("{z}/{y}/{x}", "5/11/24");
}

/*
  Worker-ийн бэлтгэл. ЗӨВХӨН ХӨТӨЧ ДЭЭР дуудна — модулийн гадна талд бичвэл
  SSR үед "Worker is not defined" гэж уначихна.

  MapLibre v6 нь worker-ийнхөө хаягийг `import.meta.url`-ээс тооцдог. Next.js
  кодыг багцлахад тэр нь багцын чанк руу заадаг тул `maplibre-gl-worker.mjs`
  олдохгүй 404 болж, worker эхлэлдээ уначихдаг. Растер хавтан үндсэн урсгалаар
  татагддаг учир газрын зураг ажиллаж байгаа мэт харагдана — гэвч GeoJSON эх
  сурвалж worker дээр боловсрогддог тул бүх цэг чимээгүйхэн алга болно.
  Файлыг `scripts/copy-maplibre-worker.mjs` (predev/prebuild) public/ рүү хуулна.

  `prewarm()` нь worker санг амьд байлгана: `map.remove()` дуудагдахад сан
  унтардаг бөгөөд React StrictMode эхний зургийг зориуд устгадаг тул хоёр дахь
  зураг worker-гүй үлдэх эрсдэлтэй.
*/
let workerReady = false;
function ensureWorker() {
  if (workerReady) return;
  workerReady = true;
  setWorkerUrl(asset("/maplibre/maplibre-gl-worker.mjs"));
  prewarm();
}

/** Анхны суурь зураг — хиймэл дагуул */
export function defaultBasemap() {
  return BASEMAPS.find((b) => b.id === "imagery") ?? BASEMAPS[0];
}

/**
 * Бөөгнөрлийн хэмжээ. Радиусыг цэгийн тооны КВАДРАТ ЯЗГУУРААР томруулна —
 * дугуйн талбай нь тоотой шууд пропорциональ болж, харьцуулалт зөв уншигдана.
 * Тоо хэмжээг ЗӨВХӨН хэмжээ илэрхийлнэ; өнгө нь тогтмол.
 */
const clusterRadius = [
  "interpolate",
  ["linear"],
  ["sqrt", ["get", "point_count"]],
  2,
  10,
  10,
  18,
  35,
  28,
  70,
  38,
] as ExpressionSpecification;

/* --------------------------------------------------------------------------
   Зэрэглэсэн тэмдгийн илэрхийлэл
   -------------------------------------------------------------------------- */

/** Олон өнцөгт өөрийн өнгө (`c`) авчраагүй үеийн нөөц өнгө */
const SHAPE_FALLBACK = FIREFLY.glow;

/** Утга (`g`) → шатлалын өнгө. Хоорондох утга шугаман холилдоно. */
function gradeColor(stops: [number, string][]): ExpressionSpecification {
  const e: unknown[] = ["interpolate", ["linear"], ["get", "g"]];
  for (const [v, c] of stops) e.push(v, c);
  return e as unknown as ExpressionSpecification;
}

/**
 * Утга → дулааны жин (0…1).
 *
 * Хамгийн бага утга дээр ч 0 БИШ жин өгнө: тэглэвэл цэвэр цэгүүд
 * гадаргуунд огт оролцохгүй бөгөөд "хэмжилт байгаа ч цэвэр" ба
 * "хэмжилт огт байхгүй" хоёр ялгагдахаа болино.
 */
function heatWeight(stops: [number, string][]): ExpressionSpecification {
  const lo = stops[0][0];
  const hi = stops[stops.length - 1][0];
  return ["interpolate", ["linear"], ["get", "g"], lo, 0.18, hi, 1] as unknown as ExpressionSpecification;
}

/**
 * Шатлалыг дулааны нягтралын өнгө болгоно.
 *
 * `heatmap-color`-ийн оролт нь 0…1 нягтрал тул шатлалын утгын мужийг
 * тэр хэмжээст буулгана. Хамгийн доод шат нь ЗААВАЛ тунгалаг байх
 * ёстой — эс тэгвээс бүх дэлгэц нэг өнгөөр будагдана.
 */
function heatRamp(stops: [number, string][]): ExpressionSpecification {
  const lo = stops[0][0];
  const hi = stops[stops.length - 1][0];
  const e: unknown[] = ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)"];
  stops.forEach(([v, c], i) => {
    const t = (v - lo) / (hi - lo);
    /* Эхний өнгө хэт эрт орвол захын сарнилт хүртэл будагдана */
    e.push(Math.max(t, i === 0 ? 0.12 : 0), hexRgba(c, i === 0 ? 0.55 : 0.88));
  });
  return e as unknown as ExpressionSpecification;
}

function hexRgba(hex: string, a: number) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Утга → радиус, ойртох тусам томорно.
 *
 * `["zoom"]` нь ЗААВАЛ дээд түвшний `interpolate`-ийн шууд оролт байх
 * ёстой. Үржүүлэх замаар (`["*", zoom-interpolate, value-interpolate]`)
 * хослуулбал MapLibre давхаргыг чимээгүйхэн голж, цэг огт зурагдахгүй
 * болно. Тиймээс zoom нь гадна, утга нь СУУДАЛ бүрийн дотор байрлана.
 */
function gradedRadius(stops: [number, string][], scale: number): ExpressionSpecification {
  const lo = stops[0][0];
  const hi = stops[stops.length - 1][0];
  /* Хэмжээний ялгаа 1.9 дахин — өнгөнөөс гадна хоёр дахь суваг болох
     хэрэгтэй ч цэгүүд бие биенээ дарах хэмжээнд томрох ёсгүй */
  const at = (z: number) => [
    "interpolate",
    ["linear"],
    ["get", "g"],
    lo,
    z * scale,
    hi,
    z * 1.9 * scale,
  ];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    8,
    at(1.7),
    12,
    at(2.4),
    16,
    at(3.6),
  ] as unknown as ExpressionSpecification;
}

/**
 * Бөөгнөрлийн тоог бичихэд фонтын glyph хэрэгтэй. Растер хавтан ганцаараа
 * glyph өгдөггүй тул нийтэд нээлттэй OpenMapTiles-ийн фонтын үйлчилгээг заана.
 */
const GLYPHS = "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";
const FONT = ["Open Sans Bold"];

/**
 * Хэдэн зурган тэмдэглэгээ хүртэл DOM дээр гаргах вэ. Тэмдэглэгээ бүр нь
 * жинхэнэ элемент бөгөөд зураг татдаг тул олноороо хөтчийг зогсооно.
 */
const MARKER_CAP = 250;

/**
 * Дугуй тэмдэглэгээ. Газрын зураг дээр цэг биш, ЮУ болохыг нь шууд харуулна.
 *
 * Агуулга нь хоёр хэлбэртэй байж болно:
 *  · зургийн хаяг (`/species/…webp`) — дугуй дүүрэн зураг;
 *  · SVG бичвэр (`<svg …`) — зурсан тэмдэг (зураг байхгүй зүйлд).
 * Хоёулаа өөрийн кодоос гаралтай тул `innerHTML` аюулгүй.
 */
function markerEl(
  mark: string,
  onClick: () => void,
  onHover?: (over: boolean) => void,
  /** Тэмдэглэгээний өнгө (`--pin`). Өгөөгүй бол дата өнгө үлдэнэ */
  tint?: string,
) {
  const el = document.createElement("button");
  el.type = "button";
  if (tint) el.style.setProperty("--pin", tint);

  if (mark === "pulse") {
    // Цөм + давтан тэлэх цагираг (globals.css → `.pulse-pin`)
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

/**
 * Тоог бөөгнөрлийн БАРУУН ДЭЭД буланд гаргах шилжилт (em нэгжээр, 10px
 * бичвэрт). Радиус нь цэгийн тооноос хамааран өөрчлөгддөг ч `text-offset`-д
 * массив буцаадаг илэрхийлэл бичих боломж хязгаартай тул алхмаар ойртуулав —
 * алхам бүр нь `clusterRadius`-ийн тухайн мужийн радиусын 0.7 дахин (45°).
 */
const badgeOffset = [
  "step",
  ["get", "point_count"],
  ["literal", [1, -1]],
  10,
  ["literal", [1.5, -1.5]],
  100,
  ["literal", [2.1, -2.1]],
  1000,
  ["literal", [2.7, -2.7]],
] as unknown as ExpressionSpecification;

/**
 * Тооны дэвсгэр болох сунадаг "шахмал". Дан дугуй зураг байсан бол 4 оронтой
 * тоо багтахгүй тул `icon-text-fit`-ийн сунах муж (`stretchX/Y`) заана —
 * икон нь бичвэрийнхээ уртад тааруулж өөрөө сунана.
 */
function pillImage() {
  const w = 26;
  const h = 20;
  const r = 9;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;

  g.beginPath();
  g.moveTo(r, 0.5);
  g.arcTo(w - 0.5, 0.5, w - 0.5, h - 0.5, r);
  g.arcTo(w - 0.5, h - 0.5, 0.5, h - 0.5, r);
  g.arcTo(0.5, h - 0.5, 0.5, 0.5, r);
  g.arcTo(0.5, 0.5, w - 0.5, 0.5, r);
  g.closePath();

  g.fillStyle = "rgba(15,23,32,.92)";
  g.fill();
  g.strokeStyle = FIREFLY.glow;
  g.lineWidth = 1;
  g.stroke();

  return {
    data: g.getImageData(0, 0, w, h),
    options: {
      // Голын хэсэг нь сунана, булангийн дугуйрал нь хэвээр үлдэнэ
      stretchX: [[r, w - r] as [number, number]],
      stretchY: [[r, h - r] as [number, number]],
      content: [3, 2, w - 3, h - 2] as [number, number, number, number],
    },
  };
}

function baseStyle(b: Basemap): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      base: {
        type: "raster",
        tiles: [basemapTiles(b)],
        tileSize: 256,
        maxzoom: b.maxzoom,
      },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

/**
 * Суурь зургийг солино.
 *
 * `setTiles`-ээр зөвхөн хаяг солигдож, `maxzoom` хуучнаараа үлддэг. Үйлчилгээ
 * бүр өөр өөр дээд түвшинтэй (Canvas 16, Imagery 19) тул эх сурвалжийг бүтнээр
 * нь дахин үүсгэнэ. Тиймээс давхаргыг нь эхлээд авч, дараа нь доод талд нь
 * буцааж нэмнэ.
 */
function applyBasemap(m: MapLibreMap, b: Basemap) {
  /*
    Устгагдсан зураг дээр дуудагдаж болзошгүй: React StrictMode ба
    хөгжүүлэлтийн халуун ачаалалт (HMR) үед эхний зураг `remove()`
    хийгдсэн ч түүнийг барьсан effect дахин ажиллана. Тэр үед
    `getStyle()` нь `undefined` буцаадаг тул шууд гарна — хийх зүйл
    байхгүй, харин шалгалтгүй бол бүхэл самбар унана.
  */
  const style = m.getStyle();
  if (!style) return;

  const first = style.layers.find((l) => l.id !== "base")?.id;
  if (m.getLayer("base")) m.removeLayer("base");
  if (m.getSource("base")) m.removeSource("base");

  m.addSource("base", {
    type: "raster",
    tiles: [basemapTiles(b)],
    tileSize: 256,
    maxzoom: b.maxzoom,
  });
  m.addLayer({ id: "base", type: "raster", source: "base" }, first);
}

/*
  Талбай "асаалттай" эсэх: СОНГОГДСОН эсвэл ХУЛГАНА дээр нь байгаа.

  Хоёр төлөвийг нэг харагдацаар илэрхийлж байгаа шалтгаан: hover нь
  сонголт ямар байхыг урьдчилан харуулдаг. Тусад нь өөр өнгө өгвөл газрын
  зураг дээр гурван зэрэг үүсч, аль нь чухал болох нь бүдгэрнэ.
*/
const SHAPE_LIT = [
  "any",
  ["boolean", ["feature-state", "on"], false],
  ["boolean", ["feature-state", "hot"], false],
] as unknown as ExpressionSpecification;

export function WellsMap({
  points,
  visible,
  basemap,
  onSelect,
  extent = false,
  onExtent,
  onZoom,
  focus = null,
  cluster = true,
  clusterMaxZoom = 15,
  clusterLabel = "inside",
  marks,
  pulse = false,
  pulseColor,
  onHover,
  firefly,
  highlight = null,
  overlays,
  shapes,
  grades,
  weights,
  detail,
  labels,
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
   * Ойртолт өөрчлөгдөх бүрд одоогийн түвшинг дамжуулна.
   *
   * Дуудагч тал ойртолтоос хамааран өөрийн дүрслэлээ солиход
   * (жишээ нь тодорхой масштабаас цааш тэмдэглэгээ гаргах) хэрэглэнэ.
   * `zoomend` дээр л дуудагдана — чирэх явцад биш, зогссоны дараа.
   */
  onZoom?: (zoom: number) => void;
  /** Сонголтын хүрээ — өөрчлөгдөх бүрд зураг тийш нь ойртоно (zoom action) */
  focus?: Extent | null;
  /**
   * Бөөгнөрүүлэх эсэх. ЗӨВХӨН анхны зурагдалтад уншигдана — GeoJSON эх
   * сурвалжийн шинж тул дараа нь солих боломжгүй (самбар бүр өөрийн
   * зураг үүсгэдэг учир хязгаарлалт биш).
   */
  cluster?: boolean;
  /**
   * Бөөгнөрөл ЭНЭ түвшнээс цааш задарна (анхны утга 15).
   *
   * Цэг ЦӨӨН, тус бүр нь хаяг заадаг датад (үйлчилгээний цэгийн лавлах)
   * 15 нь хэт гүн: хот даяар харахад зөвхөн бөөгнөрлийн бөмбөлөг
   * харагдаж, тэмдэглэгээ бараг гарч ирдэггүй. Тархалт уншуулах датад
   * (12 мянган худаг) эсрэгээрээ гүн байх нь зөв.
   *
   * ЗӨВХӨН анхны зурагдалтад уншигдана — эх сурвалжийн шинж.
   */
  clusterMaxZoom?: number;
  /** Тоог дугуйн дотор бичих үү, баруун дээд буланд тэмдэг болгох уу */
  clusterLabel?: "inside" | "badge";
  /**
   * `oid` → SVG тэмдэг. Өгвөл тухайн цэг дугуй ТЭМДГЭЭР тэмдэглэгдэнэ
   * (энгийн цэгийн оронд) — бөөгнөрөл задарсан үед л харагдана.
   */
  marks?: Record<number, string>;
  /**
   * Цэг бүрийг ДОХИОЛОЛ маягийн тэмдэглэгээгээр харуулах эсэх: цөм нь
   * тогтмол, гадуур нь давтан тэлэх цагираг. Цөөн, тодруулах шаардлагатай
   * объектод (жишээ нь нийтийн 17 бие засах газар) зориулав.
   */
  pulse?: boolean;
  /**
   * Дохиоллын тэмдэглэгээний өнгө — `oid` бүрд.
   *
   * `pulse` асаалттай үед л уншигдана. Өгөөгүй, эсвэл `undefined`
   * буцаавал платформын дата өнгө үлдэнэ. Эрэмбэтэй хэмжүүрийг
   * (эрсдэлийн зэрэг) цохилтоор дамжуулахад зориулав — цэгийн давхарга
   * ба тэмдэглэгээ хоёр НЭГ өнгө барихад л зураг уншигдана.
   */
  pulseColor?: (oid: number) => string | undefined;
  /**
   * Хулгана тэмдэглэгээ дээр очиход — гарахад `null`.
   *
   * `at` нь зургийн ЗУРАГДАХ талбар доторх пикселийн байрлал. Хөвөгч
   * тайлбар (tooltip) хулганаа дагахад л хэрэгтэй тул сонголтоор өгнө —
   * зөвхөн `oid` хүлээж авдаг хуучин дуудагчид өөрчлөх шаардлагагүй.
   */
  onHover?: (oid: number | null, at?: { x: number; y: number }) => void;
  /**
   * Цэгийн давхаргын өнгөний гурвал. Өгөөгүй бол платформын цэнхэр
   * firefly. ЗӨВХӨН анхны зурагдалтад уншигдана.
   *
   * Ойн хэлтсийн самбарууд ногоон хувилбар өгдөг — цэнхэр ой нь
   * газрын зураг дээр ус мэт уншигдана.
   */
  firefly?: { glow: string; mid: string; core: string };
  /**
   * Тодруулах цэгийн байрлал `[lon, lat]`. Өгвөл тэр цэгийг гэрэлтэх
   * цаграгаар тойруулна.
   *
   * Хөвөгч тайлбар нь "энэ бол ЯМАР цэг бэ" гэдгийг хэлдэггүй — 12 мянган
   * цэгийн дунд хулганы үзүүр аль дээр нь байгаа нь тодорхойгүй. Цагираг
   * нь тайлбарыг цэгтэй нь холбоно.
   */
  highlight?: [number, number] | null;
  /**
   * Нэмэлт хил, бүсийн давхаргууд. Дата давхаргын ДООР суух тул цэг,
   * бөөгнөрөл нь тэдгээрээр далдлагдахгүй.
   */
  overlays?: MapOverlay[];
  /**
   * ДАТА олон өнцөгт (талбай, тусгай зөвшөөрөл, эвдэрсэн газар).
   *
   * `overlays`-аас ялгаатай нь энэ нь харилцдаг: `properties.oid`-оор
   * товшилт, hover дамжина, `properties.c`-д өнгөө авч явж болно.
   * Сонгогдсон талбай нь `selected`-ээр тодорно.
   *
   * Талбай нь ЦЭГИЙН ДООР зурагдана — хоёуланг нь өгвөл цэг нь тухайн
   * талбайн төлөөлөл (жишээ нь төвлөрсөн цэг) байх нь зохимжтой.
   */
  shapes?: {
    data: GeoJSON.FeatureCollection;
    selected?: number | null;
    /**
     * Хүрээг сарнисан гэрлээр тойруулах эсэх (bloom). Талбай ЦӨӨН үед л
     * асаа — олон зуун олон өнцөгт дээр гэрэл нь хоорондоо нийлж, зураг
     * бүхэлдээ манантана. ЗӨВХӨН анхны зурагдалтад уншигдана.
     */
    glow?: boolean;
    /**
     * Давхаргын өнгө (hex). Өгөөгүй бол платформын дата өнгө.
     * ЗӨВХӨН анхны зурагдалтад уншигдана.
     */
    color?: string;
    /**
     * Олон өнцөгтийн шошго нь энэ zoom-оос ойртсон үед л гарна.
     * Талбай олонтой самбарт заавал өг — эс тэгвээс алсаас бүх шошго
     * нэг дор гарч, хүрээ нь өөрөө уншигдахаа болино.
     */
    labelZoom?: number;
    /**
     * `LineString` дүрс дээр ЧИГЛЭЛИЙН сум нэмэх эсэх.
     *
     * Шугам нь хоёр цэгийг холбодог ч аль нь эхлэл, аль нь төгсгөл
     * болохыг хэлдэггүй. Урсгал (хаанаас хаашаа) илэрхийлдэг датад
     * заавал асаа — эс тэгвээс чиглэл нь тайлбар уншихгүйгээр
     * мэдэгдэхгүй.
     */
    flow?: boolean;
    /**
     * Шошгыг хаана байрлуулах вэ.
     *
     * `point` (анхдагч) — дүрс бүрд НЭГ шошго, олон өнцөгтийн хамгийн
     * хол дотоод цэгт. `line-center` — шугамын дундад, чиглэлийн дагуу
     * эргэсэн. Сүүлийнх нь шугамын ХЭСГИЙГ (уртыг, зайг) тэмдэглэхэд
     * зориулагдсан: тухайн хэрчим өөрөө шошгоо үүрнэ.
     */
    labelPlacement?: "point" | "line-center";
  };
  /**
   * Цэгийн бичвэр шошго.
   *
   * `text` нь `points`-той ИЖИЛ УРТТАЙ — цэг бүрийн шошго. Хоосон мөр
   * бол тухайн цэг шошгогүй.
   *
   * Зөвхөн `minzoom`-оос ойртсон үед гарна: холоос бүх шошго нэг дор
   * гарвал цэгээ дарж, тархалт уншигдахаа болино. Давхцлыг MapLibre
   * өөрөө шийднэ — нягт хэсэгт багтсан нь л үлдэнэ.
   */
  labels?: {
    text: string[];
    minzoom?: number;
    /**
     * Цэгээс доош шилжих зай (em, анхдагч 0.7).
     *
     * Тэмдэглэгээт горимд (`marks`) цэг нь 30px дискээр солигдох тул
     * анхдагч зай хүрэлцэхгүй — шошго дискний доор нуугдана.
     */
    offset?: number;
  };
  /**
   * Цэг бүрийн ХЭМЖИГДЭХҮҮН. Өгвөл зураг ЗЭРЭГЛЭСЭН тэмдгийн горимд
   * шилжинэ: цэг бүр утгынхаа дагуу шатлалаас өнгө авч, хэмжээгээрээ
   * ч томорно (ArcGIS-ийн graduated symbol).
   *
   * Хэмжигдэхүүн нь ЭРЭМБЭТЭЙ байх ёстой — нэрлэсэн ангиллыг (аймаг,
   * гүйцэтгэгч) өнгөөр ялгавал дэлгэц утгагүй солонго болно.
   *
   * `values` нь `points`-той ижил урттай, `stops` нь [утга, өнгө]
   * хосуудын ӨСӨХ дараалал.
   *
   * `heat` асаавал алсаас ТАСРАЛТГҮЙ ГАДАРГУУ (дулааны зураг) харагдаж,
   * ойртох тусам цэг рүү шилжинэ. Гадаргуу нь цэгүүдийн хоорондох
   * утгыг мужлан харуулна — тохиромжтой байдлын үнэлгээний зурагтай
   * ижил уншигдана.
   */
  grades?: {
    values: ArrayLike<number>;
    stops: [number, string][];
    heat?: boolean;
    /**
     * Цэгийг ГЭРЭЛТЭХ (firefly) загвараар зурах эсэх.
     *
     * Зэрэглэсэн горим нь анхдагчаар хоёр давхаргатай, бараан ирмэгтэй
     * тодорхой тэмдэг зурдаг — өнгө нь ангилал заадаг тул ирмэг нь
     * хөрш өнгөнүүдийг тусгаарлана. Харин шатлалын хоёр үзүүрт НЭГ өнгө
     * өгсөн үед (зөвхөн радиус нь хэмжигдэхүүн үүрэх үед) тэр ирмэг
     * утгагүй болж, цэг нь платформын бусад зурагнаас өөрөөр харагдана.
     *
     * Энэ тугийг асаавал бусад зурагтай ижил гурван давхаргын гэрэлтэлт
     * (сарнисан гэрэл → бие → цөм) хэрэглэгдэнэ. Өнгө нь `firefly`
     * пропоос ирэх бөгөөд `stops`-ийн ӨНГИЙГ АШИГЛАХГҮЙ — тиймээс
     * ЗӨВХӨН нэг өнгөт шатлалд тавь. Радиус нь хэвээрээ утгаасаа
     * хамаарна.
     */
    firefly?: boolean;
  };
  /**
   * Цэг бүрийн ЖИН (`points`-той ижил урттай). Өгвөл зураг НЯГТРАЛЫН
   * горимд шилжинэ: алсаас дулааны зураг, ойртоход жингээрээ томордог
   * цэг. Нэг цэг = нэг бичлэг биш, нүд бүрийн хуримтлал болох үед л
   * хэрэглэнэ (жишээ нь 145 мянган жорлонг 11 мянган нүдэнд хурааж).
   */
  weights?: number[];
  /**
   * ДЭЛГЭРЭНГҮЙ цэг. Ойртоход нэгтгэсэн нүдийг сольж, эх сурвалжаас
   * бодит бичлэгүүдийг харагдацын хүрээгээр татна.
   *
   * Зураг нь домэйноо мэдэхгүй: хэзээ (`minZoom`), хаанаас (`load`)
   * гэдгийг дуудагч тал өгнө. Зураг нь зөвхөн хөдөлгөөнийг сонсох,
   * давхардсан хүсэлтийг таслах, давхаргыг зурах үүрэгтэй.
   *
   * `key` нь шүүлтүүрийн хурууны хээ — өөрчлөгдвөл кэшийг хаяж дахин
   * татна (эс тэгвээс дүүрэг солиход хуучин цэгүүд үлдэнэ).
   */
  detail?: {
    minZoom: number;
    key: string;
    load: (bounds: Extent, signal: AbortSignal) => Promise<GeoJSON.FeatureCollection>;
  };
}) {
  const holder = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MapLibreMap | null>(null);
  const fitted = React.useRef(false);
  /** Анхны (сонголтгүй) хүрээ — сонголт цуцлагдахад буцаж очно */
  const home = React.useRef<Extent | null>(null);
  /** Сонголтоор ойртсон эсэх — эхний удаа гэрт нь дэмий нисэхээс сэргийлнэ */
  const zoomed = React.useRef(false);
  /*
    Бэлэн болсныг зөвхөн true/false тугаар хадгалж БОЛОХГҮЙ. React StrictMode
    хөгжүүлэлтийн үед effect-ийг давхар дуудаж, эхний зураг устаад хоёр дахь нь
    үүсдэг. Туг аль хэдийн true болчихсон тохиолдолд өгөгдлийн effect дахин
    ажиллахгүй бөгөөд шинэ зураг хоосон үлднэ. Тиймээс обьектыг өөрийг нь барина.
  */
  const [live, setLive] = React.useState<MapLibreMap | null>(null);

  /*
    Хамгийн сүүлийн callback-ийг ref-д хадгална. Ингэснээр газрын зургийг
    үүсгэх effect нэг л удаа ажиллаж, дотроо үргэлж шинэ функц дуудна.
  */
  const selectCb = React.useRef(onSelect);
  const hoverCb = React.useRef(onHover);
  const extentCb = React.useRef(onExtent);
  const zoomCb = React.useRef(onZoom);
  /** Анх үүсгэх үеийн суурь зураг — effect-ийг дахин ажиллуулахгүйн тулд ref */
  const basemapRef = React.useRef(basemap);
  /** Эх сурвалж үүсгэх үед л уншигдах тохиргоо */
  const modeRef = React.useRef({
    cluster,
    clusterMaxZoom,
    clusterLabel,
    weighted: Boolean(weights),
    graded: grades?.stops,
    gradedHeat: Boolean(grades?.heat),
    gradedFire: Boolean(grades?.firefly),
    shaped: Boolean(shapes),
    shapeGlow: Boolean(shapes?.glow),
    shapeColor: shapes?.color,
    fire: firefly ?? FIREFLY,
    shapeLabelZoom: shapes?.labelZoom ?? 0,
    shapeFlow: Boolean(shapes?.flow),
    shapeLabelOnLine: shapes?.labelPlacement === "line-center",
    detailZoom: detail?.minZoom,
    labeled: Boolean(labels),
    labelZoom: labels?.minzoom ?? 12,
    labelOffset: labels?.offset ?? 0.7,
  });
  const detailRef = React.useRef(detail);
  React.useEffect(() => {
    detailRef.current = detail;
  }, [detail]);
  /** Зурган тэмдэглэгээ — oid → maplibre marker */
  const markers = React.useRef(new Map<number, Marker>());
  React.useEffect(() => {
    selectCb.current = onSelect;
  }, [onSelect]);
  React.useEffect(() => {
    extentCb.current = onExtent;
  }, [onExtent]);
  React.useEffect(() => {
    zoomCb.current = onZoom;
  }, [onZoom]);
  React.useEffect(() => {
    hoverCb.current = onHover;
  }, [onHover]);
  /* Өнгө тодорхойлогчийг ref-д барина — эс тэгвээс дуудагч тал шинэ
     функц дамжуулах бүрд бүх тэмдэглэгээ дахин үүснэ */
  const pulseColorRef = React.useRef(pulseColor);
  React.useEffect(() => {
    pulseColorRef.current = pulseColor;
  }, [pulseColor]);

  /* ---------------- Газрын зураг үүсгэх ---------------- */
  React.useEffect(() => {
    if (!holder.current || map.current) return;
    ensureWorker();

    const m = new MapLibreMap({
      container: holder.current,
      style: baseStyle(basemapRef.current),
      center: [106.9, 47.9],
      zoom: 9,
      attributionControl: false,
    });
    map.current = m;

    // MapLibre-ийн алдаа консол руу дуугаралгүй өнгөрдөг тул ил гаргана
    m.on("error", (e) => {
      console.error("[map]", e.error?.message ?? e);
    });

    // Томруулах товч байхгүй — дугуй эргүүлэх, хос товшилтоор ажиллана
    m.addControl(new RatioScaleControl(), "bottom-left");

    m.on("load", () => {
      /*
        Засаг захиргааны хил. Харагдах хүрээ (visible range) нь шатлалаар:
        улсын хил үргэлж, аймаг 5-аас, сум 8-аас. Ингэснээр алсаас харахад
        зураг цэвэрхэн, ойртох тусам нарийвчлал нэмэгдэнэ.
      */
      m.addSource("bnd", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      const boundary = (
        id: string,
        key: "country" | "aimag" | "soum",
        minzoom: number,
        width: ExpressionSpecification,
        opacity: number,
        dash?: [number, number],
      ) => {
        m.addLayer({
          id,
          type: "line",
          source: "bnd",
          filter: ["==", ["get", "level"], key],
          minzoom,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": width,
            "line-opacity": opacity,
            ...(dash ? { "line-dasharray": dash } : {}),
          },
        });
      };

      boundary(
        "bnd-soum",
        "soum",
        8,
        ["interpolate", ["linear"], ["zoom"], 8, 0.4, 12, 0.8] as ExpressionSpecification,
        0.3,
        [3, 3],
      );
      boundary(
        "bnd-aimag",
        "aimag",
        5,
        ["interpolate", ["linear"], ["zoom"], 5, 0.6, 10, 1.1] as ExpressionSpecification,
        0.45,
        [6, 3],
      );
      boundary(
        "bnd-country",
        "country",
        0,
        ["interpolate", ["linear"], ["zoom"], 3, 1, 8, 1.8, 12, 2.4] as ExpressionSpecification,
        0.75,
      );

      /*
        Дата олон өнцөгт (талбай). Хилийн ДЭЭР, цэгийн ДООР суулгана:
        энэ нь дата тул засаг захиргааны хилээс чухал, гэхдээ цэгэн
        давхаргыг дарах ёсгүй.

        Нэмэлт давхаргаас (`overlays`) ялгаатай нь энэ нь ХАРИЛЦДАГ:
        товшилт, hover нь `oid`-оор дамжина.
      */
      if (modeRef.current.shaped) {
        m.addSource("shapes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        /*
          Сарнисан гэрэл (bloom) — хүрээний ДООР, дүүргэлтийн ч доор.

          Цэгэн давхаргын firefly загвартай нэг хэл: биет өөрөө гэрэл
          ялгаруулж буй мэт. `line-blur` нь зурааснаас ГАДАГШ ч, ДОТОГШ
          ч сарнидаг тул нарийн талбай бүхэлдээ гэрэлтэнэ.

          ГУРВАН дамжлага давхарлана — нэг өргөн зураас бүдгэрүүлээд
          орхивол зүгээр л "бүдэг зузаан хүрээ" болно, гэрлийн мэдрэмж
          төрөхгүй. Жинхэнэ bloom нь ТӨВДӨӨ хүчтэй, захдаа хурдан
          суларсан налуутай байдаг: гурван өөр өргөнтэй давхарга
          нэмэгдэж яг тэр налууг гаргана.

          Өргөнийг зумаас ХАМААРУУЛЖ томруулна — тогтмол пикселийн
          гэрэл нь холоос талбайгаа бүрэн залгиж, ойртоход алга болно.
        */
        if (modeRef.current.shapeGlow) {
          /** Нэг дамжлага: `k` нь өргөний үржүүлэгч, `o` нь тунгалаг */
          const pass = (id: string, k: number, o: number) =>
            m.addLayer({
              id,
              type: "line",
              source: "shapes",
              layout: { "line-join": "round" },
              paint: {
                "line-color": ["coalesce", ["get", "c"], modeRef.current.shapeColor ?? SHAPE_FALLBACK] as unknown as ExpressionSpecification,
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  ["case", SHAPE_LIT, 5 * k, 3 * k],
                  16,
                  ["case", SHAPE_LIT, 26 * k, 16 * k],
                ] as unknown as ExpressionSpecification,
                /* Бүдгэрэлт нь өргөнтэйгээ ойролцоо — үүнээс бага бол
                   ирмэг нь хатуу, их бол гэрэл нь хэт шингэрнэ */
                "line-blur": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  4 * k,
                  16,
                  20 * k,
                ] as unknown as ExpressionSpecification,
                "line-opacity": [
                  "case",
                  SHAPE_LIT,
                  Math.min(o * 1.7, 0.95),
                  o,
                ] as unknown as ExpressionSpecification,
              },
            });

          pass("shape-glow-3", 2.6, 0.3); // хамгийн гадна, сарнисан
          pass("shape-glow-2", 1.3, 0.42); // дунд
          pass("shape-glow-1", 0.6, 0.6); // хүрээний дэргэдэх тод цөм
        }

        m.addLayer({
          id: "shape-fill",
          type: "fill",
          source: "shapes",
          /*
            ЗӨВХӨН олон өнцөгт. MapLibre-ийн `fill` давхарга нь
            `LineString`-ийг ХААЖ дүүргэдэг тул шугам нь эхлэл, төгсгөлөө
            холбосон дүүрэн гурвалжин болж харагдана — цахилгааны шонгийн
            шугам дээр яг ингэж гарсан. Геометрийн төрлөөр шүүх нь энэ
            давхаргын зорилготой ч нийцнэ: дүүргэлт нь ТАЛБАЙН шинж.

            Хоёр нэрийг ЗЭРЭГ бичсэн нь санаатай: зурагдалтын үед
            `geometry-type` нь Multi* хэлбэрийг ганцаарчилсан нэр рүү
            хураадаг ("Polygon") ч, асуулгын үр дүн дээр эх нэрээрээ
            ирдэг. Ганцхан "Polygon" бичвэл нөхөн сэргээлтийн
            `MultiPolygon` талбайнууд нөхцөл байдлаас шалтгаалж
            дүүргэлтгүй үлдэх эрсдэлтэй.
          */
          filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
          paint: {
            "fill-color": ["coalesce", ["get", "c"], modeRef.current.shapeColor ?? SHAPE_FALLBACK] as unknown as ExpressionSpecification,
            "fill-opacity": ["case", SHAPE_LIT, 0.55, 0.28],
          },
        });

        m.addLayer({
          id: "shape-line",
          type: "line",
          source: "shapes",
          layout: { "line-join": "round" },
          paint: {
            "line-color": ["coalesce", ["get", "c"], modeRef.current.shapeColor ?? SHAPE_FALLBACK] as unknown as ExpressionSpecification,
            /* `["zoom"]` нь дээд түвшний `interpolate`-ийн шууд оролт
               байх ёстой — сонголтын шалгалтыг СУУДАЛ бүрийн дотор
               оруулав, эсрэгээр бичвэл давхарга чимээгүйхэн гологдоно */
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              ["case", SHAPE_LIT, 1.8, 0.5],
              14,
              ["case", SHAPE_LIT, 2.6, 1.2],
            ] as unknown as ExpressionSpecification,
            "line-opacity": 0.9,
          },
        });

        /*
          Чиглэлийн сум — `LineString` дүрсийн дундад.

          `symbol-placement: "line-center"` нь тэмдгийг шугамын дундад
          тавиад ЧИГЛЭЛИЙН ДАГУУ эргүүлдэг тул сум өөрөө эхлэлээс
          төгсгөл рүү заана. Олон өнцөгт дээр ч ажиллана (гадна хүрээг
          дагана) боловч тэнд утгагүй тул `flow` -г зөвхөн урсгал
          илэрхийлдэг самбарт л асаана.
        */
        if (modeRef.current.shapeFlow) {
          m.addLayer({
            id: "shape-flow",
            type: "symbol",
            source: "shapes",
            layout: {
              "symbol-placement": "line-center",
              "text-field": "→",
              "text-font": FONT,
              "text-size": ["interpolate", ["linear"], ["zoom"], 6, 14, 12, 20],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "rgba(8,14,20,.85)",
              "text-halo-width": 1.4,
            },
          });
        }

        /*
          Талбайн шошго — `properties.t` бичигдсэн байвал.

          MapLibre полигоны шошгыг талбайн ХАМГИЙН ХОЛ ДОТООД цэгт
          (pole of inaccessibility) тавьдаг тул нарийн, хонхор хэлбэр
          дээр ч гадуур гарахгүй. Тиймээс төвлөрсөн цэг тооцох
          шаардлагагүй.
        */
        m.addLayer({
          id: "shape-label",
          type: "symbol",
          source: "shapes",
          minzoom: modeRef.current.shapeLabelZoom,
          filter: ["has", "t"],
          layout: {
            "text-field": ["get", "t"],
            "text-font": FONT,
            "text-size": ["interpolate", ["linear"], ["zoom"], 8, 9, 14, 12],
            "text-padding": 4,
            ...(modeRef.current.shapeLabelOnLine
              ? {
                  "symbol-placement": "line-center" as const,
                  /* Хэрчим богино байж болно — багтахгүй бол шошго нь
                     алга болохоос илүү давхарласан нь дээр */
                  "text-allow-overlap": true,
                  "text-ignore-placement": true,
                }
              : {}),
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(8,14,20,.85)",
            "text-halo-width": 1.2,
          },
        });
      }

      /*
        Бөөгнөрүүлэлт (clustering) — 12 мянган цэгийг тархалтаар нь уншуулна.
        Ойртох тусам бөөгнөрөл задарч, `clusterMaxZoom`-оос цааш дан цэг болно.
      */
      m.addSource("wells", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: modeRef.current.cluster,
        clusterRadius: 48,
        clusterMaxZoom: modeRef.current.clusterMaxZoom,
      });

      /*
        Бөөгнөрөл: дүүргэлт нь тунгалаг, хүрээ нь ИЖИЛ өнгөөр бүтэн.
        Ингэснээр доорх суурь зураг харагдсаар үлдэж, аль ч суурин дээр
        (бараан, хиймэл дагуул, гудамж) уншигдана.

        Өнгө нь firefly-ийн гэрэлтэй нэг байна — бөөгнөрөл задрахад цэг өөр
        өнгө рүү үсрэх нь ижил датаг өөр зүйл мэт харагдуулна.
      */
      const badge = modeRef.current.clusterLabel === "badge";

      if (modeRef.current.cluster) {
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: "wells",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": modeRef.current.fire.glow,
            // Тоо нь дотроо биш бол дугуй нь илүү хоосон, бөгж маягтай
            "circle-opacity": badge ? 0.14 : 0.22,
            "circle-radius": clusterRadius,
            "circle-stroke-width": badge ? 2 : 1.4,
            "circle-stroke-color": modeRef.current.fire.glow,
            "circle-stroke-opacity": 0.95,
          },
        });

        if (badge) {
          /*
            Тоо нь дугуйн БАРУУН ДЭЭД буланд жижиг тэмдэг болж суух хувилбар.
            Дугуйн дотор нь чөлөөтэй үлдэх тул доорх суурь зураг, цэгийн
            тархалт харагдсаар байна.
          */
          const pill = pillImage();
          if (!m.hasImage("cluster-pill")) {
            m.addImage("cluster-pill", pill.data, pill.options);
          }

          m.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "wells",
            filter: ["has", "point_count"],
            layout: {
              "icon-image": "cluster-pill",
              "icon-text-fit": "both",
              "icon-text-fit-padding": [1, 3, 1, 3],
              "icon-allow-overlap": true,
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": FONT,
              "text-size": 10,
              "text-offset": badgeOffset,
              "text-allow-overlap": true,
            },
            paint: { "text-color": "#ffffff" },
          });
        } else {
          m.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "wells",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": FONT,
              "text-size": ["step", ["get", "point_count"], 10, 100, 11, 1000, 12],
              "text-allow-overlap": true,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "rgba(0,0,0,.7)",
              "text-halo-width": 1.2,
            },
          });
        }
      }

      if (modeRef.current.weighted) {
        /*
          НЯГТРАЛЫН горим. Нүд бүр олон бичлэгийн хуримтлал тул firefly
          гурван давхарга утгагүй — алсаас дулааны зураг тархалтыг, ойртоход
          жингээрээ томордог цэг нүд бүрийн хэмжээг хэлнэ.

          Өнгө нь ГАНЦ: тунгалагаас `--data` руу шилжих шатлал. Улаан-шар
          "халуун" градиент нь өөр хэмжигдэхүүн (эрсдэл) мэт эндүүрүүлнэ.

          ХАРАГДАХ ХҮРЭЭ нь МАСШТАБААР заагдана (zoom-оор биш) — хэлтэс
          "1:20 000-аас ойр бол бодит цэг, бусад тохиолдолд дулааны зураг"
          гэж тавьсан. `zoomForScale` нь түүнийг zoom болгоно (1:20 000 →
          z 13.28). Хоёр шат:
            алсаас 1:20 000 хүртэл   дулааны зураг
            1:20 000-аас ойр         бодит цэг
          Заагт нь давхцах цонх ЗААВАЛ хэрэгтэй — эс тэгвээс нэг давхарга
          алга болоод нөгөө нь гарах хүртэл зураг хоосорно.
        */
        const zDot = zoomForScale(20_000);
        /** Шилжилтийн цонхны өргөн (zoom нэгжээр) */
        const FADE = 0.6;
        /*
          Цэг нь ойртоход АЛГА БОЛОХ нь зөвхөн дэлгэрэнгүй давхарга
          түүнийг солих үед л зөв. Бүх цэг аль хэдийн хөтөч дээр байвал
          дүрслэх зүйл үлдэхгүй болж зураг хоосорно.
        */
        const zDetail = modeRef.current.detailZoom;
        const dotFade = (full: number): ExpressionSpecification =>
          zDetail == null
            ? ["interpolate", ["linear"], ["zoom"], zDot - FADE, 0, zDot, full]
            : [
                "interpolate",
                ["linear"],
                ["zoom"],
                zDot - FADE,
                0,
                zDot,
                full,
                zDetail,
                full,
                zDetail + 0.4,
                0,
              ];

        m.addLayer({
          id: "cells-heat",
          type: "heatmap",
          source: "wells",
          maxzoom: zDot + 0.4,
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "w"],
              0,
              0,
              60,
              1,
            ],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 13, 1.4],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 6, 12, 14, 13.5, 22],
            // 1:20 000 дээр дулааны зураг бүрэн арилж, бодит цэг үлдэнэ
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], zDot - FADE, 0.9, zDot, 0],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,200,255,0)",
              0.25,
              "rgba(0,200,255,.32)",
              0.6,
              "rgba(92,225,255,.62)",
              1,
              "rgba(230,251,255,.92)",
            ],
          },
        });

        m.addLayer({
          id: "wells-dot",
          type: "circle",
          source: "wells",
          minzoom: zDot - FADE,
          ...(zDetail == null ? {} : { maxzoom: zDetail + 0.4 }),
          paint: {
            /*
              Хэмжээ нь ЖИЖИГ бөгөөд тогтмол.

              Урьд нь радиусыг нүд доторх тоогоор томруулж байсан нь
              бүтсэнгүй: том дугуйнууд хоорондоо нийлж, суурь зургийг
              бүрхсэн эгнээ болж хувирсан. Одоо бичлэг тутам нэг цэг
              болсон тул бүр ч жижиг байх ёстой — нягт хороололд 20
              метрийн зайд хэдэн жорлон байх ба 3px-ийн дугуйнууд
              нийлээд нэг толбо болно. Тоо хэмжээг ДУЛААНЫ зураг аль
              хэдийн хэлсэн; цэг нь зөвхөн "яг энд бий" гэдгийг хэлнэ.
            */
            "circle-radius": ["interpolate", ["linear"], ["zoom"], zDot - FADE, 1.2, 15, 1.8, 18, 2.6],
            "circle-color": modeRef.current.fire.glow,
            "circle-opacity": dotFade(0.9),
            /* Хүрээ нь радиусын хагасаас хэтэрвэл цэг нь дугуй биш
               толбо болно — 1.2px радиуст 0.35 нь дээд хязгаар */
            "circle-stroke-width": 0.35,
            "circle-stroke-color": "rgba(0,0,0,.5)",
            "circle-stroke-opacity": dotFade(1),
          },
        });

        /*
          Бодит цэгийн давхарга. Эх сурвалж нь ХООСОН эхэлж, ойртоход
          `detail.load`-оор дүүрнэ (доорх effect). Нүдтэй зэрэгцэж
          гарч ирээд түүнийг сольж авна.
        */
        if (modeRef.current.detailZoom != null) {
          const zd = modeRef.current.detailZoom;
          m.addSource("detail", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          m.addLayer({
            id: "detail-dot",
            type: "circle",
            source: "detail",
            minzoom: zd - 0.4,
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2.2, 16, 4, 18, 6],
              "circle-color": modeRef.current.fire.core,
              "circle-opacity": ["interpolate", ["linear"], ["zoom"], zd - 0.4, 0, zd, 0.95],
              "circle-stroke-width": 0.7,
              "circle-stroke-color": "rgba(0,0,0,.5)",
              "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], zd - 0.4, 0, zd, 1],
            },
          });
        }
      } else if (modeRef.current.graded) {
        /*
          Зэрэглэсэн тэмдэг. Ангилал ЭРЭМБЭТЭЙ тул хоёр суваг зэрэг
          ажиллана: өнгө нь зэргийг, ХЭМЖЭЭ нь мөн зэргийг давхар
          хэлнэ. Зөвхөн өнгөөр ялгавал өнгө ялгах чадвар султай хүнд
          зураг унших боломжгүй болно.
        */
        const stops = modeRef.current.graded;
        const heat = modeRef.current.gradedHeat;
        /** Ойртоход гадаргуугаас цэг рүү шилжих уусалт */
        const fade = (to: number) =>
          ["interpolate", ["linear"], ["zoom"], 11.5, 0, 13, to] as ExpressionSpecification;

        if (heat) {
          /*
            Тасралтгүй гадаргуу. Дулааны давхарга нь цэгийн ЖИНГЭЭР
            ажиллана: утга нь өндөр цэг орчиндоо илүү нөлөөлж, цэг
            хоорондын зай мужлагдана. Тиймээс өнгө нь "хэдэн цэг байна"
            биш "энэ орчны түвшин" гэж уншигдана.

            Цэг сийрэг (500 ширхэг) тул радиус нь жорлонгийнхоос
            хамаагүй том — эс тэгвээс гадаргуу үүсэхгүй, салангид толбо
            болно.
          */
          m.addLayer({
            id: "grade-heat",
            type: "heatmap",
            source: "wells",
            maxzoom: 13.5,
            paint: {
              "heatmap-weight": heatWeight(stops),
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 13, 1.5],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 7, 16, 10, 32, 13.5, 64],
              // Ойртох тусам гадаргуу арилж, цэг гарч ирнэ
              "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0.82, 13.4, 0],
              "heatmap-color": heatRamp(stops),
            },
          });
        }

        /*
          Гэрэлтэх хувилбарт өнгө нь шатлалаас БИШ `firefly` гурвалаас
          ирнэ (нэг өнгөт шатлалд л зөвшөөрөгдөнө — пропын тайлбарыг
          үзнэ үү). Радиусын үржүүлэгчид нь бөөгнөрөлгүй firefly-ийн
          харьцааг давтана: сарнисан гэрэл ≈ 4.2, бие ≈ 2.2, цөм ≈ 0.95.
        */
        const fire = modeRef.current.gradedFire;

        m.addLayer({
          id: "wells-glow",
          type: "circle",
          source: "wells",
          ...(heat ? { minzoom: 11.5 } : {}),
          paint: {
            "circle-radius": gradedRadius(stops, fire ? 4.2 : 2.4),
            "circle-color": fire ? modeRef.current.fire.glow : gradeColor(stops),
            "circle-blur": 1,
            "circle-opacity": heat ? fade(fire ? 0.38 : 0.32) : fire ? 0.38 : 0.32,
          },
        });

        /* Дундах бие — ЗӨВХӨН гэрэлтэх хувилбарт. Сарнисан гэрэл ба
           цөмийн хооронд шилжилт үүсгэнэ; үүнгүй бол цөм нь манан дээр
           наалдсан мэт харагдана */
        if (fire) {
          m.addLayer({
            id: "wells-halo",
            type: "circle",
            source: "wells",
            ...(heat ? { minzoom: 11.5 } : {}),
            paint: {
              "circle-radius": gradedRadius(stops, 2.2),
              "circle-color": modeRef.current.fire.mid,
              "circle-blur": 0.6,
              "circle-opacity": heat ? fade(0.6) : 0.6,
            },
          });
        }

        m.addLayer({
          id: "wells-dot",
          type: "circle",
          source: "wells",
          ...(heat ? { minzoom: 11.5 } : {}),
          paint: {
            "circle-radius": gradedRadius(stops, fire ? 0.95 : 1),
            "circle-color": fire ? modeRef.current.fire.core : gradeColor(stops),
            "circle-opacity": heat ? fade(fire ? 0.95 : 0.92) : fire ? 0.95 : 0.92,
            /*
              Нимгэн бараан ирмэг — цайвар суурь зураг дээр цэг арилахаас
              хамгаална, гэрэлтэлтийг таслахааргүй сул.

              Гэрэлтэх хувилбарт ирмэг ТАВИХГҮЙ: гэрэлтэж буй биет
              ирмэггүй байх ёстой, зураас нь гэрлийг таслаад энгийн цэг
              болгочихно (бөөгнөрөлгүй firefly-тэй ижил шалтгаан).
            */
            "circle-stroke-width": fire ? 0 : 0.7,
            "circle-stroke-color": "rgba(10,18,26,.55)",
            "circle-stroke-opacity": heat ? fade(1) : 1,
          },
        });
      } else {
      /*
        Бөөгнөрөлд ороогүй дан худаг — firefly загвар.

        Гурван давхарга дээрээс дээр давхарлана: сарнисан гэрэл → бие → цөм.
        Давхцсан цэгүүд бие биенийхээ гэрлийг нэмэгдүүлдэг тул өтгөн хэсэг
        өөрөө тод болж, тархалт нэмэлт өнгөгүйгээр уншигдана.

        `circle-blur` нь радиустай харьцангуй ажилладаг: 1 гэдэг нь ирмэг
        төвөөсөө захад хүртэл бүрэн сарних гэсэн үг. Тиймээс гадна давхаргын
        радиус томрох тусам гэрэл нь ч зөөлөрнө.
      */
      m.addLayer({
        id: "wells-glow",
        type: "circle",
        source: "wells",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 7, 12, 11, 16, 18],
          "circle-color": modeRef.current.fire.glow,
          "circle-blur": 1,
          "circle-opacity": 0.38,
        },
      });

      m.addLayer({
        id: "wells-halo",
        type: "circle",
        source: "wells",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.6, 12, 5.6, 16, 9.5],
          "circle-color": modeRef.current.fire.mid,
          "circle-blur": 0.6,
          "circle-opacity": 0.6,
        },
      });

      /*
        Цөм. Хар хүрээ ТАВИХГҮЙ — гэрэлтэж буй биет ирмэггүй байх ёстой,
        зураас нь гэрлийг таслаад энгийн цэг болгочихно.
      */
      m.addLayer({
        id: "wells-dot",
        type: "circle",
        source: "wells",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 12, 2.3, 16, 4],
          "circle-color": modeRef.current.fire.core,
          "circle-opacity": 0.95,
        },
      });
      }

      /*
        Цэгийн бичвэр шошго — бүх цэгийн давхаргын ДЭЭР суух ёстой тул
        хамгийн сүүлд нэмнэ.

        `minzoom`-оос хол байхад огт зурагдахгүй: холоос шошго нь цэгээ
        дарж, тархалт уншигдахаа болино. Давхцлыг MapLibre-т өөрт нь
        шийдүүлнэ (`text-allow-overlap` тавихгүй) — нягт хэсэгт багтсан
        нь л үлдэж, зураг цэвэр хэвээр байна.

        Шошго нь цэгийн ДООР. Дээр тавьбал firefly гэрэлтэй давхцана.
        Хар контур нь хиймэл дагуулын цайвар, бараан аль ч хэсэг дээр
        бичвэрийг уншигдахуйц байлгана.
      */
      if (modeRef.current.labeled) {
        m.addLayer({
          id: "wells-label",
          type: "symbol",
          source: "wells",
          minzoom: modeRef.current.labelZoom,
          filter: ["all", ["!", ["has", "point_count"]], ["has", "t"]],
          layout: {
            "text-field": ["get", "t"],
            "text-font": FONT,
            "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 12],
            "text-anchor": "top",
            "text-offset": [0, modeRef.current.labelOffset],
            "text-padding": 3,
            /* Урт нэрийг хоёр мөр болгож таслана — нэг мөрөнд сунгавал
               хөрш цэгийнхээ шошгыг түлхэж хаяна */
            "text-max-width": 9,
          },
          paint: {
            "text-color": "#eef4f8",
            "text-halo-color": "rgba(8,14,20,.85)",
            "text-halo-width": 1.2,
          },
        });
      }

      // Бөөгнөрөл дээр товшвол задалж ойртоно
      if (modeRef.current.cluster) m.on("click", "clusters", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = f.properties?.cluster_id;
        if (id == null) return;
        const g = f.geometry;
        if (g.type !== "Point") return;
        const src = m.getSource("wells") as GeoJSONSource;
        src.getClusterExpansionZoom(Number(id)).then((zoom) => {
          m.easeTo({
            center: g.coordinates as [number, number],
            zoom: Math.min(zoom + 0.4, 17),
            duration: 500,
          });
        });
      });

      /*
        Товшилтыг ЦӨМ дээр биш, дунд давхарга дээр барина: цөм нь 2 цэг орчим
        тул хулганаар оносон эсэхийг мэдрэхэд хэцүү. Дунд давхарга нь харагдаж
        буй гэрэлтэй ойролцоо хэмжээтэй бөгөөд цөмийг бүрэн агуулна.
        (`circle-blur` нь зөвхөн зурагдалтад нөлөөлдөг — оноход радиусаар л
        тооцогддог тул сарнисан гэрэл дээр санамсаргүй дарагдахгүй.)
      */
      /*
        Оноход хэрэглэх давхарга. Цөм нь хэдхэн пиксел тул түүн дээр
        бариулбал хулганаар оноход хэцүү. Гадна давхарга нь харагдаж
        буй гэрэлтэй ойролцоо хэмжээтэй бөгөөд цөмийг бүрэн агуулна
        (`circle-blur` нь зөвхөн зурагдалтад нөлөөлдөг — оноход
        радиусаараа тооцогдоно).
      */
      const hitLayer = modeRef.current.weighted
        ? "wells-dot"
        : modeRef.current.graded
          ? "wells-glow"
          : "wells-halo";
      /* Гэрэлтэх зэрэглэлд `wells-halo` мөн үүсдэг ч оноолт нь гадна
         давхарга дээрээ үлдэнэ — цөм нь хэдхэн пиксел */
      m.on("click", hitLayer, (e) => {
        const f = e.features?.[0];
        if (f) selectCb.current(Number(f.properties?.oid));
      });

      const hoverable = modeRef.current.cluster
        ? ["clusters", hitLayer]
        : [hitLayer];
      for (const id of hoverable) {
        m.on("mouseenter", id, () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", id, () => {
          m.getCanvas().style.cursor = "";
        });
      }

      /*
        Давхарга дээрх hover. Тэмдэглэгээт горимд (`marks`, `pulse`) энэ
        нь DOM элемент дээр аль хэдийн бариулдаг — эндхийн бариул нь
        ЦЭГЭН давхаргад зориулав. Хоёулаа ижил `oid` явуулдаг тул
        давхацсан ч зөрчилдөхгүй.
      */
      m.on("mousemove", hitLayer, (e) => {
        const f = e.features?.[0];
        if (f) hoverCb.current?.(Number(f.properties?.oid), { x: e.point.x, y: e.point.y });
      });
      m.on("mouseleave", hitLayer, () => hoverCb.current?.(null));

      /* Олон өнцөгт нь мөн товшигдоно — цэгтэй ижил `oid` дамжуулна */
      if (modeRef.current.shaped) {
        m.on("click", "shape-fill", (e) => {
          const f = e.features?.[0];
          if (f) selectCb.current(Number(f.properties?.oid));
        });
        /* Хулганы доорх талбайг ТУХАЙН ЗУРАГ өөрөө тодруулна — React
           төлөвөөр буцаалт хийвэл хулгана хөдлөх бүрд самбар дахин
           зурагдана. `id` нь GeoJSON feature-ийн тоон дугаар. */
        let hot: number | string | null = null;
        const setHot = (id: number | string | null) => {
          if (hot === id) return;
          const put = (x: number | string | null, on: boolean) => {
            if (x == null) return;
            try {
              m.setFeatureState({ source: "shapes", id: x }, { hot: on });
            } catch {
              /* Эх сурвалж хараахан ачаалагдаагүй байж болно */
            }
          };
          put(hot, false);
          put(id, true);
          hot = id;
        };

        m.on("mousemove", "shape-fill", (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (!f) return;
          setHot(f.id ?? null);
          hoverCb.current?.(Number(f.properties?.oid), { x: e.point.x, y: e.point.y });
        });
        m.on("mouseleave", "shape-fill", () => {
          m.getCanvas().style.cursor = "";
          setHot(null);
          hoverCb.current?.(null);
        });

        /*
          ШУГАМАН геометр нь `shape-fill` дээр оногддоггүй (дүүргэлт нь
          талбайгүй) тул хүрээний давхарга дээр тусад нь барина. Олон
          өнцөгт дээр хоёулаа ажиллах ч ижил `oid` явуулдаг тул
          зөрчилдөхгүй.
        */
        m.on("click", "shape-line", (e) => {
          const f = e.features?.[0];
          if (f) selectCb.current(Number(f.properties?.oid));
        });
        m.on("mousemove", "shape-line", (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (!f) return;
          setHot(f.id ?? null);
          hoverCb.current?.(Number(f.properties?.oid), { x: e.point.x, y: e.point.y });
        });
        m.on("mouseleave", "shape-line", () => {
          m.getCanvas().style.cursor = "";
          setHot(null);
          hoverCb.current?.(null);
        });
      }

      /*
        ТОДРУУЛГЫН ЦАГИРАГ. Тусдаа эх сурвалж дээр суусан шалтгаан: үндсэн
        цэгийн эх сурвалж бөөгнөрдөг тул `feature-state` нь задарсан цэг
        дээр л ажиллана — бөөгнөрөл дундаас гарч ирсэн цэгийг тодруулж
        чадахгүй. Ганц цэгтэй жижиг эх сурвалж нь ямар ч горимд ажиллана.

        Бүх дата давхаргын ДЭЭР суух ёстой тул хамгийн сүүлд нэмэгдэнэ.
      */
      m.addSource("hl", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "hl-glow",
        type: "circle",
        source: "hl",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 11, 12, 15, 16, 22],
          "circle-color": modeRef.current.fire.glow,
          "circle-blur": 1,
          "circle-opacity": 0.4,
        },
      });
      m.addLayer({
        id: "hl-ring",
        type: "circle",
        source: "hl",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 7, 12, 10, 16, 15],
          // Дүүргэлтгүй — доорх цэг өөрөө харагдсаар үлдэнэ
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": modeRef.current.fire.core,
          "circle-stroke-width": 1.3,
          "circle-stroke-opacity": 0.9,
        },
      });

      /* Ойртолтын мэдэгдэл — эхний утгыг мөн нэг удаа өгнө, эс тэгвээс
         дуудагч тал анхны түвшнээ мэдэхгүй */
      zoomCb.current?.(m.getZoom());
      m.on("zoomend", () => zoomCb.current?.(m.getZoom()));

      m.resize();

      setLive(m);
    });

    return () => {
      m.remove();
      map.current = null;
      fitted.current = false;
      setLive(null);
    };
  }, []);

  /* ---------------- Засаг захиргааны хил ---------------- */
  React.useEffect(() => {
    if (!live) return;
    let alive = true;

    fetch(asset("/api/boundaries"))
      .then((r) => (r.ok ? r.json() : null))
      .then((b: BoundarySet | null) => {
        if (!alive || !b) return;
        const src = live.getSource("bnd");
        if (!src || !("setData" in src)) return;

        // Гурван түвшнийг нэг эх сурвалжид нэгтгэж, `level`-ээр ялгана
        const features = (["country", "aimag", "soum"] as const).flatMap((level) =>
          b[level].features.map((f) => ({
            ...f,
            properties: { ...f.properties, level },
          })),
        );
        (src as GeoJSONSource).setData({ type: "FeatureCollection", features });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [live]);

  /* ---------------- Суурь зураг солих ---------------- */
  React.useEffect(() => {
    basemapRef.current = basemap;
    if (live) applyBasemap(live, basemap);
  }, [live, basemap]);

  /* ---------------- Харагдацын үйлдэл (map action) ----------------
     ArcGIS Dashboard-ийн "map extent" үйлдэлтэй ижил: асаалттай үед зураг
     хөдлөх бүрд одоогийн хүрээг дээш дамжуулж, бусад элементүүд түүгээр
     шүүгддэг. Унтраахад `null` явуулж шүүлтийг арилгана. */
  React.useEffect(() => {
    if (!live) return;
    if (!extent) {
      extentCb.current?.(null);
      return;
    }
    const emit = () => {
      const b = live.getBounds();
      extentCb.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    emit();
    live.on("moveend", emit);
    return () => {
      live.off("moveend", emit);
    };
  }, [live, extent]);

  /* ---------------- Дэлгэрэнгүй цэг татах ----------------
     Ойртоход эх сурвалжаас харагдацын хүрээгээр бодит бичлэг татна.

     Гурван зүйлээс болгоомжилно:
       · ХҮРЭЭГ ТЭЛЖ татна (35%) — жижиг гүйлгэлт бүрд шинэ хүсэлт явуулах
         нь хамгийн үнэтэй алдаа. Татсан хайрцаг доторх хөдөлгөөнийг
         алгасна.
       · Хуучин хүсэлтийг ТАСАЛНА (`AbortController`) — хурдан гүйлгэхэд
         олон хүсэлт зэрэг явж, сүүлд ирсэн нь хамгийн шинэ нь БАЙХГҮЙ
         байж болно.
       · Хол очвол эх сурвалжийг ЦЭВЭРЛЭНЭ — эс тэгвээс алс дурдсан
         цэгүүд дулааны зураг дээр хэвээр үлдэнэ. */
  React.useEffect(() => {
    const minZoom = detail?.minZoom;
    if (!live || minZoom == null) return;

    const source = () => live.getSource("detail") as GeoJSONSource | undefined;
    /** Аль хайрцгийн дата эх сурвалжид байгаа вэ */
    let loaded: Extent | null = null;
    let running: AbortController | null = null;
    /* Хариу ирэх дараалал баталгаагүй тул хамгийн сүүлийнхийг л хүлээж авна */
    let turn = 0;

    const inside = (v: Extent, box: Extent) =>
      v[0] >= box[0] && v[1] >= box[1] && v[2] <= box[2] && v[3] <= box[3];

    const run = () => {
      const b = live.getBounds();
      const view: Extent = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];

      if (live.getZoom() < minZoom - 0.4) {
        running?.abort();
        running = null;
        if (loaded) {
          loaded = null;
          source()?.setData({ type: "FeatureCollection", features: [] });
        }
        return;
      }
      if (loaded && inside(view, loaded)) return;

      const padX = (view[2] - view[0]) * 0.35;
      const padY = (view[3] - view[1]) * 0.35;
      const box: Extent = [
        view[0] - padX,
        view[1] - padY,
        view[2] + padX,
        view[3] + padY,
      ];

      running?.abort();
      const ac = new AbortController();
      running = ac;
      const mine = ++turn;

      detailRef.current
        ?.load(box, ac.signal)
        .then((fc: GeoJSON.FeatureCollection) => {
          if (mine !== turn || ac.signal.aborted) return;
          loaded = box;
          source()?.setData(fc);
        })
        .catch(() => {
          /* Таслагдсан эсвэл татагдаагүй — дараагийн хөдөлгөөнд дахин оролдоно */
        });
    };

    run();
    live.on("moveend", run);
    return () => {
      live.off("moveend", run);
      running?.abort();
    };
    /* `key` нь шүүлтүүрийн хээ: солигдоход кэш хүчингүй болж дахин татна */
  }, [live, detail?.minZoom, detail?.key]);

  /* ---------------- Сонголт руу ойртох (zoom action) ----------------
     ArcGIS Dashboard-ийн "zoom" үйлдэл: диаграмаас сум, аймаг сонгоход
     зураг тухайн сонголтын хүрээ рүү нисч ойртоно. Сонголт цуцлагдвал
     анхны хүрээ рүү буцна. Гараар гүйлгэсэн байрлалыг бид дарахгүй —
     зөвхөн сонголт өөрчлөгдөх мөчид л хөдөлнө. */
  React.useEffect(() => {
    if (!live) return;
    const target = focus ?? (zoomed.current ? home.current : null);
    if (!target) return;
    zoomed.current = focus != null;

    const [w, s, e, n] = target;
    live.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      {
        padding: 44,
        // Ганц худаг сонгогдвол хүрээ нь цэг болно — хэт ойртохоос хамгаална
        maxZoom: focus ? 14 : 13,
        duration: 700,
      },
    );
  }, [live, focus]);

  /* ---------------- Хэмжээ өөрчлөгдөхөд ---------------- */
  React.useEffect(() => {
    const el = holder.current;
    if (!live || !el) return;
    const ro = new ResizeObserver(() => live.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [live]);

  /* ---------------- Өгөгдөл шинэчлэх ---------------- */
  React.useEffect(() => {
    if (!live) return;
    const src = live.getSource("wells");
    if (!src || !("setData" in src)) return;

    const { lon, lat, oid } = points;

    const text = labels?.text;

    const features = new Array(visible.length);
    for (let k = 0; k < visible.length; k++) {
      const i = visible[k];
      const props: Record<string, unknown> = { oid: oid[i] };
      if (weights) props.w = weights[i];
      else if (grades) props.g = grades.values[i];
      /* Хоосон шошгыг ОГТ бичихгүй — давхаргын `has t` шүүлт үүнд
         тулгуурлаж, шошгогүй цэгийг алгасна */
      if (text?.[i]) props.t = text[i];
      features[k] = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon[i], lat[i]] },
        properties: props,
      };
    }

    (src as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    } as GeoJSON.FeatureCollection);

    /*
      Эхний удаа өгөгдлийн гол бөөгнөрөл рүү тааруулна. Бүх цэгийг багтаавал
      улс даяар тархсан ~2% нь харагдацыг сунгаж, Улаанбаатарын өтгөн хэсэг
      цэг болж хумигдана. Тиймээс 1–99 хувийн муж дээр тааруулав.

      Энэ хүрээг `home`-д хадгална — сонголт цуцлагдахад буцаж ирэх байрлал.
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
      live.fitBounds(
        [
          [xs[lo], ys[lo]],
          [xs[hi], ys[hi]],
        ],
        { padding: 30, duration: 0, maxZoom: 13 },
      );
    }
  }, [live, points, visible, weights, grades, labels]);

  /* ---------------- Дата олон өнцөгт ---------------- */
  const shapeData = shapes?.data;
  React.useEffect(() => {
    if (!live || !shapeData) return;
    const src = live.getSource("shapes");
    if (!src || !("setData" in src)) return;
    /*
      `promoteId` хэрэглэхгүй: GeoJSON эх сурвалж дээр `feature-state`
      ажиллахад тоон ID хэрэгтэй тул `id`-г нь features дотор нь өгсөн
      гэж үзнэ (дуудагч тал `oid`-той тэнцүү `id` тавина).
    */
    (src as GeoJSONSource).setData(shapeData);
  }, [live, shapeData]);

  /* Сонгогдсон талбайг тодруулах — `feature-state`-ээр, дахин зурахгүй */
  const shapePick = shapes?.selected ?? null;
  const lastPick = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!live || !shapes) return;
    const set = (id: number | null, on: boolean) => {
      if (id == null) return;
      try {
        live.setFeatureState({ source: "shapes", id }, { on });
      } catch {
        /* Эх сурвалж хараахан ачаалагдаагүй байж болно */
      }
    };
    set(lastPick.current, false);
    set(shapePick, true);
    lastPick.current = shapePick;
  }, [live, shapes, shapePick, shapeData]);

  /* ---------------- Нэмэлт давхарга (хил, бүс) ----------------
     Дата давхаргын ДООР суулгана: эс тэгвээс бүсийн дүүргэлт цэгүүдийг
     дардаг. Хамгийн доод дата давхарга нь засаг захиргааны хил тул
     түүний өмнө оруулна. */
  React.useEffect(() => {
    if (!live) return;
    const list = overlays ?? [];
    const wanted = new Set(list.map((o) => `ov-${o.id}`));

    // Хасагдсаныг цэвэрлэнэ
    for (const layer of live.getStyle().layers) {
      if (!layer.id.startsWith("ov-")) continue;
      const base = layer.id.replace(/-(fill|line)$/, "");
      if (wanted.has(base)) continue;
      if (live.getLayer(layer.id)) live.removeLayer(layer.id);
    }
    for (const id of Object.keys(live.getStyle().sources)) {
      if (id.startsWith("ov-") && !wanted.has(id)) live.removeSource(id);
    }

    const below = live.getLayer("bnd-country") ? "bnd-country" : undefined;

    for (const o of list) {
      const src = `ov-${o.id}`;
      if (!live.getSource(src)) {
        live.addSource(src, { type: "geojson", data: o.data });
      }

      if (o.fill && !live.getLayer(`${src}-fill`)) {
        live.addLayer(
          {
            id: `${src}-fill`,
            type: "fill",
            source: src,
            paint: {
              "fill-color": o.fill.color,
              /*
                `gridcode` 1..N → тунгалагийн шатлал. Илэрхийллийн бүтэц
                нь хувьсах урттай тул TS-ийн `match` загварт таарахгүй —
                `unknown` дамжуулан хөрвүүлнэ.
              */
              "fill-opacity": o.fill.byGrid
                ? ([
                    "match",
                    ["get", "gridcode"],
                    ...o.fill.byGrid.flatMap((v, i) => [i + 1, v]),
                    o.fill.byGrid[0],
                  ] as unknown as ExpressionSpecification)
                : (o.fill.opacity ?? 0.08),
            },
          },
          below,
        );
      }

      if (!live.getLayer(`${src}-line`)) {
        live.addLayer(
          {
            id: `${src}-line`,
            type: "line",
            source: src,
            layout: { "line-join": "round" },
            paint: {
              "line-color": o.line.color,
              "line-opacity": o.line.opacity,
              "line-width": o.line.width,
            },
          },
          below,
        );
      }
    }
  }, [live, overlays]);

  /* ---------------- Тодруулгын цагираг ---------------- */
  React.useEffect(() => {
    if (!live) return;
    const src = live.getSource("hl") as GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: highlight
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: highlight },
            },
          ]
        : [],
    });
  }, [live, highlight]);

  /* ---------------- Зурган тэмдэглэгээ ----------------
     Бөөгнөрөлтэй ЗЭРЭГЦЭЖ ажиллана: бөөгнөрөл задарч дан цэг болсон
     бичлэг л зургаа харуулна. Аль цэг задарсныг зөвхөн MapLibre мэднэ
     тул `querySourceFeatures`-ээр асууж, зураг тогтох бүрд (`idle`)
     дахин тааруулна.

     DOM элемент бүр зураг татдаг тул харагдах хүрээ болон `MARKER_CAP`
     хоёроор хязгаарлана — эс тэгвээс ойртоход хэдэн зуун зураг зэрэг
     ачаалагдаж хөтөч зогсоно. */
  React.useEffect(() => {
    if (!live) return;
    const markerRefs = markers.current;

    const clear = () => {
      for (const mk of markerRefs.values()) mk.remove();
      markerRefs.clear();
    };

    if (!marks && !pulse) {
      clear();
      return;
    }

    const sync = () => {
      const want = new Map<
        number,
        { mark: string; pos: [number, number]; tint?: string }
      >();

      if (pulse) {
        /*
          Дохиоллын горим: бөөгнөрөл байхгүй, цэг цөөн тул эх өгөгдлөөс
          шууд уншина — `querySourceFeatures` шаардлагагүй.
        */
        const { lon, lat, oid } = points;
        for (let k = 0; k < visible.length && want.size < MARKER_CAP; k++) {
          const i = visible[k];
          want.set(oid[i], {
            mark: "pulse",
            pos: [lon[i], lat[i]],
            tint: pulseColorRef.current?.(oid[i]),
          });
        }
      } else if (marks) {
        const bounds = live.getBounds();
        for (const f of live.querySourceFeatures("wells", {
          filter: ["!", ["has", "point_count"]],
        })) {
          if (want.size >= MARKER_CAP) break;
          const id = Number(f.properties?.oid);
          if (!Number.isFinite(id) || want.has(id)) continue;
          const mark = marks[id];
          if (!mark) continue;
          const g = f.geometry;
          if (g.type !== "Point") continue;
          const pos = g.coordinates as [number, number];
          if (!bounds.contains(pos)) continue;
          want.set(id, { mark, pos });
        }
      }

      // Хуучирсныг авч, шинийг л нэмнэ — бүгдийг дахин үүсгэвэл зураг анивчина
      for (const [id, mk] of markerRefs) {
        if (!want.has(id)) {
          mk.remove();
          markerRefs.delete(id);
        }
      }
      for (const [id, { mark, pos, tint }] of want) {
        if (markerRefs.has(id)) continue;
        const el = markerEl(
          mark,
          () => selectCb.current(id),
          /*
            Тэмдэглэгээ нь DOM элемент тул хулганы байрлалыг зургаас
            биш, ТЭМДЭГЛЭГЭЭНИЙ БАЙРШЛААС тооцно (`project`) — хөвөгч
            тайлбар тэмдгийнхээ хажууд тогтож, хулганы чичиргээнээс
            хамаарахгүй.
          */
          hoverCb.current
            ? (over) =>
                hoverCb.current?.(over ? id : null, over ? live.project(pos) : undefined)
            : undefined,
          tint,
        );
        markerRefs.set(id, new Marker({ element: el }).setLngLat(pos).addTo(live));
      }
    };

    sync();
    // Дохиоллын горим өгөгдлөөсөө шууд уншдаг тул `idle` сонсох шаардлагагүй
    if (!pulse) live.on("idle", sync);
    return () => {
      if (!pulse) live.off("idle", sync);
      clear();
    };
  }, [live, marks, pulse, points, visible]);

  /*
    Өндрийг `h-full`-ээр өгнө. `absolute inset-0` ажиллахгүй —
    maplibre-gl.css нь `.maplibregl-map { position: relative }` тавьдаг тул
    байрлал дарагдаж, элемент 0 өндөртэй болно.
  */
  return <div ref={holder} className="h-full w-full" />;
}
