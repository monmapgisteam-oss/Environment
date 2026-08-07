/**
 * Амьтан, ургамлыг хамгаалах хэлтсийн ХОЁР ДАХЬ эх сурвалж —
 * аврагдсан зэрлэг амьтдын бүртгэл 2019–2026 (ArcGIS `GPS_SJ`).
 *
 * Survey123-ийн дуудлагын бүртгэлээс ялгаатай: энэ нь өнгөрсөн жилүүдийн
 * хаагдсан бүртгэл — зүйлийн латин нэр, ховордлын зэрэг, шийдвэрлэсэн
 * байдал зэрэг үр дүнгийн мэдээлэлтэй.
 *
 * `_SJ` нь орон зайн нэгтгэл: `aimag_name`, `soum_name` талбар бэлэн байгаа.
 * Геометр нь проекцлогдсон солбицолтой тул `outSR=4326`-аар асууна.
 */

export const RESCUES_SERVICE =
  "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services/GPS_SJ/FeatureServer/0";

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
  month: number;
  date: number | null;
  soum: string;
  aimag: string;
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

const F = {
  species: "Зүйлийн_монгол_нэр",
  latin: "Латин_нэр",
  rarity: "Ховордлын_зэрэг",
  date: "Дуудлага_өгсөн_сар_өдөр",
  year: "Он",
  month: "Сар",
  situation: "Амьтны_гэмтэл__бэртэл__байгаа_байдал_Эмчилж__асран_хамгаалсан_ба",
  outcome: "Шийдвэрлсэн_байдал",
};

export async function fetchRescues(signal?: AbortSignal): Promise<Rescue[]> {
  const out: Rescue[] = [];

  for (let offset = 0; ; offset += PAGE) {
    const url = `${RESCUES_SERVICE}/query?${new URLSearchParams({
      f: "json",
      where: "1=1",
      outFields: [
        "OBJECTID",
        F.species,
        F.latin,
        F.rarity,
        F.date,
        F.year,
        F.month,
        F.situation,
        F.outcome,
        "soum_name",
        "aimag_name",
      ].join(","),
      outSR: "4326",
      returnGeometry: "true",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "OBJECTID ASC",
    })}`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
    const json = (await res.json()) as { features?: EsriPointFeature[] };
    const feats = json.features ?? [];

    for (const f of feats) {
      const g = f.geometry;
      if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
      const a = f.attributes;
      const outcomeRaw = str(a[F.outcome]);

      out.push({
        oid: Number(a.OBJECTID),
        lon: g.x,
        lat: g.y,
        species: titleCase(a[F.species]) || "Тодорхойгүй",
        latin: str(a[F.latin]),
        rarity: str(a[F.rarity]) || "Тодорхойгүй",
        year: Number(a[F.year]) || 0,
        month: Number(a[F.month]) || 0,
        date: typeof a[F.date] === "number" ? (a[F.date] as number) : null,
        soum: str(a.soum_name) || "Тодорхойгүй",
        aimag: str(a.aimag_name) || "Тодорхойгүй",
        situation: str(a[F.situation]),
        outcomeRaw,
        outcome: classifyOutcome(outcomeRaw),
      });
    }

    if (feats.length < PAGE) break;
  }

  return out;
}
