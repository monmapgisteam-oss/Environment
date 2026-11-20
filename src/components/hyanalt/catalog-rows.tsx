"use client";

/*
  ТОВЬЁОГИЙН МӨР — Химийн бодисын үндэсний бүртгэлийн ("Хамрах хүрээ") "Бодисын товьёог"-ийн хэв:
  бүлэг бүр задардаг карт (сум · нэр · "N нэр" · тоо), дотор нь нэрс; хайлтын үр дүн хавтгай мөр.
  Химийн агуулахын "Бодисын товьёог", төлөвлөгөөт мэдээллийн "Үйл ажиллагааны чиглэлээр" яг энэ
  хэвээр (хэрэглэгч 2026-11-19: "Хамрах хүрээ db Бодисын товьёог shig") — нэг газар засна.
*/

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn, num } from "@/lib/utils";

/**
 * Товьёогийн хайлтын мөр — "Хамрах хүрээ"-ний товьёогийн хэв (тэмдэг, хүрээгүй оролт, доод зураас).
 */
export function CatalogSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1.5">
      <Search size={12} className="shrink-0 text-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  );
}

/**
 * Товьёогийн бүлгийн мөр ба задарсан нэрс.
 *
 * ⚠⚠ ХЭМЖИГЧИЙН ЗУРААС ХАСАГДСАН (хэрэглэгчийн шийдвэр, 2026-09-23:
 * "Бодисын товьёог энд баганан чарт хэрэггүй юм байна"). Товьёог нь
 * ЖАГСААЛТ — хайж олох, задлах зам бөгөөд бүлгүүдийн харьцааг
 * зурагладаг диаграм БИШ. Тоонууд нь өөрсдөө эрэмбэлэгдсэн тул
 * зураас нэмэлт мэдээлэл өгөхгүй, зөвхөн мөрийг өндөрсгөж байв.
 * Дахин бүү нэм.
 */
export function CatalogGroup({
  label,
  note,
  value,
  unit,
  open,
  onClick,
  children,
}: {
  label: string;
  /** Нэрийн тоо — "· 1,321 нэр" */
  note?: string;
  value: string;
  unit: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="px-1.5 py-1">
      <div
        className={cn(
          "rounded-md border px-1.5 py-1.5 transition-colors",
          open ? "border-(--tone)/45 bg-paper-3" : "border-line bg-paper-2 hover:border-line-2",
        )}
      >
        <button onClick={onClick} aria-expanded={open} className="block w-full text-left">
          <div className="flex items-baseline gap-1.5">
            <ChevronDown
              size={12}
              strokeWidth={2}
              aria-hidden
              className={cn(
                "shrink-0 translate-y-[2px] transition-transform",
                open ? "text-(--tone)" : "-rotate-90 text-ink-3",
              )}
            />
            <span className="min-w-0 flex-1 text-[12px] leading-snug font-medium text-ink">
              {label}
              {note ? (
                <span className="ml-1.5 text-[10px] font-normal whitespace-nowrap text-ink-3">
                  · {note}
                </span>
              ) : null}
            </span>
            <span className="num shrink-0 text-[11.5px] text-ink-2">{value}</span>
            <span className="shrink-0 text-[10px] text-ink-3">{unit}</span>
          </div>
        </button>

        {open ? (
          <div className="mt-1.5 ml-[18px] divide-y divide-line border-l border-line-2">
            {children}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Задарсан бүлэг доторх бодисын мөр */
export function CatalogName({
  on,
  onClick,
  name,
  value,
  unit,
}: {
  on: boolean;
  onClick: () => void;
  name: string;
  value: string;
  unit?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative block w-full px-2.5 py-1.5 text-left transition-colors",
        on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
      )}
    >
      {on ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)" />
      ) : null}
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "line-clamp-2 min-w-0 flex-1 text-[11px] leading-snug text-ink-2",
            on && "font-medium text-ink",
          )}
          title={name}
        >
          {name}
        </span>
        <span className="num shrink-0 pt-[1px] text-[10.5px] leading-snug text-ink-2">
          {value}
          {unit ? <span className="ml-1 text-ink-3">{unit}</span> : null}
        </span>
      </div>
    </button>
  );
}

/**
 * Жагсаалтын нэг мөр.
 *
 * Нэр нь ХОЁР МӨРӨНД буудаг: аж ахуйн нэгжийн нэр урт бөгөөд нэг
 * мөрөнд таславал "Дундговь аймгийн мэргэжлийн хян…" гэж бүгд ижил
 * эхэлсэн, ялгагдахгүй мөрүүд болно.
 *
 * Хэмжигчийн зураас БАЙХГҮЙ: тоо нь баруун талдаа аль хэдийн
 * бичигдсэн байхад зураас нэмэлт мэдээлэл өгөхгүй, зөвхөн чимэг болно.
 */
export function CatalogRow({
  on,
  onClick,
  onEnter,
  onLeave,
  title,
  note,
  value,
  unit,
}: {
  on: boolean;
  onClick: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  title: string;
  note?: string;
  value: string;
  unit?: string;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className={cn(
          "relative block w-full px-2.5 py-2 text-left transition-colors",
          on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
        )}
      >
        {on ? (
          <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)" />
        ) : null}

        <div className="flex items-start gap-2">
          <span
            className={cn(
              "line-clamp-2 min-w-0 flex-1 text-[11.5px] leading-snug text-ink",
              on && "font-medium",
            )}
            title={title}
          >
            {title}
          </span>
          <span className="num shrink-0 pt-[1px] text-[11px] leading-snug text-ink-2">
            {value}
          </span>
        </div>

        {note || unit ? (
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[10px] leading-snug text-ink-3">
              {note}
            </span>
            {unit ? (
              <span className="shrink-0 text-[9.5px] leading-snug text-ink-3">{unit}</span>
            ) : null}
          </div>
        ) : null}
      </button>
    </li>
  );
}

/*
  НАМ ДҮҮРГИЙН КАРТ — нэр · зурвас · тоо НЭГ эгнээнд (~21px мөр, 186px-ээс урт бол дотроо гүйнэ).
  Химийн бодисын үндэсний бүртгэлийн "Хамрах хүрээ"-ний "Дүүргээр"; төлөвлөгөөт мэдээлэл мөн
  (хэрэглэгч 2026-11-19: "Хамрах хүрээ db duureg chart shig").
*/
/**
 * Байршлын диаграм — агуулахын жагсаалтын ДЭЭР.
 *
 * ⚠⚠ ТОВЧНЫ ОРОНД ДИАГРАМ (хэрэглэгчийн хүсэлт, 2026-09-23:
 * "Дүүргээр serial chart харуулъя"). Товчнууд нэр, тоо хоёрыг л
 * хэлдэг байсан бол зурвас нь ХАРЬЦААГ нэмж хэлнэ.
 *
 * ⚠⚠ МӨР НЬ НЭГ ЭГНЭЭ (хэрэглэгчийн хүсэлт, 2026-09-23: "Дүүргээр
 * картын өндрийг багасгах боломж бий юу"). `RowChart dense` нь нэрийг
 * дээр нь, зурвасыг доор нь тавьдаг тул мөр ~31px болж, найман дүүрэг
 * 280px эзэлдэг байв. Нэр, зурвас, тоо гурвыг ЗЭРЭГЦҮҮЛЭХЭД мөр
 * ~21px — карт **190px** болж багасна.
 *
 * ⚠ Ингэснээр `RowChart`-аас САЛСАН: тэр бүрэлдэхүүн нэрээ мөрийн
 * дээр тавьдаг бөгөөд тэр байрлалыг проп-оор өөрчлөх боломжгүй.
 * Зурвасны утга, сонголтын зан төлөв нь адилхан хэвээр.
 *
 * ⚠ Нэрийн багана ТОГТМОЛ өргөнтэй (92px): зурваснууд НЭГ эгнээнээс
 * эхлэхгүй бол урт нь харьцуулагдахаа болино.
 *
 * ⚠ ӨНГӨ нь ГАНЦ (`--tone`): дүүрэг бол нэрлэсэн ангилал, эрэмбэтэй
 * хэмжүүр БИШ тул мөр бүрийг өөр өнгөөр ялгавал утгагүй солонго
 * болно. Ялгаа нь уртаараа гарна.
 */
export function PlaceCard({
  title,
  rows,
  show,
  picked,
  onPick,
  bar,
  color,
}: {
  title: string;
  /** [түлхүүр, тоо, харагдах нэр] — нэр өгөөгүй бол түлхүүр (дүүргийн код → нэр) */
  rows: [string, number, string?][];
  /** Карт харагдах эсэх — хайлт, сонголтоос ҮЛ ХАМААРНА (карт үсрэхгүй) */
  show: boolean;
  picked: string | null;
  onPick: (key: string) => void;
  /** Зурвасын зузаан, px ({@link PlaceRows}) */
  bar?: number;
  /** Зурвасын өнгө ({@link PlaceRows}) */
  color?: string;
}) {
  if (!show) return null;
  return (
    <div className="shrink-0 overflow-hidden rounded-xs border border-line bg-paper-2">
      <div className="flex items-baseline gap-2 border-b border-line px-2.5 py-1.5">
        <span className="eyebrow min-w-0 flex-1 truncate">{title}</span>
        {picked ? (
          <button
            onClick={() => onPick(picked)}
            className="shrink-0 text-[10px] text-(--tone) transition-colors hover:text-ink"
          >
            Цэвэрлэх
          </button>
        ) : (
          <span className="num shrink-0 text-[10px] text-ink-3">
            {num(rows.length)}
          </span>
        )}
      </div>
      {/* Агуулга нь картаасаа урт бол картынхаа ДОТОР гүйнэ (22 аймаг)
          — багана өөрөө хөдлөхгүй */}
      <PlaceRows rows={rows} picked={picked} onPick={onPick} bar={bar} color={color} />
    </div>
  );
}

/**
 * Нэг эгнээний мөрүүд — нэр · зурвас · тоо (`PlaceCard`-ийн бие). Төлөвлөгөөт мэдээллийн "Усны эх
 * үүсвэрээр" ч энэ хэлбэрээр (хэрэглэгч 2026-11-19: "design Дүүргээр shig").
 */
export function PlaceRows({
  rows,
  picked,
  onPick,
  nameWidth = 92,
  bar = 5,
  color = "var(--tone)",
}: {
  rows: [string, number, string?][];
  picked: string | null;
  onPick: (key: string) => void;
  /** Нэрийн баганын өргөн (px) — урт нэртэй ангилалд (газрын зориулалт) өргөн; бүтэн нэр `title`-д */
  nameWidth?: number;
  /** Зурвасын зузаан, px — анхдагч 5; төлөвлөгөөт мэдээлэлд 3 (хэрэглэгч 2026-11-19: "line urgung bagasga") */
  bar?: number;
  /** Зурвасын өнгө — анхдагч хэлтсийн `--tone`; төлөвлөгөөт мэдээлэлд "Оноор"-ын `--data` (хэрэглэгч 2026-11-19) */
  color?: string;
}) {
  const max = Math.max(...rows.map(([, n]) => n), 1);
  return (
    <div className="max-h-[186px] overflow-y-auto py-1">
      {rows.map(([key, n, name]) => {
        const on = picked === key;
        return (
          <button
            key={key}
            onClick={() => onPick(key)}
            aria-pressed={on}
            title={`${name ?? key} · ${num(n)}`}
            className={cn(
              "flex w-full items-center gap-2 px-2.5 py-[3px] text-left transition-colors",
              on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
              picked && !on && "opacity-55",
            )}
          >
            <span
              style={{ width: nameWidth }}
              className={cn(
                "shrink-0 truncate text-[11px]",
                on ? "font-medium text-ink" : "text-ink-2",
              )}
            >
              {name ?? key}
            </span>
            <span
              style={{ height: bar }}
              className="min-w-0 flex-1 overflow-hidden rounded-full bg-paper-hi"
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max((n / max) * 100, 2)}%`, background: color }}
              />
            </span>
            <span className="num w-[30px] shrink-0 text-right text-[11px] text-ink-2">
              {num(n)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
