"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { translateText } from "@/lib/i18n-auto";

/*
  АНГЛИ ГОРИМД ДЭЛГЭЦИЙН БИЧВЭРИЙГ ОРЧУУЛНА (хэрэглэгч 2026-10-23: "Англи болоогүй
  хэсэг англи болгоорой"). Самбар бүрийн 2,400 гаруй монгол бичвэрийг 167 файлд
  нэг бүрчлэн солихын оронд DOM-ын текст зангилаа, шинжийг (`title`,
  `aria-label`, `placeholder`, `alt`) нэг толиор (`lib/i18n-dict.ts`) солино.

  ⚠ ЭХ БИЧВЭРИЙГ ХАДГАЛНА (`WeakMap`): монгол руу буцахад сэргээнэ. React шинэ
  бичвэр тавибал (`nodeValue` нь бидний бичсэнээс өөр) тэр нь шинэ эх болно.
  ⚠ Зөвхөн бичвэртэй эцэг элементийн хэд хэдэн хэсгийг (`{n} хоног`) НЭГТГЭЖ
  орчуулна — эс тэгвээс "12" ба " хоног үлдсэн" тусдаа гарна.
  ⚠ Өөрсдийн өөрчлөлтөөс үүссэн мутацийг `takeRecords()`-оор хаяна.
  ⚠ Гидраци дууссаны дараа (эффект) эхэлнэ — эрт өөрчилбөл React-ийн гидрацийн
  бичвэр зөрнө. Монгол горимд ажиглагч бүрэн унтарна.
  ⚠ `translate="no"` эсвэл `.notranslate` бүхий хэсгийг хөндөхгүй.
*/

type Rec = { orig: string; out: string };

const texts = new WeakMap<Text, Rec>();
const attrs = new WeakMap<Element, Map<string, Rec>>();
const ATTRS = ["title", "aria-label", "placeholder", "alt"];
const SKIP = "script,style,textarea,code,pre,[translate=no],.notranslate,[contenteditable=true]";

function skipped(el: Element | null) {
  return !el || !!el.closest(SKIP);
}

function setText(n: Text, v: string) {
  if (n.nodeValue !== v) n.nodeValue = v;
}

/** Зангилааны жинхэнэ эх бичвэр (бидний бичсэн бол хадгалсан эх) */
function origOf(n: Text) {
  const rec = texts.get(n);
  return rec && n.nodeValue === rec.out ? rec.orig : (n.nodeValue ?? "");
}

function single(n: Text) {
  const orig = origOf(n);
  const out = translateText(orig);
  if (out == null) {
    const rec = texts.get(n);
    if (rec) setText(n, rec.orig);
    texts.delete(n);
    return;
  }
  texts.set(n, { orig, out });
  setText(n, out);
}

/** Зөвхөн бичвэр (ба SSR-ийн `<!-- -->`) агуулсан эцэг үү */
function textGroup(p: Element): Text[] | null {
  const kids = p.childNodes;
  if (kids.length < 2) return null;
  const out: Text[] = [];
  for (const k of kids) {
    if (k.nodeType === Node.TEXT_NODE) out.push(k as Text);
    else if (k.nodeType !== Node.COMMENT_NODE) return null;
  }
  return out.length > 1 ? out : null;
}

function group(nodes: Text[]) {
  const origs = nodes.map(origOf);
  const out = translateText(origs.join(""));
  if (out == null) {
    nodes.forEach((n, i) => {
      const rec = texts.get(n);
      if (rec && rec.out !== rec.orig) setText(n, origs[i]);
      texts.delete(n);
      single(n);
    });
    return;
  }
  nodes.forEach((n, i) => {
    const v = i === 0 ? out : "";
    texts.set(n, { orig: origs[i], out: v });
    setText(n, v);
  });
}

function textNode(n: Text) {
  const p = n.parentElement;
  if (skipped(p)) return;
  const g = textGroup(p!);
  if (g) group(g);
  else single(n);
}

function attr(el: Element, name: string) {
  const cur = el.getAttribute(name);
  if (cur == null) return;
  let map = attrs.get(el);
  const rec = map?.get(name);
  const orig = rec && cur === rec.out ? rec.orig : cur;
  const out = translateText(orig);
  if (out == null) {
    map?.delete(name);
    return;
  }
  if (!map) attrs.set(el, (map = new Map()));
  map.set(name, { orig, out });
  if (cur !== out) el.setAttribute(name, out);
}

function element(el: Element) {
  if (skipped(el)) return;
  for (const a of ATTRS) if (el.hasAttribute(a)) attr(el, a);
}

/** Мод бүхэлд нь — бичвэр ба шинж */
function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return textNode(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (skipped(el)) return;
  element(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const found: Node[] = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) found.push(n);
  for (const n of found) {
    if (n.nodeType === Node.TEXT_NODE) textNode(n as Text);
    else element(n as Element);
  }
}

/** Монгол руу буцаах — бидний өөрчилсөн бүхнийг эх рүү нь */
function restore(root: Element) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const rec = texts.get(n as Text);
      if (rec && n.nodeValue === rec.out) (n as Text).nodeValue = rec.orig;
      texts.delete(n as Text);
    } else {
      const map = attrs.get(n as Element);
      if (!map) continue;
      for (const [name, rec] of map) if ((n as Element).getAttribute(name) === rec.out) (n as Element).setAttribute(name, rec.orig);
      attrs.delete(n as Element);
    }
  }
}

export function AutoTranslate() {
  const lang = useLang();

  useEffect(() => {
    if (lang !== "en") return;
    const root = document.documentElement;
    walk(root);
    const obs = new MutationObserver((records) => {
      const groups = new Set<Element>();
      for (const r of records) {
        if (r.type === "characterData") {
          const p = r.target.parentElement;
          if (p && textGroup(p)) groups.add(p);
          else textNode(r.target as Text);
        } else if (r.type === "attributes") {
          if (!skipped(r.target as Element)) attr(r.target as Element, r.attributeName!);
        } else {
          r.addedNodes.forEach(walk);
          const t = r.target as Element;
          if (t.nodeType === Node.ELEMENT_NODE && !skipped(t) && textGroup(t)) groups.add(t);
        }
      }
      for (const p of groups) {
        const g = textGroup(p);
        if (g && !skipped(p)) group(g);
      }
      obs.takeRecords(); // өөрсдийн өөрчлөлт
    });
    obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => {
      obs.disconnect();
      restore(root);
    };
  }, [lang]);

  return null;
}
