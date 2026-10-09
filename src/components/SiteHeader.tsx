import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Randevu
        </Link>
        <nav aria-label="Ana menü" className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link href="/randevularim" className="btn">
                Randevularım
              </Link>
              <Link href="/hesabim" className="btn hidden sm:inline-flex">
                Hesabım
              </Link>
            </>
          ) : (
            <Link href="/giris" className="btn">
              Giriş yap
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted">
        <p>Ücretsiz randevu sistemi. Ödeme yok, fiyatlar bilgi amaçlıdır.</p>
        <nav aria-label="Alt bağlantılar" className="flex gap-4">
          <Link href="/proje" className="underline underline-offset-2 hover:text-foreground">
            Proje hakkında
          </Link>
          <Link href="/gizlilik" className="underline underline-offset-2 hover:text-foreground">
            Gizlilik ve KVKK
          </Link>
        </nav>
      </div>
    </footer>
  );
}
