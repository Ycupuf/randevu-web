#!/usr/bin/env bash
# supabase/tests/*.sql dosyalarını DATABASE_URL'deki veritabanına karşı çalıştırır (bkz. supabase/tests/README.md).
# Her test işlem geri alınarak biter; başarı = çıktıda "TEST_OK".
set -u
: "${DATABASE_URL:?DATABASE_URL gerekli (Supabase > Database > Connection string > URI)}"
command -v psql >/dev/null || { echo "psql bulunamadı"; exit 2; }

# TEST_OK: geçti. TEST_SKIPPED: önkoşul (örn. 3. auth kullanıcısı) yok, hiçbir şey doğrulanmadı.
# STRICT=1 ise atlanan test de başarısızlık sayılır.
fail=0
skipped=0
for f in "$(dirname "$0")"/../supabase/tests/*.sql; do
  out=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -X -q -f "$f" 2>&1)
  if grep -q "TEST_OK" <<<"$out"; then
    printf '  ✓ %s  (%s)\n' "$(basename "$f")" "$(grep -o 'TEST_OK[^"]*' <<<"$out" | head -1)"
  elif grep -q "TEST_SKIPPED" <<<"$out"; then
    printf '  ⚠ %s  ATLANDI: %s\n' "$(basename "$f")" "$(grep -o 'TEST_SKIPPED[^"]*' <<<"$out" | head -1)"
    skipped=$((skipped + 1))
  else
    printf '  ✗ %s\n%s\n' "$(basename "$f")" "$out"
    fail=1
  fi
done
if [ "$skipped" -gt 0 ]; then
  echo "$skipped test atlandı (hiçbir şey doğrulanmadı)."
  [ "${STRICT:-0}" = "1" ] && fail=1
fi
exit $fail
