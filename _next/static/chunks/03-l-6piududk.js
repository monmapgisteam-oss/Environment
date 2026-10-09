(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,95103,e=>{"use strict";let t="https://js.arcgis.com/4.33/",i=null;e.s(["esriModules",0,function(e){return(window.require?Promise.resolve(window.require):i??=new Promise((e,r)=>{let a=document.documentElement,n=()=>`${t}esri/themes/${"light"!==a.dataset.theme?"dark":"light"}/main.css`,s=document.createElement("link");s.rel="stylesheet",s.href=n(),document.head.appendChild(s),new MutationObserver(()=>{s.href!==n()&&(s.href=n());let e="light"!==a.dataset.theme?"dark":"light";document.querySelectorAll(".calcite-mode-light, .calcite-mode-dark").forEach(t=>{t.classList.remove("calcite-mode-light","calcite-mode-dark"),t.classList.add(`calcite-mode-${e}`)})}).observe(a,{attributes:!0,attributeFilter:["data-theme"]});let o=document.createElement("script");o.src=`${t}init.js`,o.async=!0,o.onload=()=>{window.require?e(window.require):r(Error("ArcGIS SDK ачаалагдсангүй"))},o.onerror=()=>{i=null,r(Error("ArcGIS SDK татагдсангүй — сүлжээгээ шалгана уу"))},document.head.appendChild(o)})).then(t=>new Promise(i=>{t(e,(...e)=>i(e))}))}])},82990,91765,e=>{"use strict";let t=[{code:0,name:"Тодорхойгүй",n:.035,f0:30,fc:6,s:40},{code:10,name:"Ой мод",n:.1,f0:60,fc:15,s:80},{code:20,name:"Бут сөөг",n:.07,f0:50,fc:12,s:60},{code:30,name:"Бэлчээр, зүлэг",n:.035,f0:40,fc:8,s:50},{code:40,name:"Тариалан",n:.035,f0:40,fc:8,s:60},{code:50,name:"Барилгажсан",n:.02,f0:4,fc:1,s:15},{code:60,name:"Ил хөрс",n:.025,f0:25,fc:4,s:30},{code:70,name:"Цас, мөс",n:.02,f0:0,fc:0,s:0},{code:80,name:"Усан гадарга",n:.03,f0:0,fc:0,s:0},{code:90,name:"Намаг",n:.06,f0:5,fc:1,s:10},{code:100,name:"Хаг, хөвд",n:.04,f0:30,fc:6,s:40}],i=`#version 300 es
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
  // F <= 8 (8 is the coarse city grid of lib/soil-flood.ts; the view itself uses 1..3)
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
}`,n=r+`
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
}`,s=r+`
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
}`,o=`
float speed(ivec2 c, float h){
  if (h <= 0.05) return 0.0;
  vec2 q = texelFetch(uQ, c, 0).xy;
  float qw = c.x > 0 ? texelFetch(uQ, c - ivec2(1, 0), 0).x : q.x;
  float qn = c.y > 0 ? texelFetch(uQ, c - ivec2(0, 1), 0).y : q.y;
  return length(cellVel(vec2(qw + q.x, qn + q.y), h));
}`,u=r+`
uniform sampler2D uH, uQ, uP; uniform ivec2 uSize; uniform int uB;
out vec4 o;`+o+`
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
}`,l=r+`
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
}`,c=r+`
uniform sampler2D uH, uQ, uZ, uM, uGr, uP; uniform ivec2 uCell;
layout(location=0) out vec4 o;
layout(location=1) out vec4 o2;
layout(location=2) out vec4 o3;`+o+`
void main(){
  ivec2 c = uCell;
  float h = texelFetch(uH, c, 0).r;
  float spd = speed(c, h);
  float z = texelFetch(uZ, c, 0).r;
  o = vec4(h, spd, z + h, z);
  o2 = texelFetch(uM, c, 0);
  vec4 pp = texelFetch(uP, c, 0);
  o3 = vec4(texelFetch(uGr, c, 0).r, pp.a, pp.r, pp.g);   // bare ground, building fraction, Manning n, f0
}`,h=r+`
uniform sampler2D uH, uQ; uniform ivec2 uSize; uniform int uS;
out vec4 o;`+o+`
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
}`,f=r+`
uniform sampler2D uH, uQ, uM, uSnap;
uniform ivec2 uSize, uSnapSize;
uniform int uSrc;            // 0 live, 1 snapshot, 2 max envelope
uniform int uSnapS;
uniform vec4 uWin;           // grid cells
uniform vec2 uOut;           // ow, oh
uniform float uCanvasH;
out vec4 o;`+o+`
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
}`;function d(e,t,i){let r=e.createShader(t);if(e.shaderSource(r,i),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw console.error(i.split("\n").map((e,t)=>`${t+1}: ${e}`).join("\n")),Error("Shader compile error: "+t)}return r}function m(e,t,r=i){let a=e.createProgram();if(e.attachShader(a,d(e,e.VERTEX_SHADER,r)),e.attachShader(a,d(e,e.FRAGMENT_SHADER,t)),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS))throw Error("Link error: "+e.getProgramInfoLog(a));let n={},s=e.getProgramParameter(a,e.ACTIVE_UNIFORMS);for(let t=0;t<s;t++){let i=e.getActiveUniform(a,t);n[i.name.replace(/\[0\]$/,"")]=e.getUniformLocation(a,i.name)}return{p:a,u:n}}let p={R32F:["R32F","RED","FLOAT"],RG32F:["RG32F","RG","FLOAT"],RGBA32F:["RGBA32F","RGBA","FLOAT"],RGBA16F:["RGBA16F","RGBA","HALF_FLOAT"],RG16F:["RG16F","RG","HALF_FLOAT"],R8UI:["R8UI","RED_INTEGER","UNSIGNED_BYTE"]};function x(e,t,i,r,a=null){let[n,s,o]=p[r],u=e.createTexture();return e.bindTexture(e.TEXTURE_2D,u),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texStorage2D(e.TEXTURE_2D,1,e[n],t,i),a&&e.texSubImage2D(e.TEXTURE_2D,0,0,0,t,i,e[s],e[o],a),{tex:u,w:t,h:i,fmt:r}}function v(e,t){let i=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,i),t.forEach((t,i)=>e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+i,e.TEXTURE_2D,t.tex,0));let r=e.checkFramebufferStatus(e.FRAMEBUFFER);if(r!==e.FRAMEBUFFER_COMPLETE)throw Error("Framebuffer incomplete: 0x"+r.toString(16));return i}let F=0;e.s(["FloodSolver",0,class{constructor(e,t,i){if(this.gl=e,!e.getExtension("EXT_color_buffer_float"))throw Error("EXT_color_buffer_float дэмжигдэхгүй байна");const r=t.meta;this.meta=r,this.F=i.factor;const o=i.window||[0,0,r.W,r.H];this.window=o,this.off=[o[0],o[1]],this.W=Math.ceil((o[2]-o[0])/this.F),this.H=Math.ceil((o[3]-o[1])/this.F),this.x0=r.x0+o[0]*r.res,this.y1=r.y1-o[1]*r.res,this.cellMerc=r.res*this.F,this.dx=this.cellMerc*r.groundScale,this.vao=e.createVertexArray(),this.progs={init:m(e,a),flux:m(e,n),depth:m(e,s),red0:m(e,u),red:m(e,l),probe:m(e,c),snap:m(e,h),encode:m(e,f)};const{W:d,H:p}=this;this.Z=x(e,d,p,"R32F"),this.P=x(e,d,p,"RGBA16F"),this.Gr=x(e,d,p,"RGBA32F"),this.Wf=x(e,d,p,"RG16F"),this.Hs=[x(e,d,p,"R32F"),x(e,d,p,"R32F")],this.Qs=[x(e,d,p,"RG32F"),x(e,d,p,"RG32F")],this.Ms=[x(e,d,p,"RGBA16F"),x(e,d,p,"RGBA16F")],this.fbInit=v(e,[this.Z,this.P,this.Gr,this.Wf]),this.fbQ=this.Qs.map(t=>v(e,[t])),this.fbHM=[v(e,[this.Hs[0],this.Ms[0]]),v(e,[this.Hs[1],this.Ms[1]])],this.fbHread=this.Hs.map(t=>v(e,[t])),this.fbMread=this.Ms.map(t=>v(e,[t])),this.red=[];let F=Math.ceil(d/8),b=Math.ceil(p/8);for(;;){const t=x(e,F,b,"RGBA32F");if(this.red.push({t,fb:v(e,[t])}),F*b<=256)break;F=Math.ceil(F/8),b=Math.ceil(b/8)}this.probeT=[x(e,1,1,"RGBA32F"),x(e,1,1,"RGBA32F"),x(e,1,1,"RGBA32F")],this.probeFb=v(e,this.probeT),this.snapS=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(d*p/16e5)))),this.snapW=Math.ceil(d/this.snapS),this.snapH=Math.ceil(p/this.snapS),this.maxSnaps=Math.max(12,Math.min(90,Math.floor(2e8/(this.snapW*this.snapH*8)))),this.snaps=[],this._uploadSources(t),this.buildGrid(i.buildings),this.reset()}_uploadSources(e){let t=this.gl,i=e.meta;this.src={lc:x(t,i.W,i.H,"R8UI",e.lc),bld:x(t,i.W,i.H,"R8UI",e.bld),riv:x(t,i.W,i.H,"R8UI",e.riv),dem:x(t,i.demW,i.demH,"R32F",e.dem)},this.fineBld=e.bld}_bind(e,t){let i=this.gl;i.useProgram(e.p);let r=0;for(let[a,n]of Object.entries(t))i.activeTexture(i.TEXTURE0+r),i.bindTexture(i.TEXTURE_2D,n.tex),i.uniform1i(e.u[a],r++)}_draw(e,t,i,r=1){let a=this.gl;a.bindFramebuffer(a.FRAMEBUFFER,e),a.drawBuffers(Array.from({length:r},(e,t)=>a.COLOR_ATTACHMENT0+t)),a.viewport(0,0,t,i),a.drawArrays(a.TRIANGLES,0,3)}_begin(){let e=this.gl;e.bindVertexArray(this.vao),e.disable(e.BLEND),e.disable(e.DEPTH_TEST),e.disable(e.STENCIL_TEST),e.disable(e.CULL_FACE),e.disable(e.SCISSOR_TEST),e.colorMask(!0,!0,!0,!0)}_end(){let e=this.gl;e.bindVertexArray(null),e.bindFramebuffer(e.FRAMEBUFFER,null)}buildGrid(e){let i=this.gl,r=this.progs.init,a=this.meta;this.buildingsOn=e,this._begin(),this._bind(r,{uLC:this.src.lc,uBld:this.src.bld,uRiv:this.src.riv,uDem:this.src.dem}),i.uniform1i(r.u.uF,this.F),i.uniform2i(r.u.uFine,a.W,a.H),i.uniform2i(r.u.uOff,this.off[0],this.off[1]),i.uniform1f(r.u.uDemF,a.demF),i.uniform1f(r.u.uBldOn,+!!e),i.uniform4fv(r.u.uLc,t.flatMap(e=>[e.n,e.f0,e.fc,e.s])),this._draw(this.fbInit,this.W,this.H,4),this._end(),this.gridVersion=++F}readGrid(){let e=this.gl,t=this.W,i=this.H,r=new Float32Array(t*i),a=new Float32Array(t*i),n=new Uint8Array(t*i),s=new Float32Array(256*t*4);for(let[o,u,l]of[[this.Gr,0,r],[this.Gr,2,a],[this.P,3,null]]){let r=v(e,[o]);e.readBuffer(e.COLOR_ATTACHMENT0);for(let r=0;r<i;r+=256){let a=Math.min(256,i-r);e.readPixels(0,r,t,a,e.RGBA,e.FLOAT,s);for(let e=0;e<t*a;e++)l?l[r*t+e]=s[4*e+u]:n[r*t+e]=+(s[4*e+u]>=.8)}e.deleteFramebuffer(r)}return e.bindFramebuffer(e.FRAMEBUFFER,null),{key:`g${this.gridVersion}`,W:t,H:i,ground:r,groundNat:a,bld:n,dx:this.dx,cellMerc:this.cellMerc,x0:this.x0,y1:this.y1,F:this.F,off:this.off,fineBld:this.fineBld,fineW:this.meta.W,fineH:this.meta.H}}encode(e,t,i,r,a=null){let n=this.gl,s=this.progs.encode,o=n.canvas;return this._begin(),this._bind(s,{uH:this.Hcur,uQ:this.Qcur,uM:this.Mcur,uSnap:a?a.t:this.Hcur}),n.uniform2i(s.u.uSize,this.W,this.H),n.uniform2i(s.u.uSnapSize,this.snapW,this.snapH),n.uniform1i(s.u.uSrc,e),n.uniform1i(s.u.uSnapS,this.snapS),n.uniform4fv(s.u.uWin,t),n.uniform2f(s.u.uOut,i,r),n.uniform1f(s.u.uCanvasH,o.height),n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,o.height-r,i,r),n.drawArrays(n.TRIANGLES,0,3),n.bindVertexArray(null),{canvas:{width:o.width,height:o.height},source:o,win:t,ow:i,oh:r}}reset(){let e=this.gl;this._begin();for(let t=0;t<2;t++)e.bindFramebuffer(e.FRAMEBUFFER,this.fbHM[t]),e.drawBuffers([e.COLOR_ATTACHMENT0,e.COLOR_ATTACHMENT1]),e.clearBufferfv(e.COLOR,0,[0,0,0,0]),e.clearBufferfv(e.COLOR,1,[0,0,-1,0]),e.bindFramebuffer(e.FRAMEBUFFER,this.fbQ[t]),e.clearBufferfv(e.COLOR,0,[0,0,0,0]);for(let t of(this._end(),this.snaps))e.deleteTexture(t.t.tex);this.snaps=[],this.cur=0,this.t=0,this.steps=0,this.stats={hmax:0,vol:0,wet:0,vmax:0},this.rainVol=0,this.inflowVol=0,this.lastDt=0,this._dropAsync(),this.stepsAtStats=0}get Hcur(){return this.Hs[this.cur]}get Qcur(){return this.Qs[this.cur]}get Mcur(){return this.Ms[this.cur]}suggestDt(e=.7){let t=Math.sqrt(9.81*Math.max(1.25*this.stats.hmax,.05));return Math.min(e*this.dx/(t+Math.max(this.stats.vmax,t)),5)}step(e,t){let i=this.gl,r=this.cur,a=1-r;this._begin();let n=this.progs.flux;this._bind(n,{uH:this.Hs[r],uQ:this.Qs[r],uZ:this.Z,uP:this.P,uWf:this.Wf}),i.uniform1f(n.u.uDt,e),i.uniform1f(n.u.uDx,this.dx),i.uniform1f(n.u.uManMul,t.manning),i.uniform1f(n.u.uTheta,t.theta),i.uniform2fv(n.u.uWallE,t.wallE||[1,0]),i.uniform2i(n.u.uSize,this.W,this.H),this._draw(this.fbQ[a],this.W,this.H),n=this.progs.depth,this._bind(n,{uH:this.Hs[r],uQ:this.Qs[a],uP:this.P,uM:this.Ms[r],uGr:this.Gr,uZ:this.Z,uWf:this.Wf}),i.uniform1f(n.u.uDrain,(t.drain||0)/36e5),i.uniform1f(n.u.uManMul,t.manning),i.uniform1f(n.u.uDt,e),i.uniform1f(n.u.uDx,this.dx),i.uniform1f(n.u.uRain,t.rain),i.uniform1f(n.u.uT,this.t+e),i.uniform1f(n.u.uInfMul,t.infMul),i.uniform1f(n.u.uHortonK,t.hortonK),i.uniform1f(n.u.uTr,t.tr),i.uniform1f(n.u.uWet,t.wet||0),i.uniform4fv(n.u.uRainCircle,t.circle);let s=new Float32Array(32);for(let r of(t.inflows.slice(0,8).forEach((e,t)=>s.set(e,4*t)),i.uniform4fv(n.u.uInflow,s),i.uniform1i(n.u.uNInflow,Math.min(8,t.inflows.length)),i.uniform2i(n.u.uSize,this.W,this.H),this._draw(this.fbHM[a],this.W,this.H,2),this._end(),this.cur=a,this.t+=e,this.steps++,this.lastDt=e,this.rainVol+=t.rain*t.rainArea*e,t.inflows))this.inflowVol+=r[2]*e}reduce(){this._dropAsync(),this._reducePasses();let e=this.gl,t=this.red[this.red.length-1],i=new Float32Array(t.t.w*t.t.h*4);return e.bindFramebuffer(e.FRAMEBUFFER,t.fb),e.readBuffer(e.COLOR_ATTACHMENT0),e.readPixels(0,0,t.t.w,t.t.h,e.RGBA,e.FLOAT,i),this._end(),this._stats(i)}reduceStart(){if(this.reduceQ=this.reduceQ||[],this.reduceQ.length>=4)return!1;this._reducePasses();let e=this.gl,t=this.red[this.red.length-1],i=t.t.w*t.t.h*16;this.pbos=this.pbos||[];let r=new Set(this.reduceQ.map(e=>e.pbo)),a=this.pbos.find(e=>!r.has(e));return a||(a=e.createBuffer(),e.bindBuffer(e.PIXEL_PACK_BUFFER,a),e.bufferData(e.PIXEL_PACK_BUFFER,i,e.STREAM_READ),this.pbos.push(a)),e.bindBuffer(e.PIXEL_PACK_BUFFER,a),e.bindFramebuffer(e.FRAMEBUFFER,t.fb),e.readBuffer(e.COLOR_ATTACHMENT0),e.readPixels(0,0,t.t.w,t.t.h,e.RGBA,e.FLOAT,0),e.bindBuffer(e.PIXEL_PACK_BUFFER,null),this._end(),this.reduceQ.push({sync:e.fenceSync(e.SYNC_GPU_COMMANDS_COMPLETE,0),n:i/4,pbo:a,steps:this.steps}),e.flush(),!0}get reducePending(){return!!(this.reduceQ&&this.reduceQ.length)}get reduceInFlight(){return this.reduceQ?this.reduceQ.length:0}reducePoll(){let e=this.gl,t=this.reduceQ,i=null;for(;t&&t.length&&e.getSyncParameter(t[0].sync,e.SYNC_STATUS)===e.SIGNALED;)i=t.shift(),e.deleteSync(i.sync);if(!i)return!1;let r=new Float32Array(i.n);return e.bindBuffer(e.PIXEL_PACK_BUFFER,i.pbo),e.getBufferSubData(e.PIXEL_PACK_BUFFER,0,r),e.bindBuffer(e.PIXEL_PACK_BUFFER,null),this._stats(r),this.stepsAtStats=i.steps,!0}_dropAsync(){for(let e of this.reduceQ||[])this.gl.deleteSync(e.sync);this.reduceQ=[]}_reducePasses(){let e=this.gl;this._begin();let t=this.progs.red0;this._bind(t,{uH:this.Hcur,uQ:this.Qcur,uP:this.P}),e.uniform2i(t.u.uSize,this.W,this.H),e.uniform1i(t.u.uB,8),this._draw(this.red[0].fb,this.red[0].t.w,this.red[0].t.h);for(let i=1;i<this.red.length;i++){t=this.progs.red;let r=this.red[i-1].t;this._bind(t,{uS:r}),e.uniform2i(t.u.uSize,r.w,r.h),this._draw(this.red[i].fb,this.red[i].t.w,this.red[i].t.h)}}_stats(e){let t={hmax:0,vol:0,wet:0,vmax:0};for(let i=0;i<e.length;i+=4)t.hmax=Math.max(t.hmax,e[i]),t.vol+=e[i+1],t.wet+=e[i+2],t.vmax=Math.max(t.vmax,e[i+3]);return t.vol*=this.dx*this.dx,t.wetArea=t.wet*this.dx*this.dx,this.stats=t,this.stepsAtStats=this.steps,t}probe(e,t){let i=this.gl,r=this.progs.probe;this._begin(),this._bind(r,{uH:this.Hcur,uQ:this.Qcur,uZ:this.Z,uM:this.Mcur,uGr:this.Gr,uP:this.P}),i.uniform2i(r.u.uCell,e,t),this._draw(this.probeFb,1,1,3);let a=new Float32Array(4),n=new Float32Array(4),s=new Float32Array(4);return i.readBuffer(i.COLOR_ATTACHMENT0),i.readPixels(0,0,1,1,i.RGBA,i.FLOAT,a),i.readBuffer(i.COLOR_ATTACHMENT1),i.readPixels(0,0,1,1,i.RGBA,i.FLOAT,n),i.readBuffer(i.COLOR_ATTACHMENT2),i.readPixels(0,0,1,1,i.RGBA,i.FLOAT,s),i.readBuffer(i.COLOR_ATTACHMENT0),this._end(),{h:a[0],v:a[1],wse:a[2],z:s[0],building:s[1]>=.8,n:s[2],f0:s[3],hmax:n[0],vmax:n[1],arrival:n[2],hazard:n[3]}}snapshot(){if(this.snaps.length>=this.maxSnaps)return!1;let e=this.gl,t=this.progs.snap,i=x(e,this.snapW,this.snapH,"RGBA16F"),r=v(e,[i]);return this._begin(),this._bind(t,{uH:this.Hcur,uQ:this.Qcur}),e.uniform2i(t.u.uSize,this.W,this.H),e.uniform1i(t.u.uS,this.snapS),this._draw(r,this.snapW,this.snapH),this._end(),e.deleteFramebuffer(r),this.snaps.push({t:i,time:this.t}),!0}readLayer(e,t=0,i){let r=this.gl,a="max"===e?this.fbMread[this.cur]:this.fbHread[this.cur],n=new Float32Array(256*this.W*4);r.bindFramebuffer(r.FRAMEBUFFER,a),r.readBuffer(r.COLOR_ATTACHMENT0);for(let e=0;e<this.H;e+=256){let a=Math.min(256,this.H-e);r.readPixels(0,e,this.W,a,r.RGBA,r.FLOAT,n);let s=new Float32Array(this.W*a);for(let e=0;e<s.length;e++)s[e]=n[4*e+t];i(e,a,s)}r.bindFramebuffer(r.FRAMEBUFFER,null)}readTex(e,t=null){let i=this.gl,r=v(i,["h"===e?this.Hcur:"q"===e?this.Qcur:"p"===e?this.P:"gr"===e?this.Gr:"wf"===e?this.Wf:this.Z]);return t&&t.length===this.W*this.H*4||(t=new Float32Array(this.W*this.H*4)),i.bindFramebuffer(i.FRAMEBUFFER,r),i.readBuffer(i.COLOR_ATTACHMENT0),i.readPixels(0,0,this.W,this.H,i.RGBA,i.FLOAT,t),i.bindFramebuffer(i.FRAMEBUFFER,null),i.deleteFramebuffer(r),t}dispose(){let e=this.gl;[this.Z,this.P,this.Gr,this.Wf,...this.Hs,...this.Qs,...this.Ms,...this.probeT,...this.red.map(e=>e.t),...this.snaps.map(e=>e.t),...Object.values(this.src)].forEach(t=>e.deleteTexture(t.tex)),[this.fbInit,...this.fbQ,...this.fbHM,...this.fbHread,...this.fbMread,this.probeFb,...this.red.map(e=>e.fb)].forEach(t=>e.deleteFramebuffer(t)),Object.values(this.progs).forEach(t=>e.deleteProgram(t.p))}},"program",0,m,"texture",0,x],82990);var b=e.i(64515);async function g(e=()=>{}){e("meta.json…");let t=await (await fetch((0,b.asset)("/flood/data/meta.json"))).json(),i=async(t,i)=>{e(`${i} ачаалж байна…`);let r=await fetch((0,b.asset)("/flood/data/"+t));if(!r.ok)throw Error(t+" олдсонгүй ("+r.status+")");let a=new Uint8Array(await r.arrayBuffer());if(31===a[0]&&139===a[1]){let e=new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip"));a=new Uint8Array(await new Response(e).arrayBuffer())}return a},r=await i("dem.f32","Өндрийн загвар (Copernicus GLO-30)"),a=new Float32Array(r.buffer,r.byteOffset,t.demW*t.demH),n=await i("lc.u8.gz","Газрын бүрхэвч (WorldCover)"),s=await i("bld.u8.gz","Барилга"),o=await i("riv.u8.gz","Гол горхи");return e("GPU бэлтгэж байна…"),{meta:t,dem:a,lc:n,bld:s,riv:o}}e.s(["createSolverGL",0,function(){let e="u">typeof OffscreenCanvas?new OffscreenCanvas(1024,1024):Object.assign(document.createElement("canvas"),{width:1024,height:1024}),t=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!e.transferToImageBitmap,premultipliedAlpha:!1,powerPreference:"high-performance"});if(!t)throw Error("Энэ хөтөч WebGL2 дэмжихгүй байна. Chrome / Edge-ийн сүүлийн хувилбарыг ашиглана уу.");return t},"loadFloodData",0,g],91765)}]);