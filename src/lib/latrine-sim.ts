/*
  НҮХЭН ЖОРЛОНГИЙН НЭВЧИЛТИЙН СИМУЛЯЦИ — өгөгдөл ба загвар

  Эх сурвалж: `I:/Environment/us_hurs/leaching/UB_latrine_leaching_sim.html`
  (хэрэглэгч 2026-09-30: "ene html hurwuuleed oruul 3d hesgiig"). Тэр
  хуудас нь газрын зураг, 2D зүсэлт, график, 3D гэсэн дөрвөн хэсэгтэй;
  платформд ЗӨВХӨН 3D хэсэг ба түүнийг ажиллуулахад зайлшгүй зүйлс
  (жорлон сонгох, тохиргоо, цагийн тэнхлэг, үр дүн) орсон.

  Энэ файл нь эх хуудасны тооцооны хэсгийн ҮГ ҮСЭГЧЛЭН хөрвүүлэг —
  томьёо, коэффициент, дүрмийн дараалал ХӨНДӨГДӨӨГҮЙ:

  1. Нүхнээс гарах шингэн: Q = ам бүл × л/хүн/өдөр × 365/214 — хөрс 4–10
     дугаар сард л гэсэн (ACT0…ACT1), өвөл нэвчилт зогсоно.
  2. Хөрсөн дэх урсгал: нүхийг тэнхлэгтээ авсан тэгш хэмт r–z зүсэлтэд
     ханаагүй тогтвортой урсгал, Gardner-ийн квази-шугаман хувиргалт
     (K = Ks·e^(αh), Φ = K/α; Philip 1968): ∇²Φ − α·∂Φ/∂z = 0. Туузан
     матриц, Гауссын арилгалт, хоёр баруун талтай зэрэг.
  3. Чийг θ — van Genuchten–Mualem муруйгаар K/Ks-ээс (Carsel & Parrish
     1988, HYDRUS-ийн стандарт утга).
  4. Зөөвөрлөлт: ∂(θC)/∂t = −∇·(qC) + ∇·(θD∇C) − λθC; нитрат устахгүй,
     E.coli устана/шүүгдэнэ. D = 0.1 м·|v| (дагуу) + 0.01 м·|v| (хөндлөн).
  5. Гүний усанд холилдох: 1 га-гийн бүх жорлонгийн азот урсгалд
     холилдоно; ундны усны норм 50 мг/л NO₃ ≈ 11.3 мг/л NO₃-N.

  ⚠⚠ Энэ бол ОЙРОЛЦОО загвар, хэмжилт биш; анхдагчаар азот задрахгүй
  тул нитрат нь ДЭЭД ХЯЗГААРЫН үнэлгээ. Эдгээр тайлбар дэлгэцэд ГАРАХГҮЙ
  (арга зүйн тайлбарын дүрэм) — энд ба CLAUDE.md-д л.
*/
import { asset } from "@/lib/base-path";
import { arcgisJson } from "@/lib/arcgis";
import { PIT_SERVICE } from "@/lib/toilets";

/* ── Хөрсний ангилал: van Genuchten–Mualem, Carsel & Parrish (1988) ──
   thr, ths, α (1/м), n, Ks (м/өдөр); lamE — E.coli устах+шүүгдэх хурд (1/өдөр) */
export type Texture = { n: string; thr: number; ths: number; a: number; vn: number; Ks: number; lamE: number };
export const TEX: Record<string, Texture> = {
  sand: { n: "элс", thr: 0.045, ths: 0.43, a: 14.5, vn: 2.68, Ks: 7.128, lamE: 0.4 },
  lsand: { n: "шавранцар элс", thr: 0.057, ths: 0.41, a: 12.4, vn: 2.28, Ks: 3.502, lamE: 0.6 },
  sloam: { n: "элсэнцэр", thr: 0.065, ths: 0.41, a: 7.5, vn: 1.89, Ks: 1.061, lamE: 1.0 },
  loam: { n: "шавранцар", thr: 0.078, ths: 0.43, a: 3.6, vn: 1.56, Ks: 0.2496, lamE: 1.5 },
  cloam: { n: "шаварлаг шавранцар", thr: 0.095, ths: 0.41, a: 1.9, vn: 1.31, Ks: 0.0624, lamE: 2.0 },
};

/** Геологи (UB_ground_classi.shp) → хөрсний ангилал, уст давхаргын K (м/өдөр) */
export type Material = { n: string; t: keyof typeof TEX; Kaq: number; col: string; tex: string };
export const MATS: Material[] = (
  [
    { n: "Голоцены голын хурдас (хайрга, элс)", t: "sand", Kaq: 40, col: "#d9c9a3" },
    { n: "Хөндийн хурдас (элс, хайрга, шавранцар)", t: "sloam", Kaq: 10, col: "#c9b287" },
    { n: "Дэнжийн хурдас (хайрга)", t: "sand", Kaq: 20, col: "#d3c095" },
    { n: "Нуранги хурдас (сайр, чулуу)", t: "lsand", Kaq: 5, col: "#b9a27c" },
    { n: "Эолын элс", t: "lsand", Kaq: 5, col: "#e3d3a8" },
    { n: "Неогений шавар", t: "cloam", Kaq: 0.05, col: "#b07a5a" },
    { n: "Суурь чулуулаг (өгөршсөн, хагархай)", t: "loam", Kaq: 0.5, col: "#8f877c" },
  ] as const
).map((m) => ({ ...m, tex: TEX[m.t].n }));

/** Нүхний шингэн дэх E.coli, log10 CFU/100 мл */
export const C0E_LOG = 7;
/** кг N / хүн / жил */
export const N_PP = 4.5;
/** мг/л NO₃-N (= 50 мг/л NO₃) */
export const NORM_N = 11.3;
/** 4-р сарын 1 – 10-р сарын 31 (хөрс гэссэн үе), жилийн өдөр */
export const ACT0 = 90;
export const ACT1 = 304;
export const isWinter = (d: number) => {
  const y = d % 365;
  return y < ACT0 || y >= ACT1;
};

/* ── Өгөгдөл ─────────────────────────────────────────────────────── */

export type SimProfile = { name: string; key: string; hz: string; gw: string; perma: string };
type Header = {
  n: number;
  profiles: SimProfile[];
  khList: string[];
  gcodes: string[];
  blocks: { name: string; type: "uint8" | "uint16" | "int32"; offset: number; count: number }[];
};
export type SimData = {
  n: number;
  lon: Float32Array;
  lat: Float32Array;
  id: Int32Array;
  /** Анхдагч утгууд — эх сурвалжийн нэгжээр ×10 (gw, hh, pit) */
  gw: Uint16Array;
  hh: Uint8Array;
  pit: Uint8Array;
  /** Гүний усны гүний эх үүсвэр: 1 гар худаг, 2 хөрсний хүснэгт */
  src: Uint8Array;
  nwell: Uint8Array;
  mat: Uint8Array;
  dens: Uint8Array;
  soil: Uint8Array;
  valley: Uint8Array;
  kh: Uint8Array;
  gcode: Uint8Array;
  profiles: SimProfile[];
  khList: string[];
  gcodes: string[];
  tiles: Record<string, Blob>;
};

let pending: Promise<SimData> | null = null;
export function fetchLatrineSim(): Promise<SimData> {
  pending ??= loadSim().catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}

async function loadSim(): Promise<SimData> {
  // eslint-disable-next-line no-restricted-globals -- статик файл, портал биш
  const res = await fetch(asset("/data/latrine-sim.bin"));
  if (!res.ok) throw new Error(`Симуляцийн өгөгдөл уншигдсангүй (${res.status})`);
  const buf = await res.arrayBuffer();
  const headLen = new DataView(buf).getUint32(0, true);
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen))) as Header;
  const blk = (name: string) => h.blocks.find((b) => b.name === name)!;
  const u8 = (name: string) => {
    const b = blk(name);
    return new Uint8Array(buf, b.offset, b.count);
  };
  const u16 = (name: string) => {
    const b = blk(name);
    return new Uint16Array(buf, b.offset, b.count);
  };
  const idb = blk("id");
  const id = new Int32Array(buf, idb.offset, idb.count);
  const { lon, lat } = await fillCoords(id);
  const tiles: Record<string, Blob> = {};
  for (const b of h.blocks) if (b.name.startsWith("tile")) tiles[b.name.slice(4)] = new Blob([u8(b.name)], { type: "image/jpeg" });
  return {
    n: h.n,
    lon,
    lat,
    id,
    gw: u16("gw"),
    hh: u8("hh"),
    pit: u8("pit"),
    src: u8("src"),
    nwell: u8("nwell"),
    mat: u8("mat"),
    dens: u8("dens"),
    soil: u8("soil"),
    valley: u8("valley"),
    kh: u8("kh"),
    gcode: u8("gcode"),
    profiles: h.profiles,
    khList: h.khList,
    gcodes: h.gcodes,
    tiles,
  };
}

/**
 * Жорлон бүрийн байршил — ПОРТАЛААС, багцын `id`-аар холбож.
 *
 * ⚠⚠ Багцад координат БАЙХГҮЙ (`scripts/build-latrine-sim.mjs`-ийн
 * тэмдэглэлийг үз): `public/` нэвтрэлтгүй татагддаг, харин порталын
 * давхарга байгууллагын хүрээнд хаалттай. Тиймээс байршил зөвхөн
 * нэвтэрсэн хэрэглэгчид `arcgisJson`-оор (токентой) ирнэ.
 * ⚠ Дараалалд НАЙДАХГҮЙ — `id`-аар холбоно (дараалал одоо ижил ч порталд
 * засвар орвол өөрчлөгдөж болно). Холбогдоогүй жорлон `NaN` үлдэж,
 * зураг, сонголтоос чимээгүй хасагдана.
 * Хуудсууд 8-аар зэрэг; ~73 хуудас, `geometryPrecision 6` (~0.1 м).
 */
async function fillCoords(id: Int32Array) {
  const n = id.length;
  const at = new Map<number, number>();
  for (let i = 0; i < n; i++) at.set(id[i], i);
  const lon = new Float32Array(n).fill(NaN);
  const lat = new Float32Array(n).fill(NaN);
  const PAGE = 2000;
  const page = async (offset: number) => {
    const url = `${PIT_SERVICE}/query?${new URLSearchParams({
      f: "json",
      where: "1=1",
      outFields: "id",
      outSR: "4326",
      returnGeometry: "true",
      geometryPrecision: "6",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: "objectid ASC",
    })}`;
    const j = await arcgisJson<{ features?: { attributes: { id: number }; geometry?: { x: number; y: number } | null }[] }>(
      url,
      "Нүхэн жорлонгийн байршил",
    );
    for (const f of j.features ?? []) {
      const i = at.get(f.attributes.id);
      if (i == null || !f.geometry) continue;
      lon[i] = f.geometry.x;
      lat[i] = f.geometry.y;
    }
    return j.features?.length ?? 0;
  };
  const offs: number[] = [];
  for (let o = 0; o < n; o += PAGE) offs.push(o);
  for (let k = 0; k < offs.length; k += 8) await Promise.all(offs.slice(k, k + 8).map(page));
  return { lon, lat };
}

/** Нүхний ёроолоос гүний ус хүртэлх зайн анги: 0 хүрсэн · 1 <1.5 м · 2 1.5–5 м · 3 >5 м */
export function sepClass(d: SimData, i: number): number {
  const s = (d.gw[i] - d.pit[i]) / 10;
  return s <= 0.01 ? 0 : s < 1.5 ? 1 : s < 5 ? 2 : 3;
}

/**
 * `sepClass`-ийн дөрвөн ангиллын нэр, өнгө — эх хуудасны ангилал
 * платформын дохиогоор (`--clay` · улбар · `--ochre` · `--moss`).
 * ⚠ НЭГ эх сурвалж: "Нэвчилтийн симуляци"-ийн газрын зураг ба "Хөрсний
 * зүсэлт"-ийн жорлонгийн давхарга хоёулаа эндээс уншина — нэг жорлон
 * хоёр харагдацад өөр өнгөтэй байх ёсгүй. Зурагт орох тул тогтмол hex.
 */
export const SEP_CLASSES = [
  { label: "Нүх гүний усанд хүрсэн", color: "#e47b7b" },
  { label: "1.5 м-ээс бага", color: "#f59145" },
  { label: "1.5–5 м", color: "#e5b75a" },
  { label: "5 м-ээс их", color: "#67d7e4" },
] as const;

/* ── Хөрсний үе ──────────────────────────────────────────────────── */
export type Horizon = { n: string; t: number; b: number };
export function horizons(txt: string): Horizon[] {
  const out: { n: string; t: number; b: number | null }[] = [];
  let prev = 0;
  for (const tok of txt
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const nm = tok.split(" ")[0];
    const m = tok.match(/(\d+)\s*[–-]\s*(\d+)/);
    const p = tok.match(/(\d+)\s*\+/);
    let t = prev;
    let b: number | null = null;
    if (m) {
      t = +m[1];
      b = +m[2];
    } else if (p) t = +p[1];
    t = Math.max(t, prev);
    out.push({ n: nm, t, b });
    prev = b ?? t;
  }
  return out.map((o, i) => ({ n: o.n, t: o.t, b: o.b ?? (i + 1 < out.length ? out[i + 1].t : 150) }));
}
export function hzCol(n: string): string {
  const c = n.replace(/[^A-Za-zА-Яа-я]/g, "")[0] || "C";
  return ({ O: "#3a2a1c", T: "#3a2a1c", A: "#5b4330", B: "#8a6a48", C: "#b89e76", R: "#8d8a86" } as Record<string, string>)[c.toUpperCase()] || "#9c8566";
}

/* ── van Genuchten: K/Ks → θ ─────────────────────────────────────── */
export function thetaFromK(T: Texture) {
  const m = 1 - 1 / T.vn;
  const NS = 400;
  const se = new Float64Array(NS);
  const kr = new Float64Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = Math.pow(10, -6 + (6 * i) / (NS - 1));
    se[i] = s;
    kr[i] = Math.sqrt(s) * Math.pow(1 - Math.pow(1 - Math.pow(s, 1 / m), m), 2);
  }
  return (k: number) => {
    const r = Math.min(1, Math.max(0, k / T.Ks));
    if (r <= kr[0]) return T.thr + se[0] * (T.ths - T.thr);
    if (r >= 1) return T.ths;
    let lo = 0;
    let hi = NS - 1;
    while (hi - lo > 1) {
      const md = (lo + hi) >> 1;
      if (kr[md] < r) lo = md;
      else hi = md;
    }
    const f = (r - kr[lo]) / (kr[hi] - kr[lo]);
    return T.thr + (se[lo] + f * (se[hi] - se[lo])) * (T.ths - T.thr);
  };
}

/* ── Параметр ────────────────────────────────────────────────────── */
export type SimParams = {
  pit: number;
  gw: number;
  hh: number;
  years: number;
  wid: number;
  hw: number;
  lpp: number;
  fn: number;
  kaq: number;
  rch: number;
  dn: number;
  grad: number;
  mix: number;
  lamx: number;
  mat: number;
  dens: number;
  soil: number;
};

/** Жорлонгийн анхдагч тохиргоо (эх хуудасны `defaults`) */
export function defaultParams(d: SimData, i: number): SimParams {
  const m = MATS[d.mat[i]];
  return {
    pit: d.pit[i] / 10,
    gw: d.gw[i] / 10,
    hh: d.hh[i] / 10,
    years: 30,
    wid: 1.2,
    hw: 0.3,
    lpp: 1.5,
    fn: 0.5,
    kaq: m.Kaq,
    rch: 15,
    dn: 0,
    grad: d.valley[i] ? 0.005 : 0.01,
    mix: 5,
    lamx: 1,
    mat: d.mat[i],
    dens: d.dens[i],
    soil: d.soil[i],
  };
}

/* ── 2D урсгал: квази-шугаман (Gardner) тогтвортой урсгал, тэгш хэмт r–z ── */
export type Flow = ReturnType<typeof flowField>;
export function flowField(p: SimParams, T: Texture) {
  const al = T.a;
  const Ks = T.Ks;
  const PhiS = Ks / al;
  const gw = p.gw;
  const d = p.pit;
  const L = gw - d;
  const a = p.wid / Math.sqrt(Math.PI);
  const RW = 3.5; // нүхний хананаас хажуу тийш загварын өргөн, м (хил дээр урсгалгүй)
  let h = Math.min(0.4, Math.max(0.06, Math.sqrt((gw * (a + RW)) / 1500)));
  if (L > 0) h = Math.min(h, Math.max(0.03, L / 4));
  const nz = Math.max(4, Math.round(gw / h));
  h = gw / nz;
  const nr = Math.ceil((a + RW) / h);
  const R = nr * h;
  const ia = Math.max(1, Math.round(a / h));
  const jd = Math.min(nz - 1, Math.max(1, Math.round(d / h)));
  const jw = Math.max(0, jd - Math.max(1, Math.round(p.hw / h)));
  const nc = nr * nz;
  const typ = new Uint8Array(nc); // 0 хөрс, 1 норсон нүх, 2 хуурай нүх
  for (let j = 0; j < jd; j++) for (let i = 0; i < ia; i++) typ[j * nr + i] = j >= jw ? 1 : 2;
  const b = al / Math.expm1(al * h);
  const aa = b + al;
  const b2 = al / Math.expm1((al * h) / 2);
  const a2 = b2 + al;
  const qb = p.rch / 1000 / (ACT1 - ACT0); // гадаргаас нэвчих хур борооны ус, м/өдөр
  const diag = new Float64Array(nc);
  const kPit = new Float64Array(nc);
  const bOth = new Float64Array(nc);
  const cE = new Float64Array(nc);
  const cW = new Float64Array(nc);
  const cS = new Float64Array(nc);
  const cN = new Float64Array(nc);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nr; i++) {
      const k = j * nr + i;
      if (typ[k]) continue;
      const ri = (i + 0.5) * h;
      const Ae = (i + 1) * h;
      const Aw = i * h;
      const Av = ri;
      if (i < nr - 1) {
        diag[k] += Ae / h;
        cE[k] = Ae / h;
      }
      if (i > 0) {
        const t = typ[k - 1];
        if (t === 0) {
          diag[k] += Aw / h;
          cW[k] = Aw / h;
        } else if (t === 1) {
          diag[k] += Aw / h;
          kPit[k] += Aw / h;
        }
      }
      if (j === nz - 1) {
        diag[k] += Av * a2;
        bOth[k] += Av * b2 * PhiS;
      } else {
        diag[k] += Av * aa;
        cS[k] = Av * b;
      }
      if (j > 0) {
        const t = typ[k - nr];
        if (t === 0) {
          diag[k] += Av * b;
          cN[k] = Av * aa;
        } else if (t === 1) {
          diag[k] += Av * b;
          kPit[k] += Av * aa;
        }
      } else bOth[k] += Av * qb;
    }
  const soil: number[] = [];
  for (let k = 0; k < nc; k++) if (!typ[k]) soil.push(k);
  /* туузан матриц (өргөн = nr), Гауссын арилгалт — хоёр баруун талтай зэрэг */
  const bw = nr;
  const Wd = 2 * bw + 1;
  const A = new Float64Array(nc * Wd);
  const at = (r: number, c: number) => r * Wd + (c - r + bw);
  for (let k = 0; k < nc; k++) {
    if (typ[k]) {
      A[at(k, k)] = 1;
      continue;
    }
    A[at(k, k)] = diag[k];
    if (cE[k]) A[at(k, k + 1)] = -cE[k];
    if (cW[k]) A[at(k, k - 1)] = -cW[k];
    if (cS[k]) A[at(k, k + nr)] = -cS[k];
    if (cN[k]) A[at(k, k - nr)] = -cN[k];
  }
  const U1 = Float64Array.from(kPit);
  const U2 = Float64Array.from(bOth);
  for (let k = 0; k < nc; k++) {
    const pv = A[at(k, k)];
    const cmax = Math.min(nc - 1, k + bw);
    for (let r = k + 1; r <= cmax; r++) {
      const f = A[at(r, k)] / pv;
      if (f === 0) continue;
      for (let c = k; c <= cmax; c++) A[at(r, c)] -= f * A[at(k, c)];
      U1[r] -= f * U1[k];
      U2[r] -= f * U2[k];
    }
  }
  for (let k = nc - 1; k >= 0; k--) {
    const cmax = Math.min(nc - 1, k + bw);
    let s1 = U1[k];
    let s2 = U2[k];
    for (let c = k + 1; c <= cmax; c++) {
      const v = A[at(k, c)];
      if (v) {
        s1 -= v * U1[c];
        s2 -= v * U2[c];
      }
    }
    const pv = A[at(k, k)];
    U1[k] = s1 / pv;
    U2[k] = s2 / pv;
  }
  for (let k = 0; k < nc; k++)
    if (typ[k]) {
      U1[k] = 0;
      U2[k] = 0;
    }
  /* нүхнээс хөрсөнд орох урсгал (нормчилсон) */
  const pitIn = (U: Float64Array, Pv: number) => {
    let q = 0;
    for (const k of soil) {
      const i = k % nr;
      const j = (k - i) / nr;
      if (i > 0 && typ[k - 1] === 1) q += ((i * h) / h) * (Pv - U[k]);
      if (j > 0 && typ[k - nr] === 1) q += (i + 0.5) * h * (aa * Pv - b * U[k]);
    }
    return q;
  };
  const Q1 = pitIn(U1, 1) * 2 * Math.PI * h;
  const Q2 = pitIn(U2, 0) * 2 * Math.PI * h;
  const Qt = ((p.hh * p.lpp) / 1000) * (365 / (ACT1 - ACT0));
  let Phi0 = (Qt - Q2) / Q1;
  let pond = false;
  if (Phi0 > PhiS) {
    Phi0 = PhiS;
    pond = true;
  }
  const Phi = new Float64Array(nc);
  for (let k = 0; k < nc; k++) Phi[k] = typ[k] === 1 ? Phi0 : Phi0 * U1[k] + U2[k];
  const Qin = Phi0 * Q1 + Q2;
  /* нүүрний урсгал, м³/өдөр (эерэг = гадагш, доош) */
  const tw = 2 * Math.PI * h;
  const Fe = new Float64Array(nc);
  const Fs = new Float64Array(nc);
  const Fp = new Float64Array(nc);
  const FpR = new Float64Array(nc);
  const FpZ = new Float64Array(nc);
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    const ri = (i + 0.5) * h;
    const Ae = (i + 1) * h;
    Fe[k] = (i === nr - 1 || typ[k + 1] ? 0 : (Ae / h) * (Phi[k] - Phi[k + 1])) * tw;
    Fs[k] = (j === nz - 1 ? ri * (a2 * Phi[k] - b2 * PhiS) : ri * (aa * Phi[k] - b * Phi[k + nr])) * tw;
    if (i > 0 && typ[k - 1] === 1) FpR[k] = ((i * h) / h) * (Phi0 - Phi[k]) * tw;
    if (j > 0 && typ[k - nr] === 1) FpZ[k] = ri * (aa * Phi0 - b * Phi[k]) * tw;
    Fp[k] = FpR[k] + FpZ[k];
  }
  return { h, nr, nz, R, a, ia, jd, jw, typ, soil, Phi, Phi0, PhiS, Fe, Fs, Fp, FpR, FpZ, Qin, Qt, pond, al, qb };
}

/* ── СИМУЛЯЦИ ────────────────────────────────────────────────────── */
export type Snap = {
  d: number;
  qN?: Uint8Array;
  qE?: Uint8Array;
  botN: number;
  elog: number;
  Cgw: number;
  latN: number;
  latE: number;
};
export type SimResult = {
  L: number;
  C0N: number;
  snaps: Snap[];
  tN: number | null;
  tE: number | null;
  tNorm: number | null;
  maxElog: number;
  latN: number;
  latE: number;
  Qth: number;
  V: number;
  direct: boolean;
  T: Texture;
  M: Material;
  Qin: number;
  pond?: boolean;
  F?: Flow;
  TH?: Float64Array;
  vR?: Float32Array;
  vZ?: Float32Array;
  lamE?: number;
  Cgw: number;
};

export function simulate(p: SimParams): SimResult {
  const M = MATS[p.mat];
  const T = TEX[M.t];
  const L = p.gw - p.pit;
  const Qd = (p.hh * p.lpp) / 1000; // м³/өдөр (жилийн дундаж)
  const C0N = (p.fn * N_PP * p.hh * 1e6) / (Qd * 1000 * 365); // мг/л NO₃-N нүхний шингэнд
  const lamE = T.lamE * p.lamx;
  const days = p.years * 365;
  const SNAP = 15;
  const V = 1e4 * p.mix * 0.25;
  const Qth = p.kaq * p.grad * p.mix * 100 + (p.rch / 1000) * (1e4 / 365) + p.dens * Qd;
  const kDn = p.dn > 0 ? Math.LN2 / (p.dn * 365) : 0;
  const out: SimResult = {
    L, C0N, snaps: [], tN: null, tE: null, tNorm: null, maxElog: -9, latN: 0, latE: 0,
    Qth, V, direct: L <= 0.05, T, M, Qin: 0, Cgw: 0,
  };
  let Cgw = 0;
  if (out.direct) {
    /* нүх гүний усанд шууд */
    const Qa = (Qd * 365) / (ACT1 - ACT0);
    out.Qin = Qa;
    for (let d = 0; d < days; d++) {
      const doy = d % 365;
      const act = doy >= ACT0 && doy < ACT1;
      const J = act ? Qa * 1000 * C0N : 0;
      Cgw += (p.dens * J) / (V * 1000) - (Cgw * Qth) / V - Cgw * kDn;
      if (out.tN == null && act) out.tN = d;
      if (out.tE == null && act) out.tE = d;
      if (out.tNorm == null && Cgw >= NORM_N) out.tNorm = d;
      if (d % SNAP === 0) out.snaps.push({ d, botN: act ? C0N : 0, elog: act ? C0E_LOG : 0, Cgw, latN: 0, latE: 0 });
    }
    out.maxElog = C0E_LOG;
    out.Cgw = Cgw;
    return out;
  }
  const F = flowField(p, T);
  Object.assign(out, { F, pond: F.pond, Qin: F.Qin });
  const { h, nr, nz, soil, typ, Fe, Fs, Fp, Phi } = F;
  const nc = nr * nz;
  const th = thetaFromK(T);
  const TH = new Float64Array(nc);
  const VOL = new Float64Array(nc);
  for (const k of soil) {
    const i = k % nr;
    TH[k] = th(F.al * Phi[k]);
    VOL[k] = 2 * Math.PI * (i + 0.5) * h * h * h;
  }
  /* эсийн хурд (дисперсэд) */
  const vr = new Float64Array(nc);
  const vz = new Float64Array(nc);
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    const ri = (i + 0.5) * h;
    const finR = i > 0 && !typ[k - 1] ? Fe[k - 1] : 0;
    const finZ = j > 0 && !typ[k - nr] ? Fs[k - nr] : 0;
    vr[k] = (Math.abs(Fe[k]) + Math.abs(finR)) / 2 / (2 * Math.PI * Math.max(ri, h / 2) * h * TH[k]);
    vz[k] = (Math.abs(Fs[k]) + Math.abs(finZ) + Fp[k]) / 2 / (2 * Math.PI * ri * h * TH[k]);
  }
  /* харагдацад: эсийн төв дэх нүх сүвний хурд (м/өдөр), r — гадагш, z — доош эерэг */
  const vR = new Float32Array(nc);
  const vZ = new Float32Array(nc);
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    const ri = (i + 0.5) * h;
    const inR = i > 0 && !typ[k - 1] ? Fe[k - 1] : F.FpR[k];
    const inZ = j > 0 && !typ[k - nr] ? Fs[k - nr] : j === 0 ? F.qb * 2 * Math.PI * ri * h : F.FpZ[k];
    vR[k] = (inR + Fe[k]) / 2 / (2 * Math.PI * ri * h * TH[k]);
    vZ[k] = (inZ + Fs[k]) / 2 / (2 * Math.PI * ri * h * TH[k]);
  }
  Object.assign(out, { TH, vR, vZ, lamE });
  const aL = 0.1;
  const aT = 0.01;
  const Dm = 1e-5;
  const Te = new Float64Array(nc);
  const Ts = new Float64Array(nc); // дисперсийн дамжуулалт, м³/өдөр
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    const ri = (i + 0.5) * h;
    if (i < nr - 1 && !typ[k + 1]) {
      const t = (TH[k] + TH[k + 1]) / 2;
      const A = 2 * Math.PI * (i + 1) * h * h;
      const v = Math.abs(Fe[k]) / (A * t);
      Te[k] = (t * (aL * v + (aT * (vz[k] + vz[k + 1])) / 2 + Dm) * A) / h;
    }
    if (j < nz - 1) {
      const t = (TH[k] + TH[k + nr]) / 2;
      const A = 2 * Math.PI * ri * h;
      const v = Math.abs(Fs[k]) / (A * t);
      Ts[k] = (t * (aL * v + (aT * (vr[k] + vr[k + nr])) / 2 + Dm) * A) / h;
    }
  }
  /* тогтвортой хугацааны алхам */
  let rate = 0;
  for (const k of soil) {
    const i = k % nr;
    const j = (k - i) / nr;
    let o = Math.max(0, Fe[k]) + Math.max(0, Fs[k]) + Te[k] + Ts[k];
    if (i > 0 && !typ[k - 1]) o += Math.max(0, -Fe[k - 1]) + Te[k - 1];
    if (j > 0 && !typ[k - nr]) o += Math.max(0, -Fs[k - nr]) + Ts[k - nr];
    rate = Math.max(rate, o / (TH[k] * VOL[k]));
  }
  const sub = Math.max(1, Math.ceil(rate / 0.9));
  const dt = 1 / sub;
  const cN = new Float64Array(nc);
  const cE = new Float64Array(nc);
  const dN = new Float64Array(nc);
  const dE = new Float64Array(nc);
  const decE = Math.exp(-lamE * dt);
  for (let d = 0; d < days; d++) {
    const doy = d % 365;
    const act = doy >= ACT0 && doy < ACT1;
    let Jrel = 0;
    for (let s = 0; s < sub; s++) {
      if (act) {
        dN.fill(0);
        dE.fill(0);
        for (const k of soil) {
          const fp = Fp[k];
          if (fp > 0) {
            dN[k] += fp;
            dE[k] += fp;
          } else if (fp < 0) {
            dN[k] += fp * cN[k];
            dE[k] += fp * cE[k];
          } // нүхнээс C = 1
          const i = k % nr;
          const j = (k - i) / nr;
          /* хажуу нүүр */
          const fe = Fe[k];
          if (i === nr - 1) {
            if (fe > 0) {
              dN[k] -= fe * cN[k];
              dE[k] -= fe * cE[k];
            }
          } else if (!typ[k + 1]) {
            const e = k + 1;
            const fn = fe > 0 ? fe * cN[k] : fe * cN[e];
            const fE = fe > 0 ? fe * cE[k] : fe * cE[e];
            const t = Te[k];
            const xN = fn + t * (cN[k] - cN[e]);
            const xE = fE + t * (cE[k] - cE[e]);
            dN[k] -= xN;
            dN[e] += xN;
            dE[k] -= xE;
            dE[e] += xE;
          }
          /* доод нүүр */
          const fs = Fs[k];
          if (j === nz - 1) {
            if (fs > 0) {
              dN[k] -= fs * cN[k];
              dE[k] -= fs * cE[k];
              Jrel += fs * cN[k] * dt;
            }
          } else {
            const sI = k + nr;
            const fn = fs > 0 ? fs * cN[k] : fs * cN[sI];
            const fE = fs > 0 ? fs * cE[k] : fs * cE[sI];
            const t = Ts[k];
            const xN = fn + t * (cN[k] - cN[sI]);
            const xE = fE + t * (cE[k] - cE[sI]);
            dN[k] -= xN;
            dN[sI] += xN;
            dE[k] -= xE;
            dE[sI] += xE;
          }
        }
        for (const k of soil) {
          const w = dt / (TH[k] * VOL[k]);
          cN[k] += dN[k] * w;
          cE[k] = (cE[k] + dE[k] * w) * decE;
        }
      } else for (const k of soil) cE[k] *= decE;
    }
    const J = Jrel * 1000 * C0N; // мг/өдөр гүний усанд
    Cgw += (p.dens * J) / (V * 1000) - (Cgw * Qth) / V - Cgw * kDn;
    /* гүний усны гадарга дээрх концентраци (урсгалаар жигнэсэн), E.coli-ийн их утга */
    let fw = 0;
    let cw = 0;
    let emax = 0;
    for (let i = 0; i < nr; i++) {
      const k = (nz - 1) * nr + i;
      if (typ[k]) continue;
      const f = Math.max(0, Fs[k]);
      fw += f * cN[k];
      cw += f;
      if (cE[k] > emax) emax = cE[k];
    }
    const botRel = cw > 0 ? fw / cw : 0;
    const elog = C0E_LOG + Math.log10(Math.max(emax, 1e-30));
    if (out.tN == null && botRel >= 0.01) out.tN = d;
    if (elog > out.maxElog) out.maxElog = elog;
    if (out.tE == null && elog >= 0) out.tE = d;
    if (out.tNorm == null && Cgw >= NORM_N) out.tNorm = d;
    if (d % SNAP === 0) {
      const qN = new Uint8Array(nc);
      const qE = new Uint8Array(nc);
      let lN = 0;
      let lE = 0;
      for (const k of soil) {
        const i = k % nr;
        const n = cN[k];
        if (n > 1e-3) qN[k] = Math.min(255, 1 + Math.round((254 * Math.log10(n * 1000)) / 3));
        const e = C0E_LOG + Math.log10(Math.max(cE[k], 1e-30));
        if (e > 0) qE[k] = Math.min(255, 1 + Math.round((254 * e) / C0E_LOG));
        if (n >= 0.01) lN = Math.max(lN, (i + 1) * h);
        if (e >= 0) lE = Math.max(lE, (i + 1) * h);
      }
      out.latN = Math.max(out.latN, lN);
      out.latE = Math.max(out.latE, lE);
      out.snaps.push({ d, qN, qE, botN: botRel * C0N, elog, Cgw, latN: lN, latE: lE });
    }
  }
  out.Cgw = Cgw;
  return out;
}

/** Хугацааг ашиглаж эхэлснээс (4-р сарын 1) — эх хуудасны `fmtY` */
export function fmtSince(d: number | null): string {
  if (d == null) return "–";
  const e = Math.max(0, d - ACT0);
  const y = e / 365;
  return y < 1 ? `${Math.max(1, Math.round(e / 30.4))} сар` : `${y.toFixed(y < 10 ? 1 : 0)} жил`;
}
