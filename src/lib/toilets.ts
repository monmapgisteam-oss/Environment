/**
 * Хүрээлэн буй орчны ашиглалт хамгаалалтын хэлтэс — ариун цэврийн байгууламж.
 *
 * ХОЁР эх сурвалж, тэс өөр хэмжээтэй:
 *  1. `UB_pit_toilet` — 145,462 нүхэн жорлон, орчны эрсдэлийн үнэлгээтэй.
 *  2. `City_toilet` — 17 нийтийн бие засах газар.
 *
 * ⚠️ 145 мянган цэгийг хөтөч рүү бүтнээр нь илгээх боломжгүй (14MB). Тиймээс
 * СЕРВЕР ДЭЭР нэгтгэнэ: газрын зурагт ~220м-ийн НҮДЭНД хуримтлуулсан тоо,
 * диаграмд урьдчилан бэлдсэн хөндлөн хүснэгт. Үр дүн ~500KB.
 *
 * Талбарын УТГА нь эх сурвалжид тайлбарлагдаагүй: `Toilet_zon` (1–4) ба
 * `PLI` (1–4) юуг илэрхийлж байгааг хэлтсээс асуух ёстой. Тиймээс дэлгэц
 * дээр "1-р бүс", "PLI" гэж БАЙГААГААР нь харуулна — таамаглаж нэрлэхгүй.
 */

export const PIT_SERVICE =
  "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services/UB_pit_toilet/FeatureServer/0";
export const CITY_SERVICE =
  "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services/City_toilet/FeatureServer/0";

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
    outFields: "Toilet_zon,PLI,DUUREG,KH_MON",
    outSR: "4326",
    returnGeometry: "true",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    orderByFields: "OBJECTID ASC",
  })}`;
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

export async function getToilets(): Promise<ToiletsPayload> {
  const first = await fetch(`${PIT_SERVICE}/query?${new URLSearchParams({
    f: "json",
    where: "1=1",
    returnCountOnly: "true",
  })}`, { next: { revalidate: 86400 } });
  const { count } = (await first.json()) as { count: number };
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

  let n = 0;
  let unzoned = 0;

  const take = (feats: Feature[]) => {
    for (const f of feats) {
      const g = f.geometry;
      if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
      const a = f.attributes;

      const dName = String(a.DUUREG ?? "").trim() || "Тодорхойгүй";
      const di = districts.add(dName);
      const kName = String(a.KH_MON ?? "").trim() || "Тодорхойгүй";
      const ki = khoroos.add(kName);
      khDistrict[ki] = di;

      const zRaw = Number(a.Toilet_zon);
      const z = ZONES.includes(zRaw) ? zRaw : 0; // 0 = тодорхойгүй
      if (!z) unzoned++;
      n++;

      /* --- нүд --- */
      const key = `${Math.round(g.x / CELL)},${Math.round(g.y / CELL)}`;
      let ci = cellIndex.get(key);
      if (ci === undefined) {
        ci = lon.length;
        cellIndex.set(key, ci);
        lon.push(Math.round((Math.round(g.x / CELL) * CELL) * 1e5) / 1e5);
        lat.push(Math.round((Math.round(g.y / CELL) * CELL) * 1e5) / 1e5);
        cellDistrict.push(di);
        cellZone.push(0, 0, 0, 0);
      }
      if (z) cellZone[ci * 4 + (z - 1)]++;

      /* --- дүүрэг ба хороо × бүс × PLI --- */
      const pli = Number(a.PLI);
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
        fetch(page((i + k) * PAGE), { next: { revalidate: 86400 } }).then((r) => {
          if (!r.ok) throw new Error(`ArcGIS ${r.status}`);
          return r.json() as Promise<{ features?: Feature[] }>;
        }),
      ),
    );
    for (const r of batch) take(r.features ?? []);
  }

  /* Сийрэг массивуудыг нягтруулна — JSON дотор `null` болж хувирахаас сэргийлнэ */
  const dense = (arr: number[], len: number) =>
    Array.from({ length: len }, (_, i) => arr[i] ?? 0);

  return {
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
  };
}

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
    outFields: "OBJECTID,DUUREG,KHOROOID",
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
      oid: Number(f.attributes.OBJECTID),
      lon: g.x,
      lat: g.y,
      district: String(f.attributes.DUUREG ?? "").trim() || "Тодорхойгүй",
      khoroo:
        typeof f.attributes.KHOROOID === "number" ? f.attributes.KHOROOID : null,
    });
  }
  return out;
}
