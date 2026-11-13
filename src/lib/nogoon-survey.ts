/**
 * Ногоон бүсийн хэлтэс — "Судалгаа" цэс (хэрэглэгч 2026-11-13: "ene burtgeliin
 * ur dun nbahh deer sudalgaa gj nemegdeed orno").
 *
 * Эх сурвалж: **"Байгаль хамгаалагчийн аппликейшн"** Survey123 маягт
 * (`service_d29bedb4ee344a5593146769b0b02f73`, портал). Бүх хэлтэс НЭГ маягтаар
 * бөглөнө: `buglugch_heltes` (бөглөгчийн хэлтэс) × `angilal` (Зөрчил · Амьтан ·
 * Судалгаа · Бусад) × `turul`. Энд ЗӨВХӨН ногоон бүсийн хэлтсийн "Судалгаа"
 * ангиллын бүртгэл.
 *
 * ⚠ Давхарга 0 нь цэгэн (`survey`), хүснэгт 1 нь ҮЗҮҮЛЭЛТ (`uzuulelt`, нэг
 * бүртгэлд олон мөр — нэр · утга · нэгж), `parentrowid` → `uniquerowid`.
 *
 * ⚠⚠ ХУВЬ ХҮНИЙ МЭДЭЭЛЭЛ ТАТАХГҮЙ: маягтад бөглөгчийн нэр, албан тушаал,
 * регистр, утас зэрэг талбар бий — `outFields` нь ЦАГААН ЖАГСААЛТ.
 *
 * ⚠ `turul` талбарт домэйн БАЙХГҮЙ (маягтын `search()` сонголт) — нэр нь
 * маягтын өөрийн сонголтын жагсаалтаас (`media/songolt_ner.csv`, `turul:*`).
 * Дүүрэг, ангилал нь давхаргын домэйноос ажиллах үед уншигдана.
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";
import { pointOf } from "@/lib/extent";
import { inUlaanbaatar } from "@/lib/ub-boundary";

export const SURVEY_SERVICE = `${HOSTING}/Hosted/service_d29bedb4ee344a5593146769b0b02f73/FeatureServer`;

/** Маягтын сонголтын жагсаалтын `turul:*` мөрүүд */
const TURUL_NAMES: Record<string, string> = {
  duudlaga: "Дуудлага",
  monitoring: "Мониторинг судалгаа",
  hurs_sudalgaa: "Хөрсний судалгаа",
  bo_unelgee: "Байгаль орчны үнэлгээ",
  mod_toollogo: "Модны тооллого",
  gadargiin_us: "Гадаргын усны тооллого",
  hog: "Хог",
};

export type SurveyIndicator = {
  name: string;
  /** Утга нэгжтэйгээ ("3.1 %", "Тийм", "2026-10-20") */
  value: string;
};

export type SurveyRecord = {
  oid: number;
  /** Байршилгүй, эсвэл нийслэлээс гадуурх (бичилтийн алдаа) бол `null` */
  lon: number | null;
  lat: number | null;
  type: string;
  name: string;
  note: string;
  district: string;
  khoroo: string;
  /** UTC огноо, мс — бөглөөгүй бол `null` */
  date: number | null;
  indicators: SurveyIndicator[];
};

type Field = {
  name: string;
  domain?: { codedValues?: { code: string; name: string }[] } | null;
};
type Feature = {
  attributes: Record<string, unknown>;
  geometry?: { x?: number; y?: number } | null;
};
type Query = { features?: Feature[]; exceededTransferLimit?: boolean };

const RECORD_FIELDS =
  "objectid,uniquerowid,turul,duureg,horoo,ognoo,st_ner,st_tailbar";
const INDICATOR_FIELDS =
  "objectid,parentrowid,uz_ner,uz_utgiin_turul,uz_too,uz_negj,uz_bichver,uz_ognoo,uz_tiim_ugui,uz_utga";

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/** GUID-ийг харьцуулахад — хаалт, үсгийн хэмжээ үл хамаарна */
function guid(v: unknown): string {
  return text(v).replace(/[{}]/g, "").toLowerCase();
}

function domainOf(fields: Field[], name: string): Map<string, string> {
  const f = fields.find((x) => x.name === name);
  return new Map((f?.domain?.codedValues ?? []).map((c) => [c.code, c.name]));
}

async function queryAll(
  layer: number,
  where: string,
  outFields: string,
  geometry: boolean,
  signal: AbortSignal,
): Promise<Feature[]> {
  const out: Feature[] = [];
  for (let offset = 0; ; ) {
    const q = new URLSearchParams({
      where,
      outFields,
      returnGeometry: String(geometry),
      outSR: "4326",
      orderByFields: "objectid",
      resultOffset: String(offset),
      f: "json",
    });
    const page = await arcgisJson<Query>(
      `${SURVEY_SERVICE}/${layer}/query?${q}`,
      "Судалгааны бүртгэл",
      { signal },
    );
    const feats = page.features ?? [];
    out.push(...feats);
    if (!page.exceededTransferLimit || !feats.length) return out;
    offset += feats.length;
  }
}

/** Үзүүлэлтийн утга — нэгтгэсэн бичвэр байвал түүнийг, үгүй бол төрлөөр нь */
function indicatorValue(a: Record<string, unknown>, yesNo: Map<string, string>): string {
  /* Огноо нь платформын бусад огноотой нэг хэлбэрээр: 2026.10.20 */
  const dotted = (s: string) => s.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1.$2.$3");
  const joined = text(a.uz_utga);
  if (joined) return dotted(joined);
  const kind = text(a.uz_utgiin_turul);
  if (kind === "too" && a.uz_too != null)
    return [String(a.uz_too), text(a.uz_negj)].filter(Boolean).join(" ");
  if (kind === "ognoo" && typeof a.uz_ognoo === "number")
    return dotted(new Date(a.uz_ognoo).toISOString().slice(0, 10));
  if (kind === "tiim_ugui") return yesNo.get(text(a.uz_tiim_ugui)) ?? text(a.uz_tiim_ugui);
  return text(a.uz_bichver);
}

export async function fetchNogoonSurvey(signal: AbortSignal): Promise<SurveyRecord[]> {
  const [meta, table] = await Promise.all([
    arcgisJson<{ fields?: Field[] }>(`${SURVEY_SERVICE}/0?f=json`, "Судалгааны бүртгэл", { signal }),
    arcgisJson<{ fields?: Field[] }>(`${SURVEY_SERVICE}/1?f=json`, "Судалгааны үзүүлэлт", { signal }),
  ]);
  const districts = domainOf(meta.fields ?? [], "duureg");
  const yesNo = domainOf(table.fields ?? [], "uz_tiim_ugui");

  const [records, indicators] = await Promise.all([
    queryAll(
      0,
      "angilal = 'sudalgaa' AND buglugch_heltes = 'nogoon_bus'",
      RECORD_FIELDS,
      true,
      signal,
    ),
    queryAll(1, "uz_angilal = 'sudalgaa'", INDICATOR_FIELDS, false, signal),
  ]);

  const byParent = new Map<string, SurveyIndicator[]>();
  for (const f of indicators) {
    const a = f.attributes;
    const name = text(a.uz_ner);
    const value = indicatorValue(a, yesNo);
    if (!name && !value) continue;
    const key = guid(a.parentrowid);
    const list = byParent.get(key) ?? [];
    list.push({ name: name || "Үзүүлэлт", value: value || "—" });
    byParent.set(key, list);
  }

  return records.map((f) => {
    const a = f.attributes;
    const at = pointOf(f.geometry);
    /* Хамрах хүрээ нь нийслэл — гадуурх цэг нь бичилтийн алдаа */
    const located = at && inUlaanbaatar(at.lon, at.lat) ? at : null;
    const code = text(a.turul);
    const district = text(a.duureg);
    const khoroo = a.horoo == null ? "" : `${a.horoo}-р хороо`;
    return {
      oid: Number(a.objectid),
      lon: located?.lon ?? null,
      lat: located?.lat ?? null,
      type: TURUL_NAMES[code] ?? (code || "Бүртгэгдээгүй"),
      name: text(a.st_ner),
      note: text(a.st_tailbar),
      district: districts.get(district) ?? district,
      khoroo,
      date: typeof a.ognoo === "number" && a.ognoo > 0 ? a.ognoo : null,
      indicators: byParent.get(guid(a.uniquerowid)) ?? [],
    };
  });
}
