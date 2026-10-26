"use client";

import * as React from "react";

/*
  ИНТЕРФЕЙСИЙН ХЭЛ — монгол (анхдагч) ба англи (хэрэглэгч 2026-10-23:
  "light dark горимын ард англи болон монгол хэл рүү солигддог горим").

  Төлөв нь үндэс элемент дээрх `lang` шинжид — өнгөний горимтой (`data-theme`)
  ижил зарчим: `layout.tsx`-ийн boot скрипт эхний зурагдалтаас ӨМНӨ
  `localStorage["workspace-lang"]`-ээс сэргээнэ.

  ⚠ Хамрах хүрээ нь БҮРХҮҮЛ: толгой, хажуугийн зурвас, утасны цэс, Ctrl K
  хайлт, нүүр хуудас, хэлтсийн нэр. Хэлтсийн самбарын агуулга, порталын
  дата (талбарын нэр, утга) монголоороо үлдэнэ — эх сурвалж монгол.
  ⚠ Хэлтсийн англи нэр нь `departments.ts`-д БИШ энд: тэр бүртгэлд зөвхөн
  хэлтсээс ирсэн бодит мэдээлэл сууна.
*/

export type Lang = "mn" | "en";

const KEY = "workspace-lang";
const listeners = new Set<() => void>();

function read(): Lang {
  return document.documentElement.lang === "en" ? "en" : "mn";
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setLang(lang: Lang) {
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  listeners.forEach((l) => l());
}

/** Одоогийн хэл. Сервер (статик HTML) дээр үргэлж монгол. */
export function useLang(): Lang {
  return React.useSyncExternalStore(subscribe, read, () => "mn");
}

/** `t("Монгол", "English")` — одоогийн хэлний хувилбарыг буцаана */
export function useT() {
  const lang = useLang();
  return React.useCallback((mn: string, en: string) => (lang === "en" ? en : mn), [lang]);
}

/** Хэлтсийн албан нэрийн англи орчуулга */
export const DEPT_EN: Record<string, string> = {
  zahirgaa: "Administration and Management Division",
  "sanhuu-monitoring": "Finance, Economics and Monitoring Division",
  orchin: "Environmental Use and Protection Division",
  oi: "Forest Division",
  "amitan-urgamal": "Fauna and Flora Protection Division",
  "nogoon-bus": "Green Belt Use and Protection Division",
  "unelgee-uur-amisgal": "Environmental Assessment and Climate Change Division",
  hyanalt: "Inspection Division",
};

/** Хажуугийн зурвасын (104px) богино нэр */
export const SHORT_EN: Record<string, string> = {
  zahirgaa: "Admin",
  "sanhuu-monitoring": "Finance",
  orchin: "Environment",
  oi: "Forest",
  "amitan-urgamal": "Wildlife",
  "nogoon-bus": "Green belt",
  "unelgee-uur-amisgal": "Assessment",
  hyanalt: "Inspection",
};

/** Хэлтсийн нэр одоогийн хэлээр */
export function useDeptName() {
  const lang = useLang();
  return React.useCallback(
    (d: { slug: string; name: string }) => (lang === "en" ? (DEPT_EN[d.slug] ?? d.name) : d.name),
    [lang],
  );
}
