"use client";

import * as React from "react";
import { setDeniedLayers, viewAllowed } from "@/lib/access";
import { portalSet, tabLayers } from "@/lib/access-layers";
import { useAccess } from "@/components/auth/access";
import { cn } from "@/lib/utils";

/*
  ЦЭСИЙН НАРИЙВЧИЛСАН ЭРХИЙН БООДОЛ — тусгай самбартай цэст (хэрэглэгч
  2026-10-23: "бусад хэлтсийн цэсэнд харах мэдээлэл 1. газрын зураг
  2. давхарга 3. самбар"). Ажлын талбар самбараа үүгээр ороож дуудна.
  · ГАЗРЫН ЗУРАГ — `WellsMap` нь `useMapAllowed()`-ийг уншиж, хаалттай бол
    оронд нь блок зурна.
  · ДАВХАРГА — хориглосон хаягийг `arcgisJson` татахгүй; самбар тэр
    давхаргын алдааг өөрийн хэлбэрээр харуулна.
  · МЭДЭЭЛЛИЙН САМБАР — газрын зургаас бусад бүхнийг нууна
    (`.access-nodb`, {@link src/app/workspace.css}). Самбар бүр өөр бүтэцтэй
    тул CSS-ийн `visibility`-ээр ерөнхийд нь — зураг байрандаа үлдэнэ.
  ⚠ Порталын хуваалцсан самбартай цэст (`portalSet`) давхарга, самбарыг
  `PortalLayersDashboard` өөрөө хасна — энд зөвхөн газрын зургийн туг.
  ⚠ Хориглолтыг `useLayoutEffect`-ээр тавина: хүүхдийн татах эффект
  (`useEffect`) бүгд түүний ДАРАА ажиллана. Дүрэм солигдоход самбар `key`-ээр
  дахин үүснэ.
*/

const MapAllowed = React.createContext(true);

/** Энэ цэсэд газрын зураг харах эрхтэй юу */
export const useMapAllowed = () => React.useContext(MapAllowed);

export function TabAccess({ scope, tab, children }: { scope: string; tab: string; children: React.ReactNode }) {
  const { tabRule } = useAccess();
  const rule = tabRule(scope, tab);
  const portal = !!portalSet(scope, tab);
  const deny = React.useMemo(
    () => (portal || !rule.layers ? [] : tabLayers(scope, tab).map((l) => l.id).filter((id) => !rule.layers!.includes(id))),
    [portal, rule.layers, scope, tab],
  );
  const map = viewAllowed(rule, "map");
  const db = portal || viewAllowed(rule, "db");
  const key = `${tab}:${deny.join("|")}:${map}:${db}`;

  React.useLayoutEffect(() => {
    setDeniedLayers(deny);
    return () => setDeniedLayers([]);
  }, [deny]);

  return (
    <MapAllowed.Provider value={map}>
      <div key={key} className={cn("contents", !db && "access-nodb")}>
        {children}
      </div>
    </MapAllowed.Provider>
  );
}
