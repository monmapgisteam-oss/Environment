/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ачаалагддаг тул төрлийн тодорхойлолтгүй; SDK обьект `any` */

import type * as GeoJSON from "geojson";

import { FIREFLY } from "@/components/wells/colors";
import { esriModules } from "@/lib/arcgis-sdk";

import { labelPoints } from "@/lib/extent";
import type { Family } from "./map-geometry";
import type { Fire } from "./map-symbols";
import { shapeRenderer, polySymbol, lineSymbol, INVISIBLE, HALO, FONT, sizeByZoom, pointRenderer, pt, clusterSymbol, gradedMultiSymbol } from "./map-symbols";
import { scaleAt, zoomForScale } from "./map-scale";
import { col, cleanGeom, familyOf } from "./map-geometry";
import type { MapPoints, MapOverlay } from "./map-scale";

/** Харилцдаг давхаргын хамгийн их тэмдэглэгээ — DOM элемент бүр зураг татна */
export const MARKER_CAP = 250;

/* --------------------------------------------------------------------------
   SDK модулиуд
   -------------------------------------------------------------------------- */

export type Esri = {
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

export let esriP: Promise<Esri> | null = null;

export function loadEsri() {
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

export type Field = { name: string; type: "double" | "string" | "integer" };

/*
  ⚠⚠ ДАТАНЫ ДАВХАРГА нь `GeoJSONLayer` (blob хаягаас). Эхлээд клиент
  `FeatureLayer` + `applyEdits` байсан: 145 мянган жорлонгийн цэг дээр
  засвар 25 секундээс илүү үргэлжилж, хөтөч бүхэлдээ түгжигдэв
  (2026-10-12-нд хэмжсэн). `GeoJSONLayer` нь өгөгдлөө WORKER дээр
  задлах, проекцлох тул үндсэн урсгал чөлөөтэй.
*/
export function geoLayer(E: Esri, geometryType: Family, fields: Field[], extra: Record<string, unknown>, features: GeoJSON.Feature[] = []) {
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

export const clientLayer = (E: Esri, geometryType: Family, fields: Field[], extra: Record<string, unknown> = {}) =>
  geoLayer(E, geometryType, fields, extra);

/** Давхаргын байрлал — `get` нь одоогийн давхаргыг, `set` нь шинийг бүртгэнэ */
export type Slot = { key: string; get: () => any; set: (l: any) => void };

/*
  ДАТА СОЛИХ — шинэ давхарга ХУУЧНЫХАА ДЭЭР нэмэгдэж, зурагдаж дуусмагц
  хуучин нь авагдана: зураг хоосрох агшин гарахгүй. Сүүлд тавигдсан
  рендерер, шошго, бөөгнөрөл хуучнаасаа хуулагдана. Нэг байрлалын
  солилтууд ДАРААЛНА; дараалалд хүлээж байх хооронд шинэ дата ирвэл
  дундах нь алгасагдана.
*/
export const queues = new Map<string, Promise<void>>();

export const latest = new Map<string, number>();

export function refill(E: Esri, view: any, slot: Slot, make: () => GeoJSON.Feature[]) {
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

export let slotSeq = 0;

/** `layers` обьектын нэг талбарын байрлал */
export function slotOf(layers: any, key: string): Slot {
  layers.__id ??= ++slotSeq;
  return { key: `${layers.__id}:${key}`, get: () => layers[key], set: (l) => (layers[key] = l) };
}

export const pointFeature = (lon: number, lat: number, properties: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties,
});

/** Бөөгнөрлийн тоо — MapLibre-ийн `point_count_abbreviated` */
export const CLUSTER_TEXT = `var n = $feature.cluster_count;
When(n >= 10000, Text(Round(n / 1000)) + "k", n >= 1000, Text(Round(n / 1000, 1)) + "k", Text(n))`;

/** `WellsMap`-ийн пропоос зургийн ГОРИМ — эх сурвалж үүсгэх үед л уншигдана */
export type ModeInput = {
  cluster?: boolean;
  clusterMaxZoom?: number;
  clusterRadius?: number;
  clusterLabel?: "inside" | "badge";
  weights?: number[];
  grades?: { stops: [number, string][]; firefly?: boolean | "graded" };
  shapes?: {
    glow?: boolean;
    crisp?: boolean;
    color?: string;
    labelZoom?: number;
    flow?: boolean;
    labelPlacement?: "point" | "line-center";
    edge?: "thin" | "hair";
    outline?: boolean;
    hollow?: string[];
    labelUnique?: boolean;
  };
  firefly?: Fire;
  colors?: ArrayLike<string | undefined>;
  dots?: { rank?: Record<string, number> };
  esriFirefly?: boolean;
  pointScale?: number;
  labels?: { minzoom?: number; offset?: number; size?: number; colors?: Record<string, string>; halo?: number };
  values?: { maxzoom?: number };
  scale?: number;
  alerts?: { levels: ArrayLike<number | undefined>; colors: string[] };
};

export function modeOf({
  cluster = true,
  clusterMaxZoom = 15,
  clusterRadius = 48,
  clusterLabel = "inside",
  weights,
  grades,
  shapes,
  firefly,
  colors,
  dots,
  esriFirefly = false,
  pointScale,
  labels,
  values,
  scale,
  alerts,
}: ModeInput): Mode {
  return {
    cluster,
    clusterMaxZoom,
    clusterRadius,
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
    esriFire: esriFirefly,
    pointScale: pointScale ?? 1,
    shapeLabelZoom: shapes?.labelZoom ?? 0,
    shapeFlow: Boolean(shapes?.flow),
    shapeLabelOnLine: shapes?.labelPlacement === "line-center",
    shapeThin: shapes?.edge === "thin",
    shapeHair: shapes?.edge === "hair",
    shapeHollow: shapes?.hollow ?? [],
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
    alertColors: alerts?.colors ?? [],
  };
}

/**
 * ДАТАНЫ ДАВХАРГУУД — дүрс (олон өнцөгт · шугам · тэдний шошго) ба цэг,
 * горимоос. `WellsMap` ба "Мэдээллийн сан" ({@link src/components/home/data-bank.tsx})
 * НЭГ функцээр үүсгэнэ — тэмдэглэгээ хоёр газар зөрөхгүй.
 */
export function dataLayers(E: Esri, mode: Mode) {
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
    { name: "a", type: "integer" },
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
  /*
    Ойрын цэг — ESRI-ИЙН FIREFLY тэмдэг (хэрэглэгч 2026-11-23, ариун цэврийн
    байгууламж: "1:24,600-аас ойр pointuud firefly"): цагаан цөм + палитрын
    `glow` өнгөөр будсан гэрэл. Урьд нь 1.2–2.6px энгийн цэг байв. Хэмжээ нь
    тэмдгийн хамгийн том давхарга (гэрэл); гэр хорооллын ~20 м зайтай цэгүүд
    нийлэхгүйн тулд жижиг.
  */
  const dotRenderer = {
    type: "simple",
    symbol: gradedMultiSymbol(mode.fire.glow),
    visualVariables: [
      sizeByZoom([
        [zDot - 0.6, 3.5],
        [15, 9],
        [18, 14],
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
            /* ⚠ "badge" горим (аврагдсан амьтан, авто засвар): булангийн
               хайрцагтай тоо Esri дээр хөршийнхөө дээгүүр давхцаж зураг
               замбараагүй харагдаж байв (2026-10-23). Одоо cyan дүүргэлттэй
               дугуй (42%), тоо нь ДОТОРОО, бөөгнөрлийн радиус илүү өргөн.
               Бараан цул дүүргэлт "онцгүй" гэж буцаагдсан. */
            clusterRadius: badge ? "72px" : `${mode.clusterRadius}px`,
            clusterMinSize: `${pt(badge ? 12 : 10)}pt`,
            clusterMaxSize: `${pt(badge ? 28 : 38)}pt`,
            maxScale: scaleAt(mode.clusterMaxZoom),
            /* ⚠ `renderer` БИШ `symbol`: өөрийн рендерер өгвөл НЭГ гишүүнтэй
               бөөгнөрөл ч цагираг болж зурагддаг байв.
               ХАРДЛАГАТАЙ ЦЭГ (`alerts`, хэрэглэгч 2026-11-16) байвал л рендерер:
               гишүүдийн `a`-ийн их утгаар (`alert`) — ядаж нэг хардлагатай бол улаан */
            ...(mode.alertColors.length
              ? {
                  fields: [{ name: "alert", onStatisticField: "a", statisticType: "max" }],
                  /* ⚠ Рендерертэй үед НЭГ гишүүнтэй бөөгнөрөл ч энэ рендерерээр
                     зурагддаг — тиймээс тэдэнд Firefly цэг ("s0"/"s1"), бусдад дугуй */
                  renderer: {
                    type: "unique-value",
                    /* ⚠ `max` нь бүх гишүүн 0 үед 0 биш 5e-324 буцаадаг (хэмжсэн) — босгоор */
                    valueExpression: `IIf($feature.cluster_count == 1, "s", "c") + Text(Round(DefaultValue($feature.alert, 0)))`,
                    defaultSymbol: clusterSymbol(mode.fire.glow, badge),
                    uniqueValueInfos: [
                      { value: "c0", symbol: clusterSymbol(mode.fire.glow, badge) },
                      { value: "s0", symbol: gradedMultiSymbol(mode.graded?.[0][1] ?? mode.fire.glow) },
                      ...mode.alertColors.flatMap((c, k) => [
                        { value: `c${k + 1}`, symbol: clusterSymbol(c, badge) },
                        { value: `s${k + 1}`, symbol: gradedMultiSymbol(c) },
                      ]),
                    ],
                    visualVariables: [
                      {
                        type: "size",
                        field: "cluster_count",
                        stops: [
                          { value: 1, size: "10pt" },
                          { value: 2, size: `${pt(badge ? 12 : 10)}pt` },
                          { value: 150, size: `${pt(badge ? 28 : 30)}pt` },
                        ],
                      },
                    ],
                  },
                }
              : { symbol: clusterSymbol(mode.fire.glow, badge) }),
            labelingInfo: [
              {
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

  return { shapePoly, shapeLine, shapeLabels, points, values: valuesLayer, heat, heatRenderer, dotRenderer, zDot };
}

/** Цэгийн давхаргыг дүүргэнэ — өнгө (`colors`), зэрэглэл, жин, шошго, хэмжилтийн утга */
export function fillPoints(
  E: Esri,
  view: any,
  layers: { points: any; values?: any | null },
  mode: Mode,
  d: {
    points: MapPoints;
    visible: ArrayLike<number>;
    weights?: number[];
    grades?: { values: ArrayLike<number> };
    labels?: { text: string[] };
    values?: { text: string[]; color?: string[] };
    colors?: ArrayLike<string | undefined>;
    dotRank: string;
    alerts?: ArrayLike<number | undefined>;
  },
) {
  const { points, visible, weights, grades, labels, values, colors, dotRank, alerts } = d;
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
      a: alerts?.[i] ?? 0,
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

}

/** Дүрсийн давхаргуудыг дүүргэнэ — `geoms` нь oid → геометр (тодруулахад) */
export function fillShapes(
  E: Esri,
  view: any,
  layers: { shapePoly?: any | null; shapeLine?: any | null; shapeLabels?: any | null },
  mode: Mode,
  shapeData: GeoJSON.FeatureCollection,
  geoms: Map<number, { geojson: GeoJSON.Geometry; c: string | null; esri?: any }>,
) {
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
  if (layers.shapePoly) refill(E, view, slotOf(layers, "shapePoly"), () => polys);
  if (layers.shapeLine) refill(E, view, slotOf(layers, "shapeLine"), () => lines);
  /* Шошгын цэгүүд дүрстэйгээ ХАМТ шинэчлэгдэнэ */
  if (layers.shapeLabels) {
    const lp = mode.shapeLabelOnLine ? lineMidpoints(shapeData) : labelPoints(shapeData, mode.shapeLabelUnique);
    refill(E, view, slotOf(layers, "shapeLabels"), () =>
      lp.features.flatMap((f) => {
        const geometry = cleanGeom(f.geometry);
        return geometry
          ? [{ type: "Feature" as const, geometry, properties: { t: f.properties?.t ?? null, s: f.properties?.s ?? null } }]
          : [];
      }),
    );
  }
}

/** Нэмэлт давхаргын (хил, бүс) рендерер, шошго, дүрсүүд — `WellsMap` ба "Мэдээллийн сан" нэг дүрмээр */
export function overlayParts(o: MapOverlay, fam: Family) {
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
  return { renderer, feats, labelingInfo };
}

export function overlayFamily(o: MapOverlay): Family {
  return familyOf(o.data.features.find((f) => f.geometry)?.geometry) ?? "polygon";
}

/* ==========================================================================
   Бүрэлдэхүүн
   ========================================================================== */

export type Mode = {
  cluster: boolean;
  clusterMaxZoom: number;
  clusterRadius: number;
  clusterLabel: "inside" | "badge";
  weighted: boolean;
  graded: [number, string][] | undefined;
  gradedFire: boolean;
  gradedFireColor: boolean;
  /** Хардлагын түвшний өнгө (`alerts`, түвшин 1…) — цэг ба тэдгээрийг агуулсан бөөгнөрөл */
  alertColors: string[];
  shaped: boolean;
  shapeGlow: boolean;
  shapeCrisp: boolean;
  shapeColor: string | undefined;
  fire: Fire;
  tinted: boolean;
  dots: { rank?: Record<string, number> } | null;
  /** Esri-ийн Firefly зурган тэмдэг ангиллын өнгөөр ({@link WellsMap} `esriFirefly`) */
  esriFire: boolean;
  /** Цэгийн хэмжээний үржүүлэгч (зэрэглэлгүй цэгт), анхдагч 1 */
  pointScale: number;
  shapeLabelZoom: number;
  shapeFlow: boolean;
  shapeLabelOnLine: boolean;
  shapeThin: boolean;
  shapeHair: boolean;
  /** Эдгээр өнгөтэй олон өнцөгт ДҮҮРГЭЛТГҮЙ, нарийн хүрээтэй */
  shapeHollow: string[];
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
export type Layers = {
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

export type Live = { E: Esri; view: any; map: any; layers: Layers; mode: Mode };

/** Шугамын УРТЫН дунд цэг — хэрчмийн шошгонд */
export function lineMidpoints(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
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
