"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Boxes, FlaskConical, Loader2, Workflow, Wrench } from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";

/*
  Хэлтэс ТАВАН табтай. Зэрэг ачаалахгүй: сонгосон нь л татагдана.
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


const ChemSystemDashboard = dynamic(
  () =>
    import("@/components/hyanalt/chemsystem-dashboard").then(
      (m) => m.ChemSystemDashboard,
    ),
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
    /*
      ХОЁР ДАХЬ химийн эх сурвалж — дээрхтэй НЭГТГЭХГҮЙ. Дээрх нь 2023,
      2024 онд олгосон гэрчилгээний ArcGIS хуулбар (хөлдсөн), энэ нь
      үндэсний системийн амьд бүртгэл. Бүтэц нь ч өөр: тэр нь бодисын
      товьёогоор, энэ нь агуулах ↔ бодисын хоёр талт сүлжээгээр.
    */
    id: "chemsystem",
    label: "Химийн бодисын үндэсний бүртгэл",
    note: "520 агуулах · 22,101 бичилт",
    full: "Химийн бодисын үндэсний бүртгэл (HazTrack)",
    icon: Boxes,
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
/*
  ⚠⚠ "УСТГАЛ, ЛАНДФИЛЛ" ТАБ ХАСАГДСАН (хэрэглэгчийн шийдвэр,
  2026-09-21). Тэр нь ЗАГВАР дата байсан — бүх мөр зохиомол жишээ
  (`ЖИШЭЭ-У01`, `ЖИШЭЭ-Л01`), платформын "зохиомол дата
  хэрэглэхгүй" дүрмийн цорын ганц үл хамаарах зүйл. Түүнийг
  харуулахын өмнө хэрэглэгчээр тэмдэглүүлдэг (`checkable`) байсан ч
  жагсаалтад сууж байсаар байв.

  ⚠ Самбар ба дата УСТГААГҮЙ: `hyanalt/landfill-dashboard.tsx`,
  `lib/landfill.ts` хоёулаа хэвээр. Бодит мэдээлэл ирэхэд энэ
  бүртгэлд табыг буцааж нэмнэ — `DISPOSAL`, `LANDFILL` массивуудыг
  л солино.
*/
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

/*
  Тэмдэглэх шаардлагатай табууд.

  `TABS` нь `as const` тул гишүүн бүрийн төрөл тусдаа нарийсдаг — зөвхөн
  нэг гишүүнд байгаа шинжийг шууд уншиж болохгүй, эхлээд байгаа эсэхийг
  шалгана.
*/
const CHECKABLE = new Set(
  TABS.filter((t) => "checkable" in t && t.checkable).map((t) => t.id),
);

export function HyanaltWorkspace() {
  /* Сонголт хадгалагдана — хэрэглэгч ажлаа тасалдуулаад буцаж ирэхэд
     хамгийн сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("hyanalt.tab", IDS, "repair");

  /*
    Тэмдэглэгдсэн табууд. ХАДГАЛАХГҮЙ: загвар өгөгдөл нь дараагийн
    удаа өөрөө нээгдэх ёсгүй, тухай бүрд зөвшөөрөл шинээр авна.
  */
  const [enabled, setEnabled] = React.useState<ReadonlySet<string>>(new Set());

  const toggle = React.useCallback(
    (id: TabId) => {
      setEnabled((cur) => {
        const next = new Set(cur);
        if (next.delete(id)) {
          /* Тайлахад тухайн таб нээлттэй байсан бол эхний таб руу буцна */
          if (tab === id) pick(TABS[0].id);
        } else {
          next.add(id);
          pick(id);
        }
        return next;
      });
    },
    [tab, pick],
  );

  /* Тэмдэглэгдээгүй таб нь хадгалагдсан сонголт байсан ч нээгдэхгүй */
  const open = CHECKABLE.has(tab) && !enabled.has(tab) ? null : tab;

  return (
    <div className="department-workspace">
      <SourceTabs
        tabs={TABS}
        value={tab}
        onChange={pick}
        label="Сэдэв"
        enabled={enabled}
        onToggle={toggle}
      />

      <div className="department-workspace-content">
        {open === "chemsystem" ? (
          <ChemSystemDashboard />
        ) : open === "repair" ? (
          <RepairMap />
        ) : open === "scheme" ? (
          <InspectionScheme />
        ) : open === "chemicals" ? (
          <ChemicalsDashboard />
        ) : (
          /*
            Тэмдэглэгдээгүй таб. ХООСОН ТӨЛӨВ нь дизайны нэг хэсэг:
            `.hatch` зураастай, тасархай хүрээтэй блок — "хоосон" биш
            "зөвшөөрөл хүлээж буй".
          */
          <div className="hatch flex h-full items-center justify-center rounded-xs border border-dashed border-line-2">
            <p className="px-6 text-center text-[12.5px] leading-snug text-ink-3">
              Сэдвийн хайрцгийг тэмдэглэснээр агуулга нь нээгдэнэ
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
