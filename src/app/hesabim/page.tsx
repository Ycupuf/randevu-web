import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DataRequestButtons } from "@/components/DataRequestButtons";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hesabım", robots: { index: false } };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=%2Fhesabim");

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="text-2xl font-semibold">Hesabım</h1>

      <section className="card">
        <p className="text-sm text-muted">Giriş yapılan e-posta</p>
        <p className="mt-1 font-medium">{user.email}</p>
        <form action="/auth/signout" method="post" className="mt-4">
          <button type="submit" className="btn">
            Çıkış yap
          </button>
        </form>
      </section>

      <section className="card" aria-labelledby="kvkk">
        <h2 id="kvkk" className="font-semibold">
          Verilerin
        </h2>
        <p className="mt-1 text-sm text-muted">
          KVKK kapsamında verilerinin bir kopyasını isteyebilir ya da hesabının ve verilerinin silinmesini talep
          edebilirsin. Talebin kaydedilir. Bu bir demo projesidir: talepler henüz otomatik işlenmez, gerçek bir işletmede bir yönetici tarafından ele alınması gerekir.
        </p>
        <DataRequestButtons />
      </section>
    </div>
  );
}
