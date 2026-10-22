"use client";

import * as React from "react";
import { ArrowLeft, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { Card, Field } from "@/components/analysis/ui";
import {
  defaultParams,
  fetchLatrineAddress,
  fetchLatrineSim,
  simulate,
  type SimData,
  type SimParams,
  type SimResult,
} from "@/lib/latrine-sim";
import { createPit3D, loadThree, type Pit3D, type Species } from "@/lib/latrine-sim-3d";
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
const MAIN: Slider[] = [
  { key: "pit", label: "Нүхний гүн", min: 0.5, max: 6, step: 0.1, fmt: (v) => `${v.toFixed(1)} м` },
  { key: "gw", label: "Гүний усны гүн", min: 0.5, max: 40, step: 0.1, fmt: (v) => `${v.toFixed(1)} м` },
  { key: "hh", label: "Ам бүл", min: 1, max: 10, step: 0.1, fmt: (v) => `${v.toFixed(1)} хүн` },
  { key: "years", label: "Симуляцийн хугацаа", min: 5, max: 50, step: 5, fmt: (v) => `${v} жил` },
];
/* ⚠ Уст давхаргын шүүлт (`kaq`), гүний усны налуу (`grad`), холилдох зузаан
   (`mix`), E.coli устах хурдны үржүүлэгч (`lamx`) гулсуур ХАСАГДСАН (хэрэглэгч
   2026-10-12: "del") — утга нь `defaultParams`-ын анхдагчаараа тооцоонд орсоор. */
const ADV: Slider[] = [
  { key: "wid", label: "Нүхний өргөн", min: 0.8, max: 2.5, step: 0.1, fmt: (v) => `${v.toFixed(1)} м` },
  { key: "hw", label: "Нүхэн дэх шингэний өндөр", min: 0.05, max: 1.5, step: 0.05, fmt: (v) => `${v.toFixed(2)} м` },
  { key: "lpp", label: "Нэг хүний өдрийн шингэн", min: 0.5, max: 10, step: 0.1, fmt: (v) => `${v.toFixed(1)} л` },
  { key: "fn", label: "Азотын нэвчих хувь", min: 0.1, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "rch", label: "Хур борооны тэжээл", min: 0, max: 80, step: 1, fmt: (v) => `${v} мм/жил` },
  { key: "dn", label: "Гүний усанд азот задрах хагас хугацаа", min: 0, max: 50, step: 1, fmt: (v) => (v ? `${v} жил` : "Задрахгүй") },
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
  /* ⚠ Дуслууд УНТРААЛТТАЙ (хэрэглэгч 2026-10-12, зургаар: "иймэрхүү цагаан
     зүйл анивчаад байна"). Нүхнээс төрөөд гүний усанд хүрч дахин төрдөг 2,200
     цагаан цэг зүсэлтийн нүүрэн дээр асаж унтарч харагддаг байв; сэлгэх товч нь
     аль хэдийн хасагдсан тул анхдагч нь л харагдах эсэхийг шийднэ. */
  const [drops, setDrops] = React.useState(false);
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
    if (!data || !wanted || !hostEl) return;
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
        /* ⚠ Нүх сүвний цонх (`micro`) ДАМЖУУЛАХГҮЙ — хэрэглэгч 2026-10-12-нд
           устгуулсан; хөдөлгүүр түүнгүйгээр томруулсан зураг, тэмдгээ унтраана */
        const made = createPit3D(THREE, { container: hostEl, tiles, onSpeed: setSpeed });
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
  }, [data, wanted, hostEl]);

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
    species, setSpecies, drops, setDrops, speed, threeErr,
    setHost, reset,
    frame: () => eng?.frame(),
  };
}

export type LatrineSimState = ReturnType<typeof useLatrineSim>;

/**
 * 3D хэсэг — хөрсний блокийн ДЭЭГҮҮР бүрэн хучина. Нуух үед
 * `invisible`: хэмжээ хадгалагдаж, товшилт доорх SceneView руу дамжина.
 */
export function SimStage({ sim, open, onBack }: { sim: LatrineSimState; open: boolean; onBack: () => void }) {
  const { data, result, snap, t, playing, threeErr, busy } = sim;
  const { error, setHost, setT, setPlaying } = sim;

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

        {/* Дээд зүүн — зөвхөн буцах товч. ⚠ Жорлонгийн дугаар, улирал, зүйл
            (азот · E.coli), дусал, "Эхний байрлал" товч, дуслын хурдны тайлбар
            УСТСАН (хэрэглэгч 2026-10-12: "eniig uldeegeed busdiin del") —
            хөдөлгүүр анхдагчаараа (азот, дусалтай) зурна. */}
        <button
          type="button"
          onClick={onBack}
          className="elevated absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-xs border border-line bg-paper/92 px-2 py-1 text-[11.5px] text-ink backdrop-blur-sm hover:bg-paper-hi"
        >
          <ArrowLeft size={13} /> Хөрсний зүсэлт рүү буцах
        </button>
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
          className="sim-range min-w-0 flex-1"
          style={{ "--pct": `${result && result.snaps.length > 1 ? (t / (result.snaps.length - 1)) * 100 : 0}%` } as React.CSSProperties}
          aria-label="Хугацаа"
        />
        <b className="num w-[70px] text-right text-[12px] font-medium text-ink">{snap ? (snap.d / 365).toFixed(1) : "0.0"} жил</b>
      </div>
    </div>
  );
}

/**
 * Баруун багана — ТОХИРГОО эхэнд (хэрэглэгч 2026-10-01: "ТОХИРГОО heseg
 * map baruun tald garna"), дараа нь сонгосон жорлонгийн шинж.
 * ⚠ "ГАЗРЫН ДООРХ БАГАНА" карт УСТСАН (хэрэглэгч 2026-10-12: "del").
 * ⚠ "ҮР ДҮН" карт УСТСАН (хэрэглэгч 2026-10-12: "del").
 */
export function SimSide({ sim }: { sim: LatrineSimState }) {
  const { data, sel, params } = sim;
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
      {/* ⚠ Бохирдуулагч сонгох карт ТОХИРГООНЫ ДЭЭР (хэрэглэгч 2026-10-12:
          "ТОХИРГОО дээр шинэ карт нээж байгаад e coli болон нитрат гэсэн 2
          button"). Зургийн зүүн дээд цонхноос хасагдсан сонголт энд шилжсэн —
          `useLatrineSim`-ийн ижил `species` төлөвийг удирдана. Товч нь
          хөрсний зүсэлтийн "Бохирдлын нэвчилт" карттай НЭГ хэлбэртэй, гэхдээ
          хоёр тэнцүү багана. */}
      <Card title="БОХИРДУУЛАГЧ">
        <div className="grid grid-cols-2 gap-1">
          {(["N", "E"] as Species[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={sim.species === k}
              onClick={() => sim.setSpecies(k)}
              className={cn(
                "rounded-xs border px-2 py-1 text-[11.5px] transition-colors",
                sim.species === k ? "border-(--tone) bg-(--tone)/15 text-ink" : "border-line text-ink-2 hover:bg-paper-hi hover:text-ink",
              )}
            >
              {k === "N" ? "Азот (нитрат)" : "E.coli"}
            </button>
          ))}
        </div>
      </Card>
      <Card
        title="ТОХИРГОО"
        fill={MAIN.length}
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
      </Card>
      {/* ⚠ "Нарийвчилсан тохиргоо" хураагч ХАСАГДСАН, үлдсэн гулсуурууд ТУСДАА
          КАРТ (хэрэглэгч 2026-10-12: "энэ үг хэрэггүй" → "тусдаа карт болох
          байсан"). Хураагдахгүй, бүтнээрээ харагдана. */}
      <Card title="НЭМЭЛТ ТОХИРГОО" fill={ADV.length}>
        <Sliders list={ADV} p={params} set={sim.setParams} />
      </Card>
      <Info data={data} i={sel} />
    </>
  );
}

function Sliders({ list, p, set }: { list: Slider[]; p: SimParams; set: (f: (p: SimParams | null) => SimParams | null) => void }) {
  return (
    /* ⚠ Мөр НЯГТ (~30px — хэрэглэгч 2026-10-12: "баруун панелийн scroll-ийг
       del") боловч баганын илүү өндрийг ЖИГД ТАРААНА (`justify-around`, карт нь
       `Card fill`-ээр сунана) — эс тэгвээс доор нь их хоосон зай үлдэж байв
       ("доор аягүй их зай үлдчихлээ"). Нам дэлгэц дээр нягтаараа багтана. */
    <div className="flex flex-1 flex-col justify-around gap-0.5">
      {list.map((s) => {
        const v = p[s.key] as number;
        const shown = s.log ? Math.log10(v) : v;
        const pct = Math.min(100, Math.max(0, ((shown - s.min) / (s.max - s.min || 1)) * 100));
        return (
          <label key={s.key} className="block">
            <span className="flex items-baseline justify-between gap-2 text-[11px] text-ink-2">
              {s.label} <b className="num text-[12px] font-semibold text-ink">{s.fmt(v)}</b>
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
              className="sim-range mt-0.5"
              style={{ "--pct": `${pct}%` } as React.CSSProperties}
            />
          </label>
        );
      })}
    </div>
  );
}

/* ⚠ Зөвхөн "Байршил" нь ХАЯГААР (хэрэглэгч 2026-10-12: "зүгээр байршил гээд
   байршил нь байхад болно" → "Байршил — хаяг нь шүү"): дүүрэг, хороо, гудамж,
   тоот. Хаяг порталаас сонгох үед татагдана (`fetchLatrineAddress`) — нийтийн
   багцад ОРООГҮЙ. Татагдах хүртэл "…", олдохгүй бол "Тодорхойгүй". */
function Info({ data, i }: { data: SimData; i: number }) {
  const id = data.id[i];
  const [addr, setAddr] = React.useState<{ id: number; text: string } | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetchLatrineAddress(id).then(
      (t) => alive && setAddr({ id, text: t ?? "Тодорхойгүй" }),
      () => alive && setAddr({ id, text: "Тодорхойгүй" }),
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <Card title="СОНГОСОН ЖОРЛОН">
      <dl>
        <Field label="Байршил" value={addr?.id === id ? addr.text : "…"} />
      </dl>
    </Card>
  );
}
