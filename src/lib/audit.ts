/*
  АУДИТЫН ЛОГ — хэн, хэзээ нэвтэрч гарсан, юу үзсэн, ямар өгөгдөл зассан.

  Хэрэглэгч 2026-11-09: "лог бүртгэл товч эрх товчны доор … энэ систем рүү
  орсон бүртгэл хэзээ орсон хэзээ гарсан юу харсан, ямар дата edit хийсэн гэдэг
  маш нарийн мэдээллийг мэдэх хэрэгтэй — өгөгдөл засах бүрэн эрхийг хэлтэст
  шилжүүлсэн тул хянах нь чухал". Зөвхөн порталын админ (`org_admin`) харна (`/log`).

  Хадгалалт нь `Environment_Permissions`-тэй НЭГ арга ({@link ./access-remote}):
  порталын hosted ХҮСНЭГТ `Environment_Log`, org-д хуваалцсан — бүх нэвтэрсэн
  хэрэглэгч ӨӨРИЙН токеноор мөр нэмнэ. Хүснэгтийг тогтмол item ID-аар олно
  (хуурамч ижил нэртэй хүснэгтээс сэргийлнэ). Хүснэгт олдохгүй бол үйл явдал
  чимээгүй хаягдана — лог нь үндсэн ажлыг хэзээ ч зогсоохгүй.

  Мөр: `username · kind · at · path · scope · tab · layer · ref_oid · action ·
  detail (JSON, ≤ 4000) · sid` — `sid` нь нэвтрэлт бүрийн санамсаргүй
  дугаар, "орсон → гарсан" хосыг холбоно (`sessionStorage`, таб бүрд).

  Төрөл (`kind`): `login` нэвтэрсэн · `logout` гарсан · `view` хуудас ·
  `tab` цэс · `edit` бүртгэл (нэмсэн, зассан, устгасан; `detail` нь өөрчилсөн
  талбарууд хуучин → шинэ) · `schema` талбар нэмсэн, устгасан · `access`
  эрхийн тохиргоо хадгалсан.

  Бичилт ДАРААЛАЛД цуглаж 1.5 с-ийн дараа нэг `applyEdits`-ээр явна; хуудас
  хаагдахад (`pagehide`) ба гарахад `navigator.sendBeacon`-оор (токен биед,
  толгойгүй) — хаагдаж буй хуудаснаас энгийн `fetch` дуусдаггүй.
  ⚠ Хувийн мэдээллийн хязгаарлалт ЛОГТ МӨН: `detail`-д иргэний утас, регистр
  зэрэг талбарыг засварлагч аль хэдийн хасдаг (`skipField`) тул ирдэггүй.
  ⚠ Хэрэглэгч REST-ээр шууд мөр нэмж, засаж чадна (org-д хуваалцсан) — сервер
  талгүй системийн хязгаар, эрхийн хүснэгттэй нэг зарчим.
*/

import { arcgisJson } from "@/lib/arcgis";
import { normName } from "@/lib/access";
import { readSession } from "@/lib/auth";
import { SHARING } from "@/lib/portal";

export type AuditKind = "login" | "logout" | "view" | "tab" | "edit" | "schema" | "access";

export type AuditEvent = {
  kind: AuditKind;
  path?: string;
  scope?: string;
  tab?: string;
  layer?: string;
  oid?: number | null;
  action?: string;
  detail?: unknown;
};

export type AuditRow = {
  id: number;
  at: number;
  username: string;
  kind: AuditKind;
  path: string | null;
  scope: string | null;
  tab: string | null;
  layer: string | null;
  refOid: number | null;
  action: string | null;
  detail: string | null;
  sid: string | null;
};

/**
 * `Environment_Log` hosted хүснэгтийн item. ⚠ Гарчиг + эзний НЭРЭЭР хайхаа
 * больсон (2026-11-23): админы нэвтрэх нэр хөтчийн багцад ил бичигддэг байв.
 * Анх үүсгэх код устсан — хүснэгт 2026-11-09-нд үүссэн; git түүхэнд бий.
 */
const LOG_ITEM_ID = "ec4e7aca123944d18d36be6be3a4040c";

const form = (fields: Record<string, string>): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ ...fields, f: "json" }),
});

let tableUrl: string | null = null;
let tableP: Promise<string | null> | null = null;
/** Олдоогүй гэж дахин хайх хугацаа (мс) — хэрэглэгч бүр порталыг дарахгүй */
const RETRY_MS = 10 * 60_000;
let missingAt = 0;

/** Хүснэгтийн хаяг — олдохгүй бол `null` (үйл явдал чимээгүй хаягдана) */
function logTable(): Promise<string | null> {
  if (tableUrl) return Promise.resolve(tableUrl);
  if (tableP) return tableP;
  if (missingAt && Date.now() - missingAt < RETRY_MS) return Promise.resolve(null);
  tableP = (async () => {
    try {
      const item = await arcgisJson<{ url?: string }>(`${SHARING}/content/items/${LOG_ITEM_ID}?f=json`, "Лог хайх");
      const url = item.url ? `${item.url}/0` : null;
      if (url) tableUrl = url;
      else missingAt = Date.now();
      return url;
    } catch {
      missingAt = Date.now();
      return null;
    } finally {
      tableP = null;
    }
  })();
  return tableP;
}

/* ---------- Сессийн дугаар ---------- */

const SID_KEY = "audit.sid";
function sid(): string {
  try {
    const v = sessionStorage.getItem(SID_KEY);
    if (v) return v;
    return newSid();
  } catch {
    return "";
  }
}
/** Нэвтрэлт бүрд шинэ дугаар — "орсон → гарсан" хос үүгээр холбогдоно */
export function newSid(): string {
  const v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try {
    sessionStorage.setItem(SID_KEY, v);
  } catch {}
  return v;
}

/* ---------- Бичилт ---------- */

const queue: Record<string, unknown>[] = [];
let timer: number | null = null;

const clip = (s: string | undefined, n: number) => (s == null ? null : s.length > n ? s.slice(0, n) : s);

export function logEvent(ev: AuditEvent): void {
  if (typeof window === "undefined") return;
  const s = readSession();
  if (!s?.username) return;
  let detail: string | null = null;
  if (ev.detail !== undefined) {
    try {
      detail = clip(typeof ev.detail === "string" ? ev.detail : JSON.stringify(ev.detail), 4000);
    } catch {
      detail = null;
    }
  }
  queue.push({
    username: normName(s.username),
    kind: ev.kind,
    at: Date.now(),
    path: clip(ev.path ?? window.location.pathname, 512),
    scope: clip(ev.scope, 64),
    tab: clip(ev.tab, 64),
    layer: clip(ev.layer, 256),
    ref_oid: ev.oid ?? null,
    action: clip(ev.action, 32),
    detail,
    sid: sid(),
  });
  if (timer == null) timer = window.setTimeout(() => void flush(), 1500);
}

async function flush(): Promise<void> {
  timer = null;
  if (!queue.length) return;
  const url = await logTable();
  if (!url) {
    queue.length = 0;
    return;
  }
  const batch = queue.splice(0, queue.length);
  try {
    await arcgisJson(`${url}/applyEdits`, "Лог бичих", form({ adds: JSON.stringify(batch.map((attributes) => ({ attributes }))) }));
  } catch {
    /* лог нь үндсэн ажлыг зогсоохгүй */
  }
}

/**
 * Хуудас хаагдах, гарах үед дараалалд үлдсэнийг `sendBeacon`-оор — хүснэгтийн
 * хаяг аль хэдийн мэдэгдсэн үед л (эхний flush-ээс хойш). Токенийг дуудагч
 * ГАРАХААС ӨМНӨ дуудна — дараа нь сесс арилсан байна.
 */
export function flushBeacon(): void {
  if (typeof navigator === "undefined" || !queue.length || !tableUrl) return;
  const token = readSession()?.token;
  if (!token) return;
  const batch = queue.splice(0, queue.length);
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
  const body = new URLSearchParams({ adds: JSON.stringify(batch.map((attributes) => ({ attributes }))), f: "json", token });
  navigator.sendBeacon(`${tableUrl}/applyEdits`, new Blob([body.toString()], { type: "application/x-www-form-urlencoded" }));
}

/* ---------- Унших (зөвхөн админы хуудас) ---------- */

const KINDS: AuditKind[] = ["login", "logout", "view", "tab", "edit", "schema", "access"];

function toRow(a: Record<string, unknown>): AuditRow | null {
  const o = Object.fromEntries(Object.entries(a).map(([k, v]) => [k.toLowerCase(), v]));
  const at = Number(o.at);
  const kind = String(o.kind ?? "") as AuditKind;
  if (!Number.isFinite(at) || !KINDS.includes(kind)) return null;
  const str = (k: string) => (typeof o[k] === "string" && o[k] ? (o[k] as string) : null);
  return {
    id: Number(o.objectid),
    at,
    username: str("username") ?? "",
    kind,
    path: str("path"),
    scope: str("scope"),
    tab: str("tab"),
    layer: str("layer"),
    refOid: typeof o.ref_oid === "number" ? o.ref_oid : null,
    action: str("action"),
    detail: str("detail"),
    sid: str("sid"),
  };
}

/**
 * Сүүлийн `days` хоногийн лог, шинэ нь эхэнд, дээд тал нь 2000 мөр.
 * Огнооны шүүлт татгалзвал (SQL бичиглэл) шүүлтгүй сүүлийн мөрүүд.
 */
export async function readLog(days: number): Promise<{ rows: AuditRow[]; url: string } | null> {
  const url = await logTable();
  if (!url) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
  const query = async (where: string) => {
    const j = await arcgisJson<{ features?: { attributes: Record<string, unknown> }[] }>(
      `${url}/query?${new URLSearchParams({ where, outFields: "*", returnGeometry: "false", orderByFields: "at DESC", resultRecordCount: "2000", f: "json" })}`,
      "Лог унших",
    );
    return (j.features ?? []).map((f) => toRow(f.attributes)).filter((r): r is AuditRow => !!r);
  };
  let rows: AuditRow[];
  try {
    rows = await query(`at >= TIMESTAMP '${since}'`);
  } catch {
    rows = await query("1=1");
  }
  return { rows, url };
}
