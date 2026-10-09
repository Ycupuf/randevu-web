/**
 * Şimdiki zaman tek yerden alınır. Sunucu sayfalarında "şu an"a bağlı kararlar (yaklaşan randevu,
 * iptal penceresi) buradan okur; böylece React'in "render sırasında saf olmayan fonksiyon" kuralı
 * karşılanır ve zaman ileride testlerde kolayca sabitlenebilir.
 */
export function now(): Date {
  return new Date();
}
