import type { Metadata } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// Fonts from the Figma file "잇츠미 디자인": Noto Sans KR for UI text, Jua for the brand voice.
// Korean glyphs come in many unicode-range files, so preloading is off.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: ["400", "500", "700"],
  preload: false,
});

const jua = Jua({
  variable: "--font-jua",
  weight: "400",
  preload: false,
});

export const metadata: Metadata = {
  title: "잇츠미",
  description: "잃어버린 물건과 주인을 AI로 다시 연결합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${jua.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
