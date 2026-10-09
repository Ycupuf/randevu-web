import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

// POST /auth/signout : oturumu kapatır. POST olması, bir bağlantıyla yanlışlıkla çıkış yapılmasını önler.
export async function POST(request: NextRequest) {
  // Başka bir sitenin gizli formuyla tetiklenemez (login CSRF)
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303: yönlendirme sonrası tarayıcı GET ile ana sayfaya gider
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
