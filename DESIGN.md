# Sistem Tasarımı: Randevu Sistemi, Müşteri Web (v1)

Durum: **taslak**. Onay bekleyen kararlar en altta.

## 1. Amaç

Bir işletmenin (örnek: kuaför) müşterileri web'den **hizmet seçip, personel ve saat seçerek randevu alabilsin**, randevularını görüp iptal edebilsin.

Kapsam dışı (v1): ödeme, SMS/e-posta hatırlatma, yönetici paneli, personel mobil uygulaması, çok işletme (multi-tenant). Bunlar sonraki repolar ve sonraki dilimler.

## 2. Veri modeli

```
profiles ──┐
 (müşteri,  │ 1..n
  personel, ▼
  yönetici) appointments ◄── services      (hizmet: süre, fiyat)
              ▲    ▲
              │    └──────── staff         (personel)
              │                 │  │
              │                 │  └── staff_services (kim hangi hizmeti yapar)
              │                 └───── working_hours  (haftalık çalışma saatleri)
```

| tablo | alanlar |
|---|---|
| `profiles` | `id` (= auth kullanıcı id), `full_name`, `phone`, `role` (`customer` / `staff` / `admin`) |
| `services` | `id`, `name`, `duration_min`, `price_cents`, `active` |
| `staff` | `id`, `profile_id` (boş olabilir), `display_name`, `active` |
| `staff_services` | `staff_id`, `service_id` |
| `working_hours` | `staff_id`, `weekday` (0-6), `start_time`, `end_time` |
| `appointments` | `id`, `customer_id`, `staff_id`, `service_id`, `starts_at`, `ends_at`, `status` (`confirmed` / `cancelled` / `completed` / `no_show`), `created_at` |

Zaman kuralı: `starts_at` ve `ends_at` **UTC olarak saklanır** (`timestamptz`), ekranda **Europe/Istanbul** olarak gösterilir. `working_hours` işletmenin yerel saatiyle tutulur.

## 3. Çakışma kuralı (tasarımın kalbi)

> Aynı personelin iptal edilmemiş iki randevusunun zaman aralığı kesişemez.

Bu kural **uygulama kodunda değil, veritabanında** zorlanır (iki kişi aynı anda aynı saati almaya çalışırsa kod yetmez):

```sql
-- gerekli eklenti
create extension if not exists btree_gist;

alter table appointments
  add constraint no_double_booking
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status <> 'cancelled');
```

Uygulama katmanı ayrıca boş saatleri hesaplar ki kullanıcı dolu saati hiç görmesin. Veritabanı kuralı **son güvenlik ağı**.

## 4. Boş saat hesabı (saf fonksiyon, Vitest ile test edilir)

```ts
getAvailableSlots({
  date,            // seçilen gün (Europe/Istanbul)
  durationMin,     // hizmetin süresi
  workingHours,    // o personelin o günkü çalışma aralığı
  appointments,    // o personelin o günkü dolu aralıkları
  now,             // geçmiş saatleri ve minimum bildirim süresini elemek için
  stepMin,         // slot adımı (öneri: 15 dk)
}): Slot[]
```

Bir saat uygun sayılır eğer: çalışma aralığının içinde, hizmet süresi kadar sığıyor, dolu bir aralıkla kesişmiyor, geçmişte değil ve en az `minNoticeMin` sonra.

Test edilecek uç durumlar: gün sınırı, çalışma saati bitişine denk gelen hizmet, hemen ardışık iki randevu, geçmiş saat, boş gün, hiç slot kalmayan gün.

## 5. Erişim kuralları (RLS)

| tablo | kim ne yapabilir |
|---|---|
| `services`, `staff`, `staff_services`, `working_hours` | **Herkes okur**, sadece yönetici yazar |
| `appointments` | Müşteri **kendi** satırlarını okur/ekler/iptal eder; personel kendi `staff_id` satırlarını okur; yönetici hepsini |
| `profiles` | Kullanıcı kendi profilini okur ve günceller |

İnce nokta: boş saat hesabı için **başkalarının dolu saatlerini** bilmek gerekir ama **kimin randevusu olduğunu** bilmemeliyiz. Bu yüzden `busy_slots(staff_id, date)` adında, yalnızca zaman aralıklarını döndüren bir veritabanı fonksiyonu (`security definer`) yazılır, müşteri tabloya doğrudan erişmez.

## 6. Uç noktalar (Next.js route handler)

| yöntem | adres | iş | girdi doğrulaması |
|---|---|---|---|
| GET | `/api/slots` | Boş saatleri döndür | `serviceId`, `staffId?`, `date` (zod) |
| POST | `/api/appointments` | Randevu oluştur | `serviceId`, `staffId`, `startsAt` (zod) |
| PATCH | `/api/appointments/[id]` | Randevuyu iptal et | sadece `status: "cancelled"` |
| GET | `/api/appointments` | Giriş yapanın randevuları | , |

## 7. Ekranlar

| adres | ekran | notlar |
|---|---|---|
| `/` | Hizmet listesi, "Randevu al" | herkes görür |
| `/randevu` | Sihirbaz: hizmet → personel (veya "fark etmez") → gün ve saat → özet | adım durumu **Zustand**'da |
| `/giris`, `/kayit` | Supabase Auth | giriş, randevu onayından hemen önce istenir |
| `/randevularim` | Randevu listesi, iptal | **TanStack Query** |

## 8. İş kuralları (başlangıç değerleri)

- Slot adımı: **15 dakika**.
- Minimum bildirim: randevu en az **60 dakika** sonrasına alınabilir.
- En fazla **30 gün** ilerisine randevu.
- İptal: randevuya **2 saatten az** kaldıysa müşteri iptal edemez.
- Bir müşteri aynı anda en fazla **3 aktif** randevu tutabilir.

## 9. Test planı

| katman | araç | ne test edilir |
|---|---|---|
| Saf mantık | Vitest | `getAvailableSlots`, iş kuralları |
| Veritabanı | SQL testi | `no_double_booking` kuralı iki eşzamanlı insert'te gerçekten reddediyor mu |
| Uçtan uca | Playwright | Giriş → hizmet seç → saat seç → onayla → `/randevularim`'da gör |
| CI | GitHub Actions | PR'da tip kontrolü + Vitest + Playwright |

## 10. Yapım sırası (dilimler)

1. Git/GitHub, boş Next.js + TypeScript iskeleti, CI kuralları.
2. `getAvailableSlots` + testler (veritabanı yok, saf TypeScript).
3. Supabase: tablolar, çakışma kuralı, örnek kuaför verisi.
4. Hizmet listesi ve boş saat uç noktası.
5. Giriş (Auth) ve randevu oluşturma.
6. RLS politikaları ve `busy_slots`.
7. Sihirbaz ekranı (Zustand), `/randevularim` (TanStack Query).
8. Playwright uçtan uca, Vercel'e yayın.

Her dilimin sonunda **Yusuf bir şeyi kendisi değiştirir** (ör. dilim 2'de yeni bir iş kuralı ekleyip önce testini yazmak).

## 11. Onay bekleyen kararlar

1. **Giriş yöntemi:** e-posta + şifre mi, e-postaya gelen sihirli bağlantı mı? (Öneri: sihirli bağlantı, şifre saklama derdi yok.)
2. **Personel seçimi:** "Fark etmez" seçeneği olsun mu? (Öneri: evet.)
3. **Çalışma saatlerinde öğle arası** (mola) v1'de olsun mu? (Öneri: hayır, v2.)
4. **Slot adımı** 15 dk mı 30 dk mı? (Öneri: 15.)
5. **İş kuralları** (bölüm 8) uygun mu?
