"use client";

import { DEPT_EN, useLang } from "@/lib/i18n";

/** Серверийн хуудсанд (нүүр г.м.) хоёр хэлний бичвэр — одоогийнхыг нь зурна */
export function T({ mn, en }: { mn: string; en: string }) {
  return <>{useLang() === "en" ? en : mn}</>;
}

/** Хэлтсийн нэр одоогийн хэлээр */
export function DeptName({ slug, name }: { slug: string; name: string }) {
  return <>{useLang() === "en" ? (DEPT_EN[slug] ?? name) : name}</>;
}
