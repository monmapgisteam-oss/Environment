"use client";

import * as React from "react";
import { Building2, ChevronLeft, ChevronRight, Layers, Loader2, User, UserRound, Network, Users, RotateCcw, Search, CalendarDays, X } from "lucide-react";
import "./organization.css";
import "./tasks.css";
import {
  dayOf,
  deadlineOf,
  DEADLINE_LABELS,
  elapsed,
  fetchPlan,
  planDay,
  recordedProgress,
  rollup,
  summarizeTasks,
  type DeadlineState,
  type PlanData,
  type Staff,
  type Task,
  type Unit,
} from "@/lib/sanhuu";
import { cn, num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Ажлын төлөвлөгөөний биелэлт

   ЗОРИЛГО: албан хаагч бүр өөрийн гүйцэтгэх ажлын хүрээнд ажиллаж
   байгаа эсэхийг хянах.

   ЭНЭ НЬ САМБАР БИШ, ТАЙЛАНГИЙН ХУУДАС. Платформын бусад 23 харагдац
   бүгд "шүүлтүүрийн мөр → гурван багана" гэсэн нэг хэвтэй; энд тэр
   хэвийг ЗОРИУДААР орхив. Шалтгаан нь агуулга: энэ дата газарзүйн ч
   биш, тоолж хуваарилах бүртгэл ч биш — БАЙГУУЛЛАГЫН БҮТЭЦ ба түүн
   дэх хүмүүсийн гүйцэтгэл.

   Тиймээс хуудас нь ДЭЭРЭЭС ДООШ гурван давхаргаар уншигдана:
     1. Бүтэц — хэлтсийг мөчир салаагаар нь ЗУРСАН орг-схем,
     2. Албан хаагч — сонгосон мөчрийн хүмүүс, тус бүр хэмжигчтэй,
     3. Гүйцэтгэх ажил — сонгосон хүний ажлууд.
   Дээд давхарга нь доод давхаргынхаа хамрах хүрээг тодорхойлно.

   ХОЛБООС ШУГАМЫГ SVG-ГҮЙ зурав: эцэг зангилаанаас доош 1px унжаа,
   хүүхдүүдийн дээгүүр хэвтээ төмөр, тус бүрээс доош унжаа. Гурвуулаа
   `border`-оор гарна — MapLibre ч, зургийн сан ч шаардлагагүй бөгөөд
   өнгө нь платформын `--line-2`-ыг шууд дагана.
   -------------------------------------------------------------------------- */

/**
 * Хугацааны явц хэрэгжилтээс хэр давсныг зэрэглэнэ.
 *
 * Дохионы гурван өнгө: `--moss` хэвийн, `--ochre` анхаар, `--clay`
 * ноцтой. Эрэмбэтэй хэмжүүр тул өнгө зөвшөөрөгдөнө (хөрсний PLI-тэй
 * ижил зарчим). Хил нь эх сурвалжийнх БИШ, уншихад туслах зэрэглэл.
 */
const GAP_BANDS = [
  { id: "ok", label: "Хэвийн", hi: 15, tone: "var(--moss)" },
  { id: "watch", label: "Анхаарах", hi: 40, tone: "var(--ochre)" },
  { id: "risk", label: "Ноцтой хоцролт", hi: Infinity, tone: "var(--clay)" },
] as const;

function bandOf(gap: number | null) {
  if (gap == null) return GAP_BANDS[0];
  return GAP_BANDS.find((b) => gap <= b.hi) ?? GAP_BANDS[2];
}

export function SanhuuDashboard() {
  const [data, setData] = React.useState<PlanData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [unit, setUnit] = React.useState("heltes");
  const [person, setPerson] = React.useState<string | null>(null);
  /*
    ⚠⚠ АЛБАН ХААГЧИЙН НЭР ТОВЧООР ГАРНА (хэрэглэгчийн хүсэлт,
    2026-09-21: "ажилтан гэж дарвал модон дээр нэрс гарч ирнэ").

    Мод нь анхнаасаа зөвхөн НЭГЖҮҮДИЙГ харуулна — нэр бүр өөрийн мөр,
    албан тушаал, хэмжигчтэй тул зангилаа хоёр, гурав дахин өндөрсөж,
    бүтэц нь тэдний дунд алдагддаг байв. Товч дарахад нэрс нээгдэнэ.
    ⚠ Хэдэн хүн байгаа нь нуугдахгүй: зангилаа бүр "Шууд харьяалах: N"
    гэж тоогоороо хэлсээр байна.
  */
  const [showStaff, setShowStaff] = React.useState(false);
  /* Хажуугийн самбарт нээгдсэн ажил */
  const [detail, setDetail] = React.useState<number | null>(null);
  const [recordFilter, setRecordFilter] = React.useState<"all" | "zero" | "missing">("all");
  const [status, setStatus] = React.useState<DeadlineState | null>(null);
  const [query, setQuery] = React.useState("");

  /*
    Өнөөдрийг НЭГ УДАА барина. Зурагдалт бүрд `new Date()` дуудвал
    сервер ба хөтөч дээр өөр утга гарч, гидраци зөрөх эрсдэлтэй.
  */
  const [today] = React.useState(() => planDay());

  React.useEffect(() => {
    const ac = new AbortController();
    fetchPlan(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const units = React.useMemo(() => data?.units ?? [], [data]);
  const tasks = React.useMemo(() => data?.tasks ?? [], [data]);

  /* Мод дээрх тоо нь ҮРГЭЛЖ бүтэн — шүүлтээс хамаарч хэлбэлзвэл
     хэрэглэгч байршлаа алдана */
  const tree = React.useMemo(() => rollup(units, tasks, today), [units, tasks, today]);

  const scope = React.useMemo(() => tree.get(unit)?.tasks ?? [], [tree, unit]);

  /*
    Хүн тус бүрийн үзүүлэлт. Ажилтан бүр ЯГ НЭГ зангилаанд харьяалагддаг
    тул модны хаана ч байсан нэг л удаа тооцно — зангилаа солигдох бүрд
    дахин бодох шаардлагагүй.
  */
  const people = React.useMemo(() => {
    const pos = new Map((data?.staff ?? []).map((s) => [s.name, s.position]));
    const by = new Map<string, Task[]>();
    for (const t of tasks) by.set(t.staff, [...(by.get(t.staff) ?? []), t]);
    const out = new Map<string, PersonStat>();
    for (const [name, ts] of by) {
      const summary = summarizeTasks(ts, today);
      const starts = ts.map((t) => t.start).filter(Boolean).sort();
      const ends = ts.map((t) => t.end).filter(Boolean).sort();
      out.set(name, {
        name,
        position: pos.get(name) ?? "",
        n: ts.length,
        ...summary,
        gap: summary.progress == null ? null : summary.elapsed - summary.progress,
        start: starts[0] ?? "",
        end: ends[ends.length - 1] ?? "",
      });
    }
    return out;
  }, [tasks, data, today]);

  /** Сонгосон нэгж, хүний ажлууд — төлөв, тэглэлтийн шүүлтээс ӨМНӨ */
  const pool = React.useMemo(
    () => (person ? scope.filter((t) => t.staff === person) : scope),
    [scope, person],
  );

  const statusTabs = React.useMemo(() => {
    const seen = new Map<DeadlineState, number>();
    for (const t of pool) {
      const key = deadlineOf(t, today);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen].map(([id, n]) => ({ id, n, label: DEADLINE_LABELS[id] }));
  }, [pool, today]);
  const activeStatus = statusTabs.some((x) => x.id === status) ? status : null;
  const zeroCount = pool.filter((t) => recordedProgress(t) === 0).length;
  const missingCount = pool.filter((t) => recordedProgress(t) == null).length;
  const activeRecord = (recordFilter === "zero" && !zeroCount) ||
    (recordFilter === "missing" && !missingCount) ? "all" : recordFilter;
  const list = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return pool.filter((t) => {
      const progress = recordedProgress(t);
      return (activeRecord !== "zero" || progress === 0) &&
        (activeRecord !== "missing" || progress == null) &&
        (activeStatus == null || deadlineOf(t, today) === activeStatus) &&
        (!needle || `${t.no} ${t.text} ${t.staff}`.toLocaleLowerCase().includes(needle));
    }).sort((a, b) => a.no - b.no);
  }, [pool, activeRecord, activeStatus, query, today]);

  /** Хажуугийн самбарт нээгдсэн ажил */
  const detailTask = React.useMemo(
    () => (detail == null ? null : (tasks.find((t) => t.no === detail) ?? null)),
    [tasks, detail],
  );

  /** Модны үндэс — сонголт цуцлахад буцаж очих газар */
  const rootId = React.useMemo(
    () => units.find((u) => u.parent === null)?.id ?? "heltes",
    [units],
  );

  /*
    Сонгосон зангилааг ДАХИН товшиход сонголт цуцлагдаж хэлтсийн бүтэн
    хүрээ рүү буцна. Үүнгүй бол хэрэглэгч мөчир сонгосны дараа буцах
    арга олдохгүй — үндсийг нь тусгайлан хайх шаардлагатай болдог.
  */
  /*
    ⚠⚠ ХҮҮХДҮҮД НЬ ДЭЛГЭГДЭЖ БУЙ НЭГЖ. Сонголт (`unit`, ажлын
    жагсаалтыг шүүнэ) ба гүнзгийрэлт (`focus`, зурагт аль шат
    харагдах) нь ХОЁР ӨӨР зүйл: хүүхэдгүй нэгж дээр товшиход
    сонголт өөрчлөгдөх ч зураг байрандаа үлдэнэ.
  */
  const [focus, setFocus] = React.useState("heltes");
  const resetTaskView = React.useCallback(() => {
    setRecordFilter("all");
    setStatus(null);
    setQuery("");
    setDetail(null);
  }, []);

  const pickUnit = React.useCallback(
    (id: string) => {
      resetTaskView();
      setUnit(id);
      setPerson(null);
      /* ⚠ Хүүхэдгүй нэгж ч ФОКУС авна (2026-09-22): мөчрийн харагдацад
         баруун тал нь тэр нэгжийн АЖЛУУД тул хоосон болохгүй — урьд нь
         "хүүхэдтэй бол л гүнзгийрнэ" гэсэн дүрэм Дотоод хяналт зэрэг
         навчин нэгжийг зөвхөн сонгоод, дэлгэц хөдөлгөөнгүй үлдээж байв */
      setFocus(id);
    },
    [resetTaskView],
  );

  /* Зам заагчаас товшиход тэр шат руу БУЦАЖ гарна */
  const goTo = React.useCallback((id: string) => {
    resetTaskView();
    setFocus(id);
    setUnit(id);
    setPerson(null);
  }, [resetTaskView]);

  /*
    Хүн сонгоход түүний зангилаа руу мөн шилжинэ. Эс тэгвээс өөр мөчир
    сонгоод байхад хүн товшиход хамрах хүрээнд нь тэр хүний ажил
    байхгүй тул жагсаалт хоосон гарна.
  */
  const pickPerson = React.useCallback(
    (name: string) => {
      resetTaskView();
      if (person === name) {
        setPerson(null);
        return;
      }
      const u = data?.staff.find((x) => x.name === name)?.unit;
      if (u) setUnit(u);
      setPerson(name);
    },
    [person, data, resetTaskView],
  );

  if (error) {
    return (
      <Shell>
        <div className="px-4 py-10 text-center">
          <p className="text-[14px] font-medium">
            Төлөвлөгөөний биелэлтийг татаж чадсангүй
          </p>
          <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-ink-3">
          <Loader2 size={14} className="animate-spin" />
          Төлөвлөгөөний биелэлт татаж байна…
        </div>
      </Shell>
    );
  }

  const unitLabel = units.find((u) => u.id === unit)?.label ?? "";
  const scopedPeople = [...new Set(pool.map((t) => t.staff))];
  const showTaskStaff = !person && scopedPeople.length > 1;
  const taskNote = person ?? (scopedPeople.length === 1 ? `${unitLabel} · ${scopedPeople[0]}` : unitLabel);


  /** Мөчир рүү орсон эсэх — зүүн талд том карт, баруун талд ажлууд */
  const deep = focus !== rootId;

  /*
    Ажлын жагсаалт ХОЁР газар гарна: албан хаагчийн хуудсанд бүтэн
    өргөнөөр, мөчрийн харагдацад том картын БАРУУН талд. Нэг JSX —
    хоёр газар хуулбарлавал шүүлтүүр, самбар хоёр эрт орой зөрнө.
  */
  const taskSection = (
    <section className="task-panel" aria-label="Гүйцэтгэх ажлууд">
      <header className="task-toolbar">
        <div className="task-heading">
          <h2>Гүйцэтгэх ажил <span className="task-count num">{num(pool.length)}</span></h2>
          <p>{taskNote}</p>
        </div>
        <label className="task-search">
          <Search size={14} aria-hidden />
          <input type="search" aria-label="Ажил хайх" placeholder="Ажил, ажилтан хайх…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </header>
      <div className="task-filters">
        <div className="task-record-filters" role="group" aria-label="Гүйцэтгэлийн бүртгэлээр шүүх">
          <button type="button" aria-pressed={activeRecord === "all"} onClick={() => setRecordFilter("all")}>Бүгд <span className="num">{num(pool.length)}</span></button>
          {zeroCount > 0 && <button type="button" aria-pressed={activeRecord === "zero"} onClick={() => setRecordFilter("zero")}>0% <span className="num">{num(zeroCount)}</span></button>}
          {missingCount > 0 && <button type="button" aria-pressed={activeRecord === "missing"} onClick={() => setRecordFilter("missing")}>Мэдээлэлгүй <span className="num">{num(missingCount)}</span></button>}
        </div>
        <label className="task-deadline-filter">
          <CalendarDays size={13} aria-hidden />
          <select aria-label="Хугацааны төлөвөөр шүүх" value={activeStatus ?? ""} onChange={(e) => setStatus(e.target.value ? e.target.value as DeadlineState : null)}>
            <option value="">Бүх хугацаа</option>
            {statusTabs.map((x) => <option key={x.id} value={x.id}>{x.label} · {num(x.n)}</option>)}
          </select>
        </label>
        {(activeRecord !== "all" || activeStatus || query) && <button type="button" className="task-clear" onClick={() => { setRecordFilter("all"); setStatus(null); setQuery(""); }}>Шүүлт цэвэрлэх <X size={12} aria-hidden /></button>}
      </div>
    {list.length === 0 ? (
      <Empty text="Тохирох ажил олдсонгүй" />
    ) : (
      <>
        <TaskHead showStaff={showTaskStaff} />
        <ol className="task-list">
          {list.map((t) => (
            <TaskRow
              key={t.no}
              task={t}
              today={today}
              showStaff={showTaskStaff}
              open={detail === t.no}
              onOpen={() => setDetail((v) => (v === t.no ? null : t.no))}
            />
          ))}
        </ol>
      </>
    )}

      <footer className="task-footer" aria-live="polite"><span><b className="num">{num(list.length)}</b> / {num(pool.length)} ажил</span><span>Мөр сонгож дэлгэрэнгүйг харна</span></footer>
    </section>
  );


  return (
    <Shell>
      {/*
        ⚠⚠ ХОЁР ХУУДАС ЭЭЛЖЛЭНЭ (хэрэглэгчийн шийдвэр, 2026-09-21).
        Албан хаагч сонгогдсон үед МОД БҮХЭЛДЭЭ солигдож, тухайн хүний
        хуудас нээгдэнэ; доорх ажлын жагсаалт нь түүний ажил болно.
        Мод нь БҮТЦИЙН, хүний хуудас нь ГҮЙЦЭТГЭЛИЙН асуулт — хоёуланг
        нэг дэлгэцэнд нийлүүлэхэд жагсаалт нь модны сүүл мэт болж,
        хүний үзүүлэлт хаана ч гардаггүй байв.
      */}
      {person && people.get(person) ? (
        <PersonPage
          stat={people.get(person)!}
          units={units}
          unitId={data.staff.find((x) => x.name === person)?.unit ?? null}
          onBack={() => { resetTaskView(); setPerson(null); }}
          onUnit={goTo}
        >
          {taskSection}
        </PersonPage>
      ) : (
        <>
        {/* ---- 1. БҮТЭЦ, ХҮМҮҮС ---- */}
        <section className="organization" aria-label="Байгууллагын бүтэц">
          <header className="org-toolbar">
            <div className="org-title"><Network size={17} aria-hidden /><h2>Байгууллагын бүтэц</h2></div>
            <OrgPath units={units} focus={focus} onPick={goTo} />
            {/* ⚠ Нэрийг нуухад СОНГОЛТ нь ч цуцлагдана — эс тэгвээс
                сонгогдсон хүн хаана ч харагдахгүй атлаа доорх ажлын
                жагсаалтыг шүүсээр үлдэнэ */}
            <button
              type="button"
              className="org-toggle"
              aria-pressed={showStaff}
              onClick={() =>
                setShowStaff((v) => {
                  if (v) setPerson(null);
                  return !v;
                })
              }
            >
              <User size={12} aria-hidden />
              Албан хаагч
            </button>
            <button type="button" className="org-reset" disabled={unit === rootId && person == null && focus === rootId} onClick={() => goTo(rootId)} aria-label="Бүх бүтэц" title="Бүх бүтэц"><RotateCcw size={13} aria-hidden /></button>
          </header>
          {/* ⚠ Хэмжигчийн тайлбар ("Хэрэгжилт | Хугацааны явц") ХАСАГДСАН
            (хэрэглэгчийн шийдвэр, 2026-09-22). Карт бүр "12% хэрэгжилт ·
            72% хугацаа" гэж хоёр тоогоо өөрөө бичдэг тул тайлбар давхардал
            байв. */}
        <div className="org-guide"><span>Нэгж сонгож бүтцийг задлах, албан хаагч сонгож ажлуудыг харна.</span></div>
          {/*
            ⚠⚠ МӨЧИР РҮҮ ОРСОН ҮЕД ХОЁР БАГАНА (хэрэглэгчийн санаа,
            2026-09-22: "Дотоод хяналт дээр дарлаа — бусад картууд
            харагдахгүй, зөвхөн Дотоод хяналт зүүн тийш шилжээд нилээн
            томорно; картын баруун талд тухайн албан хаагчийн ажлууд
            гарч ирнэ"). Урьд нь мөчрийн дэд мод дэлгэцийн голд
            дэлгэгдэж, ажил нь хаана ч гардаггүй байв.
            ⚠ Картын АГУУЛГА хараахан эцэслээгүй — хэрэглэгч дараа нь
            хэлнэ; одоо ердийн карт томорсон хэлбэрээр.
          */}
          <div className={cn("org-body", deep && "is-focus")}>
            <OrgChart
              units={units}
              tree={tree}
              staff={data.staff}
              people={people}
              selected={unit}
              person={person}
              showStaff={showStaff}
              focus={focus}
              onPick={pickUnit}
              onPickHead={goTo}
              onPickPerson={pickPerson}
            />
            {deep ? <div className="org-tasks">{taskSection}</div> : null}
          </div>
        </section>

        </>
      )}

      {/*
        ⚠⚠ АЖЛЫН ЖАГСААЛТ ЗӨВХӨН АЛБАН ХААГЧИЙН ХУУДСАНД (хэрэглэгчийн
        шийдвэр, 2026-09-21: "ажлын модны доор байгаа тэр хэсгийг
        delete"). Модны доор бүх хэлтсийн 130 мөр жагсаж, модыг
        дэлгэцээс түлхдэг байв — мод нь БҮТЦИЙН асуулт тул хариултаа
        өөрийнхөө карт дээр (ажлын тоо, хэрэгжилт) аль хэдийн хэлдэг.
        ⚠ Ажил руу очих зам: мод → албан хаагч → түүний хуудас.
      */}
      {detailTask ? (
        <TaskDrawer
          task={detailTask}
          today={today}
          data={data}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </Shell>
  );
}

/* --------------------------------------------------------------------------
   АЛБАН ХААГЧИЙН ХУУДАС

   ⚠⚠ АЖЛЫН ЖАГСААЛТ МОДНЫ ДООР ГАРАХАА БОЛИВ (хэрэглэгчийн шийдвэр,
   2026-09-21: "хаагч дээр дарвал тэр доор гарч ирэхгүй, өөр page дээр
   харагдана"). Хүн сонгоход мод нь БҮХЭЛДЭЭ солигдож, тухайн албан
   хаагчийн хуудас нээгдэнэ.

   Яагаад вэ: мод нь БҮТЦИЙН асуулт ("хэн хаана харьяалагддаг вэ"),
   хүний хуудас нь ГҮЙЦЭТГЭЛИЙН асуулт ("энэ хүн юу хийж байна вэ").
   Хоёуланг нэг дэлгэцэнд нийлүүлэхэд ажлын жагсаалт модны сүүл мэт
   болж, хүний үзүүлэлт нь хаана ч гардаггүй байв.

   ⚠ БУЦАХ ЗАМ ЗААВАЛ: хуудасны толгойд "Байгууллагын бүтэц" товч.
   Үүнгүй бол хэрэглэгч модонд буцаж очих арга олохгүй.

   ⚠ Албан хаагчийн ХАРЬЯАЛАЛ зам заагчаар гарна — тэр хүн модны аль
   мөчирт байгааг хуудас нь өөрөө хэлэх ёстой.
   -------------------------------------------------------------------------- */

function PersonPage({
  stat,
  units,
  unitId,
  onBack,
  onUnit,
  children,
}: {
  stat: PersonStat;
  units: Unit[];
  /** Албан хаагчийн харьяалагдах нэгж */
  unitId: string | null;
  onBack: () => void;
  onUnit: (id: string) => void;
  /** Тэр хүний ажлын жагсаалт — картын БАРУУН талд */
  children: React.ReactNode;
}) {
  const chain: Unit[] = [];
  let at: string | null = unitId;
  while (at) {
    const u: Unit | undefined = units.find((x) => x.id === at);
    if (!u) break;
    chain.unshift(u);
    at = u.parent;
  }
  const band = bandOf(stat.gap);

  return (
    <section className="person-page" aria-label="Албан хаагчийн хуудас">
      <header className="person-head">
        <button type="button" className="org-reset" onClick={onBack}>
          <ChevronLeft size={12} aria-hidden />
          Байгууллагын бүтэц
        </button>
        {chain.length ? (
          <nav className="org-path" aria-label="Харьяалал">
            {chain.map((u, i) => (
              <React.Fragment key={u.id}>
                {i ? (
                  <ChevronRight size={11} aria-hidden className="org-path-sep" />
                ) : null}
                <button type="button" onClick={() => onUnit(u.id)}>
                  {u.label}
                </button>
              </React.Fragment>
            ))}
            <ChevronRight size={11} aria-hidden className="org-path-sep" />
            <button type="button" disabled aria-current="true">
              {stat.name}
            </button>
          </nav>
        ) : null}
      </header>

      {/*
        ⚠⚠ МӨЧРИЙН ХАРАГДАЦТАЙ НЭГ ХЭВ (хэрэглэгч, 2026-09-22: хүн дээр
        дарахад "хуучин" бүтэн өргөнтэй хуудас гарч байсныг заав).
        Зүүнд хүний КАРТ (нэгжийн картын загвараар — `org-node`), баруунд
        ажлын жагсаалт. Нэгж, хүн хоёр дээр нэг л хэлбэр гарна.
      */}
      <div className="org-body is-focus">
        <div className="org-chart is-deep person-chart">
          <div className="org-node person-node">
            <div className="person-hero">
              <span className="person-avatar" aria-hidden>
                <User size={20} strokeWidth={1.5} />
              </span>
              <span className="person-id">
                <span className="org-node-name" title={stat.name}>
                  {stat.name}
                </span>
                {stat.position ? <span className="person-position">{stat.position}</span> : null}
                {chain.length ? (
                  <span className="person-unit">
                    <Layers size={10} aria-hidden />
                    {chain[chain.length - 1].label}
                  </span>
                ) : null}
              </span>
            </div>

            {/*
              ⚠⚠ КАРТ ЭНГИЙН (хэрэглэгч, 2026-09-22: "ойлгомжгүй байна").
              Өмнөх хувилбар цагираг, хэмжигч, зөрүүний тэмдэг, зурвас,
              гурван нүд гээд ТАВАН хийсвэр дүрстэй байсан — тус бүр нь
              тайлбар шаардаж байв. Одоо хоёр блок, дүрс нь хоёрхон:
              1. ХЭРЭГЖИЛТ БА ХУГАЦАА — хоёр тоо, нэг хэмжигч, доор нь
                 зөрүүг ЭНГИЙН ӨГҮҮЛБЭРЭЭР ("хугацааны явцаас 24 пунктээр
                 бага"). "Хоцорсон" гэж шийдэхгүй, зөвхөн баримт.
              2. АЖЛЫН БАЙДАЛ — дөрвөн мөр, мөр бүр бүтэн шошго, тоо ба
                 нийтэд эзлэх хувийн нимгэн зурвас. Нэг хэлбэр давтагдах
                 тул сурах шаардлагагүй.
            */}
            {/*
              ⚠⚠ "ХУГАЦААНЫ ЯВЦ" ГЭДЭГ ОЙЛГОЛТ ӨӨРӨӨ ХИЙСВЭР (хэрэглэгч,
              2026-09-22: "энийг ерөөсөө ойлгохгүй юм"). Хоёр том хувь,
              bullet хэмжигч, "пунктээр бага" гэсэн өгүүлбэр — гурвуулаа
              тайлбар шаардаж байв. Одоо:
              · хоёр ЗЭРЭГЦЭЭ ЗУРВАС (платформын мөрөн диаграмтай нэг
                хэлбэр): дээд нь хийгдсэн ажил, доод нь өнгөрсөн хугацаа —
                урт нь шууд харьцуулагдана, тайлбар хэрэггүй;
              · хугацаа нь ОГНООГООР ил: "2026.01.01 – 2026.12.31";
              · доор нь нэг өгүүлбэр: "Хугацааны 73% нь өнгөрсөн, ажлын
                0% нь хэрэгжсэн байна."
            */}
            <div className="person-block">
              <span className="eyebrow">Гүйцэтгэл</span>
              <div className="person-bars">
                <div>
                  <span className="person-bars-label">Хийгдсэн ажил</span>
                  <span className="num person-bars-val" style={{ color: stat.progress == null ? undefined : band.tone }}>
                    {stat.progress == null ? "—" : `${num(stat.progress, 0)}%`}
                  </span>
                  <span className="person-bars-track" aria-hidden>
                    <span style={{ width: `${Math.min(stat.progress ?? 0, 100)}%`, background: band.tone }} />
                  </span>
                </div>
                <div>
                  <span className="person-bars-label">Өнгөрсөн хугацаа</span>
                  <span className="num person-bars-val">{num(stat.elapsed, 0)}%</span>
                  <span className="person-bars-track" aria-hidden>
                    <span className="is-time" style={{ width: `${Math.min(stat.elapsed, 100)}%` }} />
                  </span>
                </div>
              </div>
              {stat.start && stat.end ? (
                <p className="person-dates">
                  <span>Ажлын хугацаа</span>
                  <span className="num">{dots(stat.start)} – {dots(stat.end)}</span>
                </p>
              ) : null}
              <p className="person-note">{gapText(stat)}</p>
            </div>

            <div className="person-block">
              <div className="person-block-head">
                <span className="eyebrow">Ажлын байдал</span>
                <span className="num person-big">{num(stat.n)} ажил</span>
              </div>
              <PersonRows stat={stat} />
            </div>
          </div>
        </div>
        <div className="org-tasks">{children}</div>
      </div>
    </section>
  );
}

/**
 * Хэрэгжилт ба хугацааны явцын зөрүүг ЭНГИЙН ӨГҮҮЛБЭРЭЭР. "Хоцорсон"
 * гэж ШИЙДЭХГҮЙ (явц нь жигд гэсэн таамаг дээрх тооцоо) — зөвхөн хоёр
 * тооны зөрүүг хэлнэ, дүгнэлт хүнийх.
 */
function gapText(stat: PersonStat): string {
  const t = num(stat.elapsed, 0);
  if (stat.progress == null)
    return `Хугацааны ${t}% нь өнгөрсөн; гүйцэтгэлийн мэдээлэл оруулаагүй тул хэрэгжилт тооцоогүй.`;
  return `Хугацааны ${t}% нь өнгөрсөн, ажлын ${num(stat.progress, 0)}% нь хэрэгжсэн байна.`;
}

/** ISO огноог "2026.01.01" хэлбэрт */
function dots(iso: string): string {
  return iso.replaceAll("-", ".");
}

/**
 * Ажлын байдал — дөрвөн мөр, нэг хэлбэр: шошго · тоо · нийтэд эзлэх
 * хувийн зурвас. Эхний гурав нь нийлээд яг N (хэрэгжилтээ хэрхэн
 * бүртгүүлснээр), дөрөв дэх нь төлөв. Тэг мөр ч харагдана —
 * "оруулаагүй 0" гэдэг нь өөрөө мэдээлэл.
 * ⚠ Өнгө = утга: 0% мөр `--clay`, оруулаагүй мөр зураастай, бусад `--tone`.
 */
function PersonRows({ stat }: { stat: PersonStat }) {
  const some = Math.max(0, stat.n - stat.zero - stat.missing);
  const rows = [
    { label: "Хэрэгжилт бүртгэсэн", n: some, cls: "" },
    { label: "Хэрэгжилт 0% гэж бүртгэсэн", n: stat.zero, cls: "is-zero" },
    { label: "Гүйцэтгэлийн мэдээлэл оруулаагүй", n: stat.missing, cls: "is-missing" },
    { label: "Төлөв тэмдэглэсэн", n: stat.stated, cls: "" },
  ];
  return (
    <dl className="person-rows">
      {rows.map((x) => (
        <div key={x.label}>
          <dt>{x.label}</dt>
          <dd className="num">
            {num(x.n)}
            <small> / {num(stat.n)}</small>
          </dd>
          <span className={cn("person-rows-bar", x.cls)} aria-hidden>
            <span style={{ width: `${stat.n ? (x.n / stat.n) * 100 : 0}%` }} />
          </span>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  /* ⚠ ГАДНА ГҮЙЛГҮҮРГҮЙ (хэрэглэгчийн хүсэлт, 2026-09-22: "энд байгаа
     scroll-ыг устгаад дотор нь оруул"). Бүрхүүл өндрөө барьж хөдлөхгүй;
     толгой, зам заагч үргэлж харагдаж, зөвхөн модны бие ба ажлын
     жагсаалт тус тусдаа гүйнэ (`.org-body`, `.org-tasks`). */
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xs border border-line bg-paper-2">
      {children}
    </div>
  );
}

type PersonStat = {
  name: string;
  position: string;
  n: number;
  progress: number | null;
  elapsed: number;
  gap: number | null;
  zero: number;
  missing: number;
  stated: number;
  /** Ажлуудын хамгийн эрт эхлэх, хамгийн сүүлд дуусах огноо (ISO) */
  start: string;
  end: string;
};

/* --------------------------------------------------------------------------
   ОРГ-СХЕМ

   Хэлтсийг мөчир салаагаар нь зурна. Холбоос нь 1px зураас: эцгээс
   доош унжаа → хүүхдүүдийн дээгүүр хэвтээ төмөр → тус бүр рүү унжаа.

   Хамгийн гадна талын хүүхдийн хувьд хэвтээ төмөр нь ЗӨВХӨН дотогшоо
   сунана (эхнийх нь голоос баруун тийш, сүүлчийнх нь голоос зүүн тийш)
   — эс тэгвээс зураас модноос гадагш цухуйна.

   АЛБАН ХААГЧ НЬ ЗАНГИЛААНЫ ДОТОР сууна, тусдаа хайрцаг БИШ. Ажил нь
   хүнд оногддог тул зангилааны тоо гэдэг нь түүнд харьяалагдах
   хүмүүсийн ажлын нийлбэр — хүнийг гадуур нь тавьбал тэр холбоо
   таслагдана.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   МОД — ХОЁР ШАТ, ГҮНЗГИЙРЭХ ЗАМААР

   ⚠⚠ ГУРАВ ДАХЬ ХУВИЛБАР (хэрэглэгчийн санаа, 2026-09-21: "зүгээр л
   dynamic болгочихвол болох юм байна — Санхүү, төсөв карт дээр дарвал
   одоогийн бүтэц биш зураг дээрх шиг бүтэцтэй болно").

   Өмнөх хоёр нь хоёулаа БҮХ ШАТЫГ ЗЭРЭГ зурахыг оролдож бүтэлгүйтсэн:
     (1) бүгд хэвтээ — мод хажуу тийш хэдэн мянган пиксел сунаж,
         гүйлгүүргүйгээр уншигдахгүй;
     (2) гүний шат нь догол мөрт жагсаалт — нэг бүлэг ганцаараа доошоо
         сунаж, хажуугийн гурав нь хоосон үлддэг.

   Шийдэл нь шатыг ЦӨӨРҮҮЛЭХ: дэлгэц дээр ҮРГЭЛЖ ХОЁР шат л байна —
   сонгосон нэгж дээрээ, түүний ШУУД харьяа нэгжүүд доороо эгнэнэ.
   Хүүхэдтэй карт дээр товшиход тэр нь дээд байрандаа гарч, өөрийн
   хүүхдүүдээ дэлгэнэ. Гүн хэдэн ч шат байсан зураг нь ижил өндөртэй.

   ⚠ Буцах зам нь ЗАМ ЗААГЧ (`org-path`): хаана байгаагаа харуулаад,
   аль ч шат руу нэг товшилтоор буцаана. Үүнгүй бол гүнзгийрсэн
   хэрэглэгч "Бүх бүтэц" дээр дарж эхнээс нь эхлэхээс өөр аргагүй.

   ⚠ ХҮҮХЭДГҮЙ нэгж дээр товшиход ГҮНЗГИЙРЭХГҮЙ — зөвхөн сонгогдоно.
   Эс тэгвээс дэлгэц хоосон болж, хэрэглэгч замаа алдана.
   -------------------------------------------------------------------------- */

function OrgChart({
  units,
  tree,
  staff,
  people,
  selected,
  person,
  showStaff,
  focus,
  onPick,
  onPickHead,
  onPickPerson,
}: {
  units: Unit[];
  tree: ReturnType<typeof rollup>;
  staff: Staff[];
  people: Map<string, PersonStat>;
  selected: string;
  person: string | null;
  showStaff: boolean;
  /** Хүүхдүүд нь дэлгэгдэж буй нэгж */
  focus: string;
  onPick: (id: string) => void;
  /** Дээд картын товшилт — гүнзгийрэлтийг хөндөхгүй, зөвхөн сонгоно */
  onPickHead: (id: string) => void;
  onPickPerson: (name: string) => void;
}) {
  const head = units.find((u) => u.id === focus);
  if (!head) return null;
  const kids = units.filter((u) => u.parent === focus);
  const countKids = (id: string) => units.filter((u) => u.parent === id).length;
  /** Үндэс дээр хоёр шат, мөчир дотор бүтэн задаргаа */
  const deep = head.parent !== null;

  return (
    <div className={cn("org-chart", deep && "is-deep")}>
      {/* ⚠ Гүйлтийн хүрээ ба агуулга нь ХОЁР ӨӨР элемент байна:
          нэг элемент зэрэг гүйж, зэрэг агуулгынхаа өргөнөөр тэлж
          чадахгүй. Дээд карт нь энэ давхаргын ДОТОР голлоно */}
      <div className="org-canvas">
        <div className="org-root">
          <NodeCard
            unit={head}
            tree={tree}
            staff={staff}
            people={people}
            on={selected === head.id}
            person={person}
            showStaff={showStaff}
            kids={0}
            depth={depthOf(head.id, units)}
            onPick={() => onPickHead(head.id)}
            onPickPerson={onPickPerson}
          />
        </div>
        {kids.length ? (
          <div className="org-branches">
            {kids.map((u) => (
              <div key={u.id} className="org-branch">
                {/*
                  ⚠ Мөчир рүү орсон үед хүүхдүүд нь том картын ДООР босоо
                  цуварна (2026-09-22): дэлгэцийн баруун тал ажлын
                  жагсаалтынх болсон тул хэвтээ тарах зай байхгүй. Товшиход
                  цааш гүнзгийрнэ.
                */}
                <NodeCard
                  unit={u}
                  tree={tree}
                  staff={staff}
                  people={people}
                  on={selected === u.id}
                  person={person}
                  showStaff={showStaff}
                  kids={countKids(u.id)}
                  depth={depthOf(u.id, units)}
                  onPick={() => onPick(u.id)}
                  onPickPerson={onPickPerson}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Зам заагч — үндэснээс сонгосон нэгж хүртэл */
function OrgPath({
  units,
  focus,
  onPick,
}: {
  units: Unit[];
  focus: string;
  onPick: (id: string) => void;
}) {
  const chain: Unit[] = [];
  let at: string | null = focus;
  while (at) {
    const u: Unit | undefined = units.find((x) => x.id === at);
    if (!u) break;
    chain.unshift(u);
    at = u.parent;
  }
  return (
    <nav className="org-path" aria-label="Бүтцийн зам">
      {chain.map((u, i) => (
        <React.Fragment key={u.id}>
          {i ? (
            <ChevronRight size={11} aria-hidden className="org-path-sep" />
          ) : null}
          <button
            type="button"
            onClick={() => onPick(u.id)}
            aria-current={i === chain.length - 1 ? "true" : undefined}
            disabled={i === chain.length - 1}
          >
            {u.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}

/*
  ⚠⚠ ЗАНГИЛААНЫ ТЭМДЭГ нь ТҮВШНИЙГ хэлнэ, агуулгыг БИШ (2026-09-21).
  Хэлтсийн таксономи нь хэлтэс → бүлэг → дэд бүлэг → зардлын ангилал
  гэсэн дөрвөн шатлалтай бөгөөд ГҮН нь баримт мөн. Харин "Цалин"-д
  хэтэвч, "Тендер"-т алх зэрэг тэмдэг өгөх нь утгыг ТААМАГЛАХ болно —
  эх сурвалж зангилааны төрлийг хэлээгүй.
*/
const LEVEL_ICONS = [Building2, Network, Layers] as const;

/** Зангилааны шат — үндэс нь 0 */
function depthOf(id: string, units: Unit[]): number {
  let d = 0;
  let at = units.find((u) => u.id === id)?.parent ?? null;
  while (at) {
    d += 1;
    at = units.find((u) => u.id === at)?.parent ?? null;
  }
  return d;
}

function NodeCard({
  unit,
  tree,
  staff,
  people,
  on,
  person,
  showStaff,
  kids,
  depth,
  onPick,
  onPickPerson,
}: {
  unit: Unit;
  tree: ReturnType<typeof rollup>;
  staff: Staff[];
  people: Map<string, PersonStat>;
  on: boolean;
  person: string | null;
  showStaff: boolean;
  /** Шууд харьяа НЭГЖИЙН тоо — товшиход гүнзгийрнэ гэдгийн дохио */
  kids: number;
  /** Модны шат — тэмдэг үүнээс гарна */
  depth: number;
  onPick: () => void;
  onPickPerson: (name: string) => void;
}) {
  const r = tree.get(unit.id);
  const n = r?.tasks.length ?? 0;
  const mine = staff
    .filter((x) => x.unit === unit.id)
    .map((x): PersonStat => people.get(x.name) ?? { name: x.name, position: x.position, n: 0, progress: null, elapsed: 0, gap: null, zero: 0, missing: 0, stated: 0, start: "", end: "" })
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0) || b.n - a.n);
  const band = bandOf(n ? (r?.elapsed ?? 0) - (r?.progress ?? 0) : null);

  return (
    <div
      className={cn(
        "org-node",
        on && !person && "is-selected",
        mine.some((x) => x.name === person) && "has-selected-person",
      )}
    >
      <button type="button" onClick={onPick} aria-pressed={on && !person} className="org-node-heading">
        <div className="org-node-top">
          {unit.no ? (
            <span
              className={cn(
                "org-number num",
                on ? "text-(--tone)" : "text-ink-3",
              )}
            >
              {unit.no}
            </span>
          ) : null}
          <span
            className={cn(
              "org-node-name min-w-0 flex-1 text-[11.5px] leading-snug",
              on ? "font-medium text-(--tone)" : "text-ink",
            )}
            title={unit.label}
          >
            {unit.label}
          </span>
          {/* ⚠ Тэмдэг нь ТҮВШНИЙ тэмдэглэгээ — баруун дээд буланд,
              сонгогдсон үед хэлтсийн өнгөөр асна */}
          <span className="org-node-icon" aria-hidden>
            {React.createElement(
              LEVEL_ICONS[Math.min(depth, LEVEL_ICONS.length - 1)],
              { size: 14, strokeWidth: 1.7 },
            )}
          </span>
        </div>
        <div className="org-node-summary">
          <span className="org-work-count"><strong className="num">{num(n)}</strong><span>ажил</span></span>
          <div className="org-summary-context">
            {mine.length ? <span title="Шууд харьяалах албан хаагч"><Users size={12} aria-hidden />Шууд харьяалах: <b className="num">{num(mine.length)}</b></span> : null}
            {kids ? <span className="org-node-kids"><Network size={12} aria-hidden />Дэд бүтэц <b className="num">{num(kids)}</b><ChevronRight size={12} aria-hidden /></span> : null}
          </div>
        </div>

        {n ? (
          <>
            <div className="org-progress">
              <div className="org-progress-labels"><span title="Гүйцэтгэл бүртгэсэн ажлуудын дундаж">Хэрэгжилт <strong className="num" style={{ color: band.tone }}>{r?.progress == null ? "—" : `${num(r.progress, 0)}%`}</strong></span><span>Хугацаа <b className="num">{num(r?.elapsed ?? 0, 0)}%</b></span></div>
              {r?.progress != null && <Bullet progress={r.progress} elapsed={r.elapsed} />}
            </div>

            {/*
              Хяналтын гол тоо: энэ мөчирт хэдэн ажил огт тэмдэглэгдээгүй
              вэ. Дундаж хэрэгжилт нь үүнийг нуудаг — цөөн ажил өндөр
              хувьтай байхад л дундаж өснө.
            */}
            {r && r.missing ? (
              <div className="org-pending">
                <span>Гүйцэтгэл оруулаагүй</span><strong className="num">{num(r.missing)}</strong>
              </div>
            ) : null}
          </>
        ) : (
          /*
            ⚠⚠ ХОЁР ӨӨР ХООСОН ТӨЛӨВ (2026-09-10-ны шийдвэр). Албан
            хаагчтай атлаа ажилгүй мөчир нь "ажил бүртгэгдээгүй" —
            төлөвлөгөөний БАЙДАЛ. Харин албан хаагч ч, ажил ч байхгүй
            зангилаанууд (Цалин, Тендер, Нийслэлийн төсөв …) нь ӨӨР эх
            сурвалжийнх: тэдний дата хараахан ИРЭЭГҮЙ. Хоёуланг нь нэг
            бичвэрээр хэлбэл дата ирээгүйг "ажил алга" гэж ХУДЛАА
            мэдээлнэ.
            ⚠ `.hatch` тасархай блок нь платформын хоосон төлөвийн
            дүрэм — "хоосон" биш "хүлээгдэж буй" гэдгийг дүрсээр хэлнэ.
          */
          <div
            className={cn(
              "org-empty text-[10px] leading-snug text-ink-3",
              !mine.length &&
                "hatch rounded-xs border border-dashed border-line-2 px-1.5 py-1",
            )}
          >
            {mine.length ? "Ажил бүртгэгдээгүй" : "Мэдээлэл хүлээгдэж байна"}
          </div>
        )}
      </button>

      {/* Албан хаагч — зангилааны ДОТОР, товч дарсан үед */}
      {showStaff && mine.length ? (
        <div className="org-staff-list">
          {mine.map((x) => (
            <PersonRow
              key={x.name}
              row={x}
              on={person === x.name}
              onPick={() => onPickPerson(x.name)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Зангилааны доторх нэг албан хаагч.
 *
 * Нэр, ажлын тоо, хэмжигч гурав нэг мөрөнд — картын өргөн 228px тул
 * албан тушаал нь зөвхөн `title`-д үлдэнэ. Ажлын тоо нь зангилааны
 * нийлбэрийг задлан харуулна.
 */
function PersonRow({
  row,
  on,
  onPick,
}: {
  row: PersonStat;
  on: boolean;
  onPick: () => void;
}) {
  const band = bandOf(row.gap);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      title={`${row.name} · ${row.position}`}
      className={cn(
        "org-person relative block w-full text-left transition-colors",
        on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
      )}
    >
      {on ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)" />
      ) : null}
      <div className="flex items-center gap-1.5">
        <span className="org-person-icon" aria-hidden="true">
          <UserRound size={14} strokeWidth={1.7} />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 text-[11px] leading-snug",
            on ? "font-medium text-ink" : "text-ink-2",
          )}
        >
          {row.name}
        </span>
        <span className="num shrink-0 text-[10px] text-ink-3">{num(row.n)} ажил</span>
      </div>
      {row.position ? <p className="org-position">{row.position}</p> : null}
      {row.n && row.progress != null ? <div className="org-person-progress mt-1.5 flex items-center gap-1.5">
        <Bullet progress={row.progress} elapsed={row.elapsed} thin />
        <span className="num shrink-0 text-[9.5px]" style={{ color: band.tone }}>
          {num(row.progress, 0)}%
        </span>
      </div> : <p className="org-position">{row.n ? "Гүйцэтгэл оруулаагүй" : "Ажил бүртгэгдээгүй"}</p>}
    </button>
  );
}

/* --------------------------------------------------------------------------
   ХЭМЖИГЧ

   Дүүргэлт нь ХЭРЭГЖИЛТ, босоо заагч нь ХУГАЦААНЫ ЯВЦ. Хоёр тоог
   зэрэгцүүлэх нь энэ хуудасны гол зорилго: заагчаас хойш унасан
   дүүргэлт нь хоцролтыг өөрөө хэлнэ. Өнгө нь зөрүүний зэргээс.
   -------------------------------------------------------------------------- */

function Bullet({
  progress,
  elapsed: el,
  thin,
}: {
  progress: number;
  elapsed: number;
  thin?: boolean;
}) {
  const band = bandOf(el - progress);
  return (
    <span
      className={cn(
        "relative block w-full overflow-hidden rounded-[1px] bg-paper-hi",
        thin ? "h-[3px]" : "h-[5px]",
      )}
    >
      <span
        className="absolute inset-y-0 left-0"
        style={{ width: `${Math.min(progress, 100)}%`, background: band.tone }}
      />
      <span
        aria-hidden
        className="absolute inset-y-0 w-[2px] bg-ink-2"
        style={{ left: `calc(${Math.min(el, 100)}% - 1px)` }}
      />
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   ГҮЙЦЭТГЭХ АЖЛЫН ЖАГСААЛТ

   Мөр нь ажлын нэр, бүртгэсэн хэрэгжилт, дуусах огноо, огнооноос
   тооцсон төлөвийг салгаж харуулна. Хугацааны явц ба эх сурвалжийн
   гараар бичсэн төлөв нь дэлгэрэнгүй самбарт байна. Хоосон гүйцэтгэл
   нь 0% биш; хоосон төлөвөөс "Хугацаандаа" гэсэн дүгнэлт гаргахгүй.

   Мөр нь дэлгэрдгийг ХЭЛЭХ ёстой: урьд нь бүтэн мөр нь товч байсан ч
   ямар ч тэмдэг байгаагүй тул товшиж болохыг мэдэх аргагүй байв.

   Ажлын нэр дунджаар 131 тэмдэгт, дээд тал нь 262 — хураахгүй бол
   мөрүүд өөр өөр өндөртэй болж жагсаалт тасарна. Хоёр мөрөнд хураагаад
   бүтнээр нь дэлгэрэнгүйд гаргана.
   -------------------------------------------------------------------------- */

function TaskHead({ showStaff }: { showStaff: boolean }) {
  return (
    <div className="task-grid task-columns" aria-hidden="true">
      <span>№</span>
      <span>Гүйцэтгэх ажил{showStaff ? " · албан хаагч" : ""}</span>
      <span>Хэрэгжилт</span>
      <span>Дуусах огноо</span>
      <span>Хугацааны төлөв</span>
      <span />
    </div>
  );
}

function DeadlineBadge({ state }: { state: DeadlineState }) {
  return <span className={`task-status is-${state}`}><span aria-hidden="true" />{DEADLINE_LABELS[state]}</span>;
}

function TaskProgress({ value }: { value: number | null }) {
  return value == null ? (
    <span className="task-missing">Мэдээлэл оруулаагүй</span>
  ) : (
    <span className={cn("task-progress-value", value >= 100 && "is-complete")}>
      <strong className="num">{num(value, 0)}<small>%</small></strong>
      <span className="task-progress-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></span>
    </span>
  );
}

function TaskRow({ task, today, showStaff, open, onOpen }: {
  task: Task;
  today: number;
  showStaff: boolean;
  open: boolean;
  onOpen: () => void;
}) {
  const progress = recordedProgress(task);
  const state = deadlineOf(task, today);
  return (
    <li>
      <button type="button" onClick={onOpen} aria-expanded={open} aria-controls={open ? "task-detail" : undefined}
        data-task-no={task.no} className={cn("task-grid task-row", open && "is-open")}>
        <span className="task-number num">{task.no}</span>
        <span className="task-title-cell">
          <span className="task-name">{task.text}</span>
          {showStaff && <span className="task-assignee"><UserRound size={11} aria-hidden />{task.staff}</span>}
        </span>
        <span className="task-progress-cell">
          <span className="task-mobile-label">Хэрэгжилт</span>
          <TaskProgress value={progress} />
        </span>
        <span className="task-due-cell">
          <span className="task-mobile-label">Дуусах огноо</span>
          <span className="num">{dayOf(task.end) == null ? "—" : task.end.replaceAll("-", ".")}</span>
        </span>
        <span className="task-status-cell"><DeadlineBadge state={state} /></span>
        <ChevronRight size={14} className="task-chevron" aria-hidden />
      </button>
    </li>
  );
}


/* --------------------------------------------------------------------------
   АЖЛЫН ДЭЛГЭРЭНГҮЙ — ХАЖУУГИЙН САМБАР

   ⚠⚠ МӨРИЙН ДОТОР ДЭЛГЭХЭЭ БОЛИВ (хэрэглэгчийн хүсэлт, 2026-09-21,
   жишээ зураг заан: "ийм маягаар хажуу талд гарч ирдэг бол зүгээр").
   Дэлгэрэнгүй нь мөрийг ДООШ ТҮЛХЭЖ, доорх ажлуудыг дэлгэцээс
   шахдаг байв — нэг ажлыг уншиж байхад жагсаалтын байрлал алдагддаг.
   Хажуугийн самбар нь жагсаалтыг ХӨДӨЛГӨХГҮЙ: өөр мөр товшиход
   агуулга нь солигдоно, байрлал нь хэвээр.

   ⚠ Самбар нь ҮНЭХЭЭР ХӨВЖ буй гадаргуу тул платформын `.elevated`
   сүүдэр энд ЗӨВШӨӨРӨГДӨНӨ (дүрэм: сүүдэр зөвхөн хөвөгч гадаргууд).
   Картууд нь өөрсдөө сүүдэргүй, 1px зураасаар л тусгаарлагдана.

   ⚠ ХӨШИГ (scrim) ТАВИХГҮЙ: жагсаалт цаанаасаа харагдаж, дараагийн
   мөрөө шууд товшиж болно. Хөшиг нь "энэ бол цонх, хаа" гэсэн
   шаардлага тавьдаг — энд самбар нь уншихад туслах хавсралт.

   ⚠ Товшсон мөр нь жагсаалтдаа ТОДОРНО, эс тэгвээс самбар хаанаас
   гарсныг мэдэхгүй.
   -------------------------------------------------------------------------- */

function TaskDrawer({ task, today, data, onClose }: {
  task: Task;
  today: number;
  data: PlanData;
  onClose: () => void;
}) {
  const el = elapsed(task, today);
  const progress = recordedProgress(task);
  const state = deadlineOf(task, today);
  const cat = data.categories.find((c) => c.id === task.category);
  const staff = data.staff.find((x) => x.name === task.staff);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    const trigger = document.activeElement;
    titleRef.current?.focus();
    return () => { if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <aside id="task-detail" className="task-drawer elevated" role="dialog" aria-modal="false" aria-labelledby="task-detail-title">
      <header className="task-drawer-head">
        <span>Ажлын дэлгэрэнгүй <span className="num">№ {task.no}</span></span>
        <button type="button" onClick={onClose} aria-label="Ажлын дэлгэрэнгүйг хаах"><X size={16} aria-hidden /></button>
      </header>
      <div className="task-drawer-body" key={task.no}>
        <DeadlineBadge state={state} />
        <h2 id="task-detail-title" ref={titleRef} tabIndex={-1} className="task-drawer-title">{task.text}</h2>
        <div className="task-owner">
          <span className="task-owner-icon"><UserRound size={17} aria-hidden /></span>
          <div><strong>{task.staff}</strong><p>{staff?.position || "Албан тушаал тэмдэглэгдээгүй"}</p></div>
        </div>
        <div className="task-drawer-progress">
          <span className="task-detail-label">Хэрэгжилт</span>
          <TaskProgress value={progress} />
          {progress == null && <p className="task-detail-note">Гүйцэтгэлийн утга оруулаагүй байна. Энэ нь бүртгэсэн 0%-аас ялгаатай.</p>}
        </div>
        <div className="task-schedule">
          <div className="task-schedule-dates">
            <span><small>Эхлэх огноо</small><b className="num">{task.start || "—"}</b></span>
            <span><small>Дуусах огноо</small><b className="num">{task.end || "—"}</b></span>
          </div>
          <div className="task-time-track" aria-hidden="true"><span style={{ width: `${el ?? 0}%` }} /></div>
          <div className="task-schedule-summary"><span>Хугацааны явц <b className="num">{el == null ? "—" : `${num(el, 1)}%`}</b></span><span className="num">{task.days == null ? "" : `${num(task.days)} хоног`}</span></div>
          <p className="task-detail-note">Хугацааны явц нь өнгөрсөн хугацааг харуулна. Шаардлагатай гүйцэтгэлийн хувь биш.</p>
        </div>
        <dl className="task-drawer-grid">
          <div><dt>Зорилтот түвшин</dt><dd className="num">{task.target == null ? "Тэмдэглэгдээгүй" : num(task.target)}</dd></div>
          <div><dt>Гүйцэтгэл</dt><dd className="num">{task.performance == null ? "Оруулаагүй" : num(task.performance)}</dd></div>
          <div className="is-wide"><dt>Хэмжих үзүүлэлт</dt><dd>{task.measure || "Тэмдэглэгдээгүй"}</dd></div>
          <div className="is-wide"><dt>Бүртгэсэн төлөв · Excel</dt><dd>{task.status || "Тэмдэглэгдээгүй"}</dd></div>
          <div className="is-wide"><dt>Ажлын ангилал</dt><dd>{cat?.label || "Тэмдэглэгдээгүй"}</dd></div>
        </dl>
      </div>
    </aside>
  );
}


function Empty({ text }: { text: string }) {
  return (
    <div className="hatch m-4 flex items-center justify-center rounded-xs border border-dashed border-line-2 px-4 py-8">
      <p className="text-center text-[11.5px] leading-snug text-ink-3">{text}</p>
    </div>
  );
}
