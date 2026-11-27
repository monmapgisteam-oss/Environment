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
import { clipToRegion } from "@/lib/extent";
import { HOSTING } from "@/lib/portal";
import type { LayerSet, LayerInfo, LayerField, LayerFeatures, Row, LayerUnion } from "./layer-types";
import { SKIP_FIELDS, KML_NOISE, EDITOR_FIELDS } from "./layer-fields";
import { officialLabel, NUMERIC, unitOf, SEPARATOR } from "./breakdowns";

/* Хуваасан модулиуд — гаднах импортын зам хэвээр (`@/lib/portal-layers`) */
export * from "./layer-types";
export * from "./layer-fields";
export * from "./breakdowns";
export * from "./layer-labels";

/** ~10 метрийн ерөнхийлөлт (градусаар) */
const OFFSET = 0.0001;

/** Нэг удаад татах дээд бичлэг */
const PAGE = 2000;





/** Нэгтгэлд эх тус бүрийн дугаарын зай — давхарга бүр 100 мянгаас цөөн бичлэгтэй */
const UNION_STRIDE = 100_000;

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








type ServiceMeta = {
  layers?: { id: number; name: string; geometryType?: string }[];
};

type LayerMeta = {
  id: number;
  name: string;
  geometryType?: string;
  objectIdField?: string;
  fields?: {
    name: string;
    alias?: string;
    type: string;
    domain?: { type?: string; codedValues?: { name: string; code: string | number }[] } | null;
  }[];
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
/** Давхаргын мөрийн нөхцөл ({@link LayerSet.where}) */
function whereOf(set: LayerSet, id: string): string {
  return set.where?.[id] ?? "1=1";
}

/** Кэшийн түлхүүр — нөхцөлтэй давхарга өөрийн түлхүүртэй */
function layerKey(set: LayerSet, id: string): string {
  const w = set.where?.[id];
  return w ? `${serviceOf(set, id)}?${w}` : serviceOf(set, id);
}

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
        new URLSearchParams({
          where: whereOf(set, id),
          returnCountOnly: "true",
          f: "json",
        }),
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

  const skip = set.skipField;
  const only = set.onlyFields?.[id];

  const fields: LayerField[] = all
    .filter(
      (f) =>
        (!only || only.test(f.name)) &&
        !SKIP_FIELDS.test(f.name) &&
        !KML_NOISE.test(f.name) &&
        !EDITOR_FIELDS.test(f.name) &&
        !skip?.test(f.name) &&
        !skip?.test((f.alias ?? "").trim()),
    )
    .map((f) => ({
      name: f.name,
      /* Хэлтсийн өгсөн албан нэр эх сурвалжийн алиасыг дарна */
      /* Түлхүүр нь талбарын нэр, эсвэл эх сурвалжийн alias — нэр нь
         токенгүйгээр уншигдаагүй давхаргад alias-аар дарна */
      alias:
        /* "давхарга/талбар" түлхүүр нь ЗӨВХӨН тэр давхаргад — нэг цэсэд
           ижил нэртэй талбар өөр утгатай байж болно (татмын `name` нь
           сав газар, хамгаалалтын бүсийнх биш; 2026-10-23) */
        set.fields?.[`${id}/${f.name}`] ??
        set.fields?.[f.name] ??
        set.fields?.[(f.alias ?? "").trim()] ??
        officialLabel((f.alias ?? "").trim() || f.name),
      type: f.type.replace("esriFieldType", ""),
      ...(set.domains && f.domain?.codedValues?.length
        ? { codes: Object.fromEntries(f.domain.codedValues.map((c) => [String(c.code), c.name.trim()])) }
        : {}),
    }));

  /* Дугаарын талбар — давхарга зарлаагүй бол талбарын жагсаалтаас олно */
  const oidField =
    meta.objectIdField?.trim() ||
    all.find((f) => f.type === "esriFieldTypeOID")?.name ||
    all.find((f) => /^objectid$/i.test(f.name))?.name ||
    "objectid";

  /*
    ⚠⚠ **`SHAPE__Area` нь ГЕКТАР БИШ, WEB MERCATOR КВАДРАТ МЕТР**
    (2026-09-25-нд хэмжиж тогтоов).

    Хостлогдсон давхаргын `SHAPE__Area` нь хадгалалтын проекцоор
    бодогддог бөгөөд тэр нь Web Mercator. Энэ проекц туйл руу ойртох
    тусам талбайг `1/cos²φ` дахин хөөрөгдөнө — Улаанбаатарын өргөрөгт
    (47.9°) яг **2.225 дахин**.

    Хязгаарлалтын бүсийн таван дүрс дээр хэмжсэн: эх сурвалжийн
    `talbai_ga` нь 3,923 · 642 · 3,691 · 3,431 · 1,020 га, харин
    `SHAPE__Area / 10000` нь 8,702 · 1,429 · 8,209 · 7,625 · 2,261 —
    харьцаа нь 2.218–2.225. Байгаль хамгаалагчийн бүс дээр ч ижил:
    бүртгэлийн 365,484 га нь дэлгэц дээр 814,238 болж гарч байв
    (2.228 дахин).

    Тиймээс эх сурвалжийн ӨӨРИЙН гектарын багана ДАВУУ ЭРХТЭЙ.
    ⚠ Проекцын коэффициентээр ЗАСАХГҮЙ: өргөрөг бүрд өөр бөгөөд
    давхарга бүр Web Mercator-т хадгалагдсан гэсэн баталгаа алга.
    Эх сурвалж өөрөө гектараа бичсэн бол түүнийг АВНА — таамаг
    хэрэггүй.
    ⚠ `SHAPE__Area` нь зөвхөн НӨӨЦ: гектарын багана байхгүй давхаргад
    хэмжээний ХАРЬЦАА (аль нь илүү том) зөв хэвээр үлдэнэ.
  */
  /*
    ⚠⚠ **`all` нь ЭХ МЕТАДАТА — төрөл нь `esriFieldTypeDouble`
    хэвээр.** `NUMERIC` нь задалсан хэлбэрийг (`Double`) хоёр
    талаасаа бэхлээд шалгадаг тул эх төрлийг шууд үзвэл
    ХЭЗЭЭ Ч таарахгүй. Гектарын багана нь иймээр ХАГАС САР
    ДАРАА ч олдохгүй байсан бөгөөд `SHAPE__Area` (төрлийн
    шалгалтгүй тул) үргэлж шалгардаг байв — улмаар
    платформын БҮХ "Талбай, га" тоо 2.2 дахин илүү хэвээр
    үлдсэн (2026-09-28-нд токеноор илрүүлэв: хязгаарлалтын
    бүс 28,229 гэж гарсан — бодит нь 12,687).
    ⚠ Бусад гурав дуудалт (`measures`, `band`, хуанли) нь
    `info.fields`-д ажилладаг — тэнд төрөл аль хэдийн задарсан
    тул зөв ажиллаж байсан. Энд бас задлана.
  */
  const numeric = (f: { type: string }) =>
    NUMERIC.test(f.type.replace("esriFieldType", ""));

  /*
    ⚠⚠ **НЭГ ДАВХАРГА ГЕКТАРЫН ХЭДЭН БАГАНАТАЙ БАЙЖ БОЛНО**
    (2026-09-28-нд токеноор зургаан давхарга дээр илэрсэн). Эх
    сурвалж НЭГ талбайг хэдэн аргаар бичдэг:
      `O01_THGN_polygon`  — тогтоолоор · геодезийн · ArcGIS
      `B11_tsetserlegt_hureelen` — НЭРЭНД БИЧСЭН · геодезийн
      `B11_nogoon_baiguulamj` — файлаар · геодезийн
      `B12_hogiin_tseg_*` — геодезийн · баримтаар
    `find` нь ТАЛБАРЫН ДАРААЛЛААР эхнихийг авдаг тул
    цэцерлэгт хүрээлэнгийн талбай нь "НЭРЭНД БИЧСЭН" бую
    шошгоноос уншсан бичвэрээс гарах байв — хэмжилт БИШ.

    Тиймээс КАНОНИК НЭР (`talbai_ga`, `area_hec`) ДАВУУ ЭРХТЭЙ:
    зургаан давхаргын тавд тэр нь эх сурвалжийн өөрийн ГОЛ
    багана бөгөөд ойн хэлтсийн "ЗӨВХӨН ТОГТООЛЫНХ" гэсэн
    шийдвэртэй хүртэл таарна (`SKIP_MEASURE`).

    ⚠⚠ АЛЬ НЬ БОЛОХ НЬ ТОДОРГОЙ БОЛ ТАЛБАЙ ГАРГАХГҮЙ.
    `N06_Bulag_hamgaalaltiin_bus_26` нь ЦЭГЭН давхарга бөгөөд
    "Онцгой хамгаалалтын бүс (50 м), га" ба "Энгийн … (200 м), га"
    гэсэн ХОЁР буферын баганатай — аль нэгийг САНАМСГҮЙ
    сонговол дэлгэц дээр бүсийн ТАЛ талбай "Нийт талбай"
    мэт гарна. Эх сурвалжийн эзэн шийдэх зүйл тул түр зуур
    талбайг НЭГ Ч ГАРГАХГҮЙ (`areaField` нь `null`) — буруу
    тоо харуулахаас үзүүлэлтийг үгүй болгосон нь дээр.

    ⚠ НЭГ Л НЭР ДЭВШИГЧ байвал каноник нэр ШААРДАГДАХГҮЙ:
    энд эргэлзэх зүйл алга (`A00`-ийн `ortson_ga`, `B11`-ийн `area_ha`).
  */
  const ALIAS_HA = /,\s*га$/i;
  const CANON_HA = /(^|_)(talbai|area)_?(ga|hec)$/i;

  /* БҮРТГЭЛИЙН ДАРЛАЛТ ДАВУУ ЭРХТЭЙ ({@link LayerSet.areaHa}) —
     шошго, нэр хоёрт нь ороогүй баганыг хэлтэс эргэлзээгүй
     өгсөн бол түүнийг АВНА */
  const pinned = set.areaHa?.[id];
  const pinnedField = pinned
    ? all.find((f) => f.name === pinned && numeric(f))
    : undefined;

  const haFields = all.filter(
    (f) =>
      numeric(f) &&
      (CANON_HA.test(f.name) || ALIAS_HA.test((f.alias ?? "").trim())),
  );
  const canon = haFields.filter((f) => CANON_HA.test(f.name));
  const hectare =
    pinnedField ??
    (canon.length === 1
      ? canon[0]
      : haFields.length === 1
        ? haFields[0]
        : undefined);
  const shapeArea = all.find((f) => /^shape_+area$/i.test(f.name));
  /* ⚠ Гектарын багана ТОДОРГОЙГҮЙ (хоёр буфер) бол
     `SHAPE__Area` рүү УНАХГҮЙ: тэр цэгэн давхаргад алга,
     байсан ч 2.2 дахин хөөрөгдсөн тул хоёр алдаа нэмэгднэ */
  const ambiguous = !hectare && haFields.length > 1;
  /* Бүртгэл талбайг хаасан ({@link LayerSet.noArea}) */
  const areaField =
    ambiguous || set.noArea?.includes(id)
      ? null
      : (hectare?.name ?? shapeArea?.name ?? null);
  /** Талбайн багана нь гектараар бичигдсэн эсэх (эс бөгөөс м²) */
  const areaInHa = Boolean(hectare);

  /*
    ⚠⚠ ГЕКТАРЫН БАГАНЫН ШОШГО НЭГЖЭЭ ӨӨРӨӨ ХЭЛНЭ (2026-10-02,
    хэрэглэгч: "талбайг нь харуулж байгаа юмнуудын нэгжийг нь
    тавиарай").

    Татамын гектарын багана эх сурвалж дээр зүгээр `area` гэж
    нэрлэгдсэн тул диаграмын толгойд "59,886 · 4 ангилал" гэж
    НЭГЖГҮЙ гарч байв — тэр тоо га юу, м² юу гэдэг нь хаанаас ч
    уншигдахгүй. Нэгж нь {@link unitOf}-оор ЗӨВХӨН шошгоноос
    гардаг тул шошго нь түүнийг агуулаагүй бол хаана ч гарахгүй.

    ⚠ ТААМАГ БИШ: энэ мөр зөвхөн `hectare` тодорхойлогдсон үед л
    ажиллана — каноник нэр (`talbai_ga`, `area_hec`) эсвэл хэлтсийн
    ӨӨРИЙН дарлалт ({@link LayerSet.areaHa}). Хоёр тохиолдолд ч
    "энэ багана гектар" гэдэг нь аль хэдийн БАТЛАГДСАН.
    ⚠ Шошго нь нэгжээ аль хэдийн хэлсэн бол (", га"-гаар төгссөн)
    ХӨНДӨХГҮЙ — давхар бичигдэхгүй.
    ⚠ Энэ нь зөвхөн НЭГЖ нэмнэ: латин, техникийн нэрийг монгол
    болгох нь хэлтсийн бүртгэлийн ажил ({@link LayerSet.fields}).
  */
  if (hectare) {
    const f = fields.find((x) => x.name === hectare.name);
    if (f && !unitOf(f.alias).unit) f.alias = `${f.alias}, га`;
  }

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
    areaInHa,
    pageSize: Math.max(1, Math.min(PAGE, Number(meta.maxRecordCount) || PAGE)),
    fields,
  };
}


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
/**
 * Латинаар буусан утгыг бүртгэлийн толиор солино
 * ({@link LayerSet.values}).
 *
 * ⚠ Олон утгат нүдийг бүтнээр нь ХАЙХГҮЙ, ГИШҮҮН тус бүрээр нь
 * солино: `нас` талбарт "Adult, Baby" гэсэн ХОС утга байдаг бөгөөд
 * бүтнээр нь хайвал толинд олдохгүй, англиараа үлдэнэ.
 */
function relabel(
  props: Record<string, unknown>,
  map: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...props };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== "string") continue;
    const parts = v.split(SEPARATOR);
    if (parts.length === 1) {
      const hit = map[v.trim()];
      if (hit) out[k] = hit;
      continue;
    }
    /* Аль нэг гишүүн нь толинд байвал л дахин угсарна */
    let touched = false;
    const next = parts.map((piece) => {
      const hit = map[piece.trim()];
      if (hit) touched = true;
      return hit ?? piece;
    });
    if (touched) out[k] = next.join(", ");
  }
  return out;
}

type Raw = {
  /* ArcGIS-ийн GeoJSON гаралт нь дугаарыг ӨӨРИЙН талбарт ч, `id`-д ч
     бичиж болно — зөвхөн `properties`-ээс уншвал зарим давхарга дээр
     бүх дүрс ЧИМЭЭГҮЙ хаягдана */
  id?: number | string;
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
};

async function pagesOf(
  info: LayerInfo,
  params: Record<string, string>,
): Promise<Raw[]> {
  const service = serviceOf(info.set, info.id);
  const size = info.pageSize;
  /* ⚠⚠ УРТ АСУУЛГА POST-ООР (2026-11-27): хяналт шалгалтын Survey123 маягт
     1,196 талбартай болсны дараа `outFields` ~17 КБ болж, хостинг серверийн
     nginx "414 Request-URI Too Large" буцааж самбар бүхэлдээ нээгдэхгүй байв.
     Параметрүүд биед (form-urlencoded) явна; токен нь хаягт хэвээр
     (`arcgisJson`). Богино асуулга GET хэвээр — бусад давхаргад өөрчлөлтгүй. */
  const page = (offset: number) => {
    const query = new URLSearchParams({
      where: whereOf(info.set, info.id),
      outSR: "4326",
      resultOffset: String(offset),
      resultRecordCount: String(size),
      orderByFields: info.objectIdField,
      f: "geojson",
      ...params,
    });
    const url = `${service}/${info.layerId}/query`;
    const long = url.length + query.toString().length > 4000;
    return arcgisJson<{ features?: Raw[] }>(
      long ? url : `${url}?${query}`,
      info.name,
      long ? { method: "POST", body: query } : undefined,
    ).then((j) => j.features ?? []);
  };

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
  const remap = info.set.values;
  /* Домэйны код → нэр ({@link LayerSet.domains}) — олон сонголттой (`select_multiple`)
     талбарт кодууд таслалаар нийлдэг тул гишүүн бүрийг солино */
  const coded = info.fields.filter((f) => f.codes);
  const decode = (p: Record<string, unknown>) => {
    if (!coded.length) return p;
    const out = { ...p };
    for (const f of coded) {
      const v = out[f.name];
      if (v == null || v === "") continue;
      const parts = String(v).split(",").map((x) => x.trim());
      out[f.name] = parts.map((x) => f.codes![x] ?? x).join(", ");
    }
    return out;
  };
  for (const f of await pagesOf(info, {
    outFields: out.join(","),
    returnGeometry: "false",
  })) {
    const p = decode(f.properties ?? {});
    const uid = Number(p[oid]);
    if (!Number.isFinite(uid)) continue;
    /* Латинаар буусан домэйны утгыг бүртгэлийн толиор солино */
    rows[uid] = remap ? relabel(p, remap) : p;
    if (info.areaField) {
      const a = Number(p[info.areaField]);
      if (Number.isFinite(a)) area[uid] = a;
    }
  }
  if (info.set.tidy) foldSpelling(rows, info);
  if (info.set.foldScript) {
    foldScript(rows, info);
    /* Латин үсэг засагдсаны ДАРАА дахин буулгана — эс тэгвээс холилдсон
       бичиглэлтэй утга толинд таарахгүй үлдэнэ */
    if (remap) for (const uid of Object.keys(rows)) rows[Number(uid)] = relabel(rows[Number(uid)], remap);
  }
  return { rows, area };
}

/*
  ЛАТИН, КИРИЛЛ ХОЛИЛДСОН ҮГ (хэрэглэгч, 2026-10-05: "ангилал дээр
  латин кирилл холиод бичсэн байна уу шалга").

  Гараар бичсэн утгад кирилл үгийн дунд ИЖИЛ ХАРАГДАХ латин үсэг
  (a/а, c/с, e/е, o/о, p/р, x/х, y/у …) орсон байх нь түгээмэл —
  нүдэнд ялгаагүй ч "Усны эрсдэл" нь ХОЁР ангилал болж, хайлтад ч
  олдохгүй. Засвар нь ҮГ БҮРЭЭР:
  · үгэнд кирилл үсэг БАЙХ бөгөөд үлдсэн латин үсэг БҮГД ижил
    харагдах хос үсэгтэй бол → кирилл рүү хөрвүүлнэ;
  · бүтэн латин үг (код, товчлол, "PLI") ХӨНДӨГДӨХГҮЙ;
  · хос үсэггүй латин үсэг (f, g, q …) орсон үг ХӨНДӨГДӨХГҮЙ — тэр нь
    санаатай латин бичиглэл байж болох тул таамаглахгүй.
  ⚠ Татах мөчид хийгдэнэ — диаграм, шүүлтүүр, бичлэгийн цонх нэг
  хэлбэр харуулна (`foldSpelling`-тэй ижил).
  ⚠ Хөгжүүлэлтийн үед засагдсан утга бүр консолд бичигдэнэ — аль
  давхаргын аль талбарт холилдсон бичиглэл байсныг шалгахад.
*/
const LOOKALIKE: Record<string, string> = {
  A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У",
  a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", k: "к",
};

function fixScript(text: string): string {
  return text.replace(/[\p{L}]+/gu, (word) => {
    if (!/\p{Script=Cyrillic}/u.test(word) || !/[A-Za-z]/.test(word)) return word;
    const latin = word.match(/[A-Za-z]/g) ?? [];
    if (!latin.every((ch) => ch in LOOKALIKE)) return word;
    return word.replace(/[A-Za-z]/g, (ch) => LOOKALIKE[ch]);
  });
}

function foldScript(rows: Record<number, Row>, info: LayerInfo) {
  for (const f of info.fields) {
    if (f.type !== "String") continue;
    const fixed = new Map<string, string>();
    for (const row of Object.values(rows)) {
      const v = row[f.name];
      if (typeof v !== "string") continue;
      const t = fixScript(v);
      if (t === v) continue;
      row[f.name] = t;
      fixed.set(v, t);
    }
    if (fixed.size && process.env.NODE_ENV !== "production") {
      console.info(`[foldScript] ${info.id} · ${f.alias || f.name}:`, [...fixed].map(([a, b]) => `${a} → ${b}`));
    }
  }
}

/**
 * БИЧИГЛЭЛИЙН ХУВИЛБАРЫГ НЭГТГЭНЭ — зөвхөн ҮСГИЙН ТОМ, ЖИЖГЭЭР.
 *
 * Намгархаг газрын `газар_ашиглалтын_мэдээлэл` дээр "айлтай" (20) ба
 * "Айлтай" (7), "айл суурьшсан" (21) ба "Айл суурьшсан" нь тусдаа
 * ангилал болж, дөрвөн бодит утга ДОЛООН зурвас болж байв.
 *
 * ⚠ ЗӨВХӨН ТАТАХ МӨЧИД: диаграм, шүүлтүүр, бичлэгийн дэлгэрэнгүй
 * гурвуулаа НЭГ утгыг харна. Зөвхөн дэлгэц дээр нэгтгэвэл товшиход
 * шүүлтийн түлхүүр зөрж, үр дүн хоосон гарна.
 * ⚠ КАНОНИК хэлбэр нь ХАМГИЙН ОЛОН ДАХИН тохиолдсон бичиглэл —
 * цөөнхийн алдаа олонхыг дарж бичихгүй.
 * ⚠ ТОМ ҮСГЭЭР эхэлсэн эсэхээр биш ТООГООР шийднэ: эх сурвалж
 * аль хэлбэрийг зөв гэж үзэж байгааг давтамж нь хэлнэ.
 * ⚠ Зөвхөн үсгийн хэлбэр ялгаатай утгуудыг нэгтгэнэ. "Байнгын" ба
 * "Байнгын урсацтай" нь ӨӨР бичиглэл бөгөөд аль нь алийг товчилсон
 * нь ТААМАГ тул ХӨНДӨХГҮЙ — эх сурвалжийн эзэн шийднэ (`values`).
 */
/** Компанийн нэрийн сул түлхүүр ({@link LayerSet.foldLoose}) */
function looseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/["'«»“”„]/g, "")
    /* Кирилл дээр `\b` ажилладаггүй — араас нь үсэг ирэхгүй "ххк" */
    .replace(/х+к(?![а-яөү])|x+k(?![a-z])/g, "")
    .replace(/\s+/g, "")
    .replace(/(.)\1+/g, "$1");
}

function foldSpelling(rows: Record<number, Row>, info: LayerInfo) {
  const list = Object.values(rows);
  if (list.length < 2) return;
  for (const f of info.fields) {
    if (f.type !== "String") continue;
    /* Бичиглэл бүрийн давтамж */
    const seen = new Map<string, number>();
    for (const row of list) {
      const v = row[f.name];
      if (typeof v !== "string") continue;
      const t = v.replace(/\s+/g, " ").trim();
      if (!t) continue;
      seen.set(t, (seen.get(t) ?? 0) + 1);
    }
    /* Жижиг үсгийн хэлбэр → хамгийн түгээмэл бичиглэл. Бүртгэл заасан
       талбарт СУЛ түлхүүр ({@link LayerSet.foldLoose}) */
    const loose = info.set.foldLoose?.[info.id]?.test(f.name);
    const keyOf = loose ? looseKey : (t: string) => t.toLowerCase();
    const canon = new Map<string, string>();
    const best = new Map<string, number>();
    for (const [text, n] of seen) {
      const k = keyOf(text);
      if (n > (best.get(k) ?? 0)) {
        best.set(k, n);
        canon.set(k, text);
      }
    }
    /* Нэгтгэх зүйл байхгүй бол мөрүүдийг хөндөхгүй */
    if (canon.size === seen.size) continue;
    for (const row of list) {
      const v = row[f.name];
      if (typeof v !== "string") continue;
      const t = v.replace(/\s+/g, " ").trim();
      const hit = t && canon.get(keyOf(t));
      if (hit && hit !== v) row[f.name] = hit;
    }
  }
}

async function loadLayerShapes(info: LayerInfo): Promise<GeoJSON.Feature[]> {
  const oid = info.objectIdField;
  const shapes: GeoJSON.Feature[] = [];
  /* Эвдэрсэн орой ({@link clipToRegion}) — нэг ч орой дэлхийн нөгөө
     буланд байвал дүрс бүх зургийг хучдаг */
  let bad = 0;
  let lost = 0;
  for (const f of await pagesOf(info, {
    outFields: oid,
    maxAllowableOffset: String(OFFSET),
    geometryPrecision: "5",
  })) {
    const uid = Number(f.properties?.[oid] ?? f.id);
    if (!Number.isFinite(uid) || !f.geometry) continue;
    const { geometry, dropped } = clipToRegion(f.geometry);
    if (dropped) bad++;
    if (!geometry) {
      lost++;
      continue;
    }
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` шаардлагатай */
      id: uid,
      properties: { oid: uid },
      geometry,
    });
  }
  if (bad)
    console.warn(
      `${info.name}: ${bad} дүрсийн солбицол Монголын мужаас гадуур — ` +
        `тэдгээр оройг хассан${lost ? `, ${lost} дүрс зурагт ороогүй` : ""}`,
    );
  return shapes;
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
  if (signal.aborted)
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() =>
      signal.removeEventListener("abort", onAbort),
    );
  });
}

function memo<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  let p = cache.get(key);
  if (!p) {
    p = load();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export function fetchLayerInfo(
  set: LayerSet,
  id: string,
  signal?: AbortSignal,
): Promise<LayerInfo> {
  const union = set.unions?.[id];
  if (union)
    return abortable(
      memo(infoCache, `union:${set.key}:${id}`, () =>
        loadUnionInfo(set, id, union),
      ),
      signal,
    );
  return abortable(
    memo(infoCache, layerKey(set, id), () => loadLayerInfo(set, id)),
    signal,
  );
}

/** Нэгтгэсэн давхаргын эх давхаргууд — {@link fetchLayerFeatures} эндээс уншина */
const unionParts = new WeakMap<LayerInfo, LayerInfo[]>();

async function loadUnionInfo(
  set: LayerSet,
  id: string,
  union: LayerUnion,
): Promise<LayerInfo> {
  const parts = await Promise.all(
    union.parts.map((p) => fetchLayerInfo(set, p.layer)),
  );
  const info: LayerInfo = {
    id,
    set,
    name: set.names[id] ?? id,
    geometry: parts[0]?.geometry ?? "Point",
    layerId: 0,
    objectIdField: "objectid",
    areaField: null,
    areaInHa: false,
    count: parts.reduce((n, p) => n + p.count, 0),
    pageSize: Math.min(...parts.map((p) => p.pageSize)),
    fields: union.fields.map(({ name, alias, type }) => ({ name, alias, type })),
  };
  unionParts.set(info, parts);
  return info;
}

/** Нэг давхаргын атрибут, геометр — хоёр үе шат тус тусдаа кэштэй */
function stagesOf(info: LayerInfo) {
  const key = `${layerKey(info.set, info.id)}/${info.layerId}`;
  return {
    rows: memo(rowsCache, key, () => loadLayerRows(info)),
    shapes: memo(shapesCache, key, () => loadLayerShapes(info)),
  };
}

/** Эх давхаргын талбарыг нэр эсвэл alias-аар нь хайгч */
function getter(fields: readonly LayerField[]) {
  const cache = new Map<RegExp, string[]>();
  return (row: Row) => (re: RegExp) => {
    let names = cache.get(re);
    if (!names) {
      names = fields
        .filter((f) => re.test(f.name) || re.test(f.alias))
        .map((f) => f.name);
      cache.set(re, names);
    }
    for (const n of names) {
      const v = row[n];
      if (v != null && !(typeof v === "string" && !v.trim())) return v;
    }
    return null;
  };
}

/** Нэгтгэсэн давхаргын хоёр үе шат — эх бүрийг өөрийн кэшээр татна */
const unionCache = new WeakMap<
  LayerInfo,
  { rows: Promise<LayerRows>; shapes: Promise<GeoJSON.Feature[]> }
>();

function unionStages(info: LayerInfo, parts: LayerInfo[]) {
  let hit = unionCache.get(info);
  if (!hit) {
    hit = mergeStages(info, parts);
    unionCache.set(info, hit);
    hit.rows.catch(() => unionCache.delete(info));
    hit.shapes.catch(() => unionCache.delete(info));
  }
  return hit;
}

function mergeStages(info: LayerInfo, parts: LayerInfo[]) {
  const union = info.set.unions![info.id];
  const rows = Promise.all(parts.map((p) => stagesOf(p).rows)).then(
    (all): LayerRows => {
      const out: Record<number, Row> = {};
      all.forEach((r, k) => {
        const part = union.parts[k];
        const get = getter(parts[k].fields);
        for (const [oid, row] of Object.entries(r.rows)) {
          const uid = k * UNION_STRIDE + Number(oid);
          const g = get(row);
          const next: Row = { objectid: uid };
          for (const f of union.fields)
            next[f.name] = f.pick(g, part, row, parts[k].fields) ?? null;
          out[uid] = next;
        }
      });
      return { rows: out, area: {} };
    },
  );
  const shapes = Promise.all(parts.map((p) => stagesOf(p).shapes)).then(
    (all) =>
      all.flatMap((list, k) =>
        list.map((f) => {
          const uid = k * UNION_STRIDE + Number(f.id);
          return { ...f, id: uid, properties: { oid: uid } };
        }),
      ),
  );
  return { rows, shapes };
}

const NO_SHAPES: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

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
  const parts = unionParts.get(info);
  const { rows, shapes } = parts ? unionStages(info, parts) : stagesOf(info);
  if (onRows) {
    void rows.then(
      (r) => {
        if (!signal?.aborted) onRows({ id: info.id, shapes: NO_SHAPES, ...r });
      },
      () => undefined,
    );
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

/**
 * Давхарга сав газраараа (тэргүүлэх ангиллаараа) бүс болж хуваагдах эсэх
 * ({@link LayerSet.splitZones}) — `true` бол цэсийн бүх давхарга, жагсаалт
 * бол зөвхөн тэд (хамгаалалтын бүс + голын татам нэг цэст, 2026-10-23).
 */
export function splitsZones(set: LayerSet, id: string): boolean {
  return Array.isArray(set.splitZones)
    ? set.splitZones.includes(id)
    : Boolean(set.splitZones);
}
