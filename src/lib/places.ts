/**
 * ДҮРСИЙГ БАЙРШЛААР НЭРЛЭХ — аль сум, дүүрэгт оршихыг засаг захиргааны
 * хилээс тооцно.
 *
 * Хэрэглэгч (2026-10-07, ойн "100 метрийн хамгаалалтын зурвас"): давхарга
 * нь ердөө хоёр олон өнцөгт, гурван талбартай (дугаар, дугаар, талбай) —
 * нэр, дүүрэг огт байхгүй тул жагсаалтад "№ 1", "№ 2" гэж гардаг байв.
 * Хоёр сонголтоос "дүрсийг байршлаар нэрлэх"-ийг сонгов.
 *
 * ⚠⚠ ЭНЭ НЬ ТООЦООЛСОН УТГА, эх сурвалжийн талбар БИШ. Тиймээс:
 * - зөвхөн нэрийн багана БАЙХГҮЙ давхаргад (бүртгэлийн `placeNames`);
 * - дугаар нь хасагдахгүй — "Баянзүрх · Сүхбаатар · № 1": дугаар нь
 *   зураг дээр товшиж сонгодог БОДИТ танигч хэвээр.
 *
 * АРГА — торон түүвэр. Дүрс бүрийн хүрээнд ~2,500 цэгийн тор тавьж, дүрсийн
 * ДОТОР орсон цэг бүр аль сум/дүүргийн олон өнцөгтөд байгааг тоолно;
 * эзлэх хувиар нь эрэмбэлнэ. Олон өнцөгтийн яг огтлолцлыг бодохоос хамаагүй
 * хялбар бөгөөд нэр эрэмбэлэхэд хангалттай нарийвчлалтай.
 * ⚠ 3%-иас бага эзлэх хэсэг нэрэнд ОРОХГҮЙ — ирмэгээр шүргэсэн дүүрэг
 *   нэрийг уртасгахаас өөр юу ч хэлэхгүй.
 * ⚠ Хилийн эх сурвалж: улсын сумын хил (`soumbnd`, ArcGIS Online, нээлттэй) —
 *   Улаанбаатарын есөн дүүрэг ч сумын түвшинд тэнд бий. Хотын төвийн
 *   "Basemap"-ийн дүүргийн хил нь хотоос гадуурх Төвийн сумдыг агуулдаггүй.
 */

const SOUMS =
  "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/ArcGIS/rest/services/soumbnd/FeatureServer/8";

/** Тор нэг тэнхлэгтээ хэдэн цэг — 50 × 50 */
const GRID = 50;
/** Нэрэнд орох хамгийн бага эзлэх хувь */
const MIN_SHARE = 0.03;
/** Нэрэнд гарах дээд тоо — үлдсэнийг нь "+N" */
const MAX_NAMES = 2;

type Ring = GeoJSON.Position[];
type Poly = Ring[];
type Box = [number, number, number, number];

type Soum = { name: string; polys: Poly[]; box: Box };

/** Нэрийн бичиглэл платформын бусад хэсэгтэй таарна */
const SPELLING: Record<string, string> = { "Хан Уул": "Хан-Уул" };

function polysOf(g: GeoJSON.Geometry | null | undefined): Poly[] {
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

function boxOf(polys: Poly[]): Box {
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys)
    for (const r of p)
      for (const [x, y] of r) {
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (x > b[2]) b[2] = x;
        if (y > b[3]) b[3] = y;
      }
  return b;
}

/** Тэгш-сондгой дүрэм — бүх цагираг (нүх ч мөн) нэг тоололд */
function inPolys(x: number, y: number, polys: Poly[]): boolean {
  let inside = false;
  for (const p of polys)
    for (const r of p)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
  return inside;
}

async function fetchSoums(box: Box, signal?: AbortSignal): Promise<Soum[]> {
  const q = new URLSearchParams({
    f: "geojson",
    where: "1=1",
    geometry: JSON.stringify({
      xmin: box[0],
      ymin: box[1],
      xmax: box[2],
      ymax: box[3],
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "soum_name,aimag_name",
    outSR: "4326",
    /* ~100 м — нэрийг эрэмбэлэхэд хангалттай, хариу жижиг */
    maxAllowableOffset: "0.001",
    geometryPrecision: "5",
  });
  // eslint-disable-next-line no-restricted-globals -- ArcGIS Online-ийн нээлттэй үйлчилгээ — порталын токен тэнд хүчингүй
  const res = await fetch(`${SOUMS}/query?${q}`, { signal });
  if (!res.ok) throw new Error(`Засаг захиргааны хил ${res.status}`);
  const j = (await res.json()) as GeoJSON.FeatureCollection;
  return (j.features ?? []).map((f) => {
    const p = f.properties ?? {};
    const soum = String(p.soum_name ?? "").trim();
    const aimag = String(p.aimag_name ?? "").trim();
    /* Нийслэлийнх нь дүүрэг — нэрээрээ; бусад нь "… сум" */
    const name =
      aimag === "Улаанбаатар" ? (SPELLING[soum] ?? soum) : `${soum} сум`;
    const polys = polysOf(f.geometry);
    return { name, polys, box: boxOf(polys) };
  });
}

/** Нэг дүрсийн байршлын нэр — эзлэх хувиар буурах дарааллаар */
function nameOf(polys: Poly[], soums: Soum[]): string {
  const [x0, y0, x1, y1] = boxOf(polys);
  const dx = (x1 - x0) / GRID;
  const dy = (y1 - y0) / GRID;
  const tally = new Map<string, number>();
  let n = 0;
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      const x = x0 + (i + 0.5) * dx;
      const y = y0 + (j + 0.5) * dy;
      if (!inPolys(x, y, polys)) continue;
      n++;
      const s = soums.find(
        (s) =>
          x >= s.box[0] &&
          x <= s.box[2] &&
          y >= s.box[1] &&
          y <= s.box[3] &&
          inPolys(x, y, s.polys),
      );
      if (s) tally.set(s.name, (tally.get(s.name) ?? 0) + 1);
    }
  if (!n) return "";
  const ranked = [...tally]
    .filter(([, c]) => c / n >= MIN_SHARE)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  if (!ranked.length) return "";
  const head = ranked.slice(0, MAX_NAMES).join(" · ");
  return ranked.length > MAX_NAMES
    ? `${head} +${ranked.length - MAX_NAMES}`
    : head;
}

/**
 * Дүрс бүрийн байршлын нэр — `Number(feature.id)` → нэр. Олдоогүй дүрс
 * толинд орохгүй (дуудагч тал дугаараараа үлдээнэ).
 */
export async function placeNamesOf(
  features: GeoJSON.Feature[],
  signal?: AbortSignal,
): Promise<Map<number, string>> {
  const shapes = features
    .map((f) => ({ id: Number(f.id), polys: polysOf(f.geometry) }))
    .filter((s) => Number.isFinite(s.id) && s.polys.length);
  const out = new Map<number, string>();
  if (!shapes.length) return out;
  const soums = await fetchSoums(
    boxOf(shapes.flatMap((s) => s.polys)),
    signal,
  );
  for (const s of shapes) {
    const name = nameOf(s.polys, soums);
    if (name) out.set(s.id, name);
  }
  return out;
}

/** Цагиргийн талбай (тэмдэгтэй) ба жинтэй төв — shoelace */
function ringCentroid(r: Ring): { a: number; x: number; y: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f;
    cx += (r[j][0] + r[i][0]) * f;
    cy += (r[j][1] + r[i][1]) * f;
  }
  a /= 2;
  return a ? { a, x: cx / (6 * a), y: cy / (6 * a) } : { a: 0, x: r[0][0], y: r[0][1] };
}

/** Дүрсийн төлөөлөх цэг — хамгийн том хэсгийн жинтэй төв, гадна гарвал орой */
function pointIn(polys: Poly[]): [number, number] | null {
  let best: { a: number; x: number; y: number; p: Poly } | null = null;
  for (const p of polys) {
    if (!p[0]?.length) continue;
    const c = ringCentroid(p[0]);
    if (!best || Math.abs(c.a) > Math.abs(best.a)) best = { ...c, p };
  }
  if (!best) return null;
  return inPolys(best.x, best.y, [best.p])
    ? [best.x, best.y]
    : [best.p[0][0][0], best.p[0][0][1]];
}

/**
 * ДҮРС БҮРИЙН ДҮҮРЭГ — `Number(feature.id)` → дүүрэг/сумын нэр.
 *
 * Ойн ялгарал (хэрэглэгч 2026-10-07: "дүүргүүдээр хардаг бас болгоорой")
 * — давхаргад дүүргийн талбар БАЙХГҮЙ тул ТООЦООЛНО: дүрсийн хамгийн том
 * хэсгийн жинтэй төв аль дүүргийн хил дотор байгаагаар. Хил дайрсан
 * дүрс нэг дүүрэгт БҮТНЭЭРЭЭ орно (хэрэглэгч энэ аргыг зөвшөөрсөн).
 * ⚠ Хилээс гадуур (ямар ч сумд ороогүй) дүрс толинд орохгүй.
 */
export async function districtsOf(
  features: GeoJSON.Feature[],
  signal?: AbortSignal,
): Promise<Map<number, string>> {
  const pts = features
    .map((f) => ({ id: Number(f.id), at: pointIn(polysOf(f.geometry)) }))
    .filter((s): s is { id: number; at: [number, number] } =>
      Number.isFinite(s.id) && s.at != null,
    );
  const out = new Map<number, string>();
  if (!pts.length) return out;
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { at } of pts) {
    if (at[0] < box[0]) box[0] = at[0];
    if (at[1] < box[1]) box[1] = at[1];
    if (at[0] > box[2]) box[2] = at[0];
    if (at[1] > box[3]) box[3] = at[1];
  }
  const soums = await fetchSoums(box, signal);
  for (const { id, at } of pts) {
    const [x, y] = at;
    const s = soums.find(
      (s) =>
        x >= s.box[0] &&
        x <= s.box[2] &&
        y >= s.box[1] &&
        y <= s.box[3] &&
        inPolys(x, y, s.polys),
    );
    if (s) out.set(id, s.name);
  }
  return out;
}
