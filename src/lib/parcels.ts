/**
 * НЭГЖ ТАЛБАР — кадастрын суурь давхарга (`Parcel_all`, портал).
 *
 * ⚠⚠ **524,052 ОЛОН ӨНЦӨГТ — БҮХЭЛД НЬ ТАТАХ БОЛОМЖГҮЙ.**
 * Порталын хуудасны дээд хэмжээ 2,000 тул бүтнээр татахад 262 хүсэлт,
 * хэдэн зуун мегабайт геометр болно — хөтөч зогсоно. Ойн хэсэглэл
 * (7,699 талбай) аль хэдийн секундээр хэмжигддэгийг бодоход энэ нь
 * далан дахин их.
 *
 * Тиймээс энэ давхарга нь бусад бүртгэлийн давхаргаас ӨӨР ЗАРЧМААР
 * ажиллана: `LayerSet`-д ОРОХГҮЙ, диаграм ч үүсгэхгүй — зөвхөн
 * ХАРАГДАХ ХҮРЭЭНИЙ дотор, зөвхөн ОЙРТСОН үед татагдах СУУРЬ
 * давхарга. Засаг захиргааны хил (`bnd`) -тэй нэг үүрэг: "энэ дүрс
 * хэний газар дээр байна" гэдгийг харуулна.
 *
 * ⚠ Диаграм гаргахгүй нь зориуд: хагас сая нэгж талбарын задаргааг
 * хөтөч дээр тоолох боломжгүй бөгөөд харагдах хүрээний дотоод
 * түүвэр дээр тоолсон тоо нь "нийслэлийн нэгж талбарын задаргаа"
 * гэж эндүүрэгдэнэ.
 */

import { arcgisJson } from "@/lib/arcgis";

const SERVICE =
  "https://environment.ub.gov.mn/hosting/rest/services/Hosted/Parcel_all/FeatureServer/0";

/**
 * ЭНЭ ХАРЬЦААНААС ОЙР үед л татна (1:12 000).
 *
 * ⚠ Хязгаарыг ойртолтоор БИШ ХАРЬЦААГААР тавьсан нь санаатай: зургийн
 * буланд гарах заалт мөн харьцаагаар бичигддэг тул хэрэглэгч хэдээс
 * эхлэн гарахыг тэндээс шууд уншина (шошгын хязгаартай нэг зарчим).
 * ⚠ Үүнээс хол байхад нэгж талбар нь зүгээр л саарал тор болж, доорх
 * дата давхаргыг дардаг — харуулах ч, татах ч утгагүй.
 *
 * ⚠⚠ **`fitBounds`-ийн ТАГЛААС ДООШ байх ЁСТОЙ.** Газрын зураг
 * хүрээ тааруулахдаа `maxZoom: 14`-ээр таглана. Хязгаарыг 1:12 000
 * (zoom 14.01) гэж тавихад товч дарж ойртуулсан зураг ЯГ 14.0 дээр
 * буудаг тул нөхцөл хэзээ ч хангагдахгүй, давхарга огт ачаалагддаггүй
 * байв (хэрэглэгч 2026-09-25: "parcel map дээр харагдахгүй байна").
 * 1:13 000 нь zoom 13.93 — таглаанаас доош тул баталгаатай.
 */
export const PARCEL_SCALE = 13_000;

/**
 * НЭГ ТАТАЦЫН ДЭЭД ХЭМЖЭЭ.
 *
 * Порталын хуудасны хязгаар 2,000. Түүнээс ИХИЙГ гуйхгүй: хоёр дахь
 * хуудас руу орвол нэг хөдөлгөөнд хэдэн хүсэлт явж, зураг чирэх бүрд
 * дараалал үүснэ. Хязгаарт хүрвэл ил хэлнэ ({@link ParcelTile.capped})
 * — дутуу зургийг бүтэн мэт харуулах нь худал.
 */
const PAGE = 2000;

/**
 * ХОЁР ХУУДАС = 4,000 дүрс.
 *
 * Нягтрал хэмжигдсэн (хотын төв): 1 км-т 167, 2 км-т 822, 4 км-т
 * 5,061. Zoom 14-ийн харагдац ~3.8 × 2.5 км тул хотын төвд ~3,000
 * дүрс ногдоно — нэг хуудас (2,000) ХҮРЭЛЦЭХГҮЙ бөгөөд тор нь
 * дундуураа тасарч санамсаргүй мэт харагдана.
 *
 * ⚠ Гуравт хүргэхгүй: 6,000 дүрс ~1.7 МБ болох бөгөөд чирэх бүрд
 * дахин татагдана. Хоёр нь хамрах хүрээ, жин хоёрын тэнцвэр.
 */
const CAP = 2 * PAGE;

export type ParcelTile = {
  data: GeoJSON.FeatureCollection;
  /** Хязгаарт хүрсэн эсэх — харагдаж буй нь бүгд БИШ */
  capped: boolean;
  /**
   * ХЭТ ОЛОН тул ОГТ татаагүй — давхцлын тоо нь `total`-д.
   *
   * ⚠ Хагас татсан торыг харуулахаас татахгүй нь ДЭЭР: дутуу тор нь
   * "эдгээр л давхцаж байна" гэсэн ХУДАЛ зураг гаргана.
   */
  tooMany?: boolean;
  /** Давхцлын БҮТЭН тоо (татсан эсэхээс үл хамаарна) */
  total?: number;
};

const EMPTY: ParcelTile = {
  data: { type: "FeatureCollection", features: [] },
  capped: false,
};

export const NO_PARCELS = EMPTY;

/**
 * Харагдах хүрээнд багтах нэгж талбаруудыг татна.
 *
 * @param bounds `[баруун, өмнөд, зүүн, хойд]` градусаар
 */
export async function fetchParcelsIn(
  bounds: [number, number, number, number],
  signal?: AbortSignal,
): Promise<ParcelTile> {
  const [w, s, e, n] = bounds;
  const url =
    `${SERVICE}/query?` +
    new URLSearchParams({
      /*
        ⚠ ЗӨВХӨН ДУГААР. Нэмэлт давхарга (`overlays`) нь ХАРИЛЦДАГГҮЙ
        — товшилт, hover дамждаггүй тул атрибут нь дэлгэц дээр гарах
        газаргүй. Хэмжсэн: дугаар ганцаараа 515 КБ, дээр нь эрхийн
        хэлбэр 567, бүх талбартай нь 830 КБ (2.2 × 2.2 км-ийн хүрээнд
        1,797 дүрс). Харагдахгүй 315 КБ татах шалтгаан алга.
        ⚠ Товшиж таних боломж нэмэх бол `overlays` биш `shapes`
        горим руу шилжүүлнэ — тэр нь `properties.oid`-оор харилцдаг.
      */
      outFields: "objectid",
      geometry: `${w},${s},${e},${n}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      /* Геометр нь UTM 48N-д хадгалагдсан ч 4326-аар гуйж байгаа тул
         ерөнхийлөлт нь ГРАДУСААР хэмжигдэнэ: 0.00002° ≈ 2 м. Нэгж
         талбарын ирмэг метрийн нарийвчлалтай тул түүнээс илүү нь
         зурагт ялгагдахгүй */
      maxAllowableOffset: "0.00002",
      geometryPrecision: "6",
      where: "1=1",
      f: "geojson",
    });

  const features: GeoJSON.Feature[] = [];
  /* Хуудсуудыг ДАРААЛУУЛЖ гуйна: эхнийх нь дүүрээгүй бол хоёр дахийг
     гуйх шаардлагагүй — ихэнх харагдацад нэг хуудас хүрэлцэнэ */
  for (let offset = 0; offset < CAP; offset += PAGE) {
    const json = await arcgisJson<{ features?: GeoJSON.Feature[] }>(
      `${url}&resultRecordCount=${PAGE}&resultOffset=${offset}`,
      "Нэгж талбар",
      { signal },
    );
    const page = json.features ?? [];
    features.push(...page);
    if (page.length < PAGE) break;
  }
  return {
    data: { type: "FeatureCollection", features },
    capped: features.length >= CAP,
  };
}

/**
 * ӨГӨГДСӨН ДҮРСТЭЙ ДАВХЦАХ нэгж талбарын ТОО.
 *
 * Сервер тоолно (`returnCountOnly`) — хагас сая дүрсийг хөтөч рүү
 * татахгүй. Экологийн коридорын давхцлын асуулгатай НЭГ загвар.
 *
 * ⚠ `POST`: бүсийн хүрээ URL-д багтахааргүй урт (тэжээгдлийн муж нь
 * 32 мянган га-гийн НЭГ олон өнцөгт).
 * ⚠ Хэмжсэн (2026-09-25): тэжээгдэл 17,724 · хязгаарлалт 11,487 ·
 * хориглолт 3,978 нэгж талбар, гурвуулаа 2.5 секунд.
 */
export async function countParcelsIn(
  rings: GeoJSON.Position[][],
  signal?: AbortSignal,
): Promise<number> {
  const shape = JSON.stringify({ rings, spatialReference: { wkid: 4326 } });
  /* ⚠ Тоолол нь ХЭМЖСЭНЭЭР 0.9–5.2 секунд (татамын 37 цагираг дээр) —
     давхарга унтрааж асаах, таб солих бүрд дахин асуух нь дэмий */
  return remember(countCache, shape, () => countOn(shape, signal));
}

async function countOn(shape: string, signal?: AbortSignal): Promise<number> {
  const body = new URLSearchParams({
    where: "1=1",
    geometry: shape,
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnCountOnly: "true",
    f: "json",
  });
  const json = await arcgisJson<{ count?: number }>(
    `${SERVICE}/query`,
    "Нэгж талбарын давхцал",
    { method: "POST", body, signal },
  );
  return json.count ?? 0;
}

/**
 * ДАВХЦАХ НЭГЖ ТАЛБАРЫН ЗАДАРГАА — сервер дээр бүлэглэж тоолно.
 *
 * "Татамд хэдэн газар орсон бэ" гэдэгт {@link countParcelsIn} хариулдаг
 * бол энэ нь "ТЭР ГАЗРУУД ЮУ ВЭ" гэдгийг хэлнэ: эрхийн хэлбэр (өмчлөх ·
 * эзэмших · ашиглах), газрын зориулалт. Экологийн коридорын самбарын
 * "давхцаж буй нэгж талбарын зориулалт"-тай НЭГ асуулт.
 *
 * ⚠⚠ ХӨТӨЧ РҮҮ НЭГ Ч ДҮРС ТАТАХГҮЙ: `groupByFieldsForStatistics` нь
 * бүлэг тутмын тоог л буцаана (хэдэн арван мөр). Давхцал 88 мянган
 * нэгж талбар байж болохыг бодоход энэ нь цорын ганц зам.
 * ⚠ ГЕОМЕТРИЙГ ХЯЛБАРЧЛАХГҮЙ: хялбарчлал нь ЗӨВХӨН дүрслэлийн татацад
 * ({@link simplifyRings}) — хил дээрх нэгж талбар орох, гарах нь тоог
 * гуйвуулна.
 * ⚠ `POST`: татамын цагираг URL-д багтахгүй.
 */
export type ParcelCut = {
  field: string;
  label: string;
  rows: { key: string; value: number }[];
};

/**
 * ЗАДАРГАА БОЛОХ ТАЛБАРУУД — бүртгэлээр, ТААМГААР БИШ.
 *
 * ⚠ Байгаа эсэхийг давхаргын ӨӨРИЙН тодорхойлолтоос шалгана
 * ({@link definition}) — байхгүй талбарыг гуйвал портал бүтэн
 * асуулгыг татгалзаж, карт чимээгүй хоосон үлдэнэ.
 * ⚠ Эрхийн хэлбэрийн талбар эх сурвалж дээр `rigth_type` гэж
 * бичигдсэн (үсэг нь сольсон); зөв бичиглэлийг нь ч хүлээж авна —
 * аль нэг нь л олдоно.
 */
const CUTS: readonly { field: string; label: string }[] = [
  { field: "rigth_type", label: "Эрхийн хэлбэр" },
  { field: "right_type", label: "Эрхийн хэлбэр" },
  { field: "landuse_de", label: "Газрын зориулалт" },
];

/** Скелет карт зурахад хэрэгтэй — татац ирэхээс өмнө ч нэр мэдэгдэнэ */
export const PARCEL_CUT_LABELS = ["Эрхийн хэлбэр", "Газрын зориулалт"];

/** Нэг ангилалд харуулах дээд мөр — урт жагсаалт картаа халина */
const CUT_TOP = 12;

let defP: Promise<{ oid: string; fields: Set<string> }> | null = null;

/** Давхаргын тодорхойлолт — НЭГ УДАА (талбарын нэр, дугаарын багана) */
function definition() {
  defP ??= arcgisJson<{
    objectIdField?: string;
    fields?: { name?: string }[];
  }>(`${SERVICE}?f=json`, "Нэгж талбарын тодорхойлолт")
    .then((j) => ({
      oid: j.objectIdField ?? "objectid",
      fields: new Set((j.fields ?? []).map((f) => f.name ?? "")),
    }))
    .catch((e: unknown) => {
      /* Унасан амлалтыг үлдээвэл алдаа МӨНХӨРНӨ */
      defP = null;
      throw e;
    });
  return defP;
}

export async function parcelCuts(
  rings: GeoJSON.Position[][],
  signal?: AbortSignal,
): Promise<ParcelCut[]> {
  const shape = JSON.stringify({ rings, spatialReference: { wkid: 4326 } });
  return remember(cutCache, shape, () => cutsOn(shape, signal));
}

async function cutsOn(
  shape: string,
  signal?: AbortSignal,
): Promise<ParcelCut[]> {
  const def = await definition();
  const want: { field: string; label: string }[] = [];
  for (const c of CUTS) {
    if (!def.fields.has(c.field)) continue;
    /* Нэг нэрийн хоёр бичиглэлээс ЭХНИЙХ нь л орно */
    if (want.some((w) => w.label === c.label)) continue;
    want.push(c);
  }
  const got = await Promise.all(
    want.map((c) =>
      groupOn(shape, c.field, def.oid, signal)
        /* Нэг задаргаа унавал нөгөөх нь ХЭВЭЭР — эдгээр нь нэмэлт
           мэдээлэл тул самбарыг унагаахгүй */
        .catch(() => []),
    ),
  );
  return want
    .map((c, i) => ({ ...c, rows: got[i] }))
    .filter((c) => c.rows.length > 0);
}

async function groupOn(
  shape: string,
  field: string,
  oid: string,
  signal?: AbortSignal,
): Promise<{ key: string; value: number }[]> {
  const body = new URLSearchParams({
    where: "1=1",
    geometry: shape,
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    groupByFieldsForStatistics: field,
    outStatistics: JSON.stringify([
      { statisticType: "count", onStatisticField: oid, outStatisticFieldName: "n" },
    ]),
    returnGeometry: "false",
    f: "json",
  });
  const json = await arcgisJson<{
    features?: { attributes?: Record<string, unknown> }[]
  }>(`${SERVICE}/query`, "Нэгж талбарын задаргаа", {
    method: "POST",
    body,
    signal,
  });
  const rows: { key: string; value: number }[] = [];
  for (const f of json.features ?? []) {
    const a = f.attributes ?? {};
    const raw = a[field];
    const value = Number(a.n);
    if (!Number.isFinite(value) || value <= 0) continue;
    rows.push({
      /* Хоосон нүд нь ангилал БИШ — платформын нэршлээр ил хэлнэ */
      key: typeof raw === "string" && raw.trim() ? raw.trim() : "Бүртгэгдээгүй",
      value,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, CUT_TOP);
}

/**
 * ӨГӨГДСӨН ДҮРСТЭЙ ДАВХЦАХ нэгж талбаруудыг ГЕОМЕТРТЭЙ нь татна.
 *
 * ⚠⚠ Харагдах хүрээний татацаас (`fetchParcelsIn`) ӨӨР ЗОРИЛГОТОЙ.
 * Тэр нь "энэ дүрс хэний газар дээр байна" гэдгийг ойртсон үед
 * харуулдаг СУУРЬ давхарга; энэ нь "хамгаалалтын бүсэд ХЭДЭН газар
 * орсон бэ" гэсэн ДАТА-гийн асуултад хариулна тул ойртолтоос ҮЛ
 * ХАМААРНА — бүсүүд хотыг бүхэлд нь хамардаг.
 *
 * ⚠ Хэмжсэн (2026-09-25): тэжээгдэл 17,724 · хязгаарлалт 11,487 ·
 * хориглолт 3,978 давхцалтай. Гурвуулаа ~33 мянга боловч бүсүүд
 * хоорондоо давхцдаг тул давхардалгүй тоо нь бага. Дугаараар
 * НЭГТГЭНЭ ({@link mergeParcels}).
 *
 * ⚠⚠ ТООГ НЬ ЭХЛЭЭД асууж, хуудсуудыг ЗЭРЭГ гуйна — порталын
 * давхаргын татацтай нэг загвар (`portal-layers`). Дараалуулбал
 * арван долоон хуудас нь ээлжлэн хүлээж хэдэн арван секунд болно.
 * ⚠ `CAP_ON` нь дээд хязгаар: түүнээс их бол ил хэлнэ (`capped`) —
 * дутуу торыг бүтэн мэт харуулах нь худал.
 */
const CAP_ON = 24 * PAGE;

/**
 * САНАХ ОЙН КЭШ — нэг хүрээг хоёр удаа асуухгүй.
 *
 * ⚠⚠ Яагаад: орон зайн асуулга нь ӨӨРӨӨ үнэтэй (хэмжсэн — геометр
 * огт буцаахгүй хуудас ч **0.37 секунд**; татац нь нэмэлт 0.1 л).
 * Тиймээс буцаж ирэх, урагш хойш чирэх үед дахин асуух нь шууд
 * хэдэн секунд алдана.
 * ⚠ Түлхүүр нь геометрийн БИЧВЭР: тайрсан цагираг ижил бол хариу ч
 * ижил. Хязгаарлагдмал урттай (`CACHE_MAX`) — хамгийн эртнийхийг
 * хаяна; нэгж талбарын дүрс санах ойд хуримтлах ёсгүй.
 * ⚠ Амлалтаар кэшлэнэ: зэрэг хоёр дуудалт нэг хүсэлт болно.
 */
const CACHE_MAX = 12;
const onCache = new Map<string, Promise<ParcelTile>>();
const countCache = new Map<string, Promise<number>>();
const cutCache = new Map<string, Promise<ParcelCut[]>>();

function remember<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  make: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = make().catch((e: unknown) => {
    /* Унасан амлалтыг кэшид үлдээвэл алдаа МӨНХӨРНӨ */
    cache.delete(key);
    throw e;
  });
  cache.set(key, p);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return p;
}

export async function fetchParcelsOn(
  rings: GeoJSON.Position[][],
  signal?: AbortSignal,
  /**
   * Үүнээс олон давхцал гарвал ОГТ ТАТАХГҮЙ — зөвхөн тоог нь буцаана
   * ({@link ParcelTile.tooMany}). Дуудагч тал "ойртоно уу" гэж хэлнэ.
   */
  limit = CAP_ON,
  /**
   * Хуудас ирэх бүрд ХУРИМТЛАГДСАН үр дүнг дуудагчид хэлнэ — 37
   * хуудсыг бүгдийг хүлээхгүйгээр эхнийхийг нь шууд зурахад.
   */
  onPartial?: (tile: ParcelTile) => void,
): Promise<ParcelTile> {
  if (!rings.length) return EMPTY;
  const shape = JSON.stringify({ rings, spatialReference: { wkid: 4326 } });
  /* ⚠ Кэшид ЗӨВХӨН бүтэн үр дүн сууна: кэш оновол хэсэгчилсэн
     мэдэгдэлгүйгээр шууд бүтнээрээ ирнэ.
     ⚠ Унасан, таслагдсан хүсэлт кэшид ҮЛДЭХГҮЙ ({@link remember}) */
  return remember(onCache, `${limit}:${shape}`, () =>
    fetchOn(shape, limit, signal, onPartial),
  );
}

async function fetchOn(
  shape: string,
  limit: number,
  signal?: AbortSignal,
  onPartial?: (tile: ParcelTile) => void,
): Promise<ParcelTile> {
  const base = () => {
    const b = new URLSearchParams({
      where: "1=1",
      geometry: shape,
      geometryType: "esriGeometryPolygon",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
    });
    return b;
  };

  /* Хэдэн хуудас болохыг эхлээд тодорхойлно */
  const head = base();
  head.set("returnCountOnly", "true");
  head.set("f", "json");
  const total =
    (
      await arcgisJson<{ count?: number }>(`${SERVICE}/query`, "Нэгж талбар", {
        method: "POST",
        body: head,
        signal,
      })
    ).count ?? 0;
  if (!total) return EMPTY;
  if (total > limit) return { ...EMPTY, tooMany: true, total };

  const want = Math.min(total, CAP_ON);
  const pages: Promise<GeoJSON.Feature[]>[] = [];
  for (let offset = 0; offset < want; offset += PAGE) {
    const body = base();
    body.set("outFields", "objectid");
    body.set("outSR", "4326");
    /* Градусаар ерөнхийлнө: 0.00002° ≈ 2 м — нэгж талбарын ирмэг
       түүнээс нарийн ч зурагт ялгагдахгүй */
    body.set("maxAllowableOffset", "0.00002");
    body.set("geometryPrecision", "6");
    body.set("resultRecordCount", String(PAGE));
    body.set("resultOffset", String(offset));
    body.set("f", "geojson");
    pages.push(
      arcgisJson<{ features?: GeoJSON.Feature[] }>(
        `${SERVICE}/query`,
        "Нэгж талбар",
        { method: "POST", body, signal },
      ).then((j) => j.features ?? []),
    );
  }
  /*
    ⚠⚠ ХУУДАС ИРЭХ БҮРД ШУУД ХЭЛНЭ (`onPartial`, 2026-10-02, хэрэглэгч:
    "уншилтыг хурдан болгоорой удаан байна шүү").

    Нийт хугацааг БОГИНОСГОХ боломжгүй — сервер 2,000 бичлэг бүрд
    ~0.3 секунд зарцуулдаг (хэмжсэн; геометр огт буцаахгүй хуудас ч
    0.37 с тул татац нь гол зардал БИШ, орон зайн асуулга нь мөн).
    Гэхдээ 37 хуудсыг БҮГДИЙГ хүлээлгэхийн оронд ирснийг нь шууд
    зурвал эхний нэгж талбар нэг секундын дотор гарна.
    ⚠ Дараалал нь хамаагүй: нэгж талбар бүр бие даасан дүрс.
  */
  let done: GeoJSON.Feature[] = [];
  if (onPartial)
    for (const p of pages)
      void p.then((fs) => {
        done = [...done, ...fs];
        if (!signal?.aborted)
          onPartial({
            data: { type: "FeatureCollection", features: done },
            capped: total > CAP_ON,
            total,
          });
      });
  const got = await Promise.all(pages);
  return {
    data: { type: "FeatureCollection", features: got.flat() },
    capped: total > CAP_ON,
    total,
  };
}

/** Хэд хэдэн бүсийн үр дүнг ДУГААРААР нь давхардалгүй нэгтгэнэ */
export function mergeParcels(tiles: readonly ParcelTile[]): ParcelTile {
  const seen = new Set<number>();
  const features: GeoJSON.Feature[] = [];
  let capped = false;
  for (const t of tiles) {
    capped = capped || t.capped;
    for (const f of t.data.features) {
      const id = Number(f.id ?? f.properties?.objectid);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      seen.add(id);
      features.push(f);
    }
  }
  return { data: { type: "FeatureCollection", features }, capped };
}

/**
 * АСУУЛГЫН ГЕОМЕТРИЙГ ХЯЛБАРЧИЛНА (Douglas–Peucker).
 *
 * ⚠⚠ Орон зайн асуулгын зардал нь асуулгын олон өнцөгтийн ОРОЙН
 * ТООНООС хамаарна. Хэмжсэн (татамын тайрсан 5 цагираг, 2,000
 * бичлэгийн хуудас):
 *
 *   11,395 орой (хялбарчлаагүй) → 0.51 с
 *    6,648 (11 м)               → 0.36 с
 *    4,030 (56 м)               → 0.31 с
 *      707 (223 м)              → 0.21 с
 *
 * ⚠ Хүлцэл нь ДЭЛГЭЦИЙН ПИКСЕЛЭЭР тавигдана (~1.5 px): тэр нь
 * харагдах масштабт үл мэдэгдэх алдаа бөгөөд ойртох тусам өөрөө
 * нарийсна. Хил дээрх хэдэн нэгж талбар орох/гарах нь болзошгүй —
 * ТООЛОЛД хэрэглэхгүй, зөвхөн ДҮРСЛЭЛИЙН татацад.
 * ⚠ Гурваас цөөн оройтой үлдвэл цагирагийг хаяна.
 */
export function simplifyRings(
  rings: GeoJSON.Position[][],
  tol: number,
): GeoJSON.Position[][] {
  if (tol <= 0) return rings;
  const far = (
    p: GeoJSON.Position,
    a: GeoJSON.Position,
    b: GeoJSON.Position,
  ) => {
    const [x, y] = p;
    let [ax, ay] = a;
    const [bx, by] = b;
    let dx = bx - ax;
    let dy = by - ay;
    if (dx || dy) {
      const t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        ax = bx;
        ay = by;
      } else if (t > 0) {
        ax += dx * t;
        ay += dy * t;
      }
    }
    dx = x - ax;
    dy = y - ay;
    return dx * dx + dy * dy;
  };
  const out: GeoJSON.Position[][] = [];
  for (const ring of rings) {
    if (ring.length < 5) {
      out.push(ring);
      continue;
    }
    const keep = new Array<boolean>(ring.length).fill(false);
    keep[0] = true;
    keep[ring.length - 1] = true;
    const stack: [number, number][] = [[0, ring.length - 1]];
    while (stack.length) {
      const [i, j] = stack.pop()!;
      let best = -1;
      let at = -1;
      for (let k = i + 1; k < j; k += 1) {
        const d = far(ring[k], ring[i], ring[j]);
        if (d > best) {
          best = d;
          at = k;
        }
      }
      if (best > tol * tol && at > 0) {
        keep[at] = true;
        stack.push([i, at], [at, j]);
      }
    }
    const kept = ring.filter((_, i) => keep[i]);
    if (kept.length >= 4) out.push(kept);
  }
  return out;
}

/**
 * ЦАГИРГИЙГ ХАРАГДАХ ХҮРЭЭГЭЭР ТАЙРНА (Sutherland–Hodgman).
 *
 * ⚠⚠ Яагаад: Туулын татамтай **87,947** нэгж талбар давхцдаг
 * (2026-10-02-нд токеноор хэмжсэн) — бүгдийг татвал хэдэн арван
 * мегабайт болж, хотын төв бүхэлдээ улаан тор болно. Харагдах
 * хүрээгээр тайрснаар сервер зөвхөн дэлгэц дээрхийг буцаана.
 *
 * ⚠ Тайралт нь СЕРВЕРИЙН ажлыг хөнгөлнө, дүрслэлийг өөрчлөхгүй:
 * хүрээнээс гадуурх нэгж талбар ямар ч байсан харагдахгүй.
 * ⚠ Тэгш өнцөгт нь ГҮДГЭР тул Sutherland–Hodgman ЯГ зөв: дөрвөн
 * ирмэг тус бүрээр дараалан тайрна.
 * ⚠ Цагираг бүрийг ТУСАД НЬ тайрна — нүх нь ч мөн тайрагдана.
 */
export function clipRings(
  rings: GeoJSON.Position[][],
  box: [number, number, number, number],
): GeoJSON.Position[][] {
  const [w, s, e, n] = box;
  /* Ирмэг бүр: цэг дотор талд үлдэх эсэх, огтлолцлын цэг */
  const edges: [
    (p: GeoJSON.Position) => boolean,
    (a: GeoJSON.Position, b: GeoJSON.Position) => GeoJSON.Position,
  ][] = [
    [
      (p) => p[0] >= w,
      (a, b) => [w, a[1] + ((b[1] - a[1]) * (w - a[0])) / (b[0] - a[0])],
    ],
    [
      (p) => p[0] <= e,
      (a, b) => [e, a[1] + ((b[1] - a[1]) * (e - a[0])) / (b[0] - a[0])],
    ],
    [
      (p) => p[1] >= s,
      (a, b) => [a[0] + ((b[0] - a[0]) * (s - a[1])) / (b[1] - a[1]), s],
    ],
    [
      (p) => p[1] <= n,
      (a, b) => [a[0] + ((b[0] - a[0]) * (n - a[1])) / (b[1] - a[1]), n],
    ],
  ];
  const out: GeoJSON.Position[][] = [];
  for (const ring of rings) {
    let poly = ring;
    for (const [inside, cross] of edges) {
      const next: GeoJSON.Position[] = [];
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const ina = inside(a);
        const inb = inside(b);
        if (ina) next.push(a);
        if (ina !== inb) next.push(cross(a, b));
      }
      poly = next;
      if (!poly.length) break;
    }
    /* Гурван цэгээс цөөн нь талбайгүй — хаяна */
    if (poly.length >= 3) out.push([...poly, poly[0]]);
  }
  return out;
}

/** Олон дүрсийн цагиргуудыг НЭГ асуулгад нийлүүлнэ */
export function ringsOf(features: GeoJSON.Feature[]): GeoJSON.Position[][] {
  const out: GeoJSON.Position[][] = [];
  for (const f of features) {
    const g = f.geometry;
    if (g?.type === "Polygon") out.push(...g.coordinates);
    else if (g?.type === "MultiPolygon")
      for (const poly of g.coordinates) out.push(...poly);
  }
  return out;
}
