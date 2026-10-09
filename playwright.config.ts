import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// .env.local değerlerini (Supabase adresi, test kullanıcısı) test sürecine yükler.
loadEnvConfig(process.cwd());

const PORT = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  // Giriş yapan testler aynı test kullanıcısını ve aynı saatleri kullanır; sıralı çalışmalı.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "masaüstü", use: { ...devices["Desktop Chrome"] } },
    { name: "mobil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // CI'da önce `npm run build` yapılır ve derlenmiş uygulama çalıştırılır; yerelde geliştirme sunucusu.
    command: process.env.CI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
