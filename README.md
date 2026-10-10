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
| **Veritabanı testleri (SQL)** | `DATABASE_URL=... ./scripts/run-db-tests.sh` | Çakışma kısıtı, anon yetkileri, müşteri e-posta bütünlüğü, bildirimler/e-postalar, demo korumaları, personel gizliliği, atomik saat kaydı. Her test geri alınır; bkz. [`supabase/tests`](supabase/tests/README.md) |

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

1. Vercel'de proje ayarları > Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Demo girişi için `NEXT_PUBLIC_DEMO_LOGIN=1`, `DEMO_CUSTOMER_EMAIL`, `DEMO_CUSTOMER_PASSWORD` (sensitive).
2. Supabase panelinde Authentication > URL Configuration: **Site URL** ve **Redirect URLs** listesine canlı adresi ekle (`https://<adres>/**`). Eklenmezse giriş bağlantısı çalışmaz. Panelin adresi de aynı listeye eklenir.
3. Giriş e-postası için Supabase'in varsayılan servisi çok düşük hız sınırlıdır ve gerçek müşterilere güvenilir ulaşmaz; canlı kullanımdan önce özel SMTP (örn. Resend) bağla.

## E-posta (müşteriye ve işletmeye)

Altyapı hazır ve canlı veritabanında çalışıyor; **gönderim, Resend API anahtarı eklenene kadar kapalıdır** (kayıtlar `skipped` olur).

```
appointments tetikleyicisi ─► email_outbox ─► Edge Function `send-emails` ─► Resend
                                  ▲                    ▲
                     pg_cron (hatırlatma, her 10 dk)   pg_net (anında) + pg_cron süpürmesi (her dk, yeniden deneme)
```

- Müşteri sitesi, panel ve elle girilen randevu **aynı tetikleyiciden** geçer; e-posta mantığı tek yerde.
- **Müşteriye:** talep alındı, onaylandı, iptal (işletme/müşteri ayrımıyla), saat değişti ve 24 saat hatırlatma.
- **İşletmeye:** işletmenin sahip hesaplarına ve randevudaki kaynağa bağlı personel hesabına, iki durumda:
  - müşteri sitesinden **yeni randevu** alınınca (onay bekliyorsa ayrı konu satırıyla): müşteri adı, telefon, not, ek form cevapları (plaka vb.) ve panele bağlantı;
  - müşteri **kendi randevusunu iptal edince**: aynı bilgiler ve varsa iptal nedeni, "bu saat yeniden boş";
  - müşteri **randevu saatini (ya da kişiyi) değiştirince**: eski ve yeni zaman; işletme manuel onay istiyorsa "yeni saat onayını bekliyor" notuyla. Kişi de değiştiyse **eski kişinin** personel hesabına da gider ("önceden Ali").
  Sahibin panelden kendi girdiği, iptal ettiği ya da taşıdığı randevu için kendisine e-posta gitmez (kimin yaptığı `cancelled_by` / `rescheduled_by` sütunlarında tutulur).
- E-postası olmayan (telefonla gelen) ve `@randevu.test` demo hesaplarına e-posta gitmez.
- Anahtar yokken bile veri yüklenir ve şablon çizilir, sonra `skipped` yazılır: bir hata varsa `email_outbox.error` sütununda görünür.
- Kuyruktaki e-posta bayatlarsa (örn. randevu bu arada iptal edilmişse) gönderilmez. Hata durumunda üstel bekleme ile 3 kez denenir; `Idempotency-Key` ile çift e-posta olmaz.
- Şablonlar saf TypeScript: [`supabase/functions/send-emails/templates.ts`](supabase/functions/send-emails/templates.ts), birim testli.

**Açmak için** (bir kez):

1. [resend.com](https://resend.com)'da ücretsiz hesap aç, **API Keys** bölümünden anahtar oluştur.
2. Supabase paneli > **Edge Functions > Secrets** bölümüne `RESEND_API_KEY` ekle (ya da `supabase secrets set RESEND_API_KEY=... --project-ref <ref>`).
3. `SITE_URL` (müşteri sitesi) ve `PANEL_URL` (işletme paneli) ZORUNLUDUR: yoksa e-postalar `skipped` olur, yanlış adrese bağlantı gitmez. İsteğe bağlı: `EMAIL_FROM` (örn. `Randevu <randevu@alanadin.com>`).

Alan adı doğrulanmadan Resend yalnızca **hesap sahibinin kendi e-postasına** gönderir; başka adreslere gönderim `failed` olur (neden `email_outbox.error` sütununda). Herkese gönderim için Resend'de bir alan adı doğrulayıp `EMAIL_FROM`'u onunla ayarla.

Kuyruğa bakmak için: `select kind, to_email, status, error from email_outbox order by created_at desc;`

## Panel bildirimleri (uygulama içi)

E-postadan bağımsız, her zaman açık: `notifications` tablosu (migration 15). Tetikleyiciler yazar, panelin **Bildirimler** sekmesi gösterir.

- Olaylar: yeni online randevu, müşteri iptali, müşteri saat/kişi değişikliği ve **yeni müşteri kaydı** (işletmede ilk kez randevu alan hesaplı müşteri; panelden elle eklenen hesapsız müşteri sayılmaz).
- Görünürlük RLS ile: sahip işletmenin hepsini, personel yalnızca kendi kaynağını ilgilendirenleri (kişi değişen taşımada eski kaynağın personeli de) görür. Okundu bilgisi kullanıcı başınadır (`notification_reads`).
- Bildirim satırı yalnızca olayı ve ek veriyi taşır; müşteri, hizmet, zaman bilgisi canlı okunur (bilgi hiç bayatlamaz). 90 günden eskileri her gece silinir (`pg_cron`).
- Demo sıfırlaması sırasında üretilen örnek randevular bildirim üretmez; randevu silinince bildirimi de gider.

## Güvenlik

Savunma katmanları (yukarıdan aşağı): RLS satırları korur → **sütun bazlı yetkiler** hangi sütunun yazılabildiğini sınırlar
(`businesses.slug/timezone`, `customers.email/business_id`, `resources.user_id` istemciden yazılamaz) → tetikleyiciler
değişmezleri zorlar (hesaplı müşterinin e-postası her zaman hesap e-postasıdır, `slug` değişmez, saat dilimi geçerli olmalı)
→ `anon` rolü yalnızca herkese açık katalog tablolarını okur (`TRUNCATE`/`TRIGGER` yetkileri hiçbir istemci rolünde yok).

- **Paylaşılan demo hesapları** herkesin kullanabildiği hesaplardır; bu yüzden: demo işletmeleri silinemez ve değiştirilemez
  alanları vardır, demo sahibi yeni işletmeyi yayınlayamaz (30 dakikada silinir), sıfırlama 20 saniyede bir çalışır,
  demo işletmelerde **gerçek hesapla** alınan randevu ve müşteri kayıtları 24 saat sonra silinir.
- E-posta kötüye kullanımına karşı alıcı başına saatte en fazla 30 e-posta kuyruğa girer.
- `/auth/demo` ve `/auth/signout` yalnızca kendi sitesinden gelen isteği kabul eder (login CSRF).
- Bağımsız iki inceleme turunda bulunan açıklar (e-posta bombalama, demo işletmesini silme, çapraz kiracı satır
  taşıma, personelin müşteri verisi) canlıda sömürüsü kanıtlandıktan sonra kapatıldı; migration 16-19 ve `supabase/tests`.
- `npm audit`: üretim bağımlılıklarında açık yok; yüksek bulgular yalnızca geliştirme zinciridir (lint).

## Bilinen eksikler

- Canlı e-posta gönderimi Resend anahtarı bekliyor (yukarıda). Giriş bağlantısı (magic link) ayrı bir yol: Supabase'in varsayılan e-postasıyla gider ve düşük hız sınırlıdır; sınırsız kullanım için Supabase Auth'a özel SMTP (Resend) bağlanmalıdır.
- İşletme e-postaları tek alıcı listesine gider; kişi başına bildirim tercihi (örn. yalnızca yeni randevu) yok.
- Magic link, gerçek bir e-posta adresiyle uçtan uca denenmedi; demo girişi bu yüzden var.
- Captcha ve CSP yok. `/api/slots` ve randevu uçlarında IP başına hız sınırı yok (e-posta ve aktif randevu limitleri var).
- Edge Function ve zamanlanmış işler proje adresine bağlıdır; başka projeye kurarken `supabase/config.toml` ve migration 11'deki adresi değiştir.
- KVKK silme/dışa aktarma talepleri kaydedilir ama işleyen bir arayüz yoktur.
- KVKK sayfası bir şablondur, gerçek kullanımda hukuki gözden geçirme gerekir.
- Gizli anahtarlar (`SUPABASE_SERVICE_ROLE_KEY`) depoya girmez.
