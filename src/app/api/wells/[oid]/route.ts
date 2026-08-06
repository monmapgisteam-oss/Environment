import { NextResponse } from "next/server";
import { getWell } from "@/lib/wells";

/** Нэг худгийн дэлгэрэнгүй — газрын зураг дээр товшиход */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ oid: string }> },
) {
  const { oid } = await params;
  const id = Number(oid);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Буруу дугаар" }, { status: 400 });
  }

  const well = await getWell(id);
  if (!well) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  return NextResponse.json(well, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
