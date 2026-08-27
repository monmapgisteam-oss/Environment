"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Building2,
  Leaf,
  Loader2,
  MapPin,
  ShieldAlert,
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
import { DATA_COLOR } from "@/components/wells/colors";
import { FilterBar, FilterMenu, PickList } from "@/components/wells/filter-bar";
import { defaultBasemap, type Basemap, type Extent } from "@/components/wells/map";
import { Bounds } from "@/lib/extent";
import {
  fetchLichenDetail,
  fetchLichens,
  IUCN_LABEL,
  IUCN_ORDER,
  type LichenData,
  type LichenDetail,
} from "@/lib/lichens";
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
 * Хагийн самбар — байгалийн ургамлын олон янз байдал.
 *
 * Дата нь ТАРХАЛТЫН ХҮСНЭГТ (184 зүйл × 41 цэг) тул бусад самбар шиг
 * "хаана хэр их" гэж асуувал буруу зураг гарна: нэг цэгт 178 бичлэг
 * байгаа нь тэнд 178 удаа юм болсон гэсэн үг биш, 178 ЗҮЙЛ бүртгэгдсэн
 * гэсэн үг.
 *
 * Тиймээс бүтэц нь ЗҮЙЛ ТӨВТЭЙ: зүүн талд зүйлийн жагсаалт (хайлттай),
 * төвд бүртгэлийн цэгүүд — цэгийн хэмжээ нь тэнд бүртгэгдсэн зүйлийн
 * тоог хэлнэ, баруун талд ангиллын задаргаа. Зүйл сонгоход газрын
 * зураг тэр зүйл ХААНА тааралддагийг л үлдээж, дэлгэрэнгүй тайлбар нь
 * зургийн доод буланд нээгдэнэ.
 */
export function LichensDashboard() {
  const [data, setData] = React.useState<LichenData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [family, setFamily] = React.useState<string | null>(null);
  const [iucn, setIucn] = React.useState<string | null>(null);
  const [ecogroup, setEcogroup] = React.useState<string | null>(null);
  const [indicator, setIndicator] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<string | null>(null);
  const [species, setSpecies] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [hover, setHover] = React.useState<number | null>(null);
  /** Товшсон бүртгэлийн цэгийн код — тухайн цэгийн зүйлийн жагсаалт руу */
  const [site, setSite] = React.useState<string | null>(null);

  const [detail, setDetail] = React.useState<LichenDetail | null>(null);
  /** Тодорхойлолт нь олдоогүй зүйлийн нэр — эцэс төгсгөлгүй хүлээхээс сэргийлнэ */
  const [missing, setMissing] = React.useState<string | null>(null);

  const [basemap, setBasemap] = React.useState<Basemap>(defaultBasemap);

  React.useEffect(() => {
    let alive = true;
    fetchLichens()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  /*
    Сонгосон зүйлийн урт тайлбарыг тухай бүрд нь татна — 184 зүйлийн
    бичвэрийг урьдчилж татвал хэдэн зуун килобайт дэмий явна.

    Төлөвийг зөвхөн АСИНХРОН буцаалт дотор л бичнэ: effect-ийн биед
    шууд `setState` дуудвал шаталсан дахин зурагдалт үүсгэнэ. "Татаж
    байна" төлөвийг тусад нь хадгалахгүй — сонгосон нэр ба гарт байгаа
    тодорхойлолтын нэр зөрж байгаа нь өөрөө хүлээлтийн шинж.
  */
  React.useEffect(() => {
    if (!species) return;
    let alive = true;
    fetchLichenDetail(species)
      .then((d) => {
        if (!alive) return;
        if (d) setDetail(d);
        else setMissing(species);
      })
      .catch(() => alive && setMissing(species));
    return () => {
      alive = false;
    };
  }, [species]);

  /** Сонгосон зүйлийн IUCN зэрэг — тархалтын мөрөөс уншина */
  const speciesIucn = React.useMemo(
    () => (species ? (data?.rows.find((r) => r.sci === species)?.iucn ?? null) : null),
    [data, species],
  );

  /** Гарт байгаа тодорхойлолт нь СОНГОСОН зүйлийнх мөн үү */
  const shownDetail = species && detail?.sci === species ? detail : null;
  const detailLoading = Boolean(species) && !shownDetail && missing !== species;

  const rows = data?.rows;

  const keep = React.useCallback(
    (
      r: {
        family: string;
        iucn: string;
        ecogroup: string;
        indicator: string;
        district: string;
        siteCode: string;
      },
      skip?: "family" | "iucn" | "ecogroup" | "indicator" | "district" | "site",
    ) => {
      if (skip !== "family" && family && r.family !== family) return false;
      if (skip !== "iucn" && iucn && r.iucn !== iucn) return false;
      if (skip !== "ecogroup" && ecogroup && r.ecogroup !== ecogroup) return false;
      if (skip !== "indicator" && indicator && r.indicator !== indicator) return false;
      if (skip !== "district" && district && r.district !== district) return false;
      /* Цэг сонгосон бол ЗҮЙЛИЙН ЖАГСААЛТ тэр цэгийнхээр хумигдана —
         "энэ уулан дээр юу ургадаг вэ" гэсэн асуултын хариу */
      if (skip !== "site" && site && r.siteCode !== site) return false;
      return true;
    },
    [family, iucn, ecogroup, indicator, district, site],
  );

  const shown = React.useMemo(() => (rows ?? []).filter((r) => keep(r)), [rows, keep]);

  /*
    Зүйлийн жагсаалт — тархалтын мөрүүдээс НЭГТГЭНЭ.

    Нэг зүйл олон цэгт бүртгэгдсэн байдаг тул мөрөөр нь жагсаавал
    давхардана. `sites` нь тухайн зүйл хэдэн цэгт тааралдсаныг хэлнэ.
  */
  const speciesList = React.useMemo(() => {
    const m = new Map<
      string,
      { sci: string; mn: string; family: string; iucn: string; sites: number }
    >();
    for (const r of shown) {
      const hit = m.get(r.sci) ?? {
        sci: r.sci,
        mn: r.mn,
        family: r.family,
        iucn: r.iucn,
        sites: 0,
      };
      hit.sites++;
      m.set(r.sci, hit);
    }
    return [...m.values()].sort((a, b) => b.sites - a.sites || a.sci.localeCompare(b.sci));
  }, [shown]);

  const listed = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase("mn-MN");
    if (!q) return speciesList;
    return speciesList.filter(
      (s) =>
        s.sci.toLocaleLowerCase("mn-MN").includes(q) ||
        s.mn.toLocaleLowerCase("mn-MN").includes(q),
    );
  }, [speciesList, query]);

  /*
    Овог → зүйл гэсэн НЭГ диаграм.

    Урьд нь овог (баруун талд зурвасаар) ба зүйл (зүүн талд жагсаалтаар)
    хоёр тусдаа байсан нь давхардал үүсгэж байв: овог бол зүйлийн
    ЭЦЭГ АНГИЛАЛ болохоос өөр хэмжигдэхүүн биш. Хоёрыг нэг шатлалт
    диаграмд нийлүүлснээр "энэ овогт манайд ямар зүйл бүртгэгдсэн бэ"
    гэдэг нэг товшилтоор нээгдэнэ.

    Утга нь ЦЭГИЙН ТОО (тухайн зүйл хэдэн цэгт тааралдсан) — овгийн
    нийлбэр нь тухайн овгийн бүх тархалтын бичлэг болно.

    Овгийг зүйлийн тоогоор эрэмбэлнэ, дотор нь зүйлүүд тархалтаараа.
  */
  const familyTree = React.useMemo<DatumGroup[]>(() => {
    const m = new Map<string, typeof listed>();
    for (const s of listed) {
      const arr = m.get(s.family) ?? [];
      arr.push(s);
      m.set(s.family, arr);
    }
    return [...m]
      .map(([family, items]) => ({
        key: family,
        label: family,
        total: items.reduce((sum, s) => sum + s.sites, 0),
        rows: items
          .slice()
          .sort((a, b) => b.sites - a.sites || a.sci.localeCompare(b.sci))
          .map((s) => ({ key: s.sci, label: s.sci, value: s.sites })),
      }))
      .sort((a, b) => b.rows.length - a.rows.length || b.total - a.total);
  }, [listed]);

  /*
    Цэг бүрийн зүйлийн тоо. Зүйл сонгогдсон бол ЗӨВХӨН тэр зүйлийн
    тааралдсан цэгүүд үлдэнэ — газрын зураг тархалтын зураг болно.
  */
  const perSite = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      /* Цэгийн сонголтыг АЛГАСНА: тэр нь зүүн талын жагсаалтыг л
         хумина. Газрын зураг бусад цэгээ хэвээр харуулах ёстой —
         эс тэгвээс "энэ зүйл өөр хаана байдаг вэ" гэдэг алга болно */
      if (!keep(r, "site")) continue;
      if (species && r.sci !== species) continue;
      m.set(r.siteCode, (m.get(r.siteCode) ?? 0) + 1);
    }
    return m;
  }, [rows, keep, species]);

  /*
    Шүүлт тавиагүй үед БҮХ цэг харагдана — 9 цэг нь судлагдсан боловч
    зүйл хавсрагдаагүй (`site_only`) бөгөөд тэднийг нуувал судалгааны
    хамрах хүрээ байгаагаас бага мэт харагдана. Шүүлт эсвэл зүйл
    сонгосон үед л таарсан цэг үлдэнэ.
  */
  const filtered = Boolean(
    species || family || iucn || ecogroup || indicator || district,
  );

  const visible = React.useMemo(() => {
    if (!data) return new Uint32Array(0);
    const out: number[] = [];
    data.sites.forEach((s, i) => {
      if (!filtered || (perSite.get(s.code) ?? 0) > 0) out.push(i);
    });
    return Uint32Array.from(out);
  }, [data, perSite, filtered]);

  /*
    Цэгийн ХЭМЖЭЭ нь зүйлийн тоог хэлнэ.

    Өнгө нь бүх цэгт ИЖИЛ (`DATA_COLOR`) — зэрэглэлийн хоёр үзүүрт нэг
    өнгө өгснөөр зөвхөн радиус нь хэмжигдэхүүнийг үүрнэ. Дата дүрслэлийн
    өнгө ганц гэсэн дүрэм хэвээр.

    ⚠️ `pulse` тэмдэглэгээ асаалттай үед энэ хэмжээ нь ДОХИОЛЛЫН цэгэн
    доор далдлагдана — зэрэглэл нь тодруулах давхарга болж үлдэнэ.
    Зүйлийн тоог тайлбар цонхноос уншина.
  */
  const grades = React.useMemo(() => {
    if (!data) return undefined;
    const values = Float32Array.from(data.sites, (s) => perSite.get(s.code) ?? 0);
    let hi = 0;
    for (const v of values) if (v > hi) hi = v;
    return {
      values,
      stops: [
        [0, DATA_COLOR],
        [Math.max(hi, 1), DATA_COLOR],
      ] as [number, string][],
    };
  }, [data, perSite]);

  /* Цэгийн шошго — байршлын нэр */
  const labels = React.useMemo(() => {
    if (!data) return undefined;
    return { text: data.sites.map((s) => s.name), minzoom: 9 };
  }, [data]);

  /* ---------------- Задаргаа ----------------

     Бүгд БИЧЛЭГИЙН тоогоор: нэг зүйл олон цэгт бүртгэгдсэн байж болох
     тул "зүйлийн тоо" гэж нэрлэвэл буруу болно. Мөр бүр нь тархалтын
     нэг баримт. */
  const byFamily = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "family")) continue;
      m.set(r.family, (m.get(r.family) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const byIucn = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "iucn")) continue;
      m.set(r.iucn, (m.get(r.iucn) ?? 0) + 1);
    }
    /* Эрсдэл өсөх ТОГТМОЛ дараалал — тоогоор эрэмбэлбэл шүүлт бүрд
       мөрүүд байраа солино */
    const order = [...IUCN_ORDER, "—"];
    return order
      .filter((k) => m.has(k))
      .map((k) => ({ key: k, label: IUCN_LABEL[k] ?? k, value: m.get(k) ?? 0 }));
  }, [rows, keep]);

  const byEcogroup = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "ecogroup")) continue;
      m.set(r.ecogroup, (m.get(r.ecogroup) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const byIndicator = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "indicator")) continue;
      m.set(r.indicator, (m.get(r.indicator) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const byDistrict = React.useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r, "district")) continue;
      m.set(r.district, (m.get(r.district) ?? 0) + 1);
    }
    return [...m]
      .map(([k, v]) => ({ key: k, label: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows, keep]);

  const stats = React.useMemo(() => {
    const sites = new Set(shown.map((r) => r.siteCode));
    const rare = shown.filter((r) => ["VU", "EN", "CR"].includes(r.iucn));
    return {
      species: speciesList.length,
      sites: sites.size,
      families: new Set(shown.map((r) => r.family)).size,
      rare: new Set(rare.map((r) => r.sci)).size,
    };
  }, [shown, speciesList]);

  /* ---------------- Сонголтын хүрээ (zoom action) ---------------- */
  const focus = React.useMemo<Extent | null>(() => {
    if (!data) return null;
    /* Цэг сонгосон бол ЗӨВХӨН түүн рүү — сонголт нь тухайн цэгийн
       зүйлийн жагсаалтыг харах үйлдэл тул зураг ч тийш нь очно */
    if (site) {
      const s = data.sites.find((x) => x.code === site);
      if (!s) return null;
      const b = new Bounds();
      b.add(s.lon, s.lat);
      return b.get(0.006);
    }
    if (!species && !family && !iucn && !ecogroup && !indicator && !district)
      return null;
    const b = new Bounds();
    for (const s of data.sites) {
      if ((perSite.get(s.code) ?? 0) > 0) b.add(s.lon, s.lat);
    }
    return b.get(0.01);
  }, [data, perSite, site, species, family, iucn, ecogroup, indicator, district]);

  /**
   * Сонгосон зүйл ХААНА тааралдсан вэ.
   *
   * Цэгийн сонголтыг алгасна — цэг сонгосон ч тухайн зүйлийн БҮХ
   * байршил харагдах ёстой, эс тэгвээс жагсаалт нэг мөр болж хумигдана.
   */
  const speciesSites = React.useMemo(() => {
    if (!species || !data) return [];
    const codes = new Set(
      (rows ?? [])
        .filter((r) => r.sci === species && keep(r, "site"))
        .map((r) => r.siteCode),
    );
    return data.sites.filter((s) => codes.has(s.code));
  }, [data, rows, keep, species]);

  /** Судлагдсан боловч зүйл хавсрагдаагүй цэгийн тоо */
  const emptySites = React.useMemo(
    () => (data?.sites ?? []).filter((s) => s.species === 0).length,
    [data],
  );

  const activeSite = React.useMemo(() => {
    if (hover == null || !data) return null;
    const s = data.sites[hover - 1];
    return s ? { s, n: perSite.get(s.code) ?? 0 } : null;
  }, [data, hover, perSite]);

  function reset() {
    setFamily(null);
    setIucn(null);
    setEcogroup(null);
    setIndicator(null);
    setDistrict(null);
    setSpecies(null);
    setSite(null);
    setQuery("");
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] font-medium">Эх сурвалж татагдсангүй</p>
            <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
          </div>
        ) : (
          <span className="flex items-center gap-2 text-[13.5px] text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            Хагийн тархалтын мэдээлэл татаж байна…
          </span>
        )}
      </div>
    );
  }

  const activeCount =
    (family ? 1 : 0) +
    (iucn ? 1 : 0) +
    (ecogroup ? 1 : 0) +
    (indicator ? 1 : 0) +
    (district ? 1 : 0) +
    (species ? 1 : 0) +
    (site ? 1 : 0);

  const siteName = site ? data.sites.find((s) => s.code === site)?.name : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <FilterBar
        title="Хаг"
        activeCount={activeCount}
        onReset={reset}
        /* Товшсон цэг нь цэсээр биш зурган дээрээс сонгогддог тул
           шүүлтүүрийн товчны дунд биш гарчгийн хажууд тэмдэглэгдэнэ */
        leading={
          siteName ? (
            <button
              onClick={() => setSite(null)}
              className="flex items-center gap-1 rounded-xs border border-data/40 bg-data/12 px-1.5 py-[3px] text-[11px] text-data transition-colors hover:bg-data/20"
            >
              <MapPin size={10} strokeWidth={2} />
              {siteName}
              <X size={10} strokeWidth={2} />
            </button>
          ) : null
        }
      >
        <FilterMenu
          label="Овог"
          icon={Leaf}
          value={family}
          active={Boolean(family)}
          onClear={() => setFamily(null)}
          width={280}
        >
          <PickList items={byFamily} selected={family} onPick={setFamily} searchable />
        </FilterMenu>

        <FilterMenu
          label="Ховордол"
          icon={ShieldAlert}
          value={iucn}
          active={Boolean(iucn)}
          onClear={() => setIucn(null)}
          width={280}
        >
          <PickList items={byIucn} selected={iucn} onPick={setIucn} />
        </FilterMenu>

        <FilterMenu
          label="Экологийн бүлэг"
          icon={Sprout}
          value={ecogroup}
          active={Boolean(ecogroup)}
          onClear={() => setEcogroup(null)}
          width={250}
        >
          <PickList items={byEcogroup} selected={ecogroup} onPick={setEcogroup} />
        </FilterMenu>

        {/*
          Индикатор чанар — хаг нь орчны төлөв байдлын биоиндикатор
          бөгөөд аль чанараар нь индикатор болохыг эх сурвалж зүйл бүрд
          бичсэн байдаг. "Агаар орчны цэвэр байдлын" индикаторуудыг
          ялган харах нь энэ датаны хамгийн практик хэрэглээ.
        */}
        <FilterMenu
          label="Индикатор"
          icon={Activity}
          value={indicator}
          active={Boolean(indicator)}
          onClear={() => setIndicator(null)}
          width={300}
        >
          <PickList items={byIndicator} selected={indicator} onPick={setIndicator} />
        </FilterMenu>

        <FilterMenu
          label="Дүүрэг"
          icon={Building2}
          value={district}
          active={Boolean(district)}
          onClear={() => setDistrict(null)}
          width={230}
        >
          <PickList items={byDistrict} selected={district} onPick={setDistrict} />
        </FilterMenu>
      </FilterBar>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
        {/* ---- ЗҮҮН: овог → зүйл, нэг шатлалт диаграм ---- */}
        <Card className="min-h-[180px] flex-1 xl:w-[320px] xl:flex-none 2xl:w-[350px]">
          <Head title="Овог, зүйл">
            <span className="num text-[11.5px] text-ink-3">
              {num(familyTree.length)} овог · {num(listed.length)} зүйл
            </span>
          </Head>
          <div className="shrink-0 border-b border-line p-2">
            {/* Хайлт нь ЗҮЙЛИЙГ шүүнэ — овог нь зүйлээ алдвал өөрөө
                жагсаалтаас унана */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Латин эсвэл монгол нэрээр хайх…"
              className="h-7 w-full rounded-xs border border-line bg-paper px-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-line-2"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {familyTree.length > 0 ? (
              <GroupedRowChart
                groups={familyTree}
                selected={species}
                onSelect={setSpecies}
                selectedGroup={family}
                onSelectGroup={setFamily}
                /* 32 овог тул хураасан байдлаар нээгдэнэ — бүгд задарвал
                   181 мөр болж, гүйлгэхээс өөр аргагүй болно */
                defaultOpen="none"
                storageKey="hag.family"
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
              {/* Цэг цөөхөн (41) тул бөөгнөрүүлэхгүй */}
              <PointMap
                points={data.points}
                visible={visible}
                labels={labels}
                grades={grades}
                /* Цэгүүд стикерийн самбар шиг ДОХИОЛЛЫН тэмдэглэгээтэй:
                   41 бүртгэлийн цэг хиймэл дагуулын өнгө өтгөн зурган
                   дээр жижиг цэгээр төдийлөн ялгарахгүй байв */
                pulse
                basemap={basemap}
                /* Цэг товшиход зүүн талын жагсаалт ТЭР ЦЭГИЙН зүйлээр
                   хумигдана — "энэ уулан дээр юу ургадаг вэ" гэдэг нь
                   энэ датаны хамгийн байнга асуугддаг асуулт */
                onSelect={(i) => {
                  const code = data.sites[i - 1]?.code ?? null;
                  setSite(site === code ? null : code);
                }}
                onHover={setHover}
                focus={focus}
                cluster={false}
              />
              <BasemapGallery value={basemap} onChange={setBasemap} />

              {activeSite ? (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 max-w-[260px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-md">
                  <div className="eyebrow mb-1.5">{activeSite.s.code}</div>
                  <div className="text-[12.5px] leading-snug text-ink">
                    {activeSite.s.name}
                  </div>
                  <div className="num mt-1 text-[11.5px] text-ink-2">
                    {num(activeSite.n)} зүйл
                  </div>
                  <div className="mt-1 text-[10.5px] leading-snug text-ink-3">
                    {activeSite.s.district}
                    {activeSite.s.elev != null
                      ? ` · д.т.д. ${num(activeSite.s.elev)} м`
                      : ""}
                  </div>
                </div>
              ) : null}

              {/*
                Сонгосон зүйлийн дэлгэрэнгүй. Урт бичвэр тул хөвөгч
                самбарт — жагсаалтын мөрөнд багтахгүй. Хөвөгч гадаргуу
                тул `.elevated` сүүдэр зөвшөөрөгдөнө.
              */}
              {species ? (
                <div className="elevated absolute right-2.5 bottom-2.5 z-10 max-h-[70%] w-[300px] overflow-hidden rounded-xs border border-line bg-paper/95 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
                    <span className="eyebrow truncate">Зүйлийн тодорхойлолт</span>
                    <button
                      onClick={() => setSpecies(null)}
                      className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                      aria-label="Хаах"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="max-h-[calc(70vh-40px)] overflow-y-auto p-2.5">
                    {detailLoading ? (
                      <div className="flex items-center gap-2 py-2 text-ink-3">
                        <Loader2 size={12} className="animate-spin" />
                        <span className="text-[12px]">Татаж байна…</span>
                      </div>
                    ) : shownDetail ? (
                      <>
                        {/*
                          Ховордлын зэрэг ЭНД гарна. Урьд нь зүйлийн
                          жагсаалтын мөр бүр дээр байсан ч тэр жагсаалт
                          овог-зүйлийн диаграм болж өөрчлөгдсөн —
                          зурвасан мөрөнд тэмдэг багтахгүй.
                        */}
                        <div className="flex items-start gap-1.5">
                          <span className="min-w-0 flex-1 text-[13px] leading-snug italic text-ink">
                            {shownDetail.sci}
                          </span>
                          {speciesIucn && speciesIucn !== "—" ? (
                            <IucnChip code={speciesIucn} />
                          ) : null}
                        </div>
                        {shownDetail.author ? (
                          <div className="mt-0.5 text-[10.5px] text-ink-3">
                            {shownDetail.author}
                          </div>
                        ) : null}
                        {shownDetail.mn ? (
                          <div className="mt-1 text-[12px] text-ink-2">{shownDetail.mn}</div>
                        ) : null}
                        <dl className="mt-2 space-y-1.5 border-t border-line pt-2">
                          <Field k="Амьдрах орчин" v={shownDetail.habitat} />
                          <Field k="Суурь" v={shownDetail.substrate} />
                          <Field k="Амьдралын хэлбэр" v={shownDetail.adaptation} />
                          <Field k="Үржил" v={shownDetail.reprod} />
                          <Field k="Тархац" v={shownDetail.distrStat} />
                          <Field k="Экологийн үүрэг" v={shownDetail.ecorole} />
                          <Field k="Ашиглалт" v={shownDetail.use} />
                        </dl>

                        {/*
                          ХААНА тааралддаг вэ — энэ самбарын гол асуулт.
                          Тайлбарын талбарууд нь зүйлийг ерөнхийд нь
                          тодорхойлдог бол энэ жагсаалт нь ЭНЭ хотод
                          бодитоор бүртгэгдсэн цэгүүдийг нэрлэнэ.
                        */}
                        {speciesSites.length > 0 ? (
                          <div className="mt-2 border-t border-line pt-2">
                            <div className="eyebrow mb-1.5">
                              Бүртгэгдсэн цэг · {num(speciesSites.length)}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {speciesSites.map((s) => (
                                <button
                                  key={s.code}
                                  onClick={() => setSite(site === s.code ? null : s.code)}
                                  className={cn(
                                    "rounded-xs border px-1.5 py-[2px] text-[10.5px] transition-colors",
                                    site === s.code
                                      ? "border-data/45 bg-data/12 text-data"
                                      : "border-line text-ink-2 hover:bg-paper-hi hover:text-ink",
                                  )}
                                >
                                  {s.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {shownDetail.diag ? (
                          <div className="mt-2 border-t border-line pt-2">
                            <div className="eyebrow mb-1">Оношлох шинж</div>
                            <p className="text-[11.5px] leading-snug text-ink-2">
                              {shownDetail.diag}
                            </p>
                          </div>
                        ) : null}
                        {shownDetail.status ? (
                          <div className="mt-2 border-t border-line pt-2">
                            <div className="eyebrow mb-1">Одоогийн байдал</div>
                            <p className="text-[11.5px] leading-snug text-ink-2">
                              {shownDetail.status}
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="py-2 text-[12px] text-ink-3">Тодорхойлолт олдсонгүй</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <p className="shrink-0 px-0.5 text-[10.5px] leading-none text-ink-3">
            Суурь зураг: Esri · Дата: ArcGIS · {num(data.sites.length)} бүртгэлийн цэг ·
            зүйлийн тоо нь цэг дээр хулгана аваачихад
            {emptySites > 0 ? ` · ${num(emptySites)} цэгт зүйл хавсрагдаагүй` : ""}
            {data.noDistrib > 0
              ? ` · ${num(data.noDistrib)} зүйл координатгүй тул зурагт ороогүй`
              : ""}
          </p>
        </div>

        {/* ---- БАРУУН: индикатор + ангиллын задаргаа ---- */}
        <div className="flex min-h-0 flex-col gap-2.5 xl:w-[300px] xl:shrink-0">
          <Card className="shrink-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Stat icon={Leaf} label="Зүйл" value={num(stats.species)} />
              <Stat icon={MapPin} label="Бүртгэлийн цэг" value={num(stats.sites)} />
              <Stat icon={Sprout} label="Овог" value={num(stats.families)} />
              {/* Ховордсон зэрэгтэй зүйл — үйлдэл шаардах цорын ганц тоо */}
              <Stat icon={ShieldAlert} label="VU · EN · CR зүйл" value={num(stats.rare)} />
            </div>
          </Card>

          <Card className="shrink-0">
            <Head title="Ховордлын зэргээр">
              <span className="text-[10.5px] text-ink-3">бүртгэл</span>
            </Head>
            <div className="p-3">
              <RowChart data={byIucn} selected={iucn} onSelect={setIucn} />
            </div>
          </Card>

          {/*
            Мөрийн СҮҮЛД нь уян карт — экологийн бүлэг.

            Овгийн задаргаа энд БАЙХГҮЙ болов: зүүн талын "Овог, зүйл"
            диаграм түүнийг зүйлийнхээ хамт харуулж байгаа тул давхардал
            байсан. Оронд нь экологийн бүлэг — хаг ямар нөхцөлд ургахыг
            заадаг бөгөөд ангилал зүйн бус ЭКОЛОГИЙН тэнхлэг тул овогтой
            огт өөр асуултад хариулна.
          */}
          <Card className="min-h-[120px] flex-1">
            <Head title="Экологийн бүлгээр">
              <span className="text-[10.5px] text-ink-3">бүртгэл</span>
            </Head>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <RowChart data={byEcogroup} selected={ecogroup} onSelect={setEcogroup} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * IUCN зэргийн тэмдэг.
 *
 * Ховордсон гурван зэрэг (VU/EN/CR) дээр л анхааруулгын өнгө гарна —
 * бусад нь саарал. Өнгө = утга: "энд анхаарах зүйл байна" гэсэн дохио
 * бөгөөд ангилал ялгах чимэг биш.
 */
function IucnChip({ code }: { code: string }) {
  const risky = code === "VU" || code === "EN" || code === "CR";
  return (
    <span
      title={IUCN_LABEL[code] ?? code}
      className={cn(
        "num shrink-0 rounded-[2px] px-1 py-[1px] text-[9.5px] leading-none",
        risky ? "bg-clay/15 text-clay" : "bg-paper-hi text-ink-3",
      )}
    >
      {code}
    </span>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  if (!v || v === "тодорхойгүй") return null;
  return (
    <div className="flex gap-2">
      <dt className="w-[86px] shrink-0 text-[10px] tracking-[0.06em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-2">{v}</dd>
    </div>
  );
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
