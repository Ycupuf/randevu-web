import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik ve KVKK aydınlatma metni",
  description: "Randevu sisteminde hangi kişisel verilerin neden işlendiği ve haklarının neler olduğu.",
};

// Not: Bu metin genel bir şablondur. Canlı kullanımdan önce platformu işleten kişi/kurum için
// veri sorumlusu bilgileri ve iletişim adresi doldurulmalı, bir hukukçuya gösterilmelidir.
export default function PrivacyPage() {
  return (
    <article className="prose-sm mx-auto grid max-w-2xl gap-5 leading-7">
      <h1 className="text-2xl font-semibold">Gizlilik ve KVKK aydınlatma metni</h1>
      <p className="text-sm text-muted">Son güncelleme: 9 Ekim 2026</p>

      <section>
        <h2 className="text-lg font-semibold">Hangi verileri topluyoruz?</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>Ad ve soyadın, cep telefonun, e-posta adresin.</li>
          <li>Randevu bilgilerin: işletme, hizmet, kişi, tarih ve saat, varsa not ve işletmenin istediği ek bilgiler (örneğin araç plakası ya da alerji notu).</li>
          <li>Giriş yaparken oturum çerezi. Şifre saklamıyoruz; giriş e-postana gönderilen bağlantıyla yapılır.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Neden işliyoruz?</h2>
        <p className="mt-2">
          Randevunu oluşturmak, işletmeyle iletişim kurabilmek, randevunu değiştirmeni ya da iptal etmeni sağlamak ve
          sana randevuyla ilgili e-posta göndermek için. Hukuki sebebimiz, talep ettiğin hizmetin sunulması için verinin
          işlenmesinin gerekli olması ve açık rızandır.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Kimlerle paylaşıyoruz?</h2>
        <p className="mt-2">
          Randevu bilgilerin yalnızca randevu aldığın işletmeyle ve o işletmede çalışan yetkili kişilerle paylaşılır.
          Başka işletmeler bilgilerini göremez. Verilerini satmıyor, reklam amacıyla kullanmıyoruz. Teknik altyapı
          (veritabanı ve e-posta gönderimi) için hizmet aldığımız sağlayıcılar verileri bizim adımıza işler.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Ne kadar süre saklıyoruz?</h2>
        <p className="mt-2">
          Hesabın açık olduğu sürece. Silme talebinde bulunduğunda hesabın ve sana bağlı kişisel verilerin kaldırılır;
          yasal saklama yükümlülüğü olan kayıtlar bu süre boyunca tutulur.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Haklarının neler?</h2>
        <p className="mt-2">KVKK madde 11 uyarınca şunları yapabilirsin:</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Verilerinin işlenip işlenmediğini öğrenmek ve bilgi istemek,</li>
          <li>Verilerinin kopyasını almak,</li>
          <li>Yanlış ya da eksik verilerin düzeltilmesini istemek,</li>
          <li>Verilerinin silinmesini veya yok edilmesini talep etmek,</li>
          <li>İşlemeye itiraz etmek ve zarara uğraman hâlinde tazminat talep etmek.</li>
        </ul>
        <p className="mt-2">
          Veri kopyası ve silme taleplerini{" "}
          <Link href="/hesabim" className="underline underline-offset-2">
            Hesabım
          </Link>{" "}
          sayfasından iletebilirsin.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Çerezler</h2>
        <p className="mt-2">
          Yalnızca oturumunu açık tutan zorunlu çerezleri ve randevu formundaki seçimlerini kısa süre (1 saat)
          hatırlayan yerel depolamayı kullanıyoruz. Reklam veya izleme çerezi yok.
        </p>
      </section>
    </article>
  );
}
