"use client";

import * as React from "react";

type Datum = { key: string; label: string; value: number };
type Kind = "columns" | "dots" | "composition";
const COLORS = ["#68cddd", "#b5a2ef", "#e8bc72", "#85c99e", "#ed9baf", "#84b2f0"];
const format = (v: number) => new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 2 }).format(v);

/** Different encodings share the same values and filtering contract. */
export function CategoryChart({ data, initial = "dots", unit, selected, onSelect, colorOf, allowShare = false, ordered = false }: {
  data: Datum[]; initial?: Kind; unit: string; selected: string[] | null;
  onSelect: (key: string) => void; colorOf?: (key: string) => string;
  allowShare?: boolean; ordered?: boolean;
}) {
  const [choice, setChoice] = React.useState<Kind | null>(null);
  const values = ordered ? data : [...data].sort((a, b) => b.value - a.value);
  const total = values.reduce((sum, d) => sum + d.value, 0);
  const share = allowShare && total > 0 && values.every((d) => d.value >= 0) && values.length <= 6;
  const kind = (choice ?? initial) === "composition" && !share ? "dots" : choice ?? initial;
  const lo = Math.min(0, ...values.map((d) => d.value));
  const hi = Math.max(1, ...values.map((d) => d.value));
  const at = (v: number) => (v - lo) / (hi - lo) * 100;
  const zero = at(0);
  const color = (d: Datum) => colorOf?.(d.key) ?? COLORS[Math.max(0, data.findIndex((v) => v.key === d.key)) % COLORS.length];
  const dim = (key: string) => selected?.length && !selected.includes(key) ? 0.35 : 1;
  if (!values.length) return <p className="chart-empty">Харуулах мэдээлэл байхгүй.</p>;
  return <div className="ue-subject-chart">
    <div className="ue-chart-toolbar"><span>{unit}</span><div aria-label="Графикийн төрөл">
      {([['columns', 'Багана'], ['dots', 'Цэг'], ...(share ? [['composition', 'Бүтэц']] : [])] as [Kind, string][]).map(([id, label]) => <button key={id} type="button" aria-pressed={kind === id} onClick={() => setChoice(id)}>{label}</button>)}
    </div></div>
    {kind === "columns" ? <div className="ue-column-scroll"><div className="ue-columns" style={{ minWidth: Math.max(240, values.length * 74) }}>
      <div className="ue-column-guides" aria-hidden="true"><span>{format(hi)}</span><span>{format((hi + lo) / 2)}</span><span>{format(lo)}</span></div>
      {values.map((d) => <button key={d.key} type="button" className="ue-column" aria-label={`${d.label}: ${format(d.value)} ${unit}`} aria-pressed={selected?.includes(d.key) ?? false} onClick={() => onSelect(d.key)} style={{ opacity: dim(d.key) }}>
        <span className="ue-column-plot"><i style={{ bottom: `${Math.min(at(d.value), zero)}%`, height: `${Math.abs(at(d.value) - zero)}%`, background: color(d) }} /><b style={{ bottom: `${at(d.value)}%` }}>{format(d.value)}</b><span className="ue-zero" style={{ bottom: `${zero}%` }} /></span>
        <span className="ue-column-label">{d.label}</span>
      </button>)}
    </div></div> : kind === "composition" ? <>
      <div className="ue-share-total"><strong>{format(total)}</strong><span>Нийт · {unit}</span></div>
      <div className="ue-share-strip">{values.filter((d) => d.value > 0).map((d) => <button key={d.key} type="button" aria-label={`${d.label}: ${format(d.value)}, ${(d.value / total * 100).toFixed(1)}%`} aria-pressed={selected?.includes(d.key) ?? false} onClick={() => onSelect(d.key)} style={{ flex: d.value, background: color(d), opacity: dim(d.key) }}>{d.value / total >= 0.12 ? `${(d.value / total * 100).toFixed(0)}%` : ""}</button>)}</div>
      <div className="ue-share-key">{values.map((d) => <button key={d.key} type="button" onClick={() => onSelect(d.key)} aria-pressed={selected?.includes(d.key) ?? false} style={{ opacity: dim(d.key) }}><i style={{ background: color(d) }} /><span>{d.label}</span><strong>{format(d.value)}</strong><small>{(d.value / total * 100).toFixed(1)}%</small></button>)}</div>
    </> : <div className="ue-dot-chart">
      <div className="ue-dot-axis"><span>{format(lo)}</span><span>{format((hi + lo) / 2)}</span><span>{format(hi)}</span></div>
      {values.map((d) => <button key={d.key} type="button" className="ue-dot-row" aria-pressed={selected?.includes(d.key) ?? false} onClick={() => onSelect(d.key)} style={{ opacity: dim(d.key) }}><span>{d.label}</span><span className="ue-dot-track"><i style={{ left: `${zero}%` }} /><b style={{ left: `${at(d.value)}%`, background: color(d) }} /></span><strong>{format(d.value)}</strong></button>)}
    </div>}
  </div>;
}

/** An observed zero is plotted; absent periods are never filled with invented data. */
export function TrendChart({ data, unit, selected, onSelect }: { data: Datum[]; unit: string; selected: string | null; onSelect: (key: string | null) => void }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => 35 + i / Math.max(1, data.length - 1) * 570;
  const y = (v: number) => 110 - v / max * 85;
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  if (!data.length) return <p className="chart-empty">Хугацааны мэдээлэл байхгүй.</p>;
  return <div className="ue-trend">
    <span className="ue-chart-note">{unit} · хугацааны өөрчлөлт</span>
    <svg viewBox="0 0 640 135" role="img" aria-label={`${unit}, хугацаагаар`}>
      {[0, max / 2, max].map((v) => <g key={v}><line x1="35" x2="605" y1={y(v)} y2={y(v)} stroke="var(--line-2)" /><text x="28" y={y(v) + 3} textAnchor="end" fill="var(--ink-3)" fontSize="9">{format(v)}</text></g>)}
      <polyline points={line} fill="none" stroke="var(--tone)" strokeWidth="2.5" />
      {data.map((d, i) => <g key={d.key} opacity={selected && selected !== d.key ? 0.35 : 1}><circle cx={x(i)} cy={y(d.value)} r="4" fill="var(--tone)" /><text x={x(i)} y={y(d.value) - 9} textAnchor="middle" fontSize="10" fill="var(--ink)">{format(d.value)}</text></g>)}
    </svg>
    <div className="ue-trend-labels">{data.map((d) => <button key={d.key} type="button" aria-pressed={selected === d.key} aria-label={`${d.label}: ${format(d.value)} ${unit}`} onClick={() => onSelect(selected === d.key ? null : d.key)}>{d.label}</button>)}</div>
  </div>;
}

export function StackedComparison({ rows, cols, cell, selectedRow, selectedCol, onSelect, colorOf }: {
  rows: { key: string; label: string }[]; cols: { key: string; label: string }[];
  cell: (r: string, c: string) => number; selectedRow: string | null; selectedCol: string | null;
  onSelect: (r: string | null, c: string | null) => void; colorOf: (key: string) => string;
}) {
  const totals = rows.map((r) => cols.reduce((n, c) => n + cell(r.key, c.key), 0));
  const max = Math.max(1, ...totals);
  if (!rows.length) return <p className="chart-empty">Харуулах мэдээлэл байхгүй.</p>;
  return <div className="ue-stacked-comparison">
    <div className="ue-stack-key">{cols.map((c) => <button key={c.key} type="button" aria-pressed={selectedCol === c.key} onClick={() => onSelect(selectedRow, selectedCol === c.key ? null : c.key)}><i style={{ background: colorOf(c.key) }} />{c.label}</button>)}</div>
    <p className="ue-chart-note">Урт нь төлөвлөгөөний тоо, өнгө нь мод тарих байршлыг илэрхийлнэ.</p>
    {rows.map((r, i) => <div key={r.key} className="ue-stack-row" style={{ opacity: selectedRow && selectedRow !== r.key ? 0.4 : 1 }}><button type="button" aria-pressed={selectedRow === r.key} onClick={() => onSelect(selectedRow === r.key ? null : r.key, selectedCol)}>{r.label}<strong>{format(totals[i])}</strong></button><div className="ue-stack-track"><div style={{ width: `${totals[i] / max * 100}%` }}>{cols.map((c) => { const value = cell(r.key, c.key); return value > 0 ? <button key={c.key} type="button" aria-label={`${r.label}, ${c.label}: ${format(value)} төлөвлөгөө`} title={`${c.label}: ${format(value)}`} aria-pressed={selectedRow === r.key && selectedCol === c.key} onClick={() => onSelect(selectedRow === r.key && selectedCol === c.key ? null : r.key, selectedRow === r.key && selectedCol === c.key ? null : c.key)} style={{ flex: value, background: colorOf(c.key), opacity: selectedCol && selectedCol !== c.key ? 0.3 : 1 }}>{value / max > 0.09 ? format(value) : ""}</button> : null; })}</div></div></div>)}
  </div>;
}
