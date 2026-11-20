import * as React from "react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Panel — үндсэн агуулгын хайрцаг.
   Нимгэн хүрээ, зөөлөн булантай нийтлэг панель.
   -------------------------------------------------------------------------- */

export function Panel({
  className,
  flush,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return (
    <div
      className={cn(
        "border border-line bg-paper-2 rounded-xl",
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
        <h2 className="display text-[16px] leading-tight text-ink">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}


/* --------------------------------------------------------------------------
   SectionHeader — хуудсан доторх бүлгийн тэмдэглэгээ
   -------------------------------------------------------------------------- */
