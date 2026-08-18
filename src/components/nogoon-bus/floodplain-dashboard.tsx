"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Layers3, Loader2, Ruler, Waves } from "lucide-react";
import { PieChart, RowChart, type Datum } from "@/components/charts";
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
import { Bounds } from "@/lib/extent";
import { fetchFloodplains, type FloodplainData } from "@/lib/floodplains";
import { spreadRamp } from "@/lib/tone-ramp";
import { cn, num } from "@/lib/utils";

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

/** Цэгэн давхарга хэрэглэхгүй — энэ самбар зөвхөн татмын хүрээ харуулна */
const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

/**
 * Хэмжээний ангилал.
 *
 * Эх сурвалжаас ирсэн ангилал БИШ, бидний зурсан хуваарь — тиймээс
 * "жижиг / том" гэж нэрлэхгүй, зөвхөн тоон мужаар нь бичнэ. Логарифм
 * алхамтай: татмын хэмжээ 0.0004 га-аас 44,186 га хүртэл найман зэргийн
 * хэмжээгээр сунасан.
 */
const SIZE_CLASSES = [
  { id: "0", label: "1 га-аас бага", max: 1 },
  { id: "1", label: "1 – 100 га", max: 100 },
  { id: "2", label: "100 – 1,000 га", max: 1000 },
  { id: "3", label: "1,000 га-аас их", max: Infinity },
] as const;

function sizeClass(ha: number): number {
  for (let i = 0; i < SIZE_CLASSES.length; i++) if (ha < SIZE_CLASSES[i].max) return i;
  return SIZE_CLASSES.length - 1;
}

/**
 * Голын татмын самбар.
 *
 * Бүтэц нь хэлтсийн бусад хоёр самбараас ӨӨР — энд ГАЗРЫН ЗУРАГ
 * давамгайлна. Шалтгаан: татам бол урт нарийн зурвас хэлбэртэй,
 * голынхоо дагуу сунасан газар. Түүний утга нь бүхэлдээ ХЭЛБЭР, БАЙРШИЛД
 * байгаа тул зургийг жижигрүүлэх нь датаг нуухтай адил. Задаргаа нь
 * зүүн талын нарийн баганад цуглана.
 *
 * Бүх үзүүлэлт ГА-гаар. Хэмжээ эрс хазайсан (нэг татам 44,186 га, 15
 * нь нэг га ч хүрэхгүй) тул "хэдэн татам" гэсэн тоолол төөрөгдүүлнэ.
 */
export function FloodplainDashboard() {
  const [data, setData] = React.useState<FloodplainData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [basin, setBasin] = React.useState<string | null>(null);
  const [size, setSize] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const [overlays, setOverlays] = React.useState<MapOverlay[]>([]);

  React.useEffect(() => {
    let alive = true;
    fetchFloodplains()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const rows = data?.rows;

  const keep = React.useCallback(
    (r: { basin: string; ha: number }, skip?: "basin" | "size") => {
      if (skip !== "basin" && basin && r.basin !== basin) return false;
      if (skip !== "size" && size && String(sizeClass(r.ha)) !== size) return false;
      return true;
    },
    [basin, size],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((r) => keep(r)), [rows, keep]);

  /*
    Сав газар бүрийн өнгө.

    Дөрвөн сав газрыг ялгахад л хангалттай — шатлалыг ЖИГД тарааж
    авна. Түлхүүр нь `data.basins` доторх байрлал (талбайгаар тогтсон,
    ӨӨРЧЛӨГДӨХГҮЙ эрэмбэ) тул шүүлтүүр солиход татам өнгөө солихгүй.
  */
  const basinColor = React.useMemo(() => {
    const ramp = spreadRamp(data?.basins.length ?? 1);
    const m = new Map<string, string>();
    data?.basins.forEach((b, i) => m.set(b, ramp[i]));
    return (b: string) => m.get(b) ?? ramp[0];
  }, [data]);

  /*
    Хүрээ, дээр нь сав газрын нэр (`t`) ба өнгө (`c`). Хоёулаа ЭНД
    тодорхойлогдоно — эх сурвалжийн модуль дүрслэлийн сонголт мэдэх
    ёсгүй.
  */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const on = new Set(shown.map((r) => r.oid));
    const label = new Map(data.rows.map((r) => [r.oid, r.basin]));
    return {
      type: "FeatureCollection",
      features: data.shapes.features
        .filter((f) => on.has(Number(f.id)))
        .map((f) => {
          const name = label.get(Number(f.id)) ?? "";
          return {
            ...f,
            properties: { oid: Number(f.id), t: name, c: basinColor(name) },
          };
        }),
    };
  }, [data, shown, basinColor]);

  /* ---------------- Задаргаа ----------------
     Бүгд ГА-гаар. Талбайн тоог хажууд нь бичих боловч эрэмбэлэхэд
     хэрэглэхгүй. */
  const byBasin = React.useMemo<Datum[]>(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "basin")) continue;
      m.set(r.basin, (m.get(r.basin) ?? 0) + r.ha);
    }
    /* Эрэмбэ нь БҮХ датаны талбайгаар тогтсон — шүүлт солиход мөрүүд
       үсрэхгүй */
    return data.basins
      .filter((b) => m.has(b))
      .map((b) => ({ key: b, label: b, value: m.get(b) ?? 0 }));
  }, [data, rows, keep]);

  const bySize = React.useMemo(() => {
    const acc = SIZE_CLASSES.map(() => ({ n: 0, ha: 0 }));
    for (const r of rows ?? []) {
      if (!keep(r, "size")) continue;
      const c = acc[sizeClass(r.ha)];
      c.n++;
      c.ha += r.ha;
    }
    return SIZE_CLASSES.map((c, i) => ({
      key: c.id,
      label: c.label,
      value: acc[i].ha,
      n: acc[i].n,
    }));
  }, [rows, keep]);

  const stats = React.useMemo(() => {
    const ha = shown.reduce((s, r) => s + r.ha, 0);
    return {
      n: shown.length,
      ha,
      basins: new Set(shown.map((r) => r.basin)).size,
      biggest: shown.reduce((m, r) => Math.max(m, r.ha), 0),
    };
  }, [shown]);

  /* ---------------- Сонголтын хүрээ (zoom action) ---------------- */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !basin && !size) return null;
    const on = picked != null ? new Set([picked]) : new Set(shown.map((r) => r.oid));
    const b = new Bounds();
    for (const f of data.shapes.features) {
      if (on.has(Number(f.id))) b.addGeometry(f.geometry);
    }
    return b.get(0.002);
  }, [data, shown, picked, basin, size]);

  const active = React.useMemo(() => {
    const id = hover ?? picked;
    return id == null ? null : (rows?.find((r) => r.oid === id) ?? null);
  }, [rows, hover, picked]);

  function reset() {
    setBasin(null);
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
            Голын татмын хүрээ татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount = (basin ? 1 : 0) + (size ? 1 : 0);
  const ha1 = (v: number) => (v >= 10 ? num(Math.round(v)) : v.toFixed(2));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar title="Голын татам" activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Сав газар"
          icon={Waves}
          value={basin}
          active={Boolean(basin)}
          onClear={() => setBasin(null)}
          width={280}
        >
          <PickList
            items={byBasin}
            selected={basin}
            onPick={setBasin}
            format={(v) => `${num(Math.round(v))} га`}
          />
        </FilterMenu>

        <FilterMenu
          label="Хэмжээ"
          icon={Layers3}
          value={size ? SIZE_CLASSES[Number(size)].label : null}
          active={Boolean(size)}
          onClear={() => setSize(null)}
          width={220}
        >
          <PickList
            items={bySize}
            selected={size}
            onPick={setSize}
            format={(v) => `${ha1(v)} га`}
          />
        </FilterMenu>
      </FilterBar>

      {/*
        Газрын зураг ДАВАМГАЙЛНА. Задаргаа нь зүүн талын нарийн баганад —
        татам нь голынхоо дагуу сунасан урт зурвас тул зургийн өргөн нь
        шууд уншигдах чадвар болно.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
        <div className="flex min-h-0 flex-col gap-2.5 xl:w-[300px] xl:shrink-0 2xl:w-[330px]">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Stat icon={Ruler} label="Нийт талбай, га" value={num(Math.round(stats.ha))} />
              <Stat icon={Waves} label="Сав газар" value={num(stats.basins)} />
              <Stat icon={Layers3} label="Татмын тоо" value={num(stats.n)} />
              <Stat
                icon={Ruler}
                label="Хамгийн том, га"
                value={num(Math.round(stats.biggest))}
              />
            </div>
          </Card>

          {/*
            Дөрвөн сав газар тул бөгжөөр. Гол баримт нь ХАРЬЦАА: татмын
            74% нь Туулын сав газарт байна.
          */}
          <Card className="shrink-0">
            <Head title="Сав газраар">
              <span className="text-[10.5px] text-ink-3">га</span>
            </Head>
            <div className="p-3">
              {/* Зүсэм бүр газрын зурган дээрх татмынхаа өнгөтэй — бөгж
                  нь ингэснээр легенд болж ажиллана */}
              <PieChart
                data={byBasin}
                size={88}
                colorOf={(d) => basinColor(d.key)}
                selected={basin}
                onSelect={setBasin}
                format={(v) => num(Math.round(v))}
              />
            </div>
          </Card>

          {/* Баганын СҮҮЛД нь уян карт — үлдсэн зайг энэ эзэлнэ */}
          <Card className="min-h-[110px] flex-1">
            <Head title="Хэмжээгээр">
              <span className="text-[10.5px] text-ink-3">га</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/* Зурвас нь ГА, хажуугийн тоо нь мөн га — татмын тоог
                  тусад нь бичнэ, эрэмбэлэхэд хэрэглэхгүй */}
              <RowChart
                data={bySize}
                selected={size}
                onSelect={setSize}
                format={ha1}
              />
              <div className="mt-2 space-y-1 border-t border-line pt-2">
                {bySize.map((d) => (
                  <div key={d.key} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[10.5px] text-ink-3">{d.label}</span>
                    <span className="num shrink-0 text-[10.5px] text-ink-3">
                      {num(d.n)} татам
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <Card className="relative min-h-[300px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/* Цэг байхгүй: татам бол талбай, төлөөлөх цэг нь урт нарийн
                  зурвасыг дугуй болгож гуйвуулна */}
              <PolygonMap
                points={NO_POINTS}
                visible={NO_INDEX}
                shapes={{ data: shapes, selected: picked, glow: true, labelZoom: 9 }}
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
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[250px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="eyebrow mb-1.5">Голын татам</div>
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: basinColor(active.basin) }}
                    />
                    <span className="text-[12.5px] leading-snug text-ink">
                      {active.basin}
                    </span>
                  </div>
                  <div className="num mt-1 text-[11.5px] text-ink-2">{ha1(active.ha)} га</div>
                  {active.basinKm2 != null ? (
                    <div className="num mt-1 text-[10.5px] text-ink-3">
                      Сав газрын талбай {num(Math.round(active.basinKm2))} км²
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS · {num(data.rows.length)} татам ·
            хүрээг ~5м-ээр ерөнхийлсөн
          </p>
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
  icon: typeof Waves;
}) {
  return (
    <div className="px-3 py-2.5">
      <span className="eyebrow block min-h-[28px] leading-[1.25]">{label}</span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}
