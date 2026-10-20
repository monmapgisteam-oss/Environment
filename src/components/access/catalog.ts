/*
  ЭРХИЙН ТОХИРГООНЫ ЦЭСНИЙ ЖАГСААЛТ — хэсэг бүрийн цэс (таб) нь тухайн
  ажлын талбарын ӨӨРИЙН `TABS`-аас (давхар бүртгэл үгүй: шинэ цэс нэмэгдэхэд
  тохиргоонд өөрөө гарна). Ажлын талбарын модулиуд самбаруудаа `dynamic()`
  -ээр ачаалдаг тул энд импортлоход самбарын код татагдахгүй.
*/
import { DEPARTMENTS } from "@/lib/departments";
import { ANALYSIS } from "@/lib/access";
import { VIEWS } from "@/components/analysis/workspace";
import { TABS as HYANALT } from "@/components/hyanalt/workspace";
import { TABS as NOGOON } from "@/components/nogoon-bus/workspace";
import { TABS as OI } from "@/components/oi/workspace";
import { GROUPS as ORCHIN_GROUPS, TABS as ORCHIN } from "@/components/orchin/workspace";
import { TABS as UNELGEE } from "@/components/unelgee/workspace";
import { GROUPS as WILDLIFE_GROUPS, TABS as WILDLIFE } from "@/components/wildlife/workspace";
import { FOREST_TABS } from "@/lib/forest-layers";
import { NOGOON_TABS } from "@/lib/nogoon-layers";
import { ECO, FLOOD, GAS, GREEN, WASTE } from "@/lib/unelgee-layers";
import { WILDLIFE_SOLO } from "@/lib/wildlife-layers";
import type { LayerSet } from "@/lib/portal-layers";

/**
 * `layers` — цэс порталын хуваалцсан самбараар зурагддаг бол түүний
 * давхаргууд: тэр цэсэд харагдах хэсэг, давхаргыг нарийвчлан тохируулна
 * ({@link src/lib/access.ts} `tabRule`). Тусгай самбартай цэст БАЙХГҮЙ.
 */
export type CatalogTab = { id: string; label: string; group?: string; layers?: { id: string; label: string }[] };
export type CatalogScope = { scope: string; label: string; tabs: CatalogTab[] };

type Raw = readonly { id: string; label: string; group?: string }[];
type Groups = readonly { id: string; label: string }[];

/** Цэс → порталын самбарын бүрдэл (самбарт `access` дамжуулсан цэсүүд) */
const SETS: Record<string, Record<string, LayerSet>> = {
  oi: FOREST_TABS,
  "nogoon-bus": NOGOON_TABS as Record<string, LayerSet>,
  "unelgee-uur-amisgal": { flood: FLOOD, green: GREEN, eco: ECO, waste: WASTE, gas: GAS },
  "amitan-urgamal": { monitoring: WILDLIFE_SOLO.songino },
};

const tabsOf = (raw: Raw, groups?: Groups, scope?: string): CatalogTab[] =>
  raw.map((t) => {
    const set = scope ? SETS[scope]?.[t.id] : undefined;
    return {
      id: t.id,
      label: t.label,
      group: groups?.find((g) => g.id === t.group)?.label,
      layers: set?.layers.map((id) => ({ id, label: set.names[id] ?? id })),
    };
  });

const TAB_LISTS: Record<string, CatalogTab[]> = {
  hyanalt: tabsOf(HYANALT),
  "nogoon-bus": tabsOf(NOGOON, undefined, "nogoon-bus"),
  oi: tabsOf(OI, undefined, "oi"),
  orchin: tabsOf(ORCHIN, ORCHIN_GROUPS),
  "unelgee-uur-amisgal": tabsOf(UNELGEE, undefined, "unelgee-uur-amisgal"),
  "amitan-urgamal": tabsOf(WILDLIFE, WILDLIFE_GROUPS, "amitan-urgamal"),
};

export const CATALOG: CatalogScope[] = [
  ...DEPARTMENTS.map((d) => ({
    scope: d.slug,
    label: d.name,
    tabs: TAB_LISTS[d.slug] ?? [],
  })),
  { scope: ANALYSIS, label: "Дүн шинжилгээ", tabs: tabsOf(VIEWS) },
];
