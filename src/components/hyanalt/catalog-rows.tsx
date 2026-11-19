"use client";

/*
  ТОВЬЁОГИЙН МӨР — бүлэг (задардаг, доод ирмэгт хэмжигчийн зураас) ба нэр. Химийн агуулахын
  "Бодисын товьёог" ба төлөвлөгөөт мэдээллийн "Үйл ажиллагааны чиглэлээр" нэг хэвтэй
  (хэрэглэгч 2026-11-19: "Бодисын товьёог shig") — нэг газар засна.
*/

import { ChevronRight } from "lucide-react";
import { cn, num } from "@/lib/utils";

/**
 * Товьёогийн бүлгийн мөр.
 *
 * `share` нь 0–1 хооронд — мөрийн доод ирмэгийн хэмжигчийн зураасны урт.
 */
export function GroupRow({
  label,
  n,
  share,
  open,
  onClick,
}: {
  label: string;
  n: number;
  share: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-1.5 py-[6px] pr-1.5 pl-2.5 text-left transition-colors",
        open ? "bg-paper-hi text-ink" : "text-ink-2 hover:bg-paper-hi hover:text-ink",
      )}
    >
      {/* Сонголтыг дүүргэлтээр биш ИРМЭГИЙН ЗУРААСААР тэмдэглэнэ */}
      {open ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-data" />
      ) : null}

      <ChevronRight
        size={11}
        className={cn(
          "shrink-0 text-ink-3 transition-transform",
          open && "rotate-90 text-data",
        )}
      />
      <span className={cn("min-w-0 flex-1 truncate text-[11.5px]", open && "font-medium")}>
        {label}
      </span>
      <span className={cn("num shrink-0 text-[10.5px]", open ? "text-ink-2" : "text-ink-3")}>
        {n}
      </span>

      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px]"
        style={{
          width: `${Math.max(share * 100, 1.5)}%`,
          background: open
            ? "var(--data)"
            : "color-mix(in oklab, var(--data) 45%, transparent)",
        }}
      />
    </button>
  );
}

export function NameRow({
  name,
  n,
  note,
  on,
  onPick,
}: {
  name: string;
  n: number;
  /** Хайлтын үр дүнд бүлгийн нэрийг хажууд нь бичнэ */
  note?: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      title={name}
      className={cn(
        "flex w-full items-baseline justify-between gap-2 rounded-xs px-1.5 py-[3px] text-left transition-colors",
        on
          ? "bg-data/14 font-medium text-ink"
          : "text-ink-2 hover:bg-paper-hi hover:text-ink",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[11px] leading-snug">
        {name}
        {note ? <span className="ml-1 text-[9.5px] text-ink-3">· {note}</span> : null}
      </span>
      <span className="num shrink-0 text-[10.5px] text-ink-3">{n}</span>
    </button>
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
}: {
  title: string;
  /** [түлхүүр, тоо, харагдах нэр] — нэр өгөөгүй бол түлхүүр (дүүргийн код → нэр) */
  rows: [string, number, string?][];
  /** Карт харагдах эсэх — хайлт, сонголтоос ҮЛ ХАМААРНА (карт үсрэхгүй) */
  show: boolean;
  picked: string | null;
  onPick: (key: string) => void;
}) {
  const max = Math.max(...rows.map(([, n]) => n), 1);
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
                className={cn(
                  "w-[92px] shrink-0 truncate text-[11px]",
                  on ? "font-medium text-ink" : "text-ink-2",
                )}
              >
                {name ?? key}
              </span>
              <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-paper-hi">
                <span
                  className="block h-full rounded-full bg-(--tone)"
                  style={{ width: `${Math.max((n / max) * 100, 2)}%` }}
                />
              </span>
              <span className="num w-[30px] shrink-0 text-right text-[11px] text-ink-2">
                {num(n)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
