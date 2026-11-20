"use client";

import { useState } from "react";
import { ChevronRight, Database, ListTree, Search, X } from "lucide-react";
import { DEPARTMENTS as ALL_DEPARTMENTS } from "@/lib/departments";
import { useAccess } from "@/components/auth/access";
import { SOURCES, type Source } from "@/lib/sources";
import { DataBank } from "@/components/home/data-bank";
import "./source-directory.css";

const SOURCE_TYPES = [
  { id: "all", label: "Бүгд" },
  { id: "portal", label: "Порталын өгөгдөл" },
  { id: "service", label: "Веб үйлчилгээ" },
  { id: "api", label: "API үйлчилгээ" },
  { id: "snapshot", label: "Хадгалсан хуулбар" },
] as const;
type SourceType = (typeof SOURCE_TYPES)[number]["id"];

/*
  ХУУДСЫН ХОЁР ХАРАГДАЦ (хэрэглэгч 2026-11-12: "ЭХ СУРВАЛЖИЙН БҮРТГЭЛ-ийг
  товч болгоод ард нь дахиад шинээр товч хий, нэр нь Мэдээллийн сан").
  Урьд нь толгойн тэмдэглэгээ (eyebrow) байсан бичвэр нь одоо эхний товч;
  гарчиг ("Мэдээллийн эх сурвалжууд") ба тайлбар мөр ХАСАГДСАН (хэрэглэгч мөн
  өдөр: "del") — товч өөрөө харагдацаа нэрлэнэ;
  хоёр дахь нь "Мэдээллийн сан" — төслийн бүх давхарга нэг Esri зурагт
  ({@link ./data-bank}). Сонголт `localStorage`-д хадгалагдахгүй.
*/
const VIEWS = [
  { id: "sources", label: "Эх сурвалжийн бүртгэл", icon: ListTree },
  { id: "database", label: "Мэдээллийн сан", icon: Database },
] as const;
type View = (typeof VIEWS)[number]["id"];

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

const allEntries = SOURCES.map((source, index) => ({
  ...source,
  id: `source-${index}`,
  type: sourceType(source),
  host: new URL(source.url).host,
  department: ALL_DEPARTMENTS.find((d) => d.slug === source.slug),
}));

export function SourceDirectory() {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [type, setType] = useState<SourceType>("all");
  const [view, setView] = useState<View>("sources");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  /* Хэлтсийн бүртгэл зөвхөн өөрийн хэлтсийн эх сурвалжийг харна */
  const { departments: DEPARTMENTS, allows } = useAccess();
  const entries = allEntries.filter((source) => allows(source.slug));
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
  const selected = groups.find(({ dept }) => dept.slug === selectedDepartment) ?? groups[0];
  const midpoint = Math.ceil((selected?.sources.length ?? 0) / 2);
  const sourceColumns = selected
    ? [selected.sources.slice(0, midpoint), selected.sources.slice(midpoint)].filter((column) => column.length > 0)
    : [];
  const filtered = Boolean(query || department || activeType !== "all");
  const reset = () => { setQuery(""); setDepartment(""); setType("all"); setSelectedDepartment(""); };
  return (
    <section className="source-catalog" data-view={view} aria-label="Өгөгдлийн сан">
      {/*
        ⚠ НИЙЛБЭРИЙН БЛОК ХАСАГДСАН (хэрэглэгчийн шийдвэр, 2026-09-25).
        "Эх сурвалж 82 · Хэлтэс 6" гэсэн хоёр том тоо нь доорх
        үр дүнгийн мөртэй ("82 / 82 эх сурвалж · 6 хэлтэс") ЯГ ижил
        зүйл хэлдэг байв — тэр мөр нь дээр нь шүүлт тавихад дагаж
        өөрчлөгддөг тул илүү мэдээлэлтэй. Дахин бүү нэм.
      */}
      <header className="source-catalog-intro">
        <div>
          <div className="source-catalog-views" role="group" aria-label="Харагдац">
            {VIEWS.map((item) => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)}>
              <item.icon size={13} aria-hidden />{item.label}
            </button>)}
          </div>
        </div>
      </header>

      {view === "database" && <DataBank />}

      {view === "sources" && <>

      <div className="source-catalog-controls">
        <div className="source-catalog-search-row">
          <label className="source-catalog-search">
            <Search size={17} aria-hidden />
            <input aria-label="Эх сурвалж хайх" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setSelectedDepartment(""); }} placeholder="Нэр, хэлтэс, серверийн хаягаар хайх…" />
            {query && <button type="button" aria-label="Хайлт цэвэрлэх" onClick={() => { setQuery(""); setSelectedDepartment(""); }}><X size={15} aria-hidden /></button>}
          </label>
          <label className="source-catalog-select"><span>Хариуцсан хэлтэс</span>
            <select aria-label="Хэлтсээр шүүх" value={department} onChange={(e) => { setDepartment(e.target.value); setSelectedDepartment(""); }}>
              <option value="">Бүх хэлтэс</option>
              {DEPARTMENTS.map((dept) => <option key={dept.slug} value={dept.slug}>{dept.name} ({entries.filter((source) => source.slug === dept.slug).length})</option>)}
            </select>
          </label>
        </div>
        <div className="source-catalog-filter-row">
          <div className="source-catalog-types" role="group" aria-label="Эх сурвалжийн төрлөөр шүүх">
            {SOURCE_TYPES.filter((item) => (typeCounts.get(item.id) ?? 0) > 0).map((item) => <button key={item.id} type="button" aria-pressed={activeType === item.id} onClick={() => { setType(item.id); setSelectedDepartment(""); }}>
              {item.label}<span className="num">{typeCounts.get(item.id)}</span>
            </button>)}
          </div>
          {filtered && <button className="source-catalog-reset" type="button" onClick={reset}><X size={12} aria-hidden />Шүүлт цэвэрлэх</button>}
        </div>
      </div>

      <div className="source-catalog-results" role="status" aria-live="polite"><span><strong className="num">{sources.length}</strong> / {entries.length} эх сурвалж</span><span>{groups.length} хэлтэс</span></div>
      <div className="source-catalog-departments" role="group" aria-label="Хэлтэс сонгох">
        {groups.map(({ dept, sources: rows }) => (
          <button key={dept.slug} type="button" className="source-catalog-department" title={dept.name} aria-pressed={selected?.dept.slug === dept.slug} aria-controls="source-catalog-detail" onClick={() => setSelectedDepartment(dept.slug)}>
            <span className="source-catalog-dept-icon"><dept.icon size={18} strokeWidth={1.6} aria-hidden /></span>
            <span className="source-catalog-dept-name">{dept.name}</span>
            <span className="source-catalog-count num">{rows.length}</span>
            <ChevronRight size={14} aria-hidden />
          </button>
        ))}
      </div>

      {selected && <section id="source-catalog-detail" className="source-catalog-detail" aria-labelledby="source-catalog-detail-title">
        <header className="source-catalog-detail-head">
          <div><selected.dept.icon size={17} strokeWidth={1.6} aria-hidden /><h2 id="source-catalog-detail-title" title={selected.dept.name}>{selected.dept.name}</h2></div>
          <span><strong className="num">{selected.sources.length}</strong> эх сурвалж</span>
        </header>
        <div key={selected.dept.slug + activeType + query} className="source-catalog-table-scroll" tabIndex={0} aria-label="Эх сурвалжийн жагсаалт">
          <div className="source-catalog-columns">
            {sourceColumns.map((column, columnIndex) => <ol key={columnIndex} className="source-catalog-column" start={columnIndex * midpoint + 1}>
              {column.map((source, index) => (
                <li key={source.id} className="source-catalog-item">
                  <details className="source-catalog-item-details">
                    <summary>
                      <span className="source-catalog-number num" aria-hidden="true">{String(columnIndex * midpoint + index + 1).padStart(2, "0")}</span>
                      <span className="source-catalog-item-name">{source.name}</span>
                      <ChevronRight className="source-catalog-item-arrow" size={15} aria-hidden />
                    </summary>
                    <div className="source-catalog-item-body">
                      <dl><div><dt>Үйлчилгээний төрөл</dt><dd>{source.kind}</dd></div><div><dt>Эх үйлчилгээний хаяг</dt><dd className="source-catalog-url">{source.url}</dd></div></dl>
                      {source.type === "snapshot" && <p className="source-catalog-copy-note">Самбарт хадгалсан хуулбарыг ашигладаг.</p>}
                    </div>
                  </details>
                </li>
              ))}
            </ol>)}
          </div>
        </div>
      </section>}

      {!sources.length && <div className="source-catalog-empty">
        <Search size={25} strokeWidth={1.5} aria-hidden />
        <h2>Тохирох эх сурвалж олдсонгүй</h2>
        <p>{department && !entries.some((source) => source.slug === department) ? "Энэ хэлтэст эх сурвалжийн холбоос бүртгээгүй байна." : "Хайлтын үг, хэлтэс эсвэл төрлийн шүүлтээ өөрчилнө үү."}</p>
        <button type="button" onClick={reset}>Бүх эх сурвалжийг харах<ChevronRight size={14} aria-hidden /></button>
      </div>}
      </>}
    </section>
  );
}
