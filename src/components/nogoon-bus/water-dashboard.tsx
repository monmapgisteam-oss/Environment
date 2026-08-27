"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarRange,
  Coins,
  Droplets,
  Factory,
  FileSignature,
  Loader2,
  MapPin,
  MousePointerClick,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AreaChart, RowChart, YearRange, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { boundsOf } from "@/lib/extent";
import {
  fetchWaterContracts,
  unitFee,
  type WaterContract,
  type WaterData,
} from "@/lib/water-contracts";
import { cn, num } from "@/lib/utils";

const WaterMap = dynamic(
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

type Skip = "sector" | "activity" | "district" | "holder" | "year";

/**
 * Ус ашиглах гэрээний самбар.
 *
 * Худгийн бүртгэлтэй ИЖИЛ бүтэцтэй (ArcGIS Dashboard маяг): шүүлтүүрийн
 * мөр → зүүн талд задаргаа · төвд индикаторын зурвас ба газрын зураг ·
 * баруун талд задаргаа. Хоёр самбар нэг хэлтсийн, ойролцоо сэдвийн
 * (усны нөөц) тул нэг хэлбэрт байх нь хэрэглэгчид ойлгомжтой.
 *
 * Бүх задаргаа М³-ЭЭР хэмжигдэнэ, гэрээний тоогоор БИШ: 10 гэрээ бүр
 * өөр хэмжээтэй тул тоолол нь салбарын жинг буруу харуулна.
 *
 * Баруун доод булангийн НЭГЖ ҮНЭ нь энэ самбарын гол олдвор: усны нөөцийн
 * төлбөрийн тариф салбар бүрд өөр тул ижил хэмжээний ус ашигласан хоёр
 * аж ахуйн нэгж эрс өөр төлбөр төлдөг.
 */
export function WaterDashboard() {
  const [data, setData] = React.useState<WaterData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [sector, setSector] = React.useState<string | null>(null);
  const [activity, setActivity] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [holder, setHolder] = React.useState<string | null>(null);
  /*
    Зөвшөөрөл олгосон оны МУЖ. Гэрээ дуусах хугацаа бүгд НЭГ утгатай
    (2025.12.31) тул хугацааны цорын ганц утга бүхий хэмжигдэхүүн нь
    зөвшөөрөл олгосон он — муж нь түүн дээр суудаг.
  */
  const [range, setRange] = React.useState<[number, number] | null>(null);
  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();
  const [picked, setPicked] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  React.useEffect(() => {
    let alive = true;
    fetchWaterContracts()
      .then((d) => {
        if (!alive) return;
        setData(d);
        const ys = d.rows
          .map((c) => c.permitYear)
          .filter((y): y is number => y != null);
        if (ys.length) setRange([Math.min(...ys), Math.max(...ys)]);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const rows = data?.rows;

  /** Датаны хамрах бүтэн хугацаа — шүүлтүүрийн хязгаар, шүүлтээс хамаарахгүй */
  const limits = React.useMemo<[number, number] | null>(() => {
    const ys = (rows ?? [])
      .map((c) => c.permitYear)
      .filter((y): y is number => y != null);
    if (!ys.length) return null;
    return [Math.min(...ys), Math.max(...ys)];
  }, [rows]);

  /** Муж нь бүх оныг хамарч байвал шүүлт хийгээгүйтэй адил */
  const wholeRange =
    !limits || !range || (range[0] === limits[0] && range[1] === limits[1]);

  /**
   * Шүүлтүүр давсан гэрээнүүд. `skip`-д заасан хэмжигдэхүүнийг алгасна —
   * ингэснээр диаграм бүр өөрийнхөө шүүлтээс бусдаар шүүгдэж, сонгосны
   * дараа ч бусад мөрүүд харагдсаар үлдэнэ (cross-filter).
   */
  const select = React.useCallback(
    (skip?: Skip): WaterContract[] => {
      const out: WaterContract[] = [];
      for (const c of rows ?? []) {
        if (skip !== "sector" && sector && c.sector !== sector) continue;
        if (skip !== "activity" && activity && c.activity !== activity) continue;
        if (skip !== "district" && district && c.district !== district) continue;
        if (skip !== "holder" && holder && c.holder !== holder) continue;
        /* Он тодорхойгүй гэрээ нь муж тавихад унана — "хэзээ олгосон нь
           мэдэгдэхгүй" бичлэгийг тухайн муж дотор байсан мэт харуулах
           боломжгүй. Одоогийн 10 гэрээ бүгд онтой. */
        if (skip !== "year" && range) {
          if (c.permitYear == null || c.permitYear < range[0] || c.permitYear > range[1]) {
            continue;
          }
        }
        out.push(c);
      }
      return out;
    },
    [rows, sector, activity, district, holder, range],
  );

  const shown = React.useMemo(() => select(), [select]);

  const visible = React.useMemo(() => {
    if (!data) return new Uint32Array(0);
    const on = new Set(shown.map((c) => c.oid));
    const out: number[] = [];
    for (let i = 0; i < data.points.oid.length; i++) {
      if (on.has(data.points.oid[i])) out.push(i);
    }
    return Uint32Array.from(out);
  }, [data, shown]);

  /*
    Цэгийн шошго — ус ашиглагчийн нэр.

    Цэгүүд хот даяар сарнисан тул холоос аль нь хэн болох нь мэдэгдэхгүй.
    Ойртоход нэр гарч ирнэ. `points`-той ижил урттай массив өгнө.
  */
  const labels = React.useMemo(() => {
    if (!data) return undefined;
    const name = new Map(data.rows.map((c) => [c.oid, c.holder]));
    return {
      text: data.points.oid.map((oid) => name.get(oid) ?? ""),
      minzoom: 11,
    };
  }, [data]);

  /** Талбараар нь бүлэглэж м³-ийг нэмнэ */
  const tally = React.useCallback(
    (field: "sector" | "activity" | "district" | "holder", skip: Skip): Datum[] => {
      const m = new Map<string, number>();
      for (const c of select(skip)) m.set(c[field], (m.get(c[field]) ?? 0) + c.m3);
      return [...m]
        .map(([k, v]) => ({ key: k, label: k, value: v }))
        .sort((a, b) => b.value - a.value);
    },
    [select],
  );

  /* Салбар нь эх сурвалжийн ТОГТООСОН дараалалтай (ром дугаар) — хэмжээгээр
     эрэмбэлбэл шүүлт солих бүрд мөрүүд үсэрнэ */
  const sectorData = React.useMemo<Datum[]>(() => {
    if (!data) return [];
    const by = new Map(tally("sector", "sector").map((d) => [d.key, d.value]));
    return data.sectors
      .filter((s) => by.has(s))
      .map((s) => ({ key: s, label: s, value: by.get(s) ?? 0 }));
  }, [data, tally]);

  const activityData = React.useMemo(() => tally("activity", "activity"), [tally]);

  /*
    Дүүрэг — гэрээний ТООГООР. Дээрх м³ диаграмтай зэрэгцэж зогсоно.

    Хоёр нь ӨӨР асуултад хариулна: м³ нь "хаана хамгийн их ус зарцуулж
    байна", тоо нь "хаана хамгийн олон гэрээ байна". Нэг том хэрэглэгчтэй
    дүүрэг эхнийхэд тэргүүлж, хоёрдугаарт доогуур байж болно — тэр зөрөө
    нь өөрөө олдвор.
  */
  const districtCount = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const c of select("district")) m.set(c.district, (m.get(c.district) ?? 0) + 1);
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [select]);
  const districtData = React.useMemo(() => tally("district", "district"), [tally]);
  const holderData = React.useMemo(() => tally("holder", "holder"), [tally]);

  /*
    Зөвшөөрөл олгосон жилийн цуваа. Он БҮРИЙГ гаргана — байхгүй жилийг
    алгасвал 2015 ба 2017 хоёрын хооронд завсар байгаа нь харагдахгүй.

    Гэрээ дуусах хугацаа НЭГ л утгатай (2025.12.31) тул түүгээр цуваа
    хийх утгагүй — зөвшөөрөл олгосон он л хугацааны мэдээлэл өгнө.

    Бусад диаграмтай адил ӨӨРИЙНХӨӨ шүүлтийг алгасна (`skip: "year"`) —
    нэг он сонгосны дараа ч бусад баганууд харагдсаар үлдэж, буцаж
    сонгох боломжтой байна.
  */
  const yearData = React.useMemo<Datum[]>(() => {
    const ys = select("year")
      .map((c) => c.permitYear)
      .filter((y): y is number => y != null);
    if (!ys.length) return [];
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const c = new Map<number, number>();
    for (const y of ys) c.set(y, (c.get(y) ?? 0) + 1);
    const out: Datum[] = [];
    for (let y = lo; y <= hi; y++) {
      out.push({ key: String(y), label: String(y), value: c.get(y) ?? 0 });
    }
    return out;
  }, [select]);

  /*
    Нэгж үнэ — гэрээ тус бүрээр, ӨНДРӨӨС нааш.

    Хуваарь нь тэгээс биш ХАМГИЙН БАГА утгаас эхэлнэ (`base`): бүх тариф
    95–190 хооронд бөгөөд тэгээс зурвал бүх зурвас бараг ижил урттай
    болж ялгаа нь алга болно.
  */
  const feeData = React.useMemo<Datum[]>(
    () =>
      shown
        .map((c) => ({ key: c.holder, label: c.holder, value: unitFee(c) }))
        .sort((a, b) => b.value - a.value),
    [shown],
  );
  const feeMin = feeData.length ? Math.min(...feeData.map((d) => d.value)) : 0;

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    return {
      n: shown.length,
      holders: new Set(shown.map((c) => c.holder)).size,
      m3: shown.reduce((s, c) => s + c.m3, 0),
      fee: shown.reduce((s, c) => s + c.fee, 0),
    };
  }, [shown]);

  /* ---------------- Сонголтын хүрээ (zoom action) ----------------
     ЯМАР Ч шүүлтүүр эсвэл сонголт хийхэд зураг таарсан гэрээнүүд рүүгээ
     ойртоно. Шүүлтүүр цуцлагдвал `null` — зураг анхны байрлалдаа буцна. */
  const anyFilter = !wholeRange || Boolean(sector || activity || district || holder);

  const focus = React.useMemo<Extent | null>(() => {
    if (picked != null) return boundsOf(shown.filter((c) => c.oid === picked));
    return anyFilter ? boundsOf(shown) : null;
  }, [shown, anyFilter, picked]);

  /*
    Товшсон гэрээ — зүүн дээд буланд ТОГТМОЛ самбар. Хулганы тайлбартай
    хольж нэг самбар болгож болохгүй: сонголтоо тогтоосон хойноо
    хулгана хөдөлгөх бүрд агуулга нь солигдож, уншиж чадахгүй болно.
  */
  const active = React.useMemo(
    () => (picked == null ? null : (rows?.find((c) => c.oid === picked) ?? null)),
    [rows, picked],
  );

  /** Хулгана дээр очсон гэрээ — сүлжээгүй, аль хэдийн татсан мөрөөс */
  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (rows?.find((c) => c.oid === tip.oid) ?? null)),
    [rows, tip.oid],
  );

  /** Тодруулах цэгийн байрлал — зураг дээрх цагираг */
  const highlight = React.useMemo<[number, number] | null>(
    () => (hovered ? [hovered.lon, hovered.lat] : null),
    [hovered],
  );

  function reset() {
    setRange(limits);
    setSector(null);
    setActivity(null);
    setDistrict(null);
    setHolder(null);
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
            Ус ашиглах гэрээ татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount =
    (wholeRange ? 0 : 1) +
    (sector ? 1 : 0) +
    (activity ? 1 : 0) +
    (district ? 1 : 0) +
    (holder ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar title="Ус ашиглах гэрээ" activeCount={activeCount} onReset={reset}>
        {/*
          Хугацаа — эхэнд. Бусад шүүлтүүр нь "хэн, юу, хаана" гэдгийг
          заадаг бол энэ нь "хэзээ": өөр эрэмбийн зүйл тул мөрийн эхэнд
          тусад нь зогсоно.
        */}
        <FilterMenu
          label="Хугацаа"
          icon={CalendarRange}
          value={wholeRange || !range ? null : `${range[0]}–${range[1]}`}
          active={!wholeRange}
          onClear={() => setRange(limits)}
          width={252}
        >
          {limits && range ? (
            <YearRange min={limits[0]} max={limits[1]} value={range} onChange={setRange} />
          ) : null}
        </FilterMenu>

        <FilterMenu
          label="Салбар"
          icon={Factory}
          value={sector}
          active={Boolean(sector)}
          onClear={() => setSector(null)}
          width={264}
        >
          <PickList
            items={sectorData}
            selected={sector}
            onPick={setSector}
            format={(v) => `${num(Math.round(v))} м³`}
          />
        </FilterMenu>

        <FilterMenu
          label="Чиглэл"
          icon={Wrench}
          value={activity}
          active={Boolean(activity)}
          onClear={() => setActivity(null)}
          width={236}
        >
          <PickList
            items={activityData}
            selected={activity}
            onPick={setActivity}
            format={(v) => `${num(Math.round(v))} м³`}
          />
        </FilterMenu>

        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={230}
        >
          <PickList
            items={districtData}
            selected={district}
            onPick={setDistrict}
            format={(v) => `${num(Math.round(v))} м³`}
          />
        </FilterMenu>

        <FilterMenu
          label="Ус ашиглагч"
          icon={FileSignature}
          value={holder}
          active={Boolean(holder)}
          onClear={() => setHolder(null)}
          width={280}
        >
          <PickList
            items={holderData}
            selected={holder}
            onPick={setHolder}
            searchable
            format={(v) => `${num(Math.round(v))} м³`}
          />
        </FilterMenu>
      </FilterBar>

      {/* ============ ГОЛ СҮЛЖЭЭ ============ */}
      <div className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[272px_1fr_292px]">
        {/* ---- ЗҮҮН: газарзүй ба ус ашиглагч ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          {/* Дүүрэг ердөө 4–5 мөр тул өөрийнхөө зайг л эзэлнэ */}
          <Panel
            title="Дүүргээр"
            note="м³/жил"
            data={districtData}
            selected={district}
            onSelect={setDistrict}
          />
          <Panel
            title="Дүүргээр"
            note="гэрээний тоо"
            data={districtCount}
            selected={district}
            onSelect={setDistrict}
            format={num}
          />
          {/* Ус ашиглагч нь хамгийн урт жагсаалт — үлдсэн зайг аваад
              дотроо гүйнэ */}
          <Panel
            title="Ус ашиглаж буй байгууллага"
            note="м³/жил"
            data={holderData}
            selected={holder}
            onSelect={setHolder}
            grow
          />
        </div>

        {/* ---- ГОЛ: индикатор + газрын зураг ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          {/*
            Индикаторын зурвас. Нэг мөр, зураасаар тусгаарласан — тусдаа
            хайрцаг бүрийг хүрээлбэл дэлгэц хэсэгчилсэн харагдана.
          */}
          <div className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
            <div className="grid grid-cols-2 divide-x divide-y divide-line xl:grid-cols-4 xl:divide-y-0">
              <Indicator icon={FileSignature} label="Байгуулсан гэрээ" value={num(stats.n)} />
              <Indicator icon={Building2} label="Ус ашиглагч" value={num(stats.holders)} />
              <Indicator
                icon={Droplets}
                label="Нийт ашиглах ус, м³/жил"
                value={num(Math.round(stats.m3))}
              />
              <Indicator
                icon={Coins}
                label="Усны нөөцийн төлбөр, төгрөг"
                value={num(Math.round(stats.fee))}
              />
            </div>
          </div>

          <Box className="relative min-h-[320px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/* Цэг цөөхөн (10) тул бөөгнөрүүлэхгүй */}
              <WaterMap
                points={data.points}
                visible={visible}
                labels={labels}
                basemap={basemap}
                onSelect={(oid) => setPicked(picked === oid ? null : oid)}
                onHover={tip.onHover}
                highlight={highlight}
                focus={focus}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {/*
                ХӨВӨГЧ ТАЙЛБАР. Худгийнхаас агуулгаараа өөр: тэнд гол нь
                бүртгэлийн дугаар бол энд ХЭН гэдэг нь — гэрээ бүр нэртэй
                аж ахуйн нэгжийнх. Хэмжээ, тариф хоёр нь самбарын гол
                хэмжигдэхүүн тул тайлбар дээр ч зэрэгцэж гарна.
              */}
              {hovered ? (
                <MapTip state={tip} width={240}>
                  <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2 pb-1">
                    <span className="num text-[11px] leading-none font-medium text-data">
                      {hovered.permit}
                    </span>
                    <span className="num text-[11px] leading-none text-ink-3">
                      {hovered.permitYear ?? "—"}
                    </span>
                  </div>
                  <div className="px-2.5 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                    {hovered.holder}
                  </div>

                  <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                    <MapTipRow
                      icon={Droplets}
                      num
                      text={`${num(Math.round(hovered.m3))} м³/жил`}
                    />
                    <MapTipRow
                      icon={Coins}
                      num
                      text={`${unitFee(hovered).toFixed(1)} төг/м³`}
                    />
                    <MapTipRow
                      icon={MapPin}
                      text={`${hovered.district} ${hovered.khoroo}`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3">
                      {hovered.activity}
                    </span>
                    <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                  </div>
                </MapTip>
              ) : null}

              {active ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[268px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="eyebrow mb-1.5">
                    {active.permit}
                    {active.permitYear ? ` · ${active.permitYear}` : ""}
                  </div>
                  <div className="text-[12.5px] leading-snug text-ink">{active.holder}</div>
                  <div className="num mt-1 text-[11.5px] text-ink-2">
                    {num(Math.round(active.m3))} м³/жил · {unitFee(active).toFixed(1)} төг/м³
                  </div>
                  <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                    {active.activity} · {active.district} {active.khoroo}
                  </div>
                  <div className="num mt-0.5 text-[10.5px] text-ink-3">
                    Гэрээ {active.signed} → {active.expires}
                  </div>
                </div>
              ) : null}
            </div>
          </Box>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS FeatureServer · {num(data.rows.length)} гэрээ ·
            бүгд газрын доорх уснаас
          </p>
        </div>

        {/* ---- БАРУУН: салбар, хугацаа, тариф ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Box className="shrink-0">
            <Head title="Салбараар">
              <span className="text-[11.5px] text-ink-3">м³/жил</span>
            </Head>
            <div className="p-3">
              <RowChart
                data={sectorData}
                selected={sector}
                onSelect={setSector}
                format={(v) => num(Math.round(v))}
              />
            </div>
          </Box>

          <Box className="shrink-0">
            <Head title="Зөвшөөрөл олгосон он">
              <span className="num text-[11.5px] text-ink-3">
                {yearData.length ? `/${yearData[0].key} - ${yearData.at(-1)!.key}/` : "—"}
              </span>
            </Head>
            <div className="p-3">
              {/*
                Он дээр товшихад муж нь ТЭР ОН дээр хумигдана — газрын
                зураг, индикатор, бусад диаграм бүгд дагаж шүүгдэнэ.
                Сонгосон он дээр дахин товшвол бүтэн хугацаа руу буцна.
              */}
              <AreaChart
                data={yearData}
                height={82}
                unit="зөвшөөрөл"
                selected={range && range[0] === range[1] ? String(range[0]) : null}
                onSelect={(k) => setRange(k ? [Number(k), Number(k)] : limits)}
              />
            </div>
          </Box>

          {/* Мөрийн СҮҮЛД нь уян карт — үлдсэн зайг энэ эзэлнэ */}
          <Box className="min-h-[140px] flex-1">
            <Head title="Нэгж тариф">
              <span className="text-[11.5px] text-ink-3">төг/м³</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <RowChart
                data={feeData}
                base={feeMin * 0.9}
                selected={holder}
                onSelect={setHolder}
                format={(v) => v.toFixed(1)}
              />
            </div>
          </Box>
        </div>
      </div>
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
  note: string;
  data: Datum[];
  selected: string | null;
  onSelect: (k: string | null) => void;
  /** Утгын бичиглэл — өгөөгүй бол м³ шиг бүхэл тоо */
  format?: (v: number) => string;
  /** Үлдсэн зайг эзэлж, дотроо гүйх эсэх */
  grow?: boolean;
}) {
  return (
    <Box className={grow ? "min-h-[120px] flex-1" : "shrink-0"}>
      <Head title={title}>
        <span className="text-[11.5px] text-ink-3">{note}</span>
      </Head>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <RowChart
          data={data}
          selected={selected}
          onSelect={onSelect}
          format={format ?? ((v) => num(Math.round(v)))}
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
      <h2 className="display text-[13.5px] leading-none tracking-[0.06em] uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * Индикаторын нэгж нүд — худгийн самбартай ижил хэмжээ, өндөр.
 *
 * Бүх тоо нэг өнгөтэй (`ink`): гол утгыг accent-аар биш, байрлалаараа
 * (эхний нүд) ялгана.
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
