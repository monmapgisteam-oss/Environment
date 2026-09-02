"use client";

import dynamic from "next/dynamic";
import { FlaskConical, Loader2, Workflow, Wrench } from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";

/*
  Хэлтэс ГУРВАН табтай. Зэрэг ачаалахгүй: сонгосон нь л татагдана.
  Эхний хоёр нь MapLibre-тэй бөгөөд химийн бүртгэл нь бодисын урт
  бичвэртэй тул эхнээс нь бүгдийг татах нь илүүц.

  Гурав дахь нь дата БИШ ЖУРАМ — хэлтсийн ажлын урсгалын схем. Тоон
  харагдацуудын хажууд байрлах нь зөв: хэрэглэгч бүртгэлийг хараад
  "энэ хаанаас гардаг юм бэ" гэж асуухад хариулт нь нэг товшилтын
  зайд байна.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const RepairMap = dynamic(
  () => import("@/components/hyanalt/repair-map").then((m) => m.RepairMap),
  { ssr: false, loading: spinner },
);

const ChemicalsDashboard = dynamic(
  () =>
    import("@/components/hyanalt/chemicals-dashboard").then((m) => m.ChemicalsDashboard),
  { ssr: false, loading: spinner },
);

const InspectionScheme = dynamic(
  () => import("@/components/hyanalt/scheme").then((m) => m.InspectionScheme),
  { ssr: false, loading: spinner },
);

const TABS = [
  {
    /*
      Хоёр жилийн бүртгэл НЭГ табанд: гэрчилгээний дугаар давхцахгүй ч
      бүтэц, талбар нь ижил бөгөөд ижил төрлийн үйл ажиллагааг хамардаг.
      Жилийг самбар дотроос сонгоно — тусад нь таб болговол хоёр өөр
      сэдэв мэт харагдана.
    */
    id: "chemicals",
    label: "Химийн бодисын агуулах",
    note: "2023 онд 184 · 2024 онд 20 агуулах",
    icon: FlaskConical,
  },
  {
    id: "repair",
    label: "Авто засварын үйлчилгээ",
    note: "528 цэг · зөвхөн газрын зураг",
    icon: Wrench,
  },
  {
    id: "scheme",
    label: "Хяналт шалгалтын схем",
    note: "2026 оны үйл ажиллагааны журам",
    icon: Workflow,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function HyanaltWorkspace() {
  /* Сонголт хадгалагдана — хэрэглэгч ажлаа тасалдуулаад буцаж ирэхэд
     хамгийн сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("hyanalt.tab", IDS, "repair");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <SourceTabs tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      <div className="min-h-0 flex-1">
        {tab === "repair" ? (
          <RepairMap />
        ) : tab === "scheme" ? (
          <InspectionScheme />
        ) : (
          <ChemicalsDashboard />
        )}
      </div>
    </div>
  );
}
