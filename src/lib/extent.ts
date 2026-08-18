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
    return [this.w - p, this.s - p, this.e + p, this.n + p];
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
