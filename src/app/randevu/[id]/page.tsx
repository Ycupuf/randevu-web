import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AppointmentActions } from "@/components/AppointmentActions";
import { StatusBadge } from "@/components/StatusBadge";
import { now as getNow } from "@/lib/clock";
import { formatDateLong, formatDuration, formatPhoneTR, formatPrice, formatTime } from "@/lib/format";
import { canModifyAppointment } from "@/lib/rules";
import { stringifyItemsParam } from "@/lib/schemas";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Randevu", robots: { index: false } };

export default async function AppointmentPage({ params, searchParams }: PageProps<"/randevu/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/randevu/${id}`)}`);

  const supabase = await createClient();
  const { data: a } = await supabase
    .from("appointments")
    .select(
      "id, business_id, resource_id, starts_at, ends_at, status, note, cancel_reason, cancelled_by, business:businesses(name, slug, address, city, phone, timezone, business_settings(cancel_window_min, horizon_days)), resource:resources(name), appointment_items(name, duration_min, price_cents, service_id, variant_id), customer:customers!inner(user_id)",
    )
    .eq("id", id)
    .eq("customer.user_id", user.id)
    .maybeSingle();

  if (!a || !a.business) notFound();

  const { business } = a;
  const tz = business.timezone;
  const settings = business.business_settings;
  const windowMin = settings?.cancel_window_min ?? 120;
  const active = a.status === "pending" || a.status === "confirmed";
  const now = getNow();
  const upcoming = new Date(a.ends_at).getTime() > now.getTime();
  const modifiable = active && canModifyAppointment({ startsAt: new Date(a.starts_at), now, windowMin });

  const totalMin = a.appointment_items.reduce((sum, i) => sum + i.duration_min, 0);
  const hasPrice = a.appointment_items.some((i) => i.price_cents !== null);
  const totalPrice = a.appointment_items.reduce((sum, i) => sum + (i.price_cents ?? 0), 0);
  const location = [business.address, business.city].filter(Boolean).join(", ");
  const itemsParam = stringifyItemsParam(
    a.appointment_items
      .filter((i) => i.service_id)
      .map((i) => ({ serviceId: i.service_id!, variantId: i.variant_id })),
  );

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      {query.yeni === "1" && (
        <div role="status" className="rounded-lg bg-success-soft p-4 text-success">
          <p className="font-medium">
            {a.status === "pending" ? "Randevu talebin alındı." : "Randevun alındı."}
          </p>
          <p className="mt-1 text-sm">
            {a.status === "pending"
              ? "İşletme onayladığında burada görünecek."
              : "Takvime ekleyebilir, istersen saatini değiştirebilirsin."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{business.name}</h1>
        <StatusBadge status={a.status} />
      </div>

      <div className="card">
        <dl className="grid gap-3 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted">Zaman</dt>
          <dd className="font-medium">
            {formatDateLong(a.starts_at, tz)}, {formatTime(a.starts_at, tz)} – {formatTime(a.ends_at, tz)}
          </dd>
          <dt className="text-muted">Hizmet</dt>
          <dd>
            <ul className="grid gap-1">
              {a.appointment_items.map((i, idx) => (
                <li key={idx}>
                  {i.name} <span className="text-muted">· {formatDuration(i.duration_min)}</span>
                </li>
              ))}
            </ul>
          </dd>
          {a.resource && (
            <>
              <dt className="text-muted">Kiminle</dt>
              <dd>{a.resource.name}</dd>
            </>
          )}
          <dt className="text-muted">Süre</dt>
          <dd>{formatDuration(totalMin)}</dd>
          {hasPrice && (
            <>
              <dt className="text-muted">Tutar</dt>
              <dd>
                {formatPrice(totalPrice)} <span className="text-muted">(ödeme işletmede)</span>
              </dd>
            </>
          )}
          {location && (
            <>
              <dt className="text-muted">Adres</dt>
              <dd>{location}</dd>
            </>
          )}
          {business.phone && (
            <>
              <dt className="text-muted">Telefon</dt>
              <dd>
                <a className="underline underline-offset-2" href={`tel:${business.phone.replace(/\s/g, "")}`}>
                  {formatPhoneTR(business.phone)}
                </a>
              </dd>
            </>
          )}
          {a.note && (
            <>
              <dt className="text-muted">Notun</dt>
              <dd>{a.note}</dd>
            </>
          )}
          {a.status === "cancelled" && (
            <>
              <dt className="text-muted">İptal</dt>
              <dd>
                {a.cancelled_by === "business" ? "İşletme iptal etti" : "Sen iptal ettin"}
                {a.cancel_reason ? `: ${a.cancel_reason}` : ""}
              </dd>
            </>
          )}
        </dl>
      </div>

      {active && upcoming && (
        <div className="grid gap-3">
          <a className="btn" href={`/api/appointments/${a.id}/ics`}>
            Takvime ekle
          </a>
          {modifiable ? (
            <AppointmentActions
              appointmentId={a.id}
              businessId={a.business_id}
              timeZone={tz}
              horizonDays={settings?.horizon_days ?? 30}
              itemsParam={itemsParam}
              resourceId={a.resource_id}
            />
          ) : (
            <p className="rounded-lg border border-border p-3 text-sm">
              Randevuna {formatDuration(windowMin)} ya da daha az kaldığı için buradan iptal edilemiyor veya
              değiştirilemiyor.{" "}
              {business.phone && (
                <>
                  Lütfen işletmeyi ara:{" "}
                  <a className="underline" href={`tel:${business.phone.replace(/\s/g, "")}`}>
                    {formatPhoneTR(business.phone)}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/randevularim" className="btn">
          Tüm randevularım
        </Link>
        <Link href={`/${business.slug}/randevu`} className="btn">
          Yeniden randevu al
        </Link>
      </div>
    </div>
  );
}
