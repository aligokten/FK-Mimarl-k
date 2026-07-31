/* ==========================================================================
   Kahraman bölümü — elle çizim hissi veren mimari eskiz animasyonu

   Ofisin üretim zincirini üç evrede anlatır:

     01  RÖLÖVE ALIMI       Yapı yerinde ölçülür. Mevcut hâliyle — çöken
                            saçak, şakulden kaçmış duvar, kayıp dokular —
                            çizilir; ölçü çizgileri ve kotlar işlenir.
     02  UYGULAMA PROJESİ   Ölçü katmanı geri çekilir; deformasyon
                            düzeltilir, kesit taramaları, malzeme
                            açıklamaları ve antet gelir.
     03  YAPININ OLUŞUMU    Çizgiler yerinde kalırken yüzeyler dolar,
                            gölgeler düşer, pencerelerde ışık yanar.

   Tüm geometri kod içinde üretilir; dışarıdan dosya veya kütüphane
   yüklenmez. Çizgiler her karede yeniden rastgelelenmez — titremesin
   diye sapmalar bir kez, tohumlu rastgelelikle hesaplanır.
   ========================================================================== */

/* ------------------------------------------------------------- yardımcı */
const DERECE = Math.PI / 180;

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Tohumlanabilir rastgelelik — çizim her açılışta aynı olsun. */
function tohumlu(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ==========================================================================
   Kalem uçları
   ========================================================================== */
const KALEM = {
  // Rölöve: serbest elle, biraz kararsız kurşun kalem
  roleve: { renk: "#e8e2d6", kalinlik: 1.35, sapma: 0.9, gecis: 2, alfa: 0.85 },
  // Ölçü/kot katmanı: ince, sarı-toprak
  olcu: { renk: "#c49a6f", kalinlik: 0.9, sapma: 0.45, gecis: 1, alfa: 0.9 },
  // Uygulama projesi: net, kararlı çizgi
  proje: { renk: "#f2ede2", kalinlik: 1.7, sapma: 0.32, gecis: 2, alfa: 0.95 },
  // Tarama / hatch
  tarama: { renk: "#b9b0a0", kalinlik: 0.75, sapma: 0.4, gecis: 1, alfa: 0.55 },
  // İnce yardımcı çizgi (aks, uzatma)
  ince: { renk: "#8d8477", kalinlik: 0.7, sapma: 0.25, gecis: 1, alfa: 0.7 },
};

/* ==========================================================================
   Çizim kurucusu
   Her "vuruş" önceden hesaplanmış noktalardan oluşur; `bas`–`bit`
   aralığı vuruşun genel ilerlemedeki zaman penceresidir.
   ========================================================================== */
class Cizim {
  constructor(seed) {
    this.rnd = tohumlu(seed);
    this.vuruslar = [];
    this.yazilar = [];
    this.dolgular = [];
  }

  /** İki nokta arasında elle çizilmiş izlenimi veren nokta dizisi. */
  _elIzi(x1, y1, x2, y2, sapma) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const uzunluk = Math.hypot(dx, dy);
    const adet = Math.max(2, Math.min(18, Math.round(uzunluk / 9)));
    const nx = -dy / (uzunluk || 1);
    const ny = dx / (uzunluk || 1);

    // Uçlarda sapma sıfıra yaklaşsın: çizgi köşelerde otursun
    const noktalar = [];
    for (let i = 0; i <= adet; i++) {
      const t = i / adet;
      const zarf = Math.sin(t * Math.PI);
      const s = (this.rnd() - 0.5) * 2 * sapma * zarf;
      noktalar.push([x1 + dx * t + nx * s, y1 + dy * t + ny * s]);
    }
    return noktalar;
  }

  /** Tek çizgi. */
  cizgi(x1, y1, x2, y2, kalem, bas, bit, ek) {
    const k = KALEM[kalem];
    const gecisler = [];
    for (let g = 0; g < k.gecis; g++) {
      gecisler.push(this._elIzi(x1, y1, x2, y2, k.sapma * (g ? 1.5 : 1)));
    }
    this.vuruslar.push(
      Object.assign({ gecisler, kalem: k, bas, bit }, ek || {})
    );
    return this;
  }

  /** Kapalı ya da açık çoklu çizgi; ilerleme tüm uzunluğa yayılır. */
  poli(noktalar, kalem, bas, bit, kapali, ek) {
    const n = kapali ? noktalar.length : noktalar.length - 1;
    let toplam = 0;
    const boylar = [];
    for (let i = 0; i < n; i++) {
      const a = noktalar[i];
      const b = noktalar[(i + 1) % noktalar.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      boylar.push(L);
      toplam += L;
    }
    let gecen = 0;
    for (let i = 0; i < n; i++) {
      const a = noktalar[i];
      const b = noktalar[(i + 1) % noktalar.length];
      const o1 = gecen / toplam;
      gecen += boylar[i];
      const o2 = gecen / toplam;
      this.cizgi(
        a[0], a[1], b[0], b[1],
        kalem,
        lerp(bas, bit, o1),
        lerp(bas, bit, o2),
        ek
      );
    }
    return this;
  }

  dikdortgen(x, y, g, h, kalem, bas, bit, ek) {
    return this.poli(
      [[x, y], [x + g, y], [x + g, y + h], [x, y + h]],
      kalem, bas, bit, true, ek
    );
  }

  /** Dikdörtgen alan içine eğik tarama. */
  tarama(x, y, g, h, aci, aralik, kalem, bas, bit, ek) {
    const rad = aci * DERECE;
    const tn = Math.tan(rad);
    // Sol üstten sağ alta doğru tarayarak kutuyu kesen doğrular
    const kapsam = g + Math.abs(h * tn);
    const adet = Math.floor(kapsam / aralik);
    for (let i = 0; i <= adet; i++) {
      const ofset = -Math.abs(h * tn) + i * aralik;
      // Doğrunun kutu içindeki parçasını bul
      let ax = x + ofset;
      let ay = y;
      let bx = x + ofset + h * tn;
      let by = y + h;
      // Kutu dışına taşan uçları kırp
      if (ax < x) { ay = y + (x - ax) / tn; ax = x; }
      if (bx > x + g) { by = y + (x + g - (x + ofset)) / tn; bx = x + g; }
      if (ax > x + g || bx < x) continue;
      if (ay > y + h || by < y) continue;
      const o = i / (adet || 1);
      this.cizgi(
        ax, ay, bx, by, kalem,
        lerp(bas, bit, o * 0.85),
        lerp(bas, bit, o * 0.85 + 0.15),
        ek
      );
    }
    return this;
  }

  /** Ölçü çizgisi: uzatma çizgileri + eğik kesikler + değer. */
  olcu(x1, y1, x2, y2, deger, bas, bit, ek) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const c = 4;

    this.cizgi(x1, y1, x2, y2, "olcu", bas, lerp(bas, bit, 0.7), ek);
    // uçlardaki eğik kesikler
    this.cizgi(
      x1 - nx * c - (dx / L) * c, y1 - ny * c - (dy / L) * c,
      x1 + nx * c + (dx / L) * c, y1 + ny * c + (dy / L) * c,
      "olcu", lerp(bas, bit, 0.7), lerp(bas, bit, 0.85), ek
    );
    this.cizgi(
      x2 - nx * c - (dx / L) * c, y2 - ny * c - (dy / L) * c,
      x2 + nx * c + (dx / L) * c, y2 + ny * c + (dy / L) * c,
      "olcu", lerp(bas, bit, 0.85), bit, ek
    );

    if (deger) {
      this.yazi(
        (x1 + x2) / 2 + nx * 7,
        (y1 + y2) / 2 + ny * 7,
        deger,
        { boyut: 7, renk: "#c49a6f", bas: lerp(bas, bit, 0.6), bit,
          aci: Math.abs(dy) > Math.abs(dx) ? -90 : 0, hiza: "center",
          sonrasi: ek && ek.sonrasi }
      );
    }
    return this;
  }

  /** Kılavuz çizgili açıklama (leader line). */
  aciklama(x, y, hedefX, hedefY, metin, bas, bit, ek) {
    this.cizgi(hedefX, hedefY, x, y, "ince", bas, lerp(bas, bit, 0.5), ek);
    const yon = x >= hedefX ? 1 : -1;
    this.cizgi(x, y, x + 12 * yon, y, "ince", lerp(bas, bit, 0.5), lerp(bas, bit, 0.65), ek);
    this.yazi(x + 14 * yon, y - 2.2, metin, {
      boyut: 6, renk: "#b9b0a0", bas: lerp(bas, bit, 0.6), bit,
      hiza: yon > 0 ? "left" : "right",
      sonrasi: ek && ek.sonrasi,
    });
    return this;
  }

  yazi(x, y, metin, o) {
    this.yazilar.push({
      x, y, metin,
      boyut: o.boyut || 7,
      renk: o.renk || "#e8e2d6",
      bas: o.bas, bit: o.bit,
      aci: o.aci || 0,
      hiza: o.hiza || "left",
      aralik: o.aralik === undefined ? 0.14 : o.aralik,
      sonrasi: o.sonrasi,
    });
    return this;
  }

  /** Faz 3'te yüzeyleri dolduran yıkama (wash). */
  dolgu(noktalar, renk, bas, bit, alfa) {
    this.dolgular.push({ noktalar, renk, bas, bit, alfa: alfa === undefined ? 1 : alfa });
    return this;
  }
}

/* ==========================================================================
   Yapının cephe geometrisi

   İki hâl üretilir: rölövedeki "bulunduğu gibi" (deformasyonlu) ve
   projedeki "düzeltilmiş" hâl. Faz 2'de biri diğerine dönüşür.
   ========================================================================== */
function cepheGeometrisi(bozuk) {
  // 0–100 yatay, 0–72 düşey çizim uzayı
  const d = bozuk ? 1 : 0;

  const zemin = 64;
  const saçakY = 24 + d * 1.6; // çökmüş saçak
  const mahyaY = 8 + d * 2.2;
  const solEgim = d * 1.8; // şakulden kaçmış sol duvar
  const sagCokme = d * 1.1;

  return {
    zemin,
    // Çatı: sol saçak → mahya sol → mahya sağ → sağ saçak
    cati: [
      [8, saçakY + d * 1.2],
      [30, mahyaY],
      [70, mahyaY + d * 0.8],
      [92, saçakY - d * 0.6],
    ],
    saçakY,
    // Üst kat (ahşap çıkma) — saçaktan biraz içeride
    ustKat: {
      x: 12 - solEgim,
      y: saçakY,
      g: 76 + solEgim,
      h: 18 - d * 0.6,
    },
    // Zemin kat (taş) — çıkmadan içeride
    zeminKat: {
      x: 18 - solEgim * 0.5,
      y: saçakY + 18 - d * 0.6,
      g: 64,
      h: zemin - (saçakY + 18 - d * 0.6) + sagCokme,
    },
    baca: { x: 62, y: mahyaY - 9, g: 7, h: 11 },
    // Üst kat pencereleri
    ustPencere: [20, 34, 48, 62, 76].map((x) => ({
      x: x - solEgim, y: saçakY + 4, g: 10, h: 10,
    })),
    // Zemin kat: kapı ortada, iki yanda pencere
    zeminAcik: [
      { x: 26, y: saçakY + 24, g: 11, h: 12, tip: "pencere" },
      { x: 45, y: saçakY + 22, g: 12, h: 18, tip: "kapi" },
      { x: 65, y: saçakY + 24, g: 11, h: 12, tip: "pencere" },
    ],
  };
}

/** İki geometri arasında yumuşak geçiş (deformasyonun düzeltilmesi). */
function geometriKaristir(a, b, t) {
  const k = (p, q) => lerp(p, q, t);
  const kutu = (p, q) => ({ x: k(p.x, q.x), y: k(p.y, q.y), g: k(p.g, q.g), h: k(p.h, q.h) });
  return {
    zemin: k(a.zemin, b.zemin),
    saçakY: k(a.saçakY, b.saçakY),
    cati: a.cati.map((p, i) => [k(p[0], b.cati[i][0]), k(p[1], b.cati[i][1])]),
    ustKat: kutu(a.ustKat, b.ustKat),
    zeminKat: kutu(a.zeminKat, b.zeminKat),
    baca: kutu(a.baca, b.baca),
    ustPencere: a.ustPencere.map((p, i) => kutu(p, b.ustPencere[i])),
    zeminAcik: a.zeminAcik.map((p, i) =>
      Object.assign(kutu(p, b.zeminAcik[i]), { tip: p.tip })
    ),
  };
}

/* ==========================================================================
   Sahne: üç evrenin vuruş zamanlaması
   ========================================================================== */
const EVRE = {
  roleveBas: 0.02,
  roleveBit: 0.24,
  olcuBas: 0.2,
  olcuBit: 0.38,
  projeBas: 0.4,
  projeBit: 0.66,
  detayBas: 0.58,
  detayBit: 0.74,
  yapiBas: 0.74,
  yapiBit: 0.98,
};

function sahneKur(G) {
  const c = new Cizim(20260731);

  /* ---------------- 01 · RÖLÖVE — bulunduğu gibi çizim -------------- */
  const r = EVRE;

  // zemin çizgisi
  c.cizgi(2, G.zemin, 98, G.zemin, "roleve", r.roleveBas, r.roleveBas + 0.03);

  // çatı ve saçak
  c.poli(G.cati, "roleve", r.roleveBas + 0.02, r.roleveBas + 0.08, false);
  c.cizgi(G.cati[0][0], G.cati[0][1], G.ustKat.x, G.saçakY, "roleve",
    r.roleveBas + 0.07, r.roleveBas + 0.09);
  c.cizgi(G.cati[3][0], G.cati[3][1], G.ustKat.x + G.ustKat.g, G.saçakY, "roleve",
    r.roleveBas + 0.07, r.roleveBas + 0.09);

  // baca
  c.dikdortgen(G.baca.x, G.baca.y, G.baca.g, G.baca.h, "roleve",
    r.roleveBas + 0.09, r.roleveBas + 0.12);

  // üst kat gövdesi
  c.dikdortgen(G.ustKat.x, G.ustKat.y, G.ustKat.g, G.ustKat.h, "roleve",
    r.roleveBas + 0.1, r.roleveBas + 0.15);

  // zemin kat gövdesi
  c.dikdortgen(G.zeminKat.x, G.zeminKat.y, G.zeminKat.g, G.zeminKat.h, "roleve",
    r.roleveBas + 0.13, r.roleveBas + 0.18);

  // açıklıklar
  G.ustPencere.forEach((p, i) => {
    const b = r.roleveBas + 0.16 + i * 0.008;
    c.dikdortgen(p.x, p.y, p.g, p.h, "roleve", b, b + 0.02);
  });
  G.zeminAcik.forEach((p, i) => {
    const b = r.roleveBas + 0.18 + i * 0.01;
    c.dikdortgen(p.x, p.y, p.g, p.h, "roleve", b, b + 0.022);
  });

  // hasar: çatlaklar ve kayıp doku taraması
  const catlak = [
    [[G.zeminKat.x + 8, G.zeminKat.y + 2], [G.zeminKat.x + 12, G.zeminKat.y + 9],
     [G.zeminKat.x + 9, G.zeminKat.y + 16], [G.zeminKat.x + 14, G.zeminKat.y + 22]],
    [[G.zeminKat.x + 52, G.zeminKat.y + 4], [G.zeminKat.x + 49, G.zeminKat.y + 12],
     [G.zeminKat.x + 54, G.zeminKat.y + 20]],
  ];
  catlak.forEach((yol, i) => {
    c.poli(yol, "roleve", r.roleveBit - 0.05 + i * 0.015, r.roleveBit - 0.01 + i * 0.015, false);
  });
  // kayıp sıva alanı
  c.tarama(G.ustKat.x + 4, G.ustKat.y + 11, 13, 6, 45, 2.6, "tarama",
    r.roleveBit - 0.04, r.roleveBit);

  /* ---------------- 01b · ÖLÇÜ VE KOT KATMANI ----------------------- */
  const o = { sonrasi: { solma: [r.projeBas, r.projeBas + 0.1] } };

  // uzatma çizgileri
  c.cizgi(G.zeminKat.x, G.zemin + 2, G.zeminKat.x, G.zemin + 14, "ince", r.olcuBas, r.olcuBas + 0.02, o);
  c.cizgi(G.zeminKat.x + G.zeminKat.g, G.zemin + 2, G.zeminKat.x + G.zeminKat.g, G.zemin + 14, "ince",
    r.olcuBas, r.olcuBas + 0.02, o);
  c.olcu(G.zeminKat.x, G.zemin + 11, G.zeminKat.x + G.zeminKat.g, G.zemin + 11, "12.40", r.olcuBas + 0.02, r.olcuBas + 0.07, o);

  // düşey ölçüler (kat yükseklikleri)
  c.cizgi(G.zeminKat.x - 4, G.zemin, G.zeminKat.x - 16, G.zemin, "ince", r.olcuBas + 0.05, r.olcuBas + 0.06, o);
  c.cizgi(G.ustKat.x - 4, G.ustKat.y + G.ustKat.h, G.zeminKat.x - 16, G.ustKat.y + G.ustKat.h, "ince",
    r.olcuBas + 0.05, r.olcuBas + 0.06, o);
  c.cizgi(G.ustKat.x - 4, G.saçakY, G.zeminKat.x - 16, G.saçakY, "ince", r.olcuBas + 0.06, r.olcuBas + 0.07, o);
  c.olcu(G.zeminKat.x - 12, G.zemin, G.zeminKat.x - 12, G.ustKat.y + G.ustKat.h, "3.05",
    r.olcuBas + 0.07, r.olcuBas + 0.11, o);
  c.olcu(G.zeminKat.x - 12, G.ustKat.y + G.ustKat.h, G.zeminKat.x - 12, G.saçakY, "2.80",
    r.olcuBas + 0.1, r.olcuBas + 0.14, o);

  // açıklık ölçüsü
  c.olcu(G.zeminAcik[0].x, G.zeminAcik[0].y - 6, G.zeminAcik[0].x + G.zeminAcik[0].g,
    G.zeminAcik[0].y - 6, "1.15", r.olcuBas + 0.12, r.olcuBas + 0.15, o);

  // kot işareti
  c.poli([[G.zeminKat.x + 30, G.zemin - 4], [G.zeminKat.x + 33, G.zemin],
          [G.zeminKat.x + 27, G.zemin]], "olcu", r.olcuBas + 0.14, r.olcuBas + 0.16, true, o);
  c.yazi(G.zeminKat.x + 36, G.zemin - 3, "±0.00", {
    boyut: 6.6, renk: "#c49a6f", bas: r.olcuBas + 0.15, bit: r.olcuBas + 0.17,
    sonrasi: o.sonrasi,
  });

  c.yazi(4, 8, "RÖLÖVE · MEVCUT DURUM", {
    boyut: 7, renk: "#c49a6f", bas: r.olcuBas + 0.02, bit: r.olcuBas + 0.06,
    aralik: 0.3, sonrasi: o.sonrasi,
  });

  /* ---------------- 02 · UYGULAMA PROJESİ --------------------------- */
  const p = EVRE;

  // düzeltilmiş gövde çizgileri (proje kalemi, rölövenin üstüne)
  c.poli(G.cati, "proje", p.projeBas, p.projeBas + 0.05, false, { geo: "duz" });
  c.dikdortgen(G.ustKat.x, G.ustKat.y, G.ustKat.g, G.ustKat.h, "proje",
    p.projeBas + 0.04, p.projeBas + 0.09, { geo: "duz" });
  c.dikdortgen(G.zeminKat.x, G.zeminKat.y, G.zeminKat.g, G.zeminKat.h, "proje",
    p.projeBas + 0.07, p.projeBas + 0.12, { geo: "duz" });

  // taş örgü dokusu (zemin kat)
  const tasY0 = G.zeminKat.y;
  const sira = 4.2;
  for (let i = 1; i * sira < G.zeminKat.h; i++) {
    const y = tasY0 + i * sira;
    const b = p.projeBas + 0.1 + i * 0.006;
    c.cizgi(G.zeminKat.x, y, G.zeminKat.x + G.zeminKat.g, y, "tarama", b, b + 0.012, { geo: "duz" });
    // düşey derzler (şaşırtmalı)
    const kaydir = i % 2 ? 0 : sira;
    for (let x = G.zeminKat.x + kaydir; x < G.zeminKat.x + G.zeminKat.g - 1; x += sira * 2) {
      c.cizgi(x, y, x, y - sira, "tarama", b + 0.004, b + 0.012, { geo: "duz" });
    }
  }

  // ahşap karkas (üst kat) — dikmeler ve kuşaklar
  for (let i = 0; i <= 6; i++) {
    const x = G.ustKat.x + (G.ustKat.g * i) / 6;
    const b = p.projeBas + 0.14 + i * 0.008;
    c.cizgi(x, G.ustKat.y, x, G.ustKat.y + G.ustKat.h, "proje", b, b + 0.02, { geo: "duz" });
  }
  c.cizgi(G.ustKat.x, G.ustKat.y + G.ustKat.h * 0.55, G.ustKat.x + G.ustKat.g,
    G.ustKat.y + G.ustKat.h * 0.55, "proje", p.projeBas + 0.2, p.projeBas + 0.23, { geo: "duz" });

  // kiremit örtü çizgileri
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const y = lerp(G.saçakY, G.cati[1][1], t);
    const x1 = lerp(G.cati[0][0], G.cati[1][0], t);
    const x2 = lerp(G.cati[3][0], G.cati[2][0], t);
    const b = p.projeBas + 0.16 + i * 0.01;
    c.cizgi(x1, y, x2, y, "tarama", b, b + 0.02, { geo: "duz" });
  }

  // açıklıklar (proje kalemiyle yeniden)
  G.ustPencere.forEach((w, i) => {
    const b = p.detayBas + i * 0.006;
    c.dikdortgen(w.x, w.y, w.g, w.h, "proje", b, b + 0.015, { geo: "duz" });
    c.cizgi(w.x + w.g / 2, w.y, w.x + w.g / 2, w.y + w.h, "ince", b + 0.008, b + 0.016, { geo: "duz" });
  });
  G.zeminAcik.forEach((w, i) => {
    const b = p.detayBas + 0.03 + i * 0.008;
    c.dikdortgen(w.x, w.y, w.g, w.h, "proje", b, b + 0.018, { geo: "duz" });
  });

  // malzeme açıklamaları
  const acikSol = { sonrasi: { solma: [p.yapiBas + 0.1, p.yapiBas + 0.18] } };

  c.aciklama(G.zeminKat.x + G.zeminKat.g + 6, G.zeminKat.y + 12,
    G.zeminKat.x + G.zeminKat.g - 6, G.zeminKat.y + 9,
    "TAŞ + KİREÇ HARCI", p.detayBas + 0.05, p.detayBas + 0.1, acikSol);

  c.aciklama(G.ustKat.x + G.ustKat.g + 6, G.ustKat.y + 6,
    G.ustKat.x + G.ustKat.g - 5, G.ustKat.y + 6,
    "AHŞAP KARKAS", p.detayBas + 0.08, p.detayBas + 0.13, acikSol);

  c.aciklama(G.cati[2][0] + 8, G.cati[2][1] + 1, G.cati[2][0] - 4, G.cati[2][1] + 3,
    "ALATURKA KİREMİT", p.detayBas + 0.11, p.detayBas + 0.16, acikSol);

  // antet
  const anteX = 62;
  const anteY = G.zemin + 6;
  const ante = { sonrasi: { solma: [p.yapiBit - 0.06, p.yapiBit] } };
  c.dikdortgen(anteX, anteY, 34, 14, "ince", p.detayBit - 0.06, p.detayBit - 0.02, ante);
  c.cizgi(anteX, anteY + 6, anteX + 34, anteY + 6, "ince", p.detayBit - 0.03, p.detayBit - 0.01, ante);
  c.yazi(anteX + 2.5, anteY + 4.3, "UYGULAMA PROJESİ", {
    boyut: 6.4, renk: "#e8e2d6", bas: p.detayBit - 0.03, bit: p.detayBit,
    aralik: 0.22, sonrasi: ante.sonrasi,
  });
  c.yazi(anteX + 2.5, anteY + 11, "ÖLÇEK 1/50 · PAFTA 03", {
    boyut: 5.6, renk: "#8d8477", bas: p.detayBit - 0.01, bit: p.detayBit + 0.02,
    aralik: 0.18, sonrasi: ante.sonrasi,
  });

  /* ---------------- 03 · YAPININ OLUŞUMU ---------------------------- */
  const y = EVRE;

  // yüzey yıkamaları (aşağıdan yukarı dolar)
  c.dolgu(
    [[G.zeminKat.x, G.zeminKat.y], [G.zeminKat.x + G.zeminKat.g, G.zeminKat.y],
     [G.zeminKat.x + G.zeminKat.g, G.zeminKat.y + G.zeminKat.h], [G.zeminKat.x, G.zeminKat.y + G.zeminKat.h]],
    "#b9ac93", y.yapiBas, y.yapiBas + 0.09, 0.5
  );
  c.dolgu(
    [[G.ustKat.x, G.ustKat.y], [G.ustKat.x + G.ustKat.g, G.ustKat.y],
     [G.ustKat.x + G.ustKat.g, G.ustKat.y + G.ustKat.h], [G.ustKat.x, G.ustKat.y + G.ustKat.h]],
    "#d6cbb4", y.yapiBas + 0.06, y.yapiBas + 0.15, 0.42
  );
  c.dolgu(
    [G.cati[0], G.cati[1], G.cati[2], G.cati[3]],
    "#a8623f", y.yapiBas + 0.12, y.yapiBas + 0.2, 0.55
  );
  c.dolgu(
    [[G.baca.x, G.baca.y], [G.baca.x + G.baca.g, G.baca.y],
     [G.baca.x + G.baca.g, G.baca.y + G.baca.h], [G.baca.x, G.baca.y + G.baca.h]],
    "#b9ac93", y.yapiBas + 0.14, y.yapiBas + 0.19, 0.5
  );

  // gölge tarafı (sağ cephe hissi) — eğik tarama
  c.tarama(G.zeminKat.x + G.zeminKat.g - 14, G.zeminKat.y + 2, 13, G.zeminKat.h - 4,
    60, 2.2, "tarama", y.yapiBas + 0.16, y.yapiBas + 0.24);

  // pencerelerde ışık — yapı en sonda "yaşamaya" başlar
  G.ustPencere.forEach((w, i) => {
    const b = y.yapiBas + 0.18 + i * 0.012;
    c.dolgu(
      [[w.x, w.y], [w.x + w.g, w.y], [w.x + w.g, w.y + w.h], [w.x, w.y + w.h]],
      "#e8a758", b, b + 0.05, 0.7
    );
  });
  G.zeminAcik.forEach((w, i) => {
    if (w.tip !== "pencere") return;
    const b = y.yapiBas + 0.2 + i * 0.012;
    c.dolgu(
      [[w.x, w.y], [w.x + w.g, w.y], [w.x + w.g, w.y + w.h], [w.x, w.y + w.h]],
      "#e8a758", b, b + 0.05, 0.66
    );
  });

  return c;
}

/* ==========================================================================
   Oluşturucu (renderer)
   ========================================================================== */
export function initHeroSketch(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  const bozukG = cepheGeometrisi(true);
  const duzG = cepheGeometrisi(false);

  let cizim = null;
  let sonGeoT = -1;

  /* Geometri faz 2'de düzeldiği için sahne, deformasyon oranı
     değiştikçe yeniden kurulur (nadiren — 12 kademe yeterli). */
  function sahneAl(t) {
    const duzelme = smoothstep(EVRE.projeBas, EVRE.projeBit, t);
    const kademe = Math.round(duzelme * 12) / 12;
    if (kademe !== sonGeoT) {
      sonGeoT = kademe;
      cizim = sahneKur(geometriKaristir(bozukG, duzG, kademe));
    }
    return cizim;
  }

  /* -------------------------------------------------- yerleşim */
  let en = 1;
  let boy = 1;
  let dpr = 1;
  let olcek = 1;
  let ofsetX = 0;
  let ofsetY = 0;

  function boyutla() {
    const r = canvas.getBoundingClientRect();
    en = Math.max(1, r.width);
    boy = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(en * dpr);
    canvas.height = Math.round(boy * dpr);

    // Çizim uzayı 100 × 86 (antet ve ölçüler dahil), payla birlikte
    const cizimEn = 128;
    const cizimBoy = 92;
    const dikey = en / boy < 0.85;

    if (dikey) {
      // Dar ekran: tam genişlik, üst yarıda
      olcek = (en * 0.92) / cizimEn;
      ofsetX = (en - cizimEn * olcek) / 2 + 6 * olcek;
      ofsetY = boy * 0.06;
    } else {
      // Geniş ekran: sağ tarafta, metne yer bırak
      /* Çizim sağ tarafta durur; başlık solda kaldığı için alan
         dar tutulur ve biraz yukarı alınır. Kalan çakışmayı perde
         (hero__scrim) yumuşatır. */
      const alan = en * (en / boy > 1.4 ? 0.46 : 0.66);
      olcek = Math.min(alan / cizimEn, (boy * 0.76) / cizimBoy);
      ofsetX = en - alan + (alan - cizimEn * olcek) / 2;
      ofsetY = boy * 0.09;
    }
  }

  const X = (x) => ofsetX + x * olcek;
  const Y = (y) => ofsetY + y * olcek;

  /* -------------------------------------------------- çizim */
  function vurusCiz(v, t) {
    const p = smoothstep(v.bas, v.bit, t);
    if (p <= 0.001) return;

    // Sonradan solan katmanlar (ölçü çizgileri, açıklamalar, antet)
    let alfa = v.kalem.alfa;
    if (v.sonrasi && v.sonrasi.solma) {
      alfa *= 1 - smoothstep(v.sonrasi.solma[0], v.sonrasi.solma[1], t);
      if (alfa <= 0.01) return;
    }

    ctx.strokeStyle = v.kalem.renk;
    ctx.lineWidth = Math.max(0.6, v.kalem.kalinlik * olcek * 0.34);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    v.gecisler.forEach((noktalar, gi) => {
      ctx.globalAlpha = alfa * (gi === 0 ? 1 : 0.4);
      ctx.beginPath();

      // Kaç noktaya kadar çizildi
      const son = 1 + (noktalar.length - 1) * p;
      const tamSayi = Math.floor(son);
      ctx.moveTo(X(noktalar[0][0]), Y(noktalar[0][1]));
      for (let i = 1; i < Math.min(tamSayi, noktalar.length); i++) {
        ctx.lineTo(X(noktalar[i][0]), Y(noktalar[i][1]));
      }
      // Son parçanın kesri
      if (tamSayi < noktalar.length) {
        const kesir = son - tamSayi;
        const a = noktalar[tamSayi - 1];
        const b = noktalar[tamSayi];
        ctx.lineTo(X(lerp(a[0], b[0], kesir)), Y(lerp(a[1], b[1], kesir)));
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function yaziCiz(w, t) {
    let a = smoothstep(w.bas, w.bit, t);
    if (a <= 0.01) return;
    if (w.sonrasi && w.sonrasi.solma) {
      a *= 1 - smoothstep(w.sonrasi.solma[0], w.sonrasi.solma[1], t);
      if (a <= 0.01) return;
    }

    /* `boyut` çizim birimindedir; yapı ~80 birim geniş olduğundan
       teknik yazı ölçeği buna göre küçültülür. */
    const px = Math.max(9, w.boyut * olcek * 0.34);
    ctx.save();
    ctx.globalAlpha = a * 0.92;
    ctx.fillStyle = w.renk;
    ctx.font = "500 " + px + 'px "Archivo", system-ui, sans-serif';
    ctx.textAlign = w.hiza;
    ctx.textBaseline = "middle";
    ctx.translate(X(w.x), Y(w.y));
    if (w.aci) ctx.rotate(w.aci * DERECE);

    // Teknik yazı hissi için harf aralığı
    if (ctx.letterSpacing !== undefined) {
      ctx.letterSpacing = (w.aralik * px).toFixed(2) + "px";
    }
    ctx.fillText(w.metin, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function dolguCiz(d, t) {
    const p = smoothstep(d.bas, d.bit, t);
    if (p <= 0.001) return;

    const ys = d.noktalar.map((n) => n[1]);
    const ustY = Math.min.apply(null, ys);
    const altY = Math.max.apply(null, ys);
    // Aşağıdan yukarı dolan yıkama
    const sinir = altY - (altY - ustY) * p;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(X(d.noktalar[0][0]), Y(d.noktalar[0][1]));
    for (let i = 1; i < d.noktalar.length; i++) {
      ctx.lineTo(X(d.noktalar[i][0]), Y(d.noktalar[i][1]));
    }
    ctx.closePath();
    ctx.clip();

    ctx.globalAlpha = d.alfa;
    ctx.fillStyle = d.renk;
    ctx.fillRect(X(-20), Y(sinir), en, Y(altY + 4) - Y(sinir));
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  let ilerleme = 0;
  let bekleyen = false;

  function ciz() {
    bekleyen = false;
    const t = ilerleme;
    const c = sahneAl(t);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, en, boy);

    // Önce yüzey yıkamaları (çizgilerin altında kalsın)
    for (const d of c.dolgular) dolguCiz(d, t);
    for (const v of c.vuruslar) vurusCiz(v, t);
    for (const w of c.yazilar) yaziCiz(w, t);
  }

  function istekCiz() {
    if (bekleyen) return;
    bekleyen = true;
    window.requestAnimationFrame(ciz);
  }

  boyutla();
  ciz();

  return {
    setProgress(t) {
      const yeni = Math.min(Math.max(t, 0), 1);
      if (Math.abs(yeni - ilerleme) < 0.0004) return;
      ilerleme = yeni;
      istekCiz();
    },
    resize() {
      boyutla();
      istekCiz();
    },
    start() {},
    stop() {},
    dispose() {},
  };
}
