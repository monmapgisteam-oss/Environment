"use client";

import * as React from "react";
import { Check, ChevronDown, Database, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccess } from "@/components/auth/access";

export function useStored(key: string): string | null {
  return React.useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    () => { try { return localStorage.getItem(key); } catch { return null; } },
    () => null,
  );
}

/**
 * Хадгалсан таб. `scope` (хэлтсийн slug) өгвөл ЭРХГҮЙ цэс хэзээ ч
 * сонгогдохгүй — хадгалсан, дарсан утга эрхгүй бол эхний нээлттэй цэс
 * (`lib/access.ts`, супер админы тохиргоо).
 */
export function useStoredTab<T extends string>(key: string, options: readonly T[], fallback: T, scope?: string): [T, (v: T) => void] {
  const stored = useStored(key);
  const [override, setOverride] = React.useState<T | null>(null);
  const { allowsTab } = useAccess();
  const ok = (v: T | null): v is T => v != null && options.includes(v) && (!scope || allowsTab(scope, v));
  const want = override ?? (stored as T | null);
  const value = ok(want) ? want : ok(fallback) ? fallback : (options.find((o) => ok(o)) ?? fallback);
  const pick = React.useCallback((v: T) => {
    setOverride(v);
    try { localStorage.setItem(key, v); } catch {}
  }, [key]);
  return [value, pick];
}

export type SourceTab = {
  id: string;
  label: string;
  note: string;
  full?: string;
  icon: LucideIcon;
  /** Demo datasets require an explicit selection; their enabled state is never persisted. */
  checkable?: boolean;
  /** `sections` өгсөн үед аль бүлгийн дотор жагсагдах вэ */
  group?: string;
};

/** Жагсаалт доторх задардаг бүлгийн мөр */
export type SourceSection = { id: string; label: string; note: string; icon: LucideIcon };

/** Persistent dataset navigation shared by department workspaces. */
export function SourceTabs<T extends string>({
  tabs: allTabs, value, onChange, label = "Эх сурвалж", enabled, onToggle, groupControl, sections, scope,
}: {
  tabs: readonly (SourceTab & { id: T })[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
  enabled?: ReadonlySet<string>;
  onToggle?: (id: T) => void;
  groupControl?: React.ReactNode;
  /*
    Жагсаалт ДОТОРХ бүлэг (хүрээлэн буй орчны хэлтэс, 2026-10-16: "хуучин
    байсныг яг тэр хэвээр нь 2 group болго, хөрс дээр дарвал 3 доошоо
    гарч ирнэ"). Бүлэг бүр мөр болж, дарахад сэдвүүд нь доор нь задарна.
    Анхдагчаар сонгосон сэдвийн бүлэг нээлттэй; хайлтын үед бүгд задарна.
  */
  sections?: readonly SourceSection[];
  /** Хэлтсийн slug — өгвөл эрхгүй цэс жагсаалтад ГАРАХГҮЙ */
  scope?: string;
}) {
  const { allowsTab } = useAccess();
  const tabs = scope ? allTabs.filter((t) => allowsTab(scope, t.id)) : allTabs;
  const [query, setQuery] = React.useState("");
  const home = tabs.find((t) => t.id === value)?.group;
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({});
  const isOpen = (id: string) => toggled[id] ?? id === home;
  const q = query.trim().toLocaleLowerCase("mn");
  const matches = tabs.filter((tab) => `${tab.label} ${tab.note} ${tab.full ?? ""}`.toLocaleLowerCase("mn").includes(q));

  function choose(tab: SourceTab & { id: T }) {
    if (tab.checkable && !enabled?.has(tab.id)) onToggle?.(tab.id);
    else onChange(tab.id);
  }

  const item = (tab: SourceTab & { id: T }) => {
    const selected = value === tab.id && (!tab.checkable || enabled?.has(tab.id));
    return (
      <div key={tab.id} className={cn("dataset-panel-item", selected && "is-selected")}>
        <button type="button" className="dataset-panel-choice" aria-pressed={Boolean(selected)} onClick={() => choose(tab)} title={tab.full ?? tab.label}>
          <tab.icon size={18} strokeWidth={1.5} className="dataset-panel-item-icon" />
          <span className="dataset-panel-copy"><strong>{tab.label}</strong><span>{tab.note}</span>{tab.checkable && <small>Загвар өгөгдөл</small>}</span>
          {selected && <Check size={14} className="dataset-panel-check" aria-hidden="true" />}
        </button>
        {tab.checkable && <label className="dataset-demo-toggle"><input type="checkbox" checked={Boolean(enabled?.has(tab.id))} onChange={() => onToggle?.(tab.id)} />Загвар өгөгдлийг нээх</label>}
      </div>
    );
  };

  return (
    <aside className="dataset-panel" aria-label={label}>
      <header className="dataset-panel-heading">
        <span className="dataset-panel-symbol"><Database size={18} strokeWidth={1.6} /></span>
        <div><span className="dataset-eyebrow">ХЭЛТСИЙН МЭДЭЭЛЭЛ</span><h2>Өгөгдлийн багц</h2></div>
        <span className="dataset-panel-count">{tabs.length}</span>
      </header>
      {groupControl}
      <div className="dataset-panel-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" aria-label="Өгөгдлийн багц хайх" placeholder="Өгөгдөл хайх…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button type="button" aria-label="Хайлт цэвэрлэх" onClick={() => setQuery("")}><X size={14} /></button>}
      </div>
      <nav className="dataset-panel-list" aria-label="Өгөгдлийн багцууд">
        {sections
          ? sections.map((sec) => {
              const own = matches.filter((t) => t.group === sec.id);
              if (!own.length) return null;
              const open = q ? true : isOpen(sec.id);
              const holds = own.some((t) => t.id === value);
              return (
                <div key={sec.id} className="dataset-panel-section">
                  <button
                    type="button"
                    className={cn("dataset-panel-group", holds && !open && "is-holding")}
                    aria-expanded={open}
                    onClick={() => setToggled((m) => ({ ...m, [sec.id]: !open }))}
                  >
                    <sec.icon size={18} strokeWidth={1.5} className="dataset-panel-item-icon" />
                    <span className="dataset-panel-copy"><strong>{sec.label}</strong><span>{sec.note}</span></span>
                    <ChevronDown size={14} className={cn("dataset-panel-chevron", !open && "-rotate-90")} aria-hidden="true" />
                  </button>
                  {open && <div className="dataset-panel-children">{own.map(item)}</div>}
                </div>
              );
            })
          : matches.map(item)}
        {!matches.length && <p role="status" className="dataset-no-results">Тохирох өгөгдлийн багц олдсонгүй.</p>}
      </nav>
      <footer className="dataset-panel-footer" role="status">{matches.length} / {tabs.length} багц</footer>
    </aside>
  );
}

export function TabGroups<T extends string>({ groups, value, onChange, label = "Бүлэг" }: {
  groups: readonly { id: T; label: string; note: string; icon: LucideIcon }[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="dataset-groups">
      {groups.map((group) => <button type="button" key={group.id} aria-pressed={group.id === value} onClick={() => onChange(group.id)}><group.icon size={16} strokeWidth={1.6} /><span>{group.label}</span><span className="dataset-group-note">{group.note}</span></button>)}
    </div>
  );
}