"use client";

import * as React from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WATER_LAW, type WaterLawGroup, type WaterLawItem } from "@/lib/water-law";

/*
  Усны тухай хууль тогтоомж, дүрэм, журам, стандарт, норм.

  Газрын зураг, диаграм БАЙХГҮЙ — энэ нь хэмжилтийн дата биш, лавлах
  баримт бичгийн жагсаалт (хяналтын хэлтсийн журмын схемтэй нэг зарчим).

  ⚠⚠ НЭГ КАРТ, НЯГТ ЖАГСААЛТ (хэрэглэгч 2026-10-30: "zambaraagui harahdaj bn" →
  "dahiad uur?" → гурван хувилбараас "Нягт жагсаалт"). Нэг баримт НЭГ мөр:
  № · нэр · огноо · дугаар · холбоос. Толгойд бүлгийн таб ба хайлт (БҮХ
  бүлгээс), доор нь хэсгийн товч; хэсгийн гарчиг (богино нэр) наалдана.
  Буцаагдсан — дахин бүү давт: нэг урт задгай жагсаалт; зүүн талын тусдаа
  ангиллын цэс; олон мөрт баганатай хүснэгт (нэрийн доор акт, хүчингүйн
  шалтгаан мөр бүрд). Санал болгоод сонгогдоогүй: карт тор, он дарааллын шугам.

  ⚠⚠ САЙЖРУУЛАЛТ (хэрэглэгч 2026-11-20: "ene hesgiig saijruulah sanaa" →
  "za saijruulaad hiigeerei"):
  · БАРУУН ТАЛД САМБАР зөвхөн мөр сонгосон үед — тэр баримтын ДЭЛГЭРЭНГҮЙ (бүтэн нэр, батлах акт, огноо, дугаар, тэмдэглэл,
    хүчингүй болсон шалтгаан, эх сурвалж нээх товч). Esc хаана.
    ⚠ Сонгоогүй үеийн ТОЙМ (тоо, хэсгээр) БУЦААГДСАН (хэрэглэгч мөн өдөр: "iim
    iluu ym hrgguireee") — дахин бүү нэм.
  · Мөр дарахад холбоос ШУУД нээгдэхгүй — сонгоно; эх сурвалж руу мөрийн
    төгсгөлийн тэмдэг эсвэл самбарын товч.
  · Нэр ХОЁР мөр хүртэл залгана (урт нэр тасардаг байв). Акт, тэмдэглэл
    мөрөнд ОРОХГҮЙ — тэдгээр нь самбарт.
  · "Хүчингүй" шошго нэрийн ард (улбар цэг ганцаараа утгаа хэлдэггүй байв).
  · Төлөвийн шүүлт "Бүгд · Хүчинтэй · Хүчингүй · Холбоосгүй" ба эрэмбэ
    "Номын дараалал · Огноогоор" (хэсэг доторх; шинэ нь эхэндээ). Мөрийн
    дугаар нь ҮРГЭЛЖ номынх.
  · Хайсан үг нэрэн дотор тодорно. Хоосон бүлгийн таб бүдэг.
  Хоосон бүлэг нь `.hatch` — "хоосон" биш "хүлээгдэж буй".
*/

/* Товчны богино нэр — бүтэн нэр нь хэсгийн гарчигт. */
const SHORT: Record<string, string> = {
  "Улсын Их Хурлаар батлагдсан хууль, бодлогын баримт бичиг": "Улсын Их Хурал",
  "Засгийн газрын тогтоол, шийдвэр": "Засгийн газар",
  "Байгаль орчин, аялал жуулчлалын сайдын тушаал, хамтарсан тушаал": "Сайдын тушаал",
};
const shortOf = (name?: string) => (name ? (SHORT[name] ?? name) : "");

type Status = "all" | "valid" | "repealed" | "nolink";
const STATUSES: { id: Status; label: string }[] = [
  { id: "all", label: "Бүгд" },
  { id: "valid", label: "Хүчинтэй" },
  { id: "repealed", label: "Хүчингүй" },
  { id: "nolink", label: "Холбоосгүй" },
];
const statusTest: Record<Status, (it: WaterLawItem) => boolean> = {
  all: () => true,
  valid: (it) => !it.repealed,
  repealed: (it) => !!it.repealed,
  nolink: (it) => !it.url,
};

type Order = "book" | "date";

const COLS = "grid grid-cols-[28px_minmax(0,1fr)] items-start gap-x-3 md:grid-cols-[28px_minmax(0,1fr)_76px_88px]";

/* Баримт бүрийн бүлэг ба номын дугаар (хэсэг доторх) — нэг удаа */
const META = new Map<WaterLawItem, { group: WaterLawGroup; n: number }>();
for (const g of WATER_LAW) {
  const seen = new Map<string | undefined, number>();
  for (const it of g.items) {
    const n = (seen.get(it.section) ?? 0) + 1;
    seen.set(it.section, n);
    META.set(it, { group: g, n });
  }
}

function sectionsOf(items: WaterLawItem[]) {
  const out: { name?: string; items: WaterLawItem[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.name === it.section) last.items.push(it);
    else out.push({ name: it.section, items: [it] });
  }
  return out;
}

/* Огноо "YYYY.MM.DD" — бичвэрээр эрэмбэлэгдэнэ; огноогүй нь эцэст */
const byDate = (a: WaterLawItem, b: WaterLawItem) => (b.date ?? "").localeCompare(a.date ?? "");

const norm = (s: string) => s.toLowerCase().replace(/[“”"«»]/g, "").replace(/\s+/g, " ");
const text = (it: WaterLawItem) =>
  norm([it.title, it.act, it.date, it.no, it.note, it.repealed].filter(Boolean).join(" "));

export function WaterLaw() {
  const [groupId, setGroupId] = React.useState<WaterLawGroup["id"]>(WATER_LAW[0].id);
  const [section, setSection] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>("all");
  const [order, setOrder] = React.useState<Order>("book");
  const [query, setQuery] = React.useState("");
  const [chosen, setChosen] = React.useState<WaterLawItem | null>(null);
  const q = norm(query.trim());

  const group = WATER_LAW.find((g) => g.id === groupId) ?? WATER_LAW[0];
  const groupSections = React.useMemo(() => sectionsOf(group.items).filter((s) => s.name), [group]);

  /* Төлөвийн тоо — хайлт эсвэл бүлгийн хүрээнд */
  const scope = React.useMemo(
    () => (q ? WATER_LAW.flatMap((g) => g.items.filter((it) => text(it).includes(q))) : group.items),
    [q, group],
  );
  const counts = React.useMemo(
    () => Object.fromEntries(STATUSES.map((s) => [s.id, scope.filter(statusTest[s.id]).length])) as Record<Status, number>,
    [scope],
  );

  const blocks = React.useMemo(() => {
    const keep = statusTest[status];
    const sorted = (items: WaterLawItem[]) => (order === "date" ? [...items].sort(byDate) : items);
    if (q) {
      return WATER_LAW.flatMap((g) =>
        sectionsOf(g.items.filter((it) => text(it).includes(q) && keep(it))).map((s) => ({
          name: s.name ?? g.label,
          items: sorted(s.items),
        })),
      );
    }
    const all = sectionsOf(group.items.filter(keep)).map((s) => ({ ...s, items: sorted(s.items) }));
    return section ? all.filter((s) => s.name === section) : all;
  }, [q, group, section, status, order]);

  const shown = blocks.reduce((n, b) => n + b.items.length, 0);

  React.useEffect(() => {
    if (!chosen) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setChosen(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [chosen]);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xs border border-line bg-paper-2">
      {/* Толгой: бүлгийн таб · хайлт */}
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-line px-4 pt-3">
        <nav className="-mb-px flex min-w-0 flex-1 flex-wrap gap-x-5" aria-label="Бүлэг">
          {WATER_LAW.map((g) => {
            const on = !q && g.id === groupId;
            const empty = !g.items.length;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setQuery("");
                  setGroupId(g.id);
                  setSection(null);
                  setChosen(null);
                }}
                aria-current={on || undefined}
                className={cn(
                  "flex items-baseline gap-1.5 border-b-2 pb-2.5 text-[12.5px] transition-colors",
                  on
                    ? "border-(--tone) font-semibold text-ink"
                    : cn("border-transparent hover:text-ink", empty ? "text-ink-3" : "text-ink-2"),
                )}
              >
                {g.label}
                {empty ? null : (
                  <span className={cn("num text-[11px]", on ? "text-(--tone)" : "text-ink-3")}>{g.items.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        <label className="relative mb-2 flex w-full items-center sm:w-[260px]">
          <Search size={13} className="pointer-events-none absolute left-2.5 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Баримт хайх…"
            className="h-8 w-full rounded-xs border border-line bg-paper pl-8 pr-7 text-[12px] outline-none placeholder:text-ink-3 focus:border-(--tone)"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Цэвэрлэх"
              className="absolute right-1.5 grid size-5 place-items-center rounded-xs text-ink-3 hover:text-ink"
            >
              <X size={12} />
            </button>
          )}
        </label>
      </header>

      {/* Хэсэг · төлөв · эрэмбэ */}
      {scope.length ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {q ? (
              <span className="text-[11.5px] text-ink-2">
                Хайлтын илэрц · <span className="num">{shown}</span> баримт
              </span>
            ) : groupSections.length > 1 ? (
              [null, ...groupSections.map((s) => s.name!)].map((name) => {
                const on = section === name;
                const count = name
                  ? (groupSections.find((s) => s.name === name)?.items.length ?? 0)
                  : group.items.length;
                return (
                  <Chip key={name ?? "all"} on={on} onClick={() => setSection(name)} title={name ?? undefined} count={count}>
                    {name ? shortOf(name) : "Бүгд"}
                  </Chip>
                );
              })
            ) : null}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Segmented
              label="Төлөв"
              value={status}
              onChange={setStatus}
              items={STATUSES.filter((s) => s.id === "all" || counts[s.id]).map((s) => ({
                id: s.id,
                label: s.label,
                count: counts[s.id],
                tone: s.id === "repealed" ? "ochre" : undefined,
              }))}
            />
            <Segmented
              label="Эрэмбэ"
              value={order}
              onChange={setOrder}
              items={[
                { id: "book", label: "Номын дараалал" },
                { id: "date", label: "Огноогоор" },
              ]}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Жагсаалт */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {blocks.length ? (
            <>
              <div
                className={cn(
                  COLS,
                  "sticky top-0 z-20 hidden border-b border-line bg-paper-2 py-1.5 pr-12 pl-4 text-[10.5px] text-ink-3 md:grid",
                )}
              >
                <span>№</span>
                <span>Нэр</span>
                <span>Огноо</span>
                <span>Дугаар</span>
              </div>
              {blocks.map((s, si) => (
                <div key={`${s.name ?? ""}-${si}`}>
                  {s.name && (blocks.length > 1 || q) && (
                    <div
                      title={s.name}
                      className="sticky top-0 z-10 border-b border-line bg-paper-3 px-4 py-1.5 text-[11px] font-semibold text-ink-2 md:top-[27px]"
                    >
                      {shortOf(s.name)}
                      <span className="num ml-1.5 font-normal text-ink-3">· {s.items.length}</span>
                    </div>
                  )}
                  <ol className="divide-y divide-line">
                    {s.items.map((it, i) => (
                      <li key={`${it.title}-${it.no ?? it.date ?? i}`}>
                        <Row
                          item={it}
                          n={META.get(it)?.n ?? i + 1}
                          query={query.trim()}
                          on={chosen === it}
                          onPick={() => setChosen(chosen === it ? null : it)}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </>
          ) : (
            <div className="p-4">
              <div className="hatch flex h-20 items-center justify-center rounded-xs border border-dashed border-line-2 text-[12px] text-ink-3">
                {q ? "Тохирох баримт олдсонгүй" : "Мэдээлэл хүлээгдэж байна"}
              </div>
            </div>
          )}
        </div>

        {/* Баруун самбар — зөвхөн мөр сонгосон үед */}
        {chosen ? (
          <aside className="min-h-0 shrink-0 overflow-y-auto border-t border-line bg-paper lg:w-[360px] lg:border-t-0 lg:border-l 2xl:w-[420px]">
            <Detail item={chosen} onClose={() => setChosen(null)} />
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function Chip({
  on,
  onClick,
  title,
  count,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-baseline gap-1.5 rounded-xs border px-2.5 py-1 text-[11.5px] transition-colors",
        on ? "border-(--tone)/40 bg-(--tone)/10 text-ink" : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
      )}
    >
      {children}
      <span className={cn("num text-[10.5px]", on ? "text-(--tone)" : "text-ink-3")}>{count}</span>
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; count?: number; tone?: "ochre" }[];
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center rounded-xs border border-line p-0.5">
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            aria-pressed={on}
            className={cn(
              "flex items-baseline gap-1.5 rounded-[1px] px-2 py-[3px] text-[11.5px] transition-colors",
              on ? "bg-(--tone)/12 font-medium text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {it.tone === "ochre" ? <span aria-hidden className="size-1.5 self-center rounded-full bg-(--ochre)" /> : null}
            {it.label}
            {it.count != null ? <span className="num text-[10.5px] text-ink-3">{it.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* Хайсан үгийг тодруулна — том жижиг үсэг хамаарахгүй */
function Highlight({ text: t, query }: { text: string; query: string }) {
  if (!query) return <>{t}</>;
  const at = t.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return <>{t}</>;
  return (
    <>
      {t.slice(0, at)}
      <mark className="rounded-[1px] bg-(--ochre)/30 text-inherit">{t.slice(at, at + query.length)}</mark>
      {t.slice(at + query.length)}
    </>
  );
}

function Repealed() {
  return (
    <span className="ml-1.5 inline-flex translate-y-[-1px] items-center rounded-[2px] border border-(--ochre)/45 px-1 py-px align-middle text-[10px] leading-none font-medium text-(--ochre)">
      Хүчингүй
    </span>
  );
}

/* Нэг мөр: дарахад СОНГОНО (самбарт дэлгэрэнгүй); эх сурвалж нь төгсгөлийн тэмдгээр. */
function Row({
  item: it,
  n,
  query,
  on,
  onPick,
}: {
  item: WaterLawItem;
  n: number;
  query: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-start transition-colors",
        on ? "bg-(--tone)/8 shadow-[inset_2px_0_0_var(--tone)]" : "hover:bg-paper-hi",
      )}
    >
      <button
        type="button"
        onClick={onPick}
        aria-pressed={on}
        title={it.title}
        className={cn(COLS, "min-w-0 flex-1 py-[7px] pl-4 text-left")}
      >
        <span className="num pt-px text-[11px] text-ink-3">{String(n).padStart(2, "0")}</span>
        <span
          className={cn(
            "line-clamp-2 text-[12.5px] leading-[1.45]",
            it.repealed ? "text-ink-2" : "text-ink",
            on && "font-medium",
          )}
        >
          <Highlight text={it.title} query={query} />
          {it.repealed ? <Repealed /> : null}
        </span>
        <span className="num hidden pt-px text-[11.5px] text-ink-2 md:block">{it.date ?? ""}</span>
        <span className="num hidden truncate pt-px text-[11.5px] text-ink-2 md:block">{it.no ?? ""}</span>
      </button>
      <span className="flex w-12 shrink-0 justify-center py-[7px]">
        {it.url ? (
          <a
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Эх сурвалж нээх"
            title="Эх сурвалж нээх"
            className="grid size-5 place-items-center rounded-xs text-ink-3 hover:bg-paper-hi hover:text-(--tone)"
          >
            <ExternalLink size={12} />
          </a>
        ) : (
          <span className="pt-px text-[11px] text-ink-3" title="Холбоос олдоогүй">
            —
          </span>
        )}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 py-2 text-[12px]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function Detail({ item: it, onClose }: { item: WaterLawItem; onClose: () => void }) {
  const meta = META.get(it);
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow pt-1">
          {[meta?.group.label, shortOf(it.section)].filter(Boolean).join(" · ")}
          {meta ? <span className="num"> · {String(meta.n).padStart(2, "0")}</span> : null}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Хаах"
          className="grid size-6 shrink-0 place-items-center rounded-xs text-ink-3 hover:bg-paper-hi hover:text-ink"
        >
          <X size={13} />
        </button>
      </div>
      <h3 className="display mt-2 text-[15px] leading-snug text-ink">{it.title}</h3>

      {it.repealed ? (
        <div className="mt-3 rounded-xs border border-(--ochre)/40 bg-(--ochre)/8 px-3 py-2 text-[12px]">
          <p className="font-medium text-(--ochre)">Хүчингүй болсон</p>
          <p className="mt-0.5 text-ink-2">{it.repealed}</p>
        </div>
      ) : null}

      <dl className="mt-3 divide-y divide-line border-y border-line">
        {it.act ? <Field label="Батлах акт">{it.act}</Field> : null}
        <Field label="Огноо">
          <span className="num">{it.date ?? "—"}</span>
        </Field>
        <Field label="Дугаар">
          <span className="num">{it.no ?? "—"}</span>
        </Field>
        {it.note ? <Field label="Тэмдэглэл">{it.note}</Field> : null}
        {it.section ? <Field label="Хэсэг">{it.section}</Field> : null}
      </dl>

      {it.url ? (
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex h-8 items-center justify-center gap-2 rounded-xs border border-(--tone)/45 bg-(--tone)/10 text-[12px] font-medium text-ink transition-colors hover:bg-(--tone)/18"
        >
          <ExternalLink size={13} className="text-(--tone)" />
          Эх сурвалж нээх
        </a>
      ) : (
        <p className="mt-4 flex h-8 items-center justify-center rounded-xs border border-dashed border-line-2 text-[12px] text-ink-3">
          Холбоос олдоогүй
        </p>
      )}
    </div>
  );
}
