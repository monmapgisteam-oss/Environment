"use client";

import { Ruler, Shapes, Tag } from "lucide-react";
import { type Datum } from "@/components/charts";



import {
  categoryKey,
  unitOf,
  type Breakdown,
  type ChartKind,
  type LayerSet,
} from "@/lib/portal-layers";
import { num } from "@/lib/utils";

import type { Loaded } from "./board-shared";
import { toneOfHue, seriesRamp, ADMIN_WORDS } from "./board-shared";

/**
 * Хөвөгч тайлбарт ЮУ бичих вэ.
 *
 * Талбарыг эхнээс нь дараалуулж авбал дугаар, техникийн код гарч
 * ирдэг — хулганы доорх дүрс юу болохыг тэр хэлэхгүй. Оронд нь
 * диаграм юу гэж үздэг тэр гурвыг л харуулна: НЭР, ХЭМЖЭЭ, дараа нь
 * хамгийн сайн задалж буй ХОЁР ангилал.
 *
 * Хоосон утга ОГТ орохгүй: "—" гэсэн мөр нь зай эзлэхээс өөр юу ч
 * хэлэхгүй.
 */
export function tipRows(
  hit: Loaded,
  row: Record<string, unknown>,
): { icon: typeof Tag; text: string; num?: boolean }[] {
  const out: { icon: typeof Tag; text: string; num?: boolean }[] = [];

  if (hit.labels.name) {
    const v = categoryKey(row[hit.labels.name]);
    if (v !== "Бүртгэгдээгүй") out.push({ icon: Tag, text: v });
  }

  if (hit.labels.measure) {
    const v = Number(row[hit.labels.measure.field]);
    if (Number.isFinite(v)) {
      out.push({
        icon: Ruler,
        num: true,
        text: `${measureText(v)} ${hit.labels.measure.unit}`.trim(),
      });
    }
  }

  for (const b of hit.charts) {
    if (out.length >= 4) break;
    if (b.kind !== "count") continue;
    const v = b.keyOf(row).join(", ");
    if (!v || v === "Бүртгэгдээгүй") continue;
    out.push({ icon: Shapes, text: `${b.label}: ${v}` });
  }

  return out;
}

/** Хугацааны цуваа мөн үү */
export function isTime(b: Breakdown): boolean {
  return b.kind === "year" || b.kind === "month";
}

/**
 * ШҮҮЛТИЙН ТҮЛХҮҮР — талбарын нэр, гэхдээ ХУГАЦААНД нь `kind` нэмнэ.
 *
 * ⚠⚠ ОГНООНЫ ТАЛБАР ХОЁР ДИАГРАМ ТӨРҮҮЛНЭ: жилийн цуваа ба сарын
 * хуваарилалт. Тэдний `keyOf` нь ӨӨР ("2020" ба "1-р сар") атлаа
 * талбарын нэр нь НЭГ. Шүүлтийг зөвхөн талбарын нэрээр түлхүүрлэхэд
 * `keyBy` нь эхний диаграмынхыг (он) авдаг тул **САРААР ШҮҮХЭД
 * БҮХ МӨР УНАДАГ байв** — самбар бүхэлдээ хоосон болно (2026-09-29-нд
 * синтетик датаар илрүүлэв: "1-р сар" → 0 мөр, диаграм нь 5 гэж
 * бичсэн байхад).
 * ⚠ Кодод "нэг талбарын диаграмууд бүгд ижил дүрэмтэй" гэж бичигдсэн
 * таамаг байсан нь ангиллын диаграмд үнэн (тоолол ба хэмжилт нэг
 * `keyOf` хуваалцана — тэд шүүлтээ ЗОРИУДААР хуваалцдаг) ч хугацаанд
 * худал.
 * ⚠ Цэсэнд (`menusOf`) хугацааны диаграм ОРДОГГҮЙ тул энэ нь зөвхөн
 * диаграм дээрх товшилтод хамаарна.
 */
export function filterKey(b: Breakdown): string {
  return isTime(b) ? `${b.field}\u0000${b.kind}` : b.field;
}

export function unitSeries(
  s: { groups: NonNullable<Breakdown["groups"]>; colors: string[] },
  unit: string | undefined,
  drop: RegExp | undefined,
  hues?: Record<string, number>,
): { groups: NonNullable<Breakdown["groups"]>; colors: string[] } {
  const first = s.groups[0]?.rows ?? [];
  const keep = first
    .map((r, i) => (drop && drop.test(r.label.trim()) ? -1 : i))
    .filter((i) => i >= 0);
  const name = (label: string) => (unit ? `${label}, ${unit}` : label);
  return {
    groups: s.groups.map((g) => {
      const rows = keep.map((i) => ({
        ...g.rows[i],
        label: name(g.rows[i].label),
      }));
      /* Нийт дүн ҮЛДСЭН цуваанаас — хасагдсан "Талбай" орохгүй */
      return { ...g, rows, total: rows.reduce((t, r) => t + r.value, 0) };
    }),
    /* Цувааны ӨӨРИЙН өнгө ({@link LayerSet.seriesHues}) — нэг цэнхэр
       шатлалын хөрш хоёр алхам ялгагдахгүй байв (хэрэглэгч, 2026-10-06:
       "зүлэг, цэцэгийн өнгийг өөр өг, ялгагдахгүй байна") */
    colors: keep.map((i) => {
      const h = hues?.[first[i].label.trim()];
      /* БҮДЭГ (хэрэглэгч, 2026-10-06: "ногоон, ягаан өнгийг бүдэгхэн
         болго") — ханалт 0.15 → 0.08, гэрэлтэлт 0.74 → 0.78 */
      return h == null
        ? (s.colors[i] ?? s.colors[0])
        : toneOfHue(h, 0.78, 0.08);
    }),
  };
}

export function shownSeries(
  b: Breakdown,
  years: string[] | undefined,
  hue: number,
): { groups: NonNullable<Breakdown["groups"]>; colors: string[] } {
  const groups = b.groups ?? [];
  const all = groups[0]?.rows ?? [];
  const ramp = seriesRamp(hue, all.length || 1);

  if (!years?.length) return { groups, colors: ramp };

  const keep = all
    .map((r, i) => (years.includes(r.label) ? i : -1))
    .filter((i) => i >= 0);
  if (!keep.length) return { groups, colors: ramp };

  return {
    groups: groups.map((g) => ({ ...g, rows: keep.map((i) => g.rows[i]) })),
    colors: keep.map((i) => ramp[i]),
  };
}

/**
 * Тайлбарын БҮТЭН жагсаалт — нуусан цуваа нь `on: false`-оор үлдэнэ.
 * Өнгө нь {@link shownSeries}-тэй ижил шатлалаас (бүтэн жагсаалтын
 * байрлалаар), эс тэгвээс тайлбар ба зурвас өөр өнгө хэлнэ.
 * Шүүлтгүй (эсвэл таарах он үгүй) үед бүгд асаалттай.
 */
export function seriesLegend(
  b: Breakdown,
  years: string[] | undefined,
  hue: number,
): { key: string; label: string; color: string; on: boolean }[] {
  const all = b.groups?.[0]?.rows ?? [];
  const ramp = seriesRamp(hue, all.length || 1);
  const any = all.some((r) => years?.includes(r.label));
  return all.map((r, i) => ({
    key: r.key,
    label: r.label,
    color: ramp[i],
    on: !any || Boolean(years?.includes(r.label)),
  }));
}

/**
 * ШҮҮЛТҮҮРИЙН МӨРӨНД ямар цэс гарах вэ.
 *
 * Талбар бүрд НЭГ цэс: нэг талбар хэд хэдэн диаграм төрүүлдэг
 * (ангиллын тоо, тэр ангиллаар хэмжсэн талбай) ч шүүлт нь нэг.
 * Хугацааны диаграм орохгүй — тэдний "ангилал" нь он, сар бөгөөд
 * тэднийг диаграмаас нь шууд товшсон нь дээр.
 *
 * ⚠ Зөвхөн тоолол дээр тулгуурлавал ДҮҮРЭГ шиг бичлэг тутамд өөр
 * утгатай талбар цэсэнд огт гарахгүй байв — тийм талбар нь ангилал
 * болж чаддаггүй ч ШҮҮЛТ болж чаддаг.
 */
export function menusOf(charts: Breakdown[]): Breakdown[] {
  const out: Breakdown[] = [];
  const seen = new Set<string>();

  for (const b of charts) {
    if (isTime(b) || seen.has(b.field)) continue;
    if (!b.values.length) continue;
    seen.add(b.field);
    out.push(b);
  }
  return out;
}

/**
 * Давхаргад ямар ОН байна вэ.
 *
 * Цуваануудын нэр нь оны дараалал болсон үед л (эх сурвалж жил бүрд
 * нэг багана бичсэн) оноор шүүх утгатай. Нэр нь он биш бол
 * (хэмжилтүүд нь өөр өөр зүйл) шүүх зүйл алга — цэс гарахгүй.
 */
export function yearsOf(charts: Breakdown[]): string[] {
  const out = new Set<string>();

  for (const b of charts) {
    if (b.kind !== "compare") continue;
    for (const r of b.groups?.[0]?.rows ?? []) {
      if (/^(19|20)\d{2}$/.test(r.label)) out.add(r.label);
    }
  }
  return [...out].sort();
}

/**
 * Бөгжин диаграм хэзээ тохирох вэ.
 *
 * Бөгж нь БҮХЭЛ ЗҮЙЛИЙН ХУВААРИЛАЛТ-ыг хэлнэ, зурвас нь харьцуулалтыг.
 * Хоёр, гурван утгатай ангиллыг зурвасаар зурвал хагас хоосон карт
 * үлдэж, харьцаа нь ч шууд уншигдахгүй — тэнд бөгж илүү.
 *
 * ⚠ ГУРВАН тохиолдолд БОЛОХГҮЙ:
 * 1. **Олон утгатай задаргаа** — нэг бичлэг хоёр ангилалд орвол
 *    зүсмүүд давхцаж, нийлбэр нь бүхэлээс их болно. Бөгж нь тэгснээ
 *    харуулж чадахгүй тул зүгээр л ХУДАЛ хэлнэ.
 * 2. **Дундаж** — хувийн дундажууд нийлээд бүхэл зүйл болдоггүй.
 * 3. **Хураасан жагсаалт** — үлдсэн хэсэг нь огт байхгүй мэт харагдана.
 */
export function isPie(b: Breakdown): boolean {
  if (b.kind !== "count" && b.kind !== "sum") return false;
  if (b.multi) return false;
  if (b.top) return false;
  return b.values.length >= 2 && b.values.length <= PIE_MAX;
}

/** Бөгжин диаграмд багтах зүсмийн дээд тоо */
export const PIE_MAX = 4;

export function adminRank(label: string): number | null {
  const t = ` ${label
    .toLocaleLowerCase("mn")
    .replace(/[^0-9a-zа-яөүё]+/gi, " ")
    .trim()} `;
  for (let i = 0; i < ADMIN_WORDS.length; i += 1) {
    if (ADMIN_WORDS[i].some((w) => t.includes(` ${w} `))) return i;
  }
  return null;
}

/**
 * Диаграмын гарчиг.
 *
 * Гарчиг нь ХОЁР асуултад хариулах ёстой: юуг хэмжсэн бэ, юугаар нь
 * задалсан бэ. Нэг талбар дээр хэдэн диаграм зэрэгцэж болдог тул
 * (ангиллын тоо, тэр ангиллаар хэмжсэн талбай) зөвхөн талбарын нэр
 * бичвэл хоёр карт ялгагдахгүй болно.
 *
 * Хэмжигдэхүүнийг ЭХЭНД, зүсэлтийг араас нь тавина: "Талбай
 * тогтоолоор, га — Түвшин". Нэгжийг эх сурвалж өөрөө нэртээ бичдэг
 * тул энд нэмэхгүй.
 */
export function chartTitle(b: Breakdown): string {
  /* Хураасан бол ЗААВАЛ хэлнэ — дутуу жагсаалтыг бүтэн мэт харуулбал
     диаграм өөрөө худал хэлнэ */
  const cut = b.top ? ` (эхний ${b.top})` : "";

  switch (b.kind) {
    /*
      ⚠⚠ "— бичлэгийн тоо" ДАГАВАР ХАСАГДСАН (хэрэглэгчийн шийдвэр,
      2026-09-28: "энэ чартуудын дээр байгаа бичлэгийн тоо — del,
      хэзээ ч албан ёсны webapp хийж байгаа тохиолдолд тэгж бичихгүй").

      ⚠ Энэ нь дэлгэц дээр гарах бичвэрийн дүрэм: "бичлэг" гэдэг нь
      МЭДЭЭЛЛИЙН САНГИЙН үг — эцсийн хэрэглэгч агуулах, зөвшөөрөл,
      цэгийг хардаг болохоос "бичлэг" хардаггүй. Арга зүйн тайлбар
      дэлгэцэд гаргахгүй дүрэмтэй нэг гэр бүл.

      ⚠ Тоолол ба хэмжилт нь ХЭВЭЭР ялгагдана: нийлбэр, дундаж нь
      гарчгийнхаа ЭХЭНД хэмжигдэхүүнээ бичдэг ("Талбай, га — Дүүрэг")
      тул нүцгэн нэр нь өөрөө тоолол гэдгийг хэлнэ. Зурвасын утга нь
      ч бүхэл тоо байна.
    */
    case "count":
      return `${b.label}${cut}`;
    case "sum":
      return `${b.measure ?? ""} — ${b.label}${cut}`;
    /* Дундаж нь нийлбэрээс ЭРС өөр утга — гарчигт нь ил хэлэхгүй бол
       хоёр диаграм ижил харагдана */
    case "mean":
      return `${b.measure ?? ""} — ${b.label}, дундаж${cut}`;
    case "compare":
      /* Цуваануудын нийтлэг нэр ("Мод бэлтгэсэн талбай") байвал түүгээр —
         "Харьцуулалт" нь юуг хэмжсэнийг хэлдэггүй байв (2026-10-06) */
      return `${b.subject ?? "Харьцуулалт"}, ${b.measure ?? ""} — ${b.label}${cut}`;
    /*
      ⚠⚠ ОГНООНЫ ТАЛБАР ӨӨРИЙН НЭРЭЭРЭЭ ГАРНА (хэрэглэгчийн шийдвэр,
      2026-09-28: "тусгай зөвшөөрөл авсан огноо болго гэх мэтээр
      чартын нэрсийг албаны болго").

      Нэр нь аль хэдийн огноо гэдгээ хэлчихсэн байвал араас нь
      "жилээр", "жилийн хуваарилалт" гэж хавсаргах нь албан нэршлийг
      мэдээллийн сангийн тайлбар болгоно — "Тусгай зөвшөөрөл авсан
      огноо, жилээр" гэж уншигдана. Тэнхлэг нь өөрөө онуудыг бичдэг
      тул давталт нь мэдээлэл ч нэмэхгүй.

      ⚠ Огноо гэж нэрлээгүй талбар (жишээ нь "Бүртгэл") дээр
      хуваарилалтыг ЗААВАЛ хэлнэ — эс тэгвээс тоолол мөн үү, жил мөн
      үү гэдэг нь гарчигнаас уншигдахгүй.
      ⚠ САРЫН диаграм ДАГАВАРТАЙ хэвээр тул нэг талбарын жил, сарын
      хоёр карт ялгагдана ("… огноо" ба "… огноо, сараар").
    */
    case "year":
      return /огноо|он|жил|year|date/i.test(b.label)
        ? `${b.label}${cut}`
        : `${b.label}, жилээр${cut}`;
    /* Сар нь ЖИЛТЭЙ ижил дүрэмтэй: нэр нь өөрөө "сар" гэж хэлсэн бол
       дагавар нэмэхгүй. Ингэснээр нэг давхаргын "Он" ба "Сар" хоёр
       карт тэгш харагдана; харин НЭГ талбарын жил, сарын хоёр карт
       (аврагдсан амьтдын "Огноо") ялгагдсан хэвээр — тэр нэрэнд
       "сар" гэсэн үг байхгүй тул дагавраа авна. */
    case "month":
      return /сар|month/i.test(b.label)
        ? `${b.label}${cut}`
        : `${b.label}, сараар${cut}`;
    default:
      return b.label;
  }
}

/**
 * Хэмжигдэхүүний бичиглэл.
 *
 * Талбай мянгаараа, хувь нэгжээрээ явдаг тул нэг дүрэм хоёуланд
 * тохирохгүй: том тоог бүхэлчилж таслалаар нь салгана, жижгийг нь
 * бутархайгаар үлдээнэ — эс тэгвээс "0" гэсэн мөр гарч утга алга
 * болно (ерөнхий үнэлгээний талбайн бичиглэлтэй ижил үндэслэл).
 */
/**
 * МӨРИЙН НЭМЭЛТ УТГА — нэрийн ард, бүдэг бичвэрээр.
 *
 * Нэг талбарын тоолол ба хэмжилтийн диаграм нэгтгэгдсэн үед л
 * гарна ({@link Breakdown.note}).
 *
 * ⚠ НЭГЖ МӨР БҮРД БИЧИГДНЭ ("191,559 га"): зурвас нь
 * бичлэгийн тоог хэмжиж байгаа тул хоёр дахь тоо юуных болох нь
 * ӨӨРӨӨСӨӨ уншигдах ёстой — гарчгаас хайж уншина гэж найдахгүй.
 */
/**
 * ЧАРТЫН ӨНГӨ ТУНГАЛАГ (хэрэглэгч 2026-10-07: "чартын өнгийг жаахан
 * transparent хийгээд үз") — дүүргэлт ба түүнд харгалзах дөрвөлжин ~72%;
 * бичвэр, тоо бүтэн тод хэвээр. Зөвхөн `#rrggbb` өнгөнд (газрын зургийн
 * палитр); бусад хэлбэрийг хөндөхгүй.
 */
export function soft(color: string | undefined): string | undefined {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}b8` : color;
}

export function noteOf(b: Breakdown): ((d: Datum) => string) | undefined {
  const { note, notes } = b;
  if (!note || !notes) return undefined;
  return (d) => {
    const v = notes.get(d.key);
    if (v == null) return "";
    return note.unit ? `${measureText(v)} ${note.unit}` : measureText(v);
  };
}

/**
 * КАРТЫН ӨНДРИЙН ЖИН — мөрийн тооноос.
 *
 * Баганад картууд үлдсэн өндрийг хуваалцдаг бөгөөд тэнцүү
 * хуваавал дөрвөн зүсэмтэй бөгж доороо хоосон зай үлдээж
 * байхад арван мөртэй зурвас адил өндөрт шахагдаж гүйлгүүр
 * гаргадаг байв (хэрэглэгч, 2026-09-24).
 *
 * ⚠ Жин нь ШҮҮГДЭЭГҮЙ бүтэн жагсаалтаас гарна: шүүлт тавихад
 * картуудын өндөр үсрэн солигдвол самбар тогтворгүй болно
 * (диаграмын БҮТЭЦ шүүлтээс үл хамаарах дүрэмтэй нэг зарчим).
 * ⚠ БӨГЖ, БАГАНА нь ТОГТМОЛ өндөртэй тул жин нь бага:
 * бөгж нь 112px диаграм дээр тайлбараа барьдаг, хугацааны
 * багана 92px — хоёулаа нэмэлт өндөр ашигладаггүй.
 */
/**
 * ЭЗЛЭХ ХУВЬ ХАРУУЛЖ БОЛОХ УУ.
 *
 * Хувь нь ЗӨВХӨН бүхэл нь мэдэгдэж байгаа үед утгатай — бөгж
 * хэрэглэхгүй гурван тохиолдолтой ЯГ ИЖИЛ жагсаалт:
 * · дундаж — хувийн дундажууд нийлээд бүхэл болдоггүй;
 * · олон утгат — нэг бичлэг хэд хэдэн ангилалд орох тул нийлбэр нь
 *   бүхлээс ИХ гарна;
 * · хураасан — харагдаж буй мөрүүд бүхлийг хамраагүй.
 */
export function hasShare(b: Breakdown): boolean {
  return !b.multi && b.top == null && (b.kind === "count" || b.kind === "sum");
}

/**
 * Картын толгойн баримт — "33 бүртгэл · 4 ангилал".
 *
 * ⚠ "бичлэг" нь мэдээллийн сангийн үг — дэлгэцэд ХЭЗЭЭ Ч гарахгүй
 * (хэлний дүрэм). Бүртгэл өөрийн үгтэй бол ({@link LayerSet.record})
 * түүгээр.
 */
export function headMeta(b: Breakdown, word?: { one: string }): string {
  const cats = `${num(b.values.length)} ангилал`;
  if (!hasShare(b)) return cats;
  const total = b.values.reduce((n, d) => n + d.value, 0);
  /* ⚠ Хэмжилт зурвас болсон үед ({@link LayerSet.measureFirst}) тоо нь
     бичлэгийнх БИШ — нэгжтэйгээ гарна */
  if (b.kind === "count" && !b.measure)
    return `${num(total)} ${word?.one ?? "бүртгэл"} · ${cats}`;
  const unit = b.measure ? unitOf(b.measure).unit : "";
  return `${measureText(total)}${unit ? ` ${unit}` : ""} · ${cats}`;
}

/*
  НЭРЛЭСЭН ГАНЦ ХАРЬЦУУЛАХ КАРТЫГ ХАСНА ({@link LayerSet.dropCompare},
  хэрэглэгч 2026-10-06: зургаар "зөвхөн зураг дээрхийг устга").
  ⚠⚠ Нэрээр ДАНГААР таних нь ХАНГАЛТГҮЙ — эхний оролдлогод бүх
  харьцуулалт, дараа нь давхаргын дугаараар хассан нь хэрэглэгчид өөр
  картыг ч хамт устгасан мэт харагдаж буцаагдсан. Тиймээс ГАРЧИГ ба
  доторх БҮХ цувааны нэр зэрэг таарах ёстой ("Дүүрэг" · файлаар ·
  геодезийн) — тэр нэг карт л хасагдана.
*/
export function droppedCompare(set: LayerSet, b: Breakdown): boolean {
  if (b.kind !== "compare" || !set.dropCompare?.length) return false;
  const low = (t: string) => t.trim().toLowerCase();
  const names = new Set<string>();
  for (const g of b.groups ?? []) {
    names.add(low(g.label));
    for (const r of g.rows) names.add(low(r.label));
  }
  return set.dropCompare.some(
    (d) =>
      low(d.label) === low(b.label) &&
      d.series.every((x) => [...names].some((n) => n.includes(low(x)))),
  );
}

export function cardWeight(b: Breakdown): number {
  if (isTime(b)) return 3;
  if (isPie(b)) return Math.max(3, b.values.length);
  if (b.kind === "compare") return Math.max(4, (b.groups?.length ?? 0) * 2);
  return Math.max(3, b.values.length);
}

export function measureText(v: number): string {
  /* Бүхэл утганд бутархай зурах нь худал нарийвчлал: "40.0" гэдэг нь
     хэмжилт нь аравны нэг хүртэл мэдэгдэж байгаа мэт уншигдана */
  if (Number.isInteger(v)) return num(v);
  if (Math.abs(v) >= 100) return num(Math.round(v));
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

/**
 * Хугацааны тэнхлэгийн шошго.
 *
 * Багана нь эгнээндээ багтах ёстой: арван хоёр сарын нүдэнд ганц хоёр
 * тэмдэгт л орно. Тиймээс баганын ТООНООС хамаарч шийднэ — цөөн бол
 * бүтэн он, олон бол хоёр орон, бүр олон бол зөвхөн арван жилийн
 * тэмдэглэгээ.
 *
 * ⚠ Оныг ШОШГООС нь БҮҮ унш: бүлэглэсэн цуваанд шошго нь "1995–1999"
 * гэсэн МУЖ байдаг тул тоо болгоход `NaN` гарч, бүх тэмдэглэгээ алга
 * болдог байв. Түлхүүр нь харин үргэлж эхлэх он.
 */
export function tickOf(
  kind: ChartKind,
  d: { key: string; label: string },
  i: number,
  n: number,
): string {
  if (kind === "month") return d.label.replace("-р сар", "");

  /*
    ⚠ ОН ҮРГЭЛЖ БҮТЭН ДӨРВӨН ОРОНТОЙ (хэрэглэгч, 2026-10-07: "оныг
    бүтэн харуулаарай, 2020 гэх мэт"). Урьд нь "20", "98" гэж
    товчилдог байсан тул аль зуун болох нь уншигдахгүй байв. Бүтэн он
    илүү өргөн тул олон онтой цуваанд СИЙРЭГЖҮҮЛНЭ: 16 хүртэл бол
    хоёр тутамд, түүнээс олон бол таваар хуваагдах онд.
  */
  const y = Number(d.key);
  if (!Number.isFinite(y)) return "";
  if (n <= 8) return String(y);
  if (n <= 16) return i % 2 === 0 ? String(y) : "";
  return y % 5 === 0 ? String(y) : "";
}
