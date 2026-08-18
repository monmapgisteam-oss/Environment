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

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";

export type FundingId = "aan" | "tusuw";

/** Эх сурвалжийн хуудсанд бүртгэхэд */
export const RECLAMATION_SERVICES = [
  `${HOST}/Nuhun_sergeelt_aan_hurungu/FeatureServer/0`,
  `${HOST}/Nuhun_sergeelt_niisleliin_tusuw/FeatureServer/0`,
];

export const FUNDING = [
  { id: "aan" as const, label: "ААН-ийн хөрөнгөөр", layer: "Nuhun_sergeelt_aan_hurungu" },
  { id: "tusuw" as const, label: "Нийслэлийн төсвөөр", layer: "Nuhun_sergeelt_niisleliin_tusuw" },
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
  F_?: string;
  Он?: number;
  Дүүрэг_хороо?: string;
  Талбайн_хэмжээ_га?: number;
  Төсөвт_өртөг_мян_төг?: number;
  Гүйцэтгэсэн_ААН?: string;
};

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
    `${HOST}/${f.layer}/FeatureServer/0/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "*",
      /* Геометр нь UTM 48N-д проекцлогдсон */
      outSR: "4326",
      /* Булангийн цэгийн ДАРААЛАЛ нь хүрээг тодорхойлдог тул эрэмбийг
         сервертээ тогтооно — эс тэгвээс хүрээ орооцолдоно */
      orderByFields: "OBJECTID",
      resultRecordCount: "2000",
      f: "json",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${f.label}: татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    error?: { message: string };
    features?: { attributes: Row; geometry?: { x: number; y: number } }[];
  };
  if (json.error) throw new Error(json.error.message);

  const groups = new Map<string, { row: Row; pts: [number, number][] }>();
  for (const feat of json.features ?? []) {
    const g = feat.geometry;
    if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y)) continue;
    const a = feat.attributes;
    const key = [a.F_, a.Он, a.Дүүрэг_хороо, a.Талбайн_хэмжээ_га].join("|");
    const hit = groups.get(key) ?? { row: a, pts: [] };
    hit.pts.push([g.x, g.y]);
    groups.set(key, hit);
  }

  const out: ReclamationSite[] = [];
  let i = 0;
  for (const { row, pts } of groups.values()) {
    const place = row.Дүүрэг_хороо ?? "Тодорхойгүй";
    const { district, khoroo } = splitPlace(place);
    out.push({
      oid: base + i++,
      funding: f.id,
      no: String(row.F_ ?? ""),
      year: Number(row.Он) || 0,
      place,
      district,
      khoroo,
      ha: Number(row.Талбайн_хэмжээ_га) || 0,
      contractor: row.Гүйцэтгэсэн_ААН?.replace(/["“”]/g, "").trim() || null,
      cost: typeof row.Төсөвт_өртөг_мян_төг === "number" ? row.Төсөвт_өртөг_мян_төг : null,
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
