"use client";

import * as React from "react";
import { Layers, Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Columns } from "@/components/ui/resizable-columns";
import { Card, Field } from "@/components/analysis/ui";
import { esriModules } from "@/lib/arcgis-sdk";
import { fetchSoilProfile } from "@/lib/soil-profile";
import { SOIL_EXAGGERATION, SOIL_MODULES, createSoilScene, type PickInfo, type Section, type SoilScene as Handle } from "@/lib/soil-scene";
import { SectionCard } from "@/components/analysis/soil-section";
import { RE3, RN3, loadThree, rampC, type Species } from "@/lib/latrine-sim-3d";
import { SimSide, SimStage, useLatrineSim } from "@/components/analysis/latrine-sim";
import { DEEP_X, STEP_DAYS, type PlumeState } from "@/lib/soil-plumes";
import { PlumeSection } from "@/components/analysis/plume-section";

/* --------------------------------------------------------------------------
   ГУРВАН ХЭМЖЭЭСТ ЗҮСЭЛТ — хөрсний профайлын блок

   Рельеф дээр хөрсний блок босгож, зүсэж дотоод бүтцийг харуулна.
   Зурах бүх логик {@link src/lib/soil-scene.ts}-д — энэ файл нь
   зөвхөн сонгосон цэгийн профайл, хуулга.

   ⚠⚠ ТОЛГОЙН УДИРДЛАГЫН МӨР ХАСАГДСАН (хэрэглэгчийн шийдвэр,
   2026-09-30). Азимут, хуулсан гүн, босоо өсгөлт, хөрсний шилжилт,
   газрын гадарга гэсэн таван гулсуур байсныг хөдөлгүүрт ТОГТМОЛ
   болгов (утгууд, үндэслэл нь {@link src/lib/soil-scene.ts}-д).
   Зүсэлтийн чиглэл Esri-ийн хэрэгслийн бариулаар өгөгдөнө.

   ⚠ Бүрэлдэхүүн ГАНЦ УДАА л хөдөлгүүрээ үүсгэнэ (`[]` хамаарал).
   Төлөвөөс дахин үүсгэвэл
   блок удаа бүр дахин баригдаж (гурван зуун мянга гаруй гурвалжин)
   дэлгэц хөлдөнө.

   ⚠⚠ БОСОО ӨСГӨЛТ ИЛ БИЧИГДЭНЭ. Блок нь 100 км талбайд 2 метр гүн
   тул өсгөлтгүй бол хөрс цаасны зузаан болно; өсгөсөн хойно налуу нь
   байгаагаас эгц харагдах тул коэффициентийг нуух боломжгүй.
   -------------------------------------------------------------------------- */

type State = "loading" | "ready" | { error: string };

export function SoilScene() {
  const holder = React.useRef<HTMLDivElement>(null);
  const scene = React.useRef<Handle | null>(null);

  const [state, setState] = React.useState<State>("loading");
  const [pick, setPick] = React.useState<PickInfo | null>(null);
  const [note, setNote] = React.useState("");
  const [section, setSection] = React.useState<Section | null>(null);
  const [legend, setLegend] = React.useState<{ key: string; label: string; swatch: string }[]>([]);
  const [soils, setSoils] = React.useState<{ key: string; name: string; wrb: string; color: string }[]>([]);
  /* ── Зүсэлт дээрх бохирдол ({@link src/lib/soil-plumes.ts}) ── */
  const [plumes, setPlumes] = React.useState<PlumeState | null>(null);
  const [t, setT] = React.useState(0);
  const [species, setSpecies] = React.useState<Species>("N");
  const [playing, setPlaying] = React.useState(false);
  /* ── Нэвчилтийн симуляци — жорлон товшиход ({@link src/components/analysis/latrine-sim.tsx}) ── */
  const [simSel, setSimSel] = React.useState(-1);
  const [simOpen, setSimOpen] = React.useState(false);
  const sim = useLatrineSim(simSel, simOpen);
  const closeSim = React.useCallback(() => setSimOpen(false), []);

  React.useEffect(() => {
    let alive = true;
    Promise.all([fetchSoilProfile(), esriModules<unknown[]>(SOIL_MODULES)])
      .then(async ([data, mods]) => {
        if (!alive || !holder.current) return;
        const h = await createSoilScene({
          container: holder.current,
          data,
          mods,
          onPick: setPick,
          onNote: setNote,
          onSection: setSection,
          onPlumes: setPlumes,
          onLatrine: (i) => {
            setSimSel(i);
            setSimOpen(true);
          },
        });
        if (!alive) {
          h.destroy();
          return;
        }
        scene.current = h;
        setLegend(h.legend());
        setSoils(h.soils());
        setState("ready");
        /* ⚠ three.js-ийг УРЬДЧИЛАН татна — анх жорлон товшиход CDN хүлээхгүй.
           Блок зурагдаж дууссаны дараа, сул үед: хөрсний зүсэлтийн ачаалалтай
           өрсөлдөхгүй. Унавал симуляци нээгдэх үед дахин оролдоно. */
        const idle =
          (window as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ??
          ((f: () => void) => window.setTimeout(f, 1500));
        idle(() => void loadThree().catch(() => {}));
      })
      .catch((e: Error) => {
        if (alive) setState({ error: e.message });
      });
    return () => {
      alive = false;
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);

  const busy = state === "loading";
  const steps = plumes?.steps ?? 1;
  const shown = !!plumes && plumes.count > 0;

  React.useEffect(() => scene.current?.setPlumeTime(t), [t]);
  React.useEffect(() => scene.current?.setPlumeSpecies(species), [species]);
  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setT((v) => {
        if (v >= steps - 1) {
          setPlaying(false);
          return v;
        }
        return v + 1;
      });
    }, 140);
    return () => window.clearInterval(id);
  }, [playing, steps]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Columns layout="flex" id="soil-scene" right={340} className="min-h-0 flex-1">
        {/* ── Гурван хэмжээст харагдац + доор нь гүний ус хүртэлх диаграм ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="soil-scene-view relative min-h-0 flex-1 overflow-hidden rounded-xs border border-line bg-paper-3">
            <div ref={holder} className="absolute inset-0" />
            {state === "ready" ? (
              <>
                {/* ⚠⚠ Өсгөлтийн коэффициент ИЛ бичигдэнэ — налуу байгаагаас эгц
                  харагдахыг нуух боломжгүй. Гулсуур хасагдсан тул энд л үлдэв. */}
                <span className="pointer-events-none absolute bottom-2 left-2 rounded-xs bg-paper/80 px-2 py-1 text-[10.5px] text-ink-2 backdrop-blur-sm">
                  Босоо өсгөлт ×{SOIL_EXAGGERATION}
                  {/* ⚠ Гүний хэсэг өөр өсгөлттэй — гарч ирэх бүрд ИЛ хэлнэ */}
                  {shown && plumes?.deep && plumes.deep.depth > 2 ? `, 2 м-ээс доош ×${DEEP_X}` : ""} · Товшиход профайл · Жорлон товшиход
                  нэвчилтийн симуляци · Alt + товшиход тэр цэгээр зүсэлт
                </span>
                {shown ? (
                  <PlumeBar
                    state={plumes!}
                    t={t}
                    species={species}
                    playing={playing}
                    onT={(v) => {
                      setPlaying(false);
                      setT(v);
                    }}
                    onSpecies={setSpecies}
                    onPlay={() => {
                      if (!playing && t >= steps - 1) setT(0);
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
            {/* ⚠ Анх товшсоноос хойш УСТАХГҮЙ — буцаад дахин нээхэд шууд гарна */}
            {simSel >= 0 ? <SimStage sim={sim} open={simOpen} onBack={closeSim} /> : null}
          </div>
          {/* ⚠ Симуляци нээлттэй үед нуугдана — тэр нь нэг жорлонгийнх */}
          {shown && plumes?.deep && !simOpen ? (
            <div className="h-[210px] shrink-0">
              <PlumeSection deep={plumes.deep} species={species} count={plumes.count} years={((t * STEP_DAYS) / 365).toFixed(1)} />
            </div>
          ) : null}
        </div>

        {/* ── Сонгосон цэг, хуулга · симуляцид ТОХИРГОО ───────────── */}
        <div className="soil-side flex min-h-0 flex-col gap-2 overflow-y-auto xl:w-(--col-r) xl:shrink-0">
          {simOpen ? <SimSide sim={sim} /> : null}
          {!simOpen && section ? (
            <SectionCard
              section={section}
              legend={legend}
              plumes={shown ? { grid: plumes!.grid, species } : null}
              onPick={(lon, lat) => scene.current?.pickAt(lon, lat)}
            />
          ) : null}
          {simOpen ? null : (
            <>
              <ProfileCard pick={pick} />
              <Card title="ҮЕ ДАВХАРГА">
                <ul className="divide-y divide-line">
                  {legend.map((l) => (
                    <li key={l.key} className="flex items-center gap-2 py-[5px]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- canvas-аас гарсан data URL */}
                      <img src={l.swatch} alt="" className="h-[18px] w-[30px] shrink-0 rounded-xs border border-line object-cover" />
                      <span className="min-w-0 truncate text-[11.5px] text-ink-2" title={l.label}>
                        {l.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="ХӨРСНИЙ ХЭВ ШИНЖ">
                <ul className="divide-y divide-line">
                  {soils.map((s) => (
                    <li key={s.key} className="flex items-start gap-2 py-[5px]">
                      <span aria-hidden className="mt-[4px] h-[9px] w-[9px] shrink-0 rounded-xs" style={{ background: s.color }} />
                      <span className="min-w-0">
                        <span className="block text-[11.5px] text-ink">{s.name}</span>
                        <span className="block text-[10.5px] text-ink-3">{s.wrb}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </Columns>
    </div>
  );
}

/*
  ⚠⚠ БОХИРДЛЫН ЦАГИЙН ТЭНХЛЭГ — зүсэлт жорлон огтолсон үед л гарна.
  "Нэвчилтийн симуляци"-ийн тэнхлэгтэй нэг хэлбэр: тоглуулах, гулсуур,
  жил; дээр нь зүйл сонгох ба өнгөний хуулга (хуулга нь тэр харагдацын
  доод баруун картынхтай ижил шатлал, ижил хуваарь).
  ⚠ Тооцоо дуусаагүй үед ил хэлнэ: жорлон бүрийн бохирдол бодогдох
  тусам зураг дээр нэмэгдэнэ.
*/
function PlumeBar(props: {
  state: PlumeState;
  t: number;
  species: Species;
  playing: boolean;
  onT: (v: number) => void;
  onSpecies: (s: Species) => void;
  onPlay: () => void;
}) {
  const { state, t, species, playing } = props;
  const ramp = species === "N" ? RN3 : RE3;
  return (
    <div className="elevated absolute right-2 bottom-2 z-10 w-[380px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-ink">БОХИРДЛЫН НЭВЧИЛТ</span>
        <span className="num text-[11px] text-ink-3">{state.count.toLocaleString()} нүхэн жорлон</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={props.onPlay}
          className="flex items-center gap-1 rounded-xs border border-(--tone) px-2 py-1 text-[11.5px] text-ink"
        >
          {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? "Зогсоох" : "Тоглуулах"}
        </button>
        <input
          type="range"
          min={0}
          max={state.steps - 1}
          value={Math.min(t, state.steps - 1)}
          onChange={(e) => props.onT(Number(e.target.value))}
          className="min-w-0 flex-1 accent-(--tone)"
          aria-label="Хугацаа"
        />
        <b className="num w-[52px] text-right text-[12px] font-medium text-ink">{((t * STEP_DAYS) / 365).toFixed(1)} жил</b>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex shrink-0 gap-1">
          {(["N", "E"] as Species[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={species === s}
              onClick={() => props.onSpecies(s)}
              className={cn(
                "rounded-xs border px-2 py-0.5 text-[11px]",
                species === s ? "border-(--tone) text-ink" : "border-line text-ink-3 hover:text-ink",
              )}
            >
              {s === "N" ? "Азот (нитрат)" : "E.coli"}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex h-[8px] overflow-hidden rounded-xs">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <i key={v} className="flex-1" style={{ background: `rgb(${rampC(ramp, v)})` }} />
            ))}
          </div>
          <div className="num mt-0.5 flex justify-between text-[10px] text-ink-3">
            {(species === "N" ? ["4 мг/л", "40", "400", "4000"] : ["1", "10³", "10⁷ /100 мл"]).map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      </div>
      {state.done < state.total ? (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-3">
          <Loader2 size={12} className="animate-spin" />
          Тооцоолж байна · <span className="num">{Math.round((state.done / Math.max(1, state.total)) * 100)}%</span>
        </div>
      ) : null}
    </div>
  );
}

/* ⚠ ХОЛИМОГ БҮСЭД ҮЕИЙН НЭР ГАРАХГҮЙ: катенагийн шилжилтэд хоёр
   профайлын зузаан холилддог тул "Bk1" гэж нэрлэвэл аль профайлынх
   болох нь тодорхойгүй. Тэр үед зөвхөн ангилал бичигдэнэ — хөдөлгүүр
   аль хэдийн тэгж бэлтгэдэг; энд нь ХОЛИМГИЙН задаргааг хэлнэ. */
function ProfileCard({ pick }: { pick: PickInfo | null }) {
  if (!pick)
    return (
      <Card title="СОНГОСОН ЦЭГ">
        <div className="hatch flex flex-col items-center gap-1.5 rounded-xs border border-dashed border-line px-3 py-6">
          <Layers size={18} strokeWidth={1.5} className="text-ink-3" />
          <span className="text-center text-[11.5px] text-ink-2">Блок дээр товшиход тэр цэгийн хөрсний зүсэлт харагдана</span>
        </div>
      </Card>
    );

  const p = pick.profile;
  return (
    <Card title="СОНГОСОН ЦЭГ">
      <div className="flex flex-col gap-2">
        <div>
          <span className="block text-[12.5px] font-medium text-ink">{p.name}</span>
          <span className="block text-[11px] text-ink-3">{p.wrb}</span>
        </div>

        {!pick.pure ? (
          <div className="rounded-xs border border-line bg-paper-3 px-2 py-1.5">
            <span className="eyebrow block text-ink-3">Шилжилтийн бүс</span>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {pick.mix.map((m) => (
                <li key={m.key} className="num text-[11px] text-ink-2">
                  {m.key} · {Math.round(m.share * 100)}%
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Монолит — үеийн нэр, гүн, гүний ус, товшсон цэгийн гүн */}
        <div className="flex justify-center rounded-xs border border-line bg-paper-3 py-1" dangerouslySetInnerHTML={{ __html: pick.svg }} />

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Field label="Гадаргын өндөр" value={`${Math.round(pick.elevation)} м`} />
          <Field label="Товшсон гүн" value={pick.depthCm == null ? "гадарга" : `${Math.round(pick.depthCm)} см`} />
          <Field label="Гүний усны гүн, м" value={p.gw || "бүртгэгдээгүй"} />
          <Field label="Цэвдгийн байдал" value={p.perma || "бүртгэгдээгүй"} />
        </dl>

        {p.gravel ? (
          <dl>
            <Field label="Хайрга, чулууны эзлэх хувь" value={p.gravel} />
          </dl>
        ) : null}
        {p.raw ? (
          <div>
            <span className="eyebrow block text-ink-3">Үеийн бүтэц</span>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{p.raw}</p>
          </div>
        ) : null}
        {p.src ? (
          <div>
            <span className="eyebrow block text-ink-3">Эх сурвалж</span>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{p.src}</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
