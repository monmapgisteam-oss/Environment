import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata = { title: "Тайлан" };

export default function ReportsPage() {
  return (
    <ComingSoon
      eyebrow="Шинжилгээ"
      title="Тайлан"
      description="Хэлтэс тус бүрийн болон нэгдсэн тайланг үе шаттайгаар үүсгэх, батлах, экспортлох модуль."
      items={[
        "Улирлын нэгдсэн тайлан",
        "Хэлтсийн гүйцэтгэлийн тайлан",
        "Хүлэмжийн хийн тооллого",
        "Хяналт шалгалтын дүн",
        "Excel / PDF экспорт",
        "Тайлангийн баталгаажуулалтын урсгал",
      ]}
    />
  );
}
