"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

/* --------------------------------------------------------------------------
   Газрын зураг дээрх хулгана дагасан хөвөгч тайлбар
   --------------------------------------------------------------------------

   Товшилтоор нээгддэг ДЭЛГЭРЭНГҮЙ самбараас зориудаар өөр зүйл: тэр нь
   тогтмол байрандаа сууж, уншаад эргэж харах зориулалттай бол энэ нь нүд
   газрын зурагнаас салахгүйгээр "энэ юу вэ" гэдэгт хариулна. Хоёулаа нэг
   дэлгэц дээр зэрэг байж болно.

   Байрлалыг React ТӨЛӨВӨӨР бариулахгүй: хулгана хөдлөх бүрд самбар бүхлээрээ
   дахин зурагдана (худгийн самбар 12 мянган цэг, хэдэн зуун мөртэй диаграмтай).
   Оронд нь `transform`-ыг шууд DOM руу бичиж, төлөвд зөвхөн ЦЭГИЙН ДУГААРЫГ
   барина — дугаар давхцвал React өөрөө дахин зурахаас татгалзана. */

/** Хулганаас тайлбар хүртэлх зай, зургийн ирмэгээс үлдээх зай */
const GAP = 16;
const PAD = 8;

export type MapTipState = ReturnType<typeof useMapTip>;

/**
 * Тайлбарын төлөв ба байрлалын машин.
 *
 * Газрын зургийн `onHover`-т `tip.onHover`-ыг өгөөд, тайлбарыг
 * `<MapTip state={tip}>`-ээр зурна. Өөр залгах зүйл байхгүй — хүрээний
 * хэмжээг тайлбар өөрөө `offsetParent`-аасаа уншина.
 */
export function useMapTip() {
  const [oid, setOid] = React.useState<number | null>(null);
  /** Тайлбарын элемент — `MapTip` өөрөө бүртгүүлнэ */
  const el = React.useRef<HTMLDivElement | null>(null);
  /** Хамгийн сүүлийн хулганы байрлал — агуулга солигдоход дахин хэрэглэнэ */
  const at = React.useRef({ x: 0, y: 0 });

  /**
   * Тайлбарыг хулганы хажууд тавина.
   *
   * Ирмэгээс хальж эхэлбэл НӨГӨӨ ТАЛ РУУ нь эргүүлнэ — зөвхөн шахаж
   * оруулбал тайлбар нь өөрийн заасан цэгээ дарна. Босоо тэнхлэгт
   * эргүүлэх шаардлагагүй: төвлөрүүлээд хүрээнд нь багтаана.
   *
   * Хүрээ нь тайлбарын `offsetParent` — газрын зургийг агуулж буй
   * `relative` элемент. MapLibre-ийн өгдөг пиксель нь мөн түүнээс
   * тоологддог тул хоёр координат нэг эхтэй.
   */
  const place = React.useCallback(() => {
    const node = el.current;
    const frame = node?.offsetParent as HTMLElement | null;
    if (!node || !frame) return;
    const { x, y } = at.current;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    let left = x + GAP;
    if (left + w > frame.clientWidth - PAD) left = x - GAP - w;
    left = Math.max(PAD, left);
    const top = Math.max(PAD, Math.min(y - h / 2, frame.clientHeight - h - PAD));
    node.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }, []);

  /** Газрын зургийн `onHover`-т шууд өгнө */
  const onHover = React.useCallback(
    (id: number | null, p?: { x: number; y: number }) => {
      if (p) {
        at.current = p;
        place();
      }
      // Ижил утга буцаавал React дахин зурахгүй — хөдөлгөөн бүрд биш,
      // цэг СОЛИГДОХ үед л шинэчилнэ
      setOid((prev) => (prev === id ? prev : id));
    },
    [place],
  );

  /** `MapTip` элементээ бүртгүүлэх, салгах */
  const mount = React.useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      if (node) place();
    },
    [place],
  );

  return { oid, onHover, mount, place };
}

/**
 * Тайлбарын хайрцаг.
 *
 * `pointer-events-none` ЗААВАЛ: тайлбар нь хулганы араас явдаг тул хулганы
 * доор орвол өөрөө hover-ийг таслаж, анивчиж эхэлнэ.
 */
export function MapTip({
  state,
  width = 228,
  children,
}: {
  state: MapTipState;
  width?: number;
  children: React.ReactNode;
}) {
  const el = React.useRef<HTMLDivElement>(null);

  /*
    Агуулга солигдоход өндөр нь өөрчлөгддөг тул зурагдсаны ДАРАА дахин
    байрлуулна — эс тэгвээс өмнөх бичлэгийн хэмжээгээр тооцсон байрлал
    дээр үлдэж, урт нэр дээр ирмэгээс халина. Хамаарлын жагсаалт БАЙХГҮЙ:
    энэ бүрэлдэхүүн зөвхөн агуулга нь өөрчлөгдөх үед л дахин зурагддаг.
  */
  React.useLayoutEffect(() => {
    state.mount(el.current);
    return () => state.mount(null);
  });

  return (
    <div
      ref={el}
      style={{ width }}
      className="tip-in pointer-events-none absolute top-0 left-0 z-20 overflow-hidden rounded-xs border border-line bg-paper/95 backdrop-blur-md will-change-transform"
    >
      {/*
        Дээд ирмэгийн дата зураас — газрын зураг дээрх тодруулгын цагирагтай
        нэг өнгө. Тайлбар нь аль давхаргаас гарч ирснийг өнгөөр нь холбоно.
      */}
      <div className="h-[2px] w-full bg-data" />
      {children}
    </div>
  );
}

/**
 * Тайлбарын нэг мөр.
 *
 * Гарчиггүй: талбарын нэр бичих зай алга бөгөөд икон нь тэр үүргийг
 * гүйцэтгэнэ. Урт нэрийг таслахгүй, хоёр мөрөөр бууна — таславал
 * байгууллагын нэр танигдахаа болино.
 */
export function MapTipRow({
  icon: Icon,
  text,
  num: isNum,
}: {
  icon: LucideIcon;
  text: string;
  /** Тоон утга уу — `tabular-nums` эгнүүлэлт */
  num?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      <Icon size={12} strokeWidth={1.8} className="mt-[2px] shrink-0 text-ink-3" />
      <span
        className={`min-w-0 flex-1 text-[11.5px] leading-[1.35] text-ink${
          isNum ? " num" : ""
        }`}
      >
        {text}
      </span>
    </div>
  );
}
