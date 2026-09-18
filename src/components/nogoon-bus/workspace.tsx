"use client";

import dynamic from "next/dynamic";
import {
  BadgeCheck,
  ClipboardList,
  Dam,
  Droplet,
  Droplets,
  FileCheck,
  FileSignature,
  FileText,
  Gauge,
  Loader2,
  Mountain,
  Recycle,
  ShieldCheck,
  Trees,
  Waves,
} from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";
import { NOGOON_TABS } from "@/lib/nogoon-layers";

/*
  Хэлтсийн сэдвүүд. Самбар хооронд сольж харна.

  Сонгосон нь л ачаалагдана: тус бүр MapLibre-тэй тул бүгдийг эхнээс
  нь татах нь дэмий жин.

  ⚠⚠ **ХУУЧИН ГУРВАН ТАБ УСТСАН** (хэрэглэгчийн шийдвэр, 2026-09-16).
  Ус ашиглах гэрээ, голын татам хоёрын ArcGIS Online дээрх эх сурвалж
  БАЙХГҮЙ болсон бөгөөд самбарууд нь түүнийг мэдэлгүй "0" гэж зурж
  байв. Худгийн бүртгэл ажиллаж байсан ч хэлтсийн худгийн дата
  порталд шилжсэн тул таб нь тэр рүү шилжив.

  ⚠ Гурван самбарын код 2026-09-16-нд УСТГАГДСАН (хэрэглэгчийн
  шийдвэр: "ашиглахгүй байгаа зүйлийг устга"). Худгийн самбар нь
  платформын хамгийн боловсронгуй харагдац байсан тул дахин хэрэгтэй
  болбол git түүхээс сэргээнэ (`git log --all -- src/components/wells/dashboard.tsx`),
  ГЭХДЭЭ шинэ хаяг руу заалгахаасаа өмнө талбарын жагсаалтыг токеноор
  шалгана — нэр нь ижил байх гэсэн таамаг амьтны хэлтэс дээр бүрэн
  буруу гарч байсан.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

/*
  Порталын давхаргын самбар — ойн болон амьтны хэлтэстэй ХУВААЛЦСАН
  ([layers/portal-dashboard.tsx](src/components/layers/portal-dashboard.tsx)).

  Бүтцээ эх сурвалжаас өөрөө уншдаг тул энэ арван таван сэдэвт
  зориулж тусдаа код бичих шаардлагагүй: ялгаа нь зөвхөн `LayerSet`-д.
*/
const PortalLayers = dynamic(
  () =>
    import("@/components/layers/portal-dashboard").then(
      (m) => m.PortalLayersDashboard,
    ),
  { ssr: false, loading: spinner },
);

/*
  Табны нэр ТОВЧ байх ёстой. Албан ёсны бүтэн нэрийг `full`-д үлдээж,
  самбар дээр нь харуулна.

  ⚠⚠ Тайлбар (`note`) дээр бичлэгийн ТОО БИЧЭЭГҮЙ. Эхэндээ шалтгаан
  нь техникийн байв (давхаргууд токен шаарддаг тул тоог нь урьдчилан
  уншиж чадаагүй), 2026-09-17-нд токеноор бүгдийг нь уншсан ч ШИЙДВЭР
  нь ХЭВЭЭР: эдгээр бүртгэл нэмэгдсээр байгаа тул энд бичсэн тоо
  маргааш хуучирна. Давхарга нээгдэхэд бодит тоо өөрөө гарна.

  Оронд нь тайлбар нь эх сурвалжийн ӨӨРИЙН домэйны утгыг нэрлэнэ
  ("Бичгээр · цахим", "Цэвэр ус · хаягдал ус") — тэдгээр нь
  бүртгэлийн БҮТЭЦ тул тогтвортой.
*/
const TABS = [
  {
    id: "hamgaalagch",
    label: "Байгаль хамгаалагчийн бүс",
    note: "Хариуцах бүсийн хуваарь",
    icon: ShieldCheck,
  },
  {
    /* Гурван давхарга НЭГ зурагт: тэжээгдэл → хязгаарлалт → хориглолт
       нь нэг системийн шатууд тул тусад нь харвал давхцал нь алдагдана */
    id: "bus",
    label: "Хамгаалалтын бүс",
    note: "Тэжээгдэл · хязгаарлалт · хориглолт",
    full: "Тэжээгдлийн муж, хязгаарлалтын болон хориглолтын бүс",
    icon: Trees,
  },
  {
    id: "tatam",
    label: "Голын татам",
    note: "Татмын хүрээ",
    icon: Waves,
  },
  {
    id: "bulag",
    label: "Булгийн хамгаалалтын бүс",
    note: "Хоёр хувилбар · 2026",
    icon: Droplet,
  },
  {
    id: "namag",
    label: "Намгархаг газар",
    note: "Үерийн эрсдэлтэй талбай",
    full: "Намгархаг, үер эрсдэлтэй газар",
    icon: Mountain,
  },
  {
    id: "hudag",
    label: "Нийслэлийн худаг",
    note: "Худгийн байршил",
    icon: Droplets,
  },
  {
    id: "passport",
    label: "Гүний худгийн паспорт",
    note: "2015–2026",
    full: "Гүний худгийн паспортын бүртгэл 2015–2026",
    icon: FileText,
  },
  {
    id: "gadarga",
    label: "Гадаргын усны бүртгэл",
    note: "2021–2023",
    icon: Waves,
  },
  /*
    ⚠ ПОРТАЛД БИШ, ArcGIS Online дээрх Survey123 маягт — дээрх
    "Гадаргын усны бүртгэл 2021–2023"-тай ӨӨР зүйл: тэр нь хаагдсан
    бүртгэл, энэ нь 2026 оны АМЬД маягт.

    ⚠ Тайлбарт бичлэгийн тоо БИЧЭЭГҮЙ: маягт бөглөгдсөөр байгаа тул
    энд бичсэн тоо маргааш худал болно.
  */
  {
    id: "survey",
    label: "Усны тооллого 2026",
    /* Тайлбар нь маягтын ӨӨРИЙН `type` домэйнээс — булаг, рашаан,
       гол горхи, нуур. Бичлэгийн тоо ОРООГҮЙ: маягт бөглөгдсөөр
       байгаа тул энд бичсэн тоо маргааш хуучирна */
    note: "Булаг · рашаан · гол · нуур",
    full: "Гадаргын усны тооллого 2026",
    icon: ClipboardList,
  },

  /*
    ⚠⚠ УС АШИГЛАЛТЫН ЗУРГААН СЭДЭВ (хэлтэс 2026-09-17-нд нэмүүлэв).

    Дээрх есөн сэдэв нь БАЙРШЛЫН бүртгэл (бүс, худаг, эх үүсвэр) бол
    эдгээр нь ЗӨВШӨӨРЛИЙН бүртгэл: хэн, хэдэн м³ ус, ямар гэрээгээр
    ашиглаж байгаа вэ.

    ⚠ Тайлбарт БИЧЛЭГИЙН ТОО ч, ОНЫ МУЖ ч БИЧЭЭГҮЙ. Эдгээр бүртгэл
    нэмэгдсээр байгаа (гэрээ 2026 оныхоор бөглөгдөж байна) тул энд
    бичсэн тоо, он маргааш хуучирна. Оронд нь эх сурвалжийн ӨӨРИЙН
    домэйны утгаар нэрлэв — тэдгээр нь бүртгэлийн бүтэц тул
    тогтвортой.
  */
  {
    id: "geree",
    label: "Ус ашиглагчийн гэрээ",
    /* Эх сурвалжийн `wsource` нь БҮГД "Газрын доорх ус" — 218 мөрд
       ганц утгатай тул тайлбарт найдвартай гарна */
    note: "Газрын доорх ус · төлбөр, ашигласан хэмжээ",
    full: "Ус ашиглагч иргэн, аж ахуйн нэгжийн гэрээ",
    icon: FileSignature,
  },
  {
    id: "zuwshuurul",
    label: "Ус ашиглуулах зөвшөөрөл",
    note: "Зөвшөөрсөн усны хэмжээ, м³",
    icon: BadgeCheck,
  },
  {
    id: "dugnelt",
    /* Тайлбар нь `concl_form` домэйнээс — бичгээр ба цахим хоёр
       хэлбэрээр гардаг нь энэ бүртгэлийн гол ялгаа */
    label: "Ус ашиглуулах дүгнэлт",
    note: "Бичгээр · цахим (E-систем)",
    icon: FileCheck,
  },
  {
    id: "ergelt",
    label: "Эргэлтийн усан сан",
    /* `turul` домэйн: эргүүлэн ашиглалт ба цэвэрлэх байгууламж */
    note: "Эргүүлэн ашиглалт · цэвэрлэх байгууламж",
    full: "Эргэлтийн усан сантай аж ахуйн нэгж, байгууллага",
    icon: Recycle,
  },
  {
    id: "tsuurum",
    label: "Хув, цөөрөм, далан",
    /* `tuluv` домэйн гурван шаттай: байгуулсан · зураг төсөв
       боловсруулсан · цаашид хийх шаардлагатай */
    note: "Байгуулсан · төсөл · төлөвлөсөн",
    icon: Dam,
  },
  {
    id: "tooluur",
    label: "Тоолуурын мэдээ",
    /* `wtype` домэйн хоёр утгатай */
    note: "Цэвэр ус · хаягдал ус",
    full: "Усны тоолуурын мэдээ",
    icon: Gauge,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

/** Таб → давхаргын бүрдэл. `TABS`-ийн `id` нь `NOGOON_TABS`-ийн түлхүүр */
const SETS: Record<TabId, (typeof NOGOON_TABS)[keyof typeof NOGOON_TABS]> = {
  hamgaalagch: NOGOON_TABS.hamgaalagch,
  bus: NOGOON_TABS.bus,
  tatam: NOGOON_TABS.tatam,
  bulag: NOGOON_TABS.bulag,
  namag: NOGOON_TABS.namag,
  hudag: NOGOON_TABS.hudag,
  passport: NOGOON_TABS.passport,
  gadarga: NOGOON_TABS.gadarga,
  survey: NOGOON_TABS.survey,
  geree: NOGOON_TABS.geree,
  zuwshuurul: NOGOON_TABS.zuwshuurul,
  dugnelt: NOGOON_TABS.dugnelt,
  ergelt: NOGOON_TABS.ergelt,
  tsuurum: NOGOON_TABS.tsuurum,
  tooluur: NOGOON_TABS.tooluur,
};

export function NogoonBusWorkspace() {
  /* Сонголт хадгалагдана — ажлаа тасалдуулаад буцаж ирэхэд хамгийн
     сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("nogoon-bus.tab", IDS, "hamgaalagch");

  const set = SETS[tab];

  return (
    <div className="department-workspace">
      <SourceTabs tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      {/*
        ⚠ `key` нь ЗААВАЛ: бүх таб НЭГ бүрэлдэхүүнээр зурагддаг тул
        React нь таб солиход түүнийг ДАХИН ҮҮСГЭДЭГГҮЙ — асаалттай
        давхарга, шүүлтүүр, татагдсан бичлэг өмнөх табынхаараа үлдэнэ.
      */}
      <div className="department-workspace-content">
        <PortalLayers key={set.key} set={set} />
      </div>
    </div>
  );
}
