/* ==========================================================================
   Yönetim paneli

   İçerik depodaki data/*.json dosyalarında tutulur. Panel bu dosyaları
   GitHub Contents API üzerinden okur ve yazar. Yazma işlemi main dalına bir
   commit oluşturur; bu da GitHub Actions iş akışını tetikler ve site
   yeniden üretilip yayınlanır (bkz. tools/build.py).

   Sunucu yoktur: erişim anahtarı yalnızca tarayıcıda (localStorage)
   saklanır ve doğrudan api.github.com'a gönderilir.
   ========================================================================== */
(function () {
  "use strict";

  var API = "https://api.github.com";
  var DOSYALAR = ["site", "hizmetler", "projeler", "haberler", "blog"];

  var ayar = {};      // { token, sahip, repo, dal }
  var veri = {};      // { projeler: [...], ... }
  var sha = {};       // dosya adı -> son bilinen sha
  var kirli = {};     // dosya adı -> değişti mi

  /* ------------------------------------------------------------ yardımcı */
  function $(s, k) { return (k || document).querySelector(s); }
  function el(tag, sinif, metin) {
    var e = document.createElement(tag);
    if (sinif) e.className = sinif;
    if (metin !== undefined) e.textContent = metin;
    return e;
  }

  function b64kodla(metin) {
    var bayt = new TextEncoder().encode(metin);
    var ikili = "";
    bayt.forEach(function (b) { ikili += String.fromCharCode(b); });
    return btoa(ikili);
  }

  function b64coz(b64) {
    var ikili = atob(b64.replace(/\s/g, ""));
    var bayt = new Uint8Array(ikili.length);
    for (var i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bayt);
  }

  function slugla(metin) {
    var tr = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u" };
    return String(metin).toLowerCase()
      .replace(/[çğıöşü]/g, function (c) { return tr[c]; })
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "yazi";
  }

  function bildir(mesaj, tur) {
    var b = $("#bildirim");
    b.className = "bildirim" + (tur ? " bildirim--" + tur : "");
    b.textContent = mesaj;
    b.hidden = false;
    if (tur === "ok") window.setTimeout(function () { b.hidden = true; }, 6000);
  }

  function durumYaz(metin) { $("#durum").textContent = metin || ""; }

  /* --------------------------------------------------------------- API */
  function istek(yol, secenek) {
    secenek = secenek || {};
    return fetch(API + yol, {
      method: secenek.method || "GET",
      headers: {
        Authorization: "Bearer " + ayar.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: secenek.body ? JSON.stringify(secenek.body) : undefined
    }).then(function (y) {
      if (!y.ok) {
        return y.json().catch(function () { return {}; }).then(function (j) {
          var m = j.message || y.statusText;
          if (y.status === 401) m = "Erişim anahtarı geçersiz veya süresi dolmuş.";
          if (y.status === 404) m = "Depo veya dosya bulunamadı — depo adı ve anahtar iznini kontrol edin.";
          if (y.status === 409) m = "Dosya bu arada değişmiş. Sayfayı yenileyip tekrar deneyin.";
          throw new Error(m);
        });
      }
      return y.status === 204 ? null : y.json();
    });
  }

  function dosyaYolu(ad) {
    return "/repos/" + ayar.sahip + "/" + ayar.repo + "/contents/data/" + ad + ".json";
  }

  function dosyaOku(ad) {
    return istek(dosyaYolu(ad) + "?ref=" + encodeURIComponent(ayar.dal)).then(function (y) {
      sha[ad] = y.sha;
      return JSON.parse(b64coz(y.content));
    });
  }

  /* Depodaki herhangi bir yolun sha'sı — dosya yoksa null.
     Yeni dosya yazarken sha gönderilmez, var olanı güncellerken zorunludur. */
  function yolSha(yol) {
    return istek("/repos/" + ayar.sahip + "/" + ayar.repo + "/contents/" +
                 yol + "?ref=" + encodeURIComponent(ayar.dal))
      .then(function (y) { return y.sha; })
      .catch(function () { return null; });
  }

  /* İkili dosya (görsel) yazar. icerikB64 doğrudan base64 gövdedir. */
  function ikiliYaz(yol, icerikB64, mesaj) {
    return yolSha(yol).then(function (sha) {
      return istek("/repos/" + ayar.sahip + "/" + ayar.repo + "/contents/" + yol, {
        method: "PUT",
        body: {
          message: mesaj,
          content: icerikB64,
          sha: sha || undefined,
          branch: ayar.dal
        }
      });
    });
  }

  function dosyaYaz(ad, icerik, mesaj) {
    return istek(dosyaYolu(ad), {
      method: "PUT",
      body: {
        message: mesaj,
        content: b64kodla(JSON.stringify(icerik, null, 2) + "\n"),
        sha: sha[ad],
        branch: ayar.dal
      }
    }).then(function (y) {
      sha[ad] = y.content.sha;
      return y;
    });
  }

  /* ------------------------------------------------------------- giriş

     Panelin arkasında sunucu yoktur; asıl yetki GitHub erişim anahtarındadır.
     Bu yüzden kullanıcı adı/şifre sahte bir kapı değil: anahtar, şifreden
     türetilen bir anahtarla (PBKDF2 + AES-GCM) şifrelenip bu tarayıcıda
     saklanır. Şifre yanlışsa çözme başarısız olur, anahtar ele geçmez.
     -------------------------------------------------------------------- */
  var KASA = "fkAdminKasa";        // localStorage — şifreli anahtar
  var OTURUM = "fkAdminOturum";    // sessionStorage — açık oturum
  var ESKI = "fkAdmin";            // eski sürümdeki düz kayıt (taşınır)
  var HATA_GIRIS = "Kullanıcı adı veya şifre hatalı.";

  function baytB64(bayt) {
    var ikili = "";
    new Uint8Array(bayt).forEach(function (b) { ikili += String.fromCharCode(b); });
    return btoa(ikili);
  }

  function b64Bayt(b64) {
    var ikili = atob(b64);
    var bayt = new Uint8Array(ikili.length);
    for (var i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
    return bayt;
  }

  function kripto() {
    return window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
  }

  function anahtarTuret(sifre, tuz) {
    return kripto().importKey(
      "raw", new TextEncoder().encode(sifre), "PBKDF2", false, ["deriveKey"]
    ).then(function (k) {
      return kripto().deriveKey(
        { name: "PBKDF2", salt: tuz, iterations: 200000, hash: "SHA-256" },
        k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
      );
    });
  }

  function kasaOku() {
    try { return JSON.parse(localStorage.getItem(KASA) || "null"); }
    catch (e) { return null; }
  }

  function kasaYaz(kullanici, sifre, gizli) {
    var tuz = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return anahtarTuret(sifre, tuz).then(function (a) {
      return kripto().encrypt(
        { name: "AES-GCM", iv: iv }, a,
        new TextEncoder().encode(JSON.stringify(gizli))
      );
    }).then(function (sifreli) {
      localStorage.setItem(KASA, JSON.stringify({
        s: 1,
        kullanici: kullanici,
        tuz: baytB64(tuz),
        iv: baytB64(iv),
        kasa: baytB64(sifreli)
      }));
      localStorage.removeItem(ESKI);
    });
  }

  function kasaCoz(kullanici, sifre) {
    var k = kasaOku();
    if (!k) return Promise.reject(new Error("Kurulum yapılmamış."));
    if (kullanici.toLowerCase() !== String(k.kullanici).toLowerCase()) {
      return Promise.reject(new Error(HATA_GIRIS));
    }
    return anahtarTuret(sifre, b64Bayt(k.tuz)).then(function (a) {
      return kripto().decrypt(
        { name: "AES-GCM", iv: b64Bayt(k.iv) }, a, b64Bayt(k.kasa)
      );
    }).then(
      function (acik) { return JSON.parse(new TextDecoder().decode(acik)); },
      function () { throw new Error(HATA_GIRIS); }
    );
  }

  function oturumYukle() {
    try { return JSON.parse(sessionStorage.getItem(OTURUM) || "null"); }
    catch (e) { return null; }
  }

  function hataGoster(secici, mesaj) {
    var h = $(secici);
    h.textContent = mesaj;
    h.hidden = !mesaj;
  }

  function girisDene() {
    hataGoster("#girisHata", "");
    var kullanici = $("#kullaniciGiris").value.trim();
    var sifre = $("#sifreGiris").value;
    if (!kullanici || !sifre) {
      hataGoster("#girisHata", "Kullanıcı adı ve şifre gerekli.");
      return;
    }
    durumYaz("Giriş yapılıyor…");
    kasaCoz(kullanici, sifre)
      .then(function (gizli) {
        ayar = gizli;
        return baslat();
      })
      .catch(function (e) {
        hataGoster("#girisHata", e.message);
        durumYaz("");
      });
  }

  function kurulumDene() {
    hataGoster("#kurulumHata", "");
    var kullanici = $("#kullaniciKur").value.trim();
    var sifre = $("#sifreKur").value;
    var gizli = {
      token: $("#tokenGiris").value.trim(),
      sahip: $("#repoSahibi").value.trim(),
      repo: $("#repoAd").value.trim(),
      dal: $("#repoDal").value.trim() || "main"
    };
    if (!kullanici || !sifre) {
      hataGoster("#kurulumHata", "Kullanıcı adı ve şifre gerekli.");
      return;
    }
    if (!gizli.token) {
      hataGoster("#kurulumHata", "Erişim anahtarı gerekli.");
      return;
    }
    durumYaz("Bağlanılıyor…");
    ayar = gizli;
    /* Anahtar ancak GitHub'a bağlanabildiği doğrulandıktan sonra saklanır. */
    baslat()
      .then(function () { return kasaYaz(kullanici, sifre, gizli); })
      .catch(function (e) {
        hataGoster("#kurulumHata", e.message);
        durumYaz("");
      });
  }

  function cikis() {
    sessionStorage.removeItem(OTURUM);
    location.reload();
  }

  function kilidiSifirla() {
    if (!window.confirm(
      "Kayıtlı erişim anahtarı bu tarayıcıdan silinecek ve kurulumu " +
      "yeniden yapmanız gerekecek. Devam edilsin mi?"
    )) return;
    localStorage.removeItem(KASA);
    sessionStorage.removeItem(OTURUM);
    location.reload();
  }

  function baslat() {
    return Promise.all(DOSYALAR.map(function (ad) {
      return dosyaOku(ad).then(function (v) { veri[ad] = v; });
    })).then(function () {
      try { sessionStorage.setItem(OTURUM, JSON.stringify(ayar)); } catch (e) { /* yoksay */ }
      $("#giris").hidden = true;
      $("#kurulum").hidden = true;
      $("#kabuk").hidden = false;
      $("#cikis").hidden = false;
      durumYaz(ayar.sahip + "/" + ayar.repo);
      cizAll();
    });
  }

  /* ------------------------------------------------- form alanı üreticiler */
  function alan(etiket, deger, degisti, secenek) {
    secenek = secenek || {};
    var d = el("div", "alan");
    var id = "a" + Math.random().toString(36).slice(2, 9);
    var l = el("label", null, etiket);
    l.htmlFor = id;
    var girdi = el(secenek.cokSatir ? "textarea" : "input");
    girdi.id = id;
    girdi.value = deger == null ? "" : deger;
    if (secenek.tip) girdi.type = secenek.tip;
    if (secenek.ipucu) girdi.placeholder = secenek.ipucu;
    girdi.addEventListener("input", function () { degisti(girdi.value); });
    d.appendChild(l);
    d.appendChild(girdi);
    if (secenek.aciklama) d.appendChild(el("span", "ipucu", secenek.aciklama));
    return d;
  }

  function onay(etiket, deger, degisti) {
    var d = el("div", "alan");
    var l = el("label");
    l.style.textTransform = "none";
    l.style.letterSpacing = "0";
    l.style.fontSize = "14px";
    l.style.display = "flex";
    l.style.alignItems = "center";
    l.style.gap = ".5rem";
    var g = el("input");
    g.type = "checkbox";
    g.checked = !!deger;
    g.style.width = "auto";
    g.addEventListener("change", function () { degisti(g.checked); });
    l.appendChild(g);
    l.appendChild(document.createTextNode(etiket));
    d.appendChild(l);
    return d;
  }

  function kartUst(baslik, i, liste, dosya, ek) {
    var u = el("div", "kart__ust");
    u.appendChild(el("span", "kart__no", String(i + 1).padStart(2, "0")));
    u.appendChild(el("strong", null, baslik));
    if (ek) u.appendChild(ek);
    u.appendChild(el("span", "bosluk"));

    function tasi(yon) {
      var j = i + yon;
      if (j < 0 || j >= liste.length) return;
      var t = liste[i]; liste[i] = liste[j]; liste[j] = t;
      isaretle(dosya); cizAll();
    }
    var yukari = el("button", "btn btn--kucuk btn--ikinci", "↑");
    yukari.title = "Yukarı taşı";
    yukari.addEventListener("click", function () { tasi(-1); });
    var asagi = el("button", "btn btn--kucuk btn--ikinci", "↓");
    asagi.title = "Aşağı taşı";
    asagi.addEventListener("click", function () { tasi(1); });
    var sil = el("button", "btn btn--kucuk btn--tehlike", "Sil");
    sil.addEventListener("click", function () {
      if (!window.confirm("“" + baslik + "” silinsin mi?")) return;
      liste.splice(i, 1); isaretle(dosya); cizAll();
    });
    u.appendChild(yukari); u.appendChild(asagi); u.appendChild(sil);
    return u;
  }

  function isaretle(dosya) {
    kirli[dosya] = true;
    var d = document.querySelector('[data-kaydet="' + dosya + '"]');
    if (d) d.textContent = "Kaydet ve yayınla •";
  }

  /* ------------------------------------------------------------ çizim */
  function cizProjeler() {
    var kap = $("#projelerListe");
    kap.textContent = "";
    var liste = veri.projeler;
    if (!liste.length) kap.appendChild(el("div", "bos", "Henüz proje yok."));

    liste.forEach(function (p, i) {
      var k = el("div", "kart");
      var rozet = p.oneCikan ? el("span", "rozet rozet--yayin", "Öne çıkan") : null;
      k.appendChild(kartUst(p.baslik || "(adsız)", i, liste, "projeler", rozet));

      var s1 = el("div", "satir satir--3");
      s1.appendChild(alan("Başlık", p.baslik, function (v) { p.baslik = v; isaretle("projeler"); }));
      s1.appendChild(alan("Yıl", p.yil, function (v) { p.yil = v; isaretle("projeler"); }));
      s1.appendChild(alan("Yer", p.yer, function (v) { p.yer = v; isaretle("projeler"); },
        { aciklama: "Örn. İzmir · Konak" }));
      k.appendChild(s1);

      var s2 = el("div", "satir satir--2");
      s2.appendChild(alan("Tür (görünen)", p.tur, function (v) {
        p.tur = v; p.turSlug = slugla(v); isaretle("projeler");
      }, { aciklama: "Filtre düğmesi bu addan üretilir." }));
      s2.appendChild(alan("Not (isteğe bağlı)", p["not"], function (v) { p["not"] = v; isaretle("projeler"); }));
      k.appendChild(s2);

      k.appendChild(alan("Açıklama (modalda görünür)", p.metin, function (v) {
        p.metin = v; isaretle("projeler");
      }, { cokSatir: true, aciklama: "Anasayfada karta basıldığında açılan pencerede gösterilir." }));

      k.appendChild(gorselListesi(p, "projeler"));

      k.appendChild(onay("Anasayfada öne çıkar", p.oneCikan, function (v) {
        p.oneCikan = v; isaretle("projeler"); cizAll();
      }));
      kap.appendChild(k);
    });
  }

  /* ------------------------------------------------------ Drive görselleri

     Drive'ın paylaşım adresi bir HTML sayfasıdır, doğrudan görsel değil.
     Burada yalnızca ÖNİZLEME için adres çevrilir; JSON'a ham bağlantı
     yazılır ve asıl çeviriyi tools/build.py yapar. Böylece Google adres
     biçimini değiştirirse tek yerde düzeltmek yeter.
     -------------------------------------------------------------------- */
  var DRIVE_DESENLERI = [
    /drive\.google\.com\/file\/d\/([\w-]{20,})/,
    /drive\.google\.com\/open\?id=([\w-]{20,})/,
    /drive\.google\.com\/uc\?(?:export=\w+&)?id=([\w-]{20,})/,
    /drive\.google\.com\/thumbnail\?id=([\w-]{20,})/,
    /docs\.google\.com\/uc\?(?:export=\w+&)?id=([\w-]{20,})/
  ];

  function driveKimligi(ham) {
    var m = String(ham || "").trim();
    for (var i = 0; i < DRIVE_DESENLERI.length; i++) {
      var e = DRIVE_DESENLERI[i].exec(m);
      if (e) return e[1];
    }
    return /^[\w-]{25,}$/.test(m) ? m : null;
  }

  function onizlemeAdresi(ham, genislik) {
    var kimlik = driveKimligi(ham);
    if (kimlik) return "https://lh3.googleusercontent.com/d/" + kimlik + "=w" + (genislik || 600);
    var m = String(ham || "").trim();
    // Depo içi göreli yol: panel /admin/ altında olduğu için bir üst dizin
    return m && m.indexOf("http") !== 0 ? "../" + m : m;
  }

  function medyaAdresi(oge) {
    return typeof oge === "object" && oge ? String(oge.adres || "") : String(oge || "");
  }
  function medyaVideoMu(oge) {
    return typeof oge === "object" && oge ? !!oge.video : false;
  }

  function gorselSatiri(dizi, i, dosya, yenile) {
    var d = el("div", "gorsel-satir");

    var ust = el("div", "gorsel-satir__ust");
    ust.appendChild(el("span", "kart__no", String(i + 1).padStart(2, "0")));
    ust.appendChild(el("span", "bosluk"));

    function tasi(yon) {
      var j = i + yon;
      if (j < 0 || j >= dizi.length) return;
      var t = dizi[i]; dizi[i] = dizi[j]; dizi[j] = t;
      isaretle(dosya); yenile();
    }
    var yu = el("button", "btn btn--ikinci btn--kucuk", "↑");
    yu.addEventListener("click", function () { tasi(-1); });
    var as = el("button", "btn btn--ikinci btn--kucuk", "↓");
    as.addEventListener("click", function () { tasi(1); });
    var si = el("button", "btn btn--tehlike btn--kucuk", "Sil");
    si.addEventListener("click", function () {
      dizi.splice(i, 1); isaretle(dosya); yenile();
    });
    ust.appendChild(yu); ust.appendChild(as); ust.appendChild(si);
    d.appendChild(ust);

    var govde = el("div", "gorsel-satir__govde");

    var video = medyaVideoMu(dizi[i]);
    var kaynak = medyaAdresi(dizi[i]).trim();

    var on = el("div", "onizleme onizleme--kucuk");
    if (kaynak) {
      var im = el("img");
      im.src = onizlemeAdresi(kaynak, 600);
      im.alt = "";
      im.addEventListener("error", function () {
        on.textContent = "";
        var uy = el("span", "ipucu");
        uy.style.color = "var(--hata)";
        uy.textContent = "Görsel açılamadı — dosya “Bağlantıya sahip herkes” " +
                         "olarak paylaşılmamış olabilir.";
        on.appendChild(uy);
      });
      on.appendChild(im);
    } else {
      on.appendChild(el("span", "ipucu", "Bağlantı yapıştırın"));
    }
    govde.appendChild(on);

    var girdi = el("input");
    girdi.type = "url";
    girdi.value = kaynak;
    girdi.placeholder = "https://drive.google.com/file/d/.../view?usp=sharing";
    function yaz(adres, videoMu) {
      dizi[i] = videoMu ? { adres: adres, video: true } : adres;
    }
    girdi.addEventListener("input", function () {
      yaz(girdi.value.trim(), video); isaretle(dosya);
    });
    girdi.addEventListener("change", yenile); // önizlemeyi tazele
    govde.appendChild(girdi);

    var videoAlan = el("label", "onay-satiri");
    var videoKutu = el("input");
    videoKutu.type = "checkbox";
    videoKutu.checked = video;
    videoKutu.addEventListener("change", function () {
      yaz(girdi.value.trim(), videoKutu.checked); isaretle(dosya);
    });
    videoAlan.appendChild(videoKutu);
    videoAlan.appendChild(document.createTextNode(" Bu bir video (Drive oynatıcısıyla açılır)"));
    govde.appendChild(videoAlan);

    d.appendChild(govde);
    return d;
  }

  function kapakGorseli(nesne, dosya, yenile, secenek) {
    secenek = secenek || {};
    var alanAdi = secenek.alan || "gorsel";
    var d = el("div", "alan");
    d.appendChild(el("label", null, secenek.etiket || "Kapak görseli"));

    var on = el("div", "onizleme onizleme--kucuk");
    var kaynak = String(nesne[alanAdi] || "").trim();
    if (kaynak) {
      var im = el("img");
      im.src = onizlemeAdresi(kaynak, 600);
      im.alt = "";
      im.addEventListener("error", function () {
        on.textContent = "";
        var uy = el("span", "ipucu");
        uy.style.color = "var(--hata)";
        uy.textContent = "Görsel açılamadı — paylaşım ayarını kontrol edin.";
        on.appendChild(uy);
      });
      on.appendChild(im);
    } else {
      on.appendChild(el("span", "ipucu",
        secenek.bosIpucu || "Anasayfadaki kartta görünür. Boşsa kategori adı yazılır."));
    }
    d.appendChild(on);

    var girdi = el("input");
    girdi.type = "url";
    girdi.value = nesne[alanAdi] || "";
    girdi.placeholder = "https://drive.google.com/file/d/.../view?usp=sharing";
    girdi.addEventListener("input", function () {
      nesne[alanAdi] = girdi.value.trim(); isaretle(dosya);
    });
    girdi.addEventListener("change", yenile);
    d.appendChild(girdi);
    d.appendChild(el("span", "ipucu",
      "Drive bağlantısı. Dosya “Bağlantıya sahip herkes” olarak paylaşılmış olmalı."));
    return d;
  }

  function gorselListesi(nesne, dosya) {
    var d = el("div", "alan");
    d.appendChild(el("label", null, "Görseller"));

    var bilgi = el("div", "bildirim bildirim--uyari");
    bilgi.innerHTML =
      "<strong>Google Drive bağlantısı yapıştırın.</strong> Dosyaya sağ tıklayın → " +
      "<em>Paylaş</em> → <em>Genel erişim</em> bölümünü " +
      "<strong>“Bağlantıya sahip herkes”</strong> yapın → <em>Bağlantıyı kopyala</em>. " +
      "Paylaşım kapalıysa görsel sitede görünmez.";
    d.appendChild(bilgi);

    if (!nesne.gorseller) nesne.gorseller = [];
    var dizi = nesne.gorseller;

    function yenile() { cizProjeler(); }

    if (!dizi.length) {
      d.appendChild(el("div", "bos", "Henüz görsel eklenmedi."));
    } else {
      dizi.forEach(function (_, i) {
        d.appendChild(gorselSatiri(dizi, i, dosya, yenile));
      });
    }

    var ekle = el("button", "btn btn--ikinci btn--kucuk", "+ Görsel ekle");
    ekle.style.justifySelf = "start";
    ekle.style.marginTop = ".5rem";
    ekle.addEventListener("click", function () {
      dizi.push(""); isaretle(dosya); yenile();
    });
    d.appendChild(ekle);
    return d;
  }

  function cizHaberler() {
    var kap = $("#haberlerListe");
    kap.textContent = "";
    var liste = veri.haberler;
    if (!liste.length) kap.appendChild(el("div", "bos", "Henüz haber yok."));

    liste.forEach(function (h, i) {
      var k = el("div", "kart");
      k.appendChild(kartUst(h.baslik || "(adsız)", i, liste, "haberler"));
      var s1 = el("div", "satir satir--3");
      s1.appendChild(alan("Başlık", h.baslik, function (v) { h.baslik = v; isaretle("haberler"); }));
      s1.appendChild(alan("Yıl", h.yil, function (v) { h.yil = v; isaretle("haberler"); }));
      s1.appendChild(alan("Tür", h.tur, function (v) { h.tur = v; isaretle("haberler"); },
        { aciklama: "Bildiri, Panel, Forum, Söyleşi…" }));
      k.appendChild(s1);
      k.appendChild(alan("Yer", h.yer, function (v) { h.yer = v; isaretle("haberler"); }));
      k.appendChild(alan("Özet", h.ozet, function (v) { h.ozet = v; isaretle("haberler"); },
        { cokSatir: true }));

      k.appendChild(kapakGorseli(h, "haberler", cizHaberler, {
        alan: "banner",
        etiket: "Banner görseli",
        bosIpucu: "İsteğe bağlı. Eklenirse kayıtta küçük bir görsel olarak görünür " +
                  "(sitede siyah-beyaz, üzerine gelince renkli görünür)."
      }));

      k.appendChild(alan("Harici bağlantı", h.link, function (v) {
        h.link = v.trim(); isaretle("haberler");
      }, {
        tip: "url",
        ipucu: "https://...",
        aciklama: "Doldurulursa kayıt tıklanabilir olur ve yeni sekmede bu adresi açar " +
                  "(ör. sempozyumun kendi sitesi, haberin yayınlandığı sayfa)."
      }));

      kap.appendChild(k);
    });
  }

  function cizBlog() {
    var kap = $("#blogListe");
    kap.textContent = "";
    var liste = veri.blog;
    if (!liste.length) kap.appendChild(el("div", "bos", "Henüz yazı yok."));

    liste.forEach(function (y, i) {
      var k = el("div", "kart");
      var rozet = el("span", "rozet " + (y.yayinda ? "rozet--yayin" : "rozet--taslak"),
        y.yayinda ? "Yayında" : "Taslak");
      k.appendChild(kartUst(y.baslik || "(adsız)", i, liste, "blog", rozet));

      k.appendChild(alan("Başlık", y.baslik, function (v) {
        y.baslik = v;
        if (!y.slugKilit) y.slug = slugla(v);
        isaretle("blog");
      }));
      k.appendChild(alan("Adres eki (slug)", y.slug, function (v) {
        y.slug = slugla(v); y.slugKilit = true; isaretle("blog");
      }, { aciklama: "Sayfa adresi: blog-" + (y.slug || "…") + ".html" }));

      var s1 = el("div", "satir satir--3");
      s1.appendChild(alan("Ay", y.ay, function (v) { y.ay = v; isaretle("blog"); },
        { ipucu: "Şubat" }));
      s1.appendChild(alan("Yıl", y.yil, function (v) { y.yil = v; isaretle("blog"); },
        { ipucu: "2026" }));
      s1.appendChild(alan("Kategori", y.kategori, function (v) { y.kategori = v; isaretle("blog"); },
        { ipucu: "Malzeme" }));
      k.appendChild(s1);

      var s2 = el("div", "satir satir--2");
      s2.appendChild(alan("Okuma süresi", y.sure, function (v) { y.sure = v; isaretle("blog"); },
        { ipucu: "8 dk" }));
      s2.appendChild(alan("Özet", y.ozet, function (v) { y.ozet = v; isaretle("blog"); },
        { aciklama: "Listede ve sayfa başında görünür." }));
      k.appendChild(s2);

      k.appendChild(kapakGorseli(y, "blog", cizBlog));

      k.appendChild(alan("Dergi dosyası (PDF)", y.pdf, function (v) {
        y.pdf = v.trim(); isaretle("blog");
      }, {
        tip: "url",
        ipucu: "https://drive.google.com/file/d/.../view?usp=sharing",
        aciklama: "Doldurulursa yazı sayfasında “Yazının tamamını okumak için tıklayınız” " +
                  "düğmesi görünür ve PDF açılır pencerede gösterilir. Drive bağlantısı " +
                  "“Bağlantıya sahip herkes” olarak paylaşılmış olmalı."
      }));

      k.appendChild(onay("Yayında", y.yayinda, function (v) {
        y.yayinda = v; isaretle("blog"); cizAll();
      }));

      // --- içerik blokları
      var basl = el("div", "alan");
      basl.appendChild(el("label", null, "Yazı içeriği"));
      k.appendChild(basl);

      y.bloklar = y.bloklar || [];
      y.bloklar.forEach(function (b, bi) {
        var bd = el("div", "blok");
        var bu = el("div", "blok__ust");
        var sec = el("select");
        [["p", "Paragraf"], ["baslik", "Başlık"], ["altbaslik", "Alt başlık"],
         ["liste", "Liste"], ["alinti", "Alıntı"]].forEach(function (o) {
          var op = el("option", null, o[1]);
          op.value = o[0];
          if ((b.tip || "p") === o[0]) op.selected = true;
          sec.appendChild(op);
        });
        sec.addEventListener("change", function () { b.tip = sec.value; isaretle("blog"); cizAll(); });
        bu.appendChild(sec);
        bu.appendChild(el("span", "bosluk"));

        function blokTasi(yon) {
          var j = bi + yon;
          if (j < 0 || j >= y.bloklar.length) return;
          var t = y.bloklar[bi]; y.bloklar[bi] = y.bloklar[j]; y.bloklar[j] = t;
          isaretle("blog"); cizAll();
        }
        var yu = el("button", "btn btn--kucuk btn--ikinci", "↑");
        yu.addEventListener("click", function () { blokTasi(-1); });
        var as = el("button", "btn btn--kucuk btn--ikinci", "↓");
        as.addEventListener("click", function () { blokTasi(1); });
        var si = el("button", "btn btn--kucuk btn--tehlike", "Sil");
        si.addEventListener("click", function () {
          y.bloklar.splice(bi, 1); isaretle("blog"); cizAll();
        });
        bu.appendChild(yu); bu.appendChild(as); bu.appendChild(si);
        bd.appendChild(bu);

        var ta = el("textarea");
        ta.value = b.metin || "";
        ta.placeholder = b.tip === "liste" ? "Her satır bir madde" : "";
        ta.addEventListener("input", function () { b.metin = ta.value; isaretle("blog"); });
        bd.appendChild(ta);
        k.appendChild(bd);
      });

      var blokEkle = el("button", "btn btn--kucuk btn--ikinci", "+ Blok ekle");
      blokEkle.addEventListener("click", function () {
        y.bloklar.push({ tip: "p", metin: "" });
        isaretle("blog"); cizAll();
      });
      k.appendChild(blokEkle);
      kap.appendChild(k);
    });
  }

  function cizHizmetler() {
    var kap = $("#hizmetlerListe");
    kap.textContent = "";
    var liste = veri.hizmetler;
    liste.forEach(function (h, i) {
      h.no = String(i + 1).padStart(2, "0");
      var k = el("div", "kart");
      k.appendChild(kartUst(h.baslik || "(adsız)", i, liste, "hizmetler"));

      var s1 = el("div", "satir satir--2");
      s1.appendChild(alan("Başlık", h.baslik, function (v) {
        h.baslik = v; h.id = slugla(v); isaretle("hizmetler");
      }));
      s1.appendChild(alan("Bağlantı eki", h.id, function (v) { h.id = slugla(v); isaretle("hizmetler"); },
        { aciklama: "hizmetler.html#" + (h.id || "") }));
      k.appendChild(s1);

      k.appendChild(alan("Kısa metin (anasayfa kartı)", h.kisa, function (v) {
        h.kisa = v; isaretle("hizmetler");
      }, { cokSatir: true }));
      k.appendChild(alan("Uzun metin (hizmetler sayfası)", h.metin, function (v) {
        h.metin = v; isaretle("hizmetler");
      }, { cokSatir: true }));
      k.appendChild(alan("Etiketler", (h.etiketler || []).join(", "), function (v) {
        h.etiketler = v.split(",").map(function (x) { return x.trim(); })
          .filter(function (x) { return x; });
        isaretle("hizmetler");
      }, { aciklama: "Virgülle ayırın." }));
      kap.appendChild(k);
    });
  }

  function cizSite() {
    var kap = $("#siteForm");
    kap.textContent = "";
    var s = veri.site;
    var i = s.iletisim, f = s.footer, so = s.sosyal;

    var k1 = el("div", "kart");
    k1.appendChild(el("strong", null, "İletişim"));
    var r1 = el("div", "satir satir--2");
    r1.appendChild(alan("E-posta", i.eposta, function (v) { i.eposta = v; isaretle("site"); }));
    r1.appendChild(alan("Telefon (görünen)", i.telefon, function (v) { i.telefon = v; isaretle("site"); }));
    k1.appendChild(r1);
    var r2 = el("div", "satir satir--2");
    r2.appendChild(alan("Telefon (bağlantı)", i.telefonHam, function (v) { i.telefonHam = v; isaretle("site"); },
      { aciklama: "Boşluksuz, +90 ile: +905464683221" }));
    r2.appendChild(alan("WhatsApp numarası", i.whatsappHam, function (v) { i.whatsappHam = v; isaretle("site"); },
      { aciklama: "Boşluksuz, + olmadan: 905464683221" }));
    k1.appendChild(r2);
    var r3 = el("div", "satir satir--2");
    r3.appendChild(alan("Adres · 1. satır", i.adresSatir1, function (v) { i.adresSatir1 = v; isaretle("site"); }));
    r3.appendChild(alan("Adres · 2. satır", i.adresSatir2, function (v) { i.adresSatir2 = v; isaretle("site"); }));
    k1.appendChild(r3);
    k1.appendChild(alan("Çalışma saatleri", i.calismaSaatleri, function (v) {
      i.calismaSaatleri = v; isaretle("site");
    }));
    kap.appendChild(k1);

    var k2 = el("div", "kart");
    k2.appendChild(el("strong", null, "Alt bilgi (footer)"));
    k2.appendChild(alan("Tanıtım metni", f.metin, function (v) { f.metin = v; isaretle("site"); },
      { cokSatir: true }));
    var r4 = el("div", "satir satir--2");
    r4.appendChild(alan("Telif satırı", f.telifSatiri, function (v) { f.telifSatiri = v; isaretle("site"); }));
    r4.appendChild(alan("Bölge satırı", f.bolgeSatiri, function (v) { f.bolgeSatiri = v; isaretle("site"); }));
    k2.appendChild(r4);
    kap.appendChild(k2);

    var k3 = el("div", "kart");
    k3.appendChild(el("strong", null, "Sosyal hesaplar"));
    var r5 = el("div", "satir satir--3");
    r5.appendChild(alan("Instagram", so.instagram, function (v) { so.instagram = v.trim(); isaretle("site"); }));
    r5.appendChild(alan("LinkedIn", so.linkedin, function (v) { so.linkedin = v.trim(); isaretle("site"); }));
    r5.appendChild(alan("YouTube", so.youtube, function (v) { so.youtube = v.trim(); isaretle("site"); }));
    k3.appendChild(r5);
    k3.appendChild(el("span", "ipucu",
      "Boş bıraktığınız hesabın simgesi başlıkta, mobil menüde ve alt bilgide görünmez."));
    kap.appendChild(k3);

    /* --- kurucu fotoğrafı --- */
    var k4 = el("div", "kart");
    k4.appendChild(el("strong", null, "Kurucu fotoğrafı"));
    var k4Bilgi = el("p", "ipucu");
    k4Bilgi.style.marginBottom = ".5rem";
    k4Bilgi.textContent =
      "Hakkımızda sayfasındaki Kurucu bölümünde görünür. Boş bırakılırsa yer tutucu görsel kullanılır.";
    k4.appendChild(k4Bilgi);

    var k4Alan = el("div", "alan");

    var k4On = el("div", "onizleme onizleme--kucuk");
    var k4Kaynak = String(s.kurucuFoto || "").trim();
    if (k4Kaynak) {
      var k4Img = el("img");
      k4Img.src = onizlemeAdresi(k4Kaynak, 600);
      k4Img.alt = "";
      k4Img.addEventListener("error", function () {
        k4On.textContent = "";
        var uy = el("span", "ipucu");
        uy.style.color = "var(--hata)";
        uy.textContent = "Görsel açılamadı — dosya “Bağlantıya sahip herkes” " +
                         "olarak paylaşılmamış olabilir.";
        k4On.appendChild(uy);
      });
      k4On.appendChild(k4Img);
    } else {
      k4On.appendChild(el("span", "ipucu", "Yer tutucu görsel kullanılıyor."));
    }
    k4Alan.appendChild(k4On);

    var k4Girdi = el("input");
    k4Girdi.type = "url";
    k4Girdi.value = s.kurucuFoto || "";
    k4Girdi.placeholder = "https://drive.google.com/file/d/.../view?usp=sharing";
    k4Girdi.addEventListener("input", function () {
      s.kurucuFoto = k4Girdi.value.trim(); isaretle("site");
    });
    k4Girdi.addEventListener("change", cizSite);
    k4Alan.appendChild(k4Girdi);
    k4Alan.appendChild(el("span", "ipucu",
      "Drive bağlantısı. Dosya “Bağlantıya sahip herkes” olarak paylaşılmış olmalı."));
    k4.appendChild(k4Alan);
    kap.appendChild(k4);

    /* --- anasayfadaki rakamlar --- */
    var ks = el("div", "kart");
    ks.appendChild(el("strong", null, "Anasayfadaki rakamlar"));
    var ksBilgi = el("p", "ipucu");
    ksBilgi.style.marginBottom = ".75rem";
    ksBilgi.textContent =
      "Süreç bölümünün altında görünür. Sayı, ziyaretçi o kısma geldiğinde " +
      "sıfırdan yazdığınız değere doğru sayar. Değere “+” gibi bir ek " +
      "yazabilirsiniz (örn. 35+); sayaç yalnızca rakamı sayar, eki sonuna ekler.";
    ks.appendChild(ksBilgi);

    if (!s.sayaclar) s.sayaclar = [];
    var sayaclar = s.sayaclar;

    if (!sayaclar.length) {
      ks.appendChild(el("div", "bos", "Henüz rakam eklenmedi."));
    }

    sayaclar.forEach(function (sy, i) {
      var satir = el("div", "gorsel-satir");

      var ust = el("div", "gorsel-satir__ust");
      ust.appendChild(el("span", "kart__no", String(i + 1).padStart(2, "0")));
      ust.appendChild(el("span", "bosluk"));

      function tasi(yon) {
        var j = i + yon;
        if (j < 0 || j >= sayaclar.length) return;
        var t = sayaclar[i]; sayaclar[i] = sayaclar[j]; sayaclar[j] = t;
        isaretle("site"); cizSite();
      }
      var yu = el("button", "btn btn--ikinci btn--kucuk", "↑");
      yu.addEventListener("click", function () { tasi(-1); });
      var as = el("button", "btn btn--ikinci btn--kucuk", "↓");
      as.addEventListener("click", function () { tasi(1); });
      var si = el("button", "btn btn--tehlike btn--kucuk", "Sil");
      si.addEventListener("click", function () {
        sayaclar.splice(i, 1); isaretle("site"); cizSite();
      });
      ust.appendChild(yu); ust.appendChild(as); ust.appendChild(si);
      satir.appendChild(ust);

      var ikili = el("div", "satir satir--2");
      ikili.appendChild(alan("Sayı", sy.deger, function (v) {
        sy.deger = v.trim(); isaretle("site");
      }, { ipucu: "13" }));
      ikili.appendChild(alan("Etiket", sy.etiket, function (v) {
        sy.etiket = v; isaretle("site");
      }, { ipucu: "Yıllık Deneyim" }));
      satir.appendChild(ikili);
      ks.appendChild(satir);
    });

    var ksEkle = el("button", "btn btn--ikinci btn--kucuk", "+ Rakam ekle");
    ksEkle.style.marginTop = ".5rem";
    ksEkle.addEventListener("click", function () {
      sayaclar.push({ deger: "", etiket: "" });
      isaretle("site"); cizSite();
    });
    ks.appendChild(ksEkle);
    kap.appendChild(ks);

    var k4 = el("div", "kart");
    k4.appendChild(el("strong", null, "İletişim formu"));
    var f = s.form || (s.form = { saglayici: "yok", erisimAnahtari: "", ozelAdres: "" });

    var secKap = el("div", "alan");
    secKap.appendChild(el("label", null, "Form nereye gönderilsin?"));
    var sec = el("select");
    [["yok", "E-posta uygulamasını açsın (mesaj birikmez)"],
     ["web3forms", "Web3Forms"],
     ["ozel", "Diğer servis (Formspree vb.)"]].forEach(function (o) {
      var op = el("option", null, o[1]);
      op.value = o[0];
      if ((f.saglayici || "yok") === o[0]) op.selected = true;
      sec.appendChild(op);
    });
    sec.addEventListener("change", function () {
      f.saglayici = sec.value; isaretle("site"); cizAll();
    });
    secKap.appendChild(sec);
    k4.appendChild(secKap);

    if (f.saglayici === "web3forms") {
      k4.appendChild(alan("Web3Forms erişim anahtarı", f.erisimAnahtari, function (v) {
        f.erisimAnahtari = v.trim(); isaretle("site");
      }, { aciklama: "web3forms.com panelinizdeki Access Key — 8-4-4-4-12 biçiminde bir kod. " +
                     "Bu anahtar sayfa kaynağında görünür; tasarımı gereği böyledir, " +
                     "yalnızca kayıtlı e-posta adresinize mesaj göndermeye yarar." }));
      if (f.erisimAnahtari && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.erisimAnahtari)) {
        var uy = el("div", "bildirim bildirim--uyari");
        uy.style.marginTop = ".5rem";
        uy.textContent = "Anahtar beklenen biçimde görünmüyor. Web3Forms panelinden kopyaladığınızdan emin olun.";
        k4.appendChild(uy);
      }
    } else if (f.saglayici === "ozel") {
      k4.appendChild(alan("Form adresi", f.ozelAdres, function (v) {
        f.ozelAdres = v.trim(); isaretle("site");
      }, { aciklama: "Örn. https://formspree.io/f/xxxxxxx" }));
    }
    kap.appendChild(k4);
  }

  /* ---------------------------------------------------------------- logo

     Yüklenen dosyalar kaydedilene kadar bellekte bekler; "Kaydet ve yayınla"
     önce görselleri depoya yazar, sonra site.json'u günceller.
     -------------------------------------------------------------------- */
  var LOGO_TURLER = {
    "image/svg+xml": "svg",
    "image/png": "png",
    "image/webp": "webp",
    "image/jpeg": "jpg"
  };
  var LOGO_AZAMI = 512 * 1024;
  var bekleyenLogo = {}; // { acik: {uzanti, b64, oran, adres}, koyu: {...} }

  function boyutYaz(bayt) {
    return bayt < 1024 ? bayt + " B" : (bayt / 1024).toFixed(1) + " KB";
  }

  function logoAyar() {
    var s = veri.site;
    if (!s.logo) {
      s.logo = { tur: "yazi", acik: "", koyu: "", acikOran: 0, koyuOran: 0,
                 yukseklikBaslik: 30, yukseklikAlt: 84 };
    }
    return s.logo;
  }

  /* Dosyanın en/boy oranını bulur. SVG'de tarayıcı içsel ölçü vermeyebildiği
     için önce viewBox / width-height nitelikleri okunur. */
  function gorselOrani(dosya, veriAdres) {
    if (dosya.type === "image/svg+xml") {
      return dosya.text().then(function (metin) {
        var vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(metin);
        if (vb) return parseFloat(vb[1]) / parseFloat(vb[2]);
        var g = /\swidth\s*=\s*["']([\d.]+)/i.exec(metin);
        var y = /\sheight\s*=\s*["']([\d.]+)/i.exec(metin);
        if (g && y) return parseFloat(g[1]) / parseFloat(y[1]);
        return 0;
      }).catch(function () { return 0; });
    }
    return new Promise(function (coz) {
      var im = new Image();
      im.onload = function () { coz(im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0); };
      im.onerror = function () { coz(0); };
      im.src = veriAdres;
    });
  }

  function logoOku(dosya, hangi, bittiginde) {
    if (!LOGO_TURLER[dosya.type]) {
      bildir("Desteklenmeyen dosya türü. SVG, PNG, WEBP veya JPG yükleyin.", "hata");
      return;
    }
    if (dosya.size > LOGO_AZAMI) {
      bildir("Dosya çok büyük (" + Math.round(dosya.size / 1024) + " KB). " +
             "En fazla 512 KB olmalı — SVG kullanmanız önerilir.", "hata");
      return;
    }
    var oku = new FileReader();
    oku.onload = function () {
      var adres = String(oku.result);
      var b64 = adres.slice(adres.indexOf(",") + 1);
      gorselOrani(dosya, adres).then(function (oran) {
        bekleyenLogo[hangi] = {
          uzanti: LOGO_TURLER[dosya.type],
          b64: b64,
          oran: Math.round((oran || 0) * 1000) / 1000,
          adres: adres,
          ad: dosya.name,
          boyut: dosya.size
        };
        isaretle("site");
        bittiginde();
      });
    };
    oku.onerror = function () { bildir("Dosya okunamadı.", "hata"); };
    oku.readAsDataURL(dosya);
  }

  function logoYukleyici(baslik, hangi, aciklama, koyuZemin) {
    var g = logoAyar();
    var d = el("div", "alan");
    d.appendChild(el("label", null, baslik));

    var girdi = el("input");
    girdi.type = "file";
    girdi.accept = ".svg,.png,.webp,.jpg,.jpeg";
    girdi.addEventListener("change", function () {
      if (girdi.files && girdi.files[0]) logoOku(girdi.files[0], hangi, cizLogo);
    });
    d.appendChild(girdi);
    if (aciklama) d.appendChild(el("span", "ipucu", aciklama));

    var bekleyen = bekleyenLogo[hangi];
    var kayitli = g[hangi];
    if (bekleyen || kayitli) {
      var on = el("div", "onizleme" + (koyuZemin ? " onizleme--koyu" : ""));
      var im = el("img");
      im.src = bekleyen ? bekleyen.adres : "../" + kayitli;
      im.alt = "";
      im.style.height = "48px";
      im.style.width = "auto";
      on.appendChild(im);
      d.appendChild(on);

      var bilgi = el("span", "ipucu");
      bilgi.textContent = bekleyen
        ? "Yüklendi: " + bekleyen.ad + " · " + boyutYaz(bekleyen.boyut) +
          " · kaydedilmeyi bekliyor"
        : "Yayındaki dosya: " + kayitli;
      d.appendChild(bilgi);

      var sil = el("button", "btn btn--tehlike btn--kucuk", "Kaldır");
      sil.style.marginTop = ".5rem";
      sil.style.justifySelf = "start";
      sil.addEventListener("click", function () {
        delete bekleyenLogo[hangi];
        g[hangi] = "";
        g[hangi + "Oran"] = 0;
        isaretle("site");
        cizLogo();
      });
      d.appendChild(sil);
    }
    return d;
  }

  function cizLogo() {
    var kap = $("#logoForm");
    kap.textContent = "";
    var g = logoAyar();

    /* --- tür seçimi --- */
    var k1 = el("div", "kart");
    k1.appendChild(el("strong", null, "Logo türü"));
    var secKap = el("div", "alan");
    secKap.appendChild(el("label", null, "Sitede ne kullanılsın?"));
    var sec = el("select");
    [["yazi", "Yazı ile kurulan kilit (mevcut)"],
     ["tekGorsel", "Tek dosya — koyu zeminde otomatik ters çevrilsin"],
     ["ikiGorsel", "İki dosya — açık ve koyu sürüm ayrı"]].forEach(function (o) {
      var op = el("option", null, o[1]);
      op.value = o[0];
      if ((g.tur || "yazi") === o[0]) op.selected = true;
      sec.appendChild(op);
    });
    sec.addEventListener("change", function () {
      g.tur = sec.value; isaretle("site"); cizLogo();
    });
    secKap.appendChild(sec);
    k1.appendChild(secKap);
    kap.appendChild(k1);

    if ((g.tur || "yazi") === "yazi") {
      var bilgi = el("div", "bildirim");
      bilgi.innerHTML =
        "Şu an logo, sitenin kendi yazı tipiyle kuruluyor: dolu kare + " +
        "<strong>FATMA KOCAOVA</strong> + <em>mimarlık / architecture</em>. " +
        "Her ölçekte keskin görünür ve zemine göre rengi kendiliğinden değişir. " +
        "Kurumsal logonun asıl dosyasını kullanmak isterseniz yukarıdan " +
        "“Tek dosya” veya “İki dosya” seçin.";
      kap.appendChild(bilgi);
      return;
    }

    /* --- dosyalar --- */
    var k2 = el("div", "kart");
    k2.appendChild(el("strong", null, "Dosyalar"));

    var uyari = el("div", "bildirim bildirim--uyari");
    uyari.innerHTML =
      "<strong>SVG önerilir</strong> — her ekranda keskin çıkar ve dosyası " +
      "küçüktür. PNG/WEBP yüklerseniz görünecek yüksekliğin en az iki katı " +
      "çözünürlükte olsun. En fazla 512 KB.";
    k2.appendChild(uyari);

    if (g.tur === "tekGorsel") {
      k2.appendChild(logoYukleyici(
        "Logo dosyası", "acik",
        "Koyu renkli (siyah) sürümü yükleyin. Koyu zeminlerde otomatik ters " +
        "çevrilir. Bu yöntem yalnızca tek renk logolarda doğru sonuç verir; " +
        "logonuz çok renkliyse “İki dosya” seçeneğini kullanın.",
        false));
    } else {
      k2.appendChild(logoYukleyici(
        "Açık zeminde kullanılacak logo", "koyu",
        "Koyu renkli (siyah) sürüm — beyaz zeminli sayfalarda görünür.",
        false));
      k2.appendChild(logoYukleyici(
        "Koyu zeminde kullanılacak logo", "acik",
        "Açık renkli (beyaz) sürüm — anasayfa kahramanında ve alt bilgide görünür.",
        true));
    }
    kap.appendChild(k2);

    /* --- ölçüler --- */
    var k3 = el("div", "kart");
    k3.appendChild(el("strong", null, "Görünecek yükseklik"));
    var r = el("div", "satir satir--2");
    r.appendChild(alan("Başlık çubuğunda (px)", g.yukseklikBaslik, function (v) {
      g.yukseklikBaslik = parseInt(v, 10) || 30; isaretle("site");
    }, { tip: "number", aciklama: "Önerilen: 24–40. Başlık çubuğu 74 px yüksekliğinde." }));
    r.appendChild(alan("Alt bilgide (px)", g.yukseklikAlt, function (v) {
      g.yukseklikAlt = parseInt(v, 10) || 84; isaretle("site");
    }, { tip: "number", aciklama: "Önerilen: 60–120." }));
    k3.appendChild(r);
    kap.appendChild(k3);

    var eksik = (g.tur === "tekGorsel")
      ? !(bekleyenLogo.acik || g.acik)
      : !((bekleyenLogo.acik || g.acik) || (bekleyenLogo.koyu || g.koyu));
    if (eksik) {
      var e = el("div", "bildirim bildirim--uyari");
      e.textContent = "Henüz dosya yüklenmedi. Kaydetseniz bile site, dosya " +
                      "gelene kadar yazıyla kurulan kilidi kullanmaya devam eder.";
      kap.appendChild(e);
    }
  }

  function logoKaydet(dugme) {
    var g = logoAyar();
    dugme.disabled = true;
    var eskiMetin = dugme.textContent;

    var yuklemeler = Object.keys(bekleyenLogo).map(function (hangi) {
      var d = bekleyenLogo[hangi];
      var yol = "assets/img/logo-" + hangi + "." + d.uzanti;
      return function () {
        dugme.textContent = "Görsel yükleniyor…";
        return ikiliYaz(yol, d.b64, "Yönetim paneli: logo görseli güncellendi")
          .then(function () {
            g[hangi] = yol;
            g[hangi + "Oran"] = d.oran;
            delete bekleyenLogo[hangi];
          });
      };
    });

    var zincir = Promise.resolve();
    yuklemeler.forEach(function (adim) { zincir = zincir.then(adim); });

    zincir
      .then(function () {
        dugme.textContent = "Kaydediliyor…";
        return dosyaYaz("site", veri.site, "Yönetim paneli: logo güncellendi");
      })
      .then(function () {
        kirli.site = false;
        dugme.textContent = "Kaydet ve yayınla";
        cizLogo();
        bildir("Logo kaydedildi. Site birkaç dakika içinde güncellenecek — " +
               "yayın durumunu GitHub → Actions sekmesinden izleyebilirsiniz.", "ok");
      })
      .catch(function (e) {
        dugme.textContent = eskiMetin;
        bildir("Kaydedilemedi: " + e.message, "hata");
      })
      .then(function () { dugme.disabled = false; });
  }

  function cizMesajlar() {
    var kap = $("#mesajlarIcerik");
    kap.textContent = "";
    var f = veri.site.form || {};
    var saglayici = f.saglayici || "yok";
    var bagli = (saglayici === "web3forms" && f.erisimAnahtari) ||
                (saglayici === "ozel" && f.ozelAdres);

    var b = el("div", "bildirim " + (bagli ? "bildirim--ok" : "bildirim--uyari"));
    b.innerHTML = bagli
      ? "<strong>Form bağlı.</strong> Gelen mesajlar e-posta adresinize düşer ve " +
        "servisin kendi panelinde listelenir. Site statik olduğu için mesajlar " +
        "bu panelin içinde saklanamaz — gelen kutusu servistedir."
      : "<strong>Form henüz bağlı değil.</strong> Şu an ziyaretçinin e-posta " +
        "uygulaması açılıyor; mesajlar hiçbir yerde birikmiyor.";
    kap.appendChild(b);

    var k = el("div", "kart");
    k.appendChild(el("strong", null, "Şu anki ayar"));
    var d = el("p");
    d.style.color = "var(--muted)";
    if (saglayici === "web3forms") {
      d.innerHTML = f.erisimAnahtari
        ? "Sağlayıcı: <strong>Web3Forms</strong><br>Anahtar: <code>" +
          String(f.erisimAnahtari).replace(/</g, "&lt;") + "</code><br><br>" +
          'Mesajlar için <a href="https://web3forms.com/" target="_blank" rel="noopener">' +
          "web3forms.com</a> panelinize girin veya e-postanıza bakın."
        : "Sağlayıcı Web3Forms seçili ama <strong>erişim anahtarı boş</strong>. " +
          "Anahtar girilene kadar form e-posta uygulamasını açmaya devam eder. " +
          "“Site &amp; Footer” sekmesinden anahtarı ekleyin.";
    } else if (saglayici === "ozel") {
      d.innerHTML = f.ozelAdres
        ? "Form şu adrese gönderiliyor:<br><code>" +
          String(f.ozelAdres).replace(/</g, "&lt;") + "</code>"
        : "“Diğer servis” seçili ama adres boş.";
    } else {
      d.innerHTML = "Form <strong>e-posta uygulamasını açıyor</strong> (mailto). " +
        "Ziyaretçinin kendi e-posta programı açılıyor, göndermesi ona kalıyor.";
    }
    k.appendChild(d);
    kap.appendChild(k);

    var k2 = el("div", "kart");
    k2.appendChild(el("strong", null, "Web3Forms nasıl bağlanır?"));
    var ol = el("ol");
    ol.style.color = "var(--muted)";
    ol.style.paddingLeft = "1.2rem";
    [
      "web3forms.com adresinde e-postanızla ücretsiz kayıt olun (aylık 250 mesaj).",
      "Size verilen Access Key kodunu kopyalayın.",
      "“Site & Footer” sekmesinde sağlayıcıyı Web3Forms seçip anahtarı yapıştırın.",
      "Kaydedin — birkaç dakika sonra form canlıda çalışmaya başlar.",
      "Kendi sitenizden bir deneme mesajı gönderip e-postanıza düştüğünü doğrulayın."
    ].forEach(function (m) { ol.appendChild(el("li", null, m)); });
    k2.appendChild(ol);
    kap.appendChild(k2);
  }

  function cizAll() {
    cizProjeler(); cizHaberler(); cizBlog();
    cizHizmetler(); cizLogo(); cizSite(); cizMesajlar();
  }

  /* ------------------------------------------------------------ ekleme */
  var YENI = {
    projeler: function () {
      return { yil: String(new Date().getFullYear()), tur: "Restorasyon",
               turSlug: "restorasyon", baslik: "Yeni proje", yer: "", "not": "", oneCikan: false };
    },
    haberler: function () {
      return { yil: String(new Date().getFullYear()), tur: "Bildiri",
               baslik: "Yeni haber", yer: "", ozet: "", banner: "", link: "" };
    },
    blog: function () {
      return { slug: "yeni-yazi", baslik: "Yeni yazı", ay: "", yil: String(new Date().getFullYear()),
               kategori: "Malzeme", sure: "", ozet: "", pdf: "", yayinda: false,
               bloklar: [{ tip: "p", metin: "" }] };
    },
    hizmetler: function () {
      return { no: "00", id: "yeni-hizmet", baslik: "Yeni hizmet", kisa: "", metin: "",
               ikon: '<path d="M10 42V10h28v32"/><path d="M6 42h36"/>', etiketler: [] };
    }
  };

  /* ------------------------------------------------------------ kaydetme */
  function kaydet(dosya, dugme) {
    dugme.disabled = true;
    var eskiMetin = dugme.textContent;
    dugme.textContent = "Kaydediliyor…";
    dosyaYaz(dosya, veri[dosya], "Yönetim paneli: " + dosya + " güncellendi")
      .then(function () {
        kirli[dosya] = false;
        dugme.textContent = "Kaydet ve yayınla";
        bildir("Kaydedildi. Site birkaç dakika içinde güncellenecek — " +
               "yayın durumunu GitHub → Actions sekmesinden izleyebilirsiniz.", "ok");
      })
      .catch(function (e) {
        dugme.textContent = eskiMetin;
        bildir("Kaydedilemedi: " + e.message, "hata");
      })
      .then(function () { dugme.disabled = false; });
  }

  /* ------------------------------------------------------------- olaylar */
  function olaylariBagla() {
    $("#girisBtn").addEventListener("click", girisDene);
    $("#kurulumBtn").addEventListener("click", kurulumDene);
    $("#sifirlaBtn").addEventListener("click", kilidiSifirla);
    $("#cikis").addEventListener("click", cikis);

    [$("#kullaniciGiris"), $("#sifreGiris")].forEach(function (g) {
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter") girisDene();
      });
    });
    [$("#sifreKur"), $("#tokenGiris")].forEach(function (g) {
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter") kurulumDene();
      });
    });

    document.querySelectorAll(".sekme").forEach(function (s) {
      s.addEventListener("click", function () {
        document.querySelectorAll(".sekme").forEach(function (o) {
          o.setAttribute("aria-selected", String(o === s));
        });
        document.querySelectorAll(".panel").forEach(function (p) {
          p.hidden = p.id !== "panel-" + s.dataset.sekme;
        });
      });
    });

    document.addEventListener("click", function (e) {
      var ekle = e.target.closest("[data-ekle]");
      if (ekle) {
        var d = ekle.dataset.ekle;
        /* Projeler listenin sonuna eklenir; haber ve yazılarda yeni kayıt
           en yeni olduğu için başa eklenmeye devam eder. */
        var sona = d === "projeler";
        if (sona) veri[d].push(YENI[d]());
        else veri[d].unshift(YENI[d]());
        isaretle(d); cizAll();

        /* Uzun listede sona eklenen kart ekranın dışında kalır; kullanıcı
           bir şey olmadığını sanmasın diye kart görünür alana getirilip
           başlık alanına odaklanılır. */
        var kartlar = document.querySelectorAll("#" + d + "Liste .kart");
        var yeni = kartlar[sona ? kartlar.length - 1 : 0];
        if (yeni) {
          yeni.scrollIntoView({ block: "center", behavior: "smooth" });
          var ilkAlan = yeni.querySelector("input, textarea");
          if (ilkAlan) ilkAlan.focus({ preventScroll: true });
        }
        return;
      }
      var kay = e.target.closest("[data-kaydet]");
      if (kay) {
        /* Logo ayarları site.json içinde durur ve önce görselleri yazmak
           gerekir; bu yüzden kendi kaydetme akışı vardır. */
        if (kay.dataset.kaydet === "logo") logoKaydet(kay);
        else kaydet(kay.dataset.kaydet, kay);
      }
    });

    window.addEventListener("beforeunload", function (e) {
      if (Object.keys(kirli).some(function (k) { return kirli[k]; })) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  /* --------------------------------------------------------------- açılış */
  function ekranSec() {
    var kasa = kasaOku();
    if (kasa) {
      $("#giris").hidden = false;
      $("#kullaniciGiris").value = kasa.kullanici || "";
      $(kasa.kullanici ? "#sifreGiris" : "#kullaniciGiris").focus();
      return;
    }
    /* Eski sürümde anahtar düz metin olarak saklanıyordu; kurulum
       ekranını onunla dolduruyoruz ki kullanıcı yeniden yazmasın. */
    var eski = {};
    try { eski = JSON.parse(localStorage.getItem(ESKI) || "{}"); } catch (e) { /* yoksay */ }
    if (eski.token) {
      $("#tokenGiris").value = eski.token;
      if (eski.sahip) $("#repoSahibi").value = eski.sahip;
      if (eski.repo) $("#repoAd").value = eski.repo;
      if (eski.dal) $("#repoDal").value = eski.dal;
    }
    $("#kurulum").hidden = false;
  }

  olaylariBagla();

  if (!kripto()) {
    $("#kurulum").hidden = false;
    hataGoster("#kurulumHata",
      "Bu tarayıcı şifreleme desteği sunmuyor ya da sayfa güvenli olmayan " +
      "bir bağlantı üzerinden açıldı. Paneli https:// adresinden açın.");
  } else {
    var oturum = oturumYukle();
    if (oturum && oturum.token) {
      /* Aynı sekmede sayfa yenilendiğinde tekrar şifre sorulmaz. */
      ayar = oturum;
      durumYaz("Bağlanılıyor…");
      baslat().catch(function (e) {
        durumYaz("");
        sessionStorage.removeItem(OTURUM);
        ekranSec();
        hataGoster($("#giris").hidden ? "#kurulumHata" : "#girisHata", e.message);
      });
    } else {
      ekranSec();
    }
  }
})();
