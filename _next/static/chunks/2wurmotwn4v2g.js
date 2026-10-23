(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,82990,31413,91765,e=>{"use strict";let t=[{code:0,name:"Тодорхойгүй",n:.035,f0:30,fc:6,s:40},{code:10,name:"Ой мод",n:.1,f0:60,fc:15,s:80},{code:20,name:"Бут сөөг",n:.07,f0:50,fc:12,s:60},{code:30,name:"Бэлчээр, зүлэг",n:.035,f0:40,fc:8,s:50},{code:40,name:"Тариалан",n:.035,f0:40,fc:8,s:60},{code:50,name:"Барилгажсан",n:.02,f0:4,fc:1,s:15},{code:60,name:"Ил хөрс",n:.025,f0:25,fc:4,s:30},{code:70,name:"Цас, мөс",n:.02,f0:0,fc:0,s:0},{code:80,name:"Усан гадарга",n:.03,f0:0,fc:0,s:0},{code:90,name:"Намаг",n:.06,f0:5,fc:1,s:10},{code:100,name:"Хаг, хөвд",n:.04,f0:30,fc:6,s:40}],i=`#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`,r=`#version 300 es
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
`,a=r+`
uniform usampler2D uLC, uBld, uRiv;
uniform sampler2D uDem;
uniform int uF;
uniform ivec2 uFine;
uniform ivec2 uOff;            // window origin on the fine grid (simulation area)
uniform float uDemF;
uniform vec4 uLc[11];          // n, f0, fc, soil storage mm
uniform float uBldOn;          // 1 = buildings are obstacles
layout(location=0) out float oZ;
layout(location=1) out vec4 oP; // n, f0 mm/h, fc mm/h, building fraction (>= SOLID: wall, else porous)
layout(location=2) out vec4 oG;  // ground with channels burned (display), urban fraction, natural ground (3D terrain), soil storage mm
layout(location=3) out vec2 oW;  // open width of the east / south face (0 = wall), from the fine building raster
bool bldAt(ivec2 p){ return uBldOn > 0.5 && p.x >= 0 && p.y >= 0 && p.x < uFine.x && p.y < uFine.y && texelFetch(uBld, p, 0).r > 0u; }
float dem(ivec2 p){ ivec2 s = textureSize(uDem, 0); return texelFetch(uDem, clamp(p, ivec2(0), s - 1), 0).r; }
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  float cnt = 0.0, ns = 0.0, a0 = 0.0, ac = 0.0, st = 0.0, nb = 0.0, hb = 0.0, burn = 0.0, nu = 0.0;
  // F <= 8 (the view itself uses 1..3)
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    if (i >= uF || j >= uF) continue;
    ivec2 p = uOff + c * uF + ivec2(i, j);
    if (p.x >= uFine.x || p.y >= uFine.y) continue;
    uint lcv = texelFetch(uLC, p, 0).r;
    int k = min(int(lcv) / 10, 10);
    vec4 prm = uLc[k];
    uint b = texelFetch(uBld, p, 0).r;
    burn = max(burn, float(texelFetch(uRiv, p, 0).r) * 0.1);
    cnt += 1.0; ns += prm.x; a0 += prm.y; ac += prm.z; st += prm.w;
    if (b > 0u) { nb += 1.0; hb += float(b); }
    if (b > 0u || lcv == 50u) nu += 1.0;       // served by street drainage (built-up)
  }
  cnt = max(cnt, 1.0);
  // A face is open along a fine row/column only where the fine cells on both sides are free: buildings
  // standing on the boundary between two cells block it, even when they cover little of either cell.
  float oe = 0.0, os = 0.0;
  for (int k = 0; k < 8; k++) {
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
  oG = vec4(z, nu / cnt, zNat, st / cnt);
  if (frac >= SOLID) { z += hb / max(nb, 1.0); f0 = 0.0; fc = 0.0; }
  else n += 0.10 * frac;               // porous cell: extra drag; infiltration applies to the open ground only
  oZ = z;
  oP = vec4(n, f0, fc, frac);
}`,o=r+`
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
}`,l=r+`
uniform sampler2D uH, uQ, uP, uM, uZ, uWf;
uniform float uDt, uDx, uRain, uT, uInfMul, uHortonK, uTr, uDrain, uManMul;   // uDrain: storm-drain capacity, m/s
uniform float uWet;            // rain fallen so far, mm (soil saturation)
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
  vec4 gr = texelFetch(uGr, c, 0);
  // soil saturation: what has soaked in is at most the rain fallen and at most Horton's cumulative capacity
  float cap = uInfMul * (p.z * uTr + (p.y - p.z) * (1.0 - exp(-uHortonK * uTr)) / max(uHortonK, 1e-9)) / 3600.0;
  float stor = gr.w * uInfMul;                                               // wet soil holds less
  if (stor > 0.0) f *= 1.0 - 0.9 * smoothstep(0.7, 1.0, min(uWet, cap) / stor);
  f += uDrain * gr.g;                                                        // storm drains in built-up cells
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
}`,n=`
float speed(ivec2 c, float h){
  if (h <= 0.05) return 0.0;
  vec2 q = texelFetch(uQ, c, 0).xy;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
  return length(cellVel(vec2(qw + q.x, qn + q.y), h));
}`,s=r+`
uniform sampler2D uH, uQ, uP; uniform ivec2 uSize; uniform int uB;
out vec4 o;`+n+`
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
}`,c=r+`
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
}`,u=r+`
uniform sampler2D uH, uQ, uZ, uM, uGr, uP; uniform ivec2 uCell;
layout(location=0) out vec4 o;
layout(location=1) out vec4 o2;
layout(location=2) out vec4 o3;`+n+`
void main(){
  ivec2 c = uCell;
  float h = texelFetch(uH, c, 0).r;
  float spd = speed(c, h);
  float z = texelFetch(uZ, c, 0).r;
  o = vec4(h, spd, z + h, z);
  o2 = texelFetch(uM, c, 0);
  vec4 pp = texelFetch(uP, c, 0);
  o3 = vec4(texelFetch(uGr, c, 0).r, pp.a, pp.r, pp.g);   // bare ground, building fraction, Manning n, f0
}`,f=r+`
uniform sampler2D uH, uQ; uniform ivec2 uSize; uniform int uS;
out vec4 o;`+n+`
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
}`,h=r+`
uniform sampler2D uH, uQ, uM, uSnap;
uniform ivec2 uSize, uSnapSize;
uniform int uSrc;            // 0 live, 1 snapshot, 2 max envelope
uniform int uSnapS;
uniform vec4 uWin;           // grid cells
uniform vec2 uOut;           // ow, oh
uniform float uCanvasH;
out vec4 o;`+n+`
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
}`;function d(e,t,i){let r=e.createShader(t);if(e.shaderSource(r,i),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw console.error(i.split("\n").map((e,t)=>`${t+1}: ${e}`).join("\n")),Error("Shader compile error: "+t)}return r}function v(e,t,r=i){let a=e.createProgram();if(e.attachShader(a,d(e,e.VERTEX_SHADER,r)),e.attachShader(a,d(e,e.FRAGMENT_SHADER,t)),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS))throw Error("Link error: "+e.getProgramInfoLog(a));let o={},l=e.getProgramParameter(a,e.ACTIVE_UNIFORMS);for(let t=0;t<l;t++){let i=e.getActiveUniform(a,t);o[i.name.replace(/\[0\]$/,"")]=e.getUniformLocation(a,i.name)}return{p:a,u:o}}let m={R32F:["R32F","RED","FLOAT"],RG32F:["RG32F","RG","FLOAT"],RGBA32F:["RGBA32F","RGBA","FLOAT"],RGBA16F:["RGBA16F","RGBA","HALF_FLOAT"],RG16F:["RG16F","RG","HALF_FLOAT"],R8UI:["R8UI","RED_INTEGER","UNSIGNED_BYTE"]};function p(e,t,i,r,a=null){let[o,l,n]=m[r],s=e.createTexture();return e.bindTexture(e.TEXTURE_2D,s),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texStorage2D(e.TEXTURE_2D,1,e[o],t,i),a&&e.texSubImage2D(e.TEXTURE_2D,0,0,0,t,i,e[l],e[n],a),{tex:s,w:t,h:i,fmt:r}}function x(e,t){let i=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,i),t.forEach((t,i)=>e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+i,e.TEXTURE_2D,t.tex,0));let r=e.checkFramebufferStatus(e.FRAMEBUFFER);if(r!==e.FRAMEBUFFER_COMPLETE)throw Error("Framebuffer incomplete: 0x"+r.toString(16));return i}let g=0;e.s(["FloodSolver",0,class{constructor(e,t,i){if(this.gl=e,!e.getExtension("EXT_color_buffer_float"))throw Error("EXT_color_buffer_float дэмжигдэхгүй байна");const r=t.meta;this.meta=r,this.F=i.factor;const n=i.window||[0,0,r.W,r.H];this.window=n,this.off=[n[0],n[1]],this.W=Math.ceil((n[2]-n[0])/this.F),this.H=Math.ceil((n[3]-n[1])/this.F),this.x0=r.x0+n[0]*r.res,this.y1=r.y1-n[1]*r.res,this.cellMerc=r.res*this.F,this.dx=this.cellMerc*r.groundScale,this.vao=e.createVertexArray(),this.progs={init:v(e,a),flux:v(e,o),depth:v(e,l),red0:v(e,s),red:v(e,c),probe:v(e,u),snap:v(e,f),encode:v(e,h)};const{W:d,H:m}=this;this.Z=p(e,d,m,"R32F"),this.P=p(e,d,m,"RGBA16F"),this.Gr=p(e,d,m,"RGBA32F"),this.Wf=p(e,d,m,"RG16F"),this.Hs=[p(e,d,m,"R32F"),p(e,d,m,"R32F")],this.Qs=[p(e,d,m,"RG32F"),p(e,d,m,"RG32F")],this.Ms=[p(e,d,m,"RGBA16F"),p(e,d,m,"RGBA16F")],this.fbInit=x(e,[this.Z,this.P,this.Gr,this.Wf]),this.fbQ=this.Qs.map(t=>x(e,[t])),this.fbHM=[x(e,[this.Hs[0],this.Ms[0]]),x(e,[this.Hs[1],this.Ms[1]])],this.fbHread=this.Hs.map(t=>x(e,[t])),this.fbMread=this.Ms.map(t=>x(e,[t])),this.red=[];let g=Math.ceil(d/8),w=Math.ceil(m/8);for(;;){const t=p(e,g,w,"RGBA32F");if(this.red.push({t,fb:x(e,[t])}),g*w<=256)break;g=Math.ceil(g/8),w=Math.ceil(w/8)}this.probeT=[p(e,1,1,"RGBA32F"),p(e,1,1,"RGBA32F"),p(e,1,1,"RGBA32F")],this.probeFb=x(e,this.probeT),this.snapS=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(d*m/16e5)))),this.snapW=Math.ceil(d/this.snapS),this.snapH=Math.ceil(m/this.snapS),this.maxSnaps=Math.max(12,Math.min(90,Math.floor(2e8/(this.snapW*this.snapH*8)))),this.snaps=[],this._uploadSources(t),this.buildGrid(i.buildings),this.reset()}_uploadSources(e){let t=this.gl,i=e.meta;this.src={lc:p(t,i.W,i.H,"R8UI",e.lc),bld:p(t,i.W,i.H,"R8UI",e.bld),riv:p(t,i.W,i.H,"R8UI",e.riv),dem:p(t,i.demW,i.demH,"R32F",e.dem)},this.fineBld=e.bld}_bind(e,t){let i=this.gl;i.useProgram(e.p);let r=0;for(let[a,o]of Object.entries(t))i.activeTexture(i.TEXTURE0+r),i.bindTexture(i.TEXTURE_2D,o.tex),i.uniform1i(e.u[a],r++)}_draw(e,t,i,r=1){let a=this.gl;a.bindFramebuffer(a.FRAMEBUFFER,e),a.drawBuffers(Array.from({length:r},(e,t)=>a.COLOR_ATTACHMENT0+t)),a.viewport(0,0,t,i),a.drawArrays(a.TRIANGLES,0,3)}_begin(){let e=this.gl;e.bindVertexArray(this.vao),e.disable(e.BLEND),e.disable(e.DEPTH_TEST),e.disable(e.STENCIL_TEST),e.disable(e.CULL_FACE),e.disable(e.SCISSOR_TEST),e.colorMask(!0,!0,!0,!0)}_end(){let e=this.gl;e.bindVertexArray(null),e.bindFramebuffer(e.FRAMEBUFFER,null)}buildGrid(e){let i=this.gl,r=this.progs.init,a=this.meta;this.buildingsOn=e,this._begin(),this._bind(r,{uLC:this.src.lc,uBld:this.src.bld,uRiv:this.src.riv,uDem:this.src.dem}),i.uniform1i(r.u.uF,this.F),i.uniform2i(r.u.uFine,a.W,a.H),i.uniform2i(r.u.uOff,this.off[0],this.off[1]),i.uniform1f(r.u.uDemF,a.demF),i.uniform1f(r.u.uBldOn,+!!e),i.uniform4fv(r.u.uLc,t.flatMap(e=>[e.n,e.f0,e.fc,e.s])),this._draw(this.fbInit,this.W,this.H,4),this._end(),this.gridVersion=++g}readGrid(){let e=this.gl,t=this.W,i=this.H,r=new Float32Array(t*i),a=new Float32Array(t*i),o=new Uint8Array(t*i),l=new Float32Array(256*t*4);for(let[n,s,c]of[[this.Gr,0,r],[this.Gr,2,a],[this.P,3,null]]){let r=x(e,[n]);e.readBuffer(e.COLOR_ATTACHMENT0);for(let r=0;r<i;r+=256){let a=Math.min(256,i-r);e.readPixels(0,r,t,a,e.RGBA,e.FLOAT,l);for(let e=0;e<t*a;e++)c?c[r*t+e]=l[4*e+s]:o[r*t+e]=+(l[4*e+s]>=.8)}e.deleteFramebuffer(r)}return e.bindFramebuffer(e.FRAMEBUFFER,null),{key:`g${this.gridVersion}`,W:t,H:i,ground:r,groundNat:a,bld:o,dx:this.dx,cellMerc:this.cellMerc,x0:this.x0,y1:this.y1,F:this.F,off:this.off,fineBld:this.fineBld,fineW:this.meta.W,fineH:this.meta.H}}encode(e,t,i,r,a=null){let o=this.gl,l=this.progs.encode,n=o.canvas;return this._begin(),this._bind(l,{uH:this.Hcur,uQ:this.Qcur,uM:this.Mcur,uSnap:a?a.t:this.Hcur}),o.uniform2i(l.u.uSize,this.W,this.H),o.uniform2i(l.u.uSnapSize,this.snapW,this.snapH),o.uniform1i(l.u.uSrc,e),o.uniform1i(l.u.uSnapS,this.snapS),o.uniform4fv(l.u.uWin,t),o.uniform2f(l.u.uOut,i,r),o.uniform1f(l.u.uCanvasH,n.height),o.bindFramebuffer(o.FRAMEBUFFER,null),o.viewport(0,n.height-r,i,r),o.drawArrays(o.TRIANGLES,0,3),o.bindVertexArray(null),{canvas:{width:n.width,height:n.height},source:n,win:t,ow:i,oh:r}}reset(){let e=this.gl;this._begin();for(let t=0;t<2;t++)e.bindFramebuffer(e.FRAMEBUFFER,this.fbHM[t]),e.drawBuffers([e.COLOR_ATTACHMENT0,e.COLOR_ATTACHMENT1]),e.clearBufferfv(e.COLOR,0,[0,0,0,0]),e.clearBufferfv(e.COLOR,1,[0,0,-1,0]),e.bindFramebuffer(e.FRAMEBUFFER,this.fbQ[t]),e.clearBufferfv(e.COLOR,0,[0,0,0,0]);for(let t of(this._end(),this.snaps))e.deleteTexture(t.t.tex);this.snaps=[],this.cur=0,this.t=0,this.steps=0,this.stats={hmax:0,vol:0,wet:0,vmax:0},this.rainVol=0,this.inflowVol=0,this.lastDt=0,this._dropAsync(),this.stepsAtStats=0}get Hcur(){return this.Hs[this.cur]}get Qcur(){return this.Qs[this.cur]}get Mcur(){return this.Ms[this.cur]}suggestDt(e=.7){let t=Math.sqrt(9.81*Math.max(1.25*this.stats.hmax,.05));return Math.min(e*this.dx/(t+Math.max(this.stats.vmax,t)),5)}step(e,t){let i=this.gl,r=this.cur,a=1-r;this._begin();let o=this.progs.flux;this._bind(o,{uH:this.Hs[r],uQ:this.Qs[r],uZ:this.Z,uP:this.P,uWf:this.Wf}),i.uniform1f(o.u.uDt,e),i.uniform1f(o.u.uDx,this.dx),i.uniform1f(o.u.uManMul,t.manning),i.uniform1f(o.u.uTheta,t.theta),i.uniform2fv(o.u.uWallE,t.wallE||[1,0]),i.uniform2i(o.u.uSize,this.W,this.H),this._draw(this.fbQ[a],this.W,this.H),o=this.progs.depth,this._bind(o,{uH:this.Hs[r],uQ:this.Qs[a],uP:this.P,uM:this.Ms[r],uGr:this.Gr,uZ:this.Z,uWf:this.Wf}),i.uniform1f(o.u.uDrain,(t.drain||0)/36e5),i.uniform1f(o.u.uManMul,t.manning),i.uniform1f(o.u.uDt,e),i.uniform1f(o.u.uDx,this.dx),i.uniform1f(o.u.uRain,t.rain),i.uniform1f(o.u.uT,this.t+e),i.uniform1f(o.u.uInfMul,t.infMul),i.uniform1f(o.u.uHortonK,t.hortonK),i.uniform1f(o.u.uTr,t.tr),i.uniform1f(o.u.uWet,t.wet||0),i.uniform4fv(o.u.uRainCircle,t.circle);let l=new Float32Array(32);for(let r of(t.inflows.slice(0,8).forEach((e,t)=>l.set(e,4*t)),i.uniform4fv(o.u.uInflow,l),i.uniform1i(o.u.uNInflow,Math.min(8,t.inflows.length)),i.uniform2i(o.u.uSize,this.W,this.H),this._draw(this.fbHM[a],this.W,this.H,2),this._end(),this.cur=a,this.t+=e,this.steps++,this.lastDt=e,this.rainVol+=t.rain*t.rainArea*e,t.inflows))this.inflowVol+=r[2]*e}reduce(){this._dropAsync(),this._reducePasses();let e=this.gl,t=this.red[this.red.length-1],i=new Float32Array(t.t.w*t.t.h*4);return e.bindFramebuffer(e.FRAMEBUFFER,t.fb),e.readBuffer(e.COLOR_ATTACHMENT0),e.readPixels(0,0,t.t.w,t.t.h,e.RGBA,e.FLOAT,i),this._end(),this._stats(i)}reduceStart(){if(this.reduceQ=this.reduceQ||[],this.reduceQ.length>=4)return!1;this._reducePasses();let e=this.gl,t=this.red[this.red.length-1],i=t.t.w*t.t.h*16;this.pbos=this.pbos||[];let r=new Set(this.reduceQ.map(e=>e.pbo)),a=this.pbos.find(e=>!r.has(e));return a||(a=e.createBuffer(),e.bindBuffer(e.PIXEL_PACK_BUFFER,a),e.bufferData(e.PIXEL_PACK_BUFFER,i,e.STREAM_READ),this.pbos.push(a)),e.bindBuffer(e.PIXEL_PACK_BUFFER,a),e.bindFramebuffer(e.FRAMEBUFFER,t.fb),e.readBuffer(e.COLOR_ATTACHMENT0),e.readPixels(0,0,t.t.w,t.t.h,e.RGBA,e.FLOAT,0),e.bindBuffer(e.PIXEL_PACK_BUFFER,null),this._end(),this.reduceQ.push({sync:e.fenceSync(e.SYNC_GPU_COMMANDS_COMPLETE,0),n:i/4,pbo:a,steps:this.steps}),e.flush(),!0}get reducePending(){return!!(this.reduceQ&&this.reduceQ.length)}get reduceInFlight(){return this.reduceQ?this.reduceQ.length:0}reducePoll(){let e=this.gl,t=this.reduceQ,i=null;for(;t&&t.length&&e.getSyncParameter(t[0].sync,e.SYNC_STATUS)===e.SIGNALED;)i=t.shift(),e.deleteSync(i.sync);if(!i)return!1;let r=new Float32Array(i.n);return e.bindBuffer(e.PIXEL_PACK_BUFFER,i.pbo),e.getBufferSubData(e.PIXEL_PACK_BUFFER,0,r),e.bindBuffer(e.PIXEL_PACK_BUFFER,null),this._stats(r),this.stepsAtStats=i.steps,!0}_dropAsync(){for(let e of this.reduceQ||[])this.gl.deleteSync(e.sync);this.reduceQ=[]}_reducePasses(){let e=this.gl;this._begin();let t=this.progs.red0;this._bind(t,{uH:this.Hcur,uQ:this.Qcur,uP:this.P}),e.uniform2i(t.u.uSize,this.W,this.H),e.uniform1i(t.u.uB,8),this._draw(this.red[0].fb,this.red[0].t.w,this.red[0].t.h);for(let i=1;i<this.red.length;i++){t=this.progs.red;let r=this.red[i-1].t;this._bind(t,{uS:r}),e.uniform2i(t.u.uSize,r.w,r.h),this._draw(this.red[i].fb,this.red[i].t.w,this.red[i].t.h)}}_stats(e){let t={hmax:0,vol:0,wet:0,vmax:0};for(let i=0;i<e.length;i+=4)t.hmax=Math.max(t.hmax,e[i]),t.vol+=e[i+1],t.wet+=e[i+2],t.vmax=Math.max(t.vmax,e[i+3]);return t.vol*=this.dx*this.dx,t.wetArea=t.wet*this.dx*this.dx,this.stats=t,this.stepsAtStats=this.steps,t}probe(e,t){let i=this.gl,r=this.progs.probe;this._begin(),this._bind(r,{uH:this.Hcur,uQ:this.Qcur,uZ:this.Z,uM:this.Mcur,uGr:this.Gr,uP:this.P}),i.uniform2i(r.u.uCell,e,t),this._draw(this.probeFb,1,1,3);let a=new Float32Array(4),o=new Float32Array(4),l=new Float32Array(4);return i.readBuffer(i.COLOR_ATTACHMENT0),i.readPixels(0,0,1,1,i.RGBA,i.FLOAT,a),i.readBuffer(i.COLOR_ATTACHMENT1),i.readPixels(0,0,1,1,i.RGBA,i.FLOAT,o),i.readBuffer(i.COLOR_ATTACHMENT2),i.readPixels(0,0,1,1,i.RGBA,i.FLOAT,l),i.readBuffer(i.COLOR_ATTACHMENT0),this._end(),{h:a[0],v:a[1],wse:a[2],z:l[0],building:l[1]>=.8,n:l[2],f0:l[3],hmax:o[0],vmax:o[1],arrival:o[2],hazard:o[3]}}snapshot(){if(this.snaps.length>=this.maxSnaps)return!1;let e=this.gl,t=this.progs.snap,i=p(e,this.snapW,this.snapH,"RGBA16F"),r=x(e,[i]);return this._begin(),this._bind(t,{uH:this.Hcur,uQ:this.Qcur}),e.uniform2i(t.u.uSize,this.W,this.H),e.uniform1i(t.u.uS,this.snapS),this._draw(r,this.snapW,this.snapH),this._end(),e.deleteFramebuffer(r),this.snaps.push({t:i,time:this.t}),!0}readLayer(e,t=0,i){let r=this.gl,a="max"===e?this.fbMread[this.cur]:this.fbHread[this.cur],o=new Float32Array(256*this.W*4);r.bindFramebuffer(r.FRAMEBUFFER,a),r.readBuffer(r.COLOR_ATTACHMENT0);for(let e=0;e<this.H;e+=256){let a=Math.min(256,this.H-e);r.readPixels(0,e,this.W,a,r.RGBA,r.FLOAT,o);let l=new Float32Array(this.W*a);for(let e=0;e<l.length;e++)l[e]=o[4*e+t];i(e,a,l)}r.bindFramebuffer(r.FRAMEBUFFER,null)}readTex(e,t=null){let i=this.gl,r=x(i,["h"===e?this.Hcur:"q"===e?this.Qcur:"p"===e?this.P:"gr"===e?this.Gr:"wf"===e?this.Wf:this.Z]);return t&&t.length===this.W*this.H*4||(t=new Float32Array(this.W*this.H*4)),i.bindFramebuffer(i.FRAMEBUFFER,r),i.readBuffer(i.COLOR_ATTACHMENT0),i.readPixels(0,0,this.W,this.H,i.RGBA,i.FLOAT,t),i.bindFramebuffer(i.FRAMEBUFFER,null),i.deleteFramebuffer(r),t}dispose(){let e=this.gl;[this.Z,this.P,this.Gr,this.Wf,...this.Hs,...this.Qs,...this.Ms,...this.probeT,...this.red.map(e=>e.t),...this.snaps.map(e=>e.t),...Object.values(this.src)].forEach(t=>e.deleteTexture(t.tex)),[this.fbInit,...this.fbQ,...this.fbHM,...this.fbHread,...this.fbMread,this.probeFb,...this.red.map(e=>e.fb)].forEach(t=>e.deleteFramebuffer(t)),Object.values(this.progs).forEach(t=>e.deleteProgram(t.p))}},"program",0,v,"texture",0,p],82990);let w=`
uniform sampler2D uEnc;      // packed window image
uniform vec4 uWin;           // window in grid cells: x0, y0, x1, y1
uniform vec2 uEncSize;       // used pixels of the packed image
uniform vec2 uEncTex;        // full texture size
uniform int uMode;           // 0 depth, 1 speed, 2 hazard, 3 max depth, 4 arrival
uniform float uThr, uOpacity, uTmax;
uniform float uCell;         // mercator metres per grid cell
uniform int uStyle;          // depth mode look: 0 analysis colours, 1 realistic water, 2 animated (game-like) water
uniform float uTime;         // seconds, drives ripples
uniform vec3 uSun;           // direction towards the sun
uniform int uArrows;         // 1 = draw flow-direction arrows on the water
uniform usampler2D uFB;      // fine (10 m) building raster
uniform vec3 uFB3;           // window origin on the fine grid x, y; cells per solver cell
uniform usampler2D uB;       // solver-cell building mask (walls — depth there is always 0)
uniform vec2 uGrid;
ivec3 raw(ivec2 p){ return ivec3(round(texelFetch(uEnc, clamp(p, ivec2(0), ivec2(uEncSize) - 1), 0).rgb * 255.0)); }
float depthOf(ivec3 r){ return float((r.x << 4) | (r.y >> 4)) / 100.0; }
vec2 velOf(ivec3 r){
  vec2 q = (vec2(float(((r.y & 15) << 2) | (r.z >> 6)), float(r.z & 63)) - 32.0) / 31.0;
  return sign(q) * q * q * 8.0;
}
float arrOf(ivec3 r){ return float(((r.y & 15) << 8) | r.z); }   // minutes, 4095 = never
vec2 encPos(vec2 g){ return (g - uWin.xy) / (uWin.zw - uWin.xy) * uEncSize; }
float depthAt(vec2 g){                     // bilinear depth
  vec2 p = encPos(g) - 0.5; ivec2 i = ivec2(floor(p)); vec2 t = p - vec2(i);
  return mix(mix(depthOf(raw(i)), depthOf(raw(i + ivec2(1, 0))), t.x),
             mix(depthOf(raw(i + ivec2(0, 1))), depthOf(raw(i + ivec2(1, 1))), t.x), t.y);
}
ivec3 rawAt(vec2 g){ return raw(ivec2(floor(encPos(g)))); }
// Барилгыг тооцсон гүн (хэрэглэгч 2026-10-09: "байшингийн гадна тал хайрцаглагдаад бн"). Барилгын нүдэнд
// (хана) гүн үргэлж 0 тул энгийн билинейр нь усыг бүтэн нэг нүдээр фасад руу аажим 0 болгож, ирмэг нь
// нүд нүдээрээ шатлагдаж байв. Барилгын нүдэн дээрх булангуудыг холилтоос ХАСНА — ус гүнээ фасад хүртэл
// хадгална; барилгын дотор (бүх булан хана) 0 — тэнд Esri-ийн барилгын олон өнцөгт усыг дардаг.
float bldEnc(ivec2 i){
  vec2 g = uWin.xy + (vec2(i) + 0.5) * (uWin.zw - uWin.xy) / uEncSize;
  return texelFetch(uB, clamp(ivec2(floor(g)), ivec2(0), ivec2(uGrid) - 1), 0).r > 0u ? 1.0 : 0.0;
}
float depthAtW(vec2 g){
  vec2 p = encPos(g) - 0.5; ivec2 i = ivec2(floor(p)); vec2 t = p - vec2(i);
  vec4 w = vec4((1.0 - t.x) * (1.0 - t.y), t.x * (1.0 - t.y), (1.0 - t.x) * t.y, t.x * t.y);
  w *= 1.0 - vec4(bldEnc(i), bldEnc(i + ivec2(1, 0)), bldEnc(i + ivec2(0, 1)), bldEnc(i + ivec2(1, 1)));
  float sw = w.x + w.y + w.z + w.w;
  if (sw <= 1e-4) return 0.0;
  return (w.x * depthOf(raw(i)) + w.y * depthOf(raw(i + ivec2(1, 0))) + w.z * depthOf(raw(i + ivec2(0, 1))) + w.w * depthOf(raw(i + ivec2(1, 1)))) / sw;
}
vec2 velAt(vec2 g){                        // bilinear flow vector
  vec2 p = encPos(g) - 0.5; ivec2 i = ivec2(floor(p)); vec2 t = p - vec2(i);
  return mix(mix(velOf(raw(i)), velOf(raw(i + ivec2(1, 0))), t.x), mix(velOf(raw(i + ivec2(0, 1))), velOf(raw(i + ivec2(1, 1))), t.x), t.y);
}
bool inWin(vec2 g){ return all(greaterThanEqual(g, uWin.xy)) && all(lessThan(g, uWin.zw)); }

vec3 ramp(float x, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, vec4 s){
  if (x < s.x) return mix(a, b, clamp(x / s.x, 0.0, 1.0));
  if (x < s.y) return mix(b, c, (x - s.x) / (s.y - s.x));
  if (x < s.z) return mix(c, d, (x - s.y) / (s.z - s.y));
  return mix(d, e, clamp((x - s.z) / (s.w - s.z), 0.0, 1.0));
}
vec3 depthCol(float d){ return ramp(d, vec3(0.62, 0.92, 1.0), vec3(0.25, 0.68, 1.0), vec3(0.08, 0.40, 0.90), vec3(0.05, 0.18, 0.65), vec3(0.22, 0.05, 0.45), vec4(0.3, 1.0, 2.0, 4.0)); }
vec3 speedCol(float v){ return ramp(v, vec3(0.25, 0.60, 1.0), vec3(0.20, 0.85, 0.55), vec3(1.0, 0.86, 0.2), vec3(1.0, 0.35, 0.15), vec3(0.70, 0.0, 0.35), vec4(0.5, 1.5, 3.0, 5.0)); }
vec3 hazardCol(float hr){
  if (hr < 0.75) return vec3(1.0, 0.92, 0.35);
  if (hr < 1.25) return vec3(1.0, 0.60, 0.15);
  if (hr < 2.0) return vec3(0.93, 0.20, 0.15);
  return vec3(0.55, 0.04, 0.28);
}
vec3 timeCol(float t){ float x = clamp(t / max(uTmax, 1.0), 0.0, 1.0);
  return ramp(x, vec3(0.85, 0.05, 0.25), vec3(1.0, 0.45, 0.1), vec3(1.0, 0.9, 0.3), vec3(0.3, 0.8, 0.9), vec3(0.2, 0.3, 0.9), vec4(0.15, 0.35, 0.6, 1.0)); }
float hash2(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
vec2 ripple(vec2 m){ float a = vnoise(m); return vec2(vnoise(m + vec2(0.5, 0.0)) - a, vnoise(m + vec2(0.0, 0.5)) - a) * 2.0; }
// realistic water: depth-tinted body, sky reflection (Fresnel), sun glint, ripples advected by the flow, foam on fast water
vec4 realWater(vec2 g, float d, vec2 v, vec3 V){
  vec2 m = vec2(g.x, -g.y) * uCell;
  vec2 drift = v * uTime;
  float sp = length(v);
  vec2 grad = ripple(m * 0.25 - drift * 0.25) * 0.7 + ripple(m * 0.8 + vec2(uTime * 0.35, uTime * 0.21)) * 0.3;
  vec3 N = normalize(vec3(-grad * (0.18 + clamp(sp * 0.25, 0.0, 0.6)), 1.0));
  vec3 shallow = vec3(0.20, 0.36, 0.44), deep = vec3(0.03, 0.08, 0.21);
  vec3 body = mix(shallow, deep, smoothstep(0.0, 1.6, d));
  vec3 sky = vec3(0.58, 0.68, 0.80);
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 H = normalize(normalize(uSun) + V);
  float spec = pow(max(dot(N, H), 0.0), 140.0) * 1.6;
  vec3 c = mix(body, sky, F * 0.75) + spec * vec3(1.0, 0.96, 0.86);
  float foam = smoothstep(1.2, 3.5, sp) * smoothstep(0.45, 0.8, vnoise(m * 0.9 - drift * 0.6));
  c = mix(c, vec3(0.92, 0.94, 0.95), foam * 0.6);
  float al = smoothstep(uThr, uThr * 2.0 + 0.02, d) * mix(0.78, 0.96, clamp(d / 0.8, 0.0, 1.0)) * uOpacity;
  return vec4(c * al, al);
}
// screen-space derivatives only exist in fragment shaders (DECODE is also compiled into vertex shaders)
float gPx = -1.0;                // 3D: metres per pixel from camera distance (set in FS_3D main)
#ifdef FRAG
// 2D: screen derivative. 3D: isotropic size from distance, so grazing angles don't smear the pattern
float pxSize(vec2 m){ return gPx > 0.0 ? gPx : max(length(fwidth(m)), 1e-3); }
#else
float pxSize(vec2 m){ return 1.0; }
#endif
// animated, game-like water: bright turquoise body, white foam streaks stretched along the flow and moving
// with it, ripples on still water, foam along the shore. Feature sizes grow with the
// on-screen pixel size, so zoomed-out views don't turn into noise.
// share of building under grid position g, smoothed over the fine cells (water is never drawn on a footprint)
float bldMask(vec2 g){
  vec2 f = uFB3.xy + g * uFB3.z - 0.5;
  ivec2 i = ivec2(floor(f)); vec2 t = smoothstep(0.25, 0.75, f - vec2(i));
  ivec2 s = textureSize(uFB, 0) - 1;
  float a = texelFetch(uFB, clamp(i, ivec2(0), s), 0).r > 0u ? 1.0 : 0.0;
  float b = texelFetch(uFB, clamp(i + ivec2(1, 0), ivec2(0), s), 0).r > 0u ? 1.0 : 0.0;
  float c = texelFetch(uFB, clamp(i + ivec2(0, 1), ivec2(0), s), 0).r > 0u ? 1.0 : 0.0;
  float d = texelFetch(uFB, clamp(i + ivec2(1, 1), ivec2(0), s), 0).r > 0u ? 1.0 : 0.0;
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
// Flow as drawn: the solver's velocity (one value per 10-20 m cell) bent around the 10 m building footprints.
// Near a wall the component pointing into the building is removed and the speed kept, so streaks and arrows
// slide along facades and turn round corners instead of running through them.
vec2 flowAt(vec2 g){
  vec2 v = velAt(g);
  if (uFB3.z <= 0.0) return v;
  float sp = length(v);
  if (sp < 1e-4) return v;
  vec2 n = vec2(0.0);
  for (int k = 1; k <= 2; k++) {               // building gradient at two radii (10 m, 20 m): smooth, reaches further
    float r = float(k) / uFB3.z;
    n += vec2(bldMask(g + vec2(r, 0.0)) - bldMask(g - vec2(r, 0.0)), bldMask(g + vec2(0.0, r)) - bldMask(g - vec2(0.0, r))) / float(k);
  }
  float ln = length(n);
  if (ln < 0.05) return v;
  n /= ln;                                    // points into the building
  float into = dot(v, n);
  if (into <= 0.0) return v;                  // already moving away from the wall
  vec2 t = v - n * into;
  float lt = length(t);
  vec2 tang = lt > 1e-4 ? t / lt : vec2(-n.y, n.x);
  float w = clamp(ln * 1.5, 0.0, 1.0);        // full effect right at the facade, fading over ~20 m
  return mix(v, tang * sp, w);
}
// value noise with its analytic gradient (x: value, yz: d/dp) — one evaluation gives a surface normal
vec3 vnoiseD(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
  float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}
// Animated water that reads as WATER (2026-10-09, хэрэглэгч: "eniig us shig haragduulay"). The previous look
// was an opaque turquoise sheet with big white paint-like streaks. Now:
//  \xb7 transparent in shallow places (the ground shows through), darker and denser with depth;
//  \xb7 the surface is a rippled height field advected along the flow (flow-map, three cross-faded layers,
//    ripples stretched along the current), lit from a fixed sky: light/dark facets + sky reflection + sun glints;
//  \xb7 foam only where the flow is really fast, thin and broken, plus a faint wet rim at the shore.
// Өнгөт (гүн): Pro-гийн Flood Simulation шиг усны гадарга дээрх ЦАЛГИА (хэрэглэгч 2026-10-09, зургаар:
// "gol ni iim tsulhentei ursah") — "Хөдөлгөөнт"-ын урсгалын дагуу зөөгдөх долгионы талбар (vnoiseD), гэхдээ
// өнгө солихгүй, зөвхөн ГЭРЭЛТЭЛТ: гүн, хурдан усанд тод, гүехэн тогтоол усанд бараг алга.
float rippleShade(vec2 g, float d, vec2 v){
  vec2 m = vec2(g.x, -g.y) * uCell;
  float px = pxSize(m);
  float sp = length(v), flow = clamp(sp / 1.5, 0.0, 1.0);
  float moving = smoothstep(0.02, 0.2, sp);
  vec2 dir = sp > 0.03 ? normalize(vec2(v.x, -v.y)) : normalize(vec2(0.8, 0.6));
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 ml = (g - uWin.xy) * vec2(1.0, -1.0) * uCell;
  float S = max(3.0, px * 5.0);                           // Pro-гийн нарийн цалгиа: ~5 px
  float stretch = 1.0 + 2.0 * moving;                     // долгионы НУРУУ урсгалд ХӨНДЛӨН сунана (Pro шиг)
  float spd = mix(0.1, 0.6 + 1.2 * flow, moving) * S;
  const float P = 2.4;
  vec2 grad = vec2(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float ph = fract(uTime / P + float(layer) / 3.0);
    float wgt = sin(3.14159265 * ph); wgt *= wgt * (2.0 / 3.0);
    vec2 q = ml - dir * spd * ph * P + float(layer) * vec2(37.1, 91.7);
    vec2 qa = vec2(dot(q, dir), dot(q, perp) / stretch);
    vec3 n1 = vnoiseD(qa / S);
    vec3 n2 = vnoiseD(qa / (S * 0.45) + 7.3);
    vec2 gq = n1.yz / S + n2.yz * 0.6 / (S * 0.45);
    grad += wgt * (dir * gq.x + perp * gq.y / stretch);
  }
  float amp = S * (0.14 + 0.18 * flow);
  vec3 N = normalize(vec3(-grad * amp, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  float k = smoothstep(0.15, 1.2, d) * (0.35 + 0.65 * flow);   // гүехэн, зогсонги усанд цалгиа бараг үгүй
  // Цалгиа ЗӨВХӨН ЦАГААН гялбаа (хэрэглэгч 2026-10-09: "хар биш цагаан"): гэрэл рүү харсан нуруу л
  // цайрна, сүүдэртэй тал нь усны өнгөө хэвээр үлдээнэ — бараан судал ОГТ гарахгүй.
  return clamp(k * max(dot(N, L) - L.z, 0.0) * 3.0, 0.0, 0.55);
}
vec4 gameWater(vec2 g, float d, vec2 v, vec3 V){
  vec2 m = vec2(g.x, -g.y) * uCell;                       // mercator metres, north up
  float px = pxSize(m);                                   // metres per screen pixel
  float sp = length(v), flow = clamp(sp / 1.5, 0.0, 1.0);
  float moving = smoothstep(0.02, 0.2, sp);               // 0 = standing pond, 1 = clearly flowing
  vec2 dir = sp > 0.03 ? normalize(vec2(v.x, -v.y)) : normalize(vec2(0.8, 0.6));   // ponds: slow wind drift
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 ml = (g - uWin.xy) * vec2(1.0, -1.0) * uCell;      // window-local metres (stable under small turns)
  float S = max(4.0, px * 9.0);                           // ripple wavelength: ~9 px on screen, never sub-pixel noise
  float stretch = 1.0 + 2.2 * moving;                     // current-drawn ripples are long along the flow
  float spd = mix(0.12, 0.7 + 1.4 * flow, moving) * S;    // drift, metres per second
  const float P = 2.4;
  vec2 grad = vec2(0.0); float foamN = 0.0;
  for (int layer = 0; layer < 3; layer++) {
    float ph = fract(uTime / P + float(layer) / 3.0);
    float wgt = sin(3.14159265 * ph); wgt *= wgt * (2.0 / 3.0);        // three sin^2 bumps sum to 1
    vec2 q = ml - dir * spd * ph * P + float(layer) * vec2(37.1, 91.7);
    vec2 qa = vec2(dot(q, dir) / stretch, dot(q, perp));
    vec3 n1 = vnoiseD(qa / S);
    vec3 n2 = vnoiseD(qa / (S * 0.42) + 7.3);
    vec2 gq = n1.yz / S + n2.yz * 0.55 / (S * 0.42);       // gradient in the stretched frame
    grad += wgt * (dir * gq.x / stretch + perp * gq.y);
    foamN += wgt * (0.6 * n2.x + 0.4 * n1.x);
  }
  float amp = S * (0.10 + 0.14 * flow + 0.06 * (1.0 - moving));
  vec3 N = normalize(vec3(-grad * amp, 1.0));
  // body colour: absorption with depth (a little silt in shallow flood water)
  vec3 shallow = vec3(0.34, 0.50, 0.50), mid = vec3(0.12, 0.33, 0.42), deep = vec3(0.04, 0.15, 0.27);
  vec3 body = mix(shallow, mid, smoothstep(0.05, 0.7, d));
  body = mix(body, deep, smoothstep(0.7, 2.5, d));
  // sky: zenith blue-grey, brighter towards the horizon; the tilted ripples reflect different parts of it
  vec3 R = reflect(-V, N);
  vec3 sky = mix(vec3(0.80, 0.86, 0.90), vec3(0.46, 0.60, 0.74), clamp(R.z, 0.0, 1.0));
  float F = 0.06 + 0.94 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
  F = clamp(F * 2.2 + 0.08, 0.0, 0.75);                   // top-down views need more reflection to read as a surface
  vec3 c = mix(body, sky, F);
  float facet = dot(N, normalize(vec3(-0.45, 0.55, 0.70)));
  c *= 0.86 + 0.28 * facet;                               // light / dark ripple facets
  vec3 L = normalize(vec3(0.42, 0.30, 0.86));            // fixed sun: glints sparkle on ripple crests
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 220.0) * (0.9 + 0.8 * flow);
  // foam: only fast water, broken streaks along the current; a faint lighter line at the shore
  float fast = smoothstep(0.9, 2.6, sp);
  float foam = fast * smoothstep(0.60, 0.80, foamN);
  float rim = 1.0 - smoothstep(uThr, uThr + 0.10, d);
  float shore = rim * 0.35 * smoothstep(0.45, 0.75, vnoise(m / max(2.0, px * 2.5) + uTime * 0.3));
  // цагаан хөөс, эргийн цайвар зураас, нарны гялбаа УНТАРСАН (хэрэглэгч 2026-10-12: цагаан бүхнийг хас)
  foam = 0.0; shore = 0.0; spec = 0.0;
  if (gPx > 0.0) c = mix(c, sky, F * 0.25);               // 3D: a little more sky at grazing angles
  // transparency: thin water lets the ground through, deep water hides it
  float al = smoothstep(uThr, uThr + 0.04, d) * mix(0.16, 0.92, smoothstep(0.03, 1.2, d));   // ТУРШИЛТ: нимгэн ус бараг тунгалаг
  al = max(al, foam * 0.85 * step(uThr, d));
  al *= max(uOpacity, 0.9);
  vec3 glint = spec * vec3(1.0, 0.97, 0.90) * smoothstep(uThr, uThr + 0.04, d);
  return vec4(min(c * al + glint, 1.0), min(al + spec * 0.5, 1.0));
}
// premultiplied water colour at grid position g (alpha 0 = dry); V = direction to the viewer
vec4 waterBody(vec2 g, vec3 V);
// Flow-direction arrows: one per screen tile (~34 px, power-of-two metres so the grid is stable while zooming
// and in 3D perspective), pointing downstream at the tile centre; longer and more opaque for faster flow.
vec4 arrowAt(vec2 g){
  vec2 ml = (g - uWin.xy) * vec2(1.0, -1.0) * uCell;      // metres, north up
  float px = pxSize(ml);
  float T = exp2(ceil(log2(px * 48.0)));                 // one arrow per ~48-96 px
  vec2 cm = (floor(ml / T) + 0.5) * T;
  vec2 gc = uWin.xy + cm * vec2(1.0, -1.0) / uCell;
  if (!inWin(gc) || depthAt(gc) <= max(uThr, 0.05)) return vec4(0.0);
  vec2 v = flowAt(gc);
  float sp = length(v);
  if (sp < 0.05) return vec4(0.0);
  vec2 dir = vec2(v.x, -v.y) / sp, perp = vec2(-dir.y, dir.x);
  float k = clamp(sp / 2.0, 0.0, 1.0);
  // жижиг сум (хэрэглэгч 2026-10-09: "chiglel zaaj bui sumiig jijighen bolgo") — зай нь хэвээр
  float len = T * mix(0.14, 0.22, k), head = T * 0.075, hw = T * 0.05, w = T * 0.016;
  vec2 lp = ml - cm;                                        // steady: motion is shown by the water itself
  float a = dot(lp, dir), c = abs(dot(lp, perp));
  float tip = len * 0.5, base = tip - head;
  float dShaft = max(abs(a + head * 0.5) - (len - head) * 0.5, c - w);
  float dHead = max(base - a, (c - hw * (tip - a) / head) * head / length(vec2(head, hw)));
  float dist = min(dShaft, dHead);
  float fill = 1.0 - smoothstep(-0.6 * px, 0.6 * px, dist);
  float edge = 1.0 - smoothstep(0.6 * px, 2.2 * px, dist);
  float fade = mix(0.75, 0.95, k);
  float al = max(fill * 0.85, edge * 0.4) * fade;
  vec3 col = mix(vec3(0.02, 0.12, 0.25), vec3(1.0), fill / max(max(fill, edge), 1e-3));
  return vec4(col * al, al);
}
vec4 withArrows(vec4 w, vec2 g){
  if (uArrows == 0 || uMode > 2 || w.a <= 0.0) return w;
  vec4 a = arrowAt(g);
  return a + w * (1.0 - a.a);
}
vec4 water(vec2 g, vec3 V){
  // 10 м-ийн растераар хайчлахаа больсон (хэрэглэгч 2026-10-09): растерын ирмэг барилгын бодит хил
  // (Esri-ийн олон өнцөгт) -ээс 10 м хүртэл зөрж ус барилгын гадна шатлагдсан хайрцаг болдог байв.
  // Барилгын олон өнцөгт усны ДЭЭР (2D: buildings2d давхарга, 3D: өргөсөн бие) зурагддаг тул дотор нь далдлагдана.
  return withArrows(waterBody(g, V), g);
}
vec4 waterBody(vec2 g, vec3 V){
  if (!inWin(g)) return vec4(0.0);
  float d = depthAtW(g);
  if (d <= uThr) return vec4(0.0);
  ivec3 r = rawAt(g);
  if (uStyle == 1 && uMode == 0) return realWater(g, d, velOf(r), V);
  if (uStyle == 2 && uMode == 0) return gameWater(g, d, flowAt(g), V);
  vec3 c;
  if (uMode == 0 || uMode == 3) c = depthCol(d);
  // цагаан цалгиа — хурд нь БИЛИНЕЙР (flowAt): нүд тутмын хурд (velOf) авахад цалгианы чиглэл,
  // далайц нүд бүрд огцом солигдож ус дөрвөлжин дөрвөлжин харагдаж байв (хэрэглэгч 2026-10-09, 3D зургаар)
  // цагаан цалгиа (rippleShade) УНТАРСАН (хэрэглэгч 2026-10-12: цагаан бүхнийг хас)
  if (uStyle == 0 && uMode == 0) {}
  else if (uMode == 1) c = speedCol(length(velOf(r)));
  else if (uMode == 2) c = hazardCol(d * (length(velOf(r)) + 0.5) + (d > 0.75 ? 1.0 : d > 0.25 ? 0.5 : 0.0));
  else { float a = arrOf(r); if (a >= 4095.0) return vec4(0.0); c = timeCol(a); }
  // Өнгөт (гүн): Pro-гийн Flood Simulation шиг ТУНГАЛАГ — доорх суурь зураг (гудамж, байшин) харагдана,
  // нимгэн ус 25 см-д аажим бүдгэрнэ; гүн рүү тунгалаг бус болно. Бусад горим хуучин нягтаараа.
  float al = (uStyle == 0 && uMode == 0)
    ? smoothstep(uThr, uThr + 0.25, d) * mix(0.42, 0.82, clamp(d / 2.0, 0.0, 1.0)) * uOpacity
    : smoothstep(uThr, uThr * 2.0 + 0.02, d) * mix(0.62, 0.92, clamp(d / 1.5, 0.0, 1.0)) * uOpacity;
  return vec4(c * al, al);
}
`,y=`#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp usampler2D;
`,F=y+`
uniform vec4 uWin; uniform float uCell; uniform vec4 uXf;   // clip = local * (sx, sy) + (ox, oy)
out vec2 vG;
void main(){
  vec2 uv = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vG = mix(uWin.xy, uWin.zw, uv);
  vec2 local = vec2(vG.x, -vG.y) * uCell;
  gl_Position = vec4(local * uXf.xy + uXf.zw, 0.0, 1.0);
}`,b=y+"#define FRAG\n"+w+`
uniform sampler2D uG;
uniform float uHill, uBld, uDx;
in vec2 vG; out vec4 o;
float Gz(ivec2 c){ return texelFetch(uG, clamp(c, ivec2(0), ivec2(uGrid) - 1), 0).r; }
float S(ivec2 c){ return Gz(c) + depthAtW(vec2(c) + 0.5); }   // усны гадаргын өндөр
void over(inout vec4 dst, vec4 src){ dst = src + dst * (1.0 - src.a); }
void main(){
  ivec2 c = ivec2(floor(vG));
  vec4 col = vec4(0.0);
  if (uHill > 0.0) {
    vec3 n = normalize(vec3((Gz(c - ivec2(1, 0)) - Gz(c + ivec2(1, 0))) / (2.0 * uDx),
                            (Gz(c + ivec2(0, 1)) - Gz(c - ivec2(0, 1))) / (2.0 * uDx), 1.0));
    float l = clamp(dot(n, normalize(vec3(-0.6, 0.6, 0.55))), 0.0, 1.0);
    over(col, vec4(vec3(l) * uHill, uHill));
  }
  if (uBld > 0.0 && texelFetch(uB, clamp(c, ivec2(0), ivec2(uGrid) - 1), 0).r > 0u) over(col, vec4(vec3(0.95, 0.55, 0.2) * 0.5, 0.5));
  vec4 w = water(vG, vec3(0.0, 0.0, 1.0));
  // Өнгөт (гүн): усны ГАДАРГЫГ (газар + гүн) гэрэлтүүлнэ — Pro-гийн зураг шиг гүехэн газарт арал, эрэг
  // сүүдэрлэж, тэгш гүн ус жигд үлдэнэ (хэрэглэгч 2026-10-09: "pro deer sain harwal 3dahi zurag shig").
  if (uStyle == 0 && uMode == 0 && w.a > 0.001) {
    float sl = S(c - ivec2(1, 0)) - S(c + ivec2(1, 0)), st = S(c + ivec2(0, 1)) - S(c - ivec2(0, 1));
    vec3 n = normalize(vec3(sl * 1.5 / (2.0 * uDx), st * 1.5 / (2.0 * uDx), 1.0));
    float k = clamp(dot(n, normalize(vec3(-0.6, 0.6, 0.55))), 0.0, 1.0) / 0.545;   // 1 = тэгш гадарга
    w.rgb *= clamp(0.35 + 0.65 * k, 0.3, 1.12);
  }
  over(col, w);
  o = col;
}`,E=y+w+`
layout(location = 0) in vec2 aUV;   // indexed draws need a real attribute (gl_VertexID is unreliable there on ANGLE/D3D11)
uniform mat4 uMVP;
uniform vec3 uEyeV;
uniform vec3 uMesh;          // origin x, y (grid cells, aligned to the vertex spacing), span (cells)
uniform sampler2D uG;
out vec2 vG; out vec3 vW;
void main(){
  // vertices sit on fixed grid lines (power-of-two spacing), so they don't slide over the terrain as the view moves
  vG = uMesh.xy + aUV * uMesh.z;
  vec2 gz = texelFetch(uG, clamp(ivec2(vG), ivec2(0), ivec2(uGrid) - 1), 0).rg;   // burned, natural ground
  float d = depthAtW(vG);              // барилгыг тооцсон — хана руу уруудахгүй
  // water in a carved channel is drawn at bank level (the 3D terrain has no trench), and lifted slightly
  // with camera distance so coarse terrain tiles don't cover it
  vec3 w = vec3(vG.x * uCell, -vG.y * uCell, max(gz.x + d, gz.y));
  vW = w + vec3(0.0, 0.0, 0.25 + 0.0015 * distance(w, uEyeV));
  gl_Position = uMVP * vec4(vW, 1.0);
}`,T=y+"#define FRAG\n"+w+`
uniform vec3 uEye;
uniform float uPxAng;        // radians per pixel
uniform vec4 uHole;          // grid-cell rect drawn by the fine pass (x1 < x0: none)
in vec2 vG; in vec3 vW; out vec4 o;
void main(){
  if (uHole.z > uHole.x && all(greaterThanEqual(vG, uHole.xy)) && all(lessThan(vG, uHole.zw))) discard;
  gPx = max(distance(uEye, vW) * uPxAng, 0.05);
  vec4 w = water(vG, normalize(uEye - vW)); if (w.a <= 0.001) discard; o = w;
}`,A=y+"#define FRAG\n"+w+`
uniform sampler2D uPs; uniform float uVisDt, uDx, uSeed;
out vec4 o;
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
vec2 vel(vec2 g){ if (!inWin(g)) return vec2(1e9); ivec3 r = rawAt(g); if (depthOf(r) < uThr) return vec2(1e9); return velOf(r); }
// Density is uniform over the screen, as in FlowRenderer: a tracer reborn at a random spot lives out its
// lifetime even where that spot is dry (invisible, not moving). Respawning only on wet cells packed all
// tracers into the few wet channels and painted them solid white.
void main(){
  vec4 p = texelFetch(uPs, ivec2(gl_FragCoord.xy), 0);
  if (p.z > p.w) {
    vec2 r = vec2(hash(gl_FragCoord.xy + uSeed), hash(gl_FragCoord.yx * 1.7 + uSeed * 1.3));
    p = vec4(mix(uWin.xy, uWin.zw, r), 0.0, 24.0 + 36.0 * hash(r * 91.7));
  } else {
    vec2 v = vel(p.xy);
    if (v.x < 1e8 && length(v) >= 0.05) p.xy += v / uDx * uVisDt;
    p.z += 1.0;
  }
  o = p;
}`,_=y+w+`
uniform sampler2D uPs, uG;
uniform int uPN, uIs3D; uniform float uDx, uTail;
uniform vec4 uXf; uniform mat4 uMVP;
out float vA;
void main(){
  int id = gl_VertexID >> 1, end = gl_VertexID & 1;
  vec4 p = texelFetch(uPs, ivec2(id % uPN, id / uPN), 0);
  ivec3 r = rawAt(p.xy);
  float d = depthOf(r);
  vec2 v = velOf(r);
  bool alive = p.z <= p.w && d > uThr && inWin(p.xy);
  vec2 g = p.xy - (end == 1 ? v / uDx * uTail : vec2(0.0));
  float fade = min(p.z / 6.0, 1.0) * min((p.w - p.z) / 6.0, 1.0);
  // FlowRenderer-like streamline: bright head fading to nothing along the trail, faint where the water is slow
  vA = alive ? (end == 0 ? 0.22 : 0.0) * fade * clamp(length(v) * 1.2, 0.15, 1.0) : 0.0;
  vec2 local = vec2(g.x, -g.y) * uCell;
  if (!alive) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  else if (uIs3D == 1) {
    vec2 gz = texelFetch(uG, clamp(ivec2(g), ivec2(0), ivec2(uGrid) - 1), 0).rg;
    float z = max(gz.x + d, gz.y) + 0.8;
    gl_Position = uMVP * vec4(local, z, 1.0);
  } else gl_Position = vec4(local * uXf.xy + uXf.zw, 0.0, 1.0);
}`,R=y+"in float vA; out vec4 o; void main(){ o = vec4(vec3(vA), vA); }",S=`#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;e.s(["WaterRenderer",0,class{constructor(e){if(this.gl=e,!e.getExtension("EXT_color_buffer_float"))throw Error("EXT_color_buffer_float дэмжигдэхгүй");this.p2d=v(e,b,F),this.p3d=v(e,T,E),this.pUpd=v(e,A,S),this.pPart=v(e,R,_),this.vao=e.createVertexArray(),this.slots={},this.meshes={},this.PN=48,this._cleanUnpack(),this.parts=[0,1].map(()=>{let t=this._tex();e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,this.PN,this.PN,0,e.RGBA,e.FLOAT,new Float32Array(this.PN*this.PN*4).fill(0).map((e,t)=>+(t%4==2)));let i=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,i),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),{t,fb:i}}),e.bindFramebuffer(e.FRAMEBUFFER,null),this.pi=0,this.gridKey=null}_cleanUnpack(){let e=this.gl;e.bindBuffer(e.PIXEL_UNPACK_BUFFER,null),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.NONE)}_tex(){let e=this.gl,t=e.createTexture();for(let[i,r]of(e.bindTexture(e.TEXTURE_2D,t),[[e.TEXTURE_MIN_FILTER,e.NEAREST],[e.TEXTURE_MAG_FILTER,e.NEAREST],[e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE],[e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE]]))e.texParameteri(e.TEXTURE_2D,i,r);return t}setGrid(e){if(this.gridKey===e.key)return;let t=this.gl;this.G&&(t.deleteTexture(this.G),t.deleteTexture(this.B)),this._cleanUnpack(),this.G=this._tex();let i=new Float32Array(e.W*e.H*2);for(let t=0;t<e.W*e.H;t++)i[2*t]=e.ground[t],i[2*t+1]=e.groundNat[t];t.texImage2D(t.TEXTURE_2D,0,t.RG32F,e.W,e.H,0,t.RG,t.FLOAT,i),this.B=this._tex(),t.texImage2D(t.TEXTURE_2D,0,t.R8UI,e.W,e.H,0,t.RED_INTEGER,t.UNSIGNED_BYTE,e.bld),e.fineBld&&this.fbSrc!==e.fineBld&&(this.FB&&t.deleteTexture(this.FB),this.FB=this._tex(),t.texImage2D(t.TEXTURE_2D,0,t.R8UI,e.fineW,e.fineH,0,t.RED_INTEGER,t.UNSIGNED_BYTE,e.fineBld),this.fbSrc=e.fineBld),this.grid=e,this.gridKey=e.key}upload(e,t=!1,i="main"){let r=this.slots[i]||(this.slots[i]={tex:this._tex(),has:!1});if(r.frame=e,t&&r.has)return;let a=this.gl;this._cleanUnpack(),a.bindTexture(a.TEXTURE_2D,r.tex);let o=e.image||e.source;a.texImage2D(a.TEXTURE_2D,0,a.RGBA8,a.RGBA,a.UNSIGNED_BYTE,o),e.image&&(e.image.close(),e.image=null),r.has=!0}_common(e,t,i="main"){let r=this.gl,a=this.slots[i],o=a.frame;r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,a.tex),r.uniform1i(e.u.uEnc,0),r.uniform4fv(e.u.uWin,o.win),r.uniform2f(e.u.uEncSize,o.ow,o.oh),e.u.uEncTex&&r.uniform2f(e.u.uEncTex,o.canvas.width,o.canvas.height),r.uniform1i(e.u.uMode,t.mode),r.uniform1f(e.u.uThr,t.thr),e.u.uOpacity&&r.uniform1f(e.u.uOpacity,t.opacity),e.u.uTmax&&r.uniform1f(e.u.uTmax,t.tmax),e.u.uCell&&r.uniform1f(e.u.uCell,this.grid.cellMerc),e.u.uStyle&&r.uniform1i(e.u.uStyle,t.waterStyle),e.u.uTime&&r.uniform1f(e.u.uTime,performance.now()/1e3%3600),e.u.uSun&&r.uniform3fv(e.u.uSun,t.sun||[.35,-.45,.82]),e.u.uArrows&&r.uniform1i(e.u.uArrows,+!!t.arrows)}_gridTex(e,t,i){let r=this.gl;if(e.u.uFB){r.activeTexture(r.TEXTURE0+i+1),r.bindTexture(r.TEXTURE_2D,this.FB),r.uniform1i(e.u.uFB,i+1);let t=this.grid;r.uniform3f(e.u.uFB3,t.off?t.off[0]:0,t.off?t.off[1]:0,this.FB?t.F||1:0)}e.u.uG&&(r.activeTexture(r.TEXTURE0+t),r.bindTexture(r.TEXTURE_2D,this.G),r.uniform1i(e.u.uG,t)),e.u.uB&&(r.activeTexture(r.TEXTURE0+i),r.bindTexture(r.TEXTURE_2D,this.B),r.uniform1i(e.u.uB,i)),e.u.uGrid&&r.uniform2f(e.u.uGrid,this.grid.W,this.grid.H)}updateParticles(e,t,i,r="main"){let a=this.gl,o=this.pUpd,l=this.pi,n=1-l;this.partSlot=r;let s=a.getParameter(a.VIEWPORT);a.bindVertexArray(this.vao),a.disable(a.BLEND),a.disable(a.DEPTH_TEST),a.useProgram(o.p),this._common(o,{...e,thr:Math.max(e.thr,.04)},r),a.activeTexture(a.TEXTURE1),a.bindTexture(a.TEXTURE_2D,this.parts[l].t),a.uniform1i(o.u.uPs,1),a.uniform1f(o.u.uVisDt,t),a.uniform1f(o.u.uDx,this.grid.dx),a.uniform1f(o.u.uSeed,1e3*Math.random()),a.bindFramebuffer(a.FRAMEBUFFER,this.parts[n].fb),a.viewport(0,0,this.PN,this.PN),a.drawArrays(a.TRIANGLES,0,3),this.pi=n,i(),a.viewport(s[0],s[1],s[2],s[3])}draw2D(e,t){let i=this.gl,r=this.p2d;i.bindVertexArray(this.vao),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i.disable(i.DEPTH_TEST),i.useProgram(r.p),this._common(r,e),this._gridTex(r,1,2),i.uniform1f(r.u.uCell,this.grid.cellMerc),i.uniform4fv(r.u.uXf,t),i.uniform1f(r.u.uHill,e.hill),i.uniform1f(r.u.uBld,+!!e.buildings),i.uniform1f(r.u.uDx,this.grid.dx),i.drawArrays(i.TRIANGLE_STRIP,0,4),e.particles&&e.mode<=2&&!e.history&&this._drawParticles(e,0,t,null),i.bindVertexArray(null)}_mesh(e){let t=this.gl;if(this.meshes[e])return this.meshes[e];let i=new Float32Array(e*e*2);for(let t=0;t<e;t++)for(let r=0;r<e;r++)i[(t*e+r)*2]=r/(e-1),i[(t*e+r)*2+1]=t/(e-1);let r=new Uint32Array((e-1)*(e-1)*6),a=0;for(let t=0;t<e-1;t++)for(let i=0;i<e-1;i++){let o=t*e+i;r.set([o,o+1,o+e,o+1,o+e+1,o+e],a),a+=6}let o=t.createVertexArray();t.bindVertexArray(o);let l=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,l),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0);let n=t.createBuffer();return t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,n),t.bufferData(t.ELEMENT_ARRAY_BUFFER,r,t.STATIC_DRAW),t.bindVertexArray(null),t.bindBuffer(t.ARRAY_BUFFER,null),this.meshes[e]={vao:o,count:r.length}}draw3D(e,t,i){let r=this.gl,a=this.p3d,o=(e,t)=>{let i=this.slots[e].frame.win,r=Math.max(i[2]-i[0],i[3]-i[1]),a=1;for(;r/a>t-2;)a*=2;let o=Math.floor(i[0]/a)*a,l=Math.floor(i[1]/a)*a,n=Math.min(t,Math.max(64,64*Math.ceil((Math.max(i[2]-o,i[3]-l)/a+1)/64)));return{N:n,origin:[o,l,(n-1)*a]}},l=this.slots.near?.frame?this.slots.near:null;r.enable(r.BLEND),r.blendFunc(r.ONE,r.ONE_MINUS_SRC_ALPHA),r.enable(r.DEPTH_TEST),r.depthFunc(r.LEQUAL),r.depthMask(!1),r.disable(r.CULL_FACE),r.useProgram(a.p),r.uniformMatrix4fv(a.u.uMVP,!1,t),r.uniform3fv(a.u.uEye,i),r.uniform3fv(a.u.uEyeV,i),r.uniform1f(a.u.uPxAng,e.pxAng||.0015);let n=[["main",512,l?l.frame.win:[0,0,-1,-1]]];for(let[t,i,s]of(l&&n.push(["near",768,[0,0,-1,-1]]),n)){let l=o(t,i),n=this._mesh(l.N);r.bindVertexArray(n.vao),this._common(a,e,t),this._gridTex(a,1,2),r.uniform3fv(a.u.uMesh,l.origin),r.uniform4fv(a.u.uHole,s),r.drawElements(r.TRIANGLES,n.count,r.UNSIGNED_INT,0)}r.bindVertexArray(this.vao),e.particles&&e.mode<=2&&!e.history&&this._drawParticles(e,1,[0,0,0,0],t),r.depthMask(!0),r.bindVertexArray(null)}_drawParticles(e,t,i,r){let a=this.gl,o=this.pPart;a.useProgram(o.p),this._common(o,{...e,thr:Math.max(e.thr,.04)},this.partSlot||"main"),a.activeTexture(a.TEXTURE1),a.bindTexture(a.TEXTURE_2D,this.parts[this.pi].t),a.uniform1i(o.u.uPs,1),this._gridTex(o,2,3),a.uniform1i(o.u.uPN,this.PN),a.uniform1i(o.u.uIs3D,t),a.uniform1f(o.u.uDx,this.grid.dx),a.uniform1f(o.u.uTail,6*e.visDt),a.uniform1f(o.u.uCell,this.grid.cellMerc),a.uniform4fv(o.u.uXf,i),a.uniformMatrix4fv(o.u.uMVP,!1,r||new Float32Array(16)),a.drawArrays(a.LINES,0,this.PN*this.PN*2)}}],31413);var D=e.i(64515);async function z(e=()=>{}){e("meta.json…");let t=await (await fetch((0,D.asset)("/flood/data/meta.json"))).json(),i=async(t,i)=>{e(`${i} ачаалж байна…`);let r=await fetch((0,D.asset)("/flood/data/"+t));if(!r.ok)throw Error(t+" олдсонгүй ("+r.status+")");let a=new Uint8Array(await r.arrayBuffer());if(31===a[0]&&139===a[1]){let e=new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip"));a=new Uint8Array(await new Response(e).arrayBuffer())}return a},r=await i("dem.f32","Өндрийн загвар (Copernicus GLO-30)"),a=new Float32Array(r.buffer,r.byteOffset,t.demW*t.demH),o=await i("lc.u8.gz","Газрын бүрхэвч (WorldCover)"),l=await i("bld.u8.gz","Барилга"),n=await i("riv.u8.gz","Гол горхи");return e("Тооцооны орчныг бэлтгэж байна…"),{meta:t,dem:a,lc:o,bld:l,riv:n}}e.s(["createSolverGL",0,function(){let e="u">typeof OffscreenCanvas?new OffscreenCanvas(1024,1024):Object.assign(document.createElement("canvas"),{width:1024,height:1024}),t=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!e.transferToImageBitmap,premultipliedAlpha:!1,powerPreference:"high-performance"});if(!t)throw Error("Энэ хөтөч WebGL2 дэмжихгүй байна. Chrome / Edge-ийн сүүлийн хувилбарыг ашиглана уу.");return t},"loadFloodData",0,z],91765)}]);