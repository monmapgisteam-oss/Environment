"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  CalendarClock,
  ChevronRight,
  FlaskConical,
  GripHorizontal,
  Loader2,
  MousePointerClick,
  Package,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";
import { BasemapGallery } from "@/components/map/basemap-gallery";
import { MapTip, MapTipRow, useMapTip } from "@/components/map/hover-tip";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { DATA_COLOR } from "@/components/wells/colors";
import { Columns } from "@/components/ui/resizable-columns";
import {
  defaultBasemap,
  type Basemap,
  type Extent,
  type MapPoints,
} from "@/components/wells/map";
import {
  CHEMICAL_YEARS,
  EXPIRY_STATES,
  RIGHTS,
  RIGHT_LABEL,
  GROUP_LABEL,
  QTY_UNIT_LABEL,
  SUBSTANCE_GROUPS,
  UNGROUPED,
  classifySubstance,
  expiryState,
  fetchChemicals,
  type ChemicalData,
  type ChemicalYear,
  type ExpiryState,
  type Warehouse,
} from "@/lib/chemicals";
import { districtName } from "@/lib/repair-shops";
import { Bounds } from "@/lib/extent";
import { cn, num } from "@/lib/utils";

const PointMap = dynamic(() => import("@/components/wells/map").then((m) => m.WellsMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-paper-3">
      <Loader2 size={16} className="animate-spin text-ink-3" />
    </div>
  ),
});

const NO_POINTS: MapPoints = { oid: [], lon: [], lat: [] };
const NO_INDEX = new Uint32Array(0);

/*
  ХУГАЦАА ДУУССАН гэрчилгээний тэмдэглэгээ.

  Цэгийн ХЭМЖЭЭ нь тоо хэмжээг (тонн) үүрдэг тул хүчинтэй байдлыг мөн
  тэндээс уншуулах боломжгүй — нэг сувагт хоёр хэмжигдэхүүн багтахгүй.
  Тиймээс энэ нь дүрслэл биш ТЭМДЭГЛЭЛ: хугацаа нь дууссан цэгийн дээр
  анхааруулах тэмдэг нэмнэ. Тоо нь цөөн (2023 онд 20, 2024 онд 3) тул
  зураг бөглөрөхгүй.
*/
const EXPIRED_PIN =
  '<svg data-pin="expired" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
  '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

/* --------------------------------------------------------------------------
   Химийн хорт, аюултай бодисын агуулах

   БУСАД САМБАРААС ЯЛГАГДАХ ЗҮЙЛ: голч элемент нь бичлэгийн жагсаалт
   БИШ, БОДИСЫН ТОВЬЁОГ. Энэ бүртгэлийн бодит агуулга нь агуулах өөрөө
   биш, түүнд ХАДГАЛАГДАЖ БУЙ ЗҮЙЛ: 2023 онд 184 агуулахад 868 өөр
   нэрийн бодис бүртгэгдсэн. Хяналтын ажилтны асуулт "энэ агуулахад юу
   байна" гэхээсээ илүү "давсны хүчил хаана хадгалагдаж байна вэ" гэсэн
   хэлбэртэй байдаг тул зүүн багана нь хайлттай бодисын товьёог болж,
   бусад бүх зүйл түүний сонголтод захирагдана.

   ХОЁР ДАХЬ ялгаа: хүчинтэй байдал. Гэрчилгээ бүр дуусах хугацаатай
   бөгөөд 2023 оны бүртгэлийн 20 нь өнөөдрийн байдлаар хугацаа нь
   дууссан байна. Энэ нь эх сурвалжид талбар БИШ, бидний тооцоо
   ({@link ../../lib/chemicals}-ийн `expiryState`).
   -------------------------------------------------------------------------- */

export function ChemicalsDashboard() {
  /*
    Хоёр жил нь ХОЁР ТУСДАА бүртгэл (гэрчилгээний дугаар давхцахгүй)
    тул нэмэхгүй, сонгоно. Анхдагч нь 2023: гэрчилгээнүүд нь ихэвчлэн
    2028 он хүртэл хүчинтэй тул одоо ажиллаж буй агуулахуудын үндсэн
    хэсэг тэнд байна.
  */
  const [year, setYear] = React.useState<ChemicalYear>(2023);
  const [cache, setCache] = React.useState<Partial<Record<ChemicalYear, ChemicalData>>>(
    {},
  );
  const [error, setError] = React.useState<string | null>(null);

  /*
    Бодисын ХОЁР ТҮВШНИЙ шүүлт: бүлэг (химийн ангилал) ба нэр. Нэр нь
    бүлгээ дагадаг тул хоёулаа зэрэг идэвхтэй байж болно — бүлэг нь
    товьёогийг задалсан хэвээр барьж, хаана байгаагаа алдахаас сэргийлнэ.
  */
  const [group, setGroup] = React.useState<string | null>(null);
  const [substance, setSubstance] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [right, setRight] = React.useState<string | null>(null);
  const [storage, setStorage] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<ExpiryState | null>(null);
  const [expiry, setExpiry] = React.useState<string | null>(null);

  const [picked, setPicked] = React.useState<number | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);
  /** Хулгана дагасан хөвөгч тайлбар — байрлалыг өөрөө удирдана */
  const tip = useMapTip();
  /** Бичилтийн самбарыг чирж зөөх, хэмжээг нь солих төлөв */
  const drag = usePanelBox();

  /*
    Өнөөдрийг НЭГ УДАА барина. Зурагдалт бүрд `new Date()` дуудвал
    сервер ба хөтөч дээр өөр утга гарч, гидраци зөрөх эрсдэлтэй.
  */
  const [todayKey] = React.useState(() => {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  });

  const data = cache[year];

  React.useEffect(() => {
    if (cache[year]) return;
    const ac = new AbortController();
    fetchChemicals(year, ac.signal)
      .then((d) => setCache((c) => ({ ...c, [year]: d })))
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, [year, cache]);

  const reset = React.useCallback(() => {
    setGroup(null);
    setSubstance(null);
    setDistrict(null);
    setRight(null);
    setStorage(null);
    setStatus(null);
    setExpiry(null);
    setPicked(null);
  }, []);

  /* Жил солиход шүүлтүүр цэвэрлэгдэнэ — нэг жилийн бодис, гэрчилгээ
     нөгөөд нь байхгүй тул хуучин сонголт хоосон дэлгэц үлдээнэ */
  const pickYear = React.useCallback(
    (y: ChemicalYear) => {
      setYear(y);
      reset();
    },
    [reset],
  );

  const rows = data?.rows;

  type Dim =
    | "group"
    | "substance"
    | "district"
    | "right"
    | "storage"
    | "status"
    | "expiry";

  /*
    Бүлэг ба нэр нь ХОЁР ТҮВШНИЙ нэг хэмжигдэхүүн тул товьёогийг зурахад
    хоёуланг нь зэрэг алгасах шаардлага гардаг — `skip` нь тиймээс олон
    утга хүлээж авна.
  */
  const keep = React.useCallback(
    (w: Warehouse, ...skip: Dim[]) => {
      const off = (d: Dim) => skip.includes(d);
      if (!off("group") && group && !w.groups.includes(group)) return false;
      if (!off("substance") && substance && !w.substances.includes(substance))
        return false;
      if (!off("district") && district && w.district !== district) return false;
      if (!off("right") && right && !w.rights.includes(right)) return false;
      if (!off("storage") && storage && w.storage !== storage) return false;
      if (!off("status") && status && expiryState(w, todayKey) !== status) return false;
      if (!off("expiry") && expiry && (w.validTo?.slice(0, 4) ?? "") !== expiry)
        return false;
      return true;
    },
    [group, substance, district, right, storage, status, expiry, todayKey],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((w) => keep(w)), [rows, keep]);

  const activeCount =
    (group ? 1 : 0) +
    (substance ? 1 : 0) +
    (district ? 1 : 0) +
    (right ? 1 : 0) +
    (storage ? 1 : 0) +
    (status ? 1 : 0) +
    (expiry ? 1 : 0);

  /* ---------------- Индикатор ---------------- */

  const totals = React.useMemo(() => {
    let tons = 0;
    let unmeasured = 0;
    let expired = 0;
    const names = new Set<string>();
    for (const w of shown) {
      /* `null` нь ХЭМЖИГДЭЭГҮЙ, тэг БИШ — нийлбэрт оруулахгүй, тусад нь
         тоолж дэлгэц дээр тэмдэглэнэ */
      if (w.tons == null) unmeasured++;
      else tons += w.tons;
      if (expiryState(w, todayKey) === "expired") expired++;
      for (const s of w.substances) names.add(s);
    }
    return { tons, unmeasured, expired, names: names.size };
  }, [shown, todayKey]);

  /* ---------------- Бодисын товьёог ----------------

     Бүлэг БА нэрийн шүүлтийг ХОЁУЛАНГ нь алгасна: сонголт хийсний
     дараа ч товьёог бүтнээрээ үлдэж, өөр бүлэг рүү шилжих боломжтой
     байна. Зөвхөн өөрийнхийг алгасвал сонгосон бүлгээс бусад нь алга
     болж, буцах зам хаагдана. */
  const groupList = React.useMemo(() => {
    /* Бүлгийн тоо нь АГУУЛАХЫН тоо: нэг агуулах тухайн бүлгийн хэдэн ч
       бодистой байсан нэг л удаа тоологдоно */
    const m = new Map<string, number>();
    for (const w of rows ?? []) {
      if (!keep(w, "group", "substance")) continue;
      for (const g of w.groups) m.set(g, (m.get(g) ?? 0) + 1);
    }
    return SUBSTANCE_GROUPS.filter((g) => m.has(g.id))
      .map((g) => ({ id: g.id as string, label: g.label, n: m.get(g.id) ?? 0 }))
      .sort((a, b) => {
        /* `Бусад`, `Бичилт дутуу` нь үлдэгдлийн мөрүүд тул тоо хэдий
           их байсан ч эцэст суана — зөвхөн эрэмбэ, тусдаа хэсэг биш */
        const au = UNGROUPED.includes(a.id) ? 1 : 0;
        const bu = UNGROUPED.includes(b.id) ? 1 : 0;
        return au - bu || b.n - a.n;
      });
  }, [rows, keep]);

  /** Нэрсийн жагсаалт — бүлгийн шүүлт үйлчилнэ, нэрийнх нь алгасагдана */
  const substanceList = React.useMemo(() => {
    const m = new Map<string, { group: string; n: number }>();
    for (const w of rows ?? []) {
      if (!keep(w, "substance")) continue;
      for (const s of w.substances) {
        const cur = m.get(s);
        if (cur) cur.n++;
        else m.set(s, { group: classifySubstance(s), n: 1 });
      }
    }
    return [...m]
      .map(([name, v]) => ({ name, group: v.group, n: v.n }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "mn"));
  }, [rows, keep]);

  /*
    Бүлэг сонгоход НЭРИЙН сонголт цэвэрлэгдэнэ — өмнөх нэр шинэ бүлэгт
    хамаарахгүй бол дэлгэц хоосорно.
  */
  const pickGroup = React.useCallback((id: string | null) => {
    setGroup((g) => (g === id ? null : id));
    setSubstance(null);
  }, []);

  /* ---------------- Задаргаа ---------------- */

  const byDistrict = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const w of rows ?? []) {
      if (!keep(w, "district")) continue;
      m.set(w.district, (m.get(w.district) ?? 0) + 1);
    }
    return [...m]
      .map(([key, value]) => ({ key, label: districtName(key), value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  /*
    Нэг агуулах хэд хэдэн эрхтэй тул мөрүүдийн нийлбэр агуулахын тооноос
    ИХ гарна. Үүнийг дэлгэц дээр ТАЙЛБАРЛАХГҮЙ — арга зүйн тэмдэглэл нь
    албан ёсны бүртгэлийн дэлгэцэд орох зүйл биш; `CLAUDE.md`-д
    баримтжуулав.
  */
  const byRight = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const w of rows ?? []) {
      if (!keep(w, "right")) continue;
      for (const r of w.rights) m.set(r, (m.get(r) ?? 0) + 1);
    }
    return RIGHTS.filter((r) => m.has(r.id)).map((r) => ({
      key: r.id,
      label: r.label,
      value: m.get(r.id) ?? 0,
    }));
  }, [rows, keep]);

  const byStorage = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const w of rows ?? []) {
      if (!keep(w, "storage")) continue;
      m.set(w.storage, (m.get(w.storage) ?? 0) + 1);
    }
    return [...m]
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  /* Гэрчилгээ дуусах он. Задраагүй огноог ТУСДАА мөр болгоно — нуувал
     жагсаалтын нийлбэр нийт тоотой таарахгүй нь тайлбаргүй үлдэнэ */
  const byExpiry = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const w of rows ?? []) {
      if (!keep(w, "expiry")) continue;
      const y = w.validTo?.slice(0, 4) ?? "";
      m.set(y, (m.get(y) ?? 0) + 1);
    }
    return [...m]
      .map(([key, value]) => ({
        key,
        label: key ? `${key} он` : "Тодорхойгүй",
        value,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, keep]);

  /* ---------------- Газрын зураг ---------------- */

  const points = data?.points ?? NO_POINTS;

  const visible = React.useMemo(() => {
    if (!rows) return NO_INDEX;
    if (!activeCount) return Uint32Array.from(rows, (_, i) => i);
    const on = new Set(shown.map((w) => w.oid));
    const out: number[] = [];
    points.oid.forEach((o, i) => on.has(o) && out.push(i));
    return Uint32Array.from(out);
  }, [rows, activeCount, shown, points]);

  /*
    Цэгийн ХЭМЖЭЭ = тоо хэмжээ, ЛОГАРИФМ хуваарьтай. Тонн нь 0.007-оос
    419,800 хүртэл — таван эрэмбэ ялгаатай тул шугаман хуваарь дээр
    хамгийн том нэг агуулах бусад бүгдийг цэг болгож жижигрүүлнэ.

    Өнгө нь ГАНЦ (`DATA_COLOR`): шатлалын хоёр үзүүрт ижил өнгө өгснөөр
    зөвхөн радиус нь хэмжигдэхүүн үүрнэ. Хэмжээгээ бус утгаа өнгөөр
    ялгавал платформын "дата дүрслэлийн өнгө ганц" дүрэм зөрчигдөнө.
  */
  const grades = React.useMemo(() => {
    if (!rows) return undefined;
    const values = Float32Array.from(rows, (w) => Math.log10(1 + (w.tons ?? 0)));
    let hi = 0;
    for (const v of values) if (v > hi) hi = v;
    return {
      values,
      stops: [
        [0, DATA_COLOR],
        [Math.max(hi, 1), DATA_COLOR],
      ] as [number, string][],
      /* Шатлал нь нэг өнгөт тул платформын бусад зурагтай ижил гурван
         давхаргын гэрэлтэлтээр зурна — радиус нь хэмжигдэхүүнээ
         үүрсэн хэвээр */
      firefly: true,
    };
  }, [rows]);

  /* Хугацаа нь дууссан гэрчилгээ — зөвхөн тэдгээрт тэмдэглэгээ */
  const marks = React.useMemo<Record<number, string> | undefined>(() => {
    if (!rows) return undefined;
    const m: Record<number, string> = {};
    for (const w of rows) {
      if (expiryState(w, todayKey) === "expired") m[w.oid] = EXPIRED_PIN;
    }
    return Object.keys(m).length ? m : undefined;
  }, [rows, todayKey]);

  const focus = React.useMemo<Extent | null>(() => {
    if (!activeCount || !shown.length) return null;
    const b = new Bounds();
    for (const w of shown) b.add(w.lon, w.lat);
    return b.get(0.008);
  }, [activeCount, shown]);

  const byOid = React.useMemo(() => {
    const m = new Map<number, Warehouse>();
    for (const w of rows ?? []) m.set(w.oid, w);
    return m;
  }, [rows]);

  const hovered = tip.oid == null ? null : (byOid.get(tip.oid) ?? null);
  const selected = picked == null ? null : (byOid.get(picked) ?? null);

  const highlight = React.useMemo<[number, number] | null>(
    () => (hovered ? [hovered.lon, hovered.lat] : null),
    [hovered],
  );

  /* ---------------- Төлөв ---------------- */

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        <div className="text-center">
          <p className="text-[14px] font-medium">
            Эх сурвалжийн мэдээллийг татаж чадсангүй
          </p>
          <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Химийн бодисын агуулах"
        activeCount={activeCount}
        onReset={reset}
        leading={
          /*
            Жил сонгох. Энэ нь шүүлтүүр БИШ — "юуг харах вэ" гэсэн эх
            сурвалжийн сонголт тул шүүлтүүрүүдээс тусад нь, гарчгийн
            хажууд сууна.
          */
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-ink-3">Бүртгэлийн он</span>
            {CHEMICAL_YEARS.map((y) => (
              <button
                key={y}
                onClick={() => pickYear(y)}
                className={cn(
                  "num rounded-xs border px-2 py-1 text-[12px] transition-colors",
                  y === year
                    ? "border-data/45 bg-data/12 font-medium text-ink"
                    : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                )}
              >
                {y}
              </button>
            ))}
          </div>
        }
      >
        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          active={district != null}
          value={district ? districtName(district) : null}
          onClear={() => setDistrict(null)}
        >
          <PickList
            items={byDistrict.map((d) => ({
              key: d.key,
              label: d.label,
              value: d.value,
            }))}
            selected={district}
            onPick={setDistrict}
          />
        </FilterMenu>

        <FilterMenu
          label="Зөвшөөрлийн эрх"
          icon={ScrollText}
          active={right != null}
          value={right ? (RIGHT_LABEL.get(right) ?? right) : null}
          onClear={() => setRight(null)}
        >
          <PickList
            items={byRight.map((d) => ({ key: d.key, label: d.label, value: d.value }))}
            selected={right}
            onPick={setRight}
          />
        </FilterMenu>

        <FilterMenu
          label="Хадгалах зориулалт"
          icon={WarehouseIcon}
          active={storage != null}
          value={storage}
          onClear={() => setStorage(null)}
        >
          <PickList
            items={byStorage.map((d) => ({ key: d.key, label: d.label, value: d.value }))}
            selected={storage}
            onPick={setStorage}
          />
        </FilterMenu>

        <FilterMenu
          label="Хүчинтэй байдал"
          icon={ShieldCheck}
          active={status != null}
          value={status ? (EXPIRY_STATES.find((s) => s.id === status)?.label ?? null) : null}
          onClear={() => setStatus(null)}
          width={224}
        >
          <PickList
            items={EXPIRY_STATES.map((s) => ({
              key: s.id,
              label: s.label,
              value: (rows ?? []).filter(
                (w) => keep(w, "status") && expiryState(w, todayKey) === s.id,
              ).length,
            }))}
            selected={status}
            onPick={(k) => setStatus(k as ExpiryState | null)}
          />
        </FilterMenu>
      </FilterBar>

      <Columns id="chemicals" left={262} right={246} className="min-h-0 flex-1">
        {/* ---- ЗҮҮН: бодисын товьёог, доор нь хадгалах зориулалт ---- */}
        <div className="flex min-h-[240px] min-w-0 flex-col gap-2.5">
          <div className="flex min-h-0 flex-1 flex-col rounded-xs border border-line bg-paper-2">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
              <h2 className="display text-[13.5px] leading-none tracking-[0.06em] uppercase">
                Бодисын товьёог
              </h2>
              <span className="num text-[10.5px] text-ink-3">
                {num(substanceList.length)}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {/*
                `PickList` нь өөрөө хайлт, гүйлттэй. Энэ багана нь самбарын
                үндсэн шилжүүлэгч тул өндрөө бүтнээр эзэлнэ.
              */}
              <SubstanceIndex
                groups={groupList}
                items={substanceList}
                group={group}
                selected={substance}
                onGroup={pickGroup}
                onPick={setSubstance}
              />
            </div>
          </div>

          {/*
            Хадгалах газрын зориулалт нь ердөө гурван утгатай тул баруун
            талын өндөр диаграмуудын дунд байрлахад тэдгээрийг холдуулж
            байв. Товьёогийн доор тогтмол өндрөөр суух нь зохимжтой —
            бодисын нэрстэй хамт "юу, хаана хадгалагдаж байна" гэсэн нэг
            асуултын хоёр тал болно.
          */}
          <Block title="Хадгалах газрын зориулалтаар" note="агуулахын тоо">
            <RowChart
              data={byStorage}
              selected={storage}
              onSelect={setStorage}
              format={num}
            />
          </Block>
        </div>

        {/* ---- ТӨВ: индикатор + газрын зураг ---- */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <div className="grid shrink-0 grid-cols-2 divide-x divide-line rounded-xs border border-line bg-paper-2 sm:grid-cols-4">
            <Cell
              label="Агуулах"
              value={num(shown.length)}
              note={
                shown.length === (rows?.length ?? 0)
                  ? "бүртгэгдсэн нийт"
                  : `нийт ${num(rows?.length ?? 0)}`
              }
            />
            <Cell
              label="Нийт тоо хэмжээ"
              value={num(totals.tons)}
              unit="тонн"
              note={
                totals.unmeasured
                  ? `${num(totals.unmeasured)} бичлэгт хэмжигдээгүй`
                  : undefined
              }
            />
            <Cell
              label="Бодисын нэр төрөл"
              value={num(totals.names)}
              note="давхардалгүй нэр"
            />
            <Cell
              label="Хугацаа дууссан"
              value={num(totals.expired)}
              note="гэрчилгээ"
              alert={totals.expired > 0}
            />
          </div>

          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-xs border border-line">
            {data ? (
              <PointMap
                key={year}
                points={points}
                visible={visible}
                basemap={basemap}
                cluster={false}
                grades={grades}
                marks={marks}
                onSelect={(oid) => setPicked((p) => (p === oid ? null : oid))}
                onHover={tip.onHover}
                highlight={highlight}
                focus={focus}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-paper-3">
                <span className="flex items-center gap-2 text-[13px] text-ink-3">
                  <Loader2 size={14} className="animate-spin" />
                  {year} оны бүртгэл татаж байна…
                </span>
              </div>
            )}

            <BasemapGallery
              value={basemap}
              onChange={setBasemap}
              placement="top-left"
            />

            {/*
              Тэмдэглэгээний тайлбар — зургийн зүүн ДООД буланд, эх
              сурвалжийн бичгийн яг дээр. Дээд булан нь суурь зургийн
              товчинд үлдэнэ.
            */}
            <div
              /*
                Дэвсгэр нь 90% тунгалаг (10% дүүргэлт) — тайлбар нь доорх
                зургийг бараг халхлахгүй. Уншигдацыг дэвсгэр биш ХОЁР
                зүйл барина: `backdrop-blur` нь ард нь буй дүрсийг
                зөөлрүүлж, бичвэрийн сүүдэр нь цайвар талбай (хиймэл
                дагуулын цас, элс) дээр ч тэмдэглэгээг тодруулна —
                зургийн доод ирмэгийн эх сурвалжийн бичигтэй ижил арга.
              */
              className="pointer-events-none absolute bottom-6 left-2.5 z-10 rounded-xs border border-line bg-paper/10 px-2 py-1.5 backdrop-blur-md"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: DATA_COLOR }}
                  aria-hidden
                />
                <span className="text-[10.5px] text-ink">
                  Цэгийн хэмжээ — тоо хэмжээ, тонн
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <TriangleAlert size={10} className="text-ochre" />
                <span className="text-[10.5px] text-ink">
                  Гэрчилгээний хугацаа дууссан
                </span>
              </div>
            </div>

            {/* ХӨВӨГЧ ТАЙЛБАР — хулганы хажууд */}
            {hovered ? (
              <MapTip state={tip} width={250}>
                <div className="px-2.5 pt-2 pb-2 text-[12.5px] leading-snug font-medium text-ink">
                  {hovered.company}
                </div>
                <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                  <MapTipRow
                    icon={Package}
                    text={
                      hovered.tons == null
                        ? "Тоо хэмжээ бүртгэгдээгүй"
                        : `${num(hovered.tons, hovered.tons < 10 ? 3 : 0)} тонн`
                    }
                    num
                  />
                  <MapTipRow
                    icon={FlaskConical}
                    text={`${num(hovered.substances.length)} нэрийн бодис`}
                    num
                  />
                  {hovered.district ? (
                    <MapTipRow icon={Building2} text={districtName(hovered.district)} />
                  ) : null}
                  <MapTipRow
                    icon={CalendarClock}
                    text={
                      hovered.validTo
                        ? `Хүчинтэй хугацаа ${hovered.validTo}`
                        : "Хүчинтэй хугацаа тодорхойгүй"
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5">
                  <StatusChip state={expiryState(hovered, todayKey)} />
                  <MousePointerClick size={11} className="shrink-0 text-ink-3" />
                </div>
              </MapTip>
            ) : null}

            {/* Товшсон бичилт — баруун талд, тогтмол */}
            {selected ? (
              <RecordCard
                w={selected}
                state={expiryState(selected, todayKey)}
                drag={drag}
                onClose={() => setPicked(null)}
                onSubstance={setSubstance}
              />
            ) : null}

            <p
              className="pointer-events-none absolute bottom-1 left-2.5 z-10 text-[10px] leading-none text-ink-3"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.75))" }}
            >
              Суурь зураг: Esri · Дата: ArcGIS FeatureServer
            </p>
          </div>
        </div>

        {/* ---- БАРУУН: задаргаа ---- */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto">
          <Block title="Дүүргээр" note="агуулахын тоо">
            <RowChart
              data={byDistrict}
              selected={district}
              onSelect={setDistrict}
              format={num}
            />
          </Block>

          <Block title="Зөвшөөрлийн эрхээр" note="агуулахын тоо">
            <RowChart data={byRight} selected={right} onSelect={setRight} format={num} />
          </Block>

          <Block title="Гэрчилгээ дуусах оноор" note="агуулахын тоо">
            <RowChart data={byExpiry} selected={expiry} onSelect={setExpiry} format={num} />
          </Block>
        </div>
      </Columns>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Бодисын товьёог — хоёр түвшний, хайлттай, бүтэн өндрөөр гүйдэг.
 *
 * `PickList`-ийг ХЭРЭГЛЭХГҮЙ: тэр нь унждаг цэс дотор суухаар
 * зохиогдсон тул өндөр нь 220px-ээр хатуу хязгаарлагдсан. Энд жагсаалт
 * нь самбарын үндсэн шилжүүлэгч бөгөөд баганынхаа бүх өндрийг эзэлнэ.
 *
 * 967 нэрийг шууд жагсаавал гүйлгэхээс өөр зам үлдэхгүй тул ХИМИЙН
 * БҮЛГЭЭР задлав: бүлгийн мөр дээр товшиход тэр бүлэг шүүлтүүр болж,
 * доор нь өөрийн нэрсээ дэлгэнэ. Нэг товшилт хоёр үйлдэл хийж байгаа нь
 * санаатай — "хүчлүүдийг харъя" гэдэг нь задлах, шүүх гэсэн хоёр тусдаа
 * алхам байх ёсгүй.
 *
 * ХАЙЛТ нь бүлгээс ҮЛ ХАМААРНА: хэрэглэгч тодорхой нэр хайж байхдаа аль
 * бүлэгт хамаарахыг нь мэдэхгүй байж болно. Тиймээс хайх үед товьёог
 * хавтгай жагсаалт болж, мөр бүр бүлгээ хажуудаа бичнэ.
 *
 * ХЭМЖЭЭГ ХЭРХЭН ХАРУУЛАХ ВЭ. Урьд нь мөр бүрийн АРД тоотой
 * пропорциональ дүүргэлт суудаг байсныг ХАСАВ: 15 мөрийн дүүргэлт нь
 * нийлээд хатуу блок болж, жагсаалт биш диаграм мэт уншигдаж байв.
 * Одоо мөрийн ДООД ирмэгт 2px-ийн хэмжигчийн зураас татна — платформын
 * "хээрийн хэмжих хэрэгсэл" хэлээр ярьсан, мөрүүдийг хооронд нь
 * харьцуулах хэвээр боловч жин нь хамаагүй хөнгөн.
 *
 * Товьёог нь НЭГ ЖАГСААЛТ. `Бусад`, `Бичилт дутуу` хоёр нь эцэст нь
 * эрэмбэлэгдэнэ (үлдэгдлийн мөр дээр гарах нь буруу) ч тусдаа хэсэг
 * болгож ХУВААХГҮЙ, бусад мөрөөс өөрөөр ч харуулахгүй.
 */
function SubstanceIndex({
  groups,
  items,
  group,
  selected,
  onGroup,
  onPick,
}: {
  groups: { id: string; label: string; n: number }[];
  items: { name: string; group: string; n: number }[];
  group: string | null;
  selected: string | null;
  onGroup: (id: string | null) => void;
  onPick: (name: string | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();

  const found = React.useMemo(
    () => (query ? items.filter((i) => i.name.toLowerCase().includes(query)) : []),
    [items, query],
  );

  /* Сонгосон бүлгийн нэрс — бүлэг задарсан үед л хэрэгтэй */
  const inGroup = React.useMemo(
    () => (group ? items.filter((i) => i.group === group) : []),
    [items, group],
  );

  const max = Math.max(...groups.map((g) => g.n), 1);

  const row = (g: { id: string; label: string; n: number }) => (
    <div key={g.id}>
      <GroupRow
        label={g.label}
        n={g.n}
        share={g.n / max}
        open={group === g.id}
        onClick={() => onGroup(g.id)}
      />
      {group === g.id ? (
        <div className="mb-1 ml-4 border-l border-line pr-1.5 pl-1.5">
          {inGroup.length === 0 ? (
            <p className="py-1.5 text-[10.5px] text-ink-3">Нэр бүртгэгдээгүй байна</p>
          ) : (
            inGroup.map((i) => (
              <NameRow
                key={i.name}
                name={i.name}
                n={i.n}
                on={selected === i.name}
                onPick={() => onPick(selected === i.name ? null : i.name)}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Хайлтын талбар нь зайтай, жагсаалт нь ирмэгт хүрнэ — тусгаарлах
          зураас нь самбарын бүтэн өргөнийг хамарч байж жагсаалт мэт
          уншигдана */}
      <div className="shrink-0 px-2 pt-2 pb-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Бодисын нэрээр хайх"
          className="h-7 w-full rounded-xs border border-line bg-paper px-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-line-2"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {query ? (
          found.length === 0 ? (
            <p className="py-4 text-center text-[11.5px] text-ink-3">Илэрц олдсонгүй</p>
          ) : (
            <div className="px-1.5">
              {found.map((i) => (
                <NameRow
                  key={i.name}
                  name={i.name}
                  n={i.n}
                  note={GROUP_LABEL.get(i.group)}
                  on={selected === i.name}
                  onPick={() => onPick(selected === i.name ? null : i.name)}
                />
              ))}
            </div>
          )
        ) : (
          /* Мөрүүдийг хоосон зайгаар биш ЗУРААСААР тусгаарлана */
          <div className="divide-y divide-line border-y border-line">
            {groups.map((g) => row(g))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Товьёогийн бүлгийн мөр.
 *
 * `share` нь 0–1 хооронд — мөрийн доод ирмэгийн хэмжигчийн зураасны урт.
 */
function GroupRow({
  label,
  n,
  share,
  open,
  onClick,
}: {
  label: string;
  n: number;
  share: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-1.5 py-[6px] pr-1.5 pl-2.5 text-left transition-colors",
        open ? "bg-paper-hi text-ink" : "text-ink-2 hover:bg-paper-hi hover:text-ink",
      )}
    >
      {/* Сонголтыг дүүргэлтээр биш ИРМЭГИЙН ЗУРААСААР тэмдэглэнэ */}
      {open ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-data" />
      ) : null}

      <ChevronRight
        size={11}
        className={cn(
          "shrink-0 text-ink-3 transition-transform",
          open && "rotate-90 text-data",
        )}
      />
      <span className={cn("min-w-0 flex-1 truncate text-[11.5px]", open && "font-medium")}>
        {label}
      </span>
      <span className={cn("num shrink-0 text-[10.5px]", open ? "text-ink-2" : "text-ink-3")}>
        {n}
      </span>

      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px]"
        style={{
          width: `${Math.max(share * 100, 1.5)}%`,
          background: open
            ? "var(--data)"
            : "color-mix(in oklab, var(--data) 45%, transparent)",
        }}
      />
    </button>
  );
}

function NameRow({
  name,
  n,
  note,
  on,
  onPick,
}: {
  name: string;
  n: number;
  /** Хайлтын үр дүнд бүлгийн нэрийг хажууд нь бичнэ */
  note?: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      title={name}
      className={cn(
        "flex w-full items-baseline justify-between gap-2 rounded-xs px-1.5 py-[3px] text-left transition-colors",
        on
          ? "bg-data/14 font-medium text-ink"
          : "text-ink-2 hover:bg-paper-hi hover:text-ink",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[11px] leading-snug">
        {name}
        {note ? <span className="ml-1 text-[9.5px] text-ink-3">· {note}</span> : null}
      </span>
      <span className="num shrink-0 text-[10.5px] text-ink-3">{n}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   ЧИРЖ ЗӨӨХ, ХЭМЖЭЭ СОЛИХ

   Бичилтийн самбар нь зургийн буланд суудаг тул доор нь яг тэр цэг
   орвол хаагдана. Хэрэглэгч самбараа хааж, ойртож, дахин нээх ёсгүй —
   зүгээр л хажуу тийш нь чирнэ. Мөн бодисын жагсаалт нь бичлэг бүрд
   өөр урттай (нэгээс 143 мөр) тул өндөр нь ч тохируулагддаг байх ёстой.

   БАЙРЛАЛ, ХЭМЖЭЭГ REACT ТӨЛӨВӨӨР БҮҮ БАРЬ: хулгана хөдлөх бүрд самбар
   бүхлээрээ дахин зурагдана (энэ самбар 967 мөрийн товьёогтой хуудсанд
   сууна). Утгыг ШУУД DOM руу бичиж, төлөвт юу ч барихгүй —
   {@link ../map/hover-tip}-тэй ижил зарчим.

   Утга нь `useLayoutEffect`-ээр зурагдалт бүрд дахин тавигдана: React
   өөрийн удирддаггүй inline шинжийг арилгадаггүй ч бичлэг солигдоход
   самбар шинэчлэгдэх тул баталгаажуулах нь хямд.

   ХЭМЖЭЭ СОЛИХ БАРИУЛ НЬ ЗҮҮН ДООД БУЛАНД. Самбар нь баруун дээд
   буландаа бэхлэгдсэн (`top` + `right`) тул өргөн нэмэхэд ЗҮҮН тийш,
   өндөр нэмэхэд ДООШ тэлнэ — бариул нь тэлэх чиглэлийнхээ буланд байх
   ёстой. Баруун доод буланд тавьбал бариул өөрөө хөдөлгөөнгүй хэвээр
   үлдэж, самбар нь эсрэг талаараа сунана.
   -------------------------------------------------------------------------- */

const DRAG_PAD = 6;
const MIN_W = 236;
const MIN_H = 148;

type DragState = ReturnType<typeof usePanelBox>;

type Grab = {
  mode: "move" | "resize";
  px: number;
  py: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
};

function usePanelBox() {
  const el = React.useRef<HTMLDivElement | null>(null);
  const off = React.useRef({ x: 0, y: 0 });
  /** Хэрэглэгч хэмжээг нь хөндөх хүртэл `null` — CSS-ийн анхдагч үйлчилнэ */
  const size = React.useRef<{ w: number; h: number } | null>(null);
  const from = React.useRef<Grab | null>(null);

  /** Хэмжээ, шилжилтийг хүрээндээ багтаагаад DOM руу бичнэ */
  const apply = React.useCallback(() => {
    const node = el.current;
    if (!node) return;
    const frame = node.offsetParent as HTMLElement | null;

    if (size.current && frame) {
      /* Хүрээнээс том самбар нь өөрийнхөө агуулгыг ч далдална */
      const maxW = Math.max(MIN_W, frame.clientWidth - 2 * DRAG_PAD);
      const maxH = Math.max(MIN_H, frame.clientHeight - 2 * DRAG_PAD);
      size.current.w = Math.min(Math.max(size.current.w, MIN_W), maxW);
      size.current.h = Math.min(Math.max(size.current.h, MIN_H), maxH);
    }
    if (size.current) {
      node.style.width = `${Math.round(size.current.w)}px`;
      /*
        Өндөр тавьмагц CSS-ийн `bottom` нь хэт тодорхойлолт болж
        үл тоомсорлогдоно (top + height давамгайлна) — самбар доод
        ирмэгтээ наалдахаа болино.
      */
      node.style.height = `${Math.round(size.current.h)}px`;
    }

    if (frame) {
      /*
        `offsetLeft/Top` нь шилжилтээс ӨМНӨХ байрлал (CSS-ийн top/right).
        Түүн дээр нэмэхэд самбар хүрээнээсээ хальж болзошгүй тул хоёр
        тэнхлэгээр нь хязгаарлана — хальсан самбар буцаад олдохгүй.
      */
      const maxX = frame.clientWidth - node.offsetLeft - node.offsetWidth - DRAG_PAD;
      const minX = DRAG_PAD - node.offsetLeft;
      const maxY = frame.clientHeight - node.offsetTop - node.offsetHeight - DRAG_PAD;
      const minY = DRAG_PAD - node.offsetTop;
      off.current.x = Math.max(Math.min(minX, maxX), Math.min(off.current.x, maxX));
      off.current.y = Math.max(Math.min(minY, maxY), Math.min(off.current.y, maxY));
    }
    node.style.transform = `translate3d(${Math.round(off.current.x)}px, ${Math.round(
      off.current.y,
    )}px, 0)`;
  }, []);

  const mount = React.useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      if (node) apply();
    },
    [apply],
  );

  /*
    Цонх (эсвэл хажуугийн зурвас) томрох, багасахад хүрээ өөрчлөгдөнө.
    Зурагдалт дагалддаггүй тул самбар хүрээнээсээ гадна үлдэж болзошгүй —
    хэмжээ өөрчлөгдөх бүрд дахин багтаана.
  */
  React.useEffect(() => {
    const on = () => apply();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [apply]);

  /**
   * Бариулын үйл явдлууд. `mode` нь тухайн бариул юу хийхийг заана:
   * толгой нь зөөнө, булангийн дэгээ нь хэмжээг солино.
   */
  const grip = React.useCallback(
    (mode: "move" | "resize") => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        /* Толгой дээрх товч (хаах) чирэлт эхлүүлэх ёсгүй */
        if (mode === "move" && (e.target as HTMLElement).closest("button")) return;
        const node = el.current;
        if (!node) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        from.current = {
          mode,
          px: e.clientX,
          py: e.clientY,
          ox: off.current.x,
          oy: off.current.y,
          /* Одоогийн бодит хэмжээнээс эхэлнэ — эхний удаад CSS-ийн
             анхдагчийг (өргөн 292px, өндөр нь top/bottom-оос) уншина */
          w: node.offsetWidth,
          h: node.offsetHeight,
        };
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const f = from.current;
        if (!f) return;
        const dx = e.clientX - f.px;
        const dy = e.clientY - f.py;
        if (f.mode === "move") {
          off.current.x = f.ox + dx;
          off.current.y = f.oy + dy;
        } else {
          /* Зүүн доод булан: зүүн тийш чирэхэд өргөн НЭМЭГДЭНЭ */
          size.current = { w: f.w - dx, h: f.h + dy };
        }
        apply();
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        from.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      },
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
        from.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      },
    }),
    [apply],
  );

  return { mount, apply, grip };
}

function Cell({
  label,
  value,
  unit,
  note,
  alert,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  alert?: boolean;
}) {
  return (
    <div className="px-3 py-2">
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className={cn(
            "num text-[19px] leading-none font-medium",
            alert ? "text-ochre" : "text-ink",
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-[10.5px] text-ink-3">{unit}</span> : null}
      </div>
      {note ? (
        <div className="mt-1 truncate text-[10px] text-ink-3" title={note}>
          {note}
        </div>
      ) : null}
    </div>
  );
}

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shrink-0 rounded-xs border border-line bg-paper-2">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="display text-[12.5px] leading-none tracking-[0.06em] uppercase">
          {title}
        </h2>
        {note ? <span className="text-[10px] text-ink-3">{note}</span> : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

const STATE_TONE: Record<ExpiryState, string> = {
  valid: "var(--moss)",
  expired: "var(--ochre)",
  unknown: "var(--ink-3)",
};

function StatusChip({ state }: { state: ExpiryState }) {
  const label = EXPIRY_STATES.find((s) => s.id === state)?.label ?? "";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-xs px-1.5 py-[2px] text-[10px] leading-none"
      style={{
        color: STATE_TONE[state],
        background: `color-mix(in oklab, ${STATE_TONE[state]} 12%, transparent)`,
      }}
    >
      {state === "expired" ? <TriangleAlert size={9} /> : null}
      {label}
    </span>
  );
}

/**
 * Сонгосон агуулахын бичилт.
 *
 * Бодисын нэрс МӨР МӨРӨӨР гарна: нэг агуулахад 30 гаруй нэр бүртгэгдсэн
 * байдаг тул нэг догол болгон бичвэл уншигдахгүй. Тоо хэмжээ нь эх
 * бичвэрийнхээ хэлбэрээр (хаалтанд) үлдэнэ — нэгж нь жигд бус тул
 * хөрвүүлэх, нэгтгэх боломжгүй.
 */
function RecordCard({
  w,
  state,
  drag,
  onClose,
  onSubstance,
}: {
  w: Warehouse;
  state: ExpiryState;
  drag: DragState;
  onClose: () => void;
  onSubstance: (name: string) => void;
}) {
  const el = React.useRef<HTMLDivElement>(null);
  /*
    Чирэгчид өөрийгөө бүртгүүлж, зурагдалт бүрд шилжилтээ дахин тавина.
    `react-hooks/refs` нь `ref={obj.prop}`-ыг зөвшөөрдөггүй тул самбар
    өөрөө `ref` эзэмшинэ ({@link ../map/hover-tip}-ийн `MapTip`-тэй ижил).
  */
  React.useLayoutEffect(() => {
    drag.mount(el.current);
    return () => drag.mount(null);
  });

  return (
    <div
      ref={el}
      className="absolute top-2 right-2 bottom-8 z-10 flex w-[292px] flex-col rounded-xs border border-line bg-paper/95 backdrop-blur-md will-change-transform"
    >
      {/*
        Толгой нь зөөх бариул. `touch-none` — хуруугаар чирэхэд хөтөч
        хуудсаа гүйлгэхийг оролдвол самбар мултарна.
      */}
      <div
        {...drag.grip("move")}
        className="flex shrink-0 touch-none cursor-grab items-center justify-between gap-2 border-b border-line px-2.5 py-1.5 select-none active:cursor-grabbing"
      >
        <GripHorizontal size={12} className="shrink-0 text-ink-3" />
        <span className="eyebrow min-w-0 flex-1 truncate">Бүртгэлийн бичилт</span>
        <button
          onClick={onClose}
          className="shrink-0 text-ink-3 transition-colors hover:text-ink"
          aria-label="Хаах"
        >
          <X size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-2 pb-4">
        <div className="text-[12.5px] leading-snug font-medium text-ink">{w.company}</div>
        <div className="mt-1.5">
          <StatusChip state={state} />
        </div>

        <dl className="mt-2.5 space-y-1.5">
          <Field k="Байршил" v={w.place || "—"} />
          <Field k="Дүүрэг" v={districtName(w.district)} />
          <Field k="Зөвшөөрлийн эрх" v={w.rightsRaw || "—"} />
          <Field k="Хадгалах зориулалт" v={w.storage} />
          <Field
            k="Нийт тоо хэмжээ"
            v={
              w.tons == null ? (
                "Бүртгэгдээгүй"
              ) : (
                <span className="num">{num(w.tons, w.tons < 10 ? 3 : 0)} тонн</span>
              )
            }
          />
          <Field
            k="Гэрчилгээний дугаар"
            v={w.certificate == null ? "—" : <span className="num">{w.certificate}</span>}
          />
          <Field
            k="Хүчинтэй хугацаа"
            v={<span className="num">{w.validityRaw || "—"}</span>}
          />
          <Field k="Регистр, гэрчилгээ" v={<span className="num">{w.registry || "—"}</span>} />
          <Field k="Холбоо барих утас" v={<span className="num">{w.phone || "—"}</span>} />
          <Field
            k="Координат"
            v={
              <span className="num">
                {w.lat.toFixed(5)}°, {w.lon.toFixed(5)}°
              </span>
            }
          />
        </dl>

        <div className="mt-3 border-t border-line pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="eyebrow">Бүртгэсэн бодис</span>
            {/*
              МӨРИЙН тоо, нэрийн тоо ХОЁУЛАА. Эх сурвалж нэг бодисыг өөр
              өөр тоо хэмжээгээр хэд хэдэн мөрд бичдэг тул жагсаалтын
              урт нь давхардалгүй нэрийн тооноос их гардаг — зөвхөн
              нэгийг нь бичвэл доорх жагсаалттай зөрж, алдаа мэт харагдана.
            */}
            <span className="num text-[10px] text-ink-3">
              {w.items.length === w.substances.length
                ? `${num(w.substances.length)} нэр`
                : `${num(w.items.length)} мөр · ${num(w.substances.length)} нэр`}
            </span>
          </div>

          <ul className="mt-1.5 space-y-[3px]">
            {w.items.map((it, i) => (
              <li
                key={`${it.name}-${i}`}
                className="flex items-baseline justify-between gap-2"
              >
                <button
                  onClick={() => onSubstance(it.name)}
                  className="min-w-0 flex-1 truncate text-left text-[11px] text-ink-2 transition-colors hover:text-data"
                  title={it.name}
                >
                  {it.name}
                </button>
                {it.qty != null ? (
                  <span className="num shrink-0 text-[10.5px] text-ink-3">
                    {num(it.qty, it.qty < 10 ? 3 : 0)}
                    {/*
                      Нэгжийг эх сурвалж бичээгүй тул бичлэг бүрд нь
                      тооцсон ({@link ../../lib/chemicals}-ийн `qtyUnitOf`).
                      Тогтоогдоогүй бол тоог НЭГЖГҮЙ үлдээнэ — таамаглаж
                      "тонн" гэж бичвэл 1000 дахин алдаа гаргаж болзошгүй.
                    */}
                    {w.qtyUnit ? (
                      <span className="ml-1 text-ink-3">
                        {QTY_UNIT_LABEL[w.qtyUnit]}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

        </div>
      </div>

      {/*
        ХЭМЖЭЭ СОЛИХ бариул — зүүн доод буланд, самбарын тэлэх
        чиглэлийн буланд. Гүйдэг агуулгын ДЭЭР хөвнө; хамгийн доод
        мөрийг дарахгүйн тулд агуулгын доод хэсэгт зай үлдээв.
      */}
      <button
        {...drag.grip("resize")}
        aria-label="Самбарын хэмжээ солих"
        className="absolute bottom-0 left-0 z-10 flex size-4 touch-none cursor-nesw-resize items-end justify-start p-[3px] text-ink-3 transition-colors hover:text-ink"
      >
        <svg viewBox="0 0 10 10" className="size-full" aria-hidden>
          <path
            d="M9 1 1 9M5.5 9H1V4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[92px] shrink-0 text-[10px] leading-snug tracking-[0.06em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink">{v}</dd>
    </div>
  );
}
