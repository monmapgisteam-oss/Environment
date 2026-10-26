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
import { tabLayers, type TabLayer } from "@/lib/access-layers";

/**
 * `layers` — хэлтсийн цэс бүрд: газрын зураг, давхарга, мэдээллийн самбарыг
 * нарийвчлан тохируулна ({@link src/lib/access.ts} `tabRule`). Дүн
 * шинжилгээ, гадаад холбоостой цэст БАЙХГҮЙ (3D харагдац, өөр систем).
 */
export type CatalogTab = { id: string; label: string; group?: string; layers?: TabLayer[] };
export type CatalogScope = { scope: string; label: string; tabs: CatalogTab[] };

type Raw = readonly { id: string; label: string; group?: string; href?: string }[];
type Groups = readonly { id: string; label: string }[];

const tabsOf = (raw: Raw, groups?: Groups, scope?: string): CatalogTab[] =>
  raw.map((t) => ({
    id: t.id,
    label: t.label,
    group: groups?.find((g) => g.id === t.group)?.label,
    layers: scope && !t.href ? tabLayers(scope, t.id) : undefined,
  }));

const TAB_LISTS: Record<string, CatalogTab[]> = {
  hyanalt: tabsOf(HYANALT, undefined, "hyanalt"),
  "nogoon-bus": tabsOf(NOGOON, undefined, "nogoon-bus"),
  oi: tabsOf(OI, undefined, "oi"),
  orchin: tabsOf(ORCHIN, ORCHIN_GROUPS, "orchin"),
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
