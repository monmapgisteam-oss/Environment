"use client";

import * as React from "react";
import { Archive, ChevronRight, Scale, ShieldCheck } from "lucide-react";
import {
  BRANCHES,
  DECISION,
  DOCUMENTS,
  FINAL_STAGE,
  INSPECTION_TYPES,
  LEGAL_BASIS,
  RECORD_KEEPING,
  STAGES,
  type Activity,
  type InspectionTypeId,
} from "@/lib/inspection-scheme";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Хяналт шалгалтын үйл ажиллагааны схем

   ЭНЭ НЬ САМБАР БИШ. Платформын бусад харагдац бол бүртгэлийг тоолж,
   зурагт буулгадаг; энэ нь хэлтсийн ажлын урсгалыг тайлбарладаг ЖУРАМ.
   Тиймээс газрын зураг, диаграм, үзүүлэлт, шүүлтүүрийн мөр байхгүй.

   БҮТЭЦ НЬ ХҮСНЭГТ, ЗУРАГ БИШ. Эх сурвалж нь зурагдсан схем боловч
   түүнийг хуулбарлавал өнгөт блок, сум, бөмбөлөг бүхий ЗУРАГТ ХУУДАС
   болно — платформын "хээрийн хэмжих хэрэгсэл" хэлнээс сална. Журам нь
   мөн чанараараа дараалсан мөрүүд бөгөөд мөр бүр нь ажиллагаа, гарц,
   хугацаатай: энэ бол хүснэгт. Дараалал нь сумаар биш дугаар ба мөрийн
   эрэмбээр, ялгаа нь дүүргэлтээр биш 1px зураасаар илэрнэ.

   ӨНГӨ нь зөвхөн ЗУРААС, ТЭМДЭГ дээр: үе шатын дугаар, мөрийн зүүн
   ирмэгийн 2px зураас, салаа бүрийн цэг. Дэвсгэр дүүргэлт БАЙХГҮЙ.

   ХОЁР ТҮВШИНД ХУРААНА. Журам бүтнээрээ нэг дэлгэцэнд багтахгүй тул
   хэрэглэгч хэрэгтэй хэсгээ л нээж ажиллана:
     · хэсэг (төрөл / үе шат / лавлах),
     · үе шат тус бүрийн ажиллагааны жагсаалт.
   Хураасан үе шатны ГАРЦ, ХУГАЦАА нь ХАРАГДСААР үлдэнэ — тэдгээр нь
   өөрсдөө хураангуй бөгөөд урсгалыг гүйлгэн харах гол мэдээлэл.

   ТӨРӨЛ СОНГОХ нь шүүлтүүр биш ХАРАГДАЦ: бэлтгэлийн үе шат төрлөөсөө
   хамаарч өөр байдаг тул сонгосон төрөлд хамаарахгүй ажиллагаа бүдгэрч,
   ХЭВЭЭР харагдана. Нуувал урсгал таслагдаж, "энэ алхам байхгүй" гэсэн
   ойлголт төрнө.
   -------------------------------------------------------------------------- */

const SECTIONS = ["types", "stages", "refs"] as const;
type SectionId = (typeof SECTIONS)[number];

/** Хураах боломжтой үе шатын мөрүүд — шийдвэрийн цэг ажиллагаагүй тул орохгүй */
const ROW_IDS = [...STAGES.map((s) => s.no), ...BRANCHES.map((b) => b.answer), FINAL_STAGE.no];

export function InspectionScheme() {
  const [type, setType] = React.useState<InspectionTypeId | null>(null);

  /*
    Нээлттэй байгаа зүйлсийг барина (хаалттайг биш): шинэ үе шат нэмэгдвэл
    жагсаалтад нь ороогүй байсан ч анхдагчаараа нээлттэй байх ёстой.
  */
  const [open, setOpen] = React.useState<Set<string>>(
    () => new Set<string>([...SECTIONS, ...ROW_IDS]),
  );

  const toggle = React.useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const allOpen = open.size > 0;
  const toggleAll = React.useCallback(() => {
    setOpen((prev) =>
      prev.size > 0 ? new Set<string>() : new Set<string>([...SECTIONS, ...ROW_IDS]),
    );
  }, []);

  const shows = (id: string) => open.has(id);

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-xs border border-line bg-paper-2">
      {/* ---- Толгой ---- */}
      <header className="border-b border-line px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow">Хяналтын хэлтэс</div>
            <h1 className="display mt-1 text-[15px] leading-none tracking-[0.04em] uppercase">
              Хяналт шалгалтын үйл ажиллагааны схем
            </h1>
          </div>
          <div className="flex shrink-0 items-baseline gap-3">
            <button
              onClick={toggleAll}
              className="text-[11px] text-ink-3 transition-colors hover:text-ink"
            >
              {allOpen ? "Бүгдийг хураах" : "Бүгдийг дэлгэх"}
            </button>
            <span className="num text-[12px] text-ink-3">2026 он</span>
          </div>
        </div>
        <div className="ruler mt-2.5" aria-hidden />
      </header>

      {/* ---- Хяналт шалгалтын төрөл ---- */}
      <Section
        id="types"
        title="Хяналт шалгалтын төрөл"
        note={`${INSPECTION_TYPES.length} төрөл`}
        open={shows("types")}
        onToggle={toggle}
      >
        <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {INSPECTION_TYPES.map((t) => {
            const on = type === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setType(on ? null : t.id)}
                className={cn(
                  "relative px-3 py-2.5 text-left transition-colors",
                  on ? "bg-paper-hi" : "hover:bg-paper-hi",
                )}
              >
                {/* Сонголтыг дүүргэлтээр биш ирмэгийн зураасаар */}
                {on ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[2px] bg-(--tone)"
                  />
                ) : null}
                <div
                  className={cn(
                    "text-[12px] leading-none",
                    on ? "font-medium text-(--tone)" : "text-ink",
                  )}
                >
                  {t.label}
                </div>
                <ul className="mt-1.5 space-y-[3px]">
                  {t.basis.map((b) => (
                    <li key={b} className="text-[10.5px] leading-snug text-ink-3">
                      {b}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ---- Үндсэн үе шат ---- */}
      <Section
        id="stages"
        title="Хяналт шалгалтын үндсэн үе шат"
        note={`${STAGES.length + 1} үе шат`}
        open={shows("stages")}
        onToggle={toggle}
      >
        {/* Нарийн дэлгэц дээр хүснэгт дотроо хөндлөн гүйнэ */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-paper-3">
                <Th className="w-[188px]">Үе шат</Th>
                <Th>Гол ажиллагаа</Th>
                <Th className="w-[204px]">Гарц</Th>
                <Th className="w-[176px]">Хугацаа</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {STAGES.map((s) => (
                <StageRow
                  key={s.no}
                  id={s.no}
                  open={shows(s.no)}
                  onToggle={toggle}
                  lead={
                    <>
                      <span className="num text-[13px] leading-none font-medium text-(--tone)">
                        {s.no}
                      </span>
                      <span className="text-[11.5px] leading-snug text-ink">
                        {s.title}
                      </span>
                    </>
                  }
                  activities={s.activities}
                  type={type}
                  output={s.output}
                  period={s.period}
                />
              ))}

              {/* Шийдвэрийн цэг — тусдаа блок биш, хүснэгтийн нэг мөр */}
              <tr>
                <td colSpan={4} className="border-y border-line-2 px-3 py-1.5">
                  <span className="eyebrow text-(--tone)">{DECISION}</span>
                </td>
              </tr>

              {BRANCHES.map((b) => {
                const risk = b.answer === "Тийм";
                return (
                  <StageRow
                    key={b.answer}
                    id={b.answer}
                    open={shows(b.answer)}
                    onToggle={toggle}
                    tone={risk ? "var(--clay)" : "var(--moss)"}
                    lead={
                      <>
                        <span
                          aria-hidden
                          className="mt-[4px] size-[5px] shrink-0 rounded-full bg-(--branch)"
                        />
                        <span className="text-[11.5px] leading-snug text-(--branch)">
                          {b.answer}
                        </span>
                        <span className="text-[11.5px] leading-snug text-ink">
                          {b.title}
                        </span>
                      </>
                    }
                    activities={b.steps}
                    type={null}
                    output="—"
                    period={b.period}
                  />
                );
              })}

              <StageRow
                id={FINAL_STAGE.no}
                open={shows(FINAL_STAGE.no)}
                onToggle={toggle}
                lead={
                  <>
                    <span className="num text-[13px] leading-none font-medium text-(--tone)">
                      {FINAL_STAGE.no}
                    </span>
                    <span className="text-[11.5px] leading-snug text-ink">
                      {FINAL_STAGE.title}
                    </span>
                  </>
                }
                activities={FINAL_STAGE.steps.map((text) => ({ text }))}
                type={null}
                output={FINAL_STAGE.doc}
                period="—"
              />
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---- Лавлах жагсаалтууд ---- */}
      <Section
        id="refs"
        title="Лавлах"
        note={`${DOCUMENTS.length + LEGAL_BASIS.length + RECORD_KEEPING.length} бичлэг`}
        open={shows("refs")}
        onToggle={toggle}
      >
        <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          <RefList icon={ShieldCheck} title="Ашиглах баримт бичиг" numbered>
            {DOCUMENTS}
          </RefList>
          <RefList icon={Scale} title="Үндэслэл хууль, журам">
            {LEGAL_BASIS}
          </RefList>
          <RefList icon={Archive} title="Хадгалах, бүртгэл">
            {RECORD_KEEPING}
          </RefList>
        </div>
      </Section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Хураагддаг хэсэг.
 *
 * Толгой нь дүүргэлтгүй, зурвасын өнгөөр л ялгарна. Баруун талд агуулгын
 * хэмжээ — хураасан үед доор нь юу байгааг мэдэх цорын ганц заалт.
 */
function Section({
  id,
  title,
  note,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  note: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <button
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 bg-paper-3 px-3 py-1.5 text-left transition-colors hover:bg-paper-hi"
      >
        <ChevronRight
          size={11}
          className={cn(
            "shrink-0 text-ink-3 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="eyebrow flex-1">{title}</span>
        <span className="num text-[10px] text-ink-3">{note}</span>
      </button>
      {open ? children : null}
    </section>
  );
}

/**
 * Үе шатын мөр.
 *
 * Хураасан үед ГАРЦ, ХУГАЦАА нь харагдсаар үлдэж, зөвхөн ажиллагааны
 * жагсаалт нь ажиллагааны ТООГООР солигдоно — урсгалын хураангуйг
 * алдалгүйгээр өндрийг богиносгоно.
 */
function StageRow({
  id,
  open,
  onToggle,
  tone,
  lead,
  activities,
  type,
  output,
  period,
}: {
  id: string;
  open: boolean;
  onToggle: (id: string) => void;
  /** Салаа бүрийн өнгө. Өгөөгүй бол хэлтсийн өнгө */
  tone?: string;
  lead: React.ReactNode;
  activities: Activity[];
  type: InspectionTypeId | null;
  output: string;
  period: string;
}) {
  return (
    <tr
      className="align-top"
      style={tone ? ({ "--branch": tone } as React.CSSProperties) : undefined}
    >
      <Td>
        <button
          onClick={() => onToggle(id)}
          aria-expanded={open}
          className="group flex w-full items-baseline gap-1.5 text-left"
        >
          <ChevronRight
            size={11}
            className={cn(
              "mt-[1px] shrink-0 text-ink-3 transition-transform group-hover:text-ink",
              open && "rotate-90",
            )}
          />
          {lead}
        </button>
      </Td>
      <Td>
        {open ? (
          <ul className="space-y-1.5">
            {activities.map((a) => (
              <ActivityRow key={a.text} a={a} type={type} />
            ))}
          </ul>
        ) : (
          <span className="num text-[10.5px] text-ink-3">
            {activities.length} ажиллагаа
          </span>
        )}
      </Td>
      <Td muted>{output}</Td>
      <Td muted>{period}</Td>
    </tr>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "eyebrow px-3 py-1.5 text-left align-bottom font-normal text-ink-3",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td className={cn("px-3 py-2.5", muted && "text-[10.5px] leading-snug text-ink-3")}>
      {children}
    </td>
  );
}

/**
 * Ажиллагааны мөр.
 *
 * Сонгосон төрөлд хамаарахгүй бол БҮДГЭРНЭ, алга болохгүй: урсгалаас
 * алхам хасвал журам өөрөө өөрчлөгдсөн мэт уншигдана.
 *
 * Холбогдох бичиг баримт нь мөрийн доор жижгээр — тусдаа багана
 * гаргавал ажиллагааны бичвэр хэт нарийсна.
 */
function ActivityRow({ a, type }: { a: Activity; type: InspectionTypeId | null }) {
  const off = type != null && a.only != null && !a.only.includes(type);
  return (
    <li className={cn("flex gap-2 transition-opacity", off && "opacity-35")}>
      <span aria-hidden className="mt-[7px] h-px w-2 shrink-0 bg-(--tone)" />
      <span className="min-w-0">
        <span className="block text-[11.5px] leading-snug text-ink">{a.text}</span>
        {a.doc ? (
          <span className="mt-[2px] block text-[10px] leading-snug text-ink-3">
            {a.doc}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function RefList({
  icon: Icon,
  title,
  numbered,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  numbered?: boolean;
  children: readonly string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5">
        <Icon size={12} className="shrink-0 text-ink-3" />
        <span className="eyebrow">{title}</span>
      </div>
      <ol className="px-3 pb-2.5">
        {children.map((d, i) => (
          <li key={d} className="flex gap-2 py-[3px]">
            {numbered ? (
              <span className="num shrink-0 text-[10px] text-ink-3">
                {String(i + 1).padStart(2, "0")}
              </span>
            ) : (
              <span aria-hidden className="mt-[7px] h-px w-2 shrink-0 bg-line-2" />
            )}
            <span className="min-w-0 text-[11px] leading-snug text-ink-2">{d}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
