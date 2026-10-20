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
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";

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
  ХОЁР БҮЛЭГ (хэрэглэгч 2026-10-16: "ene hesgiig 2 group bolgomoor bn"),
  жагсаалт ДОТОР задардаг мөр (`SourceTabs sections`) — дээд талын товч
  (`TabGroups`) БИШ, хэрэглэгч түүнийг буцаав:
  · ХӨРС, АРИУН ЦЭВЭР — бохирдлын хэмжилт ба түүний эх үүсвэр (жорлон,
    хөрсний мониторинг, саармагжуулалт);
  · ГАЗАР, АШИГТ МАЛТМАЛ — газрын эвдрэл, нөхөн сэргээлт, өргөдөл,
    тусгай зөвшөөрөл.
  Бүлгийн мөр дарахад сэдвүүд нь доор нь задарна/хумигдана.
*/
export const GROUPS = [
  { id: "pollution", label: "Хөрс", note: "3 сэдэв", icon: FlaskConical },
  { id: "land", label: "Түгээмэл тархацтай ашигт малтмал", note: "6 сэдэв", icon: Pickaxe },
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
    label: "Уулын ажлын төлөвлөгөө, тайлан",
    note: "Эх сурвалж хүлээгдэж байна",
    icon: ClipboardList,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function OrchinWorkspace() {
  /* Сонголт хадгалагдана — ажлаа тасалдуулаад буцаж ирэхэд хамгийн
     сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("orchin.tab", IDS, "sanitation", "orchin");

  return (
    <div className="department-workspace">
      <SourceTabs
        scope="orchin"
        sections={GROUPS}
        tabs={TABS}
        value={tab}
        onChange={pick}
        label="Сэдэв"
      />

      <div className="department-workspace-content">
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
      </div>
    </div>
  );
}
