import { RoleSelector } from '../ui/role-selector'
import { AuthScreen } from '../ui/auth-screen'
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

// Kirjautumisen jälkeinen roolin-mukainen UI-wiring (RoleSelector/SnapshotPanel/GpkgControls)
// + itse AuthScreen. onAuthenticated käynnistää sovelluksen init()-vaiheen (main.ts).
export function wireAuth(
  toolbarMenu: HTMLElement,
  getActiveMarkerManager: () => MarkerManager | null,
  onAuthenticated: (code?: string) => void,
): AuthScreen {
  return new AuthScreen(({ role, code }) => {
    setRole(role)
    applyRoleHide(role)
    new RoleSelector(
      document.getElementById('btn-role') as HTMLButtonElement,
      applyRoleView,
      role,
    )
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
        const markers = await fetchMarkers()
        activeMarkerManager.reload(markers)
        activeMarkerManager.fixOrphanRouteIds()
      },
    )
    onAuthenticated(code)
  })
}
