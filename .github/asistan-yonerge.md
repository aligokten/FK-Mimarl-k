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
