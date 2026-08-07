import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";

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

export const metadata: Metadata = {
  title: {
    default: "Байгаль орчны нэгдсэн платформ",
    template: "%s · Байгаль орчны нэгдсэн платформ",
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
      <body className={`${inter.variable} antialiased`}>
        <Header />
        <Sidebar />
        <div className="lg:pl-(--rail-w)">
          <MobileNav />
          <main className="min-h-[calc(100dvh-var(--head-h))] px-4 py-5 lg:px-6 lg:py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
