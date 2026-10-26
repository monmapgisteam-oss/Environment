"use client";

/**
 * Албан хаагчийн бүртгэл засах — шинэ ажилтан, ажлаас гарсан, албан
 * тушаал, хэлтэс солигдсон (хэрэглэгч 2026-10-26).
 *
 * Шийдвэрүүд (хэрэглэгч, мөн өдөр):
 * · ажлаас гарсныг УСТГАХГҮЙ — `төлөв` = "Ажлаас гарсан" (түүх үлдэнэ,
 *   нийтийн тоонд орохгүй);
 * · нэр ЗӨВХӨН засварлагчид — энэ цонх нээгдэх үед л татагдана; утас,
 *   имэйл, өрөө хэзээ ч татагдахгүй;
 * · засах эрх нь календарийн "ЗУХ — арга хэмжээ засварлагч" бүлэг.
 *
 * ⚠ Баруун талаас гарах хөвөгч самбар (`elevated` — үнэхээр хөвж буй
 * гадаргуу), хөшиггүй; Esc хаана.
 */

import * as React from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { DEPARTMENTS, SHORT_NAMES } from "@/lib/departments";
import {
  LEAD_DEPT,
  STAFF_LEFT,
  STAFF_STATUSES,
  STAFF_WORKING,
  deleteStaff,
  deptSlug,
  fetchStaffRecords,
  saveStaff,
  type StaffInput,
  type StaffRecord,
} from "@/lib/zahirgaa";
import { cn, num } from "@/lib/utils";

const VIEWS = [
  { key: "active", label: "Ажиллаж буй" },
  { key: "all", label: "Бүгд" },
  { key: "left", label: STAFF_LEFT },
] as const;
type View = (typeof VIEWS)[number]["key"];

/** Хэлтсийн сонголт — бүртгэлийн бүтэн нэрээр (хүснэгт тэгж хадгалдаг) */
const DEPT_OPTIONS = [LEAD_DEPT, ...DEPARTMENTS.map((d) => d.name)];

const shortDept = (dept: string) => {
  const slug = deptSlug(dept);
  return slug ? SHORT_NAMES[slug] : dept || "—";
};

/** Төлөвийн өнгө — өнгө = утга: ажиллаж буй `--moss`, чөлөөтэй `--ochre`, гарсан `--clay` */
const statusTone = (s: string) =>
  s === STAFF_WORKING ? "var(--moss)" : s === STAFF_LEFT ? "var(--clay)" : s ? "var(--ochre)" : "var(--line-2)";

const ROW = "grid w-full items-center gap-3 px-4";
const COLS_STATUS = "grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_64px_118px]";
const COLS_PLAIN = "grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_64px]";

const EMPTY: StaffInput = { name: "", dept: "", position: "", status: STAFF_WORKING };

export function StaffEditor({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [data, setData] = React.useState<{ rows: StaffRecord[]; hasStatus: boolean } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [rev, setRev] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("");
  const [view, setView] = React.useState<View>("active");
  /** Засаж буй мөр: `null` — маягт хаалттай, `"new"` — шинэ */
  const [edit, setEdit] = React.useState<number | "new" | null>(null);
  const [form, setForm] = React.useState<StaffInput>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchStaffRecords(ac.signal).then(
      (d) => {
        setData(d);
        setLoadError(null);
      },
      (e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoadError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => ac.abort();
  }, [rev]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = data?.rows ?? [];
  const hasStatus = data?.hasStatus ?? false;
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (hasStatus && view === "active" && r.status === STAFF_LEFT) return false;
    if (hasStatus && view === "left" && r.status !== STAFF_LEFT) return false;
    if (dept && r.dept !== dept) return false;
    if (q && !`${r.name} ${r.position} ${r.dept}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const positions = [...new Set(rows.map((r) => r.position).filter(Boolean))].sort((a, b) => a.localeCompare(b, "mn"));
  const deptChoices = [...new Set([...DEPT_OPTIONS, ...rows.map((r) => r.dept).filter(Boolean)])];
  const current = typeof edit === "number" ? rows.find((r) => r.id === edit) : undefined;

  const open = (r?: StaffRecord) => {
    setEdit(r ? r.id : "new");
    setForm(r ? { name: r.name, dept: r.dept, position: r.position, status: r.status || STAFF_WORKING } : { ...EMPTY, dept });
    setError(null);
    setConfirmLeave(false);
  };

  const save = async (input: StaffInput) => {
    setBusy(true);
    setError(null);
    try {
      await saveStaff(input, typeof edit === "number" ? edit : undefined);
      setEdit(null);
      setConfirmLeave(false);
      setRev((v) => v + 1);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      await deleteStaff(id);
      setEdit(null);
      setConfirmLeave(false);
      setRev((v) => v + 1);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-xs border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-(--tone)";
  const label = "mb-1 block text-[11px] text-ink-3";
  const ok = form.name.trim() && form.dept.trim() && form.position.trim();

  return (
    <aside
      role="dialog"
      aria-label="Албан хаагчийн бүртгэл"
      className="elevated fixed top-[calc(var(--head-h)+12px)] right-3 bottom-3 z-40 flex w-[min(820px,calc(100vw-24px))] flex-col overflow-hidden rounded-xs border border-line-2 bg-paper-2"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink">Албан хаагчийн бүртгэл</div>
          <div className="num mt-0.5 text-[11.5px] text-ink-3">
            {data ? `${num(rows.filter((r) => r.status !== STAFF_LEFT).length)} ажиллаж буй · ${num(rows.length)} бүртгэл` : "Ачаалж байна"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => open()}
          disabled={!data}
          className="inline-flex items-center gap-1 rounded-xs bg-(--tone) px-2.5 py-1 text-[12px] font-medium text-paper hover:opacity-90 disabled:opacity-40"
        >
          <Plus size={13} /> Шинэ албан хаагч
        </button>
        <button type="button" onClick={onClose} aria-label="Хаах" className="rounded-xs p-1 text-ink-3 hover:bg-paper-hi hover:text-ink">
          <X size={16} />
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <label className="flex min-w-[180px] flex-1 items-center gap-1.5 rounded-xs border border-line bg-paper px-2 py-1">
          <Search size={13} className="shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Нэр, албан тушаалаар хайх"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none"
          />
        </label>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={cn(field, "w-auto max-w-[220px]")}>
          <option value="">Бүх хэлтэс</option>
          {deptChoices.map((d) => (
            <option key={d} value={d}>
              {d === LEAD_DEPT ? "Газрын удирдлага" : d}
            </option>
          ))}
        </select>
        {hasStatus ? (
          <div className="flex gap-1">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={view === v.key}
                onClick={() => setView(v.key)}
                className={cn(
                  "rounded-xs border px-2 py-1 text-[11.5px]",
                  view === v.key ? "border-(--tone) text-ink" : "border-line text-ink-3 hover:text-ink",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ---- жагсаалт ---- */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {loadError ? (
            <div className="px-4 py-8 text-center text-[12px] text-clay">{loadError}</div>
          ) : !data ? (
            <div className="px-4 py-8 text-center text-[12px] text-ink-3">Ачаалж байна</div>
          ) : shown.length ? (
            <ul className="divide-y divide-line">
              <li
                className={cn(
                  ROW,
                  hasStatus ? COLS_STATUS : COLS_PLAIN,
                  "sticky top-0 z-[1] bg-paper-2 py-1.5 text-[10px] tracking-wide text-ink-3 uppercase",
                )}
              >
                <span>Нэр</span>
                <span>Албан тушаал</span>
                <span className="text-right">Хэлтэс</span>
                {hasStatus ? <span>Төлөв</span> : null}
              </li>
              {shown.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => open(r)}
                    className={cn(
                      ROW,
                      hasStatus ? COLS_STATUS : COLS_PLAIN,
                      "py-2 text-left hover:bg-paper-hi",
                      edit === r.id && "bg-paper-hi shadow-[inset_2px_0_0_var(--tone)]",
                    )}
                  >
                    <span className={cn("truncate text-[12.5px] text-ink", r.status === STAFF_LEFT && "text-ink-3 line-through")}>
                      {r.name || "—"}
                    </span>
                    <span className="truncate text-[12px] text-ink-2" title={r.position}>
                      {r.position || "—"}
                    </span>
                    <span className="truncate text-right text-[11px] text-ink-3" title={r.dept}>
                      {shortDept(r.dept)}
                    </span>
                    {hasStatus ? (
                      <span className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: statusTone(r.status) }} />
                        <span className={cn("truncate", r.status ? "text-ink-2" : "text-ink-3")}>{r.status || "Бүртгэгдээгүй"}</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-[12px] text-ink-3">Тохирох албан хаагч олдсонгүй</div>
          )}
        </div>

        {/* ---- маягт ---- */}
        {edit !== null ? (
          <form
            className="flex w-[300px] shrink-0 flex-col gap-2.5 overflow-y-auto border-l border-line px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ok && !busy) void save(form);
            }}
          >
            <div className="text-[12.5px] font-semibold text-ink">{edit === "new" ? "Шинэ албан хаагч" : "Бүртгэл засах"}</div>
            <label>
              <span className={label}>Нэр</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={field}
                autoFocus
                placeholder="Овог нэр"
              />
            </label>
            <label>
              <span className={label}>Хэлтэс</span>
              <select value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} className={field}>
                <option value="">Сонгох</option>
                {deptChoices.map((d) => (
                  <option key={d} value={d}>
                    {d === LEAD_DEPT ? "Газрын удирдлага" : d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={label}>Албан тушаал</span>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className={field}
                list="staff-positions"
              />
              <datalist id="staff-positions">
                {positions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            {hasStatus ? (
              <label>
                <span className={label}>Төлөв</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={field}>
                  {STAFF_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {error ? <div className="text-[11.5px] text-clay">{error}</div> : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-xs border border-line px-2.5 py-1 text-[12px] text-ink-2 hover:border-line-2 hover:text-ink"
              >
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={!ok || busy}
                className="rounded-xs bg-(--tone) px-2.5 py-1 text-[12px] font-medium text-paper disabled:opacity-40"
              >
                {busy ? "Хадгалж байна" : "Хадгалах"}
              </button>
            </div>

            {/* Бүртгэл устгах (хэрэглэгч 2026-10-26: "бүртгэл устгах гээд улаан текст")
                — баталгаажуулалттай; ажлаас гарсныг төлөвөөр тэмдэглэнэ */}
            {current ? (
              <div className="mt-auto border-t border-line pt-3">
                {confirmLeave ? (
                  <div className="space-y-2 rounded-xs border border-clay/40 bg-clay/8 p-2.5">
                    <div className="text-[11.5px] text-ink">{current.name}-ийн бүртгэлийг устгах уу? Буцаах боломжгүй.</div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmLeave(false)}
                        className="rounded-xs border border-line px-2 py-0.5 text-[11.5px] text-ink-2 hover:text-ink"
                      >
                        Болих
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(current.id)}
                        className="rounded-xs bg-clay px-2 py-0.5 text-[11.5px] font-medium text-paper disabled:opacity-40"
                      >
                        Устгах
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(true)}
                    className="inline-flex items-center gap-1.5 text-[12px] text-clay hover:underline"
                  >
                    <Trash2 size={13} /> Бүртгэл устгах
                  </button>
                )}
              </div>
            ) : null}
          </form>
        ) : null}
      </div>
    </aside>
  );
}
