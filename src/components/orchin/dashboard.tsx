"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Droplets,
  Gauge,
  Info,
  LandPlot,
  Layers3,
  Loader2,
  MapPin,
  Toilet,
} from "lucide-react";
import {
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
  fetchToilets,
  fetchCityToilets,
  PLI_BUCKETS,
  PLI_MIN,
  PLI_STEP,
  ZONES,
  type CityToilet,
  type ToiletPoints,
  type ToiletsPayload,
} from "@/lib/toilets";
import { pliColor } from "@/lib/soil";
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
  const [cityStatus, setCityStatus] = React.useState<"loading" | "ready" | "error">("loading");
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
  /** Хорооны сонголт нь түүхий цэгийн хорооны кодоор шүүнэ. */
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

    /*
      ⚠ НЭГ ТАТАЦ, ХОЁР ҮР ДҮН. Урьд нь нэгтгэсэн мэдээ (`api/toilets`) ба
      түүхий цэгийн хоёртын багц (`api/toilet-points`) гэсэн хоёр статик
      зам байсныг хассан: эх сурвалж хамгаалагдсан порталд шилжсэнээр
      бүтээх мөчид токен авах аргагүй болсон тул нэгтгэл хөтөч рүү
      зөөгдсөн. Хоёулаа нэг явцаас гарна.

      Татац ~11.4MB, найман зэрэгцээ урсгалаар ~3 секунд. Хариуд нь дата
      бүтээх мөчид хөлдөхөө болив.
    */
    fetchToilets(ac.signal)
      .then((d) => {
        setData(d.payload);
        setRaw(d.points);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });

    // Нийтийн жорлон нь 17 бичлэг — шууд ArcGIS-ээс, алдааг нь залгина
    fetchCityToilets(ac.signal)
      .then((rows) => { setCity(rows); setCityStatus("ready"); })
      .catch((e: Error) => { if (e.name !== "AbortError") setCityStatus("error"); });

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
    const kAt = khoroo ? raw.khoroos.indexOf(khoroo) : -1;
    if (khoroo && kAt < 0) return { oid: [], lon: [], lat: [], w: [] as number[] };

    const oid: number[] = [];
    const lon: number[] = [];
    const lat: number[] = [];
    for (let i = 0; i < raw.n; i++) {
      if (dAt >= 0 && raw.district[i] !== dAt) continue;
      if (zAt && raw.zone[i] !== zAt) continue;
      if (kAt >= 0 && raw.khoroo[i] !== kAt) continue;
      oid.push(i);
      lon.push(raw.coords[i * 2]);
      lat.push(raw.coords[i * 2 + 1]);
    }
    return { oid, lon, lat, w: new Array<number>(oid.length).fill(1) };
  }, [raw, cells, district, zone, khoroo]);

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
      /* Тоо ба жигнэсэн дундаж PLI хоёуланг нэг гүйлтээр — өнгө нь
         тухайн бүсийн дундаж PLI (шүүлтийг дагана) */
      let n = 0;
      let sum = 0;
      const add = (table: number[], unit: number) => {
        for (let b = 0; b < PLI_BUCKETS; b++) {
          const c = table[(unit * 4 + zi) * PLI_BUCKETS + b];
          if (!c) continue;
          n += c;
          sum += (PLI_MIN + b * PLI_STEP) * c;
        }
      };
      const ki = khoroo ? data.khoroos.indexOf(khoroo) : -1;
      if (ki >= 0) add(data.khZonePli, ki);
      else {
        for (let d = 0; d < data.districts.length; d++) {
          if (dIdx >= 0 && d !== dIdx) continue;
          add(data.distZonePli, d);
        }
      }
      return { key: String(z), label: `${z}-р бүс`, value: n, color: n ? pliColor(sum / n) : undefined };
    }).filter((d) => d.value > 0);
  }, [data, dIdx, khoroo]);

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
        const { avg, n } = avgPli(data.khZonePli, k);
        if (n <= 0) continue;
        const dName = data.districts[data.khDistrict[k]] ?? "Тодорхойгүй";
        /*
          Код нь "СХД_20" хэлбэртэй — дугаарыг нь л мөрд үлдээнэ. Кодгүй
          бичлэг ("Тодорхойгүй") дээр "-р хороо" залгавал утгагүй нэр
          болох тул байгаагаар нь үлдээнэ.
        */
        const numPart = data.khoroos[k].split("_")[1];
        /* Зурвасын өнгө = хорооны дундаж PLI (хөрсний самбартай нэг
           шатлал, `lib/soil.ts`) — урт нь ТОО, өнгө нь ТҮВШИН */
        const row: Datum = {
          key: data.khoroos[k],
          label: numPart ? `${numPart}-р хороо` : data.khoroos[k],
          value: n,
          color: pliColor(avg),
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
      for (let i = 0; i < mapPoints.lon.length; i++) b.add(mapPoints.lon[i], mapPoints.lat[i]);
    } else {
      for (const c of cityRows) b.add(c.lon, c.lat);
    }
    return b.get(0.004);
  }, [pit, district, khoroo, zone, mapPoints, cityRows]);

  /* ---------------- Индикатор ---------------- */
  const stats = React.useMemo(() => {
    if (!data) return null;
    /*
      Шүүлтгүй үед эх сурвалжийн БҮТЭН тоог харуулна. Хөндлөн хүснэгт нь
      зөвхөн бүс тодорхойлогдсон бичлэгийг агуулдаг тул түүнийг нийлбэрлэвэл
      145,458 гарч, эх сурвалжийн 145,462-той зөрөх байв.
    */
    const total = mapPoints.oid.length;
    /** Жигнэсэн дундаж PLI — сонгосон дүүрэг(үүд)-ийн нийлбэрээр */
    let sum = 0;
    let cnt = 0;
    for (let d = 0; d < data.districts.length; d++) {
      if (dIdx >= 0 && d !== dIdx) continue;
      const { avg, n } = avgPli(data.distZonePli, d);
      sum += avg * n;
      cnt += n;
    }
    if (khoroo && pit) {
      const ki = data.khoroos.indexOf(khoroo);
      const selectedPli = ki >= 0 ? avgPli(data.khZonePli, ki) : { avg: 0, n: 0 };
      sum = selectedPli.avg * selectedPli.n;
      cnt = selectedPli.n;
    }

    return {
      total: pit ? total : cityRows.length,
      districts: pit ? district || khoroo ? (total > 0 ? 1 : 0) : districtData.length : new Set(cityRows.map((r) => r.district)).size,
      khoroos: pit ? khoroo ? (total > 0 ? 1 : 0) : khorooData.length : new Set(cityRows.map(khorooKey)).size,
      pli: cnt ? sum / cnt : 0,
    };
  }, [pit, data, districtData, khorooData, cityRows, dIdx, avgPli, mapPoints, khoroo, district]);

  /** Бүсийн шүүлтүүр нь зөвхөн нүхэн жорлонд утгатай */
  const activeCount =
    (district ? 1 : 0) + (pit && zone ? 1 : 0) + (khoroo ? 1 : 0);

  function pickDistrict(value: string | null) {
    setDistrict(value);
    setKhoroo(null);
  }

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
    setKhoroo(null);
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
                    {s.id === "pit" ? num(data.n) : cityStatus === "loading" ? "Татаж байна…" : cityStatus === "error" ? "Татаж чадсангүй" : city.length ? num(city.length) : "Бүртгэлгүй"}
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
          onClear={() => pickDistrict(null)}
          width={240}
        >
          <PickList items={districtData} selected={district} onPick={pickDistrict} />
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
      {khoroo && <div className="flex items-center gap-2 px-1 text-[12px] text-ink-2"><span>Сонгосон хороо: {khorooGroups.flatMap((g) => g.rows.map((r) => ({ ...r, district: g.label }))).filter((r) => r.key === khoroo).map((r) => `${r.district} · ${r.label}`).join(", ")}</span><button type="button" onClick={() => setKhoroo(null)} className="rounded border border-line px-2 py-1 text-data">Арилгах ×</button></div>}
      {!pit && cityStatus !== "ready" && <p role="status" className="px-3 text-[12px] text-ink-2">{cityStatus === "loading" ? "Нийтийн ариун цэврийн байгууламжийн мэдээллийг татаж байна…" : "Мэдээллийг татаж чадсангүй. Хуудсыг дахин ачаална уу."}</p>}
      {!pit && cityStatus === "ready" && city.length === 0 && <p className="px-3 text-[12px] text-ink-2">Бүртгэл байхгүй байна.</p>}

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
                value={!pit && cityStatus !== "ready" ? "—" : num(stats.total)}
              />
              <Stat icon={Building2} label="Дүүрэг" value={num(stats.districts)} />
              <Stat icon={LandPlot} label="Хороо" value={num(stats.khoroos)} />
              {pit ? (
                <Stat icon={Gauge} label="Дундаж PLI" value={stats.total ? stats.pli.toFixed(2) : "—"} description="PLI — бохирдлын ачааллын индекс" />
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
              ? raw ? "бодит байршлын нягтрал" : `${num(data.lon.length)} нүдэнд хураасан (~220м)`
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
              <Head title="Бүсийн тархалт"><PliKey /></Head>
              <div className="p-3">
                <ZoneBars data={zoneData} selected={zone} onSelect={setZone} />
              </div>
            </Card>
          ) : null}

          {/* Хорооны сонголт түүхий цэгийн байршил болон индикаторыг шүүнэ. */}
          <Card className="min-h-[120px] flex-1">
            {/* Дүүрэг + хороо хоёр шатлалыг агуулдаг тул нэр нь "хороогоор" биш */}
            <Head title="Байршлын мэдээлэл">
              {pit && <PliKey />}
              <span className="num text-[11.5px] text-ink-3">{khorooData.length} хороо</span>
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
                locationDetail
                groups={khorooGroups}
                selected={khoroo}
                onSelect={setKhoroo}
                selectedGroup={district}
                onSelectGroup={pickDistrict}
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

function Help({ text }: { text: string }) {
  return <span className="group relative inline-flex shrink-0 normal-case tracking-normal"><button type="button" aria-label={text} className="rounded text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-(--data)"><Info size={13} /></button><span role="tooltip" className="pointer-events-none absolute right-0 top-5 z-30 hidden w-60 max-w-[75vw] rounded-md border border-line bg-paper-2 p-3 text-[11px] font-normal leading-relaxed text-ink-2 shadow-lg group-hover:block group-focus-within:block">{text}</span></span>;
}

/**
 * PLI-ийн өнгөний ТҮЛХҮҮР — картын толгойд жижиг тасралтгүй тууз.
 *
 * Зурвасын өнгө нь дундаж PLI тул юу гэсэн үг болохыг таахаар
 * үлдээж болохгүй. Тууз нь `lib/soil.ts`-ийн шатлалаас гарна —
 * хөрсний самбартай нэг өнгө, нэг утга. Салангид дугуй биш ТУУЗ:
 * шатлал тасралтгүй тул дугуйнууд ангилал мэт уншуулна.
 * Тоо нь 1 ба 4 — энэ эх сурвалжийн PLI-ийн бодит муж.
 */
function PliKey() {
  const stops = [1, 1.5, 2, 2.5, 3, 4].map((v) => pliColor(v)).join(", ");
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-ink-3" aria-label="Зурвасын өнгө — дундаж PLI, 1-ээс 4">
      <span className="num">PLI 1</span>
      <span className="h-1.5 w-12 rounded-full" style={{ background: `linear-gradient(to right, ${stops})` }} />
      <span className="num">4</span>
    </span>
  );
}

function ZoneBars({ data, selected, onSelect }: { data: Datum[]; selected: string | null; onSelect: (key: string | null) => void }) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <p className="py-3 text-[12px] text-ink-3">Бүсийн бүртгэл байхгүй</p>;
  return <div>
    <div className="mb-2 flex items-center justify-between text-[11px] text-ink-3"><span>Бүсээр ангилсан бүртгэл</span><span className="num font-medium text-ink">{num(total)}</span></div>
    <div className="space-y-1">{data.map((row) => {
      const share = row.value / total * 100;
      const active = selected === row.key;
      return <button key={row.key} type="button" aria-pressed={active} onClick={() => onSelect(active ? null : row.key)} className={cn("block w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-paper-hi focus-visible:outline-2 focus-visible:outline-(--data)", active && "bg-paper-hi ring-1 ring-(--data)", selected && !active && "opacity-50")}>
        <span className="flex items-baseline justify-between gap-2 text-[12px]"><span>{row.label}</span><span className="num font-medium">{num(row.value)}<span className="ml-2 inline-block w-11 text-right text-[10.5px] font-normal text-ink-3">{share.toFixed(1)}%</span></span></span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-paper-hi"><span className="block h-full rounded-full transition-[width]" style={{ width: `${share}%`, background: row.color ?? "var(--data)" }} /></span>
      </button>;
    })}</div>
  </div>;
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
  description,
}: {
  label: string;
  value: string;
  icon: typeof Toilet;
  description?: string;
}) {
  return (
    <div className="flex flex-col px-3 py-2">
      <span className="eyebrow flex min-h-[28px] items-start gap-1.5 leading-[1.25]">{label}{description && <Help text={description} />}</span>
      <div className="mt-auto flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </div>
    </div>
  );
}
