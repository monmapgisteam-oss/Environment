/**
 * MapLibre GL v6-ийн worker файлыг public/maplibre/ рүү хуулна.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * MapLibre worker-ийнхээ хаягийг `import.meta.url`-ээс тооцдог. Next.js
 * (Turbopack/webpack) кодыг багцлахад `import.meta.url` нь багцын чанк руу
 * заадаг тул `./maplibre-gl-worker.mjs` олдохгүй 404 болно. Worker эхлэлдээ
 * уначихдаг ба GeoJSON эх сурвалж хэзээ ч боловсрогддоггүй — растер хавтан
 * харагдаад векторын цэг нь алга болно.
 *
 * Шийдэл: worker болон түүний хамаарлыг статикаар үйлчлүүлж,
 * `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")` гэж зааж өгнө.
 *
 * Хувилбар зөрөхөөс сэргийлж predev/prebuild бүрд дахин хуулна.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const out = path.join(process.cwd(), "public", "maplibre");

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(out, { recursive: true });
for (const f of FILES) {
  await copyFile(path.join(dist, f), path.join(out, f));
}

const { version } = require("maplibre-gl/package.json");
console.log(`maplibre worker ${version} → public/maplibre/ (${FILES.length} файл)`);
