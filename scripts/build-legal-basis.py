"""Хяналт шалгалтын ҮНДЭСЛЭЛ ХУУЛЬ ТОГТООМЖ — хэлтсийн хоёр Excel-ийг
нэг JSON болгоно (src/lib/legal-basis.json).

Эх сурвалж (хэрэглэгч 2026-10-07-нд өгсөн, `D:/Environment/ХХ/legal`):

1. `Huuli togtoomj.xlsx` — ХЯНАЛТЫН АСУУЛГА. Дөрвөн хуудас (Хууль,
   Журам, Стандарт, Дүрэм), хуудас бүрийн дотор салбарын хуулиар
   бүлэглэсэн (Химийн хорт…, Хог хаягдлын…, Усны тухай хууль …).
   Мөр бүр: заалт (`Хууль тогтоомж`) → хяналтын асуулт (`Асуулт`).
   Заалт хоосон мөр нь өмнөх заалтын ҮРГЭЛЖЛЭЛ.

2. `oi an Huuli-togtoomj.xlsx` — ой, амьтан, ургамал. Бүтэц ӨӨР:
   `Хууль` хуудас нь Зөрчлийн тухай хуулийн зүйл (B багана, дэд хэсэг
   нь C–F) → түүнд холбогдох САЛБАРЫН хуулийн заалтууд (G багана).
   Үлдсэн дөрвөн хуудас нь журмын БҮТЭН бичвэр (мод бэлтгэх эрхийн
   бичиг, мод бэлтгэх заавар, ойн дагалт баялаг, арчилгаа цэвэрлэгээ).
   `Стандарт`, `Дүрэм` хуудас хоосон — алгасна.

⚠ Бичвэрийг ӨӨРЧЛӨХГҮЙ: зөвхөн илүүц зай, `\\xa0`-г цэвэрлэнэ. Хууль
  тогтоомжийн бичвэр тул товчилж, засаж БОЛОХГҮЙ.
⚠ Хууль тогтоомж нийтийн мэдээлэл тул репод хадгалагдана.

Эх сурвалж байхгүй машин дээр ЧИМЭЭГҮЙ гарна (бүтээлт унахгүй).
Ажиллуулах: `python scripts/build-legal-basis.py`
"""
import json
import os
import re
import sys
from pathlib import Path

SRC = Path(os.environ.get("LEGAL_SRC", "D:/Environment/ХХ/legal"))
CHECKLIST = SRC / "Huuli togtoomj.xlsx"
FOREST = SRC / "oi an Huuli-togtoomj.xlsx"
OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "legal-basis.json"

KINDS = ["Хууль", "Журам", "Стандарт", "Дүрэм"]

if not CHECKLIST.exists() or not FOREST.exists():
    print(f"эх сурвалж алга ({SRC}) — алгаслаа")
    sys.exit(0)

import openpyxl  # noqa: E402 — эх сурвалжгүй машинд суулгах шаардлагагүй

sys.stdout.reconfigure(encoding="utf-8")


def clean(v) -> str:
    if v is None:
        return ""
    s = str(v).replace("\xa0", " ").replace("\r", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", s).strip()


def law_name(s: str) -> str:
    """Салбарын хуулийн нэр — төгсгөлийн зай, цэгийг л цэвэрлэнэ."""
    return clean(s).rstrip(". ")


topics: dict[str, dict] = {}


def topic(name: str) -> dict:
    t = topics.get(name)
    if t is None:
        t = {"name": name, "sections": [], "violations": None, "documents": []}
        topics[name] = t
    return t


def section(t: dict, kind: str) -> dict:
    for s in t["sections"]:
        if s["kind"] == kind:
            return s
    s = {"kind": kind, "items": []}
    t["sections"].append(s)
    return s


# --------------------------------------------------------------------------
# 1. Хяналтын асуулга
# --------------------------------------------------------------------------
wb = openpyxl.load_workbook(CHECKLIST, data_only=True)
for ws in wb:
    kind = clean(ws.title)
    if kind not in KINDS:
        continue
    cur_topic = None
    cur_item = None
    for row in ws.iter_rows(values_only=True):
        a, b, c = (clean(x) for x in (list(row) + [None] * 3)[:3])
        if not (a or b or c):
            continue
        if a == "№":
            continue
        # Салбарын хуулийн гарчиг — зөвхөн эхний нүд, тоо биш
        if a and not b and not c and not a.isdigit():
            cur_topic = section(topic(law_name(a)), kind)
            cur_item = None
            continue
        if cur_topic is None:
            continue
        if b:
            cur_item = {"ref": b, "lines": [c] if c else []}
            cur_topic["items"].append(cur_item)
        elif c:
            if cur_item is None:
                cur_item = {"ref": "", "lines": []}
                cur_topic["items"].append(cur_item)
            cur_item["lines"].append(c)

# --------------------------------------------------------------------------
# 2. Ой, амьтан, ургамал
# --------------------------------------------------------------------------
wb = openpyxl.load_workbook(FOREST, data_only=True)

ws = wb["Хууль"]
cur = None  # {"article", "items"}
item = None
for row in ws.iter_rows(values_only=True):
    cells = [clean(x) for x in (list(row) + [None] * 10)[:10]]
    if not any(cells):
        continue
    head, subs, links = cells[1], [x for x in cells[2:6] if x], [x for x in cells[6:10] if x]
    if head.startswith("Зөрчлийн тухай хуул"):
        # Зүйлийн гарчиг ба салбарын хуулийн нэр НЭГ мөрөнд
        name = law_name(links[0]) if links else ""
        t = topic(name)
        cur = {"article": head, "items": []}
        t["violations"] = cur
        item = None
        continue
    if cur is None:
        continue
    if head:
        item = {"head": head, "sub": [], "links": []}
        cur["items"].append(item)
    if item is None:
        continue
    item["sub"].extend(subs)
    item["links"].extend(links)

# Журмын бүтэн бичвэр — Ойн тухай хуульд хамаарна
for ws in wb.worksheets:
    if ws.title in ("Хууль", "Стандарт", "Дүрэм"):
        continue
    lines = []
    for row in ws.iter_rows(values_only=True):
        parts = [clean(x) for x in row]
        parts = [p for p in parts if p and p != "№" and not p.isdigit()]
        if parts:
            lines.append(" · ".join(parts))
    if not lines:
        continue
    topic("Ойн тухай хууль")["documents"].append({"title": lines[0], "lines": lines[1:]})

# --------------------------------------------------------------------------
data = {"topics": list(topics.values())}
OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

for t in data["topics"]:
    secs = ", ".join(f"{s['kind']} {len(s['items'])}" for s in t["sections"])
    v = len(t["violations"]["items"]) if t["violations"] else 0
    print(f"{t['name']}: {secs or '—'} · зөрчил {v} · журам {len(t['documents'])}")
print(f"→ {OUT.relative_to(OUT.parent.parent.parent)} ({OUT.stat().st_size:,} байт)")
