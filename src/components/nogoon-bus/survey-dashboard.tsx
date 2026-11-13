"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { Camera, FileText, Loader2, MapPin, Microscope, X } from "lucide-react";
import type { Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { categoryHex } from "@/components/wells/colors";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { MapLegend } from "@/components/wildlife/map-legend";
import { SheetBars, SheetSection, SheetStats, catMeta } from "@/components/wildlife/sheet";
import { Bounds } from "@/lib/extent";
import { arcgisBlobUrl } from "@/lib/arcgis";
import {
  attachmentUrl,
  fetchRangerRecords,
  type RangerAttachment,
  type RangerKind,
  type RangerRecord,
} from "@/lib/nogoon-survey";
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

/**
 * Талбарын утгын ангилал — диаграм, шүүлт хоёр НЭГ дүрмээр. Цаг ("11:54") нь
 * цагаараа бүлэглэнэ ("11 цаг"), хоосон нь "Бүртгэгдээгүй".
 */
function bucketOf(value: string): string {
  const hm = /^(\d{1,2}):\d{2}$/.exec(value);
  if (hm) return `${Number(hm[1])} цаг`;
  return value || "Бүртгэгдээгүй";
}

function factOf(r: RangerRecord, key: string) {
  return r.facts.find((f) => f.key === key);
}

/** Үзүүлэлтийн утгын тоо ба нэгж ("25 мг/кг" → 25, "мг/кг") */
function numberOf(value: string): { n: number; unit: string } | null {
  const m = /^(-?\d+(?:[.,]\d+)?)\s*(.*)$/.exec(value.trim());
  if (!m || /^\d{4}[.-]\d{2}/.test(value)) return null;
  return { n: Number(m[1].replace(",", ".")), unit: m[2].trim() };
}

const countData = (counts: Map<string, number>): Datum[] =>
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ key, label: key, value }));

/** Талбарын диаграм — тоололт (шүүнэ), нэгжээр нийлбэр, бүртгэл тус бүрээр (сонгоно) */
type FactChart = {
  key: string;
  title: string;
  kind: "count" | "unit" | "record";
  data: Datum[];
  measure: string;
  meta: string;
};

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
  /* Цонхны талбар бүрийн шүүлт (талбар → утгын ангилал) */
  const [factPick, setFactPick] = React.useState<Record<string, string>>({});
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());
  /* Томруулж харж буй зураг */
  const [viewing, setViewing] = React.useState<{ url: string; name: string } | null>(null);

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
    (r: RangerRecord, skip?: string) =>
      (skip === "type" || !type || r.type === type) &&
      (skip === "district" || !district || keyOf(r, "district") === district) &&
      Object.entries(factPick).every(
        ([k, v]) => k === skip || bucketOf(factOf(r, k)?.value ?? "") === v,
      ),
    [type, district, factPick],
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

  /*
    ЦОНХНЫ ТАЛБАР БҮР ДИАГРАМ (хэрэглэгч 2026-11-13: "pop up deer bga buh medeelel
    chartaar haragdana"), маягтын дарааллаар:
    · бичвэр, сонголт — утгаар тоолно, мөр дарахад шүүнэ (өөрийгөө алгасна);
    · нэгжтэй тоо (хогны хэмжээ) — нэгж бүрээр нийлбэр (тн · кг · га … холихгүй);
    · нэгжгүй тоо (торгуулийн дүн) — бүртгэл тус бүрээр, толгойд нийт; мөр дарахад сонгоно.
  */
  const factCharts = React.useMemo<FactChart[]>(() => {
    const all = rows ?? [];
    const keys = all[0]?.facts.map((f) => ({ key: f.key, label: f.label })) ?? [];
    return keys.map(({ key, label }) => {
      const pool = all.filter((r) => passes(r, key) && (sel == null || r.oid === sel));
      const numeric = all.some((r) => factOf(r, key)?.num != null);
      if (numeric) {
        const vals = pool
          .map((r) => ({ r, f: factOf(r, key) }))
          .filter((x): x is { r: RangerRecord; f: NonNullable<typeof x.f> } => x.f?.num != null);
        if (vals.some((x) => x.f.unit)) {
          const sums = new Map<string, number>();
          for (const { f } of vals) sums.set(f.unit || "Нэгжгүй", (sums.get(f.unit || "Нэгжгүй") ?? 0) + f.num!);
          return { key, title: label, kind: "unit", data: countData(sums), measure: "Нийлбэр, нэгжээр", meta: `${num(vals.length)} ${t.unit}` };
        }
        const total = vals.reduce((s, x) => s + x.f.num!, 0);
        return {
          key,
          title: label,
          kind: "record",
          data: vals
            .sort((a, b) => b.f.num! - a.f.num!)
            .map(({ r, f }) => ({ key: String(r.oid), label: [r.name, r.district].filter(Boolean).join(" · "), value: f.num! })),
          measure: "Бүртгэл тус бүрээр",
          meta: `Нийт ${num(total, Number.isInteger(total) ? 0 : 2)}`,
        };
      }
      const counts = new Map<string, number>();
      for (const r of pool) {
        const b = bucketOf(factOf(r, key)?.value ?? "");
        counts.set(b, (counts.get(b) ?? 0) + 1);
      }
      const data = countData(counts);
      return { key, title: label, kind: "count", data, measure: t.measure, meta: catMeta(data.length) };
    });
  }, [rows, passes, sel, t]);

  /* Үзүүлэлт тус бүр — тоон бол бүртгэл тус бүрийн утга, эс бөгөөс утгаар тоолол */
  const indicatorCharts = React.useMemo(() => {
    const by = new Map<string, { r: RangerRecord; value: string }[]>();
    for (const r of scope)
      for (const i of r.indicators) by.set(i.name, [...(by.get(i.name) ?? []), { r, value: i.value }]);
    return [...by].map(([name, list]) => {
      const nums = list.map((x) => ({ ...x, p: numberOf(x.value) }));
      if (nums.every((x) => x.p)) {
        const units = [...new Set(nums.map((x) => x.p!.unit).filter(Boolean))];
        return {
          name,
          record: true,
          measure: units.length === 1 ? `Утга, ${units[0]}` : "Утга",
          data: nums
            .sort((a, b) => b.p!.n - a.p!.n)
            .map((x) => ({ key: String(x.r.oid), label: [x.r.name, x.r.district].filter(Boolean).join(" · "), value: x.p!.n })),
        };
      }
      const counts = new Map<string, number>();
      for (const x of list) counts.set(x.value || "Бүртгэгдээгүй", (counts.get(x.value || "Бүртгэгдээгүй") ?? 0) + 1);
      return { name, record: false, measure: t.measure, data: countData(counts) };
    });
  }, [scope, t]);

  /* Бүх бүртгэлийн хавсралт зураг (хэрэглэгч мөн өдөр: "Zurag bas") */
  const gallery = React.useMemo(
    () => scope.flatMap((r) => r.attachments.filter((a) => a.image).map((a) => ({ r, a }))),
    [scope],
  );

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
  /* Шошго ямар ч масштабад (хэрэглэгч 2026-11-13: "map deer label haragdana") —
     бүртгэл цөөн тул зургийг бүрхэхгүй */
  const labels = React.useMemo(
    () => ({ text: located.map((r) => r.name || r.type), minzoom: 0 }),
    [located],
  );

  const focus = React.useMemo<Extent | null>(() => {
    const b = new Bounds();
    if (detail) {
      if (detail.lon == null || detail.lat == null) return null;
      b.add(detail.lon, detail.lat);
      return b.get();
    }
    if (!(type || district || Object.keys(factPick).length)) return null;
    let any = false;
    for (const r of shown)
      if (r.lon != null && r.lat != null) {
        b.add(r.lon, r.lat);
        any = true;
      }
    return any ? b.get() : null;
  }, [detail, type, district, factPick, shown]);

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
  const activeCount =
    (type ? 1 : 0) + (district ? 1 : 0) + Object.keys(factPick).length + (sel != null ? 1 : 0);
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
          setFactPick({});
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
                  onView={setViewing}
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
            {factCharts.map((c) => (
              <SheetSection key={c.key} title={c.title} meta={c.meta}>
                <SheetBars
                  data={c.data}
                  measure={c.measure}
                  selected={
                    c.kind === "count" ? (factPick[c.key] ?? null) : c.kind === "record" && sel != null ? String(sel) : null
                  }
                  onSelect={
                    c.kind === "count"
                      ? (v) =>
                          setFactPick((p) => {
                            const next = { ...p };
                            if (v == null) delete next[c.key];
                            else next[c.key] = v;
                            return next;
                          })
                      : c.kind === "record"
                        ? (v) => setPicked(v == null ? null : Number(v))
                        : undefined
                  }
                />
              </SheetSection>
            ))}
            {byIndicator.length ? (
              <SheetSection title="Үзүүлэлтээр" meta={catMeta(byIndicator.length)}>
                <SheetBars data={byIndicator} measure={t.measured} />
              </SheetSection>
            ) : null}
            {indicatorCharts.map((c) => (
              <SheetSection key={`uz-${c.name}`} title={c.name} meta={c.record ? `${num(c.data.length)} ${t.unit}` : catMeta(c.data.length)}>
                <SheetBars
                  data={c.data}
                  measure={c.measure}
                  selected={c.record && sel != null ? String(sel) : null}
                  onSelect={c.record ? (v) => setPicked(v == null ? null : Number(v)) : undefined}
                />
              </SheetSection>
            ))}
            {gallery.length ? (
              <SheetSection title="Зураг" meta={`${num(gallery.length)} зураг`}>
                <div className="grid grid-cols-3 gap-1.5">
                  {gallery.map(({ r, a }) => (
                    <div key={`${r.oid}/${a.id}`} className="min-w-0">
                      <Thumb oid={r.oid} a={a} onView={setViewing} />
                      <p className="mt-0.5 truncate text-[10px] text-ink-3" title={r.name}>
                        {r.name}
                      </p>
                    </div>
                  ))}
                </div>
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
                        {r.attachments.length ? (
                          <span
                            className="num mt-[2px] flex shrink-0 items-center gap-1 text-[10.5px] text-ink-3"
                            title={`${r.attachments.length} хавсралт`}
                          >
                            <Camera size={12} />
                            {r.attachments.length}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SheetSection>
          </div>
        </Columns>
      )}
      {viewing ? <Viewer {...viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

/* ---- Хавсралт (хэрэглэгч 2026-11-13: "saynii nemsen buh burtgeliin zurguud
   bas haragdah hrgtei") ---- */

/** Татсан хавсралт — нэг удаа, санах ойд */
const blobs = new Map<string, Promise<string>>();

function blobOf(oid: number, a: RangerAttachment): Promise<string> {
  const key = `${oid}/${a.id}`;
  let p = blobs.get(key);
  if (!p) {
    p = arcgisBlobUrl(attachmentUrl(oid, a.id), "Хавсралт", !a.image);
    p.catch(() => blobs.delete(key));
    blobs.set(key, p);
  }
  return p;
}

function Thumb({
  oid,
  a,
  onView,
}: {
  oid: number;
  a: RangerAttachment;
  onView: (v: { url: string; name: string }) => void;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    blobOf(oid, a).then(
      (u) => alive && setUrl(u),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [oid, a]);
  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => url && onView({ url, name: a.label })}
      title={a.name}
      className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xs border border-line bg-paper-3 hover:border-line-2"
    >
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={a.label} className="block h-full w-full object-cover" />
      ) : failed ? (
        <span className="text-[10px] text-ink-3">Татагдсангүй</span>
      ) : (
        <Loader2 size={12} className="animate-spin text-ink-3" />
      )}
    </button>
  );
}

function FileLink({ oid, a }: { oid: number; a: RangerAttachment }) {
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        blobOf(oid, a)
          .then((u) => window.open(u, "_blank", "noopener"))
          .catch(() => setFailed(true))
          .finally(() => setBusy(false));
      }}
      className="flex w-full items-center gap-1.5 rounded-xs border border-line px-2 py-1 text-left text-[11.5px] text-ink hover:bg-paper-hi"
    >
      {busy ? (
        <Loader2 size={12} className="shrink-0 animate-spin" />
      ) : (
        <FileText size={12} className="shrink-0 text-ink-3" />
      )}
      <span className="min-w-0 flex-1 truncate">{a.name}</span>
      {failed ? <span className="shrink-0 text-[10px] text-clay">Татагдсангүй</span> : null}
    </button>
  );
}

/** Маягтын асуултаар бүлэглэнэ: фото зураг · хөрсний шинжилгээний хариу · файл */
function Attachments({
  oid,
  list,
  onView,
}: {
  oid: number;
  list: RangerAttachment[];
  onView: (v: { url: string; name: string }) => void;
}) {
  const groups = new Map<string, RangerAttachment[]>();
  for (const a of list) groups.set(a.label, [...(groups.get(a.label) ?? []), a]);
  return (
    <>
      {[...groups].map(([label, items]) => (
        <div key={label} className="mt-3">
          <p className="eyebrow mb-1">{label}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((a) =>
              a.image ? (
                <Thumb key={a.id} oid={oid} a={a} onView={onView} />
              ) : (
                <div key={a.id} className="col-span-3">
                  <FileLink oid={oid} a={a} />
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </>
  );
}

/** Зургийг томруулж харах — дарах, Esc хаана */
function Viewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  /* ⚠ `document.body` руу — ажлын талбарын эх элемент `fixed`-ийг хавчдаг */
  return createPortal(
    <div
      role="dialog"
      aria-label={name}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} className="max-h-full max-w-full rounded-xs object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Хаах"
        className="absolute top-4 right-4 rounded-xs bg-paper/90 p-1.5 text-ink hover:bg-paper-hi"
      >
        <X size={16} />
      </button>
    </div>,
    document.body,
  );
}

function Detail({
  record: r,
  typeLabel,
  indicators,
  color,
  onClose,
  onView,
}: {
  record: RangerRecord;
  typeLabel: string | null;
  /** Үзүүлэлтийн хэсэг — Хогны маягтад үзүүлэлт байдаггүй */
  indicators: boolean;
  color?: string;
  onClose: () => void;
  onView: (v: { url: string; name: string }) => void;
}) {
  const facts: [string, string][] = [
    ...(typeLabel ? [[typeLabel, r.type] as [string, string]] : []),
    ["Огноо", dateText(r.date)],
    ["Дүүрэг", r.district],
    ["Хороо", r.khoroo],
    ...r.facts.map((f): [string, string] => [f.label, f.value]),
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
        {r.attachments.length ? (
          <Attachments oid={r.oid} list={r.attachments} onView={onView} />
        ) : null}
      </div>
    </div>
  );
}
