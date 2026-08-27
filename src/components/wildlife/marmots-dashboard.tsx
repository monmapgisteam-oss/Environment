"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CalendarRange,
  Loader2,
  MapPin,
  Rat,
  Ruler,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import {
  AGE_CLASSES,
  fetchMarmots,
  RELEASE,
  type MarmotData,
} from "@/lib/marmots";
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

/*
  Хоёр үзүүрийн тэмдэг.

  Урьд нь зөвхөн ХЭЛБЭРЭЭР ялгаж, барьсан цэгийг энгийн гэрэлтэх цэг
  хэвээр үлдээсэн нь ойлгомжгүй байв: цэгүүд хол зайд тархсан үед
  хоёр өөр төрлийн зүйл гэдэг нь харагдахгүй. Одоо ӨНГӨ, ХЭЛБЭР
  ХОЁУЛАА ялгана — өнгө нь энд ангилал биш ҮЙЛ ЯВДЛЫН ТӨРӨЛ-ийг заана.

  · Барьсан — улбар шар, ДҮҮРЭН цэг: тухайн газраас АВСАН.
  · Тавьсан — цэнхэр, ТОВЧ (цагираг + цөм): тухайн газарт СУУЛГАСАН.

  Өнгө нь гүнзгий хувилбараараа бичигдсэн: тэмдэг нь үргэлж цайвар
  дискэн дээр суудаг тул (`.species-pin`) гэрэлтэй хувилбар нь бүдгэрнэ.
  Хүрээний өнгийг `globals.css` доторх `:has()` дүрэм `data-pin`-ээс
  уншиж тааруулна.
*/
const CATCH_PIN =
  '<svg data-pin="from" viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<circle cx="8" cy="8" r="5.5" fill="#d39b35"/></svg>';

const RELEASE_PIN =
  '<svg data-pin="to" viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<circle cx="8" cy="8" r="6.5" stroke="#2e7f8b" stroke-width="1.6"/>' +
  '<circle cx="8" cy="8" r="2.5" fill="#2e7f8b"/></svg>';

/**
 * Шилжүүлэн нутагшуулсан тарвагын самбар.
 *
 * Нэг бичлэг = НЭГ ШИЛЖҮҮЛЭЛТ: барьсан газраас тавьсан газар руу
 * зөөгдсөн тарвагын бүлэг. Тиймээс энэ дата нь цэгийн тархалт биш
 * УРСГАЛ — хаанаас хаашаа гэдэг нь гол утга.
 *
 * Хэлтсийн бусад самбар нэг цэгэн давхарга харуулдаг бол энд ХОЁР
 * үзүүр ба тэдгээрийг холбосон шугам зэрэг харагдана. Доод талд
 * бүтэн өргөнөөр шилжүүлэлтийн хүснэгт — мөр бүр нэг зөөвөр,
 * "хаанаас → хаашаа" гэсэн хосоороо уншигдана.
 */
export function MarmotsDashboard() {
  const [data, setData] = React.useState<MarmotData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [year, setYear] = React.useState<string | null>(null);
  const [fromSoum, setFromSoum] = React.useState<string | null>(null);
  const [toSoum, setToSoum] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  React.useEffect(() => {
    let alive = true;
    fetchMarmots()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const rows = data?.rows;

  const keep = React.useCallback(
    (
      r: { year: number; from: { soum: string }; to: { soum: string } },
      skip?: "year" | "from" | "to",
    ) => {
      if (skip !== "year" && year && String(r.year) !== year) return false;
      if (skip !== "from" && fromSoum && r.from.soum !== fromSoum) return false;
      if (skip !== "to" && toSoum && r.to.soum !== toSoum) return false;
      return true;
    },
    [year, fromSoum, toSoum],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((r) => keep(r)), [rows, keep]);
  const on = React.useMemo(() => new Set(shown.map((r) => r.oid)), [shown]);

  /*
    Хоёр үзүүрийг НЭГ цэгэн эх сурвалжид нийлүүлнэ: газрын зураг ганц
    цэгийн багана авдаг тул барьсан ба тавьсан цэгийг хооронд нь
    `RELEASE` шилжилтээр ялгана.
  */
  const points = React.useMemo(() => {
    if (!data) return { oid: [], lon: [], lat: [] };
    return {
      oid: [...data.from.oid, ...data.to.oid],
      lon: [...data.from.lon, ...data.to.lon],
      lat: [...data.from.lat, ...data.to.lat],
    };
  }, [data]);

  const visible = React.useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < points.oid.length; i++) {
      const id = points.oid[i];
      if (on.has(id >= RELEASE ? id - RELEASE : id)) out.push(i);
    }
    return Uint32Array.from(out);
  }, [points, on]);

  /** Хоёр үзүүр тус бүрд өөрийн тэмдэг */
  const marks = React.useMemo(() => {
    const out: Record<number, string> = {};
    for (const id of data?.from.oid ?? []) out[id] = CATCH_PIN;
    for (const id of data?.to.oid ?? []) out[id] = RELEASE_PIN;
    return out;
  }, [data]);

  /*
    Цэгийн шошго — БАРЬСАН цэг дээр хэдэн тарвага барьсныг бичнэ.

    Зөөврийн гол баримт нь "хаанаас хаашаа" гэдэгтэй хамт "ХЭД" гэдэг
    тоо юм. Түүнийг зурган дээр шууд харуулснаар нэг барилтын хэмжээ
    хүснэгт уншихгүйгээр мэдэгдэнэ.

    Тавьсан цэг шошгогүй: нэг тавих газарт олон зөөвөр нийлдэг тул
    (жишээ нь Дээндий нуруу ОНТХГ-т долоо) шошго нь давхарлаад
    уншигдахгүй болно. Түүний тоо тайлбар цонхонд гарна.
  */
  const labels = React.useMemo(() => {
    if (!data) return undefined;
    const total = new Map(data.rows.map((r) => [r.oid, r.total]));
    return {
      text: points.oid.map((id) =>
        id >= RELEASE ? "" : `${num(total.get(id) ?? 0)} тарвага`,
      ),
      minzoom: 8,
      /* Хоёр үзүүр хоёулаа 30px дискэн тэмдэгтэй тул шошгыг доош
         түлхэнэ — анхдагч зайд дискний доор нуугдана */
      offset: 1.9,
    };
  }, [data, points]);

  /** Холбосон шугам — шүүлтэнд үлдсэн зөөврийнх нь */
  const links = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    return {
      type: "FeatureCollection",
      features: data.links.features.filter((f) => on.has(Number(f.id))),
    };
  }, [data, on]);

  /* ---------------- Задаргаа ---------------- */
  const byYear = React.useMemo<Datum[]>(() => {
    const m = new Map<number, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "year")) continue;
      m.set(r.year, (m.get(r.year) ?? 0) + r.total);
    }
    return [...m]
      .sort((a, b) => a[0] - b[0])
      .map(([k, v]) => ({ key: String(k), label: String(k), value: v }));
  }, [rows, keep]);

  const byFrom = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "from")) continue;
      m.set(r.from.soum, (m.get(r.from.soum) ?? 0) + r.total);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const byTo = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "to")) continue;
      m.set(r.to.soum, (m.get(r.to.soum) ?? 0) + r.total);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  /*
    Насны ангилал — эх сурвалжийн нэршил, эрэмбэ нь ТОГТМОЛ.
    Тоогоор эрэмбэлбэл шүүлт солиход мөрүүд байраа солино.
  */
  const byAge = React.useMemo<Datum[]>(
    () =>
      AGE_CLASSES.map((c) => ({
        key: c,
        label: c,
        value: shown.reduce((s, r) => s + (r.ages[c] ?? 0), 0),
      })),
    [shown],
  );

  /*
    Он бүрийн НАСНЫ БҮРЭЛДЭХҮҮН.

    Ангиллын нийлбэр дангаараа "аль нас олон вэ" гэж л хэлнэ. Гэтэл
    нутагшуулалтын хувьд чухал асуулт нь "жил бүр ижил бүрэлдэхүүнтэй
    бүлэг зөөгдөж байна уу" гэдэг — залуу мал олонтой бүлэг шинэ газарт
    өөр байдлаар дасдаг. Тиймээс жил бүрийг ХУВИЙН зурвас болгож,
    ангиллуудыг нэг зурваст өрнө.

    Өнгө нэмэхгүй: ангиллууд нь эрэмбэтэй тул нэг өнгөний ТУНГАЛАГИЙН
    шатлалаар ялгагдана.
  */
  const composition = React.useMemo(() => {
    const m = new Map<number, number[]>();
    for (const r of shown) {
      const acc = m.get(r.year) ?? AGE_CLASSES.map(() => 0);
      AGE_CLASSES.forEach((c, i) => (acc[i] += r.ages[c] ?? 0));
      m.set(r.year, acc);
    }
    return [...m]
      .sort((a, b) => a[0] - b[0])
      .map(([year, parts]) => ({
        year,
        parts,
        total: parts.reduce((s, v) => s + v, 0),
      }));
  }, [shown]);

  const stats = React.useMemo(() => {
    const total = shown.reduce((s, r) => s + r.total, 0);
    const km = shown.reduce((s, r) => s + r.km, 0);
    return {
      moves: shown.length,
      total,
      avgKm: shown.length ? km / shown.length : 0,
      years: new Set(shown.map((r) => r.year)).size,
    };
  }, [shown]);

  /* ---------------- Сонголтын хүрээ (zoom action) ---------------- */
  const focus = React.useMemo<Extent | null>(() => {
    if (picked == null && !year && !fromSoum && !toSoum) return null;
    const b = new Bounds();
    for (const r of picked != null ? shown.filter((x) => x.oid === picked) : shown) {
      b.add(r.from.lon, r.from.lat);
      b.add(r.to.lon, r.to.lat);
    }
    return b.get(0.02);
  }, [shown, picked, year, fromSoum, toSoum]);

  const active = React.useMemo(() => {
    const raw = hover ?? picked;
    if (raw == null) return null;
    const id = raw >= RELEASE ? raw - RELEASE : raw;
    const r = rows?.find((x) => x.oid === id);
    return r ? ({ r, end: raw >= RELEASE ? ("to" as const) : ("from" as const) }) : null;
  }, [rows, hover, picked]);

  function reset() {
    setYear(null);
    setFromSoum(null);
    setToSoum(null);
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
            Тарвагын шилжүүлэлт татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount = (year ? 1 : 0) + (fromSoum ? 1 : 0) + (toSoum ? 1 : 0);
  /* Хүснэгтийн зурвасын хуваарь — БҮХ зөөврийн дээд утга */
  const maxTotal = Math.max(...data.rows.map((r) => r.total), 1);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Шилжүүлэн нутагшуулсан тарвага"
        activeCount={activeCount}
        onReset={reset}
      >
        <FilterMenu
          label="Он"
          icon={CalendarRange}
          value={year}
          active={Boolean(year)}
          onClear={() => setYear(null)}
          width={180}
        >
          <PickList
            items={byYear}
            selected={year}
            onPick={setYear}
            format={(v) => `${num(v)} тарвага`}
          />
        </FilterMenu>

        <FilterMenu
          label="Барьсан газар"
          icon={MapPin}
          value={fromSoum}
          active={Boolean(fromSoum)}
          onClear={() => setFromSoum(null)}
          width={230}
        >
          <PickList
            items={byFrom}
            selected={fromSoum}
            onPick={setFromSoum}
            format={(v) => `${num(v)} тарвага`}
          />
        </FilterMenu>

        <FilterMenu
          label="Тавьсан газар"
          icon={MapPin}
          value={toSoum}
          active={Boolean(toSoum)}
          onClear={() => setToSoum(null)}
          width={230}
        >
          <PickList
            items={byTo}
            selected={toSoum}
            onPick={setToSoum}
            format={(v) => `${num(v)} тарвага`}
          />
        </FilterMenu>
      </FilterBar>

      {/* ---- ДЭЭД МӨР: газрын зураг + задаргаа ---- */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
        <Card className="relative min-h-[240px] flex-1 overflow-hidden">
          <div className="relative h-full w-full">
            {/*
              Барьсан цэг, тавьсан цэг, тэдгээрийг холбосон шугам гурвуулаа.
              Шугамгүй бол хоёр цэгийн аль нь алинтайгаа хамааралтай нь
              зурган дээр таамаг болно.
            */}
            <PointMap
              points={points}
              visible={visible}
              marks={marks}
              labels={labels}
              /* `flow` нь шугамын дундад чиглэлийн сум тавина — барих
                 цэгээс тавих цэг рүү гэдэг нь зурган дээр шууд уншигдана */
              shapes={{ data: links, selected: picked, flow: true }}
              basemap={basemap}
              onSelect={(oid) => {
                const id = oid >= RELEASE ? oid - RELEASE : oid;
                setPicked(picked === id ? null : id);
              }}
              onHover={setHover}
              focus={focus}
              cluster={false}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} />

            {/*
              Тайлбар. Хоёр үзүүрийг хэлбэр, өнгөөр ялгасан ч тэдгээр нь
              ЮУГ заахыг нэг л газар бичих хэрэгтэй — эс тэгвээс
              хэрэглэгч тааварлана. Хөвөгч гадаргуу тул `.elevated`
              сүүдэр зөвшөөрөгдөнө.
            */}
            <div className="elevated absolute bottom-2.5 left-2.5 z-10 rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
              <div className="eyebrow mb-1.5">Тэмдэглэгээ</div>
              <div className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full bg-ochre"
                />
                Барьсан газар
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-2">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full border-2 border-moss"
                />
                Тавьсан газар
              </div>
            </div>

            {active ? (
              <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[280px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                <div className="eyebrow mb-1.5">
                  {active.end === "from" ? "Барьсан газар" : "Тавьсан газар"} ·{" "}
                  {active.r.year}
                </div>
                <div className="text-[12.5px] leading-snug text-ink">
                  {(active.end === "from" ? active.r.from : active.r.to).place ||
                    (active.end === "from" ? active.r.from : active.r.to).soum}
                </div>
                <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                  {(active.end === "from" ? active.r.from : active.r.to).aimag} ·{" "}
                  {(active.end === "from" ? active.r.from : active.r.to).soum}
                </div>
                <div className="num mt-1 text-[11.5px] text-ink-2">
                  {num(active.r.total)} тарвага · {active.r.km.toFixed(1)} км
                </div>
                {/* Нөгөө үзүүрийг мөн бичнэ — зөөвөр нь хос цэгээр л
                    бүрэн утгатай болно */}
                <div className="mt-1 flex items-center gap-1 text-[10.5px] leading-snug text-ink-3">
                  <ArrowRight size={10} strokeWidth={2} className="shrink-0" />
                  <span className="min-w-0 truncate">
                    {active.end === "from"
                      ? active.r.to.place || active.r.to.soum
                      : active.r.from.place || active.r.from.soum}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="flex min-h-0 flex-col gap-2.5 xl:w-[300px] xl:shrink-0">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Stat icon={ArrowRight} label="Шилжүүлэлт" value={num(stats.moves)} />
              <Stat icon={Rat} label="Нийт тарвага" value={num(stats.total)} />
              <Stat icon={CalendarRange} label="Хамрах он" value={num(stats.years)} />
              <Stat
                icon={Ruler}
                label="Дундаж зай, км"
                value={stats.avgKm.toFixed(1)}
              />
            </div>
          </Card>

          {/*
            Он бүрийн насны бүрэлдэхүүн. Зурвас бүр 100% — жилүүд өөр
            өөр хэмжээтэй тул шууд харьцуулбал зөвхөн том жил нь
            харагдана. Хажууд нь бодит тоог бичнэ.
          */}
          <Card className="shrink-0">
            <Head title="Оны насны бүрэлдэхүүн">
              <span className="text-[10.5px] text-ink-3">хувиар</span>
            </Head>
            <div className="space-y-2.5 p-3">
              {composition.map((c) => (
                <button
                  key={c.year}
                  onClick={() =>
                    setYear(year === String(c.year) ? null : String(c.year))
                  }
                  className="block w-full text-left"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "num text-[11.5px] transition-colors",
                        year === String(c.year) ? "font-medium text-ink" : "text-ink-2",
                      )}
                    >
                      {c.year}
                    </span>
                    <span className="num text-[10.5px] text-ink-3">
                      {num(c.total)} тарвага
                    </span>
                  </div>
                  <div className="mt-1 flex h-[9px] w-full overflow-hidden rounded-[1px] bg-paper-hi">
                    {c.parts.map((v, i) =>
                      v > 0 ? (
                        <span
                          key={AGE_CLASSES[i]}
                          title={`${AGE_CLASSES[i]} · ${num(v)}`}
                          style={{
                            width: `${(v / c.total) * 100}%`,
                            background: "var(--data)",
                            /* Эрэмбийн дагуу бүдгэрэх шатлал — өнгө нэмэхгүй */
                            opacity: 1 - i * 0.17,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                </button>
              ))}
              {composition.length === 0 ? (
                <p className="py-3 text-center text-[12px] text-ink-3">Утга алга</p>
              ) : null}
            </div>
          </Card>

          {/* Мөрийн СҮҮЛД нь уян карт — тайлбарын хамт */}
          <Card className="min-h-[120px] flex-1">
            <Head title="Насны ангиллаар">
              <span className="text-[10.5px] text-ink-3">тарвага</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/* Ангиллын нэр нь эх сурвалжийнх — тайлбарыг эх сурвалж
                  өгөөгүй тул орчуулж таагаагүй. Дээрх бүрэлдэхүүний
                  зурвасын өнгөний шатлалтай ижил дараалалтай. */}
              <RowChart data={byAge} />
            </div>
          </Card>
        </div>
      </div>

      {/* ---- ДООД МӨР: шилжүүлэлтийн хүснэгт, бүтэн өргөнөөр ---- */}
      <Card className="max-h-[38%] shrink-0 overflow-hidden">
        <Head title="Шилжүүлэлтийн бүртгэл">
          <span className="num text-[11.5px] text-ink-3">{num(shown.length)}</span>
        </Head>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            {/* Толгой наалдана — гүйхэд багана нэрээ алдвал тоонууд
                ялгагдахгүй болно */}
            <thead className="elevated sticky top-0 z-10 bg-paper-2">
              <tr className="border-b border-line">
                <Th>Он</Th>
                <Th>Барьсан газар</Th>
                <Th>Тавьсан газар</Th>
                <Th right>Зай, км</Th>
                {AGE_CLASSES.map((c) => (
                  <Th key={c} right>
                    {c}
                  </Th>
                ))}
                <Th right>Нийт</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr
                  key={r.oid}
                  onClick={() => setPicked(picked === r.oid ? null : r.oid)}
                  onMouseEnter={() => setHover(r.oid)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-paper-hi",
                    picked === r.oid && "bg-paper-hi",
                  )}
                >
                  <td className="num px-2.5 py-1.5 align-top text-[11.5px] text-ink-2">
                    {r.year || "—"}
                  </td>
                  <td className="px-2.5 py-1.5 align-top">
                    <span className="block text-[12px] leading-tight text-ink">
                      {r.from.place || r.from.soum}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-none text-ink-3">
                      {r.from.aimag} · {r.from.soum}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 align-top">
                    <span className="block text-[12px] leading-tight text-ink">
                      {r.to.place || r.to.soum}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-none text-ink-3">
                      {r.to.aimag} · {r.to.soum}
                    </span>
                  </td>
                  <td className="num px-2.5 py-1.5 text-right align-top text-[11.5px] text-ink-2">
                    {r.km.toFixed(1)}
                  </td>
                  {AGE_CLASSES.map((c) => (
                    <td
                      key={c}
                      className="num px-2.5 py-1.5 text-right align-top text-[11.5px] text-ink-3"
                    >
                      {r.ages[c] ?? "—"}
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5 align-top">
                    <span className="num block text-right text-[11.5px] leading-none text-ink">
                      {/*
                        `Нийт` талбар хоосон байсан мөрд ойролцоо тэмдэг —
                        ангиллуудын нийлбэрээр нөхсөн гэдгийг ил хэлнэ
                      */}
                      {r.totalDerived ? "≈" : ""}
                      {num(r.total)}
                    </span>
                    <span className="mt-1 block h-[2px] w-full overflow-hidden rounded-[1px] bg-paper-hi">
                      <span
                        className="block h-full"
                        style={{
                          width: `${(r.total / maxTotal) * 100}%`,
                          background: "var(--data)",
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {shown.length === 0 ? (
            <div className="py-5 text-center text-[12px] text-ink-3">
              Шүүлтүүрт тохирох шилжүүлэлт алга
            </div>
          ) : null}
        </div>
      </Card>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS · {num(data.rows.length)} шилжүүлэлт ·
        барьсан, тавьсан хоёр давхаргыг хослуулав · ≈ нь ангиллын нийлбэрээр
        нөхсөн нийт
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "eyebrow px-2.5 py-2 font-normal whitespace-nowrap",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
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
  icon: typeof Rat;
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
