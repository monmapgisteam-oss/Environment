"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, Microscope, X } from "lucide-react";
import type { Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { categoryHex } from "@/components/wells/colors";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { MapLegend } from "@/components/wildlife/map-legend";
import { SheetBars, SheetSection, SheetStats, catMeta } from "@/components/wildlife/sheet";
import { Bounds } from "@/lib/extent";
import { fetchRangerRecords, type RangerKind, type RangerRecord } from "@/lib/nogoon-survey";
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

/*
  Байгаль хамгаалагчийн аппликейшны (Survey123) бүртгэл — ногоон бүсийн гурван
  цэс: "Судалгаа", "Модны тооллого", "Хог" ({@link src/lib/nogoon-survey.ts}).

  Бүтэц нь ногоон бүсийн бусад цэсний хуудастай нэг хэв: зүүнд зураг (цэг нь
  төрлөөр өнгөтэй), баруунд Тойм → төрлөөр → дүүргээр → үзүүлэлтээр →
  жагсаалт. Мөр, цэг дарахад шүүнэ; сонгосон бүртгэлийн цонхонд маягтын
  тухайн хэсгийн бүх талбар (хоосон нь "—") ба ҮЗҮҮЛЭЛТ (нэр · утга · нэгж).
  ⚠ Ганц төрөлтэй цэсэд (Модны тооллого) төрлийн хэсэг, өнгөний тайлбар гарахгүй.
*/

const TEXT: Record<
  RangerKind,
  {
    title: string;
    noun: string;
    type: string;
    byType: string;
    measure: string;
    measured: string;
    list: string;
    unit: string;
  }
> = {
  sudalgaa: {
    title: "Судалгаа",
    noun: "Судалгаа",
    type: "Судалгааны төрөл",
    byType: "Судалгааны төрлөөр",
    measure: "Судалгааны тоо",
    measured: "Хэмжсэн судалгааны тоо",
    list: "Судалгааны жагсаалт",
    unit: "судалгаа",
  },
  mod: {
    title: "Модны тооллого",
    noun: "Тооллого",
    type: "Төрөл",
    byType: "Төрлөөр",
    measure: "Тооллогын тоо",
    measured: "Хэмжсэн тооллогын тоо",
    list: "Тооллогын жагсаалт",
    unit: "тооллого",
  },
  hog: {
    title: "Хог",
    noun: "Бүртгэл",
    type: "Хогны төрөл",
    byType: "Хогны төрлөөр",
    measure: "Бүртгэлийн тоо",
    measured: "Хэмжсэн бүртгэлийн тоо",
    list: "Бүртгэлийн жагсаалт",
    unit: "бүртгэл",
  },
};

type Axis = "type" | "district";

function keyOf(r: RangerRecord, axis: Axis): string {
  return axis === "type" ? r.type : r.district || "Бүртгэгдээгүй";
}

function dateText(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

export function RangerDashboard({ kind }: { kind: RangerKind }) {
  const t = TEXT[kind];
  const [rows, setRows] = React.useState<RangerRecord[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [type, setType] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  React.useEffect(() => {
    const ac = new AbortController();
    fetchRangerRecords(kind, ac.signal)
      .then(setRows)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, [kind]);

  /* Шүүлт — тэнхлэг бүр өөрийгөө алгасна (өөр утга руу шилжих зам) */
  const passes = React.useCallback(
    (r: RangerRecord, skip?: Axis) =>
      (skip === "type" || !type || r.type === type) &&
      (skip === "district" || !district || keyOf(r, "district") === district),
    [type, district],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((r) => passes(r)), [rows, passes]);

  /* Сонголт шүүлтэд үлдээгүй бол хүчингүй (дам гарна) */
  const sel = React.useMemo(
    () => (picked != null && shown.some((r) => r.oid === picked) ? picked : null),
    [shown, picked],
  );
  const detail = React.useMemo(
    () => (sel == null ? null : (rows ?? []).find((r) => r.oid === sel) ?? null),
    [rows, sel],
  );
  const scope = React.useMemo(
    () => (detail ? [detail] : shown),
    [detail, shown],
  );

  const tally = React.useCallback(
    (axis: Axis, withSel = true): Datum[] => {
      const counts = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!passes(r, axis)) continue;
        if (withSel && sel != null && r.oid !== sel) continue;
        const k = keyOf(r, axis);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, value]) => ({ key, label: key, value }));
    },
    [rows, passes, sel],
  );

  const byType = React.useMemo(() => tally("type"), [tally]);
  const byDistrict = React.useMemo(() => tally("district"), [tally]);
  const menuType = React.useMemo(() => tally("type", false), [tally]);
  const menuDistrict = React.useMemo(() => tally("district", false), [tally]);

  /* Үзүүлэлтийн нэр бүр хэдэн судалгаанд хэмжигдсэн бэ */
  const byIndicator = React.useMemo<Datum[]>(() => {
    const counts = new Map<string, number>();
    for (const r of scope)
      for (const n of new Set(r.indicators.map((i) => i.name)))
        counts.set(n, (counts.get(n) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, value]) => ({ key, label: key, value }));
  }, [scope]);

  /* Төрлийн өнгө — шүүгдээгүй тооллоор (шүүлтэд солигдохгүй) */
  const typeColor = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows ?? []) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    return new Map(
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([k], i) => [k, categoryHex(k, i)] as const),
    );
  }, [rows]);

  /* Байршилтай бүртгэл л зурагт */
  const located = React.useMemo(
    () => (rows ?? []).filter((r) => r.lon != null && r.lat != null),
    [rows],
  );
  const points = React.useMemo(
    () => ({
      oid: located.map((r) => r.oid),
      lon: located.map((r) => r.lon as number),
      lat: located.map((r) => r.lat as number),
    }),
    [located],
  );
  const visible = React.useMemo(() => {
    const keep = new Set(shown.map((r) => r.oid));
    const out: number[] = [];
    located.forEach((r, i) => {
      if (keep.has(r.oid)) out.push(i);
    });
    return Uint32Array.from(out);
  }, [located, shown]);
  const colors = React.useMemo(
    () => located.map((r) => typeColor.get(r.type)),
    [located, typeColor],
  );
  const labels = React.useMemo(
    () => ({ text: located.map((r) => r.name || r.type), minzoom: 13 }),
    [located],
  );

  const focus = React.useMemo<Extent | null>(() => {
    const b = new Bounds();
    if (detail) {
      if (detail.lon == null || detail.lat == null) return null;
      b.add(detail.lon, detail.lat);
      return b.get();
    }
    if (!(type || district)) return null;
    let any = false;
    for (const r of shown)
      if (r.lon != null && r.lat != null) {
        b.add(r.lon, r.lat);
        any = true;
      }
    return any ? b.get() : null;
  }, [detail, type, district, shown]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <p className="max-w-[420px] px-6 text-center text-[12.5px] leading-relaxed text-clay">{error}</p>
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <Loader2 size={16} className="animate-spin text-ink-3" />
      </div>
    );
  }

  /* Ганц төрөлтэй цэс — төрлийн хэсэг, тайлбар, шүүлт утгагүй */
  const typed = typeColor.size > 1;
  const indicatorTotal = scope.reduce((s, r) => s + r.indicators.length, 0);
  const activeCount = (type ? 1 : 0) + (district ? 1 : 0) + (sel != null ? 1 : 0);
  const listed = shown
    .slice()
    .sort((a, b) => (b.date ?? 0) - (a.date ?? 0) || b.oid - a.oid);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title={t.title}
        activeCount={activeCount}
        onReset={() => {
          setType(null);
          setDistrict(null);
          setPicked(null);
        }}
      >
        {typed ? (
          <FilterMenu
            label={t.type}
            icon={Microscope}
            value={type}
            active={Boolean(type)}
            onClear={() => setType(null)}
            width={250}
          >
            <PickList items={menuType} selected={type} onPick={setType} />
          </FilterMenu>
        ) : null}
        <FilterMenu
          label="Дүүрэг"
          icon={MapPin}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={230}
        >
          <PickList items={menuDistrict} selected={district} onPick={setDistrict} />
        </FilterMenu>
      </FilterBar>

      {rows.length === 0 ? (
        <div className="hatch flex flex-1 items-center justify-center rounded-xs border border-dashed border-line-2">
          <p className="text-[12.5px] text-ink-3">Мэдээлэл хүлээгдэж байна</p>
        </div>
      ) : (
        <Columns layout="flex" id={`nogoon-ranger-${kind}`} right={360} className="min-h-0 flex-1">
          <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-xs border border-line bg-paper-2">
            <div className="relative h-full w-full">
              <PointMap
                points={points}
                visible={visible}
                labels={labels}
                cluster={false}
                colors={colors}
                esriFirefly
                highlight={
                  detail && detail.lon != null && detail.lat != null
                    ? [detail.lon, detail.lat]
                    : null
                }
                basemap={basemap}
                onSelect={(oid) => setPicked(sel === oid ? null : oid)}
                focus={focus}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />
              <MapLegend
                groups={[
                  {
                    key: "type",
                    title: t.title,
                    field: typed ? t.type : undefined,
                    items: [...typeColor].map(([k, c]) => ({ key: k, label: k, color: c })),
                  },
                ]}
              />
              {detail ? (
                <Detail
                  record={detail}
                  typeLabel={typed ? t.type : null}
                  indicators={kind !== "hog"}
                  color={typeColor.get(detail.type)}
                  onClose={() => setPicked(null)}
                />
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto xl:w-(--col-r) xl:shrink-0">
            <SheetStats
              stats={[
                { label: t.noun, value: scope.length },
                ...(typed ? [{ label: t.type, value: new Set(scope.map((r) => r.type)).size }] : []),
                ...(indicatorTotal ? [{ label: "Үзүүлэлт", value: indicatorTotal }] : []),
                {
                  label: "Дүүрэг",
                  value: new Set(scope.map((r) => r.district).filter(Boolean)).size,
                },
              ]}
            />
            {typed ? (
              <SheetSection title={t.byType} meta={catMeta(byType.length)}>
                <SheetBars
                  data={byType}
                  measure={t.measure}
                  colorOf={(d) => typeColor.get(d.key)}
                  selected={type}
                  onSelect={setType}
                />
              </SheetSection>
            ) : null}
            <SheetSection title="Дүүргээр" meta={catMeta(byDistrict.length)}>
              <SheetBars data={byDistrict} measure={t.measure} selected={district} onSelect={setDistrict} />
            </SheetSection>
            {byIndicator.length ? (
              <SheetSection title="Үзүүлэлтээр" meta={catMeta(byIndicator.length)}>
                <SheetBars data={byIndicator} measure={t.measured} />
              </SheetSection>
            ) : null}
            <SheetSection title={t.list} meta={`${num(listed.length)} ${t.unit}`}>
              <ul className="divide-y divide-line">
                {listed.map((r) => {
                  const on = sel === r.oid;
                  return (
                    <li key={r.oid}>
                      <button
                        type="button"
                        onClick={() => setPicked(on ? null : r.oid)}
                        aria-pressed={on}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-xs px-1.5 py-1.5 text-left hover:bg-paper-hi",
                          on && "bg-paper-hi",
                        )}
                      >
                        <span
                          aria-hidden
                          className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                          style={{ background: typeColor.get(r.type) }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-ink" title={r.name || r.type}>
                            {r.name || r.type}
                          </span>
                          <span className="block truncate text-[10.5px] text-ink-3">
                            {[typed ? r.type : "", r.district, dateText(r.date)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SheetSection>
          </div>
        </Columns>
      )}
    </div>
  );
}

function Detail({
  record: r,
  typeLabel,
  indicators,
  color,
  onClose,
}: {
  record: RangerRecord;
  typeLabel: string | null;
  /** Үзүүлэлтийн хэсэг — Хогны маягтад үзүүлэлт байдаггүй */
  indicators: boolean;
  color?: string;
  onClose: () => void;
}) {
  const facts: [string, string][] = [
    ...(typeLabel ? [[typeLabel, r.type] as [string, string]] : []),
    ["Огноо", dateText(r.date)],
    ["Дүүрэг", r.district],
    ["Хороо", r.khoroo],
    ...r.facts,
  ];
  return (
    <div className="elevated absolute right-2.5 bottom-8 z-10 flex max-h-[calc(100%-2.5rem)] w-[320px] flex-col rounded-xs border border-line-2 bg-paper/95 backdrop-blur-md">
      <div className="flex items-start gap-2 border-b border-line px-3 py-2">
        <span aria-hidden className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1 text-[12.5px] leading-snug font-medium text-ink">
          {r.name || r.type}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Хаах"
          className="shrink-0 rounded-xs p-0.5 text-ink-3 hover:bg-paper-hi hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <dl className="space-y-1">
          {facts.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[11.5px]">
              <dt className="w-[44%] shrink-0 text-ink-3">{k}</dt>
              <dd className={cn("min-w-0 flex-1 leading-snug", v ? "text-ink" : "text-ink-3")}>{v || "—"}</dd>
            </div>
          ))}
        </dl>
        {!indicators && !r.indicators.length ? null : (
          <p className="eyebrow mt-3 mb-1">Үзүүлэлт</p>
        )}
        {!indicators && !r.indicators.length ? null : r.indicators.length ? (
          <table className="w-full text-[11.5px]">
            <tbody className="divide-y divide-line">
              {r.indicators.map((i, k) => (
                <tr key={k}>
                  <td className="py-1 pr-2 align-top text-ink-2">{i.name}</td>
                  <td className="num py-1 text-right align-top font-medium text-ink">{i.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[11.5px] text-ink-3">Үзүүлэлт бүртгэгдээгүй байна</p>
        )}
      </div>
    </div>
  );
}
