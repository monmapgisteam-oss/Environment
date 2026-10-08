"use client";

import * as React from "react";
import { asset } from "@/lib/base-path";

/* --------------------------------------------------------------------------
   ҮЕРИЙН СИМУЛЯЦИ — ТУСДАА ВЭБ АПП, IFRAME-ЭЭР

   Хэрэглэгч 2026-10-08: `I:/Environment/Flood_envi/Flood_envi`-ийн
   үерийн загварыг "Хотын тархалт"-ын ард шинэ товчоор оруулах.
   Эх нь өөр хүний бичсэн бие даасан апп (2D гүехэн усны GPU загвар,
   ArcGIS SDK 4.34, WebGL2) — `web/` хавтас нь `public/flood/`-д хуулагдсан.
   2026-10-08-аас `public/flood/` нь ЖИНХЭНЭ ЭХ: засвар энд хийгдэнэ,
   эх репогоос дахин хуулж дарж бичихгүй.

   ⚠⚠ ЯАГААД IFRAME:
   · Платформ Esri SDK 4.33-ыг AMD-аар ачаалдаг (`lib/arcgis-sdk.ts`), энэ
     апп 4.34-ийг өөрөө ачаална — нэг баримтад хоёр хувилбар зөрчилдөнө.
   · Апп өөрийн WebGL контекст, `100vh` бүтэц, глобал CSS-тэй.
   · Аппын код платформын React, Tailwind-аас тусдаа үлдэж, засвар нь
     зөвхөн `public/flood/` дотор хийгдэнэ.
   ⚠ Апп нь бүх замаа ХАРЬЦАНГУЙгаар (`data/…`, `js/…`) уншдаг тул
   `/flood/index.html`-ээс зөв ажиллана; `asset()` нь GitHub Pages-ийн
   дэд замыг нэмнэ.

   ⚠ СЭДЭВ: апп өөрийн `flood-theme`-ийг уншдаг. Нэг origin тул
   ачаалахын ӨМНӨ платформын сэдвийг тэнд бичиж, дараа нь платформын
   `data-theme` солигдоход аппын өөрийн сэлгэх товчийг дарна — тэр нь
   Esri-ийн CSS, диаграмыг хамт солино.
   -------------------------------------------------------------------------- */

const SRC = asset("/flood/index.html");

const theme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function FloodView() {
  const frame = React.useRef<HTMLIFrameElement>(null);
  /* ⚠ Сэдвийг iframe үүсэхээс ӨМНӨ бичнэ — эс тэгвээс эхний зурагдалт
     хуучин сэдвээр гарч анивчина. Анхны зурагдалтад нэг удаа. */
  const [ready] = React.useState(() => {
    try {
      localStorage.setItem("flood-theme", theme());
    } catch {
      /* хадгалалт хаалттай — апп системийн горимоор */
    }
    return true;
  });

  React.useEffect(() => {
    const sync = () => {
      const doc = frame.current?.contentDocument;
      if (!doc?.documentElement || doc.documentElement.dataset.theme === theme()) return;
      (doc.getElementById("themeToggle") as HTMLButtonElement | null)?.click();
    };
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-xs border border-line bg-paper-2">
      {ready ? (
        <iframe
          ref={frame}
          src={SRC}
          title="Үерийн симуляци"
          className="block h-full w-full border-0"
          allow="fullscreen"
        />
      ) : null}
    </div>
  );
}
