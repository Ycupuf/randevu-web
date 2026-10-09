import {
  DEFAULT_TIME_ZONE,
  addMinutes,
  daysBetween,
  localDateString,
  parseTimeString,
  weekdayOf,
  zonedInstant,
} from "./time";

/** Bir kaynağın haftalık çalışma aralığı. Aynı gün için birden fazla satır = mola. */
export type WorkingWindow = {
  /** 0 = Pazar ... 6 = Cumartesi */
  weekday: number;
  /** "09:00" */
  startTime: string;
  /** "19:00" (gün sonu için "24:00") */
  endTime: string;
};

/** Yarı açık zaman aralığı: [start, end). */
export type Interval = { start: Date; end: Date };

export type Slot = {
  start: Date;
  /** Hizmetin bitişi. */
  end: Date;
  /** Kaynağın tekrar müsait olacağı an (bitiş + hazırlık payı). Veritabanındaki `blocks_until`. */
  blocksUntil: Date;
};

export type SlotInput = {
  /** Gün, "2026-10-12" (işletmenin saat diliminde). */
  date: string;
  timeZone?: string;
  /** Seçilen tüm hizmetlerin toplam süresi (dakika). */
  durationMin: number;
  /** Son hizmetten sonra gereken hazırlık/temizlik payı (dakika). */
  bufferAfterMin?: number;
  /** Slot adımı (dakika). Varsayılan 15. */
  stepMin?: number;
  workingHours: WorkingWindow[];
  /** O kaynağın dolu aralıkları: mevcut randevuların [starts_at, blocks_until). */
  busy: Interval[];
  /** İzin / kapalı zamanlar. */
  timeOff?: Interval[];
  now: Date;
  /** En erken randevu: şu andan en az bu kadar dakika sonra. Varsayılan 60. */
  minNoticeMin?: number;
  /** En geç randevu: bugünden en fazla bu kadar gün sonrası. Varsayılan 30. */
  horizonDays?: number;
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/**
 * Tek bir kaynak için, seçilen gündeki uygun başlangıç saatlerini hesaplar.
 *
 * Bir saat uygundur eğer: çalışma aralığının içine sığıyorsa, izin ile kesişmiyorsa,
 * dolu bir aralıkla (hazırlık payı dahil) kesişmiyorsa, "en erken randevu" kuralını
 * sağlıyorsa ve gün, ufuk sınırının içindeyse.
 *
 * Not: hazırlık payının mesai bitişinden önce bitmesi gerekmez; hizmetin kendisi
 * mesaiye sığmalıdır.
 */
export function getAvailableSlots(input: SlotInput): Slot[] {
  const {
    date,
    timeZone = DEFAULT_TIME_ZONE,
    durationMin,
    bufferAfterMin = 0,
    stepMin = 15,
    workingHours,
    busy,
    timeOff = [],
    now,
    minNoticeMin = 60,
    horizonDays = 30,
  } = input;

  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    throw new RangeError("Süre pozitif bir tam sayı (dakika) olmalı");
  }
  if (!Number.isInteger(stepMin) || stepMin <= 0) {
    throw new RangeError("Slot adımı pozitif bir tam sayı (dakika) olmalı");
  }

  const dayOffset = daysBetween(localDateString(now, timeZone), date);
  if (dayOffset < 0 || dayOffset > horizonDays) return [];

  const weekday = weekdayOf(date, timeZone);
  const earliest = addMinutes(now, minNoticeMin);
  const slots: Slot[] = [];

  for (const window of workingHours) {
    if (window.weekday !== weekday) continue;
    const windowStart = zonedInstant(date, window.startTime, timeZone);
    const windowEnd = zonedInstant(date, window.endTime, timeZone);

    // Başlangıçlar günün dakikasına göre `stepMin`'e hizalıdır (veritabanı `assert_bookable_start` aynı kuralı ister).
    // Pencere 09:30'da başlayıp adım 60 ise ilk slot 10:00'dır; aksi halde sunduğumuz her saat veritabanında reddedilirdi.
    const { h, min } = parseTimeString(window.startTime);
    const misalignment = (h * 60 + min) % stepMin;
    const firstStart = misalignment === 0 ? windowStart : addMinutes(windowStart, stepMin - misalignment);

    for (
      let start = firstStart;
      addMinutes(start, durationMin).getTime() <= windowEnd.getTime();
      start = addMinutes(start, stepMin)
    ) {
      if (start.getTime() < earliest.getTime()) continue;
      const end = addMinutes(start, durationMin);
      const blocksUntil = addMinutes(end, bufferAfterMin);

      const hitsBusy = busy.some((b) => overlaps(start, blocksUntil, b.start, b.end));
      if (hitsBusy) continue;
      const hitsTimeOff = timeOff.some((t) => overlaps(start, end, t.start, t.end));
      if (hitsTimeOff) continue;

      slots.push({ start, end, blocksUntil });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type ResourceAvailability = {
  resourceId: string;
  workingHours: WorkingWindow[];
  busy: Interval[];
  timeOff?: Interval[];
};

export type ResourceSlot = Slot & { resourceId: string };

/**
 * Birden fazla kaynak için ("fark etmez" ya da otomatik atama) uygun saatleri birleştirir.
 * Aynı başlangıç saati birden fazla kaynakta uygunsa listedeki İLK kaynağa atanır.
 */
export function getAvailableSlotsForResources(
  resources: ResourceAvailability[],
  common: Omit<SlotInput, "workingHours" | "busy" | "timeOff">,
): ResourceSlot[] {
  const byStart = new Map<number, ResourceSlot>();
  for (const resource of resources) {
    const slots = getAvailableSlots({
      ...common,
      workingHours: resource.workingHours,
      busy: resource.busy,
      timeOff: resource.timeOff,
    });
    for (const slot of slots) {
      const key = slot.start.getTime();
      if (!byStart.has(key)) byStart.set(key, { ...slot, resourceId: resource.resourceId });
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
