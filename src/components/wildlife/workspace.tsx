"use client";

import dynamic from "next/dynamic";
import {
  Leaf,
  Loader2,
  PhoneCall,
  Rat,
  Squirrel,
  Sticker,
  Waypoints,
  Zap,
} from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";

/*
  Хэлтсийн сэдвүүд. Самбар хооронд сольж харна.

  Бүгдийг зэрэг ачаалахгүй: сонгосон нь л татагдана. Тус бүр нь газрын
  зураг, MapLibre-тэй тул бүгдийг эхнээс нь ачаалах нь дэмий жин.
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

const EcoDashboard = dynamic(
  () => import("@/components/wildlife/eco-dashboard").then((m) => m.EcoDashboard),
  { ssr: false, loading: spinner },
);

const PolesDashboard = dynamic(
  () => import("@/components/wildlife/poles-dashboard").then((m) => m.PolesDashboard),
  { ssr: false, loading: spinner },
);

const StickersDashboard = dynamic(
  () =>
    import("@/components/wildlife/stickers-dashboard").then((m) => m.StickersDashboard),
  { ssr: false, loading: spinner },
);

const MarmotsDashboard = dynamic(
  () => import("@/components/wildlife/marmots-dashboard").then((m) => m.MarmotsDashboard),
  { ssr: false, loading: spinner },
);

const LichensDashboard = dynamic(
  () => import("@/components/wildlife/lichens-dashboard").then((m) => m.LichensDashboard),
  { ssr: false, loading: spinner },
);

/*
  Табны нэр ТОВЧ байх ёстой — долоон таб нэг зурваст багтана. Албан ёсны
  бүтэн нэрийг `full`-д үлдээж, самбар дээр нь харуулна.
*/
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
  {
    id: "eco",
    label: "Экологийн коридор",
    note: "2024 · давхцаж буй нэгж талбар",
    icon: Waypoints,
  },
  {
    id: "poles",
    label: "Цахилгааны шон",
    note: "10, 15 кВ-ын шугам",
    full: "Цахилгаан дамжуулах 10, 15 кВ-ын шонгууд",
    icon: Zap,
  },
  {
    id: "stickers",
    label: "Стикер барилга",
    note: "Шувуу мөргөхөөс сэргийлсэн",
    full: "Стикер байршуулсан барилгын мэдээлэл",
    icon: Sticker,
  },
  {
    id: "marmots",
    label: "Нутагшуулсан тарвага",
    note: "2022–2026 · барьсан, тавьсан",
    full: "Шилжүүлэн нутагшуулсан тарваганы мэдээлэл",
    icon: Rat,
  },
  {
    id: "lichens",
    label: "Хаг",
    note: "Ургамлын олон янз байдал",
    full: "Байгалийн ургамлын олон янз байдал, генетик нөөц, хамгаалал — хаг",
    icon: Leaf,
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
      {/* Сэлгэх зурвас — аль самбар идэвхтэйг үргэлж ил байлгана */}
      <SourceTabs tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      <div className="min-h-0 flex-1">
        {tab === "calls" ? (
          <CallsDashboard />
        ) : tab === "rescues" ? (
          <RescuesDashboard />
        ) : tab === "eco" ? (
          <EcoDashboard />
        ) : tab === "poles" ? (
          <PolesDashboard />
        ) : tab === "stickers" ? (
          <StickersDashboard />
        ) : tab === "marmots" ? (
          <MarmotsDashboard />
        ) : (
          <LichensDashboard />
        )}
      </div>
    </div>
  );
}
