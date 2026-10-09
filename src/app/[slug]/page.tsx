import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/lib/booking/data";
import { summarizeOpeningHours } from "@/lib/booking/hours";
import { formatDuration, formatPhoneTR, formatPrice, sectorLabel, weekdayName } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicBusiness(slug);
  if (!data) return { title: "İşletme bulunamadı" };
  return {
    title: data.business.name,
    description:
      data.business.description ??
      `${data.business.name}: ${sectorLabel(data.business.sector)}. Online randevu al.`,
  };
}

export default async function BusinessPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const data = await getPublicBusiness(slug);
  if (!data) notFound();

  const { business, services, workingHours, settings } = data;
  const opening = summarizeOpeningHours(workingHours);
  const location = [business.address, business.city].filter(Boolean).join(", ");
  const mapsUrl = location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${location}`)}`
    : null;

  const byCategory = new Map<string, typeof services>();
  for (const s of services) {
    const key = s.category ?? "Diğer";
    byCategory.set(key, [...(byCategory.get(key) ?? []), s]);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: business.description ?? undefined,
    telephone: business.phone ?? undefined,
    address: location || undefined,
  };

  return (
    <article className="grid gap-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header>
        <p className="text-sm text-muted">{sectorLabel(business.sector)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{business.name}</h1>
        {business.description && <p className="mt-2 max-w-2xl text-lg text-muted">{business.description}</p>}
        <div className="mt-4">
          <Link href={`/${business.slug}/randevu`} className="btn btn-primary">
            Randevu al
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card" aria-labelledby="iletisim">
          <h2 id="iletisim" className="mb-2 font-semibold">
            İletişim
          </h2>
          {location && <p>{location}</p>}
          {mapsUrl && (
            <a className="text-sm underline underline-offset-2" href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Haritada aç
            </a>
          )}
          {business.phone && (
            <p className="mt-2">
              <a className="underline underline-offset-2" href={`tel:${business.phone.replace(/\s/g, "")}`}>
                {formatPhoneTR(business.phone)}
              </a>
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="saatler">
          <h2 id="saatler" className="mb-2 font-semibold">
            Çalışma saatleri
          </h2>
          {opening.length === 0 ? (
            <p className="text-muted">Çalışma saatleri henüz girilmemiş.</p>
          ) : (
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
              {opening.map((d) => (
                <div key={d.weekday} className="contents">
                  <dt className="text-muted">{weekdayName(d.weekday)}</dt>
                  <dd>
                    {d.open} – {d.close}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <section aria-labelledby="hizmetler">
        <h2 id="hizmetler" className="mb-3 text-xl font-semibold">
          {settings.service_label}ler
        </h2>
        {services.length === 0 ? (
          <p className="text-muted">Henüz {settings.service_label.toLowerCase()} eklenmemiş.</p>
        ) : (
          <div className="grid gap-5">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category}>
                {byCategory.size > 1 && <h3 className="mb-2 text-sm font-medium text-muted">{category}</h3>}
                <ul className="grid gap-2">
                  {list.map((s) => (
                    <li key={s.id} className="card p-3 sm:p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{s.name}</span>
                        {s.service_variants.length === 0 && formatPrice(s.price_cents) && (
                          <span className="shrink-0">{formatPrice(s.price_cents)}</span>
                        )}
                      </div>
                      {s.service_variants.length === 0 ? (
                        <p className="text-sm text-muted">{formatDuration(s.duration_min)}</p>
                      ) : (
                        <ul className="mt-1 grid gap-0.5 text-sm text-muted">
                          {s.service_variants.map((v) => (
                            <li key={v.id}>
                              {v.name}: {formatDuration(v.duration_min)}
                              {formatPrice(v.price_cents) ? `, ${formatPrice(v.price_cents)}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-muted">Fiyatlar bilgi amaçlıdır; ödeme işletmede yapılır.</p>
      </section>
    </article>
  );
}
