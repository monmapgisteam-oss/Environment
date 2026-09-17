/**
 * Цаг агаарын ажиглалтын сүлжээ — Ус цаг уур, орчны шинжилгээний газар.
 *
 * Эх сурвалж: `weather.gov.mn`-ийн нээлттэй API. ГУРВАН зам ашиглана,
 * гуравуулаа түлхүүргүй нээлттэй бөгөөд `Access-Control-Allow-Origin`-оо
 * хүсэлтийн эх үүсвэрээр буцаадаг тул ХӨТЧӨӨС ШУУД татагдана
 * (`api/` зам, файлын хуулбар шаардлагагүй):
 *
 *   1. `/api/get/obs/aimags`        — станцын бүртгэл, координат, өндөршил
 *   2. `/api/get/obs/data/aws`      — станц бүрийн СҮҮЛИЙН ажиглалт
 *   3. `/api/get/5dayforecastall`   — станц бүрийн 5 хоногийн урьдчилсан мэдээ
 *
 * Хэрэглэгчийн өгсөн `/api/get/obs/data/aws/292` нь (2)-ын нэг станцын
 * хувилбар — 292 бол Улаанбаатар. Бүхэл сүлжээг татдаг болсон учир нь
 * нийслэлд ДОЛООН станц байгаа бөгөөд тэдгээрийг зэрэгцүүлэхгүй бол
 * "Улаанбаатарын агаарын температур" гэдэг нь ганц мэдрэгчийн заалт болж
 * үлдэнэ.
 *
 * ⚠ ЭНЭ API ТҮҮХ ӨГӨХГҮЙ. Ажиглалтын зам нь ЗӨВХӨН хамгийн сүүлийн
 * заалтыг буцаана — өдрийн, сарын, жилийн цуваа авах зам БАЙХГҮЙ
 * (`obs/data/obs_date`, `.../history`, `.../24` бүгд 404). Тиймээс энэ
 * сэдэвт ХАНДЛАГЫН ДИАГРАМ ЗУРАХ БОЛОМЖГҮЙ: харагдац нь тухайн мөчийн
 * сүлжээний зураг ба урагшаа 5 хоногийн мэдээ хоёроор хязгаарлагдана.
 * Хэрэв түүх хэрэгтэй болбол `archive.weather.gov.mn` тусдаа систем.
 */

/* --------------------------------------------------------------------------
   ТАЛБАРЫН УТГА — ЭХ СУРВАЛЖИЙН АЛБАН ЁСНЫ ЖАГСААЛТААР

   Ус цаг уур, орчны шинжилгээний газраас 2026-09-10-нд талбарын
   тайлбарыг ирүүлэв. Бүрэн жагсаалт нь ХАРИУЛТАД БАЙГААГААС ИЛҮҮ:

     aimag / aimag_name  аймгийн нэр
     sum_name            сумын нэр
     sid                 станцын дугаар
     lat / lon           өргөрөг / уртраг
     obs_date            ажиглалтын хугацаа
     snow_depth          цасны зузаан
     tmin / tmax         хамгийн бага / их температур
     wind_speed          салхины хурд
     wind_dir            салхины чиглэл
     ff                  харьцангуй чийг
     pst                 станцын түвшний даралт
     precip              тунадас

   ⚠ ЖАГСААЛТАД БАЙГАА ГЭДЭГ НЬ ХАРИУЛТАД БАЙНА ГЭСЭН ҮГ БИШ.
   2026-09-10-ны байдлаар 317 станцын хариултад `snow_depth`, `tmin`,
   `tmax`, `lat`, `lon` ТАЛБАР НЬ ӨӨРӨӨ БАЙХГҮЙ (`null` ч биш —
   түлхүүр нь огт байхгүй). Цасны зузаан нь улирлын, хэмжигдэхүүний
   их/бага нь тодорхой цагийн ажиглалтад л гардаг бололтой. Тиймээс
   эдгээрийг БОЛЗОЛТ талбар болгож уншина: гарч ирвэл өөрөө
   харагдана, байхгүй үед нүд нь ч гарахгүй. Ирээдүйд өвөл болоход
   код өөрчлөх шаардлагагүй.

   Координат нь ажиглалтын хариултад БАЙХГҮЙ тул станцын бүртгэлээс
   (`obs/aimags`) авна — гарч ирвэл ажиглалтынхыг урьтуулна.

   Албан жагсаалтад БАЙХГҮЙ, гэхдээ хариултад ирдэг талбарууд:
     ttt / ttt_feels  агаарын температур / мэдрэгдэх температур, °C.
                      Хоёрын зөрүү 317 станцын 79-д гарна — ХОЁР ТИЙШ
                      (39 эерэг, 40 сөрөг) тул зөвхөн салхины хүйтрэлт
                      биш, чийг, нарны нөлөө бүхэлдээ.
     nh (ба ганц станцын хариулт дахь `Nh`)  нийт үүлшил, балл 0–10.
     ww               одоогийн үзэгдлийн олон улсын код. 317 станцын
                      ердөө 6-д бөглөгддөг бөгөөд кодын толь эх
                      сурвалжид байхгүй тул ХЭРЭГЛЭХГҮЙ. Үзэгдлийн
                      монгол нэр урьдчилсан мэдээнээс (`phenoDay`)
                      гарна.

   ⚠ `pst` дээр **0 нь хэмжигдээгүйн тэмдэг** — станцын түвшний даралт
   хэзээ ч тэг болохгүй (сүлжээний бодит доод утга 764 гПа, өндөршилтэй
   -0.991 хамааралтай). Хоёр станц тэг илгээдэг тул `null` болгоно.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   ТҮЛХҮҮР

   Зарим зам (`obs/tuimer` гэх мэт) `Authorization` толгойд түлхүүр
   шаарддаг — 401 "API key is required". ЭНЭ САНГИЙН ГУРВАН ЗАМ
   ШААРДДАГГҮЙ тул анхнаасаа түлхүүргүй ажиллана.

   ⚠ САЙТ СТАТИКААР ЭКСПОРТЛОГДДОГ. `NEXT_PUBLIC_*` хувьсагч нь
   бүтээх үед хөтчийн багц руу ШУУД БИЧИГДДЭГ тул энд тавьсан түлхүүр
   нь сайт нээсэн хэн бүхэнд ил текстээр харагдана. Түлхүүр шаардсан
   зам үнэхээр хэрэгтэй болбол сервер тал (прокси) хэрэгтэй — энэ нь
   зөвхөн нээлттэй замуудад зориулсан сонголт.

   Серверийн preflight `Access-Control-Allow-Headers: authorization`
   буцаадаг тул хөтчөөс илгээхэд саадгүй.
   -------------------------------------------------------------------------- */

const KEY = process.env.NEXT_PUBLIC_WEATHER_KEY ?? "";

const API = "https://weather.gov.mn/api/get";

export type Station = {
  sid: number;
  /** Станцын нэр ("Улаанбаатар", "Буянт-Ухаа") */
  name: string;
  /** Харьяалах сум, дүүрэг ("Хан-Уул (Буянт-Ухаа)") */
  place: string;
  aimag: string;
  aimagId: number;
  lat: number;
  lon: number;
  /** Далайн түвшнээс дээш, метр */
  elev: number;
};

export type Obs = {
  sid: number;
  /** Ажиглалтын мөч, ISO (UTC) */
  at: string;
  temp: number | null;
  feels: number | null;
  /** Агаарын харьцангуй чийг, хувь */
  humidity: number | null;
  /** Агаарын даралт, гектопаскаль */
  pressure: number | null;
  /** Нийт үүлшил, балл (0–10) */
  cloud: number | null;
  /** Салхины хурд, м/с */
  wind: number | null;
  /** Салхины зүг, градус */
  windDir: number | null;
  /** Хур тунадас, мм */
  precip: number | null;
  /** Цасны зузаан, см. Улирлын — зунд талбар нь өөрөө ирэхгүй */
  snowDepth: number | null;
  /** Хамгийн бага температур, °C. Тодорхой цагийн ажиглалтад л ирнэ */
  tmin: number | null;
  /** Хамгийн их температур, °C */
  tmax: number | null;
};

export type ForecastDay = {
  /** "2026-09-11" */
  date: string;
  dayTemp: number | null;
  nightTemp: number | null;
  dayFeels: number | null;
  nightFeels: number | null;
  dayPheno: string;
  nightPheno: string;
  /** Тунадас орох магадлал, хувь */
  dayPrecip: number | null;
  nightPrecip: number | null;
  dayWind: number | null;
  nightWind: number | null;
};

export type WeatherData = {
  /** Дата татсан мөч — заалтын нас үүнээс тооцогдоно */
  fetched: number;
  stations: Station[];
  obs: Map<number, Obs>;
  forecast: Map<number, ForecastDay[]>;
};

/* -------------------------------------------------------------------------- */

type RawStation = {
  aimag_name: string;
  aimag_id: number;
  sum_name: string;
  sta_name: string;
  sid: number;
  lat: number;
  lon: number;
  elev: number;
};

type RawObs = {
  sid: number;
  obs_date: string;
  ttt: number | null;
  ttt_feels: number | null;
  ff: number | null;
  pst: number | null;
  nh: number | null;
  wind_speed: number | null;
  wind_dir: number | null;
  precip: number | null;
  /* Албан жагсаалтад байгаа ч хариултад ҮРГЭЛЖ ирдэггүй */
  snow_depth?: number | null;
  tmin?: number | null;
  tmax?: number | null;
  lat?: number | null;
  lon?: number | null;
};

type RawForecast = {
  sid: number;
  data: {
    date: string;
    temperatureDay: number | null;
    temperatureNight: number | null;
    temperatureDay_feel: number | null;
    temperatureNight_feel: number | null;
    phenoDay: string | null;
    phenoNight: string | null;
    Percentage_Precipitation_Day: number | null;
    Percentage_Precipitation_Night: number | null;
    windDay: number | null;
    windNight: number | null;
  }[];
};

/** Тоо мөн эсэхийг шалгана — эх сурвалж хоосныг `null` эсвэл мөрөөр өгдөг */
function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  // eslint-disable-next-line no-restricted-globals -- цаг агаарын нээлттэй API — ArcGIS биш, токен хүлээж авдаггүй
  const res = await fetch(`${API}/${path}`, {
    ...(signal ? { signal } : {}),
    ...(KEY ? { headers: { Authorization: KEY } } : {}),
  });
  if (!res.ok) throw new Error(`Цаг агаарын мэдээ татагдсангүй (${res.status})`);
  return (await res.json()) as T;
}

export async function fetchWeather(signal?: AbortSignal): Promise<WeatherData> {
  const [reg, cur, fc] = await Promise.all([
    get<{ aimag_sum: RawStation[] }>("obs/aimags", signal),
    get<{ stationAWS: RawObs[] }>("obs/data/aws", signal),
    get<{ foreacast5day_all: RawForecast[] }>("5dayforecastall", signal),
  ]);

  /*
    Ажиглалтын хариултад координат ГАРЧ ИРВЭЛ түүнийг урьтуулна:
    станцын байрлал шинэчлэгдвэл бүртгэл нь хоцорч болно. Одоогоор
    хариултад энэ талбар байхгүй тул практикт бүртгэлийнх л үлдэнэ.
  */
  const coords = new Map<number, { lat: number; lon: number }>();
  for (const r of cur.stationAWS ?? []) {
    const lat = n(r.lat);
    const lon = n(r.lon);
    if (lat != null && lon != null) coords.set(r.sid, { lat, lon });
  }

  const stations: Station[] = (reg.aimag_sum ?? [])
    .map((s) => {
      const c = coords.get(s.sid) ?? { lat: n(s.lat), lon: n(s.lon) };
      return {
        sid: s.sid,
        name: s.sta_name || s.sum_name,
        place: s.sum_name,
        aimag: s.aimag_name,
        aimagId: s.aimag_id,
        lat: c.lat,
        lon: c.lon,
        elev: s.elev,
      };
    })
    .filter((s): s is Station => s.lat != null && s.lon != null);

  const obs = new Map<number, Obs>();
  for (const r of cur.stationAWS ?? []) {
    const pressure = n(r.pst);
    obs.set(r.sid, {
      sid: r.sid,
      at: r.obs_date,
      temp: n(r.ttt),
      feels: n(r.ttt_feels),
      humidity: n(r.ff),
      /* 0 нь хэмжигдээгүйн тэмдэг — станцын түвшний даралт хэзээ ч
         тэг болохгүй (сүлжээний хамгийн бага бодит утга 764 гПа) */
      pressure: pressure === 0 ? null : pressure,
      cloud: n(r.nh),
      wind: n(r.wind_speed),
      windDir: n(r.wind_dir),
      precip: n(r.precip),
      snowDepth: n(r.snow_depth),
      tmin: n(r.tmin),
      tmax: n(r.tmax),
    });
  }

  const forecast = new Map<number, ForecastDay[]>();
  for (const r of fc.foreacast5day_all ?? []) {
    forecast.set(
      r.sid,
      (r.data ?? []).map((d) => ({
        date: d.date,
        dayTemp: n(d.temperatureDay),
        nightTemp: n(d.temperatureNight),
        dayFeels: n(d.temperatureDay_feel),
        nightFeels: n(d.temperatureNight_feel),
        dayPheno: d.phenoDay ?? "",
        nightPheno: d.phenoNight ?? "",
        dayPrecip: n(d.Percentage_Precipitation_Day),
        nightPrecip: n(d.Percentage_Precipitation_Night),
        dayWind: n(d.windDay),
        nightWind: n(d.windNight),
      })),
    );
  }

  return { fetched: Date.now(), stations, obs, forecast };
}

/* --------------------------------------------------------------------------
   ЗААЛТЫН НАС

   Сүлжээ нэгэн жигд БИШ: 317 станцын 298 нь сүүлийн гурван цагт мэдээлсэн
   бол 17 нь долоо хоногоос дээш хугацаанд чимээгүй (нэг нь бүр өнгөрсөн
   оноос хойш). Тиймээс заалт бүр өөрийн МӨЧТЭЙГӨӨ хамт л утгатай —
   насыг нь заахгүй бол хуучирсан тоог одоогийнх мэт уншина.
   -------------------------------------------------------------------------- */

/** Заалт хэдэн цагийн өмнөх вэ. Огноо задрахгүй бол `null` */
export function ageHours(iso: string, now: number): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / 3600000 : null;
}

/**
 * Заалтыг "одоогийн" гэж үзэх дээд нас.
 *
 * ⚠ 3 ЦАГ БОЛГОЖ БОЛОХГҮЙ. Нийслэлийн долоон станц хоёр өөр хуваарьтай:
 * тав нь 10 минут тутам, хоёр нь (Буянт-Ухаа, Мишээл Экспо) синоптик
 * цагаар буюу 6 цаг тутам мэдээлдэг. Гурван цагийн хязгаар нь тэр
 * хоёрыг хуваариасаа болоод л хаяж, долоо станцын тав нь үлдэнэ —
 * доголдсоных нь тэмдэг биш.
 *
 * Арван хоёр цаг нь хоёр хуваарийг хоёуланг нь багтаах ба үнэхээр
 * унтарсан станцыг (тэдгээр нь долоо хоног, сараар чимээгүй байдаг)
 * шүүсээр үлдэнэ.
 */
export const FRESH_HOURS = 12;

/** "12 минутын өмнө", "4 цагийн өмнө", "6 хоногийн өмнө" */
export function ageText(iso: string, now: number): string {
  const h = ageHours(iso, now);
  if (h == null) return "Тодорхойгүй";
  if (h < 0) return "Дөнгөж сая";
  const m = Math.round(h * 60);
  if (m < 1) return "Дөнгөж сая";
  if (m < 60) return `${m} минутын өмнө`;
  if (h < 48) return `${Math.round(h)} цагийн өмнө`;
  return `${Math.round(h / 24)} хоногийн өмнө`;
}

/** Улаанбаатарын цагаар (UTC+8) "09-10 15:40" */
export function localTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Тодорхойгүй";
  const d = new Date(t + 8 * 3600000);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(
    d.getUTCMinutes(),
  )}`;
}

/** "2026-09-11" → "09-11" ба гаригийн нэр */
const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

export function dayLabel(date: string): { day: string; weekday: string } {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return { day: date, weekday: "" };
  const d = new Date(t);
  return {
    day: `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`,
    weekday: WEEKDAYS[d.getUTCDay()] ?? "",
  };
}

/* --------------------------------------------------------------------------
   САЛХИНЫ ЗҮГ

   Эх сайт нь товчлолоор харуулдаг (Ө, БӨ, Б, БХ). Платформ дээр товчлол
   гаргахгүй дүрэмтэй тул бүтэн нэрээр бичнэ. Найман зүг — 45 градусын
   муж тус бүрд нэг.
   -------------------------------------------------------------------------- */

const COMPASS = [
  "Хойд",
  "Зүүн хойд",
  "Зүүн",
  "Зүүн урд",
  "Урд",
  "Баруун урд",
  "Баруун",
  "Баруун хойд",
];

export function windName(deg: number | null): string {
  if (deg == null) return "Тодорхойгүй";
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return COMPASS[i];
}

/* --------------------------------------------------------------------------
   ХЭМЖИГДЭХҮҮН

   Газрын зураг ба жагсаалт НЭГ хэмжигдэхүүнд захирагдана. Тус бүр өөрийн
   нэгж, мужтай тул тэдгээрийг нэг дор эзэмшинэ — диаграм, зураг, жагсаалт
   гурав тусад нь тодорхойлбол хуваарь нь сална.
   -------------------------------------------------------------------------- */

export type MeasureId = "temp" | "humidity" | "wind" | "pressure" | "cloud";

export type Measure = {
  id: MeasureId;
  label: string;
  unit: string;
  /** Аравтын орон */
  digits: number;
  of: (o: Obs) => number | null;
  /**
   * Газрын зургийн өнгөний шатлал.
   *
   * ЭРЭМБЭТЭЙ хэмжүүр тул олон өнгө зөвшөөрөгдөнө (хөрсний PLI, ландфиллийн
   * эрсдэлийн зэрэгтэй ижил зарчим) — эдгээр нь ангилал БИШ, тасралтгүй
   * хуваарийн үе шатууд. Өнгө нь платформын дохионы гурвалаас:
   * `--water` хүйтэн → `--data` дунд → `--ochre` → `--clay` халуун.
   */
  stops: [number, string][];
};

const WATER = "#5fa8ff";
const DATA = "#67d7e4";
const OCHRE = "#e5b75a";
const CLAY = "#e47b7b";
const INK = "#8fa3b5";

export const MEASURES: Measure[] = [
  {
    id: "temp",
    label: "Агаарын температур",
    unit: "°C",
    digits: 1,
    of: (o) => o.temp,
    stops: [
      [-30, WATER],
      [-10, "#7fc4e0"],
      [0, DATA],
      [10, "#a8cf9a"],
      [20, OCHRE],
      [32, CLAY],
    ],
  },
  {
    id: "humidity",
    label: "Агаарын харьцангуй чийг",
    unit: "%",
    digits: 0,
    of: (o) => o.humidity,
    stops: [
      [0, OCHRE],
      [40, DATA],
      [100, WATER],
    ],
  },
  {
    id: "wind",
    label: "Салхины хурд",
    unit: "м/с",
    digits: 1,
    of: (o) => o.wind,
    stops: [
      [0, DATA],
      [8, OCHRE],
      [15, CLAY],
    ],
  },
  {
    id: "pressure",
    label: "Агаарын даралт",
    unit: "гПа",
    digits: 1,
    of: (o) => o.pressure,
    stops: [
      [760, WATER],
      [860, DATA],
      [960, OCHRE],
    ],
  },
  {
    id: "cloud",
    label: "Нийт үүлшил",
    unit: "балл",
    digits: 0,
    of: (o) => o.cloud,
    stops: [
      [0, DATA],
      [5, INK],
      [10, "#5d7285"],
    ],
  },
];

export function measureOf(id: MeasureId): Measure {
  return MEASURES.find((m) => m.id === id) ?? MEASURES[0];
}

/** Утгыг шатлалаас нь өнгө болгоно — жагсаалт ба зураг нэг эх сурвалжтай */
export function colorOf(m: Measure, v: number | null): string {
  if (v == null) return INK;
  const s = m.stops;
  if (v <= s[0][0]) return s[0][1];
  if (v >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 1; i < s.length; i++) {
    if (v <= s[i][0]) return v - s[i - 1][0] < s[i][0] - v ? s[i - 1][1] : s[i][1];
  }
  return s[s.length - 1][1];
}

/** Нийслэлийн станцууд эхэлж, дараа нь аймаг цагаан толгойн дарааллаар */
export const CAPITAL = "Нийслэл";
