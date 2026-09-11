/**
 * Цаг агаарын ажиглалтыг ArcGIS Feature Service рүү хуримтлуулна.
 *
 * ЯАГААД: `weather.gov.mn`-ий API нь ЗӨВХӨН хамгийн сүүлийн заалтыг
 * буцаадаг — өдрийн, сарын, жилийн цуваа авах зам байхгүй
 * ({@link src/lib/weather.ts}-ийн толгойг үзнэ үү). Тиймээс хандлага,
 * уур амьсгалын өөрчлөлтийг харах ганц арга бол заалтыг тухай бүрд нь
 * ӨӨРСДӨӨ хадгалж эхлэх. Энэ скрипт тэр архивыг бүрдүүлнэ.
 *
 * Цагийн хуваарьтай ажиллана (`.github/workflows/weather-log.yml`),
 * сайт бүтээхтэй ХАМААРАЛГҮЙ.
 *
 * Ажиллуулах:
 *   WEATHER_LAYER_URL=…/FeatureServer/0 \
 *   ARCGIS_CLIENT_ID=… ARCGIS_CLIENT_SECRET=… \
 *   NODE_EXTRA_CA_CERTS=scripts/environment-ub-gov-mn.pem  *   node scripts/log-weather.mjs
 *
 * ⚠ ДАВХАРГА НЬ ТАНАЙ ARCGIS ENTERPRISE ДЭЭР, ArcGIS Online дээр БИШ
 * (`environment.ub.gov.mn/hosting/…`, Enterprise 12.1). Тэр хост нь ӨӨРӨӨ
 * ГАРЫН ҮСЭГ ЗУРСАН TLS гэрчилгээтэй тул Node анхдагчаараа
 * холболтыг татгалзана. Шалгалтыг УНТРААХГҮЙ
 * (`NODE_TLS_REJECT_UNAUTHORIZED=0` нь БҮХ хостод хамаарах тул аюултай):
 * серверийн гэрчилгээг өөрийг нь итгэмжлэгдсэн CA болгож бэхлэнэ —
 * `scripts/environment-ub-gov-mn.pem`, `NODE_EXTRA_CA_CERTS`-ээр заана.
 * Гэрчилгээ 2027-08-16-нд дуусна; шинэчлэгдэхэд PEM-ийг дахин ав.
 *
 * ⚠ ДАВХАРДАЛГҮЙ. API нь станц шинэчлэх хүртэл ИЖИЛ заалтыг буцаасаар
 * байдаг (нийслэлийн хоёр станц 6 цаг тутам л мэдээлдэг). Тиймээс
 * бичихийн өмнө давхарга дээрх станц бүрийн ХАМГИЙН СҮҮЛИЙН `obs_date`
 * -ыг асууж, түүнээс ХОЙШХИ заалтыг л нэмнэ. Үүнгүй бол цагийн хуваарь
 * бүрд 7 хуулбар үүсч, архив хэдхэн сард ашиглах боломжгүй болно.
 */

const API = "https://weather.gov.mn/api/get";

/** WAF нь танил бус агентыг 403-аар хаадаг — `node` мөн хамаарна */
const UA = "Mozilla/5.0";

const LAYER = process.env.WEATHER_LAYER_URL ?? "";

/*
  ХОЁР НЭВТРЭХ АРГЫГ ДЭМЖИНЭ. Аль нь ч байж болно:

    ARCGIS_CLIENT_ID + ARCGIS_CLIENT_SECRET  — бүртгүүлсэн апп (OAuth 2.0)
    ARCGIS_USER + ARCGIS_PASSWORD            — хэрэглэгчийн бүртгэл

  ⚠ Апп нь давхаргад ЗАСВАРЛАХ эрхтэй байх ёстой. Аппын токен нь өөрийн
  эрхтэйгээ ажилладаг тул давхарга нь тухайн аппын эзэмшигчийнх биш бол
  `addFeatures` нь 403 буцаана — тэр үед хэрэглэгчийн бүртгэл рүү шилжинэ.
*/
const CLIENT_ID = process.env.ARCGIS_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.ARCGIS_CLIENT_SECRET ?? "";
const USER = process.env.ARCGIS_USER ?? "";
const PASSWORD = process.env.ARCGIS_PASSWORD ?? "";

/**
 * Хамрах хүрээ: `capital` (анхдагч) эсвэл `all`.
 *
 * Нийслэлд долоон станц — цаг тутам бичихэд жилд ~61 мянган бичлэг
 * болно. Улс даяар 317 станц бол жилд 2.8 сая болох тул хостлогдсон
 * давхаргад хэт хүнд; үнэхээр хэрэгтэй бол хуваарийг сийрэгжүүлнэ.
 */
const SCOPE = process.env.WEATHER_SCOPE === "all" ? "all" : "capital";
const CAPITAL = "Нийслэл";

/**
 * Хүсэлт — алдааг НЭРЛЭЖ буцаана.
 *
 * Node-ийн `fetch` нь сүлжээний бүх доголдлыг ердөө "fetch failed" гэж
 * шиднэ: аль хост, ямар шалтгаанаар унасан нь `e.cause.code`-д нуугдана.
 * Хоёр өөр систем рүү (цаг агаарын API ба ArcGIS) ханддаг тул алийг нь
 * ч ялгахгүй мессеж оношлох боломжгүй.
 *
 * Хаягийн асуулгын хэсгийг ХАСНА — тэнд токен явж болзошгүй.
 */
async function getJson(url, init) {
  const where = String(url).split("?")[0];
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const code = e?.cause?.code ?? e?.code ?? "";
    throw new Error(
      `${where} руу холбогдсонгүй${code ? ` [${code}]` : ""}: ${e?.cause?.message ?? e.message}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${where} → HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const d = await res.json();
  /* ArcGIS алдааг HTTP 200-аар буцаадаг тул биеийг нь шалгана */
  if (d?.error) {
    throw new Error(
      `${where} → ArcGIS ${d.error.code ?? ""} ${d.error.message ?? ""} ${(
        d.error.details ?? []
      ).join(" ")}`.trim(),
    );
  }
  return d;
}

/* --------------------------------------------------------------------------
   ДАВХАРГЫН БҮТЭЦ

   Цэгэн давхарга (wkid 4326). Талбарууд — эх сурвалжийн нэрийг хэвээр
   барив, ингэснээр архивыг API-тай тулгахад хөрвүүлэлт шаардахгүй:

     sid        integer   станцын дугаар
     name       string    станцын нэр
     place      string    сум, дүүрэг
     aimag      string    аймаг
     elev       integer   өндөршил, м
     obs_date   date      АЖИГЛАЛТЫН мөч (давхардал шалгах түлхүүр)
     logged_at  date      архивт бичигдсэн мөч
     ttt        double    агаарын температур, °C
     ttt_feels  double    мэдрэгдэх температур, °C
     ff         integer   агаарын харьцангуй чийг, %
     pst        double    станцын түвшний даралт, гПа
     nh         integer   нийт үүлшил, балл 0–10
     wind_speed double    салхины хурд, м/с
     wind_dir   integer   салхины зүг, градус
     precip     double    хур тунадас, мм
     snow_depth double    цасны зузаан, см
     tmin       double    хамгийн бага температур, °C
     tmax       double    хамгийн их температур, °C

   ⚠ `obs_date` дээр ИНДЕКС тавина — давхардлын шалгалт станц бүрийн
   хамгийн сүүлийн огноог асуудаг тул индексгүй бол архив өсөх тусам
   удаашрана.
   -------------------------------------------------------------------------- */

/* Токеныг `client: "referer"` горимоор авдаг тул хүсэлт бүр ИЖИЛ
   referer-тэй байх ёстой — эс тэгвээс сервер токеныг голно */
const REFERER = { Referer: "https://github.com/monmapgisteam-oss/Environment" };

/** Тоо мөн эсэх — эх сурвалж хоосныг `null` эсвэл мөрөөр өгдөг */
const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Токен авах.
 *
 * Хаягийг ТААМАГЛАХГҮЙ: үйлчилгээний `rest/info` нь өөрөө
 * `authInfo.tokenServicesUrl`-ээ хэлдэг. Ингэснээр нэг код Enterprise
 * (`/gis/sharing/rest/generateToken`) ба ArcGIS Online хоёуланд
 * ажиллана — давхарга нүүвэл зөвхөн `WEATHER_LAYER_URL`-ийг солино.
 */
async function token() {
  const root = `${LAYER.split("/rest/")[0]}/rest/info`;
  const info = await getJson(`${root}?f=json`);
  const url = info?.authInfo?.tokenServicesUrl;
  if (!url) throw new Error(`Токены хаяг олдсонгүй (${root})`);

  if (CLIENT_ID && CLIENT_SECRET) {
    /* Аппын токен. `generateToken`-ий хаягийг мэдэж байгаа тул OAuth-ийнх
       нь түүнээс гарна — портлын үндсийг дахин таамаглах шаардлагагүй */
    const oauth = url.replace(/generateToken$/, "oauth2/token");
    const d = await getJson(oauth, {
      method: "POST",
      body: new URLSearchParams({
        f: "json",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
        expiration: "60",
      }),
    });
    if (!d.access_token) throw new Error(`Аппын токен авсангүй: ${JSON.stringify(d)}`);
    return d.access_token;
  }

  const d = await getJson(url, {
    method: "POST",
    body: new URLSearchParams({
      f: "json",
      username: USER,
      password: PASSWORD,
      /* IP-ээр биш `referer`-ээр: GitHub-ийн ажиллагч бүр өөр IP-тэй */
      client: "referer",
      referer: REFERER.Referer,
      expiration: "60",
    }),
  });
  if (!d.token) throw new Error(`ArcGIS токен авсангүй: ${JSON.stringify(d)}`);
  return d.token;
}

/** Станц бүрийн архивт байгаа ХАМГИЙН СҮҮЛИЙН ажиглалтын мөч */
async function latestPerStation(tk) {
  const body = new URLSearchParams({
    f: "json",
    token: tk,
    where: "1=1",
    groupByFieldsForStatistics: "sid",
    outStatistics: JSON.stringify([
      { statisticType: "max", onStatisticField: "obs_date", outStatisticFieldName: "last_obs" },
    ]),
  });
  const d = await getJson(`${LAYER}/query`, { method: "POST", body, headers: REFERER });
  const out = new Map();
  for (const f of d.features ?? []) {
    const a = f.attributes ?? {};
    if (a.sid != null && a.last_obs != null) out.set(a.sid, a.last_obs);
  }
  return out;
}

async function main() {
  const auth = (CLIENT_ID && CLIENT_SECRET) || (USER && PASSWORD);
  if (!LAYER || !auth) {
    console.log(
      "log-weather: WEATHER_LAYER_URL ба (ARCGIS_CLIENT_ID+SECRET эсвэл " +
        "ARCGIS_USER+PASSWORD) алга — алгаслаа",
    );
    return;
  }

  /* Алхам бүрийг нэрлэж бичнэ — унасан үед аль үе шатанд гэдэг нь
     логоос шууд харагдана */
  console.log("log-weather: цаг агаарын API-аас татаж байна…");
  const [reg, cur] = await Promise.all([
    getJson(`${API}/obs/aimags`, { headers: { "User-Agent": UA } }),
    getJson(`${API}/obs/data/aws`, { headers: { "User-Agent": UA } }),
  ]);
  console.log(`log-weather: ${(cur.stationAWS ?? []).length} станцын заалт ирлээ`);

  const stations = new Map();
  for (const s of reg.aimag_sum ?? []) {
    if (SCOPE === "capital" && s.aimag_name !== CAPITAL) continue;
    if (n(s.lat) == null || n(s.lon) == null) continue;
    stations.set(s.sid, s);
  }

  console.log(`log-weather: ArcGIS токен авч байна (${stations.size} станц хянана)…`);
  const tk = await token();
  console.log("log-weather: токен авлаа, архивын сүүлийн байдлыг асууж байна…");
  const last = await latestPerStation(tk);

  const adds = [];
  const now = Date.now();

  for (const r of cur.stationAWS ?? []) {
    const st = stations.get(r.sid);
    if (!st) continue;

    const at = Date.parse(r.obs_date);
    if (!Number.isFinite(at)) continue;

    /* Архивт байгаагаас шинэ биш бол алгасна — API нь станц шинэчлэх
       хүртэл ижил заалтыг буцаасаар байдаг */
    const seen = last.get(r.sid);
    if (seen != null && at <= seen) continue;

    const pst = n(r.pst);

    adds.push({
      geometry: { x: st.lon, y: st.lat, spatialReference: { wkid: 4326 } },
      attributes: {
        sid: r.sid,
        name: st.sta_name || st.sum_name || "",
        place: st.sum_name || "",
        aimag: st.aimag_name || "",
        elev: n(st.elev),
        /* Геометрээс гадна талбар болгон ч хадгална: CSV-ээр давхарга
           үүсгэхэд энэ хоёр багана ямар ч байсан үүсдэг бөгөөд
           экспортлож шинжлэхэд геометр задлах шаардлагагүй болно */
        lat: st.lat,
        lon: st.lon,
        obs_date: at,
        logged_at: now,
        ttt: n(r.ttt),
        ttt_feels: n(r.ttt_feels),
        ff: n(r.ff),
        /* 0 нь хэмжигдээгүйн тэмдэг — станцын түвшний даралт хэзээ ч
           тэг болохгүй (сүлжээний бодит доод утга 764 гПа) */
        pst: pst === 0 ? null : pst,
        nh: n(r.nh),
        wind_speed: n(r.wind_speed),
        wind_dir: n(r.wind_dir),
        precip: n(r.precip),
        /* Албан жагсаалтад байгаа ч хариултад үргэлж ирдэггүй */
        snow_depth: n(r.snow_depth),
        tmin: n(r.tmin),
        tmax: n(r.tmax),
      },
    });
  }

  if (!adds.length) {
    console.log(`log-weather: шинэ заалт алга (${stations.size} станц хянав)`);
    return;
  }

  const body = new URLSearchParams({
    f: "json",
    token: tk,
    features: JSON.stringify(adds),
    rollbackOnFailure: "true",
  });
  const res = await getJson(`${LAYER}/addFeatures`, { method: "POST", body, headers: REFERER });

  const ok = (res.addResults ?? []).filter((x) => x.success).length;
  const bad = (res.addResults ?? []).filter((x) => !x.success);
  if (bad.length) {
    throw new Error(`${bad.length} бичлэг нэмэгдсэнгүй: ${JSON.stringify(bad[0])}`);
  }
  console.log(`log-weather: ${ok} шинэ заалт архивт нэмэгдлээ`);
}

main().catch((e) => {
  console.error(`log-weather: ${e.message}`);
  process.exitCode = 1;
});
