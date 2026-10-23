"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Bike,
  CalendarRange,
  ChartNoAxesCombined,
  Check,
  Flower,
  Footprints,
  Shield,
  Trash2,
  TreeDeciduous,
  Flower2,
  Leaf,
  Sprout,
  Trees,
  Hexagon,
  MapPin,
  Spline,
  ChevronDown,
  Layers3,
  Loader2,
  Palette,
  Ruler,
  Shapes,
  ShieldCheck,
  Sigma,
  Tag,
} from "lucide-react";
import {
  AreaChart,
  BarChart,
  GroupedBarChart,
  GroupedRowChart,
  type DatumGroup,
  PieChart,
  RowChart,
  StackedBarChart,
  type Datum,
} from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapLayerPicker } from "@/components/layers/map-layer-picker";
import {
  countParcelsIn,
  PARCEL_CUT_LABELS,
  parcelCuts,
  type ParcelCut,
  fetchParcelsIn,
  fetchParcelsOn,
  clipRings,
  simplifyRings,
  NO_PARCELS,
  PARCEL_SCALE,
  parcelAxes,
  parcelCountsIn,
  parcelWhere,
  ringsOf,
  type ParcelAxis,
  type ParcelCount,
  type ParcelTile,
} from "@/lib/parcels";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { MapPanel, useMapPanel } from "@/components/map/panel";
import { Columns } from "@/components/ui/resizable-columns";
import {
  FilterBar,
  FilterMenu,
  PickList,
  type FilterChip,
} from "@/components/wells/filter-bar";
import {
  BASEMAPS,
  defaultBasemap,
  zoomForScale,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { categoryHex, FIREFLY, oklchHex } from "@/components/wells/colors";
import { Bounds, pointOf } from "@/lib/extent";
import { inUlaanbaatar } from "@/lib/ub-boundary";
import { districtsOf, placeNamesOf } from "@/lib/places";

/**
 * ТООЦООЛСОН ДҮҮРГИЙН ШҮҮЛТИЙН ТҮЛХҮҮР ({@link LayerSet.districts}).
 * Эх сурвалжийн талбар биш — `views`-ийн `keyBy` түүнийг дүрсийн
 * дугаараар (`districtsOf`) хариулна.
 */
const DISTRICT_KEY = "__district";
import {
  breakdowns,
  categoryKey,
  dateAxes,
  isSystemField,
  labelParts,
  layerName,
  splitsZones,
  fetchLayerFeatures,
  fetchLayerInfo,
  unitOf,
  type Breakdown,
  type ChartKind,
  type DateAxis,
  type LayerLabels,
  type LayerFeatures,
  type LayerSet,
  type Row,
  type LayerInfo,
} from "@/lib/portal-layers";
import { cn, num } from "@/lib/utils";
import { NoAccess, useAccess } from "@/components/auth/access";
import type { TabRule } from "@/lib/access";
import {
  Composition,
  Matrix,
  Segments,
  type Key,
} from "@/components/unelgee/viz";
import {
  TopicBreakdown,
  TopicMapLegend,
  recordUnit,
  topicChartTitle,
} from "@/components/unelgee/layer-presentation";

const LayerMap = dynamic(
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

/**
 * Давхаргын үндсэн өнгө — жагсаалт, толгойн зураас, ганц өнгөт горим.
 *
 * Өнцгийг бүртгэл (`LayerSet.hues`) өгнө: давхаргуудыг нэг зураг дээр
 * ялгах ёстой тул өнгө нь энд ТАНИХ ТЭМДЭГ болно (хэмжигдэхүүн БИШ) —
 * `lib/tone-ramp.ts`-ийн зөвтгөлтэй ижил үндэслэл.
 *
 * Зөвхөн ӨНЦГИЙГ хадгалсан нь санаатай: давхарга доторх ангиллыг мөн
 * өнгөөр ялгах шаардлага гардаг бөгөөд тэдгээр нь ИЖИЛ өнцөг дээр
 * гэрэлтэлтээрээ сална. Ингэснээр ангилал олонтой ч давхарга нь
 * өөрөө таних өнгөө алдахгүй.
 */
function toneOfHue(hue: number, l = 0.74, c = 0.15): string {
  return oklchHex(l, c, hue);
}

/**
 * Давхарга доторх ангиллын өнгөний шатлал.
 *
 * Өнцөг нь давхаргынхаа өнцөг ХЭВЭЭР, ялгаа нь зөвхөн гэрэлтэлтээр
 * (0.88 → 0.46). Иймээс "аль давхарга" ба "аль ангилал" гэсэн хоёр
 * асуулт нэг зураг дээр зэрэг хариулагдана.
 *
 * Ангилал хэт олон бол гэрэлтэлтийн ялгаа мэдэгдэхээ болино — тийм
 * үед дуудагч тал ангиллын өнгийг огт асаахгүй (`MAX_COLOR_VALUES`).
 */
function categoryRamp(hue: number, n: number): string[] {
  if (n <= 1) return [oklchHex(0.74, 0.15, hue)];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return oklchHex(0.88 - t * 0.42, 0.12 + Math.sin(t * Math.PI) * 0.05, hue);
  });
}

/**
 * ДҮРСИЙН ХЭМЖЭЭ — зурагдах дарааллыг шийдэхэд.
 *
 * ⚠⚠ ҮҮРЛЭСЭН ДҮРС ДАРАГДАЖ БАЙВ (2026-09-30, хэрэглэгч зургаар:
 * "өнгө ялгарч танигдахгүй бн"). Булгийн 50 м-ийн бүс нь 200 м-ийн
 * бүсийнхээ ДОТОР бүтнээрээ сууна. Нэг `fill` давхаргад дүрсүүд эх
 * сурвалжийн ДАРААЛЛААР зурагддаг тул том бүс сүүлд тохиовол жижгийг
 * нь бүрэн хучиж, зөвхөн хүрээ нь үлдэнэ — хоёр өнгө байсан ч ганц
 * өнгө харагдана.
 * ⚠ Одоо ТОМ нь эхлээд, ЖИЖИГ нь ДЭЭР нь зурагдана. Давхцахгүй
 * дүрсэнд ямар ч нөлөөгүй: зөвхөн давхцсан газрын дараалал тогтвортой
 * болно (урьд нь эх сурвалжийн санамсаргүй дараалал байв).
 * ⚠ Хэмжээ нь ХҮРЭЭНИЙ талбай — жинхэнэ талбай биш: дараалал тогтооход
 * хангалттай бөгөөд үүрлэсэн дүрсэнд хоёр хэмжүүр ижил хариу өгнө.
 * ⚠ Дүрс бүрд НЭГ УДАА бодогдоно (`WeakMap`): шүүлт тавих бүрд
 * долоон мянган олон өнцөгтийн оройг дахин тоолох нь утгагүй.
 */
/**
 * ДАВХЦАХ НЭГЖ ТАЛБАРЫГ ЗАДЛАХ ТЭНХЛЭГ ({@link LayerSet.parcelBy}).
 *
 * Давхаргын дүрсүүдийг заасан талбарын утгаар бүлэглэнэ: бүлэг бүр
 * нэг хүсэлт болж, сервер давхцлыг тоолно.
 *
 * ⚠ Бүлгийн түлхүүр нь задаргааны ӨӨРИЙН `keyOf` — диаграм, шүүлт,
 * өнгө гурвуулаа нэг эх сурвалжаас.
 * ⚠ Дараалал нь задаргаанаас: тоогоороо эрэмбэлэгдсэн хэвээр.
 * ⚠ Цэвэр функц тул модулийн түвшинд — бүрэлдэхүүн доторх давталт,
 * эрт буцалт хоёр нь React Compiler-ийн мемоизацийг тасалдаг.
 */
function parcelAxisOf(
  field: string | undefined,
  on: readonly string[],
  loaded: Record<string, Loaded>,
): {
  id: string;
  label: string;
  order: string[];
  groups: Map<string, GeoJSON.Feature[]>;
} | null {
  if (!field) return null;
  for (const id of on) {
    const hit = loaded[id];
    if (!hit || hit.info.geometry === "Point") continue;
    const b = hit.charts.find((c) => c.field === field && c.kind === "count");
    if (!b) continue;
    /*
      ⚠⚠ ГЕОМЕТР ХОЖИМ ИРНЭ: давхарга атрибутаараа эхлээд ирдэг
      ({@link fetchLayerFeatures}) тул дүрсээр нь шүүвэл карт хэдэн
      секунд огт үүсэхгүй. Ангиллын НЭР, ДАРААЛАЛ нь задаргаанаас
      (атрибут) гардаг тул картыг шууд үүсгээд, тооллыг нь дүрс ирэхэд
      бодно (хэрэглэгч, 2026-10-02: "нэгж талбарын chart байнга
      харагдана шүү").
    */
    const groups = new Map<string, GeoJSON.Feature[]>();
    for (const f of hit.data.shapes.features) {
      const row = hit.data.rows[Number(f.id)];
      if (!row) continue;
      for (const key of b.keyOf(row))
        groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    return {
      id,
      label: b.label,
      order: b.values.map((v) => v.key),
      groups,
    };
  }
  return null;
}

/**
 * БҮСТЭЙ ДАВХЦСАН НЭГЖ ТАЛБАРЫН ДЭЭД ХЭМЖЭЭ — нэг татацад.
 *
 * ⚠⚠ Туулын татамтай **87,947** нэгж талбар давхцдаг (2026-10-02-нд
 * токеноор хэмжсэн): бүгдийг татвал хэдэн арван мегабайт, хотын төв
 * бүхэлдээ улаан тор болж доорх хиймэл дагуул, татам хоёулаа дарагдана.
 *
 * Тиймээс цагирагийг ХАРАГДАХ ХҮРЭЭГЭЭР тайрч ({@link clipRings}), үр
 * дүн нь энэ хязгаараас хэтэрвэл ОГТ ТАТАХГҮЙ — зөвхөн тоог нь хэлж
 * "ойртоно уу" гэнэ. Хагас татсан тор нь "эдгээр л давхцаж байна"
 * гэсэн ХУДАЛ зураг гаргана.
 *
 * ⚠ ХЭМЖСЭН (2026-10-02, бодит үйлчилгээ): дүүргийн харагдац (~6 км)
 * нь **5,195 нэгж талбар · 0.6 секунд · 1.4 МБ**; 1:120 000 (~44 км)
 * нь **72,713 · ≈14 МБ · 37 хуудас**.
 *
 * ⚠ Хязгаар нь ХАМГААЛАЛТ болохоос ХААЛТ биш: хаалтыг масштаб
 * ({@link ZONE_SCALE}) тавина. Энэ нь зөвхөн "татам бүхэлдээ
 * харагдаж байхад 88 мянгыг татах" тохиолдлоос сэргийлнэ.
 */
const ZONE_LIMIT = 80000;

/**
 * БҮСТЭЙ ДАВХЦСАН НЭГЖ ТАЛБАР ЭНЭ МАСШТАБААС ХАРАГДАНА.
 *
 * ⚠ Хязгаарыг ойртолтоор БИШ ХАРЬЦААГААР: зургийн буланд гарах заалт
 * мөн харьцаагаар бичигддэг тул хэрэглэгч хэдээс эхлэн гарахыг
 * тэндээс шууд уншина (шошго, суурь нэгж талбартай нэг зарчим).
 *
 * ⚠⚠ **1:120 000-ААС 1:30 000 БОЛСОН** (хэрэглэгчийн шийдвэр,
 * 2026-10-02: "удаан байна шүү" → хурдыг сонгов). Зааг нь ХУРДЫГ
 * ШУУД тодорхойлно — татац нь давхцлын ТООНООС хамаарна (2026-10-02-нд
 * бодит үйлчилгээн дээр хэмжсэн):
 *
 * | Масштаб | Өргөн | Давхцал | Хугацаа |
 * |---|---|---|---|
 * | 1:120 000 | 44 км | 72,713 | ≈22 с · 37 хуудас · 14 МБ |
 * | 1:60 000 | 22 км | 38,161 | ≈12 с |
 * | **1:30 000** | 11 км | **11,366** | **≈1.8 с** |
 * | 1:13 000 | 5 км | 3,990 | ≈1.2 с |
 *
 * ⚠ Сервер хуудас бүрд ~0.3 секунд зарцуулдаг бөгөөд ЗЭРЭГЦЭЭГ нэмэх
 * нь тус болохгүй (хэмжсэн: 37 хуудас зэрэг 32.5 с, 6-аар бүлэглэхэд
 * 32.9 с) — хурдны цорын ганц хөшүүрэг нь ЗААГ.
 * ⚠ Хол байхад давхцлын тоо нь ДИАГРАМААР гарсаар байна ("Давхцаж
 * буй нэгж талбар — Сав газар") тул тоон хариулт алдагдахгүй: зөвхөн
 * зураг дээрх тор нь ойртсон үед гарна.
 */
const ZONE_SCALE = 30_000;

const SPANS = new WeakMap<GeoJSON.Feature, number>();

function shapeSpan(f: GeoJSON.Feature): number {
  const seen = SPANS.get(f);
  if (seen != null) return seen;
  const b = new Bounds();
  b.addGeometry(f.geometry);
  const e = b.get(0);
  const span = e ? (e[2] - e[0]) * (e[3] - e[1]) : 0;
  SPANS.set(f, span);
  return span;
}

/**
 * ЦУВААНЫ өнгөний шатлал — диаграмд зориулсан.
 *
 * `categoryRamp` нь газрын зурагт зориулагдсан тул бараан үзүүр рүүгээ
 * (L 0.46) явдаг: хиймэл дагуулын цайвар дэвсгэр дээр тэр нь зөв.
 * Харин ХАРАНХУЙ карт дээр тэр өнгө бараг үл ялиг болж, гурав дахь
 * цуваа алга болсон мэт харагдана.
 *
 * Тиймээс диаграмын шатлалыг гэрэлтэй мужид барина (0.86 → 0.60):
 * бүх цуваа уншигдана, эрэмбэ нь хэвээр.
 */
function seriesRamp(hue: number, n: number): string[] {
  if (n <= 1) return [oklchHex(0.78, 0.15, hue)];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return oklchHex(0.86 - t * 0.26, 0.11 + t * 0.06, hue);
  });
}

/**
 * Ангиллыг өнгөөр ялгах дээд хязгаар.
 *
 * Үүнээс олон утгатай талбар дээр гэрэлтэлтийн шатлал ялгагдахаа
 * больж, зураг нь мэдээлэл өгөхийн оронд шуугиан болно.
 */
const MAX_COLOR_VALUES = 12;

/**
 * "Дүрс тус бүрийн талбай" диаграмд харагдах дээд мөр.
 *
 * Мөр нь бичлэгийн тоотой тэнцдэг тул хязгааргүй бол мянган мөртэй
 * карт гарна. Хорь нь `nameField`-ийн хураалттай нэг тоо — хураасан
 * гэдгээ гарчигтаа ИЛ хэлнэ.
 */
const AREA_TOP = 20;

/**
 * Баганаа дүүргэх ганц карт ({@link LayerSet.fillSolo}) хэдэн ангилал
 * хүртэл БОСОО баганаар зурагдах вэ. Үүнээс олон бол хэвтээ зурвас —
 * нарийн (~520px) картад есөөс олон багана нэрээ тайрна.
 */
const SOLO_COLUMNS = 8;

/**
 * Давхаргын дугаарын орон зай.
 *
 * Найман давхарга бүгд `OBJECTID`-гоо 1-ээс эхлүүлдэг тул нэг зураг
 * дээр нийлэхэд мөргөлдөнө. Давхаргын индексээр шилжүүлж нэрийн орон
 * зайд оруулна: `uid = index * STRIDE + oid`.
 */
const STRIDE = 1_000_000;

const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

type Loaded = {
  info: LayerInfo;
  data: LayerFeatures;
  charts: Breakdown[];
  labels: LayerLabels;
};

/**
 * Шошго асах ХАРЬЦАА — 1:496 000 (хэрэглэгчийн сонголт, 2026-09-15).
 *
 * Алсаас найман давхаргын бүх шошго нэг дор гарвал хүрээ нь өөрөө
 * уншигдахаа болино. Хязгаарыг zoom-оор бус ХАРЬЦААГААР тавьсан нь
 * санаатай: зургийн буланд гарах заалт мөн харьцаагаар бичигддэг тул
 * хэрэглэгч "хэдээс эхлэн харагдах вэ" гэдгээ тэндээс шууд уншина.
 */
const LABEL_SCALE = 496_000;
const LABEL_ZOOM = zoomForScale(LABEL_SCALE);

/** Хүрэшгүй ойртолт — давхаргыг унтраахад хэрэглэнэ */
const OFF_ZOOM = 24;

/**
 * Давхаргын ТЭРГҮҮЛЭХ тооллын задаргааны талбар — ганц утгат, хураагаагүй,
 * хугацааны биш. Нэргүй дүрсийг тодорхойлох ("Туул · № 30") ба давхаргыг
 * бүс болгон хуваахад ({@link LayerSet.splitZones}) хэрэглэгдэнэ.
 */
function leadGroup(hit: Loaded): string | undefined {
  return hit.charts.find(
    (b) => b.kind === "count" && !b.multi && !b.top && !isTime(b),
  )?.field;
}

/**
 * НЭРГҮЙ ДАВХАРГА ХӨРШӨӨСӨӨ НЭРИЙН БАГАНА ЗЭЭЛНЭ.
 *
 * Нэрийн баганыг дата өөрөө тогтоодог ({@link labelParts}) ч ганц
 * мөртэй давхаргад ялгах зүйл байхгүй тул тогтоож чадахгүй —
 * тэжээгдлийн муж (нэг дүрс) "№ 1" гэж гардаг байв (хэрэглэгч,
 * 2026-10-06: "ус хангамжийн эх үүсвэрийн нэрийг харуулаарай").
 * Нэг цэсийн давхаргууд ихэвчлэн НЭГ бүтэцтэй тул хөрш давхаргын
 * (хязгаарлалтын бүс — таван эх үүсвэрийн нэр) тогтоосон багана нь
 * энд ч мөн нэрийн багана.
 *
 * ⚠ Зөвхөн тэр багана ЭНЭ давхаргад БАЙГАА бөгөөд БӨГЛӨГДСӨН үед.
 * Таамаг биш: эх сурвалжийн өөрийн утга л гарна.
 * ⚠ Өөрчлөгдөх зүйл байхгүй бол ижил обьектыг буцаана — React-ийн
 * дахин зурагдалтыг дэмий өдөөхгүй.
 */
function borrowNames(m: Record<string, Loaded>): Record<string, Loaded> {
  const donors = Object.values(m)
    .map((h) => h.labels.name)
    .filter((x): x is string => !!x);
  if (!donors.length) return m;

  let out = m;
  for (const [id, hit] of Object.entries(m)) {
    /* Олон мөртэй давхаргад нэргүй байх нь датаны ДҮГНЭЛТ (хаяг, код
       мэт багана нэр болохгүй) — түүнийг дарахгүй */
    if (hit.labels.name || Object.keys(hit.data.rows).length > 1) continue;
    const field = donors.find(
      (name) =>
        hit.info.fields.some((f) => f.name === name) &&
        Object.values(hit.data.rows).some(
          (r) => categoryKey(r[name]) !== "Бүртгэгдээгүй",
        ),
    );
    if (!field) continue;
    if (out === m) out = { ...m };
    out[id] = { ...hit, labels: { ...hit.labels, name: field } };
  }
  return out;
}

/**
 * Дүрсний шошго — нэр ба хэмжээ хоёр мөрөнд.
 *
 * Хоосон утгыг ОГТ бичихгүй: зураг дээрх "—" нь мэдээлэл өгөхгүй,
 * зөвхөн дүрсээ дарна.
 */
/*
  УЛААНБААТАРААС ГАДУУРХ БҮРТГЭЛ ({@link LayerSet.withinUB}; хэрэглэгч,
  2026-10-07: "зөвхөн Улаанбаатараар filter харагдана шүү").
  Гүний худгийн паспортын 111 цэг хотоос хол (уртраг 101–106°, өргөрөг
  45–49°) байсан ч бүгд нийслэлийн дүүрэгтэй бүртгэгдсэн — координатын
  алдаа. Байрлалыг ГЕОМЕТРЭЭС, геометр ирээгүй (атрибут эхэлж ирдэг)
  үед "Уртраг", "Өргөрөг" баганаас — эс тэгвээс геометр ирэхэд тоо
  үсэрнэ. Координатгүй бүртгэл ҮЛДЭНЭ.
  ⚠ Давхаргын дата (`hit.data`) бүрд НЭГ УДАА бодогдоно.
*/
const OUTSIDE_UB = new WeakMap<object, Set<number>>();
function outsideUB(hit: Loaded): Set<number> {
  const done = OUTSIDE_UB.get(hit.data);
  if (done) return done;
  const at = new Map<number, { x: unknown; y: unknown }>();
  for (const f of hit.data.shapes.features)
    if (f.geometry?.type === "Point") {
      const [x, y] = f.geometry.coordinates;
      at.set(Number(f.id), { x, y });
    }
  const field = (re: RegExp) =>
    hit.info.fields.find((f) => re.test(f.name) || re.test(f.alias))?.name;
  const lonF = field(/^(уртраг|lon|longitude)$/i);
  const latF = field(/^(өргөрөг|lat|latitude)$/i);
  const out = new Set<number>();
  for (const [k, row] of Object.entries(hit.data.rows)) {
    const oid = Number(k);
    const p = pointOf(at.get(oid), lonF ? row[lonF] : undefined, latF ? row[latF] : undefined);
    if (p && !inUlaanbaatar(p.lon, p.lat)) out.add(oid);
  }
  OUTSIDE_UB.set(hit.data, out);
  return out;
}

function labelFor(hit: Loaded, oid: number): string {
  const row = hit.data.rows[oid];
  if (!row) return "";

  const lines: string[] = [];
  /* Цэгийн шошгын тусдаа талбар ({@link LayerSet.pointLabel}) */
  const own = hit.info.set.pointLabel;

  if (own) {
    const v = categoryKey(row[own]);
    if (v !== "Бүртгэгдээгүй") lines.push(v);
  } else if (hit.labels.name) {
    const v = categoryKey(row[hit.labels.name]);
    if (v !== "Бүртгэгдээгүй") lines.push(v);
  } else if (splitsZones(hit.info.set, hit.info.id)) {
    /*
      ⚠ НЭРГҮЙ ДҮРС БҮСИЙНХЭЭ НЭРЭЭР (хэрэглэгч, 2026-10-06: "label
      асаа"). Голын татмын 37 дүрс нэрийн баганагүй тул шошго огт
      гардаггүй байв — асаалттай байсан ч хоосон. Ангиллаараа бүс
      болгон хуваасан цэсэд ({@link LayerSet.splitZones}) тэр ангилал
      (сав газар) нь бүсийн картын мөр, цонхны "Нэр"-тэй НЭГ утга.
      ⚠ Ердийн цэсэд нэргүй давхарга шошгогүй хэвээр — ангиллыг
      олон зуун дүрс дээр давтах нь зургийг бөглөрүүлнэ.
    */
    const group = leadGroup(hit);
    const v = group ? categoryKey(row[group]) : "Бүртгэгдээгүй";
    if (v !== "Бүртгэгдээгүй") lines.push(v);
  }

  if (hit.labels.measure) {
    const v = Number(row[hit.labels.measure.field]);
    if (Number.isFinite(v)) {
      lines.push(
        `${measureText(v)}${hit.labels.measure.unit ? ` ${hit.labels.measure.unit}` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Ойн давхаргын нэгдсэн самбар.
 *
 * Өмнөх дөрвөн самбар давхарга тус бүрд НЭГ таб өгдөг байсан тул нэг
 * дор ганцыг л харна: "ялгарал хэсэглэлтэйгээ яаж давхцдаг вэ" гэсэн
 * асуулт хариултгүй үлддэг. Энэ самбар эсрэг зарчимтай — НЭГ зураг,
 * давхаргууд нь асаалт/унтраалттай.
 *
 * ДИАГРАМ НЬ ДАВХАРГАА ДАГАНА: асаасан давхарга бүр өөрийн задаргааг
 * доор нь нээнэ, унтраахад задаргаа нь ч алга болно. Хоёр давхарга
 * асаавал хоёр багц диаграм зэрэгцэнэ.
 *
 * Давхарга АСААХ ҮЕДЭЭ л татагдана: наймуулаа эхнээс нь татвал хэдэн
 * мегабайт дэмий явна. Нэг удаа татсаныг санах ойд үлдээнэ — дахин
 * асаахад шууд гарна.
 */
/*
  ЦЭСИЙН НАРИЙВЧИЛСАН ЭРХ ({@link src/lib/access.ts} `tabRule`, хэрэглэгч
  2026-10-20). Давхарга, үзүүлэлт, диаграмыг бүрдлээс нь (`LayerSet`)
  хасна — самбарын дотоод логик хөндөгдөхгүй; газрын зураг ба дэлгэрэнгүй
  цонхыг туг дамжуулж нууна.
  ⚠ Давхаргын ӨНГӨ ХЭВЭЭР: өнцөг нь жагсаалтын байрлалаас гардаг тул
  үлдсэн давхарга бүр ӨӨРИЙН анхны өнцгөө авч явна.
  ⚠ Дүрэм солигдоход самбар `key`-ээр дахин үүснэ (асаалттай давхарга,
  шүүлт хуучин бүрдлээрээ үлдэхгүй).
*/
function restrict(set: LayerSet, rule: TabRule): LayerSet | null {
  const layers = rule.layers ? set.layers.filter((id) => rule.layers!.includes(id)) : [...set.layers];
  if (!layers.length) return null;
  const views = rule.views;
  const out: LayerSet = {
    ...set,
    layers,
    hues: layers.map((id) => set.hues[set.layers.indexOf(id) % set.hues.length]),
    open: set.open?.filter((id) => layers.includes(id)),
    stats: set.stats?.filter((st) => layers.includes(st.layer)),
  };
  if (views && !views.includes("overview")) out.overview = false;
  if (views && !views.includes("charts")) out.noCharts = true;
  return out;
}

export function PortalLayersDashboard({
  set,
  presentation,
  access,
}: {
  set: LayerSet;
  presentation?: "environment";
  /** Эрхийн хязгаарыг унших хэсэг ба цэс (өгөөгүй бол хязгааргүй) */
  access?: { scope: string; tab: string };
}) {
  const { tabRule } = useAccess();
  const scope = access?.scope;
  const tab = access?.tab;
  const { rule, shown } = React.useMemo(() => {
    const r = scope && tab ? tabRule(scope, tab) : null;
    return { rule: r, shown: r ? restrict(set, r) : set };
  }, [set, tabRule, scope, tab]);
  if (!shown) return <NoAccess text="Энэ цэсийн давхаргыг харах эрх байхгүй байна" />;
  const views = rule?.views;
  return (
    <LayersBoard
      key={rule ? JSON.stringify(rule) : ""}
      set={shown}
      presentation={presentation}
      noMap={!!views && !views.includes("map")}
      noRecord={!!views && !views.includes("record")}
    />
  );
}

function LayersBoard({
  set,
  presentation,
  noMap = false,
  noRecord = false,
}: {
  set: LayerSet;
  presentation?: "environment";
  noMap?: boolean;
  noRecord?: boolean;
}) {
  const environment = presentation === "environment";
  const [showCharts, setShowCharts] = React.useState(true);
  /** Давхарга бүрийн тодорхойлолт — эхэнд бүгдийг НЭГ удаа уншина */
  const [infos, setInfos] = React.useState<Record<string, LayerInfo>>({});
  const [failed, setFailed] = React.useState<Record<string, string>>({});
  const [ready, setReady] = React.useState(false);
  /*
    ТАТАЦ ЯВАГДАЖ БАЙГААГ ТӨЛӨВӨӨР барина (`inFlight` нь ref тул
    зурагдалтыг сэргээдэггүй).

    Атрибут ба геометр нь ХОЁР ҮЕ ШАТТАЙ: эхнийх нь ирмэгц диаграм,
    үзүүлэлт бүгд зурагдана, хоёр дахь нь ирэх хүртэл газрын зураг
    ХООСОН байна. Сэдэв тус бүрд зориулсан цонхонд (`openAll`)
    давхаргын жагсаалт байдаггүй тул тэр хүлээлт хаана ч харагдахгүй —
    хэрэглэгч цэвэр суурь зураг хараад "юу ч гарч ирэхгүй байна" гэж
    үздэг (2026-09-25). Хоосон зураг нь ТӨЛӨВ, баримт БИШ.
  */
  const [busy, setBusy] = React.useState<Record<string, true>>({});

  /* Асаалттай давхаргууд. Эхлэх төлөвийг бүртгэл шийднэ
     ({@link LayerSet.openAll}, {@link LayerSet.open}) — давхаргын тоо БИШ */
  const [on, setOn] = React.useState<string[]>(() =>
    set.openAll
      ? [...set.layers]
      : set.exclusive
        ? /* `open` нь анхдагч сонголтыг заана (гадаргын ус: 2026),
             өгөөгүй бол жагсаалтын эхнийх */
          [set.open?.find((id) => set.layers.includes(id)) ?? set.layers[0]]
        : (set.open ?? []).filter((id) => set.layers.includes(id)),
  );

  /*
    ДАВХАРГА СОНГОХ ХЭСЭГ ГАРАХ ЭСЭХ.

    ⚠ Сэдэв тус бүрд зориулсан цонх дээр (`openAll`) сонгох зүйл
    БАЙХГҮЙ: тэнд байгаа давхаргууд бүгд тэр сэдвийнх бөгөөд аль
    хэдийн асаалттай. Хоосон сонголттой жагсаалт нь дэлгэцийн зүүн
    гуравны нэгийг эзлээд хариулт өгөхгүй тул баганыг нь БҮХЭЛД НЬ
    авч, диаграмууд шууд харагдана (хэрэглэгчийн шийдвэр, 2026-09-16:
    "бүх давхарга хэсгийг авч шууд чартууд харагддаг болго").

    Ойн хэлтэс дээр долоон давхарга ХООСОН эхэлдэг тул тэнд жагсаалт
    хэвээр — тэр нь жинхэнэ сонголт.
  */
  const picker = !set.openAll && !set.exclusive;
  /* `mapOnly` давхаргууд зургийн сонгогчид ({@link LayerSet.mapPicker}) */
  const mapPicker = picker && set.mapPicker === true;
  const mapIds = React.useMemo(
    () => (mapPicker ? set.layers.filter((id) => set.mapOnly?.includes(id)) : []),
    [mapPicker, set.layers, set.mapOnly],
  );
  const listIds = React.useMemo(
    () => set.layers.filter((id) => !mapIds.includes(id)),
    [set.layers, mapIds],
  );
  /** Зүүн баганын давхаргын жагсаалт гарах эсэх */
  /* `mapPicker` бүрдэлд ГАНЦ давхарга үлдвэл сонгох зүйл байхгүй тул
     карт гарахгүй (хэрэглэгч, 2026-10-06: "одоо энэ карт хэрэггүй") —
     тэр давхарга `open`-оор анхнаасаа асаалттай */
  const listColumn = picker && listIds.length > (mapPicker ? 1 : 0);
  /** Татагдсан бичлэгүүд — унтраасан ч санах ойд үлдэнэ */
  const [loaded, setLoaded] = React.useState<Record<string, Loaded>>({});
  /* Явж буй хүсэлтүүд — ref, учир нь зурагдалтад нөлөөлдөггүй. Төлөвд
     барьвал effect-ийн биед `setState` дуудагдаж шаталсан зурагдалт
     үүснэ; ачаалж буй эсэх нь дам гарах утга (доорх `loading`) */
  /* Давхарга бүрийн ТАТАЦ ба түүнийг таслах эрх — эффектийн
     цэвэрлэгээнд БИШ, давхаргад харьяалагдана */
  const inFlight = React.useRef<Map<string, AbortController>>(new Map());

  /*
    Давхарга бүрийг ЯМАР ТАЛБАРААР өнгөт болгох вэ.

    Утга нь хэрэглэгчийн ИЛ сонголт: талбарын нэр бол тэр талбараар,
    `null` бол давхаргын ганц өнгөөр. Бүртгэгдээгүй давхарга нь
    анхдагчаа дагана (доорх `colorField`) — анхдагчийг төлөвт
    хуулбарлавал дата ирэх бүрд effect-ээс `setState` дуудагдана.
  */
  /* Он ба сарын НЭГДСЭН картын сонгосон харагдац, давхаргаар
     ({@link LayerSet.tidy}) */
  const [timeView, setTimeView] = React.useState<Record<string, "year" | "month">>({});
  const [colorBy, setColorBy] = React.useState<Record<string, string | null>>(
    {},
  );

  /*
    ШҮҮЛТ — давхарга → талбар → сонгосон утга.

    Давхарга бүр ӨӨРИЙН шүүлттэй: талбарууд нь давхаргаас давхаргад
    өөр бөгөөд нэг нэрийн доор өөр утга агуулж болно.

    Талбар бүр ОЛОН утга авна: нэг ангиллыг нөгөөтэй нь харьцуулах,
    хэд хэдэн дүүргийг зэрэг үзэх нь энэ датад байнга хэрэгтэй.
    Нэг талбарын доторх утгууд нь ЭСВЭЛ (аль нэгэнд нь таарвал
    үлдэнэ), талбарууд хооронд нь БА (бүгдийг хангах ёстой).
  */
  const [filters, setFilters] = React.useState<
    Record<string, Record<string, string[]>>
  >({});

  /*
    ЦУВААНЫ (ОНЫ) сонголт.

    Он нь МӨР биш БАГАНА: нэг бичлэг гурван оны утгыг зэрэг агуулдаг
    тул "2024 оны бичлэгүүд" гэж шүүх боломжгүй. Оноор шүүнэ гэдэг нь
    ХАРУУЛАХ цуваагаа сонгох гэсэн үг — тиймээс мөрийн шүүлтээс
    (`filters`) тусдаа төлөв.

    Хоосон бол БҮГД харагдана.
  */
  const [series, setSeries] = React.useState<Record<string, string[]>>({});

  const [picked, setPicked] = React.useState<number | null>(null);
  /*
    Шошгын эхлэх төлөвийг БҮРТГЭЛ шийднэ ({@link LayerSet.labels}).

    Ойн хэлтэс дээр АНХНААСАА УНТРААЛТТАЙ (хэрэглэгчийн шийдвэр,
    2026-09-15): олон хэсэгтэй дүрс (100 метрийн зурвас гэх мэт)
    хэсэг болгондоо шошго авдаг тул найман давхарга нэг зурагт
    нийлэхэд бичвэр нь зургийг дардаг.

    Ногоон бүсийн хэлтэс дээр харин АСААЛТТАЙ (хэрэглэгчийн шийдвэр,
    2026-09-16): цэс бүр нэг, хоёр давхаргатай тул тэр эрсдэл бага
    бөгөөд шошго нь "энэ юу вэ" гэдэгт шууд хариулна.
  */
  const [showLabels, setShowLabels] = React.useState(Boolean(set.labels));

  /* Бүрдлийн анхны суурь зураг ({@link LayerSet.basemap}) */
  const [basemap, setBasemap] = React.useState<Basemap>(
    () => BASEMAPS.find((b) => b.id === set.basemap) ?? defaultBasemap(),
  );

  /*
    НЭГЖ ТАЛБАРЫН СУУРЬ ДАВХАРГА (`Parcel_all`, 524,052 олон өнцөгт).

    ⚠⚠ Бүртгэлийн давхаргуудаас ӨӨР ЗАРЧМААР ажиллана: `LayerSet`-д
    ОРОХГҮЙ, диаграм ч үүсгэхгүй. Хагас сая дүрсийг татах боломжгүй
    тул зөвхөн ХАРАГДАХ ХҮРЭЭНИЙ дотор, зөвхөн ОЙРТСОН үед
    (1:12 000) асуулга явуулна — засаг захиргааны хилтэй нэг үүрэг:
    "энэ дүрс хэний газар дээр байна" гэдгийг харуулна.

    ⚠ Татац нь `moveend` дээр л явна, чирэх ЯВЦАД биш. Өмнөх хүсэлт
    дуусаагүй байхад шинэ хөдөлгөөн гарвал хуучныг ТАСАЛНА
    (`AbortController`) — эс тэгвээс хоцорсон хариу шинийг дарж бичнэ.
  */
  /* Анхны төлөв нь БҮРТГЭЛЭЭС ({@link LayerSet.parcels}): самбар нь
     цэс бүрд `key`-ээр дахин үүсдэг тул цэс солиход шинээр уншигдана */
  const [parcelsOn, setParcelsOn] = React.useState(set.parcels === true);
  /*
    ⚠⚠ ТОВЧ нь ӨӨРӨӨ ТИЙШ АВААЧНА (хэрэглэгч, 2026-09-25: "миний
    өгсөн parcel-ийг харуулж чадахгүй байгаа юм уу").

    Хязгаар нь 1:13 000 буюу zoom 13.9 бөгөөд самбарын анхны харагдац
    нь zoom 9–10 — хэрэглэгч ТАВАН түвшин ойртох шаардлагатай байв.
    Товч дарахад юу ч гарахгүй тул "ажиллахгүй байна" гэж үзнэ.
    Одоо хол байхад товч дарвал зураг одоогийн ТӨВӨӨ хадгалан
    хязгаар хүртэл ойртоно — нэг товшилтоор харагдана.

    ⚠ Нягтрал өндөр (хотын төвд 1 км-т 167, 2 км-т 822, 4 км-т 5,061
    нэгж талбар) тул хязгаарыг СУЛРУУЛАХ боломжгүй: 1:40 000 дээр
    хорин мянга давах бөгөөд хязгаарт тасарсан ХЭСЭГЧИЛСЭН тор нь
    санамсаргүй мэт харагдана.
  */
  const [parcelFocus, setParcelFocus] = React.useState<Extent | null>(null);
  const [parcels, setParcels] = React.useState<ParcelTile>(NO_PARCELS);
  const [parcelErr, setParcelErr] = React.useState<string | null>(null);
  const [view, setView] = React.useState<{
    box: [number, number, number, number];
    zoom: number;
  } | null>(null);
  const parcelZoom = React.useMemo(() => zoomForScale(PARCEL_SCALE), []);
  const close = view != null && view.zoom >= parcelZoom;
  /* Суурь хил ойртоход ӨӨРӨӨ гарах эсэх ({@link LayerSet.parcelsNear}) —
     товч нь тэр үед зөвхөн давхцсан нэгж талбарыг тодруулна */
  const baseParcels = parcelsOn || Boolean(set.parcelsNear);
  /*
    БҮСТЭЙ ДАВХЦСАН нэгж талбарын хаалт — 1:120 000 (хэрэглэгч,
    2026-10-02: "1:120 000-с харагддаг болгоё parcel").

    ⚠ СУУРЬ нэгж талбарынхаас (1:13 000) ХОЛ: давхцсан нь бүхэл
    хотыг биш, зөвхөн татамын дотор талыг хамардаг тул тэр
    масштабт ч уншигдана.
    ⚠ Хэмжсэн (2026-10-02, бодит үйлчилгээ):

      1:120,000 ≈ 44 км → 72,713 давхцал (≈14 МБ, 37 хуудас)
      1:60,000  ≈ 22 км → 38,161
      1:30,000  ≈ 11 км → 11,366
      1:13,000  ≈  5 км →  3,990

    ⚠ Ерөнхийлөлт (`maxAllowableOffset`) ТУС БОЛОХГҮЙ: 2 м → 20 м
    болгоход хуудас 0.47-оос 0.39 МБ л болно — ачаалал нь оройнууд
    биш, бичлэг тутмын JSON-ы ТУЗ.
  */
  const zoneZoom = React.useMemo(() => zoomForScale(ZONE_SCALE), []);
  const zoneClose = view != null && view.zoom >= zoneZoom;

  React.useEffect(() => {
    if (!baseParcels || !view || !close) return;
    const ac = new AbortController();
    fetchParcelsIn(view.box, ac.signal, view.zoom)
      .then((t) => {
        if (ac.signal.aborted) return;
        setParcels(t);
        setParcelErr(null);
      })
      .catch((e: Error) => {
        /* Суурь давхарга тул самбарыг УНАГААХГҮЙ — гэхдээ ЧИМЭЭГҮЙ ч
           хоосон үлдээхгүй: хэрэглэгч "хил харагдахгүй байна" гэж
           мэдээлэхэд шалтгаан нь хаана ч бичигдээгүй байв (2026-10-06).
           Алдаа нь товчны доорх мөрөнд гарна */
        if (ac.signal.aborted || e.name === "AbortError") return;
        setParcels(NO_PARCELS);
        setParcelErr(e.message);
      });
    return () => ac.abort();
  }, [baseParcels, view, close]);

  /* Унтраасан, эсвэл хол байхад ДАМ хоосон — эффектээс `set*`
     дуудах нь `react-hooks/set-state-in-effect`-д хориотой бөгөөд
     нэмэлт зурагдалт үүсгэнэ */
  const shownParcels = baseParcels && close ? parcels : NO_PARCELS;

  /*
    БҮСТЭЙ ДАВХЦАХ НЭГЖ ТАЛБАР — ТОДООР (хэрэглэгч, 2026-09-29:
    "parcel map дээр харагдахгүй байна, бүгдийг харуулах ёстой, 3
    бүстэй давхцаж байгаа нь улаан өнгөөр ч юмуу тодоор харагдана").

    ⚠⚠ Яагаад харагдахгүй байсан бэ: суурь давхаргын татац нь
    ХАРАГДАХ ХҮРЭЭНД, зөвхөн 1:13 000-аас ОЙРТСОН үед л ажилладаг.
    Гэтэл хамгаалалтын гурван бүс нь хотыг бүхэлд нь хамардаг тул
    хэрэглэгч тэр харагдацад (1:400 000 орчим) байхад нэгж талбар
    ХЭЗЭЭ Ч гардаггүй байв.

    ⚠⚠ "БҮГДИЙГ" гэдэг нь 524,052 дүрс БИШ — тэр нь 262 хуудас,
    хэдэн зуун мегабайт бөгөөд хөтөч зогсоно. Хэрэглэгчийн асуултын
    бодит агуулга нь "БҮСЭД ДАВХЦАЖ БУЙ бүгд" тул давхцлыг СЕРВЕР
    олж, зөвхөн тэднийг татна: хэмжсэнээр ~33 мянга (бүсүүд хоорондоо
    давхцдаг тул давхардалгүй нь бага).
    ⚠ Ойртолтоос ҮЛ ХАМААРНА: энэ нь суурь биш ДАТА — "хамгаалалтын
    бүсэд хэдэн газар орсон бэ" гэсэн асуултын хариулт.

    ⚠ ӨНГӨ нь ДОХИО (`--clay`-гийн тогтмол hex): хамгаалалтын бүсэд
    орсон газар нь анхаарал шаардана. Газрын зураг хоёр горимд ижил
    байх ёстой тул CSS хувьсагч БИШ hex.
    ⚠ Суурь (саарал) нэгж талбар ХЭВЭЭР: ойртсон үед контекст өгнө.
  */
  const zoneRings = React.useMemo(() => {
    if (!set.zones) return [];
    const out: GeoJSON.Position[][] = [];
    for (const id of on) {
      const hit = loaded[id];
      if (!hit || hit.info.geometry === "Point") continue;
      out.push(...ringsOf(hit.data.shapes.features));
    }
    return out;
  }, [set.zones, on, loaded]);

  /*
    ⚠⚠ ХАРАГДАХ ХҮРЭЭГЭЭР ТАЙРНА (2026-10-02, токеноор хэмжсэний
    дараа). Туулын татамтай **87,947** нэгж талбар давхцдаг — бүгдийг
    татвал хэдэн арван мегабайт болж, хотын төв бүхэлдээ улаан тор
    болно. Тайрсан цагираг нь зөвхөн дэлгэц дээрхийг асууна; хүрээнээс
    гадуурх нэгж талбар ямар ч байсан харагдахгүй тул дүрслэл
    АЛДАГДАХГҮЙ.
    ⚠ Хол байхад тайралт юу ч өгөхгүй (бүх хот багтана) тул тэр үед
    `ZONE_LIMIT` хамгаалалт ажиллана: тоог нь хэлээд татахгүй.
  */
  const zoneClip = React.useMemo(() => {
    if (!view || !zoneRings.length) return [];
    /*
      ⚠ ХЯЛБАРЧЛАЛТЫН ХҮЛЦЭЛ нь ДЭЛГЭЦИЙН 1.5 ПИКСЕЛ: харагдах
      масштабт үл мэдэгдэх алдаа бөгөөд ойртох тусам өөрөө нарийсна.
      Хэмжсэнээр асуулгын хуудас 0.51-ээс 0.31 секунд болно
      ({@link simplifyRings}).
    */
    const mPerPx =
      (156543.03392 * Math.cos((47.9 * Math.PI) / 180)) / 2 ** view.zoom;
    return simplifyRings(
      clipRings(zoneRings, view.box),
      (1.5 * mPerPx) / 111320,
    );
  }, [zoneRings, view]);

  /* Аль бүс, ямар хүрээнд татсаныг нэрлэх түлхүүр — үүнгүй бол бүс
     эсвэл хүрээ солиход ӨМНӨХ татацын нэгж талбар зураг дээр үлдэнэ */
  const zoneKey = React.useMemo(
    () => `${on.join("|")}:${zoneRings.length}:${view?.box.join(",") ?? ""}`,
    [on, zoneRings, view],
  );
  const [zoneParcels, setZoneParcels] = React.useState<{
    key: string;
    tile: ParcelTile;
  }>({ key: "", tile: NO_PARCELS });

  React.useEffect(() => {
    if (!parcelsOn || !zoneClose || !zoneClip.length) return;
    const ac = new AbortController();
    fetchParcelsOn(zoneClip, ac.signal, ZONE_LIMIT, (tile) => {
      /* Хуудас ирэх бүрд шууд зурна — 37 хуудсыг бүгдийг хүлээхгүй */
      if (!ac.signal.aborted) setZoneParcels({ key: zoneKey, tile });
    })
      .then((tile) => {
        if (!ac.signal.aborted) setZoneParcels({ key: zoneKey, tile });
      })
      .catch(() => {
        /* Суурь давхарга тул самбарыг УНАГААХГҮЙ */
        if (!ac.signal.aborted)
          setZoneParcels({ key: zoneKey, tile: NO_PARCELS });
      });
    return () => ac.abort();
  }, [parcelsOn, zoneClose, zoneClip, zoneKey]);

  /* Төлөв нь ДАМ гарна: эффектээс `set*` дуудахыг
     `react-hooks/set-state-in-effect` хориглодог */
  const zoneReady = zoneParcels.key === zoneKey;
  const shownZoneParcels =
    parcelsOn && zoneReady ? zoneParcels.tile : NO_PARCELS;
  const zoneBusy = parcelsOn && zoneClose && zoneClip.length > 0 && !zoneReady;

  /*
    НЭГЖ ТАЛБАРЫН ДИАГРАМААС СОНГОСОН АНГИЛАЛ ({@link ParcelCard}) —
    тэр бүсийн тэр ангиллын нэгж талбаруудыг серверээс нөхцөлөөр татна.
    ⚠ Үр дүн нь СОНГОЛТЫН `id`-тайгаа — сонголт солигдоход хуучин тор
    зурагт үлдэхгүй (эффектээс `set*(null)` дуудахгүй, ДАМ шалгана).
  */
  const [parcelPick, setParcelPick] = React.useState<ParcelPick | null>(null);
  /* Огнооны мөрийн сонгосон талбар, давхарга бүрээр ({@link dateBar}) */
  const [dateWant, setDateWant] = React.useState<Record<string, string>>({});
  const [pickTile, setPickTile] = React.useState<{
    id: string;
    tile: ParcelTile;
  } | null>(null);
  React.useEffect(() => {
    if (!parcelPick) return;
    const ac = new AbortController();
    fetchParcelsOn(
      parcelPick.rings,
      ac.signal,
      undefined,
      undefined,
      parcelPick.where,
    )
      .then((tile) => {
        if (!ac.signal.aborted) setPickTile({ id: parcelPick.id, tile });
      })
      .catch(() => {
        if (!ac.signal.aborted)
          setPickTile({ id: parcelPick.id, tile: NO_PARCELS });
      });
    return () => ac.abort();
  }, [parcelPick]);
  const shownPick =
    parcelPick && pickTile?.id === parcelPick.id ? pickTile.tile : null;

  /* Тодорсон нэгж талбарууд руу ОЙРТОНО */
  const pickFocus = React.useMemo<Extent | null>(() => {
    if (!shownPick?.data.features.length) return null;
    const b = new Bounds();
    for (const f of shownPick.data.features)
      if (f.geometry) b.addGeometry(f.geometry);
    return b.get(0.004);
  }, [shownPick]);

  const onView = React.useCallback(
    (box: [number, number, number, number], zoom: number) =>
      setView({ box, zoom }),
    [],
  );

  /*
    ⚠ ХОЁР ДАВХАРГА: саарал нь СУУРЬ (харагдах хүрээнд, ойртсон үед),
    улаан нь ДАТА (бүстэй давхцсан). Улаан нь дээр нь суух ёстой.
  */
  const overlays = React.useMemo(() => {
    const list: NonNullable<React.ComponentProps<typeof LayerMap>["overlays"]> =
      [];
    /*
      ⚠⚠ ДИАГРАМААС АНГИЛАЛ СОНГОСОН ҮЕД ЗУРАГ ШҮҮГДЭНЭ (хэрэглэгч,
      2026-10-06: "map дээр шүүгдэнэ шүү"). Сонгосон нэгж талбарууд
      бусад бүх нэгж талбарын торын ДЭЭР тодорч байсан нь шүүлт биш
      тодруулга байв. Одоо суурь тор (саарал) ба бүстэй давхцсан
      (улаан) нэгж талбар НУУГДАЖ, зөвхөн сонгосон ангилал үлдэнэ.
      Цуцлахад бүгд буцаж гарна.
      ⚠ Бүсийн дүрс (татам, хамгаалалтын бүс) ХЭВЭЭР — сонгосон нэгж
      талбарууд аль бүсэд байгааг хүрээ нь хэлнэ.
    */
    const filtering = Boolean(parcelPick);
    if (!filtering && shownParcels.data.features.length)
      list.push({
        id: "parcel",
        /* ⚠ Дүүргэлт МАШ БҮДЭГ: нэгж талбар нь ДАТА биш СУУРЬ —
           доорх хиймэл дагуул, дээрх дата давхаргыг дарахгүй */
        data: shownParcels.data,
        /*
          ⚠⚠ ЦАЙВАР СААРАЛ (хэрэглэгч, 2026-10-06; "цагаан биш" →
          "шар биш! cyan" → "чи өөрөө зохицох өнгө өг" → "цагаан
          саарал болго"). Платформын хүйтэн slate гэр бүл (#c3cad3) —
          засаг захиргааны хилийн ЦЭВЭР цагаанаас (#ffffff) бага зэрэг
          бараан тул хоёр нь нийлэхгүй, гэхдээ өнгөгүй тул дохио ч,
          дата ч мэт уншигдахгүй.
          ⚠ Элсэн шар, цэнхэр, лаванда гурвуулаа туршигдаж БУЦААГДСАН.
          ⚠ Тогтмол hex — газрын зураг хоёр горимд ижил.
        */
        fill: { color: set.parcelLine?.color ?? "#c3cad3", opacity: 0.06 },
        /* ⚠ Зузаан 1.0px (хэрэглэгч, 2026-10-02: "parcel border
           нарийсгаарай", `dept/amitan-urgamal`-аас).
           ⚠⚠ ЗУРААС 0.7px-ЭЭС 1.2px БОЛОВ: дэд пикселийн, бүдэг
           цагаан зураас нь хиймэл дагуулын зураг дээр бүрэн уусдаг
           ({@link shape-case}). Зузаан нь ч болохгүй — нэгж талбар
           нягт тор тул 1.2px дээр тор нь уншигдаж, доорх зураг нь
           харагдсаар байна. */
        /* Бүрдэл өөрийн зураастай байж болно ({@link LayerSet.parcelLine}) */
        line: set.parcelLine
          ? { width: 1.0, ...set.parcelLine }
          : { color: "#c3cad3", opacity: 0.85, width: 1.0 },
        /*
          ⚠⚠ ХИЛ, БҮСИЙН ДЭЭР (хэрэглэгч, 2026-10-06: "parcel хилийн
          дээр харагдъя"). Урьд нь засаг захиргааны хилийн ДООР
          (`bnd-country`-ийн өмнө) суудаг байсан тул бүсийн дүүргэлт
          (татам, хамгаалалтын бүс) нь торыг дарж, бүсийн дотор нэгж
          талбар харагдахгүй байв. Одоо шошгын доор, бусад бүхний дээр.
          ⚠ Дүүргэлт нь 6% тул доорх бүсийн өнгө уншигдсаар байна.
        */
        above: true,
      });
    /*
      БҮСТЭЙ ДАВХЦСАН нь ТОДООР — бүсийн ногоонтой НЭГ ГЭР БҮЛД,
      гэрэлтэлтээрээ салсан бараан номин (хэрэглэгч, 2026-10-02:
      "parcel өнгийг өөрчилье, ногоонтой зохицох өнгө өгөөрэй").

      ⚠⚠ Улаан (`--clay` #e47b7b) нь бүсийн ногоонуудтай ердөө
      **1.3:1** харьцаатай байсан (WCAG, хэмжсэн) — дохионы өнгө
      боловч яг тэр газартаа уусдаг байв. Бараан номин нь дөрвөн сав
      газрын ногоон дээр **4.9–5.2:1** өгнө.
      ⚠ Өнцөг нь 175 — сав газруудын муж (195…116)-ийн дотор тул
      "ногоонтой зохицно"; ялгаа нь зөвхөн ГЭРЭЛТЭЛТЭЭР (L 0.34).
      ⚠ Тогтмол hex: "газрын зураг хоёр горимд ижил" дүрэм.
    */
    if (!filtering && shownZoneParcels.data.features.length)
      list.push({
        id: "parcel-zone",
        data: shownZoneParcels.data,
        fill: { color: "#004635", opacity: 0.35 },
        /* ⚠ ЗУРААС 1.2-ООС 0.8px (хэрэглэгч, 2026-10-02: "parcel
           border нарийсгаарай"). Суурь нэгж талбарын цайвар зурааст
           1.2px ЗААВАЛ (0.7px нь хиймэл дагуул дээр уусдаг) ч энэ нь
           бараан, 35% дүүргэлттэй тул нимгэн ч тод үлдэнэ — нягт
           хэсэгт мөн зураасны тор бага болно. */
        line: { color: "#004635", opacity: 0.95, width: 0.8 },
        /* Бүсийн дүүргэлтийн ДЭЭР — доор нь орвол огт харагдахгүй */
        above: true,
      });
    /*
      Диаграмаас сонгосон ангилал — СУУРЬ НЭГЖ ТАЛБАРТАЙ ИЖИЛ ЦАЙВАР
      СААРАЛ (хэрэглэгч, 2026-10-06: "өмнөх шигээ цагаан саарлаараа
      харагдана"). Шүүлт нь "бусад нь алга болж, үлдсэн нь ердийнхөөрөө"
      гэсэн утгатай — тусгай тодруулга БИШ.
      ⚠⚠ ТУРШИЖ БУЦААГДСАН: (1) бүсийн өнгө — бүсийнхээ дүүргэлттэй
      ижил болж уусдаг байв; (2) цагаан дүүргэлт + бараан касинг —
      хэрэглэгч ердийн саарлыг сонгов.
      ⚠ Зураас нь шошгын доор, бүсийн дүүргэлтийн ДЭЭР (`above`) — эс
      тэгвээс бүсийн дүүргэлт доороо дарна.
    */
    if (parcelPick && shownPick?.data.features.length)
      list.push({
        id: "parcel-pick",
        data: shownPick.data,
        fill: { color: "#c3cad3", opacity: 0.06 },
        line: { color: "#c3cad3", opacity: 0.85, width: 1.2 },
        above: true,
      });
    return list.length ? list : undefined;
  }, [shownParcels, shownZoneParcels, parcelPick, shownPick, set.parcelLine]);
  const tip = useMapTip();

  /*
    Найман давхаргын ТОДОРХОЙЛОЛТЫГ зэрэг уншина — энэ нь хөнгөн
    (давхарга тутамд гурван жижиг хүсэлт) бөгөөд жагсаалтад нэр,
    бичлэгийн тоог шууд харуулах боломж өгнө. Бичлэг нь татагдахгүй.

    Нэг давхарга уншигдахгүй байгаа нь бусдыг зогсоох ЁСГҮЙ: алдааг
    нэрлэж үлдээгээд үлдсэнийг үргэлжлүүлнэ.
  */
  React.useEffect(() => {
    const ac = new AbortController();
    let alive = true;

    Promise.all(
      set.layers.map((id) =>
        fetchLayerInfo(set, id, ac.signal).then(
          (info) => ({ id, info }),
          (e: Error) => ({ id, error: e.message }),
        ),
      ),
    ).then((all) => {
      if (!alive) return;
      const ok: Record<string, LayerInfo> = {};
      const bad: Record<string, string> = {};
      for (const r of all) {
        if ("info" in r) ok[r.id] = r.info;
        else bad[r.id] = r.error;
      }
      setInfos(ok);
      setFailed(bad);
      setReady(true);
    });

    return () => {
      alive = false;
      ac.abort();
    };
    /* Бүртгэл солигдвол (өөр хэлтсийн самбар) тодорхойлолтыг шинээр
       уншина — хуучин давхаргууд жагсаалтад үлдэх ёсгүй */
  }, [set]);

  /*
    Асаалттай боловч татагдаагүй давхаргыг татна.

    ⚠⚠ **ЭФФЕКТ ӨӨРИЙНХӨӨ ГЕОМЕТРИЙГ ТАСАЛДАГ БАЙВ** (2026-09-30,
    хэрэглэгч: "map хараарай" — зураг дээр цэг ч, дүрс ч байхгүй,
    "Дүрсийн хүрээ ирсэнгүй").

    Давхарга ХОЁР ҮЕ ШАТААР ирдэг: эхлээд атрибут (`place(partial)`),
    дараа нь геометртэй бүтэн хувилбар. Гэтэл эхний `place` нь
    `setLoaded` дуудаж `loaded`-ийг ШИНЭЧИЛДЭГ бөгөөд тэр нь ЭНЭ
    эффектийн хамаарлын жагсаалтад байсан — улмаас:
      1. атрибут ирнэ → `setLoaded` → дахин зурагдалт;
      2. эффект дахин ажиллахын ӨМНӨ ЦЭВЭРЛЭГЭЭ нь `ac.abort()`
         дуудаж, ЯГ ТЭР давхаргын ГЕОМЕТРИЙН хүсэлтийг таслана;
      3. татац `AbortError`-оор унаж, `catch` нь түүнийг чимээгүй
         алгасна (алдаа биш гэж үзээд);
      4. дахин ажиллахад `loaded[id]` аль хэдийн тавигдсан тул
         давхарга `want`-д ОРОХГҮЙ — геометр ХЭЗЭЭ Ч ирэхгүй.

    ⚠ Иймээс диаграм, тоо бүрэн зурагдаж байхад зураг хоосон үлддэг
    байв — "0 бичлэг" биш харин "бичлэг бий, дүрс алга" гэсэн яг тэр
    завсрын төлөв. Кэш ХАЛУУН үед (нэг сесс дотор цэс рүү дахин
    орох) хоёр амлалт зэрэг шийдэгддэг тул геометр амжиж суудаг —
    тиймээс алдаа "заримдаа ажиллаад заримдаа үгүй" мэт харагдаж,
    2026-09-24, 09-25-нд хоёр ч удаа ӨӨР шалтгаан хайлгасан
    (`shape-case`, `mapNote`).

    ✅ Одоо таслах эрх нь ЭФФЕКТИЙН ЦЭВЭРЛЭГЭЭНД БИШ, ДАВХАРГАД
    харьяалагдана: давхарга бүр өөрийн `AbortController`-тэй
    (`inFlight`), цэвэрлэгээ юу ч таслахгүй. Таслалт зөвхөн ХОЁР
    тохиолдолд — давхарга унтрах, самбар салах.
  */
  React.useEffect(() => {
    const flight = inFlight.current;
    const want = on.filter((id) => infos[id] && !loaded[id] && !flight.has(id));
    if (!want.length) return;

    const started = new Map<string, AbortController>();
    for (const id of want) {
      const ac = new AbortController();
      started.set(id, ac);
      flight.set(id, ac);
    }
    setBusy((b) => {
      const next = { ...b };
      for (const id of want) next[id] = true;
      return next;
    });

    for (const [id, ac] of started) {
      const info = infos[id];
      /* Атрибут ирмэгц (геометрээс өмнө) диаграм, жагсаалтыг зурна;
         геометр ирэхэд ижил бичлэг зураг дээр нэмэгдэнэ */
      const place = (data: LayerFeatures) => {
        if (ac.signal.aborted) return;
        setLoaded((m) => {
          /* Хэсэгчилсэн (атрибут) ба бүтэн (геометртэй) хувилбар НЭГ
             мөрийн обьектыг хуваалцдаг тул задаргааг дахин тооцохгүй —
             худаг дээр тэр нь секундээр хэмжигддэг ажил */
          const prev = m[id];
          const same = prev && prev.data.rows === data.rows;
          return borrowNames({
            ...m,
            [id]: {
              info,
              data,
              charts: same ? prev.charts : breakdowns(info, data),
              labels: same ? prev.labels : labelParts(info, data),
            },
          });
        });
      };
      fetchLayerFeatures(info, ac.signal, place)
        .then(place)
        .catch((e: Error) => {
          if (ac.signal.aborted || e.name === "AbortError") return;
          setFailed((f) => ({ ...f, [id]: e.message }));
          setOn((s) => s.filter((x) => x !== id));
        })
        .finally(() => {
          /* Зөвхөн ӨӨРИЙНХӨӨ бүртгэлийг авна: давхарга унтраагаад
             дахин асаасан бол шинэ controller сууж байж болно */
          if (flight.get(id) === ac) flight.delete(id);
          setBusy((b) => {
            if (!b[id]) return b;
            const next = { ...b };
            delete next[id];
            return next;
          });
        });
    }
    /* ⚠ ЦЭВЭРЛЭГЭЭ ТАСЛАХГҮЙ — дээрх тайлбарыг үзнэ үү */
  }, [on, infos, loaded]);

  /* Унтраасан давхаргын татацыг таслана — үр дүн нь хэрэггүй болсон */
  React.useEffect(() => {
    const flight = inFlight.current;
    for (const [id, ac] of flight) {
      if (on.includes(id)) continue;
      ac.abort();
      flight.delete(id);
    }
  }, [on]);

  /* Самбар салахад бүх татац таслагдана */
  React.useEffect(() => {
    const flight = inFlight.current;
    return () => {
      for (const ac of flight.values()) ac.abort();
      flight.clear();
    };
  }, []);

  /*
    ДҮРС БҮРИЙН ДҮҮРЭГ ({@link LayerSet.districts}) — давхаргад дүүргийн
    талбар байхгүй тул хилээс тооцоолно. Давхарга бүрд НЭГ удаа.
    `null` нь "уншигдсангүй" (хил татагдаагүй) — чарт түүнийг хэлнэ.
  */
  const [districts, setDistricts] = React.useState<
    Record<string, Map<number, string> | null>
  >({});
  const districtsAsked = React.useRef(new Set<string>());
  React.useEffect(() => {
    for (const id of set.districts ?? []) {
      const feats = loaded[id]?.data.shapes.features;
      if (!feats?.length || districtsAsked.current.has(id)) continue;
      districtsAsked.current.add(id);
      districtsOf(feats)
        .then((m) => setDistricts((d) => ({ ...d, [id]: m })))
        .catch(() => {
          districtsAsked.current.delete(id);
          setDistricts((d) => ({ ...d, [id]: null }));
        });
    }
  }, [set.districts, loaded]);

  /*
    ХАРАГДАЦ — асаалттай давхарга бүр шүүлтээрээ дамжсан хувилбар.

    Cross-filter-ийн гол дүрэм: диаграм бүр ӨӨРИЙНХӨӨ талбарыг
    алгасч шүүгдэнэ. Эс тэгвээс сонгосон ангилал л үлдэж, бусад нь
    тэг болох тул "юу сонгосон" гэдгээ л харуулна — өөр юу байж
    болохыг харуулахаа болино.

    Диаграмын БҮТЭЦ өөрчлөгдөхгүй, зөвхөн тоонууд дахин тоологдоно
    (`recount`) — эс тэгвээс шүүлт тавих бүрд диаграмууд өөрсдөө
    гарч, алга болж, самбар тогтворгүй болно.
  */
  /*
    ОГНООГООР ШҮҮХ ТЭНХЛЭГҮҮД ({@link LayerSet.dateBar}) — давхарга бүрийн
    огноо агуулсан талбар. Утгын товчтой ({@link LayerSet.pickBar})
    бүрдэлд гарахгүй: тэнд он аль хэдийн товчоор шүүгддэг.
  */
  const dateBars = React.useMemo(() => {
    const out: Record<string, DateAxis[]> = {};
    if (!set.dateBar || set.pickBar) return out;
    for (const id of set.layers) {
      const hit = loaded[id];
      if (!hit) continue;
      const list = dateAxes(hit.info, hit.data);
      if (list.length) out[id] = list;
    }
    return out;
  }, [set.dateBar, set.pickBar, set.layers, loaded]);

  const views = React.useMemo(() => {
    const out: {
      id: string;
      hit: Loaded;
      rows: Row[];
      oids: Set<number>;
      charts: Breakdown[];
      /**
       * Энэ давхарга ШҮҮГДСЭН эсэх — талбарын шүүлт, эсвэл бичлэгийн
       * сонголт. Ойртолтын хүрээг тооцоход хэрэгтэй ({@link focus}).
       */
      narrowed: boolean;
      /** Мөр шүүлтэд нийцэх эсэх; `skip` нь алгасах шүүлтийн түлхүүрүүд */
      passes: (row: Row, skip?: readonly string[]) => boolean;
      /** Зөвхөн талбарын шүүлт ба хил — бичлэгийн сонголтыг үл тооно */
      listPasses: (row: Row) => boolean;
      /** Шүүлтийн СУУРЬ мөрүүд — хилээс гадуурхгүй ({@link LayerSet.withinUB}) */
      inside: Row[];
    }[] = [];

    /*
      ⚠⚠ ЗӨВХӨН ЗУРАГТ ГАРАХ ДАВХАРГЫН БИЧЛЭГ ШҮҮЛТ БОЛОХГҮЙ
      ({@link LayerSet.mapOnly}, 2026-09-30). Тэр давхарга нь диаграмын
      шугамд ОРООГҮЙ тул түүний бичлэгийг сонгоход бүх диаграм
      ХООСОН болж, самбар эвдэрсэн мэт харагдаж байв — булгийн цэсэд
      хамгаалалтын бүс дээр дарахад яг ингэдэг байлаа.
      Цонх нь ХЭВЭЭР нээгдэнэ: `active` нь `loaded`-оос уншдаг тул
      шүүлтээс үл хамаарна.
    */
    const pickedLayer = picked == null ? "" : (set.layers[Math.floor(picked / STRIDE)] ?? "");
    const chosen =
      picked != null && set.mapOnly?.includes(pickedLayer) && !set.charts?.[pickedLayer]
        ? null
        : picked;

    for (const id of on) {
      const hit = loaded[id];
      if (!hit) continue;

      const sel = filters[id] ?? {};
      const fields = Object.keys(sel);

      /* Талбар бүрийн "мөр → ангилал" дүрэм. Нэг талбар хэд хэдэн
         диаграмд ордог тул эхнийхийг нь авна — бүгд ижил */
      const keyBy = new Map<string, (row: Row) => string[]>();
      for (const b of hit.charts)
        if (!keyBy.has(filterKey(b))) keyBy.set(filterKey(b), b.keyOf);
      /* Утгын товчны талбар диаграмгүй байж болно ({@link LayerSet.pickBar})
         — мөрийн утгаар шууд шүүнэ */
      const bar = set.pickBar;
      if (bar?.layer === id && !keyBy.has(bar.field))
        keyBy.set(bar.field, (row) => [categoryKey(row[bar.field])]);
      /* Огнооны мөрийн он, сар — диаграм нь нуугдсан байж болно
         ({@link dateAxes}); байгаа бол диаграмын дүрэм эрх мэдэлтэй */
      for (const a of dateBars[id] ?? []) {
        const yk = `${a.field} year`;
        if (!keyBy.has(yk))
          keyBy.set(yk, (row) => {
            const y = a.yearOf(row);
            return y == null ? [] : [String(y)];
          });
        const monthOf = a.monthOf;
        const mk = `${a.field} month`;
        if (monthOf && !keyBy.has(mk))
          keyBy.set(mk, (row) => {
            const m = monthOf(row);
            return m == null ? [] : [String(m)];
          });
      }
      /* Тооцоолсон дүүрэг ({@link DISTRICT_KEY}) — мөрөөс дугаараар нь */
      const dist = districts[id];
      if (dist) {
        const byRow = new Map<Row, string>();
        for (const [oid, row] of Object.entries(hit.data.rows)) {
          const d = dist.get(Number(oid));
          if (d) byRow.set(row, d);
        }
        keyBy.set(DISTRICT_KEY, (row) => {
          const d = byRow.get(row);
          return d ? [d] : [];
        });
      }

      /* Улаанбаатараас гадуурх бүртгэл ({@link LayerSet.withinUB}) */
      const outside = set.withinUB?.includes(id) ? outsideUB(hit) : null;
      const outRows = outside?.size
        ? new Set(
            Object.entries(hit.data.rows)
              .filter(([k]) => outside.has(Number(k)))
              .map(([, r]) => r),
          )
        : null;

      /* ЗӨВХӨН талбарын шүүлт ба хилийн хасалт — бичлэгийн сонголтыг
         үл тоох жагсаалтад (газрын жагсаалт нь сонгогч тул) */
      const fieldPasses = (row: Row, skip: readonly string[] = []) =>
        !outRows?.has(row) &&
        fields.every((f) => {
          if (skip.includes(f)) return true;
          const keys = keyBy.get(f)?.(row);
          /* Дүрэм нь олдохгүй бол шүүхгүй — талбар нь диаграмаас
             алга болсон байж болно (давхарга дахин татагдсан) */
          return keys ? sel[f].some((v) => keys.includes(v)) : true;
        });

      /*
        ⚠⚠ ЗУРАГ ДЭЭРЭЭС СОНГОСОН БИЧЛЭГ нь ШҮҮЛТ БОЛНО (хэрэглэгч,
        2026-09-29: "map дээрээс filter хийхэд ч мөн адил chart нтр
        шүүгдэнэ шүү"). Хөндлөн шүүлт нь ХОЁР ТИЙШЭЭ ажиллана: диаграм
        зургийг шүүдэг шиг зураг ч диаграмыг шүүнэ.

        ⚠⚠ ЭНЭ НЬ 2026-09-29-ний ӨМНӨХ ШИЙДВЭРИЙГ ОРЛОВ. Тэр үед
        "сонголт нь шүүлт БИШ тул диаграмын тоонууд хэвээр үлдэнэ"
        гэж бичигдсэн байсан — хэрэглэгч эсрэгээр шийдэв.
        ⚠ Ингэснээр `solo` (зураг дээр зөвхөн сонгосон дүрсийг
        үлдээх) хэрэггүй болов: шүүлт өөрөө бусдыг хасна. Нэг зүйлийг
        хоёр механизмаар барихаас нэг эх сурвалж дээр.
        ⚠ СОНГОСОН БИЧЛЭГИЙН ДАВХАРГААС БУСАД нь бүхэлдээ хоосон
        болно: нэг бичлэг сонгогдсон үед өөр давхаргын задаргаа
        "сонгосон зүйлийн тухай" юу ч хэлэхгүй.
        ⚠ БУЦАХ: дүрсээ дахин товших, бичлэгийн цонхыг хаах, эсвэл
        диаграмаас шүүлт тавих (`pick` нь сонголтыг цуцалдаг).
      */
      const base = set.layers.indexOf(id) * STRIDE;
      const only =
        chosen != null && chosen >= base && chosen < base + STRIDE
          ? chosen - base
          : null;
      /* Өөр давхаргын бичлэг сонгогдсон бол энэ давхаргаас юу ч
         үлдэхгүй */
      const muted = chosen != null && only == null;
      const onlyRow = only != null ? hit.data.rows[only] : undefined;

      /*
        ⚠⚠ ШҮҮЛТ + СОНГОЛТ НЭГ ДҮРЭМД (2026-10-20, хэрэглэгч: "map
        deerees point songohod busad chartuud shuudehgui bn"). Урьд нь
        `passes` нь ЗӨВХӨН талбарын шүүлтийг шалгадаг байсан тул түүгээр
        өөрөө тоолдог картууд (хөндлөн хүснэгт, дүүргийн зурвас, байршлын
        карт) зураг дээрх сонголтыг ҮЛ ТООДОГ байв. Одоо сонголт, хилийн
        хасалт хоёр энд ороод бүх хэрэглэгчид нэг дор хүрнэ.
      */
      const passes = (row: Row, skip: readonly string[] = []) =>
        !muted &&
        (only == null || row === onlyRow) &&
        fieldPasses(row, skip);

      const rows: Row[] = [];
      const oids = new Set<number>();
      if (!muted)
        for (const [oid, row] of Object.entries(hit.data.rows)) {
          if (outside?.has(Number(oid))) continue;
          if (only != null && Number(oid) !== only) continue;
          if (!passes(row)) continue;
          rows.push(row);
          oids.add(Number(oid));
        }

      let charts = hit.charts;
      /*
        ⚠ СОНГОЛТ нь БҮХ диаграмыг дахин тоолуулна. Талбарын шүүлт нь
        ӨӨРИЙНХӨӨ диаграмыг алгасдаг (эс тэгвээс сонгосон ангилал л
        үлдэж, өөр рүү шилжих арга алга болно) — сонголт харин талбар
        БИШ тул алгасах зүйлгүй: диаграм бүр тэр нэг бичлэгийг харна.
      */
      /* Хилээс гадуурх бүртгэлгүй мөрүүд — шүүлтийн суурь */
      const inside = outside?.size
        ? Object.entries(hit.data.rows)
            .filter(([k]) => !outside.has(Number(k)))
            .map(([, r]) => r)
        : Object.values(hit.data.rows);
      if (muted || only != null) {
        charts = hit.charts.map((b) => ({ ...b, ...b.recount(rows) }));
      } else if (fields.length) {
        /* Талбар бүрийн зүсэлтийг НЭГ удаа бодно — ижил талбартай
           диаграмууд түүнийг хуваалцана */
        const cache = new Map<string, Row[]>();
        const without = (field: string) => {
          const hit2 = cache.get(field);
          if (hit2) return hit2;
          const list = fields.includes(field)
            ? inside.filter((r) => passes(r, [field]))
            : rows;
          cache.set(field, list);
          return list;
        };
        charts = hit.charts.map((b) => ({
          ...b,
          ...b.recount(without(filterKey(b))),
        }));
      } else if (outside?.size) {
        /* Шүүлтгүй ч хилээс гадуурх бүртгэл хасагдсан — тоо нь зурагтай
           ижил байх ёстой ({@link LayerSet.withinUB}) */
        charts = hit.charts.map((b) => ({ ...b, ...b.recount(rows) }));
      }

      out.push({
        id,
        hit,
        rows,
        oids,
        charts,
        narrowed: muted || only != null || fields.length > 0,
        passes,
        listPasses: (row: Row) => fieldPasses(row),
        inside,
      });
    }

    return out;
  }, [
    on,
    loaded,
    filters,
    picked,
    districts,
    set.layers,
    set.mapOnly,
    set.charts,
    set.withinUB,
    set.pickBar,
    dateBars,
  ]);

  /**
   * ХАМГИЙН УРТ ДИАГРАМ ЗҮҮН БАГАНАД (хэрэглэгчийн хүсэлт, 2026-09-21:
   * "зүйлийн чартыг нөгөө талд нь гаргачих").
   *
   * Сэдэв тус бүрд зориулсан цонхонд давхарга сонгох багана байдаггүй
   * тул зүүн тал БҮТНЭЭРЭЭ сул байв — зургийн баруун талд дөрвөн
   * диаграм босоо цуварч, хамгийн сүүлийнх нь (Сонгинохайрханы
   * судалгаан дээр 21 утгатай "Зүйл") гүйлгэхгүйгээр харагддаггүй
   * байлаа.
   *
   * ⚠ Аль диаграм нь болохыг ДАТА ӨӨРӨӨ шийднэ: хамгийн олон
   * мөртэйг нь авна. Бүртгэлд гараар бичвэл давхарга бүрд нэг мөр
   * нэмэх шаардлагатай болох бөгөөд эх сурвалж өөрчлөгдөхөд хуучирна.
   * ⚠ Зөвхөн найм ба түүнээс олон мөртэй үед л хуваана: гурван
   * зүсэмтэй бөгжийг дангаар нь нөгөө талд тавих нь тэр баганыг
   * бараг хоосон үлдээнэ.
   */
  const split = React.useMemo(() => {
    /* ⚠ `tidy` бүрдэлд давхаргын БҮХ задаргаа НЭГ картад нийлдэг
       ({@link AxisCard}) тул хуваах зүйл байхгүй. Хуваавал тэр карт
       хоёр багананд тасарч, хэрэглэгчийн хүссэн нэгтгэл алдагдана. */
    if (picker || !showCharts || set.tidy || set.noCharts) return null;

    const keys = new Set<string>();

    /*
      ⚠⚠ БҮРТГЭЛИЙН ТЭРГҮҮЛЭХ ДИАГРАМ (`LayerSet.lead`, хэрэглэгчийн
      хүсэлт 2026-09-28: "Зөвшөөрлийн төлөв зүүн панел руу хамгийн
      дээр нь байршуул"). Доорх "хамгийн урт нь зүүн тийш" дүрэм нь
      УНШИГДАЦЫН шийдвэр (урт жагсаалт нарийн баганад багтдаггүй)
      болохоос ЧУХЛЫН эрэмбэ биш — хоёр зүсэмтэй "Зөвшөөрлийн төлөв"
      тэр дүрмээр хэзээ ч зүүн тийш гарахгүй атлаа хяналтын гол
      үзүүлэлт нь тэр.
    */
    const lead = set.lead ?? [];
    if (lead.length)
      for (const v of views)
        for (const b of v.charts)
          if (lead.includes(b.field)) keys.add(`${v.id}:${b.id}`);

    let best: {
      id: string;
      chart: string;
      size: number;
      label: string;
    } | null = null;
    let total = 0;
    for (const v of views) {
      for (const b of v.charts) {
        total += 1;
        if (!best || b.values.length > best.size)
          best = {
            id: v.id,
            chart: b.id,
            size: b.values.length,
            label: b.label,
          };
      }
      /*
        ⚠⚠ "Дүрс тус бүрийн талбай" карт ӨРСӨЛДӨХГҮЙ (2026-09-29,
        хэрэглэгч: "энэ чартыг шахаад хязгаарлалтын бүс чартын доор
        оруулъя"). 2026-09-25-нд тэр нь `split`-д орж, хориглолтын
        бүсийн арван найман мөр ЗҮҮН баганад гардаг байсан — улмаас
        давхаргынхаа ТУУЗААС, бүлгийнхээ бусад картаас салж, аль
        бүсийнх болох нь зөвхөн гарчгаасаа уншигддаг байв. Одоо
        гурван бүсийн карт баруун баганад ДАВХАРГЫН ДАРААЛЛААР цувна.
        ⚠ Задаргааны диаграм (`Breakdown`) `split`-д ХЭВЭЭР
        өрсөлдөнө: тэдгээр нь давхаргын дарааллыг үүрдэггүй.
      */
    }
    if (!best || total < 2 || best.size < 8) return keys.size ? keys : null;

    keys.add(`${best.id}:${best.chart}`);

    /*
      ⚠⚠ ЗАСАГ ЗАХИРГААНЫ ШАТУУД ХАМТ ЗӨӨГДӨНӨ (хэрэглэгчийн хүсэлт,
      2026-09-28: "Сум, дүүрэг-ийг зүүн панелийн Баг, хороо-гийн дээр
      байрлуул"). Хамгийн урт диаграм нь хороо байхад дүүрэг нь нөгөө
      баганад үлдэж, нэг тэнхлэгийн хоёр шат дэлгэцийн хоёр талд
      тарж байв.

      ⚠ ЗӨВХӨН ӨРГӨН шатыг авна (`r < rank`): нарийныг нь чирвэл
      баганын урт өсөх ба хамгийн урт диаграм зүүн талд байх гэсэн
      анхны шалтгаан алдагдана.

      ⚠ Дараалал нь `charts`-ынхаа эрэмбийг ДАГАНА — `breakdowns` нь
      оноогоор эрэмбэлдэг бөгөөд өргөн шат нь нарийнаасаа өмнө
      гардаг тул зүүн багана өөрөө "дүүрэг → хороо" болно.
    */
    const rank = adminRank(best.label);
    if (rank != null) {
      const view = views.find((v) => v.id === best.id);
      for (const b of view?.charts ?? []) {
        const r = adminRank(b.label);
        if (r != null && r < rank) keys.add(`${best.id}:${b.id}`);
      }
    }
    return keys;
  }, [picker, showCharts, views, set.lead, set.tidy, set.noCharts]);

  /* Сонгосон УТГА бүрийг тоолно, талбарыг биш: "3 идэвхтэй" гэдэг нь
     гурван утга сонгосныг хэлэх ёстой */
  /*
    ⚠⚠ ИДЭВХТЭЙ ШҮҮЛТИЙН ТОО нь БҮХ төрлийг хамарна (хэрэглэгч,
    2026-09-29: "чартаас шүүсэн бол буцааж reset хийдэг болгоорой").

    Урьд нь зөвхөн ТАЛБАРЫН шүүлт ба оны цуваа тоологддог байв.
    Гэтэл диаграмын мөрөөс бичлэг сонгох нь ч бүх самбарыг шүүдэг
    болсон (`picked`), бүсийн цэс нь давхаргыг хумидаг — тэр хоёр
    тоологдохгүй тул "N идэвхтэй" гарахгүй, улмаас **Цэвэрлэх товч ч
    гарахгүй**: хэрэглэгч буцах замгүй үлддэг байв.
    ⚠ Сонголт нь ганц бичлэг тул НЭГ гэж тоологдоно; бүсийн хумилт
    мөн нэг (хэдэн бүс нуугдсан нь тусдаа тоо биш, нэг л шийдвэр).
  */
  const activeCount = React.useMemo(() => {
    let n = views.reduce(
      (k, v) =>
        k +
        Object.values(filters[v.id] ?? {}).reduce((m, vs) => m + vs.length, 0) +
        (series[v.id]?.length ?? 0),
      0,
    );
    if (picked != null) n += 1;
    if (!picker && !set.exclusive && on.length < set.layers.length) n += 1;
    return n;
  }, [views, filters, series, picked, picker, set.exclusive, set.layers, on]);

  /**
   * Нэг утгыг НЭМЭХ, эсвэл ХАСАХ.
   *
   * `key` нь `null` бол тухайн талбарын шүүлт бүхэлдээ цуцлагдана
   * (товчны "x"). Эс тэгвээс жагсаалтад байвал хасна, байхгүй бол
   * нэмнэ — диаграм ба цэс хоёулаа энэ нэг үйлдлийг дуудна.
   */
  /* Утгын товчны утгууд — ШҮҮГДЭЭГҮЙ мөрөөс, өсөхөөр ({@link LayerSet.pickBar}) */
  const barValues = React.useMemo(() => {
    const bar = set.pickBar;
    const rows = bar ? loaded[bar.layer]?.data.rows : undefined;
    if (!bar || !rows) return [];
    const seen = new Set<string>();
    for (const row of Object.values(rows)) {
      const v = categoryKey(row[bar.field]);
      if (v !== "Бүртгэгдээгүй") seen.add(v);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, "mn"));
  }, [set.pickBar, loaded]);

  /*
    ОГНООГООР ШҮҮХ МӨР ({@link LayerSet.dateBar}; хэрэглэгч 2026-10-22:
    "ontoi datanuud deer deed hsgt n ognoogoor shuuh hsg"). Асаалттай
    давхаргуудын ЭХНИЙ огноотой нь. Онууд нь ШҮҮГДЭЭГҮЙ мөрөөс; жилийн
    диаграм байгаа бол түүний түлхүүр (таван жилийн бүлэг ч байж болно).
  */
  const dateBar = React.useMemo(
    () => dateBarOf(on, dateBars, loaded, dateWant),
    [on, dateBars, loaded, dateWant],
  );

  const pick = React.useCallback(
    (id: string, field: string, key: string | null) => {
      setFilters((f) => {
        const layer = { ...(f[id] ?? {}) };
        const now = layer[field] ?? [];

        if (key == null) delete layer[field];
        else {
          const next = now.includes(key)
            ? now.filter((v) => v !== key)
            : [...now, key];
          if (next.length) layer[field] = next;
          else delete layer[field];
        }

        return Object.keys(layer).length
          ? { ...f, [id]: layer }
          : Object.fromEntries(Object.entries(f).filter(([k]) => k !== id));
      });
      /* Сонгосон бичлэг шүүлтээс гадуур үлдэж болзошгүй */
      setPicked(null);
    },
    [],
  );

  /**
   * ХҮСНЭГТИЙН СОНГОЛТ — сэлгэхийн оронд ТОГТООНО.
   *
   * ⚠⚠ `pick` нь СЭЛГЭДЭГ (олон сонголтын горим) тул хөндлөн
   * хүснэгтэд буруу ажиллаж байв: "А" мөр сонгоотой байхад (А, X)
   * нүдийг дарахад `pick(мөр, "А")` нь А-г ХАСЧ, `pick(багана, "X")`
   * нь X-ийг нэмнэ — хэрэглэгч "А × X" хүсээд зөвхөн "X" авна.
   * ⚠ Хүснэгт нь ХОЁР ТЭНХЛЭГТЭЙ тул нүд нь "энэ хосыг үзүүл" гэсэн
   * НЭГ санаа: хоёуланг нь тогтооно. Аль хэдийн яг тэр хос сонгоотой
   * бол цуцална.
   * ⚠ Мөр, баганын товшилт ч үүгээр явна: `rowSel`/`colSel` нь ганц
   * утга харуулдаг тул олон сонголт зөвшөөрвөл хадгалагдсан утга ба
   * дэлгэц дээр тодорсон утга ЗӨРНӨ. Олон утгаар шүүх нь шүүлтүүрийн
   * мөрийн цэсэнд хэвээр.
   */
  const pickOnly = React.useCallback(
    (id: string, pairs: readonly (readonly [string, string])[]) => {
      setFilters((f) => {
        const layer = { ...(f[id] ?? {}) };
        const same = pairs.every(
          ([k, v]) => (layer[k] ?? []).length === 1 && layer[k][0] === v,
        );
        for (const [k, v] of pairs) {
          if (same) delete layer[k];
          else layer[k] = [v];
        }
        return Object.keys(layer).length
          ? { ...f, [id]: layer }
          : Object.fromEntries(Object.entries(f).filter(([k]) => k !== id));
      });
      /* Сонгосон бичлэг шүүлтээс гадуур үлдэж болзошгүй */
      setPicked(null);
    },
    [],
  );

  /**
   * БҮЛГЭЭР ШҮҮХ — талбарын шүүлтийг яг `keys` болгоно; аль хэдийн яг
   * тэр бүрдэл бол цуцална ({@link ShareGroups}-ийн бүлгийн толгой).
   */
  const pickSet = React.useCallback(
    (id: string, field: string, keys: readonly string[]) => {
      setFilters((f) => {
        const layer = { ...(f[id] ?? {}) };
        const now = layer[field] ?? [];
        const same =
          now.length === keys.length && keys.every((k) => now.includes(k));
        if (same || !keys.length) delete layer[field];
        else layer[field] = [...keys];
        return Object.keys(layer).length
          ? { ...f, [id]: layer }
          : Object.fromEntries(Object.entries(f).filter(([k]) => k !== id));
      });
      setPicked(null);
    },
    [],
  );

  /**
   * ДҮҮРГИЙН МӨРҮҮД ({@link ShareGroups}-ийн "Дүүргээр"). Дүүргийн
   * шүүлтээс БУСАД шүүлт үйлчилнэ — өөр дүүрэг рүү шилжих боломж үлдэнэ.
   * Бүлэг нь {@link LayerSet.valueGroups}; бүлэгт ороогүй ангилал "Бусад".
   */
  const districtRows = (
    id: string,
    hit: Loaded,
    b: Breakdown,
    passes: (row: Row, skip?: readonly string[]) => boolean,
    colorOf: (key: string) => string,
  ) => {
    const dist = districts[id];
    if (dist === undefined) return "loading" as const;
    if (dist === null) return "failed" as const;
    /* Бүлэггүй давхаргад ангилал бүр ӨӨРИЙН хэсэг (хэсэглэл: ДЦГ ·
       бүртгэгдээгүй) */
    const defs =
      set.valueGroups?.[id] ??
      b.values.map((v) => ({ label: v.label, keys: [v.key] }));
    const area = b.notes;
    const parts = defs.map((g) => {
      const lead = [...g.keys].sort(
        (x, y) => (area?.get(y) ?? 0) - (area?.get(x) ?? 0),
      )[0];
      return { label: g.label, color: colorOf(lead), keys: [...g.keys] };
    });
    const gi = new Map<string, number>();
    defs.forEach((g, i) => g.keys.forEach((k) => gi.set(k, i)));
    const k = hit.info.areaInHa ? 1 : 1 / 10000;
    const by = new Map<string, { ha: number; parts: number[] }>();
    let loose = false;
    for (const [oid, row] of Object.entries(hit.data.rows)) {
      if (!passes(row, [DISTRICT_KEY])) continue;
      const name = dist.get(Number(oid)) ?? "Тодорхойгүй";
      const v = (hit.data.area[Number(oid)] ?? 0) * k;
      const key = b.keyOf(row)[0];
      let i = key == null ? undefined : gi.get(key);
      if (i == null) {
        i = defs.length;
        loose = true;
      }
      const e = by.get(name) ?? { ha: 0, parts: [] as number[] };
      e.ha += v;
      e.parts[i] = (e.parts[i] ?? 0) + v;
      by.set(name, e);
    }
    if (loose) parts.push({ label: "Бусад", color: "#8a96a3", keys: [] });
    return {
      rows: [...by]
        .map(([name, e]) => ({
          name,
          ha: e.ha,
          parts: parts.map((_, i) => e.parts[i] ?? 0),
        }))
        .sort((x, y) => y.ha - x.ha),
      parts,
    };
  };

  /** Нэг оныг нэмэх, хасах — талбарын шүүлттэй ижил зан төлөв */
  const pickYear = React.useCallback((id: string, key: string | null) => {
    setSeries((v) => {
      const now = v[id] ?? [];
      const next =
        key == null
          ? []
          : now.includes(key)
            ? now.filter((x) => x !== key)
            : [...now, key];
      return next.length
        ? { ...v, [id]: next }
        : Object.fromEntries(Object.entries(v).filter(([k]) => k !== id));
    });
  }, []);

  /*
    ⚠⚠ ГАНЦ ӨНГИЙН ЦЭГЭН ДАВХАРГА ({@link LayerSet.plain}) — ДИАГРАМ
    ЗУРАГТАЙ НЭГ ӨНГӨ (хэрэглэгч, 2026-10-07: "map chart 2-ын өнгө
    адилхан байя"). Зураг дээр цэг, бөөгнөрөл нь firefly цэнхэрээр
    (`FIREFLY`) зурагддаг тул давхаргын ногоон тон нь диаграмд л гарч,
    хоёр өөр өнгөөр нэг датаг харуулж байв. Олон өнцөгт, ангиллын
    өнгөтэй давхарга ХӨНДӨГДӨХГҮЙ.
  */
  const toneOf = React.useCallback(
    (id: string) =>
      set.plain?.includes(id) && loaded[id]?.info.geometry === "Point"
        ? FIREFLY.mid
        : toneOfHue(set.hues[set.layers.indexOf(id) % set.hues.length], set.toneL, set.toneC),
    [set, loaded],
  );
  const uidBase = React.useCallback(
    (id: string) => set.layers.indexOf(id) * STRIDE,
    [set],
  );
  const hueOf = React.useCallback(
    (id: string) => set.hues[set.layers.indexOf(id) % set.hues.length],
    [set],
  );

  /*
    Давхарга олон ТӨРӨЛ агуулж болно (ойн ялгарал, хэсэглэл, дагалт
    баялаг …) тул ганц өнгөөр зурвал зургаас зөвхөн "хаана" гэдэг
    уншигдаж, "юу" гэдэг алдагдана. Тиймээс давхарга бүр өөрийн эхний
    задаргааг АНХНААСАА өнгөний эх болгоно.

    Ангилал хэт олон бол өнгө ялгагдахаа болих тул тэр үед ганц өнгөнд
    үлдэнэ — хэрэглэгч гараар өөр талбар сонгож болно.
  */
  /* Шошго асах ойртолт — бүртгэлийн харьцаа ({@link LayerSet.labelScale}) */
  const labelZoom = set.labelScale ? zoomForScale(set.labelScale) : LABEL_ZOOM;

  const colorField = React.useCallback(
    (id: string): string | null => {
      if (id in colorBy) return colorBy[id];
      if (environment) return null;
      /* Бүртгэл нь ангиллын өнгийг хаасан давхарга ({@link
         LayerSet.plain}) — ганц тонгоор зурагдаж, таних тэмдэгт НЭГ
         мөр болно */
      if (set.plain?.includes(id)) return null;
      /* Бүртгэлийн заасан талбар ({@link LayerSet.colorFields}) — тооллын
         диаграмтай үед л (палитрын дараалал түүнээс гардаг) */
      /* Талбарын НЭР эсвэл харагдах НЭРЭЭР (alias) — бүртгэл нь эх
         сурвалжийн латин нэрийг мэдэхгүй байж болно (намгархаг газрын
         "Ангилал", 2026-10-07) */
      const wanted = set.colorFields?.[id];
      const hit = wanted
        ? loaded[id]?.charts.find(
            (c) =>
              c.kind === "count" &&
              !c.multi &&
              (c.field === wanted ||
                c.label.toLocaleLowerCase("mn") ===
                  wanted.toLocaleLowerCase("mn")),
          )
        : undefined;
      if (hit) return hit.field;
      /* Олон утгатай задаргаа өнгө жолоодохгүй: нэг дүрс хоёр
         ангилалд харьяалагдвал аль өнгийг нь өгөх вэ гэдэг хариултгүй */
      const first = loaded[id]?.charts.find(
        (c) => c.kind === "count" && !c.multi,
      );
      return first && first.values.length <= MAX_COLOR_VALUES
        ? first.field
        : null;
    },
    [colorBy, loaded, environment, set.plain, set.colorFields],
  );

  /**
   * Давхарга бүрийн ангилал → өнгө.
   *
   * Диаграм ба газрын зураг ХОЁУЛАА эндээс уншина: диаграм нь зургийн
   * тайлбарын үүрэг гүйцэтгэх ёстой тул хоёр эх сурвалж байж БОЛОХГҮЙ.
   * Дараалал нь задаргаанаас ирнэ (тоо буурахаар) — хамгийн түгээмэл
   * ангилал хамгийн цайвар өнгөтэй болж, зураг дээр давамгайлна.
   */
  const palettes = React.useMemo(() => {
    /*
      ⚠⚠ ӨНГӨ ба ТҮЛХҮҮРИЙН ДҮРЭМ ХАМТ явна (2026-09-30, хэрэглэгч
      зургаар: "өнгө ялгарч танигдахгүй бн").

      Урьд нь зураг нь ангиллын түлхүүрээ `categoryKey(row[field])`
      гэж ӨӨРӨӨ бодож байв — тэр нь диаграмын дүрмийн ГУРАВ ДАХЬ
      хуулбар байсан бөгөөд ТООН талбар дээр зөрдөг: `categoryKey` нь
      зөвхөн БИЧВЭР уншдаг тул `50` гэсэн тоо "Бүртгэгдээгүй" болж,
      палитраас юу ч олдохгүй → бүх дүрс давхаргынхаа ганц тонд
      буудаг. Булгийн хоёр бүс яг ингэж ИЖИЛ өнгөтэй болж байлаа.
      ⚠ Одоо задаргааны ӨӨРИЙН `keyOf` хэрэглэнэ — диаграм, шүүлт,
      зургийн өнгө ГУРВУУЛАА нэг дүрмээс ({@link Breakdown.keyOf}).
    */
    const out: Record<
      string,
      { colors: Map<string, string>; keyOf: (row: Row) => string[] }
    > = {};
    for (const id of on) {
      const hit = loaded[id];
      const field = colorField(id);
      if (!hit || !field) continue;
      /* Дараалал нь ЗААВАЛ тооллын диаграмынх: нэг талбар хэд хэдэн
         диаграм төрүүлдэг бөгөөд тэдгээр нь өөр өөрөөр эрэмбэлэгддэг тул
         аль нь тааралдсанаар нь авбал ижил ангилал диаграм болгон дээр
         өөр өнгөтэй болно */
      const b = hit.charts.find((c) => c.field === field && c.kind === "count");
      if (!b) continue;
      /* Өнцгөөр тараах муж байвал гэрэлтэлтийн шатлалыг орлоно
         ({@link LayerSet.hueSpan}) */
      const span = set.hueSpan?.[id];
      const n = b.values.length;
      const ramp = span
        ? b.values.map((_, i) =>
            toneOfHue(
              n < 2 ? span[0] : span[0] + ((span[1] - span[0]) * i) / (n - 1),
            ),
          )
        : categoryRamp(hueOf(id), n);
      /* Бүртгэлээр заасан өнцөг ({@link LayerSet.valueHues}) шатлалыг
         дарна — гэрэлтэлт, ханалт нь давхаргынхтай адил хэвээр */
      const fixed = set.valueHues?.[id];
      /* Бүтэн өнгө ({@link LayerSet.valueColors}) — өнцөг, шатлал
         хоёуланг дарна; дохионы утгатай (хийгдсэн · анхаарах) ангилалд */
      const exact = set.valueColors?.[id];
      /* Бүтэн OKLCH ({@link LayerSet.valueTones}) өнцгөөс ч давуу */
      const tones = set.valueTones?.[id];
      /* Тод ялгаатай палитр ({@link LayerSet.categorical}) — дугаар нь
         "Бүртгэгдээгүй"-г алгасна, эс тэгвээс нэг өнгө үрэгдэнэ */
      const vivid = set.categorical?.includes(id);
      let slot = 0;
      out[id] = {
        keyOf: b.keyOf,
        colors: new Map(
          b.values.map((v, i) => {
            const hex = exact?.[v.key];
            if (hex) return [v.key, hex];
            if (vivid)
              return [
                v.key,
                categoryHex(v.key, v.key === "Бүртгэгдээгүй" ? -1 : slot++),
              ];
            const tone = tones?.[v.key];
            if (tone) return [v.key, oklchHex(tone[0], tone[1], tone[2])];
            const hue = fixed?.[v.key];
            return [v.key, hue == null ? ramp[i] : toneOfHue(hue)];
          }),
        ),
      };
    }
    return out;
  }, [
    on,
    loaded,
    colorField,
    hueOf,
    set.valueHues,
    set.valueTones,
    set.valueColors,
    set.hueSpan,
    set.categorical,
  ]);

  /*
    Асаалттай давхаргуудыг НЭГ цуглуулгад нийлүүлнэ.

    Геометрийн төрлөөр хуваана: олон өнцөгт ба шугам нь `shapes`-д,
    цэг нь `points`-д — газрын зургийн дүүргэлтийн давхарга зөвхөн олон
    өнцөгт зурдаг, цэгийн давхарга нь тусдаа эх сурвалжтай.
  */
  /*
    ⚠ Зураг дээр сонгосон дүрс ГАНЦААРАА үлдэх нь одоо ШҮҮЛТЭЭР
    хийгдэнэ ({@link views}) — урьд нь `solo` гэсэн тусдаа механизм
    байсныг хассан: нэг зүйлийг хоёр газар барихаас нэг эх сурвалж
    дээр.
  */
  /*
    ТОД ЖИЖИГ ЦЭГ ({@link LayerSet.dots}) — ангиллын дарааллыг зургийн
    өнгө (hex) рүү хөрвүүлнэ: зураг нь цэгийн өнгөөр л эрэмбэлж чадна.
    Тохиргоо нь ЗУРАГ ҮҮСЭХ мөчид уншигддаг тул палитр ирээгүй байхад
    ч горим нь асна (дараалал нь хоосон байж болно).
  */
  const dots = React.useMemo(() => {
    if (!set.dots) return undefined;
    const rank: Record<string, number> = {};
    for (const [id, order] of Object.entries(set.dots)) {
      const colors = palettes[id]?.colors;
      if (!colors) continue;
      for (const [k, r] of Object.entries(order)) {
        const hex = colors.get(k);
        if (hex) rank[hex] = r;
      }
    }
    return { rank };
  }, [set.dots, palettes]);

  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const { id, hit, oids } of views) {
      if (hit.info.geometry === "Point") continue;
      const base = uidBase(id);
      const flat = toneOf(id);
      const palette = palettes[id];
      for (const f of hit.data.shapes.features) {
        /* Шүүлтээс гарсан дүрс ЗУРАГДАХГҮЙ — диаграм ба зураг нэг
           зүйлийг харуулах ёстой */
        if (!oids.has(Number(f.id))) continue;
        const uid = base + Number(f.id);
        /* Ангиллын өнгө олдохгүй бол давхаргынхаа өнгөнд буцна —
           зурагдахгүй үлдэх нь бичлэг байхгүй мэт худал хэлнэ */
        const row = hit.data.rows[Number(f.id)];
        const c =
          palette && row
            ? (palette.colors.get(palette.keyOf(row)[0] ?? "") ?? flat)
            : flat;
        /* Хоосон шошгыг ОГТ бичихгүй — давхаргын `has t` шүүлт үүнд
           тулгуурладаг тул хоосон мөр ч шошго болж зурагдана */
        const t = labelFor(hit, Number(f.id));
        features.push({
          ...f,
          id: uid,
          properties: t ? { oid: uid, c, t } : { oid: uid, c },
        });
      }
    }
    /* ТОМ нь эхлээд — жижиг нь ДЭЭР нь ({@link shapeSpan}) */
    features.sort((a, b) => shapeSpan(b) - shapeSpan(a));
    return { type: "FeatureCollection", features };
  }, [views, toneOf, uidBase, palettes]);

  const points = React.useMemo<{
    at: MapPoints;
    text: string[];
    colors: (string | undefined)[] | null;
  }>(() => {
    const oid: number[] = [];
    const lon: number[] = [];
    const lat: number[] = [];
    const text: string[] = [];
    /*
      ⚠⚠ ЦЭГ ТАНИХ ТЭМДГИЙН ӨНГӨӨР (хэрэглэгч, 2026-10-07, намгархаг
      газрын зургаар: "сайжруулъя"). Олон өнцөгт палитраа (`palettes`)
      авдаг байсан ч цэгт өнгө ДАМЖДАГГҮЙ байв: таних тэмдэг "Өнгөөр
      ялгасан үзүүлэлт: Дүүрэг" гэж таван өнгө жагсаагаад, зураг дээр
      бүх цэг анхдагч цэнхэр гэрэлтэлтээр гарч байлаа — тэмдэг худал.
      Одоо `WellsMap`-ийн `colors` (цэг бүрийн hex) — олон өнцөгттэй
      НЭГ эх сурвалж, НЭГ түлхүүрийн дүрэм (`keyOf`).
      ⚠ Палитргүй бол `null` — цэг анхдагч гэрэлтэлтээрээ үлдэнэ.
    */
    const colors: (string | undefined)[] = [];
    let tinted = false;
    for (const { id, hit, oids } of views) {
      if (hit.info.geometry !== "Point") continue;
      const base = uidBase(id);
      const palette = palettes[id];
      for (const f of hit.data.shapes.features) {
        if (f.geometry?.type !== "Point") continue;
        if (!oids.has(Number(f.id))) continue;
        const [x, y] = f.geometry.coordinates as [number, number];
        oid.push(base + Number(f.id));
        lon.push(x);
        lat.push(y);
        text.push(labelFor(hit, Number(f.id)));
        const row = hit.data.rows[Number(f.id)];
        const c =
          palette && row
            ? palette.colors.get(palette.keyOf(row)[0] ?? "")
            : undefined;
        if (c) tinted = true;
        colors.push(c);
      }
    }
    return { at: { oid, lon, lat }, text, colors: tinted ? colors : null };
  }, [views, uidBase, palettes]);

  const visible = React.useMemo(
    () => Uint32Array.from(points.at.oid, (_, i) => i),
    [points],
  );

  /*
    ХООСОН ЗУРАГ ЮУ ГЭСЭН ҮГ ВЭ.

    Давхарга нь атрибут, геометр ГЭСЭН ХОЁР ҮЕ ШАТААР ирдэг тул
    "бичлэг бий, дүрс алга" гэсэн завсрын төлөв үүснэ. Сэдэв тус бүрд
    зориулсан цонхонд давхаргын жагсаалт байдаггүй тул тэр төлөв
    хаана ч бичигдэхгүй — хэрэглэгч суурь зураг хараад давхарга огт
    байхгүй мэт ойлгоно.

    ⚠ Шүүлтээр бүх мөр хасагдсан тохиолдлыг ОРОЛЦУУЛАХГҮЙ
    (`rows.length`): тэнд хоосон зураг нь зөв хариулт.
  */
  const shapesWaiting = React.useMemo(
    () =>
      views.filter(
        (v) =>
          v.hit.info.geometry !== "Point" &&
          v.rows.length > 0 &&
          v.hit.data.shapes.features.length === 0,
      ),
    [views],
  );
  const mapNote = !shapesWaiting.length
    ? null
    : shapesWaiting.some((v) => busy[v.id])
      ? "Дүрсийн хүрээг ачаалж байна."
      : "Дүрсийн хүрээ ирсэнгүй.";

  /*
    ШҮҮЛТИЙН ҮР ДҮН РҮҮ ОЙРТОНО (хэрэглэгч, 2026-09-29: "чартын filter
    map дээр zoom in хийдэг болгоорой").

    Урьд нь хүрээ нь БҮХ дүрсээс тоологддог байсан тул диаграмаас
    шүүхэд зураг дээр цөөн дүрс үлдэх ч ойртолт нь хэвээр: сонгосон
    зүйл нь өргөн хүрээний дунд жижигхэн толбо болж үлддэг байв.
    Одоо хүрээ нь ШҮҮГДСЭН дүрсээс гарна — шүүлт тавих бүрд зураг
    үлдсэн хэсэг рүүгээ нисч ойртоно, шүүлт цуцлахад буцна.

    ⚠ Зан төлөв нь шилэн барилга, биотехникийн самбартай НЭГ: "шүүлт
    тавьвал үлдсэн бүхнийг багтаана".
    ⚠ Шүүлтгүй үед энэ нь БҮХ дүрсийн хүрээ буюу өмнөхтэйгээ ЯГ ИЖИЛ.
    ⚠ БИЧЛЭГ СОНГОХОД энд хөндөгдөхгүй: `pick` нь сонголтыг цуцалдаг
    тул хоёр ойртолт хэзээ ч зөрчилдөхгүй; диаграмын мөрөөс сонгосон
    дүрс рүү ойртохыг `rowFocus` тусад нь хийнэ.
    ⚠ Шүүлтэд нэг ч дүрс нийцэхгүй бол `null` — зураг анхны хүрээндээ
    үлдэнэ, "хаашаа ч юм нисэх" нь буруу.
  */
  const focus = React.useMemo<Extent | null>(() => {
    if (!views.length) return null;
    /*
      ⚠⚠ ШҮҮГДЭЭГҮЙ ДАВХАРГА ХҮРЭЭНД ОРОХГҮЙ (2026-09-30, хэрэглэгч:
      "zoom in хийхгүй бн").

      Булгийн цэсэд хамгаалалтын бүс нь `mapOnly` тул ямар ч шүүлтэд
      хумигддаггүй — 495 бүс нь хотыг бүхэлд нь хамардаг учраас
      булгийг шүүсэн ч ХҮРЭЭ ХЭВЭЭР үлдэж, зураг хөдөлдөггүй байв.
      Шүүлт тавьсны дараа "үлдсэн бүхэн" гэдэг нь ХУМИГДСАН давхаргын
      дүрсүүд — хумигдаагүй нь тэр асуултад хариулах зүйлгүй.
      ⚠ Шүүлтгүй үед БҮГД орно: анхны харагдац бүх давхаргыг багтаана.
    */
    const cut = views.some((v) => v.narrowed);
    /* Масштаб заагдсан бүрдэлд ({@link LayerSet.scale}) шүүлтгүй үед
       хүрээнд тааруулахгүй — зураг тэр масштабдаа үлдэнэ */
    if (set.scale && !cut) return null;
    const b = new Bounds();
    for (const { hit, oids, narrowed } of views) {
      if (cut && !narrowed) continue;
      for (const f of hit.data.shapes.features)
        if (oids.has(Number(f.id))) b.addGeometry(f.geometry);
    }
    return b.get(0.004);
  }, [views, set.scale]);

  /*
    ДИАГРАМЫН МӨРӨӨС ДҮРС СОНГОХ (2026-09-29, хэрэглэгч: "чартуудыг
    сайжруулж чадах уу").

    "Талбай, га — дүрс тус бүрээр" диаграмын мөр бүр нь АНГИЛАЛ биш
    БИЧЛЭГ: түлхүүр нь бодит `objectid` (`areaRowsOf`). Гэтэл мөр нь
    товшигддоггүй байсан тул "хамгийн том дүрс аль нь вэ" гэдгийг
    уншиж мэдээд түүнийг зураг дээрээс ОЛОХ арга байхгүй — арван
    найман дүрсийг нэг бүрчлэн товшиж хайхаас өөр зам үлддэггүй байв.
    Одоо мөр товшиход тэр дүрс газрын зураг дээр тодорч, бичлэгийн
    цонх нь нээгдэнэ — зурган дээр товшсонтой ЯГ ИЖИЛ үр дүн.

    ⚠⚠ Энэ нь задаргааны диаграмын товшилтоос ӨӨР УТГАТАЙ: тэнд мөр
    нь ШҮҮЛТ (ангиллаар хумина), энд СОНГОЛТ (нэг бичлэг). Мөр нь
    ангилал биш бичлэг тул шүүх утгагүй — өөрийгөө л үлдээнэ.
    ⚠ `picked` нь UID (`давхаргын индекс × STRIDE + oid`) тул мөрийн
    түүхий `oid`-г `uidBase`-ээр нэрийн орон зайд оруулна.
    ⚠⚠ ЗУРАГ СОНГОСОН ДҮРС РҮҮ ОЙРТОНО (`rowFocus`). Үүнгүй бол
    хэрэглэгч ойртсон байхад сонгосон дүрс дэлгэцийн ГАДНА байж
    болох ба товшилт нь юу ч хийгээгүй мэт харагдана (шилэн
    барилгын самбарт яг энэ шалтгаанаар `focus` нэмэгдсэн).
    ⚠ ЗӨВХӨН диаграмаас сонгоход: зураг дээр товшсон дүрс нь аль
    хэдийн харагдаж байгаа тул түүн рүү ойртуулах нь хэрэглэгчийн
    харагдацыг шалтгаангүй өөрчилнө.
  */
  const [rowPick, setRowPick] = React.useState<number | null>(null);
  const rowFocus = React.useMemo<Extent | null>(() => {
    if (rowPick == null || rowPick !== picked) return null;
    const index = Math.floor(rowPick / STRIDE);
    const hit = loaded[set.layers[index] ?? ""];
    /*
      ⚠⚠ ДҮРСИЙН `id` нь ТҮҮХИЙ `objectid`, UID БИШ ({@link
      loadLayerShapes}) — тиймээс `rowPick`-ээс давхаргын суурийг
      ХАСНА. Урьд нь UID-тай шууд харьцуулдаг байсан тул ЭХНИЙ
      давхаргад л ажиллаж (тэнд суурь нь тэг), хоёр дахиас хойш
      ХЭЗЭЭ Ч таардаггүй байв: булгийн цэсэд цэгэн давхарга
      индекс 1 тул диаграмын мөрөөс сонгоход зураг ойртдоггүй байлаа.
    */
    const oid = rowPick - index * STRIDE;
    const f = hit?.data.shapes.features.find((x) => Number(x.id) === oid);
    if (!f) return null;
    const b = new Bounds();
    b.addGeometry(f.geometry);
    return b.get(0.004);
  }, [rowPick, picked, loaded, set.layers]);

  /** Товшсон, эсвэл хулганы доорх обьектын давхарга ба бичлэг */
  const lookup = React.useCallback(
    (uid: number | null) => {
      if (uid == null) return null;
      const index = Math.floor(uid / STRIDE);
      const id = set.layers[index];
      const hit = id ? loaded[id] : undefined;
      if (!id || !hit) return null;
      const row = hit.data.rows[uid - index * STRIDE];
      return row ? { id, hit, info: hit.info, row } : null;
    },
    [loaded, set.layers],
  );

  const hovered = React.useMemo(() => lookup(tip.oid), [lookup, tip.oid]);
  const active = React.useMemo(() => lookup(picked), [lookup, picked]);

  /*
    ИДЭВХТЭЙ ШҮҮЛТИЙН ШОШГО ({@link FilterChip}, хэрэглэгч, 2026-10-07:
    "шүүлтүүрийг хүнд ойлгомжтой, ажилладаг хялбар болгоорой").
    Таван эх үүсвэр — бүгд НЭГ мөрөнд, нэрээрээ:
    1. талбарын шүүлт (диаграм, хөндлөн хүснэгт, сав газрын мөр) —
       "<тэнхлэгийн нэр>: <утгын нэр>", утга тус бүр тусдаа шошго;
    2. цуваа (он) — "Он: 2024";
    3. сонгосон дүрс (зураг, бүсийн мөр) — нэр нь цонх, шошготой НЭГ
       дүрэм (нэр → ангилал · № → №);
    4. нуусан бүс (бүсийн цэс) — үлдсэн бүсүүдийн нэр;
    5. нэгж талбарын ангилал (`ParcelCard`) — урьд нь тоололд ч
       ордоггүй байв.
    ⚠ ✕ нь ЗӨВХӨН тэр шүүлтийг авна — бусад нь хэвээр.
    ⚠ Нэр нь шүүгдээгүй диаграмаас (`hit.charts`) — шүүлтээр мөр нь
    алга болсон ч шошго утгаа нэрлэсээр байна.
  */
  const filterChips = React.useMemo(() => {
    const out: FilterChip[] = [];
    for (const id of set.layers) {
      const hit = loaded[id];
      if (!hit) continue;
      for (const [field, keys] of Object.entries(filters[id] ?? {})) {
        const b = hit.charts.find((c) => filterKey(c) === field);
        /* Диаграмгүй огнооны түлхүүр ({@link dateBars}) — нэр нь талбарынх */
        const [base, kind] = field.split("\u0000");
        const axis = (dateBars[id] ?? []).find((a) => a.field === base);
        for (const k of keys)
          out.push({
            key: `f:${id}:${field}:${k}`,
            label: b?.label ?? axis?.label ?? field,
            value:
              b?.values.find((d) => d.key === k)?.label ??
              (axis && kind === "month" ? `${k}-р сар` : k),
            onRemove: () => pick(id, field, k),
          });
      }
      for (const k of series[id] ?? [])
        out.push({
          key: `s:${id}:${k}`,
          label: /^\d{4}/.test(k) ? "Он" : "Цуваа",
          value: k,
          onRemove: () =>
            setSeries((v) => {
              const next = (v[id] ?? []).filter((x) => x !== k);
              return next.length
                ? { ...v, [id]: next }
                : Object.fromEntries(
                    Object.entries(v).filter(([x]) => x !== id),
                  );
            }),
        });
    }
    if (active) {
      const oid = (picked ?? 0) - uidBase(active.id);
      const name = active.hit.labels.name
        ? categoryKey(active.row[active.hit.labels.name])
        : "Бүртгэгдээгүй";
      const group = leadGroup(active.hit);
      const tag = group ? categoryKey(active.row[group]) : "Бүртгэгдээгүй";
      out.push({
        key: "picked",
        label: "Сонгосон",
        value:
          name !== "Бүртгэгдээгүй"
            ? name
            : tag !== "Бүртгэгдээгүй"
              ? `${tag} · № ${oid}`
              : `№ ${oid}`,
        onRemove: () => {
          setPicked(null);
          setRowPick(null);
        },
      });
    }
    if (!picker && !set.exclusive && on.length < set.layers.length)
      out.push({
        key: "layers",
        label: set.layerLabel ?? "Давхарга",
        value: on.map((id) => layerName(set, id, infos[id]?.name)).join(", "),
        onRemove: () => setOn([...set.layers]),
      });
    if (parcelPick)
      out.push({
        key: "parcel",
        label: "Нэгж талбар",
        value: parcelPick.label,
        onRemove: () => setParcelPick(null),
      });
    return out;
  }, [
    set,
    loaded,
    filters,
    series,
    active,
    picked,
    uidBase,
    pick,
    picker,
    on,
    infos,
    parcelPick,
    dateBars,
  ]);

  /*
    ДАВХАРГУУДЫН ТАЛБАЙН ХАРЬЦУУЛАЛТ (хэрэглэгч, 2026-09-25:
    "3 бүсийг өөр өөр өнгөөр тгд талбайг нь харуулах chart").

    Хуваалцсан хөдөлгүүр нь диаграмаа ДАВХАРГА ТУС БҮРИЙН дотроос
    гаргадаг тул "энэ гурван бүс хэр том бэ" гэсэн асуулт хаана ч
    хариулагддаггүй байв — хамгаалалтын гурван шат (тэжээгдэл,
    хязгаарлалт, хориглолт) нь бараг атрибутгүй, зөвхөн дугаар ба
    талбайтай тул баруун багана нь бүхэлдээ хоосон үлддэг байлаа.

    ⚠ Мөрийн ӨНГӨ нь давхаргынхаа өнгө (`toneOf`) — зурагтай НЭГ эх
    сурвалжаас тул диаграм нь зургийн ТАЙЛБАР болно: аль өнгө аль
    бүс болохыг энд уншина.
    ⚠ Зөвхөн ХОЁР ба түүнээс олон давхарга талбайтай үед гарна: нэг
    давхаргын талбай нь үзүүлэлтийн зурваст аль хэдийн бий бөгөөд
    ганц зурвасыг өөртэй нь харьцуулах зүйл байхгүй.
    ⚠ Талбай нь ШҮҮГДСЭН дүрсээс тоологдоно — үзүүлэлттэй зөрөх
    ёсгүй.
  */
  /*
    ДҮРСИЙН БАЙРШЛЫН НЭР ({@link LayerSet.placeNames}) — нэрийн багана
    огт байхгүй давхаргад "№ 1"-ийн оронд тэр дүрс аль сум, дүүрэгт
    оршихыг засаг захиргааны хилээс тооцно ({@link placeNamesOf}).
    ⚠ Давхарга бүрд НЭГ л удаа (`placesAsked`) — геометр нь шүүлтээс үл
    хамаарна. Унавал дугаараараа үлдэнэ (нэмэлт мэдээлэл).
  */
  const [places, setPlaces] = React.useState<
    Record<string, Map<number, string>>
  >({});
  const placesAsked = React.useRef(new Set<string>());
  React.useEffect(() => {
    for (const id of set.placeNames ?? []) {
      const feats = loaded[id]?.data.shapes.features;
      if (!feats?.length || placesAsked.current.has(id)) continue;
      placesAsked.current.add(id);
      placeNamesOf(feats)
        .then((m) => setPlaces((p) => ({ ...p, [id]: m })))
        .catch(() => placesAsked.current.delete(id));
    }
  }, [set.placeNames, loaded]);


  const areaRowsOf = React.useCallback(
    (hit: Loaded, oids: Set<number>, plain = false): Datum[] => {
      const place = places[hit.info.id];
      const out: Datum[] = [];
      /* Тэргүүлэх тооллын задаргаа — нэргүй дүрсийг түүгээр тодорхойлно
         (доор). `plain` үед (ангиллаараа хуваасан бүсийн дотор) ангилал
         нь толгойд аль хэдийн бичигдсэн тул давтахгүй */
      const group = plain ? undefined : leadGroup(hit);
      for (const oid of oids) {
        const raw = hit.data.area[oid];
        if (!raw) continue;
        /* Эх сурвалж гектараар бичсэн бол хөрвүүлэхгүй — `SHAPE__Area`
           үед л м² → га ({@link LayerInfo.areaInHa}) */
        const ha = hit.info.areaInHa ? raw : raw / 10000;
        /* Нэр нь газрын зургийн шошготой НЭГ эх сурвалжаас
           (`labels.name`). Нэрийн багана байхгүй давхаргад (хориглолтын
           бүс — зөвхөн дугаар ба талбай) бичлэгийн дугаараар нэрлэнэ:
           тэр нь зураг дээр товшиход сонгогддог ЯГ тэр дугаар тул
           зохиомол нэр БИШ, бодит танигч */
        const name = hit.labels.name
          ? categoryKey(hit.data.rows[oid]?.[hit.labels.name])
          : "";
        /*
          ⚠ НЭРГҮЙ ДҮРСИЙГ АНГИЛЛААР НЬ ТОДОРХОЙЛНО (хэрэглэгч,
          2026-10-06, голын татмын зургаар: "засъя"). Голын татмын 37
          дүрс бүгд "№ 30", "№ 37" гэж гарч, аль сав газрынх болох нь
          жагсаалтаас уншигдахгүй байв. Давхаргын ТЭРГҮҮЛЭХ тооллын
          задаргаа (`group`) байвал түүний утгыг дугаарын өмнө бичнэ:
          "Туул · № 30". Дугаар нь танигч хэвээр, ангилал нь эх
          сурвалжийн утга — зохиомол зүйл нэмэгдээгүй.
        */
        const tag = group
          ? categoryKey(hit.data.rows[oid]?.[group])
          : "Бүртгэгдээгүй";
        /* Ангилалгүй бол байршлын нэр ({@link LayerSet.placeNames}) —
           дугаар нь танигч болж хэвээр */
        /* Байршлын нэр ганцаараа (хэрэглэгч, 2026-10-07: "нэрийг нь
           богиносго") — давхаргын ӨӨР дүрс ижил нэртэй үед л дугаар
           нэмнэ, эс тэгвээс хоёр мөр ялгагдахгүй */
        const at = tag === "Бүртгэгдээгүй" ? place?.get(oid) : undefined;
        const twin =
          at != null &&
          [...(place?.entries() ?? [])].some(([o, n]) => o !== oid && n === at);
        const no = at
          ? twin
            ? `${at} · № ${oid}`
            : at
          : tag !== "Бүртгэгдээгүй"
            ? `${tag} · № ${oid}`
            : `№ ${oid}`;
        out.push({
          key: String(oid),
          label: name && name !== "Бүртгэгдээгүй" ? name : no,
          value: ha,
        });
      }
      return out.sort((a, b) => b.value - a.value);
    },
    [places],
  );

  /*
    ХӨНДЛӨН ХҮСНЭГТ — давхарга бүрийн ХАМГИЙН САЙН ХОЁР задаргаа
    (хэрэглэгч, 2026-09-25: "диаграм нэг хэвийн — бүгд зурвас").

    Зурвас нь НЭГ тэнхлэгийн асуултад л хариулдаг: "аль хэсэгт хэдэн
    бүс вэ". Гэтэл бүртгэлийн жинхэнэ асуулт нь ихэвчлэн ХОЁР
    тэнхлэгтэй — "аль дүүргийн аль хэсэгт", "ямар төрлийн худаг
    зөвшөөрөлтэй юу" — бөгөөд түүнийг хоёр тусдаа зурвасаас ХЭЗЭЭ Ч
    уншиж чадахгүй. Үнэлгээний хэлтэст яг энэ гомдлоор `Matrix`
    нэмэгдсэн бөгөөд бүрэлдэхүүн нь ерөнхий тул дахин ашиглана.

    ⚠ ХОЁУЛАА ТООЛЛЫН задаргаа байх ёстой: нүд нь бичлэгийн тоо тул
    хэмжилтийн задаргаа (талбай, төлбөр) энд утгагүй.
    ⚠ Хоёроос найм хүртэлх утгатай нь л орно: есөн баганат хүснэгт
    300px-ийн картад уншигдахаа болино.
    ⚠ ОЛОН УТГАТ задаргааг АВАХГҮЙ (`multi`): нэг бичлэг хэд хэдэн
    нүдэнд орох тул нийт нь бичлэгийн тооноос давж, хүснэгтийн мөр,
    баганын нийлбэр худал болно.
    ⚠ Тооцоо нь `views`-ээс хамаарсан МЕМО: 14 мянган мөртэй давхарга
    дээр зурагдалт бүрд дахин бодуулбал самбар хөлдөнө.
  */
  const crosses = React.useMemo(() => {
    type Cross = {
      row: Breakdown;
      col: Breakdown;
      cell: Map<string, number>;
      /** Давхардалгүй баганын нийт — мөр олон утгат үед л */
      colTotal?: Map<string, number>;
      total?: number;
    };
    const out = new Map<string, Cross[]>();
    if (!set.tidy) return out;
    /* Нүднүүд нь ХОЁР ХЭМЖЭЭСЭЭ АЛГАСЧ тоологдоно (доорх тайлбарыг үз) */
    const tally = (v: (typeof views)[number], row: Breakdown, col: Breakdown): Cross => {
      const cell = new Map<string, number>();
      const colTotal = row.multi ? new Map<string, number>() : undefined;
      let total = 0;
      const skip = [filterKey(row), filterKey(col)];
      for (const r of v.inside) {
        if (!v.passes(r, skip)) continue;
        total += 1;
        for (const ck of col.keyOf(r)) {
          if (colTotal) colTotal.set(ck, (colTotal.get(ck) ?? 0) + 1);
          for (const rk of row.keyOf(r)) {
            const k = `${rk}\u0000${ck}`;
            cell.set(k, (cell.get(k) ?? 0) + 1);
          }
        }
      }
      return colTotal ? { row, col, cell, colTotal, total } : { row, col, cell };
    };
    for (const v of views) {
      if (set.noCross?.includes(v.id)) continue;
      /*
        БАГАНА ТОГТМОЛ ({@link LayerSet.crossBy}, гадаргын ус "… × Он"):
        НЭГ утгат тоолол бүр мөр болж, хүснэгт бүр ижил баганатай.
        Багана нь диаграмгүй талбар байж болох тул утгыг мөрөөс шууд.
      */
      const by = set.crossBy?.[v.id];
      if (by) {
        const keyOf = (r: Row) => [categoryKey(r[by])];
        const seen = new Map<string, number>();
        for (const r of v.inside) {
          const k = keyOf(r)[0];
          seen.set(k, (seen.get(k) ?? 0) + 1);
        }
        /* Он өсөхөөр; "Он тодорхойгүй" зэрэг бичвэр нь сүүлд */
        const isYear = (k: string) => /^\d{4}$/.test(k);
        const values = [...seen]
          .sort(([a], [b]) =>
            isYear(a) === isYear(b) ? a.localeCompare(b) : isYear(a) ? -1 : 1,
          )
          .map(([key, value]) => ({ key, label: key, value }));
        const label =
          set.pickBar?.field === by
            ? set.pickBar.label
            : (v.hit.info.fields.find((f) => f.name === by)?.alias ?? by);
        const col: Breakdown = {
          id: `crossby:${by}`,
          field: by,
          label,
          kind: "count",
          values,
          keyOf,
          recount: () => ({ values }),
        };
        const list = v.charts
          .filter(
            (b) =>
              b.kind === "count" &&
              !b.multi &&
              !b.top &&
              !isTime(b) &&
              b.field !== by,
          )
          .map((row) => tally(v, row, col));
        /* Бүртгэлийн тэргүүлэх тэнхлэг ЭХЭНД ({@link LayerSet.lead};
           хэрэглэгч, 2026-10-22: "usnii urul hamgiin deeree") — бусад нь
           оноогоороо (`sort` тогтвортой) */
        const lead = set.lead ?? [];
        const rank = (b: Breakdown) => {
          const i = lead.indexOf(b.field);
          return i < 0 ? lead.length : i;
        };
        list.sort((a, b) => rank(a.row) - rank(b.row));
        if (list.length) out.set(v.id, list);
        continue;
      }
      let row: Breakdown | undefined;
      let col: Breakdown | undefined;
      const pair = set.cross?.[v.id];
      if (pair) {
        /* Бүртгэлийн заасан хос ({@link LayerSet.cross}) */
        const count = (field: string) =>
          v.charts.find((b) => b.kind === "count" && b.field === field);
        row = count(pair[0]);
        col = count(pair[1]);
        if (!row || !col || col.multi) continue;
      } else {
        const fit = v.charts.filter(
          (b) =>
            b.kind === "count" &&
            !b.multi &&
            b.values.length >= 2 &&
            b.values.length <= 8,
        );
        if (fit.length < 2) continue;
        [col, row] = fit;
      }
      /*
        ⚠⚠ НҮДНҮҮД нь ХОЁР ХЭМЖЭЭСЭЭ АЛГАСЧ тоологдоно (2026-09-29).
        Урьд нь ШҮҮГДСЭН мөрөөс (`v.rows`) тоолдог байсан тул мөр
        сонгомогц бусад БҮХ нүд тэг болж, хүснэгт нурж байв — "юу
        сонгосон" гэдгээ л харуулж, өөр рүү шилжих арга алга болно.
        Энэ нь "диаграм бүр ӨӨРИЙНХӨӨ хэмжигдэхүүнийг алгасч шүүгдэнэ"
        гэсэн ерөнхий дүрмийн яг тэр тохиолдол — зөвхөн хүснэгт нь
        ХОЁР тэнхлэгтэй тул хоёуланг нь алгасна.
        ⚠ Бусад талбарын шүүлт ХЭВЭЭР үйлчилнэ: дүүргээр шүүсний дараа
        хүснэгт тэр дүүргийн дотор задарна.
      */
      out.set(v.id, [tally(v, row, col)]);
    }
    return out;
  }, [views, set.tidy, set.cross, set.noCross, set.crossBy, set.pickBar, set.lead]);

  /*
    БҮС БҮРД ХЭДЭН НЭГЖ ТАЛБАР ДАВХЦАЖ БАЙНА (хэрэглэгч, 2026-09-25:
    "3 бүс нь хэдэн га талбайтай, эдгээрт хэдэн parcel давхцаж байна
    гэсэн л юм байна").

    Сервер тоолно — хагас сая дүрсийг хөтөч рүү татахгүй. Хэмжсэн:
    гурван бүс нийлээд 2.5 секунд.

    ⚠ Давхаргын АЛЬ ХЭДИЙН ТАТАГДСАН геометрийг хэрэглэнэ — дахин
    татахгүй.
    ⚠ Тоо нь ШҮҮЛТЭЭС ҮЛ ХАМААРНА: "энэ бүсэд хэдэн нэгж талбар
    давхцаж байна" гэдэг нь бүсийн ШИНЖ ЧАНАР, харагдацын биш.
    Тиймээс `views` биш `loaded`-оос уншина.
  */
  const [overlap, setOverlap] = React.useState<Record<string, number>>({});
  /* Задарсан бүсүүд — ОЛОН зэрэг (хэрэглэгч, 2026-10-06: "3-уулангийн
     нь зэрэг харж болдог болгоорой"). Урьд нь нэгийг нээхэд нөгөө нь
     хаагддаг байсан тул бүсүүдийн дүрсийг хооронд нь харьцуулах
     боломжгүй байв */
  const [zoneOpen, setZoneOpen] = React.useState<readonly string[]>([]);

  /*
    ДАВХЦАХ НЭГЖ ТАЛБАР — ЗАДАРГААНЫ ТЭНХЛЭГЭЭР (`LayerSet.parcelBy`,
    хэрэглэгч 2026-10-02: "татам доторх нэгж талбарыг харуулъя, map
    болон чартаар").

    Зураг дээр давхцсан нэгж талбар "Нэгж талбар" товчоор аль хэдийн
    УЛААНААР зурагддаг ({@link fetchParcelsOn}); энэ нь түүний ТООН
    хариулт — аль сав газрын татамд хэдэн нэгж талбар орсон бэ.

    ⚠ Сервер тоолно (`returnCountOnly`) — хагас сая дүрсийг хөтөч рүү
    татахгүй. Бүлэг тус бүр НЭГ хүсэлт.
    ⚠ Бүлгийн түлхүүр нь задаргааны ӨӨРИЙН `keyOf` — диаграм, шүүлт,
    өнгө гурвуулаа нэг эх сурвалжаас ({@link Breakdown.keyOf}).
    ⚠ ШҮҮЛТЭЭС ҮЛ ХАМААРНА: давхцал нь давхаргын шинж чанар тул
    `views` биш `loaded`-оос уншина (бүсийн картын тоотой нэг зарчим).
  */
  const parcelAxis = React.useMemo(
    () => parcelAxisOf(set.parcelBy, on, loaded),
    [set.parcelBy, on, loaded],
  );

  const parcelKey = parcelAxis
    ? `${parcelAxis.id}:${parcelAxis.order.join("|")}:${[...parcelAxis.groups.values()].reduce((n, g) => n + g.length, 0)}`
    : "";
  const [axisParcels, setAxisParcels] = React.useState<{
    key: string;
    counts: Record<string, number>;
  }>({ key: "", counts: {} });

  React.useEffect(() => {
    /* Дүрс ирээгүй бол тоолох зүйл алга — карт нь "…" харуулж хүлээнэ */
    if (!parcelAxis?.groups.size) return;
    const ac = new AbortController();
    const keys = parcelAxis.order;
    Promise.all(
      keys.map((k) =>
        countParcelsIn(ringsOf(parcelAxis.groups.get(k) ?? []), ac.signal)
          /* Нэг бүлэг унавал бусад нь ХЭВЭЭР — диаграм нь нэмэлт
             мэдээлэл тул самбарыг унагаахгүй */
          .catch(() => 0),
      ),
    ).then((got) => {
      if (ac.signal.aborted) return;
      const counts: Record<string, number> = {};
      keys.forEach((k, i) => (counts[k] = got[i]));
      setAxisParcels({ key: parcelKey, counts });
    });
    return () => ac.abort();
  }, [parcelAxis, parcelKey]);

  /*
    ⚠⚠ ДАВХЦАХ НЭГЖ ТАЛБАР ЮУ ВЭ — ЭРХ, ЗОРИУЛАЛТ (2026-10-02,
    хэрэглэгч: "энэ хоосон зайнд юу хийж болох вэ, хоосон зай
    гаргамааргүй байна").

    Баруун багана хоёр богино карттай байсан тул доороо хоосон
    үлдэж байв. Зайг ЗАЙГААР биш АГУУЛГААР дүүргэв: татамд давхцаж
    буй газрууд ямар эрхтэй, ямар зориулалттай вэ гэдэг нь цэсэнд
    урьд нь ХААНА Ч гардаггүй байсан бодит хариулт
    ({@link parcelCuts}).

    ⚠⚠ СЕРВЕР БҮЛЭГЛЭЖ ТООЛНО — 88 мянган дүрсийг хөтөч рүү татахгүй.
    ⚠ ТАЙРААГҮЙ цагираг (`zoneRings`): тоо нь ХАРАГДАХ ХҮРЭЭНЭЭС ҮЛ
    ХАМААРНА — "татамд хэдэн газар орсон бэ" гэдэг нь давхаргын шинж
    чанар (бүсийн картын тоотой нэг зарчим).
    ⚠ Унавал карт ГАРАХГҮЙ: эдгээр нь нэмэлт мэдээлэл тул самбарыг
    унагаах ёсгүй.
  */
  const cutKey = set.parcelBy ? `${on.join("|")}:${zoneRings.length}` : "";
  const [axisCuts, setAxisCuts] = React.useState<{
    key: string;
    cuts: ParcelCut[];
  }>({ key: "", cuts: [] });

  React.useEffect(() => {
    if (!set.parcelBy || !zoneRings.length) return;
    const ac = new AbortController();
    parcelCuts(zoneRings, ac.signal)
      .then((cuts) => {
        if (!ac.signal.aborted) setAxisCuts({ key: cutKey, cuts });
      })
      .catch(() => {});
    return () => ac.abort();
  }, [set.parcelBy, zoneRings, cutKey]);

  const cutsReady = cutKey !== "" && axisCuts.key === cutKey;

  /* Төлөв нь ДАМ гарна: эффектээс `set*` дуудахыг
     `react-hooks/set-state-in-effect` хориглодог */
  const parcelReady = parcelAxis != null && axisParcels.key === parcelKey;
  const parcelRows: Datum[] = parcelReady
    ? parcelAxis.order.map((k) => ({
        key: k,
        label: k,
        value: axisParcels.counts[k] ?? 0,
      }))
    : [];

  const stats = React.useMemo(() => {
    let records = 0;
    let ha = 0;
    for (const { hit, rows, oids } of views) {
      records += rows.length;
      /* Шүүлттэй үед талбайг ҮЛДСЭН дүрсээс тооцно — бүхэл давхаргын
         нийлбэрийг үлдээвэл индикатор нь диаграмтайгаа зөрнө */
      const k = hit.info.areaInHa ? 1 : 1 / 10000;
      for (const oid of oids) ha += (hit.data.area[oid] ?? 0) * k;
    }
    return { layers: views.length, records, ha };
  }, [views]);

  /*
    НЭГ ДАВХАРГЫН ХОЁР БҮЛЭГ ({@link LayerSet.overviewSplit}) — ТХГН
    дээр ангилалтай ба ангилалгүй. Шүүгдсэн дүрсээс (`oids`) тоолно:
    индикатор диаграмтайгаа зөрөх ёсгүй.
    ⚠ "Хоосон" гэдгийг `categoryKey`-ээр шийднэ — диаграмын
    "Бүртгэгдээгүй" мөртэй НЭГ дүрэм.
  */
  const groups = React.useMemo(() => {
    const g = set.overviewSplit;
    if (!g) return null;
    const v = views.find((x) => x.id === g.layer);
    if (!v) return null;
    const k = v.hit.info.areaInHa ? 1 : 1 / 10000;
    const none = categoryKey(null);
    const filled = { n: 0, ha: 0 };
    const empty = { n: 0, ha: 0 };
    for (const oid of v.oids) {
      const row = v.hit.data.rows[oid];
      if (!row) continue;
      const side = categoryKey(row[g.field]) === none ? empty : filled;
      side.n += 1;
      side.ha += (v.hit.data.area[oid] ?? 0) * k;
    }
    return { filled, empty, ha: filled.ha + empty.ha };
  }, [set.overviewSplit, views]);

  /**
   * НЭМЭЛТ ҮЗҮҮЛЭЛТ — диаграмуудаас ӨӨРСДӨӨ гарна.
   *
   * ⚠⚠ Зурвас ихэнх давхарга дээр ГАНЦ нүдтэй үлддэг байв (хэрэглэгч
   * 2026-09-28: "indicator хэрэгтэй байна"). "Идэвхтэй давхарга" нь
   * зөвхөн сонгох жагсаалттай цонхонд, "Талбай, га" нь зөвхөн олон
   * өнцөгтөд гардаг тул аюултай хог хаягдал зэрэг ЦЭГЭН давхарга дээр
   * "Шүүлтэд тохирох бүртгэл" ганцаараа бүтэн өргөнийг эзэлж байлаа.
   *
   * Хоёр төрөл нэмэгдэнэ, аль аль нь диаграмын АЛЬ ХЭДИЙН тооцсон
   * утгаас гардаг тул шинэ таамаг ОРОХГҮЙ:
   *
   * 1. **Хэмжилтийн НИЙЛБЭР** — талбай, эзэлхүүн, төлбөр. Зурвасан
   *    диаграм нь задаргааг хэлдэг ч НИЙТ дүнг хэлдэггүй.
   * 2. **Хугацааны МУЖ** — жилийн цуваа бүрийн эхэн, төгсгөл.
   *
   * ⚠ Нийлбэрийг ЗӨВХӨН `sum` төрлөөс авна: `mean` (хувь, өндөршил,
   * агууламж) нь нэмэгдэхгүй, `count` нь бүртгэлийн тоог давтана.
   * ⚠ ХУРААСАН диаграмыг алгасна (`top`): харагдаж буй мөрүүдийн
   * нийлбэр нь бүтэн дүн БИШ тул үзүүлэлт худал хэлнэ.
   * ⚠ Нэг хэмжилт хэд хэдэн зүсэлтээр диаграм болдог тул нэрээр нь
   * ДАВХАРДЛЫГ хасна.
   * ⚠⚠ **ТАЛБАЙ ХОЁР УДАА ГАРАХГҮЙ.** "Талбай, га" нүд нь ГЕОМЕТРЭЭС
   * бодогддог; эх сурвалж мөн өөрийн талбайн баганатай байдаг (ойн
   * хэсэглэл дээр 122,236 ба 122,262 гэсэн бараг ижил хоёр тоо
   * зэрэгцэж, аль нь зөв болох нь уншигдахгүй байв). Талбайн нүд
   * гарсан үед га нэгжтэй хэмжилтийг зурваст ОРУУЛАХГҮЙ — тэр нь
   * өөрийн диаграмтай хэвээр.
   * ⚠ Хоёроор хязгаарлана: зурвас нь дөрвөөс олон нүдтэй бол тус бүр
   * нь нарийсаж, урт шошго гурван мөр болно.
   */
  const extras = React.useMemo(() => {
    const out: { key: string; label: string; value: string; time: boolean }[] =
      [];
    const seen = new Set<string>();

    for (const v of views)
      for (const b of v.charts) {
        if (b.kind !== "sum" || b.top || !b.measure) continue;
        /* Хэмжилт тус бүр өөрийн карттай давхарга ({@link
           LayerSet.measureCards}) — нийлбэр нь картын толгойд аль
           хэдийн бий; индикаторт давтахгүй (хэрэглэгч 2026-10-06:
           "индикатор биш чартаар") */
        if (set.measureCards?.[v.id]) continue;
        if (stats.ha > 0 && /(^|,\s*)га$/i.test(b.measure)) continue;
        if (seen.has(b.measure)) continue;
        seen.add(b.measure);
        /* Диаграм ӨӨРИЙН талбарын шүүлтийг алгасдаг тул нийлбэрийг
           шүүгдсэн мөрөөс дахин бодно — үзүүлэлт бүртгэлийн тоотой зөрөхгүй */
        const total = b.recount(v.rows).values.reduce((sum, d) => sum + d.value, 0);
        if (!(total > 0)) continue;
        out.push({
          key: `${v.id}:${b.id}`,
          label: b.measure,
          value: num(Math.round(total)),
          time: false,
        });
      }

    for (const v of views)
      for (const b of v.charts) {
        if (b.kind !== "year") continue;
        /* Хоосон жил ч тэг утгаар цуваанд ордог тул муж нь БҮРТГЭЛТЭЙ
           хоёр үзүүрээр тогтоно; шүүгдсэн мөрөөс (дээрхтэй нэг шалтгаан) */
        const filled = b.recount(v.rows).values.filter((d) => d.value > 0);
        if (filled.length < 2) continue;
        const from = filled[0].label;
        const to = filled[filled.length - 1].label;
        if (from === to) continue;
        out.push({
          key: `${v.id}:${b.id}`,
          label: b.label,
          value: `${from}–${to}`,
          time: true,
        });
      }

    return out.slice(0, 2);
  }, [views, stats.ha, set.measureCards]);

  /*
    Доод зурваст орох диаграмууд — давхарга бүрийн хугацааны цуваа.

    Хавтгай жагсаалт болгож бэлдэнэ: зурвас нь давхарга бүрд БИЕ
    ДААСАН бүлэг биш, нэг эгнээ. Давхаргын нэрийг зөвхөн тухайн
    давхаргын ЭХНИЙ карт үүрнэ (`first`).
  */
  /**
   * ХАРАГДАХ ДАВХАРГУУДЫГ ШУУД ТАВИХ.
   *
   * `toggle` нь НЭГ давхаргыг сэлгэдэг; бүсийн цэс нь нэг товшилтоор
   * хэд хэдэн давхаргыг унтраадаг (нэгийг тусгаарлах) тул унтарсан
   * БҮГДИЙН нь шүүлт, цуваа цэвэрлэгдэх ёстой.
   */
  function showLayers(next: readonly string[]) {
    setOn([...next]);
    const gone = set.layers.filter((id) => !next.includes(id));
    if (!gone.length) return setPicked(null);
    const drop = (m: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(m).filter(([k]) => !gone.includes(k)));
    setFilters((f) => drop(f) as typeof f);
    setSeries((v) => drop(v) as typeof v);
    setPicked(null);
  }

  function toggle(id: string) {
    /* ⚠ Харилцан үгүйсгэх бүрдэлд сонголт нь СОЛИГДОНО, нэмэгддэггүй:
       дахин товшиход ч унтрахгүй — хоосон зураг нь сонголт биш алдаа
       мэт харагдана (цаг агаарын хэмжигдэхүүний радио мөртэй нэг
       зарчим) */
    setOn((s) =>
      set.exclusive
        ? [id]
        : s.includes(id)
          ? s.filter((x) => x !== id)
          : [...s, id],
    );
    /* Унтраасан давхаргын шүүлт үлдвэл дараа нь асаахад учир
       битүүлэг байдлаар хоосон гарна */
    const drop = (m: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(m).filter(([k]) => k !== id));
    setFilters((f) => (f[id] ? (drop(f) as typeof f) : f));
    setSeries((v) => (v[id] ? (drop(v) as typeof v) : v));
    setPicked(null);
  }

  /*
    Уншигдаагүй давхаргыг ДАХИН оролдоно.

    Урьд нь ийм мөр товшигдохгүй байсан бөгөөд хэрэглэгч "давхарга
    сонгож болохгүй байна" гэж үздэг байв — бүтэлгүйтсэн шалтгаан нь
    түр зуурынх (нэвтрэлтийн хугацаа, сүлжээ) байж болох тул дахин
    оролдох зам ЗААВАЛ нээлттэй байх ёстой.
  */
  function retry(id: string) {
    setFailed((f) => {
      const next = { ...f };
      delete next[id];
      return next;
    });
    fetchLayerInfo(set, id)
      .then((info) => setInfos((m) => ({ ...m, [id]: info })))
      .catch((e: Error) => setFailed((f) => ({ ...f, [id]: e.message })));
  }

  /*
    БҮСИЙН ТОЙМ — олон давхаргатай цэсэд (хэрэглэгч, 2026-09-25:
    "3 бүс нь хэдэн га талбайтай, эдгээрт хэдэн parcel давхцаж байна
    гэсэн л юм байна ... хязгаарлалтын бүс дээр дарсан тохиолдолд л
    дотор задарсан нэрүүдийг нь харуулж болно").

    Мөр бүр НЭГ ДАВХАРГА: нэр · талбай, га · давхцах нэгж талбар.
    Товшиход тэр давхаргын дүрсүүд нэрээрээ задарна.

    ⚠ ХУВЬ БИЧИХГҮЙ: хоёр тоо нь өөрсдөө хариулт бөгөөд гурван мөрийн
    харьцааг нүд шууд харна.
    ⚠ Зөвхөн ХОЁР ба түүнээс олон давхаргатай цэсэд: нэг давхаргатай
    цэсэд энэ нь үзүүлэлтийн зурвасыг давтана.
    ⚠ Талбай нь эх сурвалжийн ӨӨРИЙН гектараар ({@link LayerInfo.areaInHa})
    — `SHAPE__Area` нь Web Mercator тул 2.2 дахин хөөрөгдсөн.
  */
  /*
    БҮСИЙН ХЭСГҮҮД — талбай, давхцлын тоо тооцохоос ӨМНӨХ алхам.

    Ердийн үед хэсэг бүр НЭГ ДАВХАРГА. `splitZones` үед (голын татам)
    НЭГ давхарга тэргүүлэх ангиллаараа хуваагдана — сав газар бүр бүс
    болно ({@link LayerSet.splitZones}).
    ⚠ Давхцлын тоо (`overlap`) хэсэг бүрийн геометрээс асуугддаг тул
    хэсгүүд нь `zones`-оос ТУСДАА — эс тэгвээс давхцал ирэх бүрд
    геометр дахин угсрагдана.
  */
  const zoneParts = React.useMemo(() => {
    if (!set.zones) return [];
    type Part = {
      id: string;
      layer: string;
      label: string;
      tone: string;
      hit: Loaded;
      oids: Set<number>;
      /** Хуваасан бүсийн ШҮҮЛТ — тэнхлэг ба утга (`pickOnly`) */
      axis?: string;
      key?: string;
      /** Дүрс тус бүр нэг бүс ({@link LayerSet.splitShapes}) — дүрсийн дугаар */
      shape?: number;
    };
    /*
      ⚠⚠ БҮСИЙН КАРТ ГАНЦААРАА ЗОГСДОГ ЦЭСЭД ТОО НЬ СОНГОЛТООС ҮЛ
      ХАМААРНА ({@link LayerSet.zonesOnly}, 2026-10-06-ны шалгалт).
      Сонгосон бичлэг бүх самбарыг шүүдэг (`views`) тул дүрс сонгомогц
      бусад хоёр бүс "0 га, 0 дүрс" болж, нээлттэй жагсаалт ганц мөр
      болж хумигддаг байв — өөр дүрс рүү шилжих арга алга болно. Тэр
      карт нь цэсийн ТОЙМ бөгөөд дүрс сонгох ЦЭС мөн тул бүтэн
      давхаргаас (`loaded`) тоолно; сонголт нь зөвхөн мөрийг тодруулна.
      ⚠ Бүсийн цэс (`on`) хүчинтэй хэвээр — нуусан бүс гарахгүй.
      ⚠ Талбарын шүүлт энэ цэсэд байхгүй (`fieldMenus: false`,
      задаргааны карт гарахгүй) тул алгасах зүйл алга.
    */
    const whole = (id: string, hit: Loaded, oids: Set<number>): Part => ({
      id,
      layer: id,
      label: hit.info.name,
      tone: toneOf(id),
      hit,
      oids,
    });
    const out: Part[] = [];
    if (set.zonesOnly) {
      for (const id of on) {
        const hit = loaded[id];
        if (!hit || hit.info.geometry === "Point") continue;
        const all = new Set(Object.keys(hit.data.rows).map(Number));
        /* Дүрс бүр өөрийн бүс ({@link LayerSet.splitShapes}) — нэгтгэсэн
           нэг мөрийн оронд (хэрэглэгч, 2026-10-07: "нэгтгэхгүйгээр
           зүгээр 2-уулыг нь л харуул"). Нэр нь `zones`-д (байршлын нэр
           ирэх хүртэл хэсгийг дахин угсрахгүйн тулд) */
        if (set.splitShapes) {
          for (const oid of all)
            out.push({
              id: `${id}\u0000#${oid}`,
              layer: id,
              label: hit.info.name,
              tone: toneOf(id),
              hit,
              oids: new Set([oid]),
              shape: oid,
            });
          continue;
        }
        const field = splitsZones(set, id) ? leadGroup(hit) : undefined;
        const b = field
          ? hit.charts.find((c) => c.field === field && c.kind === "count")
          : undefined;
        if (!b) {
          out.push(whole(id, hit, all));
          continue;
        }
        /* Ангилал бүр нэг бүс — диаграмын ӨӨРИЙН `keyOf`-оор, эс тэгвээс
           зургийн өнгө, шүүлтийн түлхүүртэй зөрнө */
        const by = new Map<string, Set<number>>();
        for (const oid of all) {
          const row = hit.data.rows[oid];
          const key = row ? b.keyOf(row)[0] : undefined;
          if (key == null) continue;
          const group = by.get(key) ?? new Set<number>();
          group.add(oid);
          by.set(key, group);
        }
        for (const v of b.values) {
          const oids = by.get(v.key);
          if (!oids?.size) continue;
          out.push({
            id: `${id}\u0000${v.key}`,
            layer: id,
            label: v.label,
            /* Зургийн өнгөтэй НЭГ эх сурвалж — карт нь тайлбар болно */
            tone: palettes[id]?.colors.get(v.key) ?? toneOf(id),
            hit,
            oids,
            axis: filterKey(b),
            key: v.key,
          });
        }
      }
    } else {
      for (const v of views)
        if (v.hit.info.geometry !== "Point")
          out.push(whole(v.id, v.hit, v.oids));
    }
    return out;
  }, [
    set,
    on,
    loaded,
    views,
    palettes,
    toneOf,
  ]);

  /* Хэсэг бүрийн ГЕОМЕТР — давхцлын асуулга ба нэгж талбарын картад */
  const zoneShapes = React.useCallback(
    (p: { hit: Loaded; oids: Set<number>; layer: string; id: string }) =>
      p.id === p.layer
        ? p.hit.data.shapes.features
        : p.hit.data.shapes.features.filter((f) => p.oids.has(Number(f.id))),
    [],
  );

  /* Давхцах нэгж талбарын тоо — хэсэг бүрд НЭГ л удаа асууна. Хуваасан
     бүсийн палитр ирэх зэргээр хэсгүүд дахин угсрагдахад дахин асуухгүй */
  const asked = React.useRef(new Set<string>());
  /* ⚠ ЦУЦЛАХГҮЙ: хэсгүүд палитр ирэх зэргээр дахин угсрагдаж эффект
     дахин ажилладаг. Цэвэрлэгээнд хүсэлтийг цуцалбал шинэ ажиллалт
     "аль хэдийн асуусан" гэж алгасаж, тоо хэзээ ч ирэхгүй. Хүсэлт
     дуусаад төлөвт сууна; самбар салсан бол React үүнийг үл тоомсорлоно */
  React.useEffect(() => {
    if (!set.zones) return;
    for (const p of zoneParts) {
      if (asked.current.has(p.id)) continue;
      const rings = ringsOf(zoneShapes(p));
      if (!rings.length) continue;
      asked.current.add(p.id);
      countParcelsIn(rings)
        .then((n) => setOverlap((m) => ({ ...m, [p.id]: n })))
        .catch(() => {
          /* Давхцлын тоо нь НЭМЭЛТ мэдээлэл — самбарыг унагаахгүй.
             Дараагийн удаа дахин асуухын тулд тэмдэглэгээг арилгана */
          asked.current.delete(p.id);
        });
    }
  }, [set.zones, zoneParts, zoneShapes]);

  const zones = React.useMemo(() => {
    const out = zoneParts.map((p) => {
      const k = p.hit.info.areaInHa ? 1 : 1 / 10000;
      let ha = 0;
      for (const oid of p.oids) ha += (p.hit.data.area[oid] ?? 0) * k;
      return {
        id: p.id,
        layer: p.layer,
        /* Дүрсийн бүс — жагсаалтын мөртэй НЭГ нэр (байршил · дугаар) */
        label:
          p.shape != null
            ? (areaRowsOf(p.hit, p.oids)[0]?.label ?? p.label)
            : p.label,
        tone: p.tone,
        ha,
        parcels: overlap[p.id],
        /* Хуваасан бүсийн мөр ангиллаа ДАВТАХГҮЙ — тэр нь толгойд бий */
        rows: areaRowsOf(p.hit, p.oids, p.id !== p.layer),
        features: zoneShapes(p),
        axis: p.axis,
        key: p.key,
        shape: p.shape,
      };
    });
    /* Хуваасан бүсүүд том нь эхэндээ; давхаргын бүсүүд бүртгэлийн
       дарааллаараа (тэжээгдэл → хязгаарлалт → хориглолт). Нэг цэст хоёул
       байвал (хамгаалалтын бүс + голын татам) давхаргын дараалал хэвээр,
       зөвхөн тэр давхаргын ДОТОР эрэмбэлнэ */
    if (set.splitShapes) return out.sort((a, b) => b.ha - a.ha);
    const byLayer = new Map<string, typeof out>();
    for (const z of out) {
      const g = byLayer.get(z.layer) ?? [];
      g.push(z);
      byLayer.set(z.layer, g);
    }
    return [...byLayer.entries()].flatMap(([layer, g]) =>
      splitsZones(set, layer) ? g.sort((a, b) => b.ha - a.ha) : g,
    );
  }, [
    zoneParts,
    overlap,
    areaRowsOf,
    zoneShapes,
    set,
  ]);

  /*
    Бүсийн карт гарах эсэх. Ердийн олон давхаргат цэсэд ХОЁРООС цөөн
    бүс бол үзүүлэлтийн зурвасыг давтана; харин бүсийн карт ганцаараа
    зогсдог цэсэд бүсийн цэсээр нэгийг үлдээхэд карт алга болбол
    дүрсүүдийг сонгох зам ч, нэгж талбарын карт ч хамт алга болдог байв.
  */
  const zoneMode = set.zonesOnly ? zones.length > 0 : zones.length > 1;

  /* Нэгж талбарын картын бүсүүд. ⚠ Тогтвортой лавлагаа ЗААВАЛ: карт нь
     бүсийн геометрээс асуулга угсардаг тул эцэг самбарын зурагдалт
     бүрд шинэ массив өгвөл асуулга дахин эхэлнэ */
  const parcelZones = React.useMemo(
    () =>
      set.zonesOnly && zoneMode
        ? zones.map((z) => ({
            id: z.id,
            label: z.label,
            tone: z.tone,
            features: z.features,
          }))
        : null,
    [set.zonesOnly, zoneMode, zones],
  );

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
          <Loader2 size={14} className="animate-spin" />
          Давхаргын тодорхойлолт уншиж байна…
        </span>
      </div>
    );
  }

  /**
   * Диаграмын картууд — НЭГ үүсгэгч, ХОЁР багана.
   *
   * `keep` нь аль диаграм энэ баганад харьяалагдахыг хэлнэ: зүүн
   * талд зөвхөн хамгийн урт нь ({@link split}), баруунд бусад нь.
   * Хоёр газар хуулбарлавал өнгө, сонголт, палитрын товч гурав эрт
   * орой зөрнө.
   */

  /*
    ⚠⚠ БҮСИЙН КАРТ нь ЦЭСИЙН ЦОРЫН ГАНЦ КАРТ болов (хэрэглэгч,
    2026-10-06: "доод 2 тусдаа чарт нь хэрэггүй, үүнийгээ хөгжүүл"),
    {@link LayerSet.zonesOnly}. Тиймээс тусдаа картуудын хийдэг байсан
    ажлыг ӨӨРӨӨ үүрнэ:

    1. **Нэр БҮТЭН.** Урьд нь нэр, га, нэгж талбар гурав НЭГ эгнээнд
       шахагдаж "Тэжээгдлийн…", "Хязгаарлалт…" гэж тасардаг байв —
       бүсийн нэр бол картын гол мэдээлэл. Одоо мөр ХОЁР эгнээтэй:
       дээд нь нэр ба талбай, доод нь дүрсийн ба нэгж талбарын тоо.
    2. **Өнгөт тэмдэг** — давхаргын өнгө (`toneOf`), зурагтай НЭГ эх
       сурвалж: карт нь газрын зургийн тайлбар болно.
    3. ⚠⚠ **ДҮҮРГЭЛТТЭЙ ЗУРВАС БАЙХГҮЙ** (хэрэглэгч, 2026-10-06: "тэр
       га-г дүрсэлж байгаа дүүргэлттэй өнгөнүүд хэрэггүй"). Бүсийн
       мөрөнд ч, дүрсийн мөрөнд ч талбайг зурвасаар давтаж байсныг
       хасав — тоо нь өөрөө хариулт. **Дахин бүү нэм.**
    4. **Задаргааны мөр ТОВШИГДОНО** — урьд нь зөвхөн бичвэр байсан;
       тусдаа картуудын `RowChart` нь дүрсийг сонгож зураг ойртуулдаг
       байсан тул тэр боломж энд шилжсэн (`setPicked` + `setRowPick`).
       Дахин товшиход цуцлагдана.
  */
  /*
    ⚠ `dept/amitan-urgamal`-ийн (2026-10-02) нэгж талбарын картууд —
    `LayerSet.parcelBy` асаалттай үед л гарна. Ногоон бүсийн цэсүүд
    2026-10-06-ны нэгтгэлээс хойш `ParcelCard`-ыг хэрэглэдэг тул
    идэвхгүй (хэрэглэгчийн шийдвэр: өнөөдрийнхийг үлдээх).

    ДАВХЦАЖ БУЙ НЭГЖ ТАЛБАРЫН ДИАГРАМ.

    ⚠ ӨНГӨ нь задаргааныхтай НЭГ эх сурвалжаас (`palettes`) — энэ нь
    тусдаа хэмжүүр биш, ТЭР ЖЕ тэнхлэгийн хоёр дахь тоо.
    ⚠ Нийт дүн нь мөрүүдийн нийлбэрээс БАГА байж болно: хоёр сав
    газрын татамд зэрэг багтсан нэгж талбар хоёуланд нь тоологдоно.
    Тиймээс толгойд нийлбэрийг БИЧИХГҮЙ, зөвхөн ангиллын тоог хэлнэ.
  */
  /*
    ⚠⚠ ТООЛОЛ ХҮЛЭЭЖ БАЙХДАА Ч ГАРНА (хэрэглэгч, 2026-10-02: "нэгж
    талбарын chart байнга харагдана шүү"). Дөрвөн хүсэлт ~3.6 секунд
    (хэмжсэн) тул карт тэр хугацаанд огт байхгүй байж, дараа нь гэнэт
    үсэрч гарч ирдэг байв — самбар тогтворгүй харагдана.
    ⚠ Хүлээж байхад ТЭГ зурвас зурахгүй: "давхцал алга" гэсэн ХУДАЛ
    заалт болно. Оронд нь ангиллын нэр ба "…" — бүсийн картын
    хүлээлттэй нэг идиом.
  */
  const parcelCard = parcelAxis ? (
    <CutCard
      key="parcel-axis"
      title={`Давхцаж буй нэгж талбар — ${parcelAxis.label}`}
      tone={toneOf(parcelAxis.id)}
      meta={`${parcelAxis.order.length} ангилал`}
      weight={Math.max(3, parcelAxis.order.length)}
    >
      {parcelReady ? (
        <RowChart
          data={parcelRows}
          tone={toneOf(parcelAxis.id)}
          colorOf={(d) =>
            palettes[parcelAxis.id]?.colors.get(d.key) ?? toneOf(parcelAxis.id)
          }
          dense
        />
      ) : (
        <div className="divide-y divide-line">
          {parcelAxis.order.map((k) => (
            <div key={k} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                {k}
              </span>
              <span className="num shrink-0 text-[11.5px] text-ink-3">…</span>
            </div>
          ))}
        </div>
      )}
    </CutCard>
  ) : null;

  /*
    ДАВХЦАХ НЭГЖ ТАЛБАРЫН ЭРХ, ЗОРИУЛАЛТ.

    ⚠ ӨНГӨ ГАНЦ: эрхийн хэлбэр, зориулалт нь НЭРЛЭСЭН ангилал тул
    мөр бүрийг өөр өнгөөр ялгавал утгагүй солонго болно — ялгаа нь
    уртаараа гарна (платформын "дата дүрслэлийн өнгө ганц" дүрэм).
    ⚠ ТОВШИГДОХГҮЙ: эдгээр нь НЭГЖ ТАЛБАРЫН шинж тул давхаргын мөрийг
    шүүх зүйл биш — задаргааны диаграмын товшилттой андуурагдах ёсгүй.
    ⚠⚠ ТАТАЦ ХҮЛЭЭЖ БАЙХАД Ч КАРТ ГАРНА (`PARCEL_CUT_LABELS`): эс
    тэгвээс хоёр карт хэдэн секундийн дараа гэнэт үсэрч, самбар
    тогтворгүй харагдана — нэгж талбарын картын хүлээлттэй нэг идиом.
  */
  const cutTone = toneOf(parcelAxis?.id ?? on[0] ?? "");
  const parcelCutCards = set.parcelBy
    ? cutsReady
      ? axisCuts.cuts.map((cut) => {
          const total = cut.rows.reduce((n, r) => n + r.value, 0);
          return (
            <CutCard
              key={`parcel-cut:${cut.field}`}
              title={`Давхцаж буй нэгж талбар — ${cut.label}`}
              tone={cutTone}
              meta={`${num(total)} нэгж талбар · ${cut.rows.length} ангилал`}
              weight={Math.max(3, cut.rows.length)}
            >
              <RowChart
                data={cut.rows.map((r) => ({
                  key: r.key,
                  label: r.key,
                  value: r.value,
                }))}
                tone={cutTone}
                dense
                clamp
              />
            </CutCard>
          );
        })
      : PARCEL_CUT_LABELS.map((label) => (
          <CutCard
            key={`parcel-cut:${label}`}
            title={`Давхцаж буй нэгж талбар — ${label}`}
            tone={cutTone}
            weight={3}
          >
            <div className="flex h-full items-center px-1 text-[11.5px] text-ink-3">
              Тоолж байна…
            </div>
          </CutCard>
        ))
    : null;

  /* Бүгдийг НЭГ товшилтоор — гурвыг зэрэг харах нь энэ картын гол
     хэрэглээ тул гурван удаа товшуулахгүй. Хуваасан бүс задрахгүй —
     товч хэрэггүй */
  const zoneAction =
    !zoneMode || set.splitShapes || zones.every((z) => z.axis)
      ? undefined
      : (
          <button
            type="button"
            onClick={() =>
              setZoneOpen(
                zones.every((z) => zoneOpen.includes(z.id))
                  ? []
                  : zones.map((z) => z.id),
              )
            }
            className="shrink-0 rounded-xs border border-line px-1.5 py-0.5 text-[10.5px] whitespace-nowrap text-ink-2 hover:bg-paper-hi hover:text-ink"
          >
            {zones.every((z) => zoneOpen.includes(z.id))
              ? "Бүгдийг хураах"
              : "Бүгдийг задлах"}
          </button>
    );

  const zoneList = zoneMode ? (
      <div className="divide-y divide-line">
        {zones.map((z) => {
          /*
            ⚠⚠ ХУВААСАН БҮС ЗАДРАХГҮЙ (хэрэглэгч, 2026-10-06: "дүрс гэж
            задлах шаардлагагүй, зүгээр л жишээ нь Туул гээд дан").
            Мөр нь нэр · талбай · давхцах нэгж талбар. Товшиход газрын
            зураг тэр сав газраар ШҮҮГДЭНЭ (`pickOnly` — дахин товшиход
            цуцлагдана); карт өөрөө шүүгдэхгүй тул бусад мөр харагдсаар.
          */
          /*
            ДҮРСИЙН БҮС ({@link LayerSet.splitShapes}) — нэг эгнээ: нэр ·
            талбай · нэгж талбар. Товшиход тэр дүрс СОНГОГДОЖ зураг түүн
            рүү ойртоно (диаграмын мөрөөс сонгохтой ижил `rowPick`);
            дахин товшиход цуцлагдана.
          */
          if (z.shape != null) {
            const uid = uidBase(z.layer) + z.shape;
            const on = picked === uid;
            return (
              <button
                key={z.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPicked(on ? null : uid);
                  setRowPick(on ? null : uid);
                  setParcelPick(null);
                }}
                className={cn(
                  "grid w-full grid-cols-[10px_minmax(0,1fr)_auto_auto] items-baseline gap-x-3 px-1.5 py-1.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                  on && "bg-paper-hi",
                )}
                style={
                  on ? { boxShadow: `inset 2px 0 0 ${z.tone}` } : undefined
                }
              >
                <span
                  aria-hidden
                  className="size-2.5 self-center rounded-[1px]"
                  style={{ background: z.tone }}
                />
                <span
                  className="truncate text-[12.5px] text-ink"
                  title={z.label}
                >
                  {z.label}
                </span>
                <span className="num text-right text-[12.5px] font-medium whitespace-nowrap text-ink">
                  {num(Math.round(z.ha))} га
                </span>
                <span className="num w-[118px] text-right text-[11px] whitespace-nowrap text-ink-3">
                  {z.parcels == null ? "…" : `${num(z.parcels)} нэгж талбар`}
                </span>
              </button>
            );
          }
          if (z.axis && z.key) {
            const axis = z.axis;
            const key = z.key;
            const on = (filters[z.layer]?.[axis] ?? []).includes(key);
            /*
              ⚠ НЭГ ЭГНЭЭ (хэрэглэгч, 2026-10-06: "хоорондын зайг
              шахъя"): нэр · талбай · нэгж талбар зэрэгцэнэ. Хоёр эгнээ
              байхад мөр 52px, нэг эгнээнд ~30px.
              ⚠ Сонголтыг `border-l` БИШ дотогшоо сүүдрээр тэмдэглэнэ:
              `divide-line` нь хүүхдийн хүрээний өнгийг дардаг тул
              `border-transparent` ажиллахгүй, мөр бүрийн зүүн талд
              саарал зураас гарч байв.
            */
            return (
              <button
                key={z.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  pickOnly(z.layer, [[axis, key]]);
                  /* Нэгж талбарын карт өөр сав газар руу шилжих тул
                     өмнөх тодруулга зураг дээр үлдэх ёсгүй */
                  setParcelPick(null);
                }}
                className={cn(
                  "grid w-full grid-cols-[10px_minmax(0,1fr)_auto_auto] items-baseline gap-x-3 px-1.5 py-1.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                  on && "bg-paper-hi",
                )}
                style={
                  on ? { boxShadow: `inset 2px 0 0 ${z.tone}` } : undefined
                }
              >
                <span
                  aria-hidden
                  className="size-2.5 self-center rounded-[1px]"
                  style={{ background: z.tone }}
                />
                <span
                  className="truncate text-[12.5px] text-ink"
                  title={z.label}
                >
                  {z.label}
                </span>
                <span className="num text-right text-[12.5px] font-medium whitespace-nowrap text-ink">
                  {num(Math.round(z.ha))} га
                </span>
                <span className="num w-[118px] text-right text-[11px] whitespace-nowrap text-ink-3">
                  {z.parcels == null ? "…" : `${num(z.parcels)} нэгж талбар`}
                </span>
              </button>
            );
          }
          /* Сонгосон дүрсийн бүс ӨӨРӨӨ задарна — зураг дээр дарахад
               тэр дүрс карт дээр ч тодорч харагдах ёстой */
          const base = uidBase(z.layer);
          const holds =
            picked != null &&
            z.rows.some((r) => base + Number(r.key) === picked);
          const open = zoneOpen.includes(z.id) || holds;
          const tone = z.tone;
          return (
            <div key={z.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setZoneOpen((s) =>
                    open ? s.filter((x) => x !== z.id) : [...s, z.id],
                  );
                  /* Сонголт нь бүсийг нээлттэй барьдаг тул хаахад тэр
                       сонголтыг мөн цуцална — эс тэгвээс толгой дарахад
                       юу ч болохгүй мэт харагдана */
                  if (open && holds) {
                    setPicked(null);
                    setRowPick(null);
                  }
                }}
                /* Нээлттэй бүс нь ДЭВСГЭРЭЭР тодорно. Фокусын хүрээ нь
                     4px зайтай тул хөрш мөрүүд рүү халиж, сонголт мэт
                     уншигдаж байв — дотогшоо татав */
                className={cn(
                  "w-full px-1 py-2 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                  open && "bg-paper-hi",
                )}
              >
                <span className="flex items-start gap-2">
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "mt-px size-3.5 shrink-0 text-ink-3 transition-transform",
                      !open && "-rotate-90",
                    )}
                  />
                  <span
                    aria-hidden
                    className="mt-[3px] size-2.5 shrink-0 rounded-[1px]"
                    style={{ background: tone }}
                  />
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">
                    {z.label}
                  </span>
                  <span className="num shrink-0 text-[12.5px] font-medium text-ink">
                    {num(Math.round(z.ha))} га
                  </span>
                </span>
                {/* Баримтын мөр нь дээд мөртэйгээ ижил хоёр баганатай:
                      дүрсийн тоо нэрийн доор, нэгж талбар талбайн доор —
                      хоёр тоо бүс хооронд босоогоороо эгнэнэ */}
                <span className="num mt-0.5 flex items-baseline justify-between gap-2 pl-[38px] text-[11px] text-ink-3">
                  {/* ГАНЦ НЭРТЭЙ ДҮРС бол тооны оронд НЭР нь (хэрэглэгч,
                        2026-10-06: тэжээгдлийн мужийн ус хангамжийн эх
                        үүсвэр) — "1 дүрс" гэдэг юу ч хэлэхгүй, нэрийг нь
                        харахын тулд задлах шаардлагагүй. Дугаараар
                        нэрлэгдсэн ("№ 1") бол тоо хэвээр */}
                  {z.rows.length === 1 && !z.rows[0].label.startsWith("№ ") ? (
                    <span
                      className="min-w-0 truncate text-ink-2"
                      title={z.rows[0].label}
                    >
                      {z.rows[0].label}
                    </span>
                  ) : (
                    <span>{num(z.rows.length)} дүрс</span>
                  )}
                  <span className="whitespace-nowrap">
                    {z.parcels == null ? "…" : `${num(z.parcels)} нэгж талбар`}
                  </span>
                </span>
              </button>
              {open ? (
                <div className="pb-2 pl-[38px]">
                  {z.rows.length ? (
                    <ZoneShapes
                      rows={z.rows}
                      tone={tone}
                      base={base}
                      picked={picked}
                      onPick={(uid) => {
                        setPicked(uid);
                        setRowPick(uid);
                      }}
                    />
                  ) : (
                    <p className="py-1 text-[11.5px] text-ink-3">
                      Мэдээлэл хүлээгдэж байна
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
  ) : null;

  /*
    ⚠⚠ ХУУДАСНЫ ХАРАГДАЦ ({@link LayerSet.sheet}; хэрэглэгч 2026-10-22:
    "goliin tatam, hamgaalaltiin bus ygd zasagdaagui we"). Бүсийн карт
    ба нэгж талбарын карт нь Ус ашиглалтын хуудастай НЭГ хэвд —
    хураагддаг хэсгүүд: Тойм → бүс (сав газар) → давхцаж буй нэгж
    талбар. Мөрийн агуулга, товшилтын зан төлөв ХЭВЭЭР (2026-10-06-ны
    шийдвэрүүд: га-ийн зурвасгүй, сав газар задрахгүй, бүсүүд зэрэг
    задарна).
    ⚠ Тоймд талбай, нэгж талбарын НИЙЛБЭР зөвхөн хуваасан бүсэд
    (`splitZones` — сав газрууд давхцахгүй). Хамгаалалтын гурван бүс
    бие биеэ агуулдаг тул нийлбэр нь нэг газрыг хоёр, гурав тоолно —
    тэнд дүрсийн тоо л гарна.
  */
  const zoneStats: { label: string; value: string; unit: string }[] = [];
  if (zoneMode && set.sheet) {
    zoneStats.push({
      /* Хуваасан бүсэд тэнхлэгийн нэр ("Сав газар") — ялгалыг
         кодоор угсрахгүй */
      label: zones.length && zones.every((z) => z.axis)
        ? (() => {
            const hit = loaded[zones[0].layer];
            const field = hit ? leadGroup(hit) : undefined;
            return (
              hit?.charts.find((c) => c.field === field && c.kind === "count")
                ?.label ?? "Ангилал"
            );
          })()
        : `${set.layerLabel ?? "Бүс"}ийн тоо`,
      value: num(zones.length),
      unit: "",
    });
    zoneStats.push({
      label: "Дүрсийн тоо",
      value: num(zones.reduce((n, z) => n + z.rows.length, 0)),
      unit: "",
    });
    if (set.splitShapes || (zones.length && zones.every((z) => z.axis))) {
      zoneStats.push({
        label: "Нийт талбай",
        value: num(Math.round(zones.reduce((n, z) => n + z.ha, 0))),
        unit: "га",
      });
      zoneStats.push({
        label: "Давхцаж буй нэгж талбар",
        value: zones.some((z) => z.parcels == null)
          ? "…"
          : num(zones.reduce((n, z) => n + (z.parcels ?? 0), 0)),
        unit: "",
      });
    }
  }

  /*
    ⚠⚠ БҮСИЙН ХУУДАС — ХАРЬЦУУЛАХ ХҮСНЭГТ, БҮЛЭГ (хэрэглэгч 2026-10-23:
    "chartiig n ynzlah sanaa" → "uurchluud uzdee"). Хамгаалалтын бүс, голын
    татам нэг цэст нийлэхэд Тоймын доор долоон хэсэг цуварч харьцуулахад
    хэцүү байв. Одоо: Тойм → ХАРЬЦУУЛАЛТ (бүс бүр нэг мөр: талбай · давхцах
    нэгж талбар · км² тутамд) → бүлэг тус бүрийн хэсгүүд, анхдагчаар
    ХУРААГДСАН. Хүснэгтийн мөр дарахад тэр хэсэг нээгдэж, гүйлгэгдэж,
    газрын зураг тэр бүсээр шүүгдэнэ/ойртоно (хэсгийн толгойн `MapPin`-тэй
    ижил үйлдэл).
    ⚠ Нягтрал нь байгаа хоёр тооноос (нэгж талбар ÷ км²) — шинэ мэдээлэл
    биш. Хуваасан бүлгийн (сав газрууд давхцахгүй) нийлбэр бүлгийн мөрөнд;
    хамгаалалтын бүсүүд бие биеэ агуулдаг тул тэнд нийлбэр ГАРАХГҮЙ.
  */
  const zoneHead = (z: (typeof zones)[number]) => {
    const base = uidBase(z.layer);
    /* Дүрс сонгох бүс: дүрсийн бүс, эсвэл ганц дүрстэй давхарга */
    const uid =
      z.shape != null
        ? base + z.shape
        : !z.axis && z.rows.length === 1
          ? base + Number(z.rows[0].key)
          : null;
    const axis = z.axis;
    const key = z.key;
    const active =
      uid != null
        ? picked === uid
        : axis && key
          ? (filters[z.layer]?.[axis] ?? []).includes(key)
          : false;
    const onHead =
      uid != null
        ? () => {
            setPicked(active ? null : uid);
            setRowPick(active ? null : uid);
            setParcelPick(null);
          }
        : axis && key
          ? () => {
              pickOnly(z.layer, [[axis, key]]);
              setParcelPick(null);
            }
          : undefined;
    return { active, onHead };
  };
  const zoneAnchor = (id: string) =>
    `zone-${set.key}-${zones.findIndex((z) => z.id === id)}`;
  const zoneGroups: {
    key: string;
    label: string;
    split: boolean;
    zones: typeof zones;
  }[] = [];
  for (const z of zones) {
    const split = Boolean(z.axis);
    const key = split ? z.layer : "\u0000whole";
    let g = zoneGroups.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        label: split
          ? (loaded[z.layer]?.info.name ?? z.layer)
          : (set.zoneGroup ?? set.layerLabel ?? "Бүс"),
        split,
        zones: [],
      };
      zoneGroups.push(g);
    }
    g.zones.push(z);
  }
  const density = (z: { ha: number; parcels?: number }) =>
    z.parcels == null || z.ha <= 0 ? null : z.parcels / (z.ha / 100);
  const densityText = (d: number | null) =>
    d == null ? "…" : d >= 10 ? num(Math.round(d)) : num(d, 1);
  const densest = Math.max(0, ...zones.map((z) => density(z) ?? 0));
  const compareCols = "minmax(0,1fr) 5.5rem 6rem 5rem";
  const zoneCompare =
    zoneMode && set.sheet && zones.length > 1 ? (
      <SheetSection title="Харьцуулалт" meta={`${num(zones.length)} бүс`}>
        <div className="flex flex-col">
          <div
            style={{ gridTemplateColumns: compareCols }}
            className="grid gap-2 border-b border-line px-1.5 pb-1 text-[10px] uppercase tracking-[0.06em] text-ink-3"
          >
            <span />
            <span className="text-right">Талбай, га</span>
            <span className="text-right">Нэгж талбар</span>
            <span className="text-right">км² тутамд</span>
          </div>
          {zoneGroups.map((g) => {
            const known = g.zones.every((z) => z.parcels != null);
            return (
              <React.Fragment key={g.key}>
                {zoneGroups.length > 1 ? (
                  <div
                    style={{ gridTemplateColumns: compareCols }}
                    className="grid items-baseline gap-2 px-1.5 pt-2 pb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-2"
                  >
                    <span className="truncate">{g.label}</span>
                    {g.split ? (
                      <>
                        <span className="num text-right normal-case tracking-normal">
                          {num(Math.round(g.zones.reduce((n, z) => n + z.ha, 0)))}
                        </span>
                        <span className="num text-right normal-case tracking-normal">
                          {known
                            ? num(g.zones.reduce((n, z) => n + (z.parcels ?? 0), 0))
                            : "…"}
                        </span>
                        <span />
                      </>
                    ) : null}
                  </div>
                ) : null}
                {g.zones.map((z) => {
                  const { active, onHead } = zoneHead(z);
                  const d = density(z);
                  return (
                    <button
                      key={z.id}
                      type="button"
                      aria-pressed={active}
                      title={z.label}
                      onClick={() => {
                        setZoneOpen((o) => (o.includes(z.id) ? o : [...o, z.id]));
                        if (onHead && !active) onHead();
                        const at = zoneAnchor(z.id);
                        requestAnimationFrame(() =>
                          document
                            .getElementById(at)
                            ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
                        );
                      }}
                      style={{ gridTemplateColumns: compareCols }}
                      className={cn(
                        "grid w-full items-center gap-2 rounded-xs px-1.5 py-[5px] text-left text-[12px] transition-colors hover:bg-paper-hi",
                        active && "bg-paper-hi",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-[1px]"
                          style={{ background: z.tone }}
                        />
                        <span className="truncate text-ink">{z.label}</span>
                      </span>
                      <span className="num text-right text-ink">
                        {num(Math.round(z.ha))}
                      </span>
                      <span className="num text-right text-ink-2">
                        {z.parcels == null ? "…" : num(z.parcels)}
                      </span>
                      <span
                        className={cn(
                          "num text-right",
                          d != null && d === densest && densest > 0
                            ? "font-semibold text-ink"
                            : "text-ink-2",
                        )}
                      >
                        {densityText(d)}
                      </span>
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </SheetSection>
    ) : null;

  const zoneCard = !zoneMode ? null : set.sheet ? (
    <React.Fragment key="zones">
      <SheetSection title="Тойм">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {zoneStats.map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="num text-[18px] font-semibold leading-tight text-ink">
                {s.value}
                {s.unit ? (
                  <span className="ml-1 text-[11px] font-normal text-ink-3">
                    {s.unit}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-3">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </SheetSection>
      {zoneCompare}
      {/* Бүс бүр өөрийн хэсэг ({@link ZoneSheet}) — бүлгээрээ, анхдагчаар
          хураагдсан; харьцуулах хүснэгтийн мөр дарахад нээгдэнэ */}
      {zoneGroups.map((g) => (
        <React.Fragment key={g.key}>
          {zoneGroups.length > 1 ? (
            <p className="eyebrow mt-1 flex items-baseline justify-between gap-2 px-1">
              <span>{g.label}</span>
              <span className="num normal-case tracking-normal">
                {num(g.zones.length)}
              </span>
            </p>
          ) : null}
          {g.zones.map((z) => {
            const { active, onHead } = zoneHead(z);
            const base = uidBase(z.layer);
            /* Зураг дээр сонгосон дүрсийн бүс ӨӨРӨӨ нээгдэнэ */
            const holds =
              picked != null &&
              z.rows.some((r) => base + Number(r.key) === picked);
            /* Ганц бүстэй цэс хоосон харагдахгүй — тэнд анхдагчаар нээлттэй */
            const open =
              zones.length === 1
                ? !zoneOpen.includes(z.id)
                : zoneOpen.includes(z.id) || active || holds;
            return (
              <ZoneSheet
                key={z.id}
                zone={z}
                active={active}
                onHead={onHead}
                open={open}
                onToggle={() =>
                  setZoneOpen((o) =>
                    o.includes(z.id) ? o.filter((x) => x !== z.id) : [...o, z.id],
                  )
                }
                anchor={zoneAnchor(z.id)}
                shapes={
                  z.shape == null && !z.axis && z.rows.length > 1 ? (
                    <ZoneShapes
                      rows={z.rows}
                      tone={z.tone}
                      base={base}
                      picked={picked}
                      onPick={(id) => {
                        setPicked(id);
                        setRowPick(id);
                      }}
                    />
                  ) : undefined
                }
                pickedId={parcelPick?.id ?? null}
                pickInfo={
                  parcelPick
                    ? {
                        busy: !shownPick,
                        count: shownPick ? shownPick.data.features.length : null,
                        capped: Boolean(shownPick?.capped),
                      }
                    : null
                }
                onPick={setParcelPick}
              />
            );
          })}
        </React.Fragment>
      ))}
    </React.Fragment>
  ) : (
    <CutCard
      key="zones"
      title={set.title ?? "Давхаргаар"}
      tone={zones[0].tone}
      first
      meta={`${num(Math.round(zones.reduce((n, z) => n + z.ha, 0)))} га`}
      weight={Math.max(4, zones.length * 2)}
      /* Цэсийн тойм — доорх нэгж талбарын карттай өндөр хуваалцаж
           тасрахгүй (хэрэглэгч, 2026-10-06: "бүтэн харагддаг болго") */
      full
      action={zoneAction}
    >
      {zoneList}
    </CutCard>
  );

  const chartCards = (
    keep: (id: string, b: Breakdown) => boolean,
    /** Талбайн карт энэ баганад харьяалагдах эсэх */
    withArea: (id: string) => boolean = () => false,
    /**
     * Хөндлөн хүснэгт энэ баганад гарах эсэх.
     *
     * ⚠ `withArea`-ЭЭС ТУСДАА: тэр нь ЗӨВХӨН талбайн картыг зөөдөг
     * (`split` түүнийг зүүн тийш гаргаж болно). Хоёуланг нэг тугаар
     * барьвал хуваалт хийгдсэн давхаргын хүснэгт зүүн баганад
     * хуулбарлагдаж, баруунаасаа алга болно.
     */
    withCross = false,
  ) =>
    views.map(({ id, hit, charts, rows, oids, passes, listPasses }) => {
      /* ЗӨВХӨН ЗУРАГТ гарах давхарга ({@link LayerSet.mapOnly},
         {@link LayerSet.mapPicker}) */
      /* Заасан талбартай давхарга ({@link LayerSet.charts}) зурагт
         харьяалагдсан ч диаграмаа гаргана */
      if ((set.mapOnly?.includes(id) || mapIds.includes(id)) && !set.charts?.[id]) return null;
      /* Бүсийн карт дүрсүүдийг өөрөө задалдаг ({@link LayerSet.zonesOnly}) */
      if (set.zonesOnly && zoneMode) return null;
      const tone = toneOf(id);
      /* Задаргаа БҮГД энд: цуваа, харьцуулалт хоёрыг зургийн
         доод зурваст тавьж байсныг хэрэглэгч буцаав (2026-09-15)
         — гурван нэгжийн харьцуулалт тэнд хажуу тийшээ гүйж,
         бүгдийг нь зэрэг харах боломжгүй байв. Нэг баганад
         босоо цуварсан нь бүгдийг нь нэг чиглэлд гүйлгэж
         үзэхэд хялбар. */
      /*
        Хуваалтын дагуу зөвхөн энэ баганад харьяалагдах диаграм.

        ⚠ Бүртгэлийн тэргүүлэх талбарууд (`LayerSet.lead`) ЖАГСААСАН
        дарааллаараа эхэнд эгнэнэ; бусад нь өөрсдийн оноогоор
        эрэмбэлэгдсэн хэвээр (`sort` нь тогтвортой).
      */
      /* Талбарын нэр ЭСВЭЛ харагдах нэрээр (`label`) — талбарын нэр нь
         токенгүйгээр шалгагдаагүй давхаргад (Хөв, цөөрөм, далан) нэрээр нь
         заана (хэрэглэгч, 2026-10-22: "ene 2-iin bairiig soliy") */
      const leadAt = (b: Breakdown) => {
        const lead = set.lead ?? [];
        let at = lead.indexOf(b.field);
        if (at < 0) {
          const name = b.label.trim().toLowerCase();
          at = lead.findIndex((x) => x.trim().toLowerCase() === name);
        }
        return at < 0 ? Number.MAX_SAFE_INTEGER : at;
      };
      const cuts = charts
        .filter((b) => keep(id, b) && !droppedCompare(set, b))
        .sort((a, b) => leadAt(a) - leadAt(b));
      /*
        `sumBy`-ийн карт ("Нийт мод · Дүүрэг") ижил ангиллын ХАРЬЦУУЛАХ
        картын ("Дүүрэг" — зүлэг, цэцэг, талбай) ДАРАА (хэрэглэгч,
        2026-10-06: "Дүүрэг, Нийт мод · Дүүрэг байрыг соли"). Зөвхөн тэр
        хоёр байраа солино — бусад картын дараалал хэвээр.
      */
      if (set.sumBy) {
        const t = cuts.findIndex((b) => b.kind === "sum" && b.measure != null && set.sumBy!.measure.test(b.measure));
        const c = t < 0 ? -1 : cuts.findIndex((b) => b.kind === "compare" && b.field === cuts[t].field);
        if (t >= 0 && c > t) {
          const [tree] = cuts.splice(t, 1);
          cuts.splice(c, 0, tree);
        }
      }
      const sel = filters[id] ?? {};

      /*
        ⚠⚠ ДҮҮРЭГ + ХОРОО НЭГ КАРТАД — "Байршлын мэдээлэл" (хэрэглэгч,
        2026-10-05: "дүүрэг, хороо хоёрын чартыг нийлүүл"). Хүрээлэн
        буй орчны хэлтсийн ариун цэврийн самбарынхтай НЭГ бүтэц
        (`GroupedRowChart locationDetail`): дүүрэг бүр бүлэг, доторх
        хороод нь мөр. Хоёр тусдаа зурвас нь "аль дүүргийн аль хороо"
        гэдгийг хэлдэггүй — хороо нь дүүрэг дотроо л утгатай.
        ⚠ Зөвхөн энэ хэлтэст (`environment`), хоёулаа тоолол үед.
        Бүлгийг мөрөөс шууд угсарна (`keyOf`) — хоёр талбарыг хоёуланг
        нь алгасаж шүүгдэнэ (cross-filter).
        ⚠⚠ ОЛОН УТГАТ НҮД ЗӨВШӨӨРӨГДӨНӨ (2026-10-06): урьд нь `!multi`
        нөхцөлтэй байсан тул эх сурвалж дүүргийг "Баянзүрх, Налайх" гэж
        бичсэн ганц мөр ч байвал нийлүүлэлт ЧИМЭЭГҮЙ унтарч, хоёр карт
        тусдаа үлддэг байв (үерийн эрсдэлтэй цэг). Хоёр талын утгын тоо
        тэнцүү бол дараалаар нь хосолно, эс бөгөөс бүх хослол.
      */
      const placeCut = (b: Breakdown, re: RegExp) =>
        b.kind === "count" && re.test(b.label);
      const dCut = environment ? cuts.find((b) => placeCut(b, /дүүрэг/i)) : undefined;
      const kCut = dCut ? cuts.find((b) => placeCut(b, /хороо/i)) : undefined;
      let placeGroups: DatumGroup[] = [];
      if (dCut && kCut) {
        const skip = [filterKey(dCut), filterKey(kCut)];
        const dLabel = new Map(dCut.values.map((d) => [d.key, d.label]));
        const kLabel = new Map(kCut.values.map((d) => [d.key, d.label]));
        const acc = new Map<string, Map<string, number>>();
        for (const row of Object.values(hit.data.rows)) {
          if (!passes(row, skip)) continue;
          const dks = dCut.keyOf(row);
          const kks = kCut.keyOf(row);
          if (!dks.length || !kks.length) continue;
          const pairs: [string, string][] =
            dks.length === kks.length
              ? dks.map((dk, i) => [dk, kks[i]])
              : dks.flatMap((dk) => kks.map((kk): [string, string] => [dk, kk]));
          for (const [dk, kk] of pairs) {
            const m = acc.get(dk) ?? new Map<string, number>();
            m.set(kk, (m.get(kk) ?? 0) + 1);
            acc.set(dk, m);
          }
        }
        /* "Бүртгэгдээгүй" нь ҮРГЭЛЖ ХАМГИЙН ДООР — бүлэг ч, мөр ч
           (хэрэглэгч, 2026-10-06). Тоогоор эрэмбэлбэл бөглөгдөөгүй
           утга хамгийн их тул эхэнд гарч, бодит дүүрэг, хороог доош
           түлхэж байв. */
        const blank = (k: string) => (k === "Бүртгэгдээгүй" ? 1 : 0);
        placeGroups = [...acc]
          .map(([dk, m]) => {
            const list = [...m]
              .map(([kk, n]) => ({ key: kk, label: kLabel.get(kk) ?? kk, value: n }))
              .sort((a, b) => blank(a.key) - blank(b.key) || b.value - a.value);
            return {
              key: dk,
              label: dLabel.get(dk) ?? dk,
              total: list.reduce((t, d) => t + d.value, 0),
              rows: list,
            };
          })
          .sort((a, b) => blank(a.key) - blank(b.key) || b.total - a.total);
      }

      /*
        Давхаргын ТУУЗ — картуудынхаа дээр.

        Урьд нь давхаргын нэрийг эхний картын толгойд бичдэг
        байсан тул үлдсэн картууд нь зүүн талаасаа хоосон,
        гарчиг нь баруун тийш дүүжлэгдсэн харагддаг байв. Тууз
        нь бүлгийг нэг дор зарлаж, карт бүрийн толгой өөрийн
        диаграмын нэрээр л эхэлнэ.

        ⚠⚠ ГАНЦ ДАВХАРГАТАЙ ҮЕД ТУУЗ ГАРАХГҮЙ (хэрэглэгчийн шийдвэр,
        2026-09-29: "Аюултай хог хаягдал гэсэн баруун зүүн панелийн
        дээр байгааг делет"). Түүний ЦОРЫН ГАНЦ үүрэг нь "энэ карт
        АЛЬ давхаргынх вэ" гэдгийг хэлэх — давхарга ганц байхад тэр
        асуулт байхгүй бөгөөд нэр нь дээр нь шүүлтүүрийн мөрөнд аль
        хэдийн бичигдсэн байдаг (харилцан үгүйсгэх товч, эсвэл
        `LayerSet.title`). Хоёр баганын толгойд давтагдаж, бүртгэлийн
        тоог үзүүлэлтийн зурваснаас дахин хэлж байв.

        ⚠ ХОЁР БА ТҮҮНЭЭС ОЛОН давхарга асаалттай үед ХЭВЭЭР: ойн
        хэлтэст долоон давхарга нэг баганад цувардаг тул аль карт
        алийнх нь тэндээс л уншигдана.
      */
      /*
        ⚠ ТУУЗ нь ДООРХ картдаа наалдана (2026-09-29, "зайг
        цэгцлэе"). Баганын `gap` нь 10px тул `pt-1 pb-0.5` үед
        дээр 14px, доор 12px болж тууз хоёр картын ДУНД хөвж,
        аль бүлгийг зарлаж буй нь эргэлзээтэй байв. Одоо `pt-1
        -mb-1.5` — дээр 12px, доор 2px: хамаарал зайнаасаа уншигдана.
      */
      /* ⚠ Зөвхөн ДИАГРАМ гаргадаг давхаргыг тоолно: зурагт л
         харьяалагдах давхарга (`mapOnly`) баганад карт гаргадаггүй тул
         түүнийг тоолбол диаграмтай ГАНЦ давхарга байхад ч тууз гарч
         байв (хэрэглэгч, 2026-10-06: "Үерийн эрсдэлтэй цэг del" —
         баруун баганын дээрх тэр туузыг заасан) */
      const band =
        views.filter((v) => !set.mapOnly?.includes(v.id) || set.charts?.[v.id]).length < 2 ? null : (
          <div
            key={`${id}:band`}
            className="-mb-1.5 flex shrink-0 items-center gap-2 pt-1"
          >
            <span
              aria-hidden
              className="h-3 w-[3px] shrink-0 rounded-[1px]"
              style={{ background: tone }}
            />
            <span className="eyebrow min-w-0 flex-1 truncate text-ink-2">
              {hit.info.name}
            </span>
            <span className="num shrink-0 text-[10.5px] text-ink-3">
              {num(rows.length)}
            </span>
          </div>
        );

      /* Задаргаа гарахгүй давхарга баганад ОРОХГҮЙ — хоосон
         карт ч, бичлэгийн жагсаалт ч зай эзлэхээс өөр юу ч
         хэлэхгүй (хэрэглэгчийн шийдвэр, 2026-09-15). Бичлэг
         бүр зурган дээрээ товшигдож, дэлгэрэнгүй нь хөвөгч
         самбарт гарсаар байна */
      /*
        ДҮРС ТУС БҮРИЙН ТАЛБАЙ — давхарга бүр ӨӨРИЙН карттай
        (хэрэглэгч, 2026-09-25: "тэжээгдэл, хязгаарлалт, хориглолт
        гэсэн тус тусад нь чарттай").

        Хамгаалалтын гурван шат нь бараг атрибутгүй (тэжээгдэл — нэг
        дүрс, хориглолт — зөвхөн дугаар ба талбай) тул `breakdowns`
        нэг ч задаргаа олдоггүй бөгөөд баруун багана хоосон үлддэг
        байв. Гэтэл талбай нь БАЙНА: "энэ бүс дотор ямар дүрс хэр том
        вэ" гэдэг нь бодит, зохиомол бус хариулт.

        ⚠ Зөвхөн БАРУУН баганад (`withArea`) — зүүн тал нь хамгийн урт
        задаргааг зөөх зориулалттай.
        ⚠ Хураалт: хорин дүрсээр таслаад гарчигтаа ил хэлнэ — дутуу
        жагсаалтыг бүтэн мэт харуулбал диаграм өөрөө худал хэлнэ.
        ⚠ Өнгө ГАНЦ (давхаргынхаа өнгө): нэг картын доторх дүрсүүд нь
        эрэмбэтэй ангилал БИШ, ялгаа нь уртаараа гарна.
      */
      /*
        ХӨНДЛӨН ХҮСНЭГТ нь давхаргын ЭХНИЙ карт — тойм нь задаргаанаас
        ӨМНӨ. Зөвхөн БАРУУН баганад (зүүн тал нь хамгийн урт
        задаргааных) бөгөөд хоёр тэнхлэг нь тэндээ мөн зурвас болж
        давтагдана: хүснэгт нь "хаана хэр олон", зурвас нь "нийтдээ
        хэр олон" гэсэн ӨӨР асуултад хариулна.
      */
      const crossList = withCross ? (crosses.get(id) ?? []) : [];
      const crossCard = crossList.length ? crossList.map((cross, ci) => (
        <CutCard
          key={`${id}:cross:${cross.row.id}`}
          title={`${cross.row.label} × ${cross.col.label}`}
          tone={tone}
          first={ci === 0}
          meta={`${num(rows.length)} ${set.record?.one ?? "бүртгэл"}`}
          weight={Math.max(4, cross.row.values.length + 2)}
          /* Агуулгынхаа өндөртэй — доор нь хоосон зай үлдээхгүй
             (хэрэглэгч, 2026-10-07, намгархаг газрын зургаар) */
          full
        >
          <Matrix
            rows={cross.row.values.map((d): Key => ({
              key: d.key,
              label: d.label,
            }))}
            cols={cross.col.values.map((d): Key => ({
              key: d.key,
              label: d.label,
            }))}
            cell={(r, c) => cross.cell.get(`${r}\u0000${c}`) ?? 0}
            colTotals={
              cross.colTotal ? (c) => cross.colTotal?.get(c) ?? 0 : undefined
            }
            total={cross.total}
            rowSel={(filters[id]?.[filterKey(cross.row)] ?? [])[0] ?? null}
            colSel={(filters[id]?.[filterKey(cross.col)] ?? [])[0] ?? null}
            onRow={(k) =>
              k == null
                ? pick(id, filterKey(cross.row), null)
                : pickOnly(id, [[filterKey(cross.row), k]])
            }
            onCol={(k) =>
              k == null
                ? pick(id, filterKey(cross.col), null)
                : pickOnly(id, [[filterKey(cross.col), k]])
            }
            onCell={(r, c) =>
              pickOnly(id, [
                [filterKey(cross.row), r],
                [filterKey(cross.col), c],
              ])
            }
          />
        </CutCard>
      )) : null;

      /*
        ⚠⚠ ДАВХАРДАХГҮЙ (хэрэглэгч, 2026-09-25, зургаар: хязгаарлалтын
        бүсийн ТАВАН эх үүсвэр хоёр картад дараалан гарч байв).
        Эх сурвалжид нэрийн багана байвал хөдөлгүүр аль хэдийн
        "Талбай, га — Эх үүсвэрийн нэр" гэсэн карт гаргадаг бөгөөд тэр
        нь ЯГ ИЖИЛ мөрүүдийг ИЛҮҮ САЙН нэрлэж харуулна. Дүрс тус
        бүрийн карт нь зөвхөн нэргүй давхаргад (хориглолтын бүс —
        зөвхөн дугаар) хэрэгтэй.
      */
      const namedArea = charts.some(
        (b2) =>
          (b2.kind === "sum" || b2.kind === "mean") &&
          b2.measure != null &&
          hit.info.areaField != null &&
          b2.field === hit.labels.name,
      );
      /* Бүртгэл картыг бүрмөсөн ({@link LayerSet.shapeAreas}), эсвэл
         давхарга тус бүрээр ({@link LayerSet.noShapeArea} — мянга мянган
         нэргүй полигонд дугаарын жагсаалт болдог) хааж болно.
         "Талбай, га — дүрс тус бүрээр" карт үнэлгээний хэлтэст ГАРАХГҮЙ
         (хэрэглэгч, 2026-10-06: "del") — бусад хэлтэст хэвээр */
      const areas =
        withArea(id) &&
        !namedArea &&
        !environment &&
        set.shapeAreas !== false &&
        !set.noShapeArea?.includes(id)
          ? areaRowsOf(hit, oids)
          : [];
      /*
        ⚠⚠ ГАНЦ ДҮРСТЭЙ ДАВХАРГЫН КАРТ нь БҮСИЙН КАРТТАЙ ЦЭСЭД
        ДАВХАРДАЛ (2026-09-29, хэрэглэгч: "чартуудыг scroll-дох
        шаардлагагүй шууд хардаг болгоё"). Тэжээгдлийн мужийн карт
        нь "32,082 га" гэсэн ГАНЦ тоо харуулдаг бөгөөд тэр тоо
        бүсийн картын эхний мөрөнд ("Тэжээгдлийн муж · 32,082 га ·
        11,422 нэгж талбар") аль хэдийн бичигдсэн байдаг. Карт нь
        тууз, гарчиг, зайтайгаа **112px** эзэлдэг тул доорх бодит
        диаграмуудыг дэлгэцээс түлхэж байв.
        ⚠ Санхүү, бүсийн зурвастай нэг дүрэм: НЭГ ТООГ ХОЁР ГАЗАР
        БИЧИХГҮЙ.
        ⚠ ЗӨВХӨН бүсийн карт БАЙГАА үед: нэг давхаргатай цэсэд тэр
        тоо өөр хаана ч гарахгүй тул карт нь хэвээр.
      */
      const soloDup = areas.length === 1 && zoneMode;
      const shortNames = areas.every((d) => d.label.length <= 12);
      const base = uidBase(id);
      const areaCard =
        areas.length && !soloDup ? (
          <CutCard
            key={`${id}:area`}
            title={
              areas.length > AREA_TOP
                ? `Талбай, га — дүрс тус бүрээр (эхний ${AREA_TOP})`
                : "Талбай, га — дүрс тус бүрээр"
            }
            tone={tone}
            first={!cuts.length && !crossCard}
            meta={`${num(Math.round(areas.reduce((n, d) => n + d.value, 0)))} га · ${num(areas.length)} дүрс`}
            /* Ганц мөр нь ердөө нэг тоо — түүнд бусад картын өндөр
             хэрэггүй; үлдсэн зай нь урт диаграмд очно */
            weight={
              areas.length === 1
                ? 1
                : Math.max(3, Math.min(areas.length, AREA_TOP))
            }
          >
            {areas.length === 1 ? (
              /* Ганц дүрсийг өөртэй нь харьцуулах зүйл байхгүй тул
               зурвас БИШ, тоогоороо шууд хэлнэ */
              <p className="num px-0.5 py-1 text-[13px] text-ink">
                {num(Math.round(areas[0].value))} га
              </p>
            ) : (
              <RowChart
                data={areas.slice(0, AREA_TOP)}
                tone={tone}
                format={(v) => num(Math.round(v))}
                /* Нэг эгнээний мөр нь нэрийн 92px баганатай — зөвхөн
                   "№ 12" мэт богино танигчид. Байршлын нэр
                   ({@link LayerSet.placeNames}) тэнд тасрах тул нэр нь
                   зурвасын ДЭЭР бүтэн өргөнөөр гарна */
                inline={shortNames}
                dense={!shortNames}
                clamp={!shortNames}
                selected={
                  picked != null && picked >= base && picked < base + STRIDE
                    ? String(picked - base)
                    : null
                }
                onSelect={(k) => {
                  const uid = k == null ? null : base + Number(k);
                  setPicked(uid);
                  setRowPick(uid);
                }}
                /* Хураасан үед хувь ГАРАХГҮЙ: харагдаж буй мөрүүд
                 бүхлийг хамраагүй тул "хэдэн хувь" гэдэг худал болно */
                share={false}
              />
            )}
          </CutCard>
        ) : null;

      if (!cuts.length && !areaCard && !crossCard) return null;

      /* Хуудасны харагдац ({@link LayerSet.sheet}) — хүснэгт, картын оронд */
      if (set.sheet) {
        const cf = colorField(id);
        const cb = cf
          ? charts.find((c) => c.field === cf && c.kind === "count")
          : undefined;
        return (
          <React.Fragment key={id}>
            {/*
              ⚠ ХАРИЛЦАН ҮГҮЙСГЭХ ДАВХАРГЫН СЭЛГЭГЧ ХУУДАСНЫ ДЭЭД ТАЛД
              (хэрэглэгч, 2026-10-22: "ter 3iig switch hiihiig ene deer
              hiiy" — Ус ашиглалтын Гэрээ · Зөвшөөрөл · Дүгнэлт). Шүүлтүүрийн
              мөрөөс энд шилжсэн: хуудас нь сонгосон баримт бичгийнх тул
              сэлгэгч нь Тоймын яг дээр уншигдана. Шинжилгээ нуусан үед
              шүүлтүүрийн мөрөнд буцна.
            */}
            {set.exclusive ? (
              <div
                className="grid shrink-0 gap-1"
                style={{ gridTemplateColumns: `repeat(${set.layers.length}, minmax(0, 1fr))` }}
                role="group"
                aria-label="Давхарга"
              >
                {set.layers.map((lid) => {
                  const isOn = on.includes(lid);
                  return (
                    <button
                      key={lid}
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => (isOn ? undefined : toggle(lid))}
                      className={cn(
                        "flex min-w-0 items-center justify-center gap-1.5 rounded-xs border px-2 py-1.5 text-[12px] transition-colors",
                        isOn
                          ? "border-data/45 bg-data/12 font-semibold text-ink"
                          : "border-line bg-paper-2 text-ink-2 hover:border-line-2 hover:text-ink",
                      )}
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: toneOf(lid) }}
                      />
                      <span className="truncate">
                        {set.names[lid] ?? infos[lid]?.name ?? lid}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              band
            )}
            <SheetPanel
              cuts={cuts}
              tone={tone}
              records={rows.length}
              word={set.record}
              colors={palettes[id]?.colors}
              colorAxis={cb ? filterKey(cb) : null}
              selectedOf={(axis) => (sel[axis] ?? [])[0] ?? null}
              onPick={(axis, key) =>
                key == null ? pick(id, axis, null) : pickOnly(id, [[axis, key]])
              }
              rowsSkipping={(skip) =>
                Object.values(hit.data.rows).filter((r) => passes(r, skip))
              }
              onPickAdmin={(dAxis, kAxis, d, k) => {
                setFilters((f) => {
                  const layer = { ...(f[id] ?? {}) };
                  if (d == null) delete layer[dAxis];
                  else layer[dAxis] = [d];
                  if (k == null) delete layer[kAxis];
                  else layer[kAxis] = [k];
                  return Object.keys(layer).length
                    ? { ...f, [id]: layer }
                    : Object.fromEntries(Object.entries(f).filter(([x]) => x !== id));
                });
                setPicked(null);
              }}
            />
          </React.Fragment>
        );
      }

      /*
        ⚠⚠ **ДАВХАРГЫН БҮХ ЗАДАРГАА НЭГ КАРТАД** ({@link AxisCard}).
        Тэнхлэг бүр өөрийн карттай байсан тул нэг давхаргын мэдээлэл
        багана даяар тарж, хооронд нь харьцуулах гэвэл дээш доош гүйх
        хэрэгтэй байв. Одоо нэг карт, дотор нь тэнхлэг сэлгэгч.
        ⚠ Бүлэглэлт нь ШҮҮЛТИЙН ТҮЛХҮҮРЭЭР (`filterKey`), талбарын
        нэрээр БИШ: огнооны талбар он ба сар гэсэн ХОЁР ӨӨР дүрэмтэй
        диаграм төрүүлдэг.
        ⚠ ХУГАЦАА ба ХУРААСАН (`top`) диаграм ОРОХГҮЙ: эхнийх нь
        тасралтгүй тэнхлэгтэй, хоёр дахийнх нь мөрүүд бусадтайгаа
        зөрнө — тэд өөрсдийн карттай хэвээр.
        ⚠ ГАНЦ тэнхлэг, ГАНЦ диаграмтай бол хүснэгт болгохгүй: нэг
        баганат хүснэгт нь зурвасаас юу ч илүү хэлэхгүй.
      */
      const axes: { key: string; label: string; list: Breakdown[] }[] = [];
      /* Нэрийн тэнхлэг — `nameApart` үед нэгдсэн картаас ГАДУУР, түүний
         доор өөрийн картаар ({@link LayerSet.nameApart}) */
      const named: Breakdown[] = [];
      /*
        ⚠⚠ ХӨНДЛӨН ХҮСНЭГТИЙН ТЭНХЛЭГ ДАВТАГДАХГҮЙ (хэрэглэгч, 2026-10-07,
        намгархаг газрын зургаар: "сайжруулъя"). "Ангилал × Дүүрэг"
        хүснэгтийн "Нийт" мөр дүүрэг бүрийн тоог аль хэдийн хэлдэг атлаа
        доорх хүснэгтийн "Дүүрэг" тэнхлэг 21 · 18 · 14 · 7 · 1-ийг ЯГ
        ДАВТАЖ байв. Хүснэгтийн хоёр тэнхлэгийн ТООЛЛЫН диаграм нэгдсэн
        картаас (ба тусдаа картаас) хасагдана.
        ⚠ ЗӨВХӨН тоолол: тэр тэнхлэгээр задарсан ХЭМЖИЛТ (жишээ нь
        дүүргээр талбай) хүснэгтэд байхгүй тул үлдэнэ.
      */
      const crossKeys = crossList.length
        ? new Set(crossList.flatMap((c) => [filterKey(c.row), filterKey(c.col)]))
        : null;
      const crossed = (b: Breakdown) =>
        !!crossKeys &&
        b.kind === "count" &&
        !b.top &&
        crossKeys.has(filterKey(b));
      const apart = (b: Breakdown) =>
        !!set.nameApart && !!hit.labels.name && b.field === hit.labels.name;
      if (set.tidy)
        for (const b of cuts) {
          /* ⚠ ХУРААСАН (`top`) диаграм ХАСАГДАХГҮЙ: тэр нь ӨӨРИЙН
             тэнхлэг болж сэлгэгчид орно — мөрүүд нь зөвхөн НЭГ
             тэнхлэгийн ДОТОР таарах шаардлагатай. Хугацаа нь харин
             тасралтгүй тэнхлэгтэй тул хүснэгтэд таарахгүй. */
          if (isTime(b)) continue;
          /* ⚠⚠ ХАРЬЦУУЛАЛТ (`compare`) ОРОХГҮЙ (2026-10-06): хүснэгт нь
             диаграм бүрээс НЭГ багана авдаг тул олон оны цуваанаас
             зөвхөн ЭХНИЙ он үлдэж, нэгжийн нэр баганын гарчиг болно —
             ойн төлбөрийн "2023 · 2024" харьцуулалт ингэж алга болох
             байв. Бүлэглэсэн багана өөрийн карттай хэвээр. */
          if (b.kind === "compare") continue;
          if (crossed(b)) continue;
          if (apart(b)) {
            named.push(b);
            continue;
          }
          const k = filterKey(b);
          const at = axes.find((a) => a.key === k);
          if (at) at.list.push(b);
          else axes.push({ key: k, label: b.label, list: [b] });
        }
      /* Тэнхлэг бүр ТУСДАА карт ({@link LayerSet.unfold}) — сэлгэгчгүй */
      const oneCard =
        Boolean(set.unfold) ||
        axes.length > 1 ||
        (axes.length === 1 && axes[0].list.length > 1);
      const inAxis = new Set(
        oneCard ? axes.flatMap((a) => a.list.map((b) => b.id)) : [],
      );
      /*
        ДҮҮРГЭЭР — тусдаа карт ({@link LayerSet.districts}; хэрэглэгч
        2026-10-07, ойн хэсэглэл: "хоосон зайд юу хийх вэ" → "Дүүргээр").
        Ялгарал нь сэлгэгчтэй (`shareChart`) тул энд ОРОХГҮЙ. Дүүрэг нь
        хилээс ТООЦООЛСОН, хэсгүүд нь газрын зургийг будаж буй талбарын
        ангиллууд (өнгө нь зургийнх); мөр дарахад шүүнэ.
      */
      const distB =
        set.districts?.includes(id) && !set.shareChart?.includes(id)
          ? charts.find((c) => c.field === colorField(id) && c.kind === "count")
          : undefined;
      const distData = distB
        ? districtRows(id, hit, distB, passes, (k) => palettes[id]?.colors.get(k) ?? tone)
        : null;
      const districtCard =
        distB && distData ? (
          <CutCard
            key={`${id}:district`}
            title="Дүүргээр — талбай, га"
            tone={tone}
            fill
            meta={
              typeof distData === "object"
                ? `${num(Math.round(distData.rows.reduce((n, r) => n + r.ha, 0)))} га · ${num(distData.rows.length)} дүүрэг`
                : undefined
            }
          >
            {distData === "loading" ? (
              <p className="px-1 py-3 text-[12px] text-ink-3">
                Дүүргийг тооцоолж байна.
              </p>
            ) : distData === "failed" ? (
              <p className="px-1 py-3 text-[12px] text-clay">
                Дүүргийн хил уншигдсангүй.
              </p>
            ) : (
              <DistrictBars
                rows={distData.rows}
                parts={distData.parts}
                unit="га"
                selected={sel[DISTRICT_KEY]?.[0] ?? null}
                onSelect={(n) =>
                  n == null
                    ? pick(id, DISTRICT_KEY, null)
                    : pickOnly(id, [[DISTRICT_KEY, n]])
                }
                chosen={sel[filterKey(distB)] ?? []}
                onPart={(keys) => pickSet(id, filterKey(distB), keys)}
                fill
              />
            )}
          </CutCard>
        ) : null;

      /* Давхарга ГАНЦ карттай бол тэр нь баганаа дүүргэнэ
         ({@link LayerSet.fillSolo}) — хоосон доод талыг үлдээхгүй */
      const solo =
        Boolean(set.fillSolo) &&
        cuts.length === 1 &&
        !crossCard &&
        !areaCard &&
        !districtCard;

      /* Салгасан нэрийн тэнхлэг — нэгдсэн картын ДООР ({@link named}) */
      const nameCard = named.length ? (
        <AxisCard
          key={`${id}:names`}
          dense
          axes={[
            { key: filterKey(named[0]), label: named[0].label, list: named },
          ]}
          tone={tone}
          first={false}
          records={rows.length}
          word={set.record}
          selectedOf={(axis) => (sel[axis] ?? [])[0] ?? null}
          onPick={(axis, key) =>
            key == null ? pick(id, axis, null) : pickOnly(id, [[axis, key]])
          }
        />
      ) : null;

      /* Туузан дор наалдах ЭХНИЙ карт — салгасан нэрийн тэнхлэгийг
         алгасна, тэр нь доор зурагддаг */
      const leadId = cuts.find((b) => !named.includes(b))?.id;
      const cards = cuts.map((b) => {
        if (named.includes(b)) return null;
        if (set.tidy && crossed(b)) return null;
        if (kCut && b.id === kCut.id && placeGroups.length) return null;
        if (dCut && kCut && b.id === dCut.id && placeGroups.length) {
          return (
            <CutCard
              key={`${id}:place`}
              title="Байршлын мэдээлэл"
              tone={tone}
              first={b.id === leadId && !crossCard}
              weight={Math.max(cardWeight(dCut), cardWeight(kCut))}
            >
              <GroupedRowChart
                locationDetail
                groups={placeGroups}
                tone={tone}
                selected={sel[filterKey(kCut)] ?? null}
                onSelect={(k) => pick(id, filterKey(kCut), k)}
                selectedGroup={sel[filterKey(dCut)] ?? null}
                onSelectGroup={(k) => pick(id, filterKey(dCut), k)}
                defaultOpen="first"
                storageKey={`layers.${set.key}.${id}.place`}
              />
            </CutCard>
          );
        }
        if (inAxis.has(b.id) && set.unfold) {
          /*
            ⚠⚠ ТЭНХЛЭГ БҮР ӨӨРИЙН КАРТТАЙ ({@link LayerSet.unfold};
            хэрэглэгч, 2026-10-07, гүний худгийн паспорт: "бүх мэдээлэл
            ойлгомжтой харагдах чартууд"). Сэлгэгчийн ард нуугдсан
            тэнхлэг (гүйцэтгэгч компани) хаана ч харагддаггүй байв.
            Карт бүр ижил зурвасын хэлбэр — тэнхлэгийнхээ эхний гишүүн
            дээр нэг удаа.
          */
          const axis = axes.find((a) => a.list.some((x) => x.id === b.id));
          if (!axis || axis.list[0].id !== b.id) return null;
          return (
            <AxisCard
              key={`${id}:axis:${axis.key}`}
              compact
              /* ХАМГИЙН УРТ тэнхлэг (гүйцэтгэгч, 452 мөр) баганын ҮЛДСЭН
                 өндрийг авч ЗӨВХӨН КАРТ ДОТРОО гүйнэ (хэрэглэгч,
                 2026-10-07: "зөвхөн тэр карт дотроо л scroll-доно шүү").
                 ⚠ `top`-оор таньдаг байсан нь жагсаалт хураагдахаа
                 болимогц унтарч, карт 11,695px болж БАГАНА гүйж байв */
              fill={
                axis.list[0].values.length > 12 &&
                axes.every(
                  (a) => a.list[0].values.length <= axis.list[0].values.length,
                )
              }
              axes={[axis]}
              tone={tone}
              first={b.id === leadId && !crossCard}
              records={rows.length}
              word={set.record}
              bars={set.axisBars}
              selectedOf={(k) => (sel[k] ?? [])[0] ?? null}
              onPick={(k, key) =>
                key == null ? pick(id, k, null) : pickOnly(id, [[k, key]])
              }
            />
          );
        }
        if (inAxis.has(b.id)) {
          /* Эхний гишүүн дээр л нэг удаа зурна */
          if (axes[0].list[0].id !== b.id) return null;
          return (
            <AxisCard
              key={`${id}:axes`}
              /* Нэрийн карт доор нь байвал дүүргийн хүснэгт БҮТЭН
                 үлдэнэ — агших, гүйх нь нэрийн картын ажил (хэрэглэгч,
                 2026-10-06). Дүүргийн карт доор нь байвал мөн адил. */
              full={named.length > 0 || Boolean(districtCard)}
              /* Ойн хэлтэс ганц картаараа баганаа дүүргэнэ
                 ({@link LayerSet.fillSolo}) — зурвасын горимын "агуулгын
                 өндөр" дүрэм түүнийг хумих ёсгүй (ойн сесс, 2026-10-07) */
              stretch={Boolean(set.fillSolo)}
              axes={axes}
              tone={tone}
              first={b.id === leadId && !crossCard}
              records={rows.length}
              word={set.record}
              bars={set.axisBars}
              /* Зөвхөн ТОДОРХОЙ палитртай давхаргад ({@link LayerSet.valueTones})
                 — бусад цэсийн чарт хөндөгдөхгүй */
              paletteOf={(axis) =>
                set.valueTones?.[id] && axis === colorField(id)
                  ? palettes[id]?.colors
                  : undefined
              }
              selectedOf={(axis) => (sel[axis] ?? [])[0] ?? null}
              onPick={(axis, key) =>
                key == null ? pick(id, axis, null) : pickOnly(id, [[axis, key]])
              }
            />
          );
        }
        /* Өнгийг зөвхөн ТООЛЛЫН диаграм жолоодно — нэг талбарын бүх
         диаграм ижил өнгө хуваалцдаг тул товчийг хаа сайгүй
         давтвал аль нь юуг сольж байгаа нь ойлгомжгүй болно */
        const driver = b.kind === "count" && !b.multi;
        const lit = colorField(id) === b.field;
        const palette = lit ? palettes[id]?.colors : undefined;
        /* Энэ талбарын сонгогдсон утга. Нэрийг `on` гэж БҮҮ бич —
           тэр нь энэ файлд "асаалттай давхаргууд" гэсэн утгатай */
        const chosen = sel[filterKey(b)] ?? null;
        /* Талбайн бүтэц + жагсаалт ({@link LayerSet.shareChart}) —
           зөвхөн талбай нь шингэсэн тооллын диаграм дээр */
        const shareArea =
          set.shareChart?.includes(id) &&
          b.kind === "count" &&
          !b.multi &&
          b.notes
            ? b.notes
            : null;
        const onPick = (key: string | null) => pick(id, filterKey(b), key);

        /*
          ⚠⚠ НЭГ ЗАДАРГААГ АГУУЛГААР НЬ ХУВААНА ({@link LayerSet.splits},
          хэрэглэгч 2026-10-06: "ангилал чартыг агуулгаар нь 2 салга").
          Үерийн эрсдэлтэй цэгийн "Ангилал" нь ХОЁР өөр зүйлийг нэг
          баганад хольсон — эрсдэлтэй ЦЭГИЙН төрөл ба бусад (дуудлага,
          самбар, камер …). Талбар, шүүлт нь НЭГ хэвээр (`filterKey(b)`),
          зөвхөн мөрүүд нь хоёр картад хуваагдана. Хэсэг бүр өмнөх
          хэсгүүдэд ороогүй мөрийг л авна — `match`-гүй сүүлчийнх нь үлдэгдэл.
        */
        const sp = environment ? set.splits?.[id] : undefined;
        if (sp && b.kind === "count" && b.label.trim().toLowerCase() === sp.label.toLowerCase()) {
          const taken = new Set<string>();
          const parts = sp.parts.map((part) => {
            const values = b.values.filter((d) => {
              if (taken.has(d.key) || (part.match && !part.match.test(d.label))) return false;
              taken.add(d.key);
              return true;
            });
            return { title: part.title, values };
          });
          return (
            <React.Fragment key={`${id}:${b.id}:split`}>
              {parts.map((part, pi) =>
                part.values.length ? (
                  <CutCard
                    key={`${id}:${b.id}:${pi}`}
                    title={part.title}
                    tone={tone}
                    first={b.id === leadId && pi === 0 && !crossCard}
                    weight={cardWeight({ ...b, values: part.values })}
                    full
                  >
                    <TopicBreakdown
                      breakdown={{ ...b, values: part.values }}
                      tone={tone}
                      selected={chosen}
                      onSelect={onPick}
                      unit={recordUnit(id)}
                    />
                  </CutCard>
                ) : null,
              )}
            </React.Fragment>
          );
        }

        /*
          ⚠⚠ ОН БА САР НЭГ КАРТАД (хэрэглэгч, 2026-10-07, нийслэлийн
          худгийн "Өрөмдсөн он", "Өрөмдсөн сар" хоёр картаар: "1
          болгоё"). Нэг огнооны хоёр тал тул толгойн сэлгэгчээр
          ("Жилээр · Сараар") нэг картад солигдоно — багананд нэг л
          суудал эзэлнэ. ЗӨВХӨН нэг он, нэг сарын цуваатай үед; огнооны
          хоёр өөр талбартай давхарга хуучнаараа.
          ⚠ Харагдац солиход шүүлт ХЭВЭЭР — сонгосон он нь шүүлтүүрийн
          мөрөнд шошгоороо үлдэнэ.
        */
        const times = set.tidy ? cuts.filter(isTime) : [];
        if (
          times.length === 2 &&
          times.some((x) => x.kind === "year") &&
          times.some((x) => x.kind === "month") &&
          isTime(b)
        ) {
          if (b !== times[0]) return null;
          /*
            ⚠ ТЭНХЛЭГ БҮР ТУСДАА бүрдэлд ({@link LayerSet.unfold}) он, сар
            ХОЁУЛАА зэрэг — сэлгэгчгүй, нэг эгнээнд ЗЭРЭГЦЭНЭ: босоо
            цуваа нь баганыг гүйлгүүртэй болгодог байв.
          */
          if (set.unfold)
            return (
              /* ⚠ ТОГТМОЛ 190px (хэрэглэгч 2026-10-07: "энэ арай урт
                 байна"). Баганын үлдсэн өндрийг эзэлдэг байхад өндөр
                 дэлгэцэд хэт сунаж байв — үлдсэн зай одоо ХУРААСАН
                 жагсаалтын картад ({@link LayerSet.topCharts}) очно */
              <div key={`${id}:time`} className="grid h-[190px] shrink-0 grid-cols-2 gap-2">
                {times.map((tb) => (
                  <CutCard
                    key={tb.id}
                    title={chartTitle(tb)}
                    source={`${hit.info.name} · талбар: ${tb.field}`}
                    tone={tone}
                    first={false}
                    fill
                    fit
                  >
                    {/* Утга цэг бүр дээр — дээд талын хоосон зайг тоогоор
                        дүүргэнэ (хэрэглэгч, 2026-10-07: "хоосон зайг
                        янзлая"); давхцвал диаграм өөрөө алгасна */}
                    <AreaChart
                      data={tb.values}
                      height={96}
                      fill
                      labels
                      tone={tone}
                      unit="бүртгэл"
                      selected={sel[filterKey(tb)] ?? null}
                      onSelect={(k) => pick(id, filterKey(tb), k)}
                      formatTick={(d, k) => tickOf(tb.kind, d, k, tb.values.length)}
                    />
                  </CutCard>
                ))}
              </div>
            );
          const view = timeView[id] ?? (times[0].kind as "year" | "month");
          const tb = times.find((x) => x.kind === view) ?? times[0];
          const tChosen = sel[filterKey(tb)] ?? null;
          return (
            <CutCard
              key={`${id}:time`}
              title={chartTitle(tb)}
              source={`${hit.info.name} · талбар: ${tb.field}`}
              tone={tone}
              first={b.id === leadId && !crossCard}
              weight={cardWeight(tb)}
              action={
                <Segments
                  options={times.map((x) => ({
                    id: x.kind as "year" | "month",
                    label: x.kind === "year" ? "Жилээр" : "Сараар",
                  }))}
                  value={view}
                  onChange={(v) => setTimeView((t) => ({ ...t, [id]: v }))}
                />
              }
            >
              <AreaChart
                key={tb.id}
                data={tb.values}
                fill
                height={108}
                tone={tone}
                unit="бүртгэл"
                selected={tChosen}
                onSelect={(k) => pick(id, filterKey(tb), k)}
                labels
                formatTick={(d, k) => tickOf(tb.kind, d, k, tb.values.length)}
              />
            </CutCard>
          );
        }

        return (
          <CutCard
            key={`${id}:${b.id}`}
            title={environment ? topicChartTitle(b) : chartTitle(b)}
            /* Үнэлгээний хэлтэст харьцуулах картын гарчиг ("Дүүрэг") ГАРАХГҮЙ,
               тэр байранд диаграмын тайлбар (зүлэг · цэцэг · талбай) сууна
               (хэрэглэгч, 2026-10-06) */
            bare={environment && b.kind === "compare"}
            /* Гарчиг дээр хулгана аваачихад эх сурвалжийн ТАЛБАРЫН нэр
               (хэрэглэгч, 2026-10-06: "ямар field-ээс авч байгаа юм") */
            source={`${hit.info.name} · талбар: ${b.field}${b.measure ? ` · хэмжилт: ${b.measure}` : ""}`}
            tone={tone}
            first={b.id === leadId && !crossCard}
            weight={cardWeight(b)}
            fill={solo}
            /* Дүүргийн карт доор нь байвал агуулгынхаа өндөртэй — үлдсэн
               зайг дүүргийн карт авна (хэрэглэгч 2026-10-07: "картуудын
               зайг янзлаач") */
            full={Boolean(districtCard)}
            /* Нийт дүн ба ангиллын тоо — зурвасуудыг нүдээр нэмэх
               шаардлагагүй болно */
            meta={
              shareArea
                ? `${num(Math.round([...shareArea.values()].reduce((n, v) => n + v, 0)))}${b.note?.unit ? ` ${b.note.unit}` : ""} · ${num(b.values.length)} ангилал`
                : set.tidy && !isTime(b)
                  ? headMeta(b, set.record)
                  : undefined
            }
            /* ⚠ Энэ хэлтэст өнгөний товч ГАРАХГҮЙ (хэрэглэгч,
               2026-10-05: устгуул) — толгой нь намхан, зураг нь
               давхаргынхаа ганц өнгөөр */
            action={
              driver && !environment ? (
                <button
                  type="button"
                  aria-pressed={lit}
                  onClick={() =>
                    setColorBy((c) => ({
                      ...c,
                      [id]: lit ? null : b.field,
                    }))
                  }
                  title={
                    b.values.length > MAX_COLOR_VALUES
                      ? "Ангилал хэт олон тул өнгө ялгагдахгүй"
                      : lit
                        ? "Газрын зургийг нэг өнгөнд буцаана"
                        : "Газрын зургийг энэ задаргаагаар өнгөт болгоно"
                  }
                  className={cn(
                    "shrink-0 rounded-[2px] border p-[3px] transition-colors",
                    lit
                      ? "border-transparent text-paper"
                      : "border-line-2 text-ink-3 hover:text-ink",
                  )}
                  style={lit ? { background: tone } : undefined}
                >
                  <Palette size={11} strokeWidth={1.8} />
                </button>
              ) : null
            }
          >
            {shareArea ? (
              <ShareGroups
                data={b.values}
                area={shareArea}
                unit={b.note?.unit}
                groups={set.valueGroups?.[id]}
                colorOf={(k) => palette?.get(k) ?? tone}
                selected={chosen}
                onSelect={onPick}
                onGroup={(keys) => pickSet(id, filterKey(b), keys)}
                countLabel={set.record?.count ?? "Дүрсийн тоо"}
                fill={solo}
                districts={
                  set.districts?.includes(id)
                    ? districtRows(
                        id,
                        hit,
                        b,
                        passes,
                        (k) => palette?.get(k) ?? tone,
                      )
                    : undefined
                }
                districtSel={sel[DISTRICT_KEY]?.[0] ?? null}
                onDistrict={(n) =>
                  n == null
                    ? pick(id, DISTRICT_KEY, null)
                    : pickOnly(id, [[DISTRICT_KEY, n]])
                }
              />
            ) : environment && !isTime(b) && b.kind !== "compare" ? (
              <TopicBreakdown
                breakdown={b}
                tone={tone}
                palette={palette}
                selected={chosen}
                onSelect={onPick}
                unit={recordUnit(id)}
              />
            ) : b.kind === "compare" && b.groups ? (
              /*
                ХЭВТЭЭ багана: ангилал нь дүүрэг, аж ахуйн нэгж
                зэрэг УРТ нэртэй бөгөөд олон байдаг тул босоо
                баганад нэр нь ч, утга нь ч таслагдаж байв.
                Хэвтээ мөрөнд нэр нь дээрээ бүтнээрээ, утга нь
                мөрийнхөө төгсгөлд суух тул нарийн багананд ч
                шахагдахгүй.
              */
              b.stack ? (
                /* Оноор давхарласан зурвас ({@link LayerSet.measureCards}) */
                <StackedBarChart
                  {...shownSeries(b, series[id], hueOf(id))}
                  unit={b.measure}
                  format={measureText}
                  selected={chosen}
                  onSelect={onPick}
                  /* Хэсэг бүр дээр оны утга (хэрэглэгч 2026-10-06:
                     "чарт дээр label асаагаад үздээ") */
                  labels
                  /* Тайлбар нь оны шүүлт — "Он" цэстэй НЭГ төлөв
                     (хэрэглэгч 2026-10-06: "энэ оноос filter хийдэг
                     болгоё"). Гурван карт бүгд НЭГ давхаргын тул нэгд
                     товшиход гурвуулаа дагана. */
                  legend={seriesLegend(b, series[id], hueOf(id))}
                  onLegend={(label) => pickYear(id, label)}
                />
              ) : (
                <GroupedBarChart
                  {...(environment
                    ? unitSeries(shownSeries(b, series[id], hueOf(id)), b.measure, set.compareDrop, set.seriesHues)
                    : shownSeries(b, series[id], hueOf(id)))}
                  layout="horizontal"
                  /* Үнэлгээний хэлтэст нэгж нь цуваа бүрийн НЭРТ ("Зүлэг, м²"),
                     тайлбарын эхэнд ганцаар биш */
                  unit={environment ? undefined : b.measure}
                  format={measureText}
                  selected={chosen}
                  onSelect={onPick}
                />
              )
            ) : isTime(b) ? (
              /*
                ⚠⚠ ХУГАЦААНЫ ЦУВАА нь ТАЛБАЙН ДИАГРАМ (хэрэглэгчийн
                шийдвэр, 2026-09-28: "он сар байгаа бол area chart-аар
                хийж бай, үүнийг тогтоогоод ав"). Урьд нь багана байв.

                Баганууд нь ангилал бүрийг ТУСДАА нэгж мэт харуулдаг
                бөгөөд хугацаа нь тийм биш — он, сар хоёр нь ТАСРАЛТГҮЙ
                тэнхлэг. Шугам нь хөршүүдийг холбож чиг хандлагыг өөрөө
                хэлнэ; хоосон он (тэг) нь уналт болж харагдана.

                ⚠ Өнгө нь ТУНГАЛАГ БИШ. Багана нь бүтэн өргөнтэй
                дүүргэлттэй тул картыг өнгөний блок болгохгүйн тулд
                сулруулдаг байв; талбайн диаграмын дүүргэлт нь аль
                хэдийн градиент тул давхар сулруулбал шугам нь
                үзэгдэхээ болино.
                ⚠ Өндөр нь 92-оос 108: `labels` асаалттай үед шошго нь
                цэгийнхээ ДЭЭР суудаг тул дээд талд 15px зай нэмэгдэнэ
                ({@link src/components/charts.tsx}-ийн `pad`). Өндрийг
                дагуулж нэмэхгүй бол шугам өөрөө нямхан болно.
              */
              <AreaChart
                data={b.values}
                /* ⚠ `fill` нь картынхаа ҮЛДСЭН өндрийг эзэлнэ; `height`
                   нь доод хязгаар ба `viewBox`-ийн харьцаа болж үлдэнэ
                   — богино дэлгэц дээр он бичсэн доод мөр тасрахаа
                   болино */
                fill
                height={108}
                tone={tone}
                /* Hover самбарын нэгж — мөн "бичлэг" БИШ */
                unit="бүртгэл"
                selected={chosen}
                onSelect={onPick}
                labels
                formatTick={(d, k) => tickOf(b.kind, d, k, b.values.length)}
              />
            ) : set.tidy &&
              b.kind === "count" &&
              hasShare(b) &&
              b.values.length <= 3 ? (
              /*
                ⚠⚠ ХОЁР, ГУРВАН УТГАТАЙ ТООЛОЛ нь ХУВИЙН БҮТЭН ЗУРВАС
                (хэрэглэгч, 2026-09-25: "диаграм нэг хэвийн — бүгд
                зурвас"). Ийм задаргааны жинхэнэ асуулт нь "аль нь
                хэдэн ширхэг" биш "ХАРЬЦАА нь ямар" — 41 ба 31 гэсэн
                хоёр зурвас түүнд шууд хариулдаггүй, харин нэг бүтэн
                зурвас дээрх 57 / 43 хариулна.
                ⚠ Зөвхөн бүхэл нь мэдэгдэж байгаа үед (`hasShare`):
                хувь нийлээд 100 болохгүй бол зурвас өөрөө худал хэлнэ.
              */
              <Composition
                data={b.values}
                colorOf={(k) => palette?.get(k) ?? tone}
                /* `Composition` нь НЭГ сонголттой — олон утгын
                   горимоос эхнийхийг нь авна */
                selected={chosen?.[0] ?? null}
                onSelect={onPick}
              />
            ) : solo && b.values.length <= SOLO_COLUMNS ? (
              /*
                ⚠⚠ ГАНЦ КАРТ — БОСОО БАГАНА (хэрэглэгч, 2026-10-06:
                хэвтээ зурвас 120px мөрөөр "арай дэндүү", 88px-ээр ч
                хоосон зай үлдэв → "өөрчлөөд үзээдээ"). Хэвтээ мөр нь
                өндрийг ЗАЙгаар л дүүргэдэг; босоо багана нь түүнийг
                УТГААР дүүргэнэ. Нэмэлт утга (га) нэрийн доор.
                ⚠ Найман ангиллаас олон бол ердийн зурвас: 24 багана
                нарийн картад багтахгүй.
              */
              <BarChart
                data={b.values}
                tone={tone}
                colorOf={
                  palette && set.valueTones?.[id]
                    ? (d) => soft(palette.get(d.key)) ?? tone
                    : undefined
                }
                fill
                height={600}
                labels
                format={b.kind === "count" ? undefined : measureText}
                sub={noteOf(b)}
                selected={chosen}
                onSelect={onPick}
              />
            ) : isPie(b) && !set.tidy ? (
              <PieChart
                data={b.values}
                tone={tone}
                selected={chosen}
                onSelect={onPick}
                note={noteOf(b)}
                format={b.kind === "sum" ? measureText : undefined}
                colorOf={
                  palette ? (d) => palette.get(d.key) ?? tone : undefined
                }
              />
            ) : (
              <>
                {/*
                ⚠⚠ НЭМЭЛТ ТОО ЮУ БОЛОХЫГ НЭРЛЭНЭ (хэрэглэгч, 2026-10-06,
                голын татмын зургаар: "засъя"). Тооллын диаграмд
                хэмжилт шингэхэд (`note`) мөр бүрт ХОЁР тоо гардаг:
                нэрийн ард бүдэг нь хэмжилт, төгсгөлд нь бичлэгийн тоо —
                зурвас нь сүүлийнхийг хэмждэг. Нэгжгүй хэмжилт дээр нэрийн
                ардах "44,240" нь юуны тоо болох нь хаана ч бичигдээгүй
                тул зурвастайгаа зөрж буй мэт харагдаж байв (Туул 44,240
                боловч зурвас нь Хэрлэнийхээс богино). Одоо хоёр тоо
                баганын толгой мэт нэрлэгдэнэ.
              */}
                {b.note ? (
                  <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-line pb-1">
                    <span className="eyebrow min-w-0 truncate text-ink-3">
                      {b.label} · {b.note.label}
                      {b.note.unit ? `, ${b.note.unit}` : ""}
                    </span>
                    <span className="eyebrow shrink-0 text-ink-3">
                      {b.kind === "count"
                        ? (set.record?.count ?? "Бүртгэлийн тоо")
                        : (b.measure ?? "")}
                    </span>
                  </div>
                ) : null}
                <RowChart
                  data={b.values}
                  tone={tone}
                  selected={chosen}
                  onSelect={onPick}
                  note={noteOf(b)}
                  format={
                    b.kind === "count" && !b.measure ? undefined : measureText
                  }
                  colorOf={
                    palette ? (d) => palette.get(d.key) ?? tone : undefined
                  }
                  /*
                  ⚠ ШАХСАН МӨР (хэрэглэгчийн хүсэлт, 2026-09-17).
                  Задаргаа нь хорин таван утга хүртэл байж болох
                  (`MAX_VALUES`) тул ердийн 51px-ийн мөр нь карт
                  бүрийг гүйлгүүртэй болгодог байв. Шахсан үед
                  мөр ~31px — ес, арван утга гүйлгэхгүйгээр
                  багтана.
                  Ганц карт баганаа дүүргэх үед (`solo`) эсрэгээрээ
                  ТОМОРНО — зай нь хэтэрхий их.
                */
                  dense={!solo}
                  fill={solo}
                  /*
                  ⚠ НЭРИЙГ НЭГ ЭГНЭЭНД барина. Урт монгол нэр
                  хоёр эгнээ болоход мөр 31px-ээс 46px болж шахсаны
                  ашиг алга болно. Бүтэн нэр нь мөрийн `title`-д,
                  шүүлтүүрийн хайлттай цэсэнд бүтнээрээ үлдэнэ.
                */
                  clamp={!palette}
                  /*
                  ⚠ ЭЗЛЭХ ХУВЬ — зөвхөн бүхэл нь мэдэгдэж байгаа үед
                  ({@link hasShare}). Толгойн нийт дүнтэй хамт мөр бүр
                  "хэдэн хувь" гэдэгт өөрөө хариулна.
                */
                  /* ⚠ ХУВЬ ХАСАГДСАН (хэрэглэгч, 2026-09-25: "хувь
                   нтр харуулаад байх шаардлагагүй"). Тоо нь өөрөө
                   хариулт — хувь нь мөр бүрийг өргөсгөж, нягт
                   баганад нэр нь тасрахад хүргэж байв. Толгойн НИЙТ
                   ДҮН үлдсэн тул харьцаа хэрэгтэй үед тэндээс
                   уншигдана. */
                  share={false}
                />
              </>
            )}
          </CutCard>
        );
      });

      return (
        <React.Fragment key={id}>
          {band}
          {crossCard}
          {cards}
          {nameCard}
          {districtCard}
          {areaCard}
          {set.recordList?.includes(id) ? (
            <RecordListCard
              key={`${id}:list`}
              hit={hit}
              base={uidBase(id)}
              tone={tone}
              word={set.record}
              passes={listPasses}
              palette={palettes[id]}
              picked={picked}
              onPick={(uid) => {
                setPicked(uid);
                setRowPick(uid);
              }}
            />
          ) : null}
        </React.Fragment>
      );
    });

  /*
    Ангиллын задаргааны багана — ҮРГЭЛЖ ЗУРГИЙН БАРУУН ТАЛД.

    ⚠⚠ Зургийн ДООР, бүтэн өргөнөөр тавьж үзээд БУЦААСАН (хэрэглэгч,
    2026-09-30: "чарт мапын доор бишээ баруун талд нь"). Дахин бүү
    давт: "дэлгэцийн уртааш таарсан" гэсэн шаардлагыг доош зөөж биш,
    баруун баганыг ӨРГӨСГӨЖ (560px) хангана.
  */
  /*
    ⚠ `mapPicker` бүрдэлд диаграмын багана ЗӨВХӨН задаргаатай давхарга
    байгаа үед — бүгд зурагт л харьяалагдвал хоосон "Задаргаа" карт
    нь зургийн өргөнөөс хасагдаад юу ч хэлэхгүй ({@link
    LayerSet.mapPicker}). Зөвхөн зурагт харьяалагдах давхаргууд
    баганын хоосон төлөвийг ч шийдэхгүй (`chartViews`).
  */
  /* Диаграмгүй бүрдэлд ({@link LayerSet.noCharts}) баруун багана ГАРАХГҮЙ */
  const chartable = !set.noCharts && (!mapPicker || listIds.length > 0);
  const chartViews = mapIds.length
    ? views.filter((v) => !mapIds.includes(v.id) || set.charts?.[v.id])
    : views;
  const chartsShown = showCharts && chartable;
  const chartsBlock = chartsShown ? (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
      {chartViews.length === 0 ||
      (environment && chartViews.every((view) => !view.charts.length)) ? (
        <Card className="min-h-[120px] flex-1">
          <Head title="Задаргаа" />
          <div className="hatch flex flex-1 items-center justify-center px-4">
            <p className="text-center text-[12px] leading-relaxed text-ink-3">
              {environment && on.some((id) => listIds.includes(id) && !loaded[id] && !failed[id])
                ? "Сонгосон давхаргын мэдээллийг ачаалж байна…"
                : environment && chartViews.length
                  ? "Ангиллаар харьцуулах мэдээлэл байхгүй. Газрын зураг дээрх бүртгэлээс дэлгэрэнгүйг үзнэ үү."
                  : picker
                    ? "Давхарга асаахад задаргаа нь энд гарна."
                    : "Задаргаа гарахуйц талбар олдсонгүй."}
            </p>
          </div>
        </Card>
      ) : null}

      {zoneCard}

      {/* Бүсийн картын ДООР — давхцах нэгж талбарын задаргаа (хэрэглэгч,
          2026-10-06). Зөвхөн бүсийн карт ганцаараа зогсдог цэсэд
          ({@link LayerSet.zonesOnly}); бусад олон давхаргат цэсэд
          давхаргууд нь бүс биш тул асуулт утгагүй */}
      {parcelZones && !set.sheet ? (
        <ParcelCard
          sheet={set.sheet}
          zones={parcelZones}
          onPick={setParcelPick}
          pickInfo={
            parcelPick
              ? {
                  busy: !shownPick,
                  count: shownPick ? shownPick.data.features.length : null,
                  capped: Boolean(shownPick?.capped),
                }
              : null
          }
          /* Сав газраар шүүсэн бол нэгж талбарын карт ч түүн рүү */
          prefer={
            zones.find(
              (z) =>
                z.axis &&
                z.key &&
                (filters[z.layer]?.[z.axis] ?? []).includes(z.key),
            )?.id ?? null
          }
        />
      ) : null}

      {/* `parcelBy` асаалттай цэсэд л гарна (дээрхийг үзнэ үү) */}
      {parcelCard}

      {parcelCutCards}

      {chartCards(
        (id, b) => !split?.has(`${id}:${b.id}`),
        /* Талбайн карт ҮРГЭЛЖ баруун баганад, давхаргынхаа
                   туузан дор */
        () => true,
        true,
      )}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-2.5",
        environment && "ue-layer-dashboard",
      )}
    >
      {/*
        ---- ШҮҮЛТҮҮРИЙН МӨР ----

        Диаграм дээр товшиж шүүх нь хурдан ч ЮУГААР шүүж болохыг
        харуулдаггүй: асаалттай давхаргын бүх ангилал энд нэг мөрөнд
        гарч, сонголт нь товчин дээрээ бичигдэнэ.

        Давхарга бүр өөрийн бүлэгтэй — нэг нэртэй талбар хоёр
        давхаргад өөр утга агуулж болох тул тэдгээрийг холих аргагүй.
      */}
      <FilterBar
        title={set.title ?? "Давхарга"}
        leading={
          <div className="flex flex-wrap items-center gap-2">
            {/* Задаргаагүй үед товч нь юу ч сэлгэхгүй ({@link LayerSet.mapPicker}) */}
            {chartable ? (
              <button
                type="button"
                aria-pressed={showCharts}
                onClick={() => setShowCharts((value) => !value)}
                className={cn("map-view-toggle", showCharts && "selected")}
              >
                <ChartNoAxesCombined size={15} /> Шинжилгээ
              </button>
            ) : null}

            {/*
              ⚠⚠ ХАРИЛЦАН ҮГҮЙСГЭХ БҮРДЭЛД ДАВХАРГА СОНГОХ ТОВЧНУУД
              (`LayerSet.exclusive`, хэрэглэгчийн хүсэлт 2026-09-28:
              "аюултай болон энгийн гэсэн button байгаад солигддог
              бол зүгээр").

              ⚠ Эдгээр нь ШҮҮЛТҮҮР БИШ, "юуг харах вэ" гэсэн эх
              сурвалжийн сонголт тул гарчгийн ХАЖУУД сууна —
              шүүлтүүрүүд нь баруун тийш шахагдана ({@link FilterBar}
              -ийн `leading`). Хөрсний оны товчтой нэг гэр бүл.

              ⚠ Унтраалга БИШ РАДИО: нэг давхарга л асна, дахин
              товшиход цуцлагдахгүй. Хоосон зураг нь сонголт биш
              алдаа мэт уншигдана.

              ⚠ Өнгөт цэг нь тухайн давхаргын зургийн өнгө — товч нь
              зургийн тайлбар болж давхар ажиллана.
            */}
            {/*
              БҮСЭЭР ШҮҮХ (хэрэглэгч, 2026-09-29: "бүсээр шүүх хэсэг
              нэмээрэй"). Олон давхаргатай цэсэд давхарга сонгох
              БАГАНА байдаггүй (`openAll`) тул гурван бүс үргэлж
              зэрэг зурагдаж, аль нэгийг нь тусад нь харах арга
              байхгүй байв.

              ⚠ Энэ нь "юуг харах вэ" гэсэн хяналт тул ГАРЧГИЙН
              ХАЖУУД (`leading`) сууна — баруун талын шүүлтүүрийн
              бүлэгт тавибал талбарын шүүлттэй андуурагдана
              ({@link FilterBar}).
              ⚠ ОЛОН СОНГОЛТ (`exclusive`-ийн радиогоос ялгаатай):
              бүсүүд нь нэг системийн шатууд тул хоёуланг нь зэрэг
              харах нь утгатай.
              ⚠⚠ ДАРАХААР АСНА, УНТРААДАГГҮЙ (хэрэглэгч, 2026-09-29:
              "дархаар унтардаг биш асдаг болгоод эсэргээр нь
              хийгээрэй"). Эхний хувилбарт бүх бүс ТЭМДЭГЛЭГДСЭН
              байдлаар нээгдэж, товшилт нь тэр бүсийг УНТРААДАГ байв —
              шүүлтүүрийн мөрийн бусад БҮХ цэстэй эсрэг: тэнд юу ч
              тэмдэглээгүй нь "шүүлтгүй, бүгд харагдана" гэсэн үг
              бөгөөд товшилт нь утгыг НЭМДЭГ.
              Одоо ижил дүрэм: тэмдэглэгээгүй = бүх бүс харагдана;
              эхний товшилт нь ЗӨВХӨН тэр бүсийг үлдээнэ; дараагийн
              товшилтууд нэмнэ; сүүлчийнхийг нь авбал бүгд буцна.
              ⚠ Цэсний НЭР нь бүртгэлээс (`layerLabel`): хамгаалалтын
              цэсэд "Бүс", булгийнхад "Хувилбар" — давхаргууд нь өөр
              өөр зүйл тул нэг нэрээр нэрлэвэл аль нэгэнд нь худал.
              ⚠ Хажуугийн тоо нь давхаргын БҮТЭН бичлэгийн тоо
              (`count`), шүүгдсэнийх биш: "энэ бүсэд хэдэн дүрс байна"
              гэдэг нь бүсийн шинж чанар.
            */}
            {!picker && !set.exclusive && set.layers.length > 1 ? (
              <FilterMenu
                label={set.layerLabel ?? "Давхарга"}
                icon={Layers3}
                value={
                  on.length === 1
                    ? (set.names[on[0]] ?? infos[on[0]]?.name ?? on[0])
                    : on.length < set.layers.length
                      ? `${on.length} / ${set.layers.length}`
                      : undefined
                }
                active={on.length < set.layers.length}
                onClear={
                  on.length < set.layers.length
                    ? () => showLayers([...set.layers])
                    : undefined
                }
              >
                <PickList
                  items={set.layers.map((id) => ({
                    key: id,
                    label: set.names[id] ?? infos[id]?.name ?? id,
                    value: infos[id]?.count ?? 0,
                  }))}
                  /* Бүгд харагдаж байгаа нь "шүүлтгүй" гэсэн үг тул
                     тэмдэглэгээ ХООСОН — бусад цэстэй нэг дүрэм */
                  selected={on.length < set.layers.length ? on : []}
                  onPick={(key) => {
                    const all = [...set.layers];
                    if (key == null) return showLayers(all);
                    /* Шүүлтгүй байхад эхний товшилт нь ЗӨВХӨН тэр бүсийг
                       үлдээнэ — "дарахаар асна" */
                    if (on.length === set.layers.length)
                      return showLayers([key]);
                    const next = on.includes(key)
                      ? on.filter((x) => x !== key)
                      : [...on, key];
                    /* Сүүлчийнхийг нь авбал шүүлт цуцлагдаж бүгд буцна —
                       хоосон зураг нь сонголт биш алдаа мэт уншигдана */
                    showLayers(next.length ? next : all);
                  }}
                />
              </FilterMenu>
            ) : null}

            {/*
              УТГЫН ТОВЧ — "Бүгд · 2021 · … · 2026" ({@link LayerSet.pickBar};
              гадаргын ус, хэрэглэгч 2026-10-22: "onoor n l shuuyaa").
              ОЛОН СОНГОЛТТОЙ (хэрэглэгч мөн өдөр: "multiple bas songono"):
              товшилт нэмнэ/хасна, "Бүгд" цэвэрлэнэ.
            */}
            {set.pickBar && barValues.length > 1 ? (
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label={set.pickBar.label}
              >
                {[null, ...barValues].map((v) => {
                  const bar = set.pickBar!;
                  const cur = filters[bar.layer]?.[bar.field] ?? [];
                  const isOn = v == null ? cur.length === 0 : cur.includes(v);
                  return (
                    <button
                      key={v ?? ""}
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => pick(bar.layer, bar.field, v)}
                      className={cn(
                        "num rounded-xs border px-2 py-1 text-[12px] transition-colors",
                        isOn
                          ? "border-data/45 bg-data/12 font-medium text-ink"
                          : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                      )}
                    >
                      {v ?? "Бүгд"}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/*
              ОГНООГООР ШҮҮХ МӨР ({@link LayerSet.dateBar}) — огнооны талбар
              (олон бол сонгогч) · он · `Date` талбарт сар. Он 12-оос олон
              бол товчны оронд цэс — мөр хэт урт болно. Он, сар ОЛОН
              СОНГОЛТТОЙ (хэрэглэгч 2026-10-22: "multiple bas songono"):
              товшилт нэмнэ/хасна, "Бүх он" цэвэрлэнэ.
            */}
            {dateBar && dateBar.years.length > 1
              ? (() => {
                  const { id, list, axis, yk, mk, years, months } = dateBar;
                  const curY = filters[id]?.[yk] ?? [];
                  const curM = filters[id]?.[mk] ?? [];
                  return (
                    <div
                      className="flex flex-wrap items-center gap-1"
                      role="group"
                      aria-label="Огноогоор шүүх"
                    >
                      {list.length > 1 ? (
                        <BarSelect
                          label="Огнооны талбар"
                          value={axis.field}
                          options={list.map((a) => ({
                            value: a.field,
                            label: a.label,
                          }))}
                          onChange={(f) => {
                            pick(id, yk, null);
                            pick(id, mk, null);
                            setDateWant((w) => ({ ...w, [id]: f }));
                          }}
                        />
                      ) : (
                        <span className="mr-0.5 text-[11.5px] text-ink-3">
                          {axis.label}
                        </span>
                      )}
                      {years.length <= 12 ? (
                        [null, ...years].map((y) => {
                          const isOn =
                            y == null ? curY.length === 0 : curY.includes(y.key);
                          return (
                            <button
                              key={y?.key ?? ""}
                              type="button"
                              aria-pressed={isOn}
                              onClick={() =>
                                pick(id, yk, y?.key ?? null)
                              }
                              className={cn(
                                "num rounded-xs border px-2 py-1 text-[12px] transition-colors",
                                isOn
                                  ? "border-data/45 bg-data/12 font-medium text-ink"
                                  : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                              )}
                            >
                              {y?.label ?? "Бүх он"}
                            </button>
                          );
                        })
                      ) : (
                        <FilterMenu
                          label="Он"
                          icon={CalendarRange}
                          value={
                            curY.length === 1
                              ? (years.find((y) => y.key === curY[0])?.label ??
                                curY[0])
                              : curY.length
                                ? `${curY.length} он`
                                : undefined
                          }
                          active={curY.length > 0}
                          width={180}
                          onClear={() => pick(id, yk, null)}
                        >
                          <PickList
                            items={years.map((y) => ({
                              key: y.key,
                              label: y.label,
                              value: 0,
                            }))}
                            selected={curY}
                            onPick={(key) => pick(id, yk, key)}
                            format={() => ""}
                          />
                        </FilterMenu>
                      )}
                      {months.length > 1 ? (
                        <FilterMenu
                          label="Сар"
                          icon={CalendarRange}
                          value={
                            curM.length === 1
                              ? `${curM[0]}-р сар`
                              : curM.length
                                ? `${curM.length} сар`
                                : undefined
                          }
                          active={curM.length > 0}
                          width={160}
                          onClear={() => pick(id, mk, null)}
                        >
                          <PickList
                            items={months.map((m) => ({
                              key: String(m),
                              label: `${m}-р сар`,
                              value: 0,
                            }))}
                            selected={curM}
                            onPick={(key) => pick(id, mk, key)}
                            format={() => ""}
                          />
                        </FilterMenu>
                      ) : null}
                    </div>
                  );
                })()
              : null}

            {/* Хуудасны горимд сэлгэгч баруун баганын дээд талд сууна */}
            {set.exclusive && !(set.sheet && chartable && showCharts) ? (
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label="Давхарга"
              >
                {set.layers.map((id) => {
                  const isOn = on.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => (isOn ? undefined : toggle(id))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xs border px-2 py-1 text-[12px] transition-colors",
                        isOn
                          ? "border-data/45 bg-data/12 font-medium text-ink"
                          : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                      )}
                    >
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ background: toneOf(id) }}
                      />
                      {set.names[id] ?? infos[id]?.name ?? id}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        }
        activeCount={activeCount}
        chips={filterChips}
        /* ЦЭВЭРЛЭХ нь БҮХ шүүлтийг авна: талбар, он, зургаас
           сонгосон бичлэг, бүсийн хумилт — дөрвүүлэнг нь. Аль нэгийг
           нь үлдээвэл товч дарсан ч самбар хэвээр шүүгдсэн харагдана */
        onReset={() => {
          setFilters({});
          setSeries({});
          setPicked(null);
          setRowPick(null);
          setParcelPick(null);
          if (on.length < set.layers.length) setOn([...set.layers]);
        }}
      >
        {views.length === 0 ? (
          <span className="text-[11.5px] text-ink-3">Давхарга сонгоогүй</span>
        ) : null}

        {views.map(({ id, hit }) => {
          const sel = filters[id] ?? {};
          /* Сонгох боломжтой утгууд нь ШҮҮГДЭЭГҮЙ жагсаалтаас: шүүсний
             дараа цэс нь өөрийгөө хумивал сонголтоо солих арга үлдэхгүй */
          /* Талбарын цэс нь хэлтсийн сонголт: диаграмууд өөрсдөө
             шүүдэг болсон газарт цэс нь ижил сонголтыг давтана
             ({@link LayerSet.fieldMenus}) */
          /* Газрын зургийн давхаргын цэснээс асаасан давхарга шүүлтүүрийн
             мөрөнд цэс НЭМЭХГҮЙ (хэрэглэгч, 2026-10-06: "layer-ээс
             сонголт хийхэд header дээр filter гарч ирэх шаардлагагүй") */
          if (mapIds.includes(id)) return null;
          const cuts = set.fieldMenus === false ? [] : menusOf(hit.charts);
          const years = yearsOf(hit.charts);
          if (!cuts.length && !years.length) return null;

          return (
            <React.Fragment key={id}>
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[1px]"
                style={{ background: toneOf(id) }}
              />
              {/*
                ОНЫ цэс. Он нь МӨР биш БАГАНА тул бусад шүүлтээс өөр
                зүйл хийнэ: бичлэг хасахгүй, ХАРУУЛАХ цуваагаа
                сонгоно. Тиймээс диаграмын тоонууд өөрчлөгдөхгүй,
                зөвхөн аль он харагдах нь өөрчлөгдөнө.
              */}
              {years.length > 1 ? (
                <FilterMenu
                  label="Он"
                  icon={CalendarRange}
                  value={
                    (series[id]?.length ?? 0) === 1
                      ? series[id][0]
                      : series[id]?.length
                        ? `${series[id].length} он`
                        : undefined
                  }
                  active={(series[id]?.length ?? 0) > 0}
                  width={160}
                  onClear={() => pickYear(id, null)}
                >
                  <PickList
                    items={years.map((y) => ({ key: y, label: y, value: 0 }))}
                    selected={series[id] ?? []}
                    onPick={(key) => pickYear(id, key)}
                    /* Хажуугийн тоо нь утгагүй — он нь бичлэг тоолдоггүй */
                    format={() => ""}
                  />
                </FilterMenu>
              ) : null}

              {cuts.map((b) => {
                const chosen = sel[filterKey(b)] ?? [];
                return (
                  <FilterMenu
                    key={b.id}
                    label={b.label}
                    icon={Tag}
                    /* Хоёроос олон утга товчинд багтахгүй тул тоогоор
                       нь хэлнэ — жагсаалт нь цэсэн дотор бүтнээрээ */
                    value={
                      chosen.length === 1
                        ? chosen[0]
                        : chosen.length
                          ? `${chosen.length} утга`
                          : undefined
                    }
                    active={chosen.length > 0}
                    onClear={() => pick(id, filterKey(b), null)}
                  >
                    <PickList
                      items={b.values}
                      selected={chosen}
                      onPick={(key) => pick(id, filterKey(b), key)}
                      searchable={b.values.length > 8}
                    />
                  </FilterMenu>
                );
              })}
            </React.Fragment>
          );
        })}
      </FilterBar>

      {/* ⚠ Сэдвийн тайлбар өгүүлбэр ГАРАХГҮЙ (хэрэглэгч, 2026-10-06:
          "ийм тайлбарласан өгүүлбэр байхгүй") — арга зүйн тайлбарын дүрэм */}

      {/*
        ҮЗҮҮЛЭЛТ БҮР ИРСЭН ДАТАГААРАА ГАРНА (2026-09-21).

        ⚠ "Идэвхтэй давхарга" нь ЗӨВХӨН сонгох баганатай үед утгатай:
        сэдэв тус бүрд зориулсан цонхонд (`openAll`) давхарга бүгд
        асаалттай тул "1" гэсэн тоо ЮУ Ч ХЭЛЭХГҮЙ.
        ⚠ "Талбай, га" нь ЦЭГЭН давхаргад БАЙХГҮЙ — "—" гэсэн зураас нь
        зай эзлэхээс өөр юу ч хэлэхгүй тул ОГТ ГАРГАХГҮЙ. Хоосон
        төлөвийн дүрэм ҮЗҮҮЛЭЛТЭД хамаарахгүй: тэнд хүлээгдэж буй дата
        биш, АГУУЛГААГҮЙ хэмжигдэхүүн.

        ⚠⚠ ЗУРВАС ГАРАХГҮЙ ЦЭСИЙГ БҮРТГЭЛ ШИЙДНЭ
        ({@link LayerSet.overview}, 2026-09-29, хэрэглэгч зургаар:
        "энийг хасъя" → "НБАХ-ын бусад цэсүүдээс бас эдгээрийг нь
        хасъя"). Ногоон бүсийн АРВАН ТАВАН цэсэд зурвас алга болов:
        бичлэгийн тоо нь давхаргын ТУУЗАНД (өнгө · нэр · тоо), талбай
        нь бүсийн картын толгойд эсвэл "Талбай, га" диаграмд аль хэдийн
        гардаг тул зурвас нь ДАВХАРДАЛ байв.
        ⚠ Санхүүгийн хэлтэст яг ижил шалтгаанаар зурвас хасагдсан
        (2026-09-10): үзүүлэлт нь модны үндсэн зангилаанд тэр чигээрээ
        гардаг байв.
        ⚠⚠ НӨХЦӨЛ нь `tidy` БИШ, ТУСДАА ТУГ: ой, амьтан, үнэлгээний
        хэлтэст `tidy` хожим асч болох ч тэдэнд зурвас ХЭРЭГТЭЙ хэвээр
        — ойн хэсэглэлийн "7,699 бичлэг" өөр хаана ч гардаггүй. Хэлтэс
        тус бүр өөрөө шийднэ (`skipMeasure`, `values`-тай нэг зарчим).
      */}
      {/*
        ⚠⚠ `mapPicker` бүрдэлд ИНДИКАТОР нь ДАВХАРГА БҮРИЙН НИЙТ
        БҮРТГЭЛ (хэрэглэгч, 2026-10-06: "ҮЕРИЙН ЭРСДЭЛ индикатор дээр
        update хий, feature-ийн мэдээллийг бүтэн унш"). Урьд нь
        "Идэвхтэй давхарга · Сонгосон давхаргын бүртгэл" гэсэн хоёр нүд
        зөвхөн АСААЛТТАЙ давхаргыг тоолдог байсан тул долоон давхаргын
        тав нь хаана ч тоогоороо гардаггүй байв.
        ⚠ Тоо нь давхаргын ТОДОРХОЙЛОЛТООС (`info.count`, серверийн
        тоолол) — асаах, шүүхээс ҮЛ ХАМААРНА; бүх давхарга нээгдэх үед
        аль хэдийн уншигддаг тул нэмэлт татац хэрэггүй.
      */}
      {/*
        ⚠⚠ БҮРТГЭЛЭЭС ЗААСАН ИНДИКАТОР ({@link LayerSet.stats}, хэрэглэгч
        2026-10-06: ногоон байгууламж дээр "одоо байгаа индикаторуудыг
        del, өөр индикатор нэм"). Тоо нь ШҮҮГДСЭН мөрөөс (диаграм,
        зургийн шүүлтийг дагана); давхарга татагдаагүй бол тоолол нь
        давхаргын нийт тоогоор, нийлбэр нь "…".
        ⚠ Талбарыг нэр ЭСВЭЛ албан нэрээр таана — олдохгүй бол "—".
      */}
      {set.stats && set.overview !== false ? (
        <div
          className="analytics-overview"
          aria-label="Өгөгдлийн тойм"
          /* Тэмдэг нь сэдвийнхээ давхаргын өнгөөр (ногоон байгууламжид
             бүдэг ногоон; хэрэглэгч, 2026-10-06: "индикатор икон ногоон") */
          style={{ "--tone": toneOf(set.layers[0]) } as React.CSSProperties}
        >
          {set.stats.map((st) => {
            const info = infos[st.layer];
            const view = views.find((v) => v.id === st.layer);
            const Glyph = STAT_ICONS[st.icon] ?? Shapes;
            let value = "…";
            if (!st.field) {
              value = view ? num(view.rows.length) : info ? num(info.count) : failed[st.layer] ? "—" : "…";
            } else if (info) {
              const f = info.fields.find(
                (x) => /^(Double|Single|Integer|SmallInteger|BigInteger|OID)$/.test(x.type) && (st.field!.test(x.name) || st.field!.test(x.alias)),
              );
              if (!f) value = "—";
              else if (view) {
                let sum = 0;
                for (const r of view.rows) {
                  const n = Number(r[f.name]);
                  if (r[f.name] != null && r[f.name] !== "" && Number.isFinite(n)) sum += n;
                }
                value = num(Math.round(sum));
              }
            }
            return <Stat key={st.label} icon={Glyph} label={st.label} value={value} />;
          })}
        </div>
      ) : null}
      {set.layerStats && set.overview !== false ? (
        <div className="analytics-overview is-layers" aria-label="Өгөгдлийн тойм">
          {set.layers.filter((id) => !set.statSkip?.includes(id)).map((id) => {
            const info = infos[id];
            const Glyph =
              LAYER_ICONS[set.icons?.[id] ?? ""] ??
                      (info?.geometry === "Point" ? MapPin : info?.geometry === "Polyline" ? Spline : Hexagon);
            return (
              <Stat
                key={id}
                icon={Glyph}
                label={info?.name ?? set.names?.[id] ?? id}
                value={info ? num(info.count) : failed[id] ? "—" : "…"}
              />
            );
          })}
        </div>
      ) : null}
      {set.overview === false || set.layerStats || set.stats ? null : groups && set.overviewSplit ? (
        /* Хоёр бүлгийн тоо, талбай ба нийт талбай — ӨӨР юу ч үгүй
           (хэрэглэгч, 2026-10-06: "… л байхад болно") */
        <div
          className="analytics-overview is-compact"
          aria-label="Өгөгдлийн тойм"
        >
          <Stat
            icon={ShieldCheck}
            label={set.overviewSplit.filled}
            value={num(groups.filled.n)}
            sub={`${num(Math.round(groups.filled.ha))} га`}
          />
          <Stat
            icon={MapPin}
            label={set.overviewSplit.empty}
            value={num(groups.empty.n)}
            sub={`${num(Math.round(groups.empty.ha))} га`}
          />
          <Stat
            icon={Ruler}
            label="Нийт талбай, га"
            value={num(Math.round(groups.ha))}
          />
        </div>
      ) : (
        <div
          className={cn(
            "analytics-overview",
            set.overviewSplit && "is-compact",
          )}
          aria-label="Өгөгдлийн тойм"
        >
          {picker ? (
            <Stat
              icon={Layers3}
              label="Идэвхтэй давхарга"
              value={num(stats.layers)}
            />
          ) : null}
          {/* Бүртгэлийн тоо утгагүй давхаргад гарахгүй
              ({@link LayerSet.noCount}) */}
          {on.length > 0 &&
          on.every((id) => set.noCount?.includes(id)) ? null : (
          <Stat
            icon={Shapes}
            /* ⚠ "Бичлэг" нь МЭДЭЭЛЛИЙН САНГИЙН үг — эцсийн хэрэглэгч
               агуулах, зөвшөөрөл, цэгийг хардаг болохоос "бичлэг"
               хардаггүй. Платформ өөрөө "бүртгэл" гэдэг үгтэй
               (доорх `environment` хувилбар түүнийг аль хэдийн
               хэрэглэдэг) тул хоёуланг нэг үгэнд оруулав */
            /* Бүртгэл өөрийн нэртэй бол түүгээр ({@link LayerSet.record}):
               ойн төлбөрийн мөр бүр нэг ДҮҮРЭГ (хэрэглэгч 2026-10-06:
               "дүүрэг шүү") */
            label={
              environment
                ? "Сонгосон давхаргын бүртгэл"
                : (set.record?.count ?? "Шүүлтэд тохирох бүртгэл")
            }
            value={
              environment && on.some((id) => !loaded[id] && !failed[id])
                ? "…"
                : num(stats.records)
            }
          />
          )}
          {stats.ha > 0 ? (
            <Stat
              icon={Ruler}
              label={
                environment ? "Дүрсүүдийн талбайн нийлбэр, га" : "Талбай, га"
              }
              value={
                environment
                  ? new Intl.NumberFormat("mn-MN", {
                      maximumFractionDigits: 2,
                    }).format(stats.ha)
                  : num(Math.round(stats.ha))
              }
            />
          ) : null}
          {extras.map((e) => (
            <Stat
              key={e.key}
              icon={e.time ? CalendarRange : Sigma}
              label={e.label}
              value={e.value}
            />
          ))}
        </div>
      )}

      <Columns
        /* ⚠ Өргөн нь `localStorage.cols.<id>`-д сууна: анхдагчийг
           өөрчлөхөд түлхүүрийг мөн солихгүй бол нэг удаа самбар
           нээсэн хэрэглэгчийн хуучин өргөн шинийг дарна (биотехникийн
           `biotech-2`-той нэг зарчим) */
        id={`layers-${set.key}${set.tidy ? "-w" : ""}`}
        left={listColumn ? (environment ? 228 : 286) : split ? 320 : undefined}
        /* Бүлэглэсэн багана энд сууна — 300px дээр гурван оны
         харьцуулалт зураас болно. Хэрэглэгч чирж өөрчилнө */
        /* ⚠⚠ `tidy` бүрдэлд БАРУУН БАГАНА ӨРГӨН (хэрэглэгч,
           2026-09-30: "чарт мапын доор бишээ баруун талд нь"). Тэнд
           давхаргын бүх задаргаа НЭГ таван баганат хүснэгт болсон тул
           350px дээр гарчиг бүр гурван мөр болж шахагддаг. Чирж
           өөрчилнө. */
        /* ⚠ Давхарга сонгох багана ЗЭРЭГ байвал (ойн хэлтэс) 560 нь
           газрын зургийг 300px руу шахна — 440 нь нэгдсэн хүснэгтийн
           гарчгийг хоёр мөрөнд багтааж, зурагт зай үлдээнэ. */
        right={
          chartsShown && !noMap
            ? set.tidy
              ? picker
                ? 440
                : 560
              : environment
                ? 370
                : 350
            : undefined
        }
        className="min-h-0 flex-1"
      >
        {/* ---- ЗҮҮН: давхаргын жагсаалт, эсвэл хамгийн урт диаграм ---- */}
        {!picker && split ? (
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {chartCards(
              (id, b) => split.has(`${id}:${b.id}`),
              /* Талбайн карт зүүн тийш ГАРАХГҮЙ — давхаргынхаа
                 бүлэгт үлдэнэ ({@link split}) */
              () => false,
            )}
          </div>
        ) : null}
        {listColumn ? (
          <div className="flex min-h-0 flex-col gap-2">
            <Card className="min-h-[140px] flex-1">
              <Head title="Давхарга">
                {/* Нэгийг СОНГОДОГ жагсаалтад (`mapPicker`) тоо утгагүй */}
                {mapPicker ? null : (
                  <span className="num text-[11.5px] text-ink-3">
                    {num(on.length)} / {num(set.layers.length)}
                  </span>
                )}
              </Head>
              <div
                className={
                  mapPicker
                    ? "dataset-panel-list pt-1.5"
                    : "min-h-0 flex-1 divide-y divide-line overflow-y-auto"
                }
              >
                {listIds.map((id) => {
                  const info = infos[id];
                  const error = failed[id];
                  const isOn = on.includes(id);
                  /* Асаалттай атлаа татагдаагүй, алдаагүй бол явагдаж байна */
                  const loading = isOn && !loaded[id] && !error;

                  /*
                    ⚠⚠ НЭГИЙГ СОНГОДОГ ЖАГСААЛТ нь "ӨГӨГДЛИЙН БАГЦ"-ын
                    ХЭЛБЭРЭЭР (хэрэглэгч, 2026-10-06: "урд талын check
                    тэмдгийг ав, Хяналтын хэлтсийн Өгөгдлийн багц шиг
                    болго"). Хуваалцсан `dataset-panel-*` ангиуд
                    ({@link SourceTabs}) — мөрийн өмнө геометрийн дүрс,
                    сонгосон мөр хүрээтэй, баруун талд ✓. Зөвхөн
                    `mapPicker` бүрдэлд; бусад хэлтсийн олон сонголттой
                    жагсаалт хуучнаараа.
                  */
                  if (mapPicker) {
                    const Glyph =
                      LAYER_ICONS[set.icons?.[id] ?? ""] ??
                      (info?.geometry === "Point" ? MapPin : info?.geometry === "Polyline" ? Spline : Hexagon);
                    return (
                      <div key={id} className={cn("dataset-panel-item", isOn && "is-selected")}>
                        <button
                          type="button"
                          className="dataset-panel-choice"
                          aria-pressed={isOn}
                          title={info?.name ?? set.names?.[id] ?? id}
                          onClick={() =>
                            !info ? retry(id) : showLayers([...on.filter((x) => mapIds.includes(x)), id])
                          }
                        >
                          <Glyph size={18} strokeWidth={1.5} className="dataset-panel-item-icon" />
                          <span className="dataset-panel-copy">
                            <strong>{info?.name ?? set.names?.[id] ?? id}</strong>
                            {error ? (
                              <span className="text-clay">{error}</span>
                            ) : (
                              <span className="num">
                                {info
                                  ? `${num(info.count)} бүртгэл · ${GEOMETRY_LABEL[info.geometry] ?? info.geometry}`
                                  : "Уншиж байна…"}
                              </span>
                            )}
                          </span>
                          {loading ? (
                            <Loader2 size={14} className="dataset-panel-check animate-spin text-ink-3" aria-hidden />
                          ) : isOn ? (
                            <Check size={14} className="dataset-panel-check" aria-hidden />
                          ) : null}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => (info ? toggle(id) : retry(id))}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-paper-hi",
                        isOn && "bg-paper-hi",
                      )}
                    >
                      {/*
                    Хайрцаг нь асаалттай эсэхийг хэлнэ, дүүргэлт нь
                    давхаргын өнгө — жагсаалт нь зургийн тайлбар болно
                  */}
                      <span
                        aria-hidden
                        className={cn(
                          "mt-[2px] size-3 shrink-0 rounded-[2px] border transition-colors",
                          isOn ? "border-transparent" : "border-line-2",
                        )}
                        style={isOn ? { background: toneOf(id) } : undefined}
                      />

                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            environment
                              ? "block text-[12px] leading-relaxed"
                              : "block truncate text-[12px] leading-tight",
                            isOn ? "text-ink" : "text-ink-2",
                          )}
                        >
                          {info?.name ?? set.names?.[id] ?? id}
                        </span>
                        {error ? (
                          <span className="mt-1 block text-[10.5px] leading-snug text-clay">
                            {error}
                          </span>
                        ) : (
                          <span className="num mt-1 block truncate text-[10.5px] leading-none text-ink-3">
                            {info
                              ? /* ⚠ "бичлэг" нь мэдээллийн сангийн үг —
                                   дэлгэцэд ХЭЗЭЭ Ч гарахгүй (хэлний
                                   дүрэм). Платформын үг нь "бүртгэл". */
                                `${num(info.count)} бүртгэл · ${GEOMETRY_LABEL[info.geometry] ?? info.geometry}`
                              : "Уншиж байна…"}
                          </span>
                        )}
                      </span>

                      {loading ? (
                        <Loader2
                          size={12}
                          className="mt-[2px] shrink-0 animate-spin text-ink-3"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : null}

        {/* ---- БАРУУН: зураг, доор нь диаграмын зурвас ----
             Зураг хаалттай эрхэд диаграм төв баганыг эзэлнэ */}
        {noMap ? (chartsBlock ?? <NoAccess text="Энэ цэсэд харах хэсэг сонгогдоогүй байна" />) : (
        <div className="flex min-h-0 flex-col gap-2">
          <Card className="relative min-h-[300px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/*
              Зураг нь давхаргагүй ч ҮРГЭЛЖ зурагдана.

              Урьд нь давхарга асаагаагүй үед зургийн оронд зураастай
              блок гарч, суурь зураг харагддаггүй байв — хэрэглэгч аль
              нутаг дэвсгэрийн тухай яригдаж байгааг мэдэхгүй, юу
              асаахаа ч сонгож чадахгүй. Одоо суурь зураг нээлттэй
              хэвээр, заавар нь дээр нь хөвнө.
            */}
              <LayerMap
                scale={set.scale}
                points={points.at.oid.length ? points.at : NO_POINTS}
                colors={points.colors ?? undefined}
                dots={dots}
                esriFirefly={Boolean(set.fireflyPoints)}
                pointScale={set.pointScale}
                visible={points.at.oid.length ? visible : NO_INDEX}
                shapes={{
                  data: shapes,
                  selected: picked,
                  /* Хязгаар нь амьд тул унтраахад хүрэшгүй ойртолт
                     өгөхөд л хангалттай */
                  labelZoom: showLabels ? labelZoom : OFF_ZOOM,
                  /* Нарийн дүрстэй давхаргад нимгэн хүрээ
                     ({@link LayerSet.thinEdge}) */
                  edge: set.thinEdge ? "thin" : undefined,
                  /* Хүрээ гарах эсэх нь хэлтсийн сонголт
                     ({@link LayerSet.shapeOutline}) */
                  outline: set.shapeOutline !== false,
                  /* Шошго нь АНГИЛЛЫН баганаас гарах үед нэг нэр олон
                     дүрсэд давтагдана — нэг нь л үлдэнэ */
                  labelUnique: set.labelBy != null,
                  /* Үнэлгээний хэлтэст: тод нарийн хүрээ, бүдэг
                     дүүргэлт, ижил өнгө (2026-10-06) — `crisp`
                     ({@link shapes.crisp}) */
                  crisp: environment,
                }}
                /* Объект үүсэх МӨЧИД уншигддаг тул цэг байхгүй үед ч
                 ЗААВАЛ өгнө — эс тэгвээс шошгын давхарга огт үүсэхгүй
                 бөгөөд дараа нь асаах боломжгүй */
                labels={{
                  text: points.text,
                  minzoom: showLabels ? labelZoom : OFF_ZOOM,
                }}
                basemap={basemap}
                onSelect={(uid) => {
                  setPicked(picked === uid ? null : uid);
                  /* Зураг дээрх дүрс аль хэдийн харагдаж байгаа тул
                     ойртуулахгүй — сонголт нь диаграмынх биш болов */
                  setRowPick(null);
                }}
                onHover={tip.onHover}
                focus={parcelFocus ?? pickFocus ?? rowFocus ?? focus}
                /* Бөөгнөрөл бүрдлийн сонголт ({@link LayerSet.cluster}) */
                cluster={Boolean(set.cluster)}
                clusterMaxZoom={set.clusterMaxZoom}
                clusterRadius={set.clusterRadius}
                overlays={overlays}
                onView={onView}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {/*
                НЭГЖ ТАЛБАРЫН ТОВЧ — суурь зургийн сонголтын доор,
                зүүн дээд буланд.

                ⚠ Товч нь ТӨЛӨВ (`aria-pressed`), үйлдэл биш.
                ⚠ Хол байхад товч нь ЗААВАЛ ХАРАГДАНА, зөвхөн юу
                болохыг нь хэлнэ ("1:13 000-аас ойртоно уу"): товчийг
                нуувал хэрэглэгч тийм боломж байгааг огт мэдэхгүй,
                харин асаагаад юу ч гарахгүй бол эвдэрсэн гэж үзнэ.
                ⚠ Хязгаарт хүрсэн үед ил хэлнэ — дутуу зургийг бүтэн
                мэт харуулах нь худал.
                ⚠⚠ АНХНААСАА АСААЛТТАЙ ЦЭСЭД ТОВЧ ГАРАХГҮЙ
                ({@link LayerSet.parcels}, хэрэглэгч 2026-10-02: "энэ
                товч хэрэггүй"). Дээрх "товчийг нуухгүй" дүрэм нь
                УНТРААЛТТАЙ үед хамаарна: тэнд товч нь тийм боломж
                байгааг зарладаг. Асаалттай үед нэгж талбар нь зураг
                дээр аль хэдийн харагдаж байгаа тул зарлах зүйлгүй.
                ⚠ Төлөвийн мэдэгдэл нь ҮЛДЭНЭ: давхцал тооцогдож
                дуустал, хязгаарт хүрсэн эсэхийг хэлэх ёстой.
              */}
              {/* Суурь зургийн тэмдгийн ЯГ ДООР (top-2.5 + 28px + 8px):
                  шошгын унтраалга, түүний доор давхаргын сонголт (хэрэглэгч
                  2026-10-16: "basemap iconii door bairluul") */}
              <div className="absolute top-[46px] right-2.5 z-[15] flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  aria-pressed={showLabels}
                  onClick={() => setShowLabels((v) => !v)}
                  title={
                    showLabels
                      ? "Шошгыг унтраах"
                      : `Шошгыг асаах (1:${num(LABEL_SCALE)}-аас ойртоход)`
                  }
                  className={cn(
                    "elevated flex size-8 items-center justify-center rounded-xs border backdrop-blur-md transition-colors",
                    showLabels
                      ? "border-data/50 bg-data/15 text-ink"
                      : "border-line bg-paper/85 text-ink-3 hover:text-ink",
                  )}
                >
                  <Tag size={14} strokeWidth={1.75} />
                </button>
              {mapIds.length ? (
                <div>
                  <MapLayerPicker
                    items={mapIds.map((id) => {
                      const info = infos[id];
                      const isOn = on.includes(id);
                      return {
                        id,
                        name: info?.name ?? set.names?.[id] ?? id,
                        tone: toneOf(id),
                        on: isOn,
                        sub: info
                          ? `${num(info.count)} бүртгэл · ${GEOMETRY_LABEL[info.geometry] ?? info.geometry}`
                          : "Уншиж байна…",
                        error: failed[id],
                        loading: isOn && !loaded[id] && !failed[id],
                      };
                    })}
                    onToggle={(id) => (infos[id] ? toggle(id) : retry(id))}
                  />
                </div>
              ) : null}
              </div>
              {/* ⚠ НЭГЖ ТАЛБАРЫН ТОВЧ үнэлгээний хэлтэст ГАРАХГҮЙ (хэрэглэгч,
                  2026-10-06: "тэр нэгж талбарыг del, хэлтсийн бүх
                  самбарын зураг дээр байхгүй") — бусад хэлтэст хэвээр */}
              {environment ? null : (
              <div className="absolute top-12 left-2 z-20 flex flex-col items-start gap-1">
                {set.parcels === true ? null : (
                  <button
                    type="button"
                    aria-pressed={parcelsOn}
                    onClick={() => {
                      const next = !parcelsOn;
                      setParcelsOn(next);
                      /* Унтраахад ойртолтын дарлалтыг мөн тавина —
                       давхаргын өөрийн хүрээ буцаж хүчин төгөлдөр */
                      if (!next) return setParcelFocus(null);
                      if (close || !view) return;
                      /* Одоогийн төвийг хадгалан хязгаар хүртэл ойртоно.
                       Хүрээний ӨРГӨН нь хоёр дахин багасахад ойртолт
                       нэгээр нэмэгдэнэ тул зөрүүг хоёрын зэргээр
                       хуваана */
                      const [w, s2, e, n] = view.box;
                      /* ⚠ Хязгаараас ЦААШ түлхэж бодно: `fitBounds`
                       нь 44px зайтай, `maxZoom: 14`-ээр таглагддаг
                       тул яг хязгаар дээр тооцвол таглаанд бага
                       зэрэг дутаж буудаг */
                      const k = 2 ** (view.zoom - parcelZoom - 0.7);
                      const cx = (w + e) / 2;
                      const cy = (s2 + n) / 2;
                      const dx = ((e - w) / 2) * k;
                      const dy = ((n - s2) / 2) * k;
                      setParcelFocus([cx - dx, cy - dy, cx + dx, cy + dy]);
                    }}
                    className={cn(
                      "elevated rounded-xs border px-2 py-1 text-[11px] backdrop-blur-md transition-colors",
                      parcelsOn
                        ? "border-transparent bg-paper-hi text-ink"
                        : "border-line-2 bg-paper/92 text-ink-2 hover:text-ink",
                    )}
                  >
                    Нэгж талбар
                  </button>
                )}
                {/*
                  ⚠ ОЙРТОХОД ӨӨРӨӨ ГАРДАГ ХИЛ ({@link LayerSet.parcelsNear})
                  ХОЛ байхад, эсвэл уншигдаагүй үед ИЛ хэлнэ — эс тэгвээс
                  "хил харагдахгүй байна" гэдгийн шалтгаан нуугдана
                  (хэрэглэгч, 2026-10-06).
                */}
                {!parcelsOn &&
                set.parcelsNear &&
                (!close || parcelErr || shownParcels.capped) ? (
                  <span
                    className={cn(
                      "num max-w-[260px] rounded-xs bg-paper/92 px-1.5 py-0.5 text-[10px] backdrop-blur-md",
                      parcelErr && close ? "text-clay" : "text-ink-3",
                    )}
                  >
                    {parcelErr && close
                      ? `Нэгж талбар уншигдсангүй: ${parcelErr}`
                      : close && shownParcels.capped
                        ? /* Хязгаараас олон — хэсэгчилсэн тор зурахгүй,
                             тоогоор нь хэлнэ ({@link fetchParcelsIn}) */
                          `${num(shownParcels.total ?? 0)} нэгж талбар — ойртуулна уу`
                        : `Нэгж талбарын хил 1:${num(PARCEL_SCALE)}-аас ойртоход харагдана`}
                  </span>
                ) : null}
                {parcelsOn ? (
                  <span className="num rounded-xs bg-paper/92 px-1.5 py-0.5 text-[10px] text-ink-3 backdrop-blur-md">
                    {/*
                      БҮСТЭЙ ЦЭСЭД мэдэгдэл нь ДАВХЦЛЫГ хэлнэ:
                      тэнд нэгж талбар нь ойртолтоос үл хамааран
                      гардаг тул "ойртоно уу" гэдэг нь худал болно.
                    */}
                    {zoneRings.length
                      ? !zoneClose
                        ? `1:${num(ZONE_SCALE)}-аас ойртоно уу`
                        : zoneBusy
                          ? "Давхцлыг тооцож байна…"
                          : shownZoneParcels.tooMany
                            ? `${num(shownZoneParcels.total ?? 0)} давхцсан · ойртоно уу`
                            : `${num(shownZoneParcels.data.features.length)} давхцсан${
                                shownZoneParcels.capped ? ", хэсэгчилсэн" : ""
                              }`
                      : !close
                        ? `1:${num(PARCEL_SCALE)}-аас ойртоно уу`
                        : shownParcels.capped
                          ? `${num(shownParcels.data.features.length)}, хэсэгчилсэн`
                          : num(shownParcels.data.features.length)}
                  </span>
                ) : null}
              </div>
              )}
              {/*
                ТАНИХ ТЭМДЭГ — БҮХ порталын самбарт (2026-09-29,
                хэрэглэгч: "map дээр legend оруулаарай"). Урьд нь
                зөвхөн үнэлгээний хэлтэст гардаг байв.

                ⚠ Хамгаалалтын бүс шиг ЗАДАРГААГҮЙ давхаргууд дээр
                энэ нь цорын ганц зам: гурван бүс нь `tabHues`-ээр
                тарсан гурван ногооноор зурагддаг атлаа аль нь аль нь
                болох нь зураг дээр хаана ч бичигдээгүй байв.
                ⚠ Задаргаатай давхаргад диаграм нь тайлбарын үүргийг
                аль хэдийн гүйцэтгэдэг (`palettes` нь НЭГ эх сурвалж)
                — тайлбар нь түүнийг давтахгүй, зураг ДЭЭР хэлнэ.
                ⚠ Хураагдана (`<details>`): ойн хэлтэс долоон
                давхаргатай тул хэрэглэгч хаах боломжтой байх ёстой.
              */}
              {views.length ? (
                <TopicMapLegend
                  hideable={environment}
                  groups={views.map(({ id, hit }) => {
                    const field = colorField(id);
                    const breakdown = hit.charts.find(
                      (b) => b.field === field && b.kind === "count",
                    );
                    return {
                      id,
                      name: hit.info.name,
                      geometry: hit.info.geometry,
                      field: breakdown?.label,
                      /* Задаргаагүй давхарга НЭГ мөр болно: өнгө нь
                         давхаргынх, шошго нь давхаргын нэр */
                      solo: !breakdown,
                      items: breakdown
                        ? breakdown.values.map((d) => ({
                            key: d.key,
                            label: d.label,
                            color:
                              palettes[id]?.colors.get(d.key) ?? toneOf(id),
                          }))
                        : [
                            {
                              key: id,
                              label: hit.info.name,
                              /*
                                ⚠⚠ ЦЭГЭН давхаргын өнгө нь ДАВХАРГЫН
                                ТОН БИШ. Зураг дээр цэг нь firefly
                                палитраар зурагддаг (`FIREFLY`,
                                тогтмол цэнхэр) — давхаргын өнцөг нь
                                зөвхөн ДҮРС (fill, line) дээр
                                хэрэглэгддэг. Тонг нь тайлбарт
                                бичвэл дэлгэц дээр байхгүй өнгийг
                                нэрлэсэн болно.
                              */
                              color:
                                hit.info.geometry === "Point"
                                  ? FIREFLY.mid
                                  : toneOf(id),
                            },
                          ],
                    };
                  })}
                />
              ) : null}


              <MapTip state={tip} width={248}>
                {hovered ? (
                  <>
                    {/* Аль давхаргынх болохыг эхэнд — нэг зураг дээр
                        найман давхарга нийлдэг тул хамгийн түрүүнд
                        хариулах ёстой асуулт нь тэр */}
                    <div className="px-2.5 pt-2 pb-1">
                      <span
                        className="text-[10px] leading-none tracking-[0.08em] uppercase"
                        style={{ color: toneOf(hovered.id) }}
                      >
                        {hovered.info.name}
                      </span>
                    </div>
                    {/*
                      Талбарыг ЭХНЭЭС нь дараалуулж авбал дугаар,
                      техникийн код гарч ирдэг байв. Оронд нь диаграм
                      юу гэж үздэг тэр гурвыг л харуулна: нэр, хэмжээ,
                      ангилал — бүгд ижил эх сурвалжаас.
                    */}
                    <div className="space-y-1 px-2.5 pt-1 pb-2">
                      {tipRows(hovered.hit, hovered.row).map((r) => (
                        <MapTipRow
                          key={r.text}
                          icon={r.icon}
                          num={r.num}
                          text={r.text}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </MapTip>

              {/*
              Сонгосон бичлэг нь зураг дээр ХӨВНӨ, багана эзлэхгүй.

              Урьд нь баруун баганын дээд талд суудаг байсан тул задаргаа
              бүхэлдээ доошоо түлхэгдэж, дэлгэцээс халих шалтгаан болдог
              байв. Платформын бусад ес самбартай ижил шийдэл: чирж
              зөөгддөг, хэмжээ нь солигддог хөвөгч самбар.
            */}
              {active && !noRecord ? (
                <RecordPanel
                  hit={active.hit}
                  row={active.row}
                  oid={(picked ?? 0) - uidBase(active.id)}
                  place={places[active.id]?.get(
                    (picked ?? 0) - uidBase(active.id),
                  )}
                  /* Зургийн өнгөтэй НЭГ эх сурвалж — ангиллаар будсан бол
                     тэр ангиллын өнгө, эс бөгөөс давхаргынх */
                  tone={
                    palettes[active.id]?.colors.get(
                      palettes[active.id]?.keyOf(active.row)[0] ?? "",
                    ) ?? toneOf(active.id)
                  }
                  onClose={() => setPicked(null)}
                />
              ) : null}

              {/*
              ⚠⚠ АЛДАА ХААНА Ч ГАРАХГҮЙ БАЙВ (2026-09-28). Жагсаалттай
              цонхонд давхаргын татацын алдаа мөрөндөө ил бичигддэг —
              `openAll` цонхонд тэр жагсаалт БАЙХГҮЙ тул алдаа хаана ч
              буудаггүй байлаа. Давхаргууд асаалттай (`on.length > 0`)
              тул доорх "уншигдсангүй" мэдэгдэл ч гарахгүй, задаргааны
              багана нь "Задаргаа гарахуйц талбар олдсонгүй" гэж
              ДАТАНЫ тухай өгүүлбэр бичнэ — техникийн гэмтлийг баримт
              мэт харуулж байгаа хэрэг.
              ⚠ Бодит нөхцөл: токен хугацаа дуусах, давхарга устгагдах,
              сүлжээ тасрах. Гурвуулаа "энэ давхаргад ангилал байхгүй"
              гэж ХУДЛАА уншигдаж байв.
              ⚠⚠ ГУРАВ ДАХЬ ТӨЛӨВ: `mapNote` (2026-09-25). Давхарга нь
              атрибут → геометр гэсэн ХОЁР ҮЕ ШАТААР ирдэг тул "бичлэг
              бий, дүрс алга" гэсэн завсрын байдал үүснэ — тэр нь
              АЛДАА БИШ тул `failed`-д буудаггүй, гэхдээ зураг хоосон
              харагдана. Гурвуулаа НЭГ мэдэгдэлд нийлнэ: гарчиг нь
              төлөвөө хэлж, серверийн хариу доор нь бүтнээрээ гарна.
            */}
              {!picker &&
              (on.length === 0 || on.every((id) => failed[id]) || mapNote) ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div className="elevated max-w-[340px] rounded-xs border border-line bg-paper/92 px-4 py-3 text-center backdrop-blur-md">
                    <p className="text-[12.5px] leading-relaxed text-ink-2">
                      {on.length === 0 || on.every((id) => failed[id])
                        ? "Давхарга уншигдсангүй."
                        : mapNote}
                    </p>
                    {/* Серверийн хариуг БҮТНЭЭР нь дамжуулна: "Invalid
                        Token" ба "Item does not exist" хоёр нь тэс өөр
                        арга хэмжээ шаардана */}
                    {on
                      .map((id) => failed[id])
                      .filter((m): m is string => Boolean(m))
                      .slice(0, 2)
                      .map((message) => (
                        <p
                          key={message}
                          className="num mt-1.5 text-[11px] leading-snug text-ink-3"
                        >
                          {message}
                        </p>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS Enterprise · хүрээг ~10 метрээр
            ерөнхийлсөн
          </p>
        </div>
        )}

        {/* ---- БАРУУН: ангиллын задаргаа ---- */}
        {noMap ? null : chartsBlock}
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Хөвөгч тайлбарт ЮУ бичих вэ.
 *
 * Талбарыг эхнээс нь дараалуулж авбал дугаар, техникийн код гарч
 * ирдэг — хулганы доорх дүрс юу болохыг тэр хэлэхгүй. Оронд нь
 * диаграм юу гэж үздэг тэр гурвыг л харуулна: НЭР, ХЭМЖЭЭ, дараа нь
 * хамгийн сайн задалж буй ХОЁР ангилал.
 *
 * Хоосон утга ОГТ орохгүй: "—" гэсэн мөр нь зай эзлэхээс өөр юу ч
 * хэлэхгүй.
 */
function tipRows(
  hit: Loaded,
  row: Record<string, unknown>,
): { icon: typeof Tag; text: string; num?: boolean }[] {
  const out: { icon: typeof Tag; text: string; num?: boolean }[] = [];

  if (hit.labels.name) {
    const v = categoryKey(row[hit.labels.name]);
    if (v !== "Бүртгэгдээгүй") out.push({ icon: Tag, text: v });
  }

  if (hit.labels.measure) {
    const v = Number(row[hit.labels.measure.field]);
    if (Number.isFinite(v)) {
      out.push({
        icon: Ruler,
        num: true,
        text: `${measureText(v)} ${hit.labels.measure.unit}`.trim(),
      });
    }
  }

  for (const b of hit.charts) {
    if (out.length >= 4) break;
    if (b.kind !== "count") continue;
    const v = b.keyOf(row).join(", ");
    if (!v || v === "Бүртгэгдээгүй") continue;
    out.push({ icon: Shapes, text: `${b.label}: ${v}` });
  }

  return out;
}

/** Хугацааны цуваа мөн үү */
function isTime(b: Breakdown): boolean {
  return b.kind === "year" || b.kind === "month";
}

/**
 * ШҮҮЛТИЙН ТҮЛХҮҮР — талбарын нэр, гэхдээ ХУГАЦААНД нь `kind` нэмнэ.
 *
 * ⚠⚠ ОГНООНЫ ТАЛБАР ХОЁР ДИАГРАМ ТӨРҮҮЛНЭ: жилийн цуваа ба сарын
 * хуваарилалт. Тэдний `keyOf` нь ӨӨР ("2020" ба "1-р сар") атлаа
 * талбарын нэр нь НЭГ. Шүүлтийг зөвхөн талбарын нэрээр түлхүүрлэхэд
 * `keyBy` нь эхний диаграмынхыг (он) авдаг тул **САРААР ШҮҮХЭД
 * БҮХ МӨР УНАДАГ байв** — самбар бүхэлдээ хоосон болно (2026-09-29-нд
 * синтетик датаар илрүүлэв: "1-р сар" → 0 мөр, диаграм нь 5 гэж
 * бичсэн байхад).
 * ⚠ Кодод "нэг талбарын диаграмууд бүгд ижил дүрэмтэй" гэж бичигдсэн
 * таамаг байсан нь ангиллын диаграмд үнэн (тоолол ба хэмжилт нэг
 * `keyOf` хуваалцана — тэд шүүлтээ ЗОРИУДААР хуваалцдаг) ч хугацаанд
 * худал.
 * ⚠ Цэсэнд (`menusOf`) хугацааны диаграм ОРДОГГҮЙ тул энэ нь зөвхөн
 * диаграм дээрх товшилтод хамаарна.
 */
function filterKey(b: Breakdown): string {
  return isTime(b) ? `${b.field}\u0000${b.kind}` : b.field;
}

/**
 * Сонгосон ОНУУДЫГ л үлдээнэ.
 *
 * ⚠ Өнгө нь БҮТЭН жагсаалтаас гарах ёстой: хоёр оныг нуусны дараа
 * гурав дахь нь өнгөө сольвол "2025 он" гэдэг нь өмнөхөөсөө өөр өнгө
 * болж, хэрэглэгч өөр зүйл харж байгаа мэт эндүүрнэ.
 */
/*
  ЦУВАА БҮРИЙН НЭРТ НЭГЖ, ЗАРИМ ЦУВАА ХАСАГДАНА (хэрэглэгч, 2026-10-06:
  "урд нь ганц м² биш зүлэг м², цэцэг м² болгоод талбайг del").
  Тайлбарын эхэнд ганц "м²" бичвэл аль цуваанд хамаарах нь ойлгомжгүй
  байв. `drop`-д таарсан цуваа (`LayerSet.compareDrop`) өнгөнийхөө хамт
  хасагдана — өнгө, мөр хоёр индексээрээ зэрэгцдэг тул хамт шүүнэ.
*/
/** `LayerSet.icons`-ийн түлхүүр → давхаргын агуулгын тэмдэг (жагсаалт, индикатор) */
const LAYER_ICONS: Record<string, typeof Shapes> = {
  tree: TreeDeciduous,
  trash: Trash2,
  bike: Bike,
  footprints: Footprints,
  flower: Flower,
  shield: Shield,
};

/** `LayerSet.stats`-ийн тэмдгийн түлхүүр → lucide тэмдэг */
const STAT_ICONS: Record<string, typeof Shapes> = {
  trees: Trees,
  flower: Flower2,
  sprout: Sprout,
  leaf: Leaf,
  shapes: Shapes,
};

function unitSeries(
  s: { groups: NonNullable<Breakdown["groups"]>; colors: string[] },
  unit: string | undefined,
  drop: RegExp | undefined,
  hues?: Record<string, number>,
): { groups: NonNullable<Breakdown["groups"]>; colors: string[] } {
  const first = s.groups[0]?.rows ?? [];
  const keep = first.map((r, i) => (drop && drop.test(r.label.trim()) ? -1 : i)).filter((i) => i >= 0);
  const name = (label: string) => (unit ? `${label}, ${unit}` : label);
  return {
    groups: s.groups.map((g) => {
      const rows = keep.map((i) => ({ ...g.rows[i], label: name(g.rows[i].label) }));
      /* Нийт дүн ҮЛДСЭН цуваанаас — хасагдсан "Талбай" орохгүй */
      return { ...g, rows, total: rows.reduce((t, r) => t + r.value, 0) };
    }),
    /* Цувааны ӨӨРИЙН өнгө ({@link LayerSet.seriesHues}) — нэг цэнхэр
       шатлалын хөрш хоёр алхам ялгагдахгүй байв (хэрэглэгч, 2026-10-06:
       "зүлэг, цэцэгийн өнгийг өөр өг, ялгагдахгүй байна") */
    colors: keep.map((i) => {
      const h = hues?.[first[i].label.trim()];
      /* БҮДЭГ (хэрэглэгч, 2026-10-06: "ногоон, ягаан өнгийг бүдэгхэн
         болго") — ханалт 0.15 → 0.08, гэрэлтэлт 0.74 → 0.78 */
      return h == null ? (s.colors[i] ?? s.colors[0]) : toneOfHue(h, 0.78, 0.08);
    }),
  };
}

function shownSeries(
  b: Breakdown,
  years: string[] | undefined,
  hue: number,
): { groups: NonNullable<Breakdown["groups"]>; colors: string[] } {
  const groups = b.groups ?? [];
  const all = groups[0]?.rows ?? [];
  const ramp = seriesRamp(hue, all.length || 1);

  if (!years?.length) return { groups, colors: ramp };

  const keep = all
    .map((r, i) => (years.includes(r.label) ? i : -1))
    .filter((i) => i >= 0);
  if (!keep.length) return { groups, colors: ramp };

  return {
    groups: groups.map((g) => ({ ...g, rows: keep.map((i) => g.rows[i]) })),
    colors: keep.map((i) => ramp[i]),
  };
}

/**
 * Тайлбарын БҮТЭН жагсаалт — нуусан цуваа нь `on: false`-оор үлдэнэ.
 * Өнгө нь {@link shownSeries}-тэй ижил шатлалаас (бүтэн жагсаалтын
 * байрлалаар), эс тэгвээс тайлбар ба зурвас өөр өнгө хэлнэ.
 * Шүүлтгүй (эсвэл таарах он үгүй) үед бүгд асаалттай.
 */
function seriesLegend(
  b: Breakdown,
  years: string[] | undefined,
  hue: number,
): { key: string; label: string; color: string; on: boolean }[] {
  const all = b.groups?.[0]?.rows ?? [];
  const ramp = seriesRamp(hue, all.length || 1);
  const any = all.some((r) => years?.includes(r.label));
  return all.map((r, i) => ({
    key: r.key,
    label: r.label,
    color: ramp[i],
    on: !any || Boolean(years?.includes(r.label)),
  }));
}

/**
 * ШҮҮЛТҮҮРИЙН МӨРӨНД ямар цэс гарах вэ.
 *
 * Талбар бүрд НЭГ цэс: нэг талбар хэд хэдэн диаграм төрүүлдэг
 * (ангиллын тоо, тэр ангиллаар хэмжсэн талбай) ч шүүлт нь нэг.
 * Хугацааны диаграм орохгүй — тэдний "ангилал" нь он, сар бөгөөд
 * тэднийг диаграмаас нь шууд товшсон нь дээр.
 *
 * ⚠ Зөвхөн тоолол дээр тулгуурлавал ДҮҮРЭГ шиг бичлэг тутамд өөр
 * утгатай талбар цэсэнд огт гарахгүй байв — тийм талбар нь ангилал
 * болж чаддаггүй ч ШҮҮЛТ болж чаддаг.
 */
function menusOf(charts: Breakdown[]): Breakdown[] {
  const out: Breakdown[] = [];
  const seen = new Set<string>();

  for (const b of charts) {
    if (isTime(b) || seen.has(b.field)) continue;
    if (!b.values.length) continue;
    seen.add(b.field);
    out.push(b);
  }
  return out;
}

/**
 * Давхаргад ямар ОН байна вэ.
 *
 * Цуваануудын нэр нь оны дараалал болсон үед л (эх сурвалж жил бүрд
 * нэг багана бичсэн) оноор шүүх утгатай. Нэр нь он биш бол
 * (хэмжилтүүд нь өөр өөр зүйл) шүүх зүйл алга — цэс гарахгүй.
 */
function yearsOf(charts: Breakdown[]): string[] {
  const out = new Set<string>();

  for (const b of charts) {
    if (b.kind !== "compare") continue;
    for (const r of b.groups?.[0]?.rows ?? []) {
      if (/^(19|20)\d{2}$/.test(r.label)) out.add(r.label);
    }
  }
  return [...out].sort();
}

/**
 * Бөгжин диаграм хэзээ тохирох вэ.
 *
 * Бөгж нь БҮХЭЛ ЗҮЙЛИЙН ХУВААРИЛАЛТ-ыг хэлнэ, зурвас нь харьцуулалтыг.
 * Хоёр, гурван утгатай ангиллыг зурвасаар зурвал хагас хоосон карт
 * үлдэж, харьцаа нь ч шууд уншигдахгүй — тэнд бөгж илүү.
 *
 * ⚠ ГУРВАН тохиолдолд БОЛОХГҮЙ:
 * 1. **Олон утгатай задаргаа** — нэг бичлэг хоёр ангилалд орвол
 *    зүсмүүд давхцаж, нийлбэр нь бүхэлээс их болно. Бөгж нь тэгснээ
 *    харуулж чадахгүй тул зүгээр л ХУДАЛ хэлнэ.
 * 2. **Дундаж** — хувийн дундажууд нийлээд бүхэл зүйл болдоггүй.
 * 3. **Хураасан жагсаалт** — үлдсэн хэсэг нь огт байхгүй мэт харагдана.
 */
function isPie(b: Breakdown): boolean {
  if (b.kind !== "count" && b.kind !== "sum") return false;
  if (b.multi) return false;
  if (b.top) return false;
  return b.values.length >= 2 && b.values.length <= PIE_MAX;
}

/** Бөгжин диаграмд багтах зүсмийн дээд тоо */
const PIE_MAX = 4;

/**
 * Засаг захиргааны шатлал — ӨРГӨНӨӨС НАРИЙН руу.
 *
 * Эх сурвалж нэг давхаргад хэд хэдэн шатыг зэрэг бичдэг (`aimag`,
 * `duureg`, `horoo`) бөгөөд тэдгээр нь бие даасан задаргаанууд биш
 * НЭГ ТЭНХЛЭГИЙН нарийвчлалын шатууд. Тиймээс тэдгээр нь хамт сууж,
 * өргөнөөс нарийн руу эрэмбэлэгдэх ёстой: дүүрэг дээр нь, хороо
 * доор нь. Эсрэгээр байрлуулбал хэрэглэгч нарийныг нь эхэлж уншаад
 * хүрээгээ дараа нь олдог.
 *
 * ⚠ Кирилл дээр `\b` ажилладаггүй тул үгийг ЗАЙГААР хүрээлж таана —
 * эс тэгвээс "Багц" доторх "баг", "Сумын дарга" доторх "сум" зэрэг
 * санамсаргүй таарал үүснэ ({@link src/lib/chemsystem.ts}-ийн
 * `placeOf`-той нэг арга).
 */
const ADMIN_WORDS: string[][] = [
  ["аймаг", "нийслэл", "aimag"],
  ["сум", "дүүрэг", "soum", "duureg"],
  ["баг", "хороо", "bag", "horoo", "khoroo"],
];

function adminRank(label: string): number | null {
  const t = ` ${label
    .toLocaleLowerCase("mn")
    .replace(/[^0-9a-zа-яөүё]+/gi, " ")
    .trim()} `;
  for (let i = 0; i < ADMIN_WORDS.length; i += 1) {
    if (ADMIN_WORDS[i].some((w) => t.includes(` ${w} `))) return i;
  }
  return null;
}

/**
 * Диаграмын гарчиг.
 *
 * Гарчиг нь ХОЁР асуултад хариулах ёстой: юуг хэмжсэн бэ, юугаар нь
 * задалсан бэ. Нэг талбар дээр хэдэн диаграм зэрэгцэж болдог тул
 * (ангиллын тоо, тэр ангиллаар хэмжсэн талбай) зөвхөн талбарын нэр
 * бичвэл хоёр карт ялгагдахгүй болно.
 *
 * Хэмжигдэхүүнийг ЭХЭНД, зүсэлтийг араас нь тавина: "Талбай
 * тогтоолоор, га — Түвшин". Нэгжийг эх сурвалж өөрөө нэртээ бичдэг
 * тул энд нэмэхгүй.
 */
function chartTitle(b: Breakdown): string {
  /* Хураасан бол ЗААВАЛ хэлнэ — дутуу жагсаалтыг бүтэн мэт харуулбал
     диаграм өөрөө худал хэлнэ */
  const cut = b.top ? ` (эхний ${b.top})` : "";

  switch (b.kind) {
    /*
      ⚠⚠ "— бичлэгийн тоо" ДАГАВАР ХАСАГДСАН (хэрэглэгчийн шийдвэр,
      2026-09-28: "энэ чартуудын дээр байгаа бичлэгийн тоо — del,
      хэзээ ч албан ёсны webapp хийж байгаа тохиолдолд тэгж бичихгүй").

      ⚠ Энэ нь дэлгэц дээр гарах бичвэрийн дүрэм: "бичлэг" гэдэг нь
      МЭДЭЭЛЛИЙН САНГИЙН үг — эцсийн хэрэглэгч агуулах, зөвшөөрөл,
      цэгийг хардаг болохоос "бичлэг" хардаггүй. Арга зүйн тайлбар
      дэлгэцэд гаргахгүй дүрэмтэй нэг гэр бүл.

      ⚠ Тоолол ба хэмжилт нь ХЭВЭЭР ялгагдана: нийлбэр, дундаж нь
      гарчгийнхаа ЭХЭНД хэмжигдэхүүнээ бичдэг ("Талбай, га — Дүүрэг")
      тул нүцгэн нэр нь өөрөө тоолол гэдгийг хэлнэ. Зурвасын утга нь
      ч бүхэл тоо байна.
    */
    case "count":
      return `${b.label}${cut}`;
    case "sum":
      return `${b.measure ?? ""} — ${b.label}${cut}`;
    /* Дундаж нь нийлбэрээс ЭРС өөр утга — гарчигт нь ил хэлэхгүй бол
       хоёр диаграм ижил харагдана */
    case "mean":
      return `${b.measure ?? ""} — ${b.label}, дундаж${cut}`;
    case "compare":
      /* Цуваануудын нийтлэг нэр ("Мод бэлтгэсэн талбай") байвал түүгээр —
         "Харьцуулалт" нь юуг хэмжсэнийг хэлдэггүй байв (2026-10-06) */
      return `${b.subject ?? "Харьцуулалт"}, ${b.measure ?? ""} — ${b.label}${cut}`;
    /*
      ⚠⚠ ОГНООНЫ ТАЛБАР ӨӨРИЙН НЭРЭЭРЭЭ ГАРНА (хэрэглэгчийн шийдвэр,
      2026-09-28: "тусгай зөвшөөрөл авсан огноо болго гэх мэтээр
      чартын нэрсийг албаны болго").

      Нэр нь аль хэдийн огноо гэдгээ хэлчихсэн байвал араас нь
      "жилээр", "жилийн хуваарилалт" гэж хавсаргах нь албан нэршлийг
      мэдээллийн сангийн тайлбар болгоно — "Тусгай зөвшөөрөл авсан
      огноо, жилээр" гэж уншигдана. Тэнхлэг нь өөрөө онуудыг бичдэг
      тул давталт нь мэдээлэл ч нэмэхгүй.

      ⚠ Огноо гэж нэрлээгүй талбар (жишээ нь "Бүртгэл") дээр
      хуваарилалтыг ЗААВАЛ хэлнэ — эс тэгвээс тоолол мөн үү, жил мөн
      үү гэдэг нь гарчигнаас уншигдахгүй.
      ⚠ САРЫН диаграм ДАГАВАРТАЙ хэвээр тул нэг талбарын жил, сарын
      хоёр карт ялгагдана ("… огноо" ба "… огноо, сараар").
    */
    case "year":
      return /огноо|он|жил|year|date/i.test(b.label)
        ? `${b.label}${cut}`
        : `${b.label}, жилээр${cut}`;
    /* Сар нь ЖИЛТЭЙ ижил дүрэмтэй: нэр нь өөрөө "сар" гэж хэлсэн бол
       дагавар нэмэхгүй. Ингэснээр нэг давхаргын "Он" ба "Сар" хоёр
       карт тэгш харагдана; харин НЭГ талбарын жил, сарын хоёр карт
       (аврагдсан амьтдын "Огноо") ялгагдсан хэвээр — тэр нэрэнд
       "сар" гэсэн үг байхгүй тул дагавраа авна. */
    case "month":
      return /сар|month/i.test(b.label)
        ? `${b.label}${cut}`
        : `${b.label}, сараар${cut}`;
    default:
      return b.label;
  }
}

/**
 * Хэмжигдэхүүний бичиглэл.
 *
 * Талбай мянгаараа, хувь нэгжээрээ явдаг тул нэг дүрэм хоёуланд
 * тохирохгүй: том тоог бүхэлчилж таслалаар нь салгана, жижгийг нь
 * бутархайгаар үлдээнэ — эс тэгвээс "0" гэсэн мөр гарч утга алга
 * болно (ерөнхий үнэлгээний талбайн бичиглэлтэй ижил үндэслэл).
 */
/**
 * МӨРИЙН НЭМЭЛТ УТГА — нэрийн ард, бүдэг бичвэрээр.
 *
 * Нэг талбарын тоолол ба хэмжилтийн диаграм нэгтгэгдсэн үед л
 * гарна ({@link Breakdown.note}).
 *
 * ⚠ НЭГЖ МӨР БҮРД БИЧИГДНЭ ("191,559 га"): зурвас нь
 * бичлэгийн тоог хэмжиж байгаа тул хоёр дахь тоо юуных болох нь
 * ӨӨРӨӨСӨӨ уншигдах ёстой — гарчгаас хайж уншина гэж найдахгүй.
 */
/**
 * ЧАРТЫН ӨНГӨ ТУНГАЛАГ (хэрэглэгч 2026-10-07: "чартын өнгийг жаахан
 * transparent хийгээд үз") — дүүргэлт ба түүнд харгалзах дөрвөлжин ~72%;
 * бичвэр, тоо бүтэн тод хэвээр. Зөвхөн `#rrggbb` өнгөнд (газрын зургийн
 * палитр); бусад хэлбэрийг хөндөхгүй.
 */
function soft(color: string | undefined): string | undefined {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}b8` : color;
}

/**
 * БҮЛГЭЭР ЗАДАРСАН ТАЛБАЙН ЖАГСААЛТ ({@link LayerSet.shareChart},
 * {@link LayerSet.valueGroups}; хэрэглэгч 2026-10-07, ойн ялгарал:
 * газрын зураг утгаар бүлэглэсэн өнгөтэй болсны дараа "одоо чартыг" →
 * гурван хувилбараас).
 *
 * Зурагтай ИЖИЛ бүлэг (ой, ойжилт · эвдрэл · ойгүй талбай): бүлэг бүрийн
 * толгойд нийт га, нийтэд эзлэх нимгэн зурвас; доор нь ангиллууд
 * өнгө · нэр · зурвас · га. ⚠ ХУВЬ ХАСАГДСАН (хэрэглэгч 2026-10-07:
 * "хувийг хас") — attribute биш тооцоо байсан.
 * ⚠ Мөрийн зурвас нь БҮЛЭГ ДОТРОО хуваарилагдана (бүлгийн хамгийн их
 *   ангилал бүтэн) — нэг хуваарьт Ой (73%) бусдыг үл үзэгдэх зураас
 *   болгодог байв. Бүлэг хоорондын харьцуулалт нь толгойн зурвас, хувь.
 * ⚠ Бүлгийн толгой товшиход тэр бүлгийн БҮХ ангиллаар шүүнэ
 *   (`onGroup`); дахин товшиход цуцлагдана. Мөр нь ганц ангиллаар.
 * ⚠ Бүлэгт ороогүй ангилал "Бусад" бүлэгт — чимээгүй алга болохгүй.
 *   Бүлэггүй давхаргад бүгд нэг гарчиггүй бүлэг.
 * ⚠ Өмнөх дөрвөн хувилбар (`ShareList`, `ShareTreemap`, `ShareWaffle`,
 *   `ShareSplit`) кодоос УСТСАН — дахин бүү санал болго.
 */
function ShareGroups({
  data,
  area,
  unit,
  groups,
  colorOf,
  selected,
  onSelect,
  onGroup,
  countLabel,
  fill,
  districts,
  districtSel,
  onDistrict,
}: {
  data: Datum[];
  /** Ангилал бүрийн талбай ({@link Breakdown.notes}) */
  area: Map<string, number>;
  unit?: string;
  groups?: readonly { label: string; keys: readonly string[] }[];
  colorOf: (key: string) => string;
  selected: string[] | string | null;
  onSelect: (key: string | null) => void;
  onGroup: (keys: string[]) => void;
  countLabel: string;
  /** Ганц карт баганаа дүүргэх үед жагсаалт үлдсэн өндөрт гүйнэ */
  fill?: boolean;
  /**
   * "Дүүргээр" харагдац ({@link LayerSet.districts}) — `undefined` бол
   * сэлгэгч гарахгүй. Мөр бүр дүүргийн нийт га ба бүлэг тус бүрийн га.
   */
  districts?:
    | "loading"
    | "failed"
    | {
        rows: { name: string; ha: number; parts: number[] }[];
        parts: { label: string; color: string }[];
      };
  districtSel?: string | null;
  onDistrict?: (name: string | null) => void;
}) {
  const [mode, setMode] = React.useState<"cat" | "dist">("cat");
  const rows = data
    .map((d) => ({ ...d, ha: area.get(d.key) ?? 0 }))
    .sort((a, b) => b.ha - a.ha);
  const total = rows.reduce((n, r) => n + r.ha, 0) || 1;
  const taken = new Set<string>();
  const blocks = (groups ?? []).map((g) => {
    const items = rows.filter((r) => g.keys.includes(r.key));
    items.forEach((r) => taken.add(r.key));
    return { label: g.label, items };
  });
  const loose = rows.filter((r) => !taken.has(r.key));
  if (loose.length)
    blocks.push({ label: groups?.length ? "Бусад" : "", items: loose });
  const shown = blocks
    .filter((b) => b.items.length)
    .map((b) => ({ ...b, ha: b.items.reduce((n, r) => n + r.ha, 0) }))
    .sort((a, b) => b.ha - a.ha);

  const sel = Array.isArray(selected) ? selected : selected ? [selected] : [];
  const isOn = (k: string) => sel.includes(k);
  const any = sel.length > 0;
  const dim = (k: string) => (any && !isOn(k) ? 0.4 : 1);
  const ha = (v: number) => `${measureText(v)}${unit ? ` ${unit}` : ""}`;

  const toggle =
    districts !== undefined ? (
      <div className="flex shrink-0 items-center gap-1 pb-1">
        {(
          [
            ["cat", "Ангиллаар"],
            ["dist", "Дүүргээр"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={mode === v}
            onClick={() => setMode(v)}
            className={cn(
              "rounded-xs border px-2 py-0.5 text-[11.5px] transition-colors",
              mode === v
                ? "border-line-2 bg-paper-hi font-semibold text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
        {districtSel ? (
          <button
            type="button"
            onClick={() => onDistrict?.(null)}
            className="ml-auto inline-flex items-center gap-1 rounded-xs border border-line-2 px-1.5 py-0.5 text-[11px] text-ink-2 hover:text-ink"
            title="Дүүргийн шүүлтийг цуцлах"
          >
            {districtSel}
            <span aria-hidden>×</span>
          </button>
        ) : null}
      </div>
    ) : null;

  if (mode === "dist" && districts !== undefined)
    return (
      <div className={cn("flex flex-col", fill && "min-h-0 flex-1")}>
        {toggle}
        {districts === "loading" ? (
          <p className="px-1 py-3 text-[12px] text-ink-3">
            Дүүргийг тооцоолж байна.
          </p>
        ) : districts === "failed" ? (
          <p className="px-1 py-3 text-[12px] text-clay">
            Дүүргийн хил уншигдсангүй.
          </p>
        ) : (
          <DistrictBars
            rows={districts.rows}
            parts={districts.parts}
            unit={unit}
            selected={districtSel ?? null}
            onSelect={(n) => onDistrict?.(n)}
            chosen={
              selected == null ? [] : Array.isArray(selected) ? selected : [selected]
            }
            onPart={(keys) => onGroup([...keys])}
            fill={fill}
          />
        )}
      </div>
    );

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        fill && "min-h-0 flex-1 overflow-y-auto",
      )}
    >
      {toggle}
      {shown.map((g) => {
        const keys = g.items.map((r) => r.key);
        const whole =
          sel.length === keys.length && keys.every((k) => sel.includes(k));
        const max = Math.max(...g.items.map((r) => r.ha)) || 1;
        const lead = colorOf(g.items[0].key);
        return (
          <section
            key={g.label || "_"}
            className="shrink-0 border-line [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-1.5"
          >
            {g.label ? (
              <button
                type="button"
                aria-pressed={whole}
                onClick={() => onGroup(keys)}
                className="w-full rounded-xs px-1 pt-1.5 pb-1 text-left hover:bg-paper-hi"
                style={{ opacity: any && !keys.some(isOn) ? 0.45 : 1 }}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[11.5px] font-semibold tracking-[0.04em] text-ink uppercase">
                    {g.label}
                  </span>
                  <span className="num ml-auto text-[12px] font-semibold text-ink">
                    {ha(g.ha)}
                  </span>
                </span>
                <span className="mt-1 block h-1 overflow-hidden rounded-xs bg-paper-3">
                  <span
                    className="block h-full rounded-xs"
                    style={{
                      width: `${Math.max((g.ha / total) * 100, 0.5)}%`,
                      background: soft(lead),
                    }}
                  />
                </span>
              </button>
            ) : null}
            {g.items.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={isOn(r.key)}
                onClick={() => onSelect(r.key)}
                title={`${r.label} · ${countLabel} ${num(r.value)}`}
                className="grid w-full grid-cols-[10px_132px_minmax(0,1fr)_76px] items-center gap-x-2.5 rounded-xs py-[4px] pr-1 pl-3 text-left text-[12px] hover:bg-paper-hi"
                style={{ opacity: dim(r.key) }}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px]"
                  style={{ background: soft(colorOf(r.key)) }}
                />
                <span className="truncate text-ink">{r.label}</span>
                <span className="h-2 overflow-hidden rounded-xs bg-paper-3">
                  <span
                    className="block h-full rounded-xs"
                    style={{
                      width: `${Math.max((r.ha / max) * 100, r.ha > 0 ? 1 : 0)}%`,
                      background: soft(colorOf(r.key)),
                    }}
                  />
                </span>
                <span className="num text-right text-ink">{ha(r.ha)}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/**
 * ДҮҮРГЭЭР — дүүрэг бүр нэг мөр: нэр · бүлгээр ДАВХАРЛАСАН зурвас · нийт га
 * ({@link ShareGroups}-ийн "Дүүргээр" харагдац). Зурвасын урт нь хамгийн
 * том дүүрэгтэй харьцуулсан; хэсгүүд нь бүлэг тус бүрийн га (өнгө нь
 * газрын зургийн гэр бүлийнх). Мөр дарахад тэр дүүргээр шүүнэ.
 * ⚠ Хэсэг бүр БАГТАХ бол га-гаа бичнэ (16px зурвас, 10px бараан бичвэр —
 *   өнгөнүүд дунд, цайвар гэрэлтэлттэй тул цагаан бичвэр уусна).
 * ⚠ Дүүрэг нь ТООЦООЛСОН (`districtsOf`) — эх сурвалжийн талбар биш.
 */
function DistrictBars({
  rows,
  parts,
  unit,
  selected,
  onSelect,
  chosen,
  onPart,
  fill,
}: {
  rows: { name: string; ha: number; parts: number[] }[];
  parts: { label: string; color: string; keys?: readonly string[] }[];
  unit?: string;
  selected: string | null;
  onSelect: (name: string | null) => void;
  /**
   * ТАЙЛБАР нь ШҮҮЛТ (хэрэглэгч 2026-10-07, ойн хэсэглэл: "эндээс
   * филтер") — мөр бүр газрын зургийг будаж буй талбарын ангилал тул
   * товшиход тэр ангиллаар шүүнэ; дахин товшиход цуцлагдана. "Бусад"
   * (түлхүүргүй) товшигдохгүй.
   */
  chosen?: readonly string[];
  onPart?: (keys: readonly string[]) => void;
  fill?: boolean;
}) {
  const partOn = (keys?: readonly string[]) =>
    Boolean(keys?.length) && keys!.every((k) => chosen?.includes(k));
  const anyPart = parts.some((p) => partOn(p.keys));
  const max = Math.max(...rows.map((r) => r.ha), 0) || 1;
  const ha = (v: number) => `${measureText(v)}${unit ? ` ${unit}` : ""}`;
  /* Хэсэг бүрийн ШОШГО (хэрэглэгч 2026-10-07: "chart дээр нь label
     харуулаарай") — зурвасын бодит өргөнийг хэмжиж, бичвэр БАГТАХ
     хэсэгт л тоо бичнэ; тасарсан тоо худал уншигдана. Багтаагүй хэсгийн
     утга `title`-д. */
  const [track, setTrack] = React.useState(0);
  const observer = React.useRef<ResizeObserver | null>(null);
  const measure = React.useCallback((el: HTMLSpanElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([e]) =>
      setTrack(e.contentRect.width),
    );
    observer.current.observe(el);
  }, []);
  React.useEffect(() => () => observer.current?.disconnect(), []);
  return (
    <div className={cn("flex flex-col", fill && "min-h-0 flex-1")}>
      {/* Өнгөний тайлбар ДЭЭР: мөрүүд доошоо сунахад тайлбар ба мөрийн
          хооронд хоосон зай үүсэхгүй */}
      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-b border-line px-1 pb-2 text-[11px] text-ink-2">
        {parts.map((p) => {
          const swatch = (
            <span
              aria-hidden
              className="size-2.5 rounded-[2px]"
              style={{ background: soft(p.color) }}
            />
          );
          if (!onPart || !p.keys?.length)
            return (
              <span key={p.label} className="inline-flex items-center gap-1.5">
                {swatch}
                {p.label}
              </span>
            );
          const on = partOn(p.keys);
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => onPart(p.keys!)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-xs hover:text-ink",
                on && "font-semibold text-ink",
              )}
              style={{ opacity: anyPart && !on ? 0.4 : 1 }}
            >
              {swatch}
              {p.label}
            </button>
          );
        })}
      </div>
      <div
        className={cn(
          "pt-1",
          fill && "flex min-h-0 flex-1 flex-col overflow-y-auto",
        )}
      >
        {rows.map((r, ri) => {
          const on = selected === r.name;
          return (
            <button
              key={r.name}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : r.name)}
              title={parts
                .map((p, i) => `${p.label}: ${ha(r.parts[i] ?? 0)}`)
                .join(" · ")}
              className={cn(
                "grid w-full grid-cols-[124px_minmax(0,1fr)_76px] items-center gap-x-2.5 rounded-xs px-1 py-[5px] text-left text-[12px] hover:bg-paper-hi",
                /* Баганаа дүүргэх үед мөрүүд өндрийг хуваалцана (≤44px) */
                fill && "max-h-11 min-h-[26px] flex-1",
              )}
              style={{ opacity: selected && !on ? 0.4 : 1 }}
            >
              <span className="truncate text-ink">{r.name}</span>
              <span
                ref={ri === 0 ? measure : undefined}
                className="h-4 overflow-hidden rounded-xs bg-paper-3"
              >
                <span
                  className="flex h-full"
                  style={{ width: `${(r.ha / max) * 100}%` }}
                >
                  {r.parts.map((v, i) => {
                    if (v <= 0) return null;
                    const text = measureText(v);
                    const px = track * (r.ha / max) * (v / r.ha);
                    return (
                      <span
                        key={i}
                        className="num flex h-full items-center justify-center overflow-hidden text-[10px] leading-none font-semibold whitespace-nowrap"
                        style={{
                          width: `${(v / r.ha) * 100}%`,
                          background: soft(parts[i]?.color),
                          color: "#0b1a14",
                        }}
                      >
                        {px >= text.length * 6.2 + 8 ? text : null}
                      </span>
                    );
                  })}
                </span>
              </span>
              <span className="num text-right text-ink">{ha(r.ha)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function noteOf(b: Breakdown): ((d: Datum) => string) | undefined {
  const { note, notes } = b;
  if (!note || !notes) return undefined;
  return (d) => {
    const v = notes.get(d.key);
    if (v == null) return "";
    return note.unit ? `${measureText(v)} ${note.unit}` : measureText(v);
  };
}

/**
 * КАРТЫН ӨНДРИЙН ЖИН — мөрийн тооноос.
 *
 * Баганад картууд үлдсэн өндрийг хуваалцдаг бөгөөд тэнцүү
 * хуваавал дөрвөн зүсэмтэй бөгж доороо хоосон зай үлдээж
 * байхад арван мөртэй зурвас адил өндөрт шахагдаж гүйлгүүр
 * гаргадаг байв (хэрэглэгч, 2026-09-24).
 *
 * ⚠ Жин нь ШҮҮГДЭЭГҮЙ бүтэн жагсаалтаас гарна: шүүлт тавихад
 * картуудын өндөр үсрэн солигдвол самбар тогтворгүй болно
 * (диаграмын БҮТЭЦ шүүлтээс үл хамаарах дүрэмтэй нэг зарчим).
 * ⚠ БӨГЖ, БАГАНА нь ТОГТМОЛ өндөртэй тул жин нь бага:
 * бөгж нь 112px диаграм дээр тайлбараа барьдаг, хугацааны
 * багана 92px — хоёулаа нэмэлт өндөр ашигладаггүй.
 */
/**
 * ЭЗЛЭХ ХУВЬ ХАРУУЛЖ БОЛОХ УУ.
 *
 * Хувь нь ЗӨВХӨН бүхэл нь мэдэгдэж байгаа үед утгатай — бөгж
 * хэрэглэхгүй гурван тохиолдолтой ЯГ ИЖИЛ жагсаалт:
 * · дундаж — хувийн дундажууд нийлээд бүхэл болдоггүй;
 * · олон утгат — нэг бичлэг хэд хэдэн ангилалд орох тул нийлбэр нь
 *   бүхлээс ИХ гарна;
 * · хураасан — харагдаж буй мөрүүд бүхлийг хамраагүй.
 */
function hasShare(b: Breakdown): boolean {
  return !b.multi && b.top == null && (b.kind === "count" || b.kind === "sum");
}

/**
 * Картын толгойн баримт — "33 бүртгэл · 4 ангилал".
 *
 * ⚠ "бичлэг" нь мэдээллийн сангийн үг — дэлгэцэд ХЭЗЭЭ Ч гарахгүй
 * (хэлний дүрэм). Бүртгэл өөрийн үгтэй бол ({@link LayerSet.record})
 * түүгээр.
 */
function headMeta(b: Breakdown, word?: { one: string }): string {
  const cats = `${num(b.values.length)} ангилал`;
  if (!hasShare(b)) return cats;
  const total = b.values.reduce((n, d) => n + d.value, 0);
  /* ⚠ Хэмжилт зурвас болсон үед ({@link LayerSet.measureFirst}) тоо нь
     бичлэгийнх БИШ — нэгжтэйгээ гарна */
  if (b.kind === "count" && !b.measure)
    return `${num(total)} ${word?.one ?? "бүртгэл"} · ${cats}`;
  const unit = b.measure ? unitOf(b.measure).unit : "";
  return `${measureText(total)}${unit ? ` ${unit}` : ""} · ${cats}`;
}

/*
  НЭРЛЭСЭН ГАНЦ ХАРЬЦУУЛАХ КАРТЫГ ХАСНА ({@link LayerSet.dropCompare},
  хэрэглэгч 2026-10-06: зургаар "зөвхөн зураг дээрхийг устга").
  ⚠⚠ Нэрээр ДАНГААР таних нь ХАНГАЛТГҮЙ — эхний оролдлогод бүх
  харьцуулалт, дараа нь давхаргын дугаараар хассан нь хэрэглэгчид өөр
  картыг ч хамт устгасан мэт харагдаж буцаагдсан. Тиймээс ГАРЧИГ ба
  доторх БҮХ цувааны нэр зэрэг таарах ёстой ("Дүүрэг" · файлаар ·
  геодезийн) — тэр нэг карт л хасагдана.
*/
function droppedCompare(set: LayerSet, b: Breakdown): boolean {
  if (b.kind !== "compare" || !set.dropCompare?.length) return false;
  const low = (t: string) => t.trim().toLowerCase();
  const names = new Set<string>();
  for (const g of b.groups ?? []) {
    names.add(low(g.label));
    for (const r of g.rows) names.add(low(r.label));
  }
  return set.dropCompare.some(
    (d) => low(d.label) === low(b.label) && d.series.every((x) => [...names].some((n) => n.includes(low(x)))),
  );
}

function cardWeight(b: Breakdown): number {
  if (isTime(b)) return 3;
  if (isPie(b)) return Math.max(3, b.values.length);
  if (b.kind === "compare") return Math.max(4, (b.groups?.length ?? 0) * 2);
  return Math.max(3, b.values.length);
}

function measureText(v: number): string {
  /* Бүхэл утганд бутархай зурах нь худал нарийвчлал: "40.0" гэдэг нь
     хэмжилт нь аравны нэг хүртэл мэдэгдэж байгаа мэт уншигдана */
  if (Number.isInteger(v)) return num(v);
  if (Math.abs(v) >= 100) return num(Math.round(v));
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

/**
 * Хугацааны тэнхлэгийн шошго.
 *
 * Багана нь эгнээндээ багтах ёстой: арван хоёр сарын нүдэнд ганц хоёр
 * тэмдэгт л орно. Тиймээс баганын ТООНООС хамаарч шийднэ — цөөн бол
 * бүтэн он, олон бол хоёр орон, бүр олон бол зөвхөн арван жилийн
 * тэмдэглэгээ.
 *
 * ⚠ Оныг ШОШГООС нь БҮҮ унш: бүлэглэсэн цуваанд шошго нь "1995–1999"
 * гэсэн МУЖ байдаг тул тоо болгоход `NaN` гарч, бүх тэмдэглэгээ алга
 * болдог байв. Түлхүүр нь харин үргэлж эхлэх он.
 */
function tickOf(
  kind: ChartKind,
  d: { key: string; label: string },
  i: number,
  n: number,
): string {
  if (kind === "month") return d.label.replace("-р сар", "");

  /*
    ⚠ ОН ҮРГЭЛЖ БҮТЭН ДӨРВӨН ОРОНТОЙ (хэрэглэгч, 2026-10-07: "оныг
    бүтэн харуулаарай, 2020 гэх мэт"). Урьд нь "20", "98" гэж
    товчилдог байсан тул аль зуун болох нь уншигдахгүй байв. Бүтэн он
    илүү өргөн тул олон онтой цуваанд СИЙРЭГЖҮҮЛНЭ: 16 хүртэл бол
    хоёр тутамд, түүнээс олон бол таваар хуваагдах онд.
  */
  const y = Number(d.key);
  if (!Number.isFinite(y)) return "";
  if (n <= 8) return String(y);
  if (n <= 16) return i % 2 === 0 ? String(y) : "";
  return y % 5 === 0 ? String(y) : "";
}

/**
 * ⚠⚠ **ХУУДАСНЫ ХАРАГДАЦ** ({@link LayerSet.sheet}; хэрэглэгч 2026-10-22,
 * Archimap-ийн ANALYSIS самбарын зургаар: "эндээс санаа аваад хий,
 * цэвэрхэн, ойлгомжтой, энгийн").
 *
 * Хүснэгтийн оронд дээрээс доош уншигдах ХЭСГҮҮД — тус бүр хураагддаг:
 * 1. **ТОЙМ** — хоёр баганат тоо: бүртгэлийн тоо, хэмжилт бүрийн нийт
 *    дүн (нэгжтэй), хугацааны муж. Том тоо, доор нь жижиг шошго.
 * 2. **Тэнхлэг бүр** (салбар, дүүрэг …) — НЭГ ЭГНЭЭНИЙ мөр: нэр · 8px
 *    зурвас · тод тоо (~29px). Утгын багана хамгийн урт тоогоороо (`ch`)
 *    тул бүх зурвас нэг цэгт дуусна. Хэмжилт нэгээс олон бол толгойн
 *    товчоор сэлгэнэ. Өнгөт дөрвөлжин ЗӨВХӨН зургийн палитртай тэнхлэгт.
 * 3. **Хугацаа** — багана бүр утгаа дээрээ бичнэ (≤ 12 багана үед).
 *
 * ⚠⚠ Эхний хувилбар (мөр ~38px, доор нь 3px зурвас, мөр бүрд өнгөт
 * дөрвөлжин, тэнхлэгийн нэр дэд толгойд давтагдана, хугацааны доор
 * "Хамгийн их · Хугацаа") "маш болхи" гэж буцаагдсан (2026-10-22).
 *
 * ⚠ Тайлбар өгүүлбэр, хувь БАЙХГҮЙ (Archimap-ийн дүгнэлт бичвэрийг
 * ХУУЛААГҮЙ — арга зүйн тайлбарын дүрэм). Мөр, багана дарахад шүүнэ
 * (`pickOnly`), дахин дарахад цуцлагдана.
 * ⚠ Олон утгат, хураасан задаргааны нийлбэр Тоймд ОРОХГҮЙ — бүтэн дүн биш.
 */
function SheetPanel({
  cuts,
  tone,
  records,
  word,
  colors,
  colorAxis,
  selectedOf,
  onPick,
  rowsSkipping,
  onPickAdmin,
}: {
  cuts: Breakdown[];
  tone: string;
  records: number;
  word?: { one: string; count: string };
  /** Газрын зургийн палитр — зургийг будаж буй тэнхлэгт л */
  colors?: Map<string, string>;
  colorAxis?: string | null;
  selectedOf: (axis: string) => string | null;
  onPick: (axis: string, key: string | null) => void;
  /** Заасан тэнхлэгүүдийг АЛГАССАН шүүлттэй мөрүүд ({@link SheetAdmin}) */
  rowsSkipping?: (skip: string[]) => Row[];
  /** Дүүрэг, хороо хоёрыг ЗЭРЭГ тогтооно (`null` — цуцлах) */
  onPickAdmin?: (
    dAxis: string,
    kAxis: string,
    d: string | null,
    k: string | null,
  ) => void;
}) {
  const countLabel = word?.count ?? "Бүртгэлийн тоо";

  /* ---- ТОЙМ ---- */
  const stats: { label: string; value: string; unit: string }[] = [
    { label: countLabel, value: num(records), unit: "" },
  ];
  const seen = new Set<string>();
  const addTotal = (label: string, by: Iterable<number>) => {
    if (seen.has(label) || stats.length >= 6) return;
    seen.add(label);
    const cut = unitOf(label);
    const total = [...by].reduce((s, v) => s + v, 0);
    stats.push({
      label: cut.unit ? cut.name : label,
      value: sheetNum(total),
      unit: cut.unit,
    });
  };
  for (const b of cuts) {
    if (b.multi || b.top != null) continue;
    if (b.kind === "sum" && b.measure)
      addTotal(b.measure, b.values.map((d) => d.value));
    if (b.kind === "count" && b.notes && b.note)
      addTotal(b.note.label, b.notes.values());
  }
  for (const b of cuts) {
    if (b.kind !== "year" || stats.length >= 6) continue;
    const span = timeSpan(b);
    if (span) stats.push({ label: b.label, value: span, unit: "" });
  }

  /* ---- ТЭНХЛЭГҮҮД ---- */
  const axes: { key: string; label: string; list: Breakdown[] }[] = [];
  const times: Breakdown[] = [];
  for (const b of cuts) {
    if (b.kind === "compare") continue;
    if (isTime(b)) {
      times.push(b);
      continue;
    }
    const k = filterKey(b);
    const at = axes.find((x) => x.key === k);
    if (at) at.list.push(b);
    else axes.push({ key: k, label: b.label, list: [b] });
  }

  /*
    ⚠⚠ ДҮҮРЭГ, ХОРОО НЭГ ХЭСЭГТ ({@link SheetAdmin}; хэрэглэгч 2026-10-22:
    "дүүрэг хорооны чартуудыг нэгтгэ"). Хороо нь дүүрэг дотроо л утгатай
    — өөр дүүргийн ижил дугаартай хороо тусдаа тэнхлэгт нийлж байв.
  */
  const hasCount = (a: { list: Breakdown[] }) =>
    a.list.some((b) => b.kind === "count");
  const dAxis = rowsSkipping
    ? axes.find((a) => adminRank(a.label) === 1 && hasCount(a))
    : undefined;
  const kAxis = dAxis
    ? axes.find((a) => adminRank(a.label) === 2 && hasCount(a))
    : undefined;

  return (
    <>
      <SheetSection title="Тойм">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="num text-[18px] font-semibold leading-tight text-ink">
                {s.value}
                {s.unit ? (
                  <span className="ml-1 text-[11px] font-normal text-ink-3">
                    {s.unit}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-3">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </SheetSection>
      {axes.map((a) =>
        dAxis && kAxis && a === kAxis ? null : dAxis && kAxis && a === dAxis ? (
          <SheetAdmin
            key={a.key}
            dAxis={dAxis}
            kAxis={kAxis}
            rows={rowsSkipping!([dAxis.key, kAxis.key])}
            tone={tone}
            word={word}
            colors={dAxis.key === colorAxis ? colors : undefined}
            selD={selectedOf(dAxis.key)}
            selK={selectedOf(kAxis.key)}
            onPick={(d, k) => onPickAdmin?.(dAxis.key, kAxis.key, d, k)}
          />
        ) : (
        <SheetAxis
          key={a.key}
          axis={a}
          tone={tone}
          word={word}
          colors={a.key === colorAxis ? colors : undefined}
          selected={selectedOf(a.key)}
          onPick={(k) => onPick(a.key, k)}
        />
        ),
      )}
      {/* ⚠ Нэг талбарын он, сар НЭГ КАРТАД сэлгэгдэнэ ({@link SheetTimes}) */}
      {times.length ? (
        <div className="grid gap-2">
          {timeGroups(times).map((list) => (
            <SheetTimes
              key={list[0].id}
              list={list}
              tone={tone}
              selectedOf={(b) => selectedOf(filterKey(b))}
              onPick={(b, k) => onPick(filterKey(b), k)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Хуудасны зурвас, баганын дүүргэлт УУССАН, ТУНГАЛАГ ({@link SheetPanel};
 * хэрэглэгч 2026-10-22: "чартын өнгө уусан transparent"). Тоо, нэр бүтэн
 * тод хэвээр. `color-mix` — өнгө нь hex, `oklch`, CSS хувьсагч аль нь ч
 * байж болно (`soft` зөвхөн hex-д ажилладаг).
 */
function sheetFade(color: string): string {
  return `color-mix(in srgb, ${color} 35%, transparent)`;
}

/** Том тоо — 100-аас доош бол нэг аравтын оронтой */
function sheetNum(v: number): string {
  return Math.abs(v) >= 100 ? num(Math.round(v)) : num(v, 1);
}

/** Бүртгэлтэй эхний ба сүүлийн хугацаа ("2019–2026"), эс бөгөөс `null` */
function timeSpan(b: Breakdown): string | null {
  const on = b.values.filter((d) => d.value > 0);
  if (!on.length) return null;
  const a = on[0].label.split("–")[0];
  const z = on[on.length - 1].label.split("–").pop() ?? a;
  return a === z ? a : `${a}–${z}`;
}

/** Хураагддаг хэсэг — "˅ ГАРЧИГ" толгойтой ({@link SheetPanel}) */
function SheetSection({
  title,
  meta,
  dot,
  action,
  open: held,
  onToggle,
  anchor,
  children,
}: {
  title: string;
  meta?: string;
  /** Гарчгийн өмнөх өнгөт дөрвөлжин — зургийн өнгө ({@link ZoneSheet}) */
  dot?: string;
  /** Толгойн баруун талын товч — хураах товчны ГАДНА */
  action?: React.ReactNode;
  /** Эцэг удирдвал (бүсийн хэсэг — харьцуулах хүснэгтээс нээгдэнэ) */
  open?: boolean;
  onToggle?: () => void;
  /** Гүйлгэж хүрэх элементийн `id` */
  anchor?: string;
  children: React.ReactNode;
}) {
  const [own, setOwn] = React.useState(true);
  const open = held ?? own;
  return (
    <section
      id={anchor}
      className="shrink-0 scroll-mt-2 rounded-xs border border-line bg-paper-2"
    >
      <div className="flex items-center pr-2">
      <button
        type="button"
        onClick={() => (onToggle ? onToggle() : setOwn((o) => !o))}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-1.5 text-left"
      >
        <ChevronDown
          size={13}
          className={cn(
            "shrink-0 text-ink-3 transition-transform",
            !open && "-rotate-90",
          )}
        />
        {dot ? (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[1px]"
            style={{ background: dot }}
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-ink">
          {title}
        </span>
        {meta ? (
          <span className="num shrink-0 text-[10.5px] text-ink-3">{meta}</span>
        ) : null}
      </button>
      {action}
      </div>
      {open ? (
        <div className="border-t border-line px-3 pb-2 pt-2">{children}</div>
      ) : null}
    </section>
  );
}

/** Жагсаалт энэ тооноос урт бол "Бүгдийг харах" товчоор дэлгэнэ */
const SHEET_ROWS = 10;

/**
 * Хэмжилт сонгох унждаг цэс ({@link SheetAxis}). Товчны эгнээ (`Segments`)
 * гэрээний давхаргын есөн урт нэрийг дөрвөн мөр болгож бөөгнөрүүлдэг байв
 * (хэрэглэгч 2026-10-22: "өөрөөр хийх санаа"). Нэгжгүй хэмжилт (тоо) эхэнд,
 * бусад нь НЭГЖЭЭРЭЭ бүлэглэгдэнэ — нэг бүлгийнх л хооронд харьцуулагдана.
 * Хөтчийн өөрийн `<select>`: жагсаалтад нэр бүтнээрээ, `color-scheme`-ээр
 * горимоо дагана.
 */
function MetricSelect({
  metrics,
  value,
  onChange,
}: {
  metrics: { id: string; name: string; unit: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const plain = metrics.filter((m) => !m.unit);
  const groups = new Map<string, typeof metrics>();
  for (const m of metrics) {
    if (!m.unit) continue;
    const list = groups.get(m.unit) ?? [];
    list.push(m);
    groups.set(m.unit, list);
  }
  const current = metrics.find((m) => m.id === value);
  return (
    <label className="relative mb-1.5 block">
      <span className="sr-only">Хэмжилт</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={current?.name}
        className="h-7 w-full cursor-pointer appearance-none truncate rounded-xs border border-line-2 bg-paper py-0 pl-2.5 pr-8 text-[12px] font-medium text-ink outline-none transition-colors hover:border-ink-3 focus-visible:border-ink-3"
      >
        {plain.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
        {[...groups].map(([unit, list]) => (
          <optgroup key={unit} label={unit}>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3"
      />
    </label>
  );
}

/**
 * Огноогоор шүүх мөрийн өгөгдөл ({@link LayerSet.dateBar}) — асаалттай
 * давхаргуудын ЭХНИЙ огноотой нь.
 * ⚠ МОДУЛИЙН түвшинд: давталт, эрт буцалттай мемо нь React Compiler-ийн
 * мемоизацийг тасалдаг (`parcelAxisOf`-тэй нэг шалтгаан).
 */
function dateBarOf(
  on: readonly string[],
  dateBars: Record<string, DateAxis[]>,
  loaded: Record<string, Loaded>,
  dateWant: Record<string, string>,
) {
  for (const id of on) {
    const list = dateBars[id];
    const hit = loaded[id];
    if (!list || !hit) continue;
    const axis = list.find((a) => a.field === dateWant[id]) ?? list[0];
    const yk = `${axis.field}\u0000year`;
    const mk = `${axis.field}\u0000month`;
    const chart = hit.charts.find((c) => filterKey(c) === yk);
    const years = chart
      ? chart.values
          .filter((d) => d.value > 0)
          .map((d) => ({ key: d.key, label: d.label }))
      : axis.years.map((y) => ({ key: String(y), label: String(y) }));
    const monthOf = axis.monthOf;
    const months = monthOf
      ? [
          ...new Set(
            Object.values(hit.data.rows)
              .map((r) => monthOf(r))
              .filter((m): m is number => m != null),
          ),
        ].sort((a, b) => a - b)
      : [];
    return { id, list, axis, yk, mk, years, months };
  }
  return null;
}

/** Шүүлтүүрийн мөрийн нягт сонгогч (огноогоор шүүх мөр) */
function BarSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-[27px] max-w-[16rem] cursor-pointer appearance-none truncate rounded-xs border bg-paper py-0 pl-2 pr-7 text-[12px] outline-none transition-colors hover:border-line-2 focus-visible:border-ink-3",
          value ? "border-data/45 font-medium text-ink" : "border-line text-ink-2",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-3"
      />
    </label>
  );
}

/**
 * ⚠⚠ **ДҮҮРЭГ, ХОРОО — НЭГ ШАТАЛСАН ХЭСЭГ** ({@link SheetPanel};
 * хэрэглэгч 2026-10-22: "дүүрэг хорооны чартуудыг нэгтгэ").
 *
 * Дүүргийн мөр бүр сумаар задарч, тэр дүүргийн хороод доор нь догол
 * мөрөөр гарна. Тусдаа "Хороо" тэнхлэг нь өөр дүүргийн ИЖИЛ дугаартай
 * хороог (Баянзүрхийн 5, Хан-Уулын 5) нэг мөр болгож нийлүүлдэг байв.
 *
 * ⚠ Бүх тоо `rows`-оос (дүүрэг, хороо ХОЁУЛАНГ алгассан шүүлттэй) дахин
 * тоологдоно (`recount`) — хороо сонгосон ч бусад дүүрэг тэгээр
 * хумигдахгүй. Хорооны утга нь хорооны тэнхлэгийн ИЖИЛ хэмжилтийн
 * задаргаагаар, тэр дүүргийн мөрүүд дээр.
 * ⚠ Дүүрэг дарахад дүүргээр шүүж задарна; хороо дарахад дүүрэг, хороо
 * хоёуланг ЗЭРЭГ тогтооно. Дахин дарахад нэг шат буцна.
 * ⚠ Хороо нь дүүрэгтээ л харьцуулагдана — зурвасын хуваарь дүүрэг бүрд.
 */
function SheetAdmin({
  dAxis,
  kAxis,
  rows,
  tone,
  word,
  colors,
  selD,
  selK,
  onPick,
}: {
  dAxis: { key: string; label: string; list: Breakdown[] };
  kAxis: { key: string; label: string; list: Breakdown[] };
  rows: Row[];
  tone: string;
  word?: { one: string; count: string };
  colors?: Map<string, string>;
  selD: string | null;
  selK: string | null;
  onPick: (d: string | null, k: string | null) => void;
}) {
  const [want, setWant] = React.useState("");
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const [all, setAll] = React.useState<Set<string>>(() => new Set());
  const [allD, setAllD] = React.useState(false);

  /* Хэмжилт — дүүргийн тэнхлэгийнх, хорооных нь ижил төрөл, нэрээр */
  type Metric = {
    id: string;
    name: string;
    unit: string;
    d: Breakdown;
    k?: Breakdown;
    note: boolean;
  };
  const same = (a: Breakdown, b: Breakdown) =>
    a.kind === b.kind && (a.measure ?? "") === (b.measure ?? "");
  const metrics: Metric[] = [];
  for (const b of dAxis.list) {
    const k = kAxis.list.find((x) => same(x, b));
    if (b.kind === "count") {
      metrics.push({
        id: b.id,
        name: word?.count ?? "Бүртгэлийн тоо",
        unit: "",
        d: b,
        k,
        note: false,
      });
      if (b.notes && b.note) {
        const cut = unitOf(b.note.label);
        metrics.push({
          id: `${b.id}:note`,
          name: cut.unit ? cut.name : b.note.label,
          unit: cut.unit,
          d: b,
          k: k?.note?.label === b.note.label ? k : undefined,
          note: true,
        });
      }
    } else if (b.measure) {
      const cut = unitOf(b.measure);
      metrics.push({
        id: b.id,
        name: cut.unit ? cut.name : b.measure,
        unit: [cut.unit, b.kind === "mean" ? "дундаж" : ""]
          .filter(Boolean)
          .join(" · "),
        d: b,
        k,
        note: false,
      });
    }
  }
  const metric = metrics.find((m) => m.id === want) ?? metrics[0];
  if (!metric) return null;

  const valuesOf = (b: Breakdown, list: Row[], note: boolean) => {
    const c = b.recount(list);
    return note
      ? (c.notes ?? new Map<string, number>())
      : new Map(c.values.map((d) => [d.key, d.value]));
  };
  const dLabel = new Map<string, string>();
  for (const b of dAxis.list) for (const d of b.values) dLabel.set(d.key, d.label);
  const kLabel = new Map<string, string>();
  for (const b of kAxis.list) for (const d of b.values) kLabel.set(d.key, d.label);

  const blank = (k: string) => (k === "Бүртгэгдээгүй" ? 1 : 0);
  const dRows = [...valuesOf(metric.d, rows, metric.note)]
    .map(([key, v]) => ({ key, label: dLabel.get(key) ?? key, v }))
    .filter((r) => r.v > 0 || r.key === selD)
    .sort((a, b) => blank(a.key) - blank(b.key) || b.v - a.v);
  const dMax = Math.max(0, ...dRows.map((r) => r.v));
  const dShown = allD
    ? dRows
    : dRows.filter((r, i) => i < SHEET_ROWS || r.key === selD);

  /* Задарсан дүүрэг — хэрэглэгч нээсэн эсвэл сонгосон */
  const isOpen = (d: string) => open.has(d) || d === selD;
  const kids = (d: string) => {
    if (!metric.k) return [];
    const sub = rows.filter((r) => metric.d.keyOf(r).includes(d));
    return [...valuesOf(metric.k, sub, metric.note)]
      .map(([key, v]) => ({ key, label: kLabel.get(key) ?? key, v }))
      .filter((r) => r.v > 0 || (d === selD && r.key === selK))
      .sort((a, b) => blank(a.key) - blank(b.key) || b.v - a.v);
  };

  const flip = (set: Set<string>, k: string) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  };

  const digits = Math.max(3, ...dRows.map((r) => sheetNum(r.v).length));
  const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;
  const comma = dAxis.label.includes(",") || kAxis.label.includes(",");
  const title = `${dAxis.label}${comma ? " · " : ", "}${kAxis.label.toLocaleLowerCase("mn")}`;

  const bar = (v: number, max: number, color: string) => (
    <span className="block h-2 rounded-[1px] bg-line">
      <span
        className="block h-full rounded-[1px]"
        style={{
          width: `${max > 0 && v ? Math.max(1.5, (v / max) * 100) : 0}%`,
          background: sheetFade(color),
        }}
      />
    </span>
  );

  return (
    <SheetSection title={title} meta={`${num(dRows.length)} ангилал`}>
      {metrics.length > 1 ? (
        <MetricSelect metrics={metrics} value={metric.id} onChange={setWant} />
      ) : null}
      {metrics.length === 1 || metric.unit ? (
        <p className="mb-1 text-right text-[10.5px] text-ink-3">
          {metrics.length === 1 ? metric.name : null}
          {metrics.length === 1 && metric.unit ? ", " : null}
          {metric.unit}
        </p>
      ) : null}
      <div className="flex flex-col">
        {dShown.map((r) => {
          const on = selD === r.key && selK == null;
          const color = colors?.get(r.key) ?? tone;
          const expanded = metric.k ? isOpen(r.key) : false;
          const list = expanded ? kids(r.key) : [];
          const kMax = Math.max(0, ...list.map((x) => x.v));
          const many = all.has(r.key);
          const kShown = many
            ? list
            : list.filter((x, i) => i < SHEET_ROWS || x.key === selK);
          return (
            <div key={r.key} className="flex flex-col">
              <div
                className={cn(
                  "flex items-center rounded-xs transition-colors hover:bg-paper-hi",
                  on && "bg-paper-hi",
                  selD != null && selD !== r.key && "opacity-45",
                )}
              >
                {metric.k ? (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Хураах" : "Задлах"}
                    onClick={() => setOpen((s) => flip(s, r.key))}
                    className="flex h-[22px] w-5 shrink-0 items-center justify-center text-ink-3 hover:text-ink"
                  >
                    <ChevronDown
                      size={12}
                      className={cn(
                        "transition-transform",
                        !expanded && "-rotate-90",
                      )}
                    />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    onPick(on ? null : r.key, null);
                    if (!on) setOpen((s) => new Set(s).add(r.key));
                  }}
                  aria-pressed={on}
                  title={r.label}
                  style={{ gridTemplateColumns: cols }}
                  className="grid min-w-0 flex-1 items-center gap-2.5 py-[3px] pr-1.5 text-left text-[12.5px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {colors ? (
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-[1px]"
                        style={{ background: sheetFade(color) }}
                      />
                    ) : null}
                    <span className="min-w-0 truncate text-[12px] font-medium text-ink">
                      {r.label}
                    </span>
                  </span>
                  {bar(r.v, dMax, color)}
                  <span className="num text-right text-[12.5px] font-semibold text-ink">
                    {sheetNum(r.v)}
                  </span>
                </button>
              </div>
              {expanded ? (
                <div className="mb-1 ml-[9px] flex flex-col border-l border-line pl-1.5">
                  {kShown.length ? (
                    kShown.map((x) => {
                      const kon = selD === r.key && selK === x.key;
                      return (
                        <button
                          key={x.key}
                          type="button"
                          onClick={() => onPick(r.key, kon ? null : x.key)}
                          aria-pressed={kon}
                          title={`${r.label} · ${x.label}`}
                          style={{ gridTemplateColumns: cols }}
                          className={cn(
                            "grid w-full items-center gap-2.5 rounded-xs px-1.5 py-[2px] text-left text-[11.5px] transition-colors hover:bg-paper-hi",
                            kon && "bg-paper-hi",
                            selK != null && selD === r.key && !kon && "opacity-45",
                          )}
                        >
                          <span className="min-w-0 truncate text-[11.5px] text-ink-2">
                            {x.label}
                          </span>
                          {bar(x.v, kMax, color)}
                          <span className="num text-right text-[11.5px] text-ink">
                            {sheetNum(x.v)}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-1.5 py-[2px] text-[11px] text-ink-3">—</p>
                  )}
                  {list.length > SHEET_ROWS ? (
                    <button
                      type="button"
                      onClick={() => setAll((s) => flip(s, r.key))}
                      className="mt-0.5 px-1.5 text-left text-[11px] text-ink-3 hover:text-ink"
                    >
                      {many ? "Хураах" : `Бүгдийг харах · ${num(list.length)}`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {dRows.length > SHEET_ROWS ? (
        <button
          type="button"
          onClick={() => setAllD((s) => !s)}
          className="mt-1 px-1.5 text-[11px] text-ink-3 hover:text-ink"
        >
          {allD ? "Хураах" : `Бүгдийг харах · ${num(dRows.length)}`}
        </button>
      ) : null}
    </SheetSection>
  );
}

/** Нэг тэнхлэгийн хэсэг ({@link SheetPanel}) */
function SheetAxis({
  axis,
  tone,
  word,
  colors,
  selected,
  onPick,
}: {
  axis: { key: string; label: string; list: Breakdown[] };
  tone: string;
  word?: { one: string; count: string };
  colors?: Map<string, string>;
  selected: string | null;
  onPick: (key: string | null) => void;
}) {
  const [want, setWant] = React.useState("");
  const [all, setAll] = React.useState(false);

  type Metric = {
    id: string;
    name: string;
    unit: string;
    by: Map<string, number>;
  };
  const metrics: Metric[] = [];
  for (const b of axis.list) {
    const by = new Map(b.values.map((d) => [d.key, d.value]));
    if (b.kind === "count") {
      metrics.push({
        id: b.id,
        name: word?.count ?? "Бүртгэлийн тоо",
        unit: "",
        by,
      });
      if (b.notes && b.note) {
        const cut = unitOf(b.note.label);
        metrics.push({
          id: `${b.id}:note`,
          name: cut.unit ? cut.name : b.note.label,
          unit: cut.unit,
          by: b.notes,
        });
      }
    } else if (b.measure) {
      const cut = unitOf(b.measure);
      metrics.push({
        id: b.id,
        name: cut.unit ? cut.name : b.measure,
        unit: [cut.unit, b.kind === "mean" ? "дундаж" : ""]
          .filter(Boolean)
          .join(" · "),
        by,
      });
    }
  }
  const metric = metrics.find((m) => m.id === want) ?? metrics[0];
  if (!metric) return null;

  const labels = new Map<string, string>();
  for (const b of axis.list)
    for (const d of b.values) labels.set(d.key, d.label);
  const blank = (k: string) => (k === "Бүртгэгдээгүй" ? 1 : 0);
  const rows = [...labels.keys()]
    .map((key) => ({
      key,
      label: labels.get(key) ?? key,
      v: metric.by.get(key),
    }))
    .sort((a, b) => blank(a.key) - blank(b.key) || (b.v ?? -1) - (a.v ?? -1));
  const max = Math.max(0, ...rows.map((r) => r.v ?? 0));
  /* Сонгосон мөр хураасан хэсэгт байсан ч харагдана */
  const shown = all
    ? rows
    : rows.filter((r, i) => i < SHEET_ROWS || r.key === selected);
  const top = axis.list[0]?.top;
  /* Утгын багана хамгийн урт тоогоороо — бүх мөрийн зурвас нэг цэгт дуусна */
  const digits = Math.max(
    3,
    ...shown.map((r) => (r.v == null ? 1 : sheetNum(r.v).length)),
  );
  const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;

  return (
    <SheetSection
      title={axis.label}
      meta={top ? `эхний ${top}` : `${num(rows.length)} ангилал`}
    >
      {metrics.length > 1 ? (
        <MetricSelect metrics={metrics} value={metric.id} onChange={setWant} />
      ) : null}
      {metrics.length === 1 || metric.unit ? (
        <p className="mb-1 text-right text-[10.5px] text-ink-3">
          {metrics.length === 1 ? metric.name : null}
          {metrics.length === 1 && metric.unit ? ", " : null}
          {metric.unit}
        </p>
      ) : null}
      <div className="flex flex-col">
        {shown.map((r) => {
          const on = selected === r.key;
          const color = colors?.get(r.key) ?? tone;
          const w = max > 0 && r.v ? Math.max(1.5, (r.v / max) * 100) : 0;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onPick(on ? null : r.key)}
              aria-pressed={on}
              title={r.label}
              style={{ gridTemplateColumns: cols }}
              className={cn(
                "grid w-full items-center gap-2.5 text-[12.5px] rounded-xs px-1.5 py-[3px] text-left transition-colors hover:bg-paper-hi",
                on && "bg-paper-hi",
                selected != null && !on && "opacity-45",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {colors ? (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-[1px]"
                    style={{ background: sheetFade(color) }}
                  />
                ) : null}
                <span className="min-w-0 truncate text-[12px] text-ink">
                  {r.label}
                </span>
              </span>
              <span className="block h-2 rounded-[1px] bg-line">
                <span
                  className="block h-full rounded-[1px]"
                  style={{ width: `${w}%`, background: sheetFade(color) }}
                />
              </span>
              <span className="num text-right text-[12.5px] font-semibold text-ink">
                {r.v == null ? (
                  <span className="font-normal text-ink-3">—</span>
                ) : (
                  sheetNum(r.v)
                )}
              </span>
            </button>
          );
        })}
      </div>
      {rows.length > SHEET_ROWS ? (
        <button
          type="button"
          onClick={() => setAll((s) => !s)}
          className="mt-1 px-1.5 text-[11px] text-ink-3 hover:text-ink"
        >
          {all ? "Хураах" : `Бүгдийг харах · ${num(rows.length)}`}
        </button>
      ) : null}
    </SheetSection>
  );
}

/**
 * Цэгүүдийг дайрсан ЗӨӨЛӨН муруй (хэрэглэгч 2026-10-22: "smooth line") —
 * монотон куб (Fritsch–Carlson): хөрш хоёр цэгийн хооронд хэтэрч
 * (overshoot) тэгээс доош, оргилоос дээш гарахгүй тул утгыг худал
 * зурахгүй. Catmull-Rom нь тэг утгын өмнө сөрөг рүү унжиж байв.
 */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  if (!n) return "";
  if (n < 3) return pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++)
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/**
 * Хугацааны хэсэг — ХЭВТЭЭ ШУГАМАН ДИАГРАМ, доор нь 50%-ийн дүүргэлт
 * (хэрэглэгч 2026-10-22: "hundlun line chart ch ymuu dotroo fill 50 tai";
 * урьд нь багана байсан). Цэг бүр утгаа дээрээ бичнэ (≤ 12 цэг үед).
 * Багана бүрийн бүтэн өндрийн тунгалаг товч нь шүүлт хэвээр.
 * ⚠ SVG нь `preserveAspectRatio="none"`-оор сунана — шугамын зузааныг
 * `non-scaling-stroke` барина; цэг, тоо нь HTML (хувиар байрлана) тул
 * сунахгүй.
 */
/**
 * ⚠⚠ ОН, САР НЭГ КАРТАД ДАВХАРЛАНА (хэрэглэгч 2026-10-22: "eswel on sar
 * 2-iin chartaa dawhralchih"). Зэрэгцүүлэхэд хагас өргөнд тэнхлэг, утга
 * шахагдаж байв. НЭГ талбарын жил, сарын цуваа бүтэн өргөнтэй НЭГ карт
 * болж, дээрх "Жилээр · Сараар" товчоор сэлгэгдэнэ (`timeView`-тэй нэг
 * санаа). Шүүлт тус бүр өөрийн түлхүүрээр (`filterKey`) хэвээр.
 */
/** Хугацааны задаргааг ТАЛБАРААР бүлэглэнэ — он, сар нь нэг талбараас */
function timeGroups(times: Breakdown[]): Breakdown[][] {
  const by = new Map<string, Breakdown[]>();
  for (const b of times) {
    const k = b.field ?? b.id;
    by.set(k, [...(by.get(k) ?? []), b]);
  }
  return [...by.values()].map((g) =>
    [...g].sort((a, c) => (a.kind === "year" ? 0 : 1) - (c.kind === "year" ? 0 : 1)),
  );
}

function SheetTimes({
  list,
  tone,
  selectedOf,
  onPick,
}: {
  list: Breakdown[];
  tone: string;
  selectedOf: (b: Breakdown) => string | null;
  onPick: (b: Breakdown, k: string | null) => void;
}) {
  const [at, setAt] = React.useState(0);
  const b = list[Math.min(at, list.length - 1)];
  const labels = [...new Set(list.map((x) => x.label))];
  const title = labels.length === 1 ? labels[0] : labels.join(", ");
  const head = (
    <div className="mb-1.5 flex gap-1">
      {list.map((x, i) => (
        <button
          key={x.id}
          type="button"
          onClick={() => setAt(i)}
          aria-pressed={x === b}
          className={cn(
            "rounded-xs border px-2 py-0.5 text-[10.5px] transition-colors",
            x === b
              ? "border-(--tone) text-ink"
              : "border-line text-ink-3 hover:text-ink",
          )}
        >
          {x.kind === "month" ? "Сараар" : "Жилээр"}
        </button>
      ))}
    </div>
  );
  return (
    <SheetTime
      b={b}
      tone={tone}
      title={title}
      head={head}
      selected={selectedOf(b)}
      onPick={(k) => onPick(b, k)}
    />
  );
}

/** 10px `num` тоо, тэмдэгт тутмын ойролцоо өргөн (px) */
const TICK_CH = 6.2;

function SheetTime({
  b,
  tone,
  selected,
  onPick,
  title,
  head,
}: {
  b: Breakdown;
  tone: string;
  selected: string | null;
  onPick: (key: string | null) => void;
  /** Нэгтгэсэн картын гарчиг ({@link SheetTimes}) */
  title?: string;
  /** Диаграмын дээрх сэлгэгч ({@link SheetTimes}) */
  head?: React.ReactNode;
}) {
  /* Градиентийн id хуудсан дээр давтагдахгүй байх ёстой */
  const gid = React.useId().replace(/:/g, "");
  /* Өргөнийг хэмжинэ — он, сар зэрэгцэх үед хагас өргөнд утгын шошго
     багтах эсэхийг шийднэ (`ResizeObserver`-ын дуудлагад төлөв). */
  const [w, setW] = React.useState(0);
  const watch = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vals = b.values;
  const span = timeSpan(b);
  if (!span) return null;
  const n = vals.length;
  const max = Math.max(0, ...vals.map((d) => d.value));
  /* Утга цэгийн дээр — цөөн цэг үед, багтах үед л (давхцвал бичвэр
     уншигдахгүй; утга нь `title`-д үлдэнэ). Тоо ~6px/тэмдэгт (11px). */
  const longest = Math.max(1, ...vals.map((d) => sheetNum(d.value).length));
  const labelled = n <= 12 && (w === 0 || longest * 6.2 + 4 <= w / n);
  const unit = b.measure ? unitOf(b.measure).unit : "";
  /* Тэнхлэгийн шошго богино: "11-р сар" → "11" (гарчиг нь "Сар") */
  const tick = (label: string) => label.replace(/-р сар$/, "");
  /* Шошго багтах тоогоор сийрэгжинэ — эхний ба сүүлийнх үргэлж; сүүлийнх
     нь өмнөхтэйгээ хэт ойр бол өмнөхийг нь орхино (давхцахгүй). */
  const tickLen = Math.max(1, ...vals.map((d) => tick(d.label).length));
  const fit = w > 0 ? Math.max(1, Math.floor(w / (tickLen * TICK_CH + 8))) : 8;
  const step = Math.max(1, Math.ceil(n / fit));
  const ticks: number[] = [];
  for (let i = 0; i < n; i += step) ticks.push(i);
  if (ticks[ticks.length - 1] !== n - 1) {
    if (n - 1 - ticks[ticks.length - 1] < step && ticks.length > 1) ticks.pop();
    ticks.push(n - 1);
  }
  /* Хэвтээ байрлал — багана бүрийн голд; босоо нь дээд 22%-ийг шошгонд */
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const top = labelled ? 22 : 6;
  const y = (v: number) =>
    100 - (max > 0 ? (v / max) * (100 - top) : 0);
  const pts = vals.map((d, i) => [x(i), y(d.value)] as const);
  const line = smoothPath(pts);
  const area = `${line} L${x(n - 1)},100 L${x(0)},100 Z`;

  return (
    <SheetSection title={title ?? b.label} meta={unit || undefined}>
      {head}
      <div ref={watch} className="relative h-[84px] w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {/* Дүүргэлт ДЭЭРЭЭС ДООШ уусна (хэрэглэгч, 2026-10-22: "iim
              uusalt" — хуваалцсан `AreaChart`-ын градиенттай нэг) */}
          <defs>
            <linearGradient id={`st-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity={0.3} />
              <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#st-${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={tone}
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {vals.map((d, i) => {
          const sel = selected === d.key;
          const dim = selected != null && !sel;
          return (
            <React.Fragment key={d.key}>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-opacity",
                  sel ? "size-2.5" : "size-2",
                  dim && "opacity-40",
                )}
                style={{
                  left: `${x(i)}%`,
                  top: `${y(d.value)}%`,
                  background: tone,
                  borderColor: "var(--paper-2)",
                }}
              />
              {labelled && d.value > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "num pointer-events-none absolute -translate-x-1/2 -translate-y-full pb-1 text-[11px] font-semibold text-ink transition-opacity",
                    dim && "opacity-40",
                  )}
                  style={{ left: `${x(i)}%`, top: `${y(d.value)}%` }}
                >
                  {sheetNum(d.value)}
                </span>
              ) : null}
              <button
                type="button"
                title={`${d.label} · ${sheetNum(d.value)}`}
                onClick={() => onPick(sel ? null : d.key)}
                aria-pressed={sel}
                className={cn(
                  "absolute inset-y-0 rounded-xs transition-colors hover:bg-paper-hi/40",
                  sel && "bg-paper-hi/50",
                )}
                style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
              />
            </React.Fragment>
          );
        })}
      </div>
      {/* ⚠ Тэнхлэгийн шошго ХЭЗЭЭ Ч ТАСРАХГҮЙ (хэрэглэгч 2026-10-22, хагас
          өргөнд "2…" болж байв): нэг баганад шахахын оронд өргөнд багтах
          тоогоор сийрэгжиж, бүтнээрээ, ирмэгт хавчигдаж бичигдэнэ. */}
      <div className="relative mt-1 h-4 border-t border-line">
        {ticks.map((i) => {
          const text = tick(vals[i].label);
          const tw = text.length * TICK_CH;
          const at = w > 0
            ? Math.min(Math.max((x(i) / 100) * w - tw / 2, 0), w - tw)
            : null;
          return (
            <span
              key={vals[i].key}
              className={cn(
                "num absolute top-0.5 whitespace-nowrap text-[10px] leading-none text-ink-3",
                at == null && "-translate-x-1/2",
              )}
              style={{ left: at == null ? `${x(i)}%` : at }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </SheetSection>
  );
}

/**
 * ДАВХАРГЫН БҮХ ЗАДАРГАА — НЭГ КАРТ.
 *
 * ⚠⚠ Хэрэглэгч (2026-09-30): "одоо байгаа 2 чартыг нийлүүлээд маш
 * ойлгомжтой сайн чарт хийе. Нийт булгийн тоо бас харагдах ёстой шүү."
 *
 * Гурван зүйл нэг картад нийлнэ:
 * 1. **ТЭНХЛЭГ СЭЛГЭГЧ** — давхарга хэдэн ч задаргаатай байсан НЭГ
 *    карт (дүүрэг · хороо …). Урьд нь задаргаа бүр өөрийн карттай
 *    байсан тул нэг давхаргын мэдээлэл багана даяар тарж, хооронд нь
 *    харьцуулах гэвэл дээш доош гүйх хэрэгтэй байв.
 * 2. **ХҮСНЭГТ** — мөр нь ангилал, багана нь хэмжилт бүр; нүд бүр
 *    ӨӨРИЙН баганын хамгийн их утгатай харьцуулсан зураастай (багана
 *    хоорондоо өөр НЭГЖТЭЙ тул нэг хуваарь хуваалцах боломжгүй).
 * 3. **НИЙТ ДҮНГИЙН МӨР** — ёроолд наалдсан, багана бүрийн дүн
 *    өөрийнхөө баганын доор. "Нийт булгийн тоо" гэдэг нь яг энэ:
 *    хэмжилтийн баганын дүн.
 *    ⚠ ДУНДЖИЙН багана ХООСОН үлдэнэ — дунджуудын нийлбэр утгагүй
 *    тоо (бөгж, эзлэх хувийг дунджид хэрэглэдэггүйтэй нэг зарчим).
 *
 * ⚠ ЗӨВХӨН `tidy` бүрдэлд — ой, амьтан, үнэлгээ ХӨНДӨГДӨХГҮЙ.
 * ⚠ Идэвхтэй тэнхлэг нь ДАМ гарна: шүүлтээр задаргаа алга болвол
 * эхнийх рүү өөрөө буцна (эффектээр төлөв цэвэрлэхгүй).
 * ⚠ Мөр СОНГОХ нь ТОГТООНО, сэлгэхгүй (`pickOnly`): хүснэгт ГАНЦ
 * сонгогдсон утга харуулдаг тул олон сонголт зөвшөөрвөл хадгалагдсан
 * ба тодорсон утга ЗӨРНӨ.
 */
function AxisCard({
  axes,
  tone,
  first,
  records,
  word,
  selectedOf,
  onPick,
  bars = false,
  dense = false,
  full = false,
  stretch = false,
  fill = false,
  compact = false,
  paletteOf,
}: {
  /** Зурвасын мөр НЭГ ЭГНЭЭ ({@link AxisBars} `compact`) */
  compact?: boolean;
  axes: { key: string; label: string; list: Breakdown[] }[];
  tone: string;
  /**
   * Тэнхлэгийн палитр — газрын зурагтай ИЖИЛ өнгө (хэрэглэгч 2026-10-07,
   * ойн хэсэглэл: "чартын өнгийг бас"). Зургийг будаж буй талбарын
   * тэнхлэгт л буцаана; бусад нь давхаргын ганц өнгө.
   */
  paletteOf?: (axis: string) => Map<string, string> | undefined;
  first: boolean;
  /** Хүснэгтийн оронд зурвас ({@link LayerSet.axisBars}) */
  bars?: boolean;
  /** Давхаргын нийт бичлэг — тооллын баганын дүн */
  records: number;
  /** Бичлэгийг юу гэж нэрлэх ({@link LayerSet.record}) */
  word?: { one: string; count: string };
  selectedOf: (axis: string) => string | null;
  onPick: (axis: string, key: string | null) => void;
  /**
   * ШАХСАН мөр (хэрэглэгч, 2026-10-06: "булгийн нэртэй чартын зайг
   * шахъя"). Нэрийн тэнхлэг хорин мөртэй тул ердийн 10px-ийн доторх
   * зайтай мөр картыг сунгадаг; шахсан үед 4px, нэр НЭГ эгнээнд
   * (бүтэн нь `title`-д). Үсгийн хэмжээ платформын 11–13px мужид.
   */
  dense?: boolean;
  /**
   * БҮТЭН харагдана — баганын өндөр өөрчлөгдөхөд агшиж дотроо
   * гүйхгүй ({@link CutCard} `full`). Хэрэглэгч, 2026-10-06: "дүүргийн
   * чарт resize хийхэд бүтэн харагддаг байхаар хий".
   */
  full?: boolean;
  /**
   * Баганаа дүүргэх карт ({@link LayerSet.fillSolo}) — зурвасын горимд
   * агуулгын өндөрт хумигдахгүй, мөрүүд нь өндрийг ЖИГД хуваана.
   */
  stretch?: boolean;
  /**
   * Зурвасын горимд баганын ҮЛДСЭН өндрийг дүүргэнэ (`CutCard fill` →
   * `.is-fill`), мөрүүд нь жигд тархана (`AxisBars spread`). Мөр олон
   * бол картын ДОТОР гүйнэ.
   */
  fill?: boolean;
}) {
  /* ⚠ "бичлэг" нь мэдээллийн сангийн үг — дэлгэцэд гарахгүй */
  const one = word?.one ?? "бүртгэл";
  const countLabel = word?.count ?? "Бүртгэлийн тоо";
  const [want, setWant] = React.useState(axes[0]?.key ?? "");
  const axis = axes.find((a) => a.key === want) ?? axes[0];
  if (!axis) return null;

  const count = axis.list.find((b) => b.kind === "count") ?? axis.list[0];

  /**
   * Нэг баганын тодорхойлолт.
   *
   * ⚠⚠ НЭР ба НЭГЖ ХОЁР МӨРӨНД ({@link unitOf}). Урьд нь бүтэн нэрийг
   * нэг нүдэнд шахаж "ЭНГИЙН ХАМГААЛАЛТЫН БҮС (200 М), ГА" гэж ГУРВАН
   * мөр болгодог байсан тул толгой нь хүснэгтээ дардаг байв. Нэгжийг
   * доор нь жижиг саарал мөр болгоход нэр нь хоёр мөрөнд багтаж,
   * нэгж нь тодорхой хэвээр үлдэнэ.
   */
  type Col = {
    key: string;
    name: string;
    unit: string;
    by: Map<string, number>;
    total: number | null;
  };

  const cols: Col[] = [];
  const add = (
    key: string,
    label: string,
    by: Map<string, number>,
    sums: boolean,
  ) => {
    const cut = unitOf(label);
    cols.push({
      key,
      name: cut.unit ? cut.name : label,
      unit: cut.unit,
      by,
      total: sums ? [...by.values()].reduce((s, v) => s + v, 0) : null,
    });
  };

  for (const b of axis.list) {
    const by = new Map(b.values.map((d) => [d.key, d.value]));
    if (b.measure) {
      const cut = unitOf(b.measure);
      cols.push({
        key: b.id,
        name: cut.unit ? cut.name : b.measure,
        unit: [cut.unit, b.kind === "mean" ? "дундаж" : ""]
          .filter(Boolean)
          .join(" · "),
        by,
        total:
          b.kind === "mean"
            ? null
            : [...by.values()].reduce((s, v) => s + v, 0),
      });
    } else {
      add(b.id, countLabel, by, true);
    }
    /* Нийлсэн хэмжилт ({@link foldMeasures}) — өөрийн багана */
    if (b.notes && b.note) add(`${b.id}:note`, b.note.label, b.notes, true);
  }

  const picked = selectedOf(axis.key);
  const pal = paletteOf?.(axis.key);

  /*
    ⚠⚠ **ТЕГРҮҮЛЕГЧ УТГА ТОДОРНО — ДҮҮРГЕЛТГҮЙ**
    (хэрэглэгч, 2026-09-30: "энэ стиль биш юм байна").
    Нүд бүрд баганынхаа хэмжээгээр дэвсгэр өнгө өгсөн дулааны
    хүснэгт БУЦААГДСАН — **дахин бүү давт**. Тэр нь
    биотехникийн хүснэгтээс БУЦААГДСАН яг тэр шийдэл
    (2026-09-21): дүүргэлт нь хүснэгтийг өнгөний БЛОК болгож,
    тооноосоо илүү жин авдаг — дизайны 7 дүгээр дүрэм ("өнгө нь
    зураас/цэг/икон дээр л гарна") яг энэ тухай.

    ✅ Одоо өнгө нь БИЧВЕР дээр: багана бүрийн ТЕГРҮҮЛЕГЧ
    утга давхаргынхаа өнгөөр, хагас тодоор бичигдэнэ; бусад нь
    цэвэр тоо. "Аль ангилал ямар үзүүлэлтээр түрүнээд байна" гэдгийг
    дулааны хүснэгттэй ижил хэлнэ — гэхдээ ганц тодорсон цэгээр,
    бүтэн багана өнгөөр дүүрдэггүй.
    ⚠ БҮГД ТЭНЦҮҮ БАЙВАЛ ТОДРУУЛГА ГАРАХГҮЙ: бүх нүд тодорсон
    багана нь "тэргүүлэгч" гэдгийг заахаа болино.
    ⚠ ГАНЦ МӨРТЭЙ диаграмд бас ГАРАХГҮЙ — өөртэй нь
    харьцуулах зүйл байхгүй.
  */
  /*
    ⚠⚠ ОЛОН УТГАТАЙ ТЭНХЛЭГТ НИЙТ ДҮН ГАРАХГҮЙ (ойн сессийн
    анхааруулга, 2026-10-07). Нэг бүртгэл хэд хэдэн ангилалд (дүүрэгт)
    хамаарвал мөр бүрд тоологдох тул нийлбэр нь бүртгэлийн тооноос ИХ
    гарна — ойн тусгай хамгаалалттай газрын 42 талбайн 7 нь хэд хэдэн
    дүүрэгт. Хүснэгтийн ёроолын мөр ба зурвасын "Нийт" хоёуланд.
    Дунджийн нийлбэр утгагүйтэй нэг зарчим (`Matrix`-ийн `colTotals`).
  */
  if (axis.list.some((b) => b.multi))
    for (const c of cols) c.total = null;
  const lead = new Map<string, number | null>(
    cols.map((c) => {
      const vs = [...c.by.values()];
      if (vs.length < 2) return [c.key, null];
      const top = Math.max(...vs);
      return [c.key, vs.every((v) => v === top) ? null : top];
    }),
  );
  const isLead = (c: Col, v: number | undefined) =>
    v != null && lead.get(c.key) === v;
  const cell = (v: number | undefined) =>
    v == null ? <span className="text-ink-3">—</span> : num(Math.round(v));
  /* Зурвасын горимын гол багана — толгой ба нийт дүнд */
  const main = cols.find((c) => c.key === count.id);

  return (
    <CutCard
      /* Зурвасын горимд хэмжилтийн диаграм ("Нэр" тэнхлэг — талбай)
         юуг хэмжсэнээ гарчигтаа хэлнэ: хүснэгтэд тэр нь баганын
         толгойд байсан */
      title={bars && count.kind !== "count" ? chartTitle(count) : count.label}
      tone={tone}
      first={first}
      weight={cardWeight(count)}
      /* Зурвасын горимд агуулгынхаа өндөртэй — дөрвөн мөрийн доор
         картын тал хоосон үлддэг байв (хэрэглэгч, 2026-10-07) */
      full={full || (bars && !stretch && !fill)}
      fill={bars && fill}
      meta={`${num(records)} ${one} · ${
        count.top ? `эхний ${count.top}` : `${num(count.values.length)} ангилал`
      }`}
      action={
        /* Зурвасын горимд товчнууд БИЕД — гарчгийг хоёр мөр болгож
           шахдаг байв (доорхыг үзнэ үү) */
        axes.length > 1 && !bars ? (
          <Segments
            options={axes.map((a) => ({ id: a.key, label: a.label }))}
            value={axis.key}
            onChange={setWant}
          />
        ) : undefined
      }
    >
      {bars ? (
        /* ⚠ ЗУРВАСЫН ГОРИМ ({@link LayerSet.axisBars}): зөвхөн тэнхлэгийн
           ГОЛ диаграм (тоолол, эс бөгөөс эхний хэмжилт) зурагдана;
           нийлсэн хэмжилт (га) нь мөрийн ард бүдэг бичвэр. Бусад
           хэмжилтийн багана энд ГАРАХГҮЙ — ойн давхаргад тийм зүйл
           байхгүй (2026-10-06-нд шалгасан). */
        /*
          ⚠⚠ ЗУРВАСЫН ГОРИМ САЙЖИРСАН (хэрэглэгч, 2026-10-07, намгархаг
          газрын картаар: "чартаа сайжруулаачээ"). Хүснэгтээс зурвас руу
          шилжихэд ГУРВАН зүйл алдагдаж байв:
          1. ЮУГ хэмждэг нь — хүснэгтэд баганын толгой ("Айлын тоо")
             байсан; толгойн "61 бүртгэл" нь зурвасын нийлбэр (57 айл)
             БИШ тул төөрөгдүүлнэ. Одоо жагсаалтын дээр тэнхлэг ·
             хэмжигдэхүүний толгой.
          2. НИЙТ дүн — хүснэгтийн ёроолын мөр. Одоо жагсаалтын доор
             (дундаж, олон утгат тэнхлэг дээр гарахгүй).
          3. Гарчиг — сэлгэх товчнууд нэг эгнээнд шахаж гарчгийг хоёр
             мөр болгодог байв. Одоо товчнууд гарчгийн ДООР өөрийн
             эгнээнд.
          ⚠ Ойн хэлтсийн зурвасын горимд ч мөн үйлчилнэ (ойн сесс
          зөвшөөрсөн, 2026-10-07).
        */
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          {axes.length > 1 ? (
            <div className="shrink-0">
              <Segments
                options={axes.map((a) => ({ id: a.key, label: a.label }))}
                value={axis.key}
                onChange={setWant}
              />
            </div>
          ) : null}
          {/* Нягт горимд толгой, нийт мөр ГАРАХГҮЙ — тэнхлэгийн нэр нь
              картын гарчиг, нийт тоо нь толгойн мета-д аль хэдийн бий */}
          {compact ? null : (
          <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-line pb-1">
            <span className="eyebrow min-w-0 truncate text-ink-3">
              {axis.label}
            </span>
            <span className="eyebrow shrink-0 text-ink-3">
              {main
                ? `${main.name}${main.unit ? `, ${main.unit}` : ""}`
                : countLabel}
            </span>
          </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            <AxisBars
              spread={stretch || fill}
              compact={compact}
              colorOf={pal ? (d) => soft(pal.get(d.key)) : undefined}
              data={count.values}
              tone={tone}
              selected={picked}
              onSelect={(k) => onPick(axis.key, k)}
              note={noteOf(count)}
              format={count.kind === "count" ? num : measureText}
            />
          </div>
          {!compact && main?.total != null && count.values.length > 1 ? (
            <div className="flex shrink-0 items-baseline justify-between gap-3 border-t border-line-2 pt-1.5">
              <span className="text-[11.5px] font-medium text-ink-2">
                Нийт
                <span className="num ml-1.5 font-normal text-ink-3">
                  · {num(count.values.length)} ангилал
                </span>
              </span>
              <span className="num text-[12.5px] font-medium text-ink">
                {num(Math.round(main.total))}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/*
            ⚠⚠ ХҮСНЭГТ КАРТАА ДҮҮРГЭНЭ (`h-full` + доорх дүүргэгч мөр,
            2026-10-02). Карт нь баганынхаа үлдсэн өндрийг хуваалцдаг
            болсон тул (`flex-grow`) мөрүүд нь дээдээ эгнээд доороо
            хоосон зай үлдээдэг байв — нийт дүнгийн мөр тэр хоосон зайн
            ДЭЭР дүүжлэгдэнэ.
            ⚠ `sticky bottom` ҮҮНИЙГ ШИЙДЭХГҮЙ: наалдац нь зөвхөн
            агуулга ХАЛИХ үед л ажилладаг; карт агуулгаасаа өндөр үед
            мөр байрандаа үлдэнэ.
          */}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="h-full w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th
                    className={cn(
                      "sticky top-0 z-10 border-b border-line-2 bg-paper-2 px-2 text-left align-bottom",
                      dense ? "py-1.5" : "py-2",
                    )}
                  >
                    <span className="eyebrow text-ink-3">{axis.label}</span>
                  </th>
                  {cols.map((c) => (
                    <th
                      key={c.key}
                      className={cn(
                        "sticky top-0 z-10 border-b border-line-2 border-l border-l-line bg-paper-2 px-2 text-right align-bottom",
                        dense ? "py-1.5" : "py-2",
                      )}
                    >
                      <span className="eyebrow block leading-tight text-ink-3">
                        {c.name}
                      </span>
                      {c.unit ? (
                        <span className="mt-0.5 block text-[9.5px] leading-none text-ink-3 lowercase">
                          {c.unit}
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {count.values.map((r) => {
                  const on = picked === r.key;
                  return (
                    <tr
                      key={r.key}
                      tabIndex={0}
                      aria-selected={on}
                      onClick={() => onPick(axis.key, on ? null : r.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPick(axis.key, on ? null : r.key);
                        }
                      }}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-paper-hi",
                        on && "bg-paper-hi",
                      )}
                      style={{ opacity: picked && !on ? 0.45 : 1 }}
                    >
                      <td
                        className={cn(
                          "border-b border-line px-2 leading-tight",
                          dense
                            ? "w-full max-w-0 truncate py-1 text-[11.5px]"
                            : "py-2.5 text-[12px]",
                          on ? "font-medium text-ink" : "text-ink-2",
                        )}
                        title={dense ? r.label : undefined}
                      >
                        {r.label}
                      </td>
                      {cols.map((c) => {
                        const v = c.by.get(r.key);
                        const top = isLead(c, v);
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              "num border-b border-line border-l border-l-line px-2 text-right",
                              dense
                                ? "py-1 text-[11.5px] whitespace-nowrap"
                                : "py-2.5 text-[12.5px]",
                              top ? "font-medium" : "text-ink",
                            )}
                            style={top ? { color: tone } : undefined}
                          >
                            {cell(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/*
                  ДҮҮРГЭГЧ МӨР — үлдсэн өндрийг БҮТНЭЭР нь шингээнэ
                  (`h-full`), улмаас бодит мөрүүд нягтралаа хадгалж,
                  нийт дүн нь картынхаа ёроолд суана.
                  ⚠ Агуулга халих үед өндөр нь өөрөө тэг болно.
                  ⚠ Товшигддоггүй, хүрээгүй — зөвхөн зай эзэлнэ.
                */}
                <tr aria-hidden="true" className="h-full">
                  <td colSpan={cols.length + 1} />
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td
                    className={cn(
                      "sticky bottom-0 border-t border-line-2 bg-paper-2 px-2 text-[11.5px] font-medium text-ink-2",
                      dense ? "py-1.5" : "py-2",
                    )}
                  >
                    Нийт
                  </td>
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "num sticky bottom-0 border-t border-line-2 border-l border-l-line bg-paper-2 px-2 text-right font-medium text-ink",
                        dense ? "py-1.5 text-[11.5px]" : "py-2 text-[12.5px]",
                      )}
                    >
                      {c.total == null ? "" : num(Math.round(c.total))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </CutCard>
  );
}

/**
 * ГАЗРЫН ЖАГСААЛТ — баганын ҮЛДСЭН өндрийг бодит бүртгэлээр дүүргэнэ
 * ({@link LayerSet.recordList}).
 *
 * ⚠⚠ Хэрэглэгч 2026-10-07-нд дөрвөн хувилбараас сонгосон ("Газрын
 * жагсаалт"). Өмнө нь ТАВАН арга буцаагдсан: зурвасын мөрийг сунгах,
 * тэнхлэг бүрийг тусдаа карт болгох, босоо баганан диаграм, хэвтээ
 * хүснэгт — бүгд хоосон зайг ДҮРСЛЭЛЭЭР дүүргэх оролдлого байв. Энэ нь
 * зайг АГУУЛГААР дүүргэнэ: цэг бүр нэр · ангилал · дүүрэг · хэмжилтээр.
 *
 * ⚠ Мөр нь ТАЛБАРЫН шүүлтийг дагана (`passes`), харин БИЧЛЭГИЙН
 * сонголтыг ДАГАХГҮЙ: мөр дарахад тэр бичлэг бүх самбарын шүүлт болдог
 * ({@link views}) тул жагсаалт ганц мөр болж хумигдвал өөр газар руу
 * шилжих арга алга болно. Сонгосон мөр нь зөвхөн тодорно.
 * ⚠ Өнгөт цэг нь зургийн палитраас (`palettes`) — жагсаалт, зураг,
 * таних тэмдэг гурав нэг өнгө хэлнэ.
 * ⚠ Мөр дарахад зураг тэр цэг рүү ойртоно (`rowPick`); дахин дарвал
 * сонголт цуцлагдана.
 */
function RecordListCard({
  hit,
  base,
  tone,
  word,
  passes,
  palette,
  picked,
  onPick,
}: {
  hit: Loaded;
  base: number;
  tone: string;
  word?: { one?: string; count?: string };
  passes: (row: Row) => boolean;
  palette?: { colors: Map<string, string>; keyOf: (row: Row) => string[] };
  picked: number | null;
  onPick: (uid: number | null) => void;
}) {
  const nameField = hit.labels.name;
  /* Мөрийн доорх хоёр шошго: өнгөлсөн талбар эхэнд, дараа нь засаг
     захиргааны нэгж. Хугацааны, хураасан задаргаа ОРОХГҮЙ */
  const tags = React.useMemo(() => {
    const counts = hit.charts.filter(
      (b) => b.kind === "count" && !b.top && !isTime(b) && b.field !== nameField,
    );
    const lead = palette ? counts.find((b) => b.keyOf === palette.keyOf) : undefined;
    const admin = counts.find(
      (b) => b !== lead && /дүүрэг|сум|duureg/i.test(`${b.label} ${b.field}`),
    );
    return [lead, admin].filter((b): b is Breakdown => !!b);
  }, [hit.charts, nameField, palette]);
  /* Хэмжилт — эхний НИЙЛБЭР задаргааны талбар (айлын тоо гэх мэт) */
  const measure = React.useMemo(() => {
    const b = hit.charts.find((c) => c.kind === "sum" && c.measure);
    if (!b?.measure) return null;
    const f = hit.info.fields.find((x) => x.alias === b.measure);
    return f ? { name: f.name, label: b.measure } : null;
  }, [hit.charts, hit.info.fields]);

  const items = React.useMemo(() => {
    const out: {
      uid: number;
      name: string;
      tags: string[];
      color?: string;
      value: number | null;
    }[] = [];
    for (const [k, row] of Object.entries(hit.data.rows)) {
      if (!passes(row)) continue;
      const oid = Number(k);
      const raw = nameField ? categoryKey(row[nameField]) : "Бүртгэгдээгүй";
      const t = tags.map((b) => {
        const key = b.keyOf(row)[0];
        return key ? (b.values.find((d) => d.key === key)?.label ?? key) : "";
      });
      const v = measure && row[measure.name] != null ? Number(row[measure.name]) : NaN;
      out.push({
        uid: base + oid,
        name: raw !== "Бүртгэгдээгүй" ? raw : `№ ${oid}`,
        tags: t.filter(Boolean),
        color: palette?.colors.get(palette.keyOf(row)[0] ?? ""),
        value: Number.isFinite(v) ? v : null,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, "mn"));
  }, [hit.data.rows, passes, nameField, tags, measure, palette, base]);

  return (
    <CutCard
      title="Газрын жагсаалт"
      tone={tone}
      meta={`${num(items.length)} ${word?.one ?? "бүртгэл"}`}
      fill
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {measure ? (
          <div className="sticky top-0 z-[1] grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-line bg-paper-2 px-1.5 pb-1 text-[10px] text-ink-3 uppercase">
            <span>Нэр</span>
            <span className="text-right">{measure.label}</span>
          </div>
        ) : null}
        <ul className="divide-y divide-line">
          {items.map((it) => {
            const on = picked === it.uid;
            return (
              <li key={it.uid}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(on ? null : it.uid)}
                  className={cn(
                    "grid w-full grid-cols-[8px_minmax(0,1fr)_auto] items-start gap-x-2.5 px-1.5 py-1.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                    on && "bg-paper-hi",
                  )}
                  style={on ? { boxShadow: `inset 2px 0 0 ${tone}` } : undefined}
                >
                  <span
                    aria-hidden
                    className="mt-[5px] size-2 rounded-full"
                    style={{ background: it.color ?? tone }}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn("block truncate text-[12px]", on ? "text-ink" : "text-ink-2")}
                      title={it.name}
                    >
                      {it.name}
                    </span>
                    {it.tags.length ? (
                      <span className="block truncate text-[10.5px] text-ink-3">
                        {it.tags.join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  {measure ? (
                    <span className="num pt-px text-right text-[12px] text-ink">
                      {it.value == null ? "—" : num(it.value)}
                    </span>
                  ) : (
                    <span />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </CutCard>
  );
}

/**
 * ТЭНХЛЭГИЙН ЗУРВАС — хэмжих хэрэгслийн хэвтээ хуваарь
 * (хэрэглэгч, 2026-10-07, намгархаг газрын картаар: "маш энгийн байна,
 * сайжруулаарай").
 *
 * `RowChart`-ын нимгэн зураас нь мөр бүрийн НЭРИЙН доор бараг үл
 * мэдэгдэх шугам болж, утгууд хоорондоо хэр зөрдөг нь хуваарьгүй тул
 * уншигддаггүй байв. Энэ нь платформын "хээрийн хэмжих хэрэгсэл"
 * хэлээр:
 *
 * - ЭРЭМБЭ ("01", "02") — жагсаалт нь буурах дарааллаар гэдгийг хэлнэ;
 * - ЗАМ ДЭЭРХ ЗУРВАС (6px) — зам нь бүтэн хуваарийг заана, зурвас нь
 *   түүний хэсэг; ганц өнгө (`tone`), ялгаа нь уртаараа;
 * - ТЭРГҮҮЛЭГЧ УТГА давхаргын өнгөөр — хүснэгтийн `isLead`-тэй нэг
 *   дүрэм; бүгд тэнцүү бол тодрохгүй;
 * - ДООР НЬ ХУВААРЬ (`.ruler` сэдэл) — 0-ээс хамгийн их утга хүртэл
 *   "сайхан" алхмаар (1·2·5 × 10ⁿ); зурвасын урт юуг заахыг уншина.
 *
 * ⚠ Сүүдэр, градиент, дүүргэлттэй дэвсгэр БАЙХГҮЙ (дизайны 1, 7-р
 * дүрэм). Сонгосон мөр нь `inset 2px` зураас + `paper-hi` дэвсгэр.
 * ⚠ Хувь БИЧИХГҮЙ (хэрэглэгч, 2026-09-25).
 */
function niceStep(max: number): number {
  if (!(max > 0)) return 1;
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function AxisBars({
  spread = false,
  compact = false,
  colorOf,
  data,
  tone,
  selected,
  onSelect,
  note,
  format,
}: {
  /**
   * Сунгасан картад мөрүүд өндрийг ЖИГД хуваана — дээд талдаа
   * шахагдаж доороо хоосон үлдэхгүй (ойн `fillSolo`, 2026-10-07).
   * ⚠ Мөр бүр 88px-ээс өндөр болохгүй: цөөн мөртэй үед зурвас
   * хоорондоо хэт холдож, жагсаалт биш тусдаа зүйлс мэт уншигдана.
   */
  spread?: boolean;
  /**
   * НЭГ ЭГНЭЭНИЙ МӨР — эрэмбэ · нэр · зурвас · тоо зэрэгцэнэ (~24px,
   * ердийнх ~44px). Олон карт нэг баганад зэрэг харагдах бүрдэлд
   * ({@link LayerSet.unfold}). Хуваарь гарахгүй — тоо нь мөр бүрд бий.
   */
  compact?: boolean;
  /** Газрын зурагтай ижил ангиллын өнгө ({@link AxisCard} `paletteOf`) */
  colorOf?: (d: Datum) => string | undefined;
  data: Datum[];
  tone: string;
  selected: string | null;
  onSelect: (key: string | null) => void;
  note?: (d: Datum) => string;
  format: (v: number) => string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (compact) {
    const lead1 =
      data.length > 1 && data.some((d) => d.value !== max) ? max : null;
    const pad1 = Math.max(2, String(data.length).length);
    return (
      <div className="flex flex-col">
        {data.map((d, i) => {
          const on = selected === d.key;
          const isLead = lead1 != null && d.value === lead1;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : d.key)}
              className={cn(
                "grid w-full grid-cols-[auto_minmax(0,9.5rem)_minmax(0,1fr)_3.5rem] items-center gap-x-2.5 rounded-xs px-1.5 py-[3.5px] text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                on && "bg-paper-hi",
              )}
              style={on ? { boxShadow: `inset 2px 0 0 ${tone}` } : undefined}
            >
              <span className="num text-[10px] text-ink-3">
                {String(i + 1).padStart(pad1, "0")}
              </span>
              <span
                className={cn("truncate text-[12px]", on ? "text-ink" : "text-ink-2")}
                title={d.label}
              >
                {d.label}
              </span>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-[1px] bg-line">
                <span
                  className="block h-full rounded-[1px]"
                  style={{
                    width: `${max > 0 ? Math.max(1.5, (d.value / max) * 100) : 0}%`,
                    background: colorOf?.(d) ?? tone,
                    opacity: on || selected == null ? 1 : 0.45,
                  }}
                />
              </span>
              <span
                className="num text-right text-[12.5px] font-medium text-ink"
                style={isLead ? { color: `oklch(from ${tone} var(--value-l) calc(c * var(--value-c)) h)` } : undefined}
              >
                {format(d.value)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
  const step = niceStep(max);
  /* Хуваарийн дээд хязгаар — хамгийн их утгыг багтаах хамгийн бага
     алхмын үржвэр; эс тэгвээс хамгийн урт зурвас хуваарийнхаа ирмэгт
     наалдаж, сүүлийн шошго хэрэгцээгүй өндөр гарна */
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  const lead =
    data.length > 1 && data.some((d) => d.value !== max) ? max : null;
  const pad = String(data.length).length < 2 ? 2 : String(data.length).length;

  return (
    <div className={cn("flex flex-col", spread && "h-full")}>
      <div
        className={cn(
          "flex flex-col gap-0.5",
          spread && "min-h-0 flex-1 justify-evenly",
        )}
      >
        {data.map((d, i) => {
          const on = selected === d.key;
          const extra = note?.(d);
          const isLead = lead != null && d.value === lead;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : d.key)}
              className={cn(
                "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-1 rounded-xs px-1.5 py-1.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                on && "bg-paper-hi",
                spread && "max-h-[88px]",
              )}
              style={on ? { boxShadow: `inset 2px 0 0 ${tone}` } : undefined}
            >
              <span className="num text-[10px] text-ink-3">
                {String(i + 1).padStart(pad, "0")}
              </span>
              <span
                className={cn(
                  "truncate text-[12px]",
                  on ? "text-ink" : "text-ink-2",
                )}
                title={d.label}
              >
                {d.label}
                {extra ? (
                  <span className="num ml-1.5 text-[11px] text-ink-3">
                    {extra}
                  </span>
                ) : null}
              </span>
              <span
                className="num text-right text-[13px] font-medium text-ink"
                style={isLead ? { color: `oklch(from ${tone} var(--value-l) calc(c * var(--value-c)) h)` } : undefined}
              >
                {format(d.value)}
              </span>
              <span
                aria-hidden
                className="col-span-2 col-start-2 h-1.5 overflow-hidden rounded-[1px] bg-line"
              >
                <span
                  className="block h-full rounded-[1px]"
                  style={{
                    width: `${top > 0 ? Math.max(1.5, (d.value / top) * 100) : 0}%`,
                    background: colorOf?.(d) ?? tone,
                    opacity: on || selected == null ? 1 : 0.45,
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
      {/* Хуваарь — мөрүүдтэй ИЖИЛ тор: эрэмбийн баганын үл үзэгдэх
          орлуулагч нь зүүн ирмэгийг зурвасны эхлэлтэй ЯГ таацуулна */}
      {max > 0 ? (
        <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 px-1.5">
          <span aria-hidden className="num invisible text-[10px]">
            {"0".repeat(pad)}
          </span>
          <div className="relative h-4 border-t border-line-2">
            {ticks.map((v) => (
              <span
                key={v}
                className="num absolute top-0 -translate-x-1/2 pt-0.5 text-[10px] text-ink-3"
                style={{ left: `${(v / top) * 100}%` }}
              >
                <span
                  aria-hidden
                  className="absolute -top-px left-1/2 h-1 w-px bg-line-2"
                />
                {format(v)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Бүсийн доторх дүрсүүд — бүсийн картын задаргаа.
 *
 * ⚠⚠ ИЖИЛ ХЭМЖЭЭТЭЙ ДАРААЛСАН ДҮРС НЭГ МӨРӨНД (хэрэглэгч, 2026-10-06,
 * зургаар: "хөгжүүлээд сайжруул"). Хориглолтын бүсийн 18 дүрсийн 12
 * нь (№ 6–17) тус бүр 7 га буюу ижил радиустай тойрог бөгөөд арван
 * хоёр ижил мөр жагсаалтын гуравны хоёрыг эзэлж, том зургаа нь тэдний
 * дунд алга болж байв. Гурваас олон дараалсан мөр ижил (бөөрөнхийлсөн)
 * талбайтай бол НЭГ бүлгийн мөр болно; товшиход задарна.
 * ⚠ Мөр ХАСАГДАХГҮЙ: бүлэг дотор тус бүр нь товшигдож сонгогдсоор
 * байна. Сонгосон дүрс бүлэг дотор байвал бүлэг өөрөө нээлттэй гарна.
 * ⚠ Бүлгийн утга нь "тус бүр" — нийлбэр БИШ: мөрүүд ижил хэмжээтэй
 * гэдэг нь гол мэдээлэл, нийлбэрийг бүсийн толгой аль хэдийн хэлдэг.
 *
 * ⚠ Зурвас БАЙХГҮЙ (хэрэглэгч, 2026-10-06) — нэр ба талбай хоёр
 * баганатай жагсаалт; талбай нь баруун ирмэгтээ эгнэнэ.
 */
const ZONE_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3";

function ZoneShapes({
  rows,
  tone,
  base,
  picked,
  onPick,
}: {
  rows: Datum[];
  tone: string;
  /** Давхаргын UID-ийн суурь (`uidBase`) */
  base: number;
  picked: number | null;
  onPick: (uid: number | null) => void;
}) {
  const [openRun, setOpenRun] = React.useState<string | null>(null);

  const runs = React.useMemo(() => {
    const out: Datum[][] = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && Math.round(last[0].value) === Math.round(r.value))
        last.push(r);
      else out.push([r]);
    }
    /* Гурваас цөөн давталт нь бүлэг болохгүй — тэр нь ердийн жагсаалт */
    return out.flatMap((run) =>
      run.length >= 3 ? [run] : run.map((r) => [r]),
    );
  }, [rows]);

  const row = (r: Datum, nested = false) => {
    const uid = base + Number(r.key);
    const on = picked === uid;
    return (
      <button
        key={r.key}
        type="button"
        aria-pressed={on}
        onClick={() => onPick(on ? null : uid)}
        className={cn(
          ZONE_GRID,
          "border-l-2 py-1 pr-0.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
          nested ? "pl-4" : "pl-1.5",
          on ? "bg-paper-hi" : "border-transparent",
        )}
        style={on ? { borderLeftColor: tone } : undefined}
      >
        <span
          className={cn(
            "truncate text-[11.5px]",
            on ? "text-ink" : "text-ink-2",
          )}
          title={r.label}
        >
          {r.label}
        </span>
        <span className="num text-right text-[11.5px] whitespace-nowrap text-ink-3">
          {num(Math.round(r.value))} га
        </span>
      </button>
    );
  };

  /* "№ 6", "№ 7" … гэсэн дараалсан дугаар бол мужаар нэрлэнэ, эс бөгөөс
     эхний ба сүүлчийн нэрээр */
  const runLabel = (run: Datum[]) => {
    const nos = run.map((r) => /^№ (\d+)$/.exec(r.label)?.[1]);
    if (nos.every(Boolean)) {
      const n = nos.map(Number).sort((a, b) => a - b);
      if (n[n.length - 1] - n[0] === n.length - 1)
        return `№ ${n[0]} – ${n[n.length - 1]}`;
    }
    return `${run[0].label} … ${run[run.length - 1].label}`;
  };

  return (
    <div>
      {runs.map((run) => {
        if (run.length === 1) return row(run[0]);
        const key = run[0].key;
        const holds = run.some((r) => base + Number(r.key) === picked);
        const open = openRun === key || holds;
        return (
          <div key={`run:${key}`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenRun(openRun === key ? null : key)}
              className={cn(
                ZONE_GRID,
                "border-l-2 border-transparent py-1 pr-0.5 pl-1.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
              )}
            >
              <span className="flex min-w-0 items-center gap-1 text-[11.5px] text-ink-2">
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3 shrink-0 text-ink-3 transition-transform",
                    !open && "-rotate-90",
                  )}
                />
                <span className="truncate">{runLabel(run)}</span>
                <span className="num shrink-0 text-ink-3">
                  · {num(run.length)} дүрс
                </span>
              </span>
              <span className="num text-right text-[11.5px] whitespace-nowrap text-ink-3">
                тус бүр {num(Math.round(run[0].value))} га
              </span>
            </button>
            {open ? run.map((r) => row(r, true)) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * БҮСЭД ДАВХЦАХ НЭГЖ ТАЛБАР — зориулалт, эрхийн хэлбэрээр
 * (хэрэглэгч, 2026-10-06, бүсийн картын зургийг заан: "энэ чартын
 * доор нэгж талбарынх нь чартыг гарга").
 *
 * Бүсийн карт нь "хэдэн нэгж талбар" гэдгийг хэлдэг; энэ нь "ЯМАР
 * газар" гэдгийг — хамгаалалтын бүсийн дотор орон сууц, үйлдвэр,
 * хөдөө аж ахуйн газар хэр байгааг.
 *
 * ⚠⚠ БҮС ТУС БҮРЭЭР, НЭГТГЭХГҮЙ: гурван бүс бие биеэ агуулдаг
 * ({@link fetchParcelsOn}-ийн тэмдэглэл — тэжээгдэл 17 мянга,
 * хязгаарлалт 11 мянга, хориглолт 4 мянга, давхардалгүй нь бага) тул
 * нийлбэр нь нэг нэгж талбарыг хоёр, гурав тоолно. Бүс сонгох товч нь
 * бүсийн картын өнгөт тэмдэгтэй ижил өнгөтэй.
 * ⚠ Нийлбэр нь бүсийн картын тоотой ТААРНА: хоосон утга нь
 * "Бүртгэгдээгүй" гэсэн мөр болж үлддэг ({@link parcelCountsIn}).
 * ⚠ Тоолол СЕРВЕР дээр — нэгж талбарын атрибут хөтөч рүү орохгүй.
 */
/**
 * Нэгж талбарын диаграмаас СОНГОСОН ангилал — газрын зурагт тодруулна
 * (хэрэглэгч, 2026-10-06: "нэгж талбарын чартнаас шүүгддэг болгоё").
 */
type ParcelPick = {
  /** Бүс · тэнхлэг · ангилал — үр дүнг сонголттой нь тааруулна */
  id: string;
  rings: GeoJSON.Position[][];
  where: string;
  label: string;
  tone: string;
};

/** Бүсийн хуудасны газрын зориулалт — эхний мөрийн тоо ({@link ZoneSheet}) */
const ZONE_TOP = 5;

/**
 * ⚠⚠ БҮС БҮР ӨӨРИЙН ХЭСЭГ (хэрэглэгч 2026-10-22: "goliin tatam,
 * hamgaalaltiin bus 2 tsonhiig chi shineer hiidee" → "Бүс бүр өөрийн
 * карт"). Голын татам, хамгаалалтын бүсийн хуудасны горимд ({@link
 * LayerSet.sheet}) бүс (сав газар) бүр тусдаа хураагддаг хэсэг: дээр нь
 * талбай ба давхцаж буй нэгж талбар ТОМ тоогоор, доор нь тэр бүсийн
 * газрын зориулалт эхний {@link ZONE_TOP}, "Бусад N ангилал" дэлгэгдэнэ.
 * Урьдын хувилбар нь бүсийн жагсаалт + бүс, тэнхлэг сэлгэдэг ганц нэгж
 * талбарын карт байсан — БҮХ бүс зэрэг харагдахгүй байв.
 *
 * ⚠ Бүс, тэнхлэг сонгох товч БАЙХГҮЙ. Тэнхлэг нь газрын зориулалт
 * (олдохгүй бол эхнийх — эрхийн хэлбэр).
 * ⚠ Толгойн {@link MapPin} — газрын зургийг тэр бүсээр шүүнэ / дүрсийг
 * сонгоно (урьдын бүсийн мөрийн товшилттой ижил үйлдэл).
 * ⚠ Мөр товшиход тэр бүсийн тэр ангиллын нэгж талбар зурагт тодорно
 * ({@link ParcelPick}, дугаарын хэлбэр {@link ParcelCard}-тай ижил).
 * ⚠ ЗУРВАС НЬ НЭГЖ ТАЛБАРЫН ТООГ хэмжинэ — га-ийн дүүргэлтийн зурвас
 * БИШ (2026-10-06-нд буцаагдсан).
 */
function ZoneSheet({
  zone,
  shapes,
  active,
  onHead,
  open,
  onToggle,
  anchor,
  pickedId,
  pickInfo,
  onPick,
}: {
  zone: {
    id: string;
    label: string;
    tone: string;
    ha: number;
    parcels?: number;
    features: GeoJSON.Feature[];
  };
  /** Олон дүрстэй бүсийн дүрсүүдийн жагсаалт (хамгаалалтын бүс) */
  shapes?: React.ReactNode;
  /** Газрын зураг энэ бүсээр шүүгдсэн / дүрс сонгогдсон эсэх */
  active: boolean;
  onHead?: () => void;
  /** Хэсэг нээлттэй эсэх — эцэг удирдана (анхдагчаар хураагдсан) */
  open: boolean;
  onToggle: () => void;
  anchor: string;
  /** Одоо тодруулсан нэгж талбарын ангиллын дугаар ({@link ParcelPick.id}) */
  pickedId: string | null;
  pickInfo: { busy: boolean; count: number | null; capped: boolean } | null;
  onPick: (pick: ParcelPick | null) => void;
}) {
  const [axes, setAxes] = React.useState<ParcelAxis[] | null>(null);
  const [axesError, setAxesError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    key: string;
    rows?: ParcelCount[];
    error?: string;
  } | null>(null);
  const [all, setAll] = React.useState(false);
  const [shapesOpen, setShapesOpen] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    parcelAxes()
      .then((a) => live && setAxes(a))
      .catch((e: Error) => live && setAxesError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const axis =
    axes?.find((a) => /зориулалт/i.test(a.label)) ?? axes?.[0] ?? null;
  const rings = React.useMemo(() => ringsOf(zone.features), [zone.features]);
  const key = axis ? `${zone.id}\u0000${axis.field}` : null;

  React.useEffect(() => {
    if (!axis || !key || !rings.length) return;
    let live = true;
    parcelCountsIn(zone.id, rings, axis.field)
      .then((rows) => live && setResult({ key, rows }))
      .catch((e: Error) => live && setResult({ key, error: e.message }));
    return () => {
      live = false;
    };
  }, [zone.id, axis, key, rings]);

  const current = result?.key === key ? result : null;
  const rows = current?.rows ?? null;
  const prefix = key ? `${key} ` : null;
  const selected =
    prefix && pickedId?.startsWith(prefix)
      ? pickedId.slice(prefix.length)
      : null;

  const choose = (r: ParcelCount) => {
    if (!axis || !key) return;
    if (selected === r.key) {
      onPick(null);
      return;
    }
    onPick({
      id: `${key} ${r.key}`,
      rings,
      where: parcelWhere(axis.field, r.raws),
      label: r.label,
      tone: zone.tone,
    });
  };

  const shown = rows
    ? all
      ? rows
      : rows.filter((r, i) => i < ZONE_TOP || r.key === selected)
    : null;
  const rest = rows && shown ? rows.length - shown.length : 0;
  const max = Math.max(0, ...(rows ?? []).map((r) => r.value));
  const digits = Math.max(3, ...(rows ?? []).map((r) => num(r.value).length));
  const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;

  const stat = (value: string, unit: string, label: string) => (
    <div className="min-w-0">
      <p className="num text-[18px] font-semibold leading-tight text-ink">
        {value}
        {unit ? (
          <span className="ml-1 text-[11px] font-normal text-ink-3">{unit}</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{label}</p>
    </div>
  );

  return (
    <SheetSection
      title={zone.label}
      dot={zone.tone}
      open={open}
      onToggle={onToggle}
      anchor={anchor}
      meta={`${num(Math.round(zone.ha))} га`}
      action={
        onHead ? (
          <button
            type="button"
            onClick={onHead}
            aria-pressed={active}
            aria-label="Газрын зурагт харуулах"
            title="Газрын зурагт харуулах"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-xs border text-ink-3 hover:bg-paper-hi hover:text-ink",
              active ? "border-line-2 bg-paper-hi text-ink" : "border-transparent",
            )}
            style={active ? { color: zone.tone } : undefined}
          >
            <MapPin size={13} />
          </button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-x-4">
        {stat(num(Math.round(zone.ha)), "га", "Талбай")}
        {stat(
          zone.parcels == null ? "…" : num(zone.parcels),
          "",
          "Давхцаж буй нэгж талбар",
        )}
      </div>

      {shapes ? (
        <div className="mt-2 border-t border-line pt-1.5">
          <button
            type="button"
            aria-expanded={shapesOpen}
            onClick={() => setShapesOpen((o) => !o)}
            className="flex w-full items-center gap-1.5 text-left text-[11.5px] text-ink-2 hover:text-ink"
          >
            <ChevronDown
              size={12}
              className={cn(
                "shrink-0 text-ink-3 transition-transform",
                !shapesOpen && "-rotate-90",
              )}
            />
            Дүрс
          </button>
          {shapesOpen ? <div className="pt-1">{shapes}</div> : null}
        </div>
      ) : null}

      {axes && !axes.length ? null : (
        <div className="mt-2 border-t border-line pt-1.5">
          <p className="mb-1 flex items-baseline justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            <span>{axis?.label ?? "Газрын зориулалт"}</span>
            {rows ? (
              <span className="num font-normal normal-case tracking-normal">
                {num(rows.length)} ангилал
              </span>
            ) : null}
          </p>
          {axesError || current?.error ? (
            <p className="py-1 text-[11.5px] text-clay">
              {axesError ?? current?.error}
            </p>
          ) : !shown ? (
            <p className="flex items-center gap-1.5 py-1 text-[11.5px] text-ink-3">
              <Loader2 size={12} className="animate-spin" />
              Тоолж байна…
            </p>
          ) : !shown.length ? (
            <p className="py-1 text-[11.5px] text-ink-3">
              Давхцаж буй нэгж талбар байхгүй
            </p>
          ) : (
            <>
              <div className="flex flex-col">
                {shown.map((r) => {
                  const on = selected === r.key;
                  const w =
                    max > 0 && r.value
                      ? Math.max(1.5, (r.value / max) * 100)
                      : 0;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => choose(r)}
                      aria-pressed={on}
                      title={r.label}
                      style={{ gridTemplateColumns: cols }}
                      className={cn(
                        "grid w-full items-center gap-2.5 rounded-xs px-1.5 py-[3px] text-left text-[12.5px] transition-colors hover:bg-paper-hi",
                        on && "bg-paper-hi",
                        selected != null && !on && "opacity-45",
                      )}
                    >
                      <span className="min-w-0 truncate text-[12px] text-ink">
                        {r.label}
                      </span>
                      <span className="block h-2 rounded-[1px] bg-line">
                        <span
                          className="block h-full rounded-[1px]"
                          style={{ width: `${w}%`, background: sheetFade(zone.tone) }}
                        />
                      </span>
                      <span className="num text-right text-[12.5px] font-semibold text-ink">
                        {num(r.value)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {rest > 0 || all ? (
                <button
                  type="button"
                  onClick={() => setAll((s) => !s)}
                  className="mt-0.5 px-1.5 text-left text-[11px] text-ink-3 hover:text-ink"
                >
                  {all ? "Хураах" : `Бусад ${num(rest)} ангилал`}
                </button>
              ) : null}
              {selected && pickInfo ? (
                <p className="num mt-1 flex items-center gap-1.5 border-t border-line pt-1.5 text-[11px] text-ink-3">
                  {pickInfo.busy ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Газрын зурагт тодруулж байна…
                    </>
                  ) : (
                    <>
                      Газрын зурагт:{" "}
                      <span className="text-ink">
                        {num(pickInfo.count ?? 0)} нэгж талбар
                      </span>
                      {pickInfo.capped ? " · хэсэгчилсэн" : ""}
                    </>
                  )}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </SheetSection>
  );
}

/** Хэмжилт хийгдэхээс өмнөх мөрийн тоо ({@link ParcelCard}) */
const PARCEL_TOP = 10;

function ParcelCard({
  sheet = false,
  zones,
  prefer = null,
  onPick,
  pickInfo = null,
}: {
  /** Хуудасны харагдац ({@link LayerSet.sheet}) — хураагддаг хэсэг,
      мөр нь `SheetAxis`-ийн хэлбэрээр, эхний {@link SHEET_ROWS} */
  sheet?: boolean;
  zones: {
    id: string;
    label: string;
    tone: string;
    features: GeoJSON.Feature[];
  }[];
  /**
   * Самбарын шүүлтээр сонгогдсон бүс (голын татмын сав газар) — карт
   * түүн рүү ӨӨРӨӨ шилжинэ: газрын зураг, бүсийн карт, энэ карт гурав
   * нэг сонголтыг дагана. Хэрэглэгч энд өөр товч дарвал тэр нь давуу,
   * гэхдээ шүүлт дахин солигдох хүртэл л.
   */
  prefer?: string | null;
  /** Мөр товшиход — сонгосон ангилал, эсвэл цуцлалт (`null`) */
  onPick?: (pick: ParcelPick | null) => void;
  /** Газрын зурагт тодруулсан үр дүн — диаграмын доор тоогоор хэлнэ */
  pickInfo?: { busy: boolean; count: number | null; capped: boolean } | null;
}) {
  /* Гараар сонгосон бүс — ямар `prefer`-ийн үед сонгосноо хамт барина:
     шүүлт солигдвол гар сонголт хүчингүй болж `prefer` дахин түрүүлнэ
     (эффектээр төлөв цэвэрлэхгүй — ДАМ гарна) */
  const [chosen, setChosen] = React.useState<{
    prefer: string | null;
    id: string;
  } | null>(null);
  const zoneId =
    chosen && chosen.prefer === prefer ? chosen.id : (prefer ?? null);
  const setZoneId = (id: string) => {
    setChosen({ prefer, id });
    /* Бүс солигдоход өмнөх бүсийн тодруулга зураг дээр үлдэх ёсгүй */
    onPick?.(null);
  };
  const [axisField, setAxisFieldRaw] = React.useState<string | null>(null);
  const setAxisField = (field: string) => {
    setAxisFieldRaw(field);
    onPick?.(null);
  };
  const [axes, setAxes] = React.useState<ParcelAxis[] | null>(null);
  const [axesError, setAxesError] = React.useState<string | null>(null);
  /* Үр дүн нь ТҮЛХҮҮРТЭЙГЭЭ хамт — бүс, тэнхлэг солигдоход хуучин
     хариу шинэ сонголтын дор харагдахгүй (эффектээс `set*(null)`
     дуудахгүйн тулд ачаалал нь түлхүүрийн зөрүүнээс ДАМ гарна) */
  const [result, setResult] = React.useState<{
    key: string;
    rows?: ParcelCount[];
    error?: string;
  } | null>(null);

  React.useEffect(() => {
    let live = true;
    parcelAxes()
      .then((a) => live && setAxes(a))
      .catch((e: Error) => live && setAxesError(e.message));
    return () => {
      live = false;
    };
  }, []);

  /* Сонголт нь ДАМ — бүс эсвэл тэнхлэг алга болбол эхнийх рүү буцна */
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const axis = axes?.find((a) => a.field === axisField) ?? axes?.[0] ?? null;
  const rings = React.useMemo(
    () => (zone ? ringsOf(zone.features) : []),
    [zone],
  );
  const key = zone && axis ? `${zone.id}\u0000${axis.field}` : null;

  /*
    СОНГОСОН АНГИЛАЛ — бүс, тэнхлэгтэйгээ ХАМТ (`ctx`): тэдгээр
    солигдоход сонголт ДАМ хүчингүй болно (эффектээр цэвэрлэхгүй).
  */
  const [cat, setCat] = React.useState<{ ctx: string; key: string } | null>(
    null,
  );
  /* Эцэг самбар тодруулгыг цэвэрлэвэл ("Цэвэрлэх", сав газар солих)
     `pickInfo` нь `null` болно — мөр ч тодрохоо болино */
  const selectedCat =
    cat && key && cat.ctx === key && pickInfo ? cat.key : null;

  React.useEffect(() => {
    if (!zone || !axis || !key || !rings.length) return;
    let live = true;
    parcelCountsIn(zone.id, rings, axis.field)
      .then((rows) => live && setResult({ key, rows }))
      .catch((e: Error) => live && setResult({ key, error: e.message }));
    return () => {
      live = false;
    };
  }, [zone, axis, key, rings]);

  const current = result?.key === key ? result : null;
  const rows = current?.rows ?? null;
  const total = rows?.reduce((n, r) => n + r.value, 0) ?? null;

  /*
    ⚠⚠ БАГТАХ МӨРИЙН ТООГ ХЭМЖИЖ ТОГТООНО (хэрэглэгч, 2026-10-06: "2
    чартаа чи өөрөө мэдээд тааруул"). Урьд нь тогтмол арав байсан нь
    өндөр дэлгэцэд хоосон зай, намхан дэлгэцэд гүйлгүүр үлдээдэг байв.

    Карт нь баганын ҮЛДСЭН өндрийг бүтнээр эзэлнэ (`fill`), бүсийн карт
    нь агуулгынхаа өндөртэй (`full`). Жагсаалтын талбайн өндөр ба
    мөрийн БОДИТ өндрийг `ResizeObserver` хэмжиж, багтах тоог гаргана
    — бүсүүдийг задлахад бүсийн карт өсөж, энэ жагсаалт дагаж хумигдана.

    ⚠ Хэмжилт нь ажиглагчийн дуудлагад — эффектээс шууд `set*`
    дуудахгүй (`react-hooks/set-state-in-effect`).
    ⚠ Мөрийн тоо нь `data-rows`-оос: зурагдалтын үед `ref`-д бичихийг
    `react-hooks/refs` хориглодог.
    ⚠ ХАМГИЙН БАГАДАА ГУРАВ: бүх бүсийг задалснаар зай дуусвал багана
    өөрөө гүйнэ — гурваас цөөн мөр нь диаграм биш.
    ⚠ ХУРААЛТ ИЛ хэвээр: "Бусад N ангилал · M нэгж талбар" мөр юу
    нуугдсаныг тоогоор хэлж, товшиход бүгдийг дэлгэнэ (тэр үед
    жагсаалт дотроо гүйнэ). Толгойн нийт тоо БҮХ мөрийнх.
    ⚠ Мөрийн тоо хэмжилтээс хамаарч өөрчлөгдөхөд эргэлдэхгүй: хураах
    мөр нь жагсаалтын ГАДНА тул түүнийг гаргах, нуух нь талбайн өндрийг
    өөрчилсөн ч дүгнэлт нь хэвээр үлддэг.
  */
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const expanded = openKey != null && openKey === key;
  const listRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState<{ avail: number; row: number }>({
    avail: 0,
    row: 0,
  });
  const hasList = !!rows?.length;

  React.useEffect(() => {
    const list = listRef.current;
    const chart = chartRef.current;
    if (!list || !chart) return;
    const measure = () => {
      const n = Number(chart.dataset.rows) || 0;
      const row = n > 0 ? chart.offsetHeight / n : 0;
      const avail = list.clientHeight;
      setFit((f) =>
        Math.abs(f.avail - avail) < 1 && Math.abs(f.row - row) < 0.5
          ? f
          : { avail, row: row || f.row },
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    ro.observe(chart);
    return () => ro.disconnect();
  }, [hasList]);

  /* ⚠ "Бүгд багтах уу" гэдгийг ЭХЭЛЖ шалгана: агуулгын өндөртэй
     горимд (`is-fit`) талбай нь яг `n × мөр` тул нөөцийн 2px-ийг хасаад
     хуваавал n − 1 гарч, хураах ↔ дэлгэх хооронд эргэлдэнэ */
  const measured = fit.row > 0 && fit.avail > 0;
  const cap = sheet
    ? SHEET_ROWS
    : !measured
    ? PARCEL_TOP
    : rows && rows.length * fit.row <= fit.avail + 1
      ? rows.length
      : Math.max(3, Math.floor((fit.avail - 2) / fit.row));
  const folded = !!rows && !expanded && rows.length > cap;
  const shown = rows && folded ? rows.slice(0, cap) : rows;
  const rest = rows && folded ? rows.slice(cap) : [];

  if (axes && !axes.length) return null;

  /* Мөр товших — тэр бүсийн тэр ангиллын нэгж талбар зурагт тодорно */
  const choose = (k: string | null) => {
    const r = k && rows ? rows.find((x) => x.key === k) : null;
    if (!k || !r || !key || !zone || !axis) {
      setCat(null);
      onPick?.(null);
      return;
    }
    setCat({ ctx: key, key: k });
    onPick?.({
      id: `${key} ${k}`,
      rings,
      where: parcelWhere(axis.field, r.raws),
      label: r.label,
      tone: zone.tone,
    });
  };

  const meta = total == null ? undefined : `${num(total)} нэгж талбар`;
  const wrap = (body: React.ReactNode) =>
    sheet ? (
      <SheetSection title="Давхцаж буй нэгж талбар" meta={meta}>
        {body}
      </SheetSection>
    ) : (
    <CutCard
      title="Давхцаж буй нэгж талбар"
      tone={zone?.tone ?? "var(--data)"}
      first
      meta={meta}
      fill
      /* Бүх мөр багтаж байвал карт АГУУЛГЫНХАА өндөртэй — үлдсэн
         өндрийг эзэлж доороо хоосон зай үлдээхгүй (хэрэглэгч,
         2026-10-06: "хоосон зай гаргахгүй"). Багтахгүй болмогц
         (`folded`) үлдсэн өндрийг дүүргэж хураана */
      fit={!!rows && !folded && !expanded}
    >
      {body}
    </CutCard>
    );

  /* Хуудасны мөрүүд — `SheetAxis`-тэй нэг хэлбэр: нэр · зурвас · тоо */
  const sheetRows = (list: ParcelCount[]) => {
    const max = Math.max(0, ...(rows ?? []).map((r) => r.value));
    const digits = Math.max(3, ...list.map((r) => num(r.value).length));
    const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;
    const tone = zone?.tone ?? "var(--data)";
    return (
      <div className="flex flex-col">
        {list.map((r) => {
          const on = selectedCat === r.key;
          const w = max > 0 && r.value ? Math.max(1.5, (r.value / max) * 100) : 0;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => choose(on ? null : r.key)}
              aria-pressed={on}
              title={r.label}
              style={{ gridTemplateColumns: cols }}
              className={cn(
                "grid w-full items-center gap-2.5 rounded-xs px-1.5 py-[3px] text-left text-[12.5px] transition-colors hover:bg-paper-hi",
                on && "bg-paper-hi",
                selectedCat != null && !on && "opacity-45",
              )}
            >
              <span className="min-w-0 truncate text-[12px] text-ink">
                {r.label}
              </span>
              <span className="block h-2 rounded-[1px] bg-line">
                <span
                  className="block h-full rounded-[1px]"
                  style={{ width: `${w}%`, background: sheetFade(tone) }}
                />
              </span>
              <span className="num text-right text-[12.5px] font-semibold text-ink">
                {num(r.value)}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return wrap(
      <div className={cn("flex flex-col gap-2", !sheet && "min-h-0 flex-1")}>
        {/* Бүс сонгогч — бүсийн картын дарааллаар, өнгөөр */}
        <div className="flex flex-wrap gap-1">
          {zones.map((z) => {
            const on = z.id === zone?.id;
            return (
              <button
                key={z.id}
                type="button"
                aria-pressed={on}
                onClick={() => setZoneId(z.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xs border px-2 py-1 text-[11.5px] focus-visible:outline-offset-[-2px]",
                  on
                    ? "border-line-2 bg-paper-hi text-ink"
                    : "border-line text-ink-2 hover:bg-paper-hi hover:text-ink",
                )}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[1px]"
                  style={{ background: z.tone }}
                />
                {z.label}
              </button>
            );
          })}
        </div>

        {/* Тэнхлэг сонгогч — эх сурвалжид олдсон талбаруудаас л */}
        {axes && axes.length > 1 ? (
          <div className="flex gap-3 border-b border-line text-[11.5px]">
            {axes.map((a) => {
              const on = a.field === axis?.field;
              return (
                <button
                  key={a.field}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAxisField(a.field)}
                  className={cn(
                    "-mb-px border-b-2 pb-1 focus-visible:outline-offset-[-2px]",
                    on
                      ? "text-ink"
                      : "border-transparent text-ink-3 hover:text-ink",
                  )}
                  style={on ? { borderBottomColor: zone?.tone } : undefined}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {axesError || current?.error ? (
          <p className="py-2 text-[11.5px] text-clay">
            {axesError ?? current?.error}
          </p>
        ) : rows && shown ? (
          rows.length ? (
            <>
              <div
                ref={listRef}
                className={cn(
                  !sheet && "min-h-0 flex-1",
                  !sheet && (expanded ? "overflow-y-auto" : "overflow-hidden"),
                )}
              >
                <div ref={chartRef} data-rows={shown.length}>
                  {sheet ? sheetRows(shown) : (
                  <RowChart
                    data={shown}
                    tone={zone?.tone}
                    format={(v) => num(v)}
                    dense
                    clamp
                    /*
                      ⚠⚠ МӨР ТОВШИГДОНО (хэрэглэгч, 2026-10-06: "нэгж
                      талбарын чартнаас шүүгддэг болгоё"). Тэр бүсийн
                      тэр ангиллын нэгж талбарууд газрын зурагт бүсийн
                      өнгөөр тодорч, зураг тэдэн рүү ойртоно. Дахин
                      товшиход цуцлагдана.
                      ⚠ Нөхцөл нь мөрөнд нийлсэн БҮХ эх утгаас
                      (`raws`) — бичиглэлийн зөрүүтэй утга нэг мөр
                      болдог тул нэгийг нь л авбал зурагт дутуу гарна.
                    */
                    selected={selectedCat}
                    onSelect={choose}
                  />
                  )}
                </div>
              </div>
              {selectedCat && pickInfo ? (
                <p className="num flex shrink-0 items-center gap-1.5 border-t border-line pt-1.5 text-[11px] text-ink-3">
                  {pickInfo.busy ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Газрын зурагт тодруулж байна…
                    </>
                  ) : (
                    <>
                      Газрын зурагт:{" "}
                      <span className="text-ink">
                        {num(pickInfo.count ?? 0)} нэгж талбар
                      </span>
                      {pickInfo.capped ? " · хэсэгчилсэн" : ""}
                    </>
                  )}
                </p>
              ) : null}
              {folded || expanded ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenKey(expanded ? null : key)}
                  className="flex w-full shrink-0 items-center gap-1.5 border-t border-line pt-1.5 text-left text-[11.5px] text-ink-2 hover:text-ink focus-visible:outline-offset-[-2px]"
                >
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-3.5 shrink-0 text-ink-3 transition-transform",
                      expanded ? "rotate-180" : "",
                    )}
                  />
                  {expanded ? (
                    "Жагсаалтыг хураах"
                  ) : (
                    <>
                      <span>Бусад {num(rest.length)} ангилал</span>
                      <span className="num ml-auto text-ink-3">
                        {num(rest.reduce((n, r) => n + r.value, 0))} нэгж талбар
                      </span>
                    </>
                  )}
                </button>
              ) : null}
            </>
          ) : (
            <p className="py-2 text-[11.5px] text-ink-3">
              Нэгж талбар бүртгэгдээгүй байна
            </p>
          )
        ) : (
          <p className="flex items-center gap-2 py-2 text-[11.5px] text-ink-3">
            <Loader2 size={13} className="animate-spin" />
            Нэгж талбарын мэдээллийг ачаалж байна…
          </p>
        )}
      </div>,
  );
}

function CutCard({
  title,
  tone,
  first,
  weight = 1,
  meta,
  action,
  full,
  fill,
  fit,
  source,
  bare,
  children,
}: {
  title: string;
  tone: string;
  /**
   * БҮТЭН харагдана — агшихгүй, дотроо гүйхгүй (`.is-full`). Баганын
   * өндрийг бусад карттай хуваалцахгүй; бусад нь үлдсэн зайг авна.
   */
  full?: boolean;
  /**
   * Баганын ҮЛДСЭН өндрийг бүтнээр эзэлнэ (`.is-fill`) — агуулга нь
   * өөрөө хэмжиж багтана ({@link ParcelCard}).
   */
  fill?: boolean;
  /**
   * `fill` картыг АГУУЛГЫНХАА өндөрт буцаана (`.is-fit`) — бүх мөр
   * багтсан үед. Ингэснээр карт хэзээ ч хоосон зайгаар сунахгүй.
   */
  fit?: boolean;
  /** Давхаргын ЭХНИЙ карт — туузандаа наалдаж, бүлгээ эхлүүлнэ */
  first?: boolean;
  /**
   * ӨНДРИЙН ЖИН — агуулгын хэмжээгээр (хэрэглэгч, 2026-09-24:
   * "чартуудыг scroll-гүй харагддаг болгоорой").
   *
   * Урьд нь картууд үлдсэн өндрийг ТЭНЦҮҮ хуваадаг байсан
   * тул дөрвөн зүсэмтэй бөгж доороо хоосон зай үлдээж байхад
   * арван мөртэй зурвас тэртэй АДИЛ өндөрт шахагдаж гүйлгүүр
   * гаргадаг байв. Жин нь мөрийн тооноос гарна: үлдсэн өндөр
   * АГУУЛГЫН ХЭРЭГЦЭЭГЭЭР хуваарилагдана.
   */
  weight?: number;
  /**
   * Толгойн БАРИМТЫН мөр — нийт дүн ба ангиллын тоо.
   *
   * Урьд нь карт зөвхөн гарчигтай байсан тул "энэ диаграм хэдийг
   * хуваарилж байна вэ" гэдэг нь зурвасуудыг нүдээр нэмж байж л
   * мэдэгддэг байв.
   */
  meta?: string;
  action?: React.ReactNode;
  /** Гарчгийн хулганы тайлбар — давхарга ба эх сурвалжийн талбарын нэр */
  source?: string;
  /** Гарчгийн мөр ГАРАХГҮЙ — биеийн эхний мөр (тайлбар) толгойн үүрэг гүйцэтгэнэ */
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "analytics-chart-card flex min-h-0 flex-col rounded-xl border border-line bg-paper-2",
        first && "border-t-2",
        full && "is-full",
        fill && "is-fill",
        fill && fit && "is-fit",
      )}
      style={
        {
          /*
            ⚠⚠ `full`/`fill` картад ЖИН ТАВИХГҮЙ (хэрэглэгч, 2026-10-06,
            зургаар: "энэ дунд хоосон зай гарахгүй"). Inline `flexGrow`
            нь CSS-ийн `.is-full { flex: 0 0 auto }`-г ДАРДАГ тул
            бүсийн карт 6 жингээрээ сунаж, гурван мөрийн доор хагас
            баганын хоосон зай үүсгэн нэгж талбарын картыг ёроол руу
            шахаж байв. Тэдний өндрийг CSS бүрэн эзэмшинэ.
          */
          ...(full || fill ? null : { flexGrow: weight }),
          /*
            ДООД ӨНДӨР нь мөн АГУУЛГЫН ХЭРЭГЦЭЭГЭЭР (2026-09-25).
            168px гэсэн ТОГТМОЛ шал нь ганц мөртэй картад ч
            хамаардаг байсан тул нэг тоо харуулах карт бүтэн
            диаграмын өндрийг эзэлж, урт диаграмыг баганаас
            шахаж гаргадаг байв. Шал нь одоо жингээ дагана —
            дээд хязгаар нь хэвээр 168px.
          */
          "--card-min": `${Math.min(168, 70 + weight * 26)}px`,
          ...(first ? { borderTopColor: tone } : null),
        } as React.CSSProperties
      }
    >
      {bare ? null : (
        <div className="analytics-chart-head">
          <h2 className="text-ink" title={source ? `${title}\n${source}` : title}>
            {title}
          </h2>
          {meta ? (
            <span className="num shrink-0 text-[10.5px] whitespace-nowrap text-ink-3">
              {meta}
            </span>
          ) : null}
          {action}
        </div>
      )}
      <div className="analytics-chart-body">{children}</div>
    </div>
  );
}

/**
 * Сонгосон бичлэгийн хөвөгч самбар.
 *
 * Платформын бусад ес самбартай нэг зан төлөв: толгойгоороо чирэгдэж,
 * булангаасаа хэмжээ нь солигдоно. Зургийн буланд суудаг тул доор нь
 * яг тэр дүрс орвол хаагдана — хэрэглэгч хааж, ойртож, дахин нээх
 * ёсгүй.
 */
/** Дүрс тус бүрт давхцах нэгж талбарын тоо — товч цонхны кэш */
const SHAPE_PARCELS = new Map<string, Promise<number>>();

function RecordPanel({
  hit,
  row,
  oid,
  place,
  tone,
  onClose,
}: {
  hit: Loaded;
  row: Record<string, unknown>;
  /** Давхарга доторх ТҮҮХИЙ дугаар (`objectid`) */
  oid: number;
  /** Тооцоолсон байршлын нэр ({@link LayerSet.placeNames}) — ангилалгүй үед */
  place?: string;
  tone: string;
  onClose: () => void;
}) {
  const panel = useMapPanel("left");
  const { info } = hit;
  const brief = Boolean(info.set.brief);
  /* Цонхны диаграм ({@link LayerSet.recordCharts}) — тэдгээрт орсон
     талбар жагсаалтад ДАХИН гарахгүй (бөглөгдсөн ч, бөглөөгүй ч) */
  const groups = info.set.recordCharts?.[info.id] ?? [];
  const charted = new Set(
    groups.flatMap((g) => [
      ...(g.total ? [g.total] : []),
      ...g.years.map((y) => y.field),
    ]),
  );

  /*
    ДҮРСТЭЙ ДАВХЦАХ НЭГЖ ТАЛБАР — товч цонхонд ({@link LayerSet.brief}).
    Тухайн НЭГ дүрсийн хүрээгээр серверээс тоолно; хариу нь дүрс тус
    бүрээр кэшлэгдэнэ (`SHAPE_PARCELS`) тул дахин дарахад асуухгүй.
    ⚠ Үр дүн ТҮЛХҮҮРТЭЙГЭЭ — өөр дүрс сонгоход хуучин тоо гарахгүй
    (эффектээс `set*(null)` дуудахгүйн тулд ДАМ шалгана).
  */
  const countKey = `${info.name}\u0000${oid}`;
  const [parcelCount, setParcelCount] = React.useState<{
    key: string;
    n: number | null;
  } | null>(null);
  React.useEffect(() => {
    if (!brief) return;
    const f = hit.data.shapes.features.find((x) => Number(x.id) === oid);
    const rings = f ? ringsOf([f]) : [];
    if (!rings.length) return;
    let p = SHAPE_PARCELS.get(countKey);
    if (!p) {
      p = countParcelsIn(rings);
      SHAPE_PARCELS.set(countKey, p);
      /* Унасан амлалтыг кэшид үлдээхгүй */
      p.catch(() => SHAPE_PARCELS.delete(countKey));
    }
    let live = true;
    p.then(
      (n) => live && setParcelCount({ key: countKey, n }),
      () => live && setParcelCount({ key: countKey, n: null }),
    );
    return () => {
      live = false;
    };
  }, [brief, hit, oid, countKey]);
  const parcels = parcelCount?.key === countKey ? parcelCount : null;

  /*
    ⚠⚠ ЗАГВАР ШИНЭЧЛЭГДСЭН (хэрэглэгч, 2026-10-06: "pop up загвар
    шинэчилье"). Урьд нь давхаргын нэр л гарчигт сууж, бүх талбар нэг
    жагсаалтад ИЖИЛ ЖИНТЭЙ — ТОМ ҮСГЭЭР, 92px-ийн баганад — цуварч,
    хоосон талбарууд бөглөгдсөнүүдийн ДУНД холилдож байв. Аль дүрс
    сонгогдсон, тэр нь хэр том вэ гэдгийг жагсаалтаас хайж олох хэрэгтэй
    болдог байлаа. Одоо ГУРВАН давхарга:

    1. ТОЛГОЙ — өнгөт тэмдэг (зургийн өнгө), дүрсийн НЭР (зургийн
       шошго ба бүсийн картын мөртэй НЭГ эх сурвалж), талбай.
    2. БӨГЛӨГДСӨН ТАЛБАРУУД — нэр · утга хоёр баганаар, энгийн үсгээр.
    3. БӨГЛӨӨГҮЙ ТАЛБАРУУД — доор нь тоотойгоо, нэрсээр нь.
       ⚠ ХАСААГҮЙ: 2026-09-30-нд "хоосон ч хамаагүй бүх талбар"
       гэсэн шийдвэр хэвээр — хоосон байдал нь өөрөө мэдээлэл. Зөвхөн
       бөглөгдсөн утгуудын дундаас ЯЛГАРСАН.
  */
  const name = hit.labels.name ? categoryKey(row[hit.labels.name]) : "";
  const group = leadGroup(hit);
  const tag = group ? categoryKey(row[group]) : "Бүртгэгдээгүй";
  const title =
    name && name !== "Бүртгэгдээгүй"
      ? name
      : tag !== "Бүртгэгдээгүй"
        ? `${tag} · № ${oid}`
        : place
          ? place
          : `№ ${oid}`;
  const rawArea = hit.data.area[oid];
  const ha =
    rawArea != null && Number.isFinite(rawArea)
      ? info.areaInHa
        ? rawArea
        : rawArea / 10000
      : null;

  const filled: {
    name: string;
    /** Шошго — нэгж нь утга руу шилжсэн бол нэгжгүй нэр */
    label: string;
    text: string;
    unit: string;
    isNum: boolean;
    /** Урт бичвэр — шошго нь дээр, утга нь бүтэн өргөнөөр */
    wide: boolean;
  }[] = [];
  const empty: { name: string; alias: string }[] = [];
  /*
    ⚠⚠ БАЙРШИЛ ТОЛГОЙД (хэрэглэгч, 2026-10-22: "buh datanii pop up
    saijruulaarai"). Засаг захиргааны шат (аймаг · сум, дүүрэг · баг,
    хороо — {@link adminRank}) нь жагсаалтын дунд тархаж, "хаана вэ"
    гэдэг нь хэдэн мөрөөс угсрагддаг байв. Одоо нэрийн доор НЭГ мөр,
    өргөнөөс нарийн руу; жагсаалтад давтагдахгүй.
    ⚠ Богино утга л (≤ 40 тэмдэгт): урт бол тэр нь хаяг, тайлбар —
    жагсаалтад бүтнээрээ үлдэнэ.
  */
  const where: { rank: number; text: string }[] = [];
  /* Толгойд гарсан утга жагсаалтад ДАВТАГДАХГҮЙ — нэг тоог хоёр газар
     бичихгүй дүрэм (нэр, ангилал, талбай) */
  const shown = new Set<string>();
  if (name && name !== "Бүртгэгдээгүй" && hit.labels.name)
    shown.add(hit.labels.name);
  if (group && tag !== "Бүртгэгдээгүй") shown.add(group);
  if (ha != null && info.areaField) shown.add(info.areaField);
  for (const f of info.fields) {
    if (shown.has(f.name) || charted.has(f.name)) continue;
    const rank = adminRank(f.alias) ?? adminRank(f.name);
    if (rank == null) continue;
    const v = row[f.name];
    const t =
      typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    if (!t || t.length > 40) continue;
    shown.add(f.name);
    if (t !== title && !where.some((w) => w.text === t))
      where.push({ rank, text: t });
  }
  where.sort((a, b) => a.rank - b.rank);
  for (const f of info.fields) {
    if (shown.has(f.name) || charted.has(f.name)) continue;
    /* Систем талбар (дугаарлалт, координат, нэгтгэлийн үлдэц) хүнд
       юу ч хэлэхгүй ({@link isSystemField}) — бөглөөгүй хэсэгт ч орохгүй */
    if (isSystemField(f.name, f.alias)) continue;
    const v = row[f.name];
    const text = typeof v === "string" ? v.trim() : v;
    if (text === "" || text == null) {
      empty.push({ name: f.name, alias: f.alias });
      continue;
    }
    const out = fieldText(f, text);
    if (!out.text) {
      empty.push({ name: f.name, alias: f.alias });
      continue;
    }
    filled.push({
      name: f.name,
      label: out.unit ? unitOf(f.alias).name : f.alias,
      text: out.text,
      unit: out.unit,
      isNum: out.isNum,
      wide: !out.isNum && out.text.length > 48,
    });
  }

  /*
    ⚠⚠ ТОВЧ ЦОНХ — ГУРВАН МӨР (хэрэглэгч, 2026-10-06: "Нэр — Туул,
    Талбай — 0000, Нэгж талбар — 0000 гээд тэр л"). Бусад талбар,
    бөглөөгүй хэсэг ГАРАХГҮЙ. Нэр нь нэрийн багана → ангилал (сав
    газар) → дугаар; дугаар нь сонгосон дүрсийг ялгахаас өөр юу ч
    хэлэхгүй тул нэр олдсон үед бичигдэхгүй.
  */
  if (brief) {
    const briefName =
      name && name !== "Бүртгэгдээгүй"
        ? name
        : tag !== "Бүртгэгдээгүй"
          ? tag
          : `№ ${oid}`;
    const rows: { label: string; value: React.ReactNode; num?: boolean }[] = [
      { label: "Нэр", value: briefName },
    ];
    if (ha != null)
      rows.push({
        label: "Талбай",
        value: `${num(ha, ha >= 100 ? 0 : 2)} га`,
        num: true,
      });
    if (info.geometry !== "Point")
      rows.push({
        label: "Нэгж талбар",
        value: parcels ? (
          parcels.n == null ? (
            <span className="text-ink-3">Тодорхойгүй</span>
          ) : (
            num(parcels.n)
          )
        ) : (
          <Loader2 size={12} className="inline animate-spin text-ink-3" />
        ),
        num: true,
      });
    return (
      <MapPanel
        state={panel}
        title={info.name}
        onClose={onClose}
        className="top-2 right-2 w-[260px]"
      >
        <dl className="divide-y divide-line">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-3 px-3 py-2"
            >
              <dt className="flex items-center gap-2 text-[11.5px] text-ink-3">
                {r.label === "Нэр" ? (
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[1px]"
                    style={{ background: tone }}
                  />
                ) : null}
                {r.label}
              </dt>
              <dd
                className={cn(
                  "min-w-0 text-right text-[13px] font-medium break-words text-ink",
                  r.num && "num",
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </MapPanel>
    );
  }

  return (
    <MapPanel
      state={panel}
      title={info.name}
      onClose={onClose}
      /*
        ⚠⚠ ӨНДӨР НЬ АГУУЛГААРАА, БҮТЭН БИШ (2026-09-29): `max-h` нь урт
        бичлэгийг хамгаална, бие нь дотроо гүйнэ.
      */
      className="top-2 right-2 max-h-[calc(100%-2.5rem)] w-[320px]"
    >
      <div className="min-h-0 overflow-y-auto">
        {/* ---- 1. Толгой ---- */}
        <div className="flex items-start gap-2.5 border-b border-line px-3 py-2.5">
          <span
            aria-hidden
            className="mt-[5px] size-2.5 shrink-0 rounded-[1px]"
            style={{ background: tone }}
          />
          <div className="min-w-0 flex-1">
            <p className="display text-[14px] leading-snug text-ink">{title}</p>
            {name && tag !== "Бүртгэгдээгүй" && tag !== name ? (
              <p className="mt-0.5 text-[11.5px] text-ink-3">{tag}</p>
            ) : null}
            {where.length ? (
              <p className="mt-1 flex items-start gap-1 text-[11.5px] leading-snug text-ink-2">
                <MapPin
                  size={11}
                  aria-hidden
                  className="mt-[2px] shrink-0 text-ink-3"
                />
                <span className="min-w-0">
                  {where.map((w) => w.text).join(" · ")}
                </span>
              </p>
            ) : null}
          </div>
          {ha != null ? (
            <span className="num shrink-0 text-right text-[14px] font-medium whitespace-nowrap text-ink">
              {num(ha, ha >= 100 ? 0 : 2)}
              <span className="ml-1 text-[11px] font-normal text-ink-3">
                га
              </span>
            </span>
          ) : null}
        </div>

        {/* ---- 1б. Оны диаграм ({@link LayerSet.recordCharts}) ---- */}
        {groups.length ? (
          <div className="divide-y divide-line border-b border-line">
            {groups.map((g) => (
              <RecordBars key={g.label} group={g} row={row} tone={tone} />
            ))}
          </div>
        ) : null}

        {/* ---- 2. Бөглөгдсөн талбарууд ---- */}
        {filled.length ? (
          <dl className="divide-y divide-line">
            {filled.map((f) =>
              f.wide ? (
                <div key={f.name} className="px-3 py-2">
                  <dt className="text-[11px] leading-snug text-ink-3">
                    {f.label}
                  </dt>
                  <dd className="mt-0.5 text-[12px] leading-relaxed break-words whitespace-pre-line text-ink">
                    {f.text}
                  </dd>
                </div>
              ) : (
                <div
                  key={f.name}
                  className="grid grid-cols-[minmax(0,44%)_minmax(0,1fr)] items-baseline gap-3 px-3 py-1.5"
                >
                  <dt className="text-[11px] leading-snug text-ink-3">
                    {f.label}
                  </dt>
                  <dd
                    className={cn(
                      "min-w-0 text-[12px] leading-snug break-words text-ink",
                      f.isNum && "num font-medium",
                    )}
                  >
                    {f.text}
                    {f.unit ? (
                      <span className="ml-1 text-[11px] font-normal text-ink-3">
                        {f.unit}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ),
            )}
          </dl>
        ) : null}

        {/* ---- 3. Бөглөөгүй талбарууд ---- */}
        {empty.length ? (
          <details className="group border-t border-line px-3 py-2">
            <summary className="eyebrow flex cursor-pointer list-none items-center gap-1 text-ink-3 select-none hover:text-ink-2 [&::-webkit-details-marker]:hidden">
              <ChevronDown
                size={11}
                aria-hidden
                className="-rotate-90 transition-transform group-open:rotate-0"
              />
              Бөглөөгүй талбар ·{" "}
              <span className="num">{num(empty.length)}</span>
            </summary>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {empty.map((f) => (
                <span
                  key={f.name}
                  className="rounded-xs border border-dashed border-line-2 px-1.5 py-0.5 text-[10.5px] text-ink-3"
                >
                  {f.alias}
                </span>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </MapPanel>
  );
}

/**
 * Цонхны нэг хэмжилт — он тус бүр нэг зурвас ({@link LayerSet.recordCharts}).
 *
 * ⚠ Хуваарь нь ЗӨВХӨН энэ бүлгийн дотор (гурван оны хамгийн их утга):
 * га, м³, төгрөг нь өөр нэгжтэй тул хооронд нь нэг хуваарьт оруулахгүй.
 * ⚠ Хоосон он "—", зурвасгүй — "0" гэвэл тэр онд бэлтгэл хийгээгүй мэт
 * худал уншигдана.
 */
function RecordBars({
  group,
  row,
  tone,
}: {
  group: NonNullable<LayerSet["recordCharts"]>[string][number];
  row: Record<string, unknown>;
  tone: string;
}) {
  const read = (field: string) => {
    const v = row[field];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const years = group.years.map((y) => ({ ...y, value: read(y.field) }));
  const total = group.total ? read(group.total) : null;
  const max = Math.max(1e-9, ...years.map((y) => y.value ?? 0));
  const text = (v: number) => num(v, Math.abs(v) >= 100 ? 0 : 1);

  return (
    <div className="px-2.5 py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] leading-tight text-ink-2">
          {group.label}
        </span>
        {total != null ? (
          <span className="num shrink-0 text-[10.5px] text-ink-3">
            нийт <b className="font-semibold text-ink">{text(total)}</b>
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        {years.map((y) => (
          <div key={y.field} className="flex items-center gap-2">
            <span className="num w-8 shrink-0 text-[10px] text-ink-3">
              {y.label}
            </span>
            <span className="h-[6px] min-w-0 flex-1 rounded-[2px] bg-paper-hi">
              {y.value != null ? (
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    width: `${Math.max((y.value / max) * 100, y.value > 0 ? 1 : 0)}%`,
                    background: tone,
                  }}
                />
              ) : null}
            </span>
            <span
              className={cn(
                "num w-12 shrink-0 text-right text-[11px]",
                y.value == null ? "text-ink-3" : "text-ink",
              )}
            >
              {y.value == null ? "—" : text(y.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ЦОНХОН ДАХЬ УТГА.
 *
 * ⚠⚠ ЗӨВХӨН НЭГЖТЭЙ талбарыг форматлана (`unitOf`). Зураг дээрх шошго
 * "1,392 га" гэж бичдэг атлаа цонх нь "1391.59" гэж ТҮҮХИЙГЭЭР
 * харуулдаг байв — нэг дүрсийн талбай ХОЁР өөр тоогоор гарч, аль нь
 * зөв нь мэдэгдэхгүй болно (хэрэглэгч 2026-09-29-нд зургаар заасан).
 *
 * ⚠ НЭГЖГҮЙ тоог ХӨНДӨХГҮЙ: "Он" нь 2024 бөгөөд мянгатын таслал
 * тавибал "2,024" болж он биш тоо мэт уншигдана; дугаар ч мөн адил.
 * Нэгж нь эх сурвалж өөрөө нэрэндээ, таслалын ард бичдэг зүйл тул
 * "энэ бол хэмжилт" гэдгийн цорын ганц найдвартай шинж.
 *
 * ⚠ Аравтын орон нь ХЭМЖЭЭНЭЭС хамаарна: 100-аас дээш утгыг бүхэлд
 * нь (зургийн шошготой яг таарна), доош нь хоёр орноор — химийн
 * бодисын 0.27 тонныг бүхэлчилбэл "0" болж утгаа алдана.
 */
function fieldText(
  f: { alias: string; type: string },
  v: unknown,
): { text: string; unit: string; isNum: boolean } {
  /*
    ⚠⚠ ОГНОО ТҮҮХИЙ ТООГООР ГАРДАГ БАЙВ (2026-10-22): `Date` талбарыг
    ArcGIS миллисекундээр буцаадаг тул цонхонд "1694563200000" гэж
    бичигддэг байлаа. Одоо `2023.09.13` (UTC — диаграмын он, сартай
    нэг). Тэг, 1900-аас өмнөх утга нь бөглөөгүйн тэмдэг — хоосон
    буцааж, бөглөөгүй талбарт оруулна.
  */
  if (f.type === "Date") {
    const ms = typeof v === "number" ? v : Date.parse(String(v));
    const d = Number.isFinite(ms) && ms !== 0 ? new Date(ms) : null;
    if (!d || d.getUTCFullYear() < 1900)
      return { text: "", unit: "", isNum: false };
    const p = (n: number) => String(n).padStart(2, "0");
    return {
      text: `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`,
      unit: "",
      isNum: true,
    };
  }
  if (typeof v !== "number" || !Number.isFinite(v))
    return { text: String(v), unit: "", isNum: false };
  /* Нэгж нь утгын ард шилжинэ ("Талбай" · "1,392 га") — шошго богиносно */
  const { unit } = unitOf(f.alias);
  if (!unit) return { text: String(v), unit: "", isNum: true };
  return { text: num(v, Math.abs(v) >= 100 ? 0 : 2), unit, isNum: true };
}

/** Геометрийн төрлийн монгол нэр */
const GEOMETRY_LABEL: Record<string, string> = {
  Polygon: "талбай",
  Polyline: "шугам",
  Point: "цэг",
};

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
        "data-surface flex flex-col rounded-xl border border-line bg-paper-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Хэсгийн толгой.
 *
 * Өнгөт зураас нь `ChartCard`-д — диаграмын карт зурвас дотор өөрийн
 * толгойтой бөгөөд тэнд өнгө нь давхаргыг зурагтай холбоно.
 */
function Head({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
      <h2 className="display min-w-0 truncate text-[13px] leading-snug">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  /** Тооны ард бүдэг нэмэлт утга ("120,345 га") */
  sub?: string;
  icon: typeof Layers3;
}) {
  return (
    <div className="analytics-stat">
      <span className="analytics-stat-icon">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <span className="analytics-stat-label">{label}</span>
        <span className="analytics-stat-value">
          {value}
          {sub ? <span className="analytics-stat-sub">{sub}</span> : null}
        </span>
      </div>
    </div>
  );
}
