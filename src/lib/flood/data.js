// Үерийн загварын статик өгөгдөл (`public/flood/data/`) ба тооцооны WebGL2 контекст —
// "Үерийн симуляци" (app.js) ба "Үер ба нэвчилт" (lib/soil-flood.ts) хоёулаа энэ нэг
// ачаалагчийг хэрэглэнэ: формат (gzip, f32 DEM, u8 растер) нэг газар задарна.
// ⚠ Статик файл тул энгийн fetch — портал биш, токен хэрэггүй (JS модульд lint-ийн хориг
// хамаарахгүй; TS талаас дуудагддаг нь яг энэ шалтгаанаар).
import { asset } from '@/lib/base-path';

/** @param {(msg: string) => void} [onMsg] ачаалалтын явцын бичвэр */
export async function loadFloodData(onMsg = () => {}) {
  onMsg('meta.json…');
  const meta = await (await fetch(asset('/flood/data/meta.json'))).json();
  const bin = async (name, label) => {
    onMsg(`${label} ачаалж байна…`);
    const r = await fetch(asset('/flood/data/' + name));
    if (!r.ok) throw new Error(name + ' олдсонгүй (' + r.status + ')');
    let buf = new Uint8Array(await r.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
      buf = new Uint8Array(await new Response(s).arrayBuffer());
    }
    return buf;
  };
  const demB = await bin('dem.f32', 'Өндрийн загвар (Copernicus GLO-30)');
  const dem = new Float32Array(demB.buffer, demB.byteOffset, meta.demW * meta.demH);
  const lc = await bin('lc.u8.gz', 'Газрын бүрхэвч (WorldCover)');
  const bld = await bin('bld.u8.gz', 'Барилга');
  const riv = await bin('riv.u8.gz', 'Гол горхи');
  onMsg('GPU бэлтгэж байна…');
  return { meta, dem, lc, bld, riv };
}

/** Тооцооны тусдаа WebGL2 контекст (зургийн контекстоос ангид). Дэмжихгүй бол алдаа шиднэ. */
export function createSolverGL() {
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1024, 1024) : Object.assign(document.createElement('canvas'), { width: 1024, height: 1024 });
  const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: !cv.transferToImageBitmap, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('Энэ хөтөч WebGL2 дэмжихгүй байна. Chrome / Edge-ийн сүүлийн хувилбарыг ашиглана уу.');
  return gl;
}
