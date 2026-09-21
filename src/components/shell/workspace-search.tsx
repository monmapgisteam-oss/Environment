"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { SOURCES } from "@/lib/sources";

export function WorkspaceSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  function close() { dialog.current?.close(); }
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else dialog.current?.showModal();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const normalized = query.trim().toLocaleLowerCase("mn");
  const departments = DEPARTMENTS.filter((d) => d.name.toLocaleLowerCase("mn").includes(normalized));
  const sources = normalized ? SOURCES.filter((s) => s.name.toLocaleLowerCase("mn").includes(normalized)).slice(0, 12) : [];
  /*
    ⚠⚠ ТОЛГОЙН ХАЙХ ТОВЧ ХАСАГДСАН (хэрэглэгчийн шийдвэр, 2026-09-21).
    Хайлт нь ӨӨРӨӨ үлдсэн — Ctrl K товчлуураар нээгдэнэ. Товчны оронд
    цэс, зам заагч хоёр толгойн өргөнийг бүтнээр эзэлнэ.
    ⚠ Ctrl K нь одоо ЦОРЫН ГАНЦ зам тул хайлтыг бүрмөсөн хасах бол
    энэ бүрэлдэхүүнийг `header.tsx`-ээс мөн авна.
  */
  return (
    <>
      <dialog ref={dialog} aria-labelledby="workspace-search-title" className="workspace-search-dialog" onClick={(e) => { if (e.target === dialog.current) close(); }}>
        <div className="search-dialog-body">
          <div className="flex items-center gap-3 border-b border-line p-5">
            <Search size={20} className="shrink-0 text-moss" />
            <label id="workspace-search-title" htmlFor="workspace-query" className="sr-only">Хэлтэс, мэдээлэл хайх</label>
            <input id="workspace-query" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Хэлтэс эсвэл мэдээллийн нэр…" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
            <button type="button" onClick={close} aria-label="Хайлтыг хаах" className="workspace-icon-button"><X size={18} /></button>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto p-3">
            {departments.length > 0 && <p className="px-3 pt-2 pb-3 text-[10px] font-semibold tracking-widest text-ink-3">ХЭЛТСҮҮД</p>}
            {departments.map((d) => <Link key={d.slug} href={`/departments/${d.slug}`} onClick={close} className="search-result"><d.icon size={19} className="shrink-0 text-moss" /><span>{d.name}</span><ArrowUpRight size={15} className="ml-auto shrink-0" /></Link>)}
            {sources.length > 0 && <p className="px-3 pt-5 pb-3 text-[10px] font-semibold tracking-widest text-ink-3">МЭДЭЭЛЭЛ · ХЭЛТСИЙН САМБАРТ НЭЭХ</p>}
            {sources.map((s, i) => <Link key={`${s.url}-${i}`} href={`/departments/${s.slug}`} onClick={close} className="search-result"><Search size={16} className="shrink-0 text-ink-3" /><span>{s.name}</span><ArrowUpRight size={15} className="ml-auto shrink-0" /></Link>)}
            {!departments.length && !sources.length && <p role="status" className="px-4 py-10 text-center text-sm text-ink-3">Тохирох мэдээлэл олдсонгүй. Өөр үгээр хайна уу.</p>}
          </div>
          <p className="border-t border-line px-6 py-3 text-[11px] text-ink-3">Esc — хаах · Tab — сонголт хооронд шилжих · Enter — нээх</p>
        </div>
      </dialog>
    </>
  );
}
