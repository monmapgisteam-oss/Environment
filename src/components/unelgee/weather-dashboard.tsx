"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Clock,
  Loader2,
  MapPin,
  Mountain,
  Navigation,
  Search,
  Thermometer,
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
  windName,
  type Measure,
  type MeasureId,
  type Obs,
  type Station,
  type WeatherData,
} from "@/lib/weather";
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

export function WeatherDashboard() {
  const [data, setData] = React.useState<WeatherData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /* Хэрэглэгчийн өгсөн зам нь 292 — Улаанбаатар. Тэр нь анхны станц */
  const [sid, setSid] = React.useState(292);
  const [measure, setMeasure] = React.useState<MeasureId>("temp");
  const [query, setQuery] = React.useState("");
  /* Хуучирсан заалт анхнаасаа нуугдана — "одоогийн байдал" гэдэг нь
     долоо хоногийн өмнөх тоог агуулах ёсгүй */
  const [freshOnly, setFreshOnly] = React.useState(true);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const tip = useMapTip();
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

  const pickStation = React.useCallback((id: number) => {
    setSid(id);
    setTouched(true);
  }, []);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchWeather(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const m = measureOf(measure);

  /**
   * Ажиглалттай станцууд, заалтын настай нь хамт.
   *
   * Бүртгэлд байгаа боловч мэдээлээгүй станц ХАСАГДАНА — тэднийг
   * үлдээвэл жагсаалтад утгагүй хоосон мөр болж эгнэнэ.
   */
  const rows = React.useMemo(() => {
    if (!data) return [];
    const out: { st: Station; obs: Obs; age: number | null }[] = [];
    for (const st of data.stations) {
      if (st.aimag !== CAPITAL) continue;
      const obs = data.obs.get(st.sid);
      if (!obs) continue;
      out.push({ st, obs, age: ageHours(obs.at, data.fetched) });
    }
    /* Хотын төв станц түрүүлнэ, бусад нь цагаан толгойн дарааллаар */
    return out.sort(
      (a, b) =>
        Number(b.st.sid === MAIN_SID) - Number(a.st.sid === MAIN_SID) ||
        a.st.name.localeCompare(b.st.name, "mn"),
    );
  }, [data]);

  /** Газрын зураг, жагсаалт хоёрын хамрах хүрээ */
  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (freshOnly && (r.age == null || r.age > FRESH_HOURS)) return false;
      if (m.of(r.obs) == null) return false;
      if (!q) return true;
      return (
        r.st.name.toLowerCase().includes(q) || r.st.place.toLowerCase().includes(q)
      );
    });
  }, [rows, query, freshOnly, m]);

  /* Цэгийн багана нь ХАРАГДАЖ БУЙ станцуудаас шууд угсарна: хэмжигдэхүүн
     солигдоход утга нь ч, багана нь ч хамт солигдоно */
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

  const values = React.useMemo(
    () => shown.map((r) => m.of(r.obs) ?? 0),
    [shown, m],
  );

  /* Цэг долоохон тул нэрийг нь шууд зурган дээр бичнэ — хулгана
     хүргэлгүйгээр аль станц болох нь харагдана */
  const labels = React.useMemo(
    () => ({ text: shown.map((r) => r.st.name), minzoom: 8 }),
    [shown],
  );

  const current = React.useMemo(
    () => rows.find((r) => r.st.sid === sid) ?? null,
    [rows, sid],
  );

  const forecast = data?.forecast.get(sid) ?? [];

  /** Тайлбарын агуулга — ЗӨВХӨН газрын зургийн hover */
  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (rows.find((r) => r.st.sid === tip.oid) ?? null)),
    [rows, tip.oid],
  );

  /** Тодруулгын цагираг — зураг, жагсаалт хоёрын аль нэгнээс */
  const spot = React.useMemo(() => {
    const id = tip.oid ?? listHover;
    return id == null ? null : (rows.find((r) => r.st.sid === id) ?? null);
  }, [rows, tip.oid, listHover]);

  /* Станц сонгоход зураг тийш нь ойртоно */
  const focus = React.useMemo<Extent | null>(() => {
    const st = current?.st;
    if (!touched || !st) return null;
    const d = 0.12;
    return [st.lon - d, st.lat - d, st.lon + d, st.lat + d];
  }, [current, touched]);

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">Цаг агаарын мэдээ татагдсангүй</p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
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
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto">
      {/* ---------------- 1. Сонгосон станцын заалт ---------------- */}
      <section className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-3 py-1.5">
          <div className="eyebrow shrink-0">Одоогийн ажиглалт</div>
          <h2 className="min-w-0 flex-1 truncate text-[14px] leading-none font-medium text-ink">
            {current ? current.st.name : "Станц сонгогдоогүй"}
          </h2>
          {current ? (
            <>
              <span className="num shrink-0 text-[10.5px] text-ink-3">
                {current.st.place} · {num(current.st.elev)} м
              </span>
              <span
                className={cn(
                  "num shrink-0 text-[10.5px]",
                  current.age != null && current.age > FRESH_HOURS
                    ? "text-ochre"
                    : "text-ink-3",
                )}
              >
                {localTime(current.obs.at)} · {ageText(current.obs.at, data.fetched)}
              </span>
            </>
          ) : null}
        </header>

        {current ? (
          <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
            <Gauge
              label="Агаарын температур"
              value={current.obs.temp}
              unit="°C"
              digits={1}
              big
              tone={colorOf(measureOf("temp"), current.obs.temp)}
            />
            <Gauge
              label="Мэдрэгдэх температур"
              value={current.obs.feels}
              unit="°C"
              digits={1}
            />
            <Gauge
              label="Агаарын харьцангуй чийг"
              value={current.obs.humidity}
              unit="%"
              digits={0}
            />
            <Gauge
              label="Агаарын даралт"
              value={current.obs.pressure}
              unit="гПа"
              digits={1}
            />
            <Gauge label="Нийт үүлшил" value={current.obs.cloud} unit="балл" digits={0} />
            <WindGauge obs={current.obs} />

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
              />
            ) : null}
            {current.obs.tmax != null ? (
              <Gauge
                label="Хамгийн их температур"
                value={current.obs.tmax}
                unit="°C"
                digits={1}
              />
            ) : null}
            {current.obs.snowDepth != null ? (
              <Gauge
                label="Цасны зузаан"
                value={current.obs.snowDepth}
                unit="см"
                digits={0}
              />
            ) : null}
            {current.obs.precip != null ? (
              <Gauge
                label="Хур тунадас"
                value={current.obs.precip}
                unit="мм"
                digits={1}
              />
            ) : null}
          </div>
        ) : (
          <Empty text="Сонгосон станц ажиглалт илгээгээгүй байна" />
        )}
      </section>

      {/* ---------------- 2. Урьдчилсан мэдээ ---------------- */}
      <section className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
        <header className="flex items-baseline gap-3 border-b border-line px-3.5 py-2">
          <span className="eyebrow shrink-0">Таван хоногийн урьдчилсан мэдээ</span>
          <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-3">
            {current?.st.name ?? ""}
          </span>
        </header>

        {forecast.length ? (
          <div
            className="grid gap-px bg-line"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
          >
            {forecast.map((d) => {
              const l = dayLabel(d.date);
              return (
                <div key={d.date} className="bg-paper-2 px-3 py-2.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="num text-[11.5px] text-ink">{l.day}</span>
                    <span className="text-[10px] text-ink-3">{l.weekday}</span>
                  </div>

                  {/* Өдөр, шөнийн температур — хоёр мөр, нэг хуваарь */}
                  <div className="mt-2 space-y-1">
                    <TempRow
                      label="Өдөр"
                      value={d.dayTemp}
                      feels={d.dayFeels}
                      pheno={d.dayPheno}
                    />
                    <TempRow
                      label="Шөнө"
                      value={d.nightTemp}
                      feels={d.nightFeels}
                      pheno={d.nightPheno}
                    />
                  </div>

                  <div className="num mt-2 flex items-baseline gap-2.5 border-t border-line pt-1.5 text-[10px] text-ink-3">
                    <span>
                      Тунадас {d.dayPrecip == null ? "—" : `${num(d.dayPrecip)}%`}
                    </span>
                    <span>
                      Салхи {d.dayWind == null ? "—" : `${num(d.dayWind)} м/с`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="Энэ станцад урьдчилсан мэдээ бүртгэгдээгүй байна" />
        )}
      </section>

      {/* ---------------- 3. Сүлжээ ---------------- */}
      {/* Газрын зураг нь хуудасны гол эзэлхүүн — индикатор, урьдчилсан
          мэдээ хоёр нь дээрээ нимгэн зурвас болж суух ба сүлжээний
          зураг доор нь бүтэн өндрөөр дэлгэгдэнэ */}
      <Columns id="weather" left={272} className="min-h-[640px] flex-1">
        {/* Станцын жагсаалт */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xs border border-line bg-paper-2">
          <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
            <Search size={12} className="shrink-0 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Станц, дүүрэг хайх"
              className="min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-ink-3"
            />
            <span className="num shrink-0 text-[10px] text-ink-3">
              {num(shown.length)}
            </span>
          </div>

          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {shown.map((r) => {
              const v = m.of(r.obs);
              const on = r.st.sid === sid;
              return (
                <li key={r.st.sid}>
                  <button
                    onClick={() => pickStation(r.st.sid)}
                    onMouseEnter={() => setListHover(r.st.sid)}
                    onMouseLeave={() => setListHover(null)}
                    className={cn(
                      "relative block w-full px-2.5 py-1.5 text-left transition-colors",
                      on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
                    )}
                  >
                    {on ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)"
                      />
                    ) : null}
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[11.5px] leading-snug",
                          on ? "font-medium text-ink" : "text-ink-2",
                        )}
                      >
                        {r.st.name}
                      </span>
                      <span
                        className="num shrink-0 text-[11.5px] leading-none"
                        style={{ color: colorOf(m, v) }}
                      >
                        {v == null ? "—" : num(v, m.digits)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] leading-snug text-ink-3">
                      {r.st.place}
                      {r.age != null && r.age > FRESH_HOURS
                        ? ` · ${ageText(r.obs.at, data.fetched)}`
                        : ""}
                    </div>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 ? (
              <li>
                <Empty text="Тохирох станц олдсонгүй" />
              </li>
            ) : null}
          </ul>
        </div>

        {/* Газрын зураг */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xs border border-line bg-paper-2">
          {/*
            Хэмжигдэхүүн сонгох зурвас — зураг ба жагсаалт ХОЁУЛАА үүнд
            захирагдана. Тусад нь тавьбал баганын тоо, цэгийн өнгө хоёр
            өөр зүйл заана.
          */}
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-line px-2 py-1.5">
            {MEASURES.map((x) => (
              <button
                key={x.id}
                onClick={() => setMeasure(x.id)}
                aria-pressed={x.id === measure}
                className={cn(
                  "rounded-xs border px-2 py-1 text-[11px] leading-none transition-colors",
                  x.id === measure
                    ? "border-(--tone)/45 bg-(--tone)/10 text-(--tone)"
                    : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                )}
              >
                {x.label}
              </button>
            ))}

            <button
              onClick={() => setFreshOnly((v) => !v)}
              aria-pressed={freshOnly}
              className={cn(
                "ml-auto rounded-xs border px-2 py-1 text-[11px] leading-none transition-colors",
                freshOnly
                  ? "border-(--tone)/45 bg-(--tone)/10 text-(--tone)"
                  : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
              )}
            >
              Сүүлийн {FRESH_HOURS} цагийн заалт
            </button>
          </div>

          <div className="relative min-h-[560px] flex-1">
            <PointMap
              key={measure}
              points={points}
              visible={visible}
              labels={labels}
              basemap={basemap}
              onSelect={pickStation}
              onHover={tip.onHover}
              focus={focus}
              cluster={false}
              highlight={spot ? [spot.st.lon, spot.st.lat] : null}
              grades={{ values, stops: m.stops }}
            />
            <BasemapGallery value={basemap} onChange={setBasemap} placement="top-left" />

            <Legend measure={m} />

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
                  <MapTipRow icon={Mountain} text={`${num(hovered.st.elev)} м`} num />
                  <MapTipRow
                    icon={Clock}
                    text={ageText(hovered.obs.at, data.fetched)}
                    num
                  />
                </div>
              </MapTip>
            ) : null}
          </div>
        </div>
      </Columns>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Эх сурвалж: Ус цаг уур, орчны шинжилгээний газар · Нийслэлийн{" "}
        {num(rows.length)} станц · Суурь зураг: Esri
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ГАЗРЫН ЗУРГИЙН ТАЙЛБАР

   Зураг нь шатлалыг ТАСРАЛТГҮЙ холино (`interpolate linear`) тул тайлбар
   нь ч тасралтгүй туузан байх ёстой — салангид дугуйнууд нь шатлалыг
   тасалсан ангилал мэт уншуулна.

   Тууз дээрх өнгө бүр ӨӨРИЙН УТГЫН байрлалд суана, тэнцүү зайтай биш:
   температурын шатлал -30-аас 32 хүртэл ч дунд нь 0 нь голд биш 48%-д
   байдаг. Тэнцүү хуваавал тайлбар нь зурагтай зөрнө.

   ХОЁР ДАХЬ СУВАГ: цэгийн радиус мөн ижил утгыг үүрдэг (доод шатнаас
   дээд шат руу 1.9 дахин). Өнгө ялгах чадвар султай хүн зургийг зөвхөн
   хэмжээгээр нь уншиж чадах ёстой тул тайлбарт хоёулаа гарна.

   Уншигдацыг дэвсгэр биш `backdrop-blur` ба бичвэрийн сүүдэр барина —
   доод ирмэгийн харьцааны заалттай ижил арга.
   -------------------------------------------------------------------------- */

/** Хиймэл дагуулын цайвар талбай дээр бичвэр дангаараа алга болно */
const SHADOW = { filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" } as const;

function Legend({ measure }: { measure: Measure }) {
  const stops = measure.stops;
  const lo = stops[0][0];
  const hi = stops[stops.length - 1][0];
  const span = hi - lo || 1;
  const at = (v: number) => ((v - lo) / span) * 100;

  const gradient = `linear-gradient(to right, ${stops
    .map(([v, c]) => `${c} ${at(v).toFixed(1)}%`)
    .join(", ")})`;

  /*
    Шошго давхцвал алгасна. Эхний ба сүүлчийн шат нь ҮРГЭЛЖ гарна —
    тэд хоёр нь мужийн хязгаарыг зарладаг; дундахуудаас зөвхөн
    өмнөхөөсөө хангалттай хол зогсох нь үлдэнэ.
  */
  const marks: { pos: number; value: number }[] = [];
  stops.forEach(([v], i) => {
    const pos = at(v);
    const last = marks[marks.length - 1];
    const far = !last || pos - last.pos >= 15;
    if (i === 0 || far) marks.push({ pos, value: v });
    else if (i === stops.length - 1) {
      /* Сүүлчийнх ойрхон бол өмнөхийг нь хаяна, өөрөө үлдэнэ */
      if (marks.length > 1) marks.pop();
      marks.push({ pos, value: v });
    }
  });

  return (
    <div className="pointer-events-none absolute bottom-6 left-2.5 z-10 w-[204px] rounded-xs bg-paper/10 px-2 py-1.5 backdrop-blur-md">
      <div className="eyebrow" style={SHADOW}>
        {measure.label}, {measure.unit}
      </div>

      {/* Тасралтгүй тууз — зургийн холилттой яг ижил */}
      <div
        className="relative mt-1.5 h-[7px] w-full rounded-[1px]"
        style={{ ...SHADOW, background: gradient }}
      >
        {stops.slice(1, -1).map(([v]) => (
          <span
            key={v}
            aria-hidden
            className="absolute top-0 h-full w-px bg-paper/45"
            style={{ left: `${at(v)}%` }}
          />
        ))}
      </div>

      <div className="relative mt-1 h-[11px]">
        {marks.map((k) => (
          <span
            key={k.value}
            className="num absolute top-0 text-[9.5px] leading-none text-ink-2"
            style={{
              ...SHADOW,
              left: `${k.pos}%`,
              transform:
                k.pos <= 0
                  ? "none"
                  : k.pos >= 100
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {num(k.value, 0)}
          </span>
        ))}
      </div>

      {/* Хоёр дахь суваг — цэгийн хэмжээ мөн ижил утгыг заана */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span aria-hidden className="flex items-center gap-1" style={SHADOW}>
          <span className="block size-[4px] rounded-full bg-ink-2" />
          <span className="block size-[6px] rounded-full bg-ink-2" />
          <span className="block size-[8px] rounded-full bg-ink-2" />
        </span>
        <span className="text-[9.5px] leading-none text-ink-2" style={SHADOW}>
          Цэгийн хэмжээ
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ХЭМЖИХ ХЭРЭГСЛҮҮД
   -------------------------------------------------------------------------- */

function Gauge({
  label,
  value,
  unit,
  digits,
  big,
  tone,
}: {
  label: string;
  value: number | null;
  unit: string;
  digits: number;
  /** Гол заалт — үлдсэнээс том */
  big?: boolean;
  tone?: string;
}) {
  return (
    <div className="px-3 py-1.5">
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "num leading-none font-medium",
            big ? "text-[22px]" : "text-[16px]",
            tone ? "" : "text-ink",
          )}
          style={tone && value != null ? { color: tone } : undefined}
        >
          {value == null ? "—" : num(value, digits)}
        </span>
        <span className="text-[10.5px] text-ink-3">{unit}</span>
      </div>
    </div>
  );
}

/**
 * Салхины хэрэгсэл.
 *
 * Зүг нь ХААНААС үлээж байгааг заана (цаг уурын жишиг) тул хуваарийн
 * зураас тэр тал руу харна, сум зурахгүй — сум нь "хаашаа" гэж
 * уншигдаж, эсрэг утга өгнө. Зүгийн нэрийг бүтнээр бичнэ.
 */
function WindGauge({ obs }: { obs: Obs }) {
  const deg = obs.windDir;
  return (
    <div className="flex items-start gap-2 px-3 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="eyebrow truncate">Салхи</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="num text-[16px] leading-none font-medium text-ink">
            {obs.wind == null ? "—" : num(obs.wind, 1)}
          </span>
          <span className="text-[10.5px] text-ink-3">м/с</span>
        </div>
        <div className="mt-1 truncate text-[10px] leading-none text-ink-3">
          {windName(deg)}
        </div>
      </div>

      <span
        aria-hidden
        className="relative mt-0.5 size-7 shrink-0 rounded-full border border-line-2"
      >
        {deg == null ? (
          <Navigation size={11} className="absolute inset-0 m-auto text-ink-3" />
        ) : (
          <>
            {/* Хойд зүгийн тэмдэглэгээ */}
            <span className="absolute top-[2px] left-1/2 h-[3px] w-px -translate-x-1/2 bg-line-2" />
            {/* Салхи ирж буй тал */}
            <span
              className="absolute inset-0"
              style={{ transform: `rotate(${deg}deg)` }}
            >
              <span className="absolute top-[3px] left-1/2 h-[9px] w-[2px] -translate-x-1/2 rounded-full bg-data" />
            </span>
            <span className="absolute inset-0 m-auto size-1 rounded-full bg-ink-3" />
          </>
        )}
      </span>
    </div>
  );
}

/** Урьдчилсан мэдээний нэг мөр — өдөр эсвэл шөнө */
function TempRow({
  label,
  value,
  feels,
  pheno,
}: {
  label: string;
  value: number | null;
  feels: number | null;
  pheno: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="w-[30px] shrink-0 text-[10px] text-ink-3">{label}</span>
        <span
          className="num shrink-0 text-[14px] leading-none"
          style={{ color: colorOf(measureOf("temp"), value) }}
        >
          {value == null ? "—" : num(value, 0)}
        </span>
        <span className="text-[10px] text-ink-3">°C</span>
        {feels != null && value != null && feels !== value ? (
          <span className="num text-[10px] text-ink-3">мэдрэгдэх {num(feels, 0)}</span>
        ) : null}
      </div>
      {pheno ? (
        <div className="mt-0.5 truncate pl-[36px] text-[10px] leading-snug text-ink-3">
          {pheno}
        </div>
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="hatch m-3 flex items-center justify-center rounded-xs border border-dashed border-line-2 px-4 py-6">
      <p className="text-center text-[11.5px] leading-snug text-ink-3">{text}</p>
    </div>
  );
}
