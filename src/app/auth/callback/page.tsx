"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { completeSignIn } from "@/lib/auth";
import { useAuth } from "@/components/auth/provider";

/* --------------------------------------------------------------------------
   ПОРТАЛААС БУЦАЖ ИРЭХ ЦЭГ

   Портал нэвтрүүлснийхээ дараа хэрэглэгчийг ЭНД буцаана. Хаягийн мөрөнд
   нэг удаагийн код ирэх бөгөөд түүнийг токен болгож солино.

   ⚠ **ЭНЭ ЗАМЫН ХАЯГ ПОРТАЛД БҮРТГЭГДСЭНТЭЙГЭЭ ҮСЭГ ҮСГЭЭРЭЭ ТААРНА.**
   Сайт `trailingSlash`-тай экспортлогддог тул төгсгөлийн зураас ЗААВАЛ:
   `…/Environment/auth/callback/`. Зураасгүй бичвэл портал татгалзана.

   ⚠ **`useSearchParams` ХЭРЭГЛЭХГҮЙ.** Статик экспортод тэр нь Suspense
   шаардаж, хуудсыг хойшлуулдаг. Код нь зөвхөн хөтөч дээр хэрэгтэй тул
   `window.location.search`-ээс шууд уншина.

   ⚠ **КОД НЭГ УДААГИЙНХ.** Хатуу горимд (StrictMode) нөлөө хоёр удаа
   ажилладаг бөгөөд хоёр дахь солилцоо нь "код хэрэглэгдсэн" гэж унана.
   Тиймээс нэг удаа ажилласныг `ref`-ээр тэмдэглэнэ.
   -------------------------------------------------------------------------- */

export default function CallbackPage() {
  const router = useRouter();
  const { sync } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const done = React.useRef(false);

  React.useEffect(() => {
    if (done.current) return;
    done.current = true;

    completeSignIn(window.location.search)
      .then((back) => {
        /* ⚠ ХААЛГАНД ШИНЭ СЕССИЙГ ЗААВАЛ МЭДЭГДЭНЭ. Хаалга нь сессийг
           ачаалагдахдаа НЭГ УДАА уншдаг ба энэ хуудас ачаалагдах мөчид
           сесси байхгүй байсан тул түүний төлөв `out` хэвээр хөлдсөн
           байна. Доорх `replace` нь КЛИЕНТ талын шилжилт учир хаалга
           дахин ачаалагдахгүй — мэдэгдэхгүй бол токен амжилттай
           бичигдсэн хэрнээ хэрэглэгч нэвтрэх дэлгэц рүү буцна. */
        sync();

        /* `replace` — буцах товчоор энэ хуудас руу эргэж орвол код нь
           аль хэдийн хэрэглэгдсэн тул алдаа гарна */
        router.replace(back || "/");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Нэвтрэлт амжилтгүй боллоо");
      });
  }, [router, sync]);

  return (
    <div className="flex min-h-[calc(100dvh-var(--head-h))] items-center justify-center px-5">
      {error ? (
        <div className="w-full max-w-[380px] rounded-xs border border-line bg-paper-2 px-4 py-4">
          <div className="flex items-center gap-2 text-(--clay)">
            <AlertTriangle size={14} />
            <span className="eyebrow">Нэвтрэлт амжилтгүй боллоо</span>
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-2">{error}</p>
          <button
            onClick={() => router.replace("/")}
            className="mt-4 w-full rounded-xs border border-line px-3 py-2 text-[12px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
          >
            Дахин оролдох
          </button>
        </div>
      ) : (
        <span className="flex items-center gap-2 text-[13px] text-ink-3">
          <Loader2 size={14} className="animate-spin" />
          Нэвтрэлтийг баталгаажуулж байна…
        </span>
      )}
    </div>
  );
}
