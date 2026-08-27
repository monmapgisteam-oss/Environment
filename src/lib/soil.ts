/**
 * Хөрсний байнгын хяналт шинжилгээний мониторингийн цэг.
 *
 * ХОЁР ЖИЛ, ХОЁР ӨӨР БҮТЭЦ:
 *  · 2024 (507 цэг) — элемент бүрийн бохирдлын ИНДЕКС (PI = агууламж /
 *    дэвсгэр агууламж) ба Igeo. Нэгжгүй харьцаа.
 *  · 2023 (500 цэг) — элемент бүрийн АГУУЛАМЖ (мг/кг). Бодит хэмжилт.
 *
 * Тиймээс элементийн тоог ХОЁР ЖИЛ ХООРОНД ХАРЬЦУУЛЖ БОЛОХГҮЙ — өөр
 * хэмжигдэхүүн. Харьцуулж болох цорын ганц зүйл нь PLI (хоёуланд нь
 * байгаа нийлбэр индекс) ба цэгийн байршил.
 *
 * Хөтөч ШУУД ArcGIS-ээс татна (`api/` зам хэрэглэхгүй) — сайт статикаар
 * экспортлогддог тул API зам нь бүтээх мөчийн зургийг хөлдөөнө. Хоёр
 * эх сурвалж 500 орчим бичлэгтэй тул шахах ч шаардлагагүй.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";

/** Эх сурвалжийн хуудсанд бүртгэхэд */
export const SOIL_SERVICES = [
  `${HOST}/Soil_monitoring_2024_500/FeatureServer/0`,
  `${HOST}/Soil_monitoring_2023_500/FeatureServer/0`,
];

export const SOIL_YEARS = [2024, 2023] as const;
export type SoilYear = (typeof SOIL_YEARS)[number];

/**
 * Нэг жилийн нэг ХЭМЖИГДЭХҮҮН.
 *
 * Нэг давхарга нэгээс олон хэмжигдэхүүн агуулж болно: 2024 онд ижил 10
 * элемент дээр PI ба Igeo гэсэн ХОЁР индекс бодогдсон байна. Тэднийг нэг
 * жагсаалтад хольж болохгүй (масштаб нь өөр) тул тусад нь барина.
 */
export type SoilMetric = {
  id: string;
  /** Диаграмын гарчигт бичигдэх нэр */
  label: string;
  /** Нэгж — индекс нь нэгжгүй тул хоосон байж болно */
  unit: string;
  /**
   * ХЭВИЙН байх дээд хязгаар. Диаграмд босоо заагч болж зурагдана.
   *
   * ЗӨВХӨН баримтжсан хэмжигдэхүүнд өгнө. PI = агууламж / дэвсгэр
   * агууламж тул 1 нь тодорхойлолтоороо дэвсгэр түвшин — таамаг биш.
   * Igeo-д хязгаар БАЙХГҮЙ (эх сурвалж товчлолыг нь ч тайлаагүй), 2023
   * оны агууламжид ч байхгүй (элемент бүр өөр нормтой бөгөөд датад
   * ороогүй). Байхгүй бол заагч ч, өнгө ч гарахгүй.
   */
  limit?: number;
  /** Элементийн тэмдэглэгээ — "As", "Pb" … */
  elements: string[];
};

/** Нэг цэгийн хэмжилт */
export type SoilPoint = {
  oid: number;
  /** Цэгийн дугаар — 2024 "BHD-1", 2023 дугаарлалт */
  code: string;
  lon: number;
  lat: number;
  district: string;
  khoroo: string;
  pli: number;
  /** `SoilData.metrics`-тэй ижил дараалалтай: `values[хэмжигдэхүүн][элемент]` */
  values: (number | null)[][];
};

export type SoilData = {
  year: SoilYear;
  points: SoilPoint[];
  metrics: SoilMetric[];
  fetchedAt: string;
};

/*
  Талбарын зураглал. Элементийн ДАРААЛАЛ нь үелэх системийн биш —
  диаграм дээр дундажаараа эрэмбэлэгддэг тул энд зөвхөн ямар талбар
  байгааг л тодорхойлно.
*/
const SCHEMA = {
  2024: {
    layer: "Soil_monitoring_2024_500",
    code: "Dugaar",
    district: "DUUREG",
    metrics: [
      {
        id: "pi",
        label: "Бохирдлын индекс (PI)",
        unit: "",
        /* PI = агууламж / дэвсгэр агууламж → 1 нь дэвсгэр түвшин */
        limit: 1,
        elements: {
          As: "As_PI",
          Cd: "Cd_PI",
          Co: "Co_PI",
          Cr: "Cr_PI",
          Cu: "Cu_PI",
          Mo: "Mo_PI",
          Ni: "Ni_PI",
          Pb: "Pb_PI",
          Sr: "Sr_PI",
          Zn: "Zn_PI",
        },
      },
      {
        /*
          Хоёр дахь индекс — геоаккумуляцийн индекс (Müller, 1969):
          Igeo = log₂(C / 1.5·B). Ижил 10 элемент дээр бодогдсон ч
          хуваарь нь ЛОГАРИФМ тул PI-тай нэг диаграмд хольж болохгүй
          (PI дундаж 1 орчим, Igeo дундаж 0.2 боловч дээд утга 7).

          Заагчийг 1 дээр тавив, 0 дээр БИШ. Müller-ийн хуваарийн
          "бохирдоогүй" хил нь 0 мөн боловч энэ датад Igeo нь 0-оос
          доош бараг унадаггүй (Cd_Igeo нь 507-гаас 500 дээр яг 0) тул
          0 дээрх зураас бараг бүх зурвасын эхэнд наалдаж, юу ч
          хэлэхгүй. 1 нь "дунд зэргийн бохирдол" анги эхлэх хил.
        */
        id: "igeo",
        label: "Igeo",
        unit: "",
        limit: 1,
        elements: {
          As: "As_Igeo",
          Cd: "Cd_Igeo",
          Co: "Co_Igeo",
          Cr: "Cr_Igeo",
          Cu: "Cu_Igeo",
          Mo: "Mo_Igeo",
          Ni: "Ni_Igeo",
          Pb: "Pb_Igeo",
          Sr: "Sr_Igeo",
          Zn: "Zn_Igeo",
        },
      },
    ],
  },
  2023: {
    layer: "Soil_monitoring_2023_500",
    code: "Tseg_num",
    district: "DUUREG_1",
    metrics: [
      {
        id: "conc",
        label: "Агууламж",
        unit: "мг/кг",
        elements: {
          As: "As_",
          B: "B",
          Cd: "Cd",
          Co: "Co",
          Cr: "Cr",
          Cu: "Cu",
          Hg: "Hg",
          Mo: "Mo",
          Ni: "Ni",
          Pb: "Pb",
          Sr: "Sr",
          Zn: "Zn",
        },
      },
    ],
  },
} as const;

/**
 * Хорооны нэрийг нэг хэлбэрт оруулна.
 *
 * 2023 нь "СБД_03" гэсэн код, 2024 нь "2-р хороо" гэсэн бичвэр хэрэглэдэг.
 * Кодтойг нь дугаар руу буулгана; хөдөөгийн багийн нэр кодгүй тул
 * байгаагаар нь үлдээнэ.
 */
function khorooLabel(raw: string | null): string {
  if (!raw) return "Тодорхойгүй";
  const part = raw.split("_")[1];
  if (!part) return raw;
  const n = Number(part);
  return Number.isFinite(n) ? `${n}-р хороо` : raw;
}

type Row = Record<string, string | number | null>;

export async function fetchSoil(year: SoilYear): Promise<SoilData> {
  const s = SCHEMA[year];
  /* Хэмжигдэхүүн бүрийн баганыг нэг хүсэлтээр татна — 2024 онд 20 багана */
  const cols = s.metrics.map((m) => Object.values(m.elements) as string[]);
  const fields = ["OBJECTID", s.code, s.district, "KH_MON", "PLI", ...cols.flat()];

  const url =
    `${HOST}/${s.layer}/FeatureServer/0/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: fields.join(","),
      /* Геометр нь UTM 48N-д ПРОЕКЦЛОГДСОН — газрын зурагт хэрэгтэй
         градус руу буулгуулна */
      outSR: "4326",
      resultRecordCount: "2000",
      f: "json",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${year} оны хөрсний мэдээ татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    error?: { message: string };
    features?: { attributes: Row; geometry?: { x: number; y: number } }[];
  };
  if (json.error) throw new Error(json.error.message);

  const metrics: SoilMetric[] = s.metrics.map((m) => ({
    id: m.id,
    label: m.label,
    unit: m.unit,
    limit: "limit" in m ? m.limit : undefined,
    elements: Object.keys(m.elements),
  }));
  const points: SoilPoint[] = [];

  for (const f of json.features ?? []) {
    const g = f.geometry;
    /* Координатгүй бичлэг газрын зурагт ч, тархалтад ч орох ёсгүй */
    if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
    const a = f.attributes;
    const pli = Number(a.PLI);
    if (!Number.isFinite(pli)) continue;

    points.push({
      oid: Number(a.OBJECTID),
      code: String(a[s.code] ?? a.OBJECTID),
      lon: g.x,
      lat: g.y,
      district: String(a[s.district] ?? "Тодорхойгүй"),
      khoroo: khorooLabel(a.KH_MON as string | null),
      pli,
      values: cols.map((mc) =>
        mc.map((c) => {
          const v = a[c];
          return typeof v === "number" && Number.isFinite(v) ? v : null;
        }),
      ),
    });
  }

  return {
    year,
    points,
    metrics,
    fetchedAt: new Date().toISOString(),
  };
}

/* --------------------------------------------------------------------------
   PLI-ийн ангилал
   -------------------------------------------------------------------------- */

/**
 * Бохирдлын ачааллын индексийн (PLI — Pollution Load Index) хуваарь.
 * Нэршлийг хэлтэс баталсан (2026-08-17).
 *
 * PLI = элементүүдийн PI-ийн геометр дундаж. **1 нь заагдсан хил**:
 * түүнээс доош бол дэвсгэр түвшнээс хэтрээгүй. Дээших зэрэглэлийг
 * (1–2, 2–3, >3) зөвхөн тоон мужаар нэрлэв — эх сурвалж нь ангиллын
 * албан ёсны нэршил өгөөгүй тул "их/бага бохирдол" гэж БҮҮ таамагла.
 */
export const PLI_CLASSES = [
  { id: "0", label: "PLI < 1", note: "Дэвсгэр түвшнээс хэтрээгүй" },
  { id: "1", label: "PLI 1–2", note: "Дэвсгэр түвшнээс дээш" },
  { id: "2", label: "PLI 2–3", note: "Дэвсгэр түвшнээс хоёр дахин дээш" },
  { id: "3", label: "PLI > 3", note: "Дэвсгэр түвшнээс гурав дахин дээш" },
] as const;

export function pliClass(pli: number): 0 | 1 | 2 | 3 {
  if (pli < 1) return 0;
  if (pli < 2) return 1;
  if (pli < 3) return 2;
  return 3;
}

/**
 * PLI-ийн өнгөний шатлал — ногооноос улаан.
 *
 * Энэ бол платформын цорын ганц ТАСРАЛТГҮЙ шатлал. Бусад самбар нэг
 * өнгө хэрэглэдэг нь зөв: тэдний ангилал НЭРЛЭСЭН (аймаг, гүйцэтгэгч)
 * тул өнгөөр ялгавал утгагүй солонго болно. PLI бол ЭРЭМБЭТЭЙ, бүр
 * тодорхой сайн/муу чиглэлтэй хэмжигдэхүүн — тохиромжтой байдлын
 * үнэлгээний зураг яг ийм шатлал хэрэглэдэг.
 *
 * Шилжилтийн цэгүүд нь санамсаргүй биш: 1.0 (дэвсгэр түвшний хил)
 * дээр шар болж, түүнээс дээш улаан руу шилжинэ.
 */
export const PLI_RAMP: [number, string][] = [
  [0.4, "#2f9e6b"],
  [1.0, "#a8bf46"],
  [1.6, "#e0bd4f"],
  [2.5, "#df8146"],
  [4.0, "#c33f34"],
];

/* --------------------------------------------------------------------------
   ЭЛЕМЕНТИЙН ИНДЕКСҮҮДИЙН ОЛОН УЛСЫН АНГИЛАЛ

   PLI-ээс ЯЛГААТАЙ: PLI нь цэг бүрийн НЭГТГЭСЭН үзүүлэлт бол доорх хоёр
   нь ЭЛЕМЕНТ тус бүрийнх. Гурвуулаа дэвсгэр агууламжид харьцуулсан тул
   "1" (эсвэл Igeo дээр "0") гэсэн хил нь гурвуулан дээр ижил утгатай ч
   тоонууд нь ХАРИЛЦАН СОЛИГДОХГҮЙ.
   -------------------------------------------------------------------------- */

/**
 * Бохирдлын индекс PI (= бохирдлын хүчин зүйл, contamination factor).
 *
 * Håkanson (1980) -ийн ангилал — хөрс, тунадасны бохирдол үнэлэх олон
 * улсын хамгийн өргөн хэрэглэгддэг хуваарь. Энэ нь эх сурвалжийн БИШ,
 * ОЛОН УЛСЫН УТГА ЗҮЙН ангилал тул нэрийг нь бичиж болно — харин
 * "албан ёсны монгол стандарт" гэж БҮҮ ойлго.
 */
export const PI_CLASSES = [
  { id: "0", label: "PI < 1", note: "Бага бохирдол" },
  { id: "1", label: "PI 1–3", note: "Дунд зэргийн бохирдол" },
  { id: "2", label: "PI 3–6", note: "Нэлээд бохирдол" },
  { id: "3", label: "PI ≥ 6", note: "Маш өндөр бохирдол" },
] as const;

export function piClass(pi: number): 0 | 1 | 2 | 3 {
  if (pi < 1) return 0;
  if (pi < 3) return 1;
  if (pi < 6) return 2;
  return 3;
}

/**
 * Ангиллын өнгө — PLI-ийн ТАСРАЛТГҮЙ шатлалаас дөрвөн цэг сонгосон.
 *
 * Тасралтгүй шатлалыг шууд хэрэглэж БОЛОХГҮЙ: тэр нь 4.0 дээр ханадаг
 * тул PI 4 (нэлээд) ба PI 200 (маш өндөр) хоёр ижил өнгөтэй болно.
 * Ангиллын алхмаар өгөхөд хил бүр нүдэнд харагдана.
 */
const PI_CLASS_COLOR = [0.7, 1.4, 2.8, 4.5].map((v) => pliColorRaw(v));

export function piColor(pi: number): string {
  return PI_CLASS_COLOR[piClass(pi)];
}

/**
 * Геоаккумуляцийн индекс Igeo = log₂(C / 1.5·B).
 *
 * Müller (1969) -ийн долоон анги. Хуваарь нь ЛОГАРИФМ тул PI-тай
 * шууд харьцуулагдахгүй: Igeo 1 нь агууламж дэвсгэрээс 3 дахин их
 * гэсэн үг (1.5 × 2¹).
 *
 * Датад Igeo нь 0-оос доош бараг унадаггүй (эх сурвалж таслалттай)
 * тул 0 дээрх хил нь дэлгэц дээр бараг мэдэгдэхгүй — заагчийг 1 дээр
 * тавьдаг нь илүү мэдээлэл өгнө.
 */
export const IGEO_CLASSES = [
  { id: "0", label: "Igeo ≤ 0", note: "Бохирдоогүй" },
  { id: "1", label: "Igeo 0–1", note: "Бохирдоогүйгээс дунд зэрэг" },
  { id: "2", label: "Igeo 1–2", note: "Дунд зэргийн бохирдол" },
  { id: "3", label: "Igeo 2–3", note: "Дунд зэргээс их бохирдол" },
  { id: "4", label: "Igeo 3–4", note: "Их бохирдол" },
  { id: "5", label: "Igeo 4–5", note: "Ихээс маш их бохирдол" },
  { id: "6", label: "Igeo > 5", note: "Маш их бохирдол" },
] as const;

export function igeoClass(v: number): number {
  if (v <= 0) return 0;
  return Math.min(6, Math.floor(v) + 1);
}

/** Müller-ийн долоон ангийг ижил гэр бүлийн өнгөнд буулгав */
const IGEO_CLASS_COLOR = [0.4, 0.9, 1.3, 1.8, 2.4, 3.2, 4.5].map((v) => pliColorRaw(v));

export function igeoColor(v: number): string {
  return IGEO_CLASS_COLOR[igeoClass(v)];
}

/** Шатлалаас нэг утгын өнгийг тооцно (тайлбар, диаграм, тэмдэгт) */
export function pliColor(pli: number): string {
  return pliColorRaw(pli);
}

function pliColorRaw(pli: number): string {
  const s = PLI_RAMP;
  if (pli <= s[0][0]) return s[0][1];
  if (pli >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 1; i < s.length; i++) {
    if (pli > s[i][0]) continue;
    const t = (pli - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
    return mix(s[i - 1][1], s[i][1], t);
  }
  return s[s.length - 1][1];
}

/** Хоёр hex өнгийг шугаман хольно */
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const to = (x: number) => Math.round(x).toString(16).padStart(2, "0");
  return `#${to(r1 + (r2 - r1) * t)}${to(g1 + (g2 - g1) * t)}${to(b1 + (b2 - b1) * t)}`;
}
