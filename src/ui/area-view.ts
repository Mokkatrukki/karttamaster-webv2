import { marked } from 'marked'
import type { AreaMarker } from '../logic/area-types'

async function fetchAreaByHash(hash: string): Promise<AreaMarker | null> {
  try {
    const res = await fetch(`/api/areas/by-hash/${encodeURIComponent(hash)}`)
    if (!res.ok) return null
    return await res.json() as AreaMarker
  } catch {
    return null
  }
}

export function renderMarkdown(text: string): string {
  const result = marked(text)
  if (typeof result === 'string') return result
  return ''
}

function buildPrintContent(area: AreaMarker): HTMLElement {
  const div = document.createElement('div')
  div.className = 'area-print-content'

  const h1 = document.createElement('h1')
  h1.textContent = area.name
  div.appendChild(h1)

  if (area.markdownDescription) {
    const desc = document.createElement('div')
    desc.className = 'area-markdown-desc'
    desc.innerHTML = renderMarkdown(area.markdownDescription)
    div.appendChild(desc)
  }

  if (area.features.length > 0) {
    const table = document.createElement('table')
    table.className = 'area-features-table'
    table.innerHTML = `<thead><tr><th>Alue</th><th>Väri</th><th>Koko (m)</th></tr></thead>`
    const tbody = document.createElement('tbody')
    for (const f of area.features) {
      const tr = document.createElement('tr')
      const swatch = `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${f.color};vertical-align:middle;margin-right:6px"></span>`
      tr.innerHTML = `<td>${f.name ?? '—'}</td><td>${swatch}${f.color}</td><td>${f.widthM}×${f.heightM}</td>`
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    div.appendChild(table)
  }

  return div
}

function openAreaModal(area: AreaMarker, map: { flyTo: (latlng: [number, number], zoom: number) => void }): HTMLElement {
  const existing = document.querySelector('.area-view-modal')
  existing?.remove()

  map.flyTo([area.centerLat, area.centerLng], 18)

  const modal = document.createElement('div')
  modal.className = 'area-view-modal'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3000;background:var(--surface-card);border:1px solid var(--border-default);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.6);width:min(520px,94vw);max-height:85vh;overflow-y:auto;display:flex;flex-direction:column'

  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:center;padding:16px;border-bottom:1px solid var(--border-default)'

  const title = document.createElement('h2')
  title.textContent = area.name
  title.style.cssText = 'flex:1;margin:0;font-size:16px;color:var(--text-body)'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'btn-area-view-close'
  closeBtn.setAttribute('aria-label', 'Sulje')
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = 'min-width:44px;min-height:44px;background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer'
  closeBtn.addEventListener('click', () => modal.remove())

  header.append(title, closeBtn)

  const body = document.createElement('div')
  body.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:16px'

  const printContent = buildPrintContent(area)
  body.appendChild(printContent)

  const printBtn = document.createElement('button')
  printBtn.className = 'btn-area-print'
  printBtn.textContent = 'Tulosta'
  printBtn.style.cssText = 'align-self:flex-start;padding:10px 20px;background:var(--accent);color:var(--accent-text);border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;min-height:44px'
  printBtn.addEventListener('click', () => window.print())
  body.appendChild(printBtn)

  modal.append(header, body)
  document.body.appendChild(modal)

  return modal
}

export async function initAreaView(map: { flyTo: (latlng: [number, number], zoom: number) => void }): Promise<void> {
  const match = window.location.pathname.match(/^\/a\/([^/]+)$/)
  if (!match) return

  const hash = match[1]
  const area = await fetchAreaByHash(hash)
  if (!area) return

  openAreaModal(area, map)
}
