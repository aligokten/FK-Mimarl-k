/* ==========================================================================
   Fatma Kocaova Mimarlık — arayüz etkileşimleri
   Bağımlılık yok, tüm modüller opsiyonel: ilgili DOM yoksa sessizce atlanır.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Dinamik import()'un bu dosyaya göre çözülmesi için betiğin kendi adresi
  var BETIK_URL =
    (document.currentScript && document.currentScript.src) || window.location.href;

  /* ---------------------------------------------------------------------
     Başlık: kaydırınca arka plan, aşağı kaydırınca gizlenme
     --------------------------------------------------------------------- */
  function initHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;

    var lastY = window.scrollY;
    var ticking = false;

    function update() {
      var y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 40);

      var menuOpen = document.body.classList.contains("is-locked");
      if (!menuOpen && y > 320 && y > lastY) {
        header.classList.add("is-hidden");
      } else {
        header.classList.remove("is-hidden");
      }

      lastY = y;
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );

    update();
  }

  /* ---------------------------------------------------------------------
     Mobil menü
     --------------------------------------------------------------------- */
  function initMobileNav() {
    var toggle = document.querySelector(".menu-toggle");
    var nav = document.querySelector(".mobile-nav");
    if (!toggle || !nav) return;

    var links = nav.querySelectorAll(".mobile-nav__link");

    function setState(open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
      nav.classList.toggle("is-open", open);
      nav.setAttribute("aria-hidden", String(!open));
      document.body.classList.toggle("is-locked", open);

      links.forEach(function (link, i) {
        link.style.transitionDelay = open ? 90 + i * 55 + "ms" : "0ms";
      });
    }

    toggle.addEventListener("click", function () {
      setState(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setState(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setState(false);
        toggle.focus();
      }
    });

    // Masaüstüne geçildiğinde menüyü kapat
    window.matchMedia("(min-width: 1140px)").addEventListener("change", function (e) {
      if (e.matches) setState(false);
    });

    setState(false);
  }

  /* ---------------------------------------------------------------------
     Kaydırma ile beliren öğeler
     --------------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      /* threshold 0 olmalı: kesişim oranı ögenin KENDİ yüksekliğine göre
         hesaplanır, görüntü alanına göre değil. Ekrandan uzun bir öge
         (uzun bir blog yazısının gövdesi 13.000 px'e çıkabiliyor) oranı
         hiçbir zaman 0.12'ye ulaştıramaz; gözlemci tetiklenmez ve öge
         opacity: 0'da kalıp görünmez olur. Ne zaman belireceğini
         rootMargin'deki -%8 belirliyor, eşik değil. */
      { rootMargin: "0px 0px -8% 0px", threshold: 0 }
    );

    items.forEach(function (el, i) {
      // Aynı kap içindeki kardeşlere kademeli gecikme
      if (!el.style.getPropertyValue("--reveal-delay")) {
        var group = el.getAttribute("data-reveal");
        if (group === "stagger") {
          el.style.setProperty("--reveal-delay", (i % 4) * 90 + "ms");
        }
      }
      observer.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     Sayaçlar
     --------------------------------------------------------------------- */
  function initCounters() {
    var counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      var duration = reduceMotion ? 0 : 1500;
      var start = null;

      function step(ts) {
        if (start === null) start = ts;
        var p = duration === 0 ? 1 : Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString("tr-TR") + suffix;
        if (p < 1) window.requestAnimationFrame(step);
      }

      window.requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) {
      counters.forEach(run);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          run(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     Uzmanlık çubukları
     --------------------------------------------------------------------- */
  function initSkills() {
    var bars = document.querySelectorAll(".skill__fill");
    if (!bars.length) return;

    function fill(el) {
      el.style.width = (el.getAttribute("data-value") || "0") + "%";
    }

    if (!("IntersectionObserver" in window)) {
      bars.forEach(fill);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          fill(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.4 }
    );

    bars.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     Proje filtresi
     --------------------------------------------------------------------- */
  function initFilters() {
    var buttons = document.querySelectorAll(".filter-btn");
    var cards = document.querySelectorAll("[data-category]");
    if (!buttons.length || !cards.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.getAttribute("data-filter");

        buttons.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", String(active));
        });

        cards.forEach(function (card) {
          var match =
            filter === "all" || card.getAttribute("data-category") === filter;
          card.classList.toggle("is-filtered-out", !match);
        });
      });
    });
  }

  /* ---------------------------------------------------------------------
     Akordeon (SSS)
     --------------------------------------------------------------------- */
  function initAccordion() {
    var triggers = document.querySelectorAll(".accordion__trigger");
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      var panel = document.getElementById(trigger.getAttribute("aria-controls"));
      if (!panel) return;

      trigger.addEventListener("click", function () {
        var open = trigger.getAttribute("aria-expanded") === "true";
        var accordion = trigger.closest(".accordion");

        // Tek seferde tek panel açık kalsın
        if (accordion) {
          accordion.querySelectorAll(".accordion__trigger").forEach(function (t) {
            if (t === trigger) return;
            t.setAttribute("aria-expanded", "false");
            var p = document.getElementById(t.getAttribute("aria-controls"));
            if (p) p.setAttribute("data-open", "false");
          });
        }

        trigger.setAttribute("aria-expanded", String(!open));
        panel.setAttribute("data-open", String(!open));
      });
    });
  }

  /* ---------------------------------------------------------------------
     Yukarı çık butonu
     --------------------------------------------------------------------- */
  function initToTop() {
    var btn = document.querySelector(".to-top");
    if (!btn) return;

    window.addEventListener(
      "scroll",
      function () {
        btn.classList.toggle("is-visible", window.scrollY > 600);
      },
      { passive: true }
    );

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---------------------------------------------------------------------
     İletişim formu

     data-saglayici:
       "yok"       → e-posta uygulamasını açar (mailto)
       "web3forms" → api.web3forms.com'a AJAX gönderim, satır içi geri bildirim
       "ozel"      → formun kendi action'ına klasik gönderim (Formspree vb.)
     --------------------------------------------------------------------- */
  function initForm() {
    var form = document.querySelector("[data-contact-form]");
    if (!form) return;

    var durum = form.querySelector(".form__status");
    var gonder = form.querySelector('button[type="submit"]');
    var saglayici = form.getAttribute("data-saglayici") || "yok";

    function bildir(metin, hataMi) {
      if (!durum) return;
      durum.textContent = metin;
      durum.setAttribute("data-hata", hataMi ? "true" : "false");
    }

    function kilitle(kilitli, metin) {
      if (!gonder) return;
      gonder.disabled = kilitli;
      if (metin) gonder.dataset.eski = gonder.dataset.eski || gonder.textContent.trim();
      if (kilitli && metin) gonder.childNodes[0].nodeValue = metin;
      else if (!kilitli && gonder.dataset.eski) gonder.childNodes[0].nodeValue = gonder.dataset.eski;
    }

    form.addEventListener("submit", function (e) {
      // Tuzak alan doluysa gönderim bot kaynaklıdır; sessizce yut.
      var tuzak = form.querySelector('[name="botcheck"]');
      if (tuzak && tuzak.checked) {
        e.preventDefault();
        return;
      }

      /* Yalnızca gerçek bir action varsa tarayıcının kendi gönderimine izin
         verilir. Aksi hâlde form statik barındırmaya POST eder ve sunucu
         "405 Method Not Allowed" döndürür. */
      if (saglayici === "ozel" && form.getAttribute("action")) return;

      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var d = new FormData(form);

      if (saglayici === "web3forms") {
        kilitle(true, "Gönderiliyor…");
        bildir("");

        var govde = {
          access_key: form.getAttribute("data-anahtar"),
          subject: d.get("subject") || "Web sitesi iletişim formu",
          from_name: d.get("from_name") || "Web sitesi",
          name: d.get("ad") || "",
          email: d.get("eposta") || "",
          phone: d.get("telefon") || "",
          konu: d.get("konu") || "",
          message: d.get("mesaj") || ""
        };

        fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(govde)
        })
          .then(function (y) { return y.json().catch(function () { return {}; }); })
          .then(function (j) {
            if (j && j.success) {
              form.reset();
              bildir("Mesajınız iletildi. En kısa sürede dönüş yapacağız.");
            } else {
              bildir("Mesaj gönderilemedi. Lütfen doğrudan " +
                (form.getAttribute("data-mailto") || "") + " adresine yazın.", true);
            }
          })
          .catch(function () {
            bildir("Bağlantı kurulamadı. Lütfen doğrudan " +
              (form.getAttribute("data-mailto") || "") + " adresine yazın.", true);
          })
          .then(function () { kilitle(false); });
        return;
      }

      // saglayici === "yok" → e-posta uygulaması
      var mail = form.getAttribute("data-mailto") || "";
      var konu = "Web sitesi iletişim formu — " + (d.get("konu") || "Genel");
      var metin = [
        "Ad Soyad: " + (d.get("ad") || ""),
        "E-posta: " + (d.get("eposta") || ""),
        "Telefon: " + (d.get("telefon") || ""),
        "Konu: " + (d.get("konu") || ""),
        "",
        "Mesaj:",
        d.get("mesaj") || ""
      ].join("\n");

      window.location.href = "mailto:" + mail +
        "?subject=" + encodeURIComponent(konu) +
        "&body=" + encodeURIComponent(metin);

      bildir("E-posta uygulamanız açılıyor. Açılmazsa doğrudan " + mail + " adresine yazabilirsiniz.");
    });
  }

  /* ---------------------------------------------------------------------
     Kahraman bölümü 3B sahnesi

     Sahne yalnızca WebGL destekleniyorsa ve kullanıcı hareket azaltma
     tercih etmediyse yüklenir. Aksi hâlde bölüm .is-static sınıfıyla
     tek ekranlık sabit görsele döner ve three.js hiç indirilmez.
     --------------------------------------------------------------------- */
  var EVRELER = [
    {
      esik: 0,
      metin:
        "Yapı yerinde ölçülür; mevcut durum, deformasyonlar ve kayıplar ölçülü çizime aktarılır.",
    },
    {
      esik: 0.4,
      metin:
        "Müdahale kararları detay, malzeme ve teknik şartnameyle birlikte projelendirilir.",
    },
    {
      esik: 0.74,
      metin:
        "Proje şantiyede uygulanır; yapı özgün karakteriyle yeniden ayağa kalkar.",
    },
  ];

  function initHero() {
    var bolum = document.querySelector("[data-hero3d]");
    if (!bolum) return;

    var canvas = bolum.querySelector(".hero__canvas");
    var cubuk = bolum.querySelector("[data-hero-progress]");
    var acikla = bolum.querySelector("[data-hero-caption]");
    var evreler = bolum.querySelectorAll(".hero__phase-list li");

    /* Bölüm ekrandayken sabit WhatsApp/yukarı-çık butonlarını gizle:
       evre göstergesinin üzerine binmesinler. 3B yüklenmese de çalışır. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (girdiler) {
          girdiler.forEach(function (g) {
            document.body.classList.toggle("hero-gorunur", g.isIntersecting);
          });
        },
        { threshold: 0 }
      ).observe(bolum);
    }

    if (reduceMotion || !canvas || !canvas.getContext) {
      bolum.classList.add("is-static");
      return;
    }

    var sahne = null;
    var sonEvre = -1;

    /** Kaydırma konumunu 0–1 ilerlemeye çevirir. */
    function ilerlemeHesapla() {
      var r = bolum.getBoundingClientRect();
      var pist = r.height - window.innerHeight;
      if (pist <= 0) return 0;
      return Math.min(Math.max(-r.top / pist, 0), 1);
    }

    function arayuzGuncelle(t) {
      if (cubuk) cubuk.style.width = t * 100 + "%";

      var indeks = 0;
      for (var i = 0; i < EVRELER.length; i++) {
        if (t >= EVRELER[i].esik) indeks = i;
      }
      if (indeks === sonEvre) return;
      sonEvre = indeks;

      evreler.forEach(function (li, i) {
        if (i === indeks) li.setAttribute("data-active", "true");
        else li.removeAttribute("data-active");
      });

      if (acikla) {
        acikla.setAttribute("data-fading", "true");
        window.setTimeout(function () {
          acikla.textContent = EVRELER[indeks].metin;
          acikla.removeAttribute("data-fading");
        }, 300);
      }
    }

    var bekleyen = false;
    function kaydirma() {
      if (bekleyen) return;
      bekleyen = true;
      window.requestAnimationFrame(function () {
        var t = ilerlemeHesapla();
        if (sahne) sahne.setProgress(t);
        arayuzGuncelle(t);
        bekleyen = false;
      });
    }

    // Eskiz motoru yalnızca ihtiyaç anında indirilir
    import(new URL("heroSketch.js", BETIK_URL).href)
      .then(function (mod) {
        sahne = mod.initHeroSketch(canvas);
        sahne.setProgress(ilerlemeHesapla());

        window.addEventListener("scroll", kaydirma, { passive: true });
        window.addEventListener("resize", function () {
          sahne.resize();
          kaydirma();
        });

        kaydirma();
      })
      .catch(function () {
        // Modül yüklenemezse sessizce sabit görsele düş
        bolum.classList.add("is-static");
      });
  }

  /* ---------------------------------------------------------------------
     Seçili işler şeridi

     Kaydırmayı tarayıcı yapar (overflow-x + scroll-snap). Buradaki iş
     yalnızca okları bir kart boyu kaydırmak ve şeridin ucuna gelindiğinde
     ilgili oku söndürmek. Böylece dokunmatik, tekerlek ve klavye
     kaydırması olduğu gibi çalışmaya devam eder.
     --------------------------------------------------------------------- */
  function initSerit() {
    var serit = document.querySelector("[data-serit]");
    if (!serit) return;
    var oklar = document.querySelectorAll("[data-serit-yon]");
    if (!oklar.length) return;

    function adim() {
      var oge = serit.querySelector(".serit__oge");
      if (!oge) return serit.clientWidth * 0.8;
      var bosluk = parseFloat(getComputedStyle(serit.querySelector(".serit__ray")).columnGap) || 0;
      return oge.getBoundingClientRect().width + bosluk;
    }

    function tazele() {
      var sol = serit.scrollLeft;
      var kalan = serit.scrollWidth - serit.clientWidth - sol;
      oklar.forEach(function (o) {
        var yon = Number(o.getAttribute("data-serit-yon"));
        o.disabled = yon < 0 ? sol <= 2 : kalan <= 2;
      });
    }

    oklar.forEach(function (o) {
      o.addEventListener("click", function () {
        serit.scrollBy({
          left: adim() * Number(o.getAttribute("data-serit-yon")),
          behavior: "smooth"
        });
      });
    });

    serit.addEventListener("scroll", tazele, { passive: true });
    window.addEventListener("resize", tazele);
    /* Görseller yüklendikçe kart genişlikleri değişir; ok durumu da onunla
       birlikte yenilenmeli. */
    window.addEventListener("load", tazele);
    if (window.ResizeObserver) new ResizeObserver(tazele).observe(serit);
    tazele();
  }

  /* ---------------------------------------------------------------------
     Proje modalı

     İçerik sayfadaki JSON bloğundan okunur. Açıkken sayfa kaydırması
     kilitlenir, odak kutunun içine hapsedilir ve kapanınca çağıran
     düğmeye geri döner.
     --------------------------------------------------------------------- */
  function initProjeModal() {
    var modal = document.getElementById("proje-modal");
    var kaynak = document.getElementById("proje-verisi");
    if (!modal || !kaynak) return;

    var projeler;
    try {
      projeler = JSON.parse(kaynak.textContent);
    } catch (e) {
      return; // veri bozuksa kartlar sessizce liste gibi davranır
    }
    if (!projeler || !projeler.length) return;

    var kutu = modal.querySelector(".modal__kutu");
    var cagiran = null;

    function doldur(p) {
      modal.querySelector("[data-modal-baslik]").textContent = p.baslik || "";
      modal.querySelector("[data-modal-meta]").textContent =
        [p.yil, p.tur].filter(Boolean).join(" · ");
      modal.querySelector("[data-modal-yer]").textContent = p.yer || "";
      modal.querySelector("[data-modal-metin]").textContent = p.metin || "";

      var kap = modal.querySelector("[data-modal-gorseller]");
      kap.textContent = "";
      if (p.gorseller && p.gorseller.length) {
        p.gorseller.forEach(function (g, i) {
          if (g.video && g.videoAdres) {
            var sarici = document.createElement("div");
            sarici.className = "modal__video";
            var cerceve = document.createElement("iframe");
            cerceve.src = g.videoAdres;
            cerceve.loading = "lazy";
            cerceve.allow = "autoplay; encrypted-media; fullscreen";
            cerceve.allowFullscreen = true;
            cerceve.title = p.baslik
              ? p.baslik + " — video " + (i + 1)
              : "Video " + (i + 1);
            sarici.appendChild(cerceve);
            kap.appendChild(sarici);
            return;
          }
          var im = document.createElement("img");
          im.src = g.adres;
          if (g.seti) {
            im.srcset = g.seti;
            im.sizes = "(min-width: 900px) 62vw, 100vw";
          }
          im.alt = p.baslik ? p.baslik + " — görsel " + (i + 1) : "";
          im.loading = i === 0 ? "eager" : "lazy";
          im.decoding = "async";
          kap.appendChild(im);
        });
      } else {
        var bos = document.createElement("p");
        bos.className = "modal__yer-tutucu";
        bos.textContent = "Bu proje için henüz görsel eklenmedi.";
        kap.appendChild(bos);
      }
    }

    function odaklanabilirler() {
      return kutu.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    }

    function ac(sira, dugme) {
      var p = projeler[sira];
      if (!p) return;
      cagiran = dugme || null;
      doldur(p);
      modal.hidden = false;
      document.body.classList.add("is-locked");
      // Bir sonraki karede sınıf eklenir ki geçiş animasyonu çalışsın
      window.requestAnimationFrame(function () {
        modal.classList.add("is-acik");
        kutu.scrollTop = 0;
        var ilk = modal.querySelector(".modal__kapat");
        if (ilk) ilk.focus();
      });
    }

    function kapat() {
      if (modal.hidden) return;
      modal.classList.remove("is-acik");
      document.body.classList.remove("is-locked");
      var bitir = function () {
        modal.hidden = true;
        if (cagiran) { cagiran.focus(); cagiran = null; }
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) bitir();
      else window.setTimeout(bitir, 380);
    }

    document.addEventListener("click", function (e) {
      var kart = e.target.closest("[data-proje]");
      if (kart) {
        ac(Number(kart.getAttribute("data-proje")), kart);
        return;
      }
      if (e.target.closest("[data-modal-kapat]")) kapat();
    });

    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") { kapat(); return; }
      if (e.key !== "Tab") return;
      var ogeler = odaklanabilirler();
      if (!ogeler.length) return;
      var ilk = ogeler[0];
      var son = ogeler[ogeler.length - 1];
      if (e.shiftKey && document.activeElement === ilk) {
        e.preventDefault(); son.focus();
      } else if (!e.shiftKey && document.activeElement === son) {
        e.preventDefault(); ilk.focus();
      }
    });
  }

  /* ---------------------------------------------------------------------
     Belge (PDF) modalı — blog yazısındaki dergi dosyası
     --------------------------------------------------------------------- */
  function initPdfModal() {
    var modaller = document.querySelectorAll(".modal--pdf");
    if (!modaller.length) return;

    modaller.forEach(function (modal) {
      var kutu = modal.querySelector(".modal__kutu");
      var cerceve = modal.querySelector(".pdf-cerceve");
      var cagiran = null;

      function odaklanabilirler() {
        return kutu.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
      }

      function ac(dugme) {
        cagiran = dugme || null;
        // Kapalıyken yüklenmesin diye adres yalnızca ilk açılışta atanır.
        if (!cerceve.src && cerceve.dataset.pdfSrc) cerceve.src = cerceve.dataset.pdfSrc;
        modal.hidden = false;
        document.body.classList.add("is-locked");
        window.requestAnimationFrame(function () {
          modal.classList.add("is-acik");
          var ilk = modal.querySelector(".modal__kapat");
          if (ilk) ilk.focus();
        });
      }

      function kapat() {
        if (modal.hidden) return;
        modal.classList.remove("is-acik");
        document.body.classList.remove("is-locked");
        var bitir = function () {
          modal.hidden = true;
          if (cagiran) { cagiran.focus(); cagiran = null; }
        };
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) bitir();
        else window.setTimeout(bitir, 380);
      }

      document.addEventListener("click", function (e) {
        var dugme = e.target.closest('[data-pdf-ac="' + modal.id + '"]');
        if (dugme) { ac(dugme); return; }
        if (e.target.closest("[data-pdf-kapat]") && e.target.closest(".modal--pdf") === modal) kapat();
      });

      document.addEventListener("keydown", function (e) {
        if (modal.hidden) return;
        if (e.key === "Escape") { kapat(); return; }
        if (e.key !== "Tab") return;
        var ogeler = odaklanabilirler();
        if (!ogeler.length) return;
        var ilk = ogeler[0];
        var son = ogeler[ogeler.length - 1];
        if (e.shiftKey && document.activeElement === ilk) {
          e.preventDefault(); son.focus();
        } else if (!e.shiftKey && document.activeElement === son) {
          e.preventDefault(); ilk.focus();
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     Yıl bilgisi
     --------------------------------------------------------------------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* --------------------------------------------------------------------- */
  function init() {
    initHeader();
    initMobileNav();
    initReveal();
    initCounters();
    initSkills();
    initFilters();
    initAccordion();
    initToTop();
    initForm();
    initHero();
    initSerit();
    initProjeModal();
    initPdfModal();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
