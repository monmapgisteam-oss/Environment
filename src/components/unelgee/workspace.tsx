"use client";

import dynamic from "next/dynamic";
import { FileCheck2, Loader2, TreePine } from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";

/*
  Хэлтэс хоёр эх сурвалжтай тул самбар хооронд сольж харна.

  Ерөнхий үнэлгээний ОН нь тусдаа таб БИШ, самбар доторх сонголт:
  таб нь СЭДЭВ ялгадаг, он нь нэг сэдвийн доторх хувилбар. Хөрсний
  мониторингийн жилийн сонголттой ижил түвшний зүйл тул мөн ижил
  хэлбэртэй — шүүлтүүрийн мөрийн эхэнд суух товчны хос.

  Зэрэг ачаалахгүй: сонгосон нь л татагдана. Тус бүр нь газрын зураг,
  MapLibre-тэй тул хоёуланг нь эхнээс нь ачаалах нь дэмий жин.

  Уур амьсгалын өөрчлөлтийн дата хэлтсээс хараахан ирээгүй.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const UnelgeeDashboard = dynamic(
  () => import("@/components/unelgee/dashboard").then((m) => m.UnelgeeDashboard),
  { ssr: false, loading: spinner },
);

const BomtDashboard = dynamic(
  () => import("@/components/unelgee/bomt-dashboard").then((m) => m.BomtDashboard),
  { ssr: false, loading: spinner },
);

const TABS = [
  {
    id: "unelgee",
    label: "Байгаль орчны ерөнхий үнэлгээ",
    note: "2025 онд 305 · 2026 онд 254 нэгж талбар",
    icon: FileCheck2,
  },
  {
    id: "bomt",
    label: "Менежментийн төлөвлөгөө",
    note: "2026 оны нэгтгэл · мод тарих үүрэг",
    full: "Байгаль орчны менежментийн төлөвлөгөөний 2026 оны нэгтгэл",
    icon: TreePine,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function UnelgeeWorkspace() {
  /* Сонголт хадгалагдана — хэрэглэгч ажлаа тасалдуулаад буцаж ирэхэд
     хамгийн сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("unelgee.tab", IDS, "unelgee");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <SourceTabs tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      <div className="min-h-0 flex-1">
        {tab === "unelgee" ? <UnelgeeDashboard /> : <BomtDashboard />}
      </div>
    </div>
  );
}
