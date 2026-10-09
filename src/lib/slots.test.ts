import { describe, expect, it } from "vitest";
import {
  getAvailableSlots,
  getAvailableSlotsForResources,
  type Interval,
  type SlotInput,
  type WorkingWindow,
} from "./slots";
import { formatLocalTime, localDateString } from "./time";

const TZ = "Europe/Istanbul";

// 12 Ekim 2026 Pazartesi. Türkiye sabit UTC+3 (yaz saati yok): yerel 09:00 = 06:00Z.
const MONDAY = "2026-10-12";
// Cuma 9 Ekim 2026, yerel 11:00
const FRIDAY_NOW = new Date("2026-10-09T08:00:00Z");

// Pazartesi 09:00-13:00 ve 14:00-19:00 (13:00-14:00 öğle arası)
const MONDAY_HOURS: WorkingWindow[] = [
  { weekday: 1, startTime: "09:00", endTime: "13:00" },
  { weekday: 1, startTime: "14:00", endTime: "19:00" },
];

/** Yerel saat aralığından Interval üretir (test okunurluğu için). */
function local(date: string, from: string, to: string): Interval {
  return {
    start: new Date(`${date}T${from}:00+03:00`),
    end: new Date(`${date}T${to}:00+03:00`),
  };
}

function base(overrides: Partial<SlotInput> = {}): SlotInput {
  return {
    date: MONDAY,
    timeZone: TZ,
    durationMin: 30,
    stepMin: 30,
    workingHours: MONDAY_HOURS,
    busy: [],
    now: FRIDAY_NOW,
    ...overrides,
  };
}

const times = (input: SlotInput) =>
  getAvailableSlots(input).map((s) => formatLocalTime(s.start, TZ));

describe("getAvailableSlots", () => {
  it("boş bir günde mesai içindeki tüm saatleri verir (öğle arası hariç)", () => {
    const result = times(base());
    expect(result).toHaveLength(18);
    expect(result[0]).toBe("09:00");
    expect(result.at(-1)).toBe("18:30");
    expect(result).not.toContain("13:00");
    expect(result).not.toContain("13:30");
    expect(result).toContain("12:30");
    expect(result).toContain("14:00");
  });

  it("kapanışa sığmayan hizmeti son saatlerden eler", () => {
    const result = times(base({ durationMin: 90 }));
    expect(result.at(-1)).toBe("17:30"); // 17:30 + 90 dk = 19:00
    expect(result).not.toContain("18:00");
    expect(result).not.toContain("12:00"); // 12:00 + 90 dk öğle arasına taşar
    expect(result).toContain("11:30"); // 11:30 + 90 dk = 13:00 tam sığar
  });

  it("dolu bir randevuyla çakışan saati eler, hemen yanındakileri bırakır", () => {
    const result = times(base({ busy: [local(MONDAY, "10:00", "10:30")] }));
    expect(result).not.toContain("10:00");
    expect(result).toContain("09:30"); // 10:00'da biter, ardışık olabilir
    expect(result).toContain("10:30"); // 10:30'da başlar, ardışık olabilir
  });

  it("uzun hizmetin başladığı saat dolu aralığa taşıyorsa eler", () => {
    const result = times(base({ durationMin: 60, busy: [local(MONDAY, "10:00", "10:30")] }));
    expect(result).not.toContain("09:30"); // 09:30-10:30, 10:00'daki randevuya taşar
    expect(result).toContain("09:00"); // 09:00-10:00 sığar
    expect(result).toContain("10:30");
  });

  it("hazırlık payını çakışmaya katar (blocks_until)", () => {
    const result = times(
      base({ bufferAfterMin: 15, busy: [local(MONDAY, "10:00", "10:30")] }),
    );
    expect(result).not.toContain("09:30"); // 09:30-10:00 + 15 dk pay = 10:15, çakışır
    expect(result).toContain("09:00"); // pay 09:45'te biter
  });

  it("mevcut randevunun kendi hazırlık payı (blocks_until) sonrası saati serbest bırakır", () => {
    // 10:00-10:30 randevu, blocks_until 10:45 olarak dolu aralığa yazılmış
    const result = times(base({ stepMin: 15, busy: [local(MONDAY, "10:00", "10:45")] }));
    expect(result).not.toContain("10:30");
    expect(result).toContain("10:45");
  });

  it("slot bilgisinde bitiş ve blocksUntil doğru hesaplanır", () => {
    const [first] = getAvailableSlots(base({ durationMin: 45, bufferAfterMin: 15 }));
    expect(formatLocalTime(first!.end, TZ)).toBe("09:45");
    expect(formatLocalTime(first!.blocksUntil, TZ)).toBe("10:00");
  });

  it("en erken randevu kuralını (minNoticeMin) uygular", () => {
    // Pazartesi yerel 09:30, min bildirim 60 dk → ilk uygun saat 10:30
    const result = times(base({ now: new Date("2026-10-12T06:30:00Z"), minNoticeMin: 60 }));
    expect(result[0]).toBe("10:30");
  });

  it("geçmiş saatleri vermez", () => {
    const result = times(base({ now: new Date("2026-10-12T14:00:00Z"), minNoticeMin: 0 })); // yerel 17:00
    expect(result[0]).toBe("17:00");
    expect(result).not.toContain("16:30");
  });

  it("izin zamanıyla kesişen saatleri eler", () => {
    const result = times(base({ timeOff: [local(MONDAY, "15:00", "17:00")] }));
    expect(result).toContain("14:30"); // 15:00'te biter
    expect(result).not.toContain("15:00");
    expect(result).not.toContain("16:30");
    expect(result).toContain("17:00");
  });

  it("çalışılmayan günde boş liste döner", () => {
    expect(times(base({ date: "2026-10-11" }))).toEqual([]); // Pazar
  });

  it("ufkun dışındaki ve geçmişteki günlerde boş liste döner", () => {
    expect(times(base({ date: "2026-11-30" }))).toEqual([]);
    expect(times(base({ date: "2026-10-08" }))).toEqual([]);
  });

  it("ufkun son gününü (30. gün) kabul eder", () => {
    const monday30 = "2026-11-09"; // 9 Ekim + 31 gün
    const workingHours: WorkingWindow[] = [{ weekday: 1, startTime: "09:00", endTime: "10:00" }];
    expect(times(base({ date: monday30, workingHours, horizonDays: 31 }))).toHaveLength(2);
    expect(times(base({ date: monday30, workingHours, horizonDays: 30 }))).toEqual([]);
  });

  it("gün sonu 24:00 ile biten mesaide son saati verir", () => {
    const result = times(
      base({
        durationMin: 60,
        stepMin: 60,
        workingHours: [{ weekday: 1, startTime: "20:00", endTime: "24:00" }],
      }),
    );
    expect(result).toEqual(["20:00", "21:00", "22:00", "23:00"]);
  });

  it("tüm slotlar seçilen yerel güne düşer", () => {
    for (const slot of getAvailableSlots(base())) {
      expect(localDateString(slot.start, TZ)).toBe(MONDAY);
    }
  });

  it("geçersiz süre veya adımda hata fırlatır", () => {
    expect(() => getAvailableSlots(base({ durationMin: 0 }))).toThrow(RangeError);
    expect(() => getAvailableSlots(base({ durationMin: 30.5 }))).toThrow(RangeError);
    expect(() => getAvailableSlots(base({ stepMin: 0 }))).toThrow(RangeError);
  });

  it("hiç çalışma saati yoksa boş liste döner", () => {
    expect(times(base({ workingHours: [] }))).toEqual([]);
  });
});

describe("getAvailableSlotsForResources", () => {
  const common = {
    date: MONDAY,
    timeZone: TZ,
    durationMin: 30,
    stepMin: 30,
    now: FRIDAY_NOW,
  };

  it("aynı saat birden fazla kaynakta uygunsa ilk kaynağa atar", () => {
    const slots = getAvailableSlotsForResources(
      [
        { resourceId: "ali", workingHours: MONDAY_HOURS, busy: [local(MONDAY, "09:00", "09:30")] },
        { resourceId: "burak", workingHours: MONDAY_HOURS, busy: [] },
      ],
      common,
    );
    const at = (hhmm: string) => slots.find((s) => formatLocalTime(s.start, TZ) === hhmm);
    expect(at("09:00")?.resourceId).toBe("burak"); // Ali dolu
    expect(at("09:30")?.resourceId).toBe("ali"); // ikisi de uygun, ilki seçilir
    expect(slots).toHaveLength(18); // mükerrer yok
  });

  it("hiçbir kaynak uygun değilse o saati göstermez", () => {
    const slots = getAvailableSlotsForResources(
      [
        { resourceId: "ali", workingHours: MONDAY_HOURS, busy: [local(MONDAY, "10:00", "10:30")] },
        { resourceId: "burak", workingHours: MONDAY_HOURS, busy: [local(MONDAY, "10:00", "10:30")] },
      ],
      common,
    );
    expect(slots.map((s) => formatLocalTime(s.start, TZ))).not.toContain("10:00");
  });

  it("farklı mesai saatli kaynakları birleştirir ve sıralar", () => {
    const slots = getAvailableSlotsForResources(
      [
        { resourceId: "gece", workingHours: [{ weekday: 1, startTime: "18:00", endTime: "20:00" }], busy: [] },
        { resourceId: "gunduz", workingHours: [{ weekday: 1, startTime: "09:00", endTime: "10:00" }], busy: [] },
      ],
      common,
    );
    expect(slots.map((s) => formatLocalTime(s.start, TZ))).toEqual([
      "09:00",
      "09:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
    ]);
  });
});

describe("adım hizalaması (veritabanı assert_bookable_start ile aynı kural)", () => {
  const hours = (startTime: string, endTime: string): WorkingWindow[] => [{ weekday: 1, startTime, endTime }];

  it("pencere adıma hizalı değilse ilk slot sonraki hizalı saattir (09:30 + 60 dk adım → 10:00)", () => {
    const result = times(base({ workingHours: hours("09:30", "13:00"), stepMin: 60, durationMin: 60 }));
    expect(result).toEqual(["10:00", "11:00", "12:00"]);
  });

  it("09:15 başlangıç, 30 dk adım → 09:30'dan başlar", () => {
    const result = times(base({ workingHours: hours("09:15", "11:30"), stepMin: 30, durationMin: 30 }));
    expect(result).toEqual(["09:30", "10:00", "10:30", "11:00"]);
  });

  it("hizalı pencere değişmez", () => {
    const result = times(base({ workingHours: hours("09:00", "11:00"), stepMin: 30, durationMin: 30 }));
    expect(result).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("ürettiği her başlangıç günün dakikasına göre adıma tam bölünür", () => {
    for (const [start, step] of [["09:10", 15], ["08:45", 20], ["10:05", 10], ["09:30", 60]] as const) {
      const slots = getAvailableSlots(base({ workingHours: hours(start, "18:00"), stepMin: step, durationMin: 15 }));
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) {
        const [h, m] = formatLocalTime(s.start, TZ).split(":").map(Number);
        expect((h * 60 + m) % step).toBe(0);
      }
    }
  });
});

