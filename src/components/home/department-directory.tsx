"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutGrid, List, Search, X } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { cn } from "@/lib/utils";

const filters = [{ value: "all", label: "Бүх хэлтэс" }, { value: "live", label: "Дата холбогдсон" }, { value: "waiting", label: "Хүлээгдэж буй" }] as const;

export function DepartmentDirectory({ sourceCounts }: { sourceCounts: Record<string, number> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const normalized = query.trim().toLocaleLowerCase("mn");
  const departments = DEPARTMENTS.filter((d) => d.name.toLocaleLowerCase("mn").includes(normalized) && (filter === "all" || (filter === "live" ? d.status === "live" : d.status !== "live")));
  return (
    <section id="departments" aria-labelledby="departments-heading" className="department-section">
      <div className="directory-heading">
        <div><p className="section-kicker">АЖЛЫН ЧИГЛЭЛҮҮД</p><h2 id="departments-heading">Хэлтсийн самбарууд<span>{DEPARTMENTS.length}</span></h2></div>
        <p>Хариуцсан чиглэлээ сонгож,<br />мэдээлэлтэйгээ ажиллаарай.</p>
      </div>
      <div className="directory-toolbar">
        <div className="directory-filters" role="group" aria-label="Хэлтсийн төлөв">
          {filters.map((f) => <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)} className={cn(filter === f.value && "selected")}>{f.label}</button>)}
        </div>
        <div className="directory-tools">
          <div className="directory-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Хэлтэс хайх" placeholder="Хэлтэс хайх…" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button type="button" onClick={() => setQuery("")} aria-label="Хайлт цэвэрлэх"><X size={14} /></button>}</div>
          <div className="view-switch" role="group" aria-label="Харагдац сонгох">
            <button type="button" aria-label="Жагсаалт" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={17} /></button>
            <button type="button" aria-label="Карт" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={17} /></button>
          </div>
        </div>
      </div>
      <div className={cn("department-collection", view === "grid" && "as-grid")}>
        {departments.map((d) => <Link key={d.slug} href={`/departments/${d.slug}`} className={cn("department-entry", d.status !== "live" && "is-pending")}>
          <span className="entry-number">{String(DEPARTMENTS.indexOf(d) + 1).padStart(2, "0")}</span>
          <span className="entry-icon"><d.icon size={24} strokeWidth={1.4} /></span>
          <div className="entry-copy"><h3>{d.name}</h3><p>{sourceCounts[d.slug] ? `${sourceCounts[d.slug]} бүртгэлтэй эх сурвалж` : d.status === "live" ? "Хэлтсийн мэдээлэлтэй танилцах" : "Эх сурвалжийн мэдээлэл хүлээгдэж байна"}</p></div>
          <span className="entry-status"><span />{d.status === "live" ? "Холбогдсон" : "Хүлээгдэж буй"}</span>
          <span className="entry-arrow"><ArrowUpRight size={21} /></span>
        </Link>)}
      </div>
      {!departments.length && <div className="directory-empty"><Search size={26} /><h3>Тохирох хэлтэс олдсонгүй</h3><p>Хайлтын үг эсвэл төлөвөө өөрчилнө үү.</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="action-text">Бүх хэлтсийг харах <ArrowUpRight size={16} /></button></div>}
      <p role="status" className="mt-4 text-xs text-ink-3">{departments.length} / {DEPARTMENTS.length} хэлтэс</p>
    </section>
  );
}
