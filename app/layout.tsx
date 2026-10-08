import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { CerezBanner } from "@/app/components/cerez-banner";
import { SITE_URL } from "@/app/lib/site";

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

const SITE_BASLIK =
  "Kashe — Türkiye'nin Yetenek Sahnesi · Etkinlik sektörü için yapay zeka destekli pazaryeri ve operasyon platformu";
const SITE_ACIKLAMA =
  "Türkiye'nin etkinlik ve yetenek pazaryeri. Hostes, DJ, fotoğrafçı, sunucu, müzisyen, oyuncu ve organizasyon firmaları — şeffaf fiyatla, tek platformda.";

export const metadata: Metadata = {
  // metadataBase: goreli OG/canonical yollarini mutlak URL'e cevirir (tek kaynak: lib/site).
  metadataBase: new URL(SITE_URL),
  title: SITE_BASLIK,
  description: SITE_ACIKLAMA,
  manifest: "/manifest.json",
  // NOT: canonical BURADA degil, app/page.tsx'te. Layout'a yazilirsa her alt sayfa
  // onu miras alir ve tum site "/" kanonigine duser.
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Kashe",
    title: SITE_BASLIK,
    description: SITE_ACIKLAMA,
    url: "/",
    images: [
      {
        url: "/og-anasayfa.png",
        width: 1200,
        height: 630,
        alt: "Kashe — Türkiye'nin etkinlik ve yetenek pazaryeri",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_BASLIK,
    description: SITE_ACIKLAMA,
    images: ["/og-anasayfa.png"],
  },
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
  themeColor: "#040D26", /* brand-ink (lacivert) */
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
