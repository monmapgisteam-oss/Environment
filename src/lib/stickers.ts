/**
 * Стикер байршуулсан барилгын мэдээлэл.
 *
 * Шилэн фасадтай барилгад шувуу мөргөхөөс сэргийлж наасан стикерийн
 * бүртгэл — 8 барилга, Сүхбаатар ба Хан-Уул дүүрэгт.
 *
 * ⚠️ Эх сурвалж нь наасан огноо, стикерийн тоо, талбайн хэмжээ зэргийг
 * агуулаагүй. Зөвхөн байршил, хаяг, барилгын нэр бий — бусдыг ТААМАГЛАЖ
 * БҮҮ БИЧ.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "Sticker_naalt";

export const STICKERS_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

export type Sticker = {
  oid: number;
  no: number;
  /** Барилгын нэр — "Central Tower", "Хаан банк" */
  name: string;
  /** Бүтэн хаяг — "СБД-ийн 8-р хороо Central Tower" */
  address: string;
  district: string;
  khoroo: string;
  lon: number;
  lat: number;
};

export type StickerData = {
  rows: Sticker[];
  points: { oid: number[]; lon: number[]; lat: number[] };
};

type Props = {
  OBJECTID: number;
  F_?: number;
  байршил_хаяг?: string;
  Дүүрэг?: string;
  Хороо?: string;
  Байршил?: string;
};

const tidy = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export async function fetchStickers(): Promise<StickerData> {
  const url =
    `${STICKERS_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,F_,байршил_хаяг,Дүүрэг,Хороо,Байршил",
      outSR: "4326",
      orderByFields: "F_",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Стикерийн мэдээлэл татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };

  const rows: Sticker[] = [];
  const points = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };

  for (const f of json.features ?? []) {
    const p = f.properties;
    if (f.geometry?.type !== "Point") continue;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    const oid = Number(p.OBJECTID);
    rows.push({
      oid,
      no: Number(p.F_) || rows.length + 1,
      name: tidy(p.Байршил) || "—",
      address: tidy(p.байршил_хаяг),
      district: tidy(p.Дүүрэг) || "Тодорхойгүй",
      khoroo: tidy(p.Хороо),
      lon,
      lat,
    });
    points.oid.push(oid);
    points.lon.push(lon);
    points.lat.push(lat);
  }

  return { rows, points };
}
