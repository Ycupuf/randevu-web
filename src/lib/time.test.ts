import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatLocalTime,
  isValidDateString,
  localDateString,
  parseDateString,
  weekdayOf,
  zonedInstant,
} from "./time";

const TZ = "Europe/Istanbul";

describe("zonedInstant", () => {
  it("İstanbul 09:00'u UTC 06:00 olarak verir (UTC+3)", () => {
    expect(zonedInstant("2026-10-12", "09:00", TZ).toISOString()).toBe("2026-10-12T06:00:00.000Z");
  });

  it("24:00'ı ertesi günün başlangıcı sayar", () => {
    expect(zonedInstant("2026-10-12", "24:00", TZ).toISOString()).toBe("2026-10-12T21:00:00.000Z");
  });

  it("geçersiz saatte hata fırlatır", () => {
    expect(() => zonedInstant("2026-10-12", "25:00", TZ)).toThrow(RangeError);
    expect(() => zonedInstant("2026-10-12", "9:00", TZ)).toThrow(RangeError);
  });
});

describe("parseDateString", () => {
  it("var olmayan günü reddeder", () => {
    expect(() => parseDateString("2026-02-30")).toThrow(RangeError);
    expect(() => parseDateString("12-10-2026")).toThrow(RangeError);
  });
});

describe("weekdayOf", () => {
  it("12 Ekim 2026 Pazartesi (1), 11 Ekim Pazar (0)", () => {
    expect(weekdayOf("2026-10-12", TZ)).toBe(1);
    expect(weekdayOf("2026-10-11", TZ)).toBe(0);
    expect(weekdayOf("2026-10-17", TZ)).toBe(6);
  });
});

describe("localDateString ve formatLocalTime", () => {
  it("UTC gece yarısına yakın bir anı İstanbul gününe doğru yerleştirir", () => {
    const instant = new Date("2026-10-11T22:30:00Z"); // İstanbul'da 12 Ekim 01:30
    expect(localDateString(instant, TZ)).toBe("2026-10-12");
    expect(formatLocalTime(instant, TZ)).toBe("01:30");
  });
});

describe("daysBetween", () => {
  it("takvim günü farkını hesaplar", () => {
    expect(daysBetween("2026-10-09", "2026-10-12")).toBe(3);
    expect(daysBetween("2026-10-12", "2026-10-09")).toBe(-3);
    expect(daysBetween("2026-10-09", "2026-11-08")).toBe(30);
  });
});

describe("addDays", () => {
  it("ay ve yıl sınırlarını doğru aşar", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("artık yılı bilir", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("daysBetween ile tutarlıdır", () => {
    expect(daysBetween("2026-10-09", addDays("2026-10-09", 17))).toBe(17);
  });
});

describe("isValidDateString", () => {
  it("var olan günü kabul eder, var olmayan günü ve bozuk biçimi reddeder", () => {
    expect(isValidDateString("2026-10-12")).toBe(true);
    expect(isValidDateString("2028-02-29")).toBe(true); // artık yıl
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2026-02-31")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("0000-00-00")).toBe(false);
    expect(isValidDateString("12-10-2026")).toBe(false);
    expect(isValidDateString("")).toBe(false);
  });
});
