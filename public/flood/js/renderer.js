// View-side water rendering, shared by the 2D ArcGIS layer view and the 3D SceneView render node.
//
// The solver runs in its own WebGL context. Each frame it packs the visible window of the grid into an
// RGB8 image on its canvas (depth 12 bit + flow vector 2×6 bit, or max depth + arrival time); this module
// uploads that canvas into the view's context and draws coloured water, flow tracers and (2D) hillshade.
import { program } from './solver.js';

const DECODE = `
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
vec4 gameWater(vec2 g, float d, vec2 v, vec3 V){
  vec2 m = vec2(g.x, -g.y) * uCell;                       // mercator metres, north up
  float px = pxSize(m);                                   // metres per screen pixel
  float sp = length(v), flow = clamp(sp / 1.5, 0.0, 1.0);
  float moving = smoothstep(0.01, 0.12, sp);              // 0 = standing pond, 1 = clearly flowing
  vec2 dir = sp > 0.03 ? normalize(vec2(v.x, -v.y)) : vec2(1.0, 0.0);
  float L = max(30.0, px * 38.0), Wd = L / 4.5;          // streak length / width: big, game-like strokes
  vec3 shallow = vec3(0.30, 0.72, 0.86), mid = vec3(0.11, 0.48, 0.78), deep = vec3(0.05, 0.25, 0.56);
  vec3 c = mix(shallow, mid, smoothstep(0.05, 0.6, d));
  c = mix(c, deep, smoothstep(0.6, 2.5, d));
  // Flow-map animation: two foam layers advected along the local flow, each restarting every P seconds,
  // cross-faded half a period apart. Each foam sample is smeared along the flow -> streaks.
  // Coordinates are local to the window (absolute mercator metres would turn small direction changes into noise).
  vec2 ml = (g - uWin.xy) * vec2(1.0, -1.0) * uCell;
  // Smooth flow-map animation: three foam layers, phase-shifted by a third of a period, each fading in and out
  // with sin^2 weights (constant total), so nothing pops. Short displacement per period keeps curved channels
  // from shearing the pattern into drawn-looking swirls.
  float spd = 0.9 + 1.8 * flow;                           // streak lengths per second (~35-100 px/s on screen)
  vec2 vis = dir * spd * L;
  const float P = 2.0;
  float streak = 0.0, band = 0.0;
  for (int layer = 0; layer < 3; layer++) {
    float ph = fract(uTime / P + float(layer) / 3.0);
    float wgt = sin(3.14159265 * ph); wgt *= wgt * (2.0 / 3.0);        // three sin^2 bumps sum to 1
    vec2 q = ml - vis * ph * P + float(layer) * vec2(37.1, 91.7);
    // three taps smeared along the flow per scale (fragment cost matters: this runs for every water pixel)
    float n1 = 0.0, n2 = 0.0;
    for (int k = 0; k < 3; k++) {
      n1 += vnoise((q - dir * float(k) * 0.36 * L) / (0.32 * L));
      n2 += vnoise((q - dir * float(k) * 0.20 * L) / (0.16 * L) + 13.7);
    }
    streak += wgt * (0.9 * smoothstep(0.50, 0.66, n1 / 3.0) + 0.5 * smoothstep(0.54, 0.70, n2 / 3.0));
    band += wgt * vnoise(q / (2.5 * L));
  }
  streak *= moving * mix(0.85, 1.0, flow);
  c *= 1.0 + 0.4 * (band - 0.5) * moving;               // broad light/dark patches sliding downstream
  // standing water: slowly drifting ripples
  float rip = smoothstep(0.66, 0.88, vnoise(m / max(6.0, px * 5.0) + vec2(uTime * 0.45, uTime * 0.31))) * (1.0 - moving);
  float rim = 1.0 - smoothstep(uThr, uThr + 0.08, d);   // thin water at the edge
  float shore = rim * (0.2 + 0.25 * vnoise(m / max(3.0, px * 3.0) + uTime * 0.5));
  c = mix(c, vec3(1.0), clamp(streak * 0.85 + rip * 0.25 + shore * 0.5, 0.0, 1.0));
  c = mix(c, deep * 0.8, rim * 0.35);                    // darker rim keeps the outline readable on light maps
  float F = 0.02 + 0.98 * pow(1.0 - clamp(V.z, 0.0, 1.0), 5.0);   // a little sky at grazing angles (3D)
  c = mix(c, vec3(0.80, 0.92, 1.0), F * 0.35);
  if (gPx > 0.0) {
    // 3D: ripple normal advected with the flow -> moving sun glints and light/dark facets
    vec2 rq = ml - vis * fract(uTime / P) * P;
    float e = 0.18 * L;
    float h0 = vnoise(rq / (0.9 * L)), hx = vnoise((rq + vec2(e, 0.0)) / (0.9 * L)), hy = vnoise((rq + vec2(0.0, e)) / (0.9 * L));
    vec3 N = normalize(vec3(-(hx - h0), -(hy - h0), 0.6 + 0.4 * (1.0 - moving)));
    vec3 Hh = normalize(normalize(uSun) + V);
    float spec = pow(max(dot(N, Hh), 0.0), 24.0) * 0.35 * moving;
    float shade = 0.88 + 0.24 * dot(N, normalize(vec3(0.3, -0.4, 0.85)));
    c = c * shade + spec * vec3(1.0, 0.97, 0.9);
  }
  float al = smoothstep(uThr, uThr * 1.5 + 0.01, d) * mix(0.92, 0.98, clamp(d / 0.5, 0.0, 1.0)) * max(uOpacity, 0.9);
  return vec4(min(c, 1.0) * al, al);
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
  float len = T * mix(0.24, 0.40, k), head = T * 0.13, hw = T * 0.09, w = T * 0.025;
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
  vec4 w = withArrows(waterBody(g, V), g);
  if (uFB3.z > 0.0) w *= 1.0 - smoothstep(0.35, 0.65, bldMask(g));
  return w;
}
vec4 waterBody(vec2 g, vec3 V){
  if (!inWin(g)) return vec4(0.0);
  float d = depthAt(g);
  if (d <= uThr) return vec4(0.0);
  ivec3 r = rawAt(g);
  if (uStyle == 1 && uMode == 0) return realWater(g, d, velOf(r), V);
  if (uStyle == 2 && uMode == 0) return gameWater(g, d, flowAt(g), V);
  vec3 c;
  if (uMode == 0 || uMode == 3) c = depthCol(d);
  else if (uMode == 1) c = speedCol(length(velOf(r)));
  else if (uMode == 2) c = hazardCol(d * (length(velOf(r)) + 0.5) + (d > 0.75 ? 1.0 : d > 0.25 ? 0.5 : 0.0));
  else { float a = arrOf(r); if (a >= 4095.0) return vec4(0.0); c = timeCol(a); }
  float al = smoothstep(uThr, uThr * 2.0 + 0.02, d) * mix(0.62, 0.92, clamp(d / 1.5, 0.0, 1.0)) * uOpacity;
  return vec4(c * al, al);
}
`;

const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp usampler2D;
`;

// ---------------- 2D: one quad over the window
const VS_2D = HEAD + `
uniform vec4 uWin; uniform float uCell; uniform vec4 uXf;   // clip = local * (sx, sy) + (ox, oy)
out vec2 vG;
void main(){
  vec2 uv = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vG = mix(uWin.xy, uWin.zw, uv);
  vec2 local = vec2(vG.x, -vG.y) * uCell;
  gl_Position = vec4(local * uXf.xy + uXf.zw, 0.0, 1.0);
}`;
const FS_2D = HEAD + '#define FRAG' + String.fromCharCode(10) + DECODE + `
uniform sampler2D uG; uniform usampler2D uB;
uniform float uHill, uBld, uDx;
uniform vec2 uGrid;
in vec2 vG; out vec4 o;
float Gz(ivec2 c){ return texelFetch(uG, clamp(c, ivec2(0), ivec2(uGrid) - 1), 0).r; }
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
  over(col, water(vG, vec3(0.0, 0.0, 1.0)));
  o = col;
}`;

// ---------------- 3D: displaced grid mesh over the window
const VS_3D = HEAD + DECODE + `
layout(location = 0) in vec2 aUV;   // indexed draws need a real attribute (gl_VertexID is unreliable there on ANGLE/D3D11)
uniform mat4 uMVP;
uniform vec3 uEyeV;
uniform vec3 uMesh;          // origin x, y (grid cells, aligned to the vertex spacing), span (cells)
uniform sampler2D uG; uniform vec2 uGrid;
out vec2 vG; out vec3 vW;
void main(){
  // vertices sit on fixed grid lines (power-of-two spacing), so they don't slide over the terrain as the view moves
  vG = uMesh.xy + aUV * uMesh.z;
  vec2 gz = texelFetch(uG, clamp(ivec2(vG), ivec2(0), ivec2(uGrid) - 1), 0).rg;   // burned, natural ground
  float d = depthOf(rawAt(vG));
  // water in a carved channel is drawn at bank level (the 3D terrain has no trench), and lifted slightly
  // with camera distance so coarse terrain tiles don't cover it
  vec3 w = vec3(vG.x * uCell, -vG.y * uCell, max(gz.x + d, gz.y));
  vW = w + vec3(0.0, 0.0, 0.25 + 0.0015 * distance(w, uEyeV));
  gl_Position = uMVP * vec4(vW, 1.0);
}`;
const FS_3D = HEAD + '#define FRAG' + String.fromCharCode(10) + DECODE + `
uniform vec3 uEye;
uniform float uPxAng;        // radians per pixel
uniform vec4 uHole;          // grid-cell rect drawn by the fine pass (x1 < x0: none)
in vec2 vG; in vec3 vW; out vec4 o;
void main(){
  if (uHole.z > uHole.x && all(greaterThanEqual(vG, uHole.xy)) && all(lessThan(vG, uHole.zw))) discard;
  gPx = max(distance(uEye, vW) * uPxAng, 0.05);
  vec4 w = water(vG, normalize(uEye - vW)); if (w.a <= 0.001) discard; o = w;
}`;

// ---------------- flow tracers
const FS_PART_UPDATE = HEAD + '#define FRAG' + String.fromCharCode(10) + DECODE + `
uniform sampler2D uPs; uniform float uVisDt, uDx, uSeed;
out vec4 o;
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
vec2 vel(vec2 g){ if (!inWin(g)) return vec2(1e9); ivec3 r = rawAt(g); if (depthOf(r) < uThr) return vec2(1e9); return velOf(r); }
void main(){
  vec4 p = texelFetch(uPs, ivec2(gl_FragCoord.xy), 0);
  vec2 v = vel(p.xy);
  bool dead = v.x > 1e8 || p.z > p.w || length(v) < 0.05;
  if (!dead) { p.xy += v / uDx * uVisDt; p.z += 1.0; }
  else {
    p.z = p.w + 1.0;
    for (int k = 0; k < 6; k++) {
      vec2 r = vec2(hash(gl_FragCoord.xy + uSeed + float(k) * 7.31), hash(gl_FragCoord.yx * 1.7 + uSeed * 1.3 + float(k)));
      vec2 np = mix(uWin.xy, uWin.zw, r);
      vec2 nv = vel(np);
      if (nv.x < 1e8 && length(nv) > 0.05) { p.xy = np; p.z = 0.0; p.w = 40.0 + 80.0 * hash(r * 91.7); break; }
    }
  }
  o = p;
}`;
const VS_PART = HEAD + DECODE + `
uniform sampler2D uPs, uG; uniform vec2 uGrid;
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
  float fade = min(p.z / 8.0, 1.0) * min((p.w - p.z) / 8.0, 1.0);
  vA = alive ? (end == 0 ? 0.6 : 0.0) * fade * clamp(length(v) * 1.5, 0.25, 1.0) : 0.0;
  vec2 local = vec2(g.x, -g.y) * uCell;
  if (!alive) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  else if (uIs3D == 1) {
    vec2 gz = texelFetch(uG, clamp(ivec2(g), ivec2(0), ivec2(uGrid) - 1), 0).rg;
    float z = max(gz.x + d, gz.y) + 0.8;
    gl_Position = uMVP * vec4(local, z, 1.0);
  } else gl_Position = vec4(local * uXf.xy + uXf.zw, 0.0, 1.0);
}`;
const FS_PART = HEAD + `in float vA; out vec4 o; void main(){ o = vec4(vec3(vA), vA); }`;

const VS_FULL = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

export class WaterRenderer {
  constructor(gl) {
    this.gl = gl;
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float дэмжигдэхгүй');
    this.p2d = program(gl, FS_2D, VS_2D);
    this.p3d = program(gl, FS_3D, VS_3D);
    this.pUpd = program(gl, FS_PART_UPDATE, VS_FULL);
    this.pPart = program(gl, FS_PART, VS_PART);
    this.vao = gl.createVertexArray();
    this.slots = {};          // packed windows: 'main' (whole view), 'near' (3D, around the camera target)
    this.meshes = {};
    this.PN = 128;
    this._cleanUnpack();
    this.parts = [0, 1].map(() => {
      const t = this._tex();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.PN, this.PN, 0, gl.RGBA, gl.FLOAT, new Float32Array(this.PN * this.PN * 4).fill(0).map((v, i) => (i % 4 === 2 ? 1 : 0)));
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, fb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.pi = 0;
    this.gridKey = null;
  }

  // the host view may leave a PIXEL_UNPACK_BUFFER / row-length state bound; texture uploads would fail silently
  _cleanUnpack() {
    const gl = this.gl;
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  }

  _tex() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }

  /** Upload per-grid static layers (ground elevation, building mask) once per grid. */
  setGrid(grid) {
    if (this.gridKey === grid.key) return;
    const gl = this.gl;
    if (this.G) { gl.deleteTexture(this.G); gl.deleteTexture(this.B); }
    this._cleanUnpack();
    this.G = this._tex();
    const gz = new Float32Array(grid.W * grid.H * 2);
    for (let i = 0; i < grid.W * grid.H; i++) { gz[2 * i] = grid.ground[i]; gz[2 * i + 1] = grid.groundNat[i]; }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, grid.W, grid.H, 0, gl.RG, gl.FLOAT, gz);
    this.B = this._tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, grid.W, grid.H, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, grid.bld);
    if (grid.fineBld && this.fbSrc !== grid.fineBld) {        // fine building raster: uploaded once per context
      if (this.FB) gl.deleteTexture(this.FB);
      this.FB = this._tex();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, grid.fineW, grid.fineH, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, grid.fineBld);
      this.fbSrc = grid.fineBld;
    }
    this.grid = grid;
    this.gridKey = grid.key;
  }

  /** Upload the solver's packed window image into a slot. frame = {image|source, win, ow, oh} */
  upload(frame, reuse = false, slot = 'main') {
    const s = this.slots[slot] || (this.slots[slot] = { tex: this._tex(), has: false });
    s.frame = frame;
    if (reuse && s.has) return;                  // same water state and window: keep the texture
    const gl = this.gl;
    this._cleanUnpack();
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    const img = frame.image || frame.source;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    if (frame.image) { frame.image.close(); frame.image = null; }
    s.has = true;
  }

  _common(pr, d, slot = 'main') {
    const gl = this.gl, s = this.slots[slot], f = s.frame;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.uniform1i(pr.u.uEnc, 0);
    gl.uniform4fv(pr.u.uWin, f.win);
    gl.uniform2f(pr.u.uEncSize, f.ow, f.oh);
    if (pr.u.uEncTex) gl.uniform2f(pr.u.uEncTex, f.canvas.width, f.canvas.height);
    gl.uniform1i(pr.u.uMode, d.mode);
    gl.uniform1f(pr.u.uThr, d.thr);
    if (pr.u.uOpacity) gl.uniform1f(pr.u.uOpacity, d.opacity);
    if (pr.u.uTmax) gl.uniform1f(pr.u.uTmax, d.tmax);
    if (pr.u.uCell) gl.uniform1f(pr.u.uCell, this.grid.cellMerc);
    if (pr.u.uStyle) gl.uniform1i(pr.u.uStyle, d.waterStyle);
    if (pr.u.uTime) gl.uniform1f(pr.u.uTime, (performance.now() / 1000) % 3600);   // keep float precision
    if (pr.u.uSun) gl.uniform3fv(pr.u.uSun, d.sun || [0.35, -0.45, 0.82]);
    if (pr.u.uArrows) gl.uniform1i(pr.u.uArrows, d.arrows ? 1 : 0);
  }

  _gridTex(pr, unitG, unitB) {
    const gl = this.gl;
    if (pr.u.uFB) {
      gl.activeTexture(gl.TEXTURE0 + unitB + 1); gl.bindTexture(gl.TEXTURE_2D, this.FB); gl.uniform1i(pr.u.uFB, unitB + 1);
      const g = this.grid;
      gl.uniform3f(pr.u.uFB3, g.off ? g.off[0] : 0, g.off ? g.off[1] : 0, this.FB ? g.F || 1 : 0);
    }
    if (pr.u.uG) { gl.activeTexture(gl.TEXTURE0 + unitG); gl.bindTexture(gl.TEXTURE_2D, this.G); gl.uniform1i(pr.u.uG, unitG); }
    if (pr.u.uB) { gl.activeTexture(gl.TEXTURE0 + unitB); gl.bindTexture(gl.TEXTURE_2D, this.B); gl.uniform1i(pr.u.uB, unitB); }
    if (pr.u.uGrid) gl.uniform2f(pr.u.uGrid, this.grid.W, this.grid.H);
  }

  /** Advance tracers (call once per frame before drawing). Restores framebuffer + viewport afterwards. */
  updateParticles(d, visDt, restore, slot = 'main') {
    const gl = this.gl, pr = this.pUpd, a = this.pi, b = 1 - a;
    this.partSlot = slot;
    const vp = gl.getParameter(gl.VIEWPORT);   // host bindRenderTarget() doesn't always restore it (3D)
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(pr.p);
    this._common(pr, { ...d, thr: Math.max(d.thr, 0.08) }, slot);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.parts[a].t); gl.uniform1i(pr.u.uPs, 1);
    gl.uniform1f(pr.u.uVisDt, visDt);
    gl.uniform1f(pr.u.uDx, this.grid.dx);
    gl.uniform1f(pr.u.uSeed, Math.random() * 1000);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.parts[b].fb);
    gl.viewport(0, 0, this.PN, this.PN);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.pi = b;
    restore();
    gl.viewport(vp[0], vp[1], vp[2], vp[3]);
  }

  draw2D(d, xf) {
    const gl = this.gl, pr = this.p2d;
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(pr.p);
    this._common(pr, d);
    this._gridTex(pr, 1, 2);
    gl.uniform1f(pr.u.uCell, this.grid.cellMerc);
    gl.uniform4fv(pr.u.uXf, xf);
    gl.uniform1f(pr.u.uHill, d.hill);
    gl.uniform1f(pr.u.uBld, d.buildings ? 1 : 0);
    gl.uniform1f(pr.u.uDx, this.grid.dx);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (d.particles && d.mode <= 2 && !d.history) this._drawParticles(d, 0, xf, null);
    gl.bindVertexArray(null);
  }

  /** N×N grid of window-relative uv with indexed triangles (N in steps of 64, cached). */
  _mesh(N) {
    const gl = this.gl;
    if (this.meshes[N]) return this.meshes[N];
    const uv = new Float32Array(N * N * 2);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { uv[(j * N + i) * 2] = i / (N - 1); uv[(j * N + i) * 2 + 1] = j / (N - 1); }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6);
    let k = 0;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      idx.set([a, a + 1, a + N, a + 1, a + N + 1, a + N], k); k += 6;
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return (this.meshes[N] = { vao, count: idx.length });
  }

  /** Water surface as a displaced mesh: a coarse pass over the whole view with a hole where
   *  the fine pass (around the camera target, ~1 vertex per cell) draws. */
  draw3D(d, mvp, eye) {
    const gl = this.gl, pr = this.p3d;
    // grid-aligned mesh for a slot: spacing sp (power of two cells), origin snapped to sp
    const meshFor = (slot, cap) => {
      const w = this.slots[slot].frame.win, dim = Math.max(w[2] - w[0], w[3] - w[1]);
      let sp = 1;
      while (dim / sp > cap - 2) sp *= 2;
      const ox = Math.floor(w[0] / sp) * sp, oy = Math.floor(w[1] / sp) * sp;
      const cells = Math.max(w[2] - ox, w[3] - oy);
      const N = Math.min(cap, Math.max(64, Math.ceil((cells / sp + 1) / 64) * 64));
      return { N, origin: [ox, oy, (N - 1) * sp] };
    };
    const near = this.slots.near?.frame ? this.slots.near : null;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(pr.p);
    gl.uniformMatrix4fv(pr.u.uMVP, false, mvp);
    gl.uniform3fv(pr.u.uEye, eye);
    gl.uniform3fv(pr.u.uEyeV, eye);
    gl.uniform1f(pr.u.uPxAng, d.pxAng || 0.0015);
    const passes = [['main', 512, near ? near.frame.win : [0, 0, -1, -1]]];
    if (near) passes.push(['near', 768, [0, 0, -1, -1]]);
    for (const [slot, cap, hole] of passes) {
      const mf = meshFor(slot, cap), m = this._mesh(mf.N);
      gl.bindVertexArray(m.vao);
      this._common(pr, d, slot);
      this._gridTex(pr, 1, 2);
      gl.uniform3fv(pr.u.uMesh, mf.origin);
      gl.uniform4fv(pr.u.uHole, hole);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(this.vao);
    if (d.particles && d.mode <= 2 && !d.history) this._drawParticles(d, 1, [0, 0, 0, 0], mvp);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  _drawParticles(d, is3D, xf, mvp) {
    const gl = this.gl, pr = this.pPart;
    gl.useProgram(pr.p);
    this._common(pr, { ...d, thr: Math.max(d.thr, 0.08) }, this.partSlot || 'main');
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.parts[this.pi].t); gl.uniform1i(pr.u.uPs, 1);
    this._gridTex(pr, 2, 3);
    gl.uniform1i(pr.u.uPN, this.PN);
    gl.uniform1i(pr.u.uIs3D, is3D);
    gl.uniform1f(pr.u.uDx, this.grid.dx);
    gl.uniform1f(pr.u.uTail, d.visDt * 5);
    gl.uniform1f(pr.u.uCell, this.grid.cellMerc);
    gl.uniform4fv(pr.u.uXf, xf);
    gl.uniformMatrix4fv(pr.u.uMVP, false, mvp || new Float32Array(16));
    gl.drawArrays(gl.LINES, 0, this.PN * this.PN * 2);
  }
}
