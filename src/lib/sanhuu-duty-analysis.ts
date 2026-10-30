import { asset } from "@/lib/base-path";
import type { PlanData, Staff, Task } from "@/lib/sanhuu";

export const DUTY_STATUSES = [
  { id: "overlap", label: "Давхардлын эрсдэл", note: "Хариуцлага, чиг үүргийн заагийг тодруулах", tone: "warning" },
  { id: "gap", label: "Системд тусгагдаагүй", note: "Чиг үүрэг системд тодорхой тусгагдаагүй", tone: "danger" },
  { id: "partial", label: "Хэсэгчлэн тусгагдсан", note: "Агуулга, хугацаа, шалгуур", tone: "warning" },
  { id: "review", label: "Нягтлах шаардлагатай", note: "Хувилбар, нэр, харьяалал", tone: "neutral" },
  { id: "linked", label: "Чиг үүргийн уялдаа", note: "Ялгаатай оролцоо, нийтлэг чиг үүрэг", tone: "info" },
  { id: "matched", label: "Агуулгын нийцэл", note: "Тулгалтад хамруулсан агуулга нийцсэн", tone: "good" },
] as const;

export type DutyStatus = (typeof DUTY_STATUSES)[number]["id"];
export type DutySource = {
  id: string;
  file: string;
  title: string;
  kind: string;
  reviewed: string;
  note: string;
  sha256: string;
};
export type DutyEvidence = { source: string; ref: string; text: string };
export type DutyFinding = {
  id: string;
  status: DutyStatus;
  title: string;
  area: string;
  people: string[];
  /** Related tasks are context; a gap may have no direct matching task. */
  tasks: number[];
  observation: string;
  action: string;
  evidence: DutyEvidence[];
};
export type DutyAnalysis = {
  version: number;
  reviewedAt: string;
  scope: string;
  method: string;
  limitation: string;
  sourceFolder: string;
  baseline: {
    file: string;
    sheet: string;
    year: number;
    tasks: { no: number; fingerprint: string }[];
    staff: Staff[];
  };
  sources: DutySource[];
  findings: DutyFinding[];
};

export async function fetchDutyAnalysis(signal?: AbortSignal): Promise<DutyAnalysis> {
  // eslint-disable-next-line no-restricted-globals -- reviewed same-origin static data, not ArcGIS
  const response = await fetch(asset("/data/sanhuu-duty-analysis.json"), { signal });
  if (!response.ok) throw new Error(`Шинжилгээний мэдээллийг ачаалах боломжгүй байна (${response.status})`);
  return response.json() as Promise<DutyAnalysis>;
}

/** Change detection only, not a security hash. Performance changes don't invalidate a duty review. */
export function dutyFingerprint(task: Task): string {
  const text = [task.no, task.staff, task.unit, task.text, task.measure, task.target, task.start, task.end]
    .map((v) => v ?? "").join("\x1f");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

export function dutyReviewChanged(review: DutyAnalysis, plan: PlanData): boolean {
  const expected = new Map(review.baseline.tasks.map((t) => [t.no, t.fingerprint]));
  if (expected.size !== plan.tasks.length || plan.tasks.some((t) => expected.get(t.no) !== dutyFingerprint(t))) return true;
  const staffKey = (staff: Staff[]) => staff.map((s) => `${s.name}\x1f${s.position}\x1f${s.unit}`).sort().join("\n");
  return staffKey(review.baseline.staff) !== staffKey(plan.staff) ||
    review.baseline.file !== plan.source.file || review.baseline.sheet !== plan.source.sheet || review.baseline.year !== plan.source.year;
}

export type DutyFilters = { status: DutyStatus | "all"; person: string; source: string; query: string };
export const EMPTY_DUTY_FILTERS: DutyFilters = { status: "all", person: "", source: "", query: "" };

export function findingPeople(finding: DutyFinding, tasks: Task[]): string[] {
  return [...new Set([...finding.people, ...tasks.filter((t) => finding.tasks.includes(t.no)).map((t) => t.staff)])];
}

export function filterDutyFindings(review: DutyAnalysis, tasks: Task[], filters: DutyFilters): DutyFinding[] {
  const q = filters.query.trim().toLocaleLowerCase("mn");
  const sources = new Map(review.sources.map((s) => [s.id, s]));
  return review.findings.filter((f) => {
    const people = findingPeople(f, tasks);
    const related = tasks.filter((t) => f.tasks.includes(t.no));
    const evidence = f.evidence.map((e) => `${sources.get(e.source)?.file ?? ""} ${e.ref} ${e.text}`).join(" ");
    return (filters.status === "all" || f.status === filters.status) &&
      (!filters.person || people.includes(filters.person)) &&
      (!filters.source || f.evidence.some((e) => e.source === filters.source)) &&
      (!q || [f.id, f.title, f.area, f.observation, f.action, people.join(" "), f.tasks.join(" "), evidence, ...related.map((t) => t.text)]
        .join(" ").toLocaleLowerCase("mn").includes(q));
  });
}

/** RFC 4180 escaping plus formula protection for spreadsheet readers. */
function csvCell(value: string): string {
  const safe = /^[\s]*[=+@-]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function dutyCsv(review: DutyAnalysis, plan: PlanData, findings: DutyFinding[]): string {
  const sources = new Map(review.sources.map((s) => [s.id, s]));
  const stale = dutyReviewChanged(review, plan);
  const rows = [
    ["Тулгасан огноо", "Суурийн төлөв", "Илэрц", "Ангилал", "Чиглэл", "Агуулга", "Холбогдох ажилтан", "Системийн ажил", "Шинжилгээний дүгнэлт", "Санал, зөвлөмж", "Эх баримт, заалт, агуулга", "Хамрах хүрээ"],
    ...findings.map((f) => [
      review.reviewedAt, stale ? "Суурь мэдээлэл өөрчлөгдсөн тул тулгалтыг шинэчлэх шаардлагатай" : "Тулгалтын суурь мэдээлэлтэй нийцсэн", f.id,
      DUTY_STATUSES.find((s) => s.id === f.status)!.label, f.area, f.title,
      findingPeople(f, plan.tasks).join("; "),
      f.tasks.map((no) => { const t = plan.tasks.find((t) => t.no === no); return t ? `№${no} · ${t.staff}: ${t.text} [${t.start}–${t.end}; ${t.measure}; зорилт ${t.target ?? "—"}]` : `№${no} — одоогийн бүртгэлд байхгүй`; }).join("\n"),
      f.observation, f.action,
      f.evidence.map((e) => `${sources.get(e.source)?.file ?? e.source} · ${e.ref}: ${e.text}`).join("\n"),
      `${review.scope} ${review.limitation}`,
    ]),
  ];
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
