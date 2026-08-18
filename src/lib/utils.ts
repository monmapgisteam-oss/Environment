import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const mnNum = new Intl.NumberFormat("mn-MN");

export function num(value: number, digits = 0) {
  return mnNum.format(Number(value.toFixed(digits)));
}

export function pct(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

const MONTHS = [
  "1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар",
  "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар",
];

export function monthLabel(index: number) {
  return MONTHS[index % 12];
}

export function dateLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Одоогийн зам заасан хаягтай тохирч байна уу.
 *
 * ЭНГИЙН `===` БОЛОХГҮЙ: `next.config.ts` дотор `trailingSlash: true`
 * тавьсан тул `usePathname()` нь `/departments/orchin/` гэж ТӨГСГӨЛИЙН
 * ЗУРААСТАЙ буцаана. Хажуугийн зурвасын холбоосууд зураасгүй бичигдсэн
 * тул тэнцэл хэзээ ч биелэхгүй — улмаас "аль хэлтэс сонгогдсон" нь
 * хаана ч тэмдэглэгдэхгүй байв.
 *
 * `nested` нь дэд хуудсыг ч идэвхтэйд тооцно (жишээ нь `/sources/…`).
 */
export function isActivePath(pathname: string, href: string, nested = false) {
  const strip = (s: string) => (s.length > 1 ? s.replace(/\/+$/, "") : s);
  const a = strip(pathname);
  const b = strip(href);
  return nested ? a === b || a.startsWith(`${b}/`) : a === b;
}
