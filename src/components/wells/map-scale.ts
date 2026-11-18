
import type * as GeoJSON from "geojson";


/** CSS пикселийн бодит хэмжээ — 1/96 инч */
export const M_PER_CSS_PX = 0.0254 / 96;

/**
 * Масштабын харьцааг zoom болгоно (1:60 000 → z 11.69), MapLibre-ийн
 * хуваарьт (512px хавтан).
 *
 * Хамаарал: D = 295 829 384 · cos(φ) / 2^z. Өргөрөг ордог тул анхдагч нь
 * УБ (47.9°) — энэ платформын бүх нягтралын дата тэнд байна.
 */
export function zoomForScale(denominator: number, lat = 47.9) {
  const d0 = 295_829_384 * Math.cos((lat * Math.PI) / 180);
  return Math.log2(d0 / denominator);
}

/** Web Mercator-ын 0-р түвшний номинал масштаб (256px, 96 dpi) */
export const S0 = 591_657_527.591555;

/** MapLibre zoom → Esri-ийн номинал масштаб (`view.scale`-тэй ижил хуваарь) */
export const scaleAt = (ml: number) => S0 / 2 ** (ml + 1);

/** Esri-ийн түвшин → MapLibre zoom */
export const mlOf = (esriZoom: number) => esriZoom - 1;

/** Зургийн дээд ойртолт, MapLibre-ийн хуваарьт */
export const MAX_ML = 18;

export type MapPoints = {
  oid: number[];
  lon: number[];
  lat: number[];
};

/** Харагдац: [баруун, өмнөд, зүүн, хойд] */
export type Extent = [number, number, number, number];

/**
 * Нэмэлт давхарга. Загварыг нь дуудагч тал (домэйны мэдлэгтэй нь) өгнө —
 * зураг нь зөвхөн зурна.
 */
export type MapOverlay = {
  id: string;
  data: GeoJSON.FeatureCollection;
  fill?: {
    color: string;
    opacity?: number;
    /** `gridcode` 1..N-ийн дагуух тунгалагийн шатлал */
    byGrid?: number[];
  };
  /** `style` — зураасны хэв (анхдагч бүтэн) */
  line: { color: string; opacity: number; width: number; style?: "solid" | "dash" | "short-dash" | "dot" };
  /**
   * Давхарга бүхэлдээ энэ түвшнөөс ОЙРТСОН үед л харагдана (`zoomForScale`).
   * Өгөөгүй бол бүх масштабад. ЗӨВХӨН давхарга үүсэх мөчид уншигдана.
   */
  minzoom?: number;
  /**
   * Дүрс бүрийн НЭР шошго (`properties[field]`) — сонголттой. Өгөөгүй
   * бол шошгогүй (бусад бүх дуудагч хуучнаараа). ЗӨВХӨН давхарга
   * үүсэх мөчид уншигдана.
   */
  label?: { field: string; size?: number; color?: string; minzoom?: number };
  /**
   * ДАТА ДАВХАРГЫН ДЭЭР зурагдах эсэх.
   *
   * ⚠ Нэмэлт давхарга нь ерөнхийдөө СУУРЬ тул доор нь суудаг (хил,
   * бүсийн тор). Гэвч заримдаа тэр нь өөрөө ДАТА байна: бүстэй
   * давхцсан нэгж талбар нь бүсийн дүүргэлтийн ДООР орвол огт
   * харагдахгүй (хэрэглэгч, 2026-09-29).
   * ⚠ ШОШГЫН ДООР үлдэнэ: бичвэр нь үргэлж хамгийн дээр.
   */
  above?: boolean;
};

/* --------------------------------------------------------------------------
   Esri-ийн суурь зургийн цуглуулга
   -------------------------------------------------------------------------- */
