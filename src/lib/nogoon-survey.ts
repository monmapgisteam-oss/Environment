/**
 * Ногоон бүсийн хэлтэс — Байгаль хамгаалагчийн аппликейшны бүртгэл гурван цэсэд:
 * **Судалгаа**, **Модны тооллого**, **Хог** (хэрэглэгч 2026-11-13: "ene burtgeliin
 * ur dun nbahh deer sudalgaa gj nemegdeed orno" → "ene 2iig bas nbahh deer nemne").
 *
 * Эх сурвалж: **"Байгаль хамгаалагчийн аппликейшн"** Survey123 маягт
 * (`service_d29bedb4ee344a5593146769b0b02f73`, портал). Бүх хэлтэс НЭГ маягтаар
 * бөглөнө: `buglugch_heltes` × `angilal` (Зөрчил · Амьтан · Судалгаа · Бусад) ×
 * `turul`. ⚠⚠ БӨГЛӨГЧИЙН ХЭЛТСЭЭР ШҮҮХГҮЙ: хэрэглэгчийн өгсөн тоо (Хөрсний
 * судалгаа 2 · БО үнэлгээ 1 · Хог 4 · Модны тооллого 2) нь 2026-11-13 04:12-ын
 * байдлаар БҮХ хэлтсийнх байв (бүртгэл үүссэн огноогоор тулгасан).
 *
 * ⚠ Давхарга 0 нь цэгэн (`survey`), хүснэгт 1 нь ҮЗҮҮЛЭЛТ (`uzuulelt`, нэг
 * бүртгэлд олон мөр — нэр · утга · нэгж), `parentrowid` → `uniquerowid`.
 *
 * ⚠⚠ ХУВЬ ХҮНИЙ МЭДЭЭЛЭЛ ТАТАХГҮЙ: маягтад бөглөгчийн нэр, албан тушаал,
 * регистр, утас зэрэг талбар бий — `outFields` нь ЦАГААН ЖАГСААЛТ.
 *
 * ⚠ Утгууд нь домэйны КОД — давхаргын домэйноор ажиллах үед буулгана. `turul`
 * домэйнгүй (маягтын `search()` сонголт) — нэр нь маягтын сонголтын
 * жагсаалтаас (`media/songolt_ner.csv`, `turul:*`). Домэйнгүй сонголтын
 * талбарын нэрийг маягт `…_ner` хос баганад бичдэг (`bs_hog_ded_turul_ner`).
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";
import { pointOf } from "@/lib/extent";
import { inUlaanbaatar } from "@/lib/ub-boundary";
import { num } from "@/lib/utils";

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

export type RangerKind = "sudalgaa" | "mod" | "hog";

type KindSpec = {
  where: string;
  /** Тухайн төрлийн маягтын хэсгийн талбарын угтвар */
  prefix: string;
  /** Бүртгэлийн "төрөл" — задаргааны тэнхлэг */
  typeField: string | null;
};

const KINDS: Record<RangerKind, KindSpec> = {
  sudalgaa: { where: "angilal = 'sudalgaa'", prefix: "st_", typeField: null },
  mod: { where: "turul = 'mod_toollogo'", prefix: "st_", typeField: null },
  /* Хогны төрөл (Хог хаягдал · Эвдрэл доройтол · Бохир · Бусад) нь тэнхлэг */
  hog: { where: "turul = 'hog'", prefix: "bs_hog_", typeField: "bs_hog_turul" },
};

export type RangerIndicator = { name: string; value: string };

export type RangerRecord = {
  oid: number;
  /** Байршилгүй, эсвэл нийслэлээс гадуурх (бичилтийн алдаа) бол `null` */
  lon: number | null;
  lat: number | null;
  type: string;
  name: string;
  district: string;
  khoroo: string;
  /** UTC огноо, мс — бөглөөгүй бол `null` */
  date: number | null;
  /** Маягтын тухайн хэсгийн талбарууд — шошго · утга (хоосон нь "") */
  facts: [string, string][];
  indicators: RangerIndicator[];
};

type Field = {
  name: string;
  alias?: string;
  type: string;
  domain?: { codedValues?: { code: string; name: string }[] } | null;
};
type Feature = {
  attributes: Record<string, unknown>;
  geometry?: { x?: number; y?: number } | null;
};
type Query = { features?: Feature[]; exceededTransferLimit?: boolean };

const BASE_FIELDS = ["objectid", "uniquerowid", "turul", "duureg", "horoo", "ognoo"];
const INDICATOR_FIELDS =
  "objectid,parentrowid,uz_ner,uz_utgiin_turul,uz_too,uz_negj,uz_bichver,uz_ognoo,uz_tiim_ugui,uz_utga";

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/** GUID-ийг харьцуулахад — хаалт, үсгийн хэмжээ үл хамаарна */
function guid(v: unknown): string {
  return text(v).replace(/[{}]/g, "").toLowerCase();
}

function dateText(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

/** Огноо нь платформын бусад огноотой нэг хэлбэрээр: 2026.10.20 */
const dotted = (s: string) => s.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1.$2.$3");

function domains(fields: Field[]): Map<string, Map<string, string>> {
  return new Map(
    fields
      .filter((f) => f.domain?.codedValues?.length)
      .map((f) => [f.name, new Map(f.domain!.codedValues!.map((c) => [c.code, c.name]))]),
  );
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
      "Байгаль хамгаалагчийн аппликейшн",
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
  const joined = text(a.uz_utga);
  if (joined) return dotted(joined);
  const kind = text(a.uz_utgiin_turul);
  if (kind === "too" && a.uz_too != null)
    return [String(a.uz_too), text(a.uz_negj)].filter(Boolean).join(" ");
  if (kind === "ognoo" && typeof a.uz_ognoo === "number") return dateText(a.uz_ognoo);
  if (kind === "tiim_ugui") return yesNo.get(text(a.uz_tiim_ugui)) ?? text(a.uz_tiim_ugui);
  return text(a.uz_bichver);
}

/** Маягтын хэсгийн угтварыг шошгоос хасна ("Хог: Хогны төрөл" → "Хогны төрөл") */
const label = (f: Field) => (f.alias ?? f.name).replace(/^[^:]+:\s*/, "");

export async function fetchRangerRecords(
  kind: RangerKind,
  signal: AbortSignal,
): Promise<RangerRecord[]> {
  const spec = KINDS[kind];
  const [meta, table] = await Promise.all([
    arcgisJson<{ fields?: Field[] }>(`${SURVEY_SERVICE}/0?f=json`, "Байгаль хамгаалагчийн аппликейшн", { signal }),
    arcgisJson<{ fields?: Field[] }>(`${SURVEY_SERVICE}/1?f=json`, "Байгаль хамгаалагчийн аппликейшн", { signal }),
  ]);
  const fields = meta.fields ?? [];
  const codes = domains(fields);
  const yesNo = domains(table.fields ?? []).get("uz_tiim_ugui") ?? new Map<string, string>();

  /* Хэсгийн талбарууд маягтын дарааллаар. `X_ner` хос нь X-ийн нэр тул тусдаа
     мөр болохгүй — X-ийн утгыг орлоно */
  const names = new Set(fields.map((f) => f.name));
  const section = fields.filter(
    (f) => f.name.startsWith(spec.prefix) && !(f.name.endsWith("_ner") && names.has(f.name.slice(0, -4))),
  );
  const outFields = [
    ...BASE_FIELDS,
    ...section.map((f) => f.name),
    ...section.map((f) => `${f.name}_ner`).filter((n) => names.has(n)),
  ].join(",");

  const [records, indicators] = await Promise.all([
    queryAll(0, spec.where, outFields, true, signal),
    queryAll(1, "1=1", INDICATOR_FIELDS, false, signal),
  ]);

  const byParent = new Map<string, RangerIndicator[]>();
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

  const valueOf = (f: Field, a: Record<string, unknown>): string => {
    const named = text(a[`${f.name}_ner`]);
    if (named) return named;
    const raw = a[f.name];
    if (raw == null || raw === "") return "";
    if (f.type === "esriFieldTypeDate" && typeof raw === "number") return dateText(raw);
    if (typeof raw === "number") return num(raw, Number.isInteger(raw) ? 0 : 2);
    const t = text(raw);
    return codes.get(f.name)?.get(t) ?? t;
  };

  return records.map((r) => {
    const a = r.attributes;
    const at = pointOf(r.geometry);
    /* Хамрах хүрээ нь нийслэл — гадуурх цэг нь бичилтийн алдаа */
    const located = at && inUlaanbaatar(at.lon, at.lat) ? at : null;
    /* Хэмжээ нь нэгжийнхээ хамт нэг мөрөнд ("120 тн") — `…hemjee` + `…negj` */
    const unitField = fields.find((f) => f.name === `${spec.prefix}negj`);
    const unit = unitField ? valueOf(unitField, a) : "";
    /* Нэр ба төрөл нь толгойд — баримтын жагсаалтад давтахгүй */
    const merged = section
      .filter((f) => f.name !== "st_ner" && f.name !== spec.typeField && f !== unitField)
      .map((f): [string, string] => {
        const v = valueOf(f, a);
        return [label(f), f.name === `${spec.prefix}hemjee` && v && unit ? `${v} ${unit}` : v];
      });
    const code = text(a.turul);
    const typeField = spec.typeField ? fields.find((f) => f.name === spec.typeField) : null;
    const type = typeField ? valueOf(typeField, a) : TURUL_NAMES[code] ?? code;
    const name = text(a.st_ner) || text(a.bs_hog_ded_turul_ner) || type;
    return {
      oid: Number(a.objectid),
      lon: located?.lon ?? null,
      lat: located?.lat ?? null,
      type: type || "Бүртгэгдээгүй",
      name,
      district: codes.get("duureg")?.get(text(a.duureg)) ?? text(a.duureg),
      khoroo: a.horoo == null ? "" : `${a.horoo}-р хороо`,
      date: typeof a.ognoo === "number" && a.ognoo > 0 ? a.ognoo : null,
      facts: merged,
      indicators: byParent.get(guid(a.uniquerowid)) ?? [],
    };
  });
}
