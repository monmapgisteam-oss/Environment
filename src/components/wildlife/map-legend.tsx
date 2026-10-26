"use client";

/*
  ГАЗРЫН ЗУРГИЙН ТАНИХ ТЭМДЭГ — амьтан, ургамлын хэлтсийн бүх зурагт НЭГ хэлбэр.

  Ногоон бүсийн (NBAHH) порталын самбарын `TopicMapLegend`-тэй ИЖИЛ
  хэлбэр, ижил CSS (`.ue-map-legend`, `workspace.css`): зүүн доод буланд
  хураагддаг "▾ ТАНИХ ТЭМДЭГ", дотор нь давхарга бүр гарчиг · мөр (өнгөт
  тэмдэг · нэр). Хэрэглэгч 2026-10-23: "мапуудыг янзлая" → "NBAHH шиг
  таних тэмдэг". Урьд нь самбар бүр өөр байрлал, өөр хэлбэрийн тайлбартай
  байв (зарим нь огт байхгүй).

  ⚠ Мөр бүр ЗӨВХӨН өнгө ба нэр — тоо БИЧИХГҮЙ (NBAHH-ын дүрэм).
  ⚠ `onToggle`-тэй мөр товч болно (коридорын нэгж талбар унтраах).
  ⚠ Өнгө нь зурагтай ЯГ ИЖИЛ эх сурвалжаас ирэх ёстой.
*/

import * as React from "react";
import { cn } from "@/lib/utils";

export type LegendItem = {
  key: string;
  label: string;
  /** hex эсвэл CSS хувьсагч (`var(--ochre)`) */
  color: string;
  shape?: "point" | "line" | "area";
  /** Унтраалттай мөр — `false` бол зураас дайрсан, бүдэг */
  on?: boolean;
  onToggle?: () => void;
};

export type LegendGroup = {
  key: string;
  /** Гарчиг — `solo` бол харагдахгүй, мөр нь өөрөө нэр */
  title?: string;
  /** "Өнгөөр ялгасан үзүүлэлт: …" */
  field?: string;
  items: LegendItem[];
};

export function MapLegend({ groups }: { groups: LegendGroup[] }) {
  const shown = groups.filter((g) => g.items.length);
  if (!shown.length) return null;
  return (
    <details open className="ue-map-legend">
      <summary>Таних тэмдэг</summary>
      <div className="ue-map-legend-body">
        {shown.map((g) => (
          <section key={g.key} className={g.title ? undefined : "is-solo"}>
            {g.title ? <h3>{g.title}</h3> : null}
            {g.title && g.field ? <p>Өнгөөр ялгасан үзүүлэлт: {g.field}</p> : null}
            {g.items.map((it) => {
              const sym = (
                <span
                  aria-hidden="true"
                  className={cn(
                    "ue-map-symbol",
                    it.shape === "line" ? "is-line" : it.shape === "area" ? "" : "is-point",
                  )}
                  style={{ color: it.color, opacity: it.on === false ? 0.35 : 1 }}
                />
              );
              const name = (
                <span title={it.label} className={cn(it.on === false && "line-through")}>
                  {it.label}
                </span>
              );
              return it.onToggle ? (
                <button
                  key={it.key}
                  type="button"
                  onClick={it.onToggle}
                  aria-pressed={it.on !== false}
                  className="ue-legend-row w-full text-left hover:text-ink"
                >
                  {sym}
                  {name}
                </button>
              ) : (
                <div key={it.key} className="ue-legend-row">
                  {sym}
                  {name}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </details>
  );
}
