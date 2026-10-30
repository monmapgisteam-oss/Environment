"use client";

import dynamic from "next/dynamic";
import { ClipboardList, GitCompareArrows, Loader2 } from "lucide-react";
import { NoAccess, useAccess } from "@/components/auth/access";
import { useStoredTab } from "@/components/ui/source-tabs";
import "./duty-analysis.css";

const loading = () => <div className="sanhuu-loading" role="status"><Loader2 size={16} className="animate-spin" />Мэдээлэл ачаалж байна…</div>;
const Plan = dynamic(() => import("./dashboard").then((m) => m.SanhuuDashboard), { loading });
const Analysis = dynamic(() => import("./duty-analysis").then((m) => m.DutyAnalysisDashboard), { loading });

export const TABS = [
  { id: "plan", label: "Гүйцэтгэх ажил", icon: ClipboardList },
  { id: "duty-analysis", label: "Чиг үүргийн шинжилгээ", icon: GitCompareArrows },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id);
const SCOPE = "sanhuu-monitoring";

export function SanhuuWorkspace() {
  const [tab, pick] = useStoredTab<Tab>("sanhuu.tab", IDS, "plan", SCOPE);
  const { allowsTab } = useAccess();
  const available = TABS.filter((t) => allowsTab(SCOPE, t.id));
  if (!available.length) return <NoAccess />;
  return (
    <div className="sanhuu-workspace">
      <nav className="sanhuu-menu" aria-label="СААМХ-ийн цэс">
        {available.map((item) => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => pick(item.id)}><item.icon size={16} aria-hidden />{item.label}</button>)}
      </nav>
      <div className="sanhuu-content">{allowsTab(SCOPE, tab) && (tab === "duty-analysis" ? <Analysis /> : <Plan />)}</div>
    </div>
  );
}
