"use client";

import * as React from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { asset } from "@/lib/base-path";
import styles from "./sign-in.module.css";

// Keep the entrance intentionally spare: logo, sign-in, system name, owner.
// The artwork is composed on the right; the title occupies its quiet left side.
/* ⚠ WebP, PNG БИШ. Эх нь 1.64MB PNG байсныг 142KB болгосон (12 дахин) —
   энэ бол хэрэглэгч бүрийн нээх ЭХНИЙ дэлгэц тул жин нь шууд мэдрэгдэнэ.
   Хажуугийн `envi-6-extension` мөн WebP. */
const BACKGROUND = asset("/auth/envi-6.webp");

export function SignIn({
  onEnter,
  configured,
}: {
  onEnter: () => void;
  configured: boolean;
}) {
  const [busy, setBusy] = React.useState(false);

  const enter = () => {
    if (busy) return;
    setBusy(true);
    onEnter();
  };

  return (
    <div className={styles.screen}>
      <div aria-hidden="true" className={styles.extension} style={{ backgroundImage: `url("${asset("/auth/envi-6-extension.webp")}")` }} />
      {/* Keep the supplied artwork intact; scale-down never crops or enlarges it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BACKGROUND} alt="" aria-hidden="true" width={1832} height={859} fetchPriority="high" className={styles.artwork} />
      <div aria-hidden="true" className={styles.scrim} />

      <header className={styles.header}>
        <div className={styles.logo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/logo.svg")} alt="Нийслэлийн сүлд" width={48} height={48} />
        </div>
        {configured && (
          <button type="button" onClick={enter} disabled={busy} aria-busy={busy} className={styles.enter}>
            <span role="status">{busy ? "Шилжиж байна…" : "Нэвтрэх"}</span>
            <span className={styles.buttonIcon} aria-hidden="true">
              {busy ? <LoaderCircle size={18} className={styles.spinner} /> : <ArrowRight size={18} />}
            </span>
          </button>
        )}
      </header>

      <main className={styles.main}>
        <div className={styles.titleBlock}>
          <div className={styles.accent} aria-hidden="true"><span /><span /><span /></div>
          <h1 className={`brandmark ${styles.title}`}>Байгаль орчны</h1>
          <p className={styles.subtitle}>Хяналтын нэгдсэн систем</p>
          {!configured && (
            <p className={styles.notice}>
              Нэвтрэлтийн тохиргоо дуусаагүй байна. Системийн админтай холбогдоно уу.
            </p>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <p>Нийслэлийн Байгаль орчны газар</p>
      </footer>
    </div>
  );
}
