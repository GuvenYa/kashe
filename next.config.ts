import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // DEV-only: gerçek telefondan ağ IP'siyle test ederken Next.js dev kaynaklarına
  // (HMR + lazy chunk'lar) cross-origin erişim izni. Production'ı etkilemez.
  allowedDevOrigins: ["192.168.0.10"],
};

export default nextConfig;
