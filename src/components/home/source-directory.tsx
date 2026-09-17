"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Database, Search, X } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { SOURCES } from "@/lib/sources";

export function SourceDirectory() {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const normalized = query.trim().toLocaleLowerCase("mn");
  const sources = SOURCES.filter((s) => (!department || s.slug === department) && s.name.toLocaleLowerCase("mn").includes(normalized));
  return (
    <div className="source-workspace mx-auto max-w-[1500px]">
      <header className="source-intro">
        <div><p className="section-kicker">ӨГӨГДЛИЙН САН</p><h1>Мэдээллийн эх сурвалжууд<span>.</span></h1><p>Хэлтсүүдэд холбогдсон өгөгдөл, үйлчилгээний нэгдсэн бүртгэл.</p></div>
        <div className="source-total"><Database size={22} /><strong>{SOURCES.length}</strong><span>бүртгэлтэй эх сурвалж</span></div>
      </header>
      <div className="source-toolbar">
        <div className="directory-search"><Search size={17} /><input aria-label="Эх сурвалж хайх" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Мэдээллийн нэрээр хайх…" />{query && <button type="button" aria-label="Хайлт цэвэрлэх" onClick={() => setQuery("")}><X size={15} /></button>}</div>
        <select aria-label="Хэлтсээр шүүх" value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">Бүх хэлтэс</option>{DEPARTMENTS.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select>
        <span role="status">{sources.length} эх сурвалж</span>
      </div>
      <div className="source-table">
        <div className="source-table-head"><span>МЭДЭЭЛЭЛ / ХЭЛТЭС</span><span>ЭХ СУРВАЛЖИЙН ТӨРӨЛ</span><span>НЭЭХ</span></div>
        {sources.map((s, index) => {
          const dept = DEPARTMENTS.find((d) => d.slug === s.slug);
          const Icon = dept?.icon ?? Database;
          return <div className="source-row" key={`${s.url}-${index}`}>
            <Link href={`/departments/${s.slug}`} className="source-name"><span className="entry-icon"><Icon size={20} strokeWidth={1.5} /></span><div><h2>{s.name}</h2><p>{dept?.name}</p></div></Link>
            <span className="source-kind">{s.kind}</span>
            <a href={s.url} target="_blank" rel="noreferrer" className="workspace-icon-button" aria-label={`${s.name} эх сурвалжийг шинэ цонхонд нээх`}><ArrowUpRight size={17} /></a>
          </div>;
        })}
        {!sources.length && <div className="directory-empty"><Search size={25} /><p>Тохирох эх сурвалж олдсонгүй.</p><button type="button" className="action-text" onClick={() => { setQuery(""); setDepartment(""); }}>Шүүлтүүр цэвэрлэх</button></div>}
      </div>
    </div>
  );
}
