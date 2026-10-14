"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  BadgeCheck,
  CalendarDays,
  CircleSlash,
  Footprints,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { BarChart, RowChart, type Datum } from "@/components/charts";
import {
  defaultBasemap,
  zoomForScale,
  type Basemap,
  type Extent,
  type MapOverlay,
} from "@/components/wells/map";
import { fetchUbDistricts, fetchUbKhoroos } from "@/lib/ub-districts";
import { Columns } from "@/components/ui/resizable-columns";
import { Bounds } from "@/lib/extent";
import {
  addBear,
  dateText,
  deleteBear,
  fetchBears,
  updateBear,
  type BearCase,
  type BearData,
  type BearInput,
} from "@/lib/bears";
import { FIREFLY } from "@/components/wells/colors";
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
   ХЭМЖЭЭСҮҮД — атрибут бүр нэг диаграм, нэг шүүлт
   --------------------------------------------------------------------------

   Хэрэглэгч 2026-10-14: "attribute дээрх бүх датаг гаргаарай" →
   "дата чартаар харагдана, шүүлт зөв ажиллах ёстой". Утгатай атрибут
   бүр ӨӨРИЙН диаграмтай; ганц утгатай гурав (он 2026, зүйл Хүрэн
   баавгай, латин Ursus arctos) нь диаграм болохгүй тул гарчгийн
   хажууд бичигдэнэ. Координат, эх файлын мөр нь цэг дээр дарахад
   нээгдэх цонхонд.

   ⚠ Хороо нь ДҮҮРГЭЭР БАЙ: "24-р хороо" нь хэд хэдэн дүүрэгт бий тул
   ганцаар нь тоолбол өөр газрууд нэг мөр болно.
*/

const NONE = "Бүртгэгдээгүй";

const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim() : NONE;

const DAY = 86_400_000;
const atKey = (k: string) =>
  Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));

/** Долоо хоног — ЭХЛЭХ өдрөөр (Даваа, UTC), "2026.09.08" хэлбэрийн түлхүүр */
function weekOf(ms: number | null) {
  if (ms == null) return NONE;
  const d = new Date(ms);
  return dateText(ms - ((d.getUTCDay() + 6) % 7) * DAY);
}

/** "09.08 – 09.14" — долоо хоногийн муж */
function weekText(k: string) {
  return k === NONE
    ? NONE
    : `${k.slice(5)} – ${dateText(atKey(k) + 6 * DAY).slice(5)}`;
}

/** Долоо хоногийн долоон өдөр */
function daysOfWeek(k: string) {
  return Array.from({ length: 7 }, (_, i) => dateText(atKey(k) + i * DAY));
}

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

/** Өдөр — "2026.09.30" хэлбэрийн түлхүүр (UTC) */
function dayOf(ms: number | null) {
  return ms == null ? NONE : dateText(ms);
}

type Dim = {
  id: string;
  title: string;
  keyOf: (r: BearCase) => string;
  /** Дараалал: тоогоор (анхдагч) эсвэл түлхүүрээр (хугацаа) */
  byKey?: boolean;
};

const DIMS: Dim[] = [
  { id: "district", title: "Дүүрэг", keyOf: (r) => r.district },
  {
    id: "khoroo",
    title: "Хороо",
    keyOf: (r) => {
      const k = str(r.attrs["хороо"]);
      return k === NONE ? NONE : `${r.district} · ${k}`;
    },
  },
  { id: "status", title: "Баталгаажилт", keyOf: (r) => r.status },
  {
    id: "age",
    title: "Нас / төлөв",
    keyOf: (r) => str(r.attrs["нас___төлөв"]),
  },
  /* Долоо хоног → тэр долоо хоногийн өдрүүд (хэрэглэгч 2026-10-14: "7
     хоногоор нь хараад 7 хоног дээр нь дарахад яг хэдэн хэдний өдөр гэдэг
     нь харагддаг"). Сар, өдрийн зэрэгцээ диаграмыг орлосон. */
  {
    id: "week",
    title: "Дуудлагын огноо",
    keyOf: (r) => weekOf(r.date),
    byKey: true,
  },
  {
    id: "day",
    title: "Дуудлагын өдөр",
    keyOf: (r) => dayOf(r.date),
    byKey: true,
  },
  /* ⚠ Газрын нэр ДИАГРАМ БИШ (хэрэглэгч 2026-10-14) — 22 нэр бүгд
     нэг удаагийнх тул цонхонд л гарна. */
  {
    id: "raw",
    title: "Зүйлийн эх бичилт",
    keyOf: (r) => str(r.attrs["зүйлийн_эх_бичилт"]),
  },
  /* ⚠ Тэмдэглэл ДИАГРАМ БИШ (хэрэглэгч 2026-10-14: "тусдаа чарт байх
     шаардлагагүй, pop up дээр харагдахад болно") — чөлөөт бичвэр. */
];

/**
 * НЭГ ХОРООНД ДАВТАГДСАН ТОХИОЛДОЛ — 2 ба түүнээс дээш бол өөр өнгөөр
 * (хэрэглэгч 2026-10-14). Хороо нь ДҮҮРГЭЭРЭЭ: "24-р хороо" олон
 * дүүрэгт бий. Хороо бүртгэгдээгүй тохиолдол бүлэгт ОРОХГҮЙ.
 * ⚠ Урьдын "нэг координатад 2+" дүрмийг орлосон — 47 тохиолдлын
 * координат бүгд өөр байсан тул тэр дүрэм юу ч тодруулдаггүй байв.
 */
const khorooKey = (r: BearCase) => {
  const k = str(r.attrs["хороо"]);
  return k === NONE ? null : `${r.district} · ${k}`;
};

/** Нийслэлийн есөн дүүрэг — маягтын сонголт */
const DISTRICTS = [
  "Багануур",
  "Багахангай",
  "Баянгол",
  "Баянзүрх",
  "Налайх",
  "Сонгинохайрхан",
  "Сүхбаатар",
  "Хан-Уул",
  "Чингэлтэй",
];

/** Зургийн тогтмол hex — газрын зураг горимоос үл хамаарна */
const ONE_HEX = FIREFLY.mid;
const MANY_HEX = "#e5b75a";

/*
  Баталгаажилтын шошгын өнгө — утгаас (хэрэглэгч 2026-10-14: "label
  өнгөнүүд сайжруулаарай"). Хиймэл дагуулын бараан дэвсгэр дээр
  уншигдахаар цайвар; дохиоллын гэр бүл: батлагдсан ноцтой (clay),
  мөр олдсон анхааруулга (ochre), олоогүй мэдээлэл (water), хуурамч
  (баавгай биш) ногоон, тодорхойгүй цагаан. ⚠ Цайвар саарал хувилбар
  хиймэл дагуул дээр уусч буцаагдсан — өнгө бүр ТОД, ханасан. Жагсаалтад байхгүй шинэ бичвэр цагаан.
  Баталгаажилтын диаграм ЯГ эдгээр өнгөтэй (шошгын тайлбар).
*/
const STATUS_HEX: Record<string, string> = {
  Батлагдсан: "#ff5a4e",
  "Мөр олдсон": "#ffcc3d",
  Олоогүй: "#5cb8ff",
  "Хуурамч (баавгай биш)": "#9ff07a",
  Тодорхойгүй: "#ffffff",
};

type Filters = Partial<Record<string, string>>;

const passes = (r: BearCase, f: Filters, skip?: string) =>
  DIMS.every((d) => d.id === skip || !f[d.id] || d.keyOf(r) === f[d.id]);

/**
 * Баавгай тохиолдлын бүртгэлийн самбар.
 *
 * ⚠⚠ ХУВААЛЦСАН порталын самбараас ЗОРИУДААР салсан (хэрэглэгч
 * 2026-10-14: "дүүргээр шүүхэд шал өөр юм гараад толгой эргүүлээд
 * байна"). Тэр самбар картуудаа ШҮҮГДСЭН тооноос байршуулдаг тул
 * нэг дүүрэг сонгоход карт баганаа сольж, зурвас бөгж болж байв.
 *
 * Энд БҮТЭЦ ТОГТМОЛ — шүүлт зөвхөн ТООГ өөрчилнө:
 *  · диаграм бүрийн байр, хэлбэр нь кодод тогтсон;
 *  · мөрийн ДАРААЛАЛ нь шүүгдээгүй нийт тооноос — мөр үсрэхгүй;
 *  · шүүлтэд тохирох тохиолдолгүй мөр 0-ээр үлдэнэ, алга болохгүй.
 *
 * Хөндлөн шүүлт: аль ч диаграмаас сонгоход бусад бүх диаграм,
 * үзүүлэлт, зураг дагана. Диаграм бүр ӨӨРИЙН хэмжээсийг алгасч
 * тоологдоно — эс тэгвээс сонгосноос бусад мөр тэг болж өөр утга руу
 * шилжих арга алга болно. Дахин товшиход шүүлт цуцлагдана.
 */
export function BearDashboard() {
  const [data, setData] = React.useState<BearData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<Filters>({});
  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  /** Нээлттэй маягт: шинэ тохиолдол (`oid: null`) эсвэл засаж буйх */
  const [form, setForm] = React.useState<{ oid: number | null } | null>(null);
  /** Маягтад бичсэн координат — зураг дээр урьдчилан тодруулна */
  const [preview, setPreview] = React.useState<[number, number] | null>(null);
  /** Засварын дараа дахин татах дохио */
  const [version, setVersion] = React.useState(0);
  /** Нийслэлийн дүүргийн хил — зургийн ард бүдэг */
  const [districtBnd, setDistrictBnd] =
    React.useState<GeoJSON.FeatureCollection | null>(null);
  /** Хорооны хил — 1:150 000-аас ойртоход */
  const [khorooBnd, setKhorooBnd] =
    React.useState<GeoJSON.FeatureCollection | null>(null);

  React.useEffect(() => {
    let alive = true;
    /* Хил нь нэмэлт мэдээлэл — татагдахгүй бол самбар хэвээр ажиллана */
    fetchUbDistricts()
      .then((d) => alive && setDistrictBnd(d))
      .catch(() => {});
    fetchUbKhoroos()
      .then((d) => alive && setKhorooBnd(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /*
    Хоёр шатны хил — дата цэгийн ДООР суурь болж (хэрэглэгч 2026-10-14:
    "хилүүд нилээн замбараагүй … дүүрэг, хороо хил арай өөр өөр өнгөөр").
    · ДҮҮРЭГ — цагаан бүтэн зураас, нэртэй; бүх масштабад.
    · ХОРОО — нимгэн ЯГААН-ЛАВАНДА тасархай зураас (хэрэглэгчийн
      сонголт); 1:100 000-аас ойртоход (хэрэглэгч 2026-10-14). Нэр нь
      1:40 000-аас. Өнгө нь цэгийн цэнхэр, шаргалтай давхцахгүй.
    · Дүүргэлтгүй. Зургийн өөрийн засаг захиргааны хилийг унтраана
      (`adminLines={false}`) — дүүргийн хилтэй давхцаж хос зураас үүсгэж
      байв.
    ⚠ Хороо эхэнд: хоёр хил давхцах газар дүүргийн зураас дээр үлдэнэ.
  */
  const overlays = React.useMemo<MapOverlay[] | undefined>(() => {
    const list: MapOverlay[] = [];
    if (khorooBnd)
      list.push({
        id: "ub-khoroos",
        data: khorooBnd,
        minzoom: zoomForScale(100_000),
        line: { color: "#c9b8ff", opacity: 0.55, width: 0.7, style: "dash" },
        label: {
          field: "name",
          size: 6.5,
          color: "#d9ceff",
          minzoom: zoomForScale(40_000),
        },
      });
    if (districtBnd)
      list.push({
        id: "ub-districts",
        data: districtBnd,
        line: { color: "#ffffff", opacity: 0.78, width: 1.2 },
        /* Дүүргийн нэр — цэгийн шошготой нэг фонт, арай том: газар
           нутгийн нэр нь цэгийн шошгоос дээд эрэмбийнх */
        label: { field: "soum_name", size: 7.5, color: "#ffffff" },
      });
    return list.length ? list : undefined;
  }, [districtBnd, khorooBnd]);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchBears(ac.signal)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, [version]);

  const rows = React.useMemo(() => data?.rows ?? [], [data]);

  const setFilter = React.useCallback((id: string, v: string | null) => {
    setFilters((f) => ({ ...f, [id]: v ?? undefined }));
  }, []);

  const shown = React.useMemo(
    () => rows.filter((r) => passes(r, filters)),
    [rows, filters],
  );

  /** Диаграм бүрийн мөрүүд — дараалал нь шүүгдээгүй, тоо нь бусад шүүлтээр */
  const charts = React.useMemo(() => {
    const out: Record<string, Datum[]> = {};
    for (const d of DIMS) {
      const total = new Map<string, number>();
      const count = new Map<string, number>();
      for (const r of rows) {
        /* Хороо нь ДҮҮРГИЙН дотор: дүүрэг сонгосон бол зөвхөн тэр
           дүүргийн хороо жагсана (хэрэглэгч 2026-10-14) */
        if (
          d.id === "khoroo" &&
          filters.district &&
          r.district !== filters.district
        )
          continue;
        const k = d.keyOf(r);
        total.set(k, (total.get(k) ?? 0) + 1);
        if (passes(r, filters, d.id)) count.set(k, (count.get(k) ?? 0) + 1);
      }
      const sorted = [...total.keys()].sort((a, b) =>
        d.byKey
          ? a.localeCompare(b)
          : /* "Бүртгэгдээгүй" нь эцэст — дутуу бөглөлт гол задаргааг түрүүлэхгүй */
            Number(a === NONE) - Number(b === NONE) ||
            total.get(b)! - total.get(a)! ||
            a.localeCompare(b, "mn"),
      );
      /* Өдөр нь ЗӨВХӨН сонгосон долоо хоногийн долоон өдөр */
      const keys =
        d.id === "week"
          ? sorted
          : d.id === "day"
            ? filters.week && filters.week !== NONE
              ? daysOfWeek(filters.week)
              : []
            : sorted;
      const list = keys.map((k) => ({
        key: k,
        label: d.id === "week" ? weekText(k) : k,
        value: count.get(k) ?? 0,
      }));
      /* Дүүрэг, хороонд шүүлтэд тохирохгүй (0) мөр ГАРАХГҮЙ (хэрэглэгч
         2026-10-14: "зөвхөн шүүгдсэн дүүрэг хороо л үлдэнэ, 0 мэдээлэлтэй
         бол харагдах албагүй"). Бусад диаграмд 0 мөр хэвээр — тэнд
         ангиллын бүрэн жагсаалт нь өөрөө мэдээлэл. Өөрийн сонголт нь
         алгасагдсан тул сонгосон мөр алга болохгүй. */
      /* Долоо хоногт ч 0 багана ГАРАХГҮЙ (хэрэглэгч 2026-10-14: "0 7 хоног
         хэрэггүй") — тохиолдолтой долоо хоногууд л дараалан */
      out[d.id] =
        d.id === "district" || d.id === "khoroo" || d.id === "week"
          ? list.filter((x) => x.value > 0)
          : list;
    }
    return out;
  }, [rows, filters]);

  /** Хороо бүрийн тохиолдлын тоо — шүүлтээс үл хамаарна */
  const perKhoroo = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = khorooKey(r);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  const colors = React.useMemo(
    () =>
      rows.map((r) => {
        const k = khorooKey(r);
        return k && (perKhoroo.get(k) ?? 0) > 1 ? MANY_HEX : ONE_HEX;
      }),
    [rows, perKhoroo],
  );
  const repeated = React.useMemo(
    () => [...perKhoroo.values()].filter((n) => n > 1).length,
    [perKhoroo],
  );

  /*
    ЗУРГИЙН ШОШГО — баталгаажилт (хэрэглэгч 2026-10-14: "map-ийн label
    баталгаажилтаар асаа"). Индекс нь `points`-тэй ижил (`fetchBears`
    хоёуланг нэг дарааллаар угсарна). Давхцсан шошгыг зураг өөрөө нуудаг.
    ⚠ 1:150 000-аас ОЙРТСОН үед, жижиг бичвэрээр (хэрэглэгч
    2026-10-14: эхлээд 1:300 000, дараа нь "label 150 000 болгоё") —
    анхны харагдацад (1:700 000 орчим) 47 шошго хотыг бүрхэж байв.
    ⚠ `labels` проп ҮРГЭЛЖ дамжина: зураг шошгын давхаргыг ЭХНИЙ
    зурагдалтад л үүсгэдэг.
  */
  const labels = React.useMemo(
    () => ({
      text: rows.map((r) => (r.status === NONE ? "" : r.status)),
      minzoom: zoomForScale(150_000),
      /* Хиймэл дагуул дээр уншигдахаар том, зузаан бараан хүрээтэй
         (хэрэглэгч 2026-10-14: "хаана юу байгаа нь мэдэгдэхгүй") */
      size: 7,
      halo: 1.4,
      colors: STATUS_HEX,
    }),
    [rows],
  );

  const visible = React.useMemo(() => {
    if (!data) return new Uint32Array(0);
    const on = new Set(shown.map((r) => r.oid));
    const out: number[] = [];
    data.points.oid.forEach((oid, i) => {
      if (on.has(oid)) out.push(i);
    });
    return Uint32Array.from(out);
  }, [data, shown]);

  /* Сонгосон тохиолдол шүүлтээс гарвал сонголт ДАМ цуцлагдана */
  const chosen = React.useMemo(
    () =>
      picked == null ? null : (shown.find((r) => r.oid === picked) ?? null),
    [shown, picked],
  );

  const active = Object.values(filters).filter(Boolean).length;

  /* Шүүлт тавьвал үлдсэн бүхнийг, тохиолдол сонговол түүнийг багтаана */
  const focus = React.useMemo<Extent | null>(() => {
    if (preview) {
      const b = new Bounds();
      b.add(preview[0], preview[1]);
      return b.get(0.01);
    }
    if (!chosen && !active) return null;
    const b = new Bounds();
    for (const r of chosen ? [chosen] : shown) b.add(r.lon, r.lat);
    return b.get(chosen ? 0.01 : 0.02);
  }, [shown, chosen, active, preview]);

  const stats = React.useMemo(() => {
    const c = (s: string) => shown.filter((r) => r.status === s).length;
    return {
      n: shown.length,
      confirmed: c("Батлагдсан"),
      track: c("Мөр олдсон"),
      fake: c("Хуурамч (баавгай биш)"),
      harm: shown.filter((r) => str(r.attrs["хохирол"]) !== NONE).length,
    };
  }, [shown]);

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">Эх сурвалж татагдсангүй</p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Баавгай тохиолдлын бүртгэл татаж байна…
          </span>
        )}
      </div>
    );
  }

  /* Ганц утгатай атрибутууд — диаграм биш, гарчгийн хажууд */
  const first = rows[0]?.attrs;
  const constant = [first?.["зүйлийн_монгол_нэр"], first?.["латин_нэр"]]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" · ");

  const chart = (id: string, kind: "row" | "bar" = "row") => {
    const d = DIMS.find((x) => x.id === id)!;
    return (
      <Card key={id} className="shrink-0">
        <Head title={d.title}>
          {filters[id] ? (
            <button
              onClick={() => setFilter(id, null)}
              className="flex items-center gap-1 text-[10.5px] text-ink-3 hover:text-ink"
            >
              <X size={11} /> Цуцлах
            </button>
          ) : null}
        </Head>
        <div className="p-3">
          {kind === "bar" ? (
            <BarChart
              data={charts[id]}
              height={120}
              labels
              unit="тохиолдол"
              selected={filters[id] ?? null}
              onSelect={(k) => setFilter(id, k)}
              formatTick={(x) => (x.key === NONE ? "—" : x.key.slice(5))}
            />
          ) : (
            <RowChart
              data={charts[id]}
              dense
              /* Баталгаажилт — зургийн шошготой ЯГ ижил өнгө (хэрэглэгч
                 2026-10-14). `clamp` өнгөт цэгийг тайрдаг тул хамт биш.
                 Цагааныг `--ink`-ээр: харанхуйд цагаан, гэрэлд уусахгүй. */
              clamp={id !== "status"}
              colorOf={
                id === "status"
                  ? (x) =>
                      x.key === "Тодорхойгүй"
                        ? "var(--ink)"
                        : (STATUS_HEX[x.key] ?? "var(--ink-3)")
                  : undefined
              }
              selected={filters[id] ?? null}
              onSelect={(k) => setFilter(id, k)}
            />
          )}
        </div>
      </Card>
    );
  };

  /*
    Огноо: ДОЛОО ХОНОГООР; багана дарахад тэр долоо хоног шүүлт болж, доор
    нь долоон өдөр нь гарна — өдөр дарахад тэр өдрөөр шүүнэ.
  */
  const pickWeek = (k: string | null) =>
    /* Долоо хоног солигдоход өдрийн шүүлт цуцлагдана — өөр долоо хоногийн
       өдөр харагдахгүй атлаа самбарыг хумисаар үлдэх ёсгүй */
    setFilters((f) => ({ ...f, week: k ?? undefined, day: undefined }));

  const dateChart = () => {
    const week = filters.week && filters.week !== NONE ? filters.week : null;
    return (
      <Card className="shrink-0">
        <Head
          title={
            week
              ? `Дуудлагын огноо · ${weekText(week)}`
              : "Дуудлагын огноо, долоо хоногоор"
          }
        >
          {filters.week || filters.day ? (
            <button
              onClick={() => pickWeek(null)}
              className="flex items-center gap-1 text-[10.5px] text-ink-3 hover:text-ink"
            >
              <X size={11} /> Цуцлах
            </button>
          ) : null}
        </Head>
        <div className="space-y-3 p-3">
          <div className="bar-chart-open-ticks">
            <BarChart
              data={charts.week}
              height={110}
              labels
              unit="тохиолдол"
              selected={filters.week ?? null}
              onSelect={pickWeek}
              formatTick={(x, i) =>
                /* Хоёр долоо хоног тутамд — баганын өргөнд "09.08" багтахгүй */
                x.key === NONE ? "—" : charts.week.length <= 8 || i % 2 === 0 ? x.key.slice(5) : ""
              }
            />
          </div>
          {week ? (
            <div className="border-t border-line pt-2">
              <span className="mb-1 block text-[10.5px] text-ink-3">
                Өдрөөр
              </span>
              <BarChart
                data={charts.day}
                height={84}
                labels
                unit="тохиолдол"
                selected={filters.day ?? null}
                onSelect={(k) => setFilter("day", k)}
                formatTick={(x) => x.key.slice(5)}
                sub={(x) => WEEKDAYS[charts.day.indexOf(x)] ?? ""}
              />
            </div>
          ) : null}
        </div>
      </Card>
    );
  };

  const menu = (id: string, icon: typeof MapPin) => {
    const d = DIMS.find((x) => x.id === id)!;
    return (
      <FilterMenu
        key={id}
        label={d.title}
        icon={icon}
        value={charts[id].find((x) => x.key === filters[id])?.label ?? filters[id] ?? null}
        active={Boolean(filters[id])}
        onClear={() => setFilter(id, null)}
        width={240}
      >
        <PickList
          items={charts[id]}
          selected={filters[id] ?? null}
          onPick={(k) => setFilter(id, k)}
        />
      </FilterMenu>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Баавгай тохиолдлын бүртгэл"
        activeCount={active}
        onReset={() => {
          setFilters({});
          setPicked(null);
        }}
        leading={
          constant ? (
            <span className="text-[11.5px] text-ink-3">{constant}</span>
          ) : null
        }
      >
        {menu("district", MapPin)}
        {menu("status", ShieldCheck)}
        {menu("week", CalendarDays)}
      </FilterBar>

      <Card className="shrink-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-5 sm:divide-y-0">
          <Stat icon={Footprints} label="Тохиолдлын тоо" value={num(stats.n)} />
          <Stat
            icon={BadgeCheck}
            label="Батлагдсан"
            value={num(stats.confirmed)}
          />
          <Stat icon={Footprints} label="Мөр олдсон" value={num(stats.track)} />
          <Stat
            icon={CircleSlash}
            label="Хуурамч (баавгай биш)"
            value={num(stats.fake)}
          />
          <Stat
            icon={TriangleAlert}
            label="Хохиролтой"
            value={num(stats.harm)}
          />
        </div>
      </Card>

      <Columns
        layout="flex"
        id="bear-2"
        left={300}
        right={320}
        className="min-h-0 flex-1"
      >
        {/* ---- ЗҮҮН: байршлын задаргаа ---- */}
        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto xl:w-(--col-l) xl:shrink-0">
          {chart("district")}
          {chart("khoroo")}
        </div>

        {/* ---- ГОЛ: газрын зураг ---- */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <Card className="relative min-h-[300px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              <PointMap
                points={data.points}
                visible={visible}
                basemap={basemap}
                onSelect={(oid) => setPicked(picked === oid ? null : oid)}
                focus={focus}
                highlight={
                  preview ?? (chosen ? [chosen.lon, chosen.lat] : null)
                }
                colors={colors}
                labels={labels}
                overlays={overlays}
                adminLines={false}
                cluster={false}
              />
              {/* Өнгөний тайлбар — давталттай хороо байгаа үед л */}
              {repeated > 0 ? (
                <div className="absolute bottom-8 left-2.5 z-10 space-y-1 rounded-xs border border-line bg-paper/95 px-2 py-1.5 text-[11px] text-ink-2 backdrop-blur-md">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: ONE_HEX }}
                    />
                    Нэг тохиолдол
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: MANY_HEX }}
                    />
                    Нэг хороонд 2 ба түүнээс дээш
                  </div>
                </div>
              ) : null}
              <BasemapGallery value={basemap} onChange={setBasemap} />
              {!form ? (
                <button
                  onClick={() => {
                    setPicked(null);
                    setForm({ oid: null });
                  }}
                  className="elevated absolute top-2.5 left-2.5 z-10 flex h-8 items-center gap-1.5 rounded-xs border border-line-2 bg-paper/95 px-2.5 text-[12px] font-medium text-ink backdrop-blur-md transition-colors hover:bg-paper-hi"
                >
                  <Plus size={14} /> Тохиолдол нэмэх
                </button>
              ) : null}
              {form ? (
                <BearForm
                  key={form.oid ?? "new"}
                  initial={
                    form.oid != null
                      ? rows.find((r) => r.oid === form.oid)
                      : undefined
                  }
                  rows={rows}
                  onPreview={setPreview}
                  onCancel={() => {
                    setForm(null);
                    setPreview(null);
                  }}
                  onSubmit={async (v) => {
                    let oid = form.oid;
                    if (oid != null) await updateBear(oid, v);
                    else
                      oid =
                        (await addBear(
                          v,
                          rows.reduce(
                            (m, r) => Math.max(m, Number(r.attrs["д_д"]) || 0),
                            0,
                          ) + 1,
                        )) ?? null;
                    setForm(null);
                    setPreview(null);
                    /* Шинэ, засагдсан тохиолдол шүүлтэд унахгүй байхаар шүүлтийг цэвэрлэнэ */
                    setFilters({});
                    setPicked(oid);
                    setVersion((n) => n + 1);
                  }}
                />
              ) : chosen ? (
                <div className="elevated absolute right-2.5 bottom-2.5 z-10 flex max-h-[calc(100%-1.25rem)] w-[290px] flex-col rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow">Тохиолдол</span>
                    <button
                      onClick={() => setPicked(null)}
                      aria-label="Хаах"
                      className="text-ink-3 transition-colors hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <CaseCard
                    r={chosen}
                    onEdit={() => setForm({ oid: chosen.oid })}
                    onDelete={async () => {
                      await deleteBear(chosen.oid);
                      setPicked(null);
                      setVersion((n) => n + 1);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        {/* ---- БАРУУН: тохиолдлын шинж ---- */}
        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto xl:w-(--col-r) xl:shrink-0">
          {chart("status")}
          {dateChart()}
          {chart("age")}
          {chart("raw")}
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Хоосон, "Бүртгэгдээгүй" утгыг "" болгоно */
const val = (v: unknown) => {
  const t = str(v);
  return t === NONE ? "" : t;
};

/**
 * Тохиолдлын цонх — ЗӨВХӨН чухал, ДАВХАРДАЛГҮЙ мэдээлэл (хэрэглэгч
 * 2026-10-14: "pop up дээр мэдээлэл давхцалгүй, цэгцтэй, чухал
 * мэдээллүүд л харагдана").
 *
 * Хасагдсан нь бүгд ДАВХАРДАЛ эсвэл техникийн:
 *  · он, сар, өдөр — дуудлагын огнооны задаргаа;
 *  · дуудлага өгсөн хаяг (эх) — дүүрэг, хороо, газрын нэрийн нийлбэр;
 *  · координатын эх бичилт — өргөрөг, уртрагийн хуулбар;
 *  · зүйлийн нэр, латин нэр — бүх тохиолдолд ижил (гарчгийн хажууд бий);
 *  · д/д, эх файлын мөр — бүртгэлийн дугаарлалт.
 * Хоосон мөр огт гарахгүй.
 */
function CaseCard({
  r,
  onEdit,
  onDelete,
}: {
  r: BearCase;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const a = r.attrs;
  const khoroo = val(a["хороо"]);
  const harm = val(a["хохирол"]);
  const rows: [string, string][] = [
    ["Байршил", [r.district, khoroo].filter(Boolean).join(" · ")],
    ["Газрын нэр", val(a["газрын_нэр"])],
    ["Нас / төлөв", val(a["нас___төлөв"])],
    ["Эх бичилт", val(a["зүйлийн_эх_бичилт"])],
    ["Тэмдэглэл", val(a["тэмдэглэл__эх_"])],
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] leading-snug font-medium text-ink">
          {r.status}
        </span>
        {r.date != null ? (
          <span className="num shrink-0 text-[11px] text-ink-3">
            {dateText(r.date)}
          </span>
        ) : null}
      </div>
      {harm ? (
        <p className="mt-1.5 rounded-xs border border-clay/40 bg-clay/10 px-2 py-1 text-[11.5px] leading-snug text-clay">
          {harm}
        </p>
      ) : null}
      <dl className="mt-2 space-y-1.5 border-t border-line pt-2">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-[78px] shrink-0 text-[10.5px] leading-snug text-ink-3">
                {k}
              </dt>
              <dd className="min-w-0 flex-1 text-[11.5px] leading-snug break-words text-ink-2">
                {v}
              </dd>
            </div>
          ))}
      </dl>
      <p className="num mt-2 border-t border-line pt-1.5 text-[10.5px] text-ink-3">
        {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
      </p>
      {err ? (
        <p className="mt-1.5 text-[11px] leading-snug text-clay">{err}</p>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-2">
        {confirm ? (
          <>
            <span className="text-[11.5px] text-clay">Устгах уу?</span>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await onDelete();
                } catch (e) {
                  setErr((e as Error).message);
                  setBusy(false);
                }
              }}
              className="ml-auto h-7 rounded-xs bg-clay px-2.5 text-[11.5px] font-medium text-white disabled:opacity-60"
            >
              {busy ? "Устгаж байна…" : "Тийм, устгах"}
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirm(false)}
              className="h-7 rounded-xs border border-line-2 px-2.5 text-[11.5px] text-ink-2"
            >
              Болих
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="flex h-7 items-center gap-1 rounded-xs border border-line-2 px-2.5 text-[11.5px] text-ink-2 hover:bg-paper-hi"
            >
              <Pencil size={12} /> Засах
            </button>
            <button
              onClick={() => setConfirm(true)}
              className="flex h-7 items-center gap-1 rounded-xs border border-line-2 px-2.5 text-[11.5px] text-clay hover:bg-paper-hi"
            >
              <Trash2 size={12} /> Устгах
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Тохиолдол нэмэх, засах маягт.
 *
 * Талбарууд нь давхаргын атрибутын загвар — зөвхөн ХҮН БИЧДЭГ хэсэг.
 * Он, сар, өдөр, координатын эх бичилт, зүйлийн нэр нь ДАМ бөглөгдөнө
 * ({@link addBear}). Бичсэн координат зураг дээр шууд тодорч, зураг
 * түүн рүү ойртоно — буруу бичсэнийг хадгалахаас өмнө харна.
 */
function BearForm({
  initial,
  rows,
  onPreview,
  onCancel,
  onSubmit,
}: {
  initial?: BearCase;
  rows: BearCase[];
  onPreview: (p: [number, number] | null) => void;
  onCancel: () => void;
  onSubmit: (v: BearInput) => Promise<void>;
}) {
  const a = initial?.attrs ?? {};
  const [v, setV] = React.useState({
    lat: initial ? String(initial.lat) : "",
    lon: initial ? String(initial.lon) : "",
    date:
      initial?.date != null ? dateText(initial.date).replaceAll(".", "-") : "",
    district: initial && initial.district !== NONE ? initial.district : "",
    khoroo: val(a["хороо"]),
    place: val(a["газрын_нэр"]),
    address: val(a["дуудлага_өгсөн_хаяг__эх_"]),
    status: initial && initial.status !== NONE ? initial.status : "",
    age: val(a["нас___төлөв"]),
    raw: val(a["зүйлийн_эх_бичилт"]),
    harm: val(a["хохирол"]),
    note: val(a["тэмдэглэл__эх_"]),
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  /* "47.9, 106.9" гэж нэг талбарт буулгавал хоёр хуваана */
  const onLat = (e: { target: { value: string } }) => {
    const m = e.target.value.match(
      /^\s*(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)\s*$/,
    );
    if (m) setV((x) => ({ ...x, lat: m[1], lon: m[2] }));
    else set("lat")(e);
  };

  const lat = Number(v.lat);
  const lon = Number(v.lon);
  /* Монголын нутгийн хүрээ — өргөрөг, уртрагийг сольж бичихээс сэргийлнэ */
  const coordOk =
    v.lat.trim() !== "" &&
    v.lon.trim() !== "" &&
    lat >= 41 &&
    lat <= 52.5 &&
    lon >= 87 &&
    lon <= 120;

  React.useEffect(() => {
    onPreview(coordOk ? [lon, lat] : null);
  }, [coordOk, lat, lon, onPreview]);

  const uniq = (key: string) =>
    [...new Set(rows.map((r) => val(r.attrs[key])).filter(Boolean))].sort(
      (x, y) => x.localeCompare(y, "mn"),
    );
  const statuses = [
    ...new Set([
      "Батлагдсан",
      "Мөр олдсон",
      "Олоогүй",
      "Хуурамч (баавгай биш)",
      "Тодорхойгүй",
      ...uniq("баталгаажилт"),
    ]),
  ];
  const khoroos = [
    ...new Set(
      rows
        .filter((r) => !v.district || r.district === v.district)
        .map((r) => val(r.attrs["хороо"]))
        .filter(Boolean),
    ),
  ].sort((x, y) => x.localeCompare(y, "mn", { numeric: true }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!coordOk) {
      setErr(
        "Координатыг Монголын нутгийн хүрээнд бичнэ үү (өргөрөг 41–52.5, уртраг 87–120).",
      );
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        lat,
        lon,
        date: v.date
          ? Date.UTC(
              +v.date.slice(0, 4),
              +v.date.slice(5, 7) - 1,
              +v.date.slice(8, 10),
            )
          : null,
        district: v.district,
        khoroo: v.khoroo,
        place: v.place,
        address: v.address,
        age: v.age,
        raw: v.raw,
        status: v.status,
        harm: v.harm,
        note: v.note,
      });
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  const input =
    "h-7 w-full min-w-0 rounded-xs border border-line-2 bg-paper px-2 text-[12px] text-ink outline-none focus:border-(--data)";

  return (
    <form
      onSubmit={submit}
      className="elevated absolute top-2.5 right-2.5 bottom-2.5 z-20 flex w-[310px] flex-col rounded-xs border border-line-2 bg-paper/95 backdrop-blur-md"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
        <span className="eyebrow">
          {initial ? "Тохиолдол засах" : "Шинэ тохиолдол"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Хаах"
          className="text-ink-3 hover:text-ink"
        >
          <X size={12} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
        <div className="grid grid-cols-2 gap-1.5">
          <FormRow label="Өргөрөг *">
            <input
              className={cn(input, "num")}
              value={v.lat}
              onChange={onLat}
              placeholder="47.9185"
              inputMode="decimal"
              required
            />
          </FormRow>
          <FormRow label="Уртраг *">
            <input
              className={cn(input, "num")}
              value={v.lon}
              onChange={set("lon")}
              placeholder="106.9177"
              inputMode="decimal"
              required
            />
          </FormRow>
        </div>
        <FormRow label="Дуудлагын огноо">
          <input
            type="date"
            className={cn(input, "num")}
            value={v.date}
            onChange={set("date")}
          />
        </FormRow>
        <div className="grid grid-cols-2 gap-1.5">
          <FormRow label="Дүүрэг">
            <select
              className={input}
              value={v.district}
              onChange={set("district")}
            >
              <option value="">—</option>
              {DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Хороо">
            <input
              className={input}
              value={v.khoroo}
              onChange={set("khoroo")}
              list="bear-khoroo"
              placeholder="24-р хороо"
            />
            <datalist id="bear-khoroo">
              {khoroos.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </FormRow>
        </div>
        <FormRow label="Газрын нэр">
          <input className={input} value={v.place} onChange={set("place")} />
        </FormRow>
        <FormRow label="Дуудлага өгсөн хаяг">
          <input
            className={input}
            value={v.address}
            onChange={set("address")}
          />
        </FormRow>
        <FormRow label="Баталгаажилт">
          {/* Жагсаалтаас сонгох ЭСВЭЛ шинээр бичих (хэрэглэгч 2026-10-14) */}
          <input
            className={input}
            value={v.status}
            onChange={set("status")}
            list="bear-status"
          />
          <datalist id="bear-status">
            {statuses.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </FormRow>
        <div className="grid grid-cols-2 gap-1.5">
          <FormRow label="Нас / төлөв">
            <input
              className={input}
              value={v.age}
              onChange={set("age")}
              list="bear-age"
            />
            <datalist id="bear-age">
              {[
                ...new Set([
                  "Бамбарууш",
                  "Шүдлэн",
                  "Нас бие гүйцсэн",
                  ...uniq("нас___төлөв"),
                ]),
              ].map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </FormRow>
          <FormRow label="Эх бичилт">
            <input
              className={input}
              value={v.raw}
              onChange={set("raw")}
              placeholder="баавгай"
            />
          </FormRow>
        </div>
        <FormRow label="Хохирол">
          <input className={input} value={v.harm} onChange={set("harm")} />
        </FormRow>
        <FormRow label="Тэмдэглэл">
          <textarea
            className={cn(input, "h-16 resize-none py-1.5 leading-snug")}
            value={v.note}
            onChange={set("note")}
          />
        </FormRow>
        {err ? (
          <p className="text-[11px] leading-snug text-clay">{err}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-line px-2.5 py-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-7 rounded-xs border border-line-2 px-2.5 text-[11.5px] text-ink-2"
        >
          Болих
        </button>
        <button
          type="submit"
          disabled={busy}
          className="h-7 rounded-xs bg-(--data) px-3 text-[11.5px] font-medium text-paper disabled:opacity-60"
        >
          {busy ? "Хадгалж байна…" : "Хадгалах"}
        </button>
      </div>
    </form>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-0.5 block text-[10.5px] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xs border border-line bg-paper-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Head({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
      <h2 className="display text-[12px] leading-none tracking-[0.04em] uppercase">
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
  icon: typeof Footprints;
}) {
  return (
    <div className="px-3 py-2.5">
      <span className="eyebrow block leading-[1.25]">{label}</span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}
