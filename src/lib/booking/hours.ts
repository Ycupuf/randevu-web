export type WorkingHourRow = {
  resource_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

/**
 * Haftanın her günü için, işletmedeki tüm kaynakların en erken açılış ve en geç kapanış saatini bulur.
 * İşletme sayfasında "Çalışma saatleri" özeti için kullanılır. Kapalı günler listede yoktur.
 */
export function summarizeOpeningHours(
  hours: WorkingHourRow[],
): { weekday: number; open: string; close: string }[] {
  const byDay = new Map<number, { open: string; close: string }>();
  for (const h of hours) {
    const current = byDay.get(h.weekday);
    if (!current) byDay.set(h.weekday, { open: h.start_time, close: h.end_time });
    else
      byDay.set(h.weekday, {
        open: h.start_time < current.open ? h.start_time : current.open,
        close: h.end_time > current.close ? h.end_time : current.close,
      });
  }
  // Pazartesi'den başlayarak sırala (Pazar = 0 sona)
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.filter((d) => byDay.has(d)).map((d) => ({ weekday: d, ...byDay.get(d)! }));
}
