import { describe, expect, it } from "vitest";
import { buildEmail, escapeHtml, formatDateTime, priceSummary, type EmailContext } from "./templates";

const base: EmailContext = {
  kind: "booked",
  appointmentId: "11111111-2222-3333-4444-555555555555",
  customerName: "Ayşe Yılmaz",
  business: { name: "Demo Berber", slug: "demo-berber", address: "Örnek Mah. No:12", city: "Gebze, Kocaeli", phone: "0262 000 00 01" },
  resourceName: "Ali",
  services: [{ name: "Saç kesimi", price_cents: 35000 }],
  startsAt: "2026-10-13T11:00:00Z", // İstanbul 14:00
  endsAt: "2026-10-13T11:30:00Z",
  timeZone: "Europe/Istanbul",
  siteUrl: "https://randevu.example",
};

describe("biçimlendirme", () => {
  it("saati işletmenin saat diliminde yazar", () => {
    expect(formatDateTime("2026-10-13T11:00:00Z", "Europe/Istanbul")).toBe("13 Ekim 2026 Salı, 14:00");
  });
  it("gece yarısını aşan UTC anını doğru güne koyar", () => {
    expect(formatDateTime("2026-10-12T21:30:00Z", "Europe/Istanbul")).toContain("13 Ekim 2026");
  });
  it("HTML özel karakterlerini kaçırır", () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;");
  });
  it("toplam fiyatı ve fiyatsız kalemi belirtir", () => {
    expect(priceSummary([{ price_cents: 35000 }, { price_cents: 20000 }])).toBe("550 ₺");
    expect(priceSummary([{ price_cents: 35000 }, { price_cents: null }])).toContain("fiyatı sorulacak");
    expect(priceSummary([{ price_cents: null }])).toBeNull();
  });
});

describe("buildEmail", () => {
  it("onaylı randevu: konu tarihi içerir, düğme randevu sayfasına gider", () => {
    const m = buildEmail(base);
    expect(m.subject).toBe("Randevun onaylandı: Demo Berber, 13 Ekim");
    expect(m.html).toContain("https://randevu.example/randevu/11111111-2222-3333-4444-555555555555");
    expect(m.text).toContain("Zaman: 13 Ekim 2026 Salı, 14:00 – 14:30");
    expect(m.text).toContain("Tutar: 350 ₺ (ödeme işletmede yapılır)");
  });

  it("onay bekleyen talep için ayrı metin", () => {
    const m = buildEmail({ ...base, kind: "received" });
    expect(m.subject).toContain("talebin alındı");
    expect(m.text).toContain("onayladığında");
  });

  it("işletme iptali ile müşteri iptali farklı konu taşır, düğme işletme sayfasına gider", () => {
    const byBusiness = buildEmail({ ...base, kind: "cancelled", cancelledBy: "business" });
    const byCustomer = buildEmail({ ...base, kind: "cancelled", cancelledBy: "customer" });
    expect(byBusiness.subject).toBe("Demo Berber randevunu iptal etti");
    expect(byCustomer.subject).toBe("Randevun iptal edildi: Demo Berber");
    expect(byBusiness.html).toContain("https://randevu.example/demo-berber");
  });

  it("saat değişikliği eski zamanı da yazar", () => {
    const m = buildEmail({ ...base, kind: "rescheduled", previousStartsAt: "2026-10-12T07:00:00Z" });
    expect(m.text).toContain("12 Ekim 2026 Pazartesi, 10:00");
    expect(m.text).toContain("13 Ekim 2026 Salı, 14:00");
  });

  it("hatırlatma konusunda saat bulunur", () => {
    expect(buildEmail({ ...base, kind: "reminder" }).subject).toBe("Yarın randevun var: Demo Berber, 14:00");
  });

  it("müşteri ve işletme adındaki HTML kaçırılır", () => {
    const m = buildEmail({ ...base, customerName: `<img src=x onerror=alert(1)>`, business: { ...base.business, name: `A&B <b>` } });
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("A&amp;B &lt;b&gt;");
  });

  it("adres ve telefon yoksa satır eklenmez", () => {
    const m = buildEmail({ ...base, business: { ...base.business, address: null, city: null, phone: null } });
    expect(m.text).not.toContain("Adres:");
    expect(m.text).not.toContain("Telefon:");
  });

  it("fiyatsız hizmette tutar satırı yoktur", () => {
    const m = buildEmail({ ...base, services: [{ name: "Lazer", price_cents: null }] });
    expect(m.text).not.toContain("Tutar:");
  });
});
