/*
  ДҮН ШИНЖИЛГЭЭНИЙ ХУВААЛЦСАН ХЭСГҮҮД

  Гурван харагдац (хотын тархалт, нэвчилтийн зүсэлт, үерийн загвар) нэг
  л хэв маягаар зурагдана — карт, үзүүлэлтийн нүд, талбарын мөр гурвыг
  тусад нь бичвэл эрт орой зөрнө.
*/
import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({
  title,
  action,
  grow,
  children,
}: {
  title: string;
  /** Толгойн баруун талд суух нэмэлт удирдлага */
  action?: React.ReactNode;
  /**
   * Баганын ҮЛДСЭН өндрийг эзлэх эсэх.
   *
   * ⚠ Тогтмол өндөртэй карт (матриц, тайлбар) сунгавал доороо хоосон
   * талбай үүрнэ. Баганын илүү зайг ДООД карт авбал багана дүүрнэ.
   */
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "analytics-chart-card flex flex-col rounded-xs border border-line bg-paper-2",
        grow ? "min-h-0 flex-1" : "shrink-0",
      )}
    >
      <div className="analytics-chart-head">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="analytics-chart-body">{children}</div>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-[0.08em] text-ink-3 uppercase">
        {label}
      </dt>
      <dd className="num mt-[2px] text-[12.5px] text-ink">{value}</dd>
    </div>
  );
}

export function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="analytics-stat">
      <span className="analytics-stat-icon">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <span className="analytics-stat-label">{label}</span>
        <span className="analytics-stat-value">{value}</span>
      </div>
    </div>
  );
}
