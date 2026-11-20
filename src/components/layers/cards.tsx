"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Layers3 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * ДАВХАРЛАСАН КАРТЫН ПЕЙЖЕР ({@link Breakdown.behind}) — "‹ 1 / 3 ›".
 *
 * ArcGIS Dashboards-ийн stacked element-ийн сэлгэгч: нэг суудалд хэд
 * хэдэн диаграм, хэрэглэгч эргүүлж харна. Бүх диаграмын нэр `title`-д —
 * ард нь юу байгааг товшихгүйгээр уншина. Эргэлдэнэ: сүүлчийнхээс
 * дараагийнх нь эхнийх. Тоо `.num`.
 */
export function StackPager({
  n,
  at,
  titles,
  onChange,
}: {
  n: number;
  at: number;
  titles: string[];
  onChange: (i: number) => void;
}) {
  const go = (d: number) => onChange((at + d + n) % n);
  const btn =
    "rounded-[2px] border border-line-2 p-[2px] text-ink-3 transition-colors hover:text-ink";
  return (
    <div
      className="flex shrink-0 items-center gap-1"
      title={titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}
    >
      <button
        type="button"
        aria-label="Өмнөх диаграм"
        className={btn}
        onClick={() => go(-1)}
      >
        <ChevronLeft size={11} strokeWidth={1.8} />
      </button>
      <span className="num text-[10.5px] whitespace-nowrap text-ink-3">
        {at + 1} / {n}
      </span>
      <button
        type="button"
        aria-label="Дараагийн диаграм"
        className={btn}
        onClick={() => go(1)}
      >
        <ChevronRight size={11} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function CutCard({
  title,
  tone,
  first,
  weight = 1,
  meta,
  action,
  full,
  fill,
  fit,
  source,
  bare,
  low,
  children,
}: {
  title: string;
  tone: string;
  /**
   * БҮТЭН харагдана — агшихгүй, дотроо гүйхгүй (`.is-full`). Баганын
   * өндрийг бусад карттай хуваалцахгүй; бусад нь үлдсэн зайг авна.
   */
  full?: boolean;
  /**
   * Баганын ҮЛДСЭН өндрийг бүтнээр эзэлнэ (`.is-fill`) — агуулга нь
   * өөрөө хэмжиж багтана ({@link ParcelCard}).
   */
  fill?: boolean;
  /**
   * `fill` картыг АГУУЛГЫНХАА өндөрт буцаана (`.is-fit`) — бүх мөр
   * багтсан үед. Ингэснээр карт хэзээ ч хоосон зайгаар сунахгүй.
   */
  fit?: boolean;
  /** Давхаргын ЭХНИЙ карт — туузандаа наалдаж, бүлгээ эхлүүлнэ */
  first?: boolean;
  /**
   * ӨНДРИЙН ЖИН — агуулгын хэмжээгээр (хэрэглэгч, 2026-09-24:
   * "чартуудыг scroll-гүй харагддаг болгоорой").
   *
   * Урьд нь картууд үлдсэн өндрийг ТЭНЦҮҮ хуваадаг байсан
   * тул дөрвөн зүсэмтэй бөгж доороо хоосон зай үлдээж байхад
   * арван мөртэй зурвас тэртэй АДИЛ өндөрт шахагдаж гүйлгүүр
   * гаргадаг байв. Жин нь мөрийн тооноос гарна: үлдсэн өндөр
   * АГУУЛГЫН ХЭРЭГЦЭЭГЭЭР хуваарилагдана.
   */
  weight?: number;
  /**
   * Толгойн БАРИМТЫН мөр — нийт дүн ба ангиллын тоо.
   *
   * Урьд нь карт зөвхөн гарчигтай байсан тул "энэ диаграм хэдийг
   * хуваарилж байна вэ" гэдэг нь зурвасуудыг нүдээр нэмж байж л
   * мэдэгддэг байв.
   */
  meta?: string;
  action?: React.ReactNode;
  /** Гарчгийн хулганы тайлбар — давхарга ба эх сурвалжийн талбарын нэр */
  source?: string;
  /** Гарчгийн мөр ГАРАХГҮЙ — биеийн эхний мөр (тайлбар) толгойн үүрэг гүйцэтгэнэ */
  bare?: boolean;
  /**
   * `fill` картын доод өндөр 220 → 150px (`.is-low`) — задарсан тэнхлэгийн
   * урт жагсаалт ({@link LayerSet.unfold}) дотроо гүйж, БАГАНА гүйхгүй
   * (хэрэглэгч 2026-10-23, ойн ТХГН: "ih scrolltoi").
   */
  low?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "analytics-chart-card flex min-h-0 flex-col rounded-xl border border-line bg-paper-2",
        first && "border-t-2",
        full && "is-full",
        fill && "is-fill",
        fill && fit && "is-fit",
        fill && low && "is-low",
      )}
      style={
        {
          /*
            ⚠⚠ `full`/`fill` картад ЖИН ТАВИХГҮЙ (хэрэглэгч, 2026-10-06,
            зургаар: "энэ дунд хоосон зай гарахгүй"). Inline `flexGrow`
            нь CSS-ийн `.is-full { flex: 0 0 auto }`-г ДАРДАГ тул
            бүсийн карт 6 жингээрээ сунаж, гурван мөрийн доор хагас
            баганын хоосон зай үүсгэн нэгж талбарын картыг ёроол руу
            шахаж байв. Тэдний өндрийг CSS бүрэн эзэмшинэ.
          */
          ...(full || fill ? null : { flexGrow: weight }),
          /*
            ДООД ӨНДӨР нь мөн АГУУЛГЫН ХЭРЭГЦЭЭГЭЭР (2026-09-25).
            168px гэсэн ТОГТМОЛ шал нь ганц мөртэй картад ч
            хамаардаг байсан тул нэг тоо харуулах карт бүтэн
            диаграмын өндрийг эзэлж, урт диаграмыг баганаас
            шахаж гаргадаг байв. Шал нь одоо жингээ дагана —
            дээд хязгаар нь хэвээр 168px.
          */
          "--card-min": `${Math.min(168, 70 + weight * 26)}px`,
          ...(first ? { borderTopColor: tone } : null),
        } as React.CSSProperties
      }
    >
      {bare ? null : (
        <div className="analytics-chart-head">
          <h2
            className="text-ink"
            title={source ? `${title}\n${source}` : title}
          >
            {title}
          </h2>
          {meta ? (
            <span className="num shrink-0 text-[10.5px] whitespace-nowrap text-ink-3">
              {meta}
            </span>
          ) : null}
          {action}
        </div>
      )}
      <div className="analytics-chart-body">{children}</div>
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "data-surface flex flex-col rounded-xl border border-line bg-paper-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Хэсгийн толгой.
 *
 * Өнгөт зураас нь `ChartCard`-д — диаграмын карт зурвас дотор өөрийн
 * толгойтой бөгөөд тэнд өнгө нь давхаргыг зурагтай холбоно.
 */
export function Head({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
      <h2 className="display min-w-0 truncate text-[13px] leading-snug">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  /** Тооны ард бүдэг нэмэлт утга ("120,345 га") */
  sub?: string;
  icon: typeof Layers3;
}) {
  return (
    <div className="analytics-stat">
      <span className="analytics-stat-icon">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <span className="analytics-stat-label">{label}</span>
        <span className="analytics-stat-value">
          {value}
          {sub ? <span className="analytics-stat-sub">{sub}</span> : null}
        </span>
      </div>
    </div>
  );
}
