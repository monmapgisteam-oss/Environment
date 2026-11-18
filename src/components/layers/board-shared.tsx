"use client";

import { zoomForScale } from "@/components/wells/map";
import { oklchHex } from "@/components/wells/colors";
import { Bounds, pointOf } from "@/lib/extent";
import { inUlaanbaatar } from "@/lib/ub-boundary";
import {
  categoryKey,
  splitsZones,
  type Breakdown,
  type LayerLabels,
  type LayerFeatures,
  type LayerSet,
  type LayerInfo,
} from "@/lib/portal-layers";
import type { TabRule } from "@/lib/access";
import { isTime, measureText } from "./chart-helpers";

/**
 * ТООЦООЛСОН ДҮҮРГИЙН ШҮҮЛТИЙН ТҮЛХҮҮР ({@link LayerSet.districts}).
 * Эх сурвалжийн талбар биш — `views`-ийн `keyBy` түүнийг дүрсийн
 * дугаараар (`districtsOf`) хариулна.
 */
export const DISTRICT_KEY = "__district";

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
export function toneOfHue(hue: number, l = 0.74, c = 0.15): string {
  return oklchHex(l, c, hue);
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
export function categoryRamp(hue: number, n: number): string[] {
  if (n <= 1) return [oklchHex(0.74, 0.15, hue)];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return oklchHex(0.88 - t * 0.42, 0.12 + Math.sin(t * Math.PI) * 0.05, hue);
  });
}

/**
 * ДҮРСИЙН ХЭМЖЭЭ — зурагдах дарааллыг шийдэхэд.
 *
 * ⚠⚠ ҮҮРЛЭСЭН ДҮРС ДАРАГДАЖ БАЙВ (2026-09-30, хэрэглэгч зургаар:
 * "өнгө ялгарч танигдахгүй бн"). Булгийн 50 м-ийн бүс нь 200 м-ийн
 * бүсийнхээ ДОТОР бүтнээрээ сууна. Нэг `fill` давхаргад дүрсүүд эх
 * сурвалжийн ДАРААЛЛААР зурагддаг тул том бүс сүүлд тохиовол жижгийг
 * нь бүрэн хучиж, зөвхөн хүрээ нь үлдэнэ — хоёр өнгө байсан ч ганц
 * өнгө харагдана.
 * ⚠ Одоо ТОМ нь эхлээд, ЖИЖИГ нь ДЭЭР нь зурагдана. Давхцахгүй
 * дүрсэнд ямар ч нөлөөгүй: зөвхөн давхцсан газрын дараалал тогтвортой
 * болно (урьд нь эх сурвалжийн санамсаргүй дараалал байв).
 * ⚠ Хэмжээ нь ХҮРЭЭНИЙ талбай — жинхэнэ талбай биш: дараалал тогтооход
 * хангалттай бөгөөд үүрлэсэн дүрсэнд хоёр хэмжүүр ижил хариу өгнө.
 * ⚠ Дүрс бүрд НЭГ УДАА бодогдоно (`WeakMap`): шүүлт тавих бүрд
 * долоон мянган олон өнцөгтийн оройг дахин тоолох нь утгагүй.
 */
/**
 * ДАВХЦАХ НЭГЖ ТАЛБАРЫГ ЗАДЛАХ ТЭНХЛЭГ ({@link LayerSet.parcelBy}).
 *
 * Давхаргын дүрсүүдийг заасан талбарын утгаар бүлэглэнэ: бүлэг бүр
 * нэг хүсэлт болж, сервер давхцлыг тоолно.
 *
 * ⚠ Бүлгийн түлхүүр нь задаргааны ӨӨРИЙН `keyOf` — диаграм, шүүлт,
 * өнгө гурвуулаа нэг эх сурвалжаас.
 * ⚠ Дараалал нь задаргаанаас: тоогоороо эрэмбэлэгдсэн хэвээр.
 * ⚠ Цэвэр функц тул модулийн түвшинд — бүрэлдэхүүн доторх давталт,
 * эрт буцалт хоёр нь React Compiler-ийн мемоизацийг тасалдаг.
 */
export function parcelAxisOf(
  field: string | undefined,
  on: readonly string[],
  loaded: Record<string, Loaded>,
): {
  id: string;
  label: string;
  order: string[];
  groups: Map<string, GeoJSON.Feature[]>;
} | null {
  if (!field) return null;
  for (const id of on) {
    const hit = loaded[id];
    if (!hit || hit.info.geometry === "Point") continue;
    const b = hit.charts.find((c) => c.field === field && c.kind === "count");
    if (!b) continue;
    /*
      ⚠⚠ ГЕОМЕТР ХОЖИМ ИРНЭ: давхарга атрибутаараа эхлээд ирдэг
      ({@link fetchLayerFeatures}) тул дүрсээр нь шүүвэл карт хэдэн
      секунд огт үүсэхгүй. Ангиллын НЭР, ДАРААЛАЛ нь задаргаанаас
      (атрибут) гардаг тул картыг шууд үүсгээд, тооллыг нь дүрс ирэхэд
      бодно (хэрэглэгч, 2026-10-02: "нэгж талбарын chart байнга
      харагдана шүү").
    */
    const groups = new Map<string, GeoJSON.Feature[]>();
    for (const f of hit.data.shapes.features) {
      const row = hit.data.rows[Number(f.id)];
      if (!row) continue;
      for (const key of b.keyOf(row))
        groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    return {
      id,
      label: b.label,
      order: b.values.map((v) => v.key),
      groups,
    };
  }
  return null;
}

/**
 * БҮСТЭЙ ДАВХЦСАН НЭГЖ ТАЛБАРЫН ДЭЭД ХЭМЖЭЭ — нэг татацад.
 *
 * ⚠⚠ Туулын татамтай **87,947** нэгж талбар давхцдаг (2026-10-02-нд
 * токеноор хэмжсэн): бүгдийг татвал хэдэн арван мегабайт, хотын төв
 * бүхэлдээ улаан тор болж доорх хиймэл дагуул, татам хоёулаа дарагдана.
 *
 * Тиймээс цагирагийг ХАРАГДАХ ХҮРЭЭГЭЭР тайрч ({@link clipRings}), үр
 * дүн нь энэ хязгаараас хэтэрвэл ОГТ ТАТАХГҮЙ — зөвхөн тоог нь хэлж
 * "ойртоно уу" гэнэ. Хагас татсан тор нь "эдгээр л давхцаж байна"
 * гэсэн ХУДАЛ зураг гаргана.
 *
 * ⚠ ХЭМЖСЭН (2026-10-02, бодит үйлчилгээ): дүүргийн харагдац (~6 км)
 * нь **5,195 нэгж талбар · 0.6 секунд · 1.4 МБ**; 1:120 000 (~44 км)
 * нь **72,713 · ≈14 МБ · 37 хуудас**.
 *
 * ⚠ Хязгаар нь ХАМГААЛАЛТ болохоос ХААЛТ биш: хаалтыг масштаб
 * ({@link ZONE_SCALE}) тавина. Энэ нь зөвхөн "татам бүхэлдээ
 * харагдаж байхад 88 мянгыг татах" тохиолдлоос сэргийлнэ.
 */
export const ZONE_LIMIT = 80000;

/**
 * БҮСТЭЙ ДАВХЦСАН НЭГЖ ТАЛБАР ЭНЭ МАСШТАБААС ХАРАГДАНА.
 *
 * ⚠ Хязгаарыг ойртолтоор БИШ ХАРЬЦААГААР: зургийн буланд гарах заалт
 * мөн харьцаагаар бичигддэг тул хэрэглэгч хэдээс эхлэн гарахыг
 * тэндээс шууд уншина (шошго, суурь нэгж талбартай нэг зарчим).
 *
 * ⚠⚠ **1:120 000-ААС 1:30 000 БОЛСОН** (хэрэглэгчийн шийдвэр,
 * 2026-10-02: "удаан байна шүү" → хурдыг сонгов). Зааг нь ХУРДЫГ
 * ШУУД тодорхойлно — татац нь давхцлын ТООНООС хамаарна (2026-10-02-нд
 * бодит үйлчилгээн дээр хэмжсэн):
 *
 * | Масштаб | Өргөн | Давхцал | Хугацаа |
 * |---|---|---|---|
 * | 1:120 000 | 44 км | 72,713 | ≈22 с · 37 хуудас · 14 МБ |
 * | 1:60 000 | 22 км | 38,161 | ≈12 с |
 * | **1:30 000** | 11 км | **11,366** | **≈1.8 с** |
 * | 1:13 000 | 5 км | 3,990 | ≈1.2 с |
 *
 * ⚠ Сервер хуудас бүрд ~0.3 секунд зарцуулдаг бөгөөд ЗЭРЭГЦЭЭГ нэмэх
 * нь тус болохгүй (хэмжсэн: 37 хуудас зэрэг 32.5 с, 6-аар бүлэглэхэд
 * 32.9 с) — хурдны цорын ганц хөшүүрэг нь ЗААГ.
 * ⚠ Хол байхад давхцлын тоо нь ДИАГРАМААР гарсаар байна ("Давхцаж
 * буй нэгж талбар — Сав газар") тул тоон хариулт алдагдахгүй: зөвхөн
 * зураг дээрх тор нь ойртсон үед гарна.
 */
export const ZONE_SCALE = 30_000;

export const SPANS = new WeakMap<GeoJSON.Feature, number>();

export function shapeSpan(f: GeoJSON.Feature): number {
  const seen = SPANS.get(f);
  if (seen != null) return seen;
  const b = new Bounds();
  b.addGeometry(f.geometry);
  const e = b.get(0);
  const span = e ? (e[2] - e[0]) * (e[3] - e[1]) : 0;
  SPANS.set(f, span);
  return span;
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
export function seriesRamp(hue: number, n: number): string[] {
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
export const MAX_COLOR_VALUES = 12;

/**
 * "Дүрс тус бүрийн талбай" диаграмд харагдах дээд мөр.
 *
 * Мөр нь бичлэгийн тоотой тэнцдэг тул хязгааргүй бол мянган мөртэй
 * карт гарна. Хорь нь `nameField`-ийн хураалттай нэг тоо — хураасан
 * гэдгээ гарчигтаа ИЛ хэлнэ.
 */
export const AREA_TOP = 20;

/**
 * Баганаа дүүргэх ганц карт ({@link LayerSet.fillSolo}) хэдэн ангилал
 * хүртэл БОСОО баганаар зурагдах вэ. Үүнээс олон бол хэвтээ зурвас —
 * нарийн (~520px) картад есөөс олон багана нэрээ тайрна.
 */
export const SOLO_COLUMNS = 8;

/**
 * Давхаргын дугаарын орон зай.
 *
 * Найман давхарга бүгд `OBJECTID`-гоо 1-ээс эхлүүлдэг тул нэг зураг
 * дээр нийлэхэд мөргөлдөнө. Давхаргын индексээр шилжүүлж нэрийн орон
 * зайд оруулна: `uid = index * STRIDE + oid`.
 */
export const STRIDE = 1_000_000;

export const NO_INDEX = new Uint32Array(0);

export type Loaded = {
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
export const LABEL_SCALE = 496_000;

export const LABEL_ZOOM = zoomForScale(LABEL_SCALE);

/** Хүрэшгүй ойртолт — давхаргыг унтраахад хэрэглэнэ */
export const OFF_ZOOM = 24;

/**
 * Давхаргын ТЭРГҮҮЛЭХ тооллын задаргааны талбар — ганц утгат, хураагаагүй,
 * хугацааны биш. Нэргүй дүрсийг тодорхойлох ("Туул · № 30") ба давхаргыг
 * бүс болгон хуваахад ({@link LayerSet.splitZones}) хэрэглэгдэнэ.
 */
export function leadGroup(hit: Loaded): string | undefined {
  return hit.charts.find(
    (b) => b.kind === "count" && !b.multi && !b.top && !isTime(b),
  )?.field;
}

/**
 * НЭРГҮЙ ДАВХАРГА ХӨРШӨӨСӨӨ НЭРИЙН БАГАНА ЗЭЭЛНЭ.
 *
 * Нэрийн баганыг дата өөрөө тогтоодог ({@link labelParts}) ч ганц
 * мөртэй давхаргад ялгах зүйл байхгүй тул тогтоож чадахгүй —
 * тэжээгдлийн муж (нэг дүрс) "№ 1" гэж гардаг байв (хэрэглэгч,
 * 2026-10-06: "ус хангамжийн эх үүсвэрийн нэрийг харуулаарай").
 * Нэг цэсийн давхаргууд ихэвчлэн НЭГ бүтэцтэй тул хөрш давхаргын
 * (хязгаарлалтын бүс — таван эх үүсвэрийн нэр) тогтоосон багана нь
 * энд ч мөн нэрийн багана.
 *
 * ⚠ Зөвхөн тэр багана ЭНЭ давхаргад БАЙГАА бөгөөд БӨГЛӨГДСӨН үед.
 * Таамаг биш: эх сурвалжийн өөрийн утга л гарна.
 * ⚠ Өөрчлөгдөх зүйл байхгүй бол ижил обьектыг буцаана — React-ийн
 * дахин зурагдалтыг дэмий өдөөхгүй.
 */
export function borrowNames(m: Record<string, Loaded>): Record<string, Loaded> {
  const donors = Object.values(m)
    .map((h) => h.labels.name)
    .filter((x): x is string => !!x);
  if (!donors.length) return m;

  let out = m;
  for (const [id, hit] of Object.entries(m)) {
    /* Олон мөртэй давхаргад нэргүй байх нь датаны ДҮГНЭЛТ (хаяг, код
       мэт багана нэр болохгүй) — түүнийг дарахгүй */
    if (hit.labels.name || Object.keys(hit.data.rows).length > 1) continue;
    const field = donors.find(
      (name) =>
        hit.info.fields.some((f) => f.name === name) &&
        Object.values(hit.data.rows).some(
          (r) => categoryKey(r[name]) !== "Бүртгэгдээгүй",
        ),
    );
    if (!field) continue;
    if (out === m) out = { ...m };
    out[id] = { ...hit, labels: { ...hit.labels, name: field } };
  }
  return out;
}

/**
 * Дүрсний шошго — нэр ба хэмжээ хоёр мөрөнд.
 *
 * Хоосон утгыг ОГТ бичихгүй: зураг дээрх "—" нь мэдээлэл өгөхгүй,
 * зөвхөн дүрсээ дарна.
 */
/*
  УЛААНБААТАРААС ГАДУУРХ БҮРТГЭЛ ({@link LayerSet.withinUB}; хэрэглэгч,
  2026-10-07: "зөвхөн Улаанбаатараар filter харагдана шүү").
  Гүний худгийн паспортын 111 цэг хотоос хол (уртраг 101–106°, өргөрөг
  45–49°) байсан ч бүгд нийслэлийн дүүрэгтэй бүртгэгдсэн — координатын
  алдаа. Байрлалыг ГЕОМЕТРЭЭС, геометр ирээгүй (атрибут эхэлж ирдэг)
  үед "Уртраг", "Өргөрөг" баганаас — эс тэгвээс геометр ирэхэд тоо
  үсэрнэ. Координатгүй бүртгэл ҮЛДЭНЭ.
  ⚠ Давхаргын дата (`hit.data`) бүрд НЭГ УДАА бодогдоно.
*/
export const OUTSIDE_UB = new WeakMap<object, Set<number>>();

export function outsideUB(hit: Loaded): Set<number> {
  const done = OUTSIDE_UB.get(hit.data);
  if (done) return done;
  const at = new Map<number, { x: unknown; y: unknown }>();
  for (const f of hit.data.shapes.features)
    if (f.geometry?.type === "Point") {
      const [x, y] = f.geometry.coordinates;
      at.set(Number(f.id), { x, y });
    }
  const field = (re: RegExp) =>
    hit.info.fields.find((f) => re.test(f.name) || re.test(f.alias))?.name;
  const lonF = field(/^(уртраг|lon|longitude)$/i);
  const latF = field(/^(өргөрөг|lat|latitude)$/i);
  const out = new Set<number>();
  for (const [k, row] of Object.entries(hit.data.rows)) {
    const oid = Number(k);
    const p = pointOf(
      at.get(oid),
      lonF ? row[lonF] : undefined,
      latF ? row[latF] : undefined,
    );
    if (p && !inUlaanbaatar(p.lon, p.lat)) out.add(oid);
  }
  OUTSIDE_UB.set(hit.data, out);
  return out;
}

export function labelFor(hit: Loaded, oid: number): string {
  const row = hit.data.rows[oid];
  if (!row) return "";

  const lines: string[] = [];
  /* Цэгийн шошгын тусдаа талбар ({@link LayerSet.pointLabel}) */
  const own = hit.info.set.pointLabel;

  if (own) {
    const v = categoryKey(row[own]);
    if (v !== "Бүртгэгдээгүй") lines.push(v);
  } else if (hit.labels.name) {
    const v = categoryKey(row[hit.labels.name]);
    if (v !== "Бүртгэгдээгүй") lines.push(v);
  } else if (splitsZones(hit.info.set, hit.info.id)) {
    /*
      ⚠ НЭРГҮЙ ДҮРС БҮСИЙНХЭЭ НЭРЭЭР (хэрэглэгч, 2026-10-06: "label
      асаа"). Голын татмын 37 дүрс нэрийн баганагүй тул шошго огт
      гардаггүй байв — асаалттай байсан ч хоосон. Ангиллаараа бүс
      болгон хуваасан цэсэд ({@link LayerSet.splitZones}) тэр ангилал
      (сав газар) нь бүсийн картын мөр, цонхны "Нэр"-тэй НЭГ утга.
      ⚠ Ердийн цэсэд нэргүй давхарга шошгогүй хэвээр — ангиллыг
      олон зуун дүрс дээр давтах нь зургийг бөглөрүүлнэ.
    */
    const group = leadGroup(hit);
    const v = group ? categoryKey(row[group]) : "Бүртгэгдээгүй";
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
/*
  ЦЭСИЙН НАРИЙВЧИЛСАН ЭРХ ({@link src/lib/access.ts} `tabRule`, хэрэглэгч
  2026-10-20). Давхарга, үзүүлэлт, диаграмыг бүрдлээс нь (`LayerSet`)
  хасна — самбарын дотоод логик хөндөгдөхгүй; газрын зураг ба дэлгэрэнгүй
  цонхыг туг дамжуулж нууна.
  ⚠ Давхаргын ӨНГӨ ХЭВЭЭР: өнцөг нь жагсаалтын байрлалаас гардаг тул
  үлдсэн давхарга бүр ӨӨРИЙН анхны өнцгөө авч явна.
  ⚠ Дүрэм солигдоход самбар `key`-ээр дахин үүснэ (асаалттай давхарга,
  шүүлт хуучин бүрдлээрээ үлдэхгүй).
*/
export function restrict(set: LayerSet, rule: TabRule): LayerSet | null {
  const layers = rule.layers
    ? set.layers.filter((id) => rule.layers!.includes(id))
    : [...set.layers];
  if (!layers.length) return null;
  const views = rule.views;
  const out: LayerSet = {
    ...set,
    layers,
    hues: layers.map(
      (id) => set.hues[set.layers.indexOf(id) % set.hues.length],
    ),
    open: set.open?.filter((id) => layers.includes(id)),
    stats: set.stats?.filter((st) => layers.includes(st.layer)),
  };
  if (views && !views.includes("overview")) out.overview = false;
  if (views && !views.includes("charts")) out.noCharts = true;
  return out;
}

/**
 * Засаг захиргааны шатлал — ӨРГӨНӨӨС НАРИЙН руу.
 *
 * Эх сурвалж нэг давхаргад хэд хэдэн шатыг зэрэг бичдэг (`aimag`,
 * `duureg`, `horoo`) бөгөөд тэдгээр нь бие даасан задаргаанууд биш
 * НЭГ ТЭНХЛЭГИЙН нарийвчлалын шатууд. Тиймээс тэдгээр нь хамт сууж,
 * өргөнөөс нарийн руу эрэмбэлэгдэх ёстой: дүүрэг дээр нь, хороо
 * доор нь. Эсрэгээр байрлуулбал хэрэглэгч нарийныг нь эхэлж уншаад
 * хүрээгээ дараа нь олдог.
 *
 * ⚠ Кирилл дээр `\b` ажилладаггүй тул үгийг ЗАЙГААР хүрээлж таана —
 * эс тэгвээс "Багц" доторх "баг", "Сумын дарга" доторх "сум" зэрэг
 * санамсаргүй таарал үүснэ ({@link src/lib/chemsystem.ts}-ийн
 * `placeOf`-той нэг арга).
 */
export const ADMIN_WORDS: string[][] = [
  ["аймаг", "нийслэл", "aimag"],
  ["сум", "дүүрэг", "soum", "duureg"],
  ["баг", "хороо", "bag", "horoo", "khoroo"],
];
