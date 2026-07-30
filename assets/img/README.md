# Görseller

Bu klasördeki **tüm `.svg` dosyaları geçici yer tutucudur** (favicon hariç).
Tarihi yapı cephelerini soyutlayan bu çizimler, ofisin gerçek fotoğrafları
hazır olana kadar sitenin eksiksiz görünmesi için `tools/generate-placeholders.py`
ile üretilmiştir.

## Gerçek fotoğraflarla değiştirme

En pratik yol, gerçek fotoğrafı **aynı dosya adıyla** (uzantısı farklı olabilir)
bu klasöre koyup HTML'deki `src` uzantısını güncellemektir:

```bash
# ornek: assets/img/proje-01.svg  ->  assets/img/proje-01.jpg
grep -rn "proje-01.svg" *.html
```

`<img>` etiketlerindeki `width` / `height` değerlerini de fotoğrafın gerçek
piksel ölçüsüyle güncelleyin — bu, sayfa yüklenirken düzen kaymasını önler.
`alt` metinlerini de fotoğrafı gerçekten anlatacak şekilde yazın.

## Dosyalar ve önerilen ölçüler

| Dosya | Kullanıldığı yer | Önerilen ölçü / oran |
|---|---|---|
| `hero.svg` | Anasayfa kahraman bölümü | 2000×1250 (16:10), yatay |
| `hero-hakkimizda.svg` | Hakkımızda sayfa başlığı | 1920×900 |
| `hero-hizmetler.svg` | Hizmetler sayfa başlığı | 1920×900 |
| `hero-projeler.svg` | Projeler sayfa başlığı | 1920×900 |
| `hero-iletisim.svg` | İletişim sayfa başlığı | 1920×900 |
| `about-1.svg` | Anasayfa + Hakkımızda, dikey blok | 1000×1250 (4:5) |
| `about-2.svg` | Çağrı bölümü, kare | 1000×1000 (1:1) |
| `proje-01…06.svg` | Proje kartları | 1000×1250 (4:5) |
| `galeri-01…04.svg` | Proje detay galerileri | 1600×1000 (16:10) |
| `favicon.svg` | Tarayıcı sekmesi ikonu | 64×64 — **değiştirmeyin, logodur** |

## Performans önerileri

- Fotoğrafları **WebP** olarak kaydedin (`.jpg` yerine `.webp`), görünür kayıp
  olmadan %30–50 daha küçük olur.
- Kahraman görselleri için genişlik 2000 px'i geçmesin, kalite %75–80 yeterlidir.
- Kart ve galeri görsellerinde 1200–1600 px genişlik yeterlidir.
- Sayfanın alt kısmındaki görsellerde `loading="lazy"` niteliğini koruyun;
  kahraman görselindeki `fetchpriority="high"` niteliğini de değiştirmeyin.

## Yer tutucuları yeniden üretmek

```bash
python3 tools/generate-placeholders.py
```

Tüm gerçek fotoğraflar yerleştirildiğinde `tools/generate-placeholders.py`
dosyası ve kullanılmayan yer tutucular silinebilir.
