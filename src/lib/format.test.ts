import { describe, expect, it } from "vitest";
import {
  formatDateOnlyLong,
  formatDayMonth,
  formatDuration,
  formatPhoneTR,
  formatPrice,
  formatTime,
  formatWeekdayShort,
  trimSeconds,
} from "./format";
import { translateDbError } from "./errors";

describe("formatPrice", () => {
  it("kuruşu liraya çevirir; tam liralarda kuruş göstermez", () => {
    expect(formatPrice(35000)).toMatch(/350/);
    expect(formatPrice(35050)).toMatch(/350,50/);
  });
  it("fiyat yoksa null döner", () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
  });
});

describe("formatDuration", () => {
  it.each([
    [30, "30 dk"],
    [60, "1 sa"],
    [90, "1 sa 30 dk"],
    [150, "2 sa 30 dk"],
  ])("%i dk → %s", (min, expected) => {
    expect(formatDuration(min)).toBe(expected);
  });
});

describe("formatTime", () => {
  it("UTC anını İstanbul saatinde 24 saat biçiminde gösterir", () => {
    expect(formatTime("2026-10-12T07:00:00Z")).toBe("10:00");
    expect(formatTime("2026-10-12T21:30:00Z")).toBe("00:30");
  });
});

describe("formatPhoneTR", () => {
  it("+90 numarayı okunur biçime çevirir", () => {
    expect(formatPhoneTR("+905321234567")).toBe("0532 123 45 67");
  });
  it("tanınmayan biçimi olduğu gibi bırakır, boşsa boş döner", () => {
    expect(formatPhoneTR("0262 000 00 01")).toBe("0262 000 00 01");
    expect(formatPhoneTR(null)).toBe("");
  });
});

describe("trimSeconds", () => {
  it("saniyeyi atar", () => {
    expect(trimSeconds("09:00:00")).toBe("09:00");
  });
});

describe("translateDbError", () => {
  it("bilinen anahtarı Türkçe mesaja ve duruma çevirir", () => {
    expect(translateDbError({ message: "slot_unavailable" })).toEqual({
      message: "Bu saat az önce doldu. Başka bir saat seç.",
      status: 409,
    });
    expect(translateDbError({ message: "not_authenticated" }).status).toBe(401);
  });

  it("bilinmeyen hatanın ayrıntısını kullanıcıya sızdırmaz", () => {
    const info = translateDbError({ message: 'relation "x" does not exist' });
    expect(info.status).toBe(500);
    expect(info.message).not.toContain("relation");
  });

  it("boş girdide güvenli varsayılana düşer", () => {
    expect(translateDbError(null).status).toBe(500);
    expect(translateDbError({ message: null }).status).toBe(500);
  });
});

describe("gün biçimleyicileri (saat dilimine bağlı değil)", () => {
  it("haftanın günü, gün-ay ve uzun biçim", () => {
    expect(formatWeekdayShort("2026-10-12")).toBe("Pzt");
    expect(formatDayMonth("2026-10-12")).toBe("12 Eki");
    expect(formatDateOnlyLong("2026-10-12")).toBe("12 Ekim 2026 Pazartesi");
  });
});
