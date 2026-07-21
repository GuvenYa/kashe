import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { CerezBanner } from "@/app/components/cerez-banner";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kashe — Türkiye'nin Yetenek Sahnesi | DJ, Fotoğrafçı, Sunucu & Etkinlik",
  description:
    "Türkiye'nin etkinlik ve yetenek pazaryeri. Hostes, DJ, fotoğrafçı, sunucu, müzisyen, oyuncu — ajanssız, şeffaf fiyatla.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kashe",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#040D26", /* Zümrüt — eski mor #9333EA terk edildi */
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${spaceGrotesk.variable} ${inter.variable}`}
    >
      <body className="font-body antialiased">
        {children}
        <Analytics />
        {/* <CerezBanner /> */}
      </body>
    </html>
  );
}
