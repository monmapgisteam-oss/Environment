import { NextResponse } from "next/server";
import { getWells } from "@/lib/wells";

/** Шахсан бүртгэлийг клиент рүү. ArcGIS-ийн хариуг 1 цаг кэшилнэ. */
export const dynamic = "force-static";

export async function GET() {
  try {
    const data = await getWells();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Эх сурвалжийн мэдээллийг татаж чадсангүй" },
      { status: 502 },
    );
  }
}
