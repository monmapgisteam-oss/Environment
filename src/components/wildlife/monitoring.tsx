"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import { Loader2, Mountain, PhoneCall, Waves } from "lucide-react";
import { TabGroups, useStoredTab } from "@/components/ui/source-tabs";
import { WILDLIFE_SOLO } from "@/lib/wildlife-layers";

/* --------------------------------------------------------------------------
   МОНИТОРИНГ СУДАЛГААНЫ САН
   --------------------------------------------------------------------------

   ⚠⚠ ЭНЭ НЬ НЭГ САМБАР БИШ, ХЭД ХЭДЭН СУДАЛГААНЫ САН (хэрэглэгчийн
   шийдвэр, 2026-09-17: "Минжний судалгааг бас ийш нь нэмээд").

   Судалгаа бүр ӨӨРИЙН самбартай бөгөөд тэдгээр нь ижил БИШ:

     · Сонгинохайрхан уул — бүтцээ эх сурвалжаас уншдаг ерөнхий
       давхаргын самбар (200 цэг, дөрвөн задаргаа).
     · Минж — гурван давхаргыг нэг зурагт давхарлуулдаг ЗОРИУЛАЛТЫН
       самбар (2 олон өнцөгт + 424 км маршрут + 120 ажиглалт).

   ⚠ Тиймээс энэ сан нь давхаргын жагсаалт БИШ, САМБАРУУДЫН жагсаалт:
   минжний зориулалтын харагдацыг ерөнхий самбараар сольвол маршрут,
   талбайн хүрээ, судалгааны үе хоёулаа алдагдана (тэр самбарыг яг
   энэ шалтгаанаар 2026-09-16-нд тусад нь бичсэн).

   ⚠ СУДАЛГААГ СОНГОСНЫ ДАРАА давхарга нь ШУУД асна (`openAll`):
   сонголт нь энэ мөрөнд аль хэдийн хийгдсэн тул дотор нь дахин
   жагсаалт гаргах нь хоёр дахин товшилт шаардана.
-------------------------------------------------------------------------- */

const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const PortalLayers = dynamic(
  () =>
    import("@/components/layers/portal-dashboard").then(
      (m) => m.PortalLayersDashboard,
    ),
  { ssr: false, loading: spinner },
);

const BeaverDashboard = dynamic(
  () =>
    import("@/components/wildlife/beaver-dashboard").then(
      (m) => m.BeaverDashboard,
    ),
  { ssr: false, loading: spinner },
);

/*
  ⚠ ЖАГСААЛТАД ДАТА ИРЭЭГҮЙ СУДАЛГАА Ч ОРНО (хэрэглэгчийн шийдвэр,
  2026-09-17: "Амьтны дуудлага, мониторинг судалгаа гээд дотор нь
  хоосон цэс нэмээрэй. Дараа нь датаг нь өгөе").

  Хоосон гишүүн нь `source` талбаргүй байна — сонгоход `.hatch`
  тасархай блок гарч "Мэдээлэл хүлээгдэж байна" гэж хэлнэ.

  ⚠ Тайлбарт ЗОХИОМОЛ ТОО БИЧИХГҮЙ: эх сурвалж ирээгүй тул бичлэгийн
  тоо, хамрах хугацаа МЭДЭГДЭХГҮЙ. Таамаглаж бичвэл бодит гэж
  эндүүрэгдэнэ — платформын "зохиомол дата хэрэглэхгүй" дүрэм.
*/
const SURVEYS = [
  {
    id: "songino",
    label: "Сонгинохайрхан уулын судалгаа",
    note: "200 цэг · хээрийн судалгаа",
    icon: Mountain,
  },
  {
    id: "minj",
    label: "Минжний судалгаа",
    note: "424 км маршрут · 120 ажиглалт",
    icon: Waves,
  },
  {
    /*
      ⚠ НЭГ ЦЭС, хоёр биш (хэрэглэгчийн залруулга, 2026-09-17: "2
      тусдаа биш 1 нэр шүү"). Нэр нь хоёр хэсгээс тогтдог ч НЭГ
      бүртгэл: амьтны дуудлага, мониторинг судалгаа хоёр нь нэг эх
      сурвалжид хамт ирнэ.

      ⚠ Урьд нь Survey123 маягтын самбар байсан бөгөөд 2026-09-16-нд
      кодоос устгагдсан (`wildlife/dashboard.tsx`, `lib/wildlife.ts`).
      Шинэ эх сурвалж ирэхэд git түүхээс сэргээж болно — ГЭХДЭЭ
      талбарын жагсаалтыг ТОКЕНООР шалгасны дараа: `A01` дээр "нэр нь
      ижил байх" гэсэн таамаг бүрэн буруу гарч байсан.
    */
    id: "duudlaga",
    label: "Амьтны дуудлага, мониторинг судалгаа",
    note: "Эх сурвалж хүлээгдэж байна",
    icon: PhoneCall,
  },
] as const;

type SurveyId = (typeof SURVEYS)[number]["id"];

const IDS = SURVEYS.map((s) => s.id);

export function MonitoringWorkspace() {
  /* Сонголт хадгалагдана — санд буцаж ирэхэд сүүлд үзсэн судалгаа
     нээгдэнэ. Табын сонголттой ижил зарчим */
  const [survey, pick] = useStoredTab<SurveyId>(
    "wildlife.monitoring",
    IDS,
    "songino",
  );

  return (
    /*
      ⚠ ҮНДЭС нь `h-full`, `flex-1` БИШ (2026-09-22, хэрэглэгч: "дэлгэцэнд нь
      тааруул"). Эцэг `.department-workspace-content` нь grid-ийн нүд,
      flex биш — тэнд `flex-1` ЮУ Ч ХИЙХГҮЙ, өндөр нь агуулгаараа
      хэмжигдэж, доторх самбарын `h-full` таарах зүйлгүй болж минжний
      самбар дэлгэцийн доод талыг хоосон үлдээдэг байв. Бусад бүх самбарын
      үндэс `h-full` — энэ сан тэдний оронд суудаг тул ижил байх ёстой.
    */
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <TabGroups
        groups={SURVEYS}
        value={survey}
        onChange={pick}
        label="Судалгаа"
      />

      {/*
        ⚠ `key` нь ЗААВАЛ: хоёр салаа нь өөр бүрэлдэхүүн ч React нь
        байрлалаараа тааруулдаг тул түлхүүргүй бол өмнөх судалгааны
        төлөв (шүүлтүүр, татагдсан бичлэг) үлдэж болзошгүй.
      */}
      <div className="flex min-h-0 flex-1 flex-col">
        {survey === "minj" ? (
          <BeaverDashboard key="minj" />
        ) : survey === "songino" ? (
          <PortalLayers
            key={WILDLIFE_SOLO.songino.key}
            set={WILDLIFE_SOLO.songino}
          />
        ) : (
          /*
            ЭХ СУРВАЛЖ ИРЭЭГҮЙ. Хоосон төлөв нь дизайны нэг хэсэг:
            `.hatch` зураастай, тасархай хүрээтэй блок — "хоосон" биш
            "хүлээгдэж буй".

            ⚠ Энд ямар ч үзүүлэлт, жишээ тоо ГАРАХГҮЙ: зохиомол дата
            бодит гэж эндүүрэгдэх эрсдэлтэй.
          */
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
