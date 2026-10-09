import { describe, expect, it } from "vitest";
import { buildEmail, buildOwnerEmail, escapeHtml, formatDateTime, priceSummary, type EmailContext, type OwnerEmailContext } from "./templates";

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

describe("buildOwnerEmail", () => {
  const owner: OwnerEmailContext = {
    appointmentId: "11111111-2222-3333-4444-555555555555",
    pending: false,
    business: { name: "Demo Berber", slug: "demo-berber" },
    customer: { name: "Ayşe Yılmaz", phone: "+905551234567", email: "ayse@example.com" },
    resourceName: "Ali",
    services: [{ name: "Saç kesimi", price_cents: 35000 }],
    startsAt: "2026-10-13T11:00:00Z",
    endsAt: "2026-10-13T11:30:00Z",
    timeZone: "Europe/Istanbul",
    note: null,
    answers: [],
    panelUrl: "https://panel.example",
  };

  it("konu müşteri adını ve zamanı içerir, düğme panel takvimine gider", () => {
    const m = buildOwnerEmail(owner);
    expect(m.subject).toBe("Yeni randevu: Ayşe Yılmaz, 13 Ekim 14:00");
    expect(m.html).toContain("https://panel.example/demo-berber/takvim");
    expect(m.text).toContain("Telefon: +905551234567");
    expect(m.text).toContain("Zaman: 13 Ekim 2026 Salı, 14:00 – 14:30");
  });

  it("onay bekleyen talepte konu ve metin farklıdır", () => {
    const m = buildOwnerEmail({ ...owner, pending: true });
    expect(m.subject).toBe("Onayını bekleyen randevu: Ayşe Yılmaz, 13 Ekim 14:00");
    expect(m.text).toContain("onaylayabilir ya da reddedebilirsin");
  });

  it("ek form cevaplarını ve müşteri notunu etiketleriyle gösterir", () => {
    const m = buildOwnerEmail({ ...owner, note: "Geç kalabilirim", answers: [{ label: "Araç plakası", value: "34 ABC 123" }] });
    expect(m.text).toContain("Araç plakası: 34 ABC 123");
    expect(m.text).toContain("Müşteri notu: Geç kalabilirim");
  });

  it("telefon ve e-posta yoksa satır eklenmez", () => {
    const m = buildOwnerEmail({ ...owner, customer: { name: "Ayşe", phone: null, email: null } });
    expect(m.text).not.toContain("Telefon:");
    expect(m.text).not.toContain("E-posta:");
  });

  it("müşterinin yazdığı HTML kaçırılır", () => {
    const m = buildOwnerEmail({ ...owner, note: "<script>alert(1)</script>", customer: { ...owner.customer, name: "<b>X</b>" } });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>X</b>");
    expect(m.html).toContain("&lt;b&gt;X&lt;/b&gt;");
  });

  it("müşteri iptalinde konu, başlık ve iptal nedeni farklıdır", () => {
    const m = buildOwnerEmail({ ...owner, event: "cancelled", cancelReason: "Hastayım" });
    expect(m.subject).toBe("Randevu iptal edildi: Ayşe Yılmaz, 13 Ekim 14:00");
    expect(m.text).toContain("Müşteri randevusunu iptal etti");
    expect(m.text).toContain("Bu saat yeniden boş");
    expect(m.text).toContain("İptal nedeni: Hastayım");
    expect(m.text).not.toContain("onaylayabilir");
  });

  it("iptal nedeni yoksa satır eklenmez, iptal nedeni yalnızca iptal e-postasında görünür", () => {
    expect(buildOwnerEmail({ ...owner, event: "cancelled", cancelReason: null }).text).not.toContain("İptal nedeni");
    expect(buildOwnerEmail({ ...owner, cancelReason: "Hastayım" }).text).not.toContain("İptal nedeni");
  });

  it("müşteri saat değişikliğinde eski ve yeni zamanı gösterir", () => {
    const m = buildOwnerEmail({ ...owner, event: "rescheduled", previousStartsAt: "2026-10-12T07:00:00Z" });
    expect(m.subject).toBe("Randevu saati değişti: Ayşe Yılmaz, 13 Ekim 14:00");
    expect(m.text).toContain("Müşteri randevu saatini değiştirdi");
    expect(m.text).toContain("12 Ekim 2026 Pazartesi, 10:00 yerine aşağıdaki zamana taşıdı");
    expect(m.text).toContain("Zaman: 13 Ekim 2026 Salı, 14:00");
    expect(m.text).not.toContain("onayını bekliyor");
  });

  it("onay gerektiren işletmede saat değişikliği onay bekler notunu taşır", () => {
    const m = buildOwnerEmail({ ...owner, event: "rescheduled", pending: true });
    expect(m.text).toContain("Yeni saat senin onayını bekliyor.");
    expect(m.text).toContain("aşağıdaki zamana taşıdı.");
  });
});
