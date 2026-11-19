"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Building2,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  FlaskConical,
  Gauge,
  Loader2,
  MapPin,
  MousePointerClick,
  TriangleAlert,
  MapPinOff,
  type LucideIcon,
} from "lucide-react";
import { AreaChart, PieChart, RowChart, type Datum } from "@/components/charts";
import {
  CatalogGroup,
  CatalogName,
  CatalogRow,
  CatalogSearch,
  PlaceCard,
  PlaceRows,
} from "@/components/hyanalt/catalog-rows";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { MapPanel, useMapPanel } from "@/components/map/panel";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { Columns } from "@/components/ui/resizable-columns";
import { defaultBasemap, type Basemap, type Extent, type MapPoints } from "@/components/wells/map";

/* Цэг БАЙХГҮЙ — олон өнцөгт өөрөө өнгөтэй (хэрэглэгч 2026-11-19) */
const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);
import {
  ACTIVITY_GROUPS,
  ACTIVITY_GROUP_LABEL,
  RISK_LEVELS,
  fetchPlanned,
  riskOf,
  type PlannedData,
  type PlannedObject,
} from "@/lib/planned-inspections";
import { districtName } from "@/lib/repair-shops";
import { offDistricts, offText } from "@/lib/district-check";
import { OffDistrictLegend, mismatchPin, useUbDistricts } from "@/components/map/off-district";
import { Bounds } from "@/lib/extent";
import { cn, num } from "@/lib/utils";
import recordStyles from "./planned-record.module.css";
import { FIREFLY_CORE, FIREFLY_GLOW } from "@/lib/firefly";

const PointMap = dynamic(() => import("@/components/wells/map").then((m) => m.WellsMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-paper-3">
      <Loader2 size={16} className="animate-spin text-ink-3" />
    </div>
  ),
});

/* --------------------------------------------------------------------------
   Хяналт шалгалтын ТӨЛӨВЛӨГӨӨТ мэдээлэл — нэгж талбараар.

   "Химийн бодисын агуулах" самбартай НЭГ БҮТЭЦ (хэрэглэгч 2026-11-19:
   "Химийн бодисын агуулах db adilhan db"): шүүлтүүрийн мөр → зүүнд
   хайлттай жагсаалт, доор нь жижиг задаргаа · төвд дөрвөн үзүүлэлт ба
   газрын зураг · баруунд задаргаа. Ялгаа нь АГУУЛГАД: бодисын товьёогийн
   оронд ОБЪЕКТЫН жагсаалт (бодисын нэр энэ давхаргад байхгүй), цэгийн
   хэмжээний оронд ЭРСДЭЛИЙН ЗЭРГИЙН өнгө.

   Зураг: ЗӨВХӨН нэгж талбарын олон өнцөгт, эрсдэлийн зэргийн өнгөөр.
   ⚠ Төвд нь цэг ТАВИХГҮЙ (хэрэглэгч 2026-11-19: "polygon ungutei bhd point
   hereggui"). ⚠ Таван түвшний (хувийн 20%-ийн муж) өнгө ТУРШИГДААГҮЙ —
   хэрэглэгч гурван зэрэг зөв гэж шийдсэн ("5 bish 3 zuw"). Өнгө (Их улаан #e47b7b · Дунд шар #e5b75a · Бага ногоон #7fd994 · бүртгэгдээгүй цагаан; газрын зураг хоёр
   горимд ижил тул тогтмол hex).

   ЗУРАГ ДЭЭРХ СОНГОЛТ нь ШҮҮЛТ (бусад самбартай нэг дүрэм): диаграм,
   үзүүлэлт тэр объектоор хумигдана; шүүлтүүрийн цэс, жагсаалт хумигдахгүй.
   -------------------------------------------------------------------------- */

type Dim = "year" | "district" | "risk" | "chemical" | "water" | "land" | "agroup" | "activity";

const blank = (k: string) => k || "Бүртгэгдээгүй";
const districtLabel = (k: string) => (k ? districtName(k) : "Бүртгэгдээгүй");

export function PlannedDashboard() {
  const [data, setData] = React.useState<PlannedData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [year, setYear] = React.useState<number | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [risk, setRisk] = React.useState<string | null>(null);
  const [chemical, setChemical] = React.useState<string | null>(null);
  const [water, setWater] = React.useState<string | null>(null);
  const [land, setLand] = React.useState<string | null>(null);
  const [activity, setActivity] = React.useState<string | null>(null);
  /* Чиглэлийн БҮЛЭГ — товьёогийн бүлгийн мөр дарахад (бодисын товьёогтой нэг зан төлөв) */
  const [agroup, setAgroup] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const tip = useMapTip();

  React.useEffect(() => {
    const ac = new AbortController();
    fetchPlanned(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const rows = data?.rows;

  const reset = React.useCallback(() => {
    setYear(null);
    setDistrict(null);
    setRisk(null);
    setChemical(null);
    setWater(null);
    setLand(null);
    setActivity(null);
    setAgroup(null);
    setPicked(null);
  }, []);

  const keep = React.useCallback(
    (o: PlannedObject, ...skip: Dim[]) => {
      const off = (d: Dim) => skip.includes(d);
      if (!off("year") && year != null && o.year !== year) return false;
      if (!off("district") && district != null && o.district !== district) return false;
      if (!off("risk") && risk != null && o.risk !== risk) return false;
      if (!off("chemical") && chemical != null && o.chemical !== chemical) return false;
      if (!off("water") && water != null && o.water !== water) return false;
      if (!off("land") && land != null && o.landUse !== land) return false;
      if (!off("agroup") && agroup != null && o.activityGroup !== agroup) return false;
      if (!off("activity") && activity != null && o.activity !== activity) return false;
      return true;
    },
    [year, district, risk, chemical, water, land, agroup, activity],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((o) => keep(o)), [rows, keep]);

  const byOid = React.useMemo(() => {
    const m = new Map<number, PlannedObject>();
    for (const o of rows ?? []) m.set(o.oid, o);
    return m;
  }, [rows]);

  /* Сонголт шүүлтээс гарвал ДАМ цуцлагдана — эффектээр биш */
  const sel = React.useMemo(() => {
    const o = picked == null ? null : byOid.get(picked);
    return o && keep(o) ? o.oid : null;
  }, [picked, byOid, keep]);
  const has = React.useCallback((o: PlannedObject) => sel == null || o.oid === sel, [sel]);

  const filterCount =
    (year != null ? 1 : 0) +
    (district != null ? 1 : 0) +
    (risk != null ? 1 : 0) +
    (chemical != null ? 1 : 0) +
    (water != null ? 1 : 0) +
    (land != null ? 1 : 0) +
    (activity != null ? 1 : 0) +
    (agroup != null ? 1 : 0);
  const activeCount = filterCount + (sel != null ? 1 : 0);

  const picks = React.useMemo(
    () => (sel == null ? shown : shown.filter((o) => o.oid === sel)),
    [shown, sel],
  );

  /* ---------------- Үзүүлэлт ---------------- */

  const totals = React.useMemo(() => {
    let chem = 0;
    let high = 0;
    let lawSum = 0;
    let lawN = 0;
    for (const o of picks) {
      if (o.chemical === "Тийм") chem++;
      if (o.risk === "Их") high++;
      if (o.law != null) {
        lawSum += o.law;
        lawN++;
      }
    }
    return { chem, high, law: lawN ? lawSum / lawN : null };
  }, [picks]);

  /* ---------------- Задаргаа ----------------
     Диаграм нь сонголтоор хумигдана (`cut`), шүүлтүүрийн цэс үгүй (`all`) —
     цэс өөрийгөө хумивал сонголтоо солих арга үлдэхгүй. */
  const tally = React.useCallback(
    (dim: Dim, keyOf: (o: PlannedObject) => string, label: (k: string) => string = blank) => {
      const all = new Map<string, number>();
      const cut = new Map<string, number>();
      for (const o of rows ?? []) {
        if (!keep(o, dim)) continue;
        const k = keyOf(o);
        /* ДИАГРАМ, ШҮҮЛТҮҮРИЙН ЦЭСЭД "Бүртгэгдээгүй" мөр ГАРАХГҮЙ (хэрэглэгч 2026-11-19: "zuwhun
           chartuudaas hide" → "filtert … bas hide") — хулганы тайлбар, бүртгэлийн цонхонд хэвээр */
        if (!k) continue;
        all.set(k, (all.get(k) ?? 0) + 1);
        if (has(o)) cut.set(k, (cut.get(k) ?? 0) + 1);
      }
      /* "Бүртгэгдээгүй" нь тоо хэдий их байсан ч эцэст */
      const out = (m: Map<string, number>): Datum[] =>
        [...m]
          .map(([key, value]) => ({ key, label: label(key), value }))
          .sort((a, b) => (a.key === "" ? 1 : 0) - (b.key === "" ? 1 : 0) || b.value - a.value);
      return [out(cut), out(all)] as const;
    },
    [rows, keep, has],
  );

  const [byDistrict, districtMenu] = React.useMemo(
    () => tally("district", (o) => o.district, districtLabel),
    [tally],
  );
  /* Эрсдэл нь ЭРЭМБЭТЭЙ — тоогоор биш Их → Дунд → Бага дарааллаар */
  const [byRisk, riskMenu] = React.useMemo(() => {
    const [cut, all] = tally("risk", (o) => o.risk, (k) => riskOf(k).label);
    const order = (d: readonly Datum[]) =>
      RISK_LEVELS.map((r) => d.find((x) => x.key === r.id)).filter((x): x is Datum => Boolean(x));
    return [order(cut), order(all)] as const;
  }, [tally]);
  const [byChemical] = React.useMemo(() => tally("chemical", (o) => o.chemical), [tally]);
  const [byWater] = React.useMemo(() => tally("water", (o) => o.water), [tally]);
  const [byLand] = React.useMemo(() => tally("land", (o) => o.landUse), [tally]);
  const [, activityMenu] = React.useMemo(() => tally("activity", (o) => o.activity), [tally]);
  /* Он нь хугацааны дараалал — тоогоор биш оноор */
  /*
    ОНООР — талбайн диаграм (хэрэглэгч 2026-11-19: "Оноор area chart"; платформын "он сар бол
    area chart" дүрэм). Цуваа ТАСРАЛТГҮЙ: бүртгэлгүй он тэг. Он бүртгэгдээгүй объект орохгүй.
  */
  const byYear = React.useMemo<Datum[]>(() => {
    const m = new Map<number, number>();
    for (const o of rows ?? []) {
      if (o.year == null || !keep(o, "year") || !has(o)) continue;
      m.set(o.year, (m.get(o.year) ?? 0) + 1);
    }
    if (!m.size) return [];
    const lo = Math.min(...m.keys());
    const hi = Math.max(...m.keys());
    const out: Datum[] = [];
    for (let y = lo; y <= hi; y++) out.push({ key: String(y), label: String(y), value: m.get(y) ?? 0 });
    return out;
  }, [rows, keep, has]);

  /*
    ЧИГЛЭЛИЙН ТОВЬЁОГ — бодисын товьёогийн хоёр түвшин. Бүлгийн тоо нь бүлэг БА чиглэлийн шүүлтийг
    ХОЁУЛАНГ алгасна (сонгосны дараа ч бусад бүлэг үлдэнэ); чиглэлийн жагсаалт нь бүлгийн шүүлтийг
    дагана. "Бусад", "Бүртгэгдээгүй" нь эцэст.
  */
  const actGroups = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const o of rows ?? []) {
      if (!o.activityGroup || !keep(o, "agroup", "activity") || !has(o)) continue;
      m.set(o.activityGroup, (m.get(o.activityGroup) ?? 0) + 1);
    }
    const tail = (id: string) => (id === "other" || id === "" ? 1 : 0);
    return ACTIVITY_GROUPS.filter((g) => m.has(g.id))
      .map((g) => ({ id: g.id as string, label: g.label as string, n: m.get(g.id) ?? 0 }))
      .sort((a, b) => tail(a.id) - tail(b.id) || b.n - a.n);
  }, [rows, keep, has]);
  const actItems = React.useMemo(() => {
    const m = new Map<string, { group: string; n: number }>();
    for (const o of rows ?? []) {
      if (!o.activity || !keep(o, "activity") || !has(o)) continue;
      const k = o.activity;
      const cur = m.get(k);
      if (cur) cur.n++;
      else m.set(k, { group: o.activityGroup, n: 1 });
    }
    return [...m]
      .map(([name, v]) => ({ name, group: v.group, n: v.n }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "mn"));
  }, [rows, keep, has]);
  const pickAgroup = React.useCallback((id: string | null) => {
    setAgroup((g) => (g === id ? null : id));
    setActivity(null);
  }, []);
  const years = React.useMemo(
    () =>
      [...new Set((rows ?? []).map((o) => o.year).filter((y): y is number => y != null))].sort(
        (a, b) => a - b,
      ),
    [rows],
  );

  /* ---------------- Газрын зураг ---------------- */

  /*
    БҮРТГЭСЭН ДҮҮРГЭЭС ӨӨР ДҮҮРЭГТ БУУСАН нэгж талбар (2026-11-19, аудитаар 142-оос 15).
    Зураг дээр цэг БАЙХГҮЙ тул зөвхөн тэдгээрийн төвд тэмдэг (`marks`) — цэг нь тэмдгийн
    доор далдрагдана.
  */
  const bounds = useUbDistricts();
  const offDistrict = React.useMemo(() => offDistricts(bounds, rows ?? []), [bounds, rows]);
  const offPoints = React.useMemo<MapPoints>(() => {
    const list = shown.filter((o) => offDistrict.has(o.oid));
    return { oid: list.map((o) => o.oid), lon: list.map((o) => o.lon), lat: list.map((o) => o.lat) };
  }, [shown, offDistrict]);
  const offIndex = React.useMemo(() => Uint32Array.from(offPoints.oid, (_, i) => i), [offPoints]);
  const offMarks = React.useMemo(() => {
    const m: Record<number, string> = {};
    for (const o of offPoints.oid) m[o] = mismatchPin();
    return m;
  }, [offPoints]);

  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    const on = new Set(shown.map((o) => o.oid));
    return {
      type: "FeatureCollection",
      features: (data?.shapes.features ?? [])
        .filter((f) => on.has(Number(f.id)))
        .map((f) => ({
          ...f,
          properties: { oid: Number(f.id), c: riskOf(byOid.get(Number(f.id))?.risk ?? "").hex },
        })),
    };
  }, [data, shown, byOid]);

  /* Шүүлт тавибал үлдсэн бүхэн, объект сонговол тэр рүү ойртоно */
  const focus = React.useMemo<Extent | null>(() => {
    const list = sel != null ? picks : filterCount ? shown : [];
    if (!list.length) return null;
    const b = new Bounds();
    for (const o of list) b.add(o.lon, o.lat);
    return b.get(sel != null ? 0.004 : 0.008);
  }, [sel, picks, filterCount, shown]);

  const hovered = tip.oid == null ? null : (byOid.get(tip.oid) ?? null);
  const selected = sel == null ? null : (byOid.get(sel) ?? null);

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Төлөвлөгөөт мэдээлэл"
        activeCount={activeCount}
        onReset={reset}
        leading={
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-ink-3">Он</span>
            {[null, ...years].map((y) => (
              <button
                key={y ?? "all"}
                onClick={() => setYear(y)}
                className={cn(
                  "num rounded-xs border px-2 py-1 text-[12px] transition-colors",
                  y === year
                    ? "border-data/45 bg-data/12 font-medium text-ink"
                    : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                )}
              >
                {y ?? "Бүгд"}
              </button>
            ))}
          </div>
        }
      >
        <Menu label="Дүүрэг" icon={Building2} value={district} set={setDistrict} items={districtMenu} show={districtLabel} />
        <Menu
          label="Эрсдэлийн зэрэг"
          icon={TriangleAlert}
          value={risk}
          set={setRisk}
          items={riskMenu}
          show={(k) => riskOf(k).label}
          width={200}
        />
        {/* "Химийн бодис ашиглагдаг эсэх", "Усны эх үүсвэр", "Газрын зориулалт" цэс ХАСАГДСАН (хэрэглэгч
            2026-11-19: "del") — тэдгээрээр диаграмын мөр дарж шүүнэ */}
        <Menu
          label="Үйл ажиллагааны чиглэл"
          icon={Activity}
          value={activity}
          set={setActivity}
          items={activityMenu}
          width={300}
        />
      </FilterBar>

      <Columns id="planned" left={262} right={246} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: дүүрэг, объектын жагсаалт, доор нь химийн бодис ---- */}
        <div className="flex min-h-[240px] min-w-0 flex-col gap-2.5">
          {/* ДҮҮРГЭЭР — зүүн баганын ДЭЭД талд, үндэсний бүртгэлийн нам карт (хэрэглэгч 2026-11-19:
              "Хамрах хүрээ db duureg chart shig undriig bagasgaad zuun paneliin hamgiin deer") */}
          <PlaceCard
            title="Дүүргээр"
            rows={byDistrict.map((d) => [d.key, d.value, d.label] as [string, number, string])}
            show={byDistrict.length > 0}
            picked={district}
            onPick={(k) => setDistrict((d) => (d === k ? null : k))}
            bar={4}
            color="var(--data)"
          />
          {/* ОБЪЕКТЫН ЖАГСААЛТ · ҮЙЛ АЖИЛЛАГААНЫ ЧИГЛЭЛ — ДАВХАРЛАСАН (хэрэглэгч 2026-11-19: "Объектын
              жагсаалт deer Үйл ажиллагааны чиглэлээр dawharlah"); баруун баганаас хасагдсан. */}
          <SwitchCard
            fill
            views={[
              {
                title: "Объектын жагсаалт",
                meta: <span className="num">{num(shown.length)}</span>,
                flush: true,
                body: (
                  <ObjectList
                    items={shown}
                    selected={sel}
                    onPick={(oid) => setPicked((p) => (p === oid ? null : oid))}
                  />
                ),
              },
              {
                title: "Үйл ажиллагааны чиглэлээр",
                flush: true,
                body: (
                  <ActivityIndex
                    groups={actGroups}
                    items={actItems}
                    group={agroup}
                    selected={activity}
                    onGroup={pickAgroup}
                    onPick={setActivity}
                  />
                ),
              },
            ]}
          />
        </div>

        {/* ---- ТӨВ: үзүүлэлт + газрын зураг ---- */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <Cell icon={Building2} label="Объект" value={num(picks.length)} />
            <Cell icon={FlaskConical} label="Химийн бодис ашигладаг" value={num(totals.chem)} />
            <Cell
              icon={ClipboardCheck}
              label="Хууль сахин мөрдөлт"
              value={totals.law == null ? "—" : num(totals.law, 1)}
              unit={totals.law == null ? undefined : "% дундаж"}
            />
            <Cell icon={TriangleAlert} label="Эрсдэл их" value={num(totals.high)} alert={totals.high > 0} />
          </div>

          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-xs border border-line">
            {data ? (
              <PointMap
                credit="Суурь зураг: Esri · Дата: ArcGIS FeatureServer"
                points={offPoints.oid.length ? offPoints : NO_POINTS}
                visible={offPoints.oid.length ? offIndex : NO_INDEX}
                marks={offPoints.oid.length ? offMarks : undefined}
                shapes={{ data: shapes, selected: sel, edge: "thin" }}
                basemap={basemap}
                cluster={false}
                onSelect={(oid) => setPicked((p) => (p === oid ? null : oid))}
                onHover={tip.onHover}
                focus={focus}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-paper-3">
                <span className="flex items-center gap-2 text-[13px] text-ink-3">
                  <Loader2 size={14} className="animate-spin" />
                  Төлөвлөгөөт мэдээлэл татаж байна…
                </span>
              </div>
            )}

            <BasemapGallery value={basemap} onChange={setBasemap} />

            {/* Эрсдэлийн зэргийн тайлбар — БАРУУН доод буланд; зүүн доод нь масштаб, эх сурвалжийн мөрөнд */}
            <div
              className="pointer-events-none absolute right-2.5 bottom-2.5 z-10 rounded-xs border border-line bg-paper/10 px-2 py-1.5 backdrop-blur-md"
              style={{ filter: "drop-shadow(0 0 1.5px var(--paper)) drop-shadow(0 0 1.5px var(--paper))" }}
            >
              <div className="text-[10.5px] font-medium text-ink">Эрсдэл үүсэх магадлал</div>
              {/* Тайлбарт "Бүртгэгдээгүй" мөр ГАРАХГҮЙ (хэрэглэгч 2026-11-19) */}
              {RISK_LEVELS.filter((r) => r.id).map((r) => (
                <div key={r.id} className="mt-1 flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full" style={{ background: r.hex, boxShadow: "inset 0 0 0 1px rgba(8,14,20,.45)" }} aria-hidden />
                  <span className="text-[10.5px] text-ink">{r.label}</span>
                </div>
              ))}
              {offPoints.oid.length ? <OffDistrictLegend /> : null}
            </div>

            {hovered ? (
              <MapTip state={tip} width={250}>
                <div className="px-2.5 pt-2 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                  {hovered.name}
                </div>
                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  {hovered.activity ? <MapTipRow icon={Activity} text={hovered.activity} /> : null}
                  <MapTipRow
                    icon={Building2}
                    text={hovered.district ? districtName(hovered.district) : "Дүүрэг бүртгэгдээгүй"}
                  />
                  {offDistrict.has(hovered.oid) ? (
                    <MapTipRow icon={MapPinOff} text={offText(offDistrict.get(hovered.oid) ?? "")} />
                  ) : null}
                  <MapTipRow
                    icon={FlaskConical}
                    text={
                      hovered.chemical === "Тийм"
                        ? "Химийн бодис ашигладаг"
                        : hovered.chemical === "Үгүй"
                          ? "Химийн бодис ашигладаггүй"
                          : "Химийн бодисын мэдээлэл бүртгэгдээгүй"
                    }
                  />
                  {hovered.law != null ? (
                    <MapTipRow icon={Gauge} text={`Хууль сахин мөрдөлт ${num(hovered.law, 1)}%`} num />
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <RiskChip id={hovered.risk} />
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {selected ? (
              <RecordCard o={selected} off={offDistrict.get(selected.oid) ?? null} onClose={() => setPicked(null)} />
            ) : null}

          </div>
        </div>

        {/* ---- БАРУУН: задаргаа ---- */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto">
          {/* ЭРСДЭЛ · ХИМИЙН БОДИС — ДАВХАРЛАСАН ХОЁР БӨГЖ (хэрэглэгч 2026-11-19: хяналт шалгалтын
              "Бүртгэлийн төрлөөр" шиг ‹ 1 / 2 ›). Нуугдсан диаграмын шүүлт хадгалагдана. */}
          <SwitchCard
            views={[
              {
                title: "Эрсдэлийн зэргээр",
                body: (
                  <PieChart
                    data={byRisk}
                    size={100}
                    selected={risk}
                    onSelect={setRisk}
                    colorOf={(d) => riskOf(d.key).tone}
                    outlined
                    shares={false}
                  />
                ),
              },
              {
                title: "Химийн бодис ашиглагдаг эсэх",
                body: (
                  <PieChart
                    data={byChemical}
                    size={100}
                    selected={chemical}
                    onSelect={setChemical}
                    colorOf={yesNoColor}
                    outlined
                    shares={false}
                  />
                ),
              },
            ]}
          />
          {/* ОНООР · УСНЫ ЭХ ҮҮСВЭР — ДАВХАРЛАСАН (хэрэглэгч 2026-11-19: "Оноор door Усны эх үүсвэрээр
              dawharla") */}
          <SwitchCard
            sameHeight
            views={[
              {
                title: "Оноор",
                body: (
                  <AreaChart
                    data={byYear}
                    height={96}
                    unit="объект"
                    selected={year == null ? null : String(year)}
                    /* Бүртгэлгүй (тэг) он дээр дарвал шүүлт цуцлагдана — хоосон дэлгэц үлдээхгүй */
                    onSelect={(k) => {
                      const hit = byYear.find((d) => d.key === k);
                      setYear(k != null && hit && hit.value > 0 && Number(k) !== year ? Number(k) : null);
                    }}
                  />
                ),
              },
              {
                /* Дүүргийн карттай нэг хэв — нэр · зурвас · тоо нэг эгнээнд (хэрэглэгч 2026-11-19) */
                title: "Усны эх үүсвэрээр",
                flush: true,
                meta: water ? (
                  <button
                    onClick={() => setWater(null)}
                    className="text-[10px] text-(--tone) transition-colors hover:text-ink"
                  >
                    Цэвэрлэх
                  </button>
                ) : null,
                body: (
                  <PlaceRows
                    rows={byWater.map((d) => [d.key, d.value, d.label] as [string, number, string])}
                    picked={water}
                    onPick={(k) => setWater((w) => (w === k ? null : k))}
                    bar={4}
                    color="var(--data)"
                  />
                ),
              },
            ]}
          />
          {/* Хэлбэр, өндөр нь хэвээр (`RowChart dense clamp`); ЗУРВАСЫН ӨНГӨ, ЗУЗААН нь "Усны эх
              үүсвэрээр"-тэй ижил — "Оноор"-ын `--data`, 4px, бөөрөнхий (хэрэглэгч 2026-11-19: "line ungu urgung
              ijilhen bolgo") */}
          <Block title="Газрын зориулалтаар" note="объектын тоо">
            <div className="[&_.row-chart-track-inner]:h-[4px]! [&_.row-chart-track-inner]:rounded-full!">
              <RowChart
                data={byLand}
                selected={land}
                onSelect={setLand}
                format={num}
                tone="var(--data)"
                dense
                clamp
              />
            </div>
          </Block>
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Menu({
  label,
  icon,
  value,
  set,
  items,
  show = blank,
  width,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string | null;
  set: (v: string | null) => void;
  items: readonly Datum[];
  show?: (k: string) => string;
  width?: number;
}) {
  return (
    <FilterMenu
      label={label}
      icon={icon}
      active={value != null}
      value={value != null ? show(value) : null}
      onClear={() => set(null)}
      width={width}
    >
      <PickList
        items={items.map((d) => ({ key: d.key, label: d.label, value: d.value }))}
        selected={value}
        onPick={set}
      />
    </FilterMenu>
  );
}

/**
 * ҮЙЛ АЖИЛЛАГААНЫ ЧИГЛЭЛИЙН ТОВЬЁОГ — химийн агуулахын "Бодисын товьёог"-той нэг хэв
 * (хэрэглэгч 2026-11-19: "Бодисын товьёог shig"). Бүлгийн мөр дарахад тэр бүлэг шүүлт болж, доор нь
 * чиглэлүүдээ дэлгэнэ; хайлт идэвхтэй үед бүлэггүй хавтгай жагсаалт, мөр бүр бүлгээ хажуудаа бичнэ.
 */
function ActivityIndex({
  groups,
  items,
  group,
  selected,
  onGroup,
  onPick,
}: {
  groups: { id: string; label: string; n: number }[];
  items: { name: string; group: string; n: number }[];
  group: string | null;
  selected: string | null;
  onGroup: (id: string | null) => void;
  onPick: (name: string | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const found = query ? items.filter((i) => i.name.toLowerCase().includes(query)) : [];
  const names = new Map<string, number>();
  for (const i of items) names.set(i.group, (names.get(i.group) ?? 0) + 1);

  /* "Хамрах хүрээ"-ний "Бодисын товьёог"-той яг нэг хэв (хэрэглэгч 2026-11-19) */
  return (
    <div className="flex h-full min-h-0 flex-col">
      <CatalogSearch value={q} onChange={setQ} placeholder="Чиглэлийн нэр" />
      {query ? (
        found.length === 0 ? (
          <div className="hatch m-3 rounded-xs border border-dashed border-line-2 px-3 py-6 text-center text-[11.5px] text-ink-3">
            Тохирох бүртгэл олдсонгүй
          </div>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {found.map((i) => (
              <CatalogRow
                key={i.name}
                on={selected === i.name}
                onClick={() => onPick(selected === i.name ? null : i.name)}
                title={i.name}
                note={ACTIVITY_GROUP_LABEL.get(i.group)}
                value={num(i.n)}
                unit="объект"
              />
            ))}
          </ul>
        )
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto py-0.5">
          {groups.map((g) => (
            <CatalogGroup
              key={g.id}
              label={g.label}
              note={`${num(names.get(g.id) ?? 0)} чиглэл`}
              value={num(g.n)}
              unit="объект"
              open={group === g.id}
              onClick={() => onGroup(g.id)}
            >
              {items
                .filter((i) => i.group === g.id)
                .map((i) => (
                  <CatalogName
                    key={i.name}
                    on={selected === i.name}
                    onClick={() => onPick(selected === i.name ? null : i.name)}
                    name={i.name}
                    value={num(i.n)}
                    unit="объект"
                  />
                ))}
            </CatalogGroup>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Объектын жагсаалт — хайлттай, бүтэн өндрөөр гүйнэ (агуулахын товьёогийн хэв) */
function ObjectList({
  items,
  selected,
  onPick,
}: {
  items: PlannedObject[];
  selected: number | null;
  onPick: (oid: number) => void;
}) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const found = React.useMemo(
    () =>
      query
        ? items.filter((o) =>
            [o.name, o.activity, o.address, o.parcel, districtLabel(o.district)]
              .join(" ")
              .toLowerCase()
              .includes(query),
          )
        : items,
    [items, query],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-2 pt-2 pb-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Нэр, чиглэл, хаягаар хайх"
          className="h-7 w-full rounded-xs border border-line bg-paper px-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-line-2"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {found.length === 0 ? (
          <p className="py-4 text-center text-[11.5px] text-ink-3">Илэрц олдсонгүй</p>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {found.map((o) => {
              const on = selected === o.oid;
              return (
                <button
                  key={o.oid}
                  onClick={() => onPick(o.oid)}
                  title={o.name}
                  className={cn(
                    "relative flex w-full items-start gap-2 py-[6px] pr-2 pl-2.5 text-left transition-colors",
                    on ? "bg-paper-hi text-ink" : "text-ink-2 hover:bg-paper-hi hover:text-ink",
                  )}
                >
                  {on ? <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-data" /> : null}
                  <span
                    aria-hidden
                    className={recordStyles.listFirefly}
                    style={{ color: riskOf(o.risk).hex }}
                  >
                    <span className={recordStyles.fireflyGlow} style={{ maskImage: `url("${FIREFLY_GLOW}")` }} />
                    <span className={recordStyles.fireflyCore} style={{ backgroundImage: `url("${FIREFLY_CORE}")` }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[11.5px] leading-snug", on && "font-medium")}>
                      {o.name}
                    </span>
                    <span className="block truncate text-[10px] leading-snug text-ink-3">
                      {[o.activity, o.district ? districtName(o.district) : ""].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  {o.year != null ? <span className="num shrink-0 text-[10px] text-ink-3">{o.year}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ icon: Icon, label, value, unit, alert }: { icon: LucideIcon; label: string; value: string; unit?: string; alert?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xs border border-line bg-paper-2 px-2 py-1.5">
      <div className="eyebrow text-center">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <Icon size={22} strokeWidth={1.4} className={cn("shrink-0", alert ? "text-clay" : "text-(--tone)")} aria-hidden />
        <span className={cn("num text-[18px] leading-none font-semibold", alert ? "text-clay" : "text-ink")}>
          {value}
        </span>
        {unit ? <span className="text-[10.5px] text-ink-3">{unit}</span> : null}
      </div>
    </div>
  );
}

/** Тийм / үгүй утгын өнгө — бөгжний зүсэм ижил өнгөтэй бол ялгагдахгүй (хяналт шалгалттай нэг) */
const yesNoColor = (d: Datum) =>
  /^тийм/i.test(d.key) ? "var(--moss)" : /^үгүй/i.test(d.key) ? "var(--ochre)" : "var(--ink-3)";

/**
 * Давхарласан картууд — толгойд ‹ 1 / 2 › сэлгэгч (хяналт шалгалтын `SwitchCard`-ийн хэв).
 * `fill` — баганын үлдсэн өндрийг авна; `flush` харагдацын бие зайгүй, өөрөө гүйнэ (жагсаалт).
 */
function SwitchCard({
  views,
  fill = false,
  sameHeight = false,
}: {
  views: { title: string; meta?: React.ReactNode; flush?: boolean; body: React.ReactNode }[];
  fill?: boolean;
  /**
   * Бүх харагдац ЭХНИЙХийнхээ өндөртэй (хэрэглэгч 2026-11-19: "2 cardiin undur ijil … Оноор bolj") —
   * сэлгэхэд карт үсрэхгүй. Эхний харагдацын биеийг хэмжиж, бусдад тэр өндрийг тавина; урт бол дотроо гүйнэ.
   */
  sameHeight?: boolean;
}) {
  const [at, setAt] = React.useState(0);
  const view = views[at] ?? views[0];
  const n = views.length;
  const go = (step: number) => setAt((at + step + n) % n);
  const body = React.useRef<HTMLDivElement>(null);
  const [lock, setLock] = React.useState<number | null>(null);
  React.useEffect(() => {
    const el = body.current;
    if (!sameHeight || at !== 0 || !el) return;
    const ro = new ResizeObserver(() => setLock(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sameHeight, at]);
  const locked = sameHeight && at !== 0 && lock != null;
  return (
    <div
      className={cn(
        "rounded-xs border border-line bg-paper-2",
        fill ? "flex min-h-0 flex-1 flex-col" : "shrink-0",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="display min-w-0 text-[12.5px] leading-tight tracking-[0.06em] uppercase">
          {view.title}
        </h2>
        <span className="flex shrink-0 items-center gap-2 text-[10.5px] text-ink-3">
          {view.meta}
        {n > 1 ? (
          <span
            className="inline-flex shrink-0 items-center rounded-xs border border-line bg-paper p-px text-[10px] text-ink-3"
            role="group"
            aria-label="Диаграм сэлгэх"
          >
            <button
              type="button"
              aria-label="Өмнөх диаграм"
              title={views[(at - 1 + n) % n].title}
              onClick={() => go(-1)}
              className="grid size-[22px] place-items-center rounded-xs hover:bg-paper-hi hover:text-(--tone)"
            >
              <ChevronLeft size={12} aria-hidden />
            </button>
            <span className="num inline-flex min-w-[34px] justify-center gap-1 px-0.5 leading-none" aria-live="polite">
              <strong className="font-semibold text-ink">{at + 1}</strong>
              <span aria-hidden>/</span>
              <span>{n}</span>
            </span>
            <button
              type="button"
              aria-label="Дараагийн диаграм"
              title={views[(at + 1) % n].title}
              onClick={() => go(1)}
              className="grid size-[22px] place-items-center rounded-xs hover:bg-paper-hi hover:text-(--tone)"
            >
              <ChevronRight size={12} aria-hidden />
            </button>
          </span>
        ) : null}
        </span>
      </div>
      <div
        ref={body}
        className={cn(
          view.flush ? "min-h-0 overflow-hidden" : "p-3",
          fill && "min-h-0 flex-1",
          fill && !view.flush && "overflow-y-auto",
          locked && "overflow-y-auto [&>*]:max-h-none",
        )}
        style={locked ? { height: lock } : undefined}
      >
        {view.body}
      </div>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 rounded-xs border border-line bg-paper-2">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="display text-[12.5px] leading-none tracking-[0.06em] uppercase">{title}</h2>
        {note ? <span className="text-[10px] text-ink-3">{note}</span> : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function RiskChip({ id }: { id: string }) {
  const r = riskOf(id);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-xs px-1.5 py-[2px] text-[10px] leading-none"
      style={{ color: r.tone, background: `color-mix(in oklab, ${r.tone} 12%, transparent)` }}
    >
      {id === "Их" ? <TriangleAlert size={9} /> : null}
      {id ? `Эрсдэл ${r.label.toLowerCase()}` : "Эрсдэл бүртгэгдээгүй"}
    </span>
  );
}

/** Сонгосон объектын бүх талбар. Регистрийн дугаар ТАТАГДДАГГҮЙ тул энд ч байхгүй */
function RecordCard({ o, off, onClose }: { o: PlannedObject; off: string | null; onClose: () => void }) {
  const panel = useMapPanel("left");
  const missing = <span className={recordStyles.missing}>Бүртгээгүй</span>;
  const pct = (v: number | null) => (v == null ? missing : <span className="num">{num(v, 1)}<small>%</small></span>);
  return (
    <MapPanel
      state={panel}
      title="Объектын мэдээлэл"
      onClose={onClose}
      className={recordStyles.panel}
    >
      <div className={recordStyles.content}>
        <div className={recordStyles.identity}>
          <span className={recordStyles.objectIcon}><Building2 size={25} strokeWidth={1.5} aria-hidden="true" /></span>
          <div><h3>{o.name}</h3><RiskChip id={o.risk} /></div>
        </div>
        <dl className={recordStyles.highlights}>
          <div><dt>Он</dt><dd>{o.year == null ? missing : <span className="num">{o.year}</span>}</dd></div>
          <div><dt>Талбай</dt><dd>{o.ha == null ? missing : <span className="num">{num(o.ha, o.ha < 10 ? 2 : 1)}<small>га</small></span>}</dd></div>
        </dl>
        <section className={recordStyles.section} aria-label="Байршил">
          <h4><MapPin size={17} aria-hidden="true" />Байршил</h4>
          <dl className={recordStyles.fields}>
            <Field k="Дүүрэг" v={o.district ? districtName(o.district) : missing} />
            {off != null ? <Field k="Цэгийн байршил" v={<span className="text-water">{offText(off)}</span>} /> : null}
            <Field k="Хаяг" v={o.address || missing} />
            <Field k="Нэгж талбарын дугаар" v={o.parcel ? <ParcelCopy key={o.parcel} value={o.parcel} /> : missing} />
          </dl>
        </section>
        <section className={recordStyles.section} aria-label="Үйл ажиллагаа">
          <h4><BriefcaseBusiness size={17} aria-hidden="true" />Үйл ажиллагаа</h4>
          <dl className={recordStyles.activity}><div><dt>Чиглэл</dt><dd>{o.activity || missing}</dd></div></dl>
          <dl className={recordStyles.fields}>
            <Field k="Газрын зориулалт" v={o.landUse || missing} />
            <Field k="Усны эх үүсвэр" v={o.water || missing} />
            <Field k="Химийн бодис ашигладаг эсэх" v={o.chemical ? <span className={recordStyles.answer}>{o.chemical}</span> : missing} />
          </dl>
        </section>
        <section className={recordStyles.section} aria-label="Үнэлгээ">
          <h4><ClipboardCheck size={17} aria-hidden="true" />Үнэлгээ</h4>
          <dl className={recordStyles.fields}>
            <Field k="Хууль сахин мөрдөлт" v={pct(o.law)} />
            <Field k="Эрсдэл үүсэх магадлал" v={pct(o.riskPct)} />
          </dl>
        </section>
      </div>
    </MapPanel>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function ParcelCopy({ value }: { value: string }) {
  const [status, setStatus] = React.useState<"idle" | "copied" | "failed">("idle");
  React.useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setStatus("copied"); }
    catch { setStatus("failed"); }
  };
  return <span className={recordStyles.parcel}>
    <span className="num">{value}</span>
    <button type="button" onClick={copy} aria-label="Нэгж талбарын дугаар хуулах" title={status === "copied" ? "Хууллаа" : "Дугаар хуулах"}>
      {status === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
    <span role="status" className={recordStyles.copyStatus}>{status === "copied" ? "Хууллаа" : status === "failed" ? "Хуулж чадсангүй" : ""}</span>
  </span>;
}
