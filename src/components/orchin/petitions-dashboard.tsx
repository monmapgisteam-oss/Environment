"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CheckCircle2,
  FileText,
  Filter,
  Loader2,
  Ruler,
  Workflow,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
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
  fetchPetitions,
  SCREENINGS,
  type Petition,
  type PetitionData,
} from "@/lib/petitions";
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
 * Өргөдлийн бүртгэлийн самбар.
 *
 * Энэ нь хэмжилтийн биш АЖЛЫН УРСГАЛЫН дата тул бүтэц нь ч өөр:
 * гол асуулт "хаана" биш "аль шатанд" гэдэг. Тиймээс баруун талын
 * эхний диаграм нь шүүлтийн үр дүн, дараа нь дараагийн алхам —
 * газарзүйн задаргаа гуравдугаарт орно.
 *
 * Өргөдөл бүр нэг талбайтай тул жагсаалт нь бүртгэлийн дугаар,
 * аж ахуйн нэгжийн нэрээр уншигдана.
 */
export function PetitionsDashboard() {
  const [data, setData] = React.useState<PetitionData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [screening, setScreening] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  React.useEffect(() => {
    let alive = true;
    fetchPetitions()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const rows = data?.rows;

  const keep = React.useCallback(
    (p: Petition, skip?: "screening" | "stage" | "district") => {
      if (skip !== "screening" && screening && p.screening !== screening) return false;
      if (skip !== "stage" && stage && p.stage !== stage) return false;
      if (skip !== "district" && district && p.district !== district) return false;
      return true;
    },
    [screening, stage, district],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((p) => keep(p)), [rows, keep]);

  /*
    Талбайн хүрээ, дээр нь бүртгэлийн ДУГААР шошго болж бичигдэнэ
    (`properties.t`). Аж ахуйн нэгжийн нэр биш дугаарыг сонгосон нь:
    нэр нь урт, талбай нь жижиг тул хүрээнээсээ давж гарна.
  */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const reg = new Map(data.rows.map((p) => [p.oid, p.reg]));
    const on = new Set(shown.map((p) => p.oid));
    return {
      type: "FeatureCollection",
      features: data.shapes.features
        .filter((f) => on.has(Number(f.id)))
        .map((f) => ({
          ...f,
          properties: { oid: Number(f.id), t: reg.get(Number(f.id)) ?? "" },
        })),
    };
  }, [data, shown]);

  /* ---------------- Задаргаа ---------------- */
  const byScreening = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const p of rows ?? []) {
      if (!keep(p, "screening")) continue;
      m.set(p.screening, (m.get(p.screening) ?? 0) + 1);
    }
    return SCREENINGS.filter((s) => m.has(s.id)).map((s) => ({
      key: s.id,
      label: s.label,
      value: m.get(s.id) ?? 0,
    }));
  }, [rows, keep]);

  const byStage = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const p of rows ?? []) {
      if (!keep(p, "stage")) continue;
      m.set(p.stage, (m.get(p.stage) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const byDistrict = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const p of rows ?? []) {
      if (!keep(p, "district")) continue;
      m.set(p.district, (m.get(p.district) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const stats = React.useMemo(() => {
    const ha = shown.reduce((s, p) => s + p.ha, 0);
    const pass = shown.filter((p) => p.screening === "pass").length;
    return {
      n: shown.length,
      ha,
      pass,
      passPct: shown.length ? (pass / shown.length) * 100 : 0,
      companies: new Set(shown.map((p) => p.company)).size,
    };
  }, [shown]);

  /* ---------------- Сонголтын хүрээ (zoom action) ----------------
     Сонгосон өргөдөл рүү, эс бөгөөс шүүлтүүрт таарсан бүх талбай руу
     ойртоно. Шүүлтүүр цуцлагдвал `null` — зураг анхны байрлалдаа буцна. */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !screening && !stage && !district) return null;
    const b = new Bounds();
    if (picked != null) {
      const f = data.shapes.features.find((x) => Number(x.id) === picked);
      b.addGeometry(f?.geometry);
    } else {
      /* `shapes` нь аль хэдийн шүүгдсэн — дахин шүүх шаардлагагүй */
      for (const f of shapes.features) b.addGeometry(f.geometry);
    }
    return b.get(0.002);
  }, [data, shapes, picked, screening, stage, district]);

  const active = React.useMemo(() => {
    const id = hover ?? picked;
    return id == null ? null : (rows?.find((p) => p.oid === id) ?? null);
  }, [rows, hover, picked]);

  function reset() {
    setScreening(null);
    setStage(null);
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
            Өргөдлийн бүртгэл татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount = (screening ? 1 : 0) + (stage ? 1 : 0) + (district ? 1 : 0);
  const selected = picked == null ? null : (rows?.find((p) => p.oid === picked) ?? null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar title="Өргөдлийн бүртгэл" activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Анхан шатны шүүлт"
          icon={Filter}
          value={screening ? SCREENINGS.find((s) => s.id === screening)?.label : null}
          active={Boolean(screening)}
          onClear={() => setScreening(null)}
          width={250}
        >
          <PickList items={byScreening} selected={screening} onPick={setScreening} />
        </FilterMenu>

        <FilterMenu
          label="Дараагийн алхам"
          icon={Workflow}
          value={stage}
          active={Boolean(stage)}
          onClear={() => setStage(null)}
          width={300}
        >
          <PickList items={byStage} selected={stage} onPick={setStage} />
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
        <Card className="shrink-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 xl:divide-y-0">
            <Stat icon={FileText} label="Өргөдөл" value={num(stats.n)} />
            <Stat icon={Building2} label="Аж ахуйн нэгж" value={num(stats.companies)} />
            <Stat icon={Ruler} label="Нийт талбай, га" value={num(Math.round(stats.ha))} />
            <Stat
              icon={CheckCircle2}
              label="Дараагийн шатанд"
              value={`${stats.passPct.toFixed(0)}%`}
            />
          </div>
        </Card>

        {/*
          Индикаторын доор нэг МӨР, гурван хэсэг: зүүнд өргөдлийн
          жагсаалт (сонголт хийвэл түүний тэмдэглэл), дунд газрын
          зураг, баруунд задаргаа. Жагсаалтын мөр бүр зурган дээрх
          талбайтайгаа hover/товшилтоор хосолдог тул хажууд нь байх нь
          ойлгомжтой. xl-ээс доош унавал мөр нь багана болно.
        */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
          <div className="flex min-h-0 flex-col xl:w-[300px] xl:shrink-0 2xl:w-[340px]">
            {/*
              Сонгосон өргөдлийн шүүлтийн ЭХ БИЧВЭР. Бүлэглэлт нь дата
              дарж бичихгүй — шийдвэрийн үндэслэл бүтнээрээ энд харагдана.
            */}
            {selected ? (
              <Card className="min-h-0 flex-1">
                <Head title="Шүүлтийн тэмдэглэл">
                  <button
                    onClick={() => setPicked(null)}
                    className="text-[11px] text-ink-3 transition-colors hover:text-ink"
                  >
                    хаах
                  </button>
                </Head>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="num text-[12.5px] font-medium text-ink">{selected.reg}</div>
                  <div className="mt-1 text-[11.5px] text-ink-2">{selected.company}</div>
                  {selected.place ? (
                    <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                      {selected.place}
                    </div>
                  ) : null}
                  <div className="eyebrow mt-3 mb-1.5">Анхан шатны шүүлт</div>
                  <p className="text-[11.5px] leading-relaxed text-ink-2">
                    {selected.screeningRaw || "Тэмдэглэл алга"}
                  </p>
                  <div className="eyebrow mt-3 mb-1.5">Дараагийн алхам</div>
                  <p className="text-[11.5px] leading-relaxed text-ink-2">{selected.stage}</p>
                </div>
              </Card>
            ) : (
              <Card className="min-h-[120px] flex-1">
                <Head title="Өргөдлийн жагсаалт">
                  <span className="num text-[11.5px] text-ink-3">{num(shown.length)}</span>
                </Head>
                <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                  {shown.map((p) => (
                    <button
                      key={p.oid}
                      onClick={() => setPicked(p.oid)}
                      onMouseEnter={() => setHover(p.oid)}
                      onMouseLeave={() => setHover(null)}
                      className="block w-full px-3 py-2 text-left transition-colors hover:bg-paper-hi"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[12px] text-ink">
                          {p.company}
                        </span>
                        <span className="num shrink-0 text-[11.5px] text-ink-2">{p.ha} га</span>
                      </div>
                      <div className="num mt-1 flex items-center gap-1.5 text-[10.5px] text-ink-3">
                        <span>{p.reg}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">
                          {p.district} {p.khoroo}
                        </span>
                      </div>
                    </button>
                  ))}
                  {shown.length === 0 ? (
                    <div className="py-5 text-center text-[12px] text-ink-3">
                      Шүүлтүүрт тохирох өргөдөл алга
                    </div>
                  ) : null}
                </div>
              </Card>
            )}
          </div>

          <Card className="relative min-h-[280px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              <PointMap
                points={NO_POINTS}
                visible={NO_INDEX}
                shapes={{ data: shapes, selected: picked, labelZoom: 12 }}
                basemap={basemap}
                onSelect={setPicked}
                onHover={setHover}
                focus={focus}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {active ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[270px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="eyebrow mb-1.5">{active.reg}</div>
                  <div className="text-[12.5px] leading-snug text-ink">{active.company}</div>
                  <div className="num mt-1 text-[11.5px] text-ink-2">
                    {active.ha} га · {active.district} {active.khoroo}
                  </div>
                  <div className="mt-1.5 text-[10.5px] leading-snug text-ink-3">
                    {SCREENINGS.find((s) => s.id === active.screening)?.label}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          {/* ---- БАРУУН: задаргаа ---- */}
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-[360px] xl:shrink-0">
            <Card className="shrink-0">
              <Head title="Анхан шатны шүүлт" />
              <div className="p-3">
                <RowChart
                  data={byScreening}
                  selected={screening}
                  onSelect={setScreening}
                />
              </div>
            </Card>

            {/* Мөрийн СҮҮЛД нь уян карт — дээрх нь тогтмол өндөртэй */}
            <Card className="min-h-0 flex-1">
              <Head title="Дараагийн алхам" />
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart data={byStage} selected={stage} onSelect={setStage} />
              </div>
            </Card>
          </div>
        </div>

        <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
          Суурь зураг: Esri · Дата: ArcGIS · {num(data.rows.length)} өргөдөл ·
          бүгд 2025.05.28-нд бүртгэгдсэн
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
  icon: typeof FileText;
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
