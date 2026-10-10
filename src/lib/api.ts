import { NextResponse } from "next/server";
import { isKnownDbError, translateDbError } from "@/lib/errors";

/**
 * Veritabanı hatasını API yanıtına çevirir. Tüm route'lar aynı biçimi döndürür:
 * `error` kullanıcıya gösterilecek metin, `code` istemcinin akış kararı için kullandığı sabit anahtar.
 */
export function dbErrorResponse(error: { message?: string | null }) {
  const info = translateDbError(error);
  const code = isKnownDbError(error) ? error.message?.trim() : undefined;
  return NextResponse.json({ error: info.message, code }, { status: info.status });
}
