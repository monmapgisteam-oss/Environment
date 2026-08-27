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

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "Tognii_shon";

export const POLES_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

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
  OBJECTID: number;
  F_?: number;
  Дүүрэг?: string;
  Хороо?: string;
  Байршил?: string;
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
      outFields: "OBJECTID,F_,Дүүрэг,Хороо,Байршил",
      outSR: "4326",
      /* Дугаарлалт нь шугам дагуух дэс дараа — эрэмбийг сервертээ тогтооно */
      orderByFields: "F_",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Шонгийн мэдээлэл татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };

  const rows: Pole[] = [];
  const points = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };

  for (const f of json.features ?? []) {
    const p = f.properties;
    if (f.geometry?.type !== "Point") continue;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    const oid = Number(p.OBJECTID);
    rows.push({
      oid,
      no: Number(p.F_) || rows.length + 1,
      district: tidy(p.Дүүрэг) || "Тодорхойгүй",
      khoroo: tidy(p.Хороо),
      place: tidy(p.Байршил) || "—",
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
