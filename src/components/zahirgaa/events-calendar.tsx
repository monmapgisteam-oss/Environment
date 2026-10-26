"use client";

/**
 * Байгууллагын арга хэмжээний хөтөлбөр — САРЫН КАЛЕНДАРЬ.
 *
 * Хэрэглэгчийн хүсэлт (2026-10-22): "календарь оруулаад гараас тэдний
 * өдөр тийм юм гэж бичдэг болгоё". Дата нь порталын `Z03_Arga_hemjee`
 * хүснэгт ({@link EVENTS_EDIT_URL}); хуудас унших view-ээс уншина.
 *
 * ⚠ НЭМЭХ, ЗАСАХ, УСТГАХ нь зөвхөн засварлагч бүлгийн гишүүнд
 * ({@link canEditEvents}) — бусдад товч огт гарахгүй, календарь нь
 * зөвхөн унших. Эрх нь СЕРВЕР дээр хамгаалагдсан тул товчийг нуух нь
 * зөвхөн тав тухын асуудал.
 * ⚠ Сонгосон өдрийн жагсаалт ба маягт нь календарийн БАРУУН талд
 * (нарийн дэлгэцэд доор нь) — тусдаа цонх нээхгүй.
 */

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Handshake,
  Pencil,
  Plus,
  Sprout,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Panel, PanelHead } from "@/components/ui/panel";
import { DEPARTMENTS, SHORT_NAMES, type Department } from "@/lib/departments";
import {
  canEditEvents,
  deleteEvent,
  fetchEvents,
  saveEvent,
  type EventInput,
  type EventRow,
} from "@/lib/zahirgaa";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
  "Ням",
];
const STATUSES = ["Төлөвлөгөөт", "Хэрэгжсэн", "Хойшлогдсон", "Цуцлагдсан"];
const ALL_DEPTS = "Бүх хэлтэс";

const pad = (n: number) => String(n).padStart(2, "0");
/** Орон нутгийн огнооны түлхүүр "2026-10-22" */
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const wd = WEEKDAYS[(new Date(y, m - 1, d).getDay() + 6) % 7];
  return `${y}.${pad(m)}.${pad(d)}, ${wd}`;
};

/*
  ТӨРӨЛ — өнгө ба тэмдэгтэй (хэрэглэгч 2026-10-22: "төрлөөр өнгө өнгөөр
  харагдана, тэгээд icon-той"). Маягтын СОНГОЛТ тул тогтмол жагсаалт;
  өмнө нь чөлөөт бичвэр байсан тул жагсаалтад байхгүй утга "Бусад"-ын
  өнгө, тэмдгээр өөрийн нэрээрээ гарна.
  ⚠ Өнгө нь зөвхөн ӨНЦГӨӨРӨӨ ялгаатай (L, C ижил — платформын 3-р дүрэм);
  дохионы `--clay` (25), `--ochre` (85) өнцгийг АВААГҮЙ.
*/
type Kind = { label: string; icon: LucideIcon; hue: number };
const KINDS: Kind[] = [
  { label: "Хурал", icon: Users, hue: 255 },
  { label: "Сургалт", icon: GraduationCap, hue: 300 },
  { label: "Өдөрлөг", icon: Sprout, hue: 150 },
  { label: "Уулзалт", icon: Handshake, hue: 195 },
  { label: "Тайлан", icon: FileText, hue: 340 },
  { label: "Шалгалт", icon: ClipboardCheck, hue: 115 },
];
const OTHER: Kind = { label: "Бусад", icon: CalendarDays, hue: 230 };
const kindOf = (label: string): Kind => {
  const k = label.trim().toLowerCase();
  return (
    KINDS.find((x) => x.label.toLowerCase() === k) ?? {
      ...OTHER,
      label: label.trim() || OTHER.label,
    }
  );
};
/** Дүүргэлт, зураас — эх өнгө; бичвэр, тэмдэг — горимд тохирсон гэрэлтэлт */
const kindFill = (k: Kind) => `oklch(0.74 0.12 ${k.hue})`;
const kindInk = (k: Kind) =>
  `oklch(var(--value-l) calc(0.12 * var(--value-c)) ${k.hue})`;

/*
  ХАРИУЦАХ ХЭЛТЭС — ОЛОН СОНГОЛТ (мөн өдөр: "хариуцах хэлтэс multiple").
  `heltes` талбар (300 тэмдэгт) нь хэлтсийн ТОВЧ нэрсийг таслалаар
  хадгална ("ЗУХ, ХХ") — бүтэн нэрсээр бол долоо сонгоход 300-аас хэтэрнэ.
  Бүгдийг сонговол "Бүх хэлтэс". Унших үед бүтэн нэр ч танигдана (анхны
  бичлэгүүд бүтэн нэрээр хадгалагдсан).
*/
type Depts = { all: boolean; list: Department[]; other: string[] };
const parseDepts = (raw: string): Depts => {
  const out: Depts = { all: false, list: [], other: [] };
  for (const part of raw
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    if (part === ALL_DEPTS) out.all = true;
    else {
      const d = DEPARTMENTS.find(
        (x) => x.name === part || SHORT_NAMES[x.slug] === part,
      );
      if (d) {
        if (!out.list.includes(d)) out.list.push(d);
      } else out.other.push(part);
    }
  }
  if (out.list.length === DEPARTMENTS.length) out.all = true;
  return out;
};
const formatDepts = (all: boolean, list: Department[]) =>
  all || list.length === DEPARTMENTS.length
    ? ALL_DEPTS
    : DEPARTMENTS.filter((d) => list.includes(d))
        .map((d) => SHORT_NAMES[d.slug] ?? d.name)
        .join(", ");

type Loaded = { rev: number; rows?: EventRow[]; error?: string };

export function EventsCalendar() {
  const [rev, setRev] = React.useState(0);
  const [res, setRes] = React.useState<Loaded | null>(null);
  const [editable, setEditable] = React.useState(false);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchEvents(ac.signal).then(
      (rows) => setRes({ rev, rows }),
      (e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRes({ rev, error: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => ac.abort();
  }, [rev]);

  React.useEffect(() => {
    const ac = new AbortController();
    canEditEvents(ac.signal).then(setEditable, () => {});
    return () => ac.abort();
  }, []);

  /* Өнөөдрийг НЭГ удаа барина — зурагдалт бүрд `new Date()` гидрацыг зөрүүлнэ */
  const [today] = React.useState(() => keyOf(new Date()));
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [picked, setPicked] = React.useState(today);
  /** Маягт: `null` — хаалттай, `id` байхгүй — шинэ, байвал засах */
  const [form, setForm] = React.useState<{
    id?: number;
    input: EventInput;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rows = React.useMemo(() => res?.rows ?? [], [res]);
  const byDay = React.useMemo(() => {
    const m = new Map<string, EventRow[]>();
    for (const r of rows) {
      if (r.date === null) continue;
      const k = keyOf(new Date(r.date));
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [rows]);

  /* Сарын тор: Даваа гарагаас эхэлж, тухайн сарын эзлэх долоо хоног (4–6) —
     тогтмол зургаа байхад хоосон долоо хоног картыг дэмий өндөрсгөж байв */
  const cells = React.useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(month.y, month.m + 1, 0).getDate();
    const start = new Date(month.y, month.m, 1 - lead);
    return Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
      const d = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i,
      );
      return {
        key: keyOf(d),
        day: d.getDate(),
        inMonth: d.getMonth() === month.m,
      };
    });
  }, [month]);

  const shift = (n: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const goToday = () => {
    const d = new Date();
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setPicked(today);
  };
  const pick = (key: string) => {
    setPicked(key);
    setForm(null);
    setError(null);
  };

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      setForm(null);
      setRev((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const dayRows = byDay.get(picked) ?? [];
  const loading = !res || res.rev !== rev;
  const monthCount = rows.filter((r) => {
    if (r.date === null) return false;
    const d = new Date(r.date);
    return d.getFullYear() === month.y && d.getMonth() === month.m;
  }).length;

  /* Өнөөдрөөс хойшхи арга хэмжээ — сонгосон өдрийнх дээрээ аль хэдийн гарсан тул давтахгүй */
  const upcoming = React.useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.date !== null &&
            keyOf(new Date(r.date)) >= today &&
            keyOf(new Date(r.date)) !== picked,
        )
        .sort((x, y) => (x.date ?? 0) - (y.date ?? 0))
        .slice(0, 6),
    [rows, today, picked],
  );
  const atToday =
    picked === today &&
    keyOf(new Date(month.y, month.m, 1)).slice(0, 7) === today.slice(0, 7);
  const openNew = () => {
    setError(null);
    setForm({
      input: {
        day: picked,
        name: "",
        kind: "",
        dept: "",
        status: STATUSES[0],
        note: "",
      },
    });
  };
  const jump = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    setMonth({ y, m: m - 1 });
    pick(key);
  };

  return (
    <Panel className="flex shrink-0 flex-col 2xl:h-full 2xl:min-h-0">
      <PanelHead
        title="Байгууллагын арга хэмжээний хөтөлбөр"
        action={
          editable && !form ? (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1 rounded-xs bg-(--tone) px-2 py-1 text-[11.5px] font-medium text-paper hover:opacity-90"
            >
              <Plus size={13} /> Арга хэмжээ нэмэх
            </button>
          ) : undefined
        }
      />

      {/* ---- сар солих мөр ---- */}
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <button
          type="button"
          aria-label="Өмнөх сар"
          onClick={() => shift(-1)}
          className="rounded-xs p-1 text-ink-3 hover:bg-paper-hi hover:text-ink"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="num min-w-[128px] text-center text-[13px] font-semibold text-ink">
          {month.y} оны {month.m + 1}-р сар
        </span>
        <button
          type="button"
          aria-label="Дараагийн сар"
          onClick={() => shift(1)}
          className="rounded-xs p-1 text-ink-3 hover:bg-paper-hi hover:text-ink"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={goToday}
          disabled={atToday}
          className="ml-1 rounded-xs border border-line px-2 py-0.5 text-[11px] text-ink-2 hover:border-line-2 hover:text-ink disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-2"
        >
          Өнөөдөр
        </button>
        <span className="num ml-auto text-[11.5px] text-ink-3">
          Энэ сард {monthCount} арга хэмжээ
        </span>
      </div>

      {res?.error && !loading ? (
        <div className="px-4 py-8 text-center text-[12px] text-clay">
          {res.error}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_248px] 2xl:min-h-0 2xl:flex-1">
          {/* ---- сарын тор ---- */}
          <div
            className={cn("p-3 transition-opacity 2xl:flex 2xl:min-h-0 2xl:flex-col", loading && "opacity-60")}
          >
            <div className="grid grid-cols-7 pb-1.5">
              {WEEKDAYS.map((w, i) => (
                <span
                  key={w}
                  className={cn(
                    "text-center text-[10px] tracking-wide uppercase",
                    i >= 5 ? "text-ink-3/70" : "text-ink-3",
                  )}
                >
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xs border border-line bg-line 2xl:min-h-0 2xl:flex-1 2xl:auto-rows-[minmax(0,1fr)]">
              {cells.map((c, i) => {
                const evs = byDay.get(c.key) ?? [];
                const on = c.key === picked;
                const isToday = c.key === today;
                const weekend = i % 7 >= 5;
                /* Гурав ба түүнээс олон бол хоёрыг нь нэрлээд үлдсэнийг тоогоор */
                const shown = evs.length > 3 ? evs.slice(0, 2) : evs;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => pick(c.key)}
                    aria-pressed={on}
                    aria-label={dayLabel(c.key)}
                    className={cn(
                      "flex min-h-[64px] min-w-0 flex-col gap-0.5 overflow-hidden p-1 text-left transition-colors hover:bg-paper-hi 2xl:min-h-[48px]",
                      weekend ? "bg-paper-3" : "bg-paper-2",
                      on &&
                        "bg-paper-hi shadow-[inset_0_0_0_1.5px_var(--tone)]",
                    )}
                  >
                    <span
                      className={cn(
                        "num flex h-5 min-w-5 items-center justify-center self-start rounded-xs px-1 text-[11px]",
                        c.inMonth ? "text-ink-2" : "text-ink-3/50",
                        on && c.inMonth && "font-semibold text-ink",
                        isToday && "bg-(--tone) font-semibold text-paper",
                      )}
                    >
                      {c.day}
                    </span>
                    <span
                      className={cn(
                        "flex min-w-0 flex-col gap-0.5",
                        !c.inMonth && "opacity-50",
                      )}
                    >
                      {shown.map((e) => {
                        const k = kindOf(e.kind);
                        return (
                          <span
                            key={e.id}
                            title={e.kind ? `${k.label} · ${e.name}` : e.name}
                            className="line-clamp-4 rounded-[2px] border-l-2 px-1 py-px text-[10px] leading-[13px] break-words text-ink 2xl:line-clamp-2"
                            style={{
                              borderColor: kindFill(k),
                              background: `color-mix(in oklab, ${kindFill(k)} 18%, transparent)`,
                            }}
                          >
                            {/* Тэмдэг нь бичвэрийн урсгал дотор — нүдний бүтэн өргөнийг
                                бичвэр эзэлж, үг дундуур тасрахгүй (дөрвөн мөрөөр хязгаар) */}
                            <k.icon
                              size={10}
                              strokeWidth={2}
                              className="mr-0.5 inline-block align-[-1px]"
                              style={{ color: kindInk(k) }}
                            />
                            {e.name}
                          </span>
                        );
                      })}
                      {evs.length > 3 ? (
                        <span className="num px-1 text-[10px] leading-[13px] text-ink-3">
                          +{evs.length - 2}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- сонгосон өдөр ба удахгүй болох ---- */}
          <div className="relative border-t border-line lg:border-t-0 lg:border-l">
            {/* Өндрийг сарын тор тогтооно: баган дотроо гүйнэ, торыг сунгахгүй */}
            <div className="flex flex-col lg:absolute lg:inset-0">
              <div className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2.5">
                <span className="num text-[12.5px] font-semibold text-ink">
                  {dayLabel(picked)}
                </span>
                {dayRows.length ? (
                  <span className="num text-[11px] text-ink-3">
                    {dayRows.length} арга хэмжээ
                  </span>
                ) : null}
              </div>

              {form ? (
                <EventForm
                  value={form.input}
                  kinds={[...new Set(rows.map((r) => r.kind).filter(Boolean))]}
                  busy={busy}
                  error={error}
                  editing={form.id !== undefined}
                  onChange={(input) => setForm({ ...form, input })}
                  onCancel={() => {
                    setForm(null);
                    setError(null);
                  }}
                  onSave={() => run(() => saveEvent(form.input, form.id))}
                />
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {dayRows.length ? (
                    <ul className="divide-y divide-line">
                      {dayRows.map((e) => (
                        <li
                          key={e.id}
                          className="group px-3 py-2.5"
                          style={
                            {
                              "--g": kindFill(kindOf(e.kind)),
                              "--gi": kindInk(kindOf(e.kind)),
                            } as React.CSSProperties
                          }
                        >
                          <div className="flex items-start gap-2">
                            {React.createElement(kindOf(e.kind).icon, {
                              size: 14,
                              strokeWidth: 1.8,
                              className: "mt-[2px] shrink-0 text-(--gi)",
                            })}
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] leading-snug font-medium text-ink">
                                {e.name}
                              </div>
                              {/* Төрөл, төлөв, хэлтэс — энгийн бичвэр (хэрэглэгч 2026-10-22:
                                  "энэ хэсгийг энгийн болго"); өнгө нь зөвхөн тэмдэгт */}
                              {[
                                e.kind && kindOf(e.kind).label,
                                e.status,
                                e.dept && deptText(e.dept),
                              ].some(Boolean) ? (
                                <div
                                  className="mt-0.5 text-[11px] leading-snug text-ink-3"
                                  title={e.dept ? deptTitle(e.dept) : undefined}
                                >
                                  {[
                                    e.kind && kindOf(e.kind).label,
                                    e.status,
                                    e.dept && deptText(e.dept),
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              ) : null}
                              {e.note ? (
                                <div className="mt-1 text-[11.5px] leading-snug text-ink-2">
                                  {e.note}
                                </div>
                              ) : null}
                            </div>
                            {editable ? (
                              <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  aria-label="Засах"
                                  title="Засах"
                                  onClick={() =>
                                    setForm({
                                      id: e.id,
                                      input: {
                                        day: picked,
                                        name: e.name,
                                        kind: e.kind,
                                        dept: e.dept,
                                        status: e.status,
                                        note: e.note,
                                      },
                                    })
                                  }
                                  className="rounded-xs p-1 text-ink-3 hover:bg-paper-hi hover:text-ink"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Устгах"
                                  title="Устгах"
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `"${e.name}" арга хэмжээг устгах уу?`,
                                      )
                                    )
                                      void run(() => deleteEvent(e.id));
                                  }}
                                  className="rounded-xs p-1 text-ink-3 hover:bg-paper-hi hover:text-clay"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-3 py-3.5 text-[12px] text-ink-3">
                      Энэ өдөр арга хэмжээ бүртгэгдээгүй байна
                      {editable ? (
                        <button
                          type="button"
                          onClick={openNew}
                          className="mt-2 flex items-center gap-1 text-[11.5px] text-(--tone) hover:underline"
                        >
                          <Plus size={12} /> Энэ өдөрт нэмэх
                        </button>
                      ) : null}
                    </div>
                  )}
                  {error ? (
                    <div className="px-3 py-2 text-[11.5px] text-clay">
                      {error}
                    </div>
                  ) : null}

                  {/* Удахгүй болох — өнөөдрөөс хойшхи эхний зургаа; товшиход тэр өдөр рүү очно */}
                  <div className="border-t border-line">
                    <div className="eyebrow px-3 pt-2.5 pb-1.5">
                      Удахгүй болох
                    </div>
                    {upcoming.length ? (
                      <ul className="pb-2">
                        {upcoming.map((e) => {
                          const k = keyOf(new Date(e.date ?? 0));
                          return (
                            <li key={e.id}>
                              <button
                                type="button"
                                onClick={() => jump(k)}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-paper-hi",
                                  k === picked && "bg-paper-hi",
                                )}
                              >
                                <span className="num w-9 shrink-0 text-[11px] text-ink-3">
                                  {k.slice(5).replace("-", ".")}
                                </span>
                                {React.createElement(kindOf(e.kind).icon, {
                                  size: 12,
                                  strokeWidth: 1.8,
                                  className: "shrink-0",
                                  style: { color: kindInk(kindOf(e.kind)) },
                                })}
                                <span
                                  className="truncate text-[12px] text-ink-2"
                                  title={e.name}
                                >
                                  {e.name}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-3 pb-3 text-[11.5px] text-ink-3">
                        Төлөвлөсөн арга хэмжээ бүртгэгдээгүй байна
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------ маягт ----------------------------- */

function EventForm({
  value,
  kinds,
  busy,
  error,
  editing,
  onChange,
  onCancel,
  onSave,
}: {
  value: EventInput;
  kinds: string[];
  busy: boolean;
  error: string | null;
  editing: boolean;
  onChange: (v: EventInput) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set =
    (k: keyof EventInput) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      onChange({ ...value, [k]: e.target.value });
  const field =
    "w-full rounded-xs border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-(--tone)";
  const label = "mb-1 block text-[11px] text-ink-3";
  const ok = value.name.trim() && value.day;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && !busy) onSave();
      }}
    >
      <label>
        <span className={label}>Арга хэмжээний нэр</span>
        <input
          type="text"
          required
          value={value.name}
          onChange={set("name")}
          className={field}
          autoFocus
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className={label}>Огноо</span>
          <input
            type="date"
            required
            value={value.day}
            onChange={set("day")}
            className={cn(field, "num px-1.5")}
          />
        </label>
        <label>
          <span className={label}>Төрөл</span>
          <select value={value.kind} onChange={set("kind")} className={field}>
            <option value="">—</option>
            {[
              ...KINDS.map((k) => k.label),
              OTHER.label,
              ...kinds.filter(
                (k) => kindOf(k).icon === OTHER.icon && k !== OTHER.label,
              ),
            ].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DeptPicker
        value={value.dept}
        onChange={(dept) => onChange({ ...value, dept })}
        label={label}
      />
      <label>
        <span className={label}>Төлөв</span>
        <select value={value.status} onChange={set("status")} className={field}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={label}>Тайлбар</span>
        <textarea
          rows={2}
          value={value.note}
          onChange={set("note")}
          className={cn(field, "resize-none")}
        />
      </label>
      {error ? <div className="text-[11.5px] text-clay">{error}</div> : null}
      <div className="mt-auto flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xs border border-line px-2.5 py-1 text-[12px] text-ink-2 hover:border-line-2 hover:text-ink"
        >
          Болих
        </button>
        <button
          type="submit"
          disabled={!ok || busy}
          className="rounded-xs bg-(--tone) px-2.5 py-1 text-[12px] font-medium text-paper disabled:opacity-40"
        >
          {busy ? "Хадгалж байна" : editing ? "Хадгалах" : "Нэмэх"}
        </button>
      </div>
    </form>
  );
}

/* ---------------------------- хэлтэс ------------------------------ */

/** Хариуцах хэлтсүүд — товч нэрээр ("ЗУХ, ХХ"); бүтэн нэр нь `title`-д */
const deptText = (raw: string) => {
  const d = parseDepts(raw);
  return d.all
    ? ALL_DEPTS
    : [...d.list.map((x) => SHORT_NAMES[x.slug] ?? x.name), ...d.other].join(
        ", ",
      );
};
const deptTitle = (raw: string) => {
  const d = parseDepts(raw);
  return d.all
    ? ALL_DEPTS
    : [...d.list.map((x) => x.name), ...d.other].join(", ");
};

/**
 * Олон сонголттой хэлтэс — ТОВЧ нэрийн жижиг товчнууд (бүтэн нэр `title`-д).
 * ⚠ Тэмдэг, сонгох нүдтэй бүтэн нэрийн жагсаалт байсныг хэрэглэгч "хэт
 * нүсэр" гэж буцаав (2026-10-22) — найман мөр маягтын ихэнхийг эзэлж байв.
 */
function DeptPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const cur = parseDepts(value);
  const all = cur.all;
  const toggle = (d: Department) => {
    const base = all ? DEPARTMENTS : cur.list;
    const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d];
    onChange(formatDepts(false, next));
  };
  const chip = (on: boolean) =>
    cn(
      "rounded-xs border px-1.5 py-0.5 text-[11px] transition-colors",
      on
        ? "border-(--tone) bg-(--tone)/15 text-ink"
        : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
    );
  return (
    <div>
      <span className={label}>Хариуцах хэлтэс</span>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          aria-pressed={all}
          onClick={() => onChange(all ? "" : ALL_DEPTS)}
          className={chip(all)}
        >
          {ALL_DEPTS}
        </button>
        {DEPARTMENTS.map((d) => {
          const on = !all && cur.list.includes(d);
          return (
            <button
              key={d.slug}
              type="button"
              aria-pressed={on}
              title={d.name}
              onClick={() => toggle(d)}
              className={chip(on)}
            >
              {SHORT_NAMES[d.slug] ?? d.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
