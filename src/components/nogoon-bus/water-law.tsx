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
  № · нэр (нэг эгнээнд тасарна, бүтэн нэр, батлах акт, хүчингүйн шалтгаан
  `title`-д) · огноо · дугаар · холбоосын тэмдэг. Толгойд бүлгийн таб ба хайлт
  (БҮХ бүлгээс), доор нь хэсгийн товч; хэсгийн гарчиг (богино нэр) наалдана.
  Буцаагдсан — дахин бүү давт: нэг урт задгай жагсаалт; зүүн талын тусдаа
  ангиллын цэс ("Өгөгдлийн багц"-тай хоёр цэсийн багана); олон мөрт
  баганатай хүснэгт (нэрийн доор акт, хүчингүйн шалтгаан мөр бүрд).
  Санал болгоод сонгогдоогүй: карт тор, он дарааллын шугам.
  Хоосон бүлэг нь `.hatch` — "хоосон" биш "хүлээгдэж буй".
  Хүчингүй болсон баримт нэрийн өмнө `--ochre` цэгтэй, нэр нь бүдэг.
*/

/* Товчны богино нэр — бүтэн нэр нь хэсгийн гарчигт. */
const SHORT: Record<string, string> = {
  "Улсын Их Хурлаар батлагдсан хууль, бодлогын баримт бичиг": "Улсын Их Хурал",
  "Засгийн газрын тогтоол, шийдвэр": "Засгийн газар",
  "Байгаль орчин, аялал жуулчлалын сайдын тушаал, хамтарсан тушаал": "Сайдын тушаал",
};

const COLS = "grid grid-cols-[28px_minmax(0,1fr)_20px] items-center gap-x-3 md:grid-cols-[28px_minmax(0,1fr)_76px_96px_20px]";

function sectionsOf(items: WaterLawItem[]) {
  const out: { name?: string; items: WaterLawItem[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.name === it.section) last.items.push(it);
    else out.push({ name: it.section, items: [it] });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"«»]/g, "").replace(/\s+/g, " ");
const text = (it: WaterLawItem) =>
  norm([it.title, it.act, it.date, it.no, it.note, it.repealed].filter(Boolean).join(" "));

export function WaterLaw() {
  const [groupId, setGroupId] = React.useState<WaterLawGroup["id"]>(WATER_LAW[0].id);
  const [section, setSection] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const q = norm(query.trim());

  const group = WATER_LAW.find((g) => g.id === groupId) ?? WATER_LAW[0];
  const groupSections = React.useMemo(() => sectionsOf(group.items).filter((s) => s.name), [group]);

  const blocks = React.useMemo(() => {
    if (q) {
      return WATER_LAW.flatMap((g) =>
        sectionsOf(g.items.filter((it) => text(it).includes(q))).map((s) => ({
          ...s,
          name: s.name ?? g.label,
        })),
      );
    }
    const all = sectionsOf(group.items);
    return section ? all.filter((s) => s.name === section) : all;
  }, [q, group, section]);

  const shown = blocks.reduce((n, b) => n + b.items.length, 0);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xs border border-line bg-paper-2">
      {/* Толгой: бүлгийн таб · хайлт */}
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-line px-4 pt-3">
        <nav className="-mb-px flex min-w-0 flex-1 flex-wrap gap-x-5" aria-label="Бүлэг">
          {WATER_LAW.map((g) => {
            const on = !q && g.id === groupId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setQuery("");
                  setGroupId(g.id);
                  setSection(null);
                }}
                aria-current={on || undefined}
                className={cn(
                  "flex items-baseline gap-1.5 border-b-2 pb-2.5 text-[12.5px] transition-colors",
                  on ? "border-(--tone) font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                {g.label}
                <span className={cn("num text-[11px]", on ? "text-(--tone)" : "text-ink-3")}>
                  {g.items.length || "—"}
                </span>
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

      {/* Хэсгийн товч */}
      {(q || groupSections.length > 1) && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2">
          {q ? (
            <span className="text-[11.5px] text-ink-2">
              Хайлтын илэрц · <span className="num">{shown}</span> баримт
            </span>
          ) : (
            [null, ...groupSections.map((s) => s.name!)].map((name) => {
              const on = section === name;
              const count = name
                ? (groupSections.find((s) => s.name === name)?.items.length ?? 0)
                : group.items.length;
              return (
                <button
                  key={name ?? "all"}
                  type="button"
                  onClick={() => setSection(name)}
                  title={name ?? undefined}
                  className={cn(
                    "flex items-baseline gap-1.5 rounded-xs border px-2.5 py-1 text-[11.5px] transition-colors",
                    on
                      ? "border-(--tone)/40 bg-(--tone)/10 text-ink"
                      : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                  )}
                >
                  {name ? (SHORT[name] ?? name) : "Бүгд"}
                  <span className={cn("num text-[10.5px]", on ? "text-(--tone)" : "text-ink-3")}>{count}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Жагсаалт */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {blocks.length ? (
          <>
            {blocks.map((s, si) => (
              <div key={`${s.name ?? ""}-${si}`}>
                {s.name && (blocks.length > 1 || q) && (
                  <div
                    title={s.name}
                    className="sticky top-0 z-10 border-b border-line bg-paper-3 px-4 py-1.5 text-[11px] font-semibold text-ink-2"
                  >
                    {SHORT[s.name] ?? s.name}
                    <span className="num ml-1.5 font-normal text-ink-3">· {s.items.length}</span>
                  </div>
                )}
                <ol className="divide-y divide-line">
                  {s.items.map((it, i) => (
                    <li key={`${it.title}-${it.no ?? it.date ?? i}`}>
                      <Row item={it} n={i + 1} />
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
    </section>
  );
}

/* Нэг мөр. Хаягтай нь шинэ цонхоор нээгдэх холбоос; хаяггүй нь бүдэг,
   товшигдохгүй, холбоосын баганад зураас. Бүтэн мэдээлэл `title`-д. */
function Row({ item: it, n }: { item: WaterLawItem; n: number }) {
  const tip = [
    it.title,
    [it.act && `“${it.act}”`, it.note].filter(Boolean).join(" · "),
    it.repealed,
    it.url ? "" : "Холбоос олдоогүй",
  ]
    .filter(Boolean)
    .join("\n");
  const body = (
    <>
      <span className="num text-[11px] text-ink-3">{String(n).padStart(2, "0")}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        {it.repealed && <span className="size-1.5 shrink-0 rounded-full bg-(--ochre)" />}
        <span
          className={cn(
            "truncate text-[12.5px]",
            it.url && "group-hover:text-(--tone)",
            it.repealed || !it.url ? "text-ink-2" : "text-ink",
          )}
        >
          {it.title}
        </span>
      </span>
      <span className="num hidden text-[11.5px] text-ink-2 md:block">{it.date ?? ""}</span>
      <span className="num hidden truncate text-[11.5px] text-ink-2 md:block">{it.no ?? ""}</span>
      <span className="flex justify-end">
        {it.url ? (
          <ExternalLink size={12} className="text-ink-3 group-hover:text-(--tone)" />
        ) : (
          <span className="text-[11px] text-ink-3">—</span>
        )}
      </span>
    </>
  );
  const cls = cn(COLS, "px-4 py-[7px]");
  return it.url ? (
    <a
      href={it.url}
      target="_blank"
      rel="noopener noreferrer"
      title={tip}
      className={cn("group hover:bg-paper-hi", cls)}
    >
      {body}
    </a>
  ) : (
    <div title={tip} className={cls}>
      {body}
    </div>
  );
}
