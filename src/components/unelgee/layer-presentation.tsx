"use client";

import type { Breakdown } from "@/lib/portal-layers";
import { SimpleChart } from "./subject-charts";
import { LegendShell } from "./ui";

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

/**
 * Ангиллын задаргаа — хэлбэрийг {@link SimpleChart} сонгоно: 3-аас
 * цөөн утгатай тоолол бөгж, бусад нь хэвтээ зурвас. Хугацааны
 * задаргаа энд ирэхгүй — хуваалцсан самбар өөрөө талбайн диаграмаар
 * зурна.
 */
export function TopicBreakdown({ breakdown: b, tone, palette, selected, onSelect, unit }: {
  breakdown: Breakdown;
  tone: string;
  palette?: Map<string, string>;
  selected: string[] | null;
  onSelect: (key: string | null) => void;
  unit: string;
}) {
  const share = !b.multi && !b.top && b.kind === "count";
  return (
    <div className="ue-breakdown">
      <SimpleChart
        data={b.values}
        share={share}
        unit={b.kind === "count" ? unit : `${b.measure ?? "Утга"}${b.kind === "mean" ? " · дундаж" : ""}`}
        tone={tone}
        selected={selected}
        onSelect={onSelect}
        colorOf={palette ? (key) => palette.get(key) ?? tone : undefined}
      />
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

export function TopicMapLegend({ groups, hideable = false }: {
  groups: LayerLegendGroup[];
  /** Нүдний товчоор бүхэлд нь нууж, гаргана ({@link LegendShell}) — үнэлгээний хэлтэст */
  hideable?: boolean;
}) {
  if (!groups.length) return null;
  const body = <div className="ue-map-legend-body">
      {groups.map((group) => <section key={group.id} className={group.solo ? "is-solo" : undefined}>
        {group.solo ? null : <h3>{group.name}</h3>}
        {group.field && !group.solo ? <p>Өнгөөр ялгасан үзүүлэлт: {group.field}</p> : null}
        {group.items.map((item) => <div key={item.key} className="ue-legend-row">
          <span aria-hidden="true" className={`ue-map-symbol ${group.geometry.includes("Point") ? "is-point" : group.geometry.includes("Polyline") ? "is-line" : "is-area"}`} style={{ color: item.color }} />
          <span title={item.label}>{item.label}</span>
        </div>)}
      </section>)}
    </div>;
  if (hideable) return <LegendShell>{body}</LegendShell>;
  return <details open className="ue-map-legend">
    <summary>Таних тэмдэг</summary>
    {body}
  </details>;
}
