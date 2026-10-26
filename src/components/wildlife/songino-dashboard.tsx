"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2, PawPrint, Tag, X } from "lucide-react";
import type { Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent, type MapPoints } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { Bounds } from "@/lib/extent";
import {
  fetchLayerFeatures,
  fetchLayerInfo,
  isSystemField,
  type LayerField,
} from "@/lib/portal-layers";
import { spreadRamp } from "@/lib/tone-ramp";
import { WILDLIFE_SOLO } from "@/lib/wildlife-layers";
import { cn } from "@/lib/utils";
import { SheetBars, SheetSection, SheetStats, catMeta } from "./sheet";
import { MapLegend } from "./map-legend";

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
 * Сонгинохайрхан уулын судалгаа (`A01_zerleg_amitdiin_sudalgaa`, 200 цэг).
 *
 * ⚠⚠ ӨӨРИЙН САМБАР (хэрэглэгч 2026-10-23: бусад амьтны цэс NBAHH-ын
 * хуудас хэлбэрт орсны дараа "энэ засагдаагүй байна"). Урьд нь бүх
 * хэлтсийн хуваалцсан порталын самбараар (`PortalLayers`) зурагддаг байв —
 * NBAHH-ын хуудас горим тэр самбарт ногоон бүсийн worktree-д commit
 * хийгдээгүй байсан тул энэ цэсэнд хүрэх зам байгаагүй. Бүтэц нь хэлтсийн
 * бусад самбартай НЭГ: зүүнд зүйл, голд зураг, баруунд Тойм → задаргаа
 * ({@link ./sheet}).
 *
 * Дата нь порталын хөдөлгүүрээр (`fetchLayerInfo`, `fetchLayerFeatures`) —
 * токен, кэш, латин насны нэрийн буулгалт (`values`) хэвээр.
 * ⚠ Талбарын НЭРИЙГ таамаглаагүй — давхаргын тодорхойлолтоос нэр эсвэл
 * alias-аар нь олно; олдохгүй тэнхлэг гарахгүй.
 * ⚠ "Нас" нь олон утгат нүдтэй ("Насанд хүрсэн, Зулзага") — гишүүн тус
 * бүрээр тоологдоно.
 * ⚠ Порталын самбарын "Шинжилгээ" ба цэсийн нарийвчилсан эрх (`@v`, `@l`)
 * энд БАЙХГҮЙ — табын эрх нь хэлтсийн ажлын талбарт хэвээр.
 */
const SET = WILDLIFE_SOLO.songino;
const LAYER = SET.layers[0];

type Axis = "kind" | "age" | "species" | "type";

/** Тэнхлэг бүрийн талбарыг нэр эсвэл alias-аар олох дүрэм */
const AXES: { id: Axis; title: string; match: RegExp }[] = [
  { id: "kind", title: "Ангилал", match: /^ангилал$/i },
  { id: "age", title: "Нас", match: /^нас$/i },
  { id: "species", title: "Зүйл", match: /^зүйл$/i },
  { id: "type", title: "Бүртгэлийн төрөл", match: /^бүртгэлийн[_ ]төрөл$/i },
];

type Spot = {
  oid: number;
  lon: number;
  lat: number;
  attrs: Record<string, unknown>;
  /** Тэнхлэг бүрийн утга(ууд); хоосон бол "Бүртгэгдээгүй" */
  keys: Record<Axis, string[]>;
};

const BLANK = "Бүртгэгдээгүй";

function text(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

export function SonginoDashboard() {
  const [spots, setSpots] = React.useState<Spot[] | null>(null);
  const [fields, setFields] = React.useState<LayerField[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [pick, setPick] = React.useState<Record<Axis, string | null>>({
    kind: null,
    age: null,
    species: null,
    type: null,
  });
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  React.useEffect(() => {
    const ac = new AbortController();
    (async () => {
      const info = await fetchLayerInfo(SET, LAYER, ac.signal);
      const feats = await fetchLayerFeatures(info, ac.signal);
      const fieldOf = new Map<Axis, string>();
      for (const a of AXES) {
        const f = info.fields.find((x) => a.match.test(x.name) || a.match.test(x.alias));
        if (f) fieldOf.set(a.id, f.name);
      }
      const out: Spot[] = [];
      for (const f of feats.shapes.features) {
        if (f.geometry?.type !== "Point") continue;
        const oid = Number(f.id);
        const attrs = feats.rows[oid] ?? {};
        const [lon, lat] = f.geometry.coordinates as [number, number];
        const keys = {} as Record<Axis, string[]>;
        for (const a of AXES) {
          const name = fieldOf.get(a.id);
          const raw = name ? text(attrs[name]) : "";
          const parts =
            a.id === "age" ? raw.split(/\s*[,;]\s*/).filter(Boolean) : raw ? [raw] : [];
          keys[a.id] = parts.length ? parts : [BLANK];
        }
        out.push({ oid, lon, lat, attrs, keys });
      }
      if (ac.signal.aborted) return;
      setFields(info.fields.filter((x) => !isSystemField(x.name, x.alias)));
      setSpots(out);
    })().catch((e: Error) => {
      if (e.name !== "AbortError") setError(e.message);
    });
    return () => ac.abort();
  }, []);

  /** Шүүлтэд тэнцэх эсэх — `skip` тэнхлэгийг алгасна */
  const passes = React.useCallback(
    (s: Spot, skip?: Axis) =>
      AXES.every((a) => a.id === skip || !pick[a.id] || s.keys[a.id].includes(pick[a.id]!)),
    [pick],
  );

  const shown = React.useMemo(
    () => (spots ?? []).map((s, i) => (passes(s) ? i : -1)).filter((i) => i >= 0),
    [spots, passes],
  );

  /* Зураг дээр сонгосон цэг нь ШҮҮЛТ; шүүлтэд үлдээгүй бол хүчингүй (дам) */
  const sel =
    picked != null && spots && shown.some((i) => spots[i].oid === picked) ? picked : null;

  /** Тэнхлэгийн тоолол — өөрийгөө алгасна; цэс нь сонголтоор хумигдахгүй */
  const tally = React.useCallback(
    (axis: Axis, withSel: boolean): Datum[] => {
      const m = new Map<string, number>();
      for (const s of spots ?? []) {
        if (!passes(s, axis)) continue;
        if (withSel && sel != null && s.oid !== sel) continue;
        for (const k of s.keys[axis]) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m]
        .sort((a, b) => (a[0] === BLANK ? 1 : 0) - (b[0] === BLANK ? 1 : 0) || b[1] - a[1])
        .map(([key, value]) => ({ key, label: key, value }));
    },
    [spots, passes, sel],
  );

  const charts = React.useMemo(
    () => Object.fromEntries(AXES.map((a) => [a.id, tally(a.id, true)])) as Record<Axis, Datum[]>,
    [tally],
  );
  const menus = React.useMemo(
    () => Object.fromEntries(AXES.map((a) => [a.id, tally(a.id, false)])) as Record<Axis, Datum[]>,
    [tally],
  );

  /* Ангиллын өнгө — шүүгдээгүй тооллоор, тогтвортой (шүүлтээр солигдохгүй) */
  const kindColor = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of spots ?? []) m.set(s.keys.kind[0], (m.get(s.keys.kind[0]) ?? 0) + 1);
    const order = [...m].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const ramp = spreadRamp(order.length);
    return new Map(order.map((k, i) => [k, ramp[i]]));
  }, [spots]);

  const points = React.useMemo<MapPoints>(
    () => ({
      oid: (spots ?? []).map((s) => s.oid),
      lon: (spots ?? []).map((s) => s.lon),
      lat: (spots ?? []).map((s) => s.lat),
    }),
    [spots],
  );
  const colors = React.useMemo(
    () => (spots ?? []).map((s) => kindColor.get(s.keys.kind[0])),
    [spots, kindColor],
  );
  const visible = React.useMemo(() => Uint32Array.from(shown), [shown]);
  /* Шошго — зүйлийн нэр (байхгүй бол ангилал), ойртоход л */
  const labels = React.useMemo(
    () => ({
      text: (spots ?? []).map((s) =>
        s.keys.species[0] === BLANK ? s.keys.kind[0] : s.keys.species[0],
      ),
      minzoom: 13,
    }),
    [spots],
  );

  const detail = React.useMemo(
    () => (sel == null ? null : (spots?.find((s) => s.oid === sel) ?? null)),
    [spots, sel],
  );

  const filtered = Object.values(pick).some(Boolean);
  const focus = React.useMemo<Extent | null>(() => {
    if (!spots) return null;
    const b = new Bounds();
    if (detail) {
      b.add(detail.lon, detail.lat);
      return b.get();
    }
    if (!filtered || !shown.length) return null;
    for (const i of shown) b.add(spots[i].lon, spots[i].lat);
    return b.get();
  }, [spots, detail, filtered, shown]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <div className="text-center">
          <p className="text-[14px] font-medium">Эх сурвалжийн мэдээллийг татаж чадсангүй</p>
          <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
        </div>
      </div>
    );
  }
  if (!spots) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
          <Loader2 size={14} className="animate-spin" />
          Судалгааны бүртгэл татаж байна…
        </span>
      </div>
    );
  }

  const set = (axis: Axis) => (k: string | null) => setPick((p) => ({ ...p, [axis]: k }));
  const total = sel != null ? 1 : shown.length;
  const activeCount = Object.values(pick).filter(Boolean).length + (sel != null ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Сонгинохайрхан уулын судалгаа"
        activeCount={activeCount}
        onReset={() => {
          setPick({ kind: null, age: null, species: null, type: null });
          setPicked(null);
        }}
      >
        {AXES.map((a) => (
          <FilterMenu
            key={a.id}
            label={a.title}
            icon={a.id === "species" ? PawPrint : Tag}
            value={pick[a.id]}
            active={Boolean(pick[a.id])}
            onClear={() => set(a.id)(null)}
            width={a.id === "species" ? 280 : 220}
          >
            <PickList
              items={menus[a.id]}
              selected={pick[a.id]}
              onPick={set(a.id)}
              searchable={a.id === "species"}
            />
          </FilterMenu>
        ))}
      </FilterBar>

      <Columns layout="flex" id="songino" left={280} right={340} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: зүйлээр ---- */}
        <SheetSection
          title="Зүйлээр"
          meta={catMeta(charts.species.length)}
          className="min-h-[160px] flex-1 xl:w-(--col-l) xl:flex-none"
          bodyClassName="min-h-0 flex-1 overflow-y-auto"
        >
          <SheetBars
            data={charts.species}
            measure="Бүртгэлийн тоо"
            selected={pick.species}
            onSelect={set("species")}
            rows={Infinity}
          />
        </SheetSection>

        {/* ---- ГОЛ: газрын зураг ---- */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-xs border border-line bg-paper-2">
            <div className="relative h-full w-full">
              <PointMap
                points={points}
                visible={visible}
                colors={colors}
                labels={labels}
                cluster={false}
                highlight={detail ? [detail.lon, detail.lat] : null}
                basemap={basemap}
                onSelect={(oid) => setPicked(sel === oid ? null : oid)}
                focus={focus}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              <MapLegend
                groups={[
                  {
                    key: "kind",
                    title: "Сонгинохайрхан уулын судалгаа",
                    field: "Ангилал",
                    items: [...kindColor].map(([k, c]) => ({ key: k, label: k, color: c })),
                  },
                ]}
              />

              {detail ? (
                <div className="elevated absolute right-2.5 bottom-8 z-10 w-[280px] max-h-[70%] overflow-y-auto rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
                    <span className="truncate text-[12.5px] font-medium text-ink">
                      {detail.keys.species[0] === BLANK ? detail.keys.kind[0] : detail.keys.species[0]}
                    </span>
                    <button
                      type="button"
                      aria-label="Хаах"
                      onClick={() => setPicked(null)}
                      className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <dl className="space-y-1.5 px-2.5 py-2">
                    {fields.map((f) => {
                      const v = text(detail.attrs[f.name]);
                      return (
                        <div key={f.name} className="flex gap-2">
                          <dt className="w-[96px] shrink-0 text-[10px] tracking-[0.06em] text-ink-3 uppercase">
                            {f.alias}
                          </dt>
                          <dd className={cn("min-w-0 flex-1 text-[11.5px] leading-snug", v ? "text-ink-2" : "text-ink-3")}>
                            {v || "—"}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ) : null}
            </div>
          </div>
          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS Enterprise
          </p>
        </div>

        {/* ---- БАРУУН: NBAHH-ын хуудас — Тойм → задаргаа ---- */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto xl:w-(--col-r) xl:shrink-0">
          <SheetStats
            stats={[
              { label: "Бүртгэлийн тоо", value: total },
              { label: "Амьтан, ургамлын зүйл", value: charts.species.filter((d) => d.key !== BLANK).length },
            ]}
          />
          {AXES.filter((a) => a.id !== "species").map((a) => (
            <SheetSection key={a.id} title={a.title} meta={catMeta(charts[a.id].length)}>
              <SheetBars
                data={charts[a.id]}
                measure="Бүртгэлийн тоо"
                selected={pick[a.id]}
                onSelect={set(a.id)}
                colorOf={a.id === "kind" ? (d) => kindColor.get(d.key) : undefined}
              />
            </SheetSection>
          ))}
        </div>
      </Columns>
    </div>
  );
}

