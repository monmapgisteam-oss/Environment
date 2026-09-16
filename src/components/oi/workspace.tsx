"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/*
  Ойн хэлтэс — НЭГ харагдац.

  Урьд нь таван таб байсан: нэгдсэн зураг ба давхарга тус бүрийн дөрвөн
  самбар (ойн сан, ойн төрөл, дагалт баялаг, тусгай хамгаалалт).
  Тэдгээр дөрөв нь ArcGIS Online дээрх үйлчилгээнээс уншдаг байсан
  бөгөөд эх сурвалж нь 2026-09-14-нд УСТГАГДСАН — нээвэл алдаа л
  заана. Дата нь `environment.ub.gov.mn` порталын найман давхарга руу
  шилжсэн тул нэгдсэн зураг тэднийг бүгдийг агуулна.

  Ганц харагдацад таб зурвас илүүц: юу руу шилжихийг сонгох зүйл алга.
*/
const spinner = () => (
  <div className="flex h-full items-center justify-center rounded-xs border border-line bg-paper-2">
    <Loader2 size={16} className="animate-spin text-ink-3" />
  </div>
);

const LayersDashboard = dynamic(
  () => import("@/components/oi/layers-dashboard").then((m) => m.ForestLayersDashboard),
  { ssr: false, loading: spinner },
);

export function OiWorkspace() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <LayersDashboard />
    </div>
  );
}
