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
  X,
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

type Skip = "planting" | "activity" | "district" | "landuse" | "implementer";

/* --------------------------------------------------------------------------
   Байгаль орчны менежментийн төлөвлөгөө — 2026 оны нэгтгэл

   Энэ датаны гол асуулт нь "хаана" ч биш, "хэзээ" ч биш — ХААНА МОД
   ТАРИХ вэ. Төсөл бүр төлөвлөгөөгөөрөө мод тарих үүрэг хүлээдэг бөгөөд
   түүнийг өөрийн талбайдаа хийх үү, эсвэл НБОГ-т шилжүүлэх үү гэдэг нь
   165 бичлэгийн 159-ийг хоёр талд хуваадаг. Тэр диаграм нь зүүн баганын
   ёроолд, өөрийнхөө зайг л эзэлж суудаг.

   Хэлтсийн нөгөө самбар (ерөнхий үнэлгээ) нь ХҮСНЭГТ төвтэй, бичлэг
   бүрийг документ мэтээр уншуулдаг. Энэ нь эсрэгээрээ: ганц үүргийн
   биелэлтийг олонлог дээр хардаг.
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
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  React.useEffect(() => {
    const ac = new AbortController();
    fetchBomt(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const rows = data?.rows;

  /**
   * Шүүлтүүр давсан бичлэгүүд. `skip`-д заасан хэмжигдэхүүнийг алгасна —
   * ингэснээр диаграм бүр өөрийнхөө шүүлтээс бусдаар шүүгдэж, сонгосны
   * дараа ч бусад мөрүүд харагдсаар үлдэнэ (cross-filter).
   */
  const keep = React.useCallback(
    (r: BomtRow, skip?: Skip) => {
      if (skip !== "planting" && planting && r.planting !== planting) return false;
      if (skip !== "activity" && activity && r.activity !== activity) return false;
      if (skip !== "district" && district && r.district !== district) return false;
      if (skip !== "landuse" && landuse && r.landuse !== landuse) return false;
      if (skip !== "implementer" && implementer && r.implementer !== implementer) {
        return false;
      }
      return true;
    },
    [planting, activity, district, landuse, implementer],
  );

  const shown = React.useMemo(
    () => (rows ?? []).filter((r) => keep(r)),
    [rows, keep],
  );

  /** Тоолж бүлэглэх туслах */
  const tally = React.useCallback(
    (field: "district" | "landuse" | "implementer", skip: Skip): Datum[] => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!keep(r, skip)) continue;
        m.set(r[field], (m.get(r[field]) ?? 0) + 1);
      }
      return [...m]
        .map(([k, v]) => ({ key: k, label: k, value: v }))
        .sort((a, b) => b.value - a.value);
    },
    [rows, keep],
  );

  /*
    Мод тарих байршлын хуваарилалт. Дараалал нь ТОГТМОЛ (`PLANTING`) —
    тоогоор эрэмбэлбэл шүүлт солих бүрд зурвасын хэсгүүд байраа солино.
  */
  const plantingData = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "planting")) continue;
      m.set(r.planting, (m.get(r.planting) ?? 0) + 1);
    }
    return PLANTING.filter((p) => m.has(p.id)).map((p) => ({
      key: p.id,
      label: p.label,
      value: m.get(p.id) ?? 0,
    }));
  }, [rows, keep]);

  const activityData = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "activity")) continue;
      m.set(r.activity, (m.get(r.activity) ?? 0) + 1);
    }
    return ACTIVITIES.filter((a) => m.has(a.id))
      .map((a) => ({ key: a.id, label: a.label, value: m.get(a.id) ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const districtData = React.useMemo(() => tally("district", "district"), [tally]);
  const landuseData = React.useMemo(() => tally("landuse", "landuse"), [tally]);
  const implementerData = React.useMemo(
    () => tally("implementer", "implementer"),
    [tally],
  );

  /** Газрын зурагт үлдэх талбайнууд */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const on = new Set(shown.map((r) => r.oid));
    return {
      type: "FeatureCollection",
      features: data.shapes.features.filter((f) => on.has(Number(f.id))),
    };
  }, [data, shown]);

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    const m2 = shown.reduce((s, r) => s + r.m2, 0);
    const site = shown.filter((r) => r.planting === "site").length;
    return {
      n: shown.length,
      implementers: new Set(shown.map((r) => r.implementer)).size,
      ha: m2 / 10_000,
      site,
    };
  }, [shown]);

  /* ---------------- Сонголтын хүрээ (zoom action) ---------------- */
  const anyFilter = Boolean(planting || activity || district || landuse || implementer);

  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !anyFilter) return null;
    const on =
      picked != null ? new Set([picked]) : new Set(shown.map((r) => r.oid));
    const b = new Bounds();
    for (const f of data.shapes.features) {
      if (on.has(Number(f.id))) b.addGeometry(f.geometry);
    }
    /* Нэгж талбар жижиг байж болно — хамгийн багадаа ~250м хүрээ өгнө */
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

  const activeCount =
    (planting ? 1 : 0) +
    (activity ? 1 : 0) +
    (district ? 1 : 0) +
    (landuse ? 1 : 0) +
    (implementer ? 1 : 0);

  function reset() {
    setPlanting(null);
    setActivity(null);
    setDistrict(null);
    setLanduse(null);
    setImplementer(null);
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
            Менежментийн төлөвлөгөө татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar
        title="Байгаль орчны менежментийн төлөвлөгөө"
        activeCount={activeCount}
        onReset={reset}
      >
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
          label="Чиглэл"
          icon={Wrench}
          value={activity ? (ACTIVITY_LABEL.get(activity) ?? activity) : null}
          active={Boolean(activity)}
          onClear={() => setActivity(null)}
          width={246}
        >
          <PickList items={activityData} selected={activity} onPick={setActivity} />
        </FilterMenu>

        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={230}
        >
          <PickList items={districtData} selected={district} onPick={setDistrict} />
        </FilterMenu>

        <FilterMenu
          label="Зориулалт"
          icon={Layers3}
          value={landuse}
          active={Boolean(landuse)}
          onClear={() => setLanduse(null)}
          width={300}
        >
          <PickList items={landuseData} selected={landuse} onPick={setLanduse} />
        </FilterMenu>

        <FilterMenu
          label="Хэрэгжүүлэгч"
          icon={Users}
          value={implementer}
          active={Boolean(implementer)}
          onClear={() => setImplementer(null)}
          width={300}
        >
          <PickList
            items={implementerData}
            selected={implementer}
            onPick={setImplementer}
            searchable
          />
        </FilterMenu>
      </FilterBar>

      {/* ============ ИНДИКАТОР ============ */}
      <Card className="shrink-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 xl:divide-y-0">
          <Stat icon={ScrollText} label="Төлөвлөгөө" value={num(stats.n)} />
          <Stat icon={Users} label="Төсөл хэрэгжүүлэгч" value={num(stats.implementers)} />
          <Stat icon={Ruler} label="Нийт талбай, га" value={stats.ha.toFixed(1)} />
          {/*
            "Өөрийн талбайд" гэдгийг НИЙТЭД харьцуулж бичнэ: 66 гэсэн тоо
            дангаараа их үү, бага уу гэдгийг хэлэхгүй.
          */}
          <Stat
            icon={Sprout}
            label="Төслийн талбайд мод тарих"
            value={`${stats.site} / ${stats.n}`}
          />
        </div>
      </Card>

      {/* ============ ГОЛ СҮЛЖЭЭ ============ */}
      <div className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[262px_1fr_282px]">
        {/* ---- ЗҮҮН: юуны төлөө, хаана ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Panel
            title="Чиглэлээр"
            note="бүлэглэсэн ангилал"
            data={activityData}
            selected={activity}
            onSelect={setActivity}
            grow
          />
          <Panel
            title="Дүүргээр"
            data={districtData}
            selected={district}
            onSelect={setDistrict}
            grow
          />
          {/*
            Мод тарих байршил — дөрөвхөн мөртэй тул өөрийнхөө зайг л эзэлж,
            баганын ёроолд суудаг. Дээрх хоёр диаграм үлдсэн зайг хуваана.
          */}
          <Panel
            title="Мод тарих байршил"
            note="төлөвлөгөөний тоо"
            data={plantingData}
            selected={planting}
            onSelect={setPlanting}
          />
        </div>

        {/* ---- ТӨВ: газрын зураг ---- */}
        <Card className="relative min-h-[300px] overflow-hidden">
          <div className="relative h-full w-full">
            {/*
              ЗӨВХӨН олон өнцөгт: нэгж талбарын хэлбэр, хэмжээ нь өөрөө
              мэдээлэл. Талбай 19.7 м²-аас 25 га хүртэл тул төлөөлөх цэг
              нь жижгийг нь байгаагаас хамаагүй том мэт харуулна.
            */}
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

            {hovered ? (
              <MapTip state={tip} width={244}>
                <div className="px-2.5 pt-2 pb-1">
                  <span className="text-[10px] leading-none tracking-[0.08em] text-data uppercase">
                    {PLANTING_LABEL.get(hovered.planting)}
                  </span>
                </div>
                <div className="px-2.5 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                  {hovered.implementer}
                </div>

                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  <MapTipRow
                    icon={Wrench}
                    text={ACTIVITY_LABEL.get(hovered.activity) ?? "—"}
                  />
                  <MapTipRow icon={Ruler} num text={areaText(hovered.m2)} />
                  <MapTipRow
                    icon={MapPin}
                    text={`${hovered.district}${
                      hovered.khoroo ? `, ${hovered.khoroo}-р хороо` : ""
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <span className="num min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3">
                    {hovered.parcel || "—"}
                  </span>
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {/*
              Сонгосон төлөвлөгөө — зүүн дээд буланд бүтэн бичилт.
              Хөвөгч тайлбартай зэрэг харагдаж болно: тэр нь хулганы
              доорхыг, энэ нь тогтоосон сонголтыг хэлнэ.
            */}
            {selected ? (
              <div className="absolute top-2.5 left-2.5 z-10 flex max-h-[calc(100%-1.25rem)] w-[272px] flex-col rounded-xs border border-line bg-paper/95 backdrop-blur-md">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
                  <span className="eyebrow min-w-0 flex-1 truncate">
                    Менежментийн төлөвлөгөө
                  </span>
                  <button
                    onClick={() => setPicked(null)}
                    className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                    aria-label="Хаах"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
                  <div className="text-[12.5px] leading-snug font-medium text-ink">
                    {selected.implementer}
                  </div>

                  <dl className="mt-2.5 space-y-1.5">
                    {/*
                      Мод тарих байршил нь эхний мөрөнд: энэ самбарын гол
                      хэмжигдэхүүн. Бүлэглэсэн ангилал БА эх бичвэр
                      хоёулаа — бүлэглэлт нь бүртгэсэн үгийг нуухгүй.
                    */}
                    <Field
                      k="Мод тарих"
                      v={PLANTING_LABEL.get(selected.planting) ?? "—"}
                    />
                    {selected.plantingRaw ? (
                      <Field
                        k="Бүртгэсэн"
                        v={<span className="text-ink-2">{selected.plantingRaw}</span>}
                      />
                    ) : null}
                    <Field
                      k="Чиглэл"
                      v={ACTIVITY_LABEL.get(selected.activity) ?? "—"}
                    />
                    {selected.activityRaw ? (
                      <Field
                        k="Бүртгэсэн"
                        v={<span className="text-ink-2">{selected.activityRaw}</span>}
                      />
                    ) : null}
                    <Field k="Зориулалт" v={selected.landuse} />
                    <Field k="Эрхийн хэлбэр" v={selected.right} />
                    <Field
                      k="Байршил"
                      v={`${selected.district}${
                        selected.khoroo ? `, ${selected.khoroo}-р хороо` : ""
                      }`}
                    />
                    {selected.address ? (
                      <Field k="Хаяг" v={selected.address} />
                    ) : null}
                    <Field
                      k="Нэгж талбар"
                      v={<span className="num">{selected.parcel || "—"}</span>}
                    />
                    <Field
                      k="Талбай"
                      v={<span className="num">{areaText(selected.m2)}</span>}
                    />
                  </dl>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {/* ---- БАРУУН: хэн, ямар зориулалтаар ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Panel
            title="Хэрэгжүүлэгчээр"
            note="эхний 20"
            data={implementerData.slice(0, 20)}
            selected={implementer}
            onSelect={setImplementer}
            grow
          />
          <Panel
            title="Зориулалтаар"
            note="эх сурвалжийн ангилал"
            data={landuseData}
            selected={landuse}
            onSelect={setLanduse}
            grow
          />
        </div>
      </div>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: нийслэлийн байгаль орчны GIS сервер ·{" "}
        {num(data.rows.length)} нэгж талбар · {data.fetchedAt}-нд хуулсан хувилбар
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
        <RowChart data={data} selected={selected} onSelect={onSelect} />
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
  icon: typeof ScrollText;
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

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[78px] shrink-0 text-[10.5px] tracking-[0.08em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{v}</dd>
    </div>
  );
}
