"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Loader2,
  MapPin,
  Sticker,
  Target,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { Bounds } from "@/lib/extent";
import { fetchStickers, type StickerData } from "@/lib/stickers";
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

/**
 * Шилэн барилгын судалгааны самбар.
 *
 * ⚠⚠ **БҮТЭЦ НЬ БҮРЭН СОЛИГДСОН** (хэрэглэгчийн шийдвэр, 2026-09-16).
 * Хуучин харагдац нь НАЙМАН барилгад зориулагдсан байв: зураг бүтэн
 * өргөнөөр дээр, доор нь хөндлөн картын эгнээ. Эх сурвалж порталд
 * шилжихэд бичлэг **78 болж өсөхөд** тэр эгнээ арван баганат жижиг
 * картын тор болж хувирсан — нэр нь таслагдаж, эрэмбэ алга болж,
 * аль барилгад стикер наагдсаныг огт харуулахгүй байв.
 *
 * **ГОЛ АСУУЛТ НЬ ХАМРАЛТ**: 78 барилга судлагдсанаас ердөө 8-д нь
 * стикер наагдсан. Тиймээс самбар нь тэр ЗӨРҮҮГ харуулна — жагсаалт,
 * зураг, задаргаа гурвуулаа стикертэй эсэхийг эхний ээлжинд хэлнэ.
 *
 * ⚠ **ӨНГӨ нь ТӨЛӨВИЙГ хэлнэ**: стикертэй бол `--water` (хийгдсэн),
 * үгүй бол `--ochre` (анхаарах). Энэ нь чимэглэл биш ДОХИО тул
 * "дата дүрслэлийн өнгө ганц" дүрэмд хамаарахгүй — ландфиллийн
 * эрсдэлийн зэрэгтэй ижил үндэслэл. Хуучин самбар бүх цэгийг
 * анхааруулгын улаанаар зурдаг байсан нь одоо ХУДАЛ болно: 78-аас
 * 70 нь л анхаарал шаардана.
 *
 * ⚠ Бөглөгдөөгүй стикерийн утгыг "байхгүй" рүү БҮҮ хамааруул —
 * гурав дахь төлөв болж үлдэнэ.
 */
export function StickersDashboard() {
  const [data, setData] = React.useState<StickerData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [district, setDistrict] = React.useState<string | null>(null);
  const [khoroo, setKhoroo] = React.useState<string | null>(null);
  /** "Байршуулсан" / "Байршуулаагүй" / "Тэмдэглээгүй" */
  const [state, setState] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchStickers(ac.signal)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, []);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: number[] = [];
    (data?.rows ?? []).forEach((r, i) => {
      if (district && r.district !== district) return;
      if (khoroo && r.khoroo !== khoroo) return;
      if (state && stateOf(r.sticker) !== state) return;
      if (q && !`${r.name} ${r.address}`.toLowerCase().includes(q)) return;
      out.push(i);
    });
    return out;
  }, [data, district, khoroo, state, query]);

  const visible = React.useMemo(() => Uint32Array.from(shown), [shown]);

  /* Зураг дээрх шошго — барилгын нэр */
  const labels = React.useMemo(() => {
    if (!data) return undefined;
    return { text: data.rows.map((r) => r.name), minzoom: 13 };
  }, [data]);

  /**
   * Тэмдэглэгээний өнгө — ТӨЛӨВӨӨР.
   *
   * MapLibre CSS хувьсагч уншдаггүй ч дохиоллын тэмдэглэгээ нь ердийн
   * DOM элемент тул хувьсагч дамжина ({@link pulseColor}).
   */
  const pulseColor = React.useCallback(
    (oid: number) => {
      const r = data?.rows.find((x) => x.oid === oid);
      if (!r) return undefined;
      return r.sticker === true ? "var(--water)" : "var(--ochre)";
    },
    [data],
  );

  /* Задаргаа бүр өөрийнхөө тэнхлэгийг АЛГАСЧ шүүгдэнэ */
  const tally = React.useCallback(
    (
      of: (i: number) => string,
      skip: "district" | "khoroo" | "state",
    ): Datum[] => {
      if (!data) return [];
      const counts = new Map<string, number>();
      data.rows.forEach((r, i) => {
        if (skip !== "district" && district && r.district !== district) return;
        if (skip !== "khoroo" && khoroo && r.khoroo !== khoroo) return;
        if (skip !== "state" && state && stateOf(r.sticker) !== state) return;
        const key = of(i);
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, label: key, value }));
    },
    [data, district, khoroo, state],
  );

  const byDistrict = React.useMemo(
    () => tally((i) => data?.rows[i].district ?? "", "district"),
    [tally, data],
  );
  const byKhoroo = React.useMemo(
    () => tally((i) => data?.rows[i].khoroo ?? "", "khoroo"),
    [tally, data],
  );
  const byState = React.useMemo(
    () => tally((i) => stateOf(data?.rows[i].sticker ?? null), "state"),
    [tally, data],
  );

  /**
   * Дүүрэг бүрийн СТИКЕРТЭЙ барилгын тоо.
   *
   * ⚠ Хамралтын диаграм нь ХАНГАСАН тоог харуулна, дутуугийнх БИШ —
   * урт зурвас "сайн" гэж уншигдах ёстой (ландфиллийн хамралттай нэг
   * зарчим). Хуваарь нь тухайн дүүрэгт СУДЛАГДСАН нийт тоо.
   */
  const coverage = React.useMemo<Datum[]>(() => {
    if (!data) return [];
    const total = new Map<string, number>();
    const done = new Map<string, number>();
    for (const r of data.rows) {
      /*
        ⚠⚠ ХОЁР ХЭМЖИГДЭХҮҮНЭЭ АЛГАСНА.

        1. ДҮҮРЭГ нь энэ диаграмын ТЭНХЛЭГ: шүүвэл сонгосон дүүрэг л
           үлдэж, өөр рүү шилжих арга алга болно (платформын хөндлөн
           шүүлтийн дүрэм).
        2. СТИКЕРИЙН ТӨЛӨВ нь энэ диаграмын ХЭМЖИГДЭХҮҮН: хамралт
           гэдэг нь наасан ба нааагүйн ХАРЬЦАА тул аль нэгээр нь
           шүүвэл бүх зурвас 0 эсвэл бүтэн болж, диаграм утгаа алдана.

        Хороо нь харин үлдэнэ — тэр нь өөр тэнхлэг.
      */
      if (khoroo && r.khoroo !== khoroo) continue;
      total.set(r.district, (total.get(r.district) ?? 0) + 1);
      if (r.sticker === true)
        done.set(r.district, (done.get(r.district) ?? 0) + 1);
    }
    return [...total.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => ({
        key,
        label: `${key} · ${num(done.get(key) ?? 0)} / ${num(n)}`,
        value: done.get(key) ?? 0,
      }));
  }, [data, khoroo]);

  const stats = React.useMemo(() => {
    if (!data) return null;
    let stickered = 0;
    const districts = new Set<string>();
    for (const i of shown) {
      const r = data.rows[i];
      if (r.sticker === true) stickered++;
      districts.add(r.district);
    }
    const n = shown.length;
    return {
      n,
      stickered,
      districts: districts.size,
      share: n > 0 ? Math.round((stickered / n) * 100) : 0,
    };
  }, [data, shown]);

  const detail = React.useMemo(() => {
    if (!data || picked == null) return null;
    return data.rows.find((r) => r.oid === picked) ?? null;
  }, [data, picked]);

  /*
    ОЙРТОХ ҮЙЛДЭЛ (zoom action).

    ⚠⚠ СОНГОЛТ БҮР зураг дээр ХАРАГДАХ ЁСТОЙ (хэрэглэгчийн хүсэлт,
    2026-09-17). 78 барилга нийслэлийн хэмжээнд тархсан тул жагсаалтаас
    нэгийг товшиход зураг хөдлөхгүй бол хаана байгаа нь мэдэгдэхгүй:
    сонгосон цэг нь тодрох ч дэлгэцийн гадна байж болно.

    Хоёр түвшин:
      · БАРИЛГА сонговол ЗӨВХӨН түүн рүү (~450 м-ийн зайтай).
      · Шүүлтүүр (дүүрэг, хороо, стикерийн байдал, хайлт) тавьвал
        ҮЛДСЭН БҮХ барилгыг багтаана — диаграмаас товшсон ч мөн адил.

    ⚠ Шүүлтгүй, сонголтгүй үед `null`: анхны харагдац нь бүх 78
    барилгыг багтаасан байдаг тул дахин ойртуулах шаардлагагүй.

    ⚠ `Bounds` нь бөглөгдөөгүй, хүрээнээс гадуурх координатыг өөрөө
    алгасна.
  */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;

    if (detail) {
      const b = new Bounds();
      b.add(detail.lon, detail.lat);
      return b.get();
    }

    const filtered = Boolean(district || khoroo || state || query.trim());
    if (!filtered || shown.length === 0) return null;

    const b = new Bounds();
    for (const i of shown) {
      const r = data.rows[i];
      b.add(r.lon, r.lat);
    }
    return b.get();
  }, [data, detail, district, khoroo, state, query, shown]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <p className="max-w-[420px] px-6 text-center text-[12.5px] leading-relaxed text-clay">
          {error}
        </p>
      </div>
    );
  }

  if (!data || !stats) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <Loader2 size={16} className="animate-spin text-ink-3" />
      </div>
    );
  }

  const activeCount =
    (district ? 1 : 0) + (khoroo ? 1 : 0) + (state ? 1 : 0) + (query ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        /* Хэлтсийн өгсөн нэр (2026-09-17) — табын шошготой ижил.
           Албан ёсны бүтэн нэр нь табын `full`-д хэвээр. */
        title="Шилэн барилга"
        activeCount={activeCount}
        onReset={() => {
          setDistrict(null);
          setKhoroo(null);
          setState(null);
          setPicked(null);
          setQuery("");
        }}
      >
        <FilterMenu
          label="Стикер"
          icon={Sticker}
          value={state}
          active={Boolean(state)}
          onClear={() => setState(null)}
          width={230}
        >
          <PickList items={byState} selected={state} onPick={setState} />
        </FilterMenu>

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
          />
        </FilterMenu>

        <FilterMenu
          label="Хороо"
          icon={MapPin}
          value={khoroo}
          active={Boolean(khoroo)}
          onClear={() => setKhoroo(null)}
          width={200}
        >
          <PickList
            items={byKhoroo}
            selected={khoroo}
            onPick={setKhoroo}
            searchable
          />
        </FilterMenu>
      </FilterBar>

      <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-line rounded-xs border border-line bg-paper-2 sm:grid-cols-4 sm:divide-y-0">
        {/* Судалгаанд хамрагдсан барилга ба тэдгээрийн хэдэд нь стикер
            наагдсан нь ХОЁР ӨӨР тоо — эхнийхийг нь "стикертэй" гэж
            нэрлэвэл 78 барилга бүгд стикертэй мэт болно */}
        <Stat
          icon={Building2}
          label="Хамрагдсан барилга"
          value={num(stats.n)}
        />
        <Stat
          icon={Sticker}
          label="Стикер байршуулсан"
          value={num(stats.stickered)}
        />
        <Stat
          icon={Target}
          label="Хамрах хүрээ, хувь"
          value={num(stats.share)}
        />
        <Stat
          icon={MapPin}
          label="Хамрагдсан дүүрэг"
          value={num(stats.districts)}
        />
      </div>

      <Columns
        layout="flex"
        id="stickers"
        left={320}
        right={300}
        className="min-h-0 flex-1"
      >
        {/* ---- ЗҮҮН: барилгын жагсаалт ---- */}
        <Card className="min-h-[180px] flex-1 xl:w-(--col-l) xl:flex-none">
          <Head title="Барилга">
            <span className="num text-[11.5px] text-ink-3">
              {num(shown.length)} / {num(data.rows.length)}
            </span>
          </Head>
          <div className="shrink-0 border-b border-line p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Барилгын нэр, хаягаар хайх…"
              className="h-7 w-full rounded-xs border border-line bg-paper px-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-line-2"
            />
          </div>
          <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {shown.map((i) => {
              const r = data.rows[i];
              const on = picked === r.oid;
              return (
                <button
                  key={r.oid}
                  onClick={() => setPicked(on ? null : r.oid)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-paper-hi",
                    on && "bg-data/10",
                  )}
                >
                  {/*
                    Стикерийн төлөв — ЦЭГЭЭР.

                    ⚠⚠ Урьд нь дөрвөлжин ХАЙРЦАГ (стикертэйд нь чагт)
                    байсныг хэрэглэгч "барилга унтраадаг асаадаг юм"
                    гэж ойлгосон (2026-09-17) — хайрцаг, чагт хоёр нь
                    хөтөч дээр УНТРААЛГА гэсэн утгатай дүрс бөгөөд
                    жагсаалтын мөрд сууж байхад товшигддог мэт
                    уншигдана. Гэтэл энэ нь ТӨЛӨВ заадаг, удирддаггүй.

                    Цэг нь хэзээ ч удирдлага мэт уншигдахгүй. Өнгө нь
                    газрын зургийн цэгтэй НЭГ эх сурвалжаас: стикертэй
                    бол `--water` (хийгдсэн), үгүй бол `--ochre`
                    (анхаарах), тэмдэглээгүй бол бүдэг.
                  */}
                  <span
                    aria-hidden
                    className={cn(
                      "mt-[5px] size-1.5 shrink-0 rounded-full",
                      r.sticker === true
                        ? "bg-water"
                        : r.sticker === false
                          ? "bg-ochre"
                          : "bg-line-2",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] leading-tight text-ink">
                      {r.name || "—"}
                    </span>
                    <span className="mt-1 block truncate text-[10.5px] leading-none text-ink-3">
                      {[r.district, r.khoroo].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[10.5px] leading-none text-ink-3">
                    {r.no}
                  </span>
                </button>
              );
            })}
            {shown.length === 0 ? (
              <p className="py-5 text-center text-[12px] text-ink-3">
                Тохирох барилга олдсонгүй
              </p>
            ) : null}
          </div>
        </Card>

        {/* ---- ГОЛ: газрын зураг ---- */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <Card className="relative min-h-[260px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/* Цэг 78 тул бөөгнөрүүлэхгүй — хотын төвд нягтарсан ч
                  тус бүр нь тодорхой барилга */}
              <PointMap
                points={data.points}
                visible={visible}
                labels={labels}
                pulse
                pulseColor={pulseColor}
                cluster={false}
                /*
                  ⚠ Сонголтыг ТЭМДЭГ ӨӨРӨӨ үүрнэ: `highlight` цагираг нь
                  зурагт (canvas) зурагддаг тул DOM тэмдэглэгээний АРД
                  дарагдана. Хоёуланг өгсөн нь санаатай — цагираг нь
                  ойртолтын үед зайнаас ч анзаарагдана.
                */
                pickedMark={picked}
                highlight={detail ? [detail.lon, detail.lat] : null}
                basemap={basemap}
                onSelect={(oid) => setPicked(picked === oid ? null : oid)}
                focus={focus}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {detail ? (
                <div className="elevated absolute bottom-2.5 left-2.5 z-10 w-[250px] rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
                  <div className="flex items-baseline justify-between gap-2 border-b border-line px-2.5 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] leading-none font-medium text-ink">
                      {detail.name || "—"}
                    </span>
                    <span className="num shrink-0 text-[10.5px] leading-none text-ink-3">
                      №{detail.no}
                    </span>
                  </div>
                  <dl className="space-y-1.5 px-2.5 py-2">
                    <Field k="Стикер" v={stateOf(detail.sticker)} />
                    <Field
                      k="Байршил"
                      v={[detail.district, detail.khoroo]
                        .filter(Boolean)
                        .join(", ")}
                    />
                    <Field k="Хаяг" v={detail.address} />
                  </dl>
                </div>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS Enterprise ·{" "}
            {num(data.rows.length)} барилга
          </p>
        </div>

        {/* ---- БАРУУН: хамралт, задаргаа ---- */}
        {/*
          ⚠ ГУРВАН ДИАГРАМ БҮГД ШАХСАН МӨРТЭЙ (хэрэглэгчийн хүсэлт,
          2026-09-17). Ердийн мөр ~51px тул гурван карт нийлээд
          1,100px болж, багана гүйлгүүртэй болдог байв. Шахсан үед
          708px — гүйлгэхгүйгээр багтана.

          Мөрийн тоо: стикерийн байдал 2 · дүүрэг 4 · хороо 10.
        */}
        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto xl:w-(--col-r) xl:shrink-0">
          <Card className="shrink-0">
            <Head title="Стикерийн байдал">
              <span className="text-[10.5px] text-ink-3">барилга</span>
            </Head>
            <div className="p-3">
              <RowChart data={byState} selected={state} onSelect={setState} dense />
            </div>
          </Card>

          <Card className="shrink-0">
            <Head title="Дүүргээр — стикертэй">
              <span className="text-[10.5px] text-ink-3">байршуулсан</span>
            </Head>
            <div className="p-3">
              <RowChart
                data={coverage}
                selected={district}
                onSelect={setDistrict}
                dense
              />
            </div>
          </Card>

          <Card className="min-h-[120px] flex-1">
            <Head title="Хороогоор">
              <span className="text-[10.5px] text-ink-3">барилга</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <RowChart
                data={byKhoroo}
                selected={khoroo}
                onSelect={setKhoroo}
                dense
              />
            </div>
          </Card>
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Стикерийн төлөвийн НЭР.
 *
 * ⚠ Бөглөгдөөгүй утга нь "байршуулаагүй" БИШ — гурав дахь төлөв.
 * Хоёрыг нэгтгэвэл судалгаа хийгдсэн ч тэмдэглэгдээгүй барилгыг
 * "стикергүй" гэж батлах болно.
 */
function stateOf(v: boolean | null): string {
  return v === true
    ? "Байршуулсан"
    : v === false
      ? "Байршуулаагүй"
      : "Тэмдэглээгүй";
}

function Field({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-[66px] shrink-0 text-[10px] tracking-[0.06em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-2">
        {v}
      </dd>
    </div>
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
  icon: typeof MapPin;
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
