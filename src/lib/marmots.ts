/**
 * Шилжүүлэн нутагшуулсан тарваган мэдээлэл, 2022–2026.
 *
 * Нэг бичлэг = НЭГ ШИЛЖҮҮЛЭЛТ: тодорхой газраас барьж, өөр газарт
 * тавьсан тарвагын бүлэг. 13 шилжүүлэлт, нийт 400 орчим тарвага.
 *
 * **Хоёр давхарга нь НЭГ бүртгэлийн хоёр үзүүр.** `Tarwaga_barisan…`
 * ба `Tarwaga_tawisan…` хоёр нь ижил 13 мөртэй, ижил талбартай — зөвхөн
 * ГЕОМЕТР нь өөр: эхнийх нь БАРЬСАН цэг, хоёр дахь нь ТАВЬСАН цэгт
 * байрлана. Тиймээс хоёуланг нь татаж `OBJECTID`-аар хосолно.
 *
 * Атрибутад ч мөн `Lat_1/Long_1` (барьсан), `Lat_2/Long_2` (тавьсан)
 * гэсэн хос координат бий — геометр дутсан тохиолдолд эдгээрээс авна.
 *
 * **Насны ангилал** (`Бурхи`, `Тарчи`, `Нагай`, `Хотил`, `Мөндөл`) нь
 * эх сурвалжийн нэршил. Тэдгээрийн яг тодорхойлолтыг эх сурвалж
 * тайлбарлаагүй тул байгаагаар нь харуулна — ТААМАГЛАЖ орчуулахгүй.
 *
 * `Нийт` талбар 2023 оны дөрвөн мөрд ХООСОН тул ангиллуудын нийлбэрээр
 * нөхнө: тэдгээрийг тэг гэж үзвэл тухайн жил алга болно.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";

export const MARMOT_SERVICES = [
  `${HOST}/Tarwaga_barisan_2022_26/FeatureServer/0`,
  `${HOST}/Tarwaga_tawisan_2022_26/FeatureServer/0`,
];

/** Насны ангиллын багана — эх сурвалжийн нэршлээр, эрэмбэ нь тогтмол */
export const AGE_CLASSES = ["Бурхи", "Тарчи", "Нагай", "Хотил", "Мөндөл"] as const;
export type AgeClass = (typeof AGE_CLASSES)[number];

/** Шилжүүлэлтийн нэг үзүүр — барьсан эсвэл тавьсан газар */
export type MarmotSite = {
  aimag: string;
  soum: string;
  bag: string;
  /** Чөлөөт бичвэрээр заасан газрын нэр */
  place: string;
  lon: number;
  lat: number;
};

export type Marmot = {
  oid: number;
  no: number;
  year: number;
  from: MarmotSite;
  to: MarmotSite;
  /** Насны ангилал бүрийн тоо — бөглөгдөөгүй бол `null` */
  ages: Record<AgeClass, number | null>;
  /** Нийт тоо. Эх талбар хоосон бол ангиллуудаас нийлбэрлэв */
  total: number;
  /** `Нийт` талбар хоосон байсан тул нийлбэрээр нөхсөн эсэх */
  totalDerived: boolean;
  /** Барьсан газраас тавьсан газар хүртэлх зай, км */
  km: number;
};

export type MarmotData = {
  rows: Marmot[];
  /** Барьсан цэгүүд — `oid` нь `Marmot.oid` */
  from: { oid: number[]; lon: number[]; lat: number[] };
  /** Тавьсан цэгүүд — `oid` нь `Marmot.oid + RELEASE` */
  to: { oid: number[]; lon: number[]; lat: number[] };
  /** Хоёр үзүүрийг холбосон шугамууд */
  links: GeoJSON.FeatureCollection;
};

/**
 * Тавьсан цэгийн дугаарын шилжилт.
 *
 * Барьсан ба тавьсан цэг НЭГ газрын зурагт зэрэгцэх тул дугаар нь
 * мөргөлдөх ёсгүй. Тавьсан цэг = шилжүүлэлтийн дугаар + энэ тоо.
 */
export const RELEASE = 100_000;

type Props = {
  OBJECTID: number;
  F_?: number;
  Он?: number;
  Аймаг_Нийслэл_1?: string;
  Сум_Дүүрэг_1?: string;
  Баг_Хороо_1?: string;
  Байршил_1?: string;
  Lat_1?: number;
  Long_1?: number;
  Аймаг_Нийслэл_2?: string;
  Сум_Дүүрэг_2?: string;
  Баг_Хороо_2?: string;
  Байршил_2?: string;
  Lat_2?: number;
  Long_2?: number;
  Нийт?: number;
} & Partial<Record<AgeClass, number>>;

const tidy = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** Их тойргийн зай, км */
function km(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (d: number) => d * (Math.PI / 180);
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function page(service: string) {
  const url =
    `${service}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "*",
      outSR: "4326",
      orderByFields: "OBJECTID",
      resultRecordCount: "2000",
      f: "geojson",
    });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Тарвагын мэдээлэл татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };
  return json.features ?? [];
}

export async function fetchMarmots(): Promise<MarmotData> {
  /* Хоёр давхаргыг ЗЭРЭГ татна — нэг бүртгэлийн хоёр үзүүр */
  const [caught, released] = await Promise.all([page(MARMOT_SERVICES[0]), page(MARMOT_SERVICES[1])]);

  /** Тавьсан цэгийн геометрийг `OBJECTID`-аар нь олох толь */
  const releasePoint = new Map<number, [number, number]>();
  for (const f of released) {
    if (f.geometry?.type !== "Point") continue;
    releasePoint.set(
      Number(f.properties.OBJECTID),
      f.geometry.coordinates as [number, number],
    );
  }

  const rows: Marmot[] = [];
  const from = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };
  const to = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };
  const links: GeoJSON.Feature[] = [];

  for (const f of caught) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);

    /* Геометрийг эрхэмлэнэ, дутсан бол атрибутын координатаас */
    const a: [number, number] =
      f.geometry?.type === "Point"
        ? (f.geometry.coordinates as [number, number])
        : [Number(p.Long_1), Number(p.Lat_1)];
    const b: [number, number] =
      releasePoint.get(oid) ?? [Number(p.Long_2), Number(p.Lat_2)];

    const ages = {} as Record<AgeClass, number | null>;
    let sum = 0;
    for (const c of AGE_CLASSES) {
      const v = p[c];
      ages[c] = typeof v === "number" ? v : null;
      sum += typeof v === "number" ? v : 0;
    }
    const declared = typeof p.Нийт === "number" ? p.Нийт : null;

    const okA = Number.isFinite(a[0]) && Number.isFinite(a[1]);
    const okB = Number.isFinite(b[0]) && Number.isFinite(b[1]);

    rows.push({
      oid,
      no: Number(p.F_) || rows.length + 1,
      year: Number(p.Он) || 0,
      from: {
        aimag: tidy(p.Аймаг_Нийслэл_1) || "Тодорхойгүй",
        soum: tidy(p.Сум_Дүүрэг_1) || "Тодорхойгүй",
        bag: tidy(p.Баг_Хороо_1),
        place: tidy(p.Байршил_1),
        lon: a[0],
        lat: a[1],
      },
      to: {
        aimag: tidy(p.Аймаг_Нийслэл_2) || "Тодорхойгүй",
        soum: tidy(p.Сум_Дүүрэг_2) || "Тодорхойгүй",
        bag: tidy(p.Баг_Хороо_2),
        place: tidy(p.Байршил_2),
        lon: b[0],
        lat: b[1],
      },
      ages,
      total: declared ?? sum,
      totalDerived: declared == null,
      km: okA && okB ? km(a, b) : 0,
    });

    if (okA) {
      from.oid.push(oid);
      from.lon.push(a[0]);
      from.lat.push(a[1]);
    }
    if (okB) {
      to.oid.push(oid + RELEASE);
      to.lon.push(b[0]);
      to.lat.push(b[1]);
    }
    if (okA && okB) {
      links.push({
        type: "Feature",
        id: oid,
        properties: { oid },
        geometry: { type: "LineString", coordinates: [a, b] },
      });
    }
  }

  rows.sort((x, y) => y.year - x.year || y.total - x.total);
  return { rows, from, to, links: { type: "FeatureCollection", features: links } };
}
