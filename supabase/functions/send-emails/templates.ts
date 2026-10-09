// Randevu e-postası şablonları. Saf işlevler: ağ ve veritabanı yok, bu yüzden Vitest ile test edilir
// (templates.test.ts). Edge Function (index.ts) yalnızca veriyi toplar ve buradan çıkan metni gönderir.

// Müşteriye giden e-posta türleri
export type EmailKind = "received" | "booked" | "confirmed" | "cancelled" | "rescheduled" | "reminder";
// Kuyruktaki tüm türler: müşteri e-postaları + işletmeye giden "yeni randevu"
export type OutboxKind = EmailKind | "owner_new" | "owner_cancelled";

export type EmailContext = {
  kind: EmailKind;
  appointmentId: string;
  customerName: string;
  business: { name: string; slug: string; address: string | null; city: string | null; phone: string | null };
  resourceName: string;
  services: { name: string; price_cents: number | null }[];
  startsAt: string; // ISO
  endsAt: string; // ISO
  timeZone: string;
  previousStartsAt?: string; // yalnızca "rescheduled"
  cancelledBy?: string | null; // yalnızca "cancelled": 'business' ya da müşteri
  siteUrl: string; // sonunda / olmadan
};

export type BuiltEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDateTime(iso: string, timeZone: string): string {
  const date = new Intl.DateTimeFormat("tr-TR", { timeZone, day: "numeric", month: "long", year: "numeric", weekday: "long" }).format(new Date(iso));
  return `${date}, ${formatClock(iso, timeZone)}`;
}

export function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("tr-TR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function formatShortDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("tr-TR", { timeZone, day: "numeric", month: "long" }).format(new Date(iso));
}

/** Kuruş cinsinden toplam; fiyatı olmayan kalem varsa belirtilir. Hiç fiyat yoksa null. */
export function priceSummary(services: { price_cents: number | null }[]): string | null {
  const priced = services.filter((s) => s.price_cents != null);
  if (priced.length === 0) return null;
  const total = priced.reduce((sum, s) => sum + (s.price_cents ?? 0), 0) / 100;
  const text = `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(total)} ₺`;
  return priced.length < services.length ? `${text} + fiyatı sorulacak hizmetler` : text;
}

function lead(ctx: EmailContext): { subject: string; heading: string; intro: string; cta: { label: string; url: string } } {
  const { business, startsAt, timeZone, siteUrl, appointmentId } = ctx;
  const view = { label: "Randevumu görüntüle", url: `${siteUrl}/randevu/${appointmentId}` };
  switch (ctx.kind) {
    case "received":
      return {
        subject: `Randevu talebin alındı: ${business.name}`,
        heading: "Talebin alındı",
        intro: `${business.name} randevu talebini aldı. İşletme onayladığında sana tekrar e-posta göndereceğiz.`,
        cta: view,
      };
    case "booked":
      return {
        subject: `Randevun onaylandı: ${business.name}, ${formatShortDate(startsAt, timeZone)}`,
        heading: "Randevun onaylandı",
        intro: `${business.name} için randevun hazır. Aşağıdaki bilgileri kontrol et.`,
        cta: view,
      };
    case "confirmed":
      return {
        subject: `${business.name} randevunu onayladı`,
        heading: "Randevun onaylandı",
        intro: `${business.name} randevu talebini onayladı. Seni bekliyoruz.`,
        cta: view,
      };
    case "cancelled": {
      const byBusiness = ctx.cancelledBy === "business";
      return {
        subject: byBusiness ? `${business.name} randevunu iptal etti` : `Randevun iptal edildi: ${business.name}`,
        heading: "Randevun iptal edildi",
        intro: byBusiness
          ? `${business.name} aşağıdaki randevuyu iptal etti. Dilersen yeni bir saat seçebilirsin.`
          : "Randevun iptal edildi. İstersen yeni bir randevu alabilirsin.",
        cta: { label: "Yeniden randevu al", url: `${siteUrl}/${business.slug}` },
      };
    }
    case "rescheduled":
      return {
        subject: `Randevu saatin değişti: ${business.name}`,
        heading: "Randevu saatin değişti",
        intro: ctx.previousStartsAt
          ? `Randevun ${formatDateTime(ctx.previousStartsAt, timeZone)} yerine aşağıdaki zamana taşındı.`
          : "Randevun aşağıdaki zamana taşındı.",
        cta: view,
      };
    case "reminder":
      return {
        subject: `Yarın randevun var: ${business.name}, ${formatClock(startsAt, timeZone)}`,
        heading: "Randevun yaklaşıyor",
        intro: "Yaklaşan randevunu hatırlatmak istedik. Gelemeyeceksen lütfen iptal et ki saat başkasına kalsın.",
        cta: view,
      };
  }
}

export function buildEmail(ctx: EmailContext): BuiltEmail {
  const { business, timeZone } = ctx;
  const { subject, heading, intro, cta } = lead(ctx);
  const place = [business.address, business.city].filter(Boolean).join(", ");
  const price = priceSummary(ctx.services);

  const rows: [string, string][] = [
    ["İşletme", business.name],
    ["Hizmet", ctx.services.map((s) => s.name).join(", ")],
    ["Kiminle", ctx.resourceName],
    ["Zaman", `${formatDateTime(ctx.startsAt, timeZone)} – ${formatClock(ctx.endsAt, timeZone)}`],
  ];
  if (place) rows.push(["Adres", place]);
  if (business.phone) rows.push(["Telefon", business.phone]);
  if (price) rows.push(["Tutar", `${price} (ödeme işletmede yapılır)`]);

  const detailHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px 6px 0;color:#57534e;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(v)}</td></tr>`,
        )
        .join("")}</table>`;

  const html = `<!doctype html>
<html lang="tr"><body style="margin:0;background:#fafaf9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border:1px solid #d6d3d1;border-radius:12px;padding:24px">
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(heading)}</h1>
<p style="margin:0 0 4px">Merhaba ${escapeHtml(ctx.customerName)},</p>
<p style="margin:0">${escapeHtml(intro)}</p>
${detailHtml}
<p style="margin:20px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${escapeHtml(cta.label)}</a></p>
</div>
<p style="margin:16px 4px 0;font-size:12px;color:#57534e">Bu e-posta ${escapeHtml(business.name)} ile yaptığın randevu nedeniyle gönderildi. Randevu sisteminin ücretsiz bir demo projesi olduğunu unutma: ödeme alınmaz.</p>
</div></body></html>`;

  const text = [
    heading,
    "",
    `Merhaba ${ctx.customerName},`,
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `${cta.label}: ${cta.url}`,
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// İşletmeye giden "yeni randevu" e-postası
// ---------------------------------------------------------------------------

export type OwnerEmailContext = {
  appointmentId: string;
  event?: "new" | "cancelled"; // varsayılan: new
  cancelReason?: string | null; // yalnızca event = "cancelled"
  pending: boolean; // true: işletmenin onayını bekliyor (yalnızca event = "new")
  business: { name: string; slug: string };
  customer: { name: string; phone: string | null; email: string | null };
  resourceName: string;
  services: { name: string; price_cents: number | null }[];
  startsAt: string;
  endsAt: string;
  timeZone: string;
  note: string | null;
  answers: { label: string; value: string }[]; // ek form soruları (plaka vb.)
  panelUrl: string; // sonunda / olmadan
};

export function buildOwnerEmail(ctx: OwnerEmailContext): BuiltEmail {
  const { business, customer, timeZone } = ctx;
  const when = `${formatShortDate(ctx.startsAt, timeZone)} ${formatClock(ctx.startsAt, timeZone)}`;
  const cancelled = ctx.event === "cancelled";
  const subject = cancelled
    ? `Randevu iptal edildi: ${customer.name}, ${when}`
    : ctx.pending
      ? `Onayını bekleyen randevu: ${customer.name}, ${when}`
      : `Yeni randevu: ${customer.name}, ${when}`;
  const heading = cancelled ? "Müşteri randevusunu iptal etti" : ctx.pending ? "Onayını bekleyen yeni randevu" : "Yeni randevu geldi";
  const intro = cancelled
    ? `${customer.name} ${business.name} randevusunu iptal etti. Bu saat yeniden boş.`
    : ctx.pending
      ? `${business.name} için yeni bir randevu talebi var. Müşteri onayını bekliyor: panelden onaylayabilir ya da reddedebilirsin.`
      : `${business.name} için müşteri sitesinden yeni bir randevu alındı.`;
  const price = priceSummary(ctx.services);

  const rows: [string, string][] = [
    ["Müşteri", customer.name],
    ...(customer.phone ? ([["Telefon", customer.phone]] as [string, string][]) : []),
    ...(customer.email ? ([["E-posta", customer.email]] as [string, string][]) : []),
    ["Hizmet", ctx.services.map((s) => s.name).join(", ")],
    ["Kiminle", ctx.resourceName],
    ["Zaman", `${formatDateTime(ctx.startsAt, timeZone)} – ${formatClock(ctx.endsAt, timeZone)}`],
    ...ctx.answers.map((a) => [a.label, a.value] as [string, string]),
    ...(ctx.note ? ([["Müşteri notu", ctx.note]] as [string, string][]) : []),
    ...(cancelled && ctx.cancelReason ? ([["İptal nedeni", ctx.cancelReason]] as [string, string][]) : []),
    ...(price ? ([["Tutar", price]] as [string, string][]) : []),
  ];
  const cta = { label: "Takvimde aç", url: `${ctx.panelUrl}/${business.slug}/takvim` };

  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#57534e;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table>`;

  const html = `<!doctype html>
<html lang="tr"><body style="margin:0;background:#fafaf9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border:1px solid #d6d3d1;border-radius:12px;padding:24px">
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(heading)}</h1>
<p style="margin:0">${escapeHtml(intro)}</p>
${table}
<p style="margin:20px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${escapeHtml(cta.label)}</a></p>
</div>
<p style="margin:16px 4px 0;font-size:12px;color:#57534e">Bu e-postayı ${escapeHtml(business.name)} işletmesinin yöneticisi olduğun için aldın. Müşteri bilgilerini yalnızca randevu için kullan.</p>
</div></body></html>`;

  const text = [heading, "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", `${cta.label}: ${cta.url}`].join("\n");
  return { subject, html, text };
}
