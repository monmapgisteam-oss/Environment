"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Database,
  Loader2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { Columns } from "@/components/ui/resizable-columns";
import {
  defaultBasemap,
  type Basemap,
  type MapPoints,
} from "@/components/wells/map";
import { MEASURES, type Measure, type MeasureId } from "@/lib/weather";
import {
  WINDOW_DAYS,
  fetchArchive,
  type ArchiveData,
  type ArchiveRow,
  type ArchiveStation,
} from "@/lib/weather-archive";
import { num } from "@/lib/utils";
import { Card, Head } from "./ui";
import { Segments } from "./viz";

/*
  ⚠⚠ НИЙТ ҮҮЛШИЛ АРХИВЫН ДИАГРАМД ОРОХГҮЙ (хэрэглэгчийн шийдвэр,
  2026-09-21: "Нийт үүлшил энэ chart хэрэггүй юм байна").

  ⚠ Хэмжигдэхүүн өөрөө ХАСАГДААГҮЙ: бодит цагийн табын заалтын нүд,
  газрын зургийн сонголт хоёрт хэвээр байна — тэнд энэ нь ОДООГИЙН
  тэнгэрийн байдлыг хэлдэг. Хасагдсан нь зөвхөн ЦУВАА: үүлшил нь
  0–10 баллын бүдүүн шатлалтай тул хугацааны тэнхлэг дээр шаталсан
  шугам болж, чиг хандлага уншигдахгүй.
*/
const ARCHIVE_MEASURES = MEASURES.filter((m) => m.id !== "cloud");

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
      ARCHIVE_MEASURES.map((m) => {
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

      {/* ---------------- Зүүн: сэдвүүд · Баруун: зураг ----------------
          ⚠⚠ ТАВАН ДИАГРАМ НЭГ БАГАНАД (хэрэглэгчийн шийдвэр,
          2026-09-21). Урьд нь хоёр баганат тор байсан бөгөөд сондгой
          тав нь сүүлийн эгнээг хагас хоосон үлдээдэг байв. Нэг
          баганад цуварсан нь мөн ХАРЬЦУУЛАХАД зөв: диаграмууд
          хугацааны НЭГ тэнхлэг хуваалцдаг тул дээр дооргүй эгнэхэд
          "халуун байхад чийг нь ямар байв" гэдэг босоогоор уншигдана.
          ⚠ Таван карт нэг дэлгэцэнд багтахгүй тул БАГАНА дотроо
          гүйнэ; зураг нь гүйхгүй, бүтэн өндрөө барина. */}
      <Columns id="weather-archive" left={640} className="min-h-0 flex-1">
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {subjects.map((s) => (
            <Card key={s.m.id} className="min-h-[164px] flex-1">
              <Head title={s.m.label}>
                <span className="num text-[10.5px] text-ink-3">
                  {s.min == null || s.max == null || s.avg == null
                    ? s.m.unit
                    : `бага ${num(s.min, s.m.digits)} · дундаж ${num(s.avg, s.m.digits)} · их ${num(s.max, s.m.digits)} ${s.m.unit}`}
                </span>
              </Head>
              <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-1">
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

        <ArchiveMap
          stations={data.stations}
          station={station}
          onPick={setStation}
        />
      </Columns>
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
  /*
    ⚠ ӨРГӨН, ӨНДӨР ХОЁУЛАА ХЭМЖИГДЭНЭ. Урьд нь өндөр нь 104px гэж
    кодод бичигдсэн байсан тул дөрвөн карт баганынхаа өндрийг дүүргэж
    чадахгүй, доороо хоосон талбай үлдээдэг байв. Одоо карт нь үлдсэн
    өндрийг ХУВААЛЦАЖ (`flex-1`), диаграм нь картаа дүүргэнэ — нам
    дэлгэц дээр доод хязгаартаа тулаад багана өөрөө гүйнэ.
  */
  const box = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);
  const [h, setH] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setW(Math.round(e.contentRect.width));
      setH(Math.round(e.contentRect.height));
    });
    ro.observe(el);
    setW(Math.round(el.clientWidth));
    setH(Math.round(el.clientHeight));
    return () => ro.disconnect();
  }, []);

  const H = Math.max(96, h);
  const L = 34;
  const R = 6;
  const T = 8;
  const B = 16;

  if (!points.length)
    return (
      <div ref={box} className="chart-empty h-full">
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
    <div ref={box} className="h-full min-h-[96px] w-full">
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

/* --------------------------------------------------------------------------
   АРХИВЫН ГАЗРЫН ЗУРАГ

   ⚠⚠ УРЬД НЬ АРХИВ ЗУРАГГҮЙ БАЙВ (хэрэглэгчийн шийдвэр, 2026-09-21:
   "энэ 5 чартыг зүүн талд 1 column 5 row болгоод оруул, харин баруун
   талд нь map"). Хоёр таб элементээ давтахгүй гэсэн дүрэм ХҮЧИНТЭЙ
   хэвээр — энэ зураг нь бодит цагийнхыг ДАВТАХГҮЙ:

     · бодит цагийнх нь ОДООГИЙН заалтыг тоогоор бичдэг, хэмжигдэхүүн
       нь сонгогддог;
     · архивынх нь ХУРИМТЛАЛЫГ хэлнэ — цэгийн хэмжээ нь тухайн станц
       энэ цонхонд хэдэн заалт өгснийг заана. "Аль станц тасалдалгүй
       бичигдэж байна вэ" гэдэг нь зөвхөн архивын хариулдаг асуулт.

   ⚠ ӨНГӨ ГАНЦ (`--data`): шатлалын хоёр үзүүрт нэг өнгө өгснөөр
   зөвхөн РАДИУС нь хэмжигдэхүүн үүрнэ (платформын "дата дүрслэлийн
   өнгө ганц" дүрэм). Заалтын тоо нь эрэмбэтэй хэмжүүр биш, бүрэн
   бүтэн байдлын тоолол тул олон өнгө шаардахгүй.

   ⚠ Цэг товшиход тэр станцаар ШҮҮНЭ — шүүлтүүрийн мөрийн "Станц"
   товчлууртай НЭГ төлөв. Хоёр дахь удирдлага биш, гурав дахь зам.
   -------------------------------------------------------------------------- */

const ARCHIVE_DOT = "#67d7e4";

function ArchiveMap({
  stations,
  station,
  onPick,
}: {
  stations: ArchiveStation[];
  station: string;
  onPick: (id: string) => void;
}) {
  const tip = useMapTip();
  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  /* Координатгүй станц зурагт ОРОХГҮЙ — (0, 0) нь Гвинейн булан */
  const shown = React.useMemo(
    () => stations.filter((s) => s.lat != null && s.lon != null),
    [stations],
  );

  const points = React.useMemo<MapPoints>(
    () => ({
      oid: shown.map((s) => s.sid),
      lon: shown.map((s) => s.lon as number),
      lat: shown.map((s) => s.lat as number),
    }),
    [shown],
  );

  const visible = React.useMemo(
    () => Uint32Array.from(shown.map((_, i) => i)),
    [shown],
  );

  const grades = React.useMemo(() => {
    const top = Math.max(1, ...shown.map((s) => s.n));
    return {
      values: shown.map((s) => s.n),
      /* Хоёр үзүүрт НЭГ өнгө — радиус л хэмжигдэхүүн үүрнэ */
      stops: [
        [0, ARCHIVE_DOT],
        [top, ARCHIVE_DOT],
      ] as [number, string][],
      firefly: true as const,
    };
  }, [shown]);

  /*
    ⚠⚠ ШОШГЫН ХЯЗГААР 0 — бодит цагийн зургийнх шиг 8 БИШ. Анхны
    харагдац 1:900 000 нь z≈7.8 тул найман түвшний хязгаар долоон
    нэрийг бүгдийг нь нуудаг байв (хэмжиж тогтоосон). Тэр зураг дээр
    станцын НЭР нь хоёрдогч — заалт нь тоогоороо бичигддэг; энд харин
    нэр нь цэгийн ЦОРЫН ГАНЦ таних тэмдэг.
  */
  const labels = React.useMemo(
    () => ({ text: shown.map((s) => s.name), minzoom: 0 }),
    [shown],
  );

  const hovered = React.useMemo(
    () =>
      tip.oid == null ? null : (shown.find((s) => s.sid === tip.oid) ?? null),
    [shown, tip.oid],
  );

  const picked = station === "" ? null : Number(station);
  const spot = React.useMemo(() => {
    const id = tip.oid ?? picked;
    return id == null ? null : (shown.find((s) => s.sid === id) ?? null);
  }, [shown, tip.oid, picked]);

  return (
    <div className="weather-map flex min-h-0 flex-col overflow-hidden border border-line bg-paper-2 max-xl:min-h-[420px]">
      <div className="relative min-h-0 flex-1">
        <PointMap
          points={points}
          visible={visible}
          labels={labels}
          grades={grades}
          scale={900_000}
          basemap={basemap}
          /* Товшилт нь шүүлтүүр: дахин товшиход цуцлагдана */
          onSelect={(id) => onPick(String(id) === station ? "" : String(id))}
          onHover={tip.onHover}
          cluster={false}
          highlight={
            spot ? [spot.lon as number, spot.lat as number] : null
          }
        />
        <BasemapGallery
          value={basemap}
          onChange={setBasemap}
          placement="top-left"
        />
        {hovered ? (
          <MapTip state={tip}>
            <MapTipRow icon={MapPin} text={hovered.name} />
            {hovered.place && hovered.place !== hovered.name ? (
              <MapTipRow icon={Building2} text={hovered.place} />
            ) : null}
            <MapTipRow
              icon={Database}
              text={`${num(hovered.n)} заалт`}
            />
          </MapTip>
        ) : null}
      </div>
    </div>
  );
}
