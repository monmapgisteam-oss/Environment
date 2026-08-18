"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarDays,
  CalendarRange,
  Droplets,
  HardHat,
  LandPlot,
  Loader2,
  Map as MapIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { AreaChart, RowChart, YearRange, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { getWell, type WellsPayload, type WellDetail } from "@/lib/wells";
import { asset } from "@/lib/base-path";
import { cn, num } from "@/lib/utils";

const WellsMap = dynamic(
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

export function WellsDashboard() {
  const [data, setData] = React.useState<WellsPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [range, setRange] = React.useState<[number, number] | null>(null);
  const [aimag, setAimag] = React.useState<string | null>(null);
  const [soum, setSoum] = React.useState<string | null>(null);
  const [contractor, setContractor] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<WellDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());
  /*
    Харагдацын үйлдэл (ArcGIS Dashboard "map extent action"). Асаалттай үед
    газрын зургийн одоогийн хүрээ БУСАД элементүүдийг шүүнэ — цэгүүд өөрсдөө
    шүүгдэхгүй (хүрээнээсээ гадуурх цэг ямар ч байсан харагдахгүй тул шүүх нь
    утгагүй бөгөөд буцаж томрох үед цэг алдагдана).
  */
  const [extentOn, setExtentOn] = React.useState(false);
  const [extent, setExtent] = React.useState<Extent | null>(null);


  React.useEffect(() => {
    let alive = true;
    fetch(asset("/api/wells"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: WellsPayload) => {
        if (!alive) return;
        setData(d);
        setRange([d.minYear, d.maxYear]);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const aIdx = data && aimag ? data.aimags.indexOf(aimag) : -1;
  const sIdx = data && soum ? data.soums.indexOf(soum) : -1;
  const cIdx = data && contractor ? data.contractors.indexOf(contractor) : -1;
  /** Улаанбаатарын индекс — дүүрэг, сумыг ялгахад */
  const ubIdx = data ? data.aimags.indexOf("Улаанбаатар") : -1;

  /**
   * Шүүлтүүр давсан индексүүд. `skip`-д заасан хэмжигдэхүүнийг алгасна —
   * ингэснээр график бүр өөрийнхөө шүүлтээс бусдаар шүүгдэж, бусад баганууд
   * харагдсаар үлдэнэ (cross-filter).
   */
  type Skip = "year" | "aimag" | "soum" | "contractor" | "month";

  const selectBase = React.useCallback(
    (skip?: Skip) => {
      if (!data || !range) return new Uint32Array(0);
      const [lo, hi] = range;
      const out = new Uint32Array(data.n);
      let k = 0;

      for (let i = 0; i < data.n; i++) {
        if (skip !== "year") {
          const y = data.year[i];
          if (y < lo || y > hi) continue;
        }
        if (skip !== "aimag" && aIdx >= 0 && data.ai[i] !== aIdx) continue;
        if (skip !== "soum" && sIdx >= 0 && data.si[i] !== sIdx) continue;
        if (skip !== "contractor" && cIdx >= 0 && data.ci[i] !== cIdx) continue;
        if (skip !== "month" && month != null && String(data.month[i]) !== month) continue;
        out[k++] = i;
      }
      return out.subarray(0, k);
    },
    [data, range, aIdx, sIdx, cIdx, month],
  );

  /**
   * Харагдацын үйлдлийг нэмж хэрэглэнэ. Тусад нь давхарлаж байгаа шалтгаан:
   * газрын зураг `selectBase`-ийг л уншдаг тул зураг хөдлөх бүрд түүний
   * индекс дахин тооцогдож, 12 мянган цэг эх сурвалж руу дахин ачаалагдахгүй.
   */
  const select = React.useCallback(
    (skip?: Skip) => {
      const idx = selectBase(skip);
      if (!extent || !data) return idx;
      const [w, s, e, n] = extent;
      const wide = e - w >= 360;
      const out = new Uint32Array(idx.length);
      let k = 0;
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j];
        const y = data.lat[i];
        if (y < s || y > n) continue;
        if (!wide) {
          const x = data.lon[i];
          // Хүрээ 180°-ын шугам давсан бол w > e болно
          if (w <= e ? x < w || x > e : x < w && x > e) continue;
        }
        out[k++] = i;
      }
      return out.subarray(0, k);
    },
    [selectBase, extent, data],
  );

  /*
    Цэгийн шошго — худгийн бүртгэлийн дугаар.

    Худгийн НЭР гэж байхгүй (дэлгэрэнгүйг товшсон үед л татдаг) тул
    бүртгэлийн дугаар нь цорын ганц таних тэмдэг. Сум, дүүргийн нэрийг
    бичих нь утгагүй — суурь зураг өөрөө бичээд байдаг.

    Хамгийн ойрын түвшинд (z14) л гарна: 12 мянган цэг тул түүнээс
    холоос шошго нь тархалтыг бүрэн дарна.
  */
  const labels = React.useMemo(() => {
    if (!data) return undefined;
    return { text: data.oid.map((o) => `#${o}`), minzoom: 14 };
  }, [data]);

  /** Газрын зураг: харагдацын шүүлтгүй. Диаграм, индикатор: шүүлттэй. */
  const mapIdx = React.useMemo(() => selectBase(), [selectBase]);
  const chartIdx = React.useMemo(() => select(), [select]);

  /** Бүлэглэж тоолох. `only` нь нэмэлт нөхцөл (жишээ нь зөвхөн УБ). */
  const tally = React.useCallback(
    (
      field: "ci" | "si" | "ai",
      names: string[],
      skip: Parameters<typeof select>[0],
      opts?: { limit?: number; only?: (i: number) => boolean },
    ): Datum[] => {
      if (!data) return [];
      const idx = select(skip);
      const counts = new Map<number, number>();
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k];
        if (opts?.only && !opts.only(i)) continue;
        const v = data[field][i];
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const rows = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([i, v]) => ({ key: names[i], label: names[i], value: v, rank: i }));
      return opts?.limit ? rows.slice(0, opts.limit) : rows;
    },
    [data, select],
  );

  const yearData = React.useMemo<Datum[]>(() => {
    if (!data) return [];
    const idx = select("year");
    const counts = new Map<number, number>();
    for (let k = 0; k < idx.length; k++) {
      const y = data.year[idx[k]];
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    const out: Datum[] = [];
    for (let y = data.minYear; y <= data.maxYear; y++) {
      out.push({ key: String(y), label: String(y), value: counts.get(y) ?? 0 });
    }
    return out;
  }, [data, select]);

  const monthData = React.useMemo<Datum[]>(() => {
    if (!data) return [];
    const idx = select("month");
    const counts = new Array(12).fill(0);
    for (let k = 0; k < idx.length; k++) {
      const m = data.month[idx[k]];
      if (m >= 1 && m <= 12) counts[m - 1]++;
    }
    return counts.map((v, i) => ({
      key: String(i + 1),
      label: `${i + 1}-р сар`,
      value: v,
    }));
  }, [data, select]);

  const aimagData = React.useMemo(
    () => (data ? tally("ai", data.aimags, "aimag") : []),
    [data, tally],
  );
  /** Улаанбаатарын дүүргүүд */
  const districtData = React.useMemo(
    () =>
      data && ubIdx >= 0
        ? tally("si", data.soums, "soum", { only: (i) => data.ai[i] === ubIdx })
        : [],
    [data, tally, ubIdx],
  );
  /** Хөдөө орон нутгийн сумд */
  const ruralData = React.useMemo(
    () =>
      data
        ? tally("si", data.soums, "soum", { only: (i) => data.ai[i] !== ubIdx })
        : [],
    [data, tally, ubIdx],
  );
  const contractorData = React.useMemo(
    () => (data ? tally("ci", data.contractors, "contractor", { limit: 20 }) : []),
    [data, tally],
  );
  const allSoums = React.useMemo(
    () => (data ? tally("si", data.soums, "soum") : []),
    [data, tally],
  );
  const allContractors = React.useMemo(
    () => (data ? tally("ci", data.contractors, "contractor") : []),
    [data, tally],
  );

  /* ---------------- Сонголтын хүрээ (zoom action) ----------------

     ЯМАР Ч шүүлтүүр тавихад зураг тэр сонголт руугаа ойртоно — газарзүйн
     сонголт төдийгүй гүйцэтгэгч, он, сар ч мөн адил. Нэг гүйцэтгэгч
     сонгоход түүний ажилласан бүс өөрөө хариулт болно.

     ГАНЦ үл хамаарах зүйл нь ХАРАГДАЦЫН үйлдэл (`extentOn`): тэр нь
     зургийн хүрээг шүүлтүүр болгодог тул ойртолт нь хүрээг өөрчилж,
     хүрээ нь шүүлтийг өөрчилж — эцэс төгсгөлгүй эргэлдэнэ.

     Шүүлтүүр цуцлагдвал `null` буцаана: газрын зураг өөрөө анхны
     байрлал руугаа буцна. */
  const yearFiltered = Boolean(
    data && range && (range[0] !== data.minYear || range[1] !== data.maxYear),
  );
  const anyFilter = yearFiltered || Boolean(aimag || soum || contractor || month);

  const focus = React.useMemo<Extent | null>(() => {
    if (!data || !anyFilter || mapIdx.length === 0) return null;

    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k < mapIdx.length; k++) {
      xs.push(data.lon[mapIdx[k]]);
      ys.push(data.lat[mapIdx[k]]);
    }

    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    /* Цөөн цэгтэй үед бүгдийг, олон цэгтэй үед хазайсан 2%-ыг хасна —
       буруу бичигдсэн ганц координат хүрээг сунгахаас сэргийлнэ. */
    const trim = xs.length >= 50;
    const lo = trim ? Math.floor(xs.length * 0.01) : 0;
    const hi = trim ? Math.ceil(xs.length * 0.99) - 1 : xs.length - 1;
    return [xs[lo], ys[lo], xs[hi], ys[hi]];
  }, [data, mapIdx, anyFilter]);

  /* ---------------- Индикатор ---------------- */
  const indicators = React.useMemo(() => {
    if (!data) return null;
    const contractors = new Set<number>();
    const aimags = new Set<number>();
    /* Улаанбаатарынх нь дүүрэг, бусад аймгийнх нь сум */
    const districts = new Set<number>();
    const soums = new Set<number>();

    for (let k = 0; k < chartIdx.length; k++) {
      const i = chartIdx[k];
      contractors.add(data.ci[i]);
      aimags.add(data.ai[i]);
      (data.ai[i] === ubIdx ? districts : soums).add(data.si[i]);
    }

    return {
      total: chartIdx.length,
      contractors: contractors.size,
      aimags: aimags.size,
      soums: soums.size,
      districts: districts.size,
    };
  }, [data, chartIdx, ubIdx]);

  const openWell = React.useCallback((oid: number) => {
    setDetailLoading(true);
    // Статик хостинг тул нэг худгийн дэлгэрэнгүйг шууд ArcGIS-ээс авна
    getWell(oid)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);


  const wholeRange = !yearFiltered;
  /** Муж нь нэг жил дээр хумигдсан бол тэр он — "Он" шүүлтүүрийн утга */
  const singleYear = range && range[0] === range[1] ? String(range[0]) : null;
  const activeCount =
    (wholeRange ? 0 : 1) +
    (aimag ? 1 : 0) +
    (soum ? 1 : 0) +
    (contractor ? 1 : 0) +
    (month ? 1 : 0) +
    (extentOn ? 1 : 0);

  function reset() {
    if (!data) return;
    setRange([data.minYear, data.maxYear]);
    setAimag(null);
    setSoum(null);
    setContractor(null);
    setMonth(null);
    setExtentOn(false);
    setExtent(null);
  }

  /* ---------------- Ачааллаж байна / алдаа ---------------- */
  if (error || !data || !range || !indicators) {
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
            Худгийн бүртгэл татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar title="Худгийн бүртгэл" activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Хугацаа"
          icon={CalendarRange}
          value={wholeRange ? null : `${range[0]}–${range[1]}`}
          active={!wholeRange}
          onClear={() => setRange([data.minYear, data.maxYear])}
          width={252}
        >
          <YearRange
            min={data.minYear}
            max={data.maxYear}
            value={range}
            onChange={setRange}
          />
        </FilterMenu>

        <FilterMenu
          label="Аймаг"
          icon={MapIcon}
          value={aimag}
          active={Boolean(aimag)}
          onClear={() => setAimag(null)}
        >
          <PickList items={aimagData} selected={aimag} onPick={setAimag} />
        </FilterMenu>

        <FilterMenu
          label="Сум, дүүрэг"
          icon={LandPlot}
          value={soum}
          active={Boolean(soum)}
          onClear={() => setSoum(null)}
        >
          <PickList items={allSoums} selected={soum} onPick={setSoum} searchable />
        </FilterMenu>

        <FilterMenu
          label="Гүйцэтгэгч"
          icon={HardHat}
          value={contractor}
          active={Boolean(contractor)}
          onClear={() => setContractor(null)}
          width={300}
        >
          <PickList
            items={allContractors}
            selected={contractor}
            onPick={setContractor}
            searchable
          />
        </FilterMenu>

        {/*
          Дан он сонгох. `Хугацаа`-аас ялгаатай нь муж биш, ЯГ нэг жил —
          доод талд нь мужийг [он, он] болгож тавьдаг.
        */}
        <FilterMenu
          label="Он"
          icon={CalendarRange}
          value={singleYear}
          active={Boolean(singleYear)}
          onClear={() => setRange([data.minYear, data.maxYear])}
          width={168}
        >
          <PickList
            items={yearData}
            selected={singleYear}
            onPick={(k) =>
              setRange(k ? [Number(k), Number(k)] : [data.minYear, data.maxYear])
            }
          />
        </FilterMenu>

        <FilterMenu
          label="Сар"
          icon={CalendarDays}
          value={month ? `${month}-р сар` : null}
          active={Boolean(month)}
          onClear={() => setMonth(null)}
          width={200}
        >
          <PickList
            items={monthData.map((d) => ({ key: d.key, label: d.label, value: d.value }))}
            selected={month}
            onPick={setMonth}
          />
        </FilterMenu>
      </FilterBar>

      {/* ============ ГОЛ СҮЛЖЭЭ ============ */}
      <div className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[272px_1fr_292px]">
        {/* ---- ЗҮҮН: газарзүйн задаргаа ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          {/*
            Өндрийг агуулгад нь тааруулна: аймаг 6, дүүрэг 9 мөртэй тул
            өөрсдийнхөө хэрэглэх зайг л эзэлнэ. Сум нь 18+ мөртэй учир
            хамгийн доор, үлдсэн зайг аваад дотроо гүйнэ.
          */}
          <GeoPanel
            title="Аймгаар"
            count={aimagData.length}
            data={aimagData}
            selected={aimag}
            onSelect={setAimag}
            tone="var(--data)"
          />
          <GeoPanel
            title="Дүүргээр"
            count={districtData.length}
            data={districtData}
            selected={soum}
            onSelect={setSoum}
          />
          <GeoPanel
            title="Сумаар"
            count={ruralData.length}
            data={ruralData}
            selected={soum}
            onSelect={setSoum}
            grow
          />
        </div>

        {/* ---- ГОЛ: индикатор + газрын зураг ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          {/*
            Индикаторын зурвас. Нэг мөр, зураасаар тусгаарласан — тусдаа
            хайрцаг бүрийг хүрээлбэл дэлгэц хэсэгчилсэн харагдана. Гол утга
            (шүүлтүүрт таарсан худаг) хэмжээгээрээ давамгайлж, бусад нь
            хажуудаа тайлбар болж эгнэнэ.
          */}
          <div className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
            {/*
              3×2 сүлжээ: албан ёсны бүтэн нэршил хоёр мөр болж багтах өргөнтэй
              бөгөөд нүд бүр жигд дүүрнэ. Нэг мөрөнд шахвал гарчиг тасарна.
            */}
            <div className="grid grid-cols-3 divide-x divide-y divide-line xl:grid-cols-5 xl:divide-y-0">
              <Indicator
                icon={Droplets}
                label="Бүртгэгдсэн худгийн тоо"
                value={num(indicators.total)}
              />
              <Indicator
                icon={HardHat}
                label="Гүйцэтгэгч байгууллага"
                value={num(indicators.contractors)}
              />
              <Indicator
                icon={MapIcon}
                label="Бүртгэгдсэн худаг аймгаар"
                value={num(indicators.aimags)}
              />
              <Indicator
                icon={LandPlot}
                label="Бүртгэгдсэн худаг сумаар"
                value={num(indicators.soums)}
              />
              <Indicator
                icon={Building2}
                label="Бүртгэгдсэн худаг дүүргээр"
                value={num(indicators.districts)}
              />
            </div>
          </div>

          <Box className="relative min-h-[320px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              <WellsMap
                points={data}
                visible={mapIdx}
                labels={labels}
                basemap={basemap}
                onSelect={openWell}
                extent={extentOn}
                onExtent={setExtent}
                focus={focus}
              />


              <BasemapGallery
                value={basemap}
                onChange={setBasemap}
                extent={extentOn}
                onExtentChange={setExtentOn}
                unit="худаг"
              />

              {/*
                Харагдацын үйлдэл асаалттай үед хүрээг тэмдэглэнэ — шүүлтүүр
                далд ажиллаж байгааг мэдрүүлэх зорилготой.
              */}
              {extentOn ? (
                <div className="pointer-events-none absolute inset-0 z-10 border border-data/45" />
              ) : null}


              {(detail || detailLoading) && (
                <div className="absolute right-2.5 bottom-8 z-10 w-[262px] rounded-xs border border-line bg-paper/92 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow">Худгийн бичилт</span>
                    <button
                      onClick={() => setDetail(null)}
                      className="text-ink-3 transition-colors hover:text-ink"
                      aria-label="Хаах"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="p-2.5">
                    {detailLoading ? (
                      <div className="flex items-center gap-2 py-2 text-ink-3">
                        <Loader2 size={12} className="animate-spin" />
                        <span className="text-[12px]">Татаж байна…</span>
                      </div>
                    ) : detail ? (
                      <dl className="space-y-1.5">
                        <Field k="Дугаар" v={<span className="num">#{detail.OBJECTID}</span>} />
                        <Field k="Байршил" v={detail.location} />
                        <Field k="Сум, дүүрэг" v={`${detail.soum}, ${detail.aimag}`} />
                        <Field k="Хүсэлт гаргагч" v={detail.requester} />
                        <Field k="Гүйцэтгэгч" v={detail.contractor} />
                        <Field
                          k="Паспорт"
                          v={<span className="num text-[11.5px]">{detail.passport}</span>}
                        />
                        <Field
                          k="Огноо"
                          v={
                            <span className="num">
                              {detail.date
                                ? new Date(detail.date)
                                    .toISOString()
                                    .slice(0, 10)
                                    .replace(/-/g, ".")
                                : "—"}
                            </span>
                          }
                        />
                      </dl>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </Box>

          {/*
            Эх сурвалжийн бичиг — Esri болон ArcGIS-ийн ашиглалтын нөхцөл
            шаарддаг. Газрын зургийн доор энгийнээр, дэвсгэргүй.
          */}
          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS FeatureServer
          </p>
        </div>

        {/* ---- БАРУУН: хугацаа + гүйцэтгэгч ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Box>
            <Head title="Жилээр">
              <span className="num text-[11.5px] text-ink-3">
                {wholeRange
                  ? `/${data.minYear} - ${data.maxYear}/`
                  : `/${range[0]} - ${range[1]}/`}
              </span>
            </Head>
            <div className="p-3">
              <AreaChart
                data={yearData}
                tone="var(--data)"
                height={92}
                selected={range[0] === range[1] ? String(range[0]) : null}
                onSelect={(k) =>
                  setRange(k ? [Number(k), Number(k)] : [data.minYear, data.maxYear])
                }
                unit="худаг"
              />
            </div>
          </Box>

          <Box>
            <Head title="Сараар">
              <span className="text-[11.5px] text-ink-3">улирлын хэлбэлзэл</span>
            </Head>
            <div className="p-3">
              <AreaChart
                data={monthData}
                tone="var(--data)"
                height={80}
                selected={month}
                onSelect={setMonth}
                formatTick={(_d, i) => String(i + 1)}
                unit="худаг"
              />
            </div>
          </Box>

          <Box className="min-h-[140px] flex-1">
            <Head title="Гүйцэтгэгчээр">
              <span className="num text-[11.5px] text-ink-3">эхний 20</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <RowChart
                data={contractorData}
                tone="var(--data)"
                selected={contractor}
                onSelect={setContractor}
              />
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function GeoPanel({
  title,
  count,
  data,
  selected,
  onSelect,
  tone,
  colorOf,
  grow,
}: {
  title: string;
  count: number;
  data: Datum[];
  selected: string | null;
  onSelect: (k: string | null) => void;
  tone?: string;
  colorOf?: (d: Datum) => string;
  /** Үлдсэн зайг эзэлж, дотроо гүйх эсэх */
  grow?: boolean;
}) {
  return (
    <Box className={grow ? "min-h-[120px] flex-1" : "shrink-0"}>
      <Head title={title}>
        <span className="num text-[11.5px] text-ink-3">{count}</span>
      </Head>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <RowChart
          data={data}
          tone={tone}
          colorOf={colorOf}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    </Box>
  );
}

function Box({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col rounded-xs border border-line bg-paper-2", className)}>
      {children}
    </div>
  );
}

function Head({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
      {/*
        Том үсэгт `.display`-ийн нягт tracking тохирохгүй тул энд сулруулав —
        шахсан зай нь зөвхөн жижиг үсэгт зохимжтой.
      */}
      <h2 className="display text-[13.5px] leading-none tracking-[0.06em] uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * Индикаторын нэгж нүд.
 *
 * Бүх тоо нэг өнгөтэй (`ink`): гол утгыг accent-аар биш, байрлалаараа
 * (эхний нүд) ялгана. Гарчгийн талбайд хоёр мөрийн зай нөөцөлсөн тул
 * зэрэгцээ нүднүүдийн тоо нэг шугам дээр таарна. Икон нь ижил хэлбэртэй
 * гарчгуудыг нүдээр ялгах хэрэгсэл.
 */
function Indicator({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col px-3.5 py-3">
      <span className="eyebrow block min-h-[30px] leading-[1.35]">{label}</span>
      <div className="mt-auto flex items-center gap-2">
        <Icon size={26} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[20px] leading-none font-medium text-ink">
          {value}
        </span>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[74px] shrink-0 text-[10.5px] tracking-[0.08em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{v}</dd>
    </div>
  );
}
