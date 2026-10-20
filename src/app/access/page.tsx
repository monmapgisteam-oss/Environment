import { AccessDirectory } from "@/components/access/access-directory";

/*
  ЭРХИЙН ЗОХИЦУУЛАЛТ (хэрэглэгч 2026-10-16: "эх сурвалжийн доор нэмье").
  Бүртгэлүүд `lib/access.ts`-д; харах эрхийг хэрэглэгч өгөх хүртэл
  ТААМАГЛАЖ бичихгүй.
*/
export const metadata = { title: "ЭРХИЙН ЗОХИЦУУЛАЛТ" };

export default function AccessPage() {
  return <AccessDirectory />;
}
