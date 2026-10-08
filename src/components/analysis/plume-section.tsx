"use client";

import * as React from "react";
import { RE3, RN3, rampC, type Species } from "@/lib/latrine-sim-3d";
import type { DeepSection } from "@/lib/soil-plumes";
import { MATS } from "@/lib/latrine-sim";

/* --------------------------------------------------------------------------
   БОХИРДЛЫН НЭВЧИЛТ — ГҮНИЙ УС ХҮРТЭЛХ 2D ХӨНДЛӨН ОГТЛОЛ

   Хэрэглэгч 2026-10-01: "zuselt zurah 2-iig hiihed bohirdol simulation
   haragdmaar bn" → "хоёулаа" (3D гүний хэсэг БА энэ диаграм).
   Хөрсний зүсэлтийн 3D-ийн ДООР бүтэн өргөнөөр: хэвтээ нь зүсэлтийн
   шугам (эсвэл зурсан талбайн хүрээ) дагуух зай, босоо нь 0 м-ээс гүний
   ус хүртэл — ӨСГӨЛТГҮЙ метрээр (3D-ийн ×800 / ×100 биш).
   Тор нь {@link src/lib/soil-plumes.ts}-ийн `deep`: сэмпл бүрд тэр зайн
   жорлонгуудын ХАМГИЙН ИХ утга. Жорлон ±4 м өргөн, зам хэдэн км тул
   жорлон бүр НЭГ сэмплийн босоо багана болж, цаг явахад доош уртсана.

   ⚠ Нүд олон (300 × 160) тул SVG биш CANVAS; тэнхлэгийн бичвэр HTML.
   ⚠ Гүний ус нь жорлон тус бүрийн түвшин (▽, геотехникийн зүсэлтийн
   тэмдэг) — жорлонгүй сэмплд зурахгүй, хооронд нь холбохгүй (байхгүй
   түвшинг байгаа мэт харуулахгүй). ⚠ Түүнээс доош ус ханасан бүсийг
   баганаар будаж үзсэн — гэр хорооллын нягт жорлон дээр цэнхэр судал
   болж шуугиан үүсгэсэн тул ХАССАН.
   ⚠ Шатлал 3D-тэй НЭГ (`RN3` / `RE3`).
   ⚠ 0–2 м нь ХӨРС (бор дэвсгэр), 2 м-ээс ДООШ нь ГЕОЛОГИ (JICA 2013,
   `MATS`-ийн өнгө); бохирдол түүн дээгүүр зурагдана.
   ⚠ Дэвсгэрийг ижил материалын дараалсан сэмплээр НЭГ тэгш өнцөгт болгож
   зурна: сэмпл тутамд тунгалаг дөрвөлжин давхцуулахад заагууд давхар
   бүдэгшиж босоо СУДАЛ болж харагддаг байв (хэрэглэгч 2026-10-07: "design
   saijruul").
   ⚠ Канвасын өнгө ТОГТМОЛ hex — зурагтай адил горимоос үл хамаарна.
   -------------------------------------------------------------------------- */

const LEFT = 38;
const RIGHT = 10;
const BOTTOM = 18;
/* Газрын гадаргын шугам дээд ирмэгт наалдаж алга болохгүй */
const TOP = 6;
/* Хөрсний дэвсгэр (0–2 м) — 3D блоктой нэг гэр бүлийн бор */
const SOIL = "#8a6a4a";
/* Гүний ус — `--water`-ийн тогтмол hex */
const WATER = "#5fa8ff";

const niceStep = (span: number, n: number) => {
  const raw = span / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw;
};
/* Гүний тэмдэглэгээ — тэнхлэгийн бичвэр ба хэвтээ тор НЭГ жагсаалтаас */
const ticks = (depth: number) => {
  const step = niceStep(depth, 4);
  const out: number[] = [];
  for (let d = 0; d <= depth + 1e-6; d += step) out.push(d);
  return out;
};

export function PlumeSection({ deep, species, years, count }: { deep: DeepSection; species: Species; years: string; count: number }) {
  const box = React.useRef<HTMLDivElement>(null);
  const cv = React.useRef<HTMLCanvasElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(0, size.w - LEFT - RIGHT);
  const H = Math.max(0, size.h - BOTTOM - TOP);

  React.useEffect(() => {
    const c = cv.current;
    if (!c || !W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const { grid, samples, rows, depth, gw } = deep;
    const cw = W / samples;
    const rh = H / rows;
    const ramp = species === "N" ? RN3 : RE3;
    /* багана бүр дор хаяж 2 пиксел — нарийн зам дээр жорлон алга болохгүй */
    const bw = Math.max(2, cw);
    const yOf = (d: number) => (d / depth) * H;
    const y2 = yOf(2);
    /* ── дэвсгэр: хөрс, дараа нь геологи (ижил материалын дараалал НЭГ тэгш өнцөгт) ── */
    g.globalAlpha = 0.24;
    g.fillStyle = SOIL;
    g.fillRect(0, 0, W, y2);
    g.globalAlpha = 0.3;
    for (let i = 0; i < samples; ) {
      const m = deep.geo[i];
      let j = i + 1;
      while (j < samples && deep.geo[j] === m) j++;
      if (m !== 255 && MATS[m]) {
        const x0 = Math.round(i * cw);
        g.fillStyle = MATS[m].col;
        g.fillRect(x0, y2, Math.round(j * cw) - x0, H - y2);
      }
      i = j;
    }
    g.globalAlpha = 1;
    /* ── гүний хэвтээ тор ── */
    g.strokeStyle = "rgba(128,140,150,0.2)";
    g.lineWidth = 1;
    for (const d of ticks(depth)) {
      if (d === 0) continue;
      const y = Math.round(yOf(d)) + 0.5;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    /* ── бохирдол ── */
    for (let i = 0; i < samples; i++) {
      const x = i * cw + cw / 2 - bw / 2;
      for (let r = 0; r < rows; r++) {
        const v = grid[i * rows + r];
        /* ⚠ 1 = НҮХ — зурахгүй (хэрэглэгч 2026-10-06: "jorlongiin guniig
           haruulahgui zugeer bohirdliig ni"); нүхний гүн нь хэмжилт биш
           загварын анхдагч тул бохирдол л харагдана */
        if (v < 2) continue;
        const tt = (v - 2) / 253;
        const k = rampC(ramp, tt);
        g.fillStyle = `rgba(${k[0]},${k[1]},${k[2]},${0.55 + 0.45 * tt})`;
        g.fillRect(x, r * rh, bw, rh + 0.5);
      }
    }
    /* ── гүний усны түвшин ▽ ── */
    g.fillStyle = WATER;
    for (let i = 0; i < samples; i++) {
      if (!Number.isFinite(gw[i])) continue;
      const cx = i * cw + cw / 2;
      const y = yOf(gw[i]);
      g.fillRect(cx - 4, y - 0.75, 8, 1.5);
      g.beginPath();
      g.moveTo(cx - 3.5, y - 7);
      g.lineTo(cx + 3.5, y - 7);
      g.lineTo(cx, y - 2);
      g.closePath();
      g.fill();
    }
    /* хүрээний булан */
    g.strokeStyle = "rgba(128,140,150,0.5)";
    g.setLineDash([3, 3]);
    for (const s of deep.corners) {
      const x = Math.round((s / deep.length) * W) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    /* 2 м — хөрсний блокийн ёроол */
    g.strokeStyle = "rgba(170,140,110,0.75)";
    g.beginPath();
    g.moveTo(0, Math.round(y2) + 0.5);
    g.lineTo(W, Math.round(y2) + 0.5);
    g.stroke();
    g.setLineDash([]);
    /* газрын гадарга */
    g.strokeStyle = "rgba(200,180,150,0.95)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, 0.75);
    g.lineTo(W, 0.75);
    g.stroke();
  }, [deep, species, W, H]);

  /* Зам дээр тохиолдсон геологи — тайлбарт */
  const present = [...new Set(deep.geo)].filter((m) => m !== 255 && MATS[m]).sort((a, b) => a - b);

  const dTicks = ticks(deep.depth);
  const km = deep.length / 1000;
  const xStep = niceStep(km, 6);
  const xTicks: number[] = [];
  for (let x = 0; x <= km + 1e-9; x += xStep) xTicks.push(x);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xs border border-line bg-paper-2">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-2.5 py-1.5">
        <span className="text-[12px] font-semibold tracking-[0.02em] text-ink uppercase">Бохирдлын нэвчилт · гүний ус хүртэл</span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-2">
          <Swatch color={SOIL} label="Хөрс, 0–2 м" />
          {present.map((m) => (
            <Swatch key={m} color={MATS[m].col} label={MATS[m].n.replace(/\s*\(.*\)$/, "")} title={MATS[m].n} />
          ))}
          <span className="inline-flex items-center gap-1">
            <svg width="10" height="9" viewBox="0 0 10 9" aria-hidden>
              <path d="M1.5 0.5h7L5 5.5z" fill={WATER} />
              <rect x="0.5" y="7" width="9" height="1.5" fill={WATER} />
            </svg>
            Гүний усны түвшин
          </span>
        </span>
        <span className="num shrink-0 text-[11px] text-ink-3">
          {count.toLocaleString()} нүхэн жорлон · {years} жил
        </span>
      </div>
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={cv} className="absolute" style={{ left: LEFT, top: TOP, width: W, height: H }} />
        {/* гүн, м */}
        {dTicks.map((d) => (
          <span
            key={d}
            className="num absolute -translate-y-1/2 text-[10px] text-ink-3"
            style={{ right: `calc(100% - ${LEFT - 6}px)`, top: TOP + (d / deep.depth) * H }}
          >
            {d} м
          </span>
        ))}
        {/* зам дагуух зай, км */}
        {xTicks.map((x) => (
          <span
            key={x}
            className="num absolute -translate-x-1/2 text-[10px] text-ink-3"
            style={{ left: LEFT + (x / km) * W, top: TOP + H + 2 }}
          >
            {x.toLocaleString(undefined, { maximumFractionDigits: 2 })} км
          </span>
        ))}
      </div>
    </div>
  );
}

function Swatch({ color, label, title }: { color: string; label: string; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={title ?? label}>
      <span className="inline-block h-2 w-3 rounded-xs" style={{ background: color, opacity: 0.8 }} />
      {label}
    </span>
  );
}
