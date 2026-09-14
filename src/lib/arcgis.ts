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
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    /* Таслагдсан хүсэлтийг ЗААВАЛ дамжуулна — энэ нь алдаа биш,
       бүрэлдэхүүн салсны шинж. Ялгаж дамжуулахгүй бол хэрэглэгч
       таб солих бүрд алдааны дэлгэц анивчина. */
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error(`${label} татагдсангүй (сүлжээ)`);
  }

  if (!res.ok) throw new Error(`${label} татагдсангүй (${res.status})`);

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
    const why =
      m === "Invalid URL"
        ? "давхарга олдсонгүй (устгагдсан эсвэл нэр нь солигдсон)"
        : (m ?? `код ${json.error.code ?? "?"}`);
    throw new Error(`${label}: ${why}`);
  }

  return json;
}
