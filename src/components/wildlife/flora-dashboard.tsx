"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Compass,
  Leaf,
  Loader2,
  MapPin,
  Sprout,
  X,
} from "lucide-react";
import {
  GroupedRowChart,
  RowChart,
  type Datum,
  type DatumGroup,
} from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapPanel, useMapPanel } from "@/components/map/panel";
import { DATA_COLOR } from "@/components/wells/colors";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap } from "@/components/wells/map";
import { Columns } from "@/components/ui/resizable-columns";
import { fetchFlora, FLORA, type FloraData, type FloraKind } from "@/lib/flora";
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
 * Хөвд, мөөгний самбар — ХАГИЙНХТАЙ нэг хэвээр.
 *
 * Гурван судалгаа нэг асуултад хариулна: "аль цэгт ямар зүйл
 * бүртгэгдсэн бэ". Тиймээс бүтэц нь ч ижил (хэрэглэгчийн шийдвэр,
 * 2026-09-16) — зүүн талд төрөл → зүйлийн жагсаалт, төвд цэгүүд,
 * баруун талд задаргаа. Энэ нь "самбар бүр өөр бүтэцтэй" дүрмийн
 * ЗОРИУДЫН үл хамаарах зүйл: ах дүү гурван сэдэв ялгаатай харагдвал
 * харьцуулах боломжгүй болно.
 *
 * ⚠ **ХАГТАЙ ЯГ АДИЛ БИШ.** Хагт зүйл бүр өөрийн мөртэй (овог, IUCN
 * зэрэг, экологийн бүлэг, индикатор бүгд бий); энд зүйлүүд нь ЦЭГИЙН
 * нүдэнд жагсаагдсан бөгөөд зүйлийн тухай нэмэлт шинж ОГТ БАЙХГҮЙ.
 * Тиймээс ховордол, экологийн бүлгийн диаграм энд гарахгүй — байхгүй
 * баганыг зурах гэж оролдохгүй. Оронд нь эх сурвалжид байгаа зүйл:
 * дүүрэг, хороо, (мөөг дээр) өндөршил, бүс.
 *
 * ⚠ Хоёр судалгааны НЭГЖ ӨӨР: хөвд дээр мөр бүр судалгааны талбай,
 * мөөг дээр нэг ОЛДВОРЫН цэг (нэг талбайд хэд хэд байж болно). Тиймээс
 * үзүүлэлтийн шошго нь бүртгэлээс гарна (`FLORA[kind].unit`), кодод
 * бичигдээгүй.
 */
export function FloraDashboard({ kind }: { kind: FloraKind }) {
  const [data, setData] = React.useState<FloraData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [genus, setGenus] = React.useState<string | null>(null);
  const [species, setSpecies] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [khoroo, setKhoroo] = React.useState<string | null>(null);
  const [zone, setZone] = React.useState<string | null>(null);
  /** Газрын зураг дээр товшсон цэгийн код */
  const [spot, setSpot] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const [basemap, setBasemap] = React.useState<Basemap>(() => defaultBasemap());
  const panel = useMapPanel("right");
  /*
    ⚠ ХОЁР ХӨВӨГЧ САМБАР, тус бүр ӨӨРИЙН төлөвтэй. Нэгийг хуваалцвал
    хоёр цонх нэг байрлал, нэг хэмжээ барих тул хоёуланг нь зэрэг
    нээхэд бие бие рүүгээ шилжинэ. Бариулын тал нь ч эсрэг: цэгийнх
    баруун дээд буланд, зүйлийнх зүүн доод буланд бэхлэгдэнэ.
  */
  const speciesPanel = useMapPanel("left");

  const meta = FLORA[kind];

  /*
    ⚠ Судалгаа солиход төлөвийг ЭНД цэвэрлэхгүй: дуудагч тал самбарыг
    `key`-ээр ДАХИН ҮҮСГЭДЭГ тул `kind` нь амьдралынхаа турш
    өөрчлөгдөхгүй. Эффектийн биед `setState` дуудвал шаталсан
    зурагдалт үүсэх бөгөөд `react-hooks/set-state-in-effect` үүнийг
    зөвшөөрдөггүй.
  */
  React.useEffect(() => {
    const ac = new AbortController();

    fetchFlora(kind, ac.signal)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ac.abort();
  }, [kind]);

  /**
   * Цэгийн дугаар → код.
   *
   * ⚠ Газрын зураг `onSelect`-д ДУГААР (`oid`) дамжуулдаг болохоос
   * индекс биш. Дугаарыг индекс гэж үзвэл нэг ч мөр устсан давхарга
   * дээр буруу цэг сонгогдоно — толиор нь хайх нь тэрнээс хамгаална.
   */
  const codeOfOid = React.useMemo(() => {
    const m = new Map<number, string>();
    for (const s of data?.spots ?? []) m.set(s.oid, s.code);
    return m;
  }, [data]);

  /** Зүйл → төрөл. Задаргаа, шүүлт хоёр НЭГ эх сурвалжаас */
  const genusOf = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data?.species ?? []) m.set(s.name, s.genus);
    return m;
  }, [data]);

  /*
    ХАРАГДАХ ЦЭГҮҮД.

    ⚠ Зүйлийн шүүлт нь ЦЭГИЙГ хасна, харин дүүрэг, хорооны шүүлт ч мөн
    адил — гэхдээ хоёр нь ӨӨР зүйлийг хэлнэ: эхнийх нь "энэ зүйл
    хаана байна", хоёр дахь нь "энэ дүүрэгт юу байна". Хоёулаа
    нэгэн зэрэг тавигдвал огтлолцлыг харуулна.
  */
  const shown = React.useMemo(() => {
    const out: number[] = [];
    (data?.spots ?? []).forEach((s, i) => {
      if (district && s.district !== district) return;
      if (khoroo && s.khoroo !== khoroo) return;
      if (zone && s.zone !== zone) return;
      if (species && !s.species.includes(species)) return;
      if (genus && !s.species.some((n) => genusOf.get(n) === genus)) return;
      if (spot && s.code !== spot) return;
      out.push(i);
    });
    return out;
  }, [data, district, khoroo, zone, species, genus, spot, genusOf]);

  const visible = React.useMemo(() => Uint32Array.from(shown), [shown]);

  /*
    Цэгийн ХЭМЖЭЭ нь тэнд бүртгэгдсэн зүйлийн тоог хэлнэ.

    Өнгө нь бүх цэгт ИЖИЛ (`DATA_COLOR`) — зэрэглэлийн хоёр үзүүрт нэг
    өнгө өгснөөр зөвхөн радиус нь хэмжигдэхүүнийг үүрнэ. Хагийн
    самбартай яг нэг зарчим.

    ⚠ Зүйл бүртгэгдээгүй цэг ч (хөвд дээр 30-аас 13) ХАРАГДАНА:
    судалгаа тэнд хийгдсэн гэдэг нь өөрөө мэдээлэл бөгөөд хасвал
    хамрах хүрээ байгаагаас бага мэт болно.
  */
  const grades = React.useMemo(() => {
    if (!data) return undefined;
    const values = Float32Array.from(data.spots, (s) => s.species.length);
    let hi = 0;
    for (const v of values) if (v > hi) hi = v;
    return {
      values,
      stops: [
        [0, DATA_COLOR],
        [Math.max(hi, 1), DATA_COLOR],
      ] as [number, string][],
    };
  }, [data]);

  /* Цэгийн шошго — байршлын нэр */
  const labels = React.useMemo(() => {
    if (!data) return undefined;
    return { text: data.spots.map((s) => s.name), minzoom: 9 };
  }, [data]);

  /* ---------------- Задаргаа ----------------

     Диаграм бүр өөрийнхөө хэмжигдэхүүнийг АЛГАСЧ шүүгдэнэ — эс тэгвээс
     сонгосон утга л үлдэж, өөр юу байж болохыг харуулахаа болино. */

  const tally = React.useCallback(
    (
      of: (i: number) => string | null,
      skip: "district" | "khoroo" | "zone",
    ): Datum[] => {
      if (!data) return [];
      const counts = new Map<string, number>();
      data.spots.forEach((s, i) => {
        if (skip !== "district" && district && s.district !== district) return;
        if (skip !== "khoroo" && khoroo && s.khoroo !== khoroo) return;
        if (skip !== "zone" && zone && s.zone !== zone) return;
        if (species && !s.species.includes(species)) return;
        if (genus && !s.species.some((n) => genusOf.get(n) === genus)) return;
        const key = of(i);
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, label: key, value }));
    },
    [data, district, khoroo, zone, species, genus, genusOf],
  );

  const byDistrict = React.useMemo(
    () => tally((i) => data?.spots[i].district ?? null, "district"),
    [tally, data],
  );
  const byKhoroo = React.useMemo(
    () => tally((i) => data?.spots[i].khoroo || null, "khoroo"),
    [tally, data],
  );
  const byZone = React.useMemo(
    () => tally((i) => data?.spots[i].zone || null, "zone"),
    [tally, data],
  );

  /*
    ӨНДӨРШЛИЙН МУЖ (зөвхөн мөөг).

    Түүхий метрийг ангилал болговол 42 цэг 40 гаруй мужид тарна.
    Тиймээс 200 метрийн муж болгон бүлэглэнэ — мужийн НЭР нь тоон
    хязгаараа өөрөө хэлдэг тул нэршил зохиох шаардлагагүй.
  */
  const byElev = React.useMemo<Datum[]>(() => {
    if (!data) return [];
    const counts = new Map<number, number>();
    for (const i of shown) {
      const e = data.spots[i].elev;
      if (e == null) continue;
      const band = Math.floor(e / 200) * 200;
      counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([band, value]) => ({
        key: String(band),
        label: `${num(band)}–${num(band + 200)} м`,
        value,
      }));
  }, [data, shown]);

  /*
    ЗҮҮН БАГАНЫН ЖАГСААЛТ — төрөл → зүйл.

    ⚠ Тоо нь ЦЭГИЙН тоо: нэг зүйл хэдэн цэгт тааралдсаныг хэлнэ.
    "Бичлэгийн тоо" гэж нэрлэвэл буруу болно — эх сурвалжид зүйл тус
    бүрийн мөр байхгүй.

    ⚠ Хайлт нь ЗҮЙЛИЙГ шүүнэ; төрөл нь зүйлээ бүрэн алдвал өөрөө
    жагсаалтаас унана.
  */
  const tree = React.useMemo<DatumGroup[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const perSpecies = new Map<string, number>();
    for (const i of shown) {
      for (const n of data.spots[i].species) {
        perSpecies.set(n, (perSpecies.get(n) ?? 0) + 1);
      }
    }
    const groups = new Map<string, Datum[]>();
    for (const s of data.species) {
      if (q && !s.name.toLowerCase().includes(q)) continue;
      const value = perSpecies.get(s.name) ?? 0;
      const rows = groups.get(s.genus) ?? [];
      rows.push({ key: s.name, label: s.name, value });
      groups.set(s.genus, rows);
    }
    return [...groups.entries()]
      .map(([key, rows]) => ({
        key,
        label: key,
        total: rows.reduce((t, r) => t + r.value, 0),
        rows: rows.sort(
          (a, b) => b.value - a.value || a.label.localeCompare(b.label),
        ),
      }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [data, shown, query]);

  const stats = React.useMemo(() => {
    if (!data) return null;
    const kinds = new Set<string>();
    const genera = new Set<string>();
    for (const i of shown) {
      for (const n of data.spots[i].species) {
        kinds.add(n);
        const g = genusOf.get(n);
        if (g) genera.add(g);
      }
    }
    return { spots: shown.length, species: kinds.size, genera: genera.size };
  }, [data, shown, genusOf]);

  /*
    СОНГОСОН ЗҮЙЛИЙН ХУРААНГУЙ.

    ⚠ Хагаас ЯЛГААТАЙ нь эдгээр давхаргад зүйлийн тухай НЭМЭЛТ ШИНЖ
    (овог, ховордол, амьдрах орчин) ОГТ БАЙХГҮЙ — зөвхөн нэр нь л
    бий. Тиймээс цонх нь тодорхойлолт БИШ: тэр зүйл ХААНА, ХЭДЭН цэгт
    тааралдсаныг хэлнэ. Байхгүй талбарыг зурах гэж оролдохгүй.

    ⚠ Хавсралт: хоёр давхарга `hasAttachments: true` боловч
    2026-09-16-ны байдлаар зураг НЭГ Ч БАЙХГҮЙ. Зураг орж ирвэл
    хагийнхтай ижил аргаар нэмнэ ([lib/lichen-photos.ts](src/lib/lichen-photos.ts)).
  */
  const speciesCard = React.useMemo(() => {
    if (!data || !species) return null;

    const at = data.spots.filter((s) => s.species.includes(species));
    if (at.length === 0) return null;

    const districts = [...new Set(at.map((s) => s.district))].filter(Boolean);
    const elevs = at
      .map((s) => s.elev)
      .filter((e): e is number => typeof e === "number");
    const dates = [...new Set(at.map((s) => s.found).filter(Boolean))].sort();

    return {
      genus: genusOf.get(species) ?? "",
      spots: at,
      districts,
      /* Өндөршил зөвхөн мөөгний давхаргад бий */
      elev: elevs.length
        ? { lo: Math.min(...elevs), hi: Math.max(...elevs) }
        : null,
      dates,
    };
  }, [data, species, genusOf]);

  /** Товшсон цэгийн дэлгэрэнгүй */
  const detail = React.useMemo(() => {
    if (!data || !spot) return null;
    return data.spots.find((s) => s.code === spot) ?? null;
  }, [data, spot]);

  const activeCount =
    (genus ? 1 : 0) +
    (species ? 1 : 0) +
    (district ? 1 : 0) +
    (khoroo ? 1 : 0) +
    (zone ? 1 : 0) +
    (spot ? 1 : 0);

  function reset() {
    setGenus(null);
    setSpecies(null);
    setDistrict(null);
    setKhoroo(null);
    setZone(null);
    setSpot(null);
  }

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar title={meta.title} activeCount={activeCount} onReset={reset}>
        <FilterMenu
          label="Төрөл"
          icon={Sprout}
          value={genus}
          active={Boolean(genus)}
          onClear={() => setGenus(null)}
          width={240}
        >
          <PickList
            items={tree.map((g) => ({
              key: g.key,
              label: g.label,
              value: g.total,
            }))}
            selected={genus}
            onPick={(k) => setGenus(genus === k ? null : k)}
            searchable
          />
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
          <PickList items={byKhoroo} selected={khoroo} onPick={setKhoroo} />
        </FilterMenu>

        {/* Бүс нь ЗӨВХӨН мөөг дээр — хөвдний давхаргад тэр багана байхгүй */}
        {byZone.length > 1 ? (
          <FilterMenu
            label="Бүс"
            icon={Compass}
            value={zone}
            active={Boolean(zone)}
            onClear={() => setZone(null)}
            width={220}
          >
            <PickList items={byZone} selected={zone} onPick={setZone} />
          </FilterMenu>
        ) : null}

        {/* Сонгосон зүйл нь цэснээс биш ЖАГСААЛТААС ирдэг тул өөрийн
            цуцлах товчтой — эс тэгвээс буцах арга нь зөвхөн жагсаалтыг
            гүйлгэж олох болно */}
        {species ? (
          <button
            onClick={() => setSpecies(null)}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-xs border border-data/45 bg-data/10 px-2.5 text-[11.5px] text-ink transition-colors hover:bg-data/15"
          >
            <Leaf size={12} className="shrink-0 text-data" />
            <span className="max-w-[220px] truncate italic">{species}</span>
            <X size={12} className="shrink-0 text-ink-3" />
          </button>
        ) : null}
      </FilterBar>

      <Columns
        layout="flex"
        id={`flora-${kind}`}
        left={320}
        right={300}
        className="min-h-0 flex-1"
      >
        {/* ---- ЗҮҮН: төрөл → зүйл ---- */}
        <Card className="min-h-[180px] flex-1 xl:w-(--col-l) xl:flex-none">
          <Head title="Төрөл, зүйл">
            <span className="num text-[11.5px] text-ink-3">
              {num(tree.length)} төрөл · {num(data.species.length)} зүйл
            </span>
          </Head>
          <div className="shrink-0 border-b border-line p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Латин нэрээр хайх…"
              className="h-7 w-full rounded-xs border border-line bg-paper px-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-line-2"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tree.length > 0 ? (
              <GroupedRowChart
                groups={tree}
                selected={species}
                onSelect={setSpecies}
                selectedGroup={genus}
                onSelectGroup={setGenus}
                /* Төрөл олон тул хураасан байдлаар нээгдэнэ */
                defaultOpen="none"
                storageKey={`flora.${kind}.genus`}
              />
            ) : (
              <p className="py-5 text-center text-[12px] text-ink-3">
                Тохирох зүйл олдсонгүй
              </p>
            )}
          </div>
        </Card>

        {/* ---- ГОЛ: газрын зураг ---- */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <Card className="relative min-h-[260px] flex-1 overflow-hidden">
            <div className="relative h-full w-full">
              {/* Цэг цөөхөн (30 ба 55) тул бөөгнөрүүлэхгүй */}
              <PointMap
                points={data.points}
                visible={visible}
                labels={labels}
                grades={grades}
                /* Хагийн самбартай ижил — хиймэл дагуулын өтгөн өнгөн
                   дээр жижиг цэг төдийлөн ялгарахгүй байв */
                pulse
                cluster={false}
                basemap={basemap}
                onSelect={(oid) => {
                  const code = codeOfOid.get(oid) ?? null;
                  setSpot(spot === code ? null : code);
                }}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {detail ? (
                <MapPanel
                  state={panel}
                  title="Бүртгэлийн цэг"
                  onClose={() => setSpot(null)}
                  className="top-2.5 right-2.5 max-h-[70%] w-[290px]"
                >
                  <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                    <p className="text-[12.5px] leading-snug font-medium text-ink">
                      {detail.name}
                    </p>
                    <dl className="mt-2.5 space-y-1.5">
                      <Field k="Код" v={detail.code} />
                      <Field
                        k="Байршил"
                        v={[detail.district, detail.khoroo]
                          .filter(Boolean)
                          .join(", ")}
                      />
                      {detail.elev != null ? (
                        <Field k="Өндөршил" v={`${num(detail.elev)} м`} />
                      ) : null}
                      {detail.found ? (
                        <Field k="Олдсон огноо" v={detail.found} />
                      ) : null}
                      {detail.zone ? <Field k="Бүс" v={detail.zone} /> : null}
                    </dl>

                    <div className="mt-3 border-t border-line pt-2.5">
                      <span className="eyebrow block">
                        Бүртгэгдсэн зүйл · {num(detail.species.length)}
                      </span>
                      {detail.species.length ? (
                        <ul className="mt-1.5 space-y-1">
                          {detail.species.map((n) => (
                            <li key={n}>
                              <button
                                onClick={() =>
                                  setSpecies(species === n ? null : n)
                                }
                                className={cn(
                                  "block w-full truncate text-left text-[11.5px] leading-snug italic transition-colors hover:text-ink",
                                  species === n ? "text-data" : "text-ink-2",
                                )}
                              >
                                {n}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[11.5px] text-ink-3">
                          Зүйл бүртгэгдээгүй байна
                        </p>
                      )}
                    </div>
                  </div>
                </MapPanel>
              ) : null}

              {/*
                СОНГОСОН ЗҮЙЛ — зургийн зүүн доод буланд.

                Цэгийн цонх баруун дээд буланд суудаг тул хоёулаа
                зэрэг нээгдэхэд давхцахгүй. Хагийн самбартай ижил
                зарчим: зүүн талын жагсаалтаас зүйл сонгоход тэр
                зүйлийн хураангуй зургийн дээр хөвнө.
              */}
              {speciesCard ? (
                <MapPanel
                  state={speciesPanel}
                  title="Сонгосон зүйл"
                  onClose={() => setSpecies(null)}
                  className="bottom-2.5 left-2.5 max-h-[70%] w-[260px]"
                >
                  <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                    <p className="text-[13px] leading-snug text-ink italic">
                      {species}
                    </p>
                    {speciesCard.genus ? (
                      <p className="mt-0.5 text-[10.5px] text-ink-3">
                        Төрөл · {speciesCard.genus}
                      </p>
                    ) : null}

                    <dl className="mt-2 space-y-1.5 border-t border-line pt-2">
                      <Field
                        k="Тааралдсан"
                        v={`${num(speciesCard.spots.length)} ${meta.unit}`}
                      />
                      <Field k="Дүүрэг" v={speciesCard.districts.join(", ")} />
                      {speciesCard.elev ? (
                        <Field
                          k="Өндөршил"
                          v={
                            speciesCard.elev.lo === speciesCard.elev.hi
                              ? `${num(speciesCard.elev.lo)} м`
                              : `${num(speciesCard.elev.lo)}–${num(speciesCard.elev.hi)} м`
                          }
                        />
                      ) : null}
                      {speciesCard.dates.length ? (
                        <Field
                          k="Олдсон огноо"
                          v={speciesCard.dates.join(", ")}
                        />
                      ) : null}
                    </dl>

                    {/*
                      ХААНА тааралддаг вэ — энэ цонхны гол агуулга.
                      Цэг товшиход зураг тийш нь тодорно.
                    */}
                    <div className="mt-2 border-t border-line pt-2">
                      <div className="eyebrow mb-1.5">Бүртгэгдсэн цэг</div>
                      <div className="flex flex-wrap gap-1">
                        {speciesCard.spots.map((sp) => (
                          <button
                            key={sp.code}
                            onClick={() =>
                              setSpot(spot === sp.code ? null : sp.code)
                            }
                            title={sp.name}
                            className={cn(
                              "rounded-xs border px-1.5 py-[2px] text-[10.5px] transition-colors",
                              spot === sp.code
                                ? "border-data/45 bg-data/12 text-data"
                                : "border-line text-ink-2 hover:bg-paper-hi hover:text-ink",
                            )}
                          >
                            {sp.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </MapPanel>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS Enterprise ·{" "}
            {num(data.spots.length)} {meta.unit}
            {data.mismatched > 0
              ? ` · ${num(data.mismatched)} мөрийн зүйлийн жагсаалт эх сурвалжийн тоотой зөрж байна`
              : ""}
          </p>
        </div>

        {/* ---- БАРУУН: үзүүлэлт ба задаргаа ---- */}
        <div className="flex min-h-0 flex-col gap-2.5 xl:w-(--col-r) xl:shrink-0">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Stat icon={Leaf} label="Зүйл" value={num(stats.species)} />
              <Stat icon={Sprout} label="Төрөл" value={num(stats.genera)} />
              <Stat
                icon={MapPin}
                label={meta.unit[0].toUpperCase() + meta.unit.slice(1)}
                value={num(stats.spots)}
              />
              <Stat
                icon={Building2}
                label="Хамрагдсан дүүрэг"
                value={num(byDistrict.length)}
              />
            </div>
          </Card>

          <Card className={byElev.length ? "shrink-0" : "min-h-[120px] flex-1"}>
            <Head title="Дүүргээр">
              <span className="text-[10.5px] text-ink-3">{meta.unit}</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <RowChart
                data={byDistrict}
                selected={district}
                onSelect={setDistrict}
              />
            </div>
          </Card>

          {/* Өндөршил нь ЗӨВХӨН мөөгний давхаргад бий */}
          {byElev.length ? (
            <Card className="min-h-[120px] flex-1">
              <Head title="Өндөршлөөр">
                <span className="text-[10.5px] text-ink-3">{meta.unit}</span>
              </Head>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart data={byElev} />
              </div>
            </Card>
          ) : (
            <Card className="min-h-[120px] flex-1">
              <Head title="Хороогоор">
                <span className="text-[10.5px] text-ink-3">{meta.unit}</span>
              </Head>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <RowChart
                  data={byKhoroo}
                  selected={khoroo}
                  onSelect={setKhoroo}
                />
              </div>
            </Card>
          )}
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Field({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-[86px] shrink-0 text-[10px] tracking-[0.06em] text-ink-3 uppercase">
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
  icon: typeof Leaf;
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
