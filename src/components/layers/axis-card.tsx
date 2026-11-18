"use client";

import * as React from "react";
import { type Datum } from "@/components/charts";

import {
  categoryKey,
  unitOf,
  type Breakdown,
  type Row,
} from "@/lib/portal-layers";
import { cn, num } from "@/lib/utils";

import { Segments } from "@/components/unelgee/viz";
import { chartTitle, cardWeight, headMeta, soft, noteOf, measureText, isTime } from "./chart-helpers";
import { CutCard } from "./cards";
import type { Loaded } from "./board-shared";

/**
 * ДАВХАРГЫН БҮХ ЗАДАРГАА — НЭГ КАРТ.
 *
 * ⚠⚠ Хэрэглэгч (2026-09-30): "одоо байгаа 2 чартыг нийлүүлээд маш
 * ойлгомжтой сайн чарт хийе. Нийт булгийн тоо бас харагдах ёстой шүү."
 *
 * Гурван зүйл нэг картад нийлнэ:
 * 1. **ТЭНХЛЭГ СЭЛГЭГЧ** — давхарга хэдэн ч задаргаатай байсан НЭГ
 *    карт (дүүрэг · хороо …). Урьд нь задаргаа бүр өөрийн карттай
 *    байсан тул нэг давхаргын мэдээлэл багана даяар тарж, хооронд нь
 *    харьцуулах гэвэл дээш доош гүйх хэрэгтэй байв.
 * 2. **ХҮСНЭГТ** — мөр нь ангилал, багана нь хэмжилт бүр; нүд бүр
 *    ӨӨРИЙН баганын хамгийн их утгатай харьцуулсан зураастай (багана
 *    хоорондоо өөр НЭГЖТЭЙ тул нэг хуваарь хуваалцах боломжгүй).
 * 3. **НИЙТ ДҮНГИЙН МӨР** — ёроолд наалдсан, багана бүрийн дүн
 *    өөрийнхөө баганын доор. "Нийт булгийн тоо" гэдэг нь яг энэ:
 *    хэмжилтийн баганын дүн.
 *    ⚠ ДУНДЖИЙН багана ХООСОН үлдэнэ — дунджуудын нийлбэр утгагүй
 *    тоо (бөгж, эзлэх хувийг дунджид хэрэглэдэггүйтэй нэг зарчим).
 *
 * ⚠ ЗӨВХӨН `tidy` бүрдэлд — ой, амьтан, үнэлгээ ХӨНДӨГДӨХГҮЙ.
 * ⚠ Идэвхтэй тэнхлэг нь ДАМ гарна: шүүлтээр задаргаа алга болвол
 * эхнийх рүү өөрөө буцна (эффектээр төлөв цэвэрлэхгүй).
 * ⚠ Мөр СОНГОХ нь ТОГТООНО, сэлгэхгүй (`pickOnly`): хүснэгт ГАНЦ
 * сонгогдсон утга харуулдаг тул олон сонголт зөвшөөрвөл хадгалагдсан
 * ба тодорсон утга ЗӨРНӨ.
 */
export function AxisCard({
  axes,
  tone,
  first,
  records,
  word,
  selectedOf,
  onPick,
  bars = false,
  dense = false,
  full = false,
  stretch = false,
  fill = false,
  compact = false,
  paletteOf,
}: {
  /** Зурвасын мөр НЭГ ЭГНЭЭ ({@link AxisBars} `compact`) */
  compact?: boolean;
  axes: { key: string; label: string; list: Breakdown[] }[];
  tone: string;
  /**
   * Тэнхлэгийн палитр — газрын зурагтай ИЖИЛ өнгө (хэрэглэгч 2026-10-07,
   * ойн хэсэглэл: "чартын өнгийг бас"). Зургийг будаж буй талбарын
   * тэнхлэгт л буцаана; бусад нь давхаргын ганц өнгө.
   */
  paletteOf?: (axis: string) => Map<string, string> | undefined;
  first: boolean;
  /** Хүснэгтийн оронд зурвас ({@link LayerSet.axisBars}) */
  bars?: boolean;
  /** Давхаргын нийт бичлэг — тооллын баганын дүн */
  records: number;
  /** Бичлэгийг юу гэж нэрлэх ({@link LayerSet.record}) */
  word?: { one: string; count: string };
  selectedOf: (axis: string) => string | null;
  onPick: (axis: string, key: string | null) => void;
  /**
   * ШАХСАН мөр (хэрэглэгч, 2026-10-06: "булгийн нэртэй чартын зайг
   * шахъя"). Нэрийн тэнхлэг хорин мөртэй тул ердийн 10px-ийн доторх
   * зайтай мөр картыг сунгадаг; шахсан үед 4px, нэр НЭГ эгнээнд
   * (бүтэн нь `title`-д). Үсгийн хэмжээ платформын 11–13px мужид.
   */
  dense?: boolean;
  /**
   * БҮТЭН харагдана — баганын өндөр өөрчлөгдөхөд агшиж дотроо
   * гүйхгүй ({@link CutCard} `full`). Хэрэглэгч, 2026-10-06: "дүүргийн
   * чарт resize хийхэд бүтэн харагддаг байхаар хий".
   */
  full?: boolean;
  /**
   * Баганаа дүүргэх карт ({@link LayerSet.fillSolo}) — зурвасын горимд
   * агуулгын өндөрт хумигдахгүй, мөрүүд нь өндрийг ЖИГД хуваана.
   */
  stretch?: boolean;
  /**
   * Зурвасын горимд баганын ҮЛДСЭН өндрийг дүүргэнэ (`CutCard fill` →
   * `.is-fill`), мөрүүд нь жигд тархана (`AxisBars spread`). Мөр олон
   * бол картын ДОТОР гүйнэ.
   */
  fill?: boolean;
}) {
  /* ⚠ "бичлэг" нь мэдээллийн сангийн үг — дэлгэцэд гарахгүй */
  const one = word?.one ?? "бүртгэл";
  const countLabel = word?.count ?? "Бүртгэлийн тоо";
  const [want, setWant] = React.useState(axes[0]?.key ?? "");
  const axis = axes.find((a) => a.key === want) ?? axes[0];
  if (!axis) return null;

  const count = axis.list.find((b) => b.kind === "count") ?? axis.list[0];

  /**
   * Нэг баганын тодорхойлолт.
   *
   * ⚠⚠ НЭР ба НЭГЖ ХОЁР МӨРӨНД ({@link unitOf}). Урьд нь бүтэн нэрийг
   * нэг нүдэнд шахаж "ЭНГИЙН ХАМГААЛАЛТЫН БҮС (200 М), ГА" гэж ГУРВАН
   * мөр болгодог байсан тул толгой нь хүснэгтээ дардаг байв. Нэгжийг
   * доор нь жижиг саарал мөр болгоход нэр нь хоёр мөрөнд багтаж,
   * нэгж нь тодорхой хэвээр үлдэнэ.
   */
  type Col = {
    key: string;
    name: string;
    unit: string;
    by: Map<string, number>;
    total: number | null;
  };

  const cols: Col[] = [];
  const add = (
    key: string,
    label: string,
    by: Map<string, number>,
    sums: boolean,
  ) => {
    const cut = unitOf(label);
    cols.push({
      key,
      name: cut.unit ? cut.name : label,
      unit: cut.unit,
      by,
      total: sums ? [...by.values()].reduce((s, v) => s + v, 0) : null,
    });
  };

  for (const b of axis.list) {
    const by = new Map(b.values.map((d) => [d.key, d.value]));
    if (b.measure) {
      const cut = unitOf(b.measure);
      cols.push({
        key: b.id,
        name: cut.unit ? cut.name : b.measure,
        unit: [cut.unit, b.kind === "mean" ? "дундаж" : ""]
          .filter(Boolean)
          .join(" · "),
        by,
        total:
          b.kind === "mean"
            ? null
            : [...by.values()].reduce((s, v) => s + v, 0),
      });
    } else {
      add(b.id, countLabel, by, true);
    }
    /* Нийлсэн хэмжилт ({@link foldMeasures}) — өөрийн багана */
    if (b.notes && b.note) add(`${b.id}:note`, b.note.label, b.notes, true);
  }

  const picked = selectedOf(axis.key);
  const pal = paletteOf?.(axis.key);

  /*
    ⚠⚠ **ТЕГРҮҮЛЕГЧ УТГА ТОДОРНО — ДҮҮРГЕЛТГҮЙ**
    (хэрэглэгч, 2026-09-30: "энэ стиль биш юм байна").
    Нүд бүрд баганынхаа хэмжээгээр дэвсгэр өнгө өгсөн дулааны
    хүснэгт БУЦААГДСАН — **дахин бүү давт**. Тэр нь
    биотехникийн хүснэгтээс БУЦААГДСАН яг тэр шийдэл
    (2026-09-21): дүүргэлт нь хүснэгтийг өнгөний БЛОК болгож,
    тооноосоо илүү жин авдаг — дизайны 7 дүгээр дүрэм ("өнгө нь
    зураас/цэг/икон дээр л гарна") яг энэ тухай.

    ✅ Одоо өнгө нь БИЧВЕР дээр: багана бүрийн ТЕГРҮҮЛЕГЧ
    утга давхаргынхаа өнгөөр, хагас тодоор бичигдэнэ; бусад нь
    цэвэр тоо. "Аль ангилал ямар үзүүлэлтээр түрүнээд байна" гэдгийг
    дулааны хүснэгттэй ижил хэлнэ — гэхдээ ганц тодорсон цэгээр,
    бүтэн багана өнгөөр дүүрдэггүй.
    ⚠ БҮГД ТЭНЦҮҮ БАЙВАЛ ТОДРУУЛГА ГАРАХГҮЙ: бүх нүд тодорсон
    багана нь "тэргүүлэгч" гэдгийг заахаа болино.
    ⚠ ГАНЦ МӨРТЭЙ диаграмд бас ГАРАХГҮЙ — өөртэй нь
    харьцуулах зүйл байхгүй.
  */
  /*
    ⚠⚠ ОЛОН УТГАТАЙ ТЭНХЛЭГТ НИЙТ ДҮН ГАРАХГҮЙ (ойн сессийн
    анхааруулга, 2026-10-07). Нэг бүртгэл хэд хэдэн ангилалд (дүүрэгт)
    хамаарвал мөр бүрд тоологдох тул нийлбэр нь бүртгэлийн тооноос ИХ
    гарна — ойн тусгай хамгаалалттай газрын 42 талбайн 7 нь хэд хэдэн
    дүүрэгт. Хүснэгтийн ёроолын мөр ба зурвасын "Нийт" хоёуланд.
    Дунджийн нийлбэр утгагүйтэй нэг зарчим (`Matrix`-ийн `colTotals`).
  */
  if (axis.list.some((b) => b.multi)) for (const c of cols) c.total = null;
  const lead = new Map<string, number | null>(
    cols.map((c) => {
      const vs = [...c.by.values()];
      if (vs.length < 2) return [c.key, null];
      const top = Math.max(...vs);
      return [c.key, vs.every((v) => v === top) ? null : top];
    }),
  );
  const isLead = (c: Col, v: number | undefined) =>
    v != null && lead.get(c.key) === v;
  const cell = (v: number | undefined) =>
    v == null ? <span className="text-ink-3">—</span> : num(Math.round(v));
  /* Зурвасын горимын гол багана — толгой ба нийт дүнд */
  const main = cols.find((c) => c.key === count.id);
  const title =
    bars && count.kind !== "count" ? chartTitle(count) : count.label;

  return (
    <CutCard
      /* Зурвасын горимд хэмжилтийн диаграм ("Нэр" тэнхлэг — талбай)
         юуг хэмжсэнээ гарчигтаа хэлнэ: хүснэгтэд тэр нь баганын
         толгойд байсан */
      title={title}
      tone={tone}
      first={first}
      weight={cardWeight(count)}
      /* Зурвасын горимд агуулгынхаа өндөртэй — дөрвөн мөрийн доор
         картын тал хоосон үлддэг байв (хэрэглэгч, 2026-10-07) */
      full={full || (bars && !stretch && !fill)}
      fill={bars && fill}
      low={compact}
      /* Зурвас ТАЛБАЙГ хэмжвэл ({@link LayerSet.measureFirst}) толгой нь
         бүртгэлийн тоо биш нийт талбай — "139 бүртгэл" нь зурвасуудтай
         зөрдөг байв (хэрэглэгч 2026-10-23) */
      meta={
        count.measure && !count.top
          ? headMeta(count, word)
          : `${num(records)} ${one} · ${
              count.top
                ? `эхний ${count.top}`
                : `${num(count.values.length)} ангилал`
            }`
      }
      action={
        /* Зурвасын горимд товчнууд БИЕД — гарчгийг хоёр мөр болгож
           шахдаг байв (доорхыг үзнэ үү) */
        axes.length > 1 && !bars ? (
          <Segments
            options={axes.map((a) => ({ id: a.key, label: a.label }))}
            value={axis.key}
            onChange={setWant}
          />
        ) : undefined
      }
    >
      {bars ? (
        /* ⚠ ЗУРВАСЫН ГОРИМ ({@link LayerSet.axisBars}): зөвхөн тэнхлэгийн
           ГОЛ диаграм (тоолол, эс бөгөөс эхний хэмжилт) зурагдана;
           нийлсэн хэмжилт (га) нь мөрийн ард бүдэг бичвэр. Бусад
           хэмжилтийн багана энд ГАРАХГҮЙ — ойн давхаргад тийм зүйл
           байхгүй (2026-10-06-нд шалгасан). */
        /*
          ⚠⚠ ЗУРВАСЫН ГОРИМ САЙЖИРСАН (хэрэглэгч, 2026-10-07, намгархаг
          газрын картаар: "чартаа сайжруулаачээ"). Хүснэгтээс зурвас руу
          шилжихэд ГУРВАН зүйл алдагдаж байв:
          1. ЮУГ хэмждэг нь — хүснэгтэд баганын толгой ("Айлын тоо")
             байсан; толгойн "61 бүртгэл" нь зурвасын нийлбэр (57 айл)
             БИШ тул төөрөгдүүлнэ. Одоо жагсаалтын дээр тэнхлэг ·
             хэмжигдэхүүний толгой.
          2. НИЙТ дүн — хүснэгтийн ёроолын мөр. Одоо жагсаалтын доор
             (дундаж, олон утгат тэнхлэг дээр гарахгүй).
          3. Гарчиг — сэлгэх товчнууд нэг эгнээнд шахаж гарчгийг хоёр
             мөр болгодог байв. Одоо товчнууд гарчгийн ДООР өөрийн
             эгнээнд.
          ⚠ Ойн хэлтсийн зурвасын горимд ч мөн үйлчилнэ (ойн сесс
          зөвшөөрсөн, 2026-10-07).
        */
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          {axes.length > 1 ? (
            <div className="shrink-0">
              <Segments
                options={axes.map((a) => ({ id: a.key, label: a.label }))}
                value={axis.key}
                onChange={setWant}
              />
            </div>
          ) : null}
          {/* Нягт горимд толгой, нийт мөр ГАРАХГҮЙ — тэнхлэгийн нэр нь
              картын гарчиг, нийт тоо нь толгойн мета-д аль хэдийн бий */}
          {compact ? null : (
            <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-line pb-1">
              {/* Тэнхлэгийн нэр гарчигтай ижил бол ДАВТАХГҮЙ (ойн
                хэсэглэл: "Тусгай хамгаалалттай газар" хоёр удаа) */}
              <span className="eyebrow min-w-0 truncate text-ink-3">
                {axes.length > 1 || axis.label !== title ? axis.label : ""}
              </span>
              <span className="eyebrow shrink-0 text-ink-3">
                {main
                  ? `${main.name}${main.unit ? `, ${main.unit}` : ""}`
                  : countLabel}
              </span>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            <AxisBars
              spread={stretch || fill}
              compact={compact}
              colorOf={pal ? (d) => soft(pal.get(d.key)) : undefined}
              data={count.values}
              tone={tone}
              selected={picked}
              onSelect={(k) => onPick(axis.key, k)}
              note={noteOf(count)}
              format={count.kind === "count" ? num : measureText}
            />
          </div>
          {!compact && main?.total != null && count.values.length > 1 ? (
            <div className="flex shrink-0 items-baseline justify-between gap-3 border-t border-line-2 pt-1.5">
              <span className="text-[11.5px] font-medium text-ink-2">
                Нийт
                <span className="num ml-1.5 font-normal text-ink-3">
                  · {num(count.values.length)} ангилал
                </span>
              </span>
              <span className="num text-[12.5px] font-medium text-ink">
                {num(Math.round(main.total))}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/*
            ⚠⚠ ХҮСНЭГТ КАРТАА ДҮҮРГЭНЭ (`h-full` + доорх дүүргэгч мөр,
            2026-10-02). Карт нь баганынхаа үлдсэн өндрийг хуваалцдаг
            болсон тул (`flex-grow`) мөрүүд нь дээдээ эгнээд доороо
            хоосон зай үлдээдэг байв — нийт дүнгийн мөр тэр хоосон зайн
            ДЭЭР дүүжлэгдэнэ.
            ⚠ `sticky bottom` ҮҮНИЙГ ШИЙДЭХГҮЙ: наалдац нь зөвхөн
            агуулга ХАЛИХ үед л ажилладаг; карт агуулгаасаа өндөр үед
            мөр байрандаа үлдэнэ.
          */}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="h-full w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th
                    className={cn(
                      "sticky top-0 z-10 border-b border-line-2 bg-paper-2 px-2 text-left align-bottom",
                      dense ? "py-1.5" : "py-2",
                    )}
                  >
                    <span className="eyebrow text-ink-3">{axis.label}</span>
                  </th>
                  {cols.map((c) => (
                    <th
                      key={c.key}
                      className={cn(
                        "sticky top-0 z-10 border-b border-line-2 border-l border-l-line bg-paper-2 px-2 text-right align-bottom",
                        dense ? "py-1.5" : "py-2",
                      )}
                    >
                      <span className="eyebrow block leading-tight text-ink-3">
                        {c.name}
                      </span>
                      {c.unit ? (
                        <span className="mt-0.5 block text-[9.5px] leading-none text-ink-3 lowercase">
                          {c.unit}
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {count.values.map((r) => {
                  const on = picked === r.key;
                  return (
                    <tr
                      key={r.key}
                      tabIndex={0}
                      aria-selected={on}
                      onClick={() => onPick(axis.key, on ? null : r.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPick(axis.key, on ? null : r.key);
                        }
                      }}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-paper-hi",
                        on && "bg-paper-hi",
                      )}
                      style={{ opacity: picked && !on ? 0.45 : 1 }}
                    >
                      <td
                        className={cn(
                          "border-b border-line px-2 leading-tight",
                          dense
                            ? "w-full max-w-0 truncate py-1 text-[11.5px]"
                            : "py-2.5 text-[12px]",
                          on ? "font-medium text-ink" : "text-ink-2",
                        )}
                        title={dense ? r.label : undefined}
                      >
                        {r.label}
                      </td>
                      {cols.map((c) => {
                        const v = c.by.get(r.key);
                        const top = isLead(c, v);
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              "num border-b border-line border-l border-l-line px-2 text-right",
                              dense
                                ? "py-1 text-[11.5px] whitespace-nowrap"
                                : "py-2.5 text-[12.5px]",
                              top ? "font-medium" : "text-ink",
                            )}
                            style={top ? { color: tone } : undefined}
                          >
                            {cell(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/*
                  ДҮҮРГЭГЧ МӨР — үлдсэн өндрийг БҮТНЭЭР нь шингээнэ
                  (`h-full`), улмаас бодит мөрүүд нягтралаа хадгалж,
                  нийт дүн нь картынхаа ёроолд суана.
                  ⚠ Агуулга халих үед өндөр нь өөрөө тэг болно.
                  ⚠ Товшигддоггүй, хүрээгүй — зөвхөн зай эзэлнэ.
                */}
                <tr aria-hidden="true" className="h-full">
                  <td colSpan={cols.length + 1} />
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td
                    className={cn(
                      "sticky bottom-0 border-t border-line-2 bg-paper-2 px-2 text-[11.5px] font-medium text-ink-2",
                      dense ? "py-1.5" : "py-2",
                    )}
                  >
                    Нийт
                  </td>
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "num sticky bottom-0 border-t border-line-2 border-l border-l-line bg-paper-2 px-2 text-right font-medium text-ink",
                        dense ? "py-1.5 text-[11.5px]" : "py-2 text-[12.5px]",
                      )}
                    >
                      {c.total == null ? "" : num(Math.round(c.total))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </CutCard>
  );
}

/**
 * ГАЗРЫН ЖАГСААЛТ — баганын ҮЛДСЭН өндрийг бодит бүртгэлээр дүүргэнэ
 * ({@link LayerSet.recordList}).
 *
 * ⚠⚠ Хэрэглэгч 2026-10-07-нд дөрвөн хувилбараас сонгосон ("Газрын
 * жагсаалт"). Өмнө нь ТАВАН арга буцаагдсан: зурвасын мөрийг сунгах,
 * тэнхлэг бүрийг тусдаа карт болгох, босоо баганан диаграм, хэвтээ
 * хүснэгт — бүгд хоосон зайг ДҮРСЛЭЛЭЭР дүүргэх оролдлого байв. Энэ нь
 * зайг АГУУЛГААР дүүргэнэ: цэг бүр нэр · ангилал · дүүрэг · хэмжилтээр.
 *
 * ⚠ Мөр нь ТАЛБАРЫН шүүлтийг дагана (`passes`), харин БИЧЛЭГИЙН
 * сонголтыг ДАГАХГҮЙ: мөр дарахад тэр бичлэг бүх самбарын шүүлт болдог
 * ({@link views}) тул жагсаалт ганц мөр болж хумигдвал өөр газар руу
 * шилжих арга алга болно. Сонгосон мөр нь зөвхөн тодорно.
 * ⚠ Өнгөт цэг нь зургийн палитраас (`palettes`) — жагсаалт, зураг,
 * таних тэмдэг гурав нэг өнгө хэлнэ.
 * ⚠ Мөр дарахад зураг тэр цэг рүү ойртоно (`rowPick`); дахин дарвал
 * сонголт цуцлагдана.
 */
export function RecordListCard({
  hit,
  base,
  tone,
  word,
  passes,
  palette,
  picked,
  onPick,
}: {
  hit: Loaded;
  base: number;
  tone: string;
  word?: { one?: string; count?: string };
  passes: (row: Row) => boolean;
  palette?: { colors: Map<string, string>; keyOf: (row: Row) => string[] };
  picked: number | null;
  onPick: (uid: number | null) => void;
}) {
  const nameField = hit.labels.name;
  /* Мөрийн доорх хоёр шошго: өнгөлсөн талбар эхэнд, дараа нь засаг
     захиргааны нэгж. Хугацааны, хураасан задаргаа ОРОХГҮЙ */
  const tags = React.useMemo(() => {
    const counts = hit.charts.filter(
      (b) =>
        b.kind === "count" && !b.top && !isTime(b) && b.field !== nameField,
    );
    const lead = palette
      ? counts.find((b) => b.keyOf === palette.keyOf)
      : undefined;
    const admin = counts.find(
      (b) => b !== lead && /дүүрэг|сум|duureg/i.test(`${b.label} ${b.field}`),
    );
    return [lead, admin].filter((b): b is Breakdown => !!b);
  }, [hit.charts, nameField, palette]);
  /* Хэмжилт — эхний НИЙЛБЭР задаргааны талбар (айлын тоо гэх мэт) */
  const measure = React.useMemo(() => {
    const b = hit.charts.find((c) => c.kind === "sum" && c.measure);
    if (!b?.measure) return null;
    const f = hit.info.fields.find((x) => x.alias === b.measure);
    return f ? { name: f.name, label: b.measure } : null;
  }, [hit.charts, hit.info.fields]);

  const items = React.useMemo(() => {
    const out: {
      uid: number;
      name: string;
      tags: string[];
      color?: string;
      value: number | null;
    }[] = [];
    for (const [k, row] of Object.entries(hit.data.rows)) {
      if (!passes(row)) continue;
      const oid = Number(k);
      const raw = nameField ? categoryKey(row[nameField]) : "Бүртгэгдээгүй";
      const t = tags.map((b) => {
        const key = b.keyOf(row)[0];
        return key ? (b.values.find((d) => d.key === key)?.label ?? key) : "";
      });
      const v =
        measure && row[measure.name] != null ? Number(row[measure.name]) : NaN;
      out.push({
        uid: base + oid,
        name: raw !== "Бүртгэгдээгүй" ? raw : `№ ${oid}`,
        tags: t.filter(Boolean),
        color: palette?.colors.get(palette.keyOf(row)[0] ?? ""),
        value: Number.isFinite(v) ? v : null,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, "mn"));
  }, [hit.data.rows, passes, nameField, tags, measure, palette, base]);

  return (
    <CutCard
      title="Газрын жагсаалт"
      tone={tone}
      meta={`${num(items.length)} ${word?.one ?? "бүртгэл"}`}
      fill
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {measure ? (
          <div className="sticky top-0 z-[1] grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-line bg-paper-2 px-1.5 pb-1 text-[10px] text-ink-3 uppercase">
            <span>Нэр</span>
            <span className="text-right">{measure.label}</span>
          </div>
        ) : null}
        <ul className="divide-y divide-line">
          {items.map((it) => {
            const on = picked === it.uid;
            return (
              <li key={it.uid}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(on ? null : it.uid)}
                  className={cn(
                    "grid w-full grid-cols-[8px_minmax(0,1fr)_auto] items-start gap-x-2.5 px-1.5 py-1.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                    on && "bg-paper-hi",
                  )}
                  style={
                    on ? { boxShadow: `inset 2px 0 0 ${tone}` } : undefined
                  }
                >
                  <span
                    aria-hidden
                    className="mt-[5px] size-2 rounded-full"
                    style={{ background: it.color ?? tone }}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block truncate text-[12px]",
                        on ? "text-ink" : "text-ink-2",
                      )}
                      title={it.name}
                    >
                      {it.name}
                    </span>
                    {it.tags.length ? (
                      <span className="block truncate text-[10.5px] text-ink-3">
                        {it.tags.join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  {measure ? (
                    <span className="num pt-px text-right text-[12px] text-ink">
                      {it.value == null ? "—" : num(it.value)}
                    </span>
                  ) : (
                    <span />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </CutCard>
  );
}

/**
 * ТЭНХЛЭГИЙН ЗУРВАС — хэмжих хэрэгслийн хэвтээ хуваарь
 * (хэрэглэгч, 2026-10-07, намгархаг газрын картаар: "маш энгийн байна,
 * сайжруулаарай").
 *
 * `RowChart`-ын нимгэн зураас нь мөр бүрийн НЭРИЙН доор бараг үл
 * мэдэгдэх шугам болж, утгууд хоорондоо хэр зөрдөг нь хуваарьгүй тул
 * уншигддаггүй байв. Энэ нь платформын "хээрийн хэмжих хэрэгсэл"
 * хэлээр:
 *
 * - ЭРЭМБЭ ("01", "02") — жагсаалт нь буурах дарааллаар гэдгийг хэлнэ;
 * - ЗАМ ДЭЭРХ ЗУРВАС (6px) — зам нь бүтэн хуваарийг заана, зурвас нь
 *   түүний хэсэг; ганц өнгө (`tone`), ялгаа нь уртаараа;
 * - ТЭРГҮҮЛЭГЧ УТГА давхаргын өнгөөр — хүснэгтийн `isLead`-тэй нэг
 *   дүрэм; бүгд тэнцүү бол тодрохгүй;
 * - ДООР НЬ ХУВААРЬ (`.ruler` сэдэл) — 0-ээс хамгийн их утга хүртэл
 *   "сайхан" алхмаар (1·2·5 × 10ⁿ); зурвасын урт юуг заахыг уншина.
 *
 * ⚠ Сүүдэр, градиент, дүүргэлттэй дэвсгэр БАЙХГҮЙ (дизайны 1, 7-р
 * дүрэм). Сонгосон мөр нь `inset 2px` зураас + `paper-hi` дэвсгэр.
 * ⚠ Хувь БИЧИХГҮЙ (хэрэглэгч, 2026-09-25).
 */
export function niceStep(max: number): number {
  if (!(max > 0)) return 1;
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

export function AxisBars({
  spread = false,
  compact = false,
  colorOf,
  data,
  tone,
  selected,
  onSelect,
  note,
  format,
}: {
  /**
   * Сунгасан картад мөрүүд өндрийг ЖИГД хуваана — дээд талдаа
   * шахагдаж доороо хоосон үлдэхгүй (ойн `fillSolo`, 2026-10-07).
   * ⚠ Мөр бүр 88px-ээс өндөр болохгүй: цөөн мөртэй үед зурвас
   * хоорондоо хэт холдож, жагсаалт биш тусдаа зүйлс мэт уншигдана.
   */
  spread?: boolean;
  /**
   * НЭГ ЭГНЭЭНИЙ МӨР — эрэмбэ · нэр · зурвас · тоо зэрэгцэнэ (~24px,
   * ердийнх ~44px). Олон карт нэг баганад зэрэг харагдах бүрдэлд
   * ({@link LayerSet.unfold}). Хуваарь гарахгүй — тоо нь мөр бүрд бий.
   */
  compact?: boolean;
  /** Газрын зурагтай ижил ангиллын өнгө ({@link AxisCard} `paletteOf`) */
  colorOf?: (d: Datum) => string | undefined;
  data: Datum[];
  tone: string;
  selected: string | null;
  onSelect: (key: string | null) => void;
  note?: (d: Datum) => string;
  format: (v: number) => string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (compact) {
    const lead1 =
      data.length > 1 && data.some((d) => d.value !== max) ? max : null;
    const pad1 = Math.max(2, String(data.length).length);
    return (
      <div className="flex flex-col">
        {data.map((d, i) => {
          const on = selected === d.key;
          const isLead = lead1 != null && d.value === lead1;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : d.key)}
              className={cn(
                "grid w-full grid-cols-[auto_minmax(0,9.5rem)_minmax(0,1fr)_3.5rem] items-center gap-x-2.5 rounded-xs px-1.5 py-[3.5px] text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                on && "bg-paper-hi",
              )}
              style={on ? { boxShadow: `inset 2px 0 0 ${tone}` } : undefined}
            >
              <span className="num text-[10px] text-ink-3">
                {String(i + 1).padStart(pad1, "0")}
              </span>
              <span
                className={cn(
                  "truncate text-[12px]",
                  on ? "text-ink" : "text-ink-2",
                )}
                title={d.label}
              >
                {d.label}
              </span>
              <span
                aria-hidden
                className="h-1.5 overflow-hidden rounded-[1px] bg-line"
              >
                <span
                  className="block h-full rounded-[1px]"
                  style={{
                    width: `${max > 0 ? Math.max(1.5, (d.value / max) * 100) : 0}%`,
                    background: colorOf?.(d) ?? tone,
                    opacity: on || selected == null ? 1 : 0.45,
                  }}
                />
              </span>
              <span
                className="num text-right text-[12.5px] font-medium text-ink"
                style={
                  isLead
                    ? {
                        color: `oklch(from ${tone} var(--value-l) calc(c * var(--value-c)) h)`,
                      }
                    : undefined
                }
              >
                {format(d.value)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
  const step = niceStep(max);
  /* Хуваарийн дээд хязгаар — хамгийн их утгыг багтаах хамгийн бага
     алхмын үржвэр; эс тэгвээс хамгийн урт зурвас хуваарийнхаа ирмэгт
     наалдаж, сүүлийн шошго хэрэгцээгүй өндөр гарна */
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  const lead =
    data.length > 1 && data.some((d) => d.value !== max) ? max : null;
  const pad = String(data.length).length < 2 ? 2 : String(data.length).length;

  return (
    <div className={cn("flex flex-col", spread && "h-full")}>
      <div
        className={cn(
          "flex flex-col gap-0.5",
          /* ⚠ `min-h-0` ТАВИХГҮЙ: мөр олон бол жагсаалт агуулгаараа
             өндөрсөж карт ДОТРОО гүйнэ — эс тэгвээс мөрүүд агшиж
             бичвэр нь зурвасан дээгүүр давхцдаг байв (2026-10-23) */
          spread && "flex-1 justify-evenly",
        )}
      >
        {data.map((d, i) => {
          const on = selected === d.key;
          const extra = note?.(d);
          const isLead = lead != null && d.value === lead;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : d.key)}
              className={cn(
                "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-1 rounded-xs px-1.5 py-1.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
                on && "bg-paper-hi",
                spread && "max-h-[88px] shrink-0",
              )}
              style={on ? { boxShadow: `inset 2px 0 0 ${tone}` } : undefined}
            >
              <span className="num text-[10px] text-ink-3">
                {String(i + 1).padStart(pad, "0")}
              </span>
              <span
                className={cn(
                  "truncate text-[12px]",
                  on ? "text-ink" : "text-ink-2",
                )}
                title={d.label}
              >
                {d.label}
                {extra ? (
                  <span className="num ml-1.5 text-[11px] text-ink-3">
                    {extra}
                  </span>
                ) : null}
              </span>
              <span
                className="num text-right text-[13px] font-medium text-ink"
                style={
                  isLead
                    ? {
                        color: `oklch(from ${tone} var(--value-l) calc(c * var(--value-c)) h)`,
                      }
                    : undefined
                }
              >
                {format(d.value)}
              </span>
              <span
                aria-hidden
                className="col-span-2 col-start-2 h-1.5 overflow-hidden rounded-[1px] bg-line"
              >
                <span
                  className="block h-full rounded-[1px]"
                  style={{
                    width: `${top > 0 ? Math.max(1.5, (d.value / top) * 100) : 0}%`,
                    background: colorOf?.(d) ?? tone,
                    opacity: on || selected == null ? 1 : 0.45,
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
      {/* Хуваарь — мөрүүдтэй ИЖИЛ тор: эрэмбийн баганын үл үзэгдэх
          орлуулагч нь зүүн ирмэгийг зурвасны эхлэлтэй ЯГ таацуулна */}
      {max > 0 ? (
        <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 px-1.5">
          <span aria-hidden className="num invisible text-[10px]">
            {"0".repeat(pad)}
          </span>
          <div className="relative h-4 border-t border-line-2">
            {ticks.map((v, ti) => (
              <span
                key={v}
                className={cn(
                  "num absolute top-0 pt-0.5 text-[10px] text-ink-3",
                  /* Ирмэгийн шошго дотогшоо эгнэнэ — голлуулбал картаас
                     хальж тасардаг байв ("8,00") */
                  ti === 0
                    ? "translate-x-0"
                    : ti === ticks.length - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2",
                )}
                style={{ left: `${(v / top) * 100}%` }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute -top-px h-1 w-px bg-line-2",
                    ti === 0
                      ? "left-0"
                      : ti === ticks.length - 1
                        ? "right-0"
                        : "left-1/2",
                  )}
                />
                {format(v)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
