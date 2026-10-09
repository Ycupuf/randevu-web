import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { now as getNow } from "@/lib/clock";
import { formatDateLong, formatTime } from "@/lib/format";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Randevularım", robots: { index: false } };

export default async function MyAppointmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=%2Frandevularim");

  const supabase = await createClient();
  // Yalnızca kullanıcının KENDİ müşteri kaydına ait randevular (işletme sahibi de olsa).
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, business:businesses(name, slug, timezone), resource:resources(name), appointment_items(name), customer:customers!inner(user_id)",
    )
    .eq("customer.user_id", user.id)
    .order("starts_at", { ascending: true });

  const now = getNow().getTime();
  const all = data ?? [];
  const upcoming = all.filter(
    (a) => new Date(a.ends_at).getTime() >= now && (a.status === "pending" || a.status === "confirmed"),
  );
  const past = all
    .filter((a) => !upcoming.includes(a))
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  const renderList = (list: typeof all) => (
    <ul className="grid gap-3">
      {list.map((a) => {
        const tz = a.business?.timezone ?? "Europe/Istanbul";
        return (
          <li key={a.id}>
            <Link href={`/randevu/${a.id}`} className="card block transition-colors hover:bg-accent-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.business?.name}</span>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-1">
                {formatDateLong(a.starts_at, tz)}, {formatTime(a.starts_at, tz)}
              </p>
              <p className="text-sm text-muted">
                {a.appointment_items.map((i) => i.name).join(", ")}
                {a.resource ? ` · ${a.resource.name}` : ""}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-semibold">Randevularım</h1>

      <section aria-labelledby="yaklasan">
        <h2 id="yaklasan" className="mb-3 text-lg font-semibold">
          Yaklaşan
        </h2>
        {upcoming.length === 0 ? (
          <div className="card">
            <p>Yaklaşan randevun yok.</p>
            <Link href="/" className="btn btn-primary mt-3">
              Randevu al
            </Link>
          </div>
        ) : (
          renderList(upcoming)
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="gecmis">
          <h2 id="gecmis" className="mb-3 text-lg font-semibold">
            Geçmiş ve iptal edilenler
          </h2>
          {renderList(past)}
        </section>
      )}
    </div>
  );
}
