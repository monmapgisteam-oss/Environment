"use client";

import * as React from "react";
import { BASEMAPS, esriBasemaps, type Basemap } from "@/components/wells/map";
import { esriModules } from "@/lib/arcgis-sdk";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ачаалагддаг тул төрлийн тодорхойлолтгүй */

type Engine = { E: any; view: any; map: any };

/**
 * СУУРЬ ЗУРГИЙН ГАЛЕРЕЙ — Esri-ийн `BasemapGallery` виджет (хэрэглэгч,
 * 2026-10-12: "esri basemap gallery mun bish bol esri bolgooroi").
 *
 * ⚠ Самбар бүр энэ бүрэлдэхүүнийг зурагтайгаа ХӨРШ байрлуулдаг (29 газар),
 * зураг нь `WellsMap` дотор. Дуудлагыг хөндөхгүйн тулд зургийг DOM-оор
 * олно: нэг эцэг доторх `.wells-esri` элемент, түүний `wells-ready` үйл
 * явдал (зураг дахин үүсэхэд ч). Виджет нь зургийн өөрийн UI-д
 * (`view.ui`, `Expand`) сууна.
 * ⚠ Эх нь манай `BASEMAPS` (бодит хамрах хүрээгээр томруулдаг хавтан) —
 * Esri-ийн портал галерей БИШ: тэр нь Монголд хоосон хавтан харуулна.
 * Нэр нь Esri-ийн албан англи нэр.
 * ⚠ Сонголт `onChange`-ээр самбарын төлөв рүү буцна — самбар өөрөө суурийг
 * сольж болдог (авто засварын зураг ойртолтоор).
 *
 * `unit`, `extent`, `onExtentChange` — харагдацаар шүүх үйлдэл (ArcGIS
 * Dashboard-ийн "map extent"): виджетийн доор тусдаа жижиг товч.
 */
export function BasemapGallery({
  value,
  onChange,
  extent = false,
  onExtentChange,
  unit,
  placement = "top-right",
}: {
  value: Basemap;
  onChange: (b: Basemap) => void;
  /** Зургийн аль буланд суух вэ. Анхдагч нь баруун дээд */
  placement?: "top-right" | "top-left";
  /** Харагдацын үйлдэл асаалттай эсэх */
  extent?: boolean;
  /** Харагдацын үйлдлийг ОРУУЛАХГҮЙ бол өгөхгүй */
  onExtentChange?: (v: boolean) => void;
  unit?: string;
}) {
  const anchor = React.useRef<HTMLSpanElement>(null);
  const changeRef = React.useRef(onChange);
  /* Самбарын одоогийн суурь — самбар өөрөө сольсон суурийг (авто засварын
     зураг ойртолтоор) хэрэглэгчийн сонголт гэж буцааж мэдэгдэхгүй */
  const valueRef = React.useRef(value.id);
  React.useEffect(() => {
    changeRef.current = onChange;
    valueRef.current = value.id;
  });

  React.useEffect(() => {
    const box = anchor.current?.parentElement;
    if (!box) return;
    let undo: (() => void) | null = null;
    let alive = true;

    const attach = (eng: Engine) => {
      undo?.();
      undo = null;
      let off = false;
      undo = () => {
        off = true;
      };
      esriModules<any[]>([
        "esri/widgets/BasemapGallery",
        "esri/widgets/Expand",
        "esri/widgets/BasemapGallery/support/LocalBasemapsSource",
      ]).then(([Gallery, Expand, LocalSource]) => {
        if (!alive || off || eng.view.destroyed) return;
        const all: Map<string, any> = esriBasemaps(eng.E, eng.map);
        const gallery = new Gallery({
          view: eng.view,
          source: new LocalSource({ basemaps: BASEMAPS.map((b) => all.get(b.id)) }),
        });
        const expand = new Expand({
          view: eng.view,
          content: gallery,
          expandIcon: "basemap",
          expandTooltip: "Basemap Gallery",
          collapseTooltip: "Basemap Gallery",
        });
        eng.view.ui.padding = 10;
        eng.view.ui.add(expand, placement);
        const watch = eng.E.reactive.watch(
          () => gallery.activeBasemap?.id,
          (id: string | undefined) => {
            const b = BASEMAPS.find((x) => x.id === id);
            if (!b || b.id === valueRef.current) return;
            expand.collapse();
            changeRef.current(b);
          },
        );
        undo = () => {
          watch.remove();
          if (!eng.view.destroyed) eng.view.ui.remove(expand);
          expand.destroy();
          gallery.destroy();
        };
      });
    };

    const ready = (e: Event) => {
      if (box.contains(e.target as Node)) attach((e as CustomEvent<Engine>).detail);
    };
    document.addEventListener("wells-ready", ready);
    const now = box.querySelector(".wells-esri") as (HTMLElement & { __engine?: Engine }) | null;
    if (now?.__engine && !now.__engine.view.destroyed) attach(now.__engine);

    return () => {
      alive = false;
      document.removeEventListener("wells-ready", ready);
      undo?.();
    };
  }, [placement]);

  return (
    <>
      <span ref={anchor} hidden />
      {/*
        Харагдацын үйлдэл — ArcGIS Dashboard-ийн "map extent" зарчим:
        газрын зургийн одоогийн хүрээ бусад элементийн шүүлтүүр болно.
        Esri-ийн галерейн ДООР тусдаа товч.
      */}
      {onExtentChange ? (
        <label
          className={cn(
            "elevated absolute top-[52px] z-20 flex cursor-pointer items-center gap-2 rounded-xs border border-line-2 bg-paper/92 px-2 py-1.5 backdrop-blur-md",
            placement === "top-left" ? "left-2.5" : "right-2.5",
          )}
          title={unit ? `Зургийн хүрээнд багтсан ${unit}-аар бусад самбар шинэчлэгдэнэ` : undefined}
        >
          <input
            type="checkbox"
            checked={extent}
            onChange={(e) => onExtentChange(e.target.checked)}
            className="size-3 shrink-0 accent-[var(--data)]"
          />
          <span className="text-[11px] leading-none font-medium text-ink">Харагдацаар шүүх</span>
        </label>
      ) : null}
    </>
  );
}
