import type { Metadata } from "next";
import { SanhuuWorkspace } from "@/components/sanhuu/workspace";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("sanhuu-monitoring")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Платформын анхны ГАЗРЫН ЗУРАГГҮЙ хэлтэс.
 *
 * Өмнөх бүх хэлтсийн дата нь байршилтай; энд координат гэж байхгүй,
 * агуулга нь байгууллагын БҮТЭЦ ба албан хаагчийн гүйцэтгэл. Тиймээс
 * зүүн багана нь газарзүйн шүүлт биш МОД болно.
 */
export default function SanhuuPage() {
  return (
    <div
      className="h-full min-h-[420px] xl:h-[calc(100dvh-var(--head-h)-var(--workspace-gutter,3rem))]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <SanhuuWorkspace />
    </div>
  );
}
