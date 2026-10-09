import { addMinutes } from "./time";

export type ServiceLine = {
  durationMin: number;
  priceCents?: number;
  /** Bu hizmetten sonra gereken hazırlık/temizlik payı (dakika). */
  bufferAfterMin?: number;
};

export type ServiceSummary = {
  durationMin: number;
  priceCents: number;
  bufferAfterMin: number;
};

/**
 * Seçilen hizmetleri (varyant dahil) tek bir randevuya toplar: süreler ve fiyatlar toplanır,
 * hazırlık payı olarak satırlardaki EN BÜYÜK pay alınır (kaynak, tüm hizmetler bitince bir kez hazırlanır).
 */
export function summarizeServices(lines: ServiceLine[]): ServiceSummary {
  if (lines.length === 0) throw new RangeError("En az bir hizmet seçilmeli");
  return {
    durationMin: lines.reduce((sum, l) => sum + l.durationMin, 0),
    priceCents: lines.reduce((sum, l) => sum + (l.priceCents ?? 0), 0),
    bufferAfterMin: Math.max(...lines.map((l) => l.bufferAfterMin ?? 0)),
  };
}

/**
 * Müşteri randevusunu iptal edebilir / taşıyabilir mi?
 * Randevuya en az `windowMin` dakika varsa evet. Geçmiş randevu hiçbir zaman değiştirilemez.
 */
export function canModifyAppointment(input: {
  startsAt: Date;
  now: Date;
  windowMin: number;
}): boolean {
  const { startsAt, now, windowMin } = input;
  return startsAt.getTime() - now.getTime() >= windowMin * 60_000;
}

/** Müşteri başına aktif randevu sınırı: yeni randevu için hâlâ yer var mı? */
export function canBookMore(activeCount: number, maxActive: number): boolean {
  return activeCount < maxActive;
}

/** Veritabanındaki `blocks_until` değeri: bitiş + hazırlık payı. */
export function blocksUntil(endsAt: Date, bufferAfterMin: number): Date {
  return addMinutes(endsAt, bufferAfterMin);
}
