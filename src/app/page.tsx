import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/data";
import { DEPARTMENTS, STATUS_LABEL } from "@/lib/departments";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <header>
        <div className="eyebrow mb-2.5">Байгаль орчны нэгдсэн платформ</div>
        <h1 className="display text-[31px] leading-none">Ерөнхий самбар</h1>
        <div className="ruler mt-5 opacity-70" aria-hidden />
      </header>

      <section>
        <SectionHeader index="01" title="Хэлтсүүд" note={`${DEPARTMENTS.length}`} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {DEPARTMENTS.map((d) => (
            <Link
              key={d.slug}
              href={`/departments/${d.slug}`}
              style={{ "--tone": `var(${d.tone})` } as React.CSSProperties}
              className="group relative block rounded-xs border border-line bg-paper-2 transition-colors hover:border-(--tone)"
            >
              <div className="flex h-full flex-col p-4">
                <span
                  className="tinted flex size-8 items-center justify-center rounded-xs border"
                  style={{
                    borderColor: "color-mix(in oklab, var(--tone) 28%, transparent)",
                  }}
                >
                  <d.icon size={16} strokeWidth={1.5} className="text-(--tone)" />
                </span>

                <h3 className="display mt-3.5 text-[15.5px] leading-snug">{d.name}</h3>

                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <Badge tone="neutral">{STATUS_LABEL[d.status]}</Badge>
                  <ArrowRight
                    size={12}
                    className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
