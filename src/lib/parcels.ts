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
): Promise<ParcelTile> {
  if (!rings.length) return EMPTY;
  const shape = JSON.stringify({ rings, spatialReference: { wkid: 4326 } });
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
