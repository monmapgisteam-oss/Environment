// GPU 2D shallow-water solver (local-inertial form, Bates et al. 2010; de Almeida et al. 2012)
// running in WebGL2 fragment shaders. Grid is north-up: texel (x, y) = (column, row), row 0 = north.
//
//   flux pass : Q(east face, south face) from water-surface slope + Manning friction
//   depth pass: H += dt/dx * (flux divergence) + rain - infiltration + point inflows   (+ max envelope)
//
// Everything lives on the GPU; the CPU only picks dt and reads a few reduced numbers per frame.

export const G = 9.81;

// ESA WorldCover class -> Manning n, Horton f0 / fc (mm/h). index = class / 10
export const LANDCOVER = [
  { code: 0, name: 'Тодорхойгүй', n: 0.035, f0: 30, fc: 6 },
  { code: 10, name: 'Ой мод', n: 0.10, f0: 60, fc: 15 },
  { code: 20, name: 'Бут сөөг', n: 0.07, f0: 50, fc: 12 },
  { code: 30, name: 'Бэлчээр, зүлэг', n: 0.035, f0: 40, fc: 8 },
  { code: 40, name: 'Тариалан', n: 0.035, f0: 40, fc: 8 },
  { code: 50, name: 'Барилгажсан', n: 0.02, f0: 4, fc: 1 },
  { code: 60, name: 'Ил хөрс', n: 0.025, f0: 25, fc: 4 },
  { code: 70, name: 'Цас, мөс', n: 0.02, f0: 0, fc: 0 },
  { code: 80, name: 'Усан гадарга', n: 0.03, f0: 0, fc: 0 },
  { code: 90, name: 'Намаг', n: 0.06, f0: 5, fc: 1 },
  { code: 100, name: 'Хаг, хөвд', n: 0.04, f0: 30, fc: 6 },
];

const VS_FULL = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp usampler2D;
const float G = 9.81;
// Buildings: a cell whose footprint share is >= SOLID is a wall (raised by the building height); below that the
// cell is porous (Sanders et al. 2008 style): water occupies only the open share PHI of the cell and crosses a
// face only through its open width, so flow is squeezed between and diverted around buildings even where they
// are smaller than a cell.
const float SOLID = 0.8;
float phiOf(float frac){ return frac >= SOLID ? 1.0 : max(1.0 - frac, 0.2); }
// Cell velocity from the averaged face fluxes. The faces already obey Froude <= 1, but dividing a face flux
// by a thinner cell depth (wetting fronts, steps in the terrain) gave spurious 10+ m/s spikes: cap at sqrt(g h).
vec2 cellVel(vec2 qsum, float h){
  vec2 v = qsum * 0.5 / max(h, 0.1);
  float vm = sqrt(G * max(h, 0.05)), l = length(v);
  return l > vm ? v * (vm / l) : v;
}
`;

// ---- init: fine rasters -> solver grid (coarsened by F)
const FS_INIT = HEAD + `
uniform usampler2D uLC, uBld, uRiv;
uniform sampler2D uDem;
uniform int uF;
uniform ivec2 uFine;
uniform ivec2 uOff;            // window origin on the fine grid (simulation area)
uniform float uDemF;
uniform vec3 uLc[11];          // n, f0, fc
uniform float uBldOn;          // 1 = buildings are obstacles
layout(location=0) out float oZ;
layout(location=1) out vec4 oP; // n, f0 mm/h, fc mm/h, building fraction (>= SOLID: wall, else porous)
layout(location=2) out vec4 oG;  // ground with channels burned (display), urban fraction, natural ground (3D terrain), -
layout(location=3) out vec2 oW;  // open width of the east / south face (0 = wall), from the fine building raster
bool bldAt(ivec2 p){ return uBldOn > 0.5 && p.x >= 0 && p.y >= 0 && p.x < uFine.x && p.y < uFine.y && texelFetch(uBld, p, 0).r > 0u; }
float dem(ivec2 p){ ivec2 s = textureSize(uDem, 0); return texelFetch(uDem, clamp(p, ivec2(0), s - 1), 0).r; }
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  float cnt = 0.0, ns = 0.0, a0 = 0.0, ac = 0.0, nb = 0.0, hb = 0.0, burn = 0.0, nu = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    if (i >= uF || j >= uF) continue;
    ivec2 p = uOff + c * uF + ivec2(i, j);
    if (p.x >= uFine.x || p.y >= uFine.y) continue;
    uint lcv = texelFetch(uLC, p, 0).r;
    int k = min(int(lcv) / 10, 10);
    vec3 prm = uLc[k];
    uint b = texelFetch(uBld, p, 0).r;
    burn = max(burn, float(texelFetch(uRiv, p, 0).r) * 0.1);
    cnt += 1.0; ns += prm.x; a0 += prm.y; ac += prm.z;
    if (b > 0u) { nb += 1.0; hb += float(b); }
    if (b > 0u || lcv == 50u) nu += 1.0;       // served by street drainage (built-up)
  }
  cnt = max(cnt, 1.0);
  // A face is open along a fine row/column only where the fine cells on both sides are free: buildings
  // standing on the boundary between two cells block it, even when they cover little of either cell.
  float oe = 0.0, os = 0.0;
  for (int k = 0; k < 4; k++) {
    if (k >= uF) continue;
    ivec2 e0 = uOff + c * uF + ivec2(uF - 1, k), s0 = uOff + c * uF + ivec2(k, uF - 1);
    if (!bldAt(e0) && !bldAt(e0 + ivec2(1, 0))) oe += 1.0;
    if (!bldAt(s0) && !bldAt(s0 + ivec2(0, 1))) os += 1.0;
  }
  oW = vec2(oe, os) / float(uF);       // 0 = the face is a wall along its whole length
  // bilinear ground elevation at cell centre (DEM cell centres sit at (i+0.5)*demF fine cells)
  vec2 d = (vec2(uOff) + (vec2(c) + 0.5) * float(uF)) / uDemF - 0.5;
  ivec2 i0 = ivec2(floor(d)); vec2 t = d - vec2(i0);
  float z = mix(mix(dem(i0), dem(i0 + ivec2(1, 0)), t.x), mix(dem(i0 + ivec2(0, 1)), dem(i0 + ivec2(1, 1)), t.x), t.y);
  float frac = nb / cnt * uBldOn;
  float n = ns / cnt, f0 = a0 / cnt, fc = ac / cnt;
  float zNat = z;
  if (burn > 0.0) { z -= burn; n = 0.035; }
  oG = vec4(z, nu / cnt, zNat, 0.0);
  if (frac >= SOLID) { z += hb / max(nb, 1.0); f0 = 0.0; fc = 0.0; }
  else n += 0.10 * frac;               // porous cell: extra drag; infiltration applies to the open ground only
  oZ = z;
  oP = vec4(n, f0, fc, frac);
}`;

// ---- flux: q on the east face (x) and south face (y) of each cell, per unit width (m^2/s)
const FS_FLUX = HEAD + `
uniform sampler2D uH, uQ, uZ, uP, uWf;
uniform float uDt, uDx, uManMul, uTheta;
uniform ivec2 uSize;
uniform vec2 uWallE;           // rows of the east edge where a river enters (inflow boundary: no outflow)
out vec2 oQ;
// Domain edge = normal-depth outflow (as HEC-RAS): q = h^(5/3) sqrt(S) / n with S the ground slope towards the
// edge measured over ~200 m inside the domain (robust to DEM noise). Where the ground rises towards the edge
// (e.g. a river entering from outside) S = 0 and the edge is a wall, so water can't run back upstream and out.
const int EDGE_K = 10;
float edgeOut(float h, float zEdge, float zInner, float n){
  float S = max(zInner - zEdge, 0.0) / (float(EDGE_K) * uDx);
  if (h <= 1e-4 || S <= 0.0) return 0.0;
  float q = pow(h, 5.0 / 3.0) * sqrt(S) / max(n, 0.01);
  return min(min(q, h * sqrt(G * h)), h * uDx / (4.0 * uDt));
}

// w = open width of the face, pA / pB = open share of the two cells
float face(float q, float qa, float qb, float hA, float hB, float zA, float zB, float nA, float nB, float w, float pA, float pB){
  float etaA = zA + hA, etaB = zB + hB;
  float hf = max(etaA, etaB) - max(zA, zB);
  if (hf <= 1e-3 || w < 1e-3) return 0.0;                   // dry, or a building wall: nothing crosses
  float qs = uTheta * q + 0.5 * (1.0 - uTheta) * (qa + qb);   // de Almeida theta-weighting (damps checkerboarding)
  float n = 0.5 * (nA + nB) * uManMul;
  float s = (etaB - etaA) / uDx;
  float qn = (qs - G * hf * uDt * s) / (1.0 + G * uDt * n * n * abs(q) / pow(hf, 7.0 / 3.0));
  float lim = hf * sqrt(G * hf);                             // Froude <= 1 (steep mountain slopes)
  qn = clamp(qn, -lim, lim);
  // positivity: a face may move <= 1/4 of the water held in the open part of the upwind cell
  qn = min(qn,  hA * uDx * pA / (4.0 * uDt * w));
  qn = max(qn, -hB * uDx * pB / (4.0 * uDt * w));
  return qn;
}
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  float h = texelFetch(uH, c, 0).r, z = texelFetch(uZ, c, 0).r, n = texelFetch(uP, c, 0).r;
  vec2 q = texelFetch(uQ, c, 0).xy;
  vec2 wf = texelFetch(uWf, c, 0).xy;
  float pc = phiOf(texelFetch(uP, c, 0).a);
  vec2 o;
  if (c.x < uSize.x - 1) {
    ivec2 e = c + ivec2(1, 0);
    // de Almeida theta-weighting averages this face with its two neighbouring faces (c-1|c and c+1|c+2)
    float qa = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
    float qb = texelFetch(uQ, e, 0).x;                       // next face downstream (between c+1 and c+2)
    vec4 pe = texelFetch(uP, e, 0);
    o.x = face(q.x, qa, qb, h, texelFetch(uH, e, 0).r, z, texelFetch(uZ, e, 0).r, n, pe.r, min(wf.x, pc), pc, phiOf(pe.a));
  } else o.x = (float(c.y) >= uWallE.x && float(c.y) <= uWallE.y) ? 0.0
             : edgeOut(h, z, texelFetch(uZ, c - ivec2(min(EDGE_K, uSize.x - 1), 0), 0).r, n * uManMul);
  if (c.y < uSize.y - 1) {
    ivec2 s = c + ivec2(0, 1);
    float qa = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
    float qb = texelFetch(uQ, s, 0).y;
    vec4 ps = texelFetch(uP, s, 0);
    o.y = face(q.y, qa, qb, h, texelFetch(uH, s, 0).r, z, texelFetch(uZ, s, 0).r, n, ps.r, min(wf.y, pc), pc, phiOf(ps.a));
  } else o.y = edgeOut(h, z, texelFetch(uZ, c - ivec2(0, min(EDGE_K, uSize.y - 1)), 0).r, n * uManMul);
  oQ = o;
}`;

// ---- depth: continuity + sources/sinks + max envelope
const FS_DEPTH = HEAD + `
uniform sampler2D uH, uQ, uP, uM, uZ, uWf;
uniform float uDt, uDx, uRain, uT, uInfMul, uHortonK, uTr, uDrain, uManMul;   // uDrain: storm-drain capacity, m/s
uniform sampler2D uGr;
uniform vec4 uRainCircle;      // cx, cy, r (cells), enabled
uniform vec4 uInflow[8];       // centre cell x, y (any point inside it), Q m^3/s, half-width (cells)
uniform int uNInflow;
uniform ivec2 uSize;
layout(location=0) out float oH;
layout(location=1) out vec4 oM;  // max depth, max speed, arrival time (min, -1 = dry), max hazard
// Domain edge = normal-depth outflow (as HEC-RAS): q = h^(5/3) sqrt(S) / n with S the ground slope towards the
// edge measured over ~200 m inside the domain (robust to DEM noise). Where the ground rises towards the edge
// (e.g. a river entering from outside) S = 0 and the edge is a wall, so water can't run back upstream and out.
const int EDGE_K = 10;
float edgeOut(float h, float zEdge, float zInner, float n){
  float S = max(zInner - zEdge, 0.0) / (float(EDGE_K) * uDx);
  if (h <= 1e-4 || S <= 0.0) return 0.0;
  float q = pow(h, 5.0 / 3.0) * sqrt(S) / max(n, 0.01);
  return min(min(q, h * sqrt(G * h)), h * uDx / (4.0 * uDt));
}

void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  float h0 = texelFetch(uH, c, 0).r;
  vec2 q = texelFetch(uQ, c, 0).xy;
  float z0 = texelFetch(uZ, c, 0).r;
  float nE = texelFetch(uP, c, 0).r * uManMul;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : -edgeOut(h0, z0, texelFetch(uZ, c + ivec2(min(EDGE_K, uSize.x - 1), 0), 0).r, nE);
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : -edgeOut(h0, z0, texelFetch(uZ, c + ivec2(0, min(EDGE_K, uSize.y - 1)), 0).r, nE);
  // porosity: open share of this cell, open width of each face (= narrower of the two cells)
  float pc = phiOf(texelFetch(uP, c, 0).a);
  vec2 wf = texelFetch(uWf, c, 0).xy;
  float we = c.x < uSize.x - 1 ? min(wf.x, pc) : pc;
  float ws = c.y < uSize.y - 1 ? min(wf.y, pc) : pc;
  // the neighbour's flux pass used min(its face width, its own share): reproduce it exactly (conservation)
  float ww = c.x > 0 ? min(texelFetch(uWf, c - ivec2(1, 0), 0).x, phiOf(texelFetch(uP, c - ivec2(1, 0), 0).a)) : pc;
  float wn = c.y > 0 ? min(texelFetch(uWf, c - ivec2(0, 1), 0).y, phiOf(texelFetch(uP, c - ivec2(0, 1), 0).a)) : pc;
  float h = h0 + uDt / (uDx * pc) * (ww * qw - we * q.x + wn * qn - ws * q.y);
  float mask = 1.0;
  if (uRainCircle.w > 0.5) {
    float d = distance(vec2(c) + 0.5, uRainCircle.xy);
    mask = 1.0 - smoothstep(0.85 * uRainCircle.z, uRainCircle.z, d);
  }
  // Rain. Roofs inside porous cells drain into the cell's open part (hence / pc). A solid building cell
  // passes its rain to its open 4-neighbours in equal shares (downpipes); if it has none it keeps it.
  bool solid = texelFetch(uP, c, 0).a >= SOLID;
  int nOpen = 0;
  for (int k = 0; k < 4; k++) { ivec2 nb = c + (k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1));
    if (all(greaterThanEqual(nb, ivec2(0))) && all(lessThan(nb, uSize)) && texelFetch(uP, nb, 0).a < SOLID) nOpen++; }
  float rainIn = (solid && nOpen > 0) ? 0.0 : mask;
  if (!solid) {
    for (int k = 0; k < 4; k++) {
      ivec2 nb = c + (k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1));
      if (any(lessThan(nb, ivec2(0))) || any(greaterThanEqual(nb, uSize)) || texelFetch(uP, nb, 0).a < SOLID) continue;
      int m = 0;                                     // open neighbours of that roof cell
      for (int j = 0; j < 4; j++) { ivec2 nn = nb + (j == 0 ? ivec2(1, 0) : j == 1 ? ivec2(-1, 0) : j == 2 ? ivec2(0, 1) : ivec2(0, -1));
        if (all(greaterThanEqual(nn, ivec2(0))) && all(lessThan(nn, uSize)) && texelFetch(uP, nn, 0).a < SOLID) m++; }
      float mk = uRainCircle.w > 0.5 ? 1.0 - smoothstep(0.85 * uRainCircle.z, uRainCircle.z, distance(vec2(nb) + 0.5, uRainCircle.xy)) : 1.0;
      rainIn += mk / float(max(m, 1));
    }
  }
  h += uRain * rainIn * uDt / pc;
  for (int i = 0; i < 8; i++) {
    if (i >= uNInflow) break;
    // integer cell arithmetic: the (2r+1)^2 box always has exactly that many cells, so Q is conserved
    ivec2 dd = abs(c - ivec2(floor(uInflow[i].xy)));
    int r = int(uInflow[i].w + 0.5);
    ivec2 lo = ivec2(floor(uInflow[i].xy)) - r, hi = ivec2(floor(uInflow[i].xy)) + r;
    // boxes clipped by the domain edge spread Q over the cells that exist
    float cnt = float((min(hi.x, uSize.x - 1) - max(lo.x, 0) + 1) * (min(hi.y, uSize.y - 1) - max(lo.y, 0) + 1));
    if (dd.x <= r && dd.y <= r) h += uInflow[i].z * uDt / (cnt * uDx * uDx * pc);
  }
  vec4 p = texelFetch(uP, c, 0);
  float f = uInfMul * (p.z + (p.y - p.z) * exp(-uHortonK * uTr)) / 3.6e6;  // Horton, mm/h -> m/s
  f += uDrain * texelFetch(uGr, c, 0).g;                                     // storm drains in built-up cells
  h = max(h - f * uDt, 0.0);
  oH = h;
  float spd = 0.0;
  if (h > 0.05) spd = length(cellVel(vec2(qw + q.x, qn + q.y), h));
  vec4 m = texelFetch(uM, c, 0);
  m.x = max(m.x, h);
  if (h > 0.05) m.y = max(m.y, spd);
  if (m.z < 0.0 && h > 0.1) m.z = uT / 60.0;
  // DEFRA FD2320/FD2321 hazard rating HR = d (v + 0.5) + DF, debris factor DF (urban): 0 / 0.5 (d > 0.25 m) / 1 (d > 0.75 m)
  if (h > 0.05) m.w = max(m.w, h * (spd + 0.5) + (h > 0.75 ? 1.0 : h > 0.25 ? 0.5 : 0.0));
  oM = m;
}`;

// ---- reductions: (max h, sum h, count h>0.1, max speed)
// cell-centred speed from the four face fluxes; depth floored at 10 cm so thin wetting fronts don't blow up
const SPEED = `
float speed(ivec2 c, float h){
  if (h <= 0.05) return 0.0;
  vec2 q = texelFetch(uQ, c, 0).xy;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
  return length(cellVel(vec2(qw + q.x, qn + q.y), h));
}`;
const FS_REDUCE0 = HEAD + `
uniform sampler2D uH, uQ, uP; uniform ivec2 uSize; uniform int uB;
out vec4 o;` + SPEED + `
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy) * uB;
  vec4 r = vec4(0.0);
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    ivec2 p = c + ivec2(i, j);
    if (p.x >= uSize.x || p.y >= uSize.y) continue;
    float h = texelFetch(uH, p, 0).r;
    r.x = max(r.x, h); r.y += h * phiOf(texelFetch(uP, p, 0).a); r.z += h > 0.1 ? 1.0 : 0.0;
    if (h > 0.05) r.w = max(r.w, speed(p, h));
  }
  o = r;
}`;
const FS_REDUCE = HEAD + `
uniform sampler2D uS; uniform ivec2 uSize;
out vec4 o;
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy) * 8;
  vec4 r = vec4(0.0);
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    ivec2 p = c + ivec2(i, j);
    if (p.x >= uSize.x || p.y >= uSize.y) continue;
    vec4 s = texelFetch(uS, p, 0);
    r.x = max(r.x, s.x); r.y += s.y; r.z += s.z; r.w = max(r.w, s.w);
  }
  o = r;
}`;

// ---- probe: depth, speed, water surface, ground at one cell
const FS_PROBE = HEAD + `
uniform sampler2D uH, uQ, uZ, uM, uGr, uP; uniform ivec2 uCell;
layout(location=0) out vec4 o;
layout(location=1) out vec4 o2;
layout(location=2) out vec4 o3;` + SPEED + `
void main(){
  ivec2 c = uCell;
  float h = texelFetch(uH, c, 0).r;
  float spd = speed(c, h);
  float z = texelFetch(uZ, c, 0).r;
  o = vec4(h, spd, z + h, z);
  o2 = texelFetch(uM, c, 0);
  vec4 pp = texelFetch(uP, c, 0);
  o3 = vec4(texelFetch(uGr, c, 0).r, pp.a, pp.r, pp.g);   // bare ground, building fraction, Manning n, f0
}`;

// ---- snapshot: block-max depth (+ speed there) for timeline playback
const FS_SNAP = HEAD + `
uniform sampler2D uH, uQ; uniform ivec2 uSize; uniform int uS;
out vec4 o;` + SPEED + `
vec2 velC(ivec2 c, float h){
  if (h <= 0.05) return vec2(0.0);
  vec2 q = texelFetch(uQ, c, 0).xy;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
  return cellVel(vec2(qw + q.x, qn + q.y), h);
}
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy) * uS;
  vec4 r = vec4(0.0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    if (i >= uS || j >= uS) continue;
    ivec2 p = c + ivec2(i, j);
    if (p.x >= uSize.x || p.y >= uSize.y) continue;
    float h = texelFetch(uH, p, 0).r;
    if (h > r.x) { r.x = h; r.yz = velC(p, h); }
  }
  o = r;
}`;

// ---- pack the visible window for the view: RGB8 = depth cm (12 bit) + flow u,v (6+6 bit, sqrt-scaled)
//      or, for the max modes, max depth cm (12 bit) + arrival minute (12 bit, 4095 = never)
const FS_ENCODE = HEAD + `
uniform sampler2D uH, uQ, uM, uSnap;
uniform ivec2 uSize, uSnapSize;
uniform int uSrc;            // 0 live, 1 snapshot, 2 max envelope
uniform int uSnapS;
uniform vec4 uWin;           // grid cells
uniform vec2 uOut;           // ow, oh
uniform float uCanvasH;
out vec4 o;` + SPEED + `
vec2 vel(ivec2 c, float h){
  if (h <= 0.05) return vec2(0.0);
  vec2 q = texelFetch(uQ, c, 0).xy;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
  return cellVel(vec2(qw + q.x, qn + q.y), h);
}
int q6(float u){ return clamp(int(round(sign(u) * sqrt(min(abs(u), 8.0) / 8.0) * 31.0)) + 32, 1, 63); }
void main(){
  vec2 px = vec2(gl_FragCoord.x, uCanvasH - gl_FragCoord.y);          // image row 0 = top = north
  vec2 a = uWin.xy + floor(px) * (uWin.zw - uWin.xy) / uOut;
  vec2 b = uWin.xy + (floor(px) + 1.0) * (uWin.zw - uWin.xy) / uOut;
  ivec2 c0 = ivec2(floor(a)), c1 = max(ivec2(ceil(b)) - 1, c0);
  ivec2 st = max((c1 - c0 + 1) / 4, ivec2(1));                          // at most ~4x4 samples per pixel
  float best = 0.0; ivec2 bc = clamp(c0, ivec2(0), uSize - 1); float arr = 4095.0;
  for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++) {
    ivec2 c = c0 + ivec2(i, j) * st;
    if (c.x > c1.x || c.y > c1.y) continue;
    if (any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, uSize))) continue;   // grid-aligned blocks may overhang the domain
    float h;
    if (uSrc == 1) h = texelFetch(uSnap, clamp(c / uSnapS, ivec2(0), uSnapSize - 1), 0).r;
    else if (uSrc == 2) { vec4 m = texelFetch(uM, c, 0); h = m.x; if (m.z >= 0.0) arr = min(arr, m.z); }
    else h = texelFetch(uH, c, 0).r;
    if (h > best) { best = h; bc = c; }
  }
  int d = clamp(int(round(best * 100.0)), 0, 4095);
  int lo;
  if (uSrc == 2) lo = clamp(int(arr), 0, 4095);
  else {
    vec2 v = uSrc == 1 ? texelFetch(uSnap, clamp(bc / uSnapS, ivec2(0), uSnapSize - 1), 0).gb : vel(bc, best);
    lo = (q6(v.x) << 6) | q6(v.y);
  }
  o = vec4(float(d >> 4), float(((d & 15) << 4) | (lo >> 8)), float(lo & 255), 255.0) / 255.0;
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error(src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    throw new Error('Shader compile error: ' + log);
  }
  return s;
}

export function program(gl, fs, vs = VS_FULL) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

const FORMATS = {
  R32F: ['R32F', 'RED', 'FLOAT'],
  RG32F: ['RG32F', 'RG', 'FLOAT'],
  RGBA32F: ['RGBA32F', 'RGBA', 'FLOAT'],
  RGBA16F: ['RGBA16F', 'RGBA', 'HALF_FLOAT'],
  RG16F: ['RG16F', 'RG', 'HALF_FLOAT'],
  R8UI: ['R8UI', 'RED_INTEGER', 'UNSIGNED_BYTE'],
};

export function texture(gl, w, h, fmt, data = null) {
  const [ifmt, f, t] = FORMATS[fmt];
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl[ifmt], w, h);
  if (data) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl[f], gl[t], data);
  return { tex, w, h, fmt };
}

function fbo(gl, texs) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.tex, 0));
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer incomplete: 0x' + st.toString(16));
  return fb;
}

let gridSerial = 0;

export class FloodSolver {
  /**
   * @param gl    WebGL2 context (shared with the map)
   * @param data  {meta, dem: Float32Array, lc, bld, riv: Uint8Array}
   * @param opts  {factor: 1|2|3, buildings: bool, window: [fx0, fy0, fx1, fy1] fine cells (simulation area, default all)}
   */
  constructor(gl, data, opts) {
    this.gl = gl;
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float дэмжигдэхгүй байна');
    const m = data.meta;
    this.meta = m;
    this.F = opts.factor;
    const win = opts.window || [0, 0, m.W, m.H];
    this.window = win;
    this.off = [win[0], win[1]];
    this.W = Math.ceil((win[2] - win[0]) / this.F);
    this.H = Math.ceil((win[3] - win[1]) / this.F);
    this.x0 = m.x0 + win[0] * m.res;                // grid origin (NW corner), EPSG:3857
    this.y1 = m.y1 - win[1] * m.res;
    this.cellMerc = m.res * this.F;                 // mercator metres per solver cell
    this.dx = this.cellMerc * m.groundScale;        // ground metres per solver cell
    this.vao = gl.createVertexArray();

    this.progs = {
      init: program(gl, FS_INIT), flux: program(gl, FS_FLUX), depth: program(gl, FS_DEPTH),
      red0: program(gl, FS_REDUCE0), red: program(gl, FS_REDUCE), probe: program(gl, FS_PROBE),
      snap: program(gl, FS_SNAP), encode: program(gl, FS_ENCODE),
    };
    const { W, H } = this;
    this.Z = texture(gl, W, H, 'R32F');
    this.P = texture(gl, W, H, 'RGBA16F');
    this.Gr = texture(gl, W, H, 'RGBA32F');
    this.Wf = texture(gl, W, H, 'RG16F');
    this.Hs = [texture(gl, W, H, 'R32F'), texture(gl, W, H, 'R32F')];
    this.Qs = [texture(gl, W, H, 'RG32F'), texture(gl, W, H, 'RG32F')];
    this.Ms = [texture(gl, W, H, 'RGBA16F'), texture(gl, W, H, 'RGBA16F')];
    this.fbInit = fbo(gl, [this.Z, this.P, this.Gr, this.Wf]);
    this.fbQ = this.Qs.map(t => fbo(gl, [t]));
    this.fbHM = [fbo(gl, [this.Hs[0], this.Ms[0]]), fbo(gl, [this.Hs[1], this.Ms[1]])];
    this.fbHread = this.Hs.map(t => fbo(gl, [t]));
    this.fbMread = this.Ms.map(t => fbo(gl, [t]));

    // reduction chain
    this.red = [];
    let rw = Math.ceil(W / 8), rh = Math.ceil(H / 8);
    for (;;) {
      const t = texture(gl, rw, rh, 'RGBA32F');
      this.red.push({ t, fb: fbo(gl, [t]) });
      if (rw * rh <= 256) break;
      rw = Math.ceil(rw / 8); rh = Math.ceil(rh / 8);
    }
    this.probeT = [texture(gl, 1, 1, 'RGBA32F'), texture(gl, 1, 1, 'RGBA32F'), texture(gl, 1, 1, 'RGBA32F')];
    this.probeFb = fbo(gl, this.probeT);

    // snapshots for timeline playback: <= ~1.6 M texels each
    this.snapS = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(W * H / 1.6e6))));
    this.snapW = Math.ceil(W / this.snapS);
    this.snapH = Math.ceil(H / this.snapS);
    this.maxSnaps = Math.max(12, Math.min(90, Math.floor(200e6 / (this.snapW * this.snapH * 8))));   // ≤ ~200 MB of VRAM
    this.snaps = [];

    this._uploadSources(data);
    this.buildGrid(opts.buildings);
    this.reset();
  }

  _uploadSources(d) {
    const gl = this.gl, m = d.meta;
    this.src = {
      lc: texture(gl, m.W, m.H, 'R8UI', d.lc),
      bld: texture(gl, m.W, m.H, 'R8UI', d.bld),
      riv: texture(gl, m.W, m.H, 'R8UI', d.riv),
      dem: texture(gl, m.demW, m.demH, 'R32F', d.dem),
    };
    this.fineBld = d.bld;
  }

  _bind(prog, texs) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    let unit = 0;
    for (const [name, t] of Object.entries(texs)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.uniform1i(prog.u[name], unit++);
    }
  }

  _draw(fb, w, h, nTargets = 1) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.drawBuffers(Array.from({ length: nTargets }, (_, i) => gl.COLOR_ATTACHMENT0 + i));
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _begin() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
  }

  _end() {
    const gl = this.gl;
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  buildGrid(buildings) {
    const gl = this.gl, pr = this.progs.init, m = this.meta;
    this.buildingsOn = buildings;
    this._begin();
    this._bind(pr, { uLC: this.src.lc, uBld: this.src.bld, uRiv: this.src.riv, uDem: this.src.dem });
    gl.uniform1i(pr.u.uF, this.F);
    gl.uniform2i(pr.u.uFine, m.W, m.H);
    gl.uniform2i(pr.u.uOff, this.off[0], this.off[1]);
    gl.uniform1f(pr.u.uDemF, m.demF);
    gl.uniform1f(pr.u.uBldOn, buildings ? 1 : 0);
    gl.uniform3fv(pr.u.uLc, LANDCOVER.flatMap(l => [l.n, l.f0, l.fc]));
    this._draw(this.fbInit, this.W, this.H, 4);
    this._end();
    this.gridVersion = ++gridSerial;      // unique across solvers: a new area / resolution is a new grid
  }

  /** Static per-grid layers for the view: ground elevation and building mask (CPU copies). */
  readGrid() {
    const gl = this.gl, W = this.W, H = this.H;
    // ground: channels burned (what the water sits on); groundNat: natural surface without the carved channels.
    // 3D terrain uses groundNat — its distant LODs would smooth a narrow trench over and hide the river in it.
    const ground = new Float32Array(W * H), groundNat = new Float32Array(W * H), bld = new Uint8Array(W * H);
    const rows = 256, buf = new Float32Array(W * rows * 4);
    for (const [t, ch, out] of [[this.Gr, 0, ground], [this.Gr, 2, groundNat], [this.P, 3, null]]) {
      const fb = fbo(gl, [t]);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      for (let y = 0; y < H; y += rows) {
        const n = Math.min(rows, H - y);
        gl.readPixels(0, y, W, n, gl.RGBA, gl.FLOAT, buf);
        for (let i = 0; i < W * n; i++) {
          if (out) out[y * W + i] = buf[i * 4 + ch];
          else bld[y * W + i] = buf[i * 4 + ch] >= 0.8 ? 1 : 0;   // = SOLID
        }
      }
      gl.deleteFramebuffer(fb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { key: `g${this.gridVersion}`, W, H, ground, groundNat, bld, dx: this.dx, cellMerc: this.cellMerc,
      x0: this.x0, y1: this.y1, F: this.F, off: this.off, fineBld: this.fineBld, fineW: this.meta.W, fineH: this.meta.H };
  }

  /** Pack window win=[x0,y0,x1,y1] (cells) into the top-left ow×oh pixels of this context's canvas. */
  encode(src, win, ow, oh, snap = null) {
    const gl = this.gl, pr = this.progs.encode, cv = gl.canvas;
    this._begin();
    this._bind(pr, { uH: this.Hcur, uQ: this.Qcur, uM: this.Mcur, uSnap: snap ? snap.t : this.Hcur });
    gl.uniform2i(pr.u.uSize, this.W, this.H);
    gl.uniform2i(pr.u.uSnapSize, this.snapW, this.snapH);
    gl.uniform1i(pr.u.uSrc, src);
    gl.uniform1i(pr.u.uSnapS, this.snapS);
    gl.uniform4fv(pr.u.uWin, win);
    gl.uniform2f(pr.u.uOut, ow, oh);
    gl.uniform1f(pr.u.uCanvasH, cv.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, cv.height - oh, ow, oh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    return { canvas: { width: cv.width, height: cv.height }, source: cv, win, ow, oh };
  }

  reset() {
    const gl = this.gl;
    this._begin();
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbHM[i]);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);   // clearBufferfv(…, 1) needs attachment 1 enabled
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
      gl.clearBufferfv(gl.COLOR, 1, [0, 0, -1, 0]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbQ[i]);
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    }
    this._end();
    for (const s of this.snaps) gl.deleteTexture(s.t.tex);
    this.snaps = [];
    this.cur = 0;          // index of current H/Q/M
    this.t = 0;
    this.steps = 0;
    this.stats = { hmax: 0, vol: 0, wet: 0, vmax: 0 };
    this.rainVol = 0;      // m^3 fallen on the domain
    this.inflowVol = 0;
    this.lastDt = 0;
    this._dropAsync();
    this.stepsAtStats = 0;
  }

  get Hcur() { return this.Hs[this.cur]; }
  get Qcur() { return this.Qs[this.cur]; }
  get Mcur() { return this.Ms[this.cur]; }

  suggestDt(cfl = 0.7) {
    const h = Math.max(this.stats.hmax * 1.25, 0.05);
    const c = Math.sqrt(G * h);
    return Math.min(cfl * this.dx / (c + Math.max(this.stats.vmax, c)), 5.0);
  }

  /** Advance one step. f = forcing {rain m/s, inf multiplier, hortonK, tr, circle, inflows, manning, theta} */
  step(dt, f) {
    const gl = this.gl, a = this.cur, b = 1 - a;
    this._begin();
    let pr = this.progs.flux;
    this._bind(pr, { uH: this.Hs[a], uQ: this.Qs[a], uZ: this.Z, uP: this.P, uWf: this.Wf });
    gl.uniform1f(pr.u.uDt, dt); gl.uniform1f(pr.u.uDx, this.dx);
    gl.uniform1f(pr.u.uManMul, f.manning); gl.uniform1f(pr.u.uTheta, f.theta);
    gl.uniform2fv(pr.u.uWallE, f.wallE || [1, 0]);
    gl.uniform2i(pr.u.uSize, this.W, this.H);
    this._draw(this.fbQ[b], this.W, this.H);

    pr = this.progs.depth;
    this._bind(pr, { uH: this.Hs[a], uQ: this.Qs[b], uP: this.P, uM: this.Ms[a], uGr: this.Gr, uZ: this.Z, uWf: this.Wf });
    gl.uniform1f(pr.u.uDrain, (f.drain || 0) / 3.6e6);
    gl.uniform1f(pr.u.uManMul, f.manning);
    gl.uniform1f(pr.u.uDt, dt); gl.uniform1f(pr.u.uDx, this.dx);
    gl.uniform1f(pr.u.uRain, f.rain); gl.uniform1f(pr.u.uT, this.t + dt);
    gl.uniform1f(pr.u.uInfMul, f.infMul); gl.uniform1f(pr.u.uHortonK, f.hortonK); gl.uniform1f(pr.u.uTr, f.tr);
    gl.uniform4fv(pr.u.uRainCircle, f.circle);
    const inf = new Float32Array(32);
    f.inflows.slice(0, 8).forEach((p, i) => inf.set(p, i * 4));
    gl.uniform4fv(pr.u.uInflow, inf);
    gl.uniform1i(pr.u.uNInflow, Math.min(8, f.inflows.length));
    gl.uniform2i(pr.u.uSize, this.W, this.H);
    this._draw(this.fbHM[b], this.W, this.H, 2);
    this._end();

    this.cur = b;
    this.t += dt;
    this.steps++;
    this.lastDt = dt;
    this.rainVol += f.rain * f.rainArea * dt;
    for (const p of f.inflows) this.inflowVol += p[2] * dt;
  }

  /** Reduce current state to domain statistics (forces a GPU sync). */
  reduce() {
    this._dropAsync();
    this._reducePasses();
    const gl = this.gl, last = this.red[this.red.length - 1];
    const buf = new Float32Array(last.t.w * last.t.h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, last.fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, last.t.w, last.t.h, gl.RGBA, gl.FLOAT, buf);
    this._end();
    return this._stats(buf);
  }

  /** Non-blocking variant: start a reduction whose result arrives a frame or two later (pixel-pack buffer + fence).
   *  Waiting on readPixels stalls the CPU until the GPU has also finished the map's frame (~10 ms in 3D).
   *  Up to four are in flight: Chrome reports a fence as signalled only 2-3 frames later, even on an idle GPU. */
  reduceStart() {
    this.reduceQ = this.reduceQ || [];
    if (this.reduceQ.length >= 4) return false;
    this._reducePasses();
    const gl = this.gl, last = this.red[this.red.length - 1];
    const bytes = last.t.w * last.t.h * 16;
    this.pbos = this.pbos || [];
    const used = new Set(this.reduceQ.map(q => q.pbo));
    let pbo = this.pbos.find(b => !used.has(b));
    if (!pbo) { pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ); this.pbos.push(pbo); }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, last.fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, last.t.w, last.t.h, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this._end();
    this.reduceQ.push({ sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), n: bytes / 4, pbo, steps: this.steps });
    gl.flush();
    return true;
  }

  get reducePending() { return !!(this.reduceQ && this.reduceQ.length); }
  get reduceInFlight() { return this.reduceQ ? this.reduceQ.length : 0; }

  /** Pick up finished async reductions (newest wins); true when this.stats was updated. */
  reducePoll() {
    const gl = this.gl, q = this.reduceQ;
    let got = null;
    while (q && q.length && gl.getSyncParameter(q[0].sync, gl.SYNC_STATUS) === gl.SIGNALED) {
      got = q.shift();
      gl.deleteSync(got.sync);
    }
    if (!got) return false;
    const buf = new Float32Array(got.n);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, got.pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, buf);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this._stats(buf);
    this.stepsAtStats = got.steps;
    return true;
  }

  _dropAsync() { for (const r of this.reduceQ || []) this.gl.deleteSync(r.sync); this.reduceQ = []; }

  _reducePasses() {
    const gl = this.gl;
    this._begin();
    let pr = this.progs.red0;
    this._bind(pr, { uH: this.Hcur, uQ: this.Qcur, uP: this.P });
    gl.uniform2i(pr.u.uSize, this.W, this.H);
    gl.uniform1i(pr.u.uB, 8);
    this._draw(this.red[0].fb, this.red[0].t.w, this.red[0].t.h);
    for (let i = 1; i < this.red.length; i++) {
      pr = this.progs.red;
      const s = this.red[i - 1].t;
      this._bind(pr, { uS: s });
      gl.uniform2i(pr.u.uSize, s.w, s.h);
      this._draw(this.red[i].fb, this.red[i].t.w, this.red[i].t.h);
    }
  }

  _stats(buf) {
    const s = { hmax: 0, vol: 0, wet: 0, vmax: 0 };
    for (let i = 0; i < buf.length; i += 4) {
      s.hmax = Math.max(s.hmax, buf[i]); s.vol += buf[i + 1]; s.wet += buf[i + 2]; s.vmax = Math.max(s.vmax, buf[i + 3]);
    }
    s.vol *= this.dx * this.dx;          // m^3
    s.wetArea = s.wet * this.dx * this.dx; // m^2 with depth > 10 cm
    this.stats = s;
    this.stepsAtStats = this.steps;
    return s;
  }

  probe(cx, cy) {
    const gl = this.gl, pr = this.progs.probe;
    this._begin();
    this._bind(pr, { uH: this.Hcur, uQ: this.Qcur, uZ: this.Z, uM: this.Mcur, uGr: this.Gr, uP: this.P });
    gl.uniform2i(pr.u.uCell, cx, cy);
    this._draw(this.probeFb, 1, 1, 3);
    const a = new Float32Array(4), b = new Float32Array(4), c = new Float32Array(4);
    gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, a);
    gl.readBuffer(gl.COLOR_ATTACHMENT1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, b);
    gl.readBuffer(gl.COLOR_ATTACHMENT2); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, c);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    this._end();
    return { h: a[0], v: a[1], wse: a[2], z: c[0], building: c[1] >= 0.8, n: c[2], f0: c[3], hmax: b[0], vmax: b[1], arrival: b[2], hazard: b[3] };
  }

  snapshot() {
    if (this.snaps.length >= this.maxSnaps) return false;
    const gl = this.gl, pr = this.progs.snap;
    const t = texture(gl, this.snapW, this.snapH, 'RGBA16F');
    const fb = fbo(gl, [t]);
    this._begin();
    this._bind(pr, { uH: this.Hcur, uQ: this.Qcur });
    gl.uniform2i(pr.u.uSize, this.W, this.H);
    gl.uniform1i(pr.u.uS, this.snapS);
    this._draw(fb, this.snapW, this.snapH);
    this._end();
    gl.deleteFramebuffer(fb);
    this.snaps.push({ t, time: this.t });
    return true;
  }

  /** Read one float channel of a texture in row strips (row 0 = north). */
  readLayer(which, channel = 0, onRows) {
    const gl = this.gl;
    const fb = which === 'max' ? this.fbMread[this.cur] : this.fbHread[this.cur];
    const rows = 256, buf = new Float32Array(this.W * rows * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    for (let y = 0; y < this.H; y += rows) {
      const n = Math.min(rows, this.H - y);
      gl.readPixels(0, y, this.W, n, gl.RGBA, gl.FLOAT, buf);
      const out = new Float32Array(this.W * n);
      for (let i = 0; i < out.length; i++) out[i] = buf[i * 4 + channel];
      onRows(y, n, out);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose() {
    const gl = this.gl;
    const all = [this.Z, this.P, this.Gr, this.Wf, ...this.Hs, ...this.Qs, ...this.Ms, ...this.probeT,
      ...this.red.map(r => r.t), ...this.snaps.map(s => s.t), ...Object.values(this.src)];
    all.forEach(t => gl.deleteTexture(t.tex));
    [this.fbInit, ...this.fbQ, ...this.fbHM, ...this.fbHread, ...this.fbMread, this.probeFb,
      ...this.red.map(r => r.fb)].forEach(f => gl.deleteFramebuffer(f));
    Object.values(this.progs).forEach(p => gl.deleteProgram(p.p));
  }
}
