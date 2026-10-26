"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ирдэг тул төрөлгүй */

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Crosshair,
  Loader2,
  Lock,
  MapPin,
  MapPinPlus,
  MousePointer2,
  PencilLine,
  PenTool,
  Search,
  Shapes,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { esriModules } from "@/lib/arcgis-sdk";
import { getToken } from "@/lib/auth";
import { getDepartment } from "@/lib/departments";
import type { EditForm, EditTarget } from "@/lib/edit-targets";
import { isSystemField, officialLabel } from "@/lib/portal-layers";
import { cn, num } from "@/lib/utils";
import { BASEMAPS, WellsMap, defaultBasemap, type Basemap, type Extent, type MapOverlay } from "@/components/wells/map";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { DISTRICT_CODE, installToken, layerUrl, loadMapData, placeAt, reason, type MapData, type Place } from "./esri-edit";
import { EditorHead, type EditSource } from "./editor-head";
import { AddField } from "./add-field";
import { DECOR, lookFor, type Look, type LookData, type MapProps } from "./looks";

/*
  ӨГӨГДӨЛ ЗАСАХ ЦОНХ — зургаан хэлтсийн бүх давхаргад нэг загвар (хэрэглэгч
  2026-10-21; саармагжуулалт дээр туршиж баталсны дараа — "bolson bn").

  · ЗУРАГ нь самбарынх ({@link WellsMap}) — тэмдэг, суурь зураг, хил ижил;
    давхарга бүрийн онцлог (`form.map`, `EditTarget.color`).
  · Зургийн дээд буланд хэрэгсэл: "Сонгох" · "Цэг нэмэх" (цэгэн давхарга) эсвэл
    "Дүрс зурах" (олон өнцөгт, шугам — Esri `SketchViewModel`).
  · Зургийн доор БҮРТГЭЛИЙН ХҮСНЭГТ — мөр дээр хулгана очиход бүртгэл ШАРААР
    тодорно (`hotMark`), дарахад сонгогдож ойртоно. Том давхаргад сүүлийн
    `TABLE_LIMIT` бүртгэл, хайлт нь СЕРВЕР дээр.
  · Баруун талд маягт: дээр нь БАЙРШИЛ (цэг — уртраг, өргөрөг; дүрс — талбай,
    урт), дүүрэг · хороо автоматаар; доор нь хэрэглэгч бөглөх талбарууд.
  · ХУУЧИН БҮРТГЭЛ ТҮГЖЭЭТЭЙ — "Засварлах" дарахад сануулга, баталгаажуулсны
    дараа л засагдана.

  ⚠ ХЭРЭГЛЭГЧ БӨГЛӨХГҮЙ ТАЛБАР ГАРАХГҮЙ: системийн (`isSystemField`),
  засварлах боломжгүй, засварлагч мөрдөх, координатын (геометрээс), засаг
  захиргааны (байршлаас) ба бүртгэлийн `form.hide`.
  ⚠ Геометр давхаргын өөрийн координатын систем рүү `projectOperator`-оор;
  шинэчлэхэд ЗӨВХӨН өөрчлөгдсөн талбар илгээгдэнэ.
*/

type Kind = "string" | "number" | "integer" | "date" | "select";
type Field = {
  name: string;
  label: string;
  kind: Kind;
  length?: number;
  required: boolean;
  options?: { code: string | number; name: string }[];
  wide: boolean;
};
type Row = { oid: number; lon: number | null; lat: number | null; a: Record<string, unknown> };
type Geo = "point" | "polygon" | "polyline";
type PlaceSpec = { district?: string; khoroo?: string; khorooNum?: boolean; code?: string };
type Meta = {
  url: string;
  oidField: string;
  displayField: string | null;
  fields: Field[];
  geo: Geo;
  coords: { lon: string; lat: string } | null;
  place: PlaceSpec | null;
  canAdd: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  count: number;
  pageSize: number;
  /** Давхаргын БҮХ талбар — "Мөр нэмэх"-д давхардлаас сэргийлнэ */
  allFields: { name: string; alias: string }[];
};
type Draft = {
  oid: number | null;
  values: Record<string, string>;
  orig: Record<string, string>;
  /** Цэг — WGS84 бичвэр */
  lon: string;
  lat: string;
  /** Дүрс — зургийн (Web Mercator) Esri геометр */
  geom: any | null;
  measure: string | null;
  moved: boolean;
  place: Place | null | "loading" | undefined;
  /** Хуучин бүртгэл анх ТҮГЖЭЭТЭЙ — сануулгыг баталгаажуулсны дараа л засагдана */
  locked: boolean;
};

const TABLE_LIMIT = 500;
const EDITOR_FIELD = /^(Creator|Editor|CreationDate|EditDate|created_(user|date)|last_edited_(user|date))$/i;
/* Шейпфайлын 10 тэмдэгтэд тасарсан нэр ("уртра", "өргөр") ч орно */
const LON_FIELD = /^(уртра(г)?|уртраг__x__wgs84_|longitude|lon_?dd)$/i;
const LAT_FIELD = /^(өргөр(өг)?|өргөрөг__y__wgs84_|latitude|lat_?dd)$/i;
/** Координатын эх бичвэр (`уртраг_эх_бичлэг`) — хэрэглэгч бөглөхгүй */
const COORD_TEXT = /^(уртраг|өргөрөг).*эх/i;
const DISTRICT_FIELD = /^(duureg|дүүрэг|district|сум__дүүрэг)$/i;
const KHOROO_FIELD = /^(horoo|khoroo|хороо|баг__хороо|khorooid)$/i;
const CODE_FIELD = /^kh_mon$/i;
/** Орон зайн нэгтгэлийн үлдэц (`join_count_1`, `target_fid_1`, `F_`) */
const JOIN_FIELD = /^((join_count|target_fid|orig_fid|join_fid)(_\d+)?|f_)$/i;
/** KML-ээс хөрвүүлсэн давхаргын үлдэц — хэрэглэгч бөглөхгүй */
const KML_FIELD = /^(SymbolID|AltMode|Base|Clamped|Extruded|Snippet|PopupInfo|Folder|FolderPath)$/i;
const NUMERIC = new Set(["double", "single", "integer", "small-integer", "big-integer"]);

function kindOf(f: any): Kind | null {
  if (f.domain?.type === "coded-value") return "select";
  switch (f.type) {
    case "string":
      return "string";
    case "double":
    case "single":
      return "number";
    case "integer":
    case "small-integer":
    case "big-integer":
      return "integer";
    case "date":
    case "date-only":
      return "date";
    default:
      return null;
  }
}

/** Координатын талбар — бүртгэлийн `form.coords`, эс бөгөөс нэр, alias-аар (зөвхөн цэгэн давхаргад) */
function coordsOf(layer: any, form: EditForm | undefined, geo: Geo) {
  if (form?.coords) return form.coords;
  if (geo !== "point") return null;
  const find = (re: RegExp, word: RegExp) =>
    (layer.fields ?? []).find((f: any) => NUMERIC.has(f.type) && f.editable && (re.test(f.name) || word.test(f.alias ?? "")))?.name;
  const lon = find(LON_FIELD, /^уртра(г)?(\s*\(.*\))?$/i);
  const lat = find(LAT_FIELD, /^өргөр(өг)?(\s*\(.*\))?$/i);
  return lon && lat ? { lon, lat } : null;
}

/**
 * Засаг захиргааны талбар — байршлаас бөглөгдөнө. ЗӨВХӨН ЦЭГЭН давхаргад
 * (эсвэл бүртгэлийн `form.place`): олон өнцөгт олон дүүрэгт хамаарч болно
 * (ТХГН — "Баянзүрх, Налайх …"), тэнд хэрэглэгч өөрөө бөглөнө.
 */
function placeOf(layer: any, form: EditForm | undefined, geo: Geo): PlaceSpec | null {
  if (!form?.place && geo !== "point") return null;
  const fields: any[] = layer.fields ?? [];
  const by = (re: RegExp, ok: (f: any) => boolean = () => true) =>
    fields.find((f) => f.editable && re.test(f.name) && ok(f));
  const spec = form?.place ?? {
    district: by(DISTRICT_FIELD, (f) => f.type === "string" && !/төсөл/i.test(f.alias ?? ""))?.name,
    khoroo: by(KHOROO_FIELD, (f) => f.type === "string" || NUMERIC.has(f.type))?.name,
    code: by(CODE_FIELD, (f) => f.type === "string")?.name,
  };
  if (!spec.district && !spec.khoroo && !spec.code) return null;
  const k = spec.khoroo ? fields.find((f) => f.name === spec.khoroo) : null;
  return { ...spec, khorooNum: Boolean(k && NUMERIC.has(k.type)) };
}

function formFields(layer: any, form: EditForm | undefined, coords: Meta["coords"], place: PlaceSpec | null): Field[] {
  const skip = new Set([coords?.lon, coords?.lat, place?.district, place?.khoroo, place?.code].filter(Boolean) as string[]);
  const out: Field[] = [];
  for (const f of layer.fields ?? []) {
    if (!f.editable || f.type === "oid" || f.type === "global-id" || f.type === "geometry") continue;
    if (skip.has(f.name) || isSystemField(f.name, f.alias ?? "") || EDITOR_FIELD.test(f.name) || KML_FIELD.test(f.name) || JOIN_FIELD.test(f.name)) continue;
    if (coords && COORD_TEXT.test(f.name)) continue;
    if (form?.hide?.test(f.name)) continue;
    const kind = kindOf(f);
    if (!kind) continue;
    out.push({
      name: f.name,
      label: officialLabel(f.alias || f.name),
      kind,
      length: f.length,
      required: f.nullable === false,
      options: kind === "select" ? f.domain.codedValues.map((c: any) => ({ code: c.code, name: c.name })) : undefined,
      wide: kind === "string" && (f.length ?? 0) > 60,
    });
  }
  return out;
}

const text = (v: unknown, kind: Kind): string => {
  if (v == null) return "";
  if (kind === "date") return Number.isFinite(Number(v)) ? new Date(Number(v)).toISOString().slice(0, 10) : "";
  return String(v);
};

/** Маягтын утга → давхаргын утга; алдаатай бол мэдэгдэл */
function parse(f: Field, s: string): { value: unknown; error?: string } {
  const t = s.trim();
  if (!t) return f.required ? { value: null, error: "Заавал бөглөнө" } : { value: null };
  if (f.kind === "number" || f.kind === "integer") {
    const n = Number(t.replace(",", "."));
    if (!Number.isFinite(n)) return { value: null, error: "Тоон утга биш" };
    if (f.kind === "integer" && !Number.isInteger(n)) return { value: null, error: "Бүхэл тоо байна" };
    return { value: n };
  }
  if (f.kind === "date") {
    const ms = Date.parse(`${t}T00:00:00Z`);
    return Number.isFinite(ms) ? { value: ms } : { value: null, error: "Огноо буруу" };
  }
  if (f.kind === "select") {
    const opt = f.options?.find((o) => String(o.code) === t);
    return { value: opt ? opt.code : t };
  }
  if (f.length && t.length > f.length) return { value: null, error: `${f.length} тэмдэгтээс урт` };
  return { value: t };
}

const coord = (s: string, lo: number, hi: number) => {
  const n = Number(s.trim().replace(",", "."));
  return s.trim() && Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const LON = [87, 120] as const;
const LAT = [41, 52.5] as const;

/** Хадгалах утга — тухайн давхаргын ОДОО БАЙГАА бичиглэлийг дагана */
function placeAttrs(p: Place | null, spec: PlaceSpec, rows: Row[]): Record<string, unknown> {
  const sample = (name: string) => rows.map((r) => r.a[name]).find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const out: Record<string, unknown> = {};
  if (spec.district) {
    const s = sample(spec.district)?.trim();
    out[spec.district] = !p
      ? null
      : s && /^[А-ЯӨҮЁ]{2,3}$/.test(s)
        ? (DISTRICT_CODE[p.district] ?? p.district)
        : s && !/дүүрэг$/i.test(s)
          ? p.district
          : `${p.district} дүүрэг`;
  }
  if (spec.khoroo) {
    const k = p?.khoroo ?? null;
    const s = sample(spec.khoroo)?.trim();
    out[spec.khoroo] =
      k == null ? null : spec.khorooNum ? k : s && /^\d+$/.test(s) ? (s.length === 2 ? String(k).padStart(2, "0") : String(k)) : `${k}-р хороо`;
  }
  if (spec.code) out[spec.code] = p?.code ?? null;
  return out;
}

/*
  ХЭМЖЭЭ ӨӨРЧЛӨХ (хэрэглэгч 2026-10-21: "baruun bolon doorh paneliig resize
  hiideg bolgo"): баруун маягтын өргөн, доорх хүснэгтийн өндөр. Утга нь CSS
  хувьсагчид (`--pe-form-w`, `--pe-table-h`) шууд бичигдэнэ — чирэх бүрд
  React дахин зурахгүй (хажуугийн зурвасын `--rail-w`-тэй нэг зарчим);
  `localStorage`-д хадгалагдаж, давхар товшилт анхныхад буцаана.
*/
const SIZE_KEYS = {
  col: { css: "--pe-form-w", store: "pe.formw" },
  row: { css: "--pe-table-h", store: "pe.tableh" },
} as const;

function Splitter({ axis, body }: { axis: "col" | "row"; body: React.RefObject<HTMLDivElement | null> }) {
  const k = SIZE_KEYS[axis];
  const start = (e: React.PointerEvent<HTMLDivElement>) => {
    const root = body.current;
    if (!root || e.button !== 0) return;
    const form = root.querySelector<HTMLElement>(".pe-form");
    const main = root.querySelector<HTMLElement>(".pe-main");
    const table = root.querySelector<HTMLElement>(".pe-table");
    if (!form || !main || !table) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.classList.add("is-drag");
    /* Чирэх явцад зургийн (Esri) курсор, сонголт ажиллахгүй */
    document.body.style.cursor = axis === "col" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    const x0 = e.clientX;
    const y0 = e.clientY;
    const w0 = form.getBoundingClientRect().width;
    const h0 = table.getBoundingClientRect().height;
    const W = root.getBoundingClientRect().width;
    const H = main.getBoundingClientRect().height;
    let value = "";
    const move = (ev: PointerEvent) => {
      const n =
        axis === "col"
          ? Math.min(Math.max(w0 + (x0 - ev.clientX), 300), W - 420)
          : Math.min(Math.max(h0 + (y0 - ev.clientY), 120), H - 160);
      value = `${Math.round(n)}px`;
      root.style.setProperty(k.css, value);
    };
    const up = () => {
      handle.classList.remove("is-drag");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      try {
        if (value) localStorage.setItem(k.store, value);
      } catch {}
    };
    /* Цонхон дээр (capture) — хулгана зураг, хүснэгт дээгүүр гарсан ч дагана */
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  };
  const reset = () => {
    body.current?.style.removeProperty(k.css);
    try {
      localStorage.removeItem(k.store);
    } catch {}
  };
  return (
    <div
      role="separator"
      aria-orientation={axis === "col" ? "vertical" : "horizontal"}
      className={cn("pe-split", axis === "col" ? "is-col" : "is-row")}
      onPointerDown={start}
      onDoubleClick={reset}
      aria-label={axis === "col" ? "Маягтын өргөн" : "Хүснэгтийн өндөр"}
    />
  );
}

/** Цэгийн эргэн тойрон ~400 м — сонгосон цэг рүү ойртох хүрээ */
const around = (lon: number, lat: number): Extent => [lon - 0.004, lat - 0.0027, lon + 0.004, lat + 0.0027];
/** Дүрсийн хүрээ — жижиг дүрсэд ч ~200 м-ээс багагүй */
const padBox = ([w, s, e, n]: Extent): Extent => {
  const dx = Math.max((e - w) * 0.15, 0.0015);
  const dy = Math.max((n - s) * 0.15, 0.001);
  return [w - dx, s - dy, e + dx, n + dy];
};

const placeText = (p: Place) => [`${p.district} дүүрэг`, p.khoroo != null ? `${p.khoroo}-р хороо` : null].filter(Boolean).join(" · ");

const UNIT: Record<Geo, string> = { point: "цэг", polygon: "талбай", polyline: "шугам" };

/** Зургийн дата → самбарын хэвд өгөх оролт ({@link LookData}) */
function lookDataOf(m: MapData): LookData {
  if (m.kind === "point") return { oid: m.points.oid, attrs: m.attrs, lon: m.points.lon, lat: m.points.lat };
  return {
    oid: m.shapes.features.map((f) => Number(f.properties?.oid)),
    attrs: m.shapes.features.map((f) => f.properties ?? {}),
    lon: [],
    lat: [],
  };
}

/** SQL-ийн бичвэр — хашилтыг давхарлана */
const sq = (s: string) => s.replace(/'/g, "''");

export function DataEditor({
  source,
  targets,
  startAdd,
  onClose,
}: {
  source: EditSource;
  targets: EditTarget[];
  /** "Шинэ бүртгэл нэмэх" товчоор нээгдсэн — бэлэн болмогц шууд нэмэх горимд орно. */
  startAdd?: boolean;
  onClose: (changed: boolean) => void;
}) {
  const esri = React.useRef<any>(null);
  const changed = React.useRef(false);
  const placeAc = React.useRef<AbortController | null>(null);
  const mapBox = React.useRef<HTMLDivElement>(null);
  const body = React.useRef<HTMLDivElement>(null);

  const [active, setActive] = React.useState(0);
  const target = targets[active];
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [mapData, setMapData] = React.useState<MapData | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [matched, setMatched] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "ready">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"select" | "add" | "move" | "draw" | "reshape">("select");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [confirmEdit, setConfirmEdit] = React.useState(false);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());
  const [focus, setFocus] = React.useState<Extent | null>(null);
  const [mapKey, setMapKey] = React.useState(0);
  /* Самбарын зургийн хэв ({@link lookFor}) ба түүний чимэглэл, нэмэлт давхарга */
  const [look, setLook] = React.useState<Look | null>(null);
  const [decor, setDecor] = React.useState<{ shapes: GeoJSON.Feature[]; labelZoom?: number } | null>(null);
  const [overlays, setOverlays] = React.useState<MapOverlay[] | undefined>(undefined);
  const [zoom, setZoom] = React.useState(0);
  const [basemapUser, setBasemapUser] = React.useState(false);
  /* "Мөр нэмэх"-ийн дараа давхаргыг дахин уншина */
  const [reload, setReload] = React.useState(0);

  /* Хадгалсан хэмжээ — эхний зурагдалтаас өмнө */
  React.useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    for (const k of Object.values(SIZE_KEYS)) {
      try {
        const v = localStorage.getItem(k.store);
        if (v) el.style.setProperty(k.css, v);
      } catch {}
    }
  }, []);

  /* Хүснэгт — сүүлийн `TABLE_LIMIT` бүртгэл; хайлт сервер дээр */
  const loadRows = React.useCallback(async (q: string, m: Meta) => {
    const e = esri.current;
    if (!e?.layer) return [] as Row[];
    const t = q.trim();
    let where = "1=1";
    if (t) {
      const parts = m.fields.filter((f) => f.kind === "string").map((f) => `UPPER(${f.name}) LIKE '%${sq(t.toUpperCase())}%'`);
      if (m.place?.district) parts.push(`UPPER(${m.place.district}) LIKE '%${sq(t.toUpperCase())}%'`);
      if (/^\d+$/.test(t)) parts.push(`${m.oidField} = ${t}`);
      where = parts.length ? parts.join(" OR ") : "1=0";
    }
    const [res, n] = await Promise.all([
      e.layer.queryFeatures({
        where,
        outFields: ["*"],
        returnGeometry: m.geo === "point",
        outSpatialReference: { wkid: 4326 },
        orderByFields: [`${m.oidField} DESC`],
        num: TABLE_LIMIT,
      }),
      e.layer.queryFeatureCount({ where }),
    ]);
    const list: Row[] = res.features.map((g: any) => ({
      oid: g.attributes[m.oidField],
      lon: g.geometry?.x ?? null,
      lat: g.geometry?.y ?? null,
      a: g.attributes,
    }));
    setRows(list);
    setMatched(n);
    return list;
  }, []);

  const loadMap = React.useCallback(async (m: Meta, signal: AbortSignal, lk: Look | null) => {
    const data = await loadMapData(m.url, {
      oid: m.oidField,
      label: m.displayField,
      fields: lk?.fields,
      point: m.geo === "point",
      pageSize: m.pageSize,
      signal,
    });
    if (signal.aborted) return data;
    setMapData(data);
    if (lk?.decor)
      void lk
        .decor(lookDataOf(data))
        .then((x) => !signal.aborted && setDecor(x))
        .catch(() => undefined);
    return data;
  }, []);

  /* Давхарга — идэвхтэй давхарга солигдоход дахин уншина. `FeatureLayer` нь
     зөвхөн асуулга, засварт (зургийг самбарын бүрэлдэхүүн зурна) */
  React.useEffect(() => {
    const ac = new AbortController();
    const timer = window.setInterval(() => void getToken(), 60_000);

    (async () => {
      await getToken();
      const [esriConfig, FeatureLayer, GraphicsLayer, SketchViewModel, projectOperator, areaOp, lengthOp, Point, Graphic] = await esriModules<any[]>([
        "esri/config",
        "esri/layers/FeatureLayer",
        "esri/layers/GraphicsLayer",
        "esri/widgets/Sketch/SketchViewModel",
        "esri/geometry/operators/projectOperator",
        "esri/geometry/operators/geodeticAreaOperator",
        "esri/geometry/operators/geodeticLengthOperator",
        "esri/geometry/Point",
        "esri/Graphic",
      ]);
      if (ac.signal.aborted) return;
      installToken(esriConfig);
      const url = await layerUrl(target, ac.signal);
      if (ac.signal.aborted) return;
      const layer = new FeatureLayer({ url, title: target.title, outFields: ["*"] });
      await layer.load().catch((e: any) => {
        throw new Error(`${target.title}: ${reason(e)}`);
      });
      await Promise.all([projectOperator.load(), areaOp.load?.(), lengthOp.load?.()].filter(Boolean));
      if (ac.signal.aborted) return;
      const ops = layer.capabilities?.operations ?? {};
      const editing = layer.editingEnabled !== false && ops.supportsEditing;
      const geo: Geo = layer.geometryType === "polygon" ? "polygon" : layer.geometryType === "polyline" ? "polyline" : "point";
      const coords = coordsOf(layer, target.form, geo);
      const place = placeOf(layer, target.form, geo);
      const disp = layer.fields?.find((f: any) => f.name === layer.displayField && f.type === "string") ? layer.displayField : null;
      const m: Meta = {
        url,
        oidField: layer.objectIdField,
        displayField: disp,
        fields: formFields(layer, target.form, coords, place),
        geo,
        coords,
        place,
        canAdd: Boolean(editing && ops.supportsAdd),
        canUpdate: Boolean(editing && ops.supportsUpdate),
        canDelete: Boolean(editing && ops.supportsDelete),
        count: 0,
        pageSize: layer.sourceJSON?.maxRecordCount || 2000,
        allFields: (layer.fields ?? []).map((f: any) => ({ name: String(f.name), alias: String(f.alias ?? f.name) })),
      };
      esri.current = { layer, projectOperator, areaOp, lengthOp, GraphicsLayer, SketchViewModel, Point, Graphic };
      setMeta(m);
      const lk = (await lookFor(target)) ?? null;
      if (ac.signal.aborted) return;
      setLook(lk);
      lk?.overlays?.()
        .then((o) => !ac.signal.aborted && setOverlays(o.length ? o : undefined))
        .catch(() => undefined);
      await Promise.all([loadRows("", m), loadMap(m, ac.signal, lk)]);
      if (ac.signal.aborted) return;
      setStatus("ready");
    })().catch((e: any) => {
      if (!ac.signal.aborted) {
        setError(e?.message ?? "Засварын цонх нээгдсэнгүй");
        setStatus("ready");
      }
    });

    return () => {
      ac.abort();
      window.clearInterval(timer);
      const e = esri.current;
      e?.sketch?.destroy?.();
      esri.current = null;
    };
  }, [target, loadRows, loadMap, reload]);

  /* Хайлт — 300 мс-ийн дараа сервер рүү */
  React.useEffect(() => {
    if (!meta || status !== "ready") return;
    const t = window.setTimeout(() => void loadRows(query, meta).catch(() => undefined), 300);
    return () => window.clearTimeout(t);
  }, [query, meta, status, loadRows]);

  const geo = meta?.geo ?? "point";
  const isPoint = geo === "point";
  const dLon = draft ? coord(draft.lon, ...LON) : null;
  const dLat = draft ? coord(draft.lat, ...LAT) : null;
  const isNew = draft?.oid == null;

  /* Зураг — самбарын бүрэлдэхүүн, самбарын хэвээр ({@link lookFor}) */
  const points = React.useMemo(() => (mapData && isPoint ? mapData.points : { oid: [], lon: [], lat: [] }), [mapData, isPoint]);
  const visible = React.useMemo(() => Uint32Array.from(points.oid.map((_, i) => i)), [points]);
  const rowsByOid = React.useMemo(() => new Map(rows.map((r) => [r.oid, r])), [rows]);
  const lookData = React.useMemo(() => (mapData ? lookDataOf(mapData) : null), [mapData]);
  const zoomDep = look?.zoomAware ? zoom : 0;
  const pointProps = React.useMemo<Partial<MapProps>>(() => {
    if (!mapData || !isPoint || !lookData) return {};
    if (look?.points) return look.points(lookData, zoomDep);
    return {
      cluster: points.oid.length > 3000,
      clusterMaxZoom: 14,
      labels: meta?.displayField && points.oid.length <= 20_000 ? { text: mapData.labels, minzoom: 13 } : undefined,
    };
  }, [mapData, isPoint, lookData, look, zoomDep, points, meta]);
  const shapeFn = React.useMemo(() => (look?.shape && lookData && !isPoint ? look.shape(lookData) : null), [look, lookData, isPoint]);
  const shapeData = React.useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!mapData) return null;
    const own = isPoint
      ? []
      : mapData.shapes.features.map((f) => {
          const p = f.properties ?? {};
          const oid = Number(p.oid);
          const x = shapeFn?.(p, oid);
          return { ...f, properties: { oid, c: x?.c ?? null, t: x ? (x.t ?? null) : (p.t ?? null) } };
        });
    if (!own.length && !look?.decor) return null;
    return { type: "FeatureCollection", features: [...(decor?.shapes ?? []), ...own] };
  }, [mapData, isPoint, shapeFn, decor, look]);
  const shapes = React.useMemo<MapProps["shapes"]>(() => {
    if (!shapeData) return undefined;
    const o = look?.shapeOpts ?? { edge: "thin" as const, labelZoom: 13 };
    return {
      ...o,
      data: shapeData,
      selected: draft && !isNew && !isPoint ? draft.oid : null,
      color: o.color ?? target.color,
      labelZoom: decor?.labelZoom ?? o.labelZoom,
    };
  }, [shapeData, look, draft, isNew, isPoint, target, decor]);
  const pulseOn = Boolean(pointProps.pulse);
  const effBasemap =
    !basemapUser && look?.basemapAt ? (BASEMAPS.find((b) => b.id === look.basemapAt!(zoom)) ?? basemap) : basemap;

  const rowToDraft = React.useCallback(
    (r: Row): Draft => {
      const values: Record<string, string> = {};
      for (const f of meta?.fields ?? []) values[f.name] = text(r.a[f.name], f.kind);
      const pl = meta?.place;
      const dv = pl?.district ? r.a[pl.district] : null;
      const kv = pl?.khoroo ? r.a[pl.khoroo] : null;
      const district = typeof dv === "string" && dv.trim() ? dv.trim().replace(/\s*дүүрэг$/i, "") : null;
      const abbr = district ? Object.entries(DISTRICT_CODE).find(([, c]) => c === district)?.[0] : null;
      const kn = kv == null ? NaN : parseInt(String(kv), 10);
      return {
        oid: r.oid,
        values,
        orig: { ...values },
        lon: r.lon != null ? r.lon.toFixed(6) : "",
        lat: r.lat != null ? r.lat.toFixed(6) : "",
        geom: null,
        measure: null,
        moved: false,
        place: district ? { district: abbr ?? district, khoroo: Number.isFinite(kn) ? kn : null, code: null } : undefined,
        locked: true,
      };
    },
    [meta],
  );

  /* Зураг (Esri) — самбарын бүрэлдэхүүнээс DOM-оор ({@link BasemapGallery}-тэй нэг арга) */
  const engineOf = () => (mapBox.current?.querySelector(".wells-esri") as any)?.__engine as { view: any; map: any } | undefined;

  const clearSketch = React.useCallback(() => {
    const e = esri.current;
    e?.sketch?.cancel?.();
    e?.sketchLayer?.removeAll?.();
  }, []);

  /* Дүрсийн хэмжээ (геодезийн) — талбай, га эсвэл урт, км */
  const measureOf = React.useCallback((g: any): string | null => {
    const e = esri.current;
    try {
      if (g?.type === "polygon") return `${num(Math.abs(e.areaOp.execute(g, { unit: "hectares" })), 2)} га`;
      if (g?.type === "polyline") return `${num(e.lengthOp.execute(g, { unit: "kilometers" }), 2)} км`;
    } catch {}
    return null;
  }, []);

  /* Байршил — дүүрэг, хороог асууна (засаг захиргааны талбартай давхаргад) */
  const locate = React.useCallback(
    (lon: number, lat: number) => {
      if (!meta?.place) return;
      placeAc.current?.abort();
      const ac = (placeAc.current = new AbortController());
      setDraft((d) => (d ? { ...d, place: "loading" } : d));
      placeAt(lon, lat, ac.signal)
        .then((p) => !ac.signal.aborted && setDraft((d) => (d ? { ...d, place: p } : d)))
        .catch(() => !ac.signal.aborted && setDraft((d) => (d ? { ...d, place: undefined } : d)));
    },
    [meta],
  );

  const sketchOf = React.useCallback(() => {
    const e = esri.current;
    const eng = engineOf();
    if (!e || !eng) return null;
    if (!e.sketch || e.sketchView !== eng.view) {
      e.sketch?.destroy?.();
      e.sketchLayer = new e.GraphicsLayer({ title: "sketch", listMode: "hide" });
      eng.map.add(e.sketchLayer);
      const stroke = [103, 215, 228, 1];
      e.sketch = new e.SketchViewModel({
        view: eng.view,
        layer: e.sketchLayer,
        updateOnGraphicClick: false,
        polygonSymbol: { type: "simple-fill", color: [103, 215, 228, 0.22], outline: { color: stroke, width: 2.2 } },
        polylineSymbol: { type: "simple-line", color: stroke, width: 3 },
        defaultUpdateOptions: { tool: "reshape", toggleToolOnClick: false, enableRotation: false, enableScaling: false },
      });
      const take = (g: any) => {
        if (!g) return;
        const c = g.extent?.center;
        setDraft((d) => (d ? { ...d, geom: g.clone(), measure: measureOf(g), moved: true } : d));
        if (c && Number.isFinite(c.longitude)) locate(c.longitude, c.latitude);
      };
      e.sketch.on("create", (ev: any) => {
        if (ev.state === "complete") {
          take(ev.graphic?.geometry);
          setMode("select");
          /* Дуусмагц хэлбэрийг шууд засах боломжтой үлдээнэ */
          if (ev.graphic) e.sketch.update(ev.graphic, { tool: "reshape" });
        }
      });
      e.sketch.on("update", (ev: any) => {
        const t = String(ev.toolEventInfo?.type ?? "");
        if (/(-stop|vertex-add|vertex-remove)$/.test(t) || ev.state === "complete") take(ev.graphics?.[0]?.geometry);
        if (ev.state === "complete") setMode("select");
      });
      e.sketchView = eng.view;
    }
    return e.sketch;
  }, [locate, measureOf]);

  const select = React.useCallback(
    (oid: number, zoom: boolean, list = rows) => {
      let r = list.find((x) => x.oid === oid);
      clearSketch();
      if (!r) {
        /* Хүснэгтэд ачаалагдаагүй (хуучин) бүртгэл — нэгээр нь асууна */
        const e = esri.current;
        if (!e?.layer || !meta) return;
        void e.layer
          .queryFeatures({ objectIds: [oid], outFields: ["*"], returnGeometry: meta.geo === "point", outSpatialReference: { wkid: 4326 } })
          .then((res: any) => {
            const g = res.features?.[0];
            if (!g) return;
            r = { oid, lon: g.geometry?.x ?? null, lat: g.geometry?.y ?? null, a: g.attributes };
            setRows((rs) => (rs.some((x) => x.oid === oid) ? rs : [r!, ...rs]));
            setDraft(rowToDraft(r));
          });
        setDraft(null);
      } else setDraft(rowToDraft(r));
      /* Хуучин дүрсийн талбай, урт — бүтэн геометрээр */
      if (meta && meta.geo !== "point") {
        const e = esri.current;
        const eng = engineOf();
        if (e?.layer && eng)
          void e.layer
            .queryFeatures({ objectIds: [oid], returnGeometry: true, outSpatialReference: eng.view.spatialReference })
            .then((res: any) => {
              const g = res.features?.[0]?.geometry;
              const m = g ? measureOf(g) : null;
              if (m) setDraft((d) => (d && d.oid === oid && !d.moved ? { ...d, measure: m } : d));
            })
            .catch(() => undefined);
      }
      setErrors({});
      setConfirmDel(false);
      setConfirmEdit(false);
      setNotice(null);
      setMode("select");
      if (!zoom) return;
      if (r && r.lon != null && r.lat != null) setFocus(around(r.lon, r.lat));
      else {
        const b = mapData?.bbox.get(oid);
        if (b) setFocus(padBox(b));
      }
    },
    [rows, rowToDraft, clearSketch, meta, mapData, measureOf],
  );

  const startNew = React.useCallback(() => {
    const values: Record<string, string> = {};
    for (const f of meta?.fields ?? []) values[f.name] = "";
    clearSketch();
    setDraft({ oid: null, values, orig: { ...values }, lon: "", lat: "", geom: null, measure: null, moved: false, place: undefined, locked: false });
    setErrors({});
    setConfirmDel(false);
    setNotice(null);
    if (meta?.geo === "point") setMode("add");
    else {
      const sk = sketchOf();
      if (sk) {
        sk.create(meta?.geo === "polyline" ? "polyline" : "polygon");
        setMode("draw");
      } else setMode("select");
    }
  }, [meta, clearSketch, sketchOf]);

  /*
    ШИНЭ БҮРТГЭЛ — ШУУД НЭМЭХ ГОРИМД (хэрэглэгч 2026-10-22: "data shineer
    nemegdehed burtgeh heseg"). Зөвхөн НЭГ удаа: давхарга солих, цуцлах
    зэргийн дараа дахин өөрөө эхлэхгүй. Олон өнцөгт, шугамд зурах хэрэгсэл
    (SketchViewModel) зургийн хөдөлгүүр бэлэн болсны дараа л үүсдэг тул
    түүнийг хүлээнэ.
  */
  const autoAdd = React.useRef(Boolean(startAdd));
  React.useEffect(() => {
    if (!autoAdd.current || status !== "ready" || !meta?.canAdd) return;
    const t = window.setInterval(() => {
      if (meta.geo !== "point" && !sketchOf()) return;
      window.clearInterval(t);
      autoAdd.current = false;
      startNew();
    }, 150);
    return () => window.clearInterval(t);
  }, [status, meta, sketchOf, startNew]);

  const cancel = React.useCallback(() => {
    placeAc.current?.abort();
    clearSketch();
    setDraft(null);
    setErrors({});
    setConfirmDel(false);
    setConfirmEdit(false);
    setMode("select");
  }, [clearSketch]);

  /* Дүрсийг дахин зурах (шинэ) */
  const redraw = () => {
    const sk = sketchOf();
    if (!sk) return;
    clearSketch();
    setDraft((d) => (d ? { ...d, geom: null, measure: null } : d));
    sk.create(geo === "polyline" ? "polyline" : "polygon");
    setMode("draw");
  };

  /* Хуучин дүрсийн хэлбэрийг засах — БҮТЭН нарийвчлалтай геометрийг асууна */
  const reshape = async () => {
    const e = esri.current;
    const eng = engineOf();
    const sk = sketchOf();
    if (!e || !eng || !sk || !draft || draft.oid == null) return;
    if (mode === "reshape") {
      sk.complete();
      return;
    }
    let g = draft.geom;
    if (!g) {
      const res = await e.layer.queryFeatures({ objectIds: [draft.oid], returnGeometry: true, outSpatialReference: eng.view.spatialReference });
      g = res.features?.[0]?.geometry;
    }
    if (!g) return;
    e.sketchLayer.removeAll();
    const graphic = { geometry: g, symbol: geo === "polygon" ? sk.polygonSymbol : sk.polylineSymbol };
    e.sketchLayer.add(graphic);
    sk.update(e.sketchLayer.graphics.getItemAt(0), { tool: "reshape" });
    setMode("reshape");
  };

  /* Байршил сонгох горимд зураг дээрх товшилт цэг тавина / зөөнө */
  const placePoint = (lon: number, lat: number) => {
    setDraft((d) => (d ? { ...d, lon: lon.toFixed(6), lat: lat.toFixed(6), moved: true } : d));
    locate(lon, lat);
    if (mode === "move") setMode("select");
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mode === "move") setMode("select");
      else if (mode === "reshape") esri.current?.sketch?.complete?.();
      else if (draft) cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, draft, cancel]);

  const commitCoords = () => {
    if (!draft || dLon == null || dLat == null) return;
    locate(dLon, dLat);
    setFocus(around(dLon, dLat));
  };

  const dirty = !!draft && (draft.moved || Object.keys(draft.values).some((k) => draft.values[k] !== draft.orig[k]));

  async function save() {
    const e = esri.current;
    if (!e || !draft || !meta) return;
    const errs: Record<string, string> = {};
    const attrs: Record<string, unknown> = {};
    for (const f of meta.fields) {
      const { value, error: err } = parse(f, draft.values[f.name] ?? "");
      if (err) errs[f.name] = err;
      else if (isNew || draft.values[f.name] !== draft.orig[f.name]) attrs[f.name] = value;
    }
    if (isPoint && (dLon == null || dLat == null)) errs.__coords = "Байршил сонгогдоогүй";
    if (!isPoint && isNew && !draft.geom) errs.__coords = "Дүрс зурагдаагүй";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setNotice(null);
    try {
      let geometry: any = undefined;
      let at: [number, number] | null = null;
      const sr = e.layer.spatialReference;
      if (isPoint && (isNew || draft.moved) && dLon != null && dLat != null) {
        /* ⚠ Операторууд ЖИНХЭНЭ Esri геометр шаарддаг — энгийн объект өгвөл
           "getCacheValue is not a function" гэж унана (2026-10-21, бодит туршилтаар) */
        const wgs = new e.Point({ x: dLon, y: dLat, spatialReference: { wkid: 4326 } });
        geometry = sr?.wkid === 4326 ? wgs : e.projectOperator.execute(wgs, sr);
        at = [dLon, dLat];
        if (meta.coords) {
          attrs[meta.coords.lon] = Number(dLon.toFixed(6));
          attrs[meta.coords.lat] = Number(dLat.toFixed(6));
        }
      } else if (!isPoint && draft.geom && (isNew || draft.moved)) {
        geometry = e.projectOperator.execute(draft.geom, sr);
        const c = draft.geom.extent?.center;
        if (c && Number.isFinite(c.longitude)) at = [c.longitude, c.latitude];
      }
      if (meta.place && at) {
        const known = draft.place;
        if (known === "loading" || known === undefined) placeAc.current?.abort();
        const found: Place | null | undefined =
          known === "loading" || known === undefined ? await placeAt(at[0], at[1]).catch(() => undefined) : known;
        if (found !== undefined) Object.assign(attrs, placeAttrs(found, meta.place, rows));
      }
      const edit = isNew
        ? { addFeatures: [new e.Graphic({ attributes: attrs, geometry })] }
        : {
            updateFeatures: [
              new e.Graphic({ attributes: { ...attrs, [meta.oidField]: draft.oid }, ...(geometry ? { geometry } : {}) }),
            ],
          };
      const res = await e.layer.applyEdits(edit);
      const r = (isNew ? res.addFeatureResults : res.updateFeatureResults)?.[0];
      if (!r || r.error) throw r?.error ?? new Error("Хадгалагдсангүй");
      changed.current = true;
      clearSketch();
      const list = await loadRows(query, meta);
      if (geometry) {
        const ac = new AbortController();
        await loadMap(meta, ac.signal, look).catch(() => undefined);
      }
      select(r.objectId, false, list);
      setNotice({ ok: true, text: isNew ? "Шинэ бүртгэл хадгалагдлаа" : "Өөрчлөлт хадгалагдлаа" });
    } catch (err: any) {
      setNotice({ ok: false, text: `Хадгалагдсангүй: ${reason(err) === "уншигдсангүй" ? (err?.message ?? "алдаа") : reason(err)}` });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const e = esri.current;
    if (!e || !draft || draft.oid == null || !meta) return;
    setBusy(true);
    try {
      const res = await e.layer.applyEdits({ deleteFeatures: [{ objectId: draft.oid }] });
      const r = res.deleteFeatureResults?.[0];
      if (!r || r.error) throw r?.error ?? new Error("Устгагдсангүй");
      changed.current = true;
      await loadRows(query, meta);
      await loadMap(meta, new AbortController().signal, look).catch(() => undefined);
      cancel();
      setNotice({ ok: true, text: "Бүртгэл устгагдлаа" });
    } catch (err: any) {
      setNotice({ ok: false, text: `Устгагдсангүй: ${err?.message ?? "алдаа"}` });
    } finally {
      setBusy(false);
      setConfirmDel(false);
    }
  }

  /* Хүснэгт */
  const pl = meta?.place;
  const placeCols = pl ? ([pl.district, pl.khoroo].filter(Boolean) as string[]) : [];
  const cols = meta ? meta.fields : [];
  const nameOf = (r: Row) => (meta?.displayField && r.a[meta.displayField] != null ? String(r.a[meta.displayField]) : `№ ${r.oid}`);
  const set = (name: string, v: string) => setDraft((d) => (d ? { ...d, values: { ...d.values, [name]: v } } : d));
  const heading = draft ? (isNew ? `Шинэ ${UNIT[geo]}` : nameOf(rowsByOid.get(draft.oid!) ?? { oid: draft.oid!, lon: null, lat: null, a: {} })) : null;

  /* Засварлаж буй (түгжээ тайлсан, өөрчлөлттэй) бүртгэлээс өөр бүртгэл рүү
     санамсаргүй шилжихгүй — өөрчлөлт алдагдана */
  const busyEditing = !!draft && !draft.locked && !isNew && dirty;
  const selectedAt: [number, number] | null =
    isPoint && draft && dLon != null && dLat != null ? [dLon, dLat] : null;

  const tone = getDepartment(source.scope)?.tone;

  const switchTarget = (i: number) => {
    cancel();
    setActive(i);
    setStatus("loading");
    setMeta(null);
    setMapData(null);
    setLook(null);
    setDecor(null);
    setOverlays(undefined);
    setRows([]);
    setQuery("");
    setMapKey((k) => k + 1);
  };

  return createPortal(
    <div
      className="feature-editor"
      role="dialog"
      aria-modal="true"
      aria-label={`Өгөгдөл засах — ${source.label}`}
      /* Хэлтсийн өнгө — самбарын тэмдэг (`.species-pin` …) түүнээс уншина */
      style={tone ? ({ "--tone": `var(${tone})` } as React.CSSProperties) : undefined}
    >
      <EditorHead source={source} onClose={() => onClose(changed.current)}>
        {status === "loading" && !error && <Loader2 size={15} className="animate-spin text-ink-3" />}
        {error && <span className="feature-editor-error" title={error}>{error}</span>}
      </EditorHead>

      {/* Олон давхаргатай багцад давхарга сонгох мөр — толгойн доор */}
      {targets.length > 1 && (
        <nav className="pe-layers" role="tablist" aria-label="Давхарга">
          {targets.map((t, i) => (
            <button
              key={t.url}
              type="button"
              role="tab"
              aria-selected={i === active}
              disabled={busyEditing}
              onClick={() => i !== active && switchTarget(i)}
            >
              {t.color && <i style={{ background: t.color }} aria-hidden="true" />}
              {t.title}
            </button>
          ))}
        </nav>
      )}

      <div ref={body} className="pe-body">
        <div className="pe-main">
          <div className="pe-map">
            <div ref={mapBox} className="pe-map-host">
              {mapData && meta && (
                <WellsMap
                  key={`${target.url}-${mapKey}`}
                  cluster={false}
                  {...pointProps}
                  points={points}
                  visible={visible}
                  basemap={effBasemap}
                  shapes={shapes}
                  overlays={overlays}
                  onZoom={look?.zoomAware || look?.basemapAt ? setZoom : undefined}
                  onSelect={(oid) => (oid < DECOR && mode === "select" && !busyEditing ? select(oid, false) : undefined)}
                  onHover={(oid) => setHover(oid != null && oid >= DECOR ? null : oid)}
                  hotMark={hover}
                  pickedMark={isNew ? null : (draft?.oid ?? null)}
                  highlight={pulseOn && !isNew ? null : selectedAt}
                  onMapClick={isPoint && (mode === "move" || (mode === "add" && draft)) ? placePoint : undefined}
                  onBlankClick={() => mode === "select" && draft && !isNew && !busyEditing && cancel()}
                  focus={focus}
                />
              )}
              {!mapData && !error && (
                <div className="pe-map-wait">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              )}
              <BasemapGallery
                value={effBasemap}
                onChange={(b) => {
                  setBasemap(b);
                  setBasemapUser(true);
                }}
              />
            </div>
            {meta && (
              <div className="pe-tools" role="toolbar" aria-label="Засварын хэрэгсэл">
                <button type="button" aria-pressed={mode === "select" || mode === "reshape"} onClick={() => (mode === "add" || mode === "draw" ? cancel() : setMode("select"))}>
                  <MousePointer2 size={15} />
                  <span>Сонгох</span>
                </button>
                <button type="button" aria-pressed={mode === "add" || mode === "draw"} disabled={!meta.canAdd || busyEditing} onClick={startNew}>
                  {isPoint ? <MapPinPlus size={15} /> : <PenTool size={15} />}
                  <span>{isPoint ? "Цэг нэмэх" : "Дүрс зурах"}</span>
                </button>
              </div>
            )}
          </div>
          <Splitter axis="row" body={body} />
          <section className="pe-table" aria-label="Бүртгэлийн хүснэгт">
            <header className="pe-table-head">
              <span className="dataset-eyebrow">БҮРТГЭЛИЙН ХҮСНЭГТ</span>
              <span className="pe-count num">
                {rows.length < matched ? `${num(rows.length)} / ${num(matched)}` : num(matched)} {UNIT[geo]}
              </span>
              {meta && (
                <AddField
                  url={meta.url}
                  fields={meta.allFields}
                  onDone={(alias) => {
                    changed.current = true;
                    cancel();
                    setStatus("loading");
                    setMapData(null);
                    setDecor(null);
                    setMapKey((k) => k + 1);
                    setReload((k) => k + 1);
                    setNotice({ ok: true, text: `“${alias}” мөр нэмэгдлээ` });
                  }}
                />
              )}
              <label className="pe-search">
                <Search size={13} aria-hidden="true" />
                <input type="search" placeholder="Хайх…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Хүснэгтээс хайх" />
              </label>
            </header>
            <div className="pe-table-scroll" onMouseLeave={() => setHover(null)}>
              <table>
                <thead>
                  <tr>
                    <th className="num">№</th>
                    {isPoint && <th>Уртраг</th>}
                    {isPoint && <th>Өргөрөг</th>}
                    {pl?.district && <th>Дүүрэг</th>}
                    {pl?.khoroo && <th>Хороо</th>}
                    {cols.map((f) => (
                      <th key={f.name}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.oid}
                      className={cn(draft?.oid === r.oid && "is-picked", hover === r.oid && "is-hot")}
                      onMouseEnter={() => setHover(r.oid)}
                      onClick={() => !busyEditing && select(r.oid, true)}
                    >
                      <td className="num">{r.oid}</td>
                      {isPoint && <td className="num">{r.lon?.toFixed(6) ?? "—"}</td>}
                      {isPoint && <td className="num">{r.lat?.toFixed(6) ?? "—"}</td>}
                      {placeCols.map((c) => (
                        <td key={c}>{r.a[c] != null && r.a[c] !== "" ? String(r.a[c]) : "—"}</td>
                      ))}
                      {cols.map((f) => {
                        const v = text(r.a[f.name], f.kind);
                        return (
                          <td key={f.name} className={cn(f.kind !== "string" && "num", !v && "is-empty")} title={v.length > 40 ? v : undefined}>
                            {v ? (f.kind === "select" ? (f.options?.find((o) => String(o.code) === v)?.name ?? v) : v) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {status === "ready" && !rows.length && <p className="pe-empty">{query ? "Тохирох бүртгэл олдсонгүй" : "Бүртгэл байхгүй байна"}</p>}
            </div>
          </section>
        </div>

        <Splitter axis="col" body={body} />
        <aside className="pe-form" aria-label="Атрибут">
          {!draft ? (
            <div className="pe-idle">
              <div className="hatch pe-idle-box">
                {isPoint ? <MapPin size={20} strokeWidth={1.5} /> : <Shapes size={20} strokeWidth={1.5} />}
                <strong>{`${UNIT[geo][0].toUpperCase()}${UNIT[geo].slice(1)} сонгоогүй байна`}</strong>
              </div>
              {meta?.canAdd && (
                <button type="button" className="pe-primary" onClick={startNew}>
                  {isPoint ? <MapPinPlus size={14} /> : <PenTool size={14} />} {isPoint ? "Цэг нэмэх" : "Дүрс зурах"}
                </button>
              )}
              {notice && <p className={cn("pe-notice", notice.ok ? "is-ok" : "is-bad")}>{notice.text}</p>}
            </div>
          ) : (
            <>
              <header className="pe-form-head">
                <span className="dataset-eyebrow">{isNew ? "ШИНЭ БҮРТГЭЛ" : `БҮРТГЭЛ № ${draft.oid}`}</span>
                <h3 className="truncate">{heading}</h3>
              </header>

              <fieldset className="pe-form-scroll" disabled={draft.locked}>
                {draft.locked && (
                  <p className="pe-locked">
                    <Lock size={12} /> Хадгалсан бүртгэл · зөвхөн харах
                  </p>
                )}
                {isPoint ? (
                  <fieldset className={cn("pe-loc", errors.__coords && "is-bad")}>
                    <legend>
                      <Crosshair size={13} /> Байршил
                    </legend>
                    <div className="pe-loc-grid">
                      <label>
                        <span>Уртраг</span>
                        <input
                          className="num"
                          inputMode="decimal"
                          value={draft.lon}
                          placeholder="106.917000"
                          aria-invalid={draft.lon !== "" && dLon == null}
                          onChange={(e) => setDraft({ ...draft, lon: e.target.value, moved: true })}
                          onBlur={commitCoords}
                          onKeyDown={(e) => e.key === "Enter" && commitCoords()}
                        />
                      </label>
                      <label>
                        <span>Өргөрөг</span>
                        <input
                          className="num"
                          inputMode="decimal"
                          value={draft.lat}
                          placeholder="47.918000"
                          aria-invalid={draft.lat !== "" && dLat == null}
                          onChange={(e) => setDraft({ ...draft, lat: e.target.value, moved: true })}
                          onBlur={commitCoords}
                          onKeyDown={(e) => e.key === "Enter" && commitCoords()}
                        />
                      </label>
                    </div>
                    {!draft.locked && (
                      <button
                        type="button"
                        className={cn("pe-pick", (mode === "move" || (mode === "add" && dLon == null)) && "is-on")}
                        onClick={() => setMode(isNew ? "add" : mode === "move" ? "select" : "move")}
                      >
                        <Crosshair size={13} />
                        {isNew ? (dLon == null ? "Зураг дээр товшиж цэг тавина" : "Зураг дээр товшиж зөөнө") : mode === "move" ? "Зөөхийг цуцлах" : "Зураг дээрээс зөөх"}
                      </button>
                    )}
                    {pl && draft.place !== undefined && (
                      <p className="pe-place">
                        {draft.place === "loading" ? <Loader2 size={12} className="animate-spin" /> : draft.place ? placeText(draft.place) : "Нийслэлийн нутаг дэвсгэрээс гадуур"}
                      </p>
                    )}
                    {errors.__coords && <p className="pe-err">{errors.__coords}</p>}
                  </fieldset>
                ) : (
                  <fieldset className={cn("pe-loc", errors.__coords && "is-bad")}>
                    <legend>
                      <Shapes size={13} /> {geo === "polygon" ? "Дүрс" : "Шугам"}
                    </legend>
                    {draft.measure && (
                      <p className="pe-measure num">
                        {geo === "polygon" ? "Талбай" : "Урт"} <strong>{draft.measure}</strong>
                      </p>
                    )}
                    {!draft.locked &&
                      (isNew ? (
                        <button type="button" className={cn("pe-pick", mode === "draw" && "is-on")} onClick={redraw}>
                          <PenTool size={13} />
                          {mode === "draw" ? "Зурж байна" : draft.geom ? "Дахин зурах" : "Зураг дээр зурах"}
                        </button>
                      ) : (
                        <button type="button" className={cn("pe-pick", mode === "reshape" && "is-on")} onClick={() => void reshape()}>
                          <PenTool size={13} />
                          {mode === "reshape" ? "Хэлбэрийг батлах" : "Хэлбэр засах"}
                        </button>
                      ))}
                    {pl && draft.place !== undefined && (
                      <p className="pe-place">
                        {draft.place === "loading" ? <Loader2 size={12} className="animate-spin" /> : draft.place ? placeText(draft.place) : "Нийслэлийн нутаг дэвсгэрээс гадуур"}
                      </p>
                    )}
                    {errors.__coords && <p className="pe-err">{errors.__coords}</p>}
                  </fieldset>
                )}

                <div className="pe-fields">
                  {meta?.fields.map((f) => (
                    <label key={f.name} className={cn("pe-field", f.wide && "is-wide", errors[f.name] && "is-bad")}>
                      <span>
                        {f.label}
                        {f.required && <b aria-hidden="true"> *</b>}
                      </span>
                      {f.kind === "select" ? (
                        <select value={draft.values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                          <option value="">—</option>
                          {f.options?.map((o) => (
                            <option key={String(o.code)} value={String(o.code)}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.kind === "date" ? "date" : "text"}
                          inputMode={f.kind === "number" ? "decimal" : f.kind === "integer" ? "numeric" : undefined}
                          className={cn(f.kind !== "string" && "num")}
                          value={draft.values[f.name] ?? ""}
                          maxLength={f.kind === "string" ? f.length : undefined}
                          onChange={(e) => set(f.name, e.target.value)}
                          aria-invalid={Boolean(errors[f.name])}
                        />
                      )}
                      {errors[f.name] && <em className="pe-err">{errors[f.name]}</em>}
                    </label>
                  ))}
                </div>
              </fieldset>

              <footer className="pe-form-foot">
                {notice && <p className={cn("pe-notice", notice.ok ? "is-ok" : "is-bad")}>{notice.text}</p>}
                {confirmEdit ? (
                  <div className="pe-warn" role="alertdialog" aria-label="Засварлах сануулга">
                    <p>
                      <TriangleAlert size={15} />
                      <span>
                        <strong>Хуучин бүртгэлийг засварлах гэж байна.</strong> Хадгалсны дараа өмнөх утгууд өөрчлөгдөнө.
                      </span>
                    </p>
                    <div className="pe-actions">
                      <button type="button" className="pe-ghost" onClick={() => setConfirmEdit(false)}>
                        Үгүй
                      </button>
                      <button
                        type="button"
                        className="pe-primary"
                        onClick={() => {
                          setDraft((d) => (d ? { ...d, locked: false } : d));
                          setConfirmEdit(false);
                          setNotice(null);
                        }}
                      >
                        <PencilLine size={14} /> Засварлах
                      </button>
                    </div>
                  </div>
                ) : confirmDel ? (
                  <div className="pe-confirm">
                    <span>Энэ бүртгэлийг устгах уу?</span>
                    <button type="button" className="pe-danger" disabled={busy} onClick={remove}>
                      Устгах
                    </button>
                    <button type="button" className="pe-ghost" onClick={() => setConfirmDel(false)}>
                      Үгүй
                    </button>
                  </div>
                ) : draft.locked ? (
                  <div className="pe-actions">
                    {meta?.canDelete && (
                      <button type="button" className="pe-ghost pe-del" onClick={() => setConfirmDel(true)} title="Устгах" aria-label="Устгах">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button type="button" className="pe-ghost" onClick={cancel}>
                      Хаах
                    </button>
                    <button type="button" className="pe-primary" disabled={!meta?.canUpdate} onClick={() => setConfirmEdit(true)}>
                      <PencilLine size={14} /> Засварлах
                    </button>
                  </div>
                ) : (
                  <div className="pe-actions">
                    {!isNew && meta?.canDelete && (
                      <button type="button" className="pe-ghost pe-del" onClick={() => setConfirmDel(true)} title="Устгах" aria-label="Устгах">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="pe-ghost"
                      onClick={() => (isNew ? cancel() : draft.oid != null && select(draft.oid, false))}
                    >
                      Цуцлах
                    </button>
                    <button
                      type="button"
                      className="pe-primary"
                      disabled={busy || !dirty || mode === "reshape" || mode === "draw" || (isNew ? !meta?.canAdd : !meta?.canUpdate)}
                      onClick={save}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Хадгалах
                    </button>
                  </div>
                )}
              </footer>
            </>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  );
}
