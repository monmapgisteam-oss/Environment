"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line bg-paper-3 px-3 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip href="/" active={pathname === "/"}>
        <LayoutGrid size={13} strokeWidth={1.75} />
        Ерөнхий
      </Chip>
      {DEPARTMENTS.map((d) => (
        <Chip
          key={d.slug}
          href={`/departments/${d.slug}`}
          active={pathname === `/departments/${d.slug}`}
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
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-xs border px-2.5 py-1.5 text-[12px] whitespace-nowrap transition-colors",
        active
          ? "border-line-2 bg-paper-2 font-medium text-ink"
          : "border-line bg-transparent text-ink-2",
      )}
      style={active && tone ? { borderColor: `color-mix(in oklab, var(${tone}) 45%, transparent)` } : undefined}
    >
      {children}
    </Link>
  );
}
