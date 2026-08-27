"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  FlaskConical,
  Loader2,
  MapPin,
  MousePointerClick,
  Ruler,
  TriangleAlert,
} from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { FilterBar } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type MapPoints } from "@/components/wells/map";
import {
  ELEMENTS,
  MEASURES,
  PI_CLASSES,
  PI_LIMIT,
  POINTS,
  SNAPSHOT_AT,
  exceedCount,
  measuredCount,
  piColor,
  valueOf,
  type MeasureId,
  type NeutralPoint,
} from "@/lib/neutralization";
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

/* --------------------------------------------------------------------------
   Хөрсний саармагжуулалтын самбар

   БҮТЭЦ НЬ БУСДААС ӨӨР — дөрөвхөн бичлэг тул өөр байхаас өөр аргагүй.

   Өмнөх самбарууд олон мянган бичлэгийг НЭГТГЭЖ харуулдаг: жагсаалт,
   диаграм, газрын зураг гурав хамтдаа "олонлог дотор юу давамгайлж
   байна" гэдэгт хариулдаг. Энд нэгтгэх юм алга — дөрвөн цэгийн дундаж
   гэдэг утгагүй тоо.

   Оронд нь ЖИЖИГ ОЛОН ХУВИЛБАР (small multiples): цэг тус бүр өөрийн
   баганатай, элементүүд нь бүх баганад ижил дарааллаар эгнэнэ. Нүд
   хөндлөнгөө гүйхэд "энэ элемент хаана өндөр байна", доошоо гүйхэд
   "энэ цэг дээр юу нь хэтэрсэн" гэдэг хоёулаа шууд уншигдана. Ямар ч
   диаграм, жагсаалт байхгүй — зөвхөн дөрвөн профайл.

   Газрын зураг нь ЖИЖИГ, зүүн дээд буланд: дөрвөн цэгийн байршил
   контекст өгнө, гэхдээ гол агуулга биш.
   -------------------------------------------------------------------------- */

/**
 * Индексийн зурвасын ЛОГАРИФМЫН суурь.
 *
 * Индекс 0.6-аас 223.9 хүртэл — гурван эрэмбийн зөрүү. Шугаман хуваарь
 * дээр Pb 223.9 бүх зайг эзэлж, бусад есөн элемент харагдахаа болино.
 * Логарифм дээр "хэдэн дахин хэтэрсэн" гэдэг нь ЖИГД зайд буудаг тул
 * 2 дахин ба 20 дахин хэтрэлтийн ялгаа нүдэнд харагдана.
 *
 * Агууламж (мг/кг) мөн адил хазайсан (0-аас 2190) тул хоёуланд нь
 * хэрэглэнэ. Тоог зурвасын хажууд ҮРГЭЛЖ бичнэ — зурвас нь туслах
 * дүрслэл, утга биш.
 */
const LOG_MIN = 0.1;

function logShare(v: number, max: number) {
  const lo = Math.log10(LOG_MIN);
  const hi = Math.log10(Math.max(max, LOG_MIN * 10));
  const t = (Math.log10(Math.max(v, LOG_MIN)) - lo) / (hi - lo);
  return Math.max(0, Math.min(1, t));
}

/** Цэггүй эх сурвалж — газрын зураг нь `MapPoints` хэлбэрийг л мэднэ */
function mapPointsOf(rows: NeutralPoint[]): MapPoints {
  return {
    oid: rows.map((p) => p.oid),
    lon: rows.map((p) => p.lon),
    lat: rows.map((p) => p.lat),
  };
}

export function NeutralizationDashboard() {
  const [measure, setMeasure] = React.useState<MeasureId>("pi");
  /** Хөндлөн харьцуулах элемент — бүх багана дээр зэрэг тодорно */
  const [element, setElement] = React.useState<number | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  const points = React.useMemo(() => mapPointsOf(POINTS), []);
  const visible = React.useMemo(
    () => Uint32Array.from(POINTS.map((_, i) => i)),
    [],
  );

  /* Цэгийн код нь цорын ганц таних тэмдэг тул зураг дээр шууд бичнэ —
     дөрвөн цэг тул шошго хоорондоо давхцахгүй */
  const labels = React.useMemo(
    () => ({ text: POINTS.map((p) => p.code), minzoom: 0 }),
    [],
  );

  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (POINTS.find((p) => p.oid === tip.oid) ?? null)),
    [tip.oid],
  );

  const highlight = React.useMemo<[number, number] | null>(
    () => (hovered ? [hovered.lon, hovered.lat] : null),
    [hovered],
  );

  /**
   * Сонгосон хэмжигдэхүүний БҮХ утгын дээд хязгаар.
   *
   * Дөрвөн багана НЭГ хуваарь хуваалцана — эс тэгвээс зурвасын урт нь
   * зөвхөн тухайн цэг доторх эрэмбийг хэлж, цэг хооронд харьцуулах
   * боломжгүй болно. Жижиг олон хувилбарын гол утга нь яг тэр
   * харьцуулалт.
   */
  const max = React.useMemo(() => {
    let m = 0;
    for (const p of POINTS) {
      for (let i = 0; i < ELEMENTS.length; i++) {
        const v = valueOf(p, i, measure);
        if (v != null && v > m) m = v;
      }
    }
    return m;
  }, [measure]);

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    let exceed = 0;
    let measured = 0;
    let topPi = 0;
    let topAt = "";
    let topEl = "";
    for (const p of POINTS) {
      exceed += exceedCount(p);
      measured += measuredCount(p);
      for (let i = 0; i < ELEMENTS.length; i++) {
        const v = p.pi[i];
        if (v != null && v > topPi) {
          topPi = v;
          topAt = p.code;
          topEl = ELEMENTS[i].symbol;
        }
      }
    }
    return {
      exceed,
      measured,
      topPi,
      topAt,
      topEl,
      districts: new Set(POINTS.map((p) => p.district)).size,
    };
  }, []);

  const selected = picked == null ? null : (POINTS.find((p) => p.oid === picked) ?? null);
  const activeCount = (element != null ? 1 : 0) + (picked != null ? 1 : 0);

  function reset() {
    setElement(null);
    setPicked(null);
  }

  const m = MEASURES.find((x) => x.id === measure)!;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar
        title="Хөрсний саармагжуулалт"
        activeCount={activeCount}
        onReset={reset}
        leading={
          /*
            Хэмжигдэхүүн сонгох. Хөрсний хяналт шинжилгээний самбарт
            ЖИЛ сонгодог байсан бол энд ХЭМЖИГДЭХҮҮН — тэнд хоёр жил нь
            хоёр өөр судалгаа байсан бол энд агууламж, индекс хоёр нь
            НЭГ хэмжилтийн хоёр харагдац тул чөлөөтэй сэлгэнэ.
          */
          <div className="flex shrink-0 items-center gap-1">
            {MEASURES.map((x) => {
              const on = measure === x.id;
              return (
                <button
                  key={x.id}
                  onClick={() => setMeasure(x.id)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-xs border px-2.5 py-1 text-[12px] transition-colors",
                    on
                      ? "border-data/45 bg-data/10 text-ink"
                      : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                  )}
                >
                  {x.label}
                  {x.unit ? <span className="ml-1 text-ink-3">{x.unit}</span> : null}
                </button>
              );
            })}
          </div>
        }
      >
        {element != null ? (
          <span className="num rounded-xs border border-data/40 bg-data/12 px-1.5 py-[3px] text-[11px] text-data">
            {ELEMENTS[element].symbol} · {ELEMENTS[element].name}
          </span>
        ) : (
          <span className="text-[11px] text-ink-3">
            Элемент дээр товшиж дөрвөн цэгээр харьцуулна
          </span>
        )}
      </FilterBar>

      {/* ============ ИНДИКАТОР ============ */}
      <div className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
        <div className="grid grid-cols-2 divide-x divide-y divide-line xl:grid-cols-4 xl:divide-y-0">
          <Stat
            icon={MapPin}
            label="Хэмжилт хийсэн цэг"
            value={num(POINTS.length)}
            note={`${stats.districts} дүүрэг`}
          />
          <Stat icon={FlaskConical} label="Хэмжсэн элемент" value={num(ELEMENTS.length)} />
          {/*
            Хэтэрсэн хэмжилтийг НИЙТ ХЭМЖИЛТЭД харьцуулж бичнэ: 24 гэсэн
            тоо дангаараа их үү, бага уу гэдгийг хэлэхгүй.
          */}
          <Stat
            icon={TriangleAlert}
            label="Дэвсгэр түвшнээс хэтэрсэн"
            value={`${stats.exceed} / ${stats.measured}`}
          />
          <Stat
            icon={Ruler}
            label="Хамгийн өндөр индекс"
            value={`${stats.topEl} ${stats.topPi}`}
            note={stats.topAt}
          />
        </div>
      </div>

      {/* ============ ГОЛ ХЭСЭГ ============ */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
        {/* ---- ЗҮҮН: байршил ---- */}
        <div className="flex min-h-[220px] shrink-0 flex-col gap-2.5 xl:w-[272px] 2xl:w-[308px]">
          <Card className="relative min-h-[180px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/*
                Газрын зураг нь ЖИЖИГ. Дөрвөн цэг дээр тархалт гэж
                байхгүй — зөвхөн "хаана байсан бэ" гэдэгт хариулна.
              */}
              <PointMap
                points={points}
                visible={visible}
                labels={labels}
                basemap={basemap}
                onSelect={(oid) => setPicked(picked === oid ? null : oid)}
                onHover={tip.onHover}
                highlight={highlight}
                cluster={false}
                pulse
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {hovered ? (
                <MapTip state={tip} width={216}>
                  <div className="px-2.5 pt-2 pb-1.5">
                    <span className="num text-[13px] leading-none font-medium text-data">
                      {hovered.code}
                    </span>
                  </div>
                  <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                    <MapTipRow
                      icon={MapPin}
                      text={`${hovered.district}, ${hovered.khoroo}-р хороо`}
                    />
                    <MapTipRow
                      icon={TriangleAlert}
                      num
                      text={`${exceedCount(hovered)} / ${measuredCount(hovered)} хэмжилт дэвсгэр түвшнээс дээш`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                    <span className="num text-[10px] leading-none text-ink-3">
                      {hovered.lat.toFixed(5)}° {hovered.lon.toFixed(5)}°
                    </span>
                    <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                  </div>
                </MapTip>
              ) : null}
            </div>
          </Card>

          {/*
            Индексийн зэрэглэл — Håkanson (1980)-ийн олон улсын хуваарь.
            Энэ нь эх сурвалжийн БИШ, шинжлэх ухааны нийтлэг ангилал тул
            гарчигт нь эх үүсвэрийг заавал бичнэ: уншигч үүнийг Монголын
            албан ёсны стандарт гэж эндүүрч болохгүй.
          */}
          <Card className="shrink-0">
            <Head title="Индексийн зэрэглэл">
              <span className="text-[10px] text-ink-3">Håkanson, 1980</span>
            </Head>
            <div className="divide-y divide-line">
              {PI_CLASSES.map((g, i) => (
                <div key={g.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[1px]"
                    style={{ background: piColor([0.5, 1.5, 4, 8][i] ?? 0.5) }}
                  />
                  <span className="num w-[54px] shrink-0 text-[11px] text-ink">
                    {g.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-ink-3">
                    {g.note}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ---- БАРУУН: дөрвөн профайл ---- */}
        <Card className="min-h-0 flex-1 overflow-hidden">
          <Head title="Цэг бүрийн элементийн профайл">
            <span className="text-[10.5px] text-ink-3">
              {m.label}
              {m.unit ? `, ${m.unit}` : ""} · логарифм хуваарь
            </span>
          </Head>

          <div className="min-h-0 flex-1 overflow-auto">
            {/*
              2×2 сүлжээ. Тусгаарлагчийг `divide-*`-ээр биш, НЭГ ПИКСЕЛИЙН
              ЗАВСРААР гаргана: `divide-x` нь `> * + *` дээр ажилладаг тул
              хоёр баганатай сүлжээнд гурав дахь нүд (хоёр дахь мөрийн
              эхлэл) хэрэггүй зүүн зураас авдаг. Завсрын доор гарч буй
              дэвсгэр нь өөрөө зураасын өнгө болно.
            */}
            <div className="grid min-w-[380px] grid-cols-2 gap-px bg-line">
              {POINTS.map((p) => (
                <Profile
                  key={p.oid}
                  point={p}
                  measure={measure}
                  max={max}
                  element={element}
                  onElement={setElement}
                  picked={picked === p.oid}
                  onPick={() => setPicked(picked === p.oid ? null : p.oid)}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/*
        Эх сурвалжийн бичиг. Гэрчилгээний асуудлыг ИЛ бичнэ — дата хэзээ
        хуулагдсаныг мэдэхгүй бол хуучирсан эсэхийг шүүх боломжгүй.
      */}
      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Дата: нийслэлийн байгаль орчны GIS сервер · {num(POINTS.length)} цэг ·{" "}
        {ELEMENTS.length} элемент · {SNAPSHOT_AT}-нд хуулсан хувилбар
        {selected ? ` · сонгосон: ${selected.code}` : ""}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Нэг цэгийн элементийн профайл.
 *
 * Элементийн дараалал БҮХ баганад ижил — эрэмбэлбэл нүд хөндлөнгөө
 * гүйхэд өөр элемент дээр буух тул харьцуулалт задарна.
 */
function Profile({
  point,
  measure,
  max,
  element,
  onElement,
  picked,
  onPick,
}: {
  point: NeutralPoint;
  measure: MeasureId;
  max: number;
  element: number | null;
  onElement: (i: number | null) => void;
  picked: boolean;
  onPick: () => void;
}) {
  const exceed = exceedCount(point);
  const measured = measuredCount(point);

  return (
    /* Нүд нь ТУНГАЛАГ БИШ: доорх завсрын зураас зөвхөн нүдний
       хооронд харагдах ёстой */
    <div
      className={cn("flex min-w-0 flex-col", picked ? "bg-paper-hi" : "bg-paper-2")}
    >
      <button
        onClick={onPick}
        className="block border-b border-line px-2.5 py-2 text-left transition-colors hover:bg-paper-hi"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="num truncate text-[12.5px] leading-none font-medium text-ink">
            {point.code}
          </span>
          <span className="num shrink-0 text-[10px] leading-none text-ink-3">
            {exceed}/{measured}
          </span>
        </span>
        {/* Байршил нь кодын доор: код өөрөө хаана байгааг хэлдэггүй */}
        <span className="mt-1 block truncate text-[10px] leading-none text-ink-3">
          {point.district}, {point.khoroo}-р хороо
        </span>
      </button>

      <div className="divide-y divide-line">
        {ELEMENTS.map((el, i) => {
          const v = valueOf(point, i, measure);
          /* Зэрэглэлийн өнгө нь ҮРГЭЛЖ индексээс — агууламж руу сэлгэхэд
             хуваарь солигдох ч "хэвийн эсэх" нь өөрчлөгдөхгүй */
          const pi = point.pi[i];
          const on = element === i;

          return (
            <button
              key={el.id}
              onClick={() => onElement(on ? null : i)}
              aria-pressed={on}
              className={cn(
                "flex w-full items-center gap-1.5 px-2.5 py-1 text-left transition-colors",
                on ? "bg-data/10" : "hover:bg-paper-hi",
              )}
            >
              <span
                className={cn(
                  "num w-[22px] shrink-0 text-[10.5px] leading-none",
                  on ? "text-data" : "text-ink-2",
                )}
              >
                {el.symbol}
              </span>

              <span className="relative h-[9px] min-w-0 flex-1 bg-paper-3">
                {/* Дэвсгэр түвшний заагч — зөвхөн индекс дээр утгатай */}
                {measure === "pi" ? (
                  <span
                    aria-hidden
                    className="absolute top-[-2px] bottom-[-2px] w-px bg-ink-3"
                    style={{ left: `${logShare(PI_LIMIT, max) * 100}%` }}
                  />
                ) : null}
                {v != null ? (
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[1px]"
                    style={{
                      width: `${logShare(v, max) * 100}%`,
                      background: pi != null ? piColor(pi) : "var(--line-2)",
                    }}
                  />
                ) : null}
              </span>

              <span
                className={cn(
                  "num w-[46px] shrink-0 text-right text-[10.5px] leading-none",
                  v == null ? "text-ink-3" : "text-ink",
                )}
              >
                {v == null ? "—" : v}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        Хэмжигдээгүй утгыг ил бичнэ. "—" гэсэн зураас нь тэг мэт
        уншигдаж болзошгүй тул доор нь тоогоор давтана.
      */}
      {measured < ELEMENTS.length ? (
        <p className="mt-auto px-2.5 py-1.5 text-[9.5px] leading-tight text-ink-3">
          {ELEMENTS.length - measured} элементийн индекс хэмжигдээгүй
        </p>
      ) : null}
    </div>
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
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note?: string;
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
        {note ? (
          <span className="num shrink-0 text-[10.5px] leading-none text-ink-3">{note}</span>
        ) : null}
      </span>
    </div>
  );
}
