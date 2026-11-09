"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { flushBeacon, logEvent } from "@/lib/audit";
import { useAuth } from "@/components/auth/provider";

/*
  Хуудас үзэлтийн лог ({@link src/lib/audit.ts}) — нэвтэрсэн хэрэглэгчийн зам
  солигдох бүрд `view`; хуудас хаагдах, нуугдахад дараалалд үлдсэн бичилтийг
  `sendBeacon`-оор илгээнэ. Нэвтрэлт, гаралт нь `callback` хуудас, `AuthProvider`-т.
  Урьдчилсан харагдацын iframe (`data-department-preview`) лог бичихгүй —
  нүүрний найман карт найман "үзэлт" болох байв.
*/
export function AuditTracker() {
  const path = usePathname();
  const { state } = useAuth();
  /* Нэг зам 2 с-ийн дотор давхар бичигдэхгүй — хөгжүүлэлтийн StrictMode эффектийг хоёр удаа ажиллуулдаг */
  const last = React.useRef<{ path: string; at: number } | null>(null);

  React.useEffect(() => {
    if (state !== "in" || path.startsWith("/auth/")) return;
    if (document.documentElement.dataset.departmentPreview === "true") return;
    const now = Date.now();
    if (last.current && last.current.path === path && now - last.current.at < 2000) return;
    last.current = { path, at: now };
    logEvent({ kind: "view", path });
  }, [path, state]);

  React.useEffect(() => {
    const bye = () => flushBeacon();
    const hide = () => document.visibilityState === "hidden" && flushBeacon();
    window.addEventListener("pagehide", bye);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pagehide", bye);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  return null;
}
