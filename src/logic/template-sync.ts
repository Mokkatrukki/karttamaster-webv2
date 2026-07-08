import type { SignTemplate } from './sign-library'
import { outbox } from './outbox-instance'

// T193/V118: erottele "0 mallia" ja "lataus epäonnistui" (sama peruste kuin fetchMarkers/fetchAreas).
// UI näyttää latausvirheen eikä hiljaa tyhjää kirjastoa (joka näyttäisi siltä että kaikki mallit katosivat).
export type TemplatesResult =
  | { ok: true; templates: SignTemplate[] }
  | { ok: false; error: 'http' | 'network' }

export async function fetchTemplates(): Promise<TemplatesResult> {
  try {
    const res = await fetch('/api/templates')
    if (!res.ok) return { ok: false, error: 'http' }
    const data = (await res.json()) as SignTemplate[]
    return { ok: true, templates: Array.isArray(data) ? data : [] }
  } catch {
    return { ok: false, error: 'network' }
  }
}

// T193/V123/V124: template-kirjoitukset durable-outboxin kautta — ei hiljaisia
// fire-and-forgeteja. Epäonnistunut kirjoitus jää jonoon ja retrytään (durability).
// resourceKey 'template:<id>' — template-id on käsin annettu (V97), toimii kuten segment/area.
// Wire-body = SignTemplate sellaisenaan (server rowToTemplate purkaa/pakkaa).
export async function createTemplateRemote(template: SignTemplate): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'template:' + template.id,
    method: 'POST',
    url: '/api/templates',
    body: JSON.stringify(template),
  })
  return delivered
}

export async function updateTemplateRemote(template: SignTemplate): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'template:' + template.id,
    method: 'PUT',
    url: `/api/templates/${template.id}`,
    body: JSON.stringify(template),
  })
  return delivered
}

export async function deleteTemplateRemote(id: string): Promise<boolean> {
  const { delivered } = await outbox.enqueue({
    resourceKey: 'template:' + id,
    method: 'DELETE',
    url: `/api/templates/${id}`,
  })
  return delivered
}
