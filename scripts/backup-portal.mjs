// Порталын өгөгдлийн нөөц хуулбар — ЗӨВХӨН УНШИНА.
//
// Порталын (environment.ub.gov.mn) hosted давхарга, хүснэгт бүрийн бүх мөрийг
// геометр, атрибуттайгаар нь Esri JSON болгон огноотой хавтсанд хадгална.
// Устсан, эвдэрсэн өгөгдлийг сэргээх үндэс.
//
//   node scripts/backup-portal.mjs
//
// Орчны хувьсагч:
//   ARCGIS_KEY_FILE  API key-тэй файл (анхдагч: ../token_private.txt —
//                    репогоос ГАДНА). Түлхүүр кодонд, логт хэзээ ч гарахгүй.
//   BACKUP_DIR       Хадгалах хавтас (анхдагч: ../backup). Дотор нь
//                    YYYY-MM-DD хавтас үүснэ. ⚠ Хувь хүний мэдээлэлтэй
//                    давхарга орно — репо, нийтийн хавтсанд БҮҮ хадгал.
//   BACKUP_SKIP      Алгасах үйлчилгээний нэрийн regex
//                    (анхдагч: Parcel_all — кадастрын 524 мянган дүрс,
//                    манай өгөгдөл биш, хэдэн зуун МБ).
//
// API key-д хандах эрх өгөөгүй үйлчилгээ 403 буцаана — алгасаж,
// манифестэд тэмдэглэнэ. Засах хүсэлт ОГТ илгээхгүй.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEY_FILE = process.env.ARCGIS_KEY_FILE ?? resolve(ROOT, "../token_private.txt");
const BASE = process.env.BACKUP_DIR ?? resolve(ROOT, "../backup");
const SKIP = new RegExp(process.env.BACKUP_SKIP ?? "^(Parcel_all)$|_form$", "i");
const HOST = "https://environment.ub.gov.mn/hosting/rest/services";

const KEY = readFileSync(KEY_FILE, "utf8").replace(/\s+/g, "");
const HEAD = { "X-Esri-Authorization": `Bearer ${KEY}` };
const day = new Date().toISOString().slice(0, 10);
const OUT = join(BASE, day);

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEAD });
      const json = await res.json();
      if (json.error) {
        const err = new Error(`${json.error.code} ${json.error.message}`);
        err.code = json.error.code;
        throw err;
      }
      return json;
    } catch (err) {
      // Эрхийн алдааг давтахгүй — үр дүн өөрчлөгдөхгүй
      if (err.code === 403 || err.code === 498 || err.code === 499 || i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

const safe = (s) => s.replace(/[\\/:*?"<>|]/g, "_");

async function backupLayer(svcUrl, svcName, layer) {
  const url = `${svcUrl}/${layer.id}`;
  const info = await get(`${url}?f=json`);
  const oid = info.objectIdField ?? "objectid";
  const page = Math.min(info.maxRecordCount || 2000, 2000);
  const features = [];
  for (let offset = 0; ; offset += page) {
    const q = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      orderByFields: `${oid} ASC`,
      resultOffset: String(offset),
      resultRecordCount: String(page),
      f: "json",
    });
    const r = await get(`${url}/query?${q}`);
    features.push(...(r.features ?? []));
    if (!r.exceededTransferLimit && (r.features ?? []).length < page) break;
  }
  const file = join(OUT, safe(svcName), `${layer.id}_${safe(layer.name)}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({
      service: svcName,
      layer: layer.id,
      name: layer.name,
      geometryType: info.geometryType ?? null,
      spatialReference: info.extent?.spatialReference ?? null,
      fields: info.fields,
      features,
    }),
  );
  return features.length;
}

const dir = await get(`${HOST}/Hosted?f=json`);
const services = dir.services
  .filter((s) => s.type === "FeatureServer")
  .map((s) => s.name.replace(/^Hosted\//, ""))
  .filter((n) => !SKIP.test(n));

mkdirSync(OUT, { recursive: true });
const manifest = { date: new Date().toISOString(), services: {} };
let next = 0;
const started = Date.now();

await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < services.length) {
      const name = services[next++];
      const svcUrl = `${HOST}/Hosted/${encodeURIComponent(name)}/FeatureServer`;
      try {
        const svc = await get(`${svcUrl}?f=json`);
        const counts = {};
        for (const layer of [...(svc.layers ?? []), ...(svc.tables ?? [])]) {
          counts[`${layer.id} ${layer.name}`] = await backupLayer(svcUrl, name, layer);
        }
        manifest.services[name] = { ok: true, counts };
        console.log(`✓ ${name}  ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
      } catch (err) {
        const denied = err.code === 403;
        manifest.services[name] = { ok: false, skipped: denied, error: err.message };
        console.log(`${denied ? "–" : "✗"} ${name}  ${denied ? "хандах эрхгүй" : err.message}`);
      }
    }
  }),
);

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
const ok = Object.values(manifest.services).filter((s) => s.ok).length;
const failed = Object.values(manifest.services).filter((s) => !s.ok && !s.skipped).length;
console.log(
  `\nНөөц: ${OUT}\nАмжилттай ${ok} · алгассан ${services.length - ok - failed} · алдаа ${failed} · ${Math.round((Date.now() - started) / 1000)} с`,
);
process.exitCode = failed ? 1 : 0;
