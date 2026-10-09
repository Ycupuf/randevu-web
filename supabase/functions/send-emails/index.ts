// Edge Function: email_outbox kuyruğunu boşaltır ve Resend ile gönderir.
//
// Kimlik doğrulama yok (verify_jwt kapalı) ve bilerek öyle: fonksiyon girdi almaz, yalnızca kuyruktaki
// kayıtları işler. Dışarıdan çağıran, olsa olsa bekleyen e-postaların biraz erken gitmesini sağlar.
// Çağıranlar: appointments/outbox tetikleyicileri ve pg_cron (bkz. migration 11-12).
//
// Ortam değişkenleri (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY  Resend API anahtarı. Yoksa e-postalar yine hazırlanır (veri yüklenir, şablon çizilir; hatalar
//                   kuyrukta görünür) ama 'skipped' olarak işaretlenir. Eski e-postalar sonradan toplu gitmez.
//   EMAIL_FROM      Örn. "Randevu <randevu@alanadin.com>". Varsayılan: Resend test adresi (yalnızca hesap sahibine gider).
//   SITE_URL        Müşteri sitesi adresi (müşteri e-postalarındaki bağlantılar).
//   PANEL_URL       İşletme paneli adresi (işletme e-postalarındaki bağlantı).
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik verilir.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildEmail,
  buildOwnerEmail,
  type BuiltEmail,
  type EmailContext,
  type EmailKind,
  type OutboxKind,
} from "./templates.ts";

type OutboxRow = {
  id: string;
  kind: OutboxKind;
  appointment_id: string;
  to_email: string;
  payload: { cancelled_by?: string | null; previous_starts_at?: string } | null;
  attempts: number;
};

type Business = {
  name: string; slug: string; address: string | null; city: string | null; phone: string | null; timezone: string;
};

const MAX_ATTEMPTS = 3;
const DEFAULT_FROM = "Randevu <onboarding@resend.dev>";
const DEFAULT_SITE = "https://randevu-web-delta.vercel.app";
const DEFAULT_PANEL = "https://randevu-panel-psi.vercel.app";

// Bu durumdaki randevu için hangi e-posta türleri hâlâ anlamlı? (Kuyrukta bekleyen e-posta bayatlamış olabilir.)
const VALID_STATUS: Record<OutboxKind, string[]> = {
  received: ["pending"],
  booked: ["confirmed"],
  confirmed: ["confirmed"],
  cancelled: ["cancelled"],
  rescheduled: ["pending", "confirmed"],
  reminder: ["confirmed"],
  owner_new: ["pending", "confirmed"],
  owner_cancelled: ["cancelled"],
};

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "supabase_env_missing" }, 500);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || DEFAULT_FROM;
  const siteUrl = (Deno.env.get("SITE_URL") || DEFAULT_SITE).replace(/\/$/, "");
  const panelUrl = (Deno.env.get("PANEL_URL") || DEFAULT_PANEL).replace(/\/$/, "");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: rows, error } = await supabase.rpc("claim_pending_emails", { p_limit: 20 });
  if (error) return json({ error: error.message }, 500);

  const result = { sent: 0, skipped: 0, failed: 0, retry: 0 };

  for (const row of (rows ?? []) as OutboxRow[]) {
    const finish = (patch: Record<string, unknown>) => supabase.from("email_outbox").update(patch).eq("id", row.id);

    const retryOrFail = async (reason: string) => {
      if (row.attempts >= MAX_ATTEMPTS) {
        await finish({ status: "failed", error: reason });
        result.failed++;
      } else {
        // Üstel bekleme: 1, 2, 4 dakika
        const delayMin = 2 ** (row.attempts - 1);
        await finish({
          status: "pending",
          error: reason,
          send_after: new Date(Date.now() + delayMin * 60_000).toISOString(),
        });
        result.retry++;
      }
    };

    try {
      const { data: a } = await supabase
        .from("appointments")
        .select(
          "id, status, starts_at, ends_at, note, cancel_reason, field_answers, business_id, businesses(name, slug, address, city, phone, timezone), resources(name), customers(full_name, phone, email), appointment_items(name, price_cents)",
        )
        .eq("id", row.appointment_id)
        .maybeSingle();

      if (!a) {
        await finish({ status: "skipped", error: "appointment_gone" });
        result.skipped++;
        continue;
      }
      const stale =
        !VALID_STATUS[row.kind].includes(a.status) ||
        (row.kind === "reminder" && new Date(a.starts_at).getTime() < Date.now());
      if (stale) {
        await finish({ status: "skipped", error: "stale" });
        result.skipped++;
        continue;
      }

      const business = a.businesses as unknown as Business;
      const customer = a.customers as unknown as { full_name: string; phone: string | null; email: string | null } | null;
      const resourceName = (a.resources as unknown as { name: string } | null)?.name ?? "";
      const services = (a.appointment_items as unknown as { name: string; price_cents: number | null }[]) ?? [];

      let mail: BuiltEmail;
      if (row.kind === "owner_new" || row.kind === "owner_cancelled") {
        // Ek form cevaplarının (plaka vb.) etiketlerini işletmenin soru listesinden al
        const { data: fields } = await supabase.from("booking_fields").select("key, label").eq("business_id", a.business_id);
        const labels = new Map((fields ?? []).map((f: { key: string; label: string }) => [f.key, f.label]));
        const answers = Object.entries((a.field_answers ?? {}) as Record<string, unknown>)
          .filter(([, v]) => typeof v === "string" && v.trim() !== "")
          .map(([k, v]) => ({ label: labels.get(k) ?? k, value: String(v) }));
        mail = buildOwnerEmail({
          appointmentId: a.id,
          event: row.kind === "owner_cancelled" ? "cancelled" : "new",
          cancelReason: a.cancel_reason,
          pending: a.status === "pending",
          business,
          customer: { name: customer?.full_name ?? "", phone: customer?.phone ?? null, email: customer?.email ?? null },
          resourceName,
          services,
          startsAt: a.starts_at,
          endsAt: a.ends_at,
          timeZone: business.timezone,
          note: a.note,
          answers,
          panelUrl,
        });
      } else {
        const ctx: EmailContext = {
          kind: row.kind as EmailKind,
          appointmentId: a.id,
          customerName: customer?.full_name ?? "",
          business,
          resourceName,
          services,
          startsAt: a.starts_at,
          endsAt: a.ends_at,
          timeZone: business.timezone,
          previousStartsAt: row.payload?.previous_starts_at,
          cancelledBy: row.payload?.cancelled_by ?? null,
          siteUrl,
        };
        mail = buildEmail(ctx);
      }

      // E-posta hazır. Anahtar yoksa gönderme: ama veri yükleme ve şablon çizme yukarıda zaten sınandı.
      if (!resendKey) {
        await finish({ status: "skipped", error: "resend_not_configured" });
        result.skipped++;
        continue;
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          // Aynı kayıt iki kez gönderilirse Resend ikinciyi yok sayar (yeniden denemede çift e-posta olmasın)
          "Idempotency-Key": row.id,
        },
        body: JSON.stringify({ from, to: [row.to_email], subject: mail.subject, html: mail.html, text: mail.text }),
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        await finish({ status: "sent", sent_at: new Date().toISOString(), provider_id: body?.id ?? null, error: null });
        result.sent++;
      } else if (res.status === 429 || res.status >= 500) {
        await retryOrFail(`resend_${res.status}`);
      } else {
        // 4xx: yanlış adres, doğrulanmamış alan adı vb. Yeniden denemek işe yaramaz.
        const detail = (await res.text()).slice(0, 300);
        await finish({ status: "failed", error: `resend_${res.status}: ${detail}` });
        result.failed++;
      }
    } catch (e) {
      await retryOrFail(`exception: ${String(e).slice(0, 200)}`);
    }
  }

  return json(result, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
