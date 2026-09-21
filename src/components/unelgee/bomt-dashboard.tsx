"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Layers3,
  Loader2,
  MapPin,
  MousePointerClick,
  Ruler,
  ScrollText,
  Sprout,
  TreePine,
  Users,
  Wrench,
} from "lucide-react";
import type { Datum } from "@/components/charts";
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
import { Bounds } from "@/lib/extent";
import { ACTIVITIES } from "@/lib/assessment";
import {
  ACTIVITY_LABEL,
  PLANTING,
  PLANTING_LABEL,
  areaText,
  fetchBomt,
  type BomtData,
  type BomtRow,
} from "@/lib/bomt";
import { spreadRamp } from "@/lib/tone-ramp";
import { num } from "@/lib/utils";
import { Card, Field, Head, MapLegend, Pending, Stat, type LegendItem } from "./ui";
import { Composition, Segments, Table, type Column, type Key } from "./viz";
import { StackedComparison } from "./subject-charts";

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

const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

type Dim = "planting" | "activity" | "district" | "landuse" | "implementer";

/* Мод тарих байршлын ӨНГӨ — бүртгэлийн ТОГТМОЛ дарааллаар (`PLANTING`) */
const PLANTING_COLOR = new Map<string, string>(
  PLANTING.map((p, i) => [p.id, spreadRamp(PLANTING.length)[i]] as [string, string]),
);
const FALLBACK = "#67d7e4";

/** Хүснэгтийн МӨРИЙН хэмжээс — багана нь үргэлж мод тарих байршил */
const ROW_DIMS = [
  { id: "district", label: "Дүүрэг" },
  { id: "activity", label: "Үйл ажиллагааны чиглэл" },
  { id: "landuse", label: "Газрын зориулалт" },
] as const;
type RowDim = (typeof ROW_DIMS)[number]["id"];

type ImplementerRow = {
  name: string;
  n: number;
  ha: number;
  site: number;
  nbog: number;
};

/* --------------------------------------------------------------------------
   Байгаль орчны менежментийн төлөвлөгөө — 2026 оны нэгтгэл.
   2026-09-18-нд ШИНЭЭР бичигдсэн (хэрэглэгч: "бүтэц, диаграм нэг хэвийн").

   Гол асуулт нь ХААНА МОД ТАРИХ вэ — төсөл бүр төлөвлөгөөгөөрөө мод
   тарих үүрэг хүлээдэг бөгөөд өөрийн талбайдаа хийх үү, НБОГ-т
   шилжүүлэх үү гэдэг нь 165-ын 159-ийг хоёр талд хуваадаг.

   Бүтэц (ерөнхий үнэлгээний толин тусгал — зураг ЗҮҮНД):
     шүүлтүүрийн мөр → үзүүлэлтийн зурвас
     → бүтэн өргөнөөр МОД ТАРИХ БАЙРШЛЫН ЗУРВАС (100%-ийн харьцаа)
     → ЗҮҮН: газрын зураг, байршлаар өнгөлсөн, тайлбартай
     → БАРУУН: мод тарих байршил × (дүүрэг | чиглэл | зориулалт)
       хүснэгт · төсөл хэрэгжүүлэгчийн хүснэгт (тоо, талбай, задаргаа).
   Мөрөн диаграм БАЙХГҮЙ.
   -------------------------------------------------------------------------- */

export function BomtDashboard() {
  const [data, setData] = React.useState<BomtData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [planting, setPlanting] = React.useState<string | null>(null);
  const [activity, setActivity] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [landuse, setLanduse] = React.useState<string | null>(null);
  const [implementer, setImplementer] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [rowDim, setRowDim] = React.useState<RowDim>("district");
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  const tip = useMapTip();
  const panel = useMapPanel("right");

  React.useEffect(() => {
    const ac = new AbortController();
    fetchBomt(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const rows = data?.rows;

  const dimOf = React.useCallback((r: BomtRow, d: Dim): string => r[d], []);
  const labelOf = React.useCallback((d: Dim, k: string): string => {
    if (d === "activity") return ACTIVITY_LABEL.get(k) ?? k;
    if (d === "planting") return PLANTING_LABEL.get(k) ?? k;
    return k;
  }, []);

  const passes = React.useCallback(
    (r: BomtRow, ...skips: Dim[]) => {
      const s = new Set<Dim>(skips);
      if (!s.has("planting") && planting && r.planting !== planting) return false;
      if (!s.has("activity") && activity && r.activity !== activity) return false;
      if (!s.has("district") && district && r.district !== district) return false;
      if (!s.has("landuse") && landuse && r.landuse !== landuse) return false;
      if (!s.has("implementer") && implementer && r.implementer !== implementer) return false;
      return true;
    },
    [planting, activity, district, landuse, implementer],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((r) => passes(r)), [rows, passes]);

  const count = React.useCallback(
    (d: Dim, ...skips: Dim[]) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!passes(r, ...skips)) continue;
        const k = dimOf(r, d);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    },
    [rows, passes, dimOf],
  );

  const plantingData = React.useMemo<Datum[]>(() => {
    const m = count("planting", "planting");
    return PLANTING.filter((p) => m.has(p.id)).map((p) => ({
      key: p.id,
      label: p.label,
      value: m.get(p.id) ?? 0,
    }));
  }, [count]);

  const menu = React.useCallback(
    (d: Dim): Datum[] => {
      const m = count(d, d);
      const out = [...m].map(([k, v]) => ({ key: k, label: labelOf(d, k), value: v }));
      if (d === "activity") {
        const order = new Map<string, number>(ACTIVITIES.map((a, i) => [a.id, i]));
        return out.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
      }
      return out.sort((a, b) => b.value - a.value);
    },
    [count, labelOf],
  );
  const activityMenu = React.useMemo(() => menu("activity"), [menu]);
  const districtMenu = React.useMemo(() => menu("district"), [menu]);
  const landuseMenu = React.useMemo(() => menu("landuse"), [menu]);
  const implementerMenu = React.useMemo(() => menu("implementer"), [menu]);

  /* ---------------- Хүснэгт: мөрийн хэмжээс × мод тарих байршил ---------------- */
  const matrix = React.useMemo(() => {
    const base = (rows ?? []).filter((r) => passes(r, rowDim, "planting"));
    const rowTotal = new Map<string, number>();
    const cells = new Map<string, number>();
    const seenPlanting = new Set<string>();
    for (const r of base) {
      const rk = dimOf(r, rowDim);
      rowTotal.set(rk, (rowTotal.get(rk) ?? 0) + 1);
      seenPlanting.add(r.planting);
      const ck = `${rk}\u001f${r.planting}`;
      cells.set(ck, (cells.get(ck) ?? 0) + 1);
    }
    let rowKeys: Key[];
    if (rowDim === "activity") {
      rowKeys = ACTIVITIES.filter((a) => rowTotal.has(a.id)).map((a) => ({ key: a.id, label: a.label }));
    } else {
      rowKeys = [...rowTotal]
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => ({ key: k, label: k }));
    }
    const colKeys: Key[] = PLANTING.filter((p) => seenPlanting.has(p.id)).map((p) => ({
      key: p.id,
      label: p.label,
    }));
    return { rowKeys, colKeys, cell: (r: string, c: string) => cells.get(`${r}\u001f${c}`) ?? 0 };
  }, [rows, passes, rowDim, dimOf]);

  const rowSel = rowDim === "district" ? district : rowDim === "activity" ? activity : landuse;
  const setRowSel = (k: string | null) => {
    if (rowDim === "district") setDistrict(k);
    else if (rowDim === "activity") setActivity(k);
    else setLanduse(k);
  };

  /* ---------------- Төсөл хэрэгжүүлэгчийн хүснэгт ---------------- */
  const implementers = React.useMemo<ImplementerRow[]>(() => {
    const m = new Map<string, ImplementerRow>();
    for (const r of rows ?? []) {
      if (!passes(r, "implementer")) continue;
      const hit = m.get(r.implementer) ?? { name: r.implementer, n: 0, ha: 0, site: 0, nbog: 0 };
      hit.n += 1;
      hit.ha += r.m2 / 10_000;
      if (r.planting === "site") hit.site += 1;
      if (r.planting === "nbog") hit.nbog += 1;
      m.set(r.implementer, hit);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || b.ha - a.ha);
  }, [rows, passes]);

  const columns = React.useMemo<Column<ImplementerRow>[]>(
    () => [
      { key: "name", label: "Төсөл хэрэгжүүлэгч", render: (r) => <span className="line-clamp-2">{r.name}</span> },
      { key: "n", label: "Төлөвлөгөө", num: true, render: (r) => num(r.n), meter: (r) => r.n, className: "w-[76px]" },
      { key: "ha", label: "Талбай, га", num: true, render: (r) => r.ha.toFixed(2), meter: (r) => r.ha, className: "w-[84px]" },
      { key: "site", label: "Төслийн талбайд", num: true, render: (r) => (r.site ? num(r.site) : "·"), className: "w-[70px]" },
      { key: "nbog", label: "НБОГ", num: true, render: (r) => (r.nbog ? num(r.nbog) : "·"), className: "w-[52px]" },
    ],
    [],
  );

  /** Газрын зурагт үлдэх талбайнууд — өнгө нь мод тарих байршлаас */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const on = new Map(shown.map((r) => [r.oid, r]));
    const features: GeoJSON.Feature[] = [];
    for (const f of data.shapes.features) {
      const r = on.get(Number(f.id));
      if (!r) continue;
      features.push({ ...f, properties: { oid: r.oid, c: PLANTING_COLOR.get(r.planting) ?? FALLBACK } });
    }
    return { type: "FeatureCollection", features };
  }, [data, shown]);

  const legend = React.useMemo<LegendItem[]>(
    () =>
      plantingData.map((d) => ({
        key: d.key,
        label: d.label,
        color: PLANTING_COLOR.get(d.key) ?? FALLBACK,
        count: d.value,
      })),
    [plantingData],
  );

  const stats = React.useMemo(() => {
    const m2 = shown.reduce((s, r) => s + r.m2, 0);
    const site = shown.filter((r) => r.planting === "site").length;
    const nbog = shown.filter((r) => r.planting === "nbog").length;
    return {
      n: shown.length,
      implementers: new Set(shown.map((r) => r.implementer)).size,
      ha: m2 / 10_000,
      site,
      nbog,
    };
  }, [shown]);

  const anyFilter = Boolean(planting || activity || district || landuse || implementer);
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !anyFilter) return null;
    const on = picked != null ? new Set([picked]) : new Set(shown.map((r) => r.oid));
    const b = new Bounds();
    for (const f of data.shapes.features) if (on.has(Number(f.id))) b.addGeometry(f.geometry);
    return b.get(0.0022);
  }, [data, shown, picked, anyFilter]);

  const selected = React.useMemo(
    () => (picked == null ? null : (rows?.find((r) => r.oid === picked) ?? null)),
    [rows, picked],
  );
  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (rows?.find((r) => r.oid === tip.oid) ?? null)),
    [rows, tip.oid],
  );

  function reset() {
    setPlanting(null);
    setActivity(null);
    setDistrict(null);
    setLanduse(null);
    setImplementer(null);
    setPicked(null);
  }

  if (error || !data) {
    return <Pending error={error} text="Менежментийн төлөвлөгөөний нэгтгэл татаж байна…" />;
  }

  const activeCount =
    (planting ? 1 : 0) + (activity ? 1 : 0) + (district ? 1 : 0) + (landuse ? 1 : 0) + (implementer ? 1 : 0);
  const pct = (v: number) => (stats.n ? `${((v / stats.n) * 100).toFixed(0)}%` : "—");

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-2.5"
      style={{ "--tone": "var(--d-unelgee)" } as React.CSSProperties}
    >
      <FilterBar title="БАЙГАЛЬ ОРЧНЫ МЕНЕЖМЕНТИЙН ТӨЛӨВЛӨГӨӨ" activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Мод тарих байршил"
          icon={TreePine}
          value={planting ? (PLANTING_LABEL.get(planting) ?? planting) : null}
          active={Boolean(planting)}
          onClear={() => setPlanting(null)}
          width={236}
        >
          <PickList items={plantingData} selected={planting} onPick={setPlanting} />
        </FilterMenu>
        <FilterMenu
          label="Үйл ажиллагааны чиглэл"
          icon={Wrench}
          value={activity ? (ACTIVITY_LABEL.get(activity) ?? activity) : null}
          active={Boolean(activity)}
          onClear={() => setActivity(null)}
          width={246}
        >
          <PickList items={activityMenu} selected={activity} onPick={setActivity} />
        </FilterMenu>
        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={230}
        >
          <PickList items={districtMenu} selected={district} onPick={setDistrict} />
        </FilterMenu>
        <FilterMenu
          label="Газрын зориулалт"
          icon={Layers3}
          value={landuse}
          active={Boolean(landuse)}
          onClear={() => setLanduse(null)}
          width={300}
        >
          <PickList items={landuseMenu} selected={landuse} onPick={setLanduse} />
        </FilterMenu>
        <FilterMenu
          label="Төсөл хэрэгжүүлэгч"
          icon={Users}
          value={implementer}
          active={Boolean(implementer)}
          onClear={() => setImplementer(null)}
          width={300}
        >
          <PickList items={implementerMenu} selected={implementer} onPick={setImplementer} searchable />
        </FilterMenu>
      </FilterBar>

      {/* ============ ҮЗҮҮЛЭЛТИЙН ЗУРВАС ============ */}
      <Card className="shrink-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <Stat icon={ScrollText} label="Менежментийн төлөвлөгөө" value={num(stats.n)} sub="2026 оны нэгтгэл" />
          <Stat icon={Users} label="Төсөл хэрэгжүүлэгч" value={num(stats.implementers)} />
          <Stat icon={Ruler} label="Нийт талбай, га" value={stats.ha.toFixed(1)} />
          <Stat icon={Sprout} label="Төслийн талбайд мод тарих" value={num(stats.site)} sub={`${pct(stats.site)} · ${num(stats.n)}-аас`} />
          <Stat icon={TreePine} label="Мод тарих байршил: НБОГ" value={num(stats.nbog)} sub={`${pct(stats.nbog)} · ${num(stats.n)} төлөвлөгөөнөөс`} />
        </div>
      </Card>

      {/* ============ МОД ТАРИХ БАЙРШИЛ — бүтэн өргөн ============ */}
      <Card className="shrink-0">
        <Head title="Мод тарих байршил">
          <span className="text-[10.5px] text-ink-3">төлөвлөгөөний тоо ба хувь</span>
        </Head>
        <div className="px-3 py-2.5">
          <Composition
            data={plantingData}
            colorOf={(k) => PLANTING_COLOR.get(k) ?? FALLBACK}
            selected={planting}
            onSelect={setPlanting}
            unit="төлөвлөгөө"
          />
        </div>
      </Card>

      {/* ============ ГОЛ СҮЛЖЭЭ: зүүнд зураг, баруунд хүснэгтүүд ============ */}
      <Columns layout="flex" id="bomt-3" left={540} className="min-h-0 flex-1">
        <Card className="relative min-h-[320px] overflow-hidden xl:w-(--col-l) xl:shrink-0">
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
            <MapLegend title="Мод тарих байршил" items={legend} selected={planting} onSelect={setPlanting} />

            {hovered ? (
              <MapTip state={tip} width={248}>
                <div className="px-2.5 pt-2 pb-1">
                  <span className="text-[10px] leading-none tracking-[0.08em] text-data uppercase">
                    Мод тарих: {PLANTING_LABEL.get(hovered.planting)}
                  </span>
                </div>
                <div className="px-2.5 pb-2 text-[12.5px] leading-snug font-medium text-ink">{hovered.implementer}</div>
                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  <MapTipRow icon={Wrench} text={ACTIVITY_LABEL.get(hovered.activity) ?? "—"} />
                  <MapTipRow icon={Ruler} num text={areaText(hovered.m2)} />
                  <MapTipRow
                    icon={MapPin}
                    text={`${hovered.district} дүүрэг${hovered.khoroo ? `, ${hovered.khoroo}-р хороо` : ""}`}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <span className="num min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3">
                    {hovered.parcel ? `Нэгж талбар ${hovered.parcel}` : "—"}
                  </span>
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {selected ? (
              <MapPanel
                state={panel}
                title="Менежментийн төлөвлөгөө"
                onClose={() => setPicked(null)}
                className="top-2.5 left-2.5 max-h-[calc(100%-1.25rem)] w-[292px]"
              >
                <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
                  <div className="text-[12.5px] leading-snug font-medium text-ink">{selected.implementer}</div>
                  <dl className="mt-2.5 space-y-1.5">
                    <Field k="Мод тарих байршил" v={PLANTING_LABEL.get(selected.planting) ?? "—"} />
                    {selected.plantingRaw ? (
                      <Field k="Бүртгэсэн байршил" v={<span className="text-ink-2">{selected.plantingRaw}</span>} />
                    ) : null}
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
          <Card className="min-h-[150px] flex-1">
            <Head title="Мод тарих байршлаар задаргаа">
              <Segments options={ROW_DIMS} value={rowDim} onChange={setRowDim} />
            </Head>
            <StackedComparison
              rows={matrix.rowKeys}
              cols={matrix.colKeys}
              cell={matrix.cell}
              selectedRow={rowSel}
              selectedCol={planting}
              onSelect={(r, c) => {
                setRowSel(r);
                setPlanting(c);
              }}
              colorOf={(key) => PLANTING_COLOR.get(key) ?? FALLBACK}
            />
          </Card>

          <Card className="min-h-[150px] flex-1">
            <Head title="Төсөл хэрэгжүүлэгчээр">
              <span className="num text-[10.5px] text-ink-3">{num(implementers.length)} хэрэгжүүлэгч</span>
            </Head>
            <Table
              rows={implementers}
              columns={columns}
              keyOf={(r) => r.name}
              selected={implementer}
              onSelect={setImplementer}
            />
          </Card>
        </div>
      </Columns>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS Enterprise · {num(data.rows.length)} нэгж талбар · 2026 он
      </p>
    </div>
  );
}
