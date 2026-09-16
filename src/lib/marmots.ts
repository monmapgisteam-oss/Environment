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
 * Атрибутад ч мөн `c_lat/c_lon` (барьсан), `r_lat/r_lon` (тавьсан)
 * гэсэн хос координат бий — геометр дутсан тохиолдолд эдгээрээс авна.
 *
 * **Насны ангилал** (`Бурхи`, `Тарчи`, `Нагай`, `Хотил`, `Мөндөл`) нь
 * эх сурвалжийн нэршил. Тэдгээрийн яг тодорхойлолтыг эх сурвалж
 * тайлбарлаагүй тул байгаагаар нь харуулна — ТААМАГЛАЖ орчуулахгүй.
 *
 * `Нийт` талбар (одоо `total_`) 2023 оны дөрвөн мөрд ХООСОН тул
 * ангиллуудын нийлбэрээр нөхнө: тэдгээрийг тэг гэж үзвэл тухайн жил
 * алга болно.
 *
 * ⚠ **ЭХ СУРВАЛЖ ПОРТАЛД ШИЛЖСЭН** (хэрэглэгчийн шийдвэр, 2026-09-16):
 * ArcGIS Online дээрх `Tarwaga_barisan_2022_26` / `Tarwaga_tawisan_2022_26`
 * -аас `environment.ub.gov.mn`-ий `A06_tarwaga_barisan` /
 * `A06_tarwaga_tawisan` руу. Хоёулаа 13 мөртэй ХЭВЭЭР, утга нь ижил;
 * зөвхөн талбарын нэр латин болов: `Он` → `year_`, барьсан талын
 * `..._1` → `c_*`, тавьсан талын `..._2` → `r_*`, насны ангиллууд
 * `burkhi/tarchi/nagai/khotil/mundul`, `Нийт` → `total_`.
 *
 * ⚠ Тавьсан талын `Баг_Хороо_2`-ын ОРЛОГЧ БАЙХГҮЙ — шинэ давхаргад
 * `r_khoroo` гэсэн талбар алга. Тэр утга хоосон үлдэнэ, таамаглаж
 * нөхөхгүй.
 *
 * Шинэ хост токен шаардана тул хүсэлт `arcgisJson()`-оор явна.
 */

import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";

export const MARMOT_SERVICES = [
  `${layerService("A06_tarwaga_barisan")}/0`,
  `${layerService("A06_tarwaga_tawisan")}/0`,
];

/** Насны ангиллын ХАРАГДАХ нэр — эх сурвалжийнх, эрэмбэ нь тогтмол */
export const AGE_CLASSES = ["Бурхи", "Тарчи", "Нагай", "Хотил", "Мөндөл"] as const;
export type AgeClass = (typeof AGE_CLASSES)[number];

/**
 * Насны ангилал бүрийн ТАЛБАРЫН нэр.
 *
 * Порталд шилжсэнээс хойш харагдах нэр (кирилл) ба талбарын нэр
 * (латин) ЗӨРНӨ тул хоёрыг тусад нь барина — дэлгэц дээрх бичвэр
 * өөрчлөгдөөгүй.
 */
const AGE_FIELDS: Record<AgeClass, keyof Props> = {
  Бурхи: "burkhi",
  Тарчи: "tarchi",
  Нагай: "nagai",
  Хотил: "khotil",
  Мөндөл: "mundul",
};

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
  objectid: number;
  rec_no?: number;
  year_?: number;
  /* Барьсан тал */
  c_aimag?: string;
  c_duureg?: string;
  c_khoroo?: string;
  c_place?: string;
  c_lat?: number;
  c_lon?: number;
  /* Тавьсан тал — `r_khoroo` эх сурвалжид БАЙХГҮЙ */
  r_aimag?: string;
  r_duureg?: string;
  r_place?: string;
  r_lat?: number;
  r_lon?: number;
  /* Насны ангиллууд ба нийлбэр */
  burkhi?: number;
  tarchi?: number;
  nagai?: number;
  khotil?: number;
  mundul?: number;
  total_?: number;
  note?: string;
};

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
      orderByFields: "objectid",
      resultRecordCount: "2000",
      f: "geojson",
    });
  const json = await arcgisJson<{
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  }>(url, "Нутагшуулсан тарвага");
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
      Number(f.properties.objectid),
      f.geometry.coordinates as [number, number],
    );
  }

  const rows: Marmot[] = [];
  const from = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };
  const to = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };
  const links: GeoJSON.Feature[] = [];

  for (const f of caught) {
    const p = f.properties;
    const oid = Number(p.objectid);

    /* Геометрийг эрхэмлэнэ, дутсан бол атрибутын координатаас */
    const a: [number, number] =
      f.geometry?.type === "Point"
        ? (f.geometry.coordinates as [number, number])
        : [Number(p.c_lon), Number(p.c_lat)];
    const b: [number, number] =
      releasePoint.get(oid) ?? [Number(p.r_lon), Number(p.r_lat)];

    const ages = {} as Record<AgeClass, number | null>;
    let sum = 0;
    for (const c of AGE_CLASSES) {
      const v = p[AGE_FIELDS[c]];
      ages[c] = typeof v === "number" ? v : null;
      sum += typeof v === "number" ? v : 0;
    }
    const declared = typeof p.total_ === "number" ? p.total_ : null;

    const okA = Number.isFinite(a[0]) && Number.isFinite(a[1]);
    const okB = Number.isFinite(b[0]) && Number.isFinite(b[1]);

    rows.push({
      oid,
      no: Number(p.rec_no) || rows.length + 1,
      year: Number(p.year_) || 0,
      from: {
        aimag: tidy(p.c_aimag) || "Тодорхойгүй",
        soum: tidy(p.c_duureg) || "Тодорхойгүй",
        bag: tidy(p.c_khoroo),
        place: tidy(p.c_place),
        lon: a[0],
        lat: a[1],
      },
      to: {
        aimag: tidy(p.r_aimag) || "Тодорхойгүй",
        soum: tidy(p.r_duureg) || "Тодорхойгүй",
        /* Тавьсан талын баг, хороо эх сурвалжид БАЙХГҮЙ */
        bag: "",
        place: tidy(p.r_place),
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
