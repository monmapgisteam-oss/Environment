/**
 * Порталын давхаргын НЭГДСЭН ХӨДӨЛГҮҮР.
 *
 * `environment.ub.gov.mn` порталд хостлогдсон feature service бүр ижил
 * зан төлөвтэй: токен шаардана, бүтцээ өөрөө хэлдэг, талбарын нэр нь
 * жижиг үсэгтэй. Тиймээс хэлтэс бүрд кодыг хуулахын оронд ГАНЦ
 * хөдөлгүүр бичиж, хэлтэс нь зөвхөн БҮРТГЭЛЭЭ (`LayerSet`) өгнө.
 *
 * ⚠ **БҮГД ТОКЕН ШААРДАНА.** Давхаргууд `organization` түвшинд
 * хуваалцагдсан тул нэвтрээгүй хөтөч юу ч татахгүй. Токеныг
 * `lib/arcgis.ts` өөрөө хавсаргана — энд тусгай зүйл хийх шаардлагагүй.
 *
 * ⚠ **ТАЛБАРЫГ УРЬДЧИЛЖ ТААМАГЛААГҮЙ.** Давхаргын бүтцийг эх
 * сурвалжаас ӨӨРӨӨС нь уншина (`fetchLayerInfo`): нэр, геометрийн
 * төрөл, бичлэгийн тоо, талбарын жагсаалт бүгд үйлчилгээний өөрийн
 * тодорхойлолтоос ирнэ. Ингэснээр нэр, талбар нь өөрчлөгдвөл самбар
 * дагаж өөрчлөгдөнө; таамагласан талбарын нэр хэзээ ч кодод үлдэхгүй.
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";

/** ~10 метрийн ерөнхийлөлт (градусаар) */
const OFFSET = 0.0001;

/** Нэг удаад татах дээд бичлэг */
const PAGE = 2000;

/**
 * Давхаргын бүртгэл.
 *
 * `id` нь үйлчилгээний нэр — хадгалалтын түлхүүр, дүрслэлийн дугаар
 * хоёуланд нь хэрэглэгдэнэ. Харагдах НЭР энд БИЧИГДЭЭГҮЙ: түүнийг
 * үйлчилгээ өөрөө хэлдэг тул ажиллах үед уншина.
 *
 * Эхний хоёр (`O01_…`) нь нэг сэдвийн хоёр тал (талбай ба хилийн цэг),
 * үлдсэн зургаа (`O03_…`) нь өөр сэдэв — угтварыг эх сурвалж өгсөн
 * бөгөөд утгыг нь тайлбарлаагүй тул БҮЛЭГЛЭХГҮЙ, дарааллыг нь л
 * хадгална.
 */
/**
 * Нэг хэлтсийн ДАВХАРГЫН БҮРТГЭЛ.
 *
 * Хэлтэс бүр өөрийн жагсаалт, нэр, өнгө, хасалтын дүрмээ энд өгнө —
 * бусад бүх зүйл (татац, задаргаа, диаграм, шүүлт) хуваалцагдана.
 */
export type LayerSet = {
  /** Хадгалалтын түлхүүрийн орон зай (`localStorage`, `Columns`) */
  key: string;
  /**
   * Шүүлтүүрийн мөрөнд гарах гарчиг.
   *
   * ⚠ Урьд нь энэ нь "Ойн давхарга" гэж КОДОД БИЧИГДСЭН байсан тул
   * самбарыг амьтан, ногоон бүсийн хэлтэс хуваалцмагц тэдгээр дээр
   * ч "Ойн давхарга" гэж гарч байв. Хэлтэс бүр өөрийнхөө нэрийг өгнө.
   */
  title?: string;
  /** Үйлчилгээний нэрс — жагсаалтын ДАРААЛАЛ нь өнгөний дараалал мөн */
  layers: readonly string[];
  /**
   * ПОРТАЛААС ГАДУУРХ давхаргын БҮТЭН хаяг — `id` → `FeatureServer`.
   *
   * Давхаргууд ихэвчлэн `environment.ub.gov.mn`-ий `Hosted` доор
   * сууна ({@link layerService}) ч бүгд биш: Survey123-ийн маягтууд
   * ArcGIS Online дээр үүсдэг бөгөөд тэндээс нь зөөх боломжгүй
   * тохиолдол бий.
   *
   * ⚠⚠ **ТОКЕН ХӨНДЛӨН ГАРАХГҮЙ.** Сессийн токен нь зөвхөн
   * `environment.ub.gov.mn`-д хүчинтэй ({@link SECURED_HOSTS}) —
   * ArcGIS Online бол ӨӨР систем, өөр байгууллага. Тиймээс энд
   * бичигдэх үйлчилгээ нь **нээлттэй хуваалцагдсан байх ЁСТОЙ**;
   * үгүй бол давхарга 499 буцааж, самбар алдааг нь мөрөндөө ил
   * харуулна (чимээгүй тэг БИШ — `arcgisJson` барина).
   */
  services?: Record<string, string>;
  /**
   * ХАРАГДАХ НЭР.
   *
   * Үйлчилгээ өөрийгөө `O01_THGN_polygon` гэж нэрлэдэг — энэ нь
   * серверийн нэр бөгөөд хэрэглэгчид юу ч хэлэхгүй. Самбар дээр латин
   * товчлол гаргах нь платформын "товчлол задална" дүрмийг ч зөрчинө.
   *
   * ⚠ Эдгээр нь ОРЧУУЛГА биш, үйлчилгээний нэрийн задаргаа. Утгыг нь
   * эх сурвалж тайлбарлаагүй тул нэрнээс нь ЦААШ таамаглахгүй.
   *
   * Энд бичигдсэн нэр нь эх сурвалжийн хуудсанд (`lib/sources.ts`) мөн
   * хэрэглэгддэг — хоёр газар тусад нь бичвэл эрт орой зөрнө.
   */
  names: Record<string, string>;
  /**
   * Өнгөний ӨНЦГҮҮД — давхарга бүрд нэг.
   *
   * Хэлтсийн `--d-*` өнгөний эргэн тойронд сонгоно: давхаргууд нэг
   * зураг дээр нийлдэг тул тэднийг ялгах ёстой ч хэлтсийнхээ өнгөний
   * гэр бүлээс салах ёсгүй.
   */
  hues: number[];
  /**
   * Давхаргуудыг НЭЭХЭД НЬ шууд асаах эсэх.
   *
   * Олон давхаргатай нийлмэл бүрдэл ХООСОН эхэлнэ — юуг нь харахыг
   * хэрэглэгч сонгоно. Харин сэдэв тус бүрд зориулсан цонх дээр
   * сонгох зүйл байхгүй: тэнд байгаа бүх давхарга тэр сэдвийнх тул
   * хоосон зураг гаргаад гараар асаалгах нь утгагүй.
   *
   * ⚠ Энэ нь давхаргын ТООНООС гардаггүй — БҮРТГЭЛИЙН шийдвэр.
   * "Нэг давхаргатай бол асаа" гэсэн дүрэм нь хоёр, гурван давхаргатай
   * сэдвийн цонхыг (усны хамгаалалтын гурван бүс гэх мэт) хоосон
   * үлдээж байв.
   */
  openAll?: boolean;
  /**
   * Газрын зургийн ШОШГО нээхэд нь шууд асах эсэх.
   *
   * Ойн хэлтэс дээр шошго АНХНААСАА унтраалттай: тэнд найман давхарга
   * нэг зурагт нийлдэг бөгөөд олон хэсэгтэй дүрс (100 метрийн зурвас)
   * хэсэг болгондоо шошго авдаг тул алсаас зураг бүхэлдээ бичвэрээр
   * дүүрдэг.
   *
   * Сэдэв тус бүрд зориулсан цонх дээр тэр эрсдэл БАГА: нэг, хоёр
   * давхарга л байдаг бөгөөд шошго нь "энэ юу вэ" гэдэгт шууд
   * хариулна. Тиймээс энэ нь давхаргын тооноос биш БҮРТГЭЛИЙН
   * шийдвэр.
   */
  labels?: boolean;
  /**
   * ХЭМЖИЛТЭД ОРОХГҮЙ талбар — нэрээр нь.
   *
   * Хэлтсийн шийдвэр (жишээ нь дам гаргасан утга) тул датаны шинж
   * БИШ: утга нь эх сурвалжид, бичлэгийн дэлгэрэнгүйд хэвээр байна.
   */
  skipMeasure?: RegExp;
  /**
   * ХЭМЖИЛТЭД ОРОХГҮЙ нэгж — талбарын БҮТЭН НЭР дээр шалгагдана.
   *
   * Бичиглэл нь жигд бус ("м³ нийт", "м3 2023", "куб.м") тул задалсан
   * нэгж дээр тааруулах гэвэл шинэ бичиглэл гарах бүрд диаграм
   * чимээгүй эргэж ирнэ.
   */
  skipUnit?: RegExp;
};

/** Давхаргын харагдах нэр — бүртгэлд байхгүй бол үйлчилгээнийхээр */
export function layerName(
  set: LayerSet,
  id: string,
  fallback?: string,
): string {
  return set.names[id] ?? fallback?.trim() ?? id;
}

export function layerService(id: string): string {
  return `${HOSTING}/Hosted/${id}/FeatureServer`;
}

/**
 * Бүрдэл дэх давхаргын хаяг.
 *
 * Бүртгэлд бүтэн хаяг бичигдсэн бол түүнийг, үгүй бол порталын
 * жишгээр угсарсныг буцаана — дуудагч тал давхарга хаана байгааг
 * мэдэх шаардлагагүй.
 */
export function serviceOf(set: LayerSet, id: string): string {
  return set.services?.[id] ?? layerService(id);
}

/** Эх сурвалжийн талбарын тодорхойлолт */
export type LayerField = {
  name: string;
  /** Хүнд харагдах нэр. Эх сурвалж өгөөгүй бол техникийн нэр */
  alias: string;
  /** `esriFieldType…`-гүй богино төрөл: `String`, `Double`, `Date` … */
  type: string;
};

export type LayerInfo = {
  id: string;
  /** Аль хэлтсийн бүртгэлээс ирсэн — хасалтын дүрмүүд эндээс */
  set: LayerSet;
  /** Давхаргын өөрийн нэр — үйлчилгээний тодорхойлолтоос */
  name: string;
  /** `Polygon` · `Polyline` · `Point` */
  geometry: string;
  /** Давхаргын дугаар (ихэвчлэн 0, гэхдээ заавал биш) */
  layerId: number;
  /**
   * Дугаарын талбарын нэр.
   *
   * ⚠ **`OBJECTID` ГЭЖ ТААМАГЛАЖ БОЛОХГҮЙ.** Энэ порталын давхаргууд
   * жижиг үсгээр (`objectid`) нэрлэгдсэн бөгөөд сервер нь үсгийн
   * тэмдэглэгээнд МЭДРЭГ: буруу нэр өгөхөд 500 буцаана
   * ("Field name 'OBJECTID' does not exist. Did you mean 'objectid'?").
   * Давхарга өөрөө `objectIdField`-ээ зарладаг тул түүнийг уншина.
   */
  objectIdField: string;
  /** Талбайн талбарын нэр (`Shape__Area` эсвэл жижиг үсгээр) — байхгүй ч байж болно */
  areaField: string | null;
  count: number;
  /**
   * Нэг хуудсанд татах бичлэг — серверийн `maxRecordCount` ба бидний
   * дээд хязгаарын бага нь.
   *
   * ⚠ Серверийн хязгаарыг ХЭТРҮҮЛЖ асуувал сервер хязгаараараа буцаах
   * бөгөөд "хуудас дүүрээгүй = сүүлчийнх" гэсэн дүрэм тэр даруй
   * ТАСАЛНА: 2000 гуйгаад 1000 ирэхэд давхарга дутуу татагдаж, хэн ч
   * анзаарахгүй. Тиймээс хуудасны хэмжээ давхаргаас өөрөөс нь гарна.
   */
  pageSize: number;
  fields: LayerField[];
};

/**
 * Дүрслэлд хэрэггүй талбарууд.
 *
 * `OBJECTID` нь дугаар, `GlobalID` нь санамсаргүй тэмдэгт, `Shape__*`
 * нь геометрээс дам гарах утга — эдгээрийг ангилал болгон харуулах нь
 * утгагүй. `Shape__Area`-г харин ТАЛБАЙН эх сурвалж болгон тусад нь
 * хэрэглэнэ.
 */
const SKIP_FIELDS = /^(OBJECTID|FID|GlobalID|Shape_?_?(Area|Length))$/i;

/**
 * Esri-ийн ЗАСВАРЛАГЧ МӨРДӨХ талбарууд.
 *
 * Survey123-ийн маягт болон хостлогдсон давхарга бүрд автоматаар
 * нэмэгддэг: хэн, хэзээ бичсэнийг заана — судалгааны сэдвийн тухай
 * ЮУ Ч ХЭЛЭХГҮЙ. Хасахгүй бол `Creator` нь "mobile_worker2" гэсэн
 * утгуудаар диаграм болж, `CreationDate` нь маягтын өөрийн
 * `Бүртгэсэн огноо`-г давхардуулж хугацааны хоёр цуваа гаргана.
 */
const EDITOR_FIELDS =
  /^(Creator|Editor|CreationDate|EditDate|created_(user|date)|last_edited_(user|date))$/i;

/** KML-ээс хөрвүүлсэн давхаргын үлдэц талбарууд — утга агуулдаггүй */
const KML_NOISE =
  /^(SymbolID|AltMode|Base|Clamped|Extruded|Snippet|PopupInfo)$/i;

type ServiceMeta = {
  layers?: { id: number; name: string; geometryType?: string }[];
};

type LayerMeta = {
  id: number;
  name: string;
  geometryType?: string;
  objectIdField?: string;
  fields?: { name: string; alias?: string; type: string }[];
  /** Сервер нэг хүсэлтэд буцаах дээд бичлэг — хуудасны хэмжээ үүнээс */
  maxRecordCount?: number;
};

/**
 * Давхаргын тодорхойлолтыг уншина.
 *
 * ХОЁР хүсэлт: үйлчилгээний үндэс (давхаргын жагсаалт) ба эхний
 * давхаргын дэлгэрэнгүй. Бичлэгийн тоог гурав дахь хүсэлтээр авна —
 * `count` нь тодорхойлолтод байдаггүй.
 */
async function loadLayerInfo(
  set: LayerSet,
  id: string,
  signal?: AbortSignal,
): Promise<LayerInfo> {
  const service = serviceOf(set, id);

  const svc = await arcgisJson<ServiceMeta>(`${service}?f=json`, id, {
    signal,
  });
  const first = svc.layers?.[0];
  if (!first) throw new Error(`${id}: давхарга байхгүй байна`);

  /*
    Давхаргын дэлгэрэнгүй ба бичлэгийн тоог ЗЭРЭГ асууна — хоёулаа зөвхөн
    `first.id`-ээс хамаардаг. Урьд нь дараалан явдаг байсан нь давхарга
    бүрд нэг илүү сүлжээний эргэлт нэмдэг байв.

    Бичлэгийн тоог АЛГАСЧ болно: тоолол нь тав тухын үзүүлэлт бөгөөд
    хостинг сервер зарим давхарга дээр тооллын асуулгад 500 буцаадаг
    тул түүнийг шаардлагатай гэж үзвэл ажиллагаатай давхарга ч
    нээгдэхгүй болно. Тоо мэдэгдвэл хуудсуудыг ЗЭРЭГ татах боломж
    нээгдэнэ ({@link fetchLayerFeatures}).
  */
  const [meta, count] = await Promise.all([
    arcgisJson<LayerMeta>(`${service}/${first.id}?f=json`, id, { signal }),
    arcgisJson<{ count?: number }>(
      `${service}/${first.id}/query?` +
        new URLSearchParams({ where: "1=1", returnCountOnly: "true", f: "json" }),
      id,
      { signal },
    ).then(
      (r) => Number(r.count) || 0,
      (e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        return 0;
      },
    ),
  ]);

  const all = meta.fields ?? [];

  const fields: LayerField[] = all
    .filter(
      (f) =>
        !SKIP_FIELDS.test(f.name) &&
        !KML_NOISE.test(f.name) &&
        !EDITOR_FIELDS.test(f.name),
    )
    .map((f) => ({
      name: f.name,
      alias: (f.alias ?? "").trim() || f.name,
      type: f.type.replace("esriFieldType", ""),
    }));

  /* Дугаарын талбар — давхарга зарлаагүй бол талбарын жагсаалтаас олно */
  const oidField =
    meta.objectIdField?.trim() ||
    all.find((f) => f.type === "esriFieldTypeOID")?.name ||
    all.find((f) => /^objectid$/i.test(f.name))?.name ||
    "objectid";

  const areaField =
    all.find((f) => /^shape_+area$/i.test(f.name))?.name ?? null;

  return {
    id,
    set,
    /* Үйлчилгээний өөрийн нэр нь техникийн (`O01_THGN_polygon`) тул
       харагдах нэрийг бүртгэлээс авна */
    name: layerName(set, id, meta.name ?? first.name),
    geometry: String(meta.geometryType ?? first.geometryType ?? "").replace(
      "esriGeometry",
      "",
    ),
    layerId: first.id,
    objectIdField: oidField,
    areaField,
    count,
    pageSize: Math.max(1, Math.min(PAGE, Number(meta.maxRecordCount) || PAGE)),
    fields,
  };
}

export type LayerFeatures = {
  id: string;
  /** Газрын зурагт — `feature.id` нь `OBJECTID` */
  shapes: GeoJSON.FeatureCollection;
  /** Бичлэг бүрийн атрибут, `OBJECTID`-аар индексжсэн */
  rows: Record<number, Record<string, unknown>>;
  /** Геометрээс гарсан талбай, м² (олон өнцөгт давхаргад) */
  area: Record<number, number>;
};

/**
 * Давхаргын бичлэгүүдийг ХОЁР ҮЕ ШАТТАЙ татна.
 *
 * ⚠⚠ **АТРИБУТ ЭХЛЭЭД, ГЕОМЕТР АРД НЬ** (2026-09-17, хэмжилтээс).
 * Хүнд талбайн давхарга дээр (ойн хэсэглэл, 7,699 талбай) хуудас
 * бүр 1.5 секунд — саад нь серверийн геометр ЕРӨНХИЙЛӨЛТ (CPU), хуудсыг
 * зэрэг гуйхад ч буурдаггүй. Харин ГЕОМЕТРГҮЙ асуулга нь тэр хуудсыг
 * 76 мс-д буцаана. Диаграм, жагсаалт, шошго, талбай бүгд атрибутаас
 * гардаг тул тэднийг эхлээд татаж самбарыг 0.1 секундэд амьд болгоод,
 * геометрийг ард нь зураг руу урсгана — хэрэглэгч "мэдээ татаж байна"
 * гэж хүлээхийн оронд шууд ажиллаж эхэлнэ.
 *
 * Геометрийн асуулга ЗӨВХӨН дугаарын талбарыг авна — атрибутыг хоёр
 * дахин татахгүй.
 *
 * Хуудсуудыг ЗЭРЭГ гуйна (тоо мэдэгдвэл): цэгэн давхаргад 7.5 дахин,
 * хөнгөн талбайд 4.6 дахин хурдан (хэмжсэн). Тоо хуучирсан бол дүүрэн
 * хуудасны араас дараалан үргэлжлүүлнэ.
 */
type Raw = {
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
};

async function pagesOf(
  info: LayerInfo,
  params: Record<string, string>,
): Promise<Raw[]> {
  const service = serviceOf(info.set, info.id);
  const size = info.pageSize;
  const page = (offset: number) =>
    arcgisJson<{ features?: Raw[] }>(
      `${service}/${info.layerId}/query?` +
        new URLSearchParams({
          where: "1=1",
          outSR: "4326",
          resultOffset: String(offset),
          resultRecordCount: String(size),
          orderByFields: info.objectIdField,
          f: "geojson",
          ...params,
        }),
      info.name,
    ).then((j) => j.features ?? []);

  const known = info.count > 0 ? Math.ceil(info.count / size) : 1;
  const pages = await Promise.all(
    Array.from({ length: known }, (_, i) => page(i * size)),
  );
  let last = pages[pages.length - 1] ?? [];
  for (let offset = known * size; last.length >= size; offset += size) {
    last = await page(offset);
    pages.push(last);
  }
  return pages.flat();
}

type LayerRows = Pick<LayerFeatures, "rows" | "area">;

async function loadLayerRows(info: LayerInfo): Promise<LayerRows> {
  const oid = info.objectIdField;
  /* Дүрслэлд хэрэглэгдэх талбар + талбайн эх сурвалж. Нэрийг бүгдийг
     давхарга ӨӨРӨӨ зарласнаас авна — үсгийн тэмдэглэгээ ч түүнийх */
  const out = [
    oid,
    ...info.fields.map((f) => f.name),
    ...(info.areaField ? [info.areaField] : []),
  ];
  const rows: Record<number, Record<string, unknown>> = {};
  const area: Record<number, number> = {};
  for (const f of await pagesOf(info, {
    outFields: out.join(","),
    returnGeometry: "false",
  })) {
    const p = f.properties ?? {};
    const uid = Number(p[oid]);
    if (!Number.isFinite(uid)) continue;
    rows[uid] = p;
    if (info.areaField) {
      const a = Number(p[info.areaField]);
      if (Number.isFinite(a)) area[uid] = a;
    }
  }
  return { rows, area };
}

async function loadLayerShapes(info: LayerInfo): Promise<GeoJSON.Feature[]> {
  const oid = info.objectIdField;
  const shapes: GeoJSON.Feature[] = [];
  for (const f of await pagesOf(info, {
    outFields: oid,
    maxAllowableOffset: String(OFFSET),
    geometryPrecision: "5",
  })) {
    const uid = Number(f.properties?.[oid]);
    if (!Number.isFinite(uid) || !f.geometry) continue;
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` шаардлагатай */
      id: uid,
      properties: { oid: uid },
      geometry: f.geometry,
    });
  }
  return shapes;
}

/** Диаграмын төрөл — юуг хэмжиж байгаа нь */
export type ChartKind =
  /** Ангилал бүрийн БИЧЛЭГИЙН тоо */
  | "count"
  /** Ангилал бүрийн тоон талбарын НИЙЛБЭР (талбай, хэмжээ) */
  | "sum"
  /** Ангилал бүрийн ДУНДАЖ (хувь — нийлбэр нь утгагүй) */
  | "mean"
  /** Нэг нэгжтэй хэд хэдэн хэмжилтийн ХАРЬЦУУЛАЛТ */
  | "compare"
  /** Огнооны талбарын ЖИЛИЙН цуваа */
  | "year"
  /** Огнооны талбарын САРЫН хуваарилалт */
  | "month";

type Datum = { key: string; label: string; value: number };
type Group = { key: string; label: string; total: number; rows: Datum[] };

/** Нэг бичлэгийн атрибутууд */
export type Row = Record<string, unknown>;

/** Шүүсэн мөрүүд дээр дахин тоолсон үр дүн */
export type Counted = { values: Datum[]; groups?: Group[] };

/** Нэг талбарын утгын задаргаа */
export type Breakdown = {
  /**
   * Диаграмын өөрийн түлхүүр.
   *
   * Нэг талбар хэд хэдэн диаграм төрүүлдэг (ангиллын тоо, тэр ангиллаар
   * хэмжсэн талбай …) тул `field` нь дангаараа давхардана.
   */
  id: string;
  /** Бүлэглэх талбар — цаг хугацааны диаграмд огнооны талбар өөрөө */
  field: string;
  /** Бүлэглэх талбарын нэр */
  label: string;
  kind: ChartKind;
  /**
   * Хэмжигдэхүүний нэр — ангиллаас ӨӨР талбар хэмжигдэж байвал.
   *
   * Тоолол дээр хоосон: "хэдэн бичлэг" гэдэг нь талбарын нэр
   * шаарддаггүй.
   */
  measure?: string;
  /**
   * Нэг бичлэг ОЛОН ангилалд харьяалагдаж болох эсэх.
   *
   * ⚠ Ийм задаргааны нийлбэр нь бичлэгийн тооноос ИХ гарна (нэг талбай
   * хоёр дүүрэгт хамаарвал хоёуланд нь тоологдоно) бөгөөд тэр нь алдаа
   * биш. Гэхдээ газрын зургийн өнгө үүнээс ГАРАХГҮЙ: нэг дүрс хоёр
   * өнгөтэй байж чадахгүй тул аль нэгийг нь чимээгүй сонгох болно.
   */
  multi?: boolean;
  /**
   * Диаграмд ҮЛДСЭН мөрийн тоо — бүхнийг харуулаагүй үед.
   *
   * Нэрээр задлахад мөр нь бичлэгийн тоотой тэнцэнэ (хэдэн зуу байж
   * болно) тул хамгийн их утгатайг нь л үлдээнэ. Хураасан гэдгээ
   * гарчигтаа хэлэх ЁСТОЙ: дутуу жагсаалтыг бүтэн мэт харуулбал
   * диаграм өөрөө худал хэлнэ.
   */
  top?: number;
  /** Мөрүүд — `compare`-аас бусад бүх төрөлд */
  values: Datum[];
  /** `compare`: ангилал бүрийн доор хэмжилтүүд эгнэнэ */
  groups?: Group[];
  /**
   * Бичлэг аль ангилалд харьяалагдах вэ.
   *
   * ШҮҮЛТ ба ДАХИН ТООЛОЛТ хоёулаа эндээс гарна: диаграм дээр товшсон
   * утга нь энэ функцийн буцаасан түлхүүртэй тааралдвал тэр бичлэг
   * үлдэнэ. Хоёр тусдаа дүрэм бичвэл диаграм дээр харагдах ангилал ба
   * шүүлтэд ордог ангилал эрт орой зөрнө (олон утгатай нүд, бүлэглэсэн
   * он зэрэгт ялангуяа).
   */
  keyOf: (row: Row) => string[];
  /**
   * Шүүсэн мөрүүдээр утгуудыг дахин тоолно.
   *
   * Диаграмын БҮТЭЦ (ямар талбар, ямар төрөл, ямар дараалал) шүүлтээс
   * ҮЛ ХАМААРНА — зөвхөн тоонууд өөрчлөгдөнө. Эс тэгвээс шүүлт тавих
   * бүрд диаграмууд өөрсдөө гарч, алга болж, самбар нь тогтворгүй
   * болно.
   */
  recount: (rows: Row[]) => Counted;
};

/**
 * Ямар талбар ЗАДАРГАА болох вэ.
 *
 * Эх сурвалж аль талбар нь ангилал болохыг хэлдэггүй тул бодит утгаас
 * нь шийднэ: хоёроос хорин таван өөр утгатай бичвэр талбар л задаргаа
 * болно. Нэг утгатай бол задаргаа биш ТОГТМОЛ; хэт олон утгатай бол
 * (нэр, дугаар, тайлбар) диаграм биш жагсаалт болно.
 *
 * Хязгаарыг датанд тааруулж өөрчилж болно — эдгээр нь эх сурвалжийн
 * дүрэм биш, уншигдацын шийдвэр.
 */
const MIN_VALUES = 2;
const MAX_VALUES = 25;

/**
 * Хэмжилтээс төрөх ДИАГРАМЫН дээд тоо.
 *
 * Талбар бүр ангиллаараа үржиж диаграм төрүүлдэг тул хязгааргүй бол
 * баруун багана уншиж баршгүй урсгал болно.
 *
 * ⚠ Хязгаар нь ТАЛБАРЫГ биш ДИАГРАМЫГ тоолно. Урьд нь талбараар
 * тоолдог байсан тул "га 2023, га 2024, ₮ 2023" гэсэн гурав дөрвөн
 * суудлыг эзэлж, "₮ 2024" нь огт уншигдахгүй үлдэж байв — улмаас
 * төлбөрийн харьцуулалт ганц оных мэт харагдана. Ижил нэгжтэй
 * хэдэн ч он нэг харьцуулалт болж нийлдэг тул нэг л суудал эзэлнэ.
 */
const MAX_MEASURES = 4;

/**
 * Уншиж үзэх тоон талбарын дээд тоо.
 *
 * Диаграмын хязгаараас ӨНДӨР байх ёстой: жил тутмын багана бүхий
 * давхаргад дөрвөн диаграм гаргахад арваад талбар шаардагдана.
 */
const MAX_MEASURE_FIELDS = 12;

/** Цаг хугацааны талбарын дээд тоо */
const MAX_DATES = 2;

/**
 * Ангиллын диаграмын дээд тоо.
 *
 * Давхарга арваад бичвэр талбартай байж болох ч тэдгээрийн ихэнх нь
 * нэг зүйлийг өөр өнцгөөс хэлдэг. Оноогоор эрэмбэлээд шилдгийг нь л
 * үлдээнэ — бүгдийг нь дэлгэвэл баруун багана уншиж баршгүй урсгал
 * болж, ГОЛ задаргаа нь тэдний дунд алдагдана.
 */
const MAX_CATEGORIES = 4;

/**
 * Нэрээр задалсан диаграмын дээд мөр.
 *
 * Бичлэг бүр өөрийн мөртэй болох тул хязгааргүй бол хэдэн зуун мөрт
 * жагсаалт болно. Хамгийн их утгатай нь шийдвэрт хэрэгтэй хэсэг.
 */
const TOP_ROWS = 20;

/** Жагсаалт агуулсан гэж үзэх утгын хувь */
const LIST_SHARE = 0.2;

/** Нэр гэж хүлээн зөвшөөрөх доод оноо */
const NAME_MIN = 0.4;

/**
 * САРЫН хуваарилалт гаргах доод нөхцөл.
 *
 * Тогтоол, шийдвэрийн огноо нь улирлын утга АГУУЛДАГГҮЙ: гурван
 * бичлэгийн сарыг диаграм болгох нь хэв маяг байхгүй газар хэв маяг
 * харуулсан хэрэг болно.
 */
const MONTH_MIN_ROWS = 12;
const MONTH_MIN_SPREAD = 3;

/** Тоон талбарын төрлүүд */
const NUMERIC = /^(Double|Single|Integer|SmallInteger|BigInteger)$/;

/**
 * ТЭМДЭГЛЭЛ болох бичвэрийн урт.
 *
 * Өгүүлбэр нь ангилал биш: диаграмын шошго болгоход мөр бүр таслагдаж,
 * зурвасууд нь юу ч хэлэхгүй болно. "Байгалийн цогцолбор газар" (25
 * тэмдэгт) бол ангилал, "Нийслэлийн нутаг дэвсгэрийн хилийг тогтоох"
 * (42) бол тэмдэглэл — хязгаарыг тэр хоёрын дунд тавив.
 */
const NOTE_LENGTH = 34;

/**
 * Олон утгыг тусгаарлагч.
 *
 * Эх сурвалж нэг нүдэнд хэд хэдэн утга бичдэг ("Баянзүрх, Налайх
 * дүүрэг"; "БЗД 20-р хороо; НД 01-р хороо") — задлахгүй бол хослол
 * бүр өөрөө ангилал болж, диаграм нь нэг мөрийн урттай зурвасуудын
 * жагсаалт болно.
 */
const SEPARATOR = /\s*[;,]\s*/;

/**
 * ТАНИГЧ болохын хязгаар.
 *
 * Бичлэгийн энэ хувиас олон өөр утгатай талбар нь ангилал биш: нэр,
 * код, дугаар зэрэг бичлэг тус бүрийг ялгах зориулалттай утга.
 */
const UNIQUE_SHARE = 0.8;

/**
 * Хувиар шүүх боломжтой болох бичлэгийн доод тоо.
 *
 * Цөөн бичлэгтэй давхарга дээр хувь нь тогтворгүй (таван бичлэгийн
 * дөрөв нь өөр утгатай байх нь хэвийн) тул тэнд зөвхөн БҮРЭН
 * давхардалгүй талбарыг л танигч гэж үзнэ.
 */
const SMALL = 12;

/**
 * Түүхий утгыг АНГИЛЛЫН ТҮЛХҮҮР болгоно.
 *
 * Задаргаа ба газрын зургийн өнгө ХОЁУЛАА үүнийг дуудна — тусад нь
 * нормчилбол зай, том/жижиг үсгийн ялгаанаас болж диаграмд байгаа
 * ангилал зурагт өнгөгүй үлдэнэ.
 *
 * Хоосон утга тусдаа ангилал болно: "бөглөгдөөгүй" нь өөрөө мэдээлэл.
 */
export function categoryKey(raw: unknown): string {
  const v = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return v || "Бүртгэгдээгүй";
}

/** Тоон утга — уншигдахгүй бол `null` (тэг БИШ) */
function numberOf(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Огноог уншина.
 *
 * ArcGIS нь GeoJSON хэлбэрт огноог хоёр янзаар буцаадаг: миллисекунд
 * (тоо) эсвэл ISO бичвэр. Аль нь ирэхийг урьдчилан мэдэх боломжгүй тул
 * хоёуланг нь хүлээж авна.
 *
 * ⚠ Тэг нь **1970 оны эхэн** гэсэн үг бөгөөд ойн бүртгэлд ийм огноо
 * байх боломжгүй — бөглөөгүй талбарыг тэгээр тэмдэглэсэн байдаг тул
 * хаяна. Эс тэгвээс цуваа 1970 оноос эхэлж бодит жилүүд нэг багана
 * болж хавчуулагдана.
 */
function dateOf(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  const ms = typeof raw === "number" ? raw : Date.parse(String(raw));
  if (!Number.isFinite(ms) || ms === 0) return null;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  return y > 1900 && y < 2200 ? d : null;
}

/**
 * Дугаарын талбарыг ХЭМЖИГДЭХҮҮН гэж үзэхгүй.
 *
 * "Д/Д" гэх мэт дараалсан дугаарыг нэмэх нь утгагүй тоо төрүүлнэ.
 * Нэрээр нь таах боломжгүй (эх сурвалж бүр өөрөөр нэрлэдэг) тул
 * УТГААС нь шийднэ: бүх утга бүхэл бөгөөд давхардалгүй бол энэ нь
 * хэмжилт биш дугаарлалт.
 */
/**
 * КООРДИНАТЫН талбар.
 *
 * ⚠⚠ Эх сурвалж өргөрөг, уртрагаа ГЕОМЕТРЭЭС ГАДНА тусдаа багананд
 * давхар бичдэг (`өргөрөг__y_`, `lat`, `c_lon` …). Эдгээр нь тоо
 * боловч ХЭМЖИГДЭХҮҮН БИШ: нэмэхэд "Өргөрөг — 5,764" гэсэн утгагүй
 * тоо гарч, диаграмын суудлыг бодит хэмжилтээс булааж байв
 * (хэрэглэгч 2026-09-16-нд мөөгний самбар дээр "LAT — BUS",
 * "LON — PHOTO" гэсэн диаграм гарахыг анзаарсан).
 *
 * Утгын мужаар нь таних нь БОЛОМЖГҮЙ: өргөрөг нь 47–49 бөгөөд бодит
 * хэмжилт (өндөршил, температур, хувь) мөн тэр мужид байж болно.
 * Тиймээс НЭРЭЭР нь таана — координатын багана нэрээ үргэлж хэлдэг.
 */
const COORD_FIELD =
  /(^|[_\s])(lat|lon|lng|latitude|longitude|x|y|өргөрөг|уртраг|координат)([_\s]|$)/i;

function looksLikeId(values: number[]): boolean {
  if (values.length < 3) return false;
  if (!values.every((v) => Number.isInteger(v))) return false;
  if (new Set(values).size !== values.length) return false;

  /*
    ⚠ Давхардалгүй бүхэл тоо гэдэг нь ХАНГАЛТГҮЙ шалгуур: төлбөрийн
    орлого, талбайн хэмжээ ч бичлэг бүрд өөр бүхэл утгатай байж
    болно. Дугаарлалтын жинхэнэ шинж нь НЯГТ байдал — 1, 2, 3 … гэж
    дараалдаг тул хамгийн бага, хамгийн их хоёрын хооронд бичлэгийн
    тооноос илүү зай үлдэхгүй.

    Энэ шалгуургүй үед "Төлбөрийн орлого 2024" зэрэг жинхэнэ хэмжилт
    дугаар гэж андуурагдан диаграмаас алга болж байв.
  */
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo >= 0 && hi - lo < values.length * 1.5;
}

/**
 * Хэмжилтийн НЭГЖ ба нэр.
 *
 * Эх сурвалж нэгжээ талбарынхаа нэрэнд, таслалын ард бичдэг ("Талбай
 * тогтоолоор, га"). Үүнийг салгаснаар ижил нэгжтэй хэмжилтүүд
 * олдоно — тэдгээр нь ХАРЬЦУУЛАГДАХ утгууд болох нь ойлгогдоно.
 *
 * Таслалгүй нэр нь нэгжгүй: таамаглахгүй, дангаар нь харуулна.
 */
/**
 * Товчилсон нэгжийг ЗАДЛАНА.
 *
 * Платформын дүрэм: дэлгэц дээр товчлол гаргахгүй ("мян.₮" → "мянган
 * төгрөг"). Цорын ганц үл хамаарах зүйл нь хэмжих нэгжийн олон улсын
 * тэмдэглэгээ (га, м², м³, мг/кг) — тэдгээр нь товчлол биш тэмдэг тул
 * энд хөндөгдөхгүй.
 *
 * ⚠ Энэ нь мянга, сая хоёрыг ялгах ГАНЦ зам: эх сурвалж утгыг нь
 * мянгаар нь хадгалж, зөвхөн нэрэндээ "мян." гэж тэмдэглэсэн байдаг
 * тул түүнийг товчилсон хэвээр үлдээвэл 7,520 гэдэг нь долоон мянга
 * уу, долоон сая уу гэдэг нь тодорхойгүй болно.
 *
 * ⚠⚠ Тоог нь ХӨРВҮҮЛЭХГҮЙ (нөхөн сэргээлтийн төсөвтэй ижил зарчим) —
 * эх сурвалжийн бичсэн хэмжээгээр нь харуулж, нэгжийг нь бүтнээр
 * хэлнэ.
 */
const UNIT_WORDS: [RegExp, string][] = [
  [/^тэрбум[\s.]*(₮|төг|төгрөг)$/i, "тэрбум төгрөг"],
  [/^сая[\s.]*(₮|төг|төгрөг)$/i, "сая төгрөг"],
  [/^(мян|мянга|мянган)[\s.]*(₮|төг|төгрөг)$/i, "мянган төгрөг"],
  [/^(₮|төг)$/i, "төгрөг"],
];

function spellUnit(unit: string): string {
  for (const [re, word] of UNIT_WORDS) if (re.test(unit)) return word;
  return unit;
}

function unitOf(alias: string): { unit: string; name: string } {
  const at = alias.lastIndexOf(",");
  if (at < 0) return { unit: "", name: alias };

  let unit = alias.slice(at + 1).trim();
  let name = alias.slice(0, at).trim();
  /* Таслалын ард өгүүлбэр байвал нэгж биш — нэгж нь богино тэмдэглэгээ */
  if (!unit || unit.length > 14 || !name) return { unit: "", name: alias };

  /*
    ⚠ ОН нь нэгжийн ХЭСЭГ БИШ.

    Эх сурвалж нэг хэмжигдэхүүнийг жил бүрд нэг багана болгож
    ("Төлбөрийн орлого, мян.₮ 2023", "… 2024") бичдэг. Оныг нэгжид
    үлдээвэл "мян.₮ 2023" ба "мян.₮ 2024" гэсэн ХОЁР өөр нэгж болж,
    хоёр жил хоорондоо харьцуулагдахаа болино — яг тэр учраас
    төлбөрийн хоёр он тусдаа диаграм болж байв.

    Оныг НЭР рүү шилжүүлснээр хоёулаа "мян.₮" болж, нэг
    харьцуулалтад нийлнэ.
  */
  const year = /^(.*?)\s*((?:19|20)\d{2})$/.exec(unit);
  if (year) {
    unit = year[1].trim();
    name = `${name} ${year[2]}`.trim();
    if (!unit) return { unit: "", name: alias };
  }

  /*
    ⚠ ХААЛТАН ДОТОРХ ТОДОТГОЛ нь нэгжийн хэсэг БИШ.

    Эх сурвалж нэг хэмжигдэхүүнийг улирлаар нь хоёр багана болгож
    бичдэг: "Давс, кг (хавар)", "Давс, кг (намар)". Тодотголыг
    нэгжид үлдээвэл "кг (хавар)" ба "кг (намар)" гэсэн ХОЁР өөр нэгж
    болж, хоёр улирал хоорондоо харьцуулагдахаа болино — оны дүрэмтэй
    яг ижил алдаа.

    Хаалт нь нэгжийн тэмдэглэгээнд хэзээ ч ордоггүй тул энэ дүрэм нь
    жинхэнэ нэгжийг тайрах эрсдэлгүй. Доорх "нийт" төрлийн дүрмээс
    ӨМНӨ ажиллана: "боодол (хавар)" гэх мэт танил бус нэгж дээр тэр
    дүрэм таардаггүй.
  */
  const paren = /^(.*?)\s*(\([^()]*\))$/.exec(unit);
  if (paren && paren[1].trim()) {
    unit = paren[1].trim();
    name = `${name} ${paren[2]}`.trim();
  }

  /*
    ⚠ Нэгжийн АРД ТОДОТГОЛ залгаастай байж болно: "Бэлтгэсэн мод,
    м³ нийт". Тэр үгийг нэгжид үлдээвэл "м³" ба "м³ нийт" нь хоёр өөр
    нэгж болж, нэг зүйлийн хэмжилтүүд харьцуулагдахаа болино — мөн
    нэгжээр нь шүүх дүрэм ажиллахгүй (`SKIP_UNIT`).

    Эхний ҮГ нь нэгжийн тэмдэг агуулсан эсвэл танил нэгж байвал л
    салгана: "мянган төгрөг" гэх мэт хоёр үгтэй бодит нэгжийг
    тайрахгүй.
  */
  const tail = /^(\S+)\s+(.+)$/.exec(unit);
  if (tail && /[³²%₮]|^(га|км|кг|тн|ш|м|м2|м3|км2)$/i.test(tail[1])) {
    unit = tail[1];
    name = `${name} ${tail[2]}`.trim();
  }

  return { unit: spellUnit(unit), name };
}

/**
 * Хэмжилтүүдийн НИЙТЛЭГ угтварыг хасна.
 *
 * Нэг харьцуулалтад орсон цуваанууд ихэвчлэн ижил үгээр эхэлдэг
 * ("Төлбөрийн орлого 2023", "Төлбөрийн орлого 2024") — давтагдсан
 * хэсэг нь нарийн мөрөнд зай эзлэхээс өөр юу ч хэлэхгүй. Ялгаа нь л
 * үлдэнэ: "2023", "2024".
 *
 * Аль нэг нэр бүхэлдээ угтвар байвал ОРХИНО — хоосон шошго нь
 * давтагдсанаас дор.
 */
function trimShared(names: string[]): string[] {
  if (names.length < 2) return names;

  const words = names.map((n) => n.split(/\s+/));
  let common = 0;
  while (
    common < words[0].length - 1 &&
    words.every((w) => w.length > common + 1 && w[common] === words[0][common])
  ) {
    common += 1;
  }
  if (!common) return names;

  const cut = words.map((w) => w.slice(common).join(" "));
  return cut.every(Boolean) ? cut : names;
}

/**
 * Задалсны дараа ТАСАРСАН утгыг бүтнээр нь сэргээнэ.
 *
 * Эх сурвалж жагсаалтын ЗӨВХӨН СҮҮЛИЙН гишүүнд нийтлэг үгийг бичдэг:
 * "Баянзүрх, Налайх дүүрэг" нь задлахад "Баянзүрх" ба "Налайх дүүрэг"
 * болж, нэг дүүрэг хоёр ангилал болно. Хэсэг нь өөр хэсгийн ҮГИЙН
 * ЭХЛЭЛ байвал уртыг нь авна.
 *
 * ⚠ Хоёр ба түүнээс олон утга руу заавал бол ОРХИНО — "Баян" нь
 * "Баянгол" ба "Баянзүрх" хоёрын аль нь болох нь тодорхойгүй.
 */
function foldPrefixes(parts: Set<string>): Map<string, string> {
  const all = [...parts];
  const fold = new Map<string, string>();

  for (const short of all) {
    const hits = all.filter(
      (long) => long !== short && long.startsWith(`${short} `),
    );
    if (hits.length === 1) fold.set(short, hits[0]);
  }
  return fold;
}

/**
 * Хоёр талбар ЯГ ИЖИЛ задалж байна уу.
 *
 * Эх сурвалж нэг зүйлийг хоёр багананд бичсэн байх нь элбэг (код ба
 * нэр, товчлол ба бүтэн нэр). Утга нь өөр ч ЗАДАРГАА нь ижил байвал
 * хоёр дахь диаграм нь эхнийхийн хуулбар болно — зөвхөн шошго нь
 * өөр, өндөр нь яг адилхан зурвасууд.
 *
 * Утгын нэрийг БИШ, бичлэгийн ХУВААРИЛАЛТЫГ харьцуулна: нэг талбарын
 * утга нөгөөгийнхөө яг нэг утгад тохирч байвал ижил.
 *
 * Олон утгатай талбарыг харьцуулахгүй — тэнд нэг бичлэг хэд хэдэн
 * ангилалд орох тул "нэгээс нэг" гэсэн ойлголт алга.
 */
function samePartition(a: Candidate, b: Candidate): boolean {
  if (a.multi || b.multi) return false;
  if (a.values.length !== b.values.length) return false;

  const pair = new Map<string, string>();
  for (let i = 0; i < a.keys.length; i++) {
    const ka = a.keys[i][0];
    const kb = b.keys[i][0];
    const seen = pair.get(ka);
    if (seen === undefined) pair.set(ka, kb);
    else if (seen !== kb) return false;
  }
  return true;
}

/** Ангилал болох нэр дэвшигч */
type Candidate = {
  field: LayerField;
  /** Бичлэг бүрийн харьяалагдах ангиллууд */
  keys: string[][];
  /** Дурын бичлэгээс ангиллыг нь гаргана — шүүлтэд хэрэглэгдэнэ */
  keyOf: (row: Row) => string[];
  multi: boolean;
  values: Datum[];
  score: number;
};

/**
 * Ангилал хэр САЙН задалж байгааг оноолно.
 *
 * Талбарын ДАРААЛЛААР нь эхнийхийг сонгох нь эх сурвалжийн бичилтийн
 * дарааллыг утга гэж үзэж байгаа хэрэг: ойн давхаргууд дээр эхний
 * бичвэр талбар нь ихэвчлэн "Түвшин" гэх мэт хоёр утгатай тэмдэглэгээ
 * байдаг бол бодит задаргаа нь хойно сууна.
 *
 * Оноо нь гурван зүйлийг үржүүлнэ:
 * 1. **Тэнцвэр** (энтропи) — бүх бичлэг нэг ангилалд бөөгнөрвөл тэр
 *    задаргаа юу ч хэлэхгүй.
 * 2. **Хэмжээ** — арван хоёроос олон ангилал диаграмд уншигдахаа болино.
 * 3. **Бүрдэл** — "Бүртгэгдээгүй" олонтой талбар нь задаргаа биш,
 *    бөглөлтийн тайлан болно.
 */
function scoreOf(values: Datum[]): number {
  const total = values.reduce((s, d) => s + d.value, 0);
  if (total <= 0 || values.length < 2) return 0;

  let h = 0;
  for (const d of values) {
    const p = d.value / total;
    if (p > 0) h -= p * Math.log2(p);
  }
  const balance = h / Math.log2(values.length);
  const size = Math.min(1, 12 / values.length);
  const blank = values.find((d) => d.key === "Бүртгэгдээгүй")?.value ?? 0;
  const filled = 1 - blank / total;
  /* ДАВТАГДАХ нь ангилал болохын гол шинж: бичлэг бүр өөрийн утгатай
     бол (нэр, дугаар) энтропи дээд цэгтээ хүрэх ч диаграм нь нэг
     нэгжийн урттай зурвасуудын жагсаалт болно */
  const reuse = 1 - values.length / total;

  return balance * size * filled * reuse;
}

/** Утгуудыг тоолж, тоо буурахаар эрэмбэлнэ */
function tally(keys: string[][]): Datum[] {
  const map = new Map<string, number>();
  for (const ks of keys) for (const k of ks) map.set(k, (map.get(k) ?? 0) + 1);
  return [...map]
    .map(([k, v]) => ({ key: k, label: k, value: v }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Бичвэр талбарыг ангилал болгож үзнэ.
 *
 * Тусгаарлагчаар задлах нь БОЛЗОЛТ: задалсны дараа ангиллын тоо
 * ЦӨӨРӨХ ёстой. Цөөрөхгүй бол таслал нь жагсаалтын тэмдэг биш нэрийн
 * хэсэг байсан гэсэн үг ("Ар, Өвөр гэсэн нэртэй ам") — тэр үед
 * задлахгүй.
 */
function candidateOf(field: LayerField, raw: string[]): Candidate | null {
  if (!raw.length) return null;

  /* Өгүүлбэр нь ангилал биш */
  const text = raw.filter((v) => v !== "Бүртгэгдээгүй");
  const avg = text.reduce((s, v) => s + v.length, 0) / (text.length || 1);
  if (avg > NOTE_LENGTH) return null;

  const single = raw.map((v) => [v]);
  const flat = new Set(raw).size;

  let keys = single;
  let multi = false;
  /* Задралын дүрмийг ХАДГАЛНА: шүүлт нь дараа нь дурын бичлэгээс ижил
     түлхүүр гаргаж чадах ёстой */
  let fold: Map<string, string> | null = null;

  if (raw.some((v) => SEPARATOR.test(v))) {
    const cut = raw.map((v) =>
      v === "Бүртгэгдээгүй" ? [v] : v.split(SEPARATOR).filter(Boolean),
    );
    const folded = foldPrefixes(new Set(cut.flat()));
    const split = cut.map((ks) => [
      ...new Set(ks.map((k) => folded.get(k) ?? k)),
    ]);

    const parts = new Set(split.flat()).size;
    if (parts < flat) {
      keys = split;
      multi = true;
      fold = folded;
    }
  }

  const values = tally(keys);
  if (values.length < MIN_VALUES || values.length > MAX_VALUES) return null;
  /* Бараг бичлэг тутамд өөр утга — энэ нь ангилал биш ТАНИГЧ (нэр,
     код). Диаграм болговол бүх зурвас нэг нэгжийн урттай гарна */
  const unique = values.length / raw.length;
  if (
    raw.length >= SMALL ? unique > UNIQUE_SHARE : values.length === raw.length
  ) {
    return null;
  }

  const name = field.name;
  const keyOf =
    multi && fold
      ? (row: Row) => {
          const v = categoryKey(row[name]);
          if (v === "Бүртгэгдээгүй") return [v];
          return [
            ...new Set(
              v
                .split(SEPARATOR)
                .filter(Boolean)
                .map((k) => fold.get(k) ?? k),
            ),
          ];
        }
      : (row: Row) => [categoryKey(row[name])];

  return { field, keys, keyOf, multi, values, score: scoreOf(values) };
}

/** Хуанлийн хэсэг — огнооны багана тоогоор задарсан байдал */
type Calendar = "year" | "month" | "day";

/**
 * Тоон талбар нь ХУАНЛИЙН ХЭСЭГ мөн үү.
 *
 * Эх сурвалж огноогоо гурван багананд задалж бичдэг (он, сар, өдөр).
 * Эдгээр нь тоо боловч ХЭМЖИГДЭХҮҮН БИШ: сарын дугаарыг нэмэхэд
 * "Сар = 300" гэсэн утгагүй үзүүлэлт гарна (бодит алдаа, 2026-09-15).
 *
 * Утгын МУЖААР нь таана — талбарын нэрээр биш. Онг мужаас нь шууд
 * танина (1900–2100 хооронд өөр юу ч байхгүй), харин 1–12, 1–31 нь
 * жинхэнэ тоолол ч байж болох тул нэрээс нь БАТАЛГАА нэхнэ.
 */
function calendarOf(f: LayerField, values: number[]): Calendar | null {
  if (!values.length || !values.every((v) => Number.isInteger(v))) return null;

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const named = `${f.alias} ${f.name}`;

  if (lo >= 1900 && hi <= 2100) return "year";
  if (lo >= 1 && hi <= 12 && /сар|month/i.test(named)) return "month";
  if (lo >= 1 && hi <= 31 && /өдөр|udur|day/i.test(named)) return "day";
  return null;
}

/**
 * Жилийн цуваа.
 *
 * ХООСОН жил ч тэг утгаар орно: "тэр жил нэг ч бүртгэл гараагүй"
 * гэдэг нь өөрөө мэдээлэл. Харин урт цуваанд жил тутмын багана
 * БОЛОХГҮЙ — тогтоолууд хагас зуунд тархсан тул баганын дөрөвний
 * гурав нь хоосон болж, хэлбэр нь уншигдахаа болино. Хорин дөрвөн
 * жилээс урт бол таван жилийн бүлэг болгоно.
 */
function yearChart(
  f: LayerField,
  rows: Row[],
  yearOf: (row: Row) => number | null,
): Breakdown | null {
  const years = rows.map(yearOf).filter((y): y is number => y != null);
  if (years.length < MIN_VALUES) return null;

  const from = Math.min(...years);
  const to = Math.max(...years);
  if (to <= from) return null;

  const step = to - from > 24 ? 5 : 1;
  const base = Math.floor(from / step) * step;
  const bins = Math.floor((to - base) / step) + 1;

  /* Бүлгийн эхлэх он нь ТҮЛХҮҮР: шүүлт, тэнхлэгийн шошго хоёулаа
     үүнээс гардаг тул бүлэглэлт хаана ч давтагдахгүй */
  const binOf = (y: number) => base + Math.floor((y - base) / step) * step;

  const keyOf = (row: Row) => {
    const y = yearOf(row);
    return y == null ? [] : [String(binOf(y))];
  };

  const count = (rs: Row[]): Counted => {
    const byBin = new Map<string, number>();
    for (const r of rs) {
      const k = keyOf(r)[0];
      if (k != null) byBin.set(k, (byBin.get(k) ?? 0) + 1);
    }
    return {
      values: Array.from({ length: bins }, (_, i) => {
        const y = base + i * step;
        return {
          key: String(y),
          label: step === 1 ? String(y) : `${y}–${y + step - 1}`,
          value: byBin.get(String(y)) ?? 0,
        };
      }),
    };
  };

  return {
    id: `${f.name}:year`,
    field: f.name,
    label: f.alias,
    kind: "year",
    keyOf,
    recount: count,
    ...count(rows),
  };
}

/** Сарын хуваарилалт — арван хоёр нүд үргэлж бүтэн гарна */
function monthChart(
  f: LayerField,
  rows: Row[],
  monthOf: (row: Row) => number | null,
): Breakdown | null {
  const months = rows.map(monthOf).filter((m): m is number => m != null);
  if (
    new Set(months).size < MONTH_MIN_SPREAD ||
    months.length < MONTH_MIN_ROWS
  ) {
    return null;
  }

  const keyOf = (row: Row) => {
    const m = monthOf(row);
    return m == null ? [] : [String(m)];
  };

  const count = (rs: Row[]): Counted => {
    const byMonth = new Map<string, number>();
    for (const r of rs) {
      const k = keyOf(r)[0];
      if (k != null) byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    }
    return {
      values: Array.from({ length: 12 }, (_, i) => ({
        key: String(i + 1),
        label: `${i + 1}-р сар`,
        value: byMonth.get(String(i + 1)) ?? 0,
      })),
    };
  };

  return {
    id: `${f.name}:month`,
    field: f.name,
    label: f.alias,
    kind: "month",
    keyOf,
    recount: count,
    ...count(rows),
  };
}

/** Тоон хэмжилт — талбар ба бичлэг бүрийн утга */
type Measure = {
  field: LayerField;
  /** Нэгж, эх сурвалжийн нэрнээс ("га", "%") */
  unit: string;
  /** Нэгжгүй нэр ("Талбай тогтоолоор") */
  name: string;
  /** Нэмэх нь утгагүй — дунджаар авна */
  share: boolean;
  values: (number | null)[];
};

/**
 * Хэмжилт болох тоон талбаруудыг ялгана.
 *
 * НЭГ удаа уншиж, дараа нь хэдэн ч зүсэлтэд дахин хэрэглэнэ: ижил
 * хэмжилтийг ангиллаар нь ч, нэрээр нь ч задлах тул талбарын
 * шалгуурыг хоёр газар давтах нь эрт орой зөрнө.
 */
function pickMeasures(
  info: LayerInfo,
  rows: Record<string, unknown>[],
): Measure[] {
  const out: Measure[] = [];

  for (const f of info.fields) {
    if (out.length >= MAX_MEASURE_FIELDS) break;
    if (!NUMERIC.test(f.type)) continue;
    const skip = info.set.skipMeasure;
    if (skip?.test(f.alias) || skip?.test(f.name)) continue;
    /* Координат нь тоо боловч хэмжигдэхүүн БИШ — геометрийн хуулбар */
    if (COORD_FIELD.test(f.name) || COORD_FIELD.test(f.alias)) continue;

    const values = rows.map((r) => numberOf(r[f.name]));
    const present = values.filter((v): v is number => v != null);
    if (present.length < MIN_VALUES) continue;
    if (looksLikeId(present)) continue;
    /* Бүгд ижил утгатай бол задаргаа биш тогтмол */
    if (new Set(present).size < 2) continue;
    /* Он, сар, өдөр нь тоо боловч хэмжигдэхүүн биш — нэмэх нь утгагүй.
       Тэдгээр нь ХУГАЦААНЫ диаграм болж тусдаа гарна */
    if (calendarOf(f, present)) continue;

    if (info.set.skipUnit?.test(f.alias)) continue;

    const { unit, name } = unitOf(f.alias);
    /* Хувийг НЭМЭХГҮЙ — дунджаар нь. Хоёр талбайн зөрүүний хувийг
       нэмбэл утгагүй тоо гарна */
    const share = unit === "%" || /хувь/i.test(f.alias);

    out.push({ field: f, unit, name, share, values });
  }

  return out;
}

/** Хэмжилтийг өгөгдсөн зүсэлтээр нэгтгэнэ */
function rollUp(
  m: Measure,
  rows: Row[],
  keyOf: (row: Row) => string[],
): Datum[] {
  const sum = new Map<string, number>();
  const n = new Map<string, number>();

  for (const r of rows) {
    const v = numberOf(r[m.field.name]);
    if (v == null) continue;
    /* Хэмжилтийг ЗӨВХӨН эхний ангилалд ононо — олон утгатай зүсэлт
       дээр нийлбэр давхардахаас сэргийлнэ */
    const k = keyOf(r)[0];
    if (k == null) continue;
    sum.set(k, (sum.get(k) ?? 0) + v);
    n.set(k, (n.get(k) ?? 0) + 1);
  }

  return [...sum]
    .map(([k, v]) => ({
      key: k,
      label: k,
      value: m.share ? v / (n.get(k) || 1) : v,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Хэмжилтүүдийг НЭГ зүсэлтээр диаграм болгоно.
 *
 * Ижил НЭГЖТЭЙ, нэмэгддэг хэмжилтүүд нэг харьцуулалт болж нийлнэ;
 * үлдсэн нь тус тусдаа. `limit` өгвөл зөвхөн хамгийн их утгатай
 * мөрүүд үлдэнэ — нэрээр задлахад мөр нь бичлэгийн тоотой тэнцэх тул
 * хязгааргүй бол диаграм нь дэлгэц дүүрэн жагсаалт болно.
 */
function measureCharts(
  measures: Measure[],
  rows: Row[],
  by: LayerField,
  keyOf: (row: Row) => string[],
  limit?: number,
): Breakdown[] {
  const out: Breakdown[] = [];
  if (!measures.length) return out;

  const usable = measures.filter((m) => rollUp(m, rows, keyOf).length > 0);
  if (!usable.length) return out;

  /*
    Хамрах хүрээ нь БҮХ диаграмд нэг байх ёстой: эхнийх нь эхний
    хориг, нөгөө нь өөр хориг үзүүлбэл хоёр диаграм зэрэгцэхэд өөр
    өөр зүйл харьцуулагдана. Тиймээс эрэмбийг ҮРГЭЛЖ эхний хэмжилт
    тогтооно — шүүсний дараа ч мөн адил.
  */
  const cutTo = (vs: Datum[], keep: Set<string> | null) =>
    keep ? vs.filter((d) => keep.has(d.key)) : vs;

  const topOf = (lead: Datum[]) =>
    limit && lead.length > limit
      ? new Set(lead.slice(0, limit).map((d) => d.key))
      : null;

  /* Хураалтыг гарчигт хэлэх эсэхийг ШҮҮЛТГҮЙ байдлаар шийднэ: долоон
     мөр дээр "эхний 20" гэж бичих нь худал мэдээлэл болно */
  const cutsAt = (m: Measure) =>
    limit && rollUp(m, rows, keyOf).length > limit ? limit : undefined;

  /* Ижил нэгжтэй, НЭМЭГДДЭГ хэмжилтүүд — нэг харьцуулалт */
  const byUnit = new Map<string, Measure[]>();
  for (const m of usable) {
    if (!m.unit || m.share) continue;
    const list = byUnit.get(m.unit) ?? [];
    list.push(m);
    byUnit.set(m.unit, list);
  }

  const merged = new Set<string>();
  for (const [unit, all] of byUnit) {
    if (all.length < 2) continue;
    /* Бүлэгт орсон бүгдийг тэмдэглэнэ — доор дангаар нь дахин
       гарахгүйн тулд (хассан "нийт" багана ч мөн адил) */
    for (const m of all) merged.add(m.field.name);

    /*
      ⚠ НИЙТ багана нь цуваа БИШ, цуваануудынхаа НИЙЛБЭР.

      Эх сурвалж он тус бүрийн хажууд нэгтгэсэн багана бичдэг
      ("Талбай, га нийт"). Түүнийг ондуудтай нь зэрэгцүүлбэл өөрийн
      хэсгүүдээсээ хэдэн дахин урт зурвас болж, бусдыг нь дарна —
      харьцуулалт утгаа алдана.

      Оны багана ХОЁР ба түүнээс олон байвал зөвхөн тэднийг үлдээнэ:
      нэгтгэлийг нь хасахад алдагдах мэдээлэл алга, нийлбэр нь
      ондуудаасаа уншигдана.
    */
    const dated = all.filter((m) => /(?:19|20)\d{2}$/.test(m.name));
    const list = dated.length >= 2 ? dated : all;

    const names = trimShared(list.map((m) => m.name));

    const count = (rs: Row[]): Counted => {
      const rolled = list.map((m) => rollUp(m, rs, keyOf));
      const keep = topOf(rolled[0]);
      const lead = cutTo(rolled[0], keep);
      return {
        values: lead,
        groups: lead.map((d) => ({
          key: d.key,
          label: d.label,
          total: d.value,
          rows: list.map((m, i) => ({
            key: `${d.key}·${m.field.name}`,
            label: names[i],
            value: rolled[i].find((v) => v.key === d.key)?.value ?? 0,
          })),
        })),
      };
    };

    out.push({
      id: `compare:${unit}:${by.name}`,
      field: by.name,
      label: by.alias,
      kind: "compare",
      measure: unit,
      top: cutsAt(list[0]),
      keyOf,
      recount: count,
      ...count(rows),
    });
  }

  for (const m of usable) {
    if (merged.has(m.field.name)) continue;
    /* Харьцуулалтууд аль хэдийн суудлаа эзэлсэн байж болно */
    if (out.length >= MAX_MEASURES) break;

    const count = (rs: Row[]): Counted => {
      const vs = rollUp(m, rs, keyOf);
      return { values: cutTo(vs, topOf(vs)) };
    };

    out.push({
      id: `${m.field.name}:${m.share ? "mean" : "sum"}:${by.name}`,
      field: by.name,
      label: by.alias,
      kind: m.share ? "mean" : "sum",
      /* Эх сурвалжийн нэрийг ШУУД биш, задалсан нэгжтэй нь дахин
         угсарна — эс тэгвээс "мян.₮" товчлол дэлгэц дээр гарна */
      measure: m.unit ? `${m.name}, ${m.unit}` : m.field.alias,
      top: cutsAt(m),
      keyOf,
      recount: count,
      ...count(rows),
    });
  }

  return out.slice(0, MAX_MEASURES);
}

/**
 * Нэр мөн болохын шинж.
 *
 * Бичлэг бүрд өөр богино бичвэр гэдэг нь хангалтгүй: хаяг ("БЗД 20-р
 * хороо; НД 01-р хороо") ч, код ч тэр шалгуурыг давна. Нэр нь ХҮНИЙ
 * УНШИХ ЁСТОЙ зүйл тул диаграмын тэнхлэгт очих ёстой нь тэр.
 *
 * Хоёр шинжээр ялгана:
 * 1. **Цифр** — нэр үсгээр бичигддэг, хаяг, код тоогоор.
 * 2. **Давтагдсан үг** — хаягийн багананд "хороо", "дүүрэг" гэсэн үг
 *    мөр бүрд давтагдана; нэрийн багананд ийм нийтлэг үг байхгүй.
 */
function nameScore(values: string[]): number {
  const digits =
    values.reduce((s, v) => s + (/\d/.test(v) ? 1 : 0), 0) / values.length;

  const seen = new Map<string, number>();
  for (const v of values) {
    for (const w of new Set(
      v
        .toLowerCase()
        .split(/\s+/)
        .filter((x) => x.length > 2),
    )) {
      seen.set(w, (seen.get(w) ?? 0) + 1);
    }
  }
  const boiler = Math.max(0, ...seen.values()) / values.length;

  return (1 - digits) * (1 - boiler);
}

/**
 * НЭРИЙН багана.
 *
 * Бичлэг бүрийг ялгах зориулалттай богино бичвэр талбар — ангилал
 * болохгүй ч хэмжилтийн тэнхлэг болоход хамгийн тохиромжтой: "аль
 * ТХГН хэдэн га вэ" гэдэг нь ангиллын нийлбэрээс илүү шууд хариулт.
 *
 * Ангилал болж чадсан талбарыг ЭНД авахгүй — тэр нь аль хэдийн
 * өөрийн диаграмтай. Жагсаалт агуулсан талбарыг ч авахгүй: нэг
 * бичлэгийн хэдэн утга нэг мөрөнд багтахгүй.
 */
function nameField(
  info: LayerInfo,
  rows: Record<string, unknown>[],
  taken: Candidate[],
): LayerField | null {
  const used = new Set(taken.map((c) => c.field.name));
  let best: { field: LayerField; score: number; distinct: number } | null =
    null;

  for (const f of info.fields) {
    if (f.type !== "String" || used.has(f.name)) continue;

    const values = rows.map((r) => categoryKey(r[f.name]));
    const filled = values.filter((v) => v !== "Бүртгэгдээгүй");
    if (filled.length < MIN_VALUES) continue;

    /* Өгүүлбэр нь нэр биш — тэмдэглэл */
    const length = filled.reduce((s, v) => s + v.length, 0) / filled.length;
    if (length > NOTE_LENGTH) continue;

    /* Жагсаалт нь нэр биш */
    const lists =
      filled.filter((v) => SEPARATOR.test(v)).length / filled.length;
    if (lists > LIST_SHARE) continue;

    /* Давтагддаг утга нь нэр биш ангилал — тэр нь ангиллын шалгуураар
       аль хэдийн шалгарсан эсвэл хасагдсан */
    const distinct = new Set(values).size;
    if (distinct < rows.length * UNIQUE_SHARE) continue;

    const score = nameScore(filled);
    if (
      !best ||
      score > best.score ||
      (score === best.score && distinct > best.distinct)
    ) {
      best = { field: f, score, distinct };
    }
  }

  /* Цифр, давтагдсан үгээр дүүрэн багана нь нэр биш — тэнхлэг болговол
     диаграм нь ижил эхлэлтэй мөрүүдийн жагсаалт болно */
  return best && best.score >= NAME_MIN ? best.field : null;
}

/**
 * Давхаргын диаграмуудыг угсарна.
 *
 * ГУРВАН давхарга:
 *
 * 1. **Ангилал** — бичвэр талбар бүрийн утгын тоолол, ХАМГИЙН САЙН
 *    задалж буй нь түрүүлж.
 * 2. **Хэмжигдэхүүн** — тоон талбарыг тэр ангиллаар нь задалсан
 *    нийлбэр. Талбайн бүртгэлд "хэдэн бичлэг" гэдгээс "хэдэн га"
 *    гэдэг нь илүү хариулт өгдөг (эвдэрсэн газрын самбартай ижил
 *    үндэслэл): нэг том талбай зуун жижигтэй тэнцэнэ.
 *    ⚠ Хувь хэмжигдэхүүнийг НЭМЭХГҮЙ — дунджаар нь авна.
 *    ⚠ Ижил НЭГЖТЭЙ хэд хэдэн хэмжилт бол нэг диаграмд ХАРЬЦУУЛНА:
 *    тогтоолын, геодезийн, тоологсон талбай гурав тусдаа диаграм
 *    болбол бараг ижил гурван зураг гарч, ГОЛ АСУУЛТ болох зөрүү нь
 *    хаагдана.
 * 3. **Хугацаа** — огнооны талбарын жил, сарын хуваарилалт.
 *
 * Бүгд эх сурвалжийн ТӨРЛӨӨС гарна — талбарын нэр кодод бичигдээгүй.
 */
export function breakdowns(info: LayerInfo, data: LayerFeatures): Breakdown[] {
  const rows = Object.values(data.rows);
  if (!rows.length) return [];

  /* ---- 1. Ангилал ---- */
  const cats: Candidate[] = [];
  for (const f of info.fields) {
    if (f.type !== "String") continue;
    const c = candidateOf(
      f,
      rows.map((r) => categoryKey(r[f.name])),
    );
    if (c) cats.push(c);
  }
  cats.sort((a, b) => b.score - a.score);

  /*
    ЦОМХОТГОЛ: хуулбар задаргааг хаяж, шилдэг цөөхнийг нь үлдээнэ.
    Эрэмбэ нь оноогоор тул хосоос ҮРГЭЛЖ илүү сайн задалдаг нь үлдэнэ.
  */
  const kept: Candidate[] = [];
  for (const c of cats) {
    if (kept.length >= MAX_CATEGORIES) break;
    if (kept.some((k) => samePartition(k, c))) continue;
    kept.push(c);
  }

  /*
    ХЭМЖИЛТИЙГ ЗАДЛАХ ангилал нь олон утгагүй байх ЁСТОЙ: нэг талбай
    хоёр дүүрэгт харьяалагдвал талбай нь хоёуланд нь бүтнээрээ
    тоологдож, нийлбэр нь бодит талбайгаас их гарна. Тоолол дээр тийм
    давхардал зөвшөөрөгдөнө (ил тэмдэглэгдэнэ), нийлбэр дээр бол үгүй.
  */
  const primary = kept.find((c) => !c.multi);

  const out: Breakdown[] = [];

  const countOf = (c: Candidate): Breakdown => ({
    id: `${c.field.name}:count`,
    field: c.field.name,
    label: c.field.alias,
    kind: "count",
    multi: c.multi || undefined,
    keyOf: c.keyOf,
    recount: (rs) => ({ values: tally(rs.map(c.keyOf)) }),
    values: c.values,
  });

  if (primary) out.push(countOf(primary));

  /* ---- 2. Тоон хэмжигдэхүүн ---- */
  const measures = pickMeasures(info, rows);

  if (primary) {
    /* Хэмжилт бүрийг ангиллаар нь задална. Нэг бичлэг НЭГ ангилалд
       харьяалагддаг тул `keys[i][0]` хангалттай */
    out.push(...measureCharts(measures, rows, primary.field, primary.keyOf));
  }

  /*
    ---- 2б. НЭРЭЭР нь ----

    Нэрийн багана ангилал БОЛОХГҮЙ (бичлэг бүр өөрийн утгатай тул
    тооллын диаграм нь нэг нэгжийн урттай зурвасуудын жагсаалт болно) —
    гэхдээ ХЭМЖИЛТИЙН тэнхлэг болоход хамгийн тохиромжтой нь мөн тэр:
    "аль ТХГН хэдэн га вэ" гэдэг нь ангиллын нийлбэрээс илүү шууд
    хариулт өгнө.
  */
  const named = nameField(info, rows, kept);
  if (named) {
    const keyOf = (row: Row) => [categoryKey(row[named.name])];
    out.push(...measureCharts(measures, rows, named, keyOf, TOP_ROWS));
  }

  /* ---- 3. Үлдсэн ангиллууд ---- */
  for (const c of kept) if (c !== primary) out.push(countOf(c));

  /* ---- 4. Хугацаа ---- */
  let dates = 0;
  for (const f of info.fields) {
    if (dates >= MAX_DATES) break;

    let yearOf: ((row: Row) => number | null) | null = null;
    let monthOf: ((row: Row) => number | null) | null = null;

    if (f.type === "Date") {
      yearOf = (row) => dateOf(row[f.name])?.getUTCFullYear() ?? null;
      monthOf = (row) => {
        const d = dateOf(row[f.name]);
        return d ? d.getUTCMonth() + 1 : null;
      };
    } else if (NUMERIC.test(f.type)) {
      /* Огноо нь тусдаа багануудад задарсан байж болно — тэр үед
         давхаргад `Date` төрлийн талбар огт байхгүй ч хугацааны
         харагдац боломжтой */
      const nums = rows
        .map((r) => numberOf(r[f.name]))
        .filter((v): v is number => v != null);
      if (nums.length < MIN_VALUES) continue;

      const kind = calendarOf(f, nums);
      if (kind === "year") yearOf = (row) => numberOf(row[f.name]);
      else if (kind === "month") monthOf = (row) => numberOf(row[f.name]);
      /* Сарын өдөр нь хэв маяг агуулдаггүй — диаграм болгохгүй */
      else continue;
    } else {
      continue;
    }

    const year = yearOf ? yearChart(f, rows, yearOf) : null;
    const month = monthOf ? monthChart(f, rows, monthOf) : null;
    if (year) out.push(year);
    if (month) out.push(month);
    if (year || month) dates += 1;
  }

  return out;
}

/**
 * Газрын зургийн шошгонд юу бичих вэ.
 *
 * Дүрс дээр бичих зүйл нь диаграмынхтай ИЖИЛ эх сурвалжаас гарах
 * ёстой: зураг дээр "Горхи-Тэрэлж 29,488 га" гэж бичээд диаграмд өөр
 * тоо гарвал аль нь зөв нь мэдэгдэхгүй болно. Тиймээс нэрийг нь
 * `nameField`-ээс, талбайг нь хэмжилтийн ЭХНИЙХЭЭС (диаграм мөн
 * түүнийг харуулдаг) авна.
 *
 * Аль нь ч олдохгүй бол `null` — шошгогүй дүрс нь буруу шошготойгоос
 * дээр.
 */
export type LayerLabels = {
  /** Нэрийн талбарын техникийн нэр */
  name: string | null;
  /** Хэмжилтийн талбар ба түүний нэгж */
  measure: { field: string; unit: string } | null;
};

export function labelParts(info: LayerInfo, data: LayerFeatures): LayerLabels {
  const rows = Object.values(data.rows);
  if (!rows.length) return { name: null, measure: null };

  /*
    ⚠ НЭГЖГҮЙ тоог шошгонд БИЧИХГҮЙ.

    Зураг дээр "1", "2" гэсэн тоо гарвал тэр нь юуны тоо болох нь
    мэдэгдэхгүй — зүгээр л дүрсээ дарна. Нэгжтэй хэмжилт (га, м³) л
    өөрөө өөрийгөө тайлбарлана.
  */
  const m = pickMeasures(info, rows).find((x) => !x.share && x.unit) ?? null;

  return {
    name: nameField(info, rows, [])?.name ?? null,
    measure: m ? { field: m.field.name, unit: m.unit } : null,
  };
}

/** Олон өнцөгт давхаргын нийт талбай, га */
export function totalHa(data: LayerFeatures): number {
  let m2 = 0;
  for (const v of Object.values(data.area)) m2 += v;
  return m2 / 10000;
}

/* --------------------------------------------------------------------------
   САНАХ ОЙН КЭШ (2026-09-17, хэрэглэгч: "мэдээ татаж байна гээд маш их
   удаж байна")

   Урьд нь давхаргын тодорхойлолт, бичлэг хоёулаа САМБАРЫН ТӨЛӨВД л
   суудаг байв: өөр хэлтэс рүү очоод буцахад, таб солиход, бүр давхаргыг
   унтрааж асаахад бүгд дахин татагдаж байлаа. Дата нь нэг сессийн
   дотор өөрчлөгдөхгүй тул үйлчилгээний хаягаар түлхүүрлэсэн модулийн
   түвшний кэш хангалттай — хуудас сэргээхэд л хоосорно.

   ⚠ АМЛАЛТЫГ кэшилнэ, үр дүнг биш: хоёр самбар нэг давхаргыг зэрэг
   гуйвал нэг л татац явна.

   ⚠ ТАТАЦ ДУУДАГЧИЙН ABORT-ООС ҮЛ ХАМААРНА. Хэрэглэгч татагдаж дуусахаас
   өмнө өөр хуудас руу шилжвэл татац ЗОГСОХГҮЙ, дуусаад кэшид сууна —
   буцаж ирэхэд бэлэн байна. Дуудагч тал л хүлээхээ болино (`race`).
   Зогсоовол хагас татсан ажил хаягдаж, буцаж ирэхэд эхнээсээ эхлэх
   байсан. Унасан амлалт кэшээс ХАСАГДАНА — түр зуурын алдаа (токен
   дууссан, сүлжээ тасарсан) дараагийн оролдлогыг хаах ёсгүй.
   -------------------------------------------------------------------------- */
const infoCache = new Map<string, Promise<LayerInfo>>();
const rowsCache = new Map<string, Promise<LayerRows>>();
const shapesCache = new Map<string, Promise<GeoJSON.Feature[]>>();

/** Дуудагчийн `signal` тасрахад хүлээхээ болино — амлалт өөрөө үргэлжилнэ */
function abortable<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function memo<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key);
  if (!p) {
    p = load();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export function fetchLayerInfo(set: LayerSet, id: string, signal?: AbortSignal): Promise<LayerInfo> {
  return abortable(memo(infoCache, serviceOf(set, id), () => loadLayerInfo(set, id)), signal);
}

const NO_SHAPES: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * `onRows` нь атрибут ирмэгц (геометрээс ӨМНӨ) хоосон геометртэй
 * хувилбарыг өгнө — самбар түүгээр диаграм, жагсаалтаа шууд зурна.
 * Буцаах амлалт нь геометртэй бүтэн хувилбараар шийдэгдэнэ.
 * Хоёр үе шат тус тусдаа кэшлэгдэнэ.
 */
export function fetchLayerFeatures(
  info: LayerInfo,
  signal?: AbortSignal,
  onRows?: (partial: LayerFeatures) => void,
): Promise<LayerFeatures> {
  const key = `${serviceOf(info.set, info.id)}/${info.layerId}`;
  const rows = memo(rowsCache, key, () => loadLayerRows(info));
  const shapes = memo(shapesCache, key, () => loadLayerShapes(info));
  if (onRows) {
    void rows.then((r) => {
      if (!signal?.aborted) onRows({ id: info.id, shapes: NO_SHAPES, ...r });
    }, () => undefined);
  }
  return abortable(
    Promise.all([rows, shapes]).then(([r, features]) => ({
      id: info.id,
      shapes: { type: "FeatureCollection", features },
      ...r,
    })),
    signal,
  );
}
