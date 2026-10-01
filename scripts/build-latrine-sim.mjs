/*
  НҮХЭН ЖОРЛОНГИЙН НЭВЧИЛТИЙН СИМУЛЯЦИ — хоёртын багц бэлтгэгч.

  Эх сурвалж нь `I:/Environment/us_hurs/leaching/build_latrine_sim.py`-ийн
  гаралт: `latrine_sim_data.json` (жорлон бүрийн анхдагч утгууд) ба
  `photo_tiles.json` (хөрсний үеийн зургийн хавтанцар). Тэр скрипт нь
  ArcGIS Pro-ийн python, arcpy, GDAL, эх GeoPackage шаарддаг тул ЭНД дахин
  ажиллуулахгүй — бэлтгэгдсэн JSON-оос л хоёртын багц угсарна.

  Формат нь бусад багцтай ИЖИЛ ({@link scripts/build-soil-profile.mjs}):

      [4 байт: JSON толгойн урт][JSON толгой][блокууд дараалан]

  ⚠ БЛОК БҮР 4 БАЙТААР ЭГНҮҮЛЭГДЭНЭ (`new Uint16Array(buf, at, n)`).

  ⚠⚠ ХАЯГ ОРОХГҮЙ. Эх JSON-д жорлон бүрийн гудамж, хашааны дугаар
  (`addr`) бий — айл өрхийн хаяг. `public/` доторх файл нэвтрэлтгүйгээр
  татагдах тул ХАСНА. Симуляцид хэрэггүй.
  ⚠ Налуу (`slope`) мөн хасагдсан — загварт ашиглагддаггүй.
  ⚠ Координат uint16-аар (хүрээн доторх харьцангуй): алхам ~1.4 м
  уртрагт, ~1 м өргөрөгт — сонголт, дүрслэлд хангалттай, багцыг 0.6 МБ
  хөнгөлнө.

  ⚠ ЭХ СУРВАЛЖ БАЙХГҮЙ МАШИН ДЭЭР ЧИМЭЭГҮЙ ГАРНА — бүтээлт унахгүй.

  Ажиллуулах:  node scripts/build-latrine-sim.mjs
*/
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const DIR = "I:/Environment/us_hurs/leaching";
const SRC = `${DIR}/latrine_sim_data.json`;
const TILES = `${DIR}/photo_tiles.json`;
const OUT = "public/data/latrine-sim.bin";

if (!existsSync(SRC) || !existsSync(TILES)) {
  console.log(`эх сурвалж алга (${SRC}) — алгаслаа`);
  process.exit(0);
}

const D = JSON.parse(readFileSync(SRC, "utf8"));
const T = JSON.parse(readFileSync(TILES, "utf8"));
const n = D.n;
const b64 = (s) => Buffer.from(s, "base64");

/*
  ⚠⚠ КООРДИНАТ БАГЦАД ОРОХГҮЙ (хэрэглэгч 2026-10-01: "jorlongiin feature
  org bga shuude source soliwol yhu"). `public/` нэвтрэлтгүй татагддаг тул
  жорлон тус бүрийн байршил нийтэд нээлттэй болох байв, харин порталд тэр
  давхарга байгууллагын хүрээнд хаалттай. Байршлыг хөтөч НЭВТЭРСНИЙ ДАРАА
  порталын `X10_UB_pit_toilet`-оос `id`-аар холбож авна
  ({@link src/lib/latrine-sim.ts}-ийн `fillCoords`).
  ⚠ Холбоосыг токеноор бүтэн шалгасан (2026-10-01): порталын `id` нь
  энэ багцын `ID`-тай 145,462/145,462 таарсан, зай хамгийн ихдээ 0.35 м.
*/

/* Геологийн код → жагсаалтын дугаар */
const gcodes = D.gcode.split("\n");
const gList = [...new Set(gcodes)].sort();
const gIdx = Buffer.from(Uint8Array.from(gcodes.map((g) => gList.indexOf(g))));

const blocks = [
  { name: "id", type: "int32", data: b64(D.id) },
  { name: "gw", type: "uint16", data: b64(D.gw) },
  ...["hh", "pit", "src", "nwell", "mat", "dens", "soil", "valley", "kh"].map((k) => ({
    name: k,
    type: "uint8",
    data: b64(D[k]),
  })),
  { name: "gcode", type: "uint8", data: gIdx },
  ...Object.entries(T).map(([k, v]) => ({ name: `tile${k}`, type: "uint8", data: b64(v) })),
];

const BYTES = { uint8: 1, uint16: 2, int32: 4 };
const header = {
  n,
  profiles: D.profiles,
  khList: D.khList,
  gcodes: gList,
  params: D.params,
  blocks: [],
};

/* Толгойн урт блокуудын эхлэлээс хамаардаг тул ТОГТВОРЖТОЛ давтана.
   ⚠ Урьд нь яг хоёр дамжлага байсан: оффсетын цифрийн тоо өөрчлөгдвөл
   толгой эхний блокоос ХЭТЭРЧ, хөтөч "Expected ',' or '}'" гэж унадаг
   байв (координат хасагдсаны дараа 2026-10-01-нд илэрсэн). */
const align = (x) => (x + 3) & ~3;
let headLen = 0;
for (let pass = 0, prev = -1; headLen !== prev && pass < 10; pass++) {
  prev = headLen;
  let at = align(4 + headLen);
  header.blocks = blocks.map((b) => {
    const e = { name: b.name, type: b.type, offset: at, count: b.data.length / BYTES[b.type] };
    at = align(at + b.data.length);
    return e;
  });
  headLen = Buffer.byteLength(JSON.stringify(header));
}
const head = Buffer.from(JSON.stringify(header));
const total = header.blocks.at(-1).offset + blocks.at(-1).data.length;
const out = Buffer.alloc(align(total));
out.writeUInt32LE(head.length, 0);
head.copy(out, 4);
blocks.forEach((b, i) => b.data.copy(out, header.blocks[i].offset));

writeFileSync(OUT, out);
console.log(
  `${OUT}: ${(out.length / 1e6).toFixed(2)} МБ (gzip ${(gzipSync(out).length / 1e6).toFixed(2)} МБ), ${n.toLocaleString()} жорлон, хаяггүй`,
);
