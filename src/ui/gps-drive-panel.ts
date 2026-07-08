import { nearestUnsetMarker } from '../logic/navigation'
import { SIGN_TYPES } from '../logic/sign-picker'
import type { MarkerManager } from '../map/markers'
import type { DriveMode } from '../map/drive'
import type { MarkerType, SignMarker } from '../logic/types'

const NEAR_M = 200

function typeLabel(type: MarkerType): string {
  return SIGN_TYPES.find((s) => s.type === type)?.label ?? type
}

export class GpsDrivePanel {
  private nearestId: string | null = null
  private readonly labelEl: HTMLElement
  private readonly distEl: HTMLElement

  constructor(
    private readonly el: HTMLElement,
    private readonly driveMode: DriveMode,
    private readonly manager: MarkerManager,
    private readonly getRouteId: () => string,
    // B-lista2: talkoolaisella navigointi rajataan oman pätkän merkkeihin — muuten "Aseta" voi
    // asettaa merkin toisen talkoolaisen pätkältä (nearestUnsetMarker skooppasi vain reitin).
    // Oletus: kaikki merkit (yhteensopivuus / testit).
    private readonly getMarkers: () => SignMarker[] = () => manager.getAll(),
  ) {
    this.labelEl = el.querySelector<HTMLElement>('#gdp-label')!
    this.distEl = el.querySelector<HTMLElement>('#gdp-dist')!
    this.bind()
  }

  update(currentKm: number): void {
    const nearest = nearestUnsetMarker(this.getMarkers(), currentKm * 1000, this.getRouteId())

    if (!nearest) {
      this.el.hidden = true
      this.nearestId = null
      return
    }

    this.nearestId = nearest.id
    const distM = Math.abs(nearest.distanceFromStart - currentKm * 1000)
    const km = (nearest.distanceFromStart / 1000).toFixed(2)
    const distText = distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`

    this.labelEl.textContent = `${typeLabel(nearest.type)} · ${km} km`
    this.distEl.textContent = distText
    this.el.classList.toggle('gdp-near', distM < NEAR_M)
    this.el.hidden = false
  }

  private bind(): void {
    this.el.querySelector('#gdp-jump')!.addEventListener('click', () => {
      const nearest = nearestUnsetMarker(
        this.getMarkers(),
        this.driveMode.currentKm() * 1000,
        this.getRouteId(),
      )
      if (nearest) this.driveMode.jumpToDistance(nearest.distanceFromStart)
    })

    this.el.querySelector('#gdp-aseta')!.addEventListener('click', () => {
      if (this.nearestId) this.manager.updateStatus(this.nearestId, 'aseta')
    })

    this.el.querySelector('#gdp-ohita')!.addEventListener('click', () => {
      if (this.nearestId) this.manager.updateStatus(this.nearestId, 'ohita')
    })
  }
}
