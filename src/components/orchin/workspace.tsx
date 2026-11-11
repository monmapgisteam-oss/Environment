"use client";

import dynamic from "next/dynamic";
import {
  ClipboardList,
  FileText,
  FlaskConical,
  Loader2,
  Mountain,
  Pickaxe,
  Shovel,
  Sprout,
  Toilet,
} from "lucide-react";
import * as React from "react";
import { SourceTabs, TabGroups, useStoredTab } from "@/components/ui/source-tabs";
import { TabAccess } from "@/components/auth/tab-access";
import { useAccess } from "@/components/auth/access";

/*
  Хэлтсийн сэдвүүд. Самбар хооронд сольж харна.

  Сэдэв доторх сонголт (жишээ нь "нүхэн / нийтийн жорлон") нь ӨӨР
  түвшний зүйл — нэг сэдвийн хоёр эх сурвалж. Энэ зурвас нь сэдвийг
  өөрийг нь сольдог тул дээр нь байрлана.

  Сонгосон самбар нь л ачаалагдана: тус бүр MapLibre-тэй тул бүгдийг
  нь эхнээс нь татах нь дэмий жин.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const SanitationDashboard = dynamic(
  () => import("@/components/orchin/dashboard").then((m) => m.OrchinDashboard),
  { ssr: false, loading: spinner },
);

const SoilDashboard = dynamic(
  () => import("@/components/orchin/soil-dashboard").then((m) => m.SoilDashboard),
  { ssr: false, loading: spinner },
);

/*
  Табны нэр нь ТОВЧ байх ёстой — зургаан таб нэг мөрөнд багтана.
  Албан ёсны бүтэн нэрийг `full`-д үлдээж, самбар дээр нь харуулна.
*/
const ReclamationDashboard = dynamic(
  () =>
    import("@/components/orchin/reclamation-dashboard").then(
      (m) => m.ReclamationDashboard,
    ),
  { ssr: false, loading: spinner },
);

const DamagedDashboard = dynamic(
  () => import("@/components/orchin/damaged-dashboard").then((m) => m.DamagedDashboard),
  { ssr: false, loading: spinner },
);

const PetitionsDashboard = dynamic(
  () => import("@/components/orchin/petitions-dashboard").then((m) => m.PetitionsDashboard),
  { ssr: false, loading: spinner },
);

const NeutralizationDashboard = dynamic(
  () =>
    import("@/components/orchin/neutralization-dashboard").then(
      (m) => m.NeutralizationDashboard,
    ),
  { ssr: false, loading: spinner },
);

const LicensesDashboard = dynamic(
  () => import("@/components/orchin/licenses-dashboard").then((m) => m.LicensesDashboard),
  { ssr: false, loading: spinner },
);

const MineralsDashboard = dynamic(
  () => import("@/components/orchin/minerals-dashboard").then((m) => m.MineralsDashboard),
  { ssr: false, loading: spinner },
);

/*
  ХОЁР БҮЛЭГ (хэрэглэгч 2026-10-16: "ene hesgiig 2 group bolgomoor bn"):
  · ХӨРС — бохирдлын хэмжилт ба түүний эх үүсвэр (жорлон, хөрсний
    мониторинг, саармагжуулалт);
  · ТҮГЭЭМЭЛ ТАРХАЦТАЙ АШИГТ МАЛТМАЛ — газрын эвдрэл, нөхөн сэргээлт,
    өргөдөл, тусгай зөвшөөрөл.
  ⚠ Бүлэг нь жагсаалтын ДЭЭД талын товчны эгнээ (`TabGroups`) — амьтан
  ургамал, ойн хэлтэстэй НЭГ загвар (хэрэглэгч 2026-11-11: "өгөгдлийн
  багцыг нэг загвартай болгох"). 2026-10-16-нд жагсаалт дотор задардаг
  мөрийг (`SourceTabs sections`) сонгосон байсныг энэ шийдвэр орлосон.
  Бүлэг нь сонгосон сэдвээс гарна; бүлэг товшиход эхний нээлттэй сэдэв нээгдэнэ.
*/
export const GROUPS = [
  { id: "pollution", label: "Хөрс", note: "3 сэдэв", icon: FlaskConical },
  /* ТОВЧЛОЛ хэрэглэгчийн шийдвэр (2026-11-11: "товчил ТТАМ гээд") — бүтэн нэр
     нь товчны `title`, доорх сэдвүүдийн тайлбарт */
  { id: "land", label: "ТТАМ", note: "Түгээмэл тархацтай ашигт малтмал · 6 сэдэв", icon: Pickaxe },
] as const;

export const TABS = [
  {
    id: "soil",
    group: "pollution",
    label: "Хөрсний хяналт шинжилгээ",
    note: "Мониторингийн цэгийн мэдээлэл",
    icon: Mountain,
  },
  {
    /*
      Хөрсний хяналт шинжилгээний ДАРАА: хоёулаа хөрсний хүнд металын
      хэмжилт бөгөөд ижил элементүүдийг хэмждэг. Ялгаа нь хамрах хүрээ —
      тэр нь хотын мониторингийн 500 гаруй цэг, энэ нь дөрвөн тусгай цэг.
    */
    id: "neutralization",
    group: "pollution",
    label: "Саармагжуулалт",
    note: "Дөрвөн цэгийн хүнд металын хэмжилт",
    icon: FlaskConical,
  },
  {
    id: "sanitation",
    group: "pollution",
    label: "Ариун цэврийн байгууламж",
    note: "Нүхэн жорлон, нийтийн ариун цэврийн байгууламж",
    icon: Toilet,
  },
  {
    id: "licenses",
    group: "land",
    label: "Ашигт малтмалын зөвшөөрөл",
    note: "Түгээмэл тархацтай · нийслэлийн нутаг дэвсгэр",
    full:
      "Нийслэлийн нутаг дэвсгэрт байрлах түгээмэл тархацтай ашигт малтмалын " +
      "тусгай зөвшөөрөл эзэмшигч аж ахуйн нэгжүүдийн жагсаалт",
    icon: Pickaxe,
  },
  {
    /*
      Дээрх "licenses" табаас ӨӨР бүртгэл: тэр нь ТҮГЭЭМЭЛ ТАРХАЦТАЙ
      (элс, хайрга) ашигт малтмалынх бол энэ нь нүүрс, алт зэрэг
      үндсэн ашигт малтмалынх. Хоёуланг нь "тусгай зөвшөөрөл" гэж
      нэрлэдэг тул табны нэрэнд ялгааг нь заавал гаргана.
    */
    id: "minerals",
    group: "land",
    label: "Нүүрс, алтны талбай",
    note: "Тусгай зөвшөөрөлтэй талбайн хүрээ",
    full:
      "Нийслэлийн нутаг дэвсгэр дэх ашигт малтмалын тусгай зөвшөөрөлтэй " +
      "талбайн мэдээлэл (Нүүрс, алт гэх мэт)",
    icon: Mountain,
  },
  {
    id: "petitions",
    group: "land",
    label: "Өргөдлийн бүртгэл",
    note: "Шийдвэрлэсэн байдал",
    full: "Өргөдлийн бүртгэл, шийдвэрлэсэн талаар",
    icon: FileText,
  },
  {
    id: "damaged",
    group: "land",
    label: "Эвдэрсэн газар",
    note: "Талбайн хүрээ, хэмжээ",
    icon: Shovel,
  },
  {
    id: "reclamation",
    group: "land",
    label: "Нөхөн сэргээлт",
    note: "Аж ахуйн нэгж, төсвийн санхүүжилт",
    icon: Sprout,
  },
  {
    /*
      ШИНЭ СЭДЭВ (хэрэглэгч 2026-10-16) — эх сурвалж хараахан ИРЭЭГҮЙ тул
      `.hatch` хоосон төлөв. Тайлбарт тоо, хугацаа ТААМАГЛАЖ бичихгүй.
    */
    id: "mining-plan",
    group: "land",
    label: "Байгаль орчны менежментийн төлөвлөгөө",
    note: "Байгаль орчны мэдээллийн сан",
    icon: ClipboardList,
    /* Гадаад систем — мөр дарахад eic.mn-ийн нэвтрэх хуудас шинэ цонхоор
       нээгдэнэ (хэрэглэгч 2026-10-21); самбарт сонгогдохгүй */
    href: "https://eic.mn/envmng/login.php",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];
type GroupId = (typeof GROUPS)[number]["id"];

/* Гадаад холбоостой мөр сонгогдохгүй — хадгалсан утга нь анхдагч руу буцна */
const IDS = TABS.filter((t) => !("href" in t)).map((t) => t.id);

export function OrchinWorkspace() {
  /* Сонголт хадгалагдана — ажлаа тасалдуулаад буцаж ирэхэд хамгийн
     сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("orchin.tab", IDS, "sanitation", "orchin");

  /* Бүлэг нь сонгосон сэдвээс гарна; нээлттэй сэдэвгүй бүлэг ГАРАХГҮЙ */
  const group: GroupId = TABS.find((t) => t.id === tab)?.group ?? GROUPS[0].id;
  const shown = React.useMemo(() => TABS.filter((t) => t.group === group), [group]);
  const { allowsTab } = useAccess();
  const groups = GROUPS.filter((g) => TABS.some((t) => t.group === g.id && !("href" in t) && allowsTab("orchin", t.id)));
  const pickGroup = React.useCallback(
    (id: GroupId) => {
      const first = TABS.find((t) => t.group === id && !("href" in t) && allowsTab("orchin", t.id));
      if (first) pick(first.id);
    },
    [pick, allowsTab],
  );

  return (
    <div className="department-workspace">
      <SourceTabs
        scope="orchin"
        groupControl={<TabGroups groups={groups} value={group} onChange={pickGroup} />}
        tabs={shown}
        value={tab}
        onChange={pick}
        label="Сэдэв"
      />

      <div className="department-workspace-content">
        <TabAccess scope="orchin" tab={tab}>
          {tab === "sanitation" ? (
            <SanitationDashboard />
          ) : tab === "soil" ? (
            <SoilDashboard />
          ) : tab === "neutralization" ? (
            <NeutralizationDashboard />
          ) : tab === "reclamation" ? (
            <ReclamationDashboard />
          ) : tab === "damaged" ? (
            <DamagedDashboard />
          ) : tab === "petitions" ? (
            <PetitionsDashboard />
          ) : tab === "licenses" ? (
            <LicensesDashboard />
          ) : tab === "minerals" ? (
            <MineralsDashboard />
          ) : (
            /* Эх сурвалж ирээгүй — "хоосон" биш "хүлээгдэж буй" */
            <div className="hatch flex h-full items-center justify-center rounded-xs border border-dashed border-line-2">
              <p className="px-6 text-center text-[12.5px] leading-snug text-ink-3">
                Мэдээлэл хүлээгдэж байна
              </p>
            </div>
          )}
        </TabAccess>
      </div>
    </div>
  );
}
