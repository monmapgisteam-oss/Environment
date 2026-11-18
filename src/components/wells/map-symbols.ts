/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ачаалагддаг тул төрлийн тодорхойлолтгүй; SDK обьект `any` */


import { FIREFLY } from "@/components/wells/colors";

import { FIREFLY_CORE, FIREFLY_GLOW } from "@/lib/firefly";
import { cim, lerpStops, col } from "./map-geometry";
import { scaleAt, S0 } from "./map-scale";
import type { Mode } from "./map-layers";

/** Цагиргийн 32 өнцөгт, цагийн зүүний дагуу — CIM-ийн хүрээ ±5 */
export const RING = Array.from({ length: 33 }, (_, i) => {
  const a = (-(i % 32) / 32) * Math.PI * 2;
  return [5 * Math.cos(a), 5 * Math.sin(a)];
});

export const pt = (rPx: number) => rPx * 1.5;

export function disc(rPx: number, fill: number[] | null, stroke?: [number[], number]) {
  const layers: any[] = [];
  if (stroke)
    layers.push({ type: "CIMSolidStroke", enable: true, width: stroke[1] * 0.75, color: stroke[0], capStyle: "Round", joinStyle: "Round" });
  if (fill) layers.push({ type: "CIMSolidFill", enable: true, color: fill });
  return {
    type: "CIMVectorMarker",
    enable: true,
    anchorPointUnits: "Relative",
    size: pt(rPx),
    frame: { xmin: -5, ymin: -5, xmax: 5, ymax: 5 },
    markerGraphics: [
      {
        type: "CIMMarkerGraphic",
        geometry: { rings: [RING] },
        symbol: { type: "CIMPolygonSymbol", symbolLayers: layers },
      },
    ],
    scaleSymbolsProportionally: false,
    respectFrame: true,
  };
}

/** Сарнисан гэрэл — гурван дискийн давхарга (`op` нь MapLibre-ийн тунгалаг) */
export function glow(rPx: number, color: string, op: number) {
  return [
    disc(rPx * 0.48, cim(color, op * 0.48)),
    disc(rPx * 0.72, cim(color, op * 0.36)),
    disc(rPx, cim(color, op * 0.28)),
  ];
}

/** Давхаргуудыг ДЭЭРЭЭС ДООШ дарааллаар өгнө */
export function cimPoint(layers: any[]) {
  return {
    type: "cim",
    data: { type: "CIMSymbolReference", symbol: { type: "CIMPointSymbol", symbolLayers: layers } },
  };
}

export type Fire = { glow: string; mid: string; core: string };

/** Анхдагч firefly: сарнисан гэрэл → (цагираг) → бие → цөм */
export function fireSymbol(f: Fire, tint: string | null, ring: boolean) {
  return cimPoint([
    disc(2.3, cim(tint ?? f.core, 0.95)),
    disc(5.6, cim(tint ?? f.mid, 0.6)),
    ...(ring ? [disc(6.6, null, [cim("rgba(8,14,20,.7)"), 1.1])] : []),
    ...glow(11, tint ?? f.glow, 0.38),
  ]);
}

/** ЖИЖИГ firefly ({@link WellsMap} `dots`) */
export function dotSymbol(f: Fire, tint: string | null) {
  return cimPoint([
    disc(0.9, cim("#ffffff", 0.75)),
    disc(2.5, cim(tint ?? f.mid, 0.95)),
    ...glow(5.6, tint ?? f.glow, 0.42),
  ]);
}

/** Зэрэглэсэн энгийн цэг — бараан нимгэн ирмэгтэй, сул гэрэлтэй */
export function gradedSymbol(color: string) {
  return cimPoint([
    disc(1, cim(color, 0.92), [cim("rgba(10,18,26,.55)"), 0.7]),
    ...glow(2.4, color, 0.32),
  ]);
}

/** Зэрэглэсэн гэрэлтэх цэг — нэг өнгөт */
export function gradedFireSymbol(f: Fire) {
  return cimPoint([disc(0.95, cim(f.core, 0.95)), disc(2.2, cim(f.mid, 0.6)), ...glow(4.2, f.glow, 0.38)]);
}

/** Esri Firefly-ийн `CIMPictureMarker` давхарга (style-ийн тохиргоо хэвээр) */
export function picture(url: string, size: number, tint: number[], locked: boolean) {
  return {
    type: "CIMPictureMarker",
    enable: true,
    anchorPoint: { x: 0, y: 0 },
    anchorPointUnits: "Relative",
    size,
    scaleX: 1,
    textureFilter: "Picture",
    tintColor: tint,
    colorLocked: locked,
    url,
  };
}

/**
 * Зэрэглэсэн гэрэлтэх цэг — ESRI-ИЙН FIREFLY тэмдэг (хэрэглэгч 2026-10-15,
 * хөрсний мониторинг: "esri firefly"). Style-ийн `Firefly_N`-тэй ЯГ ижил:
 * цагаан цөм (10pt, түгжээтэй) + шатлалын өнгөөр будсан гэрэл (20pt).
 * Гараар зурсан дугуйн хувилбар БУЦААГДСАН. Хэмжээг `sizeByValue` масштаблана.
 */
export function gradedMultiSymbol(color: string) {
  return cimPoint([
    picture(FIREFLY_CORE, 10, [255, 255, 255, 255], true),
    picture(FIREFLY_GLOW, 20, cim(color, 1), false),
  ]);
}

/**
 * Масштабаас хамаарах хэмжээ — MapLibre-ийн `interpolate zoom` -ын
 * орлогч. `stops` нь [MapLibre zoom, ТЭМДГИЙН ХАМГИЙН ТОМ давхаргын
 * радиус px].
 */
export function sizeByZoom(stops: [number, number][]) {
  return {
    type: "size",
    valueExpression: "$view.scale",
    stops: [...stops].reverse().map(([z, r]) => ({ value: scaleAt(z), size: pt(r) })),
  };
}

/**
 * Утга ба масштаб хоёулаа хэмжээнд орно (зэрэглэсэн тэмдэг).
 * Суурь радиус нь z8 1.7 · z12 2.4 · z16 3.6 px, утгаараа 1.9 дахин томорно.
 * ⚠ Esri-ийн визуал хувьсагч нэг л илэрхийлэл авдаг тул хоёр сувгийг
 * Arcade дотор нийлүүлнэ; `stops` нь ижилсэлтийн хувиргалт.
 */
export function sizeByValue(lo: number, hi: number, unit: number) {
  const span = hi - lo || 1;
  return {
    type: "size",
    valueExpression: `
var z = Log(${S0} / $view.scale) / Log(2) - 1;
var b = When(z <= 8, 1.7, z <= 12, 1.7 + (z - 8) / 4 * 0.7, z <= 16, 2.4 + (z - 12) / 4 * 1.2, 3.6);
var g = $feature.g;
var t = IIf(IsEmpty(g), 0, Max(0, Min(1, (g - ${lo}) / ${span})));
return b * ${unit} * (1 + 0.9 * t) * 1.5;`,
    stops: [
      { value: 0, size: 0 },
      { value: 400, size: 400 },
    ],
  };
}

/** Шатлалыг 24 ангилалд хувааж өнгө тус бүрд тэмдэг үүсгэнэ */
export function gradeRenderer(stops: [number, string][], symbol: (hex: string) => any, size: any) {
  const lo = stops[0][0];
  const hi = stops[stops.length - 1][0];
  const N = 24;
  const infos = Array.from({ length: N }, (_, i) => {
    const a = lo + ((hi - lo) * i) / N;
    const b = lo + ((hi - lo) * (i + 1)) / N;
    return {
      minValue: i === 0 ? -1e15 : a,
      maxValue: i === N - 1 ? 1e15 : b,
      symbol: symbol(lerpStops(stops, (a + b) / 2)),
    };
  });
  return {
    type: "class-breaks",
    field: "g",
    defaultSymbol: symbol(stops[0][1]),
    classBreakInfos: infos,
    visualVariables: [size],
  };
}

/** Үл үзэгдэх тэмдэг — зөвхөн шошго үүрэх давхаргад */
export const INVISIBLE = {
  type: "simple",
  symbol: { type: "simple-marker", size: 0, color: [0, 0, 0, 0], outline: null },
};

/** Шошгын фонт — Esri-ийн фонтын үйлчилгээнд кирилл үсэгтэй гэр бүл */
export const FONT = { family: "Noto Sans", weight: "bold" } as const;

export const HALO = [8, 14, 20, 0.85];

/* Олон өнцөгтийн зураасны өргөн (px) — MapLibre-ийн z8…z14 мужийн дунд */
export function strokes(m: Mode, lit: boolean) {
  if (m.shapeCrisp) return { line: lit ? 2.5 : 1.35, cas: 0, fill: lit ? 0.26 : 0.12 };
  const fill = lit ? 0.68 : 0.42;
  if (m.shapeThin) return { line: lit ? 1.5 : 0.5, cas: lit ? 2.9 : 1.6, fill };
  /* 0.5px хүрээ, касинггүй (хэрэглэгч 2026-10-15, эвдэрсэн газар: "outline 0.5px bolgo") */
  if (m.shapeHair) return { line: lit ? 1.5 : 0.5, cas: 0, fill };
  return { line: lit ? 2.2 : 0.85, cas: lit ? 5.5 : 3.5, fill };
}

export function polySymbol(m: Mode, color: string, lit: boolean) {
  if (m.shapeHollow.includes(color)) {
    /* Нарийн хүрээ, дүүргэлтгүй; сонгосон үед л бүдэг дүүргэлт */
    const layers: any[] = [
      { type: "CIMSolidStroke", enable: true, width: (lit ? 1.8 : 0.7) * 0.75, color: cim(color, 1), joinStyle: "Round", capStyle: "Round" },
    ];
    if (lit) layers.push({ type: "CIMSolidFill", enable: true, color: cim(color, 0.22) });
    return { type: "cim", data: { type: "CIMSymbolReference", symbol: { type: "CIMPolygonSymbol", symbolLayers: layers } } };
  }
  const s = strokes(m, lit);
  /* ХҮРЭЭГҮЙ горимд зөвхөн СОНГОСОН дүрс нимгэн хүрээтэй */
  const outlined = m.shapeOutline || lit;
  const line = !m.shapeOutline && lit ? 1.2 : s.line;
  const cas = !m.shapeOutline && lit ? 2.6 : s.cas;
  const layers: any[] = [];
  if (outlined) {
    layers.push({ type: "CIMSolidStroke", enable: true, width: line * 0.75, color: cim(color, m.shapeCrisp ? 1 : 0.9), joinStyle: "Round", capStyle: "Round" });
    if (cas) layers.push({ type: "CIMSolidStroke", enable: true, width: cas * 0.75, color: cim("rgba(8,14,20,.55)"), joinStyle: "Round", capStyle: "Round" });
  }
  layers.push({ type: "CIMSolidFill", enable: true, color: cim(color, s.fill) });
  return { type: "cim", data: { type: "CIMSymbolReference", symbol: { type: "CIMPolygonSymbol", symbolLayers: layers } } };
}

/** Чиглэлийн сум — шугамын дундад, чиглэлийн дагуу эргэнэ */
export const ARROW = {
  type: "CIMVectorMarker",
  enable: true,
  size: 9,
  anchorPointUnits: "Relative",
  frame: { xmin: -5, ymin: -5, xmax: 5, ymax: 5 },
  markerPlacement: { type: "CIMMarkerPlacementAtRatioPositions", positionArray: [0.5], angleToLine: true },
  markerGraphics: [
    {
      type: "CIMMarkerGraphic",
      geometry: { rings: [[[-4, -4], [-4, 4], [5, 0], [-4, -4]]] },
      symbol: {
        type: "CIMPolygonSymbol",
        symbolLayers: [
          { type: "CIMSolidStroke", enable: true, width: 1, color: cim("rgba(8,14,20,.85)") },
          { type: "CIMSolidFill", enable: true, color: cim("#ffffff") },
        ],
      },
    },
  ],
  scaleSymbolsProportionally: true,
  respectFrame: true,
};

export function lineSymbol(m: Mode, color: string, lit: boolean) {
  const s = strokes(m, lit);
  const layers: any[] = [];
  if (m.shapeFlow) layers.push(ARROW);
  layers.push({ type: "CIMSolidStroke", enable: true, width: Math.max(s.line, 1) * 0.75, color: cim(color, m.shapeCrisp ? 1 : 0.9), joinStyle: "Round", capStyle: "Round" });
  if (s.cas) layers.push({ type: "CIMSolidStroke", enable: true, width: s.cas * 0.75, color: cim("rgba(8,14,20,.55)"), joinStyle: "Round", capStyle: "Round" });
  return { type: "cim", data: { type: "CIMSymbolReference", symbol: { type: "CIMLineSymbol", symbolLayers: layers } } };
}

export function shapeRenderer(m: Mode, colors: string[], sym: (m: Mode, c: string, lit: boolean) => any) {
  const base = m.shapeColor ?? FIREFLY.glow;
  return {
    type: "unique-value",
    field: "c",
    defaultSymbol: sym(m, base, false),
    uniqueValueInfos: colors.map((c) => ({ value: c, symbol: sym(m, c, false) })),
  };
}

export function pointSymbolFor(m: Mode): (tint: string | null) => any {
  if (m.esriFire) return (t) => gradedMultiSymbol(t ?? m.fire.glow);
  if (m.dots) return (t) => dotSymbol(m.fire, t);
  return (t) => fireSymbol(m.fire, t, m.tinted);
}

/** Бөөгнөрлийн дугуй — тунгалаг дүүргэлт, тод хүрээ */
export function clusterSymbol(color: string, badge: boolean) {
  return {
    type: "simple-marker",
    color: col(color, badge ? 0.42 : 0.22),
    outline: { color: col(color, 0.95), width: (badge ? 1.6 : 1.4) * 0.75 },
  };
}

export function pointRenderer(m: Mode, colors: string[]) {
  /* Хардлагатай цэг (`a` = түвшин) — зэрэглэлийн Firefly тэмдэг түвшний өнгөөр, хэмжээ ижил */
  if (m.graded && m.gradedFireColor && m.alertColors.length) {
    const stops = m.graded;
    return {
      type: "unique-value",
      field: "a",
      defaultSymbol: gradedMultiSymbol(stops[0][1]),
      uniqueValueInfos: m.alertColors.map((c, k) => ({ value: k + 1, symbol: gradedMultiSymbol(c) })),
      visualVariables: [sizeByValue(stops[0][0], stops[stops.length - 1][0], 3.6)],
    };
  }
  if (m.graded) {
    const stops = m.graded;
    const lo = stops[0][0];
    const hi = stops[stops.length - 1][0];
    if (m.gradedFire && !m.gradedFireColor)
      return { type: "simple", symbol: gradedFireSymbol(m.fire), visualVariables: [sizeByValue(lo, hi, 4.2)] };
    if (m.gradedFireColor) return gradeRenderer(stops, gradedMultiSymbol, sizeByValue(lo, hi, 3.6));
    return gradeRenderer(stops, gradedSymbol, sizeByValue(lo, hi, 2.4));
  }
  const sym = pointSymbolFor(m);
  const base: [number, number][] = m.esriFire
    ? [
        /* Firefly-ийн гэрэл 20pt — тэмдгийн хамгийн том давхарга */
        [8, 7],
        [12, 10],
        [16, 15],
      ]
    : m.dots
    ? [
        [9, 3.4],
        [12, 5.6],
        [14, 7.5],
        [17, 12],
      ]
    : [
        [8, 7],
        [12, 11],
        [16, 18],
      ];
  const size = sizeByZoom(base.map(([z, s]) => [z, s * m.pointScale]));
  return {
    type: "unique-value",
    field: "c",
    defaultSymbol: sym(null),
    uniqueValueInfos: colors.map((c) => ({ value: c, symbol: sym(c) })),
    visualVariables: [size],
  };
}

/** Тодруулгын цагираг — тогтмол хэмжээ (z12) */
export function highlightSymbol(f: Fire) {
  return cimPoint([disc(10, null, [cim(f.core, 0.9), 1.3]), ...glow(15, f.glow, 0.4)]);
}
