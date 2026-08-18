"use client";

import type * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { cn, isActivePath } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line bg-paper-3 px-3 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip href="/" active={isActivePath(pathname, "/")}>
        <LayoutGrid size={13} strokeWidth={1.75} />
        Ерөнхий
      </Chip>
      {DEPARTMENTS.map((d) => (
        <Chip
          key={d.slug}
          href={`/departments/${d.slug}`}
          active={isActivePath(pathname, `/departments/${d.slug}`)}
          tone={d.tone}
        >
          <d.icon size={13} strokeWidth={1.75} style={{ color: `var(${d.tone})` }} />
          {d.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  href,
  active,
  tone,
  children,
}: {
  href: string;
  active: boolean;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-xs border px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors",
        /* Идэвхтэй чип нь хэлтсийнхээ өнгөөр бүдэг будагдана — зөвхөн
           хүрээгээр ялгах нь нарийн дэлгэц дээр мэдэгдэхгүй байв */
        active
          ? cn("border-line-2 font-medium text-ink", tone ? "tinted" : "bg-paper-2")
          : "border-line bg-transparent text-ink-2",
      )}
      style={
        active && tone
          ? ({
              "--tone": `var(${tone})`,
              borderColor: `color-mix(in oklab, var(${tone}) 55%, transparent)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </Link>
  );
}
