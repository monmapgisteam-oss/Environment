"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  FlaskConical,
  Gauge,
  Loader2,
  MapPin,
  Trees,
  TriangleAlert,
  X,
} from "lucide-react";
import { PieChart, RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { OverlayControl } from "@/components/map/overlay-control";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapOverlay,
  type MapPoints,
} from "@/components/wells/map";
import {
  fetchSoil,
  pliClass,
  pliColor,
  PLI_CLASSES,
  PLI_RAMP,
  SOIL_YEARS,
  type SoilData,
  type SoilMetric,
  type SoilYear,
} from "@/lib/soil";
import { Bounds } from "@/lib/extent";
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

/** Тайлбарын шатлалт зурвас — CSS градиент болгосон шатлал */
const RAMP_CSS = (() => {
  const lo = PLI_RAMP[0][0];
  const hi = PLI_RAMP[PLI_RAMP.length - 1][0];
  const stops = PLI_RAMP.map(
    ([v, c]) => `${c} ${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`,
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
})();

/** Ангиллын өнгө — мужийнхаа дунджаас шатлалаар авна */
const CLASS_COLOR = [0.6, 1.5, 2.5, 3.6].map(pliColor);

/**
 * Байршлын талбарт ХОЁР ТӨРЛИЙН нэгж холилдсон: нийслэлийн 7 дүүрэг ба
 * Төв аймгийн 3 сум (Баян, Баяндэлгэр, Мөнгөнморьт). Хоёр жилийн аль
 * алинд нь яг ийм 7 + 3 байна.
 *
 * Нэг жагсаалтад хамт эгнүүлбэл "дүүргээр" гэсэн гарчиг сумдыг дарж
 * бичих бөгөөд хэмжээ нь ч харьцуулах аргагүй (дүүрэг 29–147 цэгтэй,
 * сум 10–15). Тиймээс хоёр тусдаа диаграм болгов.
 *
 * Ялгах шинж нь нэрийн төгсгөл: эх сурвалж дүүргийг үргэлж "… дүүрэг"
 * гэж бүтнээр нь бичдэг, сумын нэр дагаваргүй.
 */
function isSoum(name: string) {
  return !name.endsWith("дүүрэг");
}

/**
 * Хөрсний мониторингийн самбар.
 *
 * Өмнөх самбаруудаас ялгаатай нь энэ нь ТООЛЛОГО биш ХЭМЖИЛТ: цэг цөөн
 * (500), гэвч цэг бүр 10–12 элементийн утга агуулна. Тиймээс бүтэц нь
 * "хэдэн ширхэг вэ" биш "ямар түвшинтэй вэ" гэдэг рүү чиглэв:
 *  · газрын зураг дээр цэг нь PLI-ийн зэргээрээ өнгө, хэмжээ авна;
 *  · баруун багана нь тархалт биш ПРОФАЙЛ — элемент бүрийн дундаж;
 *  · цэг товшиход тэр цэгийн бүтэн профайл нээгдэнэ.
 */
export function SoilDashboard() {
  const [year, setYear] = React.useState<SoilYear>(2024);
  const [loaded, setLoaded] = React.useState<SoilData | null>(null);
  const [failed, setFailed] = React.useState<{ year: SoilYear; message: string } | null>(null);

  const [district, setDistrict] = React.useState<string | null>(null);
  const [grade, setGrade] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const [overlays, setOverlays] = React.useState<MapOverlay[]>([]);

  React.useEffect(() => {
    let alive = true;
    fetchSoil(year)
      .then((d) => alive && setLoaded(d))
      .catch((e: Error) => alive && setFailed({ year, message: e.message }));
    return () => {
      alive = false;
    };
  }, [year]);

  /*
    Жил солиход өмнөх жилийн мэдээ дэлгэц дээр үлдэх ёсгүй. Үүнийг
    "цэвэрлэх" гэж effect дотор `setData(null)` дуудахгүй — тэр нь
    шаталсан зурагдалт үүсгэнэ. Оронд нь татагдсан мэдээ өөрөө жилээ
    авч явдаг тул сонгосон жилтэй нь ТААРАХГҮЙ бол хоосон гэж үзнэ.
  */
  const data = loaded?.year === year ? loaded : null;
  const error = failed?.year === year ? failed.message : null;

  const points = data?.points;

  /* ---------------- Цэгийн багана (газрын зурагт) ---------------- */
  /*
    Цэгийн шошго — мониторингийн цэгийн дугаар ("BHD-1").

    Тайланд цэгийг ЭНЭ дугаараар нь нэрлэдэг тул зураг дээрх цэгийг
    баримт бичигтэй холбох цорын ганц гүүр нь энэ юм. z12-оос гарна:
    500 цэг хотын дотор нягт байрладаг.
  */
  const labels = React.useMemo(() => {
    if (!points) return undefined;
    return { text: points.map((p) => p.code), minzoom: 12 };
  }, [points]);

  const geo = React.useMemo<MapPoints & { pli: Float32Array }>(() => {
    const n = points?.length ?? 0;
    const oid = new Array<number>(n);
    const lon = new Float64Array(n);
    const lat = new Float64Array(n);
    const pli = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = points![i];
      oid[i] = p.oid;
      lon[i] = p.lon;
      lat[i] = p.lat;
      pli[i] = p.pli;
    }
    return {
      oid,
      lon: lon as unknown as number[],
      lat: lat as unknown as number[],
      pli,
    };
  }, [points]);

  /* ---------------- Шүүлтүүр ----------------
     Диаграм бүр ӨӨРИЙНХӨӨ хэмжигдэхүүнийг алгасаж шүүгддэг: эс тэгвээс
     нэгийг сонгосны дараа бусад мөр алга болж, харьцуулах юм үлдэхгүй. */
  const keep = React.useCallback(
    (i: number, skip?: "district" | "grade") => {
      const p = points![i];
      if (skip !== "district" && district && p.district !== district) return false;
      if (skip !== "grade" && grade && String(pliClass(p.pli)) !== grade) return false;
      return true;
    },
    [points, district, grade],
  );

  const visible = React.useMemo(() => {
    const n = points?.length ?? 0;
    const out = new Uint32Array(n);
    let k = 0;
    for (let i = 0; i < n; i++) if (keep(i)) out[k++] = i;
    return out.slice(0, k);
  }, [points, keep]);

  /* ---------------- Задаргаа ---------------- */
  const gradeData = React.useMemo<Datum[]>(() => {
    if (!points) return [];
    const c = [0, 0, 0, 0];
    for (let i = 0; i < points.length; i++) if (keep(i, "grade")) c[pliClass(points[i].pli)]++;
    return PLI_CLASSES.map((k, i) => ({ key: k.id, label: k.label, value: c[i] }));
  }, [points, keep]);

  /*
    Дүүргийн мөрөнд ХОЁР тоо хэрэгтэй: диаграмд дундаж PLI, шүүлтүүрийн
    жагсаалтад цэгийн тоо. Нэг удаа тоолж, хоёр хэлбэрт нь буулгана.
  */
  const districtRows = React.useMemo(() => {
    if (!points) return [];
    const sum = new Map<string, { n: number; pli: number }>();
    for (let i = 0; i < points.length; i++) {
      if (!keep(i, "district")) continue;
      const p = points[i];
      const hit = sum.get(p.district) ?? { n: 0, pli: 0 };
      hit.n++;
      hit.pli += p.pli;
      sum.set(p.district, hit);
    }
    return [...sum]
      .map(([k, v]) => ({ key: k, label: k, mean: v.pli / v.n, n: v.n }))
      .sort((a, b) => b.mean - a.mean);
  }, [points, keep]);

  /* Дүүрэг — дундаж PLI-аар эрэмбэлсэн мөрөн диаграм */
  const districtData = React.useMemo<Datum[]>(
    () =>
      districtRows
        .filter((d) => !isSoum(d.key))
        .map((d) => ({ key: d.key, label: d.label, value: d.mean })),
    [districtRows],
  );

  /*
    Сум — гурав л байдаг тул бөгжөөр. Зүсмийн ХЭМЖЭЭ нь цэгийн тоо
    (жинхэнэ бүхэл: гурван сумын нийт цэг), ӨНГӨ нь дундаж PLI-ийн
    шатлалаас гарна. Дундажийг зүсмийн өнцгөөр илэрхийлж БОЛОХГҮЙ —
    дундаж нэмэгддэггүй тул тойрог нь худал бүхэл болно.
  */
  const soumRows = React.useMemo(
    () => districtRows.filter((d) => isSoum(d.key)).sort((a, b) => b.n - a.n),
    [districtRows],
  );

  const soumData = React.useMemo<Datum[]>(
    () => soumRows.map((d) => ({ key: d.key, label: d.label, value: d.n })),
    [soumRows],
  );

  const soumMean = React.useMemo(
    () => new Map(soumRows.map((d) => [d.key, d.mean])),
    [soumRows],
  );

  /**
   * Элементийн дундаж — ХЭМЖИГДЭХҮҮН БҮРД нэг жагсаалт.
   *
   * Дундажаар нь буурахаар эрэмбэлнэ: аль элемент энэ хэсэгт хамгийн
   * их ачаалал өгч байгааг эхний мөрөөс шууд уншина. Утга нь жил бүр,
   * бүр нэг жилийн дотор ч ӨӨР ХЭМЖИГДЭХҮҮН (2024 онд PI ба Igeo,
   * 2023 онд мг/кг) тул гарчигт нь нэрийг нь үргэлж бичнэ.
   *
   * Хэмжигдэхүүн бүрийг тусад нь тоолохын оронд цэгийн НЭГ гүйлтээр
   * бүгдийг нь хуримтлуулна — 507 цэг × 20 багана нь шүүлтүүр солигдох
   * бүрд давтагдана.
   */
  const elementSeries = React.useMemo<Datum[][]>(() => {
    if (!data || !points) return [];
    const sums = data.metrics.map((m) => m.elements.map(() => ({ n: 0, v: 0 })));
    for (let i = 0; i < points.length; i++) {
      if (!keep(i)) continue;
      const vals = points[i].values;
      for (let m = 0; m < sums.length; m++) {
        for (let e = 0; e < sums[m].length; e++) {
          const v = vals[m][e];
          if (v == null) continue;
          sums[m][e].n++;
          sums[m][e].v += v;
        }
      }
    }
    return data.metrics.map((m, mi) =>
      m.elements
        .map((el, e) => ({
          key: el,
          label: el,
          value: sums[mi][e].n ? sums[mi][e].v / sums[mi][e].n : 0,
        }))
        .sort((a, b) => b.value - a.value),
    );
  }, [data, points, keep]);

  const stats = React.useMemo(() => {
    if (!points) return null;
    let pli = 0;
    let over = 0;
    let worst: { code: string; pli: number } | null = null;
    /* Дүүрэг, сум нь ӨӨР засаг захиргааны нэгж — тусад нь тоолно */
    const districts = new Set<string>();
    const soums = new Set<string>();
    for (let k = 0; k < visible.length; k++) {
      const p = points[visible[k]];
      pli += p.pli;
      if (p.pli >= 1) over++;
      if (!worst || p.pli > worst.pli) worst = { code: p.code, pli: p.pli };
      (isSoum(p.district) ? soums : districts).add(p.district);
    }
    const n = visible.length;
    return {
      n,
      districts: districts.size,
      soums: soums.size,
      pli: n ? pli / n : 0,
      overPct: n ? (over / n) * 100 : 0,
      worst,
    };
  }, [points, visible]);

  /* ---------------- Сонголт руу ойртох (zoom action) ---------------- */
  /* ---------------- Сонголтын хүрээ (zoom action) ----------------
     Сонгосон цэг рүү, эс бөгөөс шүүлтүүрт таарсан бүх цэг рүү ойртоно.

     ОНЫГ энд оруулахгүй: он бол шүүлтүүр биш эх сурвалж сольдог зүйл
     (2024 ба 2023 нь ӨӨР хэмжигдэхүүнтэй хоёр бүртгэл) — он солиход
     зураг үсрэх нь шинэ дата ирснийг далдална. */
  const focus = React.useMemo<Extent | null>(() => {
    if (!points) return null;
    if (picked == null && !district && !grade) return null;
    const b = new Bounds();
    if (picked != null) {
      const p = points.find((x) => x.oid === picked);
      if (p) b.add(p.lon, p.lat);
    } else {
      for (let k = 0; k < visible.length; k++) {
        const p = points[visible[k]];
        b.add(p.lon, p.lat);
      }
    }
    /* Ганц цэг сонгогдвол хүрээ нь цэг болно — багахан талбай нэмнэ */
    return b.get(0.004);
  }, [points, visible, picked, district, grade]);

  const selected = React.useMemo(
    () => (picked == null ? null : (points?.find((p) => p.oid === picked) ?? null)),
    [points, picked],
  );

  const hovered = React.useMemo(
    () => (hover == null ? null : (points?.find((p) => p.oid === hover) ?? null)),
    [points, hover],
  );

  function reset() {
    setDistrict(null);
    setGrade(null);
    setPicked(null);
  }

  function pickYear(y: SoilYear) {
    setYear(y);
    /* Хоёр жилийн цэг ӨӨР — сонголт, шүүлтүүр дамжуулах нь утгагүй */
    reset();
  }

  if (error || !data || !stats) {
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
            {year} оны хөрсний мониторингийн мэдээ татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount = (district ? 1 : 0) + (grade ? 1 : 0);

  /** "Бохирдлын индекс (PI)" · "Агууламж, мг/кг" */
  const metricTitle = (m: SoilMetric) => (m.unit ? `${m.label}, ${m.unit}` : m.label);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Хөрсний мониторинг"
        activeCount={activeCount}
        onReset={reset}
        leading={
          /* Жил сонгох — хоёр өөр судалгаа, давхарлахгүй сольж харна */
          <div className="flex shrink-0 items-center gap-1">
            {SOIL_YEARS.map((y) => {
              const on = year === y;
              return (
                <button
                  key={y}
                  onClick={() => pickYear(y)}
                  aria-pressed={on}
                  className={cn(
                    "num rounded-xs border px-2.5 py-1 text-[12px] transition-colors",
                    on
                      ? "border-data/45 bg-data/10 text-ink"
                      : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        }
      >
        <FilterMenu
          label="Дүүрэг, сум"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={240}
        >
          {/* Жагсаалтад дундаж биш ЦЭГИЙН ТОО — сонголтын хэмжээг хэлнэ */}
          <PickList
            items={districtRows.map((d) => ({ key: d.key, label: d.label, value: d.n }))}
            selected={district}
            onPick={setDistrict}
          />
        </FilterMenu>

        <FilterMenu
          label="PLI зэрэг"
          icon={Gauge}
          value={grade ? PLI_CLASSES[Number(grade)].label : null}
          active={Boolean(grade)}
          onClear={() => setGrade(null)}
          width={200}
        >
          <PickList items={gradeData} selected={grade} onPick={setGrade} />
        </FilterMenu>
      </FilterBar>

      {/*
        Индикаторын зурвас ба мөрийн тайлбар нь ДЭЛГЭЦИЙН БҮТЭН ӨРГӨНД,
        доторх бүх диаграм нэг мөрөнд эгнэнэ. Хоёр баганын сүлжээ байхаа
        больсон: диаграмууд индикаторын зэрэгцээ бус, газрын зурагтайгаа
        нэг өндөрт эхлэх ёстой.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <Card className="shrink-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">
            <Stat icon={MapPin} label="Хяналтын цэг" value={num(stats.n)} />
            <Stat icon={Building2} label="Дүүрэг" value={num(stats.districts)} />
            <Stat icon={Trees} label="Сум" value={num(stats.soums)} />
            <Stat icon={Gauge} label="Дундаж PLI" value={stats.pli.toFixed(2)} />
            <Stat
              icon={TriangleAlert}
              label="PLI ≥ 1"
              value={`${stats.overPct.toFixed(0)}%`}
            />
          </div>
        </Card>

        {/*
          Индикаторын доор нэг МӨР, гурван хэсэг: зүүнд элементийн
          профайл, дунд газрын зураг (уян), баруунд задаргааны
          диаграмууд. Зургийн ӨНДӨР бүтнээрээ үлдэж, зөвхөн өргөн нь
          хуваагдана. xl-ээс доош унавал мөр нь багана болно — нарийн
          дэлгэцэнд гурван багана зургийг юу ч үлдээхгүй шахна.
        */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
          {/*
            Хэмжигдэхүүн БҮРД нэг карт, дээрээс доош. 2024 онд ижил 10
            элемент дээр PI ба Igeo хоёр индекс бодогдсон тул хоёр карт
            эгнэнэ; 2023 онд ганц карт бүтэн өндрөө авна.

            Хоёрыг нэг диаграмд хольж БОЛОХГҮЙ (масштаб нь өөр), гэвч
            зэрэгцүүлж харах нь утгатай: нэг элемент PI-гээр өндөр,
            Igeo-гоор бага байх нь мэдээлэл юм.
          */}
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-[300px] xl:shrink-0 2xl:w-[340px]">
            {data.metrics.map((m, mi) => {
              /* Цэг сонгогдвол карт бүр ТЭР ЦЭГИЙН утгыг харуулна —
                 нэгтгэсэн дундажаас тухайн цэг рүү шилжих нь энэ
                 датаны гол асуулт ("энд юу нь хэтэрсэн бэ") */
              const rows: Datum[] = selected
                ? m.elements
                    .map((el, e) => ({
                      key: el,
                      label: el,
                      value: selected.values[mi][e] ?? 0,
                    }))
                    .sort((a, b) => b.value - a.value)
                : (elementSeries[mi] ?? []);

              return (
                <Card key={m.id} className="min-h-0 flex-1">
                  {/* Гарчигт хэмжигдэхүүнээ үргэлж бичнэ — нэг жилийн
                      дотор ч өөр өөр масштабтай */}
                  <Head title={selected ? "Цэгийн профайл" : "Элементийн дундаж"}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[10.5px] text-ink-3">
                        {metricTitle(m)}
                      </span>
                      {/* Хаах товч нь ЗӨВХӨН эхний картад — бүх карт
                          нэг сонголтыг харуулдаг тул давтагдах нь илүүц */}
                      {selected && mi === 0 ? (
                        <button
                          onClick={() => setPicked(null)}
                          className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                          aria-label="Хаах"
                        >
                          <X size={13} />
                        </button>
                      ) : null}
                    </span>
                  </Head>
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {/* Цэгийн нэр, түвшин нь эхний картад нэг л удаа */}
                    {selected && mi === 0 ? (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="num text-[13px] font-medium text-ink">
                            {selected.code}
                          </span>
                          <span
                            className="num rounded-xs px-1.5 py-0.5 text-[11px] leading-none"
                            style={{
                              background: `${pliColor(selected.pli)}22`,
                              color: pliColor(selected.pli),
                            }}
                          >
                            PLI {selected.pli.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-1 mb-3 text-[11.5px] leading-snug text-ink-3">
                          {selected.district} · {selected.khoroo}
                        </p>
                      </>
                    ) : null}
                    {/*
                      Хязгаартай хэмжигдэхүүнд (PI) л өнгө, заагч гарна.
                      Igeo болон агууламжид хязгаар нь БАРИМТЖААГҮЙ тул
                      ганц өнгөөрөө үлдэнэ — таамгаар ногоон/улаан
                      будвал "энэ хэвийн, энэ аюултай" гэсэн худал
                      дүгнэлт өгнө.
                    */}
                    <RowChart
                      data={rows}
                      format={fmt}
                      guide={m.limit}
                      colorOf={m.limit != null ? (x) => pliColor(x.value) : undefined}
                    />
                    {m.limit != null ? (
                      <p className="mt-3 flex items-start gap-1.5 border-t border-line pt-2 text-[10px] leading-tight text-ink-3">
                        <span
                          aria-hidden
                          className="mt-[2px] inline-block h-[9px] w-px shrink-0 bg-ink-3"
                        />
                        <span>
                          Дэвсгэр түвшин (PI&nbsp;=&nbsp;{m.limit}). Хэтэрсэн хэсэг
                          анивчина.
                        </span>
                      </p>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="relative min-h-[280px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/*
                Зургийг жил бүрд дахин үүсгэнэ (`key`): зэрэглэлийн өнгө,
                бөөгнөрөл зэрэг нь эх сурвалж үүсгэх мөчид л уншигддаг.
              */}
              <PointMap
                key={year}
                points={geo}
                visible={visible}
                labels={labels}
                grades={{ values: geo.pli, stops: PLI_RAMP, heat: true }}
                basemap={basemap}
                onSelect={setPicked}
                onHover={setHover}
                focus={focus}
                overlays={overlays}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />
              <OverlayControl value={overlays} onChange={setOverlays} />

              {/*
                Hover самбар. Цэг дээр очиход хамгийн чухал гурван зүйл
                шууд гарна: аль цэг, ямар түвшин, хаана. Товшилт нь
                бүтэн профайл нээдэг тул энд элемент бүрийг жагсаахгүй —
                хоёулаа ижил зүйл харуулбал товшилтын утга алдагдана.
                Хулганы үйлдлийг саатуулахгүйн тулд `pointer-events`
                унтраасан.
              */}
              {hovered ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[240px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="num text-[12.5px] leading-none font-medium text-ink">
                      {hovered.code}
                    </span>
                    <span
                      className="num rounded-xs px-1.5 py-0.5 text-[10.5px] leading-none"
                      style={{
                        background: `${pliColor(hovered.pli)}22`,
                        color: pliColor(hovered.pli),
                      }}
                    >
                      PLI {hovered.pli.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11.5px] leading-snug text-ink-2">
                    {hovered.district} · {hovered.khoroo}
                  </div>
                  <div className="num mt-1 text-[10px] text-ink-3">
                    {hovered.lat.toFixed(5)}, {hovered.lon.toFixed(5)}
                  </div>
                </div>
              ) : null}

              {/*
                Тайлбар нь ЗУРВАС — өнгө нь тасралтгүй тул шаталсан
                жагсаалт худал ангилал үүсгэнэ.

                Хайрцаггүй, шууд зураг дээр суудаг тул уншигдац нь зөвхөн
                сүүдрээс хамаарна: хиймэл дагуулын цайвар талбай дээр
                `text-ink-3` дангаараа алга болно. Суурь зургийн товчтой
                ижил `drop-shadow` хэрэглэв.
              */}
              <div
                className="pointer-events-none absolute right-2.5 bottom-2.5 z-10 w-[164px]"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
              >
                <div className="eyebrow mb-1.5">PLI</div>
                <div
                  className="h-2 w-full rounded-[1px]"
                  style={{ background: RAMP_CSS }}
                  aria-hidden
                />
                <div className="num mt-1 flex justify-between text-[9.5px] leading-none text-ink-3">
                  {[0.4, 1, 2, 4].map((v) => (
                    <span key={v}>{v === 4 ? "4+" : v}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* ---- БАРУУН: задаргаа ---- */}
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-[340px] xl:shrink-0">
            {/*
              Сумын карт нь дүүргийнхээс ӨӨР хэлбэртэй байх нь санаатай:
              гурван мөр нь мөрөн диаграм болоод хагас хоосон карт үлдээх
              байсан бөгөөд дээрх жагсаалттай хольж уншигдана.
            */}
            {soumData.length > 0 ? (
              <Card className="shrink-0">
                <Head title="Сумаар">
                  <span className="text-[10.5px] text-ink-3">цэг · дундаж PLI</span>
                </Head>
                <div className="p-3">
                  <PieChart
                    data={soumData}
                    size={84}
                    selected={district}
                    onSelect={setDistrict}
                    colorOf={(d) => pliColor(soumMean.get(d.key) ?? 0)}
                    note={(d) => (soumMean.get(d.key) ?? 0).toFixed(2)}
                  />
                </div>
              </Card>
            ) : null}

            <Card className="shrink-0">
              <Head title="PLI зэргээр">
                <span className="num text-[11.5px] text-ink-3">{num(stats.n)}</span>
              </Head>
              <div className="p-3">
                <RowChart
                  data={gradeData}
                  selected={grade}
                  onSelect={setGrade}
                  colorOf={(d) => CLASS_COLOR[Number(d.key)]}
                />
              </div>
            </Card>

            {/*
              Баганын СҮҮЛД нь уян карт: дээрх хоёр нь тогтмол өндөртэй
              (`shrink-0`) тул үлдсэн зайг энэ эзэлнэ. Долоон мөр нь ихэвчлэн
              бүтнээрээ багтдаг ч намхан дэлгэцэнд дотроо гүйнэ.
            */}
            <Card className="min-h-0 flex-1">
              {/* Тоо биш ДУНДАЖ: "хаана хэдэн цэг байна" биш "хаана өндөр байна" */}
              <Head title="Дүүргээр">
                <span className="text-[10.5px] text-ink-3">дундаж PLI</span>
              </Head>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart
                  data={districtData}
                  selected={district}
                  onSelect={setDistrict}
                  format={(v) => v.toFixed(2)}
                />
              </div>
            </Card>
          </div>
        </div>

        <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
          Суурь зураг: Esri · Дата: ArcGIS · {year} оны {num(data.points.length)} цэг ·
          хэмжилт: {data.metrics.map(metricTitle).join(" · ")}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Хэмжилтийн тоо — 100-аас дээш бол бутархай нь утгагүй */
function fmt(v: number) {
  return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
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
  icon: typeof FlaskConical;
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
