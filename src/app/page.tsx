import Link from "next/link";
import { ArrowDown, ArrowUpRight, Database } from "lucide-react";
import { AdminOnly } from "@/components/auth/access";
import { CalendarCard } from "@/components/home/calendar-card";
import { DepartmentDirectory } from "@/components/home/department-directory";
import { DEPARTMENTS } from "@/lib/departments";
import { SOURCES } from "@/lib/sources";

export default function Home() {
  const live = DEPARTMENTS.filter((d) => d.status === "live").length;
  const sourceCounts = Object.fromEntries(DEPARTMENTS.map((d) => [d.slug, SOURCES.filter((s) => s.slug === d.slug).length]));
  return (
    <div className="command-home">
      <section className="home-intro" aria-labelledby="home-title">
        <div className="intro-copy">
          <p className="section-kicker"><span /> НИЙСЛЭЛИЙН БАЙГАЛЬ ОРЧНЫ ГАЗАР</p>
          <h1 id="home-title">Байгаль орчин.<br /><span>Нэгдсэн хяналт.</span></h1>
          <div className="intro-actions">
            <a href="#departments" className="action-primary">Ажлын самбар нээх <ArrowDown size={17} /></a>
            <AdminOnly><Link href="/sources" className="action-text">Эх сурвалжууд <ArrowUpRight size={17} /></Link></AdminOnly>
          </div>
          <div className="intro-index"><span>01 — 08</span><span>Нэг систем. Найман хэлтэс.</span></div>
        </div>
        <CalendarCard />
      </section>

      <section className="system-summary" aria-label="Системийн бүртгэлийн тойм">
        <div className="summary-heading"><span className="section-kicker">СИСТЕМИЙН ТОЙМ</span><p>Мэдээллийн<br />хамрах хүрээ</p></div>
        <div className="summary-number"><strong>{String(DEPARTMENTS.length).padStart(2, "0")}</strong><span>Хэлтэс</span></div>
        <div className="summary-number"><strong>{String(live).padStart(2, "0")}<small> / {DEPARTMENTS.length}</small></strong><span>Дата холбогдсон</span></div>
        <div className="summary-number"><strong>{SOURCES.length}</strong><span>Бүртгэлтэй эх сурвалж</span></div>
        <AdminOnly><Link href="/sources" className="summary-link"><Database size={19} /><span>Өгөгдлийн<br />бүртгэл харах</span><ArrowUpRight size={18} /></Link></AdminOnly>
      </section>

      <DepartmentDirectory sourceCounts={sourceCounts} />
      <footer className="workspace-footer"><span>Нийслэлийн байгаль орчны газар</span><p>Хяналтын нэгдсэн систем</p><span className="hidden sm:block">Мэдээлэлд тулгуурласан хамгаалал</span></footer>
    </div>
  );
}
