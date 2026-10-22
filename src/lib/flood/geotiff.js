// Minimal single-band Float32 GeoTIFF writer (EPSG:3857, uncompressed, one strip per row block).
// Opens directly in ArcGIS Pro / QGIS.
export function writeGeoTIFF({ width, height, rows, x0, y1, res, nodata = -9999 }) {
  // rows: array of Float32Array chunks covering the image top-to-bottom
  const dataBytes = width * height * 4;
  const tags = [];
  const add = (tag, type, count, value) => tags.push({ tag, type, count, value });
  const SHORT = 3, LONG = 4, DOUBLE = 12, ASCII = 2;
  const nodataStr = String(nodata) + '\0';
  const geoKeys = [1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, 3857];

  add(256, LONG, 1, width);
  add(257, LONG, 1, height);
  add(258, SHORT, 1, 32);
  add(259, SHORT, 1, 1);
  add(262, SHORT, 1, 1);
  add(273, LONG, 1, 0);           // StripOffsets, patched below
  add(277, SHORT, 1, 1);
  add(278, LONG, 1, height);
  add(279, LONG, 1, dataBytes);
  add(284, SHORT, 1, 1);
  add(339, SHORT, 1, 3);          // SampleFormat = IEEE float
  add(33550, DOUBLE, 3, [res, res, 0]);
  add(33922, DOUBLE, 6, [0, 0, 0, x0, y1, 0]);
  add(34735, SHORT, geoKeys.length, geoKeys);
  add(42113, ASCII, nodataStr.length, nodataStr);
  tags.sort((a, b) => a.tag - b.tag);

  const size = { [SHORT]: 2, [LONG]: 4, [DOUBLE]: 8, [ASCII]: 1 };
  const ifdOff = 8;
  const ifdLen = 2 + tags.length * 12 + 4;
  let extraOff = ifdOff + ifdLen;
  for (const t of tags) {
    const n = size[t.type] * t.count;
    if (n > 4) { t.offset = extraOff; extraOff += n + (n & 1); }
  }
  const dataOff = extraOff + ((8 - (extraOff % 8)) % 8);
  tags.find(t => t.tag === 273).value = dataOff;

  const head = new ArrayBuffer(dataOff);
  const v = new DataView(head);
  v.setUint16(0, 0x4949); v.setUint16(2, 42, true); v.setUint32(4, ifdOff, true);
  v.setUint16(ifdOff, tags.length, true);
  let p = ifdOff + 2;
  const writeVals = (off, t) => {
    const vals = t.type === ASCII ? [...t.value].map(ch => ch.charCodeAt(0)) : [].concat(t.value);
    vals.forEach((x, i) => {
      const o = off + i * size[t.type];
      if (t.type === SHORT) v.setUint16(o, x, true);
      else if (t.type === LONG) v.setUint32(o, x, true);
      else if (t.type === DOUBLE) v.setFloat64(o, x, true);
      else v.setUint8(o, x);
    });
  };
  for (const t of tags) {
    v.setUint16(p, t.tag, true); v.setUint16(p + 2, t.type, true); v.setUint32(p + 4, t.count, true);
    if (t.offset) { v.setUint32(p + 8, t.offset, true); writeVals(t.offset, t); }
    else writeVals(p + 8, t);
    p += 12;
  }
  v.setUint32(p, 0, true);
  return new Blob([head, ...rows], { type: 'image/tiff' });
}
