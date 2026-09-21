"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  CalendarRange,
  ChartNoAxesCombined,
  Layers3,
  Loader2,
  Palette,
  Ruler,
  Shapes,
  Tag,
} from "lucide-react";
import {
  BarChart,
  GroupedBarChart,
  PieChart,
  RowChart,
} from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { MapPanel, useMapPanel } from "@/components/map/panel";
import { Columns } from "@/components/ui/resizable-columns";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import {
  defaultBasemap,
  zoomForScale,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import {
  breakdowns,
  categoryKey,
  labelParts,
  fetchLayerFeatures,
  fetchLayerInfo,
  type Breakdown,
  type ChartKind,
  type LayerLabels,
  type LayerFeatures,
  type LayerSet,
  type Row,
  type LayerInfo,
} from "@/lib/portal-layers";
import { cn, num } from "@/lib/utils";
import { TopicBreakdown, TopicMapLegend, TOPIC_NOTES, recordUnit, topicChartTitle } from "@/components/unelgee/layer-presentation";

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
 * OKLCH → hex.
 *
 * MapLibre `oklch()` уншдаггүй бөгөөд өнгийг ажиллах үед (ангиллын тоо
 * мэдэгдсэний дараа) үүсгэх шаардлагатай тул хөрвүүлэлтийг энд хийнэ.
 * Хэрэв муж халисан бол 0…1-д хавчина — OKLCH нь sRGB-ээс өргөн.
 */
function oklchHex(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return `#${lin
    .map((v) => {
      const g =
        v <= 0.0031308
          ? 12.92 * v
          : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, g)) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

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
function toneOfHue(hue: number): string {
  return oklchHex(0.74, 0.15, hue);
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
 * Дүрсний шошго — нэр ба хэмжээ хоёр мөрөнд.
 *
 * Хоосон утгыг ОГТ бичихгүй: зураг дээрх "—" нь мэдээлэл өгөхгүй,
 * зөвхөн дүрсээ дарна.
 */
function labelFor(hit: Loaded, oid: number): string {
  const row = hit.data.rows[oid];
  if (!row) return "";

  const lines: string[] = [];

  if (hit.labels.name) {
    const v = categoryKey(row[hit.labels.name]);
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
export function PortalLayersDashboard({ set, presentation }: { set: LayerSet; presentation?: "environment" }) {
  const environment = presentation === "environment";
  const [showCharts, setShowCharts] = React.useState(true);
  /** Давхарга бүрийн тодорхойлолт — эхэнд бүгдийг НЭГ удаа уншина */
  const [infos, setInfos] = React.useState<Record<string, LayerInfo>>({});
  const [failed, setFailed] = React.useState<Record<string, string>>({});
  const [ready, setReady] = React.useState(false);

  /* Асаалттай давхаргууд. Эхлэх төлөвийг бүртгэл шийднэ
     ({@link LayerSet.openAll}, {@link LayerSet.open}) — давхаргын тоо БИШ */
  const [on, setOn] = React.useState<string[]>(() =>
    set.openAll
      ? [...set.layers]
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
  const picker = !set.openAll;
  /** Татагдсан бичлэгүүд — унтраасан ч санах ойд үлдэнэ */
  const [loaded, setLoaded] = React.useState<Record<string, Loaded>>({});
  /* Явж буй хүсэлтүүд — ref, учир нь зурагдалтад нөлөөлдөггүй. Төлөвд
     барьвал effect-ийн биед `setState` дуудагдаж шаталсан зурагдалт
     үүснэ; ачаалж буй эсэх нь дам гарах утга (доорх `loading`) */
  const inFlight = React.useRef<Set<string>>(new Set());

  /*
    Давхарга бүрийг ЯМАР ТАЛБАРААР өнгөт болгох вэ.

    Утга нь хэрэглэгчийн ИЛ сонголт: талбарын нэр бол тэр талбараар,
    `null` бол давхаргын ганц өнгөөр. Бүртгэгдээгүй давхарга нь
    анхдагчаа дагана (доорх `colorField`) — анхдагчийг төлөвт
    хуулбарлавал дата ирэх бүрд effect-ээс `setState` дуудагдана.
  */
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

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
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

  /* Асаалттай боловч татагдаагүй давхаргыг татна */
  React.useEffect(() => {
    const want = on.filter(
      (id) => infos[id] && !loaded[id] && !inFlight.current.has(id),
    );
    if (!want.length) return;

    const ac = new AbortController();
    let alive = true;
    /* Цэвэрлэгээнд хэрэглэх тул олонлогоо ХУВЬСАГЧИД авна — `ref.current`
       нь цэвэрлэгээ ажиллах үед өөр обьект болсон байж болно */
    const flight = inFlight.current;
    for (const id of want) flight.add(id);

    for (const id of want) {
      const info = infos[id];
      /* Атрибут ирмэгц (геометрээс өмнө) диаграм, жагсаалтыг зурна;
         геометр ирэхэд ижил бичлэг зураг дээр нэмэгдэнэ */
      const place = (data: LayerFeatures) => {
        if (!alive) return;
        setLoaded((m) => {
          /* Хэсэгчилсэн (атрибут) ба бүтэн (геометртэй) хувилбар НЭГ
             мөрийн обьектыг хуваалцдаг тул задаргааг дахин тооцохгүй —
             худаг дээр тэр нь секундээр хэмжигддэг ажил */
          const prev = m[id];
          const same = prev && prev.data.rows === data.rows;
          return {
            ...m,
            [id]: {
              info,
              data,
              charts: same ? prev.charts : breakdowns(info, data),
              labels: same ? prev.labels : labelParts(info, data),
            },
          };
        });
      };
      fetchLayerFeatures(info, ac.signal, place)
        .then(place)
        .catch((e: Error) => {
          if (!alive || e.name === "AbortError") return;
          setFailed((f) => ({ ...f, [id]: e.message }));
          setOn((s) => s.filter((x) => x !== id));
        })
        .finally(() => {
          flight.delete(id);
        });
    }

    return () => {
      alive = false;
      ac.abort();
      for (const id of want) flight.delete(id);
    };
  }, [on, infos, loaded]);

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
  const views = React.useMemo(() => {
    const out: {
      id: string;
      hit: Loaded;
      rows: Row[];
      oids: Set<number>;
      charts: Breakdown[];
    }[] = [];

    for (const id of on) {
      const hit = loaded[id];
      if (!hit) continue;

      const sel = filters[id] ?? {};
      const fields = Object.keys(sel);

      /* Талбар бүрийн "мөр → ангилал" дүрэм. Нэг талбар хэд хэдэн
         диаграмд ордог тул эхнийхийг нь авна — бүгд ижил */
      const keyBy = new Map<string, (row: Row) => string[]>();
      for (const b of hit.charts)
        if (!keyBy.has(b.field)) keyBy.set(b.field, b.keyOf);

      const passes = (row: Row, skip?: string) =>
        fields.every((f) => {
          if (f === skip) return true;
          const keys = keyBy.get(f)?.(row);
          /* Дүрэм нь олдохгүй бол шүүхгүй — талбар нь диаграмаас
             алга болсон байж болно (давхарга дахин татагдсан) */
          return keys ? sel[f].some((v) => keys.includes(v)) : true;
        });

      const rows: Row[] = [];
      const oids = new Set<number>();
      for (const [oid, row] of Object.entries(hit.data.rows)) {
        if (!passes(row)) continue;
        rows.push(row);
        oids.add(Number(oid));
      }

      let charts = hit.charts;
      if (fields.length) {
        /* Талбар бүрийн зүсэлтийг НЭГ удаа бодно — ижил талбартай
           диаграмууд түүнийг хуваалцана */
        const cache = new Map<string, Row[]>();
        const without = (field: string) => {
          const hit2 = cache.get(field);
          if (hit2) return hit2;
          const list = fields.includes(field)
            ? Object.values(hit.data.rows).filter((r) => passes(r, field))
            : rows;
          cache.set(field, list);
          return list;
        };
        charts = hit.charts.map((b) => ({
          ...b,
          ...b.recount(without(b.field)),
        }));
      }

      out.push({ id, hit, rows, oids, charts });
    }

    return out;
  }, [on, loaded, filters]);

  /* Сонгосон УТГА бүрийг тоолно, талбарыг биш: "3 идэвхтэй" гэдэг нь
     гурван утга сонгосныг хэлэх ёстой */
  const activeCount = React.useMemo(
    () =>
      views.reduce(
        (n, v) =>
          n +
          Object.values(filters[v.id] ?? {}).reduce(
            (k, vs) => k + vs.length,
            0,
          ) +
          (series[v.id]?.length ?? 0),
        0,
      ),
    [views, filters, series],
  );

  /**
   * Нэг утгыг НЭМЭХ, эсвэл ХАСАХ.
   *
   * `key` нь `null` бол тухайн талбарын шүүлт бүхэлдээ цуцлагдана
   * (товчны "x"). Эс тэгвээс жагсаалтад байвал хасна, байхгүй бол
   * нэмнэ — диаграм ба цэс хоёулаа энэ нэг үйлдлийг дуудна.
   */
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

  const toneOf = React.useCallback(
    (id: string) =>
      toneOfHue(set.hues[set.layers.indexOf(id) % set.hues.length]),
    [set],
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
  const colorField = React.useCallback(
    (id: string): string | null => {
      if (id in colorBy) return colorBy[id];
      if (environment) return null;
      /* Олон утгатай задаргаа өнгө жолоодохгүй: нэг дүрс хоёр
         ангилалд харьяалагдвал аль өнгийг нь өгөх вэ гэдэг хариултгүй */
      const first = loaded[id]?.charts.find(
        (c) => c.kind === "count" && !c.multi,
      );
      return first && first.values.length <= MAX_COLOR_VALUES
        ? first.field
        : null;
    },
    [colorBy, loaded, environment],
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
    const out: Record<string, Map<string, string>> = {};
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
      const ramp = categoryRamp(hueOf(id), b.values.length);
      out[id] = new Map(b.values.map((v, i) => [v.key, ramp[i]]));
    }
    return out;
  }, [on, loaded, colorField, hueOf]);

  /*
    Асаалттай давхаргуудыг НЭГ цуглуулгад нийлүүлнэ.

    Геометрийн төрлөөр хуваана: олон өнцөгт ба шугам нь `shapes`-д,
    цэг нь `points`-д — газрын зургийн дүүргэлтийн давхарга зөвхөн олон
    өнцөгт зурдаг, цэгийн давхарга нь тусдаа эх сурвалжтай.
  */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const { id, hit, oids } of views) {
      if (hit.info.geometry === "Point") continue;
      const base = uidBase(id);
      const flat = toneOf(id);
      const field = colorField(id);
      const palette = palettes[id];
      for (const f of hit.data.shapes.features) {
        /* Шүүлтээс гарсан дүрс ЗУРАГДАХГҮЙ — диаграм ба зураг нэг
           зүйлийг харуулах ёстой */
        if (!oids.has(Number(f.id))) continue;
        const uid = base + Number(f.id);
        /* Ангиллын өнгө олдохгүй бол давхаргынхаа өнгөнд буцна —
           зурагдахгүй үлдэх нь бичлэг байхгүй мэт худал хэлнэ */
        const c =
          field && palette
            ? (palette.get(categoryKey(hit.data.rows[Number(f.id)]?.[field])) ??
              flat)
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
    return { type: "FeatureCollection", features };
  }, [views, toneOf, uidBase, colorField, palettes]);

  const points = React.useMemo<{ at: MapPoints; text: string[] }>(() => {
    const oid: number[] = [];
    const lon: number[] = [];
    const lat: number[] = [];
    const text: string[] = [];
    for (const { id, hit, oids } of views) {
      if (hit.info.geometry !== "Point") continue;
      const base = uidBase(id);
      for (const f of hit.data.shapes.features) {
        if (f.geometry?.type !== "Point") continue;
        if (!oids.has(Number(f.id))) continue;
        const [x, y] = f.geometry.coordinates as [number, number];
        oid.push(base + Number(f.id));
        lon.push(x);
        lat.push(y);
        text.push(labelFor(hit, Number(f.id)));
      }
    }
    return { at: { oid, lon, lat }, text };
  }, [views, uidBase]);

  const visible = React.useMemo(
    () => Uint32Array.from(points.at.oid, (_, i) => i),
    [points],
  );

  /* Асаалттай давхарга бүрийн хамрах хүрээ рүү ойртоно */
  const focus = React.useMemo<Extent | null>(() => {
    if (!on.length) return null;
    const b = new Bounds();
    for (const id of on) {
      const hit = loaded[id];
      if (!hit) continue;
      for (const f of hit.data.shapes.features) b.addGeometry(f.geometry);
    }
    return b.get(0.004);
  }, [on, loaded]);

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

  const stats = React.useMemo(() => {
    let records = 0;
    let m2 = 0;
    for (const { hit, rows, oids } of views) {
      records += rows.length;
      /* Шүүлттэй үед талбайг ҮЛДСЭН дүрсээс тооцно — бүхэл давхаргын
         нийлбэрийг үлдээвэл индикатор нь диаграмтайгаа зөрнө */
      for (const oid of oids) m2 += hit.data.area[oid] ?? 0;
    }
    return { layers: views.length, records, ha: m2 / 10000 };
  }, [views]);

  /*
    Доод зурваст орох диаграмууд — давхарга бүрийн хугацааны цуваа.

    Хавтгай жагсаалт болгож бэлдэнэ: зурвас нь давхарга бүрд БИЕ
    ДААСАН бүлэг биш, нэг эгнээ. Давхаргын нэрийг зөвхөн тухайн
    давхаргын ЭХНИЙ карт үүрнэ (`first`).
  */
  function toggle(id: string) {
    setOn((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
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

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2.5", environment && "ue-layer-dashboard")}>
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
        leading={<button type="button" aria-pressed={showCharts} onClick={() => setShowCharts((value) => !value)} className={cn("map-view-toggle", showCharts && "selected")}><ChartNoAxesCombined size={15} /> Шинжилгээ</button>}
        activeCount={activeCount}
        onReset={() => {
          setFilters({});
          setSeries({});
        }}
      >
        {views.length === 0 ? (
          <span className="text-[11.5px] text-ink-3">Давхарга сонгоогүй</span>
        ) : null}

        {views.map(({ id, hit }) => {
          const sel = filters[id] ?? {};
          /* Сонгох боломжтой утгууд нь ШҮҮГДЭЭГҮЙ жагсаалтаас: шүүсний
             дараа цэс нь өөрийгөө хумивал сонголтоо солих арга үлдэхгүй */
          const cuts = menusOf(hit.charts);
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
                const chosen = sel[b.field] ?? [];
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
                    onClear={() => pick(id, b.field, null)}
                  >
                    <PickList
                      items={b.values}
                      selected={chosen}
                      onPick={(key) => pick(id, b.field, key)}
                      searchable={b.values.length > 8}
                    />
                  </FilterMenu>
                );
              })}
            </React.Fragment>
          );
        })}
      </FilterBar>

      {environment ? <p className="ue-topic-note">{TOPIC_NOTES[set.key]}</p> : null}

      <div className="analytics-overview" aria-label="Өгөгдлийн тойм">
        <Stat icon={Layers3} label="Идэвхтэй давхарга" value={num(stats.layers)} />
        <Stat icon={Shapes} label={environment ? "Сонгосон давхаргын бүртгэл" : "Шүүлтэд тохирох бичлэг"} value={environment && on.some((id) => !loaded[id] && !failed[id]) ? "…" : num(stats.records)} />
        <Stat icon={Ruler} label={environment ? "Дүрсүүдийн талбайн нийлбэр, га" : "Талбай, га"} value={stats.ha > 0 ? (environment ? new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 2 }).format(stats.ha) : num(Math.round(stats.ha))) : "—"} />
      </div>
      {environment && on.length > 1 ? <p className="ue-chart-note">Давхаргуудын бүртгэл болон талбай давхцаж болно. Нийлбэр нь давхардлыг хассан нийт хэмжээ биш.</p> : null}

      <Columns
        id={`layers-${set.key}`}
        left={picker ? (environment ? 228 : 286) : undefined}
        /* Бүлэглэсэн багана энд сууна — 300px дээр гурван оны
         харьцуулалт зураас болно. Хэрэглэгч чирж өөрчилнө */
        right={showCharts ? (environment ? 370 : 350) : undefined}
        className="min-h-0 flex-1"
      >
        {/* ---- ЗҮҮН: давхаргын жагсаалт (зөвхөн сонголттой үед) ---- */}
        {picker ? (
          <div className="flex min-h-0 flex-col gap-2.5">
            <Card className="min-h-[140px] flex-1">
              <Head title="Давхарга">
                <span className="num text-[11.5px] text-ink-3">
                  {num(on.length)} / {num(set.layers.length)}
                </span>
              </Head>
              <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                {set.layers.map((id) => {
                  const info = infos[id];
                  const error = failed[id];
                  const isOn = on.includes(id);
                  /* Асаалттай атлаа татагдаагүй, алдаагүй бол явагдаж байна */
                  const loading = isOn && !loaded[id] && !error;

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
                            environment ? "block text-[12px] leading-relaxed" : "block truncate text-[12px] leading-tight",
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
                              ? `${num(info.count)} бичлэг · ${GEOMETRY_LABEL[info.geometry] ?? info.geometry}`
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

        {/* ---- БАРУУН: зураг, доор нь диаграмын зурвас ---- */}
        <div className="flex min-h-0 flex-col gap-2.5">
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
                points={points.at.oid.length ? points.at : NO_POINTS}
                visible={points.at.oid.length ? visible : NO_INDEX}
                shapes={{
                  data: shapes,
                  selected: picked,
                  /* Хязгаар нь амьд тул унтраахад хүрэшгүй ойртолт
                     өгөхөд л хангалттай */
                  labelZoom: showLabels ? LABEL_ZOOM : OFF_ZOOM,
                }}
                /* Объект үүсэх МӨЧИД уншигддаг тул цэг байхгүй үед ч
                 ЗААВАЛ өгнө — эс тэгвээс шошгын давхарга огт үүсэхгүй
                 бөгөөд дараа нь асаах боломжгүй */
                labels={{
                  text: points.text,
                  minzoom: showLabels ? LABEL_ZOOM : OFF_ZOOM,
                }}
                basemap={basemap}
                onSelect={(uid) => setPicked(picked === uid ? null : uid)}
                onHover={tip.onHover}
                focus={focus}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />
              {environment ? <TopicMapLegend groups={views.map(({ id, hit, rows }) => {
                const field = colorField(id);
                const breakdown = hit.charts.find((b) => b.field === field && b.kind === "count");
                const counts = new Map<string, number>();
                if (breakdown) for (const row of rows) for (const key of breakdown.keyOf(row)) counts.set(key, (counts.get(key) ?? 0) + 1);
                return {
                  id, name: hit.info.name, geometry: hit.info.geometry, field: breakdown?.label,
                  items: breakdown ? breakdown.values.map((d) => ({ key: d.key, label: d.label, color: palettes[id]?.get(d.key) ?? toneOf(id), count: counts.get(d.key) ?? 0 })) : [{ key: id, label: GEOMETRY_LABEL[hit.info.geometry] ?? "Бүртгэл", color: toneOf(id), count: rows.length }],
                };
              })} /> : null}

              {/* Шошгын унтраалга — суурь зургийн товчны хажууд */}
              <button
                onClick={() => setShowLabels((v) => !v)}
                title={
                  showLabels
                    ? "Шошгыг унтраах"
                    : `Шошгыг асаах (1:${num(LABEL_SCALE)}-аас ойртоход)`
                }
                className={cn(
                  "elevated absolute top-2 right-11 z-10 rounded-xs border p-1.5 backdrop-blur-md transition-colors",
                  showLabels
                    ? "border-data/50 bg-data/15 text-ink"
                    : "border-line bg-paper/85 text-ink-3 hover:text-ink",
                )}
              >
                <Tag size={13} strokeWidth={1.75} />
              </button>

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
              {active ? (
                <RecordPanel
                  info={active.info}
                  row={active.row}
                  onClose={() => setPicked(null)}
                />
              ) : null}

              {/*
              ⚠ "Зүүн талын жагсаалтаас давхарга сонгоно уу" гэсэн заавар
              ХАСАГДСАН (хэрэглэгчийн шийдвэр, 2026-09-17, үнэлгээний
              хэлтэс дээр: "ийм бичиг гарахгүй шүү"). Давхарга сонгоогүй
              үед суурь зураг л харагдана — зүүн талын жагсаалт өөрөө
              хангалттай тайлбар. Зөвхөн БҮХ давхарга нээлттэй байх ёстой
              (`openAll`) цонхонд юу ч уншигдаагүй бол алдааг ил хэлнэ:
              тэнд хоосон зураг нь техникийн гэмтэл.
            */}
              {on.length === 0 && !picker ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <p className="elevated max-w-[300px] rounded-xs border border-line bg-paper/92 px-4 py-3 text-center text-[12.5px] leading-relaxed text-ink-2 backdrop-blur-md">
                    Давхарга уншигдсангүй.
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS Enterprise · хүрээг ~10 метрээр
            ерөнхийлсөн
          </p>
        </div>

        {/* ---- БАРУУН: ангиллын задаргаа ---- */}
        {showCharts && <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto">
          {(views.length === 0 || (environment && views.every((view) => !view.charts.length))) ? (
            <Card className="min-h-[120px] flex-1">
              <Head title="Задаргаа" />
              <div className="hatch flex flex-1 items-center justify-center px-4">
                <p className="text-center text-[12px] leading-relaxed text-ink-3">
                  {environment && on.some((id) => !loaded[id] && !failed[id])
                    ? "Сонгосон давхаргын мэдээллийг ачаалж байна…"
                    : environment && views.length
                    ? "Ангиллаар харьцуулах мэдээлэл байхгүй. Газрын зураг дээрх бүртгэлээс дэлгэрэнгүйг үзнэ үү."
                    : picker
                    ? "Давхарга асаахад задаргаа нь энд гарна."
                    : "Задаргаа гарахуйц талбар олдсонгүй."}
                </p>
              </div>
            </Card>
          ) : null}

          {views.map(({ id, hit, charts, rows }) => {
            const tone = toneOf(id);
            /* Задаргаа БҮГД энд: цуваа, харьцуулалт хоёрыг зургийн
               доод зурваст тавьж байсныг хэрэглэгч буцаав (2026-09-15)
               — гурван нэгжийн харьцуулалт тэнд хажуу тийшээ гүйж,
               бүгдийг нь зэрэг харах боломжгүй байв. Нэг баганад
               босоо цуварсан нь бүгдийг нь нэг чиглэлд гүйлгэж
               үзэхэд хялбар. */
            const cuts = charts;
            const sel = filters[id] ?? {};

            /*
              Давхаргын ТУУЗ — картуудынхаа дээр.

              Урьд нь давхаргын нэрийг эхний картын толгойд бичдэг
              байсан тул үлдсэн картууд нь зүүн талаасаа хоосон,
              гарчиг нь баруун тийш дүүжлэгдсэн харагддаг байв. Тууз
              нь бүлгийг нэг дор зарлаж, карт бүрийн толгой өөрийн
              диаграмын нэрээр л эхэлнэ.
            */
            const band = (
              <div
                key={`${id}:band`}
                className="flex shrink-0 items-center gap-2 pt-1 pb-0.5"
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
            if (!cuts.length) return null;

            const cards = cuts.map((b, i) => {
              /* Өнгийг зөвхөн ТООЛЛЫН диаграм жолоодно — нэг талбарын бүх
               диаграм ижил өнгө хуваалцдаг тул товчийг хаа сайгүй
               давтвал аль нь юуг сольж байгаа нь ойлгомжгүй болно */
              const driver = b.kind === "count" && !b.multi;
              const lit = colorField(id) === b.field;
              const palette = lit ? palettes[id] : undefined;
              /* Энэ талбарын сонгогдсон утга. Нэрийг `on` гэж БҮҮ бич —
                 тэр нь энэ файлд "асаалттай давхаргууд" гэсэн утгатай */
              const chosen = sel[b.field] ?? null;
              const onPick = (key: string | null) => pick(id, b.field, key);

              return (
                <CutCard
                  key={`${id}:${b.id}`}
                  title={environment ? topicChartTitle(b, id) : chartTitle(b)}
                  tone={tone}
                  first={i === 0}
                  action={
                    driver ? (
                      <button
                        type="button"
                        aria-pressed={lit}
                        disabled={environment && b.values.length > MAX_COLOR_VALUES}
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
                        {environment ? <span className="ue-color-action"><Palette size={12} />{lit ? "Өнгө асаалттай" : "Зурагт өнгөөр ялгах"}</span> : <Palette size={11} strokeWidth={1.8} />}
                      </button>
                    ) : null
                  }
                >
                  {environment && !isTime(b) && b.kind !== "compare" ? (
                    <TopicBreakdown breakdown={b} tone={tone} palette={palette} selected={chosen} onSelect={onPick} unit={recordUnit(id)} />
                  ) : b.kind === "compare" && b.groups ? (
                    /*
                      ХЭВТЭЭ багана: ангилал нь дүүрэг, аж ахуйн нэгж
                      зэрэг УРТ нэртэй бөгөөд олон байдаг тул босоо
                      баганад нэр нь ч, утга нь ч таслагдаж байв.
                      Хэвтээ мөрөнд нэр нь дээрээ бүтнээрээ, утга нь
                      мөрийнхөө төгсгөлд суух тул нарийн багананд ч
                      шахагдахгүй.
                    */
                    <GroupedBarChart
                      {...shownSeries(b, series[id], hueOf(id))}
                      layout="horizontal"
                      unit={b.measure}
                      format={measureText}
                      selected={chosen}
                      onSelect={onPick}
                    />
                  ) : isTime(b) ? (
                    <BarChart
                      data={b.values}
                      height={92}
                      tone={translucent(tone)}
                      unit="бичлэг"
                      selected={chosen}
                      onSelect={onPick}
                      labels
                      formatTick={(d, k) =>
                        tickOf(b.kind, d, k, b.values.length)
                      }
                    />
                  ) : isPie(b) ? (
                    <PieChart
                      data={b.values}
                      tone={tone}
                      selected={chosen}
                      onSelect={onPick}
                      format={b.kind === "sum" ? measureText : undefined}
                      colorOf={
                        palette ? (d) => palette.get(d.key) ?? tone : undefined
                      }
                    />
                  ) : (
                    <RowChart
                      data={b.values}
                      tone={tone}
                      selected={chosen}
                      onSelect={onPick}
                      format={b.kind === "count" ? undefined : measureText}
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
                      */
                      dense
                    />
                  )}
                </CutCard>
              );
            });

            return (
              <React.Fragment key={id}>
                {band}
                {cards}
              </React.Fragment>
            );
          })}
        </div>}
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

/**
 * Багана диаграмын ТУНГАЛАГ дүүргэлт.
 *
 * Цуваа нь бүтэн өргөнтэй багануудаас тогтдог тул бүтэн дүүргэлттэй
 * бол карт нь өнгөний блок болж, дэлгэцийн бусад хэсгээс хамаагүй
 * хүчтэй жин авна. Тунгалаг дүүргэлт нь суурийн давхаргыг нэвт
 * харуулж, зурвасыг зургийн доор сууж буй хэмжигч мэт үлдээнэ —
 * бөгжин диаграмын дүүргэлттэй нэг зарчим.
 *
 * Найман оронтой hex (`#RRGGBBAA`) — `oklchHex` нь үргэлж зургаан
 * оронтой утга буцаадаг тул залгахад аюулгүй.
 */
function translucent(hex: string): string {
  return `${hex}9c`;
}

/** Хугацааны цуваа мөн үү */
function isTime(b: Breakdown): boolean {
  return b.kind === "year" || b.kind === "month";
}

/**
 * Сонгосон ОНУУДЫГ л үлдээнэ.
 *
 * ⚠ Өнгө нь БҮТЭН жагсаалтаас гарах ёстой: хоёр оныг нуусны дараа
 * гурав дахь нь өнгөө сольвол "2025 он" гэдэг нь өмнөхөөсөө өөр өнгө
 * болж, хэрэглэгч өөр зүйл харж байгаа мэт эндүүрнэ.
 */
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
    /* Тоолол нь өөрийн нэргүй хэмжигдэхүүн — "юуны тоо" гэдгийг
       заавал хэлнэ, эс тэгвээс талбайн диаграмаас ялгарахгүй */
    case "count":
      return `${b.label} — бичлэгийн тоо`;
    case "sum":
      return `${b.measure ?? ""} — ${b.label}${cut}`;
    /* Дундаж нь нийлбэрээс ЭРС өөр утга — гарчигт нь ил хэлэхгүй бол
       хоёр диаграм ижил харагдана */
    case "mean":
      return `${b.measure ?? ""} — ${b.label}, дундаж${cut}`;
    case "compare":
      return `Харьцуулалт, ${b.measure ?? ""} — ${b.label}${cut}`;
    /*
      Хугацааны талбар ихэвчлэн ӨӨРӨӨ нэрэндээ хэлчихсэн байдаг ("Он",
      "Сар") тул араас нь дахин хавсаргавал "Сар, сараар" гэсэн утгагүй
      давталт үүсэнэ. Нэрэнд нь байвал зөвхөн хуваарилалтыг л нэрлэнэ.
    */
    case "year":
      return /он|жил|year/i.test(b.label)
        ? `${b.label} — жилийн хуваарилалт`
        : `${b.label}, жилээр`;
    case "month":
      return /сар|month/i.test(b.label)
        ? `${b.label} — сарын хуваарилалт`
        : `${b.label}, сараар`;
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

  const y = Number(d.key);
  if (!Number.isFinite(y)) return "";
  if (n <= 8) return String(y);
  if (n <= 16) return i % 2 === 0 ? String(y).slice(2) : "";
  return y % 10 === 0 ? String(y).slice(2) : "";
}

/**
 * Диаграмын карт.
 *
 * Толгойд ГАНЦ мөр: диаграмын өөрийн нэр зүүн талд, үйлдэл баруун
 * талд. Давхаргын нэр энд БИЧИГДЭХГҮЙ — тэр нь картуудын дээрх
 * тууз дээр нэг удаа хэлэгдсэн (`band`). Хоёуланг нь бичвэл 420px
 * толгойд хоёр гарчиг багтахгүй, диаграмын нэр нь таслагдана.
 *
 * Өндөр нь агуулгаараа тодорхойлогдох ч ДЭЭД ХЯЗГААРТАЙ: нэг урт
 * жагсаалт бүхэл баганыг эзэлбэл доорх задаргаанууд нүднээс алга
 * болно.
 */
function CutCard({
  title,
  tone,
  first,
  action,
  children,
}: {
  title: string;
  tone: string;
  /** Давхаргын ЭХНИЙ карт — туузандаа наалдаж, бүлгээ эхлүүлнэ */
  first?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        // Each chart keeps its natural height; long breakdowns scroll inside it.
        "analytics-chart-card flex min-h-0 flex-col rounded-xl border border-line bg-paper-2",
        first && "border-t-2",
      )}
      style={first ? { borderTopColor: tone } : undefined}
    >
      <div className="analytics-chart-head">
        <h2
          className="text-ink"
          title={title}
        >
          {title}
        </h2>
        {action}
      </div>
      <div className="analytics-chart-body">
        {children}
      </div>
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
function RecordPanel({
  info,
  row,
  onClose,
}: {
  info: LayerInfo;
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const panel = useMapPanel("left");

  return (
    <MapPanel
      state={panel}
      title={info.name}
      onClose={onClose}
      className="top-2 right-2 bottom-8 w-[288px]"
    >
      <dl className="divide-y divide-line overflow-y-auto">
        {info.fields.map((f) => {
          const v = row[f.name];
          const text = typeof v === "string" ? v.trim() : v;
          if (text === "" || text == null) return null;
          return (
            <div key={f.name} className="flex gap-2 px-2.5 py-1.5">
              <dt className="w-[92px] shrink-0 text-[10px] tracking-[0.06em] text-ink-3 uppercase">
                {f.alias}
              </dt>
              <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-2">
                {String(text)}
              </dd>
            </div>
          );
        })}
      </dl>
    </MapPanel>
  );
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
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Layers3;
}) {
  return (
    <div className="analytics-stat">
      <span className="analytics-stat-icon"><Icon size={20} strokeWidth={1.5} /></span>
      <div className="min-w-0">
        <span className="analytics-stat-label">{label}</span>
        <span className="analytics-stat-value">{value}</span>
      </div>
    </div>
  );
}
