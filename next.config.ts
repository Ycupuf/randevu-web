import type { NextConfig } from "next";

// Not: create-next-app'in açtığı `cacheComponents` kapatıldı. Randevu verisi her istekte
// değişen (dinamik) veridir; bu mod `new Date()` gibi çağrıları derleme hatasına çevirir.

// Tarayıcıya gönderilen temel güvenlik başlıkları.
// Not: İçerik Güvenliği Politikası (CSP) henüz yok. Next.js'in satır içi betikleri için nonce ayarı
// gerektirir; canlıya çıkmadan önce eklenmesi iyi olur.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
