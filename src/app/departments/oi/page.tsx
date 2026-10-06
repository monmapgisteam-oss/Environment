import type { Metadata } from "next";
import { OiWorkspace } from "@/components/oi/workspace";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("oi")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Нэг дэлгэцэнд багтах самбар. Хэлтсийн нэр платформын толгой ба
 * хажуугийн зурваст аль хэдийн тэмдэглэгдсэн тул энд тусдаа толгой
 * байхгүй.
 *
 * Таб БАЙХГҮЙ: долоон давхарга НЭГ зурагт асаалт/унтраалттай
 * ({@link OiWorkspace}).
 */
export default function OiPage() {
  return (
    <div
      className="h-full xl:h-[calc(100dvh-var(--head-h)-var(--workspace-gutter,3rem))]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <OiWorkspace />
    </div>
  );
}
