import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, num, pct } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Stat — үзүүлэлтийн нүд. Тоо нь давамгайлж, тайлбар нь нам дор.
   -------------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  unit,
  delta,
  deltaGood = "up",
  note,
  tone,
  className,
}: {
  label: string;
  value: number | string;
  unit?: string;
  delta?: number;
  deltaGood?: "up" | "down" | "none";
  note?: string;
  tone?: string;
  className?: string;
}) {
  const dir = delta === undefined ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;
  const good =
    deltaGood === "none" || dir === 0
      ? null
      : deltaGood === "up"
        ? dir > 0
        : dir < 0;

  const DeltaIcon = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;

  const deltaColor =
    good === null ? "var(--ink-3)" : good ? "var(--moss)" : "var(--clay)";

  return (
    <div className={cn("relative px-4 py-4", className)}>
      {tone ? (
        <span
          aria-hidden
          className="absolute top-4 bottom-4 left-0 w-[2px]"
          style={{ background: `var(${tone})` }}
        />
      ) : null}
      <div className="eyebrow">{label}</div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="num text-[29px] leading-none font-medium text-ink">
          {typeof value === "number" ? num(value) : value}
        </span>
        {unit ? (
          <span className="text-[12.5px] font-medium text-ink-3">{unit}</span>
        ) : null}
      </div>
      {delta !== undefined || note ? (
        <div className="mt-2.5 flex items-center gap-2">
          {delta !== undefined ? (
            <span
              className="num inline-flex items-center gap-0.5 rounded-xs px-1 py-0.5 text-[11.5px] font-medium"
              style={{
                color: deltaColor,
                background: `color-mix(in oklab, ${deltaColor} 10%, transparent)`,
              }}
            >
              <DeltaIcon size={10} strokeWidth={2.75} />
              {pct(delta)}
            </span>
          ) : null}
          {note ? (
            <span className="truncate text-[11.5px] text-ink-3">{note}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Badge — төлөв
   -------------------------------------------------------------------------- */

const BADGE_TONE = {
  neutral: "var(--ink-3)",
  moss: "var(--moss)",
  clay: "var(--clay)",
  ochre: "var(--ochre)",
  water: "var(--water)",
} as const;

export function Badge({
  children,
  tone = "neutral",
  dot = true,
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONE;
  dot?: boolean;
}) {
  const c = BADGE_TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xs border px-1.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap"
      style={{
        color: c,
        borderColor: `color-mix(in oklab, ${c} 35%, transparent)`,
        background: `color-mix(in oklab, ${c} 8%, transparent)`,
      }}
    >
      {dot ? (
        <span
          className="size-1.5 rounded-full"
          style={{ background: c }}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Meter — хэвтээ хувийн заалт
   -------------------------------------------------------------------------- */

export function Meter({
  value,
  max = 100,
  tone = "var(--moss)",
  className,
}: {
  value: number;
  max?: number;
  tone?: string;
  className?: string;
}) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-xs bg-paper-hi", className)}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className="h-full rounded-xs" style={{ width: `${w}%`, background: tone }} />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Sparkbars — жижиг багана диаграм (SVG, сангүй)
   -------------------------------------------------------------------------- */


/* --------------------------------------------------------------------------
   Sparkline — шугаман хандлага
   -------------------------------------------------------------------------- */


/* --------------------------------------------------------------------------
   KeyValue — жагсаалтын мөр
   -------------------------------------------------------------------------- */
