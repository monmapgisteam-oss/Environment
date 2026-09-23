/**
 * Цаг агаарын ажиглалтын АРХИВ.
 *
 * Эх сурвалжийн нээлттэй API нь ЗӨВХӨН сүүлийн заалтыг буцаадаг —
 * өдөр, сар, жилийн цуваа авах зам огт байхгүй ({@link ./weather}).
 * Тиймээс архивыг байгууллага ӨӨРӨӨ хуримтлуулдаг: ArcGIS Notebook
 * цаг тутам ажиллаж заалтыг `Tsag_agaar_arhiv` давхарга руу нэмнэ
 * (`scripts/log-weather.ipynb`, давхаргын бүтэц `scripts/weather-layer.json`).
 *
 * Энэ модуль тэр давхаргыг уншина. Самбарын "Бодит цагийн ажиглалт"
 * таб нь мэдрэгчийн ОДООГИЙН төлөвийг, "Архив" таб нь ТҮҮХИЙГ хэлнэ —
 * хоёр өөр асуулт тул хоёр өөр харагдац.
 *
 * ⚠ **ХООСОН АРХИВ нь АЛДАА БИШ.** Хуримтлал 2026-09-11-нээс эхэлсэн
 * бөгөөд notebook нь өөр порталд ажилладаг тул хэсэг хугацаанд зогсох
 * боломжтой. Хоосон үед самбар `.hatch` блокоор "Мэдээлэл хүлээгдэж
 * байна" гэж хэлнэ — алдааны дэлгэц ГАРГАХГҮЙ.
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";

export const ARCHIVE_SERVICE = `${HOSTING}/Hosted/Tsag_agaar_arhiv/FeatureServer`;

/**
 * Татах ЦОНХ, хоногоор.
 *
 * Архив цаг тутам долоон станцын заалт нэмдэг тул хоногт ~168 бичлэг.
 * Гуч хоног нь ~5,000 мөр — хөтөчид хөнгөн бөгөөд хоногийн, долоо
 * хоногийн хэв маягийг хоёуланг нь харуулахад хангалттай. Цонхыг
 * өргөтгөвөл хуудас нээгдэх хугацаа шууд уртсана.
 *
 * ⚠ Харагдац дээр энэ цонхыг ИЛ хэлнэ — "архив бүхэлдээ" гэж
 * эндүүрүүлэх ёсгүй. Архивын жинхэнэ эхлэл, нийт бичлэгийн тоо нь
 * тусдаа нэг статистик хүсэлтээр ирнэ ({@link ArchiveData.total}).
 */
export const WINDOW_DAYS = 30;

export type ArchiveRow = {
  sid: number;
  name: string;
  place: string;
  /** Ажиглалтын мөч, epoch миллисекунд */
  t: number;
  temp: number | null;
  feels: number | null;
  humidity: number | null;
  pressure: number | null;
  cloud: number | null;
  wind: number | null;
  windDir: number | null;
  precip: number | null;
  snowDepth: number | null;
};

export type ArchiveStation = {
  sid: number;
  name: string;
  place: string;
  /** Цонхонд оногдох бичлэгийн тоо */
  n: number;
  /** Байршил — бичилт бүрд давтагддаг тул эхний олдсоноор нь */
  lat: number | null;
  lon: number | null;
};

export type ArchiveData = {
  /** Хугацаагаар ӨСӨХ дарааллаар — диаграм шууд зурна */
  rows: ArchiveRow[];
  stations: ArchiveStation[];
  /** Татсан мөч */
  fetched: number;
  /** Архив БҮХЭЛДЭЭ: нийт бичлэг ба эхний, сүүлийн ажиглалт */
  total: { n: number; from: number | null; to: number | null };
};

/* --------------------------------------------------------------------------
   ТАТАЦ
   -------------------------------------------------------------------------- */

type Attrs = Record<string, unknown>;

/**
 * Тоон утга — `null` ялгаж уншина.
 *
 * ⚠ `Number(null)` нь **0**, `Number("")` нь мөн **0** бөгөөд
 * `Number.isFinite(0)` нь `true` тул энгийн шалгалт бөглөгдөөгүй нүдийг
 * нэвтрүүлнэ. Архивт бөглөгдөөгүй талбар элбэг (цасны зузаан зунд,
 * температурын их/бага тодорхой цагт л) тул тэднийг тэг гэж уншвал
 * диаграм дээр худал хэвтээ шугам үүснэ.
 */
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** ArcGIS огноог epoch миллисекунд болгоно — тоо ч, ISO бичвэр ч ирнэ */
function millis(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === "string" && v) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * SQL-92 огнооны утга, UTC-гаар.
 *
 * ArcGIS нь `TIMESTAMP 'YYYY-MM-DD HH:MM:SS'` хэлбэрийг бүх эх
 * сурвалж дээр дэмждэг. Орон нутгийн цагаар бичвэл сервер UTC гэж
 * уншиж, цонх найман цагаар гулсана.
 */
function sqlTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

/**
 * Давхаргын ДУГААР — үйлчилгээний тодорхойлолтоос уншина.
 *
 * ⚠ **0 гэж ТААМАГЛАХГҮЙ.** Энэ порталд үйлчилгээнүүд нэг төслөөс
 * дараалан нийтлэгддэг тул давхаргын дугаар 20, 22, 30 ч байж болно
 * (хүрээлэн буй орчин, үнэлгээний давхаргуудыг үз). Буруу дугаар нь
 * алдаа ЗААХГҮЙ, зүгээр л хоосон буцаана.
 */
async function layerId(signal?: AbortSignal): Promise<number> {
  const json = await arcgisJson<{ layers?: { id: number }[] }>(
    `${ARCHIVE_SERVICE}?f=json`,
    "Цаг агаарын архив",
    signal ? { signal } : undefined,
  );
  const id = json.layers?.[0]?.id;
  if (id == null) throw new Error("Цаг агаарын архивын давхарга бүртгэгдээгүй байна");
  return id;
}

/*
  ⚠ `lat`, `lon` нь СТАНЦЫН тогтмол шинж — мөр бүрд давтагддаг ч
  татахаас өөр арга алга (архивын давхарга нь геометргүй, зөвхөн
  атрибут). Мөрд хадгалахгүй: зөвхөн станцын бүртгэлд нэг удаа сууна.
*/
const FIELDS = [
  "sid",
  "name",
  "place",
  "lat",
  "lon",
  "obs_date",
  "ttt",
  "ttt_feels",
  "ff",
  "pst",
  "nh",
  "wind_speed",
  "wind_dir",
  "precip",
  "snow_depth",
].join(",");

/**
 * Архив БҮХЭЛДЭЭ — нийт бичлэг ба хугацааны муж, нэг хүсэлтээр.
 *
 * ⚠ Энэ нь ЧИМЭГЛЭЛ: үзүүлэлтийн зурваст "архив хэзээнээс хойш,
 * нийт хэдэн заалттай" гэдгийг хэлнэ. Статистикийн асуулгыг зарим
 * тохиргоо дэмждэггүй тул унавал САМБАРЫГ УНАГААХГҮЙ — тэгээр
 * буцаана.
 */
async function overall(layer: number) {
  const url =
    `${ARCHIVE_SERVICE}/${layer}/query?` +
    new URLSearchParams({
      where: "1=1",
      outStatistics: JSON.stringify([
        { statisticType: "count", onStatisticField: "sid", outStatisticFieldName: "n" },
        { statisticType: "min", onStatisticField: "obs_date", outStatisticFieldName: "t0" },
        { statisticType: "max", onStatisticField: "obs_date", outStatisticFieldName: "t1" },
      ]),
      returnGeometry: "false",
      f: "json",
    });

  try {
    const json = await arcgisJson<{ features?: { attributes: Attrs }[] }>(
      url,
      "Цаг агаарын архивын нэгтгэл",
    );
    const a = json.features?.[0]?.attributes ?? {};
    return { n: num(a.n) ?? 0, from: millis(a.t0), to: millis(a.t1) };
  } catch {
    return { n: 0, from: null, to: null };
  }
}

const PAGE = 2000;

/** Нэг хуудас — `resultOffset`-оор дараалан */
async function page(layer: number, where: string, order: string, offset: number) {
  const url =
    `${ARCHIVE_SERVICE}/${layer}/query?` +
    new URLSearchParams({
      where,
      outFields: FIELDS,
      /* Архив нь цэгэн давхарга боловч станцын байршил нь ажиглалт
         тутамд давтагддаг ТОГТМОЛ — геометр татах нь хэрэггүй жин.
         Энэ харагдацад газрын зураг байхгүй. */
      returnGeometry: "false",
      orderByFields: `obs_date ${order}`,
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: "json",
    });

  const json = await arcgisJson<{ features?: { attributes: Attrs }[] }>(
    url,
    "Цаг агаарын архив",
  );
  return json.features ?? [];
}

/** Хуудсуудыг дүүрэн ирсээр байх хүртэл — дээд хязгаартай */
async function pageAll(layer: number, where: string, order: string, cap: number) {
  const out: { attributes: Attrs }[] = [];
  for (let offset = 0; offset < cap; offset += PAGE) {
    const got = await page(layer, where, order, offset);
    out.push(...got);
    if (got.length < PAGE) break;
  }
  return out;
}

/**
 * Цонхны мөрүүд — ХОЁР ЗАМТАЙ.
 *
 * Гол зам нь огнооны шүүлт (`TIMESTAMP '…'`): хэрэгтэй мөрийг л
 * сервер талд тасалдаг тул хамгийн хөнгөн.
 *
 * ⚠ Гэвч SQL-ийн огнооны бичиглэлийг эх сурвалж бүр ижил хүлээж
 * авдаггүй. Татгалзвал ХООСОН ХАРУУЛАХЫН ОРОНД сүүлийн мөрүүдийг
 * буурах дарааллаар татна — цонх нь бага зэрэг өөр гарч болох ч
 * харагдац АЖИЛЛАСААР үлдэнэ. Таслагдсан хүсэлтийг нөхөхгүй.
 */
async function windowRows(layer: number, since: number) {
  try {
    return await pageAll(layer, `obs_date >= TIMESTAMP '${sqlTime(since)}'`, "ASC", 20_000);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return pageAll(layer, "1=1", "DESC", 6000);
  }
}

/* Санах ойн кэш — архив нь ТҮҮХ, товшилт бүрд дахин татах шаардлагагүй.
   Бодит цагийн таб харин кэшгүй: тэр нь "одоо" гэдгийг хэлэх учиртай. */
let cache: Promise<ArchiveData> | null = null;

export function fetchArchive(signal?: AbortSignal): Promise<ArchiveData> {
  cache ??= load().catch((e: unknown) => {
    cache = null;
    throw e;
  });
  /* Дуудагч салсан ч татац үргэлжилж кэшид сууна — таб хооронд
     хурдан сэлгэнэ. Зөвхөн ЭНЭ дуудлага таслагдана. */
  const started = cache;
  return signal
    ? new Promise<ArchiveData>((resolve, reject) => {
        const stop = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal.aborted) return stop();
        signal.addEventListener("abort", stop, { once: true });
        started
          .then(resolve, reject)
          .finally(() => signal.removeEventListener("abort", stop));
      })
    : started;
}

async function load(): Promise<ArchiveData> {
  const layer = await layerId();
  const since = Date.now() - WINDOW_DAYS * 86_400_000;
  const [total, feats] = await Promise.all([overall(layer), windowRows(layer, since)]);

  const rows: ArchiveRow[] = [];
  const byStation = new Map<number, ArchiveStation>();

  for (const f of feats) {
    const a = f.attributes;
    const t = millis(a.obs_date);
    const sid = num(a.sid);
    if (t == null || sid == null) continue;

    const name = str(a.name) || `Станц ${sid}`;
    const place = str(a.place);
    rows.push({
      sid,
      name,
      place,
      t,
      temp: num(a.ttt),
      feels: num(a.ttt_feels),
      humidity: num(a.ff),
      pressure: num(a.pst),
      cloud: num(a.nh),
      wind: num(a.wind_speed),
      windDir: num(a.wind_dir),
      precip: num(a.precip),
      snowDepth: num(a.snow_depth),
    });

    const hit = byStation.get(sid);
    if (hit) {
      hit.n += 1;
      /* Эхний бичилтэд координат байхгүй байж болно */
      hit.lat ??= num(a.lat);
      hit.lon ??= num(a.lon);
    } else {
      byStation.set(sid, {
        sid,
        name,
        place,
        n: 1,
        lat: num(a.lat),
        lon: num(a.lon),
      });
    }
  }

  rows.sort((a, b) => a.t - b.t);

  return {
    rows,
    stations: [...byStation.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "mn")),
    fetched: Date.now(),
    total,
  };
}
