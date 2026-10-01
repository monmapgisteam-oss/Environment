"use client";

import * as React from "react";
import { Card } from "@/components/analysis/ui";
import { R_BOTTOM } from "@/lib/soil-profile";
import type { Section } from "@/lib/soil-scene";
import { RE3, RN3, rampC, type Species } from "@/lib/latrine-sim-3d";
import { ROWS } from "@/lib/soil-plumes";

/* --------------------------------------------------------------------------
   ЗҮСЭЛТИЙН ХӨНДЛӨН ОГТЛОЛ — босоо зүсэлтийн шугамын дагуух хөрс

   Гурван хэмжээст блок дээр зүсэлтийн нүүр нь налуу өнцгөөс, ×800
   өсгөлттэй харагддаг тул үеийн зузааныг харьцуулахад хэцүү. Энд тэр
   нүүрийг ТЭГШЛЭЖ, бодит гүнээр (0–200 см) нь зурна:
     · дээд зурвас — гадаргын өндрийн профайл, м;
     · доод хэсэг — үе давхаргууд, хуулгатай НЭГ бүтцээр (хавтанцар);
     · тасархай шугам — гүний усны түвшин (2 метрээс дээш байвал).
   ⚠ Гүн нь ӨСГӨЛТГҮЙ, тэнхлэг дээр см-ээр бичигдэнэ — налуу, рельеф
   нь дээд зурвасанд тусдаа гардаг тул хоёр масштаб холилдохгүй.
   ⚠ Блокоос гадуурх хэсэг (элс, усан сан, зураглалгүй нэгж) ЗУРАГДАХГҮЙ
   — тасалдал нь өөрөө үнэн: тэнд профайл оноогдоогүй.
   Товшиход тэр цэгийн профайл "Сонгосон цэг" картад гарна.
   -------------------------------------------------------------------------- */

const W = 320;
const L = 34; // зүүн талын тэнхлэгийн шошго
const R = 8;
const EH = 44; // өндрийн зурвас
const GAP = 10;
const SH = 124; // хөрсний хэсэг
const AX = 20; // доод тэнхлэг
const H = EH + GAP + SH + AX;
const TOP = EH + GAP;

type Legend = { key: string; label: string; swatch: string }[];

export function SectionCard({
  section,
  legend,
  plumes,
  onPick,
}: {
  section: Section;
  legend: Legend;
  /** Зүсэлт дээрх бохирдол: (сэмпл × `ROWS`) ангилал, 0 нь бохирдолгүй */
  plumes: { grid: Uint8Array | null; species: Species } | null;
  onPick: (lon: number, lat: number) => void;
}) {
  const uid = React.useId().replace(/:/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const { samples, keys, length } = section;
  const n = samples.length;
  const x = (i: number) => L + ((W - L - R) * i) / (n - 1);
  const yd = (cm: number) => TOP + (Math.min(cm, R_BOTTOM) / R_BOTTOM) * SH;

  const geo = React.useMemo(() => {
    /* Үргэлжилсэн хэсгүүд — блокоос гадуурх цэг дээр тасарна */
    const runs: [number, number][] = [];
    let s0 = -1;
    samples.forEach((p, i) => {
      if (p.T && s0 < 0) s0 = i;
      if ((!p.T || i === n - 1) && s0 >= 0) {
        runs.push([s0, p.T ? i : i - 1]);
        s0 = -1;
      }
    });
    const elevs = samples.flatMap((p) => (p.elev == null ? [] : [p.elev]));
    const eMin = Math.min(...elevs);
    const eMax = Math.max(...elevs);
    const ye = (e: number) => 4 + (1 - (e - eMin) / Math.max(1, eMax - eMin)) * (EH - 8);

    const layers = keys.map((k, ki) => {
      let d = "";
      for (const [a, b] of runs) {
        let top = "";
        let bot = "";
        for (let i = a; i <= b; i++) {
          const T = samples[i].T!;
          let t = 0;
          for (let j = 0; j < ki; j++) t += T[j];
          top += `${i === a ? "M" : "L"}${x(i).toFixed(1)} ${yd(t).toFixed(1)}`;
          bot = `L${x(i).toFixed(1)} ${yd(t + T[ki]).toFixed(1)}` + bot;
        }
        d += top + bot + "Z";
      }
      return { k, d };
    });

    let elev = "";
    let elevFill = "";
    let gw = "";
    for (const [a, b] of runs) {
      let line = "";
      for (let i = a; i <= b; i++) line += `${i === a ? "M" : "L"}${x(i).toFixed(1)} ${ye(samples[i].elev!).toFixed(1)}`;
      elev += line;
      elevFill += `${line}L${x(b).toFixed(1)} ${EH}L${x(a).toFixed(1)} ${EH}Z`;
      /* ⚠ Гүний ус 2 метрээс ДООШ бол энд зурах зүйлгүй — шугам тасарна */
      let on = false;
      for (let i = a; i <= b; i++) {
        const g = samples[i].gw;
        if (g < R_BOTTOM) {
          gw += `${on ? "L" : "M"}${x(i).toFixed(1)} ${yd(g).toFixed(1)}`;
          on = true;
        } else on = false;
      }
    }
    return { layers, elev, elevFill, gw, eMin, eMax, ye };
  }, [samples, keys, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const swatch = Object.fromEntries(legend.map((l) => [l.key, l.swatch]));
  const km = length / 1000;
  const fmtKm = (v: number) => (km < 10 ? v.toFixed(1) : Math.round(v).toString());
  const hs = hover != null ? samples[hover] : null;

  const pointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((vx - L) / (W - L - R)) * (n - 1));
    setHover(i >= 0 && i < n && samples[i].T ? i : null);
  };

  return (
    <Card
      title="ХӨНДЛӨН ОГТЛОЛ"
      action={<span className="num text-[11px] text-ink-3">Урт {fmtKm(km)} км</span>}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full cursor-crosshair select-none"
        onPointerMove={pointer}
        onPointerLeave={() => setHover(null)}
        onClick={() => hs && onPick(hs.lon, hs.lat)}
        role="img"
        aria-label="Зүсэлтийн шугамын дагуух хөрсний хөндлөн огтлол"
      >
        <defs>
          {keys.map((k) => (
            <pattern key={k} id={`${uid}-${k}`} patternUnits="userSpaceOnUse" width="36" height="18">
              <image href={swatch[k]} width="36" height="18" preserveAspectRatio="none" />
            </pattern>
          ))}
        </defs>

        {/* Гадаргын өндөр */}
        <path d={geo.elevFill} fill="var(--data)" opacity="0.14" />
        <path d={geo.elev} fill="none" stroke="var(--data)" strokeWidth="1.2" />
        <text x={L - 4} y={10} textAnchor="end" className="num" fontSize="9" fill="var(--ink-3)">
          {Math.round(geo.eMax)}
        </text>
        <text x={L - 4} y={EH - 2} textAnchor="end" className="num" fontSize="9" fill="var(--ink-3)">
          {Math.round(geo.eMin)}
        </text>
        <text x={2} y={EH / 2 + 3} fontSize="9" fill="var(--ink-3)">
          м
        </text>

        {/* Үе давхаргууд */}
        {geo.layers.map((l) => (
          <path key={l.k} d={l.d} fill={`url(#${uid}-${l.k})`} />
        ))}
        {/* ⚠ БОХИРДОЛ — сэмпл бүрд тэр зайн жорлонгуудын ХАМГИЙН ИХ утга
            (`soil-plumes.ts`), 10 см-ийн мөрөөр; 3D-тэй НЭГ шатлал */}
        {plumes?.grid ? (
          <g pointerEvents="none">
            {Array.from(plumes.grid, (q, k) => {
              if (!q) return null;
              const i = Math.floor(k / ROWS);
              const r = k % ROWS;
              const tt = (q - 1) / 254;
              const w = Math.max(1.6, (W - L - R) / (n - 1));
              return (
                <rect
                  key={k}
                  x={x(i) - w / 2}
                  y={yd((r * R_BOTTOM) / ROWS)}
                  width={w}
                  height={SH / ROWS + 0.2}
                  fill={`rgb(${rampC(plumes.species === "N" ? RN3 : RE3, tt)})`}
                  opacity={0.45 + 0.55 * tt}
                />
              );
            })}
          </g>
        ) : null}
        {geo.gw ? <path d={geo.gw} fill="none" stroke="var(--water)" strokeWidth="1.4" strokeDasharray="4 3" /> : null}
        <rect x={L} y={TOP} width={W - L - R} height={SH} fill="none" stroke="var(--line-2)" />

        {/* Гүний тэнхлэг, см */}
        {[0, 100, 200].map((cm) => (
          <g key={cm}>
            <line x1={L - 3} x2={L} y1={yd(cm)} y2={yd(cm)} stroke="var(--line-2)" />
            <text x={L - 5} y={yd(cm) + 3} textAnchor="end" className="num" fontSize="9" fill="var(--ink-3)">
              {cm}
            </text>
          </g>
        ))}
        <text x={2} y={TOP + SH * 0.75 + 3} fontSize="9" fill="var(--ink-3)">
          см
        </text>

        {/* Зайн тэнхлэг, км */}
        {[0, 0.5, 1].map((f) => (
          <text
            key={f}
            x={L + (W - L - R) * f}
            y={H - 6}
            textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
            className="num"
            fontSize="9"
            fill="var(--ink-3)"
          >
            {f === 1 ? `${fmtKm(km)} км` : fmtKm(km * f)}
          </text>
        ))}

        {/* Заагч */}
        {hs ? (
          <g pointerEvents="none">
            <line x1={x(hover!)} x2={x(hover!)} y1={0} y2={TOP + SH} stroke="var(--ink)" strokeWidth="0.8" />
            <circle cx={x(hover!)} cy={geo.ye(hs.elev!)} r="2.4" fill="var(--data)" />
          </g>
        ) : null}
      </svg>

      <div className="mt-1.5 flex min-h-[16px] flex-wrap items-center justify-between gap-x-3 text-[11px] text-ink-3">
        {hs ? (
          <span className="num">
            {fmtKm(hs.d / 1000)} км · {Math.round(hs.elev!)} м
            {hs.gw < R_BOTTOM ? ` · гүний ус ${Math.round(hs.gw)} см` : ""}
          </span>
        ) : (
          <span>Товшиход тэр цэгийн профайл гарна</span>
        )}
        {geo.gw ? (
          <span className="inline-flex items-center gap-1">
            <svg width="16" height="6" aria-hidden>
              <line x1="0" x2="16" y1="3" y2="3" stroke="var(--water)" strokeWidth="1.4" strokeDasharray="4 3" />
            </svg>
            Гүний усны түвшин
          </span>
        ) : null}
      </div>
    </Card>
  );
}
