/**
 * Giriş sonrası yönlendirme adresini güvenli hâle getirir (open redirect koruması).
 * Yalnızca site içi, "/" ile başlayan yollar kabul edilir; "//evil.com" ve "/\evil.com" gibi
 * tarayıcının başka siteye çevirebileceği biçimler reddedilir. Geçersizse varsayılana döner.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
