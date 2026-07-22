import { AuthScreen } from '../ui/auth-screen'
import { AccountMenu } from '../ui/account-menu'
import { SnapshotPanel } from '../ui/snapshot-panel'
import { GpkgControls } from '../ui/gpkg-controls'
import { setRole } from '../logic/role'
import { fetchMarkers } from '../logic/sync'
import type { MarkerManager } from '../map/markers'

export function applyRoleView(role: string): void {
  document.body.dataset.role = role
}

export function applyRoleHide(role: string): void {
  document.querySelectorAll<HTMLElement>('[data-role-hide]').forEach(el => {
    if (el.dataset.roleHide === role) el.hidden = true
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
    setRole(role)
    applyRoleView(role)
    applyRoleHide(role)
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
