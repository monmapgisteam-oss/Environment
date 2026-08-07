"use client";

import * as React from "react";
import {
  Map as MapLibreMap,
  Marker,
  ScaleControl,
  prewarm,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FIREFLY } from "@/components/wells/colors";
import type { BoundarySet } from "@/lib/boundaries";
import { asset } from "@/lib/base-path";

export type MapPoints = {
  oid: number[];
  lon: number[];
  lat: number[];
};

/** Харагдац: [баруун, өмнөд, зүүн, хойд] */
export type Extent = [number, number, number, number];

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
function markerEl(mark: string, onClick: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  if (mark.startsWith("<svg")) {
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
  const extentCb = React.useRef(onExtent);
  /** Анх үүсгэх үеийн суурь зураг — effect-ийг дахин ажиллуулахгүйн тулд ref */
  const basemapRef = React.useRef(basemap);
  /** Эх сурвалж үүсгэх үед л уншигдах тохиргоо */
  const modeRef = React.useRef({ cluster, clusterLabel });
  /** Зурган тэмдэглэгээ — oid → maplibre marker */
  const markers = React.useRef(new Map<number, Marker>());
  React.useEffect(() => {
    selectCb.current = onSelect;
  }, [onSelect]);
  React.useEffect(() => {
    extentCb.current = onExtent;
  }, [onExtent]);

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
    m.addControl(new ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-left");

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
      m.on("click", "wells-halo", (e) => {
        const f = e.features?.[0];
        if (f) selectCb.current(Number(f.properties?.oid));
      });

      const hoverable = modeRef.current.cluster
        ? ["clusters", "wells-halo"]
        : ["wells-halo"];
      for (const id of hoverable) {
        m.on("mouseenter", id, () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", id, () => {
          m.getCanvas().style.cursor = "";
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
        properties: { oid: oid[i] },
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
  }, [live, points, visible]);

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

    if (!marks) {
      clear();
      return;
    }

    const sync = () => {
      const bounds = live.getBounds();
      const want = new Map<number, { svg: string; pos: [number, number] }>();

      for (const f of live.querySourceFeatures("wells", {
        filter: ["!", ["has", "point_count"]],
      })) {
        if (want.size >= MARKER_CAP) break;
        const id = Number(f.properties?.oid);
        if (!Number.isFinite(id) || want.has(id)) continue;
        const svg = marks[id];
        if (!svg) continue;
        const g = f.geometry;
        if (g.type !== "Point") continue;
        const pos = g.coordinates as [number, number];
        if (!bounds.contains(pos)) continue;
        want.set(id, { svg, pos });
      }

      // Хуучирсныг авч, шинийг л нэмнэ — бүгдийг дахин үүсгэвэл зураг анивчина
      for (const [id, mk] of markerRefs) {
        if (!want.has(id)) {
          mk.remove();
          markerRefs.delete(id);
        }
      }
      for (const [id, { svg, pos }] of want) {
        if (markerRefs.has(id)) continue;
        const el = markerEl(svg, () => selectCb.current(id));
        markerRefs.set(id, new Marker({ element: el }).setLngLat(pos).addTo(live));
      }
    };

    sync();
    live.on("idle", sync);
    return () => {
      live.off("idle", sync);
      clear();
    };
  }, [live, marks]);

  /*
    Өндрийг `h-full`-ээр өгнө. `absolute inset-0` ажиллахгүй —
    maplibre-gl.css нь `.maplibregl-map { position: relative }` тавьдаг тул
    байрлал дарагдаж, элемент 0 өндөртэй болно.
  */
  return <div ref={holder} className="h-full w-full" />;
}
