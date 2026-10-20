"use client";

/**
 * Захиргаа удирдлагын хэлтэс — байгууллагын тойм.
 *
 * Бүтэц нь хэрэглэгчийн хэвлэсэн загвар зургийнх (2026-10-20), загвар нь
 * платформынх: танилцуулга → зургаан үзүүлэлт → хэлтсээрх албан хаагч ба
 * байгууллагын бүтэц → арга хэмжээний хөтөлбөр ба тайлангийн хуваарь.
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
  CalendarDays,
  FileText,
  Network,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Badge, Meter } from "@/components/ui/data";
import { BarChart } from "@/components/charts";
import { Segments } from "@/components/unelgee/viz";
import { DEPARTMENTS, SHORT_NAMES, STATUS_LABEL, getDepartment } from "@/lib/departments";
import {
  ORG_NAME,
  ZAHIRGAA_INTRO,
  ZAHIRGAA_LAYERS,
  fetchEvents,
  fetchReports,
  fetchStaff,
  type EventRow,
  type ReportRow,
  type Staff,
} from "@/lib/zahirgaa";
import { cn, num } from "@/lib/utils";

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
  const events = useLayer(ZAHIRGAA_LAYERS.events, fetchEvents);
  const reports = useLayer(ZAHIRGAA_LAYERS.reports, fetchReports);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5" style={{ "--tone": `var(${DEPT.tone})` } as React.CSSProperties}>
      <Header />

      <Panel>
        <PanelHead title="Хэлтсийн танилцуулга" />
        {ZAHIRGAA_INTRO ? (
          <p className="max-w-[110ch] px-4 py-3.5 text-[13px] leading-relaxed text-ink-2">{ZAHIRGAA_INTRO}</p>
        ) : (
          <Waiting className="m-3 py-6" />
        )}
      </Panel>

      <Indicators staff={staff} />

      <div className="grid gap-5 xl:grid-cols-2">
        <StaffChart staff={staff} />
        <Structure staff={staff} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <EventsTable events={events} />
        <ReportsTable reports={reports} />
      </div>
    </div>
  );
}

/* ------------------------------ толгой ---------------------------- */

function Header() {
  return (
    <header className="relative">
      <span aria-hidden className="absolute top-0 -left-4 h-full w-[3px] bg-(--tone) lg:-left-6" />
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-[68ch]">
          <div className="mb-3">
            <Badge tone="neutral">{STATUS_LABEL[DEPT.status]}</Badge>
          </div>
          <h1 className="display text-[28px] leading-[1.18]">{DEPT.name}</h1>
        </div>
        <div
          className="tinted flex size-16 shrink-0 items-center justify-center rounded-xs border"
          style={{ borderColor: "color-mix(in oklab, var(--tone) 30%, transparent)" }}
        >
          <DEPT.icon size={28} strokeWidth={1.25} className="text-(--tone)" />
        </div>
      </div>
      <div className="ruler mt-5 opacity-70" aria-hidden />
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

/* --------------------------- үзүүлэлтүүд -------------------------- */

/*
  ⚠ Бичиг хэргийн гурван үзүүлэлт (ирсэн, явсан бичиг, өргөдөл гомдол)
  загвар зураг дээр байсан ч ХАСАГДСАН (хэрэглэгч, 2026-10-20: "энэ
  хэрэггүй") — Z02 давхарга ч хамт. Дахин бүү нэм.
*/
function Indicators({ staff }: { staff: Load<Staff> }) {
  const staffRows = staff.state === "ready" ? staff.rows : null;
  const active = staffRows?.filter((s) => s.active).length ?? 0;
  const share = staffRows?.length ? (active / staffRows.length) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      <Kpi label="Нийт албан хаагч" icon={Users} load={staff}>
        {staffRows ? <Value>{num(staffRows.length)}</Value> : null}
      </Kpi>

      {/* Бүртгэлээс — давхарга хэрэггүй, үргэлж бэлэн */}
      <Kpi label="Хэлтэс" icon={Network} load={{ state: "ready", rows: [] }}>
        <Value>{num(DEPARTMENTS.length)}</Value>
      </Kpi>

      <Kpi label="Одоо ажиллаж байгаа" icon={UserCheck} load={staff}>
        {staffRows ? (
          <>
            <Value>
              {num(active)}
              <span className="text-[15px] text-ink-3"> / {num(staffRows.length)}</span>
            </Value>
            <div className="mt-2.5 flex items-center gap-2">
              <Meter value={share} tone="var(--tone)" className="flex-1" />
              <span className="num text-[11px] text-ink-3">{share.toFixed(0)}%</span>
            </div>
          </>
        ) : null}
      </Kpi>

    </div>
  );
}

function Kpi<T>({ label, icon: Icon, load, children }: { label: string; icon: LucideIcon; load: Load<T>; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[132px] flex-col rounded-xs border border-line bg-paper-2 px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow leading-snug">{label}</span>
        <Icon size={22} strokeWidth={1.5} className="shrink-0 text-(--tone)" />
      </div>
      {load.state === "ready" ? <div className="mt-auto pt-2">{children}</div> : <LoadState load={load} className="mt-2 flex-1 py-3" />}
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <div className="num text-[26px] leading-none font-medium text-ink">{children}</div>;
}


/* ------------------------- хэлтсээрх диаграм ---------------------- */

function StaffChart({ staff }: { staff: Load<Staff> }) {
  const data = React.useMemo(() => {
    if (staff.state !== "ready") return [];
    const counts = new Map<string, number>();
    for (const s of staff.rows) {
      const key = s.slug ?? (s.dept || "Бүртгэгдээгүй");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    /* Бүртгэлийн дарааллаар, танигдаагүй бичиглэл араас нь */
    const known = DEPARTMENTS.filter((d) => counts.has(d.slug)).map((d) => ({
      key: d.slug,
      label: SHORT_NAMES[d.slug] ?? d.name,
      value: counts.get(d.slug)!,
    }));
    const other = [...counts].filter(([k]) => !getDepartment(k)).map(([k, v]) => ({ key: k, label: k, value: v }));
    return [...known, ...other];
  }, [staff]);

  return (
    <Panel className="flex flex-col">
      <PanelHead title="Албан хаагчдын тоо, хэлтсээр" />
      <div className="flex-1 px-4 pt-3 pb-4">
        {staff.state === "ready" ? <BarChart data={data} height={190} unit="албан хаагч" /> : <LoadState load={staff} className="h-[220px]" />}
      </div>
    </Panel>
  );
}

/* ---------------------------- бүтэц -------------------------------- */

/**
 * Байгууллагын бүтэц — `departments.ts`-ээс, давхарга хэрэггүй.
 *
 * ⚠ Хэлтсийг ЗӨВХӨН бүртгэлээс авна (одоо найм — загвар зурагтай таарна);
 * бүртгэлд байхгүй нэгж ЗОХИОХГҮЙ. Албан хаагчийн тоо нь давхарга
 * ирсэн үед л хайрцаг бүрд нэмэгдэнэ.
 *
 * Холбоос шугам нь SVG-гүй (санхүүгийн модтой нэг арга): үндэснээс
 * доош унжаа, хэвтээ төмөр, хайрцаг бүрийн дээрх унжаа. Төмөр нь эхний
 * ба сүүлчийн хайрцгийн ТӨВӨӨС төв хүртэл — эс тэгвээс захаас цухуйна.
 */
function Structure({ staff }: { staff: Load<Staff> }) {
  const counts = new Map<string, number>();
  if (staff.state === "ready") for (const s of staff.rows) if (s.slug) counts.set(s.slug, (counts.get(s.slug) ?? 0) + 1);
  const n = DEPARTMENTS.length;

  return (
    <Panel className="flex flex-col">
      <PanelHead title="Байгууллагын бүтэц" />
      <div className="flex flex-1 flex-col items-center px-4 pt-4 pb-5">
        <div className="tinted rounded-xs border border-(--tone)/40 px-5 py-2.5 text-center">
          <div className="display text-[13.5px] leading-tight text-ink">{ORG_NAME}</div>
        </div>
        <span aria-hidden className="h-4 w-px bg-line-2" />

        <div className="relative w-full">
          <span
            aria-hidden
            className="absolute top-0 hidden h-px bg-line-2 md:block"
            style={{ left: `calc(100% / ${2 * n})`, right: `calc(100% / ${2 * n})` }}
          />
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-[repeat(var(--n),minmax(0,1fr))] md:gap-1.5" style={{ "--n": n } as React.CSSProperties}>
            {DEPARTMENTS.map((d) => (
              <li key={d.slug} className="relative md:pt-4" style={{ "--d": `var(${d.tone})` } as React.CSSProperties}>
                <span aria-hidden className="absolute top-0 left-1/2 hidden h-4 w-px bg-line-2 md:block" />
                <Link
                  href={`/departments/${d.slug}`}
                  title={d.name}
                  className={cn(
                    "flex h-full flex-col items-center gap-1.5 rounded-xs border border-line bg-paper px-1.5 py-2.5 text-center transition-colors hover:border-line-2 hover:bg-paper-hi",
                    d.slug === DEPT.slug && "border-(--d)/50",
                  )}
                >
                  <d.icon size={18} strokeWidth={1.5} className="text-(--d)" />
                  <span className="text-[10.5px] leading-snug text-ink-2">{d.name}</span>
                  {counts.has(d.slug) ? (
                    <span className="num mt-auto text-[11px] text-ink-3">{num(counts.get(d.slug)!)} албан хаагч</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------- хүснэгтүүд --------------------------- */

const dateText = (ms: number | null) => {
  if (ms === null) return "—";
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

function EventsTable({ events }: { events: Load<EventRow> }) {
  const rows = React.useMemo(() => (events.state === "ready" ? events.rows : []), [events]);
  const years = React.useMemo(
    () => [...new Set(rows.flatMap((r) => (r.date === null ? [] : [new Date(r.date).getFullYear()])))].sort((a, b) => b - a),
    [rows],
  );
  const [picked, setPicked] = React.useState<string | null>(null);
  /* Сонгосон он датанд байхгүй бол хамгийн сүүлийн он руу ДАМ буцна */
  const year = picked && years.includes(Number(picked)) ? Number(picked) : (years[0] ?? null);
  const shown = year === null ? rows : rows.filter((r) => r.date !== null && new Date(r.date).getFullYear() === year);

  return (
    <Panel className="flex flex-col">
      <PanelHead
        title={year === null ? "Байгууллагын арга хэмжээний хөтөлбөр" : `${year} оны байгууллагын арга хэмжээний хөтөлбөр`}
        action={
          years.length > 1 ? (
            <Segments options={years.map((y) => ({ id: String(y), label: `${y} он` }))} value={String(year)} onChange={setPicked} />
          ) : (
            <CalendarDays size={16} strokeWidth={1.5} className="text-(--tone)" />
          )
        }
      />
      {events.state === "ready" ? (
        <Table
          head={["№", "Огноо", "Арга хэмжээний нэр", "Төрөл", "Хариуцах хэлтэс", "Төлөв"]}
          rows={shown.map((r, i) => [
            <span key="n" className="num text-ink-3">{i + 1}</span>,
            <span key="d" className="num whitespace-nowrap">{dateText(r.date)}</span>,
            <span key="name" className="text-ink">{r.name}</span>,
            r.kind ? <Badge key="k" dot={false}>{r.kind}</Badge> : "—",
            r.dept || "—",
            r.status ? <Badge key="s" dot={false}>{r.status}</Badge> : "—",
          ])}
        />
      ) : (
        <LoadState load={events} className="m-3 h-[200px]" />
      )}
    </Panel>
  );
}

function ReportsTable({ reports }: { reports: Load<ReportRow> }) {
  return (
    <Panel className="flex flex-col">
      <PanelHead title="Байгууллагын тайлангийн хуваарь" action={<FileText size={16} strokeWidth={1.5} className="text-(--tone)" />} />
      {reports.state === "ready" ? (
        <Table
          head={["№", "Тайлангийн нэр", "Хугацаа", "Хариуцах нэгж"]}
          rows={reports.rows.map((r, i) => [
            <span key="n" className="num text-ink-3">{i + 1}</span>,
            <span key="name" className="text-ink">{r.name}</span>,
            r.due || "—",
            r.owner || "—",
          ])}
        />
      ) : (
        <LoadState load={reports} className="m-3 h-[200px]" />
      )}
    </Panel>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <div className="px-4 py-10 text-center text-[12px] text-ink-3">Бүртгэгдээгүй байна</div>;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 bg-paper-2">
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[10px] font-medium tracking-wide text-ink-3 uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((cells, i) => (
            <tr key={i} className="align-top text-ink-2 hover:bg-paper-hi">
              {cells.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
