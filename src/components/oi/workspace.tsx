"use client";

import dynamic from "next/dynamic";
import { Leaf, Loader2, ShieldCheck, TreePine, Trees } from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";

/*
  Хэлтэс ТАВАН эх сурвалжтай. Хоёуланг нь зэрэг ачаалахгүй: сонгосон нь л
  татагдана. Тус бүр нь газрын зураг, MapLibre-тэй бөгөөд хэдэн мянган
  олон өнцөгт татдаг тул эхнээс нь бүгдийг ачаалах нь хүнд.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const TypesDashboard = dynamic(
  () => import("@/components/oi/forest-types-dashboard").then((m) => m.ForestTypesDashboard),
  { ssr: false, loading: spinner },
);

const FundDashboard = dynamic(
  () => import("@/components/oi/forest-fund-dashboard").then((m) => m.ForestFundDashboard),
  { ssr: false, loading: spinner },
);

const GoodsDashboard = dynamic(
  () => import("@/components/oi/forest-goods-dashboard").then((m) => m.ForestGoodsDashboard),
  { ssr: false, loading: spinner },
);

const ProtectedDashboard = dynamic(
  () => import("@/components/oi/protected-dashboard").then((m) => m.ProtectedDashboard),
  { ssr: false, loading: spinner },
);

const TABS = [
  {
    id: "fund",
    label: "Ойн сан",
    note: "7,704 нэгж талбай · 219 хэсэг",
    icon: Trees,
  },
  {
    id: "types",
    label: "Ойн төрөл",
    note: "7,058 талбай · 12 төрөл",
    icon: TreePine,
  },
  {
    id: "goods",
    label: "Дагалт баялаг",
    note: "Ногоон бүс ба Богд уулын тархалт",
    full: "Улаанбаатар хотын ногоон бүс ба Богд уулын ойн дагалт баялгийн тархалт",
    icon: Leaf,
  },
  {
    /*
      Хоёр үйлчилгээ НЭГ табанд: албан бүртгэл ба Google Earth-ийн
      зураглал хоёулаа "тусгай хамгаалалт" гэж нэрлэгддэг тул тусад нь
      таб болгосон нь андуурал төрүүлж байв. Давхаргыг самбар дотроос
      сонгоно.
    */
    id: "protected",
    label: "Тусгай хамгаалалт",
    note: "Албан бүртгэл ба зураглал · 4 давхарга",
    icon: ShieldCheck,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function OiWorkspace() {
  /* Сонголт хадгалагдана — хэрэглэгч ажлаа тасалдуулаад буцаж ирэхэд
     хамгийн сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("oi.tab", IDS, "fund");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <SourceTabs tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      <div className="min-h-0 flex-1">
        {tab === "fund" ? (
          <FundDashboard />
        ) : tab === "types" ? (
          <TypesDashboard />
        ) : tab === "goods" ? (
          <GoodsDashboard />
        ) : (
          <ProtectedDashboard />
        )}
      </div>
    </div>
  );
}
