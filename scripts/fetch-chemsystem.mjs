/**
 * HazTrack (chemsystem.mn) — химийн бодисын бүртгэлийн хормын хувилбар.
 *
 * ⚠⚠ ТҮЛХҮҮР ХӨТӨЧ РҮҮ ХЭЗЭЭ Ч ЯВАХГҮЙ. Энэ скрипт нь БҮТЭЭХ ҮЕД л
 * ажиллана: түлхүүрийг орчны хувьсагчаас (`CHEMSYSTEM_KEY`) уншиж,
 * үр дүнг `public/data/chemsystem.json`-д бичнэ. Хөтөч зөвхөн тэр
 * файлыг уншина.
 *
 * Яагаад ийм байх ЁСТОЙ вэ: сайт статикаар экспортлогдож GitHub Pages
 * дээр нийтэд нээлттэй байрладаг. `NEXT_PUBLIC_*` ч бай, кодод шууд
 * бичсэн ч бай — хөтчийн багц руу орсон түлхүүр нь сайт нээсэн хэн
 * бүхэнд ил текстээр харагдана. Энэ API-ийн түлхүүр нь ердийн уншигч
 * биш: тодорхойлолтод `DELETE /chemicals/{id}`, `DELETE /users/{id}`,
 * `PUT /inspections/{id}` зэрэг БИЧИХ зам багтдаг тул ил гарвал
 * үндэсний бүртгэлийг хэн ч өөрчлөх боломжтой болно.
 *
 * Ажиллуулах:
 *   CHEMSYSTEM_KEY=… node scripts/fetch-chemsystem.mjs
 *
 * CI дээр түлхүүрийг Actions Secret-ээс өгнө. Түлхүүр байхгүй бол
 * скрипт ЧИМЭЭГҮЙ гарна — өмнөх хувилбар байрандаа үлдэж, бүтээлт
 * унахгүй.
 */

import { writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data", "chemsystem.json");

const BASE = "https://b.sanbit.mn/api/v1";
/** Серверийн дээд хязгаар — үүнээс их хүсэлт ч 200 мөр буцаана */
const PAGE = 200;

const KEY = process.env.CHEMSYSTEM_KEY ?? "";

/*
  Хостын урд WAF сууж байгаа бөгөөд танил бус агентыг 403-аар хаадаг:
  `node`, `python-urllib` хоёулаа хаагдана. Энгийн хөтчийн агент
  өгснөөр л дамжина — үүнийг хасвал скрипт чимээгүй унана.
*/
const UA = "Mozilla/5.0";

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

/** Нөөцийг бүтнээр нь татна — эхний хуудсаас хойшхийг зэрэг */
async function all(resource) {
  const first = await get(`/${resource}/pagination?page=1&size=${PAGE}`);
  const rows = [...first.data];
  const pages = first.total_pages ?? 1;

  for (let from = 2; from <= pages; from += 8) {
    const batch = [];
    for (let p = from; p < Math.min(from + 8, pages + 1); p++) {
      batch.push(get(`/${resource}/pagination?page=${p}&size=${PAGE}`));
    }
    for (const d of await Promise.all(batch)) rows.push(...d.data);
  }

  if (rows.length !== first.total) {
    throw new Error(`${resource}: ${rows.length} мөр татагдсан ч нийт ${first.total}`);
  }
  return rows;
}

/* --------------------------------------------------------------------------
   ТАЛБАРЫН ЦАГААН ЖАГСААЛТ

   Хормын хувилбар нь НИЙТЭД нээлттэй болох тул талбарыг сонгож биш,
   ЗӨВШӨӨРӨГДСӨНИЙГ НЬ ТҮҮЖ авна. Эх сурвалжид шинэ талбар нэмэгдвэл
   тэр нь өөрөө орж ирэхгүй — санамсаргүй задралаас хамгаалах ганц арга.

   ХАСАГДСАН нь: ААН-ийн `phone` (517/520 бөглөсөн), `email`, хэрэглэгчийн
   жагсаалт (`users`, `user_ids`); устгалын `identity_card_number`
   (иргэний үнэмлэхний дугаар). `/users`, `/logs`, `/me` замууд бүхэлдээ
   татагддаггүй.
   -------------------------------------------------------------------------- */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * ХУВЬ ХҮНИЙ талбарууд — тайланд НЭР нь гарна, УТГА нь ХЭЗЭЭ Ч гарахгүй.
 *
 * Тайлан нь зөвхөн "хэдэн мөрд бөглөгдсөн" гэсэн ТООГ агуулдаг тул
 * эдгээрийг нэрлэх нь өөрөө задрал биш; харин утга нь нийтэд гарах
 * файлд орох ёсгүй.
 */
const PRIVATE = new Set([
  "phone",
  "email",
  "users",
  "user_ids",
  "identity_card_number",
]);

/**
 * ТАЛБАРЫН БӨГЛӨЛТИЙН ТАЙЛАН.
 *
 * ⚠⚠ Яагаад хэрэгтэй вэ (хэрэглэгчийн хүсэлт, 2026-09-23: "хоосон ч
 * хамаагүй бүх column буюу field надад хэрэгтэй, би харж байгаад
 * хүмүүс нь бөглүүрэй гээд хэлэх гээд байна"). Хормын хувилбар нь
 * цагаан жагсаалтаар угсрагддаг тул БӨГЛӨГДӨӨГҮЙ талбар нь файлд
 * огт үлддэггүй — улмаас "энэ талбар байдаг ч хоосон байна" гэдгийг
 * дэлгэцээс мэдэх арга байхгүй байв.
 *
 * Тайлан нь эх сурвалжийн БҮХ талбарыг нэрээр нь, хэдэн мөрд
 * бөглөгдсөнөөр нь жагсаана. Утга агуулдаггүй тул хувь хүний талбар
 * ч аюулгүй — зөвхөн "энэ нэртэй талбар байна, 517 мөрд бөглөгдсөн"
 * гэсэн тоо.
 */
function fieldReport(rows) {
  const seen = new Map();
  for (const r of rows) {
    for (const [k, v] of Object.entries(r ?? {})) {
      const filled =
        v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
      const e = seen.get(k) ?? { filled: 0, kept: !PRIVATE.has(k) };
      if (filled) e.filled++;
      seen.set(k, e);
    }
  }
  return [...seen]
    .map(([field, e]) => ({ field, filled: e.filled, kept: e.kept }))
    .sort((a, b) => b.filled - a.filled || a.field.localeCompare(b.field));
}

async function main() {
  if (!KEY) {
    console.log("chemsystem: CHEMSYSTEM_KEY алга — хормын хувилбарыг алгаслаа");
    return;
  }

  const [chemicals, organizations, locations, holdings, disposes] = await Promise.all([
    all("chemicals"),
    all("organizations"),
    all("locations"),
    all("organization-chemicals"),
    all("chemical-disposes"),
  ]);

  /*
    Толь бичгээс ЗӨВХӨН эзэмшилд орсон бодисыг үлдээнэ. Бүртгэлд 10,217
    нэр байгаагийн 8,117 нь л хаа нэгтээ хадгалагдаж байна; үлдсэн хоёр
    мянга нь сонгох жагсаалтын утга бөгөөд самбарт хэрэглэгдэхгүй.
  */
  const held = new Set(holdings.map((h) => h.chemical_id).filter(Boolean));

  /*
    Албан ангилал одоогоор бараг бөглөгдөөгүй (бодисын 7/10,217,
    ААН 0/520, агуулахын 18/520). Хоосон массивыг мөр бүрд бичвэл
    ердөө нэг хувь нь утгатай байхад 80KB зарцуулна — утгатай үед л
    талбарыг гаргана. Бөглөгдөх үед өөрөө орж ирнэ.
  */
  const typesOf = (r) => {
    const t = (r.types ?? []).map((x) => str(x.name)).filter(Boolean);
    return t.length ? { types: t } : null;
  };

  /*
    ⚠ `cas` нь одоогоор 0/8,117 бөглөгдсөн ч ХАДГАЛАГДАНА: хоосон
    талбар нь "бөглөх шаардлагатай" гэсэн мэдээлэл өөрөө юм. Олон
    улсын давтагдашгүй дугаар тул бөглөгдвөл гадаад мэдээллийн
    сантай шууд холбогдоно.
  */
  const chem = chemicals
    .filter((c) => held.has(c.id))
    .map((c) => ({ id: c.id, name: str(c.name), cas: str(c.cas_number), ...typesOf(c) }));

  const orgs = organizations.map((o) => ({
    id: o.id,
    name: str(o.name),
    reg: str(o.reg_number),
    /** Одоогоор 0/520 бөглөгдсөн — хоосон нь өөрөө мэдээлэл */
    cert: str(o.certificate_number),
    address: str(o.address),
    ...typesOf(o),
  }));

  const locs = locations
    .filter((l) => num(l.latitude) != null && num(l.longitude) != null)
    .map((l) => ({
      id: l.id,
      org: l.organization_id,
      name: str(l.name),
      address: str(l.address),
      lat: num(l.latitude),
      lon: num(l.longitude),
      ...typesOf(l),
    }));

  /*
    Эзэмшил нь 22 мянган мөр тул БАГАНААР хадгална: талбарын нэр мөр
    бүрд давтагдвал файл гурав дахин томорно.

    Хэмжээг эх сурвалж аль хэдийн нэгжчилсэн (`weight_in_grams`,
    `volume_in_ml`) — энэ нь ArcGIS-ийн бүртгэлээс ЭРС дээр тал:
    тэнд нэгж бичигдээгүй тул харьцаагаар таах шаардлагатай байсан.
  */
  /*
    ⚠ `org`-ыг агуулахаас ГАРГАЖ БОЛОХГҮЙ. Агуулах бүртгэлтэй үед ААН нь
    үргэлж таарна (зөрөх мөр 0) ч эзэмшлийн 8 мөр нь бүртгэлд ОГТ
    БАЙХГҮЙ агуулах, ААН руу заадаг (хоёулаа №522; жагсаалтын дээд
    дугаар 520). Устгал, дахин боловсруулалтын бүртгэл ч мөн адил
    №524 руу заана. Өөрөөр хэлбэл `/organizations`, `/locations` нь
    эзэмшилд иш татагдсан бүх нэгжийг буцаадаггүй. `org`-ыг дам
    гаргавал тэр найм чимээгүй алга болно — хоёуланг нь хадгална.

    Эзэлхүүнээр хэмжигдсэн эзэмшил 22,101-ээс ердөө ХОЁР. Тэгээр
    дүүргэсэн бүтэн багана 128KB эзэлдэг тул сийрэг жагсаалт болгов:
    [индекс, утга] хосууд.
  */
  const sparse = (f) => {
    const out = [];
    holdings.forEach((h, i) => {
      const v = f(h);
      if (v) out.push([i, v]);
    });
    return out;
  };

  const hold = {
    org: holdings.map((h) => h.organization_id ?? 0),
    loc: holdings.map((h) => h.location_id ?? 0),
    chem: holdings.map((h) => h.chemical_id ?? 0),
    grams: holdings.map((h) => num(h.weight_in_grams) ?? 0),
    /** Сийрэг: [индекс, миллилитр] */
    ml: sparse((h) => num(h.volume_in_ml) ?? 0),
    /** Сийрэг: эзэлхүүнээр хэмжигдсэн мөрийн индексүүд */
    byVolume: holdings
      .map((h, i) => (h.main_unit === "volume" ? i : -1))
      .filter((i) => i >= 0),
  };

  const disposal = disposes.map((d) => ({
    id: d.id,
    at: str(d.created_at),
    org: d.disposer_organization_id ?? null,
    type: str(d.type),
    record: str(d.record_type),
    organicMl: num(d.organic_in_ml),
    acidMl: num(d.acid_in_ml),
    oilMl: num(d.used_oil_in_ml),
    oilG: num(d.used_oil_in_grams),
    dryG: num(d.dry_in_grams),
    batteryG: num(d.battery_in_grams),
    packages: num(d.packages_quantity),
    disposedAt: str(d.disposed_at),
    recycledAt: str(d.recycled_at),
  }));

  /* Албан ангиллын жагсаалтууд — дата нь бөглөгдөх үед бэлэн байна */
  const selections = {};
  for (const s of ["chemical_types", "organization_types", "location_types"]) {
    try {
      const opts = await get(`/options/selections/${s}`);
      selections[s] = (opts ?? []).map((o) => str(o.name)).filter(Boolean);
    } catch {
      selections[s] = [];
    }
  }

  const snapshot = {
    source: {
      system: "HazTrack",
      api: BASE,
      /*
        Талбарын бөглөлт — эх сурвалжийн БҮХ талбар нэрээрээ, хэдэн
        мөрд бөглөгдсөнөөр нь. `kept: false` нь хувь хүний мэдээлэл
        тул утга нь файлд ОРООГҮЙ гэсэн үг.
      */
      fields: {
        chemicals: fieldReport(chemicals),
        organizations: fieldReport(organizations),
        locations: fieldReport(locations),
        holdings: fieldReport(holdings),
        disposals: fieldReport(disposes),
      },
      fetched: new Date().toISOString(),
    },
    selections,
    chemicals: chem,
    organizations: orgs,
    locations: locs,
    holdings: hold,
    disposals: disposal,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(snapshot), "utf8");

  const kb = Math.round(Buffer.byteLength(JSON.stringify(snapshot)) / 1024);
  console.log(
    `chemsystem: ${orgs.length} ААН · ${locs.length} агуулах · ` +
      `${chem.length} бодис · ${hold.org.length} эзэмшил · ` +
      `${disposal.length} устгал → ${kb}KB`,
  );
}

main().catch(async (e) => {
  /*
    Эх сурвалж унасан ч бүтээлтийг ЗОГСООХГҮЙ: өмнөх хормын хувилбар
    байрандаа байгаа бол сайт хуучин датагаараа гарна. Файл огт
    байхгүй үед л алдаа өгнө.
  */
  console.error(`chemsystem: ${e.message}`);
  try {
    await access(OUT);
    console.error("chemsystem: өмнөх хувилбарыг хэвээр үлдээв");
  } catch {
    process.exitCode = 1;
  }
});
