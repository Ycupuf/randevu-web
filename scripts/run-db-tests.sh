#!/usr/bin/env bash
# supabase/tests/*.sql dosyalarını DATABASE_URL'deki veritabanına karşı çalıştırır (bkz. supabase/tests/README.md).
# Her test işlem geri alınarak biter; başarı = çıktıda "TEST_OK".
set -u
: "${DATABASE_URL:?DATABASE_URL gerekli (Supabase > Database > Connection string > URI)}"
command -v psql >/dev/null || { echo "psql bulunamadı"; exit 2; }

fail=0
for f in "$(dirname "$0")"/../supabase/tests/*.sql; do
  out=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -X -q -f "$f" 2>&1)
  if grep -q "TEST_OK" <<<"$out"; then
    printf '  ✓ %s  (%s)\n' "$(basename "$f")" "$(grep -o 'TEST_OK[^"]*' <<<"$out" | head -1)"
  else
    printf '  ✗ %s\n%s\n' "$(basename "$f")" "$out"
    fail=1
  fi
done
exit $fail
