import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ITEMS, WIZARD_TTL_MS, emptyWizard, isExpired, useWizard } from "./store";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  useWizard.setState({ ...emptyWizard() });
});

describe("isExpired", () => {
  it("1 saatten eski veriyi süresi dolmuş sayar", () => {
    const now = 1_000_000_000_000;
    expect(isExpired(now - WIZARD_TTL_MS + 1, now)).toBe(false);
    expect(isExpired(now - WIZARD_TTL_MS - 1, now)).toBe(true);
  });
});

describe("useWizard", () => {
  it("hizmet seçer; aynı hizmeti tekrar seçince varyantını değiştirir, çoğaltmaz", () => {
    const { selectService } = useWizard.getState();
    selectService(A, null);
    selectService(B, "v1");
    selectService(B, "v2");
    expect(useWizard.getState().items).toEqual([
      { serviceId: A, variantId: null },
      { serviceId: B, variantId: "v2" },
    ]);
  });

  it("en fazla 5 hizmet seçilebilir", () => {
    const { selectService } = useWizard.getState();
    for (let i = 0; i < MAX_ITEMS + 2; i++) selectService(`s${i}`, null);
    expect(useWizard.getState().items).toHaveLength(MAX_ITEMS);
  });

  it("hizmet değişince kaynak ve saat seçimi sıfırlanır", () => {
    const s = useWizard.getState();
    s.selectService(A, null);
    s.setResource("r1");
    s.setSlot({ start: "2026-10-12T07:00:00Z", resourceId: "r1" });
    s.selectService(B, null);
    expect(useWizard.getState().resourceId).toBe("any");
    expect(useWizard.getState().slot).toBeNull();
  });

  it("gün ya da kaynak değişince seçili saat temizlenir", () => {
    const s = useWizard.getState();
    s.setSlot({ start: "2026-10-12T07:00:00Z", resourceId: "r1" });
    s.setDate("2026-10-13");
    expect(useWizard.getState().slot).toBeNull();
    s.setSlot({ start: "2026-10-13T07:00:00Z", resourceId: "r1" });
    s.setResource("r2");
    expect(useWizard.getState().slot).toBeNull();
  });

  it("init başka işletme için açılınca eski seçimleri temizler, aynı işletmede korur", () => {
    const s = useWizard.getState();
    s.init("demo-berber");
    s.selectService(A, null);
    s.init("demo-berber");
    expect(useWizard.getState().items).toHaveLength(1);
    s.init("demo-guzellik");
    expect(useWizard.getState().items).toHaveLength(0);
    expect(useWizard.getState().slug).toBe("demo-guzellik");
  });

  it("süresi dolmuş veri init ile temizlenir", () => {
    const s = useWizard.getState();
    s.init("demo-berber");
    s.selectService(A, null);
    useWizard.setState({ savedAt: Date.now() - WIZARD_TTL_MS - 1000 });
    s.init("demo-berber");
    expect(useWizard.getState().items).toHaveLength(0);
  });

  it("reset işletmeyi korur, seçimleri siler", () => {
    const s = useWizard.getState();
    s.init("demo-berber");
    s.selectService(A, null);
    s.setCustomer({ fullName: "Elif Yılmaz" });
    s.setKvkk(true);
    s.reset();
    const after = useWizard.getState();
    expect(after.slug).toBe("demo-berber");
    expect(after.items).toEqual([]);
    expect(after.customer.fullName).toBe("");
    expect(after.kvkk).toBe(false);
  });
});
