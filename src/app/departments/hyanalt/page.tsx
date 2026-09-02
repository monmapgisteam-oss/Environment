import type { Metadata } from "next";
import { HyanaltWorkspace } from "@/components/hyanalt/workspace";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("hyanalt")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Хяналтын хэлтэс — хоёр эх сурвалж, хоёр өөр бүтэц.
 *
 * Авто засварын бүртгэлд САМБАР биш зөвхөн ГАЗРЫН ЗУРАГ: ганц
 * хэмжигдэхүүн нь байршил тул задаргаа хийх зүйл алга. Химийн бодисын
 * агуулахын бүртгэл эсрэгээрээ баялаг — бодис, зөвшөөрлийн эрх,
 * хүчинтэй хугацаа зэрэг олон хэмжигдэхүүнтэй тул бүрэн самбартай.
 */
export default function HyanaltPage() {
  return (
    <div
      className="h-full min-h-[420px] xl:h-[calc(100dvh-var(--head-h)-3rem)]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <HyanaltWorkspace />
    </div>
  );
}
