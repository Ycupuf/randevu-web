# Randevu

Küçük işletmeler için **ücretsiz, çok sektörlü online randevu sistemi**: kuaför, güzellik merkezi, oto yıkama ve benzeri.
Bu repo **müşteri web uygulaması** (randevu alma, değiştirme, iptal). İşletme sahibinin paneli ayrı repoda:
**[randevu-panel](https://github.com/Ycupuf/randevu-panel)**. İkisi aynı Supabase veritabanını kullanır.

| | Canlı | Kod |
|---|---|---|
| **Müşteri sitesi** | https://randevu-web-delta.vercel.app | bu repo |
| **İşletme paneli** | https://randevu-panel-psi.vercel.app | [randevu-panel](https://github.com/Ycupuf/randevu-panel) |
| **Tanıtım sayfası** | https://randevu-web-delta.vercel.app/proje | `src/app/proje` |

## 2 dakikada dene

1. [Demo Berber'de randevu al](https://randevu-web-delta.vercel.app/demo-berber/randevu): hizmet, personel, gün ve saat seç. Son adımda **"Demo hesabıyla devam et"** e-posta istemeden seni içeri alır.
2. [İşletme paneline](https://randevu-panel-psi.vercel.app) **"Demo hesabıyla devam et"** ile gir: aldığın randevu takvimde görünür.
3. Panelde randevuyu **onayla** ya da saatini değiştir; müşteri sitesinde **Randevularım** sayfasında durumun güncellendiğini gör.

Demo hesapları herkesle paylaşılır. İşletme sahibi demosu her girişte örnek verilerle sıfırlanır (yayın durumu, saatler, hizmetler dahil;
hesaplı müşterilerin randevusuna dokunmaz). Müşteri demosunda yalnızca demo müşterinin randevuları sıfırlanır.
Demo işletmeleri (`demo-berber`, `demo-guzellik`, `demo-oto-yikama`) silinemez. Gerçek bir e-postayla (magic link) giriş de çalışır.

> Durum: müşteri tarafı ve panel canlıda çalışıyor. Bilinen eksikler en altta.

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

Demo girişi (`/auth/demo`) için `.env.local` içine `NEXT_PUBLIC_DEMO_LOGIN=1`, `DEMO_CUSTOMER_EMAIL` ve `DEMO_CUSTOMER_PASSWORD`
yaz. Şifre yalnızca sunucuda okunur, tarayıcıya gitmez ve depoda yoktur. Demo hesaplarını `scripts/create-demo-users.mjs` oluşturur
(`SUPABASE_SERVICE_ROLE_KEY` yalnızca bu komut için, kendi bilgisayarında verilir).
CI'da Supabase adresi, yayınlanabilir anahtar ve `NEXT_PUBLIC_DEMO_LOGIN` depo "Variables", demo hesabı bilgileri (`DEMO_CUSTOMER_*`) ve varsa `E2E_*` "Secrets" olarak girilir.

## Canlıya alma (Vercel)

1. Vercel'de proje ayarları > Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (canlı adres). Demo girişi için `NEXT_PUBLIC_DEMO_LOGIN=1`, `DEMO_CUSTOMER_EMAIL`, `DEMO_CUSTOMER_PASSWORD` (sensitive).
2. Supabase panelinde Authentication > URL Configuration: **Site URL** ve **Redirect URLs** listesine canlı adresi ekle (`https://<adres>/**`). Eklenmezse giriş bağlantısı çalışmaz. Panelin adresi de aynı listeye eklenir.
3. Giriş e-postası için Supabase'in varsayılan servisi çok düşük hız sınırlıdır ve gerçek müşterilere güvenilir ulaşmaz; canlı kullanımdan önce özel SMTP (örn. Resend) bağla.

## E-posta

Altyapı hazır ve canlı veritabanında çalışıyor; **gönderim, Resend API anahtarı eklenene kadar kapalıdır** (kayıtlar `skipped` olur).

```
appointments tetikleyicisi ─► email_outbox ─► Edge Function `send-emails` ─► Resend
                                  ▲                    ▲
                     pg_cron (hatırlatma, her 10 dk)   pg_net (anında) + pg_cron süpürmesi (her dk, yeniden deneme)
```

- Müşteri sitesi, panel ve elle girilen randevu **aynı tetikleyiciden** geçer; e-posta mantığı tek yerde.
- **Müşteriye:** talep alındı, onaylandı, iptal (işletme/müşteri ayrımıyla), saat değişti ve 24 saat hatırlatma.
- **İşletmeye:** müşteri sitesinden yeni randevu alınınca (onay bekliyorsa ayrı konu satırıyla) işletmenin sahip hesaplarına ve randevudaki kaynağa bağlı personel hesabına; müşteri adı, telefon, not, ek form cevapları (plaka vb.) ve panele bağlantı. Sahibin panelden kendi girdiği randevu için e-posta gitmez.
- E-postası olmayan (telefonla gelen) ve `@randevu.test` demo hesaplarına e-posta gitmez.
- Anahtar yokken bile veri yüklenir ve şablon çizilir, sonra `skipped` yazılır: bir hata varsa `email_outbox.error` sütununda görünür.
- Kuyruktaki e-posta bayatlarsa (örn. randevu bu arada iptal edilmişse) gönderilmez. Hata durumunda üstel bekleme ile 3 kez denenir; `Idempotency-Key` ile çift e-posta olmaz.
- Şablonlar saf TypeScript: [`supabase/functions/send-emails/templates.ts`](supabase/functions/send-emails/templates.ts), birim testli.

**Açmak için** (bir kez):

1. [resend.com](https://resend.com)'da ücretsiz hesap aç, **API Keys** bölümünden anahtar oluştur.
2. Supabase paneli > **Edge Functions > Secrets** bölümüne `RESEND_API_KEY` ekle (ya da `supabase secrets set RESEND_API_KEY=... --project-ref <ref>`).
3. İsteğe bağlı: `EMAIL_FROM` (örn. `Randevu <randevu@alanadin.com>`), `SITE_URL` (müşteri sitesi) ve `PANEL_URL` (işletme paneli; işletme e-postasındaki bağlantı).

Alan adı doğrulanmadan Resend yalnızca **hesap sahibinin kendi e-postasına** gönderir; başka adreslere gönderim `failed` olur (neden `email_outbox.error` sütununda). Herkese gönderim için Resend'de bir alan adı doğrulayıp `EMAIL_FROM`'u onunla ayarla.

Kuyruğa bakmak için: `select kind, to_email, status, error from email_outbox order by created_at desc;`

## Bilinen eksikler

- Canlı e-posta gönderimi Resend anahtarı bekliyor (yukarıda). Giriş bağlantısı (magic link) ayrı bir yol: Supabase'in varsayılan e-postasıyla gider ve düşük hız sınırlıdır; sınırsız kullanım için Supabase Auth'a özel SMTP (Resend) bağlanmalıdır.
- İşletmeye yalnızca "yeni randevu" e-postası gider; müşterinin iptal/saat değişikliği için işletmeye bildirim yok.
- Magic link, gerçek bir e-posta adresiyle uçtan uca denenmedi; demo girişi bu yüzden var.
- Captcha ve CSP yok.
- KVKK sayfası bir şablondur, gerçek kullanımda hukuki gözden geçirme gerekir.
- Gizli anahtarlar (`SUPABASE_SERVICE_ROLE_KEY`) depoya girmez.
