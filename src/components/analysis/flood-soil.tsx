"use client";

import * as React from "react";
import { CloudRain, Droplets, Loader2, Pause, Play, RotateCcw, Toilet, Waves } from "lucide-react";
import { cn, ratioText } from "@/lib/utils";
import { Columns } from "@/components/ui/resizable-columns";
import { Card, Field } from "@/components/analysis/ui";
import { esriModules } from "@/lib/arcgis-sdk";
import { fetchSoilProfile } from "@/lib/soil-profile";
import { SOIL_EXAGGERATION, SOIL_MODULES, createSoilScene, type Section, type SoilScene as Handle } from "@/lib/soil-scene";
import { SectionCard } from "@/components/analysis/soil-section";
import { FLOOD_PRESETS, STOCK_YR, createSoilFlood, type SoilFlood, type SoilFloodState } from "@/lib/soil-flood";
import { RN3, rampC } from "@/lib/latrine-sim-3d";

/* --------------------------------------------------------------------------
   ҮЕР БА НЭВЧИЛТ — хөрсний блок дээр үерийн ус, нүүрэнд бохирдлын шингээлт

   Гурав дахь харагдац (хэрэглэгч 2026-10-09: "buur shine button neene …").
   Хөрсний зүсэлтийн SceneView ТЭР ЧИГЭЭРЭЭ ({@link createSoilScene}: блок,
   зүсэлтийн хэрэгсэл, таглаа), дээр нь үерийн шийдэгчийн ус ба бохирдлын
   хөшиг ({@link createSoilFlood}). "Хөрсний зүсэлт", "Үерийн симуляци"
   хоёр ХӨНДӨГДӨӨГҮЙ — энд жорлонгийн 10 жилийн тархалт (`plumes: false`),
   нэг жорлонгийн симуляци (`onLatrine` хоосон) ГАРАХГҮЙ: нэг нүүрэнд
   хоёр өөр хугацааны зураг холилдох байв.

   Урсгал (хэрэглэгч 2026-10-09: "zugeer oilgomjtoi ehluuleh geed towch
   baiy tgeed us ursaj bgaad bi duriin gazriig zusej harna"): хувилбар
   сонгоод "Эхлүүлэх" → хот даяар тооцоо (`SoilFloodState.phase`) → дуусмагц
   таймлайн ӨӨРӨӨ тоглоно (хөрсний зүсэлтийн бохирдлын тэнхлэгтэй нэг зан
   төлөв); тооцоо явж байхад ч, тоглож байхад ч ДУРЫН газар зүснэ — хөшиг
   хадгалсан агшнуудаас шууд гарна. Хувилбар солиход ӨӨРӨӨ дахин тооцохгүй
   — товч "Дахин эхлүүлэх" болно.
   ⚠ Урьд нь зүсэлт нь ӨӨРӨӨ тооцоог эхлүүлдэг байсан (зүсэлтийн орчмын
   талбайд) — бороо хаанаас эхлэхийг хэрэглэгч олсонгүй ("haana bgan be").

   ⚠ Бүрэлдэхүүн хөдөлгүүрээ ГАНЦ УДАА үүсгэнэ (`[]` хамаарал).
   ⚠ Босоо өсгөлт ×800 ИЛ бичигдэнэ (хөрс), усны гүн БОДИТ — доод мөрөнд.
   -------------------------------------------------------------------------- */

type State = "loading" | "ready" | { error: string };

const fmtT = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ц ${String(m % 60).padStart(2, "0")} мин`;
};
const kg = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v.toFixed(2));

export function FloodSoilView() {
  const holder = React.useRef<HTMLDivElement>(null);
  const scene = React.useRef<Handle | null>(null);
  const engine = React.useRef<SoilFlood | null>(null);
  const sectionRef = React.useRef<Section | null>(null);
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
  const [fs, setFs] = React.useState<SoilFloodState | null>(null);
  const [t, setT] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    Promise.all([fetchSoilProfile(), esriModules<unknown[]>(SOIL_MODULES)])
      .then(async ([data, mods]) => {
        if (!alive || !holder.current) return;
        const GraphicsLayer = mods[2] as new (p?: object) => { removeAll: () => void; add: (g: unknown) => void };
        const waterL = new GraphicsLayer({ title: "Үерийн ус", elevationInfo: { mode: "absolute-height" } });
        const seepL = new GraphicsLayer({ title: "Бохирдлын шингээлт", elevationInfo: { mode: "absolute-height" } });
        const h = await createSoilScene({
          container: holder.current,
          data,
          mods,
          plumes: false,
          layers: [waterL, seepL],
          onPick: () => {},
          onNote: setNote,
          onSection: (s) => {
            sectionRef.current = s;
            setSection(s);
          },
          onPlumes: () => {},
          onScale: (d) => {
            scaleText.current = d ? ratioText(d) : "";
            if (scaleEl.current) scaleEl.current.textContent = scaleText.current;
          },
          onLatrine: () => {},
          /* ⚠ `onSection` зүсэлт бүрд `onCut`-аас ӨМНӨ дуугардаг (soil-scene: emitSection → plumeCut) */
          onCut: (c) => engine.current?.setCut(c, sectionRef.current),
        });
        if (!alive) {
          h.destroy();
          return;
        }
        scene.current = h;
        engine.current = createSoilFlood({
          Mesh: mods[4] as never,
          MeshComponent: mods[5] as never,
          MeshMaterial: mods[6] as never,
          MeshTexture: mods[7] as never,
          Graphic: mods[3] as never,
          waterL,
          seepL,
          geom: h.geom,
          onState: setFs,
        });
        setLegend(h.legend());
        setState("ready");
        /* Үерийн 19 МБ өгөгдлийг сул үед урьдчилан татна — анхны зүсэлтэд хүлээхгүй */
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

  /* Тооцоо дуусмагц эхнээс ӨӨРӨӨ тоглоно */
  const ready = fs?.phase === "ready";
  const frames = fs?.frames ?? 0;
  const seen = React.useRef<number>(-1);
  React.useEffect(() => {
    if (!ready) {
      seen.current = -1;
      return;
    }
    if (seen.current === frames) return;
    seen.current = frames;
    setT(0);
    setPlaying(true);
  }, [ready, frames]);
  React.useEffect(() => {
    if (ready) engine.current?.setTime(t);
  }, [t, ready]);
  React.useEffect(() => {
    if (!playing || !ready) return;
    const id = window.setInterval(() => {
      setT((v) => {
        if (v >= frames - 1) {
          setPlaying(false);
          return v;
        }
        return v + 1;
      });
    }, 220);
    return () => window.clearInterval(id);
  }, [playing, ready, frames]);

  const busy = state === "loading";
  const st = fs;
  const computing = st?.phase === "loading" || st?.phase === "running";
  const stats = st?.stats ?? null;
  const tNow = st && frames ? (st.tEnd * (t + 1)) / frames : 0;

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
                  Хөрсний босоо өсгөлт ×{SOIL_EXAGGERATION} · усны гүн бодит масштаб · Зүсэлтийн нүүрэнд бохирдлын шингээлт
                </span>
                {st && st.phase !== "idle" ? (
                  <TimeBar
                    st={st}
                    t={t}
                    playing={playing}
                    tNow={tNow}
                    onT={(v) => {
                      setPlaying(false);
                      setT(v);
                    }}
                    onPlay={() => {
                      if (!playing && t >= frames - 1) setT(0);
                      setPlaying((v) => !v);
                    }}
                  />
                ) : null}
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
            <p className="mt-2 text-[10.5px] text-ink-3">Хуурай хөрс, Хортоны шингээлттэй · барилга саад болно · хугацаа бороо + 1 цаг</p>
            <button
              type="button"
              disabled={computing}
              onClick={() => engine.current?.start()}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-1.5 rounded-xs border px-3 py-2 text-[12px] font-semibold transition-colors",
                computing ? "cursor-wait border-line bg-paper-3 text-ink-3" : "border-(--tone) bg-(--tone)/12 text-ink hover:bg-(--tone)/20",
              )}
            >
              {computing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {st?.phase === "loading" ? st.message : "Тооцоолж байна"} · <span className="num">{Math.round((st?.progress ?? 0) * 100)}%</span>
                </>
              ) : st?.phase === "ready" || st?.phase === "error" ? (
                <>
                  <RotateCcw size={14} /> Дахин эхлүүлэх
                </>
              ) : (
                <>
                  <Play size={14} /> Эхлүүлэх
                </>
              )}
            </button>
          </Card>

          <Card title="ТООЦООНЫ ТАЛБАЙ">
            {!st || st.phase === "idle" ? (
              <div className="hatch rounded-xs border border-dashed border-line-2 px-3 py-4 text-center text-[11.5px] text-ink-2">Тооцоо эхлээгүй байна</div>
            ) : st.phase === "error" ? (
              <p className="text-[11.5px] text-(--clay)">{st.message}</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Field label="Талбай" value={st.area ? `Улаанбаатар · ${st.area.kmW.toFixed(1)} × ${st.area.kmH.toFixed(1)} км` : "—"} />
                <Field label="Тор" value={st.area ? `${st.area.w} × ${st.area.h} · ${st.area.dx.toFixed(0)} м` : "—"} />
                <Field label="Нүхэн жорлон" value={st.area ? st.area.latrines.toLocaleString() : "—"} />
                <Field label="Ам бүл" value={st.area ? st.area.people.toLocaleString() : "—"} />
              </dl>
            )}
            {st?.noLatrines && st.phase !== "idle" ? (
              <p className="mt-2 text-[10.5px] text-(--ochre)">Нүхэн жорлонгийн багц ирсэнгүй — зөвхөн ус тооцогдоно</p>
            ) : null}
          </Card>

          {stats ? (
            <Card title={`ҮР ДҮН · ${fmtT(tNow)}`}>
              <ul className="divide-y divide-line">
                <Row icon={Waves} label="Усанд автсан талбай" value={`${stats.wetHa.toFixed(1)} га`} />
                <Row icon={Droplets} label="Хамгийн их гүн" value={`${stats.hmax.toFixed(2)} м`} />
                <Row icon={Toilet} label="Автсан нүхэн жорлон" value={stats.flooded.toLocaleString()} />
                <Row icon={CloudRain} label="Угаагдсан азот" value={`${kg(stats.washed)} кг`} tone />
                <Row label="Усанд зөөгдөж буй" value={`${kg(stats.inWater)} кг`} />
                <Row label="Хөрсөнд шингэсэн" value={`${kg(stats.inSoil)} кг`} />
                <Row label="Шугам сүлжээнд" value={`${kg(stats.drained)} кг`} />
                <Row label="Талбайгаас урсаж гарсан" value={`${kg(stats.left)} кг`} />
                <Row label="Чийгийн фронт зүсэлт дээр" value={st?.cutOn ? `${(stats.frontMax * 100).toFixed(0)} см хүртэл` : "—"} />
              </ul>
              <p className="mt-2 text-[10.5px] text-ink-3">
                Нүхний нөөц азот — ам бүл × 4.5 кг/жил × {STOCK_YR} жил; азот задрахгүй (дээд хязгаарын үнэлгээ)
              </p>
            </Card>
          ) : null}

          {section ? <SectionCard section={section} legend={legend} plumes={null} onPick={(lon, lat) => scene.current?.pickAt(lon, lat)} /> : null}
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

/*
  ЦАГИЙН ТЭНХЛЭГ — хөрсний зүсэлтийн бохирдлын тэнхлэгтэй нэг хэлбэр
  (тоглуулах · гулсуур · хугацаа), доор нь хоёр хуулга: усны гүн ба усан
  дахь азотын агууламж. Тооцоо явж байхад явцыг ил хэлнэ.
*/
function TimeBar(props: { st: SoilFloodState; t: number; playing: boolean; tNow: number; onT: (v: number) => void; onPlay: () => void }) {
  const { st, t, playing, tNow } = props;
  const ready = st.phase === "ready";
  return (
    <div className="elevated absolute right-2 bottom-2 z-10 w-[400px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-ink">ҮЕР БА БОХИРДЛЫН ШИНГЭЭЛТ</span>
        <span className="num text-[11px] text-ink-3">{st.area ? `${st.area.latrines.toLocaleString()} нүхэн жорлон` : ""}</span>
      </div>
      {ready ? (
        <div className="mt-1.5 flex items-center gap-2">
          <button type="button" onClick={props.onPlay} className="flex items-center gap-1 rounded-xs border border-(--tone) px-2 py-1 text-[11.5px] text-ink">
            {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? "Зогсоох" : "Тоглуулах"}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, st.frames - 1)}
            value={Math.min(t, Math.max(0, st.frames - 1))}
            onChange={(e) => props.onT(Number(e.target.value))}
            className="min-w-0 flex-1 accent-(--tone)"
            aria-label="Хугацаа"
          />
          <b className="num w-[74px] text-right text-[12px] font-medium text-ink">{fmtT(tNow)}</b>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-2">
          {st.phase === "error" ? (
            <span className="text-(--clay)">{st.message}</span>
          ) : (
            <>
              <Loader2 size={12} className="animate-spin text-ink-3" />
              {st.phase === "loading" ? st.message : "Үерийн тооцоо явж байна"} · <span className="num">{Math.round(st.progress * 100)}%</span>
            </>
          )}
        </div>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-3">
        <div>
          <div className="h-[8px] rounded-xs" style={{ background: "linear-gradient(90deg,#9eebff,#40adff 7.5%,#1466e6 25%,#0d2ea6 50%,#380d73)" }} />
          <div className="num mt-0.5 flex justify-between text-[10px] text-ink-3">
            <span>Усны гүн 0</span>
            <span>1</span>
            <span>2</span>
            <span>4+ м</span>
          </div>
        </div>
        <div>
          <div className="flex h-[8px] overflow-hidden rounded-xs">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <i key={v} className="flex-1" style={{ background: `rgb(${rampC(RN3, v)})` }} />
            ))}
          </div>
          <div className="num mt-0.5 flex justify-between text-[10px] text-ink-3">
            <span>Азот 1 мг/л</span>
            <span>30</span>
            <span>1000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
