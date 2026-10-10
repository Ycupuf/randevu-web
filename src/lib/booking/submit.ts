// Randevu sihirbazının ağ işleri: randevu gönderimi ve giriş bağlantısı isteği.
// Bileşenden ayrıldı ki hata eşlemeleri (409 çakışma, 429 e-posta sınırı vb.) ekran çizmeden test edilebilsin.

import type { WizardData } from "./store";

export type SubmitResult =
  | { ok: true; id: string }
  /** `slotTaken`: seçilen saat başkasına gitti; arayüz saat adımına dönmeli. */
  | { ok: false; error: string; slotTaken: boolean };

/** Ek form cevaplarından boşları atar, değerleri kırpar. */
export function buildAnswers(fields: { key: string }[], fieldAnswers: Record<string, string>): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const f of fields) {
    const value = fieldAnswers[f.key]?.trim();
    if (value) answers[f.key] = value;
  }
  return answers;
}

type SubmitInput = {
  businessId: string;
  wizard: Pick<WizardData, "items" | "resourceId" | "slot" | "fieldAnswers" | "note" | "customer" | "kvkk">;
  fields: { key: string }[];
};

export async function submitAppointment(input: SubmitInput, doFetch: typeof fetch = fetch): Promise<SubmitResult> {
  const { wizard: s } = input;
  if (!s.slot) return { ok: false, error: "Önce bir saat seç.", slotTaken: true };
  try {
    const res = await doFetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: input.businessId,
        items: s.items,
        resourceId: s.resourceId,
        startsAt: s.slot.start,
        fieldAnswers: buildAnswers(input.fields, s.fieldAnswers),
        note: s.note || undefined,
        customer: { ...s.customer, kvkkAccepted: s.kvkk },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string; code?: string };
    if (!res.ok || !json.id) {
      return {
        ok: false,
        error: json.error ?? "Randevu alınamadı. Tekrar dene.",
        slotTaken: res.status === 409 && json.code === "slot_unavailable",
      };
    }
    return { ok: true, id: json.id };
  } catch {
    return { ok: false, error: "Bağlantı sorunu. İnternetini kontrol edip tekrar dene.", slotTaken: false };
  }
}

type OtpClient = {
  auth: {
    signInWithOtp(args: {
      email: string;
      options: { emailRedirectTo: string };
    }): Promise<{ error: { status?: number } | null }>;
  };
};

export type LoginLinkResult = { ok: true } | { ok: false; error: string };

/** Giriş bağlantısı ister. Bağlantıya tıklayınca sihirbaz `?tamamla=1` ile kayıtlı seçimleri otomatik tamamlar. */
export async function requestLoginLink(
  args: { email: string; slug: string; origin: string },
  client: OtpClient,
): Promise<LoginLinkResult> {
  const next = `/${args.slug}/randevu?tamamla=1`;
  const { error } = await client.auth.signInWithOtp({
    email: args.email.trim().toLowerCase(),
    options: { emailRedirectTo: `${args.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (!error) return { ok: true };
  return {
    ok: false,
    error:
      error.status === 429
        ? "Kısa sürede çok fazla e-posta istendi. Birkaç dakika sonra tekrar dene."
        : "Giriş bağlantısı gönderilemedi. E-posta adresini kontrol edip tekrar dene.",
  };
}
