/**
 * Байгаль орчны ЕРӨНХИЙ ҮНЭЛГЭЭ — нэгж талбарын түвшинд.
 *
 * 254 нэгж талбар, бүгд **2026 онд** шийдвэрлэгдсэн (1–7 сар). Тиймээс
 * энэ бүртгэлд жилийн цуваа БАЙХГҮЙ — хугацааны тэнхлэг нь сар.
 * Шинэ жилийн дата нэмэгдвэл `monthLabel`-ийн оронд жил+сар болгоно.
 *
 * Бүх талбар Улаанбаатарт: `soum` талбарт дүүргийн нэр **дагаваргүй**
 * бичигдсэн ("Сонгинохайрхан", "Хан-Уул") — эвдэрсэн газрын давхаргатай
 * ижил, хөрсний давхаргаас ялгаатай.
 *
 * Геометр нь UTM 48N-д ПРОЕКЦЛОГДСОН тул `outSR=4326` заавал. 254 олон
 * өнцөгт бүтэн нарийвчлалтай нь ердөө 125KB тул ЕРӨНХИЙЛҮҮЛЭХГҮЙ:
 * нэгж талбар нь хотын дотор жижиг (дунджаар 1.8 га, хамгийн бага нь
 * 56 м²) бөгөөд ерөнхийлөлт нь тэдгээрийн хэлбэрийг гажуудуулна.
 *
 * Хөтөч эх сурвалжаас ШУУД татна (`api/` зам биш): бичлэг цөөн бөгөөд
 * бүртгэл нь одоо ч үргэлжилж байгаа тул бүтээх мөчийн зургийг
 * хөлдөөх нь буруу.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";

export const ASSESSMENT_SERVICE = `${HOST}/Parcel_Yrunhii_unelgee/FeatureServer/0`;

export type Assessment = {
  oid: number;
  /** Хүсэгч — иргэн эсвэл аж ахуйн нэгж */
  applicant: string;
  /** Иргэний хүсэлт эсэх (`ААНБ_нэрс` нь "Иргэн …" гэж эхэлдэг) */
  citizen: boolean;
  /** Хүсэлтийн дугаар — "O77-2605-000345" */
  request: string;
  /** Үнэлгээний дугаар — "2026/218" */
  code: string;
  /** Шийдвэрлэсэн огноо, эх бичвэрээр — "2026.05.25" */
  decidedRaw: string;
  year: number | null;
  month: number | null;
  /** Үйл ажиллагааны чиглэл — ЭХ бичвэр, бүтнээрээ */
  activityRaw: string;
  /** Түлхүүр үгээр бүлэглэсэн чиглэл (`ACTIVITIES`-ийн `id`) */
  activity: string;
  /** Газрын зориулалт — эх сурвалжийн ангилал */
  landuse: string;
  /** Эзэмших / өмчлөх / ашиглах */
  right: string;
  district: string;
  /** Хорооны дугаар — `address_kh` */
  khoroo: string;
  /** Хаяг — гудамж, байршил */
  address: string;
  /** Нэгж талбарын дугаар */
  parcel: string;
  /** Талбай, м² (`Shape__Area`, UTM тул метр квадрат) */
  m2: number;
};

export type AssessmentData = {
  rows: Assessment[];
  /** Газрын зурагт — `id` нь `oid`-тай тэнцүү */
  shapes: GeoJSON.FeatureCollection;
};

/* --------------------------------------------------------------------------
   Үйл ажиллагааны чиглэл — ЧӨЛӨӨТ бичвэрийг бүлэглэх
   -------------------------------------------------------------------------- */

/**
 * 254 бичлэгт **160 өөр утга**. Ихэнх нь нэг л удаа тохиолдоно:
 * "Авто засварын газар", "Авто засварын төв", "Авто засвар",
 * "Автомашины засвар" — бүгд нэг зүйл. Бүлэглэхгүй бол диаграм нь
 * 160 мөр болж, аль нь ч нэгээс хоёроос хэтрэхгүй тул юу ч хэлэхгүй.
 *
 * Эх бичвэр `activityRaw`-д БҮТНЭЭРЭЭ үлдэж, сонгосон талбарын
 * дэлгэрэнгүйд харагдана — бүлэглэлт нь дата дарж бичихгүй.
 *
 * **ДАРААЛАЛ чухал.** Дүрмүүд эхнээсээ шалгагдана:
 *  · шатахуун нь агуулахаас түрүү — "Шатахуун түгээх станц, агуулах";
 *  · авто нь худалдаанаас түрүү — "Авто худалдаа, авто засвар, худалдаа";
 *  · үйлдвэр нь агуулахаас түрүү — "Махны үйлдвэр, агуулах".
 *
 * "Авто" гэсэн товч түлхүүр ХЭРЭГЛЭХГҮЙ: "Автохудаг усны төв" нь
 * тээврийн хэрэгсэлтэй огт хамаагүй. Тиймээс хоёр үгийн хослолоор л
 * таньна.
 */
export const ACTIVITIES = [
  { id: "fuel", label: "Шатахуун түгээх" },
  { id: "auto", label: "Авто засвар, үйлчилгээ" },
  { id: "factory", label: "Үйлдвэр, боловсруулалт" },
  { id: "store", label: "Агуулах" },
  { id: "housing", label: "Орон сууц" },
  { id: "trade", label: "Худалдаа, үйлчилгээ" },
  { id: "school", label: "Боловсрол" },
  { id: "health", label: "Эрүүл мэнд" },
  { id: "hotel", label: "Зочид буудал, амралт" },
  { id: "other", label: "Бусад" },
] as const;

const RULES: [string, RegExp][] = [
  /*
    Хийгээр цэнэглэх станц нь ШАТАХУУНД орно. "Автомашин болон ахуйн
    баллон хийгээр цэнэглэх станц" гэдэг нь "авто машин" гэсэн үгээрээ
    доорх `auto` дүрэмд унаж байсан ч тэр нь авто засварын газар БИШ —
    түлш түгээх цэг, тэр дундаа ахуйн баллон нь тээвэртэй огт
    хамаагүй.
  */
  ["fuel", /шатахуун|хийгээр цэнэглэх/],
  [
    /*
      "автобус" нь тусад нь: "Автобус бааз" гэдэг дээр "авто"-гийн
      дараа "бус" ирдэг тул доорх зайн загварт таарахгүй.

      "авто" ба дараагийн үг хоорондоо зайтай ч, зайгүй ч бичигдэнэ:
      "Автомашины засвар" ба "Авто машины засвар" хоёулаа бүртгэлд бий.
      Мөн "угаалг" гэж таслав — "угаалгын" нь "угаалга" гэсэн хэвд
      таарахгүй байлаа.
    */
    "auto",
    /автобус|авто\s*(машин|засвар|угаалг|сервис|худалда|зогсоол|гараж|бааз|сэлбэг|худаа)|кузов|агрегат засвар|тос тосолгоо/,
  ],
  ["factory", /үйлдвэр|цех|боловсруул|нядалгаа|савла/],
  ["store", /агуулах/],
  ["housing", /орон сууц|резиденс|хотхон/],
  ["school", /хичээл|сургууль|цэцэрлэг|оюутны|боловсрол/],
  ["health", /эмнэлэг|эрүүл мэнд|сувилахуй|түргэн тусламж|нярай|^эм /],
  ["hotel", /зочид буудал|хостел|амралт|зуслан/],
  [
    "trade",
    /худалда|үйлчилгээ|дэлгүүр|оффис|контор|зах|цайны газар|студи|төв|барилга|байр/,
  ],
];

export function classifyActivity(raw: string): string {
  const x = raw.toLowerCase().trim();
  if (!x) return "other";
  for (const [id, re] of RULES) if (re.test(x)) return id;
  return "other";
}

/* --------------------------------------------------------------------------
   Талбайн хэмжээний ангилал
   -------------------------------------------------------------------------- */

/**
 * Эдгээр нь эх сурвалжаас ирсэн ангилал БИШ, бидний зурсан хуваарь —
 * тиймээс "жижиг / том" гэж нэрлэхгүй, зөвхөн тоон мужаар нь бичнэ.
 *
 * Хэмжээ нь эрс хазайсан: хамгийн бага нь 56 м², хамгийн их нь 130 га.
 * Логарифм алхамтай хуваарь л энэ тархалтыг уншуулна.
 */
export const SIZE_CLASSES = [
  { id: "0", label: "500 м²-ээс бага", max: 500 },
  { id: "1", label: "500 – 2,000 м²", max: 2000 },
  { id: "2", label: "0.2 – 1 га", max: 10000 },
  { id: "3", label: "1 – 10 га", max: 100000 },
  { id: "4", label: "10 га-аас их", max: Infinity },
] as const;

export function sizeClass(m2: number): number {
  for (let i = 0; i < SIZE_CLASSES.length; i++) {
    if (m2 < SIZE_CLASSES[i].max) return i;
  }
  return SIZE_CLASSES.length - 1;
}

/* -------------------------------------------------------------------------- */

type Props = Record<string, string | number | null>;

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function fetchAssessments(signal?: AbortSignal): Promise<AssessmentData> {
  const url =
    `${ASSESSMENT_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: [
        "OBJECTID",
        "ААНБ_нэрс",
        "Хүсэлтийн_дугаар",
        "Үнэлгээний_дугаар",
        "Шийдвэрлэсэн_он_сар_өдөр",
        "Шийдвэрлэсэн_он",
        "Шийдвэрлэсэн_сар",
        "Үйл_ажиллагааны_чиглэл",
        "landuse_de",
        "rigth_type",
        "soum",
        "address_kh",
        "address_ne",
        "parcel_id",
        "Shape__Area",
      ].join(","),
      outSR: "4326",
      orderByFields: "OBJECTID",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Ерөнхий үнэлгээ татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };

  const rows: Assessment[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    const applicant = str(p["ААНБ_нэрс"]);
    const activityRaw = str(p["Үйл_ажиллагааны_чиглэл"]);

    rows.push({
      oid,
      applicant: applicant || "Тодорхойгүй",
      /* Эх сурвалж иргэнийг "Иргэн Ц.Энхтүвшин" гэж бүртгэдэг */
      citizen: /^иргэн/i.test(applicant),
      request: str(p["Хүсэлтийн_дугаар"]),
      code: str(p["Үнэлгээний_дугаар"]),
      decidedRaw: str(p["Шийдвэрлэсэн_он_сар_өдөр"]),
      year: int(p["Шийдвэрлэсэн_он"]),
      month: int(p["Шийдвэрлэсэн_сар"]),
      activityRaw,
      activity: classifyActivity(activityRaw),
      landuse: str(p.landuse_de) || "Тодорхойгүй",
      right: str(p.rigth_type) || "Тодорхойгүй",
      district: str(p.soum) || "Тодорхойгүй",
      khoroo: str(p.address_kh),
      address: str(p.address_ne),
      parcel: str(p.parcel_id),
      m2: Number(p.Shape__Area) || 0,
    });

    if (!f.geometry) continue;
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` шаардлагатай — сонгосон талбайг
         тодруулахад хэрэглэнэ */
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  return { rows, shapes: { type: "FeatureCollection", features: shapes } };
}
