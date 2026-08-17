"use client";

import dynamic from "next/dynamic";
import { Droplets, Loader2, Waves } from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";

/*
  Хэлтсийн сэдвүүд. Самбар хооронд сольж харна.

  Сонгосон нь л ачаалагдана: тус бүр MapLibre-тэй тул хоёуланг нь
  эхнээс нь татах нь дэмий жин.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const WellsDashboard = dynamic(
  () => import("@/components/wells/dashboard").then((m) => m.WellsDashboard),
  { ssr: false, loading: spinner },
);

const WaterDashboard = dynamic(
  () => import("@/components/nogoon-bus/water-dashboard").then((m) => m.WaterDashboard),
  { ssr: false, loading: spinner },
);

const TABS = [
  {
    id: "wells",
    label: "Худгийн бүртгэл",
    note: "2015–2025 · 12,672 цэг",
    icon: Waves,
  },
  {
    id: "water",
    label: "Ус ашиглах гэрээ",
    note: "Аж ахуйн нэгжийн гэрээ, төлбөр",
    icon: Droplets,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function NogoonBusWorkspace() {
  /* Сонголт хадгалагдана — ажлаа тасалдуулаад буцаж ирэхэд хамгийн
     сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("nogoon-bus.tab", IDS, "wells");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <SourceTabs tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      <div className="min-h-0 flex-1">
        {tab === "wells" ? <WellsDashboard /> : <WaterDashboard />}
      </div>
    </div>
  );
}
