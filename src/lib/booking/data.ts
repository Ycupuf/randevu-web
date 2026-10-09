import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { trimSeconds } from "@/lib/format";
import type { WorkingHourRow } from "@/lib/booking/hours";

export type { WorkingHourRow };

export type ServiceWithVariants = Tables<"services"> & {
  service_variants: Tables<"service_variants">[];
};

export type ResourceWithServices = Tables<"resources"> & {
  resource_services: { service_id: string }[];
};

export type BusinessPublic = {
  business: Tables<"businesses">;
  settings: Tables<"business_settings">;
  services: ServiceWithVariants[];
  resources: ResourceWithServices[];
  fields: Tables<"booking_fields">[];
  workingHours: WorkingHourRow[];
};

/** Herkese açık bir işletmeyi, randevu almak için gereken tüm bilgisiyle yükler. Yayında değilse null. */
export const getPublicBusiness = cache(async (slug: string): Promise<BusinessPublic | null> => {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("businesses")
    .select("*, business_settings(*)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!row || !row.business_settings) return null;
  const { business_settings: settings, ...business } = row;

  const [services, resources, fields] = await Promise.all([
    supabase
      .from("services")
      .select("*, service_variants(*)")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort"),
    supabase
      .from("resources")
      .select("*, resource_services(service_id)")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort"),
    supabase.from("booking_fields").select("*").eq("business_id", business.id).order("sort"),
  ]);

  const resourceList = resources.data ?? [];
  const resourceIds = resourceList.map((r) => r.id);
  const { data: hours } = resourceIds.length
    ? await supabase
        .from("working_hours")
        .select("resource_id, weekday, start_time, end_time")
        .in("resource_id", resourceIds)
    : { data: [] as WorkingHourRow[] };

  return {
    business,
    settings,
    services: (services.data ?? []).map((s) => ({
      ...s,
      service_variants: [...s.service_variants].sort((a, b) => a.sort - b.sort),
    })),
    resources: resourceList,
    fields: fields.data ?? [],
    workingHours: (hours ?? []).map((h) => ({
      ...h,
      start_time: trimSeconds(h.start_time),
      end_time: trimSeconds(h.end_time),
    })),
  };
});

export async function listPublicBusinesses(): Promise<Tables<"businesses">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("published", true)
    .order("created_at");
  return data ?? [];
}
