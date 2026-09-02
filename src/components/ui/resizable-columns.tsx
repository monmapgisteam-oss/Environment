"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   САМБАРЫН БАГАНЫГ ЧИРЖ ӨРГӨСГӨХ

   Самбар бүр гурван хэсэгтэй: зүүн жагсаалт · төв (ихэвчлэн газрын
   зураг) · баруун задаргаа. Багануудын өргөн нь урьд нь кодод бичсэн
   тогтмол пиксел байсан бөгөөд агуулга нь самбар бүрд өөр урттай
   (нэг үгийн ангилалаас 967 нэрийн товьёог хүртэл) тул хаа нэгтээ
   үргэлж давчуу байдаг.

   Хажуугийн зурвасын `--rail-w`-тэй ИЖИЛ ЗАРЧМААР ажиллана:

     · Өргөн нь CSS хувьсагчид (`--col-l`, `--col-r`) сууна. Grid нь
       тэднээс уншдаг тул React төлөв дамжуулах шаардлагагүй —
       чирэх бүрд самбар дахин зурагдахгүй.
     · Утга нь `localStorage`-д хадгалагдана.
     · Давхар товшилт анхны өргөнд буцаана.

   ХУВЬСАГЧИЙГ ЗУРАГДАЛТААС ӨМНӨ ТАВИНА (`useLayoutEffect`): хадгалсан
   утгыг effect-ийн дараа тавьбал эхний хүрээ анхдагч өргөнөөр зурагдаж,
   дараа нь үсрэх байв. Сервер дээрх HTML нь үргэлж анхдагчтай тул
   гидрацийн зөрүү ч гарахгүй.

   Багана нь ЗӨВХӨН `xl`-ээс дээш өргөнд зэрэгцэнэ; түүнээс нарийн
   дэлгэцэд grid нь нэг багана болдог тул бариул ч гарахгүй.
   -------------------------------------------------------------------------- */

/** Багана хэтэрхий нарийсвал доторх диаграм, нэр уншигдахаа болино */
const MIN = 180;
/** Төв хэсэгт (газрын зураг) үлдэх ёстой хамгийн бага өргөн */
const CENTER_MIN = 300;

export type ColumnSizes = { left?: number; right?: number };

export type ColumnsApi = ReturnType<typeof useColumns>;

/**
 * @param key `localStorage`-ийн түлхүүр (`cols.<key>`). Самбар бүрд
 *   өөрийнх нь байх ёстой — нэг хэрэглэгч өөр өөр самбарт өөр өргөн
 *   тохируулж болно.
 * @param def Анхны өргөн. Аль талыг өгснөөр тухайн тал чирэгддэг болно.
 */
export function useColumns(key: string, def: ColumnSizes) {
  const el = React.useRef<HTMLDivElement | null>(null);
  const size = React.useRef<ColumnSizes>({ ...def });
  const restored = React.useRef(false);
  const from = React.useRef<{ side: "left" | "right"; px: number; w: number } | null>(
    null,
  );

  /** Хүрээндээ багтаагаад CSS хувьсагч руу бичнэ */
  const apply = React.useCallback(() => {
    const node = el.current;
    if (!node) return;
    const total = node.clientWidth;
    for (const side of ["left", "right"] as const) {
      const v = size.current[side];
      if (v == null) continue;
      let w = v;
      if (total > 0) {
        const other = side === "left" ? (size.current.right ?? 0) : (size.current.left ?? 0);
        const max = Math.max(MIN, total - other - CENTER_MIN);
        w = Math.min(Math.max(w, MIN), max);
      }
      size.current[side] = w;
      node.style.setProperty(side === "left" ? "--col-l" : "--col-r", `${Math.round(w)}px`);
    }
  }, []);

  /*
    Хүрээг бүртгэх. `ref`-ийг буцаахгүй — дуудагч тал `ref={obj.prop}`
    гэж бичих боломжгүй (`react-hooks/refs`), тиймээс бүрэлдэхүүн өөрөө
    `useRef` эзэмшиж, энэ дуудлагаар бүртгүүлнэ ({@link ../map/hover-tip}
    -ийн `MapTip`-тэй ижил зарчим).

    Хадгалсан утгыг ЭНД сэргээнэ: `mount` нь зурагдалтын өмнөх
    `useLayoutEffect`-ээс дуудагддаг тул эхний хүрээ аль хэдийн зөв
    өргөнтэй гарна — анхдагчаар зураад дараа нь үсрэхгүй.
  */
  const mount = React.useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      if (!node) return;
      if (!restored.current) {
        restored.current = true;
        try {
          const raw = localStorage.getItem(`cols.${key}`);
          if (raw) {
            const saved = JSON.parse(raw) as ColumnSizes;
            /* Зөвхөн энэ самбарт БАЙГАА талыг сэргээнэ — хуучин
               түлхүүрт байхгүй тал үлдсэн байж болно */
            if (def.left != null && typeof saved.left === "number")
              size.current.left = saved.left;
            if (def.right != null && typeof saved.right === "number")
              size.current.right = saved.right;
          }
        } catch {}
      }
      apply();
    },
    [key, def, apply],
  );

  /* Цонх өөрчлөгдөхөд дахин багтаана — хязгаар нь хүрээний өргөнөөс хамаарна */
  React.useEffect(() => {
    const on = () => apply();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [apply]);

  const save = React.useCallback(() => {
    try {
      localStorage.setItem(`cols.${key}`, JSON.stringify(size.current));
    } catch {}
  }, [key]);

  const grip = React.useCallback(
    (side: "left" | "right") => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        from.current = { side, px: e.clientX, w: size.current[side] ?? MIN };
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const f = from.current;
        if (!f) return;
        /* Баруун багана нь ЭСРЭГ чиглэлд өргөсдөг — зүүн тийш чирэхэд
           өргөн нэмэгдэнэ */
        const d = e.clientX - f.px;
        size.current[f.side] = f.w + (f.side === "left" ? d : -d);
        apply();
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        if (from.current) save();
        from.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      },
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
        from.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      },
      /* Давхар товшилт анхны өргөнд буцаана — хажуугийн зурвастай ижил */
      onDoubleClick: () => {
        size.current[side] = def[side];
        apply();
        save();
      },
    }),
    [apply, save, def],
  );

  return { mount, grip, sides: def };
}

/**
 * Grid-ийн баганын загвар.
 *
 * Tailwind нь ангийн нэрийг эх кодоос ШУУД уншдаг тул эдгээр нь бүтэн
 * мөрөөрөө бичигдсэн байх ёстой — хэсэгчлэн угсарвал үүсэхгүй.
 */
export function columnsClass(def: ColumnSizes) {
  if (def.left != null && def.right != null)
    return "xl:grid-cols-[var(--col-l)_1fr_var(--col-r)]";
  if (def.left != null) return "xl:grid-cols-[var(--col-l)_1fr]";
  return "xl:grid-cols-[1fr_var(--col-r)]";
}

/**
 * Баганы хоорондох бариул.
 *
 * Grid-ийн 10px зайд яг таарч сууна: зүүн бариул нь `left: var(--col-l)`
 * -ээс эхэлж 10px, баруун нь `right: var(--col-r)`-аас 10px буцаж.
 * Тиймээс агуулгыг огт дардаггүй бөгөөд нэмэлт багана шаардахгүй.
 *
 * Харагдац нь ердийн үед 1px зураас, хулгана ойртоход л accent болно —
 * самбар дээр байнга харагдах хэрэгсэл болох ёсгүй.
 */
export function ColumnHandles({ cols }: { cols: ColumnsApi }) {
  return (
    <>
      {cols.sides.left != null ? <Handle cols={cols} side="left" /> : null}
      {cols.sides.right != null ? <Handle cols={cols} side="right" /> : null}
    </>
  );
}

function Handle({ cols, side }: { cols: ColumnsApi; side: "left" | "right" }) {
  return (
    <div
      {...cols.grip(side)}
      role="separator"
      aria-orientation="vertical"
      aria-label="Баганын өргөн"
      style={side === "left" ? { left: "var(--col-l)" } : { right: "var(--col-r)" }}
      className={cn(
        "group absolute inset-y-0 z-10 hidden w-2.5 cursor-col-resize touch-none xl:block",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-colors group-hover:bg-data"
      />
    </div>
  );
}

/**
 * Багануудыг агуулах контейнер.
 *
 * Самбарууд зөвхөн ЭНЭ бүрэлдэхүүнийг дууддаг — дэгээ, бариул, CSS
 * хувьсагчийн нэр бүгд дотроо нуугдана. Ингэснээр 14 самбарт нэг мөр
 * солиход хангалттай болно.
 *
 * `id` нь хадгалалтын түлхүүр тул самбар бүрд ӨӨР байх ёстой.
 */
export function Columns({
  id,
  left,
  right,
  layout = "grid",
  className,
  children,
}: {
  id: string;
  left?: number;
  right?: number;
  /**
   * Багануудыг хэрхэн байрлуулах вэ.
   *
   * `grid` (анхдагч) — өргөн нь grid-ийн загварт бичигдэнэ, хүүхдүүд
   * юу ч мэдэхгүй.
   * `flex` — хүүхэд ӨӨРӨӨ өргөнөө үүрнэ (`xl:w-(--col-l)`). Хэсэг
   * самбар анхнаасаа ингэж бичигдсэн бөгөөд тэдгээрийн хажуугийн
   * хэсэг нь дотроо олон картыг босоо цуваагаар агуулдаг тул grid рүү
   * хөрвүүлэх нь бүтцийг нь дэмий хөндөнө.
   */
  layout?: "grid" | "flex";
  className?: string;
  children: React.ReactNode;
}) {
  const def = React.useMemo<ColumnSizes>(() => ({ left, right }), [left, right]);
  const cols = useColumns(id, def);
  const el = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    cols.mount(el.current);
    return () => cols.mount(null);
  });

  return (
    <div
      ref={el}
      className={cn(
        "relative gap-2.5",
        layout === "flex"
          ? "flex flex-col xl:flex-row"
          : cn("grid", columnsClass(def)),
        className,
      )}
    >
      <ColumnHandles cols={cols} />
      {children}
    </div>
  );
}
