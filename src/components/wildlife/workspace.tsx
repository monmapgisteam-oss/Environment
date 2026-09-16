"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ClipboardList,
  LandPlot,
  Leaf,
  LeafyGreen,
  Loader2,
  Microscope,
  PawPrint,
  Rat,
  Sprout,
  Squirrel,
  Sticker,
  Tractor,
  Turtle,
  Waypoints,
  Zap,
} from "lucide-react";
import { SourceTabs, TabGroups, useStoredTab } from "@/components/ui/source-tabs";
import { WILDLIFE_SOLO } from "@/lib/wildlife-layers";

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

/*
  ⚠ Survey123-ийн дуудлагын самбар (`wildlife/dashboard.tsx`) ХҮРЭЭНД
  ОРООГҮЙ: хэлтэс тэр цэсийг бүрмөсөн хассан (2026-09-16). Код нь
  хэвээр үлдсэн — маягтын бүртгэл дахин хэрэгтэй болбол буцаана.
*/

const RescuesDashboard = dynamic(
  () =>
    import("@/components/wildlife/rescues-dashboard").then(
      (m) => m.RescuesDashboard,
    ),
  { ssr: false, loading: spinner },
);

const EcoDashboard = dynamic(
  () =>
    import("@/components/wildlife/eco-dashboard").then((m) => m.EcoDashboard),
  { ssr: false, loading: spinner },
);

const PolesDashboard = dynamic(
  () =>
    import("@/components/wildlife/poles-dashboard").then(
      (m) => m.PolesDashboard,
    ),
  { ssr: false, loading: spinner },
);

const StickersDashboard = dynamic(
  () =>
    import("@/components/wildlife/stickers-dashboard").then(
      (m) => m.StickersDashboard,
    ),
  { ssr: false, loading: spinner },
);

const MarmotsDashboard = dynamic(
  () =>
    import("@/components/wildlife/marmots-dashboard").then(
      (m) => m.MarmotsDashboard,
    ),
  { ssr: false, loading: spinner },
);

const LichensDashboard = dynamic(
  () =>
    import("@/components/wildlife/lichens-dashboard").then(
      (m) => m.LichensDashboard,
    ),
  { ssr: false, loading: spinner },
);

/*
  Порталын давхаргын самбар — ойн хэлтэстэй ХУВААЛЦСАН
  ([layers/portal-dashboard.tsx](src/components/layers/portal-dashboard.tsx)).

  ⚠ **Бүх давхаргыг нэг зураг дээр нийлүүлсэн "Порталын давхарга" ТАБ
  ХАСАГДСАН** (хэрэглэгчийн шийдвэр, 2026-09-16). Сэдэв бүр өөрийн
  цонхтой болсны дараа тэр таб нь бусдыг ДАВТАХААС өөр юу ч нэмэхгүй
  байв. Дахин бүү нэм.

  Самбар нь харин хэвээр: доорх зургаан сэдэв нэг давхаргатай
  бүрдлээр (`WILDLIFE_SOLO`) үүнийг дуудна — бүтцээ эх сурвалжаас
  өөрөө уншдаг тул тэдэнд зориулж тусдаа код бичих шаардлагагүй.
*/
const PortalLayers = dynamic(
  () =>
    import("@/components/layers/portal-dashboard").then(
      (m) => m.PortalLayersDashboard,
    ),
  { ssr: false, loading: spinner },
);

/*
  ЕРӨНХИЙ ХОЁР БҮЛЭГ (хэрэглэгчийн шийдвэр, 2026-09-16).

  Хэлтэс нь "Амьтан, ургамлыг хамгаалах" нэгж бөгөөд сэдвүүд нь яг тэр
  хоёр талд хуваагдана. Арван хоёр таб нэг зурваст багтахаа больсон тул
  бүлэг нь зөвхөн эмх цэгц биш — хайж буй сэдвээ олох зам болно.

  ⚠ Экологийн коридор, биотехник, шилэн барилга, цахилгааны шон дөрөв
  нь АМЬТАНД харьяалагдана: гурав нь амьтны хөдөлгөөн, мөргөлт,
  тэжээллэгт зориулсан арга хэмжээ, нэг нь шувууны хамгаалал. Ургамалд
  `A02` бүлгийн гурав л (хаг, хөвд, мөөг) орно.
*/
const GROUPS = [
  { id: "amitan", label: "Амьтан", note: "9 сэдэв", icon: PawPrint },
  { id: "urgamal", label: "Ургамал", note: "3 сэдэв", icon: Leaf },
] as const;

type GroupId = (typeof GROUPS)[number]["id"];

/*
  Табны нэр ТОВЧ байх ёстой. Албан ёсны бүтэн нэрийг `full`-д үлдээж,
  самбар дээр нь харуулна.

  Тайлбар (`note`) нь бичлэгийн тоо, төрөл — татахаас өмнө юу байгааг
  мэдэхэд хангалттай. Тоог эх сурвалжаас нь уншсан (2026-09-16);
  давхарга шинэчлэгдвэл энд ч дагаж засна.
*/
const TABS = [
  {
    id: "rescues",
    group: "amitan",
    label: "Аврагдсан амьтад",
    note: "720 бичлэг · 2019–2026",
    icon: Squirrel,
  },
  /*
    ⚠ Энэ нь дээрх табын ӨӨР эх сурвалж: тэр нь
    `A03_zerleg_amitdiin_burtgel` (720 бичлэг), энэ нь
    `A01_zerleg_amitdiin_sudalgaa` (200 цэг). Нэр нь төстэй ч агуулга
    нь огт таарахгүй — `wildlife-layers.ts`-ийн тайлбарыг үз.
  */
  {
    id: "burtgel",
    group: "amitan",
    label: "Амьтдын бүртгэл",
    note: "200 цэг · хээрийн судалгаа",
    full: "Зэрлэг амьтдын судалгааны цэгүүд",
    icon: ClipboardList,
  },
  {
    id: "eco",
    group: "amitan",
    label: "Экологийн коридор",
    note: "2024 · давхцаж буй нэгж талбар",
    icon: Waypoints,
  },
  {
    id: "poles",
    group: "amitan",
    label: "Цахилгааны шон",
    note: "10, 15 кВ-ын шугам",
    full: "Цахилгаан дамжуулах 10, 15 кВ-ын шонгууд",
    icon: Zap,
  },
  {
    id: "stickers",
    group: "amitan",
    label: "Шилэн барилга",
    note: "78 барилга · стикер",
    full: "Шилэн барилгын судалгаа, стикер байршуулалт",
    icon: Sticker,
  },
  {
    id: "marmots",
    group: "amitan",
    label: "Нутагшуулсан тарвага",
    note: "2022–2026 · барьсан, тавьсан",
    full: "Шилжүүлэн нутагшуулсан тарваганы мэдээлэл",
    icon: Rat,
  },
  {
    id: "biotechnik",
    group: "amitan",
    label: "Биотехник",
    note: "14 арга хэмжээ · давс, өвс",
    full: "Биотехникийн арга хэмжээний бүртгэл",
    icon: Tractor,
  },
  {
    id: "minj-talbai",
    group: "amitan",
    label: "Минжний талбай",
    note: "2 талбай",
    full: "Минж бүртгэгдсэн талбай",
    icon: LandPlot,
  },
  {
    id: "minj-busad",
    group: "amitan",
    label: "Минж ба бусад",
    note: "120 цэг · судалгааны үе",
    full: "Минж ба бусад зүйлийн ажиглалт",
    icon: Turtle,
  },
  {
    id: "lichens",
    group: "urgamal",
    label: "Хаг",
    note: "2,391 бичлэг · 181 зүйл",
    full: "Байгалийн ургамлын олон янз байдал, генетик нөөц, хамгаалал — хаг",
    icon: LeafyGreen,
  },
  {
    id: "hovd",
    group: "urgamal",
    label: "Хөвд",
    note: "30 цэг · зүйлийн бүртгэл",
    full: "Хөвдний судалгааны цэгүүд",
    icon: Sprout,
  },
  {
    id: "moog",
    group: "urgamal",
    label: "Мөөг",
    note: "55 цэг · зүйлийн бүртгэл",
    full: "Мөөгний судалгааны цэгүүд",
    icon: Microscope,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function WildlifeWorkspace() {
  /* Сонголт хадгалагдана — хэрэглэгч ажлаа тасалдуулаад буцаж ирэхэд
     хамгийн сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("wildlife.tab", IDS, "rescues");

  /* Бүлэг нь ТУСДАА төлөв БИШ — сонгосон сэдвээсээ гарна */
  const group: GroupId = TABS.find((t) => t.id === tab)?.group ?? GROUPS[0].id;

  const shown = React.useMemo(() => TABS.filter((t) => t.group === group), [group]);

  /* Бүлэг товшиход түүний эхний сэдэв нээгдэнэ */
  const pickGroup = React.useCallback(
    (id: GroupId) => {
      const first = TABS.find((t) => t.group === id);
      if (first) pick(first.id);
    },
    [pick],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* Эцэг түвшин — амьтан уу, ургамал уу */}
      <TabGroups groups={GROUPS} value={group} onChange={pickGroup} />

      {/* Сэлгэх зурвас — аль самбар идэвхтэйг үргэлж ил байлгана */}
      <SourceTabs tabs={shown} value={tab} onChange={pick} label="Сэдэв" />

      {/*
        ⚠ `key` нь ЗААВАЛ: доорх салаануудын зургаа нь НЭГ бүрэлдэхүүн
        тул React нь таб солиход түүнийг ДАХИН ҮҮСГЭДЭГГҮЙ — асаалттай
        давхарга, шүүлтүүр, татагдсан бичлэг өмнөх табынхаараа үлдэнэ.
        Бүрдлийн түлхүүрийг өгснөөр таб бүр цэвэр төлөвтэй нээгдэнэ.
      */}
      <div className="min-h-0 flex-1">
        {tab === "rescues" ? (
          <RescuesDashboard />
        ) : tab === "eco" ? (
          <EcoDashboard />
        ) : tab === "poles" ? (
          <PolesDashboard />
        ) : tab === "stickers" ? (
          <StickersDashboard />
        ) : tab === "marmots" ? (
          <MarmotsDashboard />
        ) : tab === "lichens" ? (
          <LichensDashboard />
        ) : tab === "hovd" ? (
          <PortalLayers key={WILDLIFE_SOLO.hovd.key} set={WILDLIFE_SOLO.hovd} />
        ) : tab === "moog" ? (
          <PortalLayers key={WILDLIFE_SOLO.moog.key} set={WILDLIFE_SOLO.moog} />
        ) : tab === "biotechnik" ? (
          <PortalLayers
            key={WILDLIFE_SOLO.biotechnik.key}
            set={WILDLIFE_SOLO.biotechnik}
          />
        ) : tab === "minj-talbai" ? (
          <PortalLayers
            key={WILDLIFE_SOLO.minjTalbai.key}
            set={WILDLIFE_SOLO.minjTalbai}
          />
        ) : tab === "minj-busad" ? (
          <PortalLayers
            key={WILDLIFE_SOLO.minjBusad.key}
            set={WILDLIFE_SOLO.minjBusad}
          />
        ) : (
          <PortalLayers
            key={WILDLIFE_SOLO.burtgel.key}
            set={WILDLIFE_SOLO.burtgel}
          />
        )}
      </div>
    </div>
  );
}
