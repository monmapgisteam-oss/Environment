"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Layers3,
  LandPlot,
  Loader2,
  MapPin,
  MousePointerClick,
  Ruler,
  Waypoints,
  X,
} from "lucide-react";
import {
  type Datum,
} from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { OverlayControl } from "@/components/map/overlay-control";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { Columns } from "@/components/ui/resizable-columns";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapOverlay,
  type MapPoints,
  zoomForScale,
} from "@/components/wells/map";
import { fetchEcoCorridors, type EcoData } from "@/lib/eco-corridors";
import { Bounds } from "@/lib/extent";
import { spreadRamp } from "@/lib/tone-ramp";
import { cn, num } from "@/lib/utils";
import { SheetBars, SheetSection, SheetStats, catMeta } from "./sheet";
import { MapLegend } from "./map-legend";

const PolygonMap = dynamic(
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

/** Цэгэн давхарга хэрэглэхгүй — энэ самбар зөвхөн хүрээ харуулна */
const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

/**
 * Коридор ба нэгж талбар НЭГ эх сурвалжид зэрэгцэх тул дугаар нь
 * мөргөлдөхгүй байх ёстой. Нэгж талбарын дугаарыг энэ хэмжээгээр
 * шилжүүлнэ — коридор 1..3, нэгж талбар 1,000,001-ээс дээш.
 */
/*
  Давхцсан нэгж талбарын өнгө — платформын суурь нэгж талбарын цайвар саарал
  (`#c3cad3`, ногоон бүсийн сонголт). Тогтмол hex — газрын зураг хоёр горимд
  ижил. ⚠ Буцаагдсан (хэрэглэгч 2026-10-23): cyan (коридорын cyan-номин
  шатлалд уусч байв), шар `#e5b75a` ("шар биш").
  ДҮҮРГЭЛТГҮЙ, нарийн хүрээтэй (`hollow`) — коридор, хиймэл дагуул харагдсаар.
*/
const PARCEL_COLOR = "#c3cad3";
const PARCEL_HOLLOW = [PARCEL_COLOR];
/*
  Нэгж талбар ЗӨВХӨН 1:30 000-аас ойртоход зурагдана ("ойртохоор л харагдана",
  хэрэглэгч 2026-10-23) — ногоон бүсийн давхцсан нэгж талбарын хязгаартай нэг.
  Холоос 1,022 жижиг дүрс коридорыг бүрхэж зөвхөн шуугиан болдог. Тоо,
  диаграм нь ойртолтоос ҮЛ ХАМААРНА; сонгосон нэгж талбар үргэлж харагдана.
*/
const PARCEL_NEAR = zoomForScale(30_000);

const PARCEL_BASE = 1_000_000;

/**
 * Экологийн коридорын самбар.
 *
 * Коридор нь ердөө ГУРВАН талбай — өөрөө диаграм зохиох хэмжээний дата
 * биш. Гэвч тэдгээр нь ТӨЛӨВЛӨЖ буй бүс тул гол асуулт нь "хэдэн га вэ"
 * биш **"дотор нь юу байна вэ"**: коридорын хилд 1,022 нэгж талбар
 * давхцаж байна.
 *
 * Тиймээс самбар нь хоёр давхаргатай: коридор (том хүрээ, өнгөтэй) ба
 * түүнд давхцсан нэгж талбарууд (жижиг хүрээ, ганц өнгө). Баруун талын
 * задаргаа нь тэдгээр талбарын ЗОРИУЛАЛТЫГ ангилна — төлөвлөлтөд юуг
 * зохицуулах шаардлагатайг тэр л хэлнэ.
 *
 * Нэгж талбарыг зориулалтаар нь өнгөөр ялгахгүй: 18 төрөл байгаа тул
 * газрын зураг утгагүй солонго болно. Ялгаа нь баруун талын диаграмд,
 * газрын зураг нь тэр диаграмын шүүлтийг дагана.
 */
export function EcoDashboard() {
  const [data, setData] = React.useState<EcoData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [district, setDistrict] = React.useState<string | null>(null);
  const [zone, setZone] = React.useState<string | null>(null);
  const [landuse, setLanduse] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  /** Нэгж талбар зурагдах хэмжээнд ойртсон эсэх (`PARCEL_NEAR`) */
  const [near, setNear] = React.useState(false);
  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();
  /* Нэгж талбарын давхаргыг унтраах боломж: коридорын өөрийн хүрээ,
     хэлбэрийг цэвэрхэн харах шаардлага гардаг */
  const [showParcels, setShowParcels] = React.useState(true);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const [overlays, setOverlays] = React.useState<MapOverlay[]>([]);

  React.useEffect(() => {
    let alive = true;
    fetchEcoCorridors()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const rows = data?.rows;

  /* ---------------- Шүүлт ---------------- */
  /** Дүүрэг, бүсээр үлдсэн коридор — зориулалтын шүүлтээс ӨМНӨ */
  const baseCorridors = React.useMemo(
    () =>
      (rows ?? []).filter(
        (r) => (!district || r.district === district) && (!zone || r.zone === zone),
      ),
    [rows, district, zone],
  );

  const baseOn = React.useMemo(
    () => new Set(baseCorridors.map((r) => r.oid)),
    [baseCorridors],
  );

  /** Сонгосон зориулалттай нэгж талбартай коридорууд (дүүрэг, бүсээс үл хамаарна) */
  const landuseCorr = React.useMemo(() => {
    if (!landuse) return null;
    const out = new Set<number>();
    for (const p of data?.parcels ?? []) if (p.landuse === landuse) out.add(p.corridor);
    return out;
  }, [data, landuse]);

  /* Нэгж талбар нь ХАРЬЯА коридороороо ч шүүгдэнэ: дүүрэг сонгоход тэр
     дүүргийн коридорт байгаа талбарууд л үлдэнэ */
  const shownParcels = React.useMemo(
    () =>
      (data?.parcels ?? []).filter(
        (p) => baseOn.has(p.corridor) && (!landuse || p.landuse === landuse),
      ),
    [data, baseOn, landuse],
  );

  /*
    Зориулалт сонгосон үед тийм нэгж талбаргүй коридор ч үлдэхгүй —
    "Коридороор" диаграм, зураг, үзүүлэлт гурвуулаа нэг коридор харна.
  */
  const shownCorridors = React.useMemo(
    () =>
      landuseCorr ? baseCorridors.filter((r) => landuseCorr.has(r.oid)) : baseCorridors,
    [baseCorridors, landuseCorr],
  );

  const corridorOn = React.useMemo(
    () => new Set(shownCorridors.map((r) => r.oid)),
    [shownCorridors],
  );

  /*
    Зураг дээр сонгосон обьект нь ШҮҮЛТ. Коридор сонговол тэр коридор,
    нэгж талбар сонговол тэр талбар (ба түүний коридор) — диаграм,
    үзүүлэлт түүгээр хумигдана; зураг өөрөө хумигдахгүй. Шүүлтэд
    үлдээгүй сонголт хүчингүй (дам гарна).
  */
  const selParcel = React.useMemo(() => {
    if (picked == null || picked < PARCEL_BASE || !showParcels) return null;
    return shownParcels.find((p) => p.oid === picked - PARCEL_BASE) ?? null;
  }, [picked, showParcels, shownParcels]);
  const selCorridor = selParcel
    ? selParcel.corridor
    : picked != null && picked < PARCEL_BASE && corridorOn.has(picked)
      ? picked
      : null;
  const sel = selParcel || selCorridor != null ? picked : null;

  const keptCorridors = React.useMemo(
    () =>
      selCorridor == null
        ? shownCorridors
        : shownCorridors.filter((r) => r.oid === selCorridor),
    [shownCorridors, selCorridor],
  );
  const keptParcels = React.useMemo(
    () =>
      selParcel
        ? [selParcel]
        : selCorridor == null
          ? shownParcels
          : shownParcels.filter((p) => p.corridor === selCorridor),
    [shownParcels, selParcel, selCorridor],
  );

  /*
    Коридор бүрийн өнгө. Түлхүүр нь эх сурвалжийн эрэмбэ дэх байрлал
    (талбайгаар буурсан, өөрчлөгдөхгүй) тул шүүлтүүр солиход коридор
    өнгөө солихгүй.
  */
  const colorOf = React.useMemo(() => {
    const ramp = spreadRamp(rows?.length ?? 1);
    const m = new Map<number, string>();
    rows?.forEach((r, i) => m.set(r.oid, ramp[i]));
    return (oid: number) => m.get(oid) ?? ramp[0];
  }, [rows]);

  /*
    Газрын зургийн эх сурвалж — хоёр давхарга НЭГ цуглуулгад.

    Коридор нь ЭХЭНД (доор зурагдана), нэгж талбар нь дараа (дээр).
    Шошго (`t`) нь зөвхөн коридор дээр: 1,022 талбарын дугаарыг зэрэг
    бичвэл зураг уншигдахаа болино, талбарын дугаар нь товшсон үед
    тайлбар цонхонд гарна.
  */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    const zoneOf = new Map(data.rows.map((r) => [r.oid, r.zone]));
    const parcelOn = new Set(shownParcels.map((p) => p.oid));

    const corridors = data.shapes.features
      .filter((f) => corridorOn.has(Number(f.id)))
      .map((f) => {
        const oid = Number(f.id);
        return {
          ...f,
          properties: { oid, c: colorOf(oid), t: zoneOf.get(oid) ?? "" },
        };
      });

    const parcels = (showParcels ? data.parcelShapes.features : [])
      .filter(
        (f) => parcelOn.has(Number(f.id)) && (near || PARCEL_BASE + Number(f.id) === picked),
      )
      .map((f) => ({
        ...f,
        id: PARCEL_BASE + Number(f.id),
        /* Нэгж талбар ГАНЦ өнгөтэй — 18 зориулалтыг өнгөөр ялгавал
           газрын зураг утгагүй солонго болно */
        properties: { oid: PARCEL_BASE + Number(f.id), c: PARCEL_COLOR },
      }));

    return { type: "FeatureCollection", features: [...corridors, ...parcels] };
  }, [data, corridorOn, shownParcels, colorOf, showParcels, near, picked]);

  /* ---------------- Задаргаа ---------------- */
  const byDistrict = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (zone && r.zone !== zone) continue;
      if (landuseCorr && !landuseCorr.has(r.oid)) continue;
      m.set(r.district, (m.get(r.district) ?? 0) + r.ha);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, zone, landuseCorr]);

  const byZone = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (district && r.district !== district) continue;
      if (landuseCorr && !landuseCorr.has(r.oid)) continue;
      m.set(r.zone, (m.get(r.zone) ?? 0) + r.ha);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, district, landuseCorr]);

  /*
    Зориулалтын задаргаа — энэ самбарын ГОЛ диаграм.

    ТООГООР хэмжинэ, га-гаар БИШ: нэгж талбарын талбай нь коридортой
    давхцсан хэсгийнх биш бүтэн талбарынх тул га-гийн нийлбэр нь
    "коридорын дотор хэдэн га" гэсэн худал утга өгнө.
  */
  const landuseOf = React.useCallback(
    (withSel: boolean): Datum[] => {
      const m = new Map<string, number>();
      for (const p of data?.parcels ?? []) {
        /* Өөрийн хэмжээсийг (зориулалт) алгасна */
        if (!baseOn.has(p.corridor)) continue;
        if (withSel && selCorridor != null && p.corridor !== selCorridor) continue;
        if (withSel && selParcel && p.oid !== selParcel.oid) continue;
        m.set(p.landuse, (m.get(p.landuse) ?? 0) + 1);
      }
      return [...m]
        .map(([k, v]) => ({ key: k, label: k, value: v }))
        .sort((a, b) => b.value - a.value);
    },
    [data, baseOn, selCorridor, selParcel],
  );
  /* Диаграм сонголтыг дагана; цэс хумигдахгүй — өөр утга руу шилжих зам */
  const byLanduse = React.useMemo(() => landuseOf(true), [landuseOf]);
  const menuLanduse = React.useMemo(() => landuseOf(false), [landuseOf]);

  /*
    Эрхийн төрөл — БҮС ТУС БҮРЭЭР.

    Нийлбэрээр нь харуулбал "1,021 эзэмших, 1 ашиглах" гэсэн ганц мөр
    гарах бөгөөд аль коридорт хэдэн эзэмшигч байгаа нь харагдахгүй.
    Төлөвлөлтөд яг тэр задаргаа хэрэгтэй: коридор бүр өөрийн гэсэн
    эрх зүйн ачаалалтай.

    Бүсийг ЭХ ЭРЭМБЭЭР нь (талбайгаар буурсан) байрлуулна — тоогоор
    эрэмбэлбэл шүүлт солиход бүлгүүд байраа солино.
  */
  /*
    КОРИДОР ТУС БҮРИЙН НЭГЖ ТАЛБАР.

    ⚠⚠ Урьд нь энэ нь ЭРХИЙН ТӨРЛӨӨР бүлэглэсэн диаграм байв
    (`GroupedRowChart`) — гэвч 1,022 нэгж талбарын **1,021 нь
    "эзэмших"**, ердөө НЭГ нь "ашиглах". Гурван коридорын хоёрт нь
    хоёр дахь мөр огт байхгүй, гуравт нь 530-ын дэргэд 1 гэсэн
    үл үзэгдэх зураас гарна. Өөрөөр хэлбэл бүлэглэлт нь тайлбар,
    хоёр дахь өнгө нэмэхээс өөр юу ч хэлэхгүй байлаа (2026-09-17-нд
    хэмжсэн).

    Товшилтын зан төлөв ӨӨРЧЛӨГДӨӨГҮЙ: бүлгийн мөр нь өмнө ч
    коридорыг шүүдэг байсан — эрхийн төрөл нь хэзээ ч шүүлт
    байгаагүй. Тиймээс энгийн зурвас болгоход алдагдах харилцан
    үйлдэл алга.

    Эрхийн задаргаа нь картын толгойд ТООГООРОО үлдэнэ ({@link
    rightNote}) — баримт нь хэвээр, зөвхөн зурагдахаа больсон.

    ⚠ Дүүргээр тусдаа диаграм ГАРГАХГҮЙ: коридорын дүүрэг нь нэгж
    талбарынхтай ЯГ таарна (БЗД коридор → Баянзүрхийн 531, СХД хоёр
    коридор → Сонгинохайрханы 491) тул тэр нь энэ диаграмын ХУУЛБАР
    болно.
  */
  const byCorridor = React.useMemo<Datum[]>(() => {
    /* Өөрийнхөө хэмжигдэхүүнийг (бүс) АЛГАСЧ шүүнэ — эс тэгвээс нэг бүс
       сонгомогц бусад нь алга болж, өөр бүс рүү шилжих боломжгүй болно */
    const corridors = (rows ?? []).filter(
      (r) =>
        (!district || r.district === district) &&
        (selCorridor == null || r.oid === selCorridor),
    );
    const zoneOf = new Map(corridors.map((r) => [r.oid, r.zone]));

    const count = new Map<string, number>();
    for (const p of data?.parcels ?? []) {
      const z = zoneOf.get(p.corridor);
      if (!z) continue;
      if (landuse && p.landuse !== landuse) continue;
      if (selParcel && p.oid !== selParcel.oid) continue;
      count.set(z, (count.get(z) ?? 0) + 1);
    }

    return corridors
      .filter((c) => count.has(c.zone))
      .map((c) => ({ key: c.zone, label: c.zone, value: count.get(c.zone)! }));
  }, [data, rows, district, landuse, selCorridor, selParcel]);

  /**
   * Коридорын ТАЛБАЙ, га — диаграмын мөрд нэмэлт утга болж гарна.
   *
   * ⚠⚠ Зурвас нь ЗӨВХӨН нэгж талбарын ТООГ хэмжинэ. Га нь ӨӨР НЭГЖ
   * тул нэг хуваарьт оруулах боломжгүй — "ижил нэгжтэй хэмжилт л нэг
   * диаграмд харьцуулагдана" гэсэн дүрмээр бичвэр болж гарна.
   *
   * ⚠ Хоёр тоо ЭСРЭГ эрэмбэтэй байж болно: БЗД коридор нь талбайгаараа
   * хоёрдугаарт (5,926 га) ч НЭГЖ ТАЛБАРААРАА тэргүүлдэг (531). Яг
   * тэр зөрүү нь энэ самбарын гол мэдээлэл тул хоёуланг зэрэг
   * харуулах нь зайлшгүй.
   */
  const haOfZone = React.useMemo(
    () => new Map((rows ?? []).map((r) => [r.zone, r.ha])),
    [rows],
  );

  /** Эрхийн төрлийн задаргаа — картын толгойд нэг мөрөөр */
  const rightNote = React.useMemo(() => {
    const m = new Map<string, number>();
    /* Дүүрэг, бүс, зориулалт, сонголт бүгд үйлчилнэ */
    for (const p of keptParcels) m.set(p.right, (m.get(p.right) ?? 0) + 1);
    return [...m]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${num(v)} ${k}`)
      .join(" · ");
  }, [keptParcels]);

  const stats = React.useMemo(() => {
    const ha = keptCorridors.reduce((s, r) => s + r.ha, 0);
    return {
      n: keptCorridors.length,
      ha,
      parcels: keptParcels.length,
      landuses: new Set(keptParcels.map((p) => p.landuse)).size,
    };
  }, [keptCorridors, keptParcels]);

  /* ---------------- Сонголтын хүрээ (zoom action) ---------------- */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (sel == null && !district && !zone && !landuse) return null;
    const b = new Bounds();

    if (sel != null) {
      const src =
        sel >= PARCEL_BASE ? data.parcelShapes.features : data.shapes.features;
      const want = sel >= PARCEL_BASE ? sel - PARCEL_BASE : sel;
      const f = src.find((x) => Number(x.id) === want);
      b.addGeometry(f?.geometry);
      return b.get(0.0008);
    }

    /* Зориулалт сонгосон бол ТААРСАН ТАЛБАРУУД руу, эс бөгөөс коридор руу */
    if (landuse) {
      const on = new Set(shownParcels.map((p) => p.oid));
      for (const f of data.parcelShapes.features) {
        if (on.has(Number(f.id))) b.addGeometry(f.geometry);
      }
    } else {
      for (const f of data.shapes.features) {
        if (corridorOn.has(Number(f.id))) b.addGeometry(f.geometry);
      }
    }
    return b.get(0.004);
  }, [data, corridorOn, shownParcels, sel, district, zone, landuse]);

  /*
    Коридор ба нэгж талбар нь НЭГ дугаарын орон зайд шахагдсан
    (`PARCEL_BASE`-ээс дээш нь талбар) тул хоёуланг нь нэг л газар
    задална. Хулганы тайлбар ч, тогтмол самбар ч ижил дүрмээр уншина.
  */
  const resolve = React.useCallback(
    (id: number | null) => {
      if (id == null) return null;
      if (id >= PARCEL_BASE) {
        const p = data?.parcels.find((x) => x.oid === id - PARCEL_BASE);
        return p ? ({ kind: "parcel", p } as const) : null;
      }
      const c = rows?.find((r) => r.oid === id);
      return c ? ({ kind: "corridor", c } as const) : null;
    },
    [data, rows],
  );

  /** Хулгана дээр очсон зүйл — газрын зурагнаас */
  const hovered = React.useMemo(() => resolve(tip.oid), [resolve, tip.oid]);

  /**
   * ТОВШСОН обьект — hover-оос ҮЛ ХАМААРНА.
   *
   * Коридор ба нэгж талбар хоёр ӨӨР бичилт тул төрлийг нь хамт
   * барина: талбарууд нь огт давхцахгүй.
   */
  const chosen = React.useMemo(() => resolve(sel), [resolve, sel]);

  function reset() {
    setDistrict(null);
    setZone(null);
    setLanduse(null);
    setPicked(null);
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">Эх сурвалжийн мэдээллийг татаж чадсангүй</p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Коридор ба давхцаж буй нэгж талбар татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount =
    (district ? 1 : 0) + (zone ? 1 : 0) + (landuse ? 1 : 0) + (sel != null ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar title="Экологийн коридор" activeCount={activeCount} onReset={reset}>
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
            format={(v) => `${num(Math.round(v))} га`}
          />
        </FilterMenu>

        <FilterMenu
          label="Бүс"
          icon={Layers3}
          value={zone}
          active={Boolean(zone)}
          onClear={() => setZone(null)}
          width={200}
        >
          <PickList
            items={byZone}
            selected={zone}
            onPick={setZone}
            format={(v) => `${num(Math.round(v))} га`}
          />
        </FilterMenu>

        <FilterMenu
          label="Зориулалт"
          icon={LandPlot}
          value={landuse}
          active={Boolean(landuse)}
          onClear={() => setLanduse(null)}
          width={330}
        >
          <PickList
            items={menuLanduse}
            selected={landuse}
            onPick={setLanduse}
            searchable
          />
        </FilterMenu>
      </FilterBar>

      {/*
        ⚠⚠ КОРИДОРЫН ЖАГСААЛТ УСТГАГДСАН (хэрэглэгчийн шийдвэр,
        2026-09-17). Баруун баганад "Коридороор" диаграм нэмэгдсний
        дараа зүүн талын жагсаалт нь ижил гурван коридорыг ДАХИН
        нэрлэхээс өөр юу ч хэлэхгүй болов: хоёулаа нэр, тоо, эзлэх
        жинг харуулж, хоёулаа товшилтоор шүүдэг байв.

        ⚠ Коридор сонгох ГУРВАН зам ХЕВЭЭР: зураг дээрх хүрээг
        товших, баруун баганын "Коридороор" диаграм, шүүлтүүрийн
        мөрийн "Бүс" цэс.

        ⚠ ЗҮҮН БАГАНА БҮХЭЛДЭЭ АВАГДСАН — жагсаалтгүй болсон тул
        ганц индикаторын карт нарийн баганад үлдэж, доороо хоосон
        талбай үлдээх байв. Индикатор нь зургийн ДЭЭР бүтэн өргөнтэй
        зурвас болов (порталын самбартай ижил шийдэл).
      */}

      <Columns layout="flex" id="eco" right={300} className="min-h-0 flex-1">
        {/* ---- ГОЛ: газрын зураг ---- */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <Card className="relative min-h-[300px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              <PolygonMap
                points={NO_POINTS}
                visible={NO_INDEX}
                /* `glow` УНТРААЛТТАЙ: гэрэл нь цөөн том талбайд
                   зориулагдсан бөгөөд мянга гаруй жижиг нэгж талбар
                   дээр хоорондоо нийлж, зураг манантана */
                shapes={{ data: shapes, selected: sel, labelZoom: 9, hollow: PARCEL_HOLLOW }}
                basemap={basemap}
                onSelect={(oid) => setPicked(sel === oid ? null : oid)}
                onHover={tip.onHover}
                focus={focus}
                overlays={overlays}
                cluster={false}
                onZoom={(z) => setNear(z >= PARCEL_NEAR)}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />
              <OverlayControl value={overlays} onChange={setOverlays} />

              {/*
                Давхаргын тайлбар — зурган дээр ямар хоёр зүйл давхарлаж
                байгааг хэлж, нэгж талбарыг унтраах боломж өгнө.

                Хөвөгч гадаргуу тул `.elevated` сүүдэр зөвшөөрөгдөнө.
              */}
              <MapLegend
                groups={[
                  {
                    key: "corridor",
                    title: "Экологийн коридор",
                    items: shownCorridors.map((r) => ({
                      key: String(r.oid),
                      label: r.zone,
                      color: colorOf(r.oid),
                      shape: "area" as const,
                    })),
                  },
                  {
                    key: "parcel",
                    items: [
                      {
                        key: "parcel",
                        label: "Давхцсан нэгж талбар",
                        color: PARCEL_COLOR,
                        shape: "area" as const,
                        on: showParcels,
                        onToggle: () => setShowParcels((v) => !v),
                      },
                    ],
                  },
                ]}
              />

              {/*
                ХӨВӨГЧ ТАЙЛБАР. Хоёр өөр төрөл нэг зураг дээр байгаа тул
                тайлбарын дээд мөр нь ЮУ болохыг эхлээд хэлнэ — эс тэгвээс
                "12.4 га" гэдэг нь коридорынх уу, талбарынх уу мэдэгдэхгүй.
              */}
              {hovered ? (
                <MapTip state={tip} width={240}>
                  {hovered.kind === "corridor" ? (
                    <>
                      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1.5">
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: colorOf(hovered.c.oid) }}
                        />
                        <span className="min-w-0 flex-1 text-[12.5px] leading-snug font-medium text-ink">
                          {hovered.c.zone}
                        </span>
                      </div>
                      <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                        <MapTipRow
                          icon={Ruler}
                          num
                          text={`${num(Math.round(hovered.c.ha))} га`}
                        />
                        <MapTipRow icon={Waypoints} text={hovered.c.name} />
                        <MapTipRow
                          icon={MapPin}
                          text={`${hovered.c.district} дүүрэг`}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                        <span className="text-[10px] leading-none text-ink-3">
                          Экологийн коридор
                        </span>
                        <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-2.5 pt-2 pb-1.5 text-[12.5px] leading-snug font-medium text-ink">
                        {hovered.p.landuse}
                      </div>
                      <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                        <MapTipRow
                          icon={Ruler}
                          num
                          text={`${hovered.p.parcelId} · ${hovered.p.ha.toFixed(2)} га`}
                        />
                        <MapTipRow icon={LandPlot} text={`Эрх: ${hovered.p.right}`} />
                        <MapTipRow
                          icon={MapPin}
                          text={`${hovered.p.district}${
                            hovered.p.khoroo ? ` ${hovered.p.khoroo}` : ""
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                        <span className="text-[10px] leading-none text-ink-3">
                          Нэгж талбар
                        </span>
                        <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                      </div>
                    </>
                  )}
                </MapTip>
              ) : null}

              {/*
                ТОВШИЛТЫН ЦОНХ — hover картаас ТУСДАА.

                hover карт нь хулганы доорх зүйлийг хэлдэг тул хулгана
                хөдлөх бүрд солигдоно; энэ нь СОНГОСОН обьектоо барьж,
                хаах товчтой. Хоёрыг нэгтгэвэл сонголтоо тогтоосон
                хойноо агуулга нь мултарна.
              */}
              {chosen?.kind === "corridor" ? (
                <div className="elevated absolute right-2.5 bottom-2.5 z-10 w-[250px] rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow">Экологийн коридор</span>
                    <button
                      onClick={() => setPicked(null)}
                      aria-label="Хаах"
                      className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <dl className="space-y-1.5 px-2.5 py-2">
                    <PopField k="Бүс" v={chosen.c.zone} />
                    <PopField k="Нэр" v={chosen.c.name} />
                    <PopField k="Дүүрэг" v={chosen.c.district} />
                    <PopField k="Талбай" v={`${num(Math.round(chosen.c.ha))} га`} />
                  </dl>
                </div>
              ) : null}

              {/*
                ТОВШИЛТЫН ЦОНХ — hover картаас ТУСДАА.

                hover карт нь хулганы доорх зүйлийг хэлдэг тул хулгана
                хөдлөх бүрд солигдоно; энэ нь СОНГОСОН обьектоо барьж,
                хаах товчтой. Хоёрыг нэгтгэвэл сонголтоо тогтоосон
                хойноо агуулга нь мултарна.
              */}
              {chosen?.kind === "parcel" ? (
                <div className="elevated absolute right-2.5 bottom-2.5 z-10 w-[250px] rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow">Нэгж талбар</span>
                    <button
                      onClick={() => setPicked(null)}
                      aria-label="Хаах"
                      className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <dl className="space-y-1.5 px-2.5 py-2">
                    <PopField k="Дугаар" v={chosen.p.parcelId} />
                    <PopField k="Эрх" v={chosen.p.right} />
                    <PopField k="Зориулалт" v={chosen.p.landuse} />
                    <PopField k="Байршил" v={[chosen.p.district, chosen.p.khoroo]
                        .filter(Boolean)
                        .join(", ")} />
                    <PopField k="Талбай" v={`${chosen.p.ha.toFixed(2)} га`} />
                  </dl>
                </div>
              ) : null}

            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS · 2024 оны {num(data.rows.length)} коридор ·
            давхцлыг {num(data.parcels.length)} нэгж талбараас сервер дээр бодов
          </p>
        </div>

        {/* ---- БАРУУН: нэгж талбарын задаргаа ---- */}
        {/*
          ⚠ NBAHH-ЫН ХУУДАС (хэрэглэгч 2026-10-23, ногоон бүсийн зургаар):
          Тойм → коридор → зориулалт. Үзүүлэлтийн зурвас зургийн дээрээс энд.
        */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto xl:w-(--col-r) xl:shrink-0">
          <SheetStats
            stats={[
              { label: "Коридор", value: stats.n },
              { label: "Коридорын талбай", value: Math.round(stats.ha), unit: "га" },
              { label: "Давхцсан нэгж талбар", value: stats.parcels },
              { label: "Зориулалтын төрөл", value: stats.landuses },
            ]}
          />
          <SheetSection title="ЭК-д давхцаж буй нэгж талбар" meta={catMeta(byCorridor.length)}>
            <SheetBars
              data={byCorridor}
              measure="Нэгж талбарын тоо"
              selected={zone}
              onSelect={setZone}
              /* Талбай нь нэрийн ард, бүдэг — зурвас нь нэгж талбарын тоо */
              note={(d) => {
                const ha = haOfZone.get(d.key);
                return ha == null ? "" : `${num(Math.round(ha))} га`;
              }}
            />
            {/* Эрхийн задаргаа — 1,022-оос 1,021 нь "эзэмших" тул зурвас
                болгох нь утгагүй, харин баримт нь хэвээр */}
            <p className="num mt-1.5 px-1.5 text-[10.5px] leading-none text-ink-3">{rightNote}</p>
          </SheetSection>
          <SheetSection
            title="Давхцаж буй нэгж талбарын зориулалт"
            meta={catMeta(byLanduse.length)}
          >
            <SheetBars
              data={byLanduse}
              measure="Нэгж талбарын тоо"
              selected={landuse}
              onSelect={setLanduse}
            />
          </SheetSection>
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col rounded-xs border border-line bg-paper-2", className)}>
      {children}
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
