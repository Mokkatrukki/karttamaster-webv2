import './style.css'
import { AuthScreen } from './ui/auth-screen'
import { renderInventory, renderForbidden, renderSignPicker, defaultSelection, type LocationSelection, type InventoryViewMode } from './ui/inventory-page'
import { SignTemplateModal } from './ui/sign-template-modal'
import { fetchTemplates, createTemplateRemote, updateTemplateRemote, deleteTemplateRemote } from './logic/template-sync'
import { createLibrary } from './logic/sign-library'
import type { SignTemplate, SignLibrary } from './logic/sign-library'
import type { InventoryItem, InventoryLocation, InventoryFields } from './logic/inventory'
import { showToast } from './ui/toast'
import { describeUndo, type UndoAction } from './logic/inventory-undo'
import { renderMergePanel, unlinkedCount, type MergeActionResult } from './ui/inventory-merge-panel'
import { computeMarkerStock } from './logic/marker-stock'
import { fetchInventoryLinkRows, linkInventoryItemToTemplate } from './logic/inventory-sync'
import { fetchMarkers } from './logic/sync'

const content = document.getElementById('inventory-content')!
const logoutBtn = document.getElementById('btn-inventory-logout')!

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/'
})

let selected: LocationSelection = 'none'
let initialized = false // ensimmäisellä latauksella oletus = Kärry/paikka, EI 'all'
// T251: moodi sessiokohtainen — module-scope, EI localStorage → reload palauttaa aina 'read' (V170).
let viewMode: InventoryViewMode = 'read'

// Server palauttaa snake_case — normalisoi camelCase-logiikkatyyppiin (resolveItemName lukee templateId).
type ServerItem = InventoryItem & { location_id: string | null; template_id: string | null; not_sign?: number }
type ServerLocation = { id: string; name: string; sort_order: number }

function normItem(r: ServerItem): InventoryItem {
  return { ...r, locationId: r.location_id, templateId: r.template_id, notSign: r.not_sign === 1 }
}
function normLoc(r: ServerLocation): InventoryLocation {
  return { id: r.id, name: r.name, sortOrder: r.sort_order }
}

/** camelCase-kentät → snake_case API-body. */
function toBody(f: InventoryFields & { notSign?: boolean }): Record<string, unknown> {
  return { name: f.name, qty: f.qty, unit: f.unit, note: f.note, location_id: f.locationId, template_id: f.templateId, not_sign: f.notSign ? 1 : 0 }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Kokonais-item → InventoryFields (undo-revert PUT/POST tarvitsee koko kenttäsetin, V173). */
function fieldsOf(i: InventoryItem): InventoryFields & { notSign: boolean } {
  return {
    notSign: i.notSign === true, // V279: tarvike-lippu ei saa nollautua muun editin sivutuotteena
    name: i.name,
    qty: i.qty,
    unit: i.unit,
    location: i.location,
    note: i.note,
    locationId: i.locationId ?? null,
    templateId: i.templateId ?? null,
  }
}

async function fetchTemplateMap(): Promise<Map<string, SignTemplate>> {
  const res = await fetchTemplates()
  if (!res.ok) return new Map()
  return new Map(res.templates.map((t) => [t.id, t]))
}

async function load(): Promise<void> {
  const locRes = await fetch('/api/inventory/locations')
  if (!locRes.ok) {
    renderForbidden(content)
    return
  }
  const locations = ((await locRes.json()) as ServerLocation[]).map(normLoc)

  // Oletusvalinta avattaessa = Kärry/paikka (ei 'all'). Poistetun paikan valinta → sama oletus.
  if (!initialized) {
    selected = defaultSelection(locations)
    initialized = true
  } else if (selected !== 'all' && selected !== 'none' && !locations.some((l) => l.id === selected)) {
    selected = defaultSelection(locations)
  }

  // 'all' → kaikki itemit (page ryhmittää); 'none' → orvot; muuten paikan itemit.
  const itemsUrl =
    selected === 'all'
      ? '/api/inventory'
      : selected === 'none'
        ? '/api/inventory?location_id=none'
        : `/api/inventory?location_id=${encodeURIComponent(selected)}`
  // T386: yhdistämislaskuri koskee KOKO inventaariota ⊥ vain valittua paikkaa ∴ haetaan kaikki
  // rivit erikseen (paitsi 'all'-välilehdellä, jossa lista jo on kaikki).
  const allUrl = '/api/inventory'
  const [itemsRes, templates, allRes, markersRes] = await Promise.all([
    fetch(itemsUrl),
    fetchTemplateMap(),
    selected === 'all' ? Promise.resolve(null) : fetch(allUrl),
    fetchMarkers(),
  ])
  const items = ((await itemsRes.json()) as ServerItem[]).map(normItem)
  const allItems = allRes && allRes.ok ? ((await allRes.json()) as ServerItem[]).map(normItem) : items

  // T387/V276: kartalla-luku per template_id. Marker-haun epäonnistuminen ⊥ estä inventaarion
  // latausta → tyhjä lista, badge näyttää "kartalla 0" (client-laskenta olemassa olevasta datasta).
  const markerStock = computeMarkerStock(allItems, markersRes.ok ? markersRes.markers : [])

  // V172: näytä "Kumoa"-toast viimeisimmästä mutaatiosta (vain edit-moodissa; mutaatiot
  // eivät muutenkaan aukea read-moodissa V169). Uusi mutaatio korvaa edellisen (showToast).
  const showUndo = (action: UndoAction, revert: () => Promise<void>): void => {
    if (viewMode !== 'edit') return
    showToast(describeUndo(action, templates), { actionLabel: 'Kumoa', onAction: () => void revert() })
  }

  renderInventory(
    content,
    { locations, items, selectedLocationId: selected, templates, viewMode, unlinkedCount: unlinkedCount(allItems), markerStock },
    {
      onSelectLocation: (sel) => {
        selected = sel
        void load() // tabin vaihto säilyttää moodin (viewMode ei nollaudu, V170)
      },
      onToggleViewMode: () => {
        viewMode = viewMode === 'read' ? 'edit' : 'read'
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
      onRenameLocation: async (id, name) => {
        const r = await fetch(`/api/inventory/locations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (r.ok) await load()
        return r.ok
      },
      onDeleteLocation: async (loc) => {
        if (!window.confirm(`Poista paikka "${loc.name}"? Tavarat siirtyvät "Ei paikkaa" -kohtaan.`)) return
        // V173c: snapshot affektoidut itemit ENNEN DELETEä — V166 nullaa location_id peruuttamattomasti.
        const affRes = await fetch(`/api/inventory?location_id=${encodeURIComponent(loc.id)}`)
        const affected: InventoryItem[] = affRes.ok ? ((await affRes.json()) as ServerItem[]).map(normItem) : []
        const r = await fetch(`/api/inventory/locations/${loc.id}`, { method: 'DELETE' })
        if (!r.ok) return
        await load()
        showUndo(
          { kind: 'delete-location', locationName: loc.name, affectedItemIds: affected.map((i) => i.id) },
          async () => {
            // POST paikka uudelleen (uusi id) + PUT itemit uuteen location_id:hen (V173c).
            const cr = await fetch('/api/inventory/locations', {
              method: 'POST',
              headers: JSON_HEADERS,
              body: JSON.stringify({ name: loc.name }),
            })
            if (!cr.ok) return
            const newLoc = (await cr.json()) as ServerLocation
            for (const it of affected) {
              await fetch(`/api/inventory/${it.id}`, {
                method: 'PUT',
                headers: JSON_HEADERS,
                body: JSON.stringify(toBody({ ...fieldsOf(it), locationId: newLoc.id })),
              })
            }
            await load()
          },
        )
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
        const before = items.find((i) => i.id === id) // ENNEN-tila undo-reverttiin (V173b)
        const r = await fetch(`/api/inventory/${id}`, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify(toBody(fields)),
        })
        if (!r.ok) return false
        await load()
        if (before) {
          // Kind: paikka vaihtui → siirto; muuten qty vaihtui → määrä. Muut kenttäeditit (nimi/note)
          // ovat tarkoituksellisia → ei toastia (undo on "oho painoin" -turvaverkko steppeille/siirrolle).
          const moved = (before.locationId ?? null) !== (fields.locationId ?? null)
          const kind = moved ? 'move' : before.qty !== fields.qty ? 'qty' : null
          if (kind) {
            showUndo({ kind, item: before }, async () => {
              await fetch(`/api/inventory/${id}`, {
                method: 'PUT',
                headers: JSON_HEADERS,
                body: JSON.stringify(toBody(fieldsOf(before))),
              })
              await load()
            })
          }
        }
        return true
      },
      onDeleteItem: async (item) => {
        if (!window.confirm(`Poista "${item.name}"?`)) return
        const r = await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' })
        if (!r.ok) return
        await load()
        showUndo({ kind: 'delete-item', item }, async () => {
          // V173a: POST uudelleen (uusi id — rivi funktionaalisesti sama).
          await fetch('/api/inventory', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(toBody(fieldsOf(item))),
          })
          await load()
        })
      },
      onAddSign: (locationId) => void openSignFlow(locationId, templates),
      onOpenSign: (templateId) => {
        const tpl = templates.get(templateId)
        if (!tpl) return
        const library: SignLibrary = createLibrary()
        for (const [id, t] of templates) library.set(id, t)
        const modal = new SignTemplateModal(library, {
          onChanged: () => { /* reload tapahtuu save/deleten kautta */ },
          onSaveTemplate: async (t, isNew) => {
            if (isNew) await createTemplateRemote(t)
            else await updateTemplateRemote(t)
            await load() // label/visuaali voi muuttua → päivitä rivit (V165 elävä)
          },
          onDeleteTemplate: async (id) => {
            await deleteTemplateRemote(id)
            await load() // inventaariorivi jää, näyttää fallback-nimen (V165)
          },
        })
        modal.open(tpl) // muokkaustila
      },
      // T250/T25x: tekstirivi → merkki. Picker: valitse OLEMASSA oleva merkki (linkitä rivi) TAI
      // luo uusi (esitäytetty nimi). V186: ei kiinnitystapaa — sama tunnus kaikille, oletus keppi.
      onConvertToSign: (item) => void openConvertFlow(item),
      // T386: yhdistämistyökalu omana näkymänään. Saa KAIKKI rivit (⊥ vain valitun paikan).
      onOpenMerge: () => openMergePanel(allItems, locations, templates),
    },
  )
}

/** PUT yksi inventaariorivi annetuilla kentillä → MergeActionResult (virheteksti riville, V21). */
async function putItem(item: InventoryItem, patch: Partial<InventoryFields & { notSign: boolean }>): Promise<MergeActionResult> {
  try {
    const r = await fetch(`/api/inventory/${item.id}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(toBody({ ...fieldsOf(item), ...patch })),
    })
    if (r.ok) return { ok: true }
    const body = (await r.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: apiErrorText(r.status, body.error) }
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen — rivi jäi listalle.' }
  }
}

/** V21: virhe kertoo MIKSI. Tunnistetut backend-koodit suomeksi, tuntematon näyttää raakakoodin. */
function apiErrorText(status: number, code?: string): string {
  const known: Record<string, string> = {
    not_sign_with_template: 'Tarvikkeeksi merkittyä riviä ei voi linkittää merkkiin.',
    location_mismatch: 'Rivit ovat eri paikassa — määrät eivät summaudu vahingossa.',
    same_item: 'Rivi on sama kuin kohde.',
    not_found: 'Riviä ei löytynyt — se on ehkä poistettu.',
    template_not_found: 'Merkkipohjaa ei löytynyt.',
  }
  if (code && known[code]) return known[code]
  return `Tallennus epäonnistui (${status}${code ? `: ${code}` : ''}).`
}

/** T386: avaa yhdistämispaneeli. Jokainen kuittaus persistoituu heti; sulkeminen reloadaa listan. */
function openMergePanel(
  allItems: InventoryItem[],
  locations: InventoryLocation[],
  templates: Map<string, SignTemplate>,
): void {
  let backdrop: HTMLElement | null = null
  const close = (): void => {
    backdrop?.remove()
    backdrop = null
    void load() // kuittaukset ovat jo kannassa — reload synkkaa listan & laskurin
  }

  backdrop = renderMergePanel(
    document.body,
    { items: allItems, templates, locations },
    {
      onLink: (item, templateId) => putItem(item, { templateId }),
      onNotSign: (item) => putItem(item, { notSign: true, templateId: null }),
      onUndo: (item) => putItem(item, {}), // fieldsOf(item) = ENNEN-tila (V173b)
      onMerge: async (source, target) => {
        try {
          const r = await fetch('/api/inventory/merge', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ sourceId: source.id, targetId: target.id }),
          })
          if (r.ok) return { ok: true }
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: apiErrorText(r.status, body.error) }
        } catch {
          return { ok: false, error: 'Ei yhteyttä palvelimeen — rivi jäi listalle.' }
        }
      },
      onCreateTemplate: (item) => {
        const library: SignLibrary = createLibrary()
        for (const [id, t] of templates) library.set(id, t)
        const modal = new SignTemplateModal(library, {
          onChanged: () => { /* linkitys tapahtuu onSaveTemplaten kautta */ },
          onSaveTemplate: async (tpl, isNew) => {
            if (isNew) await createTemplateRemote(tpl) // näkyy heti kirjastossa + kartalla (V165)
            else await updateTemplateRemote(tpl)
            await putItem(item, { templateId: tpl.id })
            close() // uusi template ⊥ ole paneelin templates-mapissa → reload hakee sen
          },
        })
        modal.open(null, { label: item.name, favorite: false }) // esitäytetty nimi rivin nimestä
      },
      onClose: close,
    },
  )
}

/** T250: linkitä olemassa oleva inventaariorivi merkkiin (template_id) — säilyttää qty/paikka/note. */
async function linkItemToTemplate(item: InventoryItem, templateId: string): Promise<void> {
  const r = await fetch(`/api/inventory/${item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      toBody({ name: item.name, qty: item.qty, unit: item.unit, location: item.location, note: item.note, locationId: item.locationId ?? null, templateId }),
    ),
  })
  if (r.ok) await load()
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
  // V186: picker näyttää kylttipinnan (pelkkä label, yksi tunnus) — ei kiinnitystapavalintaa.
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
        // T399/V289: näytä mitä varastossa on jo — usein merkkipohja luodaan juuri
        // olemassa olevalle laatikon riville, ⊥ uudelle.
        inventoryRows: fetchInventoryLinkRows,
        onSaveTemplate: async (tpl, isNew, linkedItemId) => {
          if (!isNew) return
          await createTemplateRemote(tpl) // näkyy heti kirjastossa + kartalla (V165)
          if (linkedItemId) {
            // Käyttäjä valitsi OLEMASSA olevan varastorivin → linkitä se. UUTTA riviä ⊥ luoda:
            // muuten sama merkki olisi kahdella rivillä (uusi qty 1 + vanha oikea määrä).
            const ok = await linkInventoryItemToTemplate(linkedItemId, tpl.id)
            if (!ok) {
              showToast(`Merkkipohja "${tpl.label}" luotiin, mutta linkitys ei onnistunut — yhdistä 🔗 Yhdistä -työkalulla.`)
            }
            await load()
            return
          }
          await createSignRow(tpl.id, locationId)
        },
      })
      modal.open(null) // luontitila
    },
  })
}

/**
 * T25x: "Muuta merkiksi" — picker olemassa oleviin merkkeihin + "Uusi merkki". Toisin kuin
 * openSignFlow (luo UUDEN rivin), tämä LINKITTÄÄ olemassa olevan tekstirivin merkkiin (säilyttää
 * qty/paikka/note, EI uutta riviä). V186: ei kiinnitystapaa — sama tunnus, oletus keppi.
 */
async function openConvertFlow(item: InventoryItem): Promise<void> {
  const result = await fetchTemplates()
  const templates: SignTemplate[] = result.ok ? result.templates : []
  const list = templates.map((t) => ({ id: t.id, label: t.label }))
  const library: SignLibrary = createLibrary()
  for (const t of templates) library.set(t.id, t)

  let backdrop: HTMLElement | null = null
  const close = (): void => {
    backdrop?.remove()
    backdrop = null
  }
  backdrop = renderSignPicker(document.body, list, {
    onPick: (templateId) => void linkItemToTemplate(item, templateId), // olemassa oleva → linkitä rivi
    onClose: close,
    onCreateNew: () => {
      const modal = new SignTemplateModal(library, {
        onChanged: () => { /* linkitys tapahtuu onSaveTemplaten kautta */ },
        onSaveTemplate: async (tpl, isNew) => {
          if (isNew) await createTemplateRemote(tpl)
          else await updateTemplateRemote(tpl)
          await linkItemToTemplate(item, tpl.id) // PUT olemassa olevaan riviin (EI uutta riviä)
        },
      })
      modal.open(null, { label: item.name, favorite: false }) // esitäytetty nimi rivin nimestä
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
