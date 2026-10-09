import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Proje hakkında",
  description: "Randevu: çok sektörlü online randevu sistemi. Müşteri sitesi ve işletme paneli, canlı demo ile.",
};

const PANEL_URL = process.env.NEXT_PUBLIC_PANEL_URL ?? "https://randevu-panel-psi.vercel.app";
const WEB_REPO = "https://github.com/Ycupuf/randevu-web";
const PANEL_REPO = "https://github.com/Ycupuf/randevu-panel";

const STEPS = [
  {
    title: "Müşteri olarak randevu al",
    body: "Bir işletme seç, hizmeti ve saati seç. Son adımda \"Demo hesabıyla devam et\" düğmesi e-posta istemeden seni içeri alır.",
    href: "/demo-berber/randevu",
    cta: "Demo Berber'de randevu al",
    external: false,
  },
  {
    title: "İşletme panelinde gör",
    body: "Panelde \"Demo hesabıyla devam et\" ile gir. Az önce aldığın randevu takvimde görünür.",
    href: PANEL_URL,
    cta: "Paneli aç",
    external: true,
  },
  {
    title: "Onayla, ertele, raporla",
    body: "Randevuyu onayla ya da saatini değiştir. Müşteri sitesinde \"Randevularım\" sayfasında durumun güncellendiğini gör. Rapor sekmesine de bak.",
    href: "/randevularim",
    cta: "Randevularım",
    external: false,
  },
] as const;

const HIGHLIGHTS = [
  {
    title: "Çifte rezervasyon fiziksel olarak mümkün değil",
    body: "Çakışma kontrolü uygulama kodunda değil, PostgreSQL'de (EXCLUDE kısıtı). İki kişi aynı saniyede aynı saati almaya çalışsa bile biri reddedilir. Panelden elle randevu girerken de aynı kural geçerlidir.",
  },
  {
    title: "Veri izolasyonu veritabanında",
    body: "Supabase Row Level Security: müşteri yalnızca kendi randevusunu, işletme yalnızca kendi verisini görür. Başka işletmenin varlığı bile sızmaz.",
  },
  {
    title: "Tek model, her sektör",
    body: "Hizmet + kaynak (personel, yıkama bayı, oda) + zaman. Kuaför, güzellik merkezi ve oto yıkama aynı çekirdeği kullanır; fark etiketlerde, ek sorularda (araç plakası gibi) ve seçeneklerde (araç tipine göre süre ve fiyat).",
  },
  {
    title: "Saat dilimi doğru",
    body: "Veritabanında UTC, ekranda Europe/Istanbul. Gün sınırları, kapanışa sığmayan hizmetler, mola ve hazırlık payı birim testleriyle korunur.",
  },
  {
    title: "Test ve CI",
    body: "İki repoda 200'ün üzerinde Vitest birim testi, masaüstü ve mobil Playwright senaryoları, her push'ta tip kontrolü, lint, derleme ve uçtan uca testler (GitHub Actions).",
  },
  {
    title: "Güvenlik ayrıntıları",
    body: "Şifresiz giriş (magic link), açık yönlendirme koruması, güvenlik başlıkları, yazma işlemleri yalnızca doğrulama yapan RPC fonksiyonlarından, gizli anahtarlar depoda yok.",
  },
] as const;

export default function ProjectPage() {
  return (
    <div className="grid gap-10">
      <section>
        <p className="text-sm font-medium text-accent">Portfolyo projesi</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Randevu</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Kuaför, güzellik merkezi ve oto yıkama gibi randevuyla çalışan küçük işletmeler için ücretsiz, ödemesiz bir randevu
          sistemi. İki uygulamadan oluşur: <strong>müşterinin randevu aldığı site</strong> ve <strong>işletme sahibinin
          paneli</strong>. İkisi aynı veritabanını kullanır ve canlıda çalışır.
        </p>
      </section>

      <section aria-labelledby="dene">
        <h2 id="dene" className="text-xl font-semibold">
          2 dakikada dene
        </h2>
        <p className="mt-1 text-muted">Hesap açmana ya da e-posta vermene gerek yok.</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex flex-col gap-2">
              <span className="text-sm font-medium text-muted">Adım {i + 1}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted">{s.body}</p>
              {s.external ? (
                <a href={s.href} target="_blank" rel="noreferrer" className="btn btn-primary mt-auto">
                  {s.cta} ↗
                </a>
              ) : (
                <Link href={s.href} className="btn btn-primary mt-auto">
                  {s.cta}
                </Link>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">
          Demo hesapları herkesle paylaşılır. İşletme sahibi demosu her girişte örnek verilerle sıfırlanır; müşteri demosunda
          yalnızca kendi randevuların sıfırlanır. Gerçek bir e-postayla giriş de çalışır.
        </p>
      </section>

      <section aria-labelledby="neler">
        <h2 id="neler" className="text-xl font-semibold">
          Neye bakmaya değer
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="card">
              <h3 className="font-semibold">{h.title}</h3>
              <p className="mt-1 text-sm text-muted">{h.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="teknoloji" className="card">
        <h2 id="teknoloji" className="text-xl font-semibold">
          Teknolojiler
        </h2>
        <p className="mt-2 text-muted">
          Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind 4 · Supabase (PostgreSQL, Auth, RLS, RPC) · TanStack
          Query · Zustand · zod · date-fns · Vitest · Playwright · GitHub Actions · Vercel
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          <a className="underline underline-offset-2" href={WEB_REPO} target="_blank" rel="noreferrer">
            Müşteri sitesi kodu ↗
          </a>
          <a className="underline underline-offset-2" href={PANEL_REPO} target="_blank" rel="noreferrer">
            İşletme paneli kodu ↗
          </a>
        </p>
      </section>

      <section aria-labelledby="eksik">
        <h2 id="eksik" className="text-xl font-semibold">
          Bilinçli olarak yapılmayanlar
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Canlı e-posta gönderimi (onay, iptal, 24 saat hatırlatma: kuyruk, şablonlar ve zamanlanmış işler hazır, Resend
          anahtarı ve alan adı eklenince açılır), captcha, hafta/ay takvim görünümü, personel davet akışı ve mobil uygulama
          kapsam dışı bırakıldı. KVKK metni bir şablondur; gerçek kullanımda hukuki gözden geçirme gerekir. Amaç satmak
          değil, çalışan ve test edilmiş bir sistemi göstermektir.
        </p>
      </section>
    </div>
  );
}
