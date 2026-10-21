"use client";

import * as React from "react";
import { LogOut, PencilLine, type LucideIcon } from "lucide-react";
import { getDepartment } from "@/lib/departments";

/** Засварын цонхны эх — хэлтэс ба өгөгдлийн багц (`EditCard`-аас дамжина) */
export type EditSource = { scope: string; label: string; icon?: LucideIcon };

/*
  ЗАСВАРЫН ЦОНХНЫ ТОЛГОЙ (хэрэглэгч 2026-10-21: "heltesiin ner bolon ymar
  ugugdul zasaj bga tuunii ner haragdana buyu Өгөгдлийн багц bga nereer").
  Хэлтсийн нэр дээр, доор нь "Өгөгдлийн багц" жагсаалт дахь нэрээр нь
  өгөгдлийн багц; тэмдэг нь тухайн багцынх, өнгө нь хэлтсийнх.
*/
export function EditorHead({ source, onClose, children }: { source: EditSource; onClose: () => void; children?: React.ReactNode }) {
  const dept = getDepartment(source.scope);
  const Icon = source.icon ?? PencilLine;
  return (
    <header className="feature-editor-head" style={dept ? ({ "--tone": `var(${dept.tone})` } as React.CSSProperties) : undefined}>
      <span className="feature-editor-symbol" aria-hidden="true">
        {React.createElement(Icon, { size: 18, strokeWidth: 1.6 })}
      </span>
      <div className="min-w-0">
        {dept && <span className="feature-editor-dept truncate">{dept.name}</span>}
        <h2>
          <span className="feature-editor-title truncate">{source.label}</span>
        </h2>
      </div>
      {children}
      {/* "Өгөгдөл засах" тэмдэг "Гарах" товчны ӨМНӨ (хэрэглэгч 2026-10-21) */}
      <span className="feature-editor-tag">
        <PencilLine size={13} strokeWidth={1.8} />
        <span>Өгөгдөл засах</span>
      </span>
      <button type="button" className="feature-editor-close" onClick={onClose}>
        <LogOut size={13} strokeWidth={1.8} />
        <span>Гарах</span>
      </button>
    </header>
  );
}
