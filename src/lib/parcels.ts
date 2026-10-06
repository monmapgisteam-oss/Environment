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
export const PARCEL_SCALE = 90_000;

/*
  ⚠⚠ 1:13 000 → 1:90 000 (хэрэглэгч, 2026-10-06: "90 000-с харагддаг
  болгоё"). Энэ харьцаанд харагдах хүрээ ~50 дахин том тул доорх
  татац ХОЁР зүйлээр өөрчлөгдсөн:
  1. ТООГ ЭХЛЭЭД асууж, хуудсуудыг ЗЭРЭГ гуйна (`CAP` 24 мянга).
  2. Ерөнхийлөлт нь ОЙРТОЛТООС хамаарна (`offsetFor`): 1:90 000-д нэг
     пиксел ~24 м тул 2 м-ийн нарийвчлалаар татах нь дэмий жин.
  ⚠ Хязгаараас ОЛОН бол ОГТ ЗУРАХГҮЙ (`total > CAP`), "ойртуулна уу"
  гэж тоогоор нь хэлнэ — хуудаслалт эрэмбэгүй тул тасарсан хэсэгчилсэн
  тор нь санамсаргүй цэгүүд мэт харагддаг. Хотын нягт хороололд
  (2 км-т 822, 4 км-т 5,061) 1:90 000-ийн харагдац энэ хязгаарыг давж
  магадгүй; хот гадуур, голын татмын бүсэд багтана.
*/

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
const CAP = 12 * PAGE;

export type ParcelTile = {
  data: GeoJSON.FeatureCollection;
  /** Хязгаарт хүрсэн эсэх — харагдаж буй нь бүгд БИШ */
  capped: boolean;
  /** Хүрээнд байгаа нийт тоо — хязгаараас олон үед "ойртуулна уу" */
  total?: number;
};

/**
 * ОЙРТОЛТОД ТОХИРСОН ЕРӨНХИЙЛӨЛТ, градусаар — хагас пиксел.
 * Web Mercator-ын пикселийн хэмжээ (м) = 156 543 × cos(өргөрөг) / 2^z.
 */
function offsetFor(zoom: number, lat: number): string {
  const m = (156_543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  /* 2 м-ээс нарийн нь хэрэггүй, хагас пикселээс бүдүүн нь хэлбэрийг
     эвдэнэ */
  const meters = Math.max(2, m * 0.5);
  return (meters / 111_320).toFixed(6);
}

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
  zoom = 14,
): Promise<ParcelTile> {
  const [w, s, e, n] = bounds;
  const base = () =>
    new URLSearchParams({
      geometry: `${w},${s},${e},${n}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      where: "1=1",
    });

  /* Хэдэн нэгж талбар байгааг ЭХЛЭЭД — хязгаараас олон бол татахгүй */
  const head = base();
  head.set("returnCountOnly", "true");
  head.set("f", "json");
  const total =
    (
      await arcgisJson<{ count?: number }>(
        `${SERVICE}/query?${head}`,
        "Нэгж талбар",
        { signal },
      )
    ).count ?? 0;
  if (!total) return { ...EMPTY, total: 0 };
  if (total > CAP) return { ...EMPTY, capped: true, total };

  const pages: Promise<GeoJSON.Feature[]>[] = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    const q = base();
    /*
      ⚠ ЗӨВХӨН ДУГААР. Нэмэлт давхарга (`overlays`) нь ХАРИЛЦДАГГҮЙ
      тул атрибут нь дэлгэц дээр гарах газаргүй (хэмжсэн: дугаар
      ганцаараа 515 КБ, бүх талбартай нь 830 КБ).
    */
    q.set("outFields", "objectid");
    q.set("outSR", "4326");
    q.set("maxAllowableOffset", offsetFor(zoom, (s + n) / 2));
    q.set("geometryPrecision", "6");
    q.set("resultRecordCount", String(PAGE));
    q.set("resultOffset", String(offset));
    q.set("f", "geojson");
    pages.push(
      arcgisJson<{ features?: GeoJSON.Feature[] }>(
        `${SERVICE}/query?${q}`,
        "Нэгж талбар",
        { signal },
      ).then((j) => j.features ?? []),
    );
  }
  const got = await Promise.all(pages);
  return {
    data: { type: "FeatureCollection", features: got.flat() },
    capped: false,
    total,
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
  const body = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
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

export async function fetchParcelsOn(
  rings: GeoJSON.Position[][],
  signal?: AbortSignal,
  /** Атрибутын нөхцөл — диаграмаас сонгосон ангилал ({@link parcelWhere}) */
  where = "1=1",
): Promise<ParcelTile> {
  if (!rings.length) return EMPTY;
  const shape = JSON.stringify({ rings, spatialReference: { wkid: 4326 } });
  const base = () => {
    const b = new URLSearchParams({
      where,
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
  const total = (
    await arcgisJson<{ count?: number }>(`${SERVICE}/query`, "Нэгж талбар", {
      method: "POST",
      body: head,
      signal,
    })
  ).count ?? 0;
  if (!total) return EMPTY;

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
  const got = await Promise.all(pages);
  return {
    data: { type: "FeatureCollection", features: got.flat() },
    capped: total > CAP_ON,
  };
}

/* --------------------------------------------------------------------------
   БҮСЭД ДАВХЦАХ НЭГЖ ТАЛБАРЫН ЗАДАРГАА (хэрэглэгч, 2026-10-06:
   хамгаалалтын бүсийн картын "доор нэгж талбарын чартыг гарга")

   ⚠⚠ ТООЛОЛТ СЕРВЕР ДЭЭР (`outStatistics` + `groupByFieldsForStatistics`).
   Тэжээгдлийн мужид 17 мянга гаруй нэгж талбар давхцдаг — атрибутыг нь
   хөтөч рүү татаж тоолох нь {@link fetchParcelsOn}-ийн арван долоон
   хуудас болно. Статистикийн асуулга нь бүлэг тус бүрд НЭГ мөр
   буцаана.

   ⚠ Дээрх файлын толгойн "диаграм гаргахгүй" гэсэн шийдвэр нь
   ХАРАГДАХ ХҮРЭЭНИЙ түүвэр дээр тоолохоос сэргийлсэн: тэр тоо нь
   "нийслэлийн задаргаа" гэж эндүүрэгдэнэ. Энэ нь харин БҮСИЙН
   ГЕОМЕТРЭЭР тодорхойлогдсон бүтэн олонлог — асуулт нь "энэ бүсэд
   ямар газар орсон бэ" тул түүвэр биш.
   -------------------------------------------------------------------------- */

/** Нэгж талбарыг задлах тэнхлэг — эх сурвалжийн талбар */
export type ParcelAxis = { field: string; label: string };

/**
 * ТЭНХЛЭГҮҮДИЙГ ДАВХАРГЫН ТОДОРХОЙЛОЛТООС уншина — талбарын нэрийг
 * ТААМАГЛАХГҮЙ. ArcGIS Online дээрх хуучин хувилбар нь `landuse_de`,
 * `rigth_type` (эх сурвалжийн бичилт) гэж нэрлэдэг байсан ч порталд
 * шилжихэд талбарын нэрс жижиг үсэг болж өөрчлөгдсөн туршлагатай
 * (хүрээлэн буй орчны нүүлгэлт) тул нэр ба alias хоёулангаар нь таана.
 * ⚠ Олдоогүй тэнхлэг нь зүгээр л гарахгүй — хоосон диаграм зурахгүй.
 */
const AXES: { label: string; name: RegExp; alias: RegExp }[] = [
  {
    label: "Газрын зориулалт",
    name: /^landuse_?de(sc)?$/i,
    alias: /зориулалт/i,
  },
  {
    label: "Эрхийн хэлбэр",
    name: /^ri?g?h?t_?type$|^rigth_type$/i,
    alias: /эрхийн/i,
  },
];

let axesOnce: Promise<ParcelAxis[]> | null = null;

export function parcelAxes(): Promise<ParcelAxis[]> {
  axesOnce ??= arcgisJson<{
    fields?: { name: string; alias?: string; type: string }[];
  }>(`${SERVICE}?f=json`, "Нэгж талбарын тодорхойлолт")
    .then((info) => {
      const text = (info.fields ?? []).filter(
        (f) => f.type === "esriFieldTypeString",
      );
      const out: ParcelAxis[] = [];
      for (const a of AXES) {
        const f =
          text.find((x) => a.name.test(x.name)) ??
          text.find((x) => a.alias.test(x.alias ?? ""));
        if (f) out.push({ field: f.name, label: a.label });
      }
      return out;
    })
    .catch((e) => {
      /* Унасан амлалтыг кэшид үлдээхгүй — дараагийн удаа дахин оролдоно */
      axesOnce = null;
      throw e;
    });
  return axesOnce;
}

export type ParcelCount = {
  key: string;
  label: string;
  value: number;
  /**
   * Энэ мөрд нийлсэн ЭХ утгууд — шүүлтийн нөхцөл угсрахад
   * ({@link parcelWhere}). Бичиглэлийн зөрүүтэй ("Эзэмших" / "эзэмших ")
   * утгууд нэг мөр болдог тул нөхцөл нь бүгдийг нь агуулах ёстой —
   * эс тэгвээс диаграмын тоо ба зураг дээрх нэгж талбар зөрнө.
   * `null` нь хоосон / бөглөгдөөгүй.
   */
  raws: (string | null)[];
};

/**
 * ДИАГРАМЫН МӨРИЙН ШҮҮЛТ — SQL нөхцөл (хэрэглэгч, 2026-10-06: "нэгж
 * талбарын чартнаас шүүгддэг болгоё").
 *
 * ⚠ Утга нь ЭХ хэлбэрээрээ (зай, том жижиг үсэг хадгалсан) — сервер
 * дээр тэнцүүгээр харьцуулна.
 * ⚠ Хоосон нь `IS NULL OR = ''` — "Бүртгэгдээгүй" мөр хоёуланг агуулдаг.
 * ⚠ Ганц хашилтыг хоёрчилно — талбарын утга нь чөлөөт бичвэр.
 */
export function parcelWhere(field: string, raws: (string | null)[]): string {
  const text = raws.filter((r): r is string => r != null && r !== "");
  const parts: string[] = [];
  if (text.length)
    parts.push(
      `${field} IN (${text.map((r) => `'${r.replace(/'/g, "''")}'`).join(",")})`,
    );
  if (raws.some((r) => r == null || r === ""))
    parts.push(`(${field} IS NULL OR ${field} = '')`);
  return parts.length ? parts.join(" OR ") : "1=0";
}

const counts = new Map<string, Promise<ParcelCount[]>>();

/**
 * Бүсийн ДОТОРХ (огтлолцох) нэгж талбарыг `field`-ээр бүлэглэн тоолно.
 *
 * @param zone Кэшийн түлхүүр — бүсийн давхаргын нэр. Геометр нь нэг
 *   сессийн дотор өөрчлөгдөхгүй тул давхаргаар түлхүүрлэхэд хангалттай.
 *
 * ⚠ Хоосон утга нь "Бүртгэгдээгүй" гэсэн ИЛ мөр — хасахгүй, эс тэгвээс
 * нийлбэр нь бүсийн картын нэгж талбарын тооноос зөрнө.
 * ⚠ Кэш нь АМЛАЛТЫГ барина (`portal-layers`-тэй нэг зарчим): бүс
 * сэлгэж буцахад дахин асуухгүй. Цуцлах дохио АВАХГҮЙ — эхэлсэн
 * асуулга дуусаад кэшид суух нь хэрэглэгчийн буцаж ирэхэд хэрэгтэй.
 */
export function parcelCountsIn(
  zone: string,
  rings: GeoJSON.Position[][],
  field: string,
): Promise<ParcelCount[]> {
  const key = `${zone}\u0000${field}`;
  const hit = counts.get(key);
  if (hit) return hit;

  const body = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    groupByFieldsForStatistics: field,
    outStatistics: JSON.stringify([
      {
        statisticType: "count",
        onStatisticField: "objectid",
        outStatisticFieldName: "n",
      },
    ]),
    returnGeometry: "false",
    f: "json",
  });

  const p = arcgisJson<{
    features?: { attributes: Record<string, unknown> }[];
  }>(`${SERVICE}/query`, "Нэгж талбарын задаргаа", { method: "POST", body })
    .then((json) => {
      /* Бичиглэлийн зөрүүг ("Эзэмших" / "эзэмших ") нэгтгэнэ — эс
         тэгвээс нэг ангилал хоёр мөр болно */
      const by = new Map<string, ParcelCount>();
      for (const { attributes: a } of json.features ?? []) {
        const original = a[field] == null ? null : String(a[field]);
        const raw = (original ?? "").trim();
        const label = raw
          ? raw.charAt(0).toLocaleUpperCase("mn") + raw.slice(1)
          : "Бүртгэгдээгүй";
        const k = label.toLocaleLowerCase("mn");
        const n = Number(a.n ?? a.N ?? 0);
        const got = by.get(k);
        if (got) {
          got.value += n;
          got.raws.push(original);
        } else by.set(k, { key: k, label, value: n, raws: [original] });
      }
      return [...by.values()].sort((x, y) => y.value - x.value);
    })
    .catch((e) => {
      counts.delete(key);
      throw e;
    });
  counts.set(key, p);
  return p;
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
