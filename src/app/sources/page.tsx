import { AdminOnly, NoAccess } from "@/components/auth/access";
import { SourceDirectory } from "@/components/home/source-directory";

export const metadata = { title: "Дата эх сурвалж" };

export default function SourcesPage() {
  return (
    <AdminOnly fallback={<NoAccess />}>
      <SourceDirectory />
    </AdminOnly>
  );
}
