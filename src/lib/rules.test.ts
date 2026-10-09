import { describe, expect, it } from "vitest";
import { blocksUntil, canBookMore, canModifyAppointment, summarizeServices } from "./rules";

describe("summarizeServices", () => {
  it("süreleri ve fiyatları toplar, en büyük hazırlık payını alır", () => {
    const result = summarizeServices([
      { durationMin: 30, priceCents: 35_000, bufferAfterMin: 5 },
      { durationMin: 60, priceCents: 50_000, bufferAfterMin: 15 },
    ]);
    expect(result).toEqual({ durationMin: 90, priceCents: 85_000, bufferAfterMin: 15 });
  });

  it("fiyat ve pay verilmediyse 0 sayar", () => {
    expect(summarizeServices([{ durationMin: 45 }])).toEqual({
      durationMin: 45,
      priceCents: 0,
      bufferAfterMin: 0,
    });
  });

  it("hizmet seçilmediyse hata fırlatır", () => {
    expect(() => summarizeServices([])).toThrow(RangeError);
  });
});

describe("canModifyAppointment", () => {
  const now = new Date("2026-10-12T10:00:00Z");

  it("randevuya pencereden fazla varsa izin verir", () => {
    expect(canModifyAppointment({ startsAt: new Date("2026-10-12T13:00:00Z"), now, windowMin: 120 })).toBe(true);
  });

  it("tam pencere sınırında izin verir", () => {
    expect(canModifyAppointment({ startsAt: new Date("2026-10-12T12:00:00Z"), now, windowMin: 120 })).toBe(true);
  });

  it("pencereden az kaldıysa izin vermez", () => {
    expect(canModifyAppointment({ startsAt: new Date("2026-10-12T11:00:00Z"), now, windowMin: 120 })).toBe(false);
  });

  it("geçmiş randevuya izin vermez", () => {
    expect(canModifyAppointment({ startsAt: new Date("2026-10-12T09:00:00Z"), now, windowMin: 0 })).toBe(false);
  });
});

describe("canBookMore", () => {
  it("limitin altındaysa true, limite ulaştıysa false", () => {
    expect(canBookMore(2, 3)).toBe(true);
    expect(canBookMore(3, 3)).toBe(false);
  });
});

describe("blocksUntil", () => {
  it("bitişe hazırlık payını ekler", () => {
    expect(blocksUntil(new Date("2026-10-12T07:30:00Z"), 15).toISOString()).toBe(
      "2026-10-12T07:45:00.000Z",
    );
  });
});
