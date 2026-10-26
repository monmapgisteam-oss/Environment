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
 *     ⚠ Төлөвийн (ажиллаж байгаа / чөлөөтэй) талбар БАЙХГҮЙ — "Одоо
 *     ажиллаж байгаа" үзүүлэлт хүлээгдэж буй хэвээр.
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

export type Staff = {
  dept: string;
  slug: string | null;
  /** Газрын удирдлага ("Удирдлага") эсэх */
  lead: boolean;
  position: string;
  /** Төлөвийн талбар хүснэгтэд байхгүй тул одоогоор үргэлж `null` */
  active: boolean | null;
};

export async function fetchStaff(signal: AbortSignal): Promise<Staff[]> {
  const rows = await queryAll(ZAHIRGAA_LAYERS.staff, "Албан хаагчийн бүртгэл", ["хэлтэс", "албан_тушаал"], signal);
  return rows.map((a) => {
    const dept = text(a["хэлтэс"]);
    return {
      dept,
      slug: deptSlug(dept),
      lead: dept.toLowerCase() === LEAD_DEPT.toLowerCase(),
      position: text(a["албан_тушаал"]),
      active: null,
    };
  });
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

async function applyEdits(body: Record<string, string>) {
  const res = await arcgisJson<ApplyEdits>(`${EVENTS_EDIT_URL}/applyEdits?f=json`, "Арга хэмжээ хадгалах", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const r = res.addResults?.[0] ?? res.updateResults?.[0] ?? res.deleteResults?.[0];
  if (!r?.success) throw new Error(`Арга хэмжээ хадгалагдсангүй${r?.error?.description ? ` (${r.error.description})` : ""}`);
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
  if (id === undefined) await applyEdits({ adds: JSON.stringify([{ attributes }]) });
  else await applyEdits({ updates: JSON.stringify([{ attributes: { objectid: id, ...attributes } }]) });
}

export async function deleteEvent(id: number) {
  await applyEdits({ deletes: String(id) });
}
