"use client";

import { useState, useSyncExternalStore } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { asset } from "@/lib/base-path";
import { useLang } from "@/lib/i18n";

const MONTHS = [
  "Нэгдүгээр сар", "Хоёрдугаар сар", "Гуравдугаар сар", "Дөрөвдүгээр сар",
  "Тавдугаар сар", "Зургаадугаар сар", "Долоодугаар сар", "Наймдугаар сар",
  "Есдүгээр сар", "Аравдугаар сар", "Арван нэгдүгээр сар", "Арван хоёрдугаар сар",
];
/** Долоо хоног Даваагаас эхэлнэ — Монголын хуанлийн жишиг. */
const WEEK = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
const DAY_NAMES = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEK_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const en = useLang() === "en";
  const t = (mn: string, e: string) => (en ? e : mn);
  const months = en ? MONTHS_EN : MONTHS;
  const week = en ? WEEK_EN : WEEK;
  const dayNames = en ? DAY_NAMES_EN : DAY_NAMES;

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
    <section className="landscape-feature calendar-card" aria-label={t("Хуанли", "Calendar")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("/auth/envi-7.webp")} width={1832} height={859} alt="" fetchPriority="high" />
      <div className="calendar-head">
        <div>
          <span className="calendar-kicker"><CalendarDays size={13} /> {t("ХУАНЛИ", "CALENDAR")}</span>
          <h2>{key ? <>{months[month]} <span className="num">{year}</span></> : " "}</h2>
        </div>
        <div className="calendar-nav">
          {offset !== 0 && <button type="button" className="calendar-today" onClick={() => setOffset(0)}>{t("Өнөөдөр", "Today")}</button>}
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label={t("Өмнөх сар", "Previous month")}><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label={t("Дараах сар", "Next month")}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="calendar-grid" role="grid">
        {week.map((w, i) => <span key={w} className={i > 4 ? "calendar-wd is-weekend" : "calendar-wd"}>{w}</span>)}
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
            <span>{t("Өнөөдөр", "Today")}</span>
            <strong className="num">
              {today.getFullYear()}.{String(today.getMonth() + 1).padStart(2, "0")}.{String(today.getDate()).padStart(2, "0")}
            </strong>
            <span>{dayNames[today.getDay()]}</span>
          </>
        )}
      </div>
    </section>
  );
}
