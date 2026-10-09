"""Үерийн симуляцийн ГАЗРЫН ГАДАРГА — DEM-ийн нөхцөлжүүлэлт ба голын суваг (2026-10-09).

Хэрэглэгч 2026-10-09: "далан барьсан юм шиг урсаад байна … бороо орохоор
хонхор газар ус тогтоно … байшинг тойроод ус уруу газар луу урсана".
Хоёр алдааг засна (`Flood_envi/tools/build_data.py`, `burn_rivers.py`-ийн
оронд, зөвхөн `dem.f32`, `riv.u8.gz`, `meta.json`-ийг дахин бичнэ):

1. ХОТГОР ДҮҮРГЭЛТ: урьд нь барилгажсан нүдэнд 3 м хүртэлх БҮХ хотгор
   (`priority_flood`-оор) дүүргэгддэг байсан тул хотод ус тогтох газар
   үлдээгүй (хотгор нүд 20,365 → 214). Одоо зөвхөн DSM-ийн ШУУГИАН:
   талбай нь ≤ 6 DEM нүд (≈5,400 м²) эсвэл гүн нь ≤ 0.3 м хотгор бүтэн
   дүүрнэ; хотын илүү том хотгорыг 1 м гүнтэй цөөрөм болгон хязгаарлана
   (DSM-ийн байшингийн сүүдэр 2–3 м нүх гаргадаг); хотоос гадуурх том
   хотгор (нуур, хуучин голдирол) хэвээр.
2. СУВАГ: OSM-ийн 2,364 горхи, 425 шуудуу/суваг 1–2 нүдний өргөнтэй,
   0.4–6 м гүн ШУЛУУН ШУУДУУ болж зүсэгддэг байсан — ус тэдгээрээр далан
   барьсан мэт шулуун урсдаг байв. Одоо ЗӨВХӨН `waterway=river` (Туул,
   Сэлбэ, Улиастай …). Жижиг хөндийн урсгалыг рельеф өөрөө цуглуулна.

Эх сурвалж РЕПОГООС ГАДНА (`I:/Environment/Flood_envi/Flood_envi/raw`:
Copernicus GLO-30 хавтан, `osm_waterways.json`). Байхгүй машин дээр
ЧИМЭЭГҮЙ гарна. Барилга, газрын бүрхэвч (`bld.u8.gz`, `lc.u8.gz`) нь
`public/flood/data`-аас уншигдана — хөндөгдөхгүй.

usage: python scripts/build-flood-terrain.py
"""
import gzip, heapq, json, os, sys
from pathlib import Path

import numpy as np

RAW = Path("I:/Environment/Flood_envi/Flood_envi/raw")
DATA = Path(__file__).resolve().parent.parent / "public" / "flood" / "data"
if not (RAW / "osm_waterways.json").exists():
    print("flood terrain: эх сурвалж олдсонгүй, алгаслаа"); sys.exit(0)

import rasterio
from rasterio.merge import merge
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject, transform as _tr
from scipy import ndimage

SMALL, SHALLOW, URBAN_CAP = 6, 0.3, 1.0        # DEM нүд, м, м
BASE = {"river": (25, 2)}                      # dm, өргөн (нарийн нүд)
MAX_BREACH = 6.0
STEP = 5.0

m = json.load(open(DATA / "meta.json", encoding="utf-8"))
W, H, RES, F, DW, DH = m["W"], m["H"], m["res"], m["demF"], m["demW"], m["demH"]
bld = np.frombuffer(gzip.open(DATA / "bld.u8.gz").read(), np.uint8).reshape(H, W)
lc = np.frombuffer(gzip.open(DATA / "lc.u8.gz").read(), np.uint8).reshape(H, W)


def priority_flood(z, eps=1e-3):
    """Depression filling from the domain edge (Barnes et al. 2014) with an epsilon gradient."""
    h, w = z.shape
    f = z.astype(np.float64).copy(); seen = np.zeros((h, w), bool); pq = []
    for r in range(h):
        for c in (0, w - 1):
            if not seen[r, c]: seen[r, c] = True; pq.append((f[r, c], r, c))
    for c in range(1, w - 1):
        for r in (0, h - 1): seen[r, c] = True; pq.append((f[r, c], r, c))
    heapq.heapify(pq)
    while pq:
        e, r, c = heapq.heappop(pq)
        for rr, cc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= rr < h and 0 <= cc < w and not seen[rr, cc]:
                seen[rr, cc] = True
                if f[rr, cc] <= e: f[rr, cc] = e + eps
                heapq.heappush(pq, (f[rr, cc], rr, cc))
    return f


# ---------------------------------------------------------------- DEM (build_data.py-тай ЯГ ИЖИЛ)
step = RES * F
srcs = [rasterio.open(RAW / f"Copernicus_DSM_COG_10_{a}_00_{b}_00_DEM.tif") for a in ("N47", "N48") for b in ("E106", "E107")]
mos, mtr = merge(srcs)
dem = np.zeros((DH, DW), np.float32)
reproject(mos[0], dem, src_transform=mtr, src_crs="EPSG:4326", dst_transform=from_origin(m["x0"], m["y1"], step, step),
          dst_crs="EPSG:3857", resampling=Resampling.cubic)
bh = bld.astype(np.float32).reshape(DH, F, DW, F)
cover = (bh > 0).mean(axis=(1, 3))
hmean = np.where(cover > 0, bh.sum(axis=(1, 3)) / np.maximum((bh > 0).sum(axis=(1, 3)), 1), 0)
hole = ndimage.binary_dilation((cover > 0.25) & (hmean >= 9), iterations=1)
known = ~hole
val = np.where(known, dem, 0.0).astype(np.float32); wt = known.astype(np.float32)
k = np.array([[0.5, 1, 0.5], [1, 1, 1], [0.5, 1, 0.5]], np.float32)
est = dem.copy()
for _ in range(60):
    num = ndimage.convolve(val, k, mode="nearest"); den = ndimage.convolve(wt, k, mode="nearest")
    upd = hole & (den > 0); est[upd] = num[upd] / den[upd]
    val = np.where(hole, est * (den > 0), val); wt = np.where(hole, (den > 0).astype(np.float32), wt)
dem = np.where(hole, np.minimum(est, dem), dem)
dem[~hole] -= (0.5 * cover * hmean)[~hole].astype(np.float32)

# ---------------------------------------------------------------- хотгор: шуугианыг л дүүргэнэ
urban = ((lc.reshape(DH, F, DW, F) == 50) | (bld.reshape(DH, F, DW, F) > 0)).mean(axis=(1, 3))
z = dem.astype(np.float64)
filled = priority_flood(z)
d = filled - z
lab, n = ndimage.label(d > 1e-4)
idx = np.arange(1, n + 1)
area = ndimage.sum(np.ones_like(d), lab, idx)
maxd = ndimage.maximum(d, lab, idx)
urb = ndimage.mean(urban, lab, idx)
full = np.zeros(n + 1, bool); full[1:] = (area <= SMALL) | (maxd <= SHALLOW)
capd = np.zeros(n + 1, bool); capd[1:] = ~full[1:] & (urb > 0.3)
fm, cm = full[lab], capd[lab]
z[fm] = filled[fm]
# хотгорын гүнийг ХАРЬЦААГААР шахна (ёроолыг тэгшлэхгүй): `filled - 1 м` гэж тайрахад том хотгорын
# ёроол тэгш тавцан болж, ус жигд нимгэн цайвар давхарга болон тархдаг байв (хэрэглэгч: "цэнхэр худлаа")
scale = np.ones(n + 1); scale[1:] = np.minimum(1.0, URBAN_CAP / np.maximum(maxd, 1e-6))
z[cm] = filled[cm] - d[cm] * scale[lab][cm]
print(f"depressions {n}: filled {int(full[1:].sum())}, urban capped at {URBAN_CAP} m {int(capd[1:].sum())}, kept {int((~full[1:] & ~capd[1:]).sum())}")
dem = z.astype(np.float32)
dem.astype("<f4").tofile(DATA / "dem.f32")
dem = dem.astype(np.float64)


class _T:
    @staticmethod
    def transform(x, y): return _tr("EPSG:4326", "EPSG:3857", list(x), list(y))


to_merc = _T()
osm = json.load(open(RAW / "osm_waterways.json", encoding="utf-8"))
OUT = DATA


def dem_at(fx, fy):
    """Bilinear DEM at fine-grid coordinates (same sampling the solver uses)."""
    dx = (fx + 0.5) / F - 0.5
    dy = (fy + 0.5) / F - 0.5
    x0 = np.clip(np.floor(dx).astype(int), 0, m["demW"] - 1)
    y0 = np.clip(np.floor(dy).astype(int), 0, m["demH"] - 1)
    x1 = np.clip(x0 + 1, 0, m["demW"] - 1)
    y1 = np.clip(y0 + 1, 0, m["demH"] - 1)
    tx = np.clip(dx - x0, 0, 1)
    ty = np.clip(dy - y0, 0, 1)
    return (dem[y0, x0] * (1 - tx) + dem[y0, x1] * tx) * (1 - ty) + (dem[y1, x0] * (1 - tx) + dem[y1, x1] * tx) * ty


riv = np.zeros((H, W), np.uint8)
stats = {"lines": 0, "reversed": 0, "breached_m": 0.0, "capped": 0}
tuul_pts = []
TUUL = ("Туул", "Tuul")
# ТУУЛ Ч ЗҮСЭГДЭХГҮЙ (хэрэглэгч 2026-10-09: "tuuliig bas boliul") — ArcGIS Pro шиг ямар ч суваг
# зүсэхгүй; `riv.u8.gz` бүхэлдээ тэг. Туулын шугам зөвхөн гаднаас орох урсацын цэгийг (`tuulInflow`) олоход.
BURN = False
# ЗӨВХӨН ТУУЛ ГОЛ (2026-10-09): Сэлбэ, Улиастай зэрэг жижиг голыг 20 м өргөн, хэдэн метр гүн шуудуу
# болгон зүсэхэд хөндийд тархах ёстой ус бүхэлдээ тэр шуудуунд цугладаг байв (ArcGIS Pro-той харьцуулсан).
# Туул нь гаднаас орох урсацыг (`tuulInflow`) дамжуулах суваг тул үлдэнэ.
order = sorted((e for e in osm["elements"] if e["tags"].get("waterway") in BASE and "geometry" in e
                and any(t in (e["tags"].get("name") or "") for t in TUUL)),
               key=lambda e: BASE[e["tags"]["waterway"]][0])          # deeper channels drawn last
for e in order:
    kind = e["tags"]["waterway"]
    base, width = BASE[kind]
    xs, ys = to_merc.transform([p["lon"] for p in e["geometry"]], [p["lat"] for p in e["geometry"]])
    fx = (np.asarray(xs) - m["x0"]) / RES
    fy = (m["y1"] - np.asarray(ys)) / RES
    # densify
    seg = np.hypot(np.diff(fx), np.diff(fy)) * RES
    n = np.maximum(1, np.ceil(seg / STEP).astype(int))
    px = np.concatenate([np.linspace(fx[i], fx[i + 1], n[i], endpoint=False) for i in range(len(seg))] + [fx[-1:]])
    py = np.concatenate([np.linspace(fy[i], fy[i + 1], n[i], endpoint=False) for i in range(len(seg))] + [fy[-1:]])
    inside = (px >= 0) & (py >= 0) & (px < W) & (py < H)
    if inside.sum() < 2:
        continue
    px, py = px[inside], py[inside]
    z = dem_at(px, py)
    # flow direction from the terrain (OSM direction is usually right, but not always)
    k = max(1, len(z) // 10)
    if np.median(z[:k]) < np.median(z[-k:]):
        px, py, z = px[::-1], py[::-1], z[::-1]
        stats["reversed"] += 1
    prof = np.minimum.accumulate(z)                     # bed never rises downstream
    extra = z - prof
    over = extra > MAX_BREACH
    stats["capped"] += int(over.any())
    extra = np.where(over, 0.0, extra)                  # leave real dams / bad lines alone
    stats["breached_m"] += float(extra.max(initial=0))
    stats["lines"] += 1
    val = np.clip(np.round(base + extra * 10), 0, 255).astype(np.uint8)
    cx = np.floor(px).astype(int)
    cy = np.floor(py).astype(int)
    # stamp: 2x2 (keeps diagonal runs 4-connected) grown by (width-1) for wide channels
    r = width - 1
    offs = [(dx, dy) for dx in range(-r, 2 + r) for dy in range(-r, 2 + r)]
    for dx, dy in (offs if BURN else ()):
        xx = np.clip(cx + dx, 0, W - 1)
        yy = np.clip(cy + dy, 0, H - 1)
        np.maximum.at(riv, (yy, xx), val)
    if kind == "river" and ("Туул" in (e["tags"].get("name") or "") or "Tuul" in (e["tags"].get("name") or "")):
        tuul_pts += list(zip(px, py))

riv[bld > 0] = 0                                        # no channel under a mapped building
with gzip.open(OUT / "riv.u8.gz", "wb", compresslevel=6) as f:
    f.write(riv.tobytes())

# Tuul inflow: on the centreline ~600 m inside the east edge
if tuul_pts:
    target = W - 40
    c, r_ = min((p for p in tuul_pts if 0 <= p[1] < H), key=lambda p: abs(p[0] - target))
    m["tuulInflow"] = [int(round(c)), int(round(r_))]
m["sources"]["rivers"] = "none burned (OpenStreetMap Tuul line locates the inflow only)"
m["pitFill"] = {"fillSmallArea": SMALL, "fillShallow": SHALLOW, "urbanMaxPond": URBAN_CAP}
m["sources"]["dem"] = "Copernicus GLO-30 DSM (ESA/Airbus), building bias removed; noise pits filled, real depressions kept (urban ponds scaled to ≤ 1 m)"
json.dump(m, open(OUT / "meta.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"{stats['lines']} lines, {stats['reversed']} reversed by terrain, {stats['capped']} with a barrier > {MAX_BREACH} m left as is")
print("river cells", int((riv > 0).sum()), "| max burn", riv.max() / 10, "m | Tuul inflow", m.get("tuulInflow"))
