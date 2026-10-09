import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

const base = {
  uid: "abc-123@randevu",
  start: new Date("2026-10-12T07:00:00Z"),
  end: new Date("2026-10-12T07:30:00Z"),
  summary: "Saç kesimi, Demo Berber",
  stamp: new Date("2026-10-09T10:00:00Z"),
};

describe("buildIcs", () => {
  it("geçerli bir takvim yapısı üretir (CRLF satır sonları)", () => {
    const ics = buildIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("END:VEVENT\r\n");
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });

  it("zamanları UTC biçiminde yazar", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("DTSTART:20261012T070000Z");
    expect(ics).toContain("DTEND:20261012T073000Z");
    expect(ics).toContain("DTSTAMP:20261009T100000Z");
  });

  it("virgül, noktalı virgül ve satır sonunu kaçırır", () => {
    const ics = buildIcs({ ...base, description: "Not: a;b\nikinci satır", location: "Cad. No:1, Gebze" });
    expect(ics).toContain("SUMMARY:Saç kesimi\\, Demo Berber");
    expect(ics).toContain("DESCRIPTION:Not: a\\;b\\nikinci satır");
    expect(ics).toContain("LOCATION:Cad. No:1\\, Gebze");
  });

  it("açıklama ve konum verilmezse bu alanları yazmaz", () => {
    const ics = buildIcs(base);
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:Not");
  });

  it("75 bayttan uzun satırları böler ve devam satırını boşlukla başlatır", () => {
    const long = "ğ".repeat(80); // her biri 2 bayt
    const ics = buildIcs({ ...base, summary: long });
    const lines = ics.split("\r\n");
    const encoder = new TextEncoder();
    expect(lines.every((l) => encoder.encode(l).length <= 75)).toBe(true);
    const summaryStart = lines.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(lines[summaryStart + 1]?.startsWith(" ")).toBe(true);
    // Bölünmüş satırlar birleştirilince metin bozulmamalı
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${long}`);
  });

  it("1 saat önce hatırlatıcı ekler", () => {
    expect(buildIcs(base)).toContain("TRIGGER:-PT1H");
  });
});
