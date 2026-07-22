import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { CerezBanner } from "@/app/components/cerez-banner";

// Gilroy (marka fontu) — next/font/local. Ağırlıklar BİZ atarız: dosyaların OS/2
// meta'sı bozuk (hepsi 400 der), dosya içeriğine değil bu eşlemeye güvenilir.
// SemiBold dosyası yok → 600 boşluğu gerçek Bold gliflemesiyle doldurulur (sahte-bold yok).
const gilroy = localFont({
  src: [
    { path: './fonts/Gilroy-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Gilroy-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Gilroy-Bold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Gilroy-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/Gilroy-Heavy.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-gilroy',
  display: 'swap',
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
      className={`${gilroy.variable} ${inter.variable}`}
    >
      <body className="font-body antialiased">
        {children}
        <Analytics />
        {/* <CerezBanner /> */}
      </body>
    </html>
  );
}
