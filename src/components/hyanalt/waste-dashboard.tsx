"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  BatteryCharging,
  Building2,
  CalendarClock,
  CalendarX2,
  Check,
  ChevronRight,
  Cpu,
  Factory,
  FileCheck2,
  FlaskConical,
  Landmark,
  Loader2,
  MapPin,
  MousePointerClick,
  Recycle,
  Trash2,
  TriangleAlert,
  X,
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
import { Bounds } from "@/lib/extent";
import { cn, num } from "@/lib/utils";
import detailStyles from "./waste-permit-detail.module.css";
import listStyles from "./waste-permit-list.module.css";
import { WasteSiteCard } from "./waste-site-card";
import siteStyles from "./waste-site-card.module.css";
import dashboardStyles from "./waste-dashboard.module.css";

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
   Зөвшөөрлүүдийг дуусах огноогоор эрэмбэлж, төсөл бүрийн байршил,
   дуусах огноо, үлдсэн хугацааг нэртэй нь харуулна. Хугацааны дэлгэрэнгүй
   зурвас нь сонгосон зөвшөөрлийн баруун панельд байна.

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
  /** Дүүргийн нэр (эх бичвэр) ба шүүлтийн түлхүүр */
  dname: string;
  dkey: string;
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

/**
 * Дүүргийн шүүлтийн түлхүүр — хоёр давхарга "Баянзүрх" / "Баянзүрх
 * дүүрэг" гэж өөрөөр бичсэн байж болох тул дагавар, үсгийн томыг хасна.
 */
function distKey(name: string): string {
  return name.replace(/\s*дүүрэг$/i, "").trim().toLowerCase();
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
    const dname = text(pick(row, "duureg"));
    return {
      uid: base + oid,
      kind,
      name,
      dname,
      dkey: distKey(dname),
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
  /** Дүүргийн шүүлт (`Rec.dkey`) — "Дүүргээр" картаас */
  const [district, setDistrict] = React.useState<string | null>(null);
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

  /*
    ДҮҮРГИЙН ШҮҮЛТ — зураг, хоёр жагсаалт, үзүүлэлт бүгд хумигдана.
    "Дүүргээр" карт өөрийн хэмжээсийг алгасна (өөр дүүрэг рүү шилжих
    боломж үлдэнэ).
  */
  const permitsF = React.useMemo(
    () => (district == null ? permits : permits.filter((r) => r.dkey === district)),
    [permits, district],
  );
  const sitesF = React.useMemo(
    () => (district == null ? sites : sites.filter((r) => r.dkey === district)),
    [sites, district],
  );

  /*
    ЗУРАГ, ЖАГСААЛТЫН СОНГОЛТ нь ШҮҮЛТ: үзүүлэлт тэр бүртгэлээр
    хумигдана. Дүүргийн шүүлтээс гарсан бол ДАМ цуцлагдана — эффектээр
    биш. ⚠ Зургийн `visible`, сонгох жагсаалтыг ХУМИХГҮЙ.
  */
  const pickedRec = picked == null ? null : (byUid.get(picked) ?? null);
  const sel =
    pickedRec && (district == null || pickedRec.dkey === district) ? pickedRec.uid : null;

  const distLabel = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of all) if (r.dname && !m.has(r.dkey)) m.set(r.dkey, r.dname);
    return m;
  }, [all]);

  /* Үзүүлэлт — дүүрэг ба сонголтыг дагана */
  const permitsS = React.useMemo(
    () => (sel == null ? permitsF : permitsF.filter((r) => r.uid === sel)),
    [permitsF, sel],
  );
  const sitesS = React.useMemo(
    () => (sel == null ? sitesF : sitesF.filter((r) => r.uid === sel)),
    [sitesF, sel],
  );

  const stats = React.useMemo(() => {
    let valid = 0;
    let soon = 0;
    let expired = 0;
    for (const r of permitsS) {
      if (r.expires == null) continue;
      if (r.expires < today) expired++;
      else {
        valid++;
        if (r.expires - today < 365 * DAY) soon++;
      }
    }
    return { valid, soon, expired };
  }, [permitsS, today]);

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
    return { points, marks };
  }, [all]);

  /* Дүүргийн шүүлт зургийг хумина; сонголт ХУМИХГҮЙ */
  const visible = React.useMemo(() => {
    const { oid } = map.points;
    if (district == null) return Uint32Array.from(oid, (_, i) => i);
    const out: number[] = [];
    oid.forEach((u, i) => byUid.get(u)?.dkey === district && out.push(i));
    return Uint32Array.from(out);
  }, [map, district, byUid]);

  /* Хоёр давхарга хоёулаа ирсэн үед л зургийг үүсгэнэ: эх сурвалжийн
     тохиргоо нь анхны зурагдалтад л уншигддаг */
  const ready = (hazard || failed.hazard) && (common || failed.common);

  const selected = sel == null ? null : pickedRec;
  const hovered = tip.oid == null ? null : (byUid.get(tip.oid) ?? null);
  const lit = hovered ?? selected;
  const highlight = React.useMemo<[number, number] | null>(
    () => (lit && lit.lon != null && lit.lat != null ? [lit.lon, lit.lat] : null),
    [lit],
  );

  const focus = React.useMemo<Extent | null>(() => {
    if (selected && selected.lon != null && selected.lat != null) {
      const d = 0.012;
      return [selected.lon - d, selected.lat - d, selected.lon + d, selected.lat + d];
    }
    if (district == null) return null;
    /* Дүүрэг шүүхэд үлдсэн цэгүүд рүү ойртоно */
    const b = new Bounds();
    for (const r of [...permitsF, ...sitesF]) {
      if (r.lon != null && r.lat != null) b.add(r.lon, r.lat);
    }
    return b.get(0.008);
  }, [selected, district, permitsF, sitesF]);

  const choose = React.useCallback(
    (uid: number) => {
      const r = byUid.get(uid);
      if (!r) return;
      setMode(r.kind);
      /* Өөр дүүргийн бүртгэл сонговол дүүргийн шүүлт цуцлагдана — эс
         тэгвээс сонголт шүүлтэд хасагдаж юу ч болоогүй мэт харагдана */
      setDistrict((d) => (d != null && d !== r.dkey ? null : d));
      setPicked((p) => (p === uid && sel === uid ? null : uid));
    },
    [byUid, sel],
  );

  const pickDistrict = React.useCallback((key: string) => {
    setDistrict((d) => (d === key ? null : key));
    setPicked(null);
  }, []);

  const clearDistrict = React.useCallback(() => {
    setDistrict(null);
    setPicked(null);
  }, []);

  const toggleCommon = React.useCallback(() => {
    setMode((m) => (m === "common" ? "hazard" : "common"));
    setPicked(null);
  }, []);

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2.5", dashboardStyles.root)}>
      {/* ---- ТОЛГОЙ: гарчиг ба баруун самбарын товч ---- */}
      <div className="workspace-filterbar flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-2 px-3 py-2.5">
        <span className="shrink-0 text-[13px] font-semibold text-ink">Ландфилл</span>

        {district != null ? (
          <button
            type="button"
            onClick={clearDistrict}
            className="flex shrink-0 items-center gap-1.5 rounded-xs border border-data/45 bg-data/10 px-2 py-1 text-[11px] leading-none text-ink"
          >
            <MapPin size={11} aria-hidden />
            {distLabel.get(district) ?? "Тодорхойгүй"}
            <X size={11} aria-hidden />
          </button>
        ) : null}

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
      {/* Химийн бодисын үндэсний бүртгэлийн индикатортай НЭГ ХЭВ (хэрэглэгч 2026-11-09):
          тусдаа карт, шошго дээр голлосон, доор нь тэмдэг + тоо зэрэгцэнэ. */}
      {/* Баганын өргөн ШОШГЫН ХЭМЖСЭН өргөний харьцаагаар (276 · 239 · 303 · 203px, 10px
          eyebrow) — тэнцүү хуваахад "Нэг жилийн дотор дуусах зөвшөөрөл" хоёр мөр болж
          тоонууд зөрж байв (химийн бүртгэлийн 1.35fr-тай нэг арга). */}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-[1.36fr_1.18fr_1.5fr_1fr]" aria-label="Өгөгдлийн тойм">
        <Stat icon={FileCheck2} label="Аюултай хог хаягдлын зөвшөөрөл" value={hazard ? num(permitsS.length) : "…"} />
        <Stat icon={CalendarClock} label="Хугацаа хүчинтэй зөвшөөрөл" value={hazard ? num(stats.valid) : "…"} />
        <Stat
          icon={CalendarX2}
          label="Нэг жилийн дотор дуусах зөвшөөрөл"
          value={hazard ? num(stats.soon) : "…"}
          tone={stats.soon > 0 ? "var(--ochre)" : undefined}
        />
        <Stat icon={Trash2} label="Энгийн хог хаягдлын цэг" value={common ? num(sitesS.length) : "…"} />
      </div>

      <Columns id="hyanalt-waste" left={340} right={330} className="min-h-0 flex-1 xl:grid-rows-[minmax(0,1fr)]">
        {/* ---- ЗҮҮН: зөвшөөрлүүд дуусах огноогоор ---- */}
        <section className={cn("data-surface flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-paper-2 max-xl:max-h-[520px]", listStyles.panel)}>
          <header className={listStyles.header}>
            <h2><span aria-hidden style={{ background: HAZARD_HEX }} />Аюултай хог хаягдлын зөвшөөрөл</h2>
            <p><span><strong>{hazard ? num(permitsF.length) : "…"}</strong> зөвшөөрөл</span><span>Дуусах огноогоор</span></p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {failed.hazard ? (
              <Failed message={failed.hazard} />
            ) : !hazard ? (
              <Pending />
            ) : permitsF.length === 0 ? (
              <Waiting />
            ) : (
              <ol className={listStyles.list} aria-label="Зөвшөөрлүүд, дуусах огноогоор">
                {permitsF.map((r) => (
                  <PermitRow
                    key={r.uid}
                    rec={r}
                    today={today}
                    on={sel === r.uid}
                    hot={tip.oid === r.uid}
                    onPick={() => choose(r.uid)}
                  />
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* ---- ТӨВ: газрын зураг ---- */}
        <div className="relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-line max-xl:min-h-[420px]">
          {ready ? (
            <PointMap
              points={map.points}
              visible={visible}
              marks={map.marks}
              pickedMark={sel}
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
              { kind: "hazard", label: "Аюултай хог хаягдал", count: hazard ? permitsF.length : undefined },
              { kind: "common", label: "Энгийн хог хаягдал", count: common ? sitesF.length : undefined },
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
            style={{ filter: "drop-shadow(0 0 1.5px var(--paper)) drop-shadow(0 0 1.5px var(--paper))" }}
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
                count={common ? sitesF.length : undefined}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {failed.common ? (
                  <Failed message={failed.common} />
                ) : !common ? (
                  <Pending />
                ) : sitesF.length === 0 ? (
                  <Waiting />
                ) : (
                  <div className={siteStyles.list}>
                    {sitesF.map((r) => (
                      <SiteBlock
                        key={r.uid}
                        rec={r}
                        info={common.info}
                        on={sel === r.uid}
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
              <PanelHead dot={HAZARD_HEX} title="Аюултай хог хаягдлын зөвшөөрөл дүүргээр" />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {failed.hazard ? (
                  <Failed message={failed.hazard} />
                ) : !hazard ? (
                  <Pending />
                ) : (
                  <Districts
                    recs={permits}
                    today={today}
                    active={district}
                    onDistrict={pickDistrict}
                    onPick={choose}
                  />
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
              /* Дэвсгэр, иконы өнгө нь зураг дээрх тэмдэглэгээтэй НЭГ дүрмээр горимоо дагана (`.waste-swatch`, globals.css) */
              data-kind={it.kind}
              className={cn(
                "waste-swatch flex size-2.5 shrink-0 items-center justify-center border",
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
  /* Химийн бүртгэлийн `Cell`-тэй ижил: `eyebrow` шошго голдоо, 22px тэмдэг (`--tone`,
     анхааруулга бол `--ochre`) + 18px тоо. Гүн нь сүүдэр биш давхаргаар (`paper-2`). */
  return (
    <div className="flex flex-col items-center justify-center rounded-xs border border-line bg-paper-2 px-2 py-1.5">
      <div className="eyebrow text-center">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <Icon size={22} strokeWidth={1.4} className="shrink-0 text-(--tone)" style={tone ? { color: tone } : undefined} aria-hidden />
        <span className="num text-[18px] leading-none font-semibold text-ink" style={tone ? { color: tone } : undefined}>
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
      {/* Гарчиг ТОМ ҮСГЭЭР — диаграмын гарчгийн ерөнхий дүрэм (хэрэглэгч 2026-11-09: "Аюултай хог хаягдлын зөвшөөрөл uppercase") */}
      <h2 className="display min-w-0 flex-1 text-[12px] leading-snug tracking-[0.02em] uppercase">{title}</h2>
      {count != null ? <span className="num text-[11px] text-ink-3">{num(count)}</span> : null}
      {children}
    </div>
  );
}

function PermitRow({
  rec,
  today,
  on,
  hot,
  onPick,
}: {
  rec: Rec;
  today: number;
  on: boolean;
  hot: boolean;
  onPick: () => void;
}) {
  const tone = expiryTone(rec.expires, today);
  const progress = rec.issued != null && rec.expires != null && rec.expires > rec.issued
    ? Math.max(0, Math.min(100, ((today - rec.issued) / (rec.expires - rec.issued)) * 100))
    : null;
  const remaining = remainText(rec.expires, today);
  const Icon = /батарей|аккумлятор|цэнэг хураагуур/i.test(rec.name) ? BatteryCharging
    : /химийн|тэсрэх/i.test(rec.name) ? FlaskConical
    : /электроник/i.test(rec.name) ? Cpu
    : /дахивар|эрүүл мэнд/i.test(rec.name) ? Recycle
    : /үйлдвэр/i.test(rec.name) ? Factory : Recycle;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={on}
        className={cn(
          listStyles.row,
          on && listStyles.selected,
          hot && listStyles.hot,
        )}
      >
        <span className={listStyles.summary}>
          <span className={listStyles.icon} style={{ color: tone }} aria-hidden><Icon size={20} strokeWidth={1.7} /></span>
          <span className={listStyles.content}>
            <span className={listStyles.name} title={rec.name}>{rec.name}</span>
            <span className={listStyles.place}><MapPin size={10} aria-hidden />{rec.place || "Байршил тодорхойгүй"}</span>
          </span>
          <span className={listStyles.remaining} style={{ color: tone }}>
            {rec.expires != null ? <>
              <CalendarClock size={12} aria-hidden />
              <span><strong>{remaining.replace(/\s+үлдсэн$/, "")}</strong>{remaining.endsWith("үлдсэн") ? <span>үлдсэн</span> : null}</span>
            </> : <span><strong>Огноо</strong><span>тодорхойгүй</span></span>}
          </span>
        </span>
        <span className={listStyles.timeline}>
          <span className={listStyles.date} title={`Олгосон огноо: ${dateText(rec.issued)}`}><span className="sr-only">Олгосон: </span>{rec.issued != null ? dateText(rec.issued) : "—"}</span>
          {progress != null ? (
            <>
              <span className={listStyles.track} role="progressbar" aria-label="Зөвшөөрлийн хугацааны өнгөрсөн хувь" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} title={`${num(progress, 0)}% өнгөрсөн`}>
                <span style={{ width: `${progress}%`, background: tone }} />
              </span>
              <span className={listStyles.percent} aria-hidden>{num(progress, 0)}%</span>
            </>
          ) : <span className={listStyles.unknown}>Хугацаа тодорхойгүй</span>}
          <span className={listStyles.date} title={`Дуусах огноо: ${dateText(rec.expires)}`}><span className="sr-only">Дуусах: </span>{rec.expires != null ? dateText(rec.expires) : "—"}</span>
        </span>
      </button>
    </li>
  );
}

/* ---------------- Баруун самбарын агуулга ---------------- */

/**
 * Сонгоогүй үед — дүүрэг бүрийн зөвшөөрлүүд, нэрээрээ. Дүүргийн мөр
 * товшиход ДҮҮРГИЙН ШҮҮЛТ болно (зураг, жагсаалт, үзүүлэлт хумигдана);
 * дахин товшиход цуцлагдана. Өөрийн хэмжээсийг алгасна — бүх дүүрэг
 * харагдсаар байна.
 */
function Districts({
  recs,
  today,
  active,
  onDistrict,
  onPick,
}: {
  recs: Rec[];
  today: number;
  active: string | null;
  onDistrict: (key: string) => void;
  onPick: (uid: number) => void;
}) {
  const groups = React.useMemo(() => {
    const m = new Map<string, { label: string; list: Rec[] }>();
    for (const r of recs) {
      const g = m.get(r.dkey);
      if (g) g.list.push(r);
      else m.set(r.dkey, { label: r.dname || "Тодорхойгүй", list: [r] });
    }
    return [...m].sort(
      (a, b) =>
        b[1].list.length - a[1].list.length || a[1].label.localeCompare(b[1].label, "mn"),
    );
  }, [recs]);

  if (!groups.length) return <Waiting />;

  return (
    <div className="divide-y divide-line">
      {groups.map(([key, { label: district, list }]) => (
        <div
          key={key}
          className={cn(
            "relative px-3 py-3",
            active === key && "bg-data/6",
            active != null && active !== key && "opacity-55",
          )}
        >
          {active === key ? (
            <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-data" />
          ) : null}
          <button
            type="button"
            aria-pressed={active === key}
            onClick={() => onDistrict(key)}
            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-paper-hi focus-visible:outline-2 focus-visible:outline-data"
          >
            <span className="text-[12px] font-semibold text-ink">
              {key ? `${district.replace(/\s*дүүрэг$/i, "")} дүүрэг` : district}
            </span>
            <span className={cn(
              "shrink-0 rounded-md border px-2 py-1 text-[10.5px] leading-none",
              active === key ? "border-data/35 bg-data/10 text-ink" : "border-line bg-paper-3 text-ink-2",
            )}>
              <span className="num font-semibold">{num(list.length)}</span> зөвшөөрөл
            </span>
          </button>
          <ol aria-label={`${district} — зөвшөөрөлтэй төслүүд`} className="mt-2 divide-y divide-line rounded-lg border border-line bg-paper/40">
            {list.map((r, index) => (
              <li key={r.uid}>
                <button
                  type="button"
                  onClick={() => onPick(r.uid)}
                  className="flex w-full items-start gap-2 rounded-md px-2.5 py-2.5 text-left hover:bg-paper-hi focus-visible:outline-2 focus-visible:outline-data"
                >
                  <span aria-hidden className="num mt-px flex size-5 shrink-0 items-center justify-center rounded border border-line bg-paper-3 text-[10px] text-ink-3">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] leading-relaxed text-ink">{r.name}</span>
                    <span className="mt-1 block text-[10px] leading-snug text-ink-3">
                      {r.expires != null ? <>Дуусах: <span className="num">{dateText(r.expires)}</span></> : "Дуусах огноо тодорхойгүй"}
                    </span>
                    {r.expires != null ? (
                      <span className="mt-0.5 block text-[10px] leading-snug" style={{ color: expiryTone(r.expires, today) }}>
                        {remainText(r.expires, today)}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight size={13} aria-hidden className="mt-1 shrink-0 text-ink-3" />
                </button>
              </li>
            ))}
          </ol>
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
  const labelOf = (f: LayerInfo["fields"][number]) => f.alias.replace(/\s+/g, " ").trim();
  const company = info.fields.filter((f) => /аж ахуйн нэгж.*нэр|байгууллаг.*нэр/i.test(labelOf(f)));
  const location = info.fields.filter((f) =>
    /^(aimag|niislel|duureg|horoo|hayag)$/i.test(f.name) || /аймаг|нийслэл|сум|дүүрэг|хороо|хаяг/i.test(labelOf(f)),
  );
  const featured = new Set([...company, ...location].map((f) => f.name));
  const details = info.fields.filter((f) =>
    !featured.has(f.name) && !["tosol_ner", "zov_avsan", "zov_duusah", "zov_tolov"].includes(f.name.toLowerCase()),
  );
  const valueOf = (f: LayerInfo["fields"][number]) => {
    const raw = rec.row[f.name];
    if (raw == null || text(raw) === "") return "—";
    return f.type === "Date" ? dateText(dateOf(raw)) : text(raw);
  };
  const progress = rec.issued != null && rec.expires != null && rec.expires > rec.issued
    ? Math.max(0, Math.min(100, ((today - rec.issued) / (rec.expires - rec.issued)) * 100))
    : null;
  const validStatus = /^хүчинтэй$/i.test(rec.status.trim());
  const locationText = location.map(valueOf).filter((v) => v !== "—").join(", ") || rec.place;
  return (
    <div className={detailStyles.panel}>
      <header className={detailStyles.header}>
        <h2><span aria-hidden style={{ background: HAZARD_HEX }} />Зөвшөөрлийн дэлгэрэнгүй</h2>
        <button type="button" onClick={onClose} aria-label="Дүүргийн жагсаалт руу буцах">
          <ArrowLeft size={13} aria-hidden /> Буцах
        </button>
      </header>
      <div className={detailStyles.body}>
        <section className={detailStyles.card} aria-label="Төслийн мэдээлэл">
          <div className={detailStyles.project}>
            <span className={detailStyles.projectIcon} aria-hidden><Recycle size={25} strokeWidth={1.8} /></span>
            <div><p className={detailStyles.label}>Төслийн нэр</p><h3>{rec.name}</h3></div>
          </div>
          <div className={detailStyles.company}>
            <div className={detailStyles.companyNames}>
              {company.map((f) => <p key={f.name} title={labelOf(f)}><Building2 size={15} aria-hidden /><span>{valueOf(f)}</span></p>)}
              {company.length === 0 ? <p className={detailStyles.label}>Зөвшөөрлийн төлөв</p> : null}
            </div>
            <span className={cn(detailStyles.status, validStatus && detailStyles.valid)}>
              {validStatus ? <Check size={12} aria-hidden /> : null}{rec.status || "Төлөв тодорхойгүй"}
            </span>
          </div>
        </section>

        <section className={detailStyles.card} aria-labelledby="waste-permit-dates">
          <h3 id="waste-permit-dates" className={detailStyles.cardTitle}><CalendarClock size={16} aria-hidden />Хүчинтэй хугацаа</h3>
          <div className={detailStyles.dates}>
            <dl><dt>Олгосон огноо</dt><dd>{dateText(rec.issued)}</dd></dl>
            <dl><dt>Дуусах огноо</dt><dd>{dateText(rec.expires)}</dd></dl>
            <p className={detailStyles.remaining} style={{ color: tone }}><CalendarClock size={16} aria-hidden /><span>{remainText(rec.expires, today)}</span></p>
          </div>
          {progress != null ? (
            <div className={detailStyles.timeline}>
              <div role="progressbar" aria-label="Зөвшөөрлийн хугацааны өнгөрсөн хувь" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                <span style={{ width: `${progress}%`, background: tone }} />
              </div>
              <p><span>Эхэлсэн</span><strong>{num(progress, 0)}% өнгөрсөн</strong><span>Дуусах</span></p>
            </div>
          ) : null}
        </section>

        {details.length > 0 ? (
          <section className={detailStyles.card} aria-labelledby="waste-permit-info">
            <h3 id="waste-permit-info" className={detailStyles.cardTitle}><FileCheck2 size={16} aria-hidden />Зөвшөөрлийн мэдээлэл</h3>
            <dl className={detailStyles.fields}>
              {details.map((f) => <div key={f.name}><dt>{labelOf(f)}</dt><dd>{valueOf(f)}</dd></div>)}
            </dl>
          </section>
        ) : null}
        {location.length > 0 || locationText ? (
          <section className={detailStyles.card} aria-labelledby="waste-permit-location">
            <h3 id="waste-permit-location" className={detailStyles.cardTitle}><MapPin size={16} aria-hidden />Байршил</h3>
            <p className={detailStyles.location}><MapPin size={17} aria-hidden /><span>{locationText || "Байршил тодорхойгүй"}</span></p>
            {location.some((f) => valueOf(f) === "—") ? (
              <dl className={detailStyles.fields}>{location.filter((f) => valueOf(f) === "—").map((f) => <div key={f.name}><dt>{labelOf(f)}</dt><dd>—</dd></div>)}</dl>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
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
    <WasteSiteCard rec={rec} info={info} selected={on} onPick={onPick} />
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
