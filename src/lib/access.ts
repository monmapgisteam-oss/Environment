/*
  ЭРХИЙН ЗОХИЦУУЛАЛТ — бүртгэл тус бүр аль ХЭСЭГ, аль ЦЭСИЙГ харах вэ.

  ⚠⚠ ЭРХ НЬ СУПЕР АДМИНЫ ТОХИРГООНООС (хэрэглэгч 2026-10-16: "super admin
  тэр хэлтсээс тэрийг харуулъя гэж сонгоод хадгалаад харуулдаг"). Тохиргоо
  нь порталын hosted хүснэгтэд ({@link src/lib/access-remote.ts}) — бүх
  төхөөрөмж, бүх хэрэглэгчид нэг. Селбэ төслийн `permsRemote`-той нэг арга.

  · ХЭСЭГ (`scope`) — хэлтсийн slug, мөн "analysis" (Дүн шинжилгээ).
  · ЦЭС — хэсгийн доторх таб (`SourceTabs`-ийн id). `"all"` нь ирээдүйд
    нэмэгдэх цэсийг ч хамарна.
  · Хүснэгтэд мөргүй бүртгэл нь ЭНД бичигдсэн АНХДАГЧ эрхээр (`ACCOUNTS`).
  · Админ (`portaladmin` эсвэл порталын `org_admin`) — бүгд + энэ тохиргоо.
  · Хүснэгтэд ч, анхдагчид ч, админ ч БИШ бүртгэл ХААГДАНА.

  Нэвтрэх нэрийг хэрэглэгч өгсөн (2026-10-16). Нууц үг ХЭЗЭЭ Ч бичигдэхгүй.
  ⚠ `nbog_zuh_saamh` нь платформын ХОЁР хэлтсийг (захиргаа, санхүү) хамарна.
  ⚠ Энэ нь ДЭЛГЭЦИЙН хязгаарлалт: давхаргын жинхэнэ хамгаалалт нь порталын
  хуваалцах тохиргоо (сайт статик, сервер талгүй).
*/

/** Хэсэг → цэсүүд (`"all"` — бүгд). Түлхүүр байхгүй хэсэг хаалттай. */
export type Grant = Record<string, string[] | "all">;

/** Дүн шинжилгээний хэсгийн түлхүүр (хэлтсийн slug-тай зэрэгцэнэ) */
export const ANALYSIS = "analysis";

export type Account = {
  username: string;
  /** Хэрэглэгчийн өгсөн хэлтсийн нэр */
  name: string;
  /** Анхдагч эрх — хүснэгтэд мөргүй үед */
  grant: Grant;
};

const own = (...slugs: string[]): Grant =>
  Object.fromEntries([...slugs, ANALYSIS].map((s) => [s, "all" as const]));

export const ACCOUNTS: Account[] = [
  { username: "nbog_hh", name: "Хяналтын хэлтэс", grant: own("hyanalt") },
  {
    username: "nbog_bouuaoh",
    name: "Байгаль орчны үнэлгээ, уур амьсгалын өөрчлөлтийн хэлтэс",
    grant: own("unelgee-uur-amisgal"),
  },
  {
    username: "nbog_nbahh",
    name: "Ногоон бүсийн ашиглалт, хамгаалалтын хэлтэс",
    grant: own("nogoon-bus"),
  },
  { username: "nbog_auhh", name: "Амьтан, ургамлыг хамгаалах хэлтэс", grant: own("amitan-urgamal") },
  { username: "nbog_oh", name: "Ойн хэлтэс", grant: own("oi") },
  {
    username: "nbog_hboahh",
    name: "Хүрээлэн буй орчны ашиглалт хамгаалалтын хэлтэс",
    grant: own("orchin"),
  },
  {
    username: "nbog_zuh_saamh",
    name: "Захиргаа, санхүүгийн хэлтэс",
    grant: own("zahirgaa", "sanhuu-monitoring"),
  },
];

/** Порталын админ бүртгэл (хэрэглэгч 2026-10-16: "нэвтрэх нэр portaladmin") */
export const ADMIN_USERNAME = "portaladmin";

export const normName = (u: string | null | undefined) => (u ?? "").trim().toLowerCase();

export function isAdminName(username: string | null | undefined): boolean {
  return normName(username) === ADMIN_USERNAME;
}

export function defaultGrant(username: string | null | undefined): Grant | null {
  const u = normName(username);
  return ACCOUNTS.find((a) => a.username === u)?.grant ?? null;
}

/** Цэс нээлттэй юу */
export function grantAllowsTab(g: Grant, scope: string, tab: string): boolean {
  const v = g[scope];
  return v === "all" || (Array.isArray(v) && v.includes(tab));
}

/** Хэсэг нээлттэй юу — ядаж нэг цэстэй (эсвэл бүгд) */
export function grantAllowsScope(g: Grant, scope: string): boolean {
  const v = g[scope];
  return v === "all" || (Array.isArray(v) && v.length > 0);
}

/** Хүснэгтээс уншсан JSON-ыг цэвэрлэнэ — эвдэрсэн бол `null` (хаалттай) */
export function parseGrant(raw: unknown): Grant | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Grant = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (x === "all") out[k] = "all";
    else if (Array.isArray(x)) out[k] = x.filter((t): t is string => typeof t === "string");
  }
  return out;
}

/*
  ЦЭСИЙН НАРИЙВЧЛАЛ (хэрэглэгч 2026-10-20: "тусгай хамгаалалттай газар гэсэн
  db юуг нь харахаар тохируулах") — цэс бүрд ХАРАГДАХ ХЭСЭГ ба ДАВХАРГА.
  `Grant`-ын ижил JSON-д "@"-ээр эхэлсэн түлхүүрээр сууна (хэлтсийн slug
  "@"-ээр эхэлдэггүй тул мөргөлдөхгүй, хүснэгтийн бүтэц өөрчлөгдөхгүй):
    "@v:<scope>/<tab>" — харагдах хэсгүүд, "@l:<scope>/<tab>" — давхаргууд.
  Түлхүүр БАЙХГҮЙ бол бүгд нээлттэй (хуучин хадгалсан эрх хэвээр ажиллана).
  ⚠ Зөвхөн порталын хуваалцсан самбарт ({@link PortalLayersDashboard})
  хэрэгжинэ — тусгай самбартай цэст энэ тохиргоо гарахгүй.
*/
export const VIEW_PARTS = [
  { id: "map", label: "Газрын зураг" },
  { id: "charts", label: "Диаграм" },
  { id: "overview", label: "Үзүүлэлт" },
  { id: "record", label: "Дэлгэрэнгүй мэдээлэл" },
] as const;
export type ViewPart = (typeof VIEW_PARTS)[number]["id"];

/** `null` — хязгааргүй (бүгд) */
export type TabRule = { views: string[] | null; layers: string[] | null };
export const FULL_RULE: TabRule = { views: null, layers: null };

export const viewKey = (scope: string, tab: string) => `@v:${scope}/${tab}`;
export const layerKey = (scope: string, tab: string) => `@l:${scope}/${tab}`;
export const isDetailKey = (key: string) => key.startsWith("@");

export function tabRule(g: Grant, scope: string, tab: string): TabRule {
  const v = g[viewKey(scope, tab)];
  const l = g[layerKey(scope, tab)];
  return { views: Array.isArray(v) ? v : null, layers: Array.isArray(l) ? l : null };
}

/** Хэсгийн (эсвэл нэг цэсийн) нарийвчлалыг арилгана */
export function clearDetail(g: Grant, scope: string, tab?: string) {
  for (const key of Object.keys(g)) {
    if (!isDetailKey(key)) continue;
    const path = key.slice(3);
    if (tab ? path === `${scope}/${tab}` : path.startsWith(`${scope}/`)) delete g[key];
  }
}
