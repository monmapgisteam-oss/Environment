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
} from "lucide-react";
import {
  GroupedRowChart,
  RowChart,
  type Datum,
  type DatumGroup,
} from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { OverlayControl } from "@/components/map/overlay-control";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { DATA_COLOR } from "@/components/wells/colors";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapOverlay,
  type MapPoints,
} from "@/components/wells/map";
import { fetchEcoCorridors, type EcoData } from "@/lib/eco-corridors";
import { Bounds } from "@/lib/extent";
import { spreadRamp } from "@/lib/tone-ramp";
import { cn, num } from "@/lib/utils";

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
  const [hover, setHover] = React.useState<number | null>(null);
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
  const shownCorridors = React.useMemo(
    () =>
      (rows ?? []).filter(
        (r) => (!district || r.district === district) && (!zone || r.zone === zone),
      ),
    [rows, district, zone],
  );

  const corridorOn = React.useMemo(
    () => new Set(shownCorridors.map((r) => r.oid)),
    [shownCorridors],
  );

  /* Нэгж талбар нь ХАРЬЯА коридороороо ч шүүгдэнэ: дүүрэг сонгоход тэр
     дүүргийн коридорт байгаа талбарууд л үлдэнэ */
  const shownParcels = React.useMemo(
    () =>
      (data?.parcels ?? []).filter(
        (p) => corridorOn.has(p.corridor) && (!landuse || p.landuse === landuse),
      ),
    [data, corridorOn, landuse],
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
      .filter((f) => parcelOn.has(Number(f.id)))
      .map((f) => ({
        ...f,
        id: PARCEL_BASE + Number(f.id),
        /* Нэгж талбар ГАНЦ өнгөтэй — 18 зориулалтыг өнгөөр ялгавал
           газрын зураг утгагүй солонго болно */
        properties: { oid: PARCEL_BASE + Number(f.id), c: DATA_COLOR },
      }));

    return { type: "FeatureCollection", features: [...corridors, ...parcels] };
  }, [data, corridorOn, shownParcels, colorOf, showParcels]);

  /* ---------------- Задаргаа ---------------- */
  const byDistrict = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (zone && r.zone !== zone) continue;
      m.set(r.district, (m.get(r.district) ?? 0) + r.ha);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, zone]);

  const byZone = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (district && r.district !== district) continue;
      m.set(r.zone, (m.get(r.zone) ?? 0) + r.ha);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, district]);

  /*
    Зориулалтын задаргаа — энэ самбарын ГОЛ диаграм.

    ТООГООР хэмжинэ, га-гаар БИШ: нэгж талбарын талбай нь коридортой
    давхцсан хэсгийнх биш бүтэн талбарынх тул га-гийн нийлбэр нь
    "коридорын дотор хэдэн га" гэсэн худал утга өгнө.
  */
  const byLanduse = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const p of data?.parcels ?? []) {
      if (!corridorOn.has(p.corridor)) continue;
      m.set(p.landuse, (m.get(p.landuse) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [data, corridorOn]);

  /*
    Эрхийн төрөл — БҮС ТУС БҮРЭЭР.

    Нийлбэрээр нь харуулбал "1,021 эзэмших, 1 ашиглах" гэсэн ганц мөр
    гарах бөгөөд аль коридорт хэдэн эзэмшигч байгаа нь харагдахгүй.
    Төлөвлөлтөд яг тэр задаргаа хэрэгтэй: коридор бүр өөрийн гэсэн
    эрх зүйн ачаалалтай.

    Бүсийг ЭХ ЭРЭМБЭЭР нь (талбайгаар буурсан) байрлуулна — тоогоор
    эрэмбэлбэл шүүлт солиход бүлгүүд байраа солино.
  */
  const byRight = React.useMemo<DatumGroup[]>(() => {
    /* Өөрийнхөө хэмжигдэхүүнийг (бүс) АЛГАСЧ шүүнэ — эс тэгвээс нэг бүс
       сонгомогц бусад нь алга болж, өөр бүс рүү шилжих боломжгүй болно */
    const corridors = (rows ?? []).filter((r) => !district || r.district === district);
    const zoneOf = new Map(corridors.map((r) => [r.oid, r.zone]));

    const zones = new Map<string, Map<string, number>>();
    for (const p of data?.parcels ?? []) {
      const z = zoneOf.get(p.corridor);
      if (!z) continue;
      if (landuse && p.landuse !== landuse) continue;
      const inner = zones.get(z) ?? new Map<string, number>();
      inner.set(p.right, (inner.get(p.right) ?? 0) + 1);
      zones.set(z, inner);
    }

    return corridors
      .filter((c) => zones.has(c.zone))
      .map((c) => {
        const inner = zones.get(c.zone)!;
        const rowsOut = [...inner]
          .map(([k, v]) => ({ key: `${c.zone}|${k}`, label: k, value: v }))
          .sort((a, b) => b.value - a.value);
        return {
          key: c.zone,
          label: c.zone,
          total: rowsOut.reduce((s, d) => s + d.value, 0),
          rows: rowsOut,
        };
      });
  }, [data, rows, district, landuse]);

  const stats = React.useMemo(() => {
    const ha = shownCorridors.reduce((s, r) => s + r.ha, 0);
    return {
      n: shownCorridors.length,
      ha,
      parcels: shownParcels.length,
      landuses: new Set(shownParcels.map((p) => p.landuse)).size,
    };
  }, [shownCorridors, shownParcels]);

  /* Коридорын эзлэх хувийн суурь — ШҮҮЛТГҮЙ нийт */
  const totalHa = React.useMemo(
    () => (rows ?? []).reduce((s, r) => s + r.ha, 0),
    [rows],
  );

  /* ---------------- Сонголтын хүрээ (zoom action) ---------------- */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked == null && !district && !zone && !landuse) return null;
    const b = new Bounds();

    if (picked != null) {
      const src =
        picked >= PARCEL_BASE ? data.parcelShapes.features : data.shapes.features;
      const want = picked >= PARCEL_BASE ? picked - PARCEL_BASE : picked;
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
  }, [data, corridorOn, shownParcels, picked, district, zone, landuse]);

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

  /* Тогтмол самбар: товшсон, эсвэл ЖАГСААЛТЫН мөр дээр очсон зүйл */
  const active = React.useMemo(() => {
    const id = hover ?? picked;
    if (id == null) return null;
    if (id >= PARCEL_BASE) {
      const p = data?.parcels.find((x) => x.oid === id - PARCEL_BASE);
      return p ? ({ kind: "parcel", p } as const) : null;
    }
    const c = rows?.find((r) => r.oid === id);
    return c ? ({ kind: "corridor", c } as const) : null;
  }, [data, rows, hover, picked]);

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

  const activeCount = (district ? 1 : 0) + (zone ? 1 : 0) + (landuse ? 1 : 0);

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
            items={byLanduse}
            selected={landuse}
            onPick={setLanduse}
            searchable
          />
        </FilterMenu>
      </FilterBar>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
        {/* ---- ЗҮҮН: индикатор + коридорын карт ---- */}
        <div className="flex min-h-0 flex-col gap-2.5 xl:w-[290px] xl:shrink-0">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Stat icon={Waypoints} label="Коридор" value={num(stats.n)} />
              <Stat
                icon={Ruler}
                label="Коридорын талбай, га"
                value={num(Math.round(stats.ha))}
              />
              {/* Энэ самбарын гол тоо — төлөвлөлтөд зохицуулах шаардлагатай
                  нэгж талбарын хэмжээ */}
              <Stat icon={LandPlot} label="Давхцсан нэгж талбар" value={num(stats.parcels)} />
              <Stat icon={Layers3} label="Зориулалтын төрөл" value={num(stats.landuses)} />
            </div>
          </Card>

          {/*
            Коридор бүрийн бүтэн карт. Гурван мөр тул жагсаалт биш КАРТ:
            бүс, нэр, дүүрэг, талбай, эзлэх хувь бүгд нэг дор багтана.
          */}
          <Card className="min-h-[110px] flex-1">
            <Head title="Коридорууд">
              <span className="num text-[11.5px] text-ink-3">{num(shownCorridors.length)}</span>
            </Head>
            <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              {shownCorridors.map((r) => {
                const tone = colorOf(r.oid);
                const share = totalHa > 0 ? (r.ha / totalHa) * 100 : 0;
                const inside = (data.parcels ?? []).filter(
                  (p) => p.corridor === r.oid && (!landuse || p.landuse === landuse),
                ).length;
                return (
                  <button
                    key={r.oid}
                    onClick={() => setPicked(picked === r.oid ? null : r.oid)}
                    onMouseEnter={() => setHover(r.oid)}
                    onMouseLeave={() => setHover(null)}
                    className={cn(
                      "block w-full px-3 py-2.5 text-left transition-colors hover:bg-paper-hi",
                      picked === r.oid && "bg-paper-hi",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {/* Өнгөт цэг — газрын зурган дээрх хүрээтэй холбоно */}
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: tone }}
                      />
                      <span className="min-w-0 truncate text-[12px] text-ink">{r.zone}</span>
                      <span className="num ml-auto shrink-0 text-[11.5px] text-ink">
                        {num(Math.round(r.ha))} га
                      </span>
                    </div>

                    <div className="mt-1.5 text-[10.5px] leading-snug text-ink-3">
                      {r.district} · {num(inside)} нэгж талбар
                    </div>

                    {/* Эзлэх хувь — гурван коридорын жинг зэрэгцүүлнэ */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-[1px] bg-paper-hi">
                        <span
                          className="block h-full"
                          style={{ width: `${share}%`, background: tone }}
                        />
                      </span>
                      <span className="num shrink-0 text-[10px] text-ink-3">
                        {share.toFixed(0)}%
                      </span>
                    </div>
                  </button>
                );
              })}
              {shownCorridors.length === 0 ? (
                <div className="py-5 text-center text-[12px] text-ink-3">
                  Шүүлтүүрт тохирох экологийн коридор байхгүй байна
                </div>
              ) : null}
            </div>
          </Card>
        </div>

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
                shapes={{ data: shapes, selected: picked, labelZoom: 9 }}
                basemap={basemap}
                onSelect={setPicked}
                onHover={tip.onHover}
                focus={focus}
                overlays={overlays}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />
              <OverlayControl value={overlays} onChange={setOverlays} />

              {/*
                Давхаргын тайлбар — зурган дээр ямар хоёр зүйл давхарлаж
                байгааг хэлж, нэгж талбарыг унтраах боломж өгнө.

                Хөвөгч гадаргуу тул `.elevated` сүүдэр зөвшөөрөгдөнө.
              */}
              <div className="elevated absolute bottom-2.5 left-2.5 z-10 rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                <div className="eyebrow mb-1.5">Давхарга</div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: colorOf(shownCorridors[0]?.oid ?? 0) }}
                  />
                  Экологийн коридор
                  <span className="num ml-auto pl-2 text-ink-3">
                    {num(shownCorridors.length)}
                  </span>
                </div>
                <button
                  onClick={() => setShowParcels((v) => !v)}
                  aria-pressed={showParcels}
                  className={cn(
                    "mt-1 flex w-full items-center gap-1.5 text-[11.5px] transition-colors hover:text-ink",
                    showParcels ? "text-ink-2" : "text-ink-3",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full transition-opacity"
                    style={{ background: DATA_COLOR, opacity: showParcels ? 1 : 0.25 }}
                  />
                  <span className={cn(!showParcels && "line-through")}>Нэгж талбар</span>
                  <span className="num ml-auto pl-2 text-ink-3">
                    {num(shownParcels.length)}
                  </span>
                </button>
              </div>

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

              {active ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[280px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  {active.kind === "corridor" ? (
                    <>
                      <div className="eyebrow mb-1.5">Экологийн коридор</div>
                      <div className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: colorOf(active.c.oid) }}
                        />
                        <span className="text-[12.5px] leading-snug text-ink">
                          {active.c.zone}
                        </span>
                      </div>
                      <div className="num mt-1 text-[11.5px] text-ink-2">
                        {num(Math.round(active.c.ha))} га
                      </div>
                      <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                        {active.c.name} · {active.c.district} дүүрэг
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="eyebrow mb-1.5">Нэгж талбар</div>
                      <div className="text-[12.5px] leading-snug text-ink">
                        {active.p.landuse}
                      </div>
                      <div className="num mt-1 text-[11.5px] text-ink-2">
                        {active.p.parcelId} · {active.p.ha.toFixed(2)} га
                      </div>
                      <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                        Эрх: {active.p.right} · {active.p.district}
                        {active.p.khoroo ? ` ${active.p.khoroo}` : ""}
                      </div>
                    </>
                  )}
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
        <div className="flex min-h-0 flex-col gap-2.5 xl:w-[300px] xl:shrink-0 2xl:w-[330px]">
          {/*
            Эрхийн төрөл — ердөө хоёр утга тул дээд талд, тогтмол өндөртэй.
            Бараг бүгд "эзэмших" боловч энэ нь ХООСОН тоо биш: эзэмших
            эрхтэй газрыг коридорт оруулах нь ашиглах эрхтэйгээс өөр
            эрх зүйн үр дагавартай.
          */}
          <Card className="shrink-0">
            <Head title="Эрхийн төрлөөр">
              <span className="text-[10.5px] text-ink-3">бүсээр · нэгж талбар</span>
            </Head>
            <div className="p-3">
              {/* Бүс тус бүр задарсан байдлаар — гурван бүлэг тул
                  хураах шаардлагагүй */}
              <GroupedRowChart
                groups={byRight}
                selectedGroup={zone}
                onSelectGroup={setZone}
                storageKey="eco.right"
              />
            </div>
          </Card>

          {/* Мөрийн СҮҮЛД нь уян карт — 18 мөр тул дотроо гүйнэ */}
          <Card className="min-h-[140px] flex-1">
            <Head title="Зориулалтаар">
              <span className="text-[10.5px] text-ink-3">нэгж талбар</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <RowChart data={byLanduse} selected={landuse} onSelect={setLanduse} />
            </div>
          </Card>
        </div>
      </div>
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

function Head({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
      <h2 className="display text-[13.5px] leading-none tracking-[0.06em] uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Waypoints;
}) {
  return (
    <div className="px-3 py-2.5">
      <span className="eyebrow block min-h-[28px] leading-[1.25]">{label}</span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}
