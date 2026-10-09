// İşletme adresi (slug): randevu.site/<slug>. Sitenin kendi sayfa adlarıyla çakışmamalı;
// çakışırsa `/giris` gibi bir işletme, sitenin giriş sayfasını gölgelerdi.
// Aynı liste veritabanında da kontrol edilir (businesses_slug_not_reserved).

export const RESERVED_SLUGS = [
  "giris",
  "kayit",
  "cikis",
  "randevularim",
  "hesabim",
  "gizlilik",
  "randevu",
  "api",
  "auth",
  "admin",
  "panel",
  "static",
  "assets",
  "public",
  "proje",
] as const;

export type SlugCheck = { ok: true; slug: string } | { ok: false; reason: string };

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** "Mehmet'in Berber Salonu" → "mehmetin-berber-salonu" */
export function slugify(input: string): string {
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (c) => TR_MAP[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Veritabanı kuralıyla aynı: 3-40 karakter, küçük harf/rakam/tire, ayrılmış olmayan. */
export function validateSlug(input: string): SlugCheck {
  const slug = input.trim();
  if (slug.length < 3) return { ok: false, reason: "En az 3 karakter olmalı." };
  if (slug.length > 40) return { ok: false, reason: "En fazla 40 karakter olabilir." };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, reason: "Yalnızca küçük harf, rakam ve tire kullan (örn. mehmet-berber)." };
  }
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return { ok: false, reason: "Bu ad sitenin kendi sayfalarına ayrılmış. Başka bir ad dene." };
  }
  return { ok: true, slug };
}
