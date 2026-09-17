"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Database, LayoutGrid, Leaf } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { cn, isActivePath } from "@/lib/utils";

/*
  Dock 104px өргөнтэй тул хэлтсийн АЛБАН ТОВЧЛОЛ (хэрэглэгчийн шийдвэр,
  2026-09-17: "захиргаа → ЗУХ"). Бүтэн нэр `title`/`aria-label`-д
  үлдэнэ — "товчлол задална" дүрмийн ганц үл хамаарах газар нь энэ
  нарийн зурвас.

  ⚠ Дөрөв нь БАТАЛГААТАЙ: ЗУХ (хэрэглэгч), СААМХ (санхүүгийн
  дэвтрийн `Хариуцах нэгж` багана), АУХХ ба ХХ (хэлтсээс ирсэн эх
  сурвалжийн хавтасны нэр). Үлдсэн дөрвийг албан нэрийн үгийн эхний
  үсгээр ижил дүрмээр гаргасан — хэлтэс өөр товчлол хэрэглэдэг бол
  ЭНД л засна.
*/
const SHORT_NAMES: Record<string, string> = {
  zahirgaa: "ЗУХ",
  "sanhuu-monitoring": "СААМХ",
  orchin: "ХБОАХХ",
  oi: "ОХ",
  "amitan-urgamal": "АУХХ",
  "nogoon-bus": "НБАХХ",
  "unelgee-uur-amisgal": "БОҮУАӨХ",
  hyanalt: "ХХ",
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
