"use client";

import * as React from "react";
import {
  BASEMAPS,
  basemapThumb,
  type Basemap,
} from "@/components/wells/map";
import { cn } from "@/lib/utils";

/**
 * Суурь зургийн икон — ArcGIS-ийн өөрийнх нь тэмдэг (Calcite UI Icons,
 * `basemap-16`, Apache-2.0). Дөрвөн хавтангийн сүлжээ нь ArcGIS Online-ы
 * "Basemap" товчтой ижил тул хэрэглэгч танихад амар.
 *
 * Хэлбэр нь ДҮҮРГЭСЭН (lucide-ийн зураастай иконуудаас ялгаатай) бөгөөд
 * 16px-д зориулж оновчилсон тул `viewBox` нь 16 — өөр хэмжээгээр бүү зур,
 * шугамууд нь пикселийн сүлжээнээс мултарна.
 */
function BasemapIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M16 3V0H9v7h7zm-1-2v1h-3V1zm-4 0v2h2v1h-3V1zm-1 5V5h4V3h1v3zM7 0H0v7h7zM6 4h-.33A2.674 2.674 0 0 1 3 1.33V1h3zM1 6V5h.561A.44.44 0 0 1 2 5.439V6zm2 0v-.561A1.44 1.44 0 0 0 1.561 4H1V1h1v.33A3.675 3.675 0 0 0 5.67 5H6v1zm13 3H9v7h7zm-6 6v-3h3v1h-1v1h1v1zm5 0h-1v-3h1zm0-4h-5v-1h5zM7 9H0v7h7zm-1 1v3.09a8.93 8.93 0 0 0-.314.057 2.863 2.863 0 0 1-.051-.12 3.112 3.112 0 0 0-.653-1.06c-.873-.872-1.18-1.093-1.977-1.093A3.301 3.301 0 0 0 1 12.024V10zm-5 5v-1.432l.11-.149a3.727 3.727 0 0 1 1.895-1.545c.397 0 .47 0 1.27.8a2.209 2.209 0 0 1 .438.742c.112.265.328.78.807.78a.816.816 0 0 0 .245-.041c.013-.005.079-.021.235-.05V15z" />
    </svg>
  );
}

/**
 * Газрын зургийн буланд суух суурь зургийн сонголт + харагдацын үйлдэл.
 *
 * Хэлтэс бүрийн самбар өөрийн газрын зурагтай тул энэ нь ХУВААЛЦДАГ
 * бүрэлдэхүүн — аль нэг самбарын дотор биш, тусдаа файлд байна.
 *
 * `unit` нь шүүлтүүрийн тайлбарт орох нэгжийн нэр ("худаг", "дуудлага"):
 * "Зургийн хүрээнд багтсан <unit>-аар бусад самбар шинэчлэгдэнэ".
 */
export function BasemapGallery({
  value,
  onChange,
  extent = false,
  onExtentChange,
  unit,
  placement = "top-right",
}: {
  value: Basemap;
  onChange: (b: Basemap) => void;
  /**
   * Зургийн аль буланд суух вэ. Анхдагч нь баруун дээд.
   *
   * Самбар бүр өөр өөр буланд өөр зүйл байрлуулдаг (тайлбар, бичилтийн
   * самбар, тэмдэглэгээний хуулбар) тул товчийг зөөх шаардлага гардаг.
   * Унждаг цэс нь товчныхоо талд наалдана — эс тэгвээс зургийн ирмэгээс
   * хальж, тасарна.
   */
  placement?: "top-right" | "top-left";
  /** Харагдацын үйлдэл асаалттай эсэх */
  extent?: boolean;
  /**
   * Харагдацын үйлдлийг ОРУУЛАХГҮЙ бол өгөхгүй — тэмдэглэгээ нь ч
   * гарахгүй. Диаграм нь урьдчилан нэгтгэсэн тоо дээр суудаг самбарт
   * (нүхэн жорлон) хүрээгээр шүүх нь зөвхөн зургийг өөрчилж, доорх
   * тоонууд хөдөлгөөнгүй үлдэх тул худал дохио болно.
   */
  onExtentChange?: (v: boolean) => void;
  unit?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const holder = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  return (
    <div
      ref={holder}
      className={cn(
        "absolute top-2.5 z-20",
        placement === "top-left" ? "left-2.5" : "right-2.5",
      )}
    >
      {/* Зөвхөн икон — газрын зургийг хаах хайрцаг, дэвсгэргүй */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Суурь зураг: ${value.name}`}
        aria-label="Суурь зураг сонгох"
        className={cn(
          "relative flex size-7 items-center justify-center transition-colors",
          open || extent ? "text-data" : "text-ink-2 hover:text-ink",
        )}
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
      >
        <BasemapIcon />
        {/* Харагдацын үйлдэл асаалттай бол цэгээр сануулна */}
        {extent ? (
          <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-data" />
        ) : null}
      </button>

      {open ? (
        <div
          className={cn(
            "elevated absolute top-[calc(100%+5px)] w-[236px] rounded-xs border border-line-2 bg-paper-2 p-2",
            placement === "top-left" ? "left-0" : "right-0",
          )}
        >
          <div className="eyebrow mb-2">Суурь зураг</div>
          <div className="grid grid-cols-2 gap-1.5">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  onChange(b);
                  setOpen(false);
                }}
                className={cn(
                  "overflow-hidden rounded-xs border text-left transition-colors",
                  value.id === b.id ? "border-data" : "border-line hover:border-line-2",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={basemapThumb(b)}
                  alt=""
                  className="block h-[48px] w-full object-cover"
                  loading="lazy"
                />
                <span
                  className={cn(
                    "block truncate border-t border-line px-1.5 py-1 text-[10.5px]",
                    value.id === b.id ? "font-medium text-ink" : "text-ink-2",
                  )}
                >
                  {b.name}
                </span>
              </button>
            ))}
          </div>

          {/*
            Харагдацын үйлдэл — ArcGIS Dashboard-ийн "map extent" зарчим:
            газрын зургийн одоогийн хүрээ бусад элементийн шүүлтүүр болно.
          */}
          {onExtentChange ? (
            <label className="mt-2 flex cursor-pointer items-start gap-2 border-t border-line pt-2">
              <input
                type="checkbox"
                checked={extent}
                onChange={(e) => onExtentChange(e.target.checked)}
                className="mt-[1px] size-3 shrink-0 accent-[var(--data)]"
              />
              <span className="min-w-0">
                <span className="block text-[11.5px] leading-none font-medium text-ink">
                  Харагдацаар шүүх
                </span>
                <span className="mt-1 block text-[10.5px] leading-snug text-ink-3">
                  Зургийн хүрээнд багтсан {unit}-аар бусад самбар шинэчлэгдэнэ
                </span>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
