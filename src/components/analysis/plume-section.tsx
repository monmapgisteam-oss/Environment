"use client";

import * as React from "react";
import { RE3, RN3, rampC, type Species } from "@/lib/latrine-sim-3d";
import type { DeepSection } from "@/lib/soil-plumes";

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
   ⚠ Гүний ус нь жорлон тус бүрийн түвшин (`--water`) — жорлонгүй сэмплд
   зурахгүй, хооронд нь холбохгүй (байхгүй түвшинг байгаа мэт харуулахгүй).
   ⚠ Шатлал 3D-тэй НЭГ (`RN3` / `RE3`).
   -------------------------------------------------------------------------- */

const LEFT = 34;
const BOTTOM = 16;

const niceStep = (span: number, n: number) => {
  const raw = span / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw;
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

  const W = Math.max(0, size.w - LEFT);
  const H = Math.max(0, size.h - BOTTOM);

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
    for (let i = 0; i < samples; i++) {
      const x = i * cw + cw / 2 - bw / 2;
      for (let r = 0; r < rows; r++) {
        const v = grid[i * rows + r];
        if (!v) continue;
        if (v === 1) g.fillStyle = "rgb(29,20,12)";
        else {
          const tt = (v - 2) / 253;
          const k = rampC(ramp, tt);
          g.fillStyle = `rgba(${k[0]},${k[1]},${k[2]},${0.45 + 0.55 * tt})`;
        }
        g.fillRect(x, r * rh, bw, rh + 0.5);
      }
      if (Number.isFinite(gw[i])) {
        g.fillStyle = "#5fa8ff";
        g.fillRect(i * cw + cw / 2 - Math.max(3, cw) / 2, (gw[i] / depth) * H - 1, Math.max(3, cw), 2);
      }
    }
    /* хүрээний булан */
    g.strokeStyle = "rgba(128,140,150,0.45)";
    g.setLineDash([3, 3]);
    g.lineWidth = 1;
    for (const s of deep.corners) {
      const x = Math.round((s / deep.length) * W) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    /* 2 м — хөрсний блокийн ёроол (3D-ийн өсгөлт солигдох гүн) */
    const y2 = Math.round((2 / depth) * H) + 0.5;
    g.beginPath();
    g.moveTo(0, y2);
    g.lineTo(W, y2);
    g.stroke();
    g.setLineDash([]);
  }, [deep, species, W, H]);

  const dStep = niceStep(deep.depth, 4);
  const dTicks: number[] = [];
  for (let d = 0; d <= deep.depth + 1e-6; d += dStep) dTicks.push(d);
  const km = deep.length / 1000;
  const xStep = niceStep(km, 6);
  const xTicks: number[] = [];
  for (let x = 0; x <= km + 1e-9; x += xStep) xTicks.push(x);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xs border border-line bg-paper-2">
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-line px-2.5 py-1.5">
        <span className="text-[12px] font-semibold tracking-[0.02em] text-ink uppercase">Бохирдлын нэвчилт · гүний ус хүртэл</span>
        <span className="num text-[11px] text-ink-3">
          {count.toLocaleString()} нүхэн жорлон · {years} жил · <span className="text-(--water)">▬</span> гүний ус
        </span>
      </div>
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={cv} className="absolute top-0" style={{ left: LEFT, width: W, height: H }} />
        {/* гүн, м */}
        {dTicks.map((d) => (
          <span
            key={d}
            className="num absolute right-[calc(100%-30px)] -translate-y-1/2 text-[10px] text-ink-3"
            style={{ top: Math.max(6, Math.min(H - 6, (d / deep.depth) * H)) }}
          >
            {d} м
          </span>
        ))}
        {/* зам дагуух зай, км */}
        {xTicks.map((x) => (
          <span key={x} className="num absolute -translate-x-1/2 text-[10px] text-ink-3" style={{ left: LEFT + (x / km) * W, top: H + 1 }}>
            {x.toLocaleString(undefined, { maximumFractionDigits: 2 })} км
          </span>
        ))}
      </div>
    </div>
  );
}
