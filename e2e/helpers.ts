import type { BrowserContext, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Test kullanıcısı tanımlı mı? Tanımlı değilse giriş gerektiren testler atlanır. */
export function e2eCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  return email && password ? { email, password } : null;
}

/**
 * Test kullanıcısı olarak oturum açar: Supabase'in şifre ucundan oturum alır ve @supabase/ssr'nin
 * beklediği çerez biçiminde ("base64-" + base64url(JSON), 3180 karakterlik parçalar) tarayıcıya yazar.
 * Giriş e-postası bağlantısıyla yapıldığı için testte gerçek e-posta kutusuna ihtiyaç duymaz.
 */
export async function signIn(context: BrowserContext, baseURL: string): Promise<void> {
  const creds = e2eCredentials();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!creds || !url || !key) throw new Error("E2E_EMAIL, E2E_PASSWORD ve Supabase değişkenleri gerekli");

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) throw new Error(`Test kullanıcısı giriş yapamadı (HTTP ${res.status})`);
  const session = await res.json();

  const name = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const encoded = encodeURIComponent("base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"));
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += 3180) chunks.push(encoded.slice(i, i + 3180));
  await context.addCookies(
    chunks.map((value, i) => ({ name: chunks.length > 1 ? `${name}.${i}` : name, value, url: baseURL })),
  );
}

/**
 * Sihirbazın "gün ve saat" adımında, bugünden sonraki ilk çalışılan günü seçer ve verilen sıradaki saati seçer.
 * Pazar günü demo işletmelerin bazısında kapalı olduğu için "Paz" atlanır.
 */
export async function pickDayAndSlot(page: Page, slotIndex: "first" | "last"): Promise<{ day: string; time: string }> {
  const dayGroup = page.getByRole("group", { name: "Gün seç" });
  const chips = dayGroup.getByRole("button");
  const count = await chips.count();
  let chosen: Locator | null = null;
  for (let i = 1; i < count; i++) {
    const text = (await chips.nth(i).innerText()).replace(/\s+/g, " ");
    if (!text.startsWith("Paz")) {
      chosen = chips.nth(i);
      break;
    }
  }
  if (!chosen) throw new Error("Uygun gün düğmesi bulunamadı");
  const day = (await chosen.innerText()).replace(/\s+/g, " ");
  await chosen.click();

  const slots = page.getByRole("group", { name: "Saat seç" }).getByRole("button");
  await expect(slots.first()).toBeVisible();
  const slot = slotIndex === "first" ? slots.first() : slots.last();
  const time = (await slot.innerText()).trim();
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  return { day, time };
}
