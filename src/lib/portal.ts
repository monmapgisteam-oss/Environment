/**
 * ArcGIS Enterprise порталын ТОХИРГОО — цорын ганц эх сурвалж.
 *
 * Байгууллагын бүх өгөгдөл `environment.ub.gov.mn/gis` порталд шилжиж,
 * хуваалцах түвшин нь `organization` болсон (2026-09-14). Тиймээс давхарга
 * бүр токен шаардана: нэвтрээгүй хөтөч юу ч татахгүй.
 *
 * ⚠ **ПОРТАЛ БА СЕРВЕР ХОЛБООТОЙ (federated).** `hosting` серверийн
 * `rest/info` нь `owningSystemUrl`-ээрээ порталаа заадаг тул НЭГ токен
 * хоёуланд нь хүчинтэй. Тусдаа токен авах шаардлагагүй.
 *
 * ⚠ **ГЭРЧИЛГЭЭ ЗАСАГДСАН.** Урьд нь энэ хост өөрөө гарын үсэг зурсан
 * гэрчилгээтэй байсан тул хөтөч татахаас татгалзаж, зарим самбарын дата
 * `public/data/` дотор хуулбараар суудаг байв. 2026-09-12-ноос Let's
 * Encrypt-ийн хүчинтэй гэрчилгээтэй болсон бөгөөд CORS нь хүсэлтийн эх
 * үүсвэрийг буцаадаг тул хөтчөөс шууд татах зам НЭЭГДСЭН.
 */

import { asset } from "@/lib/base-path";

/** Порталын үндэс. Бүх зам эндээс эхэлнэ */
export const PORTAL = "https://environment.ub.gov.mn/gis";

/** Хуваалцах API — токен, хэрэглэгчийн мэдээлэл, item бүгд энд */
export const SHARING = `${PORTAL}/sharing/rest`;

/** Хостлогдсон үйлчилгээний сервер (порталтай холбоотой) */
export const HOSTING = "https://environment.ub.gov.mn/hosting/rest/services";

/**
 * OAuth 2.0-ийн апп ID.
 *
 * Нууц үг БИШ: хөтчийн багц руу орж ил харагдана, тэр нь хэвийн. Аюулгүй
 * байдлыг PKCE ба порталд бүртгэгдсэн `redirect_uri`-ийн ЯГ таарал хангана
 * — өөр сайт энэ ID-г хуулсан ч токен нь өөр рүү буцахгүй.
 *
 * Бүртгэх заавар: `docs/arcgis-app.md`.
 */
export const APP_ID = process.env.NEXT_PUBLIC_ARCGIS_APP_ID ?? "";

/**
 * Токен ЗААВАЛ шаардах хостууд.
 *
 * Суурь зураг (`services.arcgisonline.com`), фонт (`fonts.openmaptiles.org`),
 * цаг агаарын нээлттэй API (`weather.gov.mn`) нь Esri болон гуравдагч
 * талын НЭЭЛТТЭЙ нөөц — токен хавсаргавал 400 буцаана. Тиймээс жагсаалт нь
 * "бүх ArcGIS" биш, ЗӨВХӨН манай порталын хостууд.
 */
const SECURED_HOSTS = ["environment.ub.gov.mn"];

/** Энэ хаяг нэвтрэлт шаардах уу? */
export function needsToken(url: string): boolean {
  try {
    const { hostname } = new URL(url, "https://x.invalid");
    return SECURED_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * OAuth-ийн буцах хаяг.
 *
 * ⚠ Порталд бүртгэгдсэнтэйгээ ҮСЭГ ҮСГЭЭРЭЭ таарна. Сайт
 * `trailingSlash`-тай экспортлогддог тул төгсгөлийн зураас ЗААВАЛ.
 * Дэд замыг `lib/base-path.ts`-аас авна — хоёр газарт бичвэл
 * хөгжүүлэлт, нийтлэлийн хаягийн аль нэг нь эрт орой зөрнө.
 */
export function redirectUri(): string {
  return `${window.location.origin}${asset("/auth/callback/")}`;
}
