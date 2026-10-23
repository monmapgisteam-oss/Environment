import type { Metadata } from "next";
import { ZahirgaaOverview } from "@/components/zahirgaa/overview";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("zahirgaa")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Захиргаа удирдлагын хэлтэс — байгууллагын тойм.
 *
 * Бусад хэлтэс шиг нэг дэлгэцэнд багтдаг самбар БИШ, дээрээс доош
 * уншигддаг тойм хуудас (хэрэглэгчийн загвар зураг, 2026-10-20) —
 * тиймээс `[slug]`-ийн хоосон хуудастай ижил хүрээтэй, гүйдэг.
 */
export default function ZahirgaaPage() {
  return <ZahirgaaOverview />;
}
