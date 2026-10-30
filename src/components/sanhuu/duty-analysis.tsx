"use client";

import * as React from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, FileText, Info, ListChecks, Loader2, RotateCcw, Search, X } from "lucide-react";
import { fetchPlan, type PlanData, type Task } from "@/lib/sanhuu";
import {
  DUTY_STATUSES, EMPTY_DUTY_FILTERS, dutyCsv, dutyReviewChanged, fetchDutyAnalysis,
  filterDutyFindings, findingPeople, type DutyAnalysis, type DutyFilters, type DutyFinding, type DutyStatus,
} from "@/lib/sanhuu-duty-analysis";

type View = "issues" | "aligned" | "sources";
const ISSUE_STATUSES: DutyStatus[] = ["gap", "partial", "overlap", "review"];
const ALIGNED_STATUSES: DutyStatus[] = ["matched", "linked"];
const LABELS: Record<DutyStatus, string> = {
  overlap: "Давхардлын эрсдэл", gap: "Системд тусгагдаагүй", partial: "Хэсэгчлэн тусгагдсан",
  review: "Нягтлах шаардлагатай", linked: "Чиг үүргийн уялдаа", matched: "Агуулгын нийцэл",
};
const EXPLANATIONS: Record<DutyStatus, string> = {
  overlap: "Хариуцагч болон гүйцэтгэх чиг үүргийн заагийг тодорхой болгох шаардлагатай.",
  gap: "Эх баримтад заасан чиг үүрэг системд тодорхой тусгагдаагүй байна. Энэхүү дүгнэлт нь ажлын гүйцэтгэлийг үнэлээгүй болно.",
  partial: "Ажил бүртгэгдсэн боловч агуулга, хугацаа эсвэл шалгуур үзүүлэлт бүрэн тусгагдаагүй, эсхүл эх баримттай зөрүүтэй байна.",
  review: "Эх баримтын хүчинтэй хувилбар, хариуцагч эсвэл харьяаллыг нягтлан баталгаажуулах шаардлагатай.",
  linked: "Холбогдох албан хаагчдын гүйцэтгэх, хянах, дэмжлэг үзүүлэх чиг үүрэг харилцан уялдаатай байна.",
  matched: "Тулгалтад хамруулсан ажлын агуулга эх баримтын холбогдох заалттай нийцэж байна.",
};
function isIssue(f: DutyFinding) { return ISSUE_STATUSES.includes(f.status); }
function toneOf(status: DutyStatus) { return DUTY_STATUSES.find((s) => s.id === status)!.tone; }
function Status({ status }: { status: DutyStatus }) {
  return <span className={`duty-status is-${toneOf(status)}`}><span aria-hidden />{LABELS[status]}</span>;
}

export function DutyAnalysisDashboard() {
  const [result, setResult] = React.useState<{ review: DutyAnalysis; plan: PlanData } | null>(null);
  const [error, setError] = React.useState("");
  const [attempt, retry] = React.useReducer((v: number) => v + 1, 0);
  React.useEffect(() => {
    const ac = new AbortController();
    Promise.all([fetchDutyAnalysis(ac.signal), fetchPlan(ac.signal)])
      .then(([review, plan]) => { if (!ac.signal.aborted) setResult({ review, plan }); })
      .catch((e: Error) => { if (!ac.signal.aborted) setError(e.message); });
    return () => ac.abort();
  }, [attempt]);
  if (error) return <div className="duty-load-state" role="alert"><FileText size={24} /><h2>Шинжилгээний мэдээллийг ачаалах боломжгүй байна</h2><p>{error}</p><button type="button" onClick={() => { setError(""); retry(); }}><RotateCcw size={14} />Дахин оролдох</button></div>;
  if (!result) return <div className="sanhuu-loading" role="status"><Loader2 size={16} className="animate-spin" />Шинжилгээний мэдээллийг ачаалж байна…</div>;
  return <Review review={result.review} plan={result.plan} />;
}

function Review({ review, plan }: { review: DutyAnalysis; plan: PlanData }) {
  const [filters, setFilters] = React.useState<DutyFilters>(EMPTY_DUTY_FILTERS);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>("issues");
  const [downloaded, setDownloaded] = React.useState(false);
  const detailRef = React.useRef<HTMLElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listScroll = React.useRef(0);
  const stale = React.useMemo(() => dutyReviewChanged(review, plan), [review, plan]);
  const searched = React.useMemo(() => filterDutyFindings(review, plan.tasks, { ...filters, status: "all" }), [review, plan.tasks, filters]);
  const group = React.useMemo(() => searched.filter((f) => view === "aligned" ? !isIssue(f) : isIssue(f)), [searched, view]);
  const list = React.useMemo(() => group.filter((f) => filters.status === "all" || f.status === filters.status), [group, filters.status]);
  const currentIndex = list.findIndex((f) => f.id === selected);
  const current = list[currentIndex];
  const sourceMap = React.useMemo(() => new Map(review.sources.map((s) => [s.id, s])), [review.sources]);
  const people = React.useMemo(() => [...new Set(review.findings.flatMap((f) => findingPeople(f, plan.tasks)))].sort((a, b) => a.localeCompare(b, "mn")), [review, plan.tasks]);
  const filtered = filters.status !== "all" || filters.person || filters.source || filters.query;
  const issueCount = review.findings.filter(isIssue).length;
  const noun = view === "issues" ? "асуудал" : "тулгалт";
  const patch = (value: Partial<DutyFilters>) => { setFilters((f) => ({ ...f, ...value })); setSelected(null); setDownloaded(false); };
  function changeView(next: View) { setView(next); setSelected(null); setFilters(EMPTY_DUTY_FILTERS); setDownloaded(false); }
  function reset() { setFilters(EMPTY_DUTY_FILTERS); setSelected(null); setDownloaded(false); }
  function openFinding(id: string) {
    if (listRef.current) listScroll.current = listRef.current.scrollTop;
    setSelected(id);
    requestAnimationFrame(() => {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollTo({ top: 0 });
      if (window.matchMedia("(max-width: 1279px)").matches) detailRef.current?.previousElementSibling?.scrollIntoView({ block: "start" });
    });
  }
  function closeFinding() {
    const id = selected;
    setSelected(null);
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listScroll.current;
      const row = listRef.current?.querySelector<HTMLButtonElement>(`button[data-finding="${id}"]`);
      row?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 1279px)").matches) row?.scrollIntoView({ block: "center" });
    });
  }
  function download() {
    const url = URL.createObjectURL(new Blob([dutyCsv(review, plan, list)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `saamh-chig-uurgiin-shinjilgee-${review.reviewedAt}.csv`;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }

  return (
    <section className="duty-analysis" aria-label="Чиг үүргийн шинжилгээ">
      {stale && <div className="duty-stale" role="alert"><Info size={17} /><div><strong>Системийн мэдээлэл өөрчлөгдсөн тул тулгалтыг шинэчлэх шаардлагатай.</strong><p>Дүгнэлтийг {review.reviewedAt}-ны өдрийн мэдээлэлд үндэслэн боловсруулсан. Холбогдох ажлын хэсэгт системийн одоогийн мэдээллийг харуулав.</p></div></div>}
      <div className="duty-viewbar">
        <div className="duty-views" role="group" aria-label="Шинжилгээний харагдац">
          <button type="button" data-view="issues" aria-pressed={view === "issues"} onClick={() => changeView("issues")}><ListChecks size={17} /><span>Залруулах, тодруулах</span><b className="num">{issueCount}</b></button>
          <button type="button" data-view="aligned" aria-pressed={view === "aligned"} onClick={() => changeView("aligned")}><CheckCheck size={17} /><span>Нийцэл, уялдаа</span><b className="num">{review.findings.length - issueCount}</b></button>
          <button type="button" data-view="sources" aria-pressed={view === "sources"} onClick={() => changeView("sources")}><BookOpen size={17} /><span>Эх баримт</span><b className="num">{review.sources.length}</b></button>
        </div>
        {view !== "sources" && !current && <button className="duty-export" type="button" onClick={download} disabled={!list.length} title="Шүүсэн үр дүнг Excel-д нээх боломжтой CSV файлаар татах"><ArrowDownToLine size={15} /><span>Үр дүн татах</span></button>}
        <span className="sr-only" role="status">{downloaded ? `${list.length} тулгалтын үр дүн бүхий CSV файл бэлэн боллоо.` : ""}</span>
      </div>

      {view === "sources" ? <div className="duty-sources">
        <div className="duty-source-intro"><h2>Шинжилгээнд ашигласан эх баримт</h2><p>{review.sourceFolder} · {review.reviewedAt}</p></div>
        {review.sources.map((s) => {
          const related = review.findings.filter((f) => f.evidence.some((e) => e.source === s.id));
          const issues = related.filter(isIssue).length;
          return <article className="duty-source" key={s.id}>
            <FileText size={20} aria-hidden />
            <div><span className="duty-source-kind">{s.kind}</span><h3>{s.title}</h3><p className="duty-source-file">{s.file}</p><p><b>Тулгалтад хамруулсан хэсэг:</b> {s.reviewed}</p><p>{s.note}</p></div>
            <div className="duty-source-actions">{(["issues", "aligned"] as const).map((target) => <button type="button" key={target} disabled={!(target === "issues" ? issues : related.length - issues)} onClick={() => { setFilters({ ...EMPTY_DUTY_FILTERS, source: s.id }); setSelected(null); setView(target); setDownloaded(false); }}>{target === "issues" ? "Залруулах, тодруулах" : "Нийцэл, уялдаа"}<span className="num">{target === "issues" ? issues : related.length - issues}</span><ArrowRight size={14} /></button>)}</div>
          </article>;
        })}
      </div> : current ? <>
        <div className="duty-detail-nav">
          <button type="button" className="duty-back" onClick={closeFinding}><ArrowLeft size={16} />Жагсаалт руу буцах</button>
          <div><span className="num">{currentIndex + 1} / {list.length}</span><button type="button" aria-label="Өмнөх тулгалт" disabled={currentIndex === 0} onClick={() => openFinding(list[currentIndex - 1].id)}><ChevronLeft size={18} /></button><button type="button" aria-label="Дараах тулгалт" disabled={currentIndex === list.length - 1} onClick={() => openFinding(list[currentIndex + 1].id)}><ChevronRight size={18} /></button></div>
        </div>
        <section className="duty-detail" ref={detailRef} tabIndex={-1} aria-labelledby="duty-detail-title" key={current.id}>
          <header className="duty-detail-heading"><Status status={current.status} /><h2 id="duty-detail-title">{current.title}</h2><p>{current.people.length ? current.people.join(" · ") : "Хэлтсийн түвшинд"}<span aria-hidden> / </span>{current.area}</p></header>
          <section className="duty-proof"><h3><span className="duty-step">1</span>Эх баримт ба системийн харьцуулалт</h3>
            <div className="duty-comparison">
              <section className="duty-compare-side"><header><BookOpen size={17} /><div><h4>Эх баримтын агуулга</h4><p>Холбогдох заалтын агуулга</p></div><span className="num">{current.evidence.length} заалт</span></header><div className="duty-compare-content">{current.evidence.map((e, i) => <article className="duty-evidence" key={`${e.source}-${i}`}><span className="duty-source-kind">{sourceMap.get(e.source)?.title}</span><h5>{e.ref}</h5><p>{e.text}</p><details><summary>Эх файлын нэр <ChevronDown size={12} /></summary><p className="duty-source-file">{sourceMap.get(e.source)?.file}</p></details></article>)}</div></section>
              <section className="duty-compare-side"><header><ListChecks size={17} /><div><h4>Системийн бүртгэл</h4><p>Холбогдох ажлын бүртгэл</p></div><span className="num">{current.tasks.length} ажил</span></header><div className="duty-compare-content"><TaskMatches finding={current} tasks={plan.tasks} /></div></section>
            </div>
          </section>
          <section className="duty-observation"><h3><span className="duty-step">2</span>{isIssue(current) ? "Илэрсэн зөрүү, тодруулах асуудал" : "Нийцэл, уялдааны дүгнэлт"}</h3><p>{current.observation}</p><small>{EXPLANATIONS[current.status]}</small></section>
          {!isIssue(current) && <section className="duty-action"><h3><span className="duty-step">3</span>Цаашид хэрэгжүүлэх зөвлөмж</h3><p>{current.action}</p><span><Info size={13} />Энэхүү зөвлөмж нь системийн ажлын бүртгэлд автомат өөрчлөлт оруулахгүй.</span></section>}
        </section>
      </> : <>
        <div className="duty-filterbar">
          <div className="duty-status-filters" role="group" aria-label="Шинжилгээний ангиллаар шүүх">
            <button type="button" data-status="all" aria-pressed={filters.status === "all"} onClick={() => patch({ status: "all" })}>Бүгд <span className="num">{group.length}</span></button>
            {(view === "issues" ? ISSUE_STATUSES : ALIGNED_STATUSES).map((id) => <button type="button" key={id} data-status={id} className={`is-${toneOf(id)}`} aria-pressed={filters.status === id} onClick={() => patch({ status: id })}><span className="duty-filter-dot" aria-hidden />{LABELS[id]}<span className="num">{group.filter((f) => f.status === id).length}</span></button>)}
          </div>
          <div className="duty-filters">
            <label className="duty-search"><Search size={16} aria-hidden /><input type="search" aria-label="Шинжилгээнээс хайх" placeholder="Ажил, чиг үүрэг эсвэл дугаараар хайх…" value={filters.query} onChange={(e) => patch({ query: e.target.value })} />{filters.query && <button type="button" aria-label="Хайлт арилгах" onClick={() => patch({ query: "" })}><X size={14} /></button>}</label>
            <select aria-label="Холбогдох ажилтнаар шүүх" value={filters.person} onChange={(e) => patch({ person: e.target.value })}><option value="">Бүх ажилтан</option>{people.map((p) => <option key={p}>{p}</option>)}</select>
            <select aria-label="Эх баримтаар шүүх" value={filters.source} onChange={(e) => patch({ source: e.target.value })}><option value="">Бүх эх баримт</option>{review.sources.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          </div>
        </div>
        <div className="duty-list-meta"><span role="status"><b className="num">{list.length}</b> {noun}{filters.status !== "all" && ` · ${LABELS[filters.status]}`}</span>{filtered ? <button type="button" onClick={reset}>Шүүлт цэвэрлэх <X size={12} /></button> : <span>Мөр сонгож дэлгэрэнгүй харьцуулалт, зөвлөмжтэй танилцана уу.</span>}</div>
        <div className="duty-list" ref={listRef} aria-label="Тулгалтын үр дүн">
          {!list.length ? <div className="duty-empty"><Search size={26} /><h2>Шүүлтийн нөхцөлд тохирох үр дүн олдсонгүй</h2><p>Хайлтын утга эсвэл шүүлтийн нөхцөлийг өөрчилнө үү.</p><button type="button" onClick={reset}>Шүүлт цэвэрлэх</button></div> : <>
            <div className="duty-table-head" aria-hidden><span>Ажил, чиг үүрэг</span><span>{view === "issues" ? "Илэрсэн зөрүү, тодруулах асуудал" : "Тулгалтын дүгнэлт"}</span><span>Холбогдох ажилтан</span><span /></div>
            <ol>{list.map((f) => <li key={f.id}><button type="button" data-finding={f.id} className="duty-row" onClick={() => openFinding(f.id)} aria-label={`${f.title} — дэлгэрэнгүй үзэх`}>
              <div className="duty-row-subject"><Status status={f.status} /><strong>{f.title}</strong><span className="duty-row-area">{f.area}</span></div>
              <p className="duty-row-observation">{f.observation}</p>
              <div className="duty-row-people"><span>{f.people.length ? f.people.join(" · ") : "Хэлтсийн түвшинд"}</span><small>{f.evidence.length} баримтын заалт{f.tasks.length > 0 && ` · ${f.tasks.length} ажил`}</small></div>
              <span className="duty-row-open">Харьцуулах <ArrowRight size={15} /></span>
            </button></li>)}</ol>
          </>}
        </div>
      </>}
    </section>
  );
}

function TaskMatches({ finding, tasks }: { finding: DutyFinding; tasks: Task[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const shown = expanded ? finding.tasks : finding.tasks.slice(0, 3);
  if (!shown.length) return <p className="duty-no-task">Энэхүү тулгалт нь баримтын бүрдэл, хамрах хүрээнд хамаарах тул тодорхой ажлын дугаартай холбоогүй болно.</p>;
  return <>
    {shown.map((no) => {
      const t = tasks.find((t) => t.no === no);
      return <article key={no} className="duty-task"><header><span className="num">№{no}</span><strong>{t?.staff ?? "Одоогийн бүртгэлд байхгүй"}</strong></header>{t && <><p>{t.text}</p><details><summary>Хугацаа, шалгуур үзүүлэлт <ChevronDown size={12} /></summary><dl><div><dt>Хугацаа</dt><dd className="num">{t.start} → {t.end}</dd></div><div><dt>Шалгуур</dt><dd>{t.measure || "Бүртгэгдээгүй"}</dd></div><div><dt>Зорилт</dt><dd className="num">{t.target ?? "Бүртгэгдээгүй"}</dd></div></dl></details></>}</article>;
    })}
    {finding.tasks.length > 3 && <button className="duty-expand-tasks" type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>{expanded ? "Эхний 3 ажлыг үзэх" : `Үлдсэн ${finding.tasks.length - 3} ажлыг үзэх`}<ChevronDown size={14} className={expanded ? "rotate-180" : ""} /></button>}
  </>;
}
