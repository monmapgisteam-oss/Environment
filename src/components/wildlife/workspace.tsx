"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ClipboardList,
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
import {
  SourceTabs,
  TabGroups,
  useStoredTab,
} from "@/components/ui/source-tabs";
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
  ОРООГҮЙ: хэлтэс тэр цэсийг бүрмөсөн хассан (2026-09-16). Код нь мөн
  өдөр УСТГАГДСАН — маягтын бүртгэл дахин хэрэгтэй болбол git түүхээс
  сэргээнэ.
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
  Хөвд, мөөг — ХАГТАЙ нэг хэвийн самбар (хэрэглэгчийн шийдвэр,
  2026-09-16: "хөвд, мөөг хоёрыг хаг шиг болгоё").

  Гурван судалгаа нэг асуултад хариулна: "аль цэгт ямар зүйл
  бүртгэгдсэн бэ". Урьд нь хоёулаа бүтцээ өөрөө уншдаг ерөнхий
  самбараар зурагдаж байсан бөгөөд зүйлийн жагсаалт нь НЭГ нүдэнд
  бөөндөө үлдэж, хайх ч, задлах ч боломжгүй байв.

  ⚠ Хоёр судалгаа НЭГ бүрэлдэхүүнээр зурагдана — ялгаа нь зөвхөн
  `kind` проп. `key` ЗААВАЛ: эс тэгвээс таб солиход React дахин
  үүсгэхгүй, өмнөх судалгааны төлөв үлдэнэ.
*/
/*
  Биотехник — ХҮСНЭГТ ТӨВТЭЙ самбар.

  14 бичлэг тус бүр ДОКУМЕНТ (давс, өвс хавар, өвс намар, зам —
  дөрвөн тоог зэрэг харах шаардлагатай) тул диаграм нэмэх нь
  хүснэгтэд аль хэдийн байгаа тоог дахин зурахаас өөр юу ч хэлэхгүй.
*/
const BiotechDashboard = dynamic(
  () =>
    import("@/components/wildlife/biotech-dashboard").then(
      (m) => m.BiotechDashboard,
    ),
  { ssr: false, loading: spinner },
);

/*
  Минж — ГУРВАН давхарга НЭГ зурган дээр: судалгааны талбай (хүрээ),
  явсан маршрут (шугам), олдсон ажиглалт (цэг). "Хаана явж, юу
  олсон" гэдгийг зөвхөн гуравт нь зэрэг харж ойлгоно.
*/
const BeaverDashboard = dynamic(
  () =>
    import("@/components/wildlife/beaver-dashboard").then(
      (m) => m.BeaverDashboard,
    ),
  { ssr: false, loading: spinner },
);

const FloraDashboard = dynamic(
  () =>
    import("@/components/wildlife/flora-dashboard").then(
      (m) => m.FloraDashboard,
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
  { id: "amitan", label: "Амьтан", note: "8 сэдэв", icon: PawPrint },
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
    note: "14 байршил · давс, өвс",
    full: "Биотехникийн арга хэмжээний бүртгэл",
    icon: Tractor,
  },
  /*
    ⚠ Талбай, маршрут, ажиглалт ГУРВАН давхарга НЭГ цэсэнд. Урьд нь
    талбай, ажиглалт хоёр тусдаа цэстэй байсан бөгөөд "Минжний
    талбай" нь ердөө хоёр мөр агуулж хоосон харагддаг, маршрут нь
    огт цэсгүй үлдсэн байв. "Хаана явж, юу олсон" гэдгийг зөвхөн
    гуравт нь зэрэг харж ойлгоно.
  */
  {
    id: "minj",
    group: "amitan",
    label: "Минжний судалгаа",
    note: "424 км маршрут · 120 ажиглалт",
    full: "Минжний судалгааны талбай, маршрут, ажиглалт",
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
    note: "30 цэг · 55 зүйл",
    full: "Хөвдний судалгааны цэгүүд",
    icon: Sprout,
  },
  {
    id: "moog",
    group: "urgamal",
    label: "Мөөг",
    note: "55 цэг · 47 зүйл",
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

  const shown = React.useMemo(
    () => TABS.filter((t) => t.group === group),
    [group],
  );

  /* Бүлэг товшиход түүний эхний сэдэв нээгдэнэ */
  const pickGroup = React.useCallback(
    (id: GroupId) => {
      const first = TABS.find((t) => t.group === id);
      if (first) pick(first.id);
    },
    [pick],
  );

  return (
    <div className="department-workspace">
      {/* Бүлэг болон өгөгдлийн багцын сонголт зүүн панельд байрлана. */}
      <SourceTabs groupControl={<TabGroups groups={GROUPS} value={group} onChange={pickGroup} />} tabs={shown} value={tab} onChange={pick} label="Сэдэв" />

      {/*
        ⚠ `key` нь ЗААВАЛ: доорх салаануудын зургаа нь НЭГ бүрэлдэхүүн
        тул React нь таб солиход түүнийг ДАХИН ҮҮСГЭДЭГГҮЙ — асаалттай
        давхарга, шүүлтүүр, татагдсан бичлэг өмнөх табынхаараа үлдэнэ.
        Бүрдлийн түлхүүрийг өгснөөр таб бүр цэвэр төлөвтэй нээгдэнэ.
      */}
      <div className="department-workspace-content">
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
          <FloraDashboard key="hovd" kind="hovd" />
        ) : tab === "moog" ? (
          <FloraDashboard key="moog" kind="moog" />
        ) : tab === "biotechnik" ? (
          <BiotechDashboard />
        ) : tab === "minj" ? (
          <BeaverDashboard />
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
