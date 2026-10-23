/*
  ЗАСВАРЫН ЗУРАГ САМБАРЫНХТАЙ ЯГ ИЖИЛ (хэрэглэгч 2026-10-21: "db deer
  haragdaj bga map edit hiihed yg ter heweere haragdana").

  Давхарга бүрд тухайн САМБАРЫН `WellsMap` пропыг ДАВТАНА — засварын цонх
  самбарын задалсан объектгүй, зөвхөн ТҮҮХИЙ атрибуттай тул пропыг эндээс
  бодно. Түлхүүр нь давхаргын хаяг (`EditTarget.url`).

  ⚠ Самбарын зураг өөрчлөгдвөл ЭНД мөн засна — самбар бүрийн файлын
  холбоосыг доор бичсэн.
*/

import type * as React from "react";
import type { MapOverlay, WellsMap } from "@/components/wells/map";
import { DATA_COLOR, FIREFLY, oklchHex } from "@/components/wells/colors";
import { zoomForScale } from "@/components/wells/map";
import { ASSESSMENT_SERVICES } from "@/lib/assessment";
import { BOMT_SERVICE, classifyPlanting, PLANTING } from "@/lib/bomt";
import { chemicalService } from "@/lib/chemicals";
import { DAMAGED_SERVICE } from "@/lib/damaged";
import { WASTE as LANDFILL } from "@/lib/hyanalt-layers";
import { LICENSES_SERVICE } from "@/lib/licenses";
import { fetchMinerals, MINERALS_SERVICE } from "@/lib/minerals";
import { PETITIONS_SERVICE } from "@/lib/petitions";
import { BEAR_LAYER } from "@/lib/bears";
import { BIOTECH_SERVICE } from "@/lib/biotech";
import { ECO_SERVICE } from "@/lib/eco-corridors";
import type { EditTarget } from "@/lib/edit-targets";
import { FLORA } from "@/lib/flora";
import { LICHENS_SERVICE } from "@/lib/lichens";
import { fetchMarmots, MARMOT_SERVICES } from "@/lib/marmots";
import { POLES_SERVICE } from "@/lib/poles";
import { breakdowns, categoryKey, fetchLayerFeatures, fetchLayerInfo, labelParts, layerService, serviceOf, type LayerSet } from "@/lib/portal-layers";
import { RESCUES_SERVICE } from "@/lib/rescues";
import { speciesIconSvg } from "@/lib/species-icons";
import { speciesPhoto } from "@/lib/species-photos";
import { STICKERS_SERVICE } from "@/lib/stickers";
import { fetchUbDistricts, fetchUbKhoroos } from "@/lib/ub-districts";
import { num } from "@/lib/utils";
import { fetchReclamation, RECLAMATION_SERVICES } from "@/lib/reclamation";
import { REPAIR_SERVICE } from "@/lib/repair-shops";
import { NEUTRALIZATION_SERVICE } from "@/lib/neutralization";
import { mnPointCode, PLI_RAMP, SOIL_SERVICES } from "@/lib/soil";
import { CITY_SERVICE, PIT_SERVICE } from "@/lib/toilets";
import { rampColor, spreadRamp } from "@/lib/tone-ramp";

export type MapProps = React.ComponentProps<typeof WellsMap>;
type Attrs = Record<string, unknown>;

/** Зурагт өгөх бүх бүртгэл — `oid`, атрибут, (цэгт) байршил нэг дараалалтай */
export type LookData = { oid: number[]; attrs: Attrs[]; lon: number[]; lat: number[] };

/** Засварлагддаггүй ЧИМЭГЛЭЛ дүрс (булангийн цэгээс угсарсан талбай) — дугаар нь `DECOR`-оос дээш */
export const DECOR = 1_000_000_000;

export type Look = {
  /** Зурагт нэмж татах атрибутууд */
  fields?: string[];
  /** Цэгэн зургийн проп (`zoom` — MapLibre-ийн хуваарь, `zoomAware` үед) */
  points?: (d: LookData, zoom: number) => Partial<MapProps>;
  zoomAware?: boolean;
  /** Олон өнцөгт, шугам бүрийн өнгө (`c`) ба шошго (`t`) */
  shape?: (d: LookData) => (a: Attrs, oid: number) => { c?: string | null; t?: string | null };
  /** `WellsMap.shapes`-ийн хэв */
  shapeOpts?: {
    edge?: "thin" | "hair";
    crisp?: boolean;
    labelZoom?: number;
    outline?: boolean;
    color?: string;
    flow?: boolean;
    labelPlacement?: "point" | "line-center";
    labelUnique?: boolean;
  };
  /** Чимэглэл дүрс (засварлагдахгүй) — самбарын ЯГ ТЭР функцээр */
  decor?: (d: LookData) => Promise<{ shapes: GeoJSON.Feature[]; labelZoom?: number }>;
  /** Нэмэлт давхарга (хил, бүс) */
  overlays?: () => Promise<MapOverlay[]>;
  /** Ойртолтоор солигдох суурь зураг (авто засвар) */
  basemapAt?: (zoom: number) => string;
};

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const n = (v: unknown) => (v == null || v === "" ? NaN : Number(v));

/* ---------------- Хөрсний хяналт (orchin/soil-dashboard.tsx) ---------------- */
const soil = (codeField: string): Look => ({
  fields: ["pli", codeField],
  points: (d) => ({
    cluster: false,
    /* PLI-гүй (шинэ) цэг хамгийн доод шатаар — самбар тэднийг хасдаг ч засварт харагдах ёстой */
    grades: {
      values: Float32Array.from(d.attrs, (a) => (Number.isFinite(n(a.pli)) ? n(a.pli) : PLI_RAMP[0][0])),
      stops: PLI_RAMP,
      firefly: "graded",
    },
    labels: { text: d.attrs.map((a) => mnPointCode(s(a[codeField]) || s(a.objectid))), minzoom: 12 },
  }),
});

/* ---------------- Ариун цэвэр (orchin/dashboard.tsx) ---------------- */
const PIT_FIRE = { glow: "#df8146", mid: "#e0bd4f", core: "#fff3d6" };

/* ---------------- Химийн агуулах (hyanalt/chemicals-dashboard.tsx) ---------------- */
const EXPIRED_PIN =
  '<svg data-pin="expired" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
  '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

/** Хүчинтэй хугацааны ДУУСАХ огноо (`lib/chemicals.ts`-ийн `parseDates`-тэй ижил) — yyyymmdd */
function validTo(raw: string): number | null {
  const found = [...raw.matchAll(/(\d{2,4})[./](\d{1,2})[./](\d{1,2})/g)];
  const m = found[1];
  if (!m || m[1].length !== 4) return null;
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

const chemicals: Look = {
  fields: ["нийт_тоо_хэмжээ__тн_", "хүчинтэй_хугацаа"],
  points: (d) => {
    const values = Float32Array.from(d.attrs, (a) => {
      const t = n(a["нийт_тоо_хэмжээ__тн_"]);
      return Math.log10(1 + (Number.isFinite(t) ? t : 0));
    });
    const hi = values.reduce((m, v) => Math.max(m, v), 0);
    const now = new Date();
    const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const marks: Record<number, string> = {};
    d.attrs.forEach((a, i) => {
      const k = validTo(s(a["хүчинтэй_хугацаа"]));
      if (k != null && k < today) marks[d.oid[i]] = EXPIRED_PIN;
    });
    return {
      cluster: false,
      grades: { values, stops: [[0, DATA_COLOR], [Math.max(hi, 1), DATA_COLOR]], firefly: true },
      marks: Object.keys(marks).length ? marks : undefined,
    };
  },
};

/* ---------------- Авто засвар (hyanalt/repair-map.tsx) ---------------- */
const REPAIR_PIN =
  '<svg data-pin="place" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1' +
  '-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' +
  "</svg>";
const REPAIR_SWITCH = zoomForScale(4000);

const repair: Look = {
  fields: ["компани__иргэний_нэр"],
  zoomAware: true,
  points: (d, zoom) => ({
    clusterMaxZoom: Math.round(REPAIR_SWITCH),
    clusterLabel: "badge",
    marks: zoom >= REPAIR_SWITCH ? Object.fromEntries(d.oid.map((o) => [o, REPAIR_PIN])) : undefined,
    labels: { text: d.attrs.map((a) => s(a["компани__иргэний_нэр"]) || "Нэр бүртгэгдээгүй"), minzoom: REPAIR_SWITCH },
  }),
  basemapAt: (zoom) => (zoom >= REPAIR_SWITCH ? "street" : "imagery"),
};

/* ---------------- Хог хаягдал (hyanalt/waste-dashboard.tsx) ---------------- */
const SVG_HEAD =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' + 'stroke-linecap="round" stroke-linejoin="round"';
const HAZARD_PIN =
  `<svg data-pin="hazard" ${SVG_HEAD}>` +
  '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
  '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
const COMMON_PIN =
  `<svg data-pin="landfill" ${SVG_HEAD}>` +
  '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>' +
  '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
const waste = (pin: string): Look => ({
  points: (d) => ({ cluster: false, marks: Object.fromEntries(d.oid.map((o) => [o, pin])) }),
});

/* ---------------- Нөхөн сэргээлт (orchin/reclamation-dashboard.tsx) ---------------- */
const RECLAMATION_TONE = "#67d7e4";
const reclamation = (funding: "aan" | "tusuw"): Look => ({
  points: () => ({ cluster: false }),
  decor: async () => {
    const sites = (await fetchReclamation()).filter((x) => x.funding === funding);
    return {
      labelZoom: 12,
      shapes: sites.flatMap((x) =>
        x.rings.length
          ? [
              {
                type: "Feature" as const,
                geometry: { type: "MultiPolygon" as const, coordinates: x.rings.map((r) => [r]) },
                properties: { oid: DECOR + x.oid, c: RECLAMATION_TONE, t: `${x.no} · ${x.year}` },
              },
            ]
          : [],
      ),
    };
  },
});

/* ---------------- Нүүрс, алтны талбай (orchin/minerals-dashboard.tsx) ---------------- */
const minerals: Look = {
  points: () => ({ cluster: false }),
  decor: async () => {
    const data = await fetchMinerals();
    return {
      labelZoom: 0,
      shapes: data.shapes.features.map((f) => {
        const id = Number(f.id ?? f.properties?.oid);
        return { ...f, properties: { ...f.properties, oid: DECOR + id, c: rampColor(id - 1), t: f.properties?.t ?? null } };
      }),
    };
  },
};

/* ---------------- Ерөнхий үнэлгээ (unelgee/dashboard.tsx) — эрхийн хэлбэрээр ---------------- */
const cap = (x: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
const rightOf = (a: Attrs) => cap(s(a.rigth_type)) || "Тодорхойгүй";
const assessment: Look = {
  fields: ["rigth_type"],
  shapeOpts: { crisp: true },
  shape: (d) => {
    const count = new Map<string, number>();
    for (const a of d.attrs) count.set(rightOf(a), (count.get(rightOf(a)) ?? 0) + 1);
    const order = [...count.entries()].sort((x, y) => y[1] - x[1]).map(([k]) => k);
    const ramp = spreadRamp(order.length);
    const color = new Map(order.map((k, i) => [k, ramp[i]]));
    return (a) => ({ c: color.get(rightOf(a)) ?? "#67d7e4" });
  },
};

/* ---------------- Менежментийн төлөвлөгөө (unelgee/bomt-dashboard.tsx) ---------------- */
const PLANTING_COLOR = new Map<string, string>(PLANTING.map((p, i) => [p.id, spreadRamp(PLANTING.length)[i]]));
const bomt: Look = {
  fields: ["мод_тарих_байршил"],
  shapeOpts: { crisp: true },
  shape: () => (a) => ({ c: PLANTING_COLOR.get(classifyPlanting(s(a["мод_тарих_байршил"]))) ?? "#67d7e4" }),
};


/* ================= Амьтан, ургамал ================= */

/* ---------------- Баавгай (wildlife/bear-dashboard.tsx) ---------------- */
const STATUS_RULES: [RegExp, string][] = [
  [/олоогүй/, "#ffc000"],
  [/хөөж/, "#3dd6c6"],
  [/буцааж/, "#7cc255"],
  [/хуурамч/, "#ff5a4e"],
  [/батлагдсан/, "#d46bff"],
  [/мөр олдсон/, "#6f96de"],
  [/тодорхойгүй/, "#ffffff"],
  [/гэмтс|хөнөөс/, "#a5a5a5"],
];
const statusHex = (v: string) => STATUS_RULES.find(([re]) => re.test(v.toLowerCase()))?.[1] ?? "#ffffff";
const tidy = (v: unknown) => s(v).replace(/\s+/g, " ") || "Бүртгэгдээгүй";
const bearStatus = (a: Attrs) => (tidy(a["хохирол"]) !== "Бүртгэгдээгүй" ? "Гэмтсэн, хөнөөсөн" : tidy(a["баталгаажилт"]));
const bear: Look = {
  fields: ["баталгаажилт", "хохирол"],
  points: (d) => {
    const st = d.attrs.map(bearStatus);
    return {
      cluster: false,
      adminLines: false,
      colors: st.map(statusHex),
      labels: {
        text: st.map((x) => (x === "Бүртгэгдээгүй" ? "" : x)),
        minzoom: zoomForScale(150_000),
        size: 7,
        halo: 1.4,
        colors: Object.fromEntries([...new Set(st)].map((x) => [x, statusHex(x)])),
      },
    };
  },
  overlays: async () => {
    const [khoroo, district] = await Promise.all([fetchUbKhoroos().catch(() => null), fetchUbDistricts().catch(() => null)]);
    const list: MapOverlay[] = [];
    if (khoroo)
      list.push({
        id: "ub-khoroos",
        data: khoroo,
        minzoom: zoomForScale(100_000),
        line: { color: "#c9b8ff", opacity: 0.55, width: 0.7, style: "dash" },
        label: { field: "name", size: 6.5, color: "#d9ceff", minzoom: zoomForScale(40_000) },
      });
    if (district)
      list.push({
        id: "ub-districts",
        data: district,
        line: { color: "#ffffff", opacity: 0.78, width: 1.2 },
        label: { field: "soum_name", size: 7.5, color: "#ffffff" },
      });
    return list;
  },
};

/* ---------------- Авран хамгаалсан амьтан (wildlife/rescues-dashboard.tsx) ---------------- */
const titleCase = (v: string) => (v ? v.charAt(0).toLocaleUpperCase("mn-MN") + v.slice(1).toLocaleLowerCase("mn-MN") : v);
const rescues: Look = {
  fields: ["зүйлийн_монгол_нэр", "латин_нэр"],
  points: (d) => {
    const species = d.attrs.map((a) => titleCase(s(a["зүйлийн_монгол_нэр"])) || "Тодорхойгүй");
    const marks: Record<number, string> = {};
    d.attrs.forEach((a, i) => {
      marks[d.oid[i]] = speciesPhoto(species[i], s(a["латин_нэр"]) || undefined) ?? speciesIconSvg(species[i]);
    });
    return { clusterLabel: "badge", marks, labels: { text: species, minzoom: 10 } };
  },
};

/* ---------------- Экологийн коридор (wildlife/eco-dashboard.tsx) ---------------- */
const ecoCorridor: Look = {
  fields: ["name", "талбай"],
  shapeOpts: { labelZoom: 9 },
  shape: (d) => {
    const order = d.oid.map((o, i) => [o, n(d.attrs[i]["талбай"]) || 0] as const).sort((x, y) => y[1] - x[1]);
    const ramp = spreadRamp(order.length);
    const color = new Map(order.map(([o], i) => [o, ramp[i]]));
    return (a, oid) => ({ c: color.get(oid), t: s(a.name) || "—" });
  },
};

/* ---------------- Цахилгааны шон (wildlife/poles-dashboard.tsx) — дараалсан шонгийн зай ---------------- */
const poleMeters = (a: [number, number], b: [number, number]) =>
  Math.hypot((b[0] - a[0]) * 111_320 * Math.cos((47.9 * Math.PI) / 180), (b[1] - a[1]) * 110_540);
const poles: Look = {
  fields: ["д_д", "байршил"],
  points: () => ({ cluster: false }),
  shapeOpts: { labelZoom: 13, labelPlacement: "line-center" },
  decor: async (d) => {
    const order = d.oid.map((_, i) => i).sort((x, y) => (n(d.attrs[x]["д_д"]) || 0) - (n(d.attrs[y]["д_д"]) || 0));
    const out: GeoJSON.Feature[] = [];
    for (let k = 1; k < order.length; k++) {
      const i = order[k - 1];
      const j = order[k];
      if (s(d.attrs[i]["байршил"]) !== s(d.attrs[j]["байршил"])) continue;
      const a: [number, number] = [d.lon[i], d.lat[i]];
      const b: [number, number] = [d.lon[j], d.lat[j]];
      out.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [a, b] },
        properties: { oid: DECOR + k, t: `${Math.round(poleMeters(a, b))} м` },
      });
    }
    return { shapes: out };
  },
};

/* ---------------- Шилэн барилга (wildlife/stickers-dashboard.tsx) ---------------- */
const stickers: Look = {
  fields: ["ner", "stiker"],
  points: (d) => {
    const done = new Set(d.oid.filter((_, i) => s(d.attrs[i].stiker) === "tiim"));
    return {
      cluster: false,
      pulse: true,
      pulseColor: (oid: number) => (done.has(oid) ? "var(--water)" : "var(--ochre)"),
      labels: { text: d.attrs.map((a) => s(a.ner) || "—"), minzoom: 13 },
    };
  },
};

/* ---------------- Тарвага (wildlife/marmots-dashboard.tsx) ---------------- */
const CATCH_PIN =
  '<svg data-pin="from" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" fill="#d39b35"/></svg>';
const RELEASE_PIN =
  '<svg data-pin="to" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#2e7f8b" stroke-width="1.6"/>' +
  '<circle cx="8" cy="8" r="2.5" fill="#2e7f8b"/></svg>';
const AGES = ["burkhi", "tarchi", "nagai", "khotil", "mundul"];
const marmotLinks = async () => {
  const data = await fetchMarmots();
  return {
    shapes: data.links.features.map((f) => ({
      ...f,
      properties: { ...f.properties, oid: DECOR + Number(f.properties?.oid ?? f.id) },
    })),
  };
};
const marmots = (caught: boolean): Look => ({
  fields: caught ? ["total_", ...AGES] : [],
  shapeOpts: { flow: true },
  decor: marmotLinks,
  points: (d) => ({
    cluster: false,
    marks: Object.fromEntries(d.oid.map((o) => [o, caught ? CATCH_PIN : RELEASE_PIN])),
    labels: caught
      ? {
          text: d.attrs.map((a) => {
            const t = typeof a.total_ === "number" ? a.total_ : AGES.reduce((m, k) => m + (n(a[k]) || 0), 0);
            return `${num(t)} тарвага`;
          }),
          minzoom: 8,
          offset: 1.9,
        }
      : undefined,
  }),
});

/* ---------------- Хаг (wildlife/lichens-dashboard.tsx) — цэг бүр бүртгэлийн цэгийнхээ зүйлийн тоогоор ---------------- */
const lichens: Look = {
  fields: ["site_code", "site_name", "rec_type"],
  points: (d) => {
    const per = new Map<string, number>();
    for (const a of d.attrs) if (s(a.rec_type) === "species") per.set(s(a.site_code), (per.get(s(a.site_code)) ?? 0) + 1);
    const values = Float32Array.from(d.attrs, (a) => per.get(s(a.site_code)) ?? 0);
    const hi = values.reduce((m, v) => Math.max(m, v), 0);
    return {
      cluster: false,
      pulse: true,
      grades: { values, stops: [[0, DATA_COLOR], [Math.max(hi, 1), DATA_COLOR]] },
      labels: { text: d.attrs.map((a) => s(a.site_name) || s(a.site_code)), minzoom: 9 },
    };
  },
};

/* ---------------- Хөвд, мөөг (wildlife/flora-dashboard.tsx) — зүйлийн тоогоор ---------------- */
const NEXT_NAME = /,\s+(?=[A-Z][A-Za-zÀ-ÿ.'-]*\s+[a-zà-ÿ])/;
const flora: Look = {
  fields: ["species", "site_name"],
  points: (d) => {
    const values = Float32Array.from(
      d.attrs,
      (a) =>
        s(a.species)
          .split(NEXT_NAME)
          .map((x) => x.trim().replace(/[.,;]+$/, ""))
          .filter(Boolean).length,
    );
    const hi = values.reduce((m, v) => Math.max(m, v), 0);
    return {
      cluster: false,
      pulse: true,
      grades: { values, stops: [[0, DATA_COLOR], [Math.max(hi, 1), DATA_COLOR]] },
      labels: { text: d.attrs.map((a) => s(a.site_name) || "Тодорхойгүй"), minzoom: 9 },
    };
  },
};

/* ---------------- Биотехник (wildlife/biotech-dashboard.tsx) ---------------- */
const biotech: Look = {
  fields: ["газрын_нэр"],
  points: (d) => ({ cluster: false, pulse: true, labels: { text: d.attrs.map((a) => s(a["газрын_нэр"]) || "Тодорхойгүй"), minzoom: 8 } }),
};

/* ---------------- Минж (wildlife/beaver-dashboard.tsx) ---------------- */
const ROUTE_COLOR = oklchHex(0.95, 0.05, 205);
const kindRamp = (count: number) =>
  count <= 1
    ? [DATA_COLOR]
    : Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        return oklchHex(0.9 - t * 0.42, 0.11 + t * 0.03, 195 + t * 33);
      });
const beaverObs: Look = {
  fields: ["ангилал"],
  points: (d) => {
    const kind = d.attrs.map((a) => s(a["ангилал"]).replace(/\s+/g, " ") || "Тодорхойгүй");
    const count = new Map<string, number>();
    for (const k of kind) count.set(k, (count.get(k) ?? 0) + 1);
    const keys = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
    const ramp = kindRamp(keys.length);
    const color = new Map(keys.map((k, i) => [k, ramp[i]]));
    return { cluster: false, colors: kind.map((k) => color.get(k)), labels: { text: kind, minzoom: 11 } };
  },
};
const beaverArea: Look = { shapeOpts: { crisp: true, color: DATA_COLOR } };
const beaverRoute: Look = { shapeOpts: { color: ROUTE_COLOR } };

/* ================= Порталын хуваалцсан самбар (layers/portal-dashboard.tsx) =================
   Ой, ногоон бүс, үнэлгээний сэдвүүд, Сонгинохайрханы судалгаа. Өнгө, шошгыг
   самбартай НЭГ өгөгдлөөс (`fetchLayerFeatures` — кэштэй) ба НЭГ дүрмээр
   (`breakdowns`, `labelParts`) бодно. */

const LABEL_ZOOM = zoomForScale(496_000);
const MAX_COLOR_VALUES = 12;

function categoryRamp(hue: number, count: number): string[] {
  if (count <= 1) return [oklchHex(0.74, 0.15, hue)];
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return oklchHex(0.88 - t * 0.42, 0.12 + Math.sin(t * Math.PI) * 0.05, hue);
  });
}

function measureText(v: number): string {
  if (Number.isInteger(v)) return num(v);
  if (Math.abs(v) >= 100) return num(Math.round(v));
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

async function portalLook(set: LayerSet, id: string, environment: boolean): Promise<Look> {
  const info = await fetchLayerInfo(set, id);
  const data = await fetchLayerFeatures(info);
  const charts = breakdowns(info, data);
  const labels = labelParts(info, data);
  const hue = set.hues[set.layers.indexOf(id) % set.hues.length];
  const point = info.geometry === "Point";
  const tone = set.plain?.includes(id) && point ? FIREFLY.mid : oklchHex(set.toneL ?? 0.74, set.toneC ?? 0.15, hue);

  /* Өнгөний талбар — самбарын `colorField`-тэй ижил дараалал */
  let field: string | null = null;
  if (!environment && !set.plain?.includes(id)) {
    const wanted = set.colorFields?.[id];
    const hit = wanted ? charts.find((c) => c.kind === "count" && !c.multi && (c.field === wanted || c.label === wanted)) : undefined;
    const first = charts.find((c) => c.kind === "count" && !c.multi);
    field = hit ? hit.field : first && first.values.length <= MAX_COLOR_VALUES ? first.field : null;
  }
  const b = field ? charts.find((c) => c.field === field && c.kind === "count") : undefined;
  let palette: { colors: Map<string, string>; keyOf: (row: Attrs) => string[] } | null = null;
  if (b) {
    const span = set.hueSpan?.[id];
    const count = b.values.length;
    const ramp = span
      ? b.values.map((_, i) => oklchHex(0.74, 0.15, count < 2 ? span[0] : span[0] + ((span[1] - span[0]) * i) / (count - 1)))
      : categoryRamp(hue, count);
    palette = {
      keyOf: b.keyOf,
      colors: new Map(
        b.values.map((v, i) => {
          const hex = set.valueColors?.[id]?.[v.key];
          if (hex) return [v.key, hex];
          const t = set.valueTones?.[id]?.[v.key];
          if (t) return [v.key, oklchHex(t[0], t[1], t[2])];
          const h = set.valueHues?.[id]?.[v.key];
          return [v.key, h == null ? ramp[i] : oklchHex(0.74, 0.15, h)];
        }),
      ),
    };
  }
  const colorOf = (oid: number) => {
    const row = data.rows[oid];
    return palette && row ? palette.colors.get(palette.keyOf(row)[0] ?? "") : undefined;
  };
  const group = charts.find((c) => c.kind === "count" && !c.multi && !c.top)?.field;
  const labelOf = (oid: number) => {
    const row = data.rows[oid];
    if (!row) return "";
    const lines: string[] = [];
    if (labels.name) {
      const v = categoryKey(row[labels.name]);
      if (v !== "Бүртгэгдээгүй") lines.push(v);
    } else if (set.splitZones && group) {
      const v = categoryKey(row[group]);
      if (v !== "Бүртгэгдээгүй") lines.push(v);
    }
    if (labels.measure) {
      const v = Number(row[labels.measure.field]);
      if (Number.isFinite(v)) lines.push(`${measureText(v)}${labels.measure.unit ? ` ${labels.measure.unit}` : ""}`);
    }
    return lines.join("\n");
  };
  const minzoom = set.labels ? LABEL_ZOOM : 24;
  let dots: MapProps["dots"];
  if (set.dots && palette) {
    const rank: Record<string, number> = {};
    for (const [k, r] of Object.entries(set.dots[id] ?? {})) {
      const hex = palette.colors.get(k);
      if (hex) rank[hex] = r;
    }
    dots = { rank };
  } else if (set.dots) dots = { rank: {} };

  return {
    points: (d) => {
      const colors = d.oid.map(colorOf);
      return {
        cluster: Boolean(set.cluster),
        clusterMaxZoom: set.clusterMaxZoom ?? 15,
        pointScale: set.pointScale,
        dots,
        colors: colors.some(Boolean) ? colors : undefined,
        labels: { text: d.oid.map(labelOf), minzoom },
      };
    },
    shapeOpts: {
      color: tone,
      labelZoom: minzoom,
      edge: set.thinEdge === "hair" ? "hair" : set.thinEdge ? "thin" : undefined,
      outline: set.shapeOutline !== false,
      crisp: environment,
      labelUnique: set.labelBy != null,
    },
    shape: () => (_a, oid) => ({ c: colorOf(oid) ?? tone, t: labelOf(oid) || null }),
  };
}

/* ---------------- Бүртгэл ---------------- */
const LOOKS: Record<string, Look> = {
  /* Саармагжуулалт (orchin/neutralization-dashboard.tsx): дохиоллын тэмдэг, хорооны нэр эсвэл цэгийн код */
  [NEUTRALIZATION_SERVICE]: {
    fields: ["kh_mon", "цэгийн_дугаар"],
    points: (d) => ({
      cluster: false,
      pulse: true,
      labels: { text: d.attrs.map((a) => s(a.kh_mon) || mnPointCode(s(a["цэгийн_дугаар"]))), minzoom: 0 },
    }),
  },
  [SOIL_SERVICES[0]]: soil("dugaar"),
  [SOIL_SERVICES[1]]: soil("tseg_num"),
  [PIT_SERVICE]: { points: (d) => ({ cluster: false, weights: new Array<number>(d.oid.length).fill(1), firefly: PIT_FIRE }) },
  [CITY_SERVICE]: {
    fields: ["duureg", "khorooid"],
    points: (d) => ({
      cluster: false,
      pulse: true,
      labels: {
        text: d.attrs.map((a) => {
          const du = s(a.duureg) || "Тодорхойгүй";
          return a.khorooid != null && a.khorooid !== "" ? `${du} ${a.khorooid}-р хороо` : du;
        }),
        minzoom: 11,
      },
    }),
  },
  [RECLAMATION_SERVICES[0]]: reclamation("aan"),
  [RECLAMATION_SERVICES[1]]: reclamation("tusuw"),
  [DAMAGED_SERVICE]: {
    fields: ["area_hec"],
    shapeOpts: { edge: "hair", labelZoom: 14 },
    shape: () => (a) => {
      const v = n(a.area_hec) || 0;
      return { t: `${v >= 1 ? v.toFixed(1) : v.toFixed(2)} га` };
    },
  },
  [PETITIONS_SERVICE]: {
    fields: ["бүртгэлийн_дугаар"],
    shapeOpts: { edge: "hair", labelZoom: 12 },
    shape: () => (a) => ({ t: s(a["бүртгэлийн_дугаар"]) || "—" }),
  },
  [LICENSES_SERVICE]: {
    fields: ["тусгай_дугаар"],
    shapeOpts: { edge: "hair", labelZoom: 11 },
    shape: () => (a) => ({ t: s(a["тусгай_дугаар"]) || "—" }),
  },
  [MINERALS_SERVICE]: minerals,
  [chemicalService(2023)]: chemicals,
  [chemicalService(2024)]: chemicals,
  [REPAIR_SERVICE]: repair,
  [serviceOf(LANDFILL, "аюултай_хог_хаягдал")]: waste(HAZARD_PIN),
  [serviceOf(LANDFILL, "энгийн_хог_хаягдал")]: waste(COMMON_PIN),
  [ASSESSMENT_SERVICES[0].url]: assessment,
  [ASSESSMENT_SERVICES[1].url]: assessment,
  [BOMT_SERVICE]: bomt,
  [BEAR_LAYER]: bear,
  [RESCUES_SERVICE]: rescues,
  [ECO_SERVICE]: ecoCorridor,
  [POLES_SERVICE]: poles,
  [STICKERS_SERVICE]: stickers,
  [MARMOT_SERVICES[0]]: marmots(true),
  [MARMOT_SERVICES[1]]: marmots(false),
  [LICHENS_SERVICE]: lichens,
  [`${layerService(FLORA.hovd.layer)}/0`]: flora,
  [`${layerService(FLORA.moog.layer)}/0`]: flora,
  [BIOTECH_SERVICE]: biotech,
  [layerService("A08_minj_ba_busad")]: beaverObs,
  [layerService("A08_minj_talbai")]: beaverArea,
  [layerService("A08_minj_marshrut")]: beaverRoute,
};

/** Хаяг нь дугаартай/дугааргүй ялгаатай байж болох тул төгсгөлийн `/N`-ийг харгалзахгүй */
function lookOf(url: string): Look | undefined {
  const bare = (u: string) => u.replace(/\/\d+$/, "");
  return LOOKS[url] ?? Object.entries(LOOKS).find(([k]) => bare(k) === bare(url))?.[1];
}

/** Давхаргын зургийн хэв — тусгай самбарынх, эс бөгөөс порталын самбарынх */
export async function lookFor(t: EditTarget): Promise<Look | undefined> {
  const own = lookOf(t.url);
  if (own) return own;
  if (t.layer) return portalLook(t.layer.set, t.layer.id, Boolean(t.layer.environment)).catch(() => undefined);
  return undefined;
}
