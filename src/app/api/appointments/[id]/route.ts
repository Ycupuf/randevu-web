import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { patchAppointmentSchema } from "@/lib/schemas";
import { translateDbError } from "@/lib/errors";
import { dbErrorResponse } from "@/lib/api";

// PATCH /api/appointments/:id : randevuyu iptal eder ya da başka bir saate taşır.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/appointments/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }

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
  const parsed = patchAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const supabase = await createClient();
  const input = parsed.data;
  const { error } =
    input.action === "cancel"
      ? await supabase.rpc("cancel_appointment", { p_id: id, p_reason: input.reason })
      : await supabase.rpc("reschedule_appointment", {
          p_id: id,
          p_new_starts_at: input.startsAt,
          p_resource_id: input.resourceId,
        });

  if (error) return dbErrorResponse(error);
  return NextResponse.json({ ok: true });
}
