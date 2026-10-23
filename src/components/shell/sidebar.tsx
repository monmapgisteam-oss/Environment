"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Database,
  LayoutGrid,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import { useAccess } from "@/components/auth/access";
import { SHORT_NAMES } from "@/lib/departments";
import { cn, isActivePath } from "@/lib/utils";
import { SHORT_EN, useDeptName, useLang, useT } from "@/lib/i18n";

export function Sidebar() {
  const path = usePathname();
  /* Хэлтсийн бүртгэл зөвхөн өөрийн хэлтсээ харна (`lib/access.ts`) */
  const { departments, admin, analysis, blocked } = useAccess();
  const lang = useLang();
  const t = useT();
  const deptName = useDeptName();
  return (
    <aside className="workspace-dock">
      <Link href="/" className="dock-brand" aria-label={t("Ерөнхий самбар", "Overview")}><Leaf size={26} strokeWidth={1.5} /></Link>
      {/* Хаагдсан бүртгэлд цэс огт гарахгүй — очих хуудас байхгүй */}
      {!blocked && <nav aria-label={t("Үндсэн цэс", "Main menu")} className="dock-nav">
        <Link href="/" className={cn("dock-link", isActivePath(path, "/", true) && "active")} aria-current={isActivePath(path, "/", true) ? "page" : undefined}>
          <LayoutGrid size={20} /><span>{t("Самбар", "Overview")}</span>
        </Link>
        <div className="dock-divider" />
        {departments.map((d) => {
          const href = `/departments/${d.slug}`;
          const active = isActivePath(path, href);
          return (
            <Link key={d.slug} href={href} aria-label={deptName(d)} aria-current={active ? "page" : undefined} title={deptName(d)} className={cn("dock-link", active && "active")}>
              <d.icon size={20} strokeWidth={1.6} /><span>{lang === "en" ? SHORT_EN[d.slug] : SHORT_NAMES[d.slug]}</span>
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
        {analysis && <Link href="/analysis" title={t("Дүн шинжилгээ", "Analysis")} className={cn("dock-link", isActivePath(path, "/analysis", true) && "active")} aria-current={isActivePath(path, "/analysis", true) ? "page" : undefined}>
          <ChartNoAxesCombined size={20} /><span>{t("Дүн шинжилгээ", "Analysis")}</span>
        </Link>}
        {/* Эх сурвалж, Эрх хоёр ЗӨВХӨН порталын админд (хэрэглэгч 2026-10-20) */}
        {admin && <Link href="/sources" title={t("Дата эх сурвалж", "Data sources")} className={cn("dock-link", isActivePath(path, "/sources", true) && "active")} aria-current={isActivePath(path, "/sources", true) ? "page" : undefined}>
          <Database size={20} /><span>{t("Эх сурвалж", "Sources")}</span>
        </Link>}
        {/* ЭРХИЙН ЗОХИЦУУЛАЛТ — эх сурвалжийн ДООР (хэрэглэгч 2026-10-16);
            ЗӨВХӨН порталын админд (`org_admin`) */}
        {admin && <Link href="/access" title={t("Эрхийн зохицуулалт", "Access control")} className={cn("dock-link", isActivePath(path, "/access", true) && "active")} aria-current={isActivePath(path, "/access", true) ? "page" : undefined}>
          <ShieldCheck size={20} /><span>{t("Эрх", "Access")}</span>
        </Link>}
      </nav>}
      <span className="dock-end" aria-hidden="true"><ArrowUpRight size={18} /></span>
    </aside>
  );
}
