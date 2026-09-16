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
 * Эх сурвалж нь KMZ файлаас хөрвүүлэгдсэн тул нэр нь БҮТЭН ТОМ үсгээр
 * бичигдсэн. Дахин найруулахгүй — зөвхөн илүү зайг нь цэвэрлэнэ.
 *
 * ⚠ **ЭХ СУРВАЛЖ ПОРТАЛД ШИЛЖСЭН** (хэрэглэгчийн шийдвэр, 2026-09-16):
 * ArcGIS Online дээрх `Eco_korridor_2024`-ээс `environment.ub.gov.mn`-ий
 * `A00_Ecology_korridor_2024` руу. Гурван олон өнцөгт ХЭВЭЭР; талбарын
 * нэр л өөрчлөгдсөн (`Name` → `name`, `Дүүрэг` → `дүүрэг`, `Талбай` →
 * `талбай`).
 *
 * ⚠⚠ **`Бүс` ТАЛБАРЫН ОРЛОГЧ БАЙХГҮЙ.** Шинэ давхаргын `bus_ner` нь
 * гурвын ЗӨВХӨН нэгд бөглөгдсөн бөгөөд тэнд нь `дүүрэг`-ийн утгыг
 * давтдаг тул задаргаа болохгүй. Оронд нь КОРИДОРЫН НЭР бүсийн
 * тэмдэглэгээ болов: хуучин `Бүс` нь ("БЗД бүс", "А бүс", "Б бүс") мөн
 * коридор тутамд НЭГ утгатай байсан тул задаргааны утга өөрчлөгдөхгүй.
 *
 * Шинэ давхаргад нэгтгэсэн үзүүлэлтүүд НЭМЭГДСЭН боловч гурвын нэгд л
 * бөглөгдсөн тул уншаагүй: `negj_talbar` (нэгж талбарын тоо),
 * `ortson_ga`, `irgen_too` / `turiin_too` / `huuliin_too`,
 * `nzd_too` / `dzd_too` / `szd_too`, `ezemshih_too` / `ashiglah_too`,
 * `nuhon_olgovor`. Давхардсан тоо харуулахаас татгалзав — доорх нэгж
 * талбарын задаргаа нь `Parcel_all`-аас БОДИТООР тоологдоно.
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

import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";

/**
 * ⚠ Нэгж талбарын давхарга (`Parcel_all`) нь ArcGIS Online дээр ХЭВЭЭР —
 * хэлтэс зөвхөн коридорыг порталд шилжүүлсэн. Огтлолцлын асуулга нь
 * коридорын ГЕОМЕТРИЙГ явуулдаг болохоос үйлчилгээ рүү заадаггүй тул
 * хоёр өөр сервер дээр байх нь саад биш.
 */
const HOST = "https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services";

export const ECO_SERVICE = `${layerService("A00_Ecology_korridor_2024")}/0`;

export type EcoCorridor = {
  oid: number;
  /** "БЗД ЭКО КОРИДОР 3" */
  name: string;
  district: string;
  /**
   * Бүсийн тэмдэглэгээ.
   *
   * Эх сурвалжид тусдаа багана БАЙХГҮЙ болсон тул коридорын нэр
   * (`name`) үүнийг үүрнэ — коридор тутамд нэг утга.
   */
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
  objectid: number;
  name?: string;
  дүүрэг?: string;
  талбай?: number;
};

/** Илүү зайг цэвэрлэнэ — эх бичвэрийг найруулахгүй */
const tidy = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export async function fetchEcoCorridors(): Promise<EcoData> {
  const url =
    `${ECO_SERVICE}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "objectid,name,дүүрэг,талбай",
      outSR: "4326",
      orderByFields: "objectid",
      resultRecordCount: "2000",
      f: "geojson",
    });

  const json = await arcgisJson<{
    features?: { properties: Props; geometry: GeoJSON.Geometry | null }[];
  }>(url, "Экологийн коридор");

  const rows: EcoCorridor[] = [];
  const shapes: GeoJSON.Feature[] = [];

  for (const f of json.features ?? []) {
    const p = f.properties;
    const oid = Number(p.objectid);
    const name = tidy(p.name) || "—";
    rows.push({
      oid,
      name,
      district: tidy(p.дүүрэг) || "Тодорхойгүй",
      zone: name,
      ha: Number(p.талбай) || 0,
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
      outFields: "objectid",
      outSR: "4326",
      f: "json",
    });
  const json = await arcgisJson<{
    features?: { attributes: { objectid: number }; geometry?: { rings: number[][][] } }[];
  }>(url, "Коридорын хүрээ");
  return (json.features ?? [])
    .filter((f) => f.geometry)
    .map((f) => ({ oid: f.attributes.objectid, rings: f.geometry!.rings }));
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
