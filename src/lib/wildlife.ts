/**
 * Амьтан, ургамлыг хамгаалах хэлтсийн эх сурвалж —
 * зэрлэг амьтны дуудлагын бүртгэл (ArcGIS Survey123).
 *
 * Худгийн бүртгэлээс ХОЁР зүйлээр ялгаатай тул өөр аргаар авна:
 *
 *  1. Хэмжээ. Худаг 12 мянган цэгтэй тул серверт шахаж, `api/wells`-ээр нэг
 *     удаа өгдөг. Энд бичлэг цөөн — шахах шаардлагагүй, шууд бүтнээр нь авна.
 *  2. Амьд байдал. Survey123 маягт одоо ч бөглөгдсөөр байгаа. Сайт статикаар
 *     экспортлогддог тул API зам нь бүтээх мөчийн зургийг хөлдөөнө —
 *     хэрэглэгч маргааш нээхэд өчигдрийн тоо харагдана. Тиймээс хөтөч
 *     ArcGIS-ээс ШУУД татна (үйлчилгээ CORS зөвшөөрдөг).
 */

export const WILDLIFE_SERVICE =
  "https://services.arcgis.com/HJzgwvlNIXssnQar/arcgis/rest/services/survey123_57fb5da6d1904b2a8aec066d747b7b0e/FeatureServer/0";

const PAGE = 2000;

/** Нэг дуудлагын бичлэг */
export type WildlifeCall = {
  oid: number;
  lon: number;
  lat: number;
  aimag: string;
  soum: string;
  bag: string;
  /** Дуудлага бүртгэсэн огноо (ms) — талбар хоосон бол null */
  date: number | null;
  /** Дуудлагын төрөл: утасны дугаар эсвэл чөлөөт бичвэр */
  callType: string;
  /** Амьтны зүйл — харуулах хэлбэр (эхний үсэг том) */
  species: string;
  /** Бэртэл гэмтэлтэй эсэх. Талбар бөглөгдөөгүй бол null */
  injured: boolean | null;
  careDays: number | null;
  feedCost: number | null;
  fuelCost: number | null;
  staffHours: number | null;
  /** Байгальд тавьсан маршрут */
  route: string | null;
  note: string;
  officer: string;
};

type Attrs = Record<string, unknown>;

type EsriPointFeature = {
  attributes: Attrs;
  geometry?: { x: number; y: number } | null;
};

/**
 * Амьтны зүйлийн нэр гараар бичигддэг тул "могой" ба "Могой" хоёр өөр
 * ангилал болж хуваагдана. Бүлэглэхээсээ өмнө нэгэн жигд болгоно:
 * зайг цэвэрлээд эхний үсгийг том болгоно.
 */
function titleCase(v: unknown) {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (!s) return "";
  return s[0].toLocaleUpperCase("mn-MN") + s.slice(1).toLocaleLowerCase("mn-MN");
}

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function nullableNum(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function fetchCalls(signal?: AbortSignal): Promise<WildlifeCall[]> {
  const out: WildlifeCall[] = [];

  for (let offset = 0; ; offset += PAGE) {
    const url = `${WILDLIFE_SERVICE}/query?${new URLSearchParams({
      f: "json",
      where: "1=1",
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "objectid ASC",
    })}`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
    const json = (await res.json()) as { features?: EsriPointFeature[] };
    const feats = json.features ?? [];

    for (const f of feats) {
      const g = f.geometry;
      if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
      const a = f.attributes;

      out.push({
        oid: Number(a.objectid),
        lon: g.x,
        lat: g.y,
        aimag: str(a.aimag) || "Тодорхойгүй",
        soum: str(a.sum) || "Тодорхойгүй",
        bag: str(a.bag),
        date: nullableNum(a.ognoo),
        callType: str(a.Duudlagiin_turul),
        species: titleCase(a.amitnii_zuil) || "Тодорхойгүй",
        // Домэйн: `tiim` / `ugui`. Гуравдагч утга нь "бөглөөгүй" гэсэн үг.
        injured: a.bertel_gemtel === "tiim" ? true : a.bertel_gemtel === "ugui" ? false : null,
        careDays: nullableNum(a.asran_hamgaalsan_honog),
        feedCost: nullableNum(a.Idesh_tejeeliin_zardal),
        fuelCost: nullableNum(a.shatahuunii_zardal),
        staffHours: nullableNum(a.Zartsuulsan_hugatsaa),
        route: str(a.marshrut) || null,
        note: str(a.tailbar),
        officer: str(a.alban_haagch) || "Тодорхойгүй",
      });
    }

    if (feats.length < PAGE) break;
  }

  return out;
}

/* --------------------------------------------------------------------------
   Хавсралт — маягтаар ирсэн гэрэл зураг
   -------------------------------------------------------------------------- */

export type WildlifePhoto = {
  /** Аль дуудлагын зураг вэ */
  oid: number;
  id: number;
  name: string;
  /** Шууд харуулах хаяг — токен шаардахгүй, нээлттэй үйлчилгээ */
  url: string;
};

/** Нэг хүсэлтэд асуух дээд тоо — хаяг хэт уртсахаас сэргийлнэ */
const ATTACH_CHUNK = 100;

/**
 * Бүх дуудлагын хавсралтыг нэг дор асууна (`queryAttachments`), бичлэг тус
 * бүрээр давтаж асуухгүй — 100 бичлэгт 100 хүсэлт явуулах нь утгагүй.
 *
 * Зөвхөн ЗУРАГ буцаана: маягтад дуу, бичиг баримт ч хавсрагдаж болно.
 */
export async function fetchPhotos(
  oids: number[],
  signal?: AbortSignal,
): Promise<WildlifePhoto[]> {
  const out: WildlifePhoto[] = [];

  for (let i = 0; i < oids.length; i += ATTACH_CHUNK) {
    const chunk = oids.slice(i, i + ATTACH_CHUNK);
    const url = `${WILDLIFE_SERVICE}/queryAttachments?${new URLSearchParams({
      f: "json",
      objectIds: chunk.join(","),
    })}`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
    const json = (await res.json()) as {
      attachmentGroups?: {
        parentObjectId: number;
        attachmentInfos?: { id: number; name?: string; contentType?: string }[];
      }[];
    };

    for (const g of json.attachmentGroups ?? []) {
      for (const a of g.attachmentInfos ?? []) {
        if (!a.contentType?.startsWith("image/")) continue;
        out.push({
          oid: g.parentObjectId,
          id: a.id,
          name: a.name ?? "",
          url: `${WILDLIFE_SERVICE}/${g.parentObjectId}/attachments/${a.id}`,
        });
      }
    }
  }

  return out;
}
