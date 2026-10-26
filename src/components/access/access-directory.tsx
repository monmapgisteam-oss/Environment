"use client";

import * as React from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, LockKeyhole, Minus, Plus, RotateCcw, Save, Search, ShieldCheck, UnlockKeyhole, Users, X } from "lucide-react";
import { ACCOUNTS, ADMIN_USERNAME, VIEW_PARTS, clearDetail, homeScopes, layerKey, normName, normViews, tabRule, viewKey, withHome, type Grant } from "@/lib/access";
import { readAccess, saveAccess, type AccessRow } from "@/lib/access-remote";
import { NoAccess, setAccessRows, useAccess, useAccessRows } from "@/components/auth/access";
import { CATALOG, type CatalogScope, type CatalogTab } from "@/components/access/catalog";
import { cn } from "@/lib/utils";
import styles from "./access-directory.module.css";

type Draft = { grant: Grant; removed: boolean };

function openCount(grant: Grant, scope: CatalogScope): number {
  const value = grant[scope.scope];
  if (value === "all") return scope.tabs.length;
  return Array.isArray(value) ? scope.tabs.filter((tab) => value.includes(tab.id)).length : 0;
}

function scopeCount(grant: Grant): number {
  return CATALOG.filter((scope) => grant[scope.scope] === "all" || openCount(grant, scope) > 0).length;
}

function sameDraft(a: Draft, b: Draft): boolean {
  const keys = Object.keys(a.grant);
  return a.removed === b.removed && keys.length === Object.keys(b.grant).length && keys.every((key) => {
    const left = a.grant[key];
    const right = b.grant[key];
    if (left === "all" || right === "all") return left === right;
    return Array.isArray(right) && left.length === right.length && left.every((tab) => right.includes(tab));
  });
}

export function AccessDirectory() {
  const { admin } = useAccess();
  const remote = useAccessRows();
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [added, setAdded] = React.useState<string[]>([]);
  const [picked, setPicked] = React.useState(ACCOUNTS[0].username);
  const [scopeId, setScopeId] = React.useState<string | null>(null);
  /** Нарийвчлан тохируулж буй цэс (харагдах хэсэг, давхарга) */
  const [tabId, setTabId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  if (!admin) return <NoAccess />;

  const saved = (username: string): Draft => {
    const row = remote.rows?.find((item) => item.username === username);
    if (row) return { grant: withHome(username, row.grant), removed: row.removed };
    return { grant: ACCOUNTS.find((account) => account.username === username)?.grant ?? {}, removed: false };
  };
  const current = (username: string) => drafts[username] ?? saved(username);
  const names = [...new Set([
    ...ACCOUNTS.map((account) => account.username),
    ...(remote.rows ?? []).map((row) => row.username),
    ...added,
  ])].filter((username) => username !== ADMIN_USERNAME);
  const extraNames = names.filter((username) => !ACCOUNTS.some((account) => account.username === username)).sort();
  const nameOf = (username: string) => {
    const account = ACCOUNTS.find((item) => item.username === username);
    if (account) return account.name;
    if (/^[А-Яа-яЁёӨөҮү0-9 _.-]+$/u.test(username)) return username;
    return `Нэмэлт бүртгэл ${extraNames.indexOf(username) + 1}`;
  };
  const visibleNames = names.filter((username) =>
    `${nameOf(username)} ${username}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const dirty = Object.keys(drafts);
  const sel = current(picked);
  const loading = remote.status !== "ready";
  const locked = busy || loading;
  const disabled = locked || sel.removed;
  const selectedScopes = scopeCount(sel.grant);
  const allScopes = CATALOG.every((scope) => sel.grant[scope.scope] === "all");
  const activeScope = CATALOG.find((scope) => scope.scope === scopeId);
  /** Бүртгэлийн өөрийн хэлтэс — үргэлж нээлттэй, чагтгүй */
  const home = homeScopes(picked);
  const activeHome = !!activeScope && home.includes(activeScope.scope);
  const activeTab = activeScope?.tabs.find((tab) => tab.id === tabId && tab.layers);
  const allSelected = activeScope ? sel.grant[activeScope.scope] === "all" : allScopes;
  const anySelected = activeScope
    ? sel.grant[activeScope.scope] === "all" || openCount(sel.grant, activeScope) > 0
    : CATALOG.some((scope) => !homeScopes(picked).includes(scope.scope) && (sel.grant[scope.scope] === "all" || openCount(sel.grant, scope) > 0));

  function selectAccount(username: string) {
    setPicked(username);
    setScopeId(null);
    setTabId(null);
  }

  const tabOpen = (scope: CatalogScope, id: string) => {
    const value = sel.grant[scope.scope];
    return value === "all" || (Array.isArray(value) && value.includes(id));
  };

  /*
    Цэсийн нарийвчлал: жагсаалтаас нэгийг сонгох/хасах. Бүгд сонгогдвол
    түлхүүр арилна (хязгааргүй). Сүүлчийнхийг ХАСАХГҮЙ — юу ч харагдахгүй
    цэс нь эрхгүй цэстэй ижил тул тэрийг цэсийн чагтаар хийнэ.
  */
  function toggleDetail(key: string, all: string[], id: string) {
    if (disabled) return;
    edit((grant) => {
      const value = grant[key];
      /* Хуучин хэсгүүд (charts, overview, record) → "db" */
      const list = new Set(Array.isArray(value) ? (key.startsWith("@v:") ? normViews(value) : value) : all);
      if (list.has(id)) {
        if (list.size === 1) return grant;
        list.delete(id);
      } else list.add(id);
      if (all.every((x) => list.has(x))) delete grant[key];
      else grant[key] = all.filter((x) => list.has(x));
      return grant;
    });
  }

  function edit(fn: (grant: Grant) => Grant, removed = sel.removed) {
    if (locked) return;
    setMsg(null);
    setDrafts((previous) => {
      const next = { grant: withHome(picked, fn({ ...(previous[picked] ?? saved(picked)).grant })), removed };
      const updated = { ...previous };
      if (!added.includes(picked) && sameDraft(next, saved(picked))) delete updated[picked];
      else updated[picked] = next;
      return updated;
    });
  }

  function toggleScope(scope: CatalogScope) {
    if (disabled || home.includes(scope.scope)) return;
    edit((grant) => {
      if (grant[scope.scope] === "all") delete grant[scope.scope];
      else grant[scope.scope] = "all";
      clearDetail(grant, scope.scope);
      return grant;
    });
  }

  function toggleTab(scope: CatalogScope, id: string) {
    if (disabled) return;
    edit((grant) => {
      const value = grant[scope.scope];
      const list = new Set(value === "all" ? scope.tabs.map((tab) => tab.id) : Array.isArray(value) ? value : []);
      if (list.has(id)) {
        /* Өөрийн хэлтсийн сүүлчийн цэсийг хасахгүй — хэлтэс үргэлж нээлттэй */
        if (list.size === 1 && home.includes(scope.scope)) return grant;
        list.delete(id);
        clearDetail(grant, scope.scope, id);
      } else list.add(id);
      if (!list.size) delete grant[scope.scope];
      else grant[scope.scope] = list.size === scope.tabs.length ? "all" : [...list];
      return grant;
    });
  }

  function addAccount() {
    if (locked) return;
    const username = normName(newName);
    if (!username) return;
    if (username === ADMIN_USERNAME) {
      setMsg({ ok: false, text: "Удирдах хэрэглэгчийн эрхийг өөрчлөх боломжгүй" });
      return;
    }
    if (!names.includes(username)) {
      setAdded((previous) => [...previous, username]);
      setDrafts((previous) => ({ ...previous, [username]: { grant: {}, removed: false } }));
    }
    selectAccount(username);
    setQuery("");
    setNewName("");
    setAdding(false);
    setMsg(null);
  }

  function reset() {
    if (added.includes(picked)) selectAccount(ACCOUNTS[0].username);
    setDrafts({});
    setAdded([]);
    setQuery("");
    setMsg(null);
  }

  async function save() {
    if (locked || !dirty.length) return;
    setBusy(true);
    setMsg(null);
    const rows: AccessRow[] = dirty.map((username) => ({ username, ...drafts[username] }));
    try {
      await saveAccess(rows);
      // Apply confirmed writes even if the following refresh is unavailable.
      const merged = new Map((remote.rows ?? []).map((row) => [row.username, row]));
      rows.forEach((row) => merged.set(row.username, row));
      setAccessRows([...merged.values()]);
      setDrafts({});
      setAdded([]);
      setMsg({ ok: true, text: "Өөрчлөлтийг хадгаллаа" });
      try {
        const fresh = await readAccess();
        if (fresh) setAccessRows(fresh);
      } catch {
        // The confirmed values above remain available until the next load.
      }
    } catch {
      setMsg({ ok: false, text: "Хадгалж чадсангүй. Дахин оролдоно уу." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.root} aria-busy={busy || loading}>
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>ЭРХИЙН ЗОХИЦУУЛАЛТ</h1>
        <div className={styles.headerActions}>
          {dirty.length > 0 && <span className={styles.modified}>{dirty.length} өөрчлөлт</span>}
          <button type="button" disabled={!dirty.length || locked} onClick={reset} className={styles.button}>
            <RotateCcw size={15} aria-hidden="true" /> Буцаах
          </button>
          <button type="button" disabled={!dirty.length || locked} onClick={() => void save()} className={cn(styles.button, styles.primaryButton)}>
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {busy ? "Хадгалж байна" : "Хадгалах"}
          </button>
        </div>
      </header>

      {msg && (
        <div className={cn(styles.message, msg.ok ? styles.success : styles.error)} role={msg.ok ? "status" : "alert"}>
          <span>{msg.text}</span>
          <button type="button" className={styles.closeMessage} aria-label="Мэдэгдэл хаах" onClick={() => setMsg(null)}><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      <div className={styles.layout}>
        <section className={styles.accountsPanel} aria-labelledby="access-accounts-heading">
          <div className={styles.panelHeading}>
            <h2 id="access-accounts-heading">БҮРТГЭЛҮҮД</h2>
            <span className={styles.count}>{names.length}</span>
          </div>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Бүртгэл хайх" aria-label="Бүртгэл хайх" />
          </label>
          <label className={styles.mobileAccounts}>
            <span>Бүртгэл</span>
            <select className={styles.mobileSelect} value={picked} disabled={busy} onChange={(event) => selectAccount(event.target.value)} aria-label="Эрх тохируулах бүртгэл">
              {names.map((username) => <option key={username} value={username}>{nameOf(username)}</option>)}
            </select>
          </label>
          <PagedList
            key={`${query}:${names.length}`}
            className={styles.accountList}
            label="Эрх тохируулах бүртгэл"
            rowHeight={50}
            items={visibleNames.map((username) => {
              const draft = current(username);
              return (
                <button key={username} type="button" title={nameOf(username)} onClick={() => selectAccount(username)} disabled={busy} aria-current={username === picked ? "true" : undefined} className={cn(styles.accountButton, username === picked && styles.selectedAccount)}>
                  <Users size={15} className={styles.accountIcon} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={styles.accountName}>{nameOf(username)}</span>
                    <span className={styles.accountMeta}>
                      <span className={draft.removed ? styles.blockedStatus : undefined}>{draft.removed ? "Хандалт хаалттай" : `${scopeCount(draft.grant)} хэсэгт эрхтэй`}</span>
                      {drafts[username] && <span className={styles.modified}>Өөрчилсөн</span>}
                    </span>
                  </span>
                  <ChevronRight size={15} className={styles.accountChevron} aria-hidden="true" />
                </button>
              );
            })}
            empty="Бүртгэл олдсонгүй"
          />
          <div className={styles.addArea}>
            <button type="button" className={styles.button} disabled={locked} aria-label={adding ? "Болих" : "Бүртгэл нэмэх"} aria-expanded={adding} aria-controls="access-add-account" onClick={() => setAdding((value) => !value)}>
              {adding ? <X size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
              <span className={styles.mobileAddText}>{adding ? "Болих" : "Бүртгэл нэмэх"}</span>
            </button>
            {adding && (
              <form id="access-add-account" className={cn(styles.addForm, styles.formPopover)} onSubmit={(event) => { event.preventDefault(); addAccount(); }}>
                <label htmlFor="access-new-name">Нэвтрэх нэр</label>
                <input id="access-new-name" className={styles.input} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Нэвтрэх нэр оруулах" autoComplete="off" spellCheck={false} autoFocus maxLength={256} disabled={locked} required />
                <button type="submit" disabled={locked || !newName.trim()} className={cn(styles.button, styles.primaryButton)}><Plus size={15} aria-hidden="true" /> Нэмэх</button>
              </form>
            )}
          </div>
        </section>

        <section className={styles.permissionsPanel} aria-labelledby="access-selected-heading">
          <div className={styles.selectionHeader}>
            <div className={styles.selectionIdentity}>
              <span className={styles.selectionIcon}><ShieldCheck size={22} aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 id="access-selected-heading" className={styles.selectedTitle}>{nameOf(picked).toUpperCase()}</h2>
                <span className={cn(styles.status, sel.removed && styles.blockedStatus)}>{loading ? "Ачаалж байна" : sel.removed ? "Хандалт хаалттай" : `${selectedScopes} хэсэгт эрхтэй`}</span>
              </div>
            </div>
            <button type="button" disabled={locked} aria-label={sel.removed ? "Хандалт нээх" : "Хандалт хаах"} title={sel.removed ? "Хандалт нээх" : "Хандалт хаах"} onClick={() => edit((grant) => grant, !sel.removed)} className={styles.button}>
              {sel.removed ? <UnlockKeyhole size={15} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}
              <span className={styles.actionText}>{sel.removed ? "Хандалт нээх" : "Хандалт хаах"}</span>
            </button>
          </div>

          <div className={styles.permissionToolbar}>
            <h3 className={styles.toolbarLabel}>{activeTab ? "ЦЭСИЙН НАРИЙВЧИЛСАН ЭРХ" : activeScope ? "ЦЭСИЙН ЭРХ" : "ХАНДАХ ЭРХ"}</h3>
            <div className={styles.toolbarActions}>
              {activeScope && activeTab ? (
                <button type="button" className={styles.textButton} disabled={disabled || !tabOpen(activeScope, activeTab.id) || (!sel.grant[viewKey(activeScope.scope, activeTab.id)] && !sel.grant[layerKey(activeScope.scope, activeTab.id)])} onClick={() => edit((grant) => {
                  clearDetail(grant, activeScope.scope, activeTab.id);
                  return grant;
                })}>Бүгдийг сонгох</button>
              ) : (
                <>
                  <button type="button" className={styles.textButton} disabled={disabled || allSelected} onClick={() => edit((grant) => {
                    (activeScope ? [activeScope] : CATALOG).forEach((scope) => { grant[scope.scope] = "all"; clearDetail(grant, scope.scope); });
                    return grant;
                  })}>Бүгдийг сонгох</button>
                  <button type="button" className={styles.textButton} disabled={disabled || !anySelected || activeHome} onClick={() => edit((grant) => {
                    (activeScope ? [activeScope] : CATALOG).filter((scope) => !home.includes(scope.scope)).forEach((scope) => { delete grant[scope.scope]; clearDetail(grant, scope.scope); });
                    return grant;
                  })}>Сонголт арилгах</button>
                </>
              )}
            </div>
          </div>

          {activeScope && activeTab ? (
            <TabDetail
              scope={activeScope}
              tab={activeTab}
              grant={sel.grant}
              open={tabOpen(activeScope, activeTab.id)}
              disabled={disabled}
              onBack={() => setTabId(null)}
              onToggle={toggleDetail}
            />
          ) : activeScope ? (
            <>
              <div className={styles.detailHeading}>
                <button type="button" className={styles.button} onClick={() => { setScopeId(null); setTabId(null); }}><ArrowLeft size={14} aria-hidden="true" /> Хэлтсүүд</button>
                <h4 className={styles.detailTitle} title={activeScope.label}>{activeScope.label.toUpperCase()}</h4>
              </div>
              {/*
                Бүлэгтэй хэлтэст (амьтан · ургамал) карт бүрд бүлгийн нэрийг
                давтахгүй — бүлгийн гарчгийн доор цэсүүд нь эгнэнэ (хэрэглэгч
                2026-10-23: "амьтан гэж бичихгүйгээр бүлэглэ").
              */}
              {(() => {
                const renderTab = (tab: CatalogTab) => {
                  const value = sel.grant[activeScope.scope];
                  const checked = value === "all" || (Array.isArray(value) && value.includes(tab.id));
                  return (
                    <label key={tab.id} className={cn(styles.tabOption, checked && !sel.removed && styles.selectedTab)} title={tab.label}>
                      <span className={styles.checkboxLabel}><Box state={checked ? "on" : "off"} onChange={() => toggleTab(activeScope, tab.id)} label={tab.label} disabled={disabled} /></span>
                      <span className={cn(styles.detailTabText, "flex-1")}>
                        <span>{tab.label}</span>
                      </span>
                      {/* Порталын самбартай цэс — харагдах хэсэг, давхаргыг нарийвчилна */}
                      {tab.layers && (
                        <button
                          type="button"
                          className={styles.ruleButton}
                          disabled={locked}
                          title={`${tab.label} — нарийвчлан тохируулах`}
                          onClick={(event) => {
                            event.preventDefault();
                            setTabId(tab.id);
                          }}
                        >
                          <span className={cn(styles.scopeStatus, checked && !sel.removed && styles.enabledStatus)}>{checked && !sel.removed ? ruleText(sel.grant, activeScope.scope, tab) : "Эрхгүй"}</span>
                          <ChevronRight size={14} className={styles.chevron} aria-hidden="true" />
                        </button>
                      )}
                    </label>
                  );
                };
                const groups = [...new Set(activeScope.tabs.map((tab) => tab.group).filter((g): g is string => !!g))];
                if (groups.length) {
                  const order = [...groups, undefined];
                  return (
                    <div key={`${picked}:${activeScope.scope}`} className={styles.groupedTabs} role="group" aria-label={`${activeScope.label} — цэсүүд`}>
                      {order.map((group) => {
                        const tabs = activeScope.tabs.filter((tab) => tab.group === group);
                        if (!tabs.length) return null;
                        return (
                          <section key={group ?? "other"} className={styles.tabGroup}>
                            {group && <h5 className={styles.groupHeading}>{group.toUpperCase()}</h5>}
                            <div className={styles.groupGrid}>{tabs.map(renderTab)}</div>
                          </section>
                        );
                      })}
                    </div>
                  );
                }
                return (
                  <PagedList
                    key={`${picked}:${activeScope.scope}`}
                    className={styles.tabs}
                    label={`${activeScope.label} — цэсүүд`}
                    rowHeight={52}
                    minColumnWidth={260}
                    maxColumns={3}
                    items={activeScope.tabs.map(renderTab)}
                  />
                );
              })()}
            </>
          ) : (
            <PagedList
              key={`${picked}:scopes`}
              className={styles.scopeList}
              label="Хэлтэс, хэсгийн эрх"
              rowHeight={40}
              items={CATALOG.filter((scope) => !home.includes(scope.scope)).map((scope) => {
                const count = openCount(sel.grant, scope);
                const full = sel.grant[scope.scope] === "all";
                const enabled = full || count > 0;
                return (
                  <div key={scope.scope} className={cn(styles.scopeRow, enabled && !sel.removed && styles.enabledScope)}>
                    <label className={styles.checkboxLabel}>
                      <Box state={full ? "on" : enabled ? "part" : "off"} onChange={() => toggleScope(scope)} label={`${scope.label} — бүх эрх`} disabled={disabled} />
                    </label>
                    <button type="button" className={styles.scopeToggle} title={scope.label} disabled={locked || (scope.tabs.length === 0 && sel.removed)} onClick={() => scope.tabs.length ? setScopeId(scope.scope) : toggleScope(scope)}>
                      <span className={styles.scopeName}>{scope.label}</span>
                      <span className={cn(styles.scopeStatus, enabled && !sel.removed && styles.enabledStatus)}>{sel.removed || !enabled ? "Эрхгүй" : !scope.tabs.length ? "Эрхтэй" : full ? "Бүх цэс" : `${count} / ${scope.tabs.length} цэс`}</span>
                      {scope.tabs.length > 0 && <ChevronRight size={14} className={styles.chevron} aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/** Цэсийн нарийвчлалын товч бичвэр — "Бүгд" эсвэл хязгаарласан тоо */
function ruleText(grant: Grant, scope: string, tab: CatalogTab): string {
  const rule = tabRule(grant, scope, tab.id);
  if (!rule.views && !rule.layers) return "Бүгд";
  const parts: string[] = [];
  if (rule.views) {
    const views = normViews(rule.views);
    parts.push(views.length === 1 ? (views[0] === "map" ? "Зөвхөн газрын зураг" : "Зөвхөн самбар") : `${views.length} / ${VIEW_PARTS.length} хэсэг`);
  }
  if (rule.layers) parts.push(`${rule.layers.length} / ${tab.layers?.length ?? 0} давхарга`);
  return parts.join(" · ");
}

/*
  НЭГ ЦЭСИЙН НАРИЙВЧЛАЛ — газрын зураг · давхарга · мэдээллийн самбар
  (хэрэглэгч 2026-10-23: "1. map 2. layer 3. db"). Цэс өөрөө эрхгүй бол
  чагтууд идэвхгүй (эхлээд цэсийг нээнэ). Газрын зураг, самбар хоёрын ядаж
  нэг нь, давхаргын ядаж нэг нь үлдэнэ.
*/
function TabDetail({ scope, tab, grant, open, disabled, onBack, onToggle }: {
  scope: CatalogScope;
  tab: CatalogTab;
  grant: Grant;
  open: boolean;
  disabled: boolean;
  onBack: () => void;
  onToggle: (key: string, all: string[], id: string) => void;
}) {
  const rule = tabRule(grant, scope.scope, tab.id);
  const views = rule.views ? normViews(rule.views) : null;
  const layers = tab.layers ?? [];
  const off = disabled || !open;
  const viewIds = VIEW_PARTS.map((part) => part.id as string);
  const row = (key: string, all: string[], chosen: string[] | null, item: { id: string; label: string }) => {
    const checked = open && (!chosen || chosen.includes(item.id));
    const last = checked && (chosen ?? all).length === 1;
    return (
      <label key={item.id} className={cn(styles.tabOption, "h-10", checked && styles.selectedTab)} title={item.label}>
        <span className={styles.checkboxLabel}>
          <Box state={checked ? "on" : "off"} onChange={() => onToggle(key, all, item.id)} label={item.label} disabled={off || last} />
        </span>
        <span className={styles.detailTabText}><span>{item.label}</span></span>
      </label>
    );
  };
  const section = (title: string, body: React.ReactNode) => (
    <section className="flex flex-col gap-1.5">
      <h5 className={styles.toolbarLabel}>{title}</h5>
      <div className="grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">{body}</div>
    </section>
  );
  const vKey = viewKey(scope.scope, tab.id);
  const lKey = layerKey(scope.scope, tab.id);
  const layerIds = layers.map((layer) => layer.id);
  return (
    <>
      <div className={styles.detailHeading}>
        <button type="button" className={styles.button} onClick={onBack}><ArrowLeft size={14} aria-hidden="true" /> Цэсүүд</button>
        <h4 className={styles.detailTitle} title={`${scope.label} — ${tab.label}`}>{tab.label.toUpperCase()}</h4>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3">
        {!open && <p className="text-[12px] text-ink-3">Энэ цэсэд хандах эрх олгогдоогүй байна</p>}
        {section("ГАЗРЫН ЗУРАГ", row(vKey, viewIds, views, VIEW_PARTS[0]))}
        {layers.length > 0 && section("ДАВХАРГА", layers.map((layer) => row(lKey, layerIds, rule.layers, layer)))}
        {section("МЭДЭЭЛЛИЙН САМБАР", row(vKey, viewIds, views, VIEW_PARTS[1]))}
      </div>
    </>
  );
}

function PagedList({ items, label, className, rowHeight, minColumnWidth = Infinity, maxColumns = 1, empty }: {
  items: React.ReactNode[];
  label: string;
  className: string;
  rowHeight: number;
  minColumnWidth?: number;
  maxColumns?: number;
  empty?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [page, setPage] = React.useState(0);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const columns = Math.min(maxColumns, Math.max(1, Math.floor((size.width + 4) / (minColumnWidth + 4))));
  const allRows = Math.max(1, Math.floor((size.height + 4) / (rowHeight + 4)));
  const needsPages = items.length > allRows * columns;
  const rows = needsPages ? Math.max(1, Math.floor((size.height - 34 + 4) / (rowHeight + 4))) : allRows;
  const pageSize = rows * columns;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  return (
    <div ref={ref} className={cn(styles.pagedList, className)} role="group" aria-label={label}>
      <div className={styles.pageItems} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${rowHeight}px` }}>
        {items.slice(currentPage * pageSize, (currentPage + 1) * pageSize)}
        {!items.length && <div className={styles.empty}>{empty}</div>}
      </div>
      {pageCount > 1 && (
        <div className={styles.pagination}>
          <button type="button" className={styles.paginationButton} disabled={!currentPage} onClick={() => setPage(currentPage - 1)} aria-label="Өмнөх хуудас"><ChevronLeft size={15} aria-hidden="true" /></button>
          <span>{currentPage + 1} / {pageCount}</span>
          <button type="button" className={styles.paginationButton} disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} aria-label="Дараах хуудас"><ChevronRight size={15} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}

function Box({ state, onChange, label, disabled }: {
  state: "on" | "part" | "off";
  onChange: () => void;
  label: string;
  disabled: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "part";
  }, [state]);
  return (
    <>
      <input ref={ref} type="checkbox" checked={state === "on"} onChange={onChange} aria-label={label} disabled={disabled} className={styles.checkbox} />
      <span className={cn(styles.checkboxMark, state === "on" && styles.checkboxChecked, state === "part" && styles.checkboxMixed)} aria-hidden="true">
        {state === "on" && <Check size={13} strokeWidth={3} />}
        {state === "part" && <Minus size={13} strokeWidth={3} />}
      </span>
    </>
  );
}
