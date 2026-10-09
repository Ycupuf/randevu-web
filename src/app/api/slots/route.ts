import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { slotQuerySchema, parseItemsParam } from "@/lib/schemas";
import { summarizeServices, type ServiceLine } from "@/lib/rules";
import { getAvailableSlotsForResources, type ResourceAvailability } from "@/lib/slots";
import { addMinutes, zonedInstant } from "@/lib/time";
import { trimSeconds } from "@/lib/format";
import { translateDbError } from "@/lib/errors";

// GET /api/slots?businessId=...&items=hizmetId:varyantId,hizmetId2&date=2026-10-12&resourceId=any|<uuid>
// Seçilen hizmetler için o gündeki boş başlangıç saatlerini döndürür. Herkese açıktır (giriş gerekmez).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = slotQuerySchema.safeParse({
    businessId: sp.get("businessId"),
    items: parseItemsParam(sp.get("items") ?? ""),
    date: sp.get("date"),
    resourceId: sp.get("resourceId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { businessId, items, date, resourceId } = parsed.data;

  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, timezone, business_settings(*)")
    .eq("id", businessId)
    .eq("published", true)
    .maybeSingle();
  if (!business?.business_settings) {
    return NextResponse.json({ error: "İşletme bulunamadı." }, { status: 404 });
  }
  const settings = business.business_settings;

  // Hizmetler: süre ve fiyat veritabanından alınır, istemciye güvenilmez
  const serviceIds = items.map((i) => i.serviceId);
  if (new Set(serviceIds).size !== serviceIds.length) {
    return NextResponse.json({ error: "Aynı hizmeti iki kez seçemezsin." }, { status: 400 });
  }
  const { data: services } = await supabase
    .from("services")
    .select("id, duration_min, price_cents, buffer_after_min, service_variants(id, duration_min, price_cents)")
    .eq("business_id", businessId)
    .eq("active", true)
    .in("id", serviceIds);
  if (!services || services.length !== serviceIds.length) {
    return NextResponse.json({ error: translateDbError({ message: "service_not_found" }).message }, { status: 400 });
  }

  const lines: ServiceLine[] = [];
  for (const item of items) {
    const service = services.find((s) => s.id === item.serviceId)!;
    if (item.variantId) {
      const variant = service.service_variants.find((v) => v.id === item.variantId);
      if (!variant) {
        return NextResponse.json({ error: translateDbError({ message: "variant_not_found" }).message }, { status: 400 });
      }
      lines.push({ durationMin: variant.duration_min, priceCents: variant.price_cents ?? 0, bufferAfterMin: service.buffer_after_min });
    } else {
      if (service.service_variants.length > 0) {
        return NextResponse.json({ error: translateDbError({ message: "variant_required" }).message }, { status: 400 });
      }
      lines.push({ durationMin: service.duration_min, priceCents: service.price_cents ?? 0, bufferAfterMin: service.buffer_after_min });
    }
  }
  const summary = summarizeServices(lines);

  // Seçilen hizmetlerin hepsini yapabilen kaynaklar
  const { data: resources } = await supabase
    .from("resources")
    .select("id, resource_services(service_id)")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("sort")
    .order("created_at");
  const eligible = (resources ?? []).filter((r) => {
    const can = new Set(r.resource_services.map((rs) => rs.service_id));
    return serviceIds.every((id) => can.has(id)) && (resourceId === "any" || r.id === resourceId);
  });
  if (eligible.length === 0) {
    return NextResponse.json({ slots: [], summary });
  }
  const eligibleIds = eligible.map((r) => r.id);

  const timeZone = business.timezone;
  const dayStart = zonedInstant(date, "00:00", timeZone);
  const [{ data: hours }, { data: busy, error: busyError }] = await Promise.all([
    supabase
      .from("working_hours")
      .select("resource_id, weekday, start_time, end_time")
      .in("resource_id", eligibleIds),
    supabase.rpc("busy_slots", {
      p_resource_ids: eligibleIds,
      p_from: addMinutes(dayStart, -24 * 60).toISOString(),
      p_to: addMinutes(dayStart, 48 * 60).toISOString(),
    }),
  ]);
  if (busyError) {
    const info = translateDbError(busyError);
    return NextResponse.json({ error: info.message }, { status: info.status });
  }

  const availability: ResourceAvailability[] = eligibleIds.map((id) => ({
    resourceId: id,
    workingHours: (hours ?? [])
      .filter((h) => h.resource_id === id)
      .map((h) => ({ weekday: h.weekday, startTime: trimSeconds(h.start_time), endTime: trimSeconds(h.end_time) })),
    busy: (busy ?? [])
      .filter((b) => b.resource_id === id)
      .map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
  }));

  const slots = getAvailableSlotsForResources(availability, {
    date,
    timeZone,
    durationMin: summary.durationMin,
    bufferAfterMin: summary.bufferAfterMin,
    stepMin: settings.step_min,
    minNoticeMin: settings.min_notice_min,
    horizonDays: settings.horizon_days,
    now: new Date(),
  });

  return NextResponse.json({
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      resourceId: s.resourceId,
    })),
    summary,
  });
}
