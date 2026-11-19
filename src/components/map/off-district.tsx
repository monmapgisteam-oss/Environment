"use client";

import * as React from "react";
import { MapPinOff } from "lucide-react";
import { fetchUbDistricts } from "@/lib/ub-districts";

/*
  БҮРТГЭСЭН ДҮҮРГЭЭС ӨӨР ДҮҮРЭГТ БУУСАН ЦЭГИЙН ТЭМДЭГ — бүх самбарт нэг хэв
  (хэрэглэгч 2026-11-19: "Химийн бодисын агуулах hiisen shig pointiig tusagi temdegt
  bolgo"). Тооцоо нь {@link ../../lib/district-check}, загвар нь `globals.css`-ийн
  `[data-pin="mismatch"]` (`--water`; `data-also="expired"` бол хүрээ `--ochre`).
*/

/** Дүүргийн хил — нэг удаа татагдаж кэшлэгдэнэ. Унавал `null` (тэмдэг гарахгүй, самбар хэвээр) */
export function useUbDistricts(): GeoJSON.FeatureCollection | null {
  const [fc, setFc] = React.useState<GeoJSON.FeatureCollection | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetchUbDistricts()
      .then((d) => alive && setFc(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return fc;
}

/** Зураг дээрх DOM тэмдэглэгээ (`WellsMap`-ийн `marks`) — lucide `map-pin-off` */
export const mismatchPin = (expired = false) =>
  `<svg data-pin="mismatch"${expired ? ' data-also="expired"' : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  'stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12.75 7.09a3 3 0 0 1 2.16 2.16"/>' +
  '<path d="M17.072 17.072c-1.634 2.17-3.527 3.912-4.471 4.727a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 1.432-4.568"/>' +
  '<path d="m2 2 20 20"/><path d="M8.475 2.818A8 8 0 0 1 20 10c0 1.183-.31 2.377-.81 3.533"/>' +
  '<path d="M9.13 9.13a3 3 0 0 0 3.74 3.74"/></svg>';

/** Зургийн тайлбарын мөр — тийм цэг харагдаж байвал л дуудна */
export function OffDistrictLegend({ className }: { className?: string }) {
  return (
    <div className={className ?? "mt-1 flex items-center gap-1.5"}>
      <MapPinOff size={10} className="shrink-0 text-water" />
      <span className="text-[10.5px] text-ink">Байршил нь бүртгэсэн дүүргээс өөр дүүрэгт байгаа</span>
    </div>
  );
}
