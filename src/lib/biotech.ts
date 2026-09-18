/**
 * Биотехникийн арга хэмжээ — `A07_Biotechnik`, 14 байршил.
 *
 * Зэрлэг амьтдад зориулж хавар, намар ДАВС, ӨВС тавьсан бүртгэл.
 * Бичлэг бүр нэг БАЙРШИЛ: тэнд хэдэн килограмм давс, хэдэн боодол
 * өвс тавьсан, тэнд хүрэхэд хэдэн километр явсныг хэлнэ.
 *
 * ⚠⚠ **ДАВС ХАВАР БА НАМАР нь 14/14 МӨРД ЯГ ИЖИЛ** (2026-09-16-нд
 * шалгасан). Энэ нь хоёр тусдаа хэмжилт БИШ — нэг төлөвлөсөн хэмжээ
 * хоёр багананд бичигдсэн бололтой. Тиймээс хоёрыг НЭМЭХГҮЙ: нийт
 * давс нь 11,000 биш **5,500 кг**. Өвс нь харин үнэхээр ялгаатай
 * (11/14 мөрд л ижил) тул хавар, намар хоёр тусдаа утга бөгөөд
 * нийлбэр нь утгатай.
 *
 * ⚠ `он` (бүгд 2026), `сар` (бүгд 3), `өдөр` (бүгд 3), `огноо` (бүгд
 * нэг өдөр) нь ТОГТМОЛ — задаргаа ч, хэмжигдэхүүн ч болохгүй тул
 * уншаагүй. `батерей` мөн ганц утгатай ("байхгүй"), `мемори_карт`
 * хоёр утгатай ч 14-өөс 7 мөрд л бөглөгдсөн.
 */

import { arcgisJson } from "@/lib/arcgis";
import { pointOf } from "@/lib/extent";
import { layerService } from "@/lib/portal-layers";

export const BIOTECH_SERVICE = `${layerService("A07_Biotechnik")}/0`;

export type BiotechSite = {
  oid: number;
  lon: number;
  lat: number;
  /** Дугаарлалт — эх сурвалжийн `д/д` */
  no: number;
  /** Газрын нэр — бичлэг бүрд өөр */
  place: string;
  district: string;
  /** Давс, кг. Хавар, намар ижил тул НЭГ утга */
  salt: number | null;
  /** Өвс, боодол — хавар */
  haySpring: number | null;
  /** Өвс, боодол — намар */
  hayAutumn: number | null;
  /** Нийт явах зам, км */
  km: number | null;
  /** Бүртгэсэн албан хаагч */
  officer: string;
  /** Мемори карт байгаа эсэх. Бөглөгдөөгүй бол `null` */
  card: boolean | null;
};

/** Илүү зайг цэвэрлэнэ — эх бичвэрийг найруулахгүй */
const tidy = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

const numberOf = (v: unknown) => (typeof v === "number" ? v : null);

type Props = Record<string, unknown>;

export async function fetchBiotech(
  signal?: AbortSignal,
): Promise<BiotechSite[]> {
  const url =
    `${BIOTECH_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      orderByFields: "д_д",
      resultRecordCount: "2000",
      f: "json",
    });

  const json = await arcgisJson<{
    features?: {
      attributes: Props;
      geometry?: { x: number; y: number } | null;
    }[];
  }>(url, "Биотехникийн арга хэмжээ", { signal });

  const out: BiotechSite[] = [];

  for (const f of json.features ?? []) {
    const a = f.attributes;
    const g = f.geometry;

    /* Геометрийг эрхэмлэнэ, дутсан бол атрибутын координатаас */
    const at = pointOf(g, a["уртраг__x_"], a["өргөрөг__y_"]);
    if (!at) continue;
    const { lon, lat } = at;

    const card = tidy(a["мемори_карт"]);

    out.push({
      oid: Number(a.objectid),
      lon,
      lat,
      no: Number(a["д_д"]) || out.length + 1,
      place: tidy(a["газрын_нэр"]) || "Тодорхойгүй",
      district: tidy(a["дүүрэг"]) || "Бүртгэгдээгүй",
      /* Хавар, намрын утга ижил тул хаврынхыг авна; дутвал намрынх */
      salt: numberOf(a["давс__кг__хавар_"]) ?? numberOf(a["давс__кг__намар_"]),
      haySpring: numberOf(a["өвс__боодол__хавар_"]),
      hayAutumn: numberOf(a["өвс__боодол__намар_"]),
      km: numberOf(a["нийт_явах_зам__км"]),
      officer: tidy(a["бүртгэсэн"]),
      /* Бөглөгдөөгүйг "байхгүй" рүү БҮҮ хамааруул */
      card: card === "байгаа" ? true : card === "байхгүй" ? false : null,
    });
  }

  out.sort((x, y) => x.no - y.no);
  return out;
}
