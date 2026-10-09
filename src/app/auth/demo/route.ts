import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";

// POST /auth/demo : e-posta gerektirmeden ortak DEMO müşteri hesabıyla giriş yaptırır.
// Amaç siteyi denemek isteyenin (örn. bir işe alım uzmanının) e-posta kutusuna ihtiyaç duymamasıdır.
// Şifre yalnızca sunucu ortam değişkenlerinden okunur, tarayıcıya hiç gitmez. Ortak hesap her girişte
// sıfırlanır (reset_demo_customer). Değişkenler tanımlı değilse özellik kapalıdır.
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const form = await request.formData().catch(() => null);
  const next = safeNext(typeof form?.get("next") === "string" ? (form?.get("next") as string) : null, "/randevularim");

  const email = process.env.DEMO_CUSTOMER_EMAIL;
  const password = process.env.DEMO_CUSTOMER_PASSWORD;
  if (!email || !password) {
    return NextResponse.redirect(new URL("/giris?hata=demo", origin), { status: 303 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.redirect(new URL("/giris?hata=demo", origin), { status: 303 });
  }
  await supabase.rpc("reset_demo_customer");

  // 303: yönlendirmeden sonra tarayıcı GET ile hedef sayfaya gider
  return NextResponse.redirect(new URL(next, origin), { status: 303 });
}
