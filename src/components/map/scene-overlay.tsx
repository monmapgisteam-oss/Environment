"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { esriModules } from "@/lib/arcgis-sdk";
import { MESHES } from "@/lib/scene";

/* --------------------------------------------------------------------------
   3D ХАРАГДАЦ — нэгдсэн торон загвар (integrated mesh, I3S)

   ⚠ MapLibre I3S торон загварыг ЗУРЖ ЧАДАХГҮЙ — энэ нь Esri-ийн формат
   бөгөөд зөвхөн ArcGIS Maps SDK-ийн `SceneView` дэмждэг. Тиймээс 3D
   горим нь 2D зургийн ДЭЭГҮҮР тусдаа давхарга: MapLibre доор нь
   хэвээр амьд үлдэж, 2D руу буцахад тэр даруй гарна.

   ⚠ SDK-г {@link src/lib/arcgis-sdk.ts} НЭГ Л УДАА ачаална —
   нэвчилтийн 3D зүсэлт ч мөн түүнийг дуудна. Суурь зураг
   (`satellite`), дэлхийн өндөршил (`world-elevation`) нь Esri-ийн
   нээлттэй үйлчилгээ.

   ⚠ Гурван торон загвар НЭЭЛТТЭЙ хуваалцагдсан (токенгүй хариулна,
   2026-09-17-нд шалгасан) тул нэвтрэлтийн холболт хэрэггүй. Хаагдвал
   `IntegratedMeshLayer` ачаалагдахгүй бөгөөд алдаа нь доорх мөрөнд
   ил гарна — чимээгүй хоосон тэнгэр биш.

   Камер: гурван загварын НИЙЛСЭН хүрээ рүү 55° налуугаар очно —
   тэдгээр нь 3D-ийн цорын ганц агуулга тул 2D-ийн одоогийн байрлалыг
   дагах нь ихэвчлэн хоосон газар харуулна.
   -------------------------------------------------------------------------- */

type SceneViewLike = {
  destroy: () => void;
  when: () => Promise<void>;
  goTo: (target: unknown, opts?: { animate?: boolean }) => Promise<void>;
};

type LayerLike = {
  when: () => Promise<void>;
  fullExtent: { union: (e: unknown) => unknown } | null;
  title: string;
};

export function SceneOverlay() {
  const holder = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | string>("loading");

  React.useEffect(() => {
    let view: SceneViewLike | null = null;
    let alive = true;

    esriModules<[
      new (p: object) => object,
      new (p: object) => SceneViewLike,
      new (p: object) => LayerLike,
    ]>(["esri/Map", "esri/views/SceneView", "esri/layers/IntegratedMeshLayer"])
      .then(
        ([EsriMap, SceneView, IntegratedMeshLayer]) =>
          new Promise<void>((resolve, reject) => {
            if (!alive || !holder.current) return resolve();
            try {
                  const layers = MESHES.map(
                    (m) => new IntegratedMeshLayer({ url: m.url, title: m.name }),
                  );
                  const map = new EsriMap({
                    basemap: "satellite",
                    ground: "world-elevation",
                    layers,
                  });
                  view = new SceneView({
                    container: holder.current,
                    map,
                    /* Esri-ийн өөрийн товчнуудыг нуух — платформ өөрийн
                       ойртуулах товчтой; тэдний навигацийг хулгана,
                       хуруугаар хийнэ */
                    ui: { components: [] },
                    environment: { atmosphereEnabled: true, lighting: { directShadowsEnabled: false } },
                  });

                  Promise.all(layers.map((l) => l.when()))
                    .then(() => view!.when())
                    .then(() => {
                      if (!alive) return;
                      const extent = layers.reduce<unknown>(
                        (acc, l) => (acc && l.fullExtent ? (acc as LayerLike["fullExtent"])!.union(l.fullExtent) : acc ?? l.fullExtent),
                        null,
                      );
                      return view!.goTo({ target: extent, tilt: 55 }, { animate: false });
                    })
                    .then(() => {
                      if (alive) setStatus("ready");
                      resolve();
                    })
                    .catch(reject);
            } catch (e) {
              reject(e);
            }
          }),
      )
      .catch((e: unknown) => {
        if (alive) setStatus(e instanceof Error ? e.message : "3D загвар ачаалагдсангүй");
      });

    return () => {
      alive = false;
      view?.destroy();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[5] bg-paper">
      <div ref={holder} className="h-full w-full" />
      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="elevated flex items-center gap-2 rounded-xs border border-line-2 bg-paper/90 px-3 py-1.5 text-[12px] text-ink-2 backdrop-blur">
            {status === "loading" ? (
              <>
                <Loader2 size={13} className="animate-spin text-ink-3" />
                3D загвар ачаалж байна…
              </>
            ) : (
              <span className="text-(--clay)">{status}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
