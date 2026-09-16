/**
 * ArcGIS REST-ийн хариуг найдвартай уншина.
 *
 * ⚠️ **ArcGIS алдааг HTTP 200-аар буцаадаг.** Давхарга устгагдсан,
 * нэр нь солигдсон, эсвэл хандах эрх хаагдсан үед сервер төлөвийн код
 * нь 200 хэвээр, биед нь `{"error":{"code":400,"message":"Invalid URL"}}`
 * гэж ирнэ. Тиймээс `res.ok` шалгалт УЧИР ДУТАГДАЛТАЙ:
 *
 *   const res = await fetch(url);
 *   if (!res.ok) throw ...;              // ажиллахгүй — 200 ирсэн
 *   const json = await res.json();
 *   return json.features ?? [];          // undefined -> хоосон массив
 *
 * Ийм тохиолдолд самбар алдаа заахын оронд ХООСОН датаг зурна: "0 талбай,
 * 0 га" гэж бичигдэх бөгөөд энэ нь техникийн гэмтлийг БОДИТ БАРИМТ мэт
 * харуулна. Ойн хэлтсийн давхаргууд устгагдсаны дараа яг ингэж болсон —
 * самбар хэвийн харагдсаар байв.
 *
 * Энэ туслах нь гурван шалгуурыг дараалуулна: сүлжээний төлөв → JSON
 * задаргаа → биед нуугдсан `error`. Аль нь ч бүтэлгүйтвэл ШИДНЭ, улмаар
 * самбар өөрийн алдааны дэлгэцийг харуулна.
 */

import { getToken } from "@/lib/auth";
import { needsToken } from "@/lib/portal";

/** ArcGIS-ийн алдааны бие — `error` талбар нь бүх төгсгөлд ижил хэлбэртэй */
type ArcGisError = {
  error?: { code?: number; message?: string; details?: string[] };
};

/**
 * ArcGIS төгсгөлөөс JSON татаж, алдааг ШИДНЭ.
 *
 * `label` нь хэрэглэгчид харагдах нэр ("Ойн сан") — алдааны бичвэрт
 * оршино. Техникийн шалтгааныг ард нь хаалтад бичнэ, ингэснээр
 * хэрэглэгч юу тасарсныг, хөгжүүлэгч яагаад болохыг зэрэг мэднэ.
 */
export async function arcgisJson<T>(
  url: string,
  label: string,
  init?: RequestInit,
): Promise<T> {
  const ready = await withToken(url);

  let res: Response;
  try {
    res = await fetch(ready, init);
  } catch (e) {
    /* Таслагдсан хүсэлтийг ЗААВАЛ дамжуулна — энэ нь алдаа биш,
       бүрэлдэхүүн салсны шинж. Ялгаж дамжуулахгүй бол хэрэглэгч
       таб солих бүрд алдааны дэлгэц анивчина. */
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error(`${label} татагдсангүй (сүлжээ)`);
  }

  if (!res.ok) throw new Error(`${label} татагдсангүй (${res.status}${await reason(res)})`);

  let json: T & ArcGisError;
  try {
    json = (await res.json()) as T & ArcGisError;
  } catch {
    /* Портал заримдаа алдааны HTML хуудас буцаадаг */
    throw new Error(`${label}: хариу уншигдсангүй`);
  }

  if (json.error) {
    const m = json.error.message?.trim();
    /* "Invalid URL" гэдэг нь ихэвчлэн давхарга устгагдсан буюу нэр нь
       солигдсон гэсэн үг — түүнийг ойлгомжтой болгож хэлнэ */
    const code = json.error.code;
    /* 498 — токен хүчингүй, 499 — токен огт ирээгүй, 403 — эрх хүрэхгүй.
       Эдгээр нь давхаргын биш НЭВТРЭЛТИЙН асуудал тул тусад нь нэрлэнэ:
       "давхарга олдсонгүй" гэвэл админ буруу зүйл хайна */
    const why =
      code === 498 || code === 499
        ? "нэвтрэлтийн хугацаа дууссан байна"
        : code === 403
          ? "энэ өгөгдөлд хандах эрх байхгүй байна"
          : m === "Invalid URL"
            ? "давхарга олдсонгүй (устгагдсан эсвэл нэр нь солигдсон)"
            : (m ?? `код ${code ?? "?"}`);
    throw new Error(`${label}: ${why}`);
  }

  return json;
}

/**
 * Хамгаалагдсан хостын хаягт токен хавсаргана.
 *
 * ⚠ **БҮХ ArcGIS-Д БИШ.** Esri-ийн нээлттэй суурь зураг
 * (`services.arcgisonline.com`) токен хүлээж авдаггүй бөгөөд хавсаргавал
 * хүсэлт унана. Аль хост хамгаалагдсаныг `lib/portal.ts` эзэмшинэ.
 *
 * Токен байхгүй бол хаягийг ХЭВЭЭР нь буцаана: хамгаалагдсан давхарга
 * бол портал өөрөө 499-ээр татгалзах ба дээрх алдааны боловсруулалт
 * "нэвтрэлтийн хугацаа дууссан" гэж ойлгомжтой хэлнэ. Энд чимээгүй
 * шидвэл нээлттэй давхаргууд ч татагдахаа болино.
 */
async function withToken(url: string): Promise<string> {
  if (!needsToken(url)) return url;

  const token = await getToken();
  if (!token) return url;

  /* Хаягт аль хэдийн токен байвал дарж бичихгүй — дуудагч тал зориудаар
     өөр токен өгсөн байж болно */
  const u = new URL(url);
  if (!u.searchParams.has("token")) u.searchParams.set("token", token);
  return u.toString();
}

/**
 * Амжилтгүй хариунаас ШАЛТГААНЫГ салгана.
 *
 * ArcGIS алдааныхаа ихэнхийг HTTP 200-аар буцаадаг ч ҮНЭХЭЭР унасан үед
 * (500, 502 …) төлөвийн код дангаараа юу ч хэлэхгүй: "татагдсангүй (500)"
 * гэдэг нь серверийн тохиргооны асуудал уу, давхаргын гэмтэл үү гэдгийг
 * ялгахад тус болохгүй. Сервер ихэвчлэн биедээ тайлбар явуулдаг тул
 * түүнийг түүж хэлнэ.
 *
 * Бичвэр нь дэлгэцийн нэг мөрөнд багтах ёстой тул ТОВЧИЛНО. Хариу
 * уншигдахгүй бол чимээгүй өнгөрнө — алдааны дотор алдаа гаргах нь
 * анхны шалтгааныг нуана.
 */
async function reason(res: Response): Promise<string> {
  try {
    const text = (await res.text()).trim();
    if (!text) return "";

    /* JSON бол `error.message` нь хамгийн тодорхой */
    if (text.startsWith("{")) {
      const j = JSON.parse(text) as ArcGisError;
      const m = j.error?.message?.trim();
      const d = j.error?.details?.filter(Boolean).join("; ").trim();
      const all = [m, d].filter(Boolean).join(" — ");
      return all ? ` · ${clip(all)}` : "";
    }

    /* HTML алдааны хуудас — шошгыг хасаад эхний утгатай мөрийг авна */
    const plain = text
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return plain ? ` · ${clip(plain)}` : "";
  } catch {
    return "";
  }
}

/** Нэг мөрөнд багтаах урт */
function clip(s: string, max = 120): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
