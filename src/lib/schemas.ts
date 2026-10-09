import { z } from "zod";
import { isValidDateString } from "./time";

/**
 * Türkiye cep telefonunu "+905XXXXXXXXX" biçimine çevirir.
 * Kabul edilen yazımlar: "0532 123 45 67", "532-123-4567", "+90 532 123 45 67", "905321234567".
 * Sabit hatlar kabul edilmez (müşteri iletişimi cep telefonuyla yapılır). Geçersizse null.
 */
export function normalizePhoneTR(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^5\d{9}$/.test(digits)) return null;
  return `+90${digits}`;
}

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı")
  .refine(isValidDateString, "Böyle bir gün yok");

export const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhoneTR(value);
  if (normalized === null) {
    ctx.addIssue({ code: "custom", message: "Geçerli bir cep telefonu gir (örn. 0532 123 45 67)" });
    return z.NEVER;
  }
  return normalized;
});

export const customerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Adını ve soyadını gir")
    .max(80, "Ad en fazla 80 karakter olabilir"),
  phone: phoneSchema,
  email: z.email("Geçerli bir e-posta gir"),
  kvkkAccepted: z.literal(true, "Devam etmek için aydınlatma metnini onaylamalısın"),
});

/** Seçilen bir hizmet (ve varsa varyantı, örn. araç tipi). */
export const bookingItemSchema = z.object({
  serviceId: z.uuid(),
  variantId: z.uuid().nullish(),
});

/** Bir randevuya en fazla 5 hizmet eklenebilir. */
export const bookingItemsSchema = z
  .array(bookingItemSchema)
  .min(1, "En az bir hizmet seç")
  .max(5, "En fazla 5 hizmet seçilebilir");

/** Kaynak: belirli bir kaynak ya da "any" (fark etmez / otomatik atama). */
export const resourceChoiceSchema = z.union([z.uuid(), z.literal("any")]);

export const slotQuerySchema = z.object({
  businessId: z.uuid(),
  items: bookingItemsSchema,
  date: dateOnlySchema,
  resourceId: resourceChoiceSchema.default("any"),
});

export const createAppointmentSchema = z.object({
  businessId: z.uuid(),
  items: bookingItemsSchema,
  resourceId: resourceChoiceSchema.default("any"),
  startsAt: z.iso.datetime({ offset: true, message: "Geçerli bir randevu zamanı seç" }),
  /** Sektöre özel ekstra alanlar (plaka, alerji notu...). */
  fieldAnswers: z.record(z.string(), z.string().trim().max(200)).default({}),
  note: z.string().trim().max(500, "Not en fazla 500 karakter olabilir").optional(),
  customer: customerSchema,
});

export const patchAppointmentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("reschedule"),
    startsAt: z.iso.datetime({ offset: true, message: "Geçerli bir randevu zamanı seç" }),
    resourceId: z.uuid().optional(),
  }),
]);

export const dataRequestSchema = z.object({ kind: z.enum(["export", "delete"]) });

/**
 * Sorgu dizesindeki hizmet listesini ayrıştırır: "hizmetId:varyantId,hizmetId2".
 * Biçim bozuksa boş liste döner (şema doğrulaması "en az bir hizmet" diye reddeder).
 */
export function parseItemsParam(value: string): { serviceId: string; variantId: string | null }[] {
  if (!value.trim()) return [];
  return value.split(",").map((part) => {
    const [serviceId = "", variantId = ""] = part.trim().split(":");
    return { serviceId, variantId: variantId || null };
  });
}

/** Ters işlem: arayüzde sorgu dizesi üretmek için. */
export function stringifyItemsParam(items: { serviceId: string; variantId?: string | null }[]): string {
  return items.map((i) => (i.variantId ? `${i.serviceId}:${i.variantId}` : i.serviceId)).join(",");
}

/** Zod hatalarını form alanı adına göre ilk mesaja indirger: { "customer.email": "Geçerli bir e-posta gir" } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type SlotQuery = z.infer<typeof slotQuerySchema>;
export type PatchAppointmentInput = z.infer<typeof patchAppointmentSchema>;
