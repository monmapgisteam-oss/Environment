/*
  МОНГОЛ → АНГЛИ БИЧВЭР ХӨРВҮҮЛЭГЧ — `DICT`-ээр (i18n-dict.ts).

  Дараалал:
  1. яг таарал (том жижиг үсэг хамаарахгүй);
  2. `{0}` загвар — баригдсан хэсэг нь өөрөө дахин орчуулагдана;
  3. тусгай дүрэм — "N-р хороо", "N-р сар", "2026 он", "X дүүрэг";
  4. задрал — " · ", " — ", " / ", ", " … тусгаарлагчаар хэсэг бүрийг;
  5. тоо + үг ("12 бүртгэл"), үг + тоо ("Станц 292"), хаалт.
  Олдохгүй бол `null` — бичвэр монголоороо үлдэнэ (эх дата: хүн, зүйлийн нэр).
*/

import { DEPT_DICT, DICT, MONTHS_EN } from "./i18n-dict";

const CYR = /[А-Яа-яӨөҮүЁё]/;
const low = (s: string) => s.toLocaleLowerCase("mn");

const exact = new Map<string, { en: string; abbr: boolean }>();
/** Яг ижил бичиглэлтэй түлхүүр ("Нэр" ба "нэр" өөр утгатай байж болно) */
const exactCS = new Map<string, string>();
const templates: { re: RegExp; en: string; len: number }[] = [];

const NUM = String.raw`([№#~]?[\d\s.,−\-–+×%]*\d[\d.,%]*)`;

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const [mn, en] of Object.entries({ ...DICT, ...DEPT_DICT })) {
  if (mn.includes("{0}")) {
    const parts = mn.split(/\{\d\}/);
    // "{0} хоног", "{0} бүртгэл" — эхний орон нь ТОО байх ёстой ("Нэг систем.
    // Найман хэлтэс" → "… divisions" гэж хагас орчуулахаас сэргийлнэ)
    const numLead = /^\{0\} [а-яөүё]/u.test(mn) && !/^\{0\} (дүүрэг|сум|хот)$/u.test(mn);
    const src = parts
      .map(escape)
      .reduce((acc, p, i) => (i === 0 ? p : acc + (i === 1 && numLead ? NUM : "(.+?)") + p), "");
    templates.push({ re: new RegExp(`^${src}$`, "iu"), en, len: parts.join("").length });
  } else {
    // Том үсгээр бичсэн түлхүүр (товчлол) → утга нь яг байгаагаараа
    exact.set(low(mn), { en, abbr: mn === mn.toLocaleUpperCase("mn") });
    exactCS.set(mn, en);
  }
}
// Илүү урт тогтмол хэсэгтэй загвар эхэлж шалгагдана
templates.sort((a, b) => b.len - a.len);

const cache = new Map<string, string | null>();

function isUpper(s: string) {
  const letters = s.replace(/[^A-Za-zА-Яа-яӨөҮүЁё]/g, "");
  return letters.length > 1 && letters === letters.toLocaleUpperCase("mn") && CYR.test(letters);
}

function applyCase(src: string, out: string) {
  if (isUpper(src)) return out.toUpperCase();
  const s0 = src.trimStart()[0];
  if (s0 && s0 !== s0.toLocaleLowerCase("mn") && out[0] && out[0] !== out[0].toUpperCase()) {
    return out[0].toUpperCase() + out.slice(1);
  }
  if (s0 && s0 === s0.toLocaleLowerCase("mn") && s0 !== s0.toLocaleUpperCase("mn")) {
    // жижиг үсгээр эхэлсэн эх → жижиг үсгээр (товчлол, нэрийг хөндөхгүй)
    if (out.length > 1 && out[1] === out[1].toLowerCase()) return out[0].toLowerCase() + out.slice(1);
  }
  return out;
}

/** Хэсэг орчуулах — Кирилл үсэггүй бол хэвээр */
function part(s: string): string {
  if (!CYR.test(s)) return s;
  return tr(s) ?? s;
}

const SEPS = [" · ", " × ", " — ", " – ", " | ", " / ", "; ", ": ", ", "];

const RULES: [RegExp, (m: RegExpMatchArray) => string | null][] = [
  [/^(.+?),? (\d+)-р хороо$/iu, (m) => `${part(m[1])}, Khoroo ${m[2]}`],
  [/^(\d+)-р хороо$/iu, (m) => `Khoroo ${m[1]}`],
  [/^(\d+)-р бүс$/iu, (m) => `Zone ${m[1]}`],
  [/^(\d+)-р шон$/iu, (m) => `Pole ${m[1]}`],
  [/^(\d+)-р хэсэг$/iu, (m) => `Section ${m[1]}`],
  [/^(\d{1,2})-р сар$/iu, (m) => MONTHS_EN[Number(m[1]) - 1] ?? null],
  [/^(\d{4}) оны (\d{1,2})-р сар$/iu, (m) => (MONTHS_EN[Number(m[2]) - 1] ? `${MONTHS_EN[Number(m[2]) - 1]} ${m[1]}` : null)],
  [/^(\d{4}) оны (.+)$/iu, (m) => (tr(m[2]) ? `${m[1]} ${tr(m[2])}` : null)],
  [/^(\d{4}) онд (.+)$/iu, (m) => (tr(m[2]) ? `${tr(m[2])} in ${m[1]}` : null)],
  [/^([\d–\-]+) он$/iu, (m) => (/^\d{4}([–-]\d{4})?$/.test(m[1]) ? m[1] : `${m[1]} years`)],
  [/^([^,·—:;]+) дүүрэг$/iu, (m) => (CYR.test(m[1]) && tr(m[1]) ? `${tr(m[1])} District` : null)],
  [/^([^,·—:;]+) хот$/iu, (m) => (tr(m[1]) ? `${tr(m[1])} City` : null)],
];

export function tr(core: string): string | null {
  if (cache.has(core)) return cache.get(core)!;
  cache.set(core, null); // давтан дуудлагаас хамгаална
  const out = compute(core);
  cache.set(core, out);
  return out;
}

function compute(core: string): string | null {
  const cs = exactCS.get(core);
  if (cs != null) return cs;
  const hit = exact.get(low(core));
  if (hit != null) return hit.abbr ? hit.en : applyCase(core, hit.en);

  for (const [re, fn] of RULES) {
    const m = core.match(re);
    if (m) {
      const v = fn(m);
      if (v) return applyCase(core, v);
    }
  }

  for (const t of templates) {
    const m = core.match(t.re);
    if (!m) continue;
    // Баригдсан хэсэг тусгаарлагчтай бол энэ загвар биш — доор задрална
    const caps = m.slice(1);
    if (caps.some((g) => SEPS.some((sep) => g.includes(sep)) && !t.en.includes(" · "))) continue;
    // Жижиг үсгээр эхэлсэн орчуулагдаагүй хэсэг — нэр биш, өгүүлбэрийн хэлтэрхий
    if (caps.some((g) => CYR.test(g) && part(g) === g && !/^[А-ЯӨҮЁ\d"«(]/u.test(g.trim()))) continue;
    const out = t.en.replace(/\{(\d)\}/g, (_, i) => part(caps[Number(i)] ?? ""));
    return applyCase(core, out);
  }

  for (const sep of SEPS) {
    if (!core.includes(sep)) continue;
    const parts = core.split(sep);
    const outs = parts.map(part);
    // Орчуулагдаагүй хэсэг нь зөвхөн нэр (том үсэг, тоо) байж болно — эс тэгвээс
    // хагас монгол, хагас англи өгүүлбэр гарна
    // Таслалаар жагсаасан ангилал ("Шатахуун түгээх газар, агуулах") — бүгд
    // орчуулагдахгүй бол бүхлээр нь эхээр нь үлдээнэ
    const strict = sep === ", " || sep === "; ";
    const loose = parts.some((p, i) => outs[i] === p && CYR.test(p) && (strict || !/^[А-ЯӨҮЁ\d"«(]/u.test(p.trim())));
    if (!loose && outs.some((o, i) => o !== parts[i])) return outs.join(sep);
  }

  let m = core.match(/^([№#]?[\d\s.,−\-–+×%]*\d[%]?)\s+(.+)$/u);
  if (m) {
    const rest = tr(m[2]);
    if (rest) return `${m[1]} ${rest}`;
  }
  m = core.match(/^(.+?)\s+([№#]?[\d.,:–\-/]+)$/u);
  if (m) {
    const head = tr(m[1]);
    if (head) return `${head} ${m[2]}`;
  }
  m = core.match(/^(.*?)\s*\((.+)\)$/u);
  if (m && m[1]) {
    const a = part(m[1]);
    const b = part(m[2]);
    if (a !== m[1] || b !== m[2]) return `${a} (${b})`;
  }
  m = core.match(/^(.+?)([.:…])$/u);
  if (m) {
    const head = tr(m[1]);
    if (head) return head + m[2];
  }
  return null;
}

/** Бүтэн бичвэр (зайтай нь) — орчуулагдахгүй бол `null` */
export function translateText(raw: string): string | null {
  if (!CYR.test(raw)) return null;
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  const core = m[2].replace(/\s+/g, " ");
  const out = tr(core);
  if (out == null || out === core) return null;
  return m[1] + out + m[3];
}
