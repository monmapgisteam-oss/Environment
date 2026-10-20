"use client";

import * as React from "react";
import { ShieldOff } from "lucide-react";
import {
  ANALYSIS,
  defaultGrant,
  FULL_RULE,
  grantAllowsScope,
  grantAllowsTab,
  isAdminName,
  normName,
  tabRule,
  type Grant,
  type TabRule,
} from "@/lib/access";
import { readAccess, type AccessRow } from "@/lib/access-remote";
import { arcgisJson } from "@/lib/arcgis";
import { DEPARTMENTS } from "@/lib/departments";
import { SHARING } from "@/lib/portal";
import { useAuth } from "@/components/auth/provider";

/*
  Нэвтэрсэн бүртгэлийн хандах эрх ({@link src/lib/access.ts}).
  · админ (`portaladmin` эсвэл порталын `org_admin`) — бүгд + тохиргоо;
  · хүснэгтийн мөр (супер админы хадгалсан) → тэр эрх;
  · мөргүй бол кодын анхдагч (`ACCOUNTS`);
  · аль нь ч биш → ХААГДСАН (`blocked`).
  ⚠ Хүснэгт, үүрэг хоёрыг асууж дуустал (`pending`) ямар ч агуулга
  зурахгүй — эс тэгвээс эрхгүй цэс хором зуур анивчина.
*/

/* ---------- Хүснэгтийн хуваалцсан төлөв (бүх бүрэлдэхүүнд нэг) ---------- */

type Store = { status: "idle" | "loading" | "ready"; rows: AccessRow[] | null };
let store: Store = { status: "idle", rows: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function load() {
  if (store.status !== "idle") return;
  store = { ...store, status: "loading" };
  void readAccess()
    .catch((e) => {
      /* Унших боломжгүй бол анхдагч эрхээр — гэхдээ шалтгааныг нуухгүй */
      console.error("Эрхийн тохиргоо уншигдсангүй:", e);
      return null;
    })
    .then((rows) => {
      store = { status: "ready", rows };
      emit();
    });
}

/** Админ хадгалсны дараа — бүх бүрэлдэхүүн шинэ эрхийг шууд хэрэглэнэ */
export function setAccessRows(rows: AccessRow[]) {
  store = { status: "ready", rows };
  emit();
}

export function useAccessRows() {
  return React.useSyncExternalStore(subscribe, () => store, () => store);
}

/* ---------- Порталын үүрэг (org_admin) ---------- */

let selfRole: Promise<string | null> | null = null;
function fetchRole(): Promise<string | null> {
  selfRole ??= arcgisJson<{ role?: string }>(`${SHARING}/community/self?f=json`, "Хэрэглэгчийн мэдээлэл")
    .then((j) => j.role ?? null)
    .catch(() => {
      selfRole = null;
      return null;
    });
  return selfRole;
}

export function useAccess() {
  const { session } = useAuth();
  const username = session?.username;
  const stored = session?.role;
  const nameAdmin = isAdminName(username);
  const [fetched, setFetched] = React.useState<string | null | undefined>(undefined);
  const remote = useAccessRows();

  React.useEffect(() => {
    if (username) load();
  }, [username]);

  React.useEffect(() => {
    if (stored || !username || nameAdmin) return;
    let alive = true;
    void fetchRole().then((r) => {
      if (alive) setFetched(r);
    });
    return () => {
      alive = false;
    };
  }, [stored, username, nameAdmin]);

  const role = stored ?? fetched;
  return React.useMemo(() => {
    const signed = Boolean(username);
    const admin = nameAdmin || role === "org_admin";
    const u = normName(username);
    const row = remote.rows?.find((r) => r.username === u);
    /* Хүснэгтийн мөр давуу; `removed` бол анхдагч ч хүчингүй */
    const grant: Grant | null = row ? (row.removed ? null : row.grant) : defaultGrant(u);
    const pending =
      signed && !nameAdmin && (remote.status !== "ready" || (!grant && role === undefined));
    const blocked = signed && !admin && !grant && !pending;
    const allows = (scope: string) => admin || (!!grant && grantAllowsScope(grant, scope));
    const allowsTab = (scope: string, tab: string) => admin || (!!grant && grantAllowsTab(grant, scope, tab));
    const ruleOf = (scope: string, tab: string): TabRule => (admin || !grant ? FULL_RULE : tabRule(grant, scope, tab));
    return {
      admin,
      pending,
      blocked,
      /** Хэсэг (хэлтэс, дүн шинжилгээ) нээлттэй юу */
      allows,
      /** Хэсгийн доторх цэс нээлттэй юу */
      allowsTab,
      /** Цэсийн доторх харагдах хэсэг, давхаргын хязгаар */
      tabRule: ruleOf,
      analysis: allows(ANALYSIS),
      departments: DEPARTMENTS.filter((d) => allows(d.slug)),
    };
  }, [username, nameAdmin, role, remote]);
}

/** Эрхгүй хуудсанд гарах блок */
export function NoAccess({ text = "Энэ хуудсыг харах эрх байхгүй байна" }: { text?: string }) {
  return (
    <div className="hatch flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xs border border-dashed border-line-2 px-6 text-center">
      <ShieldOff size={20} className="text-ink-3" />
      <p className="text-[13px] font-medium text-ink-2">{text}</p>
    </div>
  );
}

/*
  Бүх хуудсыг хамарсан хаалт: хаагдсан бүртгэлд системийн агуулга
  (татацтай нь) огт зурагдахгүй. Эрх асууж байх хооронд хоосон.
*/
export function AccountGate({ children }: { children: React.ReactNode }) {
  const { blocked, pending } = useAccess();
  if (pending) return null;
  if (blocked) return <NoAccess text="Энэ бүртгэлд системд хандах эрх олгогдоогүй байна" />;
  return <>{children}</>;
}

/** Нэг хэсгийн (хэлтэс, дүн шинжилгээ) хаалт */
export function ScopeGate({ scope, children }: { scope: string; children: React.ReactNode }) {
  const { allows } = useAccess();
  return allows(scope) ? <>{children}</> : <NoAccess />;
}

/*
  ЗӨВХӨН ПОРТАЛЫН АДМИНД (хэрэглэгч 2026-10-20: "эрх, эх сурвалж товч зөвхөн
  портал админ гэсэн эрхээр орсон тохиолдолд харагдана"). `fallback` өгөөгүй
  бол бусдад юу ч зурахгүй (товч, холбоос); хуудсанд `NoAccess` дамжуулна.
*/
export function AdminOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { admin, pending } = useAccess();
  if (admin) return <>{children}</>;
  return pending ? null : <>{fallback}</>;
}
