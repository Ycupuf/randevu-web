import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { dataRequestSchema } from "@/lib/schemas";

// POST /api/me/data-request : KVKK kapsamında verilerini indirme ya da silme talebi oluşturur.
// Talep kaydedilir; işletme/yönetici tarafından işlenir (otomatik silme yapılmaz).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const parsed = dataRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const supabase = await createClient();

  // Aynı türden açık talep varsa tekrar oluşturma
  const { data: existing } = await supabase
    .from("data_requests")
    .select("id")
    .eq("kind", parsed.data.kind)
    .eq("status", "open")
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, alreadyOpen: true });
  }

  const { error } = await supabase
    .from("data_requests")
    .insert({ user_id: user.id, kind: parsed.data.kind });
  if (error) {
    return NextResponse.json({ error: "Talebin kaydedilemedi. Biraz sonra tekrar dene." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
