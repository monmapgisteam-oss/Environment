/**
 * Холбогдсон дата эх сурвалжийн бүртгэл.
 *
 * ЗӨВХӨН БОДИТООР ХОЛБОГДСОН үйлчилгээ энд байна — хүлээгдэж буй эсвэл
 * төлөвлөж буй эх сурвалжийг бүү бич. Хэлтэс `live` болох бүрд нэг мөр
 * нэмэгдэнэ.
 */

import { ASSESSMENT_SERVICE } from "@/lib/assessment";
import { DAMAGED_SERVICE } from "@/lib/damaged";
import { ECO_SERVICE, PARCELS_SERVICE } from "@/lib/eco-corridors";
import { FLOODPLAIN_SERVICE } from "@/lib/floodplains";
import { FOREST_FUND_SERVICE } from "@/lib/forest-fund";
import { FOREST_GOODS_SERVICE } from "@/lib/forest-goods";
import { FOREST_TYPES_SERVICE } from "@/lib/forest-types";
import { chemicalService } from "@/lib/chemicals";
import { REPAIR_SERVICE } from "@/lib/repair-shops";
import {
  PROTECTED_MAPPING_SERVICE,
  PROTECTED_OFFICIAL_SERVICE,
} from "@/lib/protected-areas";
import { LICENSES_SERVICE } from "@/lib/licenses";
import { LICHENS_SERVICE } from "@/lib/lichens";
import { MARMOT_SERVICES } from "@/lib/marmots";
import { MINERALS_SERVICE } from "@/lib/minerals";
import { PETITIONS_SERVICE } from "@/lib/petitions";
import { POLES_SERVICE } from "@/lib/poles";
import { RECLAMATION_SERVICES } from "@/lib/reclamation";
import { RESCUES_SERVICE } from "@/lib/rescues";
import { SOIL_SERVICES } from "@/lib/soil";
import { STICKERS_SERVICE } from "@/lib/stickers";
import { CITY_SERVICE, PIT_SERVICE } from "@/lib/toilets";
import { BOMT_SERVICE } from "@/lib/bomt";
import { NEUTRALIZATION_SERVICE } from "@/lib/neutralization";
import { WATER_SERVICE } from "@/lib/water-contracts";
import { WELLS_SERVICE } from "@/lib/wells";
import { WILDLIFE_SERVICE } from "@/lib/wildlife";

export type Source = {
  /** Аль хэлтсийн эх сурвалж вэ */
  slug: string;
  name: string;
  /** Эх сурвалжийн төрөл — хэрхэн ирж байгааг нэг үгээр */
  kind: string;
  url: string;
};

export const SOURCES: Source[] = [
  {
    slug: "nogoon-bus",
    name: "Өрөмдмөл худгийн бүртгэл 2015–2024",
    kind: "ArcGIS FeatureServer",
    url: WELLS_SERVICE,
  },
  {
    slug: "nogoon-bus",
    name: "Ус ашиглах гэрээ",
    kind: "ArcGIS FeatureServer",
    url: WATER_SERVICE,
  },
  {
    slug: "nogoon-bus",
    name: "Голын татам",
    kind: "ArcGIS FeatureServer",
    url: FLOODPLAIN_SERVICE,
  },
  {
    slug: "amitan-urgamal",
    name: "Зэрлэг амьтны дуудлагын бүртгэл",
    kind: "ArcGIS Survey123",
    url: WILDLIFE_SERVICE,
  },
  {
    slug: "amitan-urgamal",
    name: "Аврагдсан зэрлэг амьтад 2019–2026",
    kind: "ArcGIS FeatureServer",
    url: RESCUES_SERVICE,
  },
  {
    slug: "amitan-urgamal",
    name: "Экологийн коридор 2024",
    kind: "ArcGIS FeatureServer",
    url: ECO_SERVICE,
  },
  {
    slug: "amitan-urgamal",
    name: "Нэгж талбар — коридортой давхцсаныг нь",
    kind: "ArcGIS FeatureServer",
    url: PARCELS_SERVICE,
  },
  {
    slug: "amitan-urgamal",
    name: "Цахилгаан дамжуулах 10, 15 кВ-ын шонгууд",
    kind: "ArcGIS FeatureServer",
    url: POLES_SERVICE,
  },
  {
    slug: "amitan-urgamal",
    name: "Стикер байршуулсан барилга",
    kind: "ArcGIS FeatureServer",
    url: STICKERS_SERVICE,
  },
  {
    slug: "amitan-urgamal",
    name: "Шилжүүлэн нутагшуулсан тарвага — барьсан цэг",
    kind: "ArcGIS FeatureServer",
    url: MARMOT_SERVICES[0],
  },
  {
    slug: "amitan-urgamal",
    name: "Шилжүүлэн нутагшуулсан тарвага — тавьсан цэг",
    kind: "ArcGIS FeatureServer",
    url: MARMOT_SERVICES[1],
  },
  {
    slug: "amitan-urgamal",
    name: "Байгалийн ургамлын олон янз байдал — хаг",
    kind: "ArcGIS FeatureServer",
    url: LICHENS_SERVICE,
  },
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
  {
    slug: "oi",
    name: "Ойн сангийн талбай",
    kind: "ArcGIS FeatureServer",
    url: FOREST_FUND_SERVICE,
  },
  {
    slug: "oi",
    name: "Ойн төрлийн зураглал",
    kind: "ArcGIS FeatureServer",
    url: FOREST_TYPES_SERVICE,
  },
  {
    slug: "oi",
    name: "Ногоон бүс, ойн дагалт баялгийн тархалт",
    kind: "ArcGIS FeatureServer",
    url: FOREST_GOODS_SERVICE,
  },
  {
    slug: "oi",
    name: "Тусгай хамгаалалттай газар — албан бүртгэл",
    kind: "ArcGIS FeatureServer",
    url: `${PROTECTED_OFFICIAL_SERVICE}/2`,
  },
  {
    slug: "oi",
    name: "Тусгай хамгаалалт — зураглал (талбай, шугам, цэг)",
    kind: "ArcGIS FeatureServer",
    url: PROTECTED_MAPPING_SERVICE,
  },
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
    name: "Байгаль орчны ерөнхий үнэлгээ — нэгж талбар",
    kind: "ArcGIS FeatureServer",
    url: ASSESSMENT_SERVICE,
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
