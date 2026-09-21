"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarDays,
  CalendarRange,
  FileCheck2,
  Layers3,
  Loader2,
  MapPin,
  MousePointerClick,
  Ruler,
  ScrollText,
  Users,
} from "lucide-react";
import { BarChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { Columns } from "@/components/ui/resizable-columns";
import { MapPanel, useMapPanel } from "@/components/map/panel";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import {
  fetchAssessments,
  ASSESSMENT_YEARS,
  type AssessmentYear,
  sizeClass,
  ACTIVITIES,
  SIZE_CLASSES,
  type Assessment,
  type AssessmentData,
} from "@/lib/assessment";
import { Bounds } from "@/lib/extent";
import { spreadRamp } from "@/lib/tone-ramp";
import { cn, num } from "@/lib/utils";
import { Card, Field, Head, MapLegend, Pending, Stat, type LegendItem } from "./ui";
import { Composition, Matrix, Segments, type Key } from "./viz";
import { TrendChart } from "./subject-charts";

const PolygonMap = dynamic(
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

/** Цэгэн давхарга хэрэглэхгүй — энэ самбар зөвхөн нэгж талбарын хүрээ харуулна */
const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

type Dim = "activity" | "landuse" | "district" | "right" | "size";
type Skip = Dim | "period";

const ACTIVITY_LABEL = new Map<string, string>(
  ACTIVITIES.map((a) => [a.id, a.label] as [string, string]),
);
const SIZE_LABEL = new Map<string, string>(SIZE_CLASSES.map((s) => [s.id, s.label]));

/** Хүснэгтийн МӨРИЙН хэмжээс — багана нь үргэлж дүүрэг */
const ROW_DIMS = [
  { id: "activity", label: "Үйл ажиллагааны чиглэл" },
  { id: "landuse", label: "Газрын зориулалт" },
  { id: "right", label: "Эрхийн хэлбэр" },
  { id: "size", label: "Талбайн хэмжээ" },
] as const;
type RowDim = (typeof ROW_DIMS)[number]["id"];

/*
  ГАЗРЫН ЗУРГИЙН ӨНГӨ — хоёр горим, тайлбарын толгойд сэлгэнэ.
  Платформын дүрмээр ангилал ЗУРГААС ОЛОН бол өнгөөр ялгахгүй
  (`tone-ramp.ts`): эрхийн хэлбэр (3) ба талбайн хэмжээ (5, эрэмбэтэй).
  Үйл ажиллагааны чиглэл арван бүлэгтэй тул хүснэгтээр л явна.
*/
const COLOR_MODES = [
  { id: "right", label: "Эрхийн хэлбэр" },
  { id: "size", label: "Талбайн хэмжээ" },
] as const;
type ColorMode = (typeof COLOR_MODES)[number]["id"];

const FALLBACK = "#67d7e4";

/**
 * Байгаль орчны ерөнхий үнэлгээний самбар — 2026-09-18-нд ШИНЭЭР
 * бичигдсэн (хэрэглэгч: "бүтэц, харагдах байдал огт таалагдахгүй,
 * диаграмууд ойлгомжгүй, нэг хэвийн").
 *
 * Мөрөн диаграм ОГТ БАЙХГҮЙ. Бүтэц:
 *   шүүлтүүрийн мөр (он сонголттой)
 *   → үзүүлэлтийн зурвас (тав)
 *   → ЗҮҮН: сарын баганан диаграм · ДҮҮРГЭЭР ЗАДАРГАА (хоёр хэмжээсийн
 *     хүснэгт, мөрийн хэмжээс сэлгэнэ) · эрхийн хэлбэрийн зурвас ба
 *     талбайн хэмжээний тархалт
 *   → БАРУУН: газрын зураг, өнгөт тайлбартай.
 *
 * Гол зүйл нь ХҮСНЭГТ: "аль дүүрэгт ямар үйл ажиллагаа хэр олон" гэдэг
 * нь хоёр тусдаа мөрөн диаграмаас уншигддаггүй байсан. Мөр, багана,
 * нүд бүр товшигдож шүүнэ; зураг, бусад диаграм дагаж хумигдана.
 */
export function UnelgeeDashboard() {
  const [year, setYear] = React.useState<AssessmentYear>(
    ASSESSMENT_YEARS[ASSESSMENT_YEARS.length - 1],
  );
  const [data, setData] = React.useState<AssessmentData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [activity, setActivity] = React.useState<string | null>(null);
  const [landuse, setLanduse] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [right, setRight] = React.useState<string | null>(null);
  const [size, setSize] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [rowDim, setRowDim] = React.useState<RowDim>("activity");
  const [colorMode, setColorMode] = React.useState<ColorMode>("right");

  const clearAll = React.useCallback(() => {
    setActivity(null);
    setLanduse(null);
    setDistrict(null);
    setRight(null);
    setSize(null);
    setPeriod(null);
    setPicked(null);
  }, []);
  /* Он солиход шүүлтүүр цэвэрлэгдэнэ — нэг оны чиглэл, зориулалт
     нөгөөд нь байхгүй байж болно */
  const pickYear = React.useCallback(
    (y: AssessmentYear) => {
      setYear(y);
      clearAll();
    },
    [clearAll],
  );
  const tip = useMapTip();
  const panel = useMapPanel("left");
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  React.useEffect(() => {
    const ac = new AbortController();
    fetchAssessments(year, ac.signal)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, [year]);

  const rows = data?.rows;

  /** Бичлэгийн тухайн хэмжээсийн утга */
  const dimOf = React.useCallback((r: Assessment, d: Dim): string => {
    switch (d) {
      case "activity":
        return r.activity;
      case "landuse":
        return r.landuse;
      case "district":
        return r.district;
      case "right":
        return r.right;
      case "size":
        return String(sizeClass(r.m2));
    }
  }, []);
  const labelOf = React.useCallback((d: Dim, k: string): string => {
    if (d === "activity") return ACTIVITY_LABEL.get(k) ?? k;
    if (d === "size") return SIZE_LABEL.get(k) ?? k;
    return k;
  }, []);

  /**
   * Шүүлт — `skips`-д заасан хэмжээсийг алгасна. Диаграм бүр ӨӨРИЙН
   * хэмжээсээ алгасаж шүүгддэг тул сонгосны дараа ч бусад утга
   * харагдсаар үлдэнэ; хүснэгт хоёр хэмжээсээ зэрэг алгасна.
   */
  const passes = React.useCallback(
    (r: Assessment, ...skips: Skip[]) => {
      const s = new Set<Skip>(skips);
      if (!s.has("activity") && activity && r.activity !== activity) return false;
      if (!s.has("landuse") && landuse && r.landuse !== landuse) return false;
      if (!s.has("district") && district && r.district !== district) return false;
      if (!s.has("right") && right && r.right !== right) return false;
      if (!s.has("size") && size && String(sizeClass(r.m2)) !== size) return false;
      if (!s.has("period") && period && r.period !== period) return false;
      return true;
    },
    [activity, landuse, district, right, size, period],
  );

  const filtered = React.useMemo(() => (rows ?? []).filter((r) => passes(r)), [rows, passes]);

  /* ---------------- Өнгө — ШҮҮГДЭЭГҮЙ бүртгэлээс, тогтмол ---------------- */
  const rightColor = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.right, (m.get(r.right) ?? 0) + 1);
    const keys = [...m].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const ramp = spreadRamp(keys.length);
    return new Map<string, string>(keys.map((k, i) => [k, ramp[i]]));
  }, [rows]);
  const sizeColor = React.useMemo(() => {
    const ramp = spreadRamp(SIZE_CLASSES.length);
    return new Map<string, string>(SIZE_CLASSES.map((s, i) => [s.id, ramp[i]]));
  }, []);
  const colorOfRow = React.useCallback(
    (r: Assessment) =>
      colorMode === "right"
        ? (rightColor.get(r.right) ?? FALLBACK)
        : (sizeColor.get(String(sizeClass(r.m2))) ?? FALLBACK),
    [colorMode, rightColor, sizeColor],
  );

  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const on = new Map(filtered.map((r) => [r.oid, r]));
    const features: GeoJSON.Feature[] = [];
    for (const f of data.shapes.features) {
      const r = on.get(Number(f.id));
      if (!r) continue;
      features.push({ ...f, properties: { oid: r.oid, c: colorOfRow(r) } });
    }
    return { type: "FeatureCollection", features };
  }, [data, filtered, colorOfRow]);

  /* ---------------- Задаргаа ---------------- */
  const count = React.useCallback(
    (of: (r: Assessment) => string, ...skips: Skip[]) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!passes(r, ...skips)) continue;
        m.set(of(r), (m.get(of(r)) ?? 0) + 1);
      }
      return m;
    },
    [rows, passes],
  );

  const rightData = React.useMemo<Datum[]>(() => {
    const m = count((r) => r.right, "right");
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [count]);

  const sizeData = React.useMemo<Datum[]>(() => {
    const m = count((r) => String(sizeClass(r.m2)), "size");
    return SIZE_CLASSES.map((s) => ({ key: s.id, label: s.label, value: m.get(s.id) ?? 0 }));
  }, [count]);

  /* Шүүлтүүрийн цэс — хэмжээс тус бүрийн жагсаалт */
  const menu = React.useCallback(
    (d: Dim): Datum[] => {
      const m = count((r) => dimOf(r, d), d);
      const out = [...m].map(([k, v]) => ({ key: k, label: labelOf(d, k), value: v }));
      if (d === "activity") {
        const order = new Map<string, number>(ACTIVITIES.map((a, i) => [a.id, i]));
        return out.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
      }
      if (d === "size") return out.sort((a, b) => Number(a.key) - Number(b.key));
      return out.sort((a, b) => b.value - a.value);
    },
    [count, dimOf, labelOf],
  );
  const activityMenu = React.useMemo(() => menu("activity"), [menu]);
  const landuseMenu = React.useMemo(() => menu("landuse"), [menu]);
  const districtMenu = React.useMemo(() => menu("district"), [menu]);

  /* Сарын цуваа — бичлэггүй сар ч суудалтай */
  const monthData = React.useMemo<Datum[]>(() => {
    const c = new Map<string, number>();
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows ?? []) {
      if (!passes(r, "period") || !r.period) continue;
      c.set(r.period, (c.get(r.period) ?? 0) + 1);
      const t = Number(r.period.slice(0, 4)) * 12 + Number(r.period.slice(5)) - 1;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    if (!Number.isFinite(lo)) return [];
    const out: Datum[] = [];
    for (let t = lo; t <= hi; t++) {
      const y = Math.floor(t / 12);
      const mo = (t % 12) + 1;
      const key = `${y}-${String(mo).padStart(2, "0")}`;
      out.push({ key, label: `${y} оны ${mo}-р сар`, value: c.get(key) ?? 0 });
    }
    return out;
  }, [rows, passes]);

  /* ---------------- Хүснэгт: мөрийн хэмжээс × дүүрэг ---------------- */
  const matrix = React.useMemo(() => {
    const base = (rows ?? []).filter((r) => passes(r, rowDim, "district"));
    const rowTotal = new Map<string, number>();
    const colTotal = new Map<string, number>();
    const cells = new Map<string, number>();
    for (const r of base) {
      const rk = dimOf(r, rowDim);
      rowTotal.set(rk, (rowTotal.get(rk) ?? 0) + 1);
      colTotal.set(r.district, (colTotal.get(r.district) ?? 0) + 1);
      const ck = `${rk}\u001f${r.district}`;
      cells.set(ck, (cells.get(ck) ?? 0) + 1);
    }
    let rowKeys: Key[];
    if (rowDim === "activity") {
      rowKeys = ACTIVITIES.filter((a) => rowTotal.has(a.id)).map((a) => ({ key: a.id, label: a.label }));
    } else if (rowDim === "size") {
      rowKeys = SIZE_CLASSES.filter((s) => rowTotal.has(s.id)).map((s) => ({ key: s.id, label: s.label }));
    } else {
      rowKeys = [...rowTotal]
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => ({ key: k, label: k }));
    }
    const colKeys: Key[] = [...colTotal]
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => ({ key: k, label: k }));
    return { rowKeys, colKeys, cell: (r: string, c: string) => cells.get(`${r}\u001f${c}`) ?? 0 };
  }, [rows, passes, rowDim, dimOf]);

  const rowSel = rowDim === "activity" ? activity : rowDim === "landuse" ? landuse : rowDim === "right" ? right : size;
  const setRowSel = (k: string | null) => {
    if (rowDim === "activity") setActivity(k);
    else if (rowDim === "landuse") setLanduse(k);
    else if (rowDim === "right") setRight(k);
    else setSize(k);
  };

  /** Зургийн тайлбар */
  const legend = React.useMemo<LegendItem[]>(() => {
    if (colorMode === "right") {
      return rightData.map((d) => ({
        key: d.key,
        label: d.label,
        color: rightColor.get(d.key) ?? FALLBACK,
        count: d.value,
      }));
    }
    return sizeData.map((d) => ({
      key: d.key,
      label: d.label,
      color: sizeColor.get(d.key) ?? FALLBACK,
      count: d.value,
    }));
  }, [colorMode, rightData, sizeData, rightColor, sizeColor]);

  /* ---------------- Үзүүлэлт ---------------- */
  const stats = React.useMemo(() => {
    let m2 = 0;
    const applicants = new Set<string>();
    const byMonth = new Map<string, number>();
    for (const r of filtered) {
      m2 += r.m2;
      applicants.add(r.applicant);
      if (r.period) byMonth.set(r.period, (byMonth.get(r.period) ?? 0) + 1);
    }
    const months = [...byMonth].sort((a, b) => b[1] - a[1]);
    const ps = [...byMonth.keys()].sort();
    const nice = (v: string) => `${Number(v.slice(5))}-р сар`;
    return {
      n: filtered.length,
      ha: m2 / 10000,
      applicants: applicants.size,
      perMonth: months.length ? filtered.length / months.length : 0,
      peak: months.length ? { label: nice(months[0][0]), n: months[0][1] } : null,
      span: ps.length ? `${nice(ps[0])} – ${nice(ps[ps.length - 1])}` : "—",
    };
  }, [filtered]);

  const anyFilter = Boolean(activity || landuse || district || right || size || period);
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked != null) {
      const f = data.shapes.features.find((x) => Number(x.id) === picked);
      if (!f) return null;
      const b = new Bounds();
      b.addGeometry(f.geometry);
      return b.get(0.0008);
    }
    if (!anyFilter) return null;
    const b = new Bounds();
    for (const f of shapes.features) b.addGeometry(f.geometry);
    return b.get();
  }, [data, shapes, picked, anyFilter]);

  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (rows?.find((r) => r.oid === tip.oid) ?? null)),
    [rows, tip.oid],
  );
  const selected = React.useMemo(
    () => (picked == null ? null : (rows?.find((r) => r.oid === picked) ?? null)),
    [rows, picked],
  );

  if (error || !data) {
    return <Pending error={error} text="Ерөнхий үнэлгээний бүртгэл татаж байна…" />;
  }

  const activeCount =
    (activity ? 1 : 0) + (landuse ? 1 : 0) + (district ? 1 : 0) + (right ? 1 : 0) + (size ? 1 : 0) + (period ? 1 : 0);

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-2.5"
      style={{ "--tone": "var(--d-unelgee)" } as React.CSSProperties}
    >
      <FilterBar
        title="БАЙГАЛЬ ОРЧНЫ НӨЛӨӨЛЛИЙН ЕРӨНХИЙ ҮНЭЛГЭЭ"
        activeCount={activeCount}
        onReset={clearAll}
        leading={
          <div className="flex shrink-0 items-center gap-1">
            {ASSESSMENT_YEARS.map((y) => {
              const on = year === y;
              return (
                <button
                  key={y}
                  onClick={() => pickYear(y)}
                  aria-pressed={on}
                  className={cn(
                    "num rounded-xs border px-2.5 py-1 text-[12px] transition-colors",
                    on ? "border-data/45 bg-data/10 text-ink" : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        }
      >
        <FilterMenu
          label="Үйл ажиллагааны чиглэл"
          icon={Layers3}
          value={activity ? (ACTIVITY_LABEL.get(activity) ?? null) : null}
          active={Boolean(activity)}
          onClear={() => setActivity(null)}
          width={240}
        >
          <PickList items={activityMenu} selected={activity} onPick={setActivity} />
        </FilterMenu>
        <FilterMenu
          label="Газрын зориулалт"
          icon={ScrollText}
          value={landuse}
          active={Boolean(landuse)}
          onClear={() => setLanduse(null)}
          width={300}
        >
          <PickList items={landuseMenu} selected={landuse} onPick={setLanduse} />
        </FilterMenu>
        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={210}
        >
          <PickList items={districtMenu} selected={district} onPick={setDistrict} />
        </FilterMenu>
        <FilterMenu
          label="Эрхийн хэлбэр"
          icon={FileCheck2}
          value={right}
          active={Boolean(right)}
          onClear={() => setRight(null)}
          width={200}
        >
          <PickList items={rightData} selected={right} onPick={setRight} />
        </FilterMenu>
        <FilterMenu
          label="Талбайн хэмжээ"
          icon={Ruler}
          value={size ? (SIZE_LABEL.get(size) ?? null) : null}
          active={Boolean(size)}
          onClear={() => setSize(null)}
          width={210}
        >
          <PickList items={sizeData} selected={size} onPick={setSize} />
        </FilterMenu>
      </FilterBar>

      {/* ============ ҮЗҮҮЛЭЛТИЙН ЗУРВАС ============ */}
      <Card className="shrink-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <Stat icon={FileCheck2} label="Ерөнхий үнэлгээ" value={num(stats.n)} sub={`${year} он · ${stats.span}`} />
          <Stat icon={Ruler} label="Нийт талбай, га" value={stats.ha.toFixed(1)} />
          <Stat icon={Users} label="Хүсэлт гаргагч" value={num(stats.applicants)} />
          <Stat icon={CalendarRange} label="Сарын дундаж" value={stats.perMonth.toFixed(1)} sub="үнэлгээ / сар" />
          <Stat
            icon={CalendarDays}
            label="Хамгийн олон үнэлгээтэй сар"
            value={stats.peak ? stats.peak.label : "—"}
            sub={stats.peak ? `${num(stats.peak.n)} үнэлгээ` : undefined}
          />
        </div>
      </Card>

      {/* ============ ГОЛ СҮЛЖЭЭ: зүүнд диаграмууд, баруунд зураг ============ */}
      <Columns layout="flex" id="assessment-3" right={560} className="min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
          {/* Сарын баганан диаграм — хугацаа нь энэ бүртгэлийн цорын ганц тэнхлэг */}
          <Card className="shrink-0">
            <Head title="Шийдвэрлэсэн үнэлгээ, сараар">
              <span className="num text-[10.5px] text-ink-3">{year} он</span>
            </Head>
            <div className="px-3 pt-2 pb-1">
              <TrendChart
                data={monthData.map((d) => ({ ...d, label: `${Number(d.key.slice(5))}-р сар` }))}
                unit="үнэлгээ"
                selected={period}
                onSelect={setPeriod}
              />
            </div>
          </Card>

          {/* ДҮҮРГЭЭР ЗАДАРГАА — хоёр хэмжээсийн хүснэгт */}
          <Card className="min-h-[160px] flex-1">
            <Head title="Дүүргээр задаргаа">
              <Segments options={ROW_DIMS} value={rowDim} onChange={setRowDim} />
            </Head>
            <Matrix
              rows={matrix.rowKeys}
              cols={matrix.colKeys}
              cell={matrix.cell}
              rowSel={rowSel}
              colSel={district}
              onRow={setRowSel}
              onCol={setDistrict}
              onCell={(r, c) => {
                setRowSel(r);
                setDistrict(c);
              }}
              colorOf={
                rowDim === "right"
                  ? (k) => rightColor.get(k) ?? FALLBACK
                  : rowDim === "size"
                    ? (k) => sizeColor.get(k) ?? FALLBACK
                    : undefined
              }
              unit="үнэлгээний тоо"
            />
          </Card>

          {/* Доод мөр: харьцаа ба тархалт */}
          <div className="grid shrink-0 grid-cols-1 gap-2.5 md:grid-cols-2">
            <Card>
              <Head title="Газрын эрхийн хэлбэр">
                <span className="text-[10.5px] text-ink-3">үнэлгээний тоо</span>
              </Head>
              <div className="p-3">
                <Composition
                  data={rightData}
                  colorOf={(k) => rightColor.get(k) ?? FALLBACK}
                  selected={right}
                  onSelect={setRight}
                  unit="үнэлгээ"
                />
              </div>
            </Card>
            <Card>
              <Head title="Талбайн хэмжээгээр">
                <span className="text-[10.5px] text-ink-3">үнэлгээний тоо</span>
              </Head>
              <div className="px-3 pt-2 pb-1">
                <BarChart
                  data={sizeData}
                  height={78}
                  labels
                  unit="үнэлгээ"
                  selected={size}
                  onSelect={setSize}
                />
              </div>
            </Card>
          </div>
        </div>

        {/* ---- БАРУУН: газрын зураг ---- */}
        <Card className="relative min-h-[320px] overflow-hidden xl:w-(--col-r) xl:shrink-0">
          <div className="relative h-full w-full">
            <PolygonMap
              points={NO_POINTS}
              visible={NO_INDEX}
              shapes={{ data: shapes, selected: picked, glow: true }}
              basemap={basemap}
              onSelect={(oid) => setPicked(picked === oid ? null : oid)}
              onHover={tip.onHover}
              focus={focus}
              cluster={false}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} />

            <MapLegend
              title="Нэгж талбарын ангилал"
              items={legend}
              modes={COLOR_MODES}
              mode={colorMode}
              onMode={(id) => setColorMode(id as ColorMode)}
              selected={colorMode === "right" ? right : size}
              onSelect={colorMode === "right" ? setRight : setSize}
            />

            {hovered ? (
              <MapTip state={tip} width={248}>
                <div className="px-2.5 pt-2 pb-1">
                  <span className="text-[10px] leading-none tracking-[0.08em] text-data uppercase">
                    {ACTIVITY_LABEL.get(hovered.activity)}
                  </span>
                </div>
                <div className="px-2.5 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                  {hovered.applicant}
                </div>
                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  <MapTipRow icon={Ruler} num text={areaText(hovered.m2)} />
                  <MapTipRow icon={FileCheck2} text={`${hovered.right} эрхтэй`} />
                  <MapTipRow icon={Layers3} text={hovered.landuse} />
                  <MapTipRow
                    icon={MapPin}
                    text={`${hovered.district} дүүрэг${hovered.khoroo ? `, ${hovered.khoroo}-р хороо` : ""}`}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <span className="num min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3">
                    {hovered.code ? `Үнэлгээ ${hovered.code}` : hovered.parcel || "—"}
                  </span>
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {selected ? (
              <MapPanel
                state={panel}
                title="Ерөнхий үнэлгээний хуудас"
                onClose={() => setPicked(null)}
                className="top-2.5 right-2.5 max-h-[calc(100%-1.25rem)] w-[292px]"
              >
                <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
                  <div className="text-[12.5px] leading-snug font-medium text-ink">{selected.applicant}</div>
                  <div className="num mt-1 text-[11px] text-ink-3">
                    {selected.request ? `Хүсэлт ${selected.request}` : "—"}
                  </div>
                  <dl className="mt-2.5 space-y-1.5">
                    <Field k="Үнэлгээний дугаар" v={<span className="num">{selected.code || "—"}</span>} />
                    <Field k="Шийдвэрлэсэн огноо" v={<span className="num">{selected.decidedRaw || "—"}</span>} />
                    <Field k="Үйл ажиллагааны чиглэл" v={ACTIVITY_LABEL.get(selected.activity) ?? "—"} />
                    {selected.activityRaw ? (
                      <Field k="Бүртгэсэн чиглэл" v={<span className="text-ink-2">{selected.activityRaw}</span>} />
                    ) : null}
                    <Field k="Газрын зориулалт" v={selected.landuse} />
                    <Field k="Эрхийн хэлбэр" v={selected.right} />
                    <Field
                      k="Байршил"
                      v={`${selected.district} дүүрэг${selected.khoroo ? `, ${selected.khoroo}-р хороо` : ""}`}
                    />
                    {selected.address ? <Field k="Хаяг" v={selected.address} /> : null}
                    <Field k="Нэгж талбарын дугаар" v={<span className="num">{selected.parcel || "—"}</span>} />
                    <Field k="Талбайн хэмжээ" v={<span className="num">{areaText(selected.m2)}</span>} />
                  </dl>
                </div>
              </MapPanel>
            ) : null}
          </div>
        </Card>
      </Columns>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS Enterprise · {num(data.rows.length)} нэгж талбар · {year} он
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Талбай: 1 га-аас доош м²-ээр, дээш га-гаар — 56 м²-ээс 130 га хүртэл */
function areaText(m2: number): string {
  return m2 >= 10000 ? `${(m2 / 10000).toFixed(1)} га` : `${num(Math.round(m2))} м²`;
}
