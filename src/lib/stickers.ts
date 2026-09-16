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

/*
  ⚠ **ЭХ СУРВАЛЖ ПОРТАЛД ШИЛЖСЭН** (хэрэглэгчийн шийдвэр, 2026-09-16):
  `Sticker_naalt` → `A05_shilen_barilga_sticker`.

  ⚠⚠ **АГУУЛГА НЬ ӨРГӨЖСӨН.** Хуучин давхарга нь стикер НААСАН найман
  барилга байсан бол шинэ нь ШИЛЭН БАРИЛГЫН СУДАЛГАА: 78 барилга,
  тэдгээрийн зөвхөн 8-д нь стикер наагдсан (`stiker = tiim`). Өөрөөр
  хэлбэл хуучин найм нь энэ судалгааны дэд олонлог.

  Тиймээс `sticker` талбар нь бичлэг бүрд ЗААВАЛ гарна: 78 барилгыг
  бүгдийг нь "стикер байршуулсан" гэж харуулах нь ХУДАЛ болно.
*/
import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";

export const STICKERS_SERVICE = `${layerService("A05_shilen_barilga_sticker")}/0`;

export type Sticker = {
  oid: number;
  no: number;
  /** Барилгын нэр — "Central Tower", "Хаан банк" */
  name: string;
  /** Бүтэн хаяг — "СБД-ийн 8-р хороо Central Tower" */
  address: string;
  district: string;
  khoroo: string;
  /** Стикер наагдсан эсэх. Бөглөгдөөгүй бол `null` */
  sticker: boolean | null;
  lon: number;
  lat: number;
};

export type StickerData = {
  rows: Sticker[];
  points: { oid: number[]; lon: number[]; lat: number[] };
};

type Props = {
  objectid: number;
  rec_id?: number;
  ner?: string;
  hayag?: string;
  duureg?: string;
  horoo?: string;
  /** Стикер наагдсан эсэх — домэйн: `tiim` / `ugui` */
  stiker?: string;
};

const tidy = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export async function fetchStickers(
  signal?: AbortSignal,
): Promise<StickerData> {
  const url =
    `${STICKERS_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "objectid,rec_id,ner,hayag,duureg,horoo,stiker",
      outSR: "4326",
      orderByFields: "rec_id",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const json = await arcgisJson<{
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  }>(url, "Шилэн барилгын судалгаа", { signal });

  const rows: Sticker[] = [];
  const points = {
    oid: [] as number[],
    lon: [] as number[],
    lat: [] as number[],
  };

  for (const f of json.features ?? []) {
    const p = f.properties;
    if (f.geometry?.type !== "Point") continue;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    const oid = Number(p.objectid);
    rows.push({
      oid,
      no: Number(p.rec_id) || rows.length + 1,
      name: tidy(p.ner) || "—",
      address: tidy(p.hayag),
      district: tidy(p.duureg) || "Тодорхойгүй",
      khoroo: tidy(p.horoo),
      /* Домэйн: `tiim` / `ugui`. Гуравдагч утга нь бөглөгдөөгүй */
      sticker: p.stiker === "tiim" ? true : p.stiker === "ugui" ? false : null,
      lon,
      lat,
    });
    points.oid.push(oid);
    points.lon.push(lon);
    points.lat.push(lat);
  }

  return { rows, points };
}
