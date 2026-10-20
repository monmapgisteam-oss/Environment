/**
 * Захиргаа удирдлагын хэлтэс — байгууллагын тойм.
 *
 * Хэрэглэгчийн шийдвэр (2026-10-20): хэвлэсэн загвар зургийн БҮТЦЭЭР,
 * платформын загвараар; дата нь ПОРТАЛЫН давхаргаас; эхний ээлжинд
 * ЗӨВХӨН ХАРУУЛНА (бичих боломж — шинэ ажилтан, сургалтын бүртгэл,
 * тайлангийн мэдэгдэл — дараагийн алхамд).
 *
 * ⚠ Бичиг хэргийн давхарга (Z02: ирсэн, явсан бичиг, өргөдөл гомдол)
 * ХАСАГДСАН (хэрэглэгч, 2026-10-20: "энэ хэрэггүй") — дахин бүү нэм.
 *
 * ⚠⚠ ДАВХАРГУУД ХАРААХАН НИЙТЛЭГДЭЭГҮЙ. Хаяг хоосон байх үед блок бүр
 * "Мэдээлэл хүлээгдэж байна" гэж харагдана — зохиомол тоо ОРУУЛАХГҮЙ
 * (загвар зураг дээрх 150, 1,245 зэрэг нь жишээ).
 *
 * Давхаргыг доорх талбарын бүтцээр нийтлээд хаягийг нь
 * `ZAHIRGAA_LAYERS`-д бичихэд л хангалттай. Талбарын нэр зөрвөл портал
 * "Field name … does not exist" гэж татгалзах ба тэр алдаа блок дээрээ
 * ил гарна — чимээгүй хоосон зурагдахгүй.
 *
 *   Z01 албан хаагч (мөр бүр нэг албан хаагч)
 *     heltes         String   хэлтэс — товчлол ("ЗУХ") эсвэл бүтэн нэр
 *     alban_tushaal  String   албан тушаал
 *     tuluv          String   "Ажиллаж байгаа" / "Чөлөөтэй" / …
 *     ⚠ Регистр, утас, хаяг ОРУУЛАХГҮЙ — хөтөч рүү буух ёсгүй.
 *
 *   Z03 арга хэмжээний хөтөлбөр
 *     ognoo  Date    арга хэмжээний огноо
 *     ner    String  арга хэмжээний нэр
 *     turul  String  өдөрлөг / сургалт / зөвлөгөөн / …
 *     heltes String  хариуцах хэлтэс (хэд хэдэн бол таслалаар)
 *     tuluv  String  төлөвлөгөөт / хэрэгжсэн / …
 *
 *   Z04 тайлангийн хуваарь
 *     ner       String  тайлангийн нэр
 *     hugatsaa  String  "Сар бүрийн 3-ны дотор" гэх мэт
 *     hariutsah String  хариуцах нэгж
 *
 * Хаягийг ДАВХАРГЫН дугаартай нь бичнэ (`…/FeatureServer/0`) — дугаар
 * 0 байна гэж таамаглахгүй (ногоон бүсийн давхаргууд 21–30 байсан).
 */

import { arcgisJson } from "@/lib/arcgis";
import { DEPARTMENTS, SHORT_NAMES } from "@/lib/departments";

export const ZAHIRGAA_LAYERS = {
  staff: "",
  events: "",
  reports: "",
} as const;

/**
 * Хэлтсийн танилцуулга — хэлтсийн БАТАЛСАН бичвэр ирэхэд энд бичнэ.
 * Загвар зураг дээрх бичвэрийг хуулаагүй: баталгаагүй.
 */
export const ZAHIRGAA_INTRO = "";

/** Байгууллагын албан нэр — толгойн тэмдэгтэй ижил */
export const ORG_NAME = "Нийслэлийн Байгаль орчны газар";

/* ------------------------------------------------------------------ */

type Attrs = Record<string, unknown>;
type Page = { features?: { attributes: Attrs }[]; exceededTransferLimit?: boolean };

const PAGE = 2000;

/** Хүснэгтийн бүх мөрийг хуудаслан татна — зөвхөн заасан талбаруудыг */
async function queryAll(
  url: string,
  label: string,
  fields: string[],
  signal: AbortSignal,
  order?: string,
): Promise<Attrs[]> {
  const out: Attrs[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const q = new URLSearchParams({
      where: "1=1",
      outFields: fields.join(","),
      returnGeometry: "false",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: "json",
    });
    if (order) q.set("orderByFields", order);
    const page = await arcgisJson<Page>(`${url}/query?${q}`, label, { signal });
    const rows = page.features ?? [];
    for (const f of rows) out.push(f.attributes);
    if (!page.exceededTransferLimit || rows.length === 0) return out;
  }
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const number = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v));

/**
 * Хэлтсийн бичиглэлийг бүртгэлийн `slug` руу буулгана: товчлол ("ЗУХ")
 * ба бүтэн нэрийг хоёуланг нь, том жижиг үсэг, зайг үл харгалзан.
 * Танигдаагүй бол `null` — диаграмд эх бичиглэлээрээ тусдаа багана болно.
 */
export function deptSlug(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  for (const d of DEPARTMENTS) {
    if (SHORT_NAMES[d.slug]?.toLowerCase() === t) return d.slug;
    if (d.name.toLowerCase() === t) return d.slug;
  }
  return null;
}

/* ------------------------------ Z01 ------------------------------- */

export type Staff = { dept: string; slug: string | null; position: string; status: string; active: boolean };

export async function fetchStaff(signal: AbortSignal): Promise<Staff[]> {
  const rows = await queryAll(ZAHIRGAA_LAYERS.staff, "Албан хаагчийн бүртгэл", ["heltes", "alban_tushaal", "tuluv"], signal);
  return rows.map((a) => {
    const dept = text(a.heltes);
    const status = text(a.tuluv);
    return {
      dept,
      slug: deptSlug(dept),
      position: text(a.alban_tushaal),
      status,
      active: /ажиллаж/i.test(status),
    };
  });
}

/* ------------------------------ Z03 ------------------------------- */

export type EventRow = { date: number | null; name: string; kind: string; dept: string; status: string };

export async function fetchEvents(signal: AbortSignal): Promise<EventRow[]> {
  const rows = await queryAll(ZAHIRGAA_LAYERS.events, "Арга хэмжээний хөтөлбөр", ["ognoo", "ner", "turul", "heltes", "tuluv"], signal, "ognoo");
  return rows
    .map((a) => {
      const d = number(a.ognoo);
      return {
        /* Тэг нь 1970 он биш — бөглөөгүйн тэмдэг */
        date: Number.isFinite(d) && d > 0 ? d : null,
        name: text(a.ner),
        kind: text(a.turul),
        dept: text(a.heltes),
        status: text(a.tuluv),
      };
    })
    .filter((r) => r.name);
}

/* ------------------------------ Z04 ------------------------------- */

export type ReportRow = { name: string; due: string; owner: string };

export async function fetchReports(signal: AbortSignal): Promise<ReportRow[]> {
  const rows = await queryAll(ZAHIRGAA_LAYERS.reports, "Тайлангийн хуваарь", ["ner", "hugatsaa", "hariutsah"], signal);
  return rows.map((a) => ({ name: text(a.ner), due: text(a.hugatsaa), owner: text(a.hariutsah) })).filter((r) => r.name);
}
