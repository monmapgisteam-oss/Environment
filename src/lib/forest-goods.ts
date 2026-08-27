/**
 * Ойн хэлтэс — ногоон бүс ба ойн дагалт баялгийн тархалт.
 *
 * Эх сурвалж: `Богд_уулын_ойн_дагалт_баялгийн_тархалт` FeatureServer,
 * 32,755 олон өнцөгт.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ НЭГ ДАВХАРГАД ХОЁР ӨӨР БҮРТГЭЛ                                   │
 * └──────────────────────────────────────────────────────────────────┘
 * `Name` талбарын 42 утга нь ХОЁР төрлийн зүйлийг агуулна — үйлчилгээний
 * нэр өөрөө үүнийг хэлж байна ("...ногоон бүс БА ...ойн дагалт баялгийн
 * тархалт"):
 *
 * 1. ОЙН ДАГАЛТ БААЛГИЙН ЗҮЙЛ — мөөг, жимс, мод. Латин нэртэй
 *    ("Ойн далбига – Agaricus sylvaticus") эсвэл монгол нэртэй
 *    ("Хус мод", "Хушны самар").
 * 2. НОГООН БҮСИЙН ХЭСЭГ — тоон угтвартай нэр ("01_Ар гүнтийн ам",
 *    "24_Зүүн салаа"). Эдгээр нь зүйл БИШ, нэрлэсэн газар нутаг.
 *
 * Хоёуланг нь нэг жагсаалтад хольж харуулбал "Ар гүнтийн ам" гэсэн
 * мөөг байгаа мэт уншигдана. Тиймээс `kind`-ээр салгана.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ ГЕОМЕТР ДАВХАРДДАГ                                               │
 * └──────────────────────────────────────────────────────────────────┘
 * 32,755 бичлэгт ердөө 6,908 өөр талбай байна: нэг талбай дээр олон
 * зүйл бүртгэгдсэн тул тэр талбай зүйл бүрд давтагдана. Зарим зүйл ЯГ
 * ижил тархалттай (жишээ нь Ойн далбига, Хэврэг чидмэг, Юүлүүр
 * ташуумаг гурав нь адилхан 5,979 талбай эзэлнэ) — тэдгээрийг сонгоход
 * газрын зураг ижил харагдана. Энэ бол алдаа биш, датаны шинж.
 *
 * Тиймээс "нийт талбай" гэж бүх бичлэгийг нийлбэл 7,270 км² гарна —
 * бодит хамрах талбайгаас хэд дахин их. Талбайг ЗҮЙЛ ТУС БҮРЭЭР л
 * нийлбэрлэнэ.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = encodeURIComponent("Богд_уулын_ойн_дагалт_баялгийн_тархалт");
const PAGE = 2000;
/** ~50 метрийн ерөнхийлөлт (градусаар) — тархалтын хүрээ нь өөрөө ойролцоо */
const OFFSET = 0.0005;

export const FOREST_GOODS_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

export type GoodsKind = "species" | "zone";

export type GoodsEntry = {
  /** Эх сурвалжийн `Name` — шүүхэд ашиглана */
  name: string;
  kind: GoodsKind;
  /** Монгол нэр (латин хэсгийг тусад нь салгасан) */
  label: string;
  /** Латин нэр — зөвхөн зүйлд */
  latin: string;
  /** Хэдэн олон өнцөгтөд бүртгэгдсэн */
  n: number;
  /** Нийт талбай, га */
  ha: number;
};

/**
 * Ногоон бүсийн хэсгийн нэр нь ТООН УГТВАРТАЙ ("01_Ар гүнтийн ам").
 * Зүйлийн нэр хэзээ ч ингэж эхлэхгүй тул энэ нь найдвартай шалгуур.
 */
const ZONE_RE = /^\d{2}_/;

/** "Ойн далбига – Agaricus sylvaticus" → монгол ба латин хэсэг */
function split(name: string): { label: string; latin: string } {
  /* Эх сурвалж урт зураас (–) хэрэглэсэн. Богино зураастай нэр
     ("Хусны үйс, хусны шүүс") задрахгүй байх ёстой тул зөвхөн
     урт зураасаар таслав. */
  const i = name.indexOf("–");
  if (i < 0) return { label: name.trim(), latin: "" };
  return { label: name.slice(0, i).trim(), latin: name.slice(i + 1).trim() };
}

export function kindOf(name: string): GoodsKind {
  return ZONE_RE.test(name) ? "zone" : "species";
}

/** "01_Ар гүнтийн ам" → "Ар гүнтийн ам" */
export function zoneLabel(name: string) {
  return name.replace(ZONE_RE, "").trim();
}

/* --------------------------------------------------------------------------
   Жагсаалт — СЕРВЕРТ нэгтгэнэ

   32 мянган бичлэгийг татаж хөтөч дээр тоолохын оронд ArcGIS-ийн
   бүлэглэлтийг ашиглана: нэг хүсэлт, хэдхэн килобайт.
   -------------------------------------------------------------------------- */

export async function fetchGoodsIndex(signal?: AbortSignal): Promise<GoodsEntry[]> {
  const url =
    `${FOREST_GOODS_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      groupByFieldsForStatistics: "Name",
      outStatistics: JSON.stringify([
        { statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "n" },
        { statisticType: "sum", onStatisticField: "Shape__Area", outStatisticFieldName: "a" },
      ]),
      orderByFields: "a DESC",
      f: "json",
    });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Дагалт баялгийн жагсаалт татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { attributes: { Name: string; n: number; a: number } }[];
  };

  return (json.features ?? []).map((f) => {
    const name = (f.attributes.Name ?? "").trim();
    const kind = kindOf(name);
    const { label, latin } = split(name);
    return {
      name,
      kind,
      label: kind === "zone" ? zoneLabel(name) : label,
      latin,
      n: f.attributes.n,
      ha: f.attributes.a / 10_000,
    };
  });
}

/* --------------------------------------------------------------------------
   Нэг нэрийн олон өнцөгтүүд — сонгосон үед л татна
   -------------------------------------------------------------------------- */

type Feature = {
  type: "Feature";
  properties: { OBJECTID: number };
  geometry: GeoJSON.Geometry | null;
};

async function page(name: string, offset: number, signal?: AbortSignal) {
  const url =
    `${FOREST_GOODS_SERVICE}/query?` +
    new URLSearchParams({
      /* Нэрэнд хашилт байхгүй (шалгасан) тул шууд орлуулж болно;
         аюулгүйн үүднээс давхар хашилтыг хоёрдуулав */
      where: `Name='${name.replace(/'/g, "''")}'`,
      outFields: "OBJECTID",
      outSR: "4326",
      geometryPrecision: "5",
      maxAllowableOffset: String(OFFSET),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "OBJECTID",
      f: "geojson",
    });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Тархалт татагдсангүй (${res.status})`);
  const json = (await res.json()) as { features?: Feature[] };
  return json.features ?? [];
}

export async function fetchGoodsShapes(
  entry: GoodsEntry,
  signal?: AbortSignal,
): Promise<GeoJSON.FeatureCollection> {
  /* Хуудасны тоог урьдчилан мэднэ (жагсаалтад бичлэгийн тоо бий) тул
     бүгдийг ЗЭРЭГ татна */
  const pages = Math.ceil(entry.n / PAGE);
  const all = await Promise.all(
    Array.from({ length: pages }, (_, i) => page(entry.name, i * PAGE, signal)),
  );

  const features: GeoJSON.Feature[] = [];
  for (const f of all.flat()) {
    if (!f.geometry) continue;
    const oid = Number(f.properties.OBJECTID);
    features.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` ЗААВАЛ */
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }
  return { type: "FeatureCollection", features };
}

/* --------------------------------------------------------------------------
   Нэг олон өнцөгтийн дэлгэрэнгүй

   Эх сурвалжийн бодит талбарууд (хэсэглэл, ялгарал, ойн ангилал, бүс,
   мөөгний нэр, модны төрөл) нь БҮГД `PopupInfo` доторх HTML хүснэгтэд
   шигтгэгдсэн байдаг. Бичлэг тутамд ~800 байт тул бүх 32 мянгыг татах
   нь 26MB болно — сонгосон нэгийг нь л татаж задална.
   -------------------------------------------------------------------------- */

export type GoodsDetail = Record<string, string>;

/** `PopupInfo`-гийн HTML хүснэгтийг нэр→утга болгож задлана */
export function parsePopup(html: string): GoodsDetail {
  const out: GoodsDetail = {};
  /* <td><b>Нэр</b></td><td>утга</td> хэлбэрийн хос бүрийг авна.
     DOMParser хэрэглэхгүй: сервер талд ажиллах шаардлагагүй ч
     энгийн бүтэц дээр илэрхийлэл найдвартай бөгөөд хямд. */
  const re = /<td><b>([^<]*)<\/b><\/td>\s*<td>([^<]*)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const k = m[1].trim();
    const v = m[2].trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export async function fetchGoodsDetail(
  oid: number,
  signal?: AbortSignal,
): Promise<GoodsDetail | null> {
  const url =
    `${FOREST_GOODS_SERVICE}/query?` +
    new URLSearchParams({
      where: `OBJECTID=${Number(oid)}`,
      outFields: "OBJECTID,Name,PopupInfo",
      returnGeometry: "false",
      f: "json",
    });
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    features?: { attributes: { PopupInfo?: string | null } }[];
  };
  const html = json.features?.[0]?.attributes?.PopupInfo;
  return html ? parsePopup(html) : null;
}
