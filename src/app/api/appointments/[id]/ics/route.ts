import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";
import { formatPhoneTR } from "@/lib/format";

// GET /api/appointments/:id/ics : randevuyu takvime eklemek için .ics dosyası döndürür.
// RLS'in görmesine izin verdiği kullanıcı indirebilir: randevunun müşterisi ile işletme sahibi/ilgili personeli.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/appointments/[id]/ics">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, business:businesses(name, address, city, phone), resource:resources(name), appointment_items(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!appointment || !appointment.business) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }

  const { business, resource, appointment_items: items } = appointment;
  const serviceNames = items.map((i) => i.name).join(", ");
  const description = [
    `Hizmet: ${serviceNames}`,
    resource ? `Randevu: ${resource.name}` : null,
    business.phone ? `Telefon: ${formatPhoneTR(business.phone)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const ics = buildIcs({
    uid: `${appointment.id}@randevu`,
    start: new Date(appointment.starts_at),
    end: new Date(appointment.ends_at),
    summary: `${business.name}: ${serviceNames}`,
    description,
    location: [business.address, business.city].filter(Boolean).join(", ") || undefined,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="randevu.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
