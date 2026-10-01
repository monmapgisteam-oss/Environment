"use client";

import type { Breakdown } from "@/lib/portal-layers";
import { num } from "@/lib/utils";
import { CategoryChart } from "./subject-charts";

export const TOPIC_NOTES: Record<string, string> = {
  "unelgee-flood": "Үерийн эрсдэлтэй болон үерт өртсөн газар, барилга, өрхийн орон зайн мэдээлэл",
  "unelgee-green": "Ногоон байгууламж, цэцэрлэгт хүрээлэнгийн байршил, талбайн бүртгэл",
  "unelgee-eco": "Бичил цэцэрлэг, явган болон дугуйн зам, бусад байгууламжийн бүртгэл",
  "unelgee-waste": "Хог хаягдлын цэгийн байршил болон талбайн бүртгэл",
  "unelgee-gas": "Хийн тоног төхөөрөмжийн байршил, бүртгэлийн үзүүлэлт",
};

export function recordUnit(id: string) {
  if (id.includes("ail_urh")) return "өрхийн бүртгэл";
  if (id.includes("barilga")) return "барилгын бүртгэл";
  if (id.includes("negj_talbai")) return "нэгж талбар";
  if (id.includes("khoroo")) return "хорооны бүртгэл";
  if (id.includes("gas_")) return "төхөөрөмж";
  if (id.includes("tsetserlegt")) return "цэцэрлэгт хүрээлэн";
  return "бүртгэл";
}

export function topicChartTitle(b: Breakdown) {
  const limit = b.top ? ` · эхний ${b.top}` : "";
  /*
    ⚠⚠ ТООЛЛЫН ДАГАВАР ГАРЧИГТ БИЧИГДЭХГҮЙ (хэрэглэгчийн шийдвэр,
    2026-09-28). Хуваалцсан самбарын `chartTitle`-аас хасагдсан ч энэ
    хэлтэс өөрийн гарчиг угсардаг тул "Дүүрэг · бүртгэлийн тоо" гэж
    гарсаар байв. Нийлбэр, дундаж нь ЭХЭНДЭЭ хэмжигдэхүүнээ бичдэг
    тул нүцгэн нэр нь өөрөө тоолол гэдгийг хэлнэ.
  */
  if (b.kind === "count") return `${b.label}${limit}`;
  if (b.kind === "mean") return `${b.measure ?? "Үзүүлэлт"} · дундаж, ${b.label}${limit}`;
  if (b.kind === "sum") return `${b.measure ?? "Үзүүлэлт"} · ${b.label}${limit}`;
  return `${b.label}${limit}`;
}

/** Exact values remain readable; bar length compares categories from a zero baseline. */
export function TopicBreakdown({ breakdown: b, tone, palette, selected, onSelect, unit }: {
  breakdown: Breakdown;
  tone: string;
  palette?: Map<string, string>;
  selected: string[] | null;
  onSelect: (key: string | null) => void;
  unit: string;
}) {
  const share = !b.multi && !b.top && b.kind === "count";
  const geographic = /дүүрэг|хороо/i.test(b.label);
  return (
    <div className="ue-breakdown">
      <CategoryChart data={b.values} initial={share && !geographic && b.values.length <= 6 ? "composition" : b.kind === "count" && b.values.length <= 12 ? "columns" : "dots"} unit={b.kind === "count" ? unit : `${b.measure ?? "Утга"}${b.kind === "mean" ? " · дундаж" : ""}`} selected={selected} onSelect={onSelect} allowShare={share} colorOf={palette ? (key) => palette.get(key) ?? tone : undefined} />
      <p className="ue-chart-note">{b.multi ? "Нэг бүртгэл хэд хэдэн ангилалд хамаарч болно." : b.top ? `Хамгийн их утгатай ${num(b.top)} ангиллыг харуулав.` : "Ангилал дээр дарж шүүнэ. Дахин дарж цуцална."}</p>
    </div>
  );
}

/**
 * ⚠⚠ МӨР БҮР ЗӨВХӨН ӨНГӨ БА НЭР (2026-09-29, хэрэглэгч: "энэ
 * харагдах шаардлагагүй, өнгө түүний тайлбар байхад болно").
 * Урьд нь мөрийн ард бичлэгийн ТОО бичигддэг байсан ч тайлбарын
 * асуулт нь "энэ өнгө юу вэ" — тоо нь диаграмд аль хэдийн бий.
 *
 * `solo` нь ЗАДАРГААГҮЙ давхарга: бүх дүрс НЭГ өнгөтэй тул гарчиг,
 * мөр хоёр болж хуваагдахгүй, давхаргын нэр нь өөрөө мөрийн шошго
 * болно. Урьд нь "Хориглолтын бүс" гэсэн гарчгийн дор "талбай 18"
 * гэсэн мөр гардаг байсан нь геометрийн төрлийг давтахаас өөр юу ч
 * хэлэхгүй байв.
 */
export type LayerLegendGroup = { id: string; name: string; geometry: string; field?: string; solo?: boolean; items: { key: string; label: string; color: string }[] };

export function TopicMapLegend({ groups }: { groups: LayerLegendGroup[] }) {
  if (!groups.length) return null;
  return <details open className="ue-map-legend">
    <summary>Таних тэмдэг</summary>
    <div className="ue-map-legend-body">
      {groups.map((group) => <section key={group.id} className={group.solo ? "is-solo" : undefined}>
        {group.solo ? null : <h3>{group.name}</h3>}
        {group.field && !group.solo ? <p>Өнгөөр ялгасан үзүүлэлт: {group.field}</p> : null}
        {group.items.map((item) => <div key={item.key} className="ue-legend-row">
          <span aria-hidden="true" className={`ue-map-symbol ${group.geometry.includes("Point") ? "is-point" : group.geometry.includes("Polyline") ? "is-line" : "is-area"}`} style={{ color: item.color }} />
          <span title={item.label}>{item.label}</span>
        </div>)}
      </section>)}
    </div>
  </details>;
}
