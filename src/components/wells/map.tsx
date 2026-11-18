"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ачаалагддаг тул төрлийн тодорхойлолтгүй; энэ файлын бүх SDK обьект `any` */

import type * as GeoJSON from "geojson";
import { Minus, Plus } from "lucide-react";
import * as React from "react";
import { SceneOverlay } from "@/components/map/scene-overlay";
import { FIREFLY } from "@/components/wells/colors";

import { asset } from "@/lib/base-path";
import type { BoundarySet } from "@/lib/boundaries";

import { ratioText } from "@/lib/utils";
import { NoAccess } from "@/components/auth/access";
import { useMapAllowed } from "@/components/auth/tab-access";
import type { MapPoints, Extent, MapOverlay } from "./map-scale";
import type { Basemap } from "./map-basemaps";
import type { Fire } from "./map-symbols";
import type { Live, Mode, Layers } from "./map-layers";
import { modeOf, loadEsri, dataLayers, fillPoints, fillShapes, overlayFamily, overlayParts, geoLayer, refill, MARKER_CAP } from "./map-layers";
import { scaleAt, zoomForScale, MAX_ML, M_PER_CSS_PX, mlOf } from "./map-scale";
import { esriBasemaps, tileInfoOf } from "./map-basemaps";
import { toLonLat, esriGeom, mercPoint, toMerc } from "./map-geometry";
import { highlightSymbol, polySymbol, lineSymbol } from "./map-symbols";

/* Хуваасан модулиуд — гаднах импортын зам хэвээр (`@/components/wells/map`) */
export * from "./map-scale";
export * from "./map-basemaps";
export * from "./map-geometry";
export * from "./map-symbols";
export * from "./map-layers";

/* ==========================================================================
   НЭГДСЭН 2D ГАЗРЫН ЗУРАГ — ArcGIS Maps SDK `MapView` (2026-10-12)

   ⚠⚠ Урьд нь MapLibre GL байсан (git түүхэнд бий). 3D нь аль хэдийн Esri `SceneView` тул 2D, 3D НЭГ хөдөлгүүр
   болов. Пропын API ӨӨРЧЛӨГДӨӨГҮЙ — 26 самбар хөндөгдөхгүй.

   ⚠ ZOOM-ЫН ХОЁР ХУВААРЬ. Дуудагч тал (шошгын хязгаар, бөөгнөрлийн
   хязгаар, `onZoom`, `onView`) MapLibre-ийн zoom-оор ярьдаг: 512px
   хавтан. Esri-ийн LOD нь 256px хавтан тул НЭГЭЭР их (`ML + 1`).
   Хоорондын хөрвүүлэлт ЗӨВХӨН энэ файлд — гаднаас Esri-ийн түвшин
   хэзээ ч харагдахгүй.

   ⚠ Давхаргын харагдах муж нь МАСШТАБААР (`minScale`/`maxScale`) —
   Esri-ийн жишиг. `scaleAt(ml)` нь MapLibre zoom-ыг Web Mercator-ын
   НОМИНАЛ масштаб болгоно (Esri-ийн `view.scale`-тэй ижил хуваарь).

   ⚠ ГАЗРЫН ЗУРАГ ГОРИМООС ҮЛ ХАМААРНА: бүх өнгө тогтмол hex,
   платформын токен зураг дотор орохгүй.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Масштабын ХАРЬЦАА (1:10 000)
   -------------------------------------------------------------------------- */

/*
  ЦЭСИЙН ЭРХЭЭР ГАЗРЫН ЗУРАГ ХААЛТТАЙ бол ({@link src/components/auth/tab-access.tsx})
  зургийн оронд блок — SDK ачаалагдахгүй, давхарга татагдахгүй.
*/
export function WellsMap(props: React.ComponentProps<typeof WellsMapBody>) {
  if (!useMapAllowed()) return <NoAccess className="h-full w-full" text="Газрын зураг харах эрх байхгүй байна" />;
  return <WellsMapBody {...props} />;
}

function WellsMapBody({
  points,
  visible,
  basemap,
  onSelect,
  extent = false,
  onExtent,
  onZoom,
  onView,
  onMapClick,
  onBlankClick,
  focus = null,
  cluster = true,
  clusterMaxZoom = 15,
  clusterRadius = 48,
  clusterLabel = "inside",
  marks,
  pulse = false,
  pickedMark = null,
  hotMark = null,
  pulseColor,
  onHover,
  firefly,
  colors,
  dots,
  esriFirefly = false,
  alerts,
  pointScale,
  highlight = null,
  overlays,
  adminLines = true,
  shapes,
  grades,
  weights,
  labels,
  values,
  scale,
}: {
  points: MapPoints;
  /** Шүүлтүүр давсан цэгүүдийн индекс */
  visible: Uint32Array;
  basemap: Basemap;
  onSelect: (oid: number) => void;
  /** Харагдацыг шүүлтүүр болгон дамжуулах эсэх (map action) */
  extent?: boolean;
  onExtent?: (e: Extent | null) => void;
  /**
   * Ойртолт өөрчлөгдөх бүрд одоогийн түвшинг (MapLibre-ийн хуваарьт)
   * дамжуулна — зураг зогссоны дараа.
   */
  onZoom?: (zoom: number) => void;
  /**
   * ХАРАГДАХ ХҮРЭЭ — зураг зогссоны дараа л дуудагдана.
   * ⚠ Чирэх ЯВЦАД дуугарахгүй: дуудагч тал сервер рүү асуулга явуулдаг
   * (нэгж талбар) тул хулгана хөдлөх бүрд дуугарвал хүсэлтийн үер болно.
   */
  onView?: (box: Extent, zoom: number) => void;
  /**
   * БАЙРШИЛ СОНГОХ горим — өгвөл ЗУРАГ ДЭЭРХ ДУРЫН товшилт энэ рүү
   * `lon, lat`-аа дамжуулна (цэгийг сонгохгүй), заагч загалмай болно.
   * Өгөөгүй үед зан төлөв хөндөгдөхгүй.
   */
  onMapClick?: (lon: number, lat: number) => void;
  /**
   * Цэг, дүрс ТААРААГҮЙ товшилт — суурь давхаргын (`overlays`) цонх
   * гаргахад (баавгайн самбарын ойн төрөл). Нэмэлт давхарга нь
   * харилцдаггүй тул аль дүрсэнд орсныг дуудагч тал өөрөө тогтооно.
   */
  onBlankClick?: (lon: number, lat: number) => void;
  /** Сонголтын хүрээ — өөрчлөгдөх бүрд зураг тийш нь ойртоно (zoom action) */
  focus?: Extent | null;
  /** Бөөгнөрүүлэх эсэх. ЗӨВХӨН анхны зурагдалтад уншигдана */
  cluster?: boolean;
  /** Бөөгнөрөл ЭНЭ түвшнээс цааш задарна (MapLibre-ийн zoom, анхдагч 15) */
  clusterMaxZoom?: number;
  /** Бөөгнөрлийн радиус, px (анхдагч 48). ЗӨВХӨН анхны зурагдалтад */
  clusterRadius?: number;
  /** Тоог дугуйн дотор бичих үү, баруун дээд буланд тэмдэг болгох уу */
  clusterLabel?: "inside" | "badge";
  /**
   * `oid` → SVG тэмдэг эсвэл зургийн хаяг. Өгвөл тухайн цэг дугуй
   * ТЭМДГЭЭР тэмдэглэгдэнэ — бөөгнөрөл задарсан үед л харагдана.
   */
  marks?: Record<number, string>;
  /** Цэг бүрийг ДОХИОЛОЛ маягийн тэмдэглэгээгээр харуулах эсэх */
  pulse?: boolean;
  /**
   * СОНГОГДСОН тэмдэглэгээ — `marks`, `pulse` горимд. Тэмдэглэгээ нь
   * DOM элемент тул зургийн тодруулгын цагирагийг ДАРНА; сонголтыг
   * тэмдэг өөрөө (`is-picked`) үүрнэ.
   */
  pickedMark?: number | null;
  /**
   * ШАРААР ТОДРОХ бүртгэл (засварын цонхны хүснэгтийн мөр дээр хулгана
   * очиход, хэрэглэгч 2026-10-21). `marks`, `pulse` горимд тэмдэглэгээний
   * ангийг сэлгэнэ; бусад цэг ба олон өнцөгт, шугамыг `hot` давхаргад шараар
   * давхарлана (ArcGIS Online-ийн вэб зургийн тодруулга шиг).
   */
  hotMark?: number | null;
  /** Дохиоллын тэмдэглэгээний өнгө — `oid` бүрд */
  pulseColor?: (oid: number) => string | undefined;
  /**
   * Хулгана тэмдэглэгээ дээр очиход — гарахад `null`. `at` нь зургийн
   * талбар доторх пикселийн байрлал (хөвөгч тайлбарт).
   */
  onHover?: (oid: number | null, at?: { x: number; y: number }) => void;
  /** Цэгийн давхаргын өнгөний гурвал. ЗӨВХӨН анхны зурагдалтад */
  firefly?: Fire;
  /**
   * Цэг бүрийн АНГИЛЛЫН өнгө (hex), индекс нь `points`-тэй ижил. Ангилал
   * ЦӨӨН үед л — биеийн доор бараан цагираг нэмэгдэнэ.
   */
  colors?: ArrayLike<string | undefined>;
  /**
   * ЖИЖИГ FIREFLY ЦЭГ (хэрэглэгч, 2026-10-07). `rank` — өнгө (hex) →
   * зурах дараалал; их нь ДЭЭР.
   */
  dots?: { rank?: Record<string, number> };
  /**
   * ARCGIS ONLINE-ИЙН FIREFLY ТЭМДЭГ (хэрэглэгч, 2026-10-22: "arcgis online
   * map deer bdg shig firefly"). Цагаан цөм + ангиллын өнгөөр будсан
   * гэрэл — хөрсний мониторингийн `grades.firefly: "graded"`-тэй НЭГ зураг.
   */
  esriFirefly?: boolean;
  /**
   * ХАРДЛАГАТАЙ ЦЭГ (хэрэглэгч 2026-11-16, химийн бодисын бүртгэл): `levels[i]` = 0
   * ердийн, k ≥ 1 бол `colors[k - 1]`-ээр; бөөгнөрөл гишүүдийнхээ ХАМГИЙН ӨНДӨР түвшний
   * өнгөөр (их түвшин = илүү ноцтой). Өнгө нь ЗӨВХӨН анхны зурагдалтад; түвшин нь
   * дата шиг шинэчлэгдэнэ. Одоогоор `grades.firefly: "graded"` горимд л.
   */
  alerts?: { levels: ArrayLike<number | undefined>; colors: string[] };
  /** Цэгийн хэмжээний үржүүлэгч (зэрэглэлгүй цэгт), анхдагч 1 */
  pointScale?: number;
  /** Тодруулах цэгийн байрлал `[lon, lat]` — гэрэлтэх цагираг */
  highlight?: [number, number] | null;
  /** Нэмэлт хил, бүсийн давхаргууд — дата давхаргын ДООР */
  overlays?: MapOverlay[];
  /**
   * Засаг захиргааны (улс · аймаг · сум) суурь хил — анхдагч асаалттай.
   * Дуудагч тал өөрийн хилийг `overlays`-ээр зурдаг бол унтраана: хоёр
   * хил давхцаж зураг замбараагүй болно.
   */
  adminLines?: boolean;
  /**
   * ДАТА олон өнцөгт — харилцдаг: `properties.oid`-оор товшилт, hover,
   * `properties.c`-д өнгө, `properties.t`-д шошго.
   */
  shapes?: {
    data: GeoJSON.FeatureCollection;
    selected?: number | null;
    /** Хүрээг гэрлээр тойруулах (bloom) — цөөн талбайд. Анхны зурагдалтад */
    glow?: boolean;
    /** ТОД НАРИЙН ХҮРЭЭ, БҮДЭГ ДҮҮРГЭЛТ (үнэлгээний хэлтэс) */
    crisp?: boolean;
    /** Давхаргын өнгө (hex) */
    color?: string;
    /** Шошго энэ zoom-оос (MapLibre-ийн хуваарь) ойртсон үед л */
    labelZoom?: number;
    /** `LineString` дүрс дээр ЧИГЛЭЛИЙН сум */
    flow?: boolean;
    /** `point` — дүрс бүрд нэг шошго; `line-center` — шугамын дундад */
    labelPlacement?: "point" | "line-center";
    /** НИМГЭН ХҮРЭЭ (голын татам); `hair` — 0.5px, бараан касинггүй (эвдэрсэн газар) */
    edge?: "thin" | "hair";
    /** ОЛОН ӨНЦӨГТИЙН ХҮРЭЭ (анхдагчаар гарна); сонгосон дүрс үргэлж хүрээтэй */
    outline?: boolean;
    /**
     * ДҮҮРГЭЛТГҮЙ, НАРИЙН ХҮРЭЭТЭЙ зурагдах өнгөнүүд (`properties.c`) —
     * нэг цуглуулгад өөр давхарга дээгүүр суух тор (коридорт давхцсан
     * нэгж талбар). Анхны зурагдалтад л уншигдана.
     */
    hollow?: string[];
    /** НЭГ БИЧВЭРТ ЯГ НЭГ ШОШГО — хамгийн том дүрс дээр */
    labelUnique?: boolean;
  };
  /** АНХНЫ ХАРАГДАЦЫН МАСШТАБ (900_000 → 1:900 000) */
  scale?: number;
  /**
   * ЦЭГИЙН ОРОНД ХЭМЖИЛТИЙН УТГА (WMO-гийн station model). `maxzoom`-оос
   * ХОЛ байх үед цэг нуугдаж тоо гарна; ойртоход эсрэгээр.
   */
  values?: {
    text: string[];
    color?: string[];
    maxzoom?: number;
  };
  /** Цэгийн бичвэр шошго — `minzoom`-оос ойртсон үед */
  labels?: {
    text: string[];
    minzoom?: number;
    /** Цэгээс доош шилжих зай (em, анхдагч 0.7) */
    offset?: number;
    /** Бичвэрийн хэмжээ (pt, анхдагч 8). ЗӨВХӨН анхны зурагдалтад */
    size?: number;
    /**
     * Шошгын БИЧВЭР → өнгө (hex). Жагсаалтад байхгүй бичвэр анхдагч
     * цагаанаар. ЗӨВХӨН анхны зурагдалтад.
     */
    colors?: Record<string, string>;
    /** Хүрээний зузаан (pt, анхдагч 0.9). ЗӨВХӨН анхны зурагдалтад */
    halo?: number;
  };
  /**
   * Цэг бүрийн ХЭМЖИГДЭХҮҮН — ЗЭРЭГЛЭСЭН тэмдэг: өнгө ба хэмжээ хоёулаа
   * утгаас. `firefly: true` — нэг өнгөт гэрэлтэлт; `"graded"` — олон
   * өнгөт гэрэлтэлт.
   */
  grades?: {
    values: ArrayLike<number>;
    stops: [number, string][];
    firefly?: boolean | "graded";
  };
  /**
   * Цэг бүрийн ЖИН. Өгвөл НЯГТРАЛЫН горим: 1:20 000 хүртэл дулааны
   * зураг, түүнээс ойр бодит цэг.
   */
  weights?: number[];
}) {
  const holder = React.useRef<HTMLDivElement>(null);
  const markLayer = React.useRef<HTMLDivElement>(null);
  const ratio = React.useRef<HTMLDivElement>(null);
  /*
    SDK-ийн обьектууд REF-д — тэдгээр нь өөрчлөгддөг (давхаргын рендерер,
    график) тул React-ийн төлөвт барьж болохгүй. `ready` нь зөвхөн
    эффектүүдийг сэрээх туг.
  */
  const engine = React.useRef<Live | null>(null);
  const [ready, setReady] = React.useState(false);
  const [lost, setLost] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  const fitted = React.useRef(false);
  /** Сүүлд зурагт илгээсэн цэгийн датаны оролтууд */
  const applied = React.useRef<unknown[]>([]);
  /** oid → Esri геометр — сонгосон, хулганы доорх дүрсийг тод зурахад */
  const shapeGeoms = React.useRef(new Map<number, { geojson: GeoJSON.Geometry; c: string | null; esri?: any }>());
  /** Анхны (сонголтгүй) хүрээ — сонголт цуцлагдахад буцаж очно */
  const home = React.useRef<Extent | null>(null);
  /** Сонголтоор ойртсон эсэх */
  const zoomed = React.useRef(false);

  const selectCb = React.useRef(onSelect);
  const hoverCb = React.useRef(onHover);
  const extentCb = React.useRef(onExtent);
  const zoomCb = React.useRef(onZoom);
  const viewCb = React.useRef(onView);
  const pickCb = React.useRef(onMapClick);
  const blankCb = React.useRef(onBlankClick);
  const pulseColorRef = React.useRef(pulseColor);
  const hotRef = React.useRef(hotMark);
  const markEls = React.useRef<Map<number, HTMLElement> | null>(null);
  React.useEffect(() => {
    selectCb.current = onSelect;
    hoverCb.current = onHover;
    extentCb.current = onExtent;
    zoomCb.current = onZoom;
    viewCb.current = onView;
    pickCb.current = onMapClick;
    blankCb.current = onBlankClick;
    pulseColorRef.current = pulseColor;
  });
  const basemapRef = React.useRef(basemap);

  /** Эх сурвалж үүсгэх үед л уншигдах тохиргоо */
  const modeRef = React.useRef<Mode>(modeOf({ cluster, clusterMaxZoom, clusterRadius, clusterLabel, weights, grades, shapes, firefly, colors, dots, esriFirefly, pointScale, labels, values, scale, alerts }));

  /* ---------------- Газрын зураг үүсгэх ---------------- */
  React.useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let alive = true;
    let view: any = null;
    const handles: { remove: () => void }[] = [];

    loadEsri()
      .then((E) => {
        if (!alive || !holder.current) return;
        const mode = modeRef.current;

        /* ---- Давхаргууд, ДООРООС ДЭЭШ ---- */
        const under = new E.GroupLayer({ title: "under" });

        const bndLayer = (level: string) =>
          new E.GraphicsLayer({
            title: `bnd-${level}`,
            ...(level === "aimag" ? { minScale: scaleAt(5) } : level === "soum" ? { minScale: scaleAt(8) } : {}),
          });
        const bnd = { country: bndLayer("country"), aimag: bndLayer("aimag"), soum: bndLayer("soum") };

        const { shapePoly, shapeLine, shapeLabels, points, values: valuesLayer, heat, heatRenderer, dotRenderer, zDot } = dataLayers(E, mode);
        /* Сонгосон, хулганы доорх дүрс — тод хувилбараар давхарлана */
        const lit = mode.shaped ? new E.GraphicsLayer({ title: "lit" }) : null;
        const above = new E.GroupLayer({ title: "above" });
        const hl = new E.GraphicsLayer({ title: "hl" });
        const hot = new E.GraphicsLayer({ title: "hot" });

        const layers: Layers = {
          under,
          bnd,
          shapePoly,
          shapeLine,
          lit,
          above,
          shapeLabels,
          heat,
          points,
          values: valuesLayer,
          hl,
          hot,
        };

        const map = new E.Map({
          layers: [
            under,
            bnd.soum,
            bnd.aimag,
            bnd.country,
            ...[shapePoly, shapeLine, lit].filter(Boolean),
            above,
            ...[shapeLabels, heat].filter(Boolean),
            points,
            ...[valuesLayer].filter(Boolean),
            hl,
            hot,
          ],
        });

        map.basemap = esriBasemaps(E, map).get(basemapRef.current.id);
        const lods = tileInfoOf(E).lods;
        view = new E.MapView({
          container: holder.current,
          map,
          center: [106.9, 47.9],
          zoom: (mode.scale ? zoomForScale(mode.scale) : 9) + 1,
          constraints: { lods, minZoom: 1, maxZoom: MAX_ML + 1, snapToZoom: false, rotationEnabled: false },
          ui: { components: [], padding: { top: 10, right: 10, bottom: 10, left: 10 } },
          popupEnabled: false,
          /* Хулганы доорх тодруулгыг өөрсдөө зурна — SDK-ийн цэнхэр хүрээ хэрэггүй */
          highlightOptions: { color: [0, 0, 0, 0], haloOpacity: 0, fillOpacity: 0 },
        });

        return view.when().then(() => {
          if (!alive) return;

          /* ---- Масштабын заалт, тэмдэглэгээний байрлал ---- */
          handles.push(
            E.reactive.watch(
              () => view.extent,
              () => {
                const r = ratio.current;
                if (r) {
                  const y = view.height / 2;
                  const a = view.toMap({ x: 0, y });
                  const b = view.toMap({ x: 100, y });
                  if (a && b) {
                    const [lon1, lat1] = toLonLat(a.x, a.y);
                    const [lon2, lat2] = toLonLat(b.x, b.y);
                    const meters = haversine(lon1, lat1, lon2, lat2);
                    if (meters > 0) r.textContent = ratioText(meters / 100 / M_PER_CSS_PX);
                  }
                }
                placeMarks(view, markLayer.current);
              },
              { initial: true },
            ),
          );

          /* ---- Зогсох бүрд: ойртолт, хүрээ ---- */
          let lastZoom = NaN;
          const stationary = () => {
            const z = mlOf(view.zoom);
            if (z !== lastZoom) {
              lastZoom = z;
              zoomCb.current?.(z);
            }
            const box = extentOf(view);
            if (box) viewCb.current?.(box, z);
          };
          stationary();
          handles.push(E.reactive.when(() => view.stationary, stationary));

          if (mode.weighted) {
            const zone = scaleAt(zDot - 0.3);
            handles.push(
              E.reactive.watch(
                () => view.scale > zone,
                (far: boolean) => {
                  layers.points.renderer = far ? heatRenderer : dotRenderer;
                },
                { initial: true },
              ),
            );
          }

          /* ---- WebGL тасалдал — SDK өөрөө сэргээх оролдлого хийнэ ---- */
          let revive: number | null = null;
          handles.push(
            E.reactive.watch(
              () => view.fatalError,
              (err: unknown) => {
                if (!alive) return;
                setLost(Boolean(err));
                if (err) {
                  if (revive != null) window.clearTimeout(revive);
                  revive = window.setTimeout(() => view.tryFatalErrorRecovery(), 1500);
                }
              },
            ),
          );

          const self: Live = { E, view, map, layers, mode };
          bindPointer(view, layers, selectCb, hoverCb, pickCb, blankCb, (id) => {
            if (!layers.lit) return;
            layers.lit.__hot = id;
            redrawLit(self, shapeGeoms.current);
          });

          engine.current = self;
          /*
            Суурь зургийн галерейд ({@link src/components/map/basemap-gallery.tsx})
            зургийг олгоно: тэр нь самбар бүрд зурагтайгаа ХӨРШ бүрэлдэхүүн
            тул React-аар дамжих зам байхгүй — DOM үйл явдлаар.
          */
          const root = holder.current?.parentElement as any;
          if (root) {
            root.__engine = self;
            root.dispatchEvent(new CustomEvent("wells-ready", { bubbles: true, detail: self }));
          }
          setLost(false);
          setReady(true);
        });
      })
      .catch((e: unknown) => {
        if (alive) setFailed(e instanceof Error ? e.message : "Газрын зураг ачаалагдсангүй");
      });

    return () => {
      alive = false;
      for (const h of handles) h.remove();
      view?.destroy();
      fitted.current = false;
      engine.current = null;
      setReady(false);
    };
  }, []);

  /* ---------------- Засаг захиргааны хил ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    let alive = true;
    const { E, layers } = live;
    if (!adminLines) {
      for (const level of ["country", "aimag", "soum"] as const) layers.bnd[level]?.removeAll();
      return;
    }
    // eslint-disable-next-line no-restricted-globals -- өөрийн статик /api/boundaries — портал биш, токен хэрэггүй
    fetch(asset("/api/boundaries"))
      .then((r) => (r.ok ? r.json() : null))
      .then((b: BoundarySet | null) => {
        if (!alive || !b) return;
        const style = {
          country: { color: [255, 255, 255, 0.75], width: 1.35, style: "solid" },
          aimag: { color: [255, 255, 255, 0.45], width: 0.65, style: "dash" },
          soum: { color: [255, 255, 255, 0.3], width: 0.45, style: "short-dash" },
        } as const;
        for (const level of ["country", "aimag", "soum"] as const) {
          const line = { type: "simple-line", ...style[level], cap: "round", join: "round" };
          const graphics = b[level].features
            .map((f) => {
              const geometry = esriGeom(f.geometry);
              if (!geometry) return null;
              const symbol =
                geometry.type === "polygon"
                  ? { type: "simple-fill", color: [0, 0, 0, 0], outline: line }
                  : line;
              return new E.Graphic({ geometry, symbol });
            })
            .filter(Boolean);
          layers.bnd[level]?.removeAll();
          layers.bnd[level]?.addMany(graphics);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, adminLines]);

  /* ---------------- Суурь зураг солих ---------------- */
  React.useEffect(() => {
    basemapRef.current = basemap;
    const live = engine.current;
    if (!ready || !live) return;
    /* ⚠ ИЖИЛ суурийг дахин тавихгүй: зураг бэлэн болмогц энэ эффект
       ажилладаг бөгөөд үүсэж буй хавтангийн давхаргыг солиход SDK
       "reading 'reject'" алдаа шиддэг байв */
    if (live.map.basemap?.id === basemap.id) return;
    live.map.basemap = esriBasemaps(live.E, live.map).get(basemap.id);
  }, [ready, basemap]);

  /* ---------------- Харагдацын үйлдэл (map action) ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    if (!extent) {
      extentCb.current?.(null);
      return;
    }
    const emit = () => {
      const box = extentOf(live.view);
      if (box) extentCb.current?.(box);
    };
    emit();
    const h = live.E.reactive.when(() => live.view.stationary, emit);
    return () => h.remove();
  }, [ready, extent]);

  /* ---------------- Сонголт руу ойртох (zoom action) ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { view, mode } = live;
    const back = home.current ?? (mode.scale ? ([106.9, 47.9, 106.9, 47.9] as Extent) : null);
    const target = focus ?? (zoomed.current ? back : null);
    if (!target) return;
    zoomed.current = focus != null;
    const [w, s, e, n] = target;
    if (!focus && mode.scale) {
      view
        .goTo({ center: [(w + e) / 2, (s + n) / 2], zoom: zoomForScale(mode.scale, (s + n) / 2) + 1 }, { duration: 700 })
        .catch(() => {});
      return;
    }
    fitTo(view, target, 44, focus ? 14 : 13, 700);
  }, [ready, focus]);

  /* ---------------- Цэгийн өгөгдөл ---------------- */
  const dotRank = dots?.rank ? JSON.stringify(dots.rank) : "";
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { E, layers, mode, view } = live;
    /* ИЖИЛ датаг дахин ачаалахгүй — StrictMode болон хамааралгүй
       шинэчлэл 145 мянган цэгийг дахин илгээх байв */
    const flags = alerts?.levels;
    const sig = [live, points, visible, weights, grades, labels, values, colors, dotRank, flags];
    if (applied.current.length === sig.length && sig.every((v, i) => v === applied.current[i])) return;
    applied.current = sig;
    fillPoints(E, view, layers, mode, { points, visible, weights, grades, labels, values, colors, dotRank, alerts: flags });
    const { lon, lat } = points;
    /*
      Эхний удаа өгөгдлийн гол бөөгнөрөл рүү тааруулна — 1–99 хувийн муж:
      улс даяар тархсан ~2% нь харагдацыг сунгаж, өтгөн хэсэг цэг болж
      хумигдахаас сэргийлнэ. Энэ хүрээ нь `home` — сонголт цуцлагдахад
      буцах байрлал.
    */
    if (!fitted.current && visible.length > 0) {
      fitted.current = true;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k < visible.length; k++) {
        xs.push(lon[visible[k]]);
        ys.push(lat[visible[k]]);
      }
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      const lo = Math.floor(xs.length * 0.01);
      const hi = Math.ceil(xs.length * 0.99) - 1;
      home.current = [xs[lo], ys[lo], xs[hi], ys[hi]];
      if (mode.scale) {
        view
          .goTo(
            { center: [(xs[lo] + xs[hi]) / 2, (ys[lo] + ys[hi]) / 2], zoom: zoomForScale(mode.scale, (ys[lo] + ys[hi]) / 2) + 1 },
            { animate: false },
          )
          .catch(() => {});
      } else {
        fitTo(view, home.current, 30, 13, 0);
      }
    }
  }, [ready, points, visible, weights, grades, labels, values, colors, dotRank, alerts?.levels]);

  /* ---------------- Шошгын хязгаар — АМЬД ---------------- */
  const shapeLabelZoom = shapes?.labelZoom;
  const pointLabelZoom = labels?.minzoom;
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { layers } = live;
    const set = (layer: any, z: number | undefined) => {
      if (!layer?.labelingInfo?.length || z == null) return;
      layer.labelingInfo = layer.labelingInfo.map((c: any) => {
        const n = c.clone();
        n.minScale = scaleAt(z) * 1.01;
        return n;
      });
    };
    set(layers.shapeLabels ?? layers.shapeLine, shapeLabelZoom);
    if (!live.mode.cluster || live.mode.weighted) set(layers.points, pointLabelZoom);
    else if (pointLabelZoom != null && layers.points.labelingInfo?.length) set(layers.points, pointLabelZoom);
  }, [ready, shapeLabelZoom, pointLabelZoom]);

  /* ---------------- Дата олон өнцөгт ---------------- */
  const shapeData = shapes?.data;
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live || !shapeData) return;
    const { E, layers, mode } = live;
    const geoms = shapeGeoms.current;
    fillShapes(E, live.view, layers, mode, shapeData, geoms);
    redrawLit(live, geoms);
  }, [ready, shapeData]);

  /* Сонгогдсон талбай */
  const shapePick = shapes?.selected ?? null;
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live?.layers.lit) return;
    live.layers.lit.__picked = shapePick;
    redrawLit(live, shapeGeoms.current);
  }, [ready, shapePick, shapeData]);

  /* ---------------- Нэмэлт давхарга (хил, бүс) ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { E, layers } = live;
    const list = overlays ?? [];
    const kept = new Set(list.map((o) => o.id));
    for (const group of [layers.under, layers.above]) {
      for (const l of group.layers.toArray()) {
        if (!kept.has(l.__ovId) || l.__above !== (group === layers.above)) {
          group.remove(l);
          l.destroy();
        }
      }
    }
    for (const o of list) {
      const group = o.above ? layers.above : layers.under;
      const fam = overlayFamily(o);
      let layer = group.layers.find((l: any) => l.__ovId === o.id);
      const { renderer, feats, labelingInfo } = overlayParts(o, fam);
      if (!layer || layer.geometryType !== fam) {
        if (layer) {
          group.remove(layer);
          layer.destroy();
        }
        layer = geoLayer(
          E,
          fam,
          [
            { name: "gridcode", type: "integer" },
            { name: "t", type: "string" },
          ],
          {
            renderer,
            ...(labelingInfo ? { labelingInfo, labelsVisible: true } : {}),
            ...(o.minzoom != null ? { minScale: scaleAt(o.minzoom) * 1.01 } : {}),
          },
          feats(),
        );
        layer.__ovId = o.id;
        layer.__above = Boolean(o.above);
        layer.__data = o.data;
        group.add(layer);
      } else if (layer.__style !== JSON.stringify(renderer)) {
        layer.renderer = renderer;
      }
      layer.__style = JSON.stringify(renderer);
      if (layer.__data !== o.data) {
        layer.__data = o.data;
        const id = o.id;
        refill(
          E,
          live.view,
          {
            key: `ov:${(layers as any).__id ?? 0}:${id}`,
            /* Солилтын агшинд хуучин, шинэ хоёр зэрэг байж болно — сүүлийнх нь шинэ */
            get: () => group.layers.filter((l: any) => l.__ovId === id).at(-1),
            set: () => {},
          },
          feats,
        );
      }
    }
    /* Давхарын дараалал = жагсаалтын дараалал. `group.add` нь шинийг ДЭЭР
       нэмдэг тул хожуу ирсэн (эсвэл унтрааж асаасан) суурь давхарга хил
       дээгүүр гарч байв (баавгайн самбарын ойн төрөл, 2026-10-20) */
    for (const group of [layers.under, layers.above]) {
      let at = 0;
      for (const o of list) {
        if (Boolean(o.above) !== (group === layers.above)) continue;
        for (const l of group.layers.filter((x: any) => x.__ovId === o.id).toArray())
          group.reorder(l, at++);
      }
    }
  }, [ready, overlays]);

  /* ---------------- Тодруулгын цагираг ---------------- */
  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { E, layers, mode } = live;
    layers.hl.removeAll();
    if (highlight)
      layers.hl.add(
        new E.Graphic({
          geometry: mercPoint(highlight[0], highlight[1]),
          symbol: highlightSymbol(mode.fire),
        }),
      );
  }, [ready, highlight]);

  /* ---------------- Тэмдэглэгээ (DOM) ----------------
     Бөөгнөрөлтэй ЗЭРЭГЦЭЖ ажиллана: бөөгнөрөл задарч дан цэг болсон
     бичлэг л тэмдгээ харуулна. DOM элемент бүр зураг татдаг тул
     харагдах хүрээ ба `MARKER_CAP` хоёроор хязгаарлана. */
  React.useEffect(() => {
    const host = markLayer.current;
    const live = engine.current;
    if (!ready || !live || !host) return;
    const { E, view, layers, mode } = live;
    const els = new Map<number, HTMLElement>();
    markEls.current = els;
    if (!marks && !pulse) {
      host.replaceChildren();
      return;
    }
    let turn = 0;

    const draw = (want: Map<number, { mark: string; pos: [number, number]; tint?: string }>) => {
      for (const [id, el] of els)
        if (!want.has(id)) {
          el.remove();
          els.delete(id);
        }
      for (const [id, { mark, pos, tint }] of want) {
        if (els.has(id)) continue;
        const el = markerEl(
          mark,
          () => selectCb.current(id),
          hoverCb.current
            ? (over) => {
                const at = screenOf(view, pos);
                hoverCb.current?.(over ? id : null, over && at ? { x: at[0], y: at[1] } : undefined);
              }
            : undefined,
          tint,
        );
        const wrap = document.createElement("div");
        wrap.className = "wells-mark";
        wrap.dataset.lon = String(pos[0]);
        wrap.dataset.lat = String(pos[1]);
        wrap.appendChild(el);
        host.appendChild(wrap);
        els.set(id, wrap);
      }
      for (const [id, wrap] of els) {
        wrap.firstElementChild?.classList.toggle("is-picked", id === pickedMark);
        wrap.firstElementChild?.classList.toggle("is-hot", id === hotRef.current);
      }
      placeMarks(view, host);
    };

    const sync = async () => {
      const mine = ++turn;
      const want = new Map<number, { mark: string; pos: [number, number]; tint?: string }>();
      const { lon, lat, oid } = points;
      if (pulse) {
        for (let k = 0; k < visible.length && want.size < MARKER_CAP; k++) {
          const i = visible[k];
          want.set(oid[i], { mark: "pulse", pos: [lon[i], lat[i]], tint: pulseColorRef.current?.(oid[i]) });
        }
        return draw(want);
      }
      const box = extentOf(view);
      if (!box || !marks) return;
      const inView = (x: number, y: number) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
      /*
        Бөөгнөрсөн цэгийг АЛГАСНА: бөөгнөрлүүдийг SDK-ээс асууж, хоёроос
        олон гишүүнтэйн бүрэлдэхүүнийг хасна. SDK хариулахгүй бол
        бөөгнөрлийн хязгаараас ойр үед л тэмдэглэнэ.
      */
      let clustered: Set<number> | null = null;
      const z = mlOf(view.zoom);
      if (mode.cluster && z < mode.clusterMaxZoom) {
        clustered = new Set();
        try {
          const lv = await view.whenLayerView(layers.points);
          const agg = await lv.queryAggregates();
          const ids = agg.features.filter((f: any) => (f.attributes?.cluster_count ?? 1) > 1).map((f: any) => f.attributes.aggregateId);
          if (ids.length) {
            const res = await lv.queryFeatures({ aggregateIds: ids, outFields: ["oid"], returnGeometry: false });
            for (const f of res.features) clustered.add(Number(f.attributes.oid));
          }
        } catch {
          clustered = null;
          if (mine === turn) draw(new Map());
          return;
        }
      }
      if (mine !== turn) return;
      for (let k = 0; k < visible.length && want.size < MARKER_CAP; k++) {
        const i = visible[k];
        const id = oid[i];
        const mark = marks[id];
        if (!mark || !inView(lon[i], lat[i]) || clustered?.has(id)) continue;
        want.set(id, { mark, pos: [lon[i], lat[i]] });
      }
      draw(want);
    };

    sync();
    /* Зураг тогтож, давхарга (бөөгнөрөл) зурагдаж дуусах бүрд — дата
       солигдож шинэ давхарга орж ирэхэд ч мөн */
    let last = "";
    const h = pulse
      ? null
      : E.reactive.when(
          () => !live.view.updating && live.view.stationary,
          () => {
            /* Асуулга өөрөө `updating`-ийг сэлгэж болно — байрлал, давхарга
               өөрчлөгдөөгүй бол дахин асуухгүй (төгсгөлгүй давталт) */
            const c = view.center;
            const key = `${view.zoom.toFixed(3)}|${Math.round(c.x)}|${Math.round(c.y)}|${layers.points.uid}`;
            if (key === last) return;
            last = key;
            void sync();
          },
        );
    return () => {
      turn++;
      h?.remove();
      host.replaceChildren();
    };
  }, [ready, marks, pulse, points, visible, pickedMark]);

  React.useEffect(() => {
    hotRef.current = hotMark;
    for (const [id, wrap] of markEls.current ?? []) wrap.firstElementChild?.classList.toggle("is-hot", id === hotMark);
  }, [hotMark]);

  React.useEffect(() => {
    const live = engine.current;
    if (!ready || !live) return;
    const { E, layers } = live;
    layers.hot.removeAll();
    if (hotMark == null) return;
    const g = shapeGeoms.current.get(hotMark);
    if (g) {
      g.esri ??= esriGeom(g.geojson);
      if (!g.esri) return;
      const symbol =
        g.esri.type === "polygon"
          ? { type: "simple-fill", color: [255, 230, 0, 0.22], outline: { color: [255, 230, 0, 1], width: 2.6 } }
          : { type: "simple-line", color: [255, 230, 0, 1], width: 4, cap: "round", join: "round" };
      layers.hot.add(new E.Graphic({ geometry: g.esri, symbol }));
      return;
    }
    if (marks || pulse) return;
    const i = points.oid.indexOf(hotMark);
    if (i < 0) return;
    layers.hot.add(
      new E.Graphic({
        geometry: mercPoint(points.lon[i], points.lat[i]),
        symbol: { type: "simple-marker", size: 15, color: [255, 230, 0, 0.95], outline: { color: [8, 14, 20, 0.85], width: 1.6 } },
      }),
    );
  }, [ready, hotMark, points, shapeData, marks, pulse]);

  /*
    2D / 3D (хэрэглэгчийн хүсэлт, 2026-09-17). 3D нь 2D-ийн ДЭЭГҮҮР
    Esri-ийн `SceneView` — 2D зураг доор нь амьд үлдэнэ.
  */
  const [dim, setDim] = React.useState<"2d" | "3d">("2d");
  const root = React.useRef<HTMLDivElement>(null);
  /*
    3D-д самбарын 2D зурагт зориулсан ХӨВӨГЧ удирдлагууд (нэмэлт давхаргын
    товч, шатлалын тайлбар, бичлэгийн цонх …) НУУГДАНА — тэд 3D-ийн
    баруун дээд буланд суух хэрэгслүүдтэй давхцаж, 3D-д хамааралгүй
    зүйлийг зааж байв (хэрэглэгч 2026-10-15). Самбар бүр өөрөөр
    байрлуулдаг тул ЗӨВХӨН зургийн эх элементийн `absolute` хүүхдүүд.
  */
  React.useLayoutEffect(() => {
    const host = root.current?.parentElement;
    if (!host || dim !== "3d") return;
    const hidden: HTMLElement[] = [];
    for (const el of Array.from(host.children) as HTMLElement[]) {
      if (el === root.current || el.style.visibility === "hidden") continue;
      const pos = getComputedStyle(el).position;
      if (pos !== "absolute" && pos !== "fixed") continue;
      el.style.visibility = "hidden";
      hidden.push(el);
    }
    return () => hidden.forEach((el) => (el.style.visibility = ""));
  }, [dim]);

  /*
    ХЭРЭГСЛИЙН НЭГ БАГАНА (хэрэглэгч 2026-11-17: "дээр байгаа basemap, layer гэх
    мэт toggle доошоо нийлүүл"). Ойртуулах, 2D/3D нь дундад суудаг; баруун дээд
    булангийн хэрэгслүүдийг (Esri-ийн суурь зураг · 3D-ийн гурван хэрэгсэл,
    самбарын `.map-tool`, `[data-map-rail]`) тэдний ЯГ ДЭЭР 8px завсартай буулгана.
    Хэрэгслийн тоо самбар бүрд өөр тул БОДИТ өндрийг хэмжиж, шилжилтийг эх
    элементийн `--rail-shift` хувьсагчид бичнэ (`workspace.css` `.map-rail-shift`,
    `.wells-esri .esri-ui-top-right`). Хэрэгсэл нь дундаас өндөр бол шилжихгүй.
  */
  React.useEffect(() => {
    const host = root.current?.parentElement;
    const own = root.current;
    if (!host || !own) return;
    let frame = 0;
    let shift = 0;
    const measure = () => {
      frame = 0;
      const box = host.getBoundingClientRect();
      const rail = own.querySelector(".map-rail");
      if (!box.height || !rail) return;
      const scope = own.querySelector(".scene-overlay") ?? holder.current;
      const items = [
        ...Array.from(scope?.querySelectorAll(".esri-ui-top-right .esri-widget--button") ?? []),
        ...Array.from(host.querySelectorAll(".map-tool, [data-map-rail]")),
      ] as HTMLElement[];
      let top = Infinity;
      let bottom = -Infinity;
      for (const el of items) {
        if (rail.contains(el) || el.closest("[data-map-popover]")) continue;
        const r = el.getBoundingClientRect();
        if (!r.height || getComputedStyle(el).visibility === "hidden") continue;
        if (box.right - r.right > 48) continue;
        top = Math.min(top, r.top - box.top - shift);
        bottom = Math.max(bottom, r.bottom - box.top - shift);
      }
      const railTop = rail.getBoundingClientRect().top - box.top;
      const next = Number.isFinite(bottom) ? Math.max(0, Math.round(railTop - 8 - bottom)) : 0;
      if (next === shift) return;
      shift = next;
      host.style.setProperty("--rail-shift", `${next}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(host);
    const mo = new MutationObserver(schedule);
    mo.observe(host, { childList: true, subtree: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      host.style.removeProperty("--rail-shift");
    };
  }, [dim]);

  return (
    <div ref={root} className="wells-esri relative h-full w-full">
      <div ref={holder} className="h-full w-full" />
      <div ref={markLayer} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />
      {/* Хайрцаггүй, шууд зураг дээр суух тул уншигдац нь ГЭРЭЛТ ХҮРЭЭНЭЭС (`paper`
          өнгөт сүүдэр) хамаарна — хар сүүдэр нь гэрэл горимд бараан бичвэрийг
          хиймэл дагуул дээр улам бараан болгож байв (хэрэглэгч 2026-11-09) */}
      <div
        ref={ratio}
        className="num pointer-events-none absolute bottom-2.5 left-2.5 z-[2] text-[10px] leading-none text-ink"
        style={{ filter: "drop-shadow(0 0 1.5px var(--paper)) drop-shadow(0 0 1.5px var(--paper))" }}
      />
      {/*
        ТАСАЛДЛЫГ ИЛ ХЭЛНЭ — туван цагаан болоход хэрэглэгч зураг эвдэрсэн
        гэж үзнэ. ⚠ `--ochre`: дүрслэл сэргэх боломжтой.
      */}
      {lost || failed ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p
            className={`elevated max-w-[320px] rounded-xs border border-line bg-paper/92 px-4 py-3 text-center text-[12.5px] leading-relaxed backdrop-blur-md ${failed ? "text-clay" : "text-ochre"}`}
          >
            {failed ?? "Газрын зургийн дүрслэл тасалдав. Сэргээж байна."}
          </p>
        </div>
      ) : null}
      {dim === "3d" && <SceneOverlay />}
      {/* Ойртуулах, 2D/3D — баруун ирмэгийн дундад; дээрх хэрэгслүүд (суурь
          зураг, давхарга …) `--rail-shift`-ээр буугдаж түүний ДЭЭР залгана */}
      <div className="map-rail absolute top-[calc(50%-28px)] right-2.5 z-10 flex flex-col items-end gap-2">
        {dim === "2d" && <ZoomButtons engine={engine} />}
        <DimensionToggle value={dim} onChange={setDim} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Тусламжийн функцууд
   -------------------------------------------------------------------------- */

function haversine(lon1: number, lat1: number, lon2: number, lat2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

/** Харагдах хүрээ — газарзүйн солбицолд */
function extentOf(view: any): Extent | null {
  const e = view?.extent;
  if (!e) return null;
  const [w, s] = toLonLat(e.xmin, e.ymin);
  const [ea, n] = toLonLat(e.xmax, e.ymax);
  return [w, s, ea, n];
}

/** Газарзүйн цэгийн дэлгэцийн байрлал (эргүүлэлтгүй зураг) */
export function screenOf(view: any, [lon, lat]: [number, number]): [number, number] | null {
  const e = view?.extent;
  if (!e) return null;
  const [x, y] = toMerc(lon, lat);
  return [((x - e.xmin) / (e.xmax - e.xmin)) * view.width, ((e.ymax - y) / (e.ymax - e.ymin)) * view.height];
}

/** Тэмдэглэгээнүүдийг зургийн одоогийн байрлалд тааруулна */
export function placeMarks(view: any, host: HTMLElement | null) {
  if (!host) return;
  for (const el of host.children as unknown as Iterable<HTMLElement>) {
    const at = screenOf(view, [Number(el.dataset.lon), Number(el.dataset.lat)]);
    if (at) el.style.transform = `translate(${at[0]}px, ${at[1]}px)`;
  }
}

/**
 * Хүрээнд тааруулна — MapLibre-ийн `fitBounds`-тай ижил (`padding` px,
 * `maxMl` нь MapLibre-ийн zoom).
 */
function fitTo(view: any, [w, s, e, n]: Extent, padding: number, maxMl: number, duration: number) {
  const [x0, y0] = toMerc(w, s);
  const [x1, y1] = toMerc(e, n);
  const W = Math.max(1, view.width - padding * 2);
  const H = Math.max(1, view.height - padding * 2);
  const res = Math.max((x1 - x0) / W, (y1 - y0) / H, 1e-6);
  const zoom = Math.min(Math.log2(156543.03392804097 / res), maxMl + 1);
  const center = toLonLat((x0 + x1) / 2, (y0 + y1) / 2);
  view.goTo({ center, zoom }, duration ? { duration } : { animate: false }).catch(() => {});
}

/** Сонгосон ба хулганы доорх дүрсийг тод хувилбараар зурна */
function redrawLit(live: Live, geoms: Map<number, { geojson: GeoJSON.Geometry; c: string | null; esri?: any }>) {
  const lit = live.layers.lit;
  if (!lit) return;
  const { E, mode } = live;
  lit.removeAll();
  const ids = new Set<number>([lit.__picked, lit.__hot].filter((x) => x != null));
  for (const id of ids) {
    const g = geoms.get(id);
    if (!g) continue;
    g.esri ??= esriGeom(g.geojson);
    if (!g.esri) continue;
    const c = g.c ?? mode.shapeColor ?? FIREFLY.glow;
    const symbol = g.esri.type === "polygon" ? polySymbol(mode, c, true) : lineSymbol(mode, c, true);
    lit.add(new E.Graphic({ geometry: g.esri, symbol }));
  }
}

/*
  ТОВШИЛТ, HOVER — SDK-ийн `hitTest`-ээр.

  ⚠⚠ ЦЭГ нь ОЛОН ӨНЦӨГТӨӨС ДАВУУ ЭРХТЭЙ (2026-09-30): булаг нь өөрийн
  хамгаалалтын бүсийн ДОТОР сууна тул товшилт ЦЭГИЙГ сонгох ёстой.
  ⚠ Hover-ийн `hitTest` нэг удаад НЭГ — явж байхад ирсэн хөдөлгөөний
  СҮҮЛИЙНХ нь л дараа нь асуугдана.
*/
function bindPointer(
  view: any,
  layers: Layers,
  selectCb: React.RefObject<(oid: number) => void>,
  hoverCb: React.RefObject<((oid: number | null, at?: { x: number; y: number }) => void) | undefined>,
  pickCb: React.RefObject<((lon: number, lat: number) => void) | undefined>,
  blankCb: React.RefObject<((lon: number, lat: number) => void) | undefined>,
  /** Хулганы доорх дүрс (олон өнцөгт) — тод хувилбараар зурагдана */
  onHot: (id: number | null) => void,
) {
  const test = async (p: { x: number; y: number }) => {
    /* Давхарга дата солигдох бүрд шинэчлэгддэг тул ҮРГЭЛЖ одоогийнхыг авна */
    const include = [layers.points, layers.shapePoly, layers.shapeLine].filter(Boolean);
    const res = await view.hitTest(p, { include });
    let point: any = null;
    let shape: any = null;
    for (const r of res.results ?? []) {
      if (r.type !== "graphic") continue;
      if (r.layer === layers.points && !point) point = r.graphic;
      else if (r.layer !== layers.points && !shape) shape = r.graphic;
    }
    return { point, shape };
  };

  const isCluster = (g: any) => g?.isAggregate || g?.attributes?.cluster_count > 1;

  view.on("click", async (e: any) => {
    /* Байршил сонгох горимд цэг, дүрс сонгохгүй — товшсон газар л */
    const pick = pickCb.current;
    if (pick) {
      const m = e.mapPoint;
      if (m && Number.isFinite(m.longitude) && Number.isFinite(m.latitude))
        pick(m.longitude, m.latitude);
      return;
    }
    const { point, shape } = await test({ x: e.x, y: e.y });
    if (point && isCluster(point)) {
      view.goTo({ target: point.geometry, zoom: Math.min(view.zoom + 2, 18) }, { duration: 500 }).catch(() => {});
      return;
    }
    const g = point ?? shape;
    const oid = Number(g?.attributes?.oid);
    if (g && Number.isFinite(oid)) selectCb.current?.(oid);
    else if (!g) {
      const m = e.mapPoint;
      if (m && Number.isFinite(m.longitude) && Number.isFinite(m.latitude))
        blankCb.current?.(m.longitude, m.latitude);
    }
  });

  let busy = false;
  let next: { x: number; y: number } | null = null;
  let over = false;
  let hot: number | null = null;
  const setHot = (id: number | null) => {
    if (hot === id) return;
    hot = id;
    onHot(id);
  };

  const run = async () => {
    busy = true;
    while (next) {
      const p = next;
      next = null;
      let hit: { point: any; shape: any };
      try {
        hit = await test(p);
      } catch {
        continue;
      }
      const g = hit.point ?? hit.shape;
      view.container.style.cursor = pickCb.current ? "crosshair" : g ? "pointer" : "";
      const oid = Number(g?.attributes?.oid);
      if (g && !isCluster(g) && Number.isFinite(oid)) {
        over = true;
        hoverCb.current?.(oid, p);
      } else if (over) {
        over = false;
        hoverCb.current?.(null);
      }
      const shapeId = !hit.point && hit.shape ? Number(hit.shape.attributes?.oid) : null;
      setHot(Number.isFinite(shapeId) ? shapeId : null);
    }
    busy = false;
  };

  view.on("pointer-move", (e: any) => {
    next = { x: e.x, y: e.y };
    if (!busy) void run();
  });
  view.on("pointer-leave", () => {
    next = null;
    view.container.style.cursor = "";
    setHot(null);
    if (over) {
      over = false;
      hoverCb.current?.(null);
    }
  });
}

/**
 * Дугуй тэмдэглэгээ — зургийн хаяг, SVG тэмдэг эсвэл дохиоллын цохилт.
 * Хоёулаа өөрийн кодоос гаралтай тул `innerHTML` аюулгүй.
 */
export function markerEl(mark: string, onClick: () => void, onHover?: (over: boolean) => void, tint?: string) {
  const el = document.createElement("button");
  el.type = "button";
  if (tint) el.style.setProperty("--pin", tint);
  if (mark === "pulse") {
    el.className = "pulse-pin";
    el.innerHTML = '<span class="ring"></span><span class="ring d"></span>';
  } else if (mark.startsWith("<svg")) {
    el.className = "species-pin";
    el.innerHTML = mark;
  } else {
    el.className = "species-pin photo";
    el.style.backgroundImage = `url("${mark}")`;
  }
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  if (onHover) {
    el.addEventListener("mouseenter", () => onHover(true));
    el.addEventListener("mouseleave", () => onHover(false));
  }
  return el;
}

/** 2D / 3D сэлгэгч — ойртуулах товчны доор, баруун ирмэгт */
function DimensionToggle({ value, onChange }: { value: "2d" | "3d"; onChange: (v: "2d" | "3d") => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Харагдацын хэмжээс"
      className="elevated flex flex-col divide-y divide-line overflow-hidden rounded-xs border border-line-2 bg-paper/90 backdrop-blur"
    >
      {(["2d", "3d"] as const).map((d) => {
        const on = value === d;
        return (
          <button
            key={d}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(d)}
            className={
              on
                ? "flex size-[26px] items-center justify-center bg-data/15 text-[11px] font-semibold text-data"
                : "flex size-[26px] items-center justify-center text-[11px] font-medium text-ink-2 transition-colors hover:bg-paper-hi hover:text-ink"
            }
          >
            {d.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

/**
 * ОЙРТУУЛАХ, ХОЛДУУЛАХ товч — БАРУУН ИРМЭГИЙН ДУНДАД (бусад дөрвөн
 * булан эзэлгдсэн). Хөвөгч гадаргуу тул `.elevated` сүүдэр зөвшөөрөгдөнө.
 */
function ZoomButtons({ engine }: { engine: React.RefObject<Live | null> }) {
  const step = (d: number) => {
    const view = engine.current?.view;
    view?.goTo({ zoom: view.zoom + d }, { duration: 250 }).catch(() => {});
  };
  return (
    <div className="elevated flex flex-col divide-y divide-line overflow-hidden rounded-xs border border-line-2 bg-paper/92 backdrop-blur-md">
      <button
        onClick={() => step(1)}
        aria-label="Ойртуулах"
        className="flex size-[26px] items-center justify-center text-ink-2 transition-colors hover:bg-paper-hi hover:text-ink"
      >
        <Plus size={13} />
      </button>
      <button
        onClick={() => step(-1)}
        aria-label="Холдуулах"
        className="flex size-[26px] items-center justify-center text-ink-2 transition-colors hover:bg-paper-hi hover:text-ink"
      >
        <Minus size={13} />
      </button>
    </div>
  );
}
