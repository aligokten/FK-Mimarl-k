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
| `proje-kemeralti.html`, `proje-alacati.html`, `proje-basmane.html` | Proje detay sayfaları |
| `iletisim.html` | İletişim bilgileri, form, harita |
| `gizlilik.html` | Gizlilik / KVKK aydınlatma metni (taslak) |
| `404.html` | Sayfa bulunamadı |

Destek dosyaları: `robots.txt`, `sitemap.xml`, `site.webmanifest`.

## Klasör yapısı

```
assets/
  css/main.css      Tüm stiller (tasarım değişkenleri dosyanın başındadır)
  js/main.js        Menü, kaydırma animasyonları, filtre, akordeon, form
  img/*.svg         Geçici görseller + favicon
tools/
  generate-placeholders.py   Geçici görselleri yeniden üretir
```

---

## ⚠️ Yayına almadan önce güncellenmesi gerekenler

Aşağıdaki içerikler **yer tutucudur**. Kod içinde `NOT:` ile başlayan HTML
yorumları da aynı noktaları işaret eder.

1. **İletişim bilgileri** — `info@fatmakocaovamimarlik.com`, `+90 (000) 000 00 00`,
   adres ve WhatsApp numarası (`wa.me/900000000000`). Bu bilgiler her sayfanın alt
   bilgisinde, mobil menüde ve `iletisim.html` içinde geçer:
   ```
   grep -rn "000 00 00\|900000000000\|info@fatmakocaovamimarlik.com" *.html
   ```
2. **Sayılar** — `index.html` içindeki istatistik bölümü (`data-count` değerleri:
   60+ proje, 15+ yıl, 24 tescilli yapı, 9 il) örnek değerlerdir. Gerçek verilerle
   değiştirin veya bölümü tamamen kaldırın.
3. **Projeler** — Kemeraltı, Alaçatı, Basmane, Tire, Bergama, Urla projeleri örnek
   içeriktir. Gerçek projelerle değiştirin.
4. **Görseller** — Tüm görseller SVG yer tutucudur, bkz. `assets/img/README.md`.
5. **Uzmanlık yüzdeleri** — `skill__fill` içindeki `data-value` değerleri.
6. **Harita** — `iletisim.html` içindeki iframe genel olarak İzmir'i gösterir.
   Google Haritalar → Paylaş → Harita yerleştir ile alınan gerçek adresle değiştirin.
7. **Gizlilik metni** — `gizlilik.html` bir taslaktır; hukuki destek alarak
   ofisin ticari unvanı ve veri işleme uygulamalarına göre güncelleyin.
8. **Alan adı** — `canonical`, `og:url` ve `sitemap.xml` içinde
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

Depo kök dizini doğrudan yayınlanabilir.

- **GitHub Pages:** Settings → Pages → Branch: `main`, klasör `/ (root)`.
- **Netlify / Vercel:** Build komutu yok, publish directory `.`.
- **Klasik hosting:** Tüm dosyaları `public_html` altına kopyalayın.

> Site alt klasörde yayınlanacaksa (`ornek.com/site/` gibi) `404.html`
> içindeki `/assets/...` ve `/` bağlantılarını göreli hale getirin.
> Diğer tüm sayfalar zaten göreli yol kullanır.

---

## Tasarım sistemi

Renk, tipografi ve boşluk değerleri `assets/css/main.css` başındaki `:root`
bloğundadır. Ana renkleri değiştirmek için yalnızca bu değişkenleri düzenlemek yeterlidir:

| Değişken | Değer | Kullanım |
|---|---|---|
| `--paper` | `#f5f2ec` | Ana arka plan (kireç taşı) |
| `--ink` | `#16130f` | Metin ve koyu bölümler |
| `--accent` | `#a9764a` | Vurgu (patina / toprak) |
| `--accent-soft` | `#c49a6f` | Koyu zemin üzerinde vurgu |

Yazı tipleri Google Fonts üzerinden yüklenir: **Archivo** (başlık/gövde) ve
**Cormorant Garamond** (italik vurgular). Yerel barındırma tercih edilirse
`<link>` etiketlerini kaldırıp fontları `assets/fonts/` altına alın ve
`--font-sans` / `--font-serif` değişkenlerini güncelleyin.

## Erişilebilirlik ve performans

- `lang="tr"`, anlamsal HTML, "İçeriğe geç" bağlantısı, görünür odak halkaları
- Mobil menü `aria-expanded` / `aria-hidden` ile yönetilir, Esc ile kapanır
- Akordeon ve filtreler klavye ile kullanılabilir
- `prefers-reduced-motion` tercihinde tüm animasyonlar kapanır
- Görseller `width`/`height` ile tanımlı (düzen kaymasını önler), alt kısımdakiler `loading="lazy"`
- Harici JavaScript kütüphanesi ve çerez kullanılmaz
