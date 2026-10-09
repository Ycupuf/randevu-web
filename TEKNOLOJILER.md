# Teknoloji Listesi: Randevu Sistemi, Müşteri Web

Bu dosya, projede hangi teknolojilerin kullanılacağını ve ilerlemeyi takip etmek için.

**Nasıl okunur:**
- **Kullanılacak**: ✅ = bu projede kullanılacak, ➖ = bu projede kullanılmayacak (başka repoda ya da hiç).
- **Yapıldı**: ⬜ = henüz yapılmadı, ✅ = projede kullanıldı ve çalışıyor. İlerledikçe elle ⬜ yerine ✅ yaz.

## 1. Bu repoda kullanılacaklar

| Kullanılacak | Yapıldı | Teknoloji | Projedeki görevi |
|:-:|:-:|---|---|
| ✅ | ⬜ | **Git / GitHub** | Tüm geçmiş, dallar, PR'lar, profil vitrini |
| ✅ | ⬜ | **JavaScript** (tamamlama) | Dilin temeli: dizi metotları, destructuring, modüller |
| ✅ | ✅ | **TypeScript** | Tüm kod; randevu ve hizmet modelleri |
| ✅ | ✅ | **React** | Arayüz bileşenleri |
| ✅ | ✅ | **Next.js** | Sayfalar, sunucu tarafı çizim, uç noktalar |
| ✅ | ✅ | **Tailwind CSS** | Stil, telefonda da düzgün görünsün |
| ✅ | ✅ | **Node.js / REST** | Next.js route handler'larıyla randevu oluşturma ve listeleme |
| ✅ | ✅ | **SQL / PostgreSQL** | Hizmet, personel, randevu tabloları, çakışma sorgusu |
| ✅ | ⬜ | **Supabase Auth** | Müşteri girişi |
| ✅ | ✅ | **Supabase RLS** | Müşteri sadece kendi randevusunu görür |
| ✅ | ✅ | **TanStack Query** | Boş saatleri ve randevuları sunucudan çekme |
| ✅ | ✅ | **Zustand** | Randevu sihirbazının adım durumu (hizmet → personel → saat) |
| ✅ | ✅ | **Vitest** | Çakışma kuralı, çalışma saati, hizmet süresi testleri |
| ✅ | ✅ | **Playwright** | "Randevu al → onayla → listede gör" uçtan uca testi |
| ✅ | ⬜ | **GitHub Actions** | Her PR'da test ve tip kontrolü |
| ✅ | ⬜ | **Vercel** | Canlıya alma, canlı link |
| ✅ | ✅ | **date-fns** | Tarih hesapları, saat dilimi (yardımcı araç) |
| ✅ | ✅ | **zod** | Form ve uç nokta girdisinin doğrulanması (yardımcı araç) |
| ✅ | ⬜ | **E-posta gönderim servisi** (Resend) | Randevu onayı, iptal, hatırlatma e-postaları |
| ✅ | ⬜ | **Zamanlanmış iş** (Supabase zamanlayıcı) | 24 saat önceden hatırlatma, doğrulanmamış randevuyu düşürme |
| ✅ | ⬜ | **Captcha** (Cloudflare Turnstile) | Spam randevu koruması |

## 2. Karar bekleyenler (bu repo için)

Şu an yok.

## 3. Başka repolarda kullanılacaklar

| Kullanılacak | Yapıldı | Teknoloji | Hangi repo |
|:-:|:-:|---|---|
| ➖ | ⬜ | **React Native (Expo)** | Saha mobil (personel uygulaması) |
| ➖ | ⬜ | **Docker** | Hatırlatma ve rapor servisi, en sona |
| ➖ | ⬜ | **Grafik kütüphanesi** | KPI paneli |

## 4. Kullanılmayacaklar (bilinçli karar)

| Teknoloji | Neden |
|---|---|
| Angular, Vue, Flutter | Sonra öğrenilecek, bu proje React ile |
| C#, Python, Java | Şimdilik kapsam dışı |
| Cloud (AWS, Azure) | Şimdilik kapsam dışı |

## Kararlar

- Arayüz çerçevesi: **React + Next.js** (Angular değil).
- Veritabanı şeması (migration dosyaları): bu repoda durur, diğer repolar buradan okur.
- Örnek sektör: **kuaför / berber** (şema genel, deneme verisi kuaför).
