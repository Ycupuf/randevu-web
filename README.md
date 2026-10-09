# Randevu

Küçük işletmeler için **ücretsiz, çok sektörlü online randevu sistemi**: kuaför, güzellik merkezi, oto yıkama ve benzeri.
Bu repo **müşteri web uygulaması** (randevu alma, değiştirme, iptal). İşletme sahibinin paneli ayrı repoda (`randevu-panel`), ikisi aynı Supabase veritabanını kullanır.

> Durum: müşteri tarafı çalışıyor (randevu alma, değiştirme, iptal, takvime ekleme; kuaför, güzellik ve oto yıkama demo işletmeleriyle). İşletme paneli ayrı repoda yapılacak. Canlı yayın için gerekenler aşağıda.

## Neden var

Küçük işletmelerde randevu hâlâ telefon, WhatsApp ve defterle yönetiliyor. Müşteri çalışma saati dışında randevu alamıyor, aynı saate iki kişi yazılabiliyor, işletme sahibi işini bırakıp telefonlara bakıyor.
Booksy ve Fresha gibi ürünler bu işi yapıyor; bu proje onların çekirdeğini küçük ölçekte, her sektöre uyan tek bir modelle yeniden kuruyor.

## Tasarım özeti

- **Her sektöre tek model:** hizmet + kaynak (personel, yıkama bayı, oda) + zaman. Etiketler sektör şablonundan gelir.
- **Çakışma garantisi veritabanında:** aynı kaynakta iki randevunun zaman aralığı kesişemez (PostgreSQL `EXCLUDE` kısıtı).
- **Kiracı izolasyonu:** her işletme yalnızca kendi verisini görür (Supabase RLS).
- **Ödeme yok:** fiyatlar bilgi amaçlıdır, ödeme işletmede yapılır.

Ayrıntılar: [`docs/URUN-TASARIMI.md`](docs/URUN-TASARIMI.md). Teknoloji listesi ve ilerleme: [`TEKNOLOJILER.md`](TEKNOLOJILER.md).

## Teknolojiler

Next.js (App Router), React, TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, RLS), TanStack Query, Zustand, zod, date-fns, Vitest, Playwright, GitHub Actions, Vercel.

## Çalıştırma

```bash
npm install
cp .env.example .env.local   # değerleri Supabase panelinden doldur
npm run dev
```

| komut | ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (`http://localhost:3000`) |
| `npm test` | Birim testleri (Vitest) |
| `npm run typecheck` | Tip kontrolü |
| `npm run lint` | Kod stili |
| `npm run build` | Canlı sürüm derlemesi |

## Veritabanı

Şema `supabase/migrations/` altındaki SQL dosyalarında (sırayla uygulanır). Randevuyla ilgili tüm yazma işlemleri
doğrulama yapan veritabanı fonksiyonlarından geçer (`create_appointment`, `cancel_appointment`,
`reschedule_appointment`, `set_appointment_status`); tablolara doğrudan randevu yazılamaz. Çakışma kuralı
(`no_double_booking`) ve erişim kuralları (RLS) veritabanındadır, uygulama kodu bunlara güvenir ama yerine geçmez.

## Testler

| ne | komut | not |
|---|---|---|
| Birim testleri (Vitest) | `npm test` | saat hesabı, kurallar, doğrulama, `.ics`, sihirbaz durumu |
| Uçtan uca (Playwright) | `npm run e2e` | `npx playwright install chromium` bir kez gerekir |

Uçtan uca testin giriş gerektiren kısmı, Supabase'te bir test kullanıcısı ister. Oluşturmak için (kendi bilgisayarında,
`SUPABASE_SERVICE_ROLE_KEY` çok güçlü bir anahtardır: yalnızca bu komut için ver, depoya yazma):

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... E2E_EMAIL=e2e@ornek.test E2E_PASSWORD=... \
  node scripts/create-e2e-user.mjs
```

Sonra `.env.local` dosyasına `E2E_EMAIL` ve `E2E_PASSWORD` ekle. Tanımlı değilse bu testler kendini atlar.
CI'da aynı değişkenler GitHub'da depo "Secrets" olarak, Supabase adresi ve yayınlanabilir anahtar "Variables" olarak girilir.

## Canlıya alma (Vercel)

1. Vercel'de proje ayarları > Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (canlı adres).
2. Supabase panelinde Authentication > URL Configuration: **Site URL** ve **Redirect URLs** listesine canlı adresi ekle (`https://<adres>/**`). Eklenmezse giriş bağlantısı çalışmaz.
3. Giriş e-postası için Supabase'in varsayılan servisi çok düşük hız sınırlıdır ve gerçek müşterilere güvenilir ulaşmaz; canlı kullanımdan önce özel SMTP (örn. Resend) bağla.

## Notlar

- E-posta: giriş bağlantısı Supabase'in varsayılan e-postasıyla gider (düşük hız sınırı). Gerçek müşteri e-postası ve hatırlatma için özel SMTP (örn. Resend) gerekir; henüz yok.
- Gizli anahtarlar (`SUPABASE_SERVICE_ROLE_KEY`) depoya girmez.
