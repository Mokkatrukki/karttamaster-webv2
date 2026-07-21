import './style.css'
import { AuthScreen } from './ui/auth-screen'
import { renderInventory, renderForbidden, renderSignPicker, type LocationSelection } from './ui/inventory-page'
import { SignTemplateModal } from './ui/sign-template-modal'
import { fetchTemplates, createTemplateRemote } from './logic/template-sync'
import { createLibrary } from './logic/sign-library'
import type { SignTemplate, SignLibrary } from './logic/sign-library'
import type { InventoryItem, InventoryLocation, InventoryFields } from './logic/inventory'

const content = document.getElementById('inventory-content')!
const logoutBtn = document.getElementById('btn-inventory-logout')!

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/'
})

let selected: LocationSelection = 'none'

// Server palauttaa snake_case — normalisoi camelCase-logiikkatyyppiin (resolveItemName lukee templateId).
type ServerItem = InventoryItem & { location_id: string | null; template_id: string | null }
type ServerLocation = { id: string; name: string; sort_order: number }

function normItem(r: ServerItem): InventoryItem {
  return { ...r, locationId: r.location_id, templateId: r.template_id }
}
function normLoc(r: ServerLocation): InventoryLocation {
  return { id: r.id, name: r.name, sortOrder: r.sort_order }
}

/** camelCase-kentät → snake_case API-body. */
function toBody(f: InventoryFields): Record<string, unknown> {
  return { name: f.name, qty: f.qty, unit: f.unit, note: f.note, location_id: f.locationId, template_id: f.templateId }
}

async function fetchTemplateMap(): Promise<Map<string, { label: string }>> {
  const res = await fetch('/api/templates')
  if (!res.ok) return new Map()
  const rows = (await res.json()) as Array<{ id: string; label: string }>
  return new Map(rows.map((t) => [t.id, { label: t.label }]))
}

async function load(): Promise<void> {
  const locRes = await fetch('/api/inventory/locations')
  if (!locRes.ok) {
    renderForbidden(content)
    return
  }
  const locations = ((await locRes.json()) as ServerLocation[]).map(normLoc)

  // Oletusvalinta: ensimmäinen paikka jos on, muuten 'none'
  if (selected !== 'none' && !locations.some((l) => l.id === selected)) {
    selected = locations[0]?.id ?? 'none'
  }

  const query = selected === 'none' ? 'location_id=none' : `location_id=${encodeURIComponent(selected)}`
  const [itemsRes, templates] = await Promise.all([fetch(`/api/inventory?${query}`), fetchTemplateMap()])
  const items = ((await itemsRes.json()) as ServerItem[]).map(normItem)

  renderInventory(
    content,
    { locations, items, selectedLocationId: selected, templates },
    {
      onSelectLocation: (sel) => {
        selected = sel
        void load()
      },
      onAddLocation: async (name) => {
        const r = await fetch('/api/inventory/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (r.ok) {
          const created = (await r.json()) as ServerLocation
          selected = created.id
          await load()
        }
        return r.ok
      },
      onAddItem: async (fields) => {
        const r = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toBody(fields)),
        })
        if (r.ok) await load()
        return r.ok
      },
      onEditItem: async (id, fields) => {
        const r = await fetch(`/api/inventory/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toBody(fields)),
        })
        if (r.ok) await load()
        return r.ok
      },
      onDeleteItem: async (item) => {
        if (!window.confirm(`Poista "${item.name}"?`)) return
        const r = await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' })
        if (r.ok) await load()
      },
      onAddSign: (locationId) => void openSignFlow(locationId, templates),
    },
  )
}

/** Luo inventaariorivi joka linkittyy merkkikirjaston malliin (template_id, V165). qty oletus 1. */
async function createSignRow(templateId: string, locationId: string | null): Promise<void> {
  const r = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId, location_id: locationId, qty: 1 }),
  })
  if (r.ok) await load()
}

/** T246: "Lisää merkki" — picker olemassa oleviin + "Uusi merkki" (SignTemplateModal-reuse). */
async function openSignFlow(locationId: string | null, knownTemplates: Map<string, { label: string }>): Promise<void> {
  const result = await fetchTemplates()
  const templates: SignTemplate[] = result.ok ? result.templates : []
  const list = templates.length
    ? templates.map((t) => ({ id: t.id, label: t.label }))
    : [...knownTemplates].map(([id, t]) => ({ id, label: t.label }))
  const library: SignLibrary = createLibrary()
  for (const t of templates) library.set(t.id, t)

  let backdrop: HTMLElement | null = null
  const close = (): void => {
    backdrop?.remove()
    backdrop = null
  }
  backdrop = renderSignPicker(document.body, list, {
    onPick: (templateId) => void createSignRow(templateId, locationId),
    onClose: close,
    onCreateNew: () => {
      const modal = new SignTemplateModal(library, {
        onChanged: () => { /* inventaario reloadaa onSaveTemplaten kautta */ },
        onSaveTemplate: async (tpl, isNew) => {
          if (!isNew) return
          await createTemplateRemote(tpl) // näkyy heti kirjastossa + kartalla (V165)
          await createSignRow(tpl.id, locationId)
        },
      })
      modal.open(null) // luontitila
    },
  })
}

const auth = new AuthScreen((result) => {
  const role = result.role as string
  if (role !== 'admin' && role !== 'järjestäjä') {
    renderForbidden(content) // V163: talkoolainen ei näe inventaariota
    return
  }
  void load()
})
void auth.start()
