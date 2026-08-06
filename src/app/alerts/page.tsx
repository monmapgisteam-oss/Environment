import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata = { title: "Дохиолол" };

export default function AlertsPage() {
  return (
    <ComingSoon
      eyebrow="Шуурхай удирдлага"
      title="Дохиолол"
      description="Босго давсан үзүүлэлт, зөрчил, хугацаа хэтрэлтийг автоматаар илрүүлж, хариуцах эзэнд чиглүүлэх систем."
      items={[
        "Босго тохиргоо (агаар, ус, түймэр)",
        "Дохиоллын хуваарилалт",
        "Мэдэгдлийн суваг (и-мэйл, SMS)",
        "Эскалацийн дүрэм",
        "Хариу арга хэмжээний бүртгэл",
        "Түүх, статистик",
      ]}
    />
  );
}
