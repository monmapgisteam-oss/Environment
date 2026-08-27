/**
 * Ойн хэлтэс — тусгай хамгаалалттай газрын хоёр давхарга.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ ХОЁУЛАА GOOGLE EARTH-ЭЭС ХӨРВҮҮЛСЭН                              │
 * └──────────────────────────────────────────────────────────────────┘
 * `FolderPath`, `SymbolID`, `AltMode`, `Snippet`, `PopupInfo` зэрэг
 * талбарууд нь KML-ийн үлдэц. Үүнээс гарах ХОЁР үр дагавар:
 *
 * 1. ЦЭГ, ШУГАМ нь тусдаа обьект БИШ. Тэдгээрийн `Name` нь "1", "2",
 *    "3"… эсвэл "Untitled Path" — өөрөөр хэлбэл Google Earth дээр
 *    зурахад үүссэн булангийн тэмдэглэгээ, зурсан зам. Тиймээс
 *    "626 хамгаалалттай цэг" гэж тоолж БОЛОХГҮЙ.
 * 2. Утга нь `FolderPath` дотор шигтгэгдсэн: хамгаалалтын нэр,
 *    тогтоолын дугаар, огноо бүгд фолдерын нэрэнд бичигдсэн
 *    ("Баянхошуу уул СХД ИТХТ 10/10 тогтоол 2015-12-10"). Үүнийг
 *    ЗАДЛАХГҮЙ — тогтоолын дугаарын бичлэг нэгдмэл бус ("ИТХТ 10/10",
 *    "ИТХТ 7Б-6/05", "НИТХТ-73") тул задлах нь таамаглал болно. Замыг
 *    байгаагаар нь, сонгосон бичлэгийн дэлгэрэнгүйд харуулна.
 *
 * `DUUREG`, `KHOROOID` нь орон зайн нэгтгэлээс ирдэг тул цэвэр —
 * газарзүйн задаргаанд тэднийг л хэрэглэнэ.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";

export const PROTECTED_MAPPING_SERVICE = `${HOST}/Tusgai_hamgaalalt/FeatureServer`;
export const PROTECTED_OFFICIAL_SERVICE = `${HOST}/gazar_alban_protctd_area/FeatureServer`;

/** ~10 метрийн ерөнхийлөлт (градусаар) */
const OFFSET = 0.0001;

export type Shape = {
  oid: number;
  /** Эх сурвалжийн `Name` — ихэвчлэн утгагүй ("Placemark", "1") */
  name: string;
  /** Бүтэн зам — дэлгэрэнгүйд бүтнээрээ гарна */
  path: string;
  district: string;
  khoroo: number | null;
  /** Талбай га (олон өнцөгт) эсвэл урт км (шугам). Цэгт 0 */
  size: number;
};

export type ShapeSet = {
  rows: Shape[];
  shapes: GeoJSON.FeatureCollection;
};

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

type Feature = {
  type: "Feature";
  properties: {
    OBJECTID: number;
    Name?: string | null;
    FolderPath?: string | null;
    DUUREG?: string | null;
    KHOROOID?: number | null;
    Shape__Area?: number | null;
    Shape__Length?: number | null;
  };
  geometry: GeoJSON.Geometry | null;
};

/**
 * Нэг давхаргыг татна.
 *
 * Бүх давхарга 2,000-аас цөөн бичлэгтэй (хамгийн их нь 626) тул
 * хуудаслах шаардлагагүй.
 */
export async function fetchLayer(
  service: string,
  layer: number,
  signal?: AbortSignal,
): Promise<ShapeSet> {
  const url =
    `${service}/${layer}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,Name,FolderPath,DUUREG,KHOROOID,Shape__Area,Shape__Length",
      outSR: "4326",
      geometryPrecision: "5",
      maxAllowableOffset: String(OFFSET),
      orderByFields: "OBJECTID",
      f: "geojson",
    });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Хамгаалалтын давхарга татагдсангүй (${res.status})`);
  const json = (await res.json()) as { features?: Feature[] };

  const rows: Shape[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    const path = str(p.FolderPath);
    /* Талбайт бол га, шугам бол км. Хоёулаа байхгүй бол цэг. */
    const size = p.Shape__Area
      ? p.Shape__Area / 10_000
      : p.Shape__Length
        ? p.Shape__Length / 1000
        : 0;

    rows.push({
      oid,
      name: str(p.Name),
      path,
      district: str(p.DUUREG) || "Тодорхойгүй",
      khoroo: p.KHOROOID ?? null,
      size,
    });

    if (!f.geometry) continue;
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` ЗААВАЛ */
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  rows.sort((a, b) => b.size - a.size);
  return { rows, shapes: { type: "FeatureCollection", features: shapes } };
}

/* --------------------------------------------------------------------------
   ДӨРВӨН ДАВХАРГА, НЭГ САМБАР

   Хоёр үйлчилгээ нь ижил бүтэцтэй бөгөөд хоёулаа "тусгай хамгаалалт"
   гэж нэрлэгддэг тул тусдаа самбар болгосон нь хэрэглэгчийг
   андуурууллаа. Оронд нь НЭГ самбарт дөрвөн давхаргыг хавтгайгаар
   сонгуулна:

     Албан бүртгэл  56 нэрлэсэн талбай — жинхэнэ бүртгэл
     Зураглал·талбай 17 хаалттай олон өнцөгт
     Зураглал·шугам 204 зурвас, 529 км — ХААГДААГҮЙ хил
     Зураглал·цэг   626 булангийн тэмдэглэгээ

   Гурав нь өөр нэгжтэй (га / км / ширхэг) тул нэг дор нийлбэрлэхгүй:
   индикаторын шошго давхаргаа дагаж солигдоно.
   -------------------------------------------------------------------------- */

export const PROTECTED_LAYERS = [
  {
    id: "official",
    service: PROTECTED_OFFICIAL_SERVICE,
    layer: 2,
    label: "Албан бүртгэл",
    unit: "га",
  },
  {
    id: "polygon",
    service: PROTECTED_MAPPING_SERVICE,
    layer: 3,
    label: "Зураглал · талбай",
    unit: "га",
  },
  {
    id: "polyline",
    service: PROTECTED_MAPPING_SERVICE,
    layer: 2,
    label: "Зураглал · шугам",
    unit: "км",
  },
  {
    id: "point",
    service: PROTECTED_MAPPING_SERVICE,
    layer: 1,
    label: "Зураглал · цэг",
    unit: "",
  },
] as const;

export type ProtectedLayerId = (typeof PROTECTED_LAYERS)[number]["id"];

export const LAYER_LABEL = new Map<string, string>(
  PROTECTED_LAYERS.map((l) => [l.id, l.label] as [string, string]),
);

/**
 * ДӨРВҮҮЛЭНГ нэг дор.
 *
 * Давхарга бүр `OBJECTID`-гаа нэгээс эхлэн дугаарладаг тул дугаарууд
 * хоорондоо давхцана. Нэг зурагт нийлүүлэхийн тулд давхаргын индексээр
 * нэрийн орон зай өгнө (`uid`) — эс тэгвээс товшилт буруу бичлэг рүү
 * заана.
 */
const SPACE = 1_000_000;

export type ProtectedRow = Shape & {
  /** Аль давхаргынх */
  layer: ProtectedLayerId;
  /** Давхаргын нэрийн орон зайд шилжүүлсэн дугаар */
  uid: number;
};

export type ProtectedData = {
  rows: ProtectedRow[];
  /** Олон өнцөгт ба шугам — нэг эх сурвалжид. Дүүргэлтийн давхарга
      шугамыг зурдаггүй, хүрээний давхарга хоёуланг нь зурдаг. */
  shapes: GeoJSON.FeatureCollection;
  /** Цэгүүд — тусдаа, зургийн цэгэн горимоор */
  points: { oid: number[]; lon: number[]; lat: number[] };
};

export async function fetchAllProtected(signal?: AbortSignal): Promise<ProtectedData> {
  const sets = await Promise.all(
    PROTECTED_LAYERS.map((l) => fetchLayer(l.service, l.layer, signal)),
  );

  const rows: ProtectedRow[] = [];
  const shapes: GeoJSON.Feature[] = [];
  const points = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };

  sets.forEach((set, i) => {
    const layer = PROTECTED_LAYERS[i].id;
    const shift = (oid: number) => i * SPACE + oid;

    for (const r of set.rows) rows.push({ ...r, layer, uid: shift(r.oid) });

    for (const f of set.shapes.features) {
      const uid = shift(Number(f.id));
      if (f.geometry?.type === "Point") {
        const c = f.geometry.coordinates as [number, number];
        points.oid.push(uid);
        points.lon.push(c[0]);
        points.lat.push(c[1]);
        continue;
      }
      shapes.push({ type: "Feature", id: uid, properties: { oid: uid }, geometry: f.geometry });
    }
  });

  rows.sort((a, b) => b.size - a.size);
  return { rows, shapes: { type: "FeatureCollection", features: shapes }, points };
}
