#!/usr/bin/env bash
# Bir değişiklik raporundaki aralığı geri alır (bkz. geri-al.yml).
#
# Girdiler (ortam değişkenleri):
#   GOVDE              raporun gövdesi; aralık sonundaki işaretten okunur
#   KAYIT              rapor kaydının numarası
#   GITHUB_REPOSITORY  sahip/depo
#   GITHUB_SERVER_URL  https://github.com
#   GITHUB_OUTPUT      sonuç buraya yazılır: sonuc=geri-alindi | yok
#
# Geri alma yeni bir commit'tir; geçmiş yeniden yazılmaz. Çakışma çıkarsa
# hiçbir şey gönderilmez, durum kayda yorum olarak yazılır.

set -euo pipefail

TABAN="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}"

yorum() { gh issue comment "$KAYIT" --repo "$GITHUB_REPOSITORY" --body "$1"; }
bitir() { echo "sonuc=$1" >> "$GITHUB_OUTPUT"; exit 0; }

# --- aralığı oku ve doğrula
# Kayıt gövdesi düzenlenebilir olduğundan işaret sıkı biçimde ayrıştırılır
# ve iki uç da gerçek, sıralı commit'ler olmalıdır.
ARALIK=$(printf '%s' "$GOVDE" \
  | grep -oE 'rapor-araligi: [0-9a-f]{40} [0-9a-f]{40}' | head -n 1 || true)
if [ -z "$ARALIK" ]; then
  yorum "Bu kayıtta geri alınabilecek bir aralık yok (geçmiş yeniden yazılmış olabilir). Değişikliği elle geri alın."
  bitir yok
fi
ONCEKI=$(printf '%s' "$ARALIK" | cut -d' ' -f2)
SONRAKI=$(printf '%s' "$ARALIK" | cut -d' ' -f3)

if ! git merge-base --is-ancestor "$ONCEKI" "$SONRAKI" 2>/dev/null \
   || ! git merge-base --is-ancestor "$SONRAKI" HEAD 2>/dev/null; then
  yorum "Rapordaki commit'ler main dalının geçmişinde bulunamadı; otomatik geri alma güvenli değil. Değişikliği elle geri alın."
  bitir yok
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# --- geri al (tek commit)
# Aralıktaki her commit tersten uygulanır ve tek bir geri alma commit'inde
# toplanır. Sonradan aynı satırlara dokunan bir değişiklik varsa çakışır.
if ! git revert --no-commit "${ONCEKI}..${SONRAKI}" 2>/tmp/geri-al-hata.txt; then
  git revert --abort 2>/dev/null || true
  yorum "Geri alınamadı: bu değişiklikten sonra aynı yerlere dokunan başka değişiklikler yapılmış, otomatik geri alma çakışıyor. Hiçbir şey değiştirilmedi.

Daha yeni raporları önce geri almayı deneyebilir ya da değişikliği elle düzeltebilirsiniz."
  bitir yok
fi

# Geri alınan JSON'a göre sayfalar yeniden üretilir.
python3 tools/build.py

git add -A
if git diff --cached --quiet; then
  yorum "Geri alınacak bir fark kalmamış; bu değişiklik zaten geri alınmış görünüyor."
  bitir yok
fi

{
  printf 'Geri alındı: rapor #%s\n\n' "$KAYIT"
  printf 'Aralık %s..%s depo sahibinin isteğiyle geri alındı.\n' \
    "${ONCEKI:0:7}" "${SONRAKI:0:7}"
} > /tmp/geri-al-mesaj.txt
git commit -q -F /tmp/geri-al-mesaj.txt

if ! git push -q origin HEAD:main 2>/tmp/geri-al-hata.txt; then
  yorum "Geri alma hazırlandı ama gönderilemedi. İki olası neden: (1) bu arada main dalına başka bir değişiklik geldi — tekrar \`/geri-al\` yazın; (2) değişiklik iş akışı dosyalarına (\`.github/workflows/\`) dokunuyor — GitHub bu dosyaların otomatik değiştirilmesine izin vermez, elle geri almanız gerekir."
  exit 1
fi

YENI=$(git rev-parse HEAD)
yorum "Geri alındı: [\`${YENI:0:7}\`](${TABAN}/commit/${YENI}). Site birkaç dakika içinde yeniden yayınlanacak."

gh label create geri-alindi --repo "$GITHUB_REPOSITORY" \
  --color B60205 --description "Değişiklik sahibi tarafından geri alındı" \
  2>/dev/null || true
gh issue edit "$KAYIT" --repo "$GITHUB_REPOSITORY" --add-label geri-alindi
gh issue close "$KAYIT" --repo "$GITHUB_REPOSITORY"

bitir geri-alindi
