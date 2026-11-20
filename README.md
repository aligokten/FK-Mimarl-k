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
.github/
  workflows/pages.yml        Derleyip GitHub Pages'e yayınlar
  workflows/asistan.yml      Panelden gelen yapay zekâ isteğini uygular
  asistan-yonerge.md         Asistanın uyacağı proje kuralları
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

### Asistan (yapay zekâ ile düzenleme)

Paneldeki **Asistan** sekmesinden gündelik dille istek yazılır (“footer'daki
tanıtım metnini kısalt”, “hizmet kartlarının arasını aç”), değişikliği Claude
yapar ve yayınlar. Diğer sekmelerin kapsamadığı her şey — metin, tasarım, yeni
bölüm — buradan değiştirilebilir.

Akış şöyledir; **yapay zekâ anahtarı tarayıcıya hiç inmez**, yalnızca GitHub
tarafında durur:

```
Panel ──► workflow_dispatch ──► Actions: Claude Code ──► build.py ──► commit ──► yayın
```

Her istek ayrı bir commit olur; beğenilmeyen değişiklik GitHub'dan geri
alınabilir. Bir istek tipik olarak 1–3 dakika sürer, panel ilerlemeyi gösterir.

**Tek seferlik kurulum** (ikisi de yapılmadan Asistan sekmesi çalışmaz):

1. **API anahtarı.** [console.anthropic.com](https://console.anthropic.com)
   üzerinden bir API anahtarı alın ve faturalandırmayı açın (kullandıkça
   ödeme; tipik bir düzenleme birkaç senttir). Sonra depoda:
   Settings → Secrets and variables → Actions → *New repository secret* →
   ad: `ANTHROPIC_API_KEY`, değer: anahtar.
2. **Panelin anahtarına Actions izni.** Yukarıdaki fine-grained token'a
   *Contents: Read and write* yanında **Actions: Read and write** izni de
   ekleyin (yoksa panel iş akışını tetikleyemez, “bulunamadı” hatası alır).

Güvenlik sınırları:

- Asistan `.github/` ve `admin/` klasörlerine yazamaz. Yazmaya çalışırsa iş
  akışı bu değişiklikleri işlemeden geri alır — yayın hattı ve panel, hatalı
  bir istekle bozulamaz.
- Asistana kabuk (Bash) erişimi verilmez; yalnızca dosya okuyup yazabilir.
- İstek metni kabuğa gömülmez, ortam değişkeni olarak aktarılır.
- Asistanın uyacağı proje kuralları `.github/asistan-yonerge.md` dosyasındadır;
  değiştirerek davranışını şekillendirebilirsiniz.

Kaydedilmemiş panel değişikliğiniz varken asistan çalıştırılamaz; panel önce
kaydetmenizi ister (yoksa asistanın commit'i sizin değişikliğinizi kaydedilemez
hâle getirir).

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
mesajlar panelde saklanamaz. Form üç şekilde çalışabilir; seçim panelden
(**Site & Footer → İletişim formu**) yapılır:

| Sağlayıcı | Davranış |
|---|---|
| `yok` | Ziyaretçinin e-posta uygulamasını açar (mailto). Mesaj hiçbir yerde birikmez. |
| `web3forms` | `api.web3forms.com`'a AJAX gönderim. Mesaj e-postanıza düşer ve Web3Forms panelinde listelenir. |
| `ozel` | Formspree gibi bir adrese klasik form gönderimi. |

**Web3Forms bağlamak için:** web3forms.com'da e-postanızla kayıt olun, size
verilen *Access Key* kodunu panele yapıştırın, kaydedin.

Erişim anahtarı sayfa kaynağında görünür — Web3Forms'un tasarımı gereği
böyledir; anahtar yalnızca kayıtlı e-posta adresine mesaj göndermeye yarar,
kayıtları okumaya izin vermez.

Formda görünmez bir tuzak alan (`botcheck`) vardır; botlar doldurduğunda
gönderim sessizce iptal edilir.

## Erişilebilirlik ve performans

- `lang="tr"`, anlamsal HTML, "İçeriğe geç" bağlantısı, görünür odak halkaları
- Mobil menü `aria-expanded` / `aria-hidden` ile yönetilir, Esc ile kapanır
- Akordeon ve filtreler klavye ile kullanılabilir
- `prefers-reduced-motion` tercihinde tüm animasyonlar kapanır
- Görseller `width`/`height` ile tanımlı (düzen kaymasını önler), alt kısımdakiler `loading="lazy"`
- Harici JavaScript kütüphanesi ve çerez kullanılmaz
