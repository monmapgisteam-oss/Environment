import { DepartmentGate } from "@/components/auth/department-gate";

/* Хэлтсийн эрх (`lib/access.ts`) — бүх хэлтсийн хуудсыг хамарна */
export default function DepartmentsLayout({ children }: { children: React.ReactNode }) {
  return <DepartmentGate>{children}</DepartmentGate>;
}
