"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, User } from "lucide-react";
import {
  dayOf,
  elapsed,
  fetchPlan,
  gapOf,
  rollup,
  type PlanData,
  type Staff,
  type Task,
  type Unit,
} from "@/lib/sanhuu";
import { cn, num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Ажлын төлөвлөгөөний биелэлт

   ЗОРИЛГО: албан хаагч бүр өөрийн гүйцэтгэх ажлын хүрээнд ажиллаж
   байгаа эсэхийг хянах.

   ЭНЭ НЬ САМБАР БИШ, ТАЙЛАНГИЙН ХУУДАС. Платформын бусад 23 харагдац
   бүгд "шүүлтүүрийн мөр → гурван багана" гэсэн нэг хэвтэй; энд тэр
   хэвийг ЗОРИУДААР орхив. Шалтгаан нь агуулга: энэ дата газарзүйн ч
   биш, тоолж хуваарилах бүртгэл ч биш — БАЙГУУЛЛАГЫН БҮТЭЦ ба түүн
   дэх хүмүүсийн гүйцэтгэл.

   Тиймээс хуудас нь ДЭЭРЭЭС ДООШ гурван давхаргаар уншигдана:
     1. Бүтэц — хэлтсийг мөчир салаагаар нь ЗУРСАН орг-схем,
     2. Албан хаагч — сонгосон мөчрийн хүмүүс, тус бүр хэмжигчтэй,
     3. Гүйцэтгэх ажил — сонгосон хүний ажлууд.
   Дээд давхарга нь доод давхаргынхаа хамрах хүрээг тодорхойлно.

   ХОЛБООС ШУГАМЫГ SVG-ГҮЙ зурав: эцэг зангилаанаас доош 1px унжаа,
   хүүхдүүдийн дээгүүр хэвтээ төмөр, тус бүрээс доош унжаа. Гурвуулаа
   `border`-оор гарна — MapLibre ч, зургийн сан ч шаардлагагүй бөгөөд
   өнгө нь платформын `--line-2`-ыг шууд дагана.
   -------------------------------------------------------------------------- */

/**
 * Хугацааны явц хэрэгжилтээс хэр давсныг зэрэглэнэ.
 *
 * Дохионы гурван өнгө: `--moss` хэвийн, `--ochre` анхаар, `--clay`
 * ноцтой. Эрэмбэтэй хэмжүүр тул өнгө зөвшөөрөгдөнө (хөрсний PLI-тэй
 * ижил зарчим). Хил нь эх сурвалжийнх БИШ, уншихад туслах зэрэглэл.
 */
const GAP_BANDS = [
  { id: "ok", label: "Хэвийн", hi: 15, tone: "var(--moss)" },
  { id: "watch", label: "Анхаарах", hi: 40, tone: "var(--ochre)" },
  { id: "risk", label: "Ноцтой хоцролт", hi: Infinity, tone: "var(--clay)" },
] as const;

function bandOf(gap: number | null) {
  if (gap == null) return GAP_BANDS[0];
  return GAP_BANDS.find((b) => gap <= b.hi) ?? GAP_BANDS[2];
}

export function SanhuuDashboard() {
  const [data, setData] = React.useState<PlanData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [unit, setUnit] = React.useState("heltes");
  const [person, setPerson] = React.useState<string | null>(null);
  /** Зөвхөн хэрэгжилт огт тэмдэглэгдээгүй ажил — хяналтын гол шүүлт */
  const [onlyZero, setOnlyZero] = React.useState(false);
  /** Ажлын төлөв. `""` нь төлөв тэмдэглэгдээгүй ажлыг сонгоно */
  const [status, setStatus] = React.useState<string | null>(null);

  /*
    Өнөөдрийг НЭГ УДАА барина. Зурагдалт бүрд `new Date()` дуудвал
    сервер ба хөтөч дээр өөр утга гарч, гидраци зөрөх эрсдэлтэй.
  */
  const [today] = React.useState(() => Math.floor(Date.now() / 86400000));

  React.useEffect(() => {
    const ac = new AbortController();
    fetchPlan(ac.signal)
      .then(setData)
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ac.abort();
  }, []);

  const units = React.useMemo(() => data?.units ?? [], [data]);
  const tasks = React.useMemo(() => data?.tasks ?? [], [data]);

  /* Мод дээрх тоо нь ҮРГЭЛЖ бүтэн — шүүлтээс хамаарч хэлбэлзвэл
     хэрэглэгч байршлаа алдана */
  const tree = React.useMemo(() => rollup(units, tasks, today), [units, tasks, today]);

  const scope = React.useMemo(() => tree.get(unit)?.tasks ?? [], [tree, unit]);

  /*
    Хүн тус бүрийн үзүүлэлт. Ажилтан бүр ЯГ НЭГ зангилаанд харьяалагддаг
    тул модны хаана ч байсан нэг л удаа тооцно — зангилаа солигдох бүрд
    дахин бодох шаардлагагүй.
  */
  const people = React.useMemo(() => {
    const pos = new Map((data?.staff ?? []).map((s) => [s.name, s.position]));
    const by = new Map<string, Task[]>();
    for (const t of tasks) by.set(t.staff, [...(by.get(t.staff) ?? []), t]);
    const out = new Map<string, PersonStat>();
    for (const [name, ts] of by) {
      let sp = 0;
      let se = 0;
      let ne = 0;
      let zero = 0;
      let stated = 0;
      for (const t of ts) {
        sp += t.progress ?? 0;
        const e = elapsed(t, today);
        if (e != null) {
          se += e;
          ne++;
        }
        if ((t.progress ?? 0) === 0) zero++;
        if (t.status) stated++;
      }
      const progress = sp / ts.length;
      const el = ne ? se / ne : 0;
      out.set(name, {
        name,
        position: pos.get(name) ?? "",
        n: ts.length,
        progress,
        elapsed: el,
        gap: el - progress,
        zero,
        stated,
      });
    }
    return out;
  }, [tasks, data, today]);

  const list = React.useMemo(() => {
    let out = person ? scope.filter((t) => t.staff === person) : scope;
    if (onlyZero) out = out.filter((t) => (t.progress ?? 0) === 0);
    if (status != null) out = out.filter((t) => (t.status ?? "") === status);
    return [...out].sort((a, b) => (a.progress ?? 0) - (b.progress ?? 0) || a.no - b.no);
  }, [scope, person, onlyZero, status]);

  /*
    Төлөвийн шүүлтүүр нь эх сурвалжийн бүртгэлээс БИШ, БОДИТ утгуудаас
    угсарна. Хуудсанд таван төлөв тодорхойлогдсон ("Дууссан",
    "Хугацаандаа", "Хоцорсон", "Цуцлагдсан", "Түр зогссон") ч 130
    ажлын дөнгөж 46-д нь тэмдэглэгдсэн бөгөөд хоёрхон утга тохиолдоно.
    Хэрэглэгдээгүй гурвыг товч болгон гаргавал үргэлж хоосон үр дүн
    буцаадаг товчнууд болно.

    Тэмдэглэгдээгүй нь МӨН сонголт: 84 ажлын төлөв хоосон байгаа нь
    өөрөө хяналтын мэдээлэл — төлөвийг зөвхөн гурван хүн хөтөлдөг.
  */
  const statusTabs = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const t of tasks) {
      const k = t.status ?? "";
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const order = (k: string) => (k === "" ? 1 : 0);
    return [...seen]
      .map(([id, n]) => ({ id, n, label: id || "Төлөв тэмдэглэгдээгүй" }))
      .sort((a, b) => order(a.id) - order(b.id) || b.n - a.n);
  }, [tasks]);

  /** Модны үндэс — сонголт цуцлахад буцаж очих газар */
  const rootId = React.useMemo(
    () => units.find((u) => u.parent === null)?.id ?? "heltes",
    [units],
  );

  /*
    Сонгосон зангилааг ДАХИН товшиход сонголт цуцлагдаж хэлтсийн бүтэн
    хүрээ рүү буцна. Үүнгүй бол хэрэглэгч мөчир сонгосны дараа буцах
    арга олдохгүй — үндсийг нь тусгайлан хайх шаардлагатай болдог.
  */
  const pickUnit = React.useCallback(
    (id: string) => {
      setUnit((prev) => (prev === id ? rootId : id));
      setPerson(null);
    },
    [rootId],
  );

  /*
    Хүн сонгоход түүний зангилаа руу мөн шилжинэ. Эс тэгвээс өөр мөчир
    сонгоод байхад хүн товшиход хамрах хүрээнд нь тэр хүний ажил
    байхгүй тул жагсаалт хоосон гарна.
  */
  const pickPerson = React.useCallback(
    (name: string) => {
      if (person === name) {
        setPerson(null);
        return;
      }
      const u = data?.staff.find((x) => x.name === name)?.unit;
      if (u) setUnit(u);
      setPerson(name);
    },
    [person, data],
  );

  if (error) {
    return (
      <Shell>
        <div className="px-4 py-10 text-center">
          <p className="text-[14px] font-medium">
            Төлөвлөгөөний биелэлтийг татаж чадсангүй
          </p>
          <p className="num mt-2 text-[12px] text-ink-3">{error}</p>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-ink-3">
          <Loader2 size={14} className="animate-spin" />
          Төлөвлөгөөний биелэлт татаж байна…
        </div>
      </Shell>
    );
  }

  const unitLabel = units.find((u) => u.id === unit)?.label ?? "";

  return (
    <Shell>
      {/* ---- 1. БҮТЭЦ, ХҮМҮҮС ---- */}
      <Head text="Байгууллагын бүтэц" note={person ?? unitLabel} />
      <div className="overflow-x-auto px-4 py-5">
        <OrgChart
          units={units}
          tree={tree}
          staff={data.staff}
          people={people}
          selected={unit}
          person={person}
          onPick={pickUnit}
          onPickPerson={pickPerson}
        />
      </div>

      {/* ---- 2. АЖИЛ ---- */}
      <Head
        text="Гүйцэтгэх ажил"
        note={person ?? unitLabel}
        count={list.length}
        action={
          <div className="flex flex-wrap items-center justify-end gap-1">
            {statusTabs.map((x) => (
              <Toggle
                key={x.id || "none"}
                on={status === x.id}
                onClick={() => setStatus(status === x.id ? null : x.id)}
              >
                {x.label}
                <span className="num ml-1 opacity-60">{num(x.n)}</span>
              </Toggle>
            ))}

            <Toggle on={onlyZero} onClick={() => setOnlyZero((v) => !v)} box>
              Хэрэгжилт тэмдэглэгдээгүй
            </Toggle>
          </div>
        }
      />
      {list.length === 0 ? (
        <Empty text="Тохирох ажил олдсонгүй" />
      ) : (
        <>
          <TaskHead showStaff={!person} />
          <ol className="divide-y divide-line">
            {list.map((t) => (
              <TaskRow key={t.no} task={t} today={today} showStaff={!person} data={data} />
            ))}
          </ol>
        </>
      )}
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-xs border border-line bg-paper-2">
      {children}
    </div>
  );
}

function Head({
  text,
  note,
  count,
  action,
}: {
  text: string;
  note?: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-y border-line bg-paper-3 px-4 py-2 first:border-t-0">
      <span className="eyebrow shrink-0">{text}</span>
      {count != null ? (
        <span className="num shrink-0 text-[10.5px] text-ink-3">{num(count)}</span>
      ) : null}
      {note ? (
        <span className="min-w-0 flex-1 basis-24 truncate text-[10.5px] text-ink-3">
          {note}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      {action}
    </div>
  );
}

/** Нэг албан хаагчийн нэгтгэсэн үзүүлэлт */
type PersonStat = {
  name: string;
  position: string;
  n: number;
  progress: number;
  elapsed: number;
  gap: number;
  zero: number;
  stated: number;
};

/* --------------------------------------------------------------------------
   ОРГ-СХЕМ

   Хэлтсийг мөчир салаагаар нь зурна. Холбоос нь 1px зураас: эцгээс
   доош унжаа → хүүхдүүдийн дээгүүр хэвтээ төмөр → тус бүр рүү унжаа.

   Хамгийн гадна талын хүүхдийн хувьд хэвтээ төмөр нь ЗӨВХӨН дотогшоо
   сунана (эхнийх нь голоос баруун тийш, сүүлчийнх нь голоос зүүн тийш)
   — эс тэгвээс зураас модноос гадагш цухуйна.

   АЛБАН ХААГЧ НЬ ЗАНГИЛААНЫ ДОТОР сууна, тусдаа хайрцаг БИШ. Ажил нь
   хүнд оногддог тул зангилааны тоо гэдэг нь түүнд харьяалагдах
   хүмүүсийн ажлын нийлбэр — хүнийг гадуур нь тавьбал тэр холбоо
   таслагдана.
   -------------------------------------------------------------------------- */

function OrgChart({
  units,
  tree,
  staff,
  people,
  selected,
  person,
  onPick,
  onPickPerson,
}: {
  units: Unit[];
  tree: ReturnType<typeof rollup>;
  staff: Staff[];
  people: Map<string, PersonStat>;
  selected: string;
  person: string | null;
  onPick: (id: string) => void;
  onPickPerson: (name: string) => void;
}) {
  const root = units.find((u) => u.parent === null);
  if (!root) return null;
  return (
    <div className="flex min-w-max justify-center">
      <Branch
        id={root.id}
        units={units}
        tree={tree}
        staff={staff}
        people={people}
        selected={selected}
        person={person}
        onPick={onPick}
        onPickPerson={onPickPerson}
      />
    </div>
  );
}

function Branch(props: {
  id: string;
  units: Unit[];
  tree: ReturnType<typeof rollup>;
  staff: Staff[];
  people: Map<string, PersonStat>;
  selected: string;
  person: string | null;
  onPick: (id: string) => void;
  onPickPerson: (name: string) => void;
}) {
  const { id, units } = props;
  const kids = units.filter((u) => u.parent === id);
  return (
    <div className="flex flex-col items-center">
      <NodeCard
        unit={units.find((u) => u.id === id)!}
        tree={props.tree}
        staff={props.staff}
        people={props.people}
        on={props.selected === id}
        person={props.person}
        onPick={() => props.onPick(id)}
        onPickPerson={props.onPickPerson}
      />

      {kids.length ? (
        <>
          {/* Эцгээс доош унжаа */}
          <span aria-hidden className="h-4 w-px bg-line-2" />
          <div className="flex items-start">
            {kids.map((k, i) => (
              <div key={k.id} className="flex flex-col items-center px-1.5">
                {/* Хэвтээ төмөр + хүүхэд рүү унжаа */}
                <span aria-hidden className="relative h-4 w-full">
                  <span
                    className="absolute top-0 h-px bg-line-2"
                    style={{
                      left: i === 0 ? "50%" : 0,
                      right: i === kids.length - 1 ? "50%" : 0,
                    }}
                  />
                  <span className="absolute top-0 left-1/2 h-4 w-px bg-line-2" />
                </span>
                <Branch {...props} id={k.id} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function NodeCard({
  unit,
  tree,
  staff,
  people,
  on,
  person,
  onPick,
  onPickPerson,
}: {
  unit: Unit;
  tree: ReturnType<typeof rollup>;
  staff: Staff[];
  people: Map<string, PersonStat>;
  on: boolean;
  person: string | null;
  onPick: () => void;
  onPickPerson: (name: string) => void;
}) {
  const r = tree.get(unit.id);
  const n = r?.tasks.length ?? 0;
  const mine = staff
    .filter((x) => x.unit === unit.id)
    .map((x) => people.get(x.name))
    .filter((x): x is PersonStat => Boolean(x))
    .sort((a, b) => b.gap - a.gap || b.n - a.n);
  const band = bandOf(n ? (r?.elapsed ?? 0) - (r?.progress ?? 0) : null);

  return (
    <div
      className={cn(
        "w-[228px] overflow-hidden rounded-xs border bg-paper transition-colors",
        on ? "border-(--tone)" : "border-line",
      )}
    >
      <button onClick={onPick} className="block w-full px-2.5 py-2 text-left">
        <div className="flex items-baseline gap-1.5">
          {unit.no ? (
            <span
              className={cn(
                "num shrink-0 text-[10px]",
                on ? "text-(--tone)" : "text-ink-3",
              )}
            >
              {unit.no}
            </span>
          ) : null}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[11.5px] leading-snug",
              on ? "font-medium text-(--tone)" : "text-ink",
            )}
            title={unit.label}
          >
            {unit.label}
          </span>
          <span className="num shrink-0 text-[10px] text-ink-3">{num(n)}</span>
        </div>

        {n ? (
          <>
            <div className="mt-1.5">
              <Bullet progress={r?.progress ?? 0} elapsed={r?.elapsed ?? 0} />
            </div>
            <div className="num mt-1 text-[10px]" style={{ color: band.tone }}>
              {num(r?.progress ?? 0, 0)}
              <span className="text-ink-3"> / {num(r?.elapsed ?? 0, 0)} хувь</span>
            </div>

            {/*
              Хяналтын гол тоо: энэ мөчирт хэдэн ажил огт тэмдэглэгдээгүй
              вэ. Дундаж хэрэгжилт нь үүнийг нуудаг — цөөн ажил өндөр
              хувьтай байхад л дундаж өснө.
            */}
            {r && r.zero ? (
              <div className="num mt-0.5 text-[9.5px] text-ochre">
                Хэрэгжилт тэмдэглэгдээгүй {num(r.zero)}
              </div>
            ) : null}
          </>
        ) : (
          <div className="hatch mt-1.5 rounded-xs border border-dashed border-line-2 px-1.5 py-1 text-[9.5px] leading-snug text-ink-3">
            {mine.length ? "Ажил бүртгэгдээгүй" : "Мэдээлэл хүлээгдэж байна"}
          </div>
        )}
      </button>

      {/* Албан хаагч — зангилааны ДОТОР */}
      {mine.length ? (
        <div className="divide-y divide-line border-t border-line">
          {mine.map((x) => (
            <PersonRow
              key={x.name}
              row={x}
              on={person === x.name}
              onPick={() => onPickPerson(x.name)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Зангилааны доторх нэг албан хаагч.
 *
 * Нэр, ажлын тоо, хэмжигч гурав нэг мөрөнд — картын өргөн 228px тул
 * албан тушаал нь зөвхөн `title`-д үлдэнэ. Ажлын тоо нь зангилааны
 * нийлбэрийг задлан харуулна.
 */
function PersonRow({
  row,
  on,
  onPick,
}: {
  row: PersonStat;
  on: boolean;
  onPick: () => void;
}) {
  const band = bandOf(row.gap);
  return (
    <button
      onClick={onPick}
      title={`${row.name} · ${row.position}`}
      className={cn(
        "relative block w-full px-2.5 py-1.5 text-left transition-colors",
        on ? "bg-(--tone)/10" : "hover:bg-paper-hi",
      )}
    >
      {on ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)" />
      ) : null}
      <div className="flex items-baseline gap-1.5">
        <User size={9} className="shrink-0 text-ink-3" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[10.5px] leading-snug",
            on ? "font-medium text-ink" : "text-ink-2",
          )}
        >
          {row.name}
        </span>
        <span className="num shrink-0 text-[9.5px] text-ink-3">{num(row.n)}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 pl-[15px]">
        <Bullet progress={row.progress} elapsed={row.elapsed} thin />
        <span className="num shrink-0 text-[9.5px]" style={{ color: band.tone }}>
          {num(row.progress, 0)}
        </span>
      </div>
    </button>
  );
}

/* --------------------------------------------------------------------------
   ХЭМЖИГЧ

   Дүүргэлт нь ХЭРЭГЖИЛТ, босоо заагч нь ХУГАЦААНЫ ЯВЦ. Хоёр тоог
   зэрэгцүүлэх нь энэ хуудасны гол зорилго: заагчаас хойш унасан
   дүүргэлт нь хоцролтыг өөрөө хэлнэ. Өнгө нь зөрүүний зэргээс.
   -------------------------------------------------------------------------- */

function Bullet({
  progress,
  elapsed: el,
  thin,
}: {
  progress: number;
  elapsed: number;
  thin?: boolean;
}) {
  const band = bandOf(el - progress);
  return (
    <span
      className={cn(
        "relative block w-full overflow-hidden rounded-[1px] bg-paper-hi",
        thin ? "h-[3px]" : "h-[5px]",
      )}
    >
      <span
        className="absolute inset-y-0 left-0"
        style={{ width: `${Math.min(progress, 100)}%`, background: band.tone }}
      />
      <span
        aria-hidden
        className="absolute inset-y-0 w-[2px] bg-ink-2"
        style={{ left: `calc(${Math.min(el, 100)}% - 1px)` }}
      />
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   ГҮЙЦЭТГЭХ АЖЛЫН ЖАГСААЛТ

   Мөр бүр ГУРВАН зүйлд хариулна: юу хийх ёстой вэ, хэр хийгдсэн бэ,
   хугацаанаасаа хэр хоцорч байна вэ.

   БАГАНЫН ТОЛГОЙ ЗААВАЛ. Хэмжигчийн доторх босоо зураас нь хугацааны
   явц гэдгийг тайлбаргүйгээр таах боломжгүй байв. Тиймээс баганад
   "Хэрэгжилт / хугацааны явц" гэсэн нэр өгч, ХОЁУЛАНГ нь тоогоор
   давхар бичив — зураас нь юу болох нь хоёр тооноос өөрөө уншигдана.

   Мөр нь дэлгэрдгийг ХЭЛЭХ ёстой: урьд нь бүтэн мөр нь товч байсан ч
   ямар ч тэмдэг байгаагүй тул товшиж болохыг мэдэх аргагүй байв.

   Ажлын нэр дунджаар 131 тэмдэгт, дээд тал нь 262 — хураахгүй бол
   мөрүүд өөр өөр өндөртэй болж жагсаалт тасарна. Хоёр мөрөнд хураагаад
   бүтнээр нь дэлгэрэнгүйд гаргана.
   -------------------------------------------------------------------------- */

/**
 * Мөр ба толгойн НЭГ сүлжээ.
 *
 * Хоёр тусад нь бичвэл багана эрт орой хэзээ нэгэн цагт зөрнө. Tailwind
 * ангийн нэрийг эх кодоос шууд уншдаг тул бүтэн мөрөөр бичигдэнэ.
 */
const GRID =
  "grid gap-x-2 px-4 grid-cols-[24px_1fr_18px] md:grid-cols-[24px_1fr_168px_128px_18px]";

function TaskHead({ showStaff }: { showStaff: boolean }) {
  return (
    <div
      className={cn(
        GRID,
        "border-b border-line bg-paper py-1.5 text-[9.5px] leading-none tracking-[0.06em] text-ink-3 uppercase",
      )}
    >
      <span className="num">№</span>
      <span className="truncate">
        Гүйцэтгэх ажил{showStaff ? " · албан хаагч" : ""}
      </span>
      <span className="hidden md:col-start-3 md:block">
        Хэрэгжилт / хугацааны явц, хувь
      </span>
      <span className="hidden md:col-start-4 md:block">Төлөв</span>
      <span />
    </div>
  );
}

function TaskRow({
  task,
  today,
  showStaff,
  data,
}: {
  task: Task;
  today: number;
  showStaff: boolean;
  data: PlanData;
}) {
  const [open, setOpen] = React.useState(false);
  const el = elapsed(task, today) ?? 0;
  const progress = task.progress ?? 0;
  const band = bandOf(gapOf(task, today));
  const cat = data.categories.find((c) => c.id === task.category);

  /*
    Дуусах хугацааг ЗӨВХӨН оны эцсээс өмнөх ажилд харуулна. 130 ажлын
    127 нь 12 сард дуусдаг тул тусдаа багана болговол бараг бүхэлдээ
    давтагдсан утга болно; харин 5, 8 сард дуусах гурав нь өнөөдрийн
    байдлаар аль хэдийн хугацаа нь өнгөрсөн тул тэднийг л тэмдэглэнэ.
  */
  const endDay = dayOf(task.end);
  /* Дууссан ажилд анхааруулах өнгө тавихгүй — хугацаа өнгөрсөн нь
     зөвхөн гүйцэтгэл дутуу үлдсэн үед л асуудал */
  const past = endDay != null && endDay < today && progress < 100;

  return (
    <li>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          GRID,
          "w-full py-2 text-left transition-colors hover:bg-paper-hi",
          open && "bg-paper-hi",
        )}
      >
        <span className="num pt-[2px] text-[10px] text-ink-3">{task.no}</span>

        <span className="min-w-0">
          <span className="line-clamp-2 text-[11.5px] leading-snug text-ink">
            {task.text}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {showStaff ? (
              <span className="text-[10px] leading-none text-ink-3">{task.staff}</span>
            ) : null}
            {past ? (
              <span className="num rounded-xs border border-ochre/45 px-1 py-[1px] text-[9.5px] leading-none text-ochre">
                Хугацаа дууссан · {task.end}
              </span>
            ) : null}
          </span>
        </span>

        {/*
          Хэмжигч ба ХОЁР тоо. Зөвхөн хэрэгжилтийг бичвэл хэмжигчийн
          босоо зураас юу болох нь тодорхойгүй үлдэнэ.
        */}
        <span className="col-start-2 mt-2 flex items-center gap-2 md:col-start-3 md:mt-0 md:self-center">
          <Bullet progress={progress} elapsed={el} thin />
          <span className="num shrink-0 text-[10.5px] leading-none">
            <span style={{ color: band.tone }}>{num(progress)}</span>
            <span className="text-ink-3"> / {num(el, 0)}</span>
          </span>
        </span>

        <span className="col-start-2 mt-1.5 text-[10px] leading-none md:col-start-4 md:mt-0 md:self-center">
          {task.status ? (
            <span className="text-ink-2">{task.status}</span>
          ) : (
            /* 130 ажлын 84-д төлөв хоосон. Урт өгүүлбэрийг давтвал
               жагсаалт бүхэлдээ тэр бичвэрээр дүүрнэ */
            <span className="text-ink-3">—</span>
          )}
        </span>

        <ChevronDown
          size={13}
          className={cn(
            "col-start-3 row-start-1 mt-[1px] shrink-0 text-ink-3 transition-transform md:col-start-5 md:self-center",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <dl className="space-y-1.5 border-t border-line bg-paper px-4 py-2.5">
          {/* Хураагдсан нэрийг бүтнээр нь */}
          <Field k="Гүйцэтгэх ажил" v={task.text} />
          <Field k="Албан хаагч" v={task.staff} />
          <Field k="Ажлын ангилал" v={cat ? cat.label : "Тэмдэглэгдээгүй"} />
          <Field k="Хэмжих үзүүлэлт" v={task.measure || "—"} />
          <Field
            k="Хугацаа"
            v={
              <span className="num">
                {task.start} – {task.end}
                {task.days == null ? "" : ` · ${num(task.days)} хоног`}
              </span>
            }
          />
          <Field
            k="Хэрэгжилт"
            v={
              <span className="num">
                {num(progress)} хувь
                {task.target == null ? "" : ` · зорилтот түвшин ${num(task.target)}`}
              </span>
            }
          />
          <Field k="Хугацааны явц" v={<span className="num">{num(el, 1)} хувь</span>} />
          <Field k="Төлөв" v={task.status || "Тэмдэглэгдээгүй"} />
        </dl>
      ) : null}
    </li>
  );
}

/**
 * Толгойн шүүлтүүрийн товч.
 *
 * `box` нь хайрцагтай хувилбар — тийм/үгүй сонголтод. Төлөвийн товчнууд
 * нь хоорондоо СОЛИГДДОГ тул хайрцаггүй: хайрцаг нь хэд хэдэн зүйлийг
 * зэрэг сонгож болно гэсэн амлалт өгнө.
 */
function Toggle({
  on,
  onClick,
  box,
  children,
}: {
  on: boolean;
  onClick: () => void;
  box?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-1.5 rounded-xs border px-2 py-1 text-[11px] leading-none transition-colors",
        on
          ? "border-(--tone)/45 bg-(--tone)/10 text-(--tone)"
          : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
      )}
    >
      {box ? (
        <span
          aria-hidden
          className={cn(
            "flex size-3 shrink-0 items-center justify-center rounded-[2px] border transition-colors",
            on ? "border-(--tone) bg-(--tone)" : "border-line-2",
          )}
        >
          {on ? <Check size={8} strokeWidth={3} className="text-paper" /> : null}
        </span>
      ) : null}
      {children}
    </button>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[112px] shrink-0 text-[10px] leading-snug tracking-[0.06em] text-ink-3 uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1 text-[11px] leading-snug text-ink">{v}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="hatch m-4 flex items-center justify-center rounded-xs border border-dashed border-line-2 px-4 py-8">
      <p className="text-center text-[11.5px] leading-snug text-ink-3">{text}</p>
    </div>
  );
}
