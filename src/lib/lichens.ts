/**
 * Байгалийн ургамлын олон янз байдал — ХАГ.
 *
 * 2,391 бичлэг нь ТАРХАЛТЫН ХҮСНЭГТ: 184 зүйл × 41 цэгийн уулзвар.
 * Нэг бичлэг = "энэ зүйл энэ цэгт бүртгэгдсэн" гэсэн утга. Тиймээс
 * "хэдэн бичлэг" гэсэн тоо нь зүйлийн ч, цэгийн ч тоо БИШ.
 *
 * **Координат нь ЦЭГИЙН түвшинд.** `lon`/`lat` нь зүйл бүрийнх биш
 * бүртгэлийн цэгийнх тул нэг цэгийн олон зүйл ЯГ давхарлана. Газрын
 * зурагт зүйл бүрийг цэг болгож зурвал 178 зүйл нэг пикселд овоолно —
 * тиймээс газрын зураг дээр ЦЭГ (site) харагдана, тэдгээрийн хэмжээ нь
 * тухайн цэгт бүртгэгдсэн зүйлийн тоог хэлнэ.
 *
 * `rec_type` нь гурван утгатай:
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
 * Тайлбарын урт талбарууд (`diag_char`, `curr_stat`, `phenology`,
 * `habitat` …) нь зүйл бүрд давтагддаг бөгөөд хэдэн зуун тэмдэгт тул
 * ЭХНИЙ татацад ОРОХГҮЙ — сонгосон зүйлийн дэлгэрэнгүйг тухай бүрд нь
 * татна (`fetchLichenDetail`).
 */

import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";

/*
  ⚠ **ЭХ СУРВАЛЖ ПОРТАЛД ШИЛЖСЭН** (хэрэглэгчийн шийдвэр, 2026-09-16):
  ArcGIS Online дээрх `Urgamal_hag`-аас `environment.ub.gov.mn`-ий
  `A02_hag_sudalgaa` руу. Бичлэгийн тоо ИЖИЛ (2,391), талбарууд ч
  ижил — зөвхөн нэр нь ЖИЖИГ ҮСЭГ болсон (портал PostgreSQL суурьтай)
  бөгөөд `use` нь `use` болсон. Тиймээс самбар өөрчлөгдөөгүй, зөвхөн
  талбарын бичиглэл шинэчлэгдэв.

  Шинэ хост токен шаардана тул бүх хүсэлт `arcgisJson()`-оор явна —
  тэр нь ArcGIS-ийн HTTP 200-аар ирдэг далд алдааг ч барина.
*/
const PAGE = 2000;

export const LICHENS_SERVICE = `${layerService("A02_hag_sudalgaa")}/0`;

/** Ховордлын зэрэг — iucn-ий олон улсын товчлол, эрсдэл өсөх дарааллаар */
export const IUCN_ORDER = ["LC", "NT", "VU", "EN", "CR", "DD"] as const;

/** Товчлолын тайлбар — эх сурвалж өгөөгүй тул iucn-ий албан ёсны нэршил */
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
  /** iucn зэрэг — бөглөгдөөгүй бол "—" */
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
  objectid: number;
  rec_type?: string;
  sci_name?: string;
  name_mn?: string;
  family?: string;
  genus?: string;
  iucn?: string;
  ecogroup?: string;
  lifeform?: string;
  indicator?: string;
  substrate?: string;
  district?: string;
  site_code?: string;
  site_name?: string;
  lon?: number;
  lat?: number;
  elev_m?: number;
};

const FIELDS = [
  "objectid",
  "rec_type",
  "sci_name",
  "name_mn",
  "family",
  "genus",
  "iucn",
  "ecogroup",
  "lifeform",
  "indicator",
  "substrate",
  "district",
  "site_code",
  "site_name",
  "lon",
  "lat",
  "elev_m",
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
      orderByFields: "objectid",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: "geojson",
    });
  const json = await arcgisJson<{ features?: { properties: Props }[] }>(
    url,
    "Хагийн судалгаа",
  );
  return json.features ?? [];
}

export async function fetchLichens(): Promise<LichenData> {
  /*
    Геометрийг ТАТАХГҮЙ (`returnGeometry: false`): цэгийн координат
    атрибутад (`lon`/`lat`) аль хэдийн бий бөгөөд 2,391 мөрийн бараг
    бүгд нь ижил 41 цэгийг давтдаг — дэмий жин.
  */
  const pages = await Promise.all([page(0), page(PAGE)]);
  const feats = pages.flat();

  const rows: LichenRecord[] = [];
  const sites = new Map<string, LichenSite>();
  let noDistrib = 0;

  for (const f of feats) {
    const p = f.properties;
    const type = tidy(p.rec_type);
    const code = tidy(p.site_code);

    if (type === "no_distrib") {
      noDistrib++;
      continue;
    }

    /* Цэгийн бүртгэл — зүйлгүй мөр ч цэгээ үлдээнэ */
    if (code && !sites.has(code)) {
      sites.set(code, {
        code,
        name: tidy(p.site_name) || code,
        district: tidy(p.district) || "Тодорхойгүй",
        lon: Number(p.lon),
        lat: Number(p.lat),
        elev: Number.isFinite(Number(p.elev_m)) ? Number(p.elev_m) : null,
        species: 0,
      });
    }

    if (type !== "species") continue;

    const site = sites.get(code);
    if (site) site.species++;

    rows.push({
      oid: Number(p.objectid),
      sci: tidy(p.sci_name) || "—",
      mn: tidy(p.name_mn),
      family: tidy(p.family) || "Тодорхойгүй",
      genus: tidy(p.genus) || "Тодорхойгүй",
      iucn: tidy(p.iucn) || "—",
      ecogroup: norm(p.ecogroup) || "Тодорхойгүй",
      lifeform: norm(p.lifeform) || "Тодорхойгүй",
      indicator: norm(p.indicator) || "Тодорхойгүй",
      substrate: norm(p.substrate) || "Тодорхойгүй",
      district: tidy(p.district) || "Тодорхойгүй",
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
      where: `sci_name='${sci.replace(/'/g, "''")}'`,
      outFields: [
        "sci_name",
        "name_mn",
        "author",
        "habitat",
        "substrate",
        "diag_char",
        "curr_stat",
        "phenology",
        "adaptation",
        "growth",
        "reprod",
        "cultivate",
        "distr_stat",
        "use",
        "ecorole_2",
      ].join(","),
      returnGeometry: "false",
      resultRecordCount: "1",
      f: "json",
    });

  let json: { features?: { attributes: Record<string, string | null> }[] };
  try {
    json = await arcgisJson(url, "Хагийн дэлгэрэнгүй");
  } catch {
    /* Дэлгэрэнгүй нь НЭМЭЛТ: татагдахгүй бол жагсаалт, зураг хэвээр */
    return null;
  }
  const a = json.features?.[0]?.attributes;
  if (!a) return null;

  return {
    sci: tidy(a.sci_name),
    mn: tidy(a.name_mn),
    author: tidy(a.author),
    habitat: tidy(a.habitat),
    substrate: tidy(a.substrate),
    diag: tidy(a.diag_char),
    status: tidy(a.curr_stat),
    phenology: tidy(a.phenology),
    adaptation: tidy(a.adaptation),
    growth: tidy(a.growth),
    reprod: tidy(a.reprod),
    cultivate: tidy(a.cultivate),
    distrStat: tidy(a.distr_stat),
    use: tidy(a.use),
    ecorole: tidy(a.ecorole_2),
  };
}
