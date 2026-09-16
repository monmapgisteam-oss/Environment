/**
 * Холбогдсон дата эх сурвалжийн бүртгэл.
 *
 * ЗӨВХӨН БОДИТООР ХОЛБОГДСОН үйлчилгээ энд байна — хүлээгдэж буй эсвэл
 * төлөвлөж буй эх сурвалжийг бүү бич. Хэлтэс `live` болох бүрд нэг мөр
 * нэмэгдэнэ.
 */

import { ASSESSMENT_SERVICES } from "@/lib/assessment";
import { DAMAGED_SERVICE } from "@/lib/damaged";
import { PARCELS_SERVICE } from "@/lib/eco-corridors";
import { FOREST } from "@/lib/forest-layers";
import { layerName, serviceOf, type LayerSet } from "@/lib/portal-layers";
import { NOGOON } from "@/lib/nogoon-layers";
import { WILDLIFE } from "@/lib/wildlife-layers";
import { UNELGEE_ALL } from "@/lib/unelgee-layers";
import { chemicalService } from "@/lib/chemicals";
import { REPAIR_SERVICE } from "@/lib/repair-shops";
import { LICENSES_SERVICE } from "@/lib/licenses";
import { MINERALS_SERVICE } from "@/lib/minerals";
import { PETITIONS_SERVICE } from "@/lib/petitions";
import { RECLAMATION_SERVICES } from "@/lib/reclamation";
import { SOIL_SERVICES } from "@/lib/soil";
import { CITY_SERVICE, PIT_SERVICE } from "@/lib/toilets";
import { BOMT_SERVICE } from "@/lib/bomt";
import { NEUTRALIZATION_SERVICE } from "@/lib/neutralization";

export type Source = {
  /** Аль хэлтсийн эх сурвалж вэ */
  slug: string;
  name: string;
  /** Эх сурвалжийн төрөл — хэрхэн ирж байгааг нэг үгээр */
  kind: string;
  url: string;
};

/**
 * Порталын бүртгэлийг эх сурвалжийн мөр болгоно.
 *
 * Нэр, хаяг хоёулаа бүртгэлээс гарах тул давхарга нэмэхэд энэ
 * жагсаалт ӨӨРӨӨ уртасна — хоёр газар гараар бичих шаардлагагүй.
 */
function portalSources(slug: string, set: LayerSet): Source[] {
  return set.layers.map((id) => ({
    slug,
    name: layerName(set, id),
    /* Порталаас гадуурх давхаргыг ӨӨР төрлөөр тэмдэглэнэ — хаяг нь
       өөр систем рүү заадаг тул "Enterprise" гэвэл худал болно */
    kind: set.services?.[id]
      ? "ArcGIS FeatureServer"
      : "ArcGIS Enterprise FeatureServer",
    url: serviceOf(set, id),
  }));
}

export const SOURCES: Source[] = [
  /*
    Хэлтсийн дата 2026-09-16-нд ПОРТАЛД шилжсэн. Хуучин гурван мөр
    хасагдав: `Us_ashiglah_geree`, `Tatam` хоёрын үйлчилгээ MUST
    дээрээс БАЙХГҮЙ болсон (амьдаар нь шалгасан, 400 "Invalid URL"),
    худгийнх нь ажиллаж байгаа ч таб нь порталын `N02` давхаргууд руу
    шилжсэн. Ажиллахгүй хаягийг эх сурвалжийн хуудсанд үлдээвэл
    хэрэглэгч түүнийг дагаад хоосон хуудас олно.
  */
  ...portalSources("nogoon-bus", NOGOON),
  /*
    Хэлтсийн долоон сэдэв 2026-09-16-нд ПОРТАЛД шилжсэн тул тэдгээр нь
    доорх `portalSources` жагсаалтад аль хэдийн орсон — энд дахин
    бичвэл нэг хаяг хоёр өөр нэрээр гарна. Зөвхөн нэгж талбарын
    давхарга ArcGIS Online дээр ХЭВЭЭР үлдсэн тул тусад нь бичигдэнэ.
  */
  {
    slug: "amitan-urgamal",
    name: "Нэгж талбар — коридортой давхцсаныг нь",
    kind: "ArcGIS FeatureServer",
    url: PARCELS_SERVICE,
  },
  ...portalSources("amitan-urgamal", WILDLIFE),
  {
    slug: "orchin",
    name: "Нүхэн жорлонгийн бүртгэл, орчны үнэлгээ",
    kind: "ArcGIS FeatureServer",
    url: PIT_SERVICE,
  },
  {
    slug: "orchin",
    name: "Нийтийн бие засах газар",
    kind: "ArcGIS FeatureServer",
    url: CITY_SERVICE,
  },
  {
    slug: "orchin",
    name: "Хөрсний хяналт шинжилгээ — 2024, 500 цэг",
    kind: "ArcGIS FeatureServer",
    url: SOIL_SERVICES[0],
  },
  {
    slug: "orchin",
    name: "Хөрсний хяналт шинжилгээ — 2023, 500 цэг",
    kind: "ArcGIS FeatureServer",
    url: SOIL_SERVICES[1],
  },
  {
    slug: "orchin",
    name: "Хөрсний саармагжуулалт — 4 цэг",
    /* Бусад эх сурвалжаас ялгаатай: хост нь өөрөө гарын үсэг зурсан TLS
       гэрчилгээтэй тул хөтөч холбогдож чадахгүй. Дата нь `neutralization.ts`
       дотор хуулбараар хадгалагдаж байгаа. */
    kind: "ArcGIS FeatureServer · хуулбар",
    url: NEUTRALIZATION_SERVICE,
  },
  {
    slug: "orchin",
    name: "Нөхөн сэргээлт — аж ахуйн нэгжийн хөрөнгөөр",
    kind: "ArcGIS FeatureServer",
    url: RECLAMATION_SERVICES[0],
  },
  {
    slug: "orchin",
    name: "Нөхөн сэргээлт — нийслэлийн төсвөөр",
    kind: "ArcGIS FeatureServer",
    url: RECLAMATION_SERVICES[1],
  },
  {
    slug: "orchin",
    name: "Эвдэрсэн газрын талбай",
    kind: "ArcGIS FeatureServer",
    url: DAMAGED_SERVICE,
  },
  {
    slug: "orchin",
    name: "Өргөдлийн талбай, шийдвэрлэлт",
    kind: "ArcGIS FeatureServer",
    url: PETITIONS_SERVICE,
  },
  {
    slug: "orchin",
    name: "Түгээмэл тархацтай ашигт малтмалын тусгай зөвшөөрөл",
    kind: "ArcGIS FeatureServer",
    url: LICENSES_SERVICE,
  },
  {
    slug: "orchin",
    name: "Ашигт малтмалын тусгай зөвшөөрөлтэй талбай (нүүрс, алт)",
    kind: "ArcGIS FeatureServer",
    url: MINERALS_SERVICE,
  },
  ...portalSources("oi", FOREST),
  ...portalSources("unelgee-uur-amisgal", UNELGEE_ALL),
  {
    slug: "hyanalt",
    name: "Авто засварын үйлчилгээний цэг",
    kind: "ArcGIS FeatureServer",
    url: REPAIR_SERVICE,
  },
  {
    slug: "hyanalt",
    name: "Химийн хорт, аюултай бодисын агуулах 2023",
    kind: "ArcGIS FeatureServer",
    url: chemicalService(2023),
  },
  {
    slug: "hyanalt",
    name: "Химийн хорт, аюултай бодисын агуулах 2024",
    kind: "ArcGIS FeatureServer",
    url: chemicalService(2024),
  },
  {
    slug: "unelgee-uur-amisgal",
    name: "Байгаль орчны ерөнхий үнэлгээ 2025 — нэгж талбар",
    kind: "ArcGIS FeatureServer",
    url: ASSESSMENT_SERVICES[0].url,
  },
  {
    slug: "unelgee-uur-amisgal",
    name: "Байгаль орчны ерөнхий үнэлгээ 2026 — нэгж талбар",
    kind: "ArcGIS FeatureServer",
    url: ASSESSMENT_SERVICES[1].url,
  },
  {
    slug: "unelgee-uur-amisgal",
    name: "Байгаль орчны менежментийн төлөвлөгөө — 2026 оны нэгтгэл",
    /* Хост нь өөрөө гарын үсэг зурсан TLS гэрчилгээтэй тул хөтөч
       холбогдож чадахгүй. Дата нь `public/data/bomt-2026.json` дотор
       хуулбараар хадгалагдаж, бидний өөрийн эх сурвалжаас татагдана. */
    kind: "ArcGIS FeatureServer · хуулбар",
    url: BOMT_SERVICE,
  },
];
