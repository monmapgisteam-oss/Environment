/**
 * Хөвд, мөөгний судалгаа — хагийн ах дүү хоёр давхарга.
 *
 * Порталын `A02` бүлэг нь ГУРВАН судалгааг агуулна: хаг
 * ([lichens.ts](src/lib/lichens.ts)), хөвд (`A02_Hovd`), мөөг
 * (`A02_Moog`). Гурвуулаа "аль цэгт ямар зүйл бүртгэгдсэн" гэсэн НЭГ
 * асуултад хариулдаг тул самбар нь ч ижил хэлбэртэй байна
 * (хэрэглэгчийн шийдвэр, 2026-09-16: "хөвд, мөөг хоёрыг хаг шиг
 * болгоё"). Энэ нь платформын "самбар бүр өөр бүтэцтэй" дүрмийн
 * ЗОРИУДЫН үл хамаарах зүйл: гурав нь нэг судалгааны гурван хэсэг.
 *
 * ⚠ **ХАГТАЙ ЯГ ИЖИЛ БИШ.** Хаг нь ТАРХАЛТЫН ХҮСНЭГТ (мөр бүр =
 * нэг зүйл × нэг цэг, 2,391 мөр) бол эдгээр нь ЦЭГИЙН бүртгэл: мөр
 * бүр нэг цэг бөгөөд тэнд олдсон зүйлүүд нь НЭГ НҮДЭНД жагсаагдсан.
 * Тиймээс зүйлийн жагсаалтыг задалж гаргана.
 *
 * ## Зүйлийн нэрийг ЯАЖ задлах вэ
 *
 * ⚠⚠ **ЭНГИЙН ТАСЛАЛААР ЗАДАЛЖ БОЛОХГҮЙ.** Хөвдний нэр нь зохиогчийн
 * нэртэйгээ бүтнээр бичигдсэн бөгөөд зохиогчид нь өөрсдөө таслалаар
 * тусгаарлагддаг:
 *
 * ```
 * Lewinskya rupestris (Hook. & Grev.) F.Lara, Garilleti & Goffinet
 * ```
 *
 * Таслал болгоноор таслахад энэ нь ХОЁР зүйл болж, нийт тоо нь эх
 * сурвалжийн `sp_count`-оос яг нэгээр илүү гарч байв.
 *
 * Тиймээс **хоёр нэрийн ЭХЛЭЛ** дээр л таслана: таслалын дараа "Том
 * үсгээр эхэлсэн үг + жижиг үсгээр эхэлсэн үг" гэсэн хос ирвэл тэр нь
 * шинэ зүйлийн нэр (биномиал). Зохиогчийн нэрсийн дараа ийм хос
 * ирдэггүй тул тасрахгүй.
 *
 * ✅ **ЭНЭ ДҮРМИЙГ ДАТА ӨӨРӨӨ БАТАЛНА**: задалсан тоо нь `sp_count`
 * талбартай 30/30 ба 55/55 мөрд ЯГ таарсан (2026-09-16-нд шалгасан).
 * Тааралгүй мөр гарвал дүрэм эвдэрсэн гэсэн үг тул `mismatched`-д
 * тоологдоно — чимээгүй буруу задлахаас сэргийлнэ.
 *
 * ## Төрөл нь зүйлийн нэрнээс
 *
 * Эх сурвалж `genus` гэсэн зэрэгцээ жагсаалт бичдэг ч түүнийг
 * ХЭРЭГЛЭХГҮЙ: хоёр жагсаалтыг индексээр нь хослуулах баталгаа
 * байхгүй (нэг төрөлд хоёр зүйл байвал урт нь зөрнө). Зүйлийн нэрний
 * ЭХНИЙ ҮГ нь төрөл — ингэж гаргасан нь эх сурвалжийн `genus`
 * жагсаалттай 45/45 ба 39/39 таарсан тул мэдээлэл алдагдахгүй.
 */

import { arcgisJson } from "@/lib/arcgis";
import { layerService } from "@/lib/portal-layers";

/** Аль судалгаа вэ */
export type FloraKind = "hovd" | "moog";

/** Судалгаа тус бүрийн ялгаа — бусад бүх зүйл хуваалцагдана */
export const FLORA: Record<
  FloraKind,
  { layer: string; title: string; unit: string }
> = {
  hovd: {
    layer: "A02_Hovd",
    title: "Хөвдний судалгаа",
    /** Мөр нь ЦЭГ биш СУДАЛГААНЫ ТАЛБАЙ */
    unit: "судалгааны цэг",
  },
  moog: {
    layer: "A02_Moog",
    title: "Мөөгний судалгаа",
    /** Мөр нь нэг ОЛДВОРЫН цэг — нэг талбайд хэд хэд байж болно */
    unit: "олдворын цэг",
  },
};

export type FloraSpot = {
  oid: number;
  lon: number;
  lat: number;
  /** `site_code` (хөвд) эсвэл `pt_code` (мөөг) */
  code: string;
  /** Байршлын нэр. Мөөг дээр хэд хэдэн цэг НЭГ нэрийг хуваалцана */
  name: string;
  district: string;
  khoroo: string;
  /** Тэнд бүртгэгдсэн зүйлүүд — задалсны дараа */
  species: string[];
  /** Өндөршил, м (зөвхөн мөөг, 55-аас 42-д) */
  elev: number | null;
  /** Олдсон огноо — эх сурвалж бичвэрээр хадгалдаг (зөвхөн мөөг) */
  found: string | null;
  /** Зургийн файлын нэр (зөвхөн мөөг). Зураг нь платформд БАЙХГҮЙ */
  photo: string | null;
  /** Нийслэл дотор уу, гадуур уу (зөвхөн мөөг) */
  zone: string | null;
};

export type FloraData = {
  spots: FloraSpot[];
  /** Газрын зурагт — индекс нь `spots`-ынхтай нэг */
  points: { oid: number[]; lon: number[]; lat: number[] };
  /** Зүйл → төрөл. Цагаан толгойн дарааллаар */
  species: { name: string; genus: string }[];
  /**
   * Задаргаа нь `sp_count`-той тааралгүй гарсан мөрийн тоо.
   *
   * Тэг байх ЁСТОЙ. Тэгээс их бол дээрх задлах дүрэм эвдэрсэн гэсэн
   * үг — самбар түүнийг ил хэлнэ, чимээгүй буруу тоо харуулахгүй.
   */
  mismatched: number;
};

/**
 * Хоёр биномиалын ЗААГ.
 *
 * Таслалын дараа "Том үсгээр эхэлсэн үг + жижиг үсгээр эхэлсэн үг"
 * ирвэл л таслана. Зохиогчийн нэрсийн доторх таслал ("F.Lara,
 * Garilleti & Goffinet") энэ хэвэнд таарахгүй тул тасрахгүй.
 */
const NEXT_NAME = /,\s+(?=[A-Z][A-Za-zÀ-ÿ.'-]*\s+[a-zà-ÿ])/;

/** Илүү зайг цэвэрлэнэ — эх бичвэрийг найруулахгүй */
const tidy = (s: unknown) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";

/** Нийслэлийн бүсийн латин тэмдэглэгээг задална */
const ZONE: Record<string, string> = {
  Niislel: "Нийслэл",
  Gaduur: "Нийслэлээс гадуур",
};

type Props = Record<string, unknown>;

export async function fetchFlora(
  kind: FloraKind,
  signal?: AbortSignal,
): Promise<FloraData> {
  const service = `${layerService(FLORA[kind].layer)}/0`;
  const url =
    `${service}/query?` +
    new URLSearchParams({
      where: "1=1",
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      resultRecordCount: "2000",
      f: "json",
    });

  const json = await arcgisJson<{
    features?: { attributes: Props; geometry?: { x: number; y: number } | null }[];
  }>(url, FLORA[kind].title, { signal });

  const spots: FloraSpot[] = [];
  const genusOf = new Map<string, string>();
  let mismatched = 0;

  for (const f of json.features ?? []) {
    const a = f.attributes;
    const g = f.geometry;

    /* Геометрийг эрхэмлэнэ, дутсан бол атрибутын координатаас */
    const lon = g && Number.isFinite(g.x) ? g.x : Number(a.lon);
    const lat = g && Number.isFinite(g.y) ? g.y : Number(a.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

    const raw = tidy(a.species);
    const species = raw
      ? raw
          .split(NEXT_NAME)
          .map((s) => s.replace(/\s*[.,;]\s*$/, "").trim())
          .filter(Boolean)
      : [];

    /* Эх сурвалжийн зарласан тоотой тулгана — задаргаа нь ТААРАХ ёстой */
    const declared = a.sp_count;
    if (typeof declared === "number" && declared !== species.length) mismatched++;

    for (const s of species) {
      const first = s.split(" ")[0];
      if (first) genusOf.set(s, first);
    }

    spots.push({
      oid: Number(a.objectid),
      lon,
      lat,
      code: tidy(a.pt_code) || tidy(a.site_code) || String(a.objectid),
      name: tidy(a.site_name) || "Тодорхойгүй",
      /* Хөвд дээр `duureg` нэг мөрд хоосон — хүснэгтийн хувилбар нь бүтэн */
      district: tidy(a.duureg) || tidy(a.duureg_tbl) || "Бүртгэгдээгүй",
      khoroo: tidy(a.horoo),
      species,
      elev: typeof a.elev_m === "number" ? a.elev_m : null,
      found: tidy(a.found_dt) || null,
      photo: tidy(a.photo) || null,
      zone: ZONE[tidy(a.bus)] ?? tidy(a.bus) ?? null,
    });
  }

  /* Цэгүүдийг дугаараар нь эрэмбэлнэ — эх сурвалжийн дараалал тогтвортой */
  spots.sort((x, y) => x.oid - y.oid);

  const species = [...genusOf.entries()]
    .map(([name, genus]) => ({ name, genus }))
    .sort((x, y) => x.name.localeCompare(y.name));

  return {
    spots,
    points: {
      oid: spots.map((s) => s.oid),
      lon: spots.map((s) => s.lon),
      lat: spots.map((s) => s.lat),
    },
    species,
    mismatched,
  };
}
