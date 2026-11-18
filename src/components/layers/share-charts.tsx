"use client";

import * as React from "react";
import { type Datum } from "@/components/charts";

import { cn, num } from "@/lib/utils";

import { measureText, soft } from "./chart-helpers";

/**
 * БҮЛГЭЭР ЗАДАРСАН ТАЛБАЙН ЖАГСААЛТ ({@link LayerSet.shareChart},
 * {@link LayerSet.valueGroups}; хэрэглэгч 2026-10-07, ойн ялгарал:
 * газрын зураг утгаар бүлэглэсэн өнгөтэй болсны дараа "одоо чартыг" →
 * гурван хувилбараас).
 *
 * Зурагтай ИЖИЛ бүлэг (ой, ойжилт · эвдрэл · ойгүй талбай): бүлэг бүрийн
 * толгойд нийт га, нийтэд эзлэх нимгэн зурвас; доор нь ангиллууд
 * өнгө · нэр · зурвас · га. ⚠ ХУВЬ ХАСАГДСАН (хэрэглэгч 2026-10-07:
 * "хувийг хас") — attribute биш тооцоо байсан.
 * ⚠ Мөрийн зурвас нь БҮЛЭГ ДОТРОО хуваарилагдана (бүлгийн хамгийн их
 *   ангилал бүтэн) — нэг хуваарьт Ой (73%) бусдыг үл үзэгдэх зураас
 *   болгодог байв. Бүлэг хоорондын харьцуулалт нь толгойн зурвас, хувь.
 * ⚠ Бүлгийн толгой товшиход тэр бүлгийн БҮХ ангиллаар шүүнэ
 *   (`onGroup`); дахин товшиход цуцлагдана. Мөр нь ганц ангиллаар.
 * ⚠ Бүлэгт ороогүй ангилал "Бусад" бүлэгт — чимээгүй алга болохгүй.
 *   Бүлэггүй давхаргад бүгд нэг гарчиггүй бүлэг.
 * ⚠ Өмнөх дөрвөн хувилбар (`ShareList`, `ShareTreemap`, `ShareWaffle`,
 *   `ShareSplit`) кодоос УСТСАН — дахин бүү санал болго.
 */
export function ShareGroups({
  data,
  area,
  unit,
  groups,
  colorOf,
  selected,
  onSelect,
  onGroup,
  countLabel,
  fill,
  districts,
  districtSel,
  onDistrict,
}: {
  data: Datum[];
  /** Ангилал бүрийн талбай ({@link Breakdown.notes}) */
  area: Map<string, number>;
  unit?: string;
  groups?: readonly { label: string; keys: readonly string[] }[];
  colorOf: (key: string) => string;
  selected: string[] | string | null;
  onSelect: (key: string | null) => void;
  onGroup: (keys: string[]) => void;
  countLabel: string;
  /** Ганц карт баганаа дүүргэх үед жагсаалт үлдсэн өндөрт гүйнэ */
  fill?: boolean;
  /**
   * "Дүүргээр" харагдац ({@link LayerSet.districts}) — `undefined` бол
   * сэлгэгч гарахгүй. Мөр бүр дүүргийн нийт га ба бүлэг тус бүрийн га.
   */
  districts?:
    | "loading"
    | "failed"
    | {
        rows: { name: string; ha: number; parts: number[] }[];
        parts: { label: string; color: string }[];
      };
  districtSel?: string | null;
  onDistrict?: (name: string | null) => void;
}) {
  const [mode, setMode] = React.useState<"cat" | "dist">("cat");
  const rows = data
    .map((d) => ({ ...d, ha: area.get(d.key) ?? 0 }))
    .sort((a, b) => b.ha - a.ha);
  const total = rows.reduce((n, r) => n + r.ha, 0) || 1;
  const taken = new Set<string>();
  const blocks = (groups ?? []).map((g) => {
    const items = rows.filter((r) => g.keys.includes(r.key));
    items.forEach((r) => taken.add(r.key));
    return { label: g.label, items };
  });
  const loose = rows.filter((r) => !taken.has(r.key));
  if (loose.length)
    blocks.push({ label: groups?.length ? "Бусад" : "", items: loose });
  const shown = blocks
    .filter((b) => b.items.length)
    .map((b) => ({ ...b, ha: b.items.reduce((n, r) => n + r.ha, 0) }))
    .sort((a, b) => b.ha - a.ha);

  const sel = Array.isArray(selected) ? selected : selected ? [selected] : [];
  const isOn = (k: string) => sel.includes(k);
  const any = sel.length > 0;
  const dim = (k: string) => (any && !isOn(k) ? 0.4 : 1);
  const ha = (v: number) => `${measureText(v)}${unit ? ` ${unit}` : ""}`;

  const toggle =
    districts !== undefined ? (
      <div className="flex shrink-0 items-center gap-1 pb-1">
        {(
          [
            ["cat", "Ангиллаар"],
            ["dist", "Дүүргээр"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={mode === v}
            onClick={() => setMode(v)}
            className={cn(
              "rounded-xs border px-2 py-0.5 text-[11.5px] transition-colors",
              mode === v
                ? "border-line-2 bg-paper-hi font-semibold text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
        {districtSel ? (
          <button
            type="button"
            onClick={() => onDistrict?.(null)}
            className="ml-auto inline-flex items-center gap-1 rounded-xs border border-line-2 px-1.5 py-0.5 text-[11px] text-ink-2 hover:text-ink"
            title="Дүүргийн шүүлтийг цуцлах"
          >
            {districtSel}
            <span aria-hidden>×</span>
          </button>
        ) : null}
      </div>
    ) : null;

  if (mode === "dist" && districts !== undefined)
    return (
      <div className={cn("flex flex-col", fill && "min-h-0 flex-1")}>
        {toggle}
        {districts === "loading" ? (
          <p className="px-1 py-3 text-[12px] text-ink-3">
            Дүүргийг тооцоолж байна.
          </p>
        ) : districts === "failed" ? (
          <p className="px-1 py-3 text-[12px] text-clay">
            Дүүргийн хил уншигдсангүй.
          </p>
        ) : (
          <DistrictBars
            rows={districts.rows}
            parts={districts.parts}
            unit={unit}
            selected={districtSel ?? null}
            onSelect={(n) => onDistrict?.(n)}
            chosen={
              selected == null
                ? []
                : Array.isArray(selected)
                  ? selected
                  : [selected]
            }
            onPart={(keys) => onGroup([...keys])}
            fill={fill}
          />
        )}
      </div>
    );

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        fill && "min-h-0 flex-1 overflow-y-auto",
      )}
    >
      {toggle}
      {shown.map((g) => {
        const keys = g.items.map((r) => r.key);
        const whole =
          sel.length === keys.length && keys.every((k) => sel.includes(k));
        const max = Math.max(...g.items.map((r) => r.ha)) || 1;
        const lead = colorOf(g.items[0].key);
        return (
          <section
            key={g.label || "_"}
            className="shrink-0 border-line [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-1.5"
          >
            {g.label ? (
              <button
                type="button"
                aria-pressed={whole}
                onClick={() => onGroup(keys)}
                className="w-full rounded-xs px-1 pt-1.5 pb-1 text-left hover:bg-paper-hi"
                style={{ opacity: any && !keys.some(isOn) ? 0.45 : 1 }}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[11.5px] font-semibold tracking-[0.04em] text-ink uppercase">
                    {g.label}
                  </span>
                  <span className="num ml-auto text-[12px] font-semibold text-ink">
                    {ha(g.ha)}
                  </span>
                </span>
                <span className="mt-1 block h-1 overflow-hidden rounded-xs bg-paper-3">
                  <span
                    className="block h-full rounded-xs"
                    style={{
                      width: `${Math.max((g.ha / total) * 100, 0.5)}%`,
                      background: soft(lead),
                    }}
                  />
                </span>
              </button>
            ) : null}
            {g.items.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={isOn(r.key)}
                onClick={() => onSelect(r.key)}
                title={`${r.label} · ${countLabel} ${num(r.value)}`}
                className="grid w-full grid-cols-[10px_132px_minmax(0,1fr)_76px] items-center gap-x-2.5 rounded-xs py-[4px] pr-1 pl-3 text-left text-[12px] hover:bg-paper-hi"
                style={{ opacity: dim(r.key) }}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px]"
                  style={{ background: soft(colorOf(r.key)) }}
                />
                <span className="truncate text-ink">{r.label}</span>
                <span className="h-2 overflow-hidden rounded-xs bg-paper-3">
                  <span
                    className="block h-full rounded-xs"
                    style={{
                      width: `${Math.max((r.ha / max) * 100, r.ha > 0 ? 1 : 0)}%`,
                      background: soft(colorOf(r.key)),
                    }}
                  />
                </span>
                <span className="num text-right text-ink">{ha(r.ha)}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/**
 * ДҮҮРГЭЭР — дүүрэг бүр нэг мөр: нэр · бүлгээр ДАВХАРЛАСАН зурвас · нийт га
 * ({@link ShareGroups}-ийн "Дүүргээр" харагдац). Зурвасын урт нь хамгийн
 * том дүүрэгтэй харьцуулсан; хэсгүүд нь бүлэг тус бүрийн га (өнгө нь
 * газрын зургийн гэр бүлийнх). Мөр дарахад тэр дүүргээр шүүнэ.
 * ⚠ Хэсэг бүр БАГТАХ бол га-гаа бичнэ (16px зурвас, 10px бараан бичвэр —
 *   өнгөнүүд дунд, цайвар гэрэлтэлттэй тул цагаан бичвэр уусна).
 * ⚠ Дүүрэг нь ТООЦООЛСОН (`districtsOf`) — эх сурвалжийн талбар биш.
 */
export function DistrictBars({
  rows,
  parts,
  unit,
  selected,
  onSelect,
  chosen,
  onPart,
  fill,
}: {
  rows: { name: string; ha: number; parts: number[] }[];
  parts: { label: string; color: string; keys?: readonly string[] }[];
  unit?: string;
  selected: string | null;
  onSelect: (name: string | null) => void;
  /**
   * ТАЙЛБАР нь ШҮҮЛТ (хэрэглэгч 2026-10-07, ойн хэсэглэл: "эндээс
   * филтер") — мөр бүр газрын зургийг будаж буй талбарын ангилал тул
   * товшиход тэр ангиллаар шүүнэ; дахин товшиход цуцлагдана. "Бусад"
   * (түлхүүргүй) товшигдохгүй.
   */
  chosen?: readonly string[];
  onPart?: (keys: readonly string[]) => void;
  fill?: boolean;
}) {
  const partOn = (keys?: readonly string[]) =>
    Boolean(keys?.length) && keys!.every((k) => chosen?.includes(k));
  const anyPart = parts.some((p) => partOn(p.keys));
  const max = Math.max(...rows.map((r) => r.ha), 0) || 1;
  const ha = (v: number) => `${measureText(v)}${unit ? ` ${unit}` : ""}`;
  /* Хэсэг бүрийн ШОШГО (хэрэглэгч 2026-10-07: "chart дээр нь label
     харуулаарай") — зурвасын бодит өргөнийг хэмжиж, бичвэр БАГТАХ
     хэсэгт л тоо бичнэ; тасарсан тоо худал уншигдана. Багтаагүй хэсгийн
     утга `title`-д. */
  const [track, setTrack] = React.useState(0);
  const observer = React.useRef<ResizeObserver | null>(null);
  const measure = React.useCallback((el: HTMLSpanElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([e]) =>
      setTrack(e.contentRect.width),
    );
    observer.current.observe(el);
  }, []);
  React.useEffect(() => () => observer.current?.disconnect(), []);
  return (
    <div className={cn("flex flex-col", fill && "min-h-0 flex-1")}>
      {/* Өнгөний тайлбар ДЭЭР: мөрүүд доошоо сунахад тайлбар ба мөрийн
          хооронд хоосон зай үүсэхгүй. Ганц хэсэгтэй үед (ангилалгүй
          давхарга) тайлбар ГАРАХГҮЙ — картын гарчиг аль хэдийн хэлнэ. */}
      {parts.length > 1 ? (
        <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-b border-line px-1 pb-2 text-[11px] text-ink-2">
          {parts.map((p) => {
            const swatch = (
              <span
                aria-hidden
                className="size-2.5 rounded-[2px]"
                style={{ background: soft(p.color) }}
              />
            );
            if (!onPart || !p.keys?.length)
              return (
                <span
                  key={p.label}
                  className="inline-flex items-center gap-1.5"
                >
                  {swatch}
                  {p.label}
                </span>
              );
            const on = partOn(p.keys);
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                onClick={() => onPart(p.keys!)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-xs hover:text-ink",
                  on && "font-semibold text-ink",
                )}
                style={{ opacity: anyPart && !on ? 0.4 : 1 }}
              >
                {swatch}
                {p.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        className={cn(
          "pt-1",
          fill && "flex min-h-0 flex-1 flex-col overflow-y-auto",
        )}
      >
        {rows.map((r, ri) => {
          const on = selected === r.name;
          return (
            <button
              key={r.name}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : r.name)}
              title={parts
                .map((p, i) => `${p.label}: ${ha(r.parts[i] ?? 0)}`)
                .join(" · ")}
              className={cn(
                "grid w-full grid-cols-[124px_minmax(0,1fr)_76px] items-center gap-x-2.5 rounded-xs px-1 py-[5px] text-left text-[12px] hover:bg-paper-hi",
                /* Баганаа дүүргэх үед мөрүүд өндрийг хуваалцана (≤44px) */
                fill && "max-h-11 min-h-[26px] flex-1",
              )}
              style={{ opacity: selected && !on ? 0.4 : 1 }}
            >
              <span className="truncate text-ink">{r.name}</span>
              <span
                ref={ri === 0 ? measure : undefined}
                className="h-4 overflow-hidden rounded-xs bg-paper-3"
              >
                <span
                  className="flex h-full"
                  style={{ width: `${(r.ha / max) * 100}%` }}
                >
                  {r.parts.map((v, i) => {
                    if (v <= 0) return null;
                    const text = measureText(v);
                    const px = track * (r.ha / max) * (v / r.ha);
                    return (
                      <span
                        key={i}
                        className="num flex h-full items-center justify-center overflow-hidden text-[10px] leading-none font-semibold whitespace-nowrap"
                        style={{
                          width: `${(v / r.ha) * 100}%`,
                          background: soft(parts[i]?.color),
                          color: "#0b1a14",
                        }}
                      >
                        {/* Ганц хэсэгтэй зурвасын утга мөрийн ард аль
                            хэдийн бичигдсэн — дотор нь ДАВТАХГҮЙ
                            (хэрэглэгч 2026-10-23, ногоон бүсийн хэсэг) */}
                        {parts.length > 1 && px >= text.length * 6.2 + 8
                          ? text
                          : null}
                      </span>
                    );
                  })}
                </span>
              </span>
              <span className="num text-right text-ink">{ha(r.ha)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
