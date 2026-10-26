/*
  ЭРХИЙН ТОХИРГООНЫ ХАДГАЛАЛТ — порталын НЭГ hosted хүснэгт.

  Селбэ төслийн `permsRemote.ts`-ийн арга (хэрэглэгч 2026-10-16: "хэрхэн
  ажиллаж байгаа санааг Selbe-ээс ав"):
  · хүснэгт `Environment_Permissions` нь супер админ (`portaladmin`) АНХ
    ХАДГАЛАХАД автоматаар үүснэ (`createService` → `addToDefinition`) ба
    байгууллагад (org) хуваалцагдана — бүх нэвтэрсэн хэрэглэгч уншина;
  · мөр бүр нэг бүртгэл: `username` · `views` (эрхийн JSON) · `removed`;
  · ⚠ ЭЗНИЙГ ШАЛГАНА: ижил нэртэй item-ыг org-ийн хэн ч үүсгэж болох тул
    ЗӨВХӨН `portaladmin`-ийн эзэмшдэгийг хүлээн авна — эс тэгвээс хуурамч
    хүснэгтээр эрх олгох боломжтой болно;
  · ⚠ ХЯЗГААР: бичих эрх нь item-ийн хуваалцлаар — org-д засах эрхтэй хэн
    ч REST-ээр шууд засаж чадна. Сервер талгүй системд үүнээс чанга
    хамгаалалт байхгүй.
  Бүх дуудлага `arcgisJson`-оор (токен, 200 + `{error}` барина).
*/

import { arcgisJson } from "@/lib/arcgis";
import { ADMIN_USERNAME, normName, parseGrant, type Grant } from "@/lib/access";
import { SHARING } from "@/lib/portal";

const TITLE = "Environment_Permissions";

export type AccessRow = { username: string; grant: Grant; removed: boolean };

type Item = { title?: string; owner?: string; url?: string; id?: string };

let urlCache: string | null = null;

const form = (fields: Record<string, string>): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ ...fields, f: "json" }),
});

/** Хүснэгтийн давхаргын хаяг — олдохгүй бол `null` */
async function findTable(): Promise<string | null> {
  if (urlCache) return urlCache;
  const q = `title:"${TITLE}" type:"Feature Service" owner:${ADMIN_USERNAME}`;
  const j = await arcgisJson<{ results?: Item[] }>(
    `${SHARING}/search?${new URLSearchParams({ q, num: "20", f: "json" })}`,
    "Эрхийн тохиргоо хайх",
  );
  const hit = (j.results ?? []).find(
    (x) => x.title === TITLE && normName(x.owner) === ADMIN_USERNAME && x.url,
  );
  urlCache = hit?.url ? `${hit.url}/0` : null;
  return urlCache;
}

/** Хүснэгт үүсгэнэ — ЗӨВХӨН `portaladmin` (дуудагч шалгана) */
async function createTable(): Promise<string> {
  const created = await arcgisJson<{ encodedServiceURL?: string; serviceurl?: string; itemId?: string }>(
    `${SHARING}/content/users/${ADMIN_USERNAME}/createService`,
    "Эрхийн хүснэгт үүсгэх",
    form({
      outputType: "featureService",
      createParameters: JSON.stringify({
        name: TITLE,
        serviceDescription: "Байгаль орчны нэгдсэн системийн хэрэглэгчийн эрх",
        hasStaticData: false,
        maxRecordCount: 2000,
        capabilities: "Query,Editing,Create,Update,Delete",
        spatialReference: { wkid: 102100 },
        allowGeometryUpdates: false,
        units: "esriMeters",
      }),
    }),
  );
  const service = created.encodedServiceURL ?? created.serviceurl;
  if (!service || !created.itemId) throw new Error("Эрхийн хүснэгт үүссэнгүй");

  await arcgisJson(
    `${service.replace("/rest/services/", "/rest/admin/services/")}/addToDefinition`,
    "Эрхийн хүснэгтийн бүтэц",
    form({
      addToDefinition: JSON.stringify({
        tables: [
          {
            name: "permissions",
            type: "Table",
            objectIdField: "OBJECTID",
            fields: [
              { name: "OBJECTID", type: "esriFieldTypeOID", nullable: false, editable: false },
              { name: "username", type: "esriFieldTypeString", length: 256, nullable: false, editable: true },
              { name: "views", type: "esriFieldTypeString", length: 8000, nullable: true, editable: true },
              { name: "removed", type: "esriFieldTypeSmallInteger", nullable: true, editable: true },
            ],
          },
        ],
      }),
    }),
  );
  /* Байгууллага даяар УНШИХ — нийтэд БИШ */
  await arcgisJson(
    `${SHARING}/content/users/${ADMIN_USERNAME}/items/${created.itemId}/share`,
    "Эрхийн хүснэгт хуваалцах",
    form({ org: "true", everyone: "false" }),
  );
  urlCache = `${service}/0`;
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
 * Бүртгэлийн эрхийг хадгална (байвал засна, үгүй бол нэмнэ). Хүснэгт
 * байхгүй бол ЭНД үүснэ — зөвхөн админы хадгалалтаас дуудагдана.
 */
export async function saveAccess(rows: AccessRow[]): Promise<void> {
  const url = (await findTable()) ?? (await createTable());
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
  /* Давхар мөр устгалт амжилтгүй байсан ч уншилт хамгийн сүүлийнхийг авдаг тул алдаа биш */
  const bad = [...(j.addResults ?? []), ...(j.updateResults ?? [])].find((r) => !r.success);
  if (bad) throw new Error(`Эрхийн тохиргоо хадгалагдсангүй${bad.error?.description ? ` (${bad.error.description})` : ""}`);
}
