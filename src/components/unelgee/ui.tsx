"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn, num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Байгаль орчны үнэлгээ, уур амьсгалын өөрчлөлтийн хэлтсийн самбаруудын
   ХУВААЛЦСАН хэсгүүд.

   Хоёр өөрийн самбар (ерөнхий үнэлгээ, менежментийн төлөвлөгөө) урьд нь
   карт, толгой, индикатор, талбарын мөрийг тус тусдаа хуулж бичсэн байв
   — нэг газар засвал нөгөө нь хоцордог. 2026-09-18-ны дахин бичилтээр
   (хэрэглэгч: "бүх самбарын UI-г дахин бич") нэг файлд нэгтгэв.

   Индикаторын хэлбэр нь хүрээлэн буй орчны хэлтэст хэрэглэгчийн
   тохируулсан хэвээр: икон 32px хэлтсийн өнгөөр, нэр 11px, утга 18px,
   агуулга нүдэндээ голлоно. Хэлтсийн өнгө `--tone` хувьсагчаар эцэг
   элементээс ирнэ.
   -------------------------------------------------------------------------- */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("ue-card flex flex-col border border-line bg-paper-2", className)}>
      {children}
    </div>
  );
}

export function Head({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="ue-card-head flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
      <h2 className="display text-[13.5px] leading-none tracking-[0.06em] uppercase">{title}</h2>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Утгын доорх нэг мөр — хамрах хүрээ, харьцаа */
  sub?: string;
}) {
  return (
    <div className="ue-stat flex items-center gap-2 px-2.5 py-2">
      <Icon size={32} strokeWidth={1.3} className="shrink-0 text-(--tone)" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="ue-stat-label text-ink-3">{label}</span>
        <span className="ue-stat-value num font-medium text-ink">{value}</span>
        {sub ? <span className="num truncate text-[10.5px] leading-tight text-ink-3">{sub}</span> : null}
      </div>
    </div>
  );
}

/** Бичлэгийн дэлгэрэнгүйн нэг мөр — нэр зүүнд, утга баруунд */
export function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[108px] shrink-0 text-[10px] leading-snug tracking-[0.06em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink">{v}</dd>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ГАЗРЫН ЗУРГИЙН ТАЙЛБАР (legend)

   Зургийн зүүн доод буланд, масштабын заалтын дээр хөвнө. Мөр бүр
   ӨНГӨ · нэр · тоо; товшиход тухайн ангиллаар шүүнэ — тайлбар нь
   зөвхөн уншигдах биш, диаграмтай нэг зан төлөвтэй. Идэвхтэй сонголт
   байхад бусад мөр бүдгэрнэ.

   `modes` өгвөл толгойд нь өнгөний горим сэлгэх товчнууд гарна
   ("Эрхийн хэлбэр | Талбайн хэмжээ") — нэг зураг сэдвийнхээ хэд хэдэн
   талыг харуулж болно.
   -------------------------------------------------------------------------- */

export type LegendItem = { key: string; label: string; color: string; count: number };

export function MapLegend({
  title,
  items,
  selected,
  onSelect,
  modes,
  mode,
  onMode,
}: {
  title: string;
  items: LegendItem[];
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  modes?: readonly { id: string; label: string }[];
  mode?: string;
  onMode?: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <details open className="ue-map-legend">
      <summary>Газрын зургийн таних тэмдэг</summary>
      <div className="border-b border-line px-2 py-1.5">
        <div className="eyebrow">{title}</div>
        {modes && modes.length > 1 ? (
          <div className="mt-1 flex gap-1">
            {modes.map((m) => {
              const on = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onMode?.(m.id)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-xs border px-1.5 py-0.5 text-[10px] leading-none transition-colors",
                    on
                      ? "border-data/45 bg-data/10 text-ink"
                      : "border-line text-ink-3 hover:border-line-2 hover:text-ink",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="max-h-[180px] overflow-y-auto px-1 py-1">
        {items.map((it) => {
          const dim = selected != null && selected !== it.key;
          const on = selected === it.key;
          return (
            <button
              key={it.key}
              type="button"
              aria-pressed={on}
              disabled={!onSelect}
              onClick={() => onSelect?.(on ? null : it.key)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-xs px-1 py-[3px] text-left transition-colors",
                onSelect && "hover:bg-paper-hi",
                on && "bg-paper-hi",
              )}
              style={{ opacity: dim ? 0.45 : 1 }}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-paper-2"
                style={{ background: it.color }}
              />
              <span className="min-w-0 flex-1 text-[11px] leading-snug text-ink-2">{it.label}</span>
              <span className="num shrink-0 text-[10.5px] leading-none text-ink-3">{num(it.count)}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

/** Ачаалж буй, эсвэл алдаатай төлөв — хоёр самбар ижил */
export function Pending({ error, text }: { error: string | null; text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
      {error ? (
        <div className="text-center">
          <p className="text-[14px] font-medium">Эх сурвалжийн мэдээллийг татаж чадсангүй</p>
          <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
        </div>
      ) : (
        <span className="text-[13.5px] text-ink-3">{text}</span>
      )}
    </div>
  );
}
