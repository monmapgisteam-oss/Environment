"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Boxes, CalendarCheck, ClipboardCheck, Factory, FlaskConical, Loader2, ShieldCheck, Trash2, Workflow, Wrench } from "lucide-react";
import { SourceTabs, TabGroups, useStoredTab } from "@/components/ui/source-tabs";
import { TabAccess } from "@/components/auth/tab-access";
import { useAccess } from "@/components/auth/access";
import { useAuth } from "@/components/auth/provider";
import { homeScopes } from "@/lib/access";

/*
  Хэлтэс ТАВАН табтай. Зэрэг ачаалахгүй: сонгосон нь л татагдана.
  Эхний хоёр нь MapLibre-тэй бөгөөд химийн бүртгэл нь бодисын урт
  бичвэртэй тул эхнээс нь бүгдийг татах нь илүүц.

  Хог хаягдлын таб нь ХУВААЛЦСАН порталын самбараар зурагдана — өөрийн
  код байхгүй, ялгаа нь `LayerSet` бүртгэлд.

  Схемийн таб нь дата БИШ ЖУРАМ — хэлтсийн ажлын урсгал. Тоон
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

/* Хяналт шалгалтын төлөвлөгөөт мэдээлэл — агуулахын самбартай нэг бүтэц (2026-11-19) */
const PlannedDashboard = dynamic(
  () => import("@/components/hyanalt/planned-dashboard").then((m) => m.PlannedDashboard),
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

/*
  Хог хаягдлын хоёр давхарга — ӨӨРИЙН самбар (2026-10-05).

  ⚠ Урьд нь ХУВААЛЦСАН порталын самбараар зурагдаж, хоёр давхарга
  радио товчоор сэлгэгддэг байв. Хэрэглэгч хоёуланг НИЙЛҮҮЛЖ, диаграмыг
  хасуулсан тул ерөнхий самбарын тохиргоогоор шийдэх боломжгүй болов —
  дэлгэрэнгүйг {@link src/components/hyanalt/waste-dashboard.tsx}-ээс.
  Давхаргын бүртгэл (`WASTE`) нь хэвээр: татац, талбарын албан нэр,
  эх сурвалжийн хуудас түүнээс уншина.
*/
/* Survey123-ийн хоёр төрлийн бүртгэл — бүлэглэсэн дэлгэрэнгүйтэй самбар. */
const InspectionDashboard = dynamic(
  () => import("@/components/hyanalt/inspection-dashboard").then((m) => m.InspectionDashboard),
  { ssr: false, loading: spinner },
);

const WasteDashboard = dynamic(
  () => import("@/components/hyanalt/waste-dashboard").then((m) => m.WasteDashboard),
  { ssr: false, loading: spinner },
);

/*
  Өгөгдлийн багцын БҮЛЭГ — бусад хэлтэстэй нэг загвар (`TabGroups`, хэрэглэгч
  2026-11-16: "busad heltes shig bulegle"; бүлэглэлт миний сонголт):
  · ХИМИЙН БОДИС — агуулахын гэрчилгээ ба үндэсний бүртгэл;
  · ХЯНАЛТ ШАЛГАЛТ — зөрчлийн бүртгэл ба журам (схем);
  · БОХИРДЛЫН ЭХ ҮҮСВЭР — авто засвар (тос, хаягдал), ландфилл.
  Гурав дахь нь доороо бүтэн өргөнөөр (`.dataset-groups`). Бүлэг нь сонгосон
  сэдвээс гарна; товшиход эхний нээлттэй сэдэв нээгдэнэ.
*/
export const GROUPS = [
  { id: "chemical", label: "Химийн бодис", note: "3 сэдэв", icon: FlaskConical },
  { id: "inspection", label: "Хяналт шалгалт", note: "Хяналт шалгалт, журам", icon: ShieldCheck },
  { id: "pollution", label: "Бохирдлын эх үүсвэр", note: "Авто засвар · ландфилл", icon: Factory },
] as const;

type GroupId = (typeof GROUPS)[number]["id"];

export const TABS = [
  {
    /*
      Хоёр жилийн бүртгэл НЭГ табанд: гэрчилгээний дугаар давхцахгүй ч
      бүтэц, талбар нь ижил бөгөөд ижил төрлийн үйл ажиллагааг хамардаг.
      Жилийг самбар дотроос сонгоно — тусад нь таб болговол хоёр өөр
      сэдэв мэт харагдана.
    */
    id: "chemicals",
    group: "chemical",
    label: "Химийн бодисын агуулах",
    note: "2023 онд 184 · 2024 онд 20 агуулах",
    icon: FlaskConical,
  },
  {
    /*
      ХЯНАЛТ ШАЛГАЛТЫН ТӨЛӨВЛӨГӨӨТ МЭДЭЭЛЭЛ (хэрэглэгч 2026-11-19: "himiin bodisiin
      aguulah button deer shineer tuluwluguut medeelel gj shineer uusgeed") —
      `Hosted/Төлөвлөгөөт_мэдээлэл` (`Tuluvlugut_XX_parcel`), нэгж талбараар.
      Самбар нь агуулахынхтай нэг бүтэцтэй (`planned-dashboard.tsx`).
      Тайлбарт ТОО БИЧЭЭГҮЙ — бүртгэл нэмэгдсээр байна.
    */
    id: "planned",
    group: "chemical",
    label: "Төлөвлөгөөт мэдээлэл",
    note: "Хяналт шалгалт хийх объект · эрсдэл",
    icon: CalendarCheck,
  },
  {
    /*
      ХОЁР ДАХЬ химийн эх сурвалж — дээрхтэй НЭГТГЭХГҮЙ. Дээрх нь 2023,
      2024 онд олгосон гэрчилгээний ArcGIS хуулбар (хөлдсөн), энэ нь
      үндэсний системийн амьд бүртгэл. Бүтэц нь ч өөр: тэр нь бодисын
      товьёогоор, энэ нь агуулах ↔ бодисын хоёр талт сүлжээгээр.
    */
    id: "chemsystem",
    group: "chemical",
    label: "Химийн бодисын үндэсний бүртгэл",
    note: "520 агуулах · 22,101 бичилт",
    full: "Химийн бодисын үндэсний бүртгэл (HazTrack)",
    icon: Boxes,
  },
  {
    id: "repair",
    group: "pollution",
    label: "Авто засварын үйлчилгээ",
    note: "528 цэг · зөвхөн газрын зураг",
    icon: Wrench,
  },
  {
    /*
      ⚠⚠ НЭР нь ХЭРЭГЛЭГЧИЙН СОНГОЛТ (2026-09-28: "ner ni landfill").
      Агуулга нь хотын хогийн цэг БА аюултай хог хаягдлын зөвшөөрөл
      хоёр тул "ландфилл" нь хагасыг нь л нэрлэнэ — тайлбар мөр нь
      хоёуланг ил хэлнэ.

      ⚠ Тайлбарт БИЧЛЭГИЙН ТОО БИЧЭЭГҮЙ: эдгээр нь нэмэгдсээр байгаа
      бүртгэл тул энд бичсэн тоо маргааш хуучирна. Оронд нь эх
      сурвалжийн ӨӨРИЙН хоёр нэрийг тавив — тэдгээр нь бүртгэлийн
      БҮТЭЦ тул тогтвортой.

      ⚠⚠ Энэ нь хуучин "Устгал, ландфилл" табын ОРЛОГЧ БИШ: тэр нь
      зохиомол жишээ дата (`lib/landfill.ts`) дээр сууж байсан бөгөөд
      2026-09-21-нд хасагдсан. Энэ бол порталын бодит хоёр давхарга.
    */
    id: "landfill",
    group: "pollution",
    label: "Ландфилл",
    note: "Энгийн · аюултай хог хаягдал",
    icon: Trash2,
  },
  {
    /* Survey123 маягтын бүртгэл (хэрэглэгч 2026-11-13) — схемийн ӨМНӨ:
       схем нь журам, энэ нь түүний дагуу хийгдсэн ажлын бүртгэл */
    id: "inspections",
    group: "inspection",
    label: "Хяналт шалгалт", /* хэрэглэгч 2026-11-16 — урьд "Хяналт шалгалт, зөрчлийн бүртгэл" */
    note: "Хяналт, шалгалт · зөрчил",
    icon: ClipboardCheck,
  },
  {
    id: "scheme",
    group: "inspection",
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

  ⚠ Самбар ба дата 2026-11-18-нд КОДТОЙ НЬ УСТСАН (хэрэглэгч: "Энэ хуучин
  самбарын кодыг бүрмөсөн устг") — `hyanalt/landfill-dashboard.tsx`,
  `lib/landfill.ts` git түүхэнд бий.
*/
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

/* Түр хугацаанд зөвхөн портал админ ба хяналтын хэлтсийн бүртгэлд харагдах табууд */
const ADMIN_ONLY: ReadonlySet<TabId> = new Set<TabId>(["inspections"]);

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
  const [stored, pick] = useStoredTab<TabId>("hyanalt.tab", IDS, "repair", "hyanalt");

  /*
    ⚠ ТҮР ХУГАЦААНД "Хяналт шалгалт" ЗӨВХӨН ПОРТАЛЫН АДМИНД
    (хэрэглэгч 2026-11-13: "tur hugatsaand zuwhun portal admin erhtei hund
    haragdana"). Бусдад таб жагсаалтад гарахгүй; хадгалсан сонголт нь тэр
    таб байсан бол анхдагч руу ДАМ буцна. Нээх бол энэ шүүлтийг л авна.
    ⚠ Хяналтын хэлтсийн ӨӨРИЙН бүртгэл (`ACCOUNTS`-ийн өөрийн хэлтэс нь hyanalt —
    одоо `nbog_hh`) мөн харна (хэрэглэгч 2026-11-16: "Хяналтын хэлтэс acc hardag
    bolgo"). Эрхийн хүснэгтээр хяналтын хэлтэс нээгдсэн бусад бүртгэл ХАРАХГҮЙ.
  */
  const { admin: portalAdmin, allowsTab } = useAccess();
  const { session } = useAuth();
  const admin = portalAdmin || homeScopes(session?.username).includes("hyanalt");
  const tabs = React.useMemo(
    () => (admin ? TABS : TABS.filter((t) => !ADMIN_ONLY.has(t.id))),
    [admin],
  );
  const tab: TabId = !admin && ADMIN_ONLY.has(stored) ? "repair" : stored;

  /* Бүлэг нь сонгосон сэдвээс; нээлттэй сэдэвгүй бүлэг ГАРАХГҮЙ */
  const visible = React.useCallback(
    (id: TabId) => (admin || !ADMIN_ONLY.has(id)) && allowsTab("hyanalt", id),
    [admin, allowsTab],
  );
  const group: GroupId = TABS.find((t) => t.id === tab)?.group ?? GROUPS[0].id;
  const shown = React.useMemo(() => tabs.filter((t) => t.group === group), [tabs, group]);
  const groups = GROUPS.filter((g) => TABS.some((t) => t.group === g.id && visible(t.id)));
  const pickGroup = React.useCallback(
    (id: GroupId) => {
      const first = TABS.find((t) => t.group === id && visible(t.id));
      if (first) pick(first.id);
    },
    [pick, visible],
  );

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
        scope="hyanalt"
        groupControl={<TabGroups groups={groups} value={group} onChange={pickGroup} />}
        tabs={shown}
        value={tab}
        onChange={pick}
        label="Сэдэв"
        enabled={enabled}
        onToggle={toggle}
      />

      <div className="department-workspace-content">
        <TabAccess scope="hyanalt" tab={open ?? ""}>
          {open === "chemsystem" ? (
            <ChemSystemDashboard />
          ) : open === "landfill" ? (
            <WasteDashboard />
          ) : open === "repair" ? (
            <RepairMap />
          ) : open === "inspections" && admin ? (
            <InspectionDashboard />
          ) : open === "scheme" ? (
            <InspectionScheme />
          ) : open === "chemicals" ? (
            <ChemicalsDashboard />
          ) : open === "planned" ? (
            <PlannedDashboard />
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
        </TabAccess>
      </div>
    </div>
  );
}
