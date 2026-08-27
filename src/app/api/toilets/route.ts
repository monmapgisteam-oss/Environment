import { NextResponse } from "next/server";
import { getToilets } from "@/lib/toilets";

/**
 * Нэгтгэсэн нүхэн жорлонгийн мэдээ.
 *
 * 145 мянган цэгийг бүтээх мөчид татаж, нүд болон хөндлөн хүснэгт болгож
 * шахна (14MB → ~500KB). Эх дата нь загварчлалын үр дүн буюу тогтмол тул
 * өдөрт нэг удаа шинэчлэхэд хангалттай.
 */
export const dynamic = "force-static";

export async function GET() {
  try {
    const data = await getToilets();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Эх сурвалжийн мэдээллийг татаж чадсангүй" },
      { status: 502 },
    );
  }
}
