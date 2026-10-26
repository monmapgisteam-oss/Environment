"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Moon, Sun } from "lucide-react";
import { setLang, useDeptName, useLang, useT } from "@/lib/i18n";
import { DEPARTMENTS } from "@/lib/departments";
import { asset } from "@/lib/base-path";
import { UserChip } from "@/components/auth/user-chip";
import { WorkspaceSearch } from "./workspace-search";

/*
  Зам заагчийн нэр — ХЭЛТСИЙН БУС хуудсуудынх.

  ⚠ Урьд нь зөвхөн `/sources` бичигдсэн байсан тул `/reports`,
  `/alerts`, `/map`, `/settings` дөрвүүлээ "Ерөнхий самбар" гэж
  ХУДЛАА бичигддэг байв (2026-09-29-нд "Дүн шинжилгээ" нэмэхэд
  нүдэнд ил болов).

  ⚠ Нэр нь хуудас бүрийн ӨӨРИЙН `metadata.title`-тай ЯГ таарна —
  хоёр газар өөрөөр бичвэл хөтчийн таб, зам заагч хоёр зөрнө.
*/
const PAGE_NAMES: [string, string, string][] = [
  ["/analysis", "Дүн шинжилгээ", "Analysis"],
  ["/sources", "Дата эх сурвалж", "Data sources"],
  ["/access", "Эрхийн зохицуулалт", "Access control"],
  ["/reports", "Тайлан", "Reports"],
  ["/alerts", "Дохиолол", "Alerts"],
  ["/map", "Газрын зураг", "Map"],
  ["/settings", "Тохиргоо", "Settings"],
];

export function Header() {
  const path = usePathname();
  const lang = useLang();
  const t = useT();
  const deptName = useDeptName();
  const department = DEPARTMENTS.find((d) => path.startsWith(`/departments/${d.slug}`));
  const page = PAGE_NAMES.find(([at]) => path.startsWith(at));
  const title = department
    ? deptName(department)
    : page
      ? t(page[1], page[2])
      : t("Ерөнхий самбар", "Overview");
  return (
    <header className="workspace-header">
      <div className="workspace-identity min-w-0">
        <Link href="/" className="workspace-wordmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/logo.svg")} alt="" aria-hidden="true" width={60} height={60} />
          <span className="uppercase">{t("Нийслэлийн байгаль орчны газар", "Capital City Environment Department")}</span>
        </Link>
        <div className="workspace-breadcrumb mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-3">
          <span className="hidden shrink-0 sm:inline">{t("Хяналтын нэгдсэн систем", "Integrated Monitoring System")}</span>
          <ChevronRight size={11} className="hidden shrink-0 sm:block" />
          <span className="truncate">{title}</span>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <WorkspaceSearch />
        <button type="button" aria-label={t("Өнгөний горим солих", "Toggle colour mode")} title={t("Өнгөний горим солих", "Toggle colour mode")} className="workspace-icon-button"
          onClick={() => {
            const root = document.documentElement;
            const next = root.dataset.theme === "light" ? "dark" : "light";
            root.dataset.theme = next;
            try { localStorage.setItem("workspace-theme", next); } catch {}
          }}>
          <Moon size={18} className="light-only" /><Sun size={18} className="dark-only" />
        </button>
        {/* ХЭЛ — өнгөний горимын АРД (хэрэглэгч 2026-10-23). Товч нь шилжих
            хэлийг заана: монголоор байхад "EN", англиар байхад "МН". */}
        <button type="button" aria-label={t("Switch to English", "Монгол хэл рүү шилжих")} title={t("Switch to English", "Монгол хэл рүү шилжих")}
          translate="no" className="workspace-icon-button workspace-lang-button" onClick={() => setLang(lang === "en" ? "mn" : "en")}>
          {lang === "en" ? "МН" : "EN"}
        </button>
        <span className="hidden h-7 w-px bg-line sm:block" />
        <UserChip />
      </div>
    </header>
  );
}
