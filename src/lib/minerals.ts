/**
 * Нийслэлийн нутаг дэвсгэр дэх ашигт малтмалын тусгай зөвшөөрөлтэй талбай
 * (нүүрс, алт, шавар).
 *
 * ЭНЭ ЭХ СУРВАЛЖ ЦЭГЭН давхарга боловч цэг бүр нь бие даасан обьект БИШ —
 * тусгай зөвшөөрлийн талбайн БУЛАНГИЙН цэг юм. 81 цэг нийтдээ ердөө 6
 * зөвшөөрлийг тодорхойлно (`тусгай_дугаар`-аар бүлэглэнэ). Цэгийг нь дан
 * дангаар нь тоолбол "81 уурхай" гэсэн худал дүр зураг гарна.
 *
 * Талбайн ХҮРЭЭГ булангийн цэгээс нь сэргээнэ: `objectid`-ийн дарааллаар
 * холбож хаана. Энэ дараалал нь талбайг тойрсон дэс дараа мөн эсэхийг
 * гурван шалгуураар нотолсон:
 *   1. Хаасан олон өнцөгтийн талбай нь `талбай_га` талбарт бичигдсэн
 *      албан ёсны хэмжээтэй бүх 6 зөвшөөрөл дээр 1%-иас бага зөрүүтэй.
 *   2. Ямар ч цагираг өөртэйгээ огтлолцохгүй (48 булантай Налайхынх ч).
 *   3. Зөвшөөрлүүдийн хүрээ хоорондоо давхцахгүй.
 * Гүдгэр бүрхүүл (convex hull) авах гэж БҮҮ ОРОЛД — Налайхын талбай
 * дээр 15% илүү гарна.
 *
 * Бүртгэл ЖИЖИГ (6 мөр) тул шүүлт, задаргаа биш ХУГАЦАА нь гол: 1996–2046
 * онуудад тархсан 3–50 жилийн хугацаатай зөвшөөрлүүд.
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";

const SERVICE = `${HOSTING}/Hosted/X03_Ashigt_maltmal/FeatureServer/7`;

export const MINERALS_SERVICE = SERVICE;

export type MineralSite = {
  /** Бүлэглэсний дараах дугаар — газрын зураг ба жагсаалтыг холбоно */
  id: number;
  /** "MV-000221" */
  code: string;
  /** Талбайн нэр — "Налайх", "Ундрах толгой" */
  name: string;
  holder: string;
  /** Улсын бүртгэлийн дугаар */
  registry: string;
  /** Ашигт малтмалын төрөл — "Нүүрс", "Алт", "Шавар тоосгоны" */
  mineral: string;
  district: string;
  ha: number;
  granted: number | null;
  expires: number | null;
  /** Албан ёсны огноо бүтнээрээ — "1996.05.14" */
  grantedDate: string;
  expiresDate: string;
  /** Талбайг тодорхойлсон булангийн цэгийн тоо */
  corners: number;
};

export type MineralData = {
  sites: MineralSite[];
  /** Талбайн хүрээ — `id` нь `MineralSite.id`-тай тэнцүү */
  shapes: GeoJSON.FeatureCollection;
  /** Булангийн цэгүүд. `oid` нь тухайн цэгийн ХАРЬЯА зөвшөөрлийн `id` */
  corners: { oid: number[]; lon: number[]; lat: number[] };
  /** Зөвшөөрөл бүрийн цэгүүдийн хамрах хүрээ — ойртоход хэрэглэнэ */
  bounds: Map<number, [number, number, number, number]>;
};

type Props = {
  objectid: number;
  тусгай_дугаар?: string;
  талбай_га?: number;
  дүүрэг?: string;
  регистрын_дугаар?: string;
  олгосон_жил?: number;
  олгосон_сар?: number;
  олгосон_өдөр?: number;
  дуусах_жил?: number;
  дуусах_сар?: number;
  дуусах_өдөр?: number;
  нэр?: string;
  эзэмшигчийн_нэр?: string;
  төрөл?: string;
  soum_name?: string;
};

const FIELDS = [
  "objectid",
  "тусгай_дугаар",
  "талбай_га",
  "дүүрэг",
  "регистрын_дугаар",
  "олгосон_жил",
  "олгосон_сар",
  "олгосон_өдөр",
  "дуусах_жил",
  "дуусах_сар",
  "дуусах_өдөр",
  "нэр",
  "эзэмшигчийн_нэр",
  "төрөл",
  "soum_name",
];

/**
 * Огноог задарсан талбаруудаас угсарна.
 *
 * `Олгосон_он` нь epoch мс-ээр ирдэг боловч түүнийг хөрвүүлбэл хөтчийн
 * цагийн бүсээс шалтгаалж өдөр нэгээр гулсана. Жил/сар/өдөр нь тусад нь
 * тоогоор бичигдсэн тул тэднийг шууд хэрэглэнэ.
 */
function stamp(y?: number, m?: number, d?: number): string {
  if (!y) return "—";
  const p = (n?: number) => String(n ?? 1).padStart(2, "0");
  return `${y}.${p(m)}.${p(d)}`;
}

/** Хугацааны төлөв — жагсаалт цөөн тул ердөө хоёр байдал хангалттай */
export function isExpired(s: MineralSite, now: number): boolean {
  return s.expires != null && s.expires < now;
}

export async function fetchMinerals(): Promise<MineralData> {
  const url =
    `${MINERALS_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: FIELDS.join(","),
      outSR: "4326",
      /* Булангийн цэг нь дарааллаараа утгатай — эрэмбийг сервертээ
         тогтооно, эс тэгвээс хүрээ нь орооцолдоно */
      orderByFields: "objectid",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const json = await arcgisJson<{
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  }>(url, "Ашигт малтмалын талбай");

  /* Тусгай дугаараар нь бүлэглэнэ — дугаар нь ганц зөвшөөрлийг заана */
  const groups = new Map<string, { p: Props; pts: [number, number][] }>();

  for (const f of json.features ?? []) {
    const p = f.properties;
    const code = p.тусгай_дугаар?.trim() || "—";
    if (!f.geometry || f.geometry.type !== "Point") continue;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    const hit = groups.get(code) ?? { p, pts: [] };
    hit.pts.push([lon, lat]);
    groups.set(code, hit);
  }

  const sites: MineralSite[] = [];
  const shapes: GeoJSON.Feature[] = [];
  const corners = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };
  const bounds = new Map<number, [number, number, number, number]>();

  let id = 0;
  for (const [code, g] of groups) {
    const p = g.p;
    id++;
    sites.push({
      id,
      code,
      name: p.нэр?.trim() || "—",
      holder: p.эзэмшигчийн_нэр?.trim() || "—",
      registry: p.регистрын_дугаар?.trim() || "—",
      mineral: p.төрөл?.trim() || "Тодорхойгүй",
      district: p.дүүрэг?.trim() || p.soum_name?.trim() || "Тодорхойгүй",
      ha: Number(p.талбай_га) || 0,
      granted: p.олгосон_жил ? Number(p.олгосон_жил) : null,
      expires: p.дуусах_жил ? Number(p.дуусах_жил) : null,
      grantedDate: stamp(p.олгосон_жил, p.олгосон_сар, p.олгосон_өдөр),
      expiresDate: stamp(p.дуусах_жил, p.дуусах_сар, p.дуусах_өдөр),
      corners: g.pts.length,
    });

    let w = 180;
    let s = 90;
    let e = -180;
    let n = -90;
    for (const [lon, lat] of g.pts) {
      corners.oid.push(id);
      corners.lon.push(lon);
      corners.lat.push(lat);
      if (lon < w) w = lon;
      if (lon > e) e = lon;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
    if (w <= e) bounds.set(id, [w, s, e, n]);

    /* Гурваас цөөн булантай бол олон өнцөгт болохгүй — цэг нь үлдэнэ */
    if (g.pts.length < 3) continue;
    const ring = [...g.pts];
    /* GeoJSON цагираг хаалттай байх ёстой */
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) ring.push([fx, fy]);
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` шаардлагатай */
      id,
      properties: { oid: id },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }

  /* Талбайн хэмжээгээр — том нь эхэндээ */
  sites.sort((a, b) => b.ha - a.ha);

  return {
    sites,
    shapes: { type: "FeatureCollection", features: shapes },
    corners,
    bounds,
  };
}
