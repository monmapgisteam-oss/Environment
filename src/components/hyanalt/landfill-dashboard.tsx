"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Factory,
  Loader2,
  MapPin,
  MousePointerClick,
  Ruler,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { Columns } from "@/components/ui/resizable-columns";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { DATA_COLOR } from "@/components/wells/colors";
import { MapPanel, useMapPanel } from "@/components/map/panel";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import {
  DISPOSAL,
  LANDFILL,
  LAYERS,
  RISKS,
  RISK_CSS,
  RISK_HEX,
  SAFEGUARDS,
  displayName,
  grade,
  riskRank,
  type Disposal,
  type Landfill,
  type LayerId,
} from "@/lib/landfill";
import { cn, num } from "@/lib/utils";

const PointMap = dynamic(() => import("@/components/wells/map").then((m) => m.WellsMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-paper-3">
      <Loader2 size={16} className="animate-spin text-ink-3" />
    </div>
  ),
});

/**
 * Хоёр давхаргын мөр. `kind` нь ЯЛГАХ талбар — TypeScript түүгээр аль
 * давхаргын талбарууд боломжтойг тодорхойлно.
 */
type AnyRow = (Landfill & { kind: "landfill" }) | (Disposal & { kind: "disposal" });

/* --------------------------------------------------------------------------
   ДҮҮРГЭЛТИЙН ТҮВШИН

   Дүүргэлт нь 44-100 хувийн хооронд тасралтгүй хуваарилагдана. Тоог
   шууд ангилал болговол 25 цэгт 20 гаруй өөр утга гарч, диаграм нь бараг
   бүгд нэг нэгжийн урттай баганаас тогтоно. Тиймээс ШИЙДВЭРИЙН УТГА
   БҮХИЙ мужид хуваана: багтаамж дууссан, дуусах дөхсөн, анхаарах,
   хэвийн. Эрэмбэ нь яаралтайгаас эхэлнэ.
   -------------------------------------------------------------------------- */

const FILL_BANDS = [
  { id: "full", label: "Багтаамж дууссан", hint: "100 хувь", lo: 100, hi: Infinity },
  { id: "near", label: "Дуусах дөхсөн", hint: "90–99 хувь", lo: 90, hi: 100 },
  { id: "watch", label: "Анхаарах", hint: "75–89 хувь", lo: 75, hi: 90 },
  { id: "ok", label: "Хэвийн", hint: "75 хувиас доош", lo: -Infinity, hi: 75 },
] as const;

function fillBandOf(v: number | null) {
  if (v == null) return null;
  return FILL_BANDS.find((b) => v >= b.lo && v < b.hi)?.id ?? null;
}



/* --------------------------------------------------------------------------
   Устгал, боловсруулалт ба ландфилл

   ⚠ САНУУЛГА: датаны БҮХ МӨР ЗОХИОМОЛ ЖИШЭЭ — дэлгэрэнгүйг
   {@link ../../lib/landfill}-ийн толгойн блокоос. Дэлгэц дээр үүнийг
   ЯМАР Ч ХЭЛБЭРЭЭР тэмдэглэхгүй: интерфэйст тайлбар бичихгүй гэсэн
   дүрэмтэй нийцэхгүй. Байгууламжийн нэрийн угтварыг ч `displayName`
   нуудаг — түүхий утга дата дотроо хэвээр.

   ГОЛ АСУУЛТ: аль цэг ЮУГААР дутуу байна вэ. Хогийн цэг бүр инженерийн
   зургаан хамгаалалттай (доод хучилт, шүүрлийн ус, хийн хяналт, хашаа,
   жин хэмжих, ялган ангилах) бөгөөд бүгд ижил утгын жагсаалттай.

   Урьд нь мөр бүрийн ард зургаан ЦЭГ эгнүүлж, толгойд нь нэрийг нь
   хоёр үсгээр товчилж байсныг ХАСAB: хоёр үсгийн товчлол уншигдахгүй
   бөгөөд дэлгэц дээр товчлол гаргахгүй гэсэн дүрэм зөрчигдөж байв.
   Одоо гурван түвшинд харуулна:
     · жагсаалтын мөрөнд НЭГ ТОО ("2/6 хамгаалалт"),
     · баруун диаграмд аль хамгаалалт хэдэн цэгт дутуу байгаа нь
       БҮТЭН нэрээрээ,
     · дэлгэрэнгүйд зургаан хамгаалалт тус бүр эх утгаараа.

   ХОЁР ДАВХАРГА, ХОЁР БҮРДЭЛ. Устгалын байгууламжийн хамгаалалт нь
   чөлөөт бичвэр (10 мөрд 10 өөр утга) тул хамгаалалтын тоолол утгагүй —
   түүнд оронд нь код, хүчин чадал, эрсдэлийн үзүүлэлт гарна. Хоёр
   давхаргыг НЭГТГЭХГҮЙ: талбарууд нь давхцахгүй, Базелийн D/R код нь
   ландфиллд утгагүй. Шүүлтүүрийн мөрийн ГАРЧИГ нь идэвхтэй давхаргын
   нэрийг үүрдэг — хоёуланг нь бичвэл аль нь харагдаж байгаа нь
   тодорхойгүй болно.
   -------------------------------------------------------------------------- */

export function LandfillDashboard() {
  const [layer, setLayer] = React.useState<LayerId>("landfill");
  const [aimag, setAimag] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  /*
    Хамгаалалтын ХОЁР ЭСРЭГ шүүлт: `safeguard` нь ДУТУУ (шүүлтүүрийн
    мөрөнд, хяналтын ажилтны гол асуулт), `hasSafeguard` нь ХАНГАСАН
    (хамралтын диаграмд, зурвасын утгатай тохирно).

    Хоёулаа нэг талбарын эсрэг тал тул ЗЭРЭГ идэвхжвэл үр дүн үргэлж
    хоосон гарна — нэгийг нь тавихад нөгөө нь цэвэрлэгдэнэ.
  */
  const [safeguard, setSafeguard] = React.useState<string | null>(null);
  const [hasSafeguard, setHasSafeguard] = React.useState<string | null>(null);
  const [group, setGroup] = React.useState<string | null>(null);
  const [band, setBand] = React.useState<string | null>(null);
  const [risk, setRisk] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const tip = useMapTip();

  /*
    ХАРАГДАЦЫН ҮЙЛДЭЛ (ArcGIS Dashboard "map extent action") — газрын
    зургаас диаграм руу чиглэсэн шүүлт. Асаалттай үед зургийн одоогийн
    хүрээ нь жагсаалт, индикатор, диаграмуудыг шүүнэ.

    ЦЭГҮҮД ӨӨРСДӨӨ ШҮҮГДЭХГҮЙ: хүрээнээс гадуурх цэг ямар ч байсан
    харагдахгүй тул шүүх нь утгагүй, буцаж холдоход цэг алдагдана.
  */
  const [extentOn, setExtentOn] = React.useState(false);
  const [extent, setExtent] = React.useState<Extent | null>(null);

  const isLandfill = layer === "landfill";

  const pickLacking = React.useCallback((k: string | null) => {
    setSafeguard(k);
    if (k) setHasSafeguard(null);
  }, []);

  const pickHaving = React.useCallback((k: string | null) => {
    setHasSafeguard(k);
    if (k) setSafeguard(null);
  }, []);

  const pickLayer = React.useCallback((id: LayerId) => {
    setLayer(id);
    setAimag(null);
    setStatus(null);
    setSafeguard(null);
    setHasSafeguard(null);
    setGroup(null);
    setBand(null);
    setRisk(null);
    setExtentOn(false);
    setPicked(null);
  }, []);

  const rows = React.useMemo<AnyRow[]>(
    () =>
      isLandfill
        ? LANDFILL.map((r) => ({ ...r, kind: "landfill" as const }))
        : DISPOSAL.map((r) => ({ ...r, kind: "disposal" as const })),
    [isLandfill],
  );

  type Dim =
    | "aimag"
    | "status"
    | "safeguard"
    | "hasSafeguard"
    | "group"
    | "band"
    | "risk";

  /**
   * `group` нь давхаргаас хамаарч өөр хэмжигдэхүүн: ландфиллд ангилал,
   * устгалд байгууламжийн төрөл. Хоёулаа "энэ юу вэ" гэсэн нэг асуултын
   * хариу тул нэг шүүлтүүрээр явуулна.
   */
  const groupOf = React.useCallback(
    (r: AnyRow) => (r.kind === "landfill" ? r.klass : r.facType),
    [],
  );

  const keep = React.useCallback(
    (r: AnyRow, skip?: Dim) => {
      if (skip !== "aimag" && aimag && r.aimag !== aimag) return false;
      if (skip !== "status" && status && r.status !== status) return false;
      if (skip !== "group" && group && groupOf(r) !== group) return false;
      if (skip !== "band" && band) {
        if (r.kind !== "landfill" || fillBandOf(r.fill) !== band) return false;
      }
      if (skip !== "risk" && risk) {
        if (r.kind !== "disposal" || r.risk !== risk) return false;
      }
      /*
        Хамгаалалтын шүүлт нь "ЭНЭ хамгаалалт ДУТУУ" гэсэн утгатай —
        хяналтын ажилтан байгааг нь биш дутууг нь хайдаг.
      */
      if (skip !== "safeguard" && safeguard) {
        if (r.kind !== "landfill") return false;
        if (grade(String(r[safeguard as keyof Landfill] ?? "")) === "full") return false;
      }
      if (skip !== "hasSafeguard" && hasSafeguard) {
        if (r.kind !== "landfill") return false;
        if (grade(String(r[hasSafeguard as keyof Landfill] ?? "")) !== "full") return false;
      }
      return true;
    },
    [aimag, status, group, band, risk, safeguard, hasSafeguard, groupOf],
  );

  /**
   * Зургийн харагдах хүрээнд багтсан эсэх. Харагдацын үйлдэл унтарсан
   * бол бүх мөр багтана.
   */
  const inExtent = React.useCallback(
    (r: AnyRow) => {
      if (!extentOn || !extent) return true;
      if (r.lon == null || r.lat == null) return false;
      const [w, s2, e, n] = extent;
      if (r.lat < s2 || r.lat > n) return false;
      /* Хүрээ 180°-ын шугам давсан бол w > e болно */
      if (e - w >= 360) return true;
      return w <= e ? r.lon >= w && r.lon <= e : r.lon >= w || r.lon <= e;
    },
    [extentOn, extent],
  );

  /** Диаграм, жагсаалт, индикаторын мөрүүд — хүрээний шүүлт ОРНО */
  const shown = React.useMemo(
    () => rows.filter((r) => keep(r) && inExtent(r)),
    [rows, keep, inExtent],
  );

  /** Газрын зургийн цэгүүд — хүрээний шүүлт ОРОХГҮЙ (дээрх тайлбарыг үз) */
  const mapKept = React.useMemo(() => rows.filter((r) => keep(r)), [rows, keep]);
  const activeCount =
    (aimag ? 1 : 0) +
    (status ? 1 : 0) +
    (safeguard ? 1 : 0) +
    (hasSafeguard ? 1 : 0) +
    (group ? 1 : 0) +
    (band ? 1 : 0) +
    (risk ? 1 : 0) +
    (extentOn ? 1 : 0);

  const reset = React.useCallback(() => {
    setAimag(null);
    setStatus(null);
    setSafeguard(null);
    setHasSafeguard(null);
    setGroup(null);
    setBand(null);
    setRisk(null);
    setExtentOn(false);
  }, []);

  /* ---------------- Задаргаа ---------------- */

  const byAimag = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (keep(r, "aimag") && inExtent(r)) m.set(r.aimag, (m.get(r.aimag) ?? 0) + 1);
    return [...m]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "mn"));
  }, [rows, keep, inExtent]);

  const byStatus = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows)
      if (keep(r, "status") && inExtent(r)) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return [...m]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep, inExtent]);

  const byGroup = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!keep(r, "group") && inExtent(r)) continue;
      const g = groupOf(r);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return [...m]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep, inExtent, groupOf]);

  /** Хамгаалалт бүрд ДУТУУ байгаа цэгийн тоо — шүүлтүүрийн цэсэнд */
  const bySafeguard = React.useMemo<Datum[]>(() => {
    if (!isLandfill) return [];
    return SAFEGUARDS.map((sg) => ({
      key: sg.id,
      label: sg.label,
      value: rows.filter(
        (r) =>
          keep(r, "safeguard") && inExtent(r) &&
          r.kind === "landfill" &&
          grade(String(r[sg.id as keyof Landfill] ?? "")) !== "full",
      ).length,
    }));
  }, [isLandfill, rows, keep, inExtent]);

  /*
    ХАМРАЛТ — хамгаалалт бүрийг ХАНГАСАН цэгийн тоо.

    Диаграмд ДУТУУГИЙН тоог биш хангасныг харуулна: урт зурвас нь "сайн"
    гэж уншигдах ёстой. Дутуугийн тоог харуулбал урт зурвас нь муу
    гэсэн эсрэг утгатай болж, хажуугийнхаа диаграмуудтай зөрчилдөнө.
    Дутуугаар нь ШҮҮХ шаардлага нь шүүлтүүрийн мөрөнд үлдсэн.

    Зурвасын хуваарь нь ХАРАГДАЖ БУЙ нийт цэгээр тогтоно (`max`) — эс
    тэгвээс хамгийн их хамрагдсан хамгаалалт үргэлж бүтэн зурвас болж,
    "бүгд хангасан" мэт харагдана.
  */
  const coverage = React.useMemo<Datum[]>(() => {
    if (!isLandfill) return [];
    const base = rows.filter((r) => keep(r, "hasSafeguard") && inExtent(r));
    return SAFEGUARDS.map((sg) => ({
      key: sg.id,
      label: sg.label,
      value: base.filter(
        (r) =>
          r.kind === "landfill" &&
          grade(String(r[sg.id as keyof Landfill] ?? "")) === "full",
      ).length,
    })).sort((a, b) => b.value - a.value);
  }, [isLandfill, rows, keep, inExtent]);

  /** Хамралтын зурвасын хуваарь — өөрийнхөө шүүлтийг алгассан нийт */
  const coverageBase = React.useMemo(
    () => rows.filter((r) => keep(r, "hasSafeguard") && inExtent(r)).length,
    [rows, keep, inExtent],
  );

  /** Дүүргэлтийн түвшин — тасралтгүй хувийг шийдвэрийн мужид хуваасан */
  const byBand = React.useMemo<Datum[]>(() => {
    if (!isLandfill) return [];
    return FILL_BANDS.map((b) => ({
      key: b.id,
      label: b.label,
      value: rows.filter(
        (r) => keep(r, "band") && inExtent(r) && r.kind === "landfill" && fillBandOf(r.fill) === b.id,
      ).length,
    })).filter((d) => d.value > 0);
  }, [isLandfill, rows, keep, inExtent]);

  const byRisk = React.useMemo<Datum[]>(() => {
    if (isLandfill) return [];
    return RISKS.map((v) => ({
      key: v,
      label: v,
      value: rows.filter((r) => keep(r, "risk") && inExtent(r) && r.kind === "disposal" && r.risk === v)
        .length,
    })).filter((d) => d.value > 0);
  }, [isLandfill, rows, keep, inExtent]);

  /* ---------------- Индикатор ---------------- */

  const totals = React.useMemo(() => {
    let ha = 0;
    let capacity = 0;
    let population = 0;
    let alert = 0;
    for (const r of shown) {
      ha += r.ha ?? 0;
      capacity += r.capacity ?? 0;
      if (r.kind === "landfill") {
        population += r.population ?? 0;
        /* Дүүргэлт 90%-иас дээш нь багтаамж дуусах дөхсөн гэсэн үг */
        if ((r.fill ?? 0) >= 90) alert++;
      } else if (r.risk === "Өндөр") alert++;
    }
    return { ha, capacity, population, alert };
  }, [shown]);

  /* ---------------- Газрын зураг ---------------- */

  const points = React.useMemo<MapPoints>(() => {
    const oid: number[] = [];
    const lon: number[] = [];
    const lat: number[] = [];
    for (const r of rows) {
      if (r.lon == null || r.lat == null) continue;
      oid.push(r.id);
      lon.push(r.lon);
      lat.push(r.lat);
    }
    return { oid, lon, lat };
  }, [rows]);

  /*
    Харагдах цэгүүд нь `mapKept` дээр тогтоно — ХҮРЭЭНИЙ шүүлтгүйгээр.
    `shown`-ыг хэрэглэвэл ойртох бүрд гадна талын цэгүүд эх сурвалжаас
    хасагдаж, буцаж холдоход дахин гарч ирэхгүй.
  */
  const visible = React.useMemo(() => {
    if (mapKept.length === rows.length) {
      return Uint32Array.from(points.oid.map((_, i) => i));
    }
    const on = new Set(mapKept.map((r) => r.id));
    const out: number[] = [];
    points.oid.forEach((o, i) => on.has(o) && out.push(i));
    return Uint32Array.from(out);
  }, [mapKept, rows, points]);

  /*
    ЦЭГИЙН ДҮРСЛЭЛ нь давхаргаас хамаарч ХОЁР ӨӨР.

    Устгалын байгууламж — ӨНГӨ нь ЭРСДЭЛИЙН ЗЭРЭГ. Зэрэг нь эрэмбэтэй
    хэмжүүр тул шатлалт өнгө зөв (хөрсний PLI-тэй ижил зарчим). Хэмжээ
    нь мөн зэргийг давхар хэлнэ — өнгө ялгах чадвар султай хүнд зураг
    уншигдахуйц байх ёстой. `firefly` тавихГҮЙ: гэрэлтэх горим нь
    шатлалын ӨНГИЙГ АШИГЛАДАГГҮЙ, зөвхөн нэг өнгөт шатлалд зориулагдсан.

    Ландфилл — өнгө нь ганц `--data`, ХЭМЖЭЭ нь талбай. Квадрат
    язгуураар: талбай 4-өөс 120 га хүртэл 30 дахин зөрдөг тул шугаман
    хуваарь дээр жижиг цэгүүд алга болно.
  */
  const grades = React.useMemo(() => {
    if (!isLandfill) {
      const byIdRisk = new Map(rows.map((r) => [r.id, r.kind === "disposal" ? r.risk : ""]));
      return {
        values: Float32Array.from(points.oid, (o) => riskRank(byIdRisk.get(o) ?? "")),
        stops: [
          [1, RISK_HEX["Бага"]],
          [2, RISK_HEX["Дунд"]],
          [3, RISK_HEX["Өндөр"]],
        ] as [number, string][],
      };
    }
    const byIdHa = new Map(rows.map((r) => [r.id, r.ha ?? 0]));
    const values = Float32Array.from(points.oid, (o) => Math.sqrt(byIdHa.get(o) ?? 0));
    let hi = 0;
    for (const v of values) if (v > hi) hi = v;
    return {
      values,
      stops: [
        [0, DATA_COLOR],
        [Math.max(hi, 1), DATA_COLOR],
      ] as [number, string][],
      firefly: true,
    };
  }, [isLandfill, points, rows]);

  /*
    Шүүлтүүр тавихад зураг сонголт руугаа ойртоно.

    ГАНЦ үл хамаарах зүйл нь ХАРАГДАЦЫН үйлдэл: тэр нь зургийн хүрээг
    шүүлтүүр болгодог тул ойртолт нь хүрээг өөрчилж, хүрээ нь шүүлтийг
    өөрчилж — эцэс төгсгөлгүй эргэлдэнэ.
  */
  const focus = React.useMemo<Extent | null>(() => {
    if (extentOn || !activeCount || !mapKept.length) return null;
    const b = new Bounds();
    for (const r of mapKept) if (r.lon != null && r.lat != null) b.add(r.lon, r.lat);
    return b.get(0.05);
  }, [extentOn, activeCount, mapKept]);

  const byId = React.useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  /*
    РАДАР ЦОХИЛТ. Цэг цөөн (10 ба 25) бөгөөд тархалт биш ОБЬЕКТ
    заадаг — тэлэх цагираг нь тэднийг суурь зурагнаас салгаж, хаана
    ямар байгууламж байгааг нэг харцаар хэлнэ.

    Өнгө нь цэгийн давхаргынхтай ЯГ ИЖИЛ эх сурвалжаас: устгал дээр
    эрсдэлийн зэрэг, ландфилл дээр дата өнгө. Хоёр өөр өнгө барьвал нэг
    цэг хоёр утга зааж байгаа мэт болно.
  */
  const pulseColor = React.useCallback(
    (oid: number) => {
      const r = byId.get(oid);
      return r?.kind === "disposal" ? RISK_HEX[r.risk] : undefined;
    },
    [byId],
  );
  const hovered = tip.oid == null ? null : (byId.get(tip.oid) ?? null);
  const selected = picked == null ? null : (byId.get(picked) ?? null);

  const highlight = React.useMemo<[number, number] | null>(
    () =>
      hovered && hovered.lon != null && hovered.lat != null
        ? [hovered.lon, hovered.lat]
        : null,
    [hovered],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        /* Гарчиг нь ИДЭВХТЭЙ давхаргынхаа нэрийг үүрнэ — хоёуланг нь
           бичвэл аль нь харагдаж байгаа нь тодорхойгүй болно */
        title={LAYERS.find((l) => l.id === layer)?.label ?? ""}
        activeCount={activeCount}
        onReset={reset}
        leading={
          /* Хоёр давхарга нь өөр талбартай тул шүүлтүүр БИШ, эх
             сурвалжийн сонголт — гарчгийн хажууд сууна */
          <div className="flex items-center gap-1">
            {LAYERS.map((l) => (
              <button
                key={l.id}
                onClick={() => pickLayer(l.id)}
                title={l.note}
                className={cn(
                  "rounded-xs border px-2 py-1 text-[12px] transition-colors",
                  l.id === layer
                    ? "border-data/45 bg-data/12 font-medium text-ink"
                    : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        }
      >
        <FilterMenu
          label="Аймаг, нийслэл"
          icon={Building2}
          active={aimag != null}
          value={aimag}
          onClear={() => setAimag(null)}
        >
          <PickList items={byAimag} selected={aimag} onPick={setAimag} searchable />
        </FilterMenu>

        {/* Ганц утгатай талбар шүүлтүүр болохгүй: ландфиллийн ангилал
            25 мөрд бүгд ижил тул цэс нь нэг мөртэй хоосон сонголт болно */}
        {byGroup.length > 1 ? (
          <FilterMenu
            label={isLandfill ? "Ангилал" : "Байгууламжийн төрөл"}
            icon={Factory}
            active={group != null}
            value={group}
            onClear={() => setGroup(null)}
          >
            <PickList items={byGroup} selected={group} onPick={setGroup} />
          </FilterMenu>
        ) : null}

        <FilterMenu
          label="Төлөв"
          icon={Trash2}
          active={status != null}
          value={status}
          onClear={() => setStatus(null)}
          width={224}
        >
          <PickList items={byStatus} selected={status} onPick={setStatus} />
        </FilterMenu>

        {isLandfill ? (
          <FilterMenu
            label="Дутуу хамгаалалт"
            icon={ShieldAlert}
            active={safeguard != null}
            value={
              safeguard ? (SAFEGUARDS.find((s) => s.id === safeguard)?.label ?? null) : null
            }
            onClear={() => setSafeguard(null)}
          >
            <PickList
              items={bySafeguard.filter((d) => d.value > 0)}
              selected={safeguard}
              onPick={pickLacking}
            />
          </FilterMenu>
        ) : null}
      </FilterBar>

      <Columns id="landfill" left={318} right={262} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: хамгаалалтын матриц ---- */}
        <div className="flex min-h-[240px] min-w-0 flex-col rounded-xs border border-line bg-paper-2">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
            <h2 className="display text-[13px] leading-none tracking-[0.06em] uppercase">
              {isLandfill ? "Инженерийн хамгаалалт" : "Байгууламж"}
            </h2>
            <span className="num text-[10.5px] text-ink-3">{num(shown.length)}</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {shown.length === 0 ? (
              <p className="px-3 py-6 text-center text-[11.5px] text-ink-3">
                Мэдээлэл олдсонгүй
              </p>
            ) : (
              <div className="divide-y divide-line">
                {shown.map((r) => (
                  <FacilityRow
                    key={r.id}
                    row={r}
                    on={picked === r.id}
                    onPick={() => setPicked((p) => (p === r.id ? null : r.id))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- ТӨВ: индикатор + газрын зураг ---- */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <div className="grid shrink-0 grid-cols-2 divide-x divide-line rounded-xs border border-line bg-paper-2 sm:grid-cols-4">
            <Cell
              label={isLandfill ? "Хогийн цэг" : "Байгууламж"}
              value={num(shown.length)}
              note={
                shown.length === rows.length
                  ? "бүртгэгдсэн нийт"
                  : `нийт ${num(rows.length)}`
              }
            />
            <Cell label="Нийт талбай" value={num(totals.ha, 1)} unit="га" />
            {isLandfill ? (
              <Cell
                label="Үйлчлэх хүн ам"
                value={num(totals.population)}
                note="хамрагдсан хүн"
              />
            ) : (
              <Cell label="Хүчин чадал" value={num(totals.capacity)} unit="тн/жил" />
            )}
            <Cell
              label={isLandfill ? "Дүүргэлт 90 хувиас дээш" : "Өндөр эрсдэлтэй"}
              value={num(totals.alert)}
              note={isLandfill ? "багтаамж дуусах дөхсөн" : "байгууламж"}
              alert={totals.alert > 0}
            />
          </div>

          <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-xs border border-line">
            <PointMap
              key={layer}
              points={points}
              visible={visible}
              basemap={basemap}
              cluster={false}
              grades={grades}
              pulse
              pulseColor={pulseColor}
              onSelect={(oid) => setPicked((p) => (p === oid ? null : oid))}
              onHover={tip.onHover}
              highlight={highlight}
              extent={extentOn}
              onExtent={setExtent}
              focus={focus}
            />

            <BasemapGallery
              value={basemap}
              onChange={setBasemap}
              placement="top-left"
              extent={extentOn}
              onExtentChange={setExtentOn}
              unit={isLandfill ? "хогийн цэг" : "байгууламж"}
            />

            {/* Харагдацын үйлдэл асаалттай үед хүрээг тэмдэглэнэ —
                шүүлтүүр далд ажиллаж байгааг мэдрүүлэх зорилготой */}
            {extentOn ? (
              <div className="pointer-events-none absolute inset-0 z-10 border border-data/45" />
            ) : null}

            {hovered ? (
              <MapTip state={tip} width={248}>
                <div className="px-2.5 pt-2 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                  {displayName(hovered.name)}
                </div>
                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  <MapTipRow icon={MapPin} text={hovered.place} />
                  <MapTipRow
                    icon={Ruler}
                    text={
                      hovered.ha == null
                        ? "Талбай бүртгэгдээгүй"
                        : `${num(hovered.ha, 1)} га`
                    }
                    num
                  />
                  {hovered.kind === "landfill" ? (
                    <MapTipRow
                      icon={Trash2}
                      text={
                        hovered.fill == null
                          ? "Дүүргэлт бүртгэгдээгүй"
                          : `Дүүргэлт ${num(hovered.fill)} хувь`
                      }
                      num
                    />
                  ) : (
                    <MapTipRow icon={ShieldAlert} text={`Эрсдэл — ${hovered.risk}`} />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <span className="text-[10px] leading-none text-ink-3">
                    {hovered.status}
                  </span>
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {selected ? (
              <Detail row={selected} onClose={() => setPicked(null)} />
            ) : null}

            <p
              className="pointer-events-none absolute bottom-1 left-2.5 z-10 text-[10px] leading-none text-ink-3"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
            >
              Суурь зураг: Esri
            </p>
          </div>
        </div>

        {/*
          ---- БАРУУН: задаргаа ----

          Дата ЖИЖИГ (25 ба 10 мөр) бөгөөд ангиллын талбарууд нь өндөр
          олон янз (22 аймаг, 13 он). Тэднийг диаграм болговол бараг бүх
          зурвас нэг нэгжийн урттай гарч, юу ч хэлэхгүй. Тиймээс энд
          ЗӨВХӨН цөөн, эрэмбэтэй утгатай хэмжигдэхүүн үлдэв: дүүргэлтийн
          түвшин, хамгаалалтын хамралт, эрсдэлийн зэрэг, байгууламжийн
          төрөл. Аймаг, он зэрэг нарийн задаргаа нь шүүлтүүрийн мөрөнд
          хайлттай жагсаалт хэвээр — тэнд урт жагсаалт саад биш.
        */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto">
          {isLandfill ? (
            <>
              <Block title="Дүүргэлтийн түвшнээр" note="хогийн цэгийн тоо">
                <RowChart
                  data={byBand}
                  selected={band}
                  onSelect={setBand}
                  format={num}
                />
              </Block>

              <Block
                title="Хамгаалалтын хамралт"
                note={`хангасан цэг · нийт ${num(coverageBase)}`}
              >
                {/* Хуваарь нь нийт цэгээр — зурвасын урт нь хувь хэмжээг
                    заана. Товшиход тэр хамгаалалтыг ХАНГАСАН цэгүүдээр
                    шүүнэ: зурвас юуг хэмжиж байна, товшилт мөн түүнийг
                    шүүнэ. Дутуугаар нь шүүх нь шүүлтүүрийн мөрөнд. */}
                <RowChart
                  data={coverage}
                  max={Math.max(coverageBase, 1)}
                  tone="var(--moss)"
                  selected={hasSafeguard}
                  onSelect={pickHaving}
                  format={num}
                />
              </Block>
            </>
          ) : (
            <>
              <Block title="Эрсдэлийн зэргээр" note="байгууламжийн тоо">
                {/* Мөрийн өнгө нь газрын зургийн цэгийнхтэй ЯГ ИЖИЛ —
                    диаграм нь зургийн тайлбарын үүргийг давхар гүйцэтгэнэ */}
                <RowChart
                  data={byRisk}
                  colorOf={(d) => RISK_CSS[d.key] ?? "var(--data)"}
                  selected={risk}
                  onSelect={setRisk}
                  format={num}
                />
              </Block>

              <Block title="Байгууламжийн төрлөөр" note="байгууламжийн тоо">
                <RowChart
                  data={byGroup}
                  selected={group}
                  onSelect={setGroup}
                  format={num}
                />
              </Block>
            </>
          )}
        </div>
      </Columns>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ЖАГСААЛТЫН МӨР

   Ландфиллд мөрийн ард зургаан хамгаалалтын цэг эгнэнэ — жагсаалт нь
   ингэснээр МАТРИЦ болно. Устгалд хамгаалалт нь чөлөөт бичвэр тул
   оронд нь эрсдэл, хүчин чадал гарна.
   -------------------------------------------------------------------------- */

/**
 * Хогийн цэг зургаан хамгаалалтаас хэдийг нь БҮРЭН хангасан бэ.
 *
 * Урьд нь мөрийн ард зургаан цэг эгнүүлж, толгойд нь нэрийг нь хоёр
 * үсгээр товчилж байсныг ХАСAB: хоёр үсгийн товчлол уншигдахгүй бөгөөд
 * дэлгэц дээр товчлол гаргахгүй гэсэн дүрэм зөрчигдөж байв. Нэг тоо
 * ("2/6") нь ижил зүйлийг хэлээд уншигдана; аль нь дутуу байгааг
 * дэлгэрэнгүйгээс бүтэн нэрээр нь харна.
 */
function safeguardScore(row: Landfill) {
  let full = 0;
  for (const sg of SAFEGUARDS) {
    if (grade(String(row[sg.id as keyof Landfill] ?? "")) === "full") full++;
  }
  return full;
}

function FacilityRow({
  row,
  on,
  onPick,
}: {
  row: AnyRow;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className={cn(
        "relative block w-full px-3 py-2 text-left transition-colors",
        on ? "bg-data/10" : "hover:bg-paper-hi",
      )}
    >
      {on ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-data" />
      ) : null}

      <div
        className="truncate text-[11.5px] leading-snug text-ink"
        title={displayName(row.name)}
      >
        {displayName(row.name)}
      </div>

      <div className="mt-1 truncate text-[10px] leading-none text-ink-3">
        {row.kind === "landfill"
          ? `${row.aimag} · ${row.soum}`
          : `${row.facType} · ${row.aimag}`}
      </div>

      {row.kind === "landfill" ? (
        <div className="mt-1.5 flex items-center gap-2">
          <FillMeter value={row.fill} />
          <SafeguardScore full={safeguardScore(row)} />
        </div>
      ) : (
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="num min-w-0 flex-1 truncate text-[10px] text-ink-2">
            {row.capacity == null ? "Хүчин чадал бүртгэгдээгүй" : `${num(row.capacity)} тн/жил`}
          </span>
          <RiskDot risk={row.risk} />
        </div>
      )}
    </button>
  );
}

/**
 * Хангасан хамгаалалтын тоо. Өнгө нь хэдийг хангасныг хэлнэ: бүгдийг
 * хангасан нь `--moss`, хагасаас доош нь `--clay`.
 */
function SafeguardScore({ full }: { full: number }) {
  const total = SAFEGUARDS.length;
  const tone =
    full === total
      ? "var(--moss)"
      : full * 2 >= total
        ? "var(--ochre)"
        : "var(--clay)";
  return (
    <span className="flex shrink-0 items-baseline gap-1">
      <span className="num text-[10.5px] leading-none" style={{ color: tone }}>
        {full}/{total}
      </span>
      <span className="text-[10px] leading-none text-ink-3">хамгаалалт</span>
    </span>
  );
}

/** Эрсдэлийн зэрэг — өнгө нь диаграм, газрын зурагтай нэг эх сурвалжаас */
function RiskDot({ risk }: { risk: string }) {
  return (
    <span
      className="shrink-0 text-[10px] leading-none"
      style={{ color: RISK_CSS[risk] ?? "var(--ink-3)" }}
    >
      {risk}
    </span>
  );
}

/** Дүүргэлтийн хувь — 90%-иас дээш нь анхааруулгын өнгөтэй */
function FillMeter({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="min-w-0 flex-1 text-[10px] text-ink-3">
        Дүүргэлт бүртгэгдээгүй
      </span>
    );
  }
  const tone = value >= 90 ? "var(--clay)" : value >= 75 ? "var(--ochre)" : "var(--data)";
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="shrink-0 text-[10px] leading-none text-ink-3">Дүүргэлт</span>
      <span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-[1px] bg-paper-hi">
        <span
          className="block h-full"
          style={{ width: `${Math.min(value, 100)}%`, background: tone }}
        />
      </span>
      <span className="num shrink-0 text-[10px] leading-none" style={{ color: tone }}>
        {num(value)} хувь
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/** Сонгосон бичлэг — зургийн баруун дээд буланд хөвнө */
function Detail({ row, onClose }: { row: AnyRow; onClose: () => void }) {
  const panel = useMapPanel("left");
  return (
    <MapPanel
      state={panel}
      title="Бүртгэлийн бичилт"
      onClose={onClose}
      className="top-2 right-2 bottom-8 w-[284px]"
    >

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        <div className="text-[12px] leading-snug font-medium text-ink">
          {displayName(row.name)}
        </div>
        <dl className="mt-2 space-y-1.5">
          <Field k="Байршил" v={row.place} />
          <Field k="Аймаг, сум" v={`${row.aimag} · ${row.soum}`} />
          <Field k="Төлөв" v={row.status} />
          <Field k="Талбайн хэмжээ" v={row.ha == null ? "—" : `${num(row.ha, 1)} га`} />
          {row.kind === "landfill" ? (
            <>
              <Field k="Ангилал" v={row.klass} />
              <Field
                k="Багтаамж"
                v={row.capacity == null ? "—" : `${num(row.capacity)} мянган м³`}
              />
              <Field
                k="Дүүргэлт"
                v={row.fill == null ? "—" : `${num(row.fill)} хувь`}
              />
              <Field
                k="Ашиглалт"
                v={
                  row.year == null
                    ? "—"
                    : `${row.year}${row.endYear ? ` – ${row.endYear}` : ""} он`
                }
              />
              <Field
                k="Үйлчлэх хүн ам"
                v={row.population == null ? "—" : num(row.population)}
              />
              {SAFEGUARDS.map((sg) => (
                <Field
                  key={sg.id}
                  k={sg.label}
                  v={String(row[sg.id as keyof Landfill] ?? "—")}
                />
              ))}
            </>
          ) : (
            <>
              <Field k="Байгууламжийн төрөл" v={row.facType} />
              <Field k="Үйл ажиллагааны код" v={`${row.code} — ${row.codeNote}`} />
              <Field k="Хүлээн авах хаягдал" v={row.accepts} />
              <Field
                k="Хүчин чадал"
                v={row.capacity == null ? "—" : `${num(row.capacity)} тн/жил`}
              />
              <Field
                k="Хуримтлагдсан"
                v={row.accumulated == null ? "—" : `${num(row.accumulated)} тн`}
              />
              <Field k="Инженерийн хамгаалалт" v={row.protection} />
              <Field k="Эрсдэлийн зэрэг" v={row.risk} />
              <Field k="Эзэмшигч, оператор" v={row.operator} />
              <Field
                k="Хамгаалалтын бүс"
                v={row.buffer == null ? "—" : `${num(row.buffer)} м`}
              />
              <Field k="Сүүлд шалгасан огноо" v={row.lastInspection || "—"} />
            </>
          )}
          <Field k="Хяналтын цооног" v={row.wells == null ? "—" : num(row.wells)} />
          <Field
            k="Суурьшлаас зай"
            v={row.distanceKm == null ? "—" : `${num(row.distanceKm, 1)} км`}
          />
          <Field k="Мэдээллийн эх сурвалж" v={row.source} />
        </dl>
      </div>
    </MapPanel>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[104px] shrink-0 text-[10px] leading-snug tracking-[0.06em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11px] leading-snug text-ink">{v}</dd>
    </div>
  );
}

function Cell({
  label,
  value,
  unit,
  note,
  alert,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  alert?: boolean;
}) {
  return (
    <div className="px-3 py-2">
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className={cn(
            "num text-[19px] leading-none font-medium",
            alert ? "text-ochre" : "text-ink",
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-[10.5px] text-ink-3">{unit}</span> : null}
      </div>
      {note ? <div className="mt-1 truncate text-[10px] text-ink-3">{note}</div> : null}
    </div>
  );
}

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shrink-0 rounded-xs border border-line bg-paper-2">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="display text-[12.5px] leading-none tracking-[0.06em] uppercase">
          {title}
        </h2>
        {note ? <span className="text-[10px] text-ink-3">{note}</span> : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
