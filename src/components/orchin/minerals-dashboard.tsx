"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarClock,
  CalendarRange,
  Loader2,
  Mountain,
  MousePointerClick,
  Pickaxe,
  Ruler,
} from "lucide-react";
import { RowChart, YearRange, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
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
import { rampColor } from "@/lib/tone-ramp";
import {
  fetchMinerals,
  isExpired,
  type MineralData,
  type MineralSite,
} from "@/lib/minerals";
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

/** Цэгэн давхарга хэрэглэхгүй — энэ самбар зөвхөн талбайн хүрээ харуулна */
const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

/**
 * Ашигт малтмалын тусгай зөвшөөрөлтэй талбайн самбар.
 *
 * Бүртгэл нь ердөө 6 мөр тул статистикийн самбар болгох нь утгагүй —
 * 6 зүйлийн "тархалт" гэж байхгүй. Тиймээс бүтэц нь бусдаас өөр:
 * дэлгэцийн голыг ГАЗРЫН ЗУРАГ эзэлж, доод талд нь бүх зөвшөөрлийн
 * ХУГАЦААНЫ ХУВААРЬ (Gantt) бүтэн өргөнөөр сунана.
 *
 * Хугацааг ингэж зэрэгцүүлэх нь энэ датаны гол баримтыг харуулна:
 * Налайхын нүүрсний зөвшөөрөл 1996-аас 2046 — тавин жил — үргэлжлэх
 * бол Багануурын алтных ердөө гурван жил. Багана диаграм дээр энэ нь
 * огт харагдахгүй.
 */
export function MineralsDashboard() {
  const [data, setData] = React.useState<MineralData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [mineral, setMineral] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  /*
    Хугацааны МУЖ. Зөвшөөрөл бүр олгосон→дуусах гэсэн ХУГАЦААТАЙ тул
    "аль онд дуусах вэ" гэхээс "энэ хооронд ХҮЧИНТЭЙ байсан уу" гэдэг нь
    зөв асуулт: муж нь зөвшөөрлийн хугацаатай ОГТЛОЛЦОЖ байвал үлдэнэ.
  */
  const [range, setRange] = React.useState<[number, number] | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);
  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const [overlays, setOverlays] = React.useState<MapOverlay[]>([]);

  /* Одоогийн оныг НЭГ УДАА барина — зурагдалт бүрд шинэчилбэл сервер ба
     хөтчийн зураг зөрнө */
  const [now] = React.useState(() => new Date().getFullYear());

  React.useEffect(() => {
    let alive = true;
    fetchMinerals()
      .then((d) => {
        if (!alive) return;
        setData(d);
        const ys = d.sites
          .flatMap((x) => [x.granted, x.expires])
          .filter((y): y is number => y != null);
        if (ys.length) setRange([Math.min(...ys), Math.max(...ys)]);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const sites = data?.sites;

  const keep = React.useCallback(
    (s: MineralSite, skip?: "mineral" | "district" | "period") => {
      /* Огтлолцол: зөвшөөрлийн хугацаа сонгосон мужтай давхцаж байна уу.
         Аль нэг үзүүр нь бөглөгдөөгүй бол хязгааргүй гэж үзнэ — эс
         тэгвээс он дутуу бичлэг бүр шүүлтээс унана. */
      if (skip !== "period" && range) {
        const from = s.granted ?? -Infinity;
        const to = s.expires ?? Infinity;
        if (to < range[0] || from > range[1]) return false;
      }
      if (skip !== "mineral" && mineral && s.mineral !== mineral) return false;
      if (skip !== "district" && district && s.district !== district) return false;
      return true;
    },
    [mineral, district, range],
  );

  const shown = React.useMemo(() => (sites ?? []).filter((s) => keep(s)), [sites, keep]);

  /** Датаны хамрах бүтэн хугацаа — шүүлтүүрийн хязгаар */
  const limits = React.useMemo<[number, number] | null>(() => {
    const ys = (sites ?? [])
      .flatMap((s) => [s.granted, s.expires])
      .filter((y): y is number => y != null);
    if (!ys.length) return null;
    return [Math.min(...ys), Math.max(...ys)];
  }, [sites]);

  /** Муж нь бүх хугацааг хамарч байвал шүүлт хийгээгүйтэй адил */
  const wholeRange =
    !limits || !range || (range[0] === limits[0] && range[1] === limits[1]);

  /** Шүүлтэнд үлдсэн зөвшөөрлүүдийн дугаар — зураг, цэг хоёуланд нь */
  const on = React.useMemo(() => new Set(shown.map((s) => s.id)), [shown]);

  /*
    Талбай бүр өөрийн өнгөтэй, дээрээ тусгай дугаараа бичнэ.

    Өнгө нь `properties.c`, шошго нь `properties.t`-ээр газрын зурагт
    дамжина. Хоёулаа ЭНД тодорхойлогдоно — эх сурвалжийн модуль (`lib`)
    нь дүрслэлийн сонголт мэдэх ёсгүй.
  */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const code = new Map(data.sites.map((s) => [s.id, s.code]));
    return {
      type: "FeatureCollection",
      features: data.shapes.features
        .filter((f) => on.has(Number(f.id)))
        .map((f) => {
          const id = Number(f.id);
          return {
            ...f,
            properties: { oid: id, c: rampColor(id - 1), t: code.get(id) ?? "" },
          };
        }),
    };
  }, [data, on]);

  /* ---------------- Задаргаа ----------------

     Хоёуланг нь ГА-гаар хэмжинэ, зөвшөөрлийн тоогоор БИШ. Зургаан
     зөвшөөрлийн дунд Налайхын нүүрс 4 нь боловч талбайн хувьд Багануурын
     ганц алтны талбай тэдгээрийг бүгдийг нь давна. */
  const byMineral = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const s of sites ?? []) {
      if (!keep(s, "mineral")) continue;
      m.set(s.mineral, (m.get(s.mineral) ?? 0) + s.ha);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [sites, keep]);

  const byDistrict = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const s of sites ?? []) {
      if (!keep(s, "district")) continue;
      m.set(s.district, (m.get(s.district) ?? 0) + s.ha);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [sites, keep]);

  /*
    Талбай тус бүрээр — газрын зурагтай ижил өнгөтэй.

    Ашигт малтмалын ТӨРЛӨӨР бус зөвшөөрөл тус бүрээр задлав: өнгө нь
    зөвшөөрлийг заадаг тул диаграм нь мөн зөвшөөрлийн мөртэй байж л
    зурагтайгаа нэг мөр нэг талбай гэж уншигдана. Төрлийн задаргаа
    шүүлтүүрийн цэсэнд байгаа.
  */
  const byLicense = React.useMemo<Datum[]>(
    () => shown.map((s) => ({ key: String(s.id), label: s.holder, value: s.ha })),
    [shown],
  );

  const stats = React.useMemo(() => {
    const ha = shown.reduce((s, x) => s + x.ha, 0);
    return {
      n: shown.length,
      ha,
      holders: new Set(shown.map((s) => s.holder)).size,
      expired: shown.filter((s) => isExpired(s, now)).length,
    };
  }, [shown, now]);

  /*
    Хугацааны хуваарийн хуваарь. Бүх зөвшөөрлийн ХАМГИЙН эрт олгогдсон
    ба ХАМГИЙН оройтож дуусах оноор хязгаарлана — шүүлтээр биш. Ингэснээр
    шүүлтүүр солиход зурвасууд байрандаа үлдэж, харьцуулалт эвдэрхгүй.
  */
  const span = React.useMemo(() => {
    const ys = (sites ?? []).flatMap((s) => [s.granted, s.expires]);
    const nums = ys.filter((y): y is number => y != null);
    if (!nums.length) return null;
    const lo = Math.min(...nums, now);
    const hi = Math.max(...nums, now);
    return { lo, hi, width: Math.max(hi - lo, 1) };
  }, [sites, now]);

  /* ---------------- Сонголтын хүрээ (zoom action) ----------------
     Сонгосон талбай руу, эс бөгөөс шүүлтүүрт таарсан бүх талбай руу
     ойртоно. Шүүлтүүр цуцлагдвал `null` — зураг анхны байрлалдаа буцна. */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !mineral && !district) return null;
    const b = new Bounds();
    for (const s of picked != null ? shown.filter((x) => x.id === picked) : shown) {
      const box = data.bounds.get(s.id);
      if (!box) continue;
      b.add(box[0], box[1]);
      b.add(box[2], box[3]);
    }
    /* Талбай жижиг байж болно — хамгийн багадаа ~450м хүрээ өгнө */
    return b.get(0.004);
  }, [data, shown, picked, mineral, district]);

  /** Хулгана дээр очсон талбай — газрын зурагнаас */
  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (sites?.find((s) => s.id === tip.oid) ?? null)),
    [sites, tip.oid],
  );

  /*
    Тогтмол самбар: товшсон талбай, эсвэл ЖАГСААЛТЫН мөр дээр очсон нь.
    Жагсаалтын мөрөнд хулганы байрлал гэж байхгүй тул хөвөгч тайлбар
    тэнд утгагүй — зөвхөн газрын зураг дээр хөвнө.
  */
  const active = React.useMemo(() => {
    const id = hover ?? picked;
    return id == null ? null : (sites?.find((s) => s.id === id) ?? null);
  }, [sites, hover, picked]);

  function clearRange() {
    setRange(limits);
  }

  function reset() {
    setMineral(null);
    setRange(limits);
    setDistrict(null);
    setPicked(null);
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">Эх сурвалжийн мэдээллийг татаж чадсангүй</p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Ашигт малтмалын талбайн хүрээ татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount = (wholeRange ? 0 : 1) + (mineral ? 1 : 0) + (district ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Ашигт малтмалын тусгай зөвшөөрөлтэй талбай"
        activeCount={activeCount}
        onReset={reset}
      >
        {/*
          Хугацаа — хоёр үзүүрт муж. Зөвшөөрлийн хугацаатай ОГТЛОЛЦСОН
          эсэхээр шүүнэ: "2030 онд ямар зөвшөөрөл хүчинтэй байх вэ"
          гэдэг нь энэ датаны гол асуулт.
        */}
        <FilterMenu
          label="Хугацаа"
          icon={CalendarRange}
          value={wholeRange || !range ? null : `${range[0]}–${range[1]}`}
          active={!wholeRange}
          onClear={clearRange}
          width={252}
        >
          {limits && range ? (
            <YearRange min={limits[0]} max={limits[1]} value={range} onChange={setRange} />
          ) : null}
        </FilterMenu>

        <FilterMenu
          label="Ашигт малтмал"
          icon={Mountain}
          value={mineral}
          active={Boolean(mineral)}
          onClear={() => setMineral(null)}
          width={230}
        >
          <PickList
            items={byMineral}
            selected={mineral}
            onPick={setMineral}
            format={(v) => `${num(Math.round(v))} га`}
          />
        </FilterMenu>

        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={220}
        >
          <PickList
            items={byDistrict}
            selected={district}
            onPick={setDistrict}
            format={(v) => `${num(Math.round(v))} га`}
          />
        </FilterMenu>
      </FilterBar>

      {/* Дээд мөр: газрын зураг (уян) + баруун талын нарийн зурвас */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
        <Card className="relative min-h-[260px] flex-1 overflow-hidden">
          <div className="relative h-full w-full">
            {/*
              ЗӨВХӨН талбайн хүрээ. Булангийн цэг нь хүрээг сэргээхэд
              хэрэглэгдсэн ТҮҮХИЙ эд — хүрээ нь зурагдсан хойно тэднийг
              давхарлах нь дүрслэлийг чимээ шуугиантай болгоно.
            */}
            <PointMap
              points={NO_POINTS}
              visible={NO_INDEX}
              shapes={{ data: shapes, selected: picked, glow: true }}
              basemap={basemap}
              onSelect={setPicked}
              onHover={tip.onHover}
              focus={focus}
              overlays={overlays}
              cluster={false}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} />
            <OverlayControl value={overlays} onChange={setOverlays} />

            {/*
              ХӨВӨГЧ ТАЙЛБАР. Хугацаа нь дээд мөрөнд: зөвшөөрөл ХЭЗЭЭ
              дуусахыг мэдэхгүйгээр талбайн байршил дангаараа утгагүй.
            */}
            {hovered ? (
              <MapTip state={tip} width={248}>
                <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2 pb-1">
                  <span className="num text-[11px] leading-none font-medium text-data">
                    {hovered.code}
                  </span>
                  <span className="num text-[11px] leading-none text-ink-3">
                    {hovered.grantedDate} → {hovered.expiresDate}
                  </span>
                </div>
                <div className="px-2.5 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                  {hovered.name}
                </div>

                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  <MapTipRow icon={Mountain} text={hovered.mineral} />
                  <MapTipRow icon={Ruler} num text={`${num(hovered.ha)} га`} />
                  <MapTipRow icon={Building2} text={hovered.holder} />
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3">
                    {hovered.district}
                  </span>
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {active ? (
              <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[280px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                <div className="eyebrow mb-1.5">{active.code}</div>
                <div className="text-[12.5px] leading-snug text-ink">
                  {active.name} · {active.mineral}
                </div>
                <div className="num mt-1 text-[11.5px] text-ink-2">
                  {num(active.ha)} га · {active.corners} булан
                </div>
                <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                  {active.holder} · {active.district}
                </div>
                <div className="num mt-0.5 text-[10.5px] text-ink-3">
                  {active.grantedDate} → {active.expiresDate}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="flex min-h-0 flex-col gap-2.5 xl:w-[320px] xl:shrink-0">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Stat icon={Pickaxe} label="Зөвшөөрөл" value={num(stats.n)} />
              <Stat icon={Ruler} label="Нийт талбай, га" value={num(Math.round(stats.ha))} />
              <Stat icon={Building2} label="Эзэмшигч" value={num(stats.holders)} />
              <Stat
                icon={CalendarClock}
                label={`${now} оны байдлаар дууссан`}
                value={num(stats.expired)}
              />
            </div>
          </Card>

          <Card className="min-h-0 flex-1">
            <Head title="Талбайн хэмжээ">
              <span className="text-[10.5px] text-ink-3">га</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/* Мөр товшиход газрын зураг тухайн талбай руу ойртоно */}
              <RowChart
                data={byLicense}
                colorOf={(d) => rampColor(Number(d.key) - 1)}
                selected={picked == null ? null : String(picked)}
                onSelect={(k) => setPicked(k == null ? null : Number(k))}
                format={(v) => num(v)}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Доод мөр: хугацааны хуваарь бүтэн өргөнөөр */}
      <Card className="shrink-0">
        <Head title="Зөвшөөрлийн хугацаа">
          <span className="num text-[10.5px] text-ink-3">
            {span ? `${span.lo}–${span.hi}` : "—"}
          </span>
        </Head>
        {span ? (
          <Timeline
            sites={shown}
            span={span}
            now={now}
            picked={picked}
            onPick={(id) => setPicked(picked === id ? null : id)}
            onHover={setHover}
          />
        ) : null}
      </Card>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS · {num(data.sites.length)} зөвшөөрөл ·{" "}
        {num(data.corners.oid.length)} булангийн цэгээс хүрээг сэргээв
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Хугацааны хуваарь.
 *
 * Мөр бүр нэг зөвшөөрөл: олгосон оноос дуусах он хүртэлх зурвас. Бүх мөр
 * НЭГ хуваарь дээр эгнэсэн тул урт нь шууд харьцуулагдана.
 *
 * Зурвас нь ХОЁР ҮЗҮҮРТЭЭ цэгтэй шугам: эхлэх ба дуусах он нь тодорхой
 * ҮЙЛ ЯВДАЛ (зөвшөөрөл олгосон, дуусах өдөр) тул тэднийг тэмдэглэх нь
 * зөв, зузаан блок нь харин "энэ хооронд бүхэлдээ ямар нэг хэмжигдэхүүн
 * байсан" гэж уншигдана.
 *
 * Он нь зурвасын үзүүрүүд дээрээ бичигдэнэ — өмнө нь баруун талын
 * тусдаа баганад байсан бөгөөд тэндээс зурвасын хаана эхэлж, хаана
 * дуусахыг нүдээр хөөх шаардлагатай байв.
 *
 * Хугацаа нь дууссаныг сул тод, хөндий цэгээр илэрхийлнэ — өнгөөр
 * ялгахгүй (дата дүрслэлийн өнгө ганц). Одоогийн оныг босоо зураасаар
 * тэмдэглэнэ.
 */
function Timeline({
  sites,
  span,
  now,
  picked,
  onPick,
  onHover,
}: {
  sites: MineralSite[];
  span: { lo: number; hi: number; width: number };
  now: number;
  picked: number | null;
  onPick: (id: number) => void;
  onHover: (id: number | null) => void;
}) {
  const at = (y: number) => ((y - span.lo) / span.width) * 100;

  /* Тэнхлэгийн шошго — арван жилийн алхмаар. Он бүрийг бичвэл шошго
     нь давхцана */
  const ticks: number[] = [];
  for (let y = Math.ceil(span.lo / 10) * 10; y <= span.hi; y += 10) ticks.push(y);

  return (
    <div className="px-3 py-2.5">
      <div className="divide-y divide-line">
        {sites.map((s) => {
          const dead = isExpired(s, now);
          const tone = rampColor(s.id - 1);
          const a = s.granted == null ? null : at(s.granted);
          const b = s.expires == null ? null : at(s.expires);
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              onMouseEnter={() => onHover(s.id)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "flex w-full items-center gap-2.5 py-1.5 text-left transition-colors hover:bg-paper-hi",
                picked === s.id && "bg-paper-hi",
              )}
            >
              {/* Зүүн талын тайлбар — нэр, төрөл, талбай */}
              <span className="w-[170px] shrink-0 sm:w-[220px]">
                <span className="block truncate text-[12px] leading-none text-ink">
                  {s.holder}
                </span>
                <span className="num mt-1 block truncate text-[10.5px] leading-none text-ink-3">
                  {s.code} · {s.mineral} · {num(s.ha)} га
                </span>
              </span>

              {/* Зурвас */}
              <span className={TRACK}>
                <span className={SCALE}>
                  {/* Арван жилийн зураас — хуваарийг барих суурь */}
                  {ticks.map((y) => (
                    <span
                      key={y}
                      className="absolute top-0 bottom-0 w-px bg-line"
                      style={{ left: `${at(y)}%` }}
                    />
                  ))}
                  {/* Одоогийн он */}
                  <span
                    className="absolute top-0 bottom-0 w-px bg-ochre/70"
                    style={{ left: `${at(now)}%` }}
                  />
                  {a != null && b != null ? (
                    <span
                      className="absolute inset-y-0"
                      style={{
                        left: `${Math.min(a, b)}%`,
                        width: `${Math.abs(b - a)}%`,
                        opacity: picked == null || picked === s.id ? 1 : 0.35,
                      }}
                    >
                      {/* Шугам — газрын зурган дээрх талбайн өнгөөр */}
                      <span
                        className="absolute top-1/2 right-0 left-0 h-[2px] -translate-y-1/2"
                        style={{ background: tone, opacity: dead ? 0.4 : 1 }}
                      />
                      {/* Хоёр үзүүрийн цэг. Хугацаа нь дууссан бол ХӨНДИЙ:
                          дүүргэлт нь "хүчинтэй" гэсэн утга үүрнэ */}
                      <Bullet at="left" dead={dead} tone={tone} />
                      <Bullet at="right" dead={dead} tone={tone} />
                      {/* Он нь үзүүрүүдийнхээ ГАДНА талд — зурвасын дотор
                          бичвэл богино хугацаанууд дээр давхцана */}
                      <span className="num absolute top-1/2 right-full -translate-y-1/2 pr-2 text-[10px] leading-none text-ink-3">
                        {s.granted}
                      </span>
                      <span className="num absolute top-1/2 left-full -translate-y-1/2 pl-2 text-[10px] leading-none text-ink-3">
                        {s.expires}
                      </span>
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
        {sites.length === 0 ? (
          <div className="py-4 text-center text-[12px] text-ink-3">
            Шүүлтүүрт тохирох тусгай зөвшөөрөл байхгүй байна
          </div>
        ) : null}
      </div>

      {/* Тэнхлэгийн шошго — зурвасын доор, зурвастай ЯГ ижил хуваарьтай */}
      <div className="mt-1 flex items-center gap-2.5">
        <span className="w-[170px] shrink-0 sm:w-[220px]" />
        <span className={cn(TRACK, "h-[12px]")}>
          <span className={SCALE}>
            {ticks.map((y) => (
              <span
                key={y}
                className="num absolute top-0 -translate-x-1/2 text-[10px] leading-none text-ink-3"
                style={{ left: `${at(y)}%` }}
              >
                {y}
              </span>
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}

/*
  Хуваарийн хоёр давхар хүрээ.

  `TRACK` нь мөрөнд эзлэх бүтэн зай, `SCALE` нь түүний дотор хувиар
  байрлуулах талбар. Хоёуланг нь ХАМТ хэрэглэнэ: `SCALE` хоёр талаасаа
  40px-ээр шахагдсан тул үзүүрийн он тэр зайд багтаж, хамгийн урт
  (1996–2046) зурвас ч гэсэн шошгоо алдахгүй. Тэнхлэгийн шошгын мөр
  мөн ижил хосыг хэрэглэдэг тул хуваарь нь зурвастай яг таарна.
*/
const TRACK = "relative h-[18px] min-w-0 flex-1";
const SCALE = "absolute inset-y-0 right-[40px] left-[40px]";

/** Зурвасын үзүүрийн цэг */
function Bullet({
  at,
  dead,
  tone,
}: {
  at: "left" | "right";
  dead: boolean;
  tone: string;
}) {
  return (
    <span
      className={cn(
        "absolute top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full",
        at === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
      )}
      style={{
        background: dead ? "var(--paper-2)" : tone,
        boxShadow: dead ? `inset 0 0 0 1.5px ${tone}` : undefined,
        opacity: dead ? 0.75 : 1,
      }}
    />
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
