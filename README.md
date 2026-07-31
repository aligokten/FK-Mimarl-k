# Fatma Kocaova Mimarlık — Web Sitesi

İzmir merkezli mimari restorasyon ofisi için minimal, mobil uyumlu portfolyo sitesi.
Derleme adımı yoktur: saf HTML, CSS ve JavaScript. Dosyaları herhangi bir statik
sunucuya (GitHub Pages, Netlify, Vercel, cPanel) olduğu gibi yükleyebilirsiniz.

---

## Sayfalar

| Dosya | İçerik |
|---|---|
| `index.html` | Anasayfa — kahraman bölümü, hakkımızda özeti, hizmetler, seçili projeler, süreç, sayılar, çağrı |
| `hakkimizda.html` | Ofis, kurucu, uzmanlık alanları, sık sorulan sorular |
| `hizmetler.html` | 7 hizmetin ayrıntılı anlatımı, çalışma süreci |
| `projeler.html` | Filtrelenebilir proje arşivi |
| `haberler.html` | Katılınan sempozyum, panel ve söyleşiler (türe göre filtreli) |
| `blog.html` | Yazı ve araştırma raporları listesi (konuya göre filtreli) |
| `blog-kirec-harci.html` | Örnek makale — yeni yazılar için şablon |
| `proje-kemeralti.html`, `proje-alacati.html`, `proje-basmane.html` | Proje detay sayfaları |
| `iletisim.html` | İletişim bilgileri, form, harita |
| `gizlilik.html` | Gizlilik / KVKK aydınlatma metni (taslak) |
| `404.html` | Sayfa bulunamadı |

Destek dosyaları: `robots.txt`, `sitemap.xml`, `site.webmanifest`.

## Klasör yapısı

```
assets/
  css/main.css        Tüm stiller (tasarım değişkenleri dosyanın başındadır)
  js/main.js          Menü, kaydırma animasyonları, filtre, akordeon, form
  js/heroSketch.js    Anasayfa kahraman bölümündeki eskiz animasyonu
  img/*.svg           Geçici görseller + favicon
tools/
  generate-placeholders.py   Geçici görselleri yeniden üretir
```

## Kahraman bölümü eskiz animasyonu

Anasayfadaki `.hero`, 320vh yüksekliğinde bir kaydırma pistidir; içindeki
sahne sticky kalır ve kaydırma miktarı 0–1 ilerlemeye çevrilir. Canvas
üzerinde elle çizim hissi veren bir mimari eskiz, ofisin üretim zincirini
üç evrede anlatır:

| Evre | İçerik |
|---|---|
| 01 · Rölöve alımı | Yapı bulunduğu hâliyle çizilir (çöken saçak, şakulden kaçmış duvar, çatlaklar), ölçü çizgileri ve kot işlenir |
| 02 · Uygulama projesi | Ölçü katmanı solar, deformasyon düzelir; taş örgü, ahşap karkas, malzeme açıklamaları ve antet gelir |
| 03 · Yapının oluşumu | Yüzeyler dolar, gölge düşer, pencerelerde ışık yanar |

Tüm geometri `heroSketch.js` içinde kod olarak üretilir — dış kütüphane,
görsel veya 3B model dosyası yoktur. Çizgilerdeki sapmalar tohumlu
rastgelelikle **bir kez** hesaplanır; bu yüzden kareler arasında titremez.

Modül yalnızca gerektiğinde dinamik `import()` ile indirilir. Kullanıcı
hareket azaltma tercih ettiyse veya canvas desteklenmiyorsa hiç indirilmez;
bölüm `.is-static` sınıfıyla tek ekranlık sabit görsele döner.

Metinleri ve evre eşiklerini değiştirmek için `main.js` içindeki `EVRELER`
dizisine, çizim zamanlamasını değiştirmek için `heroSketch.js` içindeki
`EVRE` nesnesine bakın.

---

## ⚠️ Yayına almadan önce güncellenmesi gerekenler

Aşağıdaki içerikler **yer tutucudur**. Kod içinde `NOT:` ile başlayan HTML
yorumları da aynı noktaları işaret eder.

1. **İletişim bilgileri** — Adres gerçektir (Çınarlı Mah. 1572 Sk. No:33,
   Konak 35170 İzmir). **E-posta ve telefon hâlâ yer tutucudur:**
   `info@fatmakocaovamimarlik.com`, `+90 (000) 000 00 00` ve WhatsApp
   numarası (`wa.me/900000000000`). Bu bilgiler her sayfanın alt bilgisinde,
   mobil menüde ve `iletisim.html` içinde geçer:
   ```
   grep -rn "000 00 00\|900000000000\|info@fatmakocaovamimarlik.com" *.html
   ```
2. **Sayılar** — `index.html` içindeki istatistik bölümü (`data-count` değerleri:
   60+ proje, 15+ yıl, 24 tescilli yapı, 9 il) örnek değerlerdir. Gerçek verilerle
   değiştirin veya bölümü tamamen kaldırın.
3. **Projeler** — Kemeraltı, Alaçatı, Basmane, Tire, Bergama, Urla projeleri örnek
   içeriktir. Gerçek projelerle değiştirin.
4. **Haberler** — `haberler.html` içindeki beş etkinlik kaydı örnektir. Ofisin
   gerçekten katıldığı sempozyum, panel ve söyleşilerle değiştirin; katılmadığı
   bir etkinliğin sitede durması yanıltıcıdır.
5. **Blog** — `blog.html` içindeki dört yazı ve `blog-kirec-harci.html` içindeki
   makale metni örnektir. Yeni yazı eklemek için makale dosyasını kopyalayın ve
   `blog.html` içine bir `<a class="kayit">` satırı ekleyin.
6. **Kurucu portresi** — `hakkimizda.html` içindeki portre şu an
   `assets/img/portre-yer-tutucu.svg` gösteriyor. Gerçek fotoğrafı
   `assets/img/fatma-kocaova.jpg` olarak kaydedip (dikey 4:5, ~1000×1250 px)
   `src` ve `width`/`height` değerlerini güncelleyin. Portre, tek renk dile
   uyması için CSS'te gri tonlamalı gösterilir; renkli istenirse
   `main.css` içindeki `.portre img { filter: ... }` satırı silinir.
7. **Görseller** — Diğer tüm görseller SVG yer tutucudur, bkz. `assets/img/README.md`.
8. **Uzmanlık yüzdeleri** — `skill__fill` içindeki `data-value` değerleri.
9. **Harita** — `iletisim.html` içindeki iframe artık gerçek adresi gösterir.
   Daha hassas konumlama için Google Haritalar → Paylaş → Harita yerleştir
   ile alınan iframe kodunu kullanabilirsiniz.
10. **Gizlilik metni** — `gizlilik.html` bir taslaktır; hukuki destek alarak
   ofisin ticari unvanı ve veri işleme uygulamalarına göre güncelleyin.
11. **Alan adı** — `canonical`, `og:url` ve `sitemap.xml` içinde
   `https://fatmakocaovamimarlik.com/` adresi kullanılır. Farklı bir adres
   kullanacaksanız topluca değiştirin.

## İletişim formu

Form varsayılan olarak ziyaretçinin e-posta uygulamasını açar (`mailto:`).
Sunucu tarafı gönderim için `iletisim.html` içindeki `<form>` etiketine bir
`action` adresi ekleyin — örneğin:

```html
<form class="form" action="https://formspree.io/f/XXXXXXX" method="POST" data-contact-form>
```

`action` tanımlandığında JavaScript devreye girmez, form doğrudan gönderilir.

---

## Yerel çalıştırma

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Yayınlama

Depo kök dizini doğrudan yayınlanabilir; derleme adımı yoktur.
Tüm sayfalar göreli yol kullandığı için site hem alan adının kökünde
(`ornek.com/`) hem de alt klasörde (`ornek.com/site/`) sorunsuz çalışır.

### GitHub Pages

`.github/workflows/pages.yml` iş akışı, `main` dalına her gönderimde siteyi
yayınlar. **Tek seferlik ayar:** Depo → Settings → Pages → *Build and
deployment* → Source: **GitHub Actions**.

Adres: `https://<kullanıcı-adı>.github.io/FK-Mimarl-k/`

Alternatif olarak iş akışı silinip Source: *Deploy from a branch* → `main` /
`(root)` da seçilebilir; sonuç aynıdır.

### Özel alan adı

`fatmakocaovamimarlik.com` adresinde yayınlamak için:

1. Alan adı sağlayıcısında DNS kaydı ekleyin
   (`A` kayıtları `185.199.108–111.153` veya `www` için `CNAME` →
   `<kullanıcı-adı>.github.io`).
2. Settings → Pages → *Custom domain* alanına alan adını yazın —
   GitHub `CNAME` dosyasını depoya kendisi ekler.
3. *Enforce HTTPS* seçeneğini işaretleyin.

> `CNAME` dosyasını DNS kayıtları yayılmadan eklemeyin; site geçici olarak
> erişilemez hale gelir.

### Diğer seçenekler

- **Netlify / Vercel:** Build komutu yok, publish directory `.`.
- **Klasik hosting:** Tüm dosyaları `public_html` altına kopyalayın.

---

## Tasarım sistemi

Renk, tipografi ve boşluk değerleri `assets/css/main.css` başındaki `:root`
bloğundadır. Ana renkleri değiştirmek için yalnızca bu değişkenleri düzenlemek yeterlidir:

| Değişken | Değer | Kullanım |
|---|---|---|
| `--paper` | `#f2f2f0` | Ana arka plan |
| `--ink` | `#0d0d0c` | Metin ve koyu bölümler |
| `--muted` | `#70706b` | İkincil metin |
| `--accent` | `#0d0d0c` | Mürekkeple aynı — vurgu **renkle değil ters blokla** verilir |
| `--accent-soft` | `#d4d4cf` | Koyu zeminde vurgu |

Palet bilinçli olarak tek renktir. Buton, satır ve ikon hover'ları renk
değiştirmez; zemin ile metin yer değiştirir. Başlıklardaki vurgu kelimeler
`-webkit-text-stroke` ile konturlu yazılır.

Tipografi tek bir sesle konuşur: **Saira** (`--font-display`) tüm başlık,
etiket, buton ve sayı yüzeylerinde; **Archivo** (`--font-sans`) yalnızca
gövde metninde. Serif aile kullanılmaz.

Yerel barındırma tercih edilirse `<link>` etiketlerini kaldırıp fontları
`assets/fonts/` altına alın ve iki değişkeni güncelleyin.

## Erişilebilirlik ve performans

- `lang="tr"`, anlamsal HTML, "İçeriğe geç" bağlantısı, görünür odak halkaları
- Mobil menü `aria-expanded` / `aria-hidden` ile yönetilir, Esc ile kapanır
- Akordeon ve filtreler klavye ile kullanılabilir
- `prefers-reduced-motion` tercihinde tüm animasyonlar kapanır
- Görseller `width`/`height` ile tanımlı (düzen kaymasını önler), alt kısımdakiler `loading="lazy"`
- Harici JavaScript kütüphanesi ve çerez kullanılmaz
