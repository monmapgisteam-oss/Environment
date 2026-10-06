"use client";

import dynamic from "next/dynamic";
import {
  Coins,
  Fence,
  LayoutGrid,
  Leaf,
  Loader2,
  ShieldCheck,
  Sprout,
  Trees,
} from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";
import { FOREST_TABS } from "@/lib/forest-layers";

/*
  Ойн хэлтэс — давхарга бүр ӨӨРИЙН цэс (хэрэглэгч 2026-10-06, ногоон
  бүсийн "Өгөгдлийн багц"-ыг заан: "ингэж шүү").

  Урьд нь долоон давхарга НЭГ зурагт асаалт/унтраалттай байсан бөгөөд
  зүүн талын жагсаалтаас сонгодог байв. Одоо ногоон бүсийн хэлтэстэй
  ижил: цэс сонгоход тэр давхарга шууд асна, жагсаалт байхгүй тул
  газрын зураг өргөснө.

  Сонгосон нь л ачаалагдана: тус бүр MapLibre-тэй тул бүгдийг эхнээс
  нь татах нь дэмий жин.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const LayersDashboard = dynamic(
  () =>
    import("@/components/layers/portal-dashboard").then(
      (m) => m.PortalLayersDashboard,
    ),
  { ssr: false, loading: spinner },
);

/*
  ⚠ Тайлбарт (`note`) бүртгэлийн ТОО БИЧИХГҮЙ (ногоон бүсийн шийдвэр):
  давхарга нээгдэхэд бодит тоо өөрөө гарна. Тайлбар нь датанаас
  УНШСАН утгуудыг нэрлэнэ (2026-10-06-нд токеноор шалгасан) —
  таамаглаж тайлбарлахгүй.
*/
const TABS = [
  {
    id: "O01_THGN_polygon",
    label: "Тусгай хамгаалалттай газар",
    /* `tuvshin` домэйн — гурван утга */
    note: "УИХ · НИТХ · ДИТХ",
    full: "Тусгай хамгаалалттай газар нутаг",
    icon: ShieldCheck,
  },
  {
    id: "O03_tulbur_duureg",
    label: "Ойн төлбөр",
    /* Хоёр хэмжилтийн нэр (м³ нь хэлтсийн шийдвэрээр диаграмд ороогүй) */
    note: "Мод бэлтгэсэн талбай · төлбөрийн орлого",
    full: "Ойн төлбөр, дүүргээр",
    icon: Coins,
  },
  {
    id: "O03_buffer_100m",
    label: "Хамгаалалтын зурвас",
    note: "100 метр",
    full: "100 метрийн хамгаалалтын зурвас",
    icon: Fence,
  },
  {
    id: "O03_oi_yalgaral",
    label: "Ойн ялгарал",
    /* `ylgaral`-ын хамгийн олон гурван утга */
    note: "Ой · тармаг мод · мод бэлтгэсэн талбай",
    icon: Trees,
  },
  {
    id: "O03_oi_heseglel",
    label: "Ойн хэсэглэл",
    /* `name` талбарын хоёр утга */
    note: "Улаанбаатар · Багануур",
    icon: LayoutGrid,
  },
  {
    id: "O03_nogoon_bus_heseg",
    label: "Ногоон бүсийн хэсэг",
    /* `folderpath` — бүх мөрд ижил ганц утга */
    note: "Ногоон бүс ба Богд уул",
    full: "Улаанбаатар хотын ногоон бүс ба Богд уул",
    icon: Sprout,
  },
  {
    id: "O03_dagalt_baylag",
    label: "Ойн дагалт баялаг",
    /* `zuiluud` жагсаалтаас — эх сурвалжийн зүйлийн нэрс */
    note: "Нэрс · хушны самар · чага",
    icon: Leaf,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

export function OiWorkspace() {
  /* Сонголт хадгалагдана — буцаж ирэхэд сүүлд харсан давхарга нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("oi.tab", IDS, "O01_THGN_polygon");

  const set = FOREST_TABS[tab];

  return (
    <div className="department-workspace">
      {/*
        ⚠ ТОЛГОЙ БАЙХГҮЙ (хэрэглэгчийн шийдвэр, 2026-09-17): платформын
        толгой ба хажуугийн зурвас хэлтсийн нэрийг аль хэдийн харуулдаг.
      */}
      <SourceTabs tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      {/*
        ⚠ `key` ЗААВАЛ: бүх таб НЭГ бүрэлдэхүүнээр зурагддаг тул React
        нь таб солиход түүнийг ДАХИН ҮҮСГЭДЭГГҮЙ — шүүлт, сонголт
        өмнөх табынхаараа үлдэнэ.
      */}
      <div className="department-workspace-content">
        <LayersDashboard key={set.key} set={set} />
      </div>
    </div>
  );
}
