"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Droplets,
  Hash,
  Loader2,
  Mountain,
  Sigma,
  Toilet,
  Waves,
} from "lucide-react";
import {
  fetchAnalysis,
  hexRing,
  type Analysis,
  type Cell,
} from "@/lib/latrine-analysis";
import { oklchHex } from "@/components/wells/colors";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import {
  defaultBasemap,
  type Basemap,
  type MapPoints,
} from "@/components/wells/map";
import { FilterBar } from "@/components/wells/filter-bar";
import { Columns } from "@/components/ui/resizable-columns";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { RowChart } from "@/components/charts";
import { Card, Field, Stat } from "@/components/analysis/ui";
import { cn, num } from "@/lib/utils";

const WellsMap = dynamic(
  () => import("@/components/wells/map").then((m) => m.WellsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-paper-3">
        <Loader2 size={16} className="animate-spin text-ink-3" />
      </div>
    ),
  },
);

/** Хоосон цэгэн давхарга — энэ самбар зөвхөн олон өнцөгт харуулна */
const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

/* ────────────────────────────────────────────────────────────────
   ӨНГӨ

   ⚠⚠ ХОСЛОЛЫН ГУРВАН × ГУРАВ нь "дата дүрслэлийн өнгө ГАНЦ" дүрмийн
   ЗӨВШӨӨРӨГДСӨН үл хамаарах зүйл: энд НЭГ биш ХОЁР эрэмбэтэй хэмжүүр
   зэрэг уншигдах ёстой. Судалгааны ГОЛ САНАА нь тэр хоёр замыг ЗЭРЭГ
   үзэх явдал (хэрэглэгч 2026-09-29: "Доошоо угаагдах (leaching),
   Хажуу тийш урсах (runoff/erosion) 2-ыг зэрэг судална") тул тусад
   нь зурвал самбар зорилгоо алдана.

   ⚠ Өнгөний өнцөг нь платформын ХОЁР ДОХИОНООС гарна: хажуу тийш
   урсах нь `--clay` (25°), доошоо угаагдах нь `--water` (255°). Хослол нь тэр хоёрын
   ДУНД — 25-аас 255 руу 340 (ягаан) дундуур явна. Эсрэг зүгт
   (ногоон, шар) явбал дохионы утга алдагдана.

   ⚠ Газрын зураг гэрэл, харанхуйд ИЖИЛ тул өнгө нь тогтмол hex —
   платформын токен зураг дотор орохгүй.
   ──────────────────────────────────────────────────────────────── */

/** Хажуу тийш (`ri`) × доошоо (`li`) — зэрэглэл нь 1…3 */
function bivarHex(ri: number, li: number): string {
  const wr = ri - 1;
  const wl = li - 1;
  const load = wr + wl;
  if (load === 0) return oklchHex(0.88, 0.012, 240);
  /* Хоёр тэнхлэгийн жингээр 25° (урсац) ↔ 255° (нэвчилт) хооронд */
  const t = wl / load;
  const hue = (25 - t * 130 + 360) % 360;
  /* ⚠ ХАНАЛТ 0.14-ААС ХЭТРЭХГҮЙ: 0.24 дээр хиймэл дагуулын зураг
     дээр ягаан нь цахилгаан өнгө болж, платформын даруу палитрнаас
     гарч байв (хэмжсэн — дөрвөн шатны дээд нь). Платформын дохионууд
     бүгд 0.10–0.16-ийн мужид. */
  return oklchHex(0.88 - load * 0.08, 0.02 + load * 0.03, hue);
}

/** Ганц хэмжигдэхүүний шатлал — платформын дата өнгөний гэр бүл */
function rampHex(t: number): string {
  return oklchHex(0.88 - t * 0.36, 0.05 + t * 0.09, 200);
}

/* ────────────────────────────────────────────────────────────────
   ХЭМЖИГДЭХҮҮН

   Газрын зураг нэг удаад НЭГ хэмжигдэхүүн харуулна — нэг дүрс хоёр
   утга заавал аль нь болох нь уншигдахгүй.
   ──────────────────────────────────────────────────────────────── */
type MetricId = "bivar" | "ri" | "li" | "load" | "n";

const METRICS: { id: MetricId; label: string; unit?: string }[] = [
  { id: "bivar", label: "Хоёр замын хослол" },
  { id: "ri", label: "Хажуу тийш урсах" },
  { id: "li", label: "Доошоо угаагдах" },
  { id: "load", label: "Азотын ачаалал", unit: "кг/жил" },
  { id: "n", label: "Нүхэн жорлонгийн тоо" },
];

const READ: Record<Exclude<MetricId, "bivar">, (c: Cell) => number> = {
  ri: (c) => c.ri,
  li: (c) => c.li,
  load: (c) => c.load,
  n: (c) => c.n,
};

/*
  ⚠⚠ ШАТЛАЛ нь ЭРЭМБЭЭР тогтоно, шугаман мужаар БИШ. Утгууд эрс
  хазайсан (азотын ачаалал 10.6 … 3,200.7 кг, дундаж нь 448) тул
  тэнцүү мужид хуваавал бараг бүх нүд эхний өнгөнд унаж, зураг нэг
  өнгийн хөнжил болно. Тавны нэгээр хуваахад бүлэг бүрд ижил тооны
  нүд оногдоно.
*/
const STEPS = 5;

function quantiles(values: number[]): number[] {
  const s = [...values].sort((a, b) => a - b);
  return Array.from(
    { length: STEPS - 1 },
    (_, i) => s[Math.floor((s.length * (i + 1)) / STEPS)],
  );
}

function stepOf(v: number, cuts: number[]): number {
  let i = 0;
  while (i < cuts.length && v >= cuts[i]) i++;
  return i;
}

/* ────────────────────────────────────────────────────────────────
   ХӨРСНИЙ ХЭМЖИЛТИЙН НЭР

   Эх сурвалжийн шалгалтын хүснэгт англиар бичигдсэн. Эдгээр нь
   хөрсний мониторингийн давхаргын ӨӨРИЙН баганууд тул платформ дээр
   монголоор нэрлэнэ — орчуулга биш, бичиглэлийн засвар.
   ──────────────────────────────────────────────────────────────── */
const TARGETS: Record<string, string> = {
  "2023 bacteria count (BBET_too)": "Бактерийн тоо, 2023",
  "2023 anaerobic titer (low=worse)": "Агааргүйтний титр, 2023",
  "2024 E.coli titer (low=worse)": "E. coli-ийн титр, 2024",
  "2024 total bacteria (Number)": "Нийт бактери, 2024",
  "2024 PLI metals": "Хүнд металын бохирдлын ачааллын индекс, 2024",
};

const PREDICTORS: Record<string, string> = {
  n200: "200 метрийн дотор",
  n500: "500 метрийн дотор",
  up: "Дээрээс урсаж ирэх",
};

export function LatrineAnalysis() {
  const [data, setData] = React.useState<Analysis | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [metric, setMetric] = React.useState<MetricId>("bivar");
  /** Хослолын матрицаас сонгосон нүд — "урсац-нэвчилт" */
  const [combo, setCombo] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const tip = useMapTip();

  React.useEffect(() => {
    let alive = true;
    fetchAnalysis().then(
      (d) => {
        if (alive) setData(d);
      },
      (e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const cells = data?.cells;

  /* Шүүлт нь ЗӨВХӨН хослолын матрицаас — нэг суваг, нэг төлөв */
  const shown = React.useMemo(() => {
    if (!cells) return [];
    if (!combo) return cells;
    return cells.filter((c) => `${c.ric}-${c.lic}` === combo);
  }, [cells, combo]);

  /* Өнгөний шатлал нь ШҮҮГДЭЭГҮЙ бүх нүднээс — шүүх бүрд өнгө
     солигдвол нэг нүд хоёр өөр өнгөтэй харагдана */
  const cuts = React.useMemo(() => {
    if (!cells || metric === "bivar") return [];
    return quantiles(cells.map(READ[metric]));
  }, [cells, metric]);

  const colorOf = React.useCallback(
    (c: Cell) =>
      metric === "bivar"
        ? bivarHex(c.ric, c.lic)
        : rampHex(stepOf(READ[metric](c), cuts) / (STEPS - 1)),
    [metric, cuts],
  );

  const shapes = React.useMemo(() => {
    if (!data) return null;
    return {
      type: "FeatureCollection" as const,
      features: shown.map((c) => ({
        type: "Feature" as const,
        id: c.id,
        properties: { oid: c.id, c: colorOf(c) },
        geometry: {
          type: "Polygon" as const,
          coordinates: [hexRing(c, data.shape)],
        },
      })),
    };
  }, [data, shown, colorOf]);

  /* Хослолын матриц — гурван зэрэглэл × гурав, нүд бүр нь шүүлт */
  const matrix = React.useMemo(() => {
    const m = new Map<string, { cells: number; load: number }>();
    for (const c of cells ?? []) {
      const key = `${c.ric}-${c.lic}`;
      const at = m.get(key) ?? { cells: 0, load: 0 };
      at.cells += 1;
      at.load += c.load;
      m.set(key, at);
    }
    return m;
  }, [cells]);

  const stats = React.useMemo(() => {
    const sum = (read: (c: Cell) => number) =>
      shown.reduce((a, c) => a + read(c), 0);
    return {
      cells: shown.length,
      latrines: sum((c) => c.n),
      load: sum((c) => c.load),
      ri: sum((c) => c.ri),
      li: sum((c) => c.li),
    };
  }, [shown]);

  /* Урсацын эзлэх хувь — тасралтгүй утгыг таван мужид */
  const shareBins = React.useMemo(() => {
    const edges = [0.2, 0.4, 0.6, 0.8];
    const names = ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"];
    const counts = new Array<number>(5).fill(0);
    for (const c of shown) counts[stepOf(c.share, edges)] += 1;
    return names.map((label, i) => ({ key: label, label, value: counts[i] }));
  }, [shown]);

  const hovered = tip.oid == null ? null : (cells?.[tip.oid] ?? null);
  const chosen = picked == null ? null : (cells?.[picked] ?? null);

  if (error) {
    return (
      <div className="hatch flex h-full items-center justify-center rounded-xs border border-dashed border-line-2">
        <p className="px-6 text-center text-[12.5px] leading-snug text-ink-3">
          {error}
        </p>
      </div>
    );
  }

  if (!data || !shapes) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <Loader2 size={16} className="animate-spin text-ink-3" />
      </div>
    );
  }

  const active = METRICS.find((m) => m.id === metric) ?? METRICS[0];

  return (
    /*
      ⚠ `department-workspace` БИШ: тэр нь 280px-ийн өгөгдлийн багцын
      зурвас + агуулга гэсэн ХОЁР БАГАНАТ тор. Энэ хуудас нэг сэдэвтэй
      тул сонгох зурвас байхгүй — зүүн тал хоосон үлдэх байв.
    */
    <div
      className="flex h-full min-h-0 flex-col gap-2"
      style={{ "--tone": "var(--data)" } as React.CSSProperties}
    >
      <FilterBar
        title="ДҮН ШИНЖИЛГЭЭ"
        activeCount={combo ? 1 : 0}
        onReset={() => setCombo(null)}
        leading={
          /* ⚠ ХАРИЛЦАН ҮГҮЙСГЭХ сонголт тул унтраалга биш РАДИО:
             нэг цэгэн давхарга нэг л өнгөний хуваарь үүрч чадна */
          <div className="flex flex-wrap items-center gap-1">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={metric === m.id}
                onClick={() => setMetric(m.id)}
                className={cn(
                  "rounded-xs border px-2 py-1 text-[11.5px] transition-colors",
                  metric === m.id
                    ? "border-(--tone) bg-(--tone)/10 text-ink"
                    : "border-line text-ink-2 hover:bg-paper-hi",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        {/* ⚠ "Шүүлтүүр хэрэглээгүй" гэж БИЧИХГҮЙ — `FilterBar` өөрөө
            тэр мөрийг гаргадаг тул давхардана */}
        {combo ? (
          <span className="text-[11.5px] text-ink-2">
            Хажуу тийш {combo[0]} · доошоо {combo[2]}
          </span>
        ) : null}
      </FilterBar>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="analytics-overview" aria-label="Өгөгдлийн тойм">
          <Stat icon={Toilet} label="Нүхэн жорлон" value={num(stats.latrines)} />
          <Stat
            icon={Sigma}
            label="Азотын ачаалал, тонн/жил"
            value={num(Math.round(stats.load / 1000))}
          />
          <Stat
            icon={Waves}
            label="Хажуу тийш урсах, тонн/жил"
            value={num(Math.round(stats.ri / 1000))}
          />
          <Stat
            icon={Droplets}
            label="Доошоо угаагдах, тонн/жил"
            value={num(Math.round(stats.li / 1000))}
          />
          <Stat icon={Hash} label="Судалгааны нүд" value={num(stats.cells)} />
        </div>

        <Columns
          id="latrine-analysis"
          left={312}
          right={340}
          className="min-h-0 flex-1"
        >
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            <ComboMatrix
              matrix={matrix}
              picked={combo}
              onPick={(k) => setCombo((v) => (v === k ? null : k))}
            />
            <Card title="ХАЖУУ ТИЙШ УРСАХ ЭЗЛЭХ ХУВЬ" grow>
              <RowChart data={shareBins} dense />
            </Card>
          </div>

          <div className="relative min-h-0 overflow-hidden rounded-xs border border-line">
            {/*
              ЗӨВХӨН олон өнцөгт: нүд бүрийн утга нь байршилд биш
              ТАЛБАЙД байгаа тул төлөөлөх цэг нь мэдээлэл нэмэхгүй.

              ⚠⚠ ШОШГО ОГТ ГАРАХГҮЙ: нүдэнд НЭР гэж байхгүй (зөвхөн
              дугаар) тул шошгын давхарга юу ч зурах зүйлгүй —
              `properties.t` байхгүй бүх дүрсийг өөрөө шүүнэ.
              ⚠ `labelZoom` нь 24-ЭЭС ХЭТЭРВЭЛ ЗАГВАР БҮХЭЛДЭЭ УНАНА:
              MapLibre-ийн `minzoom` дээд хязгаар 24 бөгөөд хэтэрсэн
              утга нь "30 is greater than the maximum value 24" гэж
              загварыг голж, улмаас `style.layers` тодорхойгүй болж
              зураг зурагдахгүй (30 гэж бичээд яг ингэж гарсан).
            */}
            <WellsMap
              points={NO_POINTS}
              visible={NO_INDEX}
              shapes={{ data: shapes, selected: picked, labelZoom: 24 }}
              basemap={basemap}
              onSelect={(oid) => setPicked((v) => (v === oid ? null : oid))}
              onHover={tip.onHover}
              cluster={false}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} />
            <MapTip state={tip}>
              {hovered ? (
                <>
                  <MapTipRow
                    icon={Toilet}
                    text={`${num(hovered.n)} нүхэн жорлон`}
                    num
                  />
                  <MapTipRow
                    icon={Sigma}
                    text={`${num(Math.round(hovered.load))} кг азот/жил`}
                    num
                  />
                  <MapTipRow
                    icon={Waves}
                    text={`Хажуу тийш ${Math.round(hovered.share * 100)}%`}
                    num
                  />
                  <MapTipRow
                    icon={Mountain}
                    text={`Голдирлоос ${num(Math.round(hovered.hand))} м дээш`}
                    num
                  />
                </>
              ) : null}
            </MapTip>
          </div>

          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            <Card title="ХӨРСНИЙ ХЭМЖИЛТТЭЙ ХАРЬЦУУЛАЛТ" grow>
              <ValidationTable rows={data.validation} />
            </Card>
            {chosen ? (
              <Card title="СОНГОСОН НҮД">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Field label="Нүхэн жорлон" value={num(chosen.n)} />
                  <Field
                    label="Азотын ачаалал, кг/жил"
                    value={num(Math.round(chosen.load))}
                  />
                  <Field
                    label="Хажуу тийш урсах"
                    value={num(Math.round(chosen.ri))}
                  />
                  <Field
                    label="Доошоо угаагдах"
                    value={num(Math.round(chosen.li))}
                  />
                  <Field
                    label="Голдирлоос дээших өндөр, м"
                    value={num(Math.round(chosen.hand))}
                  />
                  <Field label="Налуу, градус" value={chosen.slope.toFixed(1)} />
                  <Field
                    label="Урсгалын урт, м"
                    value={num(Math.round(chosen.flow))}
                  />
                  <Field
                    label="Хажуу тийш урсах хувь"
                    value={`${Math.round(chosen.share * 100)}%`}
                  />
                </dl>
              </Card>
            ) : metric === "bivar" ? (
              /* ⚠ ХОСЛОЛ дээр хуваарийн карт ГАРАХГҮЙ: зүүн талын
                 матриц өөрөө тайлбар бөгөөд гарчиг нь ч ижил байсан
                 тул хоёр карт нэг нэрээр зэрэгцэж байв */
              null
            ) : (
              <Card title={active.label.toUpperCase()}>
                <Scale metric={metric} cuts={cuts} unit={active.unit} />
              </Card>
            )}
          </div>
        </Columns>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   ХОСЛОЛЫН МАТРИЦ

   Зургийн ТАЙЛБАР ба ШҮҮЛТҮҮР хоёр нэг дүрсэнд: нүд бүр өөрийн
   өнгөтэй бөгөөд товшиход тэр хослолоор шүүнэ. Тусдаа тайлбар
   зурвал өнгө хоёр газар тодорхойлогдож, эрт орой зөрнө.
   ──────────────────────────────────────────────────────────────── */
function ComboMatrix({
  matrix,
  picked,
  onPick,
}: {
  matrix: Map<string, { cells: number; load: number }>;
  picked: string | null;
  onPick: (key: string) => void;
}) {
  return (
    <Card title="ХОЁР ЗАМЫН ХОСЛОЛ">
      <div className="flex gap-2">
        {/* Босоо тэнхлэг — нэвчилт дээшээ өснө */}
        <div className="flex shrink-0 flex-col items-end justify-between py-[2px] text-[10px] text-ink-3">
          <span>их</span>
          <span>бага</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-3 gap-[3px]">
            {[3, 2, 1].map((li) =>
              [1, 2, 3].map((ri) => {
                const key = `${ri}-${li}`;
                const at = matrix.get(key);
                const on = picked === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onPick(key)}
                    title={`Хажуу тийш урсах ${ri} · доошоо угаагдах ${li}`}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-xs border transition-opacity",
                      on ? "border-ink" : "border-transparent",
                      picked && !on && "opacity-45",
                    )}
                    style={{ background: bivarHex(ri, li) }}
                  >
                    <span className="num text-[11px] font-semibold text-[#10171d]">
                      {num(at?.cells ?? 0)}
                    </span>
                  </button>
                );
              }),
            )}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-ink-3">
            <span>бага</span>
            <span>их</span>
          </div>
        </div>
      </div>
      {/* Тэнхлэг тус бүрийн нэр — аль нь хэвтээ, аль нь босоо болохыг
          сумаар хэлнэ; өнгө нь тэр хоёрын ХОСЛОЛ */}
      <div className="mt-2 space-y-0.5 text-[10.5px] text-ink-3">
        <div>→ Хажуу тийш урсах (урсац, элэгдэл)</div>
        <div>↑ Доошоо угаагдах (нэвчилт)</div>
      </div>
    </Card>
  );
}

/** Ганц хэмжигдэхүүний өнгөний хуваарь */
function Scale({
  metric,
  cuts,
  unit,
}: {
  metric: MetricId;
  cuts: number[];
  unit?: string;
}) {
  if (metric === "bivar") {
    return (
      <p className="text-[11.5px] leading-relaxed text-ink-2">
        Зургийн өнгө нь хоёр замын хослолыг хэлнэ. Дээрх матрицын нүд
        товшиход тэр хослолоор шүүнэ.
      </p>
    );
  }
  const edges = [0, ...cuts];
  return (
    <div className="space-y-1">
      {edges.map((v, i) => (
        <div key={v} className="flex items-center gap-2 text-[11.5px]">
          <span
            className="size-3 shrink-0 rounded-[2px]"
            style={{ background: rampHex(i / (STEPS - 1)) }}
          />
          <span className="num text-ink-2">
            {num(Math.round(v))}
            {i < cuts.length ? ` – ${num(Math.round(cuts[i]))}` : " –"}
          </span>
          {unit && i === 0 ? (
            <span className="ml-auto text-[10.5px] text-ink-3">{unit}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/*
  ХӨРСНИЙ ХЭМЖИЛТТЭЙ ХАРЬЦУУЛАЛТ

  Судалгааны загварчилсан ачаалал нь БОДИТ хэмжилттэй хэр нийцэж
  байгааг шалгасан үр дүн. Хэмжилт нь хүрээлэн буй орчны хэлтсийн
  хөрсний мониторингийн цэгүүд — платформ дээр аль хэдийн байдаг
  бүртгэл тул энэ самбар тэр хоёрыг холбоно.
*/
function ValidationTable({ rows }: { rows: Analysis["validation"] }) {
  const groups = React.useMemo(() => {
    const m = new Map<string, Analysis["validation"]>();
    for (const r of rows) {
      const at = m.get(r.target) ?? [];
      at.push(r);
      m.set(r.target, at);
    }
    return [...m];
  }, [rows]);

  /* Зурвасын урт нь БҮХ мөрийн дээд утгаар — бүлэг тус бүрээр
     хуваавал сул хамаарал хүчтэй мэт харагдана */
  const max = Math.max(...rows.map((r) => Math.abs(r.rho)), 0.01);

  return (
    <div className="divide-y divide-line">
      {groups.map(([target, list]) => (
        <div key={target} className="py-2 first:pt-0 last:pb-0">
          <div className="text-[11.5px] leading-snug font-medium text-ink">
            {TARGETS[target] ?? target}
          </div>
          <div className="mt-1.5 space-y-1">
            {list.map((r) => (
              <div key={r.predictor} className="flex items-center gap-2">
                <span className="w-[124px] shrink-0 truncate text-[10.5px] text-ink-3">
                  {PREDICTORS[r.predictor] ?? r.predictor}
                </span>
                <span className="h-[5px] min-w-0 flex-1 rounded-[2px] bg-paper-hi">
                  <span
                    className="block h-full rounded-[2px]"
                    style={{
                      width: `${(Math.abs(r.rho) / max) * 100}%`,
                      /* ⚠ ӨНГӨ нь АЧ ХОЛБОГДЛЫГ хэлнэ: p ≥ 0.05 үед
                         хамаарал нь санамсаргүй байж болох тул бүдэг */
                      background: r.p < 0.05 ? "var(--tone)" : "var(--line-2)",
                    }}
                  />
                </span>
                <span className="num w-[34px] shrink-0 text-right text-[11px] text-ink-2">
                  {r.rho.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
