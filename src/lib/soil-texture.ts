/*
  Хөрсний зүсэлтийн нүүрийн бүтэц — ЖИШИГ ЗУРГААС БИШ, ДАТААС үүсгэнэ.

  Урьд нь бүтэц нь `soil_reference.webp` гэсэн НЭГ ерөнхий зургаас (AI-
  гаар зурсан подзол — улаан B, цайвар E) огтолсон таван хавтанцар байв.
  Давталт нь илт (үндэс, чулуу ижил байрандаа давтагдана), өнгө нь
  Монголын хөрсөнд таарахгүй (хархүрэн хөрсний Bw улаан болж байв) тул
  хэрэглэгч "зураг шиг харагдаж байна" гэж үзэв (2026-10-06).

  Одоо ангилал бүрийн бүтэц хөтөч дээр ЗУРАГДАНА:
   · суурь өнгө — Монголын хөрсний Мансэллийн ердийн утгаас (хархүрэн
     A 10YR 3/2, Bk 10YR 7/3, глей 5GY 5/1 …);
   · бүтэц — үйрмэг (A), бөөгнөрсөн өнцөгтөр (Bw, Bk), бүтэцгүй (C),
     ан цавтай хад (R) — тус бүр өөр хэв маягаар;
   · хайрга, сайрын нягтрал — профайлын `gravel` (CSV-ийн `gravel_pct`)-аас
     тухайн цэгийн профайлаас, гурван шатаар ({@link gravelLevel});
   · үндэс гүнзгийрэх тусам цөөрнө, Bk-д шохойн судал, зангидас.

  ⚠ Бүх элемент ХОЁР ТЭНХЛЭГЭЭРЭЭ ДАВТАГДАХ ёстой (`wrap: "repeat"`):
  дуу чимээ нь хавтанцрын хэмжээнд үечилсэн тор, дүрс бүр есөн
  хуулбараар зурагдана — эс тэгвээс хавтанцрын зааг шулуун шугам болно.
*/
import { asset } from "@/lib/base-path";
import {
  HCLS,
  TILE_CM,
  TILE_H,
  TILE_W,
  mulberry32,
  type Profile,
} from "@/lib/soil-profile";

/* ── Фото хавтанцар ─────────────────────────────────────────────── */

/** Жишиг зургийн зургаан давхарга (`scripts/build-soil-tiles.py`-ийн дараалал) */
export type PhotoKey = "O" | "A" | "E" | "B" | "C" | "R";
export type PhotoTiles = Record<PhotoKey, HTMLCanvasElement>;
const PHOTO_ORDER: PhotoKey[] = ["O", "A", "E", "B", "C", "R"];

/**
 * `public/data/soil-tiles.jpg` спрайтыг давхарга бүрийн canvas болгоно.
 * Файл байхгүй, эсвэл татагдахгүй бол `null` — бүтэц бүхэлдээ ДАТААС
 * зурагдана (доорх процедур нь өөрөө бүрэн).
 * ⚠ `fetch` биш `Image`: статик файл, порталын токен хэрэггүй.
 */
export async function loadSoilTiles(): Promise<PhotoTiles | null> {
  const img = new Image();
  img.src = asset("/data/soil-tiles.jpg");
  try {
    await img.decode();
  } catch {
    return null;
  }
  if (img.naturalWidth !== TILE_W || img.naturalHeight !== TILE_H * PHOTO_ORDER.length) return null;
  const out = {} as PhotoTiles;
  PHOTO_ORDER.forEach((k, i) => {
    const cv = document.createElement("canvas");
    cv.width = TILE_W;
    cv.height = TILE_H;
    cv.getContext("2d")!.drawImage(img, 0, -i * TILE_H);
    out[k] = cv;
  });
  return out;
}

/**
 * Ангилал (+ хайрганы түвшин) → фото давхарга. Өнгө ЭНДЭЭС авагдахгүй
 * (хөтөч дээр ангиллын өнгөөр дахин будна) — зөвхөн БҮТЭЦ: ялзмагт
 * үйрмэг (A), нунтаг (E), жижиг чулуутай бөөгнөрсөн (B), сайр (C), хад (R).
 * Хайрга бага бол нарийн бүтэц, их бол сайрын бүтэц — хайрга нь датаас.
 */
function photoFamily(cls: string, level: number): PhotoKey {
  if (cls === "O") return "O";
  /* Хүлэр — бараан ширхэглэг; ялзмагт давхаргын бүтэц, дээр нь ургамлын ширхэг */
  if (cls === "T" || cls === "A" || cls === "A2" || cls === "Ag") return level >= 2 ? "B" : "A";
  if (cls === "Bw" || cls === "Bf" || cls === "Bg" || cls === "Bgk") return level >= 2 ? "C" : "B";
  if (cls === "Bk" || cls === "G4") return "E";
  if (cls === "R" || cls === "G6" || cls === "G7") return "R";
  if (cls === "G1" || cls === "G5") return "B";
  if (cls.startsWith("G")) return "C";
  /* C, CR, Cg, Cf */
  return level >= 2 ? "C" : level === 1 ? "B" : "E";
}

/** Хайрганы эзлэх хувь → түвшин (геологид тогтмол) */
function levelOf(cls: string, gravel: number): number {
  if (GEO_GRAVEL[cls] != null) return Math.min(2, Math.round(GEO_GRAVEL[cls] * 4));
  return gravelLevel((gravel / (GRAVEL_W[cls] ?? 0.5)) * 100);
}

type RGB = [number, number, number];

/**
 * Мансэллийн ердийн утгаас ойролцоолсон sRGB, БОДИТ ФОТООР шалгасан
 * (2026-10-06): Монголын хөрс судлалын нийгэмлэгийн хархүрэн хөрсний
 * зүсэлтийн зургийн медиан — A ≈ (112, 82, 55), шилжилтийн B ≈
 * (129, 104, 80), шохойтой Bk ≈ (183, 168, 145) буюу 10YR 7/2 "light
 * gray"; Хэнтийн тайгын хөрс саарал-бор, ханалт бага. Урьдын Bk хэт
 * шаргал, Bw хэт улбар (подзолын зургаас) байсан.
 * ⚠ A нь фотоноос арай бараан, ханалт бага: Улаанбаатарын хар хүрэн
 * хөрсний A-г чийгтэй үед 7.5YR 2/1–3/1 гэж хэмжсэн (Cenococcum-ийн
 * судалгаа, Journal of Forest Research 2021); фото нь хуурай нүүр.
 */
const BASE: Record<string, RGB> = {
  O: [46, 34, 24],
  T: [56, 40, 27],
  A: [76, 56, 43],
  A2: [116, 88, 66],
  Ag: [92, 89, 81],
  Bw: [128, 92, 64],
  Bk: [184, 164, 136],
  Bg: [112, 122, 116],
  Bgk: [130, 136, 126],
  Bf: [140, 88, 56],
  C: [174, 144, 108],
  CR: [142, 130, 112],
  Cg: [126, 132, 124],
  Cgk: [142, 146, 136],
  Cf: [140, 158, 170],
  R: [122, 118, 110],
  /* ── Геологи (2 м-ээс доош, `MATS`-ийн дугаараар "G0"…"G7") ──
     JICA (2013) өрөмдлөгүүд: хотын хөндийд 30 м хүртэл "gravel with sand
     and cobble" — цайвар саарал-шаргал элсэн дүүргэлттэй хайрга. Неоген нь
     "улаан шар" (ГГХ 2021). */
  G0: [160, 148, 126],
  G1: [150, 134, 108],
  G2: [158, 142, 114],
  G3: [138, 128, 112],
  G4: [196, 178, 142],
  G5: [178, 126, 86],
  G6: [116, 110, 102],
  G7: [168, 150, 140],
};

/** Геологийн давхаргын хайрга, сайрын эзлэх хувь (JICA-гийн өрөмдлөгийн тодорхойлолтоос) */
const GEO_GRAVEL: Record<string, number> = {
  G0: 0.5, G1: 0.22, G2: 0.45, G3: 0.5, G4: 0, G5: 0.28, G6: 0, G7: 0,
};

/** Ангиллын хайрганы жин — профайлын нийт хайрганы хувьд үржинэ */
const GRAVEL_W: Record<string, number> = {
  O: 0,
  T: 0,
  A: 0.25,
  A2: 0.35,
  Ag: 0.12,
  Bw: 0.75,
  Bk: 0.6,
  Bg: 0.35,
  Bgk: 0.35,
  Bf: 0.75,
  C: 1,
  CR: 1.3,
  Cg: 0.6,
  Cgk: 0.6,
  Cf: 0.8,
  R: 0,
};

/** "5–15", "30–60", "0–10 (аллюви …)" → дундаж хувь */
function gravelPct(s: string): number | null {
  const n = (s.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((x) => Number(x.replace(",", ".")))
    .filter((v) => v <= 100);
  if (!n.length) return null;
  return n.length >= 2 ? (n[0] + n[1]) / 2 : n[0];
}

/**
 * Хайрганы ТҮВШИН — профайл бүрийн `gravel_pct`-ийг гурван шатанд:
 * 0 (< 15%), 1 (15–35%), 2 (≥ 35%). Ангилал бүрийн бүтэц тус бүрийн
 * түвшинд тусдаа зурагдана — хархүрэн хөрсний C (5–15%) нь бараг
 * хайрганагүй, сайргархаг хархүрэнийх (30–60%) нь сайраар дүүрэн.
 *
 * ⚠ ГУРВАН ШАТ, тасралтгүй биш: бүтэц нь зурвас бүрд НЭГ тул утга бүрд
 * шинэ бүтэц үүсгэвэл санах ой дүүрнэ; шат солигдох газар нь катенагийн
 * бүс (хөрсний хил) тул тэнд бүтэц солигдох нь үнэн.
 */
export const GRAVEL_LEVELS = [10, 25, 47];

export function gravelLevel(pct: number): number {
  return pct < 15 ? 0 : pct < 35 ? 1 : 2;
}

/** Профайл тутмын хайрганы хувь (бүртгэгдээгүй бол 10) */
export function profileGravel(profiles: Profile[]): number[] {
  return profiles.map((p) => gravelPct(p.gravel) ?? 10);
}

/** Ангилал хайрганы түвшнээр ялгагдах уу (O, R — үгүй) */
export const hasGravel = (cls: string) => (GRAVEL_W[cls] ?? 0) > 0;

/** Ангилал + түвшин → бүтцэд зурах хайрганы ЭЗЛЭХ ХУВЬ (0…0.55) */
export function gravelShare(cls: string, level: number): number {
  return Math.min(0.55, (GRAVEL_LEVELS[level] / 100) * (GRAVEL_W[cls] ?? 0.5));
}

/* ── Үечилсэн дуу чимээ ──────────────────────────────────────────── */

function lattice(rand: () => number, cell: number) {
  const gx = Math.max(1, Math.round(TILE_W / cell));
  const gy = Math.max(1, Math.round(TILE_H / cell));
  const v = new Float32Array(gx * gy);
  for (let i = 0; i < v.length; i++) v[i] = rand();
  const sx = gx / TILE_W;
  const sy = gy / TILE_H;
  return (x: number, y: number) => {
    const fx = x * sx;
    const fy = y * sy;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    let tx = fx - x0;
    let ty = fy - y0;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const xa = ((x0 % gx) + gx) % gx;
    const xb = (xa + 1) % gx;
    const ya = ((y0 % gy) + gy) % gy;
    const yb = (ya + 1) % gy;
    const a = v[ya * gx + xa] + (v[ya * gx + xb] - v[ya * gx + xa]) * tx;
    const b = v[yb * gx + xa] + (v[yb * gx + xb] - v[yb * gx + xa]) * tx;
    return a + (b - a) * ty;
  };
}

function fbm(rand: () => number, cells: number[]) {
  const ls = cells.map((c) => lattice(rand, c));
  const w = cells.map((_, i) => 1 / 2 ** i);
  const norm = w.reduce((a, b) => a + b, 0);
  return (x: number, y: number) => {
    let s = 0;
    for (let i = 0; i < ls.length; i++) s += ls[i](x, y) * w[i];
    return s / norm;
  };
}

/** Үечилсэн Вороной — F1, F2 ба хамгийн ойрын эсийн дугаар */
function voronoi(rand: () => number, cell: number, jitterY = 1) {
  const gx = Math.max(2, Math.round(TILE_W / cell));
  const gy = Math.max(2, Math.round(TILE_H / (cell * jitterY)));
  const cw = TILE_W / gx;
  const ch = TILE_H / gy;
  const px = new Float32Array(gx * gy);
  const py = new Float32Array(gx * gy);
  for (let i = 0; i < gx * gy; i++) {
    px[i] = rand();
    py[i] = rand();
  }
  return (x: number, y: number) => {
    const cx = Math.floor(x / cw);
    const cy = Math.floor(y / ch);
    let f1 = 1e9;
    let f2 = 1e9;
    let id = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const ix = cx + i;
        const iy = cy + j;
        const k = (((iy % gy) + gy) % gy) * gx + (((ix % gx) + gx) % gx);
        const dx = (ix + px[k]) * cw - x;
        const dy = (iy + py[k]) * ch - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = k;
        } else if (d < f2) f2 = d;
      }
    return { f1, f2, id };
  };
}

/* ── Дүрс зурах туслахууд ───────────────────────────────────────── */

/** Хавтанцрын ирмэгт тасрахгүй — есөн хуулбар */
function wrapped(g: CanvasRenderingContext2D, fn: () => void) {
  for (const ox of [-TILE_W, 0, TILE_W])
    for (const oy of [-TILE_H, 0, TILE_H]) {
      g.save();
      g.translate(ox, oy);
      fn();
      g.restore();
    }
}

const PX_PER_CM = TILE_H / TILE_CM;

function stones(
  g: CanvasRenderingContext2D,
  R: () => number,
  frac: number,
  base: RGB,
  angular: boolean,
  rMax: number,
) {
  /* ⚠ Зүсэлтийн нүүрэн дээр чулуу ЭЗЛЭХ хувь нь эзэлхүүнийхээс бага
     харагддаг (нүүр нь чулууг дундуур нь биш санамсаргүй огтолно) —
     фото дээр 30–60% хайргатай хөрс ч "чулуугаар дүүрсэн" харагддаггүй.
     Тиймээс талбайн ердөө тал хувийг ТОМ чулуугаар, үлдсэнийг 1–2 px
     ширхэглэг хайргаар (`grit`) зурна. */
  const target = frac * 0.45 * TILE_W * TILE_H;
  let area = 0;
  let guard = 0;
  const pal: RGB[] = [
    [150, 146, 138],
    [122, 116, 108],
    [170, 160, 140],
    [104, 96, 88],
    [184, 176, 162],
    [136, 112, 90],
  ];
  /* Чулуу жигд тарахгүй — бөөгнөрсөн, зарим газар хоосон */
  const cluster = lattice(R, 110);
  while (area < target && guard++ < 6000) {
    /* Жижиг нь олонх — радиус хэвийсэн тархалттай */
    const r = 1.2 + (rMax - 1.2) * R() ** 2.6;
    const x = R() * TILE_W;
    const y = R() * TILE_H;
    if (R() > 0.15 + cluster(x, y) * 1.3) continue;
    const flat = 0.55 + R() * 0.4;
    const rot = (R() - 0.5) * 1.2;
    /* Тоосонд хучигдсан, матт — хөрсний өнгө рүү хагасаар холино */
    const mix = 0.42 + R() * 0.2;
    const c = pal[(R() * pal.length) | 0].map(
      (v, i) => v * mix + base[i] * (1 - mix),
    ) as RGB;
    /* Хэлбэр нь дугуй БИШ — 7…10 оройтой, зөөлөн муруй захтай */
    const n = 7 + ((R() * 4) | 0);
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (R() - 0.5) * 0.5;
      const rr = r * (angular ? 0.6 + R() * 0.55 : 0.82 + R() * 0.25);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr * flat;
      pts.push([
        px * Math.cos(rot) - py * Math.sin(rot),
        px * Math.sin(rot) + py * Math.cos(rot),
      ]);
    }
    const shape = (dx: number, dy: number, s = 1) => {
      g.beginPath();
      if (angular) {
        pts.forEach(([px, py], i) =>
          i ? g.lineTo(x + dx + px * s, y + dy + py * s) : g.moveTo(x + dx + px * s, y + dy + py * s),
        );
      } else {
        /* Оройнуудын дундах цэгээр дамжсан квадрат муруй — булангүй дугуй */
        const m = (i: number): [number, number] => {
          const a = pts[i % n];
          const b = pts[(i + 1) % n];
          return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        };
        const [sx, sy] = m(0);
        g.moveTo(x + dx + sx * s, y + dy + sy * s);
        for (let i = 1; i <= n; i++) {
          const [cx, cy] = pts[i % n];
          const [ex, ey] = m(i);
          g.quadraticCurveTo(x + dx + cx * s, y + dy + cy * s, x + dx + ex * s, y + dy + ey * s);
        }
      }
      g.closePath();
    };
    wrapped(g, () => {
      /* Сүүдэр доод-баруун талд — чулуу хөрсөнд суусан мэт */
      g.fillStyle = "rgba(20,14,8,.28)";
      shape(r * 0.12, r * 0.18, 1.04);
      g.fill();
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3 * flat, r * 0.15, x, y, r * 1.15);
      gr.addColorStop(0, `rgb(${c.map((v) => Math.min(255, v * 1.08) | 0)})`);
      gr.addColorStop(0.65, `rgb(${c.map((v) => v | 0)})`);
      gr.addColorStop(1, `rgb(${c.map((v) => (v * 0.84) | 0)})`);
      g.fillStyle = gr;
      shape(0, 0);
      g.fill();
    });
    area += Math.PI * r * r * flat;
  }
  grit(g, R, frac, base);
}

/** 1–2 пикселийн ширхэглэг хайрга — хөрсний матрицад тарсан */
function grit(g: CanvasRenderingContext2D, R: () => number, frac: number, base: RGB) {
  const n = Math.round(frac * 9000);
  for (let i = 0; i < n; i++) {
    const x = R() * TILE_W;
    const y = R() * TILE_H;
    const light = R() > 0.45;
    const k = light ? 1.22 + R() * 0.18 : 0.6 + R() * 0.15;
    g.fillStyle = `rgba(${base.map((v) => Math.min(255, v * k) | 0)},.85)`;
    g.fillRect(x, y, 1 + R() * 1.4, 1 + R() * 1.1);
  }
}

function roots(
  g: CanvasRenderingContext2D,
  R: () => number,
  n: number,
  maxLen: number,
  color: string,
) {
  for (let i = 0; i < n; i++) {
    let x = R() * TILE_W;
    let y = R() * TILE_H;
    let a = Math.PI / 2 + (R() - 0.5) * 0.9;
    const len = maxLen * (0.3 + R() * 0.7);
    const w = 0.5 + R() * 1.1;
    const seg: [number, number][] = [[x, y]];
    for (let s = 0; s < len; s += 3) {
      a += (R() - 0.5) * 0.5;
      a = Math.PI / 2 + Math.max(-1.1, Math.min(1.1, a - Math.PI / 2));
      x += Math.cos(a) * 3;
      y += Math.sin(a) * 3;
      seg.push([x, y]);
    }
    wrapped(g, () => {
      g.strokeStyle = color;
      g.lineCap = "round";
      g.lineWidth = w;
      g.beginPath();
      seg.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.stroke();
      /* Салаа үндэс */
      g.lineWidth = w * 0.55;
      for (let k = 4; k < seg.length - 2; k += 5) {
        if (R() > 0.55) continue;
        const [bx, by] = seg[k];
        const side = R() > 0.5 ? 1 : -1;
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(
          bx + side * 5,
          by + 4,
          bx + side * (6 + R() * 8),
          by + 8 + R() * 10,
        );
        g.stroke();
      }
    });
  }
}

/** Шохойн нунтаг толбо, судал (pseudomycelia), зангидас */
function carbonate(
  g: CanvasRenderingContext2D,
  R: () => number,
  threads: number,
  nodules: number,
) {
  /* Нунтаг шохойн цайвар толбо — фото дээр Bk нь гялалзсан судал биш,
     бүдэг цагаан "хөгц" мэт толботой байдаг */
  for (let i = 0; i < 26; i++) {
    const x = R() * TILE_W;
    const y = R() * TILE_H;
    const r = 6 + R() ** 1.5 * 22;
    const al = 0.1 + R() * 0.16;
    wrapped(g, () => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(248,244,232,${al})`);
      gr.addColorStop(1, "rgba(248,244,232,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.6 + R() * 0.5), R() * 3, 0, Math.PI * 2);
      g.fill();
    });
  }
  for (let i = 0; i < threads; i++) {
    let x = R() * TILE_W;
    let y = R() * TILE_H;
    let a = R() * Math.PI * 2;
    const seg: [number, number][] = [[x, y]];
    const len = 6 + R() * 18;
    for (let s = 0; s < len; s += 2) {
      a += (R() - 0.5) * 1.3;
      x += Math.cos(a) * 2;
      y += Math.sin(a) * 2;
      seg.push([x, y]);
    }
    const al = 0.18 + R() * 0.28;
    wrapped(g, () => {
      g.strokeStyle = `rgba(246,242,230,${al})`;
      g.lineWidth = 0.5 + R() * 0.6;
      g.beginPath();
      seg.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.stroke();
    });
  }
  for (let i = 0; i < nodules; i++) {
    const x = R() * TILE_W;
    const y = R() * TILE_H;
    const r = 1.5 + R() ** 2 * 4;
    wrapped(g, () => {
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      gr.addColorStop(0, "rgba(250,247,238,.9)");
      gr.addColorStop(0.7, "rgba(232,226,208,.7)");
      gr.addColorStop(1, "rgba(232,226,208,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
      g.fill();
    });
  }
}

/** Төмрийн толбо (глей, Bf) */
function mottles(
  g: CanvasRenderingContext2D,
  R: () => number,
  n: number,
  rgb: RGB,
  rMax: number,
) {
  for (let i = 0; i < n; i++) {
    const x = R() * TILE_W;
    const y = R() * TILE_H;
    const r = 2 + R() * rMax;
    const al = 0.25 + R() * 0.35;
    wrapped(g, () => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${rgb},${al})`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.5 + R() * 0.4), R() * 3, 0, Math.PI * 2);
      g.fill();
    });
  }
}

/* ── Ангиллын бүтэц ─────────────────────────────────────────────── */

type Structure = "crumb" | "blocky" | "massive" | "rock";

const STRUCT: Record<string, Structure> = {
  O: "crumb",
  T: "crumb",
  A: "crumb",
  A2: "crumb",
  Ag: "crumb",
  Bw: "blocky",
  Bk: "blocky",
  Bg: "massive",
  Bgk: "massive",
  Bf: "blocky",
  C: "massive",
  CR: "massive",
  Cg: "massive",
  Cgk: "massive",
  Cf: "massive",
  G0: "massive",
  G1: "massive",
  G2: "massive",
  G3: "massive",
  G4: "massive",
  G5: "massive",
  G6: "rock",
  G7: "rock",
  R: "rock",
};

/**
 * Ангиллын бүтцийн canvas (`TILE_W × TILE_H`, хоёр тэнхлэгээрээ давтагдана).
 * `gravel` — хайрга, сайрын эзлэх хувь (0…0.55).
 */
export function soilTexture(cls: string, gravel: number, photos?: PhotoTiles | null): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = TILE_W;
  cv.height = TILE_H;
  const g = cv.getContext("2d")!;
  const seed = [...cls].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 101);
  const R = mulberry32(seed);
  const base = BASE[cls] ?? hexRgb(HCLS[cls]?.color ?? "#8a8070");
  const st = STRUCT[cls] ?? "massive";
  if (photos) {
    const fam = photoFamily(cls, levelOf(cls, gravel));
    photoMatrix(g, R, cls, base, photos[fam], fam);
    finishTexture(g, R, cls, base, st, gravel, fam);
    return cv;
  }

  /* 1. Матриц — ӨНДРИЙН ТАЛБАЙ, дараа нь гэрэл сүүдрээр будна.
     Фото дээр хөрсний нүүр хавтгай биш: бөөм бүр гүдгэр, хооронд нь
     сүв, нүх, хурц ирмэгийн сүүдэр — зүүн дээрээс гэрэлтсэн рельеф.
     Урьдын хувилбар өнгийг л хэлбэлзүүлж байсан тул будсан цаас шиг
     харагдаж байв (хэрэглэгч 2026-10-06: "зурагаар ч юм шиг"). */
  const low = fbm(R, [128, 64]);
  const mid = fbm(R, [48, 24]);
  const fine = fbm(R, [12, 6]);
  const micro = lattice(R, 3);
  const grain = lattice(R, 2);
  const crack = lattice(R, 3);
  /* Босоо сунасан хэл, толбо — дээд давхаргын ялзмаг доош урссан мэт
     (фото дээр бүх давхаргад харагддаг том хэмжээний өнгөний хэлбэлзэл) */
  const tongue = lattice(R, 36);
  /* Үйрмэг — бөөн бөөн шороо: олон давтамжийн дуу чимээний ОВГОР, хооронд
     нь нарийн сүв (дуу чимээний нуруу). Вороной тор нь мөлхөгчийн арьс
     шиг жигд харагдсан (2026-10-06). */
  const clump = st === "crumb" ? fbm(R, [26, 13, 6]) : null;
  const ridge = st === "crumb" ? fbm(R, [20, 10]) : null;
  const vor = st === "blocky" ? voronoi(R, cls === "Bk" ? 44 : 34, 0.85) : null;
  const cellTone = new Float32Array(4096);
  for (let i = 0; i < cellTone.length; i++) cellTone[i] = R();
  /* Хад: ЖИГД БУС зузаантай үе давхарга (хэвтээ, долгиолог — бүхэл
     давталттай тул хавтанцрын заагт тасрахгүй) + үе бүрийн дотор цөөн
     босоо ан цав. Тойрог хавтан (Вороной) нь хучилтын чулуу шиг
     харагдсан тул хэрэглэхгүй. */
  const bedTop: number[] = [0];
  while (bedTop[bedTop.length - 1] < TILE_H - 18) bedTop.push(bedTop[bedTop.length - 1] + 18 + R() * 50);
  const BEDS = bedTop.length;
  bedTop.push(TILE_H);
  const und = (x: number) =>
    7 * Math.sin((2 * Math.PI * x) / TILE_W + 1.3) +
    3 * Math.sin((6 * Math.PI * x) / TILE_W + 0.4);
  const joints = Array.from({ length: BEDS }, () =>
    Array.from({ length: 1 + ((R() * 3) | 0) }, () => R() * TILE_W).sort(
      (a, b) => a - b,
    ),
  );
  const jwave = lattice(R, 14);
  const H = new Float32Array(TILE_W * TILE_H); // өндөр, ~0…1
  const T = new Float32Array(TILE_W * TILE_H); // өнгөний хэлбэлзэл
  const G = new Float32Array(TILE_W * TILE_H); // ан цав, сүвний бараан (0…1)
  for (let y = 0; y < TILE_H; y++)
    for (let x = 0; x < TILE_W; x++) {
      const i = y * TILE_W + x;
      let h = low(x, y) * 0.3 + mid(x, y) * 0.45 + fine(x, y) * 0.25;
      let t =
        (low(x, y) - 0.5) * 0.22 +
        (mid(x, y) - 0.5) * 0.1 +
        (tongue(x, y * 0.3) - 0.5) * 0.16;
      let gv = 0;
      if (clump) {
        const c = clump(x, y);
        h += (c - 0.5) * 1.1 + (micro(x, y) - 0.5) * 0.16;
        t += (c - 0.5) * 0.1;
        const rd = Math.abs(ridge!(x, y) - 0.5);
        if (rd < 0.028 && crack(x, y) > 0.5) gv = (1 - rd / 0.028) * 0.4;
      } else if (vor) {
        const v = vor(x, y);
        const edge = v.f2 - v.f1;
        /* Бөөгнөрсөн — блок бүр өөр өндөр, өнгөтэй; ан цав ХЭСЭГЧИЛСЭН,
           бараан зураас (хонхор биш — хонхорын ирмэг гэрэлтэж цагаан
           тор болж байв) */
        h += (cellTone[v.id & 4095] - 0.5) * 0.22 + (micro(x, y) - 0.5) * 0.1;
        t += (cellTone[(v.id * 7) & 4095] - 0.5) * 0.07;
        if (edge < 1.6 && crack(x, y) > 0.55) gv = (1 - edge / 1.6) * 0.45;
      } else if (st === "rock") {
        const yy = (((y - und(x)) % TILE_H) + TILE_H) % TILE_H;
        let bi = 0;
        while (bi < BEDS - 1 && yy >= bedTop[bi + 1]) bi++;
        const fy = yy - bedTop[bi];
        const dBed = Math.min(fy, bedTop[bi + 1] - yy);
        const js = joints[bi];
        const xx = (((x + (jwave(x, y) - 0.5) * 6) % TILE_W) + TILE_W) % TILE_W;
        let dj = 1e9;
        let seg = 0;
        for (const jx of js) {
          const d = Math.abs(xx - jx);
          dj = Math.min(dj, d, TILE_W - d);
          if (jx < xx) seg++;
        }
        t += (cellTone[bi * 8 + (seg % js.length)] - 0.5) * 0.26;
        /* Үеийн зааг, ан цав — бараан, өгөршилтэй; бага зэрэг хонхор */
        if (dBed < 2) {
          gv = Math.max(gv, (1 - dBed / 2) * (0.45 + crack(x, y) * 0.5));
          h -= 0.25 * (1 - dBed / 2);
        }
        if (dj < 1.5) {
          gv = Math.max(gv, (1 - dj / 1.5) * (0.35 + crack(x, y) * 0.5));
          h -= 0.18 * (1 - dj / 1.5);
        }
        h += (micro(x, y) - 0.5) * 0.14 + (fine(x, y) - 0.5) * 0.2;
      } else {
        /* Бүтэцгүй — элсэрхэг, гөлгөр; ширхэг нь нарийн */
        h += (micro(x, y) - 0.5) * 0.1;
      }
      H[i] = h;
      T[i] = t;
      G[i] = gv;
    }
  /* Нүх, сүв — жижиг хонхор */
  const pits = st === "rock" ? 0 : st === "crumb" ? 120 : st === "blocky" ? 70 : 36;
  for (let i = 0; i < pits; i++) {
    const cx = R() * TILE_W;
    const cy = R() * TILE_H;
    const r = 1.2 + R() ** 2 * 3.2;
    const ri = Math.ceil(r) + 1;
    for (let dy = -ri; dy <= ri; dy++)
      for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d > 1) continue;
        const x = (((Math.round(cx) + dx) % TILE_W) + TILE_W) % TILE_W;
        const y = (((Math.round(cy) + dy) % TILE_H) + TILE_H) % TILE_H;
        H[y * TILE_W + x] -= 0.7 * (1 - d * d);
      }
  }
  /* 2. Гэрэл сүүдэр — зүүн дээрээс; налуугийн тэмдгээр */
  const im = g.createImageData(TILE_W, TILE_H);
  const d = im.data;
  const gain = st === "rock" ? 1.5 : st === "crumb" ? 1.5 : st === "blocky" ? 1.3 : 1.2;
  const amb = st === "rock" ? 0.22 : 0.26;
  for (let y = 0; y < TILE_H; y++)
    for (let x = 0; x < TILE_W; x++) {
      const i = y * TILE_W + x;
      const xl = y * TILE_W + ((x - 1 + TILE_W) % TILE_W);
      const xr = y * TILE_W + ((x + 1) % TILE_W);
      const yu = ((y - 1 + TILE_H) % TILE_H) * TILE_W + x;
      const yd = ((y + 1) % TILE_H) * TILE_W + x;
      const sx = H[xr] - H[xl];
      const sy = H[yd] - H[yu];
      const lit = Math.max(-0.4, Math.min(0.4, (-sx - sy) * gain));
      /* Хонхор нь сүүдэртэй: өндөр нь ч өнгөнд бага зэрэг орно */
      const depth = Math.max(-0.5, Math.min(0.5, H[i] - 0.5)) * amb;
      let k = (1 + lit + depth + T[i] + (grain(x, y) - 0.5) * 0.1) * (1 - G[i]);
      const r = R();
      if (r < 0.01) k *= 0.6;
      else if (r > 0.993) k *= 1.22;
      const o = i * 4;
      d[o] = Math.min(255, base[0] * k);
      d[o + 1] = Math.min(255, base[1] * k);
      d[o + 2] = Math.min(255, base[2] * k);
      d[o + 3] = 255;
    }
  g.putImageData(im, 0, 0);

  finishTexture(g, R, cls, base, st, gravel, null);
  return cv;
}

/**
 * Ангиллын онцлог (үндэс, шохой, толбо) ба хайрга — процедур, фото хоёр
 * замд нийтлэг. `photo` (фото давхаргын түлхүүр) өгөгдсөн үед фото дээр
 * аль хэдийн байгаа зүйлийг давтахгүй: A-ийн үндэс, B/C-ийн чулуу,
 * хадны ширхэг.
 */
function finishTexture(
  g: CanvasRenderingContext2D,
  R: () => number,
  cls: string,
  base: RGB,
  st: Structure,
  gravel: number,
  photo: PhotoKey | null,
) {
  const pxcm = PX_PER_CM;
  if (!photo && (cls === "O" || cls === "A" || cls === "A2" || cls === "Ag")) {
    const n = cls === "O" ? 60 : cls === "A" ? 34 : cls === "A2" ? 16 : 14;
    roots(g, R, n, 45 * pxcm * 0.3, "rgba(206,182,140,.5)");
    /* Хорхойн суваг, хуучин үндэсний ул мөр — бараан ялзмагтай дүүрэгдэл */
    mottles(g, R, cls === "A2" ? 30 : 14, [40, 30, 22], 6);
  }
  if (!photo && (cls === "Bw" || cls === "Bf")) {
    roots(g, R, 8, 40, "rgba(180,150,110,.4)");
    /* A-аас доош урссан ялзмагт хэл, хорхойн суваг */
    mottles(g, R, 12, [70, 50, 34], 7);
  }
  if (cls === "Bk") {
    carbonate(g, R, 48, 16);
    roots(g, R, 4, 40, "rgba(150,124,92,.35)");
  }
  if (cls === "Bg" || cls === "Bgk" || cls === "Ag" || cls === "Cg" || cls === "Cgk")
    mottles(g, R, cls === "Bg" || cls === "Bgk" ? 60 : 30, [176, 104, 44], 9);
  /* Карбонатлаг глей — зэвийн толбоны хажуугаар шохойн цагаан толбо, зангидас */
  if (cls === "Bgk" || cls === "Cgk") carbonate(g, R, 30, 14);
  /* Хүлэр — ургамлын ширхэг (бараан, цайвар хоёр), фототой ч хамт */
  if (cls === "T") {
    roots(g, R, 70, 30, "rgba(120,92,60,.6)");
    roots(g, R, 40, 22, "rgba(190,160,110,.45)");
  }
  if (cls === "Bf") mottles(g, R, 36, [168, 70, 30], 8);
  if (cls === "Cg") mottles(g, R, 26, [96, 112, 116], 12);

  /* Хад — эрдсийн ширхэг, өгөршлийн хүрэн толбо */
  if (st === "rock" && !photo) {
    rockGrain(g, R, base);
    mottles(g, R, 22, [118, 86, 58], 12);
  }
  /* Тунамал хурдас — бүдэг хэвтээ давхаргажилт */
  if (cls === "G0" || cls === "G1" || cls === "G2") laminae(g, R, 8);
  /* Неоген — улаан шар шаварлаг толбо, судал */
  if (cls === "G5") mottles(g, R, 40, [196, 150, 96], 14);
  /* Эолын элс — нимгэн давхаргажилт */
  if (cls === "G4") laminae(g, R, 22);
  /* Боржин — хээрийн жонш, кварцын ширхэг */
  if (cls === "G7") speckle(g, R);

  /* 3. Хайрга, сайр — профайлын (геологийн) датаас */
  /* Фото дээр B, C давхарга чулуутай тул хайргыг давхар зурахгүй; A, E
     бүтэц дээр датаны хайрга ХАГАС хэмжээгээр нэмэгдэнэ */
  const raw = GEO_GRAVEL[cls] ?? gravel;
  const share = photo === "B" || photo === "C" || photo === "R" ? 0 : photo ? raw * 0.5 : raw;
  if (share > 0.005) {
    const angular =
      cls === "CR" || cls === "Bw" || cls === "Bf" || cls === "Cf" || cls === "G3";
    const rMax =
      cls === "CR" || cls === "G3"
        ? 5 * pxcm
        : cls === "C" || cls === "Cg" || cls === "G0" || cls === "G2"
          ? 3.6 * pxcm
          : 2.4 * pxcm;
    stones(g, R, share, base, angular, rMax);
  }
}

/**
 * ФОТО СУУРЬ: жишиг зургийн давхаргын бүтцийг (гэрэлтэлт) авч ангиллын
 * өнгөөр дахин будна. Хоёр хуулбарыг дуу чимээний маскаар холино —
 * нэг хавтанцар дахин давтагдах нь нүдэнд илт байв. Дээр нь том
 * хэмжээний толбо, хэл (процедурынхтай ижил `tongue`).
 */
function photoMatrix(
  g: CanvasRenderingContext2D,
  R: () => number,
  cls: string,
  base: RGB,
  photo: HTMLCanvasElement,
  fam: PhotoKey,
) {
  const P = photo.getContext("2d")!.getImageData(0, 0, TILE_W, TILE_H).data;
  /* Ялзмагт давхаргын цайвар үндэс нь харанхуй суурь дээр хэт гэрэлтэж
     байв — гэрэлтэлтийн дээд хязгаар */
  const kMax = fam === "A" ? 1.45 : 2.4;
  let mean = 0;
  for (let i = 0; i < P.length; i += 4) mean += P[i] * 0.299 + P[i + 1] * 0.587 + P[i + 2] * 0.114;
  mean /= TILE_W * TILE_H;
  const bm = base[0] * 0.299 + base[1] * 0.587 + base[2] * 0.114;
  const low = fbm(R, [128, 64]);
  const tongue = lattice(R, 36);
  const mask = lattice(R, 90);
  const ox = (TILE_W * 0.5 + R() * 60) | 0;
  const oy = (TILE_H * 0.5 + R() * 30) | 0;
  /* Навчны давхарга (O), хад өөрийн өнгөө илүү хадгална */
  const keep = cls === "O" ? 0.7 : cls === "R" || cls === "G6" || cls === "G7" ? 0.45 : 0.25;
  const im = g.createImageData(TILE_W, TILE_H);
  const d = im.data;
  for (let y = 0; y < TILE_H; y++)
    for (let x = 0; x < TILE_W; x++) {
      const i = (y * TILE_W + x) * 4;
      const j = (((y + oy) % TILE_H) * TILE_W + ((x + ox) % TILE_W)) * 4;
      const m = mask(x, y);
      const a = Math.max(0, Math.min(1, (m - 0.42) * 6));
      const r = P[i] * (1 - a) + P[j] * a;
      const gg = P[i + 1] * (1 - a) + P[j + 1] * a;
      const b = P[i + 2] * (1 - a) + P[j + 2] * a;
      const lum = r * 0.299 + gg * 0.587 + b * 0.114;
      const k =
        Math.min(kMax, (lum / mean) ** 0.9) *
        (1 + (low(x, y) - 0.5) * 0.2 + (tongue(x, y * 0.3) - 0.5) * 0.14);
      const sc = bm / mean;
      d[i] = Math.min(255, base[0] * k * (1 - keep) + r * sc * keep);
      d[i + 1] = Math.min(255, base[1] * k * (1 - keep) + gg * sc * keep);
      d[i + 2] = Math.min(255, base[2] * k * (1 - keep) + b * sc * keep);
      d[i + 3] = 255;
    }
  g.putImageData(im, 0, 0);
}

/** Геологийн давхаргын бүтэц — `MATS`-ийн дугаараар */
export function geologyTexture(mat: number, photos?: PhotoTiles | null): HTMLCanvasElement {
  return soilTexture(`G${mat}`, 0, photos);
}

/** Нимгэн хэвтээ давхаргажилт (давталттай долгио) */
function laminae(g: CanvasRenderingContext2D, R: () => number, n: number) {
  for (let i = 0; i < n; i++) {
    const y0 = R() * TILE_H;
    const a = 1 + R() * 3;
    const ph = R() * 6;
    const k = 1 + ((R() * 3) | 0);
    g.strokeStyle = `rgba(${R() > 0.5 ? "120,100,70" : "235,222,190"},${0.18 + R() * 0.2})`;
    g.lineWidth = 0.6 + R();
    for (const oy of [-TILE_H, 0, TILE_H]) {
      g.beginPath();
      for (let x = 0; x <= TILE_W; x += 8) {
        const y = y0 + oy + a * Math.sin((2 * Math.PI * k * x) / TILE_W + ph);
        if (x) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
  }
}

/** Хадны эрдсийн ширхэг — бараан, цайвар жижиг цэг */
function rockGrain(g: CanvasRenderingContext2D, R: () => number, base: RGB) {
  for (let i = 0; i < 2600; i++) {
    const x = R() * TILE_W;
    const y = R() * TILE_H;
    const k = R() > 0.5 ? 1.25 : 0.7;
    g.fillStyle = `rgba(${base.map((v) => Math.min(255, v * k) | 0)},.6)`;
    g.fillRect(x, y, 1 + R() * 1.2, 1 + R() * 1.2);
  }
}

/** Боржингийн ширхэг — ягаавтар хээрийн жонш, цайвар кварц, бараан слюд */
function speckle(g: CanvasRenderingContext2D, R: () => number) {
  const pal = ["rgba(205,160,140,.7)", "rgba(230,226,218,.65)", "rgba(50,46,44,.6)"];
  for (let i = 0; i < 1600; i++) {
    const x = R() * TILE_W;
    const y = R() * TILE_H;
    const r = 0.6 + R() * 1.8;
    g.fillStyle = pal[(R() * 3) | 0];
    g.fillRect(x, y, r, r * (0.6 + R() * 0.6));
  }
}

function hexRgb(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

/* ── Шилжилтийн бүс ─────────────────────────────────────────────── */

/** Шилжилтийн бүсийн бүтцийн өндөр, пиксел */
export const TRANS_H = 64;

/**
 * Дээд ба доод давхаргын хоорондох ШИЛЖИЛТИЙН бүтэц — дээрээс доош
 * дээд давхарга нь хэл, толбо болж доод руу уусна (FAO-гийн "gradual /
 * wavy" хил). Зүсэлтийн нүүрт дөрвөлжин шилжилтийн зурвасаар зурагдана:
 * v = 0 нь дээд, v = 1 нь доод ирмэг.
 *
 * ⚠ Гүний усны туяа (`_w`) энд ӨӨРӨӨ шингэнэ: хоёр талын нэг нь ханасан,
 * нөгөө нь ханаагүй байж болно (гүний ус яг хил дээр).
 */
export function transitionTexture(
  up: HTMLCanvasElement,
  down: HTMLCanvasElement,
  upTint: readonly number[] | null,
  downTint: readonly number[] | null,
  seed: number,
): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = TILE_W;
  cv.height = TRANS_H;
  const g = cv.getContext("2d")!;
  const A = up.getContext("2d")!.getImageData(0, 0, TILE_W, TRANS_H).data;
  const B = down
    .getContext("2d")!
    .getImageData(0, TILE_H - TRANS_H, TILE_W, TRANS_H).data;
  const R = mulberry32(seed);
  /* Хэвтээ тэнхлэгт урт хэл, босоо тэнхлэгт жижиг толбо */
  const tongue = lattice(R, 48);
  const tongue2 = lattice(R, 16);
  const fleck = lattice(R, 4);
  const out = g.createImageData(TILE_W, TRANS_H);
  const o = out.data;
  const ta = upTint ?? [255, 255, 255];
  const tb = downTint ?? [255, 255, 255];
  for (let y = 0; y < TRANS_H; y++) {
    const fy = (y + 0.5) / TRANS_H;
    for (let x = 0; x < TILE_W; x++) {
      const t =
        tongue(x, y * 0.15) * 0.55 +
        tongue2(x, y * 0.4) * 0.3 +
        fleck(x, y) * 0.15;
      /* m < 0 → дээд, m > 0 → доод; ирмэгт хоёр тал ЯГ өөрийнхөөрөө */
      const m = fy - 0.5 + (t - 0.5) * 0.9 * Math.sin(Math.PI * fy);
      const s = Math.max(0, Math.min(1, m * 14 + 0.5));
      const i = (y * TILE_W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = (A[i + c] * ta[c]) / 255;
        const b = (B[i + c] * tb[c]) / 255;
        o[i + c] = a + (b - a) * s;
      }
      o[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return cv;
}
