/**
 * БҮРТГЭСЭН ДҮҮРЭГ ↔ ЦЭГИЙН БАЙРШИЛ (хэрэглэгч 2026-11-19).
 *
 * Олон давхаргад бүртгэлийн "дүүрэг" талбар ба координат өөр дүүрэгт таардаг
 * (аудит: химийн үндэсний бүртгэл 34%, хаг 24%, тоолуур 12%, авто засвар 10% …).
 * Самбарууд БҮРТГЭЛИЙН дүүргээр шүүдэг тул тухайн дүүргээр шүүхэд цэг хөрш
 * дүүрэгт гарна. Шийдвэр: шүүлт бүртгэлээр ХЭВЭЭР, зөрсөн цэгийг тусгай тэмдгээр
 * тэмдэглэнэ ("Бүртгэсэн дүүргээр, зөрснийг тэмдэглэх").
 *
 * Бүртгэлийн утга олон хэлбэртэй тул НЭГ танигчаар буулгана: товчлол (СХД, НД),
 * бүтэн нэр ("Сүхбаатар дүүрэг", "Хан Уул"), латин (Bayanzurkh), хэд хэдэн
 * дүүрэг ("Баянзүрх, Налайх"). Танигдахгүй утга (сум, "Төв аймаг") харьцуулахгүй.
 */

import { districtAt } from "@/lib/ub-districts";

export const UB_DISTRICTS = [
  "Сонгинохайрхан",
  "Баянзүрх",
  "Баянгол",
  "Сүхбаатар",
  "Чингэлтэй",
  "Хан-Уул",
  "Налайх",
  "Багануур",
  "Багахангай",
] as const;

const ALIAS = new Map<string, string>();
const add = (keys: string[], name: string) => keys.forEach((k) => ALIAS.set(k, name));
add(["схд", "сонгинохайрхан", "songinokhairkhan", "songinokhairhan", "songinohairhan", "skhd", "shd"], "Сонгинохайрхан");
add(["бзд", "баянзүрх", "баянзурх", "bayanzurkh", "bayanzurh", "bzd"], "Баянзүрх");
add(["бгд", "баянгол", "bayangol", "bgd"], "Баянгол");
add(["сбд", "сүхбаатар", "сухбаатар", "sukhbaatar", "suhbaatar", "sbd"], "Сүхбаатар");
add(["чд", "чингэлтэй", "chingeltei", "chingeltey", "chd"], "Чингэлтэй");
add(["худ", "хан-уул", "хан уул", "ханyул", "khan-uul", "khan uul", "khanuul", "khan_uul", "han-uul", "han uul", "hud", "khud"], "Хан-Уул");
add(["нд", "нал", "налайх", "nalaikh", "nalaih", "nd"], "Налайх");
add(["бнд", "багануур", "baganuur", "bnd"], "Багануур");
add(["бхд", "бхан", "багахангай", "bagakhangai", "bagahangai", "bhd"], "Багахангай");

const NOISE = /дүүргийн|дүүрэг|district|duureg|нийслэл|улаанбаатар|ulaanbaatar|\bхот\b/g;

/**
 * Бүртгэлийн утга → дүүргийн нэрс. Хоосон эсвэл аль нэг хэсэг нь танигдахгүй
 * бол `null` — харьцуулахгүй (худал тэмдэг гаргахаас таниагүй нь дээр).
 */
export function canonDistricts(v: unknown): string[] | null {
  if (typeof v !== "string") return null;
  const parts = v
    .split(/[,;/]|\s+ба\s+/)
    .map((x) => x.toLowerCase().replace(NOISE, " ").replace(/[.()]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const out: string[] = [];
  for (const p of parts) {
    const n = ALIAS.get(p) ?? ALIAS.get(p.replace(/\s/g, ""));
    if (!n) return null;
    out.push(n);
  }
  return [...new Set(out)];
}

/** Дүүргийн талбар мөн эсэх — нэр эсвэл alias-аар (хороо, код, дугаар биш) */
export function isDistrictField(name: string, alias = ""): boolean {
  const t = `${name} ${alias}`;
  return /дүүрэг|duureg|district|soum|сум/i.test(t) && !/хороо|horoo|khoroo|code|код|дугаар|хилийн|_geo\b|geo\)/i.test(t);
}

export type DistrictItem = { oid: number; lon: number; lat: number; district: unknown };

/**
 * Зөрсөн бүртгэл → координатын дүүрэг (`""` — нийслэлийн хилээс гадна).
 * `fc` нь `fetchUbDistricts()`-ийн хил; ирээгүй бол хоосон.
 */
export function offDistricts(
  fc: GeoJSON.FeatureCollection | null,
  items: Iterable<DistrictItem>,
): Map<number, string> {
  const m = new Map<number, string>();
  if (!fc) return m;
  for (const it of items) {
    const reg = canonDistricts(it.district);
    if (!reg || !Number.isFinite(it.lon) || !Number.isFinite(it.lat)) continue;
    const at = districtAt(fc, it.lon, it.lat);
    if (!at || !reg.includes(at)) m.set(it.oid, at ?? "");
  }
  return m;
}

/** Хулганы тайлбар, бүртгэлийн цонхны мөр */
export function offText(at: string): string {
  return at ? `Координат нь ${at} дүүрэгт байна` : "Координат нь нийслэлийн хилээс гадна байна";
}
