/**
 * Цахилгаан дамжуулах 10, 15 кВ-ын шонгууд.
 *
 * 30 шон, бүгд Сонгинохайрхан дүүргийн 32-р хороонд. Цэгүүд цахилгаан
 * дамжуулах шугамын дагуу дараалан байрлана — тархалт биш ШУГАМ юм.
 * Тиймээс дэс дараа нь утгатай: шон бүр өмнөх шонтойгоо тодорхой зайтай.
 *
 * ⚠️ **ХОЁР ТУСДАА ШУГАМ.** `Байршил` талбар нь хоёр утгатай: "Хун нуур"
 * (#1–17) ба "Ус цэвэршүүлэх байгууламж" (#18–30). Бүх цэгийг нэг
 * дараалалд холбовол #17 ба #18-ын хооронд 349 м-ийн ХУДАЛ хэрчим
 * үүсч, хоёр өөр шугам нэг мэт харагдана. Тиймээс зай, урт бүгд
 * байршлын ХҮРЭЭНД л тооцогдоно — байршил солигдох мөрд `gap` нь
 * `null`.
 *
 * ⚠️ Эх сурвалж нь шонгийн ТӨРӨЛ, тоноглол, хийгдсэн ажлын талаар ямар
 * ч талбар агуулаагүй. Тавьсан хамгаалалтын хэрэгсэл, огноог ТААМАГЛАЖ
 * БҮҮ БИЧ — хэлтсээс ирвэл нэмнэ.
 */

/*
  ⚠ **ЭХ СУРВАЛЖ ПОРТАЛД ШИЛЖСЭН** (хэрэглэгчийн шийдвэр, 2026-09-16):
  `Tognii_shon` → `A04_tognii_shon`. Бичлэгийн тоо ижил (30), утга нь
  ижил; талбарын нэр л өөрчлөгдсөн: `F_` → `д_д`, `Дүүрэг` → `дүүрэг`,
  `Хороо` → `хороо`, `Байршил` → `байршил` (портал бүгдийг жижиг үсэг
  болгож буулгадаг).
*/
import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";

export const POLES_SERVICE = `${layerService("A04_tognii_shon")}/0`;

export type Pole = {
  oid: number;
  /** Эх сурвалжийн дугаарлалт (`F_`) — шугам дагуух дэс дараа */
  no: number;
  district: string;
  khoroo: string;
  /** Байршлын нэр — "Хун нуур" */
  place: string;
  lon: number;
  lat: number;
  /**
   * Өмнөх шонгоос хойших зай, метр.
   *
   * Шугамын ЭХНИЙ шонд `null` — түүнээс хойш хэмжих зүйл байхгүй.
   * Байршил солигдсон мөрд ч `null`: тэр хоёр шон өөр өөр шугамынх
   * бөгөөд хоорондын зай нь техникийн ямар ч утгагүй.
   */
  gap: number | null;
};

export type PoleData = {
  rows: Pole[];
  points: { oid: number[]; lon: number[]; lat: number[] };
  /** Шугамын нийт урт, метр */
  length: number;
};

type Props = {
  objectid: number;
  д_д?: number;
  дүүрэг?: string;
  хороо?: string;
  байршил?: string;
};

const tidy = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Ойролцоо зай, метрээр. Нийслэлийн өргөрөгт зориулсан хялбар хувиргалт */
function meters(a: Pole, b: Pole): number {
  const kx = 111320 * Math.cos(47.9 * (Math.PI / 180));
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 110540);
}

export async function fetchPoles(): Promise<PoleData> {
  const url =
    `${POLES_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "objectid,д_д,дүүрэг,хороо,байршил",
      outSR: "4326",
      /* Дугаарлалт нь шугам дагуух дэс дараа — эрэмбийг сервертээ тогтооно */
      orderByFields: "д_д",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const json = await arcgisJson<{
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  }>(url, "Шонгийн мэдээлэл");

  const rows: Pole[] = [];
  const points = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };

  for (const f of json.features ?? []) {
    const p = f.properties;
    if (f.geometry?.type !== "Point") continue;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    const oid = Number(p.objectid);
    rows.push({
      oid,
      no: Number(p.д_д) || rows.length + 1,
      district: tidy(p.дүүрэг) || "Тодорхойгүй",
      khoroo: tidy(p.хороо),
      place: tidy(p.байршил) || "—",
      lon,
      lat,
      gap: null,
    });
    points.oid.push(oid);
    points.lon.push(lon);
    points.lat.push(lat);
  }

  /* Хөрш шонгийн зай — шугамын нягтралыг хэлнэ. Байршил солигдсон
     заагийг АЛГАСНА: тэр нь хоёр өөр шугамын хоорондох зай юм */
  let length = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].place !== rows[i - 1].place) continue;
    const d = meters(rows[i - 1], rows[i]);
    rows[i].gap = d;
    length += d;
  }

  return { rows, points, length };
}
