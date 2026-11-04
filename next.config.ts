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
  async redirects() {
    return [
      { source: "/etkinlik-planla", destination: "/kashe-ai", permanent: true },
      { source: "/pro-bul", destination: "/kashe-ai", permanent: true },
    ];
  },
};

export default nextConfig;
