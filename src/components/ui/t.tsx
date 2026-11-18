"use client";

import { useLang } from "@/lib/i18n";

/** Серверийн хуудсанд (нүүр г.м.) хоёр хэлний бичвэр — одоогийнхыг нь зурна */
export function T({ mn, en }: { mn: string; en: string }) {
  return <>{useLang() === "en" ? en : mn}</>;
}
