#!/usr/bin/env python3
"""Geçici görsel üretici.

Ofisin gerçek fotoğrafları hazır olana kadar sitede kullanılan tüm görseller
bu betikle üretilen SVG yer tutucularıdır. Tarihi yapı cephelerini soyutlayan
(kemer, söve, taş sıraları, ahşap doğrama) kompozisyonlar üretir.

Kullanım:  python3 tools/generate-placeholders.py
Çıktı:     assets/img/*.svg

Gerçek fotoğraflarla değiştirmek için assets/img/README.md dosyasına bakın.
"""

from __future__ import annotations

import os
import random
from dataclasses import dataclass

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "img")


@dataclass(frozen=True)
class Palette:
    name: str
    sky_top: str
    sky_bottom: str
    facade: str
    facade_dark: str
    facade_light: str
    opening: str
    accent: str
    ground: str


PALETTES = [
    Palette("stone", "#d9d2c4", "#efeae0", "#cdc3b1", "#a89a84", "#e2dccf", "#3a332b", "#a9764a", "#bdb3a1"),
    Palette("dusk", "#2b241d", "#4a3d30", "#5c4c3c", "#3a2f25", "#7a6650", "#17120e", "#c49a6f", "#241d17"),
    Palette("lime", "#e7e1d4", "#f5f2ec", "#ded5c3", "#b6a992", "#efe9dc", "#443a30", "#a9764a", "#cbc0ad"),
    Palette("terra", "#e3d4c2", "#f2e9dc", "#d3b99c", "#ab8a68", "#e9dbc8", "#402f22", "#8c5a34", "#c4a888"),
    Palette("slate", "#cfd0cb", "#e8e8e4", "#b9bab3", "#8d8e87", "#dcdcd6", "#2c2e2a", "#a9764a", "#a8a9a2"),
]


def grain_defs(seed: int, opacity: float = 0.14) -> str:
    """Fotoğraf hissi veren ince gren dokusu."""
    return f"""
  <filter id="grain{seed}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="{seed}" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="{opacity}"/></feComponentTransfer>
  </filter>"""


def facade(w: int, h: int, p: Palette, rng: random.Random, seed: int) -> str:
    """Kemerli ve düşey ritimli soyut tarihi cephe kompozisyonu."""
    parts: list[str] = []

    # Gökyüzü / arka plan
    parts.append(
        f'<rect width="{w}" height="{h}" fill="url(#sky{seed})"/>'
    )

    # Uzaktaki ikincil kütle
    bw = int(w * rng.uniform(0.34, 0.5))
    bh = int(h * rng.uniform(0.42, 0.6))
    bx = 0 if rng.random() < 0.5 else w - bw
    parts.append(
        f'<rect x="{bx}" y="{h - bh}" width="{bw}" height="{bh}" fill="{p.facade_dark}" opacity="0.55"/>'
    )

    # Ana kütle
    mw = int(w * rng.uniform(0.62, 0.82))
    mh = int(h * rng.uniform(0.6, 0.82))
    mx = int((w - mw) * rng.uniform(0.15, 0.85))
    my = h - mh
    parts.append(f'<rect x="{mx}" y="{my}" width="{mw}" height="{mh}" fill="{p.facade}"/>')

    # Taş sıraları
    course = max(10, int(mh / rng.randint(11, 18)))
    y = my + course
    while y < h:
        parts.append(
            f'<line x1="{mx}" y1="{y}" x2="{mx + mw}" y2="{y}" stroke="{p.facade_dark}" '
            f'stroke-width="1" opacity="0.28"/>'
        )
        y += course

    # Saçak / kornis
    cor = max(8, int(mh * 0.035))
    parts.append(
        f'<rect x="{mx - cor // 2}" y="{my}" width="{mw + cor}" height="{cor}" fill="{p.facade_light}"/>'
    )
    parts.append(
        f'<rect x="{mx - cor // 2}" y="{my + cor}" width="{mw + cor}" height="{max(2, cor // 3)}" '
        f'fill="{p.facade_dark}" opacity="0.5"/>'
    )

    # Açıklıklar: alt sıra kemerli, üst sıralar dikdörtgen
    cols = rng.randint(3, 5)
    rows = rng.randint(2, 3)
    pad = mw * 0.09
    gap = (mw - 2 * pad) / cols
    ow = gap * 0.52
    band_top = my + cor * 2.2
    band_h = (h - band_top) * 0.86
    row_h = band_h / rows

    for r in range(rows):
        oh = row_h * (0.62 if r < rows - 1 else 0.78)
        oy = band_top + r * row_h + (row_h - oh) * 0.4
        arched = r == rows - 1
        for c in range(cols):
            ox = mx + pad + c * gap + (gap - ow) / 2
            if arched:
                rad = ow / 2
                body = oh - rad
                d = (
                    f"M{ox:.1f},{oy + oh:.1f} L{ox:.1f},{oy + rad:.1f} "
                    f"A{rad:.1f},{rad:.1f} 0 0 1 {ox + ow:.1f},{oy + rad:.1f} "
                    f"L{ox + ow:.1f},{oy + oh:.1f} Z"
                )
                parts.append(f'<path d="{d}" fill="{p.opening}" opacity="0.88"/>')
                parts.append(
                    f'<path d="{d}" fill="none" stroke="{p.facade_light}" stroke-width="2.5" opacity="0.75"/>'
                )
                _ = body
            else:
                parts.append(
                    f'<rect x="{ox:.1f}" y="{oy:.1f}" width="{ow:.1f}" height="{oh:.1f}" '
                    f'fill="{p.opening}" opacity="0.85"/>'
                )
                parts.append(
                    f'<rect x="{ox - 3:.1f}" y="{oy - 3:.1f}" width="{ow + 6:.1f}" height="{oh + 6:.1f}" '
                    f'fill="none" stroke="{p.facade_light}" stroke-width="3" opacity="0.7"/>'
                )
                # Düşey kayıt (doğrama)
                parts.append(
                    f'<line x1="{ox + ow / 2:.1f}" y1="{oy:.1f}" x2="{ox + ow / 2:.1f}" '
                    f'y2="{oy + oh:.1f}" stroke="{p.facade_light}" stroke-width="1.5" opacity="0.5"/>'
                )

    # Zemin
    gh = int(h * 0.06)
    parts.append(f'<rect x="0" y="{h - gh}" width="{w}" height="{gh}" fill="{p.ground}"/>')

    # Işık huzmesi
    parts.append(
        f'<rect width="{w}" height="{h}" fill="url(#light{seed})" style="mix-blend-mode:soft-light"/>'
    )

    # İskele / ölçü çizgisi vurgusu (restorasyon göndermesi)
    if rng.random() < 0.55:
        lx = mx + mw * rng.uniform(0.08, 0.7)
        parts.append(
            f'<line x1="{lx:.0f}" y1="{my:.0f}" x2="{lx:.0f}" y2="{h - gh:.0f}" '
            f'stroke="{p.accent}" stroke-width="1.5" stroke-dasharray="6 7" opacity="0.65"/>'
        )

    return "\n  ".join(parts)


def build_svg(w: int, h: int, p: Palette, seed: int, label: str) -> str:
    rng = random.Random(seed)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{label}" preserveAspectRatio="xMidYMid slice">
  <title>{label}</title>
  <defs>
    <linearGradient id="sky{seed}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{p.sky_top}"/>
      <stop offset="100%" stop-color="{p.sky_bottom}"/>
    </linearGradient>
    <linearGradient id="light{seed}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>
    </linearGradient>{grain_defs(seed)}
  </defs>
  {facade(w, h, p, rng, seed)}
  <rect width="{w}" height="{h}" filter="url(#grain{seed})" opacity="0.6"/>
</svg>
"""


FILES = [
    # (dosya adı, genişlik, yükseklik, palet indeksi, tohum, erişilebilirlik metni)
    ("hero.svg", 1920, 1200, 1, 11, "Restore edilmis tarihi yapi cephesi"),
    ("hero-hakkimizda.svg", 1920, 900, 1, 21, "Tarihi yapi detayi"),
    ("hero-hizmetler.svg", 1920, 900, 1, 22, "Restorasyon uygulama alani"),
    ("hero-projeler.svg", 1920, 900, 1, 23, "Proje arsivi gorseli"),
    ("hero-iletisim.svg", 1920, 900, 1, 24, "Ofis calisma alani"),
    ("about-1.svg", 1000, 1250, 2, 31, "Rolove calismasi"),
    ("about-2.svg", 1000, 1000, 4, 32, "Malzeme detayi"),
    ("proje-01.svg", 1000, 1250, 0, 41, "Kemeralti tarihi ticaret yapisi"),
    ("proje-02.svg", 1000, 1250, 3, 42, "Alacati tas konak"),
    ("proje-03.svg", 1000, 1250, 4, 43, "Basmane koskUu"),
    ("proje-04.svg", 1000, 1250, 2, 44, "Tire geleneksel konut"),
    ("proje-05.svg", 1000, 1250, 0, 45, "Bergama sivil mimarlik ornegi"),
    ("proje-06.svg", 1000, 1250, 3, 46, "Urla bag evi"),
    ("galeri-01.svg", 1600, 1000, 0, 51, "Proje galeri gorseli"),
    ("galeri-02.svg", 1200, 900, 2, 52, "Proje galeri gorseli"),
    ("galeri-03.svg", 1200, 900, 4, 53, "Proje galeri gorseli"),
    ("galeri-04.svg", 1200, 900, 3, 54, "Proje galeri gorseli"),
]


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, w, h, pi, seed, label in FILES:
        svg = build_svg(w, h, PALETTES[pi], seed, label)
        with open(os.path.join(OUT_DIR, name), "w", encoding="utf-8") as fh:
            fh.write(svg)
        print("yazildi:", name)


if __name__ == "__main__":
    main()
