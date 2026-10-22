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
  ArrowUpRight,
  Landmark,
  Network,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Badge } from "@/components/ui/data";
import { Segments } from "@/components/unelgee/viz";
import { DEPARTMENTS, SHORT_NAMES, STATUS_LABEL, getDepartment } from "@/lib/departments";
import {
  LEAD_DEPT,
  ORG_NAME,
  ZAHIRGAA_INTRO,
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

      <Panel>
        <PanelHead title="Хэлтсийн танилцуулга" />
        {ZAHIRGAA_INTRO ? (
          <p className="px-4 py-3.5 text-[13px] leading-relaxed text-ink-2">{ZAHIRGAA_INTRO}</p>
        ) : (
          <Waiting className="m-3 py-6" />
        )}
      </Panel>

      <Structure staff={staff} picked={picked} onPick={setPicked} />

      {/* Албан хаагч ба календарь зэрэгцэнэ; мөрийн өндрийг КАЛЕНДАРЬ тогтоож,
          албан хаагчийн жагсаалт түүнд багтана (хэрэглэгч 2026-10-22: "картуудад
          хоосон зай маш их байна") — урьд нь тайлан баруун талд давхарлагдаж,
          зүүн карт тэр өндрөөр сунаж доороо хоосон үлддэг байв */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <StaffCard staff={staff} picked={picked} onPick={setPicked} />
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

/* ------------------------- албан хаагчийн карт -------------------- */

const STAFF_VIEWS = [
  { id: "dept", label: "Хэлтсээр" },
  { id: "position", label: "Албан тушаалаар" },
] as const;
type StaffView = (typeof STAFF_VIEWS)[number]["id"];

/**
 * Албан хаагчид — ХЭЛТСЭЭР ба АЛБАН ТУШААЛААР гэсэн хоёр харагдац НЭГ
 * картад, толгойн сэлгэгчээр (хэрэглэгч 2026-10-22: "давхарлаад switch
 * хийдэг болго"). Урьд нь хоёр тусдаа карт дээр доороо давхарлаж байв.
 *
 * ⚠ Хэлтсийн мөр товшиход тэр хэлтэс СОНГОГДОЖ, албан тушаалын харагдац
 * руу ӨӨРӨӨ шилжинэ — сонголтын зорилго нь яг тэр жагсаалтыг харах.
 * Сонголт сэлгэхэд хадгалагдана (бүтцийн хайрцаг тодорсон хэвээр);
 * "Бүх хэлтэс" товчоор цуцлагдана.
 */
function StaffCard({ staff, picked, onPick }: { staff: Load<Staff>; picked: string | null; onPick: (k: string | null) => void }) {
  const [view, setView] = React.useState<StaffView>("dept");
  const switcher = <Segments options={STAFF_VIEWS} value={view} onChange={setView} />;
  return view === "dept" ? (
    <StaffChart
      staff={staff}
      picked={picked}
      switcher={switcher}
      onPick={(k) => {
        onPick(k);
        if (k) setView("position");
      }}
    />
  ) : (
    <PositionsChart staff={staff} picked={picked} onPick={onPick} switcher={switcher} />
  );
}

/* ------------------------- хэлтсээрх диаграм ---------------------- */

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

/**
 * Албан хаагчдын тоо, хэлтсээр — ХЭВТЭЭ зурвас (2026-10-22, "чартуудыг
 * сайжруул"): босоо баганад товчлол (ХБОАХХ, БОҮУАӨХ) л багтдаг байсан
 * тул хэлтсийн БҮТЭН нэр, тэмдэг, эзлэх хувьтай болгов.
 * Мөн өдөр ("үүнийг нэг янзал"): баганын толгой, доор нь нийт мөр;
 * нэр · зурвас · тоо · хувь НЭГ мөрөнд.
 * ⚠⚠ ӨНГӨ ГАНЦ (`--tone`) — хэлтсийн өнгөөр будсан хувилбар ба
 * бүрэлдэхүүний олон өнгөт зурвасыг хэрэглэгч "хэт олон өнгөтэй" гэж
 * буцаав. Тэмдэг нь саарал, сонгосон мөрийнх л `--tone`.
 *
 * ⚠ Мөр товшиход хэлтэс СОНГОГДОЖ, баруун талын албан тушаалын жагсаалт
 * түүгээр шүүгдэнэ; дахин товшиход цуцлагдана.
 */
function StaffChart({
  staff,
  picked,
  onPick,
  switcher,
}: {
  staff: Load<Staff>;
  picked: string | null;
  onPick: (k: string | null) => void;
  switcher: React.ReactNode;
}) {
  const groups = React.useMemo<Group[]>(() => {
    if (staff.state !== "ready") return [];
    const counts = new Map<string, number>();
    for (const s of staff.rows) counts.set(groupOf(s), (counts.get(groupOf(s)) ?? 0) + 1);
    return [...counts]
      .map(([k, v]) => ({ ...groupMeta(k), value: v }))
      .sort((x, y) => y.value - x.value || x.label.localeCompare(y.label, "mn"));
  }, [staff]);
  const total = groups.reduce((t, g) => t + g.value, 0);
  const max = Math.max(1, ...groups.map((g) => g.value));

  return (
    <Panel className="flex h-full flex-col">
      <PanelHead
        title="Албан хаагчдын тоо, хэлтсээр"
        action={
          <span className="flex items-center gap-3">
            {staff.state === "ready" ? <span className="num text-[11.5px] text-ink-3">{num(total)} албан хаагч</span> : null}
            {switcher}
          </span>
        }
      />
      {staff.state === "ready" ? (
        <>
          {/* Баганын толгой — мөрүүдтэй НЭГ тор (`ROW`) */}
          <div className={cn(ROW, "mt-3 border-b border-line px-4 pb-1.5 text-[10px] tracking-wide text-ink-3 uppercase")}>
            <span>Хэлтэс</span>
            <span />
            <span className="text-right">Тоо</span>
            <span className="text-right">Хувь</span>
          </div>

          <div className="relative flex-1 xl:min-h-[260px]">
            {/* xl-ээс дээш жагсаалт өндөрт ОРОЛЦОХГҮЙ (absolute) — мөрүүд нь
                картын өндрийг тэнцүү хуваана, илүү бол дотроо гүйнэ */}
            <ul className="flex flex-col divide-y divide-line overflow-y-auto xl:absolute xl:inset-0">
              {groups.map((g) => {
                const on = picked === g.key;
                const dim = picked !== null && !on;
                const share = total ? (g.value / total) * 100 : 0;
                return (
                  <li key={g.key} className="flex min-h-[38px] flex-1">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => onPick(on ? null : g.key)}
                      title={g.label}
                      className={cn(
                        ROW,
                        "group w-full items-center px-4 py-1.5 text-left transition-[opacity,background-color] hover:bg-paper-hi",
                        on && "bg-paper-hi shadow-[inset_2px_0_0_var(--tone)]",
                        dim && "opacity-45 hover:opacity-90",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <g.icon size={15} strokeWidth={1.6} className={cn("shrink-0", on ? "text-(--tone)" : "text-ink-3")} />
                        <span className={cn("min-w-0 text-[12px] leading-snug text-ink-2 group-hover:text-ink", on && "font-medium text-ink")}>
                          {g.label}
                        </span>
                      </span>
                      <span className="h-2 rounded-xs bg-paper-3">
                        <span className="block h-full rounded-xs bg-(--tone)" style={{ width: `${(g.value / max) * 100}%`, opacity: on ? 1 : 0.75 }} />
                      </span>
                      <span className="num text-right text-[13px] font-semibold text-ink">{num(g.value)}</span>
                      <span className="num text-right text-[11px] text-ink-3">{Math.round(share)}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Нийт — баганууддаа эгнэнэ */}
          <div className={cn(ROW, "items-center border-t border-line px-4 py-2 text-[11.5px]")}>
            <span className="font-medium text-ink-2">Нийт</span>
            <span />
            <span className="num text-right text-[13px] font-semibold text-ink">{num(total)}</span>
            <span className="num text-right text-[11px] text-ink-3">100%</span>
          </div>
        </>
      ) : (
        <LoadState load={staff} className="m-3 min-h-[240px] flex-1" />
      )}
    </Panel>
  );
}

/**
 * Мөрийн тор: нэр (мөрөө залгана) · зурвас · тоо · хувь — толгой, мөр, нийт
 * гурвуулаа ИЖИЛ тор хуваалцана, эс тэгвээс багана зөрнө. Зурвасууд нэг
 * эгнээнээс эхэлж урт нь харьцуулагдана (нэрийн доор байхад нэр бүрийн
 * доор өөр өөр эхэлж, мөр хоёр давхар болдог байв).
 */
const ROW = "grid grid-cols-[minmax(0,1fr)_minmax(64px,32%)_34px_34px] gap-3";

/* ------------------------- албан тушаалаар ------------------------ */

/**
 * Албан тушаалаар — хэлтэс сонгоогүй бол бүх газрын, сонгосон бол тэр
 * хэлтсийн албан тушаалууд, тоогоор буурахаар.
 *
 * ⚠ Албан тушаалын нэрийг бүлэглэж ЗОХИОХГҮЙ ("ахлах мэргэжилтэн" гэх мэт
 * ангилалд хураахгүй) — эх сурвалжийн нэрээр нь, бүтнээр нь харуулна.
 */
function PositionsChart({
  staff,
  picked,
  onPick,
  switcher,
}: {
  staff: Load<Staff>;
  picked: string | null;
  onPick: (k: string | null) => void;
  switcher: React.ReactNode;
}) {
  const meta = picked ? groupMeta(picked) : null;
  const rows = React.useMemo(() => {
    if (staff.state !== "ready") return [];
    const counts = new Map<string, number>();
    for (const s of staff.rows) {
      if (picked && groupOf(s) !== picked) continue;
      const k = s.position || "Бүртгэгдээгүй";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "mn"));
  }, [staff, picked]);
  const people = rows.reduce((t, [, v]) => t + v, 0);
  const max = Math.max(1, ...rows.map(([, v]) => v));
  const color = "var(--tone)";
  const Icon = meta?.icon ?? Users;

  return (
    <Panel className="flex h-full flex-col">
      <PanelHead
        title="Албан тушаалаар"
        action={
          <span className="flex items-center gap-3">
            {staff.state === "ready" ? (
              <span className="num text-[11.5px] text-ink-3">
                {num(people)} албан хаагч · {num(rows.length)} албан тушаал
              </span>
            ) : null}
            {switcher}
          </span>
        }
      />
      {staff.state === "ready" ? (
        <div className="relative flex-1 xl:min-h-[300px]">
          <div className="flex flex-col xl:absolute xl:inset-0">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2" style={{ "--g": color } as React.CSSProperties}>
              <Icon size={15} strokeWidth={1.6} className="shrink-0 text-(--g)" />
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
            <ul className="max-h-[420px] min-h-0 flex-1 divide-y divide-line overflow-y-auto px-4 py-0.5 xl:max-h-none">
              {rows.map(([name, v]) => (
                <li key={name} className="grid grid-cols-[minmax(0,1fr)_88px_28px] items-center gap-3 py-1.5">
                  <span className="text-[12px] leading-snug text-ink-2">{name}</span>
                  <span className="h-[5px] rounded-xs bg-paper-3">
                    <span className="block h-full rounded-xs" style={{ width: `${(v / max) * 100}%`, background: color, opacity: 0.8 }} />
                  </span>
                  <span className="num text-right text-[12.5px] font-medium text-ink">{num(v)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <LoadState load={staff} className="m-3 min-h-[240px] flex-1" />
      )}
    </Panel>
  );
}

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
                        <span className="flex items-baseline gap-1 whitespace-nowrap">
                          <span className="num text-[20px] leading-none font-semibold text-ink">{loading ?? num(c)}</span>
                          <span className="text-[10.5px] text-ink-3">албан хаагч</span>
                          {total ? <span className="num ml-auto text-[10.5px] text-ink-3">{Math.round(share)}%</span> : null}
                        </span>
                        <span className="mt-1.5 block h-[3px] rounded-xs bg-paper-3">
                          <span className="block h-full rounded-xs bg-(--d)" style={{ width: `${share}%` }} />
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
