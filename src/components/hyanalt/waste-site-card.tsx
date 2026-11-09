"use client";

import * as React from "react";
import { Building2, ChevronDown, LandPlot, MapPin, Trash2 } from "lucide-react";
import type { LayerField, LayerInfo } from "@/lib/portal-layers";
import { cn } from "@/lib/utils";
import styles from "./waste-site-card.module.css";

type Site = { name: string; place: string; row: Record<string, unknown> };
const text = (value: unknown) => value == null ? "" : String(value).trim();
const isLocation = (f: LayerField) => /^(aimag|niislel|duureg|horoo|hayag)$/i.test(f.name) || /аймаг|нийслэл|сум|дүүрэг|хороо|хаяг/i.test(f.alias);
const isPhoto = (f: LayerField) => /photo|image|zurag|зураг/i.test(`${f.name} ${f.alias}`);

export function WasteSiteCard({ rec, info, selected, onPick }: {
  rec: Site;
  info: LayerInfo;
  selected: boolean;
  onPick: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const id = React.useId();
  const field = (key: string) => info.fields.find((f) => f.name.toLowerCase() === key);
  const total = field("niit_ga");
  const waste = field("hog_ga");
  const location = info.fields.filter((f) => isLocation(f) && text(rec.row[f.name]));
  const place = location.map((f) => text(rec.row[f.name])).join(", ") || rec.place;
  const consumed = new Set([total, waste, ...location].filter((f) => f != null).map((f) => f.name));
  const details = info.fields.filter((f) => !consumed.has(f.name) && !isPhoto(f));
  const area = (f: LayerField | undefined) => f ? text(rec.row[f.name]).replace(/\s*га$/i, "") : "";

  return (
    <article className={cn(styles.card, selected && styles.selected)}>
      <header className={styles.header}>
        <button type="button" className={styles.select} onClick={onPick} aria-pressed={selected} title="Газрын зураг дээр сонгох">
          <span className={styles.siteIcon} aria-hidden><Trash2 size={19} strokeWidth={1.7} /></span>
          <span className={styles.heading}><span className={styles.name}>{rec.name}</span><span className={styles.place}><MapPin size={10} aria-hidden />{place || "Байршил тодорхойгүй"}</span></span>
        </button>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={id} aria-label={`${rec.name} — ${open ? "хураах" : "дэлгэрүүлэх"}`} onClick={() => setOpen((v) => !v)}>
          <ChevronDown size={15} aria-hidden style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </button>
      </header>
      {open ? (
        <div id={id} className={styles.body}>
            <dl className={styles.metrics}>
              <div><LandPlot size={16} aria-hidden /><dt>Нийт талбай</dt><dd>{area(total) || "—"}{area(total) ? <span> га</span> : null}</dd></div>
              <div><Trash2 size={16} aria-hidden /><dt>Хог хүлээн авах, хаях талбай</dt><dd>{area(waste) || "—"}{area(waste) ? <span> га</span> : null}</dd></div>
            </dl>
            <dl className={styles.fields}>
              {details.map((f) => (
                <div key={f.name}>
                  <dt>{/аж ахуй|байгууллаг/i.test(f.alias) ? <Building2 size={12} aria-hidden /> : <LandPlot size={12} aria-hidden />}<span>{f.alias}</span></dt>
                  <dd>{text(rec.row[f.name]) || "—"}</dd>
                </div>
              ))}
            </dl>
        </div>
      ) : null}
    </article>
  );
}

