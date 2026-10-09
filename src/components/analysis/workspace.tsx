"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Box, Droplets, Loader2, Waves } from "lucide-react";
import { useStoredTab } from "@/components/ui/source-tabs";
import { cn } from "@/lib/utils";

const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const FloodView = dynamic(
  () => import("@/components/analysis/flood-view").then((m) => m.FloodView),
  { ssr: false, loading: spinner },
);

const SoilScene = dynamic(
  () => import("@/components/analysis/soil-scene").then((m) => m.SoilScene),
  { ssr: false, loading: spinner },
);

const FloodSoilView = dynamic(
  () => import("@/components/analysis/flood-soil").then((m) => m.FloodSoilView),
  { ssr: false, loading: spinner },
);

/*
  ⚠⚠ "ХОТЫН ТАРХАЛТ" ЦЭС КОДТОЙГОО УСТГАГДСАН (хэрэглэгчийн шийдвэр,
  2026-10-09: "ene dotorh medeelliig del mun codes bas tsewerle").
  Тэр нь 145,462 нүхэн жорлонгийн азотын урсац/нэвчилтийг ~400 м-ийн
  зургаан өнцөгт торонд нэгтгэсэн харагдац байв: `latrine-dashboard.tsx`,
  `lib/latrine-analysis.ts`, `scripts/build-latrine-analysis.mjs`,
  `public/data/latrine-analysis.json` устсан (git түүхэнд бий).
  `analysis/ui` (Card, Field, Stat) ХЭВЭЭР — хөрсний зүсэлт, симуляци
  хэрэглэнэ. Хадгалсан "analysis.view = city" нь анхдагч руу буцна.

  "Хөрсний зүсэлт" нь ХӨРС ӨӨРИЙГ нь: хотын хөрсний зураглалын нэгж
  бүрийн жишиг профайлыг рельеф дээр блок болгож босгоод, дурын
  азимутаар зүсэж үе давхаргуудыг дотроос нь харуулна. Нэвчилт хаана
  хэр хурдан болохыг тайлбарлах зүйл нь ЯГ тэр бүтэц: шохойн хуримтлал,
  глей, мөнх цэвдэг, суурь чулуулгийн гүн.

  ⚠⚠ "НЭВЧИЛТИЙН СИМУЛЯЦИ" ТУСДАА ЦЭС БИШ БОЛСОН (хэрэглэгч 2026-10-01:
  "newchiltiin simulationg … niiluuley"). Нэг жорлонгийн нүхний 3D нь
  "Хөрсний зүсэлт"-ийн дотор: блок дээр жорлон товшиход зураг
  симуляцаар солигдож, буцахад хөрсний зүсэлт байрандаа
  ({@link src/components/analysis/latrine-sim.tsx}). Хуучин
  "analysis.view = sim" хадгалсан хэрэглэгч анхдагч руу буцна.

  ⚠⚠ "НЭВЧИЛТИЙН ЗҮСЭЛТ" ЦЭС КОДТОЙГОО УСТГАГДСАН (хэрэглэгчийн
  шийдвэр, 2026-10-01). Чингэлтэйн 2.1 × 2.1 км voxel загварын хавтгай
  зүсмэл байсан; "Хөрсний зүсэлт" (бүх жорлонгийн бохирдол) ба
  "Нэвчилтийн симуляци" (нэг жорлон) тэр асуултыг хариулдаг болсон.
  Багц (`latrine-voxel.bin`), багцлагч (`build-latrine-voxel.py`),
  порталын voxel зам (`voxel-scene`) хамт устсан — git-д ороогүй
  байсан тул түүхэнд ч БАЙХГҮЙ.

  ⚠⚠ "ҮЕРИЙН ЗАГВАРЧЛАЛ" ЦЭС ХАСАГДСАН (хэрэглэгчийн шийдвэр,
  2026-09-29: "болъё"). 30 метрийн тор дээр хотын үерийг зурах
  боломжгүй нь хэмжилтээр тогтоогдсон: гэр хорооллын гудамж 10–20
  метр өргөн тул илүүдэл ус цуглах суваггүй үлдэж, нүд бүр дээрээ
  тусдаа толбо болдог. ArcGIS Pro-гийн Flood Simulation нүдээ 3.5
  метрээр хязгаарладаг нь мөн үүнийг хэлнэ.
  ⚠ Код, багц нь 2026-10-01-нд УСТГАГДСАН (хэрэглэгч: "uyertei holbootoi
  medeelelee del hii uur hun hiij bgaa uur branch deer") — үерийг өөр хүн
  тусдаа салаа дээр хийж байна. git-д ороогүй байсан тул түүхэнд ч алга.
  ✅ 2026-10-08-нд тэр хүний апп ("Flood_envi", 2D гүехэн усны GPU загвар,
  10–30 м тор) "Үерийн симуляци" товчоор буцаж орсон — 2026-10-09-нөөс
  iframe биш, платформын код (`lib/flood/`,
  {@link src/components/analysis/flood-view.tsx}).

  ⚠ Сонгоогүй харагдац УНТАРНА (`dynamic` + нөхцөлт зурагдалт):
  нуусан контейнерт MapLibre хэмжээгээ алддаг бөгөөд хоёр дахь
  харагдацын 1.6 МБ багц дэмий татагдана.
*/
const VIEWS = [
  /* ⚠ Үер эхэнд — "Хотын тархалт" устсан тул анхдагч харагдац (2026-10-09).
     Апп нь `lib/flood/` ба {@link src/components/analysis/flood-view.tsx}. */
  {
    id: "flood",
    label: "Үерийн симуляци",
    note: "Бороо · гадаргын урсац",
    icon: Waves,
  },
  {
    id: "soil",
    label: "Хөрсний зүсэлт",
    note: "Үе давхарга · дурын азимут",
    icon: Box,
  },
  /* ⚠ Гурав дахь харагдац (хэрэглэгч 2026-10-09): дээрх хоёрыг ХОЛБОНО —
     хөрсний блок дээр үерийн ус, зүсэлтийн нүүрэнд бохирдлын шингээлт
     ({@link src/components/analysis/flood-soil.tsx}, `lib/soil-flood.ts`).
     Эхний хоёр харагдац хөндөгдөөгүй. */
  {
    id: "floodsoil",
    label: "Үер ба нэвчилт",
    note: "Үерийн ус хөрсний блок дээр · шингээлт",
    icon: Droplets,
  },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

const IDS = VIEWS.map((v) => v.id);

export function AnalysisWorkspace() {
  const [view, pick] = useStoredTab<ViewId>("analysis.view", IDS, "flood");

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-2"
      style={{ "--tone": "var(--data)" } as React.CSSProperties}
    >
      {/* ⚠ Зурвас нь ЗОРИУДААР хөнгөн: нэг мөр, зүүн тийш цуглуулсан.
          Бүтэн өргөнтэй бол доорх шүүлтүүрийн мөртэй ижил жинтэй
          харагдаж, аль нь эцэг түвшин болох нь алдагдана */}
      <div
        role="group"
        aria-label="Судалгааны харагдац"
        className="flex shrink-0 flex-wrap gap-1 self-start"
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => pick(v.id)}
            className={cn(
              "flex items-center gap-2 rounded-xs border px-2.5 py-1.5 text-left transition-colors",
              view === v.id
                ? "border-(--tone) bg-(--tone)/10"
                : "border-line bg-paper-2 hover:bg-paper-hi",
            )}
          >
            <v.icon
              size={15}
              strokeWidth={1.6}
              className={view === v.id ? "text-(--tone)" : "text-ink-3"}
            />
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-[12px] font-medium",
                  view === v.id ? "text-ink" : "text-ink-2",
                )}
              >
                {v.label}
              </span>
              <span className="block text-[10.5px] text-ink-3">{v.note}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {view === "flood" ? <FloodView /> : null}
        {view === "soil" ? <SoilScene /> : null}
        {view === "floodsoil" ? <FloodSoilView /> : null}
      </div>
    </div>
  );
}
