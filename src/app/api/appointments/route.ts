import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAppointmentSchema, fieldErrors } from "@/lib/schemas";
import { translateDbError } from "@/lib/errors";

// POST /api/appointments : giriş yapmış kullanıcı için randevu oluşturur.
// Asıl doğrulama (süre, çalışma saati, çakışma, limitler) veritabanındaki create_appointment fonksiyonundadır;
// burada yalnızca girdinin biçimi (zod) denetlenir.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: translateDbError({ message: "not_authenticated" }).message }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bilgilerini kontrol et.", fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_appointment", {
    p_business_id: input.businessId,
    p_starts_at: input.startsAt,
    p_items: input.items.map((i) => ({ service_id: i.serviceId, variant_id: i.variantId ?? null })),
    p_resource_id: input.resourceId === "any" ? undefined : input.resourceId,
    p_customer: {
      full_name: input.customer.fullName,
      phone: input.customer.phone,
      // İletişim e-postası, giriş yapılan adrestir; başka bir adresle taklit edilemez.
      email: user.email ?? input.customer.email,
    },
    p_field_answers: input.fieldAnswers,
    p_note: input.note,
  });

  if (error) {
    const info = translateDbError(error);
    return NextResponse.json({ error: info.message }, { status: info.status });
  }
  return NextResponse.json({ id }, { status: 201 });
}
