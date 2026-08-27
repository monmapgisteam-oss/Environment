import type { Metadata } from "next";
import { UnelgeeWorkspace } from "@/components/unelgee/workspace";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("unelgee-uur-amisgal")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Нэг дэлгэцэнд багтах самбар. Хэлтсийн нэр хажуугийн зурваст тэмдэглэгдсэн,
 * самбар өөрөө ч гарчигтай тул энд тусдаа толгой байхгүй.
 *
 * Хоёр эх сурвалжтай (ерөнхий үнэлгээ, менежментийн төлөвлөгөө) тул
 * `orchin`, `nogoon-bus`-тай ижил табын зурвастай.
 */
export default function UnelgeePage() {
  return (
    <div
      className="h-full xl:h-[calc(100dvh-var(--head-h)-3rem)]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <UnelgeeWorkspace />
    </div>
  );
}
