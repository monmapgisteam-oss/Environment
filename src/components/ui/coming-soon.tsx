import { Panel } from "@/components/ui/panel";

export function ComingSoon({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="border-b border-line pb-5">
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="display text-[27px] leading-none">{title}</h1>
        <p className="mt-2.5 max-w-[62ch] text-[13px] leading-relaxed text-ink-2">
          {description}
        </p>
      </div>

      <Panel className="paper-grid border-dashed">
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="rounded-xs border border-line-2 bg-paper-2 px-2 py-1 text-[10.5px] tracking-[0.14em] text-ink-3 uppercase">
            Боловсруулж байна
          </span>
          <div className="grid max-w-[640px] gap-1.5 sm:grid-cols-2">
            {items.map((it) => (
              <div
                key={it}
                className="rounded-xs border border-line bg-paper-2 px-3 py-2 text-left text-[12px] text-ink-2"
              >
                {it}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
