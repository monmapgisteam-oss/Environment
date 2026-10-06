/*
  УЛААНБААТАРЫН ГЕОЛОГИ (газрын суурийн ангилал) — хоёртын багц бэлтгэгч.

  Эх сурвалж: `I:/Environment/us_hurs/UB Geology/UB_ground_classi.shp` —
  JICA-гийн "Project for Strengthening the Capacity of Seismic Disaster Risk
  Management in Ulaanbaatar City" (2012–2013) төслийн газрын суурийн загвар
  (метадата: `UB_Seismic_Hazard_Information_DB / 新地盤モデル`). 912 олон
  өнцөгт, UTM 48N, хоёр талбар:
    · `CODEGEOLC` — чулуулгийн нас (QIV, QIII-IV, N, C1-2, T3-J1(g4) …);
    · `NEWID`     — инженер-геологийн 9 анги.
  `NEWID`-ийн утгыг давхаргын `.lyr` нэрс ба `CODEGEOLC`-той тулгаж тогтоосон
  (2026-10-06): 1 хад · 2 неоген · 3 дэнж · 4 нуранги (QIII) · 5, 9 хөндийн
  хурдас (QIII-IV) · 6 голын голдирол (QIV) · 7 эолын элс · 8 үерийн татам.

  ⚠⚠ МАТЕРИАЛЫН ДУГААР `lib/latrine-sim.ts`-ийн `MATS`-тай ЯГ ИЖИЛ (0–6),
  нэмээд 7 = интрузив чулуулаг (боржин, пегматит). Нэвчилтийн симуляцийн
  бэлтгэгч (`build_latrine_sim.py`) кодгүй 62 олон өнцөгтийн ихэнхийг
  `NEWID`-ээр биш оноогоор таамагласан — энд `NEWID`-ээр ЗӨВ ангилна.

  Гаралт: WGS84 торон дээрх (≈40 м) ангилал, МӨР БҮРИЙГ RLE-ээр шахсан:
      rows  uint32 [ny+1] — мөр бүрийн эхний run-ийн индекс
      ends  uint16 [runs] — run-ийн баруун зах (онцгойгүй, баганаар)
      vals  uint8  [runs] — материал (255 = зураглалгүй)
  Формат нь бусад багцтай ижил: [4 байт толгойн урт][JSON][4-т эгнүүлсэн блокууд].

  ⚠ ЭХ СУРВАЛЖ БАЙХГҮЙ МАШИН ДЭЭР ЧИМЭЭГҮЙ ГАРНА — бүтээлт унахгүй.
  Ажиллуулах:  node scripts/build-geology.mjs
*/
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const SRC = "I:/Environment/us_hurs/UB Geology/UB_ground_classi";
const OUT = "public/data/ub-geology.bin";
const CELL_M = 40;

if (!existsSync(`${SRC}.shp`)) {
  console.log(`эх сурвалж алга (${SRC}.shp) — алгаслаа`);
  process.exit(0);
}

/* ── DBF ─────────────────────────────────────────────────────────── */
const dbf = readFileSync(`${SRC}.dbf`);
const nRec = dbf.readUInt32LE(4);
const headLen = dbf.readUInt16LE(8);
const recLen = dbf.readUInt16LE(10);
const fields = [];
for (let at = 32; dbf[at] !== 0x0d; at += 32) {
  fields.push({ name: dbf.toString("latin1", at, at + 11).replace(/\0.*$/, ""), len: dbf[at + 16] });
}
const dec = new TextDecoder("windows-1251");
const attrs = [];
for (let i = 0; i < nRec; i++) {
  let o = headLen + i * recLen + 1;
  const row = {};
  for (const f of fields) {
    row[f.name] = dec.decode(dbf.subarray(o, o + f.len)).trim();
    o += f.len;
  }
  attrs.push(row);
}

/* ── Материал ────────────────────────────────────────────────────── */
const NEWID_MAT = { 1: 6, 2: 5, 3: 2, 4: 3, 5: 1, 6: 0, 7: 4, 8: 0, 9: 1 };
function matOf(code, newid) {
  const c = code.trim();
  if (c.startsWith("QIII-IV")) return 1;
  if (c.startsWith("QIV")) return 0;
  if (c.startsWith("QIII")) return 3;
  if (c.startsWith("QII")) return 2;
  if (c.startsWith("eQIV")) return 4;
  if (c === "N") return 5;
  /* Хожуу триас – юрийн боржин (g = гранитоидын фаз), пегматит */
  if (/^T3-J1|\(g\d|^Pegmatit/i.test(c)) return 7;
  if (c) return 6; // C, D, K, R3-E1 — тунамал, хувирмал
  return NEWID_MAT[Number(newid)] ?? 255;
}

/* ── UTM 48N → WGS84 (Snyder 1987, урвуу Транcверс Меркатор) ─────── */
const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const LON0 = (105 * Math.PI) / 180;
function utmToLonLat(x, y) {
  x -= 500000;
  const M = y / K0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const p1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1);
  const c = Math.cos(p1);
  const t = Math.tan(p1);
  const C1 = EP2 * c * c;
  const T1 = t * t;
  const N1 = A / Math.sqrt(1 - E2 * s * s);
  const R1 = (A * (1 - E2)) / (1 - E2 * s * s) ** 1.5;
  const D = x / (N1 * K0);
  const lat =
    p1 -
    ((N1 * t) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon =
    LON0 +
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) / c;
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

/* ── SHP (Polygon = 5) ───────────────────────────────────────────── */
const shp = readFileSync(`${SRC}.shp`);
const shapes = [];
for (let at = 100, i = 0; at < shp.length; i++) {
  const len = shp.readInt32BE(at + 4) * 2;
  const o = at + 8;
  const type = shp.readInt32LE(o);
  if (type === 5) {
    const nParts = shp.readInt32LE(o + 36);
    const nPts = shp.readInt32LE(o + 40);
    const parts = [];
    for (let k = 0; k < nParts; k++) parts.push(shp.readInt32LE(o + 44 + 4 * k));
    const p0 = o + 44 + 4 * nParts;
    const rings = parts.map((s, k) => {
      const e = k + 1 < nParts ? parts[k + 1] : nPts;
      const r = [];
      for (let q = s; q < e; q++) r.push(utmToLonLat(shp.readDoubleLE(p0 + 16 * q), shp.readDoubleLE(p0 + 16 * q + 8)));
      return r;
    });
    shapes.push({ rings, mat: matOf(attrs[i].CODEGEOLC ?? "", attrs[i].NEWID ?? "") });
  }
  at = o + len;
}

/* ── Тор ─────────────────────────────────────────────────────────── */
let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
for (const sh of shapes)
  for (const r of sh.rings)
    for (const [x, y] of r) {
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, y);
      n = Math.max(n, y);
    }
const lat0 = ((s + n) / 2) * (Math.PI / 180);
const dy = CELL_M / 110574;
const dx = CELL_M / (111320 * Math.cos(lat0));
const nx = Math.ceil((e - w) / dx);
const ny = Math.ceil((n - s) / dy);
const grid = new Uint8Array(nx * ny).fill(255);

/* Мөр бүрийн төв дээр скан шугам — дүрс бүрийн БҮХ цагираг (нүх ч) тэгш-сондгой дүрмээр */
for (const sh of shapes) {
  let sy = Infinity, ny2 = -Infinity;
  for (const r of sh.rings)
    for (const [, y] of r) {
      sy = Math.min(sy, y);
      ny2 = Math.max(ny2, y);
    }
  const r0 = Math.max(0, Math.floor((sy - s) / dy));
  const r1 = Math.min(ny - 1, Math.ceil((ny2 - s) / dy));
  for (let row = r0; row <= r1; row++) {
    const yc = s + (row + 0.5) * dy;
    const xs = [];
    for (const r of sh.rings)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if (yi > yc !== yj > yc) xs.push(xi + ((yc - yi) * (xj - xi)) / (yj - yi));
      }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - w) / dx - 0.5));
      const c1 = Math.min(nx - 1, Math.floor((xs[k + 1] - w) / dx - 0.5));
      for (let c = c0; c <= c1; c++) grid[row * nx + c] = sh.mat;
    }
  }
}

/* ── RLE ─────────────────────────────────────────────────────────── */
const rows = new Uint32Array(ny + 1);
const ends = [];
const vals = [];
for (let row = 0; row < ny; row++) {
  rows[row] = ends.length;
  let v = grid[row * nx];
  for (let c = 1; c <= nx; c++) {
    const cur = c < nx ? grid[row * nx + c] : -1;
    if (cur !== v) {
      ends.push(c);
      vals.push(v);
      v = cur;
    }
  }
}
rows[ny] = ends.length;

const blocks = [
  { name: "rows", type: "uint32", data: Buffer.from(rows.buffer) },
  { name: "ends", type: "uint16", data: Buffer.from(new Uint16Array(ends).buffer) },
  { name: "vals", type: "uint8", data: Buffer.from(new Uint8Array(vals)) },
];
const BYTES = { uint8: 1, uint16: 2, uint32: 4 };
const header = { x0: w, y0: s, dx, dy, nx, ny, cell: CELL_M, source: "JICA 2013 UB ground model (UB_ground_classi)" };

/* ⚠ Толгойн урт блокийн офсетоос хамаардаг — урт ТОГТВОРЖТОЛ давтана
   (нэвчилтийн багцлагч яг хоёр дамжлагатай байхад эвдэрч байсан) */
const align = (v) => (v + 3) & ~3;
function layout(hl) {
  let at = align(4 + hl);
  const meta = blocks.map((b) => {
    const m = { name: b.name, type: b.type, offset: at, count: b.data.length / BYTES[b.type] };
    at = align(at + b.data.length);
    return m;
  });
  return { meta, total: at };
}
let head = Buffer.from(JSON.stringify({ ...header, blocks: layout(0).meta }));
for (let guard = 0; guard < 10; guard++) {
  const next = Buffer.from(JSON.stringify({ ...header, blocks: layout(head.length).meta }));
  if (next.length === head.length) {
    head = next;
    break;
  }
  head = next;
}
const { meta, total } = layout(head.length);
const out = Buffer.alloc(total);
out.writeUInt32LE(head.length, 0);
head.copy(out, 4);
blocks.forEach((b, i) => b.data.copy(out, meta[i].offset));
writeFileSync(OUT, out);

const counts = {};
for (const v of grid) counts[v] = (counts[v] ?? 0) + 1;
console.log(`${OUT} · ${(out.length / 1e6).toFixed(2)} МБ (gzip ${(gzipSync(out, { level: 9 }).length / 1e6).toFixed(2)} МБ)`);
console.log(`  дүрс ${shapes.length} · тор ${nx} × ${ny} (${CELL_M} м) · run ${ends.length.toLocaleString()}`);
console.log("  материал (нүд):", counts);
