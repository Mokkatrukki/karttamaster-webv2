import type { AreaMarker } from './area-types'
import { outbox } from './outbox-instance'

// T190/V118: erottele "0 aluetta" ja "lataus epäonnistui" (sama peruste kuin fetchMarkers).
export type AreasResult =
  | { ok: true; areas: AreaMarker[] }
  | { ok: false; error: 'http' | 'network' }

export async function fetchAreas(): Promise<AreasResult> {
  try {
    const res = await fetch('/api/areas')
    if (!res.ok) return { ok: false, error: 'http' }
    const data = (await res.json()) as AreaMarker[]
    return { ok: true, areas: Array.isArray(data) ? data : [] }
  } catch {
    return { ok: false, error: 'network' }
  }
}

// T190/V116/B85: alue-kirjoitukset durable-outboxin kautta — ei enää hiljaisia
// fire-and-forgeteja. Epäonnistunut kirjoitus jää jonoon ja retrytään (durability);
// palautettu boolean = välittömän yrityksen tulos. Alueen id on client-generoitu.
export async function createArea(area: AreaMarker): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'area:' + area.id,
    method: 'POST',
    url: '/api/areas',
    body: JSON.stringify(area),
  })
  return delivered
}

export async function updateArea(area: AreaMarker): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'area:' + area.id,
    method: 'PUT',
    url: `/api/areas/${area.id}`,
    body: JSON.stringify(area),
  })
  return delivered
}

export async function deleteArea(areaId: string): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'area:' + areaId,
    method: 'DELETE',
    url: `/api/areas/${areaId}`,
  })
  return delivered
}
