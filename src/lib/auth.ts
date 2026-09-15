/**
 * ArcGIS Enterprise-ийн НЭВТРЭЛТ — хөтөч дээр, сервергүйгээр.
 *
 * Сайт статикаар экспортлогддог (GitHub Pages) тул сервер тал БАЙХГҮЙ.
 * Тиймээс нэвтрэлт нь бүхэлдээ хөтөч дээр явагдана: OAuth 2.0-ийн
 * **Authorization Code + PKCE** урсгал.
 *
 * Яагаад PKCE вэ:
 *   Сонгодог урсгал нь аппын НУУЦ ҮГ (client secret) шаарддаг ч хөтчийн
 *   багцад нууц үг хадгалах боломжгүй — хэн ч уншина. PKCE нь нууц үгийг
 *   хүсэлт бүрд ШИНЭЭР үүсгэсэн санамсаргүй мөрөөр (`code_verifier`)
 *   солино: порталд эхлээд түүний хэшийг илгээж, солилцоонд эхийг нь
 *   өгнө. Хаягийн мөрөөс код хулгайлсан этгээд verifier-гүй тул токен
 *   болгож чадахгүй.
 *
 * ⚠ **APP ID НЬ НУУЦ БИШ.** Ил байх нь хэвийн. Хамгаалалтыг PKCE ба
 * порталд бүртгэгдсэн `redirect_uri`-ийн ЯГ таарал хангана — өөр сайт
 * энэ ID-г хуулсан ч токен нь тэр рүү буцахгүй.
 *
 * ⚠ **ArcGIS АЛДААГ HTTP 200-ААР БУЦААНА** (`lib/arcgis.ts`-ийн
 * тэмдэглэлтэй ижил). Токены төгсгөл ч мөн адил: буруу код илгээхэд
 * `{"error":{"code":498,…}}` гэж 200-аар ирнэ. Тиймээс `res.ok`-ыг
 * шалгаад зогсохгүй биеийг нь ЗААВАЛ уншина.
 */

import { APP_ID, SHARING, redirectUri } from "@/lib/portal";
import { BASE_PATH } from "@/lib/base-path";

/* --------------------------------------------------------------------------
   СЕССИЙН ХЭЛБЭР
   -------------------------------------------------------------------------- */

export type Session = {
  token: string;
  /** Дуусах мөч (epoch, мс) */
  expires: number;
  /** Порталын нэвтрэх нэр */
  username: string;
  /** Харагдах бүтэн нэр — байхгүй бол `username` */
  fullName: string;
  /** Профайлын зураг (порталын `thumbnail`), байхгүй бол `null` */
  avatar: string | null;
  /** Сунгах түлхүүр — үүнгүй бол хугацаа дуусмагц дахин нэвтэрнэ */
  refresh: string | null;
  /** Сунгах түлхүүрийн дуусах мөч */
  refreshExpires: number;
};

/**
 * Хадгалалт нь `localStorage`.
 *
 * `sessionStorage` бол таб бүрд тусдаа — хэрэглэгч шинэ таб нээх бүрд
 * дахин нэвтрэх шаардлагатай болно. Энэ нь өдөржин ажилладаг дотоод
 * систем тул хүлээн зөвшөөрөгдөхгүй.
 */
const KEY = "arcgis.session";

/** Токен дуусахаас ЭНЭ хугацааны өмнө сунгана — дундуур тасрахаас сэргийлж */
const RENEW_BEFORE = 5 * 60 * 1000;

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (typeof s?.token !== "string" || typeof s?.expires !== "number") return null;
    return s;
  } catch {
    /* Хэрэглэгч хадгалалтыг хаасан, эсвэл бичлэг эвдэрсэн */
    return null;
  }
}

function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* Хадгалагдахгүй бол сесси нь зөвхөн энэ хуудсанд амьдарна */
  }
}

/**
 * Токен нь одоо ашиглахад хүчинтэй юу?
 *
 * ⚠ Төрөл заагч (`s is Session`) БОЛГОХГҮЙ: тэгвэл `if (isLive(s)) return`
 * -ийн дараа TypeScript нь `s`-ийг `null` гэж хумьж, доорх сунгалтын
 * шалгалт `never` дээр унана. Энэ нь буруу хумилт — хүчинтэй БИШ сесси
 * нь `null` гэсэн үг биш, хугацаа нь дуусч эхэлсэн гэсэн үг.
 */
export function isLive(s: Session | null): boolean {
  return !!s && s.expires - RENEW_BEFORE > Date.now();
}

/** Сунгах боломжтой юу? */
function canRenew(s: Session | null): s is Session & { refresh: string } {
  return !!s?.refresh && s.refreshExpires > Date.now();
}

/* --------------------------------------------------------------------------
   PKCE
   -------------------------------------------------------------------------- */

/** Санамсаргүй мөр — base64url, хөвөө тэмдэггүй */
function randomText(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return base64url(a);
}

function base64url(bytes: Uint8Array | ArrayBuffer): string {
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(digest);
}

/*
  Урсгалын завсрын утгууд ЗӨВХӨН энэ табд хэрэгтэй бөгөөд урсгал дуусмагц
  утгагүй болно — тиймээс `sessionStorage`. `localStorage` дээр байвал
  зэрэгцээ таб бие биенийхээ урсгалыг дарж бичнэ.
*/
const FLOW = "arcgis.oauth.flow";

type Flow = { verifier: string; state: string; back: string };

/* --------------------------------------------------------------------------
   НЭВТРЭХ
   -------------------------------------------------------------------------- */

/**
 * Порталын нэвтрэх хуудас руу шилжинэ.
 *
 * `back` нь нэвтэрсний дараа буцаж очих зам — хэрэглэгч гүн байрлах
 * хуудас нээгээд нэвтрэх шаардлагатай болбол эхлэл рүү шидэгдэх ёсгүй.
 */
export async function signIn(back?: string): Promise<void> {
  if (!APP_ID) throw new Error("Аппын ID тохируулагдаагүй байна");

  const verifier = randomText();
  const state = randomText(16);
  const flow: Flow = {
    verifier,
    state,
    back: back ?? currentPath(),
  };
  sessionStorage.setItem(FLOW, JSON.stringify(flow));

  const url =
    `${SHARING}/oauth2/authorize?` +
    new URLSearchParams({
      client_id: APP_ID,
      response_type: "code",
      redirect_uri: redirectUri(),
      state,
      code_challenge: await challengeOf(verifier),
      code_challenge_method: "S256",
    });

  /* Портал нь ӨӨР гарал — Next-ийн чиглүүлэгч гадаад хаяг рүү явуулж
     чадахгүй тул хөтчийн шилжилт л боломжтой. Дүрэм нь дотоод зам руу
     ингэхээс сэргийлдэг бөгөөд энд хамаарахгүй */
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(url);
}

/**
 * Буцаж ирсэн кодыг токен болгоно.
 *
 * `/auth/callback/` хуудас дуудна. Буцаах утга нь хэрэглэгчийг хаашаа
 * аваачихыг заана.
 */
/**
 * Одоогийн замыг ДЭД ЗАМГҮЙГЭЭР буцаана.
 *
 * ⚠ `router.replace()` нь дэд замыг ӨӨРӨӨ нэмдэг тул `window.location
 * .pathname`-ийг тэр чигээр нь хадгалж болохгүй: нийтлэгдэх сайт дээр
 * `/Environment/Environment/…` болж, хуудас олдохгүй. Хөгжүүлэлтэд
 * `BASE_PATH` хоосон тул энэ алдаа ЗӨВХӨН нийтлэгдсэн сайтад мэдрэгдэнэ.
 */
function currentPath(): string {
  const p = window.location.pathname;
  const bare = BASE_PATH && p.startsWith(BASE_PATH) ? p.slice(BASE_PATH.length) : p;
  return (bare || "/") + window.location.search;
}

export async function completeSignIn(search: string): Promise<string> {
  const q = new URLSearchParams(search);

  /* Портал татгалзсан бол шалтгааныг нь дамжуулна — "алдаа гарлаа" гэж
     бөөнд нь хэлбэл хэрэглэгч ч, админ ч юу болсныг мэдэхгүй */
  const denied = q.get("error");
  if (denied) {
    throw new Error(q.get("error_description") ?? denied);
  }

  const code = q.get("code");
  if (!code) throw new Error("Порталаас баталгаажуулах код ирсэнгүй");

  const raw = sessionStorage.getItem(FLOW);
  if (!raw) throw new Error("Нэвтрэх хүсэлт олдсонгүй. Дахин эхлүүлнэ үү");
  const flow = JSON.parse(raw) as Flow;

  /* CSRF хамгаалалт: буцаж ирсэн `state` нь бидний илгээсэнтэй таарах
     ёстой. Таарахгүй бол өөр хаанаас ирсэн хүсэлт */
  if (q.get("state") !== flow.state) {
    throw new Error("Нэвтрэх хүсэлтийн баталгаа таарсангүй");
  }
  sessionStorage.removeItem(FLOW);

  const body = await postForm(`${SHARING}/oauth2/token`, {
    client_id: APP_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: flow.verifier,
  });

  await adopt(body);
  return flow.back || "/";
}

/* --------------------------------------------------------------------------
   СУНГАХ, ГАРАХ
   -------------------------------------------------------------------------- */

/**
 * Хүчинтэй токен буцаана — хэрэгтэй бол чимээгүй сунгаж.
 *
 * `null` буцаавал хэрэглэгч дахин нэвтрэх ёстой.
 *
 * ⚠ ЗЭРЭГЦЭЭ ДУУДЛАГА НЭГТГЭГДЭНЭ: самбар нээгдэхэд арваад модуль зэрэг
 * татдаг тул тус бүр нь сунгах хүсэлт явуулбал портал руу арван хүсэлт
 * очих ба сүүлийнх нь өмнөхийг нь хүчингүй болгоно.
 */
let renewing: Promise<Session | null> | null = null;

export async function getToken(): Promise<string | null> {
  const s = readSession();
  if (!s) return null;
  if (isLive(s)) return s.token;
  if (!canRenew(s)) return null;

  renewing ??= renew(s.refresh).finally(() => {
    renewing = null;
  });
  const fresh = await renewing;
  return fresh?.token ?? null;
}

async function renew(refresh: string): Promise<Session | null> {
  try {
    const body = await postForm(`${SHARING}/oauth2/token`, {
      client_id: APP_ID,
      grant_type: "refresh_token",
      refresh_token: refresh,
    });
    return await adopt(body, refresh);
  } catch {
    /* Сунгалт бүтэлгүйтэв — сессийг цэвэрлэж дахин нэвтрүүлнэ */
    writeSession(null);
    return null;
  }
}

/**
 * Гарах.
 *
 * Зөвхөн локал бичлэгийг устгана. Порталын өөрийнх нь сесси нээлттэй
 * үлдэх тул дараагийн нэвтрэлт нууц үг асуулгүй өнгөрч болно — энэ нь
 * нэг байгууллагын дотоод системд ХҮЛЭЭН ЗӨВШӨӨРӨГДӨХ зан төлөв.
 * Порталаас бүрэн гарах нь `portalSignOutUrl()`-аар.
 */
export function signOut() {
  writeSession(null);
}

/** Порталаас БҮРЭН гарах хаяг — хэрэглэгч өөр бүртгэлээр орох үед */
export function portalSignOutUrl(): string {
  return (
    `${SHARING}/oauth2/signout?` +
    new URLSearchParams({ client_id: APP_ID, redirect_uri: redirectUri() })
  );
}

/* --------------------------------------------------------------------------
   ДОТООД ТУСЛАХУУД
   -------------------------------------------------------------------------- */

type TokenBody = {
  access_token?: string;
  expires_in?: number;
  username?: string;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: { code?: number; message?: string; error_description?: string };
};

/**
 * Форм хэлбэрээр POST хийж JSON уншина.
 *
 * ArcGIS-ийн токены төгсгөл нь `application/x-www-form-urlencoded` л
 * хүлээж авдаг — JSON бие илгээвэл параметрийг олохгүй.
 */
async function postForm(url: string, fields: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...fields, f: "json" }),
    });
  } catch {
    throw new Error("Порталтай холбогдсонгүй");
  }

  if (!res.ok) throw new Error(`Портал хариу өгсөнгүй (${res.status})`);

  let body: TokenBody;
  try {
    body = (await res.json()) as TokenBody;
  } catch {
    throw new Error("Порталын хариу уншигдсангүй");
  }

  /* Алдаа нь 200-ын биед нуугдаж ирдэг */
  if (body.error) {
    throw new Error(
      body.error.error_description ??
        body.error.message ??
        `Портал татгалзлаа (код ${body.error.code ?? "?"})`,
    );
  }
  if (!body.access_token) throw new Error("Порталаас токен ирсэнгүй");

  return body;
}

/**
 * Токены хариуг сесси болгож хадгална.
 *
 * Сунгалтын хариунд заримдаа шинэ `refresh_token` ирдэггүй — тэр
 * тохиолдолд ХУУЧНЫГ нь үлдээнэ, эс тэгвээс дараагийн сунгалт боломжгүй
 * болж хэрэглэгч гэнэт гарна.
 */
async function adopt(body: TokenBody, keepRefresh?: string): Promise<Session> {
  const token = body.access_token!;
  const username = body.username ?? "";
  const profile = await fetchProfile(token, username);

  const s: Session = {
    token,
    /* `expires_in` нь СЕКУНД */
    expires: Date.now() + (body.expires_in ?? 1800) * 1000,
    username: profile.username || username,
    fullName: profile.fullName || profile.username || username,
    avatar: profile.avatar,
    refresh: body.refresh_token ?? keepRefresh ?? null,
    refreshExpires:
      Date.now() + (body.refresh_token_expires_in ?? 14 * 24 * 3600) * 1000,
  };
  writeSession(s);
  return s;
}

type Profile = { username: string; fullName: string; avatar: string | null };

/**
 * Хэрэглэгчийн нэр, зургийг порталаас асууна.
 *
 * Бүтэлгүйтвэл ШИДЭХГҮЙ: нэр харагдахгүй нь эвгүй ч нэвтрэлтийг унагаах
 * шалтгаан биш — токен нь хүчинтэй хэвээр.
 */
async function fetchProfile(token: string, username: string): Promise<Profile> {
  const blank: Profile = { username, fullName: "", avatar: null };
  if (!username) return blank;

  try {
    const url =
      `${SHARING}/community/users/${encodeURIComponent(username)}?` +
      new URLSearchParams({ f: "json", token });
    const res = await fetch(url);
    const j = (await res.json()) as {
      username?: string;
      fullName?: string;
      thumbnail?: string;
      error?: unknown;
    };
    if (j.error) return blank;
    return {
      username: j.username ?? username,
      fullName: j.fullName ?? "",
      avatar: j.thumbnail
        ? `${SHARING}/community/users/${encodeURIComponent(username)}/info/${j.thumbnail}?token=${encodeURIComponent(token)}`
        : null,
    };
  } catch {
    return blank;
  }
}
