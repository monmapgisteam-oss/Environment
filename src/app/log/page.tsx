import { LogDirectory } from "@/components/log/log-directory";

/*
  ЛОГ БҮРТГЭЛ (хэрэглэгч 2026-11-09: "лог бүртгэл товч эрх товчны доор") —
  зөвхөн `portaladmin`. Эх нь порталын `Environment_Log` хүснэгт
  ({@link src/lib/audit.ts}). Нэр нь `PAGE_NAMES`-тэй ЯГ таарна.
*/
export const metadata = { title: "ЛОГ БҮРТГЭЛ" };

export default function LogPage() {
  return <LogDirectory />;
}
