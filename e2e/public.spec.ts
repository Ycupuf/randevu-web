import { expect, test } from "@playwright/test";
import { pickDayAndSlot } from "./helpers";

// Giriş gerektirmeyen akışlar: herkese açık sayfalar ve sihirbazın özet ekranına kadar ilerlemesi.
// Bu testler Supabase'teki demo işletmeleri okur (yazmaz, e-posta göndermez).

test.describe("herkese açık sayfalar", () => {
  test("ana sayfa demo işletmeleri listeler", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Randevunu online al" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Demo Berber/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Demo Güzellik Merkezi/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Demo Oto Yıkama/ })).toBeVisible();
  });

  test("işletme sayfası hizmetleri, saatleri ve randevu düğmesini gösterir", async ({ page }) => {
    await page.goto("/demo-berber");
    await expect(page.getByRole("heading", { level: 1, name: "Demo Berber" })).toBeVisible();
    await expect(page.getByText("Saç kesimi")).toBeVisible();
    await expect(page.getByText("Pazartesi")).toBeVisible();
    await expect(page.getByText("Fiyatlar bilgi amaçlıdır; ödeme işletmede yapılır.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Randevu al" })).toHaveAttribute("href", "/demo-berber/randevu");
  });

  test("olmayan işletme 404 verir, sitenin kendi sayfaları işletme sayılmaz", async ({ page }) => {
    const missing = await page.goto("/yok-boyle-bir-isletme");
    expect(missing?.status()).toBe(404);
    await page.goto("/giris");
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  });

  test("girişsiz kullanıcı randevularım sayfasında giriş sayfasına yönlenir", async ({ page }) => {
    await page.goto("/randevularim");
    await expect(page).toHaveURL(/\/giris\?next=%2Frandevularim/);
  });

  test("giriş formu geçersiz e-postayı reddeder", async ({ page }) => {
    await page.goto("/giris");
    await page.getByLabel("E-posta", { exact: true }).fill("bozuk");
    await page.getByRole("button", { name: "Giriş bağlantısı gönder" }).click();
    await expect(page.getByText("Geçerli bir e-posta gir")).toBeVisible();
  });
});

test.describe("randevu sihirbazı (girişsiz, özete kadar)", () => {
  test("berber: hizmet, kişi, saat, bilgiler ve özet", async ({ page }) => {
    await page.goto("/demo-berber/randevu");

    // 1. Hizmet
    await expect(page.getByRole("heading", { name: "Hizmet seç" })).toBeVisible();
    await page.getByRole("button", { name: /Saç kesimi/ }).click();
    await expect(page.getByText(/1 \/ 5 seçildi · 30 dk/)).toBeVisible();
    await page.getByRole("button", { name: "Devam" }).click();

    // 2. Personel
    await expect(page.getByRole("heading", { name: "Personel seç" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fark etmez/ })).toBeVisible();
    await page.getByRole("button", { name: "Mehmet" }).click();
    await page.getByRole("button", { name: "Devam" }).click();

    // 3. Gün ve saat
    await expect(page.getByRole("heading", { name: "Gün ve saat seç" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Devam" })).toBeDisabled();
    await pickDayAndSlot(page, "first");
    await page.getByRole("button", { name: "Devam" }).click();

    // 4. Bilgiler: boş gönderimde alan bazlı hatalar
    await expect(page.getByRole("heading", { name: "Bilgilerin" })).toBeVisible();
    await page.getByRole("button", { name: "Devam" }).click();
    await expect(page.getByText("Adını ve soyadını gir")).toBeVisible();
    await expect(page.getByText(/Geçerli bir cep telefonu gir/)).toBeVisible();
    await expect(page.getByText("Geçerli bir e-posta gir")).toBeVisible();
    await expect(page.getByText("Devam etmek için aydınlatma metnini onaylamalısın")).toBeVisible();

    await page.getByLabel("Ad soyad").fill("Test Kullanıcı");
    await page.getByLabel("Cep telefonu").fill("0532 123 45 67");
    await page.getByLabel("E-posta", { exact: true }).fill("test@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Devam" }).click();

    // 5. Özet: giriş yapılmadığı için "e-postamla devam et" düğmesi (tıklanmaz, e-posta gönderilmez)
    await expect(page.getByRole("heading", { name: "Özet ve onay" })).toBeVisible();
    await expect(page.getByText("Saç kesimi · 30 dk")).toBeVisible();
    await expect(page.getByText("Mehmet", { exact: true })).toBeVisible();
    await expect(page.getByText("0532 123 45 67")).toBeVisible();
    await expect(page.getByRole("button", { name: "E-postamla devam et" })).toBeVisible();
  });

  test("oto yıkama: araç tipi seçilir, bay otomatik atanır, plaka zorunludur", async ({ page }) => {
    await page.goto("/demo-oto-yikama/randevu");
    await page.getByRole("group", { name: "Dış yıkama seçenekleri" }).getByRole("button", { name: /SUV/ }).click();
    await expect(page.getByText("1 / 5 seçildi · 40 dk")).toBeVisible();
    await page.getByRole("button", { name: "Devam" }).click();

    // Bay seçimi sorulmaz: doğrudan gün ve saat
    await expect(page.getByRole("heading", { name: "Gün ve saat seç" })).toBeVisible();
    await expect(page.getByText("Adım 2 / 4")).toBeVisible();
    await pickDayAndSlot(page, "first");
    await page.getByRole("button", { name: "Devam" }).click();

    await page.getByLabel("Ad soyad").fill("Test Kullanıcı");
    await page.getByLabel("Cep telefonu").fill("0533 111 22 33");
    await page.getByLabel("E-posta", { exact: true }).fill("test@example.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Devam" }).click();
    await expect(page.getByText("Bu alan zorunlu")).toBeVisible(); // plaka

    await page.getByLabel("Araç plakası").fill("34 ABC 123");
    await page.getByRole("button", { name: "Devam" }).click();
    await expect(page.getByRole("heading", { name: "Özet ve onay" })).toBeVisible();
    await expect(page.getByText(/Bay \d \(otomatik\)/)).toBeVisible();
    await expect(page.getByText("34 ABC 123")).toBeVisible();
  });

  test("güzellik: birden fazla hizmet seçilince süreler toplanır", async ({ page }) => {
    await page.goto("/demo-guzellik/randevu");
    await page.getByRole("button", { name: /Manikür/ }).click(); // 45 dk
    await page.getByRole("button", { name: /Pedikür/ }).click(); // 60 dk
    await expect(page.getByText(/2 \/ 5 seçildi · 1 sa 45 dk/)).toBeVisible();
  });

  test("seçimler sayfa yenilenince korunur", async ({ page }) => {
    await page.goto("/demo-berber/randevu");
    await page.getByRole("button", { name: /Boya/ }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: /Boya/ })).toHaveAttribute("aria-pressed", "true");
  });
});
