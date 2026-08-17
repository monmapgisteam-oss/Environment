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
) {
  const el = document.createElement("button");
  el.type = "button";

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
  const first = m.getStyle().layers.find((l) => l.id !== "base")?.id;
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

export function WellsMap({
  points,
  visible,
  basemap,
  onSelect,
  extent = false,
  onExtent,
  focus = null,
  cluster = true,
  clusterLabel = "inside",
  marks,
  pulse = false,
  onHover,
  overlays,
  shapes,
  grades,
  weights,
}: {
  points: MapPoints;
  /** Шүүлтүүр давсан цэгүүдийн индекс */
  visible: Uint32Array;
  basemap: Basemap;
  onSelect: (oid: number) => void;
  /** Харагдацыг шүүлтүүр болгон дамжуулах эсэх (map action) */
  extent?: boolean;
  onExtent?: (e: Extent | null) => void;
  /** Сонголтын хүрээ — өөрчлөгдөх бүрд зураг тийш нь ойртоно (zoom action) */
  focus?: Extent | null;
  /**
   * Бөөгнөрүүлэх эсэх. ЗӨВХӨН анхны зурагдалтад уншигдана — GeoJSON эх
   * сурвалжийн шинж тул дараа нь солих боломжгүй (самбар бүр өөрийн
   * зураг үүсгэдэг учир хязгаарлалт биш).
   */
  cluster?: boolean;
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
  /** Хулгана тэмдэглэгээ дээр очиход — гарахад `null` */
  onHover?: (oid: number | null) => void;
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
  grades?: { values: ArrayLike<number>; stops: [number, string][]; heat?: boolean };
  /**
   * Цэг бүрийн ЖИН (`points`-той ижил урттай). Өгвөл зураг НЯГТРАЛЫН
   * горимд шилжинэ: алсаас дулааны зураг, ойртоход жингээрээ томордог
   * цэг. Нэг цэг = нэг бичлэг биш, нүд бүрийн хуримтлал болох үед л
   * хэрэглэнэ (жишээ нь 145 мянган жорлонг 11 мянган нүдэнд хурааж).
   */
  weights?: number[];
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
  /** Анх үүсгэх үеийн суурь зураг — effect-ийг дахин ажиллуулахгүйн тулд ref */
  const basemapRef = React.useRef(basemap);
  /** Эх сурвалж үүсгэх үед л уншигдах тохиргоо */
  const modeRef = React.useRef({
    cluster,
    clusterLabel,
    weighted: Boolean(weights),
    graded: grades?.stops,
    gradedHeat: Boolean(grades?.heat),
    shaped: Boolean(shapes),
  });
  /** Зурган тэмдэглэгээ — oid → maplibre marker */
  const markers = React.useRef(new Map<number, Marker>());
  React.useEffect(() => {
    selectCb.current = onSelect;
  }, [onSelect]);
  React.useEffect(() => {
    extentCb.current = onExtent;
  }, [onExtent]);
  React.useEffect(() => {
    hoverCb.current = onHover;
  }, [onHover]);

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

        m.addLayer({
          id: "shape-fill",
          type: "fill",
          source: "shapes",
          paint: {
            "fill-color": ["coalesce", ["get", "c"], SHAPE_FALLBACK] as unknown as ExpressionSpecification,
            "fill-opacity": ["case", ["boolean", ["feature-state", "on"], false], 0.55, 0.28],
          },
        });

        m.addLayer({
          id: "shape-line",
          type: "line",
          source: "shapes",
          layout: { "line-join": "round" },
          paint: {
            "line-color": ["coalesce", ["get", "c"], SHAPE_FALLBACK] as unknown as ExpressionSpecification,
            /* `["zoom"]` нь дээд түвшний `interpolate`-ийн шууд оролт
               байх ёстой — сонголтын шалгалтыг СУУДАЛ бүрийн дотор
               оруулав, эсрэгээр бичвэл давхарга чимээгүйхэн гологдоно */
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              ["case", ["boolean", ["feature-state", "on"], false], 1.8, 0.5],
              14,
              ["case", ["boolean", ["feature-state", "on"], false], 2.6, 1.2],
            ] as unknown as ExpressionSpecification,
            "line-opacity": 0.9,
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
        clusterMaxZoom: 15,
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
            "circle-color": FIREFLY.glow,
            // Тоо нь дотроо биш бол дугуй нь илүү хоосон, бөгж маягтай
            "circle-opacity": badge ? 0.14 : 0.22,
            "circle-radius": clusterRadius,
            "circle-stroke-width": badge ? 2 : 1.4,
            "circle-stroke-color": FIREFLY.glow,
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

          ХАРАГДАХ ХҮРЭЭ (шилжилтийн цонх):
            z ≤ 11.5   зөвхөн дулааны зураг
            z 11.5–13  дулаан бүдгэрч, нүд гарч ирнэ (давхцсан үе)
            z ≥ 13     зөвхөн нүд (~2км масштабаас ойр)
          Хоёр давхарга давхцах цонх ЗААВАЛ хэрэгтэй — эс тэгвээс нэг нь
          алга болоод нөгөө нь гарах хүртэл зураг хоосорно.
        */
        m.addLayer({
          id: "cells-heat",
          type: "heatmap",
          source: "wells",
          maxzoom: 13.5,
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
            // Ойртох тусам дулааны зураг арилж, цэгүүд гарч ирнэ
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0.9, 13, 0],
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
          minzoom: 11.5,
          paint: {
            /*
              Хэмжээ нь ТОГТМОЛ — энгийн цэгэн давхарга.

              Урьд нь радиусыг нүд доторх тоогоор томруулж байсан нь
              бүтсэнгүй: 220м-ийн нүд тогтмол алхамтай тул том дугуйнууд
              хоорондоо нийлж, суурь зургийг бүрхсэн эгнээ болж хувирсан.
              Тоо хэмжээг ДУЛААНЫ зураг аль хэдийн хэлж байгаа тул цэг нь
              зөвхөн "энд бий" гэдгийг харуулна.
            */
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11.5, 2, 14, 3, 17, 4.5],
            "circle-color": FIREFLY.glow,
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 13, 0.9],
            "circle-stroke-width": 0.6,
            "circle-stroke-color": "rgba(0,0,0,.45)",
            "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 13, 1],
          },
        });
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

        m.addLayer({
          id: "wells-glow",
          type: "circle",
          source: "wells",
          ...(heat ? { minzoom: 11.5 } : {}),
          paint: {
            "circle-radius": gradedRadius(stops, 2.4),
            "circle-color": gradeColor(stops),
            "circle-blur": 1,
            "circle-opacity": heat ? fade(0.32) : 0.32,
          },
        });

        m.addLayer({
          id: "wells-dot",
          type: "circle",
          source: "wells",
          ...(heat ? { minzoom: 11.5 } : {}),
          paint: {
            "circle-radius": gradedRadius(stops, 1),
            "circle-color": gradeColor(stops),
            "circle-opacity": heat ? fade(0.92) : 0.92,
            /* Нимгэн бараан ирмэг — цайвар суурь зураг дээр цэг арилахаас
               хамгаална, гэрэлтэлтийг таслахааргүй сул */
            "circle-stroke-width": 0.7,
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
          "circle-color": FIREFLY.glow,
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
          "circle-color": FIREFLY.mid,
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
          "circle-color": FIREFLY.core,
          "circle-opacity": 0.95,
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
        if (f) hoverCb.current?.(Number(f.properties?.oid));
      });
      m.on("mouseleave", hitLayer, () => hoverCb.current?.(null));

      /* Олон өнцөгт нь мөн товшигдоно — цэгтэй ижил `oid` дамжуулна */
      if (modeRef.current.shaped) {
        m.on("click", "shape-fill", (e) => {
          const f = e.features?.[0];
          if (f) selectCb.current(Number(f.properties?.oid));
        });
        m.on("mousemove", "shape-fill", (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (f) hoverCb.current?.(Number(f.properties?.oid));
        });
        m.on("mouseleave", "shape-fill", () => {
          m.getCanvas().style.cursor = "";
          hoverCb.current?.(null);
        });
      }

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

    const features = new Array(visible.length);
    for (let k = 0; k < visible.length; k++) {
      const i = visible[k];
      features[k] = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon[i], lat[i]] },
        properties: weights
          ? { oid: oid[i], w: weights[i] }
          : grades
            ? { oid: oid[i], g: grades.values[i] }
            : { oid: oid[i] },
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
  }, [live, points, visible, weights, grades]);

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
      const want = new Map<number, { mark: string; pos: [number, number] }>();

      if (pulse) {
        /*
          Дохиоллын горим: бөөгнөрөл байхгүй, цэг цөөн тул эх өгөгдлөөс
          шууд уншина — `querySourceFeatures` шаардлагагүй.
        */
        const { lon, lat, oid } = points;
        for (let k = 0; k < visible.length && want.size < MARKER_CAP; k++) {
          const i = visible[k];
          want.set(oid[i], { mark: "pulse", pos: [lon[i], lat[i]] });
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
      for (const [id, { mark, pos }] of want) {
        if (markerRefs.has(id)) continue;
        const el = markerEl(
          mark,
          () => selectCb.current(id),
          hoverCb.current ? (over) => hoverCb.current?.(over ? id : null) : undefined,
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
