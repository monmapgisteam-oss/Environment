"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarRange,
  FileCheck2,
  Layers3,
  Loader2,
  MapPin,
  MousePointerClick,
  Ruler,
  ScrollText,
  Users,
  X,
} from "lucide-react";
import { AreaChart, PieChart, RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { Columns } from "@/components/ui/resizable-columns";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import {
  fetchAssessments,
  sizeClass,
  ACTIVITIES,
  SIZE_CLASSES,
  type Assessment,
  type AssessmentData,
} from "@/lib/assessment";
import { Bounds } from "@/lib/extent";
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

/** Цэгэн давхарга хэрэглэхгүй — энэ самбар зөвхөн нэгж талбарын хүрээ харуулна */
const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

type Skip = "activity" | "landuse" | "district" | "right" | "size" | "month";

/* `ACTIVITIES` нь `as const` тул түлхүүр нь литерал нэгдэл болно —
   энгийн `string`-ээр хайхад TypeScript зөвшөөрөхгүй. Тодорхой зарлав. */
const ACTIVITY_LABEL = new Map<string, string>(
  ACTIVITIES.map((a) => [a.id, a.label] as [string, string]),
);

/**
 * Байгаль орчны ерөнхий үнэлгээний самбар.
 *
 * **Бусад самбараас ЗОРИУДААР ӨӨР бүтэцтэй.** Платформ дээр өмнө нь
 * бүтсэн самбарууд бүгд "жагсаалт · газрын зураг · диаграм" гэсэн нэг
 * хэвэнд оржээ. Энэ дата тэр хэвэнд таарахгүй:
 *
 *  · Бичлэг бүр нь ДОКУМЕНТ (үнэлгээний хуудас) — хүсэгч, үнэлгээний
 *    дугаар, огноо, чиглэл, зориулалт, дүүрэг, талбай гэсэн долоон
 *    талбарыг ЗЭРЭГ харах шаардлагатай. Нэг баганат жагсаалтад гурав
 *    нь л багтана.
 *  · Бүх бичлэг нэг онд шийдвэрлэгдсэн тул газар зүй биш ХУГАЦАА,
 *    урсгал нь гол асуулт.
 *  · Нэгж талбар нь хотын доторх жижиг хэсгүүд — газрын зураг нь
 *    судлах гадаргуу биш, БАЙРШИЛ ЗААГЧ.
 *
 * Тиймээс бүтэц нь: индикатор → сарын зурвас → **БҮРТГЭЛИЙН ХҮСНЭГТ**
 * (эрэмбэлэгддэг, самбарын гол эзэн) + баруун талд байршил заагч зураг
 * ба задаргаа. Төсөл дээр хүснэгт хэрэглэсэн цорын ганц самбар, баганан
 * диаграм хэрэглэсэн цорын ганц самбар нь энэ — андуурах боломжгүй.
 */
export function UnelgeeDashboard() {
  const [data, setData] = React.useState<AssessmentData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [activity, setActivity] = React.useState<string | null>(null);
  const [landuse, setLanduse] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [right, setRight] = React.useState<string | null>(null);
  const [size, setSize] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();

  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());

  React.useEffect(() => {
    const ac = new AbortController();
    fetchAssessments(ac.signal)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, []);

  const rows = data?.rows;

  /* Диаграм бүр ӨӨРИЙНХӨӨ хэмжигдэхүүнийг алгасаж шүүгддэг: эс тэгвээс
     нэгийг сонгосны дараа бусад мөр алга болж, харьцуулах юм үлдэхгүй */
  const keep = React.useCallback(
    (r: Assessment, skip?: Skip) => {
      if (skip !== "activity" && activity && r.activity !== activity) return false;
      if (skip !== "landuse" && landuse && r.landuse !== landuse) return false;
      if (skip !== "district" && district && r.district !== district) return false;
      if (skip !== "right" && right && r.right !== right) return false;
      if (skip !== "size" && size && String(sizeClass(r.m2)) !== size) return false;
      if (skip !== "month" && month && String(r.month) !== month) return false;
      return true;
    },
    [activity, landuse, district, right, size, month],
  );

  const filtered = React.useMemo(() => (rows ?? []).filter((r) => keep(r)), [rows, keep]);

  /* Шүүлтүүр газрын зурагт ч үйлчилнэ — таарсан талбай л үлдэнэ */
  const shapes = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data) return { type: "FeatureCollection", features: [] };
    if (filtered.length === data.rows.length) return data.shapes;
    const on = new Set(filtered.map((r) => r.oid));
    return {
      type: "FeatureCollection",
      features: data.shapes.features.filter((f) => on.has(Number(f.id))),
    };
  }, [data, filtered]);

  /* ---------------- Задаргаа ---------------- */
  const tally = React.useCallback(
    (of: (r: Assessment) => string | null, skip: Skip): Datum[] => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!keep(r, skip)) continue;
        const k = of(r);
        if (k == null) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m].map(([k, v]) => ({ key: k, label: k, value: v }));
    },
    [rows, keep],
  );

  /** Чиглэл — бүлгийн ТОГТМОЛ дараалалтай (тоо хэлбэлзэхэд байраа солихгүй) */
  const activityData = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "activity")) continue;
      m.set(r.activity, (m.get(r.activity) ?? 0) + 1);
    }
    return ACTIVITIES.filter((a) => m.has(a.id)).map((a) => ({
      key: a.id,
      label: a.label,
      value: m.get(a.id) ?? 0,
    }));
  }, [rows, keep]);

  const districtData = React.useMemo(
    () => tally((r) => r.district, "district").sort((a, b) => b.value - a.value),
    [tally],
  );

  const rightData = React.useMemo(
    () => tally((r) => r.right, "right").sort((a, b) => b.value - a.value),
    [tally],
  );

  const landuseData = React.useMemo(
    () => tally((r) => r.landuse, "landuse").sort((a, b) => b.value - a.value),
    [tally],
  );

  /** Хэмжээний ангилал — ТОГТМОЛ дараалалтай, хоосон шатыг ч харуулна */
  const sizeData = React.useMemo(() => {
    const c = SIZE_CLASSES.map(() => 0);
    for (const r of rows ?? []) {
      if (!keep(r, "size")) continue;
      c[sizeClass(r.m2)]++;
    }
    return SIZE_CLASSES.map((s, i) => ({ key: s.id, label: s.label, value: c[i] }));
  }, [rows, keep]);

  /*
    Сарын зурвас. Бүх бичлэг 2026 онд тул тэнхлэг нь САР. Бичлэггүй
    сарыг ч гаргана — "тэр сард нэг ч үнэлгээ гараагүй" гэдэг нь өөрөө
    мэдээлэл бөгөөд алгасвал цуваа тасралтгүй мэт харагдана.
  */
  const monthData = React.useMemo<Datum[]>(() => {
    const c = new Map<number, number>();
    let hi = 0;
    for (const r of rows ?? []) {
      if (!keep(r, "month")) continue;
      if (!r.month) continue;
      c.set(r.month, (c.get(r.month) ?? 0) + 1);
      if (r.month > hi) hi = r.month;
    }
    if (!hi) return [];
    return Array.from({ length: hi }, (_, i) => ({
      key: String(i + 1),
      label: `${i + 1}`,
      value: c.get(i + 1) ?? 0,
    }));
  }, [rows, keep]);

  const stats = React.useMemo(() => {
    let m2 = 0;
    const applicants = new Set<string>();
    for (const r of filtered) {
      m2 += r.m2;
      applicants.add(r.applicant);
    }
    const ms = filtered.map((r) => r.month).filter(Boolean) as number[];
    return {
      n: filtered.length,
      ha: m2 / 10000,
      applicants: applicants.size,
      /* Бүх бичлэг нэг онд тул "он" индикатор утгагүй — сарын муж илүү */
      span: ms.length ? `${Math.min(...ms)}–${Math.max(...ms)}` : "—",
    };
  }, [filtered]);

  /* Сонголт руу ойртох — сонгосон талбайн хүрээг тооцно */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    if (picked != null) {
      const f = data.shapes.features.find((x) => Number(x.id) === picked);
      if (!f) return null;
      const b = new Bounds();
      b.addGeometry(f.geometry);
      return b.get(0.0008);
    }
    /* Шүүлтүүргүй үед гарын байрлалыг бид дарахгүй */
    if (!activity && !landuse && !district && !right && !size && !month) return null;
    const b = new Bounds();
    for (const f of shapes.features) b.addGeometry(f.geometry);
    return b.get();
  }, [data, shapes, picked, activity, landuse, district, right, size, month]);

  /** Хулгана дээр очсон нэгж талбар — газрын зурагнаас */
  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (rows?.find((r) => r.oid === tip.oid) ?? null)),
    [rows, tip.oid],
  );

  const selected = React.useMemo(
    () => (picked == null ? null : (rows?.find((r) => r.oid === picked) ?? null)),
    [rows, picked],
  );

  function reset() {
    setActivity(null);
    setLanduse(null);
    setDistrict(null);
    setRight(null);
    setSize(null);
    setMonth(null);
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
            Ерөнхий үнэлгээний бүртгэл татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount =
    (activity ? 1 : 0) +
    (landuse ? 1 : 0) +
    (district ? 1 : 0) +
    (right ? 1 : 0) +
    (size ? 1 : 0) +
    (month ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Байгаль орчны ерөнхий үнэлгээ"
        activeCount={activeCount}
        onReset={reset}
      >
        <FilterMenu
          label="Чиглэл"
          icon={Layers3}
          value={activity ? (ACTIVITY_LABEL.get(activity) ?? null) : null}
          active={Boolean(activity)}
          onClear={() => setActivity(null)}
          width={230}
        >
          <PickList items={activityData} selected={activity} onPick={setActivity} />
        </FilterMenu>

        <FilterMenu
          label="Зориулалт"
          icon={ScrollText}
          value={landuse}
          active={Boolean(landuse)}
          onClear={() => setLanduse(null)}
          width={280}
        >
          <PickList items={landuseData} selected={landuse} onPick={setLanduse} />
        </FilterMenu>

        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={210}
        >
          <PickList items={districtData} selected={district} onPick={setDistrict} />
        </FilterMenu>

        <FilterMenu
          label="Эрхийн хэлбэр"
          icon={FileCheck2}
          value={right}
          active={Boolean(right)}
          onClear={() => setRight(null)}
          width={200}
        >
          <PickList items={rightData} selected={right} onPick={setRight} />
        </FilterMenu>

        <FilterMenu
          label="Талбайн хэмжээ"
          icon={Ruler}
          value={size ? SIZE_CLASSES[Number(size)].label : null}
          active={Boolean(size)}
          onClear={() => setSize(null)}
          width={210}
        >
          <PickList items={sizeData} selected={size} onPick={setSize} />
        </FilterMenu>
      </FilterBar>

      {/*
        ГАЗРЫН ЗУРАГ ТӨВД, диаграмууд ЭРГЭН ТОЙРОНД.

        Дээр индикатор, доор сарын зурвас — хоёулаа бүтэн өргөнтэй; хажуу
        тал бүрд хоёр диаграм. Ингэснээр зураг дөрвөн талаасаа контекстээр
        хүрээлэгдэж, өөрөө хамгийн том талбайг эзэлнэ.

        Нэгж талбарууд хотын дотор нягт байрладаг тул зурагт ӨРГӨН чухал:
        нарийн баганад бол хоорондоо давхцаж, ялгарахаа болино.

        Жагсаалт БАЙХГҮЙ — сонгосон бичлэгийн бүх талбар зургийн зүүн дээд
        буланд хөвөгч хуудсаар гарна.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <Card className="shrink-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 xl:divide-y-0">
            <Stat icon={FileCheck2} label="Үнэлгээ" value={num(stats.n)} />
            <Stat icon={Ruler} label="Нийт талбай, га" value={stats.ha.toFixed(1)} />
            <Stat icon={Users} label="Хүсэгч" value={num(stats.applicants)} />
            <Stat icon={CalendarRange} label="Хамрах хугацаа" value={stats.span} />
          </div>
        </Card>

        <Columns layout="flex" id="assessment" left={248} right={262} className="min-h-0 flex-1">
          {/* ---- ЗҮҮН: юуны төлөө, хаана ---- */}
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-(--col-l) xl:shrink-0">
            <Card className="min-h-[120px] flex-1">
              <Head title="Чиглэлээр">
                <span className="text-[10.5px] text-ink-3">бүлэглэсэн ангилал</span>
              </Head>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart data={activityData} selected={activity} onSelect={setActivity} />
              </div>
            </Card>

            <Card className="min-h-[120px] flex-1">
              <Head title="Дүүргээр" />
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart data={districtData} selected={district} onSelect={setDistrict} />
              </div>
            </Card>
          </div>

          {/* ---- ТӨВ: газрын зураг ---- */}
          <Card className="relative min-h-[300px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/*
                ЗӨВХӨН олон өнцөгт: нэгж талбарын ХЭЛБЭР, хэмжээ нь өөрөө
                мэдээлэл. Төлөөлөх цэг нь 56 м² талбайг байгаагаас хамаагүй
                том мэт харуулна.
              */}
              <PolygonMap
                points={NO_POINTS}
                visible={NO_INDEX}
                shapes={{ data: shapes, selected: picked, glow: true }}
                basemap={basemap}
                onSelect={setPicked}
                onHover={tip.onHover}
                focus={focus}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {/*
                ХӨВӨГЧ ТАЙЛБАР — хулганы хажууд. Зүүн дээд булангийн
                "Үнэлгээний хуудас"-аас өөр үүрэгтэй: тэр нь сонгосон
                бичлэгийн БҮХ талбарыг задалж, уншиж суух зориулалттай
                бол энэ нь хулганы доорх талбар юу болохыг л хэлнэ.
                Тиймээс зэрэг харагдаж болно.
              */}
              {hovered ? (
                <MapTip state={tip} width={244}>
                  <div className="px-2.5 pt-2 pb-1">
                    <span className="text-[10px] leading-none tracking-[0.08em] text-data uppercase">
                      {ACTIVITY_LABEL.get(hovered.activity)}
                    </span>
                  </div>
                  <div className="px-2.5 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                    {hovered.applicant}
                  </div>

                  <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                    <MapTipRow icon={Ruler} num text={areaText(hovered.m2)} />
                    <MapTipRow icon={Layers3} text={hovered.landuse} />
                    <MapTipRow
                      icon={MapPin}
                      text={`${hovered.district}${
                        hovered.khoroo ? `, ${hovered.khoroo}-р хороо` : ""
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                    <span className="num min-w-0 flex-1 truncate text-[10px] leading-none text-ink-3">
                      {hovered.code || hovered.parcel || "—"}
                    </span>
                    <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                  </div>
                </MapTip>
              ) : null}

              {selected ? (
                <div className="absolute top-2.5 left-2.5 z-10 flex max-h-[calc(100%-1.25rem)] w-[268px] flex-col rounded-xs border border-line bg-paper/95 backdrop-blur-md">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow min-w-0 flex-1 truncate">Үнэлгээний хуудас</span>
                    <button
                      onClick={() => setPicked(null)}
                      className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                      aria-label="Хаах"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
                    <div className="text-[12.5px] leading-snug font-medium text-ink">
                      {selected.applicant}
                    </div>
                    <div className="num mt-1 text-[11px] text-ink-3">
                      {selected.request || "—"}
                    </div>

                    <dl className="mt-2.5 space-y-1.5">
                      <Field
                        k="Үнэлгээ"
                        v={<span className="num">{selected.code || "—"}</span>}
                      />
                      <Field
                        k="Шийдвэрлэсэн"
                        v={<span className="num">{selected.decidedRaw || "—"}</span>}
                      />
                      <Field k="Чиглэл" v={ACTIVITY_LABEL.get(selected.activity) ?? "—"} />
                      {/*
                        Бүлэглэсэн ангилал БА эх бичвэр хоёулаа. Ангилал нь
                        зөвхөн харуулах давхарга — бүртгэсэн үгийг нуухгүй.
                      */}
                      {selected.activityRaw ? (
                        <Field
                          k="Бүртгэсэн"
                          v={<span className="text-ink-2">{selected.activityRaw}</span>}
                        />
                      ) : null}
                      <Field k="Зориулалт" v={selected.landuse} />
                      <Field k="Эрх" v={selected.right} />
                      <Field
                        k="Байршил"
                        v={`${selected.district}${
                          selected.khoroo ? `, ${selected.khoroo}-р хороо` : ""
                        }`}
                      />
                      {selected.address ? <Field k="Хаяг" v={selected.address} /> : null}
                      <Field
                        k="Нэгж талбар"
                        v={<span className="num">{selected.parcel || "—"}</span>}
                      />
                      <Field
                        k="Талбай"
                        v={<span className="num">{areaText(selected.m2)}</span>}
                      />
                    </dl>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          {/* ---- БАРУУН: хэзээ, ямар зориулалтаар, ямар эрхээр ---- */}
          <div className="flex min-h-0 flex-col gap-2.5 xl:w-(--col-r) xl:shrink-0">
            {/*
              Эрхийн хэлбэр гуравхан ангилалтай тул бөгж: хэсэг бүрийн
              ЭЗЛЭХ ХУВЬ нь энд гол утга (212 эзэмших / 31 өмчлөх / 11
              ашиглах). Мөрөн диаграм дээр гурван мөр нь харьцааг биш,
              зөвхөн гурван тоог харуулна.
            */}
            <Card className="shrink-0">
              <Head title="Эрхийн хэлбэрээр" />
              <div className="p-3">
                <PieChart data={rightData} selected={right} onSelect={setRight} />
              </div>
            </Card>

            {/*
              Хугацааны цуваа. Бүх бичлэг 2026 онд шийдвэрлэгдсэн тул
              жилийн цуваа гэж байхгүй — сар нь энэ датаны цорын ганц
              хугацааны тэнхлэг.
            */}
            <Card className="shrink-0">
              <Head title="2026 оны урсгал">
                <span className="text-[10.5px] text-ink-3">сараар</span>
              </Head>
              <div className="p-3">
                <AreaChart
                  data={monthData}
                  height={72}
                  selected={month}
                  onSelect={setMonth}
                  unit="үнэлгээ"
                />
              </div>
            </Card>

            {/*
              Газрын зориулалт нь ЭХ СУРВАЛЖИЙН өөрийн ангилал (23 утга) —
              зүүн талын чиглэл бол бидний бүлэглэсэн хувилбар. Албан
              ангилал нь баримт, бүлэглэлт нь зөвхөн уншихад тус болох
              давхарга; хоёулаа хэрэгтэй.
            */}
            <Card className="min-h-[120px] flex-1">
              <Head title="Зориулалтаар">
                <span className="text-[10.5px] text-ink-3">эх сурвалжийн ангилал</span>
              </Head>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart data={landuseData} selected={landuse} onSelect={setLanduse} />
              </div>
            </Card>
          </div>
        </Columns>

        <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
          Суурь зураг: Esri · Дата: ArcGIS · {num(data.rows.length)} нэгж талбар ·
          чиглэлийг эх бичвэрээс бүлэглэв
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Талбайг уншигдах хэлбэрт. Хэмжээ нь 56 м²-ээс 130 га хүртэл сунасан
 * тул нэг нэгжээр бичих боломжгүй: жижиг талбай "0.0 га" болж алга
 * болно, том нь "1,299,999 м²" болж уншигдахаа болино.
 */
function areaText(m2: number): string {
  return m2 >= 10000 ? `${(m2 / 10000).toFixed(1)} га` : `${num(Math.round(m2))} м²`;
}

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
  icon: typeof Ruler;
}) {
  return (
    <div className="flex flex-col px-3 py-2">
      <span className="eyebrow block min-h-[28px] leading-[1.25]">{label}</span>
      <span className="mt-auto flex items-center gap-1.5">
        <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-3" />
        <span className="num truncate text-[16px] leading-none font-medium text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[86px] shrink-0 text-[10.5px] tracking-[0.08em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink">{v}</dd>
    </div>
  );
}
