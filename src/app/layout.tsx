import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { AuthProvider } from "@/components/auth/provider";

/**
 * Систем даяар ГАНЦ үсгийн фонт. Гарчиг, бие, тоо бүгд Inter.
 * Тоонуудын багана эгнэх шинжийг тусдаа mono фонтоор биш,
 * `font-variant-numeric: tabular-nums`-аар хангана (globals.css → `.num`).
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

/**
 * ⚠ **ПЛАТФОРМЫН "ГАНЦ ФОНТ" ДҮРМИЙН ЦОРЫН ГАНЦ ҮЛ ХАМААРАХ ЗҮЙЛ**
 * (хэрэглэгчийн шийдвэр, 2026-09-15).
 *
 * Manrope нь ЗӨВХӨН нэвтрэх дэлгэцийн гарчигт хэрэглэгдэнэ
 * (`.brandmark`, `components/auth/sign-in.tsx`). Тэр бол системийн
 * цорын ганц бүтэн дэлгэцийн харагдац бөгөөд нэг л мөр бичвэртэй —
 * тиймээс нэмэлт фонтын жин зөвхөн тэнд л төлөгдөнө.
 *
 * ⚠ Самбар, толгой, хүснэгтэд БҮҮ ХЭРЭГЛЭ. Дата харуулах бүх
 * харагдацад Inter хэвээр: эрэмбийг хэмжээ, жин, нягтралаар гаргана.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Байгаль орчны хяналтын нэгдсэн систем",
    template: "%s · Байгаль орчны хяналтын нэгдсэн систем",
  },
  description:
    "Байгаль орчны салбарын үйл ажиллагааг удирдан зохион байгуулах, хянах, шийдвэр гаргалтыг дэмжих нэгдсэн систем.",
};

/**
 * Эхний зурагдалтаас өмнө тогтоох зүйлс:
 *  1. Өнгөний горим — харанхуй нь брэндийн үндсэн горим, гэрлийг зориудаар
 *     сонгосон тохиолдолд л асна.
 *  2. Хажуугийн зурвасын өргөн — хэрэглэгчийн чирж тохируулсан утга.
 *  3. Зурвас хураагдсан эсэх — эс тэгвээс хуудас нээгдэхэд зурвас нэг
 *     анивчаад алга болно.
 */
const bootScript = `
(function () {
  var d = document.documentElement, t, w, r;
  try {
    t = localStorage.getItem('theme');
    w = localStorage.getItem('railw');
    r = localStorage.getItem('rail');
  } catch (e) {}
  d.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  w = parseInt(w, 10);
  if (w >= 232 && w <= 460) d.style.setProperty('--rail-w', w + 'px');
  if (r === 'off') d.setAttribute('data-rail', 'off');
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className={`${inter.variable} ${manrope.variable} antialiased`}>
        {/* Нэвтрэлтийн хаалга нь ТОЛГОЙ, ЗУРВАСЫГ ХАМРУУЛНА: нэвтрээгүй
            хэрэглэгчид очих газар байхгүй тул цэс харуулаад товшилт
            бүрийг нь хаах нь утгагүй */}
        <AuthProvider>
          <Header />
          <Sidebar />
          <div className="lg:pl-(--rail-w)">
            <MobileNav />
            <main className="min-h-[calc(100dvh-var(--head-h))] px-4 py-5 lg:px-6 lg:py-6">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
