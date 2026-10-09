import { z } from "zod";

// NEXT_PUBLIC_ değişkenleri derleme sırasında koda gömülür; bu yüzden her biri
// `process.env.ADI` olarak AÇIKÇA yazılmalı (dinamik erişim çalışmaz).
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL geçerli bir adres olmalı"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY eksik"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  // "1" ise "Demo hesabıyla devam et" düğmesi görünür (şifreler sunucuda: DEMO_CUSTOMER_EMAIL/PASSWORD).
  NEXT_PUBLIC_DEMO_LOGIN: z
    .string()
    .optional()
    .transform((v) => v === "1"),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_DEMO_LOGIN: process.env.NEXT_PUBLIC_DEMO_LOGIN,
});

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(
    `Ortam değişkenleri eksik ya da hatalı:\n${details}\n.env.example dosyasını .env.local olarak kopyalayıp doldur.`,
  );
}

export const env = parsed.data;
