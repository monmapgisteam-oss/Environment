/*
  ЭРХИЙН ТОХИРГООНЫ ХАДГАЛАЛТ — порталын НЭГ hosted хүснэгт.

  Селбэ төслийн `permsRemote.ts`-ийн арга (хэрэглэгч 2026-10-16: "хэрхэн
  ажиллаж байгаа санааг Selbe-ээс ав"):
  · хүснэгт `Environment_Permissions` байгууллагад (org) хуваалцсан — бүх
    нэвтэрсэн хэрэглэгч уншина;
  · мөр бүр нэг бүртгэл: `username` · `views` (эрхийн JSON) · `removed`;
  · ⚠⚠ ХҮСНЭГТИЙГ ТОГТМОЛ ITEM ID-ААР олно (2026-11-23). Урьд нь гарчиг +
    эзний НЭРЭЭР хайдаг байсан тул админы нэвтрэх нэр хөтчийн багцад ил
    бичигддэг байв. ID нь мөн хуурамч ижил нэртэй item-аас хамгаална. Анх
    үүсгэх код (`createService` → `addToDefinition`) УСТСАН — хүснэгт
    2026-10-23-нд үүссэн; дахин хэрэгтэй бол git түүхээс.
  · ⚠ ХЯЗГААР: бичих эрх нь item-ийн хуваалцлаар — org-д засах эрхтэй хэн
    ч REST-ээр шууд засаж чадна. Сервер талгүй системд үүнээс чанга
    хамгаалалт байхгүй.
  Бүх дуудлага `arcgisJson`-оор (токен, 200 + `{error}` барина).
*/

import { arcgisJson } from "@/lib/arcgis";
import { normName, parseGrant, type Grant } from "@/lib/access";
import { SHARING } from "@/lib/portal";
import { logEvent } from "@/lib/audit";

/** `Environment_Permissions` hosted хүснэгтийн item */
const ITEM_ID = "4db24a9afcd14756ae67dfb6349021b9";

export type AccessRow = { username: string; grant: Grant; removed: boolean };

let urlCache: string | null = null;

const form = (fields: Record<string, string>): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ ...fields, f: "json" }),
});

/** Хүснэгтийн давхаргын хаяг — item олдохгүй бол `null` */
async function findTable(): Promise<string | null> {
  if (urlCache) return urlCache;
  const item = await arcgisJson<{ url?: string }>(`${SHARING}/content/items/${ITEM_ID}?f=json`, "Эрхийн тохиргоо хайх");
  urlCache = item?.url ? `${item.url}/0` : null;
  return urlCache;
}

type Raw = { oid: number; username?: string; views?: string; removed?: number };

/*
  ⚠ Enterprise-ийн hosted хүснэгт талбарын нэрийг ЖИЖИГ ҮСЭГ болгодог
  (`OBJECTID` → `objectid`). Урьд нь `r.OBJECTID` гэж уншдаг байсан тул дугаар
  үргэлж `undefined` болж, хадгалах бүрд засварын оронд ШИНЭ мөр нэмэгдэж,
  уншихад ХАМГИЙН ЭХНИЙ (хуучин) мөр авагддаг байв — "хадгалагдахгүй байна"
  (хэрэглэгч 2026-10-23). Түлхүүрийг том, жижиг үсгээс үл хамааран уншина.
*/
async function queryRows(url: string): Promise<Raw[]> {
  const j = await arcgisJson<{ features?: { attributes: Record<string, unknown> }[] }>(
    `${url}/query?${new URLSearchParams({ where: "1=1", outFields: "*", returnGeometry: "false", f: "json" })}`,
    "Эрхийн тохиргоо унших",
  );
  return (j.features ?? []).map((f) => {
    const a = Object.fromEntries(Object.entries(f.attributes).map(([k, v]) => [k.toLowerCase(), v]));
    return {
      oid: Number(a.objectid),
      username: typeof a.username === "string" ? a.username : undefined,
      views: typeof a.views === "string" ? a.views : undefined,
      removed: typeof a.removed === "number" ? a.removed : undefined,
    };
  });
}

/**
 * Бүртгэл тус бүрийн ХАМГИЙН СҮҮЛИЙН мөр (дугаар нь хамгийн их) — дээрх
 * алдааны улмаас нэг бүртгэл хэд хэдэн мөртэй үлдсэн; сүүлийнх нь хэрэглэгчийн
 * хамгийн сүүлд хадгалсан утга.
 */
function latest(rows: Raw[]): Map<string, Raw> {
  const by = new Map<string, Raw>();
  for (const r of rows) {
    const name = normName(r.username);
    if (!name || !Number.isFinite(r.oid)) continue;
    const prev = by.get(name);
    if (!prev || r.oid > prev.oid) by.set(name, r);
  }
  return by;
}

/**
 * Бүх мөрийг уншина. Хүснэгт хараахан үүсээгүй бол `null` — дуудагч тал
 * анхдагч эрхээр (`ACCOUNTS`) ажиллана.
 * ⚠ Эвдэрсэн JSON-той мөр ХААЛТТАЙ эрх болно (`{}`), хуучнаар нь үлдэхгүй.
 */
export async function readAccess(): Promise<AccessRow[] | null> {
  const url = await findTable();
  if (!url) return null;
  return [...latest(await queryRows(url))].map(([username, r]) => ({
    username,
    grant: parseGrant(r.views) ?? {},
    removed: r.removed === 1,
  }));
}

/**
 * Бүртгэлийн эрхийг хадгална (байвал засна, үгүй бол нэмнэ) — зөвхөн
 * админы хадгалалтаас дуудагдана.
 */
export async function saveAccess(rows: AccessRow[]): Promise<void> {
  const url = await findTable();
  if (!url) throw new Error("Эрхийн хүснэгт олдсонгүй");
  const all = await queryRows(url);
  const have = latest(all);
  const adds: unknown[] = [];
  const updates: unknown[] = [];
  const deletes: number[] = [];
  for (const r of rows) {
    const attributes = { username: r.username, views: JSON.stringify(r.grant), removed: r.removed ? 1 : 0 };
    const keep = have.get(r.username);
    if (keep) updates.push({ attributes: { ...attributes, objectid: keep.oid } });
    else adds.push({ attributes });
    /* Тэр бүртгэлийн хуучин давхар мөрүүдийг цэвэрлэнэ */
    for (const x of all) if (normName(x.username) === r.username && x !== keep && Number.isFinite(x.oid)) deletes.push(x.oid);
  }
  if (!adds.length && !updates.length) return;
  type Res = { success: boolean; error?: { description?: string } };
  const j = await arcgisJson<{ addResults?: Res[]; updateResults?: Res[]; deleteResults?: Res[] }>(
    `${url}/applyEdits`,
    "Эрхийн тохиргоо хадгалах",
    form({ adds: JSON.stringify(adds), updates: JSON.stringify(updates), deletes: deletes.join(",") }),
  );
  logEvent({ kind: "access", action: "save", detail: { accounts: rows.map((r) => ({ username: r.username, removed: r.removed, grant: r.grant })) } });
  /* Давхар мөр устгалт амжилтгүй байсан ч уншилт хамгийн сүүлийнхийг авдаг тул алдаа биш */
  const bad = [...(j.addResults ?? []), ...(j.updateResults ?? [])].find((r) => !r.success);
  if (bad) throw new Error(`Эрхийн тохиргоо хадгалагдсангүй${bad.error?.description ? ` (${bad.error.description})` : ""}`);
}
