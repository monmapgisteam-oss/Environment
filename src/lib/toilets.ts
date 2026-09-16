/**
 * Хүрээлэн буй орчны ашиглалт хамгаалалтын хэлтэс — ариун цэврийн байгууламж.
 *
 * ХОЁР эх сурвалж, тэс өөр хэмжээтэй:
 *  1. `UB_pit_toilet` — 145,462 нүхэн жорлон, орчны эрсдэлийн үнэлгээтэй.
 *  2. `City_toilet` — 17 нийтийн бие засах газар.
 *
 * ⚠️ **НЭГТГЭЛ ХӨТӨЧ ДЭЭР ЯВАГДАНА** (хэрэглэгчийн шийдвэр, 2026-09-16).
 *
 * Урьд нь `api/toilets` гэсэн статик зам бүтээх мөчид нэгтгэж, үр дүнг
 * сайтад шатааж байв. Эх сурвалж хамгаалагдсан порталд шилжсэнээр тэр
 * арга боломжгүй болсон: бүтээлт GitHub дээр явагддаг бөгөөд тэнд
 * нэвтэрсэн хэрэглэгч байхгүй тул токен авах аргагүй. Бүтээх үеийн
 * үйлчилгээний бүртгэл үүсгэхийн оронд нэгтгэлийг хөтөч рүү зөөв —
 * хэрэглэгч аль хэдийн нэвтэрсэн, токен нь бэлэн.
 *
 * Үнэ: 73 хуудас × ~160KB ≈ 11.4MB, найман зэрэгцээ урсгалаар ~3 секунд.
 * Хариуд нь дата ХӨЛДӨХӨӨ БОЛИВ — бүтээх мөчийн хувилбар биш, тухайн
 * үеийн бодит байдал харагдана.
 *
 * ⚠ Татацыг НЭГ УДАА хийнэ. Урьд нь нэгтгэсэн нүд ба түүхий цэг гэсэн
 * ХОЁР зам тус тусдаа бүх бичлэгийг татдаг байсан (хоёр дахин ажил).
 * Одоо нэг явцад хоёулаа угсарна.
 *
 * `PLI` нь Pollution Load Index — бохирдлын ачааллын индекс (хэлтэс
 * баталсан, 2026-08-17). Хөрсний мониторингийн PLI-тэй ижил нэртэй ч
 * ЭНД 1.0–4.0 хооронд л савладаг тул хуваарь нь тэрхүү датагийнхтай
 * адилхан эсэхийг БАТЛААГҮЙ — 1-ийг "дэвсгэр түвшин" гэж бүү үз.
 *
 * `toilet_zon` (1–4) юуг илэрхийлж байгаа нь ХЭВЭЭР тодорхойгүй, хэлтсээс
 * асуух ёстой. Тиймээс дэлгэц дээр "1-р бүс" гэж БАЙГААГААР нь харуулна —
 * таамаглаж нэрлэхгүй.
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";

/* ⚠ Давхаргын дугаар 0 ба 1 — шинэ портал дээр бүх үйлчилгээ нэг
   дараалалтай нийтлэгдсэн тул хоёулаа 0 БИШ */
export const PIT_SERVICE = `${HOSTING}/Hosted/X10_UB_pit_toilet/FeatureServer/0`;
export const CITY_SERVICE = `${HOSTING}/Hosted/X10_City_toilet/FeatureServer/1`;

const PAGE = 2000;
/** Зэрэг явуулах хүсэлтийн тоо — дараалуулбал минут гаруй үргэлжилнэ */
const CONCURRENCY = 8;

/** Газрын зургийн нүдний хэмжээ (градус) — ~220 метр */
export const CELL = 0.002;
/** Бүсийн ангилал: 1–4. Эх сурвалжид -9999 нь "утга алга" */
export const ZONES = [1, 2, 3, 4];
/** PLI-г 0.1-ийн алхамтай 1.0–4.0 хооронд савлана */
export const PLI_MIN = 1;
export const PLI_STEP = 0.1;

/**
 * Ойртсон харагдацад татах ДЭЛГЭРЭНГҮЙ цэгийн дээд хязгаар.
 *
 * Үйлчилгээ нэг хүсэлтэд 2000-аас олон буцаадаггүй (`maxRecordCount`)
 * тул хуудаслана. 1:20 000 масштабын харагдацад нягт хороололд ~5 мянган
 * цэг тохиолдож байсан; дөрвөн хуудас (8000) нь түүнийг давна. Үүнээс
 * олон бол таслах бөгөөд ЧИМЭЭГҮЙ өнгөрөхгүй — консолд бичнэ.
 */
const DETAIL_PAGES = 4;
export const PLI_BUCKETS = 31;

export type ToiletsPayload = {
  /** Нийт нүхэн жорлон */
  n: number;
  /** Бүс тодорхойлогдоогүй бичлэг */
  unzoned: number;
  districts: string[];
  /** Хорооны код ("ХУД_12") — эх сурвалжид нэр байхгүй */
  khoroos: string[];
  /** Хороо бүр аль дүүрэгт хамаарах вэ (`districts` доторх индекс) */
  khDistrict: number[];

  /* --- Газрын зургийн нүд (бүгд ижил урттай) --- */
  lon: number[];
  lat: number[];
  /** Нүд доторх тоо, бүсээр: [z1, z2, z3, z4] задарсан хавтгай массив */
  cellZone: number[];
  /** Нүд аль дүүрэгт хамаарах вэ */
  cellDistrict: number[];

  /* --- Диаграмын хөндлөн хүснэгт --- */
  /**
   * хороо × 4 бүс × 31 PLI сав. Тоо ба ДУНДАЖ PLI хоёуланг эндээс гаргана
   * (савны голч утгаар жигнэж). Зөвхөн тоо хадгалбал "хаана хамгийн муу
   * байна" гэсэн асуултад хариулах боломжгүй байв.
   */
  khZonePli: number[];
  /** дүүрэг × 4 бүс × 31 PLI сав */
  distZonePli: number[];

  fetchedAt: string;
};

type Feature = {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number } | null;
};

function page(offset: number) {
  return `${PIT_SERVICE}/query?${new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "toilet_zon,pli,duureg,kh_mon",
    outSR: "4326",
    returnGeometry: "true",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    orderByFields: "objectid ASC",
  })}`;
}

/**
 * Харагдацын хүрээн доторх БОДИТ жорлонгууд.
 *
 * ХӨТӨЧӨӨС ШУУД дуудагдана — `api/` зам биш. Хүрээ нь хэрэглэгчийн
 * гүйлгэлтээс хамаардаг тул статикаар экспортлогдсон API зам үүнийг
 * үйлчилж чадахгүй.
 *
 * Атрибут ТАТАХГҮЙ (`objectid` л): энэ давхарга нь "энд яг хаана байна"
 * гэдгийг л хэлнэ, бусад тоог нэгтгэсэн самбар аль хэдийн хэлж байгаа.
 * `geometryPrecision=5` (~1 метр) нь бичлэг тутмын хэмжээг гуравны нэгээр
 * багасгана — нэг хуудас 273KB-аас ~180KB болно.
 */
export async function fetchPitPointsIn(
  bounds: [number, number, number, number],
  where: string,
  signal: AbortSignal,
): Promise<GeoJSON.FeatureCollection> {
  const features: GeoJSON.Feature[] = [];

  for (let p = 0; p < DETAIL_PAGES; p++) {
    const url = `${PIT_SERVICE}/query?${new URLSearchParams({
      f: "geojson",
      where,
      geometry: bounds.join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "objectid",
      returnGeometry: "true",
      geometryPrecision: "5",
      resultOffset: String(p * PAGE),
      resultRecordCount: String(PAGE),
      orderByFields: "objectid ASC",
    })}`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Жорлонгийн цэг татагдсангүй (${res.status})`);
    const json = (await res.json()) as { features?: GeoJSON.Feature[] };
    const got = json.features ?? [];
    features.push(...got);
    /* Дүүрээгүй хуудас = сүүлчийнх */
    if (got.length < PAGE) return { type: "FeatureCollection", features };
  }

  console.warn(
    `[toilets] Харагдацад ${DETAIL_PAGES * PAGE}-аас олон жорлон байна — үлдсэнийг татсангүй`,
  );
  return { type: "FeatureCollection", features };
}

/** Толь бичиг — нэрийг индекс болгоно */
function dict() {
  const list: string[] = [];
  const index = new Map<string, number>();
  return {
    list,
    add(v: string) {
      let i = index.get(v);
      if (i === undefined) {
        i = list.push(v) - 1;
        index.set(v, i);
      }
      return i;
    },
  };
}

/**
 * Бүх цэгийн НЭГ УДААГИЙН татац — нэгтгэл ба түүхий цэг хоёулаа эндээс.
 *
 * ⚠ Урьд нь `getToilets()` ба `getToiletPointsBuffer()` гэсэн ХОЁР функц
 * тус тусдаа 145 мянган бичлэгийг татдаг байв (хоёр дахин ажил), учир нь
 * нэг нь бүтээх мөчийн JSON, нөгөө нь хоёртын багц үйлдвэрлэдэг байлаа.
 * Хоёулаа хөтөч рүү шилжсэн тул тэр хуваалт утгагүй болов: нэг явцад
 * нүдийг хуримтлуулж, зэрэг цэгийн массивыг дүүргэнэ.
 *
 * ⚠ ДҮҮРГИЙН ТОЛЬ НЭГ. Хоёр функц тусдаа толь барьдаг байсан тул хуудас
 * ирэх дараалал зөрвөл цэгийн дүүрэг чимээгүйхэн буруу заах эрсдэлтэй
 * байв. Одоо ганц `districts` толь хоёуланд нь үйлчилнэ.
 *
 * Цэгийн координат `Float32Array`-д сууна: ~1.4 метрийн алдаатай ч
 * жорлонгийн байрлал өөрөө GPS-ийн алдаатай тул дүрслэлд мэдэгдэхгүй.
 * 145 мянган бичлэгт 8 байт (хоёр float32) — нийт ~1.2MB санах ой.
 */
export async function fetchToilets(signal?: AbortSignal): Promise<ToiletsData> {
  const counted = await arcgisJson<{ count: number }>(
    `${PIT_SERVICE}/query?${new URLSearchParams({
      f: "json",
      where: "1=1",
      returnCountOnly: "true",
    })}`,
    "Нүхэн жорлонгийн тоо",
    signal ? { signal } : undefined,
  );
  const count = counted.count;
  const pages = Math.ceil(count / PAGE);

  const districts = dict();
  const khoroos = dict();
  const khDistrict: number[] = [];

  /** Нүдний түлхүүр ("x,y") → индекс */
  const cellIndex = new Map<string, number>();
  const lon: number[] = [];
  const lat: number[] = [];
  const cellZone: number[] = [];
  const cellDistrict: number[] = [];

  const khZonePli: number[] = [];
  const distZonePli: number[] = [];

  /* Цэгийн массивыг тооллогоор урьдчилан хуваарилна — өсгөж явбал
     145 мянган удаа дахин хуваарилагдана */
  const coords = new Float32Array(count * 2);
  const pDistrict = new Uint8Array(count);
  const pZone = new Uint8Array(count);

  let n = 0;
  let unzoned = 0;

  const take = (feats: Feature[]) => {
    for (const f of feats) {
      const g = f.geometry;
      if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
      const a = f.attributes;

      const dName = String(a.duureg ?? "").trim() || "Тодорхойгүй";
      const di = districts.add(dName);
      const kName = String(a.kh_mon ?? "").trim() || "Тодорхойгүй";
      const ki = khoroos.add(kName);
      khDistrict[ki] = di;

      const zRaw = Number(a.toilet_zon);
      const z = ZONES.includes(zRaw) ? zRaw : 0; // 0 = тодорхойгүй
      if (!z) unzoned++;

      /* --- түүхий цэг --- */
      if (n < count) {
        coords[n * 2] = g.x;
        coords[n * 2 + 1] = g.y;
        pDistrict[n] = di;
        pZone[n] = z;
      }
      n++;

      /* --- нүд --- */
      const key = `${Math.round(g.x / CELL)},${Math.round(g.y / CELL)}`;
      let ci = cellIndex.get(key);
      if (ci === undefined) {
        ci = lon.length;
        cellIndex.set(key, ci);
        lon.push(Math.round(Math.round(g.x / CELL) * CELL * 1e5) / 1e5);
        lat.push(Math.round(Math.round(g.y / CELL) * CELL * 1e5) / 1e5);
        cellDistrict.push(di);
        cellZone.push(0, 0, 0, 0);
      }
      if (z) cellZone[ci * 4 + (z - 1)]++;

      /* --- дүүрэг ба хороо × бүс × PLI --- */
      const pli = Number(a.pli);
      if (z && Number.isFinite(pli) && pli >= PLI_MIN) {
        const b = Math.min(
          PLI_BUCKETS - 1,
          Math.max(0, Math.round((pli - PLI_MIN) / PLI_STEP)),
        );
        const dAt = (di * 4 + (z - 1)) * PLI_BUCKETS + b;
        distZonePli[dAt] = (distZonePli[dAt] ?? 0) + 1;
        const kAt = (ki * 4 + (z - 1)) * PLI_BUCKETS + b;
        khZonePli[kAt] = (khZonePli[kAt] ?? 0) + 1;
      }
    }
  };

  for (let i = 0; i < pages; i += CONCURRENCY) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pages - i) }, (_, k) =>
        arcgisJson<{ features?: Feature[] }>(
          page((i + k) * PAGE),
          "Нүхэн жорлон",
          signal ? { signal } : undefined,
        ),
      ),
    );
    for (const r of batch) take(r.features ?? []);
  }

  /* Сийрэг массивуудыг нягтруулна */
  const dense = (arr: number[], len: number) =>
    Array.from({ length: len }, (_, i) => arr[i] ?? 0);

  /* Геометргүй бичлэг байвал тооллогоос бага гарна — илүүдлийг таслана */
  const kept = Math.min(n, count);

  return {
    payload: {
      n,
      unzoned,
      districts: districts.list,
      khoroos: khoroos.list,
      khDistrict,
      lon,
      lat,
      cellZone,
      cellDistrict,
      khZonePli: dense(khZonePli, khoroos.list.length * 4 * PLI_BUCKETS),
      distZonePli: dense(distZonePli, districts.list.length * 4 * PLI_BUCKETS),
      fetchedAt: new Date().toISOString(),
    },
    points: {
      n: kept,
      districts: districts.list,
      coords: coords.subarray(0, kept * 2),
      district: pDistrict.subarray(0, kept),
      zone: pZone.subarray(0, kept),
    },
  };
}

/** Газрын зургийн ойртсон харагдацад хэрэглэгдэх түүхий цэгүүд */
export type ToiletPoints = {
  n: number;
  districts: string[];
  /** lon, lat ээлжлэн */
  coords: Float32Array;
  district: Uint8Array;
  zone: Uint8Array;
};

export type ToiletsData = { payload: ToiletsPayload; points: ToiletPoints };

/* --------------------------------------------------------------------------
   Нийтийн бие засах газар — ердөө 17 цэг тул хөтөч шууд татна
   -------------------------------------------------------------------------- */

export type CityToilet = {
  oid: number;
  lon: number;
  lat: number;
  district: string;
  khoroo: number | null;
};

export async function fetchCityToilets(signal?: AbortSignal): Promise<CityToilet[]> {
  const url = `${CITY_SERVICE}/query?${new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "objectid,duureg,khorooid",
    outSR: "4326",
    returnGeometry: "true",
  })}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
  const json = (await res.json()) as { features?: Feature[] };

  const out: CityToilet[] = [];
  for (const f of json.features ?? []) {
    const g = f.geometry;
    if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
    out.push({
      oid: Number(f.attributes.objectid),
      lon: g.x,
      lat: g.y,
      district: String(f.attributes.duureg ?? "").trim() || "Тодорхойгүй",
      khoroo:
        typeof f.attributes.khorooid === "number" ? f.attributes.khorooid : null,
    });
  }
  return out;
}
