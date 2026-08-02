import { buildMarkerVisual } from './marker-visual-row'
import { markerLabel } from './segment-hero'
import type { MarkerStatus } from '../logic/marker-status'
import { countsAsSign } from '../logic/marker-kind'
import {
  revertTarget, revertLabel, segmentTarget,
  isOpenInSegment, isPendingInSegment, isTerminalInSegment,
} from '../logic/phase-target'
import { displayKm, orderMarkersInSegment } from '../logic/segment-order'
import type { Segment } from '../logic/segments'
import type { SignMarker } from '../logic/types'

const STATUS_LABELS: Record<MarkerStatus, string> = {
  suunniteltu: 'Suunniteltu',
  asetettu: 'Asetettu',
  tarkistettu: 'Tarkistettu',
  kerätty: 'Kerätty',
  ei_tarpeen: 'Ei tarpeen',
}

// T263/V183 (talkoolais-KOTI, R3): KOTI-pätkänäkymän INLINE "Kaikki merkit" -lista.
// Brief Näkymä 1: oman pätkän merkit näkyvät koti-landingissa (koti = ei karttaa → tilaa on;
// T228 poisti inline-listan koska se söi KARTAN tilaa — koti-moodissa peruste ei päde).
// Rivi-klikkaus → onOpenDetail (jaettu yläpalkin modaalin MarkerDetailModalin kanssa, EI uusi
// mutaatiopolku). Erotettu SegmentView:stä (562r pilkkohälytys). Kartta-moodissa CSS piilottaa.
export interface SegmentMarkerListContext {
  getMarkers(): SignMarker[]
  // T328/V237: lista järjestää PÄTKÄN km-akselilla ∴ se tarvitsee pätkän, ei pelkkiä merkkejä.
  getSegment(): Segment | null
  onOpenDetail(id: string): void
  // T409/V292 (VISION §Kenttätyö): valikoiva bulk-kuittaus. Talkoolainen menetti sen T264:ssä
  // kun `#btn-list` piilotettiin & `.bulk-action-bar` jäi kuolleeksi koodiksi poistuneeseen
  // `marker-list.ts`:ään. Mutaatio kulkee OLEMASSA OLEVAA `manager.bulkSetStatus`-reittiä
  // (sama kuin järjestäjän paneelilla) ∴ ⊥ uutta mutaatiopolkua. Valinnainen: ilman kytkentää
  // lista on sama luettava lista kuin ennen (checkboxit ⊥ renderöidy lainkaan).
  onBulkStatus?(ids: string[], status: MarkerStatus): void
}

export class SegmentMarkerList {
  // T409: valinta elää re-renderin yli (`update()` kutsuu `render()`n jokaisesta mutaatiosta) —
  // muuten yksi ulkopuolinen päivitys pyyhkisi talkoolaisen kesken tekemän valinnan.
  private readonly selected = new Set<string>()

  constructor(
    private readonly el: HTMLElement,
    private readonly ctx: SegmentMarkerListContext,
  ) {}

  render(): void {
    // T328/V237/V312: järjestys pätkän km-akselilta (sama suunta ∀ phasella, T420), EI merkin
    // skalaarista joka voi olla mitattu toiselta reitiltä (B129). "Ei reitillä" -merkit
    // (segmentKm null) omaan ryhmäänsä listan alkuun — ne eivät katoa eivätkä sekoita järjestystä.
    const segment = this.ctx.getSegment()
    // T447/V331: "Kaikki merkit (N)" tarkoittaa kylttejä. Kasa on autoporukan kohde & sillä on
    // oma näkymänsä (`/kasat`, T448) ∴ täällä se olisi rivi jolle talkoolaisella ⊥ ole tekemistä
    // — & se kasvatti otsikon lukua eri tahtiin kuin hero (kaksi lukua, joista toinen valehtelee).
    const { onRoute, offRoute } = orderMarkersInSegment(this.ctx.getMarkers().filter(countsAsSign), segment)
    const markers = [...onRoute, ...offRoute]
    this.el.innerHTML = ''

    // T409: valinta ⊥ saa jäädä osoittamaan riviin jota ⊥ enää ole (merkki poistui pätkältä)
    // tai joka ehti terminaaliin (kerätty) — muuten "Aseta valituille (3)" mutatoisi merkkejä
    // joita käyttäjä ⊥ näe. Karsinta joka renderissä pitää laskurin & mutaation samassa joukossa.
    const selectableIds = new Set(markers.filter(m => this.isSelectable(m)).map(m => m.id))
    for (const id of this.selected) if (!selectableIds.has(id)) this.selected.delete(id)

    const header = document.createElement('div')
    header.className = 'segment-view-markers-header'
    header.textContent = `Kaikki merkit (${markers.length})`
    this.el.appendChild(header)

    if (markers.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'segment-view-markers-empty'
      empty.textContent = 'Ei merkkejä tällä pätkällä.'
      this.el.appendChild(empty)
      return
    }

    // V238: "ei reitillä" ENSIN — merkki joka ei osu pätkän km-välille ei katoa hiljaa eikä
    // saa väärää paikkaa järjestyksessä (hiljainen katoaminen olisi B127:n uusi versio).
    this.renderGroup('Ei reitillä', offRoute, segment)

    // T264/V184 → T468/V355: ryhmittely tulee VAIHETAVOITTEESTA ⊥ statusvakioista. Ennen tätä
    // jako oli kovakoodattu asetusvaiheeseen (`asetettu·tarkistettu·kerätty` = "Asetetut") ∴
    // purussa purkamattomat & puretut olivat SAMASSA ryhmässä (B202): purkumaster ⊥ nähnyt
    // listasta omaa työjonoaan. Tyhjät ryhmät jätetään pois. Ryhmien sisäinen järjestys periytyy
    // `onRoute`sta = kulkusuunta (V237/V238).
    //
    // Järjestys on merkitys: AVOIN ensin (se on työ) → VÄLITILA (se on epäselvyys jota ⊥ saa
    // haudata listan pohjalle, V326/B175) → TEHDYT → sekundääri.
    const target = segmentTarget(segment)
    const open = onRoute.filter(m => isOpenInSegment(m.status, segment))
    const done = onRoute.filter(m => target.doneStatuses.includes(m.status))
    const secondary = onRoute.filter(m => m.status === target.secondaryStatus)
    const pending = onRoute.filter(m => isPendingInSegment(m.status, segment) && m.status !== target.secondaryStatus)

    this.renderGroup(target.openGroupLabel, open, segment)
    // UX-audit T468(f): välitila on ainoa ryhmä joka vaatii toimenpiteen ∴ se saa varoituskanavan
    // (`--warn-highlight`) — neljä samannäköistä otsikkoa hukuttaisi sen.
    this.renderGroup(target.pendingGroupLabel, pending, segment, 'segment-view-markers-group--pending')
    this.renderGroup(target.doneGroupLabel, done, segment)
    this.renderGroup(target.secondaryGroupLabel, secondary, segment)

    // T409: bar vain jos valittavaa on — muuten se olisi pysyvästi disabloitu pinta joka vie
    // 44px pystytilaa puhelimessa ilman että sillä on koskaan tekemistä.
    if (this.ctx.onBulkStatus && selectableIds.size > 0) this.renderActionBar(selectableIds)
  }

  // T409 → T468/V355: päätetila ⊥ saa checkboxia — valittavissa oleva rivi jota bulk ⊥ voi
  // muuttaa on lupaus jota UI ⊥ pidä. Päätetila luetaan TEHTÄVÄSTÄ (`isTerminalInSegment`, V326)
  // ⊥ globaalista `isTerminal`ista: se on siirtymätaulun tyhjyys, ⊥ tehtävän valmius ∴ purussa
  // se piti `ei_tarpeen`-riviä yhä valittavana vaikka `revertTarget` (sama rivi, sama lista) piti
  // sitä jo purettuna.
  private isSelectable(m: SignMarker): boolean {
    return this.ctx.onBulkStatus !== undefined && !isTerminalInSegment(m.status, this.ctx.getSegment())
  }

  private renderActionBar(selectableIds: Set<string>): void {
    const bar = document.createElement('div')
    bar.className = 'bulk-action-bar'

    // DESIGN §K: `label { width:100% }` pakottaa "Valitse kaikki" omalle riville ∴ napit
    // saavat 340px-leveydellä oman rivinsä (flex-wrap) eivätkä leikkaudu (B108-oppi).
    const allLabel = document.createElement('label')
    const all = document.createElement('input')
    all.type = 'checkbox'
    all.className = 'bulk-select-all'
    all.checked = this.selected.size === selectableIds.size
    all.addEventListener('change', () => {
      if (all.checked) for (const id of selectableIds) this.selected.add(id)
      else this.selected.clear()
      this.render()
    })
    allLabel.append(all, document.createTextNode(' Valitse kaikki'))
    bar.appendChild(allLabel)

    // T468/V355: sana & KOHDESTATUS taulusta. Kovakoodattu `'asetettu'` teki purkumasterin
    // joukkokuittauksesta väärän siirtymän: nappi lupasi purun & vei merkin takaisin
    // asetusvaiheen tilaan (B202). Luokkanimet pysyvät (CSS + E2E-valitsimet) — ne nimeävät
    // paikan (ensisijainen/sekundäärinen), ⊥ vaiheen tekoa.
    const n = this.selected.size
    const target = segmentTarget(this.ctx.getSegment())
    bar.appendChild(this.bulkButton('btn-bulk-checkin-aseta', `${target.bulkLabel} (${n})`, target.targetStatus, n))
    bar.appendChild(this.bulkButton('btn-bulk-checkin-ohita', `${target.secondaryLabel} (${n})`, target.secondaryStatus, n))

    this.el.appendChild(bar)
  }

  private bulkButton(cls: string, text: string, status: MarkerStatus, n: number): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = cls
    btn.textContent = text
    // 0 valittua → disabloitu (DESIGN §K `field-tint`). Klikki ilman valintaa olisi hiljainen
    // no-op — hanskat kädessä se lukeutuu rikkinäiseksi napiksi.
    btn.disabled = n === 0
    btn.addEventListener('click', () => {
      if (this.selected.size === 0) return
      this.ctx.onBulkStatus?.([...this.selected], status)
      this.selected.clear()
      this.render()
    })
    return btn
  }

  private renderGroup(title: string, markers: SignMarker[], segment: Segment | null, modifier?: string): void {
    if (markers.length === 0) return

    const groupTitle = document.createElement('p')
    groupTitle.className = modifier ? `segment-view-markers-group ${modifier}` : 'segment-view-markers-group'
    groupTitle.textContent = `${title} (${markers.length})`
    this.el.appendChild(groupTitle)

    const list = document.createElement('ul')
    list.className = 'segment-view-markers-list'
    for (const m of markers) {
      const li = document.createElement('li')
      li.className = 'segment-view-markers-item'
      li.dataset.id = m.id

      // T409: checkbox ENNEN riviä. Oma elementti ⊥ rivin sisällä — rivi on `<button>` &
      // sisäkkäinen interaktiivinen kontrolli ⊥ ole validia HTML:ää (klikki menisi väärään).
      if (this.isSelectable(m)) {
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.className = 'marker-item-checkbox'
        cb.checked = this.selected.has(m.id)
        cb.setAttribute('aria-label', `Valitse ${markerLabel(m)}`)
        cb.addEventListener('change', () => {
          if (cb.checked) this.selected.add(m.id)
          else this.selected.delete(m.id)
          this.render()
        })
        li.appendChild(cb)
      } else if (this.ctx.onBulkStatus) {
        // Valintatilassa checkboxiton rivi tasataan muiden kanssa — muuten terminaali merkki
        // hyppää 44px vasemmalle & lista näyttää rikkinäiseltä, ⊥ "tämä on valmis".
        li.classList.add('segment-view-markers-item--nocheck')
      }

      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'segment-view-markers-row'
      row.addEventListener('click', () => this.ctx.onOpenDetail(m.id))

      row.appendChild(buildMarkerVisual(
        // T442/V328: status + vaihe → päätetilan koriste (vinoviiva / katkoviiva+? / himmennys).
        { type: m.type, iconId: m.iconId, label: m.label, parts: m.parts, color: m.color,
          status: m.status, phase: segment?.phase },
        { size: 36, zoomable: false },
      ))

      const info = document.createElement('span')
      info.className = 'segment-view-markers-info'
      const name = document.createElement('span')
      name.className = 'segment-view-markers-name'
      name.textContent = markerLabel(m)
      info.appendChild(name)
      const meta = document.createElement('span')
      meta.className = 'segment-view-markers-meta'
      // T328/V237: km pätkän akselilta — sama luku kuin hero näyttää samasta merkistä (B129).
      meta.textContent = `${STATUS_LABELS[m.status] ?? m.status} · ${(displayKm(m, segment) / 1000).toFixed(1)} km`
      info.appendChild(meta)
      row.appendChild(info)

      li.appendChild(row)

      // T437/V323(b): peruutus näkyy siellä missä merkki on JO päätetilassa — modaali EI ole ainoa
      // sellainen paikka, lista on. Ilman tätä talkoolaisen piti avata modaali korjatakseen
      // napautuksen jonka hän teki listasta ∴ paluu oli kaksi askelta pidempi kuin virhe.
      // Sama lookup (`revertTarget`) & sama mutaatiopolku (`bulkSetStatus`) kuin modaalilla —
      // ⊥ toista koneistoa (T437(d)). Kytkemättä (`onBulkStatus` puuttuu) lista on yhä lukulista.
      const revertTo = this.ctx.onBulkStatus ? revertTarget(m.status, segment) : null
      if (revertTo) {
        const label = revertLabel(segment)
        const revertBtn = document.createElement('button')
        revertBtn.type = 'button'
        revertBtn.className = 'segment-view-markers-revert'
        revertBtn.textContent = label
        revertBtn.setAttribute('aria-label', `${label}: ${markerLabel(m)}`)
        revertBtn.addEventListener('click', () => {
          this.ctx.onBulkStatus?.([m.id], revertTo)
          this.render()
        })
        li.appendChild(revertBtn)
      }

      list.appendChild(li)
    }
    this.el.appendChild(list)
  }
}
