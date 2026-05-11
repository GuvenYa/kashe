import type { Metadata } from "next";
import { Fraunces, Geist, DM_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kashe — Doğru kişiye direkt",
  description:
    "Türkiye'nin etkinlik ve yetenek pazaryeri. Hostes, DJ, fotoğrafçı, sunucu, müzisyen, oyuncu — ajanssız, şeffaf fiyatla.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${fraunces.variable} ${geist.variable} ${dmMono.variable}`}
    >
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}