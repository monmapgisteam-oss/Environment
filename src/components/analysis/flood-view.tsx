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
            <button data-v="all" className="on">Хотын хэмжээнд</button>
            <button data-v="custom">Сонгосон талбайд</button>
          </div>
          <div className="btnrow" id="customArea" hidden>
            <button className="btn" id="areaDraw">▭ Хилийг дахин тогтоох</button>
            <button className="btn" id="areaView">⤢ Харагдах хүрээгээр</button>
          </div>
          {/* Хэмжээний мөр нуугдсан (2026-10-08); app.js updateAreaInfo бичсээр */}
          <p className="hint" id="areaInfo" hidden>—</p>
        </section>

        {/* Бороо — нягт карт, "Нийт … мм хур" мөр нуугдсан (app.js бичсээр) */}
        <section className="card simple rain">
          <div className="presets" id="presets" />
          <div className="field">
            <label>
              <span>Борооны эрчим</span>
              <span>
                <b id="rainIv">30</b> мм/ц
              </span>
            </label>
            <input type="range" id="rainI" min="1" max="120" step="1" defaultValue="40" />
          </div>
          <div className="field">
            <label>
              <span>Үргэлжлэх хугацаа</span>
              <span>
                <b id="rainDv">60</b> мин
              </span>
            </label>
            <input type="range" id="rainD" min="10" max="720" step="1" defaultValue="60" />
          </div>
          <p className="hint" hidden>
            Нийт хур тунадас <b id="rainTotal">40</b> мм · дээд эрчим <b id="rainPeak">40</b> мм/ц
          </p>
        </section>

        <section className="card simple">
          <h2>Хөрсний чийгийн төлөв</h2>
          <div className="seg small" id="soil">
            <button data-v="1">Хуурай</button>
            <button data-v="0.6">Чийглэг</button>
            <button data-v="0.25" className="on">Ханасан</button>
          </div>
        </section>

        {/* Харагдац — газрын зургаас шилжсэн (2026-10-08) */}
        <section className="card simple viewcard">
          <h2>Дүрслэл</h2>
          <div className="seg small wrap" id="mode">
            <button data-v="0" className="on">Усны гүн</button>
            <button data-v="1">Урсгалын хурд</button>
            <button data-v="2">Аюулын зэрэг</button>
            <button data-v="3">Дээд гүн</button>
            <button data-v="4">Үер хүрэх хугацаа</button>
          </div>
        </section>

        {/* Усны харагдац — "Дүрслэл"-ээс салсан тусдаа карт (хэрэглэгч 2026-10-12). Усны гүний
            горимд л үйлчилнэ тул бусад горимд карт бүхэлдээ нуугдана (app.js updateLegend). */}
        <section className="card simple viewcard" id="waterCard">
          <h2>Усны харагдац</h2>
          <div className="seg small" id="waterStyle">
            <button data-v="2">Хөдөлгөөнт</button>
            <button data-v="0" className="on">Гүний шатлал</button>
            <button data-v="1">Бодит</button>
          </div>
        </section>

        <details className="card adv-card" id="moreBox">
          <summary>
            <h2>⚙ Нэмэлт тохиргоо</h2>
          </summary>

          {/* ⚠ Тооцооны хугацаа, хур тунадасны диаграм, ус зайлуулалт ба урсац, тооцооны тохиргоо НУУГДСАН
              (хэрэглэгч 2026-10-12: "2 zurag deerhiig del"). app.js элементүүдийг id-аар нь уншиж бичсээр тул
              DOM-оос устгаагүй — утгууд нь анхдагчаараа (3 цаг · 10 мм/ц · Туулгүй · 20 м · барилга саад ·
              Маннинг × 1.0), "Удаан" бороонд хугацаа өөрөө ургасаар. */}
          <div hidden>
            <h3 className="sub">Тооцооны хугацаа</h3>
            <div className="field">
              <label>
                <span>Симуляцийн үргэлжлэх хугацаа</span>
                <span>
                  <b id="durv">3</b> цаг
                </span>
              </label>
              <input type="range" id="dur" min="0.5" max="24" step="0.5" defaultValue="3" />
              <p className="hint">Бороо зогссоны дараах гадаргын урсацын хугацааг багтаана.</p>
            </div>

            <h3 className="sub">Хур тунадас</h3>
            <div className="hyeto-box">
              <canvas className="hyeto" id="hyeto" />
            </div>
          </div>
          <div className="field">
            <label>
              <span>Хугацааны хуваарилалт</span>
            </label>
            <div className="seg small" id="rainShape">
              <button data-v="uniform" className="on">Жигд</button>
              <button data-v="tri">Оргил эрчимтэй</button>
              <button data-v="front">Эхэн үедээ эрчимтэй</button>
            </div>
          </div>
          <div className="field">
            <label>
              <span>Орон зайн тархалт</span>
            </label>
            <div className="seg small" id="rainArea">
              <button data-v="all" className="on">Жигд тархалттай</button>
              <button data-v="circle">Голомттой (аадар)</button>
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
            <p className="hint">Аадрын голомтыг газрын зураг дээр тэмдэглэнэ.</p>
          </div>

          <div hidden>
            <h3 className="sub">Ус зайлуулалт ба урсац</h3>
            <div className="field">
              <label>
                <span>Борооны ус зайлуулах шугамын хүчин чадал</span>
                <span>
                  <b id="drainv">10</b> мм/ц
                </span>
              </label>
              <input type="range" id="drain" min="0" max="40" step="1" defaultValue="10" />
            </div>
            <label className="check">
              <input type="checkbox" id="tuulOn" />
              <span>Туул голын урсацыг тооцох</span>
            </label>
            <div className="field" id="tuulField" hidden>
              <label>
                <span>Туул голын зарцуулга</span>
                <span>
                  <b id="tuulQv">40</b> м³/с
                </span>
              </label>
              <input type="range" id="tuulQ" min="5" max="1500" step="5" defaultValue="40" />
            </div>
            <button className="btn ghost wide" id="addInflow">
              ＋ Нэмэлт урсац орох цэг
            </button>
            <ul className="inflows" id="inflowList" />

            <h3 className="sub">Тооцооны тохиргоо</h3>
            <div className="field">
              <label>
                <span>Торын нүдний хэмжээ</span>
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
              <span>Барилгыг урсгалын саад болгон тооцох</span>
            </label>
            <div className="field">
              <label>
                <span>Маннингийн барзгаршлын коэффициент</span>
                <span>
                  × <b id="manv">1.0</b>
                </span>
              </label>
              <input type="range" id="man" min="0.5" max="2" step="0.1" defaultValue="1" />
            </div>
            <div className="field">
              <label>
                <span>Дүрслэлийн хурд</span>
                <span>
                  <b id="speedv">120</b>×
                </span>
              </label>
              <input type="range" id="speed" min="0" max="100" step="1" defaultValue="58" />
            </div>
          </div>
        </details>
      </div>

      <footer className="runbar">
        {/* ⚠ Хувилбарын хураангуй мөр НУУГДСАН (хэрэглэгч 2026-10-12: "del") — app.js
            updateSummary бичсээр; тохиргоо өөрчлөгдвөл ↺ товч тодорно (attn). */}
        <p className="summary" id="scnSummary" hidden>
          —
        </p>
        {/* ⚠ Хурдасгалын мөр НУУГДСАН (хэрэглэгч 2026-10-12: "del") — app.js #speedSeg,
            #speedTxt-ийг уншсаар; анхдагч 1 с = 2 мин. */}
        <div className="speedrow" hidden>
          <span>Хурдасгал</span>
          <div className="seg small" id="speedSeg">
            <button data-v="30">30 с</button>
            <button data-v="120" className="on">2 мин</button>
            <button data-v="600">10 мин</button>
            <button data-v="3600">Дээд</button>
          </div>
          <span className="muted">
            1 с = <b id="speedTxt">2 мин</b>
          </span>
        </div>
        <div className="timebox">
          <div className="timehead">
            <div className="clock">
              <span id="clock">00:00:00</span>
              <small id="clockOf">/ 03:00:00</small>
            </div>
            {/* Төлөвийн шошго НУУГДСАН (хэрэглэгч 2026-10-12: "del"); app.js бичсээр */}
            <span className="tag" id="viewTag" hidden>
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
          <button className="btn primary" id="play" title="Эхлүүлэх, зогсоох (Space)">
            ▶ Эхлүүлэх
          </button>
          <button className="btn" id="reset" title="Анхны төлөвт буцаах">
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
        <div id="loadMsg">Өгөгдлийг ачаалж байна…</div>
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
        <div className="legend" id="legend" />
      </div>
      <div className="tooltip" id="tip" hidden />
    </main>

    {/* ============ БАРУУН: үр дүн ============ */}
    <aside className="panel right">
      <div className="scroll">
        {/* ⚠ "Тооцооны үр дүн" карт ГУРАВ болж салсан (хэрэглэгч 2026-10-12): Хур тунадас · Үер ·
            тархалтын явцын диаграм. Үерт өртсөн барилгын товч хур тунадасны картын ДЭЭР хэвээр
            (хэрэглэгч 2026-10-12: "hur tunadasiin deer"). */}
        <button type="button" className="chip" id="bldBtn">
          ▦ Үерт өртсөн барилга
        </button>
        <section className="card statcard">
          <h2>Хур тунадас</h2>
          <div className="tiles">
            <div className="tile">
              <span>Борооны эрчим</span>
              <b id="sRain">0</b>
              <i>мм/ц</i>
            </div>
            <div className="tile">
              <span>Нийт хур тунадас</span>
              <b id="sRainCum">0</b>
              <i>мм</i>
            </div>
          </div>
        </section>
        <section className="card statcard">
          <h2>Үер</h2>
          <div className="tiles">
            <div className="tile">
              <span>Усанд автсан талбай</span>
              <b id="sWet">0</b>
              <i>км²</i>
            </div>
            <div className="tile">
              <span>Усны эзэлхүүн</span>
              <b id="sVol">0</b>
              <i>сая м³</i>
            </div>
            <div className="tile">
              <span>Усны дээд гүн</span>
              <b id="sHmax">0</b>
              <i>м</i>
            </div>
            <div className="tile">
              <span>Урсгалын дээд хурд</span>
              <b id="sVmax">0</b>
              <i>м/с</i>
            </div>
          </div>
        </section>
        {/* Гарчиг ("Хур тунадас ба үерийн тархалтын явц") help.js-ээр canvas-ын өмнө нэмэгдэнэ */}
        <section className="card chartcard">
          <canvas className="chart" id="chartDomain" />
          {/* "Тооцооны мэдээлэл" НУУГДСАН (хэрэглэгч 2026-10-12: "del"); app.js #perf-д бичсээр */}
          <details className="adv" id="perfBox" hidden>
            <summary>Тооцооны мэдээлэл</summary>
            <p className="hint mono" id="perf">
              —
            </p>
          </details>
        </section>

        {/* "Үйл явдлын бүртгэл" карт НУУГДСАН (хэрэглэгч 2026-10-12: "hereggui del"); app.js #alerts-д бичсээр */}
        <section className="card" hidden>
          <h2>Үйл явдлын бүртгэл</h2>
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
