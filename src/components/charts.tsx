"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { useStored } from "@/components/ui/source-tabs";
import { cn, num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Босоо баганан диаграм — он, сар зэрэг дараалалтай хэмжигдэхүүнд.
   Товшиход шүүлтүүр болно (cross-filter).
   -------------------------------------------------------------------------- */

/**
 * Диаграмын СОНГОЛТ — нэг утга эсвэл ОЛОН.
 *
 * Самбарууд хоёуланг нь хэрэглэдэг: ганц зүсэлт хийхэд нэг утга
 * хангалттай, харин хэдэн ангиллыг зэрэг харьцуулах шаардлага гарвал
 * жагсаалт хэрэгтэй. Хоёр өөр проп нэмэхийн оронд НЭГ прополтой ч
 * хоёуланг нь хүлээж авна — дуудагч тал ямар хэлбэрээр барихаа өөрөө
 * шийднэ.
 */
export type Selection = string | string[] | null;

/** Мөр сонгогдсон эсэх */
function picked(sel: Selection | undefined, key: string): boolean {
  return Array.isArray(sel) ? sel.includes(key) : sel === key;
}

/** Сонголт огт тавиагүй эсэх — бүх мөр бүрэн тод харагдана */
function nothingPicked(sel: Selection | undefined): boolean {
  return sel == null || (Array.isArray(sel) && sel.length === 0);
}

/**
 * Товшилт дуудагч тал руу ЮУ дамжуулах вэ.
 *
 * Нэг утгын горимд сонгогдсоныг дахин товшвол `null` (цуцлах) — хуучин
 * бүх самбар үүнд тулгуурладаг. ОЛОН утгын горимд харин ҮРГЭЛЖ
 * түлхүүрээ дамжуулна: аль утгыг хасахыг дуудагч тал мэдэх ёстой тул
 * `null` нь хангалтгүй мэдээлэл болно.
 */
function clickValue(sel: Selection | undefined, key: string): string | null {
  if (Array.isArray(sel)) return key;
  return sel === key ? null : key;
}

export type Datum = {
  key: string;
  label: string;
  value: number;
  /** Толь бичиг дэх байрлал — өнгө сонгоход хэрэглэнэ */
  rank?: number;
  /**
   * Мөрийн ӨӨРИЙН өнгө — өгвөл диаграмын `tone`-ыг дарна.
   *
   * ⚠ Зөвхөн ЭРЭМБЭТЭЙ хэмжигдэхүүнд (PLI, эрсдэлийн зэрэг): нэрлэсэн
   * ангиллыг өнгөөр ялгавал утгагүй солонго болно — "дата дүрслэлийн
   * өнгө ганц" дүрэм. Ариун цэврийн самбар дүүрэг, хороо, бүсийн
   * зурвасаа дундаж PLI-ээр өнгөлдөг (хэрэглэгчийн хүсэлт, 2026-09-17).
   */
  color?: string;
  /**
   * Утгын хажууд гарах ХОЁР ДАХЬ ТООН ТЭМДЭГЛЭЛ — өгвөл `locationDetail`
   * горимын хувийг орлоно. Ариун цэврийн самбар хорооны дундаж PLI-г
   * тавьдаг (хэрэглэгчийн хүсэлт, 2026-09-17: "25.8%-ийн оронд PLI
   * дундаж"): хувь нь тооноос дам гардаг тул шинэ мэдээлэл өгдөггүй,
   * PLI нь өгдөг.
   */
  hint?: string;
};

export function BarChart({
  data, height = 130, tone = "var(--data)", selected, onSelect, formatTick, labels, unit, format = num,
}: {
  data: Datum[]; height?: number; tone?: string; selected?: Selection;
  onSelect?: (key: string | null) => void; formatTick?: (d: Datum, i: number) => string;
  labels?: boolean; unit?: string; format?: (v: number) => string;
}) {
  if (!data.length) return <div className="chart-empty">Үзүүлэлт байхгүй</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const interactive = Boolean(onSelect);
  const showValues = labels ?? data.length <= 8;
  const room = showValues ? Math.min(28, 20 / height * 100) : 6;
  const scale = (v: number) => Math.max(0, v / max * (100 - room));
  const axisTicks = format(max / 2) === format(0) || format(max / 2) === format(max) ? [0, 1] : [0, .5, 1];

  return (
    <div className="bar-chart">
      {unit && <div className="chart-unit">{unit}</div>}
      <div className="bar-chart-layout">
        <div className="bar-chart-axis" style={{ height }} aria-hidden="true">
          {axisTicks.map((ratio) => <span key={ratio} style={{ bottom: `${ratio * (100 - room)}%` }} title={format(max * ratio)}>{format(max * ratio)}</span>)}
        </div>
        <div className="min-w-0">
          <div className="bar-chart-plot" style={{ height }}>
            {[0, .25, .5, .75, 1].map((ratio) => <span key={ratio} className="chart-gridline" style={{ bottom: `${ratio * (100 - room)}%` }} aria-hidden="true" />)}
            <div className="bar-chart-columns">
              {data.map((d) => {
                const active = nothingPicked(selected) || picked(selected, d.key);
                return <button key={d.key} type="button" disabled={!interactive} aria-label={`${d.label}: ${format(d.value)}${unit ? ` ${unit}` : ""}`} aria-pressed={interactive ? picked(selected, d.key) : undefined} title={`${d.label} · ${format(d.value)}${unit ? ` ${unit}` : ""}`} onClick={() => onSelect?.(clickValue(selected, d.key))} className="bar-chart-column">
                  <span className="bar-chart-fill" style={{ height: `${scale(d.value)}%`, background: tone, opacity: active ? .88 : .18 }} />
                  {showValues && <span className="bar-chart-value" style={{ bottom: `calc(${scale(d.value)}% + 5px)`, opacity: active ? 1 : .35 }}>{format(d.value)}</span>}
                </button>;
              })}
            </div>
          </div>
          <div className="bar-chart-ticks">{data.map((d, i) => <span key={d.key} title={d.label} className={picked(selected, d.key) ? "is-selected" : undefined}>{formatTick ? formatTick(d, i) : d.label}</span>)}</div>
        </div>
      </div>
    </div>
  );
}


export function GroupedBarChart({
  groups,
  colors,
  unit,
  layout = "vertical",
  height = 116,
  format = num,
  labels,
  selected,
  onSelect,
}: {
  groups: DatumGroup[];
  /** Цуваа бүрийн өнгө — бүлэг доторх дараалалтай тохирно */
  colors: string[];
  /**
   * Хэмжих нэгж — тоонуудын ХАЖУУД гарна.
   *
   * Гарчиг нь картын нөгөө үзүүрт, жижиг саарал бичвэрээр сууна: "40"
   * гэсэн тоо мянга уу, сая уу гэдгийг тэндээс хайж уншина гэж
   * найдаж болохгүй. Нэгж нь тоонуудынхаа дэргэд байх ёстой.
   */
  unit?: string;
  /**
   * Багана БОСОО эсвэл ХЭВТЭЭ.
   *
   * Босоо нь цаг хугацааны дараалалтай, ангилал цөөтэй үед зөв.
   * Харин ангилал олон, нэр нь урт (дүүрэг, аж ахуйн нэгж) үед
   * хэвтээ нь хамаагүй дээр: нэр нь хажуудаа бүтнээрээ багтаж, утга
   * нь мөрийнхөө төгсгөлд бичигдэнэ — нарийн багананд ч шахагдахгүй.
   */
  layout?: "vertical" | "horizontal";
  height?: number;
  format?: (v: number) => string;
  /** Багана бүрийн утгыг бичих эсэх (зөвхөн БОСОО горимд) */
  labels?: boolean;
  /** Сонгосон БҮЛЭГ (ангилал) */
  selected?: Selection;
  onSelect?: (key: string | null) => void;
}) {
  /* Хуваарь нь БҮХ бүлэгт нэг: бүлэг тус бүрийг өөрийнх нь дээд утгаар
     хэмжвэл зэрэгцүүлсний учир алга болно */
  const max = Math.max(...groups.flatMap((g) => g.rows.map((r) => r.value)), 1);
  const series = groups[0]?.rows ?? [];
  const interactive = Boolean(onSelect);

  /* Шошгонд дээрээс зай — хамгийн өндөр багананы тоо халихаас
     сэргийлнэ (`BarChart`-тай нэг зарчим) */
  const room = labels ? Math.min(26, (14 / height) * 100) : 0;
  const scale = (v: number) =>
    Math.max((v / max) * (100 - room), v > 0 ? 1.5 : 0);

  if (groups.length === 0) {
    return (
      <div className="py-5 text-center text-[12px] text-ink-3">
        Үзүүлэлт байхгүй
      </div>
    );
  }

  return (
    /* Картаа ДҮҮРГЭНЭ: хэвтээ горимд мөрүүд үлдсэн өндрийг
       хуваалцах тул карт доод талаасаа хоосон үлдэхгүй */
    <div className={cn("flex flex-col", layout === "horizontal" && "h-full")}>
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
        {unit ? <span className="eyebrow shrink-0">{unit}</span> : null}
        {series.map((r, i) => (
          <span
            key={r.key}
            className="flex items-center gap-1.5 text-[10.5px] text-ink-2"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[1px]"
              style={{ background: colors[i % colors.length] }}
            />
            {r.label}
          </span>
        ))}
      </div>

      {layout === "horizontal" ? (
        /*
          Нэр нь мөрийнхөө ЗҮҮН талд, баганууд баруун талд.

          Нэрийг дээр нь тавьбал бүлэг бүр хоёр давхар болж, долоон
          ангилал картдаа багтахаа больж байв. Хажуугийн багана нь
          бас илүү зөв: бүх бүлгийн баганууд НЭГ эхлэлээс татагдах
          тул хооронд нь харьцуулах боломжтой болно.

          Бүлгүүдийг хоосон зайгаар биш ЗУРААСААР тусгаарлана —
          платформын нягт сүлжээний дүрэм.
        */
        <div className="-mx-3 -mb-3 flex flex-1 flex-col divide-y divide-line border-t border-line">
          {groups.map((g) => {
            const on = nothingPicked(selected) || picked(selected, g.key);
            return (
              <button
                key={g.key}
                type="button"
                disabled={!interactive}
                onClick={() => onSelect?.(clickValue(selected, g.key))}
                title={`${g.label} · ${format(g.total)}${unit ? ` ${unit}` : ""}`}
                className={cn(
                  /* Мөр бүр үлдсэн зайг тэнцүү хуваана — цөөн ангилал
                     байхад ч карт дүүрэн харагдана */
                  "flex w-full flex-1 items-center gap-2 px-3 py-1.5 text-left outline-none transition-colors",
                  "focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-(--data)",
                  interactive && "cursor-pointer hover:bg-paper-hi",
                )}
              >
                <span
                  className={cn(
                    "w-[96px] shrink-0 truncate text-[11.5px] leading-none transition-colors",
                    picked(selected, g.key)
                      ? "font-medium text-ink"
                      : "text-ink-2",
                    !on && "opacity-40",
                  )}
                >
                  {g.label}
                </span>

                <span className="min-w-0 flex-1 space-y-[3px]">
                  {g.rows.map((r, i) => (
                    <span key={r.key} className="flex items-center gap-1.5">
                      <span className="relative h-[6px] min-w-0 flex-1">
                        <span
                          className="absolute inset-y-0 left-0 rounded-[1px] transition-[width,opacity]"
                          style={{
                            width: `${Math.max((r.value / max) * 100, r.value > 0 ? 0.8 : 0)}%`,
                            background: colors[i % colors.length],
                            opacity: on ? 1 : 0.22,
                          }}
                        />
                      </span>
                      <span
                        className={cn(
                          "num w-[52px] shrink-0 text-right text-[10px] leading-none",
                          on ? "text-ink-2" : "text-ink-3/60",
                        )}
                      >
                        {format(r.value)}
                      </span>
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2" style={{ height }}>
            {groups.map((g) => {
              const on = nothingPicked(selected) || picked(selected, g.key);
              return (
                <button
                  key={g.key}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onSelect?.(clickValue(selected, g.key))}
                  title={`${g.label} · ${format(g.total)}${unit ? ` ${unit}` : ""}`}
                  className={cn(
                    "group flex h-full flex-1 items-end gap-[2px] outline-none",
                    "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-(--data)",
                    interactive && "cursor-pointer",
                  )}
                >
                  {g.rows.map((r, i) => (
                    <span
                      key={r.key}
                      /* Багана бүр ӨӨРИЙН утгаа хэлнэ: шошго багтахгүй
                     нарийн үед энэ нь тоог мэдэх цорын ганц зам */
                      title={`${g.label} · ${r.label} · ${format(r.value)}${unit ? ` ${unit}` : ""}`}
                      className="relative flex h-full flex-1 items-end"
                    >
                      <span
                        className="w-full rounded-t-[4px] transition-[height,opacity]"
                        style={{
                          height: `${scale(r.value)}%`,
                          background: colors[i % colors.length],
                          opacity: on ? 1 : 0.22,
                        }}
                      />
                      {labels && r.value > 0 ? (
                        <span
                          aria-hidden
                          className={cn(
                            /* ТАСЛАХГҮЙ: "9,451" нь "9…" болбол тоо биш
                           шуугиан болно. Багтахгүй бол дуудагч тал
                           шошгыг огт асаахгүй */
                            "num pointer-events-none absolute inset-x-0 text-center text-[9px] leading-none whitespace-nowrap",
                            on ? "text-ink-2" : "text-ink-3/60",
                          )}
                          style={{ bottom: `calc(${scale(r.value)}% + 3px)` }}
                        >
                          {format(r.value)}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex gap-2">
            {groups.map((g) => (
              <span
                key={g.key}
                title={g.label}
                className={cn(
                  "flex-1 truncate text-center text-[10px] transition-colors",
                  picked(selected, g.key) ? "text-ink" : "text-ink-3",
                )}
              >
                {g.label}
              </span>
            ))}
          </div>
        </>
      )}
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
  selected?: Selection;
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
    return (
      <div className="py-6 text-center text-[12px] text-ink-3">
        Үзүүлэлт байхгүй
      </div>
    );
  }

  const W = 100;
  const pad = 3; // дээд талд зай — оргил тасрахгүй
  const xs = (i: number) => (i / (data.length - 1)) * W;
  const ys = (v: number) => pad + (1 - v / max) * (height - pad);

  const pts = data.map((d, i) => ({ x: xs(i), y: ys(d.value) }));
  const line = smoothPath(pts);
  const area = `${line} L ${W},${height} L 0,${height} Z`;

  /* Олон сонголттой үед ЭХНИЙХ нь голын бичвэрийг эзэлнэ — бөгжний
     нүх нэгээс олон утга багтаахгүй */
  const selIdx = nothingPicked(selected)
    ? -1
    : data.findIndex((d) => picked(selected, d.key));
  const active = hover ?? selIdx;

  const ticks = data.map((d, i) => (formatTick ? formatTick(d, i) : d.label));
  /*
    Шошгыг НАЛУУЛАХ эсэх. Хоёр нөхцөл ЗЭРЭГ биелэх ёстой:
      · цэг олон (нэг шошгонд ноогдох зай багасна),
      · шошго өөрөө урт (4 оронтой он гэх мэт).
    Зөвхөн тоогоор шийдвэл сарын дугаар (1…12) шиг нэг оронтой шошго ч
    налж, ямар ч ашиггүйгээр 28px өндөр иднэ. Зөвхөн уртаар шийдвэл
    цөөхөн жилийн цуваа дэмий налах байв.
  */
  const tilt = data.length > 8 && ticks.some((t) => t.length >= 4);

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
              <stop offset="0%" stopColor={tone} stopOpacity={0.22} />
              <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {[.25, .5, .75, 1].map((ratio) => <line key={ratio} x1={0} x2={W} y1={height * ratio} y2={height * ratio} stroke="var(--line)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />)}
          <path d={area} fill={`url(#fill-${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={tone}
            strokeWidth={2}
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

        {/*
          Товших / hover талбарууд.

          Шүүлтүүргүй (`onSelect` өгөөгүй) диаграм дээр ч hover самбар
          гарах ЁСТОЙ — тоог унших нь сонгохоос тусдаа хэрэгцээ. Тиймээс
          товчийг `disabled` болгохгүй: идэвхгүй товч хулганы үйлдэл
          цацдаггүй тул самбар бүрмөсөн алга болно. Оронд нь гарын
          шилжилтээс (`tabIndex={-1}`) хасаж, 25 хоосон зогсоол
          үүсгэхээс сэргийлнэ.
        */}
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <button
              key={d.key}
              type="button"
              tabIndex={interactive ? 0 : -1}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => onSelect?.(clickValue(selected, d.key))}
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
            selected={picked(selected, data[hover].key)}
          />
        ) : null}
      </div>

      {/*
        Тэнхлэгийн шошго.

        Цуваа урт болоход хэвтээ шошгууд бие биендээ наалддаг: 25 жилийн
        цуваанд нэг шошгонд 12px л ноогдох ба хоёр оронтой тоо түүнээс
        өргөн. Тиймээс 12-оос олон цэгтэй үед НАЛУУЛНА — зэргэлдээ шошго
        босоо чиглэлд салж, давхцахаа болино.

        Налуу шошгын эргэлтийн тулгуур нь баруун ДЭЭД булан: тэгснээр
        шошгын төгсгөл цэгийнхээ доор ирж, бичвэр нь зүүн доошоо унжина.
        Тулгуурыг нүдний голд аваачихын тулд урьдчилж хагас өргөнөөр
        зүүн тийш шилжүүлнэ. Эргэлт нь байрлалын өндөр эзэлдэггүй тул
        мөрөнд өндрийг нь гараар өгнө.

        Өнцөг нь 45 биш 60 градус. Шошго хоорондын зай нь өнцгөөс шууд
        гардаг: 4 оронтой он 10px-д ~24px өргөн, 25 жилийн цуваанд нэг
        цэгт 13px ноогдоно. 45 градуст хэвтээ ул мөр нь 17px буюу нүднээс
        өргөн хэвээр (давхцсаар) байх бол 60 градуст 12px болж, хооронд
        нь бодит завсар үүснэ. Огцом байх тусам өндөр илүү иддэг тул
        цааш нэмэхгүй.
      */}
      <div className={cn("flex", tilt ? "mt-2 h-7 items-start" : "mt-1.5")}>
        {data.map((d, i) => (
          <span key={d.key} className="flex min-w-0 flex-1 justify-center">
            <span
              className={cn(
                "num text-[10px] leading-none whitespace-nowrap transition-colors",
                active === i ? "text-ink" : "text-ink-3",
                tilt && "origin-top-right -translate-x-1/2 -rotate-[60deg]",
              )}
            >
              {ticks[i]}
            </span>
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
  const shift =
    anchor === "left" ? "0%" : anchor === "right" ? "-100%" : "-50%";

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
      <div className="elevated min-w-[140px] overflow-hidden rounded-xl border border-line-2 bg-paper-2/95 backdrop-blur-md">
        <div
          className="flex items-center gap-1.5 border-b border-line px-2 py-1"
          style={{
            background: `color-mix(in oklab, ${tone} 10%, transparent)`,
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: tone }}
          />
          <span className="num text-[11.5px] font-medium text-ink">
            {label}
          </span>
          {selected ? (
            <span className="ml-auto text-[9.5px] tracking-[0.1em] text-ink-3 uppercase">
              сонгосон
            </span>
          ) : null}
        </div>

        <div className="px-2 py-1.5">
          <div className="flex items-baseline gap-1">
            <span
              className="num text-[17px] leading-none font-medium"
              style={{ color: tone }}
            >
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
                  color: delta !== 0 ? "var(--data)" : "var(--ink-3)",
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
  data, tone = "var(--data)", colorOf, selected, onSelect, max: maxOverride, base = 0, format = num, guide,
}: {
  data: Datum[]; tone?: string; colorOf?: (d: Datum) => string; selected?: Selection;
  onSelect?: (key: string | null) => void; max?: number; base?: number;
  format?: (v: number) => string; guide?: number;
}) {
  const max = maxOverride ?? Math.max(...data.map((d) => d.value), 1);
  const span = Math.max(max - base, 1e-9);
  const at = (v: number) => Math.max(0, Math.min(1, (v - base) / span)) * 100;
  const guideAt = guide != null && guide > base && guide < max ? at(guide) : null;
  if (!data.length) return <div className="chart-empty">Үзүүлэлт байхгүй</div>;
  return (
    <div className="row-chart">
      {data.map((d) => {
        const active = nothingPicked(selected) || picked(selected, d.key);
        const isSelected = picked(selected, d.key);
        const color = colorOf ? colorOf(d) : tone;
        return <button key={d.key} type="button" disabled={!onSelect} aria-pressed={onSelect ? isSelected : undefined} title={`${d.label} · ${format(d.value)}`} onClick={() => onSelect?.(clickValue(selected, d.key))} className={cn("row-chart-item", isSelected && "is-selected")} style={{ opacity: active ? 1 : .35 }}>
          <span className="row-chart-heading"><span className="row-chart-label">{colorOf && <i aria-hidden="true" style={{ background: color }} />}{d.label}</span><strong>{format(d.value)}</strong></span>
          <span className="row-chart-track">
            <span className="row-chart-track-inner">
              <span style={{ width: `${guideAt != null ? Math.min(at(d.value), guideAt) : at(d.value)}%`, background: color }} />
              {guideAt != null && at(d.value) > guideAt && <span className={active ? "alert-pulse" : undefined} style={{ width: `${at(d.value) - guideAt}%`, background: color }} />}
            </span>
            {guideAt != null && <span className="row-chart-guide" style={{ left: `${guideAt}%` }} aria-hidden="true" />}
          </span>
        </button>;
      })}
    </div>
  );
}


function donutSlice(c: number, R: number, r: number, a0: number, a1: number) {
  const p = (rad: number, a: number) => [
    c + rad * Math.cos(a),
    c + rad * Math.sin(a),
  ];
  const big = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(R, a0);
  const [x1, y1] = p(R, a1);
  const [x2, y2] = p(r, a1);
  const [x3, y3] = p(r, a0);
  return `M ${x0} ${y0} A ${R} ${R} 0 ${big} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${big} 0 ${x3} ${y3} Z`;
}

export function PieChart({
  data, tone = "var(--data)", colorOf, note, format = num, size = 112, selected, onSelect,
}: {
  data: Datum[]; tone?: string; colorOf?: (d: Datum) => string; note?: (d: Datum) => string;
  format?: (v: number) => string; size?: number; selected?: Selection;
  onSelect?: (key: string | null) => void;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!data.length || total <= 0) return <div className="chart-empty">Үзүүлэлт байхгүй</div>;
  const c = size / 2, R = c - 4, r = R * .72;
  const hue = (d: Datum) => colorOf ? colorOf(d) : tone;
  const opacity = (i: number) => colorOf ? .88 : Math.max(.92 - i * .22, .24);
  const slices: { d: Datum; i: number; a0: number; a1: number }[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const a0 = sum / total * Math.PI * 2 - Math.PI / 2;
    sum += data[i].value;
    slices.push({ d: data[i], i, a0, a1: sum / total * Math.PI * 2 - Math.PI / 2 });
  }
  const single = data.filter((d) => d.value > 0).length === 1;
  const singleDatum = data.find((d) => d.value > 0)!;
  const text = format(total);
  return (
    <div className="donut-chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-chart-ring" role="img" aria-label={`Нийт ${text}`}>
        <circle cx={c} cy={c} r={(R + r) / 2} fill="none" stroke="var(--paper-hi)" strokeWidth={R - r} />
        {single ? <circle cx={c} cy={c} r={(R + r) / 2} fill="none" stroke={hue(singleDatum)} strokeWidth={R - r} strokeOpacity={nothingPicked(selected) || picked(selected, singleDatum.key) ? .88 : .15} onClick={() => onSelect?.(clickValue(selected, singleDatum.key))} className={onSelect ? "cursor-pointer" : undefined}><title>{`${singleDatum.label} · ${format(singleDatum.value)}`}</title></circle> : slices.filter(({ d }) => d.value > 0).map(({ d, i, a0, a1 }) => <path key={d.key} d={donutSlice(c, R, r, a0, a1)} fill={hue(d)} fillOpacity={nothingPicked(selected) || picked(selected, d.key) ? opacity(i) : .12} stroke="var(--paper-2)" strokeWidth={2} className={onSelect ? "cursor-pointer" : undefined} onClick={() => onSelect?.(clickValue(selected, d.key))}><title>{`${d.label} · ${format(d.value)}`}</title></path>)}
        <text x={c} y={c - 6} textAnchor="middle" className="fill-ink-3" fontSize={Math.max(8, size * .08)}>НИЙТ</text>
        <text x={c} y={c + 14} textAnchor="middle" className="num fill-ink font-semibold" fontSize={Math.min(size * .18, (r * 2 - 8) / Math.max(text.length * .64, 1))}>{text}</text>
      </svg>
      <div className="donut-chart-legend">
        {data.map((d, i) => <button key={d.key} type="button" disabled={!onSelect} aria-pressed={onSelect ? picked(selected, d.key) : undefined} onClick={() => onSelect?.(clickValue(selected, d.key))} title={`${d.label} · ${format(d.value)}`} className={cn("donut-legend-item", picked(selected, d.key) && "is-selected")} style={{ opacity: nothingPicked(selected) || picked(selected, d.key) ? 1 : .35 }}>
          <span className="donut-legend-swatch" style={{ background: hue(d), opacity: opacity(i) }} />
          <span className="donut-legend-label">{d.label}</span>
          <strong>{format(d.value)}</strong>
          <span className="donut-legend-note">{note ? note(d) : `${(d.value / total * 100).toFixed(1)}%`}</span>
        </button>)}
      </div>
    </div>
  );
}


export type DatumGroup = {
  key: string;
  label: string;
  total: number;
  rows: Datum[];
};

export function GroupedRowChart({
  groups,
  tone = "var(--data)",
  selected,
  onSelect,
  selectedGroup,
  onSelectGroup,
  defaultOpen = "all",
  storageKey,
  locationDetail = false,
}: {
  groups: DatumGroup[];
  tone?: string;
  selected?: Selection;
  onSelect?: (key: string | null) => void;
  selectedGroup?: Selection;
  onSelectGroup?: (key: string | null) => void;
  /** Эхлээд ямар бүлэг задарсан байх вэ */
  defaultOpen?: "all" | "first" | "none";
  /**
   * Өгвөл хураалтын төлөв `localStorage`-д үлдэж, хуудас дахин
   * ачаалахад сэргэнэ. Өгөхгүй бол зөвхөн санах ойд.
   */
  storageKey?: string;
  /** Дүүрэг → хороо: дүүрэг доторх хэмжээс, хувь, тогтмол гарчиг. */
  locationDetail?: boolean;
}) {
  /*
    Хураалтын төлөв: задарсан бүлгүүдийн НЭРИЙН олонлог. `null` нь
    "хэрэглэгч гар хүрээгүй" гэсэн үг — тэр үед `defaultOpen` шийднэ.

    Хоёр тусдаа төлөв (олонлог + "хүрсэн" туг) байсныг НЭГТГЭВ: хоёр
    товшилт нэг багцад орвол хоёр дахь нь хуучин утгыг уншиж, эхнийхийн
    үр дүн алдагддаг байлаа. Функц хэлбэрийн шинэчлэл үүнээс хамгаална.

    Хадгалсан утгыг `useState`-ийн эхлүүлэгчээр УНШИХГҮЙ: сайт статикаар
    экспортлогддог тул серверийн HTML үргэлж `defaultOpen`-той байх ба
    зөрвөл гидраци эвдэрнэ. `useStored` (useSyncExternalStore) нь
    гидрацийн үед серверийн зургийг өгөөд дараа нь хадгалсан утга руу
    шилжинэ. Товшилтын дараах утга нь `open`-д — `setItem` нь ижил таб
    дотор `storage` үйл явдал өдөөдөггүй тул давхарлаж барина.
  */
  const [open, setOpen] = React.useState<Set<string> | null>(null);
  const stored = useStored(storageKey ?? "");

  const openByDefault = React.useCallback(
    (i: number) =>
      defaultOpen === "all" ? true : defaultOpen === "first" ? i === 0 : false,
    [defaultOpen],
  );

  /** Хадгалсан жагсаалт — эвдэрсэн утгыг чимээгүйхэн голно */
  const restored = React.useMemo(() => {
    if (!storageKey || stored == null) return null;
    try {
      const v: unknown = JSON.parse(stored);
      return Array.isArray(v) ? new Set(v.map(String)) : null;
    } catch {
      return null;
    }
  }, [storageKey, stored]);

  const current = open ?? restored;

  const isOpen = (key: string, i: number) =>
    current ? current.has(key) : openByDefault(i);

  function toggle(key: string) {
    setOpen((prev) => {
      const base = prev ?? restored;
      const next = new Set(
        base ?? groups.filter((_, i) => openByDefault(i)).map((g) => g.key),
      );
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {}
      }
      return next;
    });
  }

  /* Зурвасыг БҮХ бүлгийн дээд утгаар хэмжинэ — бүлэг бүрийг өөрийнх нь
     дээд утгаар хэмжвэл өөр өөр масштабтай болж харьцуулах боломжгүй */
  const max = Math.max(...groups.flatMap((g) => g.rows.map((r) => r.value)), 1);

  if (groups.length === 0) {
    return (
      <div className="py-5 text-center text-[12px] text-ink-3">
        Үзүүлэлт байхгүй
      </div>
    );
  }

  return (
    <div className={locationDetail ? "space-y-1" : "space-y-3"}>
      {groups.map((g, i) => {
        const shown = isOpen(g.key, i);
        const rowMax = locationDetail ? Math.max(...g.rows.map((r) => r.value), 1) : max;
        return (
          <div key={g.key}>
            {/*
            Гарчгийн мөр ХОЁР үйлдэлтэй: сум нь задлах/хураах, нэр нь
            шүүх. Нэг товч дээр хоёуланг нь ачаалбал "би шүүх гэсэн юм,
            яагаад хураачихав" гэсэн эргэлзээ төрнө.
          */}
            <div className={cn("mb-1.5 flex items-center gap-1.5 border-b border-line pb-1", locationDetail && "sticky top-0 z-10 rounded-md border bg-paper-2 px-1.5 py-1.5 shadow-sm", locationDetail && g.label === "Тодорхойгүй" && "text-ink-3")}>
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={shown}
                aria-label={`${g.label}: ${shown ? "Хураах" : "Задлах"}`}
                className="shrink-0 rounded p-1 text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-(--data)"
              >
                <ChevronDown
                  size={12}
                  strokeWidth={2}
                  className={cn("transition-transform", !shown && "-rotate-90")}
                />
              </button>
              <button
                type="button"
                disabled={!onSelectGroup}
                aria-pressed={onSelectGroup ? picked(selectedGroup, g.key) : undefined}
                onClick={() =>
                  onSelectGroup?.(clickValue(selectedGroup, g.key))
                }
                className={cn(
                  "flex min-w-0 flex-1 items-baseline gap-2 text-left",
                  "rounded focus-visible:outline-2 focus-visible:outline-(--data)",
                  onSelectGroup && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    locationDetail ? "min-w-0 flex-1 text-[12px] font-medium leading-snug transition-colors" : "eyebrow min-w-0 flex-1 truncate transition-colors",
                    picked(selectedGroup, g.key) && "text-data",
                  )}
                >
                  {g.label}
                  {locationDetail && <span className="ml-1.5 whitespace-nowrap text-[10px] font-normal text-ink-3">· {g.rows.length} хороо</span>}
                </span>
                <span className="num shrink-0 text-[11.5px] text-ink-2">
                  {num(g.total)}
                </span>
              </button>
            </div>

            <div className={cn("space-y-1 pl-2", locationDetail && "ml-3 border-l border-line pl-3", !shown && "hidden")}>
              {g.rows.map((d) => {
                const on = nothingPicked(selected) || picked(selected, d.key);
                const share = g.total > 0 ? (d.value / g.total * 100).toFixed(1) : "0.0";
                return (
                  <button
                    key={d.key}
                    type="button"
                    disabled={locationDetail && !onSelect}
                    aria-pressed={onSelect ? picked(selected, d.key) : undefined}
                    title={locationDetail ? `${d.label}: ${num(d.value)} · дүүргийн нийт ${num(g.total)}-ийн ${share}%${d.hint ? ` · ${d.hint}` : ""}` : undefined}
                    onClick={() => onSelect?.(clickValue(selected, d.key))}
                    className={cn("group block w-full text-left", locationDetail && "rounded-md px-1 py-2 focus-visible:outline-2 focus-visible:outline-(--data)", locationDetail && onSelect && "cursor-pointer hover:bg-paper-hi", locationDetail && picked(selected, d.key) && "bg-paper-hi ring-1 ring-(--data)")}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "min-w-0 truncate text-[12px] transition-colors",
                          picked(selected, d.key)
                            ? "font-medium text-ink"
                            : "text-ink-2",
                          !on && "opacity-40",
                        )}
                      >
                        {d.label}
                      </span>
                      <span
                        className={cn(
                          "num shrink-0 text-[11.5px] transition-colors",
                          picked(selected, d.key) ? "text-ink" : "text-ink-3",
                          !on && "opacity-40",
                        )}
                      >
                        {num(d.value)}
                        {locationDetail && <span className="ml-2 inline-block min-w-10 text-right text-[10px] text-ink-3">{d.hint ?? `${share}%`}</span>}
                      </span>
                    </div>
                    <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-paper-hi">
                      <div
                        className="h-full transition-[width,opacity]"
                        style={{
                          width: `${(d.value / rowMax) * 100}%`,
                          background: d.color ?? tone,
                          opacity: on ? 1 : 0.3,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
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
  selected?: Selection;
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
