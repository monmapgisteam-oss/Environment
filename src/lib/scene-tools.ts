/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ачаалагддаг тул төрлийн тодорхойлолтгүй */
import { esriModules } from "@/lib/arcgis-sdk";

/*
  3D ЗУРГИЙН ХЭРЭГСЛҮҮД — БҮХ SceneView-д НЭГ ДАРААЛАЛ (хэрэглэгч 2026-10-15:
  "ene projectiin buh 3d map deer … mapiin baruun deed bulangaas ehleed
  dooshoo iconuudiig bairluulna: esri basemap gallery, layer, measure").

  Баруун дээд буланд ДЭЭРЭЭС ДООШ:
    1. Суурь зураг — Esri `BasemapGallery` (`Expand`);
    2. Давхарга — Esri `LayerList`, эсвэл дуудагчийн ӨӨРИЙН давхаргын цонх
       (хөрсний зүсэлт: нүхэн жорлон, худгийн асаалт — тэнд LayerList нь
       блок, таглаа зэрэг дотоод график давхаргуудыг жагсаах байсан);
    3. Хэмжилт — Esri `Measurement` (шулуун зай · талбай, 3D-ийн
       `DirectLineMeasurement3D` / `AreaMeasurement3D`).
  Гурав НЭГ `group`-тэй: нэгийг нээхэд бусад нь хумигдана. Дуудагчийн
  бусад товч (хөрсний харагдац, зүсэлт) тэдний ДООР үлдэнэ (`index`).

  Гурван газар дуудна: 2D/3D сэлгэгчийн 3D ({@link src/components/map/scene-overlay.tsx}),
  хөрсний блок ({@link src/lib/soil-scene.ts}, "Үер ба нэвчилт" ч мөн),
  үерийн симуляцийн 3D ({@link src/lib/flood/arcgis.js} — өөрийн суурь
  зургийн цуглуулгатай, 2D-тэй сонголт хуваалцдаг тул түүнийгээ өгнө).

  ⚠ Суурь зургийн нэр Esri-ийн АЛБАН АНГЛИ нэрээр — 2D-ийн галерейтай нэг
  шийдвэр (хэрэглэгч 2026-10-12).
  ⚠ View устахад UI-ийн виджетүүд хамт устана — тусдаа цэвэрлэгээ хэрэггүй.
*/

/** Esri-ийн суурь зургийн id — 3D-д ажилладаг, түлхүүргүй */
const SCENE_BASEMAPS = ["satellite", "hybrid", "topo-vector", "streets-vector", "gray-vector", "dark-gray-vector"];

const MODULES = [
  "esri/widgets/Expand",
  "esri/widgets/BasemapGallery",
  "esri/widgets/BasemapGallery/support/LocalBasemapsSource",
  "esri/Basemap",
  "esri/widgets/LayerList",
  "esri/widgets/Measurement",
];

export async function addSceneTools(
  view: any,
  opts: {
    /** `Expand`-ийн бүлэг — дуудагчийн бусад товчтой нэг байвал нэг л цонх нээгдэнэ */
    group: string;
    /** Бэлэн суурь зургийн `Expand` (үерийн апп); өгөөгүй бол шинээр үүснэ */
    basemap?: unknown;
    /** Бэлэн давхаргын `Expand` (хөрсний зүсэлт); өгөөгүй бол `LayerList` */
    layers?: unknown;
  },
): Promise<void> {
  const [Expand, BasemapGallery, LocalBasemapsSource, Basemap, LayerList, Measurement] =
    await esriModules<any[]>(MODULES);
  if (view.destroyed) return;

  const expand = (content: unknown, icon: string, tip: string) =>
    new Expand({
      view,
      content,
      expandIcon: icon,
      expandTooltip: tip,
      collapseTooltip: "Хаах",
      mode: "floating",
      group: opts.group,
    });

  const basemap =
    opts.basemap ??
    expand(
      new BasemapGallery({
        view,
        source: new LocalBasemapsSource({ basemaps: SCENE_BASEMAPS.map((id) => Basemap.fromId(id)) }),
      }),
      "basemap",
      "Суурь зураг",
    );
  const layers = opts.layers ?? expand(new LayerList({ view }), "layers", "Давхарга");

  /* Хэмжилт — хэрэгсэл сонгох мөр + Esri-ийн идэвхтэй хэрэгслийн самбар */
  const box = document.createElement("div");
  box.className = "scene-measure";
  const bar = document.createElement("div");
  bar.className = "scene-measure-bar";
  const host = document.createElement("div");
  box.append(bar, host);
  const measurement = new Measurement({ view, container: host, linearUnit: "metric", areaUnit: "metric" });
  const tools: [string, string][] = [
    ["direct-line", "Шулуун зай"],
    ["area", "Талбай"],
  ];
  const btns = tools.map(([tool, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = () => {
      measurement.activeTool = measurement.activeTool === tool ? null : tool;
      paint();
    };
    bar.append(b);
    return { tool, b };
  });
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Цэвэрлэх";
  clear.className = "is-clear";
  clear.onclick = () => {
    measurement.clear();
    paint();
  };
  bar.append(clear);
  function paint() {
    for (const { tool, b } of btns) {
      const on = measurement.activeTool === tool;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    }
  }
  paint();
  const measure = expand(box, "measure", "Хэмжих");

  [basemap, layers, measure].forEach((component, index) =>
    view.ui.add({ component, position: "top-right", index }),
  );
}
