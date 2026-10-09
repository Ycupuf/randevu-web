import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Randevu sihirbazının adımları arası durumu. localStorage'a yazılır, çünkü giriş bağlantısı e-postadan
// yeni bir sekmede açılır ve kullanıcı seçtiklerini kaybetmemeli. Süresi 1 saattir.

export type WizardItem = { serviceId: string; variantId: string | null };

export type WizardSlot = { start: string; resourceId: string };

export type WizardData = {
  slug: string | null;
  items: WizardItem[];
  /** Belirli bir kaynak (uuid) ya da "any" (fark etmez / otomatik). */
  resourceId: string;
  date: string | null;
  slot: WizardSlot | null;
  customer: { fullName: string; phone: string; email: string };
  fieldAnswers: Record<string, string>;
  note: string;
  kvkk: boolean;
  savedAt: number;
};

type WizardActions = {
  /** Sihirbaz bir işletme için açıldığında çağrılır; başka işletmenin ya da eski veriyi temizler. */
  init: (slug: string) => void;
  /** Hizmeti seçer (varyantlıysa varyantıyla). Aynı hizmet zaten seçiliyse yerine geçer. */
  selectService: (serviceId: string, variantId: string | null) => void;
  removeService: (serviceId: string) => void;
  setResource: (resourceId: string) => void;
  setDate: (date: string) => void;
  setSlot: (slot: WizardSlot | null) => void;
  setCustomer: (patch: Partial<WizardData["customer"]>) => void;
  setFieldAnswer: (key: string, value: string) => void;
  setNote: (note: string) => void;
  setKvkk: (accepted: boolean) => void;
  reset: () => void;
};

export const WIZARD_TTL_MS = 60 * 60 * 1000;
export const MAX_ITEMS = 5;

export const emptyWizard = (slug: string | null = null): WizardData => ({
  slug,
  items: [],
  resourceId: "any",
  date: null,
  slot: null,
  customer: { fullName: "", phone: "", email: "" },
  fieldAnswers: {},
  note: "",
  kvkk: false,
  savedAt: Date.now(),
});

export function isExpired(savedAt: number, now = Date.now()): boolean {
  return now - savedAt > WIZARD_TTL_MS;
}

/** Hizmet listesi değişince ona bağlı seçimler (kaynak, gün, saat) geçersiz olur. */
function resetDependent(): Pick<WizardData, "resourceId" | "slot"> {
  return { resourceId: "any", slot: null };
}

export const useWizard = create<WizardData & WizardActions>()(
  persist(
    (set, get) => ({
      ...emptyWizard(),

      init: (slug) => {
        const s = get();
        if (s.slug !== slug || isExpired(s.savedAt)) set({ ...emptyWizard(slug) });
      },

      selectService: (serviceId, variantId) =>
        set((s) => {
          const others = s.items.filter((i) => i.serviceId !== serviceId);
          if (others.length >= MAX_ITEMS) return s;
          return { items: [...others, { serviceId, variantId }], ...resetDependent(), savedAt: Date.now() };
        }),

      removeService: (serviceId) =>
        set((s) => ({
          items: s.items.filter((i) => i.serviceId !== serviceId),
          ...resetDependent(),
          savedAt: Date.now(),
        })),

      setResource: (resourceId) => set({ resourceId, slot: null, savedAt: Date.now() }),
      setDate: (date) => set({ date, slot: null, savedAt: Date.now() }),
      setSlot: (slot) => set({ slot, savedAt: Date.now() }),
      setCustomer: (patch) => set((s) => ({ customer: { ...s.customer, ...patch }, savedAt: Date.now() })),
      setFieldAnswer: (key, value) =>
        set((s) => ({ fieldAnswers: { ...s.fieldAnswers, [key]: value }, savedAt: Date.now() })),
      setNote: (note) => set({ note, savedAt: Date.now() }),
      setKvkk: (kvkk) => set({ kvkk, savedAt: Date.now() }),
      reset: () => set({ ...emptyWizard(get().slug) }),
    }),
    {
      name: "randevu-wizard",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Sunucu ve istemci ilk çizimi aynı olsun diye depo, bileşen takılınca elle yüklenir.
      skipHydration: true,
      partialize: (s) => ({
        slug: s.slug,
        items: s.items,
        resourceId: s.resourceId,
        date: s.date,
        slot: s.slot,
        customer: s.customer,
        fieldAnswers: s.fieldAnswers,
        note: s.note,
        kvkk: s.kvkk,
        savedAt: s.savedAt,
      }),
    },
  ),
);
