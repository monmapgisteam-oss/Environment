/**
 * Харагдацын хүрээ хураах жижиг хэрэгсэл.
 *
 * Самбар бүр "шүүлтүүрт таарсан зүйлүүд рүү ойрт" гэсэн нэг үйлдэлтэй
 * (ArcGIS Dashboard-ийн "zoom action") бөгөөд урьд нь тэр бүрд ижилхэн
 * min/max давталт гараар бичигдэж байв. Энд нэг дор цуглуулав.
 *
 * `Extent` төрлийг газрын зургаас ЗӨВХӨН ТӨРӨЛ болгож авна: тэр модуль
 * MapLibre импортлодог, зөвхөн хөтөч дээр ачаалагддаг бөгөөд төрлийн
 * импорт нь орчуулгын үед бүрэн арилдаг тул серверийн багц руу
 * дагалдахгүй.
 */
import type { Extent } from "@/components/wells/map";

export class Bounds {
  private w = 180;
  private s = 90;
  private e = -180;
  private n = -90;

  add(lon: number, lat: number): void {
    /* Бөглөгдөөгүй координатыг алгасна — ганц NaN бүх хүрээг устгана */
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    /*
      ⚠ ХҮРЭЭНЭЭС ГАДУУРХ утгыг мөн алгасна.

      Эх сурвалж дээр заримдаа проекцлогдсон (метр) эсвэл эвдэрсэн
      координат үлддэг: нэг ийм цэг хүрээг сая градус болгож,
      `fitBounds` нь "Invalid LngLat latitude" гэж ШИДНЭ — улмаас
      газрын зураг бүхэлдээ унаж, самбар хоосон харагдана (ойн
      ялгаралын давхарга дээр яг ингэж гарсан).

      Ганц эвдэрсэн цэгээс болж бүх давхарга харагдахгүй байхаас
      түүнийг алгассан нь дээр.
    */
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return;
    if (lon < this.w) this.w = lon;
    if (lon > this.e) this.e = lon;
    if (lat < this.s) this.s = lat;
    if (lat > this.n) this.n = lat;
  }

  /** GeoJSON геометрийн БҮХ оройг тойрно — гүн нь ямар ч байсан */
  addGeometry(g: GeoJSON.Geometry | null | undefined): void {
    if (!g || g.type === "GeometryCollection") return;
    const walk = (c: unknown): void => {
      const arr = c as unknown[];
      if (typeof arr[0] === "number") {
        this.add(arr[0] as number, arr[1] as number);
        return;
      }
      for (const part of arr) walk(part);
    };
    walk(g.coordinates);
  }

  get empty(): boolean {
    return this.w > this.e;
  }

  /**
   * Хүрээг гаргана. `pad` нь ХАМГИЙН БАГА хэмжээний зай (градусаар):
   * ганц цэг сонгогдвол хүрээ нь цэг болж хумигдах бөгөөд газрын зураг
   * хязгааргүй ойртохыг оролдоно. Анхдагч ~450м.
   */
  get(pad = 0.004): Extent | null {
    if (this.empty) return null;
    const p = Math.max(pad, (this.e - this.w) * 0.08, (this.n - this.s) * 0.08);
    /* Зай нэмэхэд туйлаас халихгүй байх ёстой */
    return [
      Math.max(this.w - p, -180),
      Math.max(this.s - p, -90),
      Math.min(this.e + p, 180),
      Math.min(this.n + p, 90),
    ];
  }
}

/** Цэгийн жагсаалтаас хүрээ — хамгийн түгээмэл тохиолдол */
export function boundsOf(
  pts: Iterable<{ lon: number; lat: number }>,
  pad?: number,
): Extent | null {
  const b = new Bounds();
  for (const p of pts) b.add(p.lon, p.lat);
  return b.get(pad);
}

/* --------------------------------------------------------------------------
   ГАЖУУД ГЕОМЕТРИЙН ШҮҮЛТ

   Зарим ArcGIS давхаргад хоосон буюу эвдэрсэн геометр нь дэлхийн булан
   (-180, -90) болж буцдаг. Ганц ийм бичлэг бүх зургийг сүйтгэнэ:
   MapLibre түүнийг асар том олон өнцөгт болгож зурах бөгөөд түүнээс
   тооцсон хүрээ нь дэлхий даяар болж, ойртолт утгагүй болно.

   Тиймээс координат нь Монголын боломжит мужаас гарсан бол ГЕОМЕТРИЙГ
   нь хаяна. Бичлэг өөрөө жагсаалтад үлдэнэ — талбайн утга нь хүчинтэй
   байж болно.
   -------------------------------------------------------------------------- */

const SANE: [number, number, number, number] = [104, 46, 110, 50];

/** Геометрийн бүх координат боломжит мужид байна уу */
export function saneGeometry(
  g: GeoJSON.Geometry | null | undefined,
): g is GeoJSON.Geometry {
  if (!g || g.type === "GeometryCollection") return false;
  const [w, s, e, n] = SANE;
  let ok = true;
  const walk = (a: unknown): void => {
    if (!ok || !Array.isArray(a)) return;
    if (typeof a[0] === "number") {
      const [x, y] = a as number[];
      if (x < w || x > e || y < s || y > n) ok = false;
      return;
    }
    for (const v of a) walk(v);
  };
  walk((g as { coordinates: unknown }).coordinates);
  return ok;
}

/* --------------------------------------------------------------------------
   ЦЭГИЙН КООРДИНАТЫГ НАЙДВАРТАЙ УНШИХ
   -------------------------------------------------------------------------- */

/**
 * Түүхий утгыг тоо болгоно — БӨГЛӨГДӨӨГҮЙГ тэг болгохгүй.
 *
 * ⚠⚠ `Number(null)` нь **0**, `Number("")` нь мөн **0** бөгөөд
 * `Number.isFinite(0)` нь `true` тул "тоо мөн үү" гэсэн энгийн шалгалт
 * бөглөгдөөгүй нүдийг НЭВТРҮҮЛНЭ. (`Number(undefined)` нь `NaN` тул
 * баригддаг — яг тэр учраас алдаа нь удаан далд үлддэг.)
 */
function numberOf(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * ArcGIS-ийн бичлэгээс цэгийн байршлыг гаргана.
 *
 * Геометрийг эрхэмлэж, дутсан үед атрибутын өргөрөг, уртрагаас авна.
 * Аль нь ч олдохгүй бол `null` — дуудагч тал юу хийхээ өөрөө шийднэ
 * (бичлэгийг алгасах, эсвэл байршилгүйгээр үлдээх).
 *
 * ⚠⚠ **ТЭГ, ТЭГ бол БАЙРШИЛ БИШ.** Авран хамгаалсан амьтдын бүртгэлийн 720
 * мөрийн **23-д** координат нь `null` байсан бөгөөд `Number(null) → 0`
 * тул тэдгээр нь (0, 0) буюу Гвинейн буланд бөөгнөрч, газрын зураг
 * дээр Улаанбаатараас 9,000 км зайд "23" гэсэн бөөгнөрөл болж гарч
 * байв (хэрэглэгч 2026-09-17-нд мэдээлсэн). Платформын хамрах хүрээ
 * нь Улаанбаатар тул (0, 0) нь хэзээ ч бодит бичлэг байж чадахгүй.
 */
export function pointOf(
  geometry: { x?: unknown; y?: unknown } | null | undefined,
  lonRaw?: unknown,
  latRaw?: unknown,
): { lon: number; lat: number } | null {
  let lon = numberOf(geometry?.x);
  let lat = numberOf(geometry?.y);

  if (lon == null || lat == null) {
    lon = numberOf(lonRaw);
    lat = numberOf(latRaw);
  }
  if (lon == null || lat == null) return null;

  /* Хүрээнээс гадуурх утга нь эвдэрсэн эсвэл проекцлогдсон координат */
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  /* Null Island — бөглөгдөөгүйн тэмдэг, байршил биш */
  if (lon === 0 && lat === 0) return null;

  return { lon, lat };
}

/*
  ДҮРС БҮРД НЭГ ШОШГО (2026-09-29, хэрэглэгч: "дээд эх үүсвэр сонгоход
  яагаад 2 feature давхардаж үлдээд байна?").

  ⚠⚠ MapLibre нь олон хэсэгтэй дүрсийн ХЭСЭГ БҮРД шошго тавьдаг.
  Хориглолтын бүсийн №18 нь хоёр хэсэгтэй тул зураг дээр "1,392 га"
  гэж ХОЁР удаа гарч, нэг бичлэг хоёр болж уншигдаж байв (диаграмд
  ганц мөр). Тоо нь ч ХУДАЛ: шошго нь БҮХ дүрсийн талбайг бичдэг
  атлаа хэсэг нь түүний зөвхөн нэг хэсгийг эзэлнэ.

  Тиймээс шошгыг тусдаа ЦЭГЭН эх сурвалжаас зурна: дүрс бүрд яг нэг
  цэг, ХАМГИЙН ТОМ хэсгийнх нь төв дээр.

  ⚠ Талбайн жинтэй (shoelace) төв — оройнуудын энгийн дунджаар авбал
  олон оройтой үзүүр рүүгээ татагдана.
  ⚠ Хэрчмийн давхаргад (`shapeLabelOnLine`) энэ нь ХЭРЭГЛЭГДЭХГҮЙ:
  тэнд шошго нь шугамаа дагаж (`line-center`) суух ёстой.
*/
function ringArea(ring: GeoJSON.Position[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(s / 2);
}

function ringCentre(ring: GeoJSON.Position[]): GeoJSON.Position {
  let x = 0,
    y = 0,
    a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
  }
  /* Талбай нь тэг (шулуун дээр хэвтсэн оройнууд) бол дунджаар */
  if (!a) {
    for (const p of ring) {
      x += p[0];
      y += p[1];
    }
    return [x / ring.length, y / ring.length];
  }
  return [x / (3 * a), y / (3 * a)];
}

/** Дүрсийн ХАМГИЙН ТОМ хэсгийн төв; олдохгүй бол `null` */
function mainPoint(g: GeoJSON.Geometry | null): GeoJSON.Position | null {
  if (!g) return null;
  if (g.type === "Point") return g.coordinates;
  if (g.type === "Polygon")
    return g.coordinates[0] ? ringCentre(g.coordinates[0]) : null;
  if (g.type === "MultiPolygon") {
    let best: GeoJSON.Position | null = null;
    let big = -1;
    for (const poly of g.coordinates) {
      const ring = poly[0];
      if (!ring?.length) continue;
      const a = ringArea(ring);
      if (a > big) {
        big = a;
        best = ringCentre(ring);
      }
    }
    return best;
  }
  if (g.type === "LineString")
    return g.coordinates[Math.floor(g.coordinates.length / 2)] ?? null;
  if (g.type === "MultiLineString") {
    let best: GeoJSON.Position | null = null;
    let big = -1;
    for (const line of g.coordinates) {
      if (line.length > big) {
        big = line.length;
        best = line[Math.floor(line.length / 2)] ?? null;
      }
    }
    return best;
  }
  return null;
}

/** Дүрсийн ХАМГИЙН ТОМ хэсгийн талбай (зэрэгцүүлэхэд л хэрэгтэй) */
function mainArea(g: GeoJSON.Geometry | null): number {
  if (!g) return 0;
  if (g.type === "Polygon")
    return g.coordinates[0] ? Math.abs(ringArea(g.coordinates[0])) : 0;
  if (g.type === "MultiPolygon") {
    let big = 0;
    for (const poly of g.coordinates) {
      const a = poly[0] ? Math.abs(ringArea(poly[0])) : 0;
      if (a > big) big = a;
    }
    return big;
  }
  if (g.type === "LineString") return g.coordinates.length;
  if (g.type === "MultiLineString")
    return g.coordinates.reduce((n, l) => Math.max(n, l.length), 0);
  return 0;
}

/**
 * Шошгын цэгүүд — дүрс бүрд ЯГ НЭГ.
 *
 * `unique` үед НЭГ БИЧВЭРТ яг нэг: ижил нэртэй бүх дүрсээс ХАМГИЙН
 * ТОМЫГ нь сонгоно.
 *
 * ⚠⚠ Яагаад: ангиллын багана шошго болох үед ({@link
 * LayerSet.labelBy}) нэг нэр олон дүрсэд давтагдана — татамын
 * "Хэрлэн" нь 23 дүрст. MapLibre нь зөвхөн ДАВХЦСАН шошгыг хасдаг
 * болохоос ижил бичвэрийг нэгтгэдэггүй тул зураг дээр "Хэрлэн" арав
 * гаруй удаа тарж бичигдэж байв (хэрэглэгч, 2026-10-02: "ингэж олон
 * харагдахгүй, 1 л харагдахад болно").
 * ⚠ ХАМГИЙН ТОМ дүрс дээр: шошго нь сав газрын гол биеийг заана,
 * захын жижиг тасархай дээр биш.
 * ⚠ Нэр нь бичлэг бүрд ӨӨР давхаргад (ердийн тохиолдол) энэ нь юу ч
 * өөрчлөхгүй — тийм учраас зөвхөн дуудагчийн хүсэлтээр асна.
 */
export function labelPoints(
  fc: GeoJSON.FeatureCollection,
  unique = false,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const best = new Map<
    string,
    { at: GeoJSON.Position; area: number; id: GeoJSON.Feature["id"] }
  >();
  for (const f of fc.features) {
    const t = f.properties?.t;
    if (typeof t !== "string" || !t) continue;
    const at = mainPoint(f.geometry);
    if (!at) continue;
    if (!unique) {
      features.push({
        type: "Feature",
        id: f.id,
        properties: { t },
        geometry: { type: "Point", coordinates: at },
      });
      continue;
    }
    const area = mainArea(f.geometry);
    const seen = best.get(t);
    if (!seen || area > seen.area) best.set(t, { at, area, id: f.id });
  }
  for (const [t, b] of best)
    features.push({
      type: "Feature",
      id: b.id,
      properties: { t },
      geometry: { type: "Point", coordinates: b.at },
    });
  return { type: "FeatureCollection", features };
}
