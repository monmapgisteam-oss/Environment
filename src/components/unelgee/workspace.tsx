"use client";

import dynamic from "next/dynamic";
import {
  CloudSun,
  FileCheck2,
  Flame,
  Leaf,
  Loader2,
  Trash2,
  TreePine,
  Waves,
  Route,
} from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";
import "./workspace.css";
import type { LayerSet } from "@/lib/portal-layers";
import { ECO, FLOOD, GAS, GREEN, WASTE } from "@/lib/unelgee-layers";

/*
  Хэлтэс гурван эх сурвалжтай тул самбар хооронд сольж харна.

  Ерөнхий үнэлгээний ОН нь тусдаа таб БИШ, самбар доторх сонголт:
  таб нь СЭДЭВ ялгадаг, он нь нэг сэдвийн доторх хувилбар. Хөрсний
  мониторингийн жилийн сонголттой ижил түвшний зүйл тул мөн ижил
  хэлбэртэй — шүүлтүүрийн мөрийн эхэнд суух товчны хос.

  Зэрэг ачаалахгүй: сонгосон нь л татагдана. Тус бүр нь газрын зураг,
  MapLibre-тэй тул хоёуланг нь эхнээс нь ачаалах нь дэмий жин.

  Цаг агаарын таб нь бусад хоёроос ЭРС өөр бүтэцтэй: тэдгээр нь нэгж
  талбарын бүртгэл (баримт бичиг) бол энэ нь мэдрэгчийн сүлжээний
  тухайн мөчийн заалт. Эх сурвалж түүх өгдөггүй тул диаграм, шүүлтүүрийн
  мөр байхгүй — хэмжих хэрэгслийн самбар хэлбэртэй.

  Уур амьсгалын өөрчлөлтийн урт хугацааны цуваа хэлтсээс хараахан
  ирээгүй; одоогоор ажиглалтын сүлжээ л холбогдсон.
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

const WeatherDashboard = dynamic(
  () => import("@/components/unelgee/weather-dashboard").then((m) => m.WeatherDashboard),
  { ssr: false, loading: spinner },
);

/**
 * Давхаргын бүлгийн самбар — таван сэдэв НЭГ бүрэлдэхүүнээр зурагдана.
 *
 * ⚠ Бүлэг бүрд тусдаа самбар БИЧИХГҮЙ. Үзүүлэгч нь талбарын бүтцийг
 * ArcGIS-ээс өөрөө уншиж диаграмыг гаргадаг тул сэдвээс хамаарахгүй;
 * шинэ давхарга ирэхэд `lib/layers.ts`-ийн жагсаалтад нэмэхэд л
 * хангалттай.
 */
function group(set: LayerSet) {
  const D = dynamic(
    () =>
      import("@/components/layers/portal-dashboard").then(
        (m) => m.PortalLayersDashboard,
      ),
    { ssr: false, loading: spinner },
  );
  const G = () => <D set={set} presentation="environment" />;
  G.displayName = `LayerGroup(${set.key})`;
  return G;
}

const FloodDashboard = group(FLOOD);
const GasDashboard = group(GAS);
const GreenDashboard = group(GREEN);
const WasteDashboard = group(WASTE);
const EcoDashboard = group(ECO);

const TABS = [
  {
    id: "unelgee",
    label: "Байгаль орчны нөлөөллийн ерөнхий үнэлгээ",
    note: "2025, 2026 оны үнэлгээний бүртгэл",
    icon: FileCheck2,
  },
  {
    id: "bomt",
    label: "Байгаль орчны менежментийн төлөвлөгөө",
    note: "2026 оны нэгтгэл · мод тарих үүрэг",
    full: "Байгаль орчны менежментийн төлөвлөгөөний 2026 оны нэгтгэл",
    icon: TreePine,
  },
  {
    id: "flood",
    label: "Үерийн эрсдэл",
    note: "Долоон давхарга · эрсдэлт талбай, барилга, айл өрх",
    icon: Waves,
  },
  {
    id: "green",
    label: "Ногоон байгууламж",
    note: "Ногоон байгууламж, цэцэрлэгт хүрээлэн",
    icon: Leaf,
  },
  {
    id: "eco",
    label: "Эко-инфраструктур",
    note: "Найман давхарга · бичил цэцэрлэг, зам, оршуулга",
    icon: Route,
  },
  {
    id: "waste",
    label: "Хог хаягдлын цэг",
    note: "Байршил, талбайн бүртгэл",
    icon: Trash2,
  },
  {
    id: "gas",
    label: "Хийн тоног төхөөрөмж",
    note: "Байршил, тоног төхөөрөмжийн бүртгэл",
    icon: Flame,
  },
  {
    id: "weather",
    label: "Цаг агаарын ажиглалт",
    note: "Ажиглалтын сүлжээ · таван хоногийн урьдчилсан мэдээ",
    full: "Ус цаг уур, орчны шинжилгээний газрын ажиглалтын сүлжээ",
    icon: CloudSun,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function UnelgeeWorkspace() {
  /* Сонголт хадгалагдана — хэрэглэгч ажлаа тасалдуулаад буцаж ирэхэд
     хамгийн сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("unelgee.tab", IDS, "unelgee");

  return (
    <div className="department-workspace ue-workspace">
      <SourceTabs tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      <div id="ue-topic-panel" className="department-workspace-content" role="region" aria-label={TABS.find((topic) => topic.id === tab)?.label}>
        {tab === "unelgee" ? <UnelgeeDashboard /> : null}
        {tab === "bomt" ? <BomtDashboard /> : null}
        {tab === "flood" ? <FloodDashboard /> : null}
        {tab === "green" ? <GreenDashboard /> : null}
        {tab === "eco" ? <EcoDashboard /> : null}
        {tab === "waste" ? <WasteDashboard /> : null}
        {tab === "gas" ? <GasDashboard /> : null}
        {tab === "weather" ? <WeatherDashboard /> : null}
      </div>
    </div>
  );
}
