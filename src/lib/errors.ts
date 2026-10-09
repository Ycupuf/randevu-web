// Veritabanı fonksiyonları düz anahtar kelimelerle hata fırlatır (supabase/migrations/..._functions.sql).
// Buradan Türkçe mesaja ve HTTP durum koduna çevrilir. Bilinmeyen hata ayrıntısı kullanıcıya gösterilmez.

type ErrorInfo = { message: string; status: number };

const KNOWN: Record<string, ErrorInfo> = {
  not_authenticated: { message: "Devam etmek için giriş yapmalısın.", status: 401 },
  forbidden: { message: "Bu işlem için yetkin yok.", status: 403 },
  business_not_found: { message: "İşletme bulunamadı.", status: 404 },
  appointment_not_found: { message: "Randevu bulunamadı.", status: 404 },
  customer_not_found: { message: "Müşteri bulunamadı.", status: 404 },
  service_not_found: { message: "Seçtiğin hizmetlerden biri artık mevcut değil.", status: 400 },
  variant_not_found: { message: "Seçtiğin seçenek artık mevcut değil.", status: 400 },
  variant_required: { message: "Bu hizmet için bir seçenek (örn. araç tipi) seçmelisin.", status: 400 },
  duplicate_service: { message: "Aynı hizmeti iki kez seçemezsin.", status: 400 },
  invalid_items: { message: "En az bir, en fazla beş hizmet seçmelisin.", status: 400 },
  invalid_customer: { message: "Ad, telefon ve e-posta bilgilerini kontrol et.", status: 400 },
  field_required: { message: "Zorunlu alanları doldurmalısın.", status: 400 },
  invalid_time: { message: "Seçtiğin saat geçerli bir randevu saati değil.", status: 400 },
  too_soon: { message: "Bu saate çok az kaldı. Daha ileri bir saat seç.", status: 400 },
  too_far: { message: "Bu kadar ileri bir tarihe randevu alınamıyor.", status: 400 },
  slot_unavailable: { message: "Bu saat az önce doldu. Başka bir saat seç.", status: 409 },
  too_many_active: {
    message: "Aynı anda en fazla 3 aktif randevun olabilir. Önce birini iptal edebilirsin.",
    status: 409,
  },
  modify_window_passed: {
    message: "Randevuya çok az kaldığı için buradan değiştirilemiyor. Lütfen işletmeyi ara.",
    status: 409,
  },
  not_modifiable: { message: "Bu randevu artık değiştirilemez.", status: 409 },
  resource_not_found: { message: "Seçtiğin kişi ya da alan bulunamadı.", status: 400 },
  resource_cannot_perform: { message: "Seçtiğin kişi bu hizmetleri yapmıyor.", status: 400 },
  invalid_range: { message: "Geçersiz tarih aralığı.", status: 400 },
  invalid_transition: { message: "Randevunun durumu bu şekilde değiştirilemez.", status: 409 },
  too_early: { message: "Randevu zamanı gelmeden bu durum işaretlenemez.", status: 409 },
  slug_taken: { message: "Bu bağlantı adı alınmış. Başka bir ad dene.", status: 409 },
  demo_protected: {
    message: "Bu paylaşılan bir demo işletmesi: silme kapalı. Düzenleyebilirsin; demo girişinde her şey sıfırlanır.",
    status: 403,
  },
  business_limit: { message: "En fazla 5 işletme açabilirsin.", status: 409 },
};

const FALLBACK: ErrorInfo = {
  message: "Bir şey ters gitti. Biraz sonra tekrar dene.",
  status: 500,
};

/** Supabase hata nesnesindeki `message` anahtarını bilinen bir hataya çevirir. */
export function translateDbError(error: { message?: string | null } | null | undefined): ErrorInfo {
  const key = error?.message?.trim() ?? "";
  return KNOWN[key] ?? FALLBACK;
}

export function isKnownDbError(error: { message?: string | null } | null | undefined): boolean {
  return Boolean(error?.message && error.message.trim() in KNOWN);
}
