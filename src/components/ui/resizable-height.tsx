"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/*
  ДЭЭД ИРМЭГЭЭСЭЭ ЧИРЖ ӨНДӨР НЬ СОЛИГДОХ ХҮРЭЭ — самбарын ДООД мөрөнд
  бүтэн өргөнөөр суух карт (хэрэглэгч 2026-10-15, ашигт малтмалын
  тусгай зөвшөөрөлтэй талбай: "Зөвшөөрлийн хугацаа cardiig resizetai bolgo").

  {@link src/components/ui/resizable-columns.tsx}-тэй нэг зарчим:
  · өндөр нь React төлөв БИШ — чирэх бүрд самбар (газрын зураг) дахин
    зурагдах ёсгүй тул DOM руу шууд бичнэ;
  · `localStorage.height.<id>`-д хадгалагдана, давхар товшилт анхны
    (агуулгын) өндөрт буцаана;
  · дээд талд дор хаяж 240px үлдэнэ — газрын зураг алга болохгүй.
  ⚠ АГУУЛГА ХҮРЭЭГЭЭ ДАГАЖ АГШИНА/ТЭЛНЭ (хэрэглэгч мөн өдөр: "cardiin
  undriig bagasgahad dotorh elementuud hamt undur ni bagasna") — гүйлгүүр
  гаргахгүй, мөрүүд доош "алга болохгүй". Дуудагч тал хүүхдээ
  `min-h-0 flex-1`, мөр бүрийг `min-h-0 flex-1` (басис 0% — өндөр тавиагүй үед агуулгаараа) болгоно.
  Агуулгаас ӨНДӨР болговол мөрүүд жигд тарна.
*/

const KEEP = 240;

export function ResizableHeight({
  id,
  min = 80,
  className,
  children,
}: {
  /** Хадгалалтын түлхүүр — самбар бүрд ӨӨР */
  id: string;
  min?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const key = `height.${id}`;

  React.useLayoutEffect(() => {
    let v = 0;
    try {
      v = Number(localStorage.getItem(key)) || 0;
    } catch {}
    if (v && box.current) box.current.style.height = `${v}px`;
  }, [key]);

  const limit = (el: HTMLElement) => Math.max(min, (el.parentElement?.clientHeight ?? 2000) - KEEP);

  function onDown(e: React.PointerEvent) {
    const el = box.current;
    if (!el || e.button !== 0) return;
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = el.getBoundingClientRect().height;
    const max = limit(el);
    const move = (ev: PointerEvent) => {
      el.style.height = `${Math.round(Math.max(min, Math.min(max, h0 + y0 - ev.clientY)))}px`;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      try {
        localStorage.setItem(key, String(Math.round(el.getBoundingClientRect().height)));
      } catch {}
    };
    document.body.style.cursor = "row-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function reset() {
    if (box.current) box.current.style.height = "";
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  return (
    <div ref={box} className={cn("relative flex min-h-0 shrink-0 flex-col", className)}>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Өндрийг өөрчлөх"
        onPointerDown={onDown}
        onDoubleClick={reset}
        className="group absolute inset-x-0 -top-[7px] z-10 flex h-[12px] cursor-row-resize items-center justify-center"
      >
        <span className="h-[3px] w-12 rounded-full bg-line-2 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {children}
    </div>
  );
}
