"use client";

import * as React from "react";
import {
  Map as MapLibreMap,
  ScaleControl,
  prewarm,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DATA_COLOR } from "@/components/wells/colors";
import type { BoundarySet } from "@/lib/boundaries";
import { asset } from "@/lib/base-path";

export type MapPoints = {
  oid: number[];
  lon: number[];
  lat: number[];
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

/**
 * Бөөгнөрлийн тоог бичихэд фонтын glyph хэрэгтэй. Растер хавтан ганцаараа
 * glyph өгдөггүй тул нийтэд нээлттэй OpenMapTiles-ийн фонтын үйлчилгээг заана.
 */
const GLYPHS = "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";
const FONT = ["Open Sans Bold"];

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
}: {
  points: MapPoints;
  /** Шүүлтүүр давсан цэгүүдийн индекс */
  visible: Uint32Array;
  basemap: Basemap;
  onSelect: (oid: number) => void;
}) {
  const holder = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MapLibreMap | null>(null);
  const fitted = React.useRef(false);
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
  /** Анх үүсгэх үеийн суурь зураг — effect-ийг дахин ажиллуулахгүйн тулд ref */
  const basemapRef = React.useRef(basemap);
  React.useEffect(() => {
    selectCb.current = onSelect;
  }, [onSelect]);

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
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 15,
      });

      /*
        Бөөгнөрөл: дүүргэлт нь тунгалаг, хүрээ нь ИЖИЛ өнгөөр бүтэн.
        Ингэснээр доорх суурь зураг харагдсаар үлдэж, аль ч суурин дээр
        (бараан, хиймэл дагуул, гудамж) уншигдана.
      */
      m.addLayer({
        id: "clusters",
        type: "circle",
        source: "wells",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": DATA_COLOR,
          "circle-opacity": 0.22,
          "circle-radius": clusterRadius,
          "circle-stroke-width": 1.4,
          "circle-stroke-color": DATA_COLOR,
          "circle-stroke-opacity": 0.95,
        },
      });

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

      // Бөөгнөрөлд ороогүй дан худаг
      m.addLayer({
        id: "wells-dot",
        type: "circle",
        source: "wells",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.2, 12, 3.4, 16, 6],
          "circle-color": DATA_COLOR,
          "circle-opacity": 0.95,
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 0, 14, 0.6],
          "circle-stroke-color": "rgba(0,0,0,.5)",
        },
      });

      // Бөөгнөрөл дээр товшвол задалж ойртоно
      m.on("click", "clusters", (e) => {
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

      m.on("click", "wells-dot", (e) => {
        const f = e.features?.[0];
        if (f) selectCb.current(Number(f.properties?.oid));
      });

      for (const id of ["clusters", "wells-dot"]) {
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
      live.fitBounds(
        [
          [xs[lo], ys[lo]],
          [xs[hi], ys[hi]],
        ],
        { padding: 30, duration: 0, maxZoom: 13 },
      );
    }
  }, [live, points, visible]);

  /*
    Өндрийг `h-full`-ээр өгнө. `absolute inset-0` ажиллахгүй —
    maplibre-gl.css нь `.maplibregl-map { position: relative }` тавьдаг тул
    байрлал дарагдаж, элемент 0 өндөртэй болно.
  */
  return <div ref={holder} className="h-full w-full" />;
}
