"use client";

import * as React from "react";
import { Archive, CalendarClock, FileOutput, Scale, ShieldCheck } from "lucide-react";
import { Columns } from "@/components/ui/resizable-columns";
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
import { cn, num } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Хяналт шалгалтын үйл ажиллагааны схем

   ЭНЭ НЬ САМБАР БИШ — бүртгэл тоолохгүй, зурагт буулгахгүй. Хэлтсийн
   АЖЛЫН УРСГАЛ.

   Тиймээс урсгал шигээ харагдана: босоо ГОЛ ШУГАМ дээр үе шатууд
   зангилаа болж суух ба шугам нь дараалал, чиглэлийг өөрөө хэлнэ.
   Зөрчил илэрсэн эсэхээр шугам ХОЁР САЛАА болж, дараа нь эцсийн үе
   шатанд нийлнэ.

   ГУРВАН ХУВИЛБАР ТУРШСАН, эхний хоёр нь бүтсэнгүй:

     1. Эх сурвалжийн инфографикийг хуулбарласан — өнгөт блок, сум,
        бөмбөлөг. Платформын "хээрийн хэмжих хэрэгсэл" хэлнээс салсан
        зурагт хуудас болов.
     2. Бүх үе шатыг нэг хүснэгтэд дэлгэсэн — нүд бүрд хоёроос зургаан
        ажиллагаа, тус бүр баримт бичгийн тайлбартай тул бичвэрийн хана
        болов. Хураах товч ч түүнийг шийдээгүй.

   Одоо: урсгалын хэлбэр нь ХАДГАЛАГДСАН ч дүрслэл нь платформынх —
   өнгөт дүүргэлт, сум БАЙХГҮЙ, зөвхөн 1px зураас, зангилааны цэг,
   дугаар. Гүнийг сүүдрээр биш давхаргаар (`paper` → `paper-2`).
   -------------------------------------------------------------------------- */

export function InspectionScheme() {
  /*
    Хяналт шалгалтын төрөл. Бэлтгэлийн үе шат ГАНЦААРАА төрлөөсөө
    хамаарч өөр байдаг тул сонголт нь зөвхөн тэнд нөлөөлнө — сонгосон
    төрөлд хамаарахгүй ажиллагаа бүдгэрч, ХЭВЭЭР харагдана. Нуувал
    урсгал таслагдаж, "энэ алхам байхгүй" гэсэн ойлголт төрнө.
  */
  const [type, setType] = React.useState<InspectionTypeId | null>(null);

  return (
    <Columns id="scheme" right={248} className="h-full min-h-0">
      {/* ---- ЗҮҮН: урсгал ---- */}
      <div className="flex min-h-0 min-w-0 flex-col rounded-xs border border-line bg-paper-2">
        <header className="shrink-0 border-b border-line px-4 py-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow">Хяналтын хэлтэс</div>
              <h1 className="display mt-1 truncate text-[14px] leading-none tracking-[0.04em] uppercase">
                Хяналт шалгалтын үйл ажиллагааны схем
              </h1>
            </div>
            <span className="num shrink-0 text-[12px] text-ink-3">2026 он</span>
          </div>
        </header>

        {/* Төрөл — урсгалын ЭХЛЭЛ. Аль үндэслэлээр шалгалт эхэлж байгаа
            нь бэлтгэлийн үе шатны агуулгыг тодорхойлно */}
        <div className="shrink-0 border-b border-line bg-paper-3 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="eyebrow shrink-0">Хяналт шалгалтын төрөл</span>
            <div className="flex flex-wrap items-center gap-1">
              {INSPECTION_TYPES.map((t) => {
                const on = type === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setType(on ? null : t.id)}
                    title={t.basis.join(" · ")}
                    className={cn(
                      "rounded-xs border px-2 py-1 text-[11px] leading-none transition-colors",
                      on
                        ? "border-(--tone)/45 bg-(--tone)/10 font-medium text-(--tone)"
                        : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {type ? (
              <span className="text-[10.5px] leading-snug text-ink-3">
                {INSPECTION_TYPES.find((t) => t.id === type)?.basis.join(" · ")}
              </span>
            ) : null}
          </div>
        </div>

        {/* ---- Урсгал ---- */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/*
            ГОЛ ШУГАМ. Зангилаанууд түүн дээр суух тул зүүн доголыг
            шугамын зузаанаас тооцно. Сум ЗУРАХГҮЙ — тасралтгүй шугам
            өөрөө дарааллыг хэлнэ.
          */}
          <div className="relative border-l border-line-2 pl-5">
            {STAGES.map((s) => (
              <Node key={s.no} mark={s.no}>
                <StageCard
                  title={s.title}
                  output={s.output}
                  period={s.period}
                  activities={s.activities}
                  type={type}
                />
              </Node>
            ))}

            {/* Шийдвэрийн зангилаа — дугаар биш ромб */}
            <Node diamond>
              <div className="flex items-center gap-2 py-1">
                <span className="display text-[12.5px] leading-none tracking-[0.05em] text-(--tone) uppercase">
                  {DECISION}
                </span>
              </div>
            </Node>

            {/*
              ХОЁР САЛАА ЗЭРЭГЦЭЖ. Дараалсан жагсаалт болговол нэг нь
              нөгөөгийнхөө дараа явдаг мэт уншигдана — эдгээр нь эсрэг
              хоёр зам.
            */}
            <div className="relative -ml-5 mb-3 grid gap-2.5 border-t border-line pt-3 pl-5 md:grid-cols-2">
              {BRANCHES.map((b) => (
                <BranchCard key={b.answer} branch={b} />
              ))}
            </div>

            <Node mark={FINAL_STAGE.no}>
              <StageCard
                title={FINAL_STAGE.title}
                output={FINAL_STAGE.doc}
                activities={FINAL_STAGE.steps.map((text) => ({ text }))}
                type={null}
              />
            </Node>
          </div>
        </div>
      </div>

      {/* ---- БАРУУН: лавлах ---- */}
      <div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto">
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
    </Columns>
  );
}

/* --------------------------------------------------------------------------
   ЗАНГИЛАА — гол шугам дээрх нэг цэг

   Тэмдэг нь шугамыг ТАСАЛЖ суух ёстой: дэвсгэрийн өнгөтэй цагираг
   шугамыг халхлаад, дээр нь дугаар эсвэл ромб гарна. Ингэснээр шугам
   зангилаа хоёр нэг эд болж, сум зурах шаардлагагүй.
   -------------------------------------------------------------------------- */

function Node({
  mark,
  diamond,
  children,
}: {
  mark?: string;
  diamond?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mb-3 last:mb-0">
      <span
        aria-hidden
        className={cn(
          "absolute top-[7px] flex items-center justify-center bg-paper-2",
          diamond
            ? "-left-[calc(1.25rem+5px)] size-[10px] rotate-45 border border-(--tone)"
            : "-left-[calc(1.25rem+11px)] size-[22px] rounded-full",
        )}
      >
        {diamond ? null : (
          <span className="num text-[10.5px] leading-none font-medium text-(--tone)">
            {mark}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StageCard({
  title,
  output,
  period,
  activities,
  type,
}: {
  title: string;
  output: string;
  period?: string;
  activities: readonly Activity[];
  type: InspectionTypeId | null;
}) {
  return (
    <div className="rounded-xs border border-line bg-paper">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-3 py-2">
        <h2 className="display text-[12.5px] leading-none">{title}</h2>
        <span className="num text-[10px] text-ink-3">{activities.length} ажиллагаа</span>
      </div>

      <ActivityList activities={activities} type={type} />

      {/* Гарц, хугацаа нь үе шатны ТӨГСГӨЛД — ажиллагаанууд дууссаны
          дараа юу гарч, хэдэн хоног зарцуулсныг хэлнэ */}
      <div className="grid divide-y divide-line border-t border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Fact icon={FileOutput} label="Гарц" text={output} />
        {period ? <Fact icon={CalendarClock} label="Хугацаа" text={period} /> : null}
      </div>
    </div>
  );
}

function BranchCard({ branch }: { branch: (typeof BRANCHES)[number] }) {
  const risk = branch.answer === "Тийм";
  return (
    <div
      className="rounded-xs border border-line bg-paper"
      style={{ "--branch": risk ? "var(--clay)" : "var(--moss)" } as React.CSSProperties}
    >
      {/* Салааны өнгө нь дээд ирмэгийн 2px зураас — дүүргэлт биш */}
      <span aria-hidden className="block h-[2px] w-full bg-(--branch)" />
      <div className="flex items-baseline gap-2 border-b border-line px-3 py-2">
        <span className="shrink-0 text-[10.5px] leading-none text-(--branch)">
          {branch.answer}
        </span>
        <h3 className="display min-w-0 flex-1 truncate text-[12px] leading-none">
          {branch.title}
        </h3>
      </div>

      <ActivityList activities={branch.steps} type={null} tone="var(--branch)" />

      <div className="border-t border-line">
        <Fact icon={CalendarClock} label="Хугацаа" text={branch.period} />
      </div>
    </div>
  );
}

/**
 * Ажиллагааны жагсаалт — дугаарласан.
 *
 * Холбогдох баримт бичиг нь мөрийн доор жижгээр. Тусдаа багана
 * гаргавал хоёулаа нарийсна; бичвэрийн доор бол ажиллагаа бүр өөрийн
 * баримттайгаа хамт уншигдана.
 */
function ActivityList({
  activities,
  type,
  tone = "var(--tone)",
}: {
  activities: readonly Activity[];
  type: InspectionTypeId | null;
  tone?: string;
}) {
  return (
    <ol className="divide-y divide-line">
      {activities.map((a, i) => {
        const off = type != null && a.only != null && !a.only.includes(type);
        return (
          <li
            key={a.text}
            className={cn("flex gap-2.5 px-3 py-1.5 transition-opacity", off && "opacity-35")}
          >
            <span
              className="num w-[15px] shrink-0 pt-[1px] text-[10px]"
              style={{ color: tone }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
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
      })}
    </ol>
  );
}

function Fact({
  icon: Icon,
  label,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  text: string;
}) {
  return (
    <div className="flex gap-1.5 px-3 py-1.5">
      <Icon size={11} className="mt-[2px] shrink-0 text-ink-3" />
      <span className="min-w-0">
        <span className="eyebrow block">{label}</span>
        <span className="mt-[2px] block text-[10.5px] leading-snug text-ink-2">{text}</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

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
    <div className="shrink-0 rounded-xs border border-line bg-paper-2">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <Icon size={12} className="shrink-0 text-ink-3" />
        <span className="display flex-1 text-[11.5px] leading-none tracking-[0.05em] uppercase">
          {title}
        </span>
        <span className="num text-[10px] text-ink-3">{num(children.length)}</span>
      </div>
      <ol className="divide-y divide-line">
        {children.map((d, i) => (
          <li key={d} className="flex gap-2 px-3 py-1.5">
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
