"use client";

import * as React from "react";
import { CloudRain, Droplets, Loader2, Pause, Play, RotateCcw, Waves } from "lucide-react";
import { cn, ratioText } from "@/lib/utils";
import { Columns } from "@/components/ui/resizable-columns";
import { Card } from "@/components/analysis/ui";
import { esriModules } from "@/lib/arcgis-sdk";
import { fetchSoilProfile } from "@/lib/soil-profile";
import { SOIL_EXAGGERATION, SOIL_MODULES, createSoilScene, type Section, type SoilScene as Handle } from "@/lib/soil-scene";
import { SectionCard } from "@/components/analysis/soil-section";
import { PlumeBar, usePlumePlayback } from "@/components/analysis/soil-scene";
import { INNER_X, PLUME_X, type PlumeState } from "@/lib/soil-plumes";
import { FLOOD_PRESETS, createSoilFlood } from "@/lib/flood/soil-live.js";

/* --------------------------------------------------------------------------
   ҮЕР БА НЭВЧИЛТ — хөрсний блокийн гадарга дээр үерийн ус ШУУД урсана

   Хэрэглэгч 2026-10-12: "odoo gazriin gadarga deer uyer hewiin shuud ursana
   buyu uyriin simulation button deer daraad hardag ni gsn ug yg ijilhen
   ursana okey odoogiin simulation del hii". Хөрсний зүсэлтийн SceneView ТЭР
   ЧИГЭЭРЭЭ ({@link createSoilScene}: блок, зүсэлтийн хэрэгсэл, таглаа),
   дээр нь "Үерийн симуляци"-ийн шийдэгч ба 3D ус ({@link createSoilFlood},
   `lib/flood/soil-live.js`) — "Эхлүүлэх" дарахад ус тэр мөчөөс блок дээр
   урсаж эхэлнэ (1 с = 2 мин), түр зогсоож, эхнээс нь эхлүүлнэ.
   ⚠⚠ Урьдын хот даяарх 60 м-ийн толгойгүй тооцоо, агшин хадгалах, тоглуулах
   таймлайн, зүсэлтийн нүүрний бохирдлын шингээлт (`lib/soil-flood.ts`)
   УСТСАН — git түүхэнд бий.

   ⚠⚠ ЖОРЛОНГИЙН БОХИРДЛЫН НЭВЧИЛТ (хэрэглэгч 2026-10-12: "jorlon layer
   asaaj bgaad duriin gazriig zurah eswel zuseh tohioldold bohirdol … yaj
   dooshoo newchij bgaag harna") — "Хөрсний зүсэлт"-тэй НЭГ механизм
   (`createPlumes`, {@link PlumeBar}). Давхаргын асаалтаас ҮЛ ХАМААРНА —
   зүсэх, зурах бүрд гарна (хэрэглэгч мөн өдөр: "urgelj asaalttai").

   ⚠ Бүрэлдэхүүн хөдөлгүүрээ ГАНЦ УДАА үүсгэнэ (`[]` хамаарал).
   ⚠ Босоо өсгөлт ×800 ИЛ бичигдэнэ (хөрс), усны гүн БОДИТ — доод мөрөнд.
   -------------------------------------------------------------------------- */

type State = "loading" | "ready" | { error: string };

type FloodState = {
  phase: "idle" | "loading" | "ready" | "error";
  message: string;
  running: boolean;
  preset: string;
  t: number;
  tEnd: number;
  grid: { w: number; h: number; dx: number } | null;
  stats: { wetHa: number; hmax: number; vol: number; rainMm: number } | null;
};

type Engine = {
  preload: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => void;
  reset: () => void;
  setPreset: (id: string) => void;
  destroy: () => void;
};

const fmtT = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ц ${String(m % 60).padStart(2, "0")} мин`;
};

export function FloodSoilView() {
  const holder = React.useRef<HTMLDivElement>(null);
  const scene = React.useRef<Handle | null>(null);
  const engine = React.useRef<Engine | null>(null);
  const scaleEl = React.useRef<HTMLSpanElement | null>(null);
  const scaleText = React.useRef("");
  const scaleRef = React.useCallback((el: HTMLSpanElement | null) => {
    scaleEl.current = el;
    if (el) el.textContent = scaleText.current;
  }, []);

  const [state, setState] = React.useState<State>("loading");
  const [note, setNote] = React.useState("");
  const [section, setSection] = React.useState<Section | null>(null);
  const [legend, setLegend] = React.useState<{ key: string; label: string; swatch: string }[]>([]);
  const [fs, setFs] = React.useState<FloodState | null>(null);
  const [plumes, setPlumes] = React.useState<PlumeState | null>(null);
  const { species, hasPlumes, bar } = usePlumePlayback(scene, plumes);

  React.useEffect(() => {
    let alive = true;
    Promise.all([fetchSoilProfile(), esriModules<unknown[]>(SOIL_MODULES)])
      .then(async ([data, mods]) => {
        if (!alive || !holder.current) return;
        const h = await createSoilScene({
          container: holder.current,
          data,
          mods,
          imageryOnly: true,
          onPick: () => {},
          onNote: setNote,
          onSection: setSection,
          onPlumes: setPlumes,
          onScale: (d) => {
            scaleText.current = d ? ratioText(d) : "";
            if (scaleEl.current) scaleEl.current.textContent = scaleText.current;
          },
          onLatrine: () => {},
        });
        if (!alive) {
          h.destroy();
          return;
        }
        scene.current = h;
        engine.current = createSoilFlood({ view: h.view, geom: h.geom, onState: (s: object) => setFs(s as FloodState) }) as Engine;
        setLegend(h.legend());
        setState("ready");
        /* Үерийн 19 МБ өгөгдөл, тооцооны торыг сул үед урьдчилан бэлтгэнэ — "Эхлүүлэх"-д хүлээхгүй */
        const idle =
          (window as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ??
          ((f: () => void) => window.setTimeout(f, 1500));
        idle(() => void engine.current?.preload().catch(() => {}));
      })
      .catch((e: Error) => {
        if (alive) setState({ error: e.message });
      });
    return () => {
      alive = false;
      engine.current?.destroy();
      engine.current = null;
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);

  const busy = state === "loading";
  const st = fs;
  const preparing = st?.phase === "loading";
  const running = !!st?.running;
  const done = !!st && st.t >= st.tEnd - 1;
  const stats = st?.stats ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Columns layout="flex" id="flood-soil" right={340} className="min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="soil-scene-view relative min-h-0 flex-1 overflow-hidden rounded-xs border border-line bg-paper-3">
            <div ref={holder} className="absolute inset-0" />
            {state === "ready" ? (
              <>
                <span className="pointer-events-none absolute bottom-2 left-2 rounded-xs bg-paper/80 px-2 py-1 text-[10.5px] text-ink-2 backdrop-blur-sm">
                  <span ref={scaleRef} className="num font-semibold text-ink empty:hidden after:font-normal after:text-ink-2 after:content-['_·_']" />
                  Хөрсний босоо өсгөлт ×{SOIL_EXAGGERATION}
                  {hasPlumes ? `, бохирдлын өргөн ×${PLUME_X}${plumes?.inner ? `, талбайн дотор ×${INNER_X}` : ""}` : ""} · усны гүн бодит масштаб
                </span>
                {note ? (
                  <span className="absolute top-2 left-2 rounded-xs border border-(--ochre) bg-paper/85 px-2 py-1 text-[11px] text-ink backdrop-blur-sm">
                    {note}
                  </span>
                ) : null}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center gap-2 px-6">
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-ink-3" />
                    <span className="text-[12px] text-ink-2">Хөрсний блок ачаалж байна</span>
                  </>
                ) : (
                  <span className="max-w-[420px] text-center text-[12px] text-ink-2">{typeof state === "object" ? state.error : ""}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="soil-side flex min-h-0 flex-col gap-2 overflow-y-auto xl:w-(--col-r) xl:shrink-0">
          <Card title="БОРООНЫ ХУВИЛБАР">
            <div className="grid grid-cols-2 gap-1">
              {FLOOD_PRESETS.map((p) => {
                const on = (st?.preset ?? FLOOD_PRESETS[0].id) === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => engine.current?.setPreset(p.id)}
                    className={cn(
                      "rounded-xs border px-2 py-1.5 text-left transition-colors",
                      on ? "border-(--tone) bg-(--tone)/10" : "border-line bg-paper-3 hover:bg-paper-hi",
                    )}
                  >
                    <span className={cn("block text-[11.5px] font-medium", on ? "text-ink" : "text-ink-2")}>{p.name}</span>
                    <span className="num block text-[10px] text-ink-3">{p.note}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                disabled={preparing || state !== "ready"}
                onClick={() => (running ? engine.current?.pause() : void engine.current?.start())}
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xs border px-3 py-2 text-[12px] font-semibold transition-colors",
                  preparing ? "cursor-wait border-line bg-paper-3 text-ink-3" : "border-(--tone) bg-(--tone)/12 text-ink hover:bg-(--tone)/20",
                )}
              >
                {preparing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="truncate">{st?.message || "Бэлтгэж байна"}</span>
                  </>
                ) : running ? (
                  <>
                    <Pause size={14} /> Түр зогсоох
                  </>
                ) : st && st.t > 0 && !done ? (
                  <>
                    <Play size={14} /> Үргэлжлүүлэх
                  </>
                ) : (
                  <>
                    <Play size={14} /> Эхлүүлэх
                  </>
                )}
              </button>
              <button
                type="button"
                title="Эхнээс нь"
                aria-label="Эхнээс нь"
                disabled={!st || st.t <= 0}
                onClick={() => engine.current?.reset()}
                className="flex items-center justify-center rounded-xs border border-line bg-paper-3 px-2.5 text-ink-2 transition-colors hover:bg-paper-hi disabled:opacity-40"
              >
                <RotateCcw size={14} />
              </button>
            </div>
            {st?.phase === "error" ? <p className="mt-2 text-[11px] text-(--clay)">{st.message}</p> : null}
          </Card>

          {stats ? (
            <Card title={`ҮР ДҮН · ${fmtT(st?.t ?? 0)}`}>
              <ul className="divide-y divide-line">
                <Row icon={CloudRain} label="Нийт хур тунадас" value={`${stats.rainMm.toFixed(0)} мм`} />
                <Row icon={Waves} label="Усанд автсан талбай" value={`${Math.round(stats.wetHa).toLocaleString()} га`} tone />
                <Row icon={Droplets} label="Хамгийн их гүн" value={`${stats.hmax.toFixed(2)} м`} />
                <Row label="Усны эзэлхүүн" value={`${Math.round(stats.vol / 1000).toLocaleString()} мянган м³`} />
              </ul>
            </Card>
          ) : null}

          {st && st.t > 0 ? <TimeBar st={st} /> : null}

          {bar ? <PlumeBar {...bar} /> : null}

          {section ? (
            <SectionCard
              section={section}
              legend={legend}
              plumes={hasPlumes ? { grid: plumes!.grid, species } : null}
              onPick={(lon, lat) => scene.current?.pickAt(lon, lat)}
            />
          ) : null}
        </div>
      </Columns>
    </div>
  );
}

function Row({ icon: Icon, label, value, tone }: { icon?: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; tone?: boolean }) {
  return (
    <li className="flex items-center gap-2 py-[5px]">
      {Icon ? <Icon size={13} className={tone ? "text-(--tone)" : "text-ink-3"} /> : <span className="w-[13px]" />}
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">{label}</span>
      <b className={cn("num text-[12px] font-medium", tone ? "text-(--tone)" : "text-ink")}>{value}</b>
    </li>
  );
}

/* ЦАГИЙН ЗУРВАС — тооцооны хугацааны явц ба усны гүнгийн шатлал ("Үерийн симуляци"-тай нэг өнгө).
   Баруун баганад "Үр дүн" картын ДООР (хэрэглэгч 2026-10-12) — урьд нь зургийн баруун доод буланд хөвдөг байв. */
function TimeBar({ st }: { st: FloodState }) {
  const p = Math.min(1, st.t / Math.max(st.tEnd, 1));
  return (
    <Card
      title={st.running ? "ТООЦООЛЖ БАЙНА" : st.t >= st.tEnd - 1 ? "ТООЦОО ДУУСЛАА" : "ТҮР ЗОГССОН"}
      action={
        <b className="num text-[12px] font-medium text-ink">
          {fmtT(st.t)} <span className="font-normal text-ink-3">/ {fmtT(st.tEnd)}</span>
        </b>
      }
    >
      <div className="h-[3px] rounded-xs bg-line">
        <div className="h-full rounded-xs bg-(--tone)" style={{ width: `${p * 100}%` }} />
      </div>
      <div className="mt-2 h-[8px] rounded-xs" style={{ background: "linear-gradient(90deg,#9eebff,#40adff 7.5%,#1466e6 25%,#0d2ea6 50%,#380d73)" }} />
      <div className="num mt-0.5 flex justify-between text-[10px] text-ink-3">
        <span>Усны гүн 0</span>
        <span>1</span>
        <span>2</span>
        <span>4+ м</span>
      </div>
    </Card>
  );
}
