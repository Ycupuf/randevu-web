import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";
import { hardenSessionCookie } from "./cookies";

/**
 * Sunucuda (sayfa, route handler) kullanılan Supabase istemcisi. Oturumu çerezlerden okur.
 * Next 16'da `cookies()` asenkrondur.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, hardenSessionCookie(options));
            }
          } catch {
            // Sunucu bileşenlerinde çerez yazılamaz; oturumu proxy.ts zaten yeniliyor.
          }
        },
      },
    },
  );
}

/** Giriş yapmış kullanıcının kimliği ve e-postası; yoksa null. */
export async function getCurrentUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
