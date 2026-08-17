/**
 * Ус ашиглах гэрээ — нийслэлийн нутаг дэвсгэрт ус ашиглах зөвшөөрөл авч,
 * гэрээ байгуулсан аж ахуйн нэгжүүд.
 *
 * 10 гэрээ, дөрвөн салбар. Бүгд ГАЗРЫН ДООРХ ус ашигладаг тул "эх
 * үүсвэр" гэсэн задаргаа утгагүй — ялгаа нь салбар ба ХЭМЖЭЭНД.
 *
 * Гол хэмжигдэхүүн нь м³/жил ба төлбөр. Хоёр нь ПРОПОРЦИОНАЛЬ БИШ:
 * усны нөөцийн төлбөрийн тариф салбар бүрд өөр тул ижил хэмжээний ус
 * ашигласан хоёр аж ахуйн нэгж эрс өөр төлбөр төлж болно (жишээ нь
 * бетон зуурмагийнх нь ундаа жүүснийхээс бараг хоёр дахин үнэтэй).
 * Тиймээс НЭГЖ ҮНИЙГ (төг/м³) тусад нь тооцно — энэ самбарын хамгийн
 * их мэдээлэл өгдөг тоо нь тэр.
 *
 * Хөтөч ArcGIS-ЭЭС ШУУД татна (`api/` зам хэрэглэхгүй): бичлэг цөөн,
 * гэрээ жил бүр шинэчлэгддэг бөгөөд сайт статикаар экспортлогддог тул
 * API зам нь бүтээх мөчийн зургийг хөлдөөнө.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "Us_ashiglah_geree";

export const WATER_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

export type WaterContract = {
  oid: number;
  /** Ус ашиглагч аж ахуйн нэгжийн нэр */
  holder: string;
  /** Салбар — "Хүнсний үйлдвэрийн салбар" (эх нь ром тоотой, том үсгээр) */
  sector: string;
  /** Үйл ажиллагааны чиглэл — "Мах махан бүтээгдэхүүн" */
  activity: string;
  district: string;
  khoroo: string;
  /** Усны эх үүсвэр — "Газрын доорх" */
  source: string;
  /** Ус ашиглах зөвшөөрлийн дугаар — "А/128" */
  permit: string;
  /** Зөвшөөрөл олгосон он */
  permitYear: number | null;
  /** Гэрээ байгуулсан огноо, дугаар — "2025.09.05 /30" */
  signed: string;
  /** Гэрээ дуусах огноо — "2025.12.31" */
  expires: string;
  /** Нийт ашиглах усны хэмжээ, м³/жил */
  m3: number;
  /** Гэрээгээр хүлээсэн усны нөөцийн төлбөр, төгрөг */
  fee: number;
  lon: number;
  lat: number;
};

export type WaterData = {
  rows: WaterContract[];
  points: { oid: number[]; lon: number[]; lat: number[] };
  /**
   * Салбарууд эх сурвалжийн ТОГТООСОН дарааллаар (ром дугаараар):
   * хүнс → барилга → хөнгөн үйлдвэр → аялал жуулчлал. Хэмжээгээр
   * эрэмбэлбэл диаграмын мөрүүд шүүлт бүрд үсэрнэ.
   */
  sectors: string[];
};

/** Нэгж үнэ — төг/м³. Гэрээ бүрийн тарифыг ил гаргана */
export function unitFee(c: WaterContract): number {
  return c.m3 > 0 ? c.fee / c.m3 : 0;
}

/**
 * Салбарын нэрийг цэгцэлнэ.
 *
 * Эх нь "I. ХҮНСНИЙ ҮЙЛДВЭРИЙН САЛБАР" гэж ром дугаартай, БҮТЭН ТОМ
 * үсгээр бичигдсэн. Дугаар нь эрэмбийг заадаг тул ХАДГАЛНА (`order`),
 * харин харуулахдаа хасна — интерфэйсийн бусад хэсэг том үсгээр
 * бичдэггүй.
 */
function sectorOf(raw: string | null | undefined): { name: string; order: number } {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { name: "Тодорхойгүй", order: 99 };
  const m = t.match(/^([IVX]+)\.\s*(.+)$/);
  const body = (m ? m[2] : t).trim();
  const order = m ? roman(m[1]) : 98;
  /* Бүтэн том үсгийг эхний үсгээс бусдыг нь жижигрүүлнэ */
  return { name: body.charAt(0) + body.slice(1).toLocaleLowerCase("mn-MN"), order };
}

function roman(s: string): number {
  const v: Record<string, number> = { I: 1, V: 5, X: 10 };
  let out = 0;
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]] ?? 0;
    const b = v[s[i + 1]] ?? 0;
    out += a < b ? -a : a;
  }
  return out || 98;
}

/** "2025.09.10" гэх бичвэрээс оныг салгана */
function year(raw: string | null | undefined): number | null {
  const m = String(raw ?? "").match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

/** Нэрийн гадуурх хашилтыг цэгцэлнэ — эх нь «"Витсамо фрут жүүс" ХХК» */
function clean(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").replace(/"/g, "").trim();
}

type Props = {
  OBJECTID: number;
  Салбар?: string;
  Ус_ашиглах_зөвшөөрлийн_огноо?: string;
  Ус_ашиглах_зөвшөөрлийн_дугаар?: string;
  Гэрээ_байгуулсан_огноо__дугаар?: string;
  Гэрээ_дуусах_хугацаа?: string;
  Ус_ашиглагч_иргэн___аж_ахуйн_нэгж___байгууллагын_нэр?: string;
  Үйл_ажиллагааны_чиглэл?: string;
  Дүүрэг?: string;
  Хороо?: string;
  Усны__эх_үүсвэр?: string;
  Нийт_ашиглах__усны_хэмжээ__м3_жил?: number;
  Гэрээгээр_хүлээсэн_Усны_нөөцийн_төлбөр__төг?: number;
};

export async function fetchWaterContracts(): Promise<WaterData> {
  const url =
    `${WATER_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      /* `*` хэрэглэхгүй: захирлын хувийн утасны дугаар байдаг бөгөөд
         самбарт хэрэггүй тул татахаас нь татгалзана */
      outFields: [
        "OBJECTID",
        "Салбар",
        "Ус_ашиглах_зөвшөөрлийн_огноо",
        "Ус_ашиглах_зөвшөөрлийн_дугаар",
        "Гэрээ_байгуулсан_огноо__дугаар",
        "Гэрээ_дуусах_хугацаа",
        "Ус_ашиглагч_иргэн___аж_ахуйн_нэгж___байгууллагын_нэр",
        "Үйл_ажиллагааны_чиглэл",
        "Дүүрэг",
        "Хороо",
        "Усны__эх_үүсвэр",
        "Нийт_ашиглах__усны_хэмжээ__м3_жил",
        "Гэрээгээр_хүлээсэн_Усны_нөөцийн_төлбөр__төг",
      ].join(","),
      outSR: "4326",
      orderByFields: "OBJECTID",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ус ашиглах гэрээ татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };

  const rows: WaterContract[] = [];
  const points = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };
  const order = new Map<string, number>();

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    const sector = sectorOf(p.Салбар);
    if (!order.has(sector.name)) order.set(sector.name, sector.order);

    /* Геометргүй бичлэгийг алгасахгүй — жагсаалтад үлдэнэ, зөвхөн
       газрын зурагт л гарахгүй */
    const g = f.geometry?.type === "Point" ? (f.geometry.coordinates as number[]) : null;

    rows.push({
      oid,
      holder: clean(p.Ус_ашиглагч_иргэн___аж_ахуйн_нэгж___байгууллагын_нэр) || "—",
      sector: sector.name,
      activity: clean(p.Үйл_ажиллагааны_чиглэл) || "Тодорхойгүй",
      district: clean(p.Дүүрэг) || "Тодорхойгүй",
      khoroo: clean(p.Хороо),
      source: clean(p.Усны__эх_үүсвэр) || "Тодорхойгүй",
      permit: clean(p.Ус_ашиглах_зөвшөөрлийн_дугаар) || "—",
      permitYear: year(p.Ус_ашиглах_зөвшөөрлийн_огноо),
      signed: clean(p.Гэрээ_байгуулсан_огноо__дугаар) || "—",
      expires: clean(p.Гэрээ_дуусах_хугацаа) || "—",
      m3: Number(p.Нийт_ашиглах__усны_хэмжээ__м3_жил) || 0,
      fee: Number(p.Гэрээгээр_хүлээсэн_Усны_нөөцийн_төлбөр__төг) || 0,
      lon: g ? g[0] : NaN,
      lat: g ? g[1] : NaN,
    });

    if (g) {
      points.oid.push(oid);
      points.lon.push(g[0]);
      points.lat.push(g[1]);
    }
  }

  /* Усны хэмжээгээр — их нь эхэндээ */
  rows.sort((a, b) => b.m3 - a.m3);

  const sectors = [...order]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  return { rows, points, sectors };
}
