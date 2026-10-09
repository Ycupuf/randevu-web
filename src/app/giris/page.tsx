import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { safeNext } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Giriş yap", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const query = await searchParams;
  const next = safeNext(typeof query.next === "string" ? query.next : null, "/randevularim");
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">Giriş yap</h1>
      <p className="mt-2 text-muted">
        Şifre yok. E-posta adresini yaz, sana bir giriş bağlantısı gönderelim. İlk girişte hesabın otomatik açılır.
      </p>
      {query.hata === "baglanti" && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">
          Giriş bağlantısı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste.
        </p>
      )}
      <LoginForm next={next} />
    </div>
  );
}
