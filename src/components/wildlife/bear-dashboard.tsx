"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  BadgeCheck,
  ChevronDown,
  CalendarDays,
  CircleSlash,
  Crosshair,
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
import { FOREST, FOREST_TABS } from "@/lib/forest-layers";
import {
  categoryKey,
  fetchLayerFeatures,
  fetchLayerInfo,
} from "@/lib/portal-layers";
import {
  fetchParcelsIn,
  NO_PARCELS,
  PARCEL_SCALE,
  type ParcelTile,
} from "@/lib/parcels";
import { oklchHex } from "@/components/wells/colors";
import { Columns } from "@/components/ui/resizable-columns";
import { Bounds } from "@/lib/extent";
import {
  addBear,
  dateText,
  deleteBear,
  fetchBears,
  located,
  updateBear,
  type BearCase,
  type BearData,
  type BearInput,
} from "@/lib/bears";
import { cn, num } from "@/lib/utils";

/*
  ОЙН ТӨРӨЛ — ойн самбарын "Ойн ялгарал"-ын бүлэг, өнгөтэй ЯГ ИЖИЛ
  (`FOREST.valueGroups` / `valueTones`): ой, ойжилт ногоон · эвдрэл
  улбар → улаан · ойгүй талбай шар → хүрэн. Нэг эх сурвалж тул хоёр
  самбар нэг төрлийг өөр өнгөөр харуулахгүй.
*/
const TYPE_LAYER = "O03_oi_yalgaral";
const FOREST_TYPES = (FOREST.valueGroups?.[TYPE_LAYER] ?? []).flatMap((g) =>
  g.keys.map((key) => {
    const t = FOREST.valueTones?.[TYPE_LAYER]?.[key] ?? [0.62, 0.075, 150];
    return { key, group: g.label, hex: oklchHex(t[0], t[1], t[2]) };
  }),
);
const OTHER_TYPE_HEX = oklchHex(0.7, 0.02, 250);

/*
  ОЙН ТӨРЛИЙН ЦОНХ (хэрэглэгч 2026-10-20: "map дээр ойн төрөл дээр
  дарахад pop up-тай болгоё"). Нэмэлт давхарга харилцдаггүй тул товшсон
  цэг аль дүрсэнд орсныг энд тогтооно — хүрээгээр шүүгээд цацраг татна.
*/
type Ring = number[][];
function polysOf(g: GeoJSON.Geometry | null): Ring[][] {
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates as Ring[]];
  if (g.type === "MultiPolygon") return g.coordinates as Ring[][];
  return [];
}
function inRing(x: number, y: number, r: Ring) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      ins = !ins;
  }
  return ins;
}
/** Цэг дүрсийн дотор эсэх — гадна цагирагт, нүхэнд биш */
function contains(f: GeoJSON.Feature, x: number, y: number) {
  const bb = f.bbox;
  if (bb && (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3])) return false;
  return polysOf(f.geometry).some(
    (poly) =>
      poly.length > 0 &&
      inRing(x, y, poly[0]) &&
      !poly.slice(1).some((h) => inRing(x, y, h)),
  );
}
/** Хайлт хурдан байх гэж дүрс бүрд хүрээ тавина */
function withBox(
  f: GeoJSON.Feature,
  properties: GeoJSON.GeoJsonProperties,
): GeoJSON.Feature {
  const b: [number, number, number, number] = [
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
  ];
  for (const poly of polysOf(f.geometry))
    for (const [x, y] of poly[0] ?? []) {
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
    }
  return { ...f, properties, bbox: b };
}
/** Талбарыг үсгийн том, жижгээс үл хамааран уншина */
const attrOf = (row: Record<string, unknown> | undefined, name: string) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name);
  return k ? row[k] : undefined;
};

/** Суурь давхаргын унтраалга — зургийн тайлбарын дээд хэсэг */
function BaseToggle({
  on,
  onChange,
  swatch,
  label,
  note,
  error,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  swatch: string[];
  label: string;
  note: string | null;
  error?: boolean;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
          className="size-3 accent-(--tone)"
        />
        <span className="flex items-center">
          {/* Хил л давхаргад (ойн хэсэглэл) тэмдэг ОГТ БАЙХГҮЙ — хоосон
              дөрвөлжин нь хоёр дахь чагт мэт, зураас нь илүүц уншигдаж байв
              (хэрэглэгч 2026-10-20) */}
          {swatch.map((c) => (
            <span
              key={c}
              className="size-2.5 border border-black/30"
              style={{ background: c, opacity: on ? 0.85 : 0.35 }}
            />
          ))}
        </span>
        <span className={on ? "text-ink" : "text-ink-3"}>{label}</span>
      </label>
      {note ? (
        <p
          className={cn(
            "mt-0.5 pl-[18px] text-[10px] leading-tight",
            error ? "text-clay" : "text-ink-3",
          )}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

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
  /* Газрын зургийн ангилалтай НЭГ (`mapStatus`) — хохиролтой тохиолдол
     "Гэмтсэн, хөнөөсөн" мөрөнд (хэрэглэгч 2026-10-20: тайлбар, диаграм "яг
     ижил"). Цонх нь эх баталгаажилтаа харуулсаар. */
  { id: "status", title: "Баталгаажилт", keyOf: (r) => mapStatus(r) },
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

/*
  Баталгаажилтын өнгө — утгаас. Зургийн цэг, шошго, тайлбар,
  баталгаажилтын диаграм БҮГД эндээс.
  ⚠ Эх сурвалжийн бичвэр яг таарахгүй байж болох тул ("Хуурамч (баавгай
  биш)") түлхүүр үгээр таана. Дүрэмд ороогүй утга цагаан.
  ⚠ "олоогүй" нь "олдсон"-той давхцахгүй.
*/
/*
  ⚠⚠ ӨНГӨ = ХЭЛТСИЙН EXCEL-ИЙН МӨРИЙН ӨНГӨ (хэрэглэгч 2026-10-20: "өнгө нь ч
  гэсэн Excel дээрх шиг"). "GPS tseg" хуудасны нүдний дүүргэлтийг уншиж
  тогтоосон: олоогүй ба буцааж хөөж гарсан — accent4 (#FFC000) шар; буцааж
  тавьсан — accent6 (#70AD47) ногоон; хуурамч, нохой/адуу/морь/хүн байсан
  БА №44 (Батлагдсан) — "Bad" ягаан-улаан; №22 мөр олдсон — accent1 (#4472C4)
  цэнхэр; №28 (хүн гэмтсэн, хөнөөсөн) — accent3 (#A5A5A5) саарал.
  Хиймэл дагуулын бараан дэвсгэр дээр харагдахаар ӨНЦӨГ нь Excel-ийнх,
  ногоон, цэнхэр нь бага зэрэг цайвар. Урьдын (мөн өдрийн) гараар сонгосон
  өнгөнүүдийг ОРЛОСОН.
  ⚠ "хөөж" нь "буцааж"-аас ӨМНӨ — эс тэгвээс хөөж гарсан ногоон болно.
*/
const STATUS_RULES: [RegExp, string][] = [
  [/олоогүй/, "#ffc000"],
  /* Excel-д олоогүйтэй ижил шар — газрын зурагт ялгахын тулд ногоон-цэнхэр (2026-10-20) */
  [/хөөж/, "#3dd6c6"],
  [/буцааж/, "#7cc255"],
  [/хуурамч/, "#ff5a4e"],
  /* Excel-д хуурамчтай ижил ягаан — газрын зурагт нил ягаан (2026-10-20) */
  [/батлагдсан/, "#d46bff"],
  [/мөр олдсон/, "#6f96de"],
  [/тодорхойгүй/, "#ffffff"],
  [/гэмтс|хөнөөс/, "#a5a5a5"],
];
const OTHER_HEX = "#ffffff";

const statusHex = (v: string) => {
  const t = v.toLowerCase();
  return STATUS_RULES.find(([re]) => re.test(t))?.[1] ?? OTHER_HEX;
};

const HARMED = "Гэмтсэн, хөнөөсөн";

/**
 * ЗУРАГ ДЭЭРХ АНГИЛАЛ — хохиролтой тохиолдол (хүн гэмтсэн, хөнөөсөн, эд
 * хөрөнгө сүйтгэсэн) баталгаажилтаасаа үл хамааран "Гэмтсэн, хөнөөсөн"
 * (хэрэглэгч 2026-10-20, № 28 БЗД 35-р хороо: "хар саарал шүү"). Тэр мөрийн
 * баталгаажилт нь өөр утгатай байж болох тул ХОХИРОЛ талбараар таана.
 * Диаграм, цонх нь эх баталгаажилтаа харуулсаар.
 */
const mapStatus = (r: BearCase) =>
  str(r.attrs["хохирол"]) !== NONE ? HARMED : r.status;

type Filters = Partial<Record<string, string>>;

/** Хуурамч (баавгай биш) дуудлага — тэмдэглэл нь "юу байсан" */
const isFake = (status: string) => /хуурамч/.test(status.toLowerCase());

/** Маягтын координат — бичсэн мөр, хаанаас ирсэн (зураг дээр товшсон бол зураг ойртохгүй) */
type Coords = { lat: string; lon: string; src: "text" | "map" };

/**
 * Координат уншина: хоёулаа хоосон бол байршилгүй (`at: null`), хоёулаа
 * Монголын нутгийн хүрээнд бол `[lon, lat]`, бусад тохиолдолд алдаа —
 * өргөрөг, уртрагийг сольж бичих, нэгийг нь орхихоос сэргийлнэ.
 */
function readCoords(c: Coords): { ok: boolean; at: [number, number] | null } {
  const a = c.lat.trim();
  const o = c.lon.trim();
  if (!a && !o) return { ok: true, at: null };
  const lat = Number(a);
  const lon = Number(o);
  const ok =
    a !== "" && o !== "" && lat >= 41 && lat <= 52.5 && lon >= 87 && lon <= 120;
  return { ok, at: ok ? [lon, lat] : null };
}

const EMPTY_COORDS: Coords = { lat: "", lon: "", src: "text" };

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
  /*
    Маягтын координат — самбарт сууна: зураг дээр товшиж бөглөх
    (хэрэглэгч 2026-10-20: "координатын мэдээлэл байхгүй тохиолдолд яаж
    оруулж харах уу") ба урьдчилан тодруулах хоёр хоёулаа эндээс.
  */
  const [coords, setCoords] = React.useState<Coords>(EMPTY_COORDS);
  /** Зураг дээрээс байршил сонгох горим — дараагийн товшилт координат болно */
  const [picking, setPicking] = React.useState(false);
  /** Засварын дараа дахин татах дохио */
  const [version, setVersion] = React.useState(0);
  /** Нийслэлийн дүүргийн хил — зургийн ард бүдэг */
  const [districtBnd, setDistrictBnd] =
    React.useState<GeoJSON.FeatureCollection | null>(null);
  /** Хорооны хил — 1:150 000-аас ойртоход */
  const [khorooBnd, setKhorooBnd] =
    React.useState<GeoJSON.FeatureCollection | null>(null);

  /*
    СУУРЬ ДАВХАРГА — ОЙН ТӨРӨЛ, ОЙН ХЭСЭГЛЭЛ, НЭГЖ ТАЛБАР (хэрэглэгч
    2026-10-20: "ойн хэлтсээс ойн хэсэглэлийг map суурин дээр нь
    харуулаад, нэгж талбарыг бас харуулъя" → "ойн хэсэглэлийн өнгөөр нь
    бас ямар ямар төрөл байна гэдгийг нь харъя"). Баавгай ойгоос буудаг
    тул тохиолдол ойн ямар хэсэгт, хэний газар дээр болсныг хамт уншина.
    · ОЙН ТӨРӨЛ — `O03_oi_heseglel`-д төрлийн талбар БАЙХГҮЙ (зөвхөн
      хэсгийн дугаар, ДЦГ). Төрөл нь ойн хэлтсийн "Ойн ялгарал"
      (`O03_oi_yalgaral`, `ylgaral`, 6,264 дүрс) — тэр нь дүүргэлт болно.
    · ОЙН ХЭСЭГЛЭЛ (7,699 дүрс) — дүүргэлтгүй, нимгэн цайвар хил.
    · Хоёулаа ойн хэлтсийн бүртгэлээс (`FOREST_TABS`) тул кэш нь ойн
      самбартай НЭГ.
    · НЭГЖ ТАЛБАР — харагдах хүрээнд, 1:90 000-аас ойртоход
      ({@link PARCEL_SCALE}); порталын самбартай ижил цайвар саарал тор.
    ⚠ Бүгд ЦЭГИЙН ДООР суурь, тус бүр унтраалттай (зургийн тайлбарт).
    ⚠ Татагдахгүй бол самбар хэвээр ажиллана — тайлбарт л алдаа гарна.
  */
  const [types, setTypes] = React.useState<
    | {
        key: string;
        hex: string;
        group: string;
        data: GeoJSON.FeatureCollection;
      }[]
    | null
  >(null);
  const [typesErr, setTypesErr] = React.useState<string | null>(null);
  const [sections, setSections] =
    React.useState<GeoJSON.FeatureCollection | null>(null);
  const [baseOn, setBaseOn] = React.useState({
    types: true,
    parcel: true,
  });
  /* Тайлбар хураагдана (хэрэглэгч 2026-10-20) */
  const [legendOpen, setLegendOpen] = React.useState(true);
  const [forestPick, setForestPick] = React.useState<{
    key: string;
    group: string;
    hex: string;
    ha: number | null;
    hes: number | null;
    spa: string | null;
  } | null>(null);
  const pickForest = (lon: number, lat: number) => {
    let hit: GeoJSON.Feature | undefined;
    const t =
      baseOn.types && types
        ? types.find((x) => {
            hit = x.data.features.find((f) => contains(f, lon, lat));
            return hit != null;
          })
        : undefined;
    if (!t || !hit) return setForestPick(null);
    const sec = sections?.features.find((f) => contains(f, lon, lat));
    setForestPick({
      key: t.key,
      group: t.group,
      hex: t.hex,
      ha: (hit.properties?.ha as number | null) ?? null,
      hes: (sec?.properties?.hes as number | null) ?? null,
      spa: (sec?.properties?.spa as string | null) ?? null,
    });
  };
  const [view, setView] = React.useState<{
    box: [number, number, number, number];
    zoom: number;
  } | null>(null);
  const [parcels, setParcels] = React.useState<ParcelTile>(NO_PARCELS);
  const [parcelErr, setParcelErr] = React.useState<string | null>(null);
  const parcelZoom = React.useMemo(() => zoomForScale(PARCEL_SCALE), []);
  const close = view != null && view.zoom >= parcelZoom;

  React.useEffect(() => {
    const ac = new AbortController();
    const set = FOREST_TABS[TYPE_LAYER];
    fetchLayerInfo(set, TYPE_LAYER, ac.signal)
      .then(async (info) => ({
        info,
        d: await fetchLayerFeatures(info, ac.signal),
      }))
      .then(({ info, d }) => {
        /* Төрөл бүр тусдаа давхарга — нэмэлт давхарга нь ганц өнгөтэй */
        const by = new Map<string, GeoJSON.Feature[]>();
        for (const f of d.shapes.features) {
          const row = d.rows[Number(f.id)];
          const k = categoryKey(row?.["ylgaral"]);
          /* Талбай ЗӨВХӨН гектарын баганаас — `SHAPE__Area` 2.2 дахин хөөрөгдсөн */
          const ha =
            info.areaField && info.areaInHa
              ? Number(row?.[info.areaField])
              : NaN;
          const g = withBox(f, { ha: Number.isFinite(ha) ? ha : null });
          const list = by.get(k);
          if (list) list.push(g);
          else by.set(k, [g]);
        }
        const known = FOREST_TYPES.filter((t) => by.has(t.key));
        const extra = [...by.keys()]
          .filter((k) => !FOREST_TYPES.some((t) => t.key === k))
          .map((key) => ({ key, group: "Бусад", hex: OTHER_TYPE_HEX }));
        setTypes(
          [...known, ...extra].map((t) => ({
            ...t,
            data: { type: "FeatureCollection", features: by.get(t.key)! },
          })),
        );
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setTypesErr(e.message);
      });
    const sec = FOREST_TABS.O03_oi_heseglel;
    fetchLayerInfo(sec, "O03_oi_heseglel", ac.signal)
      .then((info) => fetchLayerFeatures(info, ac.signal))
      .then((d) =>
        setSections({
          type: "FeatureCollection",
          features: d.shapes.features.map((f) => {
            const row = d.rows[Number(f.id)];
            const hes = Number(attrOf(row, "hes_num"));
            const spa = attrOf(row, "spa_name");
            return withBox(f, {
              hes: Number.isFinite(hes) && hes > 0 ? hes : null,
              spa: typeof spa === "string" && spa.trim() ? spa.trim() : null,
            });
          }),
        }),
      )
      .catch(() => {
        /* Хэсэглэлийн хил нь тайлбаргүй суурь — унавал зүгээр л гарахгүй */
      });
    return () => ac.abort();
  }, []);

  React.useEffect(() => {
    if (!baseOn.parcel || !view || !close) return;
    const ac = new AbortController();
    fetchParcelsIn(view.box, ac.signal, view.zoom)
      .then((t) => {
        if (ac.signal.aborted) return;
        setParcels(t);
        setParcelErr(null);
      })
      .catch((e: Error) => {
        if (ac.signal.aborted || e.name === "AbortError") return;
        setParcels(NO_PARCELS);
        setParcelErr(e.message);
      });
    return () => ac.abort();
  }, [baseOn.parcel, view, close]);

  /* Унтраасан, эсвэл хол байхад ДАМ хоосон (эффектээс `set*` биш) */
  const shownParcels = baseOn.parcel && close ? parcels : NO_PARCELS;
  const onView = React.useCallback(
    (box: [number, number, number, number], zoom: number) =>
      setView({ box, zoom }),
    [],
  );

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
    /* Ойн төрөл — хамгийн доор, ойн самбарын ялгарлын өнгөөр */
    if (types && baseOn.types)
      types.forEach((t, i) =>
        list.push({
          id: `forest-type-${i}`,
          data: t.data,
          fill: { color: t.hex, opacity: 0.2 },
          line: { color: t.hex, opacity: 0.3, width: 0.3 },
        }),
      );
    /* Нэгж талбар — ойн дүүргэлтийн ДЭЭР, хилийн ДООР */
    if (shownParcels.data.features.length)
      list.push({
        id: "parcel",
        data: shownParcels.data,
        fill: { color: "#c3cad3", opacity: 0.06 },
        line: { color: "#c3cad3", opacity: 0.85, width: 1.0 },
      });
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
  }, [districtBnd, khorooBnd, types, baseOn, shownParcels]);

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
  /** Газрын зургийн индекс — `data.points`-тэй ИЖИЛ дараалал */
  const placed = React.useMemo(() => rows.filter(located), [rows]);

  const preview = form ? readCoords(coords).at : null;

  const openForm = (oid: number | null) => {
    const r = oid != null ? rows.find((x) => x.oid === oid) : undefined;
    setCoords(
      r && located(r)
        ? { lat: String(r.lat), lon: String(r.lon), src: "text" }
        : EMPTY_COORDS,
    );
    setPicking(false);
    setForm({ oid });
  };
  const closeForm = () => {
    setForm(null);
    setPicking(false);
  };

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

  /*
    ЦЭГИЙН ӨНГӨ = БАТАЛГААЖИЛТ (хэрэглэгч 2026-10-20: шошгын өнгийг
    сольсны дараа "өөрчлөгдөөгүй байна" — шошго 1:150 000-аас ойртоход л
    гардаг тул хотын харагдацад цэг л харагдана). Шошго, диаграмтай НЭГ
    `statusHex`. ⚠ Урьдын (2026-10-14) "нэг хороонд 2+ тохиолдол шаргал"
    өнгө ОРЛОГДСОН — давталт нь хорооны диаграмд уншигдана.
  */
  const colors = React.useMemo(
    () => placed.map((r) => statusHex(mapStatus(r))),
    [placed],
  );
  /** Зургийн тайлбар — баталгаажилтын диаграмтай ИЖИЛ дараалал, зурагт байгаа нь л */
  const legend = React.useMemo(() => {
    const on = new Set(placed.map(mapStatus));
    return charts.status
      .map((x) => x.key)
      .filter((k) => on.has(k) && k !== NONE);
  }, [placed, charts]);

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
      text: placed.map((r) => (mapStatus(r) === NONE ? "" : mapStatus(r))),
      minzoom: zoomForScale(150_000),
      /* Хиймэл дагуул дээр уншигдахаар том, зузаан бараан хүрээтэй
         (хэрэглэгч 2026-10-14: "хаана юу байгаа нь мэдэгдэхгүй") */
      size: 7,
      halo: 1.4,
      /* Бичвэр → hex — датанд байгаа баталгаажилт бүрээр */
      colors: Object.fromEntries(
        [...new Set(placed.map(mapStatus))].map((t) => [t, statusHex(t)]),
      ),
    }),
    [placed],
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

  /** Шүүлтэд тохирох байршилгүй тохиолдол — зурагт гарахгүй тул тусдаа жагсаалтад */
  const unplaced = React.useMemo(
    () => shown.filter((r) => !located(r)),
    [shown],
  );

  /*
    Шүүлт тавьвал үлдсэн бүхнийг, тохиолдол сонговол түүнийг багтаана.
    ⚠ Зураг дээр товшиж сонгосон координат руу ОЙРТОХГҮЙ (`src: "map"`) —
    хэрэглэгч аль хэдийн тэр газрыг харж байгаа.
  */
  const typed = coords.src === "text" ? preview : null;
  const focus = React.useMemo<Extent | null>(() => {
    if (typed) {
      const b = new Bounds();
      b.add(typed[0], typed[1]);
      return b.get(0.01);
    }
    if (!chosen && !active) return null;
    const b = new Bounds();
    for (const r of chosen ? [chosen] : shown)
      if (located(r)) b.add(r.lon, r.lat);
    return b.get(chosen ? 0.01 : 0.02);
  }, [shown, chosen, active, typed]);

  const stats = React.useMemo(() => {
    const c = (s: string) => shown.filter((r) => mapStatus(r) === s).length;
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
                      x.key === NONE
                        ? "var(--ink-3)"
                        : statusHex(x.key) === OTHER_HEX
                          ? "var(--ink)"
                          : statusHex(x.key)
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
                x.key === NONE
                  ? "—"
                  : charts.week.length <= 8 || i % 2 === 0
                    ? x.key.slice(5)
                    : ""
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
        value={
          charts[id].find((x) => x.key === filters[id])?.label ??
          filters[id] ??
          null
        }
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
          {unplaced.length ? (
            <Card className="shrink-0">
              <Head title="Байршилгүй тохиолдол">
                <span className="num text-[11px] text-ink-3">
                  {num(unplaced.length)}
                </span>
              </Head>
              <ul className="divide-y divide-line">
                {unplaced.map((r) => (
                  <li key={r.oid}>
                    <button
                      onClick={() => setPicked(picked === r.oid ? null : r.oid)}
                      className={cn(
                        "flex w-full items-baseline gap-2 px-3 py-1.5 text-left transition-colors hover:bg-paper-hi",
                        picked === r.oid &&
                          "bg-paper-hi shadow-[inset_2px_0_0_var(--data)]",
                      )}
                    >
                      <span className="num w-[68px] shrink-0 text-[11px] text-ink-3">
                        {r.date != null ? dateText(r.date) : "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                        {[r.status, r.district]
                          .filter((x) => x !== NONE)
                          .join(" · ") || NONE}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* ---- ГОЛ: газрын зураг ---- */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <Card className="relative min-h-[300px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              <PointMap
                points={data.points}
                visible={visible}
                basemap={basemap}
                onSelect={(oid) => {
                  setForestPick(null);
                  setPicked(picked === oid ? null : oid);
                }}
                onBlankClick={(lon, lat) => {
                  setPicked(null);
                  pickForest(lon, lat);
                }}
                focus={focus}
                highlight={
                  preview ??
                  (chosen && located(chosen) ? [chosen.lon, chosen.lat] : null)
                }
                onMapClick={
                  form && picking
                    ? (lon, lat) => {
                        setCoords({
                          lat: String(+lat.toFixed(6)),
                          lon: String(+lon.toFixed(6)),
                          src: "map",
                        });
                        setPicking(false);
                      }
                    : undefined
                }
                colors={colors}
                labels={labels}
                overlays={overlays}
                onView={onView}
                adminLines={false}
                cluster={false}
              />
              {/* Тайлбар: суурь давхаргын унтраалга + баталгаажилтын өнгө */}
              <div className="absolute bottom-8 left-2.5 z-10 max-h-[calc(100%-5rem)] w-60 overflow-y-auto rounded-xs border border-line bg-paper/95 px-2 py-1.5 text-[11px] text-ink-2 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setLegendOpen((o) => !o)}
                  aria-expanded={legendOpen}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="eyebrow">Таних тэмдэг</span>
                  <ChevronDown
                    size={13}
                    className={cn(
                      "shrink-0 text-ink-3 transition-transform",
                      !legendOpen && "-rotate-90",
                    )}
                  />
                </button>
                <div className={cn("mt-1 space-y-1", !legendOpen && "hidden")}>
                <BaseToggle
                  on={baseOn.types}
                  onChange={(v) => setBaseOn((b) => ({ ...b, types: v }))}
                  swatch={FOREST_TYPES.slice(0, 1)
                    .concat(FOREST_TYPES.slice(4, 5), FOREST_TYPES.slice(8, 9))
                    .map((t) => t.hex)}
                  label="Ойн төрөл"
                  note={
                    typesErr ??
                    (baseOn.types && !types ? "Ачаалж байна…" : null)
                  }
                  error={Boolean(typesErr)}
                />
                {baseOn.types && types?.length ? (
                  <div className="space-y-0.5 pl-[18px]">
                    {[...new Set(types.map((t) => t.group))].map((g) => (
                      <div key={g}>
                        <div className="text-[9.5px] uppercase tracking-wide text-ink-3">
                          {g}
                        </div>
                        <div className="grid grid-cols-2 gap-x-2">
                          {types
                            .filter((t) => t.group === g)
                            .map((t) => (
                              <div
                                key={t.key}
                                className="flex min-w-0 items-center gap-1 text-[10px]"
                                title={t.key}
                              >
                                <span
                                  className="size-2 shrink-0 border border-black/30"
                                  style={{ background: t.hex }}
                                />
                                <span className="truncate">{t.key}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <BaseToggle
                  on={baseOn.parcel}
                  onChange={(v) => setBaseOn((b) => ({ ...b, parcel: v }))}
                  swatch={["#c3cad3"]}
                  label="Нэгж талбар"
                  note={
                    !baseOn.parcel
                      ? null
                      : parcelErr
                        ? parcelErr
                        : !close
                          ? `1:${num(PARCEL_SCALE)}-аас ойртоход харагдана`
                          : parcels.capped
                            ? `${num(parcels.total ?? 0)} нэгж талбар — ойртуулна уу`
                            : null
                  }
                  error={Boolean(parcelErr)}
                />
                {legend.length ? (
                  <div className="space-y-1 border-t border-line pt-1">
                    {legend.map((t) => (
                      <div key={t} className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full ring-1 ring-black/40"
                          style={{ background: statusHex(t) }}
                        />
                        {t}
                      </div>
                    ))}
                  </div>
                ) : null}
                </div>
              </div>
              <BasemapGallery value={basemap} onChange={setBasemap} />
              {!form ? (
                <button
                  onClick={() => {
                    setPicked(null);
                    openForm(null);
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
                  coords={coords}
                  onCoords={(c) => setCoords({ ...c, src: "text" })}
                  picking={picking}
                  onPicking={setPicking}
                  onCancel={closeForm}
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
                    closeForm();
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
                    onEdit={() => openForm(chosen.oid)}
                    onDelete={async () => {
                      await deleteBear(chosen.oid);
                      setPicked(null);
                      setVersion((n) => n + 1);
                    }}
                  />
                </div>
              ) : forestPick ? (
                <div className="elevated absolute right-2.5 bottom-2.5 z-10 w-[260px] rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow">Ойн төрөл</span>
                    <button
                      onClick={() => setForestPick(null)}
                      aria-label="Хаах"
                      className="text-ink-3 transition-colors hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="space-y-1.5 px-2.5 py-2">
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 size-3 shrink-0 border border-black/30"
                        style={{ background: forestPick.hex }}
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-ink">
                          {forestPick.key}
                        </div>
                        <div className="text-[11px] text-ink-3">
                          {forestPick.group}
                        </div>
                      </div>
                    </div>
                    {forestPick.ha != null ||
                    forestPick.hes != null ||
                    forestPick.spa ? (
                      <dl className="divide-y divide-line border-t border-line text-[11.5px]">
                        {forestPick.ha != null ? (
                          <div className="flex justify-between gap-3 py-1">
                            <dt className="text-ink-3">Талбай</dt>
                            <dd className="num text-ink">
                              {num(forestPick.ha, forestPick.ha < 100 ? 1 : 0)}{" "}
                              га
                            </dd>
                          </div>
                        ) : null}
                        {forestPick.hes != null ? (
                          <div className="flex justify-between gap-3 py-1">
                            <dt className="text-ink-3">Ойн хэсэг</dt>
                            <dd className="num text-ink">№ {forestPick.hes}</dd>
                          </div>
                        ) : null}
                        {forestPick.spa ? (
                          <div className="flex justify-between gap-3 py-1">
                            <dt className="text-ink-3">
                              Тусгай хамгаалалттай газар
                            </dt>
                            <dd className="text-right text-ink">
                              {forestPick.spa}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                  </div>
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
  /*
    ХУУРАМЧ тохиолдолд тэмдэглэл нь "юу байсан" гэдгийг хэлнэ (хэрэглэгч
    2026-10-20: "хуурамч гэхдээ pop up дээр юу байсныг харагдана" — нохой,
    адуу, хүн …) тул ЭХЭНД, тэр нэрээр гарна. Талбар нь ижил (`тэмдэглэл__эх_`).
  */
  const fake = isFake(r.status);
  const note = val(a["тэмдэглэл__эх_"]);
  const rows: [string, string][] = [
    ...(fake ? ([["Юу байсан", note]] as [string, string][]) : []),
    ["Байршил", [r.district, khoroo].filter(Boolean).join(" · ")],
    ["Газрын нэр", val(a["газрын_нэр"])],
    ["Нас / төлөв", val(a["нас___төлөв"])],
    ["Эх бичилт", val(a["зүйлийн_эх_бичилт"])],
    ...(fake ? [] : ([["Тэмдэглэл", note]] as [string, string][])),
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
        {located(r)
          ? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`
          : "Координат бүртгэгдээгүй"}
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
 *
 * ⚠ КООРДИНАТ ЗААВАЛ БИШ (хэрэглэгч 2026-10-20): мэдэгдэхгүй бол хоосон
 * үлдээж хадгална — тохиолдол тоо, диаграмд орж "Байршилгүй тохиолдол"
 * жагсаалтад гарна; дараа нь засахдаа нэмнэ. Төв рүү "нөхөж" тавихгүй.
 * Координат нь самбарт сууна (`coords`): зураг дээр товшиж бөглөх
 * горим (`picking`) түүнийг шууд бичнэ.
 */
function BearForm({
  initial,
  rows,
  coords,
  onCoords,
  picking,
  onPicking,
  onCancel,
  onSubmit,
}: {
  initial?: BearCase;
  rows: BearCase[];
  coords: Coords;
  onCoords: (c: { lat: string; lon: string }) => void;
  picking: boolean;
  onPicking: (on: boolean) => void;
  onCancel: () => void;
  onSubmit: (v: BearInput) => Promise<void>;
}) {
  const a = initial?.attrs ?? {};
  const [v, setV] = React.useState({
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
  const put = (k: keyof typeof v) => (value: string) =>
    setV((x) => ({ ...x, [k]: value }));

  /* "47.9, 106.9" гэж нэг талбарт буулгавал хоёр хуваана */
  const onLat = (e: { target: { value: string } }) => {
    const m = e.target.value.match(
      /^\s*(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)\s*$/,
    );
    if (m) onCoords({ lat: m[1], lon: m[2] });
    else onCoords({ lat: e.target.value, lon: coords.lon });
  };

  const read = readCoords(coords);

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
      "Буцааж тавьсан",
      "Буцааж хөөж гарсан",
      "Гэмтсэн, хөнөөсөн",
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
    if (!read.ok) {
      setErr(
        "Өргөрөг, уртрагийг хоёуланг нь Монголын нутгийн хүрээнд бичнэ үү (өргөрөг 41–52.5, уртраг 87–120), эсвэл хоёуланг нь хоосон үлдээнэ үү.",
      );
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        lat: read.at ? read.at[1] : null,
        lon: read.at ? read.at[0] : null,
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
          <FormRow label="Өргөрөг">
            <input
              className={cn(input, "num")}
              value={coords.lat}
              onChange={onLat}
              placeholder="47.9185"
              inputMode="decimal"
            />
          </FormRow>
          <FormRow label="Уртраг">
            <input
              className={cn(input, "num")}
              value={coords.lon}
              onChange={(e) =>
                onCoords({ lat: coords.lat, lon: e.target.value })
              }
              placeholder="106.9177"
              inputMode="decimal"
            />
          </FormRow>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPicking(!picking)}
            aria-pressed={picking}
            className={cn(
              "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-xs border px-2 text-[11.5px] transition-colors",
              picking
                ? "border-(--data) bg-(--data)/12 text-(--data)"
                : "border-line-2 text-ink-2 hover:bg-paper-hi",
            )}
          >
            <Crosshair size={13} /> Зураг дээрээс сонгох
          </button>
          {coords.lat || coords.lon ? (
            <button
              type="button"
              onClick={() => onCoords({ lat: "", lon: "" })}
              className="flex h-7 items-center gap-1 rounded-xs border border-line-2 px-2 text-[11.5px] text-ink-2 hover:bg-paper-hi"
            >
              <X size={12} /> Цэвэрлэх
            </button>
          ) : null}
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
            <ChoiceField
              className={input}
              value={v.district}
              options={DISTRICTS}
              onChange={put("district")}
            />
          </FormRow>
          <FormRow label="Хороо">
            <ChoiceField
              className={input}
              value={v.khoroo}
              options={khoroos}
              onChange={put("khoroo")}
            />
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
          {/* Жагсаалтаас сонгох ЭСВЭЛ "Бусад"-аар шинээр бичих (хэрэглэгч 2026-10-14, 10-20) */}
          <ChoiceField
            className={input}
            value={v.status}
            options={statuses}
            onChange={put("status")}
          />
        </FormRow>
        <div className="grid grid-cols-2 gap-1.5">
          <FormRow label="Нас / төлөв">
            <ChoiceField
              className={input}
              value={v.age}
              options={[
                ...new Set([
                  "Бамбарууш",
                  "Шүдлэн",
                  "Нас бие гүйцсэн",
                  ...uniq("нас___төлөв"),
                ]),
              ]}
              onChange={put("age")}
            />
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
        <FormRow label={isFake(v.status) ? "Юу байсан" : "Тэмдэглэл"}>
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

/**
 * Жагсаалтаас сонгох талбар + "Бусад…" (хэрэглэгч 2026-10-20: "бусад гэж
 * гараар нэмдэг хэсэг нэмээрэй, бусад сонгодог дээр нь бас"). "Бусад"-ыг
 * сонгоход доор нь бичих нүд гарна; жагсаалтад байхгүй утгатай засварын
 * бүртгэл шууд энэ горимоор нээгдэнэ.
 */
const OTHER = "__other";
function ChoiceField({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  className: string;
}) {
  const [custom, setCustom] = React.useState(
    () => value !== "" && !options.includes(value),
  );
  return (
    <div className="space-y-1">
      <select
        className={className}
        value={custom ? OTHER : value}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(next);
          }
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={OTHER}>Бусад…</option>
      </select>
      {custom ? (
        <input
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      ) : null}
    </div>
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
