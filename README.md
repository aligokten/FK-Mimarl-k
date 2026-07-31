# Fatma Kocaova Mimarlık — Web Sitesi

İzmir merkezli mimari restorasyon ofisi için minimal, mobil uyumlu portfolyo sitesi.
Saf HTML, CSS ve JavaScript — çerçeve veya harici kütüphane yok.

İçerik `data/*.json` dosyalarında tutulur ve `/admin/` adresindeki yönetim
panelinden düzenlenir; `tools/build.py` bu veriden HTML üretir. Yayın için
Python dışında bir bağımlılık gerekmez.

---

## Sayfalar

| Dosya | İçerik |
|---|---|
| `index.html` | Anasayfa — kahraman bölümü, hakkımızda özeti, çalışma alanları, seçili işler, süreç, kilometre taşları |
| `hakkimizda.html` | Ofis, kurucu, özgeçmiş, referanslar, çalışma alanları, SSS |
| `hizmetler.html` | Dört çalışma alanının anlatımı, çalışma süreci |
| `projeler.html` | Filtrelenebilir proje arşivi (künye listesi) |
| `haberler.html` | Katılınan sempozyum ve forumlar |
| `blog.html` | Yazı ve araştırma raporları — **henüz içerik yok, boş durum gösteriyor** |
| `iletisim.html` | İletişim bilgileri, form, harita |
| `gizlilik.html` | Gizlilik / KVKK aydınlatma metni (taslak) |
| `404.html` | Sayfa bulunamadı |

Destek dosyaları: `robots.txt`, `sitemap.xml`, `site.webmanifest`.

## Klasör yapısı

```
data/                 İÇERİK — panelin ve build betiğinin okuduğu JSON dosyaları
  site.json             İletişim, footer, sosyal hesaplar, form adresi
  hizmetler.json        Çalışma alanları
  projeler.json         Proje listesi
  haberler.json         Etkinlik listesi
  blog.json             Yazılar (blok blok içerik dahil)
admin/                YÖNETİM PANELİ (tarayıcıdan çalışır, sunucu gerektirmez)
assets/
  css/main.css        Tüm stiller (tasarım değişkenleri dosyanın başındadır)
  js/main.js          Menü, kaydırma animasyonları, filtre, akordeon, form
  js/heroSketch.js    Anasayfa kahraman bölümündeki eskiz animasyonu
  img/*.svg           Geçici görseller + favicon
tools/
  build.py                   data/*.json -> HTML üretir
  kalip-yazi.html            Blog yazısı sayfa kalıbı
  generate-placeholders.py   Geçici görselleri yeniden üretir
```

---

## Yönetim paneli

Adres: **`/admin/`** (örn. `https://aligokten.github.io/FK-Mimarl-k/admin/`)

Panelden proje, haber, blog yazısı, hizmet ve iletişim/footer bilgileri
düzenlenir. Site statik olduğu için panel bir sunucuya değil, **doğrudan
GitHub deposuna** yazar:

```
Panel  ──►  data/*.json  ──►  GitHub Actions  ──►  tools/build.py  ──►  yayın
```

Kaydet dediğinizde depoya bir commit atılır, iş akışı tetiklenir ve site
birkaç dakika içinde güncellenir.

### Giriş

Panel, GitHub'ın *fine-grained* erişim anahtarını kullanır:

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
2. *Repository access*: yalnızca bu depo
3. *Permissions* → Repository permissions → **Contents: Read and write** (başka izin gerekmez)
4. Süreyi sınırlı tutun (örn. 90 gün); dolunca yenileyin

Anahtar yalnızca tarayıcının `localStorage` alanında saklanır, hiçbir sunucuya
gönderilmez. Ortak bilgisayarda iş bitince **Çıkış**'a basın — anahtar silinir.

> Panel `robots.txt` ile arama motorlarına kapatılmıştır ve sayfada
> `noindex` etiketi vardır. Yine de adresi herkese açıktır; koruma
> anahtarın kendisindedir.

### İçerik nasıl üretiliyor?

`tools/build.py`, HTML dosyalarındaki işaretli bölgeleri yeniden yazar:

```html
<!-- OTO:projeler -->
  ... bu bölge her derlemede JSON'dan üretilir, elle düzenlemeyin ...
<!-- /OTO:projeler -->
```

İşaret dışındaki her yer elle düzenlenebilir. Yerelde çalıştırmak için:

```bash
python3 tools/build.py            # üret
python3 tools/build.py --kontrol  # çıktı güncel mi (CI kullanır)
```

Blog yazıları için ayrıca `blog-<slug>.html` sayfaları ve `sitemap.xml`
otomatik üretilir; yayından kaldırılan yazının sayfası silinir.

### Mesajlar

Statik barındırmada form gönderimlerini alacak bir sunucu olmadığı için
mesajlar panelde saklanamaz. Form varsayılan olarak ziyaretçinin e-posta
uygulamasını açar. Mesajların bir yerde birikmesi için:

1. `web3forms.com` veya `formspree.io` üzerinden ücretsiz bir form adresi alın
2. Panel → **Site & Footer** → *Form servisi adresi* alanına yapıştırın

Bundan sonra her mesaj e-postanıza düşer ve ilgili servisin panelinde listelenir.

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

## İçerik durumu

Sitedeki metinlerin çoğu ofisin tanıtım broşüründen alınmıştır ve gerçektir:
iletişim bilgileri, özgeçmiş, çalışma alanları, proje listesi, etkinlikler ve
referanslar.

### Gerçek ve güncel

- **İletişim** — adres, telefon (+90 546 468 32 21), e-posta, Instagram
- **Projeler** — `projeler.html` içindeki 12 iş (restorasyon, kazı alanı,
  mimari proje, görselleştirme)
- **Haberler** — 2017, 2023 ve 2024 etkinlikleri
- **Hakkımızda** — özgeçmiş zaman çizelgesi ve referanslar
- **Hizmetler** — broşürdeki dört çalışma alanı

### Hâlâ eksik olanlar

1. **Kurucu portresi** — `hakkimizda.html` şu an
   `assets/img/portre-yer-tutucu.svg` gösteriyor. Gerçek fotoğrafı
   `assets/img/fatma-kocaova.jpg` olarak kaydedip (dikey 4:5, ~1000×1250 px)
   `src` ve `width`/`height` değerlerini güncelleyin. Portre, tek renk dile
   uyması için CSS'te gri tonlamalı gösterilir; renkli istenirse
   `main.css` içindeki `.portre img { filter: ... }` satırı silinir.
2. **Proje görselleri** — proje listesi şu an yalnızca künye (yıl, tür, ad, yer)
   gösteriyor. Fotoğraf geldiğinde her kayda görsel ve detay sayfası eklenebilir.
3. **Diğer görseller** — sayfa başlıkları ve doku görselleri hâlâ SVG yer
   tutucudur, bkz. `assets/img/README.md`.
4. **Blog** — henüz yazı yok; sayfa boş durum gösteriyor. İlk yazı eklendiğinde
   `blog.html` içindeki `.bos-durum` bloğu silinip `.kayitlar` listesi konur.
5. **Gizlilik metni** — `gizlilik.html` bir taslaktır; hukuki destek alarak
   ofisin ticari unvanına göre güncelleyin.
6. **Alan adı** — `canonical`, `og:url` ve `sitemap.xml` içinde
   `https://fatmakocaovamimarlik.com/` adresi kullanılır.

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
