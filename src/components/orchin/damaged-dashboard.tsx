"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Building2, Layers3, Loader2, Ruler, Shovel } from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { OverlayControl } from "@/components/map/overlay-control";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapOverlay,
  type MapPoints,
} from "@/components/wells/map";
import {
  fetchDamaged,
  sizeClass,
  SIZE_CLASSES,
  type DamagedData,
} from "@/lib/damaged";
import { cn, num } from "@/lib/utils";

const PointMap = dynamic(
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

/**
 * Эвдэрсэн газрын самбар.
 *
 * Бусад самбараас ялгаатай нь энд ЦЭГ БАЙХГҮЙ — зөвхөн талбайн хүрээ.
 * Учир нь эвдрэл нь байршил биш ХЭМЖЭЭ: 2,742 талбайн 86% нь Багануурт
 * төвлөрсөн бөгөөд тэдгээрийн ялгаа нь зөвхөн талбайн хэмжээнд байна.
 *
 * Тиймээс бүх үзүүлэлт ГА-гаар илэрхийлэгдэнэ. Талбайн тоог хажууд нь
 * бичих боловч эрэмбэлэхэд хэрэглэхгүй.
 */
export function DamagedDashboard() {
  const [data, setData] = React.useState<DamagedData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [place, setPlace] = React.useState<string | null>(null);
  const [size, setSize] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const [overlays, setOverlays] = React.useState<MapOverlay[]>([]);

  React.useEffect(() => {
    let alive = true;
    fetchDamaged()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const sites = data?.sites;

  const keep = React.useCallback(
    (i: number, skip?: "place" | "size") => {
      const s = sites![i];
      if (skip !== "place" && place && s.place !== place) return false;
      if (skip !== "size" && size && String(sizeClass(s.ha)) !== size) return false;
      return true;
    },
    [sites, place, size],
  );

  const shown = React.useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < (sites?.length ?? 0); i++) if (keep(i)) out.push(i);
    return out;
  }, [sites, keep]);

  /* Шүүлтүүр нь газрын зурагт ч үйлчилнэ — таарсан талбай л үлдэнэ */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    if (!place && !size) return data.shapes;
    const on = new Set(shown.map((i) => sites![i].oid));
    return {
      type: "FeatureCollection",
      features: data.shapes.features.filter((f) => on.has(Number(f.id))),
    };
  }, [data, sites, shown, place, size]);

  /* ---------------- Задаргаа ---------------- */
  const byPlace = React.useMemo<{ chart: Datum[]; counts: Datum[] }>(() => {
    const m = new Map<string, { ha: number; n: number }>();
    for (let i = 0; i < (sites?.length ?? 0); i++) {
      if (!keep(i, "place")) continue;
      const s = sites![i];
      const hit = m.get(s.place) ?? { ha: 0, n: 0 };
      hit.ha += s.ha;
      hit.n++;
      m.set(s.place, hit);
    }
    const rows = [...m].sort((a, b) => b[1].ha - a[1].ha);
    return {
      chart: rows.map(([k, v]) => ({ key: k, label: k, value: v.ha })),
      counts: rows.map(([k, v]) => ({ key: k, label: k, value: v.n })),
    };
  }, [sites, keep]);

  /*
    Хэмжээний ангилалд ХОЁР тоо зэрэгцэнэ: талбайн тоо ба нийт га.
    Зөвхөн нэгийг нь харуулбал төөрөгдөнө — 0.1 га-аас бага 1,185
    талбай нь нийт 29 мянган га-гийн 0.2% нь ч хүрэхгүй.
  */
  const bySize = React.useMemo(() => {
    const rows = SIZE_CLASSES.map(() => ({ n: 0, ha: 0 }));
    for (let i = 0; i < (sites?.length ?? 0); i++) {
      if (!keep(i, "size")) continue;
      const s = sites![i];
      const c = rows[sizeClass(s.ha)];
      c.n++;
      c.ha += s.ha;
    }
    return SIZE_CLASSES.map((c, i) => ({
      key: c.id,
      label: c.label,
      value: rows[i].n,
      ha: rows[i].ha,
    }));
  }, [sites, keep]);

  const stats = React.useMemo(() => {
    let ha = 0;
    let biggest = 0;
    const places = new Set<string>();
    for (const i of shown) {
      const s = sites![i];
      ha += s.ha;
      if (s.ha > biggest) biggest = s.ha;
      places.add(s.place);
    }
    return { n: shown.length, ha, biggest, places: places.size };
  }, [sites, shown]);

  /* Сонгосон талбай руу ойртох — олон өнцөгтийн хүрээг тооцно */
  const focus = React.useMemo<Extent | null>(() => {
    if (picked == null || !data) return null;
    const f = data.shapes.features.find((x) => Number(x.id) === picked);
    if (!f) return null;
    let w = 180;
    let s = 90;
    let e = -180;
    let n = -90;
    const walk = (c: unknown): void => {
      if (typeof (c as number[])[0] === "number") {
        const [x, y] = c as [number, number];
        if (x < w) w = x;
        if (x > e) e = x;
        if (y < s) s = y;
        if (y > n) n = y;
        return;
      }
      for (const part of c as unknown[]) walk(part);
    };
    if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
      walk(f.geometry.coordinates);
    }
    if (w > e) return null;
    /* Талбай маш жижиг байж болно — хамгийн багадаа ~100м хүрээ өгнө */
    const pad = Math.max(0.0006, (e - w) * 0.25);
    return [w - pad, s - pad, e + pad, n + pad];
  }, [data, picked]);

  const active = React.useMemo(() => {
    const id = hover ?? picked;
    return id == null ? null : (sites?.find((s) => s.oid === id) ?? null);
  }, [sites, hover, picked]);

  function reset() {
    setPlace(null);
    setSize(null);
    setPicked(null);
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">Эх сурвалж татагдсангүй</p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Эвдэрсэн газрын хүрээ татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount = (place ? 1 : 0) + (size ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar title="Эвдэрсэн газар" activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Сум, дүүрэг"
          icon={Building2}
          value={place}
          active={Boolean(place)}
          onClear={() => setPlace(null)}
          width={230}
        >
          {/* Жагсаалтад ТООГ харуулна — сонголтын хэмжээг хэлнэ */}
          <PickList items={byPlace.counts} selected={place} onPick={setPlace} />
        </FilterMenu>

        <FilterMenu
          label="Хэмжээ"
          icon={Layers3}
          value={size ? SIZE_CLASSES[Number(size)].label : null}
          active={Boolean(size)}
          onClear={() => setSize(null)}
          width={220}
        >
          <PickList items={bySize} selected={size} onPick={setSize} />
        </FilterMenu>
      </FilterBar>

      <div className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[1fr_340px]">
        <div className="flex min-h-0 flex-col gap-2.5">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 xl:divide-y-0">
              <Stat icon={Ruler} label="Нийт талбай, га" value={num(Math.round(stats.ha))} />
              <Stat icon={Shovel} label="Талбайн тоо" value={num(stats.n)} />
              <Stat icon={Building2} label="Сум, дүүрэг" value={num(stats.places)} />
              <Stat
                icon={Layers3}
                label="Хамгийн том, га"
                value={stats.biggest >= 10 ? num(Math.round(stats.biggest)) : stats.biggest.toFixed(2)}
              />
            </div>
          </Card>

          <Card className="relative min-h-[280px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/*
                ЗӨВХӨН олон өнцөгт: эвдэрсэн газрын утга нь байршилд
                биш хэмжээнд байгаа тул төлөөлөх цэг нь мэдээлэл нэмэхгүй,
                харин ч жижиг талбайг байгаагаас том мэт харуулна.
              */}
              <PointMap
                points={NO_POINTS}
                visible={NO_INDEX}
                shapes={{ data: shapes, selected: picked }}
                basemap={basemap}
                onSelect={setPicked}
                onHover={setHover}
                focus={focus}
                overlays={overlays}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />
              <OverlayControl value={overlays} onChange={setOverlays} />

              {active ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[240px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="eyebrow mb-1.5">Эвдэрсэн талбай</div>
                  <div className="num text-[13px] leading-none font-medium text-ink">
                    {active.ha >= 1 ? active.ha.toFixed(1) : active.ha.toFixed(3)} га
                  </div>
                  <div className="mt-1.5 text-[11.5px] leading-snug text-ink-2">
                    {active.place}
                    {active.aimag !== "Улаанбаатар" ? ` · ${active.aimag}` : ""}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS · {num(data.sites.length)} талбай ·
            хүрээг ~10м-ээр ерөнхийлсөн
          </p>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <Card className="shrink-0">
            <Head title="Сум, дүүргээр">
              <span className="text-[10.5px] text-ink-3">га</span>
            </Head>
            <div className="max-h-[210px] overflow-y-auto p-3">
              <RowChart
                data={byPlace.chart}
                selected={place}
                onSelect={setPlace}
                format={(v) => (v >= 10 ? num(Math.round(v)) : v.toFixed(2))}
              />
            </div>
          </Card>

          {/*
            Хэмжээний тархалт — энэ самбарын гол диаграм. Зурвас нь
            ТАЛБАЙН ТОО, ард нь тэдгээрийн эзлэх га. Хоёр тоог зэрэгцүүлж
            байж "олон жижиг" ба "цөөн том" хоёрын ялгаа харагдана.
          */}
          <Card className="min-h-0 flex-1">
            <Head title="Хэмжээгээр">
              <span className="text-[10.5px] text-ink-3">талбайн тоо · га</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="space-y-2.5">
                {bySize.map((d) => {
                  const max = Math.max(...bySize.map((x) => x.value), 1);
                  const on = size == null || size === d.key;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setSize(size === d.key ? null : d.key)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "text-[12px] transition-colors",
                            size === d.key ? "font-medium text-ink" : "text-ink-2",
                            !on && "opacity-40",
                          )}
                        >
                          {d.label}
                        </span>
                        <span className="num shrink-0 text-[11.5px] text-ink-2">
                          {num(d.value)}
                        </span>
                      </div>
                      <div className="mt-[3px] h-[2px] w-full overflow-hidden rounded-[1px] bg-paper-hi">
                        <div
                          className="h-full"
                          style={{
                            width: `${(d.value / max) * 100}%`,
                            background: "var(--data)",
                            opacity: on ? 1 : 0.4,
                          }}
                        />
                      </div>
                      <div className="num mt-1 text-[10px] text-ink-3">
                        {d.ha >= 10 ? num(Math.round(d.ha)) : d.ha.toFixed(2)} га
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="shrink-0">
            <Head title="Хамгийн том 8" />
            <div className="max-h-[180px] divide-y divide-line overflow-y-auto">
              {shown
                .slice(0, 8)
                .map((i) => sites![i])
                .map((s) => (
                  <button
                    key={s.oid}
                    onClick={() => setPicked(picked === s.oid ? null : s.oid)}
                    onMouseEnter={() => setHover(s.oid)}
                    onMouseLeave={() => setHover(null)}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left transition-colors hover:bg-paper-hi",
                      picked === s.oid && "bg-paper-hi",
                    )}
                  >
                    <span className="min-w-0 truncate text-[12px] text-ink-2">{s.place}</span>
                    <span className="num shrink-0 text-[11.5px] text-ink">
                      {num(Math.round(s.ha))} га
                    </span>
                  </button>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col rounded-xs border border-line bg-paper-2", className)}>
      {children}
    </div>
  );
}

function Head({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
      <h2 className="display text-[13.5px] leading-none tracking-[0.06em] uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Shovel;
}) {
  return (
    <div className="px-3 py-2.5">
      <span className="eyebrow block min-h-[28px] leading-[1.25]">{label}</span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <Icon size={13} strokeWidth={1.75} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}
