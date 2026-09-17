"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Database, LayoutGrid, Leaf } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { cn, isActivePath } from "@/lib/utils";

const SHORT_NAMES: Record<string, string> = {
  zahirgaa: "Захиргаа", "sanhuu-monitoring": "Санхүү", orchin: "Орчин",
  oi: "Ой", "amitan-urgamal": "Амьтан", "nogoon-bus": "Ногоон бүс",
  "unelgee-uur-amisgal": "Үнэлгээ", hyanalt: "Хяналт",
};

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
        <Link href="/sources" title="Дата эх сурвалж" className={cn("dock-link", isActivePath(path, "/sources", true) && "active")} aria-current={isActivePath(path, "/sources", true) ? "page" : undefined}>
          <Database size={20} /><span>Эх сурвалж</span>
        </Link>
      </nav>
      <span className="dock-end" aria-hidden="true"><ArrowUpRight size={18} /></span>
    </aside>
  );
}
