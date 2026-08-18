"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database } from "lucide-react";
import { RailClose } from "@/components/shell/rail";
import { DEPARTMENTS } from "@/lib/departments";
import { cn, isActivePath } from "@/lib/utils";

const SYSTEM = [{ href: "/sources", label: "Дата эх сурвалж", icon: Database }];

const MIN_W = 232;
const MAX_W = 460;

export function Sidebar() {
  const pathname = usePathname();

  return (
    /* `rail-only` — хураасан үед CSS түүнийг бүрэн нуана (globals.css) */
    <aside className="rail-only fixed top-(--head-h) bottom-0 left-0 z-30 hidden w-(--rail-w) flex-col border-r border-line bg-paper-3 lg:flex">
      <nav className="flex-1 overflow-y-auto">
        {/* ---------------- Хэлтэс ---------------- */}
        <GroupHead label="Хэлтэс" trailing={<RailClose />} />

        <div className="border-y border-line">
          {DEPARTMENTS.map((d, i) => {
            const href = `/departments/${d.slug}`;
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={d.slug}
                href={href}
                aria-current={active ? "page" : undefined}
                style={{ "--tone": `var(${d.tone})` } as React.CSSProperties}
                className={cn(
                  /* Идэвхтэй мөр 3px-ээр баруун тийш түлхэгдэнэ — зүүн
                     захын заагчид зай гаргаж, мөр өөрөө бага зэрэг
                     "гарч ирсэн" мэт болно */
                  "group relative grid grid-cols-[16px_18px_1fr_auto] items-start gap-x-2 border-b border-line py-[7px] pr-2.5 transition-colors last:border-b-0",
                  active ? "tinted bg-paper-hi pl-[15px]" : "pl-3 hover:bg-paper-hi",
                )}
              >
                {/*
                  Идэвхтэй заагч.

                  Гурван дохио ЗЭРЭГ ажиллана: зузаан өнгөт зураас, илүү
                  цайвар дэвсгэр, хэлтсийн өнгөөр будагдсан дугаар, икон.
                  Ганц нь ч гэсэн ажиллах ёстой — өнгө ялгахад бэрхшээлтэй
                  хүнд дэвсгэр, зузаан нь хангалттай.
                */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 bottom-0 left-0 bg-(--tone) transition-all",
                    active ? "w-[3px] opacity-100" : "w-[2px] opacity-0 group-hover:opacity-40",
                  )}
                />

                {/* Дугаар */}
                <span
                  className={cn(
                    "num mt-[2px] text-[10.5px] leading-none transition-colors",
                    active
                      ? "font-medium text-(--tone)"
                      : "text-ink-3 group-hover:text-ink-2",
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
                      ? { borderColor: "color-mix(in oklab, var(--tone) 55%, transparent)" }
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
                    "min-w-0 text-[13px] leading-[1.35] transition-colors",
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
            const active = isActivePath(pathname, it.href, true);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative grid grid-cols-[16px_18px_1fr] items-center gap-x-2 py-[7px] pr-2.5 transition-colors",
                  active ? "bg-paper-hi pl-[15px]" : "pl-3 hover:bg-paper-hi",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 bottom-0 left-0 bg-moss transition-all",
                    active ? "w-[3px] opacity-100" : "w-[2px] opacity-0 group-hover:opacity-40",
                  )}
                />
                <span className="num text-[10.5px] leading-none text-ink-3">·</span>
                <span
                  className={cn(
                    "flex size-[18px] items-center justify-center",
                    active && "text-moss",
                  )}
                >
                  <it.icon size={12} strokeWidth={1.75} />
                </span>
                <span
                  className={cn(
                    "truncate text-[13px]",
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

      <ResizeHandle />
    </aside>
  );
}

function GroupHead({ label, trailing }: { label: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="eyebrow">{label}</span>
      <span className="h-px flex-1 bg-line" />
      {trailing}
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
