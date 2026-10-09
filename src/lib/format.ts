import { DEFAULT_TIME_ZONE } from "./time";

const SECTOR_LABELS: Record<string, string> = {
  berber: "Kuaför / berber",
  guzellik: "Güzellik merkezi",
  oto_yikama: "Oto yıkama",
  diger: "Diğer",
};

export function sectorLabel(sector: string): string {
  return SECTOR_LABELS[sector] ?? "Diğer";
}

/** Kuruş cinsinden tutarı "350 ₺" gibi gösterir. Fiyat yoksa null. */
export function formatPrice(priceCents: number | null | undefined): string | null {
  if (priceCents === null || priceCents === undefined) return null;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
  }).format(priceCents / 100);
}

/** 90 → "1 sa 30 dk", 45 → "45 dk" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

export function formatDateLong(instant: Date | string, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(instant));
}

export function formatDateShort(instant: Date | string, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(instant));
}

export function formatTime(instant: Date | string, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(instant));
}

const WEEKDAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/** 0 = Pazar ... 6 = Cumartesi */
export function weekdayName(weekday: number): string {
  return WEEKDAYS_TR[weekday] ?? "";
}

/** "09:00:00" → "09:00" */
export function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

/** Etiketli telefonu "0532 123 45 67" biçimine çevirir (+905321234567 → 0532 123 45 67). */
export function formatPhoneTR(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = /^\+90(5\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/** "2026-10-12" gününü ("YYYY-AA-GG") saat dilimine bağlı kalmadan biçimler. */
function dateOnlyToInstant(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

/** "2026-10-12" → "Pzt" */
export function formatWeekdayShort(dateStr: string): string {
  return new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" }).format(dateOnlyToInstant(dateStr));
}

/** "2026-10-12" → "12 Eki" */
export function formatDayMonth(dateStr: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    dateOnlyToInstant(dateStr),
  );
}

/** "2026-10-12" → "12 Ekim 2026 Pazartesi" */
export function formatDateOnlyLong(dateStr: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
    timeZone: "UTC",
  }).format(dateOnlyToInstant(dateStr));
}
