import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import "./workspace.css";
import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";
import { AuthProvider } from "@/components/auth/provider";
import { AccountGate } from "@/components/auth/access";
import { AutoTranslate } from "@/components/ui/auto-translate";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "cyrillic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Байгаль орчны хяналтын нэгдсэн систем", template: "%s · Байгаль орчны хяналтын нэгдсэн систем" },
  description: "Байгаль орчны салбарын үйл ажиллагааг удирдан зохион байгуулах, хянах, шийдвэр гаргалтыг дэмжих нэгдсэн систем.",
};

// Resolve the workspace theme before paint. The entrance has its own palette.
// Хэл (`lang`) мөн эхний зурагдалтаас өмнө — `lib/i18n.ts`.
const bootScript = `(function(){var t,l;try{t=localStorage.getItem('workspace-theme');l=localStorage.getItem('workspace-lang')}catch(e){}var r=document.documentElement;r.setAttribute('data-theme',t==='dark'?'dark':'light');r.setAttribute('lang',l==='en'?'en':'mn')})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: bootScript }} /></head>
      <body className={`${inter.variable} ${manrope.variable} antialiased`}>
        {/* Гарын хэрэглэгч Tab дарахад эхэлж гарна — цэсийг алгасаж агуулга руу */}
        <a href="#main" className="skip-link">Агуулга руу шилжих</a>
        <AuthProvider>
          <Sidebar />
          <div className="workspace-frame">
            <Header />
            <main id="main" tabIndex={-1} className="workspace-main min-h-[calc(100dvh-var(--head-h))] px-4 py-5 lg:px-6 lg:py-6"><AccountGate>{children}</AccountGate></main>
          </div>
        </AuthProvider>
        <AutoTranslate />
      </body>
    </html>
  );
}
