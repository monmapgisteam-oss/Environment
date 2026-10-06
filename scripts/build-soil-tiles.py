"""Хөрсний зүсэлтийн ФОТО ХАВТАНЦАР — жишиг зургаас давхарга бүрийн
залгаасгүй 512×256 (160×80 см) хэсэг огтолж нэг спрайт болгоно.

Эх сурвалж: хэрэглэгчийн өгсөн "Generalized soil profile diagram"
(LotusArise, 2026-10-06 — `C:/Users/ln9nr/OneDrive/Pictures/`), 1448×1086.
Блокийн УРД НҮҮРЭЭС (x 181–738) зургаан давхарга: O (навчны үлдэгдэл),
A (бараан ялзмаг, үндэс), E (цайвар нунтаг), B (улаан бор, жижиг чулуу),
C (бөөрөнхий сайр), R (хад). Өнгө нь ЭНДЭЭС АВАГДАХГҮЙ — хөтөч дээр
Монголын ангиллын өнгөөр дахин будагдана (`soil-texture.ts`): зөвхөн
БҮТЭЦ (гэрэлтэлтийн хэлбэлзэл) нь энэ зургаас.

Хэвтээд: зүүн зурвас нь баруун үргэлжлэлтэйгээ уусна (crossfade).
Босоод: давхарга богино тул хэсэг + түүний хэвтээ эргүүлсэн хуулбарыг
уусгаж давхарлана — толин тэгш хэм үүсэхгүй.

Гаралт: public/data/soil-tiles.jpg — 512 × (256 × 6), дараалал O A E B C R.
Эх сурвалж байхгүй машин дээр ЧИМЭЭГҮЙ гарна (бүтээлт унахгүй).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path("C:/Users/ln9nr/OneDrive/Pictures/Generalized-soil-profile-diagram-LotusArise.webp")
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "soil-tiles.jpg"
TW, TH = 512, 256
ORDER = ["O", "A", "E", "B", "C", "R"]
#        y0,  y1,  x0,  x1,  хэвтээ уусгалт, босоо уусгалт (px)
ROWS = {
    "O": (127, 193, 181, 738, 60, 14),
    "A": (193, 316, 181, 738, 60, 26),
    "E": (326, 452, 181, 480, 40, 40),  # ⚠ «eluviation» сум, бичиг (x 486–621) ОРОХГҮЙ — доор хоёр хэсгээс нийлнэ
    "B": (454, 652, 181, 738, 60, 36),
    "C": (652, 790, 181, 738, 60, 30),
    "R": (790, 929, 181, 738, 60, 28),
}

if not SRC.exists():
    print(f"эх сурвалж алга ({SRC}) — алгаслаа")
    sys.exit(0)

im = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)


def seamless_h(a, b):
    """H×W -> H×(W-b): [0,b) зурвас нь баруун захын үргэлжлэлтэйгээ уусна."""
    w = a.shape[1] - b
    out = a[:, :w].copy()
    t = (1 - np.arange(b) / b)[None, :, None]
    out[:, :b] = t * a[:, w : w + b] + (1 - t) * a[:, :b]
    return out


def stack_v(a, bv):
    """a ба hflip(a)-г bv мөрөөр давхцуулж уусгана; дээд, доод зах ч уусгагдсан."""
    h = a.shape[0]
    f = a[:, ::-1]
    t = (np.arange(bv) / bv)[:, None, None]
    mid = (1 - t) * a[h - bv :] + t * f[:bv]
    end = (1 - t) * f[h - bv :] + t * a[:bv]
    return np.concatenate([a[bv : h - bv], mid, f[bv : h - bv], end], axis=0)


def band(k):
    """Давхаргын түүхий хэсэг; E нь сумны хоёр талын цэвэр хэсгийг уусгаж залгасан
    (нэг хэсэг нь 249 px байхад 512 болгож сунгахад даавуу шиг судалтай болж байв)."""
    y0, y1, x0, x1, _, _ = ROWS[k]
    a = im[y0:y1, x0:x1]
    if k != "E":
        return a
    b = im[y0:y1, 630:738]
    j = 30
    t = (np.arange(j) / j)[None, :, None]
    mid = (1 - t) * a[:, -j:] + t * b[:, :j]
    return np.concatenate([a[:, :-j], mid, b[:, j:]], axis=1)


def flatten(a, sigma=38):
    """Том хэмжээний гэрэлтэлтийн налууг (блокийн захын сүүдэр, виньет) хасна —
    эс тэгвээс уусгасан зааг нь давталт бүрд бараан зурвас болж харагдана
    (2×2 давталтаар шалгахад тор мэт байв). Дундаж гэрэлтэлт хэвээр;
    том хэмжээний хэлбэлзлийг хөтөч өөрөө нэмнэ (`photoMatrix`)."""
    from PIL import ImageFilter

    lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    blur = np.asarray(Image.fromarray(lum.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sigma))).astype(np.float32)
    gain = (lum.mean() / np.maximum(blur, 1))[:, :, None]
    return a * np.clip(gain, 0.6, 1.6)


sheet = Image.new("RGB", (TW, TH * len(ORDER)))
for i, k in enumerate(ORDER):
    y0, y1, x0, x1, bh, bv = ROWS[k]
    t = stack_v(seamless_h(flatten(band(k)), bh), bv)
    tile = Image.fromarray(t.clip(0, 255).astype(np.uint8)).resize((TW, TH), Image.LANCZOS)
    sheet.paste(tile, (0, i * TH))
    print(k, f"{t.shape[1]}×{t.shape[0]} px → 512×256")
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, "JPEG", quality=90, optimize=True)
print(f"{OUT} · {OUT.stat().st_size // 1024} КБ")
