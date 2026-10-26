"use client";

import * as React from "react";
import { asset } from "@/lib/base-path";
import { useLang } from "@/lib/i18n";

const PREVIEW_WIDTH = 1280;

/** The real department page shares the user's session and access checks. */
export function DepartmentPreview({ slug, name }: { slug: string; name: string }) {
  const container = React.useRef<HTMLSpanElement>(null);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const lang = useLang();

  const syncTheme = React.useCallback(() => {
    const root = frame.current?.contentDocument?.documentElement;
    if (root) root.dataset.theme = document.documentElement.dataset.theme;
  }, []);

  React.useEffect(() => {
    const node = container.current;
    if (!node) return;

    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width) return;
      const scale = width / PREVIEW_WIDTH;
      node.style.setProperty("--preview-scale", String(scale));
      node.style.setProperty("--preview-height", `${Math.max(480, Math.round(height / scale))}px`);
    });
    resize.observe(node);

    const theme = new MutationObserver(syncTheme);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      resize.disconnect();
      theme.disconnect();
    };
  }, [syncTheme]);

  return (
    <span ref={container} className="entry-photo entry-dashboard-preview" aria-hidden inert>
      <iframe
        key={lang}
        ref={frame}
        src={asset(`/departments/${slug}/?preview=1`)}
        title={name}
        width={PREVIEW_WIDTH}
        height={720}
        loading="lazy"
        tabIndex={-1}
        onLoad={syncTheme}
      />
    </span>
  );
}
