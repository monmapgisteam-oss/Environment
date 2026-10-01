/*
  ARCGIS MAPS SDK — ХУВААЛЦСАН АЧААЛАГЧ

  ⚠ SDK-г NPM-ЭЭР СУУЛГААГҮЙ (`@arcgis/core` 80 МБ). Esri-ийн CDN-ээс
  ЗӨВХӨН хэрэгтэй үед, НЭГ Л УДАА ачаална: 3D харагдац нээгээгүй
  хэрэглэгч нэг ч байт илүү татахгүй, багцын хэмжээ өөрчлөгдөхгүй.

  ⚠ Хоёр дуудагчтай тул ачаалагч ЭНД сууна
  ({@link src/components/map/scene-overlay.tsx} — торон загвар,
  {@link src/lib/soil-scene.ts} — хөрсний блок).
  Хоёр газар хуулбарлавал SDK хоёр удаа татагдаж, `window.require` нь
  хоёр өөр хувилбарт холбогдоно.

  ⚠ CDN-ийн 4.33 — 5.x нь CDN дээр хараахан байхгүй (2026-09-17-нд
  шалгасан, 404). 4.33 нь AMD (`require([...])`) хэлбэртэй тул модулийн
  зам нь `esri/…`; шинэ баримтад тааралддаг `$arcgis.import("@arcgis/
  core/…")` хэлбэр нь ESM багцынх, энд ажиллахгүй.
*/

const API = "https://js.arcgis.com/4.33/";

export type EsriRequire = (
  modules: string[],
  ready: (...mods: unknown[]) => void,
) => void;

declare global {
  interface Window {
    require?: EsriRequire;
  }
}

let loading: Promise<EsriRequire> | null = null;

export function loadArcgis(): Promise<EsriRequire> {
  if (window.require) return Promise.resolve(window.require);
  loading ??= new Promise<EsriRequire>((resolve, reject) => {
    /* Загварын хуудсыг горимд нь тааруулна — Esri-ийн виджетүүд
       (зургийн товч, хэмжилт) өөрийн CSS-тэй.
       ⚠ Горим СОЛИГДОХОД ч дагана (хэрэглэгч 2026-10-01: "light gorim
       deer … shiljihgui bn") — урьд нь ачаалах үед нэг л удаа сонгогдож,
       горим сольсны дараа товчнууд хуучин загвартаа үлддэг байв. */
    const root = document.documentElement;
    const href = () => `${API}esri/themes/${root.dataset.theme !== "light" ? "dark" : "light"}/main.css`;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = href();
    document.head.appendChild(css);
    new MutationObserver(() => {
      if (css.href !== href()) css.href = href();
      /* ⚠ CSS дангаараа ХАНГАЛТГҮЙ: SDK зураг үүсэх үедээ UI дээр
         `calcite-mode-light|dark` анги тавьдаг бөгөөд товчны өнгө түүнээс
         гардаг — ангийг ч сольж байж товч горимоо дагана (хөтөч дээр шалгасан) */
      const mode = root.dataset.theme !== "light" ? "dark" : "light";
      document.querySelectorAll(".calcite-mode-light, .calcite-mode-dark").forEach((el) => {
        el.classList.remove("calcite-mode-light", "calcite-mode-dark");
        el.classList.add(`calcite-mode-${mode}`);
      });
    }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    const js = document.createElement("script");
    js.src = `${API}init.js`;
    js.async = true;
    js.onload = () => {
      if (window.require) resolve(window.require);
      else reject(new Error("ArcGIS SDK ачаалагдсангүй"));
    };
    js.onerror = () => {
      /* ⚠ Унасан амлалтыг кэшид ҮЛДЭЭХГҮЙ — дахин оролдоход
         сүлжээ сэргэсэн байж болно */
      loading = null;
      reject(new Error("ArcGIS SDK татагдсангүй — сүлжээгээ шалгана уу"));
    };
    document.head.appendChild(js);
  });
  return loading;
}

/** AMD модулиудыг амлалт болгож авна */
export function esriModules<T extends unknown[]>(paths: string[]): Promise<T> {
  return loadArcgis().then(
    (require) =>
      new Promise<T>((resolve) => {
        require(paths, (...mods: unknown[]) => resolve(mods as T));
      }),
  );
}
