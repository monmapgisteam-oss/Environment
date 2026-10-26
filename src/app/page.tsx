import { CalendarCard } from "@/components/home/calendar-card";
import { DepartmentDirectory, HomeSummary } from "@/components/home/department-directory";
import { DEPARTMENTS } from "@/lib/departments";
import { SOURCES } from "@/lib/sources";
import { T } from "@/components/ui/t";

/**
 * Ерөнхий самбар — нэг хэсэг: тоон тойм, хэлтсийн картууд, хуанли.
 * Нэг дэлгэцэнд багтана; нарийн дэлгэцэд хэлтсийн жагсаалт дотроо гүйнэ.
 * Тоон тойм болон хэлтсийн жагсаалт нь ижил хандах эрхээр шүүгдэнэ.
 */
export default function Home() {
  const sourceCounts = Object.fromEntries(DEPARTMENTS.map((d) => [d.slug, SOURCES.filter((s) => s.slug === d.slug).length]));
  return (
    <section className="home-one" aria-label="Ерөнхий самбар">
      <div className="home-overview">
        <HomeSummary sourceCounts={sourceCounts} />
        <CalendarCard />
      </div>
      <div className="home-layout">
        <div className="home-departments">
          <h2><T mn="Хэлтсүүд" en="Divisions" /></h2>
          <DepartmentDirectory />
        </div>
      </div>
    </section>
  );
}
