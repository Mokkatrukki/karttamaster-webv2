import { marked } from 'marked'
import { getSegmentStatusCounts, formatStatusCounts } from '../logic/segments'
import type { Segment } from '../logic/segments'
import type { SignMarker } from '../logic/types'

// T271/V190: FAQ-markdown renderöidään sanitoituna — admin-syöte ei saa injektoida skriptiä.
// <template> parsii aktivoimatta scripteja; poistetaan vaaralliset elementit + on*-attribuutit + javascript:-URLit.
export function sanitizeHtml(html: string): string {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  tpl.content.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(el => el.remove())
  tpl.content.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) el.removeAttribute(attr.name)
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name)
    }
  })
  return tpl.innerHTML
}

export interface PatkatPageOpts {
  faqMarkdown: string
  segments: Segment[]
  markers: SignMarker[]
  role: string
  onKartalle?: () => void
}

const PHASE_LABEL: Record<Segment['phase'], string> = {
  asettaminen: 'Asetus',
  tarkastus: 'Tarkastus',
  purku: 'Purku',
}

export function renderPatkatPage(container: HTMLElement, opts: PatkatPageOpts): void {
  const { faqMarkdown, segments, markers, role, onKartalle } = opts
  container.innerHTML = ''
  container.classList.add('patkat-page')

  // ── Hero ──
  const hero = document.createElement('header')
  hero.className = 'patkat-hero'
  const h1 = document.createElement('h1')
  h1.textContent = 'Tervetuloa talkoilemaan!'
  const lead = document.createElement('p')
  lead.className = 'patkat-lead'
  lead.textContent = 'Valitse oma pätkäsi alta ja siirry kartalle. Katso FAQ:sta aikataulut ja ruokailut.'
  hero.append(h1, lead)
  container.appendChild(hero)

  // ── FAQ (sanitoitu) ──
  if (faqMarkdown.trim()) {
    const faq = document.createElement('section')
    faq.className = 'patkat-faq'
    const faqTitle = document.createElement('h2')
    faqTitle.textContent = 'Usein kysyttyä'
    const faqBody = document.createElement('div')
    faqBody.className = 'patkat-faq-body'
    faqBody.innerHTML = sanitizeHtml(marked.parse(faqMarkdown) as string)
    faq.append(faqTitle, faqBody)
    container.appendChild(faq)
  }

  // ── Pätkälista ──
  const listSection = document.createElement('section')
  listSection.className = 'patkat-list-section'
  const listTitle = document.createElement('h2')
  listTitle.textContent = 'Pätkät'
  listSection.appendChild(listTitle)

  if (segments.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'patkat-empty'
    empty.textContent = 'Ei pätkiä vielä.'
    listSection.appendChild(empty)
  } else {
    const list = document.createElement('ul')
    list.className = 'patkat-list'
    for (const seg of segments) {
      list.appendChild(buildSegmentRow(seg, markers, role))
    }
    listSection.appendChild(list)
  }
  container.appendChild(listSection)

  // ── Kartalle ──
  const nav = document.createElement('div')
  nav.className = 'patkat-nav'
  const toMap = document.createElement('button')
  toMap.className = 'patkat-to-map btn btn-primary'
  toMap.textContent = 'Kartalle →'
  toMap.addEventListener('click', () => {
    if (onKartalle) onKartalle()
    else window.location.href = '/'
  })
  nav.appendChild(toMap)
  container.appendChild(nav)
}

function buildSegmentRow(seg: Segment, markers: SignMarker[], role: string): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'patkat-row'

  const info = document.createElement('div')
  info.className = 'patkat-row-info'

  const name = document.createElement('span')
  name.className = 'patkat-row-name'
  name.textContent = seg.displayName?.trim() || 'Nimetön pätkä'

  const meta = document.createElement('span')
  meta.className = 'patkat-row-meta'
  const counts = getSegmentStatusCounts(seg, markers)
  const statusText = formatStatusCounts(counts)
  meta.textContent = `${PHASE_LABEL[seg.phase]}${statusText ? ' · ' + statusText : ''}`

  info.append(name, meta)
  li.appendChild(info)

  const actions = document.createElement('div')
  actions.className = 'patkat-row-actions'
  if (seg.assignedCode) {
    const url = `/s/${seg.assignedCode}`
    const open = document.createElement('a')
    open.className = 'patkat-row-open btn'
    open.href = url
    open.textContent = 'Avaa →'
    actions.appendChild(open)
    li.dataset.slug = seg.assignedCode
    // T275: järjestäjä näkee kaikki linkit + Kopioi yhdessä näkymässä (korjaa "jokaiselle
    // reitille hankala mennä" — ei tarvitse avata jokaista SegmentDetailsModalia erikseen).
    if (role !== 'talkoolainen') {
      const copyBtn = document.createElement('button')
      copyBtn.className = 'patkat-row-copy'
      copyBtn.textContent = '📋 Kopioi linkki'
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(`${window.location.origin}${url}`).catch(() => {})
      })
      actions.appendChild(copyBtn)
    }
  } else {
    const nolink = document.createElement('span')
    nolink.className = 'patkat-row-nolink'
    nolink.textContent = role === 'talkoolainen' ? 'Ei vielä jaettu' : 'Ei jaettu'
    actions.appendChild(nolink)
  }
  li.appendChild(actions)
  return li
}
