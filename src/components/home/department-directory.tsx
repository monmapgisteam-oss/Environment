"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";
import { DEPARTMENTS, STATUS_LABEL } from "@/lib/departments";

const filters = [
  { value: "all", label: "Бүгд" },
  { value: "live", label: "Дата холбогдсон" },
  { value: "waiting", label: "Бүрэн холбогдоогүй" },
] as const;

export function DepartmentDirectory() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const normalized = query.trim().toLocaleLowerCase("mn");
  const departments = DEPARTMENTS.filter((department) =>
    department.name.toLocaleLowerCase("mn").includes(normalized) &&
    (filter === "all" || (filter === "live" ? department.status === "live" : department.status !== "live")),
  );

  return (
    <section id="departments" aria-labelledby="departments-heading" className="scroll-mt-20">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <div className="mb-2 text-[11px] font-medium tracking-[0.16em] text-ink-3">ХЭЛТСИЙН САМБАРУУД</div>
          <h2 id="departments-heading" className="display text-[23px]">Хэлтсүүд <span className="ml-2 align-middle text-sm font-normal text-ink-3">/ {DEPARTMENTS.length.toString().padStart(2, "0")}</span></h2>
        </div>
        <div className="relative w-full xl:w-72">
          <Search size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-ink-3" aria-hidden="true" />
          <input type="search" aria-label="Хэлтсийн нэрээр хайх" placeholder="Хэлтсийн нэрээр хайх…" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-md border border-line bg-paper-2 pr-11 pl-10 text-sm text-ink placeholder:text-ink-3" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Хайлтыг цэвэрлэх" className="absolute top-0 right-0 flex size-11 items-center justify-center text-ink-3 hover:text-ink"><X size={16} /></button>}
        </div>
      </div>
      <div className="mt-5 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Хэлтсийн төлөвөөр шүүх">
          {filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-10 rounded-md border px-3 text-xs font-medium transition-colors ${filter === item.value ? "border-moss/25 bg-moss/10 text-moss" : "border-transparent text-ink-3 hover:bg-paper-hi hover:text-ink"}`}>{item.label}</button>)}
        </div>
        <p role="status" className="text-xs text-ink-3">{departments.length} хэлтэс</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {departments.map((department) => (
          <Link key={department.slug} href={`/departments/${department.slug}`} style={{ "--tone": `var(${department.tone})` } as CSSProperties} className="group relative flex min-h-[194px] flex-col overflow-hidden rounded-lg border border-line bg-paper-2 p-5 transition-colors hover:border-(--tone) focus-visible:border-(--tone)">
            <div className="flex items-start justify-between gap-3">
              <span className="tinted flex size-11 items-center justify-center rounded-lg text-(--tone)"><department.icon size={23} strokeWidth={1.5} aria-hidden="true" /></span>
              <ArrowUpRight size={18} className="text-ink-3 transition-colors group-hover:text-(--tone)" aria-hidden="true" />
            </div>
            <h3 className="display mt-4 mb-5 max-w-[290px] text-[15px] leading-6">{department.name}</h3>
            <div className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-[11px] text-ink-3">
              <span className={`size-1.5 shrink-0 rounded-full ${department.status === "live" ? "bg-moss" : "bg-ink-3"}`} aria-hidden="true" />
              {STATUS_LABEL[department.status]}
            </div>
          </Link>
        ))}
      </div>
      {departments.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-2 px-6 py-12 text-center">
          <Search size={24} className="mx-auto mb-3 text-ink-3" aria-hidden="true" />
          <h3 className="text-sm font-medium">Тохирох хэлтэс олдсонгүй</h3>
          <p className="mt-2 text-xs text-ink-3">Хайлтын үг эсвэл төлөвийн шүүлтүүрээ өөрчилнө үү.</p>
          <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-4 min-h-11 rounded-md border border-line-2 px-4 text-xs text-ink hover:bg-paper-hi">Бүх хэлтсийг харах</button>
        </div>
      )}
    </section>
  );
}
