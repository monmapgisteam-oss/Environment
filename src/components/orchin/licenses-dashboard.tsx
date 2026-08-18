"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarClock,
  Loader2,
  Mountain,
  Pickaxe,
  Ruler,
} from "lucide-react";
import { AreaChart, RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import {
  fetchLicenses,
  termOf,
  TERMS,
  type License,
  type LicenseData,
} from "@/lib/licenses";
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

const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

/**
 * Тусгай зөвшөөрлийн самбар.
 *
 * Бусад самбар "хаана, хэр их" гэж асуудаг бол энэ нь ХЭЗЭЭ гэж
 * асууна: зөвшөөрөл бүр дуусах хугацаатай. Тиймээс төв диаграм нь
 * дуусах жилийн ЦУВАА бөгөөд шүүлтүүрийн эхэнд хугацааны төлөв
 * (дууссан / удахгүй дуусах / хүчинтэй) байрлана.
 */
export function LicensesDashboard() {
  const [data, setData] = React.useState<LicenseData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [term, setTerm] = React.useState<string | null>(null);
  const [mineral, setMineral] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  /*
    Одоогийн оныг НЭГ УДАА барина. Зурагдалт бүрд `new Date()` дуудвал
    сервер ба хөтөч дээр өөр утга гарч, гидраци зөрөх эрсдэлтэй.
  */
  const [now] = React.useState(() => new Date().getFullYear());

  React.useEffect(() => {
    let alive = true;
    fetchLicenses()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const rows = data?.rows;

  const keep = React.useCallback(
    (l: License, skip?: "term" | "mineral" | "district") => {
      if (skip !== "term" && term && termOf(l.expires, now) !== term) return false;
      if (skip !== "mineral" && mineral && l.mineral !== mineral) return false;
      if (skip !== "district" && district && l.district !== district) return false;
      return true;
    },
    [term, mineral, district, now],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((l) => keep(l)), [rows, keep]);

  /*
    Талбайн хүрээ, дээр нь зөвшөөрлийн ДУГААР шошго болж бичигдэнэ
    (`properties.t`). Эзэмшигчийн нэр биш дугаарыг сонгосон нь: нэр нь
    урт, талбай нь жижиг тул хүрээнээсээ давж гарна.
  */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const code = new Map(data.rows.map((l) => [l.oid, l.code]));
    const on = new Set(shown.map((l) => l.oid));
    return {
      type: "FeatureCollection",
      features: data.shapes.features
        .filter((f) => on.has(Number(f.id)))
        .map((f) => ({
          ...f,
          properties: { oid: Number(f.id), t: code.get(Number(f.id)) ?? "" },
        })),
    };
  }, [data, shown]);

  /* ---------------- Задаргаа ---------------- */
  const byTerm = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const l of rows ?? []) {
      if (!keep(l, "term")) continue;
      const t = termOf(l.expires, now);
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return TERMS.filter((t) => m.has(t.id)).map((t) => ({
      key: t.id,
      label: t.label,
      value: m.get(t.id) ?? 0,
    }));
  }, [rows, keep, now]);

  const byMineral = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const l of rows ?? []) {
      if (!keep(l, "mineral")) continue;
      m.set(l.mineral, (m.get(l.mineral) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const byDistrict = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const l of rows ?? []) {
      if (!keep(l, "district")) continue;
      m.set(l.district, (m.get(l.district) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  /*
    Дуусах жилийн цуваа. Он БҮРИЙГ гаргана — байхгүй жилийг алгасвал
    "2033-аас 2035" хоёрын хооронд завсар байгаа нь харагдахгүй болно.
  */
  const byExpiry = React.useMemo<Datum[]>(() => {
    const years = shown.map((l) => l.expires).filter((y): y is number => y != null);
    if (!years.length) return [];
    const lo = Math.min(...years);
    const hi = Math.max(...years);
    const c = new Map<number, number>();
    for (const y of years) c.set(y, (c.get(y) ?? 0) + 1);
    const out: Datum[] = [];
    for (let y = lo; y <= hi; y++) {
      out.push({ key: String(y), label: String(y), value: c.get(y) ?? 0 });
    }
    return out;
  }, [shown]);

  const stats = React.useMemo(() => {
    const ha = shown.reduce((s, l) => s + l.ha, 0);
    const soon = shown.filter((l) => termOf(l.expires, now) === "soon").length;
    return {
      n: shown.length,
      ha,
      holders: new Set(shown.map((l) => l.holder)).size,
      soon,
    };
  }, [shown, now]);

  /* ---------------- Сонголтын хүрээ (zoom action) ----------------
     Сонгосон зөвшөөрөл рүү, эс бөгөөс шүүлтүүрт таарсан бүх талбай руу
     ойртоно. Шүүлтүүр цуцлагдвал `null` — зураг анхны байрлалдаа буцна. */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !term && !mineral && !district) return null;
    const on = picked != null ? new Set([picked]) : new Set(shown.map((l) => l.oid));
    const b = new Bounds();
    for (const f of data.shapes.features) {
      if (on.has(Number(f.id))) b.addGeometry(f.geometry);
    }
    return b.get(0.002);
  }, [data, shown, picked, term, mineral, district]);

  const active = React.useMemo(() => {
    const id = hover ?? picked;
    return id == null ? null : (rows?.find((l) => l.oid === id) ?? null);
  }, [rows, hover, picked]);

  function reset() {
    setTerm(null);
    setMineral(null);
    setDistrict(null);
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
            Тусгай зөвшөөрлийн жагсаалт татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount = (term ? 1 : 0) + (mineral ? 1 : 0) + (district ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Ашигт малтмалын тусгай зөвшөөрөл"
        activeCount={activeCount}
        onReset={reset}
      >
        <FilterMenu
          label="Хугацаа"
          icon={CalendarClock}
          value={term ? TERMS.find((t) => t.id === term)?.label : null}
          active={Boolean(term)}
          onClear={() => setTerm(null)}
          width={220}
        >
          <PickList items={byTerm} selected={term} onPick={setTerm} />
        </FilterMenu>

        <FilterMenu
          label="Ашигт малтмал"
          icon={Mountain}
          value={mineral}
          active={Boolean(mineral)}
          onClear={() => setMineral(null)}
          width={230}
        >
          <PickList items={byMineral} selected={mineral} onPick={setMineral} />
        </FilterMenu>

        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={220}
        >
          <PickList items={byDistrict} selected={district} onPick={setDistrict} />
        </FilterMenu>
      </FilterBar>

      {/*
        Индикаторын зурвас ба мөрийн тайлбар нь ДЭЛГЭЦИЙН БҮТЭН ӨРГӨНД,
        доторх бүх карт нэг мөрөнд эгнэнэ. Хоёр баганын сүлжээ байхаа
        больсон: диаграмууд индикаторын зэрэгцээ бус, газрын зурагтайгаа
        нэг өндөрт эхлэх ёстой.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        {/*
          Нэг МӨР, гурван хэсэг: зүүнд зөвшөөрлийн жагсаалт, дунд газрын
          зураг (уян), баруунд индикатор ба задаргаа. Жагсаалтын мөр бүр
          зурган дээрх талбайтайгаа hover/товшилтоор хосолдог тул хажууд
          нь байх нь ойлгомжтой. xl-ээс доош унавал мөр нь багана болно.
        */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
          <Card className="min-h-[120px] flex-1 xl:w-[300px] xl:flex-none 2xl:w-[340px]">
            {/* Хугацаагаар нь эрэмбэлсэн — эхэнд нь хамгийн түрүүнд дуусах нь */}
            <Head title="Зөвшөөрлийн жагсаалт">
              <span className="num text-[11.5px] text-ink-3">{num(shown.length)}</span>
            </Head>
            <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              {shown.map((l) => (
                <button
                  key={l.oid}
                  onClick={() => setPicked(picked === l.oid ? null : l.oid)}
                  onMouseEnter={() => setHover(l.oid)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "block w-full px-3 py-2 text-left transition-colors hover:bg-paper-hi",
                    picked === l.oid && "bg-paper-hi",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] text-ink">{l.holder}</span>
                    <span className="num shrink-0 text-[11.5px] text-ink-2">
                      {l.expires ?? "—"}
                    </span>
                  </div>
                  <div className="num mt-1 flex items-center gap-1.5 text-[10.5px] text-ink-3">
                    <span>{l.code}</span>
                    <span aria-hidden>·</span>
                    <span>{l.ha} га</span>
                    <span aria-hidden>·</span>
                    <span className="truncate">{l.mineral}</span>
                  </div>
                </button>
              ))}
              {shown.length === 0 ? (
                <div className="py-5 text-center text-[12px] text-ink-3">
                  Шүүлтүүрт тохирох зөвшөөрөл алга
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="relative min-h-[280px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              <PointMap
                points={NO_POINTS}
                visible={NO_INDEX}
                shapes={{ data: shapes, selected: picked, labelZoom: 11 }}
                basemap={basemap}
                onSelect={setPicked}
                onHover={setHover}
                focus={focus}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {active ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[270px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="eyebrow mb-1.5">{active.code}</div>
                  <div className="text-[12.5px] leading-snug text-ink">{active.holder}</div>
                  <div className="num mt-1 text-[11.5px] text-ink-2">
                    {active.ha} га · {active.mineral}
                  </div>
                  <div className="num mt-1 text-[10.5px] text-ink-3">
                    {active.granted ?? "—"} → {active.expires ?? "—"} ·{" "}
                    {active.district} {active.khoroo}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          {/* ---- БАРУУН: индикатор + задаргаа ---- */}
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-[360px] xl:shrink-0">
            {/* Дөрвөн индикатор — хоёр багана, хоёр мөр */}
            <Card className="shrink-0">
              <div className="grid grid-cols-2 divide-x divide-y divide-line">
                <Stat icon={Pickaxe} label="Зөвшөөрөл" value={num(stats.n)} />
                <Stat icon={Building2} label="Эзэмшигч" value={num(stats.holders)} />
                <Stat
                  icon={Ruler}
                  label="Нийт талбай, га"
                  value={num(Math.round(stats.ha))}
                />
                {/* Удахгүй дуусах нь энэ бүртгэлийн үйлдэл шаардах цорын ганц тоо */}
                <Stat
                  icon={CalendarClock}
                  label={`${now}–${now + 5} онд дуусах`}
                  value={num(stats.soon)}
                />
              </div>
            </Card>

            {/* Энэ самбарын гол диаграм — хэзээ дуусах вэ */}
            <Card className="shrink-0">
              <Head title="Дуусах жилээр" />
              <div className="p-3">
                {/* Шошгыг таслахгүй: налуу байрлал нь бүтэн онд зай гаргана */}
                <AreaChart data={byExpiry} height={100} unit="зөвшөөрөл" />
              </div>
            </Card>

            {/* Мөрийн СҮҮЛД нь уян карт — дээрх нь тогтмол өндөртэй */}
            <Card className="min-h-0 flex-1">
              <Head title="Ашигт малтмалаар" />
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart data={byMineral} selected={mineral} onSelect={setMineral} />
              </div>
            </Card>
          </div>
        </div>

        <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
          Суурь зураг: Esri · Дата: ArcGIS · {num(data.rows.length)} зөвшөөрөл ·
          хугацааг {now} оноор тооцов
        </p>
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
  icon: typeof Pickaxe;
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
