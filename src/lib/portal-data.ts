/*
  НЭВТРЭЛТТЭЙ ӨГӨГДЛИЙН ФАЙЛ — порталын item (2026-11-23).

  ⚠⚠ Урьд нь `public/data/*.json` байсан тул статик экспортод хуулагдаж
  НЭВТРЭЛТГҮЙ татагддаг байв (аж ахуйн нэгжийн регистр, хаяг, албан хаагчдын
  нэр). Одоо порталын `Application Configuration` item — org-д хуваалцсан,
  нийтэд БИШ; хөтөч `arcgisJson`-оор (токентой) `/data`-аас уншина.
  Байршуулах, шинэчлэх: `scripts/upload-portal-data.mjs` (ID нь тэнд ч бий).
*/

import { arcgisJson } from "@/lib/arcgis";
import { SHARING } from "@/lib/portal";

export const PORTAL_DATA = {
  /** Химийн бодисын үндэсний бүртгэлийн хормын хувилбар */
  chemsystem: "42a8b7ebaf6b4629bb380fabbd16a2b9",
  /** Санхүүгийн хэлтсийн 2026 оны ажлын төлөвлөгөөний биелэлт */
  sanhuu: "fb5bb94a61114109944602244bcce4ec",
  /** Санхүүгийн хэлтсийн чиг үүргийн шинжилгээ */
  duty: "3b702d7c3563422c9032151dd605a04b",
} as const;

export function fetchPortalData<T>(key: keyof typeof PORTAL_DATA, label: string, signal?: AbortSignal): Promise<T> {
  return arcgisJson<T>(`${SHARING}/content/items/${PORTAL_DATA[key]}/data`, label, signal ? { signal } : undefined);
}
