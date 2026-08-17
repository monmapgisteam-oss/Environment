import type { Metadata } from "next";
import { NogoonBusWorkspace } from "@/components/nogoon-bus/workspace";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("nogoon-bus")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Нэг дэлгэцэнд багтах самбар. Хэлтсийн нэр хажуугийн зурваст тэмдэглэгдсэн,
 * самбар өөрөө ч гарчигтай тул энд тусдаа толгой байхгүй — бүх өндөр самбарт очно.
 */
export default function NogoonBusPage() {
  return (
    <div
      className="h-full xl:h-[calc(100dvh-var(--head-h)-3rem)]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <NogoonBusWorkspace />
    </div>
  );
}
