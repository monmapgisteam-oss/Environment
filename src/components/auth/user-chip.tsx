"use client";

import * as React from "react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/components/auth/provider";

/* --------------------------------------------------------------------------
   НЭВТЭРСЭН ХЭРЭГЛЭГЧ — толгойн баруун буланд

   Хоёр зүйлийг л хэлнэ: ХЭН нэвтэрсэн, яаж ГАРАХ. Профайл засах, тохиргоо
   зэрэг нь порталын өөрийнх нь ажил — энд давхардуулахгүй.

   Зураг нь порталаас токентой хаягаар ирдэг тул `next/image`-аар БИШ,
   энгийн `<img>`-ээр татна: статик экспортын зураг боловсруулалт гадаад
   хостын хамгаалагдсан хаягийг дэмждэггүй.
   -------------------------------------------------------------------------- */

export function UserChip() {
  const { session, leave } = useAuth();
  const [open, setOpen] = React.useState(false);
  const box = React.useRef<HTMLDivElement>(null);

  /* Гадуур товшиход хаагдана — цэс нээлттэй үлдвэл газрын зураг дээр
     суугаад товшилтыг залгина */
  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!session) return null;

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={session.fullName}
        className="flex h-10 items-center gap-2 rounded-full border border-line bg-paper-2 pr-3 pl-1.5 text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
      >
        {session.avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={session.avatar}
            alt=""
            className="size-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper-3">
            <User size={11} strokeWidth={1.75} />
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-xs leading-none lg:block">
          {session.fullName}
        </span>
      </button>

      {open ? (
        <div className="elevated absolute top-[calc(100%+6px)] right-0 z-50 w-[212px] overflow-hidden rounded-xs border border-line bg-paper-2">
          <div className="border-b border-line px-3 py-2.5">
            <div className="truncate text-[12px] leading-snug font-medium text-ink">
              {session.fullName}
            </div>
            <div className="num mt-0.5 truncate text-[10.5px] text-ink-3">
              {session.username}
            </div>
          </div>

          <button
            onClick={leave}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[11.5px] text-ink-2 transition-colors hover:bg-paper-hi hover:text-ink"
          >
            <LogOut size={12} strokeWidth={1.75} />
            Системээс гарах
          </button>
        </div>
      ) : null}
    </div>
  );
}
