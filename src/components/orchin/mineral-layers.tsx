"use client";

import * as React from "react";
import { Layers, Loader2 } from "lucide-react";
import type { MapOverlay } from "@/components/wells/map";
import { fetchDamaged } from "@/lib/damaged";
import { fetchLicenses } from "@/lib/licenses";
import { fetchMinerals } from "@/lib/minerals";
import { fetchPetitions } from "@/lib/petitions";
import { fetchReclamation } from "@/lib/reclamation";
import { cn } from "@/lib/utils";

/*
  ТҮГЭЭМЭЛ ТАРХАЦТАЙ АШИГТ МАЛТМАЛЫН ТАВАН БҮРТГЭЛ — НЭГ ЗУРАГТ
  (хэрэглэгч 2026-11-02: "basemap iconii door dawharga heseg shineer uusgeed
  zurag 5 feature untraaj asaaj hardag bolgo"). Бүлгийн таван самбар
  (зөвшөөрөл · нүүрс, алтны талбай · өргөдөл · эвдэрсэн газар · нөхөн
  сэргээлт) тус бүр өөрийн дүрсийг л зурдаг байв; "зөвшөөрөл өргөдөлтэй
  давхцаж байна уу", "эвдэрсэн газар нөхөн сэргээгдсэн үү" гэдэг нь нэг
  зураг дээр л уншигдана. Суурь зургийн товчны ДООР "Давхарга" товч —
  бусад дөрвийг асаах, унтраах; одоогийн самбарынх үргэлж асаалттай.

  ⚠ Давхарга нь АСААХ ҮЕДЭЭ л татагдана (эвдэрсэн газар ~1 МБ), амлалтаар
  кэшлэгдэнэ — унтрааж асаахад дахин татахгүй. Самбарын өөрийн татацтай
  хуваалцахгүй (санууд кэшгүй) — нэг удаа давхар татагдана.
  ⚠ Нэмэлт давхарга нь зөвхөн ХҮРЭЭ, ДҮҮРГЭЛТ — товшигдохгүй, шошгогүй:
  самбарын өөрийн дүрс нь харилцдаг давхарга хэвээр, түүний дээр зурагдана.
  ⚠ Өнгө нь бүртгэлийн ТАНИХ ТЭМДЭГ (тогтмол hex — зураг горимоос үл
  хамаарна): нэг гэрэлтэлт, ханалттай, өнцгөөрөө л ялгаатай; дохионы улаан,
  шар өнцгийг аваагүй. Цонхны мөр бүр өнгөт дөрвөлжинтэй тул тайлбарын
  үүргийг давхар гүйцэтгэнэ.
*/

export type MineralLayerId = "licenses" | "minerals" | "petitions" | "damaged" | "reclamation";

const LAYERS: { id: MineralLayerId; label: string; color: string }[] = [
  { id: "licenses", label: "Ашигт малтмалын зөвшөөрөл", color: "#5fc8e8" },
  { id: "minerals", label: "Нүүрс, алтны талбай", color: "#d9b24f" },
  { id: "petitions", label: "Өргөдлийн бүртгэл", color: "#c39cf0" },
  { id: "damaged", label: "Эвдэрсэн газар", color: "#e39a7a" },
  { id: "reclamation", label: "Нөхөн сэргээлт", color: "#7fcf8e" },
];

const cache = new Map<MineralLayerId, Promise<GeoJSON.FeatureCollection>>();

function load(id: MineralLayerId): Promise<GeoJSON.FeatureCollection> {
  let p = cache.get(id);
  if (p) return p;
  switch (id) {
    case "licenses":
      p = fetchLicenses().then((d) => d.shapes);
      break;
    case "minerals":
      p = fetchMinerals().then((d) => d.shapes);
      break;
    case "petitions":
      p = fetchPetitions().then((d) => d.shapes);
      break;
    case "damaged":
      p = fetchDamaged().then((d) => d.shapes);
      break;
    case "reclamation":
      /* Нөхөн сэргээлт булангийн цэгээс угсарсан цагирагтай — самбартай нэг дүрс */
      p = fetchReclamation().then((sites) => ({
        type: "FeatureCollection",
        features: sites
          .filter((s) => s.rings.length > 0)
          .map((s) => ({
            type: "Feature" as const,
            id: s.oid,
            properties: { oid: s.oid },
            geometry: { type: "MultiPolygon" as const, coordinates: s.rings.map((r) => [r]) },
          })),
      }));
      break;
  }
  /* Унасан амлалт кэшид үлдэхгүй — дахин оролдох боломжтой */
  p.catch(() => cache.delete(id));
  cache.set(id, p);
  return p;
}

/** Давхаргын тэмдэг — `MapOverlay.id` */
const key = (id: MineralLayerId) => `mineral-${id}`;

export function MineralLayers({
  current,
  value,
  onChange,
}: {
  /** Энэ самбарын өөрийн бүртгэл — үргэлж асаалттай, унтраагдахгүй */
  current: MineralLayerId;
  value: MapOverlay[];
  onChange: (v: MapOverlay[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<MineralLayerId | null>(null);
  const [failed, setFailed] = React.useState<MineralLayerId | null>(null);
  const holder = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const on = new Set(value.map((o) => o.id));

  async function toggle(def: (typeof LAYERS)[number]) {
    if (on.has(key(def.id))) {
      onChange(value.filter((o) => o.id !== key(def.id)));
      return;
    }
    setBusy(def.id);
    setFailed(null);
    try {
      const data = await load(def.id);
      const next = [
        ...value,
        {
          id: key(def.id),
          data,
          fill: { color: def.color, opacity: 0.18 },
          line: { color: def.color, opacity: 0.9, width: 1 },
        },
      ];
      /* Дараалал жагсаалтынх — асаасан дарааллаас үл хамааран нэг зурагдалт */
      next.sort(
        (a, b) =>
          LAYERS.findIndex((d) => key(d.id) === a.id) - LAYERS.findIndex((d) => key(d.id) === b.id),
      );
      onChange(next);
    } catch {
      setFailed(def.id);
    } finally {
      setBusy(null);
    }
  }

  const extra = LAYERS.filter((d) => d.id !== current && on.has(key(d.id))).length;

  return (
    <div ref={holder} className="absolute top-[46px] right-2.5 z-20">
      {/* Суурь зургийн товчтой (28px, `rounded-xs`, `elevated`) нэг загвар — яг доор нь */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Давхарга"
        aria-label="Давхарга"
        aria-expanded={open}
        className={cn(
          "elevated relative flex size-7 items-center justify-center rounded-xs border border-line-2 backdrop-blur transition-colors",
          open || extra ? "map-tint text-data" : "bg-paper/90 text-ink-2 hover:bg-paper-hi hover:text-ink",
        )}
      >
        <Layers size={14} strokeWidth={1.75} />
        {extra ? (
          <span className="num absolute -top-1 -right-1 rounded-full bg-data px-1 text-[9px] leading-[1.4] font-medium text-paper">
            {extra}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="elevated absolute top-[calc(100%+5px)] right-0 w-[236px] rounded-xs border border-line-2 bg-paper-2 p-2">
          <div className="eyebrow mb-2">Давхарга</div>
          <div className="space-y-0.5">
            {LAYERS.map((d) => {
              const mine = d.id === current;
              const checked = mine || on.has(key(d.id));
              return (
                <label
                  key={d.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xs px-1 py-1 transition-colors",
                    mine ? "cursor-default" : "cursor-pointer hover:bg-paper-hi",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={mine || busy === d.id}
                    onChange={() => toggle(d)}
                    className="size-3 shrink-0 accent-[var(--data)]"
                  />
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-[1px]"
                    style={{ background: d.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] leading-none text-ink">
                    {d.label}
                  </span>
                  {busy === d.id ? (
                    <Loader2 size={10} className="shrink-0 animate-spin text-ink-3" />
                  ) : mine ? (
                    <span className="shrink-0 text-[10px] text-ink-3">Энэ самбар</span>
                  ) : failed === d.id ? (
                    <span className="shrink-0 text-[10px] text-clay">Татагдсангүй</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
