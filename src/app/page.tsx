import Link from "next/link";
import { ArrowRight, Database, Layers3, Leaf, Radio, Timer } from "lucide-react";
import { DepartmentDirectory } from "@/components/home/department-directory";
import { DEPARTMENTS } from "@/lib/departments";

export default function Home() {
  const live = DEPARTMENTS.filter((department) => department.status === "live").length;
  const waiting = DEPARTMENTS.length - live;

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <header className="relative overflow-hidden rounded-xl border border-line bg-paper-2">
        <svg className="pointer-events-none absolute inset-y-0 right-0 h-full w-[60%] text-moss opacity-[0.14]" viewBox="0 0 600 400" fill="none" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <path key={index} d="M640 30C490-65 340 5 370 110S540 190 465 270 265 200 220 315 360 465 510 430" stroke="currentColor" strokeWidth="1" transform={`translate(${index * -19} ${index * 5})`} />
          ))}
        </svg>
        <div className="relative max-w-[660px] p-6 sm:p-8 lg:p-10">
          <div className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-moss">
            <Leaf size={15} aria-hidden="true" />
            Байгаль орчны хяналтын нэгдсэн систем
          </div>
          <h1 className="display text-3xl leading-tight sm:text-[38px]">Ерөнхий самбар</h1>
          <p className="mt-3 max-w-[450px] text-sm leading-7 text-ink-2">
            Байгаль орчны мэдээлэл нэг дор.<br />
            Хэлтсээ сонгож, холбогдсон өгөгдөлтэй танилцаарай.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="#departments" className="inline-flex min-h-11 items-center gap-3 rounded-md bg-moss px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-85">
              Хэлтсүүдийг харах <ArrowRight size={16} aria-hidden="true" />
            </a>
            <Link href="/sources" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-2 bg-paper-2 px-4 text-sm text-ink-2 transition-colors hover:bg-paper-hi">
              <Database size={15} aria-hidden="true" /> Дата эх сурвалж
            </Link>
          </div>
        </div>
        <dl className="relative grid grid-cols-1 border-t border-line bg-paper-2/80 sm:grid-cols-3">
          {[
            { label: "Нийт хэлтэс", value: DEPARTMENTS.length, icon: Layers3, color: "text-ink-2" },
            { label: "Дата холбогдсон", value: live, icon: Radio, color: "text-moss" },
            { label: "Бүрэн холбогдоогүй", value: waiting, icon: Timer, color: "text-ink-3" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-4 border-line px-6 py-5 max-sm:border-b max-sm:last:border-b-0 sm:border-r sm:last:border-r-0 lg:px-10">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg border border-line ${stat.color}`}><stat.icon size={19} strokeWidth={1.5} aria-hidden="true" /></span>
              <div><dt className="text-xs text-ink-3">{stat.label}</dt><dd className="num mt-1 text-2xl font-semibold leading-none">{stat.value.toString().padStart(2, "0")}</dd></div>
            </div>
          ))}
        </dl>
      </header>
      <DepartmentDirectory />
      <Link href="/sources" className="group flex items-center gap-4 rounded-lg border border-line bg-paper-2 p-5 transition-colors hover:border-line-2 hover:bg-paper-hi sm:px-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line text-moss"><Database size={20} strokeWidth={1.5} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Мэдээллийн эх сурвалжтай танилцах</h2>
          <p className="mt-1 text-xs leading-5 text-ink-3">Хэлтсүүдэд холбогдсон өгөгдөл, үйлчилгээний нэгдсэн бүртгэл.</p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </Link>
    </div>
  );
}
