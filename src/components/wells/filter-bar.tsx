"use client";

import * as React from "react";
import { ChevronDown, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   ArcGIS Dashboard маягийн шүүлтүүрийн мөр.
   Хяналт бүр нь товч — товшиход доогуураа хөвөгч самбар нээгдэнэ.
   -------------------------------------------------------------------------- */

export function FilterBar({
  title,
  activeCount,
  onReset,
  children,
}: {
  title: string;
  activeCount: number;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xs border border-line bg-paper-2 px-2 py-1.5">
      {/* Гарчиг зүүн талд, шүүлтүүрүүд баруун тийш шахагдана */}
      <span className="shrink-0 text-[11px] font-semibold tracking-[0.12em] text-ink uppercase">
        {title}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {children}

        <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden />

        {activeCount > 0 ? (
          <>
            <span className="num rounded-xs border border-data/40 bg-data/12 px-1.5 py-[3px] text-[10px] text-data">
              {activeCount} идэвхтэй
            </span>
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-[10.5px] text-ink-3 transition-colors hover:text-ink"
            >
              <RotateCcw size={10} />
              Цэвэрлэх
            </button>
          </>
        ) : (
          <span className="text-[10px] text-ink-3">Шүүлтүүр тавиагүй</span>
        )}
      </div>
    </div>
  );
}

/**
 * Нэг шүүлтүүрийн товч + хөвөгч самбар.
 * `value` нь одоогийн сонголтыг товчин дээр харуулна — самбарыг нээхгүйгээр
 * ямар шүүлтүүр идэвхтэйг мэдэх боломжтой.
 */
export function FilterMenu({
  label,
  icon: Icon,
  value,
  active,
  width = 268,
  onClear,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Сонгосон утга. Сонгоогүй үед харагдахгүй — товч зөвхөн нэрээрээ үлдэнэ. */
  value?: string | null;
  active: boolean;
  width?: number;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const holder = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={holder} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-xs border px-2 py-1 text-[11px] transition-colors",
          active
            ? "border-data/45 bg-data/10 text-ink"
            : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
          open && "border-line-2",
        )}
      >
        <Icon size={12} strokeWidth={1.75} className="shrink-0 text-ink-3" />
        <span className={active ? "text-ink-3" : undefined}>{label}</span>
        {active && value ? (
          <span className="max-w-[140px] truncate font-medium">{value}</span>
        ) : null}
        {active && onClear ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`${label} шүүлтүүр авах`}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onClear();
              }
            }}
            className="text-ink-3 transition-colors hover:text-clay"
          >
            <X size={10} />
          </span>
        ) : (
          <ChevronDown
            size={11}
            className={cn("text-ink-3 transition-transform", open && "rotate-180")}
          />
        )}
      </button>

      {open ? (
        <div
          className="elevated absolute top-[calc(100%+5px)] left-0 z-40 rounded-xs border border-line-2 bg-paper-2 p-2.5"
          style={{ width }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Самбар доторх сонгох жагсаалт — хайлттай */
export function PickList({
  items,
  selected,
  onPick,
  searchable,
}: {
  items: { key: string; label: string; value: number }[];
  selected: string | null;
  onPick: (key: string | null) => void;
  searchable?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const shown = q
    ? items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div>
      {searchable ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Хайх…"
          className="mb-1.5 h-7 w-full rounded-xs border border-line bg-paper px-2 text-[11px] text-ink outline-none placeholder:text-ink-3 focus:border-line-2"
        />
      ) : null}

      <div className="max-h-[220px] overflow-y-auto">
        {shown.length === 0 ? (
          <p className="py-3 text-center text-[10.5px] text-ink-3">Олдсонгүй</p>
        ) : (
          shown.map((i) => (
            <button
              key={i.key}
              onClick={() => onPick(selected === i.key ? null : i.key)}
              className={cn(
                "flex w-full items-baseline justify-between gap-2 rounded-xs px-1.5 py-1 text-left text-[11px] transition-colors",
                selected === i.key
                  ? "bg-data/12 font-medium text-ink"
                  : "text-ink-2 hover:bg-paper-hi hover:text-ink",
              )}
            >
              <span className="truncate">{i.label}</span>
              <span className="num shrink-0 text-[10px] text-ink-3">{i.value}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
