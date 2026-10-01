/*
  НҮХЭН ЖОРЛОНГИЙН АЗОТЫН УРСАЦ, НЭВЧИЛТИЙН СУДАЛГААГ БАГЦЛАХ

  Эх сурвалж: `I:/Environment/us_hurs/sudalgaa_output` (репогоос ГАДНА —
  растер, GeoPackage нийлээд хэдэн зуун МБ тул git-т ОРУУЛААГҮЙ).
  Судалгааны үр дүн нь тэнд бие даасан ArcGIS апп болж бичигдсэн бөгөөд
  зургаан өнцөгт бүрийн утга тэр файлын дотор `const HEX=…` гэж сууна.

  ⚠⚠ ЗУРГААН ӨНЦӨГТИЙГ БҮТНЭЭР НЬ ХАДГАЛАХГҮЙ. GeoJSON хэлбэрээр
  2.5 МБ — оройн солбицол нь нүд бүрд давтагдана. Хэмжихэд тор нь
  ЖИГД: орой бүрийн төвөөсөө авах офсет хот даяар ердөө 2–5 метрээр л
  хэлбэлзэнэ (хэмжсэн). Тиймээс НЭГ дундаж офсет ба нүд бүрийн ТӨВ л
  хадгалагдаж, хөтөч зургаан өнцөгтөө өөрөө угсарна.

  ⚠ Багана бүр ТУСДАА массив (columnar): нүд тутамд түлхүүрийн нэр
  давтагдахгүй тул JSON хоёр дахин хэмнэнэ.

  Ажиллуулах: node scripts/build-latrine-analysis.mjs
*/
import fs from "node:fs";
import path from "node:path";

const SRC = "I:/Environment/us_hurs/sudalgaa_output";
const APP = path.join(SRC, "UB_latrine_2D3D_arcgis.html");
const OUT = "public/data/latrine-analysis.json";

if (!fs.existsSync(APP)) {
  console.error(`Эх сурвалж олдсонгүй: ${APP}`);
  process.exit(0); /* Эх сурвалжгүй машин дээр бүтээлт УНАХГҮЙ */
}

/* Тогтмолыг хаалтын тэнцвэрээр таслаж авна — regex нь үүрлэсэн
   хаалт, мөрийн бичвэр дээр эвдэрнэ */
function constant(txt, name) {
  const at = txt.indexOf(`const ${name}=`);
  if (at < 0) throw new Error(`${name} олдсонгүй`);
  const from = txt.indexOf("=", at) + 1;
  let depth = 0, i = from, inStr = false, esc = false;
  for (; i < txt.length; i++) {
    const c = txt[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { depth--; if (depth === 0) { i++; break; } }
  }
  return JSON.parse(txt.slice(from, i));
}

const hex = constant(fs.readFileSync(APP, "utf8"), "HEX");
const feats = hex.features;

/* Нэгж зургаан өнцөгт — бүх нүдний офсетийн дундаж */
const off = Array.from({ length: 6 }, () => [0, 0]);
for (const f of feats) {
  const r = f.geometry.coordinates[0].slice(0, 6);
  const cx = r.reduce((a, p) => a + p[0], 0) / 6;
  const cy = r.reduce((a, p) => a + p[1], 0) / 6;
  r.forEach((p, v) => { off[v][0] += p[0] - cx; off[v][1] += p[1] - cy; });
}
const shape = off.map(([x, y]) => [
  Number((x / feats.length).toFixed(6)),
  Number((y / feats.length).toFixed(6)),
]);

const col = (read, digits) =>
  feats.map((f) => Number(read(f.properties).toFixed(digits)));

const centre = (f, axis) => {
  const r = f.geometry.coordinates[0].slice(0, 6);
  return r.reduce((a, p) => a + p[axis], 0) / 6;
};

const out = {
  /* Эх сурвалжийн тэмдэглэл — дэлгэцэд ГАРАХГҮЙ, зөвхөн мөрдөлт */
  source: "sudalgaa_output/UB_latrine_2D3D_arcgis.html",
  built: new Date().toISOString().slice(0, 10),
  shape,
  lon: feats.map((f) => Number(centre(f, 0).toFixed(5))),
  lat: feats.map((f) => Number(centre(f, 1).toFixed(5))),
  n: col((p) => p.n_latrine, 0),
  load: col((p) => p.N_kg_yr, 1),
  ri: col((p) => p.RI, 1),
  li: col((p) => p.LI, 1),
  ric: col((p) => p.RI_cls, 0),
  lic: col((p) => p.LI_cls, 0),
  hand: col((p) => p.hand_m, 1),
  slope: col((p) => p.slope_deg, 1),
  flow: col((p) => p.flowlen_m, 0),
  rcSummer: col((p) => p.RC_summer, 2),
  rcMelt: col((p) => p.RC_melt, 2),
  share: col((p) => p.runoff_share, 2),
};

/* Хөрсний хэмжилттэй харьцуулсан шалгалт — эх сурвалжийн CSV.

   ⚠ БАРУУНААС нь таслана: зорилтын нэр нь өөрөө таслал агуулж болох
   ("2023 bacteria count (BBET_too)" гэх мэт) тул зүүнээс тоолвол
   багана гулсана. Сүүлийн гурав нь ҮРГЭЛЖ n, rho, p. */
const csv = fs.readFileSync(path.join(SRC, "validation.csv"), "utf8")
  .trim()
  .split(/\r?\n/);
out.validation = csv.slice(1).filter(Boolean).map((line) => {
  const parts = line.split(",");
  const p = Number(parts.pop());
  const rho = Number(parts.pop());
  const n = Number(parts.pop());
  const predictor = parts.pop();
  return { target: parts.join(","), predictor, n, rho, p };
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`${OUT} · ${kb} KB · ${out.n.length} нүд · ${out.validation.length} шалгалт`);
console.log("жорлон:", out.n.reduce((a, b) => a + b, 0).toLocaleString("mn"));
console.log("азот, кг/жил:", Math.round(out.load.reduce((a, b) => a + b, 0)).toLocaleString("mn"));
