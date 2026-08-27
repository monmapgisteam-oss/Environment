/**
 * Байгалийн ургамлын олон янз байдал — ХАГ.
 *
 * 2,391 бичлэг нь ТАРХАЛТЫН ХҮСНЭГТ: 184 зүйл × 41 цэгийн уулзвар.
 * Нэг бичлэг = "энэ зүйл энэ цэгт бүртгэгдсэн" гэсэн утга. Тиймээс
 * "хэдэн бичлэг" гэсэн тоо нь зүйлийн ч, цэгийн ч тоо БИШ.
 *
 * **Координат нь ЦЭГИЙН түвшинд.** `LON`/`LAT` нь зүйл бүрийнх биш
 * бүртгэлийн цэгийнх тул нэг цэгийн олон зүйл ЯГ давхарлана. Газрын
 * зурагт зүйл бүрийг цэг болгож зурвал 178 зүйл нэг пикселд овоолно —
 * тиймээс газрын зураг дээр ЦЭГ (site) харагдана, тэдгээрийн хэмжээ нь
 * тухайн цэгт бүртгэгдсэн зүйлийн тоог хэлнэ.
 *
 * `REC_TYPE` нь гурван утгатай:
 *   · `species` (2,380) — жинхэнэ тархалтын бичлэг
 *   · `site_only` (9) — цэг нь бүртгэгдсэн ч зүйл хавсрагдаагүй
 *   · `no_distrib` (2) — зүйлийн үзүүлэлт бүрэн ч координатгүй
 * Сүүлийн хоёрыг зүйлийн тоололд ОРУУЛАХГҮЙ, харин цэгийн жагсаалтад
 * `site_only` нь үлдэнэ — тэр цэгүүд бодитоор судлагдсан.
 *
 * **Ангиллын бичиглэл жигд бус.** "Бутлаг"/"бутлаг",
 * "Хүйтсүү чийгсэг"/"Хүйтсүү Чийгсэг" зэрэг эхний үсгийн ялгаа бий тул
 * бүлэглэхээс өмнө нэгэн жигд болгоно — эс тэгвээс нэг ангилал хоёр
 * мөр болно.
 *
 * Тайлбарын урт талбарууд (`DIAG_CHAR`, `CURR_STAT`, `PHENOLOGY`,
 * `HABITAT` …) нь зүйл бүрд давтагддаг бөгөөд хэдэн зуун тэмдэгт тул
 * ЭХНИЙ татацад ОРОХГҮЙ — сонгосон зүйлийн дэлгэрэнгүйг тухай бүрд нь
 * татна (`fetchLichenDetail`).
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "Urgamal_hag";
const PAGE = 2000;

export const LICHENS_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

/** Ховордлын зэрэг — IUCN-ий олон улсын товчлол, эрсдэл өсөх дарааллаар */
export const IUCN_ORDER = ["LC", "NT", "VU", "EN", "CR", "DD"] as const;

/** Товчлолын тайлбар — эх сурвалж өгөөгүй тул IUCN-ий албан ёсны нэршил */
export const IUCN_LABEL: Record<string, string> = {
  LC: "LC · Санаа зовох шаардлагагүй",
  NT: "NT · Ховордож болзошгүй",
  VU: "VU · Эмзэг",
  EN: "EN · Ховордсон",
  CR: "CR · Ноцтой ховордсон",
  DD: "DD · Мэдээлэл дутмаг",
};

export type LichenRecord = {
  oid: number;
  /** Шинжлэх ухааны нэр — "Acarospora badiofusca" */
  sci: string;
  /** Монгол нэр */
  mn: string;
  family: string;
  genus: string;
  /** IUCN зэрэг — бөглөгдөөгүй бол "—" */
  iucn: string;
  /** Экологийн бүлэг — "Хүйтсүү чийгсэг" */
  ecogroup: string;
  /** Амьдралын хэлбэр — "илтэслэг", "наалдмал" … */
  lifeform: string;
  /** Индикатор чанар — "агаар орчны цэвэр байдлын" гэх мэт */
  indicator: string;
  /** Ямар суурин дээр ургадаг — "холтос, өмх мод" */
  substrate: string;
  district: string;
  /** Бүртгэлийн цэгийн код — "NA.1" */
  siteCode: string;
};

export type LichenSite = {
  code: string;
  name: string;
  district: string;
  lon: number;
  lat: number;
  /** Далайн түвшнээс дээших өндөр, м */
  elev: number | null;
  /** Энэ цэгт бүртгэгдсэн зүйлийн тоо */
  species: number;
};

export type LichenData = {
  rows: LichenRecord[];
  sites: LichenSite[];
  points: { oid: number[]; lon: number[]; lat: number[] };
  /** Координатгүй үлдсэн зүйлийн тоо (`no_distrib`) */
  noDistrib: number;
};

/** Сонгосон зүйлийн дэлгэрэнгүй — тухай бүрд нь татна */
export type LichenDetail = {
  sci: string;
  mn: string;
  author: string;
  habitat: string;
  substrate: string;
  /** Оношлох шинж — хэдэн зуун тэмдэгт бичвэр */
  diag: string;
  /** Одоогийн байдал */
  status: string;
  /** Улирлын хөгжил */
  phenology: string;
  adaptation: string;
  growth: string;
  reprod: string;
  cultivate: string;
  distrStat: string;
  use: string;
  ecorole: string;
};

type Props = {
  OBJECTID: number;
  REC_TYPE?: string;
  SCI_NAME?: string;
  NAME_MN?: string;
  FAMILY?: string;
  GENUS?: string;
  IUCN?: string;
  ECOGROUP?: string;
  LIFEFORM?: string;
  INDICATOR?: string;
  SUBSTRATE?: string;
  DISTRICT?: string;
  SITE_CODE?: string;
  SITE_NAME?: string;
  LON?: number;
  LAT?: number;
  ELEV_M?: number;
};

const FIELDS = [
  "OBJECTID",
  "REC_TYPE",
  "SCI_NAME",
  "NAME_MN",
  "FAMILY",
  "GENUS",
  "IUCN",
  "ECOGROUP",
  "LIFEFORM",
  "INDICATOR",
  "SUBSTRATE",
  "DISTRICT",
  "SITE_CODE",
  "SITE_NAME",
  "LON",
  "LAT",
  "ELEV_M",
];

const tidy = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/**
 * Ангиллын бичвэрийг нэгэн жигд болгоно.
 *
 * Эхний үсгийг том, үлдсэнийг жижиг болгоно: эх сурвалжид ижил ангилал
 * хоёр өөр бичиглэлтэй тохиолдож байгаа тул бүлэглэхэд хоёр мөр болно.
 */
function norm(raw: string | undefined | null): string {
  const t = tidy(raw);
  if (!t || t === "null") return "";
  return t.charAt(0).toLocaleUpperCase("mn-MN") + t.slice(1).toLocaleLowerCase("mn-MN");
}

async function page(offset: number): Promise<{ properties: Props }[]> {
  const url =
    `${LICHENS_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: FIELDS.join(","),
      returnGeometry: "false",
      orderByFields: "OBJECTID",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: "geojson",
    });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Хагийн мэдээлэл татагдсангүй (${res.status})`);
  const json = (await res.json()) as { features?: { properties: Props }[] };
  return json.features ?? [];
}

export async function fetchLichens(): Promise<LichenData> {
  /*
    Геометрийг ТАТАХГҮЙ (`returnGeometry: false`): цэгийн координат
    атрибутад (`LON`/`LAT`) аль хэдийн бий бөгөөд 2,391 мөрийн бараг
    бүгд нь ижил 41 цэгийг давтдаг — дэмий жин.
  */
  const pages = await Promise.all([page(0), page(PAGE)]);
  const feats = pages.flat();

  const rows: LichenRecord[] = [];
  const sites = new Map<string, LichenSite>();
  let noDistrib = 0;

  for (const f of feats) {
    const p = f.properties;
    const type = tidy(p.REC_TYPE);
    const code = tidy(p.SITE_CODE);

    if (type === "no_distrib") {
      noDistrib++;
      continue;
    }

    /* Цэгийн бүртгэл — зүйлгүй мөр ч цэгээ үлдээнэ */
    if (code && !sites.has(code)) {
      sites.set(code, {
        code,
        name: tidy(p.SITE_NAME) || code,
        district: tidy(p.DISTRICT) || "Тодорхойгүй",
        lon: Number(p.LON),
        lat: Number(p.LAT),
        elev: Number.isFinite(Number(p.ELEV_M)) ? Number(p.ELEV_M) : null,
        species: 0,
      });
    }

    if (type !== "species") continue;

    const site = sites.get(code);
    if (site) site.species++;

    rows.push({
      oid: Number(p.OBJECTID),
      sci: tidy(p.SCI_NAME) || "—",
      mn: tidy(p.NAME_MN),
      family: tidy(p.FAMILY) || "Тодорхойгүй",
      genus: tidy(p.GENUS) || "Тодорхойгүй",
      iucn: tidy(p.IUCN) || "—",
      ecogroup: norm(p.ECOGROUP) || "Тодорхойгүй",
      lifeform: norm(p.LIFEFORM) || "Тодорхойгүй",
      indicator: norm(p.INDICATOR) || "Тодорхойгүй",
      substrate: norm(p.SUBSTRATE) || "Тодорхойгүй",
      district: tidy(p.DISTRICT) || "Тодорхойгүй",
      siteCode: code,
    });
  }

  /* Координатгүй цэгийг газрын зурагт оруулахгүй */
  const siteList = [...sites.values()].filter(
    (s) => Number.isFinite(s.lon) && Number.isFinite(s.lat),
  );
  siteList.sort((a, b) => b.species - a.species);

  const points = {
    oid: siteList.map((_, i) => i + 1),
    lon: siteList.map((s) => s.lon),
    lat: siteList.map((s) => s.lat),
  };

  return { rows, sites: siteList, points, noDistrib };
}

/**
 * Нэг зүйлийн дэлгэрэнгүй тайлбар.
 *
 * Урт бичвэрүүд зүйлийн МӨР БҮРД давтагддаг тул эхний татацад
 * оруулаагүй. Энд ганц мөр л татна.
 */
export async function fetchLichenDetail(sci: string): Promise<LichenDetail | null> {
  const url =
    `${LICHENS_SERVICE}/query?` +
    new URLSearchParams({
      /* Нэрэнд ганц хашилт орвол SQL нь эвдэрнэ — хоёр дахин бичиж мултална */
      where: `SCI_NAME='${sci.replace(/'/g, "''")}'`,
      outFields: [
        "SCI_NAME",
        "NAME_MN",
        "AUTHOR",
        "HABITAT",
        "SUBSTRATE",
        "DIAG_CHAR",
        "CURR_STAT",
        "PHENOLOGY",
        "ADAPTATION",
        "GROWTH",
        "REPROD",
        "CULTIVATE",
        "DISTR_STAT",
        "USE_",
        "ECOROLE_2",
      ].join(","),
      returnGeometry: "false",
      resultRecordCount: "1",
      f: "json",
    });

  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    features?: { attributes: Record<string, string | null> }[];
  };
  const a = json.features?.[0]?.attributes;
  if (!a) return null;

  return {
    sci: tidy(a.SCI_NAME),
    mn: tidy(a.NAME_MN),
    author: tidy(a.AUTHOR),
    habitat: tidy(a.HABITAT),
    substrate: tidy(a.SUBSTRATE),
    diag: tidy(a.DIAG_CHAR),
    status: tidy(a.CURR_STAT),
    phenology: tidy(a.PHENOLOGY),
    adaptation: tidy(a.ADAPTATION),
    growth: tidy(a.GROWTH),
    reprod: tidy(a.REPROD),
    cultivate: tidy(a.CULTIVATE),
    distrStat: tidy(a.DISTR_STAT),
    use: tidy(a.USE_),
    ecorole: tidy(a.ECOROLE_2),
  };
}
