// Per-building flood impact: maximum water depth reached against each of the ~321k buildings
// (ArcGIS "Analyze flood impact" approach). Runs on the GPU: one fragment per building scans the cells
// around its footprint box in the max-depth envelope; only ~1.3 MB of results come back to the CPU.
import { program, texture } from './solver.js';

export const CLASSES = [
  { min: 0.1, max: 0.3, color: '#f2d27a', name: '0.1–0.3 м', note: 'Хашаа, зам норох' },
  { min: 0.3, max: 0.5, color: '#ee9b53', name: '0.3–0.5 м', note: 'Орцоор ус орох' },
  { min: 0.5, max: 1.0, color: '#d9534a', name: '0.5–1 м', note: '1-р давхар усанд' },
  { min: 1.0, max: 1e9, color: '#8c2f5f', name: '1 м-ээс их', note: 'Ноцтой хохирол' },
];

const TW = 1024;   // result texture width (buildings per row)

const FS_IMPACT = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp usampler2D;
uniform sampler2D uBox;    // footprint box, metres from grid origin: x0, y0, x1, y1 (y south)
uniform sampler2D uM;      // max envelope, .x = max depth
uniform sampler2D uP;      // .a = building fraction (>= 0.5: cell is a solid building)
uniform usampler2D uRiv;   // channel burn depth, dm, on the fine grid
uniform ivec2 uSize, uFine;
uniform ivec2 uOffC;       // simulation-area origin, fine cells
uniform vec2 uOffM;        // ... and in metres from the data-grid origin
uniform int uF;
uniform float uCell;
uniform int uN;
out vec4 o;
// depth of the channel carved into this solver cell (same rule as the solver's init pass)
float burn(ivec2 q){
  float b = 0.0;
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    if (i >= uF || j >= uF) continue;
    ivec2 p = min(uOffC + q * uF + ivec2(i, j), uFine - 1);
    b = max(b, float(texelFetch(uRiv, p, 0).r) * 0.1);
  }
  return b;
}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (p.y * ${TW} + p.x >= uN) { o = vec4(0.0); return; }
  vec4 b = (texelFetch(uBox, p, 0) - uOffM.xyxy) / uCell;
  if (b.z < 0.0 || b.w < 0.0 || b.x >= float(uSize.x) || b.y >= float(uSize.y)) { o = vec4(0.0); return; }   // outside the area
  // cells touching the footprint (box grown by half a cell), clamped to a 12x12 sample budget
  ivec2 a = clamp(ivec2(floor(b.xy - 0.5)), ivec2(0), uSize - 1);
  ivec2 c = clamp(ivec2(floor(b.zw + 0.5)), ivec2(0), uSize - 1);
  ivec2 st = max((c - a + 1 + 11) / 12, ivec2(1));
  float d = 0.0;
  for (int j = 0; j < 12; j++) for (int i = 0; i < 12; i++) {
    ivec2 q = a + ivec2(i, j) * st;
    if (q.x > c.x || q.y > c.y) continue;
    // solid-building cells hold roof run-off, not flood water; in a carved channel only the water
    // above the natural ground counts (a full ditch next to a wall is not 2.5 m of flooding)
    if (texelFetch(uP, q, 0).a < 0.8) d = max(d, texelFetch(uM, q, 0).x - burn(q));
  }
  o = vec4(d, 0.0, 0.0, 1.0);
}`;

export class ImpactAnalyzer {
  async load() {
    const buf = await (await fetch('data/bldpts.bin')).arrayBuffer();
    const n = buf.byteLength / 20, v = new DataView(buf);
    this.n = n;
    this.oid = new Int32Array(n);
    this.box = new Float32Array(Math.ceil(n / TW) * TW * 4);   // padded to whole texture rows
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * 20;
      this.oid[i] = v.getInt32(o, true);
      for (let k = 0; k < 4; k++) this.box[i * 4 + k] = v.getFloat32(o + 4 + k * 4, true);
      const cx = (this.box[i * 4] + this.box[i * 4 + 2]) / 2, cy = (this.box[i * 4 + 1] + this.box[i * 4 + 3]) / 2;
      this.px[i] = cx; this.py[i] = cy;
      // a few footprints are mis-digitised (km-long): cap the search box at 400 m
      for (const [k, c] of [[0, cx], [1, cy], [2, cx], [3, cy]]) this.box[i * 4 + k] = c + Math.max(-200, Math.min(200, this.box[i * 4 + k] - c));
    }
    this.depth = new Float32Array(n);
    this.result = null;
    return this;
  }

  _gpu(gl) {
    if (this.g && this.g.gl === gl) return this.g;
    const rows = Math.ceil(this.n / TW);
    const boxT = texture(gl, TW, rows, 'RGBA32F', this.box);
    const outT = texture(gl, TW, rows, 'R32F');
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outT.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.g = { gl, rows, boxT, outT, fb, prog: program(gl, FS_IMPACT), vao: gl.createVertexArray(), buf: new Float32Array(TW * rows * 4) };
    return this.g;
  }

  /** Classify every building from the solver's max-depth envelope. */
  compute(solver) {
    this._pass(solver);
    const gl = solver.gl, g = this.g;
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, TW, g.rows, gl.RGBA, gl.FLOAT, g.buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (this.pend) { gl.deleteSync(this.pend.sync); this.pend = null; }
    return this._classify(solver.t);
  }

  /** Non-blocking: run the pass now, read the result through a pixel-pack buffer once the GPU is done
   *  (a synchronous read waits for everything queued, including the map's 3D frame: hundreds of ms). */
  start(solver) {
    if (this.pend) return;
    this._pass(solver);
    const gl = solver.gl, g = this.g;
    if (!g.pbo) { g.pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, g.pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, g.buf.byteLength, gl.STREAM_READ); }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, g.pbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, TW, g.rows, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.pend = { sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), t: solver.t, gl };
    gl.flush();
  }

  /** Result of a finished start(), or null while the GPU is still busy. */
  poll() {
    const p = this.pend;
    if (!p) return null;
    const gl = p.gl;
    if (gl.getSyncParameter(p.sync, gl.SYNC_STATUS) !== gl.SIGNALED) return null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.g.pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.g.buf);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteSync(p.sync);
    this.pend = null;
    return this._classify(p.t);
  }

  cancel() { if (this.pend) { this.pend.gl.deleteSync(this.pend.sync); this.pend = null; } }

  _pass(solver) {
    const gl = solver.gl, g = this._gpu(gl), pr = g.prog;
    gl.bindVertexArray(g.vao);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(pr.p);
    const texs = [['uBox', g.boxT], ['uM', solver.Mcur], ['uP', solver.P], ['uRiv', solver.src.riv]];
    texs.forEach(([name, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(pr.u[name], i); });
    gl.uniform2i(pr.u.uSize, solver.W, solver.H);
    gl.uniform2i(pr.u.uFine, solver.meta.W, solver.meta.H);
    gl.uniform1i(pr.u.uF, solver.F);
    gl.uniform2i(pr.u.uOffC, solver.off[0], solver.off[1]);
    gl.uniform2f(pr.u.uOffM, solver.off[0] * solver.meta.res, solver.off[1] * solver.meta.res);
    gl.uniform1f(pr.u.uCell, solver.cellMerc);
    gl.uniform1i(pr.u.uN, this.n);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, TW, g.rows);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  _classify(t) {
    const g = this.g;
    const counts = CLASSES.map(() => 0);
    let worst = 0;
    for (let i = 0; i < this.n; i++) {
      const d = g.buf[i * 4];
      this.depth[i] = d;
      if (d > worst) worst = d;
      for (let k = CLASSES.length - 1; k >= 0; k--) if (d >= CLASSES[k].min) { counts[k]++; break; }
    }
    this.result = { counts, total: counts.reduce((a, b) => a + b, 0), worst, t };
    return this.result;
  }

  /** Affected buildings [{oid, depth}] inside box = [x0, y0, x1, y1] (metres from the grid origin, optional).
   *  Over the limit, the ones nearest to `center` ([x, y], same frame) are kept — else the deepest. */
  affected(limit = 6000, box = null, center = null) {
    const idx = [];
    for (let i = 0; i < this.n; i++) {
      if (this.depth[i] < CLASSES[0].min) continue;
      if (box && (this.px[i] < box[0] || this.px[i] > box[2] || this.py[i] < box[1] || this.py[i] > box[3])) continue;
      idx.push(i);
    }
    if (center && idx.length > limit) {
      const d2 = i => (this.px[i] - center[0]) ** 2 + (this.py[i] - center[1]) ** 2;
      idx.sort((a, b) => d2(a) - d2(b));
    } else idx.sort((a, b) => this.depth[b] - this.depth[a]);
    return idx.slice(0, limit).map(i => ({ oid: this.oid[i], depth: this.depth[i] }));
  }
}

export function riskLevel(res) {
  if (!res) return { level: 0, name: 'Тооцоогүй', text: 'Симуляци эхлэхэд барилгын нөлөөллийг тооцно.' };
  const [c1, c2, c3, c4] = res.counts;
  if (c4 >= 50) return { level: 4, name: 'Онц өндөр', text: `${c4.toLocaleString()} барилгын дэргэд 1 м-ээс гүн ус — ноцтой хохирол, яаралтай нүүлгэн шилжүүлэлт шаардлагатай.` };
  if (c3 + c4 >= 50) return { level: 3, name: 'Өндөр', text: `${(c3 + c4).toLocaleString()} барилгын 1-р давхарт ус орох эрсдэлтэй (0.5 м+).` };
  if (c2 + c3 + c4 >= 50 || c3 + c4 > 0) return { level: 2, name: 'Дунд', text: `${(c2 + c3 + c4).toLocaleString()} барилгын орцоор ус орох эрсдэлтэй (0.3 м+).` };
  return { level: 1, name: 'Бага', text: c1 ? `${c1.toLocaleString()} барилгын орчимд гүехэн ус (0.3 м хүртэл).` : 'Барилгад нөлөөлөх үер илрээгүй.' };
}
