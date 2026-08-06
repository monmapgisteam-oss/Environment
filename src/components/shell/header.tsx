"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Moon, Sun } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";

const LABELS: Record<string, string> = {
  "": "Ерөнхий самбар",
  map: "Газрын зураг",
  reports: "Тайлан",
  alerts: "Дохиолол",
  sources: "Дата эх сурвалж",
  settings: "Тохиргоо",
  departments: "Хэлтэс",
};

/** Бүтэн өргөнийг эзлэх толгой: тэмдэг + зам заагч + горимын товч */
export function Header() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  const crumbs = parts.map((p, i) => {
    const dept = DEPARTMENTS.find((d) => d.slug === p);
    return {
      href: "/" + parts.slice(0, i + 1).join("/"),
      label: dept?.name ?? LABELS[p] ?? p,
    };
  });

  return (
    <header className="elevated sticky top-0 z-40 flex h-[52px] items-center gap-4 border-b border-line bg-paper/85 px-4 backdrop-blur-md lg:px-5">
      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <Mark />
        <span className="hidden leading-none sm:block">
          <span className="display block text-[13.5px] tracking-tight">
            Байгаль орчин
          </span>
          <span className="mt-1.5 block text-[9px] tracking-[0.18em] text-ink-3 uppercase">
            Нэгдсэн платформ
          </span>
        </span>
      </Link>

      <span className="h-5 w-px shrink-0 bg-line" aria-hidden />

      <nav
        aria-label="Замчлал"
        className="flex min-w-0 items-center gap-1.5 text-[12.5px]"
      >
        <Link href="/" className="shrink-0 text-ink-3 transition-colors hover:text-ink">
          {LABELS[""]}
        </Link>
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            <ChevronRight size={12} className="shrink-0 text-ink-3/60" />
            <Link
              href={c.href}
              className={
                i === crumbs.length - 1
                  ? "truncate font-medium text-ink"
                  : "truncate text-ink-3 transition-colors hover:text-ink"
              }
            >
              {c.label}
            </Link>
          </React.Fragment>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}

/**
 * Горимын товч. Аль тэмдэглэгээ харагдахыг CSS (`:root[data-theme]`) шийднэ —
 * тиймээс React state хэрэггүй, SSR-тэй зөрөх магадлал ч алга.
 */
function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Өнгөний горим солих"
      className="flex size-8 items-center justify-center rounded-xs border border-line bg-paper-2 text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
    >
      <Sun size={14} strokeWidth={1.75} className="dark-only" />
      <Moon size={14} strokeWidth={1.75} className="light-only" />
    </button>
  );
}

function Mark() {
  return (
    <svg width="27" height="27" viewBox="0 0 27 27" aria-hidden className="shrink-0">
      <rect
        x="0.5"
        y="0.5"
        width="26"
        height="26"
        rx="2"
        fill="var(--paper-2)"
        stroke="var(--line-2)"
      />
      {/* нар — уул/ой — ус: гурван давхарга */}
      <circle cx="19" cy="7.5" r="2.25" fill="var(--ochre)" />
      <path d="M4.5 18 L10 8.5 L13.5 14 L16 10.5 L22.5 18 Z" fill="var(--moss)" />
      <path
        d="M4.5 21 H22.5"
        stroke="var(--water)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
