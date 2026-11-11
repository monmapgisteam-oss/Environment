"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  CloudSun,
  FileCheck2,
  Flame,
  Leaf,
  Loader2,
  ShieldAlert,
  Trash2,
  TreePine,
  Waves,
  Route,
} from "lucide-react";
import { SourceTabs, TabGroups, useStoredTab } from "@/components/ui/source-tabs";
import { useAccess } from "@/components/auth/access";
import "./workspace.css";
import type { LayerSet } from "@/lib/portal-layers";
import { ECO, FLOOD, GAS, GREEN, WASTE } from "@/lib/unelgee-layers";
import { TabAccess } from "@/components/auth/tab-access";
import { UnelgeeLayers } from "@/components/unelgee/dept-layers";
import type { MapOverlay } from "@/components/wells/map";

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
function group(set: LayerSet, tab: string) {
  const D = dynamic(
    () =>
      import("@/components/layers/portal-dashboard").then(
        (m) => m.PortalLayersDashboard,
      ),
    { ssr: false, loading: spinner },
  );
  /* Хэлтсийн бусад бүртгэлийн дүрс — суурь зургийн доорх "Давхарга" товчоор
     ({@link UnelgeeLayers}); энэ цэсийн давхаргууд тэнд "Энэ самбар" */
  const G = () => {
    const [layers, setLayers] = React.useState<MapOverlay[]>([]);
    return (
      <D
        set={set}
        presentation="environment"
        access={{ scope: "unelgee-uur-amisgal", tab }}
        extraOverlays={layers}
        mapTools={<UnelgeeLayers inline current={set.layers} value={layers} onChange={setLayers} />}
      />
    );
  };
  G.displayName = `LayerGroup(${set.key})`;
  return G;
}

const FloodDashboard = group(FLOOD, "flood");
const GasDashboard = group(GAS, "gas");
const GreenDashboard = group(GREEN, "green");
const WasteDashboard = group(WASTE, "waste");
const EcoDashboard = group(ECO, "eco");

/*
  ДӨРВӨН БҮЛЭГ — агуулгаар (хэрэглэгч 2026-11-11: "бүлэглэх, чи агуулгаар нь
  бүлэглэчих"; амьтан ургамал, ой, орчны хэлтэстэй нэг загвар — дээд талын
  товч, 2 × 2 тор):
  · ҮНЭЛГЭЭ — нөлөөллийн ерөнхий үнэлгээ, менежментийн төлөвлөгөө (нэгж
    талбар тутмын баримт);
  · ЭРСДЭЛ — үер, хог хаягдлын цэг, хийн тоног төхөөрөмж (аюулын эх үүсвэр,
    эрсдэлтэй газар);
  · НОГООН БАЙГУУЛАМЖ — ногоон байгууламж, эко-инфраструктур;
  · УУР АМЬСГАЛ — цаг агаарын ажиглалт.
  Бүлэг нь сонгосон сэдвээс гарна; бүлэг товшиход эхний нээлттэй сэдэв нээгдэнэ.
*/
export const GROUPS = [
  { id: "unelgee", label: "Үнэлгээ", note: "2 сэдэв", icon: FileCheck2 },
  { id: "ersdel", label: "Эрсдэл", note: "3 сэдэв", icon: ShieldAlert },
  /* Товчинд "Ногоон байгууламж" 127px-д багтахгүй (тэмдэг тасарч байв) —
     товч нэр, бүтэн нь `title`-д */
  { id: "nogoon", label: "Ногоон", note: "Ногоон байгууламж, эко-инфраструктур · 2 сэдэв", icon: Leaf },
  { id: "uur_amisgal", label: "Уур амьсгал", note: "1 сэдэв", icon: CloudSun },
] as const;

type GroupId = (typeof GROUPS)[number]["id"];

export const TABS = [
  {
    id: "unelgee",
    group: "unelgee",
    label: "Байгаль орчны нөлөөллийн ерөнхий үнэлгээ",
    note: "2025, 2026 оны үнэлгээний бүртгэл",
    icon: FileCheck2,
  },
  {
    id: "bomt",
    group: "unelgee",
    label: "Байгаль орчны менежментийн төлөвлөгөө",
    note: "2026 оны нэгтгэл · мод тарих үүрэг",
    full: "Байгаль орчны менежментийн төлөвлөгөөний 2026 оны нэгтгэл",
    icon: TreePine,
  },
  {
    id: "flood",
    group: "ersdel",
    label: "Үерийн эрсдэл",
    note: "Долоон давхарга · эрсдэлт талбай, барилга, айл өрх",
    icon: Waves,
  },
  {
    id: "green",
    group: "nogoon",
    label: "Ногоон байгууламж",
    note: "Ногоон байгууламж, цэцэрлэгт хүрээлэн",
    icon: Leaf,
  },
  {
    id: "eco",
    group: "nogoon",
    label: "Эко-инфраструктур",
    note: "Найман давхарга · бичил цэцэрлэг, зам, оршуулга",
    icon: Route,
  },
  {
    id: "waste",
    group: "ersdel",
    label: "Хог хаягдлын цэг",
    note: "Байршил, талбайн бүртгэл",
    icon: Trash2,
  },
  {
    id: "gas",
    group: "ersdel",
    label: "Хийн тоног төхөөрөмж",
    note: "Байршил, тоног төхөөрөмжийн бүртгэл",
    icon: Flame,
  },
  {
    id: "weather",
    group: "uur_amisgal",
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
  const [tab, pick] = useStoredTab<TabId>("unelgee.tab", IDS, "unelgee", "unelgee-uur-amisgal");

  /* Бүлэг нь сонгосон сэдвээс гарна; нээлттэй сэдэвгүй бүлэг ГАРАХГҮЙ */
  const group: GroupId = TABS.find((t) => t.id === tab)?.group ?? GROUPS[0].id;
  const shown = React.useMemo(() => TABS.filter((t) => t.group === group), [group]);
  const { allowsTab } = useAccess();
  const groups = GROUPS.filter((g) => TABS.some((t) => t.group === g.id && allowsTab("unelgee-uur-amisgal", t.id)));
  const pickGroup = React.useCallback(
    (id: GroupId) => {
      const first = TABS.find((t) => t.group === id && allowsTab("unelgee-uur-amisgal", t.id));
      if (first) pick(first.id);
    },
    [pick, allowsTab],
  );

  return (
    <div className="department-workspace ue-workspace">
      <SourceTabs
        scope="unelgee-uur-amisgal"
        groupControl={<TabGroups groups={groups} value={group} onChange={pickGroup} />}
        tabs={shown}
        value={tab}
        onChange={pick}
        label="Сэдэв"
      />

      <div id="ue-topic-panel" className="department-workspace-content" role="region" aria-label={TABS.find((topic) => topic.id === tab)?.label}>
        <TabAccess scope="unelgee-uur-amisgal" tab={tab}>
          {tab === "unelgee" ? <UnelgeeDashboard /> : null}
          {tab === "bomt" ? <BomtDashboard /> : null}
          {tab === "flood" ? <FloodDashboard /> : null}
          {tab === "green" ? <GreenDashboard /> : null}
          {tab === "eco" ? <EcoDashboard /> : null}
          {tab === "waste" ? <WasteDashboard /> : null}
          {tab === "gas" ? <GasDashboard /> : null}
          {tab === "weather" ? <WeatherDashboard /> : null}
        </TabAccess>
      </div>
    </div>
  );
}
