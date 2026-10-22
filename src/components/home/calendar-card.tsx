"use client";

import { useState, useSyncExternalStore } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { asset } from "@/lib/base-path";

const MONTHS = [
  "Нэгдүгээр сар", "Хоёрдугаар сар", "Гуравдугаар сар", "Дөрөвдүгээр сар",
  "Тавдугаар сар", "Зургаадугаар сар", "Долоодугаар сар", "Наймдугаар сар",
  "Есдүгээр сар", "Аравдугаар сар", "Арван нэгдүгээр сар", "Арван хоёрдугаар сар",
];
/** Долоо хоног Даваагаас эхэлнэ — Монголын хуанлийн жишиг. */
const WEEK = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
const DAY_NAMES = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/**
 * Өнөөдрийн огноо зөвхөн хөтөч дээр уншигдана: сайт статикаар экспортлогддог
 * тул бүтээх мөчийн огноо HTML-д хөлдвөл гидраци зөрнө. Сервер талд `null`
 * буцааж, хуанли нь хоосон торон дээр эхэлнэ.
 */
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const noop = () => () => {};

export function CalendarCard() {
  const key = useSyncExternalStore(noop, todayKey, () => null);
  const [offset, setOffset] = useState(0);

  const [ty, tm, td] = key ? key.split("-").map(Number) : [2000, 0, 1];
  const first = new Date(ty, tm + offset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  // Зургаан долоо хоног ТОГТМОЛ — сар солиход картын өндөр үсрэхгүй.
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - lead + 1;
    return day >= 1 && day <= days ? day : null;
  });
  const isToday = (d: number) => key !== null && d === td && month === tm && year === ty;
  const today = key ? new Date(ty, tm, td) : null;

  return (
    <section className="landscape-feature calendar-card" aria-label="Хуанли">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("/auth/envi-7.webp")} width={1832} height={859} alt="" fetchPriority="high" />
      <div className="calendar-head">
        <div>
          <span className="calendar-kicker"><CalendarDays size={13} /> ХУАНЛИ</span>
          <h2>{key ? <>{MONTHS[month]} <span className="num">{year}</span></> : " "}</h2>
        </div>
        <div className="calendar-nav">
          {offset !== 0 && <button type="button" className="calendar-today" onClick={() => setOffset(0)}>Өнөөдөр</button>}
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Өмнөх сар"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Дараах сар"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="calendar-grid" role="grid">
        {WEEK.map((w, i) => <span key={w} className={i > 4 ? "calendar-wd is-weekend" : "calendar-wd"}>{w}</span>)}
        {cells.map((d, i) => (
          <span
            key={i}
            className={["calendar-day num", i % 7 > 4 && "is-weekend", d !== null && isToday(d) && "is-today"].filter(Boolean).join(" ")}
          >
            {key ? d : null}
          </span>
        ))}
      </div>
      <div className="calendar-foot">
        {today && (
          <>
            <span>Өнөөдөр</span>
            <strong className="num">
              {today.getFullYear()}.{String(today.getMonth() + 1).padStart(2, "0")}.{String(today.getDate()).padStart(2, "0")}
            </strong>
            <span>{DAY_NAMES[today.getDay()]}</span>
          </>
        )}
      </div>
    </section>
  );
}
