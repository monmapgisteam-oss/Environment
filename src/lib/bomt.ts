/**
 * Байгаль орчны үнэлгээ, уур амьсгалын өөрчлөлтийн хэлтэс —
 * байгаль орчны менежментийн төлөвлөгөөний 2026 оны нэгтгэл.
 *
 * Эх сурвалж: нийслэлийн байгаль орчны GIS сервер, `БОМТ_нэгтгэл_2026`
 * FeatureServer, 165 нэгж талбар (олон өнцөгт).
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ ЯАГААД ХУУЛБАРААР ИРЖ БАЙНА ВЭ                                   │
 * └──────────────────────────────────────────────────────────────────┘
 * `environment.ub.gov.mn` нь ӨӨРӨӨ ГАРЫН ҮСЭГ ЗУРСАН TLS гэрчилгээтэй
 * тул ямар ч хөтөч тэндээс дата татахгүй ({@link ./neutralization}-тэй
 * ижил асуудал). Тиймээс дата нь `public/data/bomt-2026.json` дотор
 * хуулбараар суудаг бөгөөд БИДНИЙ ӨӨРИЙН эх сурвалжаас татагдана.
 *
 * Хуулбар нь эх сурвалжийн талбаруудыг ХЭВЭЭР авч явна — цэвэрлэгээ,
 * бүлэглэлт бүгд энэ файлд, кодоор харагдаж байхаар хийгдэв. Гэрчилгээ
 * засагдмагц `load()`-ийн хаягийг л сольно.
 */

import { ACTIVITIES, classifyActivity } from "@/lib/assessment";
import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";

/* ⚠ Давхаргын дугаар 20 — 0 БИШ. Шинэ портал дээр бүх үйлчилгээ нэг
   дараалалтай нийтлэгдсэн. Нэр нь кирилл тул хаягийг `encodeURI`-гүй
   бичиж БОЛОХГҮЙ гэж бодож магадгүй ч `fetch` өөрөө зохицуулна. */
export const BOMT_SERVICE = `${HOSTING}/Hosted/${encodeURIComponent("B04_БОМТ_нэгтгэл_2026")}/FeatureServer/20`;

export type BomtRow = {
  oid: number;
  /** Төсөл хэрэгжүүлэгч — иргэн эсвэл аж ахуйн нэгж */
  implementer: string;
  /** Үйл ажиллагааны чиглэл — бүртгэсэн ЭХ бичвэр */
  activityRaw: string;
  /** Түүнийг бүлэглэсэн ангилал ({@link ACTIVITIES}) */
  activity: string;
  /** Мод тарих байршил — бүртгэсэн ЭХ бичвэр */
  plantingRaw: string;
  /** Түүнийг бүлэглэсэн ангилал ({@link PLANTING}) */
  planting: string;
  /** Газрын зориулалт — эх сурвалжийн албан ангилал */
  landuse: string;
  /** Эрхийн хэлбэр — эзэмших / өмчлөх / ашиглах */
  right: string;
  district: string;
  /**
   * Эх сурвалжийн `дүүрэг` талбар — товчилсон, гараар бичигдсэн.
   * Харуулахад ХЭРЭГЛЭХГҮЙ (доорх ХОЙШЛУУЛСАН тэмдэглэл), зөвхөн
   * тулгалт хийхэд бэлэн байлгах зорилгоор авч явна.
   */
  districtRaw: string;
  khoroo: string;
  address: string;
  parcel: string;
  /** Талбай, м² (UTM проекцоос) */
  m2: number;
};

export type BomtData = {
  rows: BomtRow[];
  shapes: GeoJSON.FeatureCollection;
  fetchedAt: string;
};

/* --------------------------------------------------------------------------
   Мод тарих байршил

   Энэ бол датаны ГОЛ талбар: төсөл бүр байгаль орчны менежментийн
   төлөвлөгөөгөөр мод тарих үүрэг хүлээдэг бөгөөд түүнийг ХААНА
   гүйцэтгэхээ энд заасан байна.

   Утга нь чөлөөт бичвэр боловч ердөө таван хувилбартай, тэдгээрийн
   хоёр нь 159/165-ыг эзэлнэ. Тиймээс түлхүүр үгээр бүлэглэх шаардлага
   бага — зөвхөн ЗАЙ, ТОМ/ЖИЖИГ ҮСГИЙН зөрүүг арилгана.

   "НБОГ" гэдгийг эх сурвалж задалж бичээгүй тул БИД ч задлахгүй —
   товчлолыг таамаглан дэлгэрүүлбэл байхгүй баримт нэмсэн болно.
   -------------------------------------------------------------------------- */

export const PLANTING = [
  { id: "nbog", label: "НБОГ" },
  { id: "site", label: "Төслийн талбайд" },
  { id: "other", label: "Бусад тэмдэглэл" },
  { id: "none", label: "Тэмдэглэлгүй" },
] as const;

export function classifyPlanting(raw: string): string {
  const x = raw.trim().toLowerCase();
  if (!x) return "none";
  if (x.includes("нбог")) return "nbog";
  if (x.includes("төслийн талба")) return "site";
  return "other";
}

/** Бүлгийн нэрийг харуулах хэлбэрт */
export const PLANTING_LABEL = new Map<string, string>(
  PLANTING.map((p) => [p.id, p.label] as [string, string]),
);

export const ACTIVITY_LABEL = new Map<string, string>(
  ACTIVITIES.map((a) => [a.id, a.label] as [string, string]),
);

/* -------------------------------------------------------------------------- */

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Талбайг уншигдахуйц бичих.
 *
 * Хэмжээ эрс хазайсан (19.7 м² – 25 га) тул нэг нэгжээр бичвэл жижиг
 * талбай "0.0 га" болж алга болно — ерөнхий үнэлгээний самбартай ижил
 * дүрэм.
 */
export function areaText(m2: number) {
  if (!Number.isFinite(m2) || m2 <= 0) return "—";
  if (m2 < 10_000) return `${Math.round(m2).toLocaleString("en-US")} м²`;
  return `${(m2 / 10_000).toFixed(2)} га`;
}

/* --------------------------------------------------------------------------
   ХОЙШЛУУЛСАН — дүүргийн хоёр талбарын зөрүү

   Эх сурвалжид дүүргийг ХОЁР талбар агуулна:

   1. `soum` — кадастрын орон зайн нэгтгэлээс ирдэг. Цэвэр: найман
      бүтэн нэр, хоосон утга байхгүй. САМБАР ҮҮНИЙГ ХЭРЭГЛЭЖ БАЙНА.
   2. `дүүрэг` — гараар бичигдсэн товчлол. 16 өөр хувилбар холилдсон:
      "БЗД" ба "БЗД " (арын зайтай), "хУД" (жижиг үсгээр), Багануурыг
      "БНД" ба "БД" гэж хоёр янзаар, мөн "4 салбар ", "6 дүүрэг" гэсэн
      дүүрэг биш утга, нэг хоосон.

   Хоёрыг тулгахад: 157 таарч, 3 нь ТАНИГДАХГҮЙ утгатай, 5 нь ЗӨРСӨН —
   тэдгээрийн 2 нь зөвхөн товчлолын зөрүү (Багануурыг "БД" гэсэн), харин
   ГУРАВ нь жинхэнэ зөрчил:

     oid 37  → "БГД" бичсэн, кадастраар Баянзүрх
     oid 52  → "СХД" бичсэн, кадастраар Баянзүрх
     oid 125 → "ХУД" бичсэн, кадастраар Сонгинохайрхан

   Аль нь зөв болохыг ЭНД ШИЙДЭХГҮЙ: нэг нь бичилтийн алдаа, нөгөө нь
   орон зайн нэгтгэлийн алдаа байж болно — хэлтсээс тодруулах хэрэгтэй.
   Тулгалтад хэрэгтэй тул түүхий утгыг `districtRaw`-д хадгалж байна.

   ХИЙХ: хэлтсээс хариу ирэхэд (а) товчлолын толь бичиг гаргаж, (б)
   зөрсөн бичлэгийг самбар дээр тэмдэглэх эсэхийг шийднэ.
   -------------------------------------------------------------------------- */

type RawProps = {
  oid: number;
  parcel: string | null;
  addr: string | null;
  addr2: string | null;
  khoroo: string | null;
  landuse: string | null;
  right: string | null;
  district: string | null;
  districtRaw: string | null;
  implementer: string | null;
  activity: string | null;
  planting: string | null;
  m2: number | null;
};

/**
 * Түүхий талбар → доторх нэршил.
 *
 * ⚠ Буулгалтыг ТААМАГЛААГҮЙ: хуучин хуулбар файл ба амьд бичлэгийг
 * зэрэгцүүлж харьцуулан тогтоосон (`objectid=1` дээр бүх талбар таарсан).
 * `parcel` нь `parcel_id`-гээс ирнэ, `нэгж__талбарын_дугаар` БИШ —
 * сүүлийнх нь ижил утгыг ТОО болгож хадгалдаг тул тэргүүлэх тэг
 * алдагдах эрсдэлтэй.
 */
function raw(a: Record<string, unknown>): RawProps {
  return {
    oid: Number(a.objectid),
    parcel: str(a.parcel_id) || null,
    addr: str(a.address_ne) || null,
    addr2: str(a.address_st) || null,
    khoroo: str(a.address_kh) || null,
    landuse: str(a.landuse_de) || null,
    right: str(a.rigth_type) || null,
    /* Дүүргийг `soum`-оос авна, `дүүрэг`-ээс БИШ: сүүлийнх нь товчилсон
       чөлөөт бичвэр ("БЗД", "хУД", "6 дүүрэг" зэрэг 16 хувилбар) */
    district: str(a.soum) || null,
    districtRaw: str(a["дүүрэг"]) || null,
    implementer: str(a["төсөл_хэрэгжүүлэгчийн_нэр"]) || null,
    activity: str(a["үйл_ажилгааны_чиглэл"]) || null,
    planting: str(a["мод_тарих_байршил"]) || null,
    m2: typeof a.SHAPE__Area === "number" ? a.SHAPE__Area : null,
  };
}

export async function fetchBomt(signal?: AbortSignal): Promise<BomtData> {
  const url =
    `${BOMT_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "*",
      /* Геометр нь UTM 48N-д проекцлогдсон */
      outSR: "4326",
      orderByFields: "objectid",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const json = await arcgisJson<{
    features?: { properties: Record<string, unknown>; geometry: GeoJSON.Geometry | null }[];
  }>(url, "Менежментийн төлөвлөгөө", signal ? { signal } : undefined);

  const rows: BomtRow[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = raw(f.properties);
    const activityRaw = str(p.activity);
    const plantingRaw = str(p.planting);
    /* Хаяг хоёр талбарт бичигдсэн бөгөөд заримдаа зөрдөг — хоёуланг нь
       үлдээж, давхардсан үед нэгийг нь л харуулна */
    const addr = str(p.addr);
    const addr2 = str(p.addr2);

    rows.push({
      oid: p.oid,
      implementer: str(p.implementer) || "Тодорхойгүй",
      activityRaw,
      activity: classifyActivity(activityRaw),
      plantingRaw,
      planting: classifyPlanting(plantingRaw),
      landuse: str(p.landuse) || "Тодорхойгүй",
      /* Эрхийн хэлбэр эхний үсэг томоор — ерөнхий үнэлгээтэй нэг бичиглэл */
      right: cap(str(p.right)) || "Тодорхойгүй",
      district: str(p.district) || "Тодорхойгүй",
      districtRaw: str(p.districtRaw),
      khoroo: str(p.khoroo),
      address: addr && addr2 && addr !== addr2 ? `${addr} · ${addr2}` : addr || addr2,
      parcel: str(p.parcel),
      m2: p.m2 ?? 0,
    });

    if (f.geometry) {
      shapes.push({
        type: "Feature",
        /* Тоон `id` ЗААВАЛ — сонголтыг `feature-state`-ээр тодруулдаг */
        id: p.oid,
        properties: { oid: p.oid },
        geometry: f.geometry,
      });
    }
  }

  return {
    rows,
    shapes: { type: "FeatureCollection", features: shapes },
    fetchedAt: new Date().toISOString().slice(0, 10),
  };
}
