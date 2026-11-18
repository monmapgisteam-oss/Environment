"use client";

import * as React from "react";
import { MapPin, ChevronDown, Loader2 } from "lucide-react";

import { countParcelsIn, ringsOf } from "@/lib/parcels";
import { MapPanel, useMapPanel } from "@/components/map/panel";


import {
  categoryKey,
  isSystemField,
  unitOf,
  type LayerSet,
} from "@/lib/portal-layers";
import { cn, num } from "@/lib/utils";

import type { Loaded } from "./board-shared";
import { leadGroup } from "./board-shared";
import { adminRank } from "./chart-helpers";

/**
 * Сонгосон бичлэгийн хөвөгч самбар.
 *
 * Платформын бусад ес самбартай нэг зан төлөв: толгойгоороо чирэгдэж,
 * булангаасаа хэмжээ нь солигдоно. Зургийн буланд суудаг тул доор нь
 * яг тэр дүрс орвол хаагдана — хэрэглэгч хааж, ойртож, дахин нээх
 * ёсгүй.
 */
/** Дүрс тус бүрт давхцах нэгж талбарын тоо — товч цонхны кэш */
export const SHAPE_PARCELS = new Map<string, Promise<number>>();

export function RecordPanel({
  hit,
  row,
  oid,
  place,
  tone,
  onClose,
}: {
  hit: Loaded;
  row: Record<string, unknown>;
  /** Давхарга доторх ТҮҮХИЙ дугаар (`objectid`) */
  oid: number;
  /** Тооцоолсон байршлын нэр ({@link LayerSet.placeNames}) — ангилалгүй үед */
  place?: string;
  tone: string;
  onClose: () => void;
}) {
  const panel = useMapPanel("left");
  const { info } = hit;
  const brief = Boolean(info.set.brief);
  /* Цонхны диаграм ({@link LayerSet.recordCharts}) — тэдгээрт орсон
     талбар жагсаалтад ДАХИН гарахгүй (бөглөгдсөн ч, бөглөөгүй ч) */
  const groups = info.set.recordCharts?.[info.id] ?? [];
  const charted = new Set(
    groups.flatMap((g) => [
      ...(g.total ? [g.total] : []),
      ...g.years.map((y) => y.field),
    ]),
  );

  /*
    ДҮРСТЭЙ ДАВХЦАХ НЭГЖ ТАЛБАР — товч цонхонд ({@link LayerSet.brief}).
    Тухайн НЭГ дүрсийн хүрээгээр серверээс тоолно; хариу нь дүрс тус
    бүрээр кэшлэгдэнэ (`SHAPE_PARCELS`) тул дахин дарахад асуухгүй.
    ⚠ Үр дүн ТҮЛХҮҮРТЭЙГЭЭ — өөр дүрс сонгоход хуучин тоо гарахгүй
    (эффектээс `set*(null)` дуудахгүйн тулд ДАМ шалгана).
  */
  const countKey = `${info.name}\u0000${oid}`;
  const [parcelCount, setParcelCount] = React.useState<{
    key: string;
    n: number | null;
  } | null>(null);
  React.useEffect(() => {
    if (!brief) return;
    const f = hit.data.shapes.features.find((x) => Number(x.id) === oid);
    const rings = f ? ringsOf([f]) : [];
    if (!rings.length) return;
    let p = SHAPE_PARCELS.get(countKey);
    if (!p) {
      p = countParcelsIn(rings);
      SHAPE_PARCELS.set(countKey, p);
      /* Унасан амлалтыг кэшид үлдээхгүй */
      p.catch(() => SHAPE_PARCELS.delete(countKey));
    }
    let live = true;
    p.then(
      (n) => live && setParcelCount({ key: countKey, n }),
      () => live && setParcelCount({ key: countKey, n: null }),
    );
    return () => {
      live = false;
    };
  }, [brief, hit, oid, countKey]);
  const parcels = parcelCount?.key === countKey ? parcelCount : null;

  /*
    ⚠⚠ ЗАГВАР ШИНЭЧЛЭГДСЭН (хэрэглэгч, 2026-10-06: "pop up загвар
    шинэчилье"). Урьд нь давхаргын нэр л гарчигт сууж, бүх талбар нэг
    жагсаалтад ИЖИЛ ЖИНТЭЙ — ТОМ ҮСГЭЭР, 92px-ийн баганад — цуварч,
    хоосон талбарууд бөглөгдсөнүүдийн ДУНД холилдож байв. Аль дүрс
    сонгогдсон, тэр нь хэр том вэ гэдгийг жагсаалтаас хайж олох хэрэгтэй
    болдог байлаа. Одоо ГУРВАН давхарга:

    1. ТОЛГОЙ — өнгөт тэмдэг (зургийн өнгө), дүрсийн НЭР (зургийн
       шошго ба бүсийн картын мөртэй НЭГ эх сурвалж), талбай.
    2. БӨГЛӨГДСӨН ТАЛБАРУУД — нэр · утга хоёр баганаар, энгийн үсгээр.
    3. БӨГЛӨӨГҮЙ ТАЛБАРУУД — доор нь тоотойгоо, нэрсээр нь.
       ⚠ ХАСААГҮЙ: 2026-09-30-нд "хоосон ч хамаагүй бүх талбар"
       гэсэн шийдвэр хэвээр — хоосон байдал нь өөрөө мэдээлэл. Зөвхөн
       бөглөгдсөн утгуудын дундаас ЯЛГАРСАН.
  */
  const name = hit.labels.name ? categoryKey(row[hit.labels.name]) : "";
  const group = leadGroup(hit);
  const tag = group ? categoryKey(row[group]) : "Бүртгэгдээгүй";
  const title =
    name && name !== "Бүртгэгдээгүй"
      ? name
      : tag !== "Бүртгэгдээгүй"
        ? `${tag} · № ${oid}`
        : place
          ? place
          : `№ ${oid}`;
  const rawArea = hit.data.area[oid];
  const ha =
    rawArea != null && Number.isFinite(rawArea)
      ? info.areaInHa
        ? rawArea
        : rawArea / 10000
      : null;

  const filled: {
    name: string;
    /** Шошго — нэгж нь утга руу шилжсэн бол нэгжгүй нэр */
    label: string;
    text: string;
    unit: string;
    isNum: boolean;
    /** Урт бичвэр — шошго нь дээр, утга нь бүтэн өргөнөөр */
    wide: boolean;
  }[] = [];
  const empty: { name: string; alias: string }[] = [];
  /*
    ⚠⚠ БАЙРШИЛ ТОЛГОЙД (хэрэглэгч, 2026-10-22: "buh datanii pop up
    saijruulaarai"). Засаг захиргааны шат (аймаг · сум, дүүрэг · баг,
    хороо — {@link adminRank}) нь жагсаалтын дунд тархаж, "хаана вэ"
    гэдэг нь хэдэн мөрөөс угсрагддаг байв. Одоо нэрийн доор НЭГ мөр,
    өргөнөөс нарийн руу; жагсаалтад давтагдахгүй.
    ⚠ Богино утга л (≤ 40 тэмдэгт): урт бол тэр нь хаяг, тайлбар —
    жагсаалтад бүтнээрээ үлдэнэ.
  */
  const where: { rank: number; text: string }[] = [];
  /* Толгойд гарсан утга жагсаалтад ДАВТАГДАХГҮЙ — нэг тоог хоёр газар
     бичихгүй дүрэм (нэр, ангилал, талбай) */
  const shown = new Set<string>();
  if (name && name !== "Бүртгэгдээгүй" && hit.labels.name)
    shown.add(hit.labels.name);
  if (group && tag !== "Бүртгэгдээгүй") shown.add(group);
  if (ha != null && info.areaField) shown.add(info.areaField);
  for (const f of info.fields) {
    if (shown.has(f.name) || charted.has(f.name)) continue;
    const rank = adminRank(f.alias) ?? adminRank(f.name);
    if (rank == null) continue;
    const v = row[f.name];
    const t =
      typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    if (!t || t.length > 40) continue;
    shown.add(f.name);
    if (t !== title && !where.some((w) => w.text === t))
      where.push({ rank, text: t });
  }
  where.sort((a, b) => a.rank - b.rank);
  for (const f of info.fields) {
    if (shown.has(f.name) || charted.has(f.name)) continue;
    /* Систем талбар (дугаарлалт, координат, нэгтгэлийн үлдэц) хүнд
       юу ч хэлэхгүй ({@link isSystemField}) — бөглөөгүй хэсэгт ч орохгүй */
    if (isSystemField(f.name, f.alias)) continue;
    const v = row[f.name];
    const text = typeof v === "string" ? v.trim() : v;
    if (text === "" || text == null) {
      empty.push({ name: f.name, alias: f.alias });
      continue;
    }
    const out = fieldText(f, text);
    if (!out.text) {
      empty.push({ name: f.name, alias: f.alias });
      continue;
    }
    filled.push({
      name: f.name,
      label: out.unit ? unitOf(f.alias).name : f.alias,
      text: out.text,
      unit: out.unit,
      isNum: out.isNum,
      wide: !out.isNum && out.text.length > 48,
    });
  }

  /*
    ⚠⚠ ТОВЧ ЦОНХ — ГУРВАН МӨР (хэрэглэгч, 2026-10-06: "Нэр — Туул,
    Талбай — 0000, Нэгж талбар — 0000 гээд тэр л"). Бусад талбар,
    бөглөөгүй хэсэг ГАРАХГҮЙ. Нэр нь нэрийн багана → ангилал (сав
    газар) → дугаар; дугаар нь сонгосон дүрсийг ялгахаас өөр юу ч
    хэлэхгүй тул нэр олдсон үед бичигдэхгүй.
  */
  if (brief) {
    const briefName =
      name && name !== "Бүртгэгдээгүй"
        ? name
        : tag !== "Бүртгэгдээгүй"
          ? tag
          : `№ ${oid}`;
    const rows: { label: string; value: React.ReactNode; num?: boolean }[] = [
      { label: "Нэр", value: briefName },
    ];
    if (ha != null)
      rows.push({
        label: "Талбай",
        value: `${num(ha, ha >= 100 ? 0 : 2)} га`,
        num: true,
      });
    if (info.geometry !== "Point")
      rows.push({
        label: "Нэгж талбар",
        value: parcels ? (
          parcels.n == null ? (
            <span className="text-ink-3">Тодорхойгүй</span>
          ) : (
            num(parcels.n)
          )
        ) : (
          <Loader2 size={12} className="inline animate-spin text-ink-3" />
        ),
        num: true,
      });
    return (
      <MapPanel
        state={panel}
        title={info.name}
        onClose={onClose}
        className="top-2 right-2 w-[260px]"
      >
        <dl className="divide-y divide-line">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-3 px-3 py-2"
            >
              <dt className="flex items-center gap-2 text-[11.5px] text-ink-3">
                {r.label === "Нэр" ? (
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[1px]"
                    style={{ background: tone }}
                  />
                ) : null}
                {r.label}
              </dt>
              <dd
                className={cn(
                  "min-w-0 text-right text-[13px] font-medium break-words text-ink",
                  r.num && "num",
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </MapPanel>
    );
  }

  return (
    <MapPanel
      state={panel}
      title={info.name}
      onClose={onClose}
      /*
        ⚠⚠ ӨНДӨР НЬ АГУУЛГААРАА, БҮТЭН БИШ (2026-09-29): `max-h` нь урт
        бичлэгийг хамгаална, бие нь дотроо гүйнэ.
      */
      className="top-2 right-2 max-h-[calc(100%-2.5rem)] w-[320px]"
    >
      <div className="min-h-0 overflow-y-auto">
        {/* ---- 1. Толгой ---- */}
        <div className="flex items-start gap-2.5 border-b border-line px-3 py-2.5">
          <span
            aria-hidden
            className="mt-[5px] size-2.5 shrink-0 rounded-[1px]"
            style={{ background: tone }}
          />
          <div className="min-w-0 flex-1">
            <p className="display text-[14px] leading-snug text-ink">{title}</p>
            {name && tag !== "Бүртгэгдээгүй" && tag !== name ? (
              <p className="mt-0.5 text-[11.5px] text-ink-3">{tag}</p>
            ) : null}
            {where.length ? (
              <p className="mt-1 flex items-start gap-1 text-[11.5px] leading-snug text-ink-2">
                <MapPin
                  size={11}
                  aria-hidden
                  className="mt-[2px] shrink-0 text-ink-3"
                />
                <span className="min-w-0">
                  {where.map((w) => w.text).join(" · ")}
                </span>
              </p>
            ) : null}
          </div>
          {ha != null ? (
            <span className="num shrink-0 text-right text-[14px] font-medium whitespace-nowrap text-ink">
              {num(ha, ha >= 100 ? 0 : 2)}
              <span className="ml-1 text-[11px] font-normal text-ink-3">
                га
              </span>
            </span>
          ) : null}
        </div>

        {/* ---- 1б. Оны диаграм ({@link LayerSet.recordCharts}) ---- */}
        {groups.length ? (
          <div className="divide-y divide-line border-b border-line">
            {groups.map((g) => (
              <RecordBars key={g.label} group={g} row={row} tone={tone} />
            ))}
          </div>
        ) : null}

        {/* ---- 2. Бөглөгдсөн талбарууд ---- */}
        {filled.length ? (
          <dl className="divide-y divide-line">
            {filled.map((f) =>
              f.wide ? (
                <div key={f.name} className="px-3 py-2">
                  <dt className="text-[11px] leading-snug text-ink-3">
                    {f.label}
                  </dt>
                  <dd className="mt-0.5 text-[12px] leading-relaxed break-words whitespace-pre-line text-ink">
                    {f.text}
                  </dd>
                </div>
              ) : (
                <div
                  key={f.name}
                  className="grid grid-cols-[minmax(0,44%)_minmax(0,1fr)] items-baseline gap-3 px-3 py-1.5"
                >
                  <dt className="text-[11px] leading-snug text-ink-3">
                    {f.label}
                  </dt>
                  <dd
                    className={cn(
                      "min-w-0 text-[12px] leading-snug break-words text-ink",
                      f.isNum && "num font-medium",
                    )}
                  >
                    {f.text}
                    {f.unit ? (
                      <span className="ml-1 text-[11px] font-normal text-ink-3">
                        {f.unit}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ),
            )}
          </dl>
        ) : null}

        {/* ---- 3. Бөглөөгүй талбарууд ---- */}
        {empty.length ? (
          <details className="group border-t border-line px-3 py-2">
            <summary className="eyebrow flex cursor-pointer list-none items-center gap-1 text-ink-3 select-none hover:text-ink-2 [&::-webkit-details-marker]:hidden">
              <ChevronDown
                size={11}
                aria-hidden
                className="-rotate-90 transition-transform group-open:rotate-0"
              />
              Бөглөөгүй талбар ·{" "}
              <span className="num">{num(empty.length)}</span>
            </summary>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {empty.map((f) => (
                <span
                  key={f.name}
                  className="rounded-xs border border-dashed border-line-2 px-1.5 py-0.5 text-[10.5px] text-ink-3"
                >
                  {f.alias}
                </span>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </MapPanel>
  );
}

/**
 * Цонхны нэг хэмжилт — он тус бүр нэг зурвас ({@link LayerSet.recordCharts}).
 *
 * ⚠ Хуваарь нь ЗӨВХӨН энэ бүлгийн дотор (гурван оны хамгийн их утга):
 * га, м³, төгрөг нь өөр нэгжтэй тул хооронд нь нэг хуваарьт оруулахгүй.
 * ⚠ Хоосон он "—", зурвасгүй — "0" гэвэл тэр онд бэлтгэл хийгээгүй мэт
 * худал уншигдана.
 */
export function RecordBars({
  group,
  row,
  tone,
}: {
  group: NonNullable<LayerSet["recordCharts"]>[string][number];
  row: Record<string, unknown>;
  tone: string;
}) {
  const read = (field: string) => {
    const v = row[field];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const years = group.years.map((y) => ({ ...y, value: read(y.field) }));
  const total = group.total ? read(group.total) : null;
  const max = Math.max(1e-9, ...years.map((y) => y.value ?? 0));
  const text = (v: number) => num(v, Math.abs(v) >= 100 ? 0 : 1);

  return (
    <div className="px-2.5 py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] leading-tight text-ink-2">
          {group.label}
        </span>
        {total != null ? (
          <span className="num shrink-0 text-[10.5px] text-ink-3">
            нийт <b className="font-semibold text-ink">{text(total)}</b>
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        {years.map((y) => (
          <div key={y.field} className="flex items-center gap-2">
            <span className="num w-8 shrink-0 text-[10px] text-ink-3">
              {y.label}
            </span>
            <span className="h-[6px] min-w-0 flex-1 rounded-[2px] bg-paper-hi">
              {y.value != null ? (
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    width: `${Math.max((y.value / max) * 100, y.value > 0 ? 1 : 0)}%`,
                    background: tone,
                  }}
                />
              ) : null}
            </span>
            <span
              className={cn(
                "num w-12 shrink-0 text-right text-[11px]",
                y.value == null ? "text-ink-3" : "text-ink",
              )}
            >
              {y.value == null ? "—" : text(y.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ЦОНХОН ДАХЬ УТГА.
 *
 * ⚠⚠ ЗӨВХӨН НЭГЖТЭЙ талбарыг форматлана (`unitOf`). Зураг дээрх шошго
 * "1,392 га" гэж бичдэг атлаа цонх нь "1391.59" гэж ТҮҮХИЙГЭЭР
 * харуулдаг байв — нэг дүрсийн талбай ХОЁР өөр тоогоор гарч, аль нь
 * зөв нь мэдэгдэхгүй болно (хэрэглэгч 2026-09-29-нд зургаар заасан).
 *
 * ⚠ НЭГЖГҮЙ тоог ХӨНДӨХГҮЙ: "Он" нь 2024 бөгөөд мянгатын таслал
 * тавибал "2,024" болж он биш тоо мэт уншигдана; дугаар ч мөн адил.
 * Нэгж нь эх сурвалж өөрөө нэрэндээ, таслалын ард бичдэг зүйл тул
 * "энэ бол хэмжилт" гэдгийн цорын ганц найдвартай шинж.
 *
 * ⚠ Аравтын орон нь ХЭМЖЭЭНЭЭС хамаарна: 100-аас дээш утгыг бүхэлд
 * нь (зургийн шошготой яг таарна), доош нь хоёр орноор — химийн
 * бодисын 0.27 тонныг бүхэлчилбэл "0" болж утгаа алдана.
 */
export function fieldText(
  f: { alias: string; type: string },
  v: unknown,
): { text: string; unit: string; isNum: boolean } {
  /*
    ⚠⚠ ОГНОО ТҮҮХИЙ ТООГООР ГАРДАГ БАЙВ (2026-10-22): `Date` талбарыг
    ArcGIS миллисекундээр буцаадаг тул цонхонд "1694563200000" гэж
    бичигддэг байлаа. Одоо `2023.09.13` (UTC — диаграмын он, сартай
    нэг). Тэг, 1900-аас өмнөх утга нь бөглөөгүйн тэмдэг — хоосон
    буцааж, бөглөөгүй талбарт оруулна.
  */
  if (f.type === "Date") {
    const ms = typeof v === "number" ? v : Date.parse(String(v));
    const d = Number.isFinite(ms) && ms !== 0 ? new Date(ms) : null;
    if (!d || d.getUTCFullYear() < 1900)
      return { text: "", unit: "", isNum: false };
    const p = (n: number) => String(n).padStart(2, "0");
    return {
      text: `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`,
      unit: "",
      isNum: true,
    };
  }
  if (typeof v !== "number" || !Number.isFinite(v))
    return { text: String(v), unit: "", isNum: false };
  /* Нэгж нь утгын ард шилжинэ ("Талбай" · "1,392 га") — шошго богиносно */
  const { unit } = unitOf(f.alias);
  if (!unit) return { text: String(v), unit: "", isNum: true };
  return { text: num(v, Math.abs(v) >= 100 ? 0 : 2), unit, isNum: true };
}
