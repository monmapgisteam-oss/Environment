"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { cn } from "@/lib/utils";

const SYSTEM = [{ href: "/sources", label: "Дата эх сурвалж", icon: Database }];

const MIN_W = 232;
const MAX_W = 460;

export function Sidebar() {
  const pathname = usePathname();
  const connected = DEPARTMENTS.filter((d) => d.status === "live").length;

  return (
    <aside className="fixed top-[52px] bottom-0 left-0 z-30 hidden w-(--rail-w) flex-col border-r border-line bg-paper-3 lg:flex">
      <nav className="flex-1 overflow-y-auto">
        {/* ---------------- Хэлтэс ---------------- */}
        <GroupHead label="Хэлтэс" count={DEPARTMENTS.length} />

        <div className="border-y border-line">
          {DEPARTMENTS.map((d, i) => {
            const href = `/departments/${d.slug}`;
            const active = pathname === href;
            return (
              <Link
                key={d.slug}
                href={href}
                style={{ "--tone": `var(${d.tone})` } as React.CSSProperties}
                className={cn(
                  "group relative grid grid-cols-[16px_18px_1fr_auto] items-start gap-x-2 border-b border-line py-[7px] pr-2.5 pl-3 transition-colors last:border-b-0",
                  active ? "tinted" : "hover:bg-paper-hi",
                )}
              >
                {/* Идэвхтэй заагч */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 bottom-0 left-0 w-[2px] bg-(--tone) transition-opacity",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                  )}
                />

                {/* Дугаар */}
                <span
                  className={cn(
                    "num mt-[2px] text-[9.5px] leading-none transition-colors",
                    active ? "text-(--tone)" : "text-ink-3 group-hover:text-ink-2",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Икон хайрцаг */}
                <span
                  className={cn(
                    "flex size-[18px] items-center justify-center rounded-[2px] border transition-colors",
                    active ? "tinted" : "border-transparent",
                  )}
                  style={
                    active
                      ? { borderColor: "color-mix(in oklab, var(--tone) 35%, transparent)" }
                      : undefined
                  }
                >
                  <d.icon
                    size={12}
                    strokeWidth={1.75}
                    className={cn(
                      "text-(--tone) transition-opacity",
                      active ? "opacity-100" : "opacity-60 group-hover:opacity-90",
                    )}
                  />
                </span>

                {/* Нэр */}
                <span
                  className={cn(
                    "min-w-0 text-[12px] leading-[1.35] transition-colors",
                    active ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink",
                  )}
                >
                  {d.name}
                </span>

                {/* Төлөв */}
                <span
                  title={d.status === "live" ? "Дата холбогдсон" : "Мэдээлэл хүлээгдэж буй"}
                  className={cn(
                    "mt-[4px] size-1 shrink-0 rounded-full",
                    d.status === "live" ? "bg-moss" : "border border-line-2",
                  )}
                />
              </Link>
            );
          })}
        </div>

        {/* ---------------- Систем ---------------- */}
        <GroupHead label="Систем" />
        <div className="border-y border-line">
          {SYSTEM.map((it) => {
            const active = pathname.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "group relative grid grid-cols-[16px_18px_1fr] items-center gap-x-2 py-[7px] pr-2.5 pl-3 transition-colors",
                  active ? "bg-paper-hi" : "hover:bg-paper-hi",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 bottom-0 left-0 w-[2px] bg-moss transition-opacity",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                  )}
                />
                <span className="num text-[9.5px] leading-none text-ink-3">·</span>
                <span className="flex size-[18px] items-center justify-center">
                  <it.icon size={12} strokeWidth={1.75} />
                </span>
                <span
                  className={cn(
                    "truncate text-[12px]",
                    active ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink",
                  )}
                >
                  {it.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ---------------- Доод заалт ---------------- */}
      <div className="shrink-0 border-t border-line px-3 py-2.5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="eyebrow">Холболт</span>
          <span className="num text-[10.5px] text-ink-2">
            {connected}
            <span className="text-ink-3">/{DEPARTMENTS.length}</span>
          </span>
        </div>
        {/* Хэлтэс тус бүрд нэг сегмент */}
        <div className="flex gap-[3px]" aria-hidden>
          {DEPARTMENTS.map((d) => (
            <span
              key={d.slug}
              className={cn(
                "h-1 flex-1 rounded-[1px]",
                d.status === "live" ? "bg-moss" : "bg-line-2",
              )}
            />
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-ink-3">
          <span className="tracking-[0.14em] uppercase">Хувилбар</span>
          <span className="num">0.1.0 · alpha</span>
        </div>
      </div>

      <ResizeHandle />
    </aside>
  );
}

function GroupHead({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="eyebrow">{label}</span>
      <span className="h-px flex-1 bg-line" />
      {count !== undefined ? (
        <span className="num rounded-[2px] border border-line px-1 py-0.5 text-[9.5px] leading-none text-ink-3">
          {count}
        </span>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Өргөн тохируулах бариул.
   Өргөнийг `--rail-w` хувьсагчид бичнэ — гол агуулга мөн үүнээс уншдаг тул
   React state дамжуулах, дахин зурах шаардлагагүй.
   -------------------------------------------------------------------------- */
function ResizeHandle() {
  const [dragging, setDragging] = React.useState(false);

  function apply(px: number) {
    const w = Math.min(MAX_W, Math.max(MIN_W, Math.round(px)));
    document.documentElement.style.setProperty("--rail-w", `${w}px`);
    return w;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const move = (ev: PointerEvent) => apply(ev.clientX);
    const up = (ev: PointerEvent) => {
      const w = apply(ev.clientX);
      try {
        localStorage.setItem("railw", String(w));
      } catch {}
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Гарнаас: сум товчоор 16px-ээр тохируулна */
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const cur =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--rail-w"),
        10,
      ) || 288;
    const w = apply(cur + (e.key === "ArrowRight" ? 16 : -16));
    try {
      localStorage.setItem("railw", String(w));
    } catch {}
  }

  function onDoubleClick() {
    apply(288);
    try {
      localStorage.setItem("railw", "288");
    } catch {}
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Хажуугийн зурвасын өргөн"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      title="Чирж өргөнийг тохируулна · давхар товшилт: анхны хэмжээ"
      className={cn(
        "group absolute inset-y-0 -right-1 w-2 cursor-col-resize",
        dragging && "bg-moss/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-moss transition-opacity",
          dragging ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        )}
      />
    </div>
  );
}
