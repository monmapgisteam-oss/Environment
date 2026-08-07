/**
 * Холбогдсон дата эх сурвалжийн бүртгэл.
 *
 * ЗӨВХӨН БОДИТООР ХОЛБОГДСОН үйлчилгээ энд байна — хүлээгдэж буй эсвэл
 * төлөвлөж буй эх сурвалжийг бүү бич. Хэлтэс `live` болох бүрд нэг мөр
 * нэмэгдэнэ.
 */

import { RESCUES_SERVICE } from "@/lib/rescues";
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
];
