/**
 * НЭВТРЭЛТТЭЙ ӨГӨГДЛИЙН ФАЙЛ — порталын item болгон байршуулна / шинэчилнэ.
 *
 * ⚠⚠ ЯАГААД (2026-11-23, аюулгүй байдал): `public/` доторх файл статик
 * экспортод хуулагдаж НЭВТРЭЛТГҮЙ татагддаг байв — химийн бүртгэлийн 520 аж
 * ахуйн нэгжийн регистр, хаяг, координат, санхүүгийн хэлтсийн албан хаагчдын
 * нэр, гүйцэтгэл. Одоо эдгээр нь порталын item (org-д хуваалцсан, нийтэд БИШ),
 * хөтөч нь токеноор уншина (`src/lib/portal-data.ts`).
 *
 * Эх файлууд нь `data-private/` дотор (gitignore-т) — репо, сайтад орохгүй.
 *
 * Ажиллуулах (портал админы токеноор):
 *   PORTAL_TOKEN=… node scripts/upload-portal-data.mjs            — бүгд
 *   PORTAL_TOKEN=… node scripts/upload-portal-data.mjs chemsystem — нэг
 *
 * Item ID нь `src/lib/portal-data.ts`-д бичигдсэн бол тэр item-ийн ФАЙЛЫГ
 * солино (`update`); ID хоосон бол ШИНЭ item үүсгэж хуваалцаад ID-г хэвлэнэ —
 * түүнийг `portal-data.ts`-д бичнэ.
 *
 * ⚠ Токенийг хэвлэхгүй, файлд бичихгүй.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHARING = "https://environment.ub.gov.mn/gis/sharing/rest";
const TOKEN = process.env.PORTAL_TOKEN ?? "";

/* ⚠ ID нь `src/lib/portal-data.ts`-тэй ЯГ ижил байх ёстой (.mjs тул импортлохгүй) */
const FILES = {
  chemsystem: {
    file: "chemsystem.json",
    title: "Environment_data_chemsystem",
    snippet: "Химийн бодисын үндэсний бүртгэлийн хормын хувилбар (chemsystem.mn)",
    id: "42a8b7ebaf6b4629bb380fabbd16a2b9",
  },
  sanhuu: {
    file: "sanhuu-2026.json",
    title: "Environment_data_sanhuu_2026",
    snippet: "Санхүү аж ахуй, мониторингийн хэлтсийн 2026 оны ажлын төлөвлөгөөний биелэлт",
    id: "fb5bb94a61114109944602244bcce4ec",
  },
  duty: {
    file: "sanhuu-duty-analysis.json",
    title: "Environment_data_sanhuu_duty",
    snippet: "Санхүү аж ахуй, мониторингийн хэлтсийн чиг үүргийн шинжилгээ",
    id: "3b702d7c3563422c9032151dd605a04b",
  },
};

async function call(path, fields, file) {
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...fields, f: "json", token: TOKEN })) body.append(k, v);
  if (file) body.append("file", new Blob([file.data], { type: "application/json" }), file.name);
  const res = await fetch(`${SHARING}${path}`, { method: "POST", body });
  const j = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
  if (j.error) throw new Error(`${path.split("/").pop()}: ${j.error.message ?? j.error.code}`);
  return j;
}

async function main() {
  if (!TOKEN) {
    console.error("PORTAL_TOKEN хоосон байна");
    process.exitCode = 1;
    return;
  }
  const self = await call("/community/self", {});
  if (self.role !== "org_admin") throw new Error("Портал админы токен шаардлагатай");
  const user = self.username;

  const only = process.argv[2];
  for (const [key, f] of Object.entries(FILES)) {
    if (only && only !== key) continue;
    const data = await readFile(join(ROOT, "data-private", f.file));
    JSON.parse(data.toString("utf8")); /* эвдэрсэн JSON байршуулахгүй */
    /* ⚠ Энэ портал `JSON` item төрлийг хүлээж авдаггүй ("Item type not valid").
       `Application Configuration` нь JSON-г `text`-д хадгалж `/data`-аар
       буцаадаг — хөтөч яг тэр замаар уншина. */
    const text = data.toString("utf8");
    if (f.id) {
      await call(`/content/users/${user}/items/${f.id}/update`, { text });
      console.log(`${key}: шинэчлэв (${Math.round(data.length / 1024)} КБ)`);
      continue;
    }
    const created = await call(
      `/content/users/${user}/addItem`,
      { type: "Application Configuration", title: f.title, snippet: f.snippet, tags: "Environment,data", text },
    );
    /* Байгууллага даяар УНШИХ — нийтэд БИШ */
    await call(`/content/users/${user}/items/${created.id}/share`, { org: "true", everyone: "false" });
    console.log(`${key}: ШИНЭ item ${created.id} (${Math.round(data.length / 1024)} КБ) — portal-data.ts-д бич`);
  }
}

main().catch((e) => {
  console.error(e.message.replace(/token=[^&\s]+/g, "token=***"));
  process.exitCode = 1;
});
