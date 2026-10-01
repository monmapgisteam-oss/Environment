/*
  ХӨРСНИЙ ПРОФАЙЛЫН 3D БЛОК — хоёртын багц бэлтгэгч.

  Эх сурвалж нь `I:/Environment/us_hurs/leaching/build_soil_profile_3d.py`-ийн
  гаралт: `UB_soil_profile_3d.html` — өгөгдлөө `const D = {…}` гэж дотроо
  шигтгэсэн, бие даан ажилладаг хуудас. Тэр скрипт нь ArcGIS Pro-ийн python,
  GDAL, эх шейпфайл шаарддаг тул ЭНД дахин ажиллуулахгүй: аль хэдийн
  бэлтгэгдсэн HTML-ээс өгөгдлийг л салгаж авна.

  ⚠⚠ BASE64-ГҮЙ БОЛГОНО. HTML дотор растер, хавтанцар бүгд base64 тул
  жин нь 33%-иар хөөнө (620 КБ). Хоёртын багц болгоход **465 КБ**.
  Формат нь бусад багцтай ИЖИЛ ({@link scripts/build-latrine-sim.mjs}):

      [4 байт: JSON толгойн урт][JSON толгой][блокууд дараалан]

  ⚠ БЛОК БҮР 4 БАЙТААР ЭГНҮҮЛЭГДЭНЭ — `new Int16Array(buf, at, n)` нь
  `at` нь хоёрын үржвэр байхыг ШААРДДАГ. Хуулбарлаж засахын оронд
  багцлах үедээ зөв байрлуулна.

  ⚠ ЭХ СУРВАЛЖ БАЙХГҮЙ МАШИН ДЭЭР ЧИМЭЭГҮЙ ГАРНА — бүтээлт унахгүй,
  багцалсан файл нь репод үлдэнэ (нүхэн жорлонгийн скрипттэй нэг зарчим).

  Ажиллуулах:  node scripts/build-soil-profile.mjs
*/
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const SRC = "I:/Environment/us_hurs/leaching/UB_soil_profile_3d.html";
const OUT = "public/data/soil-profile-3d.bin";

if (!existsSync(SRC)) {
  console.log(`эх сурвалж алга (${SRC}) — алгаслаа`);
  process.exit(0);
}

/* ⚠ Мөрийн төгсгөл CRLF — Node нь Python-оос ялгаатай нь хөрвүүлдэггүй */
const html = readFileSync(SRC, "utf8");
const m = html.match(/const D = (\{[\s\S]*?\});\r?\n/);
if (!m) {
  console.error("HTML дотроос `const D = {…}` олдсонгүй");
  process.exit(1);
}
const D = JSON.parse(m[1]);

/* Блокууд: растер, зураг, хавтанцар — бүгд түүхий байт болж гарна */
const blocks = [
  { name: "cells", type: "uint8", data: Buffer.from(D.cells, "base64") },
  { name: "z", type: "int16", data: Buffer.from(D.z, "base64") },
  { name: "finePng", type: "uint8", data: Buffer.from(D.finePng, "base64") },
  ...Object.entries(D.tiles).map(([k, b]) => ({
    name: `tile${k}`,
    type: "uint8",
    data: Buffer.from(b, "base64"),
  })),
];

const BYTES = { uint8: 1, int16: 2 };
const header = {
  x0: D.x0,
  y0: D.y0,
  dx: D.dx,
  dy: D.dy,
  nx: D.nx,
  ny: D.ny,
  fine: D.fine,
  profiles: D.profiles,
  blocks: [],
};

/* Толгойн урт нь блокуудын эхлэлээс хамаардаг тул хоёр дамжлагаар:
   эхлээд түр толгойгоор уртыг нь хэмжиж, дараа нь бодит офсетоор бичнэ */
const align = (n) => (n + 3) & ~3;
function layout(headLen) {
  let at = align(4 + headLen);
  const meta = blocks.map((b) => {
    const e = { name: b.name, type: b.type, offset: at, count: b.data.length / BYTES[b.type] };
    at = align(at + b.data.length);
    return e;
  });
  return { meta, total: at };
}
let head = Buffer.from(JSON.stringify({ ...header, blocks: layout(0).meta }), "utf8");
let { meta, total } = layout(head.length);
head = Buffer.from(JSON.stringify({ ...header, blocks: meta }), "utf8");
({ meta, total } = layout(head.length)); // урт тогтмолжтол нэг давталт хангалттай
head = Buffer.from(JSON.stringify({ ...header, blocks: meta }), "utf8");

const out = Buffer.alloc(total);
out.writeUInt32LE(head.length, 0);
head.copy(out, 4);
blocks.forEach((b, i) => b.data.copy(out, meta[i].offset));

writeFileSync(OUT, out);
const gz = gzipSync(out, { level: 9 }).length;
console.log(`${OUT} · ${(out.length / 1e6).toFixed(2)} МБ (gzip ${(gz / 1e6).toFixed(2)} МБ)`);
console.log(`  тор ${D.nx} × ${D.ny} · нарийн ×${D.fine} · профайл ${D.profiles.length}`);
for (const b of meta) console.log(`  ${b.name.padEnd(10)} ${b.type} ${b.count.toLocaleString()}`);
