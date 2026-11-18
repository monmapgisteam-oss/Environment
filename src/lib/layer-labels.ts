
import type { LayerInfo, LayerFeatures, LayerLabels } from "./layer-types";
import { chartInfo, pickMeasures, nameField, MIN_VALUES, categoryKey } from "./breakdowns";


/**
 * НЭРГҮЙ ДАВХАРГАД ШОШГО ГАРАХ ДЭЭД ХЯЗГААР.
 *
 * ⚠⚠ Нэргүй давхаргын шошго нь зөвхөн ХЭМЖИЛТ болдог ("11.8 га").
 * Цөөн дүрстэй давхаргад тэр нь утгатай — хориглолтын арван найман
 * бүс тус бүрийн хэмжээг шууд хэлнэ. Гэвч булгийн хамгаалалтын бүс
 * нь 495 ЦЭГТЭЙ бөгөөд бараг бүгд нь ижил утгатай: зураг нь "11.8 га"
 * гэсэн гурван зуун давхардсан бичвэрээр бүрхэгдэж, доорх хиймэл
 * дагуул ч, цэгүүд нь ч уншигдахаа больдог байв (хэрэглэгч,
 * 2026-09-29, зургаар: "энэ цонхыг тэр чигт нь цэгцлэе").
 * ⚠ Шошгын үүрэг нь ТАНИУЛАХ — "энэ юу вэ" гэдэгт хариулах. Нэргүй
 * дүрсэн дээрх давтагдсан тоо тэр асуултад хариулдаггүй.
 * ⚠ НЭРТЭЙ давхарга энэ хязгаарт ОРОХГҮЙ: нэр нь хэдэн ч дүрс байсан
 * танина (ойн хэсэглэл, эх үүсвэрүүд).
 */
export const LABEL_MAX = 40;

export function labelParts(full: LayerInfo, data: LayerFeatures): LayerLabels {
  /* Шошго диаграмтай НЭГ эх сурвалжаас — хасагдсан талбар энд ч орохгүй */
  const info = chartInfo(full);
  const rows = Object.values(data.rows);
  if (!rows.length) return { name: null, measure: null };

  /*
    ⚠ НЭГЖГҮЙ тоог шошгонд БИЧИХГҮЙ.

    Зураг дээр "1", "2" гэсэн тоо гарвал тэр нь юуны тоо болох нь
    мэдэгдэхгүй — зүгээр л дүрсээ дарна. Нэгжтэй хэмжилт (га, м³) л
    өөрөө өөрийгөө тайлбарлана.
  */
  const m = pickMeasures(info, rows).find((x) => !x.share && x.unit) ?? null;
  /* Бүртгэл шошгын талбарыг шууд зааж болно ({@link LayerSet.labelBy})
     — цөөн утгатай багана нь `nameField`-д хүрэхгүй ч шошго болохуйц.
     Ганц мөрт давхаргад бүртгэлийн заалт ({@link LayerSet.nameHint}) */
  const name =
    (info.set.labelBy &&
      info.fields.find((f) => f.name === info.set.labelBy)?.name) ||
    nameField(info, rows, [])?.name ||
    hintedName(info, rows) ||
    null;

  /* Нэргүй давхаргад шошго нь зөвхөн тоо болох тул олон дүрстэй үед
     бичвэрийн хана болно ({@link LABEL_MAX}) */
  if (!name && rows.length > LABEL_MAX) return { name: null, measure: null };

  return {
    name,
    /* Хэмжээ бичих эсэх нь хэлтсийн сонголт ({@link LayerSet.labelMeasure}) */
    measure:
      m && info.set.labelMeasure !== false
        ? { field: m.field.name, unit: m.unit }
        : null,
  };
}

/**
 * Бүртгэлийн заалтаар ({@link LayerSet.nameHint}) олдсон нэрийн багана.
 *
 * ⚠ ЗӨВХӨН {@link MIN_VALUES}-аас цөөн мөртэй давхаргад — олон мөрт
 * давхаргад дата өөрөө шийдэх ёстой, заалт нь түүнийг дарахгүй.
 */
export function hintedName(
  info: LayerInfo,
  rows: Record<string, unknown>[],
): string | null {
  const hint = info.set.nameHint;
  if (!hint || rows.length >= MIN_VALUES) return null;
  const f = info.fields.find(
    (x) =>
      x.type === "String" &&
      (hint.test(x.name) || hint.test(x.alias)) &&
      rows.some((r) => categoryKey(r[x.name]) !== "Бүртгэгдээгүй"),
  );
  return f?.name ?? null;
}

