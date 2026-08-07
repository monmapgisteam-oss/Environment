/**
 * Хэлтсээс ирсэн зүйлийн зургийг сайтад тохирох хэмжээнд хөрвүүлнэ.
 *
 * Эх зураг нь ~43MB (утасны бүтэн хэмжээ) тул төсөлд ШУУД хуулж болохгүй.
 * Энэ скрипт хоёр хэмжээ гаргана:
 *   sm — 128px, газрын зургийн 30px тэмдэглэгээнд (олноороо зэрэг ачаалагдана)
 *   lg — 640px, дэлгэрэнгүй цонхонд (зөвхөн товшиход нэгээрээ татагдана)
 *
 * Файлын нэр нь ЛАТИН нэр байх ёстой — `lib/species-photos.ts` доторх толь
 * бичиг түүгээр холбодог.
 *
 * Ажиллуулах:
 *   node scripts/build-species-photos.mjs "E:/…/АУХХ/Picture"
 *
 * Шинэ зураг ирэх бүрд дахин ажиллуулж, `species-photos.ts` доторх `FILES`
 * жагсаалтад шинэ нэрийг нэмнэ.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = process.argv[2];
if (!SRC) {
  console.error("Хэрэглээ: node scripts/build-species-photos.mjs <эх хавтас>");
  process.exit(1);
}

const OUT = path.join(process.cwd(), "public", "species");
const SIZES = [
  { dir: "sm", w: 128, h: 128, quality: 76 },
  { dir: "lg", w: 640, h: 428, quality: 74 },
];

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

for (const { dir, w, h, quality } of SIZES) {
  const out = path.join(OUT, dir);
  fs.mkdirSync(out, { recursive: true });

  let bytes = 0;
  for (const f of files) {
    const dst = path.join(out, `${slug(f.replace(/\.[^.]+$/, ""))}.webp`);
    await sharp(path.join(SRC, f))
      // EXIF эргэлтийг тооцно — утасны зураг хажуулдаж хадгалагддаг
      .rotate()
      // `attention` нь зургийн хамгийн "агуулгатай" хэсгийг төвд авчирна
      .resize(w, h, { fit: "cover", position: "attention" })
      .webp({ quality })
      .toFile(dst);
    bytes += fs.statSync(dst).size;
  }

  console.log(`${dir}: ${files.length} зураг → ${(bytes / 1024).toFixed(0)}KB`);
}
