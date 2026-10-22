/**
 * Баавгай тохиолдлын бүртгэл — `A09_baawgai_burtgel`.
 *
 * Иргэдийн дуудлагаар бүртгэсэн хүрэн баавгайн (Ursus arctos)
 * тохиолдол: хэзээ, хаана, баталгаажсан эсэх. ТОКЕНООР шалгасан
 * (2026-10-14): 47 цэг, бүгд 2026 оны 8–10 сар, 8 дүүрэг. Зүйл нь
 * ганц тул задаргаа болохгүй — гол асуулт нь ДҮҮРЭГ ба БАТАЛГААЖИЛТ
 * (Батлагдсан · Мөр олдсон · Олоогүй · Хуурамч · Тодорхойгүй).
 */

import { arcgisJson } from "@/lib/arcgis";
import { pointOf } from "@/lib/extent";
import { layerService } from "@/lib/portal-layers";

export const BEAR_LAYER = `${layerService("A09_baawgai_burtgel")}/0`;

export type BearCase = {
  oid: number;
  /**
   * Байршил — координат бүртгэгдээгүй тохиолдолд `null` (хэрэглэгч
   * 2026-10-20: "координатын мэдээлэл байхгүй тохиолдолд яаж оруулж
   * харах уу"). Ийм тохиолдол тоо, диаграм, жагсаалтад БАЙНА, газрын
   * зурагт ГАРАХГҮЙ — төв рүү "нөхөж" тавихгүй (зохиомол байршил болно).
   */
  lon: number | null;
  lat: number | null;
  district: string;
  status: string;
  /** Дуудлагын огноо (epoch мс) эсвэл `null` */
  date: number | null;
  /** Түүхий атрибут — диаграм ба цонхонд */
  attrs: Record<string, unknown>;
};

export type BearData = {
  rows: BearCase[];
  /** ЗӨВХӨН байршилтай тохиолдол — индекс нь `rows.filter(located)`-тэй ижил */
  points: { oid: number[]; lon: number[]; lat: number[] };
};

/** Байршилтай эсэх — газрын зургийн индекс түүгээр угсрагдана */
export const located = (r: BearCase): r is BearCase & { lon: number; lat: number } =>
  r.lon != null && r.lat != null;

const tidy = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

export async function fetchBears(signal?: AbortSignal): Promise<BearData> {
  const url =
    `${BEAR_LAYER}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      orderByFields: "дуудлагын_огноо DESC",
      resultRecordCount: "2000",
      f: "json",
    });

  const json = await arcgisJson<{
    features?: {
      attributes: Record<string, unknown>;
      geometry?: { x: number; y: number } | null;
    }[];
  }>(url, "Баавгай тохиолдлын бүртгэл", { signal });

  const rows: BearCase[] = [];
  const points = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };

  for (const f of json.features ?? []) {
    const a = f.attributes;
    const at = pointOf(f.geometry, a["уртраг__x__wgs84_"], a["өргөрөг__y__wgs84_"]);
    const oid = Number(a.objectid);
    const d = a["дуудлагын_огноо"];
    rows.push({
      oid,
      lon: at?.lon ?? null,
      lat: at?.lat ?? null,
      district: tidy(a["дүүрэг"]) || "Бүртгэгдээгүй",
      status: tidy(a["баталгаажилт"]) || "Бүртгэгдээгүй",
      date: typeof d === "number" && d > 0 ? d : null,
      attrs: a,
    });
    if (!at) continue;
    points.oid.push(oid);
    points.lon.push(at.lon);
    points.lat.push(at.lat);
  }

  return { rows, points };
}

/** Огноог "2026.09.30" хэлбэрээр (UTC — эх сурвалж өдрийн огноо хадгалдаг) */
export function dateText(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

/* --------------------------------------------------------------------------
   ЗАСВАР — нэмэх, засах, устгах (хэрэглэгч 2026-10-14: "координат бичээд
   map дээр шууд нэмдэг … тэгээд түүнийгээ edit хийнэ бас устгана")
   --------------------------------------------------------------------------

   ⚠ Давхарга `Create,Update,Delete` эрхтэй (2026-10-14-нд шалгасан).
   Засах эрхгүй хэрэглэгчид портал алдаа буцаана — `arcgisJson` түүнийг
   барьж мессеж болгоно.
   ⚠ Давхаргын геометр UTM 48N (32648). Геометрийг хөтөч дээр ӨӨРӨӨ
   хөрвүүлж илгээнэ — серверийн проекцод найдахгүй.
   ⚠ Давхардсан талбаруудыг (он, сар, өдөр, координатын эх бичилт,
   өргөрөг, уртраг) маягтаас ДАМ бөглөнө — хэрэглэгч хоёр газар бичихгүй,
   хоёр утга хэзээ ч зөрөхгүй.
*/

/** Маягтын утгууд — хоосон мөр нь `null` болж хадгалагдана */
export type BearInput = {
  /** Хоёулаа `null` бол байршилгүй тохиолдол — геометргүй хадгалагдана */
  lat: number | null;
  lon: number | null;
  /** Дуудлагын огноо — UTC шөнө дунд (epoch мс), эсвэл `null` */
  date: number | null;
  district: string;
  khoroo: string;
  place: string;
  address: string;
  age: string;
  raw: string;
  status: string;
  harm: string;
  note: string;
};

/** WGS84 → UTM 48N (EPSG:32648). Тэнхлэг хоорондын алдаа < 1 мм */
export function toUtm48(lat: number, lon: number) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const φ = (lat * Math.PI) / 180;
  const λ = ((lon - 105) * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2);
  const T = Math.tan(φ) ** 2;
  const C = ep2 * Math.cos(φ) ** 2;
  const A = Math.cos(φ) * λ;
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * φ -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * φ) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * φ) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * φ));
  const x =
    500000 +
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120);
  const y =
    k0 *
    (M +
      N *
        Math.tan(φ) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));
  return { x, y };
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

function attributesOf(v: BearInput) {
  const d = v.date != null ? new Date(v.date) : null;
  return {
    дуудлагын_огноо: v.date,
    он: d ? d.getUTCFullYear() : null,
    сар: d ? d.getUTCMonth() + 1 : null,
    өдөр: d ? d.getUTCDate() : null,
    дүүрэг: orNull(v.district),
    хороо: orNull(v.khoroo),
    газрын_нэр: orNull(v.place),
    дуудлага_өгсөн_хаяг__эх_: orNull(v.address),
    нас___төлөв: orNull(v.age),
    зүйлийн_эх_бичилт: orNull(v.raw),
    баталгаажилт: orNull(v.status),
    хохирол: orNull(v.harm),
    тэмдэглэл__эх_: orNull(v.note),
    өргөрөг__y__wgs84_: v.lat,
    уртраг__x__wgs84_: v.lon,
    координатын_эх_бичилт: v.lat != null && v.lon != null ? `${v.lat} ${v.lon}` : null,
  };
}

type EditResult = { success: boolean; objectId?: number; error?: { description?: string } };

async function applyEdits(body: Record<string, string>, label: string) {
  const json = await arcgisJson<{
    addResults?: EditResult[];
    updateResults?: EditResult[];
    deleteResults?: EditResult[];
  }>(`${BEAR_LAYER}/applyEdits`, label, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, f: "json" }),
  });
  const r = [...(json.addResults ?? []), ...(json.updateResults ?? []), ...(json.deleteResults ?? [])][0];
  if (!r?.success)
    throw new Error(`${label} амжилтгүй${r?.error?.description ? ` (${r.error.description})` : ""}`);
  return r.objectId;
}

/** Байршилгүй бол `null` — давхарга геометргүй бүртгэлийг хүлээн авна */
const geometryOf = (v: BearInput) =>
  v.lat != null && v.lon != null
    ? { ...toUtm48(v.lat, v.lon), spatialReference: { wkid: 32648 } }
    : null;

/**
 * Шинэ тохиолдол нэмнэ. Зүйл нь давхаргын бүх бүртгэлд ижил тул
 * (Хүрэн баавгай, Ursus arctos) маягтад асуухгүй. `д_д` нь одоогийн
 * хамгийн их дугаараас нэгээр.
 */
export function addBear(v: BearInput, nextNo: number) {
  const feature = {
    geometry: geometryOf(v),
    attributes: {
      ...attributesOf(v),
      д_д: nextNo,
      зүйлийн_монгол_нэр: "Хүрэн баавгай",
      латин_нэр: "Ursus arctos",
    },
  };
  return applyEdits({ adds: JSON.stringify([feature]) }, "Тохиолдол нэмэх");
}

export function updateBear(oid: number, v: BearInput) {
  const feature = {
    geometry: geometryOf(v),
    attributes: { objectid: oid, ...attributesOf(v) },
  };
  return applyEdits({ updates: JSON.stringify([feature]) }, "Тохиолдол засах");
}

export function deleteBear(oid: number) {
  return applyEdits({ deletes: String(oid) }, "Тохиолдол устгах");
}
