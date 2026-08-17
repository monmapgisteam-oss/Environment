"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Building2, Layers3, Loader2, Ruler, Shovel } from "lucide-react";
import { PieChart, RowChart } from "@/components/charts";
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

  /* ---------------- Задаргаа ----------------

     Дүүрэг ба сумыг ТУСАД НЬ. Ялгааг нэрнээс таахгүй — эх сурвалжийн
     `aimag_name` талбар өөрөө хэлж өгнө: Улаанбаатар (7 дүүрэг) ба Төв
     (4 сум). Нэрээр ялгах гэвэл бүтэхгүй байсан: энэ давхаргад дүүргийн
     нэр дагаваргүй бичигдсэн ("Хан Уул", "Багануур").

     Хоёр нь МАСШТАБААР харьцуулшгүй: дүүргүүд 24-22,400 га, сумд нийтдээ
     0.1 га ч хүрэхгүй. Нэг диаграмд эгнүүлбэл сумын зурвас огт
     харагдахгүй бөгөөд хамаагүй том мэт сэтгэгдэл төрүүлнэ. */
  const byPlace = React.useMemo(() => {
    const m = new Map<string, { ha: number; n: number; soum: boolean }>();
    for (let i = 0; i < (sites?.length ?? 0); i++) {
      if (!keep(i, "place")) continue;
      const s = sites![i];
      const hit = m.get(s.place) ?? { ha: 0, n: 0, soum: s.aimag !== "Улаанбаатар" };
      hit.ha += s.ha;
      hit.n++;
      m.set(s.place, hit);
    }
    const rows = [...m].sort((a, b) => b[1].ha - a[1].ha);
    const datum = ([k, v]: (typeof rows)[number]) => ({ key: k, label: k, value: v.ha });
    return {
      districts: rows.filter(([, v]) => !v.soum).map(datum),
      soums: rows.filter(([, v]) => v.soum).map(datum),
      /* Шүүлтүүрийн жагсаалтад бүгд НЭГ дороо — тэнд эрэмбэ нь чухал,
         засаг захиргааны төрөл нь биш */
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

  /* Зурвас тус бүрийн хуваарь — нэгж нь харьцуулшгүй тул тусад нь */
  const maxCount = Math.max(...bySize.map((d) => d.value), 1);
  const maxHa = Math.max(...bySize.map((d) => d.ha), 1);

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
          {/*
            Нэг МӨР: зүүнд индикатор ба байршлын задаргаа, баруунд газрын
            зураг. Индикатор нь дээд талд бүтэн өргөнөөр биш, зүүн
            баганын толгойд 2×2 сүлжээгээр суудаг — доорх задаргаа нь
            яг тэдгээр тооны дэлгэрэнгүй тул нэг баганад цуварна.
            xl-ээс доош унавал мөр нь багана болно.
          */}
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
            <div className="flex min-h-0 flex-col gap-2.5 xl:w-[300px] xl:shrink-0 2xl:w-[340px]">
              <Card className="shrink-0">
                <div className="grid grid-cols-2 divide-x divide-y divide-line">
                  <Stat icon={Ruler} label="Нийт талбай, га" value={num(Math.round(stats.ha))} />
                  <Stat icon={Shovel} label="Талбайн тоо" value={num(stats.n)} />
                  <Stat icon={Building2} label="Сум, дүүрэг" value={num(stats.places)} />
                  <Stat
                    icon={Layers3}
                    label="Хамгийн том, га"
                    value={
                      stats.biggest >= 10
                        ? num(Math.round(stats.biggest))
                        : stats.biggest.toFixed(2)
                    }
                  />
                </div>
              </Card>

              {/*
                Сум цөөхөн (4) тул бөгжөөр. Нийт нь 0.1 га ч хүрэхгүй —
                голын тоог 2 орны нарийвчлалтай бичихгүй бол `num()` нь
                бүхэл болгож "0" гаргана.
              */}
              {byPlace.soums.length > 0 ? (
                <Card className="shrink-0">
                  <Head title="Сумаар">
                    <span className="text-[10.5px] text-ink-3">га</span>
                  </Head>
                  <div className="p-3">
                    <PieChart
                      data={byPlace.soums}
                      size={84}
                      selected={place}
                      onSelect={setPlace}
                      format={(v) => v.toFixed(2)}
                    />
                  </div>
                </Card>
              ) : null}

              {/* Баганын СҮҮЛД нь уян карт — үлдсэн зайг энэ эзэлнэ */}
              <Card className="min-h-0 flex-1">
                <Head title="Дүүргээр">
                  <span className="text-[10.5px] text-ink-3">га</span>
                </Head>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <RowChart
                    data={byPlace.districts}
                    selected={place}
                    onSelect={setPlace}
                    format={(v) => (v >= 10 ? num(Math.round(v)) : v.toFixed(2))}
                  />
                </div>
              </Card>
            </div>

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
        </div>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS · {num(data.sites.length)} талбай ·
            хүрээг ~10м-ээр ерөнхийлсөн
          </p>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          {/*
            Хэмжээний тархалт — энэ самбарын гол диаграм.

            Мөр бүрд ХОЁР зурвас: эзлэх ГА (тод) ба талбайн ТОО (бүдэг).
            Хоёр нь ЭСРЭГ дүр зурагтай бөгөөд тэр нь өөрөө энэ датаны
            гол баримт: 0.1 га-аас бага 1,185 талбай нь тооны зурвасаа
            бүтнээр дүүргэдэг мөртлөө нийт эвдрэлийн 0.2% нь ч хүрэхгүй;
            эсрэгээрээ 56 талбай 21 мянган га эзэлнэ. Ганц зурвас
            (өмнө нь тоо байсан) нь энэ хоёрын аль нэгийг л хэлдэг тул
            төөрөгдүүлж байв.

            Зурвас тус бүр ӨӨРИЙН дээд утгаараа хэмжигдэнэ — га ба
            ширхэг харьцуулшгүй нэгж. Тиймээс тоог нь хажууд нь үргэлж
            бичнэ, зурвас нь зөвхөн эрэмбийг хэлнэ.
          */}
          {/* Таван мөр тогтмол тул уян байх шаардлагагүй — уян бол доор
              нь хоосон зай үлдээнэ */}
          <Card className="shrink-0">
            <Head title="Эвдэрсэн газар талбайн хэмжээгээр" />
            <div className="p-3">
              <div className="space-y-3">
                {bySize.map((d) => {
                  const on = size == null || size === d.key;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setSize(size === d.key ? null : d.key)}
                      className="block w-full text-left"
                    >
                      <div
                        className={cn(
                          "text-[12px] transition-colors",
                          size === d.key ? "font-medium text-ink" : "text-ink-2",
                          !on && "opacity-40",
                        )}
                      >
                        {d.label}
                      </div>
                      {/* ГА нь тэргүүлэх хэмжигдэхүүн — зузаан, тод */}
                      <Measure
                        label="га"
                        value={d.ha >= 10 ? num(Math.round(d.ha)) : d.ha.toFixed(2)}
                        share={d.ha / maxHa}
                        on={on}
                        lead
                      />
                      <Measure
                        label="талбай"
                        value={num(d.value)}
                        share={d.value / maxCount}
                        on={on}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Баганын СҮҮЛД нь уян карт — үлдсэн зайг энэ эзэлнэ */}
          <Card className="min-h-[120px] flex-1">
            <Head title="Эвдрэлд хамгийн их өртсөн 8 газар" />
            <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
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

/**
 * Хэмжээний ангилал доторх НЭГ хэмжигдэхүүний мөр: нэр · тоо · зурвас.
 *
 * `lead` нь тэргүүлэх хэмжигдэхүүн (га) — зузаан, тод. Нөгөө нь (талбайн
 * тоо) нимгэн, бүдэг. Хоёрыг ӨНГӨӨР ялгаагүй: дата дүрслэлийн өнгө ганц
 * бөгөөд хоёр хэмжигдэхүүн нь ангилал биш, шатлал юм.
 */
function Measure({
  label,
  value,
  share,
  on,
  lead = false,
}: {
  label: string;
  value: string;
  share: number;
  on: boolean;
  lead?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", lead ? "mt-1.5" : "mt-1")}>
      <span className="w-[38px] shrink-0 text-[10px] text-ink-3">{label}</span>
      <span
        className={cn(
          "num w-[52px] shrink-0 text-right text-[11px]",
          lead ? "text-ink-2" : "text-ink-3",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 overflow-hidden rounded-[1px] bg-paper-hi",
          lead ? "h-[3px]" : "h-[2px]",
        )}
      >
        <span
          className="block h-full"
          style={{
            /* Тэг биш боловч маш бага утга огт харагдахгүй байвал "энд
               юу ч алга" гэсэн худал дохио болно */
            width: `${Math.max(share * 100, share > 0 ? 0.8 : 0)}%`,
            background: "var(--data)",
            opacity: on ? (lead ? 1 : 0.45) : 0.2,
          }}
        />
      </span>
    </div>
  );
}

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
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}
