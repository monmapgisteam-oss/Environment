"use client";

import dynamic from "next/dynamic";
import {
  Building2,
  Dam,
  Droplet,
  Droplets,
  FileSignature,
  FileText,
  Gauge,
  Layers,
  Loader2,
  Mountain,
  Recycle,
  Scale,
  ShieldCheck,
  Trees,
  Waves,
} from "lucide-react";
import { SourceTabs, useStoredTab } from "@/components/ui/source-tabs";
import { NOGOON_TABS } from "@/lib/nogoon-layers";
import { WaterLaw } from "./water-law";

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
export const TABS = [
  {
    id: "hamgaalagch",
    label: "Байгаль хамгаалагчийн бүс",
    note: "Хариуцах бүсийн хуваарь",
    icon: ShieldCheck,
  },
  {
    /* Гурван бүс ба голын татам НЭГ зурагт (хэрэглэгч 2026-10-23: "goliin
       tatam bolon hamgaalaltiin bus 2 tsesiig negtgeh … map deer zereg
       haragdana"). Хуучин "tatam" табыг хадгалсан хэрэглэгч `useStoredTab`-ийн
       нөөцөөр анхдагч руу буцна. */
    id: "bus",
    label: "Хамгаалалтын бүс, голын татам",
    note: "Тэжээгдэл · хязгаарлалт · хориглолт · татам",
    full: "Тэжээгдлийн муж, хязгаарлалтын болон хориглолтын бүс, голын татам",
    icon: Trees,
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
    id: "noots",
    label: "Боломжит нөөц",
    note: "Усны эх үүсвэр",
    full: "Боломжит нөөцийн бүртгэл",
    icon: Layers,
  },
  /*
    ⚠ Бүртгэл (2021–2023, портал) ба тооллого (2026, Survey123) НЭГ цэс —
    дотор нь оны товчоор сэлгэнэ (хэрэглэгч, 2026-10-22). "survey" гэсэн
    хуучин табыг хадгалсан хэрэглэгч `useStoredTab`-ийн нөөцөөр анхдагч
    руу буцна.
  */
  {
    id: "gadarga",
    label: "Гадаргын усны бүртгэл",
    note: "2021–2023 · 2026",
    full: "Гадаргын усны бүртгэл 2021–2023 ба тооллого 2026",
    icon: Waves,
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
    /* ⚠ Гэрээ, зөвшөөрөл, дүгнэлт НЭГ цэс — дотор нь товчоор сэлгэнэ
       (хэрэглэгч, 2026-10-22). Хуучин "geree", "zuwshuurul", "dugnelt"
       табыг хадгалсан хэрэглэгч `useStoredTab`-ийн нөөцөөр анхдагч руу
       буцна. */
    id: "usashiglalt",
    label: "Ус ашиглалт",
    note: "Гэрээ · зөвшөөрөл · дүгнэлт · хаягдал ус",
    full: "Ус ашиглагчийн гэрээ, ус ашиглуулах зөвшөөрөл, дүгнэлт, хаягдал усны дүгнэлт",
    icon: FileSignature,
  },
  {
    id: "tooluur",
    label: "Тоолуурын мэдээ",
    /* `wtype` домэйн хоёр утгатай */
    note: "Цэвэр ус · хаягдал ус",
    full: "Усны тоолуурын мэдээ",
    icon: Gauge,
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
    label: "Хөв, цөөрөм, далан",
    /* `tuluv` домэйн гурван шаттай: байгуулсан · зураг төсөв
       боловсруулсан · цаашид хийх шаардлагатай */
    note: "Байгуулсан · төсөл · төлөвлөсөн",
    icon: Dam,
  },
  {
    id: "usug",
    label: "Ус сувгийн удирдах газар",
    /* Байгууллагын чиг үүрэг — бүртгэлийн тоо, хугацаа бичихгүй
       (талбар токеноор шалгагдаагүй) */
    note: "Ус хангамж · ариутгах татуурга",
    full: "Ус сувгийн удирдах газрын мэдээ",
    icon: Building2,
  },
  {
    /* Лавлах баримт бичиг — газрын зураггүй (хэрэглэгч 2026-10-30).
       Холбоосууд нь `lib/water-law.ts`-д. */
    id: "huuli",
    label: "Усны тухай хууль тогтоомж",
    note: "Хууль · дүрэм · журам · стандарт · норм",
    full: "Усны тухай хууль тогтоомж, дүрэм, журам, стандарт, норм",
    icon: Scale,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const IDS = TABS.map((t) => t.id);

/** Таб → давхаргын бүрдэл. `TABS`-ийн `id` нь `NOGOON_TABS`-ийн түлхүүр */
const SETS: Record<Exclude<TabId, "huuli">, (typeof NOGOON_TABS)[keyof typeof NOGOON_TABS]> = {
  hamgaalagch: NOGOON_TABS.hamgaalagch,
  bus: NOGOON_TABS.bus,
  bulag: NOGOON_TABS.bulag,
  namag: NOGOON_TABS.namag,
  hudag: NOGOON_TABS.hudag,
  passport: NOGOON_TABS.passport,
  noots: NOGOON_TABS.noots,
  gadarga: NOGOON_TABS.gadarga,
  usashiglalt: NOGOON_TABS.usashiglalt,
  tooluur: NOGOON_TABS.tooluur,
  ergelt: NOGOON_TABS.ergelt,
  tsuurum: NOGOON_TABS.tsuurum,
  usug: NOGOON_TABS.usug,
};

export function NogoonBusWorkspace() {
  /* Сонголт хадгалагдана — ажлаа тасалдуулаад буцаж ирэхэд хамгийн
     сүүлд харж байсан самбар нээгдэнэ */
  const [tab, pick] = useStoredTab<TabId>("nogoon-bus.tab", IDS, "hamgaalagch", "nogoon-bus");

  const set = tab === "huuli" ? null : SETS[tab];

  return (
    <div className="department-workspace">
      <SourceTabs
        scope="nogoon-bus" tabs={TABS} value={tab} onChange={pick} label="Сэдэв" />

      {/*
        ⚠ `key` нь ЗААВАЛ: бүх таб НЭГ бүрэлдэхүүнээр зурагддаг тул
        React нь таб солиход түүнийг ДАХИН ҮҮСГЭДЭГГҮЙ — асаалттай
        давхарга, шүүлтүүр, татагдсан бичлэг өмнөх табынхаараа үлдэнэ.
      */}
      <div className="department-workspace-content">
        {set ? (
          <PortalLayers key={set.key} set={set} access={{ scope: "nogoon-bus", tab }} />
        ) : (
          <WaterLaw />
        )}
      </div>
    </div>
  );
}
