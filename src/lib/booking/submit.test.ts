import { describe, expect, it, vi } from "vitest";
import { buildAnswers, requestLoginLink, submitAppointment } from "./submit";
import { emptyWizard } from "./store";

const wizard = {
  ...emptyWizard("demo-berber"),
  items: [{ serviceId: "s1", variantId: null }],
  slot: { start: "2026-10-12T07:00:00.000Z", resourceId: "r1" },
  customer: { fullName: "Ayşe", phone: "0532 123 45 67", email: "a@example.com" },
  kvkk: true,
  note: "",
  fieldAnswers: { plaka: " 34 ABC 123 ", bos: "  " },
};
const input = { businessId: "b1", wizard, fields: [{ key: "plaka" }, { key: "bos" }] };
const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("buildAnswers", () => {
  it("boş cevapları atar ve değerleri kırpar", () => {
    expect(buildAnswers([{ key: "plaka" }, { key: "bos" }, { key: "yok" }], { plaka: " 34 ABC ", bos: " " })).toEqual({
      plaka: "34 ABC",
    });
  });
});

describe("submitAppointment", () => {
  it("başarıda id döner ve gövdede KVKK onayı ile kırpılmış cevaplar gider", async () => {
    const f = reply(201, { id: "a1" });
    expect(await submitAppointment(input, f)).toEqual({ ok: true, id: "a1" });
    const body = JSON.parse((vi.mocked(f).mock.calls[0]![1] as RequestInit).body as string);
    expect(body.customer.kvkkAccepted).toBe(true);
    expect(body.fieldAnswers).toEqual({ plaka: "34 ABC 123" });
    expect(body.note).toBeUndefined();
  });

  it("409 + slot_unavailable: saat başkasına gitti", async () => {
    const r = await submitAppointment(input, reply(409, { error: "Bu saat az önce doldu.", code: "slot_unavailable" }));
    expect(r).toEqual({ ok: false, error: "Bu saat az önce doldu.", slotTaken: true });
  });

  it("başka 409 (ör. aktif randevu sınırı) saat seçimine geri götürmez", async () => {
    const r = await submitAppointment(input, reply(409, { error: "Limit", code: "too_many_active" }));
    expect(r).toMatchObject({ ok: false, slotTaken: false });
  });

  it("gövdesiz hata yanıtında genel mesaj verir", async () => {
    const f = vi.fn().mockResolvedValue(new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await submitAppointment(input, f)).toMatchObject({ ok: false, error: "Randevu alınamadı. Tekrar dene." });
  });

  it("ağ hatasında bağlantı mesajı verir", async () => {
    const f = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    expect(await submitAppointment(input, f)).toMatchObject({ ok: false, slotTaken: false, error: expect.stringContaining("Bağlantı") });
  });

  it("saat seçilmemişse göndermeden döner", async () => {
    const f = reply(201, { id: "x" });
    const r = await submitAppointment({ ...input, wizard: { ...wizard, slot: null } }, f);
    expect(r).toMatchObject({ ok: false, slotTaken: true });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("requestLoginLink", () => {
  const args = { email: "  Ayse@Example.com ", slug: "demo-berber", origin: "https://site.test" };

  it("e-postayı normalleştirir ve dönüş adresini tamamla=1 ile kurar", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    expect(await requestLoginLink(args, { auth: { signInWithOtp } })).toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "ayse@example.com",
      options: {
        emailRedirectTo: `https://site.test/auth/callback?next=${encodeURIComponent("/demo-berber/randevu?tamamla=1")}`,
      },
    });
  });

  it("429 için hız sınırı mesajı verir", async () => {
    const r = await requestLoginLink(args, { auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: { status: 429 } }) } });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("çok fazla") });
  });

  it("diğer hatalarda genel mesaj verir", async () => {
    const r = await requestLoginLink(args, { auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: { status: 400 } }) } });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("gönderilemedi") });
  });
});
