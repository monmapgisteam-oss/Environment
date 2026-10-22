import { ScopeGate } from "@/components/auth/access";
import { ANALYSIS } from "@/lib/access";

/* Дүн шинжилгээний эрх (`lib/access.ts`, супер админы тохиргоо) */
export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return <ScopeGate scope={ANALYSIS}>{children}</ScopeGate>;
}
