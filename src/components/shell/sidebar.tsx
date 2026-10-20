"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Database,
  LayoutGrid,
  Leaf,
} from "lucide-react";
import { DEPARTMENTS, SHORT_NAMES } from "@/lib/departments";
import { cn, isActivePath } from "@/lib/utils";

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="workspace-dock">
      <Link href="/" className="dock-brand" aria-label="Ерөнхий самбар"><Leaf size={26} strokeWidth={1.5} /></Link>
      <nav aria-label="Үндсэн цэс" className="dock-nav">
        <Link href="/" className={cn("dock-link", isActivePath(path, "/", true) && "active")} aria-current={isActivePath(path, "/", true) ? "page" : undefined}>
          <LayoutGrid size={20} /><span>Самбар</span>
        </Link>
        <div className="dock-divider" />
        {DEPARTMENTS.map((d) => {
          const href = `/departments/${d.slug}`;
          const active = isActivePath(path, href);
          return (
            <Link key={d.slug} href={href} aria-label={d.name} aria-current={active ? "page" : undefined} title={d.name} className={cn("dock-link", active && "active")}>
              <d.icon size={20} strokeWidth={1.6} /><span>{SHORT_NAMES[d.slug]}</span>
            </Link>
          );
        })}
        <div className="dock-divider" />
        {/*
          ⚠ ДҮН ШИНЖИЛГЭЭ нь ЭХ СУРВАЛЖИЙН ДЭЭР (хэрэглэгчийн заасан
          байрлал, 2026-09-29). Хэлтсүүдийн ДАРААХ бүлэгт сууна:
          дээрх бүлэг нь нэг хэлтсийн ажлын талбар бол эдгээр хоёр нь
          хэлтсээс ҮЛ ХАМААРАХ, бүх системийн хэмжээний хуудсууд.
        */}
        <Link href="/analysis" title="Дүн шинжилгээ" className={cn("dock-link", isActivePath(path, "/analysis", true) && "active")} aria-current={isActivePath(path, "/analysis", true) ? "page" : undefined}>
          <ChartNoAxesCombined size={20} /><span>Дүн шинжилгээ</span>
        </Link>
        <Link href="/sources" title="Дата эх сурвалж" className={cn("dock-link", isActivePath(path, "/sources", true) && "active")} aria-current={isActivePath(path, "/sources", true) ? "page" : undefined}>
          <Database size={20} /><span>Эх сурвалж</span>
        </Link>
      </nav>
      <span className="dock-end" aria-hidden="true"><ArrowUpRight size={18} /></span>
    </aside>
  );
}
