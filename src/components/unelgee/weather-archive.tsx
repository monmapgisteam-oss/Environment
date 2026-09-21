"use client";

import * as React from "react";
import { CalendarRange, Database, Gauge, History, Radio, RefreshCw } from "lucide-react";
import { MEASURES, measureOf, readable, type Measure, type MeasureId } from "@/lib/weather";
import {
  WINDOW_DAYS,
  fetchArchive,
  type ArchiveData,
  type ArchiveRow,
} from "@/lib/weather-archive";
import { cn, num } from "@/lib/utils";
import { Card, Head, Stat } from "./ui";
import { Segments, Table, type Column } from "./viz";

/* --------------------------------------------------------------------------
   ЦАГ АГААРЫН АРХИВ

   "Бодит цагийн ажиглалт" таб нь мэдрэгчийн ОДООГИЙН заалтыг хэлдэг —
   тэнд хугацааны тэнхлэг огт байхгүй (эх сурвалж түүх өгдөггүй). Энэ
   таб нь яг тэр дутууг нөхнө: хуримтлуулсан архивыг ХУГАЦААНЫ ТЭНХЛЭГ
   дээр тавина.

   Тиймээс бодит цагийн табын элементүүд (хэрэгслийн нүүр, урьдчилсан
   мэдээ, хоёр газрын зураг) энд ОГТ ДАВТАГДАХГҮЙ. Гол дүрслэл нь:

     · **Дулааны зурвас** — мөр нь станц, багана нь хугацааны хэсэг,
       нүдний өнгө нь хэмжилт. Долоон станцыг давхцуулалгүй ЗЭРЭГ
       харуулах цорын ганц хэлбэр: долоон шугам нэг тэнхлэг дээр
       зурвал ойлгогдохоо больдог. Хоногийн мөчлөг босоо судал болж
       өөрөө харагдана, бичилт тасарсан хэсэг нь ХООСОН нүд болж ил
       гарна — архивын бүрэн бүтэн байдлыг нуухгүй.
     · **Сонгосон станцын цуваа** — зурвасаас гарах нарийн утга.
     · **Хоногийн дундаж явц** — архив Л хариулж чадах асуулт: өдрийн
       аль цагт хамгийн халуун, хүйтэн байдаг вэ.

   ⚠ Өнгө нь бодит цагийн газрын зурагтай НЭГ шатлалаас (`Measure.stops`)
   — хэрэглэгч хоёр табын хооронд нүдээ дахин тохируулах ёсгүй.
   -------------------------------------------------------------------------- */

/** Харуулах хугацааны муж — татсан цонхны дотор */
const RANGES = [
  { id: "1", label: "24 цаг", days: 1 },
  { id: "7", label: "7 хоног", days: 7 },
  { id: "30", label: `${WINDOW_DAYS} хоног`, days: WINDOW_DAYS },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

/** Хэмжигдэхүүний утгыг архивын мөрөөс — `Measure.of` нь бодит цагийн мөрд зориулагдсан */
const VALUE: Record<MeasureId, (r: ArchiveRow) => number | null> = {
  temp: (r) => r.temp,
  humidity: (r) => r.humidity,
  pressure: (r) => r.pressure,
  wind: (r) => r.wind,
  cloud: (r) => r.cloud,
};

const MEASURE_TABS = MEASURES.map((m) => ({ id: m.id, label: m.label }));

type Cell = { avg: number | null; n: number };

export function WeatherArchive() {
  const [data, setData] = React.useState<ArchiveData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [range, setRange] = React.useState<RangeId>("7");
  const [measure, setMeasure] = React.useState<MeasureId>("temp");
  const [station, setStation] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);
  /** Зурвас дээр хулганы доорх нүд — толгойн мөрөнд уншигдана */
  const [spot, setSpot] = React.useState<{ name: string; t: number; v: number } | null>(null);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchArchive(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, [retry]);

  const m = measureOf(measure);
  const days = RANGES.find((r) => r.id === range)?.days ?? 7;

  /*
    ⚠⚠ ОГНООНЫ МУЖ СОНГОХ БОЛОМЖ ХАСАГДСАН (хэрэглэгчийн шийдвэр,
    2026-09-21). Урьд нь эхлэх, дуусах огноог гараар өгөх боломжтой
    байсан бөгөөд тэр нь хурдан сонголтын товчнуудтай (24 цаг, 7, 30
    хоног) зэрэгцэж, хоёр өөр аргаар нэг зүйлийг тодорхойлдог байв.
    Одоо муж нь ЗӨВХӨН тэр товчнуудаас гарна.
  */
  /** Сонгосон мужид багтах мөрүүд */
  const rows = React.useMemo(() => {
    if (!data?.rows.length) return [];
    const last = data.rows[data.rows.length - 1].t;
    return data.rows.filter((r) => r.t >= last - days * 86_400_000);
  }, [data, days]);

  const spanDays = days;

  /* ---------------- Дулааны зурвас: станц × хугацааны хэсэг ---------------- */
  const strip = React.useMemo(() => {
    if (!rows.length || !data) return null;
    /*
      Нүдний өргөн нь мужаасаа хамаарна: нэг хоногийг цагаар, долоо
      хоногийг гурван цагаар, гучийг арван хоёр цагаар. Бүх мужийг
      цагаар зурвал 30 хоног нь 720 багана болж, нүд нэг пикселээс
      нарийсаж уншигдахаа болино.
    */
    const step = spanDays <= 1 ? 3_600_000 : spanDays <= 7 ? 3 * 3_600_000 : 12 * 3_600_000;
    const last = rows[rows.length - 1].t;
    const to = (Math.floor(last / step) + 1) * step;
    const from = Math.floor((last - spanDays * 86_400_000) / step) * step;
    const cols = Math.max(1, Math.round((to - from) / step));

    const sums = new Map<number, { sum: number; n: number }[]>();
    for (const r of rows) {
      const v = VALUE[measure](r);
      if (v == null) continue;
      const i = Math.floor((r.t - from) / step);
      if (i < 0 || i >= cols) continue;
      let line = sums.get(r.sid);
      if (!line) {
        line = Array.from({ length: cols }, () => ({ sum: 0, n: 0 }));
        sums.set(r.sid, line);
      }
      line[i].sum += v;
      line[i].n += 1;
    }

    const lines = data.stations
      .filter((s) => sums.has(s.sid))
      .map((s) => ({
        sid: s.sid,
        name: s.name,
        cells: sums.get(s.sid)!.map<Cell>((c) => ({ avg: c.n ? c.sum / c.n : null, n: c.n })),
      }));

    return { from, to, step, cols, lines };
  }, [rows, data, spanDays, measure]);

  /* ---------------- Сонгосон станцын цуваа ---------------- */
  const series = React.useMemo(() => {
    const sid = station == null ? null : Number(station);
    const pick = rows.filter((r) => (sid == null ? true : r.sid === sid));
    const pts: { t: number; v: number }[] = [];
    if (sid == null) {
      /* Станц сонгоогүй бол СҮЛЖЭЭНИЙ дундаж — нэг станцыг
         дурын байдлаар түрүүлгэх нь буруу мэдээлэл өгнө */
      const bucket = new Map<number, { sum: number; n: number }>();
      for (const r of pick) {
        const v = VALUE[measure](r);
        if (v == null) continue;
        const k = Math.floor(r.t / 3_600_000) * 3_600_000;
        const hit = bucket.get(k) ?? { sum: 0, n: 0 };
        hit.sum += v;
        hit.n += 1;
        bucket.set(k, hit);
      }
      for (const [t, b] of [...bucket].sort((a, b) => a[0] - b[0])) {
        pts.push({ t, v: b.sum / b.n });
      }
    } else {
      for (const r of pick) {
        const v = VALUE[measure](r);
        if (v != null) pts.push({ t: r.t, v });
      }
    }
    return pts;
  }, [rows, station, measure]);

  /* ---------------- Хоногийн дундаж явц ---------------- */
  const hours = React.useMemo(() => {
    const sid = station == null ? null : Number(station);
    const acc = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
    for (const r of rows) {
      if (sid != null && r.sid !== sid) continue;
      const v = VALUE[measure](r);
      if (v == null) continue;
      const h = new Date(r.t + 8 * 3_600_000).getUTCHours();
      acc[h].sum += v;
      acc[h].n += 1;
    }
    return acc.map((a) => (a.n ? a.sum / a.n : null));
  }, [rows, station, measure]);

  /* ---------------- Станцын хүснэгт ---------------- */
  type StatRow = {
    sid: number;
    name: string;
    place: string;
    n: number;
    min: number | null;
    avg: number | null;
    max: number | null;
    last: number | null;
  };

  const table = React.useMemo<StatRow[]>(() => {
    if (!data) return [];
    const acc = new Map<number, { n: number; sum: number; min: number; max: number; last: number | null }>();
    for (const r of rows) {
      const v = VALUE[measure](r);
      const hit = acc.get(r.sid) ?? { n: 0, sum: 0, min: Infinity, max: -Infinity, last: null };
      if (v != null) {
        hit.n += 1;
        hit.sum += v;
        if (v < hit.min) hit.min = v;
        if (v > hit.max) hit.max = v;
        /* Мөрүүд өсөх дарааллаар тул сүүлчийнх нь хамгийн сүүлийн заалт */
        hit.last = v;
      }
      acc.set(r.sid, hit);
    }
    return data.stations
      .filter((s) => acc.has(s.sid))
      .map((s) => {
        const a = acc.get(s.sid)!;
        return {
          sid: s.sid,
          name: s.name,
          place: s.place,
          n: a.n,
          min: a.n ? a.min : null,
          avg: a.n ? a.sum / a.n : null,
          max: a.n ? a.max : null,
          last: a.last,
        };
      })
      .sort((a, b) => b.n - a.n);
  }, [data, rows, measure]);

  const columns = React.useMemo<Column<StatRow>[]>(
    () => [
      { key: "name", label: "Станц", render: (r) => r.name },
      {
        key: "min",
        label: "Бага",
        num: true,
        render: (r) => <Val v={r.min} m={m} />,
        className: "w-[58px]",
      },
      {
        key: "avg",
        label: "Дундаж",
        num: true,
        render: (r) => <Val v={r.avg} m={m} />,
        className: "w-[62px]",
      },
      {
        key: "max",
        label: "Их",
        num: true,
        render: (r) => <Val v={r.max} m={m} />,
        className: "w-[58px]",
      },
      {
        key: "n",
        label: "Заалт",
        num: true,
        render: (r) => num(r.n),
        meter: (r) => r.n,
        className: "w-[58px]",
      },
    ],
    [m],
  );

  /* ---------------- Үзүүлэлт ---------------- */
  const exportRows = React.useMemo(() => rows.filter((r) => station == null || String(r.sid) === station), [rows, station]);
  const stats = React.useMemo(() => {
    const span =
      exportRows.length > 0
        ? `${dateText(exportRows[0].t)} – ${dateText(exportRows[exportRows.length - 1].t)}`
        : "—";
    const vals = exportRows.map((r) => VALUE[measure](r)).filter((v): v is number => v != null);
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    return {
      n: exportRows.length,
      stations: new Set(exportRows.map((r) => r.sid)).size,
      span,
      avg,
      gap: data?.total.to != null ? ageText(data.total.to, data.fetched) : "—",
    };
  }, [exportRows, measure, data]);


  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <div className="text-center">
          <p className="text-[14px] font-medium">Цаг агаарын архив татагдсангүй</p>
          <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          <button className="weather-action mt-3" onClick={() => { setError(null); setRetry((v) => v + 1); }}><RefreshCw size={12} />Дахин оролдох</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <span className="text-[13.5px] text-ink-3">Цаг агаарын архив татаж байна…</span>
      </div>
    );
  }

  /*
    Хоосон архив нь АЛДАА БИШ — хуримтлал зогссон, эсвэл хараахан
    эхлээгүй байж болно. Тиймээс алдааны дэлгэц биш, хүлээгдэж буй
    төлөв.
  */
  if (!data.rows.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2 p-6">
        <div className="hatch max-w-[420px] rounded-xs border border-dashed border-line-2 px-5 py-6 text-center">
          <p className="text-[13px] leading-snug text-ink-2">
            Сүүлийн {WINDOW_DAYS} хоногт архивт ажиглалт бүртгэгдээгүй байна
          </p>
          <p className="num mt-2 text-[11px] leading-snug text-ink-3">
            {data.total.n > 0
              ? `Архивт нийт ${num(data.total.n)} заалт · сүүлчийнх ${
                  data.total.to ? dateText(data.total.to) : "—"
                }`
              : "Мэдээлэл хүлээгдэж байна"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="weather-archive flex h-full min-h-0 flex-col">
      {!rows.length ? <p role="status" className="rounded-lg border border-dashed border-line p-4 text-[12px] text-ink-2">Сонгосон хугацаанд ажиглалт бүртгэгдээгүй байна.</p> : null}
      {/* ---------------- Үзүүлэлт ---------------- */}
      <Card className="shrink-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <Stat icon={Database} label="Ажиглалтын заалт" value={num(stats.n)} sub={station ? data.stations.find((s) => String(s.sid) === station)?.name : "бүх станц · харуулсан мужид"} />
          <Stat icon={Radio} label="Станц" value={num(stats.stations)} />
          <Stat icon={CalendarRange} label="Харуулсан хугацаа" value={stats.span} />
          <Stat
            icon={Gauge}
            label={`${m.label}, дундаж`}
            value={stats.avg == null ? "—" : num(stats.avg, m.digits)}
            sub={m.unit}
          />
          <Stat
            icon={History}
            label="Архивын сүүлийн бичилт"
            value={stats.gap}
            sub={data.total.n ? `нийт ${num(data.total.n)} заалт` : undefined}
          />
        </div>
      </Card>

      {/* ---------------- Хэрэгслийн мөр ---------------- */}
      <Card className="shrink-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="eyebrow shrink-0">Хугацаа</span>
            <Segments options={RANGES} value={range} onChange={(v) => { setRange(v as RangeId); setSpot(null); }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="eyebrow shrink-0">Хэмжигдэхүүн</span>
            <Segments options={MEASURE_TABS} value={measure} onChange={(v) => { setMeasure(v); setSpot(null); }} />
          </div>
        </div>
      </Card>

      {/* ---------------- Гол сүлжээ ---------------- */}
      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ЗҮҮН: дулааны зурвас ба сонгосон станцын цуваа */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <Card className="min-h-[200px] flex-1">
            <Head title={`${m.label} — станц бүрээр`}>
              <span className="num text-[10.5px] text-ink-3">
                {spot
                  ? `${spot.name} · ${timeText(spot.t)} · ${num(spot.v, m.digits)} ${m.unit}`
                  : m.unit}
              </span>
            </Head>
            <p className="px-3 pt-2 text-[10.5px] text-ink-3">Мөрөөс станц сонгоно · нүд нь хугацааны дундаж · хоосон нүд нь заалтгүй</p>
            {strip ? (
              <Strip
                strip={strip}
                measure={m}
                selected={station}
                onSelect={setStation}
                onSpot={setSpot}
              />
            ) : (
              <div className="chart-empty m-3">Үзүүлэлт байхгүй</div>
            )}
          </Card>

          <Card className="shrink-0">
            <Head
              title={
                station == null
                  ? "Сүлжээний дундаж цуваа"
                  : `${data.stations.find((r) => String(r.sid) === station)?.name ?? "Станц"} — цуваа`
              }
            >
              <span className="num text-[10.5px] text-ink-3">{m.unit}</span>
            </Head>
            <div className="px-3 pt-2 pb-1">
              <Line points={series} measure={m} />
            </div>
          </Card>
        </div>

        {/* БАРУУН: хоногийн явц ба станцын хүснэгт */}
        <div className="flex min-h-0 flex-col gap-2">
          <Card className="shrink-0">
            <Head title="Хоногийн дундаж явц">
              <span className="num text-[10.5px] text-ink-3">UTC+08 · {station ? data.stations.find((s) => String(s.sid) === station)?.name : "бүх станц"}</span>
            </Head>
            <div className="px-3 pt-2 pb-1">
              <Hours values={hours} measure={m} />
            </div>
          </Card>

          <Card className="min-h-[160px] flex-1">
            <Head title="Станцаар">
              <span className="num text-[10.5px] text-ink-3">{m.unit}</span>
            </Head>
            <Table
              rows={table}
              columns={columns}
              keyOf={(r) => String(r.sid)}
              selected={station}
              onSelect={setStation}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   ДУЛААНЫ ЗУРВАС

   Мөр нь станц, багана нь хугацааны хэсэг, нүд нь тухайн хэсгийн
   дундаж утга. Өнгө нь бодит цагийн газрын зурагтай НЭГ шатлалаас,
   гэхдээ ТАСРАЛТГҮЙ холилттой (`ramp`): зураг нь мөн `interpolate
   linear` хэрэглэдэг тул салангид шат нь хоёр харагдацыг зөрүүлнэ.

   ⚠ ЗААЛТГҮЙ ХЭСЭГ ХООСОН үлдэнэ — өмнөх утгаар нөхвөл архив
   тасралтгүй мэт харагдаж, бичилт зогссоныг нуух болно.
   ========================================================================== */

function Strip({
  strip,
  measure,
  selected,
  onSelect,
  onSpot,
}: {
  strip: { from: number; to: number; step: number; cols: number; lines: { sid: number; name: string; cells: Cell[] }[] };
  measure: Measure;
  selected: string | null;
  onSelect: (k: string | null) => void;
  onSpot: (s: { name: string; t: number; v: number } | null) => void;
}) {
  const ticks = React.useMemo(() => {
    /* Дөрвөөс зургаан тэмдэглэгээ — илүү нь давхцана */
    const want = 5;
    const every = Math.max(1, Math.round(strip.cols / want));
    const out: { i: number; t: number }[] = [];
    for (let i = 0; i < strip.cols; i += every) {
      out.push({ i, t: strip.from + i * strip.step });
    }
    return out;
  }, [strip]);

  const dense = strip.step < 6 * 3_600_000;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
      <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-1">
        {strip.lines.map((line) => {
          const key = String(line.sid);
          const on = selected === key;
          const dim = selected != null && !on;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : key)}
              onMouseLeave={() => onSpot(null)}
              className={cn(
                "flex w-full min-w-0 items-center gap-2 rounded-xs px-1 py-0.5 text-left transition-colors hover:bg-paper-hi",
                on && "bg-paper-hi",
              )}
              style={{ opacity: dim ? 0.45 : 1 }}
            >
              <span
                className={cn(
                  "w-[96px] shrink-0 truncate text-[11px] leading-tight",
                  on ? "font-medium text-ink" : "text-ink-2",
                )}
              >
                {line.name}
              </span>
              <span className="flex min-w-0 flex-1 gap-px overflow-hidden rounded-[2px] bg-paper-3">
                {line.cells.map((c, i) => (
                  <span
                    key={i}
                    onMouseEnter={() =>
                      onSpot(
                        c.avg == null
                          ? null
                          : { name: line.name, t: strip.from + i * strip.step, v: c.avg },
                      )
                    }
                    title={
                      c.avg == null
                        ? `${line.name} · ${timeText(strip.from + i * strip.step)} · заалтгүй`
                        : `${line.name} · ${timeText(strip.from + i * strip.step)} · ${num(c.avg, measure.digits)} ${measure.unit}`
                    }
                    className="block h-[18px] min-w-0 flex-1"
                    style={{
                      background: c.avg == null ? undefined : ramp(measure, c.avg),
                      /* Нүд нарийн үед зайг хаах — 720 багана дээр нэг
                         пикселийн зай нь зурвасыг судалтай болгоно */
                      marginRight: dense ? 0 : undefined,
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Хугацааны тэнхлэг — нэрийн баганын өргөнөөр зүүн талаас эхэлнэ */}
      <div className="flex shrink-0 items-center gap-2 pl-1">
        <span className="w-[96px] shrink-0" />
        <span className="relative block h-[12px] min-w-0 flex-1">
          {ticks.map((k) => (
            <span
              key={k.i}
              className="num absolute top-0 text-[9.5px] leading-none whitespace-nowrap text-ink-3"
              style={{
                left: `${(k.i / strip.cols) * 100}%`,
                transform: k.i === 0 ? "none" : k.i / strip.cols > 0.85 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {timeText(k.t)}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/* ==========================================================================
   ЦУВАА — сонгосон станц, эсвэл сүлжээний дундаж
   ========================================================================== */

function Line({ points, measure }: { points: { t: number; v: number }[]; measure: Measure }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const H = 104;
  const L = 34;
  const R = 6;
  const T = 8;
  const B = 16;

  if (!points.length) return <div ref={box} className="chart-empty">Үзүүлэлт байхгүй</div>;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const lo = Math.min(...points.map((p) => p.v));
  const hi = Math.max(...points.map((p) => p.v));
  const pad = (hi - lo) * 0.12 || 1;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const X = (t: number) => L + ((t - t0) / Math.max(t1 - t0, 1)) * Math.max(w - L - R, 1);
  const Y = (v: number) => T + (1 - (v - yLo) / Math.max(yHi - yLo, 1e-9)) * (H - T - B);

  // Hourly archive: don't imply continuous measurements across missing hours.
  const d = points.map((p, i) => `${i && p.t - points[i - 1].t <= 90 * 60_000 ? "L" : "M"}${X(p.t).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");

  return (
    <div ref={box} className="w-full">
      {w > 0 ? (
        <svg width={w} height={H} className="num block" role="img" aria-label={measure.label}>
          {[yHi, (yHi + yLo) / 2, yLo].map((v) => (
            <g key={v}>
              <line x1={L} x2={w - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} />
              <text
                x={L - 5}
                y={Y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9.5}
                fill="var(--ink-3)"
              >
                {num(v, measure.digits)}
              </text>
            </g>
          ))}
          <path d={d} fill="none" stroke="var(--data)" strokeWidth={1.4} strokeLinejoin="round" />
          {points.map((p, i) => <circle key={`${p.t}-${i}`} cx={X(p.t)} cy={Y(p.v)} r={points.length > 120 ? 1.5 : 2.5} fill="var(--data)"><title>{timeText(p.t)} · {num(p.v, measure.digits)} {measure.unit}</title></circle>)}
          <text x={L} y={H - 3} fontSize={9.5} fill="var(--ink-3)">
            {timeText(t0)}
          </text>
          <text x={w - R} y={H - 3} textAnchor="end" fontSize={9.5} fill="var(--ink-3)">
            {timeText(t1)}
          </text>
        </svg>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   ХОНОГИЙН ДУНДАЖ ЯВЦ

   Архив Л хариулж чадах асуулт: өдрийн аль цагт хамгийн халуун,
   хүйтэн байдаг вэ. Бодит цагийн заалт үүнийг хэзээ ч хэлж чадахгүй.

   Цаг нь Улаанбаатарын UTC+08 — хөтчийн цагийн бүсээс үл хамаарна.
   ========================================================================== */

function Hours({ values, measure }: { values: (number | null)[]; measure: Measure }) {
  const has = values.filter((v): v is number => v != null);
  if (!has.length) return <div className="chart-empty">Үзүүлэлт байхгүй</div>;
  const lo = Math.min(...has);
  const hi = Math.max(...has);
  const span = hi - lo || 1;

  return (
    <div>
      <div className="flex h-[76px] items-end gap-px">
        {values.map((v, h) => (
          <span
            key={h}
            title={v == null ? `${h}:00 · заалтгүй` : `${h}:00 · ${num(v, measure.digits)} ${measure.unit}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            {v == null ? null : (
              <span
                className="block w-full rounded-t-[1px]"
                style={{
                  /* Хамгийн бага утга ч харагдах ёстой — 12%-иас
                     эхэлнэ, эс тэгвээс хүйтэн цаг огт байхгүй мэт */
                  height: `${12 + ((v - lo) / span) * 88}%`,
                  background: ramp(measure, v),
                }}
              />
            )}
          </span>
        ))}
      </div>
      <div className="num mt-1 flex justify-between text-[9.5px] leading-none text-ink-3">
        <span>0 цаг</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <div className="num mt-1 flex justify-between border-t border-line pt-1 text-[10px] leading-none text-ink-3">
        <span>
          Хамгийн бага {num(lo, measure.digits)} {measure.unit}
        </span>
        <span>
          Хамгийн их {num(hi, measure.digits)} {measure.unit}
        </span>
      </div>
    </div>
  );
}

/* ==========================================================================
   ТУСЛАХ
   ========================================================================== */

/* Хүснэгтийн тоо нь БИЧВЭР тул шатлалын эх өнгийг шууд хэрэглэхгүй —
   `readable` нь гэрэлтэлтийг горимд тохируулна ({@link readable}) */
function Val({ v, m }: { v: number | null; m: Measure }) {
  return (
    <span className="font-medium text-ink" style={v == null ? undefined : { color: readable(ramp(m, v)) }}>
      {v == null ? "·" : num(v, m.digits)}
    </span>
  );
}

/**
 * Шатлалаас ТАСРАЛТГҮЙ өнгө.
 *
 * `colorOf` нь хамгийн ойрын шатны өнгийг буцаадаг (салангид), харин
 * газрын зураг нь `interpolate linear` хэрэглэдэг. Дулааны зурвас нь
 * зурагтай нэг хэлээр ярих ёстой тул энд хольж тооцно.
 */
function ramp(m: Measure, v: number): string {
  const s = m.stops;
  if (v <= s[0][0]) return s[0][1];
  if (v >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 1; i < s.length; i++) {
    if (v > s[i][0]) continue;
    const t = (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0] || 1);
    return mix(s[i - 1][1], s[i][1], t);
  }
  return s[s.length - 1][1];
}

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)} ${c(g1, g2)} ${c(b1, b2)})`;
}

/** "09.18 14:00" — архивын нягт тэнхлэгт он хэрэггүй, бүгд нэг жилийнх */
function timeText(ms: number): string {
  const d = new Date(ms + 8 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function dateText(ms: number): string {
  const d = new Date(ms + 8 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}


/** Хэр эртний заалт вэ — "2 цагийн өмнө" */
function ageText(ms: number, now: number): string {
  const h = (now - ms) / 3_600_000;
  if (!Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} минутын өмнө`;
  if (h < 48) return `${Math.round(h)} цагийн өмнө`;
  return `${Math.round(h / 24)} хоногийн өмнө`;
}
