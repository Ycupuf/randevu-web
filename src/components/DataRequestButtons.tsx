"use client";

import { useState } from "react";

type Kind = "export" | "delete";

export function DataRequestButtons() {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function send(kind: Kind) {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch("/api/me/data-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; alreadyOpen?: boolean };
      if (!res.ok) {
        setMessage({ ok: false, text: json.error ?? "Talebin kaydedilemedi. Tekrar dene." });
        return;
      }
      setMessage({
        ok: true,
        text: json.alreadyOpen
          ? "Bu talebin zaten açık, işleme alınmayı bekliyor."
          : kind === "export"
            ? "Veri kopyası talebin alındı."
            : "Silme talebin alındı.",
      });
      setConfirmDelete(false);
    } catch {
      setMessage({ ok: false, text: "Bağlantı sorunu. Tekrar dene." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={busy !== null} onClick={() => send("export")}>
          {busy === "export" ? "Gönderiliyor…" : "Verilerimin kopyasını iste"}
        </button>
        {!confirmDelete && (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Hesabımı ve verilerimi sil
          </button>
        )}
      </div>

      {confirmDelete && (
        <div className="rounded-lg border border-danger p-3" role="group" aria-label="Silme onayı">
          <p className="text-sm">
            Silme talebi, hesabını ve bu hesaba bağlı randevu bilgilerini kaldırmak içindir. Bu işlem geri alınamaz. Devam
            edilsin mi?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-danger" disabled={busy !== null} onClick={() => send("delete")}>
              {busy === "delete" ? "Gönderiliyor…" : "Evet, silme talebi oluştur"}
            </button>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`rounded-lg p-3 text-sm ${message.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
