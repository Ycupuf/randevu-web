import { describe, expect, it } from "vitest";
import {
  createAppointmentSchema,
  fieldErrors,
  normalizePhoneTR,
  parseItemsParam,
  patchAppointmentSchema,
  slotQuerySchema,
  stringifyItemsParam,
} from "./schemas";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("normalizePhoneTR", () => {
  it.each([
    ["0532 123 45 67", "+905321234567"],
    ["532-123-4567", "+905321234567"],
    ["+90 532 123 45 67", "+905321234567"],
    ["905321234567", "+905321234567"],
    ["(0532) 123 45 67", "+905321234567"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhoneTR(input)).toBe(expected);
  });

  it.each(["", "abc", "0212 123 45 67", "532123456", "0532 123 45 678", "+1 415 555 0172"])(
    "geçersiz: %s",
    (input) => {
      expect(normalizePhoneTR(input)).toBeNull();
    },
  );
});

describe("createAppointmentSchema", () => {
  const valid = {
    businessId: UUID_A,
    items: [{ serviceId: UUID_B }],
    startsAt: "2026-10-12T07:00:00+03:00",
    customer: {
      fullName: "Elif Yılmaz",
      phone: "0532 123 45 67",
      email: "elif@ornek.com",
      kvkkAccepted: true,
    },
  };

  it("geçerli isteği kabul eder, telefonu normalleştirir, varsayılanları doldurur", () => {
    const parsed = createAppointmentSchema.parse(valid);
    expect(parsed.customer.phone).toBe("+905321234567");
    expect(parsed.resourceId).toBe("any");
    expect(parsed.fieldAnswers).toEqual({});
  });

  it("belirli bir kaynak (uuid) kabul eder", () => {
    const parsed = createAppointmentSchema.parse({ ...valid, resourceId: UUID_B });
    expect(parsed.resourceId).toBe(UUID_B);
  });

  it("KVKK onayı olmadan reddeder", () => {
    const result = createAppointmentSchema.safeParse({
      ...valid,
      customer: { ...valid.customer, kvkkAccepted: false },
    });
    expect(result.success).toBe(false);
  });

  it("geçersiz e-postayı reddeder", () => {
    const result = createAppointmentSchema.safeParse({
      ...valid,
      customer: { ...valid.customer, email: "elif@" },
    });
    expect(result.success).toBe(false);
  });

  it("hizmet seçilmediyse ve 5'ten fazla seçildiyse reddeder", () => {
    expect(createAppointmentSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    const six = Array.from({ length: 6 }, () => ({ serviceId: UUID_B }));
    expect(createAppointmentSchema.safeParse({ ...valid, items: six }).success).toBe(false);
  });

  it("zaman dilimsiz ya da bozuk zamanı reddeder", () => {
    expect(createAppointmentSchema.safeParse({ ...valid, startsAt: "2026-10-12 10:00" }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...valid, startsAt: "yarın" }).success).toBe(false);
  });

  it("çok uzun notu reddeder", () => {
    expect(createAppointmentSchema.safeParse({ ...valid, note: "a".repeat(501) }).success).toBe(false);
  });
});

describe("slotQuerySchema", () => {
  it("geçerli sorguyu kabul eder, kaynağı varsayılan 'any' yapar", () => {
    const parsed = slotQuerySchema.parse({
      businessId: UUID_A,
      items: [{ serviceId: UUID_B }],
      date: "2026-10-12",
    });
    expect(parsed.resourceId).toBe("any");
  });

  it("bozuk tarihi reddeder", () => {
    const result = slotQuerySchema.safeParse({
      businessId: UUID_A,
      items: [{ serviceId: UUID_B }],
      date: "12/10/2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("parseItemsParam / stringifyItemsParam", () => {
  it("hizmet ve varyantı ayrıştırır", () => {
    expect(parseItemsParam(`${UUID_A}:${UUID_B},${UUID_B}`)).toEqual([
      { serviceId: UUID_A, variantId: UUID_B },
      { serviceId: UUID_B, variantId: null },
    ]);
  });

  it("boş dizede boş liste döner", () => {
    expect(parseItemsParam("")).toEqual([]);
    expect(parseItemsParam("   ")).toEqual([]);
  });

  it("gidiş-dönüşte aynı değeri verir", () => {
    const items = [
      { serviceId: UUID_A, variantId: UUID_B },
      { serviceId: UUID_B, variantId: null },
    ];
    expect(parseItemsParam(stringifyItemsParam(items))).toEqual(items);
  });

  it("bozuk kimlik şema doğrulamasında reddedilir", () => {
    const result = slotQuerySchema.safeParse({
      businessId: UUID_A,
      items: parseItemsParam("bozuk-id"),
      date: "2026-10-12",
    });
    expect(result.success).toBe(false);
  });
});

describe("patchAppointmentSchema", () => {
  it("iptal ve taşıma isteklerini kabul eder", () => {
    expect(patchAppointmentSchema.safeParse({ action: "cancel" }).success).toBe(true);
    expect(
      patchAppointmentSchema.safeParse({ action: "reschedule", startsAt: "2026-10-12T10:00:00+03:00" }).success,
    ).toBe(true);
  });

  it("taşımada zaman olmadan ve bilinmeyen işlemi reddeder", () => {
    expect(patchAppointmentSchema.safeParse({ action: "reschedule" }).success).toBe(false);
    expect(patchAppointmentSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("hataları alan yoluna göre indirger", () => {
    const result = createAppointmentSchema.safeParse({
      businessId: UUID_A,
      items: [{ serviceId: UUID_B }],
      startsAt: "2026-10-12T07:00:00+03:00",
      customer: { fullName: "E", phone: "123", email: "x", kvkkAccepted: false },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors["customer.fullName"]).toBeTruthy();
      expect(errors["customer.phone"]).toBeTruthy();
      expect(errors["customer.email"]).toBeTruthy();
      expect(errors["customer.kvkkAccepted"]).toBeTruthy();
    }
  });
});
