import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/sanhuu-duty-analysis.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
});
const exports = {};
vm.runInNewContext(outputText, { exports, require(id) { assert.equal(id, "@/lib/base-path"); return { asset: (path) => path }; } });
const { dutyReviewChanged, filterDutyFindings, dutyCsv, DUTY_STATUSES, EMPTY_DUTY_FILTERS } = exports;
const review = JSON.parse(readFileSync(new URL("../public/data/sanhuu-duty-analysis.json", import.meta.url), "utf8"));
const plan = JSON.parse(readFileSync(new URL("../public/data/sanhuu-2026.json", import.meta.url), "utf8"));
const finding = (id) => review.findings.find((f) => f.id === id);
const task = (no) => plan.tasks.find((t) => t.no === no);

test("every conclusion has traceable sources, unique IDs and existing related tasks", () => {
  assert.equal(review.sources.length, 14);
  assert.equal(new Set(review.sources.map((s) => s.id)).size, review.sources.length);
  assert.equal(new Set(review.findings.map((f) => f.id)).size, review.findings.length);
  const sources = new Set(review.sources.map((s) => s.id));
  const staff = new Set(plan.staff.map((s) => s.name));
  for (const f of review.findings) {
    assert(DUTY_STATUSES.some((s) => s.id === f.status));
    assert(f.observation && f.action && f.evidence.length);
    assert.equal(new Set(f.tasks).size, f.tasks.length);
    for (const no of f.tasks) assert(task(no), `${f.id}: missing task ${no}`);
    for (const p of f.people) assert(staff.has(p), `${f.id}: unrecognized person ${p}`);
    for (const e of f.evidence) assert(sources.has(e.source) && e.ref && e.text, `${f.id}: missing evidence`);
  }
  for (const s of sources) assert(review.findings.some((f) => f.evidence.some((e) => e.source === s)));
});

test("review is pinned to duty content; text, dates, ownership and roster changes make it stale", () => {
  assert.equal(dutyReviewChanged(review, plan), false);
  for (const field of ["text", "start", "end", "staff", "unit", "measure", "target"]) {
    const changed = structuredClone(plan);
    changed.tasks[0][field] = field === "target" ? 80 : `${changed.tasks[0][field]}-changed`;
    assert.equal(dutyReviewChanged(review, changed), true, field);
  }
  const changed = structuredClone(plan);
  changed.staff[0].position += " changed";
  assert.equal(dutyReviewChanged(review, changed), true);
  assert.equal(dutyReviewChanged(review, { ...plan, tasks: plan.tasks.slice(1) }), true);
  const performanceOnly = structuredClone(plan);
  performanceOnly.tasks[0].performance = 71;
  performanceOnly.tasks[0].progress = 71;
  assert.equal(dutyReviewChanged(review, performanceOnly), false);
});

test("actual custodian dates are matched, and legal duplicates exclude generic archive duties", () => {
  assert.equal(finding("F17").status, "matched");
  for (const no of finding("F17").tasks) assert.equal(task(no).start, "2026-03-02");
  for (let no = 111; no <= 119; no++) assert.equal(task(no).text, task(no + 10).text);
  assert(!finding("F01").tasks.includes(120));
  assert.equal(finding("F27").status, "linked");
  assert.equal(finding("F24").status, "linked");
  assert.equal(finding("F34").status, "review", "historical driver contract does not prove a current obligation");
  assert(task(46).text.endsWith("-ыг"));
});

test("search, source, person and status compose; empty results remain empty", () => {
  const filtered = filterDutyFindings(review, plan.tasks, { ...EMPTY_DUTY_FILTERS, status: "gap", person: "Д.Жаргалсайхан", source: "S05", query: "ёс зүйн" });
  assert(filtered.some((f) => f.id === "F05"));
  assert(filtered.every((f) => f.status === "gap" && f.evidence.some((e) => e.source === "S05")));
  assert(filterDutyFindings(review, plan.tasks, { ...EMPTY_DUTY_FILTERS, query: "46" }).some((f) => f.id === "F12"));
  assert.equal(filterDutyFindings(review, plan.tasks, { ...EMPTY_DUTY_FILTERS, query: "no-such-duty-123xyz" }).length, 0);
});

test("CSV exports only selected findings with evidence, snapshot date, task content and safe cells", () => {
  const csv = dutyCsv(review, plan, [finding("F12")]);
  assert(csv.startsWith("\uFEFF"));
  assert(csv.includes("2026-10-28") && csv.includes('"F12"'));
  assert(!csv.includes('"F01"'));
  assert(csv.includes("SAAMX-Ahlah nyagtlan bodogch.pdf") && csv.includes("№46"));
  assert(csv.includes(task(46).text.replaceAll('"', '""')));
  const modified = { ...finding("F12"), title: '=HYPERLINK("bad")' };
  assert(dutyCsv(review, plan, [modified]).includes('"\'=HYPERLINK(""bad"")"'));
  assert(dutyCsv(review, { ...plan, tasks: [] }, [finding("F12")]).includes("Суурь мэдээлэл өөрчлөгдсөн"));
});
