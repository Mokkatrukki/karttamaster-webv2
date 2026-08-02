import { marked } from 'marked'
import { getSegmentStatusCounts, formatStatusCounts, segmentPath } from '../logic/segments'
// T445: pätkän näyttönimi yhdestä paikasta — vaihe-etuliite ⊥ saa jäädä puolelle listasta.
import { segmentDisplayName } from '../logic/segment-name'
import { PHASE_LABELS } from '../logic/phase-labels'
import { PhaseSwitcher } from './phase-switcher'
import type { Role } from '../logic/role'
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
  // T427/V318: tapahtuman aktiivinen vaihe. Otsikko & tyhjä tila kertovat MIKÄ on menossa —
  // ilman sitä talkoolainen näkee tyhjän listan eikä tiedä onko vika hänessä vai järjestelmässä.
  // T470/V357: sama arvo kertoo nyt MIKSI lista on rajattu — myös järjestäjälle (hänelle se on
  // katseluvaihe, `getViewPhase`). `segments` on jo suodatettu tähän vaiheeseen; tämä on selite.
  activePhase?: Segment['phase']
  // T470/V357: järjestäjän vaiheenvaihtaja hubiin. Ilman sitä suodin veisi T275:n kyvyn koota
  // ∀ pätkän jakolinkit yhteen näkymään — toisen vaiheen linkit katoaisivat tavoittamattomiin.
  // Talkoolaiselle ⊥ anneta (V318: vaihe on hänelle tapahtuman tosiasia ⊥ valinta).
  audience?: Role
  // T470/V332: KASAKORTTI ELÄÄ GLOBAALISTA VAIHEESTA, ⊥ katselusta. Kun `activePhase` alkoi
  // tarkoittaa järjestäjälle katseluvaihetta, kortti olisi ilmestynyt pelkästä purun
  // KATSOMISESTA kesken asetusvaiheen — kasat ovat tapahtuman tosiasia ⊥ näkymävalinta.
  // Oletus = `activePhase` ∴ talkoolaisella (jolla ⊥ ole katselua) ⊥ muutu mikään.
  globalPhase?: Segment['phase']
  onPhaseChange?: () => void
  onKartalle?: () => void
}

// T470: vaiheen nimi yhdestä lookupista (`logic/phase-labels`) — paikallinen kopio olisi
// neljäs sanasto samalle kolmelle sanalle.
const PHASE_LABEL = PHASE_LABELS

export function renderPatkatPage(container: HTMLElement, opts: PatkatPageOpts): void {
  const { faqMarkdown, segments, markers, role, activePhase, audience, onPhaseChange, onKartalle } = opts
  const globalPhase = opts.globalPhase ?? activePhase
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

  // ── Vaiheenvaihtaja (T470/V357) ──
  // Sama komponentti kuin kartan sivupalkissa ∴ ⊥ toista valitsinta ylläpidettäväksi & sama
  // "Katselet: X · käynnissä: Y — palaa" -pilleri (V321:n ainoa aisti) seuraa mukana. Kirjoittaa
  // VAIN `localStorage`n katseluvaiheen — ⊥ verkkokutsua, ⊥ vaikutusta kehenkään muuhun.
  if (audience === 'järjestäjä' && onPhaseChange) {
    const switcherHost = document.createElement('div')
    switcherHost.className = 'patkat-phase-switcher'
    container.appendChild(switcherHost)
    new PhaseSwitcher(switcherHost, () => onPhaseChange())
  }

  // ── Kasat (T448/V332, §C) ──
  // Kortti on olemassa VAIN purkuvaiheessa: kasapinta elää globaalin vaiheen mukana, ⊥
  // katseluvaiheen (V321-jako) — kasat ovat tapahtuman tosiasia ⊥ järjestäjän näkymävalinta.
  // Muissa vaiheissa kortti ⊥ ole olemassa (⊥ disabloituna: kuollut pinta lupaa jotain, V250).
  // Tämä on autoporukan ainoa aloituspiste ∴ se on hubissa ENNEN pätkälistaa: hän ⊥ avaa
  // pätkänäkymää lainkaan & pätkälistan alta löytyvä linkki olisi sama umpisolmu uudessa asussa.
  if (globalPhase === 'purku') {
    const card = document.createElement('a')
    card.className = 'patkat-kasat-card'
    card.href = '/kasat'
    const cardTitle = document.createElement('span')
    cardTitle.className = 'patkat-kasat-title'
    cardTitle.textContent = '📦 Kasat — autoporukalle'
    const cardLead = document.createElement('span')
    cardLead.className = 'patkat-kasat-lead'
    cardLead.textContent = 'Maastoon jätetyt merkkikasat kartalla, lähin ensin.'
    card.append(cardTitle, cardLead)
    container.appendChild(card)
  }

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
  // T427/V318 → T470/V357: vaihe otsikkoon ∀ roolille — jos lista rajaa, otsikko ! kertoa millä
  // perusteella. Järjestäjälle se on hänen katseluvaiheensa (valitsin yllä), talkoolaiselle
  // tapahtuman tosiasia. Pelkkä "Pätkät" rajatun listan yllä on lupaus jota lista ⊥ pidä.
  listTitle.textContent = activePhase
    ? `Pätkät · ${PHASE_LABEL[activePhase]}`
    : 'Pätkät'
  listSection.appendChild(listTitle)

  if (segments.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'patkat-empty'
    // V21-linja: tyhjä ruutu luetaan rikkinäiseksi ∴ kerro MIKSI se on tyhjä.
    empty.textContent = activePhase
      ? (role === 'talkoolainen'
          ? `${PHASE_LABEL[activePhase]}-vaiheessa ei ole vielä pätkiä sinulle.`
          : `${PHASE_LABEL[activePhase]}-vaiheessa ei ole pätkiä. Vaihda vaihetta yltä nähdäksesi muut.`)
      : 'Ei pätkiä vielä.'
    listSection.appendChild(empty)
  } else {
    const list = document.createElement('ul')
    list.className = 'patkat-list'
    for (const seg of segments) {
      list.appendChild(buildSegmentRow(seg, markers, role, segments))
    }
    listSection.appendChild(list)
  }
  container.appendChild(listSection)

  // ── Kartalle (T311/V223: sticky-toimintopalkki alalaidassa) ──
  // Primary-toiminto on aina viewportissa ⊥ vaadi skrollausta pätkälistan ohi. Palkki on OMA
  // elementti (.patkat-actionbar) ja sisältö saa vastaavan padding-bottomin (.patkat-page-body)
  // ettei viimeinen pätkärivi jää palkin alle (V157/B101-oppi: kiinnitetty palkki ⊥ jätä orpoa
  // gappia eikä peitä sisältöä → padding elää palkin mukana, ei sivun pohjassa vakiona).
  const nav = document.createElement('div')
  nav.className = 'patkat-actionbar'
  const toMap = document.createElement('button')
  toMap.className = 'patkat-to-map btn btn-primary'
  toMap.textContent = 'Kartalle →'
  toMap.addEventListener('click', () => {
    if (onKartalle) onKartalle()
    else window.location.href = '/'
  })
  nav.appendChild(toMap)
  container.appendChild(nav)
  container.classList.add('patkat-page--has-actionbar')
}

function buildSegmentRow(seg: Segment, markers: SignMarker[], role: string, allSegments: Segment[] = []): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'patkat-row'

  const info = document.createElement('div')
  info.className = 'patkat-row-info'

  const name = document.createElement('span')
  name.className = 'patkat-row-name'
  name.textContent = segmentDisplayName(seg)

  const meta = document.createElement('span')
  meta.className = 'patkat-row-meta'
  // V259: hubin lukema ! vastata pätkänäkymän lukemaa ∴ kilpailijat samasta vaiheesta.
  const counts = getSegmentStatusCounts(seg, markers, allSegments.filter(s => s.phase === seg.phase))
  const statusText = formatStatusCounts(counts)
  meta.textContent = `${PHASE_LABEL[seg.phase]}${statusText ? ' · ' + statusText : ''}`

  info.append(name, meta)
  li.appendChild(info)

  const actions = document.createElement('div')
  actions.className = 'patkat-row-actions'
  // T298/V209/B113: "Avaa" ∀ pätkälle — slug syntyy luonnissa (T297), ei vaadi assignia.
  const url = segmentPath(seg)
  if (url) {
    const open = document.createElement('a')
    open.className = 'patkat-row-open btn'
    open.href = url
    open.textContent = 'Avaa →'
    actions.appendChild(open)
    li.dataset.slug = seg.slug ?? seg.assignedCode ?? ''
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
    // Ei slugia eikä koodia — ei pitäisi tapahtua T297:n jälkeen (backfill), mutta ei kaadeta UI:ta.
    const nolink = document.createElement('span')
    nolink.className = 'patkat-row-nolink'
    nolink.textContent = 'Ei linkkiä'
    actions.appendChild(nolink)
  }
  li.appendChild(actions)
  return li
}
