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
  /** `SoilData.elements`-тэй ижил дараалалтай утгууд */
  values: (number | null)[];
};

export type SoilData = {
  year: SoilYear;
  points: SoilPoint[];
  /** Элементийн тэмдэглэгээ — "As", "Pb" … */
  elements: string[];
  /** Утга юу гэсэн үг вэ (диаграмын гарчигт) */
  metric: string;
  /** Нэгж — индекс нь нэгжгүй тул хоосон байж болно */
  unit: string;
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
    metric: "Бохирдлын индекс (PI)",
    unit: "",
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
  2023: {
    layer: "Soil_monitoring_2023_500",
    code: "Tseg_num",
    district: "DUUREG_1",
    metric: "Агууламж",
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
  const fields = ["OBJECTID", s.code, s.district, "KH_MON", "PLI", ...Object.values(s.elements)];

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

  const elements = Object.keys(s.elements);
  const cols = Object.values(s.elements) as string[];
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
      values: cols.map((c) => {
        const v = a[c];
        return typeof v === "number" && Number.isFinite(v) ? v : null;
      }),
    });
  }

  return {
    year,
    points,
    elements,
    metric: s.metric,
    unit: s.unit,
    fetchedAt: new Date().toISOString(),
  };
}

/* --------------------------------------------------------------------------
   PLI-ийн ангилал
   -------------------------------------------------------------------------- */

/**
 * Бохирдлын нийлбэр индексийн (PLI) хуваарь.
 *
 * PLI = элементүүдийн PI-ийн геометр дундаж. **1 нь заагдсан хил**:
 * түүнээс доош бол дэвсгэр түвшнээс хэтрээгүй. Дээших зэрэглэлийг
 * (1–2, 2–3, >3) зөвхөн тоон мужаар нэрлэв — эх сурвалж нь ангиллын
 * албан ёсны нэршил өгөөгүй тул "их/бага бохирдол" гэж БҮҮ таамагла.
 */
export const PLI_CLASSES = [
  { id: "0", label: "PLI < 1", note: "Дэвсгэр түвшнээс хэтрээгүй" },
  { id: "1", label: "PLI 1–2", note: "Хилээс дээш" },
  { id: "2", label: "PLI 2–3", note: "Хилээс хоёр дахин дээш" },
  { id: "3", label: "PLI > 3", note: "Хилээс гурав дахин дээш" },
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

/** Шатлалаас нэг утгын өнгийг тооцно (тайлбар, диаграм, тэмдэгт) */
export function pliColor(pli: number): string {
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
