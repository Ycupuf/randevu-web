"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateOnlyLong, formatTime } from "@/lib/format";
import { localDateString } from "@/lib/time";
import { SlotPicker, type SlotDto } from "./SlotPicker";

type Props = {
  appointmentId: string;
  businessId: string;
  timeZone: string;
  horizonDays: number;
  itemsParam: string;
  resourceId: string;
};

type Mode = "idle" | "cancel" | "reschedule";

/** Randevuyu iptal etme ve başka saate taşıma. */
export function AppointmentActions({ appointmentId, businessId, timeZone, horizonDays, itemsParam, resourceId }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotDto | null>(null);

  async function patch(body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "İşlem yapılamadı. Tekrar dene.");
        if (res.status === 409) setSlot(null);
        return;
      }
      setMode("idle");
      router.refresh();
    } catch {
      setError("Bağlantı sorunu. İnternetini kontrol edip tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      {error && (
        <div role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => setMode("reschedule")}>
            Saati değiştir
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setMode("cancel")}>
            Randevuyu iptal et
          </button>
        </div>
      )}

      {mode === "cancel" && (
        <div className="card" role="group" aria-label="İptal onayı">
          <p className="font-medium">Randevuyu iptal etmek istediğine emin misin?</p>
          <p className="mt-1 text-sm text-muted">İptal edilen saat başkalarına açılır.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => patch({ action: "cancel" })}>
              {busy ? "İptal ediliyor…" : "Evet, iptal et"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setMode("idle")}>
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Yeni gün ve saat seç</h2>
          <SlotPicker
            businessId={businessId}
            timeZone={timeZone}
            horizonDays={horizonDays}
            itemsParam={itemsParam}
            resourceId={resourceId}
            date={date}
            onDateChange={(d) => {
              setDate(d);
              setSlot(null);
            }}
            selectedStart={slot?.start ?? null}
            onSelect={setSlot}
          />
          {slot && (
            <p className="mt-4 text-sm" aria-live="polite">
              Yeni zaman:{" "}
              <strong>
                {formatDateOnlyLong(localDateString(new Date(slot.start), timeZone))}, {formatTime(slot.start, timeZone)}
              </strong>
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!slot || busy}
              onClick={() => slot && patch({ action: "reschedule", startsAt: slot.start, resourceId: slot.resourceId })}
            >
              {busy ? "Kaydediliyor…" : "Saati değiştir"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setMode("idle")}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
