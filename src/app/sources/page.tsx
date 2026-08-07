import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/data";
import { DEPARTMENTS, STATUS_LABEL, getDepartment } from "@/lib/departments";
import { SOURCES } from "@/lib/sources";

export const metadata = { title: "Дата эх сурвалж" };

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <header>
        <div className="eyebrow mb-2.5">Систем</div>
        <h1 className="display text-[28px] leading-none">Дата эх сурвалж</h1>
        <div className="ruler mt-5 opacity-70" aria-hidden />
      </header>

      <section>
        <SectionHeader
          index="01"
          title="Холбогдсон эх сурвалж"
          note={`${SOURCES.length}`}
        />
        <Panel>
          <div className="divide-y divide-line">
            {SOURCES.map((s) => {
              const dept = getDepartment(s.slug);
              return (
                <Link
                  key={s.url}
                  href={`/departments/${s.slug}`}
                  style={
                    dept
                      ? ({ "--tone": `var(${dept.tone})` } as React.CSSProperties)
                      : undefined
                  }
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper-hi"
                >
                  <span className="h-6 w-[2px] shrink-0 bg-(--tone)" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]">{s.name}</span>
                    <span className="mt-1 block truncate text-[11.5px] text-ink-3">
                      {dept?.name}
                    </span>
                  </span>
                  <Badge tone="neutral">{s.kind}</Badge>
                  <ArrowRight
                    size={12}
                    className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </Link>
              );
            })}
          </div>
        </Panel>
      </section>

      <section>
        <SectionHeader index="02" title="Хэлтсүүд" note={`${DEPARTMENTS.length}`} />
        <Panel>
          <div className="divide-y divide-line">
            {DEPARTMENTS.map((d) => (
              <Link
                key={d.slug}
                href={`/departments/${d.slug}`}
                style={{ "--tone": `var(${d.tone})` } as React.CSSProperties}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper-hi"
              >
                <span className="h-6 w-[2px] shrink-0 bg-(--tone)" aria-hidden />
                <d.icon size={15} strokeWidth={1.5} className="shrink-0 text-(--tone)" />
                <span className="min-w-0 flex-1 text-[13.5px]">{d.name}</span>
                <Badge tone="neutral">{STATUS_LABEL[d.status]}</Badge>
                <ArrowRight
                  size={12}
                  className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </Link>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
