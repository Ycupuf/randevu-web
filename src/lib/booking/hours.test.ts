import { describe, expect, it } from "vitest";
import { summarizeOpeningHours } from "./hours";

const row = (weekday: number, start: string, end: string, resource = "r1") => ({
  resource_id: resource,
  weekday,
  start_time: start,
  end_time: end,
});

describe("summarizeOpeningHours", () => {
  it("öğle arası olan günde en erken açılış ve en geç kapanışı verir", () => {
    const result = summarizeOpeningHours([row(1, "09:00", "13:00"), row(1, "14:00", "19:00")]);
    expect(result).toEqual([{ weekday: 1, open: "09:00", close: "19:00" }]);
  });

  it("birden fazla kaynağın saatlerini birleştirir", () => {
    const result = summarizeOpeningHours([
      row(2, "10:00", "18:00", "a"),
      row(2, "09:00", "17:00", "b"),
    ]);
    expect(result).toEqual([{ weekday: 2, open: "09:00", close: "18:00" }]);
  });

  it("Pazartesi'den başlar, Pazar sona gelir, kapalı günleri atlar", () => {
    const result = summarizeOpeningHours([row(0, "10:00", "16:00"), row(6, "09:00", "13:00"), row(1, "09:00", "18:00")]);
    expect(result.map((r) => r.weekday)).toEqual([1, 6, 0]);
  });

  it("hiç saat yoksa boş liste döner", () => {
    expect(summarizeOpeningHours([])).toEqual([]);
  });
});
