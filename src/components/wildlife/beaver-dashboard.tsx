"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  CalendarRange,
  LandPlot,
  Loader2,
  MapPin,
  Route,
  Tag,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { DATA_COLOR } from "@/components/wells/colors";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import {
  defaultBasemap,
  type Basemap,
  type MapOverlay,
} from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { fetchBeaver, type BeaverData } from "@/lib/beaver";
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
 * Минжний судалгааны самбар — ХЭЭРИЙН АЯЛЛЫН харагдац.
 *
 * Гурван давхарга НЭГ зурган дээр давхарлана: судалгааны ТАЛБАЙ
 * (хүрээ), явсан МАРШРУТ (шугам), олдсон АЖИГЛАЛТ (цэг). Энэ гурав
 * нь "хаана явж, юу олсон" гэсэн НЭГ асуултын гурван хэсэг тул
 * тусад нь харуулбал утга нь алдагдана.
 *
 * ⚠ Бусад самбараас ялгаатай нь ЗУРАГ нь гол элемент, жагсаалт нь
 * тайлбар: маршрут, талбай хоёр зөвхөн зураг дээр утгатай (жагсаалтад
 * "12 шугам" гэж бичих нь юу ч хэлэхгүй). Тиймээс диаграмууд нь
 * ажиглалтын ангилал, судалгааны үе гэсэн ХОЁР л тэнхлэгтэй —
 * эх сурвалжид бусад задаргаа алга.
 *
 * ⚠⚠ **ДИЙЛЭНХ НЬ НИЙСЛЭЛЭЭС ГАДУУР**: 120 ажиглалтын 116 нь Төв
 * аймгийн Эрдэнэ сум. Байршлын задаргаа нь аймаг/хот ба сум/дүүргийг
 * НЭГ тэнхлэгт нэгтгэдэг — тусад нь харуулбал хоёр бараг ижил
 * диаграм гарна.
 */
export function BeaverDashboard() {
  const [data, setData] = React.useState<BeaverData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<string | null>(null);
  const [round, setRound] = React.useState<string | null>(null);
  const [place, setPlace] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  React.useEffect(() => {
    const ac = new AbortController();
    fetchBeaver(ac.signal)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, []);

  const shown = React.useMemo(() => {
    const out: number[] = [];
    (data?.spots ?? []).forEach((s, i) => {
      if (kind && s.kind !== kind) return;
      if (round && s.round !== round) return;
      if (place && s.place !== place) return;
      out.push(i);
    });
    return out;
  }, [data, kind, round, place]);

  const visible = React.useMemo(() => Uint32Array.from(shown), [shown]);

  /* Диаграм бүр өөрийнхөө тэнхлэгийг АЛГАСЧ шүүгдэнэ */
  const tally = React.useCallback(
    (of: (i: number) => string, skip: "kind" | "round" | "place"): Datum[] => {
      if (!data) return [];
      const counts = new Map<string, number>();
      data.spots.forEach((s, i) => {
        if (skip !== "kind" && kind && s.kind !== kind) return;
        if (skip !== "round" && round && s.round !== round) return;
        if (skip !== "place" && place && s.place !== place) return;
        const key = of(i);
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, label: key, value }));
    },
    [data, kind, round, place],
  );

  const byKind = React.useMemo(
    () => tally((i) => data?.spots[i].kind ?? "", "kind"),
    [tally, data],
  );
  const byRound = React.useMemo(
    () => tally((i) => data?.spots[i].round ?? "", "round"),
    [tally, data],
  );
  const byPlace = React.useMemo(
    () => tally((i) => data?.spots[i].place ?? "", "place"),
    [tally, data],
  );

  /*
    МАРШРУТ нь нэмэлт давхарга (`overlays`) — ХАРИЛЦДАГГҮЙ.

    Шугамууд нь GPS-ийн түүхий мөр бөгөөд өөрсдөө задаргаа болох
    талбаргүй (нэр, тайлбар нь хоосон). Тэдгээр нь хаана явсныг л
    хэлдэг ДЭВСГЭР мэдээлэл тул товшигдох шаардлагагүй.
  */
  const overlays = React.useMemo<MapOverlay[] | undefined>(() => {
    if (!data) return undefined;
    const out: MapOverlay[] = [];

    /*
      ⚠⚠ **СУДАЛГААНЫ ТАЛБАЙ нь ХҮРЭЭ ДЭЭР МАШ БҮДЭГ ДҮҮРГЭЛТТЭЙ**
      (хэрэглэгчийн шийдвэр, 2026-09-16). Урьд нь дата олон өнцөгтийн
      горимоор (`shapes`) зурагдаж байсан бөгөөд тэр нь ӨТГӨН
      дүүргэлт, сарнисан гэрэлтэй ирдэг. Горхи-Тэрэлж 292 мянган га
      тул тэр дүүргэлт зургийн ТАЛЫГ хучиж, доорх хиймэл дагуулын
      зураг, маршрут, ажиглалтын цэг бүгд цэнхэр хөшигний цаана
      үлдэж байв.

      Одоо дүүргэлт нь **10%** — талбайн ДОТОР, ГАДНА хоёрыг ялгахад
      хангалттай ч доорх зургийг дардаггүй. Талбай нь хэмжигдэхүүн
      БИШ ХАМРАХ ХҮРЭЭ: "судалгаа энэ хилийн дотор явагдсан" гэдгийг
      л хэлнэ.
    */
    if (data.areaShapes.features.length > 0) {
      out.push({
        id: "minj-area",
        data: data.areaShapes,
        fill: { color: DATA_COLOR, opacity: 0.1 },
        line: { color: DATA_COLOR, opacity: 0.85, width: 1.6 },
      });
    }

    if (data.routes.features.length > 0) {
      out.push({
        id: "minj-route",
        data: data.routes,
        /* Маршрут нь талбайн ДОТОР сууна — нимгэн, бүдэг барьснаар
           хоёр шугам хоорондоо ялгагдана */
        line: { color: DATA_COLOR, opacity: 0.5, width: 1 },
      });
    }

    return out.length ? out : undefined;
  }, [data]);

  const labels = React.useMemo(() => {
    if (!data) return undefined;
    return { text: data.spots.map((s) => s.kind), minzoom: 11 };
  }, [data]);

  const stats = React.useMemo(() => {
    if (!data) return null;
    const kinds = new Set<string>();
    for (const i of shown) kinds.add(data.spots[i].kind);
    return {
      spots: shown.length,
      kinds: kinds.size,
      ha: data.areas.reduce((t, a) => t + a.ha, 0),
      km: data.routeKm,
    };
  }, [data, shown]);

  const detail = React.useMemo(() => {
    if (!data || picked == null) return null;
    return data.spots.find((s) => s.oid === picked) ?? null;
  }, [data, picked]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <p className="max-w-[420px] px-6 text-center text-[12.5px] leading-relaxed text-clay">
          {error}
        </p>
      </div>
    );
  }

  if (!data || !stats) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <Loader2 size={16} className="animate-spin text-ink-3" />
      </div>
    );
  }

  const activeCount = (kind ? 1 : 0) + (round ? 1 : 0) + (place ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Минжний судалгаа"
        activeCount={activeCount}
        onReset={() => {
          setKind(null);
          setRound(null);
          setPlace(null);
          setPicked(null);
        }}
      >
        <FilterMenu
          label="Ангилал"
          icon={Tag}
          value={kind}
          active={Boolean(kind)}
          onClear={() => setKind(null)}
          width={250}
        >
          <PickList items={byKind} selected={kind} onPick={setKind} />
        </FilterMenu>

        <FilterMenu
          label="Судалгааны үе"
          icon={CalendarRange}
          value={round}
          active={Boolean(round)}
          onClear={() => setRound(null)}
          width={220}
        >
          <PickList items={byRound} selected={round} onPick={setRound} />
        </FilterMenu>

        <FilterMenu
          label="Байршил"
          icon={MapPin}
          value={place}
          active={Boolean(place)}
          onClear={() => setPlace(null)}
          width={250}
        >
          <PickList items={byPlace} selected={place} onPick={setPlace} />
        </FilterMenu>
      </FilterBar>

      <Columns layout="flex" id="beaver" right={320} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: талбай, маршрут, ажиглалт НЭГ зурган дээр ---- */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-xs border border-line bg-paper-2">
            <div className="relative h-full w-full">
              <PointMap
                points={data.points}
                visible={visible}
                labels={labels}
                overlays={overlays}
                /* 120 цэг тул бөөгнөрүүлэхгүй — бөөгнөрвөл маршрутын
                   дагуух дараалал нь алдагдана */
                cluster={false}
                pulse
                highlight={detail ? [detail.lon, detail.lat] : null}
                basemap={basemap}
                onSelect={(oid) => setPicked(picked === oid ? null : oid)}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {/*
                СОНГОСОН ЦЭГ — зургийн доод зүүн буланд, жижиг хуудас.
                Бичлэгт талбар цөөн (ангилал, үе, байршил, тэмдэглэгээ)
                тул бүтэн хөвөгч самбар нэмэх нь илүүц.
              */}
              {detail ? (
                <div className="elevated absolute bottom-2.5 left-2.5 z-10 w-[240px] rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
                  <div className="flex items-baseline justify-between gap-2 border-b border-line px-2.5 py-2">
                    <span className="text-[12.5px] leading-none font-medium text-ink">
                      {detail.kind}
                    </span>
                    <span className="num text-[10.5px] leading-none text-ink-3">
                      №{detail.no}
                    </span>
                  </div>
                  <dl className="space-y-1.5 px-2.5 py-2">
                    <Field k="Судалгааны үе" v={detail.round} />
                    <Field k="Байршил" v={detail.place} />
                    <Field k="Дэд төрөл" v={detail.sub} />
                    <Field k="Тэмдэглэгээ" v={detail.mark} />
                  </dl>
                </div>
              ) : null}
            </div>
          </div>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS Enterprise · хүрээ нь судалгааны
            талбай, шугам нь явсан маршрут
          </p>
        </div>

        {/* ---- БАРУУН: үзүүлэлт, задаргаа, талбайн жагсаалт ---- */}
        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto xl:w-(--col-r) xl:shrink-0">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Stat icon={MapPin} label="Ажиглалт" value={num(stats.spots)} />
              <Stat icon={Tag} label="Ангилал" value={num(stats.kinds)} />
              <Stat
                icon={Route}
                label="Маршрут, км"
                value={num(Math.round(stats.km))}
              />
              <Stat
                icon={LandPlot}
                label="Судалгааны талбай, га"
                value={num(Math.round(stats.ha))}
              />
            </div>
          </Card>

          <Card className="min-h-[150px] flex-1">
            <Head title="Ангиллаар">
              <span className="text-[10.5px] text-ink-3">ажиглалт</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <RowChart data={byKind} selected={kind} onSelect={setKind} />
            </div>
          </Card>

          <Card className="shrink-0">
            <Head title="Судалгааны үеэр">
              <span className="text-[10.5px] text-ink-3">ажиглалт</span>
            </Head>
            <div className="p-3">
              <RowChart data={byRound} selected={round} onSelect={setRound} />
            </div>
          </Card>

          {/*
            Талбай ердөө ХОЁР тул диаграм болгохгүй — жагсаалт нь
            нэр, хэмжээ хоёрыг шууд хэлнэ.
          */}
          <Card className="shrink-0">
            <Head title="Судалгааны талбай" />
            <ul className="divide-y divide-line">
              {data.areas.map((a) => (
                <li
                  key={a.oid}
                  className="flex items-baseline justify-between gap-2 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                    {a.name}
                  </span>
                  <span className="num shrink-0 text-[11.5px] text-ink">
                    {num(Math.round(a.ha))} га
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Field({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-[78px] shrink-0 text-[10px] tracking-[0.06em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-2">
        {v}
      </dd>
    </div>
  );
}

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xs border border-line bg-paper-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Head({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
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
  icon: typeof MapPin;
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
