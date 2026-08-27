"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Building2, Loader2, MapPin, Sticker } from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import { fetchStickers, type StickerData } from "@/lib/stickers";
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

/**
 * Стикер байршуулсан барилгын самбар.
 *
 * Ердөө НАЙМАН барилга. Ийм цөөн зүйлд жагсаалт, диаграм хоёулаа
 * илүүц — найман мөрийн "тархалт" гэж байхгүй. Тиймээс бүтэц нь
 * хэлтсийн бусад самбараас өөр: газрын зураг бүтэн өргөнөөр дээр
 * сууж, доор нь барилга бүрийн КАРТ хөндлөн эгнэнэ.
 *
 * Карт бүр өөрөө сонгогч: товшиход газрын зураг тухайн барилга руу
 * ойртоно. Хөндлөн эгнээ нь найман зүйлийг НЭГ ХАРЦААР харуулна —
 * босоо жагсаалт бол гүйлгэх шаардлагатай болно.
 */
export function StickersDashboard() {
  const [data, setData] = React.useState<StickerData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [district, setDistrict] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  React.useEffect(() => {
    let alive = true;
    fetchStickers()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const rows = data?.rows;

  const shown = React.useMemo(
    () => (rows ?? []).filter((r) => !district || r.district === district),
    [rows, district],
  );

  const visible = React.useMemo(() => {
    if (!data) return new Uint32Array(0);
    const on = new Set(shown.map((r) => r.oid));
    const out: number[] = [];
    for (let i = 0; i < data.points.oid.length; i++) {
      if (on.has(data.points.oid[i])) out.push(i);
    }
    return Uint32Array.from(out);
  }, [data, shown]);

  /* Цэгийн шошго — барилгын нэр. Найман цэг тул эрт харагдаж болно */
  const labels = React.useMemo(() => {
    if (!data) return undefined;
    const name = new Map(data.rows.map((r) => [r.oid, r.name]));
    return {
      text: data.points.oid.map((oid) => name.get(oid) ?? ""),
      minzoom: 11,
    };
  }, [data]);

  const byDistrict = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.district, (m.get(r.district) ?? 0) + 1);
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const stats = React.useMemo(
    () => ({
      n: shown.length,
      districts: new Set(shown.map((r) => r.district)).size,
      khoroos: new Set(shown.map((r) => `${r.district}|${r.khoroo}`)).size,
    }),
    [shown],
  );

  /* ---------------- Сонголтын хүрээ (zoom action) ---------------- */
  const focus = React.useMemo<Extent | null>(() => {
    if (picked == null && !district) return null;
    const b = new Bounds();
    for (const r of picked != null ? shown.filter((x) => x.oid === picked) : shown) {
      b.add(r.lon, r.lat);
    }
    return b.get(0.003);
  }, [shown, picked, district]);

  const active = React.useMemo(() => {
    const id = hover ?? picked;
    return id == null ? null : (rows?.find((r) => r.oid === id) ?? null);
  }, [rows, hover, picked]);

  function reset() {
    setDistrict(null);
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
            Стикер байршуулсан барилга татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Стикер байршуулсан барилга"
        activeCount={district ? 1 : 0}
        onReset={reset}
      >
        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={220}
        >
          <PickList items={byDistrict} selected={district} onPick={setDistrict} />
        </FilterMenu>
      </FilterBar>

      {/*
        Индикаторын зурвас — бүтэн өргөнөөр, зураасаар тусгаарласан.

        Нүд нь ӨӨРӨӨ ХЭЛБЭРЭЭ АВНА: өргөн дэлгэц дээр гурвуулаа нэг мөрөнд
        дэлгэгдэж, нарийн дээр хоёр мөр болж эвхэгдэнэ. Тоо, иконы хэмжээ
        нь дэлгэцийн өргөнөөс хамаарч томорч жижигрэх тул зайг бүрэн
        ашиглана — өмнө нь шүүлтүүрийн мөрөнд шахагдсан жижиг бичвэр
        байсан бөгөөд гол тоонууд нь харагдахгүй байлаа.
      */}
      <div className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 sm:divide-y-0">
          <Indicator icon={Sticker} label="Стикер байршуулсан барилга" value={num(stats.n)} />
          <Indicator icon={Building2} label="Хамрагдсан дүүрэг" value={num(stats.districts)} />
          <Indicator icon={MapPin} label="Хамрагдсан хороо" value={num(stats.khoroos)} />
        </div>
      </div>

      {/* Газрын зураг бүтэн өргөнөөр — доор нь картын эгнээ */}
      <Card className="relative min-h-[240px] flex-1 overflow-hidden">
        {/*
          `warn-pins` — тэмдэглэгээг дохионы өнгөнд оруулна: цөм нь
          улбар шар, тэлэх цагираг нь улаан. Эдгээр барилга нь "хэр их"
          гэсэн хэмжигдэхүүн биш ШУВУУ МӨРГӨХ ЭРСДЭЛ-ийн тэмдэг тул
          дата дүрслэлийн цэнхэр нь утгыг нь дутуу хэлж байв.
        */}
        <div className="warn-pins relative h-full w-full">
          {/* Цэг цөөхөн (8) тул бөөгнөрүүлэхгүй */}
          <PointMap
            points={data.points}
            visible={visible}
            labels={labels}
            basemap={basemap}
            onSelect={(oid) => setPicked(picked === oid ? null : oid)}
            onHover={setHover}
            focus={focus}
            cluster={false}
            pulse
          />
          <BasemapGallery value={basemap} onChange={setBasemap} />

          {active ? (
            <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[280px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
              <div className="eyebrow mb-1.5">Стикер байршуулсан</div>
              <div className="text-[12.5px] leading-snug text-ink">{active.name}</div>
              <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                {active.address || `${active.district} · ${active.khoroo}`}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/*
        Барилгын карт — эгнээ.

        Тогтмол өргөнтэй (`w-[190px]`) байсныг СҮЛЖЭЭ болгов: найман карт
        190px-ээр тавигдахад өргөн дэлгэцэн дээр баруун талд хоосон зай
        үлдэж, эгнээ таллаа тасарсан мэт харагдаж байлаа. `auto-fit` нь
        боломжит өргөнг картуудад ТЭНЦҮҮ хуваана — нарийн дэлгэцэн дээр
        өөрөө хоёр, дөрвөн мөр болж эвхэгдэнэ.

        Зураас нь `gap-px` + дэвсгэрээр гарна: мөр даган эвхэгдэх үед
        `divide-x` нь буруу тал дээр зураас үлдээдэг тул тохирохгүй.
      */}
      <div
        className="grid shrink-0 gap-px overflow-hidden rounded-xs border border-line bg-line"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}
      >
        {shown.map((r) => (
          <button
            key={r.oid}
            onClick={() => setPicked(picked === r.oid ? null : r.oid)}
            onMouseEnter={() => setHover(r.oid)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "px-3 py-2.5 text-left transition-colors hover:bg-paper-hi",
              picked === r.oid ? "bg-paper-hi" : "bg-paper-2",
            )}
          >
            <div className="flex items-center gap-1.5">
              {/* Иконы өнгө газрын зурган дээрх тэмдэглэгээтэй нэг —
                  карт ба цэг хоёр нэг зүйл болохыг холбоно */}
              <Sticker size={12} strokeWidth={1.75} className="shrink-0 text-ochre" />
              <span className="num text-[10px] text-ink-3">
                {String(r.no).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-1.5 truncate text-[12.5px] leading-none text-ink">
              {r.name}
            </div>
            <div className="mt-1.5 flex items-start gap-1 text-[10.5px] leading-snug text-ink-3">
              <MapPin size={10} strokeWidth={1.75} className="mt-[1px] shrink-0" />
              <span className="min-w-0 truncate">
                {r.district} · {r.khoroo}
              </span>
            </div>
          </button>
        ))}
        {shown.length === 0 ? (
          <div className="bg-paper-2 py-5 text-center text-[12px] text-ink-3">
            Шүүлтүүрт тохирох барилга алга
          </div>
        ) : null}
      </div>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Суурь зураг: Esri · Дата: ArcGIS · {num(data.rows.length)} барилга
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Индикаторын нэгж нүд.
 *
 * Хэмжээ нь дэлгэцийн өргөнд ЗОХИЦНО (`clamp`): нарийн дэлгэцэд 18px,
 * өргөнд 26px хүртэл томорно. Тогтмол хэмжээтэй бол найман барилгын
 * самбарт өргөн зай хоосон үлдэж, тоо нь бяцхан харагдана.
 */
function Indicator({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Sticker;
}) {
  return (
    <div className="flex flex-col px-3.5 py-3">
      <span className="eyebrow block min-h-[30px] leading-[1.35]">{label}</span>
      <div className="mt-auto flex items-center gap-2">
        <Icon
          strokeWidth={1.6}
          className="shrink-0 text-ink-3"
          style={{ width: "clamp(18px, 2.4vw, 28px)", height: "clamp(18px, 2.4vw, 28px)" }}
        />
        <span
          className="num truncate leading-none font-medium text-ink"
          style={{ fontSize: "clamp(18px, 2.2vw, 26px)" }}
        >
          {value}
        </span>
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
