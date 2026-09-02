"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Building2, Loader2, MapPin, MousePointerClick, Search, X } from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { type Datum } from "@/components/charts";
import { FilterMenu, PickList } from "@/components/wells/filter-bar";
import { MapPanel, useMapPanel } from "@/components/map/panel";
import {
  BASEMAPS,
  zoomForScale,
  type Basemap,
  type Extent,
} from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import { districtName, fetchRepairShops, type RepairData } from "@/lib/repair-shops";
import { num } from "@/lib/utils";

/*
  ҮЙЛЧИЛГЭЭНИЙ ЦЭГИЙН тэмдэглэгээ — бүх цэгт нэг ижил.

  Firefly горим (сарнисан гэрэлтэй цэг) нь ТАРХАЛТ уншуулдаг: "хаана
  хэр нягт". Энэ дата бол хаягийн лавлах — "энд нэг газар байна".
  Тиймээс тодорхой ирмэгтэй тэмдэглэгээ: цайвар дугуй, дотор нь
  засварын икон.

  `data-pin="place"` нь `globals.css`-д хэлбэр, өнгийг нь өгнө —
  тэмдгийн агуулгыг дуудагч тал өгдөг тул газрын зургийн модулийг
  хөндөхгүйгээр загварыг нь ялгах цорын ганц зам.
*/
const PIN =
  '<svg data-pin="place" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1' +
  '-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' +
  "</svg>";

/* --------------------------------------------------------------------------
   ХОЁР ХАРАГДАЦ, НЭГ ХИЛ — 1:4000

   Энэ зураг хоёр өөр асуултад хариулдаг бөгөөд тэдгээр нь ойртолтоор
   ялгагдана:

     1:4000-аас ХОЛ   "хот даяар хаана хэр олон вэ" — бөөгнөрсөн цэг,
                      хиймэл дагуулын суурь дээр. Нэр, тэмдэглэгээ энд
                      утгагүй: 500 гаруй шошго бие биенээ дарна.
     1:4000-аас ОЙР   "энэ гудамжинд юу байна вэ" — тэмдэглэгээ, нэр,
                      гудамжны суурь зураг. Хаяг олох горим.

   Суурь зураг нь ч дагаж солигдоно. Хиймэл дагуул ойртоход дэндүү
   шуугиантай (тэмдэглэгээ дүрстэй нийлнэ); гудамжны зураг холоос
   хоосон (зам л харагдана). Тус бүр өөрийн түвшиндээ л сайн.

   ӨНГӨ нь ч хоёр горимд өөр бөгөөд шалтгаан нь ижил — уншигдац:

     хол / хиймэл дагуул  платформын ЦЭНХЭР (firefly). Хэлтсийн улаан
                          нь хиймэл дагуулын бор-саарал-ногоон дэвсгэр
                          дээр уусдаг; цэнхэр firefly нь яг тэр
                          дэвсгэрийг бодож зохиогдсон.
     ойр / гудамж         хэлтсийн УЛААН тэмдэглэгээ. Цайвар гудамжны
                          зураг дээр улаан тод гарах бөгөөд хэлтсийн
                          өнгө таних тэмдэг болно.

   Хоёр өнгө хэзээ ч ЗЭРЭГ гардаггүй (горим нь 1:4000 дээр солигдоно)
   тул нэг датаг хоёр өнгөөр уншуулах эрсдэл үүсэхгүй.

   Хэрэглэгч суурь зургаа ГАРААР сонгосон бол автомат солилт зогсоно —
   сонголтыг нь буцаан дарж бичих нь хамгийн эвгүй зан төлөв.
   -------------------------------------------------------------------------- */

/** 1:4000 → z15.6 */
const SWITCH_ZOOM = zoomForScale(4000);

/** Бөөгнөрөл задрах түвшин — хилтэй яг таарна */
const CLUSTER_MAX = Math.round(SWITCH_ZOOM);

const STREET = BASEMAPS.find((b) => b.id === "street") ?? BASEMAPS[0];
const IMAGERY = BASEMAPS.find((b) => b.id === "imagery") ?? BASEMAPS[0];

const PointMap = dynamic(() => import("@/components/wells/map").then((m) => m.WellsMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-paper-3">
      <Loader2 size={16} className="animate-spin text-ink-3" />
    </div>
  ),
});

/* --------------------------------------------------------------------------
   Авто засварын үйлчилгээний цэгүүд — ЗӨВХӨН ГАЗРЫН ЗУРАГ

   Энэ хэлтэст самбар байхгүй, зориудаар. Эх сурвалж 528 бичлэгтэй ч
   талбар нь ердөө дөрөв: нэр, чиглэл, байршил, дүүрэг. Чиглэл нь бүх
   бичлэгт ИЖИЛ утгатай тул задаргаа хийх зүйл алга — диаграм зурвал
   нэг мөр гарна.

   Датаны цорын ганц бодит агуулга нь ХААНА байгаа явдал. Тиймээс зураг
   нь картын хүрээгүй, бүтэн дэлгэцийг эзэлж, бүх хяналт түүн дээр
   хөвнө: гарчиг зүүн дээр, суурь зураг баруун доор, тайлбар хулганы
   хажууд.
   -------------------------------------------------------------------------- */

export function RepairMap() {
  const [data, setData] = React.useState<RepairData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  /*
    Дүүргийн шүүлт. Энэ бол датаны ЦОРЫН ГАНЦ задаргаа — үйл
    ажиллагааны чиглэл нь бүх бичлэгт ижил утгатай.
  */
  const [district, setDistrict] = React.useState<string | null>(null);
  /*
    Нэрээр хайх. 518 нэрлэсэн газрын лавлахад энэ нь газрын зургаас ч
    хурдан зам: хэрэглэгч ихэвчлэн ТОДОРХОЙ газар хайж ирнэ.
  */
  const [query, setQuery] = React.useState("");
  /*
    Суурь зураг: гараар сонгоогүй бол ойртолт шийднэ. `null` нь
    "автомат" гэсэн үг — хэрэглэгч цуглуулгаас сонгомогц тогтоно.
  */
  const [manualBasemap, setManualBasemap] = React.useState<Basemap | null>(null);
  const [zoom, setZoom] = React.useState(9);
  const close = zoom >= SWITCH_ZOOM;
  const basemap = manualBasemap ?? (close ? STREET : IMAGERY);

  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();
  const panel = useMapPanel("left");

  React.useEffect(() => {
    const ac = new AbortController();
    fetchRepairShops(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const points = React.useMemo(
    () => data?.points ?? { oid: [], lon: [], lat: [] },
    [data],
  );

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.shops ?? []).filter((sh) => {
      if (district != null && sh.district !== district) return false;
      if (!q) return true;
      /* Нэр ба байршлын бичвэр хоёуланд нь хайна — хороо, тоот нь
         байршлын талбарт бичигдсэн байдаг */
      return (
        sh.name.toLowerCase().includes(q) || sh.place.toLowerCase().includes(q)
      );
    });
  }, [data, district, query]);

  const visible = React.useMemo(() => {
    if (district == null && !query.trim()) {
      return Uint32Array.from(points.oid.map((_, i) => i));
    }
    const on = new Set(shown.map((sh) => sh.oid));
    const out: number[] = [];
    points.oid.forEach((o, i) => on.has(o) && out.push(i));
    return Uint32Array.from(out);
  }, [district, query, points, shown]);

  /*
    Дүүргийн задаргаа. Өөрийнхөө шүүлтийг алгасна — дүүрэг сонгосны
    дараа ч бусад мөр харагдсаар үлдэж, шилжих боломжтой байна.

    Дүүрэг тэмдэглэгдээгүй бичлэгүүд ТУСДАА мөр болно: нуувал жагсаалтын
    нийлбэр нийт тоотой таарахгүй байгаа нь тайлбаргүй үлдэнэ.
  */
  const districtData = React.useMemo<Datum[]>(() => {
    if (!data) return [];
    /* Товчлолыг БҮТЭН нэрээр — албан бичигт товчлол гарахгүй */
    const rows: Datum[] = data.byDistrict.map((d) => ({
      key: d.district,
      label: districtName(d.district),
      value: d.n,
    }));
    if (data.noDistrict) {
      rows.push({ key: "", label: "Бүртгэгдээгүй", value: data.noDistrict });
    }
    return rows;
  }, [data]);

  /* Дүүрэг сонгоход зураг тийш нь ойртоно; цуцлахад бүх цэг рүү буцна */
  const focus = React.useMemo<Extent | null>(() => {
    if ((district == null && !query.trim()) || !shown.length) return null;
    const b = new Bounds();
    for (const sh of shown) b.add(sh.lon, sh.lat);
    return b.get(0.006);
  }, [district, query, shown]);

  const byOid = React.useMemo(() => {
    const m = new Map<number, number>();
    (data?.shops ?? []).forEach((s, i) => m.set(s.oid, i));
    return m;
  }, [data]);

  const hovered = React.useMemo(() => {
    if (!data || tip.oid == null) return null;
    const i = byOid.get(tip.oid);
    return i === undefined ? null : data.shops[i];
  }, [data, byOid, tip.oid]);

  const selected = React.useMemo(() => {
    if (!data || picked == null) return null;
    const i = byOid.get(picked);
    return i === undefined ? null : data.shops[i];
  }, [data, byOid, picked]);

  const highlight = React.useMemo<[number, number] | null>(
    () => (hovered ? [hovered.lon, hovered.lat] : null),
    [hovered],
  );

  /*
    Тэмдэглэгээ — бүх цэгт нэг ижил икон, ЗӨВХӨН ойртсон үед.
    Холоос өгвөл бөөгнөрлийн бөмбөлөгтэй давхарлаж, зураг бөглөрнө.
  */
  const marks = React.useMemo<Record<number, string> | undefined>(() => {
    if (!close) return undefined;
    const m: Record<number, string> = {};
    for (const sh of data?.shops ?? []) m[sh.oid] = PIN;
    return m;
  }, [data, close]);

  /*
    Цэгийн шошго — үйлчилгээний нэр. Хамгийн ойрын түвшинд (z15) л
    гарна: түүнээс холоос 500 гаруй нэр хоорондоо давхцаж, зураг
    уншигдахаа болино. Давхцлыг MapLibre өөрөө шийднэ.
  */
  const labels = React.useMemo(() => {
    if (!data) return undefined;
    const byOidName = new Map(data.shops.map((sh) => [sh.oid, sh.name]));
    return {
      text: points.oid.map((o) => byOidName.get(o) ?? ""),
      /* Нэр нь тэмдэглэгээтэй ХАМТ гарна — тэмдэг нэргүй гарч ирвэл
         юу болох нь мэдэгдэхгүй, нэр тэмдэггүй гарвал хаана байгаа нь */
      minzoom: SWITCH_ZOOM,
    };
  }, [data, points]);

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">
              Эх сурвалжийн мэдээллийг татаж чадсангүй
            </p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Авто засварын цэг татаж байна…
          </span>
        )}
      </div>
    );
  }

  return (
    /*
      Зураг нь БҮТЭН талбайг эзэлнэ. Дүүргийн задаргаа нь баруун талын
      диаграм байсныг ТОЛГОЙН ЗУРВАС дахь шүүлтүүр болгов: энэ дэлгэцийн
      цорын ганц бодит агуулга нь БАЙРШИЛ бөгөөд түүнээс өргөн хулгайлж
      байсан. Задаргааны тоо нь шүүлтүүрийн цэсэнд мөр бүрийнхээ хажууд
      гарсаар байна.
    */
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-xs border border-line">
      <PointMap
      points={points}
      visible={visible}
      basemap={basemap}
      onSelect={(oid) => setPicked(picked === oid ? null : oid)}
      onHover={tip.onHover}
      highlight={highlight}
      focus={focus}
      marks={marks}
      labels={labels}
      onZoom={setZoom}
      clusterMaxZoom={CLUSTER_MAX}
      clusterLabel="badge"
      />

      <BasemapGallery value={basemap} onChange={setManualBasemap} />

      {/*
      ТОЛГОЙН ЗУРВАС — зургийн дээд ирмэг дээр, бүтэн өргөнөөр.

      Тусдаа толгойн мөр гаргавал зураг тэр өндрийг алдана; хөвөгч
      карт болговол зургийн зүүн дээд булангийн агуулгыг дардаг. Бүтэн
      өргөнтэй нимгэн зурвас нь хоёуланг нь шийднэ.

      ХЭМНЭЛ нь платформын шүүлтүүрийн мөртэй ЯГ ИЖИЛ: нэг мөр, зүүн
      талд бүдүүн жижиг гарчиг, баруун тийш шахагдсан хяналтууд. Урьд
      нь хоёр мөрт гарчиг, 19px өнгөт тоотой байсныг ХАСAB — тэр нь
      САМБАРЫН ИНДИКАТОРЫН хэв маяг бөгөөд зурвас дотор орохоороо
      түүнийг хоёр дахин өндөр болгож, дэлгэцийн бусад мөртэй
      зөрчилдөж байв.

      `pointer-events-none` — зурвасын доорх зургийг чирэх боломж
      хаагдах ёсгүй.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 border-b border-line bg-paper/92 backdrop-blur-md">
      {/* Баруун талд суурь зургийн товчны зай — зурвасын агуулга
          түүний доогуур оръё гэвэл хяналтууд далдлагдана */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-1.5 pr-12 pl-3">
        <span className="shrink-0 text-[12px] font-semibold tracking-[0.12em] text-ink uppercase">
          Авто засварын үйлчилгээ
        </span>

        <span className="mx-0.5 h-4 w-px shrink-0 bg-line" aria-hidden />

        <span className="num shrink-0 text-[11.5px] text-ink-2">
          {num(shown.length)}
          <span className="ml-1 text-ink-3">
            {shown.length === data.shops.length
              ? "цэг"
              : `цэг · нийт ${num(data.shops.length)}`}
          </span>
        </span>

        {/*
          ДҮҮРГИЙН ШҮҮЛТҮҮР — зурвас дээр, унждаг цэсээр. Тоо нь мөр
          бүрийнхээ хажууд гарах тул задаргааны диаграм илүүц болов.

          `pointer-events-auto`: зурвас өөрөө хулганы үйлдлийг
          нэвтрүүлдэг тул харилцах элемент бүр дээр тусгайлан асаана.
        */}
        <div className="pointer-events-auto ml-auto shrink-0">
          <FilterMenu
            label="Дүүрэг"
            icon={Building2}
            active={district != null}
            value={district != null ? districtName(district) : null}
            onClear={() => setDistrict(null)}
          >
            <PickList
              items={districtData.map((d) => ({
                key: d.key,
                label: d.label,
                value: d.value,
              }))}
              selected={district}
              onPick={setDistrict}
            />
          </FilterMenu>
        </div>

        {/* Хайлт — зурвасын баруун захад */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-xs border border-line bg-paper-3 px-2 py-1">
          <Search size={12} className="shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Нэр, байршлаар хайх"
            className="w-[150px] bg-transparent text-[11.5px] text-ink outline-none placeholder:text-ink-3"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="shrink-0 text-ink-3 transition-colors hover:text-ink"
              aria-label="Хайлт цэвэрлэх"
            >
              <X size={11} />
            </button>
          ) : null}
        </div>
      </div>
      </div>

      {/* ХӨВӨГЧ ТАЙЛБАР — хулганы хажууд */}
      {hovered ? (
      <MapTip state={tip} width={244}>
        <div className="px-2.5 pt-2 pb-2 text-[12.5px] leading-snug font-medium text-ink">
          {hovered.name}
        </div>
        <div className="space-y-1.5 border-t border-line px-2.5 py-2">
          {hovered.place ? <MapTipRow icon={MapPin} text={hovered.place} /> : null}
          {hovered.district ? (
            <MapTipRow icon={Building2} text={districtName(hovered.district)} />
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
          <span className="num text-[10px] leading-none text-ink-3">
            {hovered.lat.toFixed(5)}° {hovered.lon.toFixed(5)}°
          </span>
          <MousePointerClick size={11} className="shrink-0 text-ink-3" />
        </div>
      </MapTip>
      ) : null}

      {/*
      Товшсон цэгийн бичилт — баруун доор, тогтмол. Хөвөгч тайлбартай
      зэрэг харагдаж болно: тэр нь хулганы доорхыг, энэ нь тогтоосон
      сонголтыг хэлнэ.
      */}
      {selected ? (
      <MapPanel
        state={panel}
        title="Бүртгэлийн бичилт"
        onClose={() => setPicked(null)}
        className="right-2.5 bottom-8 w-[264px]"
      >
        <div className="px-2.5 py-2">
          <div className="text-[12.5px] leading-snug font-medium text-ink">
            {selected.name}
          </div>
          <dl className="mt-2 space-y-1.5">
            <Field k="Чиглэл" v="Авто засварын үйлчилгээ" />
            <Field k="Байршил" v={selected.place || "—"} />
            <Field k="Дүүрэг" v={districtName(selected.district)} />
            <Field
              k="Координат"
              v={
                <span className="num">
                  {selected.lat.toFixed(5)}°, {selected.lon.toFixed(5)}°
                </span>
              }
            />
          </dl>
        </div>
      </MapPanel>
      ) : null}

      {/*
      Эх сурвалжийн бичиг — зургийн доод ирмэгт, дэвсгэргүй. Суурь
      зургийн товчтой ижил сүүдэр: хиймэл дагуулын цайвар талбай дээр
      `text-ink-3` дангаараа алга болно.
      */}
      <p
      className="pointer-events-none absolute bottom-1 left-2.5 z-10 text-[10px] leading-none text-ink-3"
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
      >
      Суурь зураг: Esri · Дата: ArcGIS FeatureServer
      </p>
      </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[68px] shrink-0 text-[10px] tracking-[0.08em] text-ink-3 uppercase">
      {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink">{v}</dd>
    </div>
  );
}
