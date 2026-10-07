"use client";

import * as React from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

/*
  ⚠⚠ ИНДИКАТОР нь ЦАГ АГААРЫН АЖИГЛАЛТЫН ХЭМЖИХ ХЭРЭГСЭЛТЭЙ НЭГ
  ХЭЛБЭРТЭЙ (2026-10-05, хэрэглэгч: "цаг агаарын ажиглалтын
  индикаторыг хараад бусдыг нь зас"). Урьд нь нэг картын дотор
  `divide-x`-ээр хуваагдсан нүднүүд байв. Одоо `.observation-metric`-
  тэй адил: тус бүр өөрийн хүрээтэй жижиг карт, агуулга нь голлоно,
  шошго том үсгээр. Хэмжээсүүд `workspace.css`-д.
*/
export function StatStrip({ children }: { children: React.ReactNode }) {
  return <div className="ue-stat-grid">{children}</div>;
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
    <div className="ue-stat">
      <Icon size={20} strokeWidth={1.6} aria-hidden />
      <div>
        {/* Шошго НЭГ мөрөнд — халивал тайрагдана, бүтнээрээ `title`-д */}
        <span className="ue-stat-label" title={label}>{label}</span>
        <span className="ue-stat-line">
          <span className="ue-stat-value num">{value}</span>
          {sub ? <span className="ue-stat-sub num">{sub}</span> : null}
        </span>
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
   ӨНГӨ · нэр; товшиход тухайн ангиллаар шүүнэ — тайлбар нь
   зөвхөн уншигдах биш, диаграмтай нэг зан төлөвтэй. Идэвхтэй сонголт
   байхад бусад мөр бүдгэрнэ.

   `modes` өгвөл толгойд нь өнгөний горим сэлгэх товчнууд гарна
   ("Эрхийн хэлбэр | Талбайн хэмжээ") — нэг зураг сэдвийнхээ хэд хэдэн
   талыг харуулж болно.
   -------------------------------------------------------------------------- */

/*
  ТАНИХ ТЭМДГИЙН БҮРХҮҮЛ — НУУЖ, ГАРГАДАГ (хэрэглэгч, 2026-10-06:
  "таних тэмдэг дээр hide unhide хийдэг болго" → "тайлбарыг бүхэлд нь
  нууна"). Толгойн товч нүдний тэмдэгтэй: нээлттэй үед "нуух"
  (EyeOff), нуугдсан үед зөвхөн жижиг товч үлдэж "харуулах" (Eye).
  Урьд нь `<details>` байсан — хураах боломж байсан ч тэмдэггүй тул
  олдохгүй байв.
  ⚠ Хэлтсийн хоёр тайлбар (энэ `MapLegend`, давхаргын табуудын
  `TopicMapLegend`) ХОЁУЛАА энэ бүрхүүлийг хэрэглэнэ — нэг зан төлөв.
*/
export function LegendShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className={cn("ue-map-legend", !open && "is-hidden")}>
      <button
        type="button"
        className="ue-map-legend-toggle"
        aria-expanded={open}
        title={open ? "Таних тэмдгийг нуух" : "Таних тэмдгийг харуулах"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <EyeOff size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
        <span>Таних тэмдэг</span>
      </button>
      {open ? children : null}
    </div>
  );
}

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
  /*
    ⚠⚠ БҮТЭЦ нь давхаргын табуудын `TopicMapLegend`-тэй
    (layer-presentation.tsx) ИЖИЛ (2026-10-05, хэрэглэгч: "map legend
    янзал"). Урьд нь өөр гарчигтай ("Газрын зургийн таних тэмдэг"),
    өөрийн хэмжээс, мөр бүрийн ард ТООТОЙ байсан тул нэг хэлтсийн
    табуудын тайлбар хоёр өөр харагдаж байв. Тоо хасагдсан шалтгаан нь
    тэндхийнхтэй адил: тайлбарын асуулт "энэ өнгө юу вэ" — тоо нь
    диаграмд аль хэдийн бий. Хэлбэрийг платформын `.ue-map-legend`
    (app/workspace.css) эзэмшинэ; товшдог мөр, горимын товч нь
    `unelgee/workspace.css`-д.
  */
  return (
    <LegendShell>
      <div className="ue-map-legend-body">
        <section>
          <h3>{title}</h3>
          {modes && modes.length > 1 ? (
            <div className="ue-legend-modes">
              {modes.map((m) => (
                <button key={m.id} type="button" aria-pressed={m.id === mode} onClick={() => onMode?.(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}
          {items.map((it) => {
            const on = selected === it.key;
            const dim = selected != null && !on;
            return (
              <button
                key={it.key}
                type="button"
                aria-pressed={on}
                disabled={!onSelect}
                onClick={() => onSelect?.(on ? null : it.key)}
                title={it.label}
                className="ue-legend-row is-pick"
                style={{ opacity: dim ? 0.45 : 1 }}
              >
                <span aria-hidden className="ue-map-symbol is-area" style={{ color: it.color }} />
                <span>{it.label}</span>
              </button>
            );
          })}
        </section>
      </div>
    </LegendShell>
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
