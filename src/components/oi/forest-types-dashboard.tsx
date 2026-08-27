"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Layers3,
  Loader2,
  MousePointerClick,
  Ruler,
  Trees,
  TreePine,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import {
  FOREST_TYPES,
  SIZE_CLASSES,
  TYPE_LABEL,
  fetchForestTypes,
  isWooded,
  sizeClass,
  typeColor,
  type ForestParcel,
  type ForestTypesData,
} from "@/lib/forest-types";
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

type Skip = "type" | "size";

/* --------------------------------------------------------------------------
   Ойн төрлийн зураглал

   ГА нь гол хэмжигдэхүүн, тоолол БИШ: талбай 0-оос 38,950 га хүртэл
   сунасан тул "хэдэн талбай" гэдэг нь эвдэрсэн газрын самбартай ижил
   шалтгаанаар төөрөгдүүлнэ.

   Индикаторт "нийт талбай" гэж 431 мянган га бичихгүй: түүний 77% нь
   ангилагдаагүй, ойн бус талбай. Ойн бүрхэвч, ангилагдаагүйг ТУСАД нь
   бичнэ — эс тэгвээс ойн хэмжээ дөрөв дахин үрсгэгдэнэ.
   -------------------------------------------------------------------------- */

export function ForestTypesDashboard() {
  const [data, setData] = React.useState<ForestTypesData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [type, setType] = React.useState<string | null>(null);
  const [size, setSize] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  React.useEffect(() => {
    const ac = new AbortController();
    fetchForestTypes(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const parcels = data?.parcels;

  const keep = React.useCallback(
    (p: ForestParcel, skip?: Skip) => {
      if (skip !== "type" && type && p.type !== type) return false;
      if (skip !== "size" && size && String(sizeClass(p.ha)) !== size) return false;
      return true;
    },
    [type, size],
  );

  const shown = React.useMemo(
    () => (parcels ?? []).filter((p) => keep(p)),
    [parcels, keep],
  );

  /*
    Төрлөөр — ГА-гаар. Дараалал нь `FOREST_TYPES`-ийнх тул шүүлт солих
    бүрд мөрүүд байраа солихгүй.
  */
  const typeData = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const p of parcels ?? []) {
      if (!keep(p, "type")) continue;
      m.set(p.type, (m.get(p.type) ?? 0) + p.ha);
    }
    return FOREST_TYPES.filter((t) => m.has(t.id)).map((t) => ({
      key: t.id,
      label: t.label,
      value: m.get(t.id) ?? 0,
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

  /** Ойн ангийн хэсгээр — эхний 20, ГА-гаар */
  const sectionData = React.useMemo<Datum[]>(() => {
    const m = new Map<number, number>();
    for (const p of shown) {
      if (p.section == null) continue;
      m.set(p.section, (m.get(p.section) ?? 0) + p.ha);
    }
    return [...m]
      .map(([k, v]) => ({ key: String(k), label: `${k}-р хэсэг`, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [shown]);

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
    let wooded = 0;
    let unclassified = 0;
    let total = 0;
    const types = new Set<string>();
    for (const p of shown) {
      total += p.ha;
      types.add(p.type);
      if (isWooded(p.type)) wooded += p.ha;
      if (p.type === "none") unclassified += p.ha;
    }
    return { n: shown.length, total, wooded, unclassified, types: types.size };
  }, [shown]);

  /* ---------------- Сонголтын хүрээ ---------------- */
  const anyFilter = Boolean(type || size);

  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !anyFilter) return null;
    const on = picked != null ? new Set([picked]) : new Set(shown.map((p) => p.oid));
    const b = new Bounds();
    for (const f of data.shapes.features) {
      if (on.has(Number(f.id))) b.addGeometry(f.geometry);
    }
    return b.get(0.004);
  }, [data, shown, picked, anyFilter]);

  const selected = React.useMemo(
    () => (picked == null ? null : (parcels?.find((p) => p.oid === picked) ?? null)),
    [parcels, picked],
  );

  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (parcels?.find((p) => p.oid === tip.oid) ?? null)),
    [parcels, tip.oid],
  );

  const activeCount = (type ? 1 : 0) + (size ? 1 : 0);

  function reset() {
    setType(null);
    setSize(null);
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
            Ойн төрлийн зураглал татаж байна…
          </span>
        )}
      </div>
    );
  }

  const ha = (v: number) => num(Math.round(v));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar title="Ойн төрлийн зураглал" activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Төрөл"
          icon={TreePine}
          value={type ? (TYPE_LABEL.get(type) ?? type) : null}
          active={Boolean(type)}
          onClear={() => setType(null)}
          width={252}
        >
          <PickList
            items={typeData}
            selected={type}
            onPick={setType}
            format={(v) => `${ha(v)} га`}
          />
        </FilterMenu>

        <FilterMenu
          label="Талбайн хэмжээ"
          icon={Ruler}
          value={size ? (SIZE_CLASSES.find((c) => c.id === size)?.label ?? null) : null}
          active={Boolean(size)}
          onClear={() => setSize(null)}
          width={230}
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
          {/*
            ОЙН БҮРХЭВЧ нь эхний нүдэнд, "нийт талбай" нь БИШ: давхаргын
            нийт 431 мянган га-гийн 77% нь ангилагдаагүй, ойн бус талбай.
            Эхэнд нийт тоог тавибал ойн хэмжээ дөрөв дахин үрсгэгдэнэ.
          */}
          <Stat icon={Trees} label="Ойн бүрхэвч, га" value={ha(stats.wooded)} />
          <Stat
            icon={Layers3}
            label="Ангилагдаагүй талбай, га"
            value={ha(stats.unclassified)}
          />
          <Stat icon={Ruler} label="Хамрах талбай, га" value={ha(stats.total)} />
          <Stat icon={TreePine} label="Ялгасан төрөл" value={num(stats.types)} />
        </div>
      </Card>

      {/* ============ ГОЛ СҮЛЖЭЭ ============ */}
      <div className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[268px_1fr_252px]">
        {/* ---- ЗҮҮН: төрөл ---- */}
        {/*
          Төрөл нь шатлалаараа өнгөтэй — газрын зураг дээрх талбайн
          өнгөтэй ижил. Тиймээс диаграмын мөр нь зурган дээрх хаана
          байгааг өөрөө хэлнэ, тусдаа тайлбар хэрэггүй.
        */}
        <Panel
          title="Төрлөөр"
          note="га"
          data={typeData}
          selected={type}
          onSelect={setType}
          colorOf={(d) => typeColor(d.key)}
          format={ha}
          grow
        />

        {/* ---- ТӨВ: газрын зураг ---- */}
        <Card className="relative min-h-[300px] overflow-hidden">
          <div className="relative h-full w-full">
            {/*
              ЗӨВХӨН олон өнцөгт: талбайн хэлбэр, хэмжээ нь өөрөө
              мэдээлэл. Хүрээг серверт ~10м-ээр ерөнхийлүүлсэн —
              бүтнээрээ 60MB байсныг 1.7MB болгосон.
            */}
            <PolygonMap
              points={NO_POINTS}
              visible={NO_INDEX}
              /* Өнгө нь feature бүрийн `properties.c`-ээс — төрлийн шатлалаар */
              shapes={{ data: shapes, selected: picked, labelZoom: 13 }}
              basemap={basemap}
              onSelect={(oid) => setPicked(picked === oid ? null : oid)}
              onHover={tip.onHover}
              focus={focus}
              cluster={false}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} />

            {hovered ? (
              <MapTip state={tip} width={236}>
                <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
                  {/* Төрлийн өнгө — зурган дээрх талбайтай ижил */}
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-[1px]"
                    style={{ background: typeColor(hovered.type) }}
                  />
                  <span className="text-[10px] leading-none tracking-[0.08em] text-ink-2 uppercase">
                    {TYPE_LABEL.get(hovered.type)}
                  </span>
                </div>
                <div className="num px-2.5 pb-2 text-[15px] leading-none font-medium text-ink">
                  {ha(hovered.ha)} <span className="text-[10.5px] text-ink-3">га</span>
                </div>

                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  <MapTipRow
                    icon={Layers3}
                    num
                    text={
                      hovered.section != null
                        ? `${hovered.section}-р хэсэг${
                            hovered.unit ? `, ${hovered.unit}-р ялгарал` : ""
                          }`
                        : "Хэсгийн дугаар байхгүй"
                    }
                  />
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
              <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[262px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-[1px]"
                    style={{ background: typeColor(selected.type) }}
                  />
                  <span className="eyebrow">{TYPE_LABEL.get(selected.type)}</span>
                </div>
                <div className="num text-[13px] leading-none font-medium text-ink">
                  {ha(selected.ha)} га
                </div>
                <div className="num mt-1.5 text-[11px] text-ink-2">
                  {selected.section != null ? `${selected.section}-р хэсэг` : "—"}
                  {selected.unit ? ` · ${selected.unit}-р ялгарал` : ""}
                </div>
                {/*
                  Эх сурвалжийн латин бичлэг — бүлэглэлт нь бүртгэсэн
                  утгыг нуухгүй.
                */}
                {selected.typeRaw ? (
                  <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                    Бүртгэсэн: {selected.typeRaw}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        {/* ---- БАРУУН: хэмжээ, хэсэг ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Panel
            title="Талбайн хэмжээгээр"
            note="га"
            data={sizeData}
            selected={size}
            onSelect={setSize}
            format={ha}
          />
          <Panel
            title="Ойн ангийн хэсгээр"
            note="эхний 20"
            data={sectionData}
            selected={null}
            onSelect={() => {}}
            format={ha}
            grow
          />
        </div>
      </div>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS FeatureServer · {num(data.parcels.length)} талбай ·
        хүрээг ~10м-ээр ерөнхийлсөн · төрлийн нэрийг эх сурвалж латинаар бүртгэсэн
        {data.dropped
          ? ` · геометр нь эвдэрсэн ${data.dropped} бичлэг зурагт ороогүй`
          : ""}
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
  colorOf,
  grow,
}: {
  title: string;
  note?: string;
  data: Datum[];
  selected: string | null;
  onSelect: (k: string | null) => void;
  format?: (v: number) => string;
  colorOf?: (d: Datum) => string;
  grow?: boolean;
}) {
  return (
    <Card className={grow ? "min-h-[120px] flex-1" : "shrink-0"}>
      <Head title={title}>
        {note ? <span className="text-[10.5px] text-ink-3">{note}</span> : null}
      </Head>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <RowChart
          data={data}
          selected={selected}
          onSelect={onSelect}
          format={format}
          colorOf={colorOf}
        />
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
