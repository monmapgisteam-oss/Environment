"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { MEASURES, type Measure, type MeasureId } from "@/lib/weather";
import {
  WINDOW_DAYS,
  fetchArchive,
  type ArchiveData,
  type ArchiveRow,
} from "@/lib/weather-archive";
import { num } from "@/lib/utils";
import { Card, Head } from "./ui";
import { Segments } from "./viz";

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

/* --------------------------------------------------------------------------
   СЭДЭВ ТУС БҮРЭЭР — СОНГОСОН СТАНЦЫН ЦУВАА

   ⚠⚠ ДУЛААНЫ ЗУРВАС УСТГАГДСАН (хэрэглэгчийн шийдвэр, 2026-09-21:
   "энэ үнэхээр ойлгомжгүй юм аа … станц сонгоно … сэдэв сэдвээрээ
   салаад chart болно шүү"). Тэр нь долоон станцыг жижиг дөрвөлжин
   болгон НЭГ хэмжигдэхүүнээр зурдаг байв: нүд нь хэдхэн пиксел тул
   утга нь уншигдахгүй, хэмжигдэхүүн нь нэг удаад нэг л харагдана.

   Одоо эсрэгээр: СТАНЦ нь шүүлтүүр, ХЭМЖИГДЭХҮҮН бүр өөрийн
   диаграмтай. Нэг станцын таван үзүүлэлт зэрэг харагдах тул "халуун
   байхад чийг нь ямар байв" гэсэн асуулт нэг харцаар уншигдана —
   өмнө нь хэмжигдэхүүн бүрийг ээлжлэн сонгох шаардлагатай байлаа.

   ⚠ Станц сонгоогүй үед цуваа нь СҮЛЖЭЭНИЙ ДУНДАЖ (цагаар нэгтгэсэн).
   Нэг станцыг дурын байдлаар түрүүлгэх нь буруу мэдээлэл өгнө.
   -------------------------------------------------------------------------- */

export function WeatherArchive() {
  const [data, setData] = React.useState<ArchiveData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [range, setRange] = React.useState<RangeId>("7");
  /** Хоосон мөр нь БҮХ станц — сүлжээний дундаж */
  const [station, setStation] = React.useState("");
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchArchive(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, [retry]);

  const days = RANGES.find((r) => r.id === range)?.days ?? 7;

  /*
    ⚠⚠ ОГНООНЫ МУЖ СОНГОХ БОЛОМЖ БАЙХГҮЙ (хэрэглэгчийн шийдвэр,
    2026-09-21: "сар хэрэггүй"). Архив 2026-09-11-нд эхэлсэн бөгөөд
    код нь сүүлийн 30 хоногийг л татдаг тул сар сонгох нь одоогоор
    ганц сонголт өгнө. Муж нь зөвхөн доорх товчнуудаас гарна.
  */
  const rows = React.useMemo(() => {
    if (!data?.rows.length) return [];
    const last = data.rows[data.rows.length - 1].t;
    return data.rows.filter((r) => r.t >= last - days * 86_400_000);
  }, [data, days]);

  /** Станцын сонголт — эхэнд нь бүх станц */
  const stationTabs = React.useMemo(
    () => [
      { id: "", label: "Бүх станц" },
      ...(data?.stations ?? []).map((s) => ({
        id: String(s.sid),
        label: s.name,
      })),
    ],
    [data],
  );

  const sid = station === "" ? null : Number(station);
  const mine = React.useMemo(
    () => (sid == null ? rows : rows.filter((r) => r.sid === sid)),
    [rows, sid],
  );

  /** Хэмжигдэхүүн бүрийн цуваа ба хураангуй */
  const subjects = React.useMemo(
    () =>
      MEASURES.map((m) => {
        const pts: { t: number; v: number }[] = [];
        if (sid == null) {
          /* Сүлжээний дундаж — цаг тутмын нүдэнд нэгтгэнэ */
          const bucket = new Map<number, { sum: number; n: number }>();
          for (const r of mine) {
            const v = VALUE[m.id](r);
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
          for (const r of mine) {
            const v = VALUE[m.id](r);
            if (v != null) pts.push({ t: r.t, v });
          }
        }
        let min: number | null = null;
        let max: number | null = null;
        let sum = 0;
        for (const p of pts) {
          if (min == null || p.v < min) min = p.v;
          if (max == null || p.v > max) max = p.v;
          sum += p.v;
        }
        return { m, pts, min, max, avg: pts.length ? sum / pts.length : null };
      }),
    [mine, sid],
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <div className="text-center">
          <p className="text-[14px] font-medium">
            Цаг агаарын архив татагдсангүй
          </p>
          <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          <button
            type="button"
            className="weather-action mx-auto mt-4"
            onClick={() => {
              setError(null);
              setRetry((v) => v + 1);
            }}
          >
            <RefreshCw size={13} />
            Дахин оролдох
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <span className="text-[13.5px] text-ink-3">
          Цаг агаарын архив татаж байна…
        </span>
      </div>
    );
  }

  if (!data.rows.length) {
    return (
      <div className="hatch flex h-full items-center justify-center rounded-xs border border-dashed border-line-2">
        <p className="text-center text-[12px] leading-snug text-ink-3">
          Мэдээлэл хүлээгдэж байна
        </p>
      </div>
    );
  }

  return (
    <div className="weather-archive flex h-full min-h-0 flex-col">
      {/*
        ⚠⚠ ҮЗҮҮЛЭЛТИЙН ЗУРВАС ХАСАГДСАН (хэрэглэгчийн шийдвэр,
        2026-09-21: "дээрх indicator хэрэггүй тул del"). Заалтын тоо,
        станцын тоо, хугацааны муж гурав нь шүүлтүүрийн мөрөнд
        сонгосон зүйлээ давтаж хэлдэг байв; дундаж нь диаграм бүрийн
        толгойд аль хэдийн гарна.
      */}
      {/* ---------------- Шүүлтүүр ---------------- */}
      <Card className="shrink-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="eyebrow shrink-0">Хугацаа</span>
            <Segments
              options={RANGES}
              value={range}
              onChange={(v) => setRange(v as RangeId)}
            />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="eyebrow shrink-0">Станц</span>
            <Segments
              options={stationTabs}
              value={station}
              onChange={setStation}
            />
          </div>
        </div>
      </Card>

      {/* ---------------- Сэдэв тус бүрийн цуваа ----------------
          ⚠ Таван диаграм нэг дэлгэцэнд багтахгүй тул ЭНЭ БАГАНА дотроо
          гүйнэ. Архив нь хэмжих хэрэгслийн самбар биш УНШИХ харагдац —
          дээрээс доош сэдэв сэдвээр уншигдана. */}
      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto xl:grid-cols-2">
        {subjects.map((s) => (
          <Card key={s.m.id} className="min-h-[164px]">
            <Head title={s.m.label}>
              <span className="num text-[10.5px] text-ink-3">
                {s.min == null || s.max == null || s.avg == null
                  ? s.m.unit
                  : `бага ${num(s.min, s.m.digits)} · дундаж ${num(s.avg, s.m.digits)} · их ${num(s.max, s.m.digits)} ${s.m.unit}`}
              </span>
            </Head>
            <div className="px-3 pt-2 pb-1">
              {s.pts.length ? (
                <Line points={s.pts} measure={s.m} />
              ) : (
                <div className="chart-empty">
                  Энэ хугацаанд заалт бүртгэгдээгүй байна
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   ⚠⚠ ДУЛААНЫ ЗУРВАС (`Strip`) УСТГАГДСАН, 2026-09-21. Долоон станцыг
   жижиг дөрвөлжөөр харуулдаг байсан нь уншигдахгүй байв — дээрх
   тайлбарыг үз. Хэрэв олон станцыг зэрэг харьцуулах хэрэгцээ
   эргэж гарвал git түүхээс сэргээнэ.
   ========================================================================== */

/* ==========================================================================
   ЦУВАА — сонгосон станц, эсвэл сүлжээний дундаж
   ========================================================================== */

function Line({
  points,
  measure,
}: {
  points: { t: number; v: number }[];
  measure: Measure;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.round(e.contentRect.width)),
    );
    ro.observe(el);
    setW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const H = 104;
  const L = 34;
  const R = 6;
  const T = 8;
  const B = 16;

  if (!points.length)
    return (
      <div ref={box} className="chart-empty">
        Үзүүлэлт байхгүй
      </div>
    );

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const lo = Math.min(...points.map((p) => p.v));
  const hi = Math.max(...points.map((p) => p.v));
  const pad = (hi - lo) * 0.12 || 1;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const X = (t: number) =>
    L + ((t - t0) / Math.max(t1 - t0, 1)) * Math.max(w - L - R, 1);
  const Y = (v: number) =>
    T + (1 - (v - yLo) / Math.max(yHi - yLo, 1e-9)) * (H - T - B);

  // Hourly archive: don't imply continuous measurements across missing hours.
  const d = points
    .map(
      (p, i) =>
        `${i && p.t - points[i - 1].t <= 90 * 60_000 ? "L" : "M"}${X(p.t).toFixed(1)} ${Y(p.v).toFixed(1)}`,
    )
    .join(" ");

  return (
    <div ref={box} className="w-full">
      {w > 0 ? (
        <svg
          width={w}
          height={H}
          className="num block"
          role="img"
          aria-label={measure.label}
        >
          {/*
            ⚠⚠ ШОШГО нь БОДИТ хамгийн бага, их утга — зурах хуваарийн
            ХАВСАРГАСАН хязгаар БИШ (2026-09-21). Хуваарь нь дээр доороо
            12% зай авдаг тул түүгээр шошиглоход чийг "105 %", салхи
            "−0.4 м/с" гэж БОЛОМЖГҮЙ утга харуулж байв. Зураас нь одоо
            бодит хязгаар дээр суух ба хоёр талдаа зайтай үлдэнэ.
          */}
          {[hi, (hi + lo) / 2, lo].map((v) => (
            <g key={v}>
              <line
                x1={L}
                x2={w - R}
                y1={Y(v)}
                y2={Y(v)}
                stroke="var(--line)"
                strokeWidth={1}
              />
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
          <path
            d={d}
            fill="none"
            stroke="var(--data)"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle
              key={`${p.t}-${i}`}
              cx={X(p.t)}
              cy={Y(p.v)}
              r={points.length > 120 ? 1.5 : 2.5}
              fill="var(--data)"
            >
              <title>
                {timeText(p.t)} · {num(p.v, measure.digits)} {measure.unit}
              </title>
            </circle>
          ))}
          <text x={L} y={H - 3} fontSize={9.5} fill="var(--ink-3)">
            {timeText(t0)}
          </text>
          <text
            x={w - R}
            y={H - 3}
            textAnchor="end"
            fontSize={9.5}
            fill="var(--ink-3)"
          >
            {timeText(t1)}
          </text>
        </svg>
      ) : null}
    </div>
  );
}

/** "09.18 14:00" — архивын нягт тэнхлэгт он хэрэггүй, бүгд нэг жилийнх */
function timeText(ms: number): string {
  const d = new Date(ms + 8 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
