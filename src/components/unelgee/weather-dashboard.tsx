"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  RefreshCw,
  Clock,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudMoon,
  Cloudy,
  Droplets,
  Gauge as GaugeIcon,
  History,
  ListFilter,
  Loader2,
  MapPin,
  Mountain,
  Moon,
  Radio,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { Columns } from "@/components/ui/resizable-columns";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import {
  CAPITAL,
  FRESH_HOURS,
  MEASURES,
  ageHours,
  ageText,
  colorOf,
  dayLabel,
  fetchWeather,
  localTime,
  measureOf,
  stopHex,
  windName,
  type MeasureId,
  type Obs,
  type Station,
  type WeatherData,
} from "@/lib/weather";
import { cn, num } from "@/lib/utils";
import { WeatherArchive } from "./weather-archive";
import "./weather.css";

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
   ЦАГ АГААРЫН АЖИГЛАЛТ

   БҮТЭЦ НЬ БУСДААС ӨӨР: энэ бол бүртгэлийн сан биш, МЭДРЭГЧИЙН СҮЛЖЭЭ.
   Эх сурвалж нь зөвхөн хамгийн сүүлийн заалтыг өгдөг (түүхийн зам
   байхгүй) тул тоолох, задлах, хугацааны цуваа зурах зүйл алга —
   диаграм, шүүлтүүрийн мөр, задаргааны багана энд ХЭРЭГГҮЙ.

   Тиймээс хуудас нь ХЭМЖИХ ХЭРЭГСЛИЙН САМБАР хэлбэртэй:

     1. Сонгосон станцын одоогийн заалт — зэрэгцээ зургаан хэрэгсэл,
     2. Тэр станцын 5 хоногийн урьдчилсан мэдээ — өдөр, шөнөөр,
     3. Сүлжээ өөрөө — станцын жагсаалт ба газрын зураг.

   Дээд хоёр давхарга нь НЭГ станцынх, доод давхарга нь бүх сүлжээнийх.
   Станц сонгох нь жагсаалтаас ч, зургаас ч болно.

   ⚠ ХУУДАС ГҮЙХГҮЙ — платформын бусад самбартай ижил, нэг дэлгэцэнд
   багтана. Дээд хоёр давхарга нь өөрийн агуулгын өндөртэй (`shrink-0`),
   сүлжээний давхарга үлдсэн бүх зайг эзэлнэ. Тиймээс газрын зурагт
   доод хязгаар ТАВИХГҮЙ: `min-h` тавибал намхан дэлгэц дээр хуудас
   хальж, гүйлгүүр эргэж гарна. (Урьд нь `overflow-y-auto` +
   `min-h-[640px]` байсныг хассан.)

   ЗААЛТЫН НАС ХАМТ ГАРНА. Сүлжээ нэгэн жигд биш: ихэнх станц 10 минут
   тутам мэдээлдэг ч хэдэн арав нь долоо хоногоор чимээгүй байдаг.
   Хуучирсан тоог одоогийнх мэт харуулбал самбар өөрөө худал хэлнэ.

   ⚠ ХАМРАХ ХҮРЭЭ НЬ ЗӨВХӨН НИЙСЛЭЛ. Эх сурвалж улсын 317 станцыг өгдөг
   ч энэ платформ нь Нийслэлийн Байгаль орчны газрынх тул `Нийслэл`
   аймагт харьяалагдах ДОЛООН станц л үлдэнэ (Улаанбаатар, Буянт-Ухаа,
   Мишээл Экспо, Өлзийт, Партизан, Тэрэлж, Багануур). Улсын бусад станц
   нь энэ байгууллагын хариуцах хүрээнд байхгүй бөгөөд тэднийг үлдээвэл
   жагсаалт, зураг хоёулаа хэрэглэгчийн хайдаггүй зүйлээр дүүрнэ.
   -------------------------------------------------------------------------- */

/** Хотын төв станц (`obs/data/aws/292`) жагсаалтын толгойд суана */
const MAIN_SID = 292;

/*
  ⚠⚠ НЭГ ГАЗРЫН ЗУРАГ (хэрэглэгчийн шийдвэр, 2026-09-21: "2 биш 1 map
  болгоод mapiin баруун талд мапын дээрх 5 button оруул").

  Урьд нь хэмжигдэхүүнийг хоёр бүлэгт хувааж (агаарын төлөв / тэнгэр,
  салхи) хоёр зураг зэрэгцүүлдэг байв. Хоёр зураг тус бүр хагас
  өргөнтэй болж, нийслэлийн долоон станц бие бие дээрээ шахагддаг
  байлаа. Одоо нэг зураг бүтэн өргөнөө эзэлж, таван хэмжигдэхүүн нь
  зургийн БАРУУН ДЭЭД буланд босоо жагсаалт болов.

  ⚠ Баруун ИРМЭГИЙН ДУНД ойртуулах товч, 2D/3D сэлгэгч сууна;
  зүүн дээд буланд суурь зургийн сонголт. Тиймээс хэмжигдэхүүний
  жагсаалт баруун ДЭЭД буланд л багтана.
*/
const MEASURE_ICONS: Record<MeasureId, LucideIcon> = {
  temp: Thermometer,
  humidity: Droplets,
  wind: Wind,
  pressure: GaugeIcon,
  cloud: Cloud,
};

/* --------------------------------------------------------------------------
   ХОЁР ХАРАГДАЦ — БОДИТ ЦАГ ба АРХИВ (хэрэглэгчийн шийдвэр, 2026-09-21)

   Нэг сэдвийн ХОЁР ӨӨР асуулт тул нэг дэлгэцэнд нийлүүлээгүй:

     · **Бодит цаг** — мэдрэгч ОДОО юу хэлж байна вэ. Хугацааны тэнхлэг
       огт байхгүй (эх сурвалжийн API түүх өгдөггүй), газрын зураг
       давамгайлна.
     · **Архив** — ТҮҮХ. `Tsag_agaar_arhiv` давхаргаас уншина; газрын
       зураг байхгүй, оронд нь хугацааны тэнхлэг давамгайлна.

   Хоёуланг нэг хуудсанд тавибал дэлгэц хоёр дахин уртсаж, аль нь
   одоогийнх, аль нь өнгөрсний тоо болох нь холилдоно.

   ⚠ Сонгоогүй харагдац УНТРААНА (`unmount`): доторх MapLibre зураг нь
   нуугдсан контейнерт хэмжээгээ алддаг. Архивын дата нь модулийн
   кэштэй тул буцаж ирэхэд дахин татагдахгүй; бодит цагийнх харин
   ДАХИН татагдана — "одоо" гэдэг нь хуучирдаг утга.
   -------------------------------------------------------------------------- */

const VIEWS = [
  { id: "live", label: "Бодит цагийн ажиглалт", icon: Radio },
  { id: "archive", label: "Ажиглалтын архив", icon: History },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export function WeatherDashboard() {
  const [view, setView] = React.useState<ViewId>("live");
  const [refresh, setRefresh] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(true);

  return (
    <div className="weather-workspace flex h-full min-h-0 flex-col">
      <div
        className="weather-nav shrink-0"
        role="group"
        aria-label="Ажиглалтын харагдац"
      >
        {VIEWS.map((v) => {
          const on = v.id === view;
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={on}
              className={cn(
                "flex items-center gap-1.5 rounded-xs border px-2.5 py-1.5 text-[11.5px] leading-none transition-colors",
                on
                  ? "border-(--tone)/45 bg-(--tone)/10 text-(--tone)"
                  : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
              )}
            >
              <Icon size={13} strokeWidth={1.8} className="shrink-0" />
              {v.label}
            </button>
          );
        })}
        {view === "live" ? (
          <button
            type="button"
            className="weather-action ml-auto"
            disabled={refreshing}
            onClick={() => setRefresh((v) => v + 1)}
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Шинэчлэх
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {view === "live" ? (
          <LiveWeather
            refresh={refresh}
            setRefresh={setRefresh}
            refreshing={refreshing}
            setRefreshing={setRefreshing}
          />
        ) : (
          <WeatherArchive />
        )}
      </div>
    </div>
  );
}

/** Ажиглалттай станц — бүртгэл, сүүлийн заалт, түүний нас */
type Row = { st: Station; obs: Obs; age: number | null };

function LiveWeather({
  refresh,
  setRefresh,
  refreshing,
  setRefreshing,
}: {
  refresh: number;
  setRefresh: React.Dispatch<React.SetStateAction<number>>;
  refreshing: boolean;
  setRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [data, setData] = React.useState<WeatherData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showForecast, setShowForecast] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  /* Хэрэглэгчийн өгсөн зам нь 292 — Улаанбаатар. Тэр нь анхны станц */
  const [sid, setSid] = React.useState(292);
  /* НЭГ зураг, нэг хэмжигдэхүүн. Сонголт нь зургийн баруун дээд
     буланд (`MeasurePicker`) */
  const [measureA, setMeasureA] = React.useState<MeasureId>("temp");
  /* Хуучирсан заалт анхнаасаа нуугдана — "одоогийн байдал" гэдэг нь
     долоо хоногийн өмнөх тоог агуулах ёсгүй */

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  /*
    Жагсаалтын hover нь ТУСДАА төлөв. `tip.onHover`-ыг дуудвал болохгүй:
    тэр нь хулганы байрлалыг зургийн пикселээс авдаг бөгөөд жагсаалт
    түүнийг өгөх боломжгүй — тайлбар нь хамгийн сүүлийн байрлалдаа
    (эхлээд зургийн зүүн дээд буланд) хөлдөж гарна. Жагсаалтаас
    зөвхөн газрын зурган дээрх ТОДРУУЛГЫГ асаана.
  */
  const [listHover, setListHover] = React.useState<number | null>(null);
  /* Хэрэглэгч станц сонгосон эсэх. Сонгоогүй байхад зураг нь нийслэлийн
     бүх станцыг багтаана — нэн даруй нэг станц руу ойртвол бусад зургаа
     нь харагдахгүй, сүлжээ мэт уншигдахаа болино */
  const [touched, setTouched] = React.useState(false);
  const [overview, setOverview] = React.useState(0);

  const pickStation = React.useCallback((id: number) => {
    setSid(id);
    setTouched(true);
    setOverview((v) => v + 1);
  }, []);

  React.useEffect(() => {
    const ac = new AbortController();
    let busy = false;
    const update = async () => {
      if (busy) return;
      busy = true;
      setRefreshing(true);
      try {
        const result = await fetchWeather(ac.signal);
        if (!ac.signal.aborted) {
          setData(result);
          setError(null);
          setNow(Date.now());
        }
      } catch (e) {
        if (!ac.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Мэдээлэл татахад алдаа гарлаа",
          );
      } finally {
        busy = false;
        if (!ac.signal.aborted) setRefreshing(false);
      }
    };
    void update();
    const poll = window.setInterval(() => {
      if (!document.hidden) void update();
    }, 300_000);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      ac.abort();
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [refresh, setRefreshing]);

  /**
   * Ажиглалттай станцууд, заалтын настай нь хамт.
   *
   * Бүртгэлд байгаа боловч мэдээлээгүй станц ХАСАГДАНА — тэднийг
   * үлдээвэл жагсаалтад утгагүй хоосон мөр болж эгнэнэ.
   */
  const rows = React.useMemo(() => {
    if (!data) return [];
    const out: Row[] = [];
    for (const st of data.stations) {
      if (st.aimag !== CAPITAL) continue;
      const obs = data.obs.get(st.sid);
      if (!obs) continue;
      out.push({ st, obs, age: ageHours(obs.at, now) });
    }
    /* Хотын төв станц түрүүлнэ, бусад нь цагаан толгойн дарааллаар */
    return out.sort(
      (a, b) =>
        Number(b.st.sid === MAIN_SID) - Number(a.st.sid === MAIN_SID) ||
        a.st.name.localeCompare(b.st.name, "mn"),
    );
  }, [data, now]);

  /*
    Жагсаалтын хамрах хүрээ. ХЭМЖИГДЭХҮҮНЭЭС ХАМААРАХГҮЙ: хоёр зураг
    өөр өөр хэмжигдэхүүнтэй болсон тул жагсаалтыг аль нэгнийх нь
    дагуу хумивал нөгөө зураг дээр харагдаж буй станц жагсаалтад
    байхгүй болно. Хэмжигдэхүүнгүй станцыг зураг бүр ӨӨРӨӨ хасна.
  */
  /*
    ⚠⚠ ЖАГСААЛТАД ШҮҮЛТ БАЙХГҮЙ (хэрэглэгчийн шийдвэр, 2026-09-21:
    хайлтын мөр ба "Сүүлийн 12 цагийн заалт" шүүлтийг хоёуланг нь
    хасуулсан). Нийслэлд долоон станц байдаг тул долоон мөрөөс хайх
    зүйл алга; шинэлгийн шүүлт нь ч практикт нэгийг ч хасдаггүй байв
    (хамгийн ховор мэдээлдэг хоёр станц 6 цаг тутам заалт өгдөг).

    ⚠ ХУУЧИРСАН ЗААЛТЫГ НУУХГҮЙ, харин НАСЫГ НЬ ил хэлнэ: мөр бүр
    "12 минутын өмнө" гэж бичигдэх ба сонгосон станцын заалт
    хуучирсан бол толгойд нь анхааруулгын зурвас гарна. Нуусан шүүлт
    нь станцыг чимээгүй алга болгох тул түүнээс дээр.
  */
  const shown = rows;

  const current = React.useMemo(
    () => rows.find((r) => r.st.sid === sid) ?? null,
    [rows, sid],
  );

  const forecast = data?.forecast.get(sid) ?? [];
  const selectedLon = current?.st.lon;
  const selectedLat = current?.st.lat;
  const west = Math.min(...rows.map((r) => r.st.lon));
  const south = Math.min(...rows.map((r) => r.st.lat));
  const east = Math.max(...rows.map((r) => r.st.lon));
  const north = Math.max(...rows.map((r) => r.st.lat));

  /* Станц сонгоход зураг тийш нь ойртоно */
  const focus = React.useMemo<Extent | null>(() => {
    if (!touched || selectedLon == null || selectedLat == null) {
      if (!overview || !Number.isFinite(west)) return null;
      return [west - 0.05, south - 0.05, east + 0.05, north + 0.05];
    }
    const d = 0.12;
    return [selectedLon - d, selectedLat - d, selectedLon + d, selectedLat + d];
  }, [selectedLon, selectedLat, touched, overview, west, south, east, north]);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">
              Цаг агаарын мэдээ татагдсангүй
            </p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
            <button
              className="weather-action mt-3"
              disabled={refreshing}
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw size={12} />
              Дахин оролдох
            </button>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Цаг агаарын ажиглалт татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="weather-live flex h-full min-h-0 flex-col">
      {error ? (
        <p role="status" className="text-[11px] text-ochre">
          Шинэчилж чадсангүй. Өмнөх таталтын заалтыг харуулж байна. {error}
        </p>
      ) : null}
      {/* ---------------- 1. Сонгосон станцын заалт ----------------

          ⚠⚠ ЗААЛТ БҮР ТУСДАА КАРТ (хэрэглэгчийн шийдвэр, 2026-09-21,
          жишээ зургийг заан: "картууд салгаад байна"). Платформын
          нягт сүлжээний дүрэм нь хоосон зайгаар биш ЗУРААСААР
          тусгаарлахыг заадаг ч энэ эгнээ нь жагсаалт биш ХЭМЖИХ
          ХЭРЭГСЛИЙН САМБАР: заалт бүр бие даасан мэдрэгчийнх тул
          тусад нь харагдах нь зөв.

          ⚠ Гүнийг СҮҮДРЭЭР биш ДАВХАРГААР гаргана (платформын нэгдүгээр
          дүрэм): хэсгийн дэвсгэр нь `paper` (canvas), карт нь `paper-2`
          тул картууд өөрсдөө тодорч, сүүдэр шаардахгүй.
          ⚠ Булан нь `rounded-xs` хэвээр — жишээ зурагт илүү дугуй ч
          булангийн радиус нь платформын таних тэмдэг бөгөөд энэ нэг
          эгнээг бусад хорин таван самбараас салгах болно. */}
      {/*
        ⚠⚠ ЗААЛТ БА УРЬДЧИЛСАН МЭДЭЭ ЭЭЛЖЛЭН харагдана (хэрэглэгчийн
        хүсэлт, 2026-09-21: "5 хоногийн урьдчилсан мэдээг нээвэл энэ
        хэсэг автоматаар hide, харин хаавал эргээд хуучин хэвэнд").

        Шалтгаан нь хуудасны өндөр: энэ самбар нэг дэлгэцэнд багтах
        ёстой (`shrink-0` + доорх зураг `flex-1`). Урьдчилсан мэдээ
        нээгдэхэд ~150px нэмэгдэж, зураг тэр хэмжээгээр хумигдана.
        Хоёр давхарга нь НЭГ станцын тухай, ХОЁР өөр хугацааны асуулт
        (одоо ба ирээдүй) тул зэрэг харах шаардлага бага — ээлжлэхэд
        зураг бүтэн өндрөө хадгална.
      */}
      {showForecast ? null : (
        <section className="observation-panel shrink-0 border border-line bg-paper">
          <header className="observation-header">
            <span className="observation-station-icon">
              <MapPin size={20} strokeWidth={1.6} aria-hidden />
            </span>
            <div className="observation-heading">
              <h2>
                {current
                  ? `${current.st.name} станцын сүүлийн ажиглалт`
                  : "Станц сонгогдоогүй"}
              </h2>
            </div>
            {/* ⚠⚠ ӨНДӨРШЛИЙН ОРОНД СТАНЦЫН ШҮҮЛТҮҮР (хэрэглэгчийн
              шийдвэр, 2026-09-21). Станцын жагсаалт баганаас
              хасагдсан тул сонгох хэрэгсэл энд шилжив; өндөршил нь
              газрын зургийн хөвөгч тайлбарт хэвээр */}
            <StationPicker rows={rows} sid={sid} onPick={pickStation} />
            {current ? (
              <>
                <span
                  className={cn(
                    "observation-time num",
                    (current.age == null || current.age > FRESH_HOURS) &&
                      "is-stale",
                  )}
                >
                  <Clock size={14} aria-hidden />
                  <span>
                    <strong>{localTime(current.obs.at)}</strong>
                    <small>{ageText(current.obs.at, now)}</small>
                  </span>
                </span>
              </>
            ) : null}
          </header>
          {current && (current.age == null || current.age > FRESH_HOURS) ? (
            <p
              role="status"
              className="border-b border-line bg-ochre/10 px-3 py-2 text-[11px] text-ochre"
            >
              {current.age == null
                ? "Ажиглалтын хугацаа тодорхойгүй."
                : "Энэ станцын заалт хуучирсан."}{" "}
              Доорх утгууд нь хамгийн сүүлд ирсэн ажиглалт.
            </p>
          ) : null}

          {/*
          ⚠⚠ КАРТУУД ТЭНЦҮҮ ӨРГӨНТЭЙ БИШ (хэрэглэгчийн шийдвэр,
          2026-09-21: "картын өргөнг нэмэх нь зөв байсан бололтой,
          Агаарын даралт, Нийт үүлшил, Салхи эний 3-ийн картын өргөн
          бага байсан ч болно шүү дээ").

          Зургаан баганыг тэнцүү хуваахад урт нэртэй хоёр карт
          ("Мэдрэгдэх температур" 140px, "Агаарын харьцангуй чийг"
          158px) шошгоо нэг мөрөнд багтаахгүй байв. Богино нэртэй
          гурав ("Агаарын даралт", "Нийт үүлшил", "Салхи") харин
          илүү зайтай байсан.

          Доорх жин нь ХЭМЖСЭН хэрэгцээ: шошгоо нэг мөрөнд багтаахад
          шаардагдах өргөн дээр тэмдэг (28), зай (6), доторх зай (12)
          нэмсэн дүн. `fr` нэгж тул дэлгэц өөрчлөгдөхөд харьцаа нь
          хэвээр хуваагдана.
        */}
          {current ? (
            <div className="observation-grid">
              <Gauge
                label="Агаарын температур"
                value={current.obs.temp}
                unit="°C"
                digits={1}
                icon={Thermometer}
                tone={colorOf(measureOf("temp"), current.obs.temp)}
                accent
              />
              {/* Мэдрэгдэх температур нь ИЖИЛ хэмжигдэхүүн, ижил нэгж тул
                ижил тэмдэгтэй — өнгө нь утгаараа өөрөө ялгарна */}
              <Gauge
                label="Мэдрэгдэх температур"
                value={current.obs.feels}
                unit="°C"
                digits={1}
                icon={Thermometer}
                tone={colorOf(measureOf("temp"), current.obs.feels)}
              />
              <Gauge
                label="Агаарын харьцангуй чийг"
                value={current.obs.humidity}
                unit="%"
                digits={0}
                icon={Droplets}
                tone={colorOf(measureOf("humidity"), current.obs.humidity)}
              />
              <Gauge
                label="Агаарын даралт"
                value={current.obs.pressure}
                unit="гПа"
                digits={1}
                icon={GaugeIcon}
                tone={colorOf(measureOf("pressure"), current.obs.pressure)}
              />
              <Gauge
                label="Нийт үүлшил"
                value={current.obs.cloud}
                unit="балл"
                digits={0}
                icon={Cloud}
                tone={colorOf(measureOf("cloud"), current.obs.cloud)}
              />
              {/* ⚠⚠ ЛУУЖИН ХАСАГДСАН (хэрэглэгчийн шийдвэр,
                2026-09-21). Салхины зүг нь одоо зүүн баганын РАДАРТ,
                сүлжээний бусад станцтайгаа зэрэг харагдана — нэг
                станцын зүгийг хоёр газар зурах нь давхардал. Улмаас
                энэ нүд бусад тавтайгаа ЯГ ИЖИЛ бүтэцтэй болов */}
              <Gauge
                label="Салхи"
                value={current.obs.wind}
                unit="м/с"
                digits={1}
                icon={Wind}
                tone={colorOf(measureOf("wind"), current.obs.wind)}
              />

              {/*
              Эх сурвалжийн албан жагсаалтад байгаа ч ажиглалт бүрд
              ирдэггүй талбарууд. Цасны зузаан нь улирлын, температурын
              их/бага нь тодорхой цагийн ажиглалтынх — ирсэн үед нь л
              нүд нэмэгдэнэ. Хоосон нүд гаргавал самбар нь хэмжигдээгүй
              зүйлийг хэмжсэн мэт харагдана.
            */}
              {current.obs.tmin != null ? (
                <Gauge
                  label="Хамгийн бага температур"
                  value={current.obs.tmin}
                  unit="°C"
                  digits={1}
                  icon={Thermometer}
                  tone={colorOf(measureOf("temp"), current.obs.tmin)}
                />
              ) : null}
              {current.obs.tmax != null ? (
                <Gauge
                  label="Хамгийн их температур"
                  value={current.obs.tmax}
                  unit="°C"
                  digits={1}
                  icon={Thermometer}
                  tone={colorOf(measureOf("temp"), current.obs.tmax)}
                />
              ) : null}
              {/* Цас, тунадас хоёрт шатлал БАЙХГҮЙ тул тэмдэг нь өнгөгүй —
                таамгаар өнгө өгвөл утга заасан мэт уншигдана */}
              {current.obs.snowDepth != null ? (
                <Gauge
                  label="Цасны зузаан"
                  value={current.obs.snowDepth}
                  unit="см"
                  digits={0}
                  icon={Snowflake}
                />
              ) : null}
              {current.obs.precip != null ? (
                <Gauge
                  label="Хур тунадас"
                  value={current.obs.precip}
                  unit="мм"
                  digits={1}
                  icon={CloudRain}
                />
              ) : null}
            </div>
          ) : (
            <Empty text="Сонгосон станц ажиглалт илгээгээгүй байна" />
          )}
        </section>
      )}

      {/* ---------------- 2. Урьдчилсан мэдээ ---------------- */}
      <section className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
        <button
          type="button"
          aria-expanded={showForecast}
          aria-controls="weather-forecast"
          onClick={() => setShowForecast((v) => !v)}
          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
        >
          <span className="eyebrow shrink-0">
            Таван хоногийн урьдчилсан мэдээ
          </span>
          <span className="min-w-0 flex-1" />
          <ChevronDown
            size={14}
            className={cn(
              "text-ink-3 transition-transform",
              showForecast && "rotate-180",
            )}
          />
        </button>

        {showForecast ? (
          <div id="weather-forecast" className="border-t border-line">
            {forecast.length ? (
              <div
                className="forecast-grid"
                role="list"
                aria-label="Таван хоногийн урьдчилсан мэдээ"
              >
                {forecast.map((d) => {
                  const l = dayLabel(d.date);
                  return (
                    <article
                      key={d.date}
                      className="forecast-day"
                      role="listitem"
                      aria-label={`${l.day}, ${l.weekday}`}
                    >
                      <header className="forecast-date">
                        <span>{l.weekday}</span>
                        <time dateTime={d.date} className="num">
                          {l.day.replace("-", ".")}
                        </time>
                      </header>

                      {/* Өдөр, шөнийн температур — хоёр мөр, нэг хуваарь */}
                      <div className="forecast-periods">
                        <TempRow
                          label="Өдөр"
                          value={d.dayTemp}
                          feels={d.dayFeels}
                          pheno={d.dayPheno}
                          phenoId={d.dayPhenoId}
                        />
                        <TempRow
                          label="Шөнө"
                          value={d.nightTemp}
                          feels={d.nightFeels}
                          pheno={d.nightPheno}
                          phenoId={d.nightPhenoId}
                        />
                      </div>

                      <footer className="forecast-details">
                        <span title="Өдрийн хур тунадас орох магадлал">
                          <Droplets size={13} aria-hidden />
                          <span>Тунадас</span>
                          <strong className="num">
                            {d.dayPrecip == null ? "—" : `${num(d.dayPrecip)}%`}
                          </strong>
                        </span>
                        <span title="Өдрийн салхины хурд">
                          <Wind size={13} aria-hidden />
                          <span>Салхи</span>
                          <strong className="num">
                            {d.dayWind == null ? "—" : `${num(d.dayWind)} м/с`}
                          </strong>
                        </span>
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty text="Энэ станцад урьдчилсан мэдээ бүртгэгдээгүй байна" />
            )}
          </div>
        ) : null}
      </section>

      {/* ---------------- 3. Сүлжээ ---------------- */}
      {/* Газрын зураг нь хуудасны гол эзэлхүүн — индикатор, урьдчилсан
          мэдээ хоёр нь дээрээ нимгэн зурвас болж суух ба сүлжээний
          зураг доор нь бүтэн өндрөөр дэлгэгдэнэ */}
      <Columns id="weather-2" left={320} className="min-h-0 flex-1">
        {/* Зүүн багана — хэмжигдэхүүний сонголт дээр, станцын
            жагсаалт доор нь */}
        <div className="flex min-h-0 flex-col gap-2">
          <MeasurePicker value={measureA} onChange={setMeasureA} />

          {/* ⚠⚠ СТАНЦЫН ЖАГСААЛТЫН ОРОНД САЛХИНЫ РАДАР (хэрэглэгчийн
              шийдвэр, 2026-09-21). Жагсаалт нь сонгосон хэмжигдэхүүний
              тоог станц бүрээр давтдаг байсан — тэдгээр нь газрын зураг
              дээр аль хэдийн, байршилтайгаа хамт бичигддэг. Станц сонгох
              ажил толгойн шүүлтүүр, зураг, радар гуравт үлдсэн */}
          <div className="weather-rose flex min-h-0 flex-1 flex-col overflow-hidden border border-line bg-paper-2 max-xl:min-h-[280px]">
            <div className="flex items-baseline justify-between gap-2 border-b border-line px-2.5 py-1.5">
              <span className="eyebrow">Салхины зүг, хурд</span>
              <span className="num text-[10.5px] text-ink-3">
                {num(shown.length)} станц
              </span>
            </div>
            <WindRadar
              rows={shown}
              sid={sid}
              onPick={pickStation}
              hover={listHover}
              onHover={setListHover}
            />
          </div>
        </div>

        <StationMap
          rows={shown}
          measure={measureA}
          selectedSid={sid}
          onPick={pickStation}
          spotSid={listHover}
          focus={focus}
          basemap={basemap}
          onBasemap={setBasemap}
          fetched={now}
        />
      </Columns>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Эх сурвалж: Ус цаг уур, орчны шинжилгээний газар · Нийслэлийн{" "}
        {num(rows.length)} станц · Суурь зураг: Esri
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------
   СТАНЦЫН ЗУРАГ

   Хоёр зураг ИЖИЛ бүрэлдэхүүнээр зурагдана — зөвхөн хэмжигдэхүүний
   бүлэг нь өөр. Хуулбарлаж хоёр удаа бичвэл цэгийн хэмжээ, тайлбар,
   хөвөгч тайлбар гурав эрт орой хэзээ нэгэн цагт зөрнө.

   Тайлбар (`useMapTip`) нь зураг БҮРД тусдаа: байрлалыг өөрийн
   хүрээнийхээ пикселээр тооцдог тул хуваалцвал нөгөө зураг дээрээ
   гарна.

   Станц сонголт (`sid`), ойртолт (`focus`), суурь зураг нь ХУВААЛЦСАН:
   аль ч зураг дээр товшиход дээд талын заалт, урьдчилсан мэдээ хоёр
   хамт солигдоно.
   -------------------------------------------------------------------------- */

function StationMap({
  rows,
  measure,
  onPick,
  spotSid,
  focus,
  basemap,
  onBasemap,
  fetched,
  selectedSid,
}: {
  selectedSid: number;
  rows: { st: Station; obs: Obs; age: number | null }[];
  measure: MeasureId;
  onPick: (id: number) => void;
  /** Жагсаалтаас чиглэсэн тодруулга */
  spotSid: number | null;
  focus: Extent | null;
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
  fetched: number;
}) {
  const tip = useMapTip();
  const m = measureOf(measure);

  /* Энэ хэмжигдэхүүнийг мэдээлээгүй станцыг ЭНЭ зураг хасна. Жагсаалт
     нь бүтнээрээ үлдэх тул нөгөө зурагт харагдсаар байна */
  const shown = React.useMemo(
    () => rows.filter((r) => m.of(r.obs) != null),
    [rows, m],
  );

  const points = React.useMemo<MapPoints>(
    () => ({
      oid: shown.map((r) => r.st.sid),
      lon: shown.map((r) => r.st.lon),
      lat: shown.map((r) => r.st.lat),
    }),
    [shown],
  );

  const visible = React.useMemo(
    () => Uint32Array.from(shown.map((_, i) => i)),
    [shown],
  );

  /*
    ЦЭГИЙН ОРОНД ЗААЛТ.

    ⚠⚠ Олон улсын цаг уурын зургийн жишиг (WMO-гийн station model,
    Windy, Ventusky): станцын байрлалд тоо нь ӨӨРӨӨ бичигдэнэ.
    Хэрэглэгч цэг бүр дээр товшиж үзэхгүйгээр долоон станцын заалтыг
    нэг харцаар уншина.

    ⚠ НЭГЖ нь тоотойгоо ХАМТ бичигдэнэ (хэрэглэгчийн шийдвэр,
    2026-09-21: "нэгжийг бич"). Станцын сонгодог моделид нэгж
    бичигддэггүй — тэнд суудал нь юу болохыг хэлдэг. Бидний зурагт
    суудал нэг тул нэгжгүй тоо нь "18.4" гэж ганцаараа үлдэж, юуны
    тоо болох нь зөвхөн толгойгоос уншигдана.
    ⚠ Нэгж нэмэгдсэнээр бичвэр уртсаж, давхцал нэмэгдэнэ — MapLibre
    өөрөө цөөрүүлдэг тул алсаас зарим станц нуугдаж болно.

    ⚠ Өнгө нь `stopHex` — шатлалын ТҮҮХИЙ hex. `colorOf` нь гэрэл,
    харанхуйд өөр утга буцаадаг тул зурагт ОРОХГҮЙ (газрын зураг хоёр
    горимд ижил байх дүрэм).
  */
  const values = React.useMemo(
    () => ({
      text: shown.map((r) => {
        const v = m.of(r.obs);
        return v == null ? "" : `${num(v, m.digits)} ${m.unit}`;
      }),
      color: shown.map((r) => stopHex(m, m.of(r.obs))),
      maxzoom: 24,
    }),
    [shown, m],
  );

  /* Цэг долоохон тул нэрийг нь шууд зурган дээр бичнэ */
  const labels = React.useMemo(
    () => ({ text: shown.map((r) => r.st.name), minzoom: 8 }),
    [shown],
  );

  const hovered = React.useMemo(
    () =>
      tip.oid == null ? null : (rows.find((r) => r.st.sid === tip.oid) ?? null),
    [rows, tip.oid],
  );

  const spot = React.useMemo(() => {
    const id = tip.oid ?? spotSid ?? selectedSid;
    return id == null ? null : (shown.find((r) => r.st.sid === id) ?? null);
  }, [shown, tip.oid, spotSid, selectedSid]);

  return (
    <div className="weather-map flex min-h-0 flex-col overflow-hidden border border-line bg-paper-2 max-xl:min-h-[420px]">
      <div className="relative min-h-0 flex-1">
        <PointMap
          points={points}
          visible={visible}
          labels={labels}
          values={values}
          /* Анхны харагдац ҮРГЭЛЖ 1:900 000 (хэрэглэгчийн шийдвэр,
             2026-09-21) — станцын тархалтаас хамаарч өөрчлөгдөхгүй */
          scale={900_000}
          basemap={basemap}
          onSelect={onPick}
          onHover={tip.onHover}
          focus={focus}
          cluster={false}
          highlight={spot ? [spot.st.lon, spot.st.lat] : null}
        />
        <BasemapGallery
          value={basemap}
          onChange={onBasemap}
          placement="top-left"
        />
        {!shown.length ? (
          <div className="absolute inset-x-12 top-20 rounded-lg border border-line bg-paper-2 p-4 text-center text-[12px] text-ink-2">
            Энэ хэмжигдэхүүнд тохирох заалт алга. Станцын хайлт, хугацааны
            шүүлтүүрээ өөрчилнө үү.
          </div>
        ) : null}

        {hovered ? (
          <MapTip state={tip}>
            <div className="space-y-1 px-2.5 py-2">
              <MapTipRow icon={MapPin} text={hovered.st.name} />
              <MapTipRow
                icon={Thermometer}
                text={`${m.label}: ${
                  m.of(hovered.obs) == null
                    ? "Хэмжигдээгүй"
                    : `${num(m.of(hovered.obs)!, m.digits)} ${m.unit}`
                }`}
                num
              />
              <MapTipRow
                icon={Mountain}
                text={`${num(hovered.st.elev)} м`}
                num
              />
              <MapTipRow
                icon={Clock}
                text={ageText(hovered.obs.at, fetched)}
                num
              />
            </div>
          </MapTip>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ХЭМЖИГДЭХҮҮНИЙ СОНГОГЧ

   ⚠⚠ ЗҮҮН БАГАНЫН ДЭЭД КАРТ, станцын жагсаалтын дээр (хэрэглэгчийн
   шийдвэр, 2026-09-21). Богино хугацаанд зургийн баруун дээд буланд
   хөвөгч жагсаалт байсан ч зураг дээр хөвөх нь газрын зургийн
   талбайг иддэг бөгөөд сонголтын хэрэгслүүд хоёр тийш (зүүнд
   станц, зурган дээр хэмжигдэхүүн) тарж байв. Одоо сонгох бүх зүйл
   НЭГ баганад: юугаар өнгөлөх вэ → аль станц вэ.

   ⚠ ХАРИЛЦАН ҮГҮЙСГЭХ сонголт тул унтраалга биш РАДИО мөр: нэг цэгэн
   давхарга нэг л өнгөний хуваарь үүрч чадна.

   ⚠ Товчнууд ТЭМДЭГТЭЙ ч нэр нь ХАСАГДААГҮЙ — зөвхөн тэмдгээр
   үлдээвэл дэлгэц дээр товчлол гаргахгүй дүрэм зөрчигдөж, аль нь
   юу болохыг таамаглахад хүрнэ.
   -------------------------------------------------------------------------- */

function MeasurePicker({
  value,
  onChange,
}: {
  value: MeasureId;
  onChange: (id: MeasureId) => void;
}) {
  return (
    <section className="weather-picker shrink-0 overflow-hidden border border-line bg-paper-2">
      <header className="border-b border-line px-2.5 py-1.5">
        <div className="eyebrow">Цаг уурын элемент</div>
      </header>
      <div
        role="group"
        aria-label="Газрын зурагт харуулах цаг уурын элемент"
        className="divide-y divide-line"
      >
        {MEASURES.map((x) => {
          const Icon = MEASURE_ICONS[x.id];
          const on = x.id === value;
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(x.id)}
              className={cn(
                "relative flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors",
                on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
              )}
            >
              {on ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)"
                />
              ) : null}
              <Icon
                size={15}
                strokeWidth={1.7}
                aria-hidden
                className={cn("shrink-0", on ? "text-(--tone)" : "text-ink-3")}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 text-[11px] leading-tight",
                  on ? "font-medium text-ink" : "text-ink-2",
                )}
              >
                {x.label}
              </span>
              <span className="num text-[10px] text-ink-3">{x.unit}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Өнгөний тайлбар нь зургийн гадна, хэмжигдэхүүний сонгогчид байрлана.
   ГАЗРЫН ЗУРАГ ДЭЭРХ ӨНГӨНИЙ ТАЙЛБАР УСТГАГДСАН (хэрэглэгчийн шийдвэр,
   2026-09-21: "map дээр байгаа legend-ийг ав").

   Дүрслэл өөрчлөгдсөн нь шалтгаан: цэгийн оронд заалт нь ТООГООРОО,
   НЭГЖТЭЙГЭЭ бичигддэг болсон тул өнгө нь гол суваг байхаа больж,
   халуун хүйтнийг сануулах нэмэлт болов. Хэмжигдэхүүний нэр, нэгж нь
   зургийн толгойд бий.

   Тайлбар нь зургийн зүүн доод булангийн нэлээдийг эзэлж, хариуд нь
   тооноос давсан мэдээлэл өгөхөө больсон. Дахин хэрэгтэй болбол git
   түүхээс сэргээнэ (`Legend` — тасралтгүй тууз, шатлалын шошго,
   цэгийн хэмжээний хоёр дахь суваг).
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   ХЭМЖИХ ХЭРЭГСЛҮҮД
   -------------------------------------------------------------------------- */

function Gauge({
  label,
  value,
  unit,
  digits,
  icon: Icon,
  tone,
  accent,
}: {
  label: string;
  value: number | null;
  unit: string;
  digits: number;
  icon: LucideIcon;
  /** Заалтын шатлалын өнгө (`colorOf`) — тэмдэг үүгээр будагдана */
  tone?: string;
  /** Тоог мөн будах эсэх. Зөвхөн ТЭРГҮҮЛЭХ заалт дээр */
  accent?: boolean;
}) {
  return (
    <div
      className={cn("observation-metric", accent && "is-primary")}
      style={
        {
          "--metric-tone": value != null && tone ? tone : "var(--ink-3)",
        } as React.CSSProperties
      }
    >
      {/*
        ⚠ ТЭМДГИЙН ӨНГӨ нь ЗААЛТЫНХАА УТГААС гарна (`colorOf`), хэмжих
        зүйлээсээ БИШ. Хэмжигдэхүүн тус бүрд нэг тогтмол өнгө өгвөл тэр
        нь чимэглэл болж "өнгө = утга" дүрмийг зөрчинө; утгаар будахад
        тэмдэг нь газрын зургийн цэг, жагсаалтын тоотой НЭГ эх
        сурвалжаас (`colorOf`) өнгөө авах тул хоорондоо зөрөхгүй.
      */}
      <Icon
        size={28}
        strokeWidth={1.6}
        aria-hidden
        className="shrink-0 text-ink-3"
        style={tone && value != null ? { color: tone } : undefined}
      />
      {/*
        ⚠⚠ ТОО нь ШОШГЫНХОО ЯГ ДООР суана. Баганы жин хэрэгцээгээр нь
        хуваарилагдсан тул шошго бүр НЭГ МӨР — тоонууд өөрсдөө эгнэнэ.
        Шошго дахин хоёр мөр болвол баганы жинг нэмэх нь зөв засвар.
      */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          ⚠ `.eyebrow` БИШ, түүний жижигрүүлсэн хувилбар: 11px, өргөн
          зай 0.05em. Зургаан карт нэг эгнээнд багтахад шошго нэг
          мөрөнд орох ГОЛ нөөц нь өргөн зай.
          ⚠ 10px-ээс доош БАГАСГАХГҮЙ — `ink-3`-ийн контрастын хязгаар.
        */}
        <div className="text-[11px] leading-tight font-semibold tracking-[0.05em] text-ink-3 uppercase">
          {label}
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            /* `text-ink` ҮРГЭЛЖ суурь: өнгөт утга нь inline загвараар
               дээрээс нь бичигдэнэ. Хөтөч `oklch(from …)`-г танихгүй бол
               мөр хүчингүй болж ЭНЭ өнгө үлдэнэ — уншигдахгүй болохгүй */
            className="num text-[19px] leading-none font-semibold text-ink"
            style={
              accent && tone && value != null ? { color: tone } : undefined
            }
          >
            {value == null ? "—" : num(value, digits)}
          </span>
          <span className="text-[11px] text-ink-2">{unit}</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ҮЗЭГДЛИЙН ТЭМДЭГ

   ⚠⚠ ДУГААРААР тааруулна, БИЧВЭРЭЭР биш. Эх сурвалж үзэгдэл бүрийг
   нэрээс нь гадна дугаараар өгдөг (`phenoIdDay` / `phenoIdNight`) тул
   нэрийн бичиглэл өөрчлөгдөхөд тэмдэг алдагдахгүй.

   ⚠ Доорх хүснэгт нь ТААМАГ БИШ: 2026-09-21-нд улсын 316 станцын таван
   хоногийн мэдээг бүтнээр нь татаж, гарсан БҮХ дугаар, нэрийн хослолыг
   тоолж бичсэн. Тэр өдөр ердөө арван нэгэн дугаар тохиолдсон:

     3  Үүлэрхэг · 5, 7  Багавтар үүлтэй · 9, 10  Үүлшинэ ·
     20  Үүл багасна · 27, 28  Ялимгүй хур тунадас ·
     60  Бага зэргийн бороо · 61  Бороо · 65  Хур тунадас

   285 бичлэгт үзэгдэл огт байгаагүй.

   ⚠ Дугаар нь олон улсын SYNOP код БИШ, эх сурвалжийн ӨӨРИЙН хуваарь
   тул жагсаалтад БАЙХГҮЙ дугаарт утга оноохгүй — оронд нь нэрнээс нь
   түлхүүр үгээр хайж, тэр ч олдохгүй бол тэмдэггүй үлдээнэ. Өвлийн
   үзэгдлүүд (цас, цасан шуурга, манан) энэ татацад ороогүй тул
   түлхүүр үгийн давхарга ЗААВАЛ хэрэгтэй.

   ⚠ Тэмдэг нь ӨНГӨГҮЙ (`ink-2`). Дээрх заалтын эгнээнд тэмдгийн өнгө
   нь УТГААС гардаг ч үзэгдэл бол хэмжсэн утга биш НЭРЛЭСЭН ангилал —
   нар шар, үүл саарал гэж будвал тэр нь чимэглэл болж "өнгө = утга"
   дүрмийг зөрчинө. Ялгааг нь ДҮРС өөрөө хэлнэ.
   -------------------------------------------------------------------------- */

const PHENO_BY_ID: Record<number, LucideIcon> = {
  3: Cloudy,
  5: CloudSun,
  7: CloudSun,
  9: Cloud,
  10: Cloud,
  20: CloudSun,
  27: CloudDrizzle,
  28: CloudDrizzle,
  60: CloudRain,
  61: CloudRain,
  65: CloudRain,
};

/**
 * Нэрнээс нь таних нөөц дүрэм.
 *
 * ДАРААЛАЛ чухал: тунадсыг эхэлж шалгана, эс тэгвээс "Бага зэргийн
 * бороо" нь "бага зэрэг" гэсэн үгээр үүлшилт рүү унана. Мөн "Үүл
 * багасна" нь "үүл"-ээс ӨМНӨ шалгагдана.
 */
const PHENO_BY_WORD: [string, LucideIcon][] = [
  ["аянга", CloudLightning],
  ["цасан шуурга", Wind],
  ["цас", CloudSnow],
  ["бороо", CloudRain],
  ["тунадас", CloudDrizzle],
  ["манан", CloudFog],
  ["будан", CloudFog],
  ["шуурга", Wind],
  ["цэлмэг", Sun],
  ["нартай", Sun],
  ["үүл багасна", CloudSun],
  ["багавтар", CloudSun],
  ["бага зэрэг үүлтэй", CloudSun],
  ["үүлэрхэг", Cloudy],
  ["үүл", Cloud],
];

function phenoIcon(id: number | null, text: string): LucideIcon | null {
  if (id != null && PHENO_BY_ID[id]) return PHENO_BY_ID[id];
  const t = text.trim().toLowerCase();
  if (!t) return null;
  for (const [word, icon] of PHENO_BY_WORD) if (t.includes(word)) return icon;
  return null;
}

/**
 * Үзэгдлийн тэмдгийн суудал.
 *
 * ⚠ Тэмдгийг `React.createElement`-ээр зурна: олдсон бүрэлдэхүүнийг том
 * үсгээр эхэлсэн НУТГИЙН хувьсагчид оноовол `react-hooks` дүрэм түүнийг
 * "зурагдалтын үед үүсгэсэн бүрэлдэхүүн" гэж үзэж унана. Бүрэлдэхүүн
 * нь дээрх ТОГТМОЛ хүснэгтээс гардаг, шинээр үүсдэггүй.
 *
 * ⚠ Суудал нь үзэгдэл танигдаагүй үед ч ТОГТМОЛ өргөнтэй үлдэнэ — эс
 * тэгвээс өдөр, шөнийн хоёр мөр зөрж эгнэнэ.
 */
function PhenoMark({
  id,
  text,
  night = false,
}: {
  id: number | null;
  text: string;
  night?: boolean;
}) {
  const base = phenoIcon(id, text);
  const icon =
    night && base === Sun
      ? Moon
      : night && base === CloudSun
        ? CloudMoon
        : base;
  return (
    <span className="flex w-7 shrink-0 items-center justify-center self-center">
      {icon
        ? React.createElement(icon, {
            size: 26,
            strokeWidth: 1.5,
            "aria-hidden": true,
            className: "text-ink-2",
          })
        : null}
    </span>
  );
}

/* --------------------------------------------------------------------------
   СТАНЦ СОНГОХ ШҮҮЛТҮҮР

   ⚠⚠ ТОЛГОЙН ЭНЭ СУУДЛЫГ ӨНДӨРШИЛ ЭЗЭЛЖ БАЙВ (хэрэглэгчийн шийдвэр,
   2026-09-21). Станцын далайн түвшнээс дээших өндөр нь НЭГ УДАА
   уншигдвал хангалттай тогтмол тоо бөгөөд өдөр тутмын ажиглалтад
   хэрэггүй; харин станц СОЛИХ нь энэ самбар дээрх хамгийн байнгын
   үйлдэл. Өндөршил нь газрын зургийн хөвөгч тайлбарт хэвээр.

   ⚠ Сонгох ГУРАВ дахь зам болов: газрын зураг дээрх цэг, салхины
   радар, энэ шүүлтүүр гурав НЭГ л төлөвийг (`sid`) удирдана.

   ⚠ Унждаг цэс нь эцэг хэсгийнхээ ХҮРЭЭНЭЭС ХАЛЬДАГ тул тэр хэсгийн
   `overflow-hidden` ХАСАГДСАН — булангийн радиусыг толгой өөрөө
   үүрнэ (`weather.css`-ийн `.observation-header`). Хальсан цэс
   чимээгүй тасрахаас тэр нь дээр.
   -------------------------------------------------------------------------- */

function StationPicker({
  rows,
  sid,
  onPick,
}: {
  rows: Row[];
  sid: number;
  onPick: (id: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const holder = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const current = rows.find((r) => r.st.sid === sid);

  return (
    <div ref={holder} className="station-picker">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("station-picker-button", open && "is-open")}
      >
        <ListFilter size={12} strokeWidth={1.75} aria-hidden />
        <span className="station-picker-label">Станц</span>
        <span className="station-picker-value">
          {current ? current.st.name : "Сонгоогүй"}
        </span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          aria-hidden
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <ul role="listbox" className="station-picker-menu elevated">
          {rows.map((r) => {
            const on = r.st.sid === sid;
            return (
              <li key={r.st.sid}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onPick(r.st.sid);
                    setOpen(false);
                  }}
                  className={cn(on && "is-on")}
                >
                  <span className="station-picker-name">{r.st.name}</span>
                  {/* ⚠ Байршлыг ЗӨВХӨН нэрээсээ ЯЛГААТАЙ үед бичнэ —
                      "Улаанбаатар · Улаанбаатар" гэж давтагдахгүй */}
                  {r.st.place === r.st.name ? null : (
                    <span className="station-picker-place">{r.st.place}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   САЛХИНЫ РАДАР — сүлжээний зүг, хурд нэг дүрслэлд

   ⚠⚠ СТАНЦЫН ЖАГСААЛТЫН ОРОНД (хэрэглэгчийн шийдвэр, 2026-09-21).
   Жагсаалт нь сонгосон хэмжигдэхүүний тоог станц бүрээр давтдаг
   байсан — тэр тоонууд газрын зураг дээр аль хэдийн, БАЙРШИЛТАЙГАА
   хамт бичигддэг тул багана нь хуулбар болж байв. Салхины ЗҮГ нь
   харин өөр хаана ч гардаггүй цорын ганц заалт байлаа.

   ⚠ Дүрслэл нь цаг уурын САЛХИНЫ СУРГААГ (wind rose) дагана: найман
   зүгийн зүсэг нь тэр зүгээс үлээж буй станцуудын ДУНДАЖ хурдаар
   уртсана, станц бүр өөрийн зүг, хурдан дээрээ цэг болж сууна.
   Радиус нь ХУРД — цагиргууд нь түүний хуваарь.

   ⚠⚠ ЗҮГ нь ХААНААС үлээж байгааг заана (цаг уурын жишиг) тул цэг нь
   салхи ИРЭХ зүг рүүгээ тавигдана, СУМ ЗУРАХГҮЙ. Хуучин луужин мөн
   яг энэ дүрмээр зурагддаг байсан.

   ⚠ Зүгийн үсэг КИРИЛЛ: Х · ЗХ · З · ЗУ · У · БУ · Б · БХ. Луужингийн
   үсэг нь өгүүлбэр доторх товчлол биш ТЭМДЭГ тул "товчлол задална"
   дүрэмд хамаарахгүй.

   ⚠ Зүг эсвэл хурд нь бүртгэгдээгүй станц зурагт ОРОХГҮЙ — тэр цэгийг
   төвд тавивал "салхигүй" гэсэн ХУДАЛ заалт болно. Оронд нь доор нь
   нэрээр нь ил хэлнэ.
   -------------------------------------------------------------------------- */

/** Найман зүгийн кирилл тэмдэг, хойноос цагийн зүүний дагуу */
const ROSE_DIRS = ["Х", "ЗХ", "З", "ЗУ", "У", "БУ", "Б", "БХ"];

function WindRadar({
  rows,
  sid,
  onPick,
  hover,
  onHover,
}: {
  rows: Row[];
  sid: number;
  onPick: (id: number) => void;
  hover: number | null;
  onHover: (id: number | null) => void;
}) {
  /* ⚠ Зураг нь ДӨРВӨЛЖИН БИШ: станцын нэр дугуйн хажууд бичигддэг
     тул хоёр талдаа 66 нэгжийн зай авав. Дөрвөлжин талбайд "Улаанбаатар"
     гэсэн нэр хүрээнээс хальж тасардаг байв */
  const W = 280;
  const H = 220;
  const C = W / 2;
  const CY = H / 2;
  const R = 80;
  /* Шошгын мөр хоорондын хамгийн бага зай */
  const GAP = 11;

  const plotted = rows.flatMap((r) =>
    r.obs.wind != null && r.obs.windDir != null
      ? [{ st: r.st, speed: r.obs.wind, dir: r.obs.windDir }]
      : [],
  );
  const missing = rows.filter(
    (r) => r.obs.wind == null || r.obs.windDir == null,
  );

  /*
    ⚠ Хуваарь нь ГУРВАН БҮХЭЛ алхамд хуваагдана. Дээд хязгаарыг зүгээр
    дээшээ бөөрөнхийлөхөд цагирагууд нь 1.7, 3.3, 5 гэсэн санамсаргүй
    тоон дээр буудаг байв — 2, 4, 6 гэсэн алхам нь нэг харцаар
    уншигдана.
  */
  const step = Math.max(1, Math.ceil(Math.max(0, ...plotted.map((p) => p.speed)) / 3));
  const top = step * 3;

  const at = (dir: number, speed: number): [number, number] => {
    const a = ((dir - 90) * Math.PI) / 180;
    const rr = (R * speed) / top;
    return [C + rr * Math.cos(a), CY + rr * Math.sin(a)];
  };

  /* Найман зүсэг — тэр зүгээс үлээж буй станцуудын дундаж хурд */
  const sectors = ROSE_DIRS.map((_, i) => {
    const mine = plotted.filter((p) => Math.round(p.dir / 45) % 8 === i);
    if (!mine.length) return null;
    const mean = mine.reduce((s, p) => s + p.speed, 0) / mine.length;
    const rr = (R * mean) / top;
    const a0 = ((i * 45 - 22.5 - 90) * Math.PI) / 180;
    const a1 = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
    return [
      `M${C} ${CY}`,
      `L${C + rr * Math.cos(a0)} ${CY + rr * Math.sin(a0)}`,
      `A${rr} ${rr} 0 0 1 ${C + rr * Math.cos(a1)} ${CY + rr * Math.sin(a1)}`,
      "Z",
    ].join(" ");
  });

  /*
    ⚠⚠ ШОШГЫГ БОСООГООР ТАРААНА. Нийслэлийн долоон станц ихэвчлэн НЭГ
    зүгээс салхитай байдаг (энэ өдөр зургаа нь баруунаас) тул цэгүүд нэг
    салаанд бөөгнөрч, нэр нь бие биен дээрээ давхарлаж уншигдахгүй байв.
    Тал бүрд нь дээрээс доош явж хамгийн бага зайг хангана; хөдөлсөн
    шошго өөрийн цэг рүүгээ нимгэн чиглүүлэгч зураастай үлдэнэ.
  */
  const labels = plotted.map((p) => {
    const [x, y] = at(p.dir, p.speed);
    return { p, x, y, side: x < C ? -1 : 1, ly: y };
  });
  for (const side of [-1, 1]) {
    const mine = labels.filter((l) => l.side === side).sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < mine.length; i++) {
      if (mine[i].ly - mine[i - 1].ly < GAP) mine[i].ly = mine[i - 1].ly + GAP;
    }
    const over = mine.length ? mine[mine.length - 1].ly - (H - 8) : 0;
    if (over > 0) for (const l of mine) l.ly -= over;
  }

  /* Хулганы доорх станц, байхгүй бол сонгогдсон нь тодорно */
  const marked = hover ?? sid;
  const noted = rows.find((r) => r.st.sid === marked);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Станцуудын салхины зүг, хурд"
      >
        {/* Хурдны хуваарийн цагирагууд */}
        {[1 / 3, 2 / 3, 1].map((k) => (
          <circle
            key={k}
            cx={C}
            cy={CY}
            r={R * k}
            fill="none"
            stroke="var(--line)"
            strokeWidth={k === 1 ? 1 : 0.6}
          />
        ))}
        {/* Найман зүгийн шугам ба тэмдэг */}
        {ROSE_DIRS.map((name, i) => {
          const a = ((i * 45 - 90) * Math.PI) / 180;
          const main = i % 2 === 0;
          return (
            <g key={name}>
              <line
                x1={C}
                y1={CY}
                x2={C + R * Math.cos(a)}
                y2={CY + R * Math.sin(a)}
                stroke="var(--line)"
                strokeWidth={main ? 0.8 : 0.5}
              />
              <text
                x={C + (R + 12) * Math.cos(a)}
                y={CY + (R + 12) * Math.sin(a)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={main ? 9 : 8}
                fontWeight={main ? 600 : 400}
                fill="var(--ink-3)"
              >
                {name}
              </text>
            </g>
          );
        })}
        {/* Зүсэг бүр тэр зүгийн дундаж хурдаар уртсана */}
        {sectors.map((d, i) =>
          d ? (
            <path
              key={ROSE_DIRS[i]}
              d={d}
              fill="var(--data)"
              opacity={0.22}
              stroke="var(--data)"
              strokeOpacity={0.45}
              strokeWidth={0.6}
            />
          ) : null,
        )}
        {/* Станц бүр — зүг дээрээ, хурдныхаа зайд */}
        {labels.map(({ p, x, y, side, ly }) => {
          const on = p.st.sid === sid;
          const lit = p.st.sid === marked;
          const tone = colorOf(measureOf("wind"), p.speed);
          const lx = x + side * 7;
          return (
            <g
              key={p.st.sid}
              className="cursor-pointer"
              onClick={() => onPick(p.st.sid)}
              onMouseEnter={() => onHover(p.st.sid)}
              onMouseLeave={() => onHover(null)}
            >
              <line
                x1={C}
                y1={CY}
                x2={x}
                y2={y}
                stroke={tone}
                strokeWidth={lit ? 1.8 : 1}
                strokeOpacity={lit ? 0.9 : 0.5}
                strokeLinecap="round"
              />
              {Math.abs(ly - y) > 2 ? (
                <line
                  x1={x}
                  y1={y}
                  x2={lx}
                  y2={ly}
                  stroke="var(--line-2)"
                  strokeWidth={0.6}
                />
              ) : null}
              {on ? (
                <circle
                  cx={x}
                  cy={y}
                  r={7}
                  fill="none"
                  stroke={tone}
                  strokeWidth={1.2}
                />
              ) : null}
              <circle
                cx={x}
                cy={y}
                r={lit ? 4.4 : 3.4}
                fill={tone}
                stroke="var(--paper-2)"
                strokeWidth={1.2}
              />
              {/* Нэр нь цэгийнхээ гадна талд. Дэвсгэрийн өнгөт хүрээ нь
                  доорх зүсэг, шугамаас тусгаарлана */}
              <text
                x={lx}
                y={ly}
                textAnchor={side < 0 ? "end" : "start"}
                dominantBaseline="central"
                fontSize={8.5}
                fontWeight={lit ? 600 : 400}
                fill={lit ? "var(--ink)" : "var(--ink-2)"}
                stroke="var(--paper-2)"
                strokeWidth={2.4}
                paintOrder="stroke"
              >
                {p.st.name}
              </text>
            </g>
          );
        })}
        {/* Хуваарийн шошго хойд тэнхлэг дээр */}
        {[1 / 3, 2 / 3, 1].map((k) => (
          <text
            key={k}
            x={C + 3}
            y={CY - R * k}
            dominantBaseline="central"
            fontSize={7.5}
            fill="var(--ink-3)"
          >
            {num(top * k)}
          </text>
        ))}
        <circle cx={C} cy={CY} r={1.6} fill="var(--ink-3)" />
      </svg>

      {/* Тэмдэглэсэн станцын заалт бүтэн үгээр — радар дээр зөвхөн нэр
          нь гарч, зүг, хурд нь дүрсээр уншигдана */}
      <p className="text-center text-[10.5px] leading-snug text-ink-2">
        {noted && noted.obs.wind != null ? (
          <>
            <span className="text-ink">{noted.st.name}</span>
            {" · "}
            {noted.obs.windDir == null
              ? "зүг бүртгэгдээгүй"
              : `${windName(noted.obs.windDir)} зүгээс`}
            {" · "}
            <span className="num">{num(noted.obs.wind, 1)} м/с</span>
          </>
        ) : (
          "Цагирагийн хуваарь: салхины хурд, м/с"
        )}
      </p>
      {missing.length ? (
        <p className="text-center text-[10px] leading-snug text-ink-3">
          Салхи бүртгэгдээгүй: {missing.map((r) => r.st.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

/** Урьдчилсан мэдээний нэг мөр — өдөр эсвэл шөнө */
function TempRow({
  label,
  value,
  feels,
  pheno,
  phenoId,
}: {
  label: string;
  value: number | null;
  feels: number | null;
  pheno: string;
  phenoId: number | null;
}) {
  /*
    ⚠⚠ ТЭМДЭГ нь ХОЁР БАГАНАТ бүтцийн ЗҮҮН баганад сууна, температурын
    мөрийн дотор БИШ (хэрэглэгчийн хүсэлт, 2026-09-21: "эднийг хүнд
    харагдахаар томруулж болохгүй юу"). Мөрийн дотор байхад тэмдэг нь
    14px-ийн бичвэрийн өндрөөр хязгаарлагдаж, томруулах бүрд мөрийг
    сунгадаг байв. Хажуудаа гарснаар температур, үзэгдлийн НЭГДСЭН
    ӨНДРИЙГ (хоёр мөр ≈ 29px) бүтнээр эзэлж, картын өндөр өсөхгүйгээр
    26px болов.
  */
  return (
    <div className={cn("forecast-period", label === "Шөнө" && "is-night")}>
      <div className="forecast-reading">
        <span className="forecast-period-label">
          {label === "Шөнө" ? (
            <Moon size={11} aria-hidden />
          ) : (
            <Sun size={11} aria-hidden />
          )}
          {label}
        </span>
        <span className="forecast-temperature num">
          {value == null ? "—" : num(value, 0)}
          <small>°C</small>
        </span>
      </div>
      <div className="forecast-condition">
        <PhenoMark id={phenoId} text={pheno} night={label === "Шөнө"} />
        <span>{pheno || "Үзэгдэл мэдээлээгүй"}</span>
      </div>
      <span className="forecast-feels num">
        {feels != null ? `Мэдрэгдэх ${num(feels, 0)} °C` : "Мэдрэгдэх —"}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="hatch m-3 flex items-center justify-center rounded-xs border border-dashed border-line-2 px-4 py-6">
      <p className="text-center text-[11.5px] leading-snug text-ink-3">
        {text}
      </p>
    </div>
  );
}
