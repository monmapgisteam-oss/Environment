"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Clock3, Eye, KeyRound, LogIn, LogOut, PencilLine, RefreshCw, ScrollText, Search, TableProperties, Users } from "lucide-react";
import { ACCOUNTS, ADMIN_USERNAME, normName } from "@/lib/access";
import { readLog, type AuditKind, type AuditRow } from "@/lib/audit";
import { DEPARTMENTS } from "@/lib/departments";
import { num } from "@/lib/utils";
import { NoAccess, useAccess } from "@/components/auth/access";
import { CATALOG } from "@/components/access/catalog";
import { cn } from "@/lib/utils";
import styles from "./log-directory.module.css";

/* Admin-only audit browser. Summary covers the selected period across all users.
   User selection, type and search narrow the activity list. Sessions preserve
   recorded login/logout labels; first/last activity never implies online time.
   Field changes remain expandable in the timeline without duplicate edit rows. */

const KIND: Record<AuditKind, { label: string; icon: typeof Eye; cls: string }> = {
  login: { label: "Нэвтрэлт", icon: LogIn, cls: styles.kLogin },
  logout: { label: "Гаралт", icon: LogOut, cls: styles.kLogout },
  view: { label: "Хуудас", icon: Eye, cls: styles.kView },
  tab: { label: "Цэс", icon: TableProperties, cls: styles.kView },
  edit: { label: "Өгөгдөл", icon: PencilLine, cls: styles.kEdit },
  schema: { label: "Бүтэц", icon: TableProperties, cls: styles.kSchema },
  access: { label: "Хандах эрх", icon: KeyRound, cls: styles.kSchema },
};
const KINDS = Object.keys(KIND) as AuditKind[];
const RANGES = [
  { days: 1, label: "24 цаг" },
  { days: 7, label: "7 хоног" },
  { days: 30, label: "30 хоног" },
  { days: 90, label: "90 хоног" },
];
const ACTION: Record<string, string> = { add: "Нэмсэн", update: "Зассан", delete: "Устгасан", "add-field": "Талбар нэмсэн", "delete-field": "Талбар устгасан" };
const PAGES: Record<string, string> = { "/": "Ерөнхий самбар", "/analysis": "Дүн шинжилгээ", "/sources": "Дата эх сурвалж", "/access": "Эрхийн зохицуулалт", "/log": "Лог бүртгэл", "/reports": "Тайлан", "/alerts": "Дохиолол", "/map": "Газрын зураг", "/settings": "Тохиргоо" };

const dept = (slug: string | null) => DEPARTMENTS.find((d) => d.slug === slug);
const account = (u: string) => ACCOUNTS.find((a) => a.username === u);
function userName(u: string): string {
  if (normName(u) === ADMIN_USERNAME) return "Порталын администратор";
  return account(u)?.name ?? u;
}
function pageName(path: string | null): string {
  if (!path) return "—";
  const p = path.replace(/\/+$/, "") || "/";
  if (PAGES[p]) return PAGES[p];
  const m = p.match(/^\/departments\/([^/]+)/);
  if (m) return dept(m[1])?.name ?? m[1];
  return p;
}
function tabName(scope: string | null, tab: string | null): string {
  const s = CATALOG.find((c) => c.scope === scope);
  const t = s?.tabs.find((x) => x.id === tab);
  return t?.label ?? tab ?? "—";
}
/** `…/Hosted/<нэр>/FeatureServer/0` → `<нэр>` */
function layerName(layer: string | null): string {
  if (!layer) return "—";
  const m = layer.match(/\/Hosted\/([^/]+)\/FeatureServer/);
  return m ? decodeURIComponent(m[1]) : layer;
}
function describe(r: AuditRow): string {
  const d = dept(r.scope)?.name;
  switch (r.kind) {
    case "login":
      return "Системд нэвтэрсэн";
    case "logout":
      return "Системээс гарсан";
    case "view":
      return pageName(r.path);
    case "tab":
      return `${d ?? r.scope ?? pageName(r.path)} · ${tabName(r.scope, r.tab)}`;
    case "edit":
      return `${ACTION[r.action ?? ""] ?? r.action ?? "Засвар"} · ${layerName(r.layer)}${r.refOid != null ? ` · № ${num(r.refOid)}` : ""}${d ? ` · ${d}` : ""}`;
    case "schema":
      return `${ACTION[r.action ?? ""] ?? r.action ?? "Бүтэц"} · ${layerName(r.layer)}`;
    case "access":
      return "Хандах эрхийн тохиргоог хадгалсан";
  }
}
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const hhmmss = (ms: number) => `${hhmm(ms)}:${pad(new Date(ms).getSeconds())}`;
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};
const spanText = (ms: number) => {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "1 минутаас бага";
  if (m < 60) return `${m} мин`;
  return `${Math.floor(m / 60)} ц ${m % 60} мин`;
};

type Loaded = { rows: AuditRow[]; url: string } | "missing";
type Session = { sid: string; start: number; end: number; out: boolean; login: boolean; rows: AuditRow[] };

/** `sid`-ээр сесс — эхлэл нь нэвтрэлт (эсвэл эхний үйлдэл), төгсгөл нь гаралт (эсвэл сүүлийн үйлдэл) */
function sessionsOf(rows: AuditRow[]): Session[] {
  const by = new Map<string, Session>();
  for (const r of rows) {
    const key = r.sid ?? "—";
    const s = by.get(key) ?? { sid: key, start: r.at, end: r.at, out: false, login: false, rows: [] };
    s.rows.push(r);
    s.start = Math.min(s.start, r.at);
    s.end = Math.max(s.end, r.at);
    if (r.kind === "logout") s.out = true;
    if (r.kind === "login") s.login = true;
    by.set(key, s);
  }
  return [...by.values()].map((s) => ({ ...s, rows: s.rows.sort((a, b) => a.at - b.at) })).sort((a, b) => b.start - a.start);
}

export function LogDirectory() {
  const { admin, pending } = useAccess();
  const [days, setDays] = React.useState(7);
  /* Уншилтын үр дүн ТҮЛХҮҮРТЭЙ (хугацаа + шинэчлэлт): идэвхтэй түлхүүртэй зөрвөл уншиж байна */
  const [result, setResult] = React.useState<{ key: string; data: Loaded | null; error: string | null } | null>(null);
  const [user, setUser] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<AuditKind | "all">("all");
  const [q, setQ] = React.useState("");
  const [tick, setTick] = React.useState(0);
  const key = `${days}:${tick}`;

  React.useEffect(() => {
    if (!admin) return;
    let alive = true;
    readLog(days)
      .then((r) => alive && setResult({ key, data: r ?? "missing", error: null }))
      .catch((e: unknown) => alive && setResult({ key, data: null, error: e instanceof Error ? e.message : "Бүртгэлийг ачаалж чадсангүй." }));
    return () => {
      alive = false;
    };
  }, [admin, days, key]);

  if (!admin) return pending ? null : <NoAccess />;

  const busy = result?.key !== key;
  const data = busy ? null : result?.data ?? null;
  const error = busy ? null : result?.error ?? null;
  const rows = data && data !== "missing" ? data.rows : [];
  const byUser = new Map<string, number>();
  for (const r of rows) byUser.set(r.username, (byUser.get(r.username) ?? 0) + 1);
  const users = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
  const scoped = user ? rows.filter((r) => r.username === user) : rows;
  const text = q.trim().toLowerCase();
  const matches = (r: AuditRow) => (kind === "all" || kind === r.kind) && (!text || `${r.username} ${userName(r.username)} ${describe(r)} ${r.detail ?? ""}`.toLowerCase().includes(text));
  const count = (k: AuditKind) => scoped.filter((r) => r.kind === k).length;
  const filtered = scoped.filter(matches);
  const totalCount = (...ks: AuditKind[]) => rows.filter((r) => ks.includes(r.kind)).length;

  const empty = (msg: string) => (
    <div className={cn("hatch", styles.empty)}>
      <ScrollText size={20} className="text-ink-3" />
      <p>{msg}</p>
    </div>
  );

  return (
    <div className={styles.root} aria-busy={busy}>
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>ЛОГ БҮРТГЭЛ</h1>
        <div className={styles.headerActions}>
          <span className={styles.rangeLabel}>Сүүлийн</span>
          <div className={styles.seg} role="group" aria-label="Хугацаа">
            {RANGES.map((r) => (
              <button key={r.days} type="button" aria-pressed={days === r.days} onClick={() => setDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" className={styles.button} disabled={busy} onClick={() => setTick((t) => t + 1)} title="Бүртгэлийг шинэчлэх">
            <RefreshCw size={14} className={busy ? "animate-spin" : undefined} aria-hidden /> Шинэчлэх
          </button>
        </div>
      </header>

      <div className={styles.stats}>
        <Stat icon={Users} label="Систем ашигласан хэрэглэгч" value={busy ? "—" : num(users.length)} />
        <Stat icon={LogIn} label="Нэвтрэлтийн тоо" value={busy ? "—" : num(totalCount("login"))} />
        <Stat icon={Eye} label="Хуудас, цэсийн үзэлт" value={busy ? "—" : num(totalCount("view", "tab"))} />
        <Stat icon={PencilLine} label="Өгөгдөл, бүтцийн өөрчлөлт" value={busy ? "—" : num(totalCount("edit", "schema"))} />
      </div>

      <div className={styles.body}>
        <aside className={styles.users}>
          <div className={styles.panelHead}>
            <h2>Хэрэглэгчид</h2>
            <span className="num">{busy ? "—" : num(users.length)}</span>
          </div>
          <button type="button" className={cn(styles.userRow, user == null && styles.userOn)} onClick={() => setUser(null)} aria-current={user == null ? "true" : undefined}>
            <Users size={14} aria-hidden />
            <span className={styles.userInfo}><span className={styles.userName}>Бүх хэрэглэгч</span></span>
            <span className={styles.userCount}><b className="num">{num(rows.length)}</b> үйлдэл</span>
          </button>
          {users.map(([u, n]) => {
            const last = rows.find((r) => r.username === u);
            return (
              <button key={u} type="button" className={cn(styles.userRow, user === u && styles.userOn)} onClick={() => setUser(u)} aria-current={user === u ? "true" : undefined}>
                <Users size={14} aria-hidden />
                <span className={styles.userInfo}>
                  <span className={styles.userName}>{userName(u)}</span>
                  <span className={styles.userMeta}>
                    {u}
                  </span>
                  {last && <span className={styles.userMeta}>Сүүлийн үйлдэл: <span className="num">{hhmm(last.at)} · {dayKey(last.at)}</span></span>}
                </span>
                <span className={styles.userCount}><b className="num">{num(n)}</b> үйлдэл</span>
                <ChevronRight size={14} className={styles.userChevron} aria-hidden />
              </button>
            );
          })}
        </aside>

        <section className={styles.events}>
          <div className={styles.eventHeader}>
            <div>
              <h2>{user ? userName(user) : "Бүх хэрэглэгчийн үйлдэл"}</h2>
              <p>{user ? `${user} · ` : ""}Сүүлийн {RANGES.find((r) => r.days === days)?.label} · <span className="num">{num(filtered.length)}</span> үйлдэл</p>
            </div>
            <label className={styles.search}>
              <Search size={15} aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Бүртгэлээс хайх…" aria-label="Бүртгэлээс хайх" />
            </label>
          </div>
          <div className={styles.toolbar}>
            <div className={styles.chips} role="group" aria-label="Үйлдлийн төрөл">
              <button type="button" aria-pressed={kind === "all"} className={cn(styles.chip, kind === "all" && styles.chipOn)} onClick={() => setKind("all")}>Бүгд <span className="num">{num(scoped.length)}</span></button>
              {KINDS.map((k) => {
                const K = KIND[k];
                return (
                  <button key={k} type="button" aria-pressed={kind === k} className={cn(styles.chip, kind === k && styles.chipOn)} onClick={() => setKind(k)}>
                    <K.icon size={12} aria-hidden /> {K.label} <span className="num">{num(count(k))}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <p className={styles.note}>{error}</p>
          ) : data === "missing" ? (
            empty("Үйлдэл хараахан бүртгэгдээгүй байна.")
          ) : !data ? (
            <p className={styles.note}>Бүртгэлийг ачаалж байна…</p>
          ) : user ? (
            <AccountView key={user} rows={scoped} matches={matches} empty={empty} />
          ) : (
            <AllView rows={filtered} allRows={rows} empty={empty} />
          )}
          {rows.length >= 2000 && <p className={styles.limit}>Сүүлийн 2000 үйлдлийг харуулж байна. Хугацааны хүрээг багасгаж шүүнэ үү.</p>}
        </section>
      </div>
    </div>
  );
}

/* ---------- Бүгд — өдрөөр ---------- */

function AllView({ rows, allRows, empty }: { rows: AuditRow[]; allRows: AuditRow[]; empty: (m: string) => React.ReactNode }) {
  if (!rows.length) return <>{empty("Сонгосон нөхцөлд тохирох бүртгэл олдсонгүй.")}</>;
  const end = sessionEnds(allRows);
  const groups: { day: string; rows: AuditRow[] }[] = [];
  for (const r of rows) {
    const d = dayKey(r.at);
    const g = groups.at(-1);
    if (g && g.day === d) g.rows.push(r);
    else groups.push({ day: d, rows: [r] });
  }
  return (
    <div className={styles.list}>
      <ColumnHead who />
      {groups.map((g) => (
        <div key={g.day} className={styles.day}>
          <div className={styles.dayHead}>
            <span className="num">{g.day}</span>
            <span className={styles.dayCount}>{num(g.rows.length)} үйлдэл</span>
          </div>
          <ActivityRows rows={g.rows} who ends={end} />
        </div>
      ))}
    </div>
  );
}

function sessionEnds(rows: AuditRow[]): Map<string, { at: number; out: boolean }> {
  const m = new Map<string, { at: number; out: boolean }>();
  for (const r of rows) {
    if (!r.sid) continue;
    const c = m.get(r.sid);
    m.set(r.sid, { at: Math.max(r.at, c?.at ?? 0), out: (c?.out ?? false) || r.kind === "logout" });
  }
  return m;
}

/* ---------- Нэг хэрэглэгч — нарийн задаргаа ---------- */

function AccountView({ rows, matches, empty }: { rows: AuditRow[]; matches: (r: AuditRow) => boolean; empty: (m: string) => React.ReactNode }) {
  const sessions = sessionsOf(rows).filter((s) => s.rows.some(matches));
  const [openSid, setOpenSid] = React.useState<string | null>(null);
  const activeSid = openSid === "" ? "" : sessions.some((s) => s.sid === openSid) ? openSid : sessions[0]?.sid;
  const topViews = new Map<string, number>();
  for (const r of rows.filter(matches)) {
    if (r.kind === "view" || r.kind === "tab") topViews.set(describe(r), (topViews.get(describe(r)) ?? 0) + 1);
  }
  const top = [...topViews.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!sessions.length) return <>{empty("Сонгосон нөхцөлд тохирох бүртгэл олдсонгүй.")}</>;

  return (
    <div className={styles.list}>
      <div className={styles.historyHead}><h3>Үйлдлийн түүх</h3><span>Цагийн дарааллаар</span></div>
      {sessions.map((s) => {
        const isOpen = activeSid === s.sid;
        const shown = s.rows.filter(matches);
        const date = dayKey(s.start);
        const endDate = dayKey(s.end);
        return (
          <section key={s.sid} className={cn(styles.sess, isOpen && styles.sessOpen)}>
            <button type="button" className={styles.sessHead} onClick={() => setOpenSid(isOpen ? "" : s.sid)} aria-expanded={isOpen}>
              <span className={styles.caret}>{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
              <span className={styles.sessInfo}>
                <strong className="num">{date}{s.sid === "—" ? " · Сессийн дугааргүй" : ""}</strong>
                <span className={styles.sessTimes}>
                  <span>{s.login ? "Нэвтэрсэн цаг" : "Эхний үйлдэл"} <b className="num">{hhmm(s.start)}</b></span>
                  <span>{s.out ? "Гарсан цаг" : "Сүүлийн үйлдэл"} <b className="num">{date !== endDate ? endDate + " " : ""}{hhmm(s.end)}</b></span>
                </span>
              </span>
              <span className={styles.sessionCount}><b className="num">{num(shown.length)}</b> үйлдэл</span>
            </button>
            {isOpen && <><ColumnHead /><ActivityRows rows={shown} day={date !== endDate} /></>}
          </section>
        );
      })}
      {top.length > 0 && (
        <details className={styles.topSection}>
          <summary>Үзсэн хуудас, цэс <span>{num(topViews.size)}</span></summary>
          <div className={styles.top}>
            {top.map(([name, n]) => (
              <div key={name} className={styles.topRow}>
                <span className={styles.topName}>{name}</span>
                <span className={styles.topBar}><span style={{ width: (n / top[0][1]) * 100 + "%" }} /></span>
                <span className={styles.topCount}>{num(n)} удаа</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ColumnHead({ who = false }: { who?: boolean }) {
  return <div className={cn(styles.columnHead, !who && styles.columnsNarrow)} aria-hidden="true"><span>Цаг</span>{who && <span>Хэрэглэгч</span>}<span>Үйлдэл</span><span>Үйлдлийн мэдээлэл</span><span /></div>;
}

/* ---------- Мөр ---------- */

/** Collapse repeated page/tab views without removing any audit records.
 * Different users, dates and destinations remain separate; edits never merge. */
function ActivityRows({ rows, who, day, ends }: { rows: AuditRow[]; who?: boolean; day?: boolean; ends?: Map<string, { at: number; out: boolean }> }) {
  const [openRow, setOpenRow] = React.useState<number | null>(null);
  const groups = new Map<string, AuditRow[]>();
  for (const row of rows) {
    const key = row.kind === "view" || row.kind === "tab"
      ? JSON.stringify([row.username, dayKey(row.at), row.kind, row.path, row.scope, row.tab])
      : `event:${row.id}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const renderRow = (row: AuditRow) => (
    <EventRow key={row.id} row={row} who={who} day={day} end={ends?.get(row.sid ?? "")} open={openRow === row.id} onToggle={() => setOpenRow(openRow === row.id ? null : row.id)} />
  );
  return <>{[...groups.entries()].map(([key, group]) => group.length === 1
    ? renderRow(group[0])
    : <ViewGroup key={key} rows={group} who={who} day={day}>{group.map(renderRow)}</ViewGroup>
  )}</>;
}

function ViewGroup({ rows, who, day, children }: { rows: AuditRow[]; who?: boolean; day?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const contentId = React.useId();
  const row = rows[0];
  const K = KIND[row.kind];
  return (
    <div className={styles.viewGroup}>
      <div className={cn(styles.row, open && styles.rowOpen, !who && styles.rowNarrow)}>
        <button type="button" className={styles.rowMain} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={contentId}>
          <span className={cn("num", styles.time)}>{day ? `${dayKey(row.at)} ${hhmm(row.at)}` : hhmmss(row.at)}</span>
          {who && <span className={styles.who} title={row.username}>{userName(row.username)}</span>}
          <span className={cn(styles.kind, K.cls)}><K.icon size={11} aria-hidden /> {K.label}</span>
          <span className={cn(styles.what, styles.groupTitle)}><span>{describe(row)}</span><span className={styles.repeatCount}>{num(rows.length)} удаа</span></span>
          <span className={styles.caret}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
        </button>
      </div>
      {open && <div id={contentId} className={styles.groupDetails}>{children}</div>}
    </div>
  );
}

function EventRow({ row: r, who, day, end, open, onToggle }: { row: AuditRow; who?: boolean; day?: boolean; end?: { at: number; out: boolean }; open: boolean; onToggle: () => void }) {
  const K = KIND[r.kind];
  const sessionEnd = r.kind === "login" && end && end.at > r.at ? end : undefined;
  /* Зам, сессийн дугаар дэлгэрэнгүйд ГАРАХГҮЙ (хэрэглэгч 2026-11-11: "харагдах шаардлагагүй") —
     зам нь мөрөнд хуудасны нэрээр, сесс нь бүртгэлийн задаргаанд бий */
  const hasDetail = !!r.detail || !!r.layer;
  return (
    <div className={cn(styles.row, open && styles.rowOpen, !who && styles.rowNarrow)}>
      <button type="button" className={styles.rowMain} onClick={() => hasDetail && onToggle()} aria-expanded={hasDetail ? open : undefined} disabled={!hasDetail}>
        <span className={cn("num", styles.time)}>{day ? `${dayKey(r.at)} ${hhmm(r.at)}` : hhmmss(r.at)}</span>
        {who && (
          <span className={styles.who} title={r.username}>
            {userName(r.username)}
          </span>
        )}
        <span className={cn(styles.kind, K.cls)}>
          <K.icon size={11} aria-hidden /> {K.label}
        </span>
        <span className={styles.what}>
          {describe(r)}
          {sessionEnd ? (
            <span className={styles.session}>
              {sessionEnd.out ? <LogOut size={11} aria-hidden /> : <Clock3 size={11} aria-hidden />}
              {sessionEnd.out ? "гарсан" : "сүүлийн үйлдэл"} <span className="num">{hhmm(sessionEnd.at)}</span> · {spanText(sessionEnd.at - r.at)}
            </span>
          ) : null}
        </span>
        <span className={styles.caret}>{hasDetail ? open ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}</span>
      </button>
      {open && hasDetail && <Detail row={r} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statIcon}><Icon size={19} strokeWidth={1.6} aria-hidden /></span>
      <span className={styles.statLabel}>{label}</span>
      <strong className={cn("num", styles.statValue)}>{value}</strong>
    </div>
  );
}

/** Дэлгэрэнгүй — зассан талбар хуучин → шинэ, бусад утга жагсаалтаар */
function Detail({ row }: { row: AuditRow }) {
  let parsed: unknown = null;
  if (row.detail) {
    try {
      parsed = JSON.parse(row.detail);
    } catch {
      parsed = row.detail;
    }
  }
  const fields = parsed && typeof parsed === "object" && "fields" in parsed ? (parsed as { fields?: Record<string, unknown> }).fields : null;
  const rest = parsed && typeof parsed === "object" ? Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([k]) => k !== "fields")) : null;
  const show = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <div className={styles.detail}>
      {row.layer && (
        <div className={styles.kv}>
          <span>Өгөгдлийн эх сурвалж</span>
          <span className="num">{row.layer}</span>
        </div>
      )}
      {fields && Object.keys(fields).length > 0 && (
        <table className={styles.fields}>
          <thead>
            <tr>
              <th>Талбар</th>
              <th>Өмнөх утга</th>
              <th>Шинэ утга</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(fields).map(([k, v]) => {
              const pair = Array.isArray(v) && v.length === 2 ? v : [undefined, v];
              return (
                <tr key={k}>
                  <td>{k}</td>
                  <td className={styles.old}>{show(pair[0])}</td>
                  <td>{show(pair[1])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {rest &&
        Object.entries(rest).map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <span>{k}</span>
            <span>{show(v)}</span>
          </div>
        ))}
      {typeof parsed === "string" && <p className={styles.raw}>{parsed}</p>}
    </div>
  );
}
