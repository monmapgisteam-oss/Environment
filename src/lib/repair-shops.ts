/**
 * Хяналтын хэлтэс — авто засварын үйлчилгээний цэгүүд.
 *
 * Эх сурвалж: `Auto_zaswar` FeatureServer, 528 цэг.
 *
 * Талбар цөөн: нэр, чиглэл, байршлын чөлөөт бичвэр, дүүрэг, координат.
 * `Үйл_ажиллагааны_чиглэл` нь 528 бичлэгт БҮГД ижил утгатай ("АВТО
 * ЗАСВАРЫН ҮЙЛЧИЛГЭЭ") тул хэмжигдэхүүн болохгүй — задаргаа, диаграм
 * хийх зүйл алга.
 *
 * Тиймээс энэ хэлтэст САМБАР биш, зөвхөн ГАЗРЫН ЗУРАГ: датаны цорын
 * ганц бодит агуулга нь ХААНА байгаа явдал.
 *
 * `Дүүрэг` нь товчилсон (СХД, БЗД …) бөгөөд 69 бичлэгт хоосон. Дэлгэц
 * дээр БҮТЭН нэрээр харуулна ({@link DISTRICT_NAMES}); хоосныг нь ил
 * тэмдэглэнэ — "тодорхойгүй" нь дүүрэг биш.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";

export const REPAIR_SERVICE = `${HOST}/Auto_zaswar/FeatureServer/0`;

/*
  Дүүргийн товчлолыг бүтэн нэр рүү.

  Эх сурвалж товчилж бичсэн ч эдгээр нь нийслэлийн дүүргүүдийн НИЙТЭД
  ТОГТСОН товчлол — задлах нь таамаг биш. Албан бичгийн дүрмээр дэлгэц
  дээр товчлол гарахгүй.

  Дагаваргүй нэрээр: платформын бусад бүх самбар ("Баянзүрх", "Хан-Уул")
  ингэж бичдэг.

  Таних боломжгүй код ирвэл БАЙГААГААР нь үлдэнэ — таамаглан нэрлэвэл
  байхгүй баримт нэмнэ.
*/
export const DISTRICT_NAMES: Record<string, string> = {
  СХД: "Сонгинохайрхан",
  БЗД: "Баянзүрх",
  БГД: "Баянгол",
  СБД: "Сүхбаатар",
  ЧД: "Чингэлтэй",
  ХУД: "Хан-Уул",
  НАЛ: "Налайх",
  БХАН: "Багахангай",
  БНД: "Багануур",
};

export function districtName(code: string) {
  if (!code) return "Бүртгэгдээгүй";
  return DISTRICT_NAMES[code.trim().toUpperCase()] ?? code;
}

export type RepairShop = {
  oid: number;
  /** Компани эсвэл иргэний нэр */
  name: string;
  /** Байршлын чөлөөт бичвэр — хороо, тоот энд бичигдсэн */
  place: string;
  /** Дүүргийн товчлол. Хоосон бол `""` */
  district: string;
  lon: number;
  lat: number;
};

export type RepairData = {
  shops: RepairShop[];
  /** Газрын зургийн цэгийн багана */
  points: { oid: number[]; lon: number[]; lat: number[] };
  /** Дүүрэг бүрийн тоо, тоо буурахаар */
  byDistrict: { district: string; n: number }[];
  /** Дүүрэг тэмдэглэгдээгүй бичлэгийн тоо */
  noDistrict: number;
};

type Feature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Point"; coordinates: [number, number] } | null;
};

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function fetchRepairShops(signal?: AbortSignal): Promise<RepairData> {
  const url =
    `${REPAIR_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,Компани__иргэний_нэр,Байршил,Дүүрэг",
      outSR: "4326",
      orderByFields: "OBJECTID",
      f: "geojson",
    });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Авто засварын цэг татагдсангүй (${res.status})`);
  const json = (await res.json()) as { features?: Feature[] };

  const shops: RepairShop[] = [];
  const points = { oid: [] as number[], lon: [] as number[], lat: [] as number[] };
  const counts = new Map<string, number>();
  let noDistrict = 0;

  for (const f of json.features ?? []) {
    const g = f.geometry;
    if (!g || !Array.isArray(g.coordinates)) continue;
    const [lon, lat] = g.coordinates;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

    const p = f.properties;
    const oid = Number(p["OBJECTID"]);
    const district = str(p["Дүүрэг"]);

    shops.push({
      oid,
      name: str(p["Компани__иргэний_нэр"]) || "Нэр бүртгэгдээгүй",
      place: str(p["Байршил"]),
      district,
      lon,
      lat,
    });

    points.oid.push(oid);
    points.lon.push(lon);
    points.lat.push(lat);

    if (district) counts.set(district, (counts.get(district) ?? 0) + 1);
    else noDistrict++;
  }

  const byDistrict = [...counts]
    .map(([district, n]) => ({ district, n }))
    .sort((a, b) => b.n - a.n);

  return { shops, points, byDistrict, noDistrict };
}
