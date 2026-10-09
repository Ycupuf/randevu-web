import { TZDate } from "@date-fns/tz";
import { addMinutes } from "date-fns";

export { addMinutes };

// Zaman kuralı: veritabanında UTC saklanır, işletmenin saat diliminde (varsayılan İstanbul)
// gösterilir ve hesaplanır. "Gün" ve "saat" hep o saat dilimine göredir.
export const DEFAULT_TIME_ZONE = "Europe/Istanbul";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-10-12" biçimindeki günü parçalar; geçersiz ya da var olmayan tarihte hata fırlatır. */
export function parseDateString(dateStr: string): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(dateStr);
  if (!match) throw new RangeError(`Geçersiz tarih biçimi: ${dateStr}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`Böyle bir gün yok: ${dateStr}`);
  }
  return { y, m, d };
}

/** "09:30" biçimindeki saati dakikaya çevirir. Gün sonu için "24:00" kabul edilir. */
export function parseTimeString(hhmm: string): { h: number; min: number } {
  const match = TIME_RE.exec(hhmm);
  if (!match) throw new RangeError(`Geçersiz saat biçimi: ${hhmm}`);
  const h = Number(match[1]);
  const min = Number(match[2]);
  const valid = (h <= 23 && min <= 59) || (h === 24 && min === 0);
  if (!valid) throw new RangeError(`Geçersiz saat: ${hhmm}`);
  return { h, min };
}

/** Verilen günün, verilen saat diliminde belirli bir yerel saatine denk gelen anı (UTC) döndürür. */
export function zonedInstant(dateStr: string, hhmm: string, timeZone: string): Date {
  const { y, m, d } = parseDateString(dateStr);
  const { h, min } = parseTimeString(hhmm);
  // 24:00 = ertesi günün 00:00'ı; TZDate taşan saati kendisi bir sonraki güne yazar.
  return new Date(new TZDate(y, m - 1, d, h, min, 0, 0, timeZone).getTime());
}

/** Günün haftanın hangi günü olduğu: 0 = Pazar, 1 = Pazartesi, ... 6 = Cumartesi (PostgreSQL `dow` ile aynı). */
export function weekdayOf(dateStr: string, timeZone: string): number {
  const { y, m, d } = parseDateString(dateStr);
  return new TZDate(y, m - 1, d, 12, 0, 0, 0, timeZone).getDay();
}

/** Bir anın, saat diliminde hangi yerel güne düştüğü ("2026-10-12"). */
export function localDateString(instant: Date, timeZone: string): string {
  const z = new TZDate(instant.getTime(), timeZone);
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`;
}

/** Bir anın saat diliminde "HH:mm" gösterimi. */
export function formatLocalTime(instant: Date, timeZone: string): string {
  const z = new TZDate(instant.getTime(), timeZone);
  return `${pad(z.getHours())}:${pad(z.getMinutes())}`;
}

/** İki gün arasındaki takvim günü farkı (b - a). */
export function daysBetween(aDate: string, bDate: string): number {
  const a = parseDateString(aDate);
  const b = parseDateString(bDate);
  const diff = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(diff / 86_400_000);
}

/** "2026-10-12" gününe n gün ekler (negatif de olur). Takvim günü hesabı, saat dilimine bağlı değildir. */
export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDateString(dateStr);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
