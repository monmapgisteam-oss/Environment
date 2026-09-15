/**
 * Нэвтрэх дэлгэцийн дэвсгэрийг угсарна: зураглалыг том зотоны голд
 * дөрвөн талаасаа ТЭНЦҮҮ зайтай суулгаж, зайг нь ижил зургийн
 * бүдгэрүүлсэн хуулбараар дүүргэнэ.
 *
 * Яагаад хүрээг ФАЙЛ ДОТОР хийдэг вэ:
 *   CSS дээр `inset`-ээр хүрээ гаргавал түүний зузаан цонхны хэмжээнээс
 *   хамаарч хэлбэлздэг ба `bg-cover` нь зураглалыг өөрийг нь хайчилдаг.
 *   Файл дотор хийхэд хүрээ нь дэлгэц бүрд ижил ХАРЬЦААТАЙ болж,
 *   хайчлалт эхлээд хүрээний зайг иддэг тул зураглал хамгаалагдана.
 *
 * ⚠ ЗАЙН ХЭМЖЭЭ САНАМСАРГҮЙ БИШ. Хөтчийн цонхны харьцаа 1.76–2.08-ын
 *   хооронд хэлбэлздэг. 250px-ээс нимгэн зайтай үед зөөврийн компьютерын
 *   цонхон дээр зураглалын ирмэг хасагдаж эхэлнэ (шалгасан: 200px дээр
 *   хасагдана, 250px дээр бүтэн).
 *
 * Хэрэглэх:  node scripts/make-auth-background.mjs <эх зураг>
 * Гаралт:    public/auth/background.webp
 */
import sharp from "sharp";
import { argv } from "node:process";

const SRC = argv[2];
if (!SRC) {
  console.error("Эх зургийн замыг өгнө үү");
  process.exit(1);
}

/** Дөрвөн талын зай, пикселээр — ХУВИАР БИШ, эс тэгвээс хажуу нь дээд/доодоос зузаан харагдана */
const PAD = 250;
/** Бүдгэрэлт ирмэг дээр хүрээнээс гаднах хоосон цэг татдаг тул илүү томруулж таслана */
const BLEED = 1.25;
const BLUR = 60;
/** Хүрээ нь ДЭВСГЭР — дотоод зурагтай өрсөлдөх ёсгүй */
const VEIL = 0.55;

const art = sharp(SRC);
const { width: aw, height: ah } = await art.metadata();
const cw = aw + 2 * PAD;
const ch = ah + 2 * PAD;

const blurred = await sharp(SRC)
  .resize(Math.round(cw * BLEED), Math.round(ch * BLEED), { fit: "cover" })
  .blur(BLUR)
  .extract({
    left: Math.round((cw * (BLEED - 1)) / 2),
    top: Math.round((ch * (BLEED - 1)) / 2),
    width: cw,
    height: ch,
  })
  .toBuffer();

const veil = Buffer.from(
  `<svg width="${cw}" height="${ch}"><rect width="100%" height="100%" fill="#0f1720" fill-opacity="${VEIL}"/></svg>`,
);
const line = Buffer.from(
  `<svg width="${cw}" height="${ch}"><rect x="${PAD - 0.5}" y="${PAD - 0.5}" width="${aw + 1}" height="${ah + 1}" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2"/></svg>`,
);

await sharp(blurred)
  .composite([
    { input: veil },
    { input: await sharp(SRC).toBuffer(), left: PAD, top: PAD },
    { input: line },
  ])
  .webp({ quality: 84 })
  .toFile("public/auth/background.webp");

console.log(`${aw}×${ah} → зотон ${cw}×${ch}, хүрээ ${PAD}px`);
