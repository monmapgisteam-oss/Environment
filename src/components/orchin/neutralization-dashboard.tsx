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
import { Columns } from "@/components/ui/resizable-columns";
import {
  ELEMENTS,
  PI_LIMIT,
  fetchNeutralization,
  exceedCount,
  measuredCount,
  piColor,
  type NeutralPoint,
} from "@/lib/neutralization";
import { readableText } from "@/lib/soil";
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
  /* Дата нь шинэ порталаас ирдэг болсон тул ачаалах, алдааны төлөвтэй.
     Урьд нь кодод бичигдсэн байсан — гэрчилгээний саад арилсны дараа
     амьд холболт руу шилжсэн */
  const [rows, setRows] = React.useState<NeutralPoint[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetchNeutralization()
      .then((d) => alive && setRows(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  /** Хөндлөн харьцуулах элемент — бүх багана дээр зэрэг тодорно */
  const [element, setElement] = React.useState<number | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  /* Ачаалагдаагүй үед хоосон жагсаалт — доорх `useMemo`-нууд бүгд
     хоосон дээр аюулгүй ажиллана, хамгаалалтын блок нь зурагдахаас нь
     өмнө таслана */
  const sites = React.useMemo(() => rows ?? [], [rows]);

  const points = React.useMemo(() => mapPointsOf(sites), [sites]);
  const visible = React.useMemo(
    () => Uint32Array.from(sites.map((_, i) => i)),
    [sites],
  );

  /* Цэгийн код нь цорын ганц таних тэмдэг тул зураг дээр шууд бичнэ —
     дөрвөн цэг тул шошго хоорондоо давхцахгүй */
  const labels = React.useMemo(
    /* Шошго нь `kh_mon` (хорооны монгол нэр); хоосон бол цэгийн код */
    () => ({ text: sites.map((p) => p.khMon || p.code), minzoom: 0 }),
    [sites],
  );

  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (sites.find((p) => p.oid === tip.oid) ?? null)),
    [tip.oid, sites],
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
    for (const p of sites) {
      for (let i = 0; i < ELEMENTS.length; i++) {
        const v = p.pi[i];
        if (v != null && v > m) m = v;
      }
    }
    return m;
  }, [sites]);

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    let exceed = 0;
    let measured = 0;
    let topPi = 0;
    let topAt = "";
    let topEl = "";
    for (const p of sites) {
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
      districts: new Set(sites.map((p) => p.district)).size,
    };
  }, [sites]);

  const selected = picked == null ? null : (sites.find((p) => p.oid === picked) ?? null);
  const activeCount = (element != null ? 1 : 0) + (picked != null ? 1 : 0);

  function reset() {
    setElement(null);
    setPicked(null);
  }

  if (error || !rows) {
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
            Саармагжуулалтын хэмжилт татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar
        title="ХҮНД МЕТАЛЛЫН БОХИРДЛЫН ИНДЕКС БА АГУУЛАМЖ"
        activeCount={activeCount}
        onReset={reset}
      >
        {element != null ? (
          <span className="num rounded-xs border border-data/40 bg-data/12 px-1.5 py-[3px] text-[11px] text-data">
            {ELEMENTS[element].symbol} · {ELEMENTS[element].name}
          </span>
        ) : null}
      </FilterBar>

      {/* ============ ГОЛ ХЭСЭГ ============ */}
      <Columns layout="flex" id="neutralization" left={700} className="min-h-0 flex-1">
        {/*
          ---- ЗҮҮН: байршил ----
          Зураг ТОГТМОЛ өргөнтэй: дөрвөн цэг дээр тархалт гэж байхгүй тул
          өргөн нь зөвхөн байршлыг таниулахад хүрэлцэхэд л хангалттай.
          Үлдсэн зайг профайл авна — гол агуулга тэнд байна.
        */}
        <div className="flex min-h-[260px] shrink-0 flex-col gap-2.5 xl:w-(--col-l)">
          {/* Индикатор ЗӨВХӨН газрын зургийн дээр, 2×2 тэнцүү нүд (хэрэглэгчийн шийдвэр, 2026-09-17) */}
                <div className="shrink-0 overflow-hidden rounded-xs border border-line bg-line">
            <div className="grid grid-cols-2 gap-px">
              <Stat
                icon={MapPin}
                label="Хэмжилт хийсэн цэг"
                value={num(sites.length)}
                note={`${stats.districts} дүүрэг`}
              />
              {/*
                Хэтэрсэн хэмжилтийг НИЙТ ХЭМЖИЛТЭД харьцуулж бичнэ: 24 гэсэн
                тоо дангаараа их үү, бага уу гэдгийг хэлэхгүй.
              */}
              <Stat
                icon={TriangleAlert}
                label="Дэвсгэр түвшнээс хэтэрсэн"
                value={`${stats.exceed} / ${stats.measured}`}
              />
              <Stat icon={FlaskConical} label="Хэмжсэн элемент" value={num(ELEMENTS.length)} />
              <Stat
                icon={Ruler}
                label="Хамгийн өндөр индекс"
                value={`${stats.topEl} ${stats.topPi}`}
                note={stats.topAt}
              />
            </div>
          </div>
          <Card className="relative min-h-[220px] flex-1 overflow-hidden">
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

        </div>

        {/*
          ---- БАРУУН: дөрвөн профайл ----
          Тогтмол өргөнтэй: элементийн мөр бүр тэмдэг, зурвас, тоо гурвыг
          агуулдаг тул хэт нарийсвал тоо таслагдана. Үлдсэн зайг газрын
          зураг авна.
        */}
        {/* Карт мөрийн БҮТЭН өндрийг авч, дөрвөн профайл түүнийг дүүргэнэ
            (хэрэглэгчийн шийдвэр, 2026-09-17): агуулгаараа дуусгавал доор
            нь хоосон зай үлдэж байв. Элементийн мөрүүд картын өндөрт
            жигд тархана; агуулга дэлгэцээс урт бол дотроо гүйнэ */}
        <Card className="min-h-0 min-w-0 overflow-hidden xl:flex-1">

          <div className="min-h-0 flex-1 overflow-auto">
            {/*
              2×2 сүлжээ. Тусгаарлагчийг `divide-*`-ээр биш, НЭГ ПИКСЕЛИЙН
              ЗАВСРААР гаргана: `divide-x` нь `> * + *` дээр ажилладаг тул
              хоёр баганатай сүлжээнд гурав дахь нүд (хоёр дахь мөрийн
              эхлэл) хэрэггүй зүүн зураас авдаг. Завсрын доор гарч буй
              дэвсгэр нь өөрөө зураасын өнгө болно.
            */}
            {/* Нүд хоорондын зураас ЗӨВХӨН голын босоо — хэвтээ, хүснэгт мэт
                тор байхгүй (хэрэглэгч 2026-09-17) */}
            <div className="grid h-full min-h-0 min-w-[400px] grid-cols-2 grid-rows-2 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-line/55">
              {sites.map((p) => (
                <Profile
                  key={p.oid}
                  point={p}
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
      </Columns>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Дата: нийслэлийн байгаль орчны GIS сервер · {num(sites.length)} цэг ·{" "}
        {ELEMENTS.length} элемент
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
  max,
  element,
  onElement,
  picked,
  onPick,
}: {
  point: NeutralPoint;
  max: number;
  element: number | null;
  onElement: (i: number | null) => void;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    /* Нүд нь ТУНГАЛАГ БИШ: доорх завсрын зураас зөвхөн нүдний
       хооронд харагдах ёстой */
    <div
      className={cn("flex min-w-0 flex-col", picked ? "bg-paper-hi" : "bg-paper-2")}
    >
      {/*
        Толгойд БАЙРШИЛ. Цэгийн код (BZD-9) нь газрын зураг дээр шошго
        болж, хөвөгч тайлбарт бас гардаг тул энд давхардуулах шаардлагагүй —
        оронд нь "хаана" гэдэг нь хүснэгтийн баганын нэр болно.
      */}
      <button
        onClick={onPick}
        className="block border-b border-line px-2.5 py-2.5 text-left transition-colors hover:bg-paper-hi"
      >
        <span className="block truncate text-[12.5px] leading-none font-medium text-ink">
          {point.district} дүүрэг, {point.khoroo}-р хорооны үзүүлэлт
        </span>
      </button>

      {/*
        ИНДЕКС БА АГУУЛАМЖ НЭГ МӨРӨНД (хэрэглэгчийн шийдвэр, 2026-09-17:
        "нэгтгээд нэг самбар болго"). Урьд нь хоёрын хооронд сэлгэдэг
        байсан — нэг хэмжилтийн хоёр харагдацыг сэлгэх нь харьцуулахад
        саад. Зурвас нь ИНДЕКСЭЭР (дэвсгэр түвшний заагчтай), хажууд нь
        хоёр тоо: индекс, мг/кг. Толгойн мөр баганыг нэрлэнэ.
      */}
      <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1 text-[9px] tracking-[0.08em] text-ink-3 uppercase">
        <span className="w-[22px] shrink-0" />
        <span className="min-w-0 flex-1" />
        <span className="w-[40px] shrink-0 text-right">PLI</span>
        <span className="w-[52px] shrink-0 text-right">мг/кг</span>
      </div>
      {/* Мөрүүд картын өндөрт жигд тархана — профайл нүд сунах үед */}
      <div className="flex min-h-0 flex-1 flex-col justify-evenly divide-y divide-line">
        {ELEMENTS.map((el, i) => {
          const pi = point.pi[i];
          const c = point.c[i];
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
                {/* Дэвсгэр түвшний заагч (индекс 1) */}
                <span
                  aria-hidden
                  className="absolute top-[-2px] bottom-[-2px] z-10 w-px bg-ink"
                  style={{ left: `${logShare(PI_LIMIT, max) * 100}%` }}
                />
                {/* Зурвас ДҮҮРГЭЛТТЭЙ (хэрэглэгчийн шийдвэр, 2026-09-17) —
                    урьд нь зөвхөн хүрээтэй байв. Дэвсгэр түвшний заагч
                    зурвасын дээгүүр харагдсаар байна */}
                {/*
                  Зурвас ХОЁР хэсэгтэй: дэвсгэр түвшин (индекс 1) хүртэлх
                  хэсэг тогтмол, түүнээс ХЭТЭРСЭН хэсэг л удаанаар анивчина
                  (хэрэглэгч 2026-09-17: "зураасаас зүүн тийш анивчихгүй").
                  Хэтрээгүй бол ганц тогтмол зурвас.
                */}
                {pi != null &&
                  (() => {
                    const val = logShare(pi, max) * 100;
                    const lim = logShare(PI_LIMIT, max) * 100;
                    const over = pi >= PI_LIMIT && val > lim;
                    const fill = { background: `${piColor(pi)}59`, borderColor: piColor(pi) };
                    return (
                      <>
                        <span
                          className="absolute inset-y-0 left-0 rounded-r-[1px] border"
                          style={{ width: `${over ? lim : val}%`, ...fill }}
                        />
                        {over && (
                          <span
                            className="blink-slow absolute inset-y-0 rounded-r-[1px] border border-l-0"
                            style={{ left: `${lim}%`, width: `${val - lim}%`, ...fill }}
                          />
                        )}
                      </>
                    );
                  })()}
              </span>

              <span
                className={cn(
                  "num w-[40px] shrink-0 text-right text-[10.5px] leading-none",
                  pi == null ? "text-ink-3" : "text-ink",
                )}
                style={pi != null ? { color: readableText(piColor(pi)) } : undefined}
              >
                {pi == null ? "—" : pi}
              </span>
              <span
                className={cn(
                  "num w-[52px] shrink-0 text-right text-[10.5px] leading-none",
                  c == null ? "text-ink-3" : "text-ink-2",
                )}
              >
                {c == null ? "—" : num(c)}
              </span>
            </button>
          );
        })}
      </div>

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
    /* Голлосон ч ЭГНЭСЭН (хэрэглэгч 2026-09-17: "иконы доор икон, үсгийн
       доор үсэг эхэлнэ"): агуулгыг нүдэндээ тус тусад нь голлуулбал
       нэрийн уртаас болж мөр хооронд икон зөрдөг байв. Тиймээс дотоод
       блок нь тогтмол өргөнтэй (`max-w`, хамгийн урт нэрд тааруулсан) —
       блок нь голлож, агуулга нь блокийнхоо зүүн ирмэгээс эхэлдэг тул
       нэг баганын хоёр нүд яг нэг шугамаас эхэлнэ. Нүд нарийсвал
       `w-full` хоёуланд ижил тул эгнээ хэвээр. */
    <div className="flex items-center justify-center bg-paper-2 px-3 py-2">
      <div className="flex w-full max-w-[250px] items-center gap-2">
      <Icon size={32} strokeWidth={1.3} className="shrink-0 text-(--tone)" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="eyebrow text-[11px] leading-[1.25] whitespace-nowrap">{label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="num truncate text-[18px] leading-none font-medium text-ink">
            {value}
          </span>
          {note ? (
            <span className="num shrink-0 text-[10.5px] leading-none text-ink-3">{note}</span>
          ) : null}
        </span>
      </div>
      </div>
    </div>
  );
}
