import Link from "next/link";
import { listPublicBusinesses } from "@/lib/booking/data";
import { sectorLabel } from "@/lib/format";

export default async function Home() {
  const businesses = await listPublicBusinesses();

  return (
    <div className="grid gap-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Randevunu online al</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Kuaför, güzellik merkezi, oto yıkama ve daha fazlası. Hizmetini seç, boş saati gör, randevunu saniyeler içinde
          al. Telefon etmene, mesaj beklemene gerek yok.
        </p>
      </section>

      <section aria-labelledby="isletmeler">
        <h2 id="isletmeler" className="mb-3 text-xl font-semibold">
          İşletmeler
        </h2>
        {businesses.length === 0 ? (
          <p className="text-muted">Henüz yayında işletme yok.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {businesses.map((b) => (
              <li key={b.id}>
                <Link href={`/${b.slug}`} className="card block h-full transition-colors hover:bg-accent-soft">
                  <span className="text-sm text-muted">{sectorLabel(b.sector)}</span>
                  <span className="mt-1 block text-lg font-medium">{b.name}</span>
                  {b.city && <span className="block text-sm text-muted">{b.city}</span>}
                  {b.description && <span className="mt-2 block text-sm">{b.description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">İşletme sahibi misin?</h2>
        <p className="mt-1 text-muted">
          İşletmeni ücretsiz ekle, müşterilerin kendi başına randevu alsın. Takvim, müşteriler, hizmetler ve rapor işletme panelinde.
        </p>
        <p className="mt-3 flex flex-wrap gap-2">
          <a className="btn btn-primary" href={process.env.NEXT_PUBLIC_PANEL_URL ?? "https://randevu-panel-psi.vercel.app"}>
            İşletme paneline git
          </a>
          <Link className="btn" href="/proje">
            Proje hakkında
          </Link>
        </p>
      </section>
    </div>
  );
}
