"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Building2, Loader2, Ruler, Zap } from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { PieChart } from "@/components/charts";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { Bounds } from "@/lib/extent";
import { fetchPoles, type PoleData } from "@/lib/poles";
import { cn, num } from "@/lib/utils";

/** Шугамын дүрсийн дугаар — цэгийн `oid`-той мөргөлдөхгүй сөрөг утга */
const LINE_ID = -1;

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
 * Цахилгаан дамжуулах 10, 15 кВ-ын шонгийн самбар.
 *
 * Гучин шон бүгд нэг шугамын дагуу дараалан байрлана — энэ бол
 * ТАРХАЛТ БИШ, ШУГАМ. Тиймээс хэлтсийн бусад самбар шиг "хаана хэр
 * олон" гэж асуух нь утгагүй: бүгд нэг хороонд, нэг шугамын дагуу.
 *
 * Оронд нь ДЭС ДАРАА нь харуулна: шон бүр өмнөхөөсөө хэдэн метрийн
 * зайтай вэ. Зайн хэлбэлзэл нь шугамын хэсгүүдийг ялгаж өгдөг —
 * нягт хэсэг, урт алгасалт хоёр өөр газар зүйн нөхцөлийг хэлнэ.
 */
export function PolesDashboard() {
  const [data, setData] = React.useState<PoleData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [place, setPlace] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  React.useEffect(() => {
    let alive = true;
    fetchPoles()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const rows = data?.rows;

  const shown = React.useMemo(
    () => (rows ?? []).filter((r) => !place || r.place === place),
    [rows, place],
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

  /*
    Шугамыг ХЭРЧИМ ТУС БҮРЭЭР зурна.

    Нэг бүтэн `LineString` биш, хөрш шон бүрийн хооронд тусдаа хэрчим:
    ингэснээр хэрчим бүр өөрийн ЗАЙГ шошго болгон үүрч чадна
    (`labelPlacement: "line-center"` нь шошгыг хэрчмийн дундад,
    чиглэлийн дагуу эргүүлж тавина). Тусдаа диаграм уншихгүйгээр
    "энэ хоёр шонгийн хооронд хэдэн метр вэ" гэдэг зурган дээрээ
    шууд харагдана.
  */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    const out: GeoJSON.Feature[] = [];
    for (let i = 1; i < shown.length; i++) {
      const a = shown[i - 1];
      const b = shown[i];
      /* Байршил солигдсон заагийг ХОЛБОХГҮЙ — хоёр өөр шугамыг нэг
         болгож үзүүлэх нь датаг гуйвуулна. `gap` нь тэр мөрд `null` */
      if (b.gap == null) continue;
      out.push({
        type: "Feature",
        id: LINE_ID - i,
        properties: { oid: LINE_ID - i, t: `${Math.round(b.gap)} м` },
        geometry: {
          type: "LineString",
          coordinates: [
            [a.lon, a.lat],
            [b.lon, b.lat],
          ],
        },
      });
    }
    return { type: "FeatureCollection", features: out };
  }, [shown]);

  const byPlace = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.place, (m.get(r.place) ?? 0) + 1);
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const stats = React.useMemo(() => {
    const gaps = shown.map((r) => r.gap).filter((g): g is number => g != null);
    const length = gaps.reduce((s, g) => s + g, 0);
    return {
      n: shown.length,
      length,
      avg: gaps.length ? length / gaps.length : 0,
      max: gaps.length ? Math.max(...gaps) : 0,
    };
  }, [shown]);

  /*
    Байршил тус бүрийн ШОНГИЙН ТОО.

    Зайг өөрийг нь диаграм болгох шаардлага үгүй болсон — хэрчим бүр
    зайгаа газрын зураг дээрээ бичиж байна. Энд үлдэх асуулт нь
    "хоёр шугам тус бүр хэдэн шонтой вэ" гэдэг энгийн тоолол.

    Хоёрхон ангилал тул бөгжөөр — товшиход тухайн шугамаар шүүнэ.

    Тоо нь ШҮҮЛТГҮЙ (`byPlace`): бөгж нь өөрийнхөө хэмжигдэхүүнээр
    шүүгдвэл нэг байршил сонгомогц үлдсэн зүсэм 100% болж, нөгөө
    шугамтайгаа харьцуулах боломж алга болно.
  */

  /* ---------------- Сонголтын хүрээ (zoom action) ---------------- */
  const focus = React.useMemo<Extent | null>(() => {
    if (picked == null && !place) return null;
    const b = new Bounds();
    for (const r of picked != null ? shown.filter((x) => x.oid === picked) : shown) {
      b.add(r.lon, r.lat);
    }
    return b.get(0.0012);
  }, [shown, picked, place]);

  const active = React.useMemo(() => {
    const id = hover ?? picked;
    return id == null ? null : (rows?.find((r) => r.oid === id) ?? null);
  }, [rows, hover, picked]);

  function reset() {
    setPlace(null);
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
            Шонгийн байршил татаж байна…
          </span>
        )}
      </div>
    );
  }

  const first = data.rows[0];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Цахилгааны шон"
        activeCount={place ? 1 : 0}
        onReset={reset}
        /* Бүх шон нэг дүүрэг, нэг хороонд байгаа тул түүнийг шүүлтүүр
           болгохгүй — байнга давтагдах утгыг гарчгийн хажууд бичнэ */
        leading={
          <span className="text-[11.5px] text-ink-3">
            {first?.district} · {first?.khoroo}
          </span>
        }
      >
        {/* Байршил ганцхан утгатай бол цэс нь сонголт биш чимэг болно */}
        {byPlace.length > 1 ? (
          <FilterMenu
            label="Байршил"
            icon={Building2}
            value={place}
            active={Boolean(place)}
            onClear={() => setPlace(null)}
            width={230}
          >
            <PickList items={byPlace} selected={place} onPick={setPlace} />
          </FilterMenu>
        ) : null}
      </FilterBar>

      <Columns layout="flex" id="poles" left={290} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: индикатор + шугамын дараалал ---- */}
        <div className="flex min-h-0 flex-col gap-2.5 xl:w-(--col-l) xl:shrink-0">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Stat icon={Zap} label="Шонгийн тоо" value={num(stats.n)} />
              <Stat
                icon={Ruler}
                label="Шугамын урт, м"
                value={num(Math.round(stats.length))}
              />
              <Stat icon={Ruler} label="Дундаж зай, м" value={num(Math.round(stats.avg))} />
              <Stat
                icon={Ruler}
                label="Хамгийн урт зай, м"
                value={num(Math.round(stats.max))}
              />
            </div>
          </Card>

          {/*
            Байршил бүрийн шонгийн тоо — бөгжөөр.

            Зай өөрөө газрын зураг дээр хэрчим бүр дээрээ бичигдэж
            байгаа тул энд давтах шаардлагагүй. Үлдэх асуулт нь хоёр
            шугам тус бүр хэдэн шонтой вэ гэдэг энгийн тоолол.
          */}
          <Card className="min-h-[110px] flex-1">
            <Head title="Байршлаар">
              <span className="text-[10.5px] text-ink-3">шон</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <PieChart
                data={byPlace}
                size={96}
                selected={place}
                onSelect={setPlace}
              />
            </div>
          </Card>
        </div>

        {/* ---- БАРУУН: газрын зураг ---- */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <Card className="relative min-h-[300px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/* Цэг цөөхөн (30) тул бөөгнөрүүлэхгүй */}
              <PointMap
                points={data.points}
                visible={visible}
                /*
                  Хэрчим бүр өөрийн зайг шошго болгон үүрнэ
                  (`labelPlacement: "line-center"` нь шугамын дундад,
                  чиглэлийн дагуу эргүүлж тавина). `labelZoom` нь
                  ойртсон үед л гаргана — алсаас 29 тоо нэг дор гарвал
                  шугам өөрөө уншигдахаа болино.
                */
                shapes={{
                  data: shapes,
                  selected: null,
                  labelZoom: 13,
                  labelPlacement: "line-center",
                }}
                basemap={basemap}
                onSelect={(oid) => setPicked(picked === oid ? null : oid)}
                onHover={setHover}
                focus={focus}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {active ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[250px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="eyebrow mb-1.5">
                    {String(active.no).padStart(2, "0")}-р шон
                  </div>
                  <div className="text-[12.5px] leading-snug text-ink">{active.place}</div>
                  <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                    {active.district} · {active.khoroo}
                  </div>
                  <div className="num mt-1 text-[10.5px] text-ink-3">
                    {active.gap == null
                      ? "Шугамын эхний шон"
                      : `Өмнөх шонгоос ${Math.round(active.gap)} м`}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS · {num(data.rows.length)} шон · зайг
            координатаас тооцов
          </p>
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

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
  icon: typeof Ruler;
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
