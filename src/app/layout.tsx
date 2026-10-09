import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/QueryProvider";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

// latin-ext: Türkçe karakterler (ı, ş, ğ, İ) bu alt kümede.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Randevu",
    template: "%s | Randevu",
  },
  description:
    "Kuaför, güzellik merkezi, oto yıkama ve daha fazlası için online randevu. Hizmetini seç, saatini seç, randevunu al.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          İçeriğe geç
        </a>
        <SiteHeader />
        <main id="icerik" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">
          <QueryProvider>{children}</QueryProvider>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
