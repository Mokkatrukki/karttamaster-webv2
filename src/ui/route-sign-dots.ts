import type { MarkerManager } from '../map/markers'
import { routePositionPct, nearestPointIndex } from '../logic/bearing'
import type { RoutePoint } from '../logic/types'
import { SIGN_TYPES } from '../logic/sign-picker'
import { compactLabel } from '../logic/sign-visual'

// T404: irrotettu `marker-list.ts`:stä ennen sen poistoa. Nämä pisteet ovat DRIVE-MOODIN
// edistymispalkin sisältöä (`ProgressBar` → `#route-track`) — niillä ⊥ ole mitään tekemistä
// merkkilistan kanssa; ne asuivat samassa tiedostossa vain historian takia. `progress-bar.ts`
// importoi tämän ∴ vanhan listan poisto ⊥ vie palkkia mukanaan.

function typeInfo(type: string) {
  return SIGN_TYPES.find((s) => s.type === type) ?? SIGN_TYPES[0]
}

export function renderSignDots(
  manager: MarkerManager,
  totalDistance: number,
  activeRouteId: string,
  activeRoutePoints: RoutePoint[],
): void {
  const track = document.getElementById('route-track')
  if (!track) return

  track.querySelectorAll('.route-sign-dot').forEach((el) => el.remove())

  if (totalDistance <= 0) return

  // Vain aktiivisen ajoreitin merkit saavat pisteen.
  manager.getForRoute(activeRouteId).forEach((m) => {
    const idx = nearestPointIndex(activeRoutePoints, m.lat, m.lon)
    const dist = activeRoutePoints[idx].distanceFromStart
    const pct = routePositionPct(dist, totalDistance)
    const info = typeInfo(m.type)
    const dotColor = m.color ?? info.color
    const dotShortLabel = compactLabel(m.label ?? info.label)
    const km = (dist / 1000).toFixed(2)
    const label = `${dotShortLabel} · ${km} km`

    const dot = document.createElement('div')
    dot.className = `route-sign-dot ${m.type}`
    dot.style.left = `${pct}%`
    dot.style.background = dotColor
    dot.innerHTML = `<span class="sign-tooltip">${label}</span>`
    track.appendChild(dot)
  })
}
