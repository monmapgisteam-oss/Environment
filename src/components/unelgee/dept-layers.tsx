"use client";

import * as React from "react";
import { Database, Loader2 } from "lucide-react";
import type { MapOverlay } from "@/components/wells/map";
import { oklchHex } from "@/components/wells/colors";
import { useAccess } from "@/components/auth/access";
import { ASSESSMENT_YEARS, fetchAssessments } from "@/lib/assessment";
import { fetchBomt } from "@/lib/bomt";
import { fetchLayerFeatures, fetchLayerInfo, type LayerSet } from "@/lib/portal-layers";
import { ECO, FLOOD, GAS, GREEN, WASTE } from "@/lib/unelgee-layers";
import { cn } from "@/lib/utils";

/*
  ҮНЭЛГЭЭНИЙ ХЭЛТСИЙН БҮХ БҮРТГЭЛ — НЭГ ЗУРАГТ
  (хэрэглэгч 2026-11-02: "basemap iconii door layer nemeed ene heltes deer
  bgaa datag neej harah baidlaar tohiruul"). Хэлтсийн найман цэс тус бүр
  өөрийн дүрсийг л зурдаг байв; "үерийн эрсдэлтэй талбайд ямар үнэлгээ
  гарсан бэ", "ногоон байгууламж хогийн цэгтэй давхцаж байна уу" гэдэг нь
  нэг зураг дээр л уншигдана. Суурь зургийн товчны ДООР "Давхарга" товч —
  хэлтсийн 22 бүртгэлийг (ерөнхий үнэлгээ хоёр он · менежментийн
  төлөвлөгөө · үерийн эрсдэл 7 · ногоон байгууламж 2 · эко-инфраструктур 8 ·
  хог хаягдлын цэг 2 · хийн төхөөрөмж 1) цэсээрээ бүлэглэж асаах, унтраах;
  одоогийн самбарынх үргэлж асаалттай ("Энэ самбар").

  Хүрээлэн буй орчны хэлтсийн `MineralLayers`-тэй нэг зарчим.
  ⚠ Давхарга нь АСААХ ҮЕДЭЭ л татагдана, амлалтаар кэшлэгдэнэ. Порталын
  давхарга самбарын өөрийн кэштэй (`portal-layers`) ХУВААЛЦДАГ — давхар
  татагдахгүй; ерөнхий үнэлгээ, менежментийн төлөвлөгөө өөрийн сангаар.
  ⚠ Нэмэлт давхарга нь зөвхөн ХҮРЭЭ, ДҮҮРГЭЛТ — товшигдохгүй, шошгогүй;
  самбарын өөрийн дүрс харилцдаг хэвээр, түүний дээр зурагдана. Цэгэн
  давхарга жижиг цэгээр, шугам зураасаар.
  ⚠ Өнгө нь ТУХАЙН САМБАР ДЭЭРХ ӨНГӨ (`LayerSet.hues/toneL/toneC`-оос нэг
  томьёогоор) — нэг давхарга хоёр самбарт өөр өнгөөр гарахгүй. Ерөнхий
  үнэлгээ, менежментийн төлөвлөгөөнд өөрийн тогтмол өнцөг (хэлтсийн ягаан
  гэр бүл, амбер) — тэдний самбар ангиллаар будагддаг тул нэг өнгө байхгүй.
  ⚠ ЭРХИЙГ ДАГАНА: хэрэглэгчид хаалттай цэсийн бүртгэл жагсаалтад ОРОХГҮЙ
  (`allowsTab`), цэсийн давхаргын нарийвчлал (`@l:`) мөн үйлчилнэ — энэ
  товч эрхийн хязгаарыг тойрох зам болохгүй.
*/

export const UNELGEE_SCOPE = "unelgee-uur-amisgal";

type Entry = {
  id: string;
  label: string;
  color: string;
  load: () => Promise<GeoJSON.FeatureCollection>;
};

type Group = {
  /** Ажлын талбарын цэс — эрхийн шалгалт энэ түлхүүрээр */
  tab: string;
  title: string;
  /** Порталын бүрдэл (давхаргын нарийвчилсан эрх түүний давхаргаар) */
  set?: LayerSet;
  entries: Entry[];
};

const tone = (set: LayerSet, i: number) =>
  oklchHex(set.toneL ?? 0.74, set.toneC ?? 0.15, set.hues[i % set.hues.length]);

function portalGroup(tab: string, title: string, set: LayerSet): Group {
  return {
    tab,
    title,
    set,
    entries: set.layers.map((id, i) => ({
      id,
      label: set.names[id] ?? id,
      color: tone(set, i),
      load: () =>
        fetchLayerInfo(set, id)
          .then((info) => fetchLayerFeatures(info))
          .then((d) => d.shapes),
    })),
  };
}

const GROUPS: Group[] = [
  {
    tab: "unelgee",
    title: "Байгаль орчны нөлөөллийн ерөнхий үнэлгээ",
    entries: ASSESSMENT_YEARS.map((year, i) => ({
      id: `assess-${year}`,
      label: `Ерөнхий үнэлгээ (${year} он)`,
      color: oklchHex(0.74, 0.15, i % 2 ? 320 : 345),
      load: () => fetchAssessments(year).then((d) => d.shapes),
    })),
  },
  {
    tab: "bomt",
    title: "Байгаль орчны менежментийн төлөвлөгөө",
    entries: [
      {
        id: "bomt",
        label: "Менежментийн төлөвлөгөө (2026 он)",
        color: oklchHex(0.74, 0.15, 60),
        load: () => fetchBomt().then((d) => d.shapes),
      },
    ],
  },
  portalGroup("flood", "Үерийн эрсдэл", FLOOD),
  portalGroup("green", "Ногоон байгууламж", GREEN),
  portalGroup("eco", "Эко-инфраструктур", ECO),
  portalGroup("waste", "Хог хаягдлын цэг", WASTE),
  portalGroup("gas", "Хийн тоног төхөөрөмж", GAS),
];

const ENTRIES = new Map<string, Entry>(GROUPS.flatMap((g) => g.entries.map((e) => [e.id, e] as const)));

const cache = new Map<string, Promise<GeoJSON.FeatureCollection>>();

function load(e: Entry): Promise<GeoJSON.FeatureCollection> {
  let p = cache.get(e.id);
  if (p) return p;
  p = e.load();
  /* Унасан амлалт кэшид үлдэхгүй — дахин оролдох боломжтой */
  p.catch(() => cache.delete(e.id));
  cache.set(e.id, p);
  return p;
}

/** Давхаргын тэмдэг — `MapOverlay.id` */
const key = (id: string) => `dept-${id}`;

/** Асаалттай нэмэлт давхаргуудаас `MapOverlay`-ууд */
function overlayOf(e: Entry, data: GeoJSON.FeatureCollection): MapOverlay {
  return {
    id: key(e.id),
    data,
    fill: { color: e.color, opacity: 0.18 },
    line: { color: e.color, opacity: 0.9, width: 1 },
  };
}

export function UnelgeeLayers({
  current,
  value,
  onChange,
  placement = "top-right",
  inline = false,
}: {
  /** Энэ самбарын өөрийн бүртгэл(үүд) — үргэлж асаалттай, унтраагдахгүй */
  current: readonly string[];
  value: MapOverlay[];
  onChange: (v: MapOverlay[]) => void;
  /** Суурь зургийн товчны тал — цонх тэр тал руугаа наалдана */
  placement?: "top-right" | "top-left";
  /**
   * Эцэг нь аль хэдийн суурь зургийн доорх товчны баганад байрлуулсан
   * (порталын самбар) — өөрөө `absolute` байрлахгүй, тэр баганын товчны
   * хэмжээтэй (32px).
   */
  inline?: boolean;
}) {
  const { allowsTab, tabRule } = useAccess();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const holder = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  /* Эрхтэй цэс, эрхтэй давхарга л жагсаалтад */
  const groups = React.useMemo(
    () =>
      GROUPS.filter((g) => allowsTab(UNELGEE_SCOPE, g.tab))
        .map((g) => {
          const rule = tabRule(UNELGEE_SCOPE, g.tab);
          const entries = g.set && rule.layers ? g.entries.filter((e) => rule.layers!.includes(e.id)) : g.entries;
          return { ...g, entries };
        })
        .filter((g) => g.entries.length),
    [allowsTab, tabRule],
  );

  const on = new Set(value.map((o) => o.id));

  async function toggle(e: Entry) {
    if (on.has(key(e.id))) {
      onChange(value.filter((o) => o.id !== key(e.id)));
      return;
    }
    setBusy(e.id);
    setFailed(null);
    try {
      const data = await load(e);
      const next = [...value, overlayOf(e, data)];
      /* Дараалал жагсаалтынх — асаасан дарааллаас үл хамааран нэг зурагдалт */
      const order = [...ENTRIES.keys()];
      next.sort((a, b) => order.indexOf(a.id.slice(5)) - order.indexOf(b.id.slice(5)));
      onChange(next);
    } catch {
      setFailed(e.id);
    } finally {
      setBusy(null);
    }
  }

  const extra = value.length;
  const left = placement === "top-left";

  return (
    /* Чөлөөт байрлалд бариул нь зургийн ёроол хүртэл сунана (`bottom-2.5`) — цонх
       `max-h`-ээ түүнээс авч зургаас халихгүй; бариул өөрөө товшилт барихгүй */
    <div
      ref={holder}
      className={cn(
        inline
          ? "relative"
          : cn("pointer-events-none absolute top-[46px] bottom-2.5 z-20 flex flex-col", left ? "left-2.5 items-start" : "right-2.5 items-end"),
      )}
    >
      {/* Суурь зургийн товчтой нэг загвар, яг доор нь; порталын баганад
          хөршүүдтэйгээ (шошгын унтраалга, давхаргын сонголт) ижил 32px */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Хэлтсийн давхарга"
        aria-label="Хэлтсийн давхарга"
        aria-expanded={open}
        className={cn(
          "elevated pointer-events-auto relative flex items-center justify-center rounded-xs border transition-colors",
          inline ? "size-8 backdrop-blur-md" : "size-7 backdrop-blur",
          open || extra
            ? "border-data/50 bg-data/15 text-data"
            : cn(inline ? "border-line bg-paper/85 text-ink-3" : "border-line-2 bg-paper/90 text-ink-2", "hover:bg-paper-hi hover:text-ink"),
        )}
      >
        <Database size={14} strokeWidth={1.75} />
        {extra ? (
          <span className="num absolute -top-1 -right-1 rounded-full bg-data px-1 text-[9px] leading-[1.4] font-medium text-paper">
            {extra}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={cn(
            "elevated pointer-events-auto absolute z-20 w-[280px] overflow-y-auto rounded-xs border border-line-2 bg-paper-2 p-2",
            inline ? "top-[calc(100%+5px)] max-h-[min(60vh,520px)]" : "top-[33px] max-h-[calc(100%-33px)]",
            left ? "left-0" : "right-0",
          )}
        >
          <div className="eyebrow mb-1.5">Хэлтсийн давхарга</div>
          <div className="divide-y divide-line">
            {groups.map((g) => (
              <div key={g.tab} className="py-1.5 first:pt-0 last:pb-0">
                <div className="mb-0.5 truncate px-1 text-[10px] leading-[1.4] text-ink-3" title={g.title}>
                  {g.title}
                </div>
                <div className="space-y-0.5">
                  {g.entries.map((e) => {
                    const mine = current.includes(e.id);
                    const checked = mine || on.has(key(e.id));
                    return (
                      <label
                        key={e.id}
                        className={cn(
                          "flex items-center gap-2 rounded-xs px-1 py-1 transition-colors",
                          mine ? "cursor-default" : "cursor-pointer hover:bg-paper-hi",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={mine || busy === e.id}
                          onChange={() => toggle(e)}
                          className="size-3 shrink-0 accent-[var(--data)]"
                        />
                        <span aria-hidden className="size-2.5 shrink-0 rounded-[1px]" style={{ background: e.color }} />
                        <span className="min-w-0 flex-1 truncate text-[11.5px] leading-none text-ink" title={e.label}>
                          {e.label}
                        </span>
                        {busy === e.id ? (
                          <Loader2 size={10} className="shrink-0 animate-spin text-ink-3" />
                        ) : mine ? (
                          <span className="shrink-0 text-[10px] text-ink-3">Энэ самбар</span>
                        ) : failed === e.id ? (
                          <span className="shrink-0 text-[10px] text-clay">Татагдсангүй</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
