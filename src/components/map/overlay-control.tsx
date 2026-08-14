"use client";

import * as React from "react";
import { Layers3, Loader2 } from "lucide-react";
import type { MapOverlay } from "@/components/wells/map";
import { fetchOverlay, OVERLAYS, type OverlayId } from "@/lib/overlays";
import { cn } from "@/lib/utils";

/**
 * Газрын зургийн нэмэлт давхаргын унтраалга.
 *
 * Давхарга бүр асаах хүртэл ТАТАГДАХГҮЙ — гурвуулаа нийлбэл хэдэн MB.
 * Татаж байх хугацаанд мөр нь эргэлдэх тэмдэг харуулна; амжилтгүй болбол
 * мөр улаан болж, дахин оролдох боломжтой үлдэнэ.
 */
export function OverlayControl({
  value,
  onChange,
}: {
  value: MapOverlay[];
  onChange: (v: MapOverlay[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<OverlayId | null>(null);
  const [failed, setFailed] = React.useState<OverlayId | null>(null);
  const holder = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const on = new Set(value.map((o) => o.id));

  async function toggle(id: OverlayId) {
    if (on.has(id)) {
      onChange(value.filter((o) => o.id !== id));
      return;
    }
    const def = OVERLAYS.find((d) => d.id === id);
    if (!def) return;

    setBusy(id);
    setFailed(null);
    try {
      const data = await fetchOverlay(def);
      /*
        Дараалал ЧУХАЛ: `OVERLAYS`-ийн дарааллаар байрлуулна. Дүүргийн
        зузаан зураас хорооны нимгэн зураасны дээр байх ёстой — эсрэгээр
        нь бол хилийн шатлал уншигдахаа болино.
      */
      const next = [...value, { id, data, fill: def.fill, line: def.line }];
      next.sort(
        (a, b) =>
          OVERLAYS.findIndex((d) => d.id === a.id) -
          OVERLAYS.findIndex((d) => d.id === b.id),
      );
      onChange(next);
    } catch {
      setFailed(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={holder} className="absolute top-2.5 right-11 z-20">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Нэмэлт давхарга"
        aria-label="Нэмэлт давхарга"
        className={cn(
          "relative flex size-7 items-center justify-center transition-colors",
          open || on.size ? "text-data" : "text-ink-2 hover:text-ink",
        )}
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
      >
        <Layers3 size={16} strokeWidth={1.75} />
        {on.size ? (
          <span className="num absolute -top-0.5 -right-1 rounded-full bg-data px-1 text-[9px] leading-[1.4] font-medium text-paper">
            {on.size}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="elevated absolute top-[calc(100%+5px)] right-0 w-[220px] rounded-xs border border-line-2 bg-paper-2 p-2">
          <div className="eyebrow mb-2">Нэмэлт давхарга</div>
          <div className="space-y-1">
            {OVERLAYS.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-start gap-2 rounded-xs px-1 py-1 transition-colors hover:bg-paper-hi"
              >
                <input
                  type="checkbox"
                  checked={on.has(d.id)}
                  disabled={busy === d.id}
                  onChange={() => toggle(d.id)}
                  className="mt-[3px] size-3 shrink-0 accent-[var(--data)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[11.5px] leading-none font-medium text-ink">
                    {d.label}
                    {busy === d.id ? (
                      <Loader2 size={10} className="animate-spin text-ink-3" />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-[10.5px] leading-snug",
                      failed === d.id ? "text-clay" : "text-ink-3",
                    )}
                  >
                    {failed === d.id ? "Татагдсангүй — дахин оролдоно уу" : d.note}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
