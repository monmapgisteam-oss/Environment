"use client";

import * as React from "react";
import { Layers } from "lucide-react";
import {
  BASEMAPS,
  basemapThumb,
  type Basemap,
} from "@/components/wells/map";
import { cn } from "@/lib/utils";

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
}: {
  value: Basemap;
  onChange: (b: Basemap) => void;
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
    <div ref={holder} className="absolute top-2.5 right-2.5 z-20">
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
        <Layers size={16} strokeWidth={1.75} />
        {/* Харагдацын үйлдэл асаалттай бол цэгээр сануулна */}
        {extent ? (
          <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-data" />
        ) : null}
      </button>

      {open ? (
        <div className="elevated absolute top-[calc(100%+5px)] right-0 w-[236px] rounded-xs border border-line-2 bg-paper-2 p-2">
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
