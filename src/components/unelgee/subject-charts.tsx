"use client";

import { AreaChart, PieChart, RowChart, type Datum, type Selection } from "@/components/charts";
import { num } from "@/lib/utils";

/*
  ⚠⚠ ЭНЭ ХЭЛТСИЙН ДИАГРАМ БҮГД ЭНД ХЭЛБЭРЭЭ СОНГОНО (хэрэглэгч,
  2026-10-05: "бүх диаграмыг энгийн болго — он сар өдөр байвал area
  chart, талбарын утга 3-аас цөөн бол donut").

  Урьд нь дулааны хүснэгт, давхарласан зурвас, "Багана | Цэг | Бүтэц"
  сэлгэдэг диаграм, 100%-ийн зурвас гэх мэт зургаан өөр хэлбэр байсан
  тул самбар бүр өөр хэлээр ярьж байв. Одоо ГУРВАН л хэлбэр:

  · хугацаа (он, сар, өдөр) → талбайн диаграм — тасралтгүй тэнхлэг,
    хоосон үе нь тэг болж уналтаар харагдана;
  · 3-аас ЦӨӨН утгатай тоолол → бөгж — асуулт нь "харьцаа нь ямар";
  · бусад бүх задаргаа → хэвтээ зурвас, ихээс бага руу.

  ⚠ ХУВЬ ГАРАХГҮЙ (2026-10-05, хэрэглэгч: "чартуудын %-ийг хас, тоог
  нь оронд нь оруул"). Мөрийн баруун ирмэгт ЗӨВХӨН тоо суудаг — хувь
  нь тооноос дам гардаг тул шинэ мэдээлэл өгөхгүй. `share` нь одоо
  ЗӨВХӨН бөгж сонгох нөхцөл.

  ⚠ ӨНГӨ ГАНЦ — `--data` (2026-10-05, хэрэглэгч: "өнгө таалагдахгүй").
  Ангилал бүрийг өөр өнгөөр будахгүй; `colorOf` нь ЗӨВХӨН хэрэглэгч
  газрын зургийг тухайн задаргаагаар өнгөлөхийг гараар асаасан үед
  (давхаргын самбарын "Зурагт өнгөөр ялгах") — тэр үед диаграм нь
  зургийн тайлбар болно.

  ⚠ Бөгж нь ЗӨВХӨН бүхэл нь мэдэгдэж байгаа үед (`share`): дундаж,
  нийлбэр, олон утгат задаргаа, хураасан жагсаалт дээр хувь нийлээд
  100 болохгүй тул бөгж өөрөө худал хэлнэ — тэдгээр нь зурвас хэвээр.
*/
export const DONUT_BELOW = 3;

export function SimpleChart({
  data,
  time = false,
  share = false,
  unit,
  selected,
  onSelect,
  colorOf,
  tone = "var(--data)",
  format = num,
  formatTick,
  height = 104,
  fill = false,
  ordered = false,
}: {
  data: Datum[];
  /** Хугацааны цуваа эсэх — дарааллаа хадгална */
  time?: boolean;
  /** Бүхэл нь мэдэгдэж байгаа тоолол эсэх — бөгжийг зөвшөөрнө */
  share?: boolean;
  /** Hover самбарт гарах нэгж */
  unit?: string;
  selected?: Selection;
  onSelect?: (key: string | null) => void;
  /** Газрын зурагтай ижил өнгө — ангилал өнгөөр ялгагдсан үед л */
  colorOf?: (key: string) => string;
  tone?: string;
  format?: (v: number) => string;
  formatTick?: (d: Datum, i: number) => string;
  height?: number;
  /** Талбайн диаграм картынхаа үлдсэн өндрийг эзлэх эсэх */
  fill?: boolean;
  /** Ангилал өөрөө эрэмбэтэй (талбайн хэмжээний анги) — утгаар эрэмбэлэхгүй */
  ordered?: boolean;
}) {
  if (time) {
    return (
      <AreaChart
        data={data}
        tone={tone}
        unit={unit}
        selected={selected}
        onSelect={onSelect}
        labels={data.length <= 12}
        height={height}
        fill={fill}
        formatTick={formatTick}
      />
    );
  }
  const hue = colorOf ? (d: Datum) => colorOf(d.key) : undefined;
  if (share && data.length > 0 && data.length < DONUT_BELOW) {
    return (
      <PieChart
        data={data}
        tone={tone}
        colorOf={hue}
        format={format}
        /* Хувь ГАРАХГҮЙ — тоо нь өөрөө хангалттай (доорх тайлбарыг үз) */
        note={() => ""}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }
  return (
    <RowChart
      data={ordered ? data : [...data].sort((a, b) => b.value - a.value)}
      tone={tone}
      colorOf={hue}
      format={format}
      selected={selected}
      onSelect={onSelect}
      dense
    />
  );
}
