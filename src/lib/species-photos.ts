/**
 * Зүйлийн зураг — ХЭЛТСЭЭС ИРСЭН файлууд.
 *
 * Эх зураг: `АУХХ/Picture` (68 файл, латин нэрээр нэрлэгдсэн) — хэлтсийн
 * "Амьтан ургамлыг хамгаалах хэлтэс 2026.08.06_цэгцэлсэн.xlsx" жагсаалттай
 * хамт ирсэн. Тэр жагсаалт нь монгол нэр → латин нэрийн ХОЛБООС бөгөөд
 * доорх толь бичиг түүнээс үүссэн.
 *
 * Зургууд `public/species/{sm,lg}` дотор WebP болж хөрвүүлэгдсэн —
 * эх хэмжээ нь нийт 43MB тул шууд хуулах боломжгүй. Хөрвүүлэлт:
 * `node scripts/build-species-photos.mjs <эх хавтас>`.
 *
 * ⚠️ Зүйлийн нэр бүртгэлд ЧӨЛӨӨТ бичигдсэн: "Начин шонхор 2 дэгдээхэй",
 * "Бамбай хоншорт могой" (үсгийн алдаа), "Зэрлэг  нугас" (давхар зай).
 * Тиймээс шууд тааруулах боломжгүй — `speciesKey()` нэрийг үндсэн зүйл
 * рүү нь буулгана.
 */

import { asset } from "@/lib/base-path";

/** Нас, тоо, хүйс заасан дагавар — зүйлийг өөрчилдөггүй тул хасна */
const NOISE = [
  "дэгдээхэй",
  "ангаахай",
  "төл",
  "янзага",
  "гавар",
  "бэлтрэг",
  "үүр",
  "үүрэлсэн",
  "шувууны",
  "нислэг",
  "эр",
  "эм",
];

/** Чөлөөт бичсэн нэрийг толь бичгийн түлхүүр рүү буулгана */
export function speciesKey(name: string): string {
  let x = name.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  // "2 дэгдээхэй", "3-н ширхэг" зэрэг тоон хэсэг
  x = x.replace(/\d+\s*(ш|ширхэг)?/g, " ");
  x = x
    .split(/[\s,]+/)
    .filter((w) => w && !NOISE.includes(w))
    .join(" ");
  // "цагаан зээрийн" → "цагаан зээр"
  x = x.replace(/(ийн|ын)$/, "");
  // Бүртгэлд давтагддаг үсгийн алдаа
  x = x.replace(/хоншорт/g, "хоншоорт").replace(/хандан ангир/g, "хондон ангир");
  return x.trim();
}

/** Латин нэрээс хоёр үгт нэр. Зохиогч, он, хаалтыг хаяна. */
export function binomial(raw: string): string | null {
  const fixed = raw
    // Бүртгэл дэх үсгийн алдаа — файл нь зөв нэрээр хадгалагдсан
    .replace(/\bServus\b/gi, "Cervus")
    .replace(/Ursus actors/gi, "Ursus arctos")
    .replace(/Orientocoluber spinali\b/gi, "Orientocoluber spinalis");

  const w = fixed
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter((x) => /^[A-Za-z.-]+$/.test(x));
  if (!w.length) return null;
  // "Anthophila", "Pisces" зэрэг нэг үгт (баг, ангийн) нэр ч байна
  if (w.length === 1) {
    return /^[A-Za-z]{4,}$/.test(w[0])
      ? w[0][0].toUpperCase() + w[0].slice(1).toLowerCase()
      : null;
  }
  const [g, s] = w;
  if (!/^[A-Za-z]{3,}$/.test(g) || !/^[A-Za-z]{3,}$/.test(s)) return null;
  return `${g[0].toUpperCase()}${g.slice(1).toLowerCase()} ${s.toLowerCase()}`;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** `public/species/{sm,lg}` дотор БОДИТООР байгаа файлууд */
const FILES = new Set([
  "accipiter-gentilis", "anas-platyrhynchos", "anthophila", "apus-pacificus",
  "aquila-nipalensis", "ardea-cinerea", "aves", "aythya-fuligula",
  "bombycilla-garrulus", "bubo-bubo", "buteo-buteo", "buteo-hemilasius",
  "buteo-lagopus", "canis-lupus", "capreolus-pygargus", "cervus-canadensis",
  "cervus-elaphus", "chiroptera", "columba-livia", "columbidae", "corvus-corax",
  "corvus-corone", "corvus-dauuricus", "dendrocopos-major", "elaphe-dione",
  "emberiza-yessoensis", "falco-cherrug", "falco-tinnunculus", "formicidae",
  "gallinago-gallinago", "gallus-gallus-domesticus", "gloydius-halys",
  "grus-virgo", "hemiechinus-auritus", "hemiechinus-dauuricus", "hirundo-rustica",
  "lampropeltis-triangulum", "lynx", "marmota", "marmota-sibirica",
  "martes-zibellina", "meles-leucurus", "milvus-migrans", "mustela-altaica",
  "mustela-eversmanni", "mustela-lutreola", "mustelidae", "natrix-natrix",
  "neovison-vison", "oenanthe-oenanthe", "ophiophagus", "orientocoluber-spinalis",
  "otus-scops", "ovis-ammon", "parus-major", "phalacrocorax-carbo", "pisces",
  "procapra-gutturosa", "pyrrhocorax-pyrrhocorax", "sciurus-vulgaris",
  "scolopax-rusticola", "strix-uralensis", "tadorna-ferruginea",
  "turdus-ruficollis", "ursus-arctos", "vespertilio-murinus", "vormela-peregusna",
  "vulpes-corsac",
]);

/**
 * Монгол нэр → зургийн файл. ХЭЛТСИЙН жагсаалтаас автоматаар үүссэн:
 * тэдний оноосон латин нэрийг зургийн файлын нэртэй тааруулав.
 */
const BY_NAME: Record<string, string> = {
  "адууч чогчого": "oenanthe-oenanthe",
  "алаг тоншуул": "dendrocopos-major",
  "алагтуу хэрээ": "corvus-dauuricus",
  "ангир": "tadorna-ferruginea",
  "асрын алтан хараацай": "hirundo-rustica",
  "бамбай хоншоорт могой gloydius halys": "gloydius-halys",
  "бамбай хоншоорт могой": "gloydius-halys",
  "бамбай хоншоорт": "gloydius-halys",
  "бараан хэрэм": "sciurus-vulgaris",
  "бор гөрөөс capreolus pygargus": "capreolus-pygargus",
  "бор гөрөөс": "capreolus-pygargus",
  "бор гөрөөсний": "capreolus-pygargus",
  "буурал сармаахай vespertilio murinus": "vespertilio-murinus",
  "буурал сармаахай сарьсан багваахай": "chiroptera",
  "буурал сармаахай": "vespertilio-murinus",
  "буурал хомноот": "scolopax-rusticola",
  "гэзэгт шумбуур": "aythya-fuligula",
  "дагуур зараа": "hemiechinus-dauuricus",
  "дорго": "mustelidae",
  "ердийн орволго": "otus-scops",
  "зараа": "hemiechinus-auritus",
  "зэрлэг зөгий": "anthophila",
  "зэрлэг нугас": "anas-platyrhynchos",
  "зээр": "procapra-gutturosa",
  "зөгий": "anthophila",
  "идлэг шонхор": "falco-cherrug",
  "их хөхбух": "parus-major",
  "могой": "gloydius-halys",
  "монгол тарвага marmota sibirica": "marmota-sibirica",
  "монгол тарвага": "marmota-sibirica",
  "мэксеко хар хаан могой": "ophiophagus",
  "наран уйл": "emberiza-yessoensis",
  "нарийн могой": "orientocoluber-spinalis",
  "начин шонхор бие гүйцсэн": "falco-tinnunculus",
  "начин шонхор": "falco-tinnunculus",
  "нугасны": "anas-platyrhynchos",
  "ойн булга": "martes-zibellina",
  "ойн сар": "buteo-buteo",
  "рашааны могой": "elaphe-dione",
  "саарал чоно": "canis-lupus",
  "сарьсан багваахаай": "chiroptera",
  "сарьсан багваахай": "chiroptera",
  "сохор элээ": "milvus-migrans",
  "сүүн могой": "lampropeltis-triangulum",
  "тагтааны": "columbidae",
  "тарвага": "marmota",
  "тарлан сар": "buteo-lagopus",
  "тураг гогой": "phalacrocorax-carbo",
  "тэжээвэр шувуу": "aves",
  "улаан гүеэт хөөндэй": "turdus-ruficollis",
  "улаан хошуут жунгаа": "pyrrhocorax-pyrrhocorax",
  "улаан хошуут өндөгтэй": "pyrrhocorax-pyrrhocorax",
  "улаан хошуут": "pyrrhocorax-pyrrhocorax",
  "улаанхошуут жунгаа": "pyrrhocorax-pyrrhocorax",
  "ураацай": "apus-pacificus",
  "усний могой": "natrix-natrix",
  "усны булга": "neovison-vison",
  "халздай дорго": "meles-leucurus",
  "халиун буга": "cervus-elaphus",
  "хар хэрээ": "corvus-corax",
  "хондлой цагаан ураацай": "apus-pacificus",
  "хондон ангир": "tadorna-ferruginea",
  "хув бигбаатар": "strix-uralensis",
  "хэрээний": "corvus-corone",
  "хээрийн бүргэд": "aquila-nipalensis",
  "хээрийн солонго": "mustela-altaica",
  "хярс": "vulpes-corsac",
  "хүрэн баавгай": "ursus-arctos",
  "хөх дэглий": "ardea-cinerea",
  "цагаан зээр": "procapra-gutturosa",
  "шивэр энхэт бялзухай": "bombycilla-garrulus",
  "шилийн сар": "buteo-hemilasius",
  "шувуу": "falco-tinnunculus",
  "шүвгэн хараалж": "gallinago-gallinago",
  "шүлүүс": "lynx",
  "эгэл шар шувуу": "bubo-bubo",
  "эрээн хүрнэ vormela peregusna": "vormela-peregusna",
  "эрээн хүрнэ": "vormela-peregusna",
  "үлэг харцага": "accipiter-gentilis",
  "өвөгт тогоруу": "grus-virgo",
  "өмхий хүрнэ mustela eversmanni": "mustela-eversmanni",
  "өмхий хүрнэ": "mustela-eversmanni",
  "өмхий хүрэн": "mustela-eversmanni",

  /*
    ГАРААР холбосон таван мөр. Эдгээр зүйлд хэлтэс латин нэр оноогоогүй
    ч ЯГ ТЭР зургийг илгээсэн тул холбоос нь тодорхой:
  */
  "аргаль": "ovis-ammon",
  "загас": "pisces",
  "тагтаа": "columba-livia",
  "тахиа": "gallus-gallus-domesticus",
  "шорголжны": "formicidae",
};

/**
 * Зураг хоёр хэмжээтэй:
 *  · `sm` — 128px, газрын зургийн 30px тэмдэглэгээнд. Хэдэн зуугаараа
 *    зэрэг ачаалагддаг тул жижиг байх ёстой (~3KB).
 *  · `lg` — 640px, дэлгэрэнгүй цонхонд. Зөвхөн цэг дээр товшиход, нэг
 *    удаад ганцхан татагддаг тул 35KB нь асуудал биш. Жижгийг нь томруулж
 *    харуулбал бүдэрч харагдана — тиймээс тусад нь хадгална.
 */
export type PhotoSize = "sm" | "lg";

/**
 * Зүйлийн зургийн хаяг. Эхлээд бичлэгийн ӨӨРИЙН латин нэрээр, дараа нь
 * монгол нэрээр хайна. Олдоогүй бол `null` — дуудагч тал шийднэ.
 */
export function speciesPhoto(
  mongolian: string,
  latin?: string,
  size: PhotoSize = "sm",
): string | null {
  const dir = `/species/${size}`;

  const byLatin = latin ? binomial(latin) : null;
  const fromLatin = byLatin ? slugify(byLatin) : null;
  if (fromLatin && FILES.has(fromLatin)) return asset(`${dir}/${fromLatin}.webp`);

  const fromName = BY_NAME[speciesKey(mongolian)];
  if (fromName && FILES.has(fromName)) return asset(`${dir}/${fromName}.webp`);

  return null;
}
