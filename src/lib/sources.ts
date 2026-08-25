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
import { LICENSES_SERVICE } from "@/lib/licenses";
import { MINERALS_SERVICE } from "@/lib/minerals";
import { PETITIONS_SERVICE } from "@/lib/petitions";
import { RECLAMATION_SERVICES } from "@/lib/reclamation";
import { RESCUES_SERVICE } from "@/lib/rescues";
import { SOIL_SERVICES } from "@/lib/soil";
import { CITY_SERVICE, PIT_SERVICE } from "@/lib/toilets";
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
    name: "Нөхөн сэргээлт — ААН-ийн хөрөнгөөр",
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
    slug: "unelgee-uur-amisgal",
    name: "Байгаль орчны ерөнхий үнэлгээ — нэгж талбар",
    kind: "ArcGIS FeatureServer",
    url: ASSESSMENT_SERVICE,
  },
];
