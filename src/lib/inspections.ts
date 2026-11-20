import type { LayerField, Row } from "@/lib/portal-layers";

export const inspectionText = (value: unknown) => value == null ? "" : String(value).trim();
const hasInspectionValue = (value: unknown) => value != null && inspectionText(value) !== "";
export const inspectionYes = (value: unknown) => ["tiim", "тийм"].includes(inspectionText(value).toLowerCase());

export function inspectionDate(value: unknown): string {
  if (!hasInspectionValue(value)) return "Бүртгээгүй";
  const date = new Date(typeof value === "number" ? value : String(value));
  if (!Number.isFinite(date.getTime())) return inspectionText(value);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).format(date).replaceAll("-", ".");
}

export function inspectionValue(field: LayerField, value: unknown): string {
  if (!hasInspectionValue(value)) return "Бүртгээгүй";
  if (field.type === "Date") return inspectionDate(value);
  const text = inspectionText(value);
  if (field.codes) return text.split(",").map((part) => field.codes?.[part.trim()] ?? part.trim()).join(", ");
  return /_huvi$/.test(field.name) ? `${text}%` : text;
}

export function inspectionRecord(id: number, row: Row) {
  const type = inspectionText(row.turul);
  const kind = /^(zurchil|Зөрчил)$/i.test(type) ? "violation" : /^(hyanalt_shalgalt|Хяналт,? шалгалт)$/i.test(type) ? "inspection" : "other";
  const prefix = kind === "violation" ? "zr_z_" : "zr_hs_";
  const read = (name: string) => inspectionText(row[prefix + name]);
  const title = read("obyekt_ner") || read("etgeed_ner") || read("ner") || `Бүртгэл №${id}`;
  const district = inspectionText(row.duureg);
  const place = [district, hasInspectionValue(row.horoo) ? `${row.horoo}-р хороо` : ""].filter(Boolean).join(" · ");
  const date = typeof row.ognoo === "number" ? row.ognoo : Date.parse(inspectionText(row.ognoo));
  return {
    id, row, kind, prefix, title, district, place, date,
    type: kind === "violation" ? "Зөрчил" : kind === "inspection" ? "Хяналт шалгалт" : type || "Төрөл бүртгээгүй",
    department: inspectionText(row.buglugch_heltes),
    officer: inspectionText(row.buglugch_ner) || inspectionText(row.buglugch),
    activity: read("ner") || read("turul"),
    subject: read("ner") || read("chiglel") || read("obyekt"),
    found: inspectionYes(row[prefix + "zurchil_ilersen"]),
    resolved: inspectionYes(row[prefix + "gazar_deer"]),
    decision: read("hereg_shiidver"),
    search: Object.values(row).map(inspectionText).join(" ").toLocaleLowerCase("mn"),
  };
}

export type InspectionRecord = ReturnType<typeof inspectionRecord>;

export function inspectionsByOfficer(records: InspectionRecord[]) {
  const groups = new Map<string, { key: string; name: string; department: string; records: InspectionRecord[] }>();
  for (const record of records) {
    const key = JSON.stringify([record.department, inspectionText(record.row.buglugch) || record.officer]);
    let group = groups.get(key);
    if (!group) {
      group = { key, name: record.officer || "Албан хаагч бүртгээгүй", department: record.department, records: [] };
      groups.set(key, group);
    }
    group.records.push(record);
  }
  return [...groups.values()];
}

export const INSPECTION_GROUPS = [
  { id: "general", title: "Бүртгэлийн мэдээлэл" },
  { id: "subject", title: "Байршил, хамрагдсан этгээд" },
  { id: "inspection", title: "Хяналт шалгалт, эрсдэлийн үнэлгээ" },
  { id: "findings", title: "Илэрсэн зөрчил, тайлбар" },
  { id: "actions", title: "Шийдвэр, авсан арга хэмжээ" },
  { id: "documents", title: "Баримт бичиг, нотлох баримт" },
] as const;

export function inspectionGroup(name: string): typeof INSPECTION_GROUPS[number]["id"] {
  if (!/^zr_(hs|z)_/.test(name)) return /^(duureg|horoo|bairshil_au3)$/.test(name) ? "subject" : "general";
  const suffix = name.replace(/^zr_(hs|z)_/, "");
  if (/^(barimt|shinjeech|lats|deej|gomdol_dugaar)/.test(suffix)) return "documents";
  if (/^(hayag|etgeed|register|utas|obyekt|chiglel|hamragdsan|gazar_zoriulalt|gazar_ezemshil|us_eh_uusver)/.test(suffix)) return "subject";
  if (/^(zurchil|zuil|zaalt|tailbar)/.test(suffix)) return "findings";
  if (/^(udirdah|udirdamj|turul|ner|gomdol_helber|huudas|huuli_huvi|ersdel|himi|oin_san|usan_san)/.test(suffix)) return "inspection";
  return "actions";
}

/** Keep every populated business field, including unexpected fields in either branch. */
export function inspectionFields(fields: LayerField[], record: InspectionRecord, showEmpty: boolean) {
  return fields.filter((field) => hasInspectionValue(record.row[field.name]) ||
    (showEmpty && (!/^zr_(hs|z)_/.test(field.name) || field.name.startsWith(record.prefix))));
}
