#!/usr/bin/env python3
"""Site üretici — data/*.json dosyalarından HTML üretir.

Site statik kalır; bu betik yalnızca HTML içindeki işaretli bölgeleri
yeniden yazar. Böylece sayfalar elle de düzenlenebilir, yönetim paneli
de yalnızca JSON'a dokunarak içeriği güncelleyebilir.

İşaret biçimi:

    <!-- OTO:projeler -->
    ... bu bölge her derlemede yeniden üretilir ...
    <!-- /OTO:projeler -->

Kullanım:
    python3 tools/build.py            # üret
    python3 tools/build.py --kontrol  # üretilen çıktı güncel mi (CI için)

Blog yazıları için ayrıca blog-<slug>.html sayfaları ve sitemap.xml
yeniden üretilir.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERI = os.path.join(KOK, "data")

ALAN_ADI = "https://fatmakocaovamimarlik.com"


# ---------------------------------------------------------------- yardımcı
def veri(ad):
    with open(os.path.join(VERI, ad + ".json"), encoding="utf-8") as f:
        return json.load(f)


def kacis(s):
    """Metni HTML'e güvenli biçimde gömer."""
    return html.escape(str(s), quote=True)


# --------------------------------------------------------------- görseller
# Google Drive'ın paylaşım adresi bir HTML sayfasıdır, doğrudan görsel değil.
# Dosya kimliği çıkarılıp Google'ın görsel sunucusuna çevrilir; oradan
# istenen genişlikte servis edilir (=w1600 gibi bir sonek yeterlidir).
DRIVE_DESENLERI = (
    re.compile(r"drive\.google\.com/file/d/([\w-]{20,})"),
    re.compile(r"drive\.google\.com/open\?id=([\w-]{20,})"),
    re.compile(r"drive\.google\.com/uc\?(?:export=\w+&)?id=([\w-]{20,})"),
    re.compile(r"drive\.google\.com/thumbnail\?id=([\w-]{20,})"),
    re.compile(r"docs\.google\.com/uc\?(?:export=\w+&)?id=([\w-]{20,})"),
)


def drive_kimligi(ham):
    """Drive adresinden dosya kimliğini çıkarır; Drive değilse None."""
    metin = (ham or "").strip()
    for desen in DRIVE_DESENLERI:
        m = desen.search(metin)
        if m:
            return m.group(1)
    # Yalnızca kimliğin kendisi yapıştırılmış olabilir
    if re.fullmatch(r"[\w-]{25,}", metin):
        return metin
    return None


def gorsel_adresi(ham, genislik=1600):
    """Ham adresi tarayıcının doğrudan gösterebileceği bir adrese çevirir.
    Drive değilse (depo içi yol, başka bir CDN) olduğu gibi bırakılır."""
    kimlik = drive_kimligi(ham)
    if kimlik:
        return f"https://lh3.googleusercontent.com/d/{kimlik}=w{genislik}"
    return (ham or "").strip()


def gorsel_seti(ham):
    """srcset için iki ölçek. Drive dışı adreslerde srcset üretilmez."""
    kimlik = drive_kimligi(ham)
    if not kimlik:
        return ""
    tabun = f"https://lh3.googleusercontent.com/d/{kimlik}"
    return f"{tabun}=w800 800w, {tabun}=w1600 1600w"


def drive_video_adresi(ham):
    """Video ögeleri için Drive'ın kendi oynatıcısını gömme adresi.
    lh3 yalnızca görsel/kare üretir; oynatma için Drive'ın /preview
    çerçevesi gerekir (Drive dosyayı kendi oynatıcısıyla akıtır)."""
    kimlik = drive_kimligi(ham)
    if kimlik:
        return f"https://drive.google.com/file/d/{kimlik}/preview"
    return (ham or "").strip()


def medya_listesi(p):
    """gorseller dizisini {'adres':..., 'video': bool} sözlüklerine
    normalleştirir. Panelde eskiden beri düz metin (adres) olarak
    tutuluyordu; video işaretlemesi gerektiğinde öge yerine
    {"adres": ..., "video": true} nesnesi de kabul edilir."""
    sonuc = []
    for oge in p.get("gorseller") or []:
        if isinstance(oge, dict):
            adres = str(oge.get("adres") or "").strip()
            video = bool(oge.get("video"))
        else:
            adres = str(oge or "").strip()
            video = False
        if adres:
            sonuc.append({"adres": adres, "video": video})
    return sonuc


def slugla(metin):
    tr = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosucgiosu")
    s = metin.translate(tr).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "yazi"


def bolge_yaz(html_metni, ad, icerik):
    """<!-- OTO:ad --> ... <!-- /OTO:ad --> arasını değiştirir."""
    desen = re.compile(
        r"(<!-- OTO:" + re.escape(ad) + r" -->)(.*?)(<!-- /OTO:" + re.escape(ad) + r" -->)",
        re.S,
    )
    if not desen.search(html_metni):
        return html_metni, False
    return desen.sub(lambda m: m.group(1) + "\n" + icerik + m.group(3), html_metni), True


# ================================================================ parçalar
def parca_footer_liste(s):
    i = s["iletisim"]
    return f"""        <ul class="footer-list">
          <li><a class="link-underline" href="mailto:{kacis(i['eposta'])}">{kacis(i['eposta'])}</a></li>
          <li><a class="link-underline" href="tel:{kacis(i['telefonHam'])}">{kacis(i['telefon'])}</a></li>
          <li>{kacis(i['adresSatir1'])}<br>{kacis(i['adresSatir2'])}</li>
        </ul>
"""


LOGO_ETIKET = "Fatma Kocaova Mimarlık — Anasayfa"


def logo_gorsel(yol, oran, yukseklik, sinif=""):
    """Tek bir <img> etiketi. Oran biliniyorsa genişlik/yükseklik yazılır ki
    sayfa yüklenirken logo yerini kaplasın ve düzen zıplamasın."""
    ek = f" {sinif}" if sinif else ""
    olcu = ""
    if oran:
        olcu = f' width="{round(yukseklik * oran)}" height="{yukseklik}"'
    return (f'<img class="logo__img{ek}" src="{kacis(yol)}" alt=""'
            f'{olcu} loading="eager" decoding="async">')


def logo_satirlari(s, yer):
    """Marka kilidinin iç satırları. yer: 'baslik' | 'alt'

    Panelden görsel yüklenmediyse site tipografisiyle kurulan kilit kullanılır.
    """
    g = s.get("logo") or {}
    tur = g.get("tur") or "yazi"
    yukseklik = int(g.get("yukseklikBaslik" if yer == "baslik" else "yukseklikAlt") or 30)
    acik, koyu = g.get("acik") or "", g.get("koyu") or ""

    if tur == "tekGorsel" and acik:
        # Tek dosya: koyu zeminde CSS ile ters çevrilir.
        return [logo_gorsel(acik, g.get("acikOran"), yukseklik, "logo__img--tersle")]

    if tur == "ikiGorsel" and (acik or koyu):
        if acik and koyu:
            return [logo_gorsel(koyu, g.get("koyuOran"), yukseklik, "logo__img--koyu"),
                    logo_gorsel(acik, g.get("acikOran"), yukseklik, "logo__img--acik")]
        tek = acik or koyu
        oran = g.get("acikOran") if acik else g.get("koyuOran")
        return [logo_gorsel(tek, oran, yukseklik)]

    # Yazı ile kurulan kilit
    ad = "Fatma Kocaova" if yer == "baslik" else "Fatma<br>Kocaova"
    return ['<span class="logo__kare" aria-hidden="true"></span>',
            '<span>',
            f'  <span class="logo__ad">{ad}</span>',
            '  <span class="logo__alt">mimarlık / architecture</span>',
            '</span>']


def logo_kilit(s, yer, girinti):
    g = s.get("logo") or {}
    gorselMi = (g.get("tur") in ("tekGorsel", "ikiGorsel")) and (g.get("acik") or g.get("koyu"))
    sinif = "logo logo--gorsel" if gorselMi else (
        "logo logo--satir" if yer == "baslik" else "logo logo--yigin")
    b = " " * girinti
    ic = "".join(f"{b}  {satir}\n" for satir in logo_satirlari(s, yer))
    stil = ""
    if gorselMi:
        y = int(g.get("yukseklikBaslik" if yer == "baslik" else "yukseklikAlt") or 30)
        stil = f' style="--logo-y:{y}px"'
    return (f'{b}<a class="{sinif}"{stil} href="index.html" aria-label="{LOGO_ETIKET}">\n'
            f'{ic}'
            f'{b}</a>\n')


def parca_logo_baslik(s):
    return logo_kilit(s, "baslik", 4)


def parca_footer_marka(s):
    f = s["footer"]
    return logo_kilit(s, "alt", 8) + f"""        <p class="footer-brand__text">
          {kacis(f['metin'])}
        </p>
"""


SOSYAL_SIMGE = {
    "instagram": ('Instagram',
                  '<rect x="3" y="3" width="18" height="18" rx="5"/>'
                  '<circle cx="12" cy="12" r="4"/>'
                  '<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>'),
    "linkedin": ('LinkedIn',
                 '<rect x="3" y="3" width="18" height="18" rx="2"/>'
                 '<path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4"/>'),
    "youtube": ('YouTube',
                '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/>'
                '<path d="M10.4 9.4 15.6 12l-5.2 2.6z" stroke-linejoin="round"/>'),
}
# Sıra sabittir: hesap eklenip çıkarılsa da yerleşim kaymasın.
SOSYAL_SIRA = ["instagram", "linkedin", "youtube"]


def sosyal_ogeler(s, girinti):
    b = " " * girinti
    so = s.get("sosyal") or {}
    satirlar = []
    for ad in SOSYAL_SIRA:
        adres = (so.get(ad) or "").strip()
        if not adres:
            continue
        etiket, cizim = SOSYAL_SIMGE[ad]
        satirlar.append(
            f'{b}<li><a href="{kacis(adres)}" target="_blank" rel="noopener" aria-label="{etiket}">\n'
            f'{b}  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.6" aria-hidden="true">{cizim}</svg>\n'
            f'{b}</a></li>\n')
    return "".join(satirlar)


def parca_sosyal_footer(s):
    return sosyal_ogeler(s, 10)


def parca_sosyal_baslik(s):
    return sosyal_ogeler(s, 8)


def parca_sosyal_mobil(s):
    return sosyal_ogeler(s, 6)


def parca_sayaclar(s):
    """Anasayfadaki rakamlar. Sayı bölümü data-count ile sıfırdan hedefe
    sayar (bkz. assets/js/main.js → initCounters); sayıya bitişik yazılan
    "+" veya "%" gibi ekler data-suffix'e ayrılır ki sayaç bozulmasın."""
    kutular = []
    for k in (s.get("sayaclar") or []):
        ham = str(k.get("deger", "")).strip()
        m = re.match(r"^(\d+(?:[.,]\d+)?)(.*)$", ham)
        if m:
            sayi, ek = m.group(1).replace(",", "."), m.group(2).strip()
            ekOz = f' data-suffix="{kacis(ek)}"' if ek else ""
            deger = f'<span data-count="{kacis(sayi)}"{ekOz}>0</span>'
        else:
            # Sayı ile başlamıyorsa (ör. "2013—") olduğu gibi yazılır
            deger = kacis(ham)
        kutular.append(f"""        <div class="stat" data-reveal="stagger">
          <div class="stat__value">{deger}</div>
          <p class="stat__label">{kacis(k.get('etiket', ''))}</p>
        </div>""")
    return "\n".join(kutular) + "\n" if kutular else ""


def parca_kurucu_portre(s):
    """Hakkımızda sayfasındaki kurucu fotoğrafı. Boşsa yer tutucu görsel kalır."""
    ham = (s.get("kurucuFoto") or "").strip()
    etiket = 'alt="Fatma Kocaova — Yüksek Mimar, restorasyon uzmanı"'
    if not ham:
        return (f'            <img src="assets/img/portre-yer-tutucu.svg" {etiket}\n'
                f'                 width="1000" height="1250" loading="lazy">')
    adres = gorsel_adresi(ham, 1000)
    seti = gorsel_seti(ham)
    ek = f' srcset="{kacis(seti)}" sizes="(min-width: 900px) 24rem, 80vw"' if seti else ""
    return (f'            <img src="{kacis(adres)}" {etiket}{ek}\n'
            f'                 width="1000" height="1250" loading="lazy">')


def parca_footer_alt(s):
    f = s["footer"]
    # Yönetim bağlantısı tüm sayfalarda kök dizinde olduğu için göreli adres
    # her sayfada aynı çalışır (üretilen blog sayfaları da kökte durur).
    return f"""      <span>© <span data-year>2026</span> {kacis(f['telifSatiri'])}</span>
      <span class="footer-bottom__son">
        <span>{kacis(f['bolgeSatiri'])}</span>
        <a class="footer-admin" href="admin/index.html" rel="nofollow">Yönetim Paneli</a>
      </span>
"""


def parca_mobil_iletisim(s):
    i = s["iletisim"]
    return f"""    <a href="mailto:{kacis(i['eposta'])}">{kacis(i['eposta'])}</a>
    <a href="tel:{kacis(i['telefonHam'])}">{kacis(i['telefon'])}</a>
    <span>{kacis(i['adresSatir1'])}, {kacis(i['adresSatir2'])}</span>
"""


def parca_iletisim_kartlari(s):
    i = s["iletisim"]
    return f"""          <div class="contact-item">
            <p class="contact-item__label">E-posta</p>
            <p class="contact-item__value">
              <a class="link-underline" href="mailto:{kacis(i['eposta'])}">{kacis(i['eposta'])}</a>
            </p>
          </div>

          <div class="contact-item">
            <p class="contact-item__label">Telefon</p>
            <p class="contact-item__value">
              <a class="link-underline" href="tel:{kacis(i['telefonHam'])}">{kacis(i['telefon'])}</a>
            </p>
          </div>

          <div class="contact-item">
            <p class="contact-item__label">Adres</p>
            <p class="contact-item__value">{kacis(i['adresSatir1'])}<br>{kacis(i['adresSatir2'])}</p>
          </div>

          <div class="contact-item">
            <p class="contact-item__label">Çalışma Saatleri</p>
            <p class="contact-item__value">{kacis(i['calismaSaatleri'])}</p>
          </div>
"""


def parca_form_etiketi(s):
    """İletişim formunun açılış etiketi ve gizli alanları.

    saglayici:
      "yok"       — JavaScript e-posta uygulamasını açar (mailto)
      "web3forms" — api.web3forms.com'a AJAX ile gönderilir; erişim
                    anahtarı tarayıcıya açıktır, tasarım gereği böyledir
                    (anahtar yalnızca kayıtlı adrese posta göndermeye yarar)
      "ozel"      — Formspree vb. bir adrese klasik form gönderimi
    """
    f = s.get("form") or {}
    saglayici = (f.get("saglayici") or "yok").strip()
    anahtar = (f.get("erisimAnahtari") or "").strip()
    ozel = (f.get("ozelAdres") or "").strip()
    eposta = s["iletisim"]["eposta"]
    ofis = s["ofis"]["ad"]

    if saglayici == "web3forms" and anahtar:
        return (
            f'          <form class="form" data-contact-form data-saglayici="web3forms"\n'
            f'                data-anahtar="{kacis(anahtar)}" data-mailto="{kacis(eposta)}" novalidate>\n'
            f'            <input type="hidden" name="subject" value="{kacis(ofis)} — web sitesi iletişim formu">\n'
            f'            <input type="hidden" name="from_name" value="{kacis(ofis)} web sitesi">\n'
            f'            <input type="checkbox" name="botcheck" class="tuzak" tabindex="-1" autocomplete="off" aria-hidden="true">\n'
        )

    # Göreli bir adres action'a yazılırsa form statik barındırmaya POST eder
    # ve 405 döner. Yalnızca tam adres kabul edilir.
    if saglayici == "ozel" and ozel.startswith(("http://", "https://")):
        return (
            f'          <form class="form" action="{kacis(ozel)}" method="POST"\n'
            f'                data-contact-form data-saglayici="ozel" data-mailto="{kacis(eposta)}" novalidate>\n'
            f'            <input type="hidden" name="_subject" value="{kacis(ofis)} — web sitesi iletişim formu">\n'
            f'            <input type="checkbox" name="botcheck" class="tuzak" tabindex="-1" autocomplete="off" aria-hidden="true">\n'
        )

    return (
        f'          <form class="form" data-contact-form data-saglayici="yok" '
        f'data-mailto="{kacis(eposta)}" novalidate>\n'
        f'            <input type="checkbox" name="botcheck" class="tuzak" tabindex="-1" autocomplete="off" aria-hidden="true">\n'
    )


def parca_wa(s):
    n = s["iletisim"]["whatsappHam"]
    return f"""<a class="wa-float" href="https://wa.me/{kacis(n)}" target="_blank" rel="noopener" aria-label="WhatsApp ile yazın">
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.23-8.23 2.2 0 4.26.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.21-8.23 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.02s.87 2.34 1 2.5c.12.16 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.58.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>
</a>
"""


def parca_hizmet_kartlari(hizmetler):
    ok = ('<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">'
          '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>')
    parcalar = []
    for h in hizmetler:
        parcalar.append(f"""        <a class="service" href="hizmetler.html#{kacis(h['id'])}" data-reveal="stagger">
          <span class="service__index">/ {kacis(h['no'])}</span>
          <svg class="service__icon" viewBox="0 0 48 48" aria-hidden="true">
            {h['ikon']}
          </svg>
          <h3 class="service__title">{kacis(h['baslik'])}</h3>
          <p class="service__text">{kacis(h['kisa'])}</p>
          <span class="service__more">Detay
            {ok}
          </span>
        </a>""")
    return "\n\n".join(parcalar) + "\n"


def parca_hizmet_satirlari(hizmetler):
    parcalar = []
    for h in hizmetler:
        et = "\n            ".join(f"<li>{kacis(e)}</li>" for e in h["etiketler"])
        parcalar.append(f"""      <article class="service-row" id="{kacis(h['id'])}" data-reveal>
        <div class="service-row__num">/ {kacis(h['no'])}</div>
        <div>
          <h2 class="service-row__title">{kacis(h['baslik'])}</h2>
        </div>
        <div class="service-row__body">
          <p>{kacis(h['metin'])}</p>
          <ul class="tag-list">
            {et}
          </ul>
        </div>
      </article>""")
    return "\n\n".join(parcalar) + "\n"


def parca_projeler(projeler, sadece_one_cikan=False, link=None):
    kayitlar = [p for p in projeler if p.get("oneCikan")] if sadece_one_cikan else projeler
    parcalar = []
    for p in kayitlar:
        etiket, ek = ("a", f' href="{link}"') if link else ("article", "")
        baslik_etiket = "h3" if link else "h2"
        notu = (f'\n            <p class="kayit__ozet">{kacis(p["not"])}</p>'
                if p.get("not") else "")
        parcalar.append(f"""        <{etiket} class="kayit"{ek} data-category="{kacis(p['turSlug'])}" data-reveal="stagger">
          <p class="kayit__tarih">{kacis(p['yil'])}</p>
          <p class="kayit__tur">{kacis(p['tur'])}</p>
          <div>
            <{baslik_etiket} class="kayit__baslik">{kacis(p['baslik'])}</{baslik_etiket}>{notu}
          </div>
          <p class="kayit__yer">{kacis(p['yer'])}</p>
        </{etiket}>""")
    return "\n".join(parcalar) + "\n"


def parca_is_serit(projeler):
    """Anasayfadaki kaydırmalı seçili işler galerisi.

    Her kart bir düğmedir; tıklanınca ilgili proje modal olarak açılır
    (bkz. assets/js/main.js → initProjeModal). Görsel yoksa kart yine
    çalışır, yerine tipografik bir yüzey konur.
    """
    # Sıra numarası modalın okuduğu diziye karşılık gelir; sözlükleri
    # eşitlikle aramak yerine baştan sayıyoruz (aynı içerikli iki proje
    # olsa bile doğru kart açılır).
    secili = [(i, p) for i, p in enumerate(projeler) if p.get("oneCikan")]
    if not secili:
        secili = list(enumerate(projeler))[:4]
    parcalar = []
    for sira, p in secili:
        gorseller = medya_listesi(p)
        if gorseller:
            ilk = gorseller[0]
            adres = gorsel_adresi(ilk["adres"], 1200)
            seti = gorsel_seti(ilk["adres"])
            ek = f' srcset="{kacis(seti)}" sizes="(min-width: 900px) 30rem, 78vw"' if seti else ""
            oynat = ('<span class="is-karti__oynat" aria-hidden="true"></span>'
                     if ilk["video"] else "")
            yuzey = (f'<img class="is-karti__gorsel" src="{kacis(adres)}" alt=""{ek} '
                     f'loading="lazy" decoding="async">{oynat}')
        else:
            yuzey = ('<span class="is-karti__yer-tutucu" aria-hidden="true">'
                     f'{kacis(p["tur"])}</span>')
        sayi = len(gorseller)
        rozet = (f'<span class="is-karti__sayi">{sayi} görsel</span>' if sayi > 1 else "")
        parcalar.append(f"""        <li class="serit__oge">
          <button class="is-karti" type="button" data-proje="{sira}"
                  aria-label="{kacis(p['baslik'])} — projeyi aç">
            <span class="is-karti__cerceve">{yuzey}{rozet}</span>
            <span class="is-karti__alt">
              <span class="is-karti__baslik">{kacis(p['baslik'])}</span>
              <span class="is-karti__meta">{kacis(p['yil'])} · {kacis(p['yer'])}</span>
            </span>
          </button>
        </li>""")
    return "\n".join(parcalar) + "\n"


def parca_proje_verisi(projeler):
    """Modalın okuduğu veri. Öznitelik yerine JSON blok: kaçış derdi yok."""
    sade = []
    for p in projeler:
        sade.append({
            "baslik": p["baslik"],
            "yil": p["yil"],
            "tur": p["tur"],
            "yer": p["yer"],
            "metin": p.get("metin") or p.get("not") or "",
            "gorseller": [
                {
                    "adres": gorsel_adresi(g["adres"], 1600),
                    "seti": gorsel_seti(g["adres"]),
                    "video": g["video"],
                    **({"videoAdres": drive_video_adresi(g["adres"])} if g["video"] else {}),
                }
                for g in medya_listesi(p)
            ],
        })
    govde = json.dumps(sade, ensure_ascii=False, indent=1)
    # </script> dizisi JSON içinde geçerse blok erken kapanır.
    govde = govde.replace("</", "<\\/")
    # Etiket de burada üretilir: işaret yorumları script'in içine düşerse
    # JSON.parse yorumlara takılır ve modal sessizce çalışmaz.
    return f'<script type="application/json" id="proje-verisi">{govde}</script>\n'


def parca_blog_kartlari(blog):
    """Anasayfadaki üç sütunlu blog kartları."""
    yazilar = yayindaki_yazilar(blog)[:3]
    if not yazilar:
        return """      <p class="bos-durum" style="grid-column:1/-1">
        İlk yazılar hazırlanıyor.
      </p>
"""
    parcalar = []
    for y in yazilar:
        ham = (y.get("gorsel") or "").strip()
        if ham:
            seti = gorsel_seti(ham)
            ek = f' srcset="{kacis(seti)}" sizes="(min-width: 900px) 26rem, 88vw"' if seti else ""
            yuzey = (f'<img src="{kacis(gorsel_adresi(ham, 1200))}" alt=""{ek} '
                     f'loading="lazy" decoding="async">')
        else:
            yuzey = f'<span class="yazi-karti__yer-tutucu">{kacis(y["kategori"])}</span>'
        parcalar.append(f"""        <a class="yazi-karti" href="blog-{kacis(y['slug'])}.html" data-reveal="stagger">
          <span class="yazi-karti__cerceve">
            {yuzey}
            <span class="yazi-karti__daha">Oku +</span>
          </span>
          <span class="yazi-karti__kategori">{kacis(y['kategori'])}</span>
          <h3 class="yazi-karti__baslik">{kacis(y['baslik'])}</h3>
        </a>""")
    return "\n".join(parcalar) + "\n"


def yila_gore_sirala(projeler):
    """Yeniden eskiye. Aynı yıl içindeki sıra panelde verilen sıradır
    (sorted kararlıdır), böylece elle sıralama anlamını korur."""
    def anahtar(p):
        try:
            return int(str(p.get("yil", "")).strip()[:4])
        except ValueError:
            return -1  # yılı okunamayanlar en sona
    return sorted(projeler, key=anahtar, reverse=True)


def parca_proje_galerisi(projeler):
    """Projeler sayfasındaki görselli galeri.

    Kartlar hem filtreye (data-category) hem modala (data-proje) bağlıdır;
    modal indeksleri sıralanmış listeye göre verilir.
    """
    parcalar = []
    for sira, p in enumerate(projeler):
        gorseller = medya_listesi(p)
        if gorseller:
            ilk = gorseller[0]
            seti = gorsel_seti(ilk["adres"])
            ek = (f' srcset="{kacis(seti)}" sizes="(min-width: 1100px) 33vw, '
                  f'(min-width: 700px) 50vw, 92vw"' if seti else "")
            oynat = ('<span class="proje-karti__oynat" aria-hidden="true"></span>'
                     if ilk["video"] else "")
            yuzey = (f'<img src="{kacis(gorsel_adresi(ilk["adres"], 1200))}" alt=""{ek} '
                     f'loading="lazy" decoding="async">{oynat}')
        else:
            yuzey = (f'<span class="proje-karti__yer-tutucu" aria-hidden="true">'
                     f'{kacis(p["tur"])}</span>')
        sayi = (f'<span class="proje-karti__sayi">{len(gorseller)} görsel</span>'
                if len(gorseller) > 1 else "")
        notu = (f'\n            <p class="proje-karti__not">{kacis(p["not"])}</p>'
                if p.get("not") else "")
        parcalar.append(f"""        <li class="proje-karti" data-category="{kacis(p['turSlug'])}" data-reveal="stagger">
          <button class="proje-karti__dugme" type="button" data-proje="{sira}"
                  aria-label="{kacis(p['baslik'])} — projeyi aç">
            <span class="proje-karti__cerceve">{yuzey}{sayi}</span>
            <span class="proje-karti__ust">
              <span class="proje-karti__yil">{kacis(p['yil'])}</span>
              <span class="proje-karti__tur">{kacis(p['tur'])}</span>
            </span>
            <span class="proje-karti__govde">
              <span class="proje-karti__baslik">{kacis(p['baslik'])}</span>{notu}
            </span>
            <span class="proje-karti__yer">{kacis(p['yer'])}</span>
          </button>
        </li>""")
    return "\n".join(parcalar) + "\n"


def parca_proje_filtreleri(projeler):
    gorulen = []
    for p in projeler:
        cift = (p["turSlug"], p["tur"])
        if cift not in gorulen:
            gorulen.append(cift)
    dugmeler = ['        <button class="filter-btn is-active" type="button" '
                'data-filter="all" aria-pressed="true">Tümü</button>']
    for slug, ad in gorulen:
        dugmeler.append(f'        <button class="filter-btn" type="button" '
                        f'data-filter="{kacis(slug)}" aria-pressed="false">{kacis(ad)}</button>')
    return "\n".join(dugmeler) + "\n"


def parca_haberler(haberler):
    if not haberler:
        return """        <div class="bos-durum">
          <p>Henüz kayıt yok.</p>
        </div>
"""
    parcalar = []
    for h in haberler:
        ozet = f'\n            <p class="kayit__ozet">{kacis(h["ozet"])}</p>' if h.get("ozet") else ""
        parcalar.append(f"""        <article class="kayit" data-reveal="stagger">
          <p class="kayit__tarih">{kacis(h['yil'])}</p>
          <p class="kayit__tur">{kacis(h['tur'])}</p>
          <div>
            <h2 class="kayit__baslik">{kacis(h['baslik'])}</h2>{ozet}
          </div>
          <p class="kayit__yer">{kacis(h['yer'])}</p>
        </article>""")
    return "\n".join(parcalar) + "\n"


def yayindaki_yazilar(blog):
    return [y for y in blog if y.get("yayinda", True)]


def parca_blog_listesi(blog):
    yazilar = yayindaki_yazilar(blog)
    if not yazilar:
        return """      <div class="bos-durum" data-reveal>
        <p style="font-size:var(--fs-lg);color:var(--ink);margin-bottom:.75rem">
          İlk yazılar hazırlanıyor.
        </p>
        <p style="max-width:52ch;margin-inline:auto">
          Malzeme, yöntem ve koruma kuramı üzerine notlar ile saha araştırmaları
          yakında burada yayımlanacak. Bu arada ofisin katıldığı etkinlikler için
          <a class="link-underline" href="haberler.html">haberler</a> sayfasına
          göz atabilirsiniz.
        </p>
      </div>
"""
    parcalar = ['      <div class="kayitlar">']
    for y in yazilar:
        parcalar.append(f"""        <a class="kayit" href="blog-{kacis(y['slug'])}.html" data-reveal="stagger">
          <p class="kayit__tarih">{kacis(y['ay'])} {kacis(y['yil'])}</p>
          <p class="kayit__tur">{kacis(y['kategori'])}</p>
          <div>
            <h2 class="kayit__baslik">{kacis(y['baslik'])}</h2>
            <p class="kayit__ozet">{kacis(y['ozet'])}</p>
          </div>
          <p class="kayit__yer">{kacis(y.get('sure', ''))}</p>
        </a>""")
    parcalar.append("      </div>\n")
    return "\n".join(parcalar)


def bloklari_ciz(bloklar):
    cikti = []
    for b in bloklar:
        tip = b.get("tip", "p")
        metin = b.get("metin", "")
        if tip == "baslik":
            cikti.append(f"        <h2>{kacis(metin)}</h2>")
        elif tip == "altbaslik":
            cikti.append(f"        <h3>{kacis(metin)}</h3>")
        elif tip == "alinti":
            cikti.append(f"        <blockquote>{kacis(metin)}</blockquote>")
        elif tip == "liste":
            ogeler = "\n".join(f"          <li>{kacis(x.strip())}</li>"
                               for x in metin.split("\n") if x.strip())
            cikti.append(f"        <ul>\n{ogeler}\n        </ul>")
        else:
            # Boş satır yeni paragraf açar. Tek satır sonları birleştirilir:
            # metinler çoğu zaman PDF'ten sabit genişlikte sarılmış hâlde
            # yapıştırılıyor; bunları <br> yapmak cümleleri ortasından
            # kırar. Bilerek satır başı isteniyorsa araya boş satır konur,
            # başlık ve listeler için panelde ayrı blok türleri var.
            for parca in re.split(r"\n\s*\n", metin):
                satir = " ".join(x.strip() for x in parca.split("\n") if x.strip())
                if satir:
                    cikti.append(f"        <p>{kacis(satir)}</p>")
    return "\n\n".join(cikti)


# ============================================================ blog sayfası
def blog_sayfasi(y, kalip):
    govde = f"""
  <section class="page-hero">
    <div class="container">
      <span class="eyebrow eyebrow--invert">{kacis(y['kategori'])}</span>
      <h1 class="page-hero__title">{kacis(y['baslik'])}</h1>
      <p class="page-hero__text">{kacis(y['ozet'])}</p>
      <ol class="breadcrumb">
        <li><a href="index.html">Anasayfa</a></li>
        <li><a href="blog.html">Blog</a></li>
        <li aria-current="page">{kacis(y['baslik'])}</li>
      </ol>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <article class="makale" data-reveal>

        <div class="makale-kunye">
          <span>{kacis(y['ay'])} {kacis(y['yil'])}</span>
          <span>{kacis(y['kategori'])}</span>
          <span>{kacis(y.get('sure', ''))}</span>
          <span>Fatma Kocaova</span>
        </div>

{bloklari_ciz(y.get('bloklar', []))}

      </article>

      <nav class="pager" aria-label="Yazı gezinmesi" style="margin-top:clamp(2.5rem,5vw,4rem)">
        <a class="link-underline" href="blog.html">← Tüm yazılar</a>
        <a class="link-underline" href="iletisim.html">Soru sorun →</a>
      </nav>
    </div>
  </section>
"""
    s = kalip
    s = s.replace("@@BASLIK@@", kacis(y["baslik"]))
    s = s.replace("@@ACIKLAMA@@", kacis(y["ozet"]))
    s = s.replace("@@SLUG@@", kacis(y["slug"]))
    s = s.replace("@@GOVDE@@", govde)
    return s


# ==================================================================== ana
def uret():
    s = veri("site")
    hizmetler = veri("hizmetler")
    # Tüm listelerde ortak sıra: yeniden eskiye. Modal indeksleri de bu
    # sıralanmış listeye göre verildiği için tek yerde sıralanmalıdır.
    projeler = yila_gore_sirala(veri("projeler"))
    haberler = veri("haberler")
    blog = veri("blog")

    bolgeler = {
        "footer-liste": parca_footer_liste(s),
        "logo-baslik": parca_logo_baslik(s),
        "sosyal-footer": parca_sosyal_footer(s),
        "sosyal-baslik": parca_sosyal_baslik(s),
        "sosyal-mobil": parca_sosyal_mobil(s),
        "footer-marka": parca_footer_marka(s),
        "sayaclar": parca_sayaclar(s),
        "kurucu-portre": parca_kurucu_portre(s),
        "footer-alt": parca_footer_alt(s),
        "mobil-iletisim": parca_mobil_iletisim(s),
        "iletisim-kartlari": parca_iletisim_kartlari(s),
        "wa": parca_wa(s),
        "form-etiketi": parca_form_etiketi(s),
        "hizmet-kartlari": parca_hizmet_kartlari(hizmetler),
        "hizmet-satirlari": parca_hizmet_satirlari(hizmetler),
        "proje-galerisi": parca_proje_galerisi(projeler),
        "proje-filtreleri": parca_proje_filtreleri(projeler),
        "secili-projeler": parca_projeler(projeler, True, "projeler.html"),
        "is-serit": parca_is_serit(projeler),
        "proje-verisi": parca_proje_verisi(projeler),
        "blog-kartlari": parca_blog_kartlari(blog),
        "haberler": parca_haberler(haberler),
        "blog-listesi": parca_blog_listesi(blog),
    }

    degisen = []
    for dosya in sorted(f for f in os.listdir(KOK) if f.endswith(".html")):
        yol = os.path.join(KOK, dosya)
        with open(yol, encoding="utf-8") as f:
            metin = f.read()
        orj = metin
        for ad, icerik in bolgeler.items():
            metin, _ = bolge_yaz(metin, ad, icerik)
        if metin != orj:
            with open(yol, "w", encoding="utf-8") as f:
                f.write(metin)
            degisen.append(dosya)

    # ---- blog yazı sayfaları
    kalip_yolu = os.path.join(KOK, "tools", "kalip-yazi.html")
    yazilar = yayindaki_yazilar(blog)
    if os.path.exists(kalip_yolu):
        with open(kalip_yolu, encoding="utf-8") as f:
            kalip = f.read()
        for y in yazilar:
            hedef = os.path.join(KOK, f"blog-{y['slug']}.html")
            icerik = blog_sayfasi(y, kalip)
            # Kalıp, yakalandığı andaki footer/iletişim içeriğini taşır.
            # İşaretli bölgeleri burada da uygulamazsak üretilen sayfa her
            # derlemede "değişti" görünür (betik idempotent olmaz).
            for ad, parca in bolgeler.items():
                icerik, _ = bolge_yaz(icerik, ad, parca)
            eski = open(hedef, encoding="utf-8").read() if os.path.exists(hedef) else None
            if eski != icerik:
                with open(hedef, "w", encoding="utf-8") as f:
                    f.write(icerik)
                degisen.append(os.path.basename(hedef))

    # artık yayında olmayan yazı sayfalarını temizle
    gecerli = {f"blog-{y['slug']}.html" for y in yazilar}
    for f in os.listdir(KOK):
        if f.startswith("blog-") and f.endswith(".html") and f not in gecerli:
            os.remove(os.path.join(KOK, f))
            degisen.append(f + " (silindi)")

    # ---- sitemap
    adresler = ["", "hakkimizda.html", "hizmetler.html", "projeler.html",
                "haberler.html", "blog.html"]
    adresler += [f"blog-{y['slug']}.html" for y in yazilar]
    adresler.append("iletisim.html")
    satirlar = ['<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for a in adresler:
        oncelik = "1.0" if a == "" else ("0.9" if a in ("projeler.html", "hizmetler.html") else "0.7")
        satirlar += ["  <url>", f"    <loc>{ALAN_ADI}/{a}</loc>",
                     "    <changefreq>monthly</changefreq>",
                     f"    <priority>{oncelik}</priority>", "  </url>"]
    satirlar.append("</urlset>")
    yeni_sitemap = "\n".join(satirlar) + "\n"
    sm_yolu = os.path.join(KOK, "sitemap.xml")
    if not os.path.exists(sm_yolu) or open(sm_yolu, encoding="utf-8").read() != yeni_sitemap:
        with open(sm_yolu, "w", encoding="utf-8") as f:
            f.write(yeni_sitemap)
        degisen.append("sitemap.xml")

    return degisen


if __name__ == "__main__":
    kontrol = "--kontrol" in sys.argv
    degisen = uret()
    if kontrol and degisen:
        print("Üretilen dosyalar güncel değil:", ", ".join(degisen))
        print("Yerelde `python3 tools/build.py` çalıştırıp sonucu işleyin.")
        sys.exit(1)
    print("güncellendi:", ", ".join(degisen) if degisen else "değişiklik yok")
