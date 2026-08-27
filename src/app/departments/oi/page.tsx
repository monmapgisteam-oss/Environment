import type { Metadata } from "next";
import { OiWorkspace } from "@/components/oi/workspace";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("oi")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Нэг дэлгэцэнд багтах самбар. Хэлтсийн нэр хажуугийн зурваст
 * тэмдэглэгдсэн, самбар өөрөө ч гарчигтай тул энд тусдаа толгой байхгүй.
 *
 * Таван эх сурвалжтай тул табын зурвастай.
 */
export default function OiPage() {
  return (
    <div
      className="h-full xl:h-[calc(100dvh-var(--head-h)-3rem)]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <OiWorkspace />
    </div>
  );
}
