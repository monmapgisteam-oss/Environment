"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/i18n";
import styles from "./calendar-card.module.css";

const MONTHS = [
  "Нэгдүгээр сар", "Хоёрдугаар сар", "Гуравдугаар сар", "Дөрөвдүгээр сар",
  "Тавдугаар сар", "Зургаадугаар сар", "Долоодугаар сар", "Наймдугаар сар",
  "Есдүгээр сар", "Аравдугаар сар", "Арван нэгдүгээр сар", "Арван хоёрдугаар сар",
];

/** Долоо хоног Даваагаас эхэлнэ — Монголын хуанлийн жишиг. */
const WEEK = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
const WEEK_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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
  const week = en ? WEEK_EN : WEEK;

  const [ty, tm, td] = key ? key.split("-").map(Number) : [2000, 0, 1];
  const first = new Date(ty, tm + offset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const weeks = Math.ceil((lead + days) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date(year, month, i - lead + 1);
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    return {
      day: d,
      dateTime: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      outside: m !== month,
      today: key !== null && y === ty && m === tm && d === td,
    };
  });
  const today = key ? new Date(ty, tm, td) : null;

  return (
    <section className={styles.card} aria-label={t("Хуанли", "Calendar")}>
      <header className={styles.header}>
        <h2 aria-live="polite">{key ? MONTHS[month] : "\u00a0"}</h2>
        <span className={`num ${styles.year}`}>{key ? year : "\u00a0"}</span>
      </header>
      <div className={styles.divider} aria-hidden><span>✳</span></div>
      <table className={styles.grid} aria-label={key ? `${year}-${String(month + 1).padStart(2, "0")}` : t("Хуанли", "Calendar")}>
        <thead>
          <tr>{week.map((w) => <th key={w} scope="col">{w}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: weeks }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((d, column) => (
                <td key={column} className={d.outside ? styles.outside : undefined}>
                  {key ? (
                    <time
                      dateTime={d.dateTime}
                      aria-current={d.today ? "date" : undefined}
                      className={d.today ? `num ${styles.today}` : "num"}
                    >{d.day}</time>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <footer className={styles.footer}>
        <div className={styles.nav}>
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label={t("Өмнөх сар", "Previous month")}><ChevronLeft size={13} /></button>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label={t("Дараах сар", "Next month")}><ChevronRight size={13} /></button>
        </div>
        {today ? (
            <strong className="num">
              {today.getFullYear()}.{String(today.getMonth() + 1).padStart(2, "0")}.{String(today.getDate()).padStart(2, "0")}
            </strong>
        ) : null}
      </footer>
    </section>
  );
}
