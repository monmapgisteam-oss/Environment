/**
 * Экологийн коридор — 2024 оны тогтоосон гурван талбай.
 *
 * Экологийн коридор гэдэг нь тасарсан амьдрах орчнуудыг холбож, амьтны
 * шилжилт хөдөлгөөнийг хангах зорилгоор тогтоосон бүс.
 *
 * Бүртгэл нь ердөө ГУРВАН олон өнцөгт: Баянзүрх дүүрэгт нэг, Сонгинохайрхан
 * дүүрэгт хоёр (А ба Б бүс). Нийт 20,352 га.
 *
 * Геометр нь ЖИЖИГ (бүтнээрээ 4KB) тул ерөнхийлөх шаардлагагүй — татмын
 * давхаргаас ялгаатай нь хүрээ нь энгийн, цөөн оройтой.
 *
 * Эх сурвалж нь KMZ файлаас хөрвүүлэгдсэн (`FolderPath` талбар үүнийг
 * хэлнэ) тул `Name` нь БҮТЭН ТОМ үсгээр бичигдсэн. Дахин найруулахгүй —
 * зөвхөн илүү зайг нь цэвэрлэнэ.
 *
 * ## Давхцаж буй нэгж талбар
 *
 * Гурван коридор нь ТӨЛӨВЛӨЖ буй бүс тул хамгийн чухал асуулт нь
 * "тэдгээрт аль нэгж талбарууд орж байна вэ" гэдэг. `Parcel_all`
 * давхарга нь **524,052** нэгж талбартай — бүхэлд нь татах боломжгүй.
 *
 * Тиймээс огтлолцлыг СЕРВЕРТ бодуулна: коридорын геометрийг асуулгын
 * хүрээ болгож (`spatialRel=esriSpatialRelIntersects`) явуулахад ArcGIS
 * зөвхөн ДАВХЦСАН талбаруудыг буцаана — гурван коридорт нийт 1,022
 * ширхэг. Хүрээний геометр URL-д багтахааргүй урт тул `POST`-оор.
 */

const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";
const LAYER = "Eco_korridor_2024";

export const ECO_SERVICE = `${HOST}/${LAYER}/FeatureServer/0`;

export type EcoCorridor = {
  oid: number;
  /** "БЗД ЭКО КОРИДОР 3" */
  name: string;
  district: string;
  /** Бүсийн тэмдэглэгээ — "А бүс", "Б бүс", "БЗД бүс" */
  zone: string;
  /** Талбай, га */
  ha: number;
};

/** Коридортой давхцаж буй нэгж талбар */
export type EcoParcel = {
  oid: number;
  /** Аль коридортой давхцаж байна вэ (`EcoCorridor.oid`) */
  corridor: number;
  /** Нэгж талбарын дугаар */
  parcelId: string;
  /** Эрхийн төрөл — "эзэмших" / "ашиглах" */
  right: string;
  /** Газрын зориулалт — "Гэр, орон сууцны хашааны газар" гэх мэт */
  landuse: string;
  district: string;
  khoroo: string;
  /**
   * Нэгж талбарын БҮТЭН талбай, га.
   *
   * ⚠️ Энэ нь коридортой ДАВХЦСАН хэсгийн талбай БИШ — талбар нь
   * коридорын хилээс гадагш үргэлжилж болно. Давхцлын яг талбайг
   * бодуулах нь тусдаа геометрийн үйлдэл шаардана.
   */
  ha: number;
};

export type EcoData = {
  rows: EcoCorridor[];
  /** Газрын зурагт — `id` нь `oid`-тай тэнцүү */
  shapes: GeoJSON.FeatureCollection;
  /** Коридорт давхцаж буй нэгж талбарууд */
  parcels: EcoParcel[];
  /** Тэдгээрийн хүрээ — `id` нь `EcoParcel.oid`-тай тэнцүү */
  parcelShapes: GeoJSON.FeatureCollection;
};

type Props = {
  OBJECTID: number;
  Name?: string;
  Дүүрэг?: string;
  Бүс?: string;
  Талбай?: number;
};

/** Илүү зайг цэвэрлэнэ — эх бичвэрийг найруулахгүй */
const tidy = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export async function fetchEcoCorridors(): Promise<EcoData> {
  const url =
    `${ECO_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,Name,Дүүрэг,Бүс,Талбай",
      outSR: "4326",
      orderByFields: "OBJECTID",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Экологийн коридор татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  };

  const rows: EcoCorridor[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.OBJECTID);
    rows.push({
      oid,
      name: tidy(p.Name) || "—",
      district: tidy(p.Дүүрэг) || "Тодорхойгүй",
      zone: tidy(p.Бүс) || "Тодорхойгүй",
      ha: Number(p.Талбай) || 0,
    });

    if (!f.geometry) continue;
    shapes.push({
      type: "Feature",
      /* `feature-state`-д тоон `id` шаардлагатай */
      id: oid,
      properties: { oid },
      geometry: f.geometry,
    });
  }

  /* Талбайгаар — том нь эхэндээ */
  rows.sort((a, b) => b.ha - a.ha);

  const { parcels, parcelShapes } = await fetchParcels();

  return {
    rows,
    shapes: { type: "FeatureCollection", features: shapes },
    parcels,
    parcelShapes,
  };
}

/* --------------------------------------------------------------------------
   Давхцаж буй нэгж талбар
   -------------------------------------------------------------------------- */

export const PARCELS_SERVICE = `${HOST}/Parcel_all/FeatureServer/0`;
const PARCELS = `${PARCELS_SERVICE}/query`;

type ParcelProps = {
  OBJECTID: number;
  parcel_id?: string;
  rigth_type?: string;
  landuse_de?: string;
  address_kh?: string;
  soum?: string;
  Shape__Area?: number;
};

/**
 * Коридор бүрийн хүрээг Esri-ийн `rings` хэлбэрээр авна.
 *
 * GeoJSON-оос хөрвүүлэхгүй: цагирагийн эргэлтийн ЧИГЛЭЛ хоёр хэлбэрт
 * эсрэг (GeoJSON гадна цагираг нь цагийн зүүний эсрэг, Esri нь цагийн
 * зүүний дагуу) тул буруу хөрвүүлбэл асуулга нь коридорын ГАДНА талыг
 * шүүх эрсдэлтэй. Тусдаа нэг жижиг хүсэлт нь найдвартай.
 */
async function corridorRings(): Promise<{ oid: number; rings: number[][][] }[]> {
  const url =
    `${ECO_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID",
      outSR: "4326",
      f: "json",
    });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Коридорын хүрээ татагдсангүй (${res.status})`);
  const json = (await res.json()) as {
    features?: { attributes: { OBJECTID: number }; geometry?: { rings: number[][][] } }[];
  };
  return (json.features ?? [])
    .filter((f) => f.geometry)
    .map((f) => ({ oid: f.attributes.OBJECTID, rings: f.geometry!.rings }));
}

async function fetchParcels(): Promise<{
  parcels: EcoParcel[];
  parcelShapes: GeoJSON.FeatureCollection;
}> {
  const corridors = await corridorRings();

  /* Гурван коридорыг ЗЭРЭГ асууна — дараалуулах шалтгаан алга */
  const pages = await Promise.all(
    corridors.map(async (c) => {
      const body = new URLSearchParams({
        geometry: JSON.stringify({ rings: c.rings, spatialReference: { wkid: 4326 } }),
        geometryType: "esriGeometryPolygon",
        inSR: "4326",
        outSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        where: "1=1",
        outFields:
          "OBJECTID,parcel_id,rigth_type,landuse_de,address_kh,soum,Shape__Area",
        resultRecordCount: "2000",
        f: "geojson",
      });
      const res = await fetch(PARCELS, { method: "POST", body });
      if (!res.ok) throw new Error(`Нэгж талбар татагдсангүй (${res.status})`);
      const json = (await res.json()) as {
        features?: { properties: ParcelProps; geometry: GeoJSON.Geometry | null }[];
      };
      return { corridor: c.oid, features: json.features ?? [] };
    }),
  );

  const parcels: EcoParcel[] = [];
  const shapes: GeoJSON.Feature[] = [];
  /* Нэг талбар хоёр коридортой давхцаж болно — эхний тохиолдлыг үлдээнэ,
     эс тэгвээс газрын зурагт хоёр удаа зурагдаж, тоо нь хоёр дахин болно */
  const seen = new Set<number>();

  for (const { corridor, features } of pages) {
    for (const f of features) {
      const p = f.properties;
      const oid = Number(p.OBJECTID);
      if (seen.has(oid)) continue;
      seen.add(oid);

      parcels.push({
        oid,
        corridor,
        parcelId: tidy(p.parcel_id) || "—",
        right: tidy(p.rigth_type) || "Тодорхойгүй",
        landuse: tidy(p.landuse_de) || "Тодорхойгүй",
        district: tidy(p.soum) || "Тодорхойгүй",
        khoroo: tidy(p.address_kh),
        /* `Shape__Area` нь м² (UTM 48N) */
        ha: (Number(p.Shape__Area) || 0) / 10000,
      });

      if (!f.geometry) continue;
      shapes.push({
        type: "Feature",
        id: oid,
        properties: { oid },
        geometry: f.geometry,
      });
    }
  }

  parcels.sort((a, b) => b.ha - a.ha);
  return { parcels, parcelShapes: { type: "FeatureCollection", features: shapes } };
}
