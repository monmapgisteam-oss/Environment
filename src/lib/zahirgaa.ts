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
 *   Z01 албан хаагч — ХОЛБОГДСОН (2026-10-22): `Hosted/Staffs`, ХҮСНЭГТ
 *     (геометргүй), дугаар 0, 99 мөр. Талбарыг токеноор шалгасан:
 *     хэлтэс         String   хэлтсийн БҮТЭН нэр (бүртгэлтэй яг таарна)
 *                             эсвэл "Удирдлага" (газрын дарга, хэлтэс биш)
 *     албан_тушаал   String   албан тушаал
 *     ⚠ нэр, ажлын_утас, албан_хаагчийн_утас, цахим_шуудангийн_хаяг,
 *     өрөө__ нь ТАТАГДАХГҮЙ — хувь хүний мэдээлэл хөтөч рүү буухгүй.
 *     төлөв          String   Ажиллаж байгаа · Чөлөөтэй · Ажлаас гарсан
 *                             (2026-10-26-нд нэмэх — хэрэглэгчийн шийдвэр:
 *                             ажлаас гарсныг УСТГАХГҮЙ, төлөвөөр тэмдэглэнэ).
 *     ⚠ Талбар хүснэгтэд байгаа эсэхийг давхаргын тодорхойлолтоос уншина —
 *     нэмэгдээгүй үед төлөвгүйгээр ажилласаар ("Одоо ажиллаж байгаа"
 *     хүлээгдэж буй), алдаа өгөхгүй.
 *     ⚠ БҮРТГЭЛ ЗАСАХ ({@link fetchStaffRecords}, {@link saveStaff}): нэрийг
 *     ЗӨВХӨН засварлагч (календарийн бүлэг — хэрэглэгчийн шийдвэр) татна;
 *     утас, имэйл, өрөө хэзээ ч татагдахгүй.
 *
 *   Z03 арга хэмжээний хөтөлбөр — ҮҮСГЭСЭН (2026-10-22, хэрэглэгчийн
 *     хүсэлт: календарьт гараар бичдэг болгох). ХҮСНЭГТ, хоёр үйлчилгээ:
 *     · `Hosted/Z03_Arga_hemjee` — ЗАСВАРЛАХ эх (Query, Create, Update,
 *       Delete), ЗӨВХӨН "Захиргаа удирдлагын хэлтэс — арга хэмжээ
 *       засварлагч" бүлэгт хуваалцсан (`4eac15b7…`, урилгаар элсэнэ);
 *     · `Hosted/Z03_Arga_hemjee_view` — УНШИХ view (зөвхөн Query),
 *       байгууллага даяар хуваалцсан.
 *     Хуудас view-ээс уншиж, эх рүү бичнэ; засах эрхийг эх хүснэгтэд
 *     хандаж чадах эсэхээр тогтооно ({@link canEditEvents}) — эрх нь
 *     СЕРВЕР дээр, бүлгийн гишүүнчлэлээр хамгаалагдсан.
 *     ognoo   Date    арга хэмжээний огноо (UTC 12:00 — өдөр зөрөхгүй)
 *     ner     String  арга хэмжээний нэр
 *     turul   String  төрөл (Хурал, Сургалт, Өдөрлөг, Уулзалт, Тайлан, Шалгалт, Бусад)
 *     heltes  String  хариуцах хэлтэс — ТОВЧ нэрс таслалаар ("ЗУХ, ХХ") эсвэл "Бүх хэлтэс"
 *     tuluv   String  төлөв
 *     tailbar String  тайлбар
 *
 *   Z04 тайлангийн хуваарь — ХАСАГДСАН (хэрэглэгч 2026-10-22).
 *
 * Хаягийг ДАВХАРГЫН дугаартай нь бичнэ (`…/FeatureServer/0`) — дугаар
 * 0 байна гэж таамаглахгүй (ногоон бүсийн давхаргууд 21–30 байсан).
 */

import { arcgisJson } from "@/lib/arcgis";
import { DEPARTMENTS, SHORT_NAMES } from "@/lib/departments";

export const ZAHIRGAA_LAYERS = {
  staff: "https://environment.ub.gov.mn/hosting/rest/services/Hosted/Staffs/FeatureServer/0",
  events: "https://environment.ub.gov.mn/hosting/rest/services/Hosted/Z03_Arga_hemjee_view/FeatureServer/0",
} as const;

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

/** Газрын удирдлага — хэлтэс биш, бүтцийн ҮНДЭСТ харьяалагдана */
export const LEAD_DEPT = "Удирдлага";

export const STAFF_STATUS_FIELD = "төлөв";
export const STAFF_STATUSES = ["Ажиллаж байгаа", "Чөлөөтэй", "Ажлаас гарсан"];
export const STAFF_WORKING = "Ажиллаж байгаа";
export const STAFF_LEFT = "Ажлаас гарсан";

export type Staff = {
  dept: string;
  slug: string | null;
  /** Газрын удирдлага ("Удирдлага") эсэх */
  lead: boolean;
  position: string;
  /** Төлөв бүртгэгдээгүй (эсвэл талбар байхгүй) бол `null` */
  active: boolean | null;
};

type LayerDef = { objectIdField?: string; fields?: { name: string }[] };
const defs = new Map<string, Promise<LayerDef>>();

/** Давхаргын тодорхойлолт (талбарууд, дугаарын талбар) — нэг удаа, кэштэй */
function layerDef(url: string): Promise<LayerDef> {
  let p = defs.get(url);
  if (!p) {
    p = arcgisJson<LayerDef>(`${url}?f=json`, "Албан хаагчийн бүртгэл");
    p.catch(() => defs.delete(url));
    defs.set(url, p);
  }
  return p;
}

const hasField = (def: LayerDef, name: string) => (def.fields ?? []).some((f) => f.name === name);

/** Нийтийн тоо — ажлаас гарсан хүн ОРОХГҮЙ */
export async function fetchStaff(signal: AbortSignal): Promise<Staff[]> {
  const def = await layerDef(ZAHIRGAA_LAYERS.staff);
  const status = hasField(def, STAFF_STATUS_FIELD);
  const rows = await queryAll(
    ZAHIRGAA_LAYERS.staff,
    "Албан хаагчийн бүртгэл",
    ["хэлтэс", "албан_тушаал", ...(status ? [STAFF_STATUS_FIELD] : [])],
    signal,
  );
  return rows
    .filter((a) => text(a[STAFF_STATUS_FIELD]) !== STAFF_LEFT)
    .map((a) => {
      const dept = text(a["хэлтэс"]);
      const st = status ? text(a[STAFF_STATUS_FIELD]) : "";
      return {
        dept,
        slug: deptSlug(dept),
        lead: dept.toLowerCase() === LEAD_DEPT.toLowerCase(),
        position: text(a["албан_тушаал"]),
        active: st ? st === STAFF_WORKING : null,
      };
    });
}

/* --------------------------- Z01 засвар --------------------------- */

/** Засварлах эх — одоогоор унших хаягтай ижил хүснэгт */
export const STAFF_EDIT_URL = ZAHIRGAA_LAYERS.staff;

export type StaffRecord = { id: number; name: string; dept: string; position: string; status: string };

/** Засварлагчийн жагсаалт — нэртэй. Төлөвийн талбар байгаа эсэхийг хамт буцаана */
export async function fetchStaffRecords(signal: AbortSignal): Promise<{ rows: StaffRecord[]; hasStatus: boolean }> {
  const def = await layerDef(STAFF_EDIT_URL);
  const oid = def.objectIdField ?? "objectid";
  const hasStatus = hasField(def, STAFF_STATUS_FIELD);
  const rows = await queryAll(
    STAFF_EDIT_URL,
    "Албан хаагчийн бүртгэл",
    [oid, "нэр", "хэлтэс", "албан_тушаал", ...(hasStatus ? [STAFF_STATUS_FIELD] : [])],
    signal,
  );
  return {
    hasStatus,
    rows: rows
      .map((a) => ({
        id: number(a[oid]),
        name: text(a["нэр"]),
        dept: text(a["хэлтэс"]),
        position: text(a["албан_тушаал"]),
        status: hasStatus ? text(a[STAFF_STATUS_FIELD]) : "",
      }))
      .sort((x, y) => x.name.localeCompare(y.name, "mn")),
  };
}

/** Бүртгэлийг бүрмөсөн устгана (хэрэглэгч 2026-10-26) — ажлаас гарсныг төлөвөөр тэмдэглэнэ */
export async function deleteStaff(id: number) {
  await applyEdits(STAFF_EDIT_URL, "Албан хаагч устгах", { deletes: String(id) });
}

export type StaffInput = { name: string; dept: string; position: string; status: string };

/** Шинээр нэмнэ (`id` байхгүй) эсвэл засна. Төлөвийн талбар байхгүй бол төлөв бичихгүй */
export async function saveStaff(input: StaffInput, id?: number) {
  const def = await layerDef(STAFF_EDIT_URL);
  const oid = def.objectIdField ?? "objectid";
  const attributes: Record<string, unknown> = {
    "нэр": input.name.trim(),
    "хэлтэс": input.dept.trim() || null,
    "албан_тушаал": input.position.trim() || null,
  };
  if (hasField(def, STAFF_STATUS_FIELD)) attributes[STAFF_STATUS_FIELD] = input.status.trim() || null;
  if (id === undefined) await applyEdits(STAFF_EDIT_URL, "Албан хаагч хадгалах", { adds: JSON.stringify([{ attributes }]) });
  else await applyEdits(STAFF_EDIT_URL, "Албан хаагч хадгалах", { updates: JSON.stringify([{ attributes: { [oid]: id, ...attributes } }]) });
}

/* ------------------------------ Z03 ------------------------------- */

/** Засварлах эх хүснэгт — зөвхөн ЗУХ-ийн засварлагч бүлэгт хуваалцсан */
export const EVENTS_EDIT_URL = "https://environment.ub.gov.mn/hosting/rest/services/Hosted/Z03_Arga_hemjee/FeatureServer/0";

export type EventRow = { id: number; date: number | null; name: string; kind: string; dept: string; status: string; note: string };

export async function fetchEvents(signal: AbortSignal): Promise<EventRow[]> {
  const rows = await queryAll(
    ZAHIRGAA_LAYERS.events,
    "Арга хэмжээний хөтөлбөр",
    ["objectid", "ognoo", "ner", "turul", "heltes", "tuluv", "tailbar"],
    signal,
    "ognoo",
  );
  return rows
    .map((a) => {
      const d = number(a.ognoo);
      return {
        id: number(a.objectid),
        /* Тэг нь 1970 он биш — бөглөөгүйн тэмдэг */
        date: Number.isFinite(d) && d > 0 ? d : null,
        name: text(a.ner),
        kind: text(a.turul),
        dept: text(a.heltes),
        status: text(a.tuluv),
        note: text(a.tailbar),
      };
    })
    .filter((r) => r.name);
}

/**
 * Хэрэглэгч эх хүснэгтэд хандаж чадах эсэх — чадвал засварлагч бүлгийн
 * гишүүн (эсвэл админ). Чадахгүй бол портал 403 буцаадаг тул `false`.
 */
export async function canEditEvents(signal: AbortSignal): Promise<boolean> {
  try {
    await arcgisJson(`${EVENTS_EDIT_URL}?f=json`, "Арга хэмжээ засварлах", { signal });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return false;
  }
}

export type EventInput = { day: string; name: string; kind: string; dept: string; status: string; note: string };

/** "2026-10-22" → тухайн өдрийн UTC 12:00 — Улаанбаатарын цагаар ч мөн өдөр */
const dayToMs = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
};

type EditResult = { success: boolean; error?: { description?: string } };
type ApplyEdits = { addResults?: EditResult[]; updateResults?: EditResult[]; deleteResults?: EditResult[] };

async function applyEdits(url: string, label: string, body: Record<string, string>) {
  const res = await arcgisJson<ApplyEdits>(`${url}/applyEdits?f=json`, label, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const r = res.addResults?.[0] ?? res.updateResults?.[0] ?? res.deleteResults?.[0];
  if (!r?.success) throw new Error(`${label} амжилтгүй${r?.error?.description ? ` (${r.error.description})` : ""}`);
}

/** Шинээр нэмнэ (`id` байхгүй) эсвэл засна */
export async function saveEvent(input: EventInput, id?: number) {
  const attributes: Record<string, unknown> = {
    ognoo: dayToMs(input.day),
    ner: input.name.trim(),
    turul: input.kind.trim() || null,
    heltes: input.dept.trim() || null,
    tuluv: input.status.trim() || null,
    tailbar: input.note.trim() || null,
  };
  if (id === undefined) await applyEdits(EVENTS_EDIT_URL, "Арга хэмжээ хадгалах", { adds: JSON.stringify([{ attributes }]) });
  else await applyEdits(EVENTS_EDIT_URL, "Арга хэмжээ хадгалах", { updates: JSON.stringify([{ attributes: { objectid: id, ...attributes } }]) });
}

export async function deleteEvent(id: number) {
  await applyEdits(EVENTS_EDIT_URL, "Арга хэмжээ устгах", { deletes: String(id) });
}
