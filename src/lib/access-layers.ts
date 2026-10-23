/*
  ЦЭС БҮРИЙН ДАВХАРГЫН ЖАГСААЛТ — эрхийн нарийвчлалд (хэрэглэгч 2026-10-23:
  "бусад хэлтсийн цэсэнд харах мэдээлэл 1. газрын зураг 2. давхарга 3. самбар").
  · Порталын хуваалцсан самбартай цэс (`portalSet`) — давхарга нь бүрдлийн
    ҮЙЛЧИЛГЭЭНИЙ НЭРЭЭР; хязгаарлалтыг `PortalLayersDashboard` өөрөө хийнэ.
  · Тусгай самбартай цэс — давхарга нь засварлагчийн бүртгэлийн ХАЯГААР
    ({@link src/lib/edit-targets.ts}); хориглосон хаягийг `arcgisJson` татахгүй
    ({@link deniedLayer}).
  ⚠ Ажлын талбарын модулийг ИМПОРТЛОХГҮЙ: тэд эрхийн боодлыг (`TabAccess`)
  импортлодог тул тойрог импорт үүсч `TABS` тодорхойгүй болно.
*/
import { editTargets } from "@/lib/edit-targets";
import { FOREST_TABS } from "@/lib/forest-layers";
import { NOGOON_TABS } from "@/lib/nogoon-layers";
import type { LayerSet } from "@/lib/portal-layers";
import { ECO, FLOOD, GAS, GREEN, WASTE } from "@/lib/unelgee-layers";
import { WILDLIFE_SOLO } from "@/lib/wildlife-layers";

/** Цэс → порталын самбарын бүрдэл (самбарт `access` дамжуулсан цэсүүд) */
const SETS: Record<string, Record<string, LayerSet>> = {
  oi: FOREST_TABS,
  "nogoon-bus": NOGOON_TABS as Record<string, LayerSet>,
  "unelgee-uur-amisgal": { flood: FLOOD, green: GREEN, eco: ECO, waste: WASTE, gas: GAS },
  "amitan-urgamal": { monitoring: WILDLIFE_SOLO.songino },
};

export function portalSet(scope: string, tab: string): LayerSet | undefined {
  return SETS[scope]?.[tab];
}

export type TabLayer = { id: string; label: string };

export function tabLayers(scope: string, tab: string): TabLayer[] {
  const set = portalSet(scope, tab);
  if (set) return set.layers.map((id) => ({ id, label: set.names[id] ?? id }));
  const seen = new Set<string>();
  return editTargets(scope, tab)
    .filter((t) => !seen.has(t.url) && seen.add(t.url))
    .map((t) => ({ id: t.url, label: t.title }));
}
