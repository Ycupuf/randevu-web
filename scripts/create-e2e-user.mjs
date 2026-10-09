// Uçtan uca testler için bir test kullanıcısı oluşturur (ya da şifresini günceller).
//
// Kullanım (kendi bilgisayarında, depo klasöründe):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... E2E_EMAIL=e2e@ornek.test E2E_PASSWORD=... \
//     node scripts/create-e2e-user.mjs
//
// SUPABASE_SERVICE_ROLE_KEY çok güçlü bir anahtardır: yalnızca yerelde, bu komut için ver; depoya,
// tarayıcıya ya da sohbete yazma. Anahtar Supabase panelinde Project Settings > API Keys altında.
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, E2E_EMAIL: email, E2E_PASSWORD: password } =
  process.env;

if (!url || !serviceKey || !email || !password) {
  console.error("Eksik değişken: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_EMAIL, E2E_PASSWORD");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) {
  console.error("Kullanıcılar listelenemedi:", listError.message);
  process.exit(1);
}
const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (error) {
    console.error("Kullanıcı güncellenemedi:", error.message);
    process.exit(1);
  }
  console.log(`Test kullanıcısı güncellendi: ${email}`);
} else {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error("Kullanıcı oluşturulamadı:", error.message);
    process.exit(1);
  }
  console.log(`Test kullanıcısı oluşturuldu: ${email}`);
}
