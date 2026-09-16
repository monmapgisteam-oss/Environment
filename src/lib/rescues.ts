/**
 * Амьтан, ургамлыг хамгаалах хэлтсийн ХОЁР ДАХЬ эх сурвалж —
 * аврагдсан зэрлэг амьтдын бүртгэл 2019–2026.
 *
 * Дуудлагын бүртгэлээс ялгаатай: энэ нь өнгөрсөн жилүүдийн хаагдсан
 * бүртгэл — зүйлийн латин нэр, ховордлын зэрэг, шийдвэрлэсэн байдал
 * зэрэг үр дүнгийн мэдээлэлтэй.
 *
 * ⚠ **ЭХ СУРВАЛЖ ПОРТАЛД ШИЛЖСЭН** (хэрэглэгчийн шийдвэр, 2026-09-16):
 * ArcGIS Online дээрх `GPS_SJ`-ээс `environment.ub.gov.mn`-ий
 * `A03_zerleg_amitdiin_burtgel` руу. Бичлэг 697-аас **720** боллоо.
 * Гурван зүйл ДАГАЖ өөрчлөгдсөн:
 *
 *  1. ⚠⚠ **ЗАСАГ ЗАХИРГААНЫ НЭР БАЙХГҮЙ.** Хуучин `_SJ` хувилбар нь
 *     орон зайн нэгтгэлээр `aimag_name`, `soum_name` авчирдаг байсан;
 *     шинэ давхаргад тэр хос БҮРМӨСӨН алга. Координатаас нь дам
 *     гаргаж болох ч энэ нь ТААМАГ тул хийхгүй. Оронд нь эх
 *     сурвалжийн ӨӨРИЙН шинэ багана болох `нас___төлөв` задаргаа болов
 *     ({@link Rescue.stage}) — байхгүй зүйлийг нөхөхийн оронд байгааг
 *     нь харуулна.
 *  2. **Сарын тусдаа багана байхгүй** — `огноо` нь жинхэнэ `Date`
 *     талбар тул сарыг түүнээс гаргана. ТЭГ нь 1970 он биш
 *     БӨГЛӨӨГҮЙН тэмдэг.
 *  3. **Талбарын нэр жижиг үсэгтэй** (портал PostgreSQL суурьтай).
 *
 * ⚠ `мэдээлэгч___утас` нь иргэний утасны дугаар агуулдаг тул огт
 * татагдахгүй — самбарт хэрэггүй хувь хүний мэдээллийг хөтөч рүү
 * буулгахгүй.
 *
 * Шинэ хост токен шаардана тул хүсэлт `arcgisJson()`-оор явна.
 */

import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";

export const RESCUES_SERVICE = `${layerService("A03_zerleg_amitdiin_burtgel")}/0`;

const PAGE = 2000;

export type Rescue = {
  oid: number;
  lon: number;
  lat: number;
  /** Зүйлийн монгол нэр — харуулах хэлбэр (эхний үсэг том) */
  species: string;
  latin: string;
  /** Ховордлын зэрэг: "Ховор" / "Элбэг" */
  rarity: string;
  year: number;
  /** `огноо`-оос гаргасан сар (1–12); огноо бөглөгдөөгүй бол 0 */
  month: number;
  date: number | null;
  /** Нас, төлөв — эх сурвалжийн чөлөөт бичвэр */
  stage: string;
  /** Тоо ширхэг. Эх сурвалж БИЧВЭРЭЭР хадгалдаг ("2 дэгдээхэй") */
  count: string;
  /** Нөхцөл байдлын чөлөөт тайлбар */
  situation: string;
  /** Шийдвэрлэсэн байдал — бүртгэгдсэн ЭХ бичвэр */
  outcomeRaw: string;
  /** Түүнийг бүлэглэсэн ангилал ({@link OUTCOMES}) */
  outcome: string;
};

/* --------------------------------------------------------------------------
   Шийдвэрлэсэн байдлын бүлэглэлт

   Талбар нь чөлөөт бичвэр: 100 гаруй өөр утга бөгөөд дотор нь утасны дугаар,
   албан хаагчийн нэр, бичгийн алдаа холилдсон ("Байгальд суллан тавьсан",
   "Байгальд буцаан тавьсан", "богд ууланд буцаан тавьсан 11310005" гурвуулаа
   нэг зүйл). Түүхий утгаар диаграм зурвал утга алга — эхний 20 мөр нь
   утасны дугаараар дүүрнэ.

   Тиймээс түлхүүр үгээр бүлэглэнэ. ЭХ БИЧВЭР нь `outcomeRaw`-д хадгалагдаж,
   бичлэгийн дэлгэрэнгүйд бүтнээрээ харагдана — бүлэглэлт нь харуулах давхарга
   болохоос дата дарж бичихгүй.
   -------------------------------------------------------------------------- */

export const OUTCOMES = {
  released: "Байгальд тавьсан",
  died: "Хорогдсон",
  culled: "Устгасан",
  care: "Асран тэнхрүүлсэн",
  moved: "Суурьшлын бүсээс гаргасан",
  handover: "Шилжүүлсэн",
  advice: "Зөвлөмж өгсөн",
  notFound: "Олдоогүй",
  unknown: "Тэмдэглээгүй",
  other: "Бусад",
} as const;

/**
 * Дараалал ЧУХАЛ: дээрээс доош эхний тохирсон дүрэм ялна.
 * Үхэл нь хамгийн эргэлт буцалтгүй үр дүн тул түүнийг эхэлж шалгана —
 * "Үхсэн … ойд аваачиж хаясан" гэх мэт бичлэг "тавьсан" гэсэн үгээр
 * "байгальд тавьсан" болж ангилагдах ёсгүй.
 */
const RULES: [string, RegExp][] = [
  [OUTCOMES.died, /хорогдсон|үхсэн|үрсэн|үхэж/],
  [OUTCOMES.culled, /устга/],
  [OUTCOMES.notFound, /олдоогүй/],
  [OUTCOMES.released, /суллан|буцаан тавь|байгальд тавь|тавьсан|тавьсан\b/],
  [OUTCOMES.care, /асран|асарч|тэнхрүүл|тэжээж/],
  [OUTCOMES.handover, /шилжүүлсэн/],
  // "зөвөлгөө" нь бичгийн алдаатай хувилбар — тусад нь барина
  [OUTCOMES.advice, /зөвлө|зөвөл|зааварчилсан/],
  [OUTCOMES.moved, /үргээ|гаргасан|гаргуулсан/],
];

export function classifyOutcome(raw: string): string {
  const s = raw.trim().toLocaleLowerCase("mn-MN");
  if (!s) return OUTCOMES.unknown;
  // Зөвхөн цифр (утасны дугаар) — шийдвэрлэлт тэмдэглэгдээгүй гэсэн үг
  if (/^[\d\s,./-]+$/.test(s)) return OUTCOMES.unknown;

  for (const [label, re] of RULES) if (re.test(s)) return label;
  return OUTCOMES.other;
}

type EsriPointFeature = {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number } | null;
};

function str(v: unknown) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

/** Зүйлийн нэр гараар бичигддэг — "монгол тарвага" ба "Монгол тарвага" нэг болно */
function titleCase(v: unknown) {
  const s = str(v);
  if (!s) return "";
  return s[0].toLocaleUpperCase("mn-MN") + s.slice(1).toLocaleLowerCase("mn-MN");
}

/**
 * Талбарын нэрс — давхаргын тодорхойлолтоос уншсанаар.
 *
 * ⚠ ТААМАГЛАЖ бичээгүй: доод зураас нь эх сурвалжийн гарчиг дахь зай,
 * хаалт, таслалын оронд орсон тул тоо нь жигд бус (`нас___төлөв`
 * гурав, `өргөрөг__y_` хоёр).
 */
const F = {
  species: "зүйлийн_монгол_нэр",
  latin: "латин_нэр",
  rarity: "ховордлын_зэрэг",
  date: "огноо",
  year: "он",
  stage: "нас___төлөв",
  count: "тоо",
  lat: "өргөрөг__y_",
  lon: "уртраг__x_",
  situation: "амьтны_гэмтэл__бэртэл",
  outcome: "шийдвэрлэсэн_байдал",
};

/**
 * ArcGIS-ийн огноог миллисекунд болгоно.
 *
 * Тоо ч, ISO бичвэр ч ирж болно. ТЭГ нь 1970 он биш БӨГЛӨӨГҮЙН тэмдэг
 * тул `null` болгоно.
 */
function epoch(v: unknown): number | null {
  if (typeof v === "number") return v > 0 ? v : null;
  if (typeof v === "string" && v) {
    const t = Date.parse(v);
    return Number.isFinite(t) && t > 0 ? t : null;
  }
  return null;
}

export async function fetchRescues(signal?: AbortSignal): Promise<Rescue[]> {
  const out: Rescue[] = [];

  for (let offset = 0; ; offset += PAGE) {
    const url = `${RESCUES_SERVICE}/query?${new URLSearchParams({
      f: "json",
      where: "1=1",
      /* `мэдээлэгч___утас` ЗОРИУДААР жагсаалтад алга — хувь хүний дата */
      outFields: [
        "objectid",
        F.species,
        F.latin,
        F.rarity,
        F.date,
        F.year,
        F.stage,
        F.count,
        F.lat,
        F.lon,
        F.situation,
        F.outcome,
      ].join(","),
      outSR: "4326",
      returnGeometry: "true",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "objectid ASC",
    })}`;

    const json = await arcgisJson<{ features?: EsriPointFeature[] }>(
      url,
      "Аврагдсан амьтдын бүртгэл",
      { signal },
    );
    const feats = json.features ?? [];

    for (const f of feats) {
      const a = f.attributes;
      const g = f.geometry;

      /* Геометрийг эрхэмлэнэ, дутсан бол атрибутын координатаас */
      const lon = g && Number.isFinite(g.x) ? g.x : Number(a[F.lon]);
      const lat = g && Number.isFinite(g.y) ? g.y : Number(a[F.lat]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

      const outcomeRaw = str(a[F.outcome]);
      const date = epoch(a[F.date]);

      out.push({
        oid: Number(a.objectid),
        lon,
        lat,
        species: titleCase(a[F.species]) || "Тодорхойгүй",
        latin: str(a[F.latin]),
        rarity: str(a[F.rarity]) || "Тодорхойгүй",
        year: Number(a[F.year]) || 0,
        /* Сарын тусдаа багана байхгүй — огнооноос. UTC-гаар уншина:
           эх сурвалж өдрийн эхэнд тэмдэглэдэг тул орон нутгийн цагийн
           бүсэд буулгавал сар ухарч болзошгүй */
        month: date ? new Date(date).getUTCMonth() + 1 : 0,
        date,
        stage: str(a[F.stage]) || "Тэмдэглээгүй",
        count: str(a[F.count]),
        situation: str(a[F.situation]),
        outcomeRaw,
        outcome: classifyOutcome(outcomeRaw),
      });
    }

    if (feats.length < PAGE) break;
  }

  return out;
}
