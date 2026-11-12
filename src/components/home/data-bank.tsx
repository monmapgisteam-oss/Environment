"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ирдэг тул төрөлгүй */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CircleAlert, Database, Layers3, Loader2, MousePointer2, Search, X } from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { esriModules } from "@/lib/arcgis-sdk";
import { arcgisJson } from "@/lib/arcgis";
import { layerUrl, loadMapData, reason, type MapData } from "@/components/edit/esri-edit";
import { DECOR, lookDataOf, lookFor, type MapProps } from "@/components/edit/looks";
import { editTargets, type EditTarget } from "@/lib/edit-targets";
import { CATALOG } from "@/components/access/catalog";
import { measurePanel } from "@/lib/scene-tools";
import { isSystemField } from "@/lib/portal-layers";
import { DEPARTMENTS, SHORT_NAMES, type Department } from "@/lib/departments";
import { SHORT_EN, useLang } from "@/lib/i18n";
import {
  dataLayers,
  defaultBasemap,
  esriBasemaps,
  familyOf,
  fillPoints,
  fillShapes,
  geoLayer,
  loadEsri,
  markerEl,
  mlOf,
  modeOf,
  overlayFamily,
  overlayParts,
  placeMarks,
  scaleAt,
  type Esri,
  type Mode,
} from "@/components/wells/map";
import { useAccess } from "@/components/auth/access";
import { cn, num } from "@/lib/utils";

/*
  МЭДЭЭЛЛИЙН САН — ТӨСЛИЙН БҮХ ДАВХАРГА НЭГ ЗУРАГТ (хэрэглэгч 2026-11-12,
  геомэдээллийн сангийн жишээ зургаар: "ene project deer bgaa buh feature
  1 map tuwluruuleh heregtei bn").

  ⚠⚠ ТЭМДЭГЛЭГЭЭ ХЭЛТСИЙН САМБАРЫНХТАЙ ЯГ ИЖИЛ, ДАВХАРГА БҮРИЙГ ДАХИН
  ТОХИРУУЛАХГҮЙ (хэрэглэгч мөн өдөр: "feature symbolgy busad heltesiin map
  deer yaj haragdaj bga yg ter ungu turhuur ni haruul uuniig dahin 1 burchlen
  tohiruulna gj bhgui shu"). Тиймээс давхарга нь эх сурвалжийн ArcGIS
  рендерер БИШ — засварлагчийн замаар: `editTargets` (каталогийн хэлтэс ×
  цэс бүр) → `lookFor` (самбар бүрийн `WellsMap` пропыг түүхий атрибутаас
  давтан боддог {@link src/components/edit/looks.ts}) → `WellsMap`-ийн
  ӨӨРИЙН экспортолсон функцүүд (`modeOf` · `dataLayers` · `fillPoints` ·
  `fillShapes` · `overlayParts` · `markerEl`) нэг Esri зураг дээр. Самбарын
  зураг өөрчлөгдвөл `looks.ts` засагдана, энд юу ч бичигдэхгүй.

  Давхаргууд зүүн талд хэлтсийн `Өгөгдлийн багц` загвараар (хэрэглэгч
  2026-11-12). Баруун дээд буланд Esri SDK-ийн гурван `Expand` хэрэгсэл:
  бусад хэлтсийн бэлэн `BasemapGallery`, таних тэмдэг, 2D хэмжилт.
  Нэг `group`-т тул нэг удаад НЭГ самбар нээгдэнэ. Өндрийн зүсэлт байхгүй.

  ⚠ Давхаргын жагсаалт React-аар, хэлтэс → давхарга гэсэн хоёр шат.
  Чагт нь Esri бүлгийн харагдацыг өөрчилж, тоо ба таних тэмдэг түүнийг дагана.
  ⚠ Таних тэмдэг Esri-ийн `Legend` БИШ — бидний давхаргын өнгө `c` талбарын
  hex утгаар уншигдах тул тэр нь hex код жагсаах байв; оронд нь асаалттай
  давхарга бүр нэр, өнгөөрөө (`t.color` эсвэл цэгийн гэрлийн өнгө).
  ⚠⚠ АНХНААСАА ЗӨВХӨН ЗУРГААН ДАВХАРГА АСААЛТТАЙ (`DEFAULT_ON`, хэрэглэгч
  2026-11-12, мөн өдөр хоёрыг сольсон): ХБОАХХ — Ашигт малтмалын тусгай зөвшөөрөл ·
  ОХ — 100 метрийн хамгаалалтын зурвас · АУХХ — Хаг · НБАХХ —
  Намгархаг газар · БОҮУАӨХ — Ерөнхий үнэлгээ 2025 · ХХ — Ландфилл (энгийн ба
  аюултай хог хаягдал). Бусад (нүхэн жорлонгийн 145 мянган цэг ч) жагсаалтаас
  асаахад л татагдана.
  ⚠ `zoomAware` хэв (авто засвар — ойртоход тэмдэг, гудамжны зураг) нэг удаа
  анхны ойртолтоор (хол) бодогдоно: ойртоход тэмдэг гарахгүй, бөөгнөрөл
  задарна. Суурь зургийг самбар өөрөө солихгүй.
  ⚠ Бөөгнөрөлтэй давхаргын DOM тэмдэглэгээ (`marks`) бөөгнөрөл задрах
  хязгаараас хол үед бүхэлдээ нуугдана (самбар SDK-ээс бөөгнөрсөн цэгийг
  асуудаг — энд олон давхарга тул энгийн дүрэм).
  ⚠ Товшиход бүртгэлийн цонх: тэр давхаргаас НЭГ мөрийг `arcgisJson`-оор
  татна — системийн, хувь хүний мэдээллийн талбар (утас, регистр, и-мэйл)
  орохгүй. Чимэглэл дүрс (`DECOR`-оос дээш) товшигдохгүй.
*/

const DEFAULT_ON = /X00_TTAMTZ_ashiglalt|O03_buffer_100m|A02_hag_sudalgaa|N08_namgarhag|B01_Parcel_yrunhii_unelgee_2025|хог_хаягдал/;
const isDefaultOn = (url: string) => DEFAULT_ON.test(decodeURIComponent(url));
/** Хувь хүний мэдээллийн талбар — цонхонд гарахгүй */
const PRIVATE_FIELD = /utas|phone|тел|регистр|register|reg_?num|mail|identity|мэдээлэгч/i;
/** Нэг давхаргын DOM тэмдэглэгээний дээд тоо (`WellsMap`-ийн `MARKER_CAP`-тай нэг) */
const MARKER_CAP = 250;
/** Зэрэг татах давхаргын тоо */
const PARALLEL = 4;

const TOOL_GROUP = "data-bank-tools";
const WIDGETS = [
  "esri/widgets/Expand",
  "esri/widgets/Measurement",
  "esri/symbols/support/symbolUtils",
];

type Target = EditTarget & { dept: Department };
type LegendRow = { key: string; title: string; dept: string; color: string; swatches: HTMLElement[] };

/*
  ТАНИХ ТЭМДГИЙН ДЭЭЖ — газрын зураг дээрх ЯГ ТЭР тэмдэг (хэрэглэгч 2026-11-12:
  "point bol yag map deer haragdaj bga heweer, polygon durwuljin dotor unguur fill
  outline, line zuraas"). Давхаргын бодит рендерерээс тэмдгийг авч Esri-ийн
  `symbolUtils.renderPreviewHTML`-ээр зурна — цэг нь гэрэлтэй дискээрээ, олон
  өнцөгт нь дүүргэлт + хүрээтэй дөрвөлжин, шугам нь зураас. DOM тэмдэглэгээтэй
  (дохиолол, хог хаягдлын тэмдэг) давхаргад тэр тэмдэглэгээ өөрөө.
  Олон өнгөтэй (ангилал, зэрэглэл) давхаргад жигд түүвэрлэсэн `SWATCH_MAX` хүртэл.
*/
const SWATCH_MAX = 4;
function sampled<T>(all: T[], n = SWATCH_MAX): T[] {
  /* Ижил тэмдэг (зэрэглэл нь зөвхөн хэмжээгээр ялгардаг) нэг л удаа */
  const seen = new Set<string>();
  const xs = all.filter((x: any) => {
    const k = JSON.stringify(x?.toJSON?.() ?? x);
    return seen.has(k) ? false : (seen.add(k), true);
  });
  if (xs.length <= n) return xs;
  return Array.from({ length: n }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (n - 1))]);
}
/** Рендерерийн тэмдгүүд; `only` өгвөл тэр утгатай (өнгө) ангилал л */
function rendererSymbols(r: any, only?: Set<string>, base = false): any[] {
  if (!r) return [];
  const seen = (s: any) => s && !(s.type === "simple-marker" && !s.size);
  if (r.type === "unique-value") {
    const infos = (r.uniqueValueInfos?.toArray?.() ?? r.uniqueValueInfos ?? []).filter((i: any) => !only || only.has(String(i.value)));
    const out = infos.map((i: any) => i.symbol);
    if ((base || !out.length) && r.defaultSymbol) out.push(r.defaultSymbol);
    return out.filter(seen);
  }
  if (r.type === "class-breaks") return (r.classBreakInfos?.toArray?.() ?? r.classBreakInfos ?? []).map((i: any) => i.symbol).filter(seen);
  return [r.symbol].filter(seen);
}
type Rec = { title: string; dept: string } & ({ rows: [string, string][] } | { error: string } | { loading: true });

/** Каталогийн хэлтэс × цэс бүрийн засварлагчийн давхарга — хаягаар давхардалгүй */
function allTargets(allowed: Set<string>): Target[] {
  const seen = new Set<string>();
  const out: Target[] = [];
  for (const sc of CATALOG) {
    const dept = DEPARTMENTS.find((d) => d.slug === sc.scope);
    if (!dept || !allowed.has(dept.slug)) continue;
    for (const tab of sc.tabs)
      for (const t of editTargets(sc.scope, tab.id)) {
        const key = t.url.replace(/\/\d+$/, "");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...t, dept });
      }
  }
  return out;
}

type Meta = { oid: string; label: string | null; geo: "point" | "polygon" | "polyline"; pageSize: number };

async function metaOf(url: string, signal: AbortSignal): Promise<Meta> {
  const j = await arcgisJson<{
    objectIdField?: string;
    displayField?: string;
    geometryType?: string;
    maxRecordCount?: number;
    fields?: { name: string; type: string }[];
  }>(`${url}?f=json`, "Давхарга", { signal });
  const disp = j.fields?.find((f) => f.name === j.displayField && f.type === "esriFieldTypeString") ? j.displayField! : null;
  return {
    oid: j.objectIdField ?? "objectid",
    label: disp,
    geo: j.geometryType === "esriGeometryPolygon" ? "polygon" : j.geometryType === "esriGeometryPolyline" ? "polyline" : "point",
    pageSize: j.maxRecordCount || 2000,
  };
}

/** Нэг давхаргыг самбарынх нь хэвээр зурагт угсарна */
async function mountTarget(
  E: Esri,
  view: any,
  group: any,
  t: Target,
  markHost: HTMLElement,
  signal: AbortSignal,
  onPick: (t: Target, oid: number) => void,
) {
  const url = await layerUrl(t, signal);
  const [meta, look] = await Promise.all([metaOf(url, signal), lookFor(t)]);
  const isPoint = meta.geo === "point";
  const data: MapData = await loadMapData(url, { oid: meta.oid, label: meta.label, fields: look?.fields, point: isPoint, pageSize: meta.pageSize, signal });
  if (signal.aborted) return;
  const ld = lookDataOf(data);
  const zoom0 = mlOf(view.zoom);
  const pp: Partial<MapProps> =
    isPoint && look?.points
      ? look.points(ld, zoom0)
      : isPoint
        ? {
            cluster: data.points.oid.length > 3000,
            clusterMaxZoom: 14,
            labels: meta.label && data.points.oid.length <= 20_000 ? { text: data.labels, minzoom: 13 } : undefined,
          }
        : {};
  const shapeFn = look?.shape && !isPoint ? look.shape(ld) : null;
  const decor = look?.decor ? await look.decor(ld).catch(() => null) : null;
  if (signal.aborted) return;
  const own = isPoint
    ? []
    : data.shapes.features.map((f) => {
        const p = f.properties ?? {};
        const oid = Number(p.oid);
        const x = shapeFn?.(p, oid);
        return { ...f, properties: { oid, c: x?.c ?? null, t: x ? (x.t ?? null) : (p.t ?? null) } };
      });
  const shapeData: GeoJSON.FeatureCollection | null =
    own.length || decor?.shapes.length ? { type: "FeatureCollection", features: [...(decor?.shapes ?? []), ...own] } : null;
  const so = look?.shapeOpts ?? { edge: "thin" as const, labelZoom: 13 };
  const shapes = shapeData ? { ...so, color: so.color ?? t.color, labelZoom: decor?.labelZoom ?? so.labelZoom } : undefined;
  const mode: Mode = modeOf({ cluster: false, ...pp, shapes });

  /* ---- Самбарын давхаргууд, ДООРООС ДЭЭШ ---- */
  const L = dataLayers(E, mode);
  const overlays = (await look?.overlays?.().catch(() => [])) ?? [];
  if (signal.aborted) return;
  const ov = (above: boolean) =>
    overlays
      .filter((o) => Boolean(o.above) === above)
      .map((o) => {
        const fam = overlayFamily(o);
        const { renderer, feats, labelingInfo } = overlayParts(o, fam);
        return geoLayer(
          E,
          fam,
          [
            { name: "gridcode", type: "integer" },
            { name: "t", type: "string" },
          ],
          { renderer, ...(labelingInfo ? { labelingInfo, labelsVisible: true } : {}), ...(o.minzoom != null ? { minScale: scaleAt(o.minzoom) * 1.01 } : {}) },
          feats(),
        );
      });
  const inner = [...ov(false), L.shapePoly, L.shapeLine, L.points, ...ov(true), L.shapeLabels].filter(Boolean);
  for (const l of inner) {
    l.listMode = "hide";
    l.__target = t;
  }
  group.addMany(inner);

  const visible = Uint32Array.from(data.points.oid.map((_, i) => i));
  if (isPoint)
    fillPoints(E, view, L, mode, {
      points: data.points,
      visible,
      weights: pp.weights,
      grades: pp.grades,
      labels: pp.labels,
      colors: pp.colors,
      dotRank: pp.dots?.rank ? JSON.stringify(pp.dots.rank) : "",
    });
  if (shapeData) fillShapes(E, view, L, mode, shapeData, new Map());

  /* Таних тэмдгийн тэмдгүүд — дүрслэгдэж буй рендерерээс (дээрх тайлбар) */
  const symbols: { s: any; kind: "point" | "polygon" | "polyline" }[] = [];
  if (shapeData) {
    for (const [fam, layer] of [["polygon", L.shapePoly], ["polyline", L.shapeLine]] as const) {
      const fs = shapeData.features.filter((f) => familyOf(f.geometry) === fam);
      if (!fs.length || !layer) continue;
      const cs = new Set(fs.map((f) => f.properties?.c).filter((c): c is string => typeof c === "string"));
      symbols.push(...sampled(rendererSymbols(layer.renderer, cs, fs.some((f) => typeof f.properties?.c !== "string"))).map((s) => ({ s, kind: fam })));
    }
  }
  if (isPoint && !(pp.marks || pp.pulse))
    symbols.push(...sampled(rendererSymbols(mode.weighted ? L.dotRenderer : L.points?.renderer)).map((s) => ({ s, kind: "point" as const })));

  /* Нягтралын горим (нүхэн жорлон): хол — дулааны зураг, ойр — цэг */
  if (mode.weighted) {
    const zone = scaleAt(L.zDot - 0.3);
    E.reactive.watch(
      () => view.scale > zone,
      (far: boolean) => {
        if (L.points && !L.points.destroyed) L.points.renderer = far ? L.heatRenderer : L.dotRenderer;
      },
      { initial: true },
    );
  }

  /* ---- DOM тэмдэглэгээ (дохиолол, тэмдэг) — самбарын `markerEl` ---- */
  const marks = pp.marks;
  if (isPoint && (marks || pp.pulse)) {
    const { lon, lat, oid } = data.points;
    const wraps: HTMLElement[] = [];
    for (let i = 0; i < oid.length && wraps.length < MARKER_CAP; i++) {
      const id = oid[i];
      const mark = pp.pulse ? "pulse" : marks?.[id];
      if (!mark) continue;
      const el = markerEl(mark, () => onPick(t, id), undefined, pp.pulse ? pp.pulseColor?.(id) : undefined);
      const wrap = document.createElement("div");
      wrap.className = "wells-mark";
      wrap.dataset.lon = String(lon[i]);
      wrap.dataset.lat = String(lat[i]);
      wrap.appendChild(el);
      markHost.appendChild(wrap);
      wraps.push(wrap);
    }
    const show = () => {
      const on = group.visible && group.parent?.visible !== false && !(mode.cluster && mlOf(view.zoom) < mode.clusterMaxZoom);
      for (const w of wraps) w.hidden = !on;
    };
    E.reactive.watch(() => [group.visible, group.parent?.visible, view.zoom], show, { initial: true });
    placeMarks(view, markHost);
  }
  /* DOM тэмдэглэгээтэй давхарга — тэмдэглэгээний дээж (товшигдохгүй) */
  const markSample: HTMLElement[] = [];
  if (isPoint && (pp.marks || pp.pulse)) {
    const id = pp.pulse ? data.points.oid[0] : Number(Object.keys(pp.marks ?? {})[0]);
    const mark = pp.pulse ? "pulse" : pp.marks?.[id];
    if (mark) {
      const el = markerEl(mark, () => {}, undefined, pp.pulse ? pp.pulseColor?.(id) : undefined);
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      markSample.push(el);
    }
  }
  return { mode, count: data.points.oid.length || own.length, symbols, markSample };
}

/** Бүртгэлийн цонхонд тухайн давхаргын нэг мөр */
async function fetchRecord(t: Target, oid: number): Promise<[string, string][]> {
  const url = await layerUrl(t, new AbortController().signal);
  const j = await arcgisJson<{ fields?: { name: string; alias?: string; type: string }[]; features?: { attributes: Record<string, unknown> }[] }>(
    `${url}/query?${new URLSearchParams({ objectIds: String(oid), outFields: "*", returnGeometry: "false", f: "json" })}`,
    "Бүртгэл",
  );
  const a = j.features?.[0]?.attributes ?? {};
  const rows: [string, string][] = [];
  for (const f of j.fields ?? []) {
    const alias = f.alias || f.name;
    if (isSystemField(f.name, alias) || PRIVATE_FIELD.test(`${f.name} ${alias}`)) continue;
    const v = a[f.name];
    let text = v == null || v === "" ? "—" : String(v);
    if (f.type === "esriFieldTypeDate" && typeof v === "number" && v > 0) {
      const d = new Date(v);
      text = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
    } else if (typeof v === "number") text = num(v);
    rows.push([alias, text]);
  }
  return rows;
}

export function DataBank() {
  const holder = useRef<HTMLDivElement>(null);
  const markHost = useRef<HTMLDivElement>(null);
  const [legendHost, setLegendHost] = useState<HTMLDivElement | null>(null);
  const [basemap, setBasemap] = useState(defaultBasemap);
  const basemapRef = useRef(basemap);
  const mapGroups = useRef(new Map<string, { group: any; parent: any }>());
  const recordRequest = useRef(0);
  const [visible, setVisible] = useState(0);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [legend, setLegend] = useState<LegendRow[]>([]);
  const [progress, setProgress] = useState<[number, number]>([-1, 0]);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState("");
  const [rec, setRec] = useState<Rec | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [datasetsOpen, setDatasetsOpen] = useState(false);
  const { allows } = useAccess();
  const lang = useLang();
  /* Эрхтэй хэлтсүүд — түлхүүр болгож эффектийн хамаарал (ref-ийг зурагдалтад бичихгүй) */
  const allowedKey = DEPARTMENTS.filter((d) => allows(d.slug)).map((d) => d.slug).join(",");
  const targets = useMemo(() => allTargets(new Set(allowedKey.split(","))), [allowedKey]);
  const normalizedQuery = query.trim().toLocaleLowerCase("mn");
  const matches = targets.filter((t) => `${t.title} ${t.dept.name}`.toLocaleLowerCase("mn").includes(normalizedQuery));
  const groups = DEPARTMENTS.map((dept) => ({ dept, items: targets.filter((t) => t.dept.slug === dept.slug), matches: matches.filter((t) => t.dept.slug === dept.slug) })).filter((d) => d.matches.length > 0);

  useEffect(() => {
    const el = holder.current;
    const host = markHost.current;
    if (!el || !host) return;
    const mapRoot = el.parentElement as (HTMLElement & { __engine?: { E: Esri; view: any; map: any } }) | null;
    const ac = new AbortController();
    let view: any = null;
    const handles: { remove(): void }[] = [];
    const widgets: { destroy(): void }[] = [];
    const legendRows = new Map<string, LegendRow>();

    Promise.all([loadEsri(), esriModules<any[]>(WIDGETS)])
      .then(async ([E, [Expand, Measurement, symbolUtils]]) => {
        if (ac.signal.aborted) return;
        const map = new E.Map();
        const basemaps = esriBasemaps(E, map);
        map.basemap = basemaps.get(basemapRef.current.id);
        view = new E.MapView({
          container: el,
          map,
          center: [106.9, 47.9],
          scale: 600_000,
          constraints: { rotationEnabled: false },
          ui: { components: ["zoom", "attribution"] },
          popupEnabled: false,
        });
        await view.when();
        if (ac.signal.aborted) return;
        if (mapRoot) {
          mapRoot.__engine = { E, view, map };
          mapRoot.dispatchEvent(new CustomEvent("wells-ready", { bubbles: true, detail: mapRoot.__engine }));
        }
        handles.push(E.reactive.watch(() => [view.extent, view.updating], () => placeMarks(view, host), { initial: true }));

        /* ---- Хэлтэс бүр бүлэг, давхарга бүр дэд бүлэг ---- */
        const byDept = new Map<string, { group: any; items: { t: Target; group: any }[] }>();
        for (const t of targets) {
          let d = byDept.get(t.dept.slug);
          if (!d) {
            d = { group: new E.GroupLayer({ title: t.dept.name, visibilityMode: "independent" }), items: [] };
            byDept.set(t.dept.slug, d);
          }
          const g = new E.GroupLayer({ title: t.title, visibilityMode: "inherited", listMode: "hide-children", visible: isDefaultOn(t.url) });
          g.__target = t;
          d.items.push({ t, group: g });
          d.group.add(g);
          mapGroups.current.set(t.url, { group: g, parent: d.group });
        }
        map.addMany([...byDept.values()].map((d) => d.group));
        const count = () => {
          const keys = new Set<string>();
          for (const d of byDept.values()) if (d.group.visible) for (const it of d.items) if (it.group.visible) keys.add(it.t.url);
          setVisible(keys.size);
          setVisibleKeys(keys);
        };
        handles.push(E.reactive.watch(() => map.allLayers.items.map((l: any) => l.visible).join(), count));
        count();
        setReady(true);

        /* Esri өөрөө дүрс, нээх/хаах төлөв, байрлалыг удирдана.
           Таних тэмдгийн хүүхдүүд React portal-оор; гадна DOM нь SDK-ийнх. */
        const legendBox = document.createElement("div");
        legendBox.className = "data-bank-panel data-bank-legend";
        legendBox.setAttribute("aria-label", "Таних тэмдэг");
        const measureBox = measurePanel(view, Measurement, [["distance", "Зай"], ["area", "Талбай"]]);
        measureBox.classList.add("data-bank-panel");
        const nativeTools = [
          { content: legendBox, icon: "legend", label: "Таних тэмдэг" },
          { content: measureBox, icon: "measure", label: "Хэмжилт" },
        ].map(({ content, icon, label }) => new Expand({
          view, content, expandIcon: icon, expandTooltip: label, collapseTooltip: "Хаах",
          group: TOOL_GROUP, mode: "floating",
        }));
        nativeTools.forEach((component, index) => view.ui.add({ component, position: "top-right", index: index + 1 }));
        widgets.push(...nativeTools);
        setLegendHost(legendBox);
        handles.push(E.reactive.watch(() => nativeTools.some((tool) => tool.expanded), (isOpen: boolean) => {
          if (isOpen) { recordRequest.current += 1; setRec(null); }
        }));

        /* ---- Товшилт → бүртгэлийн цонх ---- */
        const pick = (t: Target, oid: number) => {
          if (oid >= DECOR || ac.signal.aborted) return;
          const request = ++recordRequest.current;
          nativeTools.forEach((tool) => tool.collapse());
          setRec({ title: t.title, dept: t.dept.name, loading: true });
          fetchRecord(t, oid)
            .then((rows) => { if (!ac.signal.aborted && request === recordRequest.current) setRec({ title: t.title, dept: t.dept.name, rows }); })
            .catch((e) => { if (!ac.signal.aborted && request === recordRequest.current) setRec({ title: t.title, dept: t.dept.name, error: reason(e) }); });
        };
        handles.push(
          view.on("click", async (e: any) => {
            const r = await view.hitTest(e);
            const g = r.results.find((x: any) => x.graphic?.layer?.__target && x.graphic.attributes?.oid != null);
            if (g) pick(g.graphic.layer.__target, Number(g.graphic.attributes.oid));
          }),
        );

        /* ---- Татац — анхнаасаа асаалттайг `PARALLEL`-аар; бусдыг асаахад л ---- */
        const items = [...byDept.values()].flatMap((d) => d.items);
        const pending = items.filter((it) => isDefaultOn(it.t.url));
        setProgress([0, pending.length]);
        let done = 0;
        const run = async (t: Target, g: any) => {
          try {
            const r = await mountTarget(E, view, g, t, host, ac.signal, pick);
            if (r && !ac.signal.aborted) {
              const previews = await Promise.all(
                /* Олон өнцөгт — ДӨРВӨЛЖИН дүүргэлт + хүрээ; шугам — зураас; цэг — зурагтай ижил хэмжээтэй дээж */
                r.symbols.map(({ s, kind }) =>
                  (symbolUtils.renderPreviewHTML(s, kind === "polygon" ? { size: 16, symbolConfig: { isSquareFill: true } } : kind === "polyline" ? { size: 22 } : { size: 12, maxSize: 22 }) as Promise<HTMLElement>).catch(() => null),
                ),
              );
              if (ac.signal.aborted) return;
              const swatches = [...r.markSample, ...previews.filter((x): x is HTMLElement => Boolean(x))];
              legendRows.set(t.url, { key: t.url, title: t.title, dept: t.dept.name, color: t.color ?? r.mode.fire.mid, swatches });
              setLegend([...legendRows.values()]);
            }
          } catch (e) {
            if (!ac.signal.aborted) {
              setFailed((n) => n + 1);
              console.warn(`Мэдээллийн сан: ${t.title} — ${reason(e)}`);
            }
          }
        };
        let next = 0;
        const worker = async () => {
          while (next < pending.length && !ac.signal.aborted) {
            const it = pending[next++];
            await run(it.t, it.group);
            done += 1;
            if (!ac.signal.aborted) setProgress([done, pending.length]);
          }
        };
        for (const it of items)
          if (!isDefaultOn(it.t.url))
            handles.push(
              E.reactive.when(
                () => it.group.visible,
                () => void run(it.t, it.group),
                { once: true },
              ),
            );
        await Promise.all(Array.from({ length: PARALLEL }, worker));
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setError(reason(e));
      });
    return () => {
      ac.abort();
      recordRequest.current += 1;
      handles.forEach((h) => h.remove());
      widgets.forEach((w) => w.destroy());
      mapGroups.current.clear();
      host.replaceChildren();
      if (mapRoot && mapRoot.__engine?.view === view) delete mapRoot.__engine;
      view?.destroy();
    };
  }, [targets]);

  const legendByDept = new Map<string, LegendRow[]>();
  for (const r of legend) if (visibleKeys.has(r.key)) legendByDept.set(r.dept, [...(legendByDept.get(r.dept) ?? []), r]);
  const loading = !error && (progress[0] < 0 || progress[0] < progress[1]);
  const closeRecord = () => {
    recordRequest.current += 1;
    setRec(null);
    holder.current?.querySelector<HTMLElement>(".esri-view-surface")?.focus();
  };
  const setLayerVisible = (target: Target, checked: boolean) => {
    const item = mapGroups.current.get(target.url);
    if (!item) return;
    if (checked) item.parent.visible = true;
    item.group.visible = checked;
  };

  return (
    <div className="data-bank-workspace">
      <aside className="dataset-panel data-bank-datasets" data-open={datasetsOpen} aria-label="Давхаргын өгөгдлийн багц">
        <header className="dataset-panel-heading">
          <span className="dataset-panel-symbol"><Database size={18} strokeWidth={1.6} aria-hidden /></span>
          <h2>Давхаргууд</h2>
          <span className="dataset-panel-count num" title="Нийт давхарга">{targets.length}</span>
          <button className="data-bank-datasets-expand" type="button" aria-label="Өгөгдлийн багцын жагсаалт" aria-expanded={datasetsOpen} aria-controls="data-bank-dataset-list" onClick={() => setDatasetsOpen((value) => !value)}><ChevronDown size={17} aria-hidden /></button>
        </header>
        <div className="data-bank-datasets-body" id="data-bank-dataset-list">
          <div className="dataset-panel-search">
            <Search size={15} aria-hidden />
            <input type="search" aria-label="Өгөгдлийн багц хайх" placeholder="Өгөгдөл хайх…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <button type="button" aria-label="Хайлт цэвэрлэх" onClick={() => setQuery("")}><X size={14} aria-hidden /></button>}
          </div>
          <div className="dataset-panel-list" aria-label="Давхаргууд">
            {groups.map(({ dept, items, matches: rows }) => {
              const selected = items.filter((t) => visibleKeys.has(t.url)).length;
              const isExpanded = Boolean(normalizedQuery) || (expanded[dept.slug] ?? false);
              return (
                <section key={dept.slug} className="dataset-panel-section" data-department={dept.slug}>
                  {/* ХЭЛТЭС ТОВЧ НЭРЭЭР, АРД НЬ ЧАГТ БАЙХГҮЙ (хэрэглэгч 2026-11-12: "bugd
                      towchilson nereer ar taliin check temdegiig aw") — бүтэн нэр `title`-д;
                      хэлтсийг бүхэлд нь асаах, унтраах нь давхаргын чагтуудаар */}
                  <button type="button" className={cn("dataset-panel-group", selected > 0 && "is-holding")} title={dept.name} aria-expanded={isExpanded} aria-controls={`data-bank-department-${dept.slug}`} onClick={() => setExpanded((current) => ({ ...current, [dept.slug]: !isExpanded }))}>
                    <dept.icon size={18} strokeWidth={1.5} className="dataset-panel-item-icon" aria-hidden />
                    <span className="dataset-panel-copy"><strong>{lang === "en" ? SHORT_EN[dept.slug] : SHORT_NAMES[dept.slug]}</strong><span><span className="num">{selected} / {items.length}</span> давхарга асаалттай</span></span>
                    <ChevronDown size={14} className={cn("dataset-panel-chevron", !isExpanded && "-rotate-90")} aria-hidden />
                  </button>
                  <div className="dataset-panel-children" id={`data-bank-department-${dept.slug}`} hidden={!isExpanded}>
                    {/* Чагтгүй (хэрэглэгч 2026-11-12: "check temdegiig aw") — мөр өөрөө сэлгэнэ,
                        асаалттай нь `is-selected` дэвсгэрээр */}
                    {rows.map((t) => (
                      <button key={t.url} type="button" className={cn("dataset-panel-item data-bank-layer-row", visibleKeys.has(t.url) && "is-selected")} aria-pressed={visibleKeys.has(t.url)} disabled={!ready} onClick={() => setLayerVisible(t, !visibleKeys.has(t.url))}>
                        <Layers3 size={16} strokeWidth={1.5} className="dataset-panel-item-icon" aria-hidden />
                        <span className="dataset-panel-copy"><strong>{t.title}</strong></span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {!matches.length && <p className="dataset-no-results" role="status">Тохирох өгөгдлийн багц олдсонгүй.</p>}
          </div>
          <footer className="dataset-panel-footer"><span className="num">{visible} / {targets.length}</span> давхарга асаалттай{normalizedQuery && <span> · <span className="num">{matches.length}</span> илэрц</span>}</footer>
        </div>
      </aside>
    <div className="wells-esri data-bank" onKeyDown={(e) => {
      if (e.key !== "Escape") return;
      if (rec) closeRecord();
    }}>
      <div ref={holder} className="absolute inset-0" />
      <div ref={markHost} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />
      {(error || loading || failed > 0) && (
        <div className="data-bank-status" data-error={Boolean(error || failed)} role="status">
          {error ? <CircleAlert size={15} aria-hidden /> : loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <CircleAlert size={15} aria-hidden />}
          <div>
            {error || (loading ? <>Давхарга ачаалж байна{progress[1] > 0 && <span className="num">{progress[0]} / {progress[1]}</span>}</> : "Зарим давхарга ачаалагдсангүй")}
            {failed > 0 && <small><span className="num">{failed}</span> давхаргын өгөгдөл авах боломжгүй байна.</small>}
          </div>
          {loading && progress[1] > 0 && <span className="data-bank-progress" style={{ width: `${progress[0] / progress[1] * 100}%` }} />}
        </div>
      )}

      {rec && (
        <section className="data-bank-record elevated" aria-label="Бүртгэлийн дэлгэрэнгүй">
          <header>
            <div>
              <span className="data-bank-record-dept">{rec.dept}</span>
              <h3>{rec.title}</h3>
            </div>
            <button type="button" aria-label="Бүртгэлийн цонх хаах" onClick={closeRecord}><X size={17} aria-hidden /></button>
          </header>
          {"error" in rec ? (
            <p className="px-3 py-3 text-[11px] text-clay">{rec.error}</p>
          ) : "loading" in rec ? (
            <p className="data-bank-empty" role="status"><Loader2 size={15} className="animate-spin" aria-hidden />Ачаалж байна</p>
          ) : rec.rows.length ? (
            <dl>
              {rec.rows.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd className={cn(v !== "—" && /^[\d,.\s%-]+$/.test(v) && "num", v === "—" && "text-ink-3")}>{v}</dd></div>
              ))}
            </dl>
          ) : (
            <p className="data-bank-empty">Харуулах дэлгэрэнгүй мэдээлэл байхгүй байна.</p>
          )}
        </section>
      )}

      {!rec && !loading && !error && !failed && <p className="data-bank-hint"><MousePointer2 size={13} aria-hidden />Тэмдэг дээр дарж мэдээлэл харна уу</p>}
    </div>
    <BasemapGallery value={basemap} group={TOOL_GROUP} index={0} mode="floating" onChange={(value) => { basemapRef.current = value; setBasemap(value); }} onExpandedChange={(isOpen) => { if (isOpen) { recordRequest.current += 1; setRec(null); } }} />
    {legendHost && createPortal(<>
      <h3 className="data-bank-legend-title">Таних тэмдэг</h3>
      {legendByDept.size === 0 && <p className="data-bank-empty">{loading && visible > 0 ? "Таних тэмдэг ачаалж байна…" : "Асаалттай, ачаалагдсан давхарга байхгүй байна."}</p>}
      {[...legendByDept].map(([dept, rows]) => (
        <section key={dept}>
          <h4>{dept}<span className="num">{rows.length}</span></h4>
          {rows.map((r) => (
            <div key={r.key}>
              {r.swatches.length ? (
                <span className="data-bank-swatch" aria-hidden ref={(n) => { if (n) n.replaceChildren(...r.swatches); }} />
              ) : (
                <i style={{ background: r.color }} aria-hidden />
              )}
              <span className="min-w-0">{r.title}</span>
            </div>
          ))}
        </section>
      ))}
    </>, legendHost)}
    </div>
  );
}
