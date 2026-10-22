"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { PencilLine, type LucideIcon } from "lucide-react";
import { editTargets } from "@/lib/edit-targets";

/*
  "ӨГӨГДӨЛ ЗАСАХ" КАРТ — зүүн самбарын "Өгөгдлийн багц"-ын ДЭЭР (хэрэглэгч
  2026-10-20). Сонгосон багцын давхаргуудыг ({@link editTargets}) засварын
  цонхоор ({@link ./data-editor}) нээнэ. Давхаргагүй багцад товч идэвхгүй.

  ⚠ Засварлагч ба SDK нь ЗӨВХӨН товч дарахад ачаалагдана.
*/
const DataEditor = dynamic(() => import("./data-editor").then((m) => m.DataEditor), { ssr: false });

export function EditCard({ scope, tab, label, full, icon }: { scope: string; tab: string; label: string; full?: string; icon?: LucideIcon }) {
  const targets = React.useMemo(() => editTargets(scope, tab), [scope, tab]);
  const [open, setOpen] = React.useState(false);
  const has = targets.length > 0;

  return (
    <section className="dataset-edit" aria-label="Өгөгдөл засах">
      <header className="dataset-panel-heading">
        <span className="dataset-panel-symbol"><PencilLine size={18} strokeWidth={1.6} /></span>
        <div className="min-w-0">
          <span className="dataset-eyebrow">ӨГӨГДЛИЙН БАГЦ</span>
          <h2>Өгөгдөл засах</h2>
        </div>
      </header>
      <button type="button" className="dataset-edit-button" disabled={!has} onClick={() => setOpen(true)} title={has ? (full ?? label) : undefined}>
        <PencilLine size={14} strokeWidth={1.8} />
        <span>{has ? "Засварлах" : "Засварлах давхарга байхгүй"}</span>
        {has && <span className="dataset-edit-count num">{targets.length} давхарга</span>}
      </button>
      {open && (
        <DataEditor
          source={{ scope, label, icon }}
          targets={targets}
          onClose={(changed) => {
            setOpen(false);
            if (changed) window.location.reload();
          }}
        />
      )}
    </section>
  );
}
