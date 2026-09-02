"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  LandPlot,
  Loader2,
  MapPin,
  MousePointerClick,
  PawPrint,
  ShieldAlert,
  Skull,
  Sparkles,
  Sprout,
  X,
  type LucideIcon,
} from "lucide-react";
import { AreaChart, PieChart, RowChart, YearRange, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { fetchRescues, type Rescue } from "@/lib/rescues";
import { speciesIconSvg } from "@/lib/species-icons";
import { speciesPhoto } from "@/lib/species-photos";
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

type Skip = "species" | "rarity" | "outcome" | "soum" | "year" | "month";

/**
 * Аврагдсан амьтдын бүртгэл 2019–2026.
 *
 * Дуудлагын самбараас ЗОРИУДААР ӨӨР бүтэцтэй — хоёулаа нэг хэлтсийн, нэг
 * сэдвийн самбар тул ялгаагүй харагдвал хүн аль нь болохыг андуурна:
 *  · гурав биш ХОЁР багана;
 *  · жилийн цуваа (энэ бүртгэлийн гол шинж — 8 жилийн түүх);
 *  · ховордол, шийдвэрлэлтийн задаргаа — дуудлагын самбарт байхгүй хэмжүүр;
 *  · хугацааг хоёр үзүүрт мужаар шүүнэ.
 */
export function RescuesDashboard() {
  const [rows, setRows] = React.useState<Rescue[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [species, setSpecies] = React.useState<string | null>(null);
  const [rarity, setRarity] = React.useState<string | null>(null);
  const [outcome, setOutcome] = React.useState<string | null>(null);
  const [soum, setSoum] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState<string | null>(null);
  /*
    Хугацаа нь МУЖ хэлбэрээр. "Он" шүүлтүүр нь тусдаа төлөв БИШ — тэр нь
    мужийг [он, он] болгож хумидаг товчлол. Хоёр тусдаа оны шүүлтүүр байвал
    хоорондоо зөрчилдөж, аль нь давамгайлахыг хэрэглэгч таахад хүрнэ.
  */
  const [range, setRange] = React.useState<[number, number] | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());
  const [extentOn, setExtentOn] = React.useState(false);
  const [extent, setExtent] = React.useState<Extent | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  /** Дэлгэрэнгүй цонхны хэмжээ — хэрэглэгч чирж өөрчилнө */
  const [card, setCard] = React.useState<CardSize>({ w: 300, h: 360 });

  React.useEffect(() => {
    const ac = new AbortController();
    fetchRescues(ac.signal)
      .then((list) => {
        setRows(list);
        const years = list.map((r) => r.year).filter(Boolean);
        if (years.length) setRange([Math.min(...years), Math.max(...years)]);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, []);

  /*
    oid → газрын зургийн тэмдэглэгээ. Эхний сонголт нь ХЭЛТСЭЭС ирсэн
    зүйлийн гэрэл зураг; тэр олдоогүй зүйлд зурсан тэмдэг рүү шилжинэ.

    Зүйл давтагддаг (697 бичлэгт ~100 зүйл) тул нэрээр нь кэшлэнэ.
  */
  const markByOid = React.useMemo(() => {
    const cache = new Map<string, string>();
    const out: Record<number, string> = {};
    for (const r of rows ?? []) {
      const key = `${r.species}|${r.latin}`;
      let mark = cache.get(key);
      if (!mark) {
        mark = speciesPhoto(r.species, r.latin) ?? speciesIconSvg(r.species);
        cache.set(key, mark);
      }
      out[r.oid] = mark;
    }
    return out;
  }, [rows]);

  /** Датаны хамрах хугацаа — шүүлтүүрийн хязгаар, "бүх хугацаа" гэдгийн жишиг */
  const span = React.useMemo<[number, number] | null>(() => {
    if (!rows) return null;
    const years = rows.map((r) => r.year).filter(Boolean);
    if (!years.length) return null;
    return [Math.min(...years), Math.max(...years)];
  }, [rows]);

  const selectBase = React.useCallback(
    (skip?: Skip) => {
      if (!rows) return new Uint32Array(0);
      const out = new Uint32Array(rows.length);
      let k = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (skip !== "species" && species && r.species !== species) continue;
        if (skip !== "rarity" && rarity && r.rarity !== rarity) continue;
        if (skip !== "outcome" && outcome && r.outcome !== outcome) continue;
        if (skip !== "soum" && soum && r.soum !== soum) continue;
        if (skip !== "year" && range && (r.year < range[0] || r.year > range[1])) continue;
        if (skip !== "month" && month && String(r.month) !== month) continue;
        out[k++] = i;
      }
      return out.subarray(0, k);
    },
    [rows, species, rarity, outcome, soum, range, month],
  );

  const select = React.useCallback(
    (skip?: Skip) => {
      const idx = selectBase(skip);
      if (!extent || !rows) return idx;
      const [w, s, e, n] = extent;
      const wide = e - w >= 360;
      const out = new Uint32Array(idx.length);
      let k = 0;
      for (let j = 0; j < idx.length; j++) {
        const r = rows[idx[j]];
        if (r.lat < s || r.lat > n) continue;
        if (!wide && (w <= e ? r.lon < w || r.lon > e : r.lon < w && r.lon > e)) continue;
        out[k++] = idx[j];
      }
      return out.subarray(0, k);
    },
    [selectBase, extent, rows],
  );

  const mapIdx = React.useMemo(() => selectBase(), [selectBase]);
  const shown = React.useMemo(() => select(), [select]);

  const points = React.useMemo(() => {
    const src = rows ?? [];
    return {
      oid: src.map((r) => r.oid),
      lon: src.map((r) => r.lon),
      lat: src.map((r) => r.lat),
    };
  }, [rows]);

  /*
    Цэгийн шошго — зүйлийн монгол нэр.

    Цэг нь зурсан тэмдэг эсвэл зурагтай (`marks`, `photos`) боловч
    тэдгээрээс аль зүйл болохыг таахад хэцүү — нэр нь баталгаа болно.
    Бөөгнөрөл задарсан үед (z10) гарна.
  */
  const labels = React.useMemo(() => {
    if (!rows) return undefined;
    return { text: rows.map((r) => r.species), minzoom: 10 };
  }, [rows]);

  const tally = React.useCallback(
    (of: (r: Rescue) => string | null, skip: Skip): Datum[] => {
      if (!rows) return [];
      const idx = select(skip);
      const counts = new Map<string, number>();
      for (let k = 0; k < idx.length; k++) {
        const key = of(rows[idx[k]]);
        if (key == null) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, label: key, value }));
    },
    [rows, select],
  );

  const speciesData = React.useMemo(() => tally((r) => r.species, "species"), [tally]);
  const rarityData = React.useMemo(() => tally((r) => r.rarity, "rarity"), [tally]);
  const outcomeData = React.useMemo(() => tally((r) => r.outcome, "outcome"), [tally]);
  const soumData = React.useMemo(() => tally((r) => r.soum, "soum"), [tally]);

  /** Оны зурвас — цоорхой жилийг ч харуулна (тэг утга нь ч мэдээлэл) */
  const yearData = React.useMemo<Datum[]>(() => {
    if (!rows || !span) return [];
    const idx = select("year");
    const counts = new Map<number, number>();
    for (let k = 0; k < idx.length; k++) {
      const y = rows[idx[k]].year;
      if (y) counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    const out: Datum[] = [];
    for (let y = span[0]; y <= span[1]; y++) {
      out.push({ key: String(y), label: String(y), value: counts.get(y) ?? 0 });
    }
    return out;
  }, [rows, span, select]);

  const monthData = React.useMemo<Datum[]>(() => {
    if (!rows) return [];
    const idx = select("month");
    const counts = new Array(12).fill(0);
    for (let k = 0; k < idx.length; k++) {
      const m = rows[idx[k]].month;
      if (m >= 1 && m <= 12) counts[m - 1]++;
    }
    return counts.map((v, i) => ({ key: String(i + 1), label: `${i + 1}-р сар`, value: v }));
  }, [rows, select]);

  const stats = React.useMemo(() => {
    if (!rows) return null;
    const kinds = new Set<string>();
    let rare = 0;
    let released = 0;
    let died = 0;
    for (let k = 0; k < shown.length; k++) {
      const r = rows[shown[k]];
      kinds.add(r.species);
      if (r.rarity === "Ховор") rare++;
      if (r.outcome === "Байгальд тавьсан") released++;
      if (r.outcome === "Хорогдсон") died++;
    }
    return { total: shown.length, kinds: kinds.size, rare, released, died };
  }, [rows, shown]);

  const focus = React.useMemo<Extent | null>(() => {
    /* ЯМАР Ч шүүлтүүр тавихад тэр сонголт руугаа ойртоно */
    if (!rows || (!soum && !species && !rarity && !outcome && !month)) return null;
    const idx = selectBase();
    if (idx.length === 0) return null;
    let w = 180;
    let s = 90;
    let e = -180;
    let n = -90;
    for (let k = 0; k < idx.length; k++) {
      const r = rows[idx[k]];
      w = Math.min(w, r.lon);
      e = Math.max(e, r.lon);
      s = Math.min(s, r.lat);
      n = Math.max(n, r.lat);
    }
    return [w, s, e, n];
  }, [rows, selectBase, soum, species, rarity, outcome, month]);

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  /*
    Хулгана дээр очсон бүртгэл. Зурган тэмдэглэгээ дээр очиход байрлалыг
    ТЭМДГИЙН БАЙРШЛААС тооцдог тул тайлбар нь тэмдгийнхээ хажууд тогтоно.

    Дэлгэрэнгүй бичилт (баруун доор, товшилтоор) нь зурагтай, чирж
    томруулдаг цонх — энэ нь зөвхөн таних гурван мөр.
  */
  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (rows?.find((x) => x.oid === tip.oid) ?? null)),
    [rows, tip.oid],
  );

  /** Тодруулах цэгийн байрлал — зураг дээрх цагираг */
  const highlight = React.useMemo<[number, number] | null>(
    () => (hovered ? [hovered.lon, hovered.lat] : null),
    [hovered],
  );

  const detail = React.useMemo(() => {
    if (selected == null) return null;
    const r = rows?.find((x) => x.oid === selected);
    if (!r) return null;
    return { ...r, photo: speciesPhoto(r.species, r.latin, "lg") };
  }, [rows, selected]);

  /** Муж нь бүтэн хамрах хугацаагаа эзэлж байвал шүүлтүүр тавиагүйтэй адил */
  const wholeRange =
    !span || !range || (range[0] === span[0] && range[1] === span[1]);
  /** Муж нэг жил дээр хумигдсан бол тэр он — "Он" шүүлтүүрийн утга */
  const singleYear = range && range[0] === range[1] ? String(range[0]) : null;

  const activeCount =
    (species ? 1 : 0) +
    (rarity ? 1 : 0) +
    (outcome ? 1 : 0) +
    (soum ? 1 : 0) +
    (wholeRange ? 0 : 1) +
    (month ? 1 : 0) +
    (extentOn ? 1 : 0);

  function clearRange() {
    setRange(span);
  }

  function reset() {
    setSpecies(null);
    setRarity(null);
    setOutcome(null);
    setSoum(null);
    setRange(span);
    setMonth(null);
    setExtentOn(false);
    setExtent(null);
  }

  if (error || !rows || !stats || !span || !range) {
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
            Аврагдсан амьтдын бүртгэл татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar title="Аврагдсан амьтад" activeCount={activeCount} onReset={reset}>
        {/*
          Хугацаа — хоёр үзүүрт муж. Доорх "Он" нь үүний товчлол: нэг жил
          сонгоход мужийг [он, он] болгож хумина.
        */}
        <FilterMenu
          label="Хугацаа"
          icon={CalendarRange}
          value={wholeRange ? null : `${range[0]}–${range[1]}`}
          active={!wholeRange}
          onClear={clearRange}
          width={252}
        >
          <YearRange
            min={span[0]}
            max={span[1]}
            value={range}
            onChange={setRange}
          />
        </FilterMenu>

        <FilterMenu
          label="Зүйл"
          icon={PawPrint}
          value={species}
          active={Boolean(species)}
          onClear={() => setSpecies(null)}
          width={300}
        >
          <PickList items={speciesData} selected={species} onPick={setSpecies} searchable />
        </FilterMenu>

        <FilterMenu
          label="Ховордол"
          icon={ShieldAlert}
          value={rarity}
          active={Boolean(rarity)}
          onClear={() => setRarity(null)}
          width={190}
        >
          <PickList items={rarityData} selected={rarity} onPick={setRarity} />
        </FilterMenu>

        <FilterMenu
          label="Шийдвэрлэлт"
          icon={Sparkles}
          value={outcome}
          active={Boolean(outcome)}
          onClear={() => setOutcome(null)}
          width={260}
        >
          <PickList items={outcomeData} selected={outcome} onPick={setOutcome} />
        </FilterMenu>

        <FilterMenu
          label="Сум, дүүрэг"
          icon={LandPlot}
          value={soum}
          active={Boolean(soum)}
          onClear={() => setSoum(null)}
        >
          <PickList items={soumData} selected={soum} onPick={setSoum} searchable />
        </FilterMenu>

        <FilterMenu
          label="Он"
          icon={CalendarRange}
          value={singleYear}
          active={Boolean(singleYear)}
          onClear={clearRange}
          width={170}
        >
          <PickList
            items={yearData}
            selected={singleYear}
            onPick={(k) => setRange(k ? [Number(k), Number(k)] : span)}
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
          <PickList items={monthData} selected={month} onPick={setMonth} />
        </FilterMenu>
      </FilterBar>

      {/* ХОЁР багана — дуудлагын самбарын гурваас ялгарна */}
      <Columns id="rescues" right={360} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: тоо → зураг → хүснэгт ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          {/*
            Нэг МӨР: зүүнд зүйлийн жагсаалт БҮТЭН ӨНДРӨӨР, баруунд
            индикатор ба газрын зураг. Жагсаалт нь индикаторын ДООР биш
            ХАЖУУД нь эхэлнэ — 120 мөртэй жагсаалтад өндөр хэрэгтэй
            бөгөөд индикаторын зурвас түүнээс 60px хулгайлах учиргүй.
            Зүйл сонгоход зураг тэр зүйлийн цэгүүд рүү шүүгддэг тул
            хоёулаа зэрэгцэж байх нь ойлгомжтой. xl-ээс доош унавал
            мөр нь багана болно.
          */}
          <Columns layout="flex" id="rescues-list" left={300} className="min-h-0 flex-1">
            <Card className="min-h-[130px] flex-1 xl:w-(--col-l) xl:flex-none">
              <Head title="Зүйлээр">
                <span className="num text-[11.5px] text-ink-3">{speciesData.length}</span>
              </Head>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart data={speciesData} selected={species} onSelect={setSpecies} />
              </div>
            </Card>

            <div className="flex min-h-0 flex-1 flex-col gap-2.5">
              {/*
                Индикатор. Өргөн баганад орсон тул нүднүүд нь хажуу
                хажуугаа эгнэнэ — босоо жагсаалт энд хагас хоосон
                зурвас болно.
              */}
              <Card className="shrink-0">
                <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">
                  <StatCell icon={ClipboardList} label="Нийт бүртгэл" value={stats.total} />
                  <StatCell icon={PawPrint} label="Амьтны зүйл" value={stats.kinds} />
                  <StatCell icon={ShieldAlert} label="Ховор зүйл" value={stats.rare} />
                  <StatCell icon={Sprout} label="Байгальд тавьсан" value={stats.released} />
                  <StatCell icon={Skull} label="Хорогдсон" value={stats.died} />
                </div>
              </Card>

              <Card className="relative min-h-[240px] flex-1 overflow-hidden">
                <div className="relative h-full w-full">
                  {/*
                    Бөөгнөрөл ХЭРЭГТЭЙ — 697 цэгийн 99% нь Улаанбаатарт өтгөрсөн.
                    Гэхдээ тоо нь дугуйн дотор БИШ, баруун дээд буланд тэмдэг
                    болж суух тул дугуйн дотор чөлөөтэй үлдэж, доорх суурь зураг
                    харагдана. Худгийн самбарынхаас ингэж ялгарна.
                  */}
                  <PointMap
                    points={points}
                    labels={labels}
                    visible={mapIdx}
                    basemap={basemap}
                    onSelect={setSelected}
                    onHover={tip.onHover}
                    highlight={highlight}
                    extent={extentOn}
                    onExtent={setExtent}
                    focus={focus}
                    clusterLabel="badge"
                    marks={markByOid}
                  />
                  <BasemapGallery
                    value={basemap}
                    onChange={setBasemap}
                    extent={extentOn}
                    onExtentChange={setExtentOn}
                    unit="бүртгэл"
                  />
                  {extentOn ? (
                    <div className="pointer-events-none absolute inset-0 z-10 border border-data/45" />
                  ) : null}

                  {/*
                    ХӨВӨГЧ ТАЙЛБАР — тэмдэглэгээний хажууд. Ховордлын
                    зэрэг нь энэ самбарын гол ангилал тул зүйлийн нэрийн
                    хажууд шууд гарна.
                  */}
                  {hovered ? (
                    <MapTip state={tip} width={230}>
                      <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2 pb-1.5">
                        <span className="min-w-0 flex-1 text-[12.5px] leading-snug font-medium text-ink">
                          {hovered.species}
                        </span>
                        <span className="shrink-0 text-[10px] leading-none text-ink-3">
                          {hovered.rarity}
                        </span>
                      </div>

                      <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                        <MapTipRow
                          icon={CalendarDays}
                          num
                          text={`${hovered.year}.${String(hovered.month).padStart(2, "0")}`}
                        />
                        <MapTipRow
                          icon={MapPin}
                          text={[hovered.aimag, hovered.soum].filter(Boolean).join(", ")}
                        />
                        <MapTipRow icon={Sprout} text={hovered.outcome} />
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3 italic">
                          {hovered.latin}
                        </span>
                        <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                      </div>
                    </MapTip>
                  ) : null}

                  {detail ? (
                    /*
                      Хэмжээ нь чирэгддэг: булангийн бариулаас барьж томруулна.
                      Өндөр нь агуулгадаа таарч авто сунах бөгөөд зөвхөн заасан
                      дээд хэмжээнээс хэтрэхэд л гүйлт асна — богино бичилт дээр
                      хагас хоосон цонх, урт бичилт дээр таслагдсан бичвэр
                      хоёуланг нь зайлсхийнэ.
                    */
                    <div
                      className="absolute right-2.5 bottom-8 z-10 flex flex-col rounded-xs border border-line bg-paper/92 backdrop-blur-md"
                      style={{ width: card.w, maxHeight: card.h }}
                    >
                      <ResizeGrip value={card} onChange={setCard} />

                      <div className="flex shrink-0 items-center justify-between border-b border-line px-2.5 py-1.5">
                        <span className="eyebrow">Бүртгэлийн бичилт</span>
                        <button
                          onClick={() => setSelected(null)}
                          className="text-ink-3 transition-colors hover:text-ink"
                          aria-label="Хаах"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                        {/*
                          Зүйлийн зураг — хэлтсийн жагсаалтаас. Бичлэгийн өөрийн
                          гэрчилгээ БИШ тул "зүйлийн зураг" гэж тэмдэглэв.

                          ТОМ хувилбарыг дуудна: газрын зургийн 128px тэмдэг энд
                          сунаж бүдэрнэ. Энэ зураг зөвхөн цонх нээгдэхэд татагдана.
                        */}
                        {detail.photo ? (
                          <figure className="mb-2.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={detail.photo}
                              alt={detail.species}
                              /* Өргөнөө дагаж өндөр нь 2:3 харьцаагаар өснө */
                              className="block aspect-[3/2] w-full rounded-xs border border-line object-cover"
                            />
                            <figcaption className="mt-1 text-[10px] text-ink-3">
                              Зүйлийн зураг
                            </figcaption>
                          </figure>
                        ) : null}

                        <dl className="space-y-1.5">
                          <Field k="Амьтны зүйл" v={detail.species} />
                          {detail.latin ? (
                            <Field k="Латин нэр" v={<i className="text-ink-2">{detail.latin}</i>} />
                          ) : null}
                          <Field k="Ховордлын зэрэг" v={detail.rarity} />
                          <Field k="Огноо" v={<span className="num">{dayLabel(detail)}</span>} />
                          <Field k="Байршил" v={`${detail.aimag}, ${detail.soum}`} />
                          {detail.situation ? (
                            <Field k="Нөхцөл байдал" v={detail.situation} />
                          ) : null}
                          {/*
                            Бүлэглэсэн ангилал БА эх бичвэр хоёулаа. Ангилал нь
                            зөвхөн харуулах давхарга — бүртгэсэн үгийг нуухгүй.
                          */}
                          <Field k="Шийдвэрлэлт" v={detail.outcome} />
                          {detail.outcomeRaw && detail.outcomeRaw !== detail.outcome ? (
                            <Field
                              k="Бүртгэсэн"
                              v={<span className="text-ink-2">{detail.outcomeRaw}</span>}
                            />
                          ) : null}
                        </dl>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </Columns>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS FeatureServer
          </p>
        </div>

        {/* ---- БАРУУН: хугацаа, ангилал ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Card className="shrink-0">
            <Head title="Жилийн цуваа">
              <span className="num text-[11.5px] text-ink-3">
                {yearData.length ? `${yearData[0].key}–${yearData.at(-1)!.key}` : "—"}
              </span>
            </Head>
            <div className="p-3">
              <AreaChart
                data={yearData}
                height={78}
                selected={singleYear}
                onSelect={(k) => setRange(k ? [Number(k), Number(k)] : span)}
                unit="бүртгэл"
              />
            </div>
          </Card>

          {/*
            Хоёрхон ангилалтай тул бөгж: хэсэг бүрийн ЭЗЛЭХ ХУВЬ нь энд гол
            утга (17 ховор / 680 элбэг). Мөрөн диаграм дээр 2 мөр нь харьцааг
            биш, зөвхөн хоёр тоог харуулна.
          */}
          <Card className="shrink-0">
            <Head title="Ховордлын зэргээр" />
            <div className="p-3">
              <PieChart data={rarityData} selected={rarity} onSelect={setRarity} />
            </div>
          </Card>

          <Card className="min-h-[130px] flex-1">
            <Head title="Шийдвэрлэлтээр">
              <span className="text-[11.5px] text-ink-3">бүлэглэсэн ангилал</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <RowChart data={outcomeData} selected={outcome} onSelect={setOutcome} />
            </div>
          </Card>
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Дэлгэрэнгүй цонхны хэмжээ чирэх бариул.

   Цонх нь баруун доод буланд НААЛДСАН тул бариул нь ЗҮҮН ДЭЭД буланд байна:
   тийш чирэхэд цонх ургана. Баруун доод булангаас чирвэл цонх газрын
   зургаас гарах байсан.
   -------------------------------------------------------------------------- */

type CardSize = { w: number; h: number };

const CARD_MIN = { w: 240, h: 180 };
const CARD_MAX = { w: 560, h: 560 };

function ResizeGrip({
  value,
  onChange,
}: {
  value: CardSize;
  onChange: (v: CardSize) => void;
}) {
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const { w, h } = value;

    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    // Зүүн дээш чирэх нь ӨСГӨНӨ — тиймээс тэмдэг нь эсрэг
    const move = (ev: PointerEvent) =>
      onChange({
        w: clamp(w - (ev.clientX - x0), CARD_MIN.w, CARD_MAX.w),
        h: clamp(h - (ev.clientY - y0), CARD_MIN.h, CARD_MAX.h),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange({ w: 300, h: 360 })}
      role="separator"
      aria-label="Цонхны хэмжээ"
      title="Чирж хэмжээг өөрчилнө · давхар товшилт: анхны хэмжээ"
      className="group absolute -top-1 -left-1 z-10 size-4 cursor-nwse-resize"
    >
      <span
        aria-hidden
        className="absolute top-1 left-1 size-2 border-t border-l border-line-2 transition-colors group-hover:border-data"
      />
    </div>
  );
}

/** Огноо: `Дуудлага өгсөн` талбар хоосон бол он/сар/өдрөөс угсарна */
function dayLabel(r: Rescue) {
  if (r.date) {
    const d = new Date(r.date);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }
  if (!r.year) return "—";
  return `${r.year}.${String(r.month || 0).padStart(2, "0")}`;
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

/**
 * Индикаторын нэгж нүд. Гарчгийн талбайд хоёр мөрийн зай нөөцөлж,
 * зэрэгцээ нүднүүдийн тоо бүгд нэг шугам дээр таарна. Икон нь чимэглэл
 * биш — ижил хэмжээний саарал гарчгуудыг нүдээр ялгах хэрэгсэл.
 */
function StatCell({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col px-3 py-2">
      {/* Хоёр мөрийн зай нөөцөлсөн хэвээр, зөвхөн мөр хоорондын зай нягтарсан */}
      <span className="eyebrow block min-h-[28px] leading-[1.25]">{label}</span>
      <div className="mt-auto flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {num(value)}
        </span>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[92px] shrink-0 text-[10.5px] tracking-[0.08em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{v}</dd>
    </div>
  );
}
