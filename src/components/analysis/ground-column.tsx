"use client";

import * as React from "react";
import { Layers } from "lucide-react";
import type { PickInfo } from "@/lib/soil-scene";
import { HCLS, mulberry32 } from "@/lib/soil-profile";
import { MATS, boreholeFor } from "@/lib/latrine-sim";
import { fetchGeology, type Geology } from "@/lib/geology";
import { geologyTexture, soilTexture, soilTilesOnce, type PhotoTiles } from "@/lib/soil-texture";

/* --------------------------------------------------------------------------
   ГАЗРЫН ДООРХ БАГАНА — сонгосон цэгийн монолит, гүний ус хүртэл

   Хэрэглэгч 2026-10-12: "диаграмаа болиод зүгээр монолит шиг хармаар байна,
   аль үе давхаргад ямар геологи байгааг тусад нь" → "Нэг монолит, үе
   үеэрээ". "Бохирдлын нэвчилт · гүний ус хүртэл" 2D диаграмын ОРОНД.
   · 0–2 м: тухайн цэгийн хөрсний үеүүд ("СОНГОСОН ЦЭГ"-ийн монолиттой
     НЭГ `PickInfo.hz`, бүтэц нь `soilTexture`);
   · 2 м-ээс доош: ойрын цооног (`boreholeFor` — ижил геологи, 1 км дотор)
     байвал түүний давхаргууд, дараа нь геологийн зургийн материал (JICA
     2013, `geologyTexture`), гүний ус хүртэл.
   ⚠⚠ ХЭЛБЭР нь "СОНГОСОН ЦЭГ"-ийн монолитынх (`profileSVG`): ТОГТМОЛ
   харьцаатай блок, дээд талд навч, өвс, баруун хажуу сүүдэртэй, хил
   долгиолог, үеийн код ЗҮҮН талд, гүн нь БАРУУН талд. Урьд нь самбарын
   бүтэн өндрөөр сунадаг байсан (хэрэглэгч 2026-10-12: "маш муухай урт
   сунасан"). Бүтэн нэр, гүн нь блокийн ДООРХ жагсаалтад.
   ⚠ Босоо масштаб ХОЁР хэсэгтэй: 0–2 м өндрийн 45%-ийг, 2 м-ээс доош
   үлдсэнийг эзэлнэ — 2 м-ийн хөрс 20 м-ийн гүнд цаасны зузаан болохгүй.
   Заагт тасархай зураас; бүх гүн МЕТРЭЭР (нэг нэгж — хэрэглэгч 2026-10-06
   см, м холилдсонд дургүйцсэн).
   ⚠ Бүтэц, өнгө нь зургийн агуулга (тогтмол); шошго горимыг дагана.
   -------------------------------------------------------------------------- */

const SOIL_SHARE = 0.45;
const DEPTH_MAX = 30;
/* Монолитын хэмжээ (viewBox) — "СОНГОСОН ЦЭГ"-ийнхтэй ижил харьцаа */
const VW = 274;
const X = 58;
const CW = 132;
const SX = 34;
const SY = -20;
const T = 52;
const BH = 290;
const VH = T + BH + 16;
const RX = X + CW + SX;

let geoP: Promise<Geology | null> | null = null;
const URLS = new Map<string, string>();
/** Бүтцийн зураг (data URL) — "s:<ангилал>" эсвэл "g:<материал>" */
function texUrl(key: string, photos: PhotoTiles | null) {
  let u = URLS.get(key);
  if (!u) {
    const [k, v] = key.split(":");
    const cv = k === "s" ? soilTexture(v, 0.1, photos) : geologyTexture(Number(v), photos);
    u = cv.toDataURL("image/jpeg", 0.85);
    URLS.set(key, u);
  }
  return u;
}

type Row = { top: number; bot: number; code: string; name: string; sub: string; tex: string | null; soil: boolean };

/** Гүн, м — 1-ээс бага бол хоёр, 10 хүртэл нэг орон, түүнээс дээш бүхэл */
const fmt = (m: number) => String(Number(m.toFixed(m < 1 ? 2 : m < 10 ? 1 : 0)));

const pts = (p: number[][]) => p.map((v) => `${v[0].toFixed(1)},${v[1].toFixed(1)}`).join(" ");

/** Дээд тал — навчны үлдэгдэл, өвс (монолиттой ижил үр, зурагдалт бүрд ижил) */
const TOP_DECOR = (() => {
  const R = mulberry32(99);
  const onTop = () => {
    const u = R();
    const v = R();
    return [X + u * CW + v * SX, T + v * SY];
  };
  const litter = Array.from({ length: 42 }, () => {
    const [x, y] = onTop();
    return {
      x,
      y,
      rx: 2.6 + R() * 3.4,
      ry: 1.1 + R() * 1.3,
      rot: (R() * 180) | 0,
      c: ["#7a4a22", "#94602e", "#5b3a1e", "#a57438", "#6b5a2a"][(R() * 5) | 0],
    };
  });
  const grass: { d: string; c: string }[] = [];
  for (let i = 0; i < 18; i++) {
    const [x, y] = onTop();
    for (let b = 0; b < 5; b++) {
      const h = 8 + R() * 13;
      const lean = (R() - 0.5) * 11;
      grass.push({
        d: `M${(x + b * 1.2 - 2).toFixed(1)} ${y.toFixed(1)} q${(lean * 0.3).toFixed(1)} ${(-h * 0.6).toFixed(1)} ${lean.toFixed(1)} ${(-h).toFixed(1)}`,
        c: ["#5f8f35", "#77a843", "#4d7a2a", "#8bb851"][(R() * 4) | 0],
      });
    }
  }
  return { litter, grass };
})();

export function GroundColumn({ pick }: { pick: PickInfo | null }) {
  /* Бүтцийн хавтанцар ба геологийн зураг — нэг л удаа татагдана */
  const [photos, setPhotos] = React.useState<PhotoTiles | null | undefined>(undefined);
  const [geo, setGeo] = React.useState<Geology | null | undefined>(undefined);
  React.useEffect(() => {
    let live = true;
    soilTilesOnce().then((t) => live && setPhotos(t));
    geoP ??= fetchGeology().catch(() => null);
    geoP.then((g) => live && setGeo(g));
    return () => {
      live = false;
    };
  }, []);

  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const model = React.useMemo(() => {
    if (!pick || geo === undefined) return null;
    const gw = pick.gwCm / 100;
    const mat = geo?.at(pick.lon, pick.lat) ?? null;
    const rows: Row[] = pick.hz
      .filter((h) => h.b > h.t && h.t < 200)
      .map((h) => ({
        top: h.t / 100,
        bot: Math.min(2, h.b / 100),
        code: h.n,
        name: HCLS[h.c]?.label.split(" — ")[1] ?? "",
        sub: "",
        tex: `s:${h.c}`,
        soil: true,
      }));
    const depth = Math.min(DEPTH_MAX, Number.isFinite(gw) ? Math.max(4, gw + Math.max(1, gw * 0.15)) : 6);
    let at = 2;
    if (mat != null) {
      const bh = boreholeFor(pick.lon, pick.lat, mat);
      for (const l of bh?.layers ?? []) {
        if (l.bot <= at || at >= depth) continue;
        const bot = Math.min(l.bot, depth);
        rows.push({ top: at, bot, code: "", name: l.name, sub: `Цооног ${bh!.id}`, tex: `g:${mat}`, soil: false });
        at = bot;
      }
      if (at < depth) {
        const n = MATS[mat].n;
        const i = n.indexOf(" (");
        rows.push({
          top: at,
          bot: depth,
          code: "",
          name: i > 0 ? n.slice(0, i) : n,
          sub: i > 0 ? n.slice(i + 2, -1) : "",
          tex: `g:${mat}`,
          soil: false,
        });
      }
    } else rows.push({ top: 2, bot: depth, code: "", name: "Геологийн мэдээлэл байхгүй", sub: "", tex: null, soil: false });
    return { rows, depth, gw };
  }, [pick, geo]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xs border border-line bg-paper-2">
      <div className="shrink-0 border-b border-line px-2.5 py-1.5">
        <span className="block text-[12px] font-semibold tracking-[0.02em] text-ink uppercase">Газрын доорх давхарга</span>
        {pick ? <span className="block truncate text-[11px] text-ink-3">{pick.profile.name}</span> : null}
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {!pick ? (
          <div className="hatch absolute inset-2 flex flex-col items-center justify-center gap-1.5 rounded-xs border border-dashed border-line px-3">
            <Layers size={16} strokeWidth={1.5} className="text-ink-3" />
            <span className="text-center text-[11.5px] text-ink-2">Блок дээр товшиход тэр цэгийн газрын доорх давхаргууд харагдана</span>
          </div>
        ) : model && photos !== undefined ? (
          <>
            <div className="px-2 pt-2">
              <Monolith uid={uid} photos={photos} rows={model.rows} depth={model.depth} gw={model.gw} />
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {model.rows.map((r, i) => (
                <li key={i} className="flex items-start gap-2 px-2.5 py-1.5">
                  <span
                    className="mt-0.5 size-3.5 shrink-0 rounded-xs border border-line bg-paper-3 bg-cover"
                    style={r.tex ? { backgroundImage: `url(${texUrl(r.tex, photos)})` } : undefined}
                  />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[11.5px] text-ink">
                      {r.code ? <b className="mr-1 font-bold">{r.code}</b> : null}
                      {r.soil ? <span className="text-ink-2">{r.name}</span> : <b className="font-semibold">{r.name}</b>}
                    </span>
                    {r.sub ? <span className="block text-[10.5px] text-ink-3">{r.sub}</span> : null}
                  </span>
                  <span className="num shrink-0 pt-px text-[10.5px] text-ink-3">
                    {fmt(r.top)}–{fmt(r.bot)} м
                  </span>
                </li>
              ))}
              {Number.isFinite(model.gw) ? (
                <li className="flex items-center gap-2 px-2.5 py-1.5">
                  <span className="w-3.5 shrink-0 text-center text-[11px] text-(--water)">▽</span>
                  <span className="flex-1 text-[11.5px] text-(--water)">Гүний усны түвшин</span>
                  <span className="num shrink-0 text-[10.5px] text-(--water)">{fmt(model.gw)} м</span>
                </li>
              ) : null}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Monolith({
  uid,
  photos,
  rows,
  depth,
  gw,
}: {
  uid: string;
  photos: PhotoTiles | null;
  rows: Row[];
  depth: number;
  gw: number;
}) {
  const y = (d: number) =>
    T + (d <= 2 ? (d / 2) * SOIL_SHARE * BH : SOIL_SHARE * BH + ((d - 2) / (depth - 2)) * (1 - SOIL_SHARE) * BH);
  /* Хил долгиолог (дээд, доод ирмэг шулуун) — монолиттой ижил томьёо */
  const wv = (yy: number, x: number, k: number) =>
    yy <= T + 0.5 || yy >= T + BH - 0.5 ? yy : yy + 2.2 * Math.sin(x * 0.085 + k * 1.9) + 1 * Math.sin(x * 0.21 + k * 3.3);
  const fillOf = (r: Row) => (r.tex ? `url(#${uid}-${r.tex.replace(":", "")})` : "var(--paper-3)");
  const gwIn = Number.isFinite(gw) && gw <= depth;
  /* Баруун талын гүн — гүний устай давхцвал алгасна */
  const ticks = [0, 2, depth].filter((d) => !gwIn || Math.abs(y(d) - y(gw)) > 12);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="mx-auto block w-full max-w-[300px]" role="img" aria-label="Газрын доорх давхарга">
      <defs>
        {[...new Set(rows.map((r) => r.tex).filter((t): t is string => !!t))].map((t) => (
          <pattern key={t} id={`${uid}-${t.replace(":", "")}`} patternUnits="userSpaceOnUse" width={128} height={64}>
            <image href={texUrl(t, photos)} width={128} height={64} preserveAspectRatio="none" />
          </pattern>
        ))}
        <linearGradient id={`${uid}-side`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity={0.22} />
          <stop offset="1" stopColor="#000" stopOpacity={0.42} />
        </linearGradient>
      </defs>

      {/* баруун хажуу — сүүдэртэй */}
      {rows.map((r, i) => {
        const y1 = y(r.top);
        const y2 = y(r.bot);
        const p = pts([
          [X + CW, y1],
          [RX, y1 + SY],
          [RX, y2 + SY],
          [X + CW, y2],
        ]);
        return (
          <g key={`s${i}`}>
            <polygon points={p} fill={fillOf(r)} />
            <polygon points={p} fill={`url(#${uid}-side)`} />
          </g>
        );
      })}
      {/* урд тал — долгиолог хилтэй */}
      {rows.map((r, i) => {
        const y1 = y(r.top);
        const y2 = y(r.bot);
        const top: number[][] = [];
        const bot: number[][] = [];
        for (let x = X; x <= X + CW + 0.1; x += 4) {
          top.push([x, wv(y1, x, i)]);
          bot.unshift([x, wv(y2, x, i + 1)]);
        }
        return <polygon key={`f${i}`} points={pts([...top, ...bot])} fill={fillOf(r)} />;
      })}
      <rect x={X} y={T} width={CW} height={BH} fill="none" stroke="rgba(0,0,0,.25)" />

      {/* дээд тал — навч, өвс */}
      <polygon
        points={pts([
          [X, T],
          [X + CW, T],
          [RX, T + SY],
          [X + SX, T + SY],
        ])}
        fill="#3a291b"
      />
      {TOP_DECOR.litter.map((l, i) => (
        <ellipse
          key={`l${i}`}
          cx={l.x}
          cy={l.y}
          rx={l.rx}
          ry={l.ry}
          transform={`rotate(${l.rot} ${l.x.toFixed(1)} ${l.y.toFixed(1)})`}
          fill={l.c}
          stroke="rgba(0,0,0,.25)"
          strokeWidth={0.5}
        />
      ))}
      {TOP_DECOR.grass.map((g, i) => (
        <path key={`g${i}`} d={g.d} stroke={g.c} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      ))}

      {/* 2 м — масштабын заагт тасархай */}
      <path d={`M${X} ${y(2)} H${X + CW} l${SX} ${SY}`} style={{ stroke: "var(--ink-2)" }} strokeOpacity={0.7} strokeDasharray="5 3" fill="none" />

      {/* зүүн тал — хил бүр тасархай, хөрсний үе кодоороо, гүний давхарга гүнээрээ */}
      {[...new Set(rows.map((r) => r.top))].map((d) => (
        <line key={`b${d}`} x1={4} x2={X - 6} y1={y(d)} y2={y(d)} style={{ stroke: "var(--ink-3)" }} strokeOpacity={0.6} strokeDasharray="3 3" />
      ))}
      {rows.map((r, i) => {
        const y1 = y(r.top);
        const y2 = y(r.bot);
        if (y2 - y1 < 11) return null;
        const m = (y1 + y2) / 2 + 4;
        return r.soil ? (
          <text key={`t${i}`} x={(X - 6) / 2} y={m} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: "var(--ink)" }}>
            {r.code}
          </text>
        ) : (
          <text key={`t${i}`} x={(X - 6) / 2} y={m} textAnchor="middle" fontSize={9.5} style={{ fill: "var(--ink-3)" }} className="num">
            {fmt(r.top)}–{fmt(r.bot)} м
          </text>
        );
      })}
      <text x={(X - 6) / 2} y={T - 8} textAnchor="middle" fontSize={10} style={{ fill: "var(--ink-3)" }}>
        гадарга
      </text>

      {/* баруун тал — гүн, м */}
      {ticks.map((d) => (
        <text key={`k${d}`} x={RX + 4} y={y(d) + SY + 3.5} fontSize={9.5} style={{ fill: "var(--ink-3)" }} className="num">
          {fmt(d)} м
        </text>
      ))}

      {/* гүний ус */}
      {gwIn ? (
        <g>
          <path d={`M${X} ${y(gw)} H${X + CW} l${SX} ${SY}`} stroke="#2f7fc0" strokeWidth={2} strokeDasharray="6 3" fill="none" />
          <text x={RX + 4} y={y(gw) + SY + 3.5} fontSize={9.5} style={{ fill: "var(--water)" }} className="num">
            ▽ {fmt(gw)} м
          </text>
        </g>
      ) : Number.isFinite(gw) ? (
        <text x={X + CW / 2} y={T + BH + 12} textAnchor="middle" fontSize={9.5} style={{ fill: "var(--water)" }} className="num">
          ▽ гүний ус ~{fmt(gw)} м
        </text>
      ) : null}
    </svg>
  );
}
