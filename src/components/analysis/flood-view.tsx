"use client";

import * as React from "react";
import "./flood.css";

/* --------------------------------------------------------------------------
   ҮЕРИЙН СИМУЛЯЦИ — ПЛАТФОРМД ШУУД (2026-10-09-нд iframe-ээс хөрвүүлсэн)

   Эх нь өөр хүний бичсэн бие даасан апп (`I:/Environment/Flood_envi`): 2D
   гүехэн усны local-inertial загвар WebGL2 дээр, барилгын нөлөөллийн
   шинжилгээ, ArcGIS-ийн 2D/3D. Урьд нь `public/flood/index.html`-ийг
   iframe-ээр харуулдаг байсан; хэрэглэгч 2026-10-09-нд платформын код руу
   хөрвүүлэхийг хүсэв ("hurwuul").

   Бүтэц:
   · `lib/flood/` — хөдөлгүүр (solver, renderer, impact, chart, geotiff),
     зураг (arcgis.js), удирдлага (app.js). JS хэвээр (allowJs): 3,300 мөр
     GPU код, тооцоог үг үсэгчлэн хадгалсан.
   · Энэ файл — аппын бүтэц (JSX) ба амьдралын мөчлөг.
   · `flood.css` — загвар, БҮГД `.flood-app`-аар хязгаарлагдсан.
   · Өгөгдөл `public/flood/data/` дотор хэвээр (19 МБ, статик).

   ⚠⚠ БҮТЭЦ НЬ REACT-ААР НЭГ Л УДАА ЗУРАГДАНА (`MARKUP` модулийн тогтмол):
   удирдлага (`App`) элементүүдийг id-аар нь олж шууд өөрчилдөг (анги,
   бичвэр, `hidden`, innerHTML). React дахин зурж тэдгээрийг хуучин утгаар
   нь дарж бичих ёсгүй — ижил элементийн лавлагаа нь React-д "өөрчлөгдөөгүй"
   гэсэн үг. Төлөв (state) нэмэхдээ үүнийг санана.
   ⚠ Id-ууд үндсээрээ хязгаарлагдсан хайлтаар олдоно (`ROOT.querySelector`),
   `document.getElementById` биш — платформын бусад хэсэгтэй мөргөлдөхгүй.

   ⚠ SDK: платформын ачаалагч (4.33, `lib/arcgis-sdk.ts`). Эх апп 4.34-ийг
   өөрөө ачаалдаг байсан — нэг баримтад хоёр хувилбар байж болохгүй.
   ⚠ СЭДЭВ: өнгө нь `:root[data-theme]`-ийг CSS-ээр дагана; диаграм ба 3D-ийн
   дэвсгэр canvas-д зурагддаг тул `data-theme` солигдоход `applyTheme()`.
   ⚠ Аппын өөрийн толгой (лого, "?" заавар, сэдэв солих товч) ба заавар
   цонх ОРООГҮЙ — 2026-10-08-нд аль хэдийн нуугдсан байсан.
   -------------------------------------------------------------------------- */

type FloodApp = { start(): Promise<void>; destroy(): void; applyTheme(): void };

const MARKUP = (
  <>
    {/* ============ ЗҮҮН: хувилбар ============ */}
    <aside className="panel left">
      <div className="scroll">
        {/* Талбай — гарчиггүй, картын хүрээгүй (хэрэглэгч 2026-10-08) */}
        <section className="card simple bare">
          <div className="seg" id="domain">
            <button data-v="all" className="on">Бүх хот</button>
            <button data-v="custom">Талбай сонгох</button>
          </div>
          <div className="btnrow" id="customArea" hidden>
            <button className="btn" id="areaDraw">▭ Дахин зурах</button>
            <button className="btn" id="areaView">⤢ Харагдацаар</button>
          </div>
          {/* Хэмжээний мөр нуугдсан (2026-10-08); app.js updateAreaInfo бичсээр */}
          <p className="hint" id="areaInfo" hidden>—</p>
        </section>

        {/* Бороо — нягт карт, "Нийт … мм хур" мөр нуугдсан (app.js бичсээр) */}
        <section className="card simple rain">
          <div className="presets" id="presets" />
          <div className="field">
            <label>
              <span>Эрчим</span>
              <span>
                <b id="rainIv">30</b> мм/ц
              </span>
            </label>
            <input type="range" id="rainI" min="1" max="120" step="1" defaultValue="40" />
          </div>
          <div className="field">
            <label>
              <span>Хэр удаан орох</span>
              <span>
                <b id="rainDv">60</b> мин
              </span>
            </label>
            <input type="range" id="rainD" min="10" max="720" step="5" defaultValue="60" />
          </div>
          <p className="hint" hidden>
            Нийт <b id="rainTotal">40</b> мм хур · оргил <b id="rainPeak">40</b> мм/ц
          </p>
        </section>

        <section className="card simple">
          <h2>Хөрс</h2>
          <div className="seg small" id="soil">
            <button data-v="1">Хуурай</button>
            <button data-v="0.6">Дунд</button>
            <button data-v="0.25">Нойтон</button>
            <button data-v="0" className="on">Хөлдүү</button>
          </div>
        </section>

        {/* Харагдац — газрын зургаас шилжсэн (2026-10-08) */}
        <section className="card simple viewcard">
          <h2>Харагдац</h2>
          <div className="seg small wrap" id="mode">
            <button data-v="0" className="on">Гүн</button>
            <button data-v="1">Хурд</button>
            <button data-v="2">Аюул</button>
            <button data-v="3">Хамгийн их гүн</button>
            <button data-v="4">Ус хүрэх хугацаа</button>
          </div>
          <div className="seg small" id="waterStyle">
            <button data-v="2">Хөдөлгөөнт</button>
            <button data-v="0" className="on">Өнгөт (гүн)</button>
            <button data-v="1">Бодит</button>
          </div>
          {/* Урсгалын сумын оронд (хэрэглэгч 2026-10-09): үерт автсан барилгыг зэрэглэлээр нь зурагт гаргах товч */}
          <button type="button" className="chip" id="bldBtn">
            ▦ Барилга
          </button>
        </section>

        <details className="card adv-card" id="moreBox">
          <summary>
            <h2>⚙ Бусад тохиргоо</h2>
          </summary>

          <h3 className="sub">Хугацаа</h3>
          <div className="field">
            <label>
              <span>Нийт тооцох хугацаа</span>
              <span>
                <b id="durv">3</b> цаг
              </span>
            </label>
            <input type="range" id="dur" min="0.5" max="24" step="0.5" defaultValue="3" />
            <p className="hint">Бороо зогссоны дараах урсалтыг оруулаад.</p>
          </div>

          <h3 className="sub">Бороо</h3>
          <div className="hyeto-box">
            <canvas className="hyeto" id="hyeto" />
          </div>
          <div className="field">
            <label>
              <span>Хэлбэр</span>
            </label>
            <div className="seg small" id="rainShape">
              <button data-v="uniform" className="on">Тэгш</button>
              <button data-v="tri">Оргилтой</button>
              <button data-v="front">Эхэндээ хүчтэй</button>
            </div>
          </div>
          <div className="field">
            <label>
              <span>Хаана орох</span>
            </label>
            <div className="seg small" id="rainArea">
              <button data-v="all" className="on">Бүх талбайд</button>
              <button data-v="circle">Нэг газар (аадар)</button>
            </div>
          </div>
          <div className="field" id="radiusField" hidden>
            <label>
              <span>Аадрын радиус</span>
              <span>
                <b id="rainRv">6</b> км
              </span>
            </label>
            <input type="range" id="rainR" min="1" max="25" step="0.5" defaultValue="6" />
            <p className="hint">Аадрын төвийг газрын зураг дээр дарж сонгоно.</p>
          </div>

          <h3 className="sub">Ус</h3>
          <div className="field">
            <label>
              <span>Ус зайлуулах шугам</span>
              <span>
                <b id="drainv">10</b> мм/ц
              </span>
            </label>
            <input type="range" id="drain" min="0" max="40" step="1" defaultValue="10" />
          </div>
          <label className="check">
            <input type="checkbox" id="tuulOn" />
            <span>Туул голын урсац нэмэх</span>
          </label>
          <div className="field" id="tuulField" hidden>
            <label>
              <span>Туулын урсац</span>
              <span>
                <b id="tuulQv">40</b> м³/с
              </span>
            </label>
            <input type="range" id="tuulQ" min="5" max="1500" step="5" defaultValue="40" />
          </div>
          <button className="btn ghost wide" id="addInflow">
            ＋ Нэмэлт урсацын цэг
          </button>
          <ul className="inflows" id="inflowList" />

          <h3 className="sub">Тооцоо</h3>
          <div className="field">
            <label>
              <span>Нарийвчлал</span>
            </label>
            <div className="seg small" id="res">
              <button data-v="1">10 м</button>
              <button data-v="2" className="on">20 м</button>
              <button data-v="3">30 м</button>
            </div>
            <p className="hint" id="gridInfo">—</p>
          </div>
          <label className="check">
            <input type="checkbox" id="bldObs" defaultChecked />
            <span>Барилгыг саад болгох</span>
          </label>
          <div className="field">
            <label>
              <span>Гадаргын барзгаршил</span>
              <span>
                × <b id="manv">1.0</b>
              </span>
            </label>
            <input type="range" id="man" min="0.5" max="2" step="0.1" defaultValue="1" />
          </div>
          <div className="field">
            <label>
              <span>Тоглуулах хурд (нарийн)</span>
              <span>
                <b id="speedv">120</b>×
              </span>
            </label>
            <input type="range" id="speed" min="0" max="100" step="1" defaultValue="58" />
          </div>
        </details>
      </div>

      <footer className="runbar">
        <p className="summary" id="scnSummary">
          —
        </p>
        <div className="speedrow">
          <span>Хурд</span>
          <div className="seg small" id="speedSeg">
            <button data-v="30">30с</button>
            <button data-v="120" className="on">2м</button>
            <button data-v="600">10м</button>
            <button data-v="3600">Макс</button>
          </div>
          <span className="muted">
            1с = <b id="speedTxt">2 мин</b>
          </span>
        </div>
        <div className="timebox">
          <div className="timehead">
            <div className="clock">
              <span id="clock">00:00:00</span>
              <small id="clockOf">/ 03:00:00</small>
            </div>
            <span className="tag" id="viewTag">
              Бэлэн
            </span>
          </div>
          <input type="range" id="timeline" min="0" max="1000" defaultValue="0" aria-label="Цагийн шугам" />
        </div>
        {/* Явцын зурвас цагийн шугамтай давхардах тул нуугдсан; app.js #prog-д бичсээр */}
        <div className="progress" hidden>
          <div id="prog" />
        </div>
        <div className="runrow">
          <button className="btn primary" id="play" title="Зай (Space)">
            ▶ Эхлүүлэх
          </button>
          <button className="btn" id="reset" title="Эхнээс нь">
            ↺
          </button>
        </div>
      </footer>
    </aside>

    {/* ============ ЗУРАГ ============
        Зураг дээр ЗӨВХӨН ойртуулах ба суурь зургийн цуглуулга (Esri, зүүн дээд),
        2D/3D (дээд голд), таних тэмдэг (зүүн доод). */}
    <main className="mapwrap">
      <div id="mapStack">
        <div id="view2d" className="view" />
        <div id="view3d" className="view" hidden />
      </div>
      <div className="loading" id="loading">
        <div className="spin" />
        <div id="loadMsg">Өгөгдөл ачаалж байна…</div>
      </div>
      <div className="maptools">
        <div className="seg glass viewmode" id="viewMode">
          <button data-v="2d" className="on">
            2D
          </button>
          <button data-v="3d">3D</button>
        </div>
      </div>
      <div className="modebar">
        <div className="legend glass" id="legend" />
      </div>
      <div className="tooltip" id="tip" hidden />
      <div className="clickmode" id="clickMode" hidden />
    </main>

    {/* ============ БАРУУН: үр дүн ============ */}
    <aside className="panel right">
      <div className="scroll">
        <section className="card risk">
          <h2>Үерийн эрсдэлийн дүгнэлт</h2>
          <div className="risk-head">
            <div className="badge" id="riskBadge" data-level="0">
              Тооцоогүй
            </div>
            <p className="hint" id="riskText">
              Симуляци эхлэхэд барилгын нөлөөллийг тооцно.
            </p>
          </div>
          <div className="bldstat">
            <div className="bldnum">
              <b id="bldTotal">0</b>
              <span>барилга үерт өртсөн</span>
            </div>
            <div className="bldbar" id="bldBar" />
            <ul className="bldlegend" id="bldLegend" />
          </div>
        </section>

        <section className="card">
          <h2>Үр дүн</h2>
          <p className="group-label">Хур тунадас</p>
          <div className="tiles">
            <div className="tile">
              <span>Одоогийн бороо</span>
              <b id="sRain">0</b>
              <i>мм/ц</i>
            </div>
            <div className="tile">
              <span>Нийт хур</span>
              <b id="sRainCum">0</b>
              <i>мм</i>
            </div>
          </div>
          <p className="group-label">Үер</p>
          <div className="tiles">
            <div className="tile accent">
              <span>Автсан талбай</span>
              <b id="sWet">0</b>
              <i>км²</i>
            </div>
            <div className="tile">
              <span>Гадаргын ус</span>
              <b id="sVol">0</b>
              <i>сая м³</i>
            </div>
            <div className="tile">
              <span>Их гүн</span>
              <b id="sHmax">0</b>
              <i>м</i>
            </div>
            <div className="tile">
              <span>Их хурд</span>
              <b id="sVmax">0</b>
              <i>м/с</i>
            </div>
          </div>
          <canvas className="chart" id="chartDomain" />
          <details className="adv" id="perfBox">
            <summary>Тооцооны мэдээлэл</summary>
            <p className="hint mono" id="perf">
              —
            </p>
          </details>
        </section>

        <section className="card">
          <h2>Үйл явдал</h2>
          <ul className="alerts" id="alerts" />
        </section>
      </div>
    </aside>
  </>
);

export function FloodView() {
  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    let app: FloodApp | null = null;
    let gone = false;
    /* Хөдөлгүүр 3,300 мөр — табыг нээх үед л татагдана */
    void import("@/lib/flood/app").then(({ App }) => {
      if (gone) return;
      app = new App(el) as FloodApp;
      void app.start();
    });
    const theme = new MutationObserver(() => app?.applyTheme());
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      gone = true;
      theme.disconnect();
      app?.destroy();
    };
  }, []);

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-xs border border-line">
      <div ref={root} className="flood-app">
        {MARKUP}
      </div>
    </div>
  );
}
