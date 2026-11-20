import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Зураг дээрх хэрэгслийн товчны НЭГ БАГАНА — суурь зургийн товчны (Esri,
 * баруун дээд, 28px) ЯГ ДООР, 8px завсартай (хэрэглэгч 2026-11-17: бүх
 * хэлтсийн зураг дээрх товчнууд нэг шугамд). Товч бүр `.map-tool` (28px).
 * Олон хэрэгсэлтэй самбарт тус бүр өөрийн `absolute` байрлал бариад
 * давхцаж, хажуу тийш тарж байсныг энэ сав нэгтгэнэ.
 */
export function MapToolStack({
  children,
  left = false,
  className,
}: {
  children: React.ReactNode;
  /** Суурь зураг нь зүүн дээд буланд суудаг самбарт */
  left?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute top-[46px] z-20 flex flex-col gap-2",
        !left && "map-rail-shift",
        left ? "left-2.5 items-start" : "right-2.5 items-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
