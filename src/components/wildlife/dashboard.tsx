"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  HardHat,
  LandPlot,
  Loader2,
  PawPrint,
  Route,
  Stethoscope,
  X,
} from "lucide-react";
import { AreaChart, RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import {
  fetchCalls,
  fetchPhotos,
  type WildlifeCall,
  type WildlifePhoto,
} from "@/lib/wildlife";
import { cn, num } from "@/lib/utils";

/*
  Газрын зураг нь худгийн самбартай нэг бүрэлдэхүүн — цэгийн давхарга,
  бөөгнөрөл, суурь зураг, харагдацын үйлдэл бүгд ижил. Дахин бичихийн оронд
  хуваалцав (нэр нь түүхэн шалтгаанаар `WellsMap` хэвээр).
*/
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

/** Шүүлтүүрийн хэмжигдэхүүн — cross-filter дээр аль нэгийг алгасахад */
type Skip = "species" | "soum" | "route" | "officer" | "injured" | "month";

export function WildlifeDashboard() {
  const [calls, setCalls] = React.useState<WildlifeCall[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [species, setSpecies] = React.useState<string | null>(null);
  const [soum, setSoum] = React.useState<string | null>(null);
  const [route, setRoute] = React.useState<string | null>(null);
  const [officer, setOfficer] = React.useState<string | null>(null);
  const [injured, setInjured] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState<string | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());
  const [extentOn, setExtentOn] = React.useState(false);
  const [extent, setExtent] = React.useState<Extent | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  /** Томоор харж буй зургийн байрлал (`shownPhotos` доторх индекс) */
  const [viewer, setViewer] = React.useState<number | null>(null);

  /*
    Зураг нь хоёрдогч: бүртгэл ирмэгц самбар ажиллаж эхлэх ёстой тул
    хавсралтыг ТУСДАА, дараа нь татна. Зураг татагдахгүй бол самбар
    бүхэлдээ унахгүй — зөвхөн зургийн хэсэг хоосон үлдэнэ.
  */
  const [photos, setPhotos] = React.useState<WildlifePhoto[]>([]);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchCalls(ac.signal)
      .then((list) => {
        setCalls(list);
        // Зургийн алдааг ЗАЛГИНА: самбар бүхэлдээ унах шалтгаан биш
        fetchPhotos(list.map((c) => c.oid), ac.signal)
          .then(setPhotos)
          .catch(() => {});
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, []);

  /* ---------------- Шүүлтүүр ---------------- */

  /**
   * Шүүлтүүр давсан бичлэгийн индексүүд. `skip`-д заасан хэмжигдэхүүнийг
   * алгасна — ингэснээр диаграм бүр өөрийнхөө шүүлтээс бусдаар шүүгдэж,
   * сонгосны дараа ч бусад мөрүүд харагдсаар үлдэнэ (cross-filter).
   */
  const selectBase = React.useCallback(
    (skip?: Skip) => {
      if (!calls) return new Uint32Array(0);
      const out = new Uint32Array(calls.length);
      let k = 0;
      for (let i = 0; i < calls.length; i++) {
        const c = calls[i];
        if (skip !== "species" && species && c.species !== species) continue;
        if (skip !== "soum" && soum && c.soum !== soum) continue;
        if (skip !== "route" && route && c.route !== route) continue;
        if (skip !== "officer" && officer && c.officer !== officer) continue;
        if (skip !== "injured" && injured && injuredKey(c.injured) !== injured) continue;
        if (skip !== "month" && month && String(monthOf(c)) !== month) continue;
        out[k++] = i;
      }
      return out.subarray(0, k);
    },
    [calls, species, soum, route, officer, injured, month],
  );

  /*
    Харагдацын үйлдлийг тусад нь давхарлана: газрын зураг `selectBase`-ийг л
    уншдаг тул зураг хөдлөх бүрд цэгийн эх сурвалж дахин ачаалагдахгүй.
  */
  const select = React.useCallback(
    (skip?: Skip) => {
      const idx = selectBase(skip);
      if (!extent || !calls) return idx;
      const [w, s, e, n] = extent;
      const wide = e - w >= 360;
      const out = new Uint32Array(idx.length);
      let k = 0;
      for (let j = 0; j < idx.length; j++) {
        const c = calls[idx[j]];
        if (c.lat < s || c.lat > n) continue;
        // Хүрээ 180°-ын шугам давсан бол w > e болно
        if (!wide && (w <= e ? c.lon < w || c.lon > e : c.lon < w && c.lon > e)) continue;
        out[k++] = idx[j];
      }
      return out.subarray(0, k);
    },
    [selectBase, extent, calls],
  );

  const mapIdx = React.useMemo(() => selectBase(), [selectBase]);
  const shown = React.useMemo(() => select(), [select]);

  /** Цэгийн массив — газрын зураг багана хэлбэрээр хүлээж авдаг */
  const points = React.useMemo(() => {
    const src = calls ?? [];
    return {
      oid: src.map((c) => c.oid),
      lon: src.map((c) => c.lon),
      lat: src.map((c) => c.lat),
    };
  }, [calls]);

  /** Бүлэглэж тоолох. `of` нь null буцаавал тухайн бичлэг тоологдохгүй. */
  const tally = React.useCallback(
    (of: (c: WildlifeCall) => string | null, skip: Skip): Datum[] => {
      if (!calls) return [];
      const idx = select(skip);
      const counts = new Map<string, number>();
      for (let k = 0; k < idx.length; k++) {
        const key = of(calls[idx[k]]);
        if (key == null) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, label: key, value }));
    },
    [calls, select],
  );

  const speciesData = React.useMemo(() => tally((c) => c.species, "species"), [tally]);
  const soumData = React.useMemo(() => tally((c) => c.soum, "soum"), [tally]);
  const routeData = React.useMemo(() => tally((c) => c.route, "route"), [tally]);
  const officerData = React.useMemo(() => tally((c) => c.officer, "officer"), [tally]);
  const injuredData = React.useMemo(
    () => tally((c) => injuredLabel(c.injured), "injured"),
    [tally],
  );

  const monthData = React.useMemo<Datum[]>(() => {
    if (!calls) return [];
    const idx = select("month");
    const counts = new Array(12).fill(0);
    for (let k = 0; k < idx.length; k++) {
      const m = monthOf(calls[idx[k]]);
      if (m >= 1 && m <= 12) counts[m - 1]++;
    }
    return counts.map((v, i) => ({ key: String(i + 1), label: `${i + 1}-р сар`, value: v }));
  }, [calls, select]);

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    if (!calls) return null;
    const kinds = new Set<string>();
    let hurt = 0;
    let days = 0;
    let cost = 0;
    let hours = 0;
    /** Огноогүй бичлэг — сарын диаграмд орж чадахгүй тул тусад нь тоолно */
    let undated = 0;

    for (let k = 0; k < shown.length; k++) {
      const c = calls[shown[k]];
      kinds.add(c.species);
      if (c.injured) hurt++;
      days += c.careDays ?? 0;
      cost += (c.feedCost ?? 0) + (c.fuelCost ?? 0);
      hours += c.staffHours ?? 0;
      if (monthOf(c) === 0) undated++;
    }
    return { total: shown.length, kinds: kinds.size, hurt, days, cost, hours, undated };
  }, [calls, shown]);

  /* ---------------- Сонголт руу ойртох ---------------- */
  const focus = React.useMemo<Extent | null>(() => {
    if (!calls || (!soum && !species && !route)) return null;
    const idx = selectBase();
    if (idx.length === 0) return null;
    let w = 180;
    let s = 90;
    let e = -180;
    let n = -90;
    for (let k = 0; k < idx.length; k++) {
      const c = calls[idx[k]];
      w = Math.min(w, c.lon);
      e = Math.max(e, c.lon);
      s = Math.min(s, c.lat);
      n = Math.max(n, c.lat);
    }
    return [w, s, e, n];
    // Зөвхөн газарзүйн болон зүйлийн сонголтоос хамаарна — он, сар үсрэхгүй
  }, [calls, selectBase, soum, species, route]);

  /** Шүүлтүүр давсан дуудлагын зураг — эрэмбэ нь бүртгэлийн дарааллаар */
  const shownPhotos = React.useMemo(() => {
    if (!calls || photos.length === 0) return [];
    const live = new Set<number>();
    for (let k = 0; k < shown.length; k++) live.add(calls[shown[k]].oid);
    return photos.filter((p) => live.has(p.oid));
  }, [photos, shown, calls]);

  const detail = React.useMemo(
    () => (selected == null ? null : (calls?.find((c) => c.oid === selected) ?? null)),
    [calls, selected],
  );

  const activeCount =
    (species ? 1 : 0) +
    (soum ? 1 : 0) +
    (route ? 1 : 0) +
    (officer ? 1 : 0) +
    (injured ? 1 : 0) +
    (month ? 1 : 0) +
    (extentOn ? 1 : 0);

  function reset() {
    setSpecies(null);
    setSoum(null);
    setRoute(null);
    setOfficer(null);
    setInjured(null);
    setMonth(null);
    setExtentOn(false);
    setExtent(null);
  }

  /* ---------------- Ачааллаж байна / алдаа ---------------- */
  if (error || !calls || !stats) {
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
            Дуудлагын бүртгэл татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ============ ШҮҮЛТҮҮРИЙН МӨР ============ */}
      <FilterBar
        title="Зэрлэг амьтны дуудлага"
        activeCount={activeCount}
        onReset={reset}
      >
        <FilterMenu
          label="Амьтны зүйл"
          icon={PawPrint}
          value={species}
          active={Boolean(species)}
          onClear={() => setSpecies(null)}
        >
          <PickList items={speciesData} selected={species} onPick={setSpecies} searchable />
        </FilterMenu>

        <FilterMenu
          label="Сум, дүүрэг"
          icon={LandPlot}
          value={soum}
          active={Boolean(soum)}
          onClear={() => setSoum(null)}
        >
          <PickList items={soumData} selected={soum} onPick={setSoum} searchable />
        </FilterMenu>

        <FilterMenu
          label="Бэртэл"
          icon={Stethoscope}
          value={injured}
          active={Boolean(injured)}
          onClear={() => setInjured(null)}
          width={180}
        >
          <PickList items={injuredData} selected={injured} onPick={setInjured} />
        </FilterMenu>

        <FilterMenu
          label="Маршрут"
          icon={Route}
          value={route}
          active={Boolean(route)}
          onClear={() => setRoute(null)}
        >
          <PickList items={routeData} selected={route} onPick={setRoute} />
        </FilterMenu>

        <FilterMenu
          label="Албан хаагч"
          icon={HardHat}
          value={officer}
          active={Boolean(officer)}
          onClear={() => setOfficer(null)}
        >
          <PickList items={officerData} selected={officer} onPick={setOfficer} />
        </FilterMenu>

        <FilterMenu
          label="Сар"
          icon={CalendarDays}
          value={month ? `${month}-р сар` : null}
          active={Boolean(month)}
          onClear={() => setMonth(null)}
          width={200}
        >
          <PickList items={monthData} selected={month} onPick={setMonth} />
        </FilterMenu>
      </FilterBar>

      {/* ============ ГОЛ СҮЛЖЭЭ ============ */}
      <div className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[272px_1fr_292px]">
        {/* ---- ЗҮҮН: юу, хаана ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Panel title="Амьтны зүйлээр" count={speciesData.length} grow>
            <RowChart data={speciesData} selected={species} onSelect={setSpecies} />
          </Panel>
          <Panel title="Сум, дүүргээр" count={soumData.length} grow>
            <RowChart data={soumData} selected={soum} onSelect={setSoum} />
          </Panel>

          {/*
            Маягтаар ирсэн гэрэл зураг. Шүүлтүүрийг дагана — сонгосон зүйл,
            дүүрэгт хамаарах зураг л үлдэнэ. Товшиход тухайн дуудлагын
            бичилт газрын зураг дээр нээгдэнэ.
          */}
          {/*
            Өндөр нь ХЯЗГААРТАЙ, дотроо гүйнэ. Зураг олон болоход энэ хэсэг
            тэлж, дээрх хоёр диаграмыг дэлгэцээс шахаж гаргах ёсгүй.
          */}
          <Panel title="Зураг" count={shownPhotos.length} bodyClassName="max-h-[196px]">
            {shownPhotos.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-ink-3">Зураг алга</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {shownPhotos.map((p, i) => (
                  <button
                    key={`${p.oid}-${p.id}`}
                    type="button"
                    onClick={() => setViewer(i)}
                    title={photoTitle(p, calls)}
                    className={cn(
                      "block aspect-square overflow-hidden rounded-xs border transition-colors",
                      selected === p.oid
                        ? "border-data"
                        : "border-line hover:border-line-2",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={photoTitle(p, calls)}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ---- ГОЛ: индикатор + газрын зураг ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <div className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
            <div className="grid grid-cols-3 divide-x divide-y divide-line xl:grid-cols-6 xl:divide-y-0">
              <Stat label="Нийт дуудлага" value={num(stats.total)} />
              <Stat label="Амьтны зүйл" value={num(stats.kinds)} />
              <Stat label="Бэртэл гэмтэлтэй" value={num(stats.hurt)} />
              <Stat label="Асран хамгаалсан хоног" value={num(stats.days)} />
              <Stat label="Идэш, шатахууны зардал" value={`${num(stats.cost)}₮`} />
              <Stat label="Зарцуулсан цаг" value={num(stats.hours)} />
            </div>
          </div>

          <div className="relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-xs border border-line bg-paper-2">
            <div className="relative h-full w-full">
              <PointMap
                points={points}
                visible={mapIdx}
                basemap={basemap}
                onSelect={setSelected}
                extent={extentOn}
                onExtent={setExtent}
                focus={focus}
              />

              <BasemapGallery
                value={basemap}
                onChange={setBasemap}
                extent={extentOn}
                onExtentChange={setExtentOn}
                unit="дуудлага"
              />

              {extentOn ? (
                <div className="pointer-events-none absolute inset-0 z-10 border border-data/45" />
              ) : null}

              {detail ? (
                <div className="absolute right-2.5 bottom-8 z-10 w-[286px] rounded-xs border border-line bg-paper/92 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow">Дуудлагын бичилт</span>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-ink-3 transition-colors hover:text-ink"
                      aria-label="Хаах"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto p-2.5">
                    <dl className="space-y-1.5">
                      <Field k="Дугаар" v={<span className="num">#{detail.oid}</span>} />
                      <Field k="Огноо" v={<span className="num">{dayLabel(detail.date)}</span>} />
                      <Field
                        k="Байршил"
                        v={[detail.aimag, detail.soum, detail.bag].filter(Boolean).join(", ")}
                      />
                      <Field k="Амьтны зүйл" v={detail.species} />
                      <Field k="Бэртэл" v={injuredLabel(detail.injured) ?? "—"} />
                      <Field k="Дуудлагын төрөл" v={detail.callType || "—"} />
                      <Field k="Албан хаагч" v={detail.officer} />
                      <Field k="Маршрут" v={detail.route ?? "—"} />
                      {detail.careDays != null ? (
                        <Field
                          k="Хоног"
                          v={<span className="num">{num(detail.careDays)}</span>}
                        />
                      ) : null}
                      {detail.feedCost != null || detail.fuelCost != null ? (
                        <Field
                          k="Зардал"
                          v={
                            <span className="num">
                              {num((detail.feedCost ?? 0) + (detail.fuelCost ?? 0))}₮
                            </span>
                          }
                        />
                      ) : null}
                      {detail.staffHours != null ? (
                        <Field
                          k="Цаг"
                          v={<span className="num">{num(detail.staffHours)}</span>}
                        />
                      ) : null}
                      {detail.note ? <Field k="Тайлбар" v={detail.note} /> : null}
                    </dl>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS Survey123 — шууд холболт
            {stats.undated > 0 ? ` · огноогүй ${num(stats.undated)} бичлэг` : ""}
          </p>
        </div>

        {/* ---- БАРУУН: хэзээ, хэн ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Panel title="Сараар" note="улирлын хэлбэлзэл">
            <AreaChart
              data={monthData}
              height={80}
              selected={month}
              onSelect={setMonth}
              formatTick={(_d, i) => String(i + 1)}
              unit="дуудлага"
            />
          </Panel>

          <Panel title="Бэртэл гэмтлээр" count={injuredData.length}>
            <RowChart data={injuredData} selected={injured} onSelect={setInjured} />
          </Panel>

          <Panel title="Маршрутаар" count={routeData.length} grow>
            <RowChart data={routeData} selected={route} onSelect={setRoute} />
          </Panel>

          <Panel title="Албан хаагчаар" count={officerData.length} grow>
            <RowChart data={officerData} selected={officer} onSelect={setOfficer} />
          </Panel>
        </div>
      </div>

      {viewer !== null && shownPhotos[viewer] ? (
        <PhotoViewer
          photos={shownPhotos}
          index={viewer}
          calls={calls}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
          onLocate={setSelected}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Зургийн тайлбар — амьтны зүйл, огноо. Файлын нэр утга багатай. */
function photoTitle(p: WildlifePhoto, calls: WildlifeCall[] | null) {
  const c = calls?.find((x) => x.oid === p.oid);
  if (!c) return p.name;
  return `${c.species} · ${dayLabel(c.date)}`;
}

/** Сарын дугаар (1–12). Огноогүй бичлэг 0 буцаана. */
function monthOf(c: WildlifeCall) {
  return c.date ? new Date(c.date).getMonth() + 1 : 0;
}

function dayLabel(ms: number | null) {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Бөглөгдөөгүй талбарыг "Тийм/Үгүй"-гийн аль нэгэнд БҮҮ ХАМААРУУЛ */
function injuredLabel(v: boolean | null) {
  return v === null ? null : v ? "Тийм" : "Үгүй";
}
function injuredKey(v: boolean | null) {
  return injuredLabel(v) ?? "";
}

/* --------------------------------------------------------------------------
   Зургийг томоор харах цонх.

   Модаль дотор ЗӨВХӨН гүйлгэх жагсаалтын одоогийн байрлалыг барина —
   зургуудыг өөрсдийг нь хуулбарлахгүй. Тиймээс шүүлтүүр солигдоход
   жагсаалт шинэчлэгдэж, цонх түүнийг дагана.
   -------------------------------------------------------------------------- */
function PhotoViewer({
  photos,
  index,
  calls,
  onIndex,
  onClose,
  onLocate,
}: {
  photos: WildlifePhoto[];
  index: number;
  calls: WildlifeCall[] | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** Газрын зураг дээр тухайн дуудлагыг тэмдэглэх */
  onLocate: (oid: number) => void;
}) {
  const photo = photos[index];
  const call = calls?.find((c) => c.oid === photo?.oid) ?? null;

  /*
    Гар — зураг үзэгчийн үндсэн хяналт. Escape хаана, сум товч дараагийн
    зураг руу шилжинэ. Товшилтоор л явдаг бол олон зураг харах нь удаан.
  */
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex((index + 1) % photos.length);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [index, photos.length, onIndex, onClose]);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Зураг"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-paper/92 backdrop-blur-md"
    >
      {/* Толгой — дотор товшихад цонх хаагдахгүй */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5"
      >
        <span className="eyebrow shrink-0">
          {index + 1}/{photos.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {call ? `${call.species} · ${dayLabel(call.date)}` : photo.name}
          {call ? (
            <span className="text-ink-3">
              {" · "}
              {[call.aimag, call.soum, call.bag].filter(Boolean).join(", ")}
            </span>
          ) : null}
        </span>

        {call ? (
          <button
            onClick={() => {
              onLocate(call.oid);
              onClose();
            }}
            className="shrink-0 rounded-xs border border-line px-2 py-1 text-[11.5px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
          >
            Газрын зураг дээр
          </button>
        ) : null}

        <button
          onClick={onClose}
          aria-label="Хаах"
          className="shrink-0 text-ink-3 transition-colors hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photoTitle(photo, calls)}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />

        {photos.length > 1 ? (
          <>
            <Arrow
              side="left"
              onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
            />
            <Arrow side="right" onClick={() => onIndex((index + 1) % photos.length)} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={side === "left" ? "Өмнөх" : "Дараах"}
      className={cn(
        "absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xs border border-line bg-paper-2/80 text-ink-2 transition-colors hover:border-line-2 hover:text-ink",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}

function Panel({
  title,
  count,
  note,
  grow,
  bodyClassName,
  children,
}: {
  title: string;
  count?: number;
  note?: string;
  /** Үлдсэн зайг эзэлж, дотроо гүйх эсэх */
  grow?: boolean;
  /** Биеийн нэмэлт класс — өндрийн таг зэрэг */
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xs border border-line bg-paper-2",
        grow ? "min-h-[120px] flex-1" : "shrink-0",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="display text-[13.5px] leading-none tracking-[0.06em] uppercase">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="num text-[11.5px] text-ink-3">{count}</span>
        ) : note ? (
          <span className="text-[11.5px] text-ink-3">{note}</span>
        ) : null}
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3.5 py-3">
      <span className="eyebrow block leading-[1.35]">{label}</span>
      <div className="num mt-2 truncate text-[20px] leading-none font-medium text-ink">
        {value}
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[86px] shrink-0 text-[10.5px] tracking-[0.08em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{v}</dd>
    </div>
  );
}
