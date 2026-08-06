/**
 * Засаг захиргааны хилүүд — улс, аймаг, сум.
 *
 * Эх сурвалж: тухайн байгууллагын ArcGIS дахь `aimagbnd` (22), `soumbnd` (339).
 * Улсын хилийн тусдаа давхарга БАЙХГҮЙ тул аймгийн олон өнцөгтөөс гаргаж авна:
 * хоёр аймгийн дундах ирмэг яг хоёр удаа, харин гадна талын ирмэг НЭГ удаа
 * тохиолдоно. (Шалгалт: 159,178 ирмэгийн 76.8% нь хоёр удаа, 23.2% нь нэг удаа
 * — өгөгдөл топологийн хувьд цэвэр.)
 */

const ORG = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/ArcGIS/rest/services";
const AIMAG = `${ORG}/aimagbnd/FeatureServer/9`;
const SOUM = `${ORG}/soumbnd/FeatureServer/8`;

type Ring = [number, number][];
type Geom =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

type EsriFeature = { geometry: Geom | null; properties: Record<string, unknown> };

export type BoundarySet = {
  /** Улсын хил — аймгийн олон өнцөгтийн гадна ирмэгээс гаргасан */
  country: GeoJSON.FeatureCollection;
  aimag: GeoJSON.FeatureCollection;
  soum: GeoJSON.FeatureCollection;
  fetchedAt: string;
};

async function query(
  base: string,
  params: Record<string, string>,
  /**
   * Бүтэн нарийвчлалтай хариу 13MB орчим байдаг бөгөөд Next-ийн дата кэш 2MB-аас
   * дээшхийг хадгалдаггүй тул кэшлэхийг оролдохгүй. Маршрутын түвшний кэш
   * (`revalidate = 86400`) хүчинтэй хэвээр — өдөрт нэг л удаа татагдана.
   */
  cacheable = true,
) {
  const url = `${base}/query?${new URLSearchParams({
    f: "geojson",
    where: "1=1",
    outSR: "4326",
    returnGeometry: "true",
    ...params,
  })}`;
  const res = await fetch(
    url,
    cacheable ? { next: { revalidate: 86400 } } : { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
  return (await res.json()) as { features?: EsriFeature[] };
}

/** Олон өнцөгтийг гадна контур болгож, зөвхөн нэрийг нь үлдээнэ */
function toLines(feats: EsriFeature[], nameField: string): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = [];
  for (const f of feats) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    const lines = polys.flatMap((p) => p);
    if (lines.length === 0) continue;
    out.push({
      type: "Feature",
      geometry: { type: "MultiLineString", coordinates: lines },
      properties: { name: String(f.properties?.[nameField] ?? "") },
    });
  }
  return { type: "FeatureCollection", features: out };
}

/* --------------------------------------------------------------------------
   Улсын хил: зөвхөн нэг удаа тохиолдсон ирмэгүүд
   -------------------------------------------------------------------------- */

const vkey = (p: [number, number]) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
const ekey = (a: [number, number], b: [number, number]) => {
  const A = vkey(a);
  const B = vkey(b);
  return A < B ? `${A}|${B}` : `${B}|${A}`;
};

function outerLines(feats: EsriFeature[]): Ring[] {
  const seen = new Map<string, number>();
  const rings: Ring[] = [];

  for (const f of feats) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const poly of polys) for (const ring of poly) rings.push(ring);
  }

  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const k = ekey(ring[i], ring[i + 1]);
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
  }

  /*
    Цэг бүрийг дахин холбож ээдрээтэй граф барих шаардлагагүй: олон өнцөгтийн
    дараалал аль хэдийн зөв тул зөвхөн НЭГ удаа тохиолдсон ирмэгүүдийн
    ДАРААЛСАН цувааг таслаж авахад бэлэн шугам гарна.
  */
  const out: Ring[] = [];
  for (const ring of rings) {
    let run: Ring = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const solo = seen.get(ekey(ring[i], ring[i + 1])) === 1;
      if (solo) {
        if (run.length === 0) run.push(ring[i]);
        run.push(ring[i + 1]);
      } else if (run.length > 1) {
        out.push(run);
        run = [];
      } else {
        run = [];
      }
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

/* --------------------------------------------------------------------------
   Douglas–Peucker — цэгийн тоог багасгана
   -------------------------------------------------------------------------- */

function simplify(pts: Ring, tol: number): Ring {
  if (pts.length < 3) return pts;

  let maxD = 0;
  let idx = 0;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;

  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let d: number;
    if (len2 === 0) {
      d = Math.hypot(px - ax, py - ay);
    } else {
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }

  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  return [
    ...simplify(pts.slice(0, idx + 1), tol).slice(0, -1),
    ...simplify(pts.slice(idx), tol),
  ];
}

export async function getBoundaries(): Promise<BoundarySet> {
  /*
    Улсын хилд БҮТЭН нарийвчлалтай геометр хэрэгтэй — ерөнхийлсөн хувилбар дээр
    хөрш аймгуудын оройнууд яг давхцахаа болих тул хуваалцсан ирмэг танигдахгүй.
    Татсаны дараа өөрсдөө сийрэгжүүлнэ.
  */
  const [aimagFull, aimagGen, soumGen] = await Promise.all([
    query(AIMAG, { outFields: "aimag_name" }, false),
    query(AIMAG, { outFields: "aimag_name", maxAllowableOffset: "0.004" }),
    query(SOUM, { outFields: "soum_name", maxAllowableOffset: "0.004" }),
  ]);

  const country = outerLines(aimagFull.features ?? [])
    .map((l) => simplify(l, 0.004))
    .filter((l) => l.length > 1);

  return {
    country: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "MultiLineString", coordinates: country },
          properties: { name: "Монгол Улс" },
        },
      ],
    },
    aimag: toLines(aimagGen.features ?? [], "aimag_name"),
    soum: toLines(soumGen.features ?? [], "soum_name"),
    fetchedAt: new Date().toISOString(),
  };
}
