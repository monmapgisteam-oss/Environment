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
  ShieldCheck,
  Spline,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FOREST, FOREST_FIREFLY } from "@/components/wells/colors";
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
  LAYER_LABEL,
  PROTECTED_LAYERS,
  fetchAllProtected,
  type ProtectedData,
  type ProtectedRow,
} from "@/lib/protected-areas";
import { cn, num } from "@/lib/utils";

const GeoMap = dynamic(() => import("@/components/wells/map").then((m) => m.WellsMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-paper-3">
      <Loader2 size={16} className="animate-spin text-ink-3" />
    </div>
  ),
});

/**
 * Харуулах нэр.
 *
 * Эх сурвалжийн `Name` нь ихэвчлэн утгагүй: "Placemark", "Untitled
 * Polygon", эсвэл зүгээр дугаар ("1", "2") — Google Earth дээр зурахад
 * үүссэн тэмдэглэгээ. Тэднийг нэр мэт харуулбал бүртгэл дүүрэн
 * "Placemark" болно, тиймээс дугаараар нь ялгана.
 */
function label(r: ProtectedRow) {
  return r.name && !/^(placemark|untitled.*|\d+)$/i.test(r.name) ? r.name : `#${r.oid}`;
}

/** Бичлэгийн хэмжээг ӨӨРИЙНХ нь нэгжээр */
function sizeText(r: ProtectedRow) {
  const unit = PROTECTED_LAYERS.find((l) => l.id === r.layer)?.unit;
  if (!unit) return "";
  return `${r.size >= 100 ? num(Math.round(r.size)) : r.size.toFixed(2)} ${unit}`;
}

/* --------------------------------------------------------------------------
   Тусгай хамгаалалттай газар

   ДӨРВӨН давхарга, НЭГ зураг. Хоёр өөр үйлчилгээнээс ирдэг ч хоёулаа
   Google Earth-ээс хөрвүүлсэн, ижил бүтэцтэй бөгөөд НЭГ нутаг дэвсгэрийг
   тодорхойлдог:

     Албан бүртгэл   56 НЭРЛЭСЭН талбай, 72,983 га
     Зураглал·талбай 17 хаалттай олон өнцөгт, 50,826 га
     Зураглал·шугам 204 зурвас, 529 км — ХААГДААГҮЙ хил
     Зураглал·цэг   626 булангийн тэмдэглэгээ

   Давхаргаар сольж харуулбал тэдгээр хоорондоо хэрхэн давхцаж, нөхөж
   байгаа нь харагдахгүй — тиймээс бүгд нэг зурагт. Давхаргын шүүлтүүр
   нь тусгаарлах хэрэгсэл болж үлдэнэ.

   ХЭМЖЭЭГ НИЙЛБЭРЛЭХГҮЙ: га, км, ширхэг гурав өөр нэгж. Диаграм бүр
   БИЧЛЭГИЙН ТООГ хардаг бөгөөд хэмжээ нь зөвхөн индикатор, тайлбар
   дээр өөрийнхөө нэгжээр гарна.
   -------------------------------------------------------------------------- */

export function ProtectedDashboard() {
  const [data, setData] = React.useState<ProtectedData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [layer, setLayer] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  React.useEffect(() => {
    const ac = new AbortController();
    fetchAllProtected(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const rows = data?.rows;

  const keep = React.useCallback(
    (r: ProtectedRow, skip?: "layer" | "district") => {
      if (skip !== "layer" && layer && r.layer !== layer) return false;
      if (skip !== "district" && district && r.district !== district) return false;
      return true;
    },
    [layer, district],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((r) => keep(r)), [rows, keep]);

  /*
    Диаграмууд БИЧЛЭГИЙН ТООГ хардаг. Га ба км-ийг нэг баганад нийлбэрлэх
    боломжгүй тул тоолол нь давхарга хооронд харьцуулж болох цорын ганц
    хэмжигдэхүүн.
  */
  const layerData = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "layer")) continue;
      m.set(r.layer, (m.get(r.layer) ?? 0) + 1);
    }
    /* Дараалал нь ТОГТМОЛ — тоогоор эрэмбэлбэл шүүлт солих бүрд үсэрнэ */
    return PROTECTED_LAYERS.filter((l) => m.has(l.id)).map((l) => ({
      key: l.id,
      label: l.label,
      value: m.get(l.id) ?? 0,
    }));
  }, [rows, keep]);

  const districtData = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "district")) continue;
      m.set(r.district, (m.get(r.district) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  /* Олон өнцөгт ба шугам — нэг эх сурвалжид; цэг нь тусдаа горимоор */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const on = new Set(shown.map((r) => r.uid));
    return {
      type: "FeatureCollection",
      features: data.shapes.features.filter((f) => on.has(Number(f.id))),
    };
  }, [data, shown]);

  const points = React.useMemo<MapPoints>(
    () => data?.points ?? { oid: [], lon: [], lat: [] },
    [data],
  );

  const visible = React.useMemo(() => {
    const on = new Set(shown.map((r) => r.uid));
    const out: number[] = [];
    points.oid.forEach((o, i) => on.has(o) && out.push(i));
    return Uint32Array.from(out);
  }, [shown, points]);

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    let ha = 0;
    let km = 0;
    let marks = 0;
    const districts = new Set<string>();
    for (const r of shown) {
      districts.add(r.district);
      const unit = PROTECTED_LAYERS.find((l) => l.id === r.layer)?.unit;
      if (unit === "га") ha += r.size;
      else if (unit === "км") km += r.size;
      else marks++;
    }
    return { n: shown.length, ha, km, marks, districts: districts.size };
  }, [shown]);

  const anyFilter = Boolean(layer || district);

  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !anyFilter) return null;
    const on = picked != null ? new Set([picked]) : new Set(shown.map((r) => r.uid));
    const b = new Bounds();
    for (const f of data.shapes.features) {
      if (on.has(Number(f.id))) b.addGeometry(f.geometry);
    }
    points.oid.forEach((o, i) => on.has(o) && b.add(points.lon[i], points.lat[i]));
    return b.get(0.004);
  }, [data, shown, picked, anyFilter, points]);

  const selected = React.useMemo(
    () => (picked == null ? null : (rows?.find((r) => r.uid === picked) ?? null)),
    [rows, picked],
  );

  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (rows?.find((r) => r.uid === tip.oid) ?? null)),
    [rows, tip.oid],
  );

  /** Хулганы доорх ЦЭГИЙГ тодруулна — олон өнцөгт өөрөө асдаг */
  const highlight = React.useMemo<[number, number] | null>(() => {
    if (!hovered) return null;
    const i = points.oid.indexOf(hovered.uid);
    return i < 0 ? null : [points.lon[i], points.lat[i]];
  }, [hovered, points]);

  const activeCount = (layer ? 1 : 0) + (district ? 1 : 0);

  function reset() {
    setLayer(null);
    setDistrict(null);
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
            Тусгай хамгаалалттай газар татаж байна…
          </span>
        )}
      </div>
    );
  }

  const ha = (v: number) => (v >= 100 ? num(Math.round(v)) : v.toFixed(2));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar
        title="Тусгай хамгаалалттай газар"
        activeCount={activeCount}
        onReset={reset}
      >
        {/*
          Давхарга нь ШҮҮЛТҮҮР: анхандаа дөрвүүлэн нэг зурагт байна,
          сонговол бусад нь хаагдаж тухайн давхарга тусгаарлагдана.
        */}
        <FilterMenu
          label="Давхарга"
          icon={Layers3}
          value={layer ? (LAYER_LABEL.get(layer) ?? layer) : null}
          active={Boolean(layer)}
          onClear={() => setLayer(null)}
          width={250}
        >
          <PickList items={layerData} selected={layer} onPick={setLayer} format={num} />
        </FilterMenu>

        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={240}
        >
          <PickList
            items={districtData}
            selected={district}
            onPick={setDistrict}
            format={num}
          />
        </FilterMenu>
      </FilterBar>

      {/* ============ ИНДИКАТОР ============ */}
      <Card className="shrink-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 xl:divide-y-0">
          {/*
            Гурван нэгжийг ТУСАД нь. Нэг "нийт" гэсэн нүд гаргавал га, км,
            ширхэг гурав нийлж утгагүй тоо болно.
          */}
          <Stat icon={ShieldCheck} label="Хамгаалалттай талбай, га" value={ha(stats.ha)} />
          <Stat icon={Spline} label="Зурсан хил, км" value={ha(stats.km)} />
          <Stat icon={MapPin} label="Тэмдэглэгээний цэг" value={num(stats.marks)} />
          <Stat icon={Building2} label="Хамрах дүүрэг" value={num(stats.districts)} />
        </div>
      </Card>

      {/* ============ ГОЛ СҮЛЖЭЭ ============ */}
      <Columns id="protected" right={268} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: газрын зураг ---- */}
        <Card className="relative min-h-[300px] overflow-hidden">
          <div className="relative h-full w-full">
            {/*
              Олон өнцөгт, шугам, цэг ГУРВУУЛАА нэг зурагт. Дүүргэлтийн
              давхарга шугамыг зурдаггүй, хүрээний давхарга хоёуланг нь
              зурдаг тул тэдгээр нь нэг эх сурвалжид хамт явж болно;
              цэг нь зургийн өөрийнх нь цэгэн горимоор.
            */}
            <GeoMap
              points={points}
              visible={visible}
              shapes={{ data: shapes, selected: picked, color: FOREST }}
              firefly={FOREST_FIREFLY}
              basemap={basemap}
              onSelect={(oid) => setPicked(picked === oid ? null : oid)}
              onHover={tip.onHover}
              highlight={highlight}
              focus={focus}
              cluster={false}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} />

            {hovered ? (
              <MapTip state={tip} width={252}>
                <div className="px-2.5 pt-2 pb-1">
                  <span className="text-[10px] leading-none tracking-[0.08em] text-data uppercase">
                    {LAYER_LABEL.get(hovered.layer)}
                  </span>
                </div>
                <div className="px-2.5 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                  {label(hovered)}
                </div>
                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  {sizeText(hovered) ? (
                    <MapTipRow icon={Ruler} num text={sizeText(hovered)} />
                  ) : null}
                  <MapTipRow
                    icon={MapPin}
                    text={`${hovered.district}${
                      hovered.khoroo ? `, ${hovered.khoroo}-р хороо` : ""
                    }`}
                  />
                </div>
                <div className="flex items-center justify-end border-t border-line px-2.5 py-1.5">
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {selected ? (
              <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[300px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                <div className="eyebrow mb-1.5">{LAYER_LABEL.get(selected.layer)}</div>
                <div className="text-[12.5px] leading-snug font-medium text-ink">
                  {label(selected)}
                </div>
                <div className="num mt-1.5 text-[11.5px] text-ink-2">
                  {sizeText(selected) ? `${sizeText(selected)} · ` : ""}
                  {selected.district}
                  {selected.khoroo ? ` ${selected.khoroo}-р хороо` : ""}
                </div>
                {/*
                  Бүтэн файлын зам — хамгаалалтын нэр, тогтоолын дугаар,
                  огноо нь эх сурвалж дээр ЗӨВХӨН энд бичигдсэн байдаг.
                  Задлаагүй: тогтоолын бичлэг нэгдмэл бус.
                */}
                {selected.path ? (
                  <div className="mt-1.5 border-t border-line pt-1.5 text-[10px] leading-snug break-words text-ink-3">
                    {selected.path}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        {/* ---- БАРУУН: давхарга, дүүрэг ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Panel
            title="Давхаргаар"
            note="бичлэгийн тоо"
            data={layerData}
            selected={layer}
            onSelect={setLayer}
          />
          <Panel
            title="Дүүргээр"
            note="бичлэгийн тоо"
            data={districtData}
            selected={district}
            onSelect={setDistrict}
            grow
          />
        </div>
      </Columns>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS FeatureServer · {num(data.rows.length)} бичлэг ·
        албан бүртгэл ба Google Earth-ээс хөрвүүлсэн зураглал нэг зурагт · нэр, тогтоолын
        дугаар нь файлын замд бичигдсэн бөгөөд задлаагүй
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
  grow,
}: {
  title: string;
  note?: string;
  data: Datum[];
  selected: string | null;
  onSelect: (k: string | null) => void;
  grow?: boolean;
}) {
  return (
    <Card className={grow ? "min-h-[120px] flex-1" : "shrink-0"}>
      <Head title={title}>
        {note ? <span className="text-[10.5px] text-ink-3">{note}</span> : null}
      </Head>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <RowChart data={data} selected={selected} onSelect={onSelect} format={num} />
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
  label: text,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Ruler;
}) {
  return (
    <div className="px-3 py-2.5">
      <span className="eyebrow block min-h-[28px] leading-[1.25]">{text}</span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}
