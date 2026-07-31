/* ==========================================================================
   Kahraman bölümü 3B sahnesi — "yıkıntıdan restore edilmiş konağa"

   Geleneksel bir konak (taş zemin kat, çıkmalı ahşap üst kat, kiremit çatı)
   prosedürel olarak kurulur. Sayfa kaydırıldıkça `ilerleme` değeri 0 → 1
   arası değişir ve yapı sırasıyla şu evrelerden geçer:

     0.00 – 0.15   yıkıntı: eksik duvar sıraları, moloz, ot
     0.15 – 0.35   moloz kaldırılır, iskele kurulur
     0.35 – 0.60   duvarlar tamamlanır, ahşap karkas ve mertekler
     0.60 – 0.85   kiremit örtü, sıva dolgu, doğramalar
     0.85 – 1.00   iskele sökülür, camlar takılır, ışık yanar

   Harici dosya yüklenmez; tüm geometri kod içinde üretilir.
   ========================================================================== */

import * as THREE from "../vendor/three.module.min.js";

/* ---------------------------------------------------------------- yardımcı */
const lerp = (a, b, t) => a + (b - a) * t;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Tohumlanabilir rastgelelik — sahne her yüklemede aynı görünsün. */
function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* --------------------------------------------------------------- ölçüler */
const KONAK = {
  genislik: 6.4, // cephe genişliği (x)
  derinlik: 4.8, // yapı derinliği (z)
  tasKat: 2.5, // taş zemin kat yüksekliği
  ahsapKat: 2.3, // ahşap üst kat yüksekliği
  cikma: 0.6, // cumba çıkması
  sira: 0.34, // taş sırası yüksekliği
  saçak: 0.55, // saçak taşması
  catiY: 1.7, // çatı yüksekliği
};

/* ==========================================================================
   Parça toplayıcı: her parça bir InstancedMesh içinde bir indeks alır.
   ========================================================================== */
class ParcaSeti {
  constructor() {
    this.gruplar = new Map();
  }

  ekle(grup, parca) {
    if (!this.gruplar.has(grup)) this.gruplar.set(grup, []);
    this.gruplar.get(grup).push(parca);
  }

  al(grup) {
    return this.gruplar.get(grup) || [];
  }
}

/* ==========================================================================
   Sahne kurucu
   ========================================================================== */
export function initHero3D(canvas, options = {}) {
  const kalite = options.kalite || "yuksek"; // "yuksek" | "dusuk"
  const dusuk = kalite === "dusuk";

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !dusuk,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, dusuk ? 1.25 : 1.75));
  renderer.shadowMap.enabled = !dusuk;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  /* ---------------------------------------------------------- atmosfer */
  const gokSoguk = new THREE.Color(0x252b31);
  const gokSicak = new THREE.Color(0x2a1f16);
  scene.fog = new THREE.Fog(gokSoguk.getHex(), 24, 62);

  const ambiyans = new THREE.AmbientLight(0xffffff, 0.62);
  scene.add(ambiyans);

  const gokIsik = new THREE.HemisphereLight(0x9fb0bd, 0x3a332b, 0.85);
  scene.add(gokIsik);

  const gunes = new THREE.DirectionalLight(0xffffff, 1);
  gunes.position.set(-7, 9, 6);
  if (!dusuk) {
    gunes.castShadow = true;
    gunes.shadow.mapSize.set(1024, 1024);
    gunes.shadow.camera.near = 1;
    gunes.shadow.camera.far = 40;
    const d = 9;
    gunes.shadow.camera.left = -d;
    gunes.shadow.camera.right = d;
    gunes.shadow.camera.top = d;
    gunes.shadow.camera.bottom = -d;
    gunes.shadow.bias = -0.0012;
  }
  scene.add(gunes);

  // Restore aşamasında içeriden sızan sıcak ışık
  const icIsik = new THREE.PointLight(0xffb066, 0, 9, 2);
  icIsik.position.set(0, 2.6, 0);
  scene.add(icIsik);

  /* ------------------------------------------------------------- zemin */
  const zeminMat = new THREE.MeshStandardMaterial({
    color: 0x3a352d,
    roughness: 1,
    metalness: 0,
  });
  const zemin = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), zeminMat);
  zemin.rotation.x = -Math.PI / 2;
  zemin.position.y = -0.02;
  zemin.receiveShadow = !dusuk;
  scene.add(zemin);

  /* ==================================================================
     Geometri üretimi
     ================================================================== */
  const rnd = makeRandom(20260731);
  const set = new ParcaSeti();
  const K = KONAK;
  const yariG = K.genislik / 2;
  const yariD = K.derinlik / 2;

  /* ----- taş duvar örgüsü -------------------------------------------
     Her sıra, boyu rastgele değişen bloklardan oluşur. Bloğun `esik`
     değeri ne kadar yüksekse o kadar geç "tamamlanır"; üst sıralar ve
     rastgele seçilen bazı bloklar yıkıntı etkisi için baştan eksiktir. */
  function tasDuvar(eksenX, uzunluk, merkez, yukseklik, taban, derinlikYonu, faz) {
    const siraSayisi = Math.round(yukseklik / K.sira);
    for (let s = 0; s < siraSayisi; s++) {
      const y = taban + s * K.sira + K.sira / 2;
      const oran = s / siraSayisi; // 0 alt, 1 üst
      let x = -uzunluk / 2;
      const kaydir = s % 2 === 0 ? 0 : 0.22; // şaşırtmalı derz
      x += kaydir;

      while (x < uzunluk / 2 - 0.1) {
        const boy = Math.min(
          0.42 + rnd() * 0.36,
          uzunluk / 2 - x
        );
        if (boy < 0.16) break;

        /* Alt sıralar baştan ayakta (yıkıntı yine de bir yapı olarak
           okunmalı), üst sıralar ilerledikçe tamamlanır. */
        const merkeziX = x + boy / 2;

        /* Ayakta kalan duvar yüksekliği cephe boyunca dalgalanır: bir
           bölüm neredeyse tam ayakta kalırken komşusu diz hizasına
           düşer. Yıkıntının okunur bir silueti olmasını sağlar. */
        const u = merkeziX / (uzunluk / 2); // -1 … 1
        const profil = 0.5 + 0.5 * Math.sin(u * 2.4 + faz);
        const ayaktaOran = 0.3 + profil * 0.66; // %30 – %96 arası

        let esik = (oran - ayaktaOran) * 1.35 + (rnd() - 0.5) * 0.14;
        if (rnd() < 0.09) esik = Math.max(esik, 0.24 + rnd() * 0.26); // delikler
        /* Negatif eşik "baştan ayakta" demektir — 0'a kırpılırsa alt
           sıralar da t=0'da görünmez olur. */
        esik = Math.min(Math.max(esik, -0.9), 0.6);
        const pos = new THREE.Vector3();
        const rot = new THREE.Euler();

        if (eksenX) {
          pos.set(merkeziX, y, merkez);
          rot.y = 0;
        } else {
          pos.set(merkez, y, merkeziX);
          rot.y = Math.PI / 2;
        }

        set.ekle("tas", {
          pos,
          rot,
          size: new THREE.Vector3(boy - 0.04, K.sira - 0.045, 0.42),
          esik,
          span: 0.1,
          // yıkıntı hâlinde hafif oynamış taşlar
          egim: (rnd() - 0.5) * 0.09,
          renk: 0.82 + rnd() * 0.28,
        });

        x += boy;
      }
    }
    void derinlikYonu;
  }

  // Dört cephe (ön cephe pencere boşlukları için sonra delinir)
  tasDuvar(true, K.genislik, -yariD, K.tasKat, 0, 1, 0.4);
  tasDuvar(true, K.genislik, yariD, K.tasKat, 0, -1, 2.7);
  tasDuvar(false, K.derinlik, -yariG, K.tasKat, 0, 1, 1.6);
  tasDuvar(false, K.derinlik, yariG, K.tasKat, 0, -1, 4.1);

  /* ----- pencere/kapı boşlukları -------------------------------------
     Boşluğa denk gelen taşları listeden çıkarıyoruz. */
  const bosluklar = [
    // ön cephe zemin: kapı + 2 pencere
    { x: 0, y: 1.05, g: 1.0, h: 2.1, z: -yariD },
    { x: -2.1, y: 1.35, g: 0.85, h: 1.25, z: -yariD },
    { x: 2.1, y: 1.35, g: 0.85, h: 1.25, z: -yariD },
    // arka cephe
    { x: -1.4, y: 1.35, g: 0.8, h: 1.2, z: yariD },
    { x: 1.4, y: 1.35, g: 0.8, h: 1.2, z: yariD },
  ];

  const taslar = set.al("tas").filter((t) => {
    for (const b of bosluklar) {
      if (Math.abs(t.pos.z - b.z) > 0.3) continue;
      if (
        Math.abs(t.pos.x - b.x) < b.g / 2 + 0.05 &&
        t.pos.y > b.y - b.h / 2 &&
        t.pos.y < b.y + b.h / 2
      ) {
        return false;
      }
    }
    return true;
  });
  set.gruplar.set("tas", taslar);

  /* ----- lentolar (boşluk üstü taş atkı) ----------------------------- */
  for (const b of bosluklar) {
    set.ekle("tas", {
      pos: new THREE.Vector3(b.x, b.y + b.h / 2 + 0.11, b.z),
      rot: new THREE.Euler(),
      size: new THREE.Vector3(b.g + 0.4, 0.2, 0.46),
      esik: 0.34,
      span: 0.1,
      egim: 0,
      renk: 0.95,
    });
  }

  /* ----- ahşap karkas üst kat ---------------------------------------- */
  const ustTaban = K.tasKat;
  const cikmaZ = -yariD - K.cikma;

  // Taban kirişleri (çıkmayı taşıyan payandalar dahil)
  for (let i = -2; i <= 2; i++) {
    set.ekle("ahsap", {
      pos: new THREE.Vector3(i * 1.35, ustTaban + 0.12, -yariD - K.cikma / 2),
      rot: new THREE.Euler(0, 0, 0),
      size: new THREE.Vector3(0.16, 0.2, K.cikma + 0.5),
      esik: 0.3,
      span: 0.09,
      egim: 0,
      renk: 1,
    });
    // payanda
    set.ekle("ahsap", {
      pos: new THREE.Vector3(i * 1.35, ustTaban - 0.28, -yariD - 0.24),
      rot: new THREE.Euler(-0.68, 0, 0),
      size: new THREE.Vector3(0.13, 0.72, 0.13),
      esik: 0.33,
      span: 0.09,
      egim: 0,
      renk: 0.92,
    });
  }

  // Düşey dikmeler + yatay kuşaklar (dört cephe)
  function karkas(eksenX, uzunluk, merkez, adet) {
    for (let i = 0; i <= adet; i++) {
      const u = -uzunluk / 2 + (uzunluk * i) / adet;
      const pos = eksenX
        ? new THREE.Vector3(u, ustTaban + K.ahsapKat / 2, merkez)
        : new THREE.Vector3(merkez, ustTaban + K.ahsapKat / 2, u);
      set.ekle("ahsap", {
        pos,
        rot: new THREE.Euler(0, eksenX ? 0 : Math.PI / 2, 0),
        size: new THREE.Vector3(0.15, K.ahsapKat, 0.17),
        esik: 0.36 + rnd() * 0.08,
        span: 0.1,
        egim: 0,
        renk: 0.88 + rnd() * 0.24,
      });
    }
    // üst ve alt kuşak
    for (const y of [ustTaban + 0.06, ustTaban + K.ahsapKat - 0.06]) {
      const pos = eksenX
        ? new THREE.Vector3(0, y, merkez)
        : new THREE.Vector3(merkez, y, 0);
      set.ekle("ahsap", {
        pos,
        rot: new THREE.Euler(0, eksenX ? 0 : Math.PI / 2, 0),
        size: new THREE.Vector3(uzunluk, 0.15, 0.17),
        esik: 0.34,
        span: 0.1,
        egim: 0,
        renk: 0.95,
      });
    }
  }

  karkas(true, K.genislik, cikmaZ, 5); // cumba cephesi
  karkas(true, K.genislik, yariD, 4);
  karkas(false, K.derinlik + K.cikma, -yariG, 3);
  karkas(false, K.derinlik + K.cikma, yariG, 3);

  /* ----- sıva dolgu panolar ------------------------------------------ */
  function dolgu(eksenX, uzunluk, merkez, adet) {
    for (let i = 0; i < adet; i++) {
      const genis = uzunluk / adet;
      const u = -uzunluk / 2 + genis * (i + 0.5);
      const pos = eksenX
        ? new THREE.Vector3(u, ustTaban + K.ahsapKat / 2, merkez)
        : new THREE.Vector3(merkez, ustTaban + K.ahsapKat / 2, u);
      set.ekle("siva", {
        pos,
        rot: new THREE.Euler(0, eksenX ? 0 : Math.PI / 2, 0),
        size: new THREE.Vector3(genis - 0.14, K.ahsapKat - 0.22, 0.11),
        esik: 0.6 + rnd() * 0.08,
        span: 0.12,
        egim: 0,
        renk: 0.9 + rnd() * 0.2,
      });
    }
  }
  dolgu(true, K.genislik, cikmaZ + 0.01, 5);
  dolgu(true, K.genislik, yariD - 0.01, 4);
  dolgu(false, K.derinlik + K.cikma, -yariG + 0.01, 3);
  dolgu(false, K.derinlik + K.cikma, yariG - 0.01, 3);

  /* ----- üst kat pencereleri (cumba) --------------------------------- */
  const ustPencereler = [];
  for (let i = -2; i <= 2; i++) {
    ustPencereler.push({ x: i * 1.28, y: ustTaban + K.ahsapKat / 2 + 0.05, z: cikmaZ - 0.06 });
  }
  for (const p of ustPencereler) {
    // cam
    set.ekle("cam", {
      pos: new THREE.Vector3(p.x, p.y, p.z),
      rot: new THREE.Euler(),
      size: new THREE.Vector3(0.82, 1.3, 0.05),
      esik: 0.74,
      span: 0.12,
      egim: 0,
      renk: 1,
    });
    // kepenk (iki kanat)
    for (const yon of [-1, 1]) {
      set.ekle("kepenk", {
        pos: new THREE.Vector3(p.x + yon * 0.62, p.y, p.z - 0.05),
        rot: new THREE.Euler(0, yon * 0.5, 0),
        size: new THREE.Vector3(0.42, 1.32, 0.06),
        esik: 0.86,
        span: 0.1,
        egim: 0,
        renk: 0.95,
      });
    }
  }
  // zemin kat camları
  for (const b of bosluklar) {
    if (b.h > 1.8) continue; // kapı boşluğu camsız
    set.ekle("cam", {
      pos: new THREE.Vector3(b.x, b.y, b.z + (b.z < 0 ? 0.06 : -0.06)),
      rot: new THREE.Euler(),
      size: new THREE.Vector3(b.g - 0.08, b.h - 0.1, 0.05),
      esik: 0.76,
      span: 0.12,
      egim: 0,
      renk: 1,
    });
  }

  /* ----- çatı: mertekler + kiremit sıraları --------------------------- */
  const catiTaban = ustTaban + K.ahsapKat;
  const catiG = K.genislik + K.saçak * 2;
  const catiD = K.derinlik + K.cikma + K.saçak * 2;
  const catiMerkezZ = (-yariD - K.cikma + yariD) / 2;

  // mertekler
  for (let i = -4; i <= 4; i++) {
    set.ekle("ahsap", {
      pos: new THREE.Vector3(i * 0.78, catiTaban + K.catiY * 0.45, catiMerkezZ),
      rot: new THREE.Euler(0, 0, 0),
      size: new THREE.Vector3(0.11, 0.13, catiD * 0.92),
      esik: 0.46 + Math.abs(i) * 0.012,
      span: 0.1,
      egim: 0,
      renk: 0.85,
    });
  }
  // mahya
  set.ekle("ahsap", {
    pos: new THREE.Vector3(0, catiTaban + K.catiY, catiMerkezZ),
    rot: new THREE.Euler(),
    size: new THREE.Vector3(catiG * 0.55, 0.16, 0.18),
    esik: 0.48,
    span: 0.1,
    egim: 0,
    renk: 0.9,
  });

  /* Kırma çatı: dört eğik yüzey. Her yüzey kiremit sıralarıyla kaplanır.
     Kiremitler saçaktan mahyaya doğru sırayla tamamlanır. */
  function catiYuzeyi(yon) {
    // yon: 0 ön, 1 arka, 2 sol, 3 sağ
    const onArka = yon < 2;
    const uzun = onArka ? catiG : catiD;
    const derin = onArka ? catiD / 2 : catiG / 2;
    const isaret = yon === 0 || yon === 2 ? -1 : 1;
    const egim = Math.atan2(K.catiY, derin);
    const siraAdet = Math.max(4, Math.round(derin / 0.36));

    for (let s = 0; s < siraAdet; s++) {
      const o = (s + 0.5) / siraAdet; // saçaktan mahyaya
      const y = catiTaban + K.catiY * o;
      const mesafe = derin * (1 - o);
      const genislikOran = 1 - o * (onArka ? 0.42 : 0.5);
      const adet = Math.max(2, Math.round((uzun * genislikOran) / 0.42));

      for (let i = 0; i < adet; i++) {
        const u = -((uzun * genislikOran) / 2) + ((uzun * genislikOran) / adet) * (i + 0.5);
        const pos = new THREE.Vector3();
        const rot = new THREE.Euler();

        if (onArka) {
          pos.set(u, y, catiMerkezZ + isaret * mesafe);
          rot.set(isaret * -egim, 0, 0);
        } else {
          pos.set(isaret * mesafe, y, catiMerkezZ + u);
          rot.set(0, 0, isaret * egim);
        }

        set.ekle("kiremit", {
          pos,
          rot,
          /* Sıralar arası açıklık ~0.36; eğim nedeniyle izdüşüm
             kısaldığından kiremit boyu daha uzun tutulur ki
             sıralar bindirsin ve çatıda boşluk kalmasın. */
          size: new THREE.Vector3(
            onArka ? 0.48 : 0.46,
            0.09,
            onArka ? 0.46 : 0.48
          ),
          esik: 0.58 + o * 0.3 + rnd() * 0.05,
          span: 0.09,
          egim: 0,
          renk: 0.82 + rnd() * 0.3,
        });
      }
    }
  }
  catiYuzeyi(0);
  catiYuzeyi(1);
  catiYuzeyi(2);
  catiYuzeyi(3);

  /* ----- baca ---------------------------------------------------------- */
  for (let s = 0; s < 7; s++) {
    set.ekle("tas", {
      pos: new THREE.Vector3(-1.9, catiTaban + 0.5 + s * 0.3, catiMerkezZ + 0.9),
      rot: new THREE.Euler(),
      size: new THREE.Vector3(0.62, 0.28, 0.62),
      // Baca yıkıntıda tamamen çökmüştür; çatıyla birlikte örülür
      esik: 0.52 + s * 0.055,
      span: 0.1,
      egim: s < 3 ? (rnd() - 0.5) * 0.16 : 0,
      renk: 0.88,
    });
  }

  /* ----- moloz (başta var, temizlenir) --------------------------------- */
  for (let i = 0; i < (dusuk ? 26 : 42); i++) {
    const aci = rnd() * Math.PI * 2;
    const r = 3.3 + rnd() * 2.2;
    const b = 0.18 + rnd() * 0.3;
    set.ekle("moloz", {
      pos: new THREE.Vector3(Math.cos(aci) * r, b / 2, Math.sin(aci) * r * 0.75),
      rot: new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3),
      size: new THREE.Vector3(b * (1 + rnd()), b, b * (1 + rnd())),
      esik: 0.12 + rnd() * 0.34,
      span: 0.16,
      egim: 0,
      renk: 0.75 + rnd() * 0.35,
      tersine: true, // ilerledikçe kaybolur
    });
  }

  /* ----- yıkıntıdaki ot/çalı (kaybolur) -------------------------------- */
  for (let i = 0; i < (dusuk ? 12 : 22); i++) {
    const aci = rnd() * Math.PI * 2;
    const r = 2.4 + rnd() * 3.6;
    set.ekle("bitki", {
      pos: new THREE.Vector3(
        Math.cos(aci) * r,
        0.16 + rnd() * 1.6,
        Math.sin(aci) * r * 0.7
      ),
      rot: new THREE.Euler(rnd(), rnd() * 3, rnd() * 0.4),
      size: new THREE.Vector3(0.3 + rnd() * 0.3, 0.32 + rnd() * 0.4, 0.3 + rnd() * 0.3),
      esik: 0.08 + rnd() * 0.24,
      span: 0.18,
      egim: 0,
      renk: 0.8 + rnd() * 0.4,
      tersine: true,
    });
  }

  /* ----- iskele (ortada kurulur, sonda sökülür) ------------------------- */
  const iskeleX = yariG + 0.85;
  const iskeleZ = yariD + K.cikma + 0.5;
  const toplamY = catiTaban + 0.6;

  function iskeleDikey(x, z) {
    set.ekle("iskele", {
      pos: new THREE.Vector3(x, toplamY / 2, z),
      rot: new THREE.Euler(),
      size: new THREE.Vector3(0.09, toplamY, 0.09),
      esik: 0.2,
      span: 0.1,
      cikis: 0.78,
      cikisSpan: 0.1,
      egim: 0,
      renk: 1,
    });
  }
  const dikeyler = [];
  for (let i = -2; i <= 2; i++) dikeyler.push([i * 1.55, -iskeleZ + 0.35]);
  for (let i = -2; i <= 2; i++) dikeyler.push([i * 1.55, iskeleZ - 0.35]);
  for (const [x, z] of dikeyler) iskeleDikey(x, z);
  for (const z of [-iskeleZ + 0.35, iskeleZ - 0.35]) {
    for (const x of [-iskeleX, iskeleX]) iskeleDikey(x, z);
  }

  // yatay platformlar
  for (const kat of [1.35, 2.85, 4.3]) {
    for (const z of [-iskeleZ + 0.35, iskeleZ - 0.35]) {
      set.ekle("iskele", {
        pos: new THREE.Vector3(0, kat, z),
        rot: new THREE.Euler(),
        size: new THREE.Vector3(iskeleX * 2, 0.07, 0.34),
        esik: 0.24,
        span: 0.1,
        cikis: 0.74,
        cikisSpan: 0.1,
        egim: 0,
        renk: 1,
      });
    }
    for (const x of [-iskeleX, iskeleX]) {
      set.ekle("iskele", {
        pos: new THREE.Vector3(x, kat, 0),
        rot: new THREE.Euler(0, Math.PI / 2, 0),
        size: new THREE.Vector3(iskeleZ * 2, 0.07, 0.34),
        esik: 0.26,
        span: 0.1,
        cikis: 0.72,
        cikisSpan: 0.1,
        egim: 0,
        renk: 1,
      });
    }
  }

  /* ==================================================================
     Malzemeler ve InstancedMesh'ler
     ================================================================== */
  const kutu = new THREE.BoxGeometry(1, 1, 1);

  const malzemeler = {
    tas: new THREE.MeshStandardMaterial({ color: 0xb9ad96, roughness: 0.93, metalness: 0 }),
    ahsap: new THREE.MeshStandardMaterial({ color: 0x6b4b32, roughness: 0.85, metalness: 0 }),
    siva: new THREE.MeshStandardMaterial({ color: 0xd9d0bd, roughness: 0.95, metalness: 0 }),
    kiremit: new THREE.MeshStandardMaterial({ color: 0x9c5638, roughness: 0.88, metalness: 0 }),
    cam: new THREE.MeshStandardMaterial({
      color: 0x1a1a1c,
      roughness: 0.18,
      metalness: 0.1,
      emissive: 0xffab5e,
      emissiveIntensity: 0,
    }),
    kepenk: new THREE.MeshStandardMaterial({ color: 0x4d6157, roughness: 0.8, metalness: 0 }),
    moloz: new THREE.MeshStandardMaterial({ color: 0x8d8577, roughness: 1, metalness: 0 }),
    bitki: new THREE.MeshStandardMaterial({ color: 0x4a5333, roughness: 1, metalness: 0 }),
    iskele: new THREE.MeshStandardMaterial({
      color: 0xb08a55,
      roughness: 0.7,
      metalness: 0.15,
      transparent: true,
      opacity: 1,
    }),
  };

  const meshler = {};
  for (const [ad, mat] of Object.entries(malzemeler)) {
    const parcalar = set.al(ad);
    if (!parcalar.length) continue;
    const mesh = new THREE.InstancedMesh(kutu, mat, parcalar.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = !dusuk && ad !== "cam" && ad !== "iskele";
    mesh.receiveShadow = !dusuk;
    mesh.frustumCulled = false;

    /* Her parçaya hafif ton sapması.
       instanceColor GPU'da malzeme rengiyle ÇARPILIR; buraya rengin
       kendisi yazılırsa renk iki kez uygulanıp yüzey kararır.
       Bu yüzden yalnızca 1 civarında bir katsayı yazıyoruz. */
    const renkler = new Float32Array(parcalar.length * 3);
    parcalar.forEach((p, i) => {
      renkler[i * 3] = p.renk;
      renkler[i * 3 + 1] = p.renk;
      renkler[i * 3 + 2] = p.renk;
    });
    mesh.instanceColor = new THREE.InstancedBufferAttribute(renkler, 3);

    scene.add(mesh);
    meshler[ad] = { mesh, parcalar };
  }

  /* ==================================================================
     İlerleme uygulaması
     ================================================================== */
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();

  let ilerleme = 0;
  let uygulanan = -1;

  function parcalariGuncelle(t) {
    for (const ad in meshler) {
      const { mesh, parcalar } = meshler[ad];
      for (let i = 0; i < parcalar.length; i++) {
        const p = parcalar[i];
        let k;

        if (p.tersine) {
          // moloz / ot: ilerledikçe küçülüp kaybolur
          k = 1 - smoothstep(p.esik, p.esik + p.span, t);
        } else if (p.cikis !== undefined) {
          // iskele: gelir ve gider
          k =
            smoothstep(p.esik, p.esik + p.span, t) *
            (1 - smoothstep(p.cikis, p.cikis + p.cikisSpan, t));
        } else {
          k = smoothstep(p.esik, p.esik + p.span, t);
        }

        // Yıkıntı hâlindeki taşlar tam oturmamış görünsün
        const oturma = p.egim ? p.egim * (1 - smoothstep(0.3, 0.62, t)) : 0;

        _e.set(p.rot.x + oturma, p.rot.y, p.rot.z + oturma * 0.6);
        _q.setFromEuler(_e);
        _p.copy(p.pos);
        _p.y -= (1 - k) * 0.12; // belirirken hafifçe otursun
        _s.set(p.size.x * k, p.size.y * k, p.size.z * k);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  const _renkSoguk = new THREE.Color();
  const _renkSicak = new THREE.Color();

  function atmosferGuncelle(t) {
    const y = smoothstep(0.1, 0.95, t);

    // arka plan + sis
    _renkSoguk.copy(gokSoguk).lerp(gokSicak, y);
    renderer.setClearColor(_renkSoguk, 1);
    scene.fog.color.copy(_renkSoguk);

    // güneş: soğuk gri → sıcak altın
    _renkSicak.setHex(0xbcd0dd).lerp(new THREE.Color(0xffd9a3), y);
    gunes.color.copy(_renkSicak);
    gunes.intensity = lerp(1.05, 1.9, y);
    gunes.position.set(lerp(-8, -6, y), lerp(7, 10, y), lerp(4, 7.5, y));

    gokIsik.intensity = lerp(0.85, 1.05, y);
    gokIsik.color.setHex(0x9fb4c4).lerp(new THREE.Color(0xffe4c4), y);
    ambiyans.intensity = lerp(0.6, 0.7, y);

    // içeriden sızan ışık en sonda yanar
    const isikK = smoothstep(0.84, 1, t);
    icIsik.intensity = isikK * 3.2;
    malzemeler.cam.emissiveIntensity = isikK * 1.15;

    // taş ve ahşap yıkıntıda soluk, restore edildikçe canlanır
    malzemeler.tas.color.setHex(0xa79f8e).lerp(new THREE.Color(0xd6cab0), y);
    malzemeler.ahsap.color.setHex(0x5d4a38).lerp(new THREE.Color(0x8d6440), y);
    malzemeler.kiremit.color.setHex(0x815944).lerp(new THREE.Color(0xbb6941), y);
    malzemeler.siva.color.setHex(0xbdb5a4).lerp(new THREE.Color(0xe4dcc9), y);
    malzemeler.moloz.color.setHex(0x9b9484).lerp(new THREE.Color(0xa9a08e), y);
    zeminMat.color.setHex(0x3d3a33).lerp(new THREE.Color(0x554e3e), y);

    // iskele saydamlığı
    const iskeleK =
      smoothstep(0.18, 0.3, t) * (1 - smoothstep(0.72, 0.88, t));
    malzemeler.iskele.opacity = iskeleK;
    if (meshler.iskele) meshler.iskele.mesh.visible = iskeleK > 0.01;
  }

  /* ------------------------------------------------------------ kamera */
  let fareX = 0;
  let fareY = 0;
  let hedefFareX = 0;
  let hedefFareY = 0;

  /* Geniş ekranlarda metin solda durduğu için bakış noktasını sola
     kaydırıp modeli sağ yarıya yerleştiriyoruz. */
  let bakisX = 0;
  let dikeyEkran = false;
  let gerekliMesafe = 0;
  const _hedef = new THREE.Vector3();

  function kompozisyonuAyarla() {
    const oran = (genislik || 1) / Math.max(yukseklikPx, 1);
    dikeyEkran = oran < 0.85;

    // Dar/dikey ekranda daha geniş görüş açısı gerekir
    camera.fov = dikeyEkran ? 52 : 38;
    camera.updateProjectionMatrix();

    // Metin solda olduğunda modeli sağ yarıya kaydır
    bakisX = oran > 1.15 ? -2.6 : oran > 0.85 ? -1.1 : 0;

    /* Yapının yatay olarak çerçeveye sığması için gereken en küçük
       mesafe. Dikey ekranlarda yatay görüş açısı çok daraldığından
       bu değer temel mesafenin önüne geçer. */
    const yariHedef = 4.9; // yapı yarı genişliği + pay
    const dikeyTan = Math.tan(((camera.fov * Math.PI) / 180) / 2);
    const yatayTan = dikeyTan * camera.aspect;
    gerekliMesafe = yariHedef / Math.max(yatayTan, 0.05);
  }

  function kameraGuncelle(t, zaman) {
    const y = smoothstep(0, 1, t);
    const aci = lerp(-0.66, -0.18, y) + Math.sin(zaman * 0.00008) * 0.03;
    /* Yıkıntıda alçak ve yakın (kalıntı ezici görünsün), restore
       edildikçe geri çekilip yükselerek yapıyı bütün olarak gösterir. */
    const mesafe = Math.max(lerp(13.5, 17.5, y), gerekliMesafe);
    const yukseklik = lerp(2.9, 4.8, y) * (dikeyEkran ? 1.35 : 1);

    camera.position.set(
      Math.sin(aci) * mesafe + bakisX + fareX * 0.9,
      yukseklik + fareY * 0.55,
      Math.cos(aci) * mesafe
    );
    // Dikey ekranda bakış noktasını indirip modeli üst yarıda tutuyoruz
    _hedef.set(bakisX, lerp(1.5, 3.1, y) - (dikeyEkran ? 1.3 : 0), 0);
    camera.lookAt(_hedef);
  }

  /* ------------------------------------------------------------ döngü */
  let calisiyor = false;
  let rafId = 0;
  let genislik = 0;
  let yukseklikPx = 0;

  function boyutla() {
    const r = canvas.getBoundingClientRect();
    genislik = Math.max(1, r.width);
    yukseklikPx = Math.max(1, r.height);
    renderer.setSize(genislik, yukseklikPx, false);
    camera.aspect = genislik / yukseklikPx;
    camera.updateProjectionMatrix();
    kompozisyonuAyarla();
  }

  function cerceve(zaman) {
    if (!calisiyor) return;
    rafId = requestAnimationFrame(cerceve);

    fareX += (hedefFareX - fareX) * 0.05;
    fareY += (hedefFareY - fareY) * 0.05;

    if (Math.abs(ilerleme - uygulanan) > 0.0008) {
      parcalariGuncelle(ilerleme);
      atmosferGuncelle(ilerleme);
      uygulanan = ilerleme;
    }

    kameraGuncelle(ilerleme, zaman);
    renderer.render(scene, camera);
  }

  function fareHareket(e) {
    hedefFareX = (e.clientX / window.innerWidth - 0.5) * 2;
    hedefFareY = -(e.clientY / window.innerHeight - 0.5) * 2;
  }

  /* ------------------------------------------------------------- API */
  boyutla();
  parcalariGuncelle(0);
  atmosferGuncelle(0);
  kameraGuncelle(0, 0);
  renderer.render(scene, camera);

  if (!dusuk) window.addEventListener("mousemove", fareHareket, { passive: true });

  return {
    setProgress(t) {
      ilerleme = Math.min(Math.max(t, 0), 1);
    },
    resize: boyutla,
    start() {
      if (calisiyor) return;
      calisiyor = true;
      rafId = requestAnimationFrame(cerceve);
    },
    stop() {
      calisiyor = false;
      cancelAnimationFrame(rafId);
    },
    dispose() {
      this.stop();
      window.removeEventListener("mousemove", fareHareket);
      kutu.dispose();
      Object.values(malzemeler).forEach((m) => m.dispose());
      Object.values(meshler).forEach(({ mesh }) => mesh.dispose());
      zeminMat.dispose();
      renderer.dispose();
    },
  };
}
