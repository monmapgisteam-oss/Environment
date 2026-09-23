import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual TypeScript helpers without a browser or network request.
const source = readFileSync(new URL("../src/lib/sanhuu.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const exports = {};
vm.runInNewContext(outputText, {
  exports,
  require(id) {
    assert.equal(id, "@/lib/base-path");
    return { asset: (path) => path };
  },
  Date,
});
const { dayOf, planDay, deadlineOf, recordedProgress, summarizeTasks, rollup } = exports;
const data = JSON.parse(readFileSync(new URL("../public/data/sanhuu-2026.json", import.meta.url), "utf8"));
const today = dayOf("2026-09-22");
const task = { ...data.tasks[0], performance: 30, progress: 30, start: "2026-01-01", end: "2026-12-31" };

test("explicit zero and missing performance remain distinct in the imported workbook", () => {
  assert.equal(data.tasks.length, 130);
  assert.equal(data.tasks.filter((t) => recordedProgress(t) === 0).length, 79);
  assert.equal(data.tasks.filter((t) => recordedProgress(t) == null).length, 13);
  assert.equal(data.tasks.filter((t) => recordedProgress(t) === 100).length, 4);
  assert.equal(data.tasks.filter((t) => !t.status).length, 84);
});

test("averages exclude unreported work; all-missing work is not displayed as zero", () => {
  const summary = summarizeTasks([
    { ...task, performance: null, progress: 0 },
    { ...task, performance: 0, progress: 0 },
    { ...task, performance: 100, progress: 100 },
  ], today);
  assert.equal(summary.progress, 50);
  assert.equal(summary.missing, 1);
  assert.equal(summary.zero, 1);
  assert.equal(summarizeTasks([{ ...task, performance: null, progress: 0 }], today).progress, null);
  const root = rollup(data.units, data.tasks, today).get("heltes");
  assert.equal(root.tasks.length, 130);
  assert.equal(root.missing, 13);
  assert.equal(root.zero, 79);
});

test("deadlines do not assume progress should equal elapsed time", () => {
  assert.equal(deadlineOf({ ...task, progress: 0, performance: 0 }, today), "active");
  assert.equal(deadlineOf({ ...task, end: "2026-09-22" }, today), "active");
  assert.equal(deadlineOf({ ...task, end: "2026-09-21", status: "Хугацаандаа" }, today), "overdue");
  assert.equal(deadlineOf({ ...task, start: "2026-09-23" }, today), "upcoming");
  assert.equal(deadlineOf({ ...task, performance: 100, progress: 100, end: "2026-08-31" }, today), "complete");
  assert.equal(deadlineOf({ ...task, performance: null, progress: 0, end: "2026-08-31" }, today), "overdue");
});

test("invalid dates and Ulaanbaatar midnight are handled explicitly", () => {
  assert.equal(dayOf("2026-02-30"), null);
  assert.equal(dayOf("2026-13-01"), null);
  assert.equal(deadlineOf({ ...task, end: "" }, today), "undated");
  assert.equal(deadlineOf({ ...task, start: "2027-01-01" }, today), "undated");
  assert.equal(planDay(Date.parse("2026-09-21T15:59:59Z")), dayOf("2026-09-21"));
  assert.equal(planDay(Date.parse("2026-09-21T16:00:00Z")), today);
});
