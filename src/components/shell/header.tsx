"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { RailOpen } from "@/components/shell/rail";
import { asset } from "@/lib/base-path";

/** Бүтэн өргөнийг эзлэх толгой: тэмдэг + горимын товч */
export function Header() {
  return (
    <header className="elevated sticky top-0 z-40 flex h-(--head-h) items-center gap-4 border-b border-line bg-paper/85 px-4 backdrop-blur-md lg:px-5">
      {/* Зөвхөн зурвас хураагдсан үед гарна — буцааж дэлгэх цорын ганц зам */}
      <RailOpen />

      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <Mark />
        <span className="hidden leading-none sm:block">
          {/*
            Том үсэгт `tracking-tight` тохирохгүй — үсгүүд наалдаж уншигдахаа
            больдог. Тиймээс энд бага зэрэг сунгасан зайтай.
          */}
          <span className="display block text-[13.5px] tracking-[0.04em] uppercase">
            Нийслэлийн байгаль орчны газар
          </span>
          <span className="mt-1.5 block text-[9px] tracking-[0.18em] text-ink-3 uppercase">
            Нэгдсэн платформ
          </span>
        </span>
      </Link>

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

/**
 * Албан ёсны тэмдэг.
 *
 * Файл нь растераас векторжуулсан 1205 замтай, ~700KB — тиймээс кодод
 * ШУУД БИЧИХГҮЙ, `public/`-оос зураг болгон дуудна. Инлайн болговол хуудас
 * бүрийн HTML тэр хэмжээгээр хавагнана.
 *
 * `next/image` биш энгийн `img`: сайт статикаар экспортлогддог тул зургийн
 * оновчлол ажиллахгүй, харин `asset()` нь GitHub Pages-ийн дэд замыг залгана.
 */
function Mark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset("/logo.svg")}
      alt=""
      aria-hidden
      width={38}
      height={38}
      className="size-[38px] shrink-0"
    />
  );
}
