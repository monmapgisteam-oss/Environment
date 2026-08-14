"use client";

import dynamic from "next/dynamic";
import { Loader2, PhoneCall, Squirrel } from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";

/*
  Хэлтэс хоёр эх сурвалжтай тул самбар хооронд сольж харна.

  Хоёуланг нь зэрэг ачаалахгүй: сонгосон нь л татагдана. Тус бүр нь газрын
  зураг, MapLibre-тэй тул хоёуланг нь эхнээс нь ачаалах нь дэмий жин.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const CallsDashboard = dynamic(
  () => import("@/components/wildlife/dashboard").then((m) => m.WildlifeDashboard),
  { ssr: false, loading: spinner },
);

const RescuesDashboard = dynamic(
  () => import("@/components/wildlife/rescues-dashboard").then((m) => m.RescuesDashboard),
  { ssr: false, loading: spinner },
);

const TABS = [
  {
    id: "calls",
    label: "Зэрлэг амьтны дуудлага",
    note: "Survey123 · шууд холболт",
    icon: PhoneCall,
  },
  {
    id: "rescues",
    label: "Аврагдсан амьтад",
    note: "2019–2026 бүртгэл",
    icon: Squirrel,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function WildlifeWorkspace() {
  /* Сонголт хадгалагдана — хэрэглэгч ажлаа тасалдуулаад буцаж ирэхэд
     хамгийн сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("wildlife.tab", IDS, "calls");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* Сэлгэх зурвас — хоёр самбарын аль нь идэвхтэйг үргэлж ил байлгана */}
      <SourceTabs tabs={TABS} value={tab} onChange={pick} />

      <div className="min-h-0 flex-1">
        {tab === "calls" ? <CallsDashboard /> : <RescuesDashboard />}
      </div>
    </div>
  );
}
