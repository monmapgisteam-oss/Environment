import type { Metadata } from "next";
import { WellsDashboard } from "@/components/wells/dashboard";
import { getDepartment } from "@/lib/departments";

const DEPT = getDepartment("nogoon-bus")!;

export const metadata: Metadata = { title: DEPT.name };

/**
 * Нэг дэлгэцэнд багтах самбар. Хэлтсийн нэр дээд талын зам заагчид байгаа тул
 * тусдаа толгой байхгүй — бүх өндөр самбарт очно.
 */
export default function NogoonBusPage() {
  return (
    <div
      className="h-full xl:h-[calc(100dvh-52px-3rem)]"
      style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}
    >
      <WellsDashboard />
    </div>
  );
}
