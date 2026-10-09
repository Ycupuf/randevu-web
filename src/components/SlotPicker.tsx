"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDateOnlyLong, formatDayMonth, formatTime, formatWeekdayShort } from "@/lib/format";
import { addDays, daysBetween, localDateString } from "@/lib/time";

export type SlotDto = { start: string; end: string; resourceId: string };
type SlotsResponse = { slots: SlotDto[]; summary: { durationMin: number; priceCents: number } };

type Props = {
  businessId: string;
  timeZone: string;
  horizonDays: number;
  /** "hizmetId:varyantId,hizmetId2" biçiminde (bkz. stringifyItemsParam) */
  itemsParam: string;
  /** Belirli bir kaynak ya da "any" */
  resourceId: string;
  date: string | null;
  onDateChange: (date: string) => void;
  selectedStart: string | null;
  onSelect: (slot: SlotDto) => void;
};

async function fetchSlots(
  params: { businessId: string; itemsParam: string; resourceId: string; date: string },
  signal?: AbortSignal,
): Promise<SlotsResponse> {
  const qs = new URLSearchParams({
    businessId: params.businessId,
    items: params.itemsParam,
    resourceId: params.resourceId,
    date: params.date,
  });
  const res = await fetch(`/api/slots?${qs.toString()}`, { signal });
  const json = (await res.json().catch(() => ({}))) as Partial<SlotsResponse> & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Boş saatler yüklenemedi.");
  return json as SlotsResponse;
}

/** Gün seçimi (haftalık sayfalama) ve o günün boş saatleri. Hem randevu alırken hem taşırken kullanılır. */
export function SlotPicker({
  businessId,
  timeZone,
  horizonDays,
  itemsParam,
  resourceId,
  date,
  onDateChange,
  selectedStart,
  onSelect,
}: Props) {
  const queryClient = useQueryClient();
  // Bu bileşen yalnızca tarayıcıda çizilir (sihirbaz yüklendikten ya da bir düğmeye basıldıktan sonra),
  // bu yüzden "bugün" ilk çizimde güvenle hesaplanabilir.
  const [today] = useState(() => localDateString(new Date(), timeZone));
  const [weekOffset, setWeekOffset] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["slots", businessId, itemsParam, resourceId, date],
    queryFn: ({ signal }) => fetchSlots({ businessId, itemsParam, resourceId, date: date! }, signal),
    enabled: Boolean(date) && Boolean(itemsParam),
  });

  const weekStart = addDays(today, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const withinHorizon = (d: string) => daysBetween(today, d) <= horizonDays;
  const canGoNext = withinHorizon(addDays(weekStart, 7));

  async function findNextAvailableDay() {
    if (!date) return;
    setSearching(true);
    setSearchMessage(null);
    try {
      for (let i = 1; i <= 21; i++) {
        const candidate = addDays(date, i);
        if (!withinHorizon(candidate)) break;
        const result = await queryClient.fetchQuery({
          queryKey: ["slots", businessId, itemsParam, resourceId, candidate],
          queryFn: ({ signal }) => fetchSlots({ businessId, itemsParam, resourceId, date: candidate }, signal),
          staleTime: 15_000,
        });
        if (result.slots.length > 0) {
          onDateChange(candidate);
          setWeekOffset(Math.max(0, Math.floor(daysBetween(today, candidate) / 7)));
          return;
        }
      }
      setSearchMessage("Önümüzdeki günlerde uygun saat bulunamadı. İşletmeyi arayabilirsin.");
    } catch {
      setSearchMessage("Uygun gün aranırken bir sorun oluştu. Tekrar dene.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn"
          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          aria-label="Önceki hafta"
        >
          ←
        </button>
        <p className="text-sm text-muted" aria-live="polite">
          {formatDayMonth(days[0]!)} – {formatDayMonth(days[6]!)}
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={!canGoNext}
          aria-label="Sonraki hafta"
        >
          →
        </button>
      </div>

      <div className="mb-5 grid grid-cols-7 gap-1.5" role="group" aria-label="Gün seç">
        {days.map((d) => {
          const disabled = !withinHorizon(d);
          return (
            <button
              key={d}
              type="button"
              className="chip flex flex-col items-center px-1 text-xs"
              aria-pressed={date === d}
              disabled={disabled}
              onClick={() => onDateChange(d)}
              aria-label={formatDateOnlyLong(d)}
            >
              <span className="text-muted">{formatWeekdayShort(d)}</span>
              <span className="text-sm font-medium">{formatDayMonth(d)}</span>
            </button>
          );
        })}
      </div>

      {!date && <p className="text-muted">Önce bir gün seç.</p>}

      {date && query.isPending && <p className="text-muted">Boş saatler yükleniyor…</p>}

      {date && query.isError && (
        <div role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {query.error.message}{" "}
          <button type="button" className="underline" onClick={() => query.refetch()}>
            Tekrar dene
          </button>
        </div>
      )}

      {date && query.data && query.data.slots.length > 0 && (
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
          role="group"
          aria-label="Saat seç"
        >
          {query.data.slots.map((slot) => (
            <button
              key={slot.start}
              type="button"
              className="chip"
              aria-pressed={selectedStart === slot.start}
              onClick={() => onSelect(slot)}
            >
              {formatTime(slot.start, timeZone)}
            </button>
          ))}
        </div>
      )}

      {date && query.data && query.data.slots.length === 0 && (
        <div className="rounded-lg border border-border p-4">
          <p className="font-medium">Bu gün için uygun saat yok.</p>
          <p className="mt-1 text-sm text-muted">Başka bir gün seçebilir ya da en yakın boş günü aratabilirsin.</p>
          <button type="button" className="btn mt-3" onClick={findNextAvailableDay} disabled={searching}>
            {searching ? "Aranıyor…" : "En yakın boş günü bul"}
          </button>
          {searchMessage && (
            <p className="mt-2 text-sm text-danger" role="status">
              {searchMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
