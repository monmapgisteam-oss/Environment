"use client";

import * as React from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { arcgisJson } from "@/lib/arcgis";
import { cn } from "@/lib/utils";

/*
  МӨР НЭМЭХ — давхаргад ШИНЭ ТАЛБАР нэмэх (хэрэглэгч 2026-10-21: "mur nemeh gsn
  gorim … feature deer field nemeh uildel"). Хэрэглэгч НЭРИЙГ (alias) өгнө,
  систем түүнээс талбарын нэрийг (латин) өөрөө гаргана; дараа нь ТӨРӨЛ —
  Тоо · Бутархай тоо · Үсэг, үг — ба үсэгт ТЭМДЭГТИЙН ХЯЗГААР.

  ⚠ Хадгалах нь үйлчилгээний БҮТЦИЙГ өөрчилнө: hosted үйлчилгээний админ зам
  (`…/rest/admin/services/…/FeatureServer/N/addToDefinition`). Эрх нь порталынх
  (давхаргын эзэн, админ) — хүрэхгүй бол алдаа нь цонхонд.
  ⚠ Талбарыг устгах боломж энд ЗОРИУДААР байхгүй (өгөгдөл алдагдана).
*/

type Kind = "integer" | "double" | "string";
const KINDS: { id: Kind; label: string; esri: string }[] = [
  { id: "integer", label: "Тоо", esri: "esriFieldTypeInteger" },
  { id: "double", label: "Бутархай тоо", esri: "esriFieldTypeDouble" },
  { id: "string", label: "Үсэг, үг", esri: "esriFieldTypeString" },
];

const LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "ye", ё: "yo", ж: "j", з: "z", и: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", ө: "u", п: "p", р: "r", с: "s", т: "t", у: "u",
  ү: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "i", э: "e",
  ю: "yu", я: "ya",
};

/** Нэрээс талбарын нэр — латин, жижиг үсэг, `_`, 30 тэмдэгт, давхардалгүй */
export function fieldNameOf(alias: string, taken: Set<string>): string {
  const base =
    [...alias.trim().toLowerCase()]
      .map((ch) => LATIN[ch] ?? ch)
      .join("")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30)
      .replace(/_+$/, "") || "talbar";
  const head = /^[a-z]/.test(base) ? base : `f_${base}`.slice(0, 30);
  let name = head;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${head.slice(0, 27)}_${i}`;
  return name;
}

/**
 * Үйлчилгээний хаягаас админ зам — `/rest/services/` → `/rest/admin/services/`.
 * ⚠ Enterprise-ийн hosted үйлчилгээнд `…/Hosted/<нэр>/FeatureServer/N` хэвээр
 * (ArcGIS Online-ийн `<нэр>.FeatureServer` хэлбэр энд "Invalid URL" өгдөг —
 * 2026-10-21-нд токеноор шалгасан).
 */
function adminUrl(layerUrl: string): string {
  return layerUrl.replace("/rest/services/", "/rest/admin/services/");
}

export function AddField({
  url,
  fields,
  onDone,
}: {
  url: string;
  /** Давхаргын бүх талбарын нэр, alias — давхардлаас сэргийлнэ */
  fields: { name: string; alias: string }[];
  onDone: (alias: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  /* Хүснэгтийн карт `overflow: hidden` тул цонх нь ТОГТМОЛ байрлалаар товчны дээр */
  const [at, setAt] = React.useState<{ right: number; bottom: number } | null>(null);
  const [alias, setAlias] = React.useState("");
  const [kind, setKind] = React.useState<Kind | null>(null);
  const [length, setLength] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const taken = React.useMemo(() => new Set(fields.map((f) => f.name.toLowerCase())), [fields]);
  const name = alias.trim() ? fieldNameOf(alias, taken) : "";
  const dupAlias = fields.some((f) => f.alias.trim().toLowerCase() === alias.trim().toLowerCase() && alias.trim());
  const len = Number(length);
  const lenOk = kind !== "string" || (Number.isInteger(len) && len >= 1 && len <= 4000);
  const ready = Boolean(alias.trim()) && !dupAlias && kind != null && lenOk;

  const reset = () => {
    setAlias("");
    setKind(null);
    setLength("");
    setError(null);
  };

  async function save() {
    if (!ready || !kind) return;
    setBusy(true);
    setError(null);
    try {
      const field: Record<string, unknown> = {
        name,
        alias: alias.trim(),
        type: KINDS.find((k) => k.id === kind)!.esri,
        nullable: true,
        editable: true,
        defaultValue: null,
        domain: null,
      };
      if (kind === "string") field.length = len;
      const body = new URLSearchParams({ addToDefinition: JSON.stringify({ fields: [field] }), f: "json" });
      const res = await arcgisJson<{ success?: boolean; error?: { message?: string } }>(`${adminUrl(url)}/addToDefinition`, "Мөр нэмэх", {
        method: "POST",
        body,
      });
      if (res.success === false) throw new Error(res.error?.message ?? "Хадгалагдсангүй");
      setOpen(false);
      reset();
      onDone(field.alias as string);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(/403|permission|not authorized|эрх/i.test(m) ? "Давхаргын бүтцийг өөрчлөх эрх хүрэхгүй байна" : `Хадгалагдсангүй: ${m}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pe-addfield">
      <button
        type="button"
        className={cn("pe-addfield-btn", open && "is-on")}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt({ right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 8 });
          setOpen((o) => !o);
          setError(null);
        }}
      >
        <Plus size={13} /> Мөр нэмэх
      </button>
      {open && (
        <div className="pe-addfield-card" role="dialog" aria-label="Мөр нэмэх" style={at ?? undefined}>
          <header>
            <strong>Мөр нэмэх</strong>
            <button type="button" aria-label="Хаах" onClick={() => (setOpen(false), reset())}>
              <X size={14} />
            </button>
          </header>
          <label className="pe-field">
            <span>Нэр</span>
            <input value={alias} maxLength={255} autoFocus onChange={(e) => setAlias(e.target.value)} aria-invalid={dupAlias} />
            {dupAlias && <em className="pe-err">Ийм нэртэй мөр байна</em>}
          </label>
          {name && (
            <p className="pe-addfield-name">
              Системийн нэр <code>{name}</code>
            </p>
          )}
          <div className="pe-field">
            <span>Төрөл</span>
            <div className="pe-addfield-kinds" role="radiogroup">
              {KINDS.map((k) => (
                <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          {kind === "string" && (
            <label className="pe-field">
              <span>Тэмдэгтийн хязгаар</span>
              <input className="num" inputMode="numeric" value={length} placeholder="255" onChange={(e) => setLength(e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(length) && !lenOk} />
              {length && !lenOk && <em className="pe-err">1–4000 хооронд</em>}
            </label>
          )}
          {error && <p className="pe-notice is-bad">{error}</p>}
          <footer>
            <button type="button" className="pe-ghost" onClick={() => (setOpen(false), reset())}>
              Цуцлах
            </button>
            <button type="button" className="pe-primary" disabled={!ready || busy} onClick={save}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Хадгалах
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
