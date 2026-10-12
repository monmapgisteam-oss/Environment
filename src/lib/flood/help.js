// Диаграмын гарчиг л үлдсэн.
//
// ⚠⚠ ТАЙЛБАР ОГТ БАЙХГҮЙ (хэрэглэгч 2026-10-12: "bii iimerhu bichiglel
// tailbariig ustga gj hed helhiin be"). Урьд нь энд удирдлага, үр дүнгийн нүд
// бүрийн "i" тэмдэг ба хулгана аваачихад гарах тайлбарын хайрцаг (`TIPS`,
// `tipbox`) байв. Эхлээд зөвхөн "i" тэмдгийг хасаж, шошгогүй элементийн
// хөвөгч тайлбарыг үлдээсэн нь БУРУУ байсан. Дахин бүү нэм.

const CHART_TITLES = {
  chartDomain: 'Хур тунадас ба үерийн тархалтын явц',
  chartProbe: 'Сонгосон цэгийн усны гүн, урсгалын хурд',
};

export function installHelp(root) {
  const added = [];          // цэвэрлэгээнд устгах элементүүд (StrictMode-д давхардахгүй)
  for (const [id, title] of Object.entries(CHART_TITLES)) {
    const c = root.querySelector('#' + id);
    if (!c) continue;
    const h = document.createElement('div');
    h.className = 'chart-head';
    added.push(h);
    h.innerHTML = `<b>${title}</b>`;
    c.before(h);
  }
  return () => { added.forEach(n => n.remove()); };
}
