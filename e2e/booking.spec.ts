import { expect, test } from "@playwright/test";
import { e2eCredentials, pickDayAndSlot, signIn } from "./helpers";

// Giriş gerektiren akış: randevu al, takvime ekle, saati değiştir, iptal et.
// E2E_EMAIL ve E2E_PASSWORD tanımlı değilse atlanır (bkz. README, "Uçtan uca testler").
// Test, sonunda aldığı randevuyu iptal eder; başarısız olursa da `afterEach` iptal etmeyi dener.

test.skip(!e2eCredentials(), "E2E_EMAIL / E2E_PASSWORD tanımlı değil");

test.describe("giriş yapmış kullanıcı", () => {
  let appointmentUrl: string | null = null;

  test.beforeEach(async ({ context, baseURL }) => {
    appointmentUrl = null;
    await signIn(context, baseURL!);
  });

  test.afterEach(async ({ page }) => {
    if (!appointmentUrl) return;
    await page.goto(appointmentUrl);
    const cancel = page.getByRole("button", { name: "Randevuyu iptal et" });
    if (await cancel.isVisible()) {
      await cancel.click();
      await page.getByRole("button", { name: "Evet, iptal et" }).click();
      await expect(page.getByText("İptal edildi").first()).toBeVisible();
    }
  });

  test("randevu al, takvime ekle, saati değiştir, iptal et", async ({ page, request }) => {
    await page.goto("/demo-berber/randevu");
    await expect(page.getByRole("link", { name: "Randevularım" })).toBeVisible();

    await page.getByRole("button", { name: /Saç kesimi/ }).click();
    await page.getByRole("button", { name: "Devam" }).click();
    await page.getByRole("button", { name: "Ali" }).click();
    await page.getByRole("button", { name: "Devam" }).click();
    // Çakışma ihtimalini azaltmak için günün SON saati
    await pickDayAndSlot(page, "last");
    await page.getByRole("button", { name: "Devam" }).click();

    await page.getByLabel("Ad soyad").fill("E2E Test");
    await page.getByLabel("Cep telefonu").fill("0532 000 00 00");
    await expect(page.getByLabel("E-posta", { exact: true })).toHaveAttribute("readonly", "");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Devam" }).click();

    // Giriş yapılmış: doğrudan onay düğmesi
    await page.getByRole("button", { name: "Randevuyu onayla" }).click();
    await expect(page).toHaveURL(/\/randevu\/[0-9a-f-]{36}\?yeni=1/);
    appointmentUrl = new URL(page.url()).pathname;
    await expect(page.getByText("Randevun alındı.")).toBeVisible();
    await expect(page.getByText("Onaylandı")).toBeVisible();

    // Takvim dosyası
    const id = appointmentUrl.split("/").pop();
    const ics = await page.request.get(`/api/appointments/${id}/ics`);
    expect(ics.status()).toBe(200);
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    expect(await ics.text()).toContain("BEGIN:VEVENT");

    // Başkası bu randevuya erişemez (girişsiz istek)
    const anonymous = await request.get(`/api/appointments/${id}/ics`);
    expect(anonymous.status()).toBe(401);

    // Saati değiştir
    const oldTime = await page.getByText(/\d{2}:\d{2} – \d{2}:\d{2}/).first().innerText();
    await page.getByRole("button", { name: "Saati değiştir" }).click();
    const picker = page.getByRole("group", { name: "Gün seç" });
    const dayButtons = picker.getByRole("button");
    const dayCount = await dayButtons.count();
    for (let i = dayCount - 1; i >= 1; i--) {
      const text = (await dayButtons.nth(i).innerText()).replace(/\s+/g, " ");
      if (!text.startsWith("Paz")) {
        await dayButtons.nth(i).click();
        break;
      }
    }
    const slots = page.getByRole("group", { name: "Saat seç" }).getByRole("button");
    await expect(slots.first()).toBeVisible();
    await slots.first().click();
    await page.getByRole("button", { name: "Saati değiştir" }).last().click();
    await expect(page.getByRole("button", { name: "Randevuyu iptal et" })).toBeVisible();
    await expect(page.getByText(/\d{2}:\d{2} – \d{2}:\d{2}/).first()).not.toHaveText(oldTime);

    // Randevularım listesinde görünür
    await page.goto("/randevularim");
    await expect(page.getByRole("heading", { name: "Yaklaşan" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Demo Berber/ }).first()).toBeVisible();

    // İptal et
    await page.goto(appointmentUrl);
    await page.getByRole("button", { name: "Randevuyu iptal et" }).click();
    await page.getByRole("button", { name: "Evet, iptal et" }).click();
    await expect(page.getByText("Sen iptal ettin")).toBeVisible();
    await expect(page.getByRole("button", { name: "Saati değiştir" })).toHaveCount(0);
  });

  test("hesabım sayfası ve KVKK talebi", async ({ page }) => {
    await page.goto("/hesabim");
    await expect(page.getByRole("heading", { name: "Hesabım" })).toBeVisible();
    await expect(page.getByText(process.env.E2E_EMAIL!)).toBeVisible();
    await page.getByRole("button", { name: "Hesabımı ve verilerimi sil" }).click();
    await expect(page.getByRole("button", { name: "Evet, silme talebi oluştur" })).toBeVisible();
    await page.getByRole("button", { name: "Vazgeç" }).click();
    await expect(page.getByRole("button", { name: "Evet, silme talebi oluştur" })).toHaveCount(0);
  });
});
