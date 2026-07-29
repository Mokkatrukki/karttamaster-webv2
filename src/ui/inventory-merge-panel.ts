import type { InventoryItem, InventoryLocation } from '../logic/inventory'
import type { SignTemplate } from '../logic/sign-library'
import { rankTemplates, normalizeName, SUGGESTION_THRESHOLD } from '../logic/template-match'
import { buildMarkerVisual } from './marker-visual-row'
import { showToast } from './toast'

/**
 * T386 — järjestäjän "Yhdistä"-työkalu (V277/V279/V276).
 *
 * OMA näkymä omalla tilallaan: `inventory-page.ts` on jo pilkkorajalla ∴ tätä ⊥ kasvateta sinne.
 *
 * V277: kone ⊥ kirjoita linkitystä. Ehdotukset tulevat `rankTemplates`ista (T384), mutta
 * JOKAINEN rivi kuitataan erikseen — ⊥ esivalintaa, ⊥ "linkitä kaikki varmat" -massanappia.
 *
 * KESTÄÄ KESKEYTYKSEN: jokainen kuittaus persistoituu HETI omalla pyynnöllään, ⊥ "Tallenna
 * kaikki" -nappia ∴ sulkeminen kesken ⊥ hukkaa tehtyä työtä (101 rivin urakka ⊥ mahdu yhteen
 * istuntoon). Epäonnistunut pyyntö → rivi JÄÄ listalle + virheteksti kertoo MIKSI (V21).
 *
 * XSS: kaikki nimet `textContent` (V164).
 */

/** Toiminnon tulos — virhe kerrotaan rivillä, ⊥ hiljaista epäonnistumista (V21). */
export type MergeActionResult = { ok: true } | { ok: false; error: string }

export interface MergePanelView {
  /** KAIKKI inventaariorivit (paneeli suodattaa linkittämättömät itse). */
  items: InventoryItem[]
  templates: Map<string, SignTemplate>
  locations: InventoryLocation[]
}

export interface MergePanelCallbacks {
  /** Linkitä rivi merkkipohjaan (PUT template_id). */
  onLink: (item: InventoryItem, templateId: string) => Promise<MergeActionResult>
  /** "Ei merkki" → PUT not_sign=1. Rivi katoaa listalta pysyvästi (V279). */
  onNotSign: (item: InventoryItem) => Promise<MergeActionResult>
  /** Palauta rivi alkuperäiseen tilaansa (Kumoa-toast, T253/V172). */
  onUndo: (item: InventoryItem) => Promise<MergeActionResult>
  /** Yhdistä kaksi saman paikan riviä (POST /api/inventory/merge, T385). */
  onMerge: (source: InventoryItem, target: InventoryItem) => Promise<MergeActionResult>
  /** "Luo merkkipohja" → SignTemplateModal luontitilassa; luotu template linkittyy heti riviin. */
  onCreateTemplate: (item: InventoryItem) => void
  onClose: () => void
}

/** V276/V279: yhdistämislistalle kuuluvat vain linkittämättömät JA ei-tarvikkeiksi merkityt. */
export function unlinkedItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => !i.templateId && i.notSign !== true)
}

/** Laskuri headerin nappiin — työkalun ARVO: järjestäjä näkee että työtä on jäljellä & milloin se loppui. */
export function unlinkedCount(items: InventoryItem[]): number {
  return unlinkedItems(items).length
}

/** Saman PAIKAN toinen linkittämätön rivi joka normalisoituu samaksi nimeksi (T384) → merge-ehdokas. */
function duplicateOf(item: InventoryItem, rows: InventoryItem[]): InventoryItem | undefined {
  const key = normalizeName(item.name)
  if (!key) return undefined
  return rows.find(
    (o) => o.id !== item.id && (o.locationId ?? null) === (item.locationId ?? null) && normalizeName(o.name) === key,
  )
}

function locationName(item: InventoryItem, locations: InventoryLocation[]): string {
  if (!item.locationId) return 'Ei paikkaa'
  return locations.find((l) => l.id === item.locationId)?.name ?? 'Ei paikkaa'
}

/** Merkkivisuaali ehdotukseen — sama konventio kuin inventaariorivillä (kuva-avain imageId ?? id). */
function templateVisual(tpl: SignTemplate): HTMLElement {
  return buildMarkerVisual(
    { type: tpl.imageId ?? tpl.id, iconId: tpl.iconId, label: tpl.label, parts: tpl.parts, color: tpl.color },
    { size: 32, zoomable: false },
  )
}

/**
 * Renderöi yhdistämispaneelin `host`iin. Palauttaa backdropin (kutsuja poistaa `onClose`ssa).
 * Tila elää paneelissa: kuitattu rivi katoaa listalta heti, laskuri päivittyy — ⊥ koko sivun reloadia
 * jokaisesta rivistä (101 rivin läpikäynti menettäisi vierityskohdan joka kerta).
 */
export function renderMergePanel(host: HTMLElement, view: MergePanelView, cb: MergePanelCallbacks): HTMLElement {
  let rows = unlinkedItems(view.items)
  const errors = new Map<string, string>()
  const busy = new Set<string>()
  const templates = [...view.templates.values()]

  const backdrop = document.createElement('div')
  backdrop.className = 'inv-merge-backdrop'
  backdrop.addEventListener('click', () => cb.onClose())

  const panel = document.createElement('div')
  panel.className = 'inv-merge-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Yhdistä merkkeihin')
  panel.addEventListener('click', (e) => e.stopPropagation())

  const header = document.createElement('div')
  header.className = 'inv-merge-header'
  const title = document.createElement('h2')
  title.className = 'inv-merge-title'
  title.textContent = 'Yhdistä merkkeihin'
  const count = document.createElement('span')
  count.className = 'inv-merge-count'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'inv-btn inv-merge-close'
  closeBtn.textContent = 'Sulje'
  closeBtn.addEventListener('click', () => cb.onClose())
  header.append(title, count, closeBtn)
  panel.appendChild(header)

  const list = document.createElement('div')
  list.className = 'inv-merge-list'
  panel.appendChild(list)

  /** Kuittaus: aja toiminto, poista rivi onnistuessa, jätä rivi + virheteksti epäonnistuessa (V21). */
  const commit = async (
    item: InventoryItem,
    action: () => Promise<MergeActionResult>,
    undoText: string | null,
  ): Promise<void> => {
    if (busy.has(item.id)) return
    busy.add(item.id)
    errors.delete(item.id)
    render()
    const res = await action()
    busy.delete(item.id)
    if (!res.ok) {
      errors.set(item.id, res.error) // rivi JÄÄ listalle — työ ⊥ katoa hiljaa
      render()
      return
    }
    const idx = rows.findIndex((r) => r.id === item.id)
    if (idx >= 0) rows.splice(idx, 1)
    render()
    if (undoText) {
      // V172: yksi undo-slotti, client-only. Kumous = palauta rivi alkuperäiseen tilaansa.
      showToast(undoText, {
        actionLabel: 'Kumoa',
        onAction: () => {
          void (async () => {
            const undo = await cb.onUndo(item)
            if (!undo.ok) {
              errors.set(item.id, undo.error)
            }
            if (idx >= 0) rows.splice(Math.min(idx, rows.length), 0, item)
            else rows.push(item)
            render()
          })()
        },
      })
    }
  }

  function buildRow(item: InventoryItem): HTMLElement {
    const row = document.createElement('div')
    row.className = 'inv-merge-row'
    row.dataset.itemId = item.id

    const head = document.createElement('div')
    head.className = 'inv-merge-row-head'
    const name = document.createElement('span')
    name.className = 'inv-merge-row-name'
    name.textContent = item.name // V164
    const meta = document.createElement('span')
    meta.className = 'inv-merge-row-meta'
    meta.textContent = `${item.qty} kpl · ${locationName(item, view.locations)}` // V164
    head.append(name, meta)
    row.appendChild(head)

    // Top-3 ehdotusta kynnyksen yli. Kynnyksen alle jäävää ⊥ tarjota: heikko arvaus 101 rivin
    // urakassa houkuttelee väärään linkitykseen & väärä liitos on pahempi kuin puuttuva (V276).
    const suggestions = rankTemplates(item.name, templates)
      .filter((r) => r.score >= SUGGESTION_THRESHOLD)
      .slice(0, 3)

    const sugWrap = document.createElement('div')
    sugWrap.className = 'inv-merge-suggestions'
    if (suggestions.length === 0) {
      const none = document.createElement('span')
      none.className = 'inv-merge-nosug'
      none.textContent = 'Ei ehdotuksia'
      sugWrap.appendChild(none)
    } else {
      for (const s of suggestions) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'inv-merge-suggestion'
        btn.dataset.templateId = s.template.id
        btn.disabled = busy.has(item.id)
        btn.appendChild(templateVisual(s.template))
        const lbl = document.createElement('span')
        lbl.className = 'inv-merge-suggestion-label'
        lbl.textContent = s.template.label // V164
        btn.appendChild(lbl)
        btn.setAttribute('aria-label', `Linkitä: ${s.template.label}`)
        btn.addEventListener('click', () => {
          void commit(item, () => cb.onLink(item, s.template.id), `Linkitetty: ${item.name}`)
        })
        sugWrap.appendChild(btn)
      }
    }
    row.appendChild(sugWrap)

    const actions = document.createElement('div')
    actions.className = 'inv-merge-actions'

    const dup = duplicateOf(item, rows)
    if (dup) {
      const mergeBtn = document.createElement('button')
      mergeBtn.type = 'button'
      mergeBtn.className = 'inv-btn inv-merge-dup'
      mergeBtn.disabled = busy.has(item.id)
      mergeBtn.textContent = `Yhdistä riviin ${dup.name} (${item.qty}+${dup.qty})` // V164
      mergeBtn.addEventListener('click', () => {
        void commit(
          item,
          async () => {
            const res = await cb.onMerge(item, dup)
            if (res.ok) dup.qty += item.qty // kohde päivittyy listalla ilman reloadia
            return res
          },
          null, // merge poistaa lähderivin serverillä — kumous vaatisi rivin uudelleenluonnin
        )
      })
      actions.appendChild(mergeBtn)
    }

    const createBtn = document.createElement('button')
    createBtn.type = 'button'
    createBtn.className = 'inv-btn inv-merge-create'
    createBtn.disabled = busy.has(item.id)
    createBtn.textContent = 'Luo merkkipohja'
    createBtn.addEventListener('click', () => cb.onCreateTemplate(item))
    actions.appendChild(createBtn)

    const notSignBtn = document.createElement('button')
    notSignBtn.type = 'button'
    notSignBtn.className = 'inv-btn inv-merge-notsign'
    notSignBtn.disabled = busy.has(item.id)
    notSignBtn.textContent = 'Ei merkki'
    notSignBtn.addEventListener('click', () => {
      void commit(item, () => cb.onNotSign(item), `Merkitty tarvikkeeksi: ${item.name}`)
    })
    actions.appendChild(notSignBtn)

    row.appendChild(actions)

    const err = errors.get(item.id)
    if (err) {
      const errEl = document.createElement('p')
      errEl.className = 'inv-merge-error'
      errEl.setAttribute('role', 'alert')
      errEl.textContent = err // V21: MIKSI epäonnistui
      row.appendChild(errEl)
    }
    return row
  }

  function render(): void {
    count.textContent = `${rows.length} riviä`
    list.innerHTML = ''
    if (rows.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'inv-merge-empty'
      empty.textContent = 'Kaikki rivit yhdistetty ✓'
      list.appendChild(empty)
      return
    }
    for (const item of rows) list.appendChild(buildRow(item))
  }

  render()
  backdrop.appendChild(panel)
  host.appendChild(backdrop)
  return backdrop
}
