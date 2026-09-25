"use client";

import { useState } from "react";
import { Archive, ChevronRight, Database, Globe, Layers, Search, Webhook, X } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { SOURCES, type Source } from "@/lib/sources";
import "./source-directory.css";

const SOURCE_TYPES = [
  { id: "all", label: "Бүгд" },
  { id: "portal", label: "Порталын өгөгдөл" },
  { id: "service", label: "Веб үйлчилгээ" },
  { id: "api", label: "API үйлчилгээ" },
  { id: "snapshot", label: "Хадгалсан хуулбар" },
] as const;
type SourceType = (typeof SOURCE_TYPES)[number]["id"];

/**
 * Эх сурвалжийн төрлийг `kind` бичвэрээс таана.
 *
 * ⚠ Тусдаа талбар БИШ: `portalSources()` нь давхаргуудыг өөрөө
 * бүртгэдэг тул тэнд нэмэлт талбар тавих нь бүртгэл бүрийг хөндөнө.
 * Харин ГАРААР бичсэн мөр дээр `kind`-ыг шинэчлэхээ мартвал төрөл нь
 * чимээгүй зөрнө — 2026-09-25-нд порталын 15 давхарга "Веб
 * үйлчилгээ" гэж тоологдож байсан нь яг тэр.
 */
function sourceType(source: Source): Exclude<SourceType, "all"> {
  if (source.kind.includes("хуулбар")) return "snapshot";
  if (source.kind.includes("API")) return "api";
  return source.kind.includes("Enterprise") ? "portal" : "service";
}

const entries = SOURCES.map((source, index) => ({
  ...source,
  id: `source-${index}`,
  type: sourceType(source),
  host: new URL(source.url).host,
  department: DEPARTMENTS.find((d) => d.slug === source.slug),
}));

export function SourceDirectory() {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [type, setType] = useState<SourceType>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const normalized = query.trim().toLocaleLowerCase("mn");
  const candidates = entries.filter((source) =>
    (!department || source.slug === department) &&
    `${source.name} ${source.department?.name ?? ""} ${source.host} ${source.kind}`.toLocaleLowerCase("mn").includes(normalized),
  );
  /*
    ⚠⚠ ХООСОН ТӨРЛИЙН ТОВЧ ГАРАХГҮЙ (2026-09-25). Товчнууд бүртгэлээс
    БИШ, харагдаж буй эх сурвалжуудаас угсарна: "Хадгалсан хуулбар"
    нь хоёр мөрөө амьд холболт руу шилжүүлсний дараа ҮРГЭЛЖ тэг
    болсон ч дэлгэц дээр үлдэж, дарахад хоосон хуудас гаргадаг байв
    (санхүүгийн `statuses` бүртгэлтэй нэг зарчим).
    ⚠ Тоо нь хайлт, хэлтсийн шүүлтийг ДАГАНА — өөрийнхөө хэмжээсийг
    л алгасна. Иймээс сонгосон төрөл хайлтын улмаас тэг болж болох
    бөгөөд тэр үед шүүлт ДАМ цуцлагдана (эффектээр биш): эс тэгвээс
    товч нь алга болоод үр дүн нь хоосон хэвээр үлдэнэ.
  */
  const typeCounts = new Map(
    SOURCE_TYPES.map((item) => [
      item.id,
      item.id === "all" ? candidates.length : candidates.filter((source) => source.type === item.id).length,
    ]),
  );
  const activeType = (typeCounts.get(type) ?? 0) > 0 ? type : "all";
  const sources = candidates.filter((source) => activeType === "all" || source.type === activeType);
  const groups = DEPARTMENTS.map((dept) => ({ dept, sources: sources.filter((source) => source.slug === dept.slug) }))
    .filter((group) => group.sources.length > 0);
  const filtered = Boolean(query || department || activeType !== "all");
  const reset = () => { setQuery(""); setDepartment(""); setType("all"); setExpanded({}); };
  return (
    <section className="source-catalog" aria-labelledby="source-catalog-title">
      {/*
        ⚠ НИЙЛБЭРИЙН БЛОК ХАСАГДСАН (хэрэглэгчийн шийдвэр, 2026-09-25).
        "Эх сурвалж 82 · Хэлтэс 6" гэсэн хоёр том тоо нь доорх
        үр дүнгийн мөртэй ("82 / 82 эх сурвалж · 6 хэлтэс") ЯГ ижил
        зүйл хэлдэг байв — тэр мөр нь дээр нь шүүлт тавихад дагаж
        өөрчлөгддөг тул илүү мэдээлэлтэй. Дахин бүү нэм.
      */}
      <header className="source-catalog-intro">
        <div>
          <span className="source-catalog-kicker"><Database size={13} aria-hidden />ЭХ СУРВАЛЖИЙН БҮРТГЭЛ</span>
          <h1 id="source-catalog-title">Мэдээллийн эх сурвалжууд</h1>
          <p>Хэлтсээ дэлгэж, ашиглаж буй өгөгдлийн эх сурвалжийн мэдээллийг харна.</p>
        </div>
      </header>

      <div className="source-catalog-controls">
        <div className="source-catalog-search-row">
          <label className="source-catalog-search">
            <Search size={17} aria-hidden />
            <input aria-label="Эх сурвалж хайх" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setExpanded({}); }} placeholder="Нэр, хэлтэс, серверийн хаягаар хайх…" />
            {query && <button type="button" aria-label="Хайлт цэвэрлэх" onClick={() => { setQuery(""); setExpanded({}); }}><X size={15} aria-hidden /></button>}
          </label>
          <label className="source-catalog-select"><span>Хариуцсан хэлтэс</span>
            <select aria-label="Хэлтсээр шүүх" value={department} onChange={(e) => { setDepartment(e.target.value); setExpanded({}); }}>
              <option value="">Бүх хэлтэс</option>
              {DEPARTMENTS.map((dept) => <option key={dept.slug} value={dept.slug}>{dept.name} ({entries.filter((source) => source.slug === dept.slug).length})</option>)}
            </select>
          </label>
        </div>
        <div className="source-catalog-filter-row">
          <div className="source-catalog-types" role="group" aria-label="Эх сурвалжийн төрлөөр шүүх">
            {SOURCE_TYPES.filter((item) => (typeCounts.get(item.id) ?? 0) > 0).map((item) => <button key={item.id} type="button" aria-pressed={activeType === item.id} onClick={() => { setType(item.id); setExpanded({}); }}>
              {item.label}<span className="num">{typeCounts.get(item.id)}</span>
            </button>)}
          </div>
          {filtered && <button className="source-catalog-reset" type="button" onClick={reset}><X size={12} aria-hidden />Шүүлт цэвэрлэх</button>}
        </div>
      </div>

      <div className="source-catalog-results" role="status" aria-live="polite"><span><strong className="num">{sources.length}</strong> / {entries.length} эх сурвалж</span><span>{groups.length} хэлтэс</span></div>
      <div className="source-catalog-groups">
        {groups.map(({ dept, sources: rows }) => {
          const isExpanded = expanded[dept.slug] ?? filtered;
          return <section key={dept.slug} className="source-catalog-group" data-expanded={isExpanded} aria-labelledby={`source-department-${dept.slug}`}>
            <header className="source-catalog-group-head">
              <h2 id={`source-department-${dept.slug}`}>
                <button type="button" className="source-catalog-toggle" aria-expanded={isExpanded} aria-controls={`source-list-${dept.slug}`} onClick={() => setExpanded((current) => ({ ...current, [dept.slug]: !isExpanded }))}>
                  <span className="source-catalog-dept-icon"><dept.icon size={18} strokeWidth={1.6} aria-hidden /></span>
                  <span className="source-catalog-dept-name">{dept.name}<span className="source-catalog-count num">{rows.length}</span></span>
                  <ChevronRight className="source-catalog-chevron" size={16} aria-hidden />
                </button>
              </h2>
            </header>
            <ul id={`source-list-${dept.slug}`} className="source-catalog-list" hidden={!isExpanded}>
              {rows.map((source) => {
                const Icon = source.type === "snapshot" ? Archive
                  : source.type === "portal" ? Layers
                  : source.type === "api" ? Webhook
                  : Globe;
                return <li key={source.id} className="source-catalog-entry">
                  <div className="source-catalog-entry-main">
                    <h3>{source.name}</h3>
                    <div className="source-catalog-meta">
                      <span className={`source-catalog-kind is-${source.type}`}><Icon size={11} aria-hidden />{SOURCE_TYPES.find((item) => item.id === source.type)?.label}</span>
                      <span className="source-catalog-host">{source.host}</span>
                    </div>
                    {source.type === "snapshot" && <p className="source-catalog-copy-note">Самбарт хадгалсан хуулбарыг ашигладаг.</p>}
                    <details className="source-catalog-connection">
                      <summary>Холболтын мэдээлэл<ChevronRight size={11} aria-hidden /></summary>
                      <dl><div><dt>Үйлчилгээний төрөл</dt><dd>{source.kind}</dd></div><div><dt>Эх үйлчилгээний хаяг</dt><dd className="source-catalog-url">{source.url}</dd></div></dl>
                    </details>
                  </div>
                </li>;
              })}
            </ul>
          </section>;
        })}
      </div>

      {!sources.length && <div className="source-catalog-empty">
        <Search size={25} strokeWidth={1.5} aria-hidden />
        <h2>Тохирох эх сурвалж олдсонгүй</h2>
        <p>{department && !entries.some((source) => source.slug === department) ? "Энэ хэлтэст эх сурвалжийн холбоос бүртгээгүй байна." : "Хайлтын үг, хэлтэс эсвэл төрлийн шүүлтээ өөрчилнө үү."}</p>
        <button type="button" onClick={reset}>Бүх эх сурвалжийг харах<ChevronRight size={14} aria-hidden /></button>
      </div>}
    </section>
  );
}
