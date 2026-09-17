"use client";

import * as React from "react";
import { Check, Database, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function useStored(key: string): string | null {
  return React.useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    () => { try { return localStorage.getItem(key); } catch { return null; } },
    () => null,
  );
}

export function useStoredTab<T extends string>(key: string, options: readonly T[], fallback: T): [T, (v: T) => void] {
  const stored = useStored(key);
  const [override, setOverride] = React.useState<T | null>(null);
  const value = override ?? (options.includes(stored as T) ? stored as T : fallback);
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
};

/** Persistent dataset navigation shared by department workspaces. */
export function SourceTabs<T extends string>({
  tabs, value, onChange, label = "Эх сурвалж", enabled, onToggle, groupControl,
}: {
  tabs: readonly (SourceTab & { id: T })[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
  enabled?: ReadonlySet<string>;
  onToggle?: (id: T) => void;
  groupControl?: React.ReactNode;
}) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLocaleLowerCase("mn");
  const matches = tabs.filter((tab) => `${tab.label} ${tab.note} ${tab.full ?? ""}`.toLocaleLowerCase("mn").includes(q));

  function choose(tab: SourceTab & { id: T }) {
    if (tab.checkable && !enabled?.has(tab.id)) onToggle?.(tab.id);
    else onChange(tab.id);
  }

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
        {matches.map((tab) => {
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
        })}
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