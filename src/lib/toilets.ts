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
 * `PLI` нь Pollution Load Index — бохирдлын ачааллын индекс (хэлтэс
 * баталсан, 2026-08-17). Хөрсний мониторингийн PLI-тэй ижил нэртэй ч
 * ЭНД 1.0–4.0 хооронд л савладаг тул хуваарь нь тэрхүү датагийнхтай
 * адилхан эсэхийг БАТЛААГҮЙ — 1-ийг "дэвсгэр түвшин" гэж бүү үз.
 *
 * `Toilet_zon` (1–4) юуг илэрхийлж байгаа нь ХЭВЭЭР тодорхойгүй, хэлтсээс
 * асуух ёстой. Тиймээс дэлгэц дээр "1-р бүс" гэж БАЙГААГААР нь харуулна —
 * таамаглаж нэрлэхгүй.
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
    outFields: "Toilet_zon,PLI,DUUREG,KH_MON",
    outSR: "4326",
    returnGeometry: "true",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    orderByFields: "OBJECTID ASC",
  })}`;
}

/**
 * Харагдацын хүрээн доторх БОДИТ жорлонгууд.
 *
 * ХӨТӨЧӨӨС ШУУД дуудагдана — `api/` зам биш. Хүрээ нь хэрэглэгчийн
 * гүйлгэлтээс хамаардаг тул статикаар экспортлогдсон API зам үүнийг
 * үйлчилж чадахгүй.
 *
 * Атрибут ТАТАХГҮЙ (`OBJECTID` л): энэ давхарга нь "энд яг хаана байна"
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
      outFields: "OBJECTID",
      returnGeometry: "true",
      geometryPrecision: "5",
      resultOffset: String(p * PAGE),
      resultRecordCount: String(PAGE),
      orderByFields: "OBJECTID ASC",
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
   БҮХ цэг нягт хоёртын хэлбэрээр
   -------------------------------------------------------------------------- */

/**
 * 145 мянган жорлонгийн байршлыг хөтөч рүү хүргэх багц.
 *
 * GeoJSON-оор 14MB болдог тул нүдэнд нэгтгэдэг байсан. Гэвч нэгтгэсэн
 * нүд нь 220 метрийн ХИЙМЭЛ СҮЛЖЭЭ үүсгэдэг — ойртоход жорлон хашаандаа
 * хаана байгааг биш, нүдний төвийг харуулна. Хоёртын хэлбэрээр бол
 * бичлэг тутам 10 байт л шаардана:
 *
 *   [0..4)      u32   толгойн урт
 *   [4..4+h)    JSON  { n, districts }
 *   дараа нь    f32   lon, lat ээлжлэн (n×2)
 *   дараа нь    u8    дүүргийн индекс (n)
 *   дараа нь    u8    бүс 0..4, 0 = тодорхойгүй (n)
 *
 * Нийт ~1.4MB — нэгтгэсэн 279KB-аас том ч 14MB-аас арав дахин бага.
 *
 * float32 нь ~1.4 метрийн алдаатай. Жорлонгийн байрлал өөрөө GPS-ийн
 * алдаатай тул энэ нь дүрслэлд мэдэгдэхгүй; яг нарийн координат хэрэгтэй
 * бол `fetchPitPointsIn` шууд эх сурвалжаас авна.
 *
 * Дүүргийн толь бичгийг ДОТРОО авч явна: `getToilets`-ийн жагсаалттай
 * индексээр уялдуулбал хоёр функцийн хуудас ирэх дараалал зөрөхөд
 * чимээгүйхэн буруу дүүрэг заана.
 */
export async function getToiletPointsBuffer(): Promise<ArrayBuffer> {
  const first = await fetch(`${PIT_SERVICE}/query?${new URLSearchParams({
    f: "json",
    where: "1=1",
    returnCountOnly: "true",
  })}`, { next: { revalidate: 86400 } });
  const { count } = (await first.json()) as { count: number };
  const pages = Math.ceil(count / PAGE);

  const districts = dict();
  const lon: number[] = [];
  const lat: number[] = [];
  const di: number[] = [];
  const zn: number[] = [];

  const take = (feats: Feature[]) => {
    for (const f of feats) {
      const g = f.geometry;
      if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
      const a = f.attributes;
      lon.push(g.x);
      lat.push(g.y);
      di.push(districts.add(String(a.DUUREG ?? "").trim() || "Тодорхойгүй"));
      const zRaw = Number(a.Toilet_zon);
      zn.push(ZONES.includes(zRaw) ? zRaw : 0);
    }
  };

  /* `getToilets`-тэй ЯГ ижил хаяг тул Next-ийн fetch кэшээс уншина —
     бүтээх үед хоёр дахин татахгүй */
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

  const n = lon.length;
  const header = new TextEncoder().encode(
    JSON.stringify({ n, districts: districts.list }),
  );
  /* f32 нь 4 байтын заагт эхлэх ёстой */
  const pad = (4 - ((4 + header.length) % 4)) % 4;
  const coordsAt = 4 + header.length + pad;

  const buf = new ArrayBuffer(coordsAt + n * 8 + n * 2);
  /* Уртад НЬ дүүргэлт ОРОХГҮЙ — задлагч нь ижил томъёогоор дахин бодно.
     Дүүргэлтийг оруулбал JSON-ы араас тэг байт унших ба задлалт унана. */
  new DataView(buf).setUint32(0, header.length, true);
  new Uint8Array(buf, 4, header.length).set(header);

  const coords = new Float32Array(buf, coordsAt, n * 2);
  for (let i = 0; i < n; i++) {
    coords[i * 2] = lon[i];
    coords[i * 2 + 1] = lat[i];
  }
  new Uint8Array(buf, coordsAt + n * 8, n).set(di);
  new Uint8Array(buf, coordsAt + n * 8 + n, n).set(zn);

  return buf;
}

/** Хөтөч дээрх задлалт — `getToiletPointsBuffer`-ийн эсрэг үйлдэл */
export type ToiletPoints = {
  n: number;
  districts: string[];
  /** lon, lat ээлжлэн */
  coords: Float32Array;
  district: Uint8Array;
  zone: Uint8Array;
};

export function decodeToiletPoints(buf: ArrayBuffer): ToiletPoints {
  const headLen = new DataView(buf).getUint32(0, true);
  const head = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buf, 4, headLen)),
  ) as { n: number; districts: string[] };
  const pad = (4 - ((4 + headLen) % 4)) % 4;
  const at = 4 + headLen + pad;
  const n = head.n;
  return {
    n,
    districts: head.districts,
    coords: new Float32Array(buf, at, n * 2),
    district: new Uint8Array(buf, at + n * 8, n),
    zone: new Uint8Array(buf, at + n * 8 + n, n),
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
