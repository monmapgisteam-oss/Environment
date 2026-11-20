"use client";

import * as React from "react";
import { MapPin, ChevronDown, Loader2 } from "lucide-react";
import { RowChart, type Datum } from "@/components/charts";

import {
  parcelAxes,
  parcelCountsIn,
  parcelWhere,
  ringsOf,
  type ParcelAxis,
  type ParcelCount,
} from "@/lib/parcels";

import { cn, num } from "@/lib/utils";

import { SheetSection, sheetFade, SHEET_ROWS } from "./sheet";
import { CutCard } from "./cards";

/**
 * Бүсийн доторх дүрсүүд — бүсийн картын задаргаа.
 *
 * ⚠⚠ ИЖИЛ ХЭМЖЭЭТЭЙ ДАРААЛСАН ДҮРС НЭГ МӨРӨНД (хэрэглэгч, 2026-10-06,
 * зургаар: "хөгжүүлээд сайжруул"). Хориглолтын бүсийн 18 дүрсийн 12
 * нь (№ 6–17) тус бүр 7 га буюу ижил радиустай тойрог бөгөөд арван
 * хоёр ижил мөр жагсаалтын гуравны хоёрыг эзэлж, том зургаа нь тэдний
 * дунд алга болж байв. Гурваас олон дараалсан мөр ижил (бөөрөнхийлсөн)
 * талбайтай бол НЭГ бүлгийн мөр болно; товшиход задарна.
 * ⚠ Мөр ХАСАГДАХГҮЙ: бүлэг дотор тус бүр нь товшигдож сонгогдсоор
 * байна. Сонгосон дүрс бүлэг дотор байвал бүлэг өөрөө нээлттэй гарна.
 * ⚠ Бүлгийн утга нь "тус бүр" — нийлбэр БИШ: мөрүүд ижил хэмжээтэй
 * гэдэг нь гол мэдээлэл, нийлбэрийг бүсийн толгой аль хэдийн хэлдэг.
 *
 * ⚠ Зурвас БАЙХГҮЙ (хэрэглэгч, 2026-10-06) — нэр ба талбай хоёр
 * баганатай жагсаалт; талбай нь баруун ирмэгтээ эгнэнэ.
 */
export const ZONE_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3";

export function ZoneShapes({
  rows,
  tone,
  base,
  picked,
  onPick,
}: {
  rows: Datum[];
  tone: string;
  /** Давхаргын UID-ийн суурь (`uidBase`) */
  base: number;
  picked: number | null;
  onPick: (uid: number | null) => void;
}) {
  const [openRun, setOpenRun] = React.useState<string | null>(null);

  const runs = React.useMemo(() => {
    const out: Datum[][] = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && Math.round(last[0].value) === Math.round(r.value))
        last.push(r);
      else out.push([r]);
    }
    /* Гурваас цөөн давталт нь бүлэг болохгүй — тэр нь ердийн жагсаалт */
    return out.flatMap((run) =>
      run.length >= 3 ? [run] : run.map((r) => [r]),
    );
  }, [rows]);

  const row = (r: Datum, nested = false) => {
    const uid = base + Number(r.key);
    const on = picked === uid;
    return (
      <button
        key={r.key}
        type="button"
        aria-pressed={on}
        onClick={() => onPick(on ? null : uid)}
        className={cn(
          ZONE_GRID,
          "border-l-2 py-1 pr-0.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
          nested ? "pl-4" : "pl-1.5",
          on ? "bg-paper-hi" : "border-transparent",
        )}
        style={on ? { borderLeftColor: tone } : undefined}
      >
        <span
          className={cn(
            "truncate text-[11.5px]",
            on ? "text-ink" : "text-ink-2",
          )}
          title={r.label}
        >
          {r.label}
        </span>
        <span className="num text-right text-[11.5px] whitespace-nowrap text-ink-3">
          {num(Math.round(r.value))} га
        </span>
      </button>
    );
  };

  /* "№ 6", "№ 7" … гэсэн дараалсан дугаар бол мужаар нэрлэнэ, эс бөгөөс
     эхний ба сүүлчийн нэрээр */
  const runLabel = (run: Datum[]) => {
    const nos = run.map((r) => /^№ (\d+)$/.exec(r.label)?.[1]);
    if (nos.every(Boolean)) {
      const n = nos.map(Number).sort((a, b) => a - b);
      if (n[n.length - 1] - n[0] === n.length - 1)
        return `№ ${n[0]} – ${n[n.length - 1]}`;
    }
    return `${run[0].label} … ${run[run.length - 1].label}`;
  };

  return (
    <div>
      {runs.map((run) => {
        if (run.length === 1) return row(run[0]);
        const key = run[0].key;
        const holds = run.some((r) => base + Number(r.key) === picked);
        const open = openRun === key || holds;
        return (
          <div key={`run:${key}`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenRun(openRun === key ? null : key)}
              className={cn(
                ZONE_GRID,
                "border-l-2 border-transparent py-1 pr-0.5 pl-1.5 text-left hover:bg-paper-hi focus-visible:outline-offset-[-2px]",
              )}
            >
              <span className="flex min-w-0 items-center gap-1 text-[11.5px] text-ink-2">
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3 shrink-0 text-ink-3 transition-transform",
                    !open && "-rotate-90",
                  )}
                />
                <span className="truncate">{runLabel(run)}</span>
                <span className="num shrink-0 text-ink-3">
                  · {num(run.length)} дүрс
                </span>
              </span>
              <span className="num text-right text-[11.5px] whitespace-nowrap text-ink-3">
                тус бүр {num(Math.round(run[0].value))} га
              </span>
            </button>
            {open ? run.map((r) => row(r, true)) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * БҮСЭД ДАВХЦАХ НЭГЖ ТАЛБАР — зориулалт, эрхийн хэлбэрээр
 * (хэрэглэгч, 2026-10-06, бүсийн картын зургийг заан: "энэ чартын
 * доор нэгж талбарынх нь чартыг гарга").
 *
 * Бүсийн карт нь "хэдэн нэгж талбар" гэдгийг хэлдэг; энэ нь "ЯМАР
 * газар" гэдгийг — хамгаалалтын бүсийн дотор орон сууц, үйлдвэр,
 * хөдөө аж ахуйн газар хэр байгааг.
 *
 * ⚠⚠ БҮС ТУС БҮРЭЭР, НЭГТГЭХГҮЙ: гурван бүс бие биеэ агуулдаг
 * ({@link fetchParcelsOn}-ийн тэмдэглэл — тэжээгдэл 17 мянга,
 * хязгаарлалт 11 мянга, хориглолт 4 мянга, давхардалгүй нь бага) тул
 * нийлбэр нь нэг нэгж талбарыг хоёр, гурав тоолно. Бүс сонгох товч нь
 * бүсийн картын өнгөт тэмдэгтэй ижил өнгөтэй.
 * ⚠ Нийлбэр нь бүсийн картын тоотой ТААРНА: хоосон утга нь
 * "Бүртгэгдээгүй" гэсэн мөр болж үлддэг ({@link parcelCountsIn}).
 * ⚠ Тоолол СЕРВЕР дээр — нэгж талбарын атрибут хөтөч рүү орохгүй.
 */
/**
 * Нэгж талбарын диаграмаас СОНГОСОН ангилал — газрын зурагт тодруулна
 * (хэрэглэгч, 2026-10-06: "нэгж талбарын чартнаас шүүгддэг болгоё").
 */
export type ParcelPick = {
  /** Бүс · тэнхлэг · ангилал — үр дүнг сонголттой нь тааруулна */
  id: string;
  rings: GeoJSON.Position[][];
  where: string;
  label: string;
  tone: string;
};

/** Бүсийн хуудасны газрын зориулалт — эхний мөрийн тоо ({@link ZoneSheet}) */
export const ZONE_TOP = 5;

/**
 * ⚠⚠ БҮС БҮР ӨӨРИЙН ХЭСЭГ (хэрэглэгч 2026-10-22: "goliin tatam,
 * hamgaalaltiin bus 2 tsonhiig chi shineer hiidee" → "Бүс бүр өөрийн
 * карт"). Голын татам, хамгаалалтын бүсийн хуудасны горимд ({@link
 * LayerSet.sheet}) бүс (сав газар) бүр тусдаа хураагддаг хэсэг: дээр нь
 * талбай ба давхцаж буй нэгж талбар ТОМ тоогоор, доор нь тэр бүсийн
 * газрын зориулалт эхний {@link ZONE_TOP}, "Бусад N ангилал" дэлгэгдэнэ.
 * Урьдын хувилбар нь бүсийн жагсаалт + бүс, тэнхлэг сэлгэдэг ганц нэгж
 * талбарын карт байсан — БҮХ бүс зэрэг харагдахгүй байв.
 *
 * ⚠ Бүс, тэнхлэг сонгох товч БАЙХГҮЙ. Тэнхлэг нь газрын зориулалт
 * (олдохгүй бол эхнийх — эрхийн хэлбэр).
 * ⚠ Толгойн {@link MapPin} — газрын зургийг тэр бүсээр шүүнэ / дүрсийг
 * сонгоно (урьдын бүсийн мөрийн товшилттой ижил үйлдэл).
 * ⚠ Мөр товшиход тэр бүсийн тэр ангиллын нэгж талбар зурагт тодорно
 * ({@link ParcelPick}, дугаарын хэлбэр {@link ParcelCard}-тай ижил).
 * ⚠ ЗУРВАС НЬ НЭГЖ ТАЛБАРЫН ТООГ хэмжинэ — га-ийн дүүргэлтийн зурвас
 * БИШ (2026-10-06-нд буцаагдсан).
 */
export function ZoneSheet({
  zone,
  shapes,
  active,
  onHead,
  open,
  onToggle,
  anchor,
  pickedId,
  pickInfo,
  onPick,
}: {
  zone: {
    id: string;
    label: string;
    tone: string;
    ha: number;
    parcels?: number;
    features: GeoJSON.Feature[];
  };
  /** Олон дүрстэй бүсийн дүрсүүдийн жагсаалт (хамгаалалтын бүс) */
  shapes?: React.ReactNode;
  /** Газрын зураг энэ бүсээр шүүгдсэн / дүрс сонгогдсон эсэх */
  active: boolean;
  onHead?: () => void;
  /** Хэсэг нээлттэй эсэх — эцэг удирдана (анхдагчаар хураагдсан) */
  open: boolean;
  onToggle: () => void;
  anchor: string;
  /** Одоо тодруулсан нэгж талбарын ангиллын дугаар ({@link ParcelPick.id}) */
  pickedId: string | null;
  pickInfo: { busy: boolean; count: number | null; capped: boolean } | null;
  onPick: (pick: ParcelPick | null) => void;
}) {
  const [axes, setAxes] = React.useState<ParcelAxis[] | null>(null);
  const [axesError, setAxesError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    key: string;
    rows?: ParcelCount[];
    error?: string;
  } | null>(null);
  const [all, setAll] = React.useState(false);
  const [shapesOpen, setShapesOpen] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    parcelAxes()
      .then((a) => live && setAxes(a))
      .catch((e: Error) => live && setAxesError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const axis =
    axes?.find((a) => /зориулалт/i.test(a.label)) ?? axes?.[0] ?? null;
  const rings = React.useMemo(() => ringsOf(zone.features), [zone.features]);
  const key = axis ? `${zone.id}\u0000${axis.field}` : null;

  React.useEffect(() => {
    if (!axis || !key || !rings.length) return;
    let live = true;
    parcelCountsIn(zone.id, rings, axis.field)
      .then((rows) => live && setResult({ key, rows }))
      .catch((e: Error) => live && setResult({ key, error: e.message }));
    return () => {
      live = false;
    };
  }, [zone.id, axis, key, rings]);

  const current = result?.key === key ? result : null;
  const rows = current?.rows ?? null;
  const prefix = key ? `${key} ` : null;
  const selected =
    prefix && pickedId?.startsWith(prefix)
      ? pickedId.slice(prefix.length)
      : null;

  const choose = (r: ParcelCount) => {
    if (!axis || !key) return;
    if (selected === r.key) {
      onPick(null);
      return;
    }
    onPick({
      id: `${key} ${r.key}`,
      rings,
      where: parcelWhere(axis.field, r.raws),
      label: r.label,
      tone: zone.tone,
    });
  };

  const shown = rows
    ? all
      ? rows
      : rows.filter((r, i) => i < ZONE_TOP || r.key === selected)
    : null;
  const rest = rows && shown ? rows.length - shown.length : 0;
  const max = Math.max(0, ...(rows ?? []).map((r) => r.value));
  const digits = Math.max(3, ...(rows ?? []).map((r) => num(r.value).length));
  const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;

  const stat = (value: string, unit: string, label: string) => (
    <div className="min-w-0">
      <p className="num text-[18px] font-semibold leading-tight text-ink">
        {value}
        {unit ? (
          <span className="ml-1 text-[11px] font-normal text-ink-3">
            {unit}
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{label}</p>
    </div>
  );

  return (
    <SheetSection
      title={zone.label}
      dot={zone.tone}
      open={open}
      onToggle={onToggle}
      anchor={anchor}
      meta={`${num(Math.round(zone.ha))} га`}
      action={
        onHead ? (
          <button
            type="button"
            onClick={onHead}
            aria-pressed={active}
            aria-label="Газрын зурагт харуулах"
            title="Газрын зурагт харуулах"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-xs border text-ink-3 hover:bg-paper-hi hover:text-ink",
              active
                ? "border-line-2 bg-paper-hi text-ink"
                : "border-transparent",
            )}
            style={active ? { color: zone.tone } : undefined}
          >
            <MapPin size={13} />
          </button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-x-4">
        {stat(num(Math.round(zone.ha)), "га", "Талбай")}
        {stat(
          zone.parcels == null ? "…" : num(zone.parcels),
          "",
          "Давхцаж буй нэгж талбар",
        )}
      </div>

      {shapes ? (
        <div className="mt-2 border-t border-line pt-1.5">
          <button
            type="button"
            aria-expanded={shapesOpen}
            onClick={() => setShapesOpen((o) => !o)}
            className="flex w-full items-center gap-1.5 text-left text-[11.5px] text-ink-2 hover:text-ink"
          >
            <ChevronDown
              size={12}
              className={cn(
                "shrink-0 text-ink-3 transition-transform",
                !shapesOpen && "-rotate-90",
              )}
            />
            Дүрс
          </button>
          {shapesOpen ? <div className="pt-1">{shapes}</div> : null}
        </div>
      ) : null}

      {axes && !axes.length ? null : (
        <div className="mt-2 border-t border-line pt-1.5">
          <p className="mb-1 flex items-baseline justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            <span>{axis?.label ?? "Газрын зориулалт"}</span>
            {rows ? (
              <span className="num font-normal normal-case tracking-normal">
                {num(rows.length)} ангилал
              </span>
            ) : null}
          </p>
          {axesError || current?.error ? (
            <p className="py-1 text-[11.5px] text-clay">
              {axesError ?? current?.error}
            </p>
          ) : !shown ? (
            <p className="flex items-center gap-1.5 py-1 text-[11.5px] text-ink-3">
              <Loader2 size={12} className="animate-spin" />
              Тоолж байна…
            </p>
          ) : !shown.length ? (
            <p className="py-1 text-[11.5px] text-ink-3">
              Давхцаж буй нэгж талбар байхгүй
            </p>
          ) : (
            <>
              <div className="flex flex-col">
                {shown.map((r) => {
                  const on = selected === r.key;
                  const w =
                    max > 0 && r.value
                      ? Math.max(1.5, (r.value / max) * 100)
                      : 0;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => choose(r)}
                      aria-pressed={on}
                      title={r.label}
                      style={{ gridTemplateColumns: cols }}
                      className={cn(
                        "grid w-full items-center gap-2.5 rounded-xs px-1.5 py-[3px] text-left text-[12.5px] transition-colors hover:bg-paper-hi",
                        on && "bg-paper-hi",
                        selected != null && !on && "opacity-45",
                      )}
                    >
                      <span className="min-w-0 truncate text-[12px] text-ink">
                        {r.label}
                      </span>
                      <span className="block h-2 rounded-[1px] bg-line">
                        <span
                          className="block h-full rounded-[1px]"
                          style={{
                            width: `${w}%`,
                            background: sheetFade(zone.tone),
                          }}
                        />
                      </span>
                      <span className="num text-right text-[12.5px] font-semibold text-ink">
                        {num(r.value)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {rest > 0 || all ? (
                <button
                  type="button"
                  onClick={() => setAll((s) => !s)}
                  className="mt-0.5 px-1.5 text-left text-[11px] text-ink-3 hover:text-ink"
                >
                  {all ? "Хураах" : `Бусад ${num(rest)} ангилал`}
                </button>
              ) : null}
              {selected && pickInfo ? (
                <p className="num mt-1 flex items-center gap-1.5 border-t border-line pt-1.5 text-[11px] text-ink-3">
                  {pickInfo.busy ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Газрын зурагт тодруулж байна…
                    </>
                  ) : (
                    <>
                      Газрын зурагт:{" "}
                      <span className="text-ink">
                        {num(pickInfo.count ?? 0)} нэгж талбар
                      </span>
                      {pickInfo.capped ? " · хэсэгчилсэн" : ""}
                    </>
                  )}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </SheetSection>
  );
}

/** Хэмжилт хийгдэхээс өмнөх мөрийн тоо ({@link ParcelCard}) */
export const PARCEL_TOP = 10;

export function ParcelCard({
  sheet = false,
  zones,
  prefer = null,
  onPick,
  pickInfo = null,
}: {
  /** Хуудасны харагдац ({@link LayerSet.sheet}) — хураагддаг хэсэг,
      мөр нь `SheetAxis`-ийн хэлбэрээр, эхний {@link SHEET_ROWS} */
  sheet?: boolean;
  zones: {
    id: string;
    label: string;
    tone: string;
    features: GeoJSON.Feature[];
  }[];
  /**
   * Самбарын шүүлтээр сонгогдсон бүс (голын татмын сав газар) — карт
   * түүн рүү ӨӨРӨӨ шилжинэ: газрын зураг, бүсийн карт, энэ карт гурав
   * нэг сонголтыг дагана. Хэрэглэгч энд өөр товч дарвал тэр нь давуу,
   * гэхдээ шүүлт дахин солигдох хүртэл л.
   */
  prefer?: string | null;
  /** Мөр товшиход — сонгосон ангилал, эсвэл цуцлалт (`null`) */
  onPick?: (pick: ParcelPick | null) => void;
  /** Газрын зурагт тодруулсан үр дүн — диаграмын доор тоогоор хэлнэ */
  pickInfo?: { busy: boolean; count: number | null; capped: boolean } | null;
}) {
  /* Гараар сонгосон бүс — ямар `prefer`-ийн үед сонгосноо хамт барина:
     шүүлт солигдвол гар сонголт хүчингүй болж `prefer` дахин түрүүлнэ
     (эффектээр төлөв цэвэрлэхгүй — ДАМ гарна) */
  const [chosen, setChosen] = React.useState<{
    prefer: string | null;
    id: string;
  } | null>(null);
  const zoneId =
    chosen && chosen.prefer === prefer ? chosen.id : (prefer ?? null);
  const setZoneId = (id: string) => {
    setChosen({ prefer, id });
    /* Бүс солигдоход өмнөх бүсийн тодруулга зураг дээр үлдэх ёсгүй */
    onPick?.(null);
  };
  const [axisField, setAxisFieldRaw] = React.useState<string | null>(null);
  const setAxisField = (field: string) => {
    setAxisFieldRaw(field);
    onPick?.(null);
  };
  const [axes, setAxes] = React.useState<ParcelAxis[] | null>(null);
  const [axesError, setAxesError] = React.useState<string | null>(null);
  /* Үр дүн нь ТҮЛХҮҮРТЭЙГЭЭ хамт — бүс, тэнхлэг солигдоход хуучин
     хариу шинэ сонголтын дор харагдахгүй (эффектээс `set*(null)`
     дуудахгүйн тулд ачаалал нь түлхүүрийн зөрүүнээс ДАМ гарна) */
  const [result, setResult] = React.useState<{
    key: string;
    rows?: ParcelCount[];
    error?: string;
  } | null>(null);

  React.useEffect(() => {
    let live = true;
    parcelAxes()
      .then((a) => live && setAxes(a))
      .catch((e: Error) => live && setAxesError(e.message));
    return () => {
      live = false;
    };
  }, []);

  /* Сонголт нь ДАМ — бүс эсвэл тэнхлэг алга болбол эхнийх рүү буцна */
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const axis = axes?.find((a) => a.field === axisField) ?? axes?.[0] ?? null;
  const rings = React.useMemo(
    () => (zone ? ringsOf(zone.features) : []),
    [zone],
  );
  const key = zone && axis ? `${zone.id}\u0000${axis.field}` : null;

  /*
    СОНГОСОН АНГИЛАЛ — бүс, тэнхлэгтэйгээ ХАМТ (`ctx`): тэдгээр
    солигдоход сонголт ДАМ хүчингүй болно (эффектээр цэвэрлэхгүй).
  */
  const [cat, setCat] = React.useState<{ ctx: string; key: string } | null>(
    null,
  );
  /* Эцэг самбар тодруулгыг цэвэрлэвэл ("Цэвэрлэх", сав газар солих)
     `pickInfo` нь `null` болно — мөр ч тодрохоо болино */
  const selectedCat =
    cat && key && cat.ctx === key && pickInfo ? cat.key : null;

  React.useEffect(() => {
    if (!zone || !axis || !key || !rings.length) return;
    let live = true;
    parcelCountsIn(zone.id, rings, axis.field)
      .then((rows) => live && setResult({ key, rows }))
      .catch((e: Error) => live && setResult({ key, error: e.message }));
    return () => {
      live = false;
    };
  }, [zone, axis, key, rings]);

  const current = result?.key === key ? result : null;
  const rows = current?.rows ?? null;
  const total = rows?.reduce((n, r) => n + r.value, 0) ?? null;

  /*
    ⚠⚠ БАГТАХ МӨРИЙН ТООГ ХЭМЖИЖ ТОГТООНО (хэрэглэгч, 2026-10-06: "2
    чартаа чи өөрөө мэдээд тааруул"). Урьд нь тогтмол арав байсан нь
    өндөр дэлгэцэд хоосон зай, намхан дэлгэцэд гүйлгүүр үлдээдэг байв.

    Карт нь баганын ҮЛДСЭН өндрийг бүтнээр эзэлнэ (`fill`), бүсийн карт
    нь агуулгынхаа өндөртэй (`full`). Жагсаалтын талбайн өндөр ба
    мөрийн БОДИТ өндрийг `ResizeObserver` хэмжиж, багтах тоог гаргана
    — бүсүүдийг задлахад бүсийн карт өсөж, энэ жагсаалт дагаж хумигдана.

    ⚠ Хэмжилт нь ажиглагчийн дуудлагад — эффектээс шууд `set*`
    дуудахгүй (`react-hooks/set-state-in-effect`).
    ⚠ Мөрийн тоо нь `data-rows`-оос: зурагдалтын үед `ref`-д бичихийг
    `react-hooks/refs` хориглодог.
    ⚠ ХАМГИЙН БАГАДАА ГУРАВ: бүх бүсийг задалснаар зай дуусвал багана
    өөрөө гүйнэ — гурваас цөөн мөр нь диаграм биш.
    ⚠ ХУРААЛТ ИЛ хэвээр: "Бусад N ангилал · M нэгж талбар" мөр юу
    нуугдсаныг тоогоор хэлж, товшиход бүгдийг дэлгэнэ (тэр үед
    жагсаалт дотроо гүйнэ). Толгойн нийт тоо БҮХ мөрийнх.
    ⚠ Мөрийн тоо хэмжилтээс хамаарч өөрчлөгдөхөд эргэлдэхгүй: хураах
    мөр нь жагсаалтын ГАДНА тул түүнийг гаргах, нуух нь талбайн өндрийг
    өөрчилсөн ч дүгнэлт нь хэвээр үлддэг.
  */
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const expanded = openKey != null && openKey === key;
  const listRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState<{ avail: number; row: number }>({
    avail: 0,
    row: 0,
  });
  const hasList = !!rows?.length;

  React.useEffect(() => {
    const list = listRef.current;
    const chart = chartRef.current;
    if (!list || !chart) return;
    const measure = () => {
      const n = Number(chart.dataset.rows) || 0;
      const row = n > 0 ? chart.offsetHeight / n : 0;
      const avail = list.clientHeight;
      setFit((f) =>
        Math.abs(f.avail - avail) < 1 && Math.abs(f.row - row) < 0.5
          ? f
          : { avail, row: row || f.row },
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    ro.observe(chart);
    return () => ro.disconnect();
  }, [hasList]);

  /* ⚠ "Бүгд багтах уу" гэдгийг ЭХЭЛЖ шалгана: агуулгын өндөртэй
     горимд (`is-fit`) талбай нь яг `n × мөр` тул нөөцийн 2px-ийг хасаад
     хуваавал n − 1 гарч, хураах ↔ дэлгэх хооронд эргэлдэнэ */
  const measured = fit.row > 0 && fit.avail > 0;
  const cap = sheet
    ? SHEET_ROWS
    : !measured
      ? PARCEL_TOP
      : rows && rows.length * fit.row <= fit.avail + 1
        ? rows.length
        : Math.max(3, Math.floor((fit.avail - 2) / fit.row));
  const folded = !!rows && !expanded && rows.length > cap;
  const shown = rows && folded ? rows.slice(0, cap) : rows;
  const rest = rows && folded ? rows.slice(cap) : [];

  if (axes && !axes.length) return null;

  /* Мөр товших — тэр бүсийн тэр ангиллын нэгж талбар зурагт тодорно */
  const choose = (k: string | null) => {
    const r = k && rows ? rows.find((x) => x.key === k) : null;
    if (!k || !r || !key || !zone || !axis) {
      setCat(null);
      onPick?.(null);
      return;
    }
    setCat({ ctx: key, key: k });
    onPick?.({
      id: `${key} ${k}`,
      rings,
      where: parcelWhere(axis.field, r.raws),
      label: r.label,
      tone: zone.tone,
    });
  };

  const meta = total == null ? undefined : `${num(total)} нэгж талбар`;
  const wrap = (body: React.ReactNode) =>
    sheet ? (
      <SheetSection title="Давхцаж буй нэгж талбар" meta={meta}>
        {body}
      </SheetSection>
    ) : (
      <CutCard
        title="Давхцаж буй нэгж талбар"
        tone={zone?.tone ?? "var(--data)"}
        first
        meta={meta}
        fill
        /* Бүх мөр багтаж байвал карт АГУУЛГЫНХАА өндөртэй — үлдсэн
         өндрийг эзэлж доороо хоосон зай үлдээхгүй (хэрэглэгч,
         2026-10-06: "хоосон зай гаргахгүй"). Багтахгүй болмогц
         (`folded`) үлдсэн өндрийг дүүргэж хураана */
        fit={!!rows && !folded && !expanded}
      >
        {body}
      </CutCard>
    );

  /* Хуудасны мөрүүд — `SheetAxis`-тэй нэг хэлбэр: нэр · зурвас · тоо */
  const sheetRows = (list: ParcelCount[]) => {
    const max = Math.max(0, ...(rows ?? []).map((r) => r.value));
    const digits = Math.max(3, ...list.map((r) => num(r.value).length));
    const cols = `minmax(0,10rem) minmax(0,1fr) calc(${digits}ch + 2px)`;
    const tone = zone?.tone ?? "var(--data)";
    return (
      <div className="flex flex-col">
        {list.map((r) => {
          const on = selectedCat === r.key;
          const w =
            max > 0 && r.value ? Math.max(1.5, (r.value / max) * 100) : 0;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => choose(on ? null : r.key)}
              aria-pressed={on}
              title={r.label}
              style={{ gridTemplateColumns: cols }}
              className={cn(
                "grid w-full items-center gap-2.5 rounded-xs px-1.5 py-[3px] text-left text-[12.5px] transition-colors hover:bg-paper-hi",
                on && "bg-paper-hi",
                selectedCat != null && !on && "opacity-45",
              )}
            >
              <span className="min-w-0 truncate text-[12px] text-ink">
                {r.label}
              </span>
              <span className="block h-2 rounded-[1px] bg-line">
                <span
                  className="block h-full rounded-[1px]"
                  style={{ width: `${w}%`, background: sheetFade(tone) }}
                />
              </span>
              <span className="num text-right text-[12.5px] font-semibold text-ink">
                {num(r.value)}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return wrap(
    <div className={cn("flex flex-col gap-2", !sheet && "min-h-0 flex-1")}>
      {/* Бүс сонгогч — бүсийн картын дарааллаар, өнгөөр */}
      <div className="flex flex-wrap gap-1">
        {zones.map((z) => {
          const on = z.id === zone?.id;
          return (
            <button
              key={z.id}
              type="button"
              aria-pressed={on}
              onClick={() => setZoneId(z.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-xs border px-2 py-1 text-[11.5px] focus-visible:outline-offset-[-2px]",
                on
                  ? "border-line-2 bg-paper-hi text-ink"
                  : "border-line text-ink-2 hover:bg-paper-hi hover:text-ink",
              )}
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[1px]"
                style={{ background: z.tone }}
              />
              {z.label}
            </button>
          );
        })}
      </div>

      {/* Тэнхлэг сонгогч — эх сурвалжид олдсон талбаруудаас л */}
      {axes && axes.length > 1 ? (
        <div className="flex gap-3 border-b border-line text-[11.5px]">
          {axes.map((a) => {
            const on = a.field === axis?.field;
            return (
              <button
                key={a.field}
                type="button"
                aria-pressed={on}
                onClick={() => setAxisField(a.field)}
                className={cn(
                  "-mb-px border-b-2 pb-1 focus-visible:outline-offset-[-2px]",
                  on
                    ? "text-ink"
                    : "border-transparent text-ink-3 hover:text-ink",
                )}
                style={on ? { borderBottomColor: zone?.tone } : undefined}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {axesError || current?.error ? (
        <p className="py-2 text-[11.5px] text-clay">
          {axesError ?? current?.error}
        </p>
      ) : rows && shown ? (
        rows.length ? (
          <>
            <div
              ref={listRef}
              className={cn(
                !sheet && "min-h-0 flex-1",
                !sheet && (expanded ? "overflow-y-auto" : "overflow-hidden"),
              )}
            >
              <div ref={chartRef} data-rows={shown.length}>
                {sheet ? (
                  sheetRows(shown)
                ) : (
                  <RowChart
                    data={shown}
                    tone={zone?.tone}
                    format={(v) => num(v)}
                    dense
                    clamp
                    /*
                      ⚠⚠ МӨР ТОВШИГДОНО (хэрэглэгч, 2026-10-06: "нэгж
                      талбарын чартнаас шүүгддэг болгоё"). Тэр бүсийн
                      тэр ангиллын нэгж талбарууд газрын зурагт бүсийн
                      өнгөөр тодорч, зураг тэдэн рүү ойртоно. Дахин
                      товшиход цуцлагдана.
                      ⚠ Нөхцөл нь мөрөнд нийлсэн БҮХ эх утгаас
                      (`raws`) — бичиглэлийн зөрүүтэй утга нэг мөр
                      болдог тул нэгийг нь л авбал зурагт дутуу гарна.
                    */
                    selected={selectedCat}
                    onSelect={choose}
                  />
                )}
              </div>
            </div>
            {selectedCat && pickInfo ? (
              <p className="num flex shrink-0 items-center gap-1.5 border-t border-line pt-1.5 text-[11px] text-ink-3">
                {pickInfo.busy ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Газрын зурагт тодруулж байна…
                  </>
                ) : (
                  <>
                    Газрын зурагт:{" "}
                    <span className="text-ink">
                      {num(pickInfo.count ?? 0)} нэгж талбар
                    </span>
                    {pickInfo.capped ? " · хэсэгчилсэн" : ""}
                  </>
                )}
              </p>
            ) : null}
            {folded || expanded ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpenKey(expanded ? null : key)}
                className="flex w-full shrink-0 items-center gap-1.5 border-t border-line pt-1.5 text-left text-[11.5px] text-ink-2 hover:text-ink focus-visible:outline-offset-[-2px]"
              >
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0 text-ink-3 transition-transform",
                    expanded ? "rotate-180" : "",
                  )}
                />
                {expanded ? (
                  "Жагсаалтыг хураах"
                ) : (
                  <>
                    <span>Бусад {num(rest.length)} ангилал</span>
                    <span className="num ml-auto text-ink-3">
                      {num(rest.reduce((n, r) => n + r.value, 0))} нэгж талбар
                    </span>
                  </>
                )}
              </button>
            ) : null}
          </>
        ) : (
          <p className="py-2 text-[11.5px] text-ink-3">
            Нэгж талбар бүртгэгдээгүй байна
          </p>
        )
      ) : (
        <p className="flex items-center gap-2 py-2 text-[11.5px] text-ink-3">
          <Loader2 size={13} className="animate-spin" />
          Нэгж талбарын мэдээллийг ачаалж байна…
        </p>
      )}
    </div>,
  );
}
