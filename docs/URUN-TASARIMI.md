# Ürün Tasarımı: Çok Sektörlü Randevu Sistemi (ücretsiz)

Durum: **onaylandı (13. bölümdeki 7 karar öneriler doğrultusunda kabul edildi).** Güncel tasarım bu belgedir. `DESIGN.md` ilk çekirdek taslaktı.

## 1. İlkeler

1. **Ücretsiz ve ödemesiz.** Online ödeme, kapora yok. Fiyatlar bilgi amaçlıdır, ödeme işletmede yapılır. SMS ve WhatsApp yok (maliyet); bildirim e-posta ile.
2. **Her sektöre uyan tek model.** Sektörler farklı kelimeler kullanır ama aynı üç kavramdan oluşur: **hizmet** (ne yapılacak), **kaynak** (kim/ne yapacak: personel, yıkama bayı, oda) ve **zaman**.
3. **Veritabanı çakışmayı garanti eder.** Kod kontrolü yetmez.
4. **Mobil öncelikli.** Müşterilerin çoğu telefondan gelecek.
5. **Kullanılabilir sistem = müşteri tarafı + işletme tarafı.** İşletme sahibi randevuları göremiyor/yönetemiyorsa sistem kullanılamaz. Bu yüzden işletme paneli v1'in parçasıdır (ayrı repo, aynı veritabanı).

## 2. Aktörler

| aktör | kim | ne yapar |
|---|---|---|
| **Müşteri** | işletmenin müşterisi | randevu alır, değiştirir, iptal eder |
| **İşletme sahibi (owner)** | kuaför, salon, yıkama sahibi | işletmeyi kurar, hizmet/kaynak/saat tanımlar, takvimi yönetir |
| **Personel (staff)** | çalışan | kendi takvimini görür, randevuyu "geldi / gelmedi / tamamlandı" işaretler |
| **Platform yöneticisi** | biz | kötüye kullanımı denetler (v2) |

## 3. Sektör şablonları

Aynı şema, farklı etiket ve varsayılanlar. İşletme kurulurken sektör seçilir, hizmetler ve etiketler **hazır gelir**, sahibi düzenler.

| kavram | Kuaför / berber | Güzellik merkezi | Oto yıkama |
|---|---|---|---|
| Kaynak etiketi | Personel | Uzman | Yıkama bayı |
| Kaynak seçimi | müşteri seçer ya da "fark etmez" | müşteri seçer ya da "fark etmez" | **otomatik atanır** (müşteri bay seçmez) |
| Hizmet örnekleri | kesim, sakal, boya | manikür, cilt bakımı, lazer, kaş | dış yıkama, iç temizlik, detaylı |
| Hizmet varyantı | , | bazen (bölge: kol/bacak) | **evet: araç tipi** (otomobil / SUV / ticari), süre ve fiyat değişir |
| Çoklu hizmet | sık (kesim + sakal) | **çok sık** (manikür + pedikür) | sık (dış + iç) |
| Hazırlık/temizlik payı | kısa | orta (oda hazırlığı) | kısa |
| Müşteriden ekstra bilgi | not | **hassasiyet/alerji** notu | **plaka**, araç modeli |
| Tipik süre | 20-90 dk | 15-120 dk | 30-180 dk |

Etiketler ve ekstra alanlar sektör şablonundan gelir, kodda sektöre özel `if` yazılmaz.

## 4. Müşteri akışı (baştan sona)

```
Bulma ─▶ İşletme sayfası ─▶ Hizmet(ler) ─▶ Kaynak ─▶ Gün/saat ─▶ Bilgiler ─▶ E-posta doğrulama ─▶ Onay ─▶ Hatırlatma ─▶ Ziyaret ─▶ (Değişiklik / İptal)
```

| adım | ekran | ayrıntı ve uç durumlar |
|---|---|---|
| 1. Bulma | Bağlantı / QR kod | `site.com/mehmet-berber`. İşletme bağlantıyı Instagram'a, vitrine QR olarak koyar. Arama motorunda çıkar (SEO) |
| 2. İşletme sayfası | Bilgi + hizmet listesi | Ad, adres, harita bağlantısı, telefon, çalışma saatleri, hizmet listesi (süre, fiyat), "Randevu al" |
| 3. Hizmet seçimi | Çoklu seçim | Bir ya da birden fazla hizmet (toplam süre ve tutar gösterilir). Varyant varsa seç (araç tipi) |
| 4. Kaynak seçimi | Liste | Sektöre göre: kişi seç / "fark etmez" / **atla (otomatik)**. Sadece seçilen hizmetleri yapabilenler gösterilir |
| 5. Gün ve saat | Takvim + saat kutuları | Dolu, geçmiş, kapalı günler ve izinler gösterilmez. Saat yoksa "en yakın boş gün" önerilir. Gün sayısı sınırlı (30) |
| 6. Bilgiler | Form | Ad soyad, telefon, e-posta (zod ile doğrulanır). Sektör alanları (plaka, alerji), not. KVKK aydınlatma onayı |
| 7. E-posta doğrulama | Sihirli bağlantı | Şifre yok. Bağlantıya tıklayınca hesap açılır ve randevu kesinleşir. Doğrulanmayan randevu 15 dk sonra düşer |
| 8. Onay | Özet ekranı | Randevu özeti, **takvime ekle (.ics)**, harita, iptal/değiştir bağlantısı. İşletme "manuel onay" seçtiyse durum "onay bekliyor" |
| 9. Hatırlatma | E-posta | 24 saat önce: tarih, adres, iptal bağlantısı |
| 10. Değiştirme | Aynı sihirbaz | Mevcut randevu **tek akışta** yeni saate taşınır. Yeni saat doluysa eskisi korunur |
| 11. İptal | Onay penceresi | İptal penceresi geçtiyse (varsayılan 2 saat) "işletmeyi arayın" mesajı. İptal edilen saat hemen yeniden açılır |
| 12. Randevularım | Liste | Yaklaşan ve geçmiş randevular, tekrar al ("yeniden randevu") |

**Hata durumları (hepsi ekranda ele alınır):** saat az önce doldu, oturum süresi doldu, geçersiz e-posta, işletme kapalı, seçilen hizmeti kimse yapamıyor, internet koptu.

## 5. İşletme akışı

### 5.1 Kurulum (ilk kullanım, 5 dakikada)

1. Hesap aç (e-posta sihirli bağlantı).
2. **Sektör seç** (kuaför / güzellik / oto yıkama / diğer). Hazır hizmet ve etiketler gelir.
3. İşletme bilgileri: ad, adres, telefon, **bağlantı adı** (`mehmet-berber`).
4. Kaynakları ekle (personel / bay / oda), her birinin yapabildiği hizmetleri işaretle.
5. Çalışma saatleri (haftalık, öğle arası dahil).
6. Kuralları onayla (varsayılanlar gelir).
7. **Yayına al**: bağlantı ve QR kodu al.

### 5.2 Günlük kullanım

| iş | ekran |
|---|---|
| Günün/haftanın randevularını görmek | **Takvim** (gün/hafta görünümü, kaynak sütunları) |
| Telefonla veya yüz yüze gelen müşteriyi eklemek | **Manuel randevu** (hesap gerekmez) |
| Randevuyu onaylamak / reddetmek | Onay bekleyenler listesi (manuel onay modunda) |
| Randevu durumu | geldi, **gelmedi**, tamamlandı |
| Randevuyu taşımak/iptal etmek | Takvimden sürükle ya da düğmeyle (müşteriye e-posta gider) |
| İzin ve kapalı gün | Tatil, hastalık, özel gün; saat bloklama |
| Müşteriler | Liste, geçmiş randevular, **özel notlar**, gelmeme sayısı |
| Ayarlar | Hizmet, kaynak, saat, kurallar, e-posta metinleri |
| Basit rapor | Haftalık randevu sayısı, en çok istenen hizmet, doluluk, gelmeme oranı |

## 6. Özellik envanteri (unutulmaması için)

**v1 = olmazsa kullanılamaz. v2 = sonra. Dışı = bilerek yok.**

| özellik | v1 | v2 | dışı |
|---|:-:|:-:|:-:|
| İşletme sayfası, QR/bağlantı, SEO | ✅ | | |
| Sektör şablonları (3 sektör) | ✅ | | |
| Çoklu hizmet, hizmet varyantı (araç tipi) | ✅ | | |
| Kaynak seçimi: seç / fark etmez / otomatik | ✅ | | |
| Boş saat hesabı (çalışma saati, mola, izin, hazırlık payı) | ✅ | | |
| Çakışma garantisi (veritabanı) | ✅ | | |
| Sihirli bağlantı ile giriş | ✅ | | |
| Randevu alma / değiştirme / iptal | ✅ | | |
| Takvime ekle (.ics) | ✅ | | |
| E-posta: onay, iptal, değişiklik, hatırlatma | ✅ | | |
| Manuel randevu (telefon/yüz yüze) | ✅ | | |
| Takvim görünümü (gün/hafta) | ✅ | | |
| Gelmedi/geldi/tamamlandı | ✅ | | |
| Müşteri listesi ve notları | ✅ | | |
| İzin ve kapalı gün yönetimi | ✅ | | |
| Manuel onay modu | ✅ | | |
| Sektöre özel ekstra alanlar (plaka, alerji) | ✅ | | |
| KVKK: aydınlatma, silme/dışa aktarma talebi | ✅ | | |
| Kötüye kullanım koruması (hız sınırı, captcha) | ✅ | | |
| Basit rapor (KPI) | ✅ | | |
| Bekleme listesi (iptal olursa haber ver) | | ✅ | |
| Tekrarlayan randevu | | ✅ | |
| Değerlendirme/yorum | | ✅ | |
| Çok dilli (İngilizce) | | ✅ | |
| Personel mobil uygulaması | | ✅ | |
| Platform yönetici paneli | | ✅ | |
| Online ödeme / kapora | | | ❌ |
| SMS / WhatsApp bildirimi | | | ❌ (maliyet) |

## 7. İş kuralları (işletme ayarlarından değişir, varsayılanlar)

| kural | varsayılan |
|---|---|
| Slot adımı | 15 dk |
| En erken randevu (min bildirim) | 60 dk sonrası |
| En geç randevu (ufuk) | 30 gün |
| İptal / değiştirme penceresi | randevuya 2 saatten fazla varsa |
| Müşteri başına aktif randevu | 3 |
| Onay modu | otomatik (isteğe bağlı manuel) |
| Hazırlık/temizlik payı (hizmet başına) | 0-15 dk |
| Gelmedi sayısı uyarısı | 3 gelmedide işletmeye uyarı, otomatik engel yok |

Not: Türkiye'de yaz saati uygulaması yok (sabit UTC+3), ama zaman yine **UTC saklanıp** İstanbul saatinde gösterilir.

## 8. Veri modeli

| tablo | önemli alanlar |
|---|---|
| `businesses` | `id`, `slug` (benzersiz), `name`, `sector`, `address`, `phone`, `timezone`, `published` |
| `business_settings` | `step_min`, `min_notice_min`, `horizon_days`, `cancel_window_min`, `approval_mode`, `resource_selection` (`customer` / `any` / `auto`), `max_active_per_customer` |
| `business_members` | `business_id`, `user_id`, `role` (`owner` / `staff`) |
| `services` | `business_id`, `name`, `description`, `category`, `buffer_after_min`, `active`, `sort` |
| `service_variants` | `service_id`, `name` (otomobil, SUV), `duration_min`, `price_cents` (bilgi), `sort` |
| `resources` | `business_id`, `name`, `kind` (`person` / `bay` / `room`), `member_user_id` (boş olabilir), `active` |
| `resource_services` | `resource_id`, `service_id` |
| `working_hours` | `resource_id`, `weekday`, `start_time`, `end_time` (bir gün için birden fazla satır = mola) |
| `time_off` | `business_id`, `resource_id` (boş = tüm işletme), `starts_at`, `ends_at`, `reason` |
| `booking_fields` | `business_id`, `key`, `label`, `type`, `required` (plaka, alerji) |
| `customers` | `business_id`, `user_id`, `full_name`, `phone`, `email`, `notes` (işletmenin özel notu), `no_show_count` |
| `appointments` | `business_id`, `customer_id`, `resource_id`, `starts_at`, `ends_at`, **`blocks_until`**, `status`, `source` (`online` / `manual`), `field_answers` (json), `note`, `cancelled_by`, `cancel_reason` |
| `appointment_items` | `appointment_id`, `service_id`, `variant_id`, `duration_min`, `price_cents` |

Durumlar: `pending` (onay/doğrulama bekliyor), `confirmed`, `cancelled`, `completed`, `no_show`.

**Çakışma kuralı:** aynı kaynakta `pending` ve `confirmed` randevuların `[starts_at, blocks_until)` aralıkları kesişemez (`EXCLUDE USING gist`). `blocks_until` = bitiş + hazırlık payı, böylece temizlik süresi de çakışma sayılır.

## 9. Erişim kuralları (RLS)

| veri | kim ne yapar |
|---|---|
| İşletme sayfası, hizmet, kaynak, çalışma saati | **herkes okur**, sadece sahibi yazar |
| Randevu | müşteri kendi randevusunu; personel kendi kaynağının randevularını; sahibi işletmesininkileri |
| Müşteri listesi ve notlar | **yalnız işletme üyeleri** (müşteri görmez) |
| Dolu saatler | herkes **yalnız zaman aralığını** görür (kimin olduğunu değil), `busy_slots` fonksiyonu ile |
| Başka işletmenin verisi | **hiç kimse** (kiracı izolasyonu) |

## 10. Bildirimler

| olay | kime | ne |
|---|---|---|
| Doğrulama | müşteri | sihirli bağlantı |
| Randevu alındı / onaylandı / reddedildi | müşteri | özet + .ics + iptal bağlantısı |
| Yeni randevu | işletme | bildirim e-postası |
| Hatırlatma (24 saat önce) | müşteri | tarih, adres, iptal bağlantısı |
| Değişiklik / iptal | karşı taraf | ne değişti |

## 11. Güvenlik, gizlilik, kötüye kullanım

- **KVKK:** aydınlatma metni, açık rıza kutusu, "verilerimi sil/indir" talebi, minimum veri (ad, telefon, e-posta).
- **Spam randevu:** IP başına hız sınırı, captcha, doğrulanmamış randevunun 15 dakikada düşmesi, müşteri başına aktif randevu sınırı.
- **Girdi doğrulama:** her uç noktada `zod`.
- **Anahtarlar:** hiçbir gizli anahtar depoya girmez.

## 12. Repolar

| repo | içerik | ne zaman |
|---|---|---|
| `randevu-web` (bu repo) | Müşteri web + **veritabanı şeması** | önce |
| `randevu-panel` | İşletme paneli (kurulum, takvim, müşteriler, ayarlar, rapor) | sonra, **v1'in parçası** |
| `randevu-mobil` | Personel uygulaması (Expo) | v2 |
| `randevu-bildirim` | Hatırlatma/e-posta servisi (Node + Docker) | gerekince |

## 13. Kararlar (hepsi kabul edildi)

1. **Misafir randevu:** v1'de hesap (sihirli bağlantı) zorunlu mu? Öneri: evet, spam'i azaltır.
2. **Manuel onay modu** v1'de olsun mu? Öneri: evet, küçük iş.
3. **Çoklu hizmet** v1'de olsun mu? Öneri: evet (güzellik için şart).
4. **Hatırlatma e-postası** için zamanlanmış iş gerekiyor: Supabase zamanlayıcı mı, ayrı Node servisi mi? Öneri: önce Supabase.
5. **E-posta gönderim servisi:** ücretsiz kotalı bir servis (örn. Resend) listeye eklensin mi?
6. **Captcha** servisi (örn. Cloudflare Turnstile, ücretsiz) listeye eklensin mi?
7. **Repo düzeni:** tek repo zorunlu değil, birden fazla repo serbest. Asıl soru, ortak parçaların (veritabanı şeması, boş saat hesabı, zod şemaları) nerede duracağı. İki yol:
   - **A) Şema + belgeler `randevu-web`'de, diğer repolar buradan okur.** Kurulumu hafif, başlangıç için uygun. Ortak kod gerekirse kopyalanır.
   - **B) Ayrı `randevu-core` reposu** (belgeler, şema, ortak TypeScript kodu), üç uygulama onu kullanır. Daha derli toplu, ama ortak kodu paylaşmak için paket yayınlama bilgisi ister.
   - Öneri: **A ile başla**, ortak kod gerçekten üç yerde gerekince B'ye taşı.
