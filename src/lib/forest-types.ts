/**
 * Ойн хэлтэс — ойн төрлийн зураглал.
 *
 * Эх сурвалж: `Ой_төрөл` FeatureServer, 7,058 талбай, нийт 431,120 га.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ НИЙТ ТАЛБАЙ ≠ ОЙН ТАЛБАЙ                                         │
 * └──────────────────────────────────────────────────────────────────┘
 * Давхарга нь нутаг дэвсгэрийг БҮХЭЛД нь хуваасан: 794 талбай буюу
 * 331,664 га (нийтийн 77%) нь ямар ч төрөлгүй (`Forest_typ` = " ").
 * Эдгээр нь "бусад ой" БИШ — ангилагдаагүй, ойн бус талбай. Жинхэнэ
 * ой (`oi`) нь 72,630 га.
 *
 * Тиймээс индикаторт "нийт талбай" гэж 431 мянган га бичих нь ойн
 * хэмжээг дөрөв дахин үрсгэж харуулна. Ой ба ангилагдаагүйг ТУСАД нь
 * бичнэ.
 *
 * Геометр нь маш нягт (талбай тутамд дунджаар 478 орой — растераас
 * гаралтай бололтой) тул серверт ~10м-ээр ерөнхийлүүлнэ: бүтэн
 * нарийвчлалаар 60MB, ерөнхийлсний дараа 1.7MB. Ерөнхийлөлт нь орой
 * бүрийн 97%-ийг хасдаг ч талбайн утга өөрчлөгддөггүй.
 */

import { saneGeometry } from "@/lib/extent";

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
/** Кирилл нэртэй үйлчилгээ — хаягт кодлогдоно */
const LAYER = encodeURIComponent("Ой_төрөл");
const PAGE = 2000;
/** ~10 метрийн ерөнхийлөлт (градусаар) */
const OFFSET = 0.0001;

export const FOREST_TYPES_SERVICE = `${HOST}/${LAYER}/FeatureServer/9`;

/* --------------------------------------------------------------------------
   Ойн төрөл

   Эх сурвалж дээр төрлийн нэр ЛАТИНААР бичигдсэн ("oi", "tarmag mod",
   "Khortond idegdsen oi"). Доорх нь ОРЧУУЛГА БИШ, зөвхөн үсгийн
   хөрвүүлэлт — утга нэмээгүй, зөвхөн кирилл рүү буулгав. Бичгийн алдаа
   ("shatsan oin talbaii", "tuimriin zurwasi") нь эх сурвалжийнх.

   Дараалал нь ТОГТМОЛ: талбайгаар эрэмбэлбэл шүүлт солих бүрд мөрүүд
   үсэрнэ. Ангилагдаагүйг хамгийн сүүлд тавив — тэр нь төрөл биш.
   -------------------------------------------------------------------------- */

export const FOREST_TYPES = [
  { id: "oi", raw: "oi", label: "Ой" },
  { id: "tarmag", raw: "tarmag mod", label: "Тармаг мод" },
  { id: "beltgesen", raw: "mod beltgesen talbai", label: "Мод бэлтгэсэн талбай" },
  { id: "soog", raw: "soog torlog", label: "Сөөг, төрлөг" },
  { id: "enger", raw: "tsagaan enger", label: "Цагаан энгэр" },
  { id: "khorton", raw: "Khortond idegdsen oi", label: "Хортонд идэгдсэн ой" },
  { id: "shatsan", raw: "shatsan oin talbaii", label: "Шатсан ойн талбай" },
  { id: "oijuulsan", raw: "oijuulsan talbai", label: "Ойжуулсан талбай" },
  { id: "oijih", raw: "oijih talbai", label: "Ойжих талбай" },
  { id: "tsaram", raw: "tag tsaram", label: "Таг царам" },
  { id: "zurvas", raw: "tuimriin zurwasi", label: "Түймрийн зурвас" },
  { id: "tarimal", raw: "tarimal oi", label: "Таримал ой" },
  { id: "none", raw: "", label: "Ангилагдаагүй" },
] as const;

export type ForestTypeId = (typeof FOREST_TYPES)[number]["id"];

const BY_RAW = new Map<string, string>(
  FOREST_TYPES.map((t) => [t.raw.toLowerCase(), t.id] as [string, string]),
);

export const TYPE_LABEL = new Map<string, string>(
  FOREST_TYPES.map((t) => [t.id, t.label] as [string, string]),
);

/** Эх сурвалжийн латин бичлэгийг ангилалд буулгана */
export function classifyType(raw: string): string {
  const x = raw.trim().toLowerCase();
  if (!x) return "none";
  return BY_RAW.get(x) ?? "none";
}

/** ОЙН бүрхэвч гэж тооцох төрлүүд — ангилагдаагүй, царам, зурвас үүнд орохгүй */
const WOODED = new Set(["oi", "tarmag", "soog", "khorton", "tarimal", "oijuulsan"]);

export function isWooded(id: string) {
  return WOODED.has(id);
}

/* -------------------------------------------------------------------------- */

export type ForestParcel = {
  oid: number;
  /** Бүлэглэсэн ангилал ({@link FOREST_TYPES}) */
  type: string;
  /** Эх сурвалжийн латин бичлэг — дэлгэрэнгүйд бүтнээрээ гарна */
  typeRaw: string;
  /** Талбай, га. Эх сурвалжийн `Talbai` — геометрийн талбайтай таарна */
  ha: number;
  /** Ойн ангийн хэсгийн дугаар */
  section: number | null;
  /** Ялгаралын дугаар */
  unit: number | null;
};

export type ForestTypesData = {
  parcels: ForestParcel[];
  shapes: GeoJSON.FeatureCollection;
  /** Геометргүй буюу гажуудсан тул зурагт ороогүй бичлэгийн тоо */
  dropped: number;
};

/**
 * Хэмжээний ангилал.
 *
 * Эх сурвалжийнх БИШ, бидний зурсан хуваарь тул зөвхөн тоон мужаар
 * нэрлэв. Логарифм алхамтай: талбай 0-оос 38,950 га хүртэл сунасан.
 */
export const SIZE_CLASSES = [
  { id: "0", label: "10 га-аас бага", max: 10 },
  { id: "1", label: "10 – 50 га", max: 50 },
  { id: "2", label: "50 – 200 га", max: 200 },
  { id: "3", label: "200 – 1,000 га", max: 1000 },
  { id: "4", label: "1,000 га-аас их", max: Infinity },
] as const;

export function sizeClass(ha: number): number {
  for (let i = 0; i < SIZE_CLASSES.length; i++) {
    if (ha < SIZE_CLASSES[i].max) return i;
  }
  return SIZE_CLASSES.length - 1;
}

type Feature = {
  type: "Feature";
  properties: {
    OBJECTID: number;
    Forest_typ?: string | null;
    Talbai?: number | null;
    Hes_num?: number | null;
    Yalgaral_N?: number | null;
  };
  geometry: GeoJSON.Geometry | null;
};

async function page(offset: number, signal?: AbortSignal): Promise<Feature[]> {
  const url =
    `${FOREST_TYPES_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,Forest_typ,Talbai,Hes_num,Yalgaral_N",
      outSR: "4326",
      geometryPrecision: "5",
      maxAllowableOffset: String(OFFSET),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "OBJECTID",
      f: "geojson",
    });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Ойн төрөл татагдсангүй (${res.status})`);
  const json = (await res.json()) as { features?: Feature[] };
  return json.features ?? [];
}

export async function fetchForestTypes(signal?: AbortSignal): Promise<ForestTypesData> {
  /* Дөрвөн хуудсыг ЗЭРЭГ татна — нийт тоо нь тогтмол (7,058) тул
     дараалуулж шалгах шаардлагагүй */
  const pages = await Promise.all([0, PAGE, PAGE * 2, PAGE * 3].map((o) => page(o, signal)));
  const feats = pages.flat();

  const parcels: ForestParcel[] = [];
  const shapes: GeoJSON.Feature[] = [];
  let dropped = 0;

  for (const f of feats) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    const typeRaw = (p.Forest_typ ?? "").trim();

    parcels.push({
      oid,
      type: classifyType(typeRaw),
      typeRaw,
      ha: Number(p.Talbai) || 0,
      section: p.Hes_num ?? null,
      unit: p.Yalgaral_N ?? null,
    });

    /*
      ГЕОМЕТРИЙН ШҮҮЛТ. Энэ давхаргад хоёр төрлийн эвдрэл бий:
        · 32 бичлэгийн геометр огт хоосон;
        · 5 бичлэгийн (oid 173, 6709, 6710, 6745, 6746) координат нь
          дэлхийн булан (-180, -90) болж буцдаг.
      Сүүлийнх нь ганцаараа бүх зургийг сүйтгэдэг: MapLibre түүнийг
      дэлхийг хамарсан олон өнцөгт болгож зурна. Бичлэгүүд нь
      жагсаалтад ҮЛДЭНЭ — талбайн утга нь хүчинтэй.
    */
    if (!saneGeometry(f.geometry)) {
      dropped++;
      continue;
    }
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` ЗААВАЛ — сонгосныг тодруулна */
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  parcels.sort((a, b) => b.ha - a.ha);
  return { parcels, shapes: { type: "FeatureCollection", features: shapes }, dropped };
}
