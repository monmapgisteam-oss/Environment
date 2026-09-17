"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Moon, Sun } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { asset } from "@/lib/base-path";
import { UserChip } from "@/components/auth/user-chip";
import { WorkspaceSearch } from "./workspace-search";

export function Header() {
  const path = usePathname();
  const department = DEPARTMENTS.find((d) => path.startsWith(`/departments/${d.slug}`));
  const title = department?.name ?? (path.startsWith("/sources") ? "Дата эх сурвалж" : "Ерөнхий самбар");
  return (
    <header className="workspace-header">
      <div className="workspace-identity min-w-0">
        <Link href="/" className="workspace-wordmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/logo.svg")} alt="" aria-hidden="true" width={60} height={60} />
          <span className="uppercase">Нийслэлийн байгаль орчны газар</span>
        </Link>
        <div className="workspace-breadcrumb mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-3">
          <span className="hidden shrink-0 sm:inline">Хяналтын нэгдсэн систем</span>
          <ChevronRight size={11} className="hidden shrink-0 sm:block" />
          <span className="truncate">{title}</span>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <WorkspaceSearch />
        <button type="button" aria-label="Өнгөний горим солих" title="Өнгөний горим солих" className="workspace-icon-button"
          onClick={() => {
            const root = document.documentElement;
            const next = root.dataset.theme === "light" ? "dark" : "light";
            root.dataset.theme = next;
            try { localStorage.setItem("workspace-theme", next); } catch {}
          }}>
          <Moon size={18} className="light-only" /><Sun size={18} className="dark-only" />
        </button>
        <span className="hidden h-7 w-px bg-line sm:block" />
        <UserChip />
      </div>
    </header>
  );
}
