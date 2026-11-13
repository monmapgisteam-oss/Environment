"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { Camera, ChevronRight, FileText, Loader2, X } from "lucide-react";
import type { Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { categoryHex } from "@/components/wells/colors";
import { FilterBar, type FilterChip } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { MapLegend } from "@/components/wildlife/map-legend";
import { SheetSection, SheetStats, catMeta } from "@/components/wildlife/sheet";
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

/** Зургийн цомогт эхэндээ харуулах тоо — үлдсэн нь "Бүгдийг харах" */
const GALLERY_ROWS = 8;

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
  /** Бөглөгдсөн бүртгэлийн тоо */
  n: number;
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

  /*
    ЦОНХНЫ ТАЛБАР БҮР ДИАГРАМ (хэрэглэгч 2026-11-13: "pop up deer bga buh medeelel
    chartaar haragdana"), маягтын дарааллаар:
    · бичвэр, сонголт — утгаар тоолно, мөр дарахад шүүнэ (өөрийгөө алгасна);
    · нэгжтэй тоо (хогны хэмжээ) — нэгж бүрээр нийлбэр (тн · кг · га … холихгүй);
    · нэгжгүй тоо (торгуулийн дүн) — бүртгэл тус бүрээр, толгойд нийт; мөр дарахад сонгоно.
  */
  const factCharts = React.useMemo<FactChart[]>(() => {
    const all = rows ?? [];
    const first = all[0]?.facts ?? [];
    const numeric = (key: string) => all.some((r) => factOf(r, key)?.num != null);
    /* Чөлөөт бичвэр (тайлбар, арга хэмжээ, цаг …) диаграм БОЛОХГҮЙ — утга нь бараг
       давтагддаггүй тул мөр бүр 1 гэсэн жагсаалт болно; цонхонд хэвээр.
       Тийм/үгүй талбарууд нэг нэгдсэн картад ({@link yesNoRows}). */
    const keys = first.filter((f) => numeric(f.key) || (f.choice && !f.yesNo));
    return keys.map(({ key, label }) => {
      const pool = all.filter((r) => passes(r, key) && (sel == null || r.oid === sel));
      if (numeric(key)) {
        const vals = pool
          .map((r) => ({ r, f: factOf(r, key) }))
          .filter((x): x is { r: RangerRecord; f: NonNullable<typeof x.f> } => x.f?.num != null);
        if (vals.some((x) => x.f.unit)) {
          const sums = new Map<string, number>();
          for (const { f } of vals) sums.set(f.unit || "Нэгжгүй", (sums.get(f.unit || "Нэгжгүй") ?? 0) + f.num!);
          return { key, title: label, kind: "unit", data: countData(sums), measure: "Нийлбэр, нэгжээр", meta: `${num(vals.length)} ${t.unit}`, n: vals.length };
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
          n: vals.length,
        };
      }
      const counts = new Map<string, number>();
      for (const r of pool) {
        const b = bucketOf(factOf(r, key)?.value ?? "");
        counts.set(b, (counts.get(b) ?? 0) + 1);
      }
      const data = countData(counts);
      return { key, title: label, kind: "count", data, measure: "", meta: catMeta(data.length), n: pool.length };
    });
  }, [rows, passes, sel, t]);

  /* ТИЙМ / ҮГҮЙ талбарууд НЭГ картад — мөр бүр хуваагдсан зурвас (тусдаа карт
     бүрд хоёр мөр байсан нь баганыг нүсэр болгож байв; хэрэглэгч мөн өдөр:
     "chartuudiig tsegtsley het nurshuu ih bn") */
  const yesNoRows = React.useMemo(() => {
    const all = rows ?? [];
    return (all[0]?.facts ?? [])
      .filter((f) => f.yesNo)
      .map(({ key, label }) => {
        const counts: Record<string, number> = {};
        for (const r of all) {
          if (!passes(r, key) || (sel != null && r.oid !== sel)) continue;
          const b = bucketOf(factOf(r, key)?.value ?? "");
          counts[b] = (counts[b] ?? 0) + 1;
        }
        return { key, label, counts };
      });
  }, [rows, passes, sel]);

  /* ҮЗҮҮЛЭЛТ НЭГ ХҮСНЭГТЭД — мөр бүр нэг үзүүлэлт: судалгааны тоо, утга (тоон бол
     муж, эс бөгөөс давамгай утга); мөр дарахад судалгаа тус бүрийн утга задарна */
  const indicatorRows = React.useMemo(() => {
    const by = new Map<string, { r: RangerRecord; value: string }[]>();
    for (const r of scope)
      for (const i of r.indicators) by.set(i.name, [...(by.get(i.name) ?? []), { r, value: i.value }]);
    return [...by]
      .map(([name, list]) => {
        const parsed = list.map((x) => numberOf(x.value));
        let summary: string;
        if (parsed.every(Boolean)) {
          const ns = parsed.map((q) => q!.n);
          const units = [...new Set(parsed.map((q) => q!.unit).filter(Boolean))];
          const lo = Math.min(...ns);
          const hi = Math.max(...ns);
          const fmt = (v: number) => num(v, Number.isInteger(v) ? 0 : 1);
          summary = `${lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`}${units.length === 1 ? ` ${units[0]}` : ""}`;
        } else {
          const counts = new Map<string, number>();
          for (const x of list) counts.set(x.value, (counts.get(x.value) ?? 0) + 1);
          const [top] = countData(counts);
          summary = counts.size > 1 ? `${top.label} +${counts.size - 1}` : top.label;
        }
        return { name, list, summary };
      })
      .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name));
  }, [scope]);
  const [openRow, setOpenRow] = React.useState<string | null>(null);
  const [allPhotos, setAllPhotos] = React.useState(false);

  /* Бүх бүртгэлийн хавсралт зураг (хэрэглэгч мөн өдөр: "Zurag bas") */
  const gallery = React.useMemo(
    () => scope.flatMap((r) => r.attachments.filter((a) => a.image).map((a) => ({ r, a }))),
    [scope],
  );

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

  /* Тоолол → хүснэгтийн мөр */
  const countRow = (
    id: string,
    label: string,
    data: Datum[],
    selected: string | null,
    onPick: (v: string | null) => void,
    colorOf?: (k: string) => string | undefined,
  ): SumRow => {
    const filled = data.filter((d) => d.key !== "Бүртгэгдээгүй");
    return {
      id,
      label,
      /* Эхний хоёр утга тоотойгоо ("Тийм 2 · Үгүй 2"), үлдсэн нь "+N" */
      summary: filled.length
        ? filled
            .slice(0, 2)
            .map((d) => `${d.label} ${num(d.value)}`)
            .join(" · ") + (filled.length > 2 ? ` +${filled.length - 2}` : "")
        : "—",
      n: filled.reduce((sum, d) => sum + d.value, 0),
      values: data.map((d) => ({ key: d.key, label: d.label, text: num(d.value), color: colorOf?.(d.key) })),
      selected,
      onPick,
    };
  };
  const summary: SumRow[] = [
    ...(typed ? [countRow("type", t.type, byType, type, setType, (k) => typeColor.get(k))] : []),
    countRow("district", "Дүүрэг", byDistrict, district, setDistrict),
    ...factCharts.map((c): SumRow => {
      if (c.kind === "count") return countRow(c.key, c.title, c.data, factPick[c.key] ?? null, (v) => pickFact(c.key, v));
      if (c.kind === "unit")
        return {
          id: c.key,
          label: c.title,
          summary: c.data.map((d) => `${num(d.value, Number.isInteger(d.value) ? 0 : 1)} ${d.label}`).join(" · ") || "—",
          n: c.n,
          values: c.data.map((d) => ({ key: d.key, label: d.label, text: num(d.value, Number.isInteger(d.value) ? 0 : 1) })),
          selected: null,
        };
      return {
        id: c.key,
        label: c.title,
        summary: c.n ? c.meta : "—",
        n: c.n,
        values: c.data.map((d) => ({ key: d.key, label: d.label, text: num(d.value, Number.isInteger(d.value) ? 0 : 2) })),
        selected: sel != null ? String(sel) : null,
        onPick: (v) => setPicked(v == null ? null : Number(v)),
      };
    }),
    ...yesNoRows.map((y) =>
      countRow(
        y.key,
        y.label,
        countData(new Map(Object.entries(y.counts))),
        factPick[y.key] ?? null,
        (v) => pickFact(y.key, v),
      ),
    ),
    ...indicatorRows.map(
      (row): SumRow => ({
        id: `uz:${row.name}`,
        label: row.name,
        group: "Үзүүлэлт",
        summary: row.summary,
        n: row.list.length,
        values: row.list.map((x) => ({
          key: String(x.r.oid),
          label: [x.r.name, x.r.district].filter(Boolean).join(" · "),
          text: x.value,
        })),
        selected: sel != null ? String(sel) : null,
        onPick: (v) => setPicked(v == null ? null : Number(v)),
      }),
    ),
  ];
  const indicatorTotal = scope.reduce((s, r) => s + r.indicators.length, 0);
  const pickFact = (key: string, v: string | null) =>
    setFactPick((p) => {
      const next = { ...p };
      if (v == null) delete next[key];
      else next[key] = v;
      return next;
    });
  const resetAll = () => {
    setType(null);
    setDistrict(null);
    setFactPick({});
    setPicked(null);
  };
  const factLabel = (key: string) => rows[0]?.facts.find((f) => f.key === key)?.label ?? key;
  const chips: FilterChip[] = [
    ...(type ? [{ key: "type", label: t.type, value: type, onRemove: () => setType(null) }] : []),
    ...(district ? [{ key: "district", label: "Дүүрэг", value: district, onRemove: () => setDistrict(null) }] : []),
    ...Object.entries(factPick).map(([k, v]) => ({
      key: `f:${k}`,
      label: factLabel(k),
      value: v,
      onRemove: () => pickFact(k, null),
    })),
    ...(detail
      ? [{ key: "sel", label: "Сонгосон", value: detail.name, onRemove: () => setPicked(null) }]
      : []),
  ];
  const listed = shown
    .slice()
    .sort((a, b) => (b.date ?? 0) - (a.date ?? 0) || b.oid - a.oid);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/*
        ШҮҮЛТ ЭНГИЙН (хэрэглэгч 2026-11-13: "chart filteruud engiin oilgomjtoi ajildag
        bolgooroi"): шүүлт ЗӨВХӨН диаграмаас (мөр, хэсэг дарахад тавигдаж, дахин дарахад
        авагдана); мөрөнд шүүлт бүр нэрээрээ "Хогны төрөл: Бохир ✕". Диаграмтай давхардсан
        унждаг цэс (төрөл, дүүрэг) хасагдсан.
      */}
      <FilterBar title={t.title} activeCount={chips.length} onReset={resetAll} chips={chips}>
        {null}
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
            {/*
              НЭГ ТОВЧ ХҮСНЭГТ (хэрэглэгч 2026-11-13: "chartuud neg l oilgomjgui bndaa" →
              гурван хувилбараас "Нэг товч хүснэгт"). Мөр бүр нэг талбар: нэр · давамгай
              утга · бөглөгдсөн бүртгэлийн тоо; мөр дарахад бүх утга задарна, утга дарахад
              шүүнэ (дахин дарахад авагдана). Хэмжээ нэгжээр, дүн бүртгэл тус бүрээр.
            */}
            <SheetSection title="Товч мэдээлэл" meta={`${num(summary.length)} талбар`}>
              <SummaryTable
                rows={summary}
                open={openRow}
                onOpen={setOpenRow}
                noun={t.noun}
              />
            </SheetSection>
            {gallery.length ? (
              <SheetSection title="Зураг" meta={`${num(gallery.length)} зураг`}>
                <div className="grid grid-cols-4 gap-1.5">
                  {(allPhotos ? gallery : gallery.slice(0, GALLERY_ROWS)).map(({ r, a }) => (
                    <div key={`${r.oid}/${a.id}`} className="min-w-0" title={r.name}>
                      <Thumb oid={r.oid} a={a} onView={setViewing} />
                    </div>
                  ))}
                </div>
                {gallery.length > GALLERY_ROWS ? (
                  <button
                    type="button"
                    onClick={() => setAllPhotos((v) => !v)}
                    className="mt-1 px-1.5 text-[11px] text-ink-3 hover:text-ink"
                  >
                    {allPhotos ? "Хураах" : `Бүгдийг харах · ${num(gallery.length)}`}
                  </button>
                ) : null}
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

type SumValue = { key: string; label: string; text: string; color?: string };
type SumRow = {
  id: string;
  label: string;
  /** Бүлгийн гарчиг — эхний мөрийн өмнө нэг удаа ("Үзүүлэлт") */
  group?: string;
  /** Давамгай утга, хэмжээний нийлбэр эсвэл муж */
  summary: string;
  /** Бөглөгдсөн бүртгэлийн тоо */
  n: number;
  values: SumValue[];
  selected: string | null;
  /** Утга дарахад — тоололд шүүлт, бүртгэл тус бүрийн утгад сонголт */
  onPick?: (key: string | null) => void;
};

/** Товч мэдээллийн хүснэгт — нэг мөр нэг талбар, дарахад задарна */
function SummaryTable({
  rows,
  open,
  onOpen,
  noun,
}: {
  rows: SumRow[];
  open: string | null;
  onOpen: (id: string | null) => void;
  noun: string;
}) {
  /* Нэр хоёр мөр хүртэл бүтэн — тасарсан нэр ("Хогны хэмжээг х…") уншигдахгүй */
  const cols = "grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_2.5rem]";
  return (
    <>
      <div className={cn("mb-1 grid gap-x-3 px-1.5 text-[10.5px] text-ink-3", cols)}>
        <span>Талбар</span>
        <span className="text-right">Давамгай утга</span>
        <span className="text-right">{noun}</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((row, i) => {
          const isOpen = open === row.id;
          const filtered = row.selected != null && row.onPick != null;
          const heading = row.group && row.group !== rows[i - 1]?.group ? row.group : null;
          return (
            <li key={row.id}>
              {heading ? <p className="eyebrow px-1.5 pt-2.5 pb-1">{heading}</p> : null}
              <button
                type="button"
                onClick={() => onOpen(isOpen ? null : row.id)}
                aria-expanded={isOpen}
                className={cn(
                  "grid w-full items-center gap-x-3 rounded-xs px-1.5 py-1.5 text-left text-[12px] hover:bg-paper-hi",
                  cols,
                  isOpen && "bg-paper-hi",
                )}
              >
                <span className="flex min-w-0 items-start gap-1">
                  <ChevronRight
                    size={12}
                    className={cn("mt-[3px] shrink-0 text-ink-3 transition-transform", isOpen && "rotate-90")}
                  />
                  <span
                    className={cn("line-clamp-2 leading-snug", filtered ? "font-medium text-data" : "text-ink")}
                    title={row.label}
                  >
                    {row.label}
                  </span>
                </span>
                <span className="num line-clamp-2 text-right leading-snug font-semibold text-ink" title={row.summary}>
                  {row.summary}
                </span>
                <span className="num text-right text-ink-3">{num(row.n)}</span>
              </button>
              {isOpen ? (
                <ul className="mb-1.5 ml-4 border-l border-line pl-2">
                  {row.values.map((v) => {
                    const on = row.selected === v.key;
                    const Tag = row.onPick ? "button" : "div";
                    return (
                      <li key={v.key}>
                        <Tag
                          {...(row.onPick
                            ? {
                                type: "button" as const,
                                onClick: () => row.onPick!(on ? null : v.key),
                                "aria-pressed": on,
                              }
                            : {})}
                          className={cn(
                            "flex w-full items-baseline gap-2 rounded-xs px-1 py-0.5 text-left text-[11.5px]",
                            row.onPick && "hover:bg-paper-hi",
                            on && "bg-data/10",
                            row.selected != null && row.onPick && !on && "opacity-50",
                          )}
                        >
                          {v.color ? (
                            <span aria-hidden className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: v.color }} />
                          ) : null}
                          <span className={cn("min-w-0 flex-1 truncate", on ? "font-medium text-ink" : "text-ink-2")} title={v.label}>
                            {v.label}
                          </span>
                          <span className="num shrink-0 font-medium text-ink">{v.text}</span>
                        </Tag>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
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
