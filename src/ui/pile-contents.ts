// T450: KASAN SISÄLTÖ — YKSI RENDERÖINTIPAIKKA, KOLME PINTAA.
//
// Sisältö näytetään (1) vahvistuksessa ennen kasan syntymistä ("mitä olen jättämässä"),
// (2) kasan modaalissa avattaessa ("mitä olen hakemassa") ja (3) kasarivin yhteenvedossa.
// Jos jokainen renderöisi sen itse, kolmas jäisi päivittämättä kun neljäs pinta tulee — sama
// vika jonka V331 kieltää luokittelulta, siirrettynä sen esitykseen.
//
// Ryhmittely tulee `pile-list.ts`:stä (puhdas) — tämä moduuli vain piirtää.
//
// DOM ilman Leafletia → Vitest-jsdom.

import { buildMarkerVisual } from './marker-visual-row'
import { groupPileContents } from '../logic/pile-list'
import type { SignMarker } from '../logic/types'

/**
 * Ryhmitelty sisältölista + yhteensä-rivi. Tyhjä sisältö → oma rivinsä: tyhjä laatikko
 * luetaan rikkinäiseksi (V21), & tyhjä kasa on laillinen tila (merkit ehdittiin viedä muualle).
 */
export function buildPileContentsList(contents: SignMarker[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pile-contents'

  const groups = groupPileContents(contents)
  if (groups.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'pile-contents-empty'
    empty.textContent = 'Ei merkkejä kasassa.'
    wrap.appendChild(empty)
    return wrap
  }

  const list = document.createElement('ul')
  list.className = 'pile-contents-list'
  for (const g of groups) {
    const li = document.createElement('li')
    li.className = 'pile-contents-row'
    li.dataset.key = g.key
    li.appendChild(buildMarkerVisual(
      {
        type: g.sample.type,
        iconId: g.sample.iconId,
        label: g.sample.label,
        parts: g.sample.parts,
        color: g.sample.color,
      },
      { size: 28, zoomable: false },
    ))
    const label = document.createElement('span')
    label.className = 'pile-contents-label'
    label.textContent = g.label
    const count = document.createElement('span')
    count.className = 'pile-contents-count'
    count.textContent = `×${g.count}`
    li.append(label, count)
    list.appendChild(li)
  }
  wrap.appendChild(list)

  const total = document.createElement('p')
  total.className = 'pile-contents-total'
  total.textContent = `Yhteensä ${contents.length} merkkiä`
  wrap.appendChild(total)

  return wrap
}
