"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2, PhoneCall, Squirrel } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Хэлтэс хоёр эх сурвалжтай тул самбар хооронд сольж харна.

  Хоёуланг нь зэрэг ачаалахгүй: сонгосон нь л татагдана. Тус бүр нь газрын
  зураг, MapLibre-тэй тул хоёуланг нь эхнээс нь ачаалах нь дэмий жин.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const CallsDashboard = dynamic(
  () => import("@/components/wildlife/dashboard").then((m) => m.WildlifeDashboard),
  { ssr: false, loading: spinner },
);

const RescuesDashboard = dynamic(
  () => import("@/components/wildlife/rescues-dashboard").then((m) => m.RescuesDashboard),
  { ssr: false, loading: spinner },
);

const TABS = [
  {
    id: "calls",
    label: "Зэрлэг амьтны дуудлага",
    note: "Survey123 · шууд холболт",
    icon: PhoneCall,
  },
  {
    id: "rescues",
    label: "Аврагдсан амьтад",
    note: "2019–2026 бүртгэл",
    icon: Squirrel,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function WildlifeWorkspace() {
  /*
    Сонголтыг `localStorage`-д хадгална — хэрэглэгч ажлаа тасалдуулаад
    буцаж ирэхэд хамгийн сүүлд харж байсан самбар нээгдэнэ.

    Залхуу эхлүүлэгчээр уншина: `useEffect` доторх `setState` нэмэлт
    рендер үүсгээд, самбар нэг анивчина.
  */
  const [tab, setTab] = React.useState<TabId>(() => {
    if (typeof window === "undefined") return "calls";
    try {
      return localStorage.getItem("wildlife.tab") === "rescues" ? "rescues" : "calls";
    } catch {
      return "calls";
    }
  });

  function pick(id: TabId) {
    setTab(id);
    try {
      localStorage.setItem("wildlife.tab", id);
    } catch {}
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* Сэлгэх зурвас — хоёр самбарын аль нь идэвхтэйг үргэлж ил байлгана */}
      <div
        role="tablist"
        aria-label="Эх сурвалж"
        className="flex shrink-0 gap-1.5 rounded-xs border border-line bg-paper-2 p-1"
      >
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => pick(t.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-xs border px-2.5 py-1.5 text-left transition-colors",
                on
                  ? "border-data/45 bg-data/10"
                  : "border-transparent hover:bg-paper-hi",
              )}
            >
              <t.icon
                size={14}
                strokeWidth={1.75}
                className={cn("shrink-0", on ? "text-data" : "text-ink-3")}
              />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-[12.5px] leading-none",
                    on ? "font-medium text-ink" : "text-ink-2",
                  )}
                >
                  {t.label}
                </span>
                <span className="mt-1 block truncate text-[10.5px] leading-none text-ink-3">
                  {t.note}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {tab === "calls" ? <CallsDashboard /> : <RescuesDashboard />}
      </div>
    </div>
  );
}
