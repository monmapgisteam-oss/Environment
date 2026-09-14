"use client";

import * as React from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { asset } from "@/lib/base-path";

/* --------------------------------------------------------------------------
   НЭВТРЭХ ДЭЛГЭЦ

   Энэ бол системийн ЦОРЫН ГАНЦ бүтэн дэлгэцийн харагдац: толгой ч,
   хажуугийн зурвас ч байхгүй. Шалтгаан нь энгийн — нэвтрээгүй хэрэглэгчид
   очих газар байхгүй. Цэс харуулаад товшилт бүрийг нь хаах нь хаалгыг
   нээлттэй мэт харуулж, дараа нь татгалзахтай адил.

   ⚠ **ДЭВСГЭР ЗУРАГ НЬ БАЙХГҮЙ Ч АЖИЛЛАНА.** Зураг нь
   `public/auth/background.jpg` дээр сууна. Татагдаагүй тохиолдолд доор нь
   давхарлагдсан градиент харагдах тул дэлгэц хэзээ ч хоосон цагаан
   болохгүй. Зураг солих нь ганц файл солих ажил — код хөндөхгүй.

   ⚠ **БИЧВЭР ЗУРАГ ДЭЭР УНШИГДАХ ЁСТОЙ.** Ямар зураг тавихыг урьдчилан
   мэдэх боломжгүй (цайвар тэнгэр ч, бараан ой ч байж болно) тул бичвэрийг
   зурган дээр ШУУД тавихгүй: хагас тунгалаг хөшиг (`scrim`) ба бүдгэрүүлэг
   дээр сууна. Ингэснээр аль ч зурагтай ажиллана.
   -------------------------------------------------------------------------- */

const BACKGROUND = asset("/auth/background.jpg");

export function SignIn({
  onEnter,
  configured,
}: {
  onEnter: () => void;
  /** Аппын ID тохируулагдсан эсэх */
  configured: boolean;
}) {
  const [busy, setBusy] = React.useState(false);

  const enter = () => {
    setBusy(true);
    onEnter();
  };

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-paper">
      {/* Дэвсгэр: зураг → түүний доор градиент. Зураг ирээгүй ч дэлгэц
          бүтэн харагдана */}
      <div
        aria-hidden
        className="absolute inset-0 bg-paper-3 bg-cover bg-center"
        style={{ backgroundImage: `url("${BACKGROUND}")` }}
      />

      {/* Хөшиг — бичвэрийн уншигдацыг зурагнаас ҮЛ ХАМААРУУЛНА */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-paper via-paper/85 to-paper/35 lg:to-transparent"
      />
      <div aria-hidden className="absolute inset-0 bg-paper/25 lg:bg-transparent" />

      <div className="relative flex min-h-dvh items-center px-5 py-10 lg:px-12">
        <div className="w-full max-w-[420px]">
          {/* Тэмдэг, нэр */}
          <div className="eyebrow text-(--moss)">Нийслэлийн Байгаль орчны газар</div>

          <h1 className="display mt-2.5 text-[26px] leading-[1.2] text-ink">
            Байгаль орчны
            <br />
            нэгдсэн платформ
          </h1>

          <div className="ruler mt-4" />

          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-2">
            Системийн мэдээлэл байгууллагын дотоод хэрэглээнд зориулагдсан
            тул үргэлжлүүлэхийн тулд ArcGIS-ийн бүртгэлээрээ нэвтэрнэ үү.
          </p>

          {configured ? (
            <button
              onClick={enter}
              disabled={busy}
              className="glow mt-6 flex w-full items-center justify-center gap-2 rounded-xs border border-(--moss)/45 bg-(--moss)/10 px-4 py-3 text-[13px] font-medium text-(--moss) transition-colors hover:bg-(--moss)/15 disabled:opacity-60"
            >
              <LogIn size={14} />
              {busy ? "Порталруу шилжиж байна…" : "ArcGIS-ээр нэвтрэх"}
            </button>
          ) : (
            /* Тохиргоо дутуу үед товч харуулах нь утгагүй — дарвал алдаа
               л гарна. Хийх ёстой зүйлийг нь шууд хэлнэ */
            <div className="hatch mt-6 rounded-xs border border-dashed border-line-2 px-4 py-4">
              <p className="text-[12px] leading-relaxed text-ink-2">
                Нэвтрэлтийн тохиргоо дуусаагүй байна. Системийн админтай
                холбогдоно уу.
              </p>
            </div>
          )}

          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-ink-3">
            <ShieldCheck size={13} className="mt-px shrink-0" />
            Нэвтрэх нэр, нууц үгийг ArcGIS портал шалгана. Энэ систем нууц
            үгийг хүлээж авахгүй, хадгалахгүй.
          </p>
        </div>
      </div>
    </div>
  );
}
