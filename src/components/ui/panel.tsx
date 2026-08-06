import * as React from "react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Panel — үндсэн агуулгын хайрцаг.
   Сүүдэр байхгүй. Зөвхөн 1px зураас + цаасан өнгө. Булан бараг хурц.
   -------------------------------------------------------------------------- */

export function Panel({
  className,
  flush,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return (
    <div
      className={cn(
        "border border-line bg-paper-2 rounded-xs",
        !flush && "overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHead({
  title,
  eyebrow,
  action,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-end justify-between gap-4 border-b border-line px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <h2 className="display text-[15px] leading-tight text-ink">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PanelBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

/* --------------------------------------------------------------------------
   SectionHeader — хуудсан доторх бүлгийн тэмдэглэгээ
   -------------------------------------------------------------------------- */

export function SectionHeader({
  index,
  title,
  note,
}: {
  index: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="mb-3.5 flex items-baseline gap-3 border-b border-line pb-2.5">
      <span className="num text-[10.5px] text-ink-3">{index}</span>
      <h2 className="display text-[17px] leading-none">{title}</h2>
      {note ? (
        <span className="ml-auto text-[11px] text-ink-3">{note}</span>
      ) : null}
    </div>
  );
}
