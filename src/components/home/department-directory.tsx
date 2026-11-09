"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, Database } from "lucide-react";
import { num } from "@/lib/utils";
import { DepartmentPreview } from "./department-preview";
import { DEPARTMENTS, SHORT_NAMES } from "@/lib/departments";
import { SHORT_EN, useDeptName, useLang, useT } from "@/lib/i18n";

/*
  ⚠⚠ НҮҮР ХУУДАС БҮХ ХЭЛТЭСТ ИЖИЛ (хэрэглэгч 2026-11-09: "энэ нүүрийг бүх хэлтэс
  яг энэ хэвээр нь харна"). Урьд нь тоон тойм, хэлтсийн картууд хандах эрхээр
  шүүгддэг байсан тул хэлтсийн бүртгэлээр нэвтрэхэд ганц карт л гарч байв. Одоо
  найман хэлтэс, бүх тоо хүн бүрт; картын урьдчилсан харагдац ч бүгдэд
  (`DepartmentGate` нь preview iframe-ийг нэвтрүүлнэ). Хэлтсийн ХУУДАС руу орох
  эрх хэвээр хязгаартай — эрхгүй хэлтсийн карт дарахад "эрх байхгүй".
*/
const departments = DEPARTMENTS;

export function HomeSummary({ sourceCounts }: { sourceCounts: Record<string, number> }) {
  const t = useT();
  const deptName = useDeptName();
  const lang = useLang();
  const sources = departments.reduce((total, d) => total + (sourceCounts[d.slug] ?? 0), 0);

  return (
    <dl className="home-summary">
      <div><dt><span className="summary-icon" aria-hidden><Building2 size={19} /></span>{t("Хэлтэс", "Divisions")}</dt><dd className="num">{num(departments.length)}</dd></div>
      <div><dt><span className="summary-icon" aria-hidden><Database size={19} /></span>{t("Эх сурвалж", "Data sources")}</dt><dd className="num">{num(sources)}</dd></div>
      {departments.filter((d) => (sourceCounts[d.slug] ?? 0) > 0).map((d) => (
        <div key={d.slug} className="home-source-indicator">
          <dt>
            <span className="summary-icon" aria-hidden><d.icon size={19} /></span>
            <abbr className="summary-label" title={`${deptName(d)} · ${t("Эх сурвалж", "Data sources")}`}>
              {lang === "en" ? SHORT_EN[d.slug] : SHORT_NAMES[d.slug]}
            </abbr>
          </dt>
          <dd className="num">{num(sourceCounts[d.slug])}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Department tiles fill the available height without stretching the page. */
export function DepartmentDirectory() {
  const t = useT();
  const deptName = useDeptName();
  const lang = useLang();
  return (
    <nav aria-label={t("Хэлтэс", "Divisions")} className="home-depts">
      {departments.map((d) => (
          <Link key={d.slug} href={`/departments/${d.slug}`} className="department-entry" title={deptName(d)} aria-label={deptName(d)}>
            <span className="entry-top">
              <span className="entry-icon" aria-hidden><d.icon size={23} strokeWidth={1.5} /></span>
              <span className="entry-name">{lang === "en" ? SHORT_EN[d.slug] : SHORT_NAMES[d.slug]}</span>
              <span className="entry-arrow" aria-hidden><ArrowUpRight size={17} /></span>
            </span>
            <span className="entry-copy">
              <DepartmentPreview slug={d.slug} name={deptName(d)} />
            </span>
          </Link>
      ))}
    </nav>
  );
}
