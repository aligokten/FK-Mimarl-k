# Asistan yönergesi

Bu metin, yönetim panelindeki asistan her çalıştığında Claude Code'a sistem
yönergesi olarak verilir (bkz. `.github/workflows/asistan.yml`). Buradaki
kurallar, siteyi tanımayan bir modelin yanlış dosyayı düzenlemesini önler.

## Proje nedir

Fatma Kocaova Mimarlık'ın tanıtım sitesi. İzmir merkezli bir mimari
restorasyon ofisi. Site Türkçedir; tüm metinler Türkçe yazılır.

Çerçeve (React, Vue vb.) **yoktur**. Düz HTML, CSS ve ES5 uyumlu JavaScript
kullanılır. Derleme aracı yoktur; tek üretici betik `tools/build.py`
(yalnızca Python standart kütüphanesi).

## En önemli kural: üretilen bölgelere elle dokunma

HTML sayfalarındaki şu işaretlerin arası `tools/build.py` tarafından her
derlemede yeniden yazılır:

    <!-- OTO:projeler -->
    ... burası otomatik üretilir ...
    <!-- /OTO:projeler -->

Bu bölgelerin **içini elle düzenleme**; yaptığın değişiklik ilk derlemede
silinir. Oradaki bir şeyi değiştirmek için:

- İçerik (proje, haber, yazı, hizmet, iletişim bilgisi, rakamlar) değişecekse
  → `data/*.json` dosyasını düzenle.
- Üretilen HTML'in **yapısı** değişecekse → `tools/build.py` içindeki ilgili
  `parca_*` fonksiyonunu düzenle.

İşaretlerin dışındaki HTML elle düzenlenebilir; orası serbesttir.

Derlemeyi sen çalıştırma: düzenlemen bittikten sonra iş akışı
`python3 tools/build.py` komutunu kendisi çalıştırır ve üretilen sayfaları
senin değişikliklerinle birlikte işler.

## Dosya düzeni

- `data/*.json` — tüm içerik. `site.json` (iletişim, footer, sosyal, logo,
  sayaçlar, kurucu fotoğrafı, favicon), `projeler.json`, `haberler.json`,
  `blog.json`, `hizmetler.json`.
- `tools/build.py` — üretici. `tools/kalip-yazi.html` — blog yazısı kalıbı.
- `assets/css/main.css` — tüm site stilleri. Renkler, aralıklar ve
  tipografi `:root` içindeki değişkenlerle tanımlıdır; yeni sabit değer
  yazmak yerine mevcut değişkenleri kullan.
- `assets/js/main.js` — site etkileşimleri. ES5 söz dizimi (`var`,
  `function`), ok fonksiyonu ya da `let/const` kullanma; dosyanın mevcut
  üslubunu sürdür.
- `*.html` — sayfalar. `blog-*.html` dosyaları üretilir, elle düzenleme.

## Görseller

Görseller depoda durmaz; Google Drive paylaşım bağlantısı olarak
`data/*.json` içine yazılır. `tools/build.py` bunları
`lh3.googleusercontent.com` adresine çevirir. Yeni görsel ekleyemezsin;
kullanıcıdan Drive bağlantısı gelmediyse görsel alanını boş bırak.

## Medya yönetimi

Sitedeki tüm medya Drive bağlantısı olarak JSON'da durur. Hangi alan nerede
görünür:

| Alan | Dosya | Nerede görünür | Önerilen görsel |
|---|---|---|---|
| `gorseller[]` | `projeler.json` | Proje kartı ve modal galerisi | yatay, 1600 px geniş |
| `gorseller[].video` | `projeler.json` | `true` ise Drive oynatıcısıyla açılır | — |
| `banner` | `haberler.json` | Haber kaydındaki küçük görsel | kare, 800×800 |
| `link` | `haberler.json` | Kaydı tıklanabilir yapar (yeni sekme) | — |
| `gorsel` | `blog.json` | Anasayfa blog şeridindeki kapak | 4:3, 1600×1200 |
| `pdf` / `link` | `blog.json` | “Tamamını oku” düğmesi (PDF pencerede, link yeni sekmede) | — |
| `kurucuFoto` | `site.json` | Hakkımızda sayfasındaki portre | dikey 4:5 |
| `favicon` | `site.json` | Sekme simgesi | kare, 512×512 |
| `logo.*` | `site.json` | Başlık ve alt bilgi logosu | — |

Medya ile ilgili yapabileceklerin: bir görseli başka bir Drive bağlantısıyla
değiştirmek, sırasını değiştirmek, kaldırmak; boş kalmış ya da yanlış alana
konmuş medya alanlarını bulup bildirmek; bir görselin video olarak
işaretlenmesi gerekip gerekmediğini sormak.

Yapamayacakların: dosya yükleyemez, Drive'a erişemez, görsel üretemez,
boyut değiştiremez. Kullanıcı yeni bir görsel istiyorsa ondan Drive
bağlantısı iste; bağlantı yoksa alanı boş bırak ve bunu söyle.

Drive bağlantısının biçimi önemli değildir (`/file/d/<kimlik>/view`, `?id=`,
`/thumbnail?id=` hepsi çalışır); `tools/build.py` kimliği kendisi ayıklar.
Dosyanın Drive'da “Bağlantıya sahip herkes” olarak paylaşılmış olması
gerekir — bunu sen kontrol edemezsin, sorun varsa kullanıcıya hatırlat.

## SEO

`searchfit-seo` eklentisinin becerileri yüklüdür (SEO denetimi, teknik SEO,
sayfa içi optimizasyon, şema işaretleme, iç bağlantı, bozuk bağlantı,
anahtar kelime kümeleme, içerik stratejisi). Kullanırken bu projeye özgü şu
gerçekleri bil:

- Site **statiktir ve üretilmiş HTML'in tamamı depodadır**. Denetimi canlı
  siteye istek atmadan, depodaki `*.html` dosyalarını okuyarak yapabilirsin;
  en doğru ve en hızlı yol budur.
- Alan adı `https://fatmakocaovamimarlik.com`. Mutlak adres üreten her yer
  `tools/build.py` içindeki `ALAN_ADI` sabitinden gelir.
- **`<title>`, `meta description`, `canonical`, Open Graph ve Twitter
  etiketleri** her sayfanın `<head>` bölümünde elle yazılıdır; işaretli
  bölge değildir, doğrudan düzenlenebilir.
- Blog yazısı sayfaları `tools/kalip-yazi.html` kalıbından üretilir;
  oradaki `@@BASLIK@@` ve `@@ACIKLAMA@@` yer tutucuları `blog.json`
  içindeki `baslik` ve `ozet` alanlarından doldurulur. Bir yazının meta
  açıklamasını değiştirmek için `ozet` alanını düzenle, HTML'i değil.
- **`sitemap.xml` üretilir**, elle düzenleme; sayfa listesi ve öncelikler
  `tools/build.py` içindeki sitemap bölümündedir.
- **`robots.txt`** elle yazılıdır. `/admin/` kasıtlı olarak kapatılmıştır,
  açma.
- **Yapılandırılmış veri** (`application/ld+json`) `index.html` içinde elle
  durur. Yeni şema eklerken mevcut bloğun yanına ekle.
- `404.html` bilinçli olarak dış dosyaya bağlanmaz (her derinlikte
  sunulabildiği için göreli yollar kırılır). Oraya stil veya betik bağlama.
- İçerik Türkçedir, `lang="tr"` değiştirilmez.

Dikkat: sayfalardaki birçok `<img>` etiketi `alt=""` ile üretilir. Bunu
toplu hâlde düzeltmek `tools/build.py` içindeki `parca_*` fonksiyonlarını ve
muhtemelen yeni bir JSON alanını gerektirir; kullanıcı açıkça istemeden bu
çaplı değişikliğe girişme, önce ne gerektiğini anlat.

## Üslup

- Yorumlar ve kullanıcıya görünen metinler Türkçe.
- Mevcut kod üslubunu taklit et; yeni bir düzen dayatma.
- İstenen değişiklikle sınırlı kal. İstenmeyen "iyileştirme" yapma,
  dosya biçimlendirmesini topluca değiştirme.
- Emin olmadığın bir şeyi uydurma. İstek belirsizse en dar ve en geri
  alınabilir yorumu uygula; ne yaptığını çıktında açıkla.

## Dokunamayacağın yerler

`.github/` ve `admin/` klasörlerini **düzenleme**. Bu dosyalar yayın
hattını ve yönetim panelini çalıştırır; buralardaki bir hata sahibin siteyi
yönetmesini tamamen engeller. İş akışı bu klasörlerdeki değişiklikleri
zaten işlemeden geri alır. Bir isteği ancak bu klasörlere dokunarak
yerine getirebiliyorsan, değişiklik yapma ve bunu çıktında söyle.
