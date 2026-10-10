// Oturum çerezi bayrakları.
//
// @supabase/ssr varsayılanı HttpOnly ve Secure koymaz (tarayıcı istemcisi çerezi okuyabilsin diye). Bu sitede
// tarayıcı istemcisi yalnızca giriş bağlantısı isteği için kullanılır, oturumu OKUMAZ: oturum çerezini yalnızca
// sunucu yazar ve okur. Bu yüzden oturum çerezi HttpOnly olabilir: sayfaya bir XSS girse bile JavaScript
// access/refresh token'ı çalamaz.
//
// Secure yalnızca production'da: yerelde http://localhost üzerinde bazı tarayıcılar Secure çereze izin vermez.

const secure = process.env.NODE_ENV === "production";

type CookieOptions = Record<string, unknown>;

/** Sunucunun yazdığı oturum çerezi için: HttpOnly + Secure + SameSite=Lax. */
export function hardenSessionCookie(options: CookieOptions | undefined): CookieOptions {
  return { ...options, httpOnly: true, secure, sameSite: "lax" };
}

/** Tarayıcının yazdığı çerezler (PKCE doğrulayıcısı) için: HttpOnly olamaz, ama Secure olabilir. */
export const BROWSER_COOKIE_OPTIONS = { secure, sameSite: "lax" as const };
