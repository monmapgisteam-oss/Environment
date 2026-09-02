"use client";

import * as React from "react";
import { GripHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   ГАЗРЫН ЗУРАГ ДЭЭР ХӨВӨХ БИЧЛЭГИЙН САМБАР

   Товшсон обьектын бүх талбарыг задалж харуулах самбар. Платформын бүх
   зураг дээр НЭГ ижил байна: толгойгоороо чирж зөөгдөж, булангаасаа
   хэмжээ нь солигдоно.

   ЯАГААД ЧИРЭГДЭХ ЁСТОЙ ВЭ: самбар нь зургийн буланд суудаг тул доор нь
   яг тэр цэг орвол хаагдана. Хэрэглэгч самбараа хааж, ойртож, дахин
   нээх ёсгүй — зүгээр л хажуу тийш нь чирнэ.

   ЯАГААД ХЭМЖЭЭ СОЛИГДОХ ЁСТОЙ ВЭ: бичлэгүүд өөр өөр урттай. Химийн
   агуулахын нэг бичлэгт 143 мөр бодис, өөр нэгэнд ердөө нэг байна.

   БАЙРЛАЛ, ХЭМЖЭЭГ REACT ТӨЛӨВӨӨР БҮҮ БАРЬ: хулгана хөдлөх бүрд эцэг
   самбар бүхэлдээ дахин зурагдана (зарим нь 12 мянган цэг, 967 мөрийн
   товьёогтой). Утгыг ШУУД DOM руу бичиж, төлөвт юу ч барихгүй —
   {@link ./hover-tip}-тэй ижил зарчим.

   Утга нь `useLayoutEffect`-ээр зурагдалт бүрд дахин тавигдана: React
   өөрийн удирддаггүй inline шинжийг арилгадаггүй ч сонгосон бичлэг
   солигдоход самбар шинэчлэгддэг тул баталгаажуулах нь хямд.
   -------------------------------------------------------------------------- */

const PAD = 6;
const MIN_W = 220;
const MIN_H = 140;

/**
 * Хэмжээ солих бариул аль буланд суух вэ.
 *
 * Самбар нь тухайн ирмэгтээ бэхлэгддэг тул ЭСРЭГ талруугаа тэлнэ:
 * баруун талд бэхлэгдсэн самбар зүүн тийш өргөсдөг учир бариул нь
 * зүүн доод буланд байх ёстой. Бэхлэгдсэн талдаа тавьбал бариул өөрөө
 * хөдөлгөөнгүй үлдэж, самбар нь эсрэг талаараа сунана.
 */
export type GripSide = "left" | "right";

/**
 * Чирэлтийн горим.
 *
 * Хэмжээ солих нь ГУРВАН хэлбэртэй: булангаас хоёр тэнхлэгээр, доод
 * ирмэгээс өндөр, хажуу ирмэгээс өргөн. Зөвхөн булан байхад хэрэглэгч
 * 16 пикселийн тэмдэг рүү оносон байх шаардлагатай болдог — цонх
 * ирмэгээсээ чирэгддэг гэсэн ердийн хүлээлттэй зөрчилдөнө.
 */
type Mode = "move" | "resize" | "resize-x" | "resize-y";

type Grab = {
  mode: Mode;
  px: number;
  py: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
};

export function useMapPanel(grip: GripSide = "left") {
  const el = React.useRef<HTMLDivElement | null>(null);
  const off = React.useRef({ x: 0, y: 0 });
  /** Хэрэглэгч хэмжээг нь хөндөх хүртэл `null` — CSS-ийн анхдагч үйлчилнэ */
  const size = React.useRef<{ w: number; h: number } | null>(null);
  const from = React.useRef<Grab | null>(null);

  const apply = React.useCallback(() => {
    const node = el.current;
    if (!node) return;
    const frame = node.offsetParent as HTMLElement | null;

    if (size.current && frame) {
      const maxW = Math.max(MIN_W, frame.clientWidth - 2 * PAD);
      const maxH = Math.max(MIN_H, frame.clientHeight - 2 * PAD);
      size.current.w = Math.min(Math.max(size.current.w, MIN_W), maxW);
      size.current.h = Math.min(Math.max(size.current.h, MIN_H), maxH);
    }
    if (size.current) {
      node.style.width = `${Math.round(size.current.w)}px`;
      /*
        Өндөр тавьмагц CSS-ийн `bottom`, `max-height` нь хэт тодорхойлолт
        болж үл тоомсорлогдоно (top + height давамгайлна).
      */
      node.style.height = `${Math.round(size.current.h)}px`;
      node.style.maxHeight = "none";
    }

    if (frame) {
      /*
        `offsetLeft/Top` нь шилжилтээс ӨМНӨХ байрлал. Түүн дээр нэмэхэд
        самбар хүрээнээсээ хальж болзошгүй тул хоёр тэнхлэгээр нь
        хязгаарлана — хальсан самбар буцаад олдохгүй.
      */
      const maxX = frame.clientWidth - node.offsetLeft - node.offsetWidth - PAD;
      const minX = PAD - node.offsetLeft;
      const maxY = frame.clientHeight - node.offsetTop - node.offsetHeight - PAD;
      const minY = PAD - node.offsetTop;
      off.current.x = Math.max(Math.min(minX, maxX), Math.min(off.current.x, maxX));
      off.current.y = Math.max(Math.min(minY, maxY), Math.min(off.current.y, maxY));
    }
    node.style.transform = `translate3d(${Math.round(off.current.x)}px, ${Math.round(
      off.current.y,
    )}px, 0)`;
  }, []);

  /*
    `ref`-ийг буцаахгүй — дуудагч тал `ref={obj.prop}` гэж бичих
    боломжгүй (`react-hooks/refs`), тиймээс бүрэлдэхүүн өөрөө `useRef`
    эзэмшиж, энэ дуудлагаар бүртгүүлнэ.
  */
  const mount = React.useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      if (node) apply();
    },
    [apply],
  );

  /* Цонх, хажуугийн зурвас өөрчлөгдөхөд дахин багтаана */
  React.useEffect(() => {
    const on = () => apply();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [apply]);

  const handlers = React.useCallback(
    (mode: Mode) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        /* Толгой дээрх товч (хаах) чирэлт эхлүүлэх ёсгүй */
        if (mode === "move" && (e.target as HTMLElement).closest("button")) return;
        const node = el.current;
        if (!node) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        from.current = {
          mode,
          px: e.clientX,
          py: e.clientY,
          ox: off.current.x,
          oy: off.current.y,
          w: node.offsetWidth,
          h: node.offsetHeight,
        };
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const f = from.current;
        if (!f) return;
        const dx = e.clientX - f.px;
        const dy = e.clientY - f.py;
        if (f.mode === "move") {
          off.current.x = f.ox + dx;
          off.current.y = f.oy + dy;
        } else {
          /* Зүүн ирмэгийг зүүн тийш чирэхэд өргөн НЭМЭГДЭНЭ; баруун
             ирмэгт эсрэгээрээ. Тэнхлэг тус бүр өөрийн горимтой тул
             ирмэгээс чирэхэд нөгөө хэмжээ хөдлөхгүй. */
          const w =
            f.mode === "resize-y" ? f.w : grip === "left" ? f.w - dx : f.w + dx;
          const h = f.mode === "resize-x" ? f.h : f.h + dy;
          size.current = { w, h };
        }
        apply();
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        from.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      },
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
        from.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      },
    }),
    [apply, grip],
  );

  return { mount, handlers, grip };
}

export type MapPanelState = ReturnType<typeof useMapPanel>;

/**
 * Хөвөгч бичлэгийн самбар.
 *
 * `className`-д ЗӨВХӨН байрлал, өргөнийг өг (`right-2.5 bottom-8
 * w-[262px]`) — хүрээ, дэвсгэр, толгой, бариул бүгд дотроо.
 */
export function MapPanel({
  state,
  title,
  onClose,
  action,
  className,
  children,
}: {
  state: MapPanelState;
  title: React.ReactNode;
  onClose: () => void;
  /** Толгойн баруун талд, хаах товчны өмнө */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const el = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    state.mount(el.current);
    return () => state.mount(null);
  });

  return (
    <div
      ref={el}
      className={cn(
        "absolute z-10 flex flex-col overflow-hidden rounded-xs border border-line bg-paper/95 backdrop-blur-md will-change-transform",
        className,
      )}
    >
      {/*
        Толгой нь зөөх бариул. `touch-none` — хуруугаар чирэхэд хөтөч
        хуудсаа гүйлгэхийг оролдвол самбар мултарна.
      */}
      <div
        {...state.handlers("move")}
        className="flex shrink-0 touch-none cursor-grab items-center justify-between gap-2 border-b border-line px-2.5 py-1.5 select-none active:cursor-grabbing"
      >
        <GripHorizontal size={12} className="shrink-0 text-ink-3" />
        <span className="eyebrow min-w-0 flex-1 truncate">{title}</span>
        {action}
        <button
          onClick={onClose}
          className="shrink-0 text-ink-3 transition-colors hover:text-ink"
          aria-label="Хаах"
        >
          <X size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">{children}</div>

      {/*
        ХЭМЖЭЭ СОЛИХ. Цонх ирмэгээсээ чирэгддэг гэсэн ердийн хүлээлтийг
        дагана: доод ирмэгээс өндөр, тэлэх талын ирмэгээс өргөн,
        буланаас хоёулаа. Урьд нь зөвхөн буланд 16px тэмдэг байсныг
        оноход хэцүү байв.

        Ирмэгийн зурвасууд нь ХАРАГДАХГҮЙ — заагчийн хэлбэр (`cursor`)
        нь хаана юу болохыг хэлнэ. Самбарын гадаргууг зураасаар
        дүүргэвэл агуулга нь дарагдана.
      */}

      {/* Доод ирмэг — өндөр. Булангуудыг чөлөөтэй үлдээнэ */}
      <span
        {...state.handlers("resize-y")}
        aria-hidden
        className="absolute inset-x-5 bottom-0 z-10 h-[6px] cursor-ns-resize touch-none"
      />

      {/*
        Тэлэх талын ирмэг — өргөн. ЗӨВХӨН зүүн тийш тэлдэг самбарт:
        баруун тийш тэлдэг самбарын тэр ирмэг дээр гүйлгэх зурвас
        сууж байдаг тул зурвасыг халхлах болно.
      */}
      {state.grip === "left" ? (
        <span
          {...state.handlers("resize-x")}
          aria-hidden
          className="absolute top-9 bottom-5 left-0 z-10 w-[6px] cursor-ew-resize touch-none"
        />
      ) : null}

      {/* Булан — хоёр тэнхлэг зэрэг. Онох талбар 20px, тэмдэг нь жижиг */}
      <button
        {...state.handlers("resize")}
        aria-label="Самбарын хэмжээ солих"
        className={cn(
          "absolute bottom-0 z-10 flex size-5 touch-none items-end p-1 text-ink-3 transition-colors hover:text-ink",
          state.grip === "left"
            ? "left-0 cursor-nesw-resize justify-start"
            : "right-0 cursor-nwse-resize justify-end",
        )}
      >
        <svg viewBox="0 0 10 10" className="size-3" aria-hidden>
          <path
            d={state.grip === "left" ? "M9 1 1 9M5.5 9H1V4.5" : "M1 1l8 8M4.5 9H9V4.5"}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
