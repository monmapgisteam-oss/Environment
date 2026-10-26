"use client";

/**
 * Захиргаа удирдлагын хэлтэс — байгууллагын тойм.
 *
 * Бүтэц нь хэрэглэгчийн хэвлэсэн загвар зургийнх (2026-10-20), загвар нь
 * платформынх: байгууллагын бүтэц (нэгтгэсэн үзүүлэлттэй) → албан тушаал ба
 * арга хэмжээний календарь.
 *
 * ⚠ Загвар зургийн уулын арын зураг, ногоон өнгө, бөөрөнхий булан,
 * сүүдрийг ХУУЛААГҮЙ (хэрэглэгчийн сонголт) — хяналтын схемтэй нэг
 * шийдвэр: хэлбэр нь эх загварынх, дүрслэл нь платформынх.
 *
 * Блок бүр ӨӨРИЙН давхаргаас бие даан ачаалагдана: нэг давхарга
 * ирээгүй, унасан нь бусдыг зогсоохгүй. Хаяг хоосон бол "Мэдээлэл
 * хүлээгдэж байна" ({@link Waiting}) — алдаа биш хүлээгдэж буй төлөв.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  Landmark,
  Network,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Badge } from "@/components/ui/data";
import { DEPARTMENTS, SHORT_NAMES, STATUS_LABEL, getDepartment } from "@/lib/departments";
import {
  LEAD_DEPT,
  ORG_NAME,
  ZAHIRGAA_LAYERS,
  fetchStaff,
  type Staff,
} from "@/lib/zahirgaa";
import { cn, num } from "@/lib/utils";
import { EventsCalendar } from "./events-calendar";

const DEPT = getDepartment("zahirgaa")!;

/* ------------------------------------------------------------------ */

type Load<T> =
  | { state: "pending" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; rows: T[] };

/**
 * Нэг давхаргыг татна. Хаяг хоосон бол `pending` — сүлжээнд гарахгүй.
 * Төлөв нь хариунаас ДАМ гарна (`res.url`): эффект дотор синхроноор
 * `set*` дуудахыг `react-hooks/set-state-in-effect` хориглодог.
 */
function useLayer<T>(url: string, load: (signal: AbortSignal) => Promise<T[]>): Load<T> {
  const [res, setRes] = React.useState<{ url: string; rows?: T[]; error?: string } | null>(null);
  React.useEffect(() => {
    if (!url) return;
    const ac = new AbortController();
    load(ac.signal).then(
      (rows) => setRes({ url, rows }),
      (e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRes({ url, error: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => ac.abort();
  }, [url, load]);
  if (!url) return { state: "pending" };
  if (!res || res.url !== url) return { state: "loading" };
  if (res.error !== undefined) return { state: "error", message: res.error };
  return { state: "ready", rows: res.rows ?? [] };
}

/* ------------------------------------------------------------------ */

export function ZahirgaaOverview() {
  const staff = useLayer(ZAHIRGAA_LAYERS.staff, fetchStaff);
  /** Сонгосон хэлтэс (бүлгийн түлхүүр) — албан тушаалын жагсаалтыг шүүж, бүтцэд тодорно */
  const [picked, setPicked] = React.useState<string | null>(null);

  return (
    <div className="w-full space-y-4" style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}>
      <Header />

      <Structure staff={staff} picked={picked} onPick={setPicked} />

      {/* Албан хаагч ба календарь зэрэгцэнэ; мөрийн өндрийг КАЛЕНДАРЬ тогтоож,
          албан хаагчийн жагсаалт түүнд багтана (хэрэглэгч 2026-10-22: "картуудад
          хоосон зай маш их байна").
          ⚠ Зэрэгцэх нь 1536px-ээс (`2xl`): түүнээс нарийн дэлгэцэд календарийн
          нүд ~55px болж арга хэмжээний нэр үг дундуураа тасардаг байв — тэнд
          хоёр карт босоо цуварч календарь бүтэн өргөнөө авна */}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PositionsChart staff={staff} picked={picked} onPick={setPicked} />
        <EventsCalendar />
      </div>
    </div>
  );
}

/* ------------------------------ толгой ---------------------------- */

function Header() {
  return (
    <header className="relative">
      <span aria-hidden className="absolute top-0 -left-4 h-full w-[3px] bg-(--tone) lg:-left-6" />
      <div className="flex items-center gap-4">
        <div
          className="tinted flex size-12 shrink-0 items-center justify-center rounded-xs border"
          style={{ borderColor: "color-mix(in oklab, var(--tone) 30%, transparent)" }}
        >
          <DEPT.icon size={24} strokeWidth={1.4} className="text-(--tone)" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="display text-[24px] leading-tight">{DEPT.name}</h1>
          <div className="mt-1 text-[12px] text-ink-3">{ORG_NAME}</div>
        </div>
        <Badge tone="neutral">{STATUS_LABEL[DEPT.status]}</Badge>
      </div>
      <div className="ruler mt-4 opacity-70" aria-hidden />
    </header>
  );
}

/* ---------------------------- төлөвүүд ---------------------------- */

function Waiting({ className }: { className?: string }) {
  return (
    <div className={cn("hatch flex items-center justify-center rounded-xs border border-dashed border-line-2", className)}>
      <span className="bg-paper-2 px-2.5 text-[12px] text-ink-3">Мэдээлэл хүлээгдэж байна</span>
    </div>
  );
}

/** Ачааллаж буй, алдаа гарсан, хүлээгдэж буй төлөвийг нэг дор зурна */
function LoadState<T>({ load, className }: { load: Load<T>; className?: string }) {
  if (load.state === "pending") return <Waiting className={className} />;
  if (load.state === "loading")
    return <div className={cn("flex items-center justify-center text-[12px] text-ink-3", className)}>Ачаалж байна</div>;
  if (load.state === "error")
    return <div className={cn("flex items-center justify-center px-4 text-center text-[12px] text-clay", className)}>{load.message}</div>;
  return null;
}

/* ------------------------- албан хаагчийн бүлэг -------------------- */

/** Албан хаагчийг бүлэглэх түлхүүр: удирдлага · бүртгэлийн slug · эх бичиглэл */
const groupOf = (s: Staff) => (s.lead ? LEAD_DEPT : (s.slug ?? (s.dept || "Бүртгэгдээгүй")));

type Group = { key: string; label: string; icon: LucideIcon; color: string; value: number };

/** Бүлгийн нэр, тэмдэг, өнгө — хэлтсийнх нь бүртгэлээс, бусад нь ЗУХ-ийн өнгөөр */
function groupMeta(key: string): Omit<Group, "value"> {
  const d = getDepartment(key);
  if (d) return { key, label: d.name, icon: d.icon, color: `var(${d.tone})` };
  const lead = key === LEAD_DEPT;
  return { key, label: lead ? "Газрын удирдлага" : key, icon: lead ? Landmark : Users, color: "var(--tone)" };
}

/* ------------------------- албан тушаалаар ------------------------ */

/**
 * Албан тушаалаар — хэлтэс сонгоогүй бол бүх газрын, сонгосон бол тэр
 * хэлтсийн албан тушаалууд, тоогоор буурахаар.
 *
 * ⚠⚠ "ХЭЛТСЭЭР" ХАРАГДАЦ УСТСАН (хэрэглэгч 2026-10-22: "энэ 2-ын агуулга
 * давхцаж байгаа"): хэлтэс тус бүрийн тоо, хувь, зурвас нь байгууллагын
 * бүтцийн картуудад аль хэдийн бий. Бүтцийн карт нь хэлтэс СОНГОГЧ болж,
 * энэ карт зөвхөн албан тушаалыг харуулна. Дахин бүү нэм.
 *
 * ⚠ Албан тушаалын нэрийг бүлэглэж ЗОХИОХГҮЙ ("ахлах мэргэжилтэн" гэх мэт
 * ангилалд хураахгүй) — эх сурвалжийн нэрээр нь, бүтнээр нь харуулна.
 */
function PositionsChart({
  staff,
  picked,
  onPick,
}: {
  staff: Load<Staff>;
  picked: string | null;
  onPick: (k: string | null) => void;
}) {
  const meta = picked ? groupMeta(picked) : null;
  const rows = React.useMemo(() => {
    if (staff.state !== "ready") return [];
    const by = new Map<string, { n: number; depts: Map<string, number> }>();
    for (const s of staff.rows) {
      const g = groupOf(s);
      if (picked && g !== picked) continue;
      const k = s.position || "Бүртгэгдээгүй";
      const r = by.get(k) ?? { n: 0, depts: new Map() };
      r.n++;
      r.depts.set(g, (r.depts.get(g) ?? 0) + 1);
      by.set(k, r);
    }
    return [...by]
      .map(([name, r]) => ({ name, n: r.n, depts: [...r.depts].sort((x, y) => y[1] - x[1]) }))
      .sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, "mn"));
  }, [staff, picked]);
  const [open, setOpen] = React.useState(false);
  const people = rows.reduce((t, r) => t + r.n, 0);
  const max = Math.max(1, ...rows.map((r) => r.n));
  /* Ганц хүнтэй албан тушаалууд олон бол нэг мөрөнд хураана — урт сүүл
     жагсаалтыг гүйлгүүртэй болгож, олон хүнтэй албан тушаалуудыг дарж байв */
  const singles = rows.filter((r) => r.n === 1);
  const fold = singles.length > 6 && singles.length < rows.length;
  const shown = fold && !open ? rows.filter((r) => r.n > 1) : rows;
  const Icon = meta?.icon ?? Users;

  return (
    <Panel className="flex h-full flex-col">
      <PanelHead
        title="Албан хаагчид, албан тушаалаар"
        action={
          staff.state === "ready" ? (
            <span className="num text-[11.5px] text-ink-3">
              {num(people)} албан хаагч · {num(rows.length)} албан тушаал
            </span>
          ) : null
        }
      />
      {staff.state === "ready" ? (
        <div className="flex-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2">
              <Icon size={15} strokeWidth={1.6} className="shrink-0 text-(--tone)" />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{meta ? meta.label : "Бүх хэлтэс"}</span>
              {picked ? (
                <button
                  type="button"
                  onClick={() => onPick(null)}
                  className="rounded-xs border border-line px-1.5 py-0.5 text-[11px] text-ink-2 hover:border-line-2 hover:text-ink"
                >
                  Бүх хэлтэс
                </button>
              ) : null}
            </div>
            {rows.length ? null : (
              <div className="px-4 py-6 text-center text-[12px] text-ink-3">Албан хаагч бүртгэгдээгүй байна</div>
            )}
            <ul className="divide-y divide-line px-4">
              {shown.map((r, i) => (
                <li key={r.name} className="grid grid-cols-[22px_minmax(0,1fr)_minmax(60px,110px)_30px] items-center gap-3 py-1.5">
                  <span className="num text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 text-[12.5px] leading-snug text-ink">{r.name}</span>
                    {picked ? null : (
                      <span
                        className="num ml-auto max-w-[45%] shrink-0 truncate text-[10.5px] text-ink-3"
                        title={r.depts.map(([g, v]) => `${groupMeta(g).label} — ${v}`).join(" · ")}
                      >
                        {r.depts.map(([g, v]) => `${shortOf(g)}${r.depts.length > 1 ? ` ${v}` : ""}`).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="h-[5px] rounded-xs bg-paper-3">
                    <span className="block h-full rounded-xs bg-(--tone)" style={{ width: `${(r.n / max) * 100}%`, opacity: 0.85 }} />
                  </span>
                  <span className="num text-right text-[13px] font-semibold text-ink">{num(r.n)}</span>
                </li>
              ))}
              {fold ? (
                <li>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                    className="flex w-full items-center gap-2 py-1.5 text-left text-[12px] text-ink-2 hover:text-ink"
                  >
                    <ChevronDown size={14} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
                    {open ? "Хураах" : `Бусад ${num(singles.length)} албан тушаал · тус бүр 1 албан хаагч`}
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : (
        <LoadState load={staff} className="m-3 min-h-[240px] flex-1" />
      )}
    </Panel>
  );
}

/** Бүлгийн товч нэр — хэлтсийн товчлол, удирдлага нь "Удирдлага" */
const shortOf = (g: string) => SHORT_NAMES[g] ?? g;

/* ---------------------------- бүтэц -------------------------------- */

/*
  ⚠ Бичиг хэргийн гурван үзүүлэлт (ирсэн, явсан бичиг, өргөдөл гомдол)
  загвар зураг дээр байсан ч ХАСАГДСАН (хэрэглэгч, 2026-10-20: "энэ
  хэрэггүй") — Z02 давхарга ч хамт. Дахин бүү нэм.
*/

/**
 * Байгууллагын бүтэц — ҮЗҮҮЛЭЛТҮҮД НИЙЛСЭН (хэрэглэгч 2026-10-22: "энэ
 * хэсгийг цоо шинээр сайжруул"). Урьд нь гурван тусдаа үзүүлэлтийн карт
 * (нийт албан хаагч · хэлтэс · одоо ажиллаж байгаа) ба бүтцийн карт байсан;
 * тэдгээр нь ижил асуултад (байгууллага хэр том, хэрхэн бүтэцтэй) хариулдаг
 * тул ҮНДЭСНИЙ зангилааны мөрөнд суув.
 *
 * Хэлтсийн карт: дээд ирмэг нь хэлтсийн өнгө, тэмдэг · товч нэр, бүтэн
 * нэр, албан хаагчийн тоо ба нийтэд эзлэх хувийн зурвас. Товшиход хэлтэс
 * СОНГОГДОЖ доорх албан хаагчийн карт шүүгдэнэ (дахин товшиход цуцлагдана);
 * буланд нь хэлтсийн хуудас руу очих холбоос.
 *
 * ⚠ Хэлтсийг ЗӨВХӨН бүртгэлээс авна; бүртгэлд байхгүй нэгж ЗОХИОХГҮЙ.
 * ⚠ Холбоос шугам нь SVG-гүй: үндэснээс доош унжаа, хэвтээ төмөр (эхний ба
 * сүүлчийн хайрцгийн ТӨВӨӨС төв хүртэл), хайрцаг бүрийн дээрх унжаа.
 */
function Structure({ staff, picked, onPick }: { staff: Load<Staff>; picked: string | null; onPick: (k: string | null) => void }) {
  const counts = new Map<string, number>();
  let lead = 0;
  const rows = staff.state === "ready" ? staff.rows : null;
  for (const s of rows ?? []) {
    if (s.lead) lead++;
    else if (s.slug) counts.set(s.slug, (counts.get(s.slug) ?? 0) + 1);
  }
  const total = rows?.length ?? 0;
  /* Төлөвийн талбар хүснэгтэд байхгүй үед (одоо) хүлээгдэж буй хэвээр */
  const known = rows?.filter((s) => s.active !== null) ?? [];
  const active = known.filter((s) => s.active).length;
  const n = DEPARTMENTS.length;
  const loading = staff.state === "loading" ? "…" : null;

  return (
    <Panel className="flex flex-col">
      <PanelHead title="Байгууллагын бүтэц" />
      <div className="flex flex-col items-center px-4 pt-4 pb-5">
        {/* ---- үндэс: газар ба нэгтгэсэн үзүүлэлтүүд ---- */}
        <div className="tinted flex w-full max-w-[880px] flex-wrap items-stretch gap-x-5 gap-y-3 rounded-xs border border-(--tone)/40 px-4 py-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xs border border-(--tone)/40 bg-paper-2">
              <Landmark size={20} strokeWidth={1.5} className="text-(--tone)" />
            </span>
            <div className="min-w-0">
              <div className="display text-[15px] leading-tight text-ink">{ORG_NAME}</div>
              <div className="num mt-1 text-[11.5px] text-ink-3">
                Удирдлага{lead ? ` · ${num(lead)} албан хаагч` : ""}
              </div>
            </div>
          </div>
          <dl className="flex flex-wrap items-stretch divide-x divide-line">
            <RootStat icon={Users} label="Нийт албан хаагч">
              {staff.state === "error" ? <span className="text-[11.5px] text-clay">Уншигдсангүй</span> : (loading ?? num(total))}
            </RootStat>
            <RootStat icon={Network} label="Хэлтэс">
              {num(n)}
            </RootStat>
            <RootStat icon={UserCheck} label="Одоо ажиллаж байгаа">
              {known.length ? (
                <>
                  {num(active)}
                  <span className="text-[13px] text-ink-3"> / {num(known.length)}</span>
                </>
              ) : (
                <span className="hatch inline-block rounded-xs border border-dashed border-line-2 px-2 py-0.5 text-[11px] font-normal text-ink-3">
                  Мэдээлэл хүлээгдэж байна
                </span>
              )}
            </RootStat>
          </dl>
        </div>
        <span aria-hidden className="h-5 w-px bg-line-2" />

        {/* ---- хэлтсүүд ---- */}
        <div className="relative w-full">
          <span
            aria-hidden
            className="absolute top-0 hidden h-px bg-line-2 lg:block"
            style={{ left: `calc(100% / ${2 * n})`, right: `calc(100% / ${2 * n})` }}
          />
          <ul
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
            style={{ "--n": n } as React.CSSProperties}
          >
            {DEPARTMENTS.map((d) => {
              const c = counts.get(d.slug) ?? 0;
              const share = total ? (c / total) * 100 : 0;
              const on = picked === d.slug;
              const dim = picked !== null && !on;
              return (
                <li key={d.slug} className="relative lg:pt-5" style={{ "--d": `var(${d.tone})` } as React.CSSProperties}>
                  <span aria-hidden className="absolute top-0 left-1/2 hidden h-5 w-px bg-line-2 lg:block" />
                  <div
                    className={cn(
                      "group relative flex h-full flex-col overflow-hidden rounded-xs border bg-paper transition-[background-color,border-color,opacity]",
                      on ? "border-(--d) bg-paper-hi" : "border-line hover:border-line-2 hover:bg-paper-hi",
                      dim && "opacity-55 hover:opacity-100",
                    )}
                  >
                    <span aria-hidden className="h-[3px] bg-(--d)" />
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => onPick(on ? null : d.slug)}
                      title={d.name}
                      className="flex flex-1 flex-col gap-2 px-2.5 pt-2.5 pb-3 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-xs"
                          style={{ background: "color-mix(in oklab, var(--d) 16%, transparent)" }}
                        >
                          <d.icon size={15} strokeWidth={1.7} className="text-(--d)" />
                        </span>
                        <span className="text-[10.5px] font-semibold tracking-wide text-ink-3">{SHORT_NAMES[d.slug]}</span>
                      </span>
                      <span className="min-h-[30px] text-[11.5px] leading-[15px] text-ink">{d.name}</span>
                      <span className="mt-auto">
                        <span className="flex min-w-0 items-baseline gap-1">
                          <span className="num text-[20px] leading-none font-semibold text-ink">{loading ?? num(c)}</span>
                          <span className="truncate text-[10.5px] text-ink-3">албан хаагч</span>
                        </span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="block h-[3px] flex-1 rounded-xs bg-paper-3">
                            <span className="block h-full rounded-xs bg-(--d)" style={{ width: `${share}%` }} />
                          </span>
                          {total ? <span className="num shrink-0 text-[10.5px] leading-none text-ink-3">{Math.round(share)}%</span> : null}
                        </span>
                      </span>
                    </button>
                    <Link
                      href={`/departments/${d.slug}`}
                      aria-label={`${d.name} — хэлтсийн хуудас`}
                      title="Хэлтсийн хуудас"
                      className="absolute top-2 right-1.5 rounded-xs p-1 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-paper-3 hover:text-ink focus-visible:opacity-100"
                    >
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function RootStat({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[120px] flex-col justify-center gap-1 px-4 first:pl-0 last:pr-0">
      <dt className="flex items-center gap-1.5 text-[10px] tracking-wide text-ink-3 uppercase">
        <Icon size={13} strokeWidth={1.6} className="text-(--tone)" />
        {label}
      </dt>
      <dd className="num text-[20px] leading-none font-semibold text-ink">{children}</dd>
    </div>
  );
}
