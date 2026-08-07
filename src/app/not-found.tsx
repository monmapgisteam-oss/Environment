import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="num text-[12px] tracking-[0.2em] text-ink-3">404</span>
      <h1 className="display text-[25px]">Хуудас олдсонгүй</h1>
      <p className="max-w-[46ch] text-[14px] text-ink-2">
        Хайсан хуудас байхгүй эсвэл шилжсэн байна.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xs border border-line-2 px-3 py-1.5 text-[13.5px] transition-colors hover:bg-paper-2"
      >
        Ерөнхий самбар руу буцах
      </Link>
    </div>
  );
}
