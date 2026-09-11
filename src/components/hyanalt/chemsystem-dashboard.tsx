"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Boxes, Loader2, MapPin, Search, X } from "lucide-react";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { Columns } from "@/components/ui/resizable-columns";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import { DATA_COLOR } from "@/components/wells/colors";
import {
  buildIndex,
  fetchChemSystem,
  massText,
  volumeText,
  type ChemSystem,
  type Index,
  type LocStat,
} from "@/lib/chemsystem";
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
   ХИМИЙН БОДИСЫН ҮНДЭСНИЙ БҮРТГЭЛ (HazTrack)

   ЭНЭ НЬ ХОЁР ТАЛТ СҮЛЖЭЭ: 520 агуулах ↔ 8,114 бодис, хооронд нь 22,093
   эзэмшил. Тиймээс ХОЁР ЖАГСААЛТ ЗЭРЭГ харагдана — зүүнд агуулах,
   баруунд бодис — бөгөөд нэг нь нөгөөгөө шүүнэ.

   ⚠ ГОРИМ СОЛИХ ТОВЧ БАЙСНЫГ ХАСАВ. Нэг жагсаалтыг нөгөөгөөр нь
   солиход баруун талын самбар хоосон зураастай блок болж, дэлгэцийн
   гуравны нэг үрэгддэг байв; мөн хоёр талын холбоо (аль нь алийг
   шүүж байна) харагдахаа больдог. Одоо хоёулаа үргэлж дүүрэн бөгөөд
   ИЖИЛ бүтэцтэй (`Panel`) — ижил харагдах нь хамаарлыг өөрөө хэлнэ.

   ⚠ ГАЗРЫН ЗУРАГТ ЗӨВХӨН НИЙСЛЭЛИЙНХ. Орон нутгийн хаягтай 93 агуулахын
   координат нь Улаанбаатарын төвд бөөгнөрсөн анхдагч утга тул зурагт
   буулгавал байхгүй зүйл харуулна. Тэдгээр нь жагсаалтад хэвээр.
   -------------------------------------------------------------------------- */

type Scope = "city" | "rural";

export function ChemSystemDashboard() {
  const [data, setData] = React.useState<ChemSystem | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [scope, setScope] = React.useState<Scope>("city");
  const [locQuery, setLocQuery] = React.useState("");
  const [chemQuery, setChemQuery] = React.useState("");
  const [pickedLoc, setPickedLoc] = React.useState<number | null>(null);
  const [pickedChem, setPickedChem] = React.useState<number | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  const tip = useMapTip();
  const [listHover, setListHover] = React.useState<number | null>(null);

  React.useEffect(() => {
    const ac = new AbortController();
    fetchChemSystem(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const ix = React.useMemo<Index | null>(() => (data ? buildIndex(data) : null), [data]);

  /** Хамрах хүрээ — ХАЯГААС, координатаас БИШ */
  const inScope = React.useMemo(() => {
    if (!ix) return [];
    return ix.stats.filter((s) =>
      scope === "city" ? s.place.inCity !== false : s.place.inCity === false,
    );
  }, [ix, scope]);

  /** Сонгосон бодисыг хадгалдаг агуулахууд */
  const holdingLocs = React.useMemo(() => {
    if (!data || pickedChem == null) return null;
    const h = data.holdings;
    const out = new Set<number>();
    for (let i = 0; i < h.chem.length; i++) if (h.chem[i] === pickedChem) out.add(h.loc[i]);
    return out;
  }, [data, pickedChem]);

  const shownLocs = React.useMemo(() => {
    const q = locQuery.trim().toLowerCase();
    return inScope.filter((s) => {
      if (holdingLocs && !holdingLocs.has(s.loc.id)) return false;
      if (!q) return true;
      return (
        (s.org?.name ?? "").toLowerCase().includes(q) ||
        s.loc.address.toLowerCase().includes(q) ||
        (s.org?.reg ?? "").includes(q)
      );
    });
  }, [inScope, locQuery, holdingLocs]);

  /**
   * Баруун талын жагсаалт.
   *
   * Агуулах сонгогдсон бол ТЭР агуулахын бодисууд тоо хэмжээтэйгээ,
   * эс бөгөөс харагдаж буй хүрээний товьёог (хэдэн агуулахад
   * бүртгэгдсэнээр нь эрэмбэлсэн).
   */
  const chemRows = React.useMemo(() => {
    if (!data || !ix) return [];
    const h = data.holdings;

    if (pickedLoc != null) {
      const s = ix.stats.find((x) => x.loc.id === pickedLoc);
      if (!s) return [];
      return s.rows
        .map((i) => ({
          id: h.chem[i],
          name: ix.chem.get(h.chem[i])?.name ?? "Тодорхойгүй",
          right: ix.volumeRows.has(i)
            ? volumeText(ix.mlOf.get(i) ?? 0)
            : massText(h.grams[i]),
          sort: h.grams[i],
        }))
        .sort((a, b) => b.sort - a.sort || a.name.localeCompare(b.name, "mn"));
    }

    const keep = new Set(shownLocs.map((x) => x.loc.id));
    const count = new Map<number, number>();
    for (let i = 0; i < h.loc.length; i++) {
      if (!keep.has(h.loc[i])) continue;
      count.set(h.chem[i], (count.get(h.chem[i]) ?? 0) + 1);
    }
    const q = chemQuery.trim().toLowerCase();
    return [...count]
      .map(([id, n]) => ({
        id,
        name: ix.chem.get(id)?.name ?? "Тодорхойгүй",
        right: num(n),
        sort: n,
      }))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => b.sort - a.sort || a.name.localeCompare(b.name, "mn"));
  }, [data, ix, shownLocs, pickedLoc, chemQuery]);

  /* ---------------- Газрын зураг ---------------- */

  /* Зурагт ЗӨВХӨН нийслэлийнх — орон нутгийнхны координат нь орлуулга */
  const mapped = React.useMemo(
    () => (scope === "city" ? shownLocs : []),
    [shownLocs, scope],
  );

  const points = React.useMemo<MapPoints>(
    () => ({
      oid: mapped.map((s) => s.loc.id),
      lon: mapped.map((s) => s.loc.lon),
      lat: mapped.map((s) => s.loc.lat),
    }),
    [mapped],
  );

  const visible = React.useMemo(() => Uint32Array.from(mapped.map((_, i) => i)), [mapped]);

  /*
    Цэгийн ХЭМЖЭЭ = бүртгэгдсэн бодисын нэрийн тоо, ЛОГАРИФМ хуваарьтай
    (дундаж 43, дээд 1,114 тул шугаман дээр нэг агуулах бүхнийг дардаг).
    Өнгө нь ганц `--data`: энэ нь ангилал биш хэмжээ тул шатлалын хоёр
    үзүүрт нэг өнгө өгч, `firefly`-гаар бусад зурагтай ижил төрхтэй.
  */
  const grades = React.useMemo(
    () => ({
      values: mapped.map((s) => Math.log10(Math.max(1, s.chemicals))),
      stops: [
        [0, DATA_COLOR],
        [Math.log10(1200), DATA_COLOR],
      ] as [number, string][],
      firefly: true,
    }),
    [mapped],
  );

  const focus = React.useMemo<Extent | null>(() => {
    const s = pickedLoc == null ? null : mapped.find((x) => x.loc.id === pickedLoc);
    if (!s) return null;
    const d = 0.008;
    return [s.loc.lon - d, s.loc.lat - d, s.loc.lon + d, s.loc.lat + d];
  }, [mapped, pickedLoc]);

  const hovered = React.useMemo(
    () => (tip.oid == null ? null : (ix?.stats.find((s) => s.loc.id === tip.oid) ?? null)),
    [ix, tip.oid],
  );

  const spot = React.useMemo(() => {
    const id = tip.oid ?? listHover;
    return id == null ? null : (ix?.stats.find((s) => s.loc.id === id) ?? null);
  }, [ix, tip.oid, listHover]);

  /* ---------------- Нэгтгэл ---------------- */

  const totals = React.useMemo(() => {
    if (!data) return { orgs: 0, locs: 0, chems: 0, rows: 0 };
    const keep = new Set(shownLocs.map((x) => x.loc.id));
    const orgs = new Set<number>();
    const chems = new Set<number>();
    const h = data.holdings;
    let rows = 0;
    for (let i = 0; i < h.loc.length; i++) {
      if (!keep.has(h.loc[i])) continue;
      rows++;
      chems.add(h.chem[i]);
    }
    for (const x of shownLocs) if (x.org) orgs.add(x.org.id);
    return { orgs: orgs.size, locs: shownLocs.length, chems: chems.size, rows };
  }, [data, shownLocs]);

  const scopeCounts = React.useMemo(() => {
    if (!ix) return { city: 0, rural: 0 };
    let city = 0;
    let rural = 0;
    for (const s of ix.stats) {
      if (s.place.inCity === false) rural++;
      else city++;
    }
    return { city, rural };
  }, [ix]);

  if (error || !data || !ix) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">Химийн бүртгэл татагдсангүй</p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Химийн бодисын бүртгэл татаж байна…
          </span>
        )}
      </div>
    );
  }

  const picked = pickedLoc == null ? null : ix.stats.find((s) => s.loc.id === pickedLoc);
  const pickedChemName = pickedChem == null ? null : ix.chem.get(pickedChem)?.name;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* ---------------- Хамрах хүрээ ---------------- */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xs border border-line bg-paper-2 px-2.5 py-1.5">
        <span className="eyebrow shrink-0">Хамрах хүрээ</span>
        <Pill on={scope === "city"} onClick={() => setScope("city")}>
          Улаанбаатар <span className="num opacity-60">{num(scopeCounts.city)}</span>
        </Pill>
        <Pill on={scope === "rural"} onClick={() => setScope("rural")}>
          Орон нутаг <span className="num opacity-60">{num(scopeCounts.rural)}</span>
        </Pill>

        {pickedChemName ? (
          <button
            onClick={() => setPickedChem(null)}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xs border border-(--tone)/45 bg-(--tone)/10 px-2 py-1 text-[11px] leading-none text-(--tone)"
          >
            <span className="max-w-[300px] truncate">{pickedChemName}</span>
            <X size={11} />
          </button>
        ) : null}
      </div>

      {/* ---------------- Индикатор ---------------- */}
      <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xs border border-line bg-line sm:grid-cols-3 xl:grid-cols-5">
        <Cell label="Аж ахуйн нэгж" value={num(totals.orgs)} />
        <Cell label="Бүртгэлтэй агуулах" value={num(totals.locs)} />
        <Cell label="Бодисын нэр төрөл" value={num(totals.chems)} />
        <Cell label="Бүртгэлийн бичилт" value={num(totals.rows)} />
        <Cell label="Устгал, дахин боловсруулалт" value={num(data.disposals.length)} />
      </div>

      <Columns id="chemsystem" left={300} right={296} className="min-h-0 flex-1">
        {/* ---------------- Агуулах ---------------- */}
        <Panel
          title="Агуулах"
          count={shownLocs.length}
          search={locQuery}
          onSearch={setLocQuery}
          placeholder="Нэр, хаяг, регистр"
        >
          {shownLocs.map((s) => (
            <Row
              key={s.loc.id}
              on={pickedLoc === s.loc.id}
              onClick={() => setPickedLoc(pickedLoc === s.loc.id ? null : s.loc.id)}
              onEnter={() => setListHover(s.loc.id)}
              onLeave={() => setListHover(null)}
              title={s.org?.name || s.loc.name}
              note={noteOf(s)}
              value={num(s.chemicals)}
              unit="бодис"
            />
          ))}
        </Panel>

        {/* ---------------- Газрын зураг ---------------- */}
        <div className="relative min-h-[280px] overflow-hidden rounded-xs border border-line bg-paper-2">
          {mapped.length ? (
            <>
              <PointMap
                points={points}
                visible={visible}
                basemap={basemap}
                onSelect={(oid) => setPickedLoc(pickedLoc === oid ? null : oid)}
                onHover={tip.onHover}
                focus={focus}
                highlight={spot ? [spot.loc.lon, spot.loc.lat] : null}
                clusterMaxZoom={13}
                grades={grades}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} placement="top-left" />

              {hovered ? (
                <MapTip state={tip}>
                  <div className="space-y-1 px-2.5 py-2">
                    <MapTipRow icon={MapPin} text={hovered.org?.name || hovered.loc.name} />
                    <MapTipRow
                      icon={Boxes}
                      text={`${num(hovered.chemicals)} нэр төрлийн бодис`}
                      num
                    />
                  </div>
                </MapTip>
              ) : null}
            </>
          ) : (
            /* Орон нутгийн бичлэгийн координат нь орлуулга тул зурагт
               буулгахгүй. Хоосон төлөв нь дизайны нэг хэсэг */
            <div className="hatch flex h-full items-center justify-center px-6">
              <p className="max-w-[300px] text-center text-[12px] leading-snug text-ink-3">
                Орон нутгийн агуулахын байршил бүртгэгдээгүй байна
              </p>
            </div>
          )}
        </div>

        {/* ---------------- Бодис ---------------- */}
        <Panel
          title={picked ? "Агуулахад бүртгэгдсэн бодис" : "Бодисын товьёог"}
          count={chemRows.length}
          search={picked ? null : chemQuery}
          onSearch={setChemQuery}
          placeholder="Бодисын нэр"
          head={
            picked ? (
              <div className="shrink-0 border-b border-line px-2.5 py-2">
                <div className="text-[12px] leading-snug font-medium text-ink">
                  {picked.org?.name || picked.loc.name}
                </div>
                <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                  {picked.loc.address}
                </div>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-[10px]">
                  {picked.org?.reg ? (
                    <span className="num text-ink-3">Регистр {picked.org.reg}</span>
                  ) : null}
                  <button
                    onClick={() => setPickedLoc(null)}
                    className="text-(--tone) transition-colors hover:text-ink"
                  >
                    Товьёог руу буцах
                  </button>
                </div>
              </div>
            ) : null
          }
        >
          {chemRows.map((r, i) => (
            <Row
              key={`${r.id}-${i}`}
              on={pickedChem === r.id}
              onClick={() => {
                setPickedChem(pickedChem === r.id ? null : r.id);
                setPickedLoc(null);
              }}
              title={r.name}
              value={r.right}
              unit={picked ? "" : "агуулах"}
            />
          ))}
        </Panel>
      </Columns>

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Эх сурвалж: {data.source.system} · Суурь зураг: Esri
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Мөрийн дэд бичиг.
 *
 * Бүтэн хаягийг тавихгүй: "УБ, Баянгол, 5-р хороо, Энхтайваны өргөн
 * чөлөө…" гэсэн мөр 300px-д хэзээ ч багтахгүй бөгөөд бүгд ижил үгээр
 * эхэлдэг тул тасархай хэсэг нь ялгах мэдээлэл өгөхгүй. Дүүрэг нь л
 * жагсаалтад хэрэгтэй; бүтэн хаяг сонгосон үед баруун талд гарна.
 */
function noteOf(s: LocStat): string {
  if (s.place.district) return `${s.place.district} дүүрэг`;
  if (s.place.inCity === false) return s.loc.address.split(",")[0]?.trim() || "Орон нутаг";
  return "Улаанбаатар";
}

/**
 * Баганын хайрцаг — толгой, хайлт, гүйдэг жагсаалт.
 *
 * Зүүн ба баруун багана ИЖИЛ бүтэцтэй: хоёулаа "нэр + тоо" гэсэн
 * мөрүүдийн жагсаалт тул тусад нь бичих шаардлагагүй бөгөөд ижил
 * харагдах нь хоёрын хамаарлыг өөрөө хэлнэ.
 */
function Panel({
  title,
  count,
  search,
  onSearch,
  placeholder,
  head,
  children,
}: {
  title: string;
  count: number;
  /** `null` бол хайлтын мөр гарахгүй */
  search: string | null;
  onSearch: (v: string) => void;
  placeholder: string;
  head?: React.ReactNode;
  children: React.ReactNode;
}) {
  const empty = React.Children.count(children) === 0;
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xs border border-line bg-paper-2">
      <div className="flex shrink-0 items-baseline gap-2 border-b border-line px-2.5 py-1.5">
        <span className="eyebrow min-w-0 flex-1 truncate">{title}</span>
        <span className="num shrink-0 text-[10px] text-ink-3">{num(count)}</span>
      </div>

      {head}

      {search != null ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1.5">
          <Search size={12} className="shrink-0 text-ink-3" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
      ) : null}

      {empty ? (
        <div className="hatch m-3 rounded-xs border border-dashed border-line-2 px-3 py-6 text-center text-[11.5px] text-ink-3">
          Тохирох бичлэг олдсонгүй
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">{children}</ul>
      )}
    </div>
  );
}

/**
 * Жагсаалтын нэг мөр.
 *
 * Нэр нь ХОЁР МӨРӨНД буудаг: аж ахуйн нэгжийн нэр урт бөгөөд нэг
 * мөрөнд таславал "Дундговь аймгийн мэргэжлийн хян…" гэж бүгд ижил
 * эхэлсэн, ялгагдахгүй мөрүүд болно.
 *
 * Хэмжигчийн зураас БАЙХГҮЙ: тоо нь баруун талдаа аль хэдийн
 * бичигдсэн байхад зураас нэмэлт мэдээлэл өгөхгүй, зөвхөн чимэг болно.
 */
function Row({
  on,
  onClick,
  onEnter,
  onLeave,
  title,
  note,
  value,
  unit,
}: {
  on: boolean;
  onClick: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  title: string;
  note?: string;
  value: string;
  unit?: string;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className={cn(
          "relative block w-full px-2.5 py-2 text-left transition-colors",
          on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
        )}
      >
        {on ? (
          <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)" />
        ) : null}

        <div className="flex items-start gap-2">
          <span
            className={cn(
              "line-clamp-2 min-w-0 flex-1 text-[11.5px] leading-snug text-ink",
              on && "font-medium",
            )}
            title={title}
          >
            {title}
          </span>
          <span className="num shrink-0 pt-[1px] text-[11px] leading-snug text-ink-2">
            {value}
          </span>
        </div>

        {note || unit ? (
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[10px] leading-snug text-ink-3">
              {note}
            </span>
            {unit ? (
              <span className="shrink-0 text-[9.5px] leading-snug text-ink-3">{unit}</span>
            ) : null}
          </div>
        ) : null}
      </button>
    </li>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-1 text-[11px] leading-none transition-colors",
        on
          ? "border-(--tone)/45 bg-(--tone)/10 text-(--tone)"
          : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Индикаторын нүд. Зурвас НИМГЭН байх ёстой тул тоо нь 18px */
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-2 px-3 py-1.5">
      <div className="eyebrow truncate">{label}</div>
      <div className="num mt-0.5 text-[18px] leading-none font-medium text-ink">{value}</div>
    </div>
  );
}
