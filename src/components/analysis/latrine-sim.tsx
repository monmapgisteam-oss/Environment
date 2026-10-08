"use client";

import * as React from "react";
import { ArrowLeft, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { Card, Field } from "@/components/analysis/ui";
import {
  MATS,
  NORM_N,
  TEX,
  defaultParams,
  fetchLatrineSim,
  fmtSince,
  isWinter,
  simulate,
  type SimData,
  type SimParams,
  type SimResult,
} from "@/lib/latrine-sim";
import { RE3, RN3, createPit3D, loadThree, rampC, type Pit3D, type Species } from "@/lib/latrine-sim-3d";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   НЭВЧИЛТИЙН СИМУЛЯЦИ — нэг жорлонгийн нүхний 3D зүсэлт

   Эх: `UB_latrine_leaching_sim.html`-ийн 3D хэсэг (хэрэглэгч 2026-09-30:
   "ene html hurwuuleed oruul 3d hesgiig"). Эх хуудасны 2D зүсэлт, шугаман
   график, "Хэрхэн тооцдог вэ" хэсэг ОРООГҮЙ — эхний хоёр нь 3D биш,
   сүүлийнх нь арга зүйн тайлбар (дэлгэцэд гарахгүй, {@link
   src/lib/latrine-sim.ts}-ийн толгойд бий).

   ⚠⚠ ТУСДАА ХАРАГДАЦ БИШ — "ХӨРСНИЙ ЗҮСЭЛТ"-ИЙН ДОТОРХ ГОРИМ
   (хэрэглэгч 2026-10-01: "newchiltiin simulationg … niiluuley …
   ЖОРЛОН СОНГОХ ene heseg hereggui hursnii zuseltees jorlon songodog
   bolgochihod bolno … ТОХИРГОО heseg map baruun tald garna").
   Хөрсний блок дээр жорлон товшиход 3D зураг энэ хэсгээр солигдож,
   баруун багана нь ТОХИРГОО, ҮР ДҮН, жорлонгийн шинж болно; буцахад
   хөрсний зүсэлт байрандаа.
   Тиймээс гурван хэсэгт хуваагдсан: төлөвийг `useLatrineSim` эзэмшиж,
   `SimStage` (зургийн оронд) ба `SimSide` (баруун багана) хоёр НЭГ
   төлөвийг уншина.
   ⚠ Тусдаа сонгох газрын зураг (WellsMap) ба дугаараар хайлт ХАСАГДСАН.

   ⚠⚠ ХУРДАН НЭЭГДЭЖ, ХУРДАН БУЦНА:
     · Хөрсний SceneView УСТАХГҮЙ — симуляци түүний ДЭЭГҮҮР хучна;
       буцахад дахин ачаалах зүйл байхгүй.
     · three.js хөдөлгүүр анх нээхэд НЭГ УДАА үүсч, дараа нь устахгүй —
       нуух үед давталт нь зогсоно (`pause`), харагдах үед үргэлжилнэ.
     · Нуухдаа `invisible` (хэмжээ хадгалагдана) — `hidden` бол
       ResizeObserver 0 хэмжээ авч дахин нээхэд зураг анивчина.
     · three.js-ийн CDN татац хөрсний блок бэлэн болмогц урьдчилан
       эхэлнэ (`soil-scene.tsx`); симуляцийн багц аль хэдийн татагдсан
       (жорлонгийн давхарга түүнээс уншдаг, `fetchLatrineSim` кэштэй).
   -------------------------------------------------------------------------- */

type Slider = { key: keyof SimParams; label: string; min: number; max: number; step: number; fmt: (v: number) => string; log?: boolean };
const fmtK = (k: number) => (k < 0.1 ? k.toFixed(3) : k < 1 ? k.toFixed(2) : k < 10 ? k.toFixed(1) : `${Math.round(k)}`);
const MAIN: Slider[] = [
  { key: "pit", label: "Нүхний гүн", min: 0.5, max: 6, step: 0.1, fmt: (v) => `${v.toFixed(1)} м` },
  { key: "gw", label: "Гүний усны гүн", min: 0.5, max: 40, step: 0.1, fmt: (v) => `${v.toFixed(1)} м` },
  { key: "hh", label: "Ам бүл", min: 1, max: 10, step: 0.1, fmt: (v) => `${v.toFixed(1)} хүн` },
  { key: "years", label: "Симуляцийн хугацаа", min: 5, max: 50, step: 5, fmt: (v) => `${v} жил` },
];
const ADV: Slider[] = [
  { key: "wid", label: "Нүхний өргөн", min: 0.8, max: 2.5, step: 0.1, fmt: (v) => `${v.toFixed(1)} м` },
  { key: "hw", label: "Нүхэн дэх шингэний өндөр", min: 0.05, max: 1.5, step: 0.05, fmt: (v) => `${v.toFixed(2)} м` },
  { key: "lpp", label: "Нэг хүний өдрийн шингэн", min: 0.5, max: 10, step: 0.1, fmt: (v) => `${v.toFixed(1)} л` },
  { key: "fn", label: "Азотын нэвчих хувь", min: 0.1, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "kaq", label: "Уст давхаргын шүүлт", min: -1.5, max: 2, step: 0.05, fmt: (v) => `${fmtK(v)} м/өдөр`, log: true },
  { key: "rch", label: "Хур борооны тэжээл", min: 0, max: 80, step: 1, fmt: (v) => `${v} мм/жил` },
  { key: "dn", label: "Гүний усанд азот задрах хагас хугацаа", min: 0, max: 50, step: 1, fmt: (v) => (v ? `${v} жил` : "Задрахгүй") },
  { key: "grad", label: "Гүний усны налуу", min: 0.001, max: 0.05, step: 0.001, fmt: (v) => v.toFixed(3) },
  { key: "mix", label: "Холилдох зузаан", min: 1, max: 20, step: 1, fmt: (v) => `${v} м` },
  { key: "lamx", label: "E.coli устах хурдны үржүүлэгч", min: 0.2, max: 3, step: 0.1, fmt: (v) => `×${v.toFixed(1)}` },
];

/**
 * Симуляцийн бүх төлөв. `sel` нь багцын индекс (`-1` — сонгоогүй),
 * `open` нь 3D харагдаж байгаа эсэх: хаахад хөдөлгүүр устахгүй.
 */
export function useLatrineSim(sel: number, open: boolean) {
  const [data, setData] = React.useState<SimData | null>(null);
  const [error, setError] = React.useState("");
  const [params, setParams] = React.useState<SimParams | null>(null);
  /* ⚠ Үр дүн нь ТОХИРГООТОЙГОО хамт — "тооцоолж байна" гэдгийг эндээс
     дам гаргана (эффект дотор setState дуудахгүй) */
  const [run, setRun] = React.useState<{ p: SimParams; r: SimResult } | null>(null);
  const [t, setT] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [species, setSpecies] = React.useState<Species>("N");
  const [drops, setDrops] = React.useState(true);
  const [depth, setDepth] = React.useState(3);
  const [depthMax, setDepthMax] = React.useState(10);
  const [microInfo, setMicroInfo] = React.useState("");
  const [speed, setSpeed] = React.useState("");
  const [threeErr, setThreeErr] = React.useState("");
  /* ⚠ Хөдөлгүүр ТӨЛӨВТ (ref биш): бэлэн болмогц өмнө нь бодогдсон үр дүн,
     зүйл, дусал эффектүүдээр дамжуулагдана, мөн дуудагч тал руу ref
     алдагдахгүй (`react-hooks/refs` нь ref агуулсан объектыг бүхэлд нь хаадаг) */
  const [eng, setEng] = React.useState<Pit3D | null>(null);
  /* ⚠ Сонголт солигдоход анхдагч тохиргоо — эффектээр биш ДАМ (зурагдалтын
     үеийн төлөвийн засвар): тохиргоо аль жорлонгийнх болохыг хамт барина */
  const [forSel, setForSel] = React.useState(-1);
  /* Хөдөлгүүрийг анх нээх үед л үүсгэнэ — хөрсний зүсэлтийн ачаалалд саад болохгүй */
  const [wanted, setWanted] = React.useState(false);
  if (open && !wanted) setWanted(true);

  /* ⚠ Элементүүд CALLBACK REF-ээр төлөвт ирнэ: `ref={sim.host}` гэж объектын
     гишүүнээр дамжуулах нь `react-hooks/refs`-т хориотой */
  const [hostEl, setHost] = React.useState<HTMLDivElement | null>(null);
  const [microEl, setMicro] = React.useState<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    fetchLatrineSim().then(setData, (e: Error) => setError(e.message));
  }, []);

  if (data && sel >= 0 && sel !== forSel) {
    setForSel(sel);
    setParams(defaultParams(data, sel));
    setT(0);
    setPlaying(false);
  }

  /* ── 3D хөдөлгүүр — НЭГ УДАА ── */
  React.useEffect(() => {
    if (!data || !wanted || !hostEl || !microEl) return;
    let alive = true;
    let mine: Pit3D | null = null;
    const urls: string[] = [];
    const tiles: Record<string, HTMLImageElement> = {};
    for (const [k, b] of Object.entries(data.tiles)) {
      const u = URL.createObjectURL(b);
      urls.push(u);
      const im = new Image();
      im.src = u;
      tiles[k] = im;
    }
    loadThree().then(
      (THREE) => {
        if (!alive) return;
        let made: Pit3D | null = null;
        made = createPit3D(THREE, {
          container: hostEl,
          tiles,
          micro: microEl,
          onMicro: setMicroInfo,
          onDepth: (m) => {
            setDepth(m);
            setDepthMax(made?.depthMax() ?? 10);
          },
          onSpeed: setSpeed,
        });
        mine = made;
        setEng(made);
      },
      (e: Error) => alive && setThreeErr(e.message),
    );
    return () => {
      alive = false;
      mine?.destroy();
      setEng(null);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [data, wanted, hostEl, microEl]);

  React.useEffect(() => {
    if (open) eng?.resume();
    else eng?.pause();
  }, [open, eng]);

  /* ── Симуляци — тохиргоо өөрчлөгдөхөд 250 мс хүлээгээд ── */
  React.useEffect(() => {
    if (!params || !data) return;
    const h = window.setTimeout(() => {
      const r = simulate(params);
      setRun({ p: params, r });
      setT((v) => Math.min(v, r.snaps.length - 1));
    }, 250);
    return () => window.clearTimeout(h);
  }, [params, data]);
  React.useEffect(() => {
    if (run && data) eng?.setRun(run.r, run.p, data.profiles);
  }, [run, data, eng]);

  const result = run?.r ?? null;
  const busy = !!params && run?.p !== params;
  const snap = result?.snaps[Math.min(t, (result?.snaps.length ?? 1) - 1)] ?? null;
  React.useEffect(() => {
    if (snap) eng?.update(snap);
  }, [snap, result, eng]);
  React.useEffect(() => {
    eng?.setSpecies(species);
  }, [species, eng]);
  React.useEffect(() => {
    eng?.setDrops(drops);
  }, [drops, eng]);

  /* ── Тоглуулах — хаагдсан үед зогсоно ── */
  React.useEffect(() => {
    if (!playing || !result || !open) return;
    const id = window.setInterval(() => {
      setT((v) => {
        if (v >= result.snaps.length - 1) {
          setPlaying(false);
          return v;
        }
        return Math.min(result.snaps.length - 1, v + 2);
      });
    }, 60);
    return () => window.clearInterval(id);
  }, [playing, result, open]);

  const reset = () => {
    if (data && sel >= 0) setParams(defaultParams(data, sel));
  };

  return {
    data, error, sel, params, setParams, result, busy, snap, t, setT, playing, setPlaying,
    species, setSpecies, drops, setDrops, depth, setDepth, depthMax, microInfo, speed, threeErr,
    setHost, setMicro, reset,
    frame: () => eng?.frame(),
    moveDepth: (m: number) => {
      setDepth(m);
      eng?.setDepth(m);
    },
  };
}

export type LatrineSimState = ReturnType<typeof useLatrineSim>;

/**
 * 3D хэсэг — хөрсний блокийн ДЭЭГҮҮР бүрэн хучина. Нуух үед
 * `invisible`: хэмжээ хадгалагдаж, товшилт доорх SceneView руу дамжина.
 */
export function SimStage({ sim, open, onBack }: { sim: LatrineSimState; open: boolean; onBack: () => void }) {
  const { data, sel, result, snap, t, playing, species, drops, depth, depthMax, microInfo, speed, threeErr, busy } = sim;
  const { error, setHost, setMicro, frame, moveDepth, setSpecies, setDrops, setT, setPlaying } = sim;
  const winter = snap ? isWinter(snap.d) : false;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onBack]);

  return (
    <div className={cn("absolute inset-0 z-20 flex flex-col bg-paper-2", !open && "invisible")} aria-hidden={!open}>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#18222d]">
        <div ref={setHost} className="absolute inset-0" />
        {threeErr || error || !data ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 p-6">
            {threeErr || error ? (
              <span className="max-w-[360px] text-center text-[12px] text-ink-2">{threeErr || error}</span>
            ) : (
              <>
                <Loader2 size={15} className="animate-spin text-ink-3" />
                <span className="text-[12px] text-ink-2">Симуляци ачаалж байна</span>
              </>
            )}
          </div>
        ) : null}
        {busy ? (
          <span className="absolute top-2 right-2 flex items-center gap-1.5 rounded-xs border border-line bg-paper/90 px-2 py-1 text-[11px] text-ink-2">
            <Loader2 size={12} className="animate-spin" /> Тооцоолж байна
          </span>
        ) : null}

        {/* Дээд зүүн — буцах, удирдлага */}
        <div className="elevated absolute top-2 left-2 z-10 max-w-[340px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={onBack}
            className="mb-1.5 flex items-center gap-1.5 rounded-xs border border-line px-2 py-1 text-[11.5px] text-ink hover:bg-paper-hi"
          >
            <ArrowLeft size={13} /> Хөрсний зүсэлт рүү буцах
          </button>
          <div className="text-[12px] font-semibold text-ink">
            ЖОРЛОН {data && sel >= 0 ? data.id[sel] : ""} · <span className="num">{snap ? (snap.d / 365).toFixed(1) : "0"}</span> жил
          </div>
          <div className={cn("mt-0.5 text-[11px]", winter ? "text-(--water)" : "text-(--moss)")}>
            {winter ? "Өвөл: хөрс хөлдсөн, шингэн нэвчихгүй" : "Дулаан улирал: шингэн хөрсөөр нэвчиж байна"}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(["N", "E"] as Species[]).map((s) => (
              <Seg key={s} on={species === s} onClick={() => setSpecies(s)}>
                {s === "N" ? "Азот (нитрат)" : "E.coli"}
              </Seg>
            ))}
            <Seg on={drops} onClick={() => setDrops((v) => !v)}>
              Дуслууд
            </Seg>
            <Seg on={false} onClick={frame}>
              Эхний байрлал
            </Seg>
          </div>
          {speed ? <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{speed}</p> : null}
        </div>

        {/* Доод зүүн — нүх сүв.
            ⚠⚠ ЖИЖИГРҮҮЛСЭН (хэрэглэгч 2026-09-30: "eniig jijighen bolgo"):
            гүн, бүс, нитрат, E.coli, хуулга (зөвхөн нитрат, E.coli) үлдсэн.
            ⚠ Дотоод нарийвчлал 600×400 ХЭВЭЭР: ширхэгийн радиус пикселээр
            (600 px ≈ 2.5 мм) тохируулагдсан тул багасгавал масштаб эвдэрнэ. */}
        <div className="elevated absolute bottom-2 left-2 z-10 w-[216px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-sm">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-semibold text-ink">Нүх сүв</span>
            <span className="text-ink-3">≈ 2.5 мм талбай</span>
          </div>
          <canvas ref={setMicro} width={600} height={400} className="mt-1 block h-[131px] w-[196px] rounded-xs bg-[#2a2118]" />
          <label className="mt-1 flex items-center justify-between text-[11px] text-ink-3">
            Гүн <b className="num font-medium text-ink">{depth.toFixed(2)} м</b>
          </label>
          <input
            type="range"
            min={0}
            max={depthMax}
            step={0.05}
            value={depth}
            onChange={(e) => moveDepth(Number(e.target.value))}
            className="w-full accent-(--tone)"
          />
          <p className="mt-0.5 text-[11px] leading-snug whitespace-pre-line text-ink-2">{microInfo}</p>
          <p className="mt-0.5 text-[10.5px] text-ink-3">
            <span className="text-[#e0b000]">●</span> нитрат · <span className="text-[#a46cf0]">▬</span> E.coli
          </p>
        </div>

        {/* Доод баруун — хуулга */}
        <div className="elevated absolute right-2 bottom-2 z-10 w-[220px] rounded-xs border border-line bg-paper/92 px-2.5 py-2 backdrop-blur-sm">
          <div className="text-[11.5px] font-semibold text-ink">
            {species === "N" ? "Хөрсөн дэх азот (нитрат)" : "Хөрсөн дэх E.coli"}
          </div>
          <div className="mt-1 flex h-[10px] overflow-hidden rounded-xs">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <i key={v} className="flex-1" style={{ background: `rgb(${rampC(species === "N" ? RN3 : RE3, v)})` }} />
            ))}
          </div>
          <div className="num mt-0.5 flex justify-between text-[10.5px] text-ink-3">
            {(species === "N" ? ["4 мг/л", "40", "400", "4000"] : ["1", "10³", "10⁷ /100 мл"]).map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <ul className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-ink-2">
            <li>
              <span className="text-[#f0c030]">●</span> азоттой шингэний дусал · <span className="text-[#a870ff]">●</span> E.coli
            </li>
            <li>
              <span className="text-[#80c0ff]">●</span> гүний усанд орсон дусал
            </li>
            <li>
              <span className="text-[#2f7fc0]">■</span> гүний ус (ус ханасан давхарга)
            </li>
          </ul>
        </div>
      </div>

      {/* Цагийн тэнхлэг */}
      <div className="flex shrink-0 items-center gap-2 border-t border-line bg-paper-2 px-2.5 py-1.5">
        <button
          type="button"
          disabled={!result}
          onClick={() => {
            if (!result) return;
            if (!playing && t >= result.snaps.length - 1) setT(0);
            setPlaying((v) => !v);
          }}
          className="flex items-center gap-1 rounded-xs border border-(--tone) px-2 py-1 text-[11.5px] text-ink disabled:opacity-40"
        >
          {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? "Зогсоох" : "Тоглуулах"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, (result?.snaps.length ?? 1) - 1)}
          value={t}
          disabled={!result}
          onChange={(e) => setT(Number(e.target.value))}
          className="min-w-0 flex-1 accent-(--tone)"
          aria-label="Хугацаа"
        />
        <b className="num w-[70px] text-right text-[12px] font-medium text-ink">{snap ? (snap.d / 365).toFixed(1) : "0.0"} жил</b>
      </div>
    </div>
  );
}

/**
 * Баруун багана — ТОХИРГОО эхэнд (хэрэглэгч 2026-10-01: "ТОХИРГОО heseg
 * map baruun tald garna"), дараа нь ҮР ДҮН, сонгосон жорлонгийн шинж.
 */
export function SimSide({ sim }: { sim: LatrineSimState }) {
  const { data, sel, params, result } = sim;
  if (!data || !params || sel < 0)
    return (
      <Card title="ТОХИРГОО">
        <div className="hatch rounded-xs border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-ink-2">
          Мэдээлэл хүлээгдэж байна
        </div>
      </Card>
    );
  return (
    <>
      <Card
        title="ТОХИРГОО"
        action={
          <button
            type="button"
            onClick={sim.reset}
            title="Анхдагч утгаар"
            aria-label="Анхдагч утгаар"
            className="rounded-xs p-1 text-ink-3 hover:bg-paper-hi hover:text-ink"
          >
            <RotateCcw size={13} />
          </button>
        }
      >
        <Sliders list={MAIN} p={params} set={sim.setParams} />
        <details className="mt-2">
          <summary className="cursor-pointer text-[11.5px] text-ink-2">Нарийвчилсан тохиргоо</summary>
          <Sliders list={ADV} p={params} set={sim.setParams} />
        </details>
      </Card>
      <Card title="ҮР ДҮН">
        {result ? <Results r={result} p={params} /> : <p className="text-[11.5px] text-ink-3">Тооцоолж байна</p>}
      </Card>
      <Column p={params} />
      <Info data={data} i={sel} p={params} />
    </>
  );
}

function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-xs border px-2 py-0.5 text-[11px] transition-colors",
        on ? "border-(--tone) bg-(--tone)/15 text-ink" : "border-line text-ink-2 hover:bg-paper-hi",
      )}
    >
      {children}
    </button>
  );
}

function Sliders({ list, p, set }: { list: Slider[]; p: SimParams; set: (f: (p: SimParams | null) => SimParams | null) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((s) => {
        const v = p[s.key] as number;
        const shown = s.log ? Math.log10(v) : v;
        return (
          <label key={s.key} className="block">
            <span className="flex items-baseline justify-between gap-2 text-[11px] text-ink-3">
              {s.label} <b className="num font-medium text-ink">{s.fmt(v)}</b>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={shown}
              onChange={(e) => {
                const x = Number(e.target.value);
                set((o) => (o ? { ...o, [s.key]: s.log ? 10 ** x : x } : o));
              }}
              className="w-full accent-(--tone)"
            />
          </label>
        );
      })}
    </div>
  );
}

/**
 * Газрын доорх багана — загварт орсон давхарга бүр гүнээрээ, шүүлтийн
 * коэффициент, эх сурвалжтайгаа (хэрэглэгч 2026-10-07: "Үе бүрийн шүүрүүлэх
 * чадвар … Цооногийн бичиглэл"). Нүхний ёроол орсон мөр тодорно; сүүлд нь
 * гүний усны түвшин.
 * ⚠ Ks-ийн өнгө нь ҮНЭ ЦЭНЭ БИШ, ХУРД: бүдүүн ширхэгтэй (хурдан) нь
 * `--clay`, нарийн (удаан) нь `--moss` — бохирдлын эрсдэлийн чиглэлээр.
 */
function Column({ p }: { p: SimParams }) {
  const rows = (p.col ?? []).filter((l) => l.top < p.gw - 1e-6).map((l) => ({ ...l, bot: Math.min(l.bot, p.gw) }));
  if (!rows.length) return null;
  const m = (v: number) => (v < 10 ? v.toFixed(2).replace(/\.?0+$/, "") : v.toFixed(1).replace(/\.0$/, ""));
  const speed = (k: number) => (k >= 1 ? "var(--clay)" : k >= 0.15 ? "var(--ochre)" : "var(--moss)");
  return (
    <Card title="ГАЗРЫН ДООРХ БАГАНА">
      <div className="grid grid-cols-[64px_1fr_auto] gap-x-2 border-b border-line pb-1 text-[10px] tracking-wide text-ink-3 uppercase">
        <span>Гүн, м</span>
        <span>Давхарга</span>
        <span className="text-right">Шүүлт, м/өдөр</span>
      </div>
      <div className="divide-y divide-line">
        {rows.map((l) => {
          const pit = p.pit >= l.top && p.pit < l.bot;
          return (
            <div
              key={`${l.top}-${l.name}`}
              className={cn("grid grid-cols-[64px_1fr_auto] gap-x-2 py-1.5", pit && "bg-paper-3")}
              style={pit ? { boxShadow: "inset 2px 0 0 var(--tone)" } : undefined}
            >
              <span className="num pl-1 text-[11px] text-ink-2">
                {m(l.top)}–{m(l.bot)}
              </span>
              <span className="min-w-0 text-[11.5px] leading-snug text-ink">
                {l.name}
                <span className="block text-[10.5px] text-ink-3">
                  {TEX[l.cls].n}
                  {l.gravel ? ` · хайрга ${Math.round(l.gravel)}%` : ""}
                  {pit ? " · нүхний ёроол" : ""}
                </span>
                <span className="block text-[10.5px] text-ink-3">{l.src}</span>
              </span>
              <span className="num text-right text-[11.5px] font-medium" style={{ color: speed(l.Ks) }}>
                {fmtK(l.Ks)}
              </span>
            </div>
          );
        })}
        <div className="grid grid-cols-[64px_1fr] gap-x-2 py-1.5 text-[11.5px]">
          <span className="num pl-1 text-ink-2">{m(p.gw)}</span>
          <span className="text-(--water)">Гүний усны түвшин</span>
        </div>
      </div>
    </Card>
  );
}

function Info({ data, i, p }: { data: SimData; i: number; p: SimParams }) {
  const pr = data.profiles[data.soil[i]];
  const m = MATS[data.mat[i]];
  /* Нүхний ёроол орсон давхарга — баганаас */
  const under = p.col?.find((l) => p.pit >= l.top && p.pit < l.bot);
  const g = data.gcodes[data.gcode[i]];
  return (
    <Card title="СОНГОСОН ЖОРЛОН">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label="Дугаар" value={`${data.id[i]}`} />
        <Field label="Хороо" value={data.khList[data.kh[i]] || "Тодорхойгүй"} />
        <Field label="Хөрсний хэв шинж" value={pr.name} />
        <Field label="Нүхний доорх хөрс" value={under ? TEX[under.cls].n : m.tex} />
        <Field label="1 га-д жорлон" value={`${data.dens[i]}`} />
        <Field label="Байршил" value={data.valley[i] ? "Хөндий" : "Тэгш тал, энгэр"} />
      </dl>
      <dl className="mt-2 flex flex-col gap-2">
        <Field label="Геологи" value={`${m.n}${g ? ` · ${g}` : ""}`} />
        <Field
          label="Гүний усны гүнийн эх үүсвэр"
          value={data.src[i] === 1 ? `500 м доторх ${data.nwell[i]} гар худаг` : `Хөрсний хүснэгт (${pr.gw})`}
        />
      </dl>
    </Card>
  );
}

function Results({ r, p }: { r: SimResult; p: SimParams }) {
  const a = r.F ? r.F.a : 0;
  type Row = [tone: "bad" | "warn" | "ok" | "", value: string, label: string];
  const rows: Row[] = [];
  rows.push(
    r.direct
      ? ["bad", "Нүх гүний усанд шууд", "Нүхний ёроол гүний усны түвшинд хүрсэн"]
      : [r.L < 1.5 ? "warn" : "ok", `${r.L.toFixed(1)} м`, "Нүхний ёроолоос гүний ус хүртэлх хөрс"],
  );
  rows.push([
    r.tN == null ? "ok" : r.tN < 365 ? "bad" : "warn",
    r.tN == null ? `${p.years} жилд хүрэхгүй` : fmtSince(r.tN),
    "Азот (нитрат) гүний усанд хүрэх хугацаа",
  ]);
  rows.push([
    r.tE == null ? "ok" : "bad",
    r.tE == null ? "Хүрэхгүй" : fmtSince(r.tE),
    `E.coli гүний усанд хүрэх хугацаа (хамгийн их ${r.maxElog < 0 ? "< 1" : `10^${r.maxElog.toFixed(1)}`} /100 мл)`,
  ]);
  if (!r.direct)
    rows.push([
      r.latN - a > 1.5 ? "warn" : "",
      `${Math.max(0, r.latN - a).toFixed(1)} м · ${Math.max(0, r.latE - a).toFixed(1)} м`,
      "Нүхний хананаас хажуу тийш тархах зай: нитрат · E.coli",
    ]);
  rows.push([
    r.tNorm == null ? "ok" : "bad",
    r.tNorm == null ? "Давахгүй" : fmtSince(r.tNorm),
    "Гүний усан дахь нитрат нормоос давах хугацаа",
  ]);
  const at = (y: number) => {
    const k = Math.min(r.snaps.length - 1, Math.round((y * 365) / 15));
    return r.snaps[k] ? r.snaps[k].Cgw : 0;
  };
  const ys = [5, 10, 20, 30].filter((y) => y <= p.years);
  rows.push([
    "",
    ys.map((y) => at(y).toFixed(1)).join(" · "),
    `1 га-гийн гүний усан дахь нитрат, мг/л NO₃-N: ${ys.map((y) => `${y} жил`).join(" · ")} (норм ${NORM_N})`,
  ]);
  const edge = { bad: "var(--clay)", warn: "var(--ochre)", ok: "var(--moss)", "": "var(--line-2)" };
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(([tone, v, l]) => (
        <div key={l} className="rounded-xs bg-paper-3 py-1 pr-2 pl-2.5" style={{ boxShadow: `inset 3px 0 0 ${edge[tone]}` }}>
          <b className="num block text-[15px] font-semibold text-ink">{v}</b>
          <span className="text-[11px] leading-snug text-ink-3">{l}</span>
        </div>
      ))}
      <p className="text-[11px] leading-snug text-ink-3">
        Нүхний шингэн дэх азот ≈ <span className="num">{Math.round(r.C0N).toLocaleString()}</span> мг/л. Нүхнээс хөрсөнд{" "}
        <span className="num">{(r.Qin * 1000).toFixed(1)}</span> л/өдөр нэвчинэ (дулаан улиралд)
        {r.pond ? ". Хөрс шингэнийг бүрэн шингээж чадахгүй тул нүх дүүрнэ" : ""}.
      </p>
    </div>
  );
}
