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
