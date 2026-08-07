import type { Metadata } from "next";
import { WildlifeDashboard } from "@/components/wildlife/dashboard";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("amitan-urgamal")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Нэг дэлгэцэнд багтах самбар. Хэлтсийн нэр хажуугийн зурваст тэмдэглэгдсэн,
 * самбар өөрөө ч гарчигтай тул энд тусдаа толгой байхгүй.
 */
export default function AmitanUrgamalPage() {
  return (
    <div
      className="h-full xl:h-[calc(100dvh-var(--head-h)-3rem)]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <WildlifeDashboard />
    </div>
  );
}
