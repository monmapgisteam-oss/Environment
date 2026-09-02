"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Hash,
  Layers3,
  Loader2,
  MousePointerClick,
  Ruler,
  ShieldCheck,
  Trees,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FOREST } from "@/components/wells/colors";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { Columns } from "@/components/ui/resizable-columns";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import {
  SIZE_CLASSES,
  STATUS,
  STATUS_LABEL,
  fetchForestFund,
  sizeClass,
  type FundData,
  type FundParcel,
} from "@/lib/forest-fund";
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

const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

type Skip = "status" | "size" | "section";

/* --------------------------------------------------------------------------
   Ойн сангийн талбай

   БҮТЭЦ: ойн ангийн ХЭСЭГ нь энэ датаны нуруу. 7,704 талбай нь 219
   хэсэгт, хэсэг бүр дотроо ялгаралд хуваагддаг — ойн аж ахуйн албан
   ёсны дугаарлалт. Тиймээс баруун талын урт жагсаалт нь хэсгийн
   жагсаалт бөгөөд самбарын гол шүүлтүүр нь ч тэр.

   Ойн ТӨРЛИЙН самбар (нөгөө таб) нь юу ургаж байгааг харуулдаг бол
   энэ нь тэр газар ХЭН ХАРИУЦДАГИЙГ харуулна — хоёр өөр асуулт, нэг
   нутаг дэвсгэр.
   -------------------------------------------------------------------------- */

export function ForestFundDashboard() {
  const [data, setData] = React.useState<FundData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<string | null>(null);
  const [size, setSize] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  React.useEffect(() => {
    const ac = new AbortController();
    fetchForestFund(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const parcels = data?.parcels;

  const keep = React.useCallback(
    (p: FundParcel, skip?: Skip) => {
      if (skip !== "status" && status && p.status !== status) return false;
      if (skip !== "size" && size && String(sizeClass(p.ha)) !== size) return false;
      if (skip !== "section" && section && String(p.section) !== section) return false;
      return true;
    },
    [status, size, section],
  );

  const shown = React.useMemo(
    () => (parcels ?? []).filter((p) => keep(p)),
    [parcels, keep],
  );

  const statusData = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const p of parcels ?? []) {
      if (!keep(p, "status")) continue;
      m.set(p.status, (m.get(p.status) ?? 0) + p.ha);
    }
    return STATUS.filter((s) => m.has(s.id)).map((s) => ({
      key: s.id,
      label: s.label,
      value: m.get(s.id) ?? 0,
    }));
  }, [parcels, keep]);

  const sizeData = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const p of parcels ?? []) {
      if (!keep(p, "size")) continue;
      const k = String(sizeClass(p.ha));
      m.set(k, (m.get(k) ?? 0) + p.ha);
    }
    return SIZE_CLASSES.filter((c) => m.has(c.id)).map((c) => ({
      key: c.id,
      label: c.label,
      value: m.get(c.id) ?? 0,
    }));
  }, [parcels, keep]);

  /*
    Хэсгээр — БҮГД, эрэмбэлсэн. Энэ бол самбарын гол жагсаалт тул
    "эхний 20" гэж таслахгүй: хэрэглэгч тодорхой хэсгээ хайж олох
    ёстой. 219 мөр нь картын дотор гүйнэ.
  */
  const sectionData = React.useMemo<Datum[]>(() => {
    const m = new Map<number, number>();
    for (const p of parcels ?? []) {
      if (!keep(p, "section")) continue;
      m.set(p.section, (m.get(p.section) ?? 0) + p.ha);
    }
    return [...m]
      .map(([k, v]) => ({ key: String(k), label: `${k}-р хэсэг`, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [parcels, keep]);

  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const on = new Set(shown.map((p) => p.oid));
    return {
      type: "FeatureCollection",
      features: data.shapes.features.filter((f) => on.has(Number(f.id))),
    };
  }, [data, shown]);

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    let ha = 0;
    let spa = 0;
    const sections = new Set<number>();
    for (const p of shown) {
      ha += p.ha;
      sections.add(p.section);
      if (p.status === "spa") spa += p.ha;
    }
    return { n: shown.length, ha, spa, sections: sections.size };
  }, [shown]);

  /* ---------------- Сонголтын хүрээ ---------------- */
  const anyFilter = Boolean(status || size || section);

  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !anyFilter) return null;
    const on = picked != null ? new Set([picked]) : new Set(shown.map((p) => p.oid));
    const b = new Bounds();
    for (const f of data.shapes.features) {
      if (on.has(Number(f.id))) b.addGeometry(f.geometry);
    }
    return b.get(0.003);
  }, [data, shown, picked, anyFilter]);

  const selected = React.useMemo(
    () => (picked == null ? null : (parcels?.find((p) => p.oid === picked) ?? null)),
    [parcels, picked],
  );

  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (parcels?.find((p) => p.oid === tip.oid) ?? null)),
    [parcels, tip.oid],
  );

  const activeCount = (status ? 1 : 0) + (size ? 1 : 0) + (section ? 1 : 0);

  function reset() {
    setStatus(null);
    setSize(null);
    setSection(null);
    setPicked(null);
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">
              Эх сурвалжийн мэдээллийг татаж чадсангүй
            </p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Ойн сангийн талбай татаж байна…
          </span>
        )}
      </div>
    );
  }

  const ha = (v: number) => (v >= 100 ? num(Math.round(v)) : v.toFixed(1));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar title="Ойн сангийн талбай" activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Ойн ангийн хэсэг"
          icon={Hash}
          value={section ? `${section}-р хэсэг` : null}
          active={Boolean(section)}
          onClear={() => setSection(null)}
          width={230}
        >
          <PickList
            items={sectionData}
            selected={section}
            onPick={setSection}
            searchable
            format={(v) => `${ha(v)} га`}
          />
        </FilterMenu>

        <FilterMenu
          label="Хамгаалалт"
          icon={ShieldCheck}
          value={status ? (STATUS_LABEL.get(status) ?? status) : null}
          active={Boolean(status)}
          onClear={() => setStatus(null)}
          width={240}
        >
          <PickList
            items={statusData}
            selected={status}
            onPick={setStatus}
            format={(v) => `${ha(v)} га`}
          />
        </FilterMenu>

        <FilterMenu
          label="Талбайн хэмжээ"
          icon={Ruler}
          value={size ? (SIZE_CLASSES.find((c) => c.id === size)?.label ?? null) : null}
          active={Boolean(size)}
          onClear={() => setSize(null)}
          width={220}
        >
          <PickList
            items={sizeData}
            selected={size}
            onPick={setSize}
            format={(v) => `${ha(v)} га`}
          />
        </FilterMenu>
      </FilterBar>

      {/* ============ ИНДИКАТОР ============ */}
      <Card className="shrink-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 xl:divide-y-0">
          <Stat icon={Trees} label="Ойн сангийн талбай, га" value={ha(stats.ha)} />
          <Stat icon={Layers3} label="Ойн сангийн нэгж талбай" value={num(stats.n)} />
          <Stat icon={Hash} label="Ойн ангийн хэсэг" value={num(stats.sections)} />
          <Stat
            icon={ShieldCheck}
            label="Дархан цаазат газарт, га"
            value={ha(stats.spa)}
          />
        </div>
      </Card>

      {/* ============ ГОЛ СҮЛЖЭЭ ============ */}
      <Columns id="forest-fund" right={268} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: газрын зураг ---- */}
        <Card className="relative min-h-[300px] overflow-hidden">
          <div className="relative h-full w-full">
            <PolygonMap
              points={NO_POINTS}
              visible={NO_INDEX}
              shapes={{ data: shapes, selected: picked, labelZoom: 13, color: FOREST }}
              basemap={basemap}
              onSelect={(oid) => setPicked(picked === oid ? null : oid)}
              onHover={tip.onHover}
              focus={focus}
              cluster={false}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} />

            {hovered ? (
              <MapTip state={tip} width={230}>
                <div className="num px-2.5 pt-2 pb-1.5 text-[15px] leading-none font-medium text-data">
                  {hovered.section}
                  <span className="ml-1 text-[10.5px] text-ink-3">-р хэсэг</span>
                  {hovered.unit ? (
                    <span className="ml-1.5 text-[11px] text-ink-2">
                      {hovered.unit}-р ялгарал
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  <MapTipRow icon={Ruler} num text={`${ha(hovered.ha)} га`} />
                  {hovered.protectedArea ? (
                    <MapTipRow icon={ShieldCheck} text={hovered.protectedArea} />
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <span className="num min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3">
                    #{hovered.oid}
                  </span>
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {selected ? (
              <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[258px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                <div className="eyebrow mb-1.5">Ойн сангийн нэгж талбай</div>
                <div className="num text-[13px] leading-none font-medium text-ink">
                  {selected.section}-р хэсэг
                  {selected.unit ? ` · ${selected.unit}-р ялгарал` : ""}
                </div>
                <div className="num mt-1.5 text-[11.5px] text-ink-2">
                  {ha(selected.ha)} га
                </div>
                <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                  {selected.protectedArea || "Тусгай хамгаалалт тэмдэглэгээгүй"}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {/* ---- БАРУУН: хамгаалалт, хэмжээ, хэсэг ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Panel
            title="Хамгаалалтаар"
            note="га"
            data={statusData}
            selected={status}
            onSelect={setStatus}
            format={ha}
          />
          <Panel
            title="Талбайн хэмжээгээр"
            note="га"
            data={sizeData}
            selected={size}
            onSelect={setSize}
            format={ha}
          />
          {/* Хэсгийн жагсаалт нь баганын ёроолд — 219 мөр дотроо гүйнэ */}
          <Panel
            title="Ойн ангийн хэсгээр"
            note="га"
            data={sectionData}
            selected={section}
            onSelect={setSection}
            format={ha}
            grow
          />
        </div>
      </Columns>

      {/*
        Гурван хүрээний олон өнцөгтийг хассаныг ИЛ бичнэ: эх сурвалжийн
        бичлэгийн тоо (7,707) манай харуулж буй тооноос (7,704) зөрөх
        учрыг уншигч мэдэх ёстой.
      */}
      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS FeatureServer · {num(data.parcels.length)} нэгж
        талбай · ойн сангийн гадна хүрээний {data.outline.features.length} олон өнцөгтийг
        тооллогоос хассан · хүрээг ~10м-ээр ерөнхийлсөн
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Panel({
  title,
  note,
  data,
  selected,
  onSelect,
  format,
  grow,
}: {
  title: string;
  note?: string;
  data: Datum[];
  selected: string | null;
  onSelect: (k: string | null) => void;
  format?: (v: number) => string;
  grow?: boolean;
}) {
  return (
    <Card className={grow ? "min-h-[120px] flex-1" : "shrink-0"}>
      <Head title={title}>
        {note ? <span className="text-[10.5px] text-ink-3">{note}</span> : null}
      </Head>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <RowChart data={data} selected={selected} onSelect={onSelect} format={format} />
      </div>
    </Card>
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
  icon: typeof Trees;
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
