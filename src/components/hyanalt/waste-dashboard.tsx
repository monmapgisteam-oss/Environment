"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  CalendarClock,
  CalendarX2,
  FileCheck2,
  Landmark,
  Loader2,
  MapPin,
  MousePointerClick,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { Columns } from "@/components/ui/resizable-columns";
import { oklchHex } from "@/components/wells/colors";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import {
  fetchLayerFeatures,
  fetchLayerInfo,
  type LayerInfo,
} from "@/lib/portal-layers";
import { WASTE } from "@/lib/hyanalt-layers";
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
   ЛАНДФИЛЛ — хог хаягдлын ХОЁР давхарга НЭГ самбарт

   ⚠⚠ ХОЁР ДАВХАРГА НИЙЛСЭН (хэрэглэгчийн шийдвэр, 2026-10-05: "энгийн
   болон аюултай хог хаягдлыг нийлүүл, анхдагчаар аюултай харагдана,
   нэг товч дарвал баруун самбар дээр энгийн хог хаягдлын утгууд
   харагдана"). Урьд нь ерөнхий порталын самбар (`PortalLayers`) хоёр
   давхаргыг радио товчоор СЭЛГЭДЭГ байсан бөгөөд энгийн хог хаягдлын
   гурван цэг аюултайн арван хоёртой нэг зураг дээр хэзээ ч зэрэг
   харагддаггүй байв.

   ⚠⚠ ДИАГРАМ БАЙХГҮЙ (хэрэглэгч: "чартын дизайн ерөөсөө таалагдахгүй").
   Арван хоёр бичлэгийн дүүрэг, төлөвийн задаргаа нь хоёр, гурван
   зурвастай диаграм болж юу ч хэлдэггүй байв. Зөвшөөрлийн ГОЛ асуулт
   нь ХЭЗЭЭ — тиймээс жагсаалтын мөр бүр өөрөө хугацааны туузтай
   (олгосноос дуусах хүртэл, өнөөдрийн зураастай). Арван хоёр мөр нийлээд
   нэг Гант диаграм болно — тусдаа диаграм шаардлагагүй.

   БҮТЭЦ:
     · зүүн — аюултай хог хаягдлын зөвшөөрлүүд, дуусах огноогоор;
     · төв  — үзүүлэлтийн мөр + ХОЁР давхарга зэрэг асдаг газрын зураг;
     · баруун — ДИНАМИК самбар: анхдагчаар аюултай хог хаягдал
       (сонгосон зөвшөөрөл эсвэл дүүргээр), толгойн товчоор энгийн хог
       хаягдлын цэгүүд.

   ⚠ Талбарын нэрийг ТААМАГЛАХГҮЙ: зөвхөн баримтжсан хэдэн нэр
   (`tosol_ner`, `tseg_ner`, `zov_avsan`, `zov_duusah`, `zov_tolov`,
   `duureg`, `horoo`) онцгой үүрэгтэй. Бусад бүх талбар нь давхаргын
   тодорхойлолтоос (`info.fields`) уншигдаж дэлгэрэнгүйд бүтнээрээ гарна
   — хоосон нь ч "—" гэж.
   -------------------------------------------------------------------------- */

const [HAZARD_ID, COMMON_ID] = ["аюултай_хог_хаягдал", "энгийн_хог_хаягдал"];

/** Давхаргын таних өнгө — ерөнхий самбарын `toneOfHue`-тэй ижил томьёо */
const HAZARD_HEX = oklchHex(0.74, 0.15, WASTE.hues[1] ?? 212); // #00c2e1
const COMMON_HEX = oklchHex(0.74, 0.15, WASTE.hues[0] ?? 168); // #00c899

/*
  ЗУРГИЙН ТЭМДЭГ — цэгийн оронд икон бүхий тэмдэглэгээ (хэрэглэгч,
  2026-10-05: "мап дээрх пойнтыг солиод legend"). Хэлбэр, өнгийг
  `globals.css`-ийн `data-pin="hazard"` / `"landfill"` өгнө. Тайлбар
  (`Legend`) нь ИЖИЛ икон, ижил хэлбэрээр зурагдана — зурагтай нэг
  харагдах ёстой.
*/
const SVG_HEAD =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"';
const HAZARD_PIN =
  `<svg data-pin="hazard" ${SVG_HEAD}>` +
  '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
  '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
const COMMON_PIN =
  `<svg data-pin="landfill" ${SVG_HEAD}>` +
  '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>' +
  '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';

/** Хоёр давхаргын дугаар мөргөлдөхгүйн тулд энгийнийх нь шилжинэ */
const COMMON_BASE = 1_000_000;

const DAY = 86_400_000;

type Kind = "hazard" | "common";

type Rec = {
  uid: number;
  kind: Kind;
  name: string;
  place: string;
  lon: number | null;
  lat: number | null;
  row: Record<string, unknown>;
  /** Зөвхөн аюултайд — зөвшөөрөл олгосон, дуусах огноо (мс) */
  issued: number | null;
  expires: number | null;
  status: string;
};

/** Талбарыг үсгийн том жижгээс үл хамааран олно */
function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase() === n);
    if (k != null) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return v;
    }
  }
  return null;
}

function text(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/**
 * Огноо — ArcGIS-ийн `Date` талбар мс-ээр, бичвэр талбар нь
 * "2024.05.12" / "2024-05-12" хэлбэрээр ирж болно. Он дөрвөн оронтой
 * биш бол `null` — таамаглан "засахгүй".
 */
function dateOf(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const m = text(v).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

function dateText(t: number | null): string {
  if (t == null) return "Тодорхойгүй";
  const d = new Date(t);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Үлдсэн хугацаа — жил, сараар */
function remainText(expires: number | null, today: number): string {
  if (expires == null) return "Дуусах огноо тодорхойгүй";
  const days = Math.round((expires - today) / DAY);
  if (days < 0) return "Хугацаа дууссан";
  if (days < 62) return `${num(days)} хоног үлдсэн`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${num(months)} сар үлдсэн`;
  return `${num(days / 365.25, 1)} жил үлдсэн`;
}

/** Хугацааны төлөв — ӨНГӨ нь дохионы гурван өнгө */
function expiryTone(expires: number | null, today: number): string {
  if (expires == null) return "var(--ink-3)";
  if (expires < today) return "var(--clay)";
  if (expires - today < 365 * DAY) return "var(--ochre)";
  return "var(--moss)";
}

function toRecs(
  kind: Kind,
  info: LayerInfo,
  shapes: GeoJSON.FeatureCollection,
  rows: Record<number, Record<string, unknown>>,
): Rec[] {
  const at = new Map<number, [number, number]>();
  for (const f of shapes.features) {
    if (f.geometry?.type === "Point") {
      at.set(Number(f.id), f.geometry.coordinates as [number, number]);
    }
  }
  const base = kind === "common" ? COMMON_BASE : 0;
  const firstString = info.fields.find((f) => f.type === "String")?.name;

  return Object.entries(rows).map(([k, row]) => {
    const oid = Number(k);
    /* Геометр ирээгүй бол эх сурвалжийн өөрийн координатын баганаас */
    const g = at.get(oid);
    const lon = g?.[0] ?? (Number(pick(row, "lon")) || null);
    const lat = g?.[1] ?? (Number(pick(row, "lat")) || null);
    const name =
      text(pick(row, kind === "hazard" ? "tosol_ner" : "tseg_ner", "ner", "name")) ||
      (firstString ? text(row[firstString]) : "") ||
      `№${oid}`;
    return {
      uid: base + oid,
      kind,
      name,
      place: [text(pick(row, "duureg")), text(pick(row, "horoo"))]
        .filter(Boolean)
        .join(" · "),
      lon,
      lat,
      row,
      issued: kind === "hazard" ? dateOf(pick(row, "zov_avsan")) : null,
      expires: kind === "hazard" ? dateOf(pick(row, "zov_duusah")) : null,
      status: text(pick(row, "zov_tolov")),
    };
  });
}

type Layer = { info: LayerInfo; recs: Rec[] };

/** Хоёр давхаргыг зэрэг татна — нэг нь унасан ч нөгөө нь харагдана */
function useWasteLayers() {
  const [layers, setLayers] = React.useState<Partial<Record<Kind, Layer>>>({});
  const [failed, setFailed] = React.useState<Partial<Record<Kind, string>>>({});

  React.useEffect(() => {
    const ac = new AbortController();
    const load = async (kind: Kind, id: string) => {
      try {
        const info = await fetchLayerInfo(WASTE, id, ac.signal);
        const data = await fetchLayerFeatures(info, ac.signal);
        setLayers((cur) => ({
          ...cur,
          [kind]: { info, recs: toRecs(kind, info, data.shapes, data.rows) },
        }));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFailed((cur) => ({
          ...cur,
          [kind]: e instanceof Error ? e.message : String(e),
        }));
      }
    };
    void load("hazard", HAZARD_ID);
    void load("common", COMMON_ID);
    return () => ac.abort();
  }, []);

  return { layers, failed };
}

export function WasteDashboard() {
  const { layers, failed } = useWasteLayers();
  /* Одоогийн мөч — НЭГ УДАА барина (зурагдалт бүрд `Date.now()` дуудвал
     хугацааны тууз хөдөлж, мемо бүр хүчингүй болно) */
  const [today] = React.useState(() => Date.now());
  const [mode, setMode] = React.useState<Kind>("hazard");
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const tip = useMapTip();

  const hazard = layers.hazard;
  const common = layers.common;

  /* Дуусах огноогоор — хугацаа дууссан нь эхэнд, огноогүй нь эцэст */
  const permits = React.useMemo(
    () =>
      [...(hazard?.recs ?? [])].sort(
        (a, b) =>
          (a.expires ?? Infinity) - (b.expires ?? Infinity) ||
          a.name.localeCompare(b.name, "mn"),
      ),
    [hazard],
  );
  const sites = React.useMemo(() => common?.recs ?? [], [common]);

  const all = React.useMemo(() => [...permits, ...sites], [permits, sites]);
  const byUid = React.useMemo(() => new Map(all.map((r) => [r.uid, r])), [all]);

  /* Хугацааны туузны нийтлэг хуваарь — бүх мөр НЭГ тэнхлэгтэй */
  const span = React.useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of permits) {
      if (r.issued != null) lo = Math.min(lo, r.issued);
      if (r.expires != null) hi = Math.max(hi, r.expires);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    lo = Math.min(lo, today);
    hi = Math.max(hi, today);
    /* Бүтэн он руу тэлнэ — тэнхлэгийн шошго оны эхэнд сууна */
    const from = Date.UTC(new Date(lo).getUTCFullYear(), 0, 1);
    const to = Date.UTC(new Date(hi).getUTCFullYear() + 1, 0, 1);
    return { from, to };
  }, [permits, today]);

  const stats = React.useMemo(() => {
    let valid = 0;
    let soon = 0;
    let expired = 0;
    for (const r of permits) {
      if (r.expires == null) continue;
      if (r.expires < today) expired++;
      else {
        valid++;
        if (r.expires - today < 365 * DAY) soon++;
      }
    }
    return { valid, soon, expired };
  }, [permits, today]);

  /* ---------------- Газрын зураг ---------------- */

  const map = React.useMemo(() => {
    const oid: number[] = [];
    const lon: number[] = [];
    const lat: number[] = [];
    const marks: Record<number, string> = {};
    for (const r of all) {
      if (r.lon == null || r.lat == null) continue;
      oid.push(r.uid);
      lon.push(r.lon);
      lat.push(r.lat);
      marks[r.uid] = r.kind === "hazard" ? HAZARD_PIN : COMMON_PIN;
    }
    const points: MapPoints = { oid, lon, lat };
    return { points, marks, visible: Uint32Array.from(oid, (_, i) => i) };
  }, [all]);

  /* Хоёр давхарга хоёулаа ирсэн үед л зургийг үүсгэнэ: эх сурвалжийн
     тохиргоо нь анхны зурагдалтад л уншигддаг */
  const ready = (hazard || failed.hazard) && (common || failed.common);

  const selected = picked == null ? null : (byUid.get(picked) ?? null);
  const hovered = tip.oid == null ? null : (byUid.get(tip.oid) ?? null);
  const lit = hovered ?? selected;
  const highlight = React.useMemo<[number, number] | null>(
    () => (lit && lit.lon != null && lit.lat != null ? [lit.lon, lit.lat] : null),
    [lit],
  );

  const focus = React.useMemo<Extent | null>(() => {
    if (!selected || selected.lon == null || selected.lat == null) return null;
    const d = 0.012;
    return [selected.lon - d, selected.lat - d, selected.lon + d, selected.lat + d];
  }, [selected]);

  const choose = React.useCallback(
    (uid: number) => {
      const r = byUid.get(uid);
      if (!r) return;
      setMode(r.kind);
      setPicked((p) => (p === uid ? null : uid));
    },
    [byUid],
  );

  const toggleCommon = React.useCallback(() => {
    setMode((m) => (m === "common" ? "hazard" : "common"));
    setPicked(null);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      {/* ---- ТОЛГОЙ: гарчиг ба баруун самбарын товч ---- */}
      <div className="workspace-filterbar flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-2 px-3 py-2.5">
        <span className="shrink-0 text-[13px] font-semibold text-ink">Ландфилл</span>

        <button
          type="button"
          aria-pressed={mode === "common"}
          onClick={toggleCommon}
          className={cn("map-view-toggle ml-auto", mode === "common" && "selected")}
        >
          <Landmark size={15} /> Энгийн хог хаягдал
        </button>
      </div>

      {/* ---- ҮЗҮҮЛЭЛТ ---- */}
      <div className="analytics-overview" aria-label="Өгөгдлийн тойм">
        <Stat icon={FileCheck2} label="Аюултай хог хаягдлын зөвшөөрөл" value={hazard ? num(permits.length) : "…"} />
        <Stat icon={CalendarClock} label="Хугацаа хүчинтэй зөвшөөрөл" value={hazard ? num(stats.valid) : "…"} />
        <Stat
          icon={CalendarX2}
          label="Нэг жилийн дотор дуусах зөвшөөрөл"
          value={hazard ? num(stats.soon) : "…"}
          tone={stats.soon > 0 ? "var(--ochre)" : undefined}
        />
        <Stat icon={Trash2} label="Энгийн хог хаягдлын цэг" value={common ? num(sites.length) : "…"} />
      </div>

      <Columns id="hyanalt-waste" left={340} right={330} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: зөвшөөрлүүд хугацааны туузтай ---- */}
        <section className="data-surface flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-paper-2 max-xl:max-h-[520px]">
          <PanelHead
            dot={HAZARD_HEX}
            title="Аюултай хог хаягдлын зөвшөөрөл"
            count={hazard ? permits.length : undefined}
          />
          {span ? <Axis from={span.from} to={span.to} today={today} /> : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {failed.hazard ? (
              <Failed message={failed.hazard} />
            ) : !hazard ? (
              <Pending />
            ) : permits.length === 0 ? (
              <Waiting />
            ) : (
              <ul className="divide-y divide-line">
                {permits.map((r) => (
                  <PermitRow
                    key={r.uid}
                    rec={r}
                    span={span}
                    today={today}
                    on={picked === r.uid}
                    hot={tip.oid === r.uid}
                    onPick={() => choose(r.uid)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ---- ТӨВ: газрын зураг ---- */}
        <div className="relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-line max-xl:min-h-[420px]">
          {ready ? (
            <PointMap
              points={map.points}
              visible={map.visible}
              marks={map.marks}
              pickedMark={picked}
              /* ⚠ Нэрийн шошго УНТРААЛТТАЙ (хэрэглэгч, 2026-10-05) — нэр нь
                 хөвөгч тайлбар, жагсаалт, баруун самбарт гардаг */
              basemap={basemap}
              cluster={false}
              onSelect={choose}
              onHover={tip.onHover}
              highlight={highlight}
              focus={focus}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-paper-3">
              <Loader2 size={16} className="animate-spin text-ink-3" />
            </div>
          )}

          <BasemapGallery value={basemap} onChange={setBasemap} placement="top-left" />

          <Legend
            items={[
              { kind: "hazard", label: "Аюултай хог хаягдал", count: hazard?.recs.length },
              { kind: "common", label: "Энгийн хог хаягдал", count: common?.recs.length },
            ]}
          />

          {hovered ? (
            <MapTip state={tip} width={248}>
              <div className="flex items-start gap-2 px-2.5 pt-2 pb-2">
                <span
                  aria-hidden
                  className="mt-[5px] size-2 shrink-0 rounded-full"
                  style={{ background: hovered.kind === "hazard" ? HAZARD_HEX : COMMON_HEX }}
                />
                <span className="text-[12.5px] leading-snug font-medium text-ink">
                  {hovered.name}
                </span>
              </div>
              <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                {hovered.place ? <MapTipRow icon={MapPin} text={hovered.place} /> : null}
                {hovered.kind === "hazard" ? (
                  <MapTipRow
                    icon={CalendarClock}
                    text={`${dateText(hovered.expires)} · ${remainText(hovered.expires, today)}`}
                    num
                  />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                <span className="text-[10px] leading-none text-ink-3">
                  {hovered.kind === "hazard" ? "Аюултай хог хаягдал" : "Энгийн хог хаягдал"}
                </span>
                <MousePointerClick size={11} className="shrink-0 text-ink-3" />
              </div>
            </MapTip>
          ) : null}

          <p
            className="pointer-events-none absolute bottom-1 left-2.5 z-10 text-[10px] leading-none text-ink-3"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
          >
            Суурь зураг: Esri
          </p>
        </div>

        {/* ---- БАРУУН: динамик самбар ---- */}
        <section className="data-surface flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-paper-2 max-xl:max-h-[620px]">
          {mode === "common" ? (
            <>
              <PanelHead
                dot={COMMON_HEX}
                title="Энгийн хог хаягдлын цэг"
                count={common ? sites.length : undefined}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {failed.common ? (
                  <Failed message={failed.common} />
                ) : !common ? (
                  <Pending />
                ) : sites.length === 0 ? (
                  <Waiting />
                ) : (
                  <div className="divide-y divide-line">
                    {sites.map((r) => (
                      <SiteBlock
                        key={r.uid}
                        rec={r}
                        info={common.info}
                        on={picked === r.uid}
                        onPick={() => choose(r.uid)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : selected && selected.kind === "hazard" && hazard ? (
            <PermitDetail
              rec={selected}
              info={hazard.info}
              today={today}
              onClose={() => setPicked(null)}
            />
          ) : (
            <>
              <PanelHead dot={HAZARD_HEX} title="Дүүргээр" count={hazard ? permits.length : undefined} />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {failed.hazard ? (
                  <Failed message={failed.hazard} />
                ) : !hazard ? (
                  <Pending />
                ) : (
                  <Districts recs={permits} today={today} onPick={choose} />
                )}
              </div>
            </>
          )}
        </section>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Зургийн тайлбар — баруун доод буланд. Тэмдэг нь зураг дээрхтэй ижил
 * хэлбэр (дугуй / дөрвөлжин), ижил икон, ижил өнгөтэй.
 */
function Legend({
  items,
}: {
  items: { kind: Kind; label: string; count?: number }[];
}) {
  return (
    <div className="absolute right-1 bottom-1 z-10 space-y-px rounded-sm border border-line bg-paper/80 px-1 py-0.5 backdrop-blur-md">
      {items.map((it) => {
        const hex = it.kind === "hazard" ? HAZARD_HEX : COMMON_HEX;
        const Icon = it.kind === "hazard" ? TriangleAlert : Trash2;
        return (
          <div key={it.kind} className="flex items-center gap-1 text-[8.5px] leading-[1.2] text-ink">
            <span
              aria-hidden
              className={cn(
                "flex size-2.5 shrink-0 items-center justify-center border bg-[#111a22]",
                it.kind === "hazard" ? "rounded-full" : "rounded-[1.5px]",
              )}
              style={{ borderColor: hex, color: hex }}
            >
              <Icon size={6} strokeWidth={2.6} />
            </span>
            <span className="min-w-0 flex-1">{it.label}</span>
            {it.count != null ? (
              <span className="num pl-0.5 text-ink-3">{num(it.count)}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Trash2;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="analytics-stat">
      <span className="analytics-stat-icon" style={tone ? { color: tone } : undefined}>
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        {/* ⚠ Нэр нь ТОМ ҮСГЭЭР, 12px (хэрэглэгч, 2026-10-05). Нийтлэг
            `.analytics-stat-label` (10px) нь давхаргаас гадуурх CSS тул
            Tailwind-ийн анги түүнийг дарахгүй — `style`-ээр өгнө. Бусад
            самбарын үзүүлэлтэд нөлөөлөхгүй. */}
        <span
          className="analytics-stat-label"
          style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          {label}
        </span>
        <span className="analytics-stat-value" style={tone ? { color: tone } : undefined}>
          {value}
        </span>
      </div>
    </div>
  );
}

function PanelHead({
  dot,
  title,
  count,
  children,
}: {
  dot: string;
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
      <h2 className="display min-w-0 flex-1 truncate text-[13px] leading-snug">{title}</h2>
      {count != null ? <span className="num text-[11px] text-ink-3">{num(count)}</span> : null}
      {children}
    </div>
  );
}

/* ---------------- Хугацааны тэнхлэг ---------------- */

function pos(t: number, span: { from: number; to: number }) {
  return ((t - span.from) / (span.to - span.from)) * 100;
}

/**
 * Жагсаалтын дээрх оны тэнхлэг. Мөр бүрийн тууз ЯГ энэ хуваарьтай —
 * баганын толгойн үүрэгтэй: туузны байрлал юуг заахыг тайлбаргүйгээр
 * хэлнэ.
 */
function Axis({ from, to, today }: { from: number; to: number; today: number }) {
  const span = { from, to };
  const y0 = new Date(from).getUTCFullYear();
  const y1 = new Date(to).getUTCFullYear();
  const years = y1 - y0;
  /* Шошго давхцахгүй байх алхам — ойролцоогоор зургаа хүртэл */
  const step = Math.max(1, Math.ceil(years / 6));
  const ticks: number[] = [];
  for (let y = y0; y <= y1; y += step) ticks.push(y);

  return (
    <div className="shrink-0 border-b border-line px-4 pt-2 pb-1.5">
      <div className="relative h-3.5">
        {ticks.map((y) => {
          const left = pos(Date.UTC(y, 0, 1), span);
          return (
            <span
              key={y}
              className={cn(
                "num absolute top-0 text-[10px] leading-none text-ink-3",
                left > 92 ? "-translate-x-full" : left > 4 && "-translate-x-1/2",
              )}
              style={{ left: `${left}%` }}
            >
              {y}
            </span>
          );
        })}
      </div>
      <div className="relative h-1.5">
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-ink"
          style={{ left: `${pos(today, span)}%` }}
        />
      </div>
    </div>
  );
}

/** Олгосноос дуусах хүртэлх тууз, өнөөдрийн зураастай */
function Track({
  rec,
  span,
  today,
}: {
  rec: Rec;
  span: { from: number; to: number } | null;
  today: number;
}) {
  if (!span) return null;
  const tone = expiryTone(rec.expires, today);
  const a = rec.issued != null ? pos(rec.issued, span) : null;
  const b = rec.expires != null ? pos(rec.expires, span) : null;
  return (
    <div className="relative h-2">
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
      {a != null && b != null ? (
        <span
          aria-hidden
          className="absolute top-0 h-full rounded-[1px]"
          style={{
            left: `${a}%`,
            width: `${Math.max(b - a, 0.8)}%`,
            background: `color-mix(in oklab, ${tone} 70%, transparent)`,
          }}
        />
      ) : b != null ? (
        <span
          aria-hidden
          className="absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-[1px]"
          style={{ left: `${b}%`, background: tone }}
        />
      ) : null}
      <span
        aria-hidden
        className="absolute -inset-y-0.5 w-px bg-ink"
        style={{ left: `${pos(today, span)}%` }}
      />
    </div>
  );
}

function PermitRow({
  rec,
  span,
  today,
  on,
  hot,
  onPick,
}: {
  rec: Rec;
  span: { from: number; to: number } | null;
  today: number;
  on: boolean;
  hot: boolean;
  onPick: () => void;
}) {
  const tone = expiryTone(rec.expires, today);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={on}
        className={cn(
          "relative block w-full px-4 py-2.5 text-left transition-colors",
          on ? "bg-data/10" : hot ? "bg-paper-hi" : "hover:bg-paper-hi",
        )}
      >
        {on ? <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-data" /> : null}
        <div className="line-clamp-2 text-[12px] leading-snug text-ink" title={rec.name}>
          {rec.name}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2 text-[10.5px] leading-none">
          <span className="min-w-0 truncate text-ink-3">{rec.place || rec.status || " "}</span>
          <span className="num shrink-0" style={{ color: tone }}>
            {remainText(rec.expires, today)}
          </span>
        </div>
        <div className="mt-2">
          <Track rec={rec} span={span} today={today} />
        </div>
      </button>
    </li>
  );
}

/* ---------------- Баруун самбарын агуулга ---------------- */

/** Сонгоогүй үед — дүүрэг бүрийн зөвшөөрлүүд, нэрээрээ */
function Districts({
  recs,
  today,
  onPick,
}: {
  recs: Rec[];
  today: number;
  onPick: (uid: number) => void;
}) {
  const groups = React.useMemo(() => {
    const m = new Map<string, Rec[]>();
    for (const r of recs) {
      const k = text(pick(r.row, "duureg")) || "Тодорхойгүй";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "mn"));
  }, [recs]);

  if (!groups.length) return <Waiting />;

  return (
    <div className="divide-y divide-line">
      {groups.map(([district, list]) => (
        <div key={district} className="px-4 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-ink">{district}</span>
            <span className="num text-[11px] text-ink-3">{num(list.length)}</span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {list.map((r) => (
              <li key={r.uid}>
                <button
                  type="button"
                  onClick={() => onPick(r.uid)}
                  className="flex w-full items-start gap-2 text-left text-[11.5px] leading-snug text-ink-2 hover:text-ink"
                >
                  <span
                    aria-hidden
                    className="mt-[5px] size-1.5 shrink-0 rounded-full"
                    style={{ background: expiryTone(r.expires, today) }}
                  />
                  <span className="min-w-0 flex-1">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PermitDetail({
  rec,
  info,
  today,
  onClose,
}: {
  rec: Rec;
  info: LayerInfo;
  today: number;
  onClose: () => void;
}) {
  const tone = expiryTone(rec.expires, today);
  return (
    <>
      <PanelHead dot={HAZARD_HEX} title="Аюултай хог хаягдлын зөвшөөрөл">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xs px-1.5 py-0.5 text-[11px] text-ink-3 hover:bg-paper-hi hover:text-ink"
        >
          Хаах
        </button>
      </PanelHead>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-line px-4 py-3">
          <div className="text-[13px] leading-snug font-medium text-ink">{rec.name}</div>
          {rec.place ? <div className="mt-1 text-[11px] text-ink-3">{rec.place}</div> : null}

          {/* Хугацаа — олгосон ба дуусах огноо, үлдсэн хугацаа */}
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
            <div className="bg-paper-2 px-3 py-2">
              <div className="eyebrow">Олгосон</div>
              <div className="num mt-1 text-[13px] text-ink">{dateText(rec.issued)}</div>
            </div>
            <div className="bg-paper-2 px-3 py-2">
              <div className="eyebrow">Дуусах</div>
              <div className="num mt-1 text-[13px] text-ink">{dateText(rec.expires)}</div>
            </div>
          </div>
          <div className="num mt-2 text-[11.5px]" style={{ color: tone }}>
            {remainText(rec.expires, today)}
          </div>
        </div>
        <Fields info={info} row={rec.row} />
      </div>
    </>
  );
}

function SiteBlock({
  rec,
  info,
  on,
  onPick,
}: {
  rec: Rec;
  info: LayerInfo;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <div className={cn("relative", on && "bg-data/6")}>
      {on ? <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-data" /> : null}
      <button
        type="button"
        onClick={onPick}
        className="block w-full px-4 pt-3 pb-1 text-left"
      >
        <div className="text-[12.5px] leading-snug font-medium text-ink">{rec.name}</div>
        {rec.place ? <div className="mt-0.5 text-[11px] text-ink-3">{rec.place}</div> : null}
      </button>
      <Fields info={info} row={rec.row} compact />
    </div>
  );
}

/**
 * Бүх талбар — хоосон нь ч "—" гэж бүдэг өнгөөр (порталын бичлэгийн
 * цонхтой ижил шийдвэр: хоосон байдал нь өөрөө мэдээлэл).
 */
function Fields({
  info,
  row,
  compact,
}: {
  info: LayerInfo;
  row: Record<string, unknown>;
  compact?: boolean;
}) {
  return (
    <dl className={cn(compact ? "pb-2" : "divide-y divide-line")}>
      {info.fields.map((f) => {
        const raw = row[f.name];
        const v =
          f.type === "Date" && raw != null && raw !== ""
            ? dateText(dateOf(raw))
            : typeof raw === "string"
              ? raw.trim()
              : raw;
        const empty = v === "" || v == null;
        return (
          <div key={f.name} className={cn("flex gap-2 px-4", compact ? "py-1" : "py-1.5")}>
            <dt className="w-[110px] shrink-0 text-[10px] leading-snug tracking-[0.06em] text-ink-3 uppercase">
              {f.alias}
            </dt>
            <dd
              className={cn(
                "min-w-0 flex-1 text-[11.5px] leading-snug",
                empty ? "text-ink-3" : "text-ink-2",
                typeof v === "number" && "num",
              )}
            >
              {empty ? "—" : String(v)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ---------------- Төлөвүүд ---------------- */

function Pending() {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center">
      <Loader2 size={16} className="animate-spin text-ink-3" />
    </div>
  );
}

function Waiting() {
  return (
    <div className="hatch m-3 flex min-h-[120px] items-center justify-center rounded-xs border border-dashed border-line-2">
      <p className="px-6 text-center text-[12px] text-ink-3">Мэдээлэл хүлээгдэж байна</p>
    </div>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <div className="m-3 rounded-xs border border-clay/40 px-3 py-2.5 text-[11.5px] leading-snug text-clay">
      Мэдээлэл ачаалагдсангүй: {message}
    </div>
  );
}
