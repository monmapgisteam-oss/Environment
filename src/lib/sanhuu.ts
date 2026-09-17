/**
 * Санхүү аж ахуй, мониторингийн хэлтэс — ажлын төлөвлөгөөний биелэлт.
 *
 * Эх сурвалж: `WS-0088_Ажлын төлөвлөгөө биелэлт дашбоард.xlsx`-ийн
 * `ТӨЛӨВЛӨГӨӨ БИЕЛЭЛТ` хуудас (хэлтсээс 2026-09-07-нд ирсэн). Файлаар
 * ирсэн тул үйлчилгээ байхгүй — `public/data/sanhuu-2026.json`-д
 * хуулбараар сууна.
 *
 * ⚠ ХУУДАСНЫ 147 МӨРИЙН 17 НЬ ХООСОН. №131–147 нь гурван жолоочийн
 * байр эзэлсэн мөрүүд: ажлын нэр, огноо, зорилтот түвшин бүгд хоосон.
 * Тэднийг ажил гэж тоолбол хэлтсийн ажлын тоо 130-аас 147 болж
 * үрсгэгдэнэ. Датаг бэлтгэх үед л хасагдсан.
 *
 * ⚠ `Ариунбат.Б` ба `Б.Ариунбат` нь НЭГ ХҮН (Батцагаан Ариунбат,
 * ЧД82061766) — хоёр албан тушаал давхар хашдаг: хэлтсийн даргын
 * үүргийг түр орлон гүйцэтгэгч (19 ажил) ба дотоод хяналт, үнэлгээний
 * ахлах мэргэжилтэн (9 ажил). Эх сурвалжийн бичиглэл ялгаатай тул ажил
 * нь хоёр зангилаанд ЦЭВЭР хуваагдана — нэгтгэвэл дотоод хяналтын
 * мөчир алга болно.
 *
 * ХЭРЭГЛЭХГҮЙ ТОГТМОЛУУД: `Хариуцах нэгж` (147/147 "СААМХ"),
 * `Зорилтот түвшин` (үргэлж 100), `Хэмжих үзүүлэлт` ("100% хэрэгжилт"),
 * `Тайлбар` (бүрэн хоосон). Эдгээр нь хэмжигдэхүүн болохгүй.
 *
 * `Гүйцэтгэл` баганыг мөн ХЭРЭГЛЭХГҮЙ: 13 мөрд хоосон бөгөөд бусад
 * бүх мөрд `Хэрэгжилт %`-тэй яг таарна. Сүүлийнх нь бүрэн (147/147).
 */

import { asset } from "@/lib/base-path";

const SNAPSHOT = "/data/sanhuu-2026.json";

/* --------------------------------------------------------------------------
   БҮТЭЦ

   Хэлтэс нь модны мөчир шиг задарна: хэлтэс → бүлэг → дэд бүлэг.
   Ажилтан бүр ЯГ НЭГ зангилаанд харьяалагдана — эс тэгвээс ажлын тоо
   дээш нэгтгэхэд давхардаж, мөчрүүдийн нийлбэр хэлтсийнхээс их гарна.
   -------------------------------------------------------------------------- */

export type Unit = {
  id: string;
  parent: string | null;
  /** Дээд шатны бүлгийн дугаар ("1"…"4"). Бусад зангилаанд хоосон */
  no: string;
  label: string;
};

export type Staff = {
  name: string;
  position: string;
  unit: string;
};

export type Task = {
  no: number;
  /** `Ажлын ангилал`-ын дугаар ("1"…"4") */
  category: string;
  text: string;
  measure: string;
  /** "2026-01-01" */
  start: string;
  end: string;
  /** `Сар` нь ДУУСАХ огнооны сар — эхлэх сар ч биш, үргэлжлэх хугацаа ч биш */
  dueMonth: number | null;
  days: number | null;
  staff: string;
  unit: string;
  target: number | null;
  /** `Хэрэгжилт %` — 0…100 */
  progress: number | null;
  /** Хоосон байж болно: 130 ажлын 84-д төлөв тэмдэглэгдээгүй */
  status: string;
};

export type PlanData = {
  source: { file: string; sheet: string; unit: string; year: number };
  units: Unit[];
  staff: Staff[];
  categories: { id: string; label: string }[];
  statuses: string[];
  tasks: Task[];
};

export async function fetchPlan(signal?: AbortSignal): Promise<PlanData> {
  // eslint-disable-next-line no-restricted-globals -- өөрийн статик JSON — портал биш
  const res = await fetch(asset(SNAPSHOT), signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Төлөвлөгөөний биелэлт татагдсангүй (${res.status})`);
  return (await res.json()) as PlanData;
}

/* --------------------------------------------------------------------------
   ХУГАЦААНЫ ЯВЦ

   Хяналтын гол асуулт нь "ажлаа хийж байна уу" — түүнд хариулахын тулд
   хэрэгжилтийг ЮУТАЙ харьцуулах вэ гэдэг хэрэгтэй. Ажил бүр эхлэх,
   дуусах огноотой тул өнөөдрийн байдлаар хугацааны хэдэн хувь өнгөрснийг
   тооцож болно.

   ⚠ ЭНЭ НЬ ЭХ СУРВАЛЖИЙН ТАЛБАР БИШ, ТООЦОО. Ажил хугацаандаа
   ЖИГД явагдана гэсэн таамаг дээр суурилна — бодит ажил тийм байх
   албагүй. Тиймээс "хоцорсон" гэж ШИЙДЭХГҮЙ, зөвхөн хоёр тоог зэрэгцүүлж
   ЗӨРҮҮГ нь харуулна. Шийдвэрийг хүн гаргана.
 *
   Дийлэнх ажил (130-аас 127) нь 2026-01-01 – 2026-12-31 гэсэн ИЖИЛ
   мужтай тул явц нь бараг бүгдэд ижил гарна. Тиймээс энэ нь задаргааны
   хэмжигдэхүүн БИШ, харьцуулах суурь.
   -------------------------------------------------------------------------- */

/** "2026-01-01" → өдрийн дугаар. Задрахгүй бол `null` */
export function dayOf(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
}

/**
 * Ажлын хугацааны өнгөрсөн хувь (0…100).
 *
 * Эхлээгүй бол 0, дууссан хугацаатай бол 100. Огноо задрахгүй бол
 * `null` — тооцох боломжгүйг тэг гэж үзвэл бүх зөрүү худал болно.
 */
export function elapsed(t: Task, today: number): number | null {
  const a = dayOf(t.start);
  const b = dayOf(t.end);
  if (a == null || b == null) return null;
  if (today <= a) return 0;
  if (today >= b) return 100;
  const span = b - a;
  return span <= 0 ? 100 : ((today - a) / span) * 100;
}

/** Хугацааны явц хэрэгжилтээс хэдэн нэгжээр давсан бэ. Сөрөг бол түрүүлсэн */
export function gapOf(t: Task, today: number): number | null {
  const e = elapsed(t, today);
  if (e == null) return null;
  return e - (t.progress ?? 0);
}

/* --------------------------------------------------------------------------
   ЗАНГИЛААНЫ НЭГТГЭЛ
   -------------------------------------------------------------------------- */

export type Rollup = {
  /** Энэ зангилаа БА бүх үр удмынх */
  tasks: Task[];
  /** Зөвхөн энэ зангилаанд шууд харьяалагдах */
  own: number;
  /** Хэрэгжилтийн дундаж, хувь */
  progress: number;
  /** Хугацааны явцын дундаж, хувь */
  elapsed: number;
  /** Хэрэгжилт огт тэмдэглэгдээгүй ажлын тоо */
  zero: number;
  /** Төлөв тэмдэглэгдсэн ажлын тоо */
  stated: number;
};

/** Зангилаа бүрийн нэгтгэл — үр удмаа өөртөө шингээнэ */
export function rollup(
  units: Unit[],
  tasks: Task[],
  today: number,
): Map<string, Rollup> {
  const kids = new Map<string, string[]>();
  for (const u of units) {
    if (u.parent) kids.set(u.parent, [...(kids.get(u.parent) ?? []), u.id]);
  }
  const direct = new Map<string, Task[]>();
  for (const t of tasks) direct.set(t.unit, [...(direct.get(t.unit) ?? []), t]);

  const out = new Map<string, Rollup>();

  const walk = (id: string): Task[] => {
    const own = direct.get(id) ?? [];
    const all = [...own];
    for (const k of kids.get(id) ?? []) all.push(...walk(k));

    let sp = 0;
    let se = 0;
    let ne = 0;
    let zero = 0;
    let stated = 0;
    for (const t of all) {
      sp += t.progress ?? 0;
      const e = elapsed(t, today);
      if (e != null) {
        se += e;
        ne++;
      }
      if ((t.progress ?? 0) === 0) zero++;
      if (t.status) stated++;
    }
    out.set(id, {
      tasks: all,
      own: own.length,
      progress: all.length ? sp / all.length : 0,
      elapsed: ne ? se / ne : 0,
      zero,
      stated,
    });
    return all;
  };

  for (const u of units) if (!u.parent) walk(u.id);
  return out;
}
