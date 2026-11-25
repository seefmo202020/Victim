import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "تيوب سمارت AI — استوديو رفع وتحسين فيديوهات يوتيوب",
  description:
    "اربط قناة اليوتيوب، ارفع فيديوهاتك، ودع الذكاء الاصطناعي يحلل المحتوى ويولّد العناوين الجذابة والوصف والهاشتاجات والكلمات المفتاحية الطويلة والترجمات ويرفع مباشرة إلى يوتيوب.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#F7F7F9] font-sans text-[#111216] antialiased selection:bg-[#FFE4E6] selection:text-[#B91C1C]">
        {children}
      </body>
    </html>
  );
}
