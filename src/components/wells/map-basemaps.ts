/* eslint-disable @typescript-eslint/no-explicit-any -- Esri SDK нь CDN-ээс AMD-ээр ачаалагддаг тул төрлийн тодорхойлолтгүй; SDK обьект `any` */


import type { Esri } from "./map-layers";

export const ESRI = (s: string) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;

export type Basemap = {
  id: string;
  name: string;
  service: string;
  /** Энэ суурь дээр гэрэлтэй бичээс тохирох эсэх (бараан суурь) */
  dark: boolean;
  maxzoom: number;
  /** `services.arcgisonline.com`-оос ӨӨР хост дээрх хавтангийн хаяг */
  url?: string;
  /**
   * Растерын засвар — Esri-ийн Firefly хавтан нь өнгө сулруулсан ч
   * БАРААН биш тул гэрэлтэх цэг ялгарахгүй байв (зургаар шалгасан).
   * Нэрс нь MapLibre-ийнх хэвээр; Esri дээр CSS шүүлтүүр (`effect`) болно.
   */
  paint?: { "raster-brightness-max"?: number; "raster-saturation"?: number; "raster-contrast"?: number };
};

/**
 * Хиймэл дагуул нь үндсэн суурь — цуглуулгын эхэнд байрлана.
 *
 * ⚠ НЭР нь Esri-ийн АЛБАН АНГЛИ нэр (хэрэглэгчийн шийдвэр, 2026-10-12:
 * "нэршил нь бас англиар — хиймэл дагуул биш Imagery") — сонголт нь
 * Esri-ийн `BasemapGallery` виджетэд гардаг.
 */
export const BASEMAPS: Basemap[] = [
  /*
    ⚠⚠ **`maxzoom` нь ЗАРЛАСАН биш БОДИТ хамрах хүрээ** (Esri-ийн хавтангийн
    түвшин, 256px). Esri үйлчилгээндээ 19–20 хүртэл түвшин зарладаг ч
    Монголын нутагт бодит зураг нь эрт дуусдаг (2026-09-16-нд шалгасан):
      · Улаанбаатарын төв — хиймэл дагуул z19, гудамж z19, байр зүй z18
      · Хот ГАДУУР (Гачуурт, Горхи-Тэрэлж, Зуунмод) — ГУРВУУЛАА z17
    Түүнээс цааш сервер "Map data not yet available" гэсэн орлуулагч
    зургийг буцаана. Иймээс энэ түвшнээс цааш СҮҮЛЧИЙН БОДИТ хавтанг
    томруулж харуулна ({@link tileLayer}).
  */
  { id: "imagery", name: "Imagery", service: "World_Imagery", dark: true, maxzoom: 17 },
  /*
    ⚠ FIREFLY СУУРЬ (хэрэглэгч, 2026-10-07). Esri-ийн бараан, өнгө
    сулруулсан хиймэл дагуул — гэрэлтэх цэгт зориулагдсан. Хост нь
    `fly.maptiles.arcgis.com`, түлхүүргүй.
  */
  {
    id: "firefly",
    name: "Imagery (Firefly)",
    service: "World_Imagery_Firefly",
    dark: true,
    maxzoom: 17,
    paint: { "raster-brightness-max": 0.45, "raster-saturation": -0.55, "raster-contrast": 0.1 },
    url: "https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer/tile/{z}/{y}/{x}",
  },
  { id: "dark", name: "Dark Gray Canvas", service: "Canvas/World_Dark_Gray_Base", dark: true, maxzoom: 16 },
  { id: "light", name: "Light Gray Canvas", service: "Canvas/World_Light_Gray_Base", dark: false, maxzoom: 16 },
  { id: "street", name: "Streets", service: "World_Street_Map", dark: false, maxzoom: 17 },
  { id: "topo", name: "Topographic", service: "World_Topo_Map", dark: false, maxzoom: 17 },
  { id: "hillshade", name: "Hillshade", service: "Elevation/World_Hillshade", dark: false, maxzoom: 16 },
  { id: "natgeo", name: "National Geographic", service: "NatGeo_World_Map", dark: false, maxzoom: 16 },
];

export function basemapTiles(b: Basemap) {
  return b.url ?? ESRI(b.service);
}

/** Цуглуулгын жижиг урьдчилсан харагдац — Монголыг харуулсан нэг хавтан */
export function basemapThumb(b: Basemap) {
  return (b.url ?? ESRI(b.service)).replace("{z}/{y}/{x}", "5/11/24");
}

/** Анхны суурь зураг — хиймэл дагуул */
export function defaultBasemap() {
  return BASEMAPS.find((b) => b.id === "imagery") ?? BASEMAPS[0];
}

/** MapLibre-ийн растерын засварыг CSS шүүлтүүр болгоно */
export function basemapEffect(b: Basemap) {
  const p = b.paint;
  if (!p) return null;
  const parts: string[] = [];
  if (p["raster-brightness-max"] != null) parts.push(`brightness(${p["raster-brightness-max"]})`);
  if (p["raster-saturation"] != null) parts.push(`saturate(${1 + p["raster-saturation"]})`);
  if (p["raster-contrast"] != null) parts.push(`contrast(${1 + p["raster-contrast"]})`);
  return parts.join(" ") || null;
}

/* --------------------------------------------------------------------------
   Өнгө, геометр
   -------------------------------------------------------------------------- */

/** Хавтангийн дүрслэл — 20 түвшин (Esri 0…19 = MapLibre ≤ 18) */
export function tileInfoOf(E: Esri) {
  return E.TileInfo.create({ size: 256, numLODs: 20, spatialReference: { wkid: 102100 } });
}

/*
  СУУРЬ ЗУРГИЙН ХАВТАН. `WebTileLayer` нь зарласан түвшнээс цааш хавтан
  гуйж "Map data not yet available" орлуулагч зургийг харуулна. Тиймээс
  бодит хамрах хүрээнээс (`maxzoom`) цааш эцэг хавтангаа ТАЙРЧ томруулна —
  MapLibre-ийн `maxzoom`-той ижил зан төлөв.
*/
export let TileClass: any = null;

export function tileLayer(E: Esri, b: Basemap) {
  TileClass ??= E.BaseTileLayer.createSubclass({
    properties: { tpl: null, maxLevel: 17 },
    fetchTile(this: any, level: number, row: number, col: number, options?: { signal?: AbortSignal }) {
      const d = Math.max(0, level - this.maxLevel);
      const url = String(this.tpl)
        .replace("{z}", String(level - d))
        .replace("{y}", String(row >> d))
        .replace("{x}", String(col >> d));
      const blank = () => {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        return c;
      };
      return E.request(url, { responseType: "image", signal: options?.signal })
        .then((res: any) => {
          const img = res.data as HTMLImageElement;
          if (!d) return img;
          const n = 1 << d;
          const s = 256 / n;
          const c = blank();
          const g = c.getContext("2d")!;
          g.imageSmoothingEnabled = true;
          g.drawImage(img, (col % n) * s, (row % n) * s, s, s, 0, 0, 256, 256);
          return c;
        })
        .catch((e: any) => {
          if (e?.name === "AbortError") throw e;
          return blank();
        });
    },
  });
  return new TileClass({
    tpl: basemapTiles(b),
    maxLevel: b.maxzoom,
    tileInfo: tileInfoOf(E),
    ...(basemapEffect(b) ? { effect: basemapEffect(b) } : {}),
  });
}

/**
 * Зураг тус бүрийн Esri `Basemap` обьектууд — `id` нь манай `Basemap.id`.
 * Галерей ба `map.basemap` НЭГ обьектыг заах ёстой: эс тэгвээс галерей
 * сонгосон суурийг таньж тодруулахгүй.
 */
export function esriBasemaps(E: { Basemap: any; BaseTileLayer: any; TileInfo: any; request: any }, map: any): Map<string, any> {
  if (!map.__basemaps) {
    map.__basemaps = new Map(
      BASEMAPS.map((b) => [
        b.id,
        new E.Basemap({ id: b.id, title: b.name, thumbnailUrl: basemapThumb(b), baseLayers: [tileLayer(E as Esri, b)] }),
      ]),
    );
  }
  return map.__basemaps;
}

/* --------------------------------------------------------------------------
   Давхаргын туслахууд
   -------------------------------------------------------------------------- */
