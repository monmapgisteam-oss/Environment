"use client";

import * as React from "react";
import { cn, num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Босоо баганан диаграм — он, сар зэрэг дараалалтай хэмжигдэхүүнд.
   Товшиход шүүлтүүр болно (cross-filter).
   -------------------------------------------------------------------------- */

export type Datum = {
  key: string;
  label: string;
  value: number;
  /** Толь бичиг дэх байрлал — өнгө сонгоход хэрэглэнэ */
  rank?: number;
};

export function BarChart({
  data,
  height = 130,
  tone = "var(--data)",
  selected,
  onSelect,
  formatTick,
}: {
  data: Datum[];
  height?: number;
  tone?: string;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  formatTick?: (d: Datum, i: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const interactive = Boolean(onSelect);

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d) => {
          const on = selected == null || selected === d.key;
          return (
            <button
              key={d.key}
              type="button"
              disabled={!interactive}
              onClick={() => onSelect?.(selected === d.key ? null : d.key)}
              title={`${d.label} · ${num(d.value)}`}
              className={cn(
                "group relative flex h-full flex-1 items-end",
                interactive && "cursor-pointer",
              )}
            >
              <span
                className="w-full rounded-t-[1px] transition-[height,background-color,opacity]"
                style={{
                  height: `${Math.max((d.value / max) * 100, d.value > 0 ? 1.5 : 0)}%`,
                  background: tone,
                  opacity: on ? 1 : 0.22,
                }}
              />
              {interactive ? (
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: `color-mix(in oklab, ${tone} 12%, transparent)` }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {data.map((d, i) => (
          <span
            key={d.key}
            className={cn(
              "num flex-1 text-center text-[10px] transition-colors",
              selected === d.key ? "text-ink" : "text-ink-3",
            )}
          >
            {formatTick ? formatTick(d, i) : d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Талбайт диаграм — дараалалтай хэмжигдэхүүний хэлбэрийг харуулна.
   Товшиход шүүлтүүр болно (cross-filter).
   -------------------------------------------------------------------------- */

/**
 * Монотон куб интерполяци (Fritsch–Carlson).
 * Энгийн Catmull-Rom бол оргилоос хальж, тэгээс доош унах тул тоон утгад
 * тохирохгүй. Энэ арга нь өгөгдлийн дараалал (өсөх/буурах)-ыг зөрчихгүй.
 */
function smoothPath(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return "";

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    slope[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }

  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0; // эргэлтийн цэг — хальж гарахгүй
    } else {
      m[i] = (slope[i - 1] + slope[i]) / 2;
      const lim = 3 * Math.min(Math.abs(slope[i - 1]), Math.abs(slope[i]));
      if (Math.abs(m[i]) > lim) m[i] = Math.sign(m[i]) * lim;
    }
  }

  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (m[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${pts[
      i + 1
    ].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

export function AreaChart({
  data,
  height = 96,
  tone = "var(--data)",
  selected,
  onSelect,
  formatTick,
  unit = "бүртгэл",
}: {
  data: Datum[];
  height?: number;
  tone?: string;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  formatTick?: (d: Datum, i: number) => string;
  /** Hover самбарт гарах хэмжих нэгж */
  unit?: string;
}) {
  const gid = React.useId().replace(/:/g, "");
  const [hover, setHover] = React.useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((a, d) => a + d.value, 0);
  const interactive = Boolean(onSelect);

  if (data.length < 2) {
    return <div className="py-6 text-center text-[12px] text-ink-3">Утга алга</div>;
  }

  const W = 100;
  const pad = 3; // дээд талд зай — оргил тасрахгүй
  const xs = (i: number) => (i / (data.length - 1)) * W;
  const ys = (v: number) => pad + (1 - v / max) * (height - pad);

  const pts = data.map((d, i) => ({ x: xs(i), y: ys(d.value) }));
  const line = smoothPath(pts);
  const area = `${line} L ${W},${height} L 0,${height} Z`;

  const selIdx = selected == null ? -1 : data.findIndex((d) => d.key === selected);
  const active = hover ?? selIdx;

  return (
    <div>
      <div
        className="relative"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity={0.34} />
              <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <path d={area} fill={`url(#fill-${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={tone}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {active >= 0 ? (
            <line
              x1={xs(active)}
              y1={0}
              x2={xs(active)}
              y2={height}
              stroke={tone}
              strokeWidth={1}
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
              opacity={0.7}
            />
          ) : null}
        </svg>

        {/* Цэгүүд — SVG-ийн хэвийн бус масштабаас ангид байлгахын тулд DOM дээр */}
        {data.map((d, i) => (
          <span
            key={d.key}
            aria-hidden
            className="pointer-events-none absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper-2 transition-opacity"
            style={{
              left: `${(i / (data.length - 1)) * 100}%`,
              top: `${(ys(d.value) / height) * 100}%`,
              background: tone,
              opacity: active < 0 ? 0.5 : active === i ? 1 : 0.15,
            }}
          />
        ))}

        {/* Товших / hover талбарууд */}
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <button
              key={d.key}
              type="button"
              disabled={!interactive}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => onSelect?.(selected === d.key ? null : d.key)}
              aria-label={`${d.label}: ${num(d.value)}`}
              className={cn("h-full flex-1", interactive && "cursor-pointer")}
            />
          ))}
        </div>

        {/* Hover самбар */}
        {hover !== null ? (
          <Tooltip
            index={hover}
            count={data.length}
            top={(ys(data[hover].value) / height) * 100}
            tone={tone}
            label={data[hover].label}
            value={data[hover].value}
            share={total ? (data[hover].value / total) * 100 : 0}
            delta={hover > 0 ? data[hover].value - data[hover - 1].value : null}
            unit={unit}
            selected={selected === data[hover].key}
          />
        ) : null}
      </div>

      <div className="mt-1.5 flex">
        {data.map((d, i) => (
          <span
            key={d.key}
            className={cn(
              "num flex-1 text-center text-[10px] transition-colors",
              active === i ? "text-ink" : "text-ink-3",
            )}
          >
            {formatTick ? formatTick(d, i) : d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Hover самбар — газрын зургийн хөвөгч картуудтай ижил хэв маягаар
   -------------------------------------------------------------------------- */

function Tooltip({
  index,
  count,
  top,
  tone,
  label,
  value,
  share,
  delta,
  unit,
  selected,
}: {
  index: number;
  count: number;
  top: number;
  tone: string;
  label: string;
  value: number;
  share: number;
  delta: number | null;
  unit: string;
  selected: boolean;
}) {
  // Ирмэг рүү ойртохоор голлуулахаа больж, дотогшоо түшинэ
  const t = index / (count - 1);
  const anchor = t < 0.22 ? "left" : t > 0.78 ? "right" : "center";
  const shift = anchor === "left" ? "0%" : anchor === "right" ? "-100%" : "-50%";

  /*
    Оргил цэг дээр самбар нь панелаас гарч дээшээ халхлахгүйн тулд доош эргэнэ.
    `top` нь диаграмын өндрийн хувь — 45%-аас дээш байвал (өөрөөр хэлбэл цэг нь
    дээгүүр байвал) самбарыг доор нь байрлуулна.
  */
  const below = top < 45;

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: `${t * 100}%`,
        top: `${top}%`,
        transform: `translate(${shift}, ${below ? "10px" : "calc(-100% - 10px)"})`,
      }}
    >
      <div className="elevated min-w-[124px] rounded-xs border border-line-2 bg-paper-2/95 backdrop-blur-md">
        <div
          className="flex items-center gap-1.5 border-b border-line px-2 py-1"
          style={{ background: `color-mix(in oklab, ${tone} 10%, transparent)` }}
        >
          <span className="size-1.5 rounded-full" style={{ background: tone }} />
          <span className="num text-[11.5px] font-medium text-ink">{label}</span>
          {selected ? (
            <span className="ml-auto text-[9.5px] tracking-[0.1em] text-ink-3 uppercase">
              сонгосон
            </span>
          ) : null}
        </div>

        <div className="px-2 py-1.5">
          <div className="flex items-baseline gap-1">
            <span className="num text-[17px] leading-none font-medium" style={{ color: tone }}>
              {num(value)}
            </span>
            <span className="text-[10.5px] text-ink-3">{unit}</span>
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-ink-3">
            <span className="num">{share.toFixed(1)}%</span>
            {delta !== null ? (
              <span
                className="num"
                style={{
                  color:
                    delta !== 0 ? "var(--data)" : "var(--ink-3)",
                }}
              >
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {num(Math.abs(delta))}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Хэвтээ жагсаалтан диаграм — нэр урт ангилалд (гүйцэтгэгч, дүүрэг)
   -------------------------------------------------------------------------- */

export function RowChart({
  data,
  tone = "var(--data)",
  colorOf,
  selected,
  onSelect,
  max: maxOverride,
}: {
  data: Datum[];
  tone?: string;
  /** Мөр бүрд өөр өнгө өгөх бол (жишээ нь газрын зурагтай тааруулах) */
  colorOf?: (d: Datum) => string;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  max?: number;
}) {
  const max = maxOverride ?? Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return <div className="py-5 text-center text-[12px] text-ink-3">Утга алга</div>;
  }

  return (
    <div className="space-y-1">
      {data.map((d) => {
        const on = selected == null || selected === d.key;
        const color = colorOf ? colorOf(d) : tone;
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelect?.(selected === d.key ? null : d.key)}
            className="group block w-full text-left"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1.5 text-[12px] transition-colors",
                  selected === d.key ? "font-medium text-ink" : "text-ink-2",
                  !on && "opacity-40",
                )}
              >
                {colorOf ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{d.label}</span>
              </span>
              <span
                className={cn(
                  "num shrink-0 text-[11.5px] transition-colors",
                  selected === d.key ? "text-ink" : "text-ink-3",
                  !on && "opacity-40",
                )}
              >
                {num(d.value)}
              </span>
            </div>
            <div className="mt-[3px] h-[2px] w-full overflow-hidden rounded-[1px] bg-paper-hi">
              <div
                className="h-full transition-[width,opacity]"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: color,
                  opacity: on ? 1 : 0.3,
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Бөгж (donut) — ЗӨВХӨН 2–4 ангилалтай үед.

   Хэсгүүдийг өөр өнгөөр БУДАХГҮЙ: дата дүрслэлийн өнгө ганц. Ялгааг нэг
   өнгөний тунгалагийн шатлалаар (эрэмбээр) гаргана. Ангилал олон бол энэ
   хэлбэр уншигдахаа больдог тул мөрөн диаграм (`RowChart`) руу шилжинэ.
   -------------------------------------------------------------------------- */

/** Бөгжний нэг зүсэм — гадна нумаар очиж, дотуур нумаар буцна */
function donutSlice(c: number, R: number, r: number, a0: number, a1: number) {
  const p = (rad: number, a: number) => [c + rad * Math.cos(a), c + rad * Math.sin(a)];
  const big = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(R, a0);
  const [x1, y1] = p(R, a1);
  const [x2, y2] = p(r, a1);
  const [x3, y3] = p(r, a0);
  return `M ${x0} ${y0} A ${R} ${R} 0 ${big} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${big} 0 ${x3} ${y3} Z`;
}

export function PieChart({
  data,
  tone = "var(--data)",
  size = 78,
  selected,
  onSelect,
}: {
  data: Datum[];
  tone?: string;
  size?: number;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);

  if (data.length === 0 || total === 0) {
    return <div className="py-5 text-center text-[12px] text-ink-3">Утга алга</div>;
  }

  /*
    Гадна тойрог нь зурагны ирмэгт ЯГ хүрч болохгүй: зураас нь замын
    голоор татагддаг тул хагас нь viewBox-оос гарч тайрагдана. Тайралт нь
    дээд, доод, хоёр хажуу дөрвөн цэгт л тохиолддог учир дугуй нь дөрвөн
    талаасаа шахагдсан мэт харагдана. Тиймээс захаас зай авна.
  */
  const PAD = 3;
  const c = size / 2;
  const R = c - PAD;
  const r = R * 0.62;
  /** Эрэмбийн дагуух тунгалаг — хамгийн олон нь хамгийн тод */
  const fade = (i: number) => Math.max(1 - i * 0.34, 0.24);
  /*
    Дүүргэлт нь ТУНГАЛАГ, хүрээ нь ижил өнгөөр бүтэн — газрын зургийн
    бөөгнөрөлтэй нэг зарчим. Ингэснээр бөгж дүүрэн өнгө болж дэлгэцийг
    дарахгүй, хэсгийн ирмэг нь харин тод үлдэнэ.
  */
  const FILL = 0.42;

  /*
    Өнцгийг ХУРИМТЛУУЛЖ бодно. `map`-ийн дотор хуримтлуулагчийг өөрчилвөл
    рендерийн цэвэр байдал алдагдана (компилятор ч анхааруулна) тул энгийн
    давталтаар урьдчилж бэлдэнэ. 12 цагийн байрлалаас (−90°) эхэлнэ.
  */
  const slices: { d: Datum; i: number; a0: number; a1: number }[] = [];
  let acc = 0;
  for (let i = 0; i < data.length; i++) {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += data[i].value;
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    slices.push({ d: data[i], i, a0, a1 });
  }

  const only = slices.length === 1;

  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        role="img"
      >
        {/* Гадна хүрээ — бөгж бүрэн тойрог гэдгийг барих зураас */}
        <circle
          cx={c}
          cy={c}
          r={R}
          fill="none"
          stroke={tone}
          strokeOpacity={0.4}
          strokeWidth={1}
        />

        {/*
          Ганц ангилалтай үед нумын эхлэл, төгсгөл нь давхцаж зам хоосон
          гардаг тул бүтэн бөгжийг зузаан зураасаар зурна.
        */}
        {only ? (
          <circle
            cx={c}
            cy={c}
            r={(R + r) / 2}
            fill="none"
            stroke={tone}
            strokeOpacity={FILL}
            strokeWidth={R - r}
          />
        ) : (
          slices.map(({ d, i, a0, a1 }) => {
            const on = selected == null || selected === d.key;
            return (
              <path
                key={d.key}
                d={donutSlice(c, R, r, a0, a1)}
                fill={tone}
                fillOpacity={on ? fade(i) * FILL : 0.06}
                stroke={tone}
                strokeOpacity={on ? Math.max(fade(i), 0.5) : 0.15}
                strokeWidth={1}
                className={onSelect ? "cursor-pointer" : undefined}
                onClick={() => onSelect?.(selected === d.key ? null : d.key)}
              >
                <title>{`${d.label} · ${num(d.value)}`}</title>
              </path>
            );
          })
        )}

        {/* Голд нийт — бөгжний нүх хоосон байх шалтгаангүй */}
        <text
          x={c}
          y={c + 3}
          textAnchor="middle"
          className="num fill-ink text-[13px] font-medium"
        >
          {num(total)}
        </text>
      </svg>

      <div className="min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => {
          const on = selected == null || selected === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onSelect?.(selected === d.key ? null : d.key)}
              className={cn(
                "flex w-full items-baseline gap-2 text-left transition-opacity",
                !on && "opacity-40",
              )}
            >
              {/* Тайлбарын тэмдэг нь зүсмийн дүрслэлийг давтана: тунгалаг
                  дүүргэлт + бүтэн хүрээ */}
              <span
                aria-hidden
                className="size-2 shrink-0 translate-y-[1px] rounded-[1px] border"
                style={{
                  background: `color-mix(in oklab, ${tone} ${fade(i) * FILL * 100}%, transparent)`,
                  borderColor: `color-mix(in oklab, ${tone} ${Math.max(fade(i), 0.5) * 100}%, transparent)`,
                }}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[12px]",
                  selected === d.key ? "font-medium text-ink" : "text-ink-2",
                )}
              >
                {d.label}
              </span>
              <span
                className={cn(
                  "num shrink-0 text-[12px]",
                  selected === d.key ? "text-ink" : "text-ink-2",
                )}
              >
                {num(d.value)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Ангиллын диаграм — хэлбэрээ ӨӨРӨӨ сонгоно.

   Цөөн ангилалтай үед харьцаа нь гол утга (бөгж), олон болоход харьцаа
   уншигдахаа больж эрэмбэ нь чухал болно (мөрөн диаграм). Дата өсөхөд
   гараар сольж явахгүйн тулд хилийг энд нэг л газар барина.
   -------------------------------------------------------------------------- */

export function CategoryChart({
  data,
  selected,
  onSelect,
  tone,
  /** Хэдэн ангилал хүртэл бөгжөөр харуулах вэ */
  pieMax = 4,
}: {
  data: Datum[];
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  tone?: string;
  pieMax?: number;
}) {
  return data.length > 0 && data.length <= pieMax ? (
    <PieChart data={data} tone={tone} selected={selected} onSelect={onSelect} />
  ) : (
    <RowChart data={data} tone={tone} selected={selected} onSelect={onSelect} />
  );
}

/* --------------------------------------------------------------------------
   Хоёр үзүүрт муж сонгогч (range slider).
   Нэр нь түүхэн шалтгаанаар `YearRange` — сар зэрэг бусад дараалалтай
   хэмжигдэхүүнд ч хэрэглэнэ (`unit`, `format`-оор нэршлийг нь солино).
   -------------------------------------------------------------------------- */

export function YearRange({
  min,
  max,
  value,
  onChange,
  unit = "жил",
  whole: wholeLabel = "бүх хугацаа",
  format = String,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  /** Сонгосон мужийн уртыг нэрлэх нэгж: "3 жил", "5 сар" */
  unit?: string;
  /** Бүтэн муж сонгогдсон үеийн бичиг */
  whole?: string;
  /** Үзүүрийн шошгыг харуулах хэлбэр */
  format?: (v: number) => string;
}) {
  const [lo, hi] = value;
  const span = Math.max(max - min, 1);
  const years = Array.from({ length: span + 1 }, (_, i) => min + i);
  const whole = lo === min && hi === max;

  return (
    <div>
      {/* Одоогийн муж — хоёр үзүүрт нь ил тоо */}
      <div className="mb-2 flex items-center gap-2">
        <span className="num rounded-xs border border-line-2 bg-paper px-1.5 py-[3px] text-[12px] font-medium text-ink">
          {format(lo)}
        </span>
        <span className="h-px flex-1 bg-line" />
        <span className="shrink-0 text-[11px] text-ink-3">
          {whole ? wholeLabel : `${hi - lo + 1} ${unit}`}
        </span>
        <span className="h-px flex-1 bg-line" />
        <span className="num rounded-xs border border-line-2 bg-paper px-1.5 py-[3px] text-[12px] font-medium text-ink">
          {format(hi)}
        </span>
      </div>

      <div className="relative h-4">
        <div className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded-[1px] bg-paper-hi" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-[1px] bg-data"
          style={{
            left: `${((lo - min) / span) * 100}%`,
            right: `${((max - hi) / span) * 100}%`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={lo}
          onChange={(e) => onChange([Math.min(+e.target.value, hi), hi])}
          aria-label="Мужийн эхлэл"
          className="range-thumb absolute inset-0 w-full"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(+e.target.value, lo)])}
          aria-label="Мужийн төгсгөл"
          className="range-thumb absolute inset-0 w-full"
        />
      </div>

      {/* Жил бүрийн зураас — бариул хаана байгааг ойлгоход тусална */}
      <div className="mt-0.5 flex justify-between px-[5px]" aria-hidden>
        {years.map((y) => (
          <span
            key={y}
            className="h-1 w-px"
            style={{
              background: y >= lo && y <= hi ? "var(--data)" : "var(--line-2)",
              opacity: y >= lo && y <= hi ? 0.8 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
