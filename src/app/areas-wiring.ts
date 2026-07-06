import type L from 'leaflet'
import { AreaOverlay } from '../map/area-overlay'
import { MapRectEditor } from '../map/map-rect-editor'
import { fetchAreas, createArea, updateArea, deleteArea } from '../logic/area-sync'
import { AreaPanel } from '../ui/area-panel'
import { initAreaView } from '../ui/area-view'

// T108/T109/T111/T114-T116: alueet kartalla + järjestäjän editor-paneeli + hash-URL /a/<hash>-katselu.
// Itsenäinen kokonaisuus — ei riipu merkeistä tai pätkistä, ei vaikuta niihin.
export async function wireAreas(map: L.Map, talkoolainenCode?: string): Promise<void> {
  const mapRectEditor = new MapRectEditor(map)

  const areaOverlay = new AreaOverlay(map)
  areaOverlay.setMapRectEditor(mapRectEditor)
  let areas = await fetchAreas()
  areaOverlay.update(areas)

  await initAreaView(map)

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
