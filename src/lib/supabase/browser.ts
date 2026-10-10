import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";
import { BROWSER_COOKIE_OPTIONS } from "./cookies";

/** Tarayıcıda kullanılan Supabase istemcisi (yalnızca yayınlanabilir anahtar; erişimi RLS sınırlar). */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: BROWSER_COOKIE_OPTIONS },
  );
}
