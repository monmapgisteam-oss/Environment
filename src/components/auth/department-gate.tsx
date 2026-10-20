"use client";

import { usePathname } from "next/navigation";
import { ScopeGate } from "@/components/auth/access";

/* Хэлтсийн хуудас — эрхгүй хэлтсийн агуулга ЗУРАГДАХГҮЙ (татац ч явахгүй) */
export function DepartmentGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const slug = path.split("/departments/")[1]?.split("/")[0] ?? "";
  return slug ? <ScopeGate scope={slug}>{children}</ScopeGate> : <>{children}</>;
}
