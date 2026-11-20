#!/usr/bin/env python3
"""Değişiklik raporu üretir (bkz. .github/workflows/degisiklik-raporu.yml).

Depo sahibi dışındaki birinin main dalına yaptığı her değişiklik için bir
GitHub kaydı (issue) açılır. Bu betik kaydın başlığını ve gövdesini hazırlar;
kaydı açmak iş akışının işidir.

Girdiler ortam değişkenlerinden okunur (iş akışı bunları doldurur):
    ONCEKI   değişiklikten önceki commit (push olayında "before")
    SONRAKI  değişiklikten sonraki commit ("after")
    YAPAN    değişikliği yapan GitHub kullanıcısı
    KAYNAK   "Asistan" gibi bilinen kaynak; boşsa commit mesajlarından çıkarılır
    ZORLA    "true" ise geçmiş yeniden yazılmıştır (force push)
    DEPO     sahip/depo
    SUNUCU   https://github.com

Çıktı: /tmp/rapor-baslik.txt ve /tmp/rapor-govde.md

Gövdenin sonuna makinenin okuyacağı bir işaret konur:
    <!-- rapor-araligi: ONCEKI SONRAKI -->
"Geri al" iş akışı (geri-al.yml) geri alınacak aralığı buradan okur. Aralık
güvenle geri alınamıyorsa (geçmiş yeniden yazılmışsa) işaret konmaz.

Yalnızca Python standart kütüphanesi kullanılır.
"""

from __future__ import annotations

import os
import re
import subprocess
from datetime import datetime, timedelta, timezone

SIFIR = "0" * 40
SHA = re.compile(r"^[0-9a-f]{40}$")
# GitHub kayıt gövdesi 65 536 karakterle sınırlı; farkı bunun altında tut.
FARK_SINIRI = 30000
# Tamamen üretilen dosyalar: farkları ilgili JSON değişikliğinin tekrarıdır.
URETILEN = (":(exclude)sitemap.xml", ":(exclude)blog-*.html")
KORUNAN = (".github/", "admin/")
ISTANBUL = timezone(timedelta(hours=3))


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout


def commit_var_mi(sha: str) -> bool:
    if not SHA.match(sha) or sha == SIFIR:
        return False
    r = subprocess.run(
        ["git", "cat-file", "-e", sha + "^{commit}"], capture_output=True
    )
    return r.returncode == 0


def citle(metin: str) -> str:
    """Kod bloğu içine güvenle gömülebilecek çit: içerikteki en uzun
    ters tırnak dizisinden bir fazla."""
    en_uzun = max((len(m) for m in re.findall(r"`+", metin)), default=0)
    return "`" * max(3, en_uzun + 1)


def kaynak_tahmin(konular: list[str]) -> str:
    if konular and all(k.startswith("Yönetim paneli:") for k in konular):
        return "Yönetim paneli"
    if konular and all(k.startswith("Asistan:") for k in konular):
        return "Asistan"
    return "Doğrudan değişiklik (git veya GitHub web arayüzü)"


def main() -> None:
    onceki = os.environ.get("ONCEKI", "").strip()
    sonraki = os.environ["SONRAKI"].strip()
    yapan = os.environ.get("YAPAN", "").strip() or "bilinmiyor"
    kaynak = os.environ.get("KAYNAK", "").strip()
    zorla = os.environ.get("ZORLA", "").strip().lower() == "true"
    depo = os.environ["DEPO"]
    sunucu = os.environ.get("SUNUCU", "https://github.com").rstrip("/")
    taban = f"{sunucu}/{depo}"

    # Aralık yalnızca iki uç da biliniyor ve önceki, sonrakinin atası ise
    # güvenilirdir. Zorla gönderimde eski uç artık geçmişte olmayabilir.
    aralik_gecerli = (
        commit_var_mi(onceki)
        and commit_var_mi(sonraki)
        and subprocess.run(
            ["git", "merge-base", "--is-ancestor", onceki, sonraki],
            capture_output=True,
        ).returncode == 0
    )
    if aralik_gecerli:
        aralik = [f"{onceki}..{sonraki}"]
        fark_bas = onceki
    else:
        # En azından son commit'in kendisini göster.
        aralik = ["-1", sonraki]
        fark_bas = sonraki + "^" if commit_var_mi(sonraki + "^") else None

    ayrac = "\x1f"
    kayitlar = []
    ham = git("log", "--reverse",
              f"--format=%H{ayrac}%an{ayrac}%aI{ayrac}%s{ayrac}%b\x1e", *aralik)
    for parca in ham.split("\x1e"):
        parca = parca.strip("\n")
        if not parca:
            continue
        h, ad, zaman, konu, govde = (parca.split(ayrac) + [""] * 5)[:5]
        kayitlar.append((h, ad, zaman, konu, govde.strip()))

    konular = [k[3] for k in kayitlar]
    if not kaynak:
        kaynak = kaynak_tahmin(konular)

    # ---- dosyalar
    dosyalar: list[tuple[str, str, str]] = []
    if fark_bas:
        for satir in git("diff", "--numstat", fark_bas, sonraki).splitlines():
            eklenen, silinen, yol = (satir.split("\t", 2) + ["", "", ""])[:3]
            dosyalar.append((yol, eklenen, silinen))
    korunan = [d[0] for d in dosyalar if d[0].startswith(KORUNAN)]

    fark = ""
    if fark_bas:
        fark = git("diff", fark_bas, sonraki, "--", ".", *URETILEN)
    kirpildi = len(fark) > FARK_SINIRI
    if kirpildi:
        fark = fark[:FARK_SINIRI].rsplit("\n", 1)[0]

    # ---- başlık
    ilk = konular[0] if konular else "değişiklik"
    ek = f" (+{len(konular) - 1} işlem)" if len(konular) > 1 else ""
    uyari = "⚠️ " if (korunan or zorla) else ""
    baslik = f"{uyari}[Rapor] {yapan} · {ilk}{ek}"
    if len(baslik) > 120:
        baslik = baslik[:117] + "…"

    # ---- gövde
    simdi = datetime.now(ISTANBUL).strftime("%d.%m.%Y %H:%M")
    g: list[str] = []
    g.append("## Değişiklik raporu\n")
    # Kullanıcı adı kod biçiminde yazılır: @ ile anılırsa her raporda o
    # kişiye bildirim gider.
    g.append(f"| | |\n|---|---|")
    g.append(f"| **Yapan** | `{yapan}` |")
    g.append(f"| **Kaynak** | {kaynak} |")
    g.append(f"| **Zaman** | {simdi} (İstanbul) |")
    if aralik_gecerli:
        g.append(f"| **Karşılaştır** | [{onceki[:7]}…{sonraki[:7]}]"
                 f"({taban}/compare/{onceki}...{sonraki}) |")
    else:
        g.append(f"| **Commit** | [{sonraki[:7]}]({taban}/commit/{sonraki}) |")
    g.append("")

    if zorla or not aralik_gecerli:
        g.append("> [!WARNING]")
        g.append("> **Geçmiş yeniden yazılmış olabilir** (zorla gönderim). "
                 "Önceki durum artık dalın geçmişinde görünmüyor; aşağıda "
                 "yalnızca son commit gösteriliyor. Bu değişiklik otomatik "
                 "olarak geri alınamaz.")
        g.append("")
    if korunan:
        g.append("> [!CAUTION]")
        g.append("> **Korunan dosyalara dokunuldu.** Yayın hattı (`.github/`) "
                 "veya yönetim paneli (`admin/`) değişti. Bu dosyalar sitenin "
                 "nasıl yayınlandığını ve bu raporun kendisini belirler; "
                 "dikkatle inceleyin.")
        for yol in korunan:
            g.append(f"> - `{yol}`")
        g.append("")

    g.append("### İşlemler\n")
    for h, ad, zaman, konu, govde in kayitlar:
        g.append(f"- [`{h[:7]}`]({taban}/commit/{h}) {konu}")
        if govde:
            cit = citle(govde)
            g.append("  <details><summary>Ayrıntı</summary>\n")
            g.append(f"  {cit}text")
            for s in govde.splitlines():
                g.append(f"  {s}")
            g.append(f"  {cit}")
            g.append("  </details>")
    g.append("")

    if dosyalar:
        g.append("### Değişen dosyalar\n")
        g.append("| Dosya | + | − |\n|---|--:|--:|")
        for yol, eklenen, silinen in dosyalar:
            g.append(f"| `{yol}` | {eklenen} | {silinen} |")
        g.append("")

    if fark:
        cit = citle(fark)
        g.append("<details><summary><strong>Farkı göster</strong></summary>\n")
        g.append(f"{cit}diff")
        g.append(fark)
        g.append(cit)
        if kirpildi:
            g.append("\n*Fark uzun olduğu için kırpıldı; tamamı için yukarıdaki "
                     "karşılaştırma bağlantısına bakın.*")
        g.append("</details>\n")

    g.append("### Müdahale\n")
    g.append("- İnceleyip sorun görmediyseniz bu kaydı **kapatın**.")
    if aralik_gecerli:
        g.append("- Değişikliği geri almak için bu kayda `/geri-al` yazın. "
                 "Geri alma yeni bir commit olarak eklenir ve site yeniden "
                 "yayınlanır; yalnızca depo sahibinin yorumu işleme alınır.")
    else:
        g.append("- Bu değişiklik otomatik geri alınamıyor; gerekirse "
                 "commit'i elle geri alın.")
    g.append("")
    if aralik_gecerli:
        g.append(f"<!-- rapor-araligi: {onceki} {sonraki} -->")

    with open("/tmp/rapor-baslik.txt", "w", encoding="utf-8") as f:
        f.write(baslik)
    with open("/tmp/rapor-govde.md", "w", encoding="utf-8") as f:
        f.write("\n".join(g) + "\n")
    print(baslik)


if __name__ == "__main__":
    main()
