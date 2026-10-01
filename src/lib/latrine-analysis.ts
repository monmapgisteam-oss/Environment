/*
  НҮХЭН ЖОРЛОНГИЙН АЗОТЫН УРСАЦ, НЭВЧИЛТИЙН ДҮН ШИНЖИЛГЭЭ

  Эх сурвалж нь бүртгэл БИШ, ЗАГВАРЧЛАЛЫН үр дүн: хотын 145,462 нүхэн
  жорлонг ~400 метрийн зургаан өнцөгт торонд нэгтгэж, нүд бүрд
  азотын жилийн ачаалал, тэр азот нь ГАДАРГУУГААР урсах уу (гол, гуу
  руу) эсвэл ГАЗАР ДООШ нэвчих үү гэдгийг рельеф, хөрс, ургамлан
  бүрхэвчийн раснтераас тооцсон.

  ⚠⚠ ЖОРЛОНГИЙН ТОО ПЛАТФОРМЫН ДАВХАРГАТАЙ ЯГ ТААРНА: 145,462 —
  хүрээлэн буй орчны хэлтсийн `X10_UB_pit_toilet`-тэй нэг эх үүсвэр.
  Тиймээс энэ нь тусдаа тооллого БИШ, тэр давхаргын ДҮН ШИНЖИЛГЭЭ.

  ⚠ Дата нь `public/data/latrine-analysis.json`-д БАГЦЛАГДСАН
  ({@link scripts/build-latrine-analysis.mjs}) — эх судалгаа нь репогоос
  гадна, растер ба GeoPackage нийлээд хэдэн зуун МБ.

  ⚠⚠ ГЕОМЕТР НЬ ТӨВӨӨРӨӨ ХАДГАЛАГДСАН. Тор нь жигд тул зургаан
  өнцөгтийн оройг нүд бүрд бичих нь 2.5 МБ (дийлэнх нь давхардал);
  төв + НЭГ дундаж офсет нь 343 КБ. Оройг хөтөч угсарна ({@link
  hexRing}) — хот даяар зөрүү нь 2–5 метр (хэмжсэн).
*/
import { asset } from "@/lib/base-path";

/** Нүд бүрийн утга — баганаар хадгалагдаж, уншихад мөр болно */
export type Cell = {
  id: number;
  lon: number;
  lat: number;
  /** Тэр нүдэнд бүртгэгдсэн нүхэн жорлонгийн тоо */
  n: number;
  /** Азотын ачаалал, кг/жил */
  load: number;
  /** Урсацын индекс — гадаргуугаар зөөгдөх хэсэг */
  ri: number;
  /** Нэвчилтийн индекс — газар доош шингэх хэсэг */
  li: number;
  /** Урсац, нэвчилтийн зэрэглэл (1–3), торын гурван тэнцүү бүлэг */
  ric: number;
  lic: number;
  /** Усны голдирлоос дээших өндөр, м */
  hand: number;
  /** Налуу, градус */
  slope: number;
  /** Урсгалын урт, м */
  flow: number;
  /** Урсацын коэффициент — зун, цас хайлалт */
  rcSummer: number;
  rcMelt: number;
  /** Ачааллын хэдэн хувь нь урсацаар явах */
  share: number;
};

export type Validation = {
  /** Хөрсний хэмжилт — юутай харьцуулсан */
  target: string;
  /** Жорлонгийн ойролцоо байдлын хэмжүүр */
  predictor: string;
  /** Хэдэн цэг дээр */
  n: number;
  /** Спирмэний эрэмбийн хамаарал */
  rho: number;
  p: number;
};

export type Analysis = {
  cells: Cell[];
  /** Нэгж зургаан өнцөгтийн оройн офсет (зургаан цэг) */
  shape: [number, number][];
  validation: Validation[];
  /** Нийт жорлон, нийт ачаалал (кг/жил), урсацаар явах хэсэг */
  latrines: number;
  load: number;
  runoff: number;
  leach: number;
};

type Packed = {
  shape: [number, number][];
  lon: number[];
  lat: number[];
  n: number[];
  load: number[];
  ri: number[];
  li: number[];
  ric: number[];
  lic: number[];
  hand: number[];
  slope: number[];
  flow: number[];
  rcSummer: number[];
  rcMelt: number[];
  share: number[];
  validation: Validation[];
};

let cache: Promise<Analysis> | null = null;

export function fetchAnalysis(): Promise<Analysis> {
  cache ??= load().catch((err) => {
    cache = null; /* Унасан амлалтыг кэшид үлдээхгүй */
    throw err;
  });
  return cache;
}

async function load(): Promise<Analysis> {
  /* eslint-disable-next-line no-restricted-globals -- статик JSON, ArcGIS биш */
  const res = await fetch(asset("/data/latrine-analysis.json"));
  if (!res.ok) throw new Error(`Судалгааны дата уншигдсангүй (${res.status})`);
  const p: Packed = await res.json();

  const cells: Cell[] = p.lon.map((lon, i) => ({
    id: i,
    lon,
    lat: p.lat[i],
    n: p.n[i],
    load: p.load[i],
    ri: p.ri[i],
    li: p.li[i],
    ric: p.ric[i],
    lic: p.lic[i],
    hand: p.hand[i],
    slope: p.slope[i],
    flow: p.flow[i],
    rcSummer: p.rcSummer[i],
    rcMelt: p.rcMelt[i],
    share: p.share[i],
  }));

  const sum = (read: (c: Cell) => number) => cells.reduce((a, c) => a + read(c), 0);
  return {
    cells,
    shape: p.shape,
    validation: p.validation,
    latrines: sum((c) => c.n),
    load: sum((c) => c.load),
    runoff: sum((c) => c.ri),
    leach: sum((c) => c.li),
  };
}

/** Төв ба нэгж офсетоос зургаан өнцөгтийн цагирагийг сэргээнэ */
export function hexRing(
  cell: Cell,
  shape: [number, number][],
): [number, number][] {
  const ring = shape.map(
    ([dx, dy]) => [cell.lon + dx, cell.lat + dy] as [number, number],
  );
  ring.push(ring[0]); /* GeoJSON цагираг хаалттай байна */
  return ring;
}
