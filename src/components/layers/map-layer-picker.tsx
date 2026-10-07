"use client";

import * as React from "react";
import { Check, Layers3, Loader2 } from "lucide-react";
import { cn, num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   ГАЗРЫН ЗУРАГ ДЭЭРХ ДАВХАРГА СОНГОГЧ ({@link LayerSet.mapPicker})

   Давхаргын тэмдэгтэй товч → дарахад хайрцагтай жагсаалт унжина.
   Суурь зургийн тэмдгийн ЯГ ДООР суудаг тул хэлбэр нь түүнтэй ижил:
   зөвхөн икон, дэвсгэргүй, сүүдэртэй; цэс нь баруун ирмэгтээ наалдана
   (`BasemapGallery`).

   Жагсаалтад ЗӨВХӨН ДАВХЦУУЛЖ ХАРАХ давхаргууд (`LayerSet.mapOnly`)
   орно: асаахад зураг дээр гарна, hover тайлбар, бичлэгийн цонх
   ажиллана, диаграм гарахгүй (хэрэглэгч, 2026-10-05).

   ⚠ Мөр бүрийн хайрцаг нь давхаргын ӨНГӨӨР дүүрнэ — жагсаалт нь
   зургийн тайлбарын үүргийг давхар гүйцэтгэнэ (баганын жагсаалттай
   нэг зарчим).
   ⚠ Гадна дарахад хаагдана; давхарга сэлгэхэд ХААГДАХГҮЙ — хэд хэдийг
   дараалуулан асаах нь ердийн хэрэглээ.
   -------------------------------------------------------------------------- */

export type MapLayerItem = {
  id: string;
  name: string;
  tone: string;
  on: boolean;
  /** Нэрийн доорх мөр — бүртгэлийн тоо, геометрийн төрөл */
  sub?: string;
  error?: string;
  loading?: boolean;
};

export function MapLayerPicker({
  items,
  onToggle,
}: {
  items: MapLayerItem[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = items.filter((i) => i.on).length;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Давхарга сонгох"
        title={`Давхарга: ${num(shown)} / ${num(items.length)}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex size-7 items-center justify-center transition-colors",
          open ? "text-data" : "text-ink-2 hover:text-ink",
        )}
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
      >
        <Layers3 size={16} strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="elevated absolute top-[calc(100%+5px)] right-0 w-[264px] overflow-hidden rounded-xs border border-line-2 bg-paper-2">
          <div className="eyebrow border-b border-line px-2.5 py-2">Давхарга</div>
          <div className="max-h-[min(420px,60vh)] divide-y divide-line overflow-y-auto">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={it.on}
                onClick={() => onToggle(it.id)}
                className={cn(
                  "flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors hover:bg-paper-hi",
                  it.on && "bg-paper-hi",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-[2px] flex size-3 shrink-0 items-center justify-center rounded-[2px] border transition-colors",
                    it.on ? "border-transparent text-paper" : "border-line-2",
                  )}
                  style={it.on ? { background: it.tone } : undefined}
                >
                  {it.on ? <Check size={9} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[12px] leading-snug", it.on ? "text-ink" : "text-ink-2")}>
                    {it.name}
                  </span>
                  {it.error ? (
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-clay">{it.error}</span>
                  ) : it.sub ? (
                    <span className="num mt-0.5 block truncate text-[10.5px] leading-none text-ink-3">{it.sub}</span>
                  ) : null}
                </span>
                {it.loading ? <Loader2 size={12} className="mt-[2px] shrink-0 animate-spin text-ink-3" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
