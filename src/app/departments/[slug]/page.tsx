import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/data";
import { DEPARTMENTS, STATUS_LABEL, getDepartment } from "@/lib/departments";

export function generateStaticParams() {
  return DEPARTMENTS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dept = getDepartment(slug);
  return { title: dept?.name ?? "Хэлтэс" };
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dept = getDepartment(slug);
  if (!dept) notFound();

  const tone = `var(${dept.tone})`;

  return (
    <div
      className="mx-auto max-w-[1400px] space-y-7"
      style={{ "--tone": tone } as React.CSSProperties}
    >
      <header className="relative">
        <span
          aria-hidden
          className="absolute top-0 -left-4 h-full w-[3px] bg-(--tone) lg:-left-6"
        />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-[68ch]">
            <div className="mb-3">
              <Badge tone="neutral">{STATUS_LABEL[dept.status]}</Badge>
            </div>
            <h1 className="display text-[27px] leading-[1.18]">{dept.name}</h1>
          </div>

          <div
            className="tinted flex size-16 shrink-0 items-center justify-center rounded-xs border"
            style={{ borderColor: `color-mix(in oklab, ${tone} 30%, transparent)` }}
          >
            <dept.icon size={28} strokeWidth={1.25} className="text-(--tone)" />
          </div>
        </div>
        <div className="ruler mt-5 opacity-70" aria-hidden />
      </header>

      <Panel className="border-dashed">
        <div className="hatch flex items-center justify-center px-6 py-24">
          <span className="bg-paper-2 px-3 text-[13px] text-ink-3">Мэдээлэл алга</span>
        </div>
      </Panel>
    </div>
  );
}
