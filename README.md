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
  workflows/pages.yml               Derleyip GitHub Pages'e yayınlar
  workflows/asistan.yml             Panelden gelen yapay zekâ isteğini uygular
  workflows/degisiklik-raporu.yml   Sahip dışındaki değişiklikleri raporlar
  workflows/geri-al.yml             Rapora yazılan /geri-al komutunu uygular
  scripts/rapor.py                  Rapor metnini üretir
  scripts/geri_al.sh                Geri alma işlemini yapar
  asistan-yonerge.md                Asistanın uyacağı proje kuralları
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

Panel, GitHub kişisel erişim anahtarıyla (PAT) çalışır. Herkes **kendi
hesabının** anahtarını kullanmalıdır: değişiklik raporları kimin ne yaptığını
anahtarın sahibinden anlar (bkz. *Yetki ve denetim*).

**Depo sahibi** (`aligokten`) — *fine-grained* anahtar:

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
2. *Repository access*: yalnızca bu depo
3. *Permissions* → Repository permissions → **Contents: Read and write** ve
   **Actions: Read and write** (ikincisi Asistan sekmesi için)
4. Süreyi sınırlı tutun (örn. 90 gün); dolunca yenileyin

**Ortak çalışan** (`fatmakocaovamimarlik`) — *classic* anahtar. Fine-grained
anahtarlar yalnızca anahtarın sahibine (ya da üyesi olunan kuruluşa) ait
depolara erişebilir; başka bir kişinin deposunda ortak çalışan olan hesap bu
depoyu seçemez ya da 404 alır.

1. GitHub → Settings → Developer settings → **Tokens (classic)** → Generate new token (classic)
2. *Scopes*: yalnızca **`repo`** işaretlenir. `workflow` işaretlenmez — bu
   sayede bu anahtarla iş akışı dosyaları (yayın hattı, raporlar)
   değiştirilemez.
3. Süre: sınırlı (örn. 90 gün)

> Classic anahtar o hesabın erişebildiği tüm depolara açılır; anahtarı
> yalnızca bu panelde kullanın ve başka yerle paylaşmayın.

Anahtar yalnızca tarayıcının `localStorage` alanında saklanır, hiçbir sunucuya
gönderilmez. Ortak bilgisayarda iş bitince **Çıkış**'a basın — anahtar silinir.

> Panel `robots.txt` ile arama motorlarına kapatılmıştır ve sayfada
> `noindex` etiketi vardır. Yine de adresi herkese açıktır; koruma
> anahtarın kendisindedir.

### Asistan (yapay zekâ ile düzenleme)

Paneldeki **Asistan** sekmesinden gündelik dille istek yazılır (“footer'daki
tanıtım metnini kısalt”, “hizmet kartlarının arasını aç”), değişikliği Claude
yapar ve yayınlar. Diğer sekmelerin kapsamadığı her şey — metin, tasarım, yeni
bölüm — buradan değiştirilebilir. Ayrıca iki uzmanlık alanı yüklüdür:

- **SEO** — [searchfit-seo](https://github.com/searchfit/searchfit-seo)
  eklentisi (MIT, üçüncü taraf) iş akışında belirli bir commit'e sabitlenmiş
  hâlde yüklenir. SEO denetimi, teknik SEO, sayfa içi optimizasyon, şema
  işaretleme, iç bağlantı, bozuk bağlantı taraması, anahtar kelime kümeleme
  ve içerik stratejisi becerileri gelir. Eklenti saf Markdown'dır
  (çalıştırılabilir betik içermez); alınamazsa asistan eklentisiz devam eder.
- **Medya yönetimi** — hangi görselin nerede kullanıldığı, önerilen boyutlar
  ve eksik/yanlış yerleştirilmiş medya `.github/asistan-yonerge.md` içinde
  tanımlıdır. Asistan Drive'a erişemez: yeni görsel yükleyemez, yalnızca
  verdiğiniz Drive bağlantılarını yerleştirir ve düzenler.

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
2. **Panelin anahtarına Actions izni.** Fine-grained anahtarda *Contents*
   yanında **Actions: Read and write** izni de olmalı (yoksa panel iş akışını
   tetikleyemez, “Resource not accessible by personal access token” hatası
   alır). Ortak çalışanın classic anahtarındaki `repo` kapsamı bunu zaten
   içerir.

Güvenlik sınırları:

- Asistan `.github/` ve `admin/` klasörlerine yazamaz. Yazmaya çalışırsa iş
  akışı bu değişiklikleri işlemeden geri alır — yayın hattı ve panel, hatalı
  bir istekle bozulamaz.
- Asistana kabuk (Bash) erişimi verilmez; yalnızca dosya okuyup yazabilir ve
  web sayfası getirebilir (SEO denetimi için gerekir).
- İstek metni kabuğa gömülmez, ortam değişkeni olarak aktarılır.
- Asistanın uyacağı proje kuralları `.github/asistan-yonerge.md` dosyasındadır;
  değiştirerek davranışını şekillendirebilirsiniz.

Kaydedilmemiş panel değişikliğiniz varken asistan çalıştırılamaz; panel önce
kaydetmenizi ister (yoksa asistanın commit'i sizin değişikliğinizi kaydedilemez
hâle getirir).

### Yetki ve denetim

Sitede iki hesap yetkilidir:

| Hesap | Rol | Ne yapabilir |
|---|---|---|
| `aligokten` | Depo sahibi (admin) | Her şey; raporları alır, değişiklikleri geri alır |
| `fatmakocaovamimarlik` | Ortak çalışan (write) | Panelden ve Asistan'dan **onay beklemeden** değişiklik yapar |

Ortak çalışanın her değişikliği **onaya takılmadan yayına girer**, ama aynı
anda depo sahibine atanmış bir GitHub kaydı (issue) olarak raporlanır:

```
değişiklik ──► main ──► yayın
                 └────► "Değişiklik raporu" kaydı ──► sahibe bildirim
```

Rapor; kimin, ne zaman, hangi yoldan (Yönetim paneli / Asistan / doğrudan)
neyi değiştirdiğini, değişen dosyaları ve farkın kendisini içerir. Asistan
değişikliklerinde panele yazılan istek metni de rapordadır. Raporlar
**Issues** sekmesinde `degisiklik-raporu` etiketiyle listelenir.

Rapor üzerinden müdahale:

- **Sorun yoksa:** kaydı kapatın.
- **Geri almak için:** kayda `/geri-al` yazın. Değişiklik yeni bir commit ile
  geri alınır, sayfalar yeniden üretilir, site yeniden yayınlanır ve kayıt
  `geri-alindi` etiketiyle kapanır. Bu komutu **yalnızca depo sahibi**
  kullanabilir; başkasının yazdığı `/geri-al` yok sayılır.
- Sonradan aynı yere dokunan başka bir değişiklik varsa otomatik geri alma
  çakışır; bu durumda hiçbir şey değiştirilmez ve kayda açıklama yazılır.
  Önce daha yeni raporu geri almayı deneyin.
- Ortak çalışanın erişimini tamamen kesmek için: Settings → Collaborators →
  hesabı kaldırın.

Raporlanmayanlar: depo sahibinin kendi değişiklikleri ve sahibin çalıştırdığı
Asistan istekleri.

Bilinmesi gerekenler:

- **Bildirim:** kayıtlar size atanır; GitHub bunları e-postayla bildirir.
  Gelmiyorsa GitHub → Settings → Notifications ayarını kontrol edin.
- **Görünürlük:** depo herkese açık olduğu için raporlar da herkese açıktır.
- **Güven sınırı:** sistem kazara yapılan hataları yakalamak için tasarlandı,
  kötü niyete karşı bir kilit değildir. Ortak çalışan, GitHub web arayüzünden
  iş akışı dosyalarını değiştirebilir; `.github/` veya `admin/`'e dokunan her
  değişiklik raporda ⚠️ ile işaretlenir, ama raporlama iş akışının kendisi
  silinirse o değişiklik raporlanmaz. Kesin zorlama gerekirse değişikliklerin
  pull request ile onaylanması gerekir — bu da “onay beklemeden” ilkesiyle
  çelişir.
- Rapor ve geri alma betikleri `.github/scripts/` altındadır; Asistan bu
  klasöre yazamaz, yani kendi raporunu değiştiremez.

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
