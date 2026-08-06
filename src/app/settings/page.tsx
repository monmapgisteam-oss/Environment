import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata = { title: "Тохиргоо" };

export default function SettingsPage() {
  return (
    <ComingSoon
      eyebrow="Систем"
      title="Тохиргоо"
      description="Хэрэглэгч, эрхийн түвшин, лавлах мэдээлэл, интеграцийн тохиргоо."
      items={[
        "Хэрэглэгч, үүрэг (RBAC)",
        "Хэлтсийн бүтэц",
        "Лавлах жагсаалтууд",
        "Аудит лог",
        "Интеграц, API түлхүүр",
        "Мэдэгдлийн тохиргоо",
      ]}
    />
  );
}
