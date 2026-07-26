import { defineConfig } from 'vite'
import { resolve } from 'path'

// V248/T342 — tiedostot jotka EIVÄT voi jakaa moduulirekisteriä muiden kanssa.
// Kaksi syytä, molemmat rakenteellisia ⊥ siivousvirheitä:
//   (a) `vi.mock(…)` — mock sitoo moduulin globaalisti; oikeaa toteutusta testaava naapuri saisi
//       tyngän (t309:n `src/map/icons`-tynkä söi t158/t140/t138/sign-icon-statuksen `createSignIcon`in).
//   (b) moduulitason tila + `window.history`/`sessionStorage`-riippuvuus jota beforeEach ⊥ nollaa
//       täysin (auth/slug/view-mode-polut).
// Lista on NÄKYVÄ tarkoituksella: sen kasvu on signaali, ⊥ huomaamaton hidastuminen.
const ISOLATED = [
  // (a) vi.mock — jaettu rekisteri ⊥ kelpaa
  'tests/sign-icon-status.test.ts',
  'tests/t120-area-feature-labels.test.ts',
  'tests/t138-icon-status-badge.test.ts',
  'tests/t140-status-ring-color.test.ts',
  'tests/t158-sign-visual.test.ts',
  'tests/t309-marker-drag-rollback.test.ts',
  'tests/t335-marker-focus-map.test.ts',
  // (b) moduulitason tila / history / sessionStorage
  'tests/t51-auth-screen.test.ts',
  'tests/t254-talkoolainen-mode.test.ts',
  'tests/t296-talkoo-landing.test.ts',
]

export default defineConfig({
  // Dev: clean-URL-mappaus (nginx tekee tämän prodissa). /patkat → patkat.html.
  plugins: [
    {
      name: 'clean-urls-dev',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/patkat' || req.url === '/patkat/') req.url = '/patkat.html'
          next()
        })
      },
    },
  ],
  server: {
    host: true,
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        inventory: resolve(__dirname, 'inventory.html'),
        patkat: resolve(__dirname, 'patkat.html'),
        loki: resolve(__dirname, 'loki.html'),
      },
    },
  },
  test: {
    // V248: jsdom VAIN sille tiedostolle joka koskee DOM:ia — docblock `// @vitest-environment jsdom`
    // (91/144 tiedostoa). Default node ∴ uusi puhdas testi on nopea ilman että kukaan muistaa mitään,
    // ja DOM:ia tarvitseva ilman docblockia failaa äänekkäästi (`ReferenceError: document`) ⊥ hiljaa.
    environment: 'node',
    // V248: 19/28 `vi.stubGlobal('localStorage'|'sessionStorage', …)` -tiedostoa ei siivonnut
    // jälkiään ∴ stub vuosi seuraavaan tiedostoon jaetussa globaalissa. Tämä palauttaa globaalit
    // ennen JOKAISTA testiä ⇒ vuoto on rakenteellisesti mahdoton, ⊥ 19 muistamisen varassa.
    unstubGlobals: true,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/admin.ts'],
    },
    // V248: eristys on turvaverkko ⊥ lupa jättää siivoamatta — mutta `vi.mock` & jaettu
    // moduulirekisteri ovat rakenteellisesti ristiriidassa: mockattu moduuli sitoutuu SIIHEN
    // tilaan jossa ensimmäinen importtaaja sen jätti ∴ mockaava & oikeaa toteutusta testaava
    // tiedosto ⊥ voi jakaa rekisteriä. ISOLATED-lista on siksi pysyvä, ⊥ "väliaikainen" —
    // & se on NÄKYVÄ: jos lista kasvaa, se on signaali ⊥ huomaamaton hidastuminen.
    projects: [
      {
        extends: true,
        test: {
          name: 'isolated',
          include: ISOLATED,
          isolate: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'fast',
          include: ['tests/**/*.{test,spec}.ts'],
          exclude: ISOLATED,
          isolate: false,
        },
      },
    ],
  },
})
