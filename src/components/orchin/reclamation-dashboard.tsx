"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarRange,
  Coins,
  Loader2,
  MousePointerClick,
  Ruler,
  Sprout,
} from "lucide-react";
import { AreaChart, RowChart, YearRange, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
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
import { fetchReclamation, FUNDING, type FundingId, type ReclamationSite } from "@/lib/reclamation";
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
 * Төсөвт өртгийн нэгж — МЯНГАН төгрөг. Хэлтсийн хэрэглэгч 2026-09-17-нд
 * баталгаажуулав ("120. Мянга"): талбарын нэр `төсөвт_өртөг_мян_төг`
 * зөв, утга нь эх сурвалжийн бичсэнээр. Хөрвүүлэхгүй.
 */
const COST_UNIT = "мянган төгрөг";

/**
 * Нөхөн сэргээлтийн самбар.
 *
 * Бичлэг маш цөөн (11 талбай) тул тархалтын диаграм утгагүй. Оронд нь
 * ЖАГСААЛТ давамгайлна: талбай бүр өөрөө нэг мөр, товшиход зураг тийш
 * ойртоно. Хэмжигдэхүүн нь тоо биш ТАЛБАЙ (га) — "хэдэн ажил хийсэн"
 * гэдгээс "хэдэн га сэргээсэн" нь чухал.
 *
 * ⚠⚠ ХОЁР ЭХ ҮҮСВЭР ХОЁР ХАЖУУД (хэрэглэгчийн шийдвэр, 2026-09-17:
 * "ААН болон нийслэлийг нэгтгэ — зургийн зүүн талд ААН, баруун талд
 * нийслэлийн мэдээлэл"). Урьд нь хоёр эх үүсвэр нэг жагсаалтад нийлж,
 * "Эх үүсвэр" шүүлтүүр ба бөгжөөр л салдаг байв. Одоо ЗҮҮН багана нь
 * аж ахуйн нэгжийн хөрөнгөөр, БАРУУН багана нь нийслэлийн төсвөөр
 * хийсэн ажил — тус бүр өөрийн жагсаалт, оны цуваа, байршлын
 * задаргаатай; газрын зураг дунд нь хоёуланг зэрэг зурна. Тиймээс эх
 * үүсвэрийн шүүлтүүр, бөгж ХОЁУЛАА хасагдсан — баганууд өөрсдөө тэр
 * ялгааг үүрнэ. Хугацаа, байршлын шүүлт хоёр баганад ЗЭРЭГ үйлчилнэ:
 * нэг талын диаграм дээр товшиход нөгөө тал ч дагаж хумигдана.
 */
export function ReclamationDashboard() {
  const [sites, setSites] = React.useState<ReclamationSite[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /*
    Хугацаа нь МУЖ хэлбэрээр. "Он" шүүлтүүр нь тусдаа төлөв БИШ — тэр нь
    мужийг [он, он] болгож хумидаг товчлол. Хоёр тусдаа оны шүүлтүүр
    байвал хоорондоо зөрчилдөж, аль нь давамгайлахыг хэрэглэгч таахад
    хүрнэ.
  */
  const [range, setRange] = React.useState<[number, number] | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);
  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  React.useEffect(() => {
    let alive = true;
    fetchReclamation()
      .then((s) => {
        if (!alive) return;
        setSites(s);
        const ys = s.map((x) => x.year).filter(Boolean);
        if (ys.length) setRange([Math.min(...ys), Math.max(...ys)]);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const keep = React.useCallback(
    (s: ReclamationSite, skip?: "year" | "district") => {
      if (skip !== "year" && range && (s.year < range[0] || s.year > range[1])) return false;
      if (skip !== "district" && district && s.district !== district) return false;
      return true;
    },
    [range, district],
  );

  const shown = React.useMemo(
    () => (sites ?? []).filter((s) => keep(s)),
    [sites, keep],
  );

  /** Датаны хамрах хугацаа — шүүлтүүрийн хязгаар, "бүх хугацаа"-ны жишиг */
  const span = React.useMemo<[number, number] | null>(() => {
    const ys = (sites ?? []).map((x) => x.year).filter(Boolean);
    if (!ys.length) return null;
    return [Math.min(...ys), Math.max(...ys)];
  }, [sites]);

  /** Муж нь датаны бүх хугацааг хамарч байвал шүүлт хийгээгүйтэй адил */
  const wholeRange =
    !span || !range || (range[0] === span[0] && range[1] === span[1]);

  /* ---------------- Газрын зураг ----------------
     ⚠ СОНГОСОН ТАЛБАЙ ГАНЦААРАА ХАРАГДАНА (хэрэглэгчийн шийдвэр,
     2026-09-17: "Багахангай дээр дарахад бусад талбай зураг дээр
     харагдахгүй"). Сонголт нь зөвхөн ойртолт биш ШҮҮЛТ: жагсаалт,
     диаграм бүтнээрээ үлдэж (буцаж сонгох зам), зураг зөвхөн сонгосон
     талбайг зурна. Дахин товшиход бүгд эргэж гарна. */
  const mapped = React.useMemo(
    () => (picked == null ? shown : shown.filter((s) => s.oid === picked)),
    [shown, picked],
  );

  const geo = React.useMemo<MapPoints>(() => {
    const oid = mapped.map((s) => s.oid);
    return {
      oid,
      lon: mapped.map((s) => s.lon),
      lat: mapped.map((s) => s.lat),
    };
  }, [mapped]);

  const visible = React.useMemo(
    () => Uint32Array.from(mapped.map((_, i) => i)),
    [mapped],
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
      features: mapped
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
    [mapped],
  );

  /* ---------------- Задаргаа ----------------
     Хэмжигдэхүүн нь БҮГД га — тоо ширхэг биш талбай харьцуулагдана.
     Эх үүсвэр ТУС БҮРД тусдаа тооцно: хоёр багана хоёр өөр бүртгэл. */
  const sides = React.useMemo(
    () => FUNDING.map((f) => sideOf(f.id, sites ?? [], keep)),
    [sites, keep],
  );

  /** Шүүлтүүрийн цэсэнд — хоёр эх үүсвэрийн байршил НЭГ жагсаалтад */
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
    if (picked == null && wholeRange && !district) return null;
    const b = new Bounds();
    for (const site of picked != null ? shown.filter((s) => s.oid === picked) : shown) {
      if (site.rings.length) {
        for (const ring of site.rings) for (const [x, y] of ring) b.add(x, y);
      } else b.add(site.lon, site.lat);
    }
    return b.get(0.003);
  }, [shown, picked, wholeRange, district]);

  /** Хулгана дээр очсон талбай — газрын зурагнаас */
  const hovered = React.useMemo(
    () => (tip.oid == null ? null : ((sites ?? []).find((s) => s.oid === tip.oid) ?? null)),
    [sites, tip.oid],
  );

  /* Тогтмол самбар: товшсон, эсвэл ЖАГСААЛТЫН мөр дээр очсон талбай */
  const active = React.useMemo(
    () => (sites ?? []).find((s) => s.oid === (hover ?? picked)) ?? null,
    [sites, hover, picked],
  );

  function clearRange() {
    setRange(span);
  }

  function reset() {
    setRange(span);
    setDistrict(null);
    setPicked(null);
  }

  if (error || !sites) {
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
            Нөхөн сэргээлтийн мэдээ татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount = (wholeRange ? 0 : 1) + (district ? 1 : 0);
  const [aan, tusuw] = sides;
  const sideProps = {
    picked,
    onPick: (oid: number) => setPicked(picked === oid ? null : oid),
    onHover: setHover,
    range,
    span,
    onRange: setRange,
    district,
    onDistrict: setDistrict,
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar title="НӨХӨН СЭРГЭЭЛТ" activeCount={activeCount} onReset={reset}>
        {/*
          Хугацаа — хоёр үзүүрт муж. Оны диаграм дээр товшихад мужийг
          [он, он] болгож хумина: нэг жил сонгох нь мужийн ТУСГАЙ
          тохиолдол болохоос тусдаа шүүлтүүр биш.
        */}
        <FilterMenu
          label="Хугацаа"
          icon={CalendarRange}
          value={wholeRange || !range ? null : `${range[0]}–${range[1]}`}
          active={!wholeRange}
          onClear={clearRange}
          width={252}
        >
          {span && range ? (
            <YearRange min={span[0]} max={span[1]} value={range} onChange={setRange} />
          ) : null}
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
        Нэг МӨР, гурван хэсэг: ЗҮҮНД аж ахуйн нэгжийн хөрөнгөөр хийсэн
        ажил, ДУНД газрын зураг (уян, хоёр эх үүсвэрийг зэрэг зурна),
        БАРУУНД нийслэлийн төсвөөр хийсэн ажил. Хоёр хажуу ИЖИЛ
        бүтэцтэй (`Side`): жагсаалт → оноор → байршлаар — ижил хэлбэр нь
        хоёр бүртгэлийг шууд харьцуулуулна. xl-ээс доош унавал мөр нь
        багана болно.

        Индикатор нь ЗӨВХӨН газрын зургийн дээр, хоёр эх үүсвэрийн
        НИЙЛБЭР (хэрэглэгчийн шийдвэр, 2026-09-17); эх үүсвэр тус бүрийн
        тоо нь баганынхаа толгойд.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <Columns layout="flex" id="reclamation-2" left={320} right={320} className="min-h-0 flex-1">
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-(--col-l) xl:shrink-0">
            <Side side={aan} {...sideProps} />
          </div>

          {/*
            ⚠ `min-w-0` ЗААВАЛ: flex мөрөнд дунд багана өөрийн агуулгын
            хамгийн нарийн өргөнөөс доош хумигддаггүй. Дөрвөн индикатор
            `max-content`-оор ~900px нэхэж, хоёр хажуугийн 320px-тэй
            нийлээд мөр хальж, баруун багана дэлгэцээс гадагш түлхэгдэж
            бариул нь ажиллахгүй мэт болж байв (хэрэглэгч 2026-09-17:
            "баруун панелийн resize янзал").
          */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
            {/* Индикатор ЗӨВХӨН газрын зургийн дээр — хажуугийн баганад ч, бүтэн өргөнөөр ч биш (хэрэглэгчийн шийдвэр, 2026-09-17) */}
            <Card className="shrink-0">
              {/* Хоёр хажуу багана дундыг шахдаг тул шошго МӨР ШИЛЖИНЭ —
                  `max-content` баганууд энд багтахгүй */}
              <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-[repeat(4,minmax(0,1fr))] sm:divide-y-0">
                <Stat icon={Sprout} label="Талбай" value={num(stats.n)} />
                <Stat icon={Ruler} label="Нөхөн сэргээсэн талбай, га" value={stats.ha.toFixed(1)} />
                <Stat icon={CalendarRange} label="Хамрах хугацаа" value={stats.span} />
                {/*
                  Төсөвт өртөг нь зөвхөн аж ахуйн нэгжийн хөрөнгөөр хэрэгжсэн ажлын бүртгэлд байна.
                  Нэгжийг нь ХӨРВҮҮЛЭХГҮЙ: талбарын нэр "мян_төг" гэсэн
                  боловч 2.6 га нөхөн сэргээлт 120 мянган төгрөг байх нь
                  эргэлзээтэй. Эх сурвалжийн бичсэнээр нь харуулж,
                  тодруулгыг хэлтсээс авна.
                */}
                <Stat
                  icon={Coins}
                  label={`Төсөвт өртөг, ${COST_UNIT}`}
                  value={stats.cost ? num(Math.round(stats.cost)) : "—"}
                />
              </div>
            </Card>

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
                  onHover={tip.onHover}
                  focus={focus}
                  cluster={false}
                />
                <BasemapGallery value={basemap} onChange={setBasemap} />
            
                {/*
                  ХӨВӨГЧ ТАЙЛБАР. Он ба талбай нь энэ самбарын хос гол
                  хэмжигдэхүүн (нэг талбай олон цэгээс бүрддэг тул мөрөөр
                  тоолохгүй, га-гаар л хэмжинэ) тул дээд мөрөнд зэрэгцэнэ.
                */}
                {hovered ? (
                  <MapTip state={tip} width={232}>
                    <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2 pb-1.5">
                      <span className="num text-[15px] leading-none font-medium text-data">
                        {hovered.ha}
                      </span>
                      <span className="num text-[11px] leading-none text-ink-3">
                        га · {hovered.year}
                      </span>
                    </div>
            
                    <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                      <MapTipRow icon={Sprout} text={hovered.place} />
                      <MapTipRow
                        icon={Coins}
                        text={FUNDING.find((f) => f.id === hovered.funding)?.label ?? "—"}
                      />
                      {hovered.contractor ? (
                        <MapTipRow icon={Building2} text={hovered.contractor} />
                      ) : null}
                    </div>
            
                    <div className="flex items-center justify-end border-t border-line px-2.5 py-1.5">
                      <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                    </div>
                  </MapTip>
                ) : null}
            
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
          </div>

          <div className="flex min-h-0 flex-col gap-2.5 xl:w-(--col-r) xl:shrink-0">
            <Side side={tusuw} {...sideProps} />
          </div>
        </Columns>

        <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
          Суурь зураг: Esri · Дата: ArcGIS · талбайн хүрээг булангийн цэгүүдээс
          сэргээв
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type SideData = {
  id: FundingId;
  label: string;
  /** Шүүлтүүрт таарсан талбайнууд */
  shown: ReclamationSite[];
  ha: number;
  byYear: Datum[];
  yearSeries: Datum[];
  byDistrict: Datum[];
  /**
   * Талбай тус бүрээр — дүүргээр НЭГТГЭХГҮЙ (хэрэглэгчийн шийдвэр,
   * 2026-09-17: "Багануур дээр 0.6 га, 2 га гэсэн хоёр талбай байгаа
   * тул ААН хөрөнгөөр салга"). ААН-ийн талбай цөөн тул мөр бүр нэг
   * талбай; товшилт нь тэр талбайг сонгоно, дүүргийн шүүлт тавихгүй.
   * Нэг байршилд хэд хэдэн талбай байвал оноор нь ялгана.
   */
  bySite: Datum[];
};

/** Нэг эх үүсвэрийн задаргаа — хоёр багана ижил тооцоог хуваалцана */
function sideOf(
  id: FundingId,
  sites: ReclamationSite[],
  keep: (s: ReclamationSite, skip?: "year" | "district") => boolean,
): SideData {
  const own = sites.filter((s) => s.funding === id);
  const shown = own.filter((s) => keep(s));

  const y = new Map<number, number>();
  for (const s of own) if (keep(s, "year")) y.set(s.year, (y.get(s.year) ?? 0) + s.ha);
  const byYear: Datum[] = [...y]
    .sort((a, b) => a[0] - b[0])
    .map(([k, ha]) => ({ key: String(k), label: String(k), value: ha }));

  /*
    Цагийн тэнхлэгт ХООСОН ЖИЛ ч суудалтай байх ёстой: бичлэггүй жилийг
    алгасвал хөрш жилүүд зэрэгцэж тасралтгүй цуваа мэт уншигдана;
    талбайт диаграм дээр бүр огт сэргээгээгүй жилээр дамжсан "жигд"
    налуу зурагдана. Сонголт нь эх `byYear`-аа хэрэглэнэ — хоосон жил
    сонгогдохгүй.
  */
  const yearSeries: Datum[] = [];
  if (byYear.length) {
    const have = new Map(byYear.map((d) => [Number(d.key), d.value]));
    const lo = Number(byYear[0].key);
    const hi = Number(byYear[byYear.length - 1].key);
    for (let k = lo; k <= hi; k++) {
      yearSeries.push({ key: String(k), label: String(k), value: have.get(k) ?? 0 });
    }
  }

  const d = new Map<string, number>();
  for (const s of own) if (keep(s, "district")) d.set(s.district, (d.get(s.district) ?? 0) + s.ha);
  const byDistrict: Datum[] = [...d]
    .map(([k, ha]) => ({ key: k, label: k, value: ha }))
    .sort((a, b) => b.value - a.value);

  const placeCount = new Map<string, number>();
  for (const s of shown) placeCount.set(s.place, (placeCount.get(s.place) ?? 0) + 1);
  const bySite: Datum[] = shown
    .map((s) => ({
      key: String(s.oid),
      label: (placeCount.get(s.place) ?? 0) > 1 ? `${s.place} · ${s.year}` : s.place,
      value: s.ha,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    id,
    label: FUNDING.find((f) => f.id === id)?.label ?? id,
    shown,
    ha: shown.reduce((a, s) => a + s.ha, 0),
    byYear,
    yearSeries,
    byDistrict,
    bySite,
  };
}

/**
 * Нэг эх үүсвэрийн багана: толгой (нэр, талбай, га) → жагсаалт → оноор
 * → байршлаар. Жагсаалтын мөр бүр зурган дээрх талбайтайгаа хосолдог
 * (hover, товшилт); диаграмын товшилт нь ХОЁР баганад зэрэг үйлчлэх
 * ерөнхий шүүлтүүрийг тавина.
 */
function Side({
  side,
  picked,
  onPick,
  onHover,
  range,
  span,
  onRange,
  district,
  onDistrict,
}: {
  side: SideData;
  picked: number | null;
  onPick: (oid: number) => void;
  onHover: (oid: number | null) => void;
  range: [number, number] | null;
  span: [number, number] | null;
  onRange: (r: [number, number] | null) => void;
  district: string | null;
  onDistrict: (d: string | null) => void;
}) {
  return (
    <>
      <Card className="min-h-[120px] flex-1">
        <Head title={side.label}>
          <span className="num shrink-0 text-[11.5px] text-ink-3">
            {num(side.shown.length)} талбай · {side.ha.toFixed(1)} га
          </span>
        </Head>
        <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {side.shown.map((s) => (
            <button
              key={s.oid}
              onClick={() => onPick(s.oid)}
              onMouseEnter={() => onHover(s.oid)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "block w-full px-3 py-2 text-left transition-colors hover:bg-paper-hi",
                picked === s.oid && "bg-paper-hi",
              )}
            >
              {side.id === "aan" ? <AanRow s={s} /> : (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] text-ink">{s.place}</span>
                    <span className="num shrink-0 text-[11.5px] text-ink-2">{s.ha} га</span>
                  </div>
                  <div className="num mt-1 flex items-center gap-1.5 text-[10.5px] text-ink-3">
                    <span>{s.year}</span>
                  </div>
                </>
              )}
            </button>
          ))}
          {side.shown.length === 0 ? (
            <div className="py-5 text-center text-[12px] text-ink-3">
              Шүүлтүүрт тохирох талбай бүртгэгдээгүй байна
            </div>
          ) : null}
        </div>
      </Card>

      {/*
        ААН талд оны диаграмын оронд ЦЭГЭН диаграм (хэрэглэгчийн санал,
        2026-09-17): хэвтээ — нөхөн сэргээсэн талбай (га), босоо — төсөвт
        өртөг. Талбай цөөн тул цэг бүр нэг талбай; товшилт нь тэр
        талбайг сонгоно.
      */}
      {side.id === "aan" ? (
        <Card className="shrink-0">
          <Head title="Талбай ба төсөвт өртөг">
            <span className="text-[10.5px] text-ink-3">га · {COST_UNIT}</span>
          </Head>
          <div className="p-3">
            <CostScatter sites={side.shown} picked={picked} onPick={onPick} />
          </div>
        </Card>
      ) : (
      <Card className="shrink-0">
        <Head title="Оноор">
          <span className="text-[10.5px] text-ink-3">га</span>
        </Head>
        <div className="p-3">
          {side.yearSeries.length ? (
            <AreaChart
              data={side.yearSeries}
              height={100}
              selected={range && range[0] === range[1] ? String(range[0]) : null}
              onSelect={(k) => {
                const y = Number(k);
                if (k && side.byYear.some((d) => d.key === k)) onRange([y, y]);
                else onRange(span);
              }}
              unit="га"
            />
          ) : (
            <div className="py-4 text-center text-[11.5px] text-ink-3">Мэдээлэл хүлээгдэж байна</div>
          )}
        </div>
      </Card>
      )}

      <Card className="shrink-0">
        <Head title="Байршлаар">
          <span className="text-[10.5px] text-ink-3">га</span>
        </Head>
        <div className="max-h-[220px] overflow-y-auto p-3">
          {side.id === "aan" ? (
            /* ААН: талбай тус бүр өөрийн мөртэй, товшилт талбайг сонгоно */
            <RowChart
              data={side.bySite}
              selected={picked == null ? null : String(picked)}
              onSelect={(k) => onPick(Number(k ?? picked))}
              format={(v) => v.toFixed(1)}
            />
          ) : (
            <RowChart
              data={side.byDistrict}
              selected={district}
              onSelect={onDistrict}
              format={(v) => v.toFixed(1)}
            />
          )}
        </div>
      </Card>

    </>
  );
}

/**
 * ААН-ийн талбайн мөр — ГҮЙЦЭТГЭГЧ тэргүүлнэ (хэрэглэгч 2026-09-17:
 * "илүү ойлгомжтой болго"). Урьд нь байршил тэргүүлж, он, гүйцэтгэгч,
 * өртөг нэг мөрөнд цэгээр залгагдсан тул Багануурын хоёр талбай
 * зөвхөн га-гаараа ялгагдах ижил хоёр мөр мэт харагдаж байв. ААН-ийн
 * хөрөнгөөр хийсэн ажлын субьект нь аж ахуйн нэгж тул нэр нь дээр,
 * байршил нь доор, хэмжээ ба өртөг нь ШОШГОТОЙГООР гурав дахь мөрөнд.
 */
function AanRow({ s }: { s: ReclamationSite }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-medium text-ink">
          {s.contractor ?? "Гүйцэтгэгч бүртгэгдээгүй"}
        </span>
        <span className="num shrink-0 text-[10.5px] text-ink-3">
          {s.no ? `№ ${s.no} · ` : ""}{s.year || "—"}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-2">
        <Building2 size={11} className="shrink-0 text-ink-3" />
        <span className="min-w-0 truncate">{s.place}</span>
      </div>
      <div className="num mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[10.5px]">
        <span>
          <span className="text-ink-3">Талбай </span>
          <span className="text-ink">{s.ha} га</span>
        </span>
        {s.cost ? (
          <span>
            <span className="text-ink-3">Төсөвт өртөг </span>
            <span className="text-ink">{num(Math.round(s.cost))} {COST_UNIT}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/** "Гоё" тэнхлэгийн алхам: 1 / 2 / 5 × 10ⁿ */
function niceStep(max: number, n: number): number {
  const raw = max / Math.max(n, 1);
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/**
 * Цэгэн диаграм: x — талбай (га), y — төсөвт өртөг. SVG-ээр гараар
 * (платформын дүрэм: гуравдагч сан нэмэхгүй).
 *
 * ⚠ ПИКСЕЛЭЭР зурна, `viewBox`-оор масштаблахгүй: эхний хувилбар
 * 320×170 хайрцгийг баганын өргөнд сунгадаг байсан тул үсэг, цэг
 * хамт томорч, бусад диаграмаас өөр "сонин" харагдаж байв (хэрэглэгч
 * 2026-09-17). Одоо өргөнөө `ResizeObserver`-оор хэмжиж, фонт 10px,
 * цэг 5px гэсэн бодит хэмжээгээр зурна — платформын бусад бичвэртэй
 * нэг хэмжээс.
 *
 * Цэг бүр НЭРТЭЙ: гуравхан цэг хоосон торонд нэргүй бол аль нь аль
 * талбай болох нь мэдэгдэхгүй. Баруун талд нь бичнэ, зургийн баруун
 * захад ойрхон бол зүүн талд; ижил өндөрт ойрхон хоёр цэг бол доод
 * нэрийг нэг мөрөөр доош шилжүүлнэ.
 */
function CostScatter({
  sites,
  picked,
  onPick,
}: {
  sites: ReclamationSite[];
  picked: number | null;
  onPick: (oid: number) => void;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const pts = sites.filter((s) => s.cost != null && s.ha > 0);

  const H = 190;
  /* Зүүн зай: босоо тэнхлэгийн нэр (эргүүлсэн) + хуваарийн тоо */
  const L = 56;
  const R = 12;
  const T = 14;
  const B = 28;

  const maxX = Math.max(...pts.map((s) => s.ha), 0);
  const maxY = Math.max(...pts.map((s) => s.cost ?? 0), 0);
  const sx = niceStep(maxX, 4);
  const sy = niceStep(maxY, 3);
  const topX = Math.ceil(maxX / sx) * sx || sx;
  const topY = Math.ceil(maxY / sy) * sy || sy;
  const xs: number[] = [];
  for (let v = 0; v <= topX + 1e-9; v += sx) xs.push(Number(v.toFixed(6)));
  const ys: number[] = [];
  for (let v = 0; v <= topY + 1e-9; v += sy) ys.push(Number(v.toFixed(6)));

  const X = (v: number) => L + (v / topX) * Math.max(W - L - R, 1);
  const Y = (v: number) => T + (1 - v / topY) * (H - T - B);

  /* Цэг дээр НЭР БИЧИХГҮЙ (хэрэглэгч 2026-09-17: "нэрээ ав") — нэр,
     хэмжээ, өртөг нь хулганы тайлбарт; аль талбай болох нь товшиход
     жагсаалт, зураг дээр тодорно. */
  const labels = pts.map((s) => ({ s, x: X(s.ha), y: Y(s.cost ?? 0) }));

  return (
    <div ref={box} className="w-full">
      {W > 0 && pts.length ? (
        <svg width={W} height={H} className="num block" role="img" aria-label="Талбай ба төсөвт өртөг">
          {ys.map((v) => (
            <g key={`y${v}`}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={L - 6} y={Y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--ink-3)">
                {num(v)}
              </text>
            </g>
          ))}
          {xs.map((v) => (
            <g key={`x${v}`}>
              <line x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke="var(--line)" strokeWidth={1} />
              <text x={X(v)} y={H - B + 13} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
                {v}
              </text>
            </g>
          ))}
          {/* Тэнхлэгийн нэр: хэвтээ нь тэнхлэгийнхээ голд, босоо нь
              тэнхлэгийн дагуу эргүүлж голлуулсан (хэрэглэгчийн хүсэлт) */}
          <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
            га
          </text>
          <text
            x={10}
            y={(T + H - B) / 2}
            textAnchor="middle"
            fontSize={10}
            fill="var(--ink-3)"
            transform={`rotate(-90 10 ${(T + H - B) / 2})`}
          >
            {COST_UNIT}
          </text>

          {[...labels]
            .sort((a, b) => (a.s.oid === picked ? 1 : 0) - (b.s.oid === picked ? 1 : 0))
            .map(({ s, x, y }) => {
              const on = picked === s.oid;
              const dim = picked != null && !on;
              return (
                <g key={s.oid} className="cursor-pointer" opacity={dim ? 0.35 : 1} onClick={() => onPick(s.oid)}>
                  <title>{`${s.contractor ?? s.place} · ${s.ha} га · ${num(Math.round(s.cost ?? 0))} ${COST_UNIT}`}</title>
                  {on ? <circle cx={x} cy={y} r={9} fill="none" stroke={TONE} strokeWidth={1.2} /> : null}
                  <circle cx={x} cy={y} r={5} fill={TONE} fillOpacity={0.9} stroke="var(--paper-2)" strokeWidth={1} />
                </g>
              );
            })}
        </svg>
      ) : pts.length ? null : (
        <div className="chart-empty">Үзүүлэлт байхгүй</div>
      )}
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
    <div className="flex items-center justify-center gap-2 px-2.5 py-2">
      <Icon size={32} strokeWidth={1.3} className="shrink-0 text-(--tone)" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="eyebrow text-[11px] leading-[1.25]">{label}</span>
        <span className="num truncate text-[18px] leading-none font-medium text-ink">
          {value}
        </span>
      </div>
    </div>
  );
}
