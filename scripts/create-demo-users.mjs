// Demo hesaplarını oluşturur (ya da şifrelerini günceller) ve demo işletme sahibini demo işletmelere bağlar.
//
// Kullanım (kendi bilgisayarında, depo klasöründe):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   DEMO_CUSTOMER_PASSWORD=... DEMO_OWNER_PASSWORD=... node scripts/create-demo-users.mjs
//
// SUPABASE_SERVICE_ROLE_KEY çok güçlü bir anahtardır: yalnızca bu komut için ver, depoya ya da sohbete yazma.
// Aynı şifreleri sitenin sunucu ortam değişkenlerine (DEMO_CUSTOMER_PASSWORD) koyarsın.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const customerPassword = process.env.DEMO_CUSTOMER_PASSWORD;
const ownerPassword = process.env.DEMO_OWNER_PASSWORD;

if (!url || !serviceKey || !customerPassword || !ownerPassword) {
  console.error("Eksik değişken: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_CUSTOMER_PASSWORD, DEMO_OWNER_PASSWORD");
  process.exit(1);
}

const CUSTOMER_EMAIL = "demo-musteri@randevu.test";
const OWNER_EMAIL = "demo-isletme@randevu.test";
const DEMO_SLUGS = ["demo-berber", "demo-guzellik", "demo-oto-yikama"];

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function upsertUser(email, password) {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`Kullanıcılar listelenemedi: ${listError.message}`);
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw new Error(`${email} güncellenemedi: ${error.message}`);
    console.log(`güncellendi: ${email}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`${email} oluşturulamadı: ${error.message}`);
  console.log(`oluşturuldu: ${email}`);
  return data.user.id;
}

await upsertUser(CUSTOMER_EMAIL, customerPassword);
const ownerId = await upsertUser(OWNER_EMAIL, ownerPassword);

const { data: businesses, error: bizError } = await admin.from("businesses").select("id, slug").in("slug", DEMO_SLUGS);
if (bizError) throw new Error(`İşletmeler okunamadı: ${bizError.message}`);

for (const b of businesses) {
  const { error } = await admin
    .from("business_members")
    .upsert({ business_id: b.id, user_id: ownerId, role: "owner" }, { onConflict: "business_id,user_id" });
  if (error) throw new Error(`${b.slug} üyeliği eklenemedi: ${error.message}`);
  console.log(`bağlandı: ${OWNER_EMAIL} → ${b.slug}`);
}
