"use client";

import * as React from "react";
import { ArrowUp, BookOpen, ChevronDown, ChevronRight, FileSearch, Minus, Moon, Plus, Scale, Search, Sun, X } from "lucide-react";
import { LEGAL_BASIS } from "@/lib/inspection-scheme";
import raw from "@/lib/legal-basis.json";
import { cn, num } from "@/lib/utils";
import styles from "./legal-basis.module.css";

/* --------------------------------------------------------------------------
   ҮНДЭСЛЭЛ ХУУЛЬ, ЖУРАМ

   Эх сурвалж: хэлтсийн хоёр Excel (`D:/Environment/ХХ/legal`, хэрэглэгч
   2026-10-07-нд өгсөн) → {@link scripts/build-legal-basis.py} →
   `lib/legal-basis.json`. Бичвэрт ЗАСВАР ОРООГҮЙ — зөвхөн илүүц зай
   цэвэрлэгдсэн.

   ⚠ Баруун багана 248px тул заалт, асуултыг ТЭНД дэлгэхгүй: картад
   салбарын хуулиуд жагсаж, нэгийг нь товшиход дэлгэцийн баруун талаас
   өргөн САМБАР гарна. Самбар нь ҮНЭХЭЭР хөвөгч гадаргуу тул `.elevated`
   сүүдэр зөвшөөрөгдөнө (санхүүгийн ажлын дэлгэрэнгүйтэй нэг зарчим);
   хөшиг тавихгүй — схем цаанаасаа харагдсаар.

   Хоёр файлын бүтэц ӨӨР тул салбар бүр гурван хэлбэрийн агуулгатай
   байж болно:
     · `sections` — хяналтын асуулга: заалт → асуулт (Хууль, Журам,
       Стандарт, Дүрэм гэсэн табаар);
     · `violations` — Зөрчлийн тухай хуулийн хэсэг → дэд заалт →
       холбогдох салбарын хуулийн заалтууд (ой, амьтан, ургамал);
     · `documents` — журмын бүтэн бичвэр (ойн дөрвөн журам).
   -------------------------------------------------------------------------- */

type CheckItem = { ref: string; lines: string[] };
type Section = { kind: string; items: CheckItem[] };
type Violation = { head: string; sub: string[]; links: string[] };
type Doc = { title: string; lines: string[] };
type Topic = {
  name: string;
  sections: Section[];
  violations: { article: string; items: Violation[] } | null;
  documents: Doc[];
};

const TOPICS = (raw as { topics: Topic[] }).topics;

/** Таб — `kind` нь хуудасны нэр, эсвэл зөрчил/журмын бичвэр */
type Tab = { id: string; label: string; count: number };

function tabsOf(t: Topic): Tab[] {
  const out: Tab[] = t.sections.map((s) => ({
    id: s.kind,
    label: s.kind,
    count: s.items.length,
  }));
  if (t.violations) {
    out.push({ id: "@violations", label: "Зөрчлийн тухай хууль", count: t.violations.items.length });
  }
  if (t.documents.length) {
    out.push({ id: "@documents", label: "Журам", count: t.documents.length });
  }
  return out;
}

/* ---------------- Карт (баруун багана) ---------------- */

export function LegalBasisCard() {
  const [open, setOpen] = React.useState<string | null>(null);
  const topic = open == null ? null : (TOPICS.find((t) => t.name === open) ?? null);

  return (
    <>
      <div className="shrink-0 rounded-xs border border-line bg-paper-2">
        <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
          <Scale size={12} className="shrink-0 text-ink-3" />
          <span className="display flex-1 text-[11.5px] leading-none tracking-[0.05em] uppercase">
            Үндэслэл хууль, журам
          </span>
          <span className="num text-[10px] text-ink-3">
            {num(LEGAL_BASIS.length + TOPICS.length)}
          </span>
        </div>

        {/* Схемийн өөрийн ерөнхий үндэслэл — хэвээр */}
        <ol className="divide-y divide-line">
          {LEGAL_BASIS.map((d) => (
            <li key={d} className="flex gap-2 px-3 py-1.5">
              <span aria-hidden className="mt-[7px] h-px w-2 shrink-0 bg-line-2" />
              <span className="min-w-0 text-[11px] leading-snug text-ink-2">{d}</span>
            </li>
          ))}
        </ol>

        {/* Салбарын хууль тогтоомж — товшиход самбар нээгдэнэ */}
        <div className="border-t border-line bg-paper-3 px-3 py-1.5">
          <span className="eyebrow">Салбарын хууль тогтоомж</span>
        </div>
        <ul className="divide-y divide-line">
          {TOPICS.map((t) => (
            <li key={t.name}>
              <button
                type="button"
                onClick={() => setOpen((cur) => (cur === t.name ? null : t.name))}
                aria-expanded={open === t.name}
                className={cn(
                  "relative flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors",
                  open === t.name ? "bg-(--tone)/10" : "hover:bg-paper-hi",
                )}
              >
                {open === t.name ? (
                  <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] leading-snug text-ink">{t.name}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-ink-3">
                    {tabsOf(t)
                      .map((x) => `${x.label} ${num(x.count)}`)
                      .join(" · ")}
                  </span>
                </span>
                <ChevronRight size={12} className="mt-[3px] shrink-0 text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {topic ? <LegalDrawer key={topic.name} topic={topic} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/* --------------------------------------------------------------------------
   САМБАР — ХУУЛИЙН БАРИМТ БИЧИГ ШИГ

   ⚠⚠ legalinfo.mn-ийн хэлбэрээр (хэрэглэгч, 2026-10-07: "хүнд харуулах
   нь иймэрхүү бүтэцтэй бол зүгээр" — `legalinfo.mn/mn/detail?lawId=367`).
   Өмнөх хоёр хувилбар БУЦААГДСАН — дахин бүү давт:
     1. мөр бүрд урт заалт ТОД, асуулт нь доор бүдэг — "дизайн ерөөсөө
        таалагдсангүй";
     2. зүйлээр бүлэглэсэн жагсаалт, дугаар нь тусдаа 64px баганад —
        бүтэц нь нэг дор харагддаггүй, нэг журмын заалтууд тусдаа
        бүлэг болж задардаг байв.
   ⚠ Зүүн талын "Агуулга" багана мөн ХАСАГДСАН (хэрэглэгч: "ийм хэсэг
   хэрэггүй") — дахин бүү нэм. Журмын табад дөрвөн журам дараалан гарна.
   Уншигдах бичвэр ганцаараа — хуулийн нэр төвд том үсгээр,
   "13 дугаар зүйл." тод гарчиг, заалт нь дугаараа ЭХЭНДЭЭ авсан догол
   мөр ("13.4. …"), шатлал нь дугаарын гүнээр догол мөр болно.
   Ганц фонт (Inter) — платформын дүрэм; legalinfo-гийн serif-ийг
   хуулаагүй.
   -------------------------------------------------------------------------- */

function LegalDrawer({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const tabs = React.useMemo(() => tabsOf(topic), [topic]);
  const [tab, setTab] = React.useState(tabs[0]?.id ?? "");
  const [query, setQuery] = React.useState("");
  const [fontSize, setFontSize] = React.useState(14);
  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    try {
      const saved = localStorage.getItem("legal-basis-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch { /* Storage may be unavailable; keep the selection in memory. */ }
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });
  const body = React.useRef<HTMLDivElement>(null);
  const drawer = React.useRef<HTMLElement>(null);
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
  const drag = React.useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const titleId = React.useId();

  const fitPosition = React.useCallback((point: { x: number; y: number }) => {
    const bounds = drawer.current?.getBoundingClientRect();
    if (!bounds) return point;
    return {
      x: Math.max(12, Math.min(point.x, window.innerWidth - bounds.width - 12)),
      y: Math.max(12, Math.min(point.y, window.innerHeight - bounds.height - 12)),
    };
  }, []);

  React.useEffect(() => {
    const onResize = () => {
      drag.current = null;
      setPosition((current) => window.innerWidth <= 600 ? null : current && fitPosition(current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitPosition]);

  React.useEffect(() => {
    const previous = document.activeElement;
    drawer.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const hit = (...xs: string[]) => !q || xs.some((x) => x.toLowerCase().includes(q));

  const section = topic.sections.find((s) => s.kind === tab);
  const checks = section?.items.filter((it) => hit(it.ref, ...it.lines)) ?? [];
  const groups = groupChecks(checks, topic.name);
  const violations =
    tab === "@violations" && topic.violations
      ? topic.violations.items.filter((v) => hit(v.head, ...v.sub, ...v.links))
      : [];
  const documents =
    tab === "@documents" ? topic.documents.filter((d) => hit(d.title, ...d.lines)) : [];
  const empty = !groups.length && !violations.length && !documents.length;

  const pickTab = (id: string) => {
    setTab(id);
    body.current?.scrollTo({ top: 0 });
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { localStorage.setItem("legal-basis-theme", next); } catch { /* In-memory selection still works. */ }
  };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary || window.innerWidth <= 600) return;
    const bounds = drawer.current?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const from = drag.current;
    if (!from || from.pointerId !== event.pointerId) return;
    setPosition(fitPosition({ x: event.clientX - from.x, y: event.clientY - from.y }));
  };

  const stopDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const moveWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (window.innerWidth <= 600) return;
    if (event.key === "Home") {
      event.preventDefault();
      setPosition(null);
      return;
    }
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    const bounds = drawer.current?.getBoundingClientRect();
    if (!direction || !bounds) return;
    event.preventDefault();
    const step = event.shiftKey ? 48 : 16;
    setPosition(fitPosition({ x: bounds.left + direction[0] * step, y: bounds.top + direction[1] * step }));
  };

  const kindLabel = tabs.find((x) => x.id === tab)?.label ?? "";
  const total = tabs.find((x) => x.id === tab)?.count ?? 0;
  const count = checks.length + violations.length + documents.length;
  const countLabel = tab === "@documents" ? "баримт бичиг" : tab === "@violations" ? "хэсэг" : "заалт";

  return (
    <SearchContext.Provider value={q}>
      <aside
        ref={drawer}
        role="dialog"
        aria-label={topic.name}
        aria-labelledby={empty ? undefined : titleId}
        tabIndex={-1}
        className={cn("elevated", styles.drawer)}
        data-theme={theme}
        style={{
          "--legal-font-size": `${fontSize}px`,
          "--tone": "var(--d-hyanalt)",
          ...(position && { "--legal-x": `${position.x}px`, "--legal-y": `${position.y}px` }),
        } as React.CSSProperties}
      >
        <header className={styles.header}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={styles.dragHandle}
              aria-label="Самбарыг зөөх"
              title="Чирж эсвэл сумтай товчоор зөөх · Давхар товшиж анхны байрлалд буцаах"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onLostPointerCapture={stopDrag}
              onKeyDown={moveWithKeyboard}
              onDoubleClick={() => setPosition(null)}
            >
              <span className={styles.headerIcon}><Scale size={20} aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="eyebrow block">Хяналтын хэлтэс</span>
                <span className="display mt-1 block text-[15px] leading-snug">Хууль, эрх зүйн үндэслэл</span>
              </span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Гэрэл горимд шилжүүлэх" : "Харанхуй горимд шилжүүлэх"}
              title={theme === "dark" ? "Энэ самбарыг гэрэл горимд шилжүүлэх" : "Энэ самбарыг харанхуй горимд шилжүүлэх"}
              className={styles.iconButton}
            >
              {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Хаах"
              title="Хаах (Esc)"
              className={styles.iconButton}
            >
              <X size={18} />
            </button>
          </div>

          <nav aria-label="Баримт бичгийн төрөл" className={styles.tabs}>
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={tab === x.id}
                onClick={() => pickTab(x.id)}
                className={cn(
                  styles.tab,
                  tab === x.id && styles.activeTab,
                )}
              >
                {x.label}
                <span className={cn("num", styles.tabCount)}>{num(x.count)}</span>
              </button>
            ))}
          </nav>
        </header>

        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={16} aria-hidden />
            <input
              type="search"
              aria-label="Бичвэрээс хайх"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                body.current?.scrollTo({ top: 0 });
              }}
              placeholder="Заалт, түлхүүр үгээр хайх…"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Хайлтыг цэвэрлэх" className={styles.clearButton}>
                <X size={14} />
              </button>
            ) : null}
          </label>
          <div className={styles.fontControls} role="group" aria-label="Үсгийн хэмжээ">
            <button type="button" className={styles.iconButton} onClick={() => setFontSize((size) => Math.max(13, size - 1))} disabled={fontSize === 13} aria-label="Үсгийн хэмжээ багасгах" title="Үсгийн хэмжээ багасгах"><Minus size={14} /></button>
            <span className="num" aria-live="polite">{fontSize}</span>
            <button type="button" className={styles.iconButton} onClick={() => setFontSize((size) => Math.min(18, size + 1))} disabled={fontSize === 18} aria-label="Үсгийн хэмжээ томруулах" title="Үсгийн хэмжээ томруулах"><Plus size={14} /></button>
          </div>
        </div>

        <div ref={body} className={styles.body}>
          {empty ? (
            <div className={styles.empty}>
              <FileSearch size={30} strokeWidth={1.4} aria-hidden />
              <p className="display text-[15px] text-ink">Тохирох заалт олдсонгүй</p>
              <p>Өөр түлхүүр үг эсвэл баримт бичгийн төрөл сонгож хайна уу.</p>
              <button type="button" onClick={() => setQuery("")}>Хайлтыг цэвэрлэх</button>
            </div>
          ) : (
            <article className={styles.document}>
              <header className={styles.documentHeader}>
                <div className={styles.documentMeta}>
                  <span className={styles.kind}><BookOpen size={13} aria-hidden />{kindLabel}</span>
                  <span className="num">{num(total)} {countLabel}</span>
                </div>
                <h2 id={titleId}>{topic.name}</h2>
                <p>Хяналт шалгалтад баримтлах хууль тогтоомж, холбогдох заалтууд</p>
              </header>
              {tab === "@documents" ? (
                documents.map((d, i) => (
                  <section key={d.title} className={cn(i > 0 && "mt-10 border-t border-line pt-8")}>
                    <DocText doc={d} />
                  </section>
                ))
              ) : (
                <>
                  {groups.map((g, i) => (
                    <GroupText key={i} id={`g${i}`} group={g} />
                  ))}

                  {tab === "@violations" && topic.violations ? (
                    <>
                      <h3 className={styles.articleHeading}>
                        <Highlighted text={topic.violations.article} />
                      </h3>
                      {violations.map((v, i) => (
                        <ViolationText key={i} id={`v${i}`} item={v} />
                      ))}
                    </>
                  ) : null}
                </>
              )}
            </article>
          )}
        </div>
        <footer className={styles.footer}>
          <span role="status">{q ? `${num(count)} / ${num(total)} ${countLabel} олдлоо` : `Нийт ${num(total)} ${countLabel}`}</span>
          <button type="button" onClick={() => body.current?.scrollTo({ top: 0 })}><ArrowUp size={13} aria-hidden />Эхэнд очих</button>
        </footer>
      </aside>
    </SearchContext.Provider>
  );
}

const SearchContext = React.createContext("");

function Highlighted({ text }: { text: string }) {
  const query = React.useContext(SearchContext);
  if (!query) return text;
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let start = 0;
  let at = lower.indexOf(query);
  while (at !== -1) {
    parts.push(text.slice(start, at));
    parts.push(<mark key={at} className={styles.highlight}>{text.slice(at, at + query.length)}</mark>);
    start = at + query.length;
    at = lower.indexOf(query, start);
  }
  parts.push(text.slice(start));
  return <>{parts}</>;
}

/* --------------------------------------------------------------------------
   ЗААЛТЫГ ЗАДЛАХ — хууль · зүйл · хэсэг

   ⚠ Бичвэрийг ӨӨРЧЛӨХГҮЙ: зөвхөн хаана юу суухыг задална. Задрахгүй
   заалт бүтнээрээ гарчиг болно.
   -------------------------------------------------------------------------- */

type Row = { clause: string; text: string };
/**
 * `title` — "13 дугаар зүйл" (хуулийн заалтад), `note` — зүйлийн нэр эсвэл
 * журам/стандартын бүтэн нэр, `law` — ӨӨР хуулийн нэр харьяалахын тийнд
 * ("Зөрчлийн тухай хуулийн") — гарчиг нь хуулийн бичиглэлээр уншигдана.
 */
type Group = { law: string; title: string; note: string; rows: Row[] };

/** "…тухай хуулийн 13 дугаар зүйл 13.4" */
const REF =
  /^(.*?тухай хуул(?:ь|ийн))\s+(\d+(?:\.\d+)*)\s*(дугаар|дүгээр|дуугаар)?\s*зүйл(?:ийн)?\.?\s*(.*)$/;
/** Хэсгийн дугаар — "9.1.7, 10 дугаар зүйлийн 10.2", "3 дах хэсэг" */
const CLAUSE = /^((?:\d[\d.]*|,|\s|дугаар|дүгээр|зүйлийн|зүйл|дахь|дах|хэсэг)+)(.*)$/;
/** Мөрийн эхэнд суусан дугаар — "7.2.", "1.", "а." */
const LEAD = /^(\d+(?:\.\d+)+|\d+(?=\.)|[а-яё](?=\.\s))\.?\s*(.+)$/i;

/** "…тухай хуулийн" → "…тухай хууль" */
function lawName(s: string) {
  return s.replace(/хуулийн$/, "хууль").trim();
}

type Head = Omit<Group, "rows"> & { clause: string; lead: string; key?: string };

/**
 * Журам, дүрэм, стандартын заалт — дугаар нь нэрийн ТӨГСГӨЛД:
 * "…журмын 2.1.1", "…үлгэрчилсэн дүрмийн 1.2", "…MNS 4943:2015 /5.1/".
 * Нэр нь бүлэг, дугаар нь мөр. Харьяалахын тийн ялгалыг нэрлэхийн
 * тийнд буулгана ("журмын" → "журам") — гарчиг болох хэлбэр.
 *
 * ⚠⚠ `MNS 6458:2014 … :2027` — эх Excel-д НЭГ стандарт 14 мөрд ОН нь
 * нэг нэгээр өсөж бичигдсэн (автомат дүүргэлтийн алдаа). Бүлгийн
 * түлхүүрээс онг хасаж НЭГ бүлэг болгоно; гарчигт ЭХНИЙ бичиглэл гарна.
 * Эх файлыг засвал энэ дүрэм юу ч хийхгүй.
 */
function docHead(ref: string): Head {
  let name = ref.trim();
  let clause = "";
  const slash = name.match(/^(.*?)\s*\/(\d+(?:\.\d+)*)\/$/);
  const tail = name.match(/^(.*?(?:журм|дүрм|зааври?)(?:ын|ийн))\s+(\d+(?:\.\d+)*)\.?$/);
  if (slash) {
    name = slash[1];
    clause = slash[2];
  } else if (tail) {
    name = tail[1]
      .replace(/журмын$/, "журам")
      .replace(/дүрмийн$/, "дүрэм")
      .replace(/зааврын$/, "заавар");
    clause = tail[2];
  }
  const key = name.replace(/(MNS\s*\d+):\d{4}$/, "$1");
  return { law: "", title: "", note: name, clause, lead: "", key };
}

/** Зүйлийн гарчиг: хууль, "13 дугаар зүйл", тайлбар */
function articleHead(ref: string, topicLaw: string): Head {
  const m = ref.match(REF);
  if (!m) return docHead(ref);
  const [, law, art, suffix, rest0] = m;
  const rest = rest0.trim();
  let clause = "";
  let lead = "";
  let note = "";
  if (/^\d/.test(rest)) {
    const c = rest.match(CLAUSE);
    clause = (c?.[1] ?? rest).trim().replace(/[.,]$/, "");
    lead = (c?.[2] ?? "").trim();
    // Өөр хуулийн заалт хамт бичигдсэн бол бүтнээрээ хэсэг болно
    if (/тухай хуул/.test(lead)) {
      clause = rest.replace(/[.,]$/, "");
      lead = "";
    }
  } else {
    note = rest.replace(/^[.\s]+/, "");
  }
  const own = lawName(law) === topicLaw;
  return {
    law: own ? "" : law.replace(/хууль$/, "хуулийн").trim(),
    title: `${art} ${suffix ?? "дугаар"} зүйл`,
    note,
    clause,
    lead,
  };
}

/** Мөрийн эхний дугаарыг салгана — "7.2.Байгаль…" → { "7.2", "Байгаль…" } */
function splitLead(s: string): Row {
  const m = s.match(LEAD);
  return m ? { clause: m[1], text: m[2] } : { clause: "", text: s };
}

/**
 * Таслалаар төгссөн хэлтэрхий мөрүүдийг нэг өгүүлбэр болгоно — эх
 * сурвалж жагсаалтыг ("түр хадгалах,", "цуглуулах," …) мөр мөрөөр
 * бичсэн. Агуулга нь хэвээр, зөвхөн мөрийн хуваалт.
 */
function joinFragments(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev != null && /,$/.test(prev)) out[out.length - 1] = `${prev} ${l}`;
    else out.push(l);
  }
  return out;
}

/**
 * Ижил зүйл, ижил баримт бичгийн заалтууд НЭГ бүлэгт — дараалсан эсэхээс
 * үл хамааран, анх гарсан дарааллаар.
 */
function groupChecks(items: CheckItem[], topicLaw: string): Group[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  for (const it of items) {
    const h = articleHead(it.ref, topicLaw);
    const k = h.key ?? `${h.law}|${h.title}|${h.note}`;
    let g = byKey.get(k);
    if (!g) {
      g = { law: h.law, title: h.title, note: h.note, rows: [] };
      byKey.set(k, g);
      groups.push(g);
    }
    const lines = joinFragments(h.lead ? [h.lead, ...it.lines] : it.lines);
    if (!lines.length) {
      g.rows.push({ clause: h.clause, text: "" });
      continue;
    }
    lines.forEach((l, i) => {
      const own = splitLead(l);
      // Мөр өөрийн дугаартай бол түүнийг, үгүй бол заалтынхыг (эхний мөрд)
      g.rows.push(own.clause ? own : { clause: i === 0 ? h.clause : "", text: l });
    });
  }
  return groups;
}

/* --------------------------------------------------------------------------
   БИЧВЭРИЙН ХЭЛБЭР
   -------------------------------------------------------------------------- */

/** Дугаарын гүн — "13.4" → 1, "2.1.1" → 2, "а" → үсэгт заалт */
function depthOf(clause: string): number {
  if (!clause) return 0;
  if (/^[а-яё]$/i.test(clause)) return 9;
  if (!/^\d+(\.\d+)*$/.test(clause)) return 0;
  return clause.split(".").length - 1;
}

/**
 * Заалтын догол мөр. Дугаар нь бичвэрийн ЭХЭНД ("13.4. …") — legalinfo
 * шиг. Догол нь бүлэг доторх ХАМГИЙН ГҮЕХЭН дугаараас тоологдоно: "13.4"
 * ба "2.1.1" нь өөр бүлэгт хоёулаа эхний шат.
 */
function Clause({ row, indent }: { row: Row; indent: number }) {
  return (
    <p
      className={cn(styles.clause, !row.clause && "indent-6")}
      style={indent ? { paddingLeft: `${Math.min(indent, 3) * 1.25}rem` } : undefined}
    >
      {row.clause ? (
        <span className="num mr-1.5 font-semibold text-ink">
          <Highlighted text={row.clause} />
          {/[.)]$/.test(row.clause) ? "" : "."}
        </span>
      ) : null}
      <Highlighted text={row.text} />
    </p>
  );
}

function rowsWithIndent(rows: Row[]) {
  const ds = rows.map((r) => depthOf(r.clause)).filter((d) => d > 0 && d < 9);
  const base = ds.length ? Math.min(...ds) : 0;
  let prev = 0;
  return rows.map((r) => {
    const d = depthOf(r.clause);
    const indent = d === 9 ? prev + 1 : d > 0 ? Math.max(0, d - base) : prev;
    if (d !== 9) prev = indent;
    return { row: r, indent };
  });
}

function GroupText({ id, group }: { id: string; group: Group }) {
  return (
    <section id={id} className={styles.articleSection}>
      {group.title ? (
        <h3 className={styles.articleHeading}>
          <span className="font-semibold">
            <Highlighted text={`${group.law ? `${group.law} ` : ""}${group.title}.`} />
          </span>
          {group.note ? <span className="font-semibold"> <Highlighted text={group.note} /></span> : null}
        </h3>
      ) : (
        /* Журам, стандарт, дүрэм — баримт бичгийн нэр төвд */
        <h3 className={styles.docHeading}>
          <Highlighted text={group.note} />
        </h3>
      )}
      <div className="space-y-3">
        {rowsWithIndent(group.rows).map(({ row, indent }, i) => (
          <Clause key={i} row={row} indent={indent} />
        ))}
      </div>
    </section>
  );
}

/**
 * Зөрчлийн тухай хуулийн нэг хэсэг — дэд заалт нь догол мөрөөр,
 * холбогдох салбарын заалтууд (нэг хэсэгт 44 хүртэл) анхдагчаар
 * ХУРААГДСАН.
 */
function ViolationText({ id, item }: { id: string; item: Violation }) {
  const [open, setOpen] = React.useState(false);
  return (
    <section id={id} className={styles.articleSection}>
      <div className="space-y-3">
        <Clause row={splitLead(item.head)} indent={0} />
        {item.sub.map((s, i) => (
          <Clause key={i} row={splitLead(s)} indent={1} />
        ))}
      </div>
      {item.links.length ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2 flex items-center gap-1 text-[11.5px] text-(--tone) hover:underline"
          >
            <ChevronDown size={13} className={cn("transition-transform", !open && "-rotate-90")} />
            Холбогдох заалт
            <span className="num text-ink-3">{num(item.links.length)}</span>
          </button>
          {open ? (
            <div className={cn(styles.relatedContent, "mt-2 space-y-1 rounded-xs border-l-2 border-(--tone)/50 bg-paper px-4 py-3")}>
              {item.links.map((l, i) =>
                isArticle(l) ? (
                  <h4
                    key={i}
                    className="pt-1.5 text-[12px] leading-snug font-semibold text-ink first:pt-0"
                  >
                    <Highlighted text={l} />
                  </h4>
                ) : (
                  <p key={i} className="text-[12px] leading-[1.65] text-ink-2">
                    <Highlighted text={l} />
                  </p>
                ),
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** "38 дугаар зүйл.…" гэсэн зүйлийн гарчиг — бусад нь заалт */
function isArticle(s: string) {
  return /^\d+\s+(дугаар|дүгээр)/.test(s);
}

/** Бүлгийн гарчиг: "НЭГ.", "Хоёр." … */
const CHAPTER = /^(нэг|хоёр|гурав|дөрөв|тав|зургаа|долоо|найм|ес|арав)\s*\./i;

/** Журмын бүтэн бичвэр — бүлгийн гарчиг төвд, заалт догол мөрөөр */
function DocText({ doc }: { doc: Doc }) {
  /* Бүлгийн гарчиг нь `null`, заалт нь задалсан мөр — индексээр нь
     догол мөрийн шатлалтай холбоно */
  const rows = doc.lines.map((l) => (CHAPTER.test(l) ? null : splitLead(l)));
  const placed = rowsWithIndent(rows.filter((r): r is Row => r !== null));
  const at: number[] = [];
  let k = 0;
  for (const r of rows) at.push(r ? k++ : -1);
  return (
    <>
      <header className="mb-6 text-center">
        <h3 className={styles.docHeading}>
          <Highlighted text={doc.title} />
        </h3>
      </header>
      <div className="space-y-3">
        {doc.lines.map((l, i) => {
          if (CHAPTER.test(l)) {
            return (
              <h3
                key={i}
                className={styles.chapterHeading}
              >
                <Highlighted text={l} />
              </h3>
            );
          }
          const p = placed[at[i]];
          return <Clause key={i} row={p.row} indent={p.indent} />;
        })}
      </div>
    </>
  );
}
