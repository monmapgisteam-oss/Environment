"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Route,
  Sprout,
  X,
} from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { fetchBiotech, type BiotechSite } from "@/lib/biotech";
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
 * Биотехникийн арга хэмжээний самбар.
 *
 * ⚠ **ХҮСНЭГТ ТӨВТЭЙ, зураг нь БАЙРШИЛ ЗААГЧ** — платформын бусад
 * самбараас зориудаар өөр. Шалтгаан: бичлэг ердөө 14 бөгөөд тус бүр
 * нь ДОКУМЕНТ (давс, өвс хавар, өвс намар, зам — дөрвөн тоог зэрэг
 * харах шаардлагатай). Ийм датад диаграм нэмэх нь хүснэгтэд аль
 * хэдийн байгаа тоог дахин зурахаас өөр юу ч хэлэхгүй; 14 мөр нэг
 * дэлгэцэнд бүтнээрээ багтана.
 *
 * Ерөнхий үнэлгээний самбартай ижил зарчим — тэр нь платформын
 * `<table>` хэрэглэсэн нөгөө харагдац.
 *
 * ⚠ **ДАВС НЭГ БАГАНА**: эх сурвалж хавар, намрыг тусад нь бичдэг ч
 * 14/14 мөрд ЯГ ИЖИЛ утгатай — хоёр багана болгон харуулбал хоёр
 * тусдаа хэмжилт мэт уншигдаж, нийт дүн хоёр дахин болно. Өвс нь
 * харин үнэхээр ялгаатай тул хоёр багана хэвээр.
 */
export function BiotechDashboard() {
  const [rows, setRows] = React.useState<BiotechSite[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [district, setDistrict] = React.useState<string | null>(null);
  const [officer, setOfficer] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<{ by: SortKey; desc: boolean }>({
    by: "no",
    desc: false,
  });

  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  React.useEffect(() => {
    const ac = new AbortController();
    fetchBiotech(ac.signal)
      .then(setRows)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, []);

  const shown = React.useMemo(() => {
    const out: number[] = [];
    (rows ?? []).forEach((r, i) => {
      if (district && r.district !== district) return;
      if (officer && r.officer !== officer) return;
      out.push(i);
    });
    return out;
  }, [rows, district, officer]);

  /* Эрэмбэ нь ХАРАГДАЦЫНХ — шүүлт биш тул `shown`-г л дараална */
  const ordered = React.useMemo(() => {
    if (!rows) return [];
    const dir = sort.desc ? -1 : 1;
    return [...shown].sort((a, b) => {
      const x = rows[a];
      const y = rows[b];
      const cmp = compare(x, y, sort.by);
      /* Тэнцвэл дугаараар нь — эрэмбэ тогтвортой байх ёстой */
      return cmp !== 0 ? cmp * dir : x.no - y.no;
    });
  }, [rows, shown, sort]);

  const visible = React.useMemo(() => Uint32Array.from(shown), [shown]);

  const points = React.useMemo(() => {
    const src = rows ?? [];
    return {
      oid: src.map((r) => r.oid),
      lon: src.map((r) => r.lon),
      lat: src.map((r) => r.lat),
    };
  }, [rows]);

  /* Зураг дээрх шошго — газрын нэр */
  const labels = React.useMemo(() => {
    if (!rows) return undefined;
    return { text: rows.map((r) => r.place), minzoom: 8 };
  }, [rows]);

  const stats = React.useMemo(() => {
    if (!rows) return null;
    let salt = 0;
    let spring = 0;
    let autumn = 0;
    let km = 0;
    const districts = new Set<string>();
    for (const i of shown) {
      const r = rows[i];
      salt += r.salt ?? 0;
      spring += r.haySpring ?? 0;
      autumn += r.hayAutumn ?? 0;
      km += r.km ?? 0;
      districts.add(r.district);
    }
    return {
      sites: shown.length,
      salt,
      hay: spring + autumn,
      km,
      districts: districts.size,
    };
  }, [rows, shown]);

  const byDistrict = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (officer && r.officer !== officer) continue;
      m.set(r.district, (m.get(r.district) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({ key, label: key, value }));
  }, [rows, officer]);

  const byOfficer = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.officer) continue;
      if (district && r.district !== district) continue;
      m.set(r.officer, (m.get(r.officer) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({ key, label: key, value }));
  }, [rows, district]);

  /** Багана бүрийн хамгийн их утга — нүдэн доторх хэмжигчийн хуваарь */
  const peak = React.useMemo(() => {
    const src = rows ?? [];
    const max = (of: (r: BiotechSite) => number | null) =>
      src.reduce((t, r) => Math.max(t, of(r) ?? 0), 0) || 1;
    return {
      salt: max((r) => r.salt),
      hay: max((r) => Math.max(r.haySpring ?? 0, r.hayAutumn ?? 0)),
      km: max((r) => r.km),
    };
  }, [rows]);

  /** Товшсон байршил — хүснэгтийн мөр ба зургийн цэг хоёулаа тавина */
  const chosen = React.useMemo(
    () =>
      picked == null ? null : (rows?.find((r) => r.oid === picked) ?? null),
    [rows, picked],
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <p className="max-w-[420px] px-6 text-center text-[12.5px] leading-relaxed text-clay">
          {error}
        </p>
      </div>
    );
  }

  if (!rows || !stats) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <Loader2 size={16} className="animate-spin text-ink-3" />
      </div>
    );
  }

  const activeCount = (district ? 1 : 0) + (officer ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Биотехникийн арга хэмжээ"
        activeCount={activeCount}
        onReset={() => {
          setDistrict(null);
          setOfficer(null);
          setPicked(null);
        }}
      >
        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={230}
        >
          <PickList
            items={byDistrict}
            selected={district}
            onPick={setDistrict}
          />
        </FilterMenu>

        <FilterMenu
          label="Бүртгэсэн"
          icon={MapPin}
          value={officer}
          active={Boolean(officer)}
          onClear={() => setOfficer(null)}
          width={220}
        >
          <PickList items={byOfficer} selected={officer} onPick={setOfficer} />
        </FilterMenu>
      </FilterBar>

      {/*
        ИНДИКАТОРЫН ЗУРВАС — бүтэн өргөнтэй, хүснэгтийн дээр.

        ⚠ Давс нь УЛИРАЛ ТУС БҮРИЙН хэмжээ (хавар, намар ижил тул
        нэмэхгүй), өвс нь хоёр улирлын НИЙЛБЭР. Хоёр өөр аргаар
        нэгтгэж байгаа нь санаатай — эх сурвалжийн бичилт тийм.
      */}
      <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-line rounded-xs border border-line bg-paper-2 sm:grid-cols-4 sm:divide-y-0">
        <Stat icon={MapPin} label="Байршил" value={num(stats.sites)} />
        <Stat icon={Sprout} label="Давс, кг" value={num(stats.salt)} />
        <Stat icon={Sprout} label="Өвс, боодол" value={num(stats.hay)} />
        <Stat icon={Route} label="Явсан зам, км" value={num(stats.km)} />
      </div>

      <Columns
        layout="flex"
        id="biotech"
        right={360}
        className="min-h-0 flex-1"
      >
        {/* ---- ЗҮҮН: бүртгэлийн хүснэгт ---- */}
        <div className="flex min-h-0 flex-1 flex-col rounded-xs border border-line bg-paper-2">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
            <h2 className="display text-[13.5px] leading-none tracking-[0.06em] uppercase">
              Байршил, тавьсан тэжээл
            </h2>
            <span className="num text-[11.5px] text-ink-3">
              {num(ordered.length)} / {num(rows.length)}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead className="sticky top-0 z-10 bg-paper-2">
                <tr className="border-b border-line">
                  <Th
                    col="no"
                    sort={sort}
                    onSort={setSort}
                    className="w-[38px]"
                  >
                    №
                  </Th>
                  <Th col="place" sort={sort} onSort={setSort}>
                    Газрын нэр
                  </Th>
                  <Th
                    col="district"
                    sort={sort}
                    onSort={setSort}
                    className="w-[120px]"
                  >
                    Дүүрэг
                  </Th>
                  <Th
                    col="salt"
                    sort={sort}
                    onSort={setSort}
                    num
                    className="w-[96px]"
                  >
                    Давс, кг
                  </Th>
                  <Th
                    col="spring"
                    sort={sort}
                    onSort={setSort}
                    num
                    className="w-[92px]"
                  >
                    Өвс, хавар
                  </Th>
                  <Th
                    col="autumn"
                    sort={sort}
                    onSort={setSort}
                    num
                    className="w-[92px]"
                  >
                    Өвс, намар
                  </Th>
                  <Th
                    col="km"
                    sort={sort}
                    onSort={setSort}
                    num
                    className="w-[84px]"
                  >
                    Зам, км
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ordered.map((i) => {
                  const r = rows[i];
                  const on = picked === r.oid;
                  return (
                    <tr
                      key={r.oid}
                      onClick={() => setPicked(on ? null : r.oid)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-paper-hi",
                        on && "bg-data/10",
                      )}
                    >
                      <td className="num px-3 py-2 text-ink-3">{r.no}</td>
                      <td className="px-3 py-2">
                        <span className="block leading-snug text-ink">
                          {r.place}
                        </span>
                        {r.officer ? (
                          <span className="mt-0.5 block text-[10px] leading-none text-ink-3">
                            {r.officer}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-ink-2">{r.district}</td>
                      <Cell value={r.salt} peak={peak.salt} />
                      <Cell value={r.haySpring} peak={peak.hay} />
                      <Cell value={r.hayAutumn} peak={peak.hay} />
                      <Cell value={r.km} peak={peak.km} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- БАРУУН: байршил заагч зураг ---- */}
        <div className="flex min-h-0 flex-col gap-2.5 xl:w-(--col-r) xl:shrink-0">
          <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-xs border border-line bg-paper-2">
            <div className="relative h-full w-full">
              <PointMap
                points={points}
                visible={visible}
                labels={labels}
                /* Цэг ердөө 14 тул бөөгнөрүүлэхгүй; дохиоллын
                   тэмдэглэгээ нь хиймэл дагуулын өнгөн дээр ялгарна */
                cluster={false}
                pulse
                highlight={
                  picked != null
                    ? ((): [number, number] | null => {
                        const r = rows.find((x) => x.oid === picked);
                        return r ? [r.lon, r.lat] : null;
                      })()
                    : null
                }
                basemap={basemap}
                onSelect={(oid) => setPicked(picked === oid ? null : oid)}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {/*
                ТОВШИЛТЫН ЦОНХ — hover картаас ТУСДАА.

                hover карт нь хулганы доорх зүйлийг хэлдэг тул хулгана
                хөдлөх бүрд солигдоно; энэ нь СОНГОСОН обьектоо барьж,
                хаах товчтой. Хоёрыг нэгтгэвэл сонголтоо тогтоосон
                хойноо агуулга нь мултарна.
              */}
              {chosen ? (
                <div className="elevated absolute right-2.5 bottom-2.5 z-10 w-[250px] rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow">Байршлын бичилт</span>
                    <button
                      onClick={() => setPicked(null)}
                      aria-label="Хаах"
                      className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <dl className="space-y-1.5 px-2.5 py-2">
                    <PopField k="Газар" v={chosen.place} />
                    <PopField k="Дүүрэг" v={chosen.district} />
                    <PopField k="Давс" v={chosen.salt == null ? "" : `${num(chosen.salt)} кг`} />
                    <PopField k="Өвс" v={`${chosen.haySpring ?? 0} + ${chosen.hayAutumn ?? 0} боодол`} />
                    <PopField k="Зам" v={chosen.km == null ? "" : `${num(chosen.km)} км`} />
                    <PopField k="Бүртгэсэн" v={chosen.officer} />
                  </dl>
                </div>
              ) : null}

            </div>
          </div>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS Enterprise · {num(stats.districts)}{" "}
            дүүрэг
          </p>
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type SortKey =
  "no" | "place" | "district" | "salt" | "spring" | "autumn" | "km";

function compare(x: BiotechSite, y: BiotechSite, by: SortKey): number {
  switch (by) {
    case "place":
      return x.place.localeCompare(y.place);
    case "district":
      return x.district.localeCompare(y.district);
    case "salt":
      return (x.salt ?? -1) - (y.salt ?? -1);
    case "spring":
      return (x.haySpring ?? -1) - (y.haySpring ?? -1);
    case "autumn":
      return (x.hayAutumn ?? -1) - (y.hayAutumn ?? -1);
    case "km":
      return (x.km ?? -1) - (y.km ?? -1);
    default:
      return x.no - y.no;
  }
}

function Th({
  col,
  sort,
  onSort,
  children,
  className,
  num: isNum,
}: {
  col: SortKey;
  sort: { by: SortKey; desc: boolean };
  onSort: (s: { by: SortKey; desc: boolean }) => void;
  children: React.ReactNode;
  className?: string;
  num?: boolean;
}) {
  const on = sort.by === col;
  return (
    <th className={cn("px-3 py-2 font-normal", className)}>
      <button
        onClick={() => onSort({ by: col, desc: on ? !sort.desc : true })}
        className={cn(
          "eyebrow flex w-full items-center gap-1 transition-colors hover:text-ink-2",
          isNum && "justify-end",
          on && "text-ink",
        )}
      >
        {children}
        {on ? (
          sort.desc ? (
            <ChevronDown size={11} className="shrink-0" />
          ) : (
            <ChevronUp size={11} className="shrink-0" />
          )
        ) : null}
      </button>
    </th>
  );
}

/**
 * Тоон нүд — утга ба түүний ХАРЬЦАА.
 *
 * Нүдний доод ирмэгт 2px-ийн хэмжигчийн зураас татна: багана дотор
 * аль байршил их, аль нь бага болох нь тоо уншилгүйгээр харагдана.
 * Дүүргэлт хэрэглэхгүй — химийн товьёогтой нэг зарчим: 14 мөрийн
 * дүүргэлт нийлээд хүснэгт биш диаграм мэт уншигдана.
 */
function Cell({ value, peak }: { value: number | null; peak: number }) {
  if (value == null) {
    return <td className="px-3 py-2 text-right text-ink-3">—</td>;
  }
  return (
    <td className="relative px-3 py-2 text-right">
      <span className="num text-ink">{num(value)}</span>
      <span
        aria-hidden
        className="absolute bottom-[3px] left-3 h-[2px] bg-data/45"
        style={{
          width: `calc((100% - 1.5rem) * ${Math.min(1, value / peak)})`,
        }}
      />
    </td>
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
      <span className="eyebrow block">{label}</span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}

/**
 * Товшилтын цонхны мөр.
 *
 * Хоосон утга ОГТ гарахгүй — "Тодорхойгүй" гэсэн мөрүүд цонхыг
 * дүүргэхээс өөр юу ч хэлэхгүй.
 */
function PopField({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-[74px] shrink-0 text-[10px] tracking-[0.06em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-2">{v}</dd>
    </div>
  );
}
