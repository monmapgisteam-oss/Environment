"use client";

/*
  ХУУДАСНЫ ХАРАГДАЦ — амьтан, ургамлын хэлтсийн самбаруудын баруун багана.

  Ногоон бүсийн хэлтсийн (NBAHH) порталын самбарын "хуудас" горимтой
  (`LayerSet.sheet` — `SheetPanel`, `SheetSection`, `SheetAxis`) ИЖИЛ
  хэлбэр (хэрэглэгч 2026-10-23, NBAHH-ын зургаар: "NBAHH шиг гэж ийм
  чартууд хэлсэн юм"):

  · `SheetSection` — хураагддаг хэсэг, "˅ ГАРЧИГ ······ 6 ангилал";
  · `SheetStats`   — ТОЙМ: хоёр баганат том тоо, доор нь жижиг шошго;
  · `SheetBars`    — НЭГ ЭГНЭЭНИЙ мөр: нэр · 8px уусмал зурвас · тод тоо;
                     утгын багана хамгийн урт тоогоороо (`ch`) тул бүх зурвас
                     нэг цэгт дуусна; 10-аас олон мөр "Бүгдийг харах".

  ⚠ Тайлбар өгүүлбэр, хувь БАЙХГҮЙ (NBAHH-ын дүрэм). Мөр дарахад шүүнэ,
  дахин дарахад цуцлагдана; сонгоогүй мөр 45% бүдгэрнэ.
  ⚠ NBAHH-ынх нь өөр worktree-д (dept/nogoon-bus) commit хийгдээгүй байсан
  тул хуулбар — тэр нь main-д орсны дараа нэгтгэж болно.
*/

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { Datum } from "@/components/charts";
import { cn, num } from "@/lib/utils";

/** Уусмал, тунгалаг дүүргэлт — hex, oklch, CSS хувьсагч аль нь ч болно */
export function sheetFade(color: string): string {
  return `color-mix(in srgb, ${color} 35%, transparent)`;
}

/** Том тоо — 100-аас доош бол нэг аравтын оронтой */
export function sheetNum(v: number): string {
  return Math.abs(v) >= 100 ? num(Math.round(v)) : num(v, 1);
}

/** Хураагддаг хэсэг — "˅ ГАРЧИГ" толгойтой */
export function SheetSection({
  title,
  meta,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  meta?: string | null;
  /** Толгойн баруун талын товч — хураах товчны ГАДНА */
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <section
      className={cn(
        "flex shrink-0 flex-col rounded-xs border border-line bg-paper-2",
        open && className,
      )}
    >
      <div className="flex items-center pr-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-1.5 text-left"
        >
          <ChevronDown
            size={13}
            className={cn("shrink-0 text-ink-3 transition-transform", !open && "-rotate-90")}
          />
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.06em] text-ink uppercase">
            {title}
          </span>
          {meta ? <span className="num shrink-0 text-[10.5px] text-ink-3">{meta}</span> : null}
        </button>
        {action}
      </div>
      {open ? (
        <div className={cn("border-t border-line px-3 pt-2 pb-2", bodyClassName)}>{children}</div>
      ) : null}
    </section>
  );
}

/** ТОЙМ — хоёр баганат том тоо */
export function SheetStats({
  stats,
}: {
  stats: { label: string; value: number | string; unit?: string }[];
}) {
  return (
    <SheetSection title="Тойм">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <p className="num text-[18px] leading-tight font-semibold text-ink">
              {typeof s.value === "number" ? sheetNum(s.value) : s.value}
              {s.unit ? (
                <span className="ml-1 text-[11px] font-normal text-ink-3">{s.unit}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{s.label}</p>
          </div>
        ))}
      </div>
    </SheetSection>
  );
}

/** Жагсаалт энэ тооноос урт бол "Бүгдийг харах" товчоор дэлгэнэ */
const SHEET_ROWS = 10;

/**
 * Нэг эгнээний зурвасан жагсаалт. `measure` нь баруун дээд талд жижиг
 * бичвэрээр — юуг хэмжсэнийг хэлнэ ("Бүртгэлийн тоо").
 * `colorOf` өгвөл мөр бүрд өнгөт дөрвөлжин (зургийн палитртай тэнхлэгт л).
 */
export function SheetBars({
  data,
  measure,
  selected = null,
  onSelect,
  tone = "var(--data)",
  colorOf,
  note,
  rows: limit = SHEET_ROWS,
}: {
  data: Datum[];
  measure?: string;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  tone?: string;
  colorOf?: (d: Datum) => string | undefined;
  /** Нэрийн ард бүдэг нэмэлт утга ("11,562 га") */
  note?: (d: Datum) => string;
  rows?: number;
}) {
  const [all, setAll] = React.useState(false);
  if (!data.length)
    return <p className="py-2 text-center text-[12px] text-ink-3">Мэдээлэл бүртгэгдээгүй байна</p>;
  const max = Math.max(0, ...data.map((d) => d.value));
  const shown = all ? data : data.filter((d, i) => i < limit || d.key === selected);
  /* Утгын багана хамгийн урт тоогоороо — бүх зурвас нэг цэгт дуусна */
  const digits = Math.max(3, ...shown.map((d) => sheetNum(d.value).length));
  const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;
  return (
    <>
      {measure ? <p className="mb-1 text-right text-[10.5px] text-ink-3">{measure}</p> : null}
      <div className="flex flex-col">
        {shown.map((d) => {
          const on = selected === d.key;
          const color = colorOf?.(d) ?? tone;
          const w = max > 0 && d.value ? Math.max(1.5, (d.value / max) * 100) : 0;
          const extra = note?.(d);
          return (
            <button
              key={d.key}
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(on ? null : d.key)}
              aria-pressed={onSelect ? on : undefined}
              title={d.label}
              style={{ gridTemplateColumns: cols }}
              className={cn(
                "grid w-full items-center gap-2.5 rounded-xs px-1.5 py-[3px] text-left text-[12.5px] transition-colors",
                onSelect && "hover:bg-paper-hi",
                on && "bg-paper-hi",
                selected != null && !on && "opacity-45",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {colorOf ? (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-[1px]"
                    style={{ background: sheetFade(color) }}
                  />
                ) : null}
                <span className="min-w-0 truncate text-[12px] text-ink">{d.label}</span>
                {extra ? (
                  <span className="num shrink-0 text-[10.5px] text-ink-3">{extra}</span>
                ) : null}
              </span>
              <span className="block h-2 rounded-[1px] bg-line">
                <span
                  className="block h-full rounded-[1px]"
                  style={{ width: `${w}%`, background: sheetFade(color) }}
                />
              </span>
              <span className="num text-right text-[12.5px] font-semibold text-ink">
                {sheetNum(d.value)}
              </span>
            </button>
          );
        })}
      </div>
      {data.length > limit ? (
        <button
          type="button"
          onClick={() => setAll((s) => !s)}
          className="mt-1 px-1.5 text-[11px] text-ink-3 hover:text-ink"
        >
          {all ? "Хураах" : `Бүгдийг харах · ${num(data.length)}`}
        </button>
      ) : null}
    </>
  );
}

/** Толгойн "N ангилал" */
export function catMeta(n: number): string {
  return `${num(n)} ангилал`;
}
