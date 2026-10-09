import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  /*
    ⚠⚠ ЭНГИЙН `fetch` ХОРИОТОЙ (2026-09-17, хэрэглэгч: "дахиж ийм алдаа
    гармааргүй байна"). Порталын давхарга руу токенгүй хүсэлт явуулбал
    сервер HTTP 200 + `{error: 499}` буцаадаг тул `res.ok` үнэн, `features`
    байхгүй — самбар ЧИМЭЭГҮЙ "0 бичлэг" зурна. Нийтийн ариун цэврийн 17
    байгууламж яг ингэж алга болсон: нүхэн жорлонгийн замыг порталд
    шилжүүлэхэд хажуугийн функц энгийн `fetch`-тэйгээ мартагдсан.
    Бүх ArcGIS хүсэлт `arcgisJson()`-оор явна (токен + алдаа барих).
    Порталын БУС хаяг (ArcGIS Online-ийн нээлттэй үйлчилгээ, цаг агаарын
    API, статик JSON) дээр л `// eslint-disable-next-line no-restricted-globals`
    зөвшөөрөгдөнө — ШАЛТГААНЫГ нь хажууд нь бичнэ. Ингэснээр шинэ энгийн
    `fetch` бүр ухамсартай шийдвэр болж, lint-ээс өнгөрөхгүй.
  */
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/arcgis.ts", "src/lib/auth.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "ArcGIS хүсэлтийг arcgisJson()-оор явуул — энгийн fetch токен хавсаргадаггүй, портал 200 + error буцаадаг тул алдаа чимээгүй 0 болно. Порталын бус хаяг бол шалтгааныг бичиж disable хий.",
        },
      ],
    },
  },
]);

export default eslintConfig;
