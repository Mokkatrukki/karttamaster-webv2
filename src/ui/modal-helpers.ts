/**
 * Shared modal utilities — käytä kaikissa modaaleissa.
 *
 * registerEscClose: rekisteröi Esc-näppäin sulkemaan modaali.
 * Palauttaa cleanup-funktion jota kutsutaan close():ssa.
 *
 * Esimerkki:
 *   private unregEsc: (() => void) | null = null
 *   // open():
 *   this.unregEsc = registerEscClose(() => this.close())
 *   // close():
 *   this.unregEsc?.(); this.unregEsc = null
 */
import { signVisual, signVisualParts, compactLabel } from '../logic/sign-visual'
import { signImageSrc } from '../logic/sign-images'
import { getIconById } from '../logic/icon-set'
import type { SignPart } from '../logic/sign-library'

export function registerEscClose(onClose: () => void): () => void {
  const fn = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', fn)
  return () => document.removeEventListener('keydown', fn)
}

/**
 * createBackdrop: luo modal-backdrop-elementin joka sulkee modaalin
 * klikattaessa taustan ulkopuolelta.
 */
export function createBackdrop(className: string, onClose: () => void): HTMLDivElement {
  const backdrop = document.createElement('div')
  backdrop.className = className
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) onClose()
  })
  return backdrop
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * signPreviewHtml — iso, hyvin sommiteltu merkki-esikatselu modaaleihin (DESIGN.md §K SignPreview).
 * V99-precedence: template-kuva (contain, valkotausta, ei crop) > Lucide-ikoni (iso, väritausta) >
 * compactLabel-tiili. Kuva onerror → poistuu → alla oleva ikoni/label paljastuu (T103-fallback).
 * Palauttaa HTML-stringin; kutsuja asettaa `el.innerHTML`.
 */
export function signPreviewHtml(opts: { id: string; imageId?: string; label: string; color: string; iconId?: string; parts?: SignPart[] }): string {
  const color = escHtml(opts.color)

  // T172/V107: yhdistelmämerkki — pystypino, sama järjestys kuin kartalla (parts[0] ylin)
  if (opts.parts && opts.parts.length > 0) {
    const resolved = signVisualParts({ iconId: opts.iconId, label: opts.label, parts: opts.parts }, signImageSrc)
    const slotH = 150 / resolved.length
    const slots = resolved.map((p, i) => {
      const border = i > 0 ? 'border-top:1px solid var(--border-default)' : ''
      if (p.kind === 'image') {
        return `<div style="height:${slotH}px;${border};display:flex;align-items:center;justify-content:center;background:#fff"><img src="${p.src}" alt="" onerror="this.remove()" style="width:100%;height:100%;object-fit:contain;pointer-events:none"></div>`
      }
      if (p.kind === 'icon') {
        const iconEntry = getIconById(p.id)
        const svg = iconEntry
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconEntry.svgContent}</svg>`
          : ''
        return `<div style="height:${slotH}px;${border};display:flex;align-items:center;justify-content:center;background:${color}">${svg}</div>`
      }
      return `<div style="height:${slotH}px;${border};display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font:900 16px sans-serif">${escHtml(p.text)}</div>`
    }).join('')
    return `<div class="sign-preview" style="width:100%;height:150px;border-radius:var(--radius-sm);border:1px solid var(--border-default);overflow:hidden;display:flex;flex-direction:column">${slots}</div>`
  }

  const src = signImageSrc(opts.imageId ?? opts.id)
  const v = signVisual({ iconId: opts.iconId, label: opts.label }, src)
  const iconEntry = opts.iconId ? getIconById(opts.iconId) : null
  const fallbackInner = iconEntry
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconEntry.svgContent}</svg>`
    : `<span style="font:900 40px sans-serif;color:#fff;letter-spacing:0.04em">${escHtml(compactLabel(opts.label))}</span>`
  const img = v.kind === 'image'
    ? `<img src="${v.src}" alt="" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;padding:10px;box-sizing:border-box;pointer-events:none">`
    : ''
  return `<div class="sign-preview" style="position:relative;width:100%;height:150px;border-radius:var(--radius-sm);border:1px solid var(--border-default);overflow:hidden;background:#fff">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:${color}">${fallbackInner}</div>
    ${img}
  </div>`
}
