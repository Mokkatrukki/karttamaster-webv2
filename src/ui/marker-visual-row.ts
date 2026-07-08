import { signVisual, signVisualParts, compactLabel } from '../logic/sign-visual'
import { signImageSrc } from '../logic/sign-images'
import { getIconById } from '../logic/icon-set'
import { SIGN_TYPES } from '../logic/sign-picker'
import type { SignPart } from '../logic/sign-library'
import { registerEscClose, createBackdrop } from './modal-helpers'

// T198: jaettu render-helper merkin visuaalille — kuva>ikoni>label-precedence (V99),
// yhdistelmämerkki pystypino max 4 osaa (V107). Erillinen segment-details-modal.ts:stä
// (jo ⚠️ pilkko COMPONENTS.md:ssä) ja uudelleenkäytettävä myöhemmin talkoolaisen SegmentView:ssä.
export type MarkerVisualInput = Pick<SignMarkerLike, 'type' | 'iconId' | 'label' | 'parts' | 'color'>

interface SignMarkerLike {
  type: string
  iconId?: string
  label?: string
  parts?: SignPart[]
  color?: string
}

// Sama väri-precedence kuin src/map/icons.ts circleSvg/comboMarkerSvg: custom template-väri
// voittaa, muuten oletustyypin väri (SIGN_TYPES), muuten neutraali. Ei kiinteää accent-väriä —
// listan värien pitää täsmätä kartan väreihin (V87), muuten tunnistettavuus katoaa.
function resolveColor(marker: MarkerVisualInput): string {
  if (marker.color) return marker.color
  return SIGN_TYPES.find(t => t.type === marker.type)?.color ?? '#94a3b8'
}

export interface MarkerVisualOptions {
  size: number
  zoomable: boolean
}

function iconSvg(iconId: string, size: number, stroke: string): string {
  const entry = getIconById(iconId)
  if (!entry) return ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${entry.svgContent}</svg>`
}

function singleVisualInner(marker: MarkerVisualInput, glyphSize: number): string {
  const v = signVisual({ iconId: marker.iconId, label: marker.label ?? '' }, signImageSrc(marker.type))
  if (v.kind === 'image') {
    return `<img src="${v.src}" alt="" onerror="this.remove()" style="width:100%;height:100%;object-fit:contain;pointer-events:none">`
  }
  if (v.kind === 'icon') {
    return iconSvg(v.id, glyphSize, '#fff')
  }
  return `<span style="font:900 ${Math.round(glyphSize * 0.55)}px sans-serif;color:#fff">${v.text}</span>`
}

// Palauttaa ['image'|'icon'|'label', backgroundStyle] jotta kutsuja voi kääriä oikean taustan.
function singleVisualKind(marker: MarkerVisualInput): 'image' | 'icon' | 'label' {
  const v = signVisual({ iconId: marker.iconId, label: marker.label ?? '' }, signImageSrc(marker.type))
  return v.kind
}

/**
 * buildMarkerVisual — pieni merkkivisuaali listariveihin (segment-details-modal, tuleva SegmentView).
 * Tuplamerkki (parts.length>1): pystypino, max 4 lohkoa, ei kulmabadgea.
 * zoomable=true lisää 44x44 zoom-hit-arean joka avaa lightboxin (ei valitse mitään, esikatselu).
 */
export function buildMarkerVisual(marker: MarkerVisualInput, opts: MarkerVisualOptions): HTMLElement {
  const wrap = document.createElement('span')
  wrap.className = 'marker-visual-row-sv'
  wrap.style.cssText = `position:relative;display:inline-flex;flex-shrink:0;width:${opts.size}px;height:${opts.size}px`

  const resolved = marker.parts && marker.parts.length > 0
    ? signVisualParts({ iconId: marker.iconId, label: marker.label ?? '', parts: marker.parts }, signImageSrc)
    : null
  const color = resolveColor(marker)

  if (resolved) {
    const stack = document.createElement('div')
    stack.className = 'marker-visual-row-combo'
    stack.style.cssText = `width:100%;height:100%;border-radius:var(--radius-sm);overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--border-default)`
    const slotH = opts.size / resolved.length
    resolved.forEach((p, i) => {
      const slot = document.createElement('div')
      slot.className = 'marker-visual-row-combo-slot'
      const border = i > 0 ? 'border-top:1px solid rgba(255,255,255,0.25)' : ''
      if (p.kind === 'image') {
        slot.style.cssText = `height:${slotH}px;${border};display:flex;align-items:center;justify-content:center;background:#fff`
        slot.innerHTML = `<img src="${p.src}" alt="" onerror="this.remove()" style="width:100%;height:100%;object-fit:contain;pointer-events:none">`
      } else if (p.kind === 'icon') {
        slot.style.cssText = `height:${slotH}px;${border};display:flex;align-items:center;justify-content:center;background:${color}`
        slot.innerHTML = iconSvg(p.id, Math.round(slotH * 0.55), '#fff')
      } else {
        slot.style.cssText = `height:${slotH}px;${border};display:flex;align-items:center;justify-content:center;background:${color}`
        slot.innerHTML = `<span style="font:900 ${Math.round(slotH * 0.5)}px sans-serif;color:#fff">${p.text}</span>`
      }
      stack.appendChild(slot)
    })
    wrap.appendChild(stack)
  } else {
    const kind = singleVisualKind(marker)
    const box = document.createElement('div')
    box.className = 'marker-visual-row-single'
    if (kind === 'image') {
      box.style.cssText = `width:100%;height:100%;border-radius:8px;background:#fff;border:1px solid var(--border-default);display:flex;align-items:center;justify-content:center;overflow:hidden`
    } else {
      box.style.cssText = `width:100%;height:100%;border-radius:999px;background:${color};display:flex;align-items:center;justify-content:center;overflow:hidden`
    }
    box.innerHTML = singleVisualInner(marker, Math.round(opts.size * 0.6))
    wrap.appendChild(box)
  }

  if (opts.zoomable) {
    const zoomBtn = document.createElement('button')
    zoomBtn.type = 'button'
    zoomBtn.className = 'marker-visual-row-zoom'
    zoomBtn.setAttribute('aria-label', `Suurenna ${marker.label ?? 'merkki'}`)
    // V129: klikattava hit-area AINA 44x44 (§A), näkyvä badge pysyy pienenä sisällä — sama pattern kuin sign-image-zoom-btn.
    zoomBtn.style.cssText = 'position:absolute;right:-10px;bottom:-10px;width:44px;height:44px;padding:0;border:none;background:transparent;display:flex;align-items:flex-end;justify-content:flex-end;cursor:zoom-in'
    zoomBtn.innerHTML = `<span style="width:18px;height:18px;border-radius:999px;background:rgba(15,23,42,0.9);border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;pointer-events:none"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>`
    zoomBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      openMarkerLightbox(marker)
    })
    wrap.appendChild(zoomBtn)
  }

  return wrap
}

function openMarkerLightbox(marker: MarkerVisualInput): void {
  const close = () => {
    backdrop.remove()
    unregEsc()
  }
  const backdrop = createBackdrop('marker-visual-lightbox-backdrop', close)
  backdrop.style.cssText = 'position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(2px);z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px'

  const box = document.createElement('div')
  box.className = 'marker-visual-lightbox'
  box.style.cssText = 'position:relative;max-width:min(90vw,420px);width:100%;background:var(--surface-card);border:1px solid var(--border-default);border-radius:var(--radius-lg);box-shadow:0 24px 64px rgba(0,0,0,0.6);padding:16px'
  box.addEventListener('click', (e) => e.stopPropagation())

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'marker-visual-lightbox-close'
  closeBtn.setAttribute('aria-label', 'Sulje')
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:8px;border:1px solid var(--border-strong);background:transparent;color:var(--text-muted);font-size:15px;cursor:pointer'
  closeBtn.addEventListener('click', close)
  box.appendChild(closeBtn)

  const stage = document.createElement('div')
  stage.className = 'marker-visual-lightbox-stage'
  stage.style.cssText = 'background:#fff;border-radius:var(--radius-sm);min-height:200px;display:flex;align-items:center;justify-content:center;margin-top:6px'
  stage.appendChild(buildMarkerVisual(marker, { size: 160, zoomable: false }))
  box.appendChild(stage)

  const caption = document.createElement('p')
  caption.className = 'marker-visual-lightbox-caption'
  caption.style.cssText = 'text-align:center;font-size:13px;color:var(--text-muted);margin:10px 0 0'
  caption.textContent = marker.label ?? compactLabel(marker.type)
  box.appendChild(caption)

  backdrop.appendChild(box)
  document.body.appendChild(backdrop)
  const unregEsc = registerEscClose(close)
}
