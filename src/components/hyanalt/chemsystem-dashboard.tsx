"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Boxes,
  Building2,
  ChevronDown,
  ClipboardList,
  FlaskConical,
  Loader2,
  MapPin,
  Recycle,
  Search,
  Table2,
  Warehouse,
  X,
} from "lucide-react";
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
import { GROUP_LABEL, UNGROUPED, classifySubstance } from "@/lib/chemicals";
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
import type { LucideIcon } from "lucide-react";

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
   координат БҮРТГЭГДСЭН ч хаягтайгаа таарахгүй: бүгд Улаанбаатарын
   төвөөс медиан 2.8 км-ийн дотор багширсан байна. Ховдын хаягтай
   агуулахын цэг бодит Ховдоос 1,136 км, Говь-Алтайнх 815 км зөрнө.
   Зурагт буулгавал байхгүй зүйл харуулна тул жагсаалтад л үлдээнэ.
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
  /** Задарсан химийн бүлэг — нэг удаад нэг нь */
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  /** Атрибутын хүснэгт нээлттэй эсэх */
  const [table, setTable] = React.useState(false);
  /** Сонгосон дүүрэг (нийслэл) эсвэл аймаг (орон нутаг) */
  const [place, setPlace] = React.useState<string | null>(null);

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

  /*
    ⚠⚠ ДҮҮРГИЙН ШҮҮЛТҮҮР (хэрэглэгчийн хүсэлт, 2026-09-23: "Агуулахын
    дээр шинэ карт үүсгээд дүүргээр шүүдэг болго").

    ⚠ Түлхүүр нь ХАМРАХ ХҮРЭЭНЭЭС хамаарна: нийслэлд ДҮҮРЭГ
    (`place.district`), орон нутагт хаягийн эхний хэсэг буюу АЙМАГ.
    Орон нутгийн бичлэгт дүүрэг гэж байхгүй тул нэг түлхүүрээр
    хоёуланг нь барих боломжгүй.

    ⚠ Товчнуудын тоо нь ӨӨРИЙНХӨӨ хэмжээсийг АЛГАСЧ бодогдоно
    (хөндлөн шүүлтийн ерөнхий дүрэм): дүүрэг сонгосны дараа ч бусад
    дүүрэг тоотойгоо харагдана, эс тэгвээс өөр рүү шилжих арга алга
    болно. Бодисын шүүлт харин үйлчилнэ — тэр нь өөр тэнхлэг.
  */
  /* ⚠ Хаяг нь танигдаагүй бичлэг (бүртгэлд нэг — зөвхөн ААН-ийн нэр
     бичигдсэн) ямар ч товчинд ОРОХГҮЙ: эхний хэсгийг нь шууд авбал
     компанийн нэр дүүрэг мэт харагдана. */
  const placeKey = React.useCallback(
    (x: LocStat) =>
      x.place.district ||
      (x.place.inCity === false ? (x.loc.address.split(",")[0]?.trim() ?? "") : ""),
    [],
  );

  const places = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const x of inScope) {
      if (holdingLocs && !holdingLocs.has(x.loc.id)) continue;
      const k = placeKey(x);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "mn"));
  }, [inScope, holdingLocs, placeKey]);

  /* Хамрах хүрээ солигдоход сонгосон дүүрэг алга болвол шүүлт ДАМ
     цуцлагдана — эффектээр биш (`react-hooks/set-state-in-effect`) */
  const activePlace = place && places.some(([k]) => k === place) ? place : null;

  const shownLocs = React.useMemo(() => {
    const q = locQuery.trim().toLowerCase();
    return inScope.filter((s) => {
      if (holdingLocs && !holdingLocs.has(s.loc.id)) return false;
      if (activePlace && placeKey(s) !== activePlace) return false;
      if (!q) return true;
      return (
        (s.org?.name ?? "").toLowerCase().includes(q) ||
        s.loc.address.toLowerCase().includes(q) ||
        (s.org?.reg ?? "").includes(q)
      );
    });
  }, [inScope, locQuery, holdingLocs, activePlace, placeKey]);

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
          /*
            ⚠ Агуулах сонгосон үед мөрийн утга нь ТОО ХЭМЖЭЭ (кг, л) тул
            бүлгийн толгойд НЭГТГЭХГҮЙ — нэг мөр 15 сая тонн гэж бичигдсэн
            бүртгэл байдаг. Тиймээс энд тэг: бүлэг зөвхөн НЭРИЙН тоогоор
            хэмжигдэнэ.
          */
          locs: 0,
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
        /** Хэдэн агуулахад бүртгэгдсэн — бүлгийн толгойн нийлбэрт орно */
        locs: n,
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

  /*
    ⚠⚠ ТОВЬЁОГ ХИМИЙН БҮЛГЭЭР (хэрэглэгчийн хүсэлт, 2026-09-23:
    "Бодисын товьёог бүлэглэе"). 8,115 нэр нэг урсгалаар цуварч,
    хайхаас өөр замгүй байв — нэг агуулахад 1,060 бодис бүртгэгдсэн
    тохиолдол ч бий.

    ⚠ Бүлэглэлт нь `classifySubstance` — хяналтын нөгөө самбар
    (2023, 2024 оны гэрчилгээ) ТҮҮНИЙГ хэрэглэдэг тул хоёр товьёог
    ижил бүлгээр уншигдана. Дүрмийг ХОЁР ГАЗАР бичвэл эрт орой зөрнө.

    ⚠ `Бусад`, `Бичилт дутуу` хоёр ҮРГЭЛЖ ЭЦЭСТ (`UNGROUPED`) —
    үлдэгдлийн мөрийг дээр нь тавих нь ямар ч жагсаалтад буруу.
  */
  const chemGroups = React.useMemo(() => {
    const m = new Map<
      string,
      { id: string; label: string; rows: typeof chemRows; regs: number }
    >();
    for (const r of chemRows) {
      const id = groupOf(r.name);
      const e = m.get(id);
      if (e) {
        e.rows.push(r);
        e.regs += r.locs;
      } else {
        m.set(id, { id, label: GROUP_LABEL.get(id) ?? id, rows: [r], regs: r.locs });
      }
    }
    return [...m.values()];
  }, [chemRows]);

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
  const searching = !picked && chemQuery.trim().length > 0;
  /*
    Бүлгийн тоо: товьёогийн горимд БҮРТГЭЛИЙН тоо (мөр бүрийн
    "N агуулах"-ийн нийлбэр), агуулах сонгосон үед НЭРИЙН тоо — тэр
    горимд утга нь кг, литр тул нэгтгэхгүй.
  */
  const groupValue = (g: (typeof chemGroups)[number]) => (picked ? g.rows.length : g.regs);
  /*
    ⚠ ЭРЭМБЭ нь ХАРАГДАЖ БУЙ ТООГООР — зураасны урт нь мөн түүгээр
    хэмжигддэг тул нэрийн тоогоор эрэмбэлбэл богино зураас урт
    зурааснаасаа дээр суух үе гарна (Хүчил 1,451 бичилт нь Урвалж
    1,446-аас доош буудаг байв).
    ⚠ `Бусад`, `Бичилт дутуу` хоёр ҮРГЭЛЖ ЭЦЭСТ — үлдэгдлийн мөрийг
    дээр нь тавих нь ямар ч жагсаалтад буруу.
  */
  const sortedGroups = [...chemGroups].sort((a, b) => {
    const au = UNGROUPED.includes(a.id) ? 1 : 0;
    const bu = UNGROUPED.includes(b.id) ? 1 : 0;
    return au - bu || groupValue(b) - groupValue(a) || a.label.localeCompare(b.label, "mn");
  });
  /*
    ⚠⚠ ХАМРАХ ХҮРЭЭ СОЛИХОД ХҮСНЭГТ ХААГДАНА (хэрэглэгчийн шийдвэр,
    2026-09-23: "хүснэгт дараад орон нутаг дээр дарвал шууд орон
    нутаг db шилжинэ гэсэн үг, хүснэгт дотроо шүүгдэхгүйгээр").
    Хамрах хүрээ нь ХАРАГДАЦЫН сонголт: Улаанбаатар, Орон нутаг хоёр
    нь газрын зурагтай ба зураггүй хоёр өөр самбар. Хүснэгтийн дотор
    шүүгдэхэд хэрэглэгч "би хүрээгээ соллоо, гэтэл самбар нь хэвээр"
    гэсэн байдалд ордог байв.
  */
  const pickScope = (next: Scope) => {
    setScope(next);
    setTable(false);
  };

  /** Бодис сонгох — агуулахын сонголтыг цэвэрлэнэ (хоёул шүүдэг тул) */
  const pickChem = (id: number) => {
    setPickedChem(pickedChem === id ? null : id);
    setPickedLoc(null);
  };
  const pickedChemName = pickedChem == null ? null : ix.chem.get(pickedChem)?.name;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* ---------------- Хамрах хүрээ ---------------- */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xs border border-line bg-paper-2 px-2.5 py-1.5">
        <span className="eyebrow shrink-0">Хамрах хүрээ</span>

        {/*
          ⚠⚠ ХУУЧИН ТОВЧНУУД ХЭВЭЭР (хэрэглэгчийн шийдвэр, 2026-09-23:
          "бас хуучин design руу буцаа, хуучин гоё байсан"). Хоёр
          талыг нэг хүрээтэй хайрцагт суулгаж, идэвхтэйг нь
          дүүргэлттэй болгосон сэлгэгч туршигдаж БУЦААГДСАН.

          ⚠ Анхны гомдол нь ЗАГВАРЫНХ БИШ, ЗАН ТӨЛӨВИЙНХ байв: нэг
          мөрөнд хамрах хүрээ ба "Хүснэгт" хоёр ЗЭРЭГ тодорч байсан.
          Түүнийг `pickScope` шийдсэн — хүрээ солиход хүснэгт хаагдана.
        */}
        <Pill on={scope === "city"} onClick={() => pickScope("city")}>
          Улаанбаатар <span className="num opacity-60">{num(scopeCounts.city)}</span>
        </Pill>
        <Pill on={scope === "rural"} onClick={() => pickScope("rural")}>
          Орон нутаг <span className="num opacity-60">{num(scopeCounts.rural)}</span>
        </Pill>

        <span className="mx-0.5 h-4 w-px shrink-0 bg-line" aria-hidden />

        {/*
          ⚠ ХҮСНЭГТ нь ХАМРАХ ХҮРЭЭНИЙ СОНГОЛТ БИШ, ХАРАГДАЦ. Нэг
          мөрөнд суусан ч тусдаа бүлэг тул зураасаар тусгаарлав:
          Улаанбаатар/Орон нутаг хоёр нь харилцан үгүйсгэх шүүлт,
          энэ нь тэдгээрийн аль алинд нь үйлчилдэг сэлгэгч.
        */}
        <Pill on={table} onClick={() => setTable((v) => !v)}>
          <Table2 size={11} aria-hidden />
          Хүснэгт
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
      {/*
        ⚠⚠ ЗААЛТ БҮР ТУСДАА КАРТ (хэрэглэгчийн хүсэлт, 2026-09-23, цаг
        агаарын заалтын эгнээг жишээ болгон заав). Урьд нь таван нүд
        үсэн зураасаар (`gap-px bg-line`) тусгаарлагдсан НЭГ блок
        байсан. Эдгээр нь нэг жагсаалтын мөрүүд биш, тус тусдаа
        хэмжигдэхүүн тул тусад нь харагдах нь зөв — цаг агаарын
        самбартай нэг үндэслэл ({@link src/components/unelgee/weather.css}
        -ийн `.observation-metric`).
        ⚠ Гүнийг СҮҮДРЭЭР биш ДАВХАРГААР: эгнээний дэвсгэр нь `paper`
        (canvas), карт нь `paper-2` тул картууд өөрсдөө тодорно.
      */}
      {/*
        ⚠⚠ СҮҮЛИЙН БАГАНА АРАЙ ӨРГӨН (1.35fr). "Устгал, дахин
        боловсруулалт" нь таван тэнцүү баганад ХОЁР МӨР болж, картын
        өндрийг 14px-ээр нэмэгдүүлж байв (хэрэглэгч 2026-09-23:
        "индикаторын өндрийг багасгамаар байна"). Тэр ганц баганыг
        өргөсгөхөд бүх шошго НЭГ МӨРӨНД багтаж, доод өндрийн заавар ч
        хэрэггүй болно — тоонууд өөрсдөө эгнэнэ.
        ⚠ Цаг агаарын зургаан карт дээр энэ арга бүтэлгүйтсэн: тэнд
        УРТ нэр хоёр байсан тул аль нэгийг өргөсгөхөд нөгөө нь хоёр
        мөр болдог байв. Энд урт нэр ГАНЦ.
      */}
      {/*
        ⚠⚠ ХҮСНЭГТ НЭЭЛТТЭЙ ҮЕД ИНДИКАТОР НУУГДАНА (хэрэглэгчийн
        шийдвэр, 2026-09-23: "хүснэгт дээр дарвал indicator гарч ирэх
        шаардлагагүй"). Хүснэгт нь ШАЛГАХ хэрэгсэл — мөр бүрчлэн
        уншихад өндөр хэрэгтэй бөгөөд нэгтгэсэн таван тоо тэр ажилд
        юу ч нэмэхгүй. Цаг агаарын заалт ба урьдчилсан мэдээ
        ээлжилдэгтэй нэг зарчим.
      */}
      {table ? null : (
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-[repeat(4,1fr)_1.35fr]">
        <Cell icon={Building2} label="Аж ахуйн нэгж" value={num(totals.orgs)} />
        <Cell icon={Warehouse} label="Бүртгэлтэй агуулах" value={num(totals.locs)} />
        <Cell icon={FlaskConical} label="Бодисын нэр төрөл" value={num(totals.chems)} />
        <Cell icon={ClipboardList} label="Бүртгэлийн бичилт" value={num(totals.rows)} />
        <Cell
          icon={Recycle}
          label="Устгал, дахин боловсруулалт"
          value={num(data.disposals.length)}
        />
      </div>
      )}

      {table ? (
        <AttrTable
          rows={shownLocs}
          picked={pickedLoc}
          onPick={(id) => setPickedLoc(pickedLoc === id ? null : id)}
          note={pickedChemName ?? null}
        />
      ) : (
      <Columns id="chemsystem" left={300} right={296} className="min-h-0 flex-1">
        {/* ---------------- Дүүрэг ба агуулах ---------------- */}
        <div className="flex min-h-0 flex-col gap-2">
        <PlaceCard
          title={scope === "city" ? "Дүүргээр" : "Аймгаар"}
          rows={places}
          picked={activePlace}
          onPick={(k) => setPlace(activePlace === k ? null : k)}
        />
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
        </div>

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
            /*
              Координат нь БҮРТГЭГДСЭН ч хаягтайгаа таарахгүй: Ховдын
              хаягтай агуулахын цэг бодит Ховдоос 1,136 км зөрж, УБ-ын
              төвд буудаг. 93 бичлэгийн координат бүгд хотын төвөөс
              медиан 2.8 км-ийн дотор багширсан.

              "Байршил бүртгэгдээгүй" гэж бичих нь ХУДАЛ байв — тэднийг
              харуулахгүй байгаа шалтгаанаа товч, үнэн зөв хэлнэ.
            */
            <div className="hatch flex h-full items-center justify-center px-6">
              <p className="max-w-[320px] text-center text-[12px] leading-snug text-ink-3">
                Бүртгэсэн координат нь хаягтайгаа таарахгүй тул газрын зурагт
                харуулаагүй
              </p>
            </div>
          )}
        </div>

        {/* ---------------- Бодис ---------------- */}
        <Panel
          title={picked ? "Агуулахад бүртгэгдсэн бодис" : "Бодисын товьёог"}
          count={chemRows.length}
          cards={!searching}
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
          {/*
            Хайлт идэвхтэй үед бүлгүүд ЗАДАРНА: хэрэглэгч нэрийнхээ
            бүлгийг мэдэхгүй байж болох тул илэрцийг хавтгай
            жагсаалтаар харуулж, мөр бүр бүлгээ хажуудаа бичнэ.
          */}
          {searching
            ? chemRows.map((r, i) => (
                <Row
                  key={`${r.id}-${i}`}
                  on={pickedChem === r.id}
                  onClick={() => pickChem(r.id)}
                  title={r.name}
                  note={GROUP_LABEL.get(groupOf(r.name))}
                  value={r.right}
                  unit="агуулах"
                />
              ))
            : sortedGroups.map((g) => (
                <GroupBlock
                  key={g.id}
                  label={g.label}
                  note={picked ? undefined : `${num(g.rows.length)} нэр`}
                  value={num(groupValue(g))}
                  unit={picked ? "нэр" : "бичилт"}
                  open={openGroup === g.id}
                  onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)}
                >
                  {g.rows.map((r, i) => (
                    <NameRow
                      key={`${r.id}-${i}`}
                      on={pickedChem === r.id}
                      onClick={() => pickChem(r.id)}
                      name={r.name}
                      value={r.right}
                      unit={picked ? "" : "агуулах"}
                    />
                  ))}
                </GroupBlock>
              ))}
        </Panel>
      </Columns>
      )}

      <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
        Эх сурвалж: {data.source.system} · Суурь зураг: Esri
      </p>
    </div>
  );
}

/**
 * Байршлын диаграм — агуулахын жагсаалтын ДЭЭР.
 *
 * ⚠⚠ ТОВЧНЫ ОРОНД ДИАГРАМ (хэрэглэгчийн хүсэлт, 2026-09-23:
 * "Дүүргээр serial chart харуулъя"). Товчнууд нэр, тоо хоёрыг л
 * хэлдэг байсан бол зурвас нь ХАРЬЦААГ нэмж хэлнэ.
 *
 * ⚠⚠ МӨР НЬ НЭГ ЭГНЭЭ (хэрэглэгчийн хүсэлт, 2026-09-23: "Дүүргээр
 * картын өндрийг багасгах боломж бий юу"). `RowChart dense` нь нэрийг
 * дээр нь, зурвасыг доор нь тавьдаг тул мөр ~31px болж, найман дүүрэг
 * 280px эзэлдэг байв. Нэр, зурвас, тоо гурвыг ЗЭРЭГЦҮҮЛЭХЭД мөр
 * ~21px — карт **190px** болж багасна.
 *
 * ⚠ Ингэснээр `RowChart`-аас САЛСАН: тэр бүрэлдэхүүн нэрээ мөрийн
 * дээр тавьдаг бөгөөд тэр байрлалыг проп-оор өөрчлөх боломжгүй.
 * Зурвасны утга, сонголтын зан төлөв нь адилхан хэвээр.
 *
 * ⚠ Нэрийн багана ТОГТМОЛ өргөнтэй (92px): зурваснууд НЭГ эгнээнээс
 * эхлэхгүй бол урт нь харьцуулагдахаа болино.
 *
 * ⚠ ӨНГӨ нь ГАНЦ (`--tone`): дүүрэг бол нэрлэсэн ангилал, эрэмбэтэй
 * хэмжүүр БИШ тул мөр бүрийг өөр өнгөөр ялгавал утгагүй солонго
 * болно. Ялгаа нь уртаараа гарна.
 */
function PlaceCard({
  title,
  rows,
  picked,
  onPick,
}: {
  title: string;
  rows: [string, number][];
  picked: string | null;
  onPick: (key: string) => void;
}) {
  const max = Math.max(...rows.map(([, n]) => n), 1);
  if (rows.length < 2) return null;
  return (
    <div className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
      <div className="flex items-baseline gap-2 border-b border-line px-2.5 py-1.5">
        <span className="eyebrow min-w-0 flex-1 truncate">{title}</span>
        {picked ? (
          <button
            onClick={() => onPick(picked)}
            className="shrink-0 text-[10px] text-(--tone) transition-colors hover:text-ink"
          >
            Цэвэрлэх
          </button>
        ) : (
          <span className="num shrink-0 text-[10px] text-ink-3">
            {num(rows.length)}
          </span>
        )}
      </div>
      {/* Агуулга нь картаасаа урт бол картынхаа ДОТОР гүйнэ (22 аймаг)
          — багана өөрөө хөдлөхгүй */}
      <div className="max-h-[186px] overflow-y-auto py-1">
        {rows.map(([key, n]) => {
          const on = picked === key;
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              aria-pressed={on}
              title={`${key} · ${num(n)}`}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-[3px] text-left transition-colors",
                on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
                picked && !on && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "w-[92px] shrink-0 truncate text-[11px]",
                  on ? "font-medium text-ink" : "text-ink-2",
                )}
              >
                {key}
              </span>
              <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-paper-hi">
                <span
                  className="block h-full rounded-full bg-(--tone)"
                  style={{ width: `${Math.max((n / max) * 100, 2)}%` }}
                />
              </span>
              <span className="num w-[30px] shrink-0 text-right text-[11px] text-ink-2">
                {num(n)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   АТРИБУТЫН ХҮСНЭГТ

   ⚠⚠ ХЭРЭГЛЭГЧ ДАТАГ ӨӨРӨӨ ШАЛГАХ ЗАМ (хүсэлт, 2026-09-23: "хүснэгт
   гэж нээж байгаад үүн дээр дарахаар attribute шиг хардаг болгоё,
   тэгээд би өөрөө нэг шалгая" → "хоосон ч хамаагүй бүх column буюу
   field надад хэрэгтэй, би харж байгаад хүмүүс нь бөглүүрэй гээд
   хэлэх гээд байна").

   ⚠⚠ БАГАНА нь КОДОД БИЧИГДЭЭГҮЙ, ДАТАНААС уншигдана. Хормын
   хувилбарт шинэ талбар нэмэгдэхэд багана нь ӨӨРӨӨ гарч ирнэ —
   бүртгэлийг гараар шинэчлэх шаардлагагүй. Танил талбар нь монгол
   нэртэй, танихгүй нь ТҮҮХИЙ нэрээрээ гарна: тэр нэр нь эх
   сурвалжийн талбарын нэр тул хэлтэстэй ярихад шууд хэрэглэгдэнэ.

   ⚠ Толгойн ХОЁР ДАХЬ МӨР нь талбарын ТҮҮХИЙ нэр (`cas`, `reg`).
   "Энэ баганыг бөглөөрэй" гэж хэлэхэд аль талбарыг заахыг нь
   хүснэгт өөрөө хэлнэ.

   ⚠⚠ ХӨНДЛӨН ГҮЙЛТ ЗӨВШӨӨРӨГДӨНӨ — биотехникийн хүснэгтийн "хэзээ ч
   хөндлөн гүйхгүй" дүрмийн ҮЛ ХАМААРАХ ЗҮЙЛ. Тэр нь долоон багана
   бүхий ТАЙЛАН, энэ нь атрибутын хүснэгт: багана нь эх сурвалжаас
   хамаарч өсдөг тул бүгдийг нь дэлгэцийн өргөнд шахвал нэг ч багана
   уншигдахгүй болно. Дэлгэц дээр бүтэн харагдах ёстой зүйл нь
   ЖАГСААЛТ (зүүн багана), энэ нь шалгах хэрэгсэл.

   ⚠ ХООСОН НҮД НУУГДАХГҮЙ: "—" гэж ил гарна. Хоосон байгаа нь өөрөө
   энэ хүснэгтийн гол мэдээлэл.
   -------------------------------------------------------------------------- */

/**
 * ⚠⚠ ХОРМЫН ХУВИЛБАРТ ОРООГҮЙ ч эх сурвалжид БАЙДАГ талбарууд
 * (хэрэглэгчийн хүсэлт, 2026-09-23: "хүснэгт бас л дутуу байна,
 * хоосон ч хамаагүй харуулаад").
 *
 * Цагаан жагсаалт нь зөвхөн утгатай талбарыг түүдэг тул 100% хоосон
 * талбар файлд хүрдэггүй — улмаас багана нь ч гарахгүй. Гэтэл "ийм
 * талбар байдаг ч хоосон" гэдэг нь яг тэр мэдээлэл юм: хэлтэс
 * бөглөх ёстой зүйлээ эндээс хардаг.
 *
 * ⚠ Эдгээрийн бөглөлтийг 2026-09-11-нд ТҮЛХҮҮРТЭЙ хэмжсэн: бүгд
 * 0/520 буюу 0/8,117. Таамаглаж бичээгүй.
 * ⚠ Хормын хувилбар шинэчлэгдэхэд утга нь орж ирвэл багана нь
 * ДАТАНААС өөрөө гарах тул энэ жагсаалтаас хасагдана (давхардвал
 * `cols` нь нэг л удаа нэмнэ).
 */
const EXPECTED: { key: string; raw: string }[] = [
  { key: "types", raw: "types" },
  { key: "office_latitude", raw: "office_latitude" },
  { key: "org.cert", raw: "certificate_number" },
  { key: "org.types", raw: "types" },
];

/**
 * ⚠ НИЙТЭД ГАРГААГҮЙ талбарууд — API-д байдаг ч хормын хувилбарт
 * ХЭЗЭЭ Ч орохгүй. Сайт нийтэд нээлттэй тул иргэний холбоо барих
 * мэдээлэл, үнэмлэхний дугаар тэнд байрлах ёсгүй. Нэрийг нь
 * хүснэгтийн хөлд бичих нь задрал биш — хэлтэст "энэ талбарыг бид
 * татдаггүй" гэдгийг хэлж өгнө.
 */
const WITHHELD = ["phone", "email", "identity_card_number", "users"];

/**
 * Хадгалсан түлхүүр → эх сурвалжийн ЖИНХЭНЭ талбарын нэр.
 *
 * ⚠ Толгойд API-гийн нэр гарах ёстой: "энэ баганыг бөглөөрэй" гэж
 * хэлэхэд хэлтэс өөрийн системээсээ тэр нэрээр хайна. Бидний
 * богиносгосон нэр (`reg`, `lat`) тэнд утгагүй.
 */
const API_NAMES: Record<string, string> = {
  org: "organization_id",
  lat: "latitude",
  lon: "longitude",
  reg: "reg_number",
  cert: "certificate_number",
  cas: "cas_number",
};

/** Танил талбарын монгол нэр. Жагсаалтад байхгүй бол түүхий нэр гарна */
const FIELD_LABELS: Record<string, string> = {
  id: "Дугаар",
  org: "ААН-ийн дугаар",
  name: "Агуулахын нэр",
  address: "Хаяг",
  lat: "Өргөрөг",
  lon: "Уртраг",
  types: "Агуулахын төрөл",
  office_latitude: "Оффисын өргөрөг",
  "org.name": "Аж ахуйн нэгж",
  "org.reg": "Улсын бүртгэл",
  "org.cert": "Гэрчилгээний дугаар",
  "org.address": "ААН-ийн хаяг",
  "org.types": "ААН-ийн төрөл",
};

/** Эх сурвалжид байхгүй, бидний ТООЦСОН багана */
const DERIVED: { key: string; label: string; of: (s: LocStat) => string }[] = [
  {
    key: "дүүрэг",
    label: "Дүүрэг",
    of: (s) => s.place.district || (s.place.inCity === false ? "Орон нутаг" : ""),
  },
  { key: "бодис", label: "Бодисын нэр төрөл", of: (s) => num(s.chemicals) },
  { key: "бичилт", label: "Бүртгэлийн бичилт", of: (s) => num(s.rows.length) },
];

/** Нүдний утгыг бичвэр болгоно. Хоосон бол хоосон мөр — "—" нь дүрслэлд */
function cellText(v: unknown): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "number") return Number.isInteger(v) ? num(v) : v.toFixed(6);
  return String(v);
}

function AttrTable({
  rows,
  picked,
  onPick,
  note,
}: {
  rows: LocStat[];
  picked: number | null;
  onPick: (id: number) => void;
  /** Идэвхтэй бодисын шүүлт — хүснэгт түүнийг дагана */
  note: string | null;
}) {
  /*
    Багануудыг ДАТАНААС цуглуулна: агуулахын талбарууд, дараа нь
    аж ахуйн нэгжийнх (`org.` угтвартай), эцэст нь тооцсон багана.
    Мөр бүрийг шалгана — талбар нь зарим бичлэгт л байж болно.
  */
  const cols = React.useMemo(() => {
    const loc = new Set<string>();
    const org = new Set<string>();
    for (const s of rows) {
      for (const k of Object.keys(s.loc)) loc.add(k);
      if (s.org) for (const k of Object.keys(s.org)) org.add(k);
    }
    /* ААН-ийн `id` нь агуулахын `org` талбартай давхардана */
    org.delete("id");
    const out: { key: string; raw: string; label?: string; of: (s: LocStat) => string }[] = [
      ...[...loc].map((k) => ({
        key: k,
        raw: API_NAMES[k] ?? k,
        of: (s: LocStat) => cellText((s.loc as unknown as Record<string, unknown>)[k]),
      })),
      ...[...org].map((k) => ({
        key: `org.${k}`,
        raw: API_NAMES[k] ?? k,
        of: (s: LocStat) => cellText((s.org as unknown as Record<string, unknown> | undefined)?.[k]),
      })),
    ];

    /* Датанд байхгүй ч эх сурвалжид байдаг талбарууд — хоосон багана */
    const have = new Set(out.map((c) => c.key));
    for (const e of EXPECTED) {
      if (!have.has(e.key)) out.push({ key: e.key, raw: e.raw, of: () => "" });
    }

    return [
      ...out,
      ...DERIVED.map((d) => ({ key: d.key, raw: "тооцсон", label: d.label, of: d.of })),
    ];
  }, [rows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xs border border-line bg-paper-2">
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line px-2.5 py-1.5">
        <span className="eyebrow shrink-0">Агуулахын бүртгэл</span>
        <span className="num shrink-0 text-[10px] text-ink-3">
          {num(rows.length)} мөр · {num(cols.length)} талбар
        </span>
        {note ? (
          <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-3">
            Шүүлт: {note}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-paper-3">
            <tr className="border-b border-line text-left align-bottom text-ink-3">
              {cols.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="max-w-[260px] min-w-[86px] px-2 py-1.5 font-normal"
                >
                  <span className="block text-[9.5px] leading-tight tracking-[0.06em] text-ink-2 uppercase">
                    {c.label ?? FIELD_LABELS[c.key] ?? c.raw}
                  </span>
                  <span className="num block text-[9px] leading-tight text-ink-3 lowercase">
                    {c.raw}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr
                key={s.loc.id}
                onClick={() => onPick(s.loc.id)}
                className={cn(
                  "cursor-pointer align-top transition-colors",
                  picked === s.loc.id ? "bg-(--tone)/10" : "hover:bg-paper-hi",
                )}
              >
                {cols.map((c) => {
                  const v = c.of(s);
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "max-w-[260px] min-w-[86px] px-2 py-1.5",
                        v ? "text-ink-2" : "text-ink-3",
                      )}
                    >
                      {v || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <div className="hatch m-3 rounded-xs border border-dashed border-line-2 px-3 py-6 text-center text-[11.5px] text-ink-3">
            Тохирох бичлэг олдсонгүй
          </div>
        ) : null}
      </div>

      {/* ⚠ Хаагдсан талбарыг НЭРЛЭХ нь задрал биш: утга нь файлд
          ороогүй гэдгийг хэлтэст мэдэгдэх ганц зам */}
      <div className="shrink-0 border-t border-line px-2.5 py-1.5 text-[10px] leading-snug text-ink-3">
        Нийтэд гаргаагүй талбар:{" "}
        <span className="num text-ink-2">{WITHHELD.join(", ")}</span>
      </div>
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
  cards,
  children,
}: {
  title: string;
  count: number;
  /** `null` бол хайлтын мөр гарахгүй */
  search: string | null;
  onSearch: (v: string) => void;
  placeholder: string;
  head?: React.ReactNode;
  /** Мөрүүд нь зураасаар биш КАРТААР тусгаарлагдана (товьёогийн бүлгүүд) */
  cards?: boolean;
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
        <ul
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            cards ? "py-0.5" : "divide-y divide-line",
          )}
        >
          {children}
        </ul>
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
/**
 * Индикаторын карт.
 *
 * ⚠⚠ ЦАГ АГААРЫН ЗААЛТЫН ХЭВЭЭР (хэрэглэгчийн хүсэлт, 2026-09-23,
 * зургаар жишээ өгсөн): ШОШГО нь картын дээр ГОЛЛОЖ, доор нь тэмдэг
 * ба тоо хоёр зэрэгцэнэ. Урьд нь шошго, тоо хоёр зүүн ирмэгт
 * баганалж, тэмдэг нь тэдний зүүн талд сууж байв.
 *
 * ⚠ ШОШГО ХОЁР МӨРИЙН ДООД ӨНДӨРТЭЙ (`min-h-[29px]`): "Устгал, дахин
 * боловсруулалт" нь нүдэндээ ганц мөрөөр багтахгүй (185px нүдэнд
 * 240px шаардана — хөтчөөр хэмжсэн). Доод өндөр нь таван тоог НЭГ
 * шугамд эгнүүлнэ; шошго гурван мөр болвол өндрийг дагуулж засна, эс
 * тэгвээс тэр карт ганцаараа өндөрсөж эгнээ зөрнө.
 *
 * ⚠ Тэмдгийн өнгө нь хэлтсийн `--tone` — заалтын утгаас гардаг цаг
 * агаарынхаас ялгаатай. Эдгээр нь шатлалгүй ТООЛОЛ тул утгаар будвал
 * өнгө нь юу ч заахгүй чимэглэл болно.
 */
function Cell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xs border border-line bg-paper-2 px-2 py-1.5">
      {/* ⚠ Мөрийн өндрийг 1.2 болгож, доод өндрийг 24px болгосон нь
          картыг ~12px намсгав (хэрэглэгчийн хүсэлт, 2026-09-23:
          "индикаторын өндрийг багасгамаар байна"). Хоёр мөрийн
          ДООД ӨНДӨР ХЭВЭЭР — таван тоо нэг шугамд эгнэх ёстой */}
      <div className="eyebrow text-center">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <Icon size={22} strokeWidth={1.4} className="shrink-0 text-(--tone)" aria-hidden />
        <span className="num text-[18px] leading-none font-semibold text-ink">{value}</span>
      </div>
    </div>
  );
}

/**
 * Нэрийг химийн бүлэгт хуваана. `classifySubstance` нь тийн ялгал,
 * таслагдсан бичилт зэргийг шалгадаг тул нэг нэрийг ДАХИН тооцохгүй —
 * товьёог 8,115 мөртэй, хамрах хүрээ солигдох бүрд дахин бүлэглэгдэнэ.
 */
const GROUP_CACHE = new Map<string, string>();
function groupOf(name: string): string {
  const hit = GROUP_CACHE.get(name);
  if (hit) return hit;
  const g = classifySubstance(name);
  GROUP_CACHE.set(name, g);
  return g;
}

/**
 * Товьёогийн бүлгийн мөр ба задарсан нэрс.
 *
 * ⚠⚠ ХЭМЖИГЧИЙН ЗУРААС ХАСАГДСАН (хэрэглэгчийн шийдвэр, 2026-09-23:
 * "Бодисын товьёог энд баганан чарт хэрэггүй юм байна"). Товьёог нь
 * ЖАГСААЛТ — хайж олох, задлах зам бөгөөд бүлгүүдийн харьцааг
 * зурагладаг диаграм БИШ. Тоонууд нь өөрсдөө эрэмбэлэгдсэн тул
 * зураас нэмэлт мэдээлэл өгөхгүй, зөвхөн мөрийг өндөрсгөж байв.
 * Дахин бүү нэм.
 */
function GroupBlock({
  label,
  note,
  value,
  unit,
  open,
  onClick,
  children,
}: {
  label: string;
  /** Нэрийн тоо — "· 1,321 нэр" */
  note?: string;
  value: string;
  unit: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="px-1.5 py-1">
      <div
        className={cn(
          "rounded-md border px-1.5 py-1.5 transition-colors",
          open ? "border-(--tone)/45 bg-paper-3" : "border-line bg-paper-2 hover:border-line-2",
        )}
      >
        <button onClick={onClick} aria-expanded={open} className="block w-full text-left">
          <div className="flex items-baseline gap-1.5">
            <ChevronDown
              size={12}
              strokeWidth={2}
              aria-hidden
              className={cn(
                "shrink-0 translate-y-[2px] transition-transform",
                open ? "text-(--tone)" : "-rotate-90 text-ink-3",
              )}
            />
            <span className="min-w-0 flex-1 text-[12px] leading-snug font-medium text-ink">
              {label}
              {note ? (
                <span className="ml-1.5 text-[10px] font-normal whitespace-nowrap text-ink-3">
                  · {note}
                </span>
              ) : null}
            </span>
            <span className="num shrink-0 text-[11.5px] text-ink-2">{value}</span>
            <span className="shrink-0 text-[10px] text-ink-3">{unit}</span>
          </div>
        </button>

        {open ? (
          <div className="mt-1.5 ml-[18px] divide-y divide-line border-l border-line-2">
            {children}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Задарсан бүлэг доторх бодисын мөр */
function NameRow({
  on,
  onClick,
  name,
  value,
  unit,
}: {
  on: boolean;
  onClick: () => void;
  name: string;
  value: string;
  unit?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative block w-full px-2.5 py-1.5 text-left transition-colors",
        on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
      )}
    >
      {on ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)" />
      ) : null}
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "line-clamp-2 min-w-0 flex-1 text-[11px] leading-snug text-ink-2",
            on && "font-medium text-ink",
          )}
          title={name}
        >
          {name}
        </span>
        <span className="num shrink-0 pt-[1px] text-[10.5px] leading-snug text-ink-2">
          {value}
          {unit ? <span className="ml-1 text-ink-3">{unit}</span> : null}
        </span>
      </div>
    </button>
  );
}
