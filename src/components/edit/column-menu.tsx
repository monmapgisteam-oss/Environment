"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Loader2, Pin, PinOff, Trash2, TriangleAlert, X } from "lucide-react";
import { arcgisJson } from "@/lib/arcgis";
import { cn } from "@/lib/utils";
import { adminUrl } from "./add-field";

/*
  БҮРТГЭЛИЙН ХҮСНЭГТИЙН БАГАНЫН ЦЭС (хэрэглэгч 2026-11-09: "hide unhide freeze
  гэх мэт тохиргоог mouse 2 дарахад харагдана … талбар устгах эрх мөн хэрэглэгчид
  байна — alias нэрийг буруу өгөөд устгах асуудал гарч болох учраас … хуучин
  порталд байгаа талбарыг устгах гэж байвал сануулга өгнө").

  · Баганын толгой дээр БАРУУН ТОВШИЛТ → `ColumnMenu`: нуух · тогтоох (зүүн талд
    наалдана) · нуусан баганыг харуулах · талбар устгах.
  · `DeleteFieldDialog` — `deleteFromDefinition` (`/rest/admin/services/…`),
    `AddField`-тэй нэг админ зам, нэг эрх (давхаргын эзэн, админ).
    ⚠⚠ ХУУЧИН ТАЛБАР (энэ сессэд нэмээгүй) бол `--clay` сануулга: доторх бүх утга
    бүрмөсөн устана, сэргээх боломжгүй — баталгаажуулахдаа талбарын НЭРИЙГ бичнэ.
    Энэ сессэд "Мөр нэмэх"-ээр нэмсэн талбар (alias буруу бичсэн гэх мэт) энгийн
    баталгаажуулалтаар устна.
*/

export type ColumnMenuState = { x: number; y: number; name: string; label: string };

export function ColumnMenu({
  menu,
  hidden,
  frozen,
  hiddenCount,
  onHide,
  onFreeze,
  onShowAll,
  onDelete,
  onClose,
}: {
  menu: ColumnMenuState;
  hidden: boolean;
  frozen: boolean;
  hiddenCount: number;
  onHide: () => void;
  onFreeze: () => void;
  onShowAll: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  /* Дэлгэцээс халихгүй — баруун, доод ирмэгт хавчина */
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) el.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
    if (r.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
  });

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return createPortal(
    <div ref={box} className="pe-colmenu" role="menu" aria-label={menu.label} style={{ left: menu.x, top: menu.y }}>
      <div className="pe-colmenu-title">{menu.label}</div>
      {!hidden && (
        <button type="button" role="menuitem" onClick={act(onHide)}>
          <EyeOff size={13} /> Баганыг нуух
        </button>
      )}
      <button type="button" role="menuitem" onClick={act(onFreeze)}>
        {frozen ? <PinOff size={13} /> : <Pin size={13} />} {frozen ? "Тогтоолтыг болих" : "Баганыг тогтоох"}
      </button>
      {hiddenCount > 0 && (
        <button type="button" role="menuitem" onClick={act(onShowAll)}>
          <Eye size={13} /> Нуусан {hiddenCount} баганыг харуулах
        </button>
      )}
      <hr />
      <button type="button" role="menuitem" className="is-danger" onClick={act(onDelete)}>
        <Trash2 size={13} /> Талбар устгах…
      </button>
    </div>,
    document.body,
  );
}

export function DeleteFieldDialog({
  url,
  name,
  label,
  fresh,
  onDone,
  onClose,
}: {
  url: string;
  name: string;
  label: string;
  /** Энэ сессэд "Мөр нэмэх"-ээр нэмсэн — хуучин датагүй тул сануулгагүй */
  fresh: boolean;
  onDone: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ready = fresh || typed.trim().toLowerCase() === label.trim().toLowerCase();

  React.useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, busy]);

  async function remove() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const body = new URLSearchParams({ deleteFromDefinition: JSON.stringify({ fields: [{ name }] }), f: "json" });
      const res = await arcgisJson<{ success?: boolean; error?: { message?: string } }>(`${adminUrl(url)}/deleteFromDefinition`, "Талбар устгах", {
        method: "POST",
        body,
      });
      if (res.success === false) throw new Error(res.error?.message ?? "Устгагдсангүй");
      onDone();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(/403|permission|not authorized|эрх/i.test(m) ? "Давхаргын бүтцийг өөрчлөх эрх хүрэхгүй байна" : `Устгагдсангүй: ${m}`);
      setBusy(false);
    }
  }

  return createPortal(
    <div className="pe-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={cn("pe-addfield-card pe-dialog", !fresh && "is-danger")} role="alertdialog" aria-label="Талбар устгах">
        <header>
          <strong>Талбар устгах</strong>
          <button type="button" aria-label="Хаах" disabled={busy} onClick={onClose}>
            <X size={14} />
          </button>
        </header>
        <p className="pe-dialog-text">
          <strong>“{label}”</strong> <span className="num">({name})</span> талбарыг давхаргаас устгах гэж байна.
        </p>
        {/* Энэ сессэд нэмсэн талбарт нэмэлт тайлбар ГАРАХГҮЙ (хэрэглэгч 2026-11-09: "гэсэн үг хэрэггүй") */}
        {!fresh && (
          <>
            <p className="pe-dialog-warn">
              <TriangleAlert size={14} />
              <span>
                <strong>Порталын давхаргад урьдаас байсан талбар.</strong> Бүх бүртгэлийн энэ талбар дахь утга бүрмөсөн устана — сэргээх боломжгүй.
              </span>
            </p>
            <label className="pe-field">
              <span>Баталгаажуулахын тулд талбарын нэрийг бичнэ үү</span>
              <input value={typed} autoFocus placeholder={label} onChange={(e) => setTyped(e.target.value)} />
            </label>
          </>
        )}
        {error && <p className="pe-notice is-bad">{error}</p>}
        <footer>
          <button type="button" className="pe-ghost" disabled={busy} onClick={onClose}>
            Цуцлах
          </button>
          <button type="button" className="pe-danger" disabled={!ready || busy} onClick={remove}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Устгах
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
