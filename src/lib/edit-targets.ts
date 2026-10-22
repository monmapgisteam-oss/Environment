/**
 * ЗАСВАРЛАХ ДАВХАРГЫН БҮРТГЭЛ — хэлтэс (`scope`) × өгөгдлийн багц (`tab`).
 *
 * Зүүн самбарын "Өгөгдөл засах" карт ({@link src/components/edit/edit-card.tsx})
 * сонгосон багцын давхаргуудыг эндээс авна (хэрэглэгч 2026-10-20: "ХЭЛТСИЙН
 * МЭДЭЭЛЭЛ Өгөгдлийн багц ene dotor bgaa feature edit hiih button").
 *
 * ⚠ ХАЯГИЙГ ДАХИН БИЧИХГҮЙ — самбар бүрийн ӨӨРИЙН экспортыг импортолно.
 * Хоёр газар бичвэл үйлчилгээ шилжихэд засварын цонх хуучин хаяг руу
 * заасаар үлдэнэ.
 *
 * ⚠ ЗӨВХӨН ПОРТАЛЫН ДАВХАРГА (`needsToken`): ArcGIS Online дээрх Survey123
 * маягт зэрэгт сессийн токен хүрэхгүй тул Esri-ийн нэвтрэх цонх гарна.
 *
 * ⚠ ДАВХАРГАГҮЙ БАГЦ (химийн үндэсний бүртгэл — гадны API, хяналт шалгалтын
 * схем — журам, цаг агаарын ажиглалт, эх сурвалж ирээгүй цэс) хоосон жагсаалт.
 * Карт нь тэр үед товчоо идэвхгүй болгоно.
 */

import { BEAR_LAYER } from "@/lib/bears";
import { BIOTECH_SERVICE } from "@/lib/biotech";
import { BOMT_SERVICE } from "@/lib/bomt";
import { chemicalService } from "@/lib/chemicals";
import { DAMAGED_SERVICE } from "@/lib/damaged";
import { ECO_SERVICE } from "@/lib/eco-corridors";
import { FLORA } from "@/lib/flora";
import { FOREST_TABS } from "@/lib/forest-layers";
import { WASTE as LANDFILL } from "@/lib/hyanalt-layers";
import { LICENSES_SERVICE } from "@/lib/licenses";
import { LICHENS_SERVICE } from "@/lib/lichens";
import { MARMOT_SERVICES } from "@/lib/marmots";
import { MINERALS_SERVICE } from "@/lib/minerals";
import { NEUTRALIZATION_SERVICE } from "@/lib/neutralization";
import { NOGOON_TABS } from "@/lib/nogoon-layers";
import { PETITIONS_SERVICE } from "@/lib/petitions";
import { POLES_SERVICE } from "@/lib/poles";
import { needsToken } from "@/lib/portal";
import { oklchHex } from "@/components/wells/colors";
import { layerName, layerService, serviceOf, type LayerSet } from "@/lib/portal-layers";
import { RECLAMATION_SERVICES } from "@/lib/reclamation";
import { REPAIR_SERVICE } from "@/lib/repair-shops";
import { RESCUES_SERVICE } from "@/lib/rescues";
import { SOIL_SERVICES } from "@/lib/soil";
import { STICKERS_SERVICE } from "@/lib/stickers";
import { CITY_SERVICE, PIT_SERVICE } from "@/lib/toilets";
import { ASSESSMENT_SERVICES } from "@/lib/assessment";
import { ECO, FLOOD, GAS, GREEN, WASTE } from "@/lib/unelgee-layers";
import { WILDLIFE_SOLO } from "@/lib/wildlife-layers";

/**
 * Засварлах нэг давхарга. `url` нь `…/FeatureServer/N` эсвэл дугааргүй
 * `…/FeatureServer` — сүүлийнх үед засварын цонх үйлчилгээний эхний
 * давхаргыг өөрөө уншина (порталд дугаар 0 биш байх нь элбэг).
 */
export type EditTarget = {
  title: string;
  url: string;
  form?: EditForm;
  /** Олон өнцөгт, шугамын өнгө — самбарынхтай ижил (`LayerSet`-ийн өнцөг) */
  color?: string;
  /**
   * Порталын хуваалцсан самбарын давхарга — засварын зураг самбарын өнгө,
   * шошгыг ЯГ ТЭР бүртгэлээс бодно ({@link src/components/edit/looks.ts}).
   * `environment` — үнэлгээний хэлтсийн харагдац (тод нарийн хүрээ, ангиллын өнгөгүй).
   */
  layer?: { set: LayerSet; id: string; environment?: boolean };
};

/**
 * ЗАСВАРЛАГЧИЙН нэмэлт тохиргоо ({@link src/components/edit/data-editor.tsx},
 * хэрэглэгч 2026-10-21). Өгөөгүй бол координат, засаг захиргааны талбарыг
 * засварлагч нэр, alias-аар нь өөрөө танина.
 *
 * ⚠ Талбарын НЭРИЙГ давхаргын тодорхойлолтоос шалгаж бичнэ — таамаглахгүй.
 */
export type EditForm = {
  /** Геометрээс автоматаар бөглөгдөх WGS84 уртраг, өргөрөгийн талбар */
  coords?: { lon: string; lat: string };
  /** Байршлаас (дүүрэг, хорооны хил) бөглөгдөх засаг захиргааны талбарууд */
  place?: { district?: string; khoroo?: string; code?: string };
  /** Хэрэглэгч бөглөхгүй нэмэлт талбар (системийн талбар өөрөө хасагдана) */
  hide?: RegExp;
};

/* Өнгө нь порталын самбарын `toneOfHue`-тэй ижил томьёо */
const fromSet = (set: LayerSet, environment = false): EditTarget[] =>
  set.layers.map((id, i) => ({
    title: layerName(set, id),
    url: serviceOf(set, id),
    layer: { set, id, environment },
    color: set.hues?.length ? oklchHex(set.toneL ?? 0.74, set.toneC ?? 0.15, set.hues[i % set.hues.length]) : undefined,
  }));

const one = (title: string, url: string): EditTarget[] => [{ title, url }];

const TARGETS: Record<string, (tab: string) => EditTarget[]> = {
  hyanalt: (tab) =>
    tab === "repair"
      ? one("Авто засварын үйлчилгээ", REPAIR_SERVICE)
      : tab === "landfill"
        ? fromSet(LANDFILL)
        : tab === "chemicals"
          ? [
              { title: "Химийн бодисын агуулах, 2023", url: chemicalService(2023) },
              { title: "Химийн бодисын агуулах, 2024", url: chemicalService(2024) },
            ]
          : [],

  orchin: (tab) =>
    tab === "sanitation"
      ? [
          { title: "Нүхэн жорлон", url: PIT_SERVICE },
          { title: "Нийтийн ариун цэврийн байгууламж", url: CITY_SERVICE },
        ]
      : tab === "soil"
        ? [
            { title: "Хөрсний хяналт, 2024", url: SOIL_SERVICES[0] },
            { title: "Хөрсний хяналт, 2023", url: SOIL_SERVICES[1] },
          ]
        : tab === "neutralization"
          ? [
              {
                title: "Саармагжуулалт",
                url: NEUTRALIZATION_SERVICE,
                /* Талбарыг токеноор шалгасан (2026-10-21): `уртраг_эх_бичлэг`,
                   `өргөрөг_эх_бичлэг` нь эх хүснэгтийн координатын бичвэр;
                   `duureg`, `khorooid`, `kh_mon` нь орон зайн нэгтгэлийн үлдэц */
                form: {
                  coords: { lon: "уртраг", lat: "өргөрөг" },
                  place: { district: "duureg", khoroo: "khorooid", code: "kh_mon" },
                  hide: /_эх_бичлэг$/,
                },
              },
            ]
          : tab === "reclamation"
            ? [
                { title: "Нөхөн сэргээлт — аж ахуйн нэгжийн хөрөнгө", url: RECLAMATION_SERVICES[0] },
                { title: "Нөхөн сэргээлт — нийслэлийн төсөв", url: RECLAMATION_SERVICES[1] },
              ]
            : tab === "damaged"
              ? one("Эвдэрсэн газар", DAMAGED_SERVICE)
              : tab === "petitions"
                ? one("Өргөдлийн бүртгэл", PETITIONS_SERVICE)
                : tab === "licenses"
                  ? one("Ашигт малтмалын тусгай зөвшөөрөл", LICENSES_SERVICE)
                  : tab === "minerals"
                    ? one("Нүүрс, алтны талбай", MINERALS_SERVICE)
                    : [],

  oi: (tab) => (FOREST_TABS[tab] ? fromSet(FOREST_TABS[tab]) : []),

  "nogoon-bus": (tab) => {
    const set = (NOGOON_TABS as Record<string, LayerSet | undefined>)[tab];
    return set ? fromSet(set) : [];
  },

  "unelgee-uur-amisgal": (tab) =>
    tab === "unelgee"
      ? ASSESSMENT_SERVICES.map((s) => ({ title: `Ерөнхий үнэлгээ, ${s.year}`, url: s.url }))
      : tab === "bomt"
        ? one("Менежментийн төлөвлөгөө", BOMT_SERVICE)
        : tab === "flood"
          ? fromSet(FLOOD, true)
          : tab === "green"
            ? fromSet(GREEN, true)
            : tab === "eco"
              ? fromSet(ECO, true)
              : tab === "waste"
                ? fromSet(WASTE, true)
                : tab === "gas"
                  ? fromSet(GAS, true)
                  : [],

  "amitan-urgamal": (tab) =>
    tab === "bear"
      ? one("Баавгай тохиолдлын бүртгэл", BEAR_LAYER)
      : tab === "rescues"
        ? one("Авран хамгаалсан амьтдын бүртгэл", RESCUES_SERVICE)
        : tab === "eco"
          ? one("Экологийн коридор", ECO_SERVICE)
          : tab === "poles"
            ? one("Цахилгааны шон", POLES_SERVICE)
            : tab === "stickers"
              ? one("Шилэн барилга", STICKERS_SERVICE)
              : tab === "marmots"
                ? [
                    /* Хоёр давхарга хоёулаа барьсан, тавьсан цэгийн координатын
                       баганатай — геометр нь аль цэг болохоор нь бөглөнө */
                    { title: "Тарвага — барьсан цэг", url: MARMOT_SERVICES[0], form: { coords: { lon: "c_lon", lat: "c_lat" } } },
                    { title: "Тарвага — тавьсан цэг", url: MARMOT_SERVICES[1], form: { coords: { lon: "r_lon", lat: "r_lat" } } },
                  ]
                : tab === "lichens"
                  ? one("Хаг", LICHENS_SERVICE)
                  : tab === "hovd" || tab === "moog"
                    ? one(FLORA[tab].title, `${layerService(FLORA[tab].layer)}/0`)
                    : tab === "biotechnik"
                      ? one("Биотехникийн арга хэмжээ", BIOTECH_SERVICE)
                      : tab === "monitoring"
                        ? [
                            ...fromSet(WILDLIFE_SOLO.songino),
                            { title: "Минжний ажиглалт", url: layerService("A08_minj_ba_busad") },
                            { title: "Минжний судалгааны талбай", url: layerService("A08_minj_talbai") },
                            { title: "Минжний маршрут", url: layerService("A08_minj_marshrut") },
                          ]
                        : [],
};

/** Сонгосон багцын засварлах давхаргууд — портал гаднахыг хасна */
export function editTargets(scope: string, tab: string): EditTarget[] {
  return (TARGETS[scope]?.(tab) ?? []).filter((t) => needsToken(t.url));
}
