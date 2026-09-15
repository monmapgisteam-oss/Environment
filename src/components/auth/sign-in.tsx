"use client";

import * as React from "react";
import { LogIn } from "lucide-react";
import { asset } from "@/lib/base-path";

/* --------------------------------------------------------------------------
   НЭВТРЭХ ДЭЛГЭЦ

   Энэ бол системийн ЦОРЫН ГАНЦ бүтэн дэлгэцийн харагдац: толгой ч,
   хажуугийн зурвас ч байхгүй. Шалтгаан нь энгийн — нэвтрээгүй хэрэглэгчид
   очих газар байхгүй. Цэс харуулаад товшилт бүрийг нь хаах нь хаалгыг
   нээлттэй мэт харуулж, дараа нь татгалзахтай адил.

   ⚠ **БИЧВЭР ЦӨӨН** (хэрэглэгчийн залруулга, 2026-09-15). Систем нэрээ
   хэлээд нэвтрэх боломжийг өгнө — өөр юу ч биш. Урьд нь байгууллагын нэр,
   хэрэглээний тайлбар, нууц үг хаана шалгагдах тухай тэмдэглэл гэсэн
   гурван нэмэлт блок байсныг хасав: нэвтрэхээс өөр сонголт байхгүй дэлгэц
   дээр тайлбар уншигддаггүй. Дахин бүү нэм.

   ⚠ **ДЭВСГЭР ЗУРАГ НЬ БАЙХГҮЙ Ч АЖИЛЛАНА.** Зураг нь
   `public/auth/background.webp` дээр сууна. Татагдаагүй тохиолдолд доор нь
   давхарлагдсан градиент харагдах тул дэлгэц хэзээ ч хоосон цагаан
   болохгүй. Зураг солих нь ганц файл солих ажил — код хөндөхгүй.

   ⚠ **БИЧВЭР БАРУУН ТАЛД СУУНА — ЗУРГААС БОЛЖ.** Одоогийн зураг нь
   нийслэлийн зураглал, зангилаануудыг ЗҮҮН талдаа агуулж, баруун тал нь
   бүдгэрсэн уулархаг дэвсгэр. Бичвэрийг зүүн талд тавьбал хөшиг нь яг
   гол агуулгыг дардаг. Зураг солигдож, агуулга нь нөгөө тал руу шилжвэл
   бичвэрийн тал ба хөшгийн чиглэл ХОЁУЛАА дагаж эргэнэ.

   ⚠ **БИЧВЭР ЗУРАГ ДЭЭР УНШИГДАХ ЁСТОЙ.** Бичвэрийг зурган дээр ШУУД
   тавихгүй: хагас тунгалаг хөшиг (`scrim`) дээр сууна. Ингэснээр зураг
   цайвар ч, бараан ч байсан уншигдац тогтвортой.
   -------------------------------------------------------------------------- */

const BACKGROUND = asset("/auth/background.webp");

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

      {/* Хөшиг нь БАРУУН тийш өтгөрнө: бичвэр тэнд сууж, зүүн талын
          зураглал нээлттэй үлдэнэ */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-l from-paper via-paper/80 to-paper/25 lg:via-paper/70 lg:to-transparent"
      />
      {/* Нарийн дэлгэцэнд зураг ихээр хайчигдаж бичвэрийн ард ямар ч
          хэсэг тохиолдож болох тул нэмэлт жигд хөшиг */}
      <div aria-hidden className="absolute inset-0 bg-paper/35 lg:bg-transparent" />

      <div className="relative flex min-h-dvh items-center justify-end px-5 py-10 lg:px-12">
        <div className="w-full max-w-[380px]">
          <h1 className="display text-[26px] leading-[1.2] text-ink">
            Байгаль орчны хяналтын
            <br />
            нэгдсэн систем
          </h1>

          <div className="ruler mt-4" />

          {configured ? (
            <button
              onClick={enter}
              disabled={busy}
              className="glow mt-6 flex w-full items-center justify-center gap-2 rounded-xs border border-(--moss)/45 bg-(--moss)/10 px-4 py-3 text-[13px] font-medium text-(--moss) transition-colors hover:bg-(--moss)/15 disabled:opacity-60"
            >
              <LogIn size={14} />
              {busy ? "Шилжиж байна…" : "Нэвтрэх"}
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
        </div>
      </div>
    </div>
  );
}
