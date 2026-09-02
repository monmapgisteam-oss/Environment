"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Droplets,
  Gauge,
  LandPlot,
  Layers3,
  Loader2,
  MapPin,
  Toilet,
} from "lucide-react";
import {
  CategoryChart,
  GroupedRowChart,
  type Datum,
  type DatumGroup,
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
} from "@/components/wells/map";
import {
  decodeToiletPoints,
  fetchCityToilets,
  PLI_BUCKETS,
  PLI_MIN,
  PLI_STEP,
  ZONES,
  type CityToilet,
  type ToiletPoints,
  type ToiletsPayload,
} from "@/lib/toilets";
import { asset } from "@/lib/base-path";
import { Bounds } from "@/lib/extent";
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

type SourceId = "pit" | "city";

const SOURCES = [
  { id: "pit" as const, label: "Нүхэн жорлон", icon: Toilet },
  { id: "city" as const, label: "Нийтийн ариун цэврийн байгууламж", icon: Droplets },
];

/**
 * Ариун цэврийн байгууламжийн самбар.
 *
 * Өмнөх самбаруудаас ялгаатай нь энэ нь БИЧЛЭГИЙН биш НЯГТРАЛЫН зураглал:
 * 145 мянган нүхэн жорлонг цэг цэгээр нь харах утгагүй (нэг дүүрэгт 49
 * мянга) тул серверт ~220м-ийн нүдэнд хурааж, дулааны зургаар харуулна.
 * Тиймээс:
 *  · шүүлтүүр нь бичлэг биш ХЭМЖИГДЭХҮҮН (дүүрэг, бүс) дээр;
 *  · диаграм нь урьдчилан бэлдсэн хөндлөн хүснэгтээс уншина;
 *  · газрын зураг дээр хоёр ӨӨР давхарга зэрэгцэнэ — нягтрал ба
 *    нийтийн бие засах газрын 17 цэг.
 */
export function OrchinDashboard() {
  const [data, setData] = React.useState<ToiletsPayload | null>(null);
  /** Бүх 145 мянган цэгийн байршил — газрын зурагт л хэрэглэнэ */
  const [raw, setRaw] = React.useState<ToiletPoints | null>(null);
  const [city, setCity] = React.useState<CityToilet[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  /*
    Хоёр эх сурвалж нь ӨӨР ХЭМЖИГДЭХҮҮНТЭЙ (145 мянга нь бүс, PLI-тэй;
    17 нь зөвхөн байршилтай) тул давхарлах биш СОЛИХ зарчмаар харна.
    Сонгосон эх сурвалж нь газрын зураг, диаграм, индикатор, тэр байтугай
    аль шүүлтүүр гарахыг ч тодорхойлно.
  */
  const [source, setSource] = React.useState<SourceId>("pit");
  const pit = source === "pit";

  const [district, setDistrict] = React.useState<string | null>(null);
  const [zone, setZone] = React.useState<string | null>(null);
  /** Хорооны сонголт — нийтийн жорлон дээр л утгатай (нүд нь хороогоо мэдэхгүй) */
  const [khoroo, setKhoroo] = React.useState<string | null>(null);
  /** Хулгана дээр нь очсон нийтийн жорлон */
  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());
  /*
    Нэмэлт давхарга (хил, бүс). Эх сурвалж солиход ч үлдэнэ — хоёр зураг
    ижил газарзүйн лавлагаа хэрэглэнэ.
  */
  const [overlays, setOverlays] = React.useState<MapOverlay[]>([]);

  React.useEffect(() => {
    const ac = new AbortController();

    fetch(asset("/api/toilets"), { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });

    /*
      Бүх цэгийн хоёртын багц (~1.4MB). Нэгтгэсэн мэдээнээс ХОЙШ ирдэг
      тул зураг эхлээд нүдээр гарч, дараа нь бодит цэг рүү солигдоно.
      Алдааг нь ЗАЛГИНА: ирээгүй ч самбар нүдээрээ бүрэн ажиллана.
    */
    fetch(asset("/api/toilet-points"), { signal: ac.signal })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((b) => setRaw(decodeToiletPoints(b)))
      .catch(() => {});

    // Нийтийн жорлон нь 17 бичлэг — шууд ArcGIS-ээс, алдааг нь залгина
    fetchCityToilets(ac.signal)
      .then(setCity)
      .catch(() => {});

    return () => ac.abort();
  }, []);

  const dIdx = data && district ? data.districts.indexOf(district) : -1;
  const zIdx = zone ? ZONES.indexOf(Number(zone)) : -1;

  /* ---------------- Газрын зургийн нүд ---------------- */

  /** Нүд бүрийн жин — сонгосон бүсийн (эсвэл бүх бүсийн) тоо */
  const cells = React.useMemo(() => {
    if (!data) return { oid: [], lon: [], lat: [], w: [] as number[] };
    const oid: number[] = [];
    const lon: number[] = [];
    const lat: number[] = [];
    const w: number[] = [];

    for (let i = 0; i < data.lon.length; i++) {
      if (dIdx >= 0 && data.cellDistrict[i] !== dIdx) continue;
      const total =
        zIdx >= 0
          ? data.cellZone[i * 4 + zIdx]
          : data.cellZone[i * 4] +
            data.cellZone[i * 4 + 1] +
            data.cellZone[i * 4 + 2] +
            data.cellZone[i * 4 + 3];
      if (total <= 0) continue;
      oid.push(i);
      lon.push(data.lon[i]);
      lat.push(data.lat[i]);
      w.push(total);
    }
    return { oid, lon, lat, w };
  }, [data, dIdx, zIdx]);

  /*
    Газрын зурагт орох цэгүүд.

    Бодит багц ирсэн бол ТҮҮГЭЭР: 220м-ийн нүд нь ойртоход хиймэл сүлжээ
    болж харагдана — жорлон хашаандаа хаана байгааг биш, нүдний төвийг
    заана. Дулааны зураг нь ч бодит байршил дээр суусан үедээ жинхэнэ
    тархалтыг өгнө.

    Багц ирээгүй (эсвэл татагдаагүй) бол нүдээрээ ажиллана — 1.4MB
    хүлээж байхад зураг хоосон байх шалтгаангүй.

    Жин нь бичлэг тутам 1: нэгтгэсэн нүдний жингийн НИЙЛБЭР ижил тул
    дулааны зургийн нягтрал хоёр тохиолдолд адилхан гарна.
  */
  const mapPoints = React.useMemo(() => {
    if (!raw) return cells;
    const dAt = district ? raw.districts.indexOf(district) : -1;
    /* Сонгосон дүүрэг багцад олдохгүй бол ЮУ Ч харуулахгүй — шүүлтгүй
       мэт бүгдийг гаргавал сонголт үл ажиллах мэт харагдана */
    if (district && dAt < 0) return { oid: [], lon: [], lat: [], w: [] as number[] };
    const zAt = zone ? Number(zone) : 0;

    const oid: number[] = [];
    const lon: number[] = [];
    const lat: number[] = [];
    for (let i = 0; i < raw.n; i++) {
      if (dAt >= 0 && raw.district[i] !== dAt) continue;
      if (zAt && raw.zone[i] !== zAt) continue;
      oid.push(i);
      lon.push(raw.coords[i * 2]);
      lat.push(raw.coords[i * 2 + 1]);
    }
    return { oid, lon, lat, w: new Array<number>(oid.length).fill(1) };
  }, [raw, cells, district, zone]);

  const cellIdx = React.useMemo(
    () => Uint32Array.from(mapPoints.oid, (_, i) => i),
    [mapPoints],
  );


  /* ---------------- Нийтийн жорлон ---------------- */

  /** Хорооны түлхүүр — эх сурвалжид нэр байхгүй тул "дүүрэг · дугаар" */
  const khorooKey = (c: CityToilet) =>
    c.khoroo == null ? "Тодорхойгүй" : `${c.district} · ${c.khoroo}`;

  const cityRows = React.useMemo(
    () =>
      city.filter(
        (c) =>
          (!district || c.district === district) &&
          (!khoroo || khorooKey(c) === khoroo),
      ),
    [city, district, khoroo],
  );

  /** Газрын зурагт: 17 цэг нь нүд биш, бодит байршил тул жингүй */
  const cityPoints = React.useMemo(
    () => ({
      oid: cityRows.map((c) => c.oid),
      lon: cityRows.map((c) => c.lon),
      lat: cityRows.map((c) => c.lat),
    }),
    [cityRows],
  );
  const cityIdx = React.useMemo(
    () => Uint32Array.from(cityRows, (_, i) => i),
    [cityRows],
  );

  /*
    Цэгийн шошго — дүүрэг, хороо.

    Эх сурвалжид нийтийн бие засах газрын НЭР байхгүй, зөвхөн байршил
    бий. Тиймээс шошго нь хаяг болно. z11-ээс гарна: 17 цэг тул нягтрал
    багатай, эрт харагдаж болно.

    Нүхэн жорлонгийн горимд шошго БАЙХГҮЙ: тэдгээр цэг нь бодит жорлон
    биш ~220м-ийн нэгтгэсэн НҮД тул нэрлэх зүйл нь үгүй.
  */
  const cityLabels = React.useMemo(
    () => ({
      text: cityRows.map((c) =>
        c.khoroo != null ? `${c.district} ${c.khoroo}-р хороо` : c.district,
      ),
      minzoom: 11,
    }),
    [cityRows],
  );

  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (city.find((c) => c.oid === tip.oid) ?? null)),
    [city, tip.oid],
  );

  /* ---------------- Диаграм ---------------- */

  /**
   * Дүүргээр — бүсийн шүүлтийг дагана, дүүргийн шүүлтийг алгасна.
   * Нийтийн жорлон дээр 17 бичлэгээ шууд тоолно.
   */
  const districtData = React.useMemo<Datum[]>(() => {
    if (!pit) {
      const counts = new Map<string, number>();
      for (const c of city) counts.set(c.district, (counts.get(c.district) ?? 0) + 1);
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, label: key, value }));
    }
    if (!data) return [];
    const out: Datum[] = [];
    for (let d = 0; d < data.districts.length; d++) {
      let n = 0;
      for (let z = 0; z < 4; z++) {
        if (zIdx >= 0 && z !== zIdx) continue;
        for (let b = 0; b < PLI_BUCKETS; b++) {
          n += data.distZonePli[(d * 4 + z) * PLI_BUCKETS + b];
        }
      }
      if (n > 0) out.push({ key: data.districts[d], label: data.districts[d], value: n });
    }
    return out.sort((a, b) => b.value - a.value);
  }, [pit, city, data, zIdx]);

  /** Бүсээр — дүүргийн шүүлтийг дагана */
  const zoneData = React.useMemo<Datum[]>(() => {
    if (!data) return [];
    return ZONES.map((z, zi) => {
      let n = 0;
      for (let d = 0; d < data.districts.length; d++) {
        if (dIdx >= 0 && d !== dIdx) continue;
        for (let b = 0; b < PLI_BUCKETS; b++) {
          n += data.distZonePli[(d * 4 + zi) * PLI_BUCKETS + b];
        }
      }
      return { key: String(z), label: `${z}-р бүс`, value: n };
    }).filter((d) => d.value > 0);
  }, [data, dIdx]);

  /**
   * Нэгж (дүүрэг/хороо) бүрийн ДУНДАЖ PLI ба тоо.
   *
   * Хөндлөн хүснэгт нь савны тоог хадгалдаг тул дундажийг савны голч
   * утгаар жигнэж гаргана. Тархалтын гистограм байсныг үүгээр сольсон:
   * "2.3 дээр 22 мянга байна" гэдэг хэнд ч юу ч хэлэхгүй, "Сонгинохайрханы
   * дундаж 2.6" гэдэг ажил хуваарилахад хэрэгтэй.
   */
  const avgPli = React.useCallback(
    (table: number[], unit: number, skipZone = false) => {
      let sum = 0;
      let n = 0;
      for (let z = 0; z < 4; z++) {
        if (!skipZone && zIdx >= 0 && z !== zIdx) continue;
        for (let b = 0; b < PLI_BUCKETS; b++) {
          const c = table[(unit * 4 + z) * PLI_BUCKETS + b];
          if (!c) continue;
          sum += (PLI_MIN + b * PLI_STEP) * c;
          n += c;
        }
      }
      return { avg: n ? sum / n : 0, n };
    },
    [zIdx],
  );

  /** Хороогоор — хоёр шүүлтийг ч дагана */
  const khorooData = React.useMemo<Datum[]>(() => {
    if (!pit) {
      /* Хорооны диаграм нь ӨӨРИЙН шүүлтээ алгасна — сонгосны дараа ч
         бусад хороо харагдсаар үлдэнэ (cross-filter) */
      const counts = new Map<string, number>();
      for (const c of city) {
        if (district && c.district !== district) continue;
        counts.set(khorooKey(c), (counts.get(khorooKey(c)) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, label: key, value }));
    }
    if (!data) return [];
    const out: Datum[] = [];
    for (let k = 0; k < data.khoroos.length; k++) {
      if (dIdx >= 0 && data.khDistrict[k] !== dIdx) continue;
      const { n } = avgPli(data.khZonePli, k);
      if (n > 0) out.push({ key: data.khoroos[k], label: data.khoroos[k], value: n });
    }
    return out.sort((a, b) => b.value - a.value);
  }, [pit, city, district, data, dIdx, avgPli]);

  /**
   * Хороог ДҮҮРГЭЭР нь бүлэглэсэн хувилбар.
   *
   * "Сүхбаатар дүүрэг · 6" гэсэн хавсарсан нэр нэг мөрөнд шахагдвал
   * дүүргийн нэр давтагдаж, хорооны дугаар араас нь нуугддаг. Дүүргийг
   * гарчиг болгож, доор нь "6-р хороо" гэж бичвэл давталт алга болно.
   */
  const khorooGroups = React.useMemo<DatumGroup[]>(() => {
    const byDistrict = new Map<string, Datum[]>();

    if (pit) {
      if (!data) return [];
      for (let k = 0; k < data.khoroos.length; k++) {
        if (dIdx >= 0 && data.khDistrict[k] !== dIdx) continue;
        const { n } = avgPli(data.khZonePli, k);
        if (n <= 0) continue;
        const dName = data.districts[data.khDistrict[k]] ?? "Тодорхойгүй";
        /*
          Код нь "СХД_20" хэлбэртэй — дугаарыг нь л мөрд үлдээнэ. Кодгүй
          бичлэг ("Тодорхойгүй") дээр "-р хороо" залгавал утгагүй нэр
          болох тул байгаагаар нь үлдээнэ.
        */
        const numPart = data.khoroos[k].split("_")[1];
        const row = {
          key: data.khoroos[k],
          label: numPart ? `${numPart}-р хороо` : data.khoroos[k],
          value: n,
        };
        byDistrict.set(dName, [...(byDistrict.get(dName) ?? []), row]);
      }
    } else {
      for (const c of city) {
        if (district && c.district !== district) continue;
        const key = khorooKey(c);
        const list = byDistrict.get(c.district) ?? [];
        const hit = list.find((r) => r.key === key);
        if (hit) hit.value++;
        else {
          list.push({
            key,
            label: c.khoroo == null ? "Тодорхойгүй" : `${c.khoroo}-р хороо`,
            value: 1,
          });
        }
        byDistrict.set(c.district, list);
      }
    }

    return [...byDistrict.entries()]
      .map(([label, rows]) => ({
        key: label,
        label,
        total: rows.reduce((s, r) => s + r.value, 0),
        rows: rows.sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.total - a.total);
  }, [pit, data, dIdx, city, district, avgPli]);

  /* ---------------- Сонголт руу ойртох (zoom action) ----------------
     Диаграм дээр товшиход газрын зураг тухайн сонголтын хүрээ рүү нисч
     ойртоно. Нүхэн жорлон дээр нүдээр, нийтийн жорлон дээр цэгээр. */
  /* ---------------- Сонголтын хүрээ (zoom action) ----------------
     ЯМАР Ч шүүлтүүр тавихад зураг таарсан цэгүүд рүүгээ ойртоно.
     Шүүлтүүр цуцлагдвал `null` — зураг анхны байрлалдаа буцна. */
  const focus = React.useMemo<Extent | null>(() => {
    if (!district && !khoroo && !zone) return null;
    const b = new Bounds();
    if (pit) {
      for (let i = 0; i < cells.lon.length; i++) b.add(cells.lon[i], cells.lat[i]);
    } else {
      for (const c of cityRows) b.add(c.lon, c.lat);
    }
    return b.get(0.004);
  }, [pit, district, khoroo, zone, cells, cityRows]);

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    if (!data) return null;
    /*
      Шүүлтгүй үед эх сурвалжийн БҮТЭН тоог харуулна. Хөндлөн хүснэгт нь
      зөвхөн бүс тодорхойлогдсон бичлэгийг агуулдаг тул түүнийг нийлбэрлэвэл
      145,458 гарч, эх сурвалжийн 145,462-той зөрөх байв.
    */
    const filtered = districtData.reduce((s, d) => s + d.value, 0);
    const total = dIdx < 0 && zIdx < 0 ? data.n : filtered;
    /** Жигнэсэн дундаж PLI — сонгосон дүүрэг(үүд)-ийн нийлбэрээр */
    let sum = 0;
    let cnt = 0;
    for (let d = 0; d < data.districts.length; d++) {
      if (dIdx >= 0 && d !== dIdx) continue;
      const { avg, n } = avgPli(data.distZonePli, d);
      sum += avg * n;
      cnt += n;
    }

    return {
      total: pit ? total : cityRows.length,
      districts: districtData.length,
      khoroos: khorooData.length,
      pli: cnt ? sum / cnt : 0,
    };
  }, [pit, data, districtData, khorooData, cityRows, dIdx, zIdx, avgPli]);

  /** Бүсийн шүүлтүүр нь зөвхөн нүхэн жорлонд утгатай */
  const activeCount =
    (district ? 1 : 0) + (pit && zone ? 1 : 0) + (!pit && khoroo ? 1 : 0);

  function reset() {
    setDistrict(null);
    setZone(null);
    setKhoroo(null);
  }

  /*
    Эх сурвалж солиход бүсийн сонголт үлдэх ёсгүй — нийтийн жорлонд бүс
    гэсэн ойлголт байхгүй бөгөөд буцаж ирэхэд далд шүүлтүүр болно.
  */
  function pickSource(id: SourceId) {
    setSource(id);
    /* Нөгөө эх сурвалжид байхгүй хэмжигдэхүүний сонголт үлдэх ёсгүй —
       буцаж ирэхэд далд шүүлтүүр болно */
    if (id === "city") setZone(null);
    else setKhoroo(null);
    /* Хөвөгч тайлбар нь өөрөө хулгана салахад цэвэрлэгддэг тул энд
       тусгайлан унтраах шаардлагагүй */
  }

  if (error || !data || !stats) {
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
            Ариун цэврийн байгууламжийн мэдээ татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Ариун цэврийн байгууламж"
        activeCount={activeCount}
        onReset={reset}
        leading={
          /* Эх сурвалж сонгох — гарчгийн ХАЖУУД, шүүлтүүрээс тусад нь */
          <div className="flex shrink-0 items-center gap-1">
            {SOURCES.map((s) => {
              const on = source === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => pickSource(s.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xs border px-2 py-1 text-[12px] transition-colors",
                    on
                      ? "border-data/45 bg-data/10 text-ink"
                      : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                  )}
                >
                  <s.icon
                    size={12}
                    strokeWidth={1.75}
                    className={cn("shrink-0", on ? "text-data" : "text-ink-3")}
                  />
                  {s.label}
                  <span className="num text-ink-3">
                    {num(s.id === "pit" ? (data?.n ?? 0) : city.length)}
                  </span>
                </button>
              );
            })}
          </div>
        }
      >
        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={240}
        >
          <PickList items={districtData} selected={district} onPick={setDistrict} />
        </FilterMenu>

        {/* Бүс нь зөвхөн нүхэн жорлонгийн хэмжигдэхүүн */}
        {pit ? (
          <FilterMenu
            label="Бүс"
            icon={Layers3}
            value={zone ? `${zone}-р бүс` : null}
            active={Boolean(zone)}
            onClear={() => setZone(null)}
            width={190}
          >
            <PickList items={zoneData} selected={zone} onPick={setZone} />
          </FilterMenu>
        ) : null}
      </FilterBar>

      {/*
        ГУРАВ биш ХОЁР багана, зураг нь давамгайлна. Баруун багана 380px:
        "Сонгинохайрхан дүүрэг" гэх урт нэр тоотойгоо нэг мөрөнд багтах
        өргөн — 320px дээр таслагдаж байв.
      */}
      <Columns id="toilets" right={380} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: индикатор + нягтралын зураг ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          <Card className="shrink-0">
            {/* Индикатор нь эх сурвалжийг дагана: PLI зөвхөн нүхэн жорлонд бий */}
            <div
              className={cn(
                "grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 xl:divide-y-0",
                pit ? "xl:grid-cols-4" : "xl:grid-cols-3",
              )}
            >
              <Stat
                icon={pit ? Toilet : Droplets}
                label={pit ? "Нүхэн жорлон" : "Нийтийн ариун цэврийн байгууламж"}
                value={num(stats.total)}
              />
              <Stat icon={Building2} label="Дүүрэг" value={num(stats.districts)} />
              <Stat icon={LandPlot} label="Хороо" value={num(stats.khoroos)} />
              {pit ? (
                <Stat icon={Gauge} label="Дундаж PLI" value={stats.pli.toFixed(2)} />
              ) : null}
            </div>
          </Card>

          <Card className="relative min-h-[280px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/*
                Харагдацаар шүүх боломж ЭНД БАЙХГҮЙ. Диаграмууд нь серверт
                урьдчилан нэгтгэсэн тоон дээр суудаг тул хүрээгээр шүүхэд
                зөвхөн зураг өөрчлөгдөж, доорх тоонууд хөдөлгөөнгүй үлдэнэ —
                тэр нь худал дохио болно.
              */}
              {/*
                Хоёр эх сурвалж хоёр өөр дүрслэлтэй: нүхэн жорлон нь нүдний
                НЯГТРАЛ (жинтэй), нийтийн жорлон нь 17 бодит цэг. Тиймээс
                зургийг `key`-ээр дахин үүсгэнэ — бөөгнөрөл, жин зэрэг нь эх
                сурвалж үүсгэх мөчид л уншигддаг тохиргоо.
              */}
              {pit ? (
                <PointMap
                  key="pit"
                  points={mapPoints}
                  visible={cellIdx}
                  weights={mapPoints.w}
                  basemap={basemap}
                  onSelect={() => {}}
                  focus={focus}
                  overlays={overlays}
                  cluster={false}
                />
              ) : (
                <PointMap
                  key="city"
                  points={cityPoints}
                  visible={cityIdx}
                  labels={cityLabels}
                  basemap={basemap}
                  onSelect={() => {}}
                  onHover={tip.onHover}
                  focus={focus}
                  overlays={overlays}
                  cluster={false}
                  pulse
                />
              )}
              <BasemapGallery value={basemap} onChange={setBasemap} />
              <OverlayControl value={overlays} onChange={setOverlays} />

              {/*
                ХӨВӨГЧ ТАЙЛБАР. Тэмдэглэгээний хажууд гарна — 17 цэгийн
                аль нь болохыг заахад тусдаа тодруулга хэрэггүй.

                Нүхэн жорлонгийн горимд тайлбар БАЙХГҮЙ: тэнд харагдаж
                буй зүйл нь бодит цэг биш, ~220м-ийн нэгтгэсэн НҮД —
                "энэ цэг" гэж заах юм байхгүй.
              */}
              {hovered ? (
                <MapTip state={tip} width={224}>
                  <div className="px-2.5 pt-2 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                    Нийтийн ариун цэврийн байгууламж
                  </div>

                  <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                    <MapTipRow
                      icon={MapPin}
                      text={`${hovered.district}${
                        hovered.khoroo != null ? ` · ${hovered.khoroo}-р хороо` : ""
                      }`}
                    />
                  </div>

                  <div className="border-t border-line px-2.5 py-1.5">
                    <span className="num text-[10px] leading-none text-ink-3">
                      {hovered.lat.toFixed(5)}° {hovered.lon.toFixed(5)}°
                    </span>
                  </div>
                </MapTip>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS ·{" "}
            {pit
              ? `${num(data.lon.length)} нүдэнд хураасан (~220м)`
              : "бодит байршил"}
            {pit && data.unzoned > 0
              ? ` · бүс тодорхойгүй ${num(data.unzoned)}`
              : ""}
          </p>
        </div>

        {/* ---- БАРУУН: задаргаа ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
          {/* Бүс нь нийтийн жорлонд байхгүй хэмжигдэхүүн */}
          {pit ? (
            <Card className="shrink-0">
              <Head title="Бүсээр" />
              <div className="p-3">
                <CategoryChart data={zoneData} selected={zone} onSelect={setZone} />
              </div>
            </Card>
          ) : null}

          {/*
            Хорооны мөр нь ЗӨВХӨН нийтийн жорлон дээр сонгогдоно: нүхэн
            жорлонгийн нүд аль хороонд байгаагаа мэддэггүй тул сонголт нь
            газрын зурагт нөлөөлж чадахгүй — товшигддог мөнх дүр эсэргүү.
          */}
          <Card className="min-h-[120px] flex-1">
            {/* Дүүрэг + хороо хоёр шатлалыг агуулдаг тул нэр нь "хороогоор" биш */}
            <Head title="Байршлын мэдээлэл">
              <span className="num text-[11.5px] text-ink-3">{khorooData.length}</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/*
                Нүхэн жорлон дээр 111 хороо байдаг тул зөвхөн эхний
                дүүрэг задарсан байна; нийтийн жорлонгийн 15 мөр бүхэлдээ
                багтах тул бүгд нээлттэй. Хэрэглэгчийн хураалт нь
                хуудас дахин ачаалахад ҮЛДЭНЭ. Түлхүүр нь эх сурвалж
                тус бүрд тусдаа: хоёр самбарын бүлгийн бүрдэл ба анхны
                төлөв өөр тул нэг түлхүүрт хийвэл нөгөөгийнх нь
                сонголтыг дарж бичнэ.
              */}
              <GroupedRowChart
                groups={khorooGroups}
                selected={pit ? null : khoroo}
                onSelect={pit ? undefined : setKhoroo}
                selectedGroup={district}
                onSelectGroup={setDistrict}
                defaultOpen={pit ? "first" : "all"}
                storageKey={`orchin.toilets.${source}.groups`}
              />
            </div>
          </Card>
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
  icon: typeof Toilet;
}) {
  return (
    <div className="flex flex-col px-3 py-2">
      <span className="eyebrow block min-h-[28px] leading-[1.25]">{label}</span>
      <div className="mt-auto flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </div>
    </div>
  );
}
