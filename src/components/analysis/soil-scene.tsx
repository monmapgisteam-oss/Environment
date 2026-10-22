"use client";

import * as React from "react";
import { Layers, Loader2, Pause, Play } from "lucide-react";
import { cn, ratioText } from "@/lib/utils";
import { Columns } from "@/components/ui/resizable-columns";
import { Card } from "@/components/analysis/ui";
import { esriModules } from "@/lib/arcgis-sdk";
import { HCLS, fetchSoilProfile, hcls } from "@/lib/soil-profile";
import { SOIL_EXAGGERATION, SOIL_MODULES, createSoilScene, type PickInfo, type Section, type SoilScene as Handle } from "@/lib/soil-scene";
import { SectionCard } from "@/components/analysis/soil-section";
import { RE3, RN3, loadThree, rampC, type Species } from "@/lib/latrine-sim-3d";
import { SimSide, SimStage, useLatrineSim } from "@/components/analysis/latrine-sim";
import { INNER_X, PLUME_X, STEP_DAYS, type PlumeState } from "@/lib/soil-plumes";
import { GroundColumn } from "@/components/analysis/ground-column";

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
  /* ⚠ Харьцааны хуваарь камер хөдлөх бүрд өөрчлөгдөнө — төлөвт барьвал
     самбар бүхлээрээ дахин зурагдана тул DOM руу шууд бичнэ (2D зургийн
     `RatioScaleControl`-той нэг зарчим) */
  const scaleEl = React.useRef<HTMLSpanElement | null>(null);
  /* ⚠ Хөдөлгүүр анхны утгаа блок зурагдахаас ӨМНӨ дуугаргадаг — тэр үед
     заалтын элемент хараахан байхгүй тул сүүлийн бичвэрийг барьж, элемент
     гарч ирэхэд тавина */
  const scaleText = React.useRef("");
  const scaleRef = React.useCallback((el: HTMLSpanElement | null) => {
    scaleEl.current = el;
    if (el) el.textContent = scaleText.current;
  }, []);

  const [state, setState] = React.useState<State>("loading");
  const [pick, setPick] = React.useState<PickInfo | null>(null);
  const [note, setNote] = React.useState("");
  const [section, setSection] = React.useState<Section | null>(null);
  const [legend, setLegend] = React.useState<{ key: string; label: string; swatch: string }[]>([]);
  /* ── Зүсэлт дээрх бохирдол ({@link src/lib/soil-plumes.ts}) ── */
  const [plumes, setPlumes] = React.useState<PlumeState | null>(null);
  const { species, hasPlumes, bar } = usePlumePlayback(scene, plumes);
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
          onScale: (d) => {
            scaleText.current = d ? ratioText(d) : "";
            if (scaleEl.current) scaleEl.current.textContent = scaleText.current;
          },
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Columns layout="flex" id="soil-scene" left={280} right={340} className="min-h-0 flex-1">
        {/* ── Газрын доорх давхарга — сонгосон цэгийн монолит, гүний ус хүртэл
            ("Бохирдлын нэвчилт" 2D диаграмын ОРОНД; хэрэглэгч 2026-10-12:
            "мапын зүүн талд шинэ панел") ── */}
        <div className="flex min-h-[420px] flex-col gap-2 xl:min-h-0 xl:w-(--col-l) xl:shrink-0">
          <div className="flex min-h-0 flex-1 flex-col">
            <GroundColumn pick={pick} />
          </div>
          {/* ⚠ Бохирдлын цагийн тэнхлэг монолитын ДООР тусдаа карт (хэрэглэгч
              2026-10-12: "Газрын доорх давхарга доор шинэ карт нээгээд оруул").
              Урьд нь 3D зургийн баруун доод буланд хөвдөг байв. */}
          {state === "ready" && bar ? <PlumeBar {...bar} /> : null}
        </div>
        {/* ── Гурван хэмжээст харагдац + доор нь гүний ус хүртэлх диаграм ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="soil-scene-view relative min-h-0 flex-1 overflow-hidden rounded-xs border border-line bg-paper-3">
            <div ref={holder} className="absolute inset-0" />
            {state === "ready" ? (
              <>
                {/* ⚠⚠ Өсгөлтийн коэффициент ИЛ бичигдэнэ — налуу байгаагаас эгц
                  харагдахыг нуух боломжгүй. Гулсуур хасагдсан тул энд л үлдэв. */}
                <span className="pointer-events-none absolute bottom-2 left-2 rounded-xs bg-paper/80 px-2 py-1 text-[10.5px] text-ink-2 backdrop-blur-sm">
                  {/* Харьцаа нь хэвтээ тэнхлэгийнх; газар харагдахгүй үед хоосон */}
                  <span ref={scaleRef} className="num font-semibold text-ink empty:hidden after:font-normal after:text-ink-2 after:content-['_·_']" />
                  Босоо өсгөлт ×{SOIL_EXAGGERATION}
                  {/* ⚠ Гүний хэсэг өөр өсгөлттэй — гарч ирэх бүрд ИЛ хэлнэ */}
                  {hasPlumes ? `, бохирдлын өргөн ×${PLUME_X}${plumes?.inner ? `, талбайн дотор ×${INNER_X}` : ""}` : ""} · Товшиход профайл · Жорлон товшиход
                  нэвчилтийн симуляци · Alt + товшиход тэр цэгээр зүсэлт
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
            {/* ⚠ Анх товшсоноос хойш УСТАХГҮЙ — буцаад дахин нээхэд шууд гарна */}
            {simSel >= 0 ? <SimStage sim={sim} open={simOpen} onBack={closeSim} /> : null}
          </div>
        </div>

        {/* ── Сонгосон цэг, хуулга · симуляцид ТОХИРГОО ───────────── */}
        <div className={cn("soil-side flex min-h-0 flex-col gap-2 overflow-y-auto xl:w-(--col-r) xl:shrink-0", simOpen && "is-sim")}>
          {simOpen ? <SimSide sim={sim} /> : null}
          {!simOpen && section ? (
            <SectionCard
              section={section}
              legend={legend}
              plumes={hasPlumes ? { grid: plumes!.grid, species } : null}
              onPick={(lon, lat) => scene.current?.pickAt(lon, lat)}
            />
          ) : null}
          {simOpen ? null : (
            <>
              <ProfileCard pick={pick} />
              <Card title="ҮЕ ДАВХАРГА">
                <ul className="divide-y divide-line">
                  {legend.map((l) => {
                    // Код зургийн ӨМНӨ, мэргэжлийн нэр АРД нь (хэрэглэгч 2026-10-12).
                    // Кодын багана тогтмол өргөнтэй — зургууд нэг эгнээнд суух ёстой.
                    const [code, name = ""] = l.label.split(" — ");
                    return (
                      <li key={l.key} className="flex items-center gap-2 py-[5px]" title={l.label}>
                        <span className="w-[58px] shrink-0 truncate text-[11.5px] font-semibold text-ink">{code}</span>
                        {/* eslint-disable-next-line @next/next/no-img-element -- canvas-аас гарсан data URL */}
                        <img src={l.swatch} alt="" className="h-[18px] w-[30px] shrink-0 rounded-xs border border-line object-cover" />
                        <span className="min-w-0 truncate text-[11.5px] text-ink-2">{name}</span>
                      </li>
                    );
                  })}
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
  ⚠⚠ БОХИРДЛЫН ЦАГИЙН ТЭНХЛЭГИЙН ТӨЛӨВ — "Хөрсний зүсэлт", "Үер ба нэвчилт"
  ХОЁУЛАА хэрэглэнэ. `bar` нь {@link PlumeBar}-ийн бэлэн пропууд, зүсэлтгүй
  үед `null`.
*/
export function usePlumePlayback(scene: React.RefObject<Handle | null>, plumes: PlumeState | null) {
  const [t, setT] = React.useState(0);
  const [species, setSpecies] = React.useState<Species>("N");
  const [playing, setPlaying] = React.useState(false);
  const steps = plumes?.steps ?? 1;
  /* Самбар зүсэлт БҮРД гарна — жорлонгүй бол тэгж хэлнэ; зураас, диаграм нь жорлонтой үед л */
  const shown = !!plumes && plumes.cut > 0;
  const hasPlumes = shown && plumes.count > 0;
  /* ⚠ Шинэ зүсэлтийн тооцоо дуусмагц таймлайн ӨӨРӨӨ тоглоно (хэрэглэгч
     2026-10-06: "zuseh bolon zurhad bohirdliin newchilt ni haragdah
     heregtei") — нэг зүсэлтэд нэг л удаа; дараа нь хэрэглэгч өөрөө. */
  const started = React.useRef(0);
  React.useEffect(() => {
    if (!plumes || plumes.cut === 0) {
      started.current = 0;
      return;
    }
    if (plumes.cut === started.current || plumes.count === 0 || plumes.done < plumes.total) return;
    started.current = plumes.cut;
    setT(0);
    setPlaying(true);
  }, [plumes]);

  React.useEffect(() => scene.current?.setPlumeTime(t), [scene, t]);
  React.useEffect(() => scene.current?.setPlumeSpecies(species), [scene, species]);
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

  const bar = shown
    ? {
        state: plumes,
        t,
        species,
        playing,
        onT: (v: number) => {
          setPlaying(false);
          setT(v);
        },
        onSpecies: setSpecies,
        onPlay: () => {
          if (!playing && t >= steps - 1) setT(0);
          setPlaying((v) => !v);
        },
      }
    : null;
  return { t, species, shown, hasPlumes, bar };
}

/*
  ⚠⚠ БОХИРДЛЫН ЦАГИЙН ТЭНХЛЭГ — зүсэлт жорлон огтолсон үед л гарна.
  "Нэвчилтийн симуляци"-ийн тэнхлэгтэй нэг хэлбэр: тоглуулах, гулсуур,
  жил; дээр нь зүйл сонгох ба өнгөний хуулга (хуулга нь тэр харагдацын
  доод баруун картынхтай ижил шатлал, ижил хуваарь).
  ⚠ Тооцоо дуусаагүй үед ил хэлнэ: жорлон бүрийн бохирдол бодогдох
  тусам зураг дээр нэмэгдэнэ.
*/
export function PlumeBar(props: {
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
  /* Зүүн баганын карт — "Газрын доорх давхарга"-тай нэг толгой, хүрээ */
  const head = (count: number) => (
    <div className="flex items-baseline justify-between gap-2 border-b border-line px-2.5 py-1.5">
      <span className="text-[12px] font-semibold tracking-[0.02em] text-ink uppercase">Бохирдлын нэвчилт</span>
      <span className="num text-[11px] text-ink-3">{count.toLocaleString()} нүхэн жорлон</span>
    </div>
  );
  /* Жорлонгүй зүсэлт — удирдлага биш, байдлыг нь хэлнэ */
  if (state.count === 0)
    return (
      <div className="shrink-0 rounded-xs border border-line bg-paper-2">
        {head(0)}
        <div className="flex items-center gap-1.5 px-2.5 py-2 text-[11.5px] text-ink-2">
          {state.loading ? (
            <>
              <Loader2 size={12} className="animate-spin text-ink-3" />
              Нүхэн жорлонгийн мэдээлэл ачаалж байна
            </>
          ) : (
            "Зүсэлтийн шугам дээр нүхэн жорлон байхгүй — гэр хорооллоор зүснэ үү"
          )}
        </div>
      </div>
    );
  return (
    <div className="shrink-0 rounded-xs border border-line bg-paper-2">
      {head(state.count)}
      <div className="px-2.5 py-2">
      <div className="flex items-center gap-2">
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
      {/* ⚠ Нарийн (280px) баганад зүйлийн товч ба шатлал ТУС ТУСДАА мөрөнд —
          нэг мөрөнд шахвал шатлалын тоонууд давхцана */}
      <div className="mt-2 flex flex-col gap-1.5">
        <div className="flex gap-1">
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
        <div>
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
          {/* WRB нэр дээр, монгол нэр доор (хэрэглэгч 2026-10-12) */}
          <span className="block text-[12.5px] font-medium tracking-[0.02em] text-ink uppercase">{p.wrb}</span>
          <span className="block text-[11px] text-ink-3">{p.name}</span>
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

        {/* Баримтууд нэг жагсаалтаар: нэр зүүнд, утга баруунд (хэрэглэгч 2026-10-12) */}
        <dl className="divide-y divide-line border-y border-line">
          <Fact label="Гадаргын өндөр" value={`${Math.round(pick.elevation).toLocaleString("en-US")} м`} />
          <Fact label="Гүний усны гүн" value={p.gw ? withUnit(p.gw, " м") : null} />
          <Fact label="Цэвдгийн байдал" value={p.perma ? cap(p.perma) : null} />
          {p.gravel ? <Fact label="Хайрга, чулууны эзлэх хувь" value={withUnit(p.gravel, "%")} /> : null}
        </dl>

        {p.raw ? <Horizons raw={p.raw} /> : null}

        {p.src ? (
          <div className="border-t border-line pt-1.5">
            <span className="eyebrow block text-ink-3">Эх сурвалж</span>
            <p className="mt-0.5 text-[10.5px] leading-snug text-ink-3">{p.src}</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Эхний үсгийг том болгоно ("үгүй" → "Үгүй"). */
function cap(t: string) {
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** Тоон муж бүрийн ард нэгж залгана: "5–40 (налуу), 3–7 (хөндий)" →
    "5–40 м (налуу), 3–7 м (хөндий)". Тоогүй бичвэр ("тогтмол бус") хэвээр,
    эхний үсэг нь томорно. */
function withUnit(t: string, unit: string) {
  return cap(t.replace(/(\d+(?:\.\d+)?(?:–\d+(?:\.\d+)?)?\+?)/g, `$1${unit}`));
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="shrink-0 text-[11px] text-ink-3">{label}</dt>
      <dd className={cn("num min-w-0 text-right text-[12px]", value ? "text-ink" : "text-ink-3")}>{value ?? "Бүртгэгдээгүй"}</dd>
    </div>
  );
}

/* Үеийн бүтэц эх сурвалжид "A1 0–12 · A2 12–43 · Bw 43–93 (хайрга ≤62%) · C"
   гэсэн бичвэр. Хэсэг бүрийг тэмдэглэгээ · гүн · тэмдэглэл болгож задална;
   өнгө нь блок, хуулгатай НЭГ ангиллаас (HCLS). Задрахгүй бол бичвэр хэвээр. */
type HRow = { code: string; depth: string; note: string };
function parseHorizons(raw: string): HRow[] | null {
  const rows: HRow[] = [];
  for (const part of raw.split(" · ")) {
    const m = /^(\S+)\s*(.*)$/.exec(part.trim());
    if (!m) return null;
    const rest = m[2];
    const d = /(\d+(?:–\d+|\+))/.exec(rest);
    const note = (d ? rest.replace(d[1], "") : rest).replace(/[()]/g, "").replace(/\s+/g, " ").trim();
    rows.push({ code: m[1], depth: d ? `${d[1]} см` : "—", note });
  }
  return rows.length ? rows : null;
}

function Horizons({ raw }: { raw: string }) {
  const rows = parseHorizons(raw);
  return (
    <div>
      <span className="eyebrow block text-ink-3">Үеийн бүтэц</span>
      {rows ? (
        <ul className="mt-1 divide-y divide-line">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2 py-[4px]">
              <span className="h-[10px] w-[10px] shrink-0 rounded-xs border border-line" style={{ background: HCLS[hcls(r.code)]?.color }} />
              <span className="w-[52px] shrink-0 truncate text-[11.5px] font-semibold text-ink">{r.code}</span>
              <span className="num w-[64px] shrink-0 text-[11.5px] text-ink-2">{r.depth}</span>
              <span className="min-w-0 truncate text-[11px] text-ink-3" title={r.note}>
                {r.note ? cap(r.note) : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{raw}</p>
      )}
    </div>
  );
}
