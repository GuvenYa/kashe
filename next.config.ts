import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // DEV-only: gerçek telefondan ağ IP'siyle test ederken Next.js dev kaynaklarına
  // (HMR + lazy chunk'lar) cross-origin erişim izni. Production'ı etkilemez.
  allowedDevOrigins: ["192.168.0.10"],
  /**
   * TEK AI GIRISI (Duzeltme 06-E, bulgu 65): iki ayri asistan sayfasi
   * (/etkinlik-planla, /pro-bul) kullaniciyi karistiriyordu. Ikisi de /kashe-ai
   * tek kutusuna katildi; eski adresler KALICI yonlendirme ile korunur
   * (disaridan gelen baglantilar ve arama motoru indeksi kirilmasin).
   */
  /**
   * GUVENLIK 06 (bulgu 108): guvenlik basliklari. Site baska bir alan adinin
   * cercevesine (iframe) gomulemez (tiklama kacirma: "Eminsen tekrar tikla"
   * gibi onay dugmeleri gorunmez cerceveyle tiklatilamasin); tarayici dosya
   * turunu tahmin etmez; disari giden baglantida yalniz alan adi gider; sitenin
   * kullanmadigi kamera / mikrofon / konum izinleri kapali. Surum basligi gizli.
   * Tam icerik politikasi (script-src) ayri bir turda: Next.js satir ici
   * betikleri nonce gerektirir.
   */
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/etkinlik-planla", destination: "/kashe-ai", permanent: true },
      { source: "/pro-bul", destination: "/kashe-ai", permanent: true },
    ];
  },
};

export default nextConfig;
