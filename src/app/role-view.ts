import { AuthScreen } from '../ui/auth-screen'
import { AccountMenu } from '../ui/account-menu'
import { SnapshotPanel } from '../ui/snapshot-panel'
import { GpkgControls } from '../ui/gpkg-controls'
import { setRole } from '../logic/role'
import { fetchMarkers } from '../logic/sync'
import type { MarkerManager } from '../map/markers'

// B184/V344: LAYOUT-ROOLEJA ON KAKSI, TILIROOLEJA KOLME.
//
// VISION §Roolihierarkia: `admin → kaikki järjestäjän oikeudet`. Layoutissa admin ON
// järjestäjä — karttanäkymässä ei ole yhtään admin-erityistä pintaa (käyttäjähallinta &
// loki asuvat omilla sivuillaan omine auth-tarkistuksineen). Silti `data-role` sai tilin
// roolin sellaisenaan ∴ `body[data-role="admin"]` EI osunut yhteenkään
// `[data-role="järjestäjä"]`-sääntöön ja admin putosi jokaisesta niistä hiljaa:
//
//   · `#map-filter-bar`in 48px sisennys jäi pois ⇒ "Suodata" asettui `#left-panel-toggle`in
//     PÄÄLLE kapealla ruudulla & nappasi klikin ⇒ suunnittelupaneelia ⊥ saanut auki lainkaan
//     (mitattu 390px: bar.x=0, trigger 8..96 vs toggle 0..44). Sama umpikuja kuin B170.
//   · `#btn-menu-map-mode` jäi piiloon ⇒ ≤560px admin menetti muokkaustilan kokonaan
//     (yläpalkin nappi on siellä jo piilotettu).
//   · `#status-panel` & `#segment-panel` jäivät ilman järjestäjä-sääntöjään.
//   · `data-role-hide="järjestäjä"` ⊥ osunut ⇒ admin näki talkoolaisen ⋯-valikkolohkon.
//
// Korjaus on YKSI kartta, ⊥ viisi CSS-selektorin laajennusta: uusi rooli (tai uusi sääntö)
// ⊥ voi unohtaa itseään tästä. `data-role` on siis LAYOUT-rooli, ei tilirooli — tilirooli
// elää `AccountMenu`n `role`-propissa & palvelimen tarkistuksissa, jotka ⊥ katso DOM:ia.
export type LayoutRole = 'järjestäjä' | 'talkoolainen'

export function layoutRole(accountRole: string): LayoutRole {
  return accountRole === 'talkoolainen' ? 'talkoolainen' : 'järjestäjä'
}

export function applyRoleView(role: string): void {
  document.body.dataset.role = layoutRole(role)
}

export function applyRoleHide(role: string): void {
  const layout = layoutRole(role)
  document.querySelectorAll<HTMLElement>('[data-role-hide]').forEach(el => {
    if (el.dataset.roleHide === layout) el.hidden = true
  })
}

// Kirjautumisen jälkeinen roolin-mukainen UI-wiring (AccountMenu/SnapshotPanel/GpkgControls)
// + itse AuthScreen. onAuthenticated käynnistää sovelluksen init()-vaiheen (main.ts).
// B48/V80: RoleSelector/#btn-role poistettu — rooli tulee tili-per-rooli-authista, ei toggle.
export function wireAuth(
  toolbarMenu: HTMLElement,
  getActiveMarkerManager: () => MarkerManager | null,
  onAuthenticated: (code?: string) => void,
): AuthScreen {
  const authScreen: AuthScreen = new AuthScreen(({ role, code, displayName }) => {
    // T274/V189 (crossover): /s/<koodi>-deep-link → TALKOO-näkymä riippumatta tilin roolista.
    // Järjestäjä (usein itse reitintekijä) avaa pätkän talkoolais-layoutissa; sessio + oikeudet
    // säilyvät (cookie), vain client-layout vaihtuu. Ilman koodia → tilin oma rooli.
    // B184/V344: `role` voi olla 'admin' — `layoutRole` typistää sen järjestäjäksi YHDESSÄ
    // paikassa ∴ `setRole` ⊥ enää nojaa siihen että `'admin' !== 'talkoolainen'` sattuu
    // tuottamaan oikean arvon vahingossa.
    const viewRole = layoutRole(code ? 'talkoolainen' : role)
    setRole(viewRole)
    applyRoleView(viewRole)
    applyRoleHide(viewRole)
    // T203/V133: tilivalikko (nimi + teema + Kirjaudu ulos) toolbar-menun yläosaan.
    const accountSection = document.getElementById('account-menu-section')
    if (accountSection) {
      new AccountMenu(accountSection, {
        displayName,
        role,
        onLoggedOut: () => { void authScreen.start() },
      })
    }
    const snapshotPanel = new SnapshotPanel(role)
    document.getElementById('btn-snapshot-panel')?.addEventListener('click', (e) => {
      e.stopPropagation()
      snapshotPanel.open()
      toolbarMenu.classList.remove('open')
    })
    new GpkgControls(
      document.getElementById('btn-gpkg-import') as HTMLButtonElement,
      document.getElementById('gpkg-file-input') as HTMLInputElement,
      document.getElementById('gpkg-import-status') as HTMLElement,
      async () => {
        const activeMarkerManager = getActiveMarkerManager()
        if (!activeMarkerManager) return
        // T184/V118: jos re-fetch epäonnistuu, ÄLÄ reload([]) — se pyyhkisi kaikki
        // merkit kartalta. Säilytä nykyinen tila ja ilmoita virheestä.
        const result = await fetchMarkers()
        if (!result.ok) {
          const statusEl = document.getElementById('gpkg-import-status')
          if (statusEl) statusEl.textContent = '⚠ Merkkien lataus epäonnistui — päivitä sivu'
          return
        }
        activeMarkerManager.reload(result.markers)
        activeMarkerManager.fixOrphanRouteIds()
      },
    )
    onAuthenticated(code)
  })
  return authScreen
}
