"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessPublic, ServiceWithVariants } from "@/lib/booking/data";
import { MAX_ITEMS, useWizard } from "@/lib/booking/store";
import { formatDateOnlyLong, formatDuration, formatPrice, formatTime, formatPhoneTR } from "@/lib/format";
import { summarizeServices } from "@/lib/rules";
import { customerSchema, fieldErrors, stringifyItemsParam } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/browser";
import { localDateString } from "@/lib/time";
import { DemoLoginForm } from "./DemoLoginForm";
import { SlotPicker } from "./SlotPicker";

type StepId = "services" | "resource" | "datetime" | "details" | "summary";

type Props = {
  data: BusinessPublic;
  /** Giriş yapmış kullanıcı (yoksa null) */
  user: { email: string | null } | null;
  /** Giriş bağlantısından dönüldüyse true: kayıtlı seçimlerle randevu otomatik tamamlanır. */
  autoComplete: boolean;
};

type Line = { service: ServiceWithVariants; variantId: string | null; name: string; durationMin: number; priceCents: number | null };

export function BookingWizard({ data, user, autoComplete }: Props) {
  const { business, settings, services, resources, fields } = data;
  const router = useRouter();
  const store = useWizard();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<StepId>("services");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const autoRan = useRef(false);

  // Depoyu yalnızca tarayıcıda yükle (sunucu çıktısıyla uyuşsun diye), sonra işletmeye göre başlat.
  // Giriş bağlantısından dönüldüyse (?tamamla=1) kayıtlı seçimlerle randevu burada otomatik tamamlanır.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(useWizard.persist.rehydrate()).then(() => {
      if (cancelled) return;
      useWizard.getState().init(business.slug);
      if (user?.email) useWizard.getState().setCustomer({ email: user.email });
      setReady(true);

      if (autoComplete && user && !autoRan.current) {
        autoRan.current = true;
        const s = useWizard.getState();
        const complete = s.slug === business.slug && s.items.length > 0 && s.slot && s.kvkk && s.customer.fullName;
        if (complete) {
          setStep("summary");
          void submit();
        } else {
          setSubmitError("Seçimlerinin süresi dolmuş. Lütfen randevu bilgilerini yeniden seç.");
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // submit her çizimde yeniden oluşur; burada yalnızca bir kez (yükleme bitince) çağrılması istenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.slug, user, autoComplete]);

  const askResource = settings.resource_selection === "customer";
  const steps: StepId[] = useMemo(
    () => ["services", ...(askResource ? (["resource"] as StepId[]) : []), "datetime", "details", "summary"],
    [askResource],
  );
  const stepIndex = steps.indexOf(step);

  // Adım değişince başlığa odaklan (ekran okuyucu ve klavye kullanıcıları için)
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const lines: Line[] = useMemo(() => {
    const out: Line[] = [];
    for (const item of store.items) {
      const service = services.find((s) => s.id === item.serviceId);
      if (!service) continue;
      const variant = item.variantId ? service.service_variants.find((v) => v.id === item.variantId) : undefined;
      out.push({
        service,
        variantId: item.variantId,
        name: variant ? `${service.name} (${variant.name})` : service.name,
        durationMin: variant ? variant.duration_min : service.duration_min,
        priceCents: variant ? variant.price_cents : service.price_cents,
      });
    }
    return out;
  }, [store.items, services]);

  const totals = useMemo(
    () =>
      lines.length
        ? summarizeServices(
            lines.map((l) => ({ durationMin: l.durationMin, priceCents: l.priceCents ?? 0, bufferAfterMin: l.service.buffer_after_min })),
          )
        : null,
    [lines],
  );
  const hasAnyPrice = lines.some((l) => l.priceCents !== null);

  const eligibleResources = useMemo(
    () =>
      resources.filter((r) => store.items.every((i) => r.resource_services.some((rs) => rs.service_id === i.serviceId))),
    [resources, store.items],
  );

  const itemsParam = stringifyItemsParam(store.items);
  const resourceName = (id: string) => resources.find((r) => r.id === id)?.name ?? "";

  if (!ready) {
    return <p className="text-muted">Yükleniyor…</p>;
  }

  function go(next: StepId) {
    setErrors({});
    setSubmitError(null);
    setStep(next);
  }
  const goNext = () => go(steps[Math.min(stepIndex + 1, steps.length - 1)]!);
  const goBack = () => go(steps[Math.max(stepIndex - 1, 0)]!);

  function validateDetails(): boolean {
    const s = useWizard.getState();
    const result = customerSchema.safeParse({ ...s.customer, kvkkAccepted: s.kvkk });
    const next: Record<string, string> = {};
    if (!result.success) {
      for (const [key, message] of Object.entries(fieldErrors(result.error))) next[key.replace(/^customer\./, "")] = message;
      // kvkkAccepted alanı "kvkk" olarak gösterilir
      if (next.kvkkAccepted) {
        next.kvkk = next.kvkkAccepted;
        delete next.kvkkAccepted;
      }
    }
    for (const f of fields) {
      if (f.required && !s.fieldAnswers[f.key]?.trim()) next[`field.${f.key}`] = "Bu alan zorunlu";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    const s = useWizard.getState();
    if (!s.slot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const answers: Record<string, string> = {};
      for (const f of fields) if (s.fieldAnswers[f.key]?.trim()) answers[f.key] = s.fieldAnswers[f.key]!.trim();
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          items: s.items,
          resourceId: s.resourceId,
          startsAt: s.slot.start,
          fieldAnswers: answers,
          note: s.note || undefined,
          customer: { ...s.customer, kvkkAccepted: s.kvkk },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        if (res.status === 409 && json.error?.includes("doldu")) {
          // Saat başkasına gitti: kullanıcıyı saat seçimine geri götür
          useWizard.getState().setSlot(null);
          setStep("datetime");
        }
        setSubmitError(json.error ?? "Randevu alınamadı. Tekrar dene.");
        return;
      }
      useWizard.getState().reset();
      router.push(`/randevu/${json.id}?yeni=1`);
    } catch {
      setSubmitError("Bağlantı sorunu. İnternetini kontrol edip tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendLoginLink() {
    const s = useWizard.getState();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const supabase = createClient();
      const next = `/${business.slug}/randevu?tamamla=1`;
      const { error } = await supabase.auth.signInWithOtp({
        email: s.customer.email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        setSubmitError(
          error.status === 429
            ? "Kısa sürede çok fazla e-posta istendi. Birkaç dakika sonra tekrar dene."
            : "Giriş bağlantısı gönderilemedi. E-posta adresini kontrol edip tekrar dene.",
        );
        return;
      }
      setLinkSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------- görünüm
  const labelService = settings.service_label;
  const labelResource = settings.resource_label;

  const titles: Record<StepId, string> = {
    services: `${labelService} seç`,
    resource: `${labelResource} seç`,
    datetime: "Gün ve saat seç",
    details: "Bilgilerin",
    summary: "Özet ve onay",
  };

  return (
    <div>
      <nav aria-label="Adımlar" className="mb-5">
        <ol className="flex gap-1.5">
          {steps.map((id, i) => (
            <li
              key={id}
              aria-current={id === step ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-accent" : "bg-border"}`}
            >
              <span className="sr-only">{titles[id]}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted">
          Adım {stepIndex + 1} / {steps.length}
        </p>
      </nav>

      <h1 ref={headingRef} tabIndex={-1} className="mb-1 text-2xl font-semibold outline-none">
        {titles[step]}
      </h1>
      <p className="mb-5 text-muted">{business.name}</p>

      {submitError && (
        <div role="alert" className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {submitError}
        </div>
      )}

      {step === "services" && (
        <ServiceStep
          services={services}
          label={labelService}
          selected={store.items}
          onSelect={store.selectService}
          onRemove={store.removeService}
        />
      )}

      {step === "resource" && (
        <div>
          {eligibleResources.length === 0 ? (
            <p className="rounded-lg border border-border p-4">
              Seçtiğin {labelService.toLowerCase()}leri birlikte yapabilen kimse yok. Geri dönüp daha az seçim yapabilir ya
              da ayrı randevular alabilirsin.
            </p>
          ) : (
            <div className="grid gap-2" role="group" aria-label={labelResource}>
              <button
                type="button"
                className="chip text-left"
                aria-pressed={store.resourceId === "any"}
                onClick={() => store.setResource("any")}
              >
                <span className="font-medium">Fark etmez</span>
                <span className="block text-sm text-muted">En erken boş olan seçilir</span>
              </button>
              {eligibleResources.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="chip text-left"
                  aria-pressed={store.resourceId === r.id}
                  onClick={() => store.setResource(r.id)}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "datetime" && (
        <SlotPicker
          businessId={business.id}
          timeZone={business.timezone}
          horizonDays={settings.horizon_days}
          itemsParam={itemsParam}
          resourceId={store.resourceId}
          date={store.date}
          onDateChange={store.setDate}
          selectedStart={store.slot?.start ?? null}
          onSelect={(slot) => store.setSlot({ start: slot.start, resourceId: slot.resourceId })}
        />
      )}

      {step === "details" && (
        <div className="grid gap-4">
          <div>
            <label htmlFor="fullName" className="label">
              Ad soyad
            </label>
            <input
              id="fullName"
              className="input"
              autoComplete="name"
              value={store.customer.fullName}
              onChange={(e) => store.setCustomer({ fullName: e.target.value })}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "fullName-err" : undefined}
            />
            {errors.fullName && <p id="fullName-err" className="field-error">{errors.fullName}</p>}
          </div>
          <div>
            <label htmlFor="phone" className="label">
              Cep telefonu
            </label>
            <input
              id="phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0532 123 45 67"
              value={store.customer.phone}
              onChange={(e) => store.setCustomer({ phone: e.target.value })}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "phone-err" : undefined}
            />
            {errors.phone && <p id="phone-err" className="field-error">{errors.phone}</p>}
          </div>
          <div>
            <label htmlFor="email" className="label">
              E-posta
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="ad@ornek.com"
              value={store.customer.email}
              readOnly={Boolean(user?.email)}
              onChange={(e) => store.setCustomer({ email: e.target.value })}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-err" : "email-hint"}
            />
            {errors.email ? (
              <p id="email-err" className="field-error">{errors.email}</p>
            ) : (
              <p id="email-hint" className="mt-1 text-sm text-muted">
                {user?.email
                  ? "Bu adresle giriş yaptın."
                  : "Şifre yok: bu adrese bir giriş bağlantısı göndereceğiz."}
              </p>
            )}
          </div>

          {fields.map((f) => (
            <div key={f.id}>
              <label htmlFor={`f-${f.key}`} className="label">
                {f.label} {!f.required && <span className="font-normal text-muted">(isteğe bağlı)</span>}
              </label>
              {f.field_type === "textarea" ? (
                <textarea
                  id={`f-${f.key}`}
                  className="input"
                  rows={3}
                  maxLength={200}
                  value={store.fieldAnswers[f.key] ?? ""}
                  onChange={(e) => store.setFieldAnswer(f.key, e.target.value)}
                  aria-invalid={Boolean(errors[`field.${f.key}`])}
                />
              ) : (
                <input
                  id={`f-${f.key}`}
                  className="input"
                  maxLength={200}
                  value={store.fieldAnswers[f.key] ?? ""}
                  onChange={(e) => store.setFieldAnswer(f.key, e.target.value)}
                  aria-invalid={Boolean(errors[`field.${f.key}`])}
                />
              )}
              {errors[`field.${f.key}`] && <p className="field-error">{errors[`field.${f.key}`]}</p>}
            </div>
          ))}

          <div>
            <label htmlFor="note" className="label">
              Not <span className="font-normal text-muted">(isteğe bağlı)</span>
            </label>
            <textarea
              id="note"
              className="input"
              rows={2}
              maxLength={500}
              value={store.note}
              onChange={(e) => store.setNote(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--accent)]"
                checked={store.kvkk}
                onChange={(e) => store.setKvkk(e.target.checked)}
                aria-invalid={Boolean(errors.kvkk)}
              />
              <span>
                <Link href="/gizlilik" target="_blank" className="underline underline-offset-2">
                  Aydınlatma metnini
                </Link>{" "}
                okudum. Adım, telefonum ve e-postam randevum için işletmeyle paylaşılsın.
              </span>
            </label>
            {errors.kvkk && <p className="field-error">{errors.kvkk}</p>}
          </div>
        </div>
      )}

      {step === "summary" && store.slot && totals && (
        <div className="grid gap-4">
          <div className="card">
            <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted">{business.name}</dt>
              <dd>{[business.address, business.city].filter(Boolean).join(", ")}</dd>
              <dt className="text-muted">{labelService}</dt>
              <dd>
                <ul className="grid gap-1">
                  {lines.map((l) => (
                    <li key={l.service.id}>
                      {l.name} <span className="text-muted">· {formatDuration(l.durationMin)}</span>
                    </li>
                  ))}
                </ul>
              </dd>
              <dt className="text-muted">{labelResource}</dt>
              <dd>{store.resourceId === "any" ? `${resourceName(store.slot.resourceId)} (otomatik)` : resourceName(store.resourceId)}</dd>
              <dt className="text-muted">Zaman</dt>
              <dd className="font-medium">
                {formatDateOnlyLong(localDateString(new Date(store.slot.start), business.timezone))},{" "}
                {formatTime(store.slot.start, business.timezone)} –{" "}
                {formatTime(new Date(new Date(store.slot.start).getTime() + totals.durationMin * 60_000), business.timezone)}
              </dd>
              <dt className="text-muted">Süre</dt>
              <dd>{formatDuration(totals.durationMin)}</dd>
              {hasAnyPrice && (
                <>
                  <dt className="text-muted">Tutar</dt>
                  <dd>
                    {formatPrice(totals.priceCents)}{" "}
                    <span className="text-muted">(bilgi amaçlıdır, ödeme işletmede yapılır)</span>
                  </dd>
                </>
              )}
              <dt className="text-muted">Ad soyad</dt>
              <dd>{store.customer.fullName}</dd>
              <dt className="text-muted">Telefon</dt>
              <dd>{formatPhoneTR(store.customer.phone) || store.customer.phone}</dd>
              <dt className="text-muted">E-posta</dt>
              <dd>{store.customer.email}</dd>
              {fields
                .filter((f) => store.fieldAnswers[f.key]?.trim())
                .map((f) => (
                  <div key={f.id} className="contents">
                    <dt className="text-muted">{f.label}</dt>
                    <dd>{store.fieldAnswers[f.key]}</dd>
                  </div>
                ))}
              {store.note && (
                <>
                  <dt className="text-muted">Not</dt>
                  <dd>{store.note}</dd>
                </>
              )}
            </dl>
          </div>

          {settings.approval_mode === "manual" && (
            <p className="rounded-lg bg-accent-soft p-3 text-sm">
              Bu işletme randevuları kendisi onaylıyor. Onaylandığında randevularım sayfasında göreceksin.
            </p>
          )}

          {linkSent ? (
            <div role="status" className="rounded-lg bg-success-soft p-4 text-success">
              <p className="font-medium">E-postanı kontrol et</p>
              <p className="mt-1 text-sm">
                <strong>{store.customer.email}</strong> adresine bir giriş bağlantısı gönderdik. Bağlantıya tıkladığında
                randevun otomatik olarak tamamlanır. Gelmediyse gereksiz (spam) klasörüne de bak.
              </p>
              <button type="button" className="btn mt-3" onClick={() => setLinkSent(false)}>
                Farklı e-posta kullan
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={user ? submit : sendLoginLink}
              >
                {submitting ? "Bekle…" : user ? "Randevuyu onayla" : "E-postamla devam et"}
              </button>
              {!user && <DemoLoginForm next={`/${business.slug}/randevu?tamamla=1`} />}
            </>
          )}
        </div>
      )}

      {/* Gezinme */}
      {!(step === "summary" && linkSent) && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="btn" onClick={goBack} disabled={stepIndex === 0 || submitting}>
            Geri
          </button>
          {step !== "summary" && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                (step === "services" && store.items.length === 0) ||
                (step === "resource" && eligibleResources.length === 0) ||
                (step === "datetime" && !store.slot)
              }
              onClick={() => {
                if (step === "details" && !validateDetails()) return;
                goNext();
              }}
            >
              Devam
            </button>
          )}
        </div>
      )}

      {step === "services" && store.items.length > 0 && totals && (
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {store.items.length} / {MAX_ITEMS} seçildi · {formatDuration(totals.durationMin)}
          {hasAnyPrice ? ` · ${formatPrice(totals.priceCents)}` : ""}
        </p>
      )}
    </div>
  );
}

function ServiceStep({
  services,
  label,
  selected,
  onSelect,
  onRemove,
}: {
  services: ServiceWithVariants[];
  label: string;
  selected: { serviceId: string; variantId: string | null }[];
  onSelect: (serviceId: string, variantId: string | null) => void;
  onRemove: (serviceId: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ServiceWithVariants[]>();
    for (const s of services) {
      const key = s.category ?? "Diğer";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [services]);

  if (services.length === 0) {
    return <p className="text-muted">Bu işletme henüz {label.toLowerCase()} eklememiş.</p>;
  }

  return (
    <div className="grid gap-5">
      {groups.map(([category, list]) => (
        <section key={category} aria-label={category}>
          {groups.length > 1 && <h2 className="mb-2 text-sm font-medium text-muted">{category}</h2>}
          <div className="grid gap-2">
            {list.map((service) => {
              const current = selected.find((i) => i.serviceId === service.id);
              const hasVariants = service.service_variants.length > 0;
              if (!hasVariants) {
                return (
                  <button
                    key={service.id}
                    type="button"
                    className="chip flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-pressed={Boolean(current)}
                    onClick={() => (current ? onRemove(service.id) : onSelect(service.id, null))}
                  >
                    <span>
                      <span className="font-medium">{service.name}</span>
                      <span className="block text-sm text-muted">
                        {formatDuration(service.duration_min)}
                        {service.description ? ` · ${service.description}` : ""}
                      </span>
                    </span>
                    {formatPrice(service.price_cents) && <span className="shrink-0">{formatPrice(service.price_cents)}</span>}
                  </button>
                );
              }
              return (
                <div key={service.id} className="card p-3 sm:p-4">
                  <p className="font-medium">{service.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${service.name} seçenekleri`}>
                    {service.service_variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="chip"
                        aria-pressed={current?.variantId === v.id}
                        onClick={() => (current?.variantId === v.id ? onRemove(service.id) : onSelect(service.id, v.id))}
                      >
                        {v.name} <span className="text-muted">· {formatDuration(v.duration_min)}</span>
                        {formatPrice(v.price_cents) && <span className="text-muted"> · {formatPrice(v.price_cents)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
