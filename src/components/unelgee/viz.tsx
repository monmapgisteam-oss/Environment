"use client";

import * as React from "react";
import { cn, num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Байгаль орчны үнэлгээ, уур амьсгалын өөрчлөлтийн хэлтсийн ӨӨРИЙН
   диаграмууд (2026-09-18, хэрэглэгч: "самбарын бүтэц, харагдах байдал
   огт таалагдахгүй, диаграмууд нь ойлгомжгүй, нэг хэвийн — шинээр бич").

   Платформын бусад хэлтэс "жагсаалт · зураг · мөрөн диаграм" гэсэн нэг
   хэвтэй. Энэ хэлтэст мөрөн диаграм ОГТ ХЭРЭГЛЭХГҮЙ; оронд нь гурван
   өөр хэлбэр:

   · `Matrix` — ХОЁР ХЭМЖЭЭСИЙН ХҮСНЭГТ (дулааны хүснэгт): мөр нь
     сонгосон ангилал, багана нь дүүрэг, нүд нь тоо ба дүүргэлтийн
     нягт. "Аль дүүрэгт ямар чиглэл давамгайлж байна" гэдэг нь хоёр
     тусдаа мөрөн диаграмаас ХЭЗЭЭ Ч уншигддаггүй байсан — нэг
     хүснэгтээс шууд харагдана. Мөр, багана, нүд бүр товшигдож шүүнэ.
   · `Composition` — 100%-ийн НЭГ ЗУРВАС: цөөн ангиллын харьцаа
     (эзэмших / өмчлөх / ашиглах). Бөгжнөөс ялгаатай нь хэсгүүд нэг
     шулуун дээр тул хэмжээгээрээ шууд харьцуулагдана.
   · `Table` — бичлэгийн ХҮСНЭГТ (хэрэгжүүлэгч, тоо, талбай, задаргаа):
     нэг мөр хэдэн тоо зэрэг үүрдэг үед мөрөн диаграм нэгийг нь л
     хэлдэг.
   -------------------------------------------------------------------------- */

export type Key = { key: string; label: string };

/* ============================== MATRIX ================================= */

export function Matrix({
  rows,
  cols,
  cell,
  rowSel,
  colSel,
  onRow,
  onCol,
  onCell,
  colorOf,
  unit = "",
}: {
  rows: Key[];
  cols: Key[];
  /** Нүдний утга — мөр × багана */
  cell: (row: string, col: string) => number;
  rowSel: string | null;
  colSel: string | null;
  onRow: (k: string | null) => void;
  onCol: (k: string | null) => void;
  /** Нүд товшиход хоёр шүүлт зэрэг */
  onCell?: (row: string, col: string) => void;
  /** Мөрийн өнгө — зурагтай ижил өнгө үзүүлэх үед */
  colorOf?: (row: string) => string;
  unit?: string;
}) {
  const grid = React.useMemo(() => {
    const g = rows.map((r) => cols.map((c) => cell(r.key, c.key)));
    const rowTotal = g.map((line) => line.reduce((s, v) => s + v, 0));
    const colTotal = cols.map((_, j) => g.reduce((s, line) => s + line[j], 0));
    const max = Math.max(1, ...g.flat());
    return { g, rowTotal, colTotal, max, total: rowTotal.reduce((s, v) => s + v, 0) };
  }, [rows, cols, cell]);

  if (!rows.length || !cols.length) return <div className="chart-empty">Үзүүлэлт байхгүй</div>;

  const dimRow = (k: string) => rowSel != null && rowSel !== k;
  const dimCol = (k: string) => colSel != null && colSel !== k;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <p className="ue-matrix-help">Нүдний тоо: {unit || "бүртгэл"}. Өнгө тодрох тусам утга ихэснэ. Мөр, багана эсвэл нүд дээр дарж шүүнэ.</p>
      <table className="ue-matrix w-full border-separate border-spacing-0 text-[11px]">
        <caption className="sr-only">Дүүрэг болон сонгосон ангиллаар харьцуулсан {unit}</caption>
        <thead className="sticky top-0 z-10 bg-paper-2">
          <tr>
            <th className="sticky left-0 z-20 bg-paper-2 border-b border-r border-line px-2 py-1.5 text-left font-normal">
              <span className="eyebrow">{unit}</span>
            </th>
            {cols.map((c) => (
              <th key={c.key} className="border-b border-line p-0 align-bottom">
                <button
                  type="button"
                  aria-pressed={colSel === c.key}
                  onClick={() => onCol(colSel === c.key ? null : c.key)}
                  className={cn(
                    "block w-full px-1 py-1.5 text-center text-[10px] leading-tight font-medium transition-colors hover:bg-paper-hi",
                    colSel === c.key ? "text-ink" : "text-ink-2",
                  )}
                  style={{ opacity: dimCol(c.key) ? 0.4 : 1 }}
                >
                  {c.label}
                </button>
              </th>
            ))}
            <th className="border-b border-l border-line px-2 py-1.5 text-right text-[10px] font-normal text-ink-3">
              Нийт
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <th
                className="sticky left-0 z-10 max-w-[150px] border-b border-r border-line bg-paper-2 p-0 text-left font-normal"
                style={{ opacity: dimRow(r.key) ? 0.4 : 1 }}
              >
                <button
                  type="button"
                  aria-pressed={rowSel === r.key}
                  onClick={() => onRow(rowSel === r.key ? null : r.key)}
                  className={cn(
                    "flex w-full items-center gap-1.5 px-2 py-1.5 text-left leading-tight transition-colors hover:bg-paper-hi",
                    rowSel === r.key ? "font-medium text-ink" : "text-ink-2",
                  )}
                >
                  {colorOf ? (
                    <i
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ background: colorOf(r.key) }}
                    />
                  ) : null}
                  <span className="min-w-0">{r.label}</span>
                </button>
              </th>
              {cols.map((c, j) => {
                const v = grid.g[i][j];
                const t = v / grid.max;
                const faded = dimRow(r.key) || dimCol(c.key);
                return (
                  <td key={c.key} className="border-b border-line p-0">
                    <button
                      type="button"
                      aria-label={`${r.label}, ${c.label}: ${num(v)} ${unit}`}
                      disabled={!onCell || v === 0}
                      onClick={() => onCell?.(r.key, c.key)}
                      className={cn(
                        "num block h-full w-full px-1 py-1.5 text-center transition-opacity",
                        v ? "text-ink" : "text-ink-3",
                        onCell && v ? "hover:outline hover:outline-1 hover:outline-data/60" : "",
                      )}
                      style={{
                        /* Дүүргэлт нь утгын нягт — тэг нүд хоосон, хамгийн
                           их нь бараг бүтэн; шугаман биш квадрат язгуур,
                           эс тэгвээс цөөн том утга бусдыг бүдгэрүүлнэ */
                        background: v
                          ? `color-mix(in oklab, var(--data) ${Math.round(10 + Math.sqrt(t) * 55)}%, transparent)`
                          : undefined,
                        opacity: faded ? 0.3 : 1,
                      }}
                    >
                      {v ? num(v) : "·"}
                    </button>
                  </td>
                );
              })}
              <td
                className="num border-b border-l border-line px-2 py-1.5 text-right font-medium text-ink"
                style={{ opacity: dimRow(r.key) ? 0.4 : 1 }}
              >
                {num(grid.rowTotal[i])}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th className="sticky left-0 z-10 border-r border-line bg-paper-2 px-2 py-1.5 text-left text-[10px] font-normal text-ink-3">
              Нийт
            </th>
            {cols.map((c, j) => (
              <td
                key={c.key}
                className="num px-1 py-1.5 text-center font-medium text-ink"
                style={{ opacity: dimCol(c.key) ? 0.4 : 1 }}
              >
                {num(grid.colTotal[j])}
              </td>
            ))}
            <td className="num border-l border-line px-2 py-1.5 text-right font-semibold text-ink">
              {num(grid.total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ============================ COMPOSITION ============================== */

export function Composition({
  data,
  colorOf,
  selected,
  onSelect,
  unit = "",
}: {
  data: { key: string; label: string; value: number }[];
  colorOf: (key: string) => string;
  selected: string | null;
  onSelect: (k: string | null) => void;
  unit?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="chart-empty">Үзүүлэлт байхгүй</div>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-7 w-full overflow-hidden rounded-xs border border-line">
        {data.map((d) => {
          const share = d.value / total;
          const dim = selected != null && selected !== d.key;
          return (
            <button
              key={d.key}
              type="button"
              aria-label={`${d.label}: ${num(d.value)} ${unit}, ${(share * 100).toFixed(1)} хувь`}
              aria-pressed={selected === d.key}
              title={`${d.label} · ${num(d.value)} ${unit} · ${(share * 100).toFixed(1)}%`}
              onClick={() => onSelect(selected === d.key ? null : d.key)}
              className="num relative min-w-0 overflow-hidden text-[10.5px] font-medium text-[#0c1719] transition-opacity"
              style={{
                flex: `${share} 1 0`,
                background: colorOf(d.key),
                opacity: dim ? 0.3 : 1,
              }}
            >
              {share > 0.12 ? `${(share * 100).toFixed(0)}%` : ""}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {data.map((d) => {
          const dim = selected != null && selected !== d.key;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={selected === d.key}
              onClick={() => onSelect(selected === d.key ? null : d.key)}
              className="flex items-center gap-1.5 text-[11px] leading-none transition-opacity"
              style={{ opacity: dim ? 0.4 : 1 }}
            >
              <i aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ background: colorOf(d.key) }} />
              <span className={cn(selected === d.key ? "font-medium text-ink" : "text-ink-2")}>{d.label}</span>
              <span className="num text-ink-3">
                {num(d.value)} · {((d.value / total) * 100).toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =============================== TABLE ================================= */

export type Column<T> = {
  key: string;
  label: string;
  /** Тоон багана баруун тийш эгнэнэ */
  num?: boolean;
  render: (row: T) => React.ReactNode;
  /** Хэмжигчийн зураас — мөрийн доод ирмэгт, баганын дээд утгатай харьцуулж */
  meter?: (row: T) => number;
  className?: string;
};

export function Table<T>({
  rows,
  columns,
  keyOf,
  selected,
  onSelect,
}: {
  rows: T[];
  columns: Column<T>[];
  keyOf: (row: T) => string;
  selected: string | null;
  onSelect: (k: string | null) => void;
}) {
  const maxes = React.useMemo(
    () => columns.map((c) => (c.meter ? Math.max(1, ...rows.map((r) => c.meter!(r))) : 0)),
    [columns, rows],
  );
  if (!rows.length) return <div className="chart-empty">Үзүүлэлт байхгүй</div>;
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-[11px]">
        <thead className="sticky top-0 z-10 bg-paper-2">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "border-b border-line px-2 py-1.5 text-[10px] font-normal tracking-[0.06em] text-ink-3 uppercase",
                  c.num ? "text-right" : "text-left",
                  c.className,
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = keyOf(r);
            const on = selected === k;
            const dim = selected != null && !on;
            return (
              <tr
                key={k}
                tabIndex={0}
                aria-selected={on}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(on ? null : k);
                  }
                }}
                onClick={() => onSelect(on ? null : k)}
                className={cn("cursor-pointer transition-colors hover:bg-paper-hi", on && "bg-paper-hi")}
                style={{ opacity: dim ? 0.45 : 1 }}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "relative border-b border-line px-2 py-1.5 align-top",
                      c.num ? "num text-right text-ink" : "text-ink-2",
                      on && !c.num && "font-medium text-ink",
                      c.className,
                    )}
                  >
                    {c.render(r)}
                    {c.meter ? (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-2 h-[2px] rounded-full bg-data"
                        style={{
                          width: `calc((100% - 16px) * ${c.meter(r) / maxes[i]})`,
                          opacity: 0.55,
                        }}
                      />
                    ) : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============================ SEGMENT TOGGLE =========================== */

/** Диаграмын толгойд хэмжээс сэлгэх жижиг товчнууд */
export function Segments<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            className={cn(
              "rounded-xs border px-1.5 py-0.5 text-[10px] leading-none transition-colors",
              on ? "border-data/45 bg-data/10 text-ink" : "border-line text-ink-3 hover:border-line-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
