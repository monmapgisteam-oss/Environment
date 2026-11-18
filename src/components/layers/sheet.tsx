"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import {
  unitOf,
  type Breakdown,
  type DateAxis,
  type Row,
} from "@/lib/portal-layers";
import { cn, num } from "@/lib/utils";

import { isTime, filterKey, adminRank } from "./chart-helpers";
import type { Loaded } from "./board-shared";

/**
 * ⚠⚠ **ХУУДАСНЫ ХАРАГДАЦ** ({@link LayerSet.sheet}; хэрэглэгч 2026-10-22,
 * Archimap-ийн ANALYSIS самбарын зургаар: "эндээс санаа аваад хий,
 * цэвэрхэн, ойлгомжтой, энгийн").
 *
 * Хүснэгтийн оронд дээрээс доош уншигдах ХЭСГҮҮД — тус бүр хураагддаг:
 * 1. **ТОЙМ** — хоёр баганат тоо: бүртгэлийн тоо, хэмжилт бүрийн нийт
 *    дүн (нэгжтэй), хугацааны муж. Том тоо, доор нь жижиг шошго.
 * 2. **Тэнхлэг бүр** (салбар, дүүрэг …) — НЭГ ЭГНЭЭНИЙ мөр: нэр · 8px
 *    зурвас · тод тоо (~29px). Утгын багана хамгийн урт тоогоороо (`ch`)
 *    тул бүх зурвас нэг цэгт дуусна. Хэмжилт нэгээс олон бол толгойн
 *    товчоор сэлгэнэ. Өнгөт дөрвөлжин ЗӨВХӨН зургийн палитртай тэнхлэгт.
 * 3. **Хугацаа** — багана бүр утгаа дээрээ бичнэ (≤ 12 багана үед).
 *
 * ⚠⚠ Эхний хувилбар (мөр ~38px, доор нь 3px зурвас, мөр бүрд өнгөт
 * дөрвөлжин, тэнхлэгийн нэр дэд толгойд давтагдана, хугацааны доор
 * "Хамгийн их · Хугацаа") "маш болхи" гэж буцаагдсан (2026-10-22).
 *
 * ⚠ Тайлбар өгүүлбэр, хувь БАЙХГҮЙ (Archimap-ийн дүгнэлт бичвэрийг
 * ХУУЛААГҮЙ — арга зүйн тайлбарын дүрэм). Мөр, багана дарахад шүүнэ
 * (`pickOnly`), дахин дарахад цуцлагдана.
 * ⚠ Олон утгат, хураасан задаргааны нийлбэр Тоймд ОРОХГҮЙ — бүтэн дүн биш.
 */
export function SheetPanel({
  cuts,
  tone,
  records,
  word,
  colors,
  colorAxis,
  selectedOf,
  onPick,
  rowsSkipping,
  onPickAdmin,
}: {
  cuts: Breakdown[];
  tone: string;
  records: number;
  word?: { one: string; count: string };
  /** Газрын зургийн палитр — зургийг будаж буй тэнхлэгт л */
  colors?: Map<string, string>;
  colorAxis?: string | null;
  selectedOf: (axis: string) => string | null;
  onPick: (axis: string, key: string | null) => void;
  /** Заасан тэнхлэгүүдийг АЛГАССАН шүүлттэй мөрүүд ({@link SheetAdmin}) */
  rowsSkipping?: (skip: string[]) => Row[];
  /** Дүүрэг, хороо хоёрыг ЗЭРЭГ тогтооно (`null` — цуцлах) */
  onPickAdmin?: (
    dAxis: string,
    kAxis: string,
    d: string | null,
    k: string | null,
  ) => void;
}) {
  const countLabel = word?.count ?? "Бүртгэлийн тоо";

  /* ---- ТОЙМ ---- */
  const stats: { label: string; value: string; unit: string }[] = [
    { label: countLabel, value: num(records), unit: "" },
  ];
  const seen = new Set<string>();
  const addTotal = (label: string, by: Iterable<number>) => {
    if (seen.has(label) || stats.length >= 6) return;
    seen.add(label);
    const cut = unitOf(label);
    const total = [...by].reduce((s, v) => s + v, 0);
    stats.push({
      label: cut.unit ? cut.name : label,
      value: sheetNum(total),
      unit: cut.unit,
    });
  };
  for (const b of cuts) {
    if (b.multi || b.top != null) continue;
    if (b.kind === "sum" && b.measure)
      addTotal(
        b.measure,
        b.values.map((d) => d.value),
      );
    if (b.kind === "count" && b.notes && b.note)
      addTotal(b.note.label, b.notes.values());
  }
  for (const b of cuts) {
    if (b.kind !== "year" || stats.length >= 6) continue;
    const span = timeSpan(b);
    if (span) stats.push({ label: b.label, value: span, unit: "" });
  }

  /* ---- ТЭНХЛЭГҮҮД ---- */
  const axes: { key: string; label: string; list: Breakdown[] }[] = [];
  const times: Breakdown[] = [];
  for (const b of cuts) {
    if (b.kind === "compare") continue;
    if (isTime(b)) {
      times.push(b);
      continue;
    }
    const k = filterKey(b);
    const at = axes.find((x) => x.key === k);
    if (at) at.list.push(b);
    else axes.push({ key: k, label: b.label, list: [b] });
  }

  /*
    ⚠⚠ ДҮҮРЭГ, ХОРОО НЭГ ХЭСЭГТ ({@link SheetAdmin}; хэрэглэгч 2026-10-22:
    "дүүрэг хорооны чартуудыг нэгтгэ"). Хороо нь дүүрэг дотроо л утгатай
    — өөр дүүргийн ижил дугаартай хороо тусдаа тэнхлэгт нийлж байв.
  */
  const hasCount = (a: { list: Breakdown[] }) =>
    a.list.some((b) => b.kind === "count");
  const dAxis = rowsSkipping
    ? axes.find((a) => adminRank(a.label) === 1 && hasCount(a))
    : undefined;
  const kAxis = dAxis
    ? axes.find((a) => adminRank(a.label) === 2 && hasCount(a))
    : undefined;

  return (
    <>
      <SheetSection title="Тойм">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="num text-[18px] font-semibold leading-tight text-ink">
                {s.value}
                {s.unit ? (
                  <span className="ml-1 text-[11px] font-normal text-ink-3">
                    {s.unit}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-3">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </SheetSection>
      {axes.map((a) =>
        dAxis && kAxis && a === kAxis ? null : dAxis && kAxis && a === dAxis ? (
          <SheetAdmin
            key={a.key}
            dAxis={dAxis}
            kAxis={kAxis}
            rows={rowsSkipping!([dAxis.key, kAxis.key])}
            tone={tone}
            word={word}
            colors={dAxis.key === colorAxis ? colors : undefined}
            selD={selectedOf(dAxis.key)}
            selK={selectedOf(kAxis.key)}
            onPick={(d, k) => onPickAdmin?.(dAxis.key, kAxis.key, d, k)}
          />
        ) : (
          <SheetAxis
            key={a.key}
            axis={a}
            tone={tone}
            word={word}
            colors={a.key === colorAxis ? colors : undefined}
            selected={selectedOf(a.key)}
            onPick={(k) => onPick(a.key, k)}
          />
        ),
      )}
      {/* ⚠ Нэг талбарын он, сар НЭГ КАРТАД сэлгэгдэнэ ({@link SheetTimes}) */}
      {times.length ? (
        <div className="grid gap-2">
          {timeGroups(times).map((list) => (
            <SheetTimes
              key={list[0].id}
              list={list}
              tone={tone}
              selectedOf={(b) => selectedOf(filterKey(b))}
              onPick={(b, k) => onPick(filterKey(b), k)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Хуудасны зурвас, баганын дүүргэлт УУССАН, ТУНГАЛАГ ({@link SheetPanel};
 * хэрэглэгч 2026-10-22: "чартын өнгө уусан transparent"). Тоо, нэр бүтэн
 * тод хэвээр. `color-mix` — өнгө нь hex, `oklch`, CSS хувьсагч аль нь ч
 * байж болно (`soft` зөвхөн hex-д ажилладаг).
 */
export function sheetFade(color: string): string {
  return `color-mix(in srgb, ${color} 35%, transparent)`;
}

/** Том тоо — 100-аас доош бол нэг аравтын оронтой */
export function sheetNum(v: number): string {
  return Math.abs(v) >= 100 ? num(Math.round(v)) : num(v, 1);
}

/** Бүртгэлтэй эхний ба сүүлийн хугацаа ("2019–2026"), эс бөгөөс `null` */
export function timeSpan(b: Breakdown): string | null {
  const on = b.values.filter((d) => d.value > 0);
  if (!on.length) return null;
  const a = on[0].label.split("–")[0];
  const z = on[on.length - 1].label.split("–").pop() ?? a;
  return a === z ? a : `${a}–${z}`;
}

/** Хураагддаг хэсэг — "˅ ГАРЧИГ" толгойтой ({@link SheetPanel}) */
export function SheetSection({
  title,
  meta,
  dot,
  action,
  open: held,
  onToggle,
  anchor,
  children,
}: {
  title: string;
  meta?: string;
  /** Гарчгийн өмнөх өнгөт дөрвөлжин — зургийн өнгө ({@link ZoneSheet}) */
  dot?: string;
  /** Толгойн баруун талын товч — хураах товчны ГАДНА */
  action?: React.ReactNode;
  /** Эцэг удирдвал (бүсийн хэсэг — харьцуулах хүснэгтээс нээгдэнэ) */
  open?: boolean;
  onToggle?: () => void;
  /** Гүйлгэж хүрэх элементийн `id` */
  anchor?: string;
  children: React.ReactNode;
}) {
  const [own, setOwn] = React.useState(true);
  const open = held ?? own;
  return (
    <section
      id={anchor}
      className="shrink-0 scroll-mt-2 rounded-xs border border-line bg-paper-2"
    >
      <div className="flex items-center pr-2">
        <button
          type="button"
          onClick={() => (onToggle ? onToggle() : setOwn((o) => !o))}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-1.5 text-left"
        >
          <ChevronDown
            size={13}
            className={cn(
              "shrink-0 text-ink-3 transition-transform",
              !open && "-rotate-90",
            )}
          />
          {dot ? (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[1px]"
              style={{ background: dot }}
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-ink">
            {title}
          </span>
          {meta ? (
            <span className="num shrink-0 text-[10.5px] text-ink-3">
              {meta}
            </span>
          ) : null}
        </button>
        {action}
      </div>
      {open ? (
        <div className="border-t border-line px-3 pb-2 pt-2">{children}</div>
      ) : null}
    </section>
  );
}

/** Жагсаалт энэ тооноос урт бол "Бүгдийг харах" товчоор дэлгэнэ */
export const SHEET_ROWS = 10;

/**
 * Хэмжилт сонгох унждаг цэс ({@link SheetAxis}). Товчны эгнээ (`Segments`)
 * гэрээний давхаргын есөн урт нэрийг дөрвөн мөр болгож бөөгнөрүүлдэг байв
 * (хэрэглэгч 2026-10-22: "өөрөөр хийх санаа"). Нэгжгүй хэмжилт (тоо) эхэнд,
 * бусад нь НЭГЖЭЭРЭЭ бүлэглэгдэнэ — нэг бүлгийнх л хооронд харьцуулагдана.
 * Хөтчийн өөрийн `<select>`: жагсаалтад нэр бүтнээрээ, `color-scheme`-ээр
 * горимоо дагана.
 */
export function MetricSelect({
  metrics,
  value,
  onChange,
}: {
  metrics: { id: string; name: string; unit: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const plain = metrics.filter((m) => !m.unit);
  const groups = new Map<string, typeof metrics>();
  for (const m of metrics) {
    if (!m.unit) continue;
    const list = groups.get(m.unit) ?? [];
    list.push(m);
    groups.set(m.unit, list);
  }
  const current = metrics.find((m) => m.id === value);
  return (
    <label className="relative mb-1.5 block">
      <span className="sr-only">Хэмжилт</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={current?.name}
        className="h-7 w-full cursor-pointer appearance-none truncate rounded-xs border border-line-2 bg-paper py-0 pl-2.5 pr-8 text-[12px] font-medium text-ink outline-none transition-colors hover:border-ink-3 focus-visible:border-ink-3"
      >
        {plain.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
        {[...groups].map(([unit, list]) => (
          <optgroup key={unit} label={unit}>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3"
      />
    </label>
  );
}

/**
 * Огноогоор шүүх мөрийн өгөгдөл ({@link LayerSet.dateBar}) — асаалттай
 * давхаргуудын ЭХНИЙ огноотой нь.
 * ⚠ МОДУЛИЙН түвшинд: давталт, эрт буцалттай мемо нь React Compiler-ийн
 * мемоизацийг тасалдаг (`parcelAxisOf`-тэй нэг шалтгаан).
 */
export function dateBarOf(
  on: readonly string[],
  dateBars: Record<string, DateAxis[]>,
  loaded: Record<string, Loaded>,
  dateWant: Record<string, string>,
) {
  for (const id of on) {
    const list = dateBars[id];
    const hit = loaded[id];
    if (!list || !hit) continue;
    const axis = list.find((a) => a.field === dateWant[id]) ?? list[0];
    const yk = `${axis.field}\u0000year`;
    const mk = `${axis.field}\u0000month`;
    const chart = hit.charts.find((c) => filterKey(c) === yk);
    const years = chart
      ? chart.values
          .filter((d) => d.value > 0)
          .map((d) => ({ key: d.key, label: d.label }))
      : axis.years.map((y) => ({ key: String(y), label: String(y) }));
    const monthOf = axis.monthOf;
    const months = monthOf
      ? [
          ...new Set(
            Object.values(hit.data.rows)
              .map((r) => monthOf(r))
              .filter((m): m is number => m != null),
          ),
        ].sort((a, b) => a - b)
      : [];
    return { id, list, axis, yk, mk, years, months };
  }
  return null;
}

/** Шүүлтүүрийн мөрийн нягт сонгогч (огноогоор шүүх мөр) */
export function BarSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-[27px] max-w-[16rem] cursor-pointer appearance-none truncate rounded-xs border bg-paper py-0 pl-2 pr-7 text-[12px] outline-none transition-colors hover:border-line-2 focus-visible:border-ink-3",
          value
            ? "border-data/45 font-medium text-ink"
            : "border-line text-ink-2",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-3"
      />
    </label>
  );
}

/**
 * ⚠⚠ **ДҮҮРЭГ, ХОРОО — НЭГ ШАТАЛСАН ХЭСЭГ** ({@link SheetPanel};
 * хэрэглэгч 2026-10-22: "дүүрэг хорооны чартуудыг нэгтгэ").
 *
 * Дүүргийн мөр бүр сумаар задарч, тэр дүүргийн хороод доор нь догол
 * мөрөөр гарна. Тусдаа "Хороо" тэнхлэг нь өөр дүүргийн ИЖИЛ дугаартай
 * хороог (Баянзүрхийн 5, Хан-Уулын 5) нэг мөр болгож нийлүүлдэг байв.
 *
 * ⚠ Бүх тоо `rows`-оос (дүүрэг, хороо ХОЁУЛАНГ алгассан шүүлттэй) дахин
 * тоологдоно (`recount`) — хороо сонгосон ч бусад дүүрэг тэгээр
 * хумигдахгүй. Хорооны утга нь хорооны тэнхлэгийн ИЖИЛ хэмжилтийн
 * задаргаагаар, тэр дүүргийн мөрүүд дээр.
 * ⚠ Дүүрэг дарахад дүүргээр шүүж задарна; хороо дарахад дүүрэг, хороо
 * хоёуланг ЗЭРЭГ тогтооно. Дахин дарахад нэг шат буцна.
 * ⚠ Хороо нь дүүрэгтээ л харьцуулагдана — зурвасын хуваарь дүүрэг бүрд.
 */
export function SheetAdmin({
  dAxis,
  kAxis,
  rows,
  tone,
  word,
  colors,
  selD,
  selK,
  onPick,
}: {
  dAxis: { key: string; label: string; list: Breakdown[] };
  kAxis: { key: string; label: string; list: Breakdown[] };
  rows: Row[];
  tone: string;
  word?: { one: string; count: string };
  colors?: Map<string, string>;
  selD: string | null;
  selK: string | null;
  onPick: (d: string | null, k: string | null) => void;
}) {
  const [want, setWant] = React.useState("");
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const [all, setAll] = React.useState<Set<string>>(() => new Set());
  const [allD, setAllD] = React.useState(false);

  /* Хэмжилт — дүүргийн тэнхлэгийнх, хорооных нь ижил төрөл, нэрээр */
  type Metric = {
    id: string;
    name: string;
    unit: string;
    d: Breakdown;
    k?: Breakdown;
    note: boolean;
  };
  const same = (a: Breakdown, b: Breakdown) =>
    a.kind === b.kind && (a.measure ?? "") === (b.measure ?? "");
  const metrics: Metric[] = [];
  for (const b of dAxis.list) {
    const k = kAxis.list.find((x) => same(x, b));
    if (b.kind === "count") {
      metrics.push({
        id: b.id,
        name: word?.count ?? "Бүртгэлийн тоо",
        unit: "",
        d: b,
        k,
        note: false,
      });
      if (b.notes && b.note) {
        const cut = unitOf(b.note.label);
        metrics.push({
          id: `${b.id}:note`,
          name: cut.unit ? cut.name : b.note.label,
          unit: cut.unit,
          d: b,
          k: k?.note?.label === b.note.label ? k : undefined,
          note: true,
        });
      }
    } else if (b.measure) {
      const cut = unitOf(b.measure);
      metrics.push({
        id: b.id,
        name: cut.unit ? cut.name : b.measure,
        unit: [cut.unit, b.kind === "mean" ? "дундаж" : ""]
          .filter(Boolean)
          .join(" · "),
        d: b,
        k,
        note: false,
      });
    }
  }
  const metric = metrics.find((m) => m.id === want) ?? metrics[0];
  if (!metric) return null;

  const valuesOf = (b: Breakdown, list: Row[], note: boolean) => {
    const c = b.recount(list);
    return note
      ? (c.notes ?? new Map<string, number>())
      : new Map(c.values.map((d) => [d.key, d.value]));
  };
  const dLabel = new Map<string, string>();
  for (const b of dAxis.list)
    for (const d of b.values) dLabel.set(d.key, d.label);
  const kLabel = new Map<string, string>();
  for (const b of kAxis.list)
    for (const d of b.values) kLabel.set(d.key, d.label);

  const blank = (k: string) => (k === "Бүртгэгдээгүй" ? 1 : 0);
  const dRows = [...valuesOf(metric.d, rows, metric.note)]
    .map(([key, v]) => ({ key, label: dLabel.get(key) ?? key, v }))
    .filter((r) => r.v > 0 || r.key === selD)
    .sort((a, b) => blank(a.key) - blank(b.key) || b.v - a.v);
  const dMax = Math.max(0, ...dRows.map((r) => r.v));
  const dShown = allD
    ? dRows
    : dRows.filter((r, i) => i < SHEET_ROWS || r.key === selD);

  /* Задарсан дүүрэг — хэрэглэгч нээсэн эсвэл сонгосон */
  const isOpen = (d: string) => open.has(d) || d === selD;
  const kids = (d: string) => {
    if (!metric.k) return [];
    const sub = rows.filter((r) => metric.d.keyOf(r).includes(d));
    return [...valuesOf(metric.k, sub, metric.note)]
      .map(([key, v]) => ({ key, label: kLabel.get(key) ?? key, v }))
      .filter((r) => r.v > 0 || (d === selD && r.key === selK))
      .sort((a, b) => blank(a.key) - blank(b.key) || b.v - a.v);
  };

  const flip = (set: Set<string>, k: string) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  };

  const digits = Math.max(3, ...dRows.map((r) => sheetNum(r.v).length));
  const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;
  const comma = dAxis.label.includes(",") || kAxis.label.includes(",");
  const title = `${dAxis.label}${comma ? " · " : ", "}${kAxis.label.toLocaleLowerCase("mn")}`;

  const bar = (v: number, max: number, color: string) => (
    <span className="block h-2 rounded-[1px] bg-line">
      <span
        className="block h-full rounded-[1px]"
        style={{
          width: `${max > 0 && v ? Math.max(1.5, (v / max) * 100) : 0}%`,
          background: sheetFade(color),
        }}
      />
    </span>
  );

  return (
    <SheetSection title={title} meta={`${num(dRows.length)} ангилал`}>
      {metrics.length > 1 ? (
        <MetricSelect metrics={metrics} value={metric.id} onChange={setWant} />
      ) : null}
      {metrics.length === 1 || metric.unit ? (
        <p className="mb-1 text-right text-[10.5px] text-ink-3">
          {metrics.length === 1 ? metric.name : null}
          {metrics.length === 1 && metric.unit ? ", " : null}
          {metric.unit}
        </p>
      ) : null}
      <div className="flex flex-col">
        {dShown.map((r) => {
          const on = selD === r.key && selK == null;
          const color = colors?.get(r.key) ?? tone;
          const expanded = metric.k ? isOpen(r.key) : false;
          const list = expanded ? kids(r.key) : [];
          const kMax = Math.max(0, ...list.map((x) => x.v));
          const many = all.has(r.key);
          const kShown = many
            ? list
            : list.filter((x, i) => i < SHEET_ROWS || x.key === selK);
          return (
            <div key={r.key} className="flex flex-col">
              <div
                className={cn(
                  "flex items-center rounded-xs transition-colors hover:bg-paper-hi",
                  on && "bg-paper-hi",
                  selD != null && selD !== r.key && "opacity-45",
                )}
              >
                {metric.k ? (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Хураах" : "Задлах"}
                    onClick={() => setOpen((s) => flip(s, r.key))}
                    className="flex h-[22px] w-5 shrink-0 items-center justify-center text-ink-3 hover:text-ink"
                  >
                    <ChevronDown
                      size={12}
                      className={cn(
                        "transition-transform",
                        !expanded && "-rotate-90",
                      )}
                    />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    onPick(on ? null : r.key, null);
                    if (!on) setOpen((s) => new Set(s).add(r.key));
                  }}
                  aria-pressed={on}
                  title={r.label}
                  style={{ gridTemplateColumns: cols }}
                  className="grid min-w-0 flex-1 items-center gap-2.5 py-[3px] pr-1.5 text-left text-[12.5px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {colors ? (
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-[1px]"
                        style={{ background: sheetFade(color) }}
                      />
                    ) : null}
                    <span className="min-w-0 truncate text-[12px] font-medium text-ink">
                      {r.label}
                    </span>
                  </span>
                  {bar(r.v, dMax, color)}
                  <span className="num text-right text-[12.5px] font-semibold text-ink">
                    {sheetNum(r.v)}
                  </span>
                </button>
              </div>
              {expanded ? (
                <div className="mb-1 ml-[9px] flex flex-col border-l border-line pl-1.5">
                  {kShown.length ? (
                    kShown.map((x) => {
                      const kon = selD === r.key && selK === x.key;
                      return (
                        <button
                          key={x.key}
                          type="button"
                          onClick={() => onPick(r.key, kon ? null : x.key)}
                          aria-pressed={kon}
                          title={`${r.label} · ${x.label}`}
                          style={{ gridTemplateColumns: cols }}
                          className={cn(
                            "grid w-full items-center gap-2.5 rounded-xs px-1.5 py-[2px] text-left text-[11.5px] transition-colors hover:bg-paper-hi",
                            kon && "bg-paper-hi",
                            selK != null &&
                              selD === r.key &&
                              !kon &&
                              "opacity-45",
                          )}
                        >
                          <span className="min-w-0 truncate text-[11.5px] text-ink-2">
                            {x.label}
                          </span>
                          {bar(x.v, kMax, color)}
                          <span className="num text-right text-[11.5px] text-ink">
                            {sheetNum(x.v)}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-1.5 py-[2px] text-[11px] text-ink-3">—</p>
                  )}
                  {list.length > SHEET_ROWS ? (
                    <button
                      type="button"
                      onClick={() => setAll((s) => flip(s, r.key))}
                      className="mt-0.5 px-1.5 text-left text-[11px] text-ink-3 hover:text-ink"
                    >
                      {many ? "Хураах" : `Бүгдийг харах · ${num(list.length)}`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {dRows.length > SHEET_ROWS ? (
        <button
          type="button"
          onClick={() => setAllD((s) => !s)}
          className="mt-1 px-1.5 text-[11px] text-ink-3 hover:text-ink"
        >
          {allD ? "Хураах" : `Бүгдийг харах · ${num(dRows.length)}`}
        </button>
      ) : null}
    </SheetSection>
  );
}

/** Нэг тэнхлэгийн хэсэг ({@link SheetPanel}) */
export function SheetAxis({
  axis,
  tone,
  word,
  colors,
  selected,
  onPick,
}: {
  axis: { key: string; label: string; list: Breakdown[] };
  tone: string;
  word?: { one: string; count: string };
  colors?: Map<string, string>;
  selected: string | null;
  onPick: (key: string | null) => void;
}) {
  const [want, setWant] = React.useState("");
  const [all, setAll] = React.useState(false);

  type Metric = {
    id: string;
    name: string;
    unit: string;
    by: Map<string, number>;
  };
  const metrics: Metric[] = [];
  for (const b of axis.list) {
    const by = new Map(b.values.map((d) => [d.key, d.value]));
    if (b.kind === "count") {
      metrics.push({
        id: b.id,
        name: word?.count ?? "Бүртгэлийн тоо",
        unit: "",
        by,
      });
      if (b.notes && b.note) {
        const cut = unitOf(b.note.label);
        metrics.push({
          id: `${b.id}:note`,
          name: cut.unit ? cut.name : b.note.label,
          unit: cut.unit,
          by: b.notes,
        });
      }
    } else if (b.measure) {
      const cut = unitOf(b.measure);
      metrics.push({
        id: b.id,
        name: cut.unit ? cut.name : b.measure,
        unit: [cut.unit, b.kind === "mean" ? "дундаж" : ""]
          .filter(Boolean)
          .join(" · "),
        by,
      });
    }
  }
  const metric = metrics.find((m) => m.id === want) ?? metrics[0];
  if (!metric) return null;

  const labels = new Map<string, string>();
  for (const b of axis.list)
    for (const d of b.values) labels.set(d.key, d.label);
  const blank = (k: string) => (k === "Бүртгэгдээгүй" ? 1 : 0);
  const rows = [...labels.keys()]
    .map((key) => ({
      key,
      label: labels.get(key) ?? key,
      v: metric.by.get(key),
    }))
    .sort((a, b) => blank(a.key) - blank(b.key) || (b.v ?? -1) - (a.v ?? -1));
  const max = Math.max(0, ...rows.map((r) => r.v ?? 0));
  /* Сонгосон мөр хураасан хэсэгт байсан ч харагдана */
  const shown = all
    ? rows
    : rows.filter((r, i) => i < SHEET_ROWS || r.key === selected);
  const top = axis.list[0]?.top;
  /* Утгын багана хамгийн урт тоогоороо — бүх мөрийн зурвас нэг цэгт дуусна */
  const digits = Math.max(
    3,
    ...shown.map((r) => (r.v == null ? 1 : sheetNum(r.v).length)),
  );
  const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;

  return (
    <SheetSection
      title={axis.label}
      meta={top ? `эхний ${top}` : `${num(rows.length)} ангилал`}
    >
      {metrics.length > 1 ? (
        <MetricSelect metrics={metrics} value={metric.id} onChange={setWant} />
      ) : null}
      {metrics.length === 1 || metric.unit ? (
        <p className="mb-1 text-right text-[10.5px] text-ink-3">
          {metrics.length === 1 ? metric.name : null}
          {metrics.length === 1 && metric.unit ? ", " : null}
          {metric.unit}
        </p>
      ) : null}
      <div className="flex flex-col">
        {shown.map((r) => {
          const on = selected === r.key;
          const color = colors?.get(r.key) ?? tone;
          const w = max > 0 && r.v ? Math.max(1.5, (r.v / max) * 100) : 0;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onPick(on ? null : r.key)}
              aria-pressed={on}
              title={r.label}
              style={{ gridTemplateColumns: cols }}
              className={cn(
                "grid w-full items-center gap-2.5 text-[12.5px] rounded-xs px-1.5 py-[3px] text-left transition-colors hover:bg-paper-hi",
                on && "bg-paper-hi",
                selected != null && !on && "opacity-45",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {colors ? (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-[1px]"
                    style={{ background: sheetFade(color) }}
                  />
                ) : null}
                <span className="min-w-0 truncate text-[12px] text-ink">
                  {r.label}
                </span>
              </span>
              <span className="block h-2 rounded-[1px] bg-line">
                <span
                  className="block h-full rounded-[1px]"
                  style={{ width: `${w}%`, background: sheetFade(color) }}
                />
              </span>
              <span className="num text-right text-[12.5px] font-semibold text-ink">
                {r.v == null ? (
                  <span className="font-normal text-ink-3">—</span>
                ) : (
                  sheetNum(r.v)
                )}
              </span>
            </button>
          );
        })}
      </div>
      {rows.length > SHEET_ROWS ? (
        <button
          type="button"
          onClick={() => setAll((s) => !s)}
          className="mt-1 px-1.5 text-[11px] text-ink-3 hover:text-ink"
        >
          {all ? "Хураах" : `Бүгдийг харах · ${num(rows.length)}`}
        </button>
      ) : null}
    </SheetSection>
  );
}

/**
 * Цэгүүдийг дайрсан ЗӨӨЛӨН муруй (хэрэглэгч 2026-10-22: "smooth line") —
 * монотон куб (Fritsch–Carlson): хөрш хоёр цэгийн хооронд хэтэрч
 * (overshoot) тэгээс доош, оргилоос дээш гарахгүй тул утгыг худал
 * зурахгүй. Catmull-Rom нь тэг утгын өмнө сөрөг рүү унжиж байв.
 */
export function smoothPath(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  if (!n) return "";
  if (n < 3)
    return pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++)
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/**
 * Хугацааны хэсэг — ХЭВТЭЭ ШУГАМАН ДИАГРАМ, доор нь 50%-ийн дүүргэлт
 * (хэрэглэгч 2026-10-22: "hundlun line chart ch ymuu dotroo fill 50 tai";
 * урьд нь багана байсан). Цэг бүр утгаа дээрээ бичнэ (≤ 12 цэг үед).
 * Багана бүрийн бүтэн өндрийн тунгалаг товч нь шүүлт хэвээр.
 * ⚠ SVG нь `preserveAspectRatio="none"`-оор сунана — шугамын зузааныг
 * `non-scaling-stroke` барина; цэг, тоо нь HTML (хувиар байрлана) тул
 * сунахгүй.
 */
/**
 * ⚠⚠ ОН, САР НЭГ КАРТАД ДАВХАРЛАНА (хэрэглэгч 2026-10-22: "eswel on sar
 * 2-iin chartaa dawhralchih"). Зэрэгцүүлэхэд хагас өргөнд тэнхлэг, утга
 * шахагдаж байв. НЭГ талбарын жил, сарын цуваа бүтэн өргөнтэй НЭГ карт
 * болж, дээрх "Жилээр · Сараар" товчоор сэлгэгдэнэ (`timeView`-тэй нэг
 * санаа). Шүүлт тус бүр өөрийн түлхүүрээр (`filterKey`) хэвээр.
 */
/** Хугацааны задаргааг ТАЛБАРААР бүлэглэнэ — он, сар нь нэг талбараас */
export function timeGroups(times: Breakdown[]): Breakdown[][] {
  const by = new Map<string, Breakdown[]>();
  for (const b of times) {
    const k = b.field ?? b.id;
    by.set(k, [...(by.get(k) ?? []), b]);
  }
  return [...by.values()].map((g) =>
    [...g].sort(
      (a, c) => (a.kind === "year" ? 0 : 1) - (c.kind === "year" ? 0 : 1),
    ),
  );
}

export function SheetTimes({
  list,
  tone,
  selectedOf,
  onPick,
}: {
  list: Breakdown[];
  tone: string;
  selectedOf: (b: Breakdown) => string | null;
  onPick: (b: Breakdown, k: string | null) => void;
}) {
  const [at, setAt] = React.useState(0);
  const b = list[Math.min(at, list.length - 1)];
  const labels = [...new Set(list.map((x) => x.label))];
  const title = labels.length === 1 ? labels[0] : labels.join(", ");
  const head = (
    <div className="mb-1.5 flex gap-1">
      {list.map((x, i) => (
        <button
          key={x.id}
          type="button"
          onClick={() => setAt(i)}
          aria-pressed={x === b}
          className={cn(
            "rounded-xs border px-2 py-0.5 text-[10.5px] transition-colors",
            x === b
              ? "border-(--tone) text-ink"
              : "border-line text-ink-3 hover:text-ink",
          )}
        >
          {x.kind === "month" ? "Сараар" : "Жилээр"}
        </button>
      ))}
    </div>
  );
  return (
    <SheetTime
      b={b}
      tone={tone}
      title={title}
      head={head}
      selected={selectedOf(b)}
      onPick={(k) => onPick(b, k)}
    />
  );
}

/** 10px `num` тоо, тэмдэгт тутмын ойролцоо өргөн (px) */
export const TICK_CH = 6.2;

export function SheetTime({
  b,
  tone,
  selected,
  onPick,
  title,
  head,
}: {
  b: Breakdown;
  tone: string;
  selected: string | null;
  onPick: (key: string | null) => void;
  /** Нэгтгэсэн картын гарчиг ({@link SheetTimes}) */
  title?: string;
  /** Диаграмын дээрх сэлгэгч ({@link SheetTimes}) */
  head?: React.ReactNode;
}) {
  /* Градиентийн id хуудсан дээр давтагдахгүй байх ёстой */
  const gid = React.useId().replace(/:/g, "");
  /* Өргөнийг хэмжинэ — он, сар зэрэгцэх үед хагас өргөнд утгын шошго
     багтах эсэхийг шийднэ (`ResizeObserver`-ын дуудлагад төлөв). */
  const [w, setW] = React.useState(0);
  const watch = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vals = b.values;
  const span = timeSpan(b);
  if (!span) return null;
  const n = vals.length;
  const max = Math.max(0, ...vals.map((d) => d.value));
  /* Утга цэгийн дээр — цөөн цэг үед, багтах үед л (давхцвал бичвэр
     уншигдахгүй; утга нь `title`-д үлдэнэ). Тоо ~6px/тэмдэгт (11px). */
  const longest = Math.max(1, ...vals.map((d) => sheetNum(d.value).length));
  const labelled = n <= 12 && (w === 0 || longest * 6.2 + 4 <= w / n);
  const unit = b.measure ? unitOf(b.measure).unit : "";
  /* Тэнхлэгийн шошго богино: "11-р сар" → "11" (гарчиг нь "Сар") */
  const tick = (label: string) => label.replace(/-р сар$/, "");
  /* Шошго багтах тоогоор сийрэгжинэ — эхний ба сүүлийнх үргэлж; сүүлийнх
     нь өмнөхтэйгээ хэт ойр бол өмнөхийг нь орхино (давхцахгүй). */
  const tickLen = Math.max(1, ...vals.map((d) => tick(d.label).length));
  const fit = w > 0 ? Math.max(1, Math.floor(w / (tickLen * TICK_CH + 8))) : 8;
  const step = Math.max(1, Math.ceil(n / fit));
  const ticks: number[] = [];
  for (let i = 0; i < n; i += step) ticks.push(i);
  if (ticks[ticks.length - 1] !== n - 1) {
    if (n - 1 - ticks[ticks.length - 1] < step && ticks.length > 1) ticks.pop();
    ticks.push(n - 1);
  }
  /* Хэвтээ байрлал — багана бүрийн голд; босоо нь дээд 22%-ийг шошгонд */
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const top = labelled ? 22 : 6;
  const y = (v: number) => 100 - (max > 0 ? (v / max) * (100 - top) : 0);
  const pts = vals.map((d, i) => [x(i), y(d.value)] as const);
  const line = smoothPath(pts);
  const area = `${line} L${x(n - 1)},100 L${x(0)},100 Z`;

  return (
    <SheetSection title={title ?? b.label} meta={unit || undefined}>
      {head}
      <div ref={watch} className="relative h-[84px] w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {/* Дүүргэлт ДЭЭРЭЭС ДООШ уусна (хэрэглэгч, 2026-10-22: "iim
              uusalt" — хуваалцсан `AreaChart`-ын градиенттай нэг) */}
          <defs>
            <linearGradient id={`st-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity={0.3} />
              <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#st-${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={tone}
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {vals.map((d, i) => {
          const sel = selected === d.key;
          const dim = selected != null && !sel;
          return (
            <React.Fragment key={d.key}>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-opacity",
                  sel ? "size-2.5" : "size-2",
                  dim && "opacity-40",
                )}
                style={{
                  left: `${x(i)}%`,
                  top: `${y(d.value)}%`,
                  background: tone,
                  borderColor: "var(--paper-2)",
                }}
              />
              {labelled && d.value > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "num pointer-events-none absolute -translate-x-1/2 -translate-y-full pb-1 text-[11px] font-semibold text-ink transition-opacity",
                    dim && "opacity-40",
                  )}
                  style={{ left: `${x(i)}%`, top: `${y(d.value)}%` }}
                >
                  {sheetNum(d.value)}
                </span>
              ) : null}
              <button
                type="button"
                title={`${d.label} · ${sheetNum(d.value)}`}
                onClick={() => onPick(sel ? null : d.key)}
                aria-pressed={sel}
                className={cn(
                  "absolute inset-y-0 rounded-xs transition-colors hover:bg-paper-hi/40",
                  sel && "bg-paper-hi/50",
                )}
                style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
              />
            </React.Fragment>
          );
        })}
      </div>
      {/* ⚠ Тэнхлэгийн шошго ХЭЗЭЭ Ч ТАСРАХГҮЙ (хэрэглэгч 2026-10-22, хагас
          өргөнд "2…" болж байв): нэг баганад шахахын оронд өргөнд багтах
          тоогоор сийрэгжиж, бүтнээрээ, ирмэгт хавчигдаж бичигдэнэ. */}
      <div className="relative mt-1 h-4 border-t border-line">
        {ticks.map((i) => {
          const text = tick(vals[i].label);
          const tw = text.length * TICK_CH;
          const at =
            w > 0
              ? Math.min(Math.max((x(i) / 100) * w - tw / 2, 0), w - tw)
              : null;
          return (
            <span
              key={vals[i].key}
              className={cn(
                "num absolute top-0.5 whitespace-nowrap text-[10px] leading-none text-ink-3",
                at == null && "-translate-x-1/2",
              )}
              style={{ left: at == null ? `${x(i)}%` : at }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </SheetSection>
  );
}
