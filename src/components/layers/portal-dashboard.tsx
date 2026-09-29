"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  CalendarRange,
  ChartNoAxesCombined,
  ChevronDown,
  Layers3,
  Loader2,
  Palette,
  Ruler,
  Shapes,
  Tag,
} from "lucide-react";
import {
  AreaChart,
  GroupedBarChart,
  PieChart,
  RowChart,
  type Datum,
} from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import {
  countParcelsIn,
  fetchParcelsIn,
  NO_PARCELS,
  PARCEL_SCALE,
  ringsOf,
  type ParcelTile,
} from "@/lib/parcels";
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
import { oklchHex } from "@/components/wells/colors";
import { Bounds } from "@/lib/extent";
import {
  breakdowns,
  categoryKey,
  labelParts,
  fetchLayerFeatures,
  fetchLayerInfo,
  unitOf,
  type Breakdown,
  type ChartKind,
  type LayerLabels,
  type LayerFeatures,
  type LayerSet,
  type Row,
  type LayerInfo,
} from "@/lib/portal-layers";
import { cn, num } from "@/lib/utils";
import { Composition, Matrix, type Key } from "@/components/unelgee/viz";
import {
  TopicBreakdown,
  TopicMapLegend,
  TOPIC_NOTES,
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
 * "Дүрс тус бүрийн талбай" диаграмд харагдах дээд мөр.
 *
 * Мөр нь бичлэгийн тоотой тэнцдэг тул хязгааргүй бол мянган мөртэй
 * карт гарна. Хорь нь `nameField`-ийн хураалттай нэг тоо — хураасан
 * гэдгээ гарчигтаа ИЛ хэлнэ.
 */
const AREA_TOP = 20;

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
export function PortalLayersDashboard({
  set,
  presentation,
}: {
  set: LayerSet;
  presentation?: "environment";
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
        ? set.layers.slice(0, 1)
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
  const [parcelsOn, setParcelsOn] = React.useState(false);
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
  const [view, setView] = React.useState<{
    box: [number, number, number, number];
    zoom: number;
  } | null>(null);
  const parcelZoom = React.useMemo(() => zoomForScale(PARCEL_SCALE), []);
  const close = view != null && view.zoom >= parcelZoom;

  React.useEffect(() => {
    if (!parcelsOn || !view || !close) return;
    const ac = new AbortController();
    fetchParcelsIn(view.box, ac.signal)
      .then((t) => {
        if (!ac.signal.aborted) setParcels(t);
      })
      .catch(() => {
        /* Тасарсан, эсвэл сервер татгалзсан — суурь давхарга тул
           самбарыг УНАГААХГҮЙ, зүгээр л хоосон үлдэнэ */
        if (!ac.signal.aborted) setParcels(NO_PARCELS);
      });
    return () => ac.abort();
  }, [parcelsOn, view, close]);

  /* Унтраасан, эсвэл хол байхад ДАМ хоосон — эффектээс `set*`
     дуудах нь `react-hooks/set-state-in-effect`-д хориотой бөгөөд
     нэмэлт зурагдалт үүсгэнэ */
  const shownParcels = parcelsOn && close ? parcels : NO_PARCELS;

  const onView = React.useCallback(
    (box: [number, number, number, number], zoom: number) =>
      setView({ box, zoom }),
    [],
  );

  const overlays = React.useMemo(
    () =>
      shownParcels.data.features.length
        ? [
            {
              id: "parcel",
              data: shownParcels.data,
              /* ⚠ Дүүргэлт МАШ БҮДЭГ: нэгж талбар нь ДАТА биш СУУРЬ —
                 доорх хиймэл дагуул, дээрх дата давхаргыг дарахгүй */
              fill: { color: "#e8eef5", opacity: 0.07 },
              /* ⚠⚠ ЗУРААС 0.7px-ЭЭС 1.2px БОЛОВ. Өнөөдөр олон
                 өнцөгтийн хүрээ дээр яг ийм алдаа гарсан: дэд
                 пикселийн, бүдэг цагаан зураас нь хиймэл дагуулын
                 зураг дээр бүрэн уусдаг ({@link shape-case}). Нэгж
                 талбар нь нягт тор тул зузаан нь ч болохгүй — 1.2px
                 дээр тор нь уншигдаж, доорх зураг нь харагдсаар. */
              line: { color: "#e8eef5", opacity: 0.8, width: 1.2 },
            },
          ]
        : undefined,
    [shownParcels],
  );
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
    setBusy((b) => {
      const next = { ...b };
      for (const id of want) next[id] = true;
      return next;
    });

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
          setBusy((b) => {
            if (!b[id]) return b;
            const next = { ...b };
            delete next[id];
            return next;
          });
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
    if (picker || !showCharts) return null;
    let best: { id: string; chart: string; size: number } | null = null;
    let total = 0;
    for (const v of views) {
      for (const b of v.charts) {
        total += 1;
        if (!best || b.values.length > best.size)
          best = { id: v.id, chart: b.id, size: b.values.length };
      }
      /*
        ⚠⚠ "Дүрс тус бүрийн талбай" карт ӨРСӨЛДӨХГҮЙ (2026-09-29,
        хэрэглэгч: "энэ чартыг шахаад хязгаарлалтын бүс чартын доор
        оруулъя"). 2026-09-25-нд тэр нь `split`-д орж, хориглолтын
        бүсийн арван найман мөр ЗҮҮН баганад гардаг байсан —
        улмаас давхаргынхаа ТУУЗААС, бүлгийнхээ бусад картаас салж,
        аль бүсийнх болох нь зөвхөн гарчгаасаа уншигддаг байв.
        Одоо гурван бүсийн карт баруун баганад ДАВХАРГЫН ДАРААЛЛААР
        цувна (тэжээгдэл → хязгаарлалт → хориглолт).
        ⚠ Гүйлгүүр буцаж гарахгүй: мөр нь `inline`-аар 28 → 23px
        болж (502 → 413px), үлдсэнийг `flex-shrink` ба `--card-min`
        барина — карт багтаагүй бол ӨӨРӨӨ гүйнэ, багана биш.
        ⚠ Задаргааны диаграм (`Breakdown`) `split`-д ХЭВЭЭР
        өрсөлдөнө: тэдгээр нь давхаргын дарааллыг үүрдэггүй.
      */
    }
    if (!best || total < 2 || best.size < 8) return null;
    return best;
  }, [picker, showCharts, views]);

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
    const f = hit?.data.shapes.features.find((x) => Number(x.id) === rowPick);
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
  const areaRowsOf = React.useCallback(
    (hit: Loaded, oids: Set<number>): Datum[] => {
      const out: Datum[] = [];
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
        out.push({
          key: String(oid),
          label: name && name !== "Бүртгэгдээгүй" ? name : `№ ${oid}`,
          value: ha,
        });
      }
      return out.sort((a, b) => b.value - a.value);
    },
    [],
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
    const out = new Map<
      string,
      { row: Breakdown; col: Breakdown; cell: Map<string, number> }
    >();
    if (!set.tidy) return out;
    for (const v of views) {
      const fit = v.charts.filter(
        (b) =>
          b.kind === "count" &&
          !b.multi &&
          b.values.length >= 2 &&
          b.values.length <= 8,
      );
      if (fit.length < 2) continue;
      const [col, row] = fit;
      const cell = new Map<string, number>();
      for (const r of v.rows) {
        for (const rk of row.keyOf(r))
          for (const ck of col.keyOf(r)) {
            const k = `${rk}\u0000${ck}`;
            cell.set(k, (cell.get(k) ?? 0) + 1);
          }
      }
      out.set(v.id, { row, col, cell });
    }
    return out;
  }, [views, set.tidy]);

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
  const [zoneOpen, setZoneOpen] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!set.tidy) return;
    const ac = new AbortController();
    for (const id of on) {
      const hit = loaded[id];
      if (!hit || hit.info.geometry === "Point") continue;
      const rings = ringsOf(hit.data.shapes.features);
      if (!rings.length) continue;
      countParcelsIn(rings, ac.signal)
        .then((n) => {
          if (!ac.signal.aborted) setOverlap((m) => ({ ...m, [id]: n }));
        })
        .catch(() => {
          /* Давхцлын тоо нь НЭМЭЛТ мэдээлэл — самбарыг унагаахгүй */
        });
    }
    return () => ac.abort();
  }, [set.tidy, on, loaded]);

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
    Доод зурваст орох диаграмууд — давхарга бүрийн хугацааны цуваа.

    Хавтгай жагсаалт болгож бэлдэнэ: зурвас нь давхарга бүрд БИЕ
    ДААСАН бүлэг биш, нэг эгнээ. Давхаргын нэрийг зөвхөн тухайн
    давхаргын ЭХНИЙ карт үүрнэ (`first`).
  */
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
  const zones = React.useMemo(() => {
    if (!set.tidy) return [];
    return views
      .filter((v) => v.hit.info.geometry !== "Point")
      .map((v) => {
        const k = v.hit.info.areaInHa ? 1 : 1 / 10000;
        let ha = 0;
        for (const oid of v.oids) ha += (v.hit.data.area[oid] ?? 0) * k;
        return {
          id: v.id,
          label: v.hit.info.name,
          ha,
          parcels: overlap[v.id],
          rows: areaRowsOf(v.hit, v.oids),
        };
      });
  }, [set.tidy, views, overlap, areaRowsOf]);

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

  const zoneCard =
    zones.length > 1 ? (
      <CutCard
        key="zones"
        title={set.title ?? "Давхаргаар"}
        tone={toneOf(zones[0].id)}
        first
        meta={`${num(Math.round(zones.reduce((n, z) => n + z.ha, 0)))} га`}
        weight={Math.max(4, zones.length * 2)}
      >
        <div className="divide-y divide-line">
          {zones.map((z) => {
            const open = zoneOpen === z.id;
            return (
              <div key={z.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setZoneOpen(open ? null : z.id)}
                  className="flex w-full items-center gap-2 px-0.5 py-2 text-left hover:bg-paper-hi"
                >
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-3.5 shrink-0 text-ink-3 transition-transform",
                      !open && "-rotate-90",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                    {z.label}
                  </span>
                  <span className="num shrink-0 text-[12px] text-ink">
                    {num(Math.round(z.ha))} га
                  </span>
                  <span className="num w-[116px] shrink-0 text-right text-[11.5px] whitespace-nowrap text-ink-2">
                    {z.parcels == null ? "…" : `${num(z.parcels)} нэгж талбар`}
                  </span>
                </button>
                {open ? (
                  <div className="pb-2 pl-6">
                    {z.rows.length ? (
                      z.rows.map((r) => (
                        <div
                          key={r.key}
                          className="flex items-center gap-2 py-0.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                            {r.label}
                          </span>
                          <span className="num shrink-0 text-[11.5px] text-ink-3">
                            {num(Math.round(r.value))} га
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="py-1 text-[11.5px] text-ink-3">
                        Дүрсийн хүрээ ирээгүй байна.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CutCard>
    ) : null;

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
    views.map(({ id, hit, charts, rows, oids }) => {
      const tone = toneOf(id);
      /* Задаргаа БҮГД энд: цуваа, харьцуулалт хоёрыг зургийн
         доод зурваст тавьж байсныг хэрэглэгч буцаав (2026-09-15)
         — гурван нэгжийн харьцуулалт тэнд хажуу тийшээ гүйж,
         бүгдийг нь зэрэг харах боломжгүй байв. Нэг баганад
         босоо цуварсан нь бүгдийг нь нэг чиглэлд гүйлгэж
         үзэхэд хялбар. */
      /* Хуваалтын дагуу зөвхөн энэ баганад харьяалагдах диаграм */
      const cuts = charts.filter((b) => keep(id, b));
      const sel = filters[id] ?? {};

      /*
        Давхаргын ТУУЗ — картуудынхаа дээр.

        Урьд нь давхаргын нэрийг эхний картын толгойд бичдэг
        байсан тул үлдсэн картууд нь зүүн талаасаа хоосон,
        гарчиг нь баруун тийш дүүжлэгдсэн харагддаг байв. Тууз
        нь бүлгийг нэг дор зарлаж, карт бүрийн толгой өөрийн
        диаграмын нэрээр л эхэлнэ.
      */
      /*
        ⚠ ТУУЗ нь ДООРХ картдаа наалдана (2026-09-29, "зайг
        цэгцлэе"). Баганын `gap` нь 10px тул `pt-1 pb-0.5` үед
        дээр 14px, доор 12px болж тууз хоёр картын ДУНД хөвж,
        аль бүлгийг зарлаж буй нь эргэлзээтэй байв. Одоо дээр
        18px, доор 4px — хамаарал нь зайнаасаа уншигдана.
      */
      const band = (
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
      const cross = withCross ? crosses.get(id) : undefined;
      const crossCard = cross ? (
        <CutCard
          key={`${id}:cross`}
          title={`${cross.row.label} × ${cross.col.label}`}
          tone={tone}
          first
          meta={`${num(rows.length)} бичлэг`}
          weight={Math.max(4, cross.row.values.length + 2)}
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
            rowSel={(filters[id]?.[cross.row.field] ?? [])[0] ?? null}
            colSel={(filters[id]?.[cross.col.field] ?? [])[0] ?? null}
            onRow={(k) => pick(id, cross.row.field, k)}
            onCol={(k) => pick(id, cross.col.field, k)}
            onCell={(r, c) => {
              pick(id, cross.row.field, r);
              pick(id, cross.col.field, c);
            }}
          />
        </CutCard>
      ) : null;

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
      const areas = withArea(id) && !namedArea ? areaRowsOf(hit, oids) : [];
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
      const soloDup = areas.length === 1 && zones.length > 1;
      const base = uidBase(id);
      const areaCard = areas.length && !soloDup ? (
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
              inline
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
            first={i === 0 && !crossCard}
            weight={cardWeight(b)}
            /* Нийт дүн ба ангиллын тоо — зурвасуудыг нүдээр нэмэх
               шаардлагагүй болно */
            meta={set.tidy && !isTime(b) ? headMeta(b) : undefined}
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
                  {environment ? (
                    <span className="ue-color-action">
                      <Palette size={12} />
                      {lit ? "Өнгө асаалттай" : "Зурагт өнгөөр ялгах"}
                    </span>
                  ) : (
                    <Palette size={11} strokeWidth={1.8} />
                  )}
                </button>
              ) : null
            }
          >
            {environment && !isTime(b) && b.kind !== "compare" ? (
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
              <GroupedBarChart
                {...shownSeries(b, series[id], hueOf(id))}
                layout="horizontal"
                unit={b.measure}
                format={measureText}
                selected={chosen}
                onSelect={onPick}
              />
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
                height={108}
                tone={tone}
                unit="бичлэг"
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
              <RowChart
                data={b.values}
                tone={tone}
                selected={chosen}
                onSelect={onPick}
                note={noteOf(b)}
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
            )}
          </CutCard>
        );
      });

      return (
        <React.Fragment key={id}>
          {band}
          {crossCard}
          {cards}
          {areaCard}
        </React.Fragment>
      );
    });

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
            <button
              type="button"
              aria-pressed={showCharts}
              onClick={() => setShowCharts((value) => !value)}
              className={cn("map-view-toggle", showCharts && "selected")}
            >
              <ChartNoAxesCombined size={15} /> Шинжилгээ
            </button>

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
            {set.exclusive ? (
              <div className="flex items-center gap-1" role="group" aria-label="Давхарга">
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

      {environment ? (
        <p className="ue-topic-note">{TOPIC_NOTES[set.key]}</p>
      ) : null}

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
      {set.overview === false ? null : (
        <div className="analytics-overview" aria-label="Өгөгдлийн тойм">
          {picker ? (
            <Stat
              icon={Layers3}
              label="Идэвхтэй давхарга"
              value={num(stats.layers)}
            />
          ) : null}
          <Stat
            icon={Shapes}
            label={
              environment
                ? "Сонгосон давхаргын бүртгэл"
                : "Шүүлтэд тохирох бичлэг"
            }
            value={
              environment && on.some((id) => !loaded[id] && !failed[id])
                ? "…"
                : num(stats.records)
            }
          />
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
        </div>
      )}
      {environment && on.length > 1 ? (
        <p className="ue-chart-note">
          Давхаргуудын бүртгэл болон талбай давхцаж болно. Нийлбэр нь давхардлыг
          хассан нийт хэмжээ биш.
        </p>
      ) : null}

      <Columns
        id={`layers-${set.key}`}
        left={picker ? (environment ? 228 : 286) : split ? 320 : undefined}
        /* Бүлэглэсэн багана энд сууна — 300px дээр гурван оны
         харьцуулалт зураас болно. Хэрэглэгч чирж өөрчилнө */
        right={showCharts ? (environment ? 370 : 350) : undefined}
        className="min-h-0 flex-1"
      >
        {/* ---- ЗҮҮН: давхаргын жагсаалт, эсвэл хамгийн урт диаграм ---- */}
        {!picker && split ? (
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {chartCards(
              (id, b) => id === split.id && b.id === split.chart,
              /* Талбайн карт зүүн тийш ГАРАХГҮЙ — давхаргынхаа
                 бүлэгт үлдэнэ ({@link split}) */
              () => false,
            )}
          </div>
        ) : null}
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
                onSelect={(uid) => {
                  setPicked(picked === uid ? null : uid);
                  /* Зураг дээрх дүрс аль хэдийн харагдаж байгаа тул
                     ойртуулахгүй — сонголт нь диаграмынх биш болов */
                  setRowPick(null);
                }}
                onHover={tip.onHover}
                focus={parcelFocus ?? rowFocus ?? focus}
                cluster={false}
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
              */}
              <div className="absolute top-12 left-2 z-20 flex flex-col items-start gap-1">
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
                {parcelsOn ? (
                  <span className="num rounded-xs bg-paper/92 px-1.5 py-0.5 text-[10px] text-ink-3 backdrop-blur-md">
                    {!close
                      ? `1:${num(PARCEL_SCALE)}-аас ойртоно уу`
                      : shownParcels.capped
                        ? `${num(shownParcels.data.features.length)}, хэсэгчилсэн`
                        : num(shownParcels.data.features.length)}
                  </span>
                ) : null}
              </div>
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
                            color: palettes[id]?.get(d.key) ?? toneOf(id),
                          }))
                        : [
                            {
                              key: id,
                              label: hit.info.name,
                              color: toneOf(id),
                            },
                          ],
                    };
                  })}
                />
              ) : null}

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
                        <p key={message} className="num mt-1.5 text-[11px] leading-snug text-ink-3">
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

        {/* ---- БАРУУН: ангиллын задаргаа ---- */}
        {showCharts && (
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {views.length === 0 ||
            (environment && views.every((view) => !view.charts.length)) ? (
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

            {zoneCard}

            {chartCards(
              (id, b) => !(split && id === split.id && b.id === split.chart),
              /* Талбайн карт ҮРГЭЛЖ баруун баганад, давхаргынхаа
                 туузан дор */
              () => true,
              true,
            )}
          </div>
        )}
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

/** Картын толгойн баримт — "33 бичлэг · 4 ангилал" */
function headMeta(b: Breakdown): string {
  const cats = `${num(b.values.length)} ангилал`;
  if (!hasShare(b)) return cats;
  const total = b.values.reduce((n, d) => n + d.value, 0);
  if (b.kind === "count") return `${num(total)} бичлэг · ${cats}`;
  const unit = b.measure ? unitOf(b.measure).unit : "";
  return `${measureText(total)}${unit ? ` ${unit}` : ""} · ${cats}`;
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
  weight = 1,
  meta,
  action,
  children,
}: {
  title: string;
  tone: string;
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
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "analytics-chart-card flex min-h-0 flex-col rounded-xl border border-line bg-paper-2",
        first && "border-t-2",
      )}
      style={
        {
          flexGrow: weight,
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
      <div className="analytics-chart-head">
        <h2 className="text-ink" title={title}>
          {title}
        </h2>
        {meta ? (
          <span className="num shrink-0 text-[10.5px] whitespace-nowrap text-ink-3">
            {meta}
          </span>
        ) : null}
        {action}
      </div>
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
      /*
        ⚠⚠ ӨНДӨР НЬ АГУУЛГААРАА, БҮТЭН БИШ (2026-09-29, хэрэглэгч
        зургаар: хориглолтын бүсийн хоёр мөрийн доор бүтэн дэлгэцийн
        хоосон талбай). Урьд нь `top` ба `bottom` ХОЁУЛАА бэхлэгдсэн
        тул самбар агуулгаасаа үл хамааран зургийн бүтэн өндрийг
        эзэлдэг байв — хоёр талбартай давхаргад (дугаар, талбай) ~800px
        хоосон цагаан талбай үлдэнэ.
        ⚠ `max-h` нь УРТ бичлэгийг хамгаална: самбарын бие
        `flex-1 min-h-0 overflow-y-auto` тул дотроо гүйнэ.
      */
      className="top-2 right-2 max-h-[calc(100%-2.5rem)] w-[288px]"
    >
      <dl className="divide-y divide-line overflow-y-auto">
        {info.fields.map((f) => {
          const v = row[f.name];
          const text = typeof v === "string" ? v.trim() : v;
          if (text === "" || text == null) return null;
          const isNum = typeof text === "number" && Number.isFinite(text);
          return (
            <div key={f.name} className="flex gap-2 px-2.5 py-1.5">
              <dt className="w-[92px] shrink-0 text-[10px] tracking-[0.06em] text-ink-3 uppercase">
                {f.alias}
              </dt>
              <dd
                className={cn(
                  "min-w-0 flex-1 text-[11.5px] leading-snug text-ink-2",
                  isNum && "num",
                )}
              >
                {fieldText(f.alias, text)}
              </dd>
            </div>
          );
        })}
      </dl>
    </MapPanel>
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
function fieldText(alias: string, v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v);
  if (!unitOf(alias).unit) return String(v);
  return num(v, Math.abs(v) >= 100 ? 0 : 2);
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
      <span className="analytics-stat-icon">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <span className="analytics-stat-label">{label}</span>
        <span className="analytics-stat-value">{value}</span>
      </div>
    </div>
  );
}
