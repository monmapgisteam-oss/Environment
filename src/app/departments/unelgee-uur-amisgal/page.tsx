import type { Metadata } from "next";
import { UnelgeeDashboard } from "@/components/unelgee/dashboard";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("unelgee-uur-amisgal")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Нэг дэлгэцэнд багтах самбар. Хэлтсийн нэр хажуугийн зурваст тэмдэглэгдсэн,
 * самбар өөрөө ч гарчигтай тул энд тусдаа толгой байхгүй.
 *
 * Одоогоор ГАНЦ эх сурвалж (ерөнхий үнэлгээ) тул табын зурвас байхгүй —
 * уур амьсгалын дата ирэхэд `orchin`, `nogoon-bus`-тай ижил `workspace`
 * нэмнэ.
 */
export default function UnelgeePage() {
  return (
    <div
      className="h-full xl:h-[calc(100dvh-var(--head-h)-3rem)]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <UnelgeeDashboard />
    </div>
  );
}
