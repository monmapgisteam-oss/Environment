import { getToiletPointsBuffer } from "@/lib/toilets";

/**
 * Нүхэн жорлонгийн БҮХ цэг, нягт хоёртын хэлбэрээр (~1.4MB).
 *
 * Хажуугийн `api/toilets` нь нэгтгэсэн нүд, хөндлөн хүснэгтийг өгдөг —
 * диаграмуудад тэр л хэрэгтэй. Энэ зам нь зөвхөн ГАЗРЫН ЗУРАГТ: 220м-ийн
 * нүд нь ойртоход хиймэл сүлжээ болж харагддаг тул дулааны зураг ба цэгийг
 * бодит байршил дээр тулгуурлуулна.
 *
 * Хоёулаа ижил ArcGIS хуудсуудыг дууддаг тул бүтээх үед Next-ийн fetch
 * кэшээс уншиж, эх сурвалжийг хоёр дахин татахгүй.
 *
 * Зам нь `api/toilets/points` БИШ: статик экспорт нь `api/toilets`-ийг
 * ФАЙЛ болгож бичдэг тул түүнийг зэрэг хавтас болгож болохгүй (Windows
 * дээр бүтээлт EPERM-ээр унана).
 */
export const dynamic = "force-static";

export async function GET() {
  try {
    const buf = await getToiletPointsBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Эх сурвалж татагдсангүй", {
      status: 502,
    });
  }
}
