/* eslint-disable @typescript-eslint/no-explicit-any -- three.js нь CDN-ээс төрөлгүй ачаалагдана */
/*
  НҮХЭН ЖОРЛОНГИЙН 3D ХАРАГДАЦ — three.js (r128, CDN)

  Эх: `I:/Environment/us_hurs/leaching/latrine_sim_3d.js` (эх HTML-д
  шигтгэгдсэн `V3`). Зурах логик ҮГ ҮСЭГЧЛЭН хөрвөсөн: зүсэлтийн хананд
  бохирдлын тархалт, нүх сүвээр урсах дуслууд, нүх сүвний томруулсан
  харагдац. Өөрчлөгдсөн нь:
    · удирдлага, тайлбар (зүйл сонгох, дусал, камер, хуулга, гүн) нь
      React руу шилжсэн — энд зөвхөн зурах, API;
    · шошгоны фонт Inter (платформын ганц фонт);
    · дэвсгэр тогтмол бараан slate — "газрын зураг гэрэл/харанхуй
      горимд ижил" дүрэм 3D харагдацад ч хамаарна.

  ⚠⚠ three.js-ийг NPM-ЭЭР СУУЛГААГҮЙ — Esri SDK-тэй нэг зарчим: энэ
  харагдацыг нээсэн үед л CDN-ээс нэг удаа ачаална.
  ⚠⚠ AMD `define`-ИЙГ ТҮР НУУНА (зөвхөн синхрон гүйцэтгэлд — `loadThree`). Esri SDK (хөрсний зүсэлт, торон загвар)
  ачаалагдсан бол глобал `define.amd` байдаг бөгөөд three.min.js-ийн UMD
  толгой тэр үед `window.THREE` үүсгэхгүй, AMD модуль болж бүртгэгдэнэ
  — OrbitControls.js нь глобал THREE хайж унана.
*/
import {
  C0E_LOG,
  MATS,
  NORM_N,
  TEX,
  horizons,
  hzCol,
  isWinter,
  type SimParams,
  type SimProfile,
  type SimResult,
  type Snap,
} from "@/lib/latrine-sim";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js";
const ORBIT_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";

let threeP: Promise<any> | null = null;
async function source(src: string) {
  // eslint-disable-next-line no-restricted-globals -- нээлттэй CDN (jsDelivr, CORS *), портал биш
  const res = await fetch(src).catch(() => null);
  if (!res?.ok) throw new Error("3D сан ачаалагдсангүй (интернэт холболтоо шалгана уу)");
  return res.text();
}
/** Бичвэрийг шигтгэсэн `<script>` болгож ШУУД (синхрон) гүйцэтгэнэ */
function run(code: string) {
  const s = document.createElement("script");
  s.textContent = code;
  document.head.appendChild(s);
}
/*
  ⚠⚠ `define`-ИЙГ ЗӨВХӨН СИНХРОН ГҮЙЦЭТГЭЛИЙН АГШИНД НУУНА (2026-10-01).
  Урьд нь `<script src>`-ийн ТАТАЦЫН ТУРШ (хэдэн зуун мс) нуудаг байсан.
  Нэвчилтийн симуляци тусдаа таб байхад Esri тэр үед модуль ачаалдаггүй
  тул далд байв; симуляци "Хөрсний зүсэлт"-ийн дотор орж three.js-ийг
  урьдчилан татах болмогц SceneView тэр завсарт залхуу модулиа ачаалж
  "define is not a function" гэж унав.
  Одоо бичвэрийг эхлээд ТАТАЖ, дараа нь шигтгэсэн скриптээр гүйцэтгэнэ:
  шигтгэсэн скрипт нэмэгдмэгц синхрон ажилладаг тул тэр хооронд өөр ямар
  ч код (Esri-ийн AMD ачаалагч) ажиллах боломжгүй.
*/
export function loadThree(): Promise<any> {
  const w = window as any;
  if (w.THREE?.OrbitControls) return Promise.resolve(w.THREE);
  threeP ??= (async () => {
    const [three, orbit] = await Promise.all([w.THREE ? Promise.resolve("") : source(THREE_URL), source(ORBIT_URL)]);
    const def = w.define;
    w.define = undefined;
    try {
      if (three) run(three);
      run(orbit);
    } finally {
      w.define = def;
    }
    if (!w.THREE?.OrbitControls) throw new Error("3D сан ачаалагдсангүй");
    return w.THREE;
  })().catch((e) => {
    threeP = null;
    throw e;
  });
  return threeP;
}

export type Species = "N" | "E";
export const RN3: number[][] = [[252, 226, 170], [246, 160, 80], [226, 95, 40], [175, 45, 20], [110, 18, 8]];
export const RE3: number[][] = [[226, 214, 248], [186, 150, 232], [146, 100, 212], [108, 60, 180], [70, 25, 130]];
export function rampC(stops: number[][], t: number): number[] {
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const k = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - k;
  const a = stops[k];
  const b = stops[k + 1];
  return a.map((v, j) => Math.round(v + (b[j] - v) * f));
}

export type Pit3D = {
  setRun: (r: SimResult, p: SimParams, profiles: SimProfile[]) => void;
  update: (s: Snap) => void;
  setSpecies: (s: Species) => void;
  setDrops: (on: boolean) => void;
  frame: () => void;
  setDepth: (m: number) => void;
  /** Загварын бүтэн гүн, м — гүний гулсуурын дээд хязгаар */
  depthMax: () => number;
  /**
   * ⚠ Харагдацаас нуух үед давталтыг ЗОГСООНО — "Хөрсний зүсэлт" рүү
   * буцахад хөдөлгүүр устахгүй (дахин нээхэд шууд гарна), харин нуугдсан
   * three.js үргэлжлэн зурж GPU-г эзлэх ёсгүй.
   */
  pause: () => void;
  resume: () => void;
  destroy: () => void;
};

const BG = 0x18222d;

export function createPit3D(
  THREE: any,
  opts: {
    container: HTMLDivElement;
    tiles: Record<string, HTMLImageElement>;
    micro: HTMLCanvasElement;
    /** Томруулсан харагдацын мэдээлэл (зурагдалт бүрд биш, өөрчлөгдөхөд) */
    onMicro: (text: string) => void;
    /** Сонгосон гүн өөрчлөгдсөн (хана дээр товшсон) */
    onDepth: (m: number) => void;
    /** Дуслын хурдасгалын тайлбар */
    onSpeed: (text: string) => void;
  },
): Pit3D {
  const { container: el, tiles: TIMG, micro: mcv } = opts;
  const mctx = mcv.getContext("2d")!;
  const st = { species: "N" as Species, drops: true, speed: 1, dirty: false };
  let R_: SimResult | null = null;
  let P: SimParams | null = null;
  let PROFILES: SimProfile[] = [];
  let world: any = null;
  let snap: Snap | null = null;
  let winter = false;
  let raf = 0;
  let lastT = 0;
  let alive = true;
  let paused = false;

  /* Цооногийн давхаргын өнгө — ангиар (хайрга цайвар, шавар бараан) */
  const DEEP_COL: Record<string, string> = {
    sand: "#cfbd95", lsand: "#c3ad86", sloam: "#b59a74", scl: "#a6876a", loam: "#9c8770", cloam: "#8b796b", clay: "#7f7068",
  };
  const tileKey = (n: string) => {
    const c = (n.replace(/[^A-Za-zА-Яа-я]/g, "")[0] || "C").toUpperCase();
    return c === "O" || c === "T" ? "A" : "AEBCR".includes(c) ? c : "C";
  };
  const PPM = 48; // пиксел / м зүсэлтийн хананд
  function pattern(ctx: CanvasRenderingContext2D, key: string) {
    const im = TIMG[key];
    if (!im || !im.complete || !im.naturalWidth) return null;
    const p = ctx.createPattern(im, "repeat");
    const s = (PPM * 1.6) / 512;
    if (p && p.setTransform) p.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
    return p;
  }
  function rng(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randn = () => {
    let u = 0;
    let v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v);
  };
  const FONT = "Inter, system-ui, sans-serif";
  function label(text: string, { size = 0.32, color = "#1f2426", bg = "rgba(255,255,255,.85)" as string | null, bold = false } = {}) {
    const c = document.createElement("canvas");
    const g = c.getContext("2d")!;
    const f = (bold ? "600 " : "") + "44px " + FONT;
    g.font = f;
    const w = Math.ceil(g.measureText(text).width) + 28;
    c.width = w;
    c.height = 64;
    g.font = f;
    if (bg) {
      g.fillStyle = bg;
      g.beginPath();
      g.rect(0, 4, w, 56);
      g.fill();
    }
    g.fillStyle = color;
    g.textBaseline = "middle";
    g.fillText(text, 14, 33);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set((size * w) / 64, size, 1);
    s.renderOrder = 10;
    return s;
  }
  function dotTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(20,12,6,.85)";
    g.beginPath();
    g.arc(32, 32, 29, 0, 6.3);
    g.fill();
    const gr = g.createRadialGradient(26, 24, 2, 32, 32, 24);
    gr.addColorStop(0, "#fff");
    gr.addColorStop(0.35, "#fff");
    gr.addColorStop(1, "#ddd");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(32, 32, 23, 0, 6.3);
    g.fill();
    return new THREE.CanvasTexture(c);
  }

  /* ── эхлүүлэх ── */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(BG);
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 60, 160);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(6, 12, 9);
  scene.add(sun);
  let down: [number, number] | null = null;
  const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
  const onUp = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) pick(e);
    down = null;
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();
  function resize() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ── ертөнц байгуулах ── */
  function clear() {
    if (!world) return;
    scene.remove(world.g);
    world.g.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
    world = null;
  }
  function build() {
    clear();
    const r = R_;
    const p = P;
    if (!r || !p) return;
    const F = r.F;
    const g = new THREE.Group();
    scene.add(g);
    const gw = p.gw;
    const pit = Math.min(p.pit, gw);
    const a = F ? F.a : p.wid / Math.sqrt(Math.PI);
    const R = F ? F.R : 3;
    const Db = gw + Math.max(1.2, Math.min(3, 0.15 * gw));
    world = { g, R, Db, gw, pit, a, F, r };
    /* хөрсний дэвсгэр (гүнээр) — бүх хананд хэрэглэнэ */
    const W = Math.ceil(2 * R * PPM);
    const H = Math.ceil(Db * PPM);
    const bg = document.createElement("canvas");
    bg.width = W;
    bg.height = H;
    const b = bg.getContext("2d")!;
    const hz = horizons(PROFILES[p.soil].hz);
    const hb = Math.max(...hz.map((o) => o.b)) / 100;
    const M = MATS[p.mat];
    b.fillStyle = M.col;
    b.fillRect(0, 0, W, H);
    /* 2 м-ээс доош — баганын давхарга бүр: цооногийнх ангийн өнгөөр,
       геологийн зурагных материалын өнгөөр (2D диаграмтай нэг) */
    const deep = (p.col ?? []).filter((l) => l.kind !== 0);
    if (!deep.length) deep.push({ top: hb, bot: 1e3, cls: M.t, Ks: 0, name: "", src: "", gravel: null, kind: 2 });
    for (const l of deep) {
      const y0 = Math.max(hb, l.top) * PPM;
      const y1 = Math.min(H, l.bot * PPM);
      if (y1 <= y0) continue;
      const key = l.kind === 1 ? (/sand/.test(l.cls) ? "C" : "B") : p.mat === 6 ? "R" : p.mat === 5 ? "B" : "C";
      b.fillStyle = l.kind === 1 ? (DEEP_COL[l.cls] ?? M.col) : M.col;
      b.fillRect(0, y0, W, y1 - y0);
      const pd = pattern(b, key);
      if (pd) {
        b.save();
        /* цооногийн давхаргад бүтэц сул — ангийн өнгө нь давхарга хооронд ялгарна */
        b.globalAlpha = l.kind === 1 ? 0.45 : 0.8;
        b.fillStyle = pd;
        b.fillRect(0, y0, W, y1 - y0);
        b.restore();
      }
      if (l.kind === 2 && p.mat === 5) {
        b.fillStyle = "rgba(150,70,40,.28)";
        b.fillRect(0, y0, W, y1 - y0);
      }
      /* давхаргын зааг */
      b.fillStyle = "rgba(30,20,12,.55)";
      b.fillRect(0, y0, W, 2);
    }
    hz.forEach((o) => {
      const t = (o.t / 100) * PPM;
      const bb = (o.b / 100) * PPM;
      const pp = pattern(b, tileKey(o.n));
      b.fillStyle = pp || hzCol(o.n);
      b.fillRect(0, t, W, bb - t);
    });
    /* үеийн зааг зөөлрүүлэх */
    hz.forEach((o) => {
      const y = (o.b / 100) * PPM;
      const gr = b.createLinearGradient(0, y - 6, 0, y + 6);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(0.5, "rgba(40,28,18,.25)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      b.fillStyle = gr;
      b.fillRect(0, y - 6, W, 12);
    });
    /* ус ханасан бүс */
    const yw = gw * PPM;
    const grw = b.createLinearGradient(0, yw - PPM * 0.4, 0, yw + 2);
    grw.addColorStop(0, "rgba(60,120,190,0)");
    grw.addColorStop(1, "rgba(60,120,190,.45)");
    b.fillStyle = grw;
    b.fillRect(0, yw - PPM * 0.4, W, PPM * 0.4 + 2);
    b.fillStyle = "rgba(55,115,190,.5)";
    b.fillRect(0, yw, W, H - yw);
    world.bg = bg;
    const mk = (w: number, h: number, map: any) =>
      new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map, side: THREE.FrontSide }));
    const tex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      return t;
    };
    const crop = (x0: number, w: number) => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(w * PPM);
      c.height = H;
      c.getContext("2d")!.drawImage(bg, x0 * PPM, 0, w * PPM, H, 0, 0, c.width, H);
      return c;
    };
    /* гадна хана */
    let m = mk(2 * R, Db, tex(crop(0, 2 * R)));
    m.rotation.y = -Math.PI / 2;
    m.position.set(-R, -Db / 2, 0);
    g.add(m);
    m = mk(2 * R, Db, tex(crop(0.3, 2 * R - 0.3)));
    m.rotation.y = Math.PI;
    m.position.set(0, -Db / 2, -R);
    g.add(m);
    m = mk(R, Db, tex(crop(0.7, R)));
    m.rotation.y = Math.PI / 2;
    m.position.set(R, -Db / 2, -R / 2);
    g.add(m);
    m = mk(R, Db, tex(crop(0.5, R)));
    m.position.set(-R / 2, -Db / 2, R);
    g.add(m);
    /* зүсэлтийн хана (бохирдолтой) */
    world.cutA = document.createElement("canvas");
    world.cutA.width = Math.ceil(R * PPM);
    world.cutA.height = H;
    world.cutB = document.createElement("canvas");
    world.cutB.width = Math.ceil(R * PPM);
    world.cutB.height = H;
    world.texA = tex(world.cutA);
    world.texB = tex(world.cutB);
    world.faceA = mk(R, Db, world.texA);
    world.faceA.position.set(R / 2, -Db / 2, 0);
    g.add(world.faceA);
    world.faceB = mk(R, Db, world.texB);
    world.faceB.rotation.y = Math.PI / 2;
    world.faceB.position.set(0, -Db / 2, R / 2);
    g.add(world.faceB);
    /* газрын гадарга (зун, өвөл) */
    world.groundS = groundCanvas(R, a, false);
    world.groundW = groundCanvas(R, a, true);
    world.groundTex = tex(world.groundS);
    m = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * R, 2 * R),
      new THREE.MeshLambertMaterial({ map: world.groundTex, transparent: true, alphaTest: 0.5 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.001;
    g.add(m);
    world.ground = m;
    /* нүхний хана, ёроолын шингэн */
    const pw = new THREE.Mesh(
      new THREE.CylinderGeometry(a, a, pit, 40, 1, true, Math.PI / 2, 1.5 * Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1c, side: THREE.BackSide }),
    );
    pw.position.y = -pit / 2;
    g.add(pw);
    const liq = new THREE.Mesh(new THREE.CircleGeometry(a, 40, 0, 1.5 * Math.PI), new THREE.MeshLambertMaterial({ color: 0x5d5028 }));
    liq.rotation.x = -Math.PI / 2;
    liq.position.y = -pit + Math.min(p.hw, pit) * 0.999;
    g.add(liq);
    hut(g, a);
    /* гүний усны гадарга ба ус ханасан эзэлхүүн (зүссэн хэсэгт) */
    world.wtMat = new THREE.MeshPhongMaterial({
      color: 0x2f7fc0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, shininess: 80, depthWrite: false,
    });
    m = new THREE.Mesh(new THREE.PlaneGeometry(R, R), world.wtMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(R / 2, -gw, R / 2);
    g.add(m);
    world.volMat = new THREE.MeshLambertMaterial({ color: 0x3f86c8, transparent: true, opacity: 0.16, depthWrite: false });
    m = new THREE.Mesh(new THREE.BoxGeometry(R, Db - gw, R), world.volMat);
    m.position.set(R / 2, -(gw + Db) / 2, R / 2);
    g.add(m);
    /* гүний хэмжүүр, шошго */
    const LS = Math.max(0.12, 0.026 * Math.max(Db, 2 * R));
    world.LS = LS;
    const ruler = new THREE.Group();
    g.add(ruler);
    const step = Db > 20 ? 5 : Db > 8 ? 2 : 1;
    const lp: number[] = [];
    for (let d = 0; d <= Db + 1e-6; d += step) {
      lp.push(R, -d, 0, R + 0.25, -d, 0);
      const s = label(`${d} м`, { size: LS, bg: "rgba(255,255,255,.7)", color: "#1f2426" });
      s.position.set(R + 0.25 + LS, -d, 0.05);
      ruler.add(s);
    }
    lp.push(R, 0, 0, R, -Db, 0);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
    ruler.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xcfd8dc })));
    let s = label(`Гүний усны түвшин · ${gw.toFixed(1)} м`, { size: LS, color: "#fff", bg: "rgba(31,95,153,.9)", bold: true });
    s.position.set(R * 0.62, -gw + 0.28, R * 0.95);
    g.add(s);
    s = label(`Нүх · ${pit.toFixed(1)} м`, { size: LS, bold: true });
    s.position.set(-a - 0.1, -pit / 2, a + 0.25);
    g.add(s);
    /* цооногийн давхарга бүрийн нэр — блокийн зүүн ирмэгт, давхаргынхаа дунд */
    for (const l of p.col ?? []) {
      if (l.kind !== 1) continue;
      const y0 = Math.max(l.top, hb);
      const y1 = Math.min(l.bot, Db);
      if (y1 - y0 < 0.6) continue;
      s = label(`${TEX[l.cls]?.n ?? l.cls} · ${l.src.replace(/^JICA цооног /, "цооног ")}`, { size: LS, bg: "rgba(30,24,18,.8)", color: "#f3ead9" });
      s.position.set(-R - 0.15 - s.scale.x / 2, -(y0 + y1) / 2, R);
      g.add(s);
    }
    s = label("Жорлон", { size: LS, bold: true });
    s.position.set(-0.5, 2.55, -0.5);
    g.add(s);
    /* сонгосон цэгийн тэмдэг */
    const mm = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.12, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, side: THREE.DoubleSide }),
    );
    mm.renderOrder = 12;
    g.add(mm);
    world.marker = mm;
    if (F) drops(g);
    else opts.onSpeed("");
    micro.depth = Math.min(Db - 0.1, (pit + gw) / 2);
    micro.r = Math.min(a * 0.5, R);
    placeMarker();
    opts.onDepth(micro.depth);
    frame();
    st.dirty = false;
  }
  function frame() {
    if (!world) return;
    const { R, Db } = world;
    const d = Math.max(Db * 0.9, 2.2 * R);
    camera.position.set(R * 0.2 + d * 0.95, d * 0.55, d * 0.95);
    controls.target.set(0, -Db * 0.42, 0);
    controls.update();
  }
  function groundCanvas(R: number, a: number, snow: boolean) {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const r = rng(7);
    const k = S / (2 * R);
    g.fillStyle = snow ? "#eef3f7" : "#8d7b58";
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const x = r() * S;
      const y = r() * S;
      const s = 1 + r() * 3.2;
      g.fillStyle = snow
        ? `rgba(${(170 + r() * 40) | 0},${(190 + r() * 30) | 0},${(215 + r() * 30) | 0},${0.25 + r() * 0.3})`
        : r() < 0.35
          ? `rgba(${(80 + r() * 40) | 0},${(100 + r() * 40) | 0},${(50 + r() * 20) | 0},.55)`
          : `rgba(${(110 + r() * 70) | 0},${(90 + r() * 55) | 0},${(60 + r() * 40) | 0},.6)`;
      g.beginPath();
      g.ellipse(x, y, s, s * (0.5 + r() * 0.6), r() * 3, 0, 6.3);
      g.fill();
    }
    g.globalCompositeOperation = "destination-out";
    g.fillRect(S / 2, S / 2, S / 2, S / 2); // зүссэн дөрөвний нэг
    g.beginPath();
    g.arc(S / 2, S / 2, a * k, 0, 6.3);
    g.fill();
    g.globalCompositeOperation = "source-over"; // нүхний ам
    g.strokeStyle = snow ? "rgba(120,140,160,.6)" : "rgba(40,28,18,.7)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(S / 2, S / 2, a * k + 1.5, Math.PI / 2, 2 * Math.PI);
    g.stroke();
    return c;
  }
  function hut(g: any, a: number) {
    const w = Math.max(1.2, 2 * a * 0.95);
    const hh = 2.1;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    const x = c.getContext("2d")!;
    const r = rng(3);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = `rgb(${(120 + r() * 30) | 0},${(86 + r() * 20) | 0},${(52 + r() * 14) | 0})`;
      x.fillRect(i * 16, 0, 16, 256);
      x.fillStyle = "rgba(40,25,12,.6)";
      x.fillRect(i * 16, 0, 1.5, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide });
    let m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat);
    m.rotation.y = Math.PI / 2;
    m.position.set(-w / 2, hh / 2, 0);
    g.add(m);
    m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat);
    m.position.set(0, hh / 2, -w / 2);
    g.add(m);
    const rm = new THREE.MeshLambertMaterial({ color: 0x5b4a3a });
    m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.06, (w + 0.2) / 2), rm);
    m.position.set(0, hh + 0.03, -(w + 0.2) / 4);
    g.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry((w + 0.2) / 2, 0.06, (w + 0.2) / 2), rm);
    m.position.set(-(w + 0.2) / 4, hh + 0.03, (w + 0.2) / 4);
    g.add(m);
  }

  /* ── зүсэлтийн хананд бохирдол зурах ── */
  const ovc = document.createElement("canvas");
  function paintCuts(s: Snap) {
    if (!world || !P) return;
    const { R, gw, pit, a, F } = world;
    const H = world.cutA.height;
    const Wc = world.cutA.width;
    if (F && s.qN) {
      ovc.width = F.nr;
      ovc.height = F.nz;
      const g = ovc.getContext("2d")!;
      const im = g.createImageData(F.nr, F.nz);
      const q = st.species === "N" ? s.qN : s.qE!;
      const RR = st.species === "N" ? RN3 : RE3;
      for (let k = 0; k < q.length; k++) {
        const v = q[k];
        if (!v || F.typ[k]) continue;
        const t = (v - 1) / 254;
        const c = rampC(RR, t);
        im.data.set([c[0], c[1], c[2], Math.round(255 * (0.35 + 0.6 * t))], k * 4);
      }
      g.putImageData(im, 0, 0);
    }
    for (const [cv, tx] of [
      [world.cutA, world.texA],
      [world.cutB, world.texB],
    ] as [HTMLCanvasElement, any][]) {
      const g = cv.getContext("2d")!;
      g.save();
      if (cv === world.cutB) {
        g.translate(Wc, 0);
        g.scale(-1, 1);
      }
      g.drawImage(world.bg, R * PPM, 0, Wc, H, 0, 0, Wc, H);
      if (F && s.qN) {
        g.imageSmoothingEnabled = true;
        g.drawImage(ovc, 0, 0, F.nr, F.nz, 0, 0, F.R * PPM, gw * PPM);
      }
      /* нүхний огтлол */
      const ap = a * PPM;
      const pp = pit * PPM;
      const hw = Math.min(P.hw, pit) * PPM;
      const gr = g.createLinearGradient(0, 0, ap, 0);
      gr.addColorStop(0, "#1d140c");
      gr.addColorStop(1, "#3b2a1a");
      g.fillStyle = gr;
      g.fillRect(0, 0, ap, pp);
      g.fillStyle = "#5d5028";
      g.fillRect(0, pp - hw, ap, hw);
      g.fillStyle = "rgba(120,100,50,.6)";
      g.fillRect(0, pp - hw, ap, 3);
      /* өвөл хөлдсөн бүс */
      if (winter) {
        const fz = Math.min(2.5, world.Db) * PPM;
        const fg = g.createLinearGradient(0, 0, 0, fz);
        fg.addColorStop(0, "rgba(225,238,252,.55)");
        fg.addColorStop(1, "rgba(225,238,252,0)");
        g.fillStyle = fg;
        g.fillRect(ap, 0, Wc - ap, fz);
      }
      /* гүний усны шугам */
      g.strokeStyle = "rgba(120,190,255,.95)";
      g.lineWidth = 3;
      g.setLineDash([12, 8]);
      g.beginPath();
      g.moveTo(0, gw * PPM);
      g.lineTo(Wc, gw * PPM);
      g.stroke();
      g.setLineDash([]);
      g.restore();
      tx.needsUpdate = true;
    }
  }

  /* ── дуслууд (нүх сүвээр урсах шингэн) ── */
  const NP = 2200;
  function drops(g: any) {
    const { F, r } = world;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(NP * 3);
    const col = new Float32Array(NP * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: Math.max(0.1, 0.012 * Math.max(world.Db, 2 * world.R)),
      map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.05, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = 5;
    pts.visible = st.drops;
    g.add(pts);
    /* нүхнээс гарах урсгалын жин */
    const cells: number[] = [];
    const w: number[] = [];
    let tot = 0;
    for (const k of F.soil) {
      if (F.Fp[k] > 0) {
        cells.push(k);
        tot += F.Fp[k];
        w.push(tot);
      }
    }
    const k0 = Math.min(F.nz - 1, F.jd) * F.nr; // нүхний ёроол доорх төвийн эс
    const vz0 = Math.max(1e-6, r.vZ[k0] || 1e-6);
    const L = Math.max(0.1, world.gw - world.pit);
    /* ⚠ Давхаргатай баганад хурд гүнээр өөр — нүхнээс гүний ус хүртэлх
       мөр бүрийн h/v-ийн нийлбэр (`tTravel`); байхгүй бол нүхний доорх эсээр */
    const tt = r.tTravel ?? L / vz0;
    const dps = Math.max(0.5, tt / 9); // ~9 секундэд гүний усанд хүрнэ
    Object.assign(world, {
      pts, pos, col, cells, w, tot, dps,
      P: {
        r: new Float32Array(NP), z: new Float32Array(NP), ph: new Float32Array(NP), t: new Uint8Array(NP),
        stg: new Uint8Array(NP), x: new Float32Array(NP), y: new Float32Array(NP), age: new Float32Array(NP), live: new Uint8Array(NP),
      },
    });
    for (let i = 0; i < NP; i++) {
      spawn(i);
      world.P.age[i] = -Math.random() * 12;
    }
    opts.onSpeed(
      `Дуслууд хурдасгасан: 1 секунд ≈ ${dps < 2 ? dps.toFixed(1) : Math.round(dps)} хоног. Хөрсөөр доош ${L.toFixed(1)} м явахад ≈ ${fmtDays(tt)}.`,
    );
  }
  function fmtDays(d: number) {
    return d < 60 ? `${Math.round(d)} хоног` : d < 730 ? `${Math.round(d / 30.4)} сар (дулаан улирлын)` : `${(d / 214).toFixed(1)} дулаан улирал`;
  }
  function spawn(i: number) {
    const W = world;
    const Pp = W.P;
    const F = W.F;
    const u = Math.random() * W.tot;
    let lo = 0;
    let hi = W.w.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (W.w[m] < u) lo = m + 1;
      else hi = m;
    }
    const k = W.cells[lo];
    const ii = k % F.nr;
    const jj = (k - ii) / F.nr;
    if (F.FpR[k] > 0 && (F.FpZ[k] <= 0 || Math.random() < F.FpR[k] / F.Fp[k])) {
      Pp.r[i] = W.a + 0.02;
      Pp.z[i] = (jj + Math.random()) * F.h;
    } else {
      Pp.r[i] = W.a * Math.sqrt(Math.random());
      Pp.z[i] = W.pit + 0.02;
    }
    Pp.ph[i] =
      Math.random() < 0.75
        ? Math.random() < 0.5
          ? 0.02 + Math.random() * 0.07
          : Math.PI / 2 - 0.02 - Math.random() * 0.07
        : 0.1 + Math.random() * (Math.PI / 2 - 0.2);
    Pp.t[i] = Math.random() < 0.28 ? 1 : 0;
    Pp.stg[i] = 0;
    Pp.age[i] = 0;
    Pp.live[i] = 1;
  }
  function stepDrops(dt: number) {
    const W = world;
    if (!W || !W.P || !st.drops || !P) return;
    const Pp = W.P;
    const F = W.F;
    const r = W.r;
    const pos = W.pos;
    const col = W.col;
    const days = winter ? 0 : dt * W.dps * st.speed;
    const ugw = (P.kaq * P.grad) / 0.25;
    for (let i = 0; i < NP; i++) {
      if (Pp.age[i] < 0) {
        Pp.age[i] += winter ? 0 : dt;
        pos[i * 3 + 1] = 999;
        continue;
      }
      if (days > 0) {
        Pp.age[i] += dt;
        if (Pp.stg[i] === 0) {
          const ri = Math.min(F.nr - 1, Math.max(0, Math.floor(Pp.r[i] / F.h)));
          const zj = Math.min(F.nz - 1, Math.max(0, Math.floor(Pp.z[i] / F.h)));
          const k = zj * F.nr + ri;
          if (F.typ[k]) Pp.r[i] = W.a + 0.02;
          else {
            const vr = r.vR[k];
            const vz = r.vZ[k];
            const D = 0.1 * Math.hypot(vr, vz) + 1e-6;
            const sd = Math.sqrt(2 * D * days);
            Pp.r[i] = Math.abs(Pp.r[i] + vr * days + randn() * sd * 0.8);
            Pp.z[i] = Math.max(0.01, Pp.z[i] + vz * days + randn() * sd * 0.8);
          }
          const lam = r.lamRow ? r.lamRow[zj] : r.lamE;
          if (Pp.t[i] === 1 && Math.random() < 1 - Math.exp(-lam * days)) {
            spawn(i);
            continue;
          }
          if (Pp.r[i] > W.R - 0.02 || Pp.age[i] > 40) {
            spawn(i);
            continue;
          }
          if (Pp.z[i] >= W.gw) {
            Pp.stg[i] = 1;
            Pp.x[i] = Pp.r[i] * Math.cos(Pp.ph[i]);
            Pp.y[i] = Pp.r[i] * Math.sin(Pp.ph[i]);
            Pp.age[i] = 0;
          }
        } else {
          Pp.x[i] += Math.min(3, ugw * days * 0.2 + 0.02 * dt);
          Pp.z[i] = Math.min(W.Db - 0.05, Pp.z[i] + 0.03 * dt);
          if (Pp.x[i] > W.R - 0.05 || Pp.age[i] > 6) {
            spawn(i);
            continue;
          }
        }
      }
      const x = Pp.stg[i] ? Pp.x[i] : Pp.r[i] * Math.cos(Pp.ph[i]);
      const zc = Pp.stg[i] ? Pp.y[i] : Pp.r[i] * Math.sin(Pp.ph[i]);
      pos[i * 3] = x;
      pos[i * 3 + 1] = -Pp.z[i];
      pos[i * 3 + 2] = zc;
      const c = Pp.t[i] ? [0.72, 0.45, 1] : Pp.stg[i] ? [0.55, 0.8, 1] : [1, 0.86, 0.3];
      col.set(winter ? [0.85, 0.9, 0.97] : c, i * 3);
    }
    W.pts.geometry.attributes.position.needsUpdate = true;
    W.pts.geometry.attributes.color.needsUpdate = true;
  }

  /* ── нүх сүвний томруулсан харагдац ── */
  type Grain = { x: number; y: number; r: number; c: number[]; e: number; a: number };
  type Grid = { list: Grain[]; grid: Grain[][]; cs: number; cols: number; rows: number };
  const micro = {
    depth: 3, r: 0.3, grains: {} as Record<string, Grid>,
    solutes: [] as { x: number; y: number }[],
    bugs: [] as { x: number; y: number; st: number; al: number; an: number }[],
    info: "",
  };
  /* ширхэгийн радиус (px, 600 px ≈ 2.5 мм) ба бүрхэц */
  const GR: Record<string, [number, number, number]> = {
    sand: [40, 68, 0.6], lsand: [30, 56, 0.6], sloam: [14, 48, 0.58], loam: [10, 32, 0.58], cloam: [7, 20, 0.6],
    silt: [6, 24, 0.6], sil: [8, 28, 0.58], scl: [12, 40, 0.58], sicl: [6, 20, 0.6], sc: [8, 26, 0.6], sic: [5, 16, 0.62], clay: [5, 16, 0.62],
  };
  function grainsFor(tk: string): Grid {
    if (micro.grains[tk]) return micro.grains[tk];
    const [r0, r1, cov] = GR[tk];
    const W = mcv.width;
    const H = mcv.height;
    const rnd = rng(11 + tk.length);
    const out: Grain[] = [];
    let area = 0;
    for (let n = 0; n < 30000 && area < cov * W * H; n++) {
      const rr = r0 + (r1 - r0) * Math.pow(rnd(), 1.6);
      const x = rnd() * W;
      const y = rnd() * H;
      let ok = true;
      for (const q of out) {
        const dx = q.x - x;
        const dy = q.y - y;
        const m = q.r + rr + 2;
        if (dx * dx + dy * dy < m * m) {
          ok = false;
          break;
        }
      }
      if (ok) {
        out.push({ x, y, r: rr, c: [(150 + rnd() * 60) | 0, (120 + rnd() * 55) | 0, (80 + rnd() * 45) | 0], e: 0.75 + rnd() * 0.4, a: rnd() * 3 });
        area += Math.PI * rr * rr;
      }
    }
    const cs = 40;
    const cols = Math.ceil(W / cs);
    const rows = Math.ceil(H / cs);
    const grid: Grain[][] = [...Array(cols * rows)].map(() => []);
    for (const q of out) {
      const x0 = Math.max(0, Math.floor((q.x - q.r) / cs));
      const x1 = Math.min(cols - 1, Math.floor((q.x + q.r) / cs));
      const y0 = Math.max(0, Math.floor((q.y - q.r) / cs));
      const y1 = Math.min(rows - 1, Math.floor((q.y + q.r) / cs));
      for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) grid[j * cols + i].push(q);
    }
    return (micro.grains[tk] = { list: out, grid, cs, cols, rows });
  }
  function nearest(G: Grid, x: number, y: number): [Grain | null, number] {
    const i = Math.min(G.cols - 1, Math.max(0, Math.floor(x / G.cs)));
    const j = Math.min(G.rows - 1, Math.max(0, Math.floor(y / G.cs)));
    let best: Grain | null = null;
    let bd = 1e9;
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= G.cols || jj >= G.rows) continue;
        for (const q of G.grid[jj * G.cols + ii]) {
          const d = Math.hypot(q.x - x, q.y - y) - q.r;
          if (d < bd) {
            bd = d;
            best = q;
          }
        }
      }
    return [best, bd];
  }
  type MicroState = { zone: "gw" | "pit" | "soil"; Se: number; v: number; dir: number[]; cN: number; eLog: number; tk: string; th: number };
  function microState(): MicroState | null {
    const W = world;
    if (!W || !snap || !P) return null;
    const F = W.F;
    const r = W.r;
    const z = micro.depth;
    const rr = micro.r;
    /* ⚠ Ширхэг нь ТЭР ГҮНИЙ давхаргынх (давхаргатай багана) */
    const tk: string = F?.lay ? F.lay[Math.min(F.nz - 1, Math.max(0, Math.floor(z / F.h)))].cls : MATS[P.mat].t;
    if (z >= W.gw) return { zone: "gw", Se: 1, v: (P.kaq * P.grad) / 0.25, dir: [1, 0], cN: Math.min(1, snap.Cgw / r.C0N), eLog: Math.min(snap.elog, C0E_LOG), tk, th: TEX[tk].ths };
    if (z < W.pit && rr < W.a) return { zone: "pit", Se: 1, v: 0, dir: [0, 1], cN: 1, eLog: C0E_LOG, tk, th: 1 };
    if (!F) return { zone: "soil", Se: 0.3, v: 0, dir: [0, 1], cN: 0, eLog: -9, tk, th: 0.2 };
    const i = Math.min(F.nr - 1, Math.floor(rr / F.h));
    const j = Math.min(F.nz - 1, Math.floor(z / F.h));
    const k = j * F.nr + i;
    if (F.typ[k]) return { zone: "pit", Se: 1, v: 0, dir: [0, 1], cN: 1, eLog: C0E_LOG, tk, th: 1 };
    const th = r.TH[k];
    const Tt = TEX[tk];
    const Se = (th - Tt.thr) / (Tt.ths - Tt.thr);
    const vr = r.vR[k];
    const vz = r.vZ[k];
    const v = Math.hypot(vr, vz);
    const qn = snap.qN ? snap.qN[k] : 0;
    const qe = snap.qE ? snap.qE[k] : 0;
    return {
      zone: "soil", Se, th, v, dir: v > 0 ? [vr / v, vz / v] : [0, 1],
      cN: qn ? Math.pow(10, ((qn - 1) / 254) * 3) / 1000 : 0, eLog: qe ? ((qe - 1) / 254) * C0E_LOG : -9, tk,
    };
  }
  function drawMicro(dt: number) {
    const s = microState();
    if (!s) return;
    const g = mctx;
    const W = mcv.width;
    const H = mcv.height;
    const G = grainsFor(s.tk);
    const frozen = winter && micro.depth < 2.5 && s.zone !== "gw";
    const film = 4 + s.Se * (GR[s.tk][0] * 0.8 + 14);
    g.fillStyle = frozen ? "#3a3a40" : "#2a2118";
    g.fillRect(0, 0, W, H);
    /* ус (ширхэгийн гадаргын хальс) */
    g.fillStyle = frozen
      ? "rgba(215,232,250,.85)"
      : s.zone === "gw" || s.zone === "pit"
        ? s.zone === "pit"
          ? "rgba(95,85,40,.95)"
          : "rgba(70,140,215,.9)"
        : "rgba(95,170,240,.8)";
    if (s.zone === "gw" || s.zone === "pit") g.fillRect(0, 0, W, H);
    else {
      g.beginPath();
      for (const q of G.list) {
        g.moveTo(q.x + q.r + film, q.y);
        g.arc(q.x, q.y, q.r + film, 0, 6.3);
      }
      g.fill();
    }
    /* нитрат — ууссан бодис */
    if (s.cN > 0.0005 && s.zone !== "pit") {
      const t = Math.max(0, Math.log10(s.cN * 1000) / 3);
      const c = rampC(RN3, t);
      g.fillStyle = `rgba(${c},${0.25 + 0.45 * t})`;
      if (s.zone === "gw") g.fillRect(0, 0, W, H);
      else {
        g.beginPath();
        for (const q of G.list) {
          g.moveTo(q.x + q.r + film * 0.8, q.y);
          g.arc(q.x, q.y, q.r + film * 0.8, 0, 6.3);
        }
        g.fill();
      }
    }
    /* ширхэг */
    for (const q of G.list) {
      const gr = g.createRadialGradient(q.x - q.r * 0.35, q.y - q.r * 0.35, q.r * 0.1, q.x, q.y, q.r);
      gr.addColorStop(0, `rgb(${Math.min(255, q.c[0] + 45)},${Math.min(255, q.c[1] + 40)},${Math.min(255, q.c[2] + 35)})`);
      gr.addColorStop(1, `rgb(${(q.c[0] * 0.6) | 0},${(q.c[1] * 0.6) | 0},${(q.c[2] * 0.6) | 0})`);
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(q.x, q.y, q.r, q.r * q.e, q.a, 0, 6.3);
      g.fill();
    }
    /* хөдлөх бөөмс */
    const nS = s.zone === "pit" ? 0 : Math.round(70 * Math.max(0, Math.log10(Math.max(s.cN, 1e-9) * 1000) / 3));
    const nB = Math.round((26 * Math.max(0, s.eLog)) / C0E_LOG);
    while (micro.solutes.length < nS) micro.solutes.push({ x: Math.random() * W, y: Math.random() * H });
    micro.solutes.length = nS;
    while (micro.bugs.length < nB) micro.bugs.push({ x: Math.random() * W, y: Math.random() * H, st: 0, al: 1, an: Math.random() * 3 });
    micro.bugs.length = nB;
    const move = !frozen && s.zone !== "pit";
    const sp = move ? 18 + 90 * Math.min(1, s.v / 0.05) : 0;
    const dir = s.zone === "gw" ? [1, 0] : [s.dir[0] * 0.6, Math.max(0.3, s.dir[1])];
    const stay = (p: { x: number; y: number }) => {
      if (s.zone === "gw") return;
      const [q, d] = nearest(G, p.x, p.y);
      if (!q) return;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const l = Math.hypot(dx, dy) || 1;
      if (d < 1) {
        p.x = q.x + (dx / l) * (q.r + 1.5);
        p.y = q.y + (dy / l) * (q.r + 1.5);
      } else if (d > film * 0.8) {
        p.x -= (dx / l) * (d - film * 0.6) * 0.5;
        p.y -= (dy / l) * (d - film * 0.6) * 0.5;
      }
    };
    g.fillStyle = "#ffd23c";
    g.strokeStyle = "#5a2a00";
    g.lineWidth = 1.5;
    for (const p of micro.solutes) {
      if (move) {
        p.x += (dir[0] * sp + randn() * 25) * dt;
        p.y += (dir[1] * sp + randn() * 25) * dt;
        stay(p);
        if (p.y > H) {
          p.y -= H;
          p.x = Math.random() * W;
        }
        if (p.y < 0) p.y += H;
        if (p.x > W) p.x -= W;
        if (p.x < 0) p.x += W;
      }
      g.beginPath();
      g.arc(p.x, p.y, 5, 0, 6.3);
      g.fill();
      g.stroke();
    }
    for (const b of micro.bugs) {
      if (move && b.st === 0) {
        b.x += (dir[0] * sp * 0.55 + randn() * 18) * dt;
        b.y += (dir[1] * sp * 0.55 + randn() * 18) * dt;
        b.an += randn() * 0.2;
        stay(b);
        const [q, d] = nearest(G, b.x, b.y);
        if (q && d < 3 && Math.random() < 0.02) b.st = 1;
        if (b.y > H) {
          b.y -= H;
          b.x = Math.random() * W;
        }
        if (b.x > W) b.x -= W;
        if (b.x < 0) b.x += W;
      }
      if (b.st === 1 && move) {
        b.al -= dt * 0.35;
        if (b.al <= 0.05) {
          b.x = Math.random() * W;
          b.y = 0;
          b.st = 0;
          b.al = 1;
        }
      }
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.an);
      g.globalAlpha = b.al;
      g.fillStyle = b.st ? "#8c7aa8" : "#a46cf0";
      g.strokeStyle = "#3c1f73";
      g.lineWidth = 2;
      g.beginPath();
      g.rect(-12, -4.5, 24, 9);
      g.fill();
      g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
    if (frozen) {
      g.fillStyle = "rgba(255,255,255,.9)";
      /* ⚠ Зураг 196px-д жижгэрдэг тул бичвэр томоор (≈ 12px дэлгэцэн дээр) */
      g.font = `600 38px ${FONT}`;
      g.fillText("Хөлдсөн", 20, 52);
    }
    g.fillStyle = "rgba(255,255,255,.85)";
    g.fillRect(W - 250, H - 24, 240, 7);
    g.font = `600 34px ${FONT}`;
    g.fillText("1 мм", W - 170, H - 36);
    const zl = s.zone === "gw" ? "Гүний ус" : s.zone === "pit" ? "Нүхний шингэн" : `Хөрс: ${TEX[s.tk].n}`;
    const r = world.r as SimResult;
    const mg = s.zone === "pit" ? r.C0N : s.zone === "gw" ? snap!.Cgw : s.cN * r.C0N;
    /* Хоёр мөр: хаана, юу — чийг, урсгалын хурд хасагдсан (компонентын тэмдэглэлийг үз) */
    const info =
      `${zl}\n` +
      `Нитрат ${mg < 10 ? mg.toFixed(1) : Math.round(mg).toLocaleString()} мг/л · E.coli ${s.eLog < 0 ? "байхгүй" : `10^${s.eLog.toFixed(1)}`}`;
    if (info !== micro.info) {
      micro.info = info;
      opts.onMicro(info);
    }
  }
  function placeMarker() {
    if (!world) return;
    const m = world.marker;
    m.position.set(micro.r, -micro.depth, 0.02);
    m.rotation.set(0, 0, 0);
  }
  const ray = new THREE.Raycaster();
  function pick(e: PointerEvent) {
    if (!world) return;
    const rc = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(v, camera);
    const h = ray.intersectObjects([world.faceA, world.faceB])[0];
    if (!h) return;
    const p = h.point;
    micro.depth = Math.max(0, Math.min(world.Db - 0.05, -p.y));
    micro.r = h.object === world.faceA ? p.x : p.z;
    const m = world.marker;
    if (h.object === world.faceA) {
      m.position.set(p.x, p.y, 0.02);
      m.rotation.set(0, 0, 0);
    } else {
      m.position.set(0.02, p.y, p.z);
      m.rotation.set(0, Math.PI / 2, 0);
    }
    opts.onDepth(micro.depth);
  }

  /* ── гол давталт ── */
  function loop(t: number) {
    if (!alive || paused) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    if (st.dirty && R_) {
      build();
      if (snap) update(snap);
    }
    stepDrops(dt);
    controls.update();
    renderer.render(scene, camera);
    drawMicro(dt);
  }
  function update(s: Snap) {
    snap = s;
    if (!R_) return;
    if (st.dirty || !world) build();
    if (!world) return;
    const w = isWinter(s.d);
    if (w !== winter) {
      winter = w;
      world.groundTex.image = winter ? world.groundW : world.groundS;
      world.groundTex.needsUpdate = true;
    }
    paintCuts(s);
    const bad = s.Cgw >= NORM_N;
    world.wtMat.color.set(bad ? 0x7d5aa8 : 0x2f7fc0);
    world.volMat.color.set(bad ? 0x7d5aa8 : 0x3f86c8);
  }
  lastT = performance.now();
  raf = requestAnimationFrame(loop);

  return {
    setRun(r, p, profiles) {
      R_ = r;
      P = p;
      PROFILES = profiles;
      st.dirty = true;
    },
    update,
    setSpecies(s) {
      st.species = s;
      if (snap) paintCuts(snap);
    },
    setDrops(on) {
      st.drops = on;
      if (world?.pts) world.pts.visible = on;
    },
    frame,
    setDepth(m) {
      micro.depth = m;
      if (world) micro.r = Math.min(micro.r, world.R);
      placeMarker();
    },
    depthMax: () => (world ? world.Db : 10),
    pause() {
      paused = true;
      cancelAnimationFrame(raf);
    },
    resume() {
      if (!paused || !alive) return;
      paused = false;
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      clear();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
