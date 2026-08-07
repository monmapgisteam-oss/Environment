"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/* --------------------------------------------------------------------------
   Хажуугийн зурвасыг хураах, дэлгэх.

   Төлөв нь үндэс элемент дээрх `data-rail` шинжид байна — горимын товчтой
   ижил зарчим. Аль товч харагдахыг CSS шийднэ (globals.css → `.rail-only`,
   `.rail-off-only`) тул React state дамжуулах, SSR-тэй зөрөх асуудал алга.

   Товч нь ХОЁР ТУСДАА байрлалд байна:
     · хураах — зурвасын дотор, "Хэлтэс" гарчгийн мөрөнд;
     · дэлгэх — толгойд, зөвхөн зурвас хураагдсан үед.
   Хоёуланг нь зурвас дотор тавьж болохгүй: хураасны дараа зурвас өөрөө
   алга болдог тул буцааж нээх арга үлдэхгүй.
   -------------------------------------------------------------------------- */

function setRail(off: boolean) {
  const root = document.documentElement;
  if (off) root.setAttribute("data-rail", "off");
  else root.removeAttribute("data-rail");
  try {
    localStorage.setItem("rail", off ? "off" : "on");
  } catch {}
}

/**
 * Зурвас дотор — хураах.
 *
 * `-my-1` нь гарчгийн мөрний өндрийг сунгахаас сэргийлнэ: 24px бие нь 10px
 * eyebrow-той мөрөнд багтаж, дээд доод зайг нь идэхгүй.
 */
export function RailClose() {
  return (
    <button
      type="button"
      onClick={() => setRail(true)}
      aria-label="Хажуугийн зурвасыг хураах"
      title="Хажуугийн зурвасыг хураах"
      className="-my-1 flex size-6 shrink-0 items-center justify-center rounded-[2px] border border-line-2 bg-paper-2 text-ink-2 transition-colors hover:border-ink-3 hover:bg-paper-hi hover:text-ink"
    >
      <PanelLeftClose size={14} strokeWidth={1.75} />
    </button>
  );
}

/** Толгойд — зөвхөн хураасан үед харагдаж, зурвасыг буцааж дэлгэнэ */
export function RailOpen() {
  return (
    <button
      type="button"
      onClick={() => setRail(false)}
      aria-label="Хажуугийн зурвасыг дэлгэх"
      title="Хажуугийн зурвасыг дэлгэх"
      className="rail-off-only hidden size-8 shrink-0 items-center justify-center rounded-xs border border-line bg-paper-2 text-ink-2 transition-colors hover:border-line-2 hover:text-ink lg:flex"
    >
      <PanelLeftOpen size={14} strokeWidth={1.75} />
    </button>
  );
}
