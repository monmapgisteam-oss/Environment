



/**
 * Дүрслэлд хэрэггүй талбарууд.
 *
 * `OBJECTID` нь дугаар, `GlobalID` нь санамсаргүй тэмдэгт, `Shape__*`
 * нь геометрээс дам гарах утга — эдгээрийг ангилал болгон харуулах нь
 * утгагүй. `Shape__Area`-г харин ТАЛБАЙН эх сурвалж болгон тусад нь
 * хэрэглэнэ.
 */
export const SKIP_FIELDS =
  /^(OBJECTID|FID|GlobalID|Shape_?_?(Area\w*|Le\w*)(_\d+)?)$/i;

/**
 * Esri-ийн ЗАСВАРЛАГЧ МӨРДӨХ талбарууд.
 *
 * Survey123-ийн маягт болон хостлогдсон давхарга бүрд автоматаар
 * нэмэгддэг: хэн, хэзээ бичсэнийг заана — судалгааны сэдвийн тухай
 * ЮУ Ч ХЭЛЭХГҮЙ. Хасахгүй бол `Creator` нь "mobile_worker2" гэсэн
 * утгуудаар диаграм болж, `CreationDate` нь маягтын өөрийн
 * `Бүртгэсэн огноо`-г давхардуулж хугацааны хоёр цуваа гаргана.
 */
export const EDITOR_FIELDS =
  /^(Creator|Editor|CreationDate|EditDate|created_(user|date)|last_edited_(user|date))$/i;

/**
 * ХҮНД ХЭРЭГГҮЙ ТЕХНИКИЙН ТАЛБАР — бичлэгийн цонхонд гарахгүй
 * (хэрэглэгч, 2026-10-06: "pop up дээр хүнд хэрэгтэй дата л харагдана
 * шүү").
 *
 * ⚠ ЗӨВХӨН ЦОНХОНД. Диаграмын хасалт өөр дүрэмтэй (`ID_FIELD`,
 * `COORD_FIELD`): тэр нь "нэмж болох уу" гэдгийг шийддэг, энэ нь "хүн
 * уншихад утга бий юу" гэдгийг.
 * ⚠⚠ "дугаар", "код" гэсэн үгийг ЕРӨНХИЙД нь хасахгүй — "Тусгай
 * дугаар", "Зөвшөөрлийн дугаар", "BZD-16" гэсэн код нь хүнд ХЭРЭГТЭЙ
 * баримт. Зөвхөн СИСТЕМИЙН дугаарлалт (`gid`, `fid`, `objectid_1`,
 * мөрийн дараалал `д_д`) ба орон зайн нэгтгэлийн үлдэц (`Join_Count`,
 * `TARGET_FID`, `ORIG_FID`) хасагдана.
 * ⚠ Координатын багана нь геометрийн ДАВХАР бичлэг — байршил нь
 * зураг дээр өөрөө харагдана.
 */
export const SYSTEM_FIELD =
  /^(gid|fid|oid|uid|id|objectid_?\d*|orig_fid|target_fid|join_fid|join_count|globalid|parentglobalid|д_д|dd|has_xy|shape_?_?(leng|length|len|area)\w*|st_(area|length)\w*|layer|path|lat|lon|lng|latitude|longitude|x|y|point_x|point_y|өргөрөг__y_|уртраг__x_)$|_id$|^id_/i;

export function isSystemField(name: string, alias = ""): boolean {
  if (SYSTEM_FIELD.test(name.trim())) return true;
  /* Alias нь "Д/Д", "№" гэх мэт мөрийн дарааллыг зааж болно */
  return /^(д\/д|№|д\.д\.?)$/i.test(alias.trim());
}

/** KML-ээс хөрвүүлсэн давхаргын үлдэц талбарууд — утга агуулдаггүй */
export const KML_NOISE =
  /^(SymbolID|AltMode|Base|Clamped|Extruded|Snippet|PopupInfo|Folder|FolderPath)$/i;
