import type { Metadata } from "next";
import { OrchinWorkspace } from "@/components/orchin/workspace";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("orchin")!;

export const metadata: Metadata = { title: DEPT.name };

/** Нэг дэлгэцэнд багтах самбар — хэлтсийн нэр хажуугийн зурваст тэмдэглэгдсэн */
export default function OrchinPage() {
  return (
    <div
      className="h-full xl:h-[calc(100dvh-var(--head-h)-3rem)]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <OrchinWorkspace />
    </div>
  );
}
