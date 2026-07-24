import type L from 'leaflet'
import { AreaOverlay } from '../map/area-overlay'
import { MapRectEditor } from '../map/map-rect-editor'
import { fetchAreas, createArea, updateArea, deleteArea } from '../logic/area-sync'
import { AreaPanel } from '../ui/area-panel'

// T108/T109/T111/T114-T116: alueet kartalla + järjestäjän editor-paneeli + hash-URL /a/<hash>-katselu.
// Itsenäinen kokonaisuus — ei riipu merkeistä tai pätkistä, ei vaikuta niihin.
export async function wireAreas(map: L.Map, talkoolainenCode?: string, onLoadError: () => void = () => {}): Promise<void> {
  const mapRectEditor = new MapRectEditor(map)

  const areaOverlay = new AreaOverlay(map)
  areaOverlay.setMapRectEditor(mapRectEditor)
  // T190/V118: latausvirhe ≠ "0 aluetta" — älä jätä hiljaa tyhjää järjestäjän kartalle.
  const result = await fetchAreas()
  let areas = result.ok ? result.areas : []
  if (!result.ok) onLoadError()
  areaOverlay.update(areas)

  // T283/V199: area-view (+ `marked` ~40KB) tarvitaan VAIN /a/<hash>-deep-linkillä.
  // Guardaa import ettei `marked` bundlaudu main-kartan initial-JS:ään (unused-javascript).
  if (/^\/a\/[^/]+$/.test(window.location.pathname)) {
    const { initAreaView } = await import('../ui/area-view')
    await initAreaView(map)
  }

  const areaPanelContainer = document.getElementById('area-panel-container')
  let areaPanel: AreaPanel | null = null
  if (areaPanelContainer && !talkoolainenCode) {
    areaPanel = new AreaPanel(areaPanelContainer, areas, {
      onAreaAdd: async (area) => {
        await createArea(area)
        areas = [...areas, area]
        areaOverlay.update(areas)
      },
      onAreaUpdate: async (area) => {
        await updateArea(area)
        areas = areas.map(a => a.id === area.id ? area : a)
        areaOverlay.update(areas)
      },
      onAreaDelete: async (areaId) => {
        await deleteArea(areaId)
        areas = areas.filter(a => a.id !== areaId)
        areaOverlay.update(areas)
      },
      onEnterDrawMode: (onDone) => {
        mapRectEditor.startDraw(onDone)
      },
      onEnterMapMode: (onClick) => {
        map.getContainer().style.cursor = 'crosshair'
        const handler = (e: L.LeafletMouseEvent) => {
          map.off('click', handler)
          map.getContainer().style.cursor = ''
          onClick(e.latlng.lat, e.latlng.lng)
        }
        map.on('click', handler)
      },
      onExitMapMode: () => {
        map.getContainer().style.cursor = ''
      },
    })

    areaOverlay.setOnAreaMove(async (area) => {
      await updateArea(area)
      areas = areas.map(a => a.id === area.id ? area : a)
      areaPanel?.updateAreas(areas)
    })
  }
}
