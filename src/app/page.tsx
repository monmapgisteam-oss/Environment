import Link from "next/link";
import { ArrowDown, ArrowUpRight, Database } from "lucide-react";
import { AdminOnly } from "@/components/auth/access";
import { CalendarCard } from "@/components/home/calendar-card";
import { DepartmentDirectory } from "@/components/home/department-directory";
import { DEPARTMENTS } from "@/lib/departments";
import { SOURCES } from "@/lib/sources";
import { T } from "@/components/ui/t";

export default function Home() {
  const live = DEPARTMENTS.filter((d) => d.status === "live").length;
  const sourceCounts = Object.fromEntries(DEPARTMENTS.map((d) => [d.slug, SOURCES.filter((s) => s.slug === d.slug).length]));
  return (
    <div className="command-home">
      <section className="home-intro" aria-labelledby="home-title">
        <div className="intro-copy">
          <p className="section-kicker"><span /> <T mn="НИЙСЛЭЛИЙН БАЙГАЛЬ ОРЧНЫ ГАЗАР" en="CAPITAL CITY ENVIRONMENT DEPARTMENT" /></p>
          <h1 id="home-title"><T mn="Байгаль орчин." en="Environment." /><br /><span><T mn="Нэгдсэн хяналт." en="Unified oversight." /></span></h1>
          <div className="intro-actions">
            <a href="#departments" className="action-primary"><T mn="Ажлын самбар нээх" en="Open dashboards" /> <ArrowDown size={17} /></a>
            <AdminOnly><Link href="/sources" className="action-text"><T mn="Эх сурвалжууд" en="Data sources" /> <ArrowUpRight size={17} /></Link></AdminOnly>
          </div>
          <div className="intro-index"><span>01 — 08</span><span><T mn="Нэг систем. Найман хэлтэс." en="One system. Eight divisions." /></span></div>
        </div>
        <CalendarCard />
      </section>

      <section className="system-summary" aria-label="Системийн бүртгэлийн тойм">
        <div className="summary-heading"><span className="section-kicker"><T mn="СИСТЕМИЙН ТОЙМ" en="SYSTEM OVERVIEW" /></span><p><T mn="Мэдээллийн" en="Data" /><br /><T mn="хамрах хүрээ" en="coverage" /></p></div>
        <div className="summary-number"><strong>{String(DEPARTMENTS.length).padStart(2, "0")}</strong><span><T mn="Хэлтэс" en="Divisions" /></span></div>
        <div className="summary-number"><strong>{String(live).padStart(2, "0")}<small> / {DEPARTMENTS.length}</small></strong><span><T mn="Дата холбогдсон" en="Data connected" /></span></div>
        <div className="summary-number"><strong>{SOURCES.length}</strong><span><T mn="Бүртгэлтэй эх сурвалж" en="Registered sources" /></span></div>
        <AdminOnly><Link href="/sources" className="summary-link"><Database size={19} /><span><T mn="Өгөгдлийн" en="View data" /><br /><T mn="бүртгэл харах" en="registry" /></span><ArrowUpRight size={18} /></Link></AdminOnly>
      </section>

      <DepartmentDirectory sourceCounts={sourceCounts} />
      <footer className="workspace-footer"><span><T mn="Нийслэлийн байгаль орчны газар" en="Capital City Environment Department" /></span><p><T mn="Хяналтын нэгдсэн систем" en="Integrated Monitoring System" /></p><span className="hidden sm:block"><T mn="Мэдээлэлд тулгуурласан хамгаалал" en="Data-driven protection" /></span></footer>
    </div>
  );
}
