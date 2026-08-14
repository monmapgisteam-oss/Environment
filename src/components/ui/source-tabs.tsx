"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Сүүлд сонгосон табыг `localStorage`-д хадгална.
 *
 * Энгийн `useState(() => localStorage.getItem(…))` БОЛОХГҮЙ: сайт
 * статикаар экспортлогддог тул серверийн HTML үргэлж анхны табтай
 * байх ба хадгалсан утга нь өөр байвал гидрацийн зөрүү үүснэ. React
 * ийм зөрүүг ЗАСДАГГҮЙ (шинж чанарууд хуучнаараа үлдэнэ) тул таб
 * тэмдэглэгээ буруу байрандаа хөлдөж болзошгүй.
 *
 * `useSyncExternalStore` нь энэ асуудлыг зориулалтын ёсоор шийднэ:
 * гидрацийн үед серверийн зургийг (`null` → анхны таб) хэрэглээд,
 * дараа нь хадгалсан утга руу шилжинэ.
 */
function useStored(key: string): string | null {
  return React.useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

/**
 * Хадгалагддаг таб сонголт.
 *
 * `localStorage.setItem` нь ижил таб дотор `storage` үйл явдал
 * өдөөдөггүй тул сонголтыг нэмэлт төлөвөөр давхарлана.
 */
export function useStoredTab<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T,
): [T, (v: T) => void] {
  const stored = useStored(key);
  const [override, setOverride] = React.useState<T | null>(null);

  const value =
    override ?? (options.includes(stored as T) ? (stored as T) : fallback);

  const pick = React.useCallback(
    (v: T) => {
      setOverride(v);
      try {
        localStorage.setItem(key, v);
      } catch {}
    },
    [key],
  );

  return [value, pick];
}

/*
  Эх сурвалж сонгох зурвас.

  Нэг самбар хоёр ба түүнээс дээш эх сурвалжтай бол давхарлах биш СОЛИХ
  зарчмаар харна. Тиймээс энэ нь энгийн товчны эгнээ биш ТАБ: аль нь
  идэвхтэй байгааг үргэлж ил байлгаж, "нөгөөг нь нэмж асаасан" мэт
  ойлгогдохоос сэргийлнэ.

  Мөр бүр хоёр давхар: нэр + тайлбар (эх сурвалжийн төрөл, бичлэгийн тоо).
  Тайлбар нь ямар мэдээ ард нь байгааг товчилж хэлдэг тул хэрэглэгч
  дарахаасаа өмнө юу солигдохыг мэднэ.
*/

export type SourceTab = {
  id: string;
  label: string;
  note: string;
  icon: LucideIcon;
};

export function SourceTabs<T extends string>({
  tabs,
  value,
  onChange,
  label = "Эх сурвалж",
}: {
  tabs: readonly (SourceTab & { id: T })[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      /*
        Таб олон болоход (зургаа хүртэл) нэг мөрөнд шахагдана. Нэрийг нь
        таслах нь зөв — гэхдээ нарийн дэлгэц дээр танигдахааргүй болтол
        биш. Тиймээс доод хязгаар тавьж, багтахгүй бол ХӨНДЛӨН ГҮЙНЭ:
        мөр даган бөөгнөрөх нь энэ өндөр багатай самбарт зохимжгүй.
      */
      className="flex shrink-0 gap-1.5 overflow-x-auto rounded-xs border border-line bg-paper-2 p-1"
    >
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex min-w-[128px] flex-1 items-center gap-2 rounded-xs border px-2.5 py-1.5 text-left transition-colors",
              on ? "border-data/45 bg-data/10" : "border-transparent hover:bg-paper-hi",
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
  );
}
