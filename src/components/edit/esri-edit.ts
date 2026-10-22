/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ирдэг тул төрөлгүй */

import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";
import { readSession } from "@/lib/auth";
import type { EditTarget } from "@/lib/edit-targets";

/*
  Засварын цонхны ({@link ./data-editor})
  хуваалцсан туслахууд.

  ⚠⚠ ТОКЕН нь ХҮСЭЛТИЙН ЗАВСРЫН ХАНДЛАГААР (`esriConfig.request.interceptors`),
  IdentityManager-аар БИШ: хөрсний блок дээр хуурамч токеныг IdentityManager-т
  бүртгэхэд SDK "null.trim" гэж унаж, 498-д Esri-ийн нэвтрэх цонх хүлээж
  гацсан ({@link src/lib/soil-scene.ts}). Хандлага нь ЗӨВХӨН
  `environment.ub.gov.mn`-д токен хавсаргана (`arcgisJson`-ийн `needsToken`-тэй
  нэг хүрээ), `useIdentity: false` нь нэвтрэх цонхыг бүрмөсөн хаана.
  ⚠ Хандлага нь синхрон (`readSession`); токен нь цонх нээлттэй үед
  минут тутам `getToken()`-оор сунгагдана (дуудагч тал).
*/

const ESRI_HOST = /^https:\/\/environment\.ub\.gov\.mn\//;

let intercepting = false;

export function installToken(esriConfig: any) {
  if (intercepting) return;
  intercepting = true;
  esriConfig.request.useIdentity = false;
  esriConfig.request.interceptors.push({
    urls: ESRI_HOST,
    before(params: any) {
      const token = readSession()?.token;
      if (!token) return;
      const opts = params.requestOptions ?? (params.requestOptions = {});
      opts.query = { ...(opts.query ?? {}), token };
    },
  });
}

/** Esri-ийн алдааг хэрэглэгчийн хэлээр — 498/499 нь нэвтрэлтийн асуудал */
export function reason(e: any): string {
  const code = e?.details?.httpStatus ?? e?.details?.raw?.code ?? e?.details?.messageCode;
  const text = String(e?.details?.messages?.[0] ?? e?.message ?? "");
  if (code === 498 || code === 499 || /invalid token|token required/i.test(text))
    return "нэвтрэлтийн хугацаа дууссан байна";
  if (code === 403 || /permission|not authorized/i.test(text)) return "эрх хүрэхгүй байна";
  return "уншигдсангүй";
}

/** Дугааргүй `…/FeatureServer` бол үйлчилгээний эхний давхаргын дугаар */
export async function layerUrl(t: EditTarget, signal: AbortSignal): Promise<string> {
  if (/\/\d+$/.test(t.url)) return t.url;
  const info = await arcgisJson<{ layers?: { id: number }[] }>(`${t.url}?f=json`, t.title, { signal });
  const id = info.layers?.[0]?.id;
  if (id == null) throw new Error(`${t.title}: давхарга олдсонгүй`);
  return `${t.url}/${id}`;
}

/*
  БАЙРШЛЫН ЗАСАГ ЗАХИРГАА — цэг тавихад дүүрэг, хороог порталын хилийн
  давхаргаас (`soumbnd`, `Bag_khil`) серверээр асууна: хоёр жижиг асуулга,
  хил татахгүй.
  ⚠ `Bag_khil` нь ОДООГИЙН хорооны хуваарь — орон зайн нэгтгэлээр бөглөгдсөн
  хуучин бүртгэлийн хорооны дугаараас зөрж болно (жишээ нь BZD-9: бүртгэлд
  14, одоогийн хилээр 42-р хороо).
*/
const DISTRICT_CODE: Record<string, string> = {
  Баянзүрх: "БЗД",
  "Хан-Уул": "ХУД",
  Сонгинохайрхан: "СХД",
  Сүхбаатар: "СБД",
  Чингэлтэй: "ЧД",
  Баянгол: "БГД",
  Налайх: "НД",
  Багануур: "БНД",
  Багахангай: "БХД",
};

export type Place = { district: string; khoroo: number | null; code: string | null };

async function pointQuery<T>(layer: string, outFields: string, lon: number, lat: number, signal?: AbortSignal) {
  const url =
    `${HOSTING_LAYER(layer)}/query?` +
    new URLSearchParams({
      geometry: `${lon},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields,
      returnGeometry: "false",
      f: "json",
    });
  const j = await arcgisJson<{ features?: { attributes: T }[] }>(url, "Засаг захиргааны хил", { signal });
  return j.features?.[0]?.attributes ?? null;
}

const HOSTING_LAYER = (id: string) => `${layerService(id)}/0`;

/** Цэгийн дүүрэг, хороо — нийслэлээс гадуур бол `null` */
export async function placeAt(lon: number, lat: number, signal?: AbortSignal): Promise<Place | null> {
  const [soum, bag] = await Promise.all([
    pointQuery<{ soum_name?: string; aimag_code?: number }>("soumbnd", "soum_name,aimag_code", lon, lat, signal),
    pointQuery<{ name?: string; au3_code?: string }>("Bag_khil", "name,au3_code", lon, lat, signal),
  ]);
  if (!soum || Number(soum.aimag_code) !== 11 || !soum.soum_name) return null;
  const district = soum.soum_name.trim().replace(/^Хан Уул$/, "Хан-Уул");
  const n = bag && String(bag.au3_code ?? "").startsWith("011") ? parseInt(String(bag.name ?? ""), 10) : NaN;
  const khoroo = Number.isFinite(n) ? n : null;
  const abbr = DISTRICT_CODE[district];
  return { district, khoroo, code: abbr && khoroo != null ? `${abbr}_${String(khoroo).padStart(2, "0")}` : null };
}

export { DISTRICT_CODE };

/*
  ЗУРАГТ ӨГӨХ ГЕОМЕТР — давхаргын БҮХ бүртгэлийн дугаар, шошго, геометр
  (WGS84, GeoJSON). Хуудсуудыг зэрэг (6) гуйна; олон өнцөгт, шугамыг ~2 м-ээр
  ерөнхийлнэ (зөвхөн дүрслэлд — засварлахдаа бүтэн геометрийг тусад нь татна).
*/
export type MapData = {
  kind: "point" | "shape";
  points: { oid: number[]; lon: number[]; lat: number[] };
  labels: string[];
  /** Цэг бүрийн атрибут (`fields`) — `points`-тэй нэг дараалал */
  attrs: Record<string, unknown>[];
  shapes: GeoJSON.FeatureCollection;
  /** Бүртгэл бүрийн хүрээ [W, S, E, N] — сонгоход ойртоно */
  bbox: Map<number, [number, number, number, number]>;
};

function boxOf(g: GeoJSON.Geometry | null): [number, number, number, number] | null {
  if (!g) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  if ("coordinates" in g) walk(g.coordinates);
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

export async function loadMapData(
  url: string,
  o: { oid: string; label: string | null; fields?: string[]; point: boolean; pageSize: number; signal: AbortSignal },
): Promise<MapData> {
  const base = (extra: Record<string, string>) =>
    `${url}/query?` +
    new URLSearchParams({ where: "1=1", f: "json", ...extra });
  const { count = 0 } = await arcgisJson<{ count?: number }>(base({ returnCountOnly: "true" }), "Тоо", { signal: o.signal });
  const pages = Math.ceil(count / o.pageSize);
  const outFields = [...new Set([o.oid, o.label, ...(o.fields ?? [])].filter(Boolean))].join(",");
  const feats: GeoJSON.Feature[][] = new Array(pages);
  let next = 0;
  const worker = async () => {
    while (next < pages) {
      const k = next++;
      const fc = await arcgisJson<GeoJSON.FeatureCollection>(
        base({
          f: "geojson",
          outFields,
          returnGeometry: "true",
          outSR: "4326",
          orderByFields: o.oid,
          resultOffset: String(k * o.pageSize),
          resultRecordCount: String(o.pageSize),
          ...(o.point ? {} : { maxAllowableOffset: "0.00002", geometryPrecision: "6" }),
        }),
        "Газрын зураг",
        { signal: o.signal },
      );
      feats[k] = fc.features ?? [];
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, pages) }, worker));

  const out: MapData = {
    kind: o.point ? "point" : "shape",
    points: { oid: [], lon: [], lat: [] },
    labels: [],
    attrs: [],
    shapes: { type: "FeatureCollection", features: [] },
    bbox: new Map(),
  };
  for (const page of feats)
    for (const f of page ?? []) {
      const oid = Number(f.id ?? f.properties?.[o.oid]);
      if (!Number.isFinite(oid) || !f.geometry) continue;
      const label = o.label ? f.properties?.[o.label] : null;
      const t = label == null || label === "" ? "" : String(label).trim();
      const box = boxOf(f.geometry);
      if (box) out.bbox.set(oid, box);
      if (o.point) {
        if (f.geometry.type !== "Point") continue;
        const [x, y] = f.geometry.coordinates;
        if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) continue;
        out.points.oid.push(oid);
        out.points.lon.push(x);
        out.points.lat.push(y);
        out.labels.push(t);
        out.attrs.push(f.properties ?? {});
      } else {
        out.shapes.features.push({ type: "Feature", id: oid, geometry: f.geometry, properties: { ...f.properties, oid, t: t || null } });
      }
    }
  return out;
}
