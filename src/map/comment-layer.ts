import L from 'leaflet'
import type { Comment } from '../logic/comments'
import { renderIconSvg } from '../logic/icon-set'

// T221/T75: vapaa-piste-kommenttien (targetType='point') renderöinti kartalla ikonina.
// Ohut Leaflet-glue (src/map-kerros) — data tulee logic/comments-slicestä. Kommentti-ikoni =
// puhekupla + valinnainen sisäikoni (renderIconSvg). Klikkaus → onClick(comment) (esim. avaa
// kommenttinäkymä / poisto järjestäjälle). Diff-pohjainen render: säilyttää olemassa olevat
// markerit id:n perusteella, lisää uudet, poistaa kadonneet (ei koko layerin uudelleenluontia).
export class CommentLayer {
  private readonly markers = new Map<string, L.Marker>()
  private focusActive = false

  constructor(
    private readonly map: L.Map,
    private readonly onClick?: (comment: Comment) => void,
  ) {}

  // T237(d)/V243: fokus-tilassa huomio HIMMENEE, ⊥ katoa. Huomiolla ⊥ ole pätkäjäsenyyttä
  // (V245: jäsenyyden laskeminen tekisi siitä merkin) ∴ fokus on binäärinen: kun jokin pätkä
  // on korostettu, ∀ huomio on kontekstia. Sama kaksikanavainen himmennys kuin merkeillä
  // (.marker-dimmed) — pelkkä alfa katoaa ilmakuvasta auringossa.
  setFocusActive(active: boolean): void {
    if (this.focusActive === active) return
    this.focusActive = active
    for (const marker of this.markers.values()) this.applyFocusClass(marker)
  }

  private applyFocusClass(marker: L.Marker): void {
    const el = marker.getElement()
    if (el) el.classList.toggle('comment-pin-dimmed', this.focusActive)
  }

  // Renderöi vapaa-piste-kommentit. Ei-'point' (marker/segment) sivuutetaan — ne näkyvät
  // kohteensa modaalissa, ei kartalla vapaana pisteenä.
  render(comments: Comment[]): void {
    const points = comments.filter(
      c => c.targetType === 'point' && typeof c.lat === 'number' && typeof c.lon === 'number',
    )
    const seen = new Set<string>()

    for (const c of points) {
      seen.add(c.id)
      const existing = this.markers.get(c.id)
      if (existing) {
        existing.setLatLng([c.lat!, c.lon!])
        continue
      }
      const marker = L.marker([c.lat!, c.lon!], {
        icon: this.buildIcon(c),
        interactive: true,
        keyboard: false,
      })
      if (this.onClick) marker.on('click', () => this.onClick!(c))
      marker.addTo(this.map)
      this.markers.set(c.id, marker)
      // Uusi pinni syntyy fokuksen ollessa päällä → himmennys heti, ei vasta seuraavasta
      // fokusvaihdosta (sama uudelleensovellus-kuvio kuin MarkerManager.applyFocusClass).
      this.applyFocusClass(marker)
    }

    // Poista kadonneet (esim. järjestäjän poisto).
    for (const [id, marker] of this.markers) {
      if (!seen.has(id)) {
        marker.remove()
        this.markers.delete(id)
      }
    }
  }

  clear(): void {
    for (const marker of this.markers.values()) marker.remove()
    this.markers.clear()
  }

  private buildIcon(c: Comment): L.DivIcon {
    const inner = c.iconId ? renderIconSvg(c.iconId, 18) : SPEECH_SVG
    // T341/V248: kuitattu työ HIMMENEE, ⊥ katoa — kartta ⊥ saa valehdella siitä mitä alueella
    // on tehty (sama sääntö kuin merkkien fokus-himmennyksessä, V243).
    const done = Boolean(c.resolvedAt)
    const dim = done ? 'opacity:.45;filter:grayscale(1);' : ''
    // Puhekupla: pyöreä accent-taustainen "nappi", jossa valittu ikoni tai oletus-kuplakuva.
    const html = `
      <div style="position:relative;width:32px;height:38px;pointer-events:auto;${dim}">
        <div style="position:absolute;top:0;left:0;width:32px;height:32px;box-sizing:border-box;
          background:#F2542D;border:2px solid #fff;border-radius:50% 50% 50% 4px;
          display:flex;align-items:center;justify-content:center;color:#fff;
          box-shadow:0 1px 3px rgba(0,0,0,0.35)">${inner}</div>
      </div>`
    return L.divIcon({
      html,
      className: 'comment-point-icon',
      iconSize: [32, 38],
      iconAnchor: [4, 38],
    })
  }
}

// Oletus-puhekupla (kun kommentilla ei ole valittua ikonia). currentColor → periytyy #fff.
const SPEECH_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
