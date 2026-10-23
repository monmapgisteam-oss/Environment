"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutGrid, List, Search, X } from "lucide-react";
import { useAccess } from "@/components/auth/access";
import { cn } from "@/lib/utils";
import { useDeptName, useT } from "@/lib/i18n";

const filters = [
  { value: "all", label: "Бүх хэлтэс", en: "All divisions" },
  { value: "live", label: "Дата холбогдсон", en: "Data connected" },
  { value: "waiting", label: "Хүлээгдэж буй", en: "Pending" },
] as const;

export function DepartmentDirectory({ sourceCounts }: { sourceCounts: Record<string, number> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const { departments: DEPARTMENTS } = useAccess();
  const t = useT();
  const deptName = useDeptName();
  const normalized = query.trim().toLocaleLowerCase("mn");
  const departments = DEPARTMENTS.filter((d) => `${d.name} ${deptName(d)}`.toLocaleLowerCase("mn").includes(normalized) && (filter === "all" || (filter === "live" ? d.status === "live" : d.status !== "live")));
  return (
    <section id="departments" aria-labelledby="departments-heading" className="department-section">
      <div className="directory-heading">
        <div><p className="section-kicker">{t("АЖЛЫН ЧИГЛЭЛҮҮД", "WORK AREAS")}</p><h2 id="departments-heading">{t("Хэлтсийн самбарууд", "Division dashboards")}<span>{DEPARTMENTS.length}</span></h2></div>
        <p>{t("Хариуцсан чиглэлээ сонгож,", "Choose your area of responsibility")}<br />{t("мэдээлэлтэйгээ ажиллаарай.", "and work with your data.")}</p>
      </div>
      <div className="directory-toolbar">
        <div className="directory-filters" role="group" aria-label={t("Хэлтсийн төлөв", "Division status")}>
          {filters.map((f) => <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)} className={cn(filter === f.value && "selected")}>{t(f.label, f.en)}</button>)}
        </div>
        <div className="directory-tools">
          <div className="directory-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label={t("Хэлтэс хайх", "Search divisions")} placeholder={t("Хэлтэс хайх…", "Search divisions…")} value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button type="button" onClick={() => setQuery("")} aria-label={t("Хайлт цэвэрлэх", "Clear search")}><X size={14} /></button>}</div>
          <div className="view-switch" role="group" aria-label={t("Харагдац сонгох", "Choose view")}>
            <button type="button" aria-label={t("Жагсаалт", "List")} aria-pressed={view === "list"} onClick={() => setView("list")}><List size={17} /></button>
            <button type="button" aria-label={t("Карт", "Cards")} aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={17} /></button>
          </div>
        </div>
      </div>
      <div className={cn("department-collection", view === "grid" && "as-grid")}>
        {departments.map((d) => <Link key={d.slug} href={`/departments/${d.slug}`} className={cn("department-entry", d.status !== "live" && "is-pending")}>
          <span className="entry-number">{String(DEPARTMENTS.indexOf(d) + 1).padStart(2, "0")}</span>
          <span className="entry-icon"><d.icon size={24} strokeWidth={1.4} /></span>
          <div className="entry-copy"><h3>{deptName(d)}</h3><p>{sourceCounts[d.slug] ? t(`${sourceCounts[d.slug]} бүртгэлтэй эх сурвалж`, `${sourceCounts[d.slug]} registered sources`) : d.status === "live" ? t("Хэлтсийн мэдээлэлтэй танилцах", "View division data") : t("Эх сурвалжийн мэдээлэл хүлээгдэж байна", "Source information pending")}</p></div>
          <span className="entry-status"><span />{d.status === "live" ? t("Холбогдсон", "Connected") : t("Хүлээгдэж буй", "Pending")}</span>
          <span className="entry-arrow"><ArrowUpRight size={21} /></span>
        </Link>)}
      </div>
      {!departments.length && <div className="directory-empty"><Search size={26} /><h3>{t("Тохирох хэлтэс олдсонгүй", "No matching divisions")}</h3><p>{t("Хайлтын үг эсвэл төлөвөө өөрчилнө үү.", "Change the search term or status.")}</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="action-text">{t("Бүх хэлтсийг харах", "Show all divisions")} <ArrowUpRight size={16} /></button></div>}
      <p role="status" className="mt-4 text-xs text-ink-3">{departments.length} / {DEPARTMENTS.length} {t("хэлтэс", "divisions")}</p>
    </section>
  );
}
