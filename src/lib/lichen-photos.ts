/**
 * Хагийн зүйлийн ЗУРАГ — давхаргын хавсралтаас.
 *
 * Хэлтэс 2026-09-16-нд `A02_hag_sudalgaa` давхаргад зураг хавсаргав
 * (`hasAttachments: true`).
 *
 * ⚠⚠ **ЗУРАГ нь ЗҮЙЛИЙНХ, бичлэгийнх БИШ.** 2,391 бичлэгийн 245-д
 * хавсралт байгаа боловч ДАВХАРДАЛГҮЙ файл нь ердөө **23**: нэг
 * зүйлийн бүх мөр ИЖИЛ зургийг (`Acarospora_badiofusca.jpg`) дахин
 * дахин үүрдэг. Тиймээс бичлэг бүрээр татвал 20 МБ-ын давхардсан
 * зураг хөтөч рүү орох байв — ЗҮЙЛ тутамд НЭГ л хавсралт барина.
 *
 * ⚠ 183 зүйлийн ердөө **23-д** нь зураг бий (13%). Зураггүй зүйл
 * дээр самбар юу ч харуулахгүй — "зураг байхгүй" гэсэн хоосон хайрцаг
 * гаргах нь зай эзлэхээс өөр юу ч хэлэхгүй.
 *
 * ⚠ Толийг НЭГ удаагийн `queryAttachments` хүсэлтээр угсарна: бичлэг
 * тус бүрд асуувал 2,391 хүсэлт болно. Зургийн БИЕ нь харин зөвхөн
 * хэрэглэгч тухайн зүйлийг сонгоход татагдана.
 */

import { arcgisBlobUrl, arcgisJson } from "@/lib/arcgis";
import { LICHENS_SERVICE } from "@/lib/lichens";

/** Зүйлийн нэрийг харьцуулахад бэлтгэнэ — бичиглэлийн зөрүү элбэг */
function key(sci: string): string {
  return sci.replace(/\s+/g, " ").trim().toLowerCase();
}

type AttachmentInfo = { id: number; name: string; contentType: string };

type QueryAttachments = {
  attachmentGroups?: {
    parentObjectId: number;
    attachmentInfos?: AttachmentInfo[];
  }[];
};

/** Зүйлийн түлхүүр → хавсралтын хаяг */
export type LichenPhotos = Map<string, { oid: number; id: number }>;

/**
 * Зүйл бүрийн ЭХНИЙ зургийг олно.
 *
 * `sciByOid` нь давхаргаас аль хэдийн уншсан бичлэгүүдээс гарна —
 * хавсралтын хүсэлт нь зүйлийн нэрийг буцаадаггүй тул дугаараар нь
 * холбоно.
 */
export async function fetchLichenPhotos(
  sciByOid: Map<number, string>,
  signal?: AbortSignal,
): Promise<LichenPhotos> {
  const url =
    `${LICHENS_SERVICE}/queryAttachments?` +
    new URLSearchParams({
      definitionExpression: "1=1",
      returnUrl: "false",
      f: "json",
    });

  const json = await arcgisJson<QueryAttachments>(url, "Хагийн зураг", {
    signal,
  });

  const out: LichenPhotos = new Map();
  for (const g of json.attachmentGroups ?? []) {
    const first = g.attachmentInfos?.[0];
    if (!first || !first.contentType.startsWith("image/")) continue;
    const sci = sciByOid.get(g.parentObjectId);
    if (!sci) continue;
    const k = key(sci);
    /* Эхнийхийг үлдээнэ — нэг зүйлийн бүх хуулбар ижил файл */
    if (!out.has(k)) out.set(k, { oid: g.parentObjectId, id: first.id });
  }
  return out;
}

/**
 * Зургийн биеийг татаж хөтчийн дотоод хаяг болгоно.
 *
 * Нэг удаа татсаныг санах ойд үлдээнэ: хэрэглэгч зүйл хооронд
 * сэлгэхэд дахин татах шаардлагагүй. Буцаасан хаягийг суллахгүй —
 * кэшэд үлдэх ёстой (зөвхөн 23 зураг).
 */
const cache = new Map<string, Promise<string>>();

export function lichenPhotoUrl(
  photos: LichenPhotos,
  sci: string,
): Promise<string> | null {
  const at = photos.get(key(sci));
  if (!at) return null;

  const id = `${at.oid}/${at.id}`;
  const hit = cache.get(id);
  if (hit) return hit;

  const p = arcgisBlobUrl(
    `${LICHENS_SERVICE}/${at.oid}/attachments/${at.id}`,
    "Хагийн зураг",
  ).catch((e: Error) => {
    /* Амжилтгүй бол кэшээс хасна — дараагийн оролдлого шинээр явна */
    cache.delete(id);
    throw e;
  });
  cache.set(id, p);
  return p;
}

/** Тухайн зүйлд зураг бий эсэх */
export function hasPhoto(photos: LichenPhotos, sci: string): boolean {
  return photos.has(key(sci));
}
