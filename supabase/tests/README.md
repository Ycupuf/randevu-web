# Veritabanı testleri

Çakışma kısıtı, RLS, tetikleyiciler, e-posta kuyruğu, bildirimler ve demo korumaları gibi **kritik davranışlar SQL'de**
yaşar; bu yüzden SQL'de test edilir. Her dosya tek bir `do $$ ... $$` bloğudur:

- Blok **her zaman bir istisnayla biter** ve işlem geri alınır: hiçbir veri kalıcı değişmez.
- Başarı: hata metni `TEST_OK` ile başlar. Başarısızlık: `ASSERT` hatası ya da başka bir istisna.
- Testler gerçek şemaya ve **demo tohum verisine** (`demo-berber`, `demo-isletme@randevu.test`, `demo-musteri@randevu.test`)
  dayanır. Personel testleri için bu iki hesaptan başka en az bir `auth.users` kaydı gerekir; yoksa o test atlanır.

Çalıştırma (Supabase panelinde Database > Connection string > URI; şifreyi sen girersin):

```bash
DATABASE_URL='postgresql://postgres:...@db.<proje>.supabase.co:5432/postgres' ./scripts/run-db-tests.sh
```

CI'da çalışmaz: gerçek bir veritabanına bağlanır. Geliştirme veritabanında ya da bir Supabase dalında (branch) çalıştır;
üretimde çalıştırmak da güvenlidir (her test geri alınır) ama önerilmez.
