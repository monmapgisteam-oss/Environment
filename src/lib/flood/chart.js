// Small time-series chart on a canvas: two y-axes with titles, current-time cursor, reference lines,
// and a hover read-out (move the mouse over the chart to see the values at that minute).
//
// opts: { xmax, series: [{ data: [[x, y]], color, fill?, axis: 'left'|'right', label, unit, digits }],
//         left: 'axis title', right: 'axis title', cursor: x, refs: [{ y, axis, label }], empty: 'text' }
export function drawChart(canvas, opts) {
  canvas._opts = opts;
  if (!canvas._wired) {
    canvas._wired = true;
    canvas.addEventListener('mousemove', e => { canvas._hover = e.offsetX; drawChart(canvas, canvas._opts); });
    canvas.addEventListener('mouseleave', () => { canvas._hover = null; drawChart(canvas, canvas._opts); });
  }
  const { xmax: xm, series, cursor = null, refs = [], empty = null } = opts;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const css = getComputedStyle(canvas);   // аппын үндсэн дээрх өнгөний хувьсагч (платформын --line-ээс өөр)
  const grid = css.getPropertyValue('--line').trim() || '#2a3542';
  const muted = css.getPropertyValue('--muted').trim() || '#8a97a6';
  const text = css.getPropertyValue('--text').trim() || '#dde';
  const card = css.getPropertyValue('--card').trim() || '#111';
  const font = s => `${s}px Inter, system-ui, sans-serif`;

  if (empty && !series.some(s => s.data.length > 1)) {
    g.fillStyle = muted; g.font = font(11.5); g.textAlign = 'center';
    g.strokeStyle = grid; g.setLineDash([4, 4]);
    g.strokeRect(0.5, 0.5, w - 1, h - 1); g.setLineDash([]);
    g.fillText(empty, w / 2, h / 2 + 4);
    return;
  }
  const hasR = series.some(s => s.axis === 'right');
  const L = 34, R = hasR ? 34 : 10, T = 18, B = 18;
  const pw = w - L - R, ph = h - T - B;
  const xmax = Math.max(xm, 1);
  const top = { left: 0, right: 0 };
  for (const s of series) {
    const a = s.axis || 'left';
    top[a] = Math.max(top[a], s.min || 0, s.max ?? Math.max(1e-6, ...s.data.map(d => d[1])));
  }
  for (const r of refs) top[r.axis || 'left'] = Math.max(top[r.axis || 'left'], r.y * 1.15);
  for (const a of ['left', 'right']) top[a] = niceCeil(top[a] || 1);
  const X = x => L + pw * x / xmax;
  const Y = (y, a) => T + ph * (1 - Math.min(y / top[a], 1));

  // grid, axes, titles
  g.font = font(10); g.strokeStyle = grid; g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = Math.round(T + ph * i / 4) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); }
  g.fillStyle = muted; g.textAlign = 'center';
  const xt = niceStep(xmax / 5);
  for (let x = 0; x <= xmax + 1e-9; x += xt) g.fillText(fmtX(x), X(x), h - 5);
  for (const a of ['left', 'right']) {
    const s0 = series.find(s => (s.axis || 'left') === a);
    if (!s0) continue;
    g.fillStyle = s0.color; g.textAlign = a === 'left' ? 'right' : 'left';
    for (let i = 0; i <= 4; i++) g.fillText(fmtY(top[a] * (4 - i) / 4), a === 'left' ? L - 4 : L + pw + 4, T + ph * i / 4 + 3);
    const title = opts[a];
    if (title) { g.font = font(10.5); g.textAlign = a === 'left' ? 'left' : 'right'; g.fillText(title, a === 'left' ? L : L + pw, 11); g.font = font(10); }
  }

  // reference lines
  for (const r of refs) {
    const a = r.axis || 'left', y = Math.round(Y(r.y, a)) + 0.5;
    g.strokeStyle = r.color || '#ff6b6b'; g.setLineDash([5, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.setLineDash([]);
    if (r.label) { g.fillStyle = r.color || '#ff6b6b'; g.textAlign = 'right'; g.fillText(r.label, L + pw - 2, y - 3); }
  }

  // series
  for (const s of series) {
    if (!s.data.length) continue;
    const a = s.axis || 'left';
    g.beginPath();
    s.data.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y, a)) : g.moveTo(X(x), Y(y, a))));
    if (s.fill) {
      g.lineTo(X(s.data[s.data.length - 1][0]), Y(0, a)); g.lineTo(X(s.data[0][0]), Y(0, a)); g.closePath();
      g.fillStyle = s.fill; g.globalAlpha = 0.28; g.fill(); g.globalAlpha = 1;
    } else {
      g.strokeStyle = s.color; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
    }
  }

  // current time
  if (cursor != null && cursor > 0) {
    g.strokeStyle = muted; g.setLineDash([2, 3]);
    g.beginPath(); g.moveTo(Math.round(X(cursor)) + 0.5, T); g.lineTo(Math.round(X(cursor)) + 0.5, T + ph); g.stroke();
    g.setLineDash([]);
  }

  // hover read-out
  const hx = canvas._hover;
  if (hx != null && hx >= L && hx <= L + pw) {
    const t = (hx - L) / pw * xmax;
    const rows = [];
    for (const s of series) {
      if (!s.label || !s.data.length) continue;
      let best = null;
      for (const d of s.data) if (!best || Math.abs(d[0] - t) < Math.abs(best[0] - t)) best = d;
      if (best && Math.abs(best[0] - t) <= Math.max(2, xmax / 60)) rows.push([s.color, `${s.label}: ${best[1].toFixed(s.digits ?? 2)} ${s.unit || ''}`, best, s.axis || 'left']);
    }
    g.strokeStyle = text; g.globalAlpha = 0.5;
    g.beginPath(); g.moveTo(hx + 0.5, T); g.lineTo(hx + 0.5, T + ph); g.stroke(); g.globalAlpha = 1;
    for (const [c, , d, a] of rows) { g.fillStyle = c; g.beginPath(); g.arc(X(d[0]), Y(d[1], a), 3.5, 0, 7); g.fill(); }
    const lines = [fmtClock(t), ...rows.map(r => r[1])];
    g.font = font(11);
    const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 16, bh = lines.length * 15 + 8;
    const bx = hx + bw + 12 > w ? hx - bw - 8 : hx + 8, by = T + 2;
    g.fillStyle = card; g.globalAlpha = 0.94; g.fillRect(bx, by, bw, bh); g.globalAlpha = 1;
    g.strokeStyle = grid; g.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    lines.forEach((l, i) => {
      g.fillStyle = i === 0 ? muted : rows[i - 1][0];
      g.textAlign = 'left';
      g.fillText(l, bx + 8, by + 15 + i * 15);
    });
  }
}

function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
function niceCeil(x) { const s = niceStep(x / 4); return Math.max(s * 4, Math.ceil(x / s) * s); }
function fmtY(v) { return v === 0 ? '0' : v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3); }
function fmtX(m) { return m >= 120 ? (m / 60).toFixed(m % 60 ? 1 : 0) + 'ц' : m.toFixed(0) + (m === 0 ? '' : 'м'); }
function fmtClock(m) { const h = Math.floor(m / 60), mm = Math.round(m % 60); return `${h}:${String(mm).padStart(2, '0')} (${Math.round(m)} мин)`; }
