"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarRange,
  Coins,
  Loader2,
  Ruler,
  Sprout,
} from "lucide-react";
import { AreaChart, PieChart, RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import { fetchReclamation, FUNDING, type ReclamationSite } from "@/lib/reclamation";
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

/** Талбайн өнгө — ганц дата өнгө, ангиллаар ялгахгүй */
const TONE = "#67d7e4";

/**
 * Нөхөн сэргээлтийн самбар.
 *
 * Бичлэг маш цөөн (11 талбай) тул тархалтын диаграм утгагүй. Оронд нь
 * ЖАГСААЛТ давамгайлна: талбай бүр өөрөө нэг мөр, товшиход зураг тийш
 * ойртоно. Хэмжигдэхүүн нь тоо биш ТАЛБАЙ (га) — "хэдэн ажил хийсэн"
 * гэдгээс "хэдэн га сэргээсэн" нь чухал.
 */
export function ReclamationDashboard() {
  const [sites, setSites] = React.useState<ReclamationSite[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [funding, setFunding] = React.useState<string | null>(null);
  const [year, setYear] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  React.useEffect(() => {
    let alive = true;
    fetchReclamation()
      .then((s) => alive && setSites(s))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const keep = React.useCallback(
    (s: ReclamationSite, skip?: "funding" | "year" | "district") => {
      if (skip !== "funding" && funding && s.funding !== funding) return false;
      if (skip !== "year" && year && String(s.year) !== year) return false;
      if (skip !== "district" && district && s.district !== district) return false;
      return true;
    },
    [funding, year, district],
  );

  const shown = React.useMemo(
    () => (sites ?? []).filter((s) => keep(s)),
    [sites, keep],
  );

  /* ---------------- Газрын зураг ---------------- */
  const geo = React.useMemo<MapPoints>(() => {
    const oid = shown.map((s) => s.oid);
    return {
      oid,
      lon: shown.map((s) => s.lon),
      lat: shown.map((s) => s.lat),
    };
  }, [shown]);

  const visible = React.useMemo(
    () => Uint32Array.from(shown.map((_, i) => i)),
    [shown],
  );

  /* Талбайн хүрээ — булангийн цэгүүдээс олон өнцөгт болгоно */
  /*
    Нэг бичлэг ХЭД ХЭДЭН салангид талбайтай байж болох тул
    `MultiPolygon` — цагираг бүр тусдаа хэсэг. Нэг Feature хэвээр
    үлдэнэ: сонголт, hover нь бичлэгээр явдаг тул хэсгүүд нь салж
    болохгүй.
  */
  const polygons = React.useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: shown
        .filter((s) => s.rings.length > 0)
        .map((s) => ({
          type: "Feature" as const,
          id: s.oid,
          /* `t` нь ойртоход хүрээн дээр гарах шошго — талбайн дугаар,
             он хоёр нь тайлангийн мөрийг таниулах хамгийн богино хос */
          properties: { oid: s.oid, c: TONE, t: `${s.no} · ${s.year}` },
          geometry: {
            type: "MultiPolygon" as const,
            coordinates: s.rings.map((r) => [r]),
          },
        })),
    }),
    [shown],
  );

  /* ---------------- Задаргаа ----------------
     Хэмжигдэхүүн нь БҮГД га — тоо ширхэг биш талбай харьцуулагдана */
  const byYear = React.useMemo<Datum[]>(() => {
    const m = new Map<number, number>();
    for (const s of sites ?? []) {
      if (!keep(s, "year")) continue;
      m.set(s.year, (m.get(s.year) ?? 0) + s.ha);
    }
    return [...m]
      .sort((a, b) => a[0] - b[0])
      .map(([y, ha]) => ({ key: String(y), label: String(y), value: ha }));
  }, [sites, keep]);

  /*
    Цагийн тэнхлэгт ХООСОН ЖИЛ ч суудалтай байх ёстой: 2022, 2024-д
    бичлэг алга. Тэднийг алгасвал 2021, 2023 зэрэгцэж, тасралтгүй цуваа
    мэт уншигдана. Талбайт диаграм дээр алдаа нь бүр том: цэгүүд шулуунаар
    холбогддог тул огт нөхөн сэргээгээгүй жилээр дамжсан "жигд" налуу
    зурагдана.

    Шүүлтүүрийн жагсаалт нь ЭХ `byYear`-аа хэвээр хэрэглэнэ — тэнд
    "2022 · 0" гэсэн сонгож болохгүй мөр гарах ёсгүй.
  */
  const yearSeries = React.useMemo<Datum[]>(() => {
    if (byYear.length === 0) return [];
    const have = new Map(byYear.map((d) => [Number(d.key), d.value]));
    const lo = Number(byYear[0].key);
    const hi = Number(byYear[byYear.length - 1].key);
    const out: Datum[] = [];
    for (let y = lo; y <= hi; y++) {
      out.push({ key: String(y), label: String(y), value: have.get(y) ?? 0 });
    }
    return out;
  }, [byYear]);

  const byDistrict = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const s of sites ?? []) {
      if (!keep(s, "district")) continue;
      m.set(s.district, (m.get(s.district) ?? 0) + s.ha);
    }
    return [...m]
      .map(([k, ha]) => ({ key: k, label: k, value: ha }))
      .sort((a, b) => b.value - a.value);
  }, [sites, keep]);

  const byFunding = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const s of sites ?? []) {
      if (!keep(s, "funding")) continue;
      m.set(s.funding, (m.get(s.funding) ?? 0) + s.ha);
    }
    return FUNDING.filter((f) => m.has(f.id)).map((f) => ({
      key: f.id,
      label: f.label,
      value: m.get(f.id) ?? 0,
    }));
  }, [sites, keep]);

  /* Бөгжний хувийг тооцох суурь — эх үүсвэрийн шүүлтийг АЛГАСсан нийлбэр.
     `stats.ha` -г хэрэглэвэл эх үүсвэр сонгомогц сонгосон зүсэм нь
     үргэлж 100% болж харагдана */
  const totalHa = React.useMemo(
    () => byFunding.reduce((s, d) => s + d.value, 0),
    [byFunding],
  );

  const stats = React.useMemo(() => {
    const ha = shown.reduce((s, x) => s + x.ha, 0);
    const years = new Set(shown.map((s) => s.year));
    const cost = shown.reduce((s, x) => s + (x.cost ?? 0), 0);
    return {
      n: shown.length,
      ha,
      years: years.size,
      span: years.size
        ? `${Math.min(...years)}–${Math.max(...years)}`
        : "—",
      cost,
    };
  }, [shown]);

  /* Сонголт руу ойртох */
  /* ---------------- Сонголтын хүрээ (zoom action) ----------------
     Сонгосон талбай руу, эс бөгөөс шүүлтүүрт таарсан бүх талбай руу
     ойртоно. Шүүлтүүр цуцлагдвал `null` — зураг анхны байрлалдаа буцна. */
  const focus = React.useMemo<Extent | null>(() => {
    if (picked == null && !funding && !year && !district) return null;
    const b = new Bounds();
    for (const site of picked != null ? shown.filter((s) => s.oid === picked) : shown) {
      if (site.rings.length) {
        for (const ring of site.rings) for (const [x, y] of ring) b.add(x, y);
      } else b.add(site.lon, site.lat);
    }
    return b.get(0.003);
  }, [shown, picked, funding, year, district]);

  const active = React.useMemo(
    () => (sites ?? []).find((s) => s.oid === (hover ?? picked)) ?? null,
    [sites, hover, picked],
  );

  function reset() {
    setFunding(null);
    setYear(null);
    setDistrict(null);
    setPicked(null);
  }

  if (error || !sites) {
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
            Нөхөн сэргээлтийн мэдээ татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount =
    (funding ? 1 : 0) + (year ? 1 : 0) + (district ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar title="Нөхөн сэргээлт" activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Эх үүсвэр"
          icon={Coins}
          value={funding ? FUNDING.find((f) => f.id === funding)?.label : null}
          active={Boolean(funding)}
          onClear={() => setFunding(null)}
          width={220}
        >
          <PickList items={byFunding} selected={funding} onPick={setFunding} />
        </FilterMenu>

        <FilterMenu
          label="Он"
          icon={CalendarRange}
          value={year}
          active={Boolean(year)}
          onClear={() => setYear(null)}
          width={160}
        >
          <PickList items={byYear} selected={year} onPick={setYear} />
        </FilterMenu>

        <FilterMenu
          label="Байршил"
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
        Нэг МӨР, гурван хэсэг: зүүнд талбайн жагсаалт, дунд газрын зураг
        (уян), баруунд задаргааны диаграмууд. Жагсаалтын мөр бүр зурган
        дээрх талбайтайгаа хосолдог (hover, товшилт) тул хажууд нь байх
        нь ойлгомжтой. xl-ээс доош унавал мөр нь багана болно — нарийн
        дэлгэцэнд гурван багана зургийг юу ч үлдээхгүй шахна.

        Индикатор нь дээд талд бүтэн өргөнөөр биш, хоёр хажуугийн
        Индикатор нь дээд талд бүтэн өргөнөөр биш, БАРУУН баганын
        толгойд 2×2 сүлжээгээр суудаг: тэндээс доош задаргааны диаграмууд
        үргэлжлэх тул нэгтгэсэн тоо ба задаргаа нэг баганад цуварна.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-[300px] xl:shrink-0 2xl:w-[340px]">
            {/*
              Талбай цөөхөн тул жагсаалт нь диаграмаас илүү мэдээлэл өгнө:
              мөр бүр он, хэмжээ, гүйцэтгэгчээ авч явна.
            */}
            <Card className="min-h-[120px] flex-1">
              <Head title="Талбайн жагсаалт">
                <span className="num text-[11.5px] text-ink-3">{num(shown.length)}</span>
              </Head>
              <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                {shown.map((s) => (
                  <button
                    key={s.oid}
                    onClick={() => setPicked(picked === s.oid ? null : s.oid)}
                    onMouseEnter={() => setHover(s.oid)}
                    onMouseLeave={() => setHover(null)}
                    className={cn(
                      "block w-full px-3 py-2 text-left transition-colors hover:bg-paper-hi",
                      picked === s.oid && "bg-paper-hi",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-[12px] text-ink">
                        {s.place}
                      </span>
                      <span className="num shrink-0 text-[11.5px] text-ink-2">
                        {s.ha} га
                      </span>
                    </div>
                    <div className="num mt-1 flex items-center gap-1.5 text-[10.5px] text-ink-3">
                      <span>{s.year}</span>
                      <span aria-hidden>·</span>
                      <span className="min-w-0 truncate">
                        {s.contractor ?? FUNDING.find((f) => f.id === s.funding)?.label}
                      </span>
                    </div>
                  </button>
                ))}
                {shown.length === 0 ? (
                  <div className="py-5 text-center text-[12px] text-ink-3">
                    Шүүлтүүрт тохирох талбай алга
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <Card className="relative min-h-[280px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/*
                Талбай нь ОЛОН ӨНЦӨГТ, төлөөлөх цэг нь түүн дээр. Цэг нь
                алсаас талбай хэтэрхий жижиг харагдах үед байршлыг
                хадгална.
              */}
              <PointMap
                points={geo}
                visible={visible}
                shapes={{ data: polygons, selected: picked, labelZoom: 12 }}
                basemap={basemap}
                onSelect={setPicked}
                onHover={setHover}
                focus={focus}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {active ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[260px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="eyebrow mb-1.5">
                    {FUNDING.find((f) => f.id === active.funding)?.label}
                  </div>
                  <div className="text-[12.5px] leading-snug text-ink">{active.place}</div>
                  <div className="num mt-1 text-[11.5px] text-ink-2">
                    {active.year} · {active.ha} га
                  </div>
                  {active.contractor ? (
                    <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                      {active.contractor}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          {/* ---- БАРУУН: индикатор + задаргаа ---- */}
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-[360px] xl:shrink-0">
            {/* Дөрвөн индикатор — хоёр багана, хоёр мөр */}
            <Card className="shrink-0">
              <div className="grid grid-cols-2 divide-x divide-y divide-line">
                <Stat icon={Sprout} label="Талбай" value={num(stats.n)} />
                <Stat icon={Ruler} label="Нийт га" value={stats.ha.toFixed(1)} />
                <Stat icon={CalendarRange} label="Хамрах он" value={stats.span} />
                {/*
                  Төсөвт өртөг нь зөвхөн ААН-ийн эх сурвалжид бий.
                  Нэгжийг нь ХӨРВҮҮЛЭХГҮЙ: талбарын нэр "мян_төг" гэсэн
                  боловч 2.6 га нөхөн сэргээлт 120 мянган төгрөг байх нь
                  эргэлзээтэй. Эх сурвалжийн бичсэнээр нь харуулж,
                  тодруулгыг хэлтсээс авна.
                */}
                <Stat
                  icon={Coins}
                  label="Төсөвт өртөг, мян.₮"
                  value={stats.cost ? num(Math.round(stats.cost)) : "—"}
                />
              </div>
            </Card>

            {/*
              Санхүүжилтийн эх үүсвэр.

              Ердөө ХОЁР ангилал тул бөгжөөр — мөрөн диаграм нь хоёр
              зурвасыг зэрэгцүүлээд орхих бөгөөд гол баримт нь
              "хэдэн га" биш ХАРЬЦАА юм: нөхөн сэргээлтийн 98% нь
              нийслэлийн төсвөөр хийгдсэн, аж ахуйн нэгжийн хөрөнгө
              ердөө 3.8 га-д хүрсэн. Бөгж нь тэр харьцааг шууд уншуулна.

              Тоог 1 орны нарийвчлалтай бичнэ — `num()` нь бүхэл
              болгодог тул 3.8 нь "4" болж, ялгаа нь бүдгэрнэ.
            */}
            <Card className="shrink-0">
              <Head title="Санхүүжилтийн эх үүсвэрээр">
                <span className="text-[10.5px] text-ink-3">га</span>
              </Head>
              <div className="p-3">
                <PieChart
                  data={byFunding}
                  size={84}
                  selected={funding}
                  onSelect={setFunding}
                  format={(v) => v.toFixed(1)}
                  note={(d) => `${((d.value / totalHa) * 100).toFixed(1)}%`}
                />
              </div>
            </Card>

            <Card className="shrink-0">
              <Head title="Оноор">
                <span className="text-[10.5px] text-ink-3">га</span>
              </Head>
              <div className="p-3">
                {/* Он бол цагийн тэнхлэг — эрэмбийг нь хадгалж цуваагаар */}
                <AreaChart
                  data={yearSeries}
                  height={110}
                  selected={year}
                  /* Бичлэггүй жилийг сонгуулахгүй: шүүлтүүр нь хоосон үр
                     дүн буцаах тул сонголт биш, цэвэрлэлт болгоно */
                  onSelect={(k) =>
                    setYear(k && byYear.some((d) => d.key === k) ? k : null)
                  }
                  unit="га"
                />
              </div>
            </Card>

            {/* Мөрийн СҮҮЛД нь уян карт — дээрх нь тогтмол өндөртэй */}
            <Card className="min-h-0 flex-1">
              <Head title="Байршлаар">
                <span className="text-[10.5px] text-ink-3">га</span>
              </Head>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart
                  data={byDistrict}
                  selected={district}
                  onSelect={setDistrict}
                  format={(v) => v.toFixed(1)}
                />
              </div>
            </Card>
          </div>
        </div>

        <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
          Суурь зураг: Esri · Дата: ArcGIS · талбайн хүрээг булангийн цэгүүдээс
          сэргээв
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
  icon: typeof Sprout;
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
