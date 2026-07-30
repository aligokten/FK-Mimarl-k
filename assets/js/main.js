/* ==========================================================================
   Fatma Kocaova Mimarlık — arayüz etkileşimleri
   Bağımlılık yok, tüm modüller opsiyonel: ilgili DOM yoksa sessizce atlanır.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    window.matchMedia("(min-width: 1000px)").addEventListener("change", function (e) {
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
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
     Not: action boşsa mailto ile açılır. Gerçek gönderim için formun
     action alanına bir servis adresi (Formspree, Netlify Forms vb.) yazın.
     --------------------------------------------------------------------- */
  function initForm() {
    var form = document.querySelector("[data-contact-form]");
    if (!form) return;

    var status = form.querySelector(".form__status");

    form.addEventListener("submit", function (e) {
      if (form.getAttribute("action")) return; // gerçek uç nokta tanımlı

      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var data = new FormData(form);
      var mail = form.getAttribute("data-mailto") || "info@fatmakocaovamimarlik.com";
      var subject =
        "Web sitesi iletişim formu — " + (data.get("konu") || "Genel");
      var body = [
        "Ad Soyad: " + (data.get("ad") || ""),
        "E-posta: " + (data.get("eposta") || ""),
        "Telefon: " + (data.get("telefon") || ""),
        "Konu: " + (data.get("konu") || ""),
        "",
        "Mesaj:",
        data.get("mesaj") || "",
      ].join("\n");

      window.location.href =
        "mailto:" +
        mail +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);

      if (status) {
        status.textContent =
          "E-posta uygulamanız açılıyor. Açılmazsa doğrudan " + mail + " adresine yazabilirsiniz.";
      }
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
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
