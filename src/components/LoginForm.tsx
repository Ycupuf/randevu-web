"use client";

import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/browser";

const emailSchema = z.email("Geçerli bir e-posta gir");

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Geçerli bir e-posta gir");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: parsed.data.toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (authError) {
      setError(
        authError.status === 429
          ? "Kısa sürede çok fazla e-posta istendi. Birkaç dakika sonra tekrar dene."
          : "Giriş bağlantısı gönderilemedi. Tekrar dene.",
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="mt-6 rounded-lg bg-success-soft p-4 text-success">
        <p className="font-medium">E-postanı kontrol et</p>
        <p className="mt-1 text-sm">
          <strong>{email.trim()}</strong> adresine giriş bağlantısı gönderdik. Bağlantıya tıklayınca giriş yapmış
          olursun. Gelmediyse gereksiz (spam) klasörüne de bak.
        </p>
        <button type="button" className="btn mt-3" onClick={() => setSent(false)}>
          Farklı e-posta kullan
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
      <div>
        <label htmlFor="login-email" className="label">
          E-posta
        </label>
        <input
          id="login-email"
          className="input"
          type="email"
          autoComplete="email"
          placeholder="ad@ornek.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "login-email-err" : undefined}
        />
        {error && (
          <p id="login-email-err" className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Gönderiliyor…" : "Giriş bağlantısı gönder"}
      </button>
    </form>
  );
}
