"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Leaf, Loader2, MapPinned, MousePointerClick, Ruler, Trees } from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FOREST } from "@/components/wells/colors";
import { MapTip, useMapTip } from "@/components/map/hover-tip";
import { FilterBar } from "@/components/wells/filter-bar";
import { Columns } from "@/components/ui/resizable-columns";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import {
  fetchGoodsDetail,
  fetchGoodsIndex,
  fetchGoodsShapes,
  type GoodsDetail,
  type GoodsEntry,
  type GoodsKind,
} from "@/lib/forest-goods";
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
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const KINDS = [
  { id: "species" as const, label: "Дагалт баялаг", icon: Leaf },
  { id: "zone" as const, label: "Ногоон бүсийн хэсэг", icon: MapPinned },
];

/* --------------------------------------------------------------------------
   Ногоон бүс ба ойн дагалт баялгийн тархалт

   БҮТЭЦ НЬ БУСДААС ӨӨР: энд cross-filter БАЙХГҮЙ, зөвхөн НЭГ сонголт.

   Шалтгаан нь датаны бүтцэд: 32,755 бичлэгт ердөө 6,908 өөр талбай
   байдаг — нэг талбай дээр олон зүйл бүртгэгдсэн тул давтагдана.
   Тиймээс "хоёр зүйлийг зэрэг шүүх" гэдэг нь утгагүй (талбайнууд нь
   давхцана), "нийт талбай" гэсэн нэгтгэл ч утгагүй (хэд дахин
   тоологдоно). Ганц зөв асуулт нь "ЭНЭ зүйл хаана тархсан бэ".

   Тиймээс зүүн талын жагсаалт нь шүүлтүүр биш СОНГОГЧ: сонгосон нэрийн
   олон өнцөгтүүд серверээс тухайн үед татагдаж зурагдана.
   -------------------------------------------------------------------------- */

export function ForestGoodsDashboard() {
  const [index, setIndex] = React.useState<GoodsEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<GoodsKind>("species");
  const [name, setName] = React.useState<string | null>(null);

  /*
    Татсан хүрээг НЭРТЭЙ нь хамт хадгална. Тусад нь `loading` төлөв
    барихгүй: аль нэрийнх нь татагдсаныг мэдэж байвал "ачаалж байна"
    гэдэг нь зурагдалтын үед тооцогддог УЛАМЖЛАЛ болно (effect дотор
    setState дуудахгүй).
  */
  const [loaded, setLoaded] = React.useState<{
    name: string;
    fc: GeoJSON.FeatureCollection;
  } | null>(null);

  const [picked, setPicked] = React.useState<number | null>(null);
  /** Дэлгэрэнгүйг мөн дугаартай нь хамт — хуучин бичлэгийн утга үлдэхгүй */
  const [detail, setDetail] = React.useState<{ oid: number; data: GoodsDetail | null } | null>(
    null,
  );
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  React.useEffect(() => {
    const ac = new AbortController();
    fetchGoodsIndex(ac.signal)
      .then((rows) => {
        setIndex(rows);
        /* Эхний зүйлийг өөрөө сонгоно: сонголтгүй үед зураг хоосон
           байх нь "дата байхгүй" мэт уншигдана */
        const first = rows.find((r) => r.kind === "species");
        if (first) setName(first.name);
      })
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const entry = React.useMemo(
    () => index?.find((e) => e.name === name) ?? null,
    [index, name],
  );

  /* Сонгосон нэрийн хүрээг татна. Сонголт солигдоход өмнөх хүсэлтийг
     таслана — хэрэглэгч жагсаалтаар гүйхэд хэдэн мегабайт дэмий
     татагдахаас сэргийлнэ. */
  React.useEffect(() => {
    if (!entry) return;
    const ac = new AbortController();
    fetchGoodsShapes(entry, ac.signal)
      .then((fc) => setLoaded({ name: entry.name, fc }))
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, [entry]);

  /* Товшсон олон өнцөгтийн дэлгэрэнгүй — `PopupInfo` дотор шигтгэгдсэн
     тул тухай бүрд нь татна */
  React.useEffect(() => {
    if (picked == null) return;
    const ac = new AbortController();
    fetchGoodsDetail(picked, ac.signal)
      .then((data) => setDetail({ oid: picked, data }))
      .catch(() => setDetail({ oid: picked, data: null }));
    return () => ac.abort();
  }, [picked]);

  /* Зөвхөн ОДООГИЙН сонголтынхыг харуулна — өмнөх нэрийн хүрээ
     шинийг нь татаж дуустал дэлгэц дээр үлдэх ёсгүй */
  const shapes = loaded && entry && loaded.name === entry.name ? loaded.fc : EMPTY;
  const loading = Boolean(entry) && shapes === EMPTY;
  const shown = picked != null && detail?.oid === picked ? detail.data : null;

  const list = React.useMemo<Datum[]>(
    () =>
      (index ?? [])
        .filter((e) => e.kind === kind)
        .map((e) => ({ key: e.name, label: e.label, value: e.ha })),
    [index, kind],
  );

  const focus = React.useMemo<Extent | null>(() => {
    if (!shapes.features.length) return null;
    const b = new Bounds();
    for (const f of shapes.features) b.addGeometry(f.geometry);
    return b.get(0.004);
  }, [shapes]);

  if (error || !index) {
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
            Дагалт баялгийн жагсаалт татаж байна…
          </span>
        )}
      </div>
    );
  }

  const ha = (v: number) => num(Math.round(v));
  const species = index.filter((e) => e.kind === "species");
  const zones = index.filter((e) => e.kind === "zone");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar
        title="Ойн дагалт баялгийн тархалт"
        activeCount={0}
        onReset={() => {}}
        leading={
          /*
            Бүртгэлийн ТӨРӨЛ сонгох. Энэ нь шүүлтүүр биш — нэг давхаргад
            хоёр өөр бүртгэл (зүйл ба нэрлэсэн газар) байгааг салгах
            хяналт тул гарчгийн хажууд суудаг.
          */
          <div className="flex shrink-0 items-center gap-1">
            {KINDS.map((k) => {
              const on = kind === k.id;
              return (
                <button
                  key={k.id}
                  onClick={() => {
                    setKind(k.id);
                    const first = index.find((e) => e.kind === k.id);
                    setName(first?.name ?? null);
                    setPicked(null);
                  }}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xs border px-2.5 py-1 text-[12px] transition-colors",
                    on
                      ? "border-data/45 bg-data/10 text-ink"
                      : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                  )}
                >
                  <k.icon size={12} strokeWidth={1.8} />
                  {k.label}
                </button>
              );
            })}
          </div>
        }
      >
        {entry ? (
          <span className="num rounded-xs border border-data/40 bg-data/12 px-1.5 py-[3px] text-[11px] text-data">
            {ha(entry.ha)} га · {num(entry.n)} талбай
          </span>
        ) : null}
      </FilterBar>

      {/* ============ ИНДИКАТОР ============ */}
      <Card className="shrink-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 xl:divide-y-0">
          <Stat icon={Leaf} label="Бүртгэсэн дагалт баялаг" value={num(species.length)} />
          <Stat icon={MapPinned} label="Ногоон бүсийн хэсэг" value={num(zones.length)} />
          {/*
            "Нийт талбай" гэж БҮХ бичлэгийг нийлбэрлэхгүй — нэг талбай
            олон зүйлд давтагддаг тул хэд дахин тоологдоно. Оронд нь
            СОНГОСОН нэрийн талбайг харуулна.
          */}
          <Stat
            icon={Ruler}
            label="Сонгосон нэрийн талбай, га"
            value={entry ? ha(entry.ha) : "—"}
          />
          <Stat
            icon={Trees}
            label="Сонгосон нэрийн олон өнцөгт"
            value={entry ? num(entry.n) : "—"}
          />
        </div>
      </Card>

      {/* ============ ГОЛ СҮЛЖЭЭ ============ */}
      <Columns id="forest-goods" left={282} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: сонгогч ---- */}
        <Card className="min-h-[160px]">
          <Head title={kind === "species" ? "Дагалт баялгаар" : "Хэсгээр"}>
            <span className="text-[10.5px] text-ink-3">га</span>
          </Head>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {/*
              Жагсаалт нь ШҮҮЛТҮҮР биш СОНГОГЧ: нэг мөр үргэлж идэвхтэй
              байна. Тиймээс дахин товшиход цуцлагдахгүй — цуцлавал
              зураг хоосон үлдэж, "дата байхгүй" мэт уншигдана.
            */}
            <RowChart
              data={list}
              selected={name}
              onSelect={(k) => {
                if (!k) return;
                setName(k);
                /* Сонголтыг ЭНД цэвэрлэнэ, effect дотор биш: өмнөх
                   нэрийн олон өнцөгт шинэ хүрээнд байхгүй */
                setPicked(null);
              }}
              format={ha}
            />
          </div>
        </Card>

        {/* ---- БАРУУН: газрын зураг ---- */}
        <Card className="relative min-h-[300px] overflow-hidden">
          <div className="relative h-full w-full">
            {/*
              Сонгосон нэр солигдох бүрд зургийг ДАХИН ҮҮСГЭНЭ (`key`):
              олон өнцөгтийн эх сурвалж бүхэлдээ солигдож байгаа тул
              өмнөх сонголтын `feature-state` үлдэхээс сэргийлнэ.
            */}
            <PolygonMap
              key={name ?? "none"}
              points={NO_POINTS}
              visible={NO_INDEX}
              shapes={{ data: shapes, selected: picked, color: FOREST }}
              basemap={basemap}
              onSelect={(oid) => setPicked(picked === oid ? null : oid)}
              onHover={tip.onHover}
              focus={focus}
              cluster={false}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} />

            {loading ? (
              <div className="pointer-events-none absolute top-2.5 left-2.5 z-20 flex items-center gap-2 rounded-xs border border-line bg-paper/92 px-2.5 py-1.5 backdrop-blur-md">
                <Loader2 size={12} className="animate-spin text-ink-3" />
                <span className="text-[11.5px] text-ink-2">Тархалт татаж байна…</span>
              </div>
            ) : null}

            {tip.oid != null && entry ? (
              <MapTip state={tip} width={244}>
                <div className="px-2.5 pt-2 pb-2">
                  <div className="text-[12.5px] leading-snug font-medium text-ink">
                    {entry.label}
                  </div>
                  {entry.latin ? (
                    <div className="mt-0.5 text-[10.5px] leading-snug text-ink-3 italic">
                      {entry.latin}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <span className="num min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3">
                    #{tip.oid}
                  </span>
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {/*
              Товшсон талбайн ЖИНХЭНЭ талбарууд. Эх сурвалж тэдгээрийг
              HTML хүснэгт болгож `PopupInfo`-д шигтгэсэн тул тухай бүрд
              нь татаж задалдаг — бүх 32 мянгыг татвал 26MB болно.
            */}
            {picked != null ? (
              <div className="absolute top-2.5 right-2.5 z-10 max-h-[calc(100%-1.25rem)] w-[248px] overflow-y-auto rounded-xs border border-line bg-paper/95 px-2.5 py-2 backdrop-blur-md">
                <div className="eyebrow mb-1.5">Талбайн бичилт</div>
                {shown ? (
                  <dl className="space-y-1.5">
                    {Object.entries(shown).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="w-[92px] shrink-0 text-[10px] leading-tight tracking-[0.06em] text-ink-3 uppercase">
                          {k}
                        </dt>
                        <dd className="num min-w-0 flex-1 text-[11.5px] leading-snug text-ink">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="flex items-center gap-2 py-1 text-ink-3">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[11.5px]">Татаж байна…</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </Card>
      </Columns>

      {/*
        Геометрийн давхардлыг ИЛ бичнэ: зарим зүйл ЯГ ижил тархалттай
        тул сонголт солиход зураг өөрчлөгдөхгүй байж болно.
      */}
      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS FeatureServer · {num(species.length)} дагалт баялаг ·{" "}
        {num(zones.length)} ногоон бүсийн хэсэг · нэг талбай дээр олон зүйл бүртгэгдсэн тул
        зарим зүйл ижил тархалттай
      </p>
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
