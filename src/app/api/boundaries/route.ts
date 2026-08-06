import { NextResponse } from "next/server";
import { getBoundaries } from "@/lib/boundaries";

/** Хил өөрчлөгддөггүй тул нэг өдөр кэшилнэ */
export const revalidate = 86400;

export async function GET() {
  try {
    const data = await getBoundaries();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Хил татагдсангүй" },
      { status: 502 },
    );
  }
}
