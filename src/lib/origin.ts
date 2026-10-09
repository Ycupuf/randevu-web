/**
 * Durum değiştiren POST uçları (giriş, çıkış) yalnızca kendi sitemizden gelen isteği kabul eder.
 * Aksi halde üçüncü bir sayfa, ziyaretçinin tarayıcısına gizli bir form gönderttirip onu ortak demo hesabına
 * giriş yaptırabilir ya da oturumunu kapatabilir (login CSRF).
 *
 * Kural: `Sec-Fetch-Site` varsa "same-origin" ya da "none" (adres çubuğu) olmalı; yoksa `Origin` başlığının
 * sunucusu istek adresininkiyle aynı olmalı. İkisi de yoksa (sunucudan sunucuya çağrı, eski tarayıcı) kabul edilir:
 * tarayıcı CSRF'si bu başlıklardan en az birini her zaman taşır.
 */
export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
