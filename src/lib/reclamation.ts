/**
 * Нөхөн сэргээлт — хоёр санхүүжилтийн эх үүсвэр.
 *
 * · `aan` — аж ахуйн нэгжийн хөрөнгөөр (гүйцэтгэгч ААН, төсөвт өртөгтэй)
 * · `tusuw` — нийслэлийн төсвөөр (2018–2025)
 *
 * **Нэг талбай = ОЛОН цэг.** Эх сурвалж нь талбайн буланг цэгээр
 * тэмдэглэсэн байдаг: 181 цэг нь ердөө 8 талбай, 12 цэг нь 3 талбай.
 * Тиймээс мөрөөр нь тоолох, талбайн хэмжээг нэмэх нь БУРУУ (181 мөрийн
 * "га"-г нэмбэл 4,433 га гарах ба бодит нь 166 га).
 *
 * Бүлэглэх түлхүүр: дугаар + он + байршил + талбайн хэмжээ. Эдгээр нь
 * давхцвал нэг талбайн булангууд гэж үзнэ.
 *
 * ⚠️ Энэ түлхүүр нь САЛАНГИД талбайг ялгаж чаддаггүй: нэг бичлэг хэдэн
 * километрийн зайд байрлах хоёр, гурван талбайг агуулж болно (дугаар,
 * он, байршил, хэмжээ нь бүгд ижил тул). Тэднийг геометрээр нь салгана
 * — `buildRings()`-ийг үз.
 *
 * ГА-гийн тоо нь ҮРГЭЛЖ эх сурвалжийн `Талбайн_хэмжээ_га` талбараас
 * ирнэ, сэргээсэн хүрээнээс БОДОГДОХГҮЙ. Хүрээ нь ойролцоо, албан ёсны
 * хэмжээ нь баримт.
 */

import { arcgisJson } from "@/lib/arcgis";
import { HOSTING } from "@/lib/portal";


export type FundingId = "aan" | "tusuw";

/** Эх сурвалжийн хуудсанд бүртгэхэд */
export const RECLAMATION_SERVICES = [
  `${HOSTING}/Hosted/X07_Nuhun_sergeelt_aan_hurungu/FeatureServer/6`,
  `${HOSTING}/Hosted/X07_Nuhun_sergeelt_niisleliin_tusuw/FeatureServer/5`,
];

export const FUNDING = [
  /* ⚠ `index` нь 0 БИШ: шинэ портал дээр бүх үйлчилгээ нэг дараалалтай
     нийтлэгдсэн тул давхарга бүр өөрийн дугаартай */
  /* ⚠ "ААН" товчлол ХЭВЭЭР (хэрэглэгчийн шийдвэр, 2026-09-17: "ААН
     хөрөнгөөр болго") — "товчлол задална" дүрмийн зориудын үл хамаарах
     зүйл: баганын толгойд бүтэн нэр багтахгүй. */
  { id: "aan" as const, label: "ААН хөрөнгөөр", layer: "X07_Nuhun_sergeelt_aan_hurungu", index: 6 },
  { id: "tusuw" as const, label: "Нийслэлийн төсвөөр", layer: "X07_Nuhun_sergeelt_niisleliin_tusuw", index: 5 },
];

/** Нэг нөхөн сэргээлтийн талбай */
export type ReclamationSite = {
  /** Бүлэглэлтээс үүссэн дугаар — газрын зураг, сонголтод хэрэглэнэ */
  oid: number;
  funding: FundingId;
  no: string;
  year: number;
  /** "Багануур 1-р хороо" гэх бүтэн бичвэр */
  place: string;
  district: string;
  khoroo: string | null;
  ha: number;
  /** Гүйцэтгэгч — зөвхөн ААН-ийн хөрөнгөөр хийсэн ажилд бий */
  contractor: string | null;
  /** Төсөвт өртөг, мянган төгрөг — зөвхөн ААН-ийн эх сурвалжид бий */
  cost: number | null;
  /** Талбайн төлөөлөх цэг (булангуудын дундаж) */
  lon: number;
  lat: number;
  /**
   * Талбайн хүрээ — НЭГ бичлэг ХЭД ХЭДЭН салангид талбайтай байж болох
   * тул цагирагийн ЖАГСААЛТ. Ихэнх нь ганц цагирагтай.
   */
  rings: [number, number][][];
};

type Row = {
  f_?: string;
  он?: number | string;
  дүүрэг_хороо?: string;
  талбайн_хэмжээ_га?: number;
  төсөвт_өртөг_мян_төг?: number;
  гүйцэтгэсэн_аан?: string;
  [key: string]: unknown;
};

/**
 * Бичлэгийн ОН — талбарын нэрийг нэг л хэлбэрээр таамаглахгүй.
 *
 * ⚠ Хоёр давхарга нэг төслөөс нийтлэгдсэн ч оны багана нь ижил нэртэй
 * гэсэн баталгаа байхгүй: портал хүснэгтийн толгойг жижигрүүлж,
 * тусгай тэмдэгтийг `_` болгодог ("№" → `f_`) тул "Он " гэсэн
 * сүүлчийн зайтай толгой `он_` болж бууна. ААН-ийн давхарга дээр
 * "Оноор" диаграм хоосон гарсан (хэрэглэгч 2026-09-17: "ААН он гэсэн
 * талбартай шүү дээ") — `он` гэж хатуу уншсан тул он 0 болж байв.
 *
 * Тиймээс: нэр нь `он` гэж ЭХЭЛСЭН (үсэг, тоо, `_`-аас бусдыг хассан)
 * богино түлхүүр бүрийг үзэж, тоо (1900–2100), "2019 он" гэсэн бичвэр,
 * эсвэл ArcGIS-ийн миллисекунд огноо гэсэн гурван хэлбэрийг уншина.
 * Олдохгүй бол 0 — таамаглаж бөглөхгүй.
 */
/**
 * Талбарыг НЭРИЙН ЭХЛЭЛЭЭР нь олно — оны нэгэн адил шалтгаанаар: хоёр
 * давхаргын толгой ижил гэсэн баталгаа байхгүй ("Талбайн хэмжээ (га)"
 * → `талбайн_хэмжээ__га_`, "Талбайн хэмжээ, га" → `талбайн_хэмжээ_га`).
 * Нэрийг зөвхөн үсэг болгож (`_`, тоо, хаалт хасаж) харьцуулна.
 */
function pick(a: Row, ...prefixes: string[]): unknown {
  const norm = (k: string) => k.toLowerCase().replace(/[^a-zа-яөүё]/g, "");
  const want = prefixes.map(norm);
  const keys = Object.keys(a).sort((x, y) => x.length - y.length);
  for (const k of keys) {
    const n = norm(k);
    if (want.some((w) => n.startsWith(w))) return a[k];
  }
  return undefined;
}

const str = (v: unknown) => (v == null ? "" : String(v));
const numOf = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") return Number(v.replace(",", ".")) || 0;
  return 0;
};

function yearOf(a: Row): number {
  const keys = Object.keys(a)
    .filter((k) => /^он[\d_]*$/i.test(k) || /^(year|on)[\d_]*$/i.test(k))
    .sort((x, y) => x.length - y.length);
  for (const k of keys) {
    const v = a[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      if (v >= 1900 && v <= 2100) return v;
      /* Миллисекунд огноо — 1990 оноос хойшхи */
      if (v > 6e11) return new Date(v).getUTCFullYear();
    }
    if (typeof v === "string") {
      const m = v.match(/(19|20)\d{2}/);
      if (m) return Number(m[0]);
    }
  }
  return 0;
}

/**
 * "Багануур 1-р хороо" → дүүрэг ба хороо.
 *
 * Багахангай гэх мэт хороо дурдаагүй бичлэг байдаг тул хороо нь
 * заавал байх шаардлагагүй.
 */
function splitPlace(raw: string) {
  const m = raw.match(/^(.*?)\s+(\d+)-р хороо$/);
  if (!m) return { district: raw.trim(), khoroo: null };
  return { district: m[1].trim(), khoroo: `${Number(m[2])}-р хороо` };
}

async function fetchOne(f: (typeof FUNDING)[number], base: number): Promise<ReclamationSite[]> {
  const url =
    `${HOSTING}/Hosted/${f.layer}/FeatureServer/${f.index}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "*",
      /* Геометр нь UTM 48N-д проекцлогдсон */
      outSR: "4326",
      /* Булангийн цэгийн ДАРААЛАЛ нь хүрээг тодорхойлдог тул эрэмбийг
         сервертээ тогтооно — эс тэгвээс хүрээ орооцолдоно */
      orderByFields: "objectid",
      resultRecordCount: "2000",
      f: "json",
    });

  const json = await arcgisJson<{
    features?: { attributes: Row; geometry?: { x: number; y: number } }[];
  }>(url, f.label);

  const groups = new Map<string, { row: Row; pts: [number, number][] }>();
  for (const feat of json.features ?? []) {
    const g = feat.geometry;
    if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
    const a = feat.attributes;
    const key = [
      str(a.f_ ?? pick(a, "д_д", "дугаар", "no")),
      yearOf(a),
      str(a.дүүрэг_хороо ?? pick(a, "дүүрэг", "байршил")),
      numOf(a.талбайн_хэмжээ_га ?? pick(a, "талбайн_хэмжээ", "талбай", "га")),
    ].join("|");
    const hit = groups.get(key) ?? { row: a, pts: [] };
    hit.pts.push([g.x, g.y]);
    groups.set(key, hit);
  }

  const out: ReclamationSite[] = [];
  let i = 0;
  for (const { row, pts } of groups.values()) {
    const place = str(row.дүүрэг_хороо ?? pick(row, "дүүрэг", "байршил")).trim() || "Тодорхойгүй";
    const { district, khoroo } = splitPlace(place);
    const contractor = str(row.гүйцэтгэсэн_аан ?? pick(row, "гүйцэтгэсэн", "гүйцэтгэгч", "аан"))
      .replace(/["“”]/g, "")
      .trim();
    const costRaw = row.төсөвт_өртөг_мян_төг ?? pick(row, "төсөвт_өртөг", "өртөг", "төсөв");
    out.push({
      oid: base + i++,
      funding: f.id,
      no: str(row.f_ ?? pick(row, "д_д", "дугаар", "no")),
      year: yearOf(row),
      place,
      district,
      khoroo,
      ha: numOf(row.талбайн_хэмжээ_га ?? pick(row, "талбайн_хэмжээ", "талбай", "га")),
      contractor: contractor || null,
      cost: costRaw == null ? null : numOf(costRaw) || null,
      lon: pts.reduce((s, p) => s + p[0], 0) / pts.length,
      lat: pts.reduce((s, p) => s + p[1], 0) / pts.length,
      rings: buildRings(pts),
    });
  }
  return out;
}

/* --------------------------------------------------------------------------
   Хүрээ сэргээх
   -------------------------------------------------------------------------- */

/** Ойролцоо зай, метрээр. Нийслэлийн өргөрөгт зориулсан хялбар хувиргалт */
function meters(a: [number, number], b: [number, number]): number {
  const kx = 111320 * Math.cos(47.9 * (Math.PI / 180));
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 110540);
}

/** Цагираг өөртэйгөө огтлолцож байна уу — талбай цөөн тул O(n²) хангалттай */
function selfIntersects(v: [number, number][]): boolean {
  const side = (a: [number, number], b: [number, number], c: [number, number]) =>
    Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const cross = (
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    p4: [number, number],
  ) => side(p1, p2, p3) !== side(p1, p2, p4) && side(p3, p4, p1) !== side(p3, p4, p2);

  const n = v.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      /* Зэргэлдээ ирмэгүүд оройгоороо шүргэлцдэг — тэдгээрийг алгасна */
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (cross(v[i], v[(i + 1) % n], v[j], v[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Төвөөс харсан өнцгөөр эрэмбэлнэ — од хэлбэрийн цэгэн олонлогт л зөв */
function byAngle(p: [number, number][]): [number, number][] {
  const cx = p.reduce((s, q) => s + q[0], 0) / p.length;
  const cy = p.reduce((s, q) => s + q[1], 0) / p.length;
  return [...p].sort(
    (a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  );
}

/** Гүдгэр бүрхүүл (Andrew monotone chain) — үргэлж энгийн олон өнцөгт өгнө */
function convexHull(p: [number, number][]): [number, number][] {
  const s = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of s) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const q = s[i];
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0)
      upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Цагирагийг ЭНГИЙН (өөртэйгөө огтлолцдоггүй) болгоно.
 *
 * Шатлан буулгана: эх дараалал → өнцгөөр эрэмбэлсэн → гүдгэр бүрхүүл.
 * Дээд шат нь бодит хэлбэрт хамгийн ойр, доод шат нь үргэлж хүчинтэй
 * геометр өгнө. Огтлолцсон олон өнцөгт зурагт "эрвээхэй" болж
 * харагддаг тул хүчин төгөлдөр байдал нь нарийвчлалаас урьтана.
 */
function simplify(r: [number, number][]): [number, number][] {
  if (!selfIntersects(r)) return r;
  const a = byAngle(r);
  if (!selfIntersects(a)) return a;
  return convexHull(r);
}

/**
 * Булангийн цэгүүдээс талбайн хүрээг сэргээнэ.
 *
 * Цэгүүд эх сурвалжид ТАЛБАЙГ ТОЙРСОН дараалалтай бичигдсэн байдаг
 * (`OBJECTID`-аар эрэмбэлнэ). Тэр дарааллаар нь холбоно.
 *
 * ⚠️ Урьд нь төвөөс харсан ӨНЦГӨӨР эрэмбэлдэг байсан нь БУРУУ байв:
 * тэр арга нь ямар ч талбайг гүдгэр болгодог тул "Г" хэлбэрийн, хонхор
 * талбайнууд байгаагаас том, өөр хэлбэртэй харагдаж байлаа. Шалгасан
 * дүн: өнцгөөр эрэмбэлбэл 2021 оны талбай 24.9 га-аас 29.7 га болж
 * хавчигдаж, 2018 оных 43.0-аас 38.7 болж хумигдана. Дарааллаар нь
 * холбоход 11 талбайн 9 нь албан ёсны хэмжээтэйгээ таарна.
 *
 * НЭГ бичлэг олон салангид талбайтай байж болно (дугаар, он, байршил,
 * хэмжээ нь бүгд ижил тул бүлэглэлт тэднийг ялгаж чадахгүй). Ийм
 * тохиолдолд бүх цэгийг нэг цагирагт хаавал талбайнуудын хооронд
 * нарийн хошуу үүсч, цагираг өөртэйгөө огтолно. Тиймээс огтлолцсон
 * тохиолдолд Л ЗӨВХӨН дарааллын дундах ХЭТ УРТ үсрэлт дээр таслана —
 * тэр үсрэлт нь нэг талбайгаас нөгөө рүү шилжсэн газар юм.
 *
 * Таслалтын дараа ч огтлолцсоор байвал `simplify()` нь тухайн хэсгийг
 * хүчин төгөлдөр хэлбэрт буулгана. Эцсийн дүнд 11 талбайн аль нь ч
 * өөртэйгөө огтлолцохгүй.
 */
function buildRings(pts: [number, number][]): [number, number][][] {
  if (pts.length < 3) return [];

  const close = (r: [number, number][]) => [...r, r[0]] as [number, number][];
  if (!selfIntersects(pts)) return [close(pts)];

  /* Алхмуудын ДУНДАЖ БИШ ГОЛЧ утгыг суурь болгоно: ганц том үсрэлт
     дунджийг татдаг тул голч нь талбайн жинхэнэ хэмжээст ойр */
  const steps: number[] = [];
  for (let i = 1; i < pts.length; i++) steps.push(meters(pts[i - 1], pts[i]));
  const mid = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)] || 1;
  const limit = Math.max(mid * 4, 250);

  const runs: [number, number][][] = [[pts[0]]];
  for (let i = 1; i < pts.length; i++) {
    if (steps[i - 1] > limit) runs.push([pts[i]]);
    else runs[runs.length - 1].push(pts[i]);
  }

  const parts = runs.filter((r) => r.length >= 3);
  /* Таслалт үр дүнгүй бол бүтнээр нь үлдээнэ — хагас талбай харуулснаас
     бүтэн, гэхдээ ойролцоо хүрээ харуулах нь дээр */
  return (parts.length ? parts : [pts]).map((r) => close(simplify(r)));
}

export async function fetchReclamation(): Promise<ReclamationSite[]> {
  const [aan, tusuw] = await Promise.all([
    fetchOne(FUNDING[0], 0),
    fetchOne(FUNDING[1], 1000),
  ]);
  return [...aan, ...tusuw].sort((a, b) => b.year - a.year || b.ha - a.ha);
}
